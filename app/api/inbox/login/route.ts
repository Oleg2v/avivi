import { NextResponse } from 'next/server';
import { INBOX_COOKIE, checkPassword, inboxToken } from '@/lib/server/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  let password = '';
  try {
    const body = (await request.json()) as { password?: string };
    password = typeof body.password === 'string' ? body.password.slice(0, 200) : '';
  } catch {
    /* empty */
  }
  // Small constant delay against brute force.
  await new Promise((r) => setTimeout(r, 400));
  // 200 with ok:false keeps the browser console clean; the client shows the message.
  if (!checkPassword(password)) return NextResponse.json({ ok: false, reason: 'password' });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(INBOX_COOKIE, inboxToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 8,
  });
  return res;
}
