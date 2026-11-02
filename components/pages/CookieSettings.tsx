'use client';
import { useEffect, useState } from 'react';
import type { Dict } from '@/content/en';
import { readConsent, writeConsent } from '@/lib/consent';
import { designStore } from '@/lib/store';
import s from './Pages.module.css';

/** Working cookie settings: reads and writes the consent cookie, and can clear the saved design. */
export function CookieSettings({ t }: { t: Dict['cookies'] }) {
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    const c = readConsent();
    if (c) {
      setAnalytics(c.analytics);
      setMarketing(c.marketing);
    }
  }, []);
  const row = (key: 'necessary' | 'analytics' | 'marketing', on: boolean, set?: (v: boolean) => void) => (
    <div className={s.card} style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 className={s.cardTitle} id={`ck-${key}`}>
          {t.categories[key].title}
        </h2>
        <p className="muted t-small">{t.categories[key].text}</p>
      </div>
      {set ? (
        <button type="button" role="switch" aria-checked={on} aria-labelledby={`ck-${key}`} className="switch" onClick={() => set(!on)}>
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
          <span className="switch-label">{on ? t.on : t.off}</span>
        </button>
      ) : (
        <span className="example-tag" style={{ borderStyle: 'solid' }}>
          {t.alwaysOn}
        </span>
      )}
    </div>
  );
  return (
    <div style={{ display: 'grid', gap: 14, maxInlineSize: 760, paddingBlockEnd: 'var(--section)' }}>
      {row('necessary', true)}
      {row('analytics', analytics, setAnalytics)}
      {row('marketing', marketing, setMarketing)}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginBlockStart: 10 }}>
        <button
          type="button"
          className="btn"
          onClick={() => {
            writeConsent({ analytics, marketing });
            setMsg(t.saved);
          }}
        >
          {t.save}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            designStore.clearDesign();
            setMsg(t.cleared);
          }}
        >
          {t.clearDesign}
        </button>
      </div>
      <p role="status" className="t-small" style={{ minBlockSize: '1.5em' }}>
        {msg}
      </p>
    </div>
  );
}
