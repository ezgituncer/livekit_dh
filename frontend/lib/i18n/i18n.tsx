'use client';

import { createContext, useContext, useMemo } from 'react';
import { type UIStrings, getDir, tFor } from './translations';

interface I18nValue {
  /** Resolved language code actually in use (after fallback). */
  lang: string;
  /** Writing direction for the current language. */
  dir: 'ltr' | 'rtl';
  /** String catalog for the current language. */
  t: UIStrings;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  lang,
  children,
}: {
  lang: string | undefined;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nValue>(
    () => ({ lang: lang ?? 'en', dir: getDir(lang), t: tFor(lang) }),
    [lang]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the current language's strings and direction. Falls back to English
 * when used outside an `I18nProvider` so components never crash.
 */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  return { lang: 'en', dir: 'ltr', t: tFor(undefined) };
}
