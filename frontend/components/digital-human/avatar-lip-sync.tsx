'use client';

import { useEffect, useRef } from 'react';
import { useVoiceAssistant } from '@livekit/components-react';
import {
  disableLipSync,
  enableLipSync,
  feedPhoneme,
  getAvatarSingleton,
  resetPhonemeTimeline,
  resetPhonemes,
  setLipMode,
  setMouthOpenness,
  setMouthShape,
  setMouthSibilance,
  setPhonemeClock,
  setPhonemeGate,
  startGesturing,
  stopGesturing,
} from '@/lib/digital-human/use-avatar';

// --- Openness (jaw) from time-domain RMS energy ---
const NOISE_FLOOR = 0.015;
const ATTACK = 0.6; // open quickly
const RELEASE = 0.18; // close a bit slower
// Adaptive openness: normalize energy against a slowly-decaying peak so the mouth
// opens FULLY on vowels regardless of how loud the agent audio actually is (a fixed
// gain made it look like it was always talking with a closed mouth).
const OPEN_GAMMA = 0.55; // <1 → open more aggressively on mid energy
const PEAK_DECAY = 0.995; // how slowly the running peak falls
const PEAK_MIN = 0.04; // floor so quiet noise/breath doesn't blow openness up

// --- Vowel shape from spectral centroid (Hz) over the speech band ---
// Lower centroid → rounded (oo), higher → wide (ee). Tuned for typical speech.
const BAND_LOW_HZ = 300;
const BAND_HIGH_HZ = 3600;
const CENTROID_ROUND_HZ = 750; // maps to shape 0 (rounded)
const CENTROID_WIDE_HZ = 2200; // maps to shape 1 (wide)
const SHAPE_SMOOTH = 0.25;

// --- Sibilant/fricative (s, ş, f, ç) from high-band energy ---
const SIB_LOW_HZ = 3800;
const SIB_HIGH_HZ = 8000;
const SIB_MIN_FRAC = 0.22;
const SIB_MAX_FRAC = 0.5;
const SIB_SMOOTH = 0.3;

// --- Phoneme (text→viseme) lip-sync ---
// When the agent transcript is English, drive the mouth SHAPE from the real
// FaceUnity text→viseme timeline (fed from the transcript) instead of the audio
// spectrum. Amplitude is still gated by the live audio, so the mouth only moves
// while sound is actually playing. Falls back to the acoustic path for any other
// language or when no transcript is available.
// NOTE: the transcript→viseme path proved hard to time-sync against the live audio
// (stuck/open mouth that didn't track speech), so it's disabled and we use the
// robust acoustic path below, which follows the actual audio and never freezes.
// Flip to true to experiment with the phoneme path again.
const PHONEME_ENABLED = false;
const WORDS_PER_SEC = 2.7; // ~160 wpm — used to estimate spoken duration of text
const MIN_SEG_SEC = 0.18;
const MAX_SEG_SEC = 40; // allow long paragraphs (a whole streamed answer)
// Audio gate (fast attack so the first phoneme isn't clipped; smooth release).
const GATE_FLOOR = NOISE_FLOOR * 1.3;
const GATE_ATTACK = 0.5;
const GATE_RELEASE = 0.18;

function estimateDurationSec(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  return Math.min(MAX_SEG_SEC, Math.max(MIN_SEG_SEC, words / WORDS_PER_SEC));
}

/**
 * Drives the digital-human mouth from the agent's speech.
 *
 * Two modes, chosen automatically:
 * - **phoneme** (English transcript present): the agent transcript is fed to the
 *   FaceUnity text→viseme engine and sampled by a clock anchored to audio onset,
 *   giving real phoneme-accurate mouth shapes. Amplitude is gated by live audio so
 *   it never drifts into talking during silence.
 * - **acoustic** (default / fallback): mouth openness from RMS energy and vowel
 *   shape from the spectral centroid (+ sibilant detection). Language-agnostic.
 *
 * Renders nothing. Must be mounted inside a LiveKit session context.
 */
export function AvatarLipSync() {
  const { audioTrack, state, agentTranscriptions } = useVoiceAssistant();
  const mediaStreamTrack = audioTrack?.publication?.track?.mediaStreamTrack;

  // Phoneme-mode bookkeeping (refs so the rAF loop / feed effect see live values).
  const clockRef = useRef(0); // elapsed audio time since utterance onset (s)
  const anchorRef = useRef<number | null>(null); // audioCtx time at speech onset
  const segIdRef = useRef<string | null>(null); // transcript segment currently driving visemes
  const segOriginRef = useRef(0); // clock value where the current segment's timeline starts
  const segDurRef = useRef(0); // estimated spoken duration of the current segment

  // Drive arm/hand gestures from the agent's speaking STATE (stable for the whole
  // utterance), not from audio energy — energy dips during natural pauses would
  // otherwise stop/restart the gestures and break continuity.
  useEffect(() => {
    if (state === 'speaking') startGesturing();
    else stopGesturing();
  }, [state]);

  // Utterance boundary: when the agent isn't speaking, clear the phoneme timeline
  // and re-anchor for the next turn. Keeps the acoustic path as the resting mode.
  useEffect(() => {
    if (state === 'speaking') return;
    resetPhonemes();
    setLipMode('acoustic');
    anchorRef.current = null;
    clockRef.current = 0;
    segIdRef.current = null;
    segOriginRef.current = 0;
    segDurRef.current = 0;
  }, [state]);

  // Feed the agent transcript into the viseme timeline (English only).
  //
  // The FaceUnity SDK collapses multiple queued segments to the FIRST one's end
  // time on flush, which froze the mouth after the first chunk on long answers.
  // So instead of streaming many small tails, we treat the current transcript
  // segment as ONE growing segment: on every update we clear the timeline and
  // re-feed the full segment text as a single `[0, D]` window, sampled relative to
  // the clock value where that segment began. One segment in flight → no collapse.
  useEffect(() => {
    if (!PHONEME_ENABLED || !agentTranscriptions?.length) return;
    const seg = agentTranscriptions[agentTranscriptions.length - 1]; // current utterance
    const lang = (seg.language || 'en').toLowerCase();
    if (!lang.startsWith('en')) return; // FaceUnity phoneme model is EN/CN only
    const text = (seg.text ?? '').trim();
    if (!text) return;
    // A new segment id starts a fresh timeline anchored at the current clock.
    if (seg.id !== segIdRef.current) {
      segIdRef.current = seg.id;
      segOriginRef.current = clockRef.current;
    }
    segDurRef.current = estimateDurationSec(text);
    resetPhonemeTimeline();
    if (feedPhoneme(0, segDurRef.current, text)) setLipMode('phoneme');
  }, [agentTranscriptions]);

  useEffect(() => {
    if (!mediaStreamTrack) return;

    getAvatarSingleton();

    const AudioCtx: typeof AudioContext =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    void ctx.resume();

    const source = ctx.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.2;
    source.connect(analyser); // analysis only — not connected to ctx.destination

    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const binHz = ctx.sampleRate / analyser.fftSize;
    const lowBin = Math.max(1, Math.floor(BAND_LOW_HZ / binHz));
    const highBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(BAND_HIGH_HZ / binHz));
    const sibLowBin = Math.min(analyser.frequencyBinCount - 1, Math.floor(SIB_LOW_HZ / binHz));
    const sibHighBin = Math.min(analyser.frequencyBinCount - 1, Math.ceil(SIB_HIGH_HZ / binHz));

    let openness = 0;
    let shape = 0.5;
    let sibilance = 0;
    let gate = 0;
    let peak = PEAK_MIN; // running peak of RMS for adaptive openness
    let enabled = false;
    let raf = 0;
    let stopped = false;

    const loop = () => {
      if (stopped) return;
      if (!enabled) enabled = enableLipSync();

      // RMS energy → openness (acoustic) and the audio gate (phoneme).
      analyser.getByteTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      // Adaptive openness — normalize against a decaying peak, then gamma-boost.
      peak = rms > peak ? rms : peak * PEAK_DECAY + rms * (1 - PEAK_DECAY);
      const denom = Math.max(PEAK_MIN, peak) - NOISE_FLOOR;
      const norm = denom > 0 ? Math.min(1, Math.max(0, (rms - NOISE_FLOOR) / denom)) : 0;
      const targetOpen = Math.pow(norm, OPEN_GAMMA);
      openness += (targetOpen - openness) * (targetOpen > openness ? ATTACK : RELEASE);
      setMouthOpenness(openness);

      // Audio gate for phoneme mode + clock anchored to the first audible frame.
      const speaking = rms > GATE_FLOOR;
      gate += ((speaking ? 1 : 0) - gate) * (speaking ? GATE_ATTACK : GATE_RELEASE);
      setPhonemeGate(gate);
      if (speaking && anchorRef.current === null) anchorRef.current = ctx.currentTime;
      const clk = anchorRef.current === null ? 0 : ctx.currentTime - anchorRef.current;
      clockRef.current = clk;
      // Sample the viseme timeline relative to where the current segment began.
      const rel = clk - segOriginRef.current;
      setPhonemeClock(rel);
      // If audio is still playing but we've run past the fed segment's estimated
      // length, fall back to the acoustic mouth so it doesn't freeze closed in the
      // gap. The feed effect flips back to 'phoneme' the moment new text arrives.
      if (speaking && rel > segDurRef.current + 0.25) setLipMode('acoustic');

      // Vowel shape from spectral centroid of the speech band.
      analyser.getByteFrequencyData(freqData);
      let weighted = 0;
      let total = 0;
      for (let b = lowBin; b <= highBin; b++) {
        const mag = freqData[b];
        weighted += mag * (b * binHz);
        total += mag;
      }
      if (total > 0) {
        const centroid = weighted / total;
        const targetShape = Math.min(
          1,
          Math.max(0, (centroid - CENTROID_ROUND_HZ) / (CENTROID_WIDE_HZ - CENTROID_ROUND_HZ))
        );
        shape += (targetShape - shape) * SHAPE_SMOOTH;
        setMouthShape(shape);
      }

      // Sibilance (acoustic fallback): high-band energy share → teeth viseme.
      let sibEnergy = 0;
      for (let b = sibLowBin; b <= sibHighBin; b++) sibEnergy += freqData[b];
      const sibFrac = sibEnergy / (total + sibEnergy + 1e-6);
      const targetSib =
        openness < 0.08
          ? 0
          : Math.min(1, Math.max(0, (sibFrac - SIB_MIN_FRAC) / (SIB_MAX_FRAC - SIB_MIN_FRAC)));
      sibilance += (targetSib - sibilance) * SIB_SMOOTH;
      setMouthSibilance(sibilance);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stopGesturing();
      disableLipSync();
      try {
        source.disconnect();
        void ctx.close();
      } catch {
        /* ignore */
      }
    };
  }, [mediaStreamTrack]);

  return null;
}
