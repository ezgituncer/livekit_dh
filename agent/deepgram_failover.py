"""
Deepgram API-key failover with per-project balance checking.

Each configured key slot is a triplet of (asr_key, project_id, billing_key).
A background task checks the active key's balance at a fixed interval. When
the balance drops below DEEPGRAM_MIN_BALANCE that slot is permanently discarded
and the next one becomes active — together with its project_id and billing_key.

Configuration (agent/.env):
    DEEPGRAM_KEYS   Comma-separated triplets, primary first:
                        asr_key1|project_id1|billing_key1,asr_key2|project_id2|billing_key2
                    asr_key    — used for all STT requests
                    project_id — appears in the balance API URL
                    billing_key — must have the 'usage:read' scope for that project

    DEEPGRAM_FAILOVER_ENABLED  "true"/"false" (default: true)
    DEEPGRAM_BUDGET_INTERVAL   Seconds between balance checks (default: 60)
    DEEPGRAM_MIN_BALANCE       USD threshold before discarding a key (default: 5.0)
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Optional

import aiohttp

logger = logging.getLogger("agent.deepgram_failover")
logger.setLevel(os.getenv("AGENT_LOG_LEVEL", "INFO").upper())

_BALANCE_URL = "https://api.deepgram.com/v1/projects/{project_id}/balances"
_REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)


# ---------------------------------------------------------------------------
# Data structures
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class _KeyEntry:
    alias: str        # "key_1", "key_2", … — safe to log
    asr_key: str      # used for STT — never logged
    project_id: str   # used in balance API URL
    billing_key: str  # used for balance API auth — never logged


@dataclass(frozen=True)
class _FailoverConfig:
    entries: list[_KeyEntry]
    min_balance: float    # USD
    check_interval: float  # seconds
    enabled: bool


def _load_config() -> _FailoverConfig:
    """Parse DEEPGRAM_KEYS into a list of (asr_key, project_id, billing_key) triplets.

    New format (DEEPGRAM_KEYS takes priority):
        DEEPGRAM_KEYS=asr_key1|project_id1|billing_key1,asr_key2|project_id2|billing_key2

    Legacy fallback (single-slot, kept for backwards compat):
        DEEPGRAM_API_KEY=...
        DEEPGRAM_PROJECT_ID=...
        DEEPGRAM_BILLING_API_KEY=...
    """
    raw = os.getenv("DEEPGRAM_KEYS", "").strip()
    if not raw:
        # Fall back to the old separate vars and synthesise a single-slot entry.
        asr_key = os.getenv("DEEPGRAM_API_KEY", "").strip()
        project_id = os.getenv("DEEPGRAM_PROJECT_ID", "").strip()
        billing_key = os.getenv("DEEPGRAM_BILLING_API_KEY", "").strip()
        if not asr_key:
            raise RuntimeError(
                "No Deepgram key configured. "
                "Set DEEPGRAM_KEYS (asr_key|project_id|billing_key, comma-separated) "
                "or the legacy DEEPGRAM_API_KEY / DEEPGRAM_PROJECT_ID / DEEPGRAM_BILLING_API_KEY."
            )
        raw = f"{asr_key}|{project_id}|{billing_key}"
        logger.debug(
            "DEEPGRAM_KEYS not set — using legacy DEEPGRAM_API_KEY / DEEPGRAM_PROJECT_ID / "
            "DEEPGRAM_BILLING_API_KEY as a single slot."
        )

    entries: list[_KeyEntry] = []
    for i, slot in enumerate(raw.split(",")):
        slot = slot.strip()
        if not slot:
            continue
        parts = slot.split("|")
        if len(parts) != 3:
            raise RuntimeError(
                f"DEEPGRAM_KEYS slot {i + 1} is malformed — expected "
                f"asr_key|project_id|billing_key, got {len(parts)} part(s)."
            )
        asr_key, project_id, billing_key = (p.strip() for p in parts)
        if not all([asr_key, project_id, billing_key]):
            raise RuntimeError(
                f"DEEPGRAM_KEYS slot {i + 1} has an empty field — "
                "all three of asr_key, project_id, billing_key are required."
            )
        entries.append(_KeyEntry(
            alias=f"key_{i + 1}",
            asr_key=asr_key,
            project_id=project_id,
            billing_key=billing_key,
        ))

    if not entries:
        raise RuntimeError("DEEPGRAM_KEYS is set but contains no valid entries.")

    return _FailoverConfig(
        entries=entries,
        min_balance=float(os.getenv("DEEPGRAM_MIN_BALANCE", "5.0")),
        check_interval=float(os.getenv("DEEPGRAM_BUDGET_INTERVAL", "60")),
        enabled=os.getenv("DEEPGRAM_FAILOVER_ENABLED", "true").lower()
        in ("true", "1", "yes"),
    )


# ---------------------------------------------------------------------------
# Key provider
# ---------------------------------------------------------------------------

class DeepgramKeyProvider:
    """Asyncio-safe pool of Deepgram key slots.

    Exhausted slots are permanently discarded; ``active_key`` always returns
    the first remaining slot's ASR key.  At least one slot is always kept so
    the agent never loses its STT key entirely.
    """

    def __init__(self, config: _FailoverConfig) -> None:
        self._config = config
        # Working pool — entries are popped when their balance is exhausted.
        self._pool: list[_KeyEntry] = list(config.entries)
        self._lock = asyncio.Lock()

    @classmethod
    def from_env(cls) -> "DeepgramKeyProvider":
        config = _load_config()
        provider = cls(config)
        slot_summary = "  |  ".join(
            f"{e.alias} project={e.project_id}" for e in config.entries
        )
        logger.info(
            "Deepgram key provider initialised: %d slot(s) — %s",
            len(config.entries),
            slot_summary,
        )
        return provider

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    @property
    def active_key(self) -> str:
        return self._pool[0].asr_key

    @property
    def active_alias(self) -> str:
        return self._pool[0].alias

    @property
    def active_project_id(self) -> str:
        return self._pool[0].project_id

    # ------------------------------------------------------------------
    # Background checker
    # ------------------------------------------------------------------

    async def run_budget_checker(self) -> None:
        """Long-running coroutine; schedule as one asyncio.Task per process."""
        if not self._config.enabled:
            logger.info("Deepgram failover disabled (DEEPGRAM_FAILOVER_ENABLED=false)")
            return

        logger.info(
            "Deepgram budget checker started: interval=%.0fs threshold=$%.2f slots=%d",
            self._config.check_interval,
            self._config.min_balance,
            len(self._pool),
        )

        cycle = 0
        while True:
            cycle += 1
            logger.info("Deepgram budget checker: cycle #%d", cycle)
            await self._check_and_maybe_discard()
            logger.info(
                "Deepgram budget checker: sleeping %.0fs until next check "
                "(active_key=%s remaining_slots=%d)",
                self._config.check_interval,
                self._pool[0].alias,
                len(self._pool),
            )
            await asyncio.sleep(self._config.check_interval)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    async def _check_and_maybe_discard(self) -> None:
        # Snapshot current active entry outside the lock; HTTP call must not
        # block other coroutines that read active_key.
        entry = self._pool[0]

        logger.info(
            "Deepgram budget check: active_key=%s project=%s",
            entry.alias,
            entry.project_id,
        )

        balance = await self._fetch_balance(entry)
        if balance is None:
            return  # _fetch_balance already logged the specific error

        logger.info(
            "Deepgram budget check result: active_key=%s balance=$%.4f threshold=$%.2f",
            entry.alias,
            balance,
            self._config.min_balance,
        )

        if balance >= self._config.min_balance:
            logger.info(
                "Deepgram balance OK: active_key=%s balance=$%.4f >= $%.2f — no failover",
                entry.alias,
                balance,
                self._config.min_balance,
            )
            return

        logger.warning(
            "Deepgram balance below threshold: active_key=%s balance=$%.4f < $%.2f — "
            "discarding slot and switching to next key",
            entry.alias,
            balance,
            self._config.min_balance,
        )

        async with self._lock:
            # Guard: a concurrent check may have already discarded this entry.
            if self._pool[0] is not entry:
                logger.info(
                    "Deepgram failover: slot already discarded by concurrent check — skipping"
                )
                return

            if len(self._pool) == 1:
                logger.error(
                    "Deepgram failover: all %d configured slot(s) are exhausted — "
                    "no valid fallback key available. "
                    "Keeping active_key=%s until the slot is replenished.",
                    len(self._config.entries),
                    entry.alias,
                )
                return

            discarded = self._pool.pop(0)
            logger.warning(
                "Deepgram failover: discarded active_key=%s (project=%s) — "
                "switched to active_key=%s (project=%s)",
                discarded.alias,
                discarded.project_id,
                self._pool[0].alias,
                self._pool[0].project_id,
            )

    async def _fetch_balance(self, entry: _KeyEntry) -> Optional[float]:
        """Fetch remaining USD balance for *entry*. Returns None on any error."""
        url = _BALANCE_URL.format(project_id=entry.project_id)
        headers = {"Authorization": f"Token {entry.billing_key}"}
        try:
            async with aiohttp.ClientSession(timeout=_REQUEST_TIMEOUT) as session:
                async with session.get(url, headers=headers) as resp:
                    return await _parse_balance_response(resp)
        except asyncio.TimeoutError:
            logger.error(
                "Deepgram budget check: request timed out after %.0fs",
                _REQUEST_TIMEOUT.total,
            )
        except aiohttp.ClientConnectionError as exc:
            logger.error("Deepgram budget check: network error — %s", exc)
        except Exception as exc:  # noqa: BLE001
            logger.error("Deepgram budget check: unexpected error — %s", exc)
        return None


# ---------------------------------------------------------------------------
# HTTP response parsing (isolated for easy updates)
# ---------------------------------------------------------------------------

async def _parse_balance_response(resp: aiohttp.ClientResponse) -> Optional[float]:
    status = resp.status

    if status in (401, 403):
        logger.error(
            "Deepgram budget check: HTTP %d — billing key lacks 'usage:read' scope. "
            "Grant it in the Deepgram console (Projects → API Keys → edit key).",
            status,
        )
        return None

    if status == 429:
        logger.warning(
            "Deepgram budget check: HTTP 429 rate-limited — will retry next interval"
        )
        return None

    if status >= 500:
        body = (await resp.text())[:200]
        logger.error("Deepgram budget check: HTTP %d server error — %s", status, body)
        return None

    if status != 200:
        logger.error("Deepgram budget check: unexpected HTTP %d", status)
        return None

    try:
        data = await resp.json()
    except Exception as exc:  # noqa: BLE001
        logger.error("Deepgram budget check: malformed JSON — %s", exc)
        return None

    return _extract_balance(data)


def _extract_balance(data: object) -> Optional[float]:
    """Extract total balance from Deepgram balance API response body.

    Expected shape:
        {"balances": [{"amount": 188.61, "units": "usd", ...}, ...]}
    """
    try:
        balances = data["balances"]  # type: ignore[index]
        if not isinstance(balances, list) or len(balances) == 0:
            logger.error(
                "Deepgram budget check: 'balances' is empty or not a list — %r", data
            )
            return None
        return sum(float(b["amount"]) for b in balances)
    except (KeyError, TypeError, ValueError) as exc:
        logger.error(
            "Deepgram budget check: unexpected response shape (%s) — %r", exc, data
        )
        return None


# ---------------------------------------------------------------------------
# Process-level singleton
# ---------------------------------------------------------------------------

_provider: Optional[DeepgramKeyProvider] = None
_checker_task: Optional["asyncio.Task[None]"] = None


def get_key_provider() -> DeepgramKeyProvider:
    global _provider
    if _provider is None:
        _provider = DeepgramKeyProvider.from_env()
    return _provider


async def ensure_budget_checker_running() -> None:
    """Start the background checker task if not already running (idempotent)."""
    global _checker_task
    if _checker_task is not None and not _checker_task.done():
        logger.debug("Deepgram budget checker already running — skipping")
        return
    provider = get_key_provider()
    _checker_task = asyncio.create_task(
        provider.run_budget_checker(),
        name="deepgram_budget_checker",
    )
    logger.info("Deepgram budget checker task created (pid=%d)", os.getpid())
