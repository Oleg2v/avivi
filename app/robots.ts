import type { MetadataRoute } from 'next';

/** Design concept: nothing is to be indexed. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] };
}
