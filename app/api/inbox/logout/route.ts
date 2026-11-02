import { NextResponse } from 'next/server';
import { INBOX_COOKIE } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INBOX_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
