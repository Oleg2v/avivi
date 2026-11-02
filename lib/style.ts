import type { CollectionId } from './data/collections';

/** Style finder scoring. Each answer nudges collections; ties resolve in catalogue order. */
const SCORES: Record<string, Partial<Record<CollectionId, number>>> = {
  'tone.light': { light: 2, modern: 1, classic: 1 },
  'tone.dark': { dark: 3 },
  'tone.both': { modern: 1, specials: 1, dark: 1 },
  'material.wood': { specials: 2, modern: 1, light: 1 },
  'material.lacquer': { modern: 1, classic: 1, light: 1, dark: 1 },
  'material.mix': { modern: 2, specials: 1 },
  'handles.handleless': { modern: 2, dark: 1 },
  'handles.handles': { classic: 2, light: 1, specials: 1 },
  'lines.clean': { modern: 2, light: 1, dark: 1 },
  'lines.framed': { classic: 3 },
  'lines.special': { specials: 3 },
  'space.compact': { light: 1, modern: 1 },
  'space.open': { specials: 1, modern: 1 },
};

const ORDER: CollectionId[] = ['modern', 'light', 'classic', 'dark', 'specials'];

export function scoreStyle(answers: Record<string, string>): { collection: CollectionId; reasons: string[] } {
  const totals: Record<CollectionId, number> = { modern: 0, classic: 0, dark: 0, light: 0, specials: 0 };
  const contrib: Record<CollectionId, { key: string; v: number }[]> = { modern: [], classic: [], dark: [], light: [], specials: [] };
  for (const [q, a] of Object.entries(answers)) {
    const key = `${q}.${a}`;
    const sc = SCORES[key];
    if (!sc) continue;
    for (const [c, v] of Object.entries(sc) as [CollectionId, number][]) {
      totals[c] += v;
      contrib[c].push({ key, v });
    }
  }
  const best = [...ORDER].sort((a, b) => totals[b] - totals[a] || ORDER.indexOf(a) - ORDER.indexOf(b))[0];
  const reasons = contrib[best].sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.key);
  return { collection: best, reasons };
}

/** Brief lines in question order, from the dictionary's brief map. */
export function briefKeys(answers: Record<string, string>, order: string[]): string[] {
  return order.map((q) => `${q}.${answers[q]}`).filter(Boolean);
}
