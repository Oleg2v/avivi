import 'server-only';
/**
 * Lead pipeline (server). Each lead is forwarded to LEAD_WEBHOOK_URL (CRM, Make, Zapier…)
 * and stored either in Upstash/Vercel KV Redis (if configured) or in memory (demo).
 */
export interface StoredLead {
  ref: string;
  type: string;
  createdAt: number;
  status: 'new' | 'contacted' | 'scheduled' | 'visited';
  payload: Record<string, unknown>;
}

const g = globalThis as unknown as { __aviviLeads?: StoredLead[] };
const memory: StoredLead[] = (g.__aviviLeads ||= []);

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '';
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || '';
const KEY = process.env.LEADS_REDIS_KEY || 'avivi:leads';

export const storeKind: 'redis' | 'memory' = REDIS_URL && REDIS_TOKEN ? 'redis' : 'memory';

async function redis<T = unknown>(command: (string | number)[]): Promise<T | null> {
  try {
    const res = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(command),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: T };
    return json.result ?? null;
  } catch {
    return null;
  }
}

export async function saveLead(lead: StoredLead): Promise<'redis' | 'memory'> {
  if (storeKind === 'redis') {
    const ok = await redis(['LPUSH', KEY, JSON.stringify(lead)]);
    if (ok !== null) {
      await redis(['LTRIM', KEY, 0, 1999]);
      return 'redis';
    }
  }
  memory.unshift(lead);
  if (memory.length > 500) memory.length = 500;
  return 'memory';
}

export async function listLeads(): Promise<StoredLead[]> {
  if (storeKind === 'redis') {
    const rows = await redis<string[]>(['LRANGE', KEY, 0, 499]);
    if (rows) {
      return rows
        .map((r) => {
          try {
            return JSON.parse(r) as StoredLead;
          } catch {
            return null;
          }
        })
        .filter((x): x is StoredLead => !!x);
    }
  }
  return memory.slice();
}

export async function forwardToWebhook(lead: StoredLead): Promise<boolean> {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.LEAD_WEBHOOK_SECRET ? { 'x-avivi-signature': process.env.LEAD_WEBHOOK_SECRET } : {}),
      },
      body: JSON.stringify({ source: 'avivi-concept', ...lead }),
      signal: ctrl.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
