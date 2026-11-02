'use client';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import type { Dict } from '@/content/en';
import { href, type Locale } from '@/lib/i18n';
import { submitLead, validPhone, leadWhatsApp } from '@/lib/leads';
import { fmt } from '@/lib/fmt';
import { site } from '@/lib/site';
import { Icon } from '@/components/ui/Icon';
import s from './Service.module.css';

/** Guided service request: what happened, which kitchen, how to reach you. */
export function ServiceForm({ locale, t, common }: { locale: Locale; t: Dict['service']; common: Dict['common'] }) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [topic, setTopic] = useState('');
  const [describe, setDescribe] = useState('');
  const [photo, setPhoto] = useState('');
  const [order, setOrder] = useState('');
  const [city, setCity] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [when, setWhen] = useState('');
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [ref, setRef] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const topicLabel = t.topics.find((x) => x.id === topic)?.label ?? '';

  const focusTop = () => window.setTimeout(() => box.current?.querySelector<HTMLElement>('h3, [data-focus]')?.focus(), 30);

  const next = () => {
    const errs: Record<string, string> = {};
    if (step === 0 && !topic) errs.topic = t.topic;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setStep((v) => Math.min(2, v + 1));
    focusTop();
  };

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 2) return next();
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = common.invalidName;
    if (!validPhone(phone)) errs.phone = common.invalidPhone;
    if (!consent) errs.consent = common.consentRequired;
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setState('sending');
    const res = await submitLead('service', {
      locale,
      name: name.trim(),
      phone: phone.trim(),
      city: city.trim() || undefined,
      notes: describe.trim() || undefined,
      project: topicLabel || undefined,
      extra: { topic, order: order.trim() || undefined, when: when || undefined, photo: photo || undefined },
    });
    setRef(res.ref);
    setState('done');
    focusTop();
  };

  if (state === 'done') {
    return (
      <div className={s.done} ref={box} role="status">
        <h3 tabIndex={-1} className={s.doneTitle}>
          {t.success.title}
        </h3>
        <p className="lead">{fmt(t.success.text, { ref })}</p>
        <div className={s.row}>
          <a className="btn btn-ghost" href={`tel:${site.servicePhone.tel}`}>
            <Icon name="phone" size={18} /> {site.servicePhone.display}
          </a>
          <a className="btn btn-ghost" href={leadWhatsApp([t.title, `${common.reference}: ${ref}`, topicLabel, describe])} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={18} /> {common.whatsappSend}
          </a>
        </div>
        {site.servicePhone.example ? <p className="t-small muted">{common.exampleNumber}</p> : null}
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={send} noValidate>
      <ol className={s.steps}>
        {t.steps.map((label, i) => (
          <li key={label} data-state={i < step ? 'done' : i === step ? 'now' : 'next'} aria-current={i === step ? 'step' : undefined}>
            <span className="index-num">{String(i + 1).padStart(2, '0')}</span> {label}
          </li>
        ))}
      </ol>
      <div ref={box} className={s.panel}>
        {step === 0 ? (
          <>
            <h3 tabIndex={-1} className={s.h} id={`${id}-topic`}>
              {t.topic}
            </h3>
            <div className={s.topics} role="radiogroup" aria-labelledby={`${id}-topic`}>
              {t.topics.map((x) => (
                <button key={x.id} type="button" role="radio" aria-checked={topic === x.id} className="chip" onClick={() => setTopic(x.id)}>
                  {x.label}
                </button>
              ))}
            </div>
            {errors.topic ? <span className={s.err}>{errors.topic}</span> : null}
            <div className="field">
              <label htmlFor={`${id}-d`}>{t.describe}</label>
              <textarea id={`${id}-d`} value={describe} maxLength={1500} onChange={(e) => setDescribe(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor={`${id}-ph`}>
                {t.photo} <span className="muted">({common.optional})</span>
              </label>
              <input id={`${id}-ph`} type="file" accept="image/*" capture="environment" onChange={(e) => setPhoto(e.target.files?.[0]?.name ?? '')} />
              <span className="hint">{t.photoNote}</span>
            </div>
          </>
        ) : step === 1 ? (
          <>
            <h3 tabIndex={-1} className={s.h}>
              {t.steps[1]}
            </h3>
            <div className="field">
              <label htmlFor={`${id}-o`}>
                {t.order} <span className="muted">({common.optional})</span>
              </label>
              <input id={`${id}-o`} dir="ltr" value={order} onChange={(e) => setOrder(e.target.value)} aria-describedby={`${id}-oh`} />
              <span className="hint" id={`${id}-oh`}>
                {t.orderHint}
              </span>
            </div>
            <div className="field">
              <label htmlFor={`${id}-c`}>
                {common.city} <span className="muted">({common.optional})</span>
              </label>
              <input id={`${id}-c`} autoComplete="address-level2" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <h3 tabIndex={-1} className={s.h}>
              {t.steps[2]}
            </h3>
            <div className={s.grid}>
              <div className="field">
                <label htmlFor={`${id}-n`}>{common.name}</label>
                <input id={`${id}-n`} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-ne` : undefined} />
                {errors.name ? (
                  <span className="error" id={`${id}-ne`}>
                    {errors.name}
                  </span>
                ) : null}
              </div>
              <div className="field">
                <label htmlFor={`${id}-p`}>{common.phone}</label>
                <input id={`${id}-p`} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${id}-pe` : undefined} />
                {errors.phone ? (
                  <span className="error" id={`${id}-pe`}>
                    {errors.phone}
                  </span>
                ) : null}
              </div>
            </div>
            <p className={s.h4} id={`${id}-when`}>
              {t.when}
            </p>
            <div className={s.topics} role="radiogroup" aria-labelledby={`${id}-when`}>
              {t.times.map((x) => (
                <button key={x} type="button" role="radio" aria-checked={when === x} className="chip" onClick={() => setWhen(when === x ? '' : x)}>
                  {x}
                </button>
              ))}
            </div>
            <label className="check">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={!!errors.consent} />
              <span>
                {common.consent} <Link href={href(locale, '/privacy')}>{common.privacyLink}</Link>
              </span>
            </label>
            {errors.consent ? <span className={s.err}>{errors.consent}</span> : null}
          </>
        )}
      </div>
      <div className={s.row}>
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep((v) => v - 1)}>
            {common.back}
          </button>
        ) : null}
        {step < 2 ? (
          <button type="button" className="btn" onClick={next}>
            {common.next}
            <Icon name="arrow" className="arrow" />
          </button>
        ) : (
          <button type="submit" className="btn" disabled={state === 'sending'} data-magnetic>
            {state === 'sending' ? common.sending : t.submit}
          </button>
        )}
      </div>
    </form>
  );
}
