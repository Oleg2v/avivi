import type { Metadata } from 'next';
import { href, localeTag, locales, type Locale } from './i18n';

/** Social preview image (public/og.jpg), made absolute by metadataBase in the root layout. */
export const ogImage = { url: '/og.jpg', width: 1200, height: 630, alt: 'Avivi Kitchens' };

/**
 * Per-page metadata: title, description, canonical, hreflang alternates and the social preview.
 * noindex comes from the root layout for every page.
 */
export function pageMeta(locale: Locale, path: string, title: string, description?: string): Metadata {
  const languages: Record<string, string> = {};
  for (const l of locales) languages[localeTag[l]] = href(l, path);
  languages['x-default'] = href('he', path);
  return {
    title,
    description,
    alternates: { canonical: href(locale, path), languages },
    openGraph: {
      title,
      description,
      url: href(locale, path),
      siteName: locale === 'he' ? 'אביבי מטבחים' : 'Avivi Kitchens',
      locale: localeTag[locale].replace('-', '_'),
      type: 'website',
      images: [ogImage],
    },
    twitter: { card: 'summary_large_image', title, description, images: [ogImage.url] },
  };
}
