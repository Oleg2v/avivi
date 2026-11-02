import { NextResponse } from 'next/server';
import { isCollectionId } from '@/lib/data/collections';
import { editImage, imageConfig } from '@/lib/server/visualise';

/**
 * POST /api/visualise
 * { collection, room? ('a'|'b'|'c'), image? (data URL, already downscaled by the browser) }
 * Live: transforms the visitor's photo with the image model (key in the environment).
 * Demo (no key, or an example room): answers with the pre-rendered example to show.
 * Photos are processed in memory only. Nothing is stored or logged.
 */
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > 9_000_000) return NextResponse.json({ ok: false, reason: 'too_large' }, { status: 413 });
    const body = JSON.parse(text) as { collection?: string; room?: string; image?: string };
    const collection = isCollectionId(body.collection) ? body.collection : 'modern';
    const room = body.room === 'a' || body.room === 'b' || body.room === 'c' ? body.room : null;
    const cfg = imageConfig();

    if (body.image && cfg.live) {
      const out = await editImage(body.image, collection);
      if (out) return NextResponse.json({ ok: true, mode: 'live', collection, image: out });
      return NextResponse.json({ ok: false, reason: 'generation_failed' });
    }
    // Demo: example rooms, or an upload without a configured image service.
    return NextResponse.json({ ok: true, mode: 'demo', collection, room: room ?? 'a', uploaded: !!body.image, live: cfg.live });
  } catch {
    return NextResponse.json({ ok: false, reason: 'unavailable' });
  }
}
