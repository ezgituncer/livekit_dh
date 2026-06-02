'use client';

import { useEffect } from 'react';
import { useVoiceAssistant } from '@livekit/components-react';
import {
  disableLipSync,
  enableLipSync,
  getAvatarSingleton,
  setMouthOpenness,
  setMouthShape,
  startGesturing,
  stopGesturing,
} from '@/lib/digital-human/use-avatar';

// --- Openness (jaw) from time-domain RMS energy ---
const NOISE_FLOOR = 0.015;
const GAIN = 7;
const ATTACK = 0.6; // open quickly
const RELEASE = 0.18; // close a bit slower

// --- Vowel shape from spectral centroid (Hz) over the speech band ---
// Lower centroid → rounded (oo), higher → wide (ee). Tuned for typical speech.
const BAND_LOW_HZ = 300;
const BAND_HIGH_HZ = 3600;
const CENTROID_ROUND_HZ = 750; // maps to shape 0 (rounded)
const CENTROID_WIDE_HZ = 2200; // maps to shape 1 (wide)
const SHAPE_SMOOTH = 0.25;

/**
 * Drives the digital-human mouth from the agent's LiveKit audio track using Web
 * Audio analysis (spectral / amplitude). Renders nothing. Must be mounted inside
 * a LiveKit session context (it uses useVoiceAssistant).
 *
 * - Openness (jaw) comes from time-domain RMS energy.
 * - Vowel shape (rounded ↔ open ↔ wide) comes from the spectral centroid.
 * Because it reads the audio that is actually playing, the visemes never drift
 * out of sync. The analyser only taps the stream — it is not connected to the
 * audio destination, so LiveKit's own playback is unaffected (no echo).
 */
export function AvatarLipSync() {
  const { audioTrack, state } = useVoiceAssistant();
  const mediaStreamTrack = audioTrack?.publication?.track?.mediaStreamTrack;

  // Drive arm/hand gestures from the agent's speaking STATE (stable for the whole
  // utterance), not from audio energy — energy dips during natural pauses would
  // otherwise stop/restart the gestures and break continuity.
  useEffect(() => {
    if (state === 'speaking') startGesturing();
    else stopGesturing();
  }, [state]);

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

    let openness = 0;
    let shape = 0.5;
    let enabled = false;
    let raf = 0;
    let stopped = false;

    const loop = () => {
      if (stopped) return;
      if (!enabled) enabled = enableLipSync();

      // Openness from RMS energy.
      analyser.getByteTimeDomainData(timeData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);
      const targetOpen = Math.min(1, Math.max(0, (rms - NOISE_FLOOR) * GAIN));
      openness += (targetOpen - openness) * (targetOpen > openness ? ATTACK : RELEASE);
      setMouthOpenness(openness);

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
