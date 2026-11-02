'use client';
/**
 * Client lead submission. Every lead posts to /api/lead (which forwards to the CRM webhook)
 * and is also kept on this device so the demo inbox can show it.
 */
import { designStore } from './store';
import { refCode } from './fmt';
import { track } from './analytics';
import { waLink } from './site';

export type LeadType = 'booking' | 'architect' | 'contractor' | 'developer' | 'service' | 'contact' | 'style' | 'designer';

export interface LeadAttachments {
  visualisations?: { room: string; collection: string; thumb?: string }[];
  plans?: { code: string; summary: Record<string, unknown> }[];
  style?: { collection: string; brief: string[] } | null;
  products?: string[];
}

export interface LeadInput {
  locale: string;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  branch?: string;
  project?: string;
  date?: string;
  time?: string;
  notes?: string;
  attachments?: LeadAttachments;
  extra?: Record<string, string | number | boolean | undefined>;
}

export async function submitLead(type: LeadType, input: LeadInput): Promise<{ ok: boolean; ref: string }> {
  const ref = refCode(type === 'service' ? 'SR' : type === 'booking' ? 'AV' : 'LD');
  let ok = false;
  let serverRef = ref;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ type, ref, source: location.pathname, ...input }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; ref?: string };
    ok = res.ok && !!json.ok;
    if (json.ref) serverRef = json.ref;
  } catch {
    ok = false;
  }
  designStore.addLead({ ref: serverRef, type, createdAt: Date.now(), payload: { ...input } as Record<string, unknown> });
  track('lead_submit', { type, ok });
  return { ok, ref: serverRef };
}

/** Pre-filled WhatsApp handoff with the lead details. */
export function leadWhatsApp(lines: (string | undefined | false)[]): string {
  return waLink(lines.filter(Boolean).join('\n'));
}

export function validPhone(v: string): boolean {
  const digits = v.replace(/[^\d]/g, '');
  return digits.length >= 9 && digits.length <= 15 && /^[\d\s()+\-]+$/.test(v.trim());
}

export function validEmail(v: string): boolean {
  return !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}
