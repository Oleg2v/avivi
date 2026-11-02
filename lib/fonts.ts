import { Frank_Ruhl_Libre, Heebo, Fraunces, Inter_Tight, Literata } from 'next/font/google';
import type { Locale } from './i18n';

/**
 * Hebrew: Frank Ruhl Libre (display) + Heebo (UI). Preloaded: Hebrew is the default.
 * English/French: Fraunces (display, warm optical sizes) + Inter Tight (UI).
 * Russian: Literata (display with Cyrillic) + Inter Tight (UI, Cyrillic).
 * Fallback metrics are adjusted automatically, so font swaps cause no layout shift.
 */
const frank = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  variable: '--f-display-he',
  display: 'swap',
});
const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--f-ui-he',
  display: 'swap',
});
const fraunces = Fraunces({
  subsets: ['latin', 'latin-ext'],
  variable: '--f-display-latin',
  axes: ['opsz', 'SOFT'],
  display: 'swap',
  preload: false,
});
const interTight = Inter_Tight({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--f-ui-latin',
  display: 'swap',
  preload: false,
});
const literata = Literata({
  subsets: ['cyrillic', 'latin'],
  variable: '--f-display-cyr',
  axes: ['opsz'],
  display: 'swap',
  preload: false,
});

export function fontClasses(locale: Locale): string {
  switch (locale) {
    case 'he':
      return `${frank.variable} ${heebo.variable} script-he`;
    case 'ru':
      return `${literata.variable} ${interTight.variable} script-cyr`;
    default:
      return `${fraunces.variable} ${interTight.variable} script-latin`;
  }
}
