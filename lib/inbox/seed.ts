/**
 * Example pipeline for the showroom inbox demo. Deterministic (seeded), relative to "now",
 * clearly labelled as example data in the UI. Real leads replace it once the store is connected.
 */
import { branchIds, type BranchId } from '@/lib/data/branches';
import { collectionIds, type CollectionId } from '@/lib/data/collections';

export type LeadStatus = 'new' | 'contacted' | 'scheduled' | 'visited';
export interface InboxLead {
  ref: string;
  type: string;
  createdAt: number;
  status: LeadStatus;
  source: 'example' | 'device' | 'live';
  payload: {
    name?: string;
    phone?: string;
    email?: string;
    city?: string;
    branch?: string;
    project?: string;
    date?: string;
    time?: string;
    notes?: string;
    attachments?: {
      visualisations?: { room: string; collection: string }[];
      plans?: { code: string; summary?: Record<string, unknown> }[];
      style?: { collection: string; brief?: string[] } | null;
      products?: string[];
    };
    extra?: Record<string, unknown>;
  };
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES_HE = ['נועה ב.', 'יוסי כ.', 'מאיה ר.', 'דניאל ש.', 'תמר ל.', 'עמית ג.', 'שירה א.', 'איתן מ.', 'מיכל ח.', 'אורי פ.', 'יעל ד.', 'אבי נ.', 'רוני ט.', 'ליאור ז.', 'דנה פ.', 'גל ו.'];
const NAMES_LATIN = ['Noa B.', 'Yossi K.', 'Maya R.', 'Daniel S.', 'Tamar L.', 'Amit G.', 'Shira A.', 'Eitan M.', 'Michal H.', 'Ori P.', 'Yael D.', 'Avi N.', 'Roni T.', 'Lior Z.', 'Dana F.', 'Gal V.'];
const PROJECTS = ['new', 'renovation', 'developer', 'architect'];
const BRANCH_W: Record<BranchId, number> = { rishon: 0.21, herzliya: 0.19, 'bnei-brak': 0.13, 'bnei-darom': 0.17, karmiel: 0.12, 'kiryat-ata': 0.18 };
const TYPE_W: [string, number][] = [
  ['booking', 0.56],
  ['style', 0.1],
  ['architect', 0.07],
  ['contractor', 0.04],
  ['developer', 0.07],
  ['service', 0.09],
  ['contact', 0.04],
  ['designer', 0.03],
];

function pick<T>(r: () => number, weighted: [T, number][]): T {
  let x = r() * weighted.reduce((s, [, w]) => s + w, 0);
  for (const [v, w] of weighted) {
    x -= w;
    if (x <= 0) return v;
  }
  return weighted[weighted.length - 1][0];
}

export function exampleLeads(now: number, locale: string, count = 84): InboxLead[] {
  const r = rng(1969);
  const names = locale === 'he' ? NAMES_HE : NAMES_LATIN;
  const out: InboxLead[] = [];
  const day = 86_400_000;
  for (let i = 0; i < count; i++) {
    const type = pick(r, TYPE_W);
    const age = Math.floor(Math.pow(r(), 1.3) * 28 * day);
    const createdAt = now - age - Math.floor(r() * 3_600_000);
    const branch = pick(r, branchIds.map((b) => [b, BRANCH_W[b]] as [BranchId, number]));
    const col = collectionIds[Math.floor(r() * collectionIds.length)] as CollectionId;
    const status: LeadStatus = age < 2 * day ? 'new' : pick(r, [['contacted', 0.35], ['scheduled', 0.35], ['visited', 0.3]] as [LeadStatus, number][]);
    const visitDate = new Date(createdAt + (2 + Math.floor(r() * 10)) * day);
    const payload: InboxLead['payload'] = {
      name: names[Math.floor(r() * names.length)],
      phone: `05${Math.floor(r() * 9)}-•••-••${String(Math.floor(r() * 90) + 10)}`,
    };
    if (type === 'booking') {
      payload.branch = branch;
      payload.project = PROJECTS[Math.floor(r() * PROJECTS.length)];
      payload.date = visitDate.toISOString().slice(0, 10);
      payload.time = ['10:00', '11:00', '12:00', '13:30', '15:00', '16:30', '18:00'][Math.floor(r() * 7)];
      const att: NonNullable<InboxLead['payload']['attachments']> = {};
      if (r() < 0.48) att.visualisations = [{ room: ['a', 'b', 'c'][Math.floor(r() * 3)], collection: col }];
      if (r() < 0.3) att.plans = [{ code: 'example', summary: { shape: ['L', 'U', 'island', 'straight'][Math.floor(r() * 4)], width: 300 + Math.floor(r() * 25) * 10, depth: 260 + Math.floor(r() * 20) * 10, collection: col } }];
      if (r() < 0.26) att.style = { collection: r() < 0.6 ? col : (collectionIds[Math.floor(r() * collectionIds.length)] as string) };
      payload.attachments = att;
    } else if (type === 'style') {
      payload.attachments = { style: { collection: col } };
    } else if (type === 'architect' || type === 'contractor') {
      payload.extra = { [type === 'architect' ? 'kitchens' : 'units']: String(4 + Math.floor(r() * 60)) };
    } else if (type === 'service') {
      payload.project = ['hinge', 'drawer', 'surface', 'appliance', 'lighting'][Math.floor(r() * 5)];
    }
    out.push({ ref: `EX-${(1000 + i).toString(36).toUpperCase()}`, type, createdAt, status, source: 'example', payload });
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}
