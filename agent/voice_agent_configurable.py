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

DEFAULT_STT = "elevenlabs-scribe-v2"
DEFAULT_TTS = "elevenlabs-multilingual-v2"
DEFAULT_DETECTOR = "multilingual"


server = AgentServer()
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

    session = AgentSession(
        llm=QwenRealtimeModel(
            model='qwen3.5-omni-flash-realtime',
            base_url="wss://dashscope-intl.aliyuncs.com/api-ws/v1/realtime",
            api_key="sk-ed9a5abfecde43a7a07005bf3400e2ff",
            voice="Ethan",  # erkek ses (alternatif: "Aiden")
            # Sabit dil ipucu ver: aksi halde ASR oto-algı ile gürültüde Çince
            # dolgu sözcüğü ("嗯") üretiyor. Oturumda seçilen dili, yoksa "en".
            input_audio_transcription=AudioTranscription(
                model="gummy-realtime-v1",
                language=language or "en",
            ),
        ),
    )

    if audio_buffer is not None:
        def on_user_state_changed(ev: UserStateChangedEvent) -> None:
            if ev.new_state == "speaking":
                audio_buffer.reset()

        session.on("user_state_changed", on_user_state_changed)

    instructions = VOICE_INSTRUCTIONS
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


if __name__ == "__main__":
    cli.run_app(server)
