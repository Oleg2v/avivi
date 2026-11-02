import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { INBOX_COOKIE, isAuthed, passwordIsDefault } from '@/lib/server/auth';
import { listLeads, storeKind } from '@/lib/server/leads';

/** GET /api/inbox: live leads for the showroom inbox (password protected). */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const jar = await cookies();
  if (!isAuthed(jar.get(INBOX_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, demo: passwordIsDefault });
  }
  // In demo mode (no INBOX_PASSWORD) server-stored leads are never exposed.
  const leads = passwordIsDefault ? [] : await listLeads();
  return NextResponse.json({ ok: true, live: !passwordIsDefault, store: storeKind, leads });
}
