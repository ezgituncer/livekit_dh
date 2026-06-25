"""Per-utterance transcriber for the *displayed* user transcript.

Uses a Qwen omni LLM (default ``qwen3-omni-flash``) over DashScope's
OpenAI-compatible endpoint to transcribe each user utterance. Unlike the realtime
model's built-in sub-ASR, an omni LLM is broadly multilingual (Turkish included)
and accepts a system prompt — so brand/product names can be biased via
``prompts.BRAND_TERMS`` (the LLM equivalent of hot words, working in any language).

Only the transcript shown in the UI goes through here; the live conversation is
still handled by qwen-omni-realtime. A per-utterance call adds ~0.5-2s, which is
fine for a display-only transcript.
"""

from __future__ import annotations

import base64
import io
import logging
import wave
from collections.abc import AsyncIterator

from openai import AsyncOpenAI

from prompts import build_transcriber_prompt

logger = logging.getLogger("agent")


class OmniTranscriber:
    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        language: str | None,
        timeout: float = 15.0,
    ) -> None:
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url, timeout=timeout)
        self._model = model
        self._system_prompt = build_transcriber_prompt(language)

    @staticmethod
    def _to_wav_b64(pcm: bytes, sample_rate: int) -> str:
        """Wrap raw 16-bit mono PCM in a WAV container and base64-encode it."""
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)  # 16-bit
            w.setframerate(sample_rate)
            w.writeframes(pcm)
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    async def transcribe_stream(self, pcm: bytes, *, sample_rate: int) -> AsyncIterator[str]:
        """Yield transcript text deltas as the model produces them.

        Streaming surfaces the transcript progressively (lower perceived latency).
        The final concatenation is identical to a non-streamed call — same audio,
        same model output — so it does not change accuracy.
        """
        if not pcm:
            return

        audio_b64 = self._to_wav_b64(pcm, sample_rate)
        # Streaming output is required for audio input on the omni models.
        resp = await self._client.chat.completions.create(
            model=self._model,
            modalities=["text"],
            stream=True,
            messages=[
                {"role": "system", "content": self._system_prompt},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": f"data:audio/wav;base64,{audio_b64}",
                                "format": "wav",
                            },
                        },
                        {"type": "text", "text": "Transcribe this audio verbatim."},
                    ],
                },
            ],
        )

        async for chunk in resp:
            if not chunk.choices:
                continue
            delta = chunk.choices[0].delta
            if delta and delta.content:
                yield delta.content
