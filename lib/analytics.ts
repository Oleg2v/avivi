'use client';
/**
 * Analytics, consent-gated. With NEXT_PUBLIC_GA_ID and analytics consent, events go to GA4.
 * Without it (demo), the last events are kept in sessionStorage so the flow can be shown.
 */
import { readConsent } from './consent';

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let loaded = false;

export function loadAnalytics() {
  const id = process.env.NEXT_PUBLIC_GA_ID;
  const consent = readConsent();
  if (loaded || !id || !consent?.analytics) return;
  loaded = true;
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', id, { anonymize_ip: true });
}

export function track(event: string, params: Params = {}) {
  const consent = readConsent();
  if (!consent?.analytics) return;
  if (window.gtag) {
    window.gtag('event', event, params);
    return;
  }
  try {
    const key = 'avivi-events';
    const list = JSON.parse(sessionStorage.getItem(key) || '[]') as unknown[];
    list.unshift({ event, params, t: Date.now() });
    sessionStorage.setItem(key, JSON.stringify(list.slice(0, 50)));
  } catch {
    /* ignore */
  }
}
