'use client';
import { createContext, useContext } from 'react';
import type { Locale } from '@/lib/i18n';
import type { Dict } from '@/content/en';

/** The slice of the dictionary that global client UI needs (header, menus, launcher). */
export type ClientDict = Pick<Dict, 'nav' | 'common' | 'a11y' | 'cookie' | 'designer' | 'meta' | 'notFound'>;

interface Ctx {
  locale: Locale;
  dir: 'rtl' | 'ltr';
  t: ClientDict;
}

const LocaleCtx = createContext<Ctx | null>(null);

export function LocaleProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLocale(): Ctx {
  const v = useContext(LocaleCtx);
  if (!v) throw new Error('useLocale outside LocaleProvider');
  return v;
}
