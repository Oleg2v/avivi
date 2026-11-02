'use client';
import { LocaleProvider, type ClientDict } from './LocaleContext';
import type { Locale } from '@/lib/i18n';
import { SmoothScroll } from '@/components/motion/SmoothScroll';
import { RevealObserver } from '@/components/motion/RevealObserver';
import { Cursor } from '@/components/motion/Cursor';
import { PageTransition } from '@/components/motion/PageTransition';
import { Header } from '@/components/layout/Header';
import { CookieBanner } from '@/components/layout/CookieBanner';
import { DesignerLauncher } from '@/components/designer/DesignerLauncher';

/** Everything global and interactive, mounted once in the root layout. */
export function ClientShell({ locale, dir, t, children }: { locale: Locale; dir: 'rtl' | 'ltr'; t: ClientDict; children: React.ReactNode }) {
  return (
    <LocaleProvider value={{ locale, dir, t }}>
      <SmoothScroll />
      <RevealObserver />
      <Header />
      {children}
      <DesignerLauncher />
      <CookieBanner />
      <Cursor label={t.common.open} />
      <PageTransition />
    </LocaleProvider>
  );
}
