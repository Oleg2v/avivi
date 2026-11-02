import type { NextConfig } from 'next';

/**
 * Avivi Kitchens: design concept.
 * Every response carries noindex. Pages are statically generated per locale;
 * only /api/* routes run on the server.
 * The same security headers are set for static files in public/_headers (Cloudflare Workers assets).
 */
const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

// Cloudflare Workers build (scripts/cloudflare.mjs): images are served as built, without an Images binding.
const isCloudflare = process.env.DEPLOY_TARGET === 'cloudflare' || !!process.env.WORKERS_CI;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: isCloudflare,
    formats: ['image/avif', 'image/webp'],
    qualities: [70, 75, 82],
    deviceSizes: [390, 640, 828, 1080, 1280, 1600, 2000],
  },
  experimental: {
    optimizePackageImports: ['three'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  /**
   * Locale routing. Hebrew is the native, default version and lives at the root (/, /collections, ...);
   * English, Russian and French live under /en, /ru, /fr. Internally every Hebrew URL is served from
   * /he/..., so one app tree serves all four. /he/... itself redirects to the unprefixed address.
   */
  async redirects() {
    return [
      { source: '/he', destination: '/', permanent: true },
      { source: '/he/:path*', destination: '/:path*', permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/he' },
        // Everything except the other locales, API routes, Next internals and files with an extension.
        { source: '/:path((?!(?:en|ru|fr|he|api|_next)(?:/|$))(?!.*\\.[^/]+$).+)', destination: '/he/:path' },
      ],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
