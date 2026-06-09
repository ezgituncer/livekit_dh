'use client';

import { useState } from 'react';
import { ArrowDownIcon } from 'lucide-react';
import { useChat } from '@livekit/components-react';
import { useI18n } from '@/lib/i18n/i18n';
import type { LangCode } from '@/lib/i18n/translations';
import { cn } from '@/lib/shadcn/utils';
import { type Localized, SUGGESTED_CATEGORIES } from '@/lib/suggested-questions';

/**
 * Suggested questions: a row of category tabs (always visible) with the selected
 * category's five questions listed below as full-width rows. Clicking a question
 * sends it to the agent. All content follows the active UI language.
 */
export function SuggestedQuestions({
  className,
  onAsk,
}: {
  className?: string;
  /** Called after a question is sent (e.g. to switch to the conversation view). */
  onAsk?: () => void;
}) {
  const { lang } = useI18n();
  const { send } = useChat();
  const [activeId, setActiveId] = useState(SUGGESTED_CATEGORIES[0]?.id);

  const loc = (l: Localized) => l[lang as LangCode] ?? l.en;
  const active = SUGGESTED_CATEGORIES.find((c) => c.id === activeId) ?? SUGGESTED_CATEGORIES[0];
  const pick = (text: string) => {
    void send(text).catch((err) => console.error('Suggested question send failed', err));
    onAsk?.();
  };

  return (
    <div className={cn('mx-auto flex w-full max-w-2xl flex-col gap-1.5', className)}>
      {/* Category tabs */}
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {SUGGESTED_CATEGORIES.map((c) => {
          const isActive = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              aria-pressed={isActive}
              className={cn(
                'flex flex-col items-center justify-between gap-1.5 rounded-xl border px-2 py-2 text-center text-[11px] leading-tight font-semibold backdrop-blur-md transition-colors',
                isActive
                  ? 'border-transparent bg-(--aqua) text-(--accent-contrast)'
                  : 'border-(--glass-line) bg-(--glass) text-(--ink) hover:border-(--aqua)/45'
              )}
            >
              <span>{loc(c.label)}</span>
              <span
                className={cn(
                  'grid size-5 flex-none place-items-center rounded-full border',
                  isActive ? 'border-current' : 'border-(--aqua)/40 text-(--aqua)'
                )}
              >
                <ArrowDownIcon className="size-3" />
              </span>
            </button>
          );
        })}
      </div>

      {/* Questions for the selected category */}
      <div className="flex flex-col gap-1.5">
        {active?.questions.map((q, i) => (
          <button
            key={i}
            type="button"
            onClick={() => pick(loc(q))}
            className="flex items-center justify-between gap-3 rounded-xl border border-(--glass-line) bg-(--glass) px-3.5 py-2 text-start text-xs font-medium text-(--ink) backdrop-blur-md transition-colors hover:border-(--aqua)/55 hover:bg-(--aqua)/10"
          >
            <span>{loc(q)}</span>
            <span className="grid size-5 flex-none place-items-center rounded-full border border-(--aqua)/45 text-[10px] font-bold text-(--aqua)">
              ?
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
