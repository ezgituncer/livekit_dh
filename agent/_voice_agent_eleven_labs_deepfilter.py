import asyncio
import logging
import os
from collections.abc import AsyncIterable

import numpy as np
import torch
from df import enhance, init_df
from dotenv import load_dotenv
from livekit import rtc
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    JobProcess,
    cli,
    TurnHandlingOptions,
)
from livekit.plugins import silero, openai, elevenlabs
from livekit.plugins.turn_detector.multilingual import MultilingualModel

logger = logging.getLogger("agent")

load_dotenv(".env")

# DeepFilterNet operates at 48 kHz full-band. LiveKit's default WebRTC sample
# rate is also 48 kHz, so no resampling is needed on the happy path.
DEEPFILTER_SR = 48000

# Denoise in fixed-size chunks. 480 ms is a compromise: large enough to amortise
# enhance()'s STFT padding cost and avoid per-frame hidden-state resets being
# audible, small enough to keep added latency acceptable for conversational STT.
CHUNK_MS = 480
CHUNK_SAMPLES = DEEPFILTER_SR * CHUNK_MS // 1000


server = AgentServer()


def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()
    model, df_state, _ = init_df()
    model.eval()
    proc.userdata["df_model"] = model
    proc.userdata["df_state"] = df_state


server.setup_fnc = prewarm


class DeepFilterAgent(Agent):
    """Agent that denoises mic audio with DeepFilterNet3 before STT."""

    def __init__(self, df_model, df_state, **kwargs) -> None:
        super().__init__(**kwargs)
        self._df_model = df_model
        self._df_state = df_state
        self._buffer = np.empty(0, dtype=np.int16)
        self._sample_rate: int | None = None
        self._num_channels: int | None = None
        self._warned_sr_mismatch = False

    async def stt_node(
        self,
        audio: AsyncIterable[rtc.AudioFrame],
        model_settings,
    ):
        async def denoised():
            async for frame in audio:
                if self._sample_rate is None:
                    self._sample_rate = frame.sample_rate
                    self._num_channels = frame.num_channels

                if frame.sample_rate != DEEPFILTER_SR:
                    if not self._warned_sr_mismatch:
                        logger.warning(
                            "Frame sample_rate=%d != DeepFilterNet 48kHz; passing audio through unfiltered.",
                            frame.sample_rate,
                        )
                        self._warned_sr_mismatch = True
                    yield frame
                    continue

                samples = np.frombuffer(frame.data, dtype=np.int16)
                self._buffer = np.concatenate([self._buffer, samples])

                while len(self._buffer) >= CHUNK_SAMPLES:
                    chunk = self._buffer[:CHUNK_SAMPLES]
                    self._buffer = self._buffer[CHUNK_SAMPLES:]
                    out_pcm = await asyncio.to_thread(self._denoise, chunk)
                    yield self._to_frame(out_pcm)

            if len(self._buffer) > 0 and self._sample_rate == DEEPFILTER_SR:
                tail = self._buffer
                self._buffer = np.empty(0, dtype=np.int16)
                out_pcm = await asyncio.to_thread(self._denoise, tail)
                yield self._to_frame(out_pcm)

        async for event in super().stt_node(denoised(), model_settings):
            yield event

    def _to_frame(self, pcm_int16: np.ndarray) -> rtc.AudioFrame:
        return rtc.AudioFrame(
            data=pcm_int16.tobytes(),
            sample_rate=self._sample_rate,
            num_channels=self._num_channels,
            samples_per_channel=len(pcm_int16) // self._num_channels,
        )

    def _denoise(self, pcm_int16: np.ndarray) -> np.ndarray:
        pcm = pcm_int16.astype(np.float32) / 32768.0
        audio = torch.from_numpy(pcm).unsqueeze(0)
        with torch.no_grad():
            enhanced = enhance(self._df_model, self._df_state, audio)
        out = enhanced.squeeze(0).cpu().numpy()
        out = np.clip(out * 32768.0, -32768.0, 32767.0).astype(np.int16)
        return out


@server.rtc_session(agent_name="elevenlabs-deepfilter")
async def entrypoint(ctx: JobContext):
    ctx.log_context_fields = {"room": ctx.room.name}

    await ctx.connect()
    participant = await ctx.wait_for_participant()
    participant_attributes = participant.attributes

    logger.info(f"Participant attributes: {participant_attributes}")

    session = AgentSession(
        stt=elevenlabs.STT(
            model_id="scribe_v2",
            base_url=os.getenv("ELEVEN_BASE_URL"),
            api_key=os.getenv("ELEVEN_API_KEY"),
        ),
        llm=openai.LLM(
            model=os.getenv("MODEL_NAME"),
            base_url=os.getenv("BASE_URL"),
            api_key=os.getenv("API_KEY"),
        ),
        tts=elevenlabs.TTS(
            voice_id="hpp4J3VqNfWAUOO0d1Us",
            model="eleven_multilingual_v2",
            base_url=os.getenv("ELEVEN_BASE_URL"),
            api_key=os.getenv("ELEVEN_API_KEY"),
            language="en"
            ),
        vad=ctx.proc.userdata["vad"],
        preemptive_generation=False,
        turn_handling=TurnHandlingOptions(
            turn_detection=MultilingualModel(),
            # https://docs.livekit.io/reference/agents/turn-handling-options/#interruptionoptions
            interruption={"mode": "vad"},
        ),
        tts_text_transforms=["filter_emoji", "filter_markdown"]
    )

    agent = DeepFilterAgent(
        df_model=ctx.proc.userdata["df_model"],
        df_state=ctx.proc.userdata["df_state"],
        instructions="",
    )

    await session.start(agent=agent, room=ctx.room)


if __name__ == "__main__":
    cli.run_app(server)
