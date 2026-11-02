'use client';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dict } from '@/content/en';
import { href, localeTag, type Locale } from '@/lib/i18n';
import { branchIds } from '@/lib/data/branches';
import { collectionIds, isCollectionId, type CollectionId } from '@/lib/data/collections';
import { useMyDesign } from '@/lib/store';
import { exampleLeads, type InboxLead, type LeadStatus } from '@/lib/inbox/seed';
import { Icon } from '@/components/ui/Icon';
import { BarChart } from './BarChart';
import s from './Inbox.module.css';

const STATUS_KEY = 'avivi-inbox-status-v1';
const STATUSES: LeadStatus[] = ['new', 'contacted', 'scheduled', 'visited'];

function attachCount(l: InboxLead) {
  const a = l.payload.attachments;
  if (!a) return 0;
  return (a.visualisations?.length || 0) + (a.plans?.length || 0) + (a.style ? 1 : 0);
}

function collectionsOf(l: InboxLead): string[] {
  const a = l.payload.attachments;
  const out = new Set<string>();
  a?.visualisations?.forEach((v) => out.add(v.collection));
  if (a?.style?.collection) out.add(a.style.collection);
  const interest = l.payload.extra?.interest;
  if (typeof interest === 'string') out.add(interest);
  return [...out].filter((c) => isCollectionId(c));
}

export function Inbox({
  locale,
  t,
  branchNames,
  collectionNames,
  projectNames,
  topicNames,
}: {
  locale: Locale;
  t: Dict['inbox'];
  branchNames: Record<string, string>;
  collectionNames: Record<CollectionId, string>;
  projectNames: Record<string, string>;
  topicNames: Record<string, string>;
}) {
  const [auth, setAuth] = useState<'checking' | 'login' | 'in'>('checking');
  const [demo, setDemo] = useState(false);
  const [live, setLive] = useState(false);
  const [serverLeads, setServerLeads] = useState<InboxLead[]>([]);
  const [password, setPassword] = useState('');
  const [wrong, setWrong] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typeF, setTypeF] = useState('all');
  const [branchF, setBranchF] = useState('all');
  const [q, setQ] = useState('');
  const [overrides, setOverrides] = useState<Record<string, LeadStatus>>({});
  const [open, setOpen] = useState<InboxLead | null>(null);
  const [now, setNow] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const design = useMyDesign();

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox', { cache: 'no-store' });
      const j = (await res.json()) as { ok: boolean; demo?: boolean; live?: boolean; leads?: { ref: string; type: string; createdAt: number; status: LeadStatus; payload: InboxLead['payload'] }[] };
      if (res.ok && j.ok) {
        setLive(!!j.live);
        setServerLeads((j.leads || []).map((l) => ({ ...l, source: 'live' as const })));
        setAuth('in');
      } else {
        setDemo(!!j.demo);
        setAuth('login');
      }
    } catch {
      setAuth('login');
    }
  }, []);

  useEffect(() => {
    setNow(Date.now());
    try {
      setOverrides(JSON.parse(window.localStorage.getItem(STATUS_KEY) || '{}'));
    } catch {
      /* ignore */
    }
    void load();
  }, [load]);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setWrong(false);
    try {
      const res = await fetch('/api/inbox/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password }) });
      const j = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (res.ok && j.ok) {
        setPassword('');
        await load();
      } else setWrong(true);
    } catch {
      setWrong(true);
    } finally {
      setBusy(false);
    }
  };

  const logout = async () => {
    await fetch('/api/inbox/logout', { method: 'POST' }).catch(() => undefined);
    setServerLeads([]);
    setAuth('login');
  };

  const all = useMemo<InboxLead[]>(() => {
    if (!now) return [];
    const device: InboxLead[] = design.leads.map((l) => ({ ref: l.ref, type: l.type, createdAt: l.createdAt, status: 'new', source: 'device', payload: l.payload as InboxLead['payload'] }));
    const ids = new Set(serverLeads.map((l) => l.ref));
    const merged = [...serverLeads, ...device.filter((l) => !ids.has(l.ref))];
    const withExamples = !live || serverLeads.length === 0 ? [...merged, ...exampleLeads(now, locale)] : merged;
    return withExamples.map((l) => ({ ...l, status: overrides[l.ref] ?? l.status })).sort((a, b) => b.createdAt - a.createdAt);
  }, [now, design.leads, serverLeads, live, locale, overrides]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((l) => {
      if (typeF !== 'all' && l.type !== typeF) return false;
      if (branchF !== 'all' && l.payload.branch !== branchF) return false;
      if (needle && ![l.payload.name, l.ref, l.payload.notes, l.payload.city].filter(Boolean).join(' ').toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [all, typeF, branchF, q]);

  const kpi = useMemo(() => {
    const bookings = filtered.filter((l) => l.type === 'booking');
    const withDesign = bookings.filter((l) => attachCount(l) > 0).length;
    return {
      meetings: bookings.length,
      withDesign: bookings.length ? withDesign / bookings.length : 0,
      visualisations: filtered.reduce((n, l) => n + (l.payload.attachments?.visualisations?.length || 0), 0),
      plans: filtered.reduce((n, l) => n + (l.payload.attachments?.plans?.length || 0), 0),
      style: filtered.filter((l) => l.type === 'style').length,
      architects: filtered.filter((l) => l.type === 'architect').length,
      contractors: filtered.filter((l) => l.type === 'contractor').length,
      service: filtered.filter((l) => l.type === 'service').length,
    };
  }, [filtered]);

  const byBranch = useMemo(
    () => branchIds.map((b) => ({ key: b, label: branchNames[b], value: filtered.filter((l) => l.type === 'booking' && l.payload.branch === b).length })),
    [filtered, branchNames],
  );
  const byCollection = useMemo(
    () => collectionIds.map((c) => ({ key: c, label: collectionNames[c as CollectionId], value: filtered.filter((l) => collectionsOf(l).includes(c)).length })),
    [filtered, collectionNames],
  );

  const setStatus = (ref: string, st: LeadStatus) => {
    const next = { ...overrides, [ref]: st };
    setOverrides(next);
    try {
      window.localStorage.setItem(STATUS_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setOpen((o) => (o && o.ref === ref ? { ...o, status: st } : o));
  };

  const exportCsv = () => {
    const head = ['ref', 'received', 'type', 'source', 'branch', 'name', 'phone', 'email', 'city', 'project', 'visit_date', 'visit_time', 'attachments', 'collections', 'status', 'notes'];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = filtered.map((l) =>
      [l.ref, new Date(l.createdAt).toISOString(), l.type, l.source, l.payload.branch, l.payload.name, l.payload.phone, l.payload.email, l.payload.city, l.payload.project, l.payload.date, l.payload.time, attachCount(l), collectionsOf(l).join(' '), l.status, l.payload.notes]
        .map(esc)
        .join(','),
    );
    const blob = new Blob([`﻿${head.join(',')}\n${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `avivi-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const fDate = useMemo(() => new Intl.DateTimeFormat(localeTag[locale], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }), [locale]);
  const fDay = useMemo(() => new Intl.DateTimeFormat(localeTag[locale], { weekday: 'short', day: 'numeric', month: 'short' }), [locale]);
  const nf = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const pf = useMemo(() => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }), [locale]);
  const projectLabel = (l: InboxLead) => (l.payload.project ? projectNames[l.payload.project] || topicNames[l.payload.project] || l.payload.project : '—');

  if (auth !== 'in') {
    return (
      <div className={s.loginWrap}>
        <form className={s.login} onSubmit={login} aria-busy={auth === 'checking'}>
          <p className="label accent">{t.subtitle}</p>
          <h1 className={s.loginTitle}>{t.login.title}</h1>
          <p className="muted">{t.login.text}</p>
          <div className="field">
            <label htmlFor="inbox-pw">{t.login.password}</label>
            <input id="inbox-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={wrong} aria-describedby={wrong ? 'inbox-pw-e' : undefined} disabled={auth === 'checking'} />
            {wrong ? (
              <span className="error" id="inbox-pw-e" role="alert">
                {t.login.wrong}
              </span>
            ) : null}
          </div>
          <button type="submit" className="btn btn-block" disabled={busy || auth === 'checking' || !password}>
            {t.login.submit}
          </button>
          <p className="t-small muted">{demo ? t.demoHint : t.login.hint}</p>
        </form>
      </div>
    );
  }

  const kpis: [keyof typeof kpi, string][] = [
    ['meetings', t.kpis.meetings],
    ['withDesign', t.kpis.withDesign],
    ['visualisations', t.kpis.visualisations],
    ['plans', t.kpis.plans],
    ['style', t.kpis.style],
    ['architects', t.kpis.architects],
    ['contractors', t.kpis.contractors],
    ['service', t.kpis.service],
  ];

  return (
    <div className={s.inbox}>
      <header className={s.top}>
        <div>
          <p className="label accent">{t.subtitle}</p>
          <h1 className={s.title}>{t.title}</h1>
          <p className="t-small muted">{live && serverLeads.length ? t.liveData : t.demoData}</p>
        </div>
        <div className={s.topActions}>
          <button type="button" className="btn btn-small btn-ghost" onClick={exportCsv}>
            <Icon name="download" size={16} /> {t.export}
          </button>
          <button type="button" className="btn btn-small btn-ghost" onClick={() => void logout()}>
            {t.logout}
          </button>
        </div>
      </header>

      <div className={s.filters} role="group" aria-label={`${t.filterType} · ${t.filterBranch}`}>
        <label>
          <span>{t.filterType}</span>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)}>
            <option value="all">{t.all}</option>
            {Object.entries(t.types).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.filterBranch}</span>
          <select value={branchF} onChange={(e) => setBranchF(e.target.value)}>
            <option value="all">{t.all}</option>
            {branchIds.map((b) => (
              <option key={b} value={b}>
                {branchNames[b]}
              </option>
            ))}
          </select>
        </label>
        <label className={s.search}>
          <span>{t.search}</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <dl className={s.kpis}>
        {kpis.map(([k, label]) => (
          <div key={k} className={s.kpi}>
            <dt>{label}</dt>
            <dd>{k === 'withDesign' ? pf.format(kpi[k]) : nf.format(kpi[k])}</dd>
          </div>
        ))}
      </dl>

      <div className={s.charts}>
        <BarChart title={t.byBranch} data={byBranch} locale={locale} labels={{ tableView: t.tableView, share: t.share, count: t.count, empty: t.emptySelection }} />
        <BarChart title={t.byCollection} data={byCollection} locale={locale} labels={{ tableView: t.tableView, share: t.share, count: t.count, empty: t.emptySelection }} />
      </div>

      <div className={s.tableWrap} data-lenis-prevent>
        <table className={s.table}>
          <thead>
            <tr>
              <th scope="col">{t.table.when}</th>
              <th scope="col">{t.table.type}</th>
              <th scope="col">{t.table.branch}</th>
              <th scope="col">{t.table.name}</th>
              <th scope="col">{t.table.project}</th>
              <th scope="col">{t.table.attached}</th>
              <th scope="col">{t.table.status}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 200).map((l) => (
              <tr key={l.ref} data-source={l.source}>
                <td className="nums">{fDate.format(new Date(l.createdAt))}</td>
                <td>
                  {t.types[l.type as keyof typeof t.types] ?? l.type}
                  {l.source !== 'example' ? <span className={s.src}>{l.source === 'device' ? t.localTag : t.serverTag}</span> : null}
                </td>
                <td>{l.payload.branch ? branchNames[l.payload.branch] ?? l.payload.branch : '—'}</td>
                <td>
                  <button type="button" className={s.rowBtn} onClick={() => setOpen(l)}>
                    {l.payload.name || l.ref}
                  </button>
                </td>
                <td>{projectLabel(l)}</td>
                <td className="nums">{attachCount(l) || '—'}</td>
                <td>
                  <span className={s.status} data-s={l.status}>
                    {t.statuses[l.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? <p className={s.empty}>{t.emptySelection}</p> : null}
      </div>

      <dialog ref={dialogRef} className={s.dialog} onClose={() => setOpen(null)} aria-labelledby="lead-title">
        {open ? (
          <div className={s.detail}>
            <div className={s.detailHead}>
              <div>
                <p className="label accent">
                  {t.types[open.type as keyof typeof t.types] ?? open.type} · <span className="nums">{open.ref}</span>
                </p>
                <h2 id="lead-title" className={s.detailTitle}>
                  {open.payload.name || t.detail}
                </h2>
                <p className="t-small muted">
                  {fDate.format(new Date(open.createdAt))}
                  {open.source === 'example' ? ` · ${t.exampleData}` : open.source === 'device' ? ` · ${t.localTag}` : ''}
                </p>
              </div>
              <button type="button" className={s.close} onClick={() => setOpen(null)} aria-label={t.close}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <dl className={s.facts}>
              {open.payload.phone ? (
                <div>
                  <dt>{t.contact}</dt>
                  <dd>
                    {open.payload.phone.includes('•') ? (
                      <span dir="ltr">{open.payload.phone}</span>
                    ) : (
                      <a href={`tel:${open.payload.phone}`} dir="ltr" className="link-line">
                        {open.payload.phone}
                      </a>
                    )}
                    {open.payload.email ? (
                      <>
                        {' · '}
                        <a href={`mailto:${open.payload.email}`} className="link-line" dir="ltr">
                          {open.payload.email}
                        </a>
                      </>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {open.payload.branch ? (
                <div>
                  <dt>{t.table.branch}</dt>
                  <dd>
                    {branchNames[open.payload.branch] ?? open.payload.branch}
                    {open.payload.date ? ` · ${fDay.format(new Date(`${open.payload.date}T12:00:00`))}` : ''}
                    {open.payload.time ? ` · ${open.payload.time}` : ''}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>{t.table.project}</dt>
                <dd>{projectLabel(open)}</dd>
              </div>
              {open.payload.notes ? (
                <div>
                  <dt>{t.detail}</dt>
                  <dd className={s.notes}>{open.payload.notes}</dd>
                </div>
              ) : null}
              {open.payload.extra
                ? Object.entries(open.payload.extra)
                    .filter(([, v]) => v !== undefined && v !== '')
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt>{k}</dt>
                        <dd>{String(v)}</dd>
                      </div>
                    ))
                : null}
              <div>
                <dt>{t.table.attached}</dt>
                <dd>
                  {attachCount(open) ? (
                    <ul className={s.attach}>
                      {open.payload.attachments?.visualisations?.map((v, i) => (
                        <li key={`v${i}`}>
                          {v.room !== 'upload' ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`/renders/room-${v.room}-${v.collection}.webp`} alt="" width={96} height={64} />
                          ) : null}
                          <span>{collectionNames[v.collection as CollectionId] ?? v.collection}</span>
                        </li>
                      ))}
                      {open.payload.attachments?.plans?.map((p, i) => (
                        <li key={`p${i}`}>
                          <span>
                            {String(p.summary?.shape ?? '')} {p.summary?.width ? `${p.summary.width} × ${p.summary.depth}` : ''}
                          </span>
                          {p.code && p.code !== 'example' ? (
                            <Link className="link-line" href={`${href(locale, '/planner')}?p=${p.code}`} target="_blank">
                              {t.openPlan}
                            </Link>
                          ) : null}
                        </li>
                      ))}
                      {open.payload.attachments?.style ? (
                        <li>
                          <span>{collectionNames[open.payload.attachments.style.collection as CollectionId] ?? open.payload.attachments.style.collection}</span>
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <span className="muted">{t.noAttachment}</span>
                  )}
                </dd>
              </div>
            </dl>
            <label className={s.statusPick}>
              <span>{t.table.status}</span>
              <select value={open.status} onChange={(e) => setStatus(open.ref, e.target.value as LeadStatus)}>
                {STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {t.statuses[st]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
