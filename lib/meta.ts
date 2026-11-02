import type { Metadata } from 'next';
import { href, localeTag, locales, type Locale } from './i18n';

/** Per-page metadata: title, description, hreflang alternates, and noindex everywhere. */
export function pageMeta(locale: Locale, path: string, title: string, description?: string): Metadata {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeTag[l]] = href(l, path);
  languages['x-default'] = href('he', path);
  return {
    title,
    description,
    alternates: { canonical: href(locale, path), languages },
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    openGraph: { title, description, locale: localeTag[locale].replace('-', '_'), type: 'website' },
  };
}
