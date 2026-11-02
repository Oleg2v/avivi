import type { Locale } from './i18n';

/**
 * Fonts (all SIL Open Font License, self-hosted in public/fonts, faces in app/fonts.css):
 * Hebrew: Frank Ruhl Libre (display) + Heebo (UI).
 * English/French: Fraunces (display, warm optical sizes) + Inter Tight (UI).
 * Russian: Literata (display with Cyrillic) + Inter Tight (UI, Cyrillic).
 * Each locale preloads only its own files, so first paint already uses the right faces.
 */
export function fontClasses(locale: Locale): string {
  switch (locale) {
    case 'he':
      return 'script-he';
    case 'ru':
      return 'script-cyr';
    default:
      return 'script-latin';
  }
}

/** Font files to preload for a locale (the faces that carry the first screen). */
export function fontPreloads(locale: Locale): string[] {
  switch (locale) {
    case 'he':
      return ['/fonts/frank-ruhl-libre-hebrew.woff2', '/fonts/frank-ruhl-libre-latin-core.woff2', '/fonts/heebo-hebrew.woff2', '/fonts/heebo-latin-core.woff2'];
    case 'ru':
      return ['/fonts/literata-cyrillic-core.woff2', '/fonts/inter-tight-cyrillic-core.woff2', '/fonts/inter-tight-latin-core.woff2'];
    default:
      return ['/fonts/fraunces-latin-core.woff2', '/fonts/inter-tight-latin-core.woff2'];
  }
}
