import { NextResponse } from 'next/server';
import { forwardToWebhook, saveLead, type StoredLead } from '@/lib/server/leads';

/**
 * POST /api/lead
 * Receives every lead (booking, architect, contractor, developer kitchen, service, contact,
 * style finder result, designer handoff), forwards it to the CRM webhook and stores it.
 * Always answers with JSON; never exposes internal errors.
 */
export const runtime = 'nodejs';

const TYPES = new Set(['booking', 'architect', 'contractor', 'developer', 'service', 'contact', 'style', 'designer']);
const MAX_BODY = 600_000; // bytes; attachments carry small thumbnails only

function clean(value: unknown, max = 400): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return v ? v.slice(0, max) : undefined;
}

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return NextResponse.json({ ok: false, reason: 'too_large' }, { status: 413 });
    const body = JSON.parse(text) as Record<string, unknown>;
    const type = clean(body.type, 20) || '';
    if (!TYPES.has(type)) return NextResponse.json({ ok: false, reason: 'type' }, { status: 400 });

    const phone = clean(body.phone, 30);
    const needsContact = !['style'].includes(type);
    if (needsContact && (!phone || phone.replace(/\D/g, '').length < 9)) {
      return NextResponse.json({ ok: false, reason: 'phone' }, { status: 422 });
    }

    const ref = clean(body.ref, 24) || `LD-${Date.now().toString(36).toUpperCase()}`;
    const payload: Record<string, unknown> = {
      locale: clean(body.locale, 5),
      name: clean(body.name, 120),
      phone,
      email: clean(body.email, 160),
      city: clean(body.city, 80),
      branch: clean(body.branch, 40),
      project: clean(body.project, 60),
      date: clean(body.date, 20),
      time: clean(body.time, 10),
      notes: clean(body.notes, 2000),
      source: clean(body.source, 120),
      attachments: typeof body.attachments === 'object' && body.attachments ? body.attachments : undefined,
      extra: typeof body.extra === 'object' && body.extra ? body.extra : undefined,
    };

    const lead: StoredLead = { ref, type, createdAt: Date.now(), status: 'new', payload };
    const [store, webhook] = await Promise.all([saveLead(lead), forwardToWebhook(lead)]);
    return NextResponse.json({ ok: true, ref, store, webhook });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 200 });
  }
}
