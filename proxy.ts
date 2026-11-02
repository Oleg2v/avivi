import { NextResponse, type NextRequest } from 'next/server';

/**
 * Locale routing.
 * Hebrew is the native, default version and lives at the root (/, /collections, ...).
 * English, Russian and French live under /en, /ru, /fr on the same domain.
 * Internally every Hebrew URL is rewritten to /he/... so one app tree serves all four.
 */
const PREFIXED = new Set(['en', 'ru', 'fr']);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1] ?? '';

  // Canonical Hebrew URLs carry no prefix.
  if (first === 'he') {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/^\/he(?=\/|$)/, '') || '/';
    return NextResponse.redirect(url, 308);
  }

  if (PREFIXED.has(first)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/he${pathname === '/' ? '' : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip API routes, Next internals and any file with an extension.
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
