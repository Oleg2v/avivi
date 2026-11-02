'use client';
/** Cookie consent: necessary always; analytics and marketing only with consent. */
export interface Consent {
  analytics: boolean;
  marketing: boolean;
  ts: number;
}

const COOKIE = 'avivi_consent';

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|; )avivi_consent=([^;]*)/);
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(m[1])) as Consent;
  } catch {
    return null;
  }
}

export function writeConsent(c: Omit<Consent, 'ts'>) {
  const value: Consent = { ...c, ts: Date.now() };
  const maxAge = 60 * 60 * 24 * 180;
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${maxAge}; Path=/; SameSite=Lax`;
  if (!c.analytics) {
    // Remove analytics cookies immediately when consent is withdrawn.
    document.cookie.split('; ').forEach((kv) => {
      const name = kv.split('=')[0];
      if (/^_ga/.test(name)) document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${location.hostname.replace(/^www\./, '.')}`;
      if (/^_ga/.test(name)) document.cookie = `${name}=; Max-Age=0; Path=/`;
    });
  }
  window.dispatchEvent(new CustomEvent('avivi:consent', { detail: value }));
}
