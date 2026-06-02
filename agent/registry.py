"""
Component registry for the configurable voice agent.

Each entry is a small factory keyed by a stable string id. The frontend sends
these ids as participant attributes and the entrypoint looks them up here.

Adding a new provider (e.g. Azure STT) is a single entry in the appropriate
registry plus one entry in frontend/app-config.ts.
"""

from __future__ import annotations

import asyncio
import logging
import os
from collections.abc import AsyncIterable
from dataclasses import dataclass, field
from typing import Any, Callable

import numpy as np
import onnxruntime as ort
from livekit import rtc
from livekit.agents import Agent, JobProcess, ModelSettings, llm as agents_llm, stt as agents_stt, tts as agents_tts, utils
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions, TimedString
from livekit.plugins import azure, elevenlabs, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from transformers import WhisperFeatureExtractor

logger = logging.getLogger("agent")


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

SMART_TURN_MODEL_PATH = os.getenv(
    "SMART_TURN_MODEL_PATH",
    os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        "models",
        "smart_turn",
        "smart-turn-v3.2-cpu.onnx",
    ),
)
SMART_TURN_SAMPLE_RATE = 16000


class AudioBuffer:
    """Accumulates rtc.AudioFrame objects for the current user utterance."""

    def __init__(self) -> None:
        self._frames: list[rtc.AudioFrame] = []

    def append(self, frame: rtc.AudioFrame) -> None:
        self._frames.append(frame)

    def reset(self) -> None:
        self._frames = []

    def snapshot(self) -> list[rtc.AudioFrame]:
        return list(self._frames)


# ---------------------------------------------------------------------------
# STT registry
# ---------------------------------------------------------------------------

@dataclass
class STTEntry:
    factory: Callable[[dict[str, Any]], agents_stt.STT]
    supports_language: bool = False


def _elevenlabs_stt(model_id: str, *, realtime: bool) -> Callable[[dict[str, Any]], agents_stt.STT]:
    def _build(cfg: dict[str, Any]) -> agents_stt.STT:
        kwargs: dict[str, Any] = {
            "model_id": model_id,
            "base_url": os.getenv("ELEVEN_BASE_URL"),
            "api_key": os.getenv("ELEVEN_API_KEY"),
        }
        if cfg.get("language"):
            kwargs["language_code"] = cfg["language"]
        if realtime:
            # server_vad_enabled=False explicitly disables ElevenLabs server VAD;
            # the plugin then uses commit_strategy="manual" and LiveKit handles
            # turn detection. When enabled (or unset), forward the dict if the
            # caller supplied any tuning values.
            if cfg.get("server_vad_enabled") is False:
                kwargs["server_vad"] = None
            else:
                server_vad = cfg.get("server_vad")
                if server_vad:
                    kwargs["server_vad"] = server_vad
        return elevenlabs.STT(**kwargs)

    return _build


_AZURE_LANGUAGE_MAP: dict[str, str] = {
    "en": "en-US",
    "ar": "ar-AE",
    "tr": "tr-TR",
    "zh": "zh-CN",
}


def _azure_stt(cfg: dict[str, Any]) -> agents_stt.STT:
    lang = cfg.get("language") or "en"
    return azure.STT(
        speech_key=os.getenv("AZURE_SPEECH_KEY"),
        speech_region=os.getenv("AZURE_SPEECH_REGION"),
        language=_AZURE_LANGUAGE_MAP.get(lang, "en-US"),
    )


STT_REGISTRY: dict[str, STTEntry] = {
    "elevenlabs-scribe-v2": STTEntry(
        factory=_elevenlabs_stt("scribe_v2", realtime=False),
        supports_language=True,
    ),
    "elevenlabs-scribe-v2-realtime": STTEntry(
        factory=_elevenlabs_stt("scribe_v2_realtime", realtime=True),
        supports_language=True,
    ),
    "azure-stt": STTEntry(
        factory=_azure_stt,
        supports_language=True,
    ),
}


# ---------------------------------------------------------------------------
# TTS registry
# ---------------------------------------------------------------------------

DEFAULT_VOICE_ID = "29vD33N1CtxCmqQRPOHJ"  # Drew (male)

VOICE_INSTRUCTIONS = (
    "Your replies are converted to speech and played aloud, so write every "
    "response as spoken language:\n"
    "- Keep it concise and conversational; avoid long lists or lectures.\n"
    "- Spell out numbers, dates, times, and units as words (say \"twelve\" "
    "not \"12\", \"April twenty-fourth\" not \"4/24\", \"five dollars\" "
    "not \"$5\").\n"
    "- Do not use markdown, bullet points, headings, code blocks, or emoji.\n"
    "- Avoid symbols that don't read naturally (#, *, _, `, /, etc.).\n"
    "- Expand abbreviations that would be awkward letter-by-letter (say "
    "\"for example\" rather than \"e.g.\")."
)

V3_INSTRUCTIONS = """
# Audio Tag Rules
Include tags in the text you generate as per the instructions below. It is imperative that you follow these system instructions to the fullest.
## 1. Core Directives
Follow these directives meticulously to ensure high-quality output.
### Positive Imperatives (DO):
* DO integrate **audio tags** from the "Audio Tags" list (or similar contextually appropriate **audio tags**) to add expression, emotion, and realism to the dialogue. These tags MUST describe something auditory.
* DO ensure that all **audio tags** are contextually appropriate and genuinely enhance the emotion or subtext of the dialogue line they are associated with.
* DO strive for a diverse range of emotional expressions (e.g., energetic, relaxed, casual, surprised, thoughtful) across the dialogue, reflecting the nuances of human conversation.
* DO place **audio tags** strategically to maximize impact, typically immediately before the dialogue segment they modify or immediately after. (e.g., [annoyed] This is hard. or This is hard. [sighs]).
* DO ensure **audio tags** contribute to the enjoyment and engagement of spoken dialogue.
### Negative Imperatives (DO NOT):
* DO NOT use tags such as [standing], [grinning], [pacing], [music].
* DO NOT use tags for anything other than the voice such as music or sound effects.
* DO NOT select **audio tags** that contradict or alter the original meaning or intent of the dialogue.
## Audio Tags
Use these as a guide. You can infer similar, contextually appropriate **audio tags**.
**Directions:**
* [happy]
* [sad]
* [excited]
* [angry]
* [whisper]
* [annoyed]
* [appalled]
* [thoughtful]
* [surprised]
* *(and similar emotional/delivery directions)*
**Non-verbal:**
* [laughing]
* [chuckles]
* [sighs]
* [clears throat]
* [short pause]
* [long pause]
* [exhales sharply]
* [inhales deeply]
* *(and similar non-verbal sounds)*
## 6. Examples of Enhancement
**Normal text**:
"Are you serious? I can't believe you did that!"
**Enhanced text**:
"[appalled] Are you serious? [sighs] I can't believe you did that!"
---
**Normal text**:
"That's amazing, I didn't know you could sing!"
**Enhanced text**:
"[laughing] That's amazing, [singing] I didn't know you could sing!"
---
**Normal text**:
"I guess you're right. It's just... difficult."
**Enhanced text**:
"I guess you're right. [sighs] It's just... [muttering] difficult."
# Instructions Summary
1. Add audio tags from the audio tags list. These must describe something auditory but only for the voice.
2. Enhance emphasis without altering meaning or text.
3. Reply ONLY with the enhanced text.
"""


@dataclass
class TTSEntry:
    factory: Callable[[dict[str, Any]], agents_tts.TTS]
    # v3 cannot stream over the websocket multi-stream endpoint — wrap in BufferedTTS.
    wrap_buffered: bool = False
    # v3 emits [tag] directives that should be stripped from the transcript shown
    # to the user (but left in the text sent to TTS).
    strip_tags: bool = False
    # Optional system prompt override. When None, the agent uses its default.
    instructions: str | None = None


def _elevenlabs_tts(model: str) -> Callable[[dict[str, Any]], agents_tts.TTS]:
    def _build(cfg: dict[str, Any]) -> agents_tts.TTS:
        return elevenlabs.TTS(
            voice_id=cfg.get("voice_id") or DEFAULT_VOICE_ID,
            model=model,
            base_url=os.getenv("ELEVEN_BASE_URL"),
            api_key=os.getenv("ELEVEN_API_KEY"),
            language=cfg.get("language") or "en",
        )

    return _build


TTS_REGISTRY: dict[str, TTSEntry] = {
    "elevenlabs-multilingual-v2": TTSEntry(factory=_elevenlabs_tts("eleven_multilingual_v2")),
    "elevenlabs-flash-v2-5": TTSEntry(factory=_elevenlabs_tts("eleven_flash_v2_5")),
    "elevenlabs-v3": TTSEntry(
        factory=_elevenlabs_tts("eleven_v3"),
        wrap_buffered=True,
        strip_tags=True,
        instructions=V3_INSTRUCTIONS,
    ),
    "elevenlabs-v3-plain": TTSEntry(
        factory=_elevenlabs_tts("eleven_v3"),
        wrap_buffered=True,
    ),
}


# ---------------------------------------------------------------------------
# Turn detector registry
# ---------------------------------------------------------------------------

@dataclass
class DetectorEntry:
    # Factory receives the prewarmed proc.userdata and an AudioBuffer (only
    # populated when needs_audio_buffer is True).
    factory: Callable[[dict[str, Any], AudioBuffer | None], Any]
    needs_audio_buffer: bool = False
    pipeline_sample_rate: int | None = None
    endpointing: dict[str, float] | None = None


def _build_vad(userdata: dict[str, Any], _buffer: AudioBuffer | None) -> Any:
    return "vad"


def _build_multilingual(userdata: dict[str, Any], _buffer: AudioBuffer | None) -> Any:
    return MultilingualModel()


def _build_smart_turn(userdata: dict[str, Any], buffer: AudioBuffer | None) -> Any:
    assert buffer is not None, "smart-turn requires an AudioBuffer"
    return SmartTurnDetector(
        buffer,
        ort_session=userdata["ort_session"],
        feature_extractor=userdata["feature_extractor"],
    )


DETECTOR_REGISTRY: dict[str, DetectorEntry] = {
    "vad": DetectorEntry(
        factory=_build_vad,
        endpointing={"min_delay": 0.5, "max_delay": 3.0},
    ),
    "multilingual": DetectorEntry(factory=_build_multilingual),
    "smart-turn": DetectorEntry(
        factory=_build_smart_turn,
        needs_audio_buffer=True,
        pipeline_sample_rate=SMART_TURN_SAMPLE_RATE,
        endpointing={"min_delay": 0.5, "max_delay": 3.0},
    ),
}


# ---------------------------------------------------------------------------
# Smart-turn detector
# ---------------------------------------------------------------------------

def _build_ort_session(model_path: str) -> ort.InferenceSession:
    so = ort.SessionOptions()
    so.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
    so.inter_op_num_threads = 1
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(model_path, sess_options=so)


def _frames_to_numpy(frames: list[rtc.AudioFrame]) -> np.ndarray:
    arrays = [np.frombuffer(f.data, dtype=np.int16).astype(np.float32) for f in frames]
    audio = np.concatenate(arrays)
    max_val = np.max(np.abs(audio))
    if max_val > 0:
        audio /= max_val
    return audio


def _pad_or_truncate(audio: np.ndarray, n_seconds: int = 8, sample_rate: int = SMART_TURN_SAMPLE_RATE) -> np.ndarray:
    max_samples = n_seconds * sample_rate
    if len(audio) > max_samples:
        return audio[-max_samples:]
    if len(audio) < max_samples:
        return np.pad(audio, (max_samples - len(audio), 0), mode="constant")
    return audio


class SmartTurnDetector:
    def __init__(
        self,
        buffer: AudioBuffer,
        *,
        ort_session: ort.InferenceSession,
        feature_extractor: WhisperFeatureExtractor,
    ) -> None:
        self._buffer = buffer
        self._session = ort_session
        self._feature_extractor = feature_extractor

    @property
    def model(self) -> str:
        return "smart-turn-v3.2-cpu.onnx"

    @property
    def provider(self) -> str:
        return "pipecat-ai"

    async def unlikely_threshold(self, language) -> float | None:
        return 0.5

    async def supports_language(self, language) -> bool:
        return True

    async def predict_end_of_turn(self, chat_ctx, *, timeout: float | None = None) -> float:
        frames = self._buffer.snapshot()
        if not frames:
            return 0.5

        t0 = asyncio.get_event_loop().time()
        probability = await asyncio.to_thread(self._infer, frames)
        elapsed_ms = (asyncio.get_event_loop().time() - t0) * 1000
        logger.info(
            "SmartTurn inference: probability=%.3f duration=%.1fms frames=%d",
            probability,
            elapsed_ms,
            len(frames),
        )
        return probability

    def _infer(self, frames: list[rtc.AudioFrame]) -> float:
        audio = _frames_to_numpy(frames)
        audio = _pad_or_truncate(audio)
        inputs = self._feature_extractor(
            audio,
            sampling_rate=SMART_TURN_SAMPLE_RATE,
            return_tensors="np",
            padding="max_length",
            max_length=8 * SMART_TURN_SAMPLE_RATE,
            truncation=True,
            do_normalize=True,
        )
        input_features = inputs.input_features.squeeze(0).astype(np.float32)
        input_features = np.expand_dims(input_features, axis=0)
        outputs = self._session.run(None, {"input_features": input_features})
        return float(outputs[0][0][0])


# ---------------------------------------------------------------------------
# BufferedTTS — wrapper used by eleven_v3
# ---------------------------------------------------------------------------

class BufferedTTS(agents_tts.TTS):
    def __init__(self, *, tts: agents_tts.TTS) -> None:
        super().__init__(
            capabilities=agents_tts.TTSCapabilities(streaming=True, aligned_transcript=False),
            sample_rate=tts.sample_rate,
            num_channels=tts.num_channels,
        )
        self._wrapped = tts

    @property
    def model(self) -> str:
        return self._wrapped.model

    @property
    def provider(self) -> str:
        return self._wrapped.provider

    def synthesize(
        self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> agents_tts.ChunkedStream:
        return self._wrapped.synthesize(text=text, conn_options=conn_options)

    def stream(
        self, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS
    ) -> "_BufferedStream":
        return _BufferedStream(tts=self, wrapped=self._wrapped, conn_options=conn_options)

    def prewarm(self) -> None:
        self._wrapped.prewarm()


class _BufferedStream(agents_tts.SynthesizeStream):
    def __init__(
        self,
        *,
        tts: BufferedTTS,
        wrapped: agents_tts.TTS,
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(tts=tts, conn_options=conn_options)
        self._wrapped = wrapped

    async def _run(self, output_emitter: agents_tts.AudioEmitter) -> None:
        output_emitter.initialize(
            request_id=utils.shortuuid(),
            sample_rate=self._tts.sample_rate,
            num_channels=self._tts.num_channels,
            mime_type="audio/pcm",
            stream=True,
        )
        output_emitter.start_segment(segment_id=utils.shortuuid())

        buffer: list[str] = []

        async def _flush_buffer() -> None:
            text = "".join(buffer).strip()
            buffer.clear()
            if not text:
                return
            self._mark_started()
            async with self._wrapped.synthesize(
                text, conn_options=self._conn_options
            ) as tts_stream:
                async for audio in tts_stream:
                    output_emitter.push(audio.frame.data.tobytes())
            output_emitter.flush()

        async for data in self._input_ch:
            if isinstance(data, self._FlushSentinel):
                await _flush_buffer()
                continue
            buffer.append(data)

        await _flush_buffer()


# ---------------------------------------------------------------------------
# Configurable agent with optional hooks
# ---------------------------------------------------------------------------

class ConfigurableAgent(Agent):
    """
    Single Agent whose per-node behavior is toggled by constructor flags,
    avoiding a combinatorial jungle of subclasses.

    - audio_buffer: when set, stt_node taps incoming frames into it (used by
      smart-turn to feed its ONNX model).
    - strip_tags: when True, transcription_node strips [tag] directives so they
      don't appear in the user-visible transcript. The TTS branch of the
      pipeline is untouched.
    """

    def __init__(
        self,
        *,
        audio_buffer: AudioBuffer | None = None,
        strip_tags: bool = False,
        **kwargs,
    ) -> None:
        super().__init__(**kwargs)
        self._audio_buffer = audio_buffer
        self._strip_tags = strip_tags

    async def stt_node(
        self,
        audio: AsyncIterable[rtc.AudioFrame],
        model_settings: ModelSettings,
    ):
        if self._audio_buffer is None:
            async for event in super().stt_node(audio, model_settings):
                yield event
            return

        buffer = self._audio_buffer

        async def tapped():
            async for frame in audio:
                buffer.append(frame)
                yield frame

        async for event in super().stt_node(tapped(), model_settings):
            yield event

    async def llm_node(
        self,
        chat_ctx: agents_llm.ChatContext,
        tools: list[agents_llm.Tool],
        model_settings: ModelSettings,
    ):
        pieces: list[str] = []
        async for chunk in Agent.default.llm_node(self, chat_ctx, tools, model_settings):
            token: str | None = None
            if isinstance(chunk, str):
                token = chunk
            elif isinstance(chunk, agents_llm.ChatChunk) and chunk.delta and chunk.delta.content:
                token = chunk.delta.content
            if token:
                pieces.append(token)
                logger.info("LLM token: %r", token)
            yield chunk
        if pieces:
            logger.info("LLM response: %s", "".join(pieces))

    async def transcription_node(
        self,
        text: AsyncIterable[str | TimedString],
        model_settings: ModelSettings,
    ):
        if not self._strip_tags:
            async for chunk in super().transcription_node(text, model_settings):
                yield chunk
            return

        buffer = ""
        async for chunk in text:
            if not isinstance(chunk, str):
                if buffer:
                    yield buffer
                    buffer = ""
                yield chunk
                continue

            buffer += chunk
            out = []
            i = 0
            while i < len(buffer):
                if buffer[i] == "[":
                    close = buffer.find("]", i + 1)
                    if close == -1:
                        break
                    i = close + 1
                    if i < len(buffer) and buffer[i] == " ":
                        i += 1
                    continue
                out.append(buffer[i])
                i += 1
            buffer = buffer[i:]
            if out:
                yield "".join(out)

        if buffer:
            yield buffer


# ---------------------------------------------------------------------------
# Prewarm
# ---------------------------------------------------------------------------

def prewarm(proc: JobProcess) -> None:
    """Load everything any registered component might need once per worker."""
    proc.userdata["vad"] = silero.VAD.load()
    try:
        proc.userdata["ort_session"] = _build_ort_session(SMART_TURN_MODEL_PATH)
        proc.userdata["feature_extractor"] = WhisperFeatureExtractor(chunk_length=8)
    except Exception as e:
        logger.warning("Smart-turn prewarm skipped: %s", e)
