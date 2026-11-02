'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { Dict } from '@/content/en';
import { href, type Locale } from '@/lib/i18n';
import { submitLead, validEmail, validPhone } from '@/lib/leads';
import { Icon } from '@/components/ui/Icon';
import s from './Pages.module.css';

export function ContactForm({ locale, t, common }: { locale: Locale; t: Dict['contact']['form']; common: Dict['common'] }) {
  const id = useId();
  const [f, setF] = useState({ topic: '', message: '', name: '', phone: '', email: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [ref, setRef] = useState('');
  const doneRef = useRef<HTMLDivElement>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  // The form collapses into a short note: bring it into view and move focus to it.
  useEffect(() => {
    if (state !== 'done' || !doneRef.current) return;
    doneRef.current.focus({ preventScroll: true });
    doneRef.current.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }, [state]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!f.name.trim()) errs.name = common.invalidName;
    if (!validPhone(f.phone)) errs.phone = common.invalidPhone;
    if (!validEmail(f.email)) errs.email = common.invalidEmail;
    if (!f.consent) errs.consent = common.consentRequired;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState('sending');
    const res = await submitLead('contact', { locale, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim() || undefined, project: f.topic || undefined, notes: f.message.trim() || undefined });
    setRef(res.ref);
    setState('done');
  };
  if (state === 'done') {
    return (
      <div className={s.note} role="status" style={{ padding: 28, outline: 'none' }} ref={doneRef} tabIndex={-1}>
        <Icon name="check" size={20} />
        <div>
          <p style={{ color: 'var(--ink)', marginBlockEnd: 6 }}>{t.success}</p>
          <p>
            {common.reference}: <span className="nums">{ref}</span>
          </p>
          <p className="example-tag" style={{ marginBlockStart: 10 }}>
            {t.sla}
          </p>
        </div>
      </div>
    );
  }
  const err = (k: string) =>
    errors[k] ? (
      <span className="error" id={`${id}-${k}-e`}>
        {errors[k]}
      </span>
    ) : null;
  return (
    <form onSubmit={submit} noValidate style={{ display: 'grid', gap: 16 }}>
      <h2 className={s.h2}>{t.title}</h2>
      <div className="field">
        <label htmlFor={`${id}-t`}>{t.topic}</label>
        <select id={`${id}-t`} value={f.topic} onChange={(e) => set('topic', e.target.value)}>
          <option value="">—</option>
          {t.topics.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${id}-m`}>{t.message}</label>
        <textarea id={`${id}-m`} value={f.message} maxLength={2000} onChange={(e) => set('message', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor={`${id}-name`}>{common.name}</label>
        <input id={`${id}-name`} autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-e` : undefined} />
        {err('name')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-phone`}>{common.phone}</label>
        <input id={`${id}-phone`} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${id}-phone-e` : undefined} />
        {err('phone')}
      </div>
      <div className="field">
        <label htmlFor={`${id}-email`}>
          {common.email} <span className="muted">({common.optional})</span>
        </label>
        <input id={`${id}-email`} type="email" dir="ltr" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-e` : undefined} />
        {err('email')}
      </div>
      <label className="check">
        <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} aria-invalid={!!errors.consent} />
        <span>
          {common.consent} <Link href={href(locale, '/privacy')}>{common.privacyLink}</Link>
        </span>
      </label>
      {errors.consent ? <span style={{ color: '#8d2f1f', fontSize: '0.8125rem' }}>{errors.consent}</span> : null}
      <div>
        <button type="submit" className="btn" disabled={state === 'sending'} data-magnetic>
          {state === 'sending' ? common.sending : t.submit}
        </button>
      </div>
    </form>
  );
}
