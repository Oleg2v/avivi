'use client';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Dict } from '@/content/en';
import { href, localeTag, type Locale } from '@/lib/i18n';
import { branches, exampleSlots, getBranch, mapsUrl, wazeUrl, type BranchId } from '@/lib/data/branches';
import { isCollectionId, type CollectionId } from '@/lib/data/collections';
import { decodePlan } from '@/lib/planner/engine';
import { useMyDesign } from '@/lib/store';
import { submitLead, validEmail, validPhone } from '@/lib/leads';
import { buildIcs, googleCalendarUrl, israelToUtc } from '@/lib/ics';
import { fmt } from '@/lib/fmt';
import { track } from '@/lib/analytics';
import { waLink } from '@/lib/site';
import { prefersReducedMotion } from '@/lib/motion';
import { IsraelMap } from '@/components/ui/IsraelMap';
import { Icon } from '@/components/ui/Icon';
import s from './Booking.module.css';

type ProjectId = keyof Dict['book']['projects'];
interface AttachItem {
  key: string;
  kind: 'vis' | 'plan' | 'style' | 'products';
  title: string;
  meta: string;
  thumb?: string;
  fromLink?: boolean;
  payload: Record<string, unknown>;
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function Booking({
  locale,
  t,
  common,
  sr,
  collectionNames,
  roomTitles,
  productNames,
  productsTitle,
  planShapes,
}: {
  locale: Locale;
  t: Dict['book'];
  common: Dict['common'];
  sr: Dict['showrooms'];
  collectionNames: Record<CollectionId, string>;
  roomTitles: Record<'a' | 'b' | 'c', string>;
  productNames: Record<string, string>;
  productsTitle: string;
  planShapes: Record<string, string>;
}) {
  const design = useMyDesign();
  const [branch, setBranch] = useState<BranchId | null>(null);
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [project, setProject] = useState<ProjectId | null>(null);
  const [interest, setInterest] = useState<CollectionId | null>(null);
  const [linkItems, setLinkItems] = useState<AttachItem[]>([]);
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ name: '', phone: '', email: '', city: '', notes: '', consent: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [missing, setMissing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [result, setResult] = useState<{ ref: string; ok: boolean } | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const dateRef = useRef<HTMLFieldSetElement>(null);
  const doneRef = useRef<HTMLDivElement>(null);
  const names = useMemo(() => Object.fromEntries(branches.map((b) => [b.id, sr.branches[b.id].name])) as Record<BranchId, string>, [sr]);

  // Read the link the visitor arrived with (?branch, ?collection, ?vis, ?plan, ?style, ?project).
  useEffect(() => {
    setNow(new Date());
    const q = new URLSearchParams(window.location.search);
    const b = getBranch(q.get('branch'));
    if (b) setBranch(b.id);
    const c = q.get('collection');
    if (isCollectionId(c)) setInterest(c);
    const p = q.get('project');
    if (p && p in t.projects) setProject(p as ProjectId);
    const items: AttachItem[] = [];
    const vis = q.get('vis');
    if (vis) {
      const [room, col] = vis.split(':');
      if (isCollectionId(col) && ['a', 'b', 'c', 'upload'].includes(room)) {
        items.push({
          key: `link-vis-${room}-${col}`,
          kind: 'vis',
          title: `${t.visualisation} · ${collectionNames[col]}`,
          meta: room === 'upload' ? '' : roomTitles[room as 'a' | 'b' | 'c'],
          thumb: room === 'upload' ? undefined : `/renders/room-${room}-${col}.webp`,
          fromLink: true,
          payload: { room, collection: col },
        });
        if (!c) setInterest(col);
      }
    }
    const code = q.get('plan');
    if (code) {
      const st = decodePlan(code);
      if (st) items.push({ key: `link-plan-${code}`, kind: 'plan', title: `${t.plan} · ${planShapes[st.shape] ?? st.shape}`, meta: `${st.width} × ${st.depth} cm`, fromLink: true, payload: { code, summary: { shape: st.shape, width: st.width, depth: st.depth, collection: st.collection } } });
    }
    setLinkItems(items);
  }, [t, collectionNames, roomTitles, planShapes]);

  const attachItems = useMemo<AttachItem[]>(() => {
    const out: AttachItem[] = [...linkItems];
    const has = (pred: (i: AttachItem) => boolean) => out.some(pred);
    for (const v of design.visualisations) {
      if (has((i) => i.kind === 'vis' && i.payload.room === v.room && i.payload.collection === v.collection)) continue;
      out.push({
        key: `vis-${v.id}`,
        kind: 'vis',
        title: `${t.visualisation} · ${collectionNames[v.collection]}`,
        meta: v.room === 'upload' ? '' : roomTitles[v.room],
        thumb: v.image || (v.room !== 'upload' ? `/renders/room-${v.room}-${v.collection}.webp` : undefined),
        payload: { room: v.room, collection: v.collection },
      });
    }
    for (const p of design.plans) {
      if (has((i) => i.kind === 'plan' && i.payload.code === p.code)) continue;
      out.push({ key: `plan-${p.id}`, kind: 'plan', title: `${t.plan} · ${planShapes[p.summary.shape] ?? p.summary.shape}`, meta: `${p.summary.width} × ${p.summary.depth} cm`, payload: { code: p.code, summary: p.summary } });
    }
    if (design.style) out.push({ key: 'style', kind: 'style', title: `${t.style} · ${collectionNames[design.style.collection]}`, meta: design.style.brief.slice(0, 2).join(' · '), payload: { collection: design.style.collection, brief: design.style.brief } });
    if (design.products.length)
      out.push({ key: 'products', kind: 'products', title: `${productsTitle} · ${design.products.length}`, meta: design.products.map((id) => productNames[id]).filter(Boolean).slice(0, 4).join(' · '), payload: { products: design.products } });
    return out;
  }, [linkItems, design, t, collectionNames, roomTitles, planShapes, productNames, productsTitle]);

  const selected = attachItems.filter((i) => !unchecked.has(i.key));

  const days = useMemo(() => {
    if (!now) return [];
    const list: { iso: string; date: Date; closed: boolean }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      list.push({ iso: isoOf(d), date: d, closed: d.getDay() === 6 });
    }
    return list;
  }, [now]);

  const tag = localeTag[locale];
  const fWeek = useMemo(() => new Intl.DateTimeFormat(tag, { weekday: 'short' }), [tag]);
  const fMonth = useMemo(() => new Intl.DateTimeFormat(tag, { month: 'short' }), [tag]);
  const fLong = useMemo(() => new Intl.DateTimeFormat(tag, { weekday: 'long', day: 'numeric', month: 'long' }), [tag]);
  const day = days.find((d) => d.iso === dateISO) || null;

  const slots = useMemo(() => {
    if (!day || !branch || !now) return [];
    return exampleSlots(day.date).map((slot) => {
      const [hh, mm] = slot.split(':').map(Number);
      const at = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate(), hh, mm);
      const past = at.getTime() < now.getTime() + 60 * 60 * 1000;
      const taken = hash(`${branch}|${day.iso}|${slot}`) % 4 === 0;
      return { slot, disabled: past || taken };
    });
  }, [day, branch, now]);

  useEffect(() => {
    if (time && !slots.find((x) => x.slot === time && !x.disabled)) setTime(null);
  }, [slots, time]);

  const pickBranch = (id: BranchId) => {
    setBranch(id);
    setMissing(false);
    track('booking_branch', { branch: id });
    if (!dateISO && window.matchMedia('(max-width: 999px)').matches) {
      window.setTimeout(() => dateRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }), 120);
    }
  };

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const b = branch ? getBranch(branch) : undefined;
  const branchName = branch ? names[branch] : '';
  const dateLabel = day ? fLong.format(day.date) : '';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = common.invalidName;
    if (!validPhone(form.phone)) errs.phone = common.invalidPhone;
    if (!validEmail(form.email)) errs.email = common.invalidEmail;
    if (!form.consent) errs.consent = common.consentRequired;
    setErrors(errs);
    const miss = !branch || !dateISO || !time;
    setMissing(miss);
    if (miss || Object.keys(errs).length) {
      const first = miss ? document.getElementById('bk-branch') : document.querySelector<HTMLElement>('[aria-invalid="true"]');
      first?.focus?.();
      if (miss) first?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    setStatus('sending');
    const vis = selected.filter((i) => i.kind === 'vis').map((i) => i.payload as { room: string; collection: string });
    const plans = selected.filter((i) => i.kind === 'plan').map((i) => i.payload as { code: string; summary: Record<string, unknown> });
    const style = selected.find((i) => i.kind === 'style')?.payload as { collection: string; brief: string[] } | undefined;
    const products = (selected.find((i) => i.kind === 'products')?.payload.products as string[] | undefined) ?? undefined;
    const res = await submitLead('booking', {
      locale,
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || undefined,
      city: form.city.trim() || undefined,
      branch: branch!,
      project: project || undefined,
      date: dateISO!,
      time: time!,
      notes: form.notes.trim() || undefined,
      attachments: { visualisations: vis, plans, style: style ?? null, products },
      extra: { interest: interest || undefined },
    });
    setResult(res);
    setStatus('done');
    track('booking_confirmed', { branch: branch!, project: project || 'none', attachments: selected.length });
    window.setTimeout(() => {
      doneRef.current?.focus();
      doneRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }, 50);
  };

  if (status === 'done' && result && b && dateISO && time) {
    const start = israelToUtc(dateISO, time);
    const title = fmt(t.calendarTitle, { branch: branchName });
    const description = [`${common.reference}: ${result.ref}`, project ? t.projects[project] : '', ...t.confirmed.bringList].filter(Boolean).join('\n');
    const location = locale === 'he' ? b.mapQuery.he : b.mapQuery.en;
    const ics = buildIcs({ title, description, location, start, minutes: 60, uid: result.ref });
    const icsHref = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    const gcal = googleCalendarUrl({ title, description, location, start, minutes: 60 });
    const wa = waLink(fmt(t.whatsappText, { branch: branchName, date: dateLabel, time, ref: result.ref }));
    return (
      <div className={s.done} ref={doneRef} tabIndex={-1} role="status">
        <p className="label accent">
          {common.reference} · <span className="nums">{result.ref}</span>
        </p>
        <h2 className={`display ${s.doneTitle}`}>{fmt(t.confirmed.title, { branch: branchName })}</h2>
        <p className="lead">{t.confirmed.text}</p>
        <dl className={s.doneFacts}>
          <div>
            <dt>{t.steps[1]}</dt>
            <dd>
              {dateLabel} · <span className="nums">{time}</span>
            </dd>
          </div>
          {project ? (
            <div>
              <dt>{t.steps[2]}</dt>
              <dd>{t.projects[project]}</dd>
            </div>
          ) : null}
          {selected.length ? (
            <div>
              <dt>{t.attachTitle}</dt>
              <dd>{selected.map((i) => i.title).join(' · ')}</dd>
            </div>
          ) : null}
        </dl>
        <div className={s.doneActions}>
          <a className="btn" href={icsHref} download="avivi-showroom-visit.ics" onClick={() => track('booking_ics')}>
            <Icon name="calendar" size={18} />
            {t.confirmed.calendar}
          </a>
          <a className="btn btn-ghost" href={gcal} target="_blank" rel="noopener noreferrer">
            {t.confirmed.google}
            <Icon name="external" size={16} />
          </a>
          <a className="btn btn-ghost" href={wa} target="_blank" rel="noopener noreferrer" onClick={() => track('booking_whatsapp')}>
            <Icon name="chat" size={18} />
            {t.confirmed.whatsapp}
          </a>
        </div>
        <div className={s.doneGrid}>
          <section>
            <h3 className="label muted">{t.confirmed.bring}</h3>
            <ul className={s.bring}>
              {t.confirmed.bringList.map((x) => (
                <li key={x}>
                  <Icon name="check" size={16} />
                  {x}
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="label muted">{t.directionsTitle}</h3>
            <p className={s.addr}>
              {branchName} · <span className="example-tag">{sr.addressToConfirm}</span>
            </p>
            <div className={s.links}>
              <a className="link-line" href={mapsUrl(b, locale)} target="_blank" rel="noopener noreferrer">
                {sr.directions}
              </a>
              <a className="link-line" href={wazeUrl(b)} target="_blank" rel="noopener noreferrer">
                {sr.waze}
              </a>
            </div>
            <p className={s.app}>
              <Link className="link-line" href={href(locale, '/app')}>
                {t.confirmed.app}
              </Link>
            </p>
          </section>
        </div>
        {!result.ok ? <p className="t-small muted">{common.demoNotice}</p> : null}
      </div>
    );
  }

  return (
    <form className={s.book} onSubmit={submit} noValidate>
      <div className={s.flow}>
        {/* 01 Showroom */}
        <fieldset className={s.step} id="bk-branch" tabIndex={-1}>
          <legend className={s.legend}>
            <span className="index-num">01</span>
            <span className={s.stepTitle}>{t.branch}</span>
          </legend>
          <div className={s.branchGrid}>
            <div className={s.mapBox}>
              <IsraelMap names={names} label={sr.mapLabel} selected={branch} onSelect={pickBranch} newLabel={sr.isNew} factoryLabel={sr.factory} focusable={false} />
            </div>
            <div className={s.branchList} role="radiogroup" aria-label={t.branch}>
              {branches.map((x) => (
                <label key={x.id} className={s.branch} data-on={branch === x.id ? '1' : undefined}>
                  <input type="radio" name="branch" value={x.id} checked={branch === x.id} onChange={() => pickBranch(x.id)} />
                  <span className={s.branchName}>
                    {names[x.id]}
                    {x.isNew ? <span className={s.tag}>{sr.isNew}</span> : null}
                  </span>
                  <span className={s.branchArea}>{sr.branches[x.id].area}</span>
                </label>
              ))}
            </div>
          </div>
        </fieldset>

        {/* 02 Day and time */}
        <fieldset className={s.step} ref={dateRef} disabled={!branch} data-off={!branch ? '1' : undefined}>
          <legend className={s.legend}>
            <span className="index-num">02</span>
            <span className={s.stepTitle}>{t.date}</span>
          </legend>
          <div className={s.days} role="radiogroup" aria-label={t.date} data-lenis-prevent>
            {days.map((d, i) => (
              <button
                key={d.iso}
                type="button"
                role="radio"
                aria-checked={dateISO === d.iso}
                aria-label={`${fLong.format(d.date)}${d.closed ? ` · ${t.closed}` : ''}`}
                className={s.day}
                disabled={d.closed}
                onClick={() => setDateISO(d.iso)}
              >
                <span className={s.dayWeek}>{i === 0 ? t.today : fWeek.format(d.date)}</span>
                <span className={`${s.dayNum} nums`}>{d.date.getDate()}</span>
                <span className={s.dayMonth}>{d.closed ? t.closed : fMonth.format(d.date)}</span>
              </button>
            ))}
          </div>
          {day ? (
            <div className={s.times}>
              <p className={s.sub} id="bk-times">
                {fmt(t.slotsFor, { date: dateLabel })}
              </p>
              <div className={s.slots} role="radiogroup" aria-labelledby="bk-times">
                {slots.map((x) => (
                  <button key={x.slot} type="button" role="radio" aria-checked={time === x.slot} className={`chip nums ${s.slot}`} disabled={x.disabled} aria-label={x.disabled ? `${x.slot} · ${t.taken}` : x.slot} onClick={() => setTime(x.slot)}>
                    {x.slot}
                  </button>
                ))}
              </div>
              <p className="example-tag">{t.slotsExample}</p>
            </div>
          ) : null}
        </fieldset>

        {/* 03 Project and attachments */}
        <fieldset className={s.step}>
          <legend className={s.legend}>
            <span className="index-num">03</span>
            <span className={s.stepTitle}>{t.project}</span>
          </legend>
          <div className={s.chips} role="radiogroup" aria-label={t.project}>
            {(Object.keys(t.projects) as ProjectId[]).map((p) => (
              <button key={p} type="button" role="radio" aria-checked={project === p} className="chip" onClick={() => setProject(project === p ? null : p)}>
                {t.projects[p]}
              </button>
            ))}
          </div>
          {interest ? (
            <p className={s.interest}>
              {t.interest}: <strong>{collectionNames[interest]}</strong>{' '}
              <button type="button" className={s.textBtn} onClick={() => setInterest(null)}>
                {common.remove}
              </button>
            </p>
          ) : null}

          <div className={s.attach}>
            <p className={s.sub}>{t.attachTitle}</p>
            {attachItems.length ? (
              <>
                <ul className={s.attachList}>
                  {attachItems.map((i) => (
                    <li key={i.key}>
                      <label className={s.attachItem}>
                        <input
                          type="checkbox"
                          checked={!unchecked.has(i.key)}
                          onChange={(e) =>
                            setUnchecked((u) => {
                              const n = new Set(u);
                              if (e.target.checked) n.delete(i.key);
                              else n.add(i.key);
                              return n;
                            })
                          }
                        />
                        {i.thumb ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={i.thumb} alt="" width={96} height={64} loading="lazy" />
                        ) : (
                          <span className={s.attachIcon} aria-hidden="true">
                            <Icon name={i.kind === 'plan' ? 'plus' : i.kind === 'products' ? 'bag' : 'sparkle'} size={18} />
                          </span>
                        )}
                        <span className={s.attachText}>
                          <span>{i.title}</span>
                          {i.meta || i.fromLink ? <span className={s.attachMeta}>{[i.meta, i.fromLink ? t.fromLink : ''].filter(Boolean).join(' · ')}</span> : null}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="t-small muted">{t.attachedNote}</p>
              </>
            ) : (
              <p className="t-small muted">{t.attachNone}</p>
            )}
            <div className={s.links}>
              <Link className="link-line" href={href(locale, '/visualiser')}>
                {t.attachLinks.visualiser}
              </Link>
              <Link className="link-line" href={href(locale, '/planner')}>
                {t.attachLinks.planner}
              </Link>
              <Link className="link-line" href={href(locale, '/style-finder')}>
                {t.attachLinks.style}
              </Link>
            </div>
          </div>
        </fieldset>

        {/* 04 Details */}
        <fieldset className={s.step}>
          <legend className={s.legend}>
            <span className="index-num">04</span>
            <span className={s.stepTitle}>{t.details}</span>
          </legend>
          <div className={s.fields}>
            <div className="field">
              <label htmlFor="bk-name">{common.name}</label>
              <input id="bk-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} aria-invalid={!!errors.name} aria-describedby={errors.name ? 'bk-name-e' : undefined} />
              {errors.name ? (
                <span className="error" id="bk-name-e">
                  {errors.name}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="bk-phone">{common.phone}</label>
              <input id="bk-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={form.phone} onChange={(e) => set('phone', e.target.value)} aria-invalid={!!errors.phone} aria-describedby={errors.phone ? 'bk-phone-e' : undefined} />
              {errors.phone ? (
                <span className="error" id="bk-phone-e">
                  {errors.phone}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="bk-email">
                {common.email} <span className="muted">({common.optional})</span>
              </label>
              <input id="bk-email" type="email" autoComplete="email" dir="ltr" value={form.email} onChange={(e) => set('email', e.target.value)} aria-invalid={!!errors.email} aria-describedby={errors.email ? 'bk-email-e' : undefined} />
              {errors.email ? (
                <span className="error" id="bk-email-e">
                  {errors.email}
                </span>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="bk-city">
                {common.city} <span className="muted">({common.optional})</span>
              </label>
              <input id="bk-city" autoComplete="address-level2" value={form.city} onChange={(e) => set('city', e.target.value)} />
            </div>
            <div className={`field ${s.wide}`}>
              <label htmlFor="bk-notes">
                {common.notes} <span className="muted">({common.optional})</span>
              </label>
              <textarea id="bk-notes" value={form.notes} maxLength={1500} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={form.consent} onChange={(e) => set('consent', e.target.checked)} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'bk-consent-e' : undefined} />
            <span>
              {common.consent}{' '}
              <Link href={href(locale, '/privacy')}>{common.privacyLink}</Link>
            </span>
          </label>
          {errors.consent ? (
            <span className="error t-small" id="bk-consent-e" style={{ color: '#8d2f1f' }}>
              {errors.consent}
            </span>
          ) : null}
          <p className="t-small muted">{common.privacyNote}</p>
        </fieldset>
      </div>

      {/* Summary */}
      <aside className={s.summary} aria-labelledby="bk-sum">
        <h2 id="bk-sum" className="label muted">
          {t.summary}
        </h2>
        <dl className={s.sumList}>
          <div data-empty={!branch ? '1' : undefined}>
            <dt>{t.steps[0]}</dt>
            <dd>{branchName || '—'}</dd>
          </div>
          <div data-empty={!dateISO || !time ? '1' : undefined}>
            <dt>{t.steps[1]}</dt>
            <dd>{day ? `${dateLabel}${time ? ` · ${time}` : ''}` : '—'}</dd>
          </div>
          <div data-empty={!project ? '1' : undefined}>
            <dt>{t.steps[2]}</dt>
            <dd>
              {project ? t.projects[project] : '—'}
              {interest ? ` · ${collectionNames[interest]}` : ''}
            </dd>
          </div>
          <div data-empty={!selected.length ? '1' : undefined}>
            <dt>{t.attachTitle}</dt>
            <dd className="nums">{selected.length || '—'}</dd>
          </div>
        </dl>
        {missing ? (
          <p className={s.missing} role="alert">
            {t.missing}
          </p>
        ) : null}
        <button type="submit" className="btn btn-block" disabled={status === 'sending'} data-magnetic>
          {status === 'sending' ? common.sending : t.confirm}
          {status === 'sending' ? null : <Icon name="arrow" className="arrow" />}
        </button>
      </aside>
    </form>
  );
}
