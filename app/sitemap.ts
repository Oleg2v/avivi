import type { MetadataRoute } from 'next';
import { collectionIds } from '@/lib/data/collections';
import { href, localeTag, locales } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';
import { getDict } from '@/lib/dict';

/**
 * Every public page in the four languages, with hreflang alternates.
 * The demo is noindex and robots.txt disallows crawling; the sitemap documents the URL set.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const articles = getDict('en').magazine.articles.map((a) => `/magazine/${a.slug}`);
  const paths = [
    '/',
    '/collections',
    ...collectionIds.map((id) => `/collections/${id}`),
    '/smart-kitchen',
    '/visualiser',
    '/style-finder',
    '/planner',
    '/designer',
    '/book',
    '/showrooms',
    '/professionals',
    '/new-apartment',
    '/products',
    '/story',
    '/magazine',
    ...articles,
    '/app',
    '/service',
    '/contact',
    '/my-design',
    '/accessibility',
    '/privacy',
    '/cookies',
  ];
  const abs = (p: string) => `${siteUrl}${p === '/' ? '/' : p}`;
  return paths.flatMap((path) =>
    locales.map((locale) => ({
      url: abs(href(locale, path)),
      alternates: {
        languages: Object.fromEntries([...locales.map((l) => [localeTag[l], abs(href(l, path))]), ['x-default', abs(href('he', path))]]),
      },
    })),
  );
}
