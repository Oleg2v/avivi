/**
 * Locales. Hebrew is native and default (served without a prefix).
 * English is complete. Russian and French are machine-assisted and labelled as such.
 */
export const locales = ['he', 'en', 'ru', 'fr'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'he';

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

export function dirOf(locale: Locale): 'rtl' | 'ltr' {
  return locale === 'he' ? 'rtl' : 'ltr';
}

export const localeNames: Record<Locale, string> = {
  he: 'עברית',
  en: 'English',
  ru: 'Русский',
  fr: 'Français',
};

export const localeShort: Record<Locale, string> = { he: 'עב', en: 'EN', ru: 'RU', fr: 'FR' };

export const machineAssisted: Record<Locale, boolean> = { he: false, en: false, ru: true, fr: true };

/** BCP-47 tags for Intl, speech recognition and calendars. */
export const localeTag: Record<Locale, string> = { he: 'he-IL', en: 'en-IL', ru: 'ru-RU', fr: 'fr-FR' };

/** Build an internal href for a locale. Hebrew has no prefix. */
export function href(locale: Locale, path = '/'): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (locale === defaultLocale) return p;
  return p === '/' ? `/${locale}` : `/${locale}${p}`;
}

/** '/en/story' -> '/story', '/story' -> '/story' */
export function stripLocale(pathname: string): string {
  const parts = pathname.split('/');
  if (isLocale(parts[1])) {
    const rest = '/' + parts.slice(2).join('/');
    return rest === '/' ? '/' : rest.replace(/\/$/, '');
  }
  return pathname || '/';
}

export function localeFromPath(pathname: string): Locale {
  const first = pathname.split('/')[1];
  return isLocale(first) ? first : defaultLocale;
}
