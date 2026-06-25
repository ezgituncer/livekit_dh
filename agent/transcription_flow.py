"""Concurrent, text-only transcription via a *second* Qwen realtime session.

This runs ALONGSIDE the main `AgentSession`. It taps the same user microphone
track, streams that audio to an independent realtime session configured as a
pure transcriber (text modality only + a strict "transcribe only" system
prompt), and publishes the resulting text as the user's transcript in the UI.

Why a second session: the omni model understands speech better than the
dedicated input-ASR models (gummy/paraformer), so using it text-only as a
transcriber can yield a more accurate displayed transcript.

Isolation contract: this module must NEVER block or break the main assistant
session. Every entry point is wrapped so that any failure (connect error, model
rejection, audio glitch, publish error) is logged and swallowed. If the second
session dies, the main conversation continues unaffected — only the (improved)
transcript stops updating.

Cost note: this streams the user's audio to DashScope a second time, so it
roughly doubles input-token consumption against the per-key 1M-token cap. It
reuses the same key pool, so it benefits from the automatic key failover.
"""

from __future__ import annotations

import asyncio
import contextlib
import logging

from livekit import rtc
from livekit.agents import llm, utils
from openai.types.realtime import AudioTranscription

from qwen_realtime.realtime_model import RealtimeModel as QwenRealtimeModel

logger = logging.getLogger("agent.transcription")

# Input-ASR sub-model used purely as a LANGUAGE ANCHOR on the transcription session.
# qwen-omni auto-detects the spoken language and ignores prompt instructions, drifting
# to Chinese on short/ambiguous input. Pinning this sub-model's `language` (the same
# lever the main session uses) forces the model to interpret — and transcribe — in the
# selected UI language. The displayed transcript still comes from the omni response.
_LANGUAGE_ANCHOR_MODEL = "paraformer-realtime-v2"


def build_transcription_prompt(language_name: str | None) -> str:
    """Build the transcriber's system prompt, naming the expected language.

    This is the *soft* anchor; the hard anchor is the pinned input-transcription
    language (see `_LANGUAGE_ANCHOR_MODEL`). Naming the language here reinforces it.
    """
    if language_name:
        language_line = (
            f"The user is speaking {language_name}. "
            f"Always return the transcript in {language_name}."
        )
    else:
        language_line = "Transcribe in the same language the user is speaking."
    return (
        "You are a dedicated transcription model.\n"
        "Your only task is to transcribe the user's spoken audio accurately, word for word.\n"
        f"{language_line}\n"
        "Never output Chinese characters unless the speaker is actually speaking "
        "Chinese, and never translate into another language.\n"
        "Return only the transcript text. Do not answer, explain, summarize, or add labels.\n"
        "Use natural punctuation where possible.\n"
        "If a word is unclear, infer from context only when reasonably confident."
    )


# AudioStream is resampled inside RealtimeSession.push_audio anyway; 24 kHz mono
# matches the model's internal rate and minimises resampling work.
_AUDIO_SAMPLE_RATE = 24000
_AUDIO_NUM_CHANNELS = 1


class ConcurrentTranscriber:
    """Owns the second realtime session and the audio tap. Fully self-contained.

    Usage:
        tr = ConcurrentTranscriber(room=..., participant=..., model=..., ...)
        tr.start()            # fire-and-forget; never raises
        ...
        await tr.aclose()     # idempotent cleanup
    """

    def __init__(
        self,
        *,
        room: rtc.Room,
        participant: rtc.RemoteParticipant,
        model: str,
        base_url: str,
        api_keys: list[str],
        turn_detection: dict,
        language: str | None = None,
        language_name: str | None = None,
    ) -> None:
        self._room = room
        self._participant = participant
        self._model = model
        self._base_url = base_url
        self._api_keys = api_keys
        self._turn_detection = turn_detection
        self._language = language or ""
        self._prompt = build_transcription_prompt(language_name)

        self._rt_model: QwenRealtimeModel | None = None
        self._session = None  # qwen RealtimeSession
        self._main_task: asyncio.Task | None = None
        self._gen_tasks: set[asyncio.Task] = set()
        self._track_sid: str | None = None
        self._closed = False

    # ------------------------------------------------------------------ public
    def start(self) -> None:
        """Launch the flow in the background. Safe to call once."""
        if self._main_task is not None:
            return
        self._main_task = asyncio.create_task(
            self._run(), name="concurrent_transcriber"
        )

    async def aclose(self) -> None:
        """Cancel the flow and tear down the second session. Idempotent."""
        self._closed = True
        tasks = [t for t in (self._main_task, *self._gen_tasks) if t is not None]
        for task in tasks:
            if not task.done():
                task.cancel()
        for task in tasks:
            with contextlib.suppress(asyncio.CancelledError, Exception):
                await task
        if self._session is not None:
            with contextlib.suppress(Exception):
                await self._session.aclose()
        if self._rt_model is not None:
            with contextlib.suppress(Exception):
                await self._rt_model.aclose()

    # ----------------------------------------------------------------- internal
    async def _run(self) -> None:
        try:
            self._rt_model = QwenRealtimeModel(
                model=self._model,
                base_url=self._base_url,
                api_keys=self._api_keys,
                # Text-only: we want the model's transcript, not spoken audio.
                modalities=["text"],
                # Same server-side VAD as the main session so utterances segment
                # consistently; server auto-creates a (text) response per turn.
                turn_detection=self._turn_detection,
                # HARD language anchor: pin the input-transcription language to the
                # UI language so the model interprets/transcribes in that language
                # instead of auto-detecting and drifting to Chinese. We still read the
                # transcript from the omni response (generation_created), not this ASR.
                input_audio_transcription=AudioTranscription(
                    model=_LANGUAGE_ANCHOR_MODEL,
                    language=self._language or "en",
                ),
            )
            self._session = self._rt_model.session()
            await self._session.update_instructions(self._prompt)
            self._session.on("generation_created", self._on_generation_created)

            track = await self._resolve_audio_track()
            if track is None:
                logger.warning(
                    "transcription flow: no user audio track found; giving up "
                    "(main flow unaffected)"
                )
                return

            logger.info(
                "transcription flow started: model=%s track_sid=%s",
                self._model,
                self._track_sid,
            )
            await self._pump_audio(track)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception(
                "transcription flow crashed; main assistant session is unaffected"
            )

    async def _resolve_audio_track(
        self, timeout: float = 20.0
    ) -> rtc.Track | None:
        """Find the participant's microphone track (already subscribed, or wait)."""
        def _find() -> rtc.Track | None:
            for pub in self._participant.track_publications.values():
                if pub.kind == rtc.TrackKind.KIND_AUDIO and pub.track is not None:
                    self._track_sid = pub.sid
                    return pub.track
            return None

        existing = _find()
        if existing is not None:
            return existing

        # Otherwise wait for the subscription event (agents auto-subscribe).
        fut: asyncio.Future[rtc.Track] = asyncio.Future()

        def _on_subscribed(track, publication, participant) -> None:
            if (
                participant.identity == self._participant.identity
                and track.kind == rtc.TrackKind.KIND_AUDIO
                and not fut.done()
            ):
                self._track_sid = publication.sid
                fut.set_result(track)

        self._room.on("track_subscribed", _on_subscribed)
        try:
            return await asyncio.wait_for(fut, timeout)
        except asyncio.TimeoutError:
            return None
        finally:
            self._room.off("track_subscribed", _on_subscribed)

    async def _pump_audio(self, track: rtc.Track) -> None:
        """Feed the same mic audio into the second session until closed."""
        stream = rtc.AudioStream.from_track(
            track=track,
            sample_rate=_AUDIO_SAMPLE_RATE,
            num_channels=_AUDIO_NUM_CHANNELS,
        )
        try:
            async for event in stream:
                if self._closed:
                    break
                try:
                    self._session.push_audio(event.frame)
                except Exception:
                    # A single bad frame must not kill the flow.
                    logger.debug("transcription flow: push_audio failed", exc_info=True)
        finally:
            with contextlib.suppress(Exception):
                await stream.aclose()

    def _on_generation_created(self, ev: llm.GenerationCreatedEvent) -> None:
        # The model produced a (text) response for an utterance — read it off-thread.
        task = asyncio.create_task(self._read_generation(ev))
        self._gen_tasks.add(task)
        task.add_done_callback(self._gen_tasks.discard)

    async def _read_generation(self, ev: llm.GenerationCreatedEvent) -> None:
        try:
            async for msg in ev.message_stream:
                chunks: list[str] = []
                async for delta in msg.text_stream:
                    chunks.append(delta)
                transcript = "".join(chunks).strip()
                if transcript:
                    await self._publish_transcript(transcript)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.debug("transcription flow: reading generation failed", exc_info=True)

    async def _publish_transcript(self, text: str) -> None:
        """Publish `text` as the user's transcript segment, same as the framework."""
        if self._track_sid is None or not self._room.isconnected():
            return
        segment = rtc.TranscriptionSegment(
            id=utils.shortuuid("SG_"),
            text=text,
            start_time=0,
            end_time=0,
            final=True,
            language=self._language,
        )
        try:
            await self._room.local_participant.publish_transcription(
                rtc.Transcription(
                    participant_identity=self._participant.identity,
                    track_sid=self._track_sid,
                    segments=[segment],
                )
            )
            logger.debug("transcription flow: published %r", text)
        except Exception:
            logger.debug("transcription flow: publish failed", exc_info=True)
