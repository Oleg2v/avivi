import 'server-only';
import type { CollectionId } from '@/lib/data/collections';

/**
 * Prompt for the image model, grounded in the collection recipes of this concept only.
 * The model is asked to keep the room's architecture and camera, and change the kitchen.
 */
const RECIPES: Record<CollectionId, string> = {
  modern:
    'Avivi Modern collection: handleless fronts with integrated grip profiles, matte lacquer in warm grey, tall units in natural oak wood veneer, thin honed light stone countertop and stone backsplash, black matte tap, warm under-cabinet light.',
  classic:
    'Avivi Classic collection: five-piece framed shaker fronts in soft sage lacquer, brass knobs and cup pulls, cornices on top of the wall units, a classic canopy hood, white marble countertop with grey veins, handmade-look cream tiles on the backsplash.',
  dark:
    'Avivi Dark collection: graphite matte lacquer fronts, walnut wood veneer tall units, dark marble countertop and backsplash with light veins, thin brass edge pulls, open walnut shelves with concealed warm light instead of wall cabinets.',
  light:
    'Avivi Light collection: bone-white lacquer fronts with slim steel bar handles, pale oak veneer accents and open shelves, white quartz countertop with soft veining, vertical white stacked tiles, bright and airy.',
  specials:
    'Avivi Specials series: fluted natural oak base fronts, deep olive lacquer tall and wall units, honed travertine countertop and backsplash, brass knobs, linen globe pendant lights.',
};

export function visualisePrompt(collection: CollectionId): string {
  return [
    'Photorealistic interior photograph. Redesign only the kitchen cabinetry, countertops, backsplash and kitchen lighting in this photo as:',
    RECIPES[collection],
    'Keep the room architecture exactly: same walls, window and door positions, ceiling, floor, camera angle, lens and perspective. Keep plumbing positions plausible. Natural daylight, true-to-life materials, no people, no text, no logos, no watermarks.',
  ].join(' ');
}

export function imageConfig() {
  const key = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY || '';
  return {
    key,
    base: (process.env.IMAGE_API_BASE || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: process.env.IMAGE_MODEL || 'gpt-image-1',
    size: process.env.IMAGE_SIZE || '1536x1024',
    live: !!key,
  };
}

/** Calls an OpenAI-compatible images/edits endpoint. Returns a data URL or null. */
export async function editImage(dataUrl: string, collection: CollectionId): Promise<string | null> {
  const cfg = imageConfig();
  if (!cfg.live) return null;
  const m = dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!m) return null;
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 8 * 1024 * 1024) return null;
  const form = new FormData();
  form.append('model', cfg.model);
  form.append('prompt', visualisePrompt(collection));
  form.append('size', cfg.size);
  form.append('n', '1');
  form.append('image', new Blob([bytes], { type: m[1] }), `room.${m[1].split('/')[1]}`);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55_000);
  try {
    const res = await fetch(`${cfg.base}/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${cfg.key}` }, body: form, signal: ctrl.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
    const item = json.data?.[0];
    if (item?.b64_json) return `data:image/png;base64,${item.b64_json}`;
    if (item?.url) {
      const img = await fetch(item.url);
      if (!img.ok) return null;
      const buf = Buffer.from(await img.arrayBuffer());
      return `data:${img.headers.get('content-type') || 'image/png'};base64,${buf.toString('base64')}`;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
