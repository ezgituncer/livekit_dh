'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  DEFAULT_ADVANCED_STT_SETTINGS,
  DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS,
  type AdvancedSttSettings,
  type AdvancedTurnHandlingSettings,
  type InterruptionMode,
} from '@/app-config';
import { Button } from '@/components/ui/button';
import {
  useAdvancedSettings,
  useAdvancedTurnHandlingSettings,
} from '@/lib/advanced-settings';

type NumericKey = Exclude<keyof AdvancedSttSettings, 'server_vad_enabled'>;

interface NumericFieldSpec {
  key: NumericKey;
  label: string;
  description: string;
  step: number;
  min: number;
  max: number;
}

const VAD_NUMERIC_FIELDS: NumericFieldSpec[] = [
  {
    key: 'vad_silence_threshold_secs',
    label: 'VAD silence threshold (seconds)',
    description: 'Silence duration before the model considers the user finished speaking.',
    step: 0.1,
    min: 0,
    max: 10,
  },
  {
    key: 'vad_threshold',
    label: 'VAD threshold',
    description: 'Voice-activity probability threshold (0–1). Higher = stricter.',
    step: 0.05,
    min: 0,
    max: 1,
  },
  {
    key: 'min_speech_duration_ms',
    label: 'Min speech duration (ms)',
    description: 'Speech shorter than this is ignored.',
    step: 50,
    min: 0,
    max: 10000,
  },
  {
    key: 'min_silence_duration_ms',
    label: 'Min silence duration (ms)',
    description: 'Silence shorter than this does not break a turn.',
    step: 100,
    min: 0,
    max: 60000,
  },
];

const TRACKED_KEYS: Array<keyof AdvancedSttSettings> = [
  'server_vad_enabled',
  ...VAD_NUMERIC_FIELDS.map((f) => f.key),
];

type TurnHandlingNumericKey =
  | 'endpointing_min_delay'
  | 'endpointing_max_delay'
  | 'interruption_min_duration'
  | 'interruption_min_words';

interface TurnHandlingNumericFieldSpec {
  key: TurnHandlingNumericKey;
  label: string;
  description: string;
  step: number;
  min: number;
  max: number;
}

const ENDPOINTING_FIELDS: TurnHandlingNumericFieldSpec[] = [
  {
    key: 'endpointing_min_delay',
    label: 'Min delay (seconds)',
    description:
      'Minimum time to wait since the last detected speech to declare the user’s turn complete.',
    step: 0.1,
    min: 0,
    max: 30,
  },
  {
    key: 'endpointing_max_delay',
    label: 'Max delay (seconds)',
    description: 'Maximum time the agent waits before terminating the turn.',
    step: 0.1,
    min: 0,
    max: 60,
  },
];

const INTERRUPTION_NUMERIC_FIELDS: TurnHandlingNumericFieldSpec[] = [
  {
    key: 'interruption_min_duration',
    label: 'Min duration (seconds)',
    description: 'Minimum speech duration required to trigger an interruption.',
    step: 0.1,
    min: 0,
    max: 10,
  },
  {
    key: 'interruption_min_words',
    label: 'Min words',
    description:
      'Minimum number of recognized words before an interruption is allowed (STT-based).',
    step: 1,
    min: 0,
    max: 20,
  },
];

const INTERRUPTION_MODE_OPTIONS: Array<{ value: InterruptionMode; label: string }> = [
  { value: 'adaptive', label: 'Adaptive' },
  { value: 'vad', label: 'VAD' },
];

const TURN_HANDLING_TRACKED_KEYS: Array<keyof AdvancedTurnHandlingSettings> = [
  'endpointing_min_delay',
  'endpointing_max_delay',
  'interruption_enabled',
  'interruption_mode',
  'interruption_min_duration',
  'interruption_min_words',
];

export default function AdvancedSettingsPage() {
  const [stored, save, reset] = useAdvancedSettings();
  const [draft, setDraft] = React.useState<AdvancedSttSettings>(DEFAULT_ADVANCED_STT_SETTINGS);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  const [turnStored, saveTurn, resetTurn] = useAdvancedTurnHandlingSettings();
  const [turnDraft, setTurnDraft] = React.useState<AdvancedTurnHandlingSettings>(
    DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS
  );
  const [turnSavedAt, setTurnSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    setDraft(stored);
  }, [stored]);

  React.useEffect(() => {
    setTurnDraft(turnStored);
  }, [turnStored]);

  const isDirty = React.useMemo(
    () => TRACKED_KEYS.some((k) => draft[k] !== stored[k]),
    [draft, stored]
  );

  const isTurnDirty = React.useMemo(
    () => TURN_HANDLING_TRACKED_KEYS.some((k) => turnDraft[k] !== turnStored[k]),
    [turnDraft, turnStored]
  );

  const updateNumber = (key: NumericKey, value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    setDraft((prev) => ({ ...prev, [key]: num }));
  };

  const setVadEnabled = (enabled: boolean) => {
    setDraft((prev) => ({ ...prev, server_vad_enabled: enabled }));
  };

  const onSave = () => {
    save(draft);
    setSavedAt(Date.now());
  };

  const onReset = () => {
    reset();
    setDraft({ ...DEFAULT_ADVANCED_STT_SETTINGS });
    setSavedAt(Date.now());
  };

  const updateTurnNumber = (key: TurnHandlingNumericKey, value: string) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    const normalized = key === 'interruption_min_words' ? Math.max(0, Math.round(num)) : num;
    setTurnDraft((prev) => ({ ...prev, [key]: normalized }));
  };

  const setInterruptionEnabled = (enabled: boolean) => {
    setTurnDraft((prev) => ({ ...prev, interruption_enabled: enabled }));
  };

  const setInterruptionMode = (mode: InterruptionMode) => {
    setTurnDraft((prev) => ({ ...prev, interruption_mode: mode }));
  };

  const onSaveTurn = () => {
    saveTurn(turnDraft);
    setTurnSavedAt(Date.now());
  };

  const onResetTurn = () => {
    resetTurn();
    setTurnDraft({ ...DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS });
    setTurnSavedAt(Date.now());
  };

  const numericDisabled = !draft.server_vad_enabled;
  const interruptionDisabled = !turnDraft.interruption_enabled;

  return (
    <main className="bg-background mx-auto flex min-h-svh max-w-2xl flex-col px-6 py-16">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Advanced Settings</h1>
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
        >
          Back
        </Link>
      </div>

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">ElevenLabs Realtime STT — Server VAD</h2>
          <p className="text-muted-foreground text-sm leading-6">
            Configure the <code>server_vad</code> argument passed to ElevenLabs Scribe v2 Realtime.
            Settings are saved in your browser and applied the next time you start a call. They are
            ignored by other STT models.
          </p>
        </header>

        <div className="border-input flex flex-col gap-2 rounded-md border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="server_vad_enabled" className="text-sm font-medium">
                Use ElevenLabs server VAD
              </label>
              <p className="text-muted-foreground text-xs">
                When off, ElevenLabs server-side VAD is disabled and LiveKit handles turn detection
                instead. The values below are ignored.
              </p>
            </div>
            <BooleanToggle
              id="server_vad_enabled"
              value={draft.server_vad_enabled}
              onChange={setVadEnabled}
            />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          {VAD_NUMERIC_FIELDS.map((field) => {
            const fallback = DEFAULT_ADVANCED_STT_SETTINGS[field.key];
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <label htmlFor={field.key} className="text-foreground text-sm font-medium">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type="number"
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  value={draft[field.key]}
                  disabled={numericDisabled}
                  onChange={(e) => updateNumber(field.key, e.target.value)}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-muted-foreground text-xs">
                  {field.description} Default: {fallback}.
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 flex items-center gap-3">
        <Button onClick={onSave} disabled={!isDirty}>
          Save
        </Button>
        <Button variant="outline" onClick={onReset}>
          Reset to defaults
        </Button>
        {savedAt !== null && !isDirty && (
          <span className="text-muted-foreground text-xs">Saved.</span>
        )}
      </div>

      <hr className="border-input my-12" />

      <section className="flex flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h2 className="text-lg font-medium">Turn Handling</h2>
          <p className="text-muted-foreground text-sm leading-6">
            <code>TurnHandlingOptions</code> applied to every session. Endpointing controls how long to wait after the detector
            signals end-of-turn; interruption controls how the agent reacts when the user starts
            speaking while it is talking.
          </p>
        </header>

        <div className="flex flex-col gap-2">
          <h3 className="text-foreground text-sm font-semibold">Endpointing</h3>
          <p className="text-muted-foreground text-xs">
            Overrides the per-detector defaults (also applies to detectors that don’t set
            their own).
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {ENDPOINTING_FIELDS.map((field) => {
            const fallback = DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS[field.key];
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <label htmlFor={field.key} className="text-foreground text-sm font-medium">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type="number"
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  value={turnDraft[field.key]}
                  onChange={(e) => updateTurnNumber(field.key, e.target.value)}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-muted-foreground text-xs">
                  {field.description} Default: {fallback}.
                </p>
              </div>
            );
          })}
        </div>

        <h3 className="text-foreground mt-4 text-sm font-semibold">Interruption</h3>

        <div className="border-input flex flex-col gap-2 rounded-md border p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="interruption_enabled" className="text-sm font-medium">
                Enable interruption
              </label>
              <p className="text-muted-foreground text-xs">
                When off, the user cannot interrupt the agent while it is speaking. The values
                below are ignored.
              </p>
            </div>
            <BooleanToggle
              id="interruption_enabled"
              value={turnDraft.interruption_enabled}
              onChange={setInterruptionEnabled}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="interruption_mode" className="text-foreground text-sm font-medium">
            Mode
          </label>
          <select
            id="interruption_mode"
            value={turnDraft.interruption_mode}
            disabled={interruptionDisabled}
            onChange={(e) => setInterruptionMode(e.target.value as InterruptionMode)}
            className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {INTERRUPTION_MODE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-muted-foreground text-xs">
            <code>adaptive</code> uses STT-based heuristics; <code>vad</code> triggers on raw
            voice-activity detection. Default:{' '}
            <code>{DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS.interruption_mode}</code>.
          </p>
        </div>

        <div className="flex flex-col gap-6">
          {INTERRUPTION_NUMERIC_FIELDS.map((field) => {
            const fallback = DEFAULT_ADVANCED_TURN_HANDLING_SETTINGS[field.key];
            return (
              <div key={field.key} className="flex flex-col gap-2">
                <label htmlFor={field.key} className="text-foreground text-sm font-medium">
                  {field.label}
                </label>
                <input
                  id={field.key}
                  type="number"
                  step={field.step}
                  min={field.min}
                  max={field.max}
                  value={turnDraft[field.key]}
                  disabled={interruptionDisabled}
                  onChange={(e) => updateTurnNumber(field.key, e.target.value)}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring placeholder:text-muted-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                <p className="text-muted-foreground text-xs">
                  {field.description} Default: {fallback}.
                </p>
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 flex items-center gap-3">
        <Button onClick={onSaveTurn} disabled={!isTurnDirty}>
          Save
        </Button>
        <Button variant="outline" onClick={onResetTurn}>
          Reset to defaults
        </Button>
        {turnSavedAt !== null && !isTurnDirty && (
          <span className="text-muted-foreground text-xs">Saved.</span>
        )}
      </div>
    </main>
  );
}

interface BooleanToggleProps {
  id: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

function BooleanToggle({ id, value, onChange }: BooleanToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={
        'focus-visible:ring-ring relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none ' +
        (value ? 'bg-primary' : 'bg-input')
      }
    >
      <span
        className={
          'bg-background inline-block size-5 transform rounded-full shadow ring-0 transition-transform ' +
          (value ? 'translate-x-5' : 'translate-x-0.5')
        }
      />
    </button>
  );
}
