'use client';

import type { LanguageOption } from '@/app-config';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n/i18n';
import { cn } from '@/lib/shadcn/utils';

/**
 * Circular flag chip. Flags are self-hosted SVGs under `public/flags/<code>.svg`
 * (named by language code, not country) so they render identically on every
 * platform — unlike emoji flags, which don't render at all on Windows.
 */
function Flag({ code, className }: { code: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/flags/${code}.svg`}
      alt=""
      aria-hidden
      className={cn('size-5 shrink-0 rounded-full object-cover ring-1 ring-white/20', className)}
    />
  );
}

interface LanguageSelectProps {
  languages: LanguageOption[];
  value: string | undefined;
  onChange: (code: string) => void;
  disabled?: boolean;
  className?: string;
  /** Open the menu by default (used for previews/tests). */
  defaultOpen?: boolean;
}

/**
 * Flag-based language selector: a glass pill showing the current flag + native
 * name, opening a rounded glass menu with one flagged row per language and the
 * active language highlighted in the accent teal.
 */
export function LanguageSelect({
  languages,
  value,
  onChange,
  disabled,
  className,
  defaultOpen,
}: LanguageSelectProps) {
  const { t } = useI18n();
  const current = languages.find((l) => l.code === value);

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled} defaultOpen={defaultOpen}>
      <SelectTrigger
        aria-label={t.conversationLanguage}
        className={cn(
          'h-10 gap-2.5 rounded-full border-[rgba(94,234,212,0.28)] bg-[rgb(8,40,36)]/55 pr-2.5 pl-3 text-sm font-medium text-[#ecfffb] shadow-[0_4px_20px_rgba(0,0,0,0.35)] backdrop-blur-md transition-colors hover:border-[rgba(94,234,212,0.5)] hover:bg-[rgb(12,52,46)]/65 focus-visible:ring-[#2fe6c0]/40 data-[state=open]:border-[rgba(94,234,212,0.6)]',
          className
        )}
      >
        {current ? (
          <span className="flex items-center gap-2.5">
            <Flag code={current.code} />
            <span className="leading-none">{current.label}</span>
          </span>
        ) : (
          <span className="text-[#86b9b0]">{t.language}</span>
        )}
      </SelectTrigger>
      <SelectContent
        position="popper"
        align="end"
        sideOffset={8}
        className="min-w-[200px] rounded-2xl border-[rgba(94,234,212,0.18)] bg-[rgb(6,16,15)]/95 p-1.5 text-[#ecfffb] shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        {languages.map((l) => (
          <SelectItem
            key={l.code}
            value={l.code}
            className="gap-3 rounded-xl py-2 pr-9 pl-2.5 text-sm text-[#cfeee7] data-[highlighted]:bg-white/8 data-[highlighted]:text-white data-[state=checked]:bg-[#2fe6c0]/14 data-[state=checked]:text-[#2fe6c0]"
          >
            <span className="flex items-center gap-3">
              <Flag code={l.code} />
              <span className="leading-none">{l.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
