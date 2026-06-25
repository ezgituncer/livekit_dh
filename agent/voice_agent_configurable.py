import logging
import os

from dotenv import load_dotenv
from livekit.agents import (
    AgentServer,
    AgentSession,
    JobContext,
    TurnHandlingOptions,
    UserStateChangedEvent,
    cli,
)
from livekit.agents.voice.room_io import AudioInputOptions, RoomOptions
from livekit.plugins import openai
from livekit import rtc
from openai.types.realtime import AudioTranscription
from qwen_realtime.realtime_model import RealtimeModel as QwenRealtimeModel
from transcription_flow import ConcurrentTranscriber

from registry import (
    AudioBuffer,
    BufferedTTS,
    ConfigurableAgent,
    DETECTOR_REGISTRY,
    STT_REGISTRY,
    TTS_REGISTRY,
    VOICE_INSTRUCTIONS,
    prewarm,
)

logger = logging.getLogger("agent")

load_dotenv(".env")


SUPPORTED_LANGUAGES = {"tr", "en", "ar", "es", "pt", "ru"}

# Server-side VAD "noise gate" for the realtime model. `threshold` (0..1) is the
# speech-probability level audio must exceed to be treated as speech — raise it
# to ignore louder ambient/background noise (the "decibel limit"); lower it if
# soft speakers get cut off. `silence_duration_ms` is how long of a pause ends a
# turn. Overridable via the AGENT_VAD_THRESHOLD env var.
VAD_THRESHOLD = float(os.getenv("AGENT_VAD_THRESHOLD", "0.7"))
VAD_SILENCE_MS = int(os.getenv("AGENT_VAD_SILENCE_MS", "800"))
VAD_PREFIX_PADDING_MS = 300

# Qwen-Omni realtime connection. Keys come from the environment (never committed to
# source); the agent fails over to the next key when one is refused — e.g. when its
# 1M-token quota is exhausted, which DashScope surfaces as HTTP 401 at the websocket
# handshake. Model/base_url/voice default to the previous hardcoded values.
QWEN_BASE_URL = os.getenv(
    "QWEN_BASE_URL", "wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime"
)
QWEN_MODEL = os.getenv("QWEN_MODEL", "qwen3.5-omni-flash-realtime")
QWEN_VOICE = os.getenv("QWEN_VOICE", "Ethan")
# Input-ASR model that produces the *displayed* user transcript (separate from the
# conversation model above). Swap via env to A/B different recognizers, e.g.
# "paraformer-realtime-v2". NOTE: this model's `language` pin is also what anchors
# the conversation's output language — a model that ignores it may let replies drift.
QWEN_TRANSCRIPTION_MODEL = os.getenv("QWEN_TRANSCRIPTION_MODEL", "paraformer-realtime-v2")

# Concurrent transcription flow: run a SECOND realtime session (text modality
# only) purely to transcribe the user, leveraging the omni model's own
# comprehension instead of the dedicated input-ASR. More accurate, but streams
# the audio to DashScope twice (~2x input-token cost on the 1M-token cap; it
# reuses the same key pool so failover still applies). When enabled, the main
# session's own input transcription is turned OFF so the UI shows a single
# transcript (the better one); the reply language is anchored via instructions.
QWEN_TRANSCRIBE_SESSION_ENABLED = (
    os.getenv("QWEN_TRANSCRIBE_SESSION_ENABLED", "true").strip().lower()
    in ("true", "1", "yes")
)
QWEN_TRANSCRIBE_SESSION_MODEL = os.getenv(
    "QWEN_TRANSCRIBE_SESSION_MODEL", "qwen3.5-omni-plus-realtime"
)

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

# English names used to pin the model's output language in its instructions.
_LANGUAGE_NAMES = {
    "tr": "Turkish",
    "en": "English",
    "ar": "Arabic",
    "es": "Spanish",
    "pt": "Portuguese",
    "ru": "Russian",
}

DEFAULT_STT = "elevenlabs-scribe-v2"
DEFAULT_TTS = "elevenlabs-multilingual-v2"
DEFAULT_DETECTOR = "multilingual"


# Keep prewarmed (idle) processes ready so the agent joins the room instantly
# instead of cold-starting per session (which can exceed the client's
# agent-join timeout → "agent did not join the room"). Override with the
# LIVEKIT_NUM_IDLE_PROCESSES env var if needed.
server = AgentServer(num_idle_processes=2)
server.setup_fnc = prewarm


def _resolve(attr_value: str | None, registry: dict, default: str, kind: str) -> str:
    if attr_value and attr_value in registry:
        return attr_value
    if attr_value:
        logger.warning("Unknown %s '%s', falling back to '%s'", kind, attr_value, default)
    return default


def _resolve_language(attr_value: str | None) -> str | None:
    if not attr_value:
        return None
    if attr_value not in SUPPORTED_LANGUAGES:
        logger.warning("Unsupported language '%s', ignoring", attr_value)
        return None
    return attr_value


def _parse_number(attr_value: str | None, *, cast):
    if attr_value is None or attr_value == "":
        return None
    try:
        return cast(attr_value)
    except (TypeError, ValueError):
        logger.warning("Invalid numeric attribute '%s', ignoring", attr_value)
        return None


def _parse_bool(attr_value: str | None) -> bool | None:
    if attr_value is None or attr_value == "":
        return None
    lowered = attr_value.strip().lower()
    if lowered in ("true", "1", "yes"):
        return True
    if lowered in ("false", "0", "no"):
        return False
    logger.warning("Invalid boolean attribute '%s', ignoring", attr_value)
    return None


def _resolve_server_vad(attrs) -> dict | None:
    keys = (
        ("vad_silence_threshold_secs", float),
        ("vad_threshold", float),
        ("min_speech_duration_ms", int),
        ("min_silence_duration_ms", int),
    )
    out: dict = {}
    for key, cast in keys:
        value = _parse_number(attrs.get(key), cast=cast)
        if value is not None:
            out[key] = value
    return out or None


@server.rtc_session(agent_name="eval-voice-agent")
async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    await ctx.connect()
    participant = await ctx.wait_for_participant()
    attrs = participant.attributes
    logger.info("Participant attributes: %s", attrs)

    stt_id = _resolve(attrs.get("stt"), STT_REGISTRY, DEFAULT_STT, "stt")
    tts_id = _resolve(attrs.get("tts"), TTS_REGISTRY, DEFAULT_TTS, "tts")
    detector_id = _resolve(attrs.get("detector"), DETECTOR_REGISTRY, DEFAULT_DETECTOR, "detector")
    language = _resolve_language(attrs.get("language"))
    voice_id = attrs.get("voice_id") or None

    stt_entry = STT_REGISTRY[stt_id]
    tts_entry = TTS_REGISTRY[tts_id]
    detector_entry = DETECTOR_REGISTRY[detector_id]

    is_realtime_stt = stt_id == "elevenlabs-scribe-v2-realtime"
    server_vad = _resolve_server_vad(attrs) if is_realtime_stt else None
    server_vad_enabled = _parse_bool(attrs.get("server_vad_enabled")) if is_realtime_stt else None

    cfg = {
        "language": language if stt_entry.supports_language else None,
        "voice_id": voice_id,
        "server_vad": server_vad,
        "server_vad_enabled": server_vad_enabled,
    }
    # TTS always gets the language (falls back to "en" inside the factory).
    tts_cfg = {"language": language, "voice_id": voice_id}

    logger.info(
        "Composing session: stt=%s tts=%s detector=%s language=%s",
        stt_id,
        tts_id,
        detector_id,
        language,
    )

    stt = stt_entry.factory(cfg)
    tts = tts_entry.factory(tts_cfg)
    if tts_entry.wrap_buffered:
        tts = BufferedTTS(tts=tts)

    audio_buffer = AudioBuffer() if detector_entry.needs_audio_buffer else None
    detector = detector_entry.factory(ctx.proc.userdata, audio_buffer)

    # Interruption — defaults match the previous hardcoded values so no-attrs
    # behavior is unchanged. Browser-supplied values are validated by the token
    # API before reaching us.
    interruption_mode = attrs.get("interruption_mode")
    if interruption_mode not in ("adaptive", "vad"):
        interruption_mode = "vad"
    interruption_min_duration = _parse_number(attrs.get("interruption_min_duration"), cast=float)
    if interruption_min_duration is None:
        interruption_min_duration = 1.0
    interruption_min_words = _parse_number(attrs.get("interruption_min_words"), cast=int)
    if interruption_min_words is None:
        interruption_min_words = 0
    interruption_enabled = _parse_bool(attrs.get("interruption_enabled"))
    if interruption_enabled is None:
        interruption_enabled = True

    # Endpointing — start from the detector's defaults (if any), then let
    # explicit attribute values override per-key.
    endpointing = dict(detector_entry.endpointing) if detector_entry.endpointing else {}
    endpointing_min_delay = _parse_number(attrs.get("endpointing_min_delay"), cast=float)
    endpointing_max_delay = _parse_number(attrs.get("endpointing_max_delay"), cast=float)
    if endpointing_min_delay is not None:
        endpointing["min_delay"] = endpointing_min_delay
    if endpointing_max_delay is not None:
        endpointing["max_delay"] = endpointing_max_delay

    turn_handling_kwargs: dict = {
        "turn_detection": detector,
        "interruption": {
            "enabled": interruption_enabled,
            "mode": interruption_mode,
            "min_duration": interruption_min_duration,
            "min_words": interruption_min_words,
        },
    }
    if endpointing:
        turn_handling_kwargs["endpointing"] = endpointing

    # Noise gate: a higher VAD threshold makes the model ignore ambient /
    # background sounds and only trigger on clear speech. Tune via the
    # AGENT_VAD_THRESHOLD env var. Shared with the concurrent transcription
    # session so both segment utterances identically.
    qwen_turn_detection = {
        "type": "server_vad",
        "threshold": VAD_THRESHOLD,
        "prefix_padding_ms": VAD_PREFIX_PADDING_MS,
        "silence_duration_ms": VAD_SILENCE_MS,
    }

    # Language anchor (the real fix for wrong-language replies): qwen-omni-realtime
    # has NO session-level language field and does NOT reliably follow the system
    # instruction for output language — it auto-detects the spoken language. Pinning
    # the input-transcription `language` anchors the conversation language.
    #
    # When the concurrent transcription session is enabled it owns the displayed
    # transcript, so we DISABLE the main session's own input ASR here to avoid two
    # competing transcripts in the UI. The reply language is then anchored via the
    # instruction directive below instead of via the input-transcription pin.
    main_input_transcription = (
        None
        if QWEN_TRANSCRIBE_SESSION_ENABLED
        else AudioTranscription(model=QWEN_TRANSCRIPTION_MODEL, language=language or "en")
    )

    session = AgentSession(
        llm=QwenRealtimeModel(
            model=QWEN_MODEL,
            base_url=QWEN_BASE_URL,
            # Ordered key pool from env; rotates to a backup if a key is refused.
            api_keys=_qwen_api_keys(),
            voice=QWEN_VOICE,  # erkek ses (alternatif: "Aiden")
            input_audio_transcription=main_input_transcription,
            turn_detection=qwen_turn_detection,
        ),
    )

    if audio_buffer is not None:
        def on_user_state_changed(ev: UserStateChangedEvent) -> None:
            if ev.new_state == "speaking":
                audio_buffer.reset()

        session.on("user_state_changed", on_user_state_changed)

    # Pin the model's output language so qwen-omni never drifts into Chinese
    # (e.g. filler like "嗯") — important now that the input ASR is disabled.
    lang_name = _LANGUAGE_NAMES.get(language or "en", "English")
    language_directive = (
        f"Always speak and respond in {lang_name}. "
        f"Never reply in Chinese or use Chinese characters, and do not emit "
        f"filler sounds from other languages; if you need to acknowledge, use a "
        f"natural {lang_name} word."
    )
    instructions = f"{language_directive}\n\n{VOICE_INSTRUCTIONS}"
    if tts_entry.instructions:
        instructions = f"{instructions}\n\n{tts_entry.instructions}"

    agent = ConfigurableAgent(
        instructions=instructions,
        audio_buffer=audio_buffer,
        strip_tags=tts_entry.strip_tags,
    )

    # Allow the browser to interrupt the agent mid-utterance via a "skip" RPC.
    async def _on_skip(data: rtc.RpcInvocationData) -> str:
        logger.info("Skip requested via RPC — interrupting current speech")
        session.interrupt(force=True)
        return "ok"

    ctx.room.local_participant.register_rpc_method("skip", _on_skip)

    start_kwargs: dict = {"agent": agent, "room": ctx.room}
    if detector_entry.pipeline_sample_rate:
        start_kwargs["room_options"] = RoomOptions(
            audio_input=AudioInputOptions(sample_rate=detector_entry.pipeline_sample_rate),
        )

    await session.start(**start_kwargs)

    # Concurrent transcription flow (additive, fully isolated): a second realtime
    # session transcribes the same user audio with text-only output and publishes
    # it as the user transcript. Any failure here is logged and swallowed inside
    # ConcurrentTranscriber, so it can never block or break the main session above.
    if QWEN_TRANSCRIBE_SESSION_ENABLED:
        try:
            transcriber = ConcurrentTranscriber(
                room=ctx.room,
                participant=participant,
                model=QWEN_TRANSCRIBE_SESSION_MODEL,
                base_url=QWEN_BASE_URL,
                api_keys=_qwen_api_keys(),
                turn_detection=qwen_turn_detection,
                language=language,
            )
            transcriber.start()

            async def _close_transcriber() -> None:
                await transcriber.aclose()

            ctx.add_shutdown_callback(_close_transcriber)
            logger.info(
                "Concurrent transcription enabled (model=%s)", QWEN_TRANSCRIBE_SESSION_MODEL
            )
        except Exception:
            logger.exception("Failed to start concurrent transcription; main flow unaffected")


if __name__ == "__main__":
    cli.run_app(server)
