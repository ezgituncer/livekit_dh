import asyncio
import logging
import os

from dotenv import load_dotenv
from livekit.agents import Agent, AgentServer, AgentSession, JobContext, cli
from livekit import rtc
from livekit.plugins import deepgram
from qwen_realtime.realtime_model import RealtimeModel as QwenRealtimeModel

from deepgram_failover import ensure_budget_checker_running, get_key_provider
from prompts import BRAND_TERMS, VOICE_INSTRUCTIONS

logger = logging.getLogger("agent")
# LiveKit runs each job's entrypoint in a separate subprocess whose *root* logger
# is left at Python's default level (WARNING). A logger at NOTSET (the default for
# a freshly created logger) inherits that there, so its INFO/DEBUG records are
# dropped at the source and never reach the terminal — which is why these custom
# logs were invisible while livekit.* logs (explicitly leveled by the framework)
# still showed. Pin an explicit level so our logs survive into the job process.
logger.setLevel(os.getenv("AGENT_LOG_LEVEL", "INFO").upper())

load_dotenv(".env")


SUPPORTED_LANGUAGES = {"tr", "en", "ar", "es", "pt", "ru"}

# Server-side VAD "noise gate" for the realtime model. `threshold` (0..1) is the
# speech-probability level audio must exceed to be treated as speech — raise it
# to ignore louder ambient/background noise (the "decibel limit"); lower it if
# soft speakers get cut off. `silence_duration_ms` is how long of a pause ends a
# turn. Overridable via the AGENT_VAD_THRESHOLD env var.
VAD_THRESHOLD = float(os.getenv("AGENT_VAD_THRESHOLD", "0.7"))
VAD_SILENCE_MS = int(os.getenv("AGENT_VAD_SILENCE_MS", "800"))
# `prefix_padding_ms` is how much audio *before* the VAD trips is kept and fed to
# the ASR. Too small and the first word is clipped (the transcript starts
# mid-sentence) — the most common cause of a poor user transcript. 500ms gives
# the ASR the speech onset without affecting turn-taking. Overridable via env.
VAD_PREFIX_PADDING_MS = int(os.getenv("AGENT_VAD_PREFIX_PADDING_MS", "500"))

# Qwen-Omni realtime connection. Keys come from the environment (never committed to
# source); the agent fails over to the next key when one is refused — e.g. when its
# 1M-token quota is exhausted, which DashScope surfaces as HTTP 401 at the websocket
# handshake. Model/base_url/voice default to the previous hardcoded values.
QWEN_BASE_URL = os.getenv(
    "QWEN_BASE_URL", "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime"
)
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen3.5-omni-plus-realtime")
QWEN_VOICE = os.getenv("QWEN_VOICE", "Ethan")
# The displayed user transcript is produced by Deepgram (Nova-3 streaming):
# realtime, multilingual (incl. Turkish), and brand-name biasing via keyterm
# prompting. qwen-omni still drives the conversation. Requires DEEPGRAM_API_KEY
# in the environment (read by the plugin automatically).
DEEPGRAM_MODEL = os.getenv("DEEPGRAM_MODEL", "nova-3")

# English names used to pin the model's output language in its instructions.
_LANGUAGE_NAMES = {
    "tr": "Turkish",
    "en": "English",
    "ar": "Arabic",
    "es": "Spanish",
    "pt": "Portuguese",
    "ru": "Russian",
}


def _qwen_api_keys() -> list[str]:
    """Ordered Qwen API-key pool from env (primary first) for automatic failover.

    Reads ``QWEN_API_KEYS`` (comma-separated); falls back to a single ``QWEN_API_KEY``.
    Raises if none are set so we never silently fall back to a baked-in key.
    """
    raw = os.getenv("QWEN_API_KEYS") or os.getenv("QWEN_API_KEY") or ""
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    if not keys:
        raise RuntimeError(
            "No Qwen API key configured. Set QWEN_API_KEYS (comma-separated, primary "
            "first) or QWEN_API_KEY in agent/.env."
        )
    return keys


def _resolve_language(attr_value: str | None) -> str | None:
    if not attr_value:
        return None
    if attr_value not in SUPPORTED_LANGUAGES:
        logger.warning("Unsupported language '%s', ignoring", attr_value)
        return None
    return attr_value


# Keep prewarmed (idle) processes ready so the agent joins the room instantly
# instead of cold-starting per session (which can exceed the client's
# agent-join timeout → "agent did not join the room"). Override with the
# LIVEKIT_NUM_IDLE_PROCESSES env var if needed.
server = AgentServer(num_idle_processes=2)




@server.rtc_session(agent_name="eval-voice-agent")
async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    await ensure_budget_checker_running()
    logger.info(
        "Deepgram failover: checker running — active_key=%s project=%s",
        get_key_provider().active_alias,
        get_key_provider().active_project_id,
    )

    await ctx.connect()
    participant = await ctx.wait_for_participant()
    attrs = participant.attributes
    logger.info("Participant attributes: %s", attrs)

    # `language` is the only browser-supplied attribute that affects this session:
    # it pins the input ASR language and the model's output language. The realtime
    # model is full-duplex (no separate STT/TTS/turn-detector to configure).
    language = _resolve_language(attrs.get("language"))

    # Deepgram (Nova-3) produces the displayed transcript for every language —
    # realtime streaming, Turkish-capable, and brand-aware via keyterm prompting.
    # qwen-omni still drives the conversation; its built-in input ASR is disabled
    # (input_audio_transcription=None) so the framework uses Deepgram's transcript.
    # keyterm prompting is Nova-3-only — pass it only when applicable so overriding
    # DEEPGRAM_MODEL to a non-Nova-3 model doesn't crash session setup.
    stt_kwargs: dict = {"model": DEEPGRAM_MODEL, "language": language or "en"}
    if BRAND_TERMS and DEEPGRAM_MODEL.startswith("nova-3"):
        stt_kwargs["keyterm"] = BRAND_TERMS
    # Key comes from the provider so failover is reflected for every new session.
    stt = deepgram.STT(api_key=get_key_provider().active_key, **stt_kwargs)

    logger.info(
        "Composing session: language=%s stt=deepgram:%s keyterms=%s vad_prefix_padding_ms=%s",
        language,
        DEEPGRAM_MODEL,
        BRAND_TERMS,
        VAD_PREFIX_PADDING_MS,
    )

    session = AgentSession(
        stt=stt,
        llm=QwenRealtimeModel(
            model=QWEN_MODEL,
            base_url=QWEN_BASE_URL,
            # Ordered key pool from env; rotates to a backup if a key is refused.
            api_keys=_qwen_api_keys(),
            voice=QWEN_VOICE,  # erkek ses (alternatif: "Aiden")
            # Built-in input ASR is disabled so Deepgram (the AgentSession `stt`)
            # owns the displayed transcript. NOTE: this also removes the old
            # input-transcription "language anchor" for qwen's *reply* language — the
            # system-instruction directive below is now the only lever, so watch for
            # reply-language drift and re-add an anchor if it regresses.
            input_audio_transcription=None,
            # Noise gate: a higher VAD threshold makes the model ignore ambient
            # / background sounds and only trigger on clear speech. Tune via the
            # AGENT_VAD_THRESHOLD env var.
            turn_detection={
                "type": "server_vad",
                "threshold": VAD_THRESHOLD,
                "prefix_padding_ms": VAD_PREFIX_PADDING_MS,
                "silence_duration_ms": VAD_SILENCE_MS,
            },
        ),
    )

    # Pin the model's output language so qwen-omni never drifts into Chinese
    # (e.g. filler like "嗯") — it auto-detects language from the audio otherwise.
    lang_name = _LANGUAGE_NAMES.get(language or "en", "English")
    language_directive = (
        f"Always speak and respond in {lang_name}. "
        f"Never reply in Chinese or use Chinese characters, and do not emit "
        f"filler sounds from other languages; if you need to acknowledge, use a "
        f"natural {lang_name} word."
    )
    instructions = f"{language_directive}\n\n{VOICE_INSTRUCTIONS}"

    agent = Agent(instructions=instructions)

    # Allow the browser to interrupt the agent mid-utterance via a "skip" RPC.
    async def _on_skip(data: rtc.RpcInvocationData) -> str:
        logger.info("Skip requested via RPC — interrupting current speech")
        session.interrupt(force=True)
        return "ok"

    ctx.room.local_participant.register_rpc_method("skip", _on_skip)

    await session.start(agent=agent, room=ctx.room)


if __name__ == "__main__":
    cli.run_app(server)
