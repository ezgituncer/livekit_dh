"""
Env-driven variant of voice_agent_configurable.py.

All per-session knobs (STT / TTS / turn detector / language / voice id) are read
from environment variables at startup instead of per-participant attributes.
This lets the agent run standalone, independently of the frontend in this repo.

Environment variables consumed (in addition to the provider-specific ones in
.env that the registries already read):

  AGENT_STT         id from STT_REGISTRY      (default: elevenlabs-scribe-v2)
                    one of:
                      - elevenlabs-scribe-v2
                      - elevenlabs-scribe-v2-realtime
                      - azure-stt
  AGENT_TTS         id from TTS_REGISTRY      (default: elevenlabs-multilingual-v2)
                    one of:
                      - elevenlabs-multilingual-v2
                      - elevenlabs-flash-v2-5
                      - elevenlabs-v3
  AGENT_DETECTOR    id from DETECTOR_REGISTRY (default: multilingual)
                    one of:
                      - vad
                      - multilingual
                      - smart-turn
  AGENT_LANGUAGE    optional
                    one of:
                      - en
                      - ar
                      - tr
                      - zh
  AGENT_VOICE_ID    TTS voice id              (optional, free-form string)
  AGENT_NAME        LiveKit agent_name        (default: voice-agent, free-form string)
"""

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

from registry import (
    AudioBuffer,
    BufferedTTS,
    ConfigurableAgent,
    DETECTOR_REGISTRY,
    STT_REGISTRY,
    TTS_REGISTRY,
    prewarm,
)

logger = logging.getLogger("agent")

load_dotenv(".env")


SUPPORTED_LANGUAGES = {"en", "ar", "tr", "zh"}

DEFAULT_STT = "elevenlabs-scribe-v2"
DEFAULT_TTS = "elevenlabs-multilingual-v2"
DEFAULT_DETECTOR = "multilingual"
DEFAULT_AGENT_NAME = "voice-agent"


def _resolve(env_value: str | None, registry: dict, default: str, kind: str) -> str:
    if env_value and env_value in registry:
        return env_value
    if env_value:
        logger.warning("Unknown %s '%s', falling back to '%s'", kind, env_value, default)
    return default


def _resolve_language(env_value: str | None) -> str | None:
    if not env_value:
        return None
    if env_value not in SUPPORTED_LANGUAGES:
        logger.warning("Unsupported language '%s', ignoring", env_value)
        return None
    return env_value


server = AgentServer()
server.setup_fnc = prewarm


@server.rtc_session(agent_name=os.getenv("AGENT_NAME", DEFAULT_AGENT_NAME))
async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    await ctx.connect()

    stt_id = _resolve(os.getenv("AGENT_STT"), STT_REGISTRY, DEFAULT_STT, "stt")
    tts_id = _resolve(os.getenv("AGENT_TTS"), TTS_REGISTRY, DEFAULT_TTS, "tts")
    detector_id = _resolve(
        os.getenv("AGENT_DETECTOR"), DETECTOR_REGISTRY, DEFAULT_DETECTOR, "detector"
    )
    language = _resolve_language(os.getenv("AGENT_LANGUAGE"))
    voice_id = os.getenv("AGENT_VOICE_ID") or None

    stt_entry = STT_REGISTRY[stt_id]
    tts_entry = TTS_REGISTRY[tts_id]
    detector_entry = DETECTOR_REGISTRY[detector_id]

    cfg = {"language": language if stt_entry.supports_language else None, "voice_id": voice_id}
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

    turn_handling_kwargs: dict = {
        "turn_detection": detector,
        "interruption": {"mode": "vad"},
    }
    if detector_entry.endpointing:
        turn_handling_kwargs["endpointing"] = detector_entry.endpointing

    session = AgentSession(
        stt=stt,
        llm=openai.LLM(
            model=os.getenv("MODEL_NAME"),
            base_url=os.getenv("BASE_URL"),
            api_key=os.getenv("API_KEY"),
        ),
        tts=tts,
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=False,
        turn_handling=TurnHandlingOptions(**turn_handling_kwargs),
        tts_text_transforms=["filter_emoji", "filter_markdown"],
    )

    if audio_buffer is not None:
        def on_user_state_changed(ev: UserStateChangedEvent) -> None:
            if ev.new_state == "speaking":
                audio_buffer.reset()

        session.on("user_state_changed", on_user_state_changed)

    agent = ConfigurableAgent(
        instructions=tts_entry.instructions or "",
        audio_buffer=audio_buffer,
        strip_tags=tts_entry.strip_tags,
    )

    start_kwargs: dict = {"agent": agent, "room": ctx.room}
    if detector_entry.pipeline_sample_rate:
        start_kwargs["room_options"] = RoomOptions(
            audio_input=AudioInputOptions(sample_rate=detector_entry.pipeline_sample_rate),
        )

    await session.start(**start_kwargs)


if __name__ == "__main__":
    cli.run_app(server)
