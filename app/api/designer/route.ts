import { NextResponse } from 'next/server';
import { isLocale } from '@/lib/i18n';
import { demoReply } from '@/lib/designer/demo';
import { answer, designerConfig } from '@/lib/server/designer';

/**
 * POST /api/designer
 * { locale, page, messages: [{ role: 'user' | 'assistant', content }] }
 * -> { ok, reply, cards, suggestions, handoff, mode: 'live' | 'demo' }
 * Always answers with a usable reply: live model, or the grounded demo answers.
 * GET /api/designer -> { mode } so the chat can show "Demo mode" before the first question.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 45;

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, number[]>();

/** A light per-visitor brake on live model calls. Over the limit, answers continue in demo mode. */
function overLimit(key: string): boolean {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
  let locale = 'he';
  try {
    const text = await request.text();
    if (text.length > 60_000) return NextResponse.json({ ok: true, ...demoReply('', locale) });
    const body = JSON.parse(text) as { locale?: string; page?: string; messages?: unknown };
    if (isLocale(body.locale)) locale = body.locale;
    const ip = (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
    const reply = await answer({ messages: body.messages, locale, page: body.page, demoOnly: overLimit(ip) });
    return NextResponse.json({ ok: true, ...reply });
  } catch {
    return NextResponse.json({ ok: true, ...demoReply('', locale) });
  }
}

export async function GET() {
  return NextResponse.json({ mode: designerConfig().provider === 'demo' ? 'demo' : 'live' });
}
