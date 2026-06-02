import * as React from 'react';
import {
  DEFAULT_ADVANCED_STT_SETTINGS,
  DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS,
  type AdvancedSttSettings,
  type AdvancedTurnHandlingSettings,
  type InterruptionMode,
} from '@/app-config';

export const ADVANCED_SETTINGS_STORAGE_KEY = 'voice-agent.advanced-stt-settings';
export const ADVANCED_TURN_HANDLING_STORAGE_KEY = 'voice-agent.advanced-turn-handling-settings';

const NUMERIC_KEYS = [
  'vad_silence_threshold_secs',
  'vad_threshold',
  'min_speech_duration_ms',
  'min_silence_duration_ms',
] as const satisfies ReadonlyArray<keyof AdvancedSttSettings>;

function coerce(raw: unknown): AdvancedSttSettings {
  const out: AdvancedSttSettings = { ...DEFAULT_ADVANCED_STT_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.server_vad_enabled === 'boolean') {
    out.server_vad_enabled = obj.server_vad_enabled;
  }
  for (const key of NUMERIC_KEYS) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function loadAdvancedSettings(): AdvancedSttSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_ADVANCED_STT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(ADVANCED_SETTINGS_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ADVANCED_STT_SETTINGS };
    return coerce(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ADVANCED_STT_SETTINGS };
  }
}

export function saveAdvancedSettings(settings: AdvancedSttSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADVANCED_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function useAdvancedSettings(): [
  AdvancedSttSettings,
  (next: AdvancedSttSettings) => void,
  () => void,
] {
  const [settings, setSettings] = React.useState<AdvancedSttSettings>(
    () => DEFAULT_ADVANCED_STT_SETTINGS
  );

  React.useEffect(() => {
    setSettings(loadAdvancedSettings());
  }, []);

  const update = React.useCallback((next: AdvancedSttSettings) => {
    setSettings(next);
    saveAdvancedSettings(next);
  }, []);

  const reset = React.useCallback(() => {
    setSettings({ ...DEFAULT_ADVANCED_STT_SETTINGS });
    saveAdvancedSettings({ ...DEFAULT_ADVANCED_STT_SETTINGS });
  }, []);

  return [settings, update, reset];
}

// ---------------------------------------------------------------------------
// Turn handling (endpointing + interruption)
// ---------------------------------------------------------------------------

const TURN_HANDLING_NUMERIC_KEYS = [
  'endpointing_min_delay',
  'endpointing_max_delay',
  'interruption_min_duration',
  'interruption_min_words',
] as const satisfies ReadonlyArray<keyof AdvancedTurnHandlingSettings>;

const INTERRUPTION_MODES: ReadonlyArray<InterruptionMode> = ['adaptive', 'vad'];

function coerceTurnHandling(raw: unknown): AdvancedTurnHandlingSettings {
  const out: AdvancedTurnHandlingSettings = { ...DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS };
  if (!raw || typeof raw !== 'object') return out;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.interruption_enabled === 'boolean') {
    out.interruption_enabled = obj.interruption_enabled;
  }
  if (
    typeof obj.interruption_mode === 'string' &&
    INTERRUPTION_MODES.includes(obj.interruption_mode as InterruptionMode)
  ) {
    out.interruption_mode = obj.interruption_mode as InterruptionMode;
  }
  for (const key of TURN_HANDLING_NUMERIC_KEYS) {
    const value = obj[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
    }
  }
  return out;
}

export function loadAdvancedTurnHandlingSettings(): AdvancedTurnHandlingSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS };
  try {
    const raw = window.localStorage.getItem(ADVANCED_TURN_HANDLING_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS };
    return coerceTurnHandling(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS };
  }
}

export function saveAdvancedTurnHandlingSettings(settings: AdvancedTurnHandlingSettings) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ADVANCED_TURN_HANDLING_STORAGE_KEY, JSON.stringify(settings));
}

export function useAdvancedTurnHandlingSettings(): [
  AdvancedTurnHandlingSettings,
  (next: AdvancedTurnHandlingSettings) => void,
  () => void,
] {
  const [settings, setSettings] = React.useState<AdvancedTurnHandlingSettings>(
    () => DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS
  );

  React.useEffect(() => {
    setSettings(loadAdvancedTurnHandlingSettings());
  }, []);

  const update = React.useCallback((next: AdvancedTurnHandlingSettings) => {
    setSettings(next);
    saveAdvancedTurnHandlingSettings(next);
  }, []);

  const reset = React.useCallback(() => {
    setSettings({ ...DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS });
    saveAdvancedTurnHandlingSettings({ ...DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS });
  }, []);

  return [settings, update, reset];
}
