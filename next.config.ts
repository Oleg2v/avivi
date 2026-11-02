import type { NextConfig } from 'next';

/**
 * Avivi Kitchens: design concept.
 * Every response carries noindex. Pages are statically generated per locale;
 * only /api/* routes and the inbox run on the server.
 */
const securityHeaders = [
  { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
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
};

export default nextConfig;
