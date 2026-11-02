'use client';
import Link from 'next/link';
import { useId, useState } from 'react';
import type { Dict } from '@/content/en';
import { href, type Locale } from '@/lib/i18n';
import { submitLead, validEmail, validPhone, leadWhatsApp } from '@/lib/leads';
import { fmt } from '@/lib/fmt';
import { Icon } from '@/components/ui/Icon';
import s from './Pro.module.css';

type Tab = 'architects' | 'contractors';

/** Two professional entry points: project registration (architects) and project inquiry (contractors). */
export function ProForms({ locale, t, common }: { locale: Locale; t: Dict['pro']; common: Dict['common'] }) {
  const [tab, setTab] = useState<Tab>('architects');
  const id = useId();
  const tabs: Tab[] = ['architects', 'contractors'];
  return (
    <div className={s.forms}>
      <div className={s.tabs} role="tablist" aria-label={t.title}>
        {tabs.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`${id}-tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`${id}-panel-${k}`}
            tabIndex={tab === k ? 0 : -1}
            className={s.tab}
            onClick={() => setTab(k)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                e.preventDefault();
                const next = tab === 'architects' ? 'contractors' : 'architects';
                setTab(next);
                document.getElementById(`${id}-tab-${next}`)?.focus();
              }
            }}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel-architects`} aria-labelledby={`${id}-tab-architects`} hidden={tab !== 'architects'}>
        <LeadForm
          locale={locale}
          common={common}
          type="architect"
          title={t.architects.title}
          text={t.architects.text}
          submit={t.architects.submit}
          success={t.architects.success}
          fields={[
            { k: 'studio', label: t.architects.studio, auto: 'organization' },
            { k: 'license', label: t.architects.license, optional: true },
            { k: 'project', label: t.architects.project },
            { k: 'location', label: t.architects.location },
            { k: 'stage', label: t.architects.stage, options: t.architects.stages },
            { k: 'kitchens', label: t.architects.kitchens, type: 'number' },
            { k: 'timeline', label: t.architects.timeline, type: 'month', optional: true },
            { k: 'files', label: t.architects.files, type: 'file', hint: t.architects.filesNote, optional: true },
          ]}
        />
      </div>
      <div role="tabpanel" id={`${id}-panel-contractors`} aria-labelledby={`${id}-tab-contractors`} hidden={tab !== 'contractors'}>
        <LeadForm
          locale={locale}
          common={common}
          type="contractor"
          title={t.contractors.title}
          text={t.contractors.text}
          submit={t.contractors.submit}
          success={t.contractors.success}
          fields={[
            { k: 'company', label: t.contractors.company, auto: 'organization' },
            { k: 'project', label: t.contractors.project },
            { k: 'units', label: t.contractors.units, type: 'number' },
            { k: 'delivery', label: t.contractors.delivery, type: 'month', optional: true },
            { k: 'program', label: t.contractors.program, options: t.contractors.programs },
          ]}
        />
      </div>
    </div>
  );
}

interface FieldDef {
  k: string;
  label: string;
  type?: 'text' | 'number' | 'month' | 'file';
  options?: string[];
  optional?: boolean;
  hint?: string;
  auto?: string;
}

export function LeadForm({
  locale,
  common,
  type,
  title,
  text,
  submit,
  success,
  fields,
  extraHidden,
}: {
  locale: Locale;
  common: Dict['common'];
  type: 'architect' | 'contractor' | 'developer';
  title: string;
  text?: string;
  submit: string;
  success: string;
  fields: FieldDef[];
  extraHidden?: Record<string, string>;
}) {
  const id = useId();
  const [vals, setVals] = useState<Record<string, string>>({});
  const [contact, setContact] = useState({ name: '', phone: '', email: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [ref, setRef] = useState('');

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!contact.name.trim()) errs.name = common.invalidName;
    if (!validPhone(contact.phone)) errs.phone = common.invalidPhone;
    if (!validEmail(contact.email)) errs.email = common.invalidEmail;
    if (!contact.consent) errs.consent = common.consentRequired;
    setErrors(errs);
    if (Object.keys(errs).length) {
      document.getElementById(`${id}-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    setState('sending');
    const res = await submitLead(type, {
      locale,
      name: contact.name.trim(),
      phone: contact.phone.trim(),
      email: contact.email.trim() || undefined,
      project: vals.project || vals.stage || undefined,
      extra: { ...vals, ...extraHidden },
    });
    setRef(res.ref);
    setState('done');
  };

  if (state === 'done') {
    return (
      <div className={s.success} role="status">
        <Icon name="check" size={22} />
        <div>
          <p className={s.successTitle}>{success}</p>
          <p className="t-small muted">
            {common.reference}: <span className="nums">{ref}</span>
          </p>
          <a className="link-line t-small" href={leadWhatsApp([title, `${common.reference}: ${ref}`, contact.name])} target="_blank" rel="noopener noreferrer">
            {common.whatsappSend}
          </a>
        </div>
      </div>
    );
  }

  return (
    <form className={s.form} onSubmit={onSubmit} noValidate>
      <div className={s.formHead}>
        <h3 className={s.formTitle}>{title}</h3>
        {text ? <p className="muted">{text}</p> : null}
      </div>
      <div className={s.grid}>
        {fields.map((f) => (
          <div key={f.k} className={`field ${f.type === 'file' ? s.wide : ''}`}>
            <label htmlFor={`${id}-${f.k}`}>
              {f.label} {f.optional ? <span className="muted">({common.optional})</span> : null}
            </label>
            {f.options ? (
              <select id={`${id}-${f.k}`} value={vals[f.k] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [f.k]: e.target.value }))}>
                <option value="">—</option>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.type === 'file' ? (
              <input id={`${id}-${f.k}`} type="file" multiple accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png" onChange={(e) => setVals((v) => ({ ...v, [f.k]: Array.from(e.target.files || []).map((x) => x.name).join(', ') }))} />
            ) : (
              <input
                id={`${id}-${f.k}`}
                type={f.type ?? 'text'}
                inputMode={f.type === 'number' ? 'numeric' : undefined}
                min={f.type === 'number' ? 1 : undefined}
                autoComplete={f.auto}
                value={vals[f.k] ?? ''}
                onChange={(e) => setVals((v) => ({ ...v, [f.k]: e.target.value }))}
              />
            )}
            {f.hint ? <span className="hint">{f.hint}</span> : null}
          </div>
        ))}
        <div className="field">
          <label htmlFor={`${id}-name`}>{common.name}</label>
          <input id={`${id}-name`} autoComplete="name" value={contact.name} onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))} aria-invalid={!!errors.name} aria-describedby={errors.name ? `${id}-name-e` : undefined} />
          {errors.name ? (
            <span className="error" id={`${id}-name-e`}>
              {errors.name}
            </span>
          ) : null}
        </div>
        <div className="field">
          <label htmlFor={`${id}-phone`}>{common.phone}</label>
          <input id={`${id}-phone`} type="tel" inputMode="tel" dir="ltr" autoComplete="tel" value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? `${id}-phone-e` : undefined} />
          {errors.phone ? (
            <span className="error" id={`${id}-phone-e`}>
              {errors.phone}
            </span>
          ) : null}
        </div>
        <div className={`field ${s.wide}`}>
          <label htmlFor={`${id}-email`}>
            {common.email} <span className="muted">({common.optional})</span>
          </label>
          <input id={`${id}-email`} type="email" dir="ltr" autoComplete="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} aria-invalid={!!errors.email} aria-describedby={errors.email ? `${id}-email-e` : undefined} />
          {errors.email ? (
            <span className="error" id={`${id}-email-e`}>
              {errors.email}
            </span>
          ) : null}
        </div>
      </div>
      <label className="check">
        <input id={`${id}-consent`} type="checkbox" checked={contact.consent} onChange={(e) => setContact((c) => ({ ...c, consent: e.target.checked }))} aria-invalid={!!errors.consent} />
        <span>
          {common.consent} <Link href={href(locale, '/privacy')}>{common.privacyLink}</Link>
        </span>
      </label>
      {errors.consent ? <span className={s.err}>{errors.consent}</span> : null}
      <div>
        <button type="submit" className="btn" disabled={state === 'sending'} data-magnetic>
          {state === 'sending' ? common.sending : submit}
          {state === 'sending' ? null : <Icon name="arrow" className="arrow" />}
        </button>
      </div>
      <p className="t-small muted">{fmt(common.privacyNote, {})}</p>
    </form>
  );
}
