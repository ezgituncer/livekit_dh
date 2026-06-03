import Link from 'next/link';
import type {
  DetectorOption,
  LanguageOption,
  STTOption,
  TTSOption,
  VoiceOption,
} from '@/app-config';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/shadcn/utils';

// Shared look for the welcome-screen fields (selects + voice input):
// glass fill with a cyan inner edge, purple focus ring, neon-white text.
const FIELD_CLASS =
  'glass-panel border-0 text-white transition-shadow duration-300 hover:shadow-[inset_0_0_22px_-8px_#00e5ff,0_0_22px_-6px_#b026ff] focus-within:shadow-[inset_0_0_22px_-6px_#b026ff,0_0_26px_-4px_#00e5ff]';

// Field labels — cyan, uppercase, wide tracking for a HUD feel.
const LABEL_CLASS =
  'text-left font-mono text-[10px] font-semibold tracking-[0.18em] text-[#7cf7ff]/80 uppercase';

// Matching dark/neon dropdown panel and items.
const DROPDOWN_CLASS =
  'border-[#00e5ff]/25 bg-[rgba(11,9,24,0.92)] text-white backdrop-blur-md shadow-[0_0_30px_-10px_#b026ff]';
const DROPDOWN_ITEM_CLASS =
  'text-white/90 focus:bg-[#00e5ff]/15 focus:text-white data-[state=checked]:text-[#00e5ff]';

function WelcomeImage() {
  return (
    <svg
      width="64"
      height="64"
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mb-4 size-16 text-[#00e5ff] drop-shadow-[0_0_18px_rgba(0,229,255,0.7)]"
    >
      <path
        d="M15 24V40C15 40.7957 14.6839 41.5587 14.1213 42.1213C13.5587 42.6839 12.7956 43 12 43C11.2044 43 10.4413 42.6839 9.87868 42.1213C9.31607 41.5587 9 40.7957 9 40V24C9 23.2044 9.31607 22.4413 9.87868 21.8787C10.4413 21.3161 11.2044 21 12 21C12.7956 21 13.5587 21.3161 14.1213 21.8787C14.6839 22.4413 15 23.2044 15 24ZM22 5C21.2044 5 20.4413 5.31607 19.8787 5.87868C19.3161 6.44129 19 7.20435 19 8V56C19 56.7957 19.3161 57.5587 19.8787 58.1213C20.4413 58.6839 21.2044 59 22 59C22.7956 59 23.5587 58.6839 24.1213 58.1213C24.6839 57.5587 25 56.7957 25 56V8C25 7.20435 24.6839 6.44129 24.1213 5.87868C23.5587 5.31607 22.7956 5 22 5ZM32 13C31.2044 13 30.4413 13.3161 29.8787 13.8787C29.3161 14.4413 29 15.2044 29 16V48C29 48.7957 29.3161 49.5587 29.8787 50.1213C30.4413 50.6839 31.2044 51 32 51C32.7956 51 33.5587 50.6839 34.1213 50.1213C34.6839 49.5587 35 48.7957 35 48V16C35 15.2044 34.6839 14.4413 34.1213 13.8787C33.5587 13.3161 32.7956 13 32 13ZM42 21C41.2043 21 40.4413 21.3161 39.8787 21.8787C39.3161 22.4413 39 23.2044 39 24V40C39 40.7957 39.3161 41.5587 39.8787 42.1213C40.4413 42.6839 41.2043 43 42 43C42.7957 43 43.5587 42.6839 44.1213 42.1213C44.6839 41.5587 45 40.7957 45 40V24C45 23.2044 44.6839 22.4413 44.1213 21.8787C43.5587 21.3161 42.7957 21 42 21ZM52 17C51.2043 17 50.4413 17.3161 49.8787 17.8787C49.3161 18.4413 49 19.2044 49 20V44C49 44.7957 49.3161 45.5587 49.8787 46.1213C50.4413 46.6839 51.2043 47 52 47C52.7957 47 53.5587 46.6839 54.1213 46.1213C54.6839 45.5587 55 44.7957 55 44V20C55 19.2044 54.6839 18.4413 54.1213 17.8787C53.5587 17.3161 52.7957 17 52 17Z"
        fill="currentColor"
      />
    </svg>
  );
}

const NO_LANGUAGE_CODE = '__none__';
const CUSTOM_VOICE_CODE = '__custom__';

interface WelcomeViewProps {
  startButtonText: string;
  onStartCall: () => void;
  stts: STTOption[];
  selectedStt: string | undefined;
  onSttChange: (id: string) => void;
  ttss: TTSOption[];
  selectedTts: string | undefined;
  onTtsChange: (id: string) => void;
  detectors: DetectorOption[];
  selectedDetector: string | undefined;
  onDetectorChange: (id: string) => void;
  languages: LanguageOption[];
  selectedLanguage: string | undefined;
  onLanguageChange: (code: string | undefined) => void;
  voices: VoiceOption[];
  selectedVoice: string | undefined;
  onVoiceChange: (id: string) => void;
  customVoiceId: string;
  onCustomVoiceIdChange: (id: string) => void;
}

export const WelcomeView = ({
  startButtonText,
  onStartCall,
  stts,
  selectedStt,
  onSttChange,
  ttss,
  selectedTts,
  onTtsChange,
  detectors,
  selectedDetector,
  onDetectorChange,
  languages,
  selectedLanguage,
  onLanguageChange,
  voices,
  selectedVoice,
  onVoiceChange,
  customVoiceId,
  onCustomVoiceIdChange,
  ref,
}: React.ComponentProps<'div'> & WelcomeViewProps) => {
  const currentStt = stts.find((s) => s.id === selectedStt);
  const languageSelectable = Boolean(currentStt?.supportsLanguage);
  const isCustomVoice = selectedVoice === CUSTOM_VOICE_CODE;
  const disabled =
    !selectedStt ||
    !selectedTts ||
    !selectedDetector ||
    !selectedVoice ||
    (isCustomVoice && customVoiceId.trim().length === 0);

  return (
    <div ref={ref}>
      <section className="fade-in-up flex flex-col items-center justify-center text-center">
        <WelcomeImage />

        <p className="neon-text max-w-prose pt-1 text-lg leading-6 font-semibold tracking-wide text-white">
          Chat live with your voice AI agent
        </p>

        <OptionSelect
          id="stt-select"
          label="STT"
          value={selectedStt}
          onValueChange={onSttChange}
          options={stts.map((s) => ({ value: s.id, label: s.label }))}
          placeholder="Select STT"
        />

        <OptionSelect
          id="tts-select"
          label="TTS"
          value={selectedTts}
          onValueChange={onTtsChange}
          options={ttss.map((t) => ({ value: t.id, label: t.label }))}
          placeholder="Select TTS"
        />

        <OptionSelect
          id="voice-select"
          label="Voice"
          value={selectedVoice}
          onValueChange={onVoiceChange}
          options={[
            ...voices.map((v) => ({ value: v.id, label: v.label })),
            { value: CUSTOM_VOICE_CODE, label: 'Custom voice ID…' },
          ]}
          placeholder="Select a voice"
        />

        {isCustomVoice && (
          <div className="mt-4 flex w-64 flex-col gap-2">
            <label htmlFor="custom-voice-id" className={LABEL_CLASS}>
              Voice ID
            </label>
            <input
              id="custom-voice-id"
              type="text"
              value={customVoiceId}
              onChange={(e) => onCustomVoiceIdChange(e.target.value)}
              placeholder="Enter voice ID"
              autoComplete="off"
              spellCheck={false}
              className={cn(
                'flex h-11 w-full rounded-md px-3 py-1 text-sm transition-colors placeholder:text-white/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                FIELD_CLASS
              )}
            />
          </div>
        )}

        <OptionSelect
          id="detector-select"
          label="Turn detector"
          value={selectedDetector}
          onValueChange={onDetectorChange}
          options={detectors.map((d) => ({ value: d.id, label: d.label }))}
          placeholder="Select turn detector"
        />

        <OptionSelect
          id="language-select"
          label={languageSelectable ? 'Language' : 'Language (STT does not accept a hint)'}
          value={selectedLanguage ?? NO_LANGUAGE_CODE}
          onValueChange={(v) => onLanguageChange(v === NO_LANGUAGE_CODE ? undefined : v)}
          options={[
            { value: NO_LANGUAGE_CODE, label: 'Auto / none' },
            ...languages.map((l) => ({ value: l.code, label: l.label })),
          ]}
          placeholder="Select a language"
          disabled={!languageSelectable}
        />

        <div
          className={cn(
            'mt-7 w-64 rounded-[15px] p-0.5 transition-all duration-300',
            !disabled && 'glow-pulse'
          )}
          style={{
            background:
              'linear-gradient(127deg, #00e5ff 0%, #b026ff 55%, #ff3cac 110%)',
          }}
        >
          <Button
            size="lg"
            onClick={onStartCall}
            disabled={disabled}
            className="group h-[60px] w-full rounded-[13px] border-0 bg-[rgba(11,9,24,0.85)] font-mono text-xs font-bold tracking-[0.22em] text-[#7cf7ff] uppercase shadow-none transition-colors hover:bg-[rgba(24,18,43,0.85)] hover:text-white disabled:opacity-50"
          >
            <span className="neon-text">{startButtonText}</span>
          </Button>
        </div>

        <Link
          href="/advanced"
          className="mt-4 text-xs text-[#9c9ac4] underline underline-offset-4 transition-colors hover:text-[#00e5ff]"
        >
          Advanced Settings
        </Link>
      </section>
    </div>
  );
};

interface OptionSelectProps {
  id: string;
  label: string;
  value: string | undefined;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
  disabled?: boolean;
}

function OptionSelect({
  id,
  label,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
}: OptionSelectProps) {
  return (
    <div className="mt-4 flex w-64 flex-col gap-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label}
      </label>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          id={id}
          className={cn('w-full data-[size=default]:h-11 [&_svg]:text-white/70', FIELD_CLASS)}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={DROPDOWN_CLASS}>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className={DROPDOWN_ITEM_CLASS}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
