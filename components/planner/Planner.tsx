'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import type { Dict } from '@/content/en';
import { collections, isCollectionId, type CollectionId } from '@/lib/data/collections';
import { computeLayout, decodePlan, DEFAULT_STATE, encodePlan, LIMITS, type Opening, type PlannerState, type Shape, type WallId } from '@/lib/planner/engine';
import { href, localeTag, type Locale } from '@/lib/i18n';
import { fmt, num } from '@/lib/fmt';
import { designStore, uid } from '@/lib/store';
import { track } from '@/lib/analytics';
import { waLink } from '@/lib/site';
import { observeSize, webglAvailable } from '@/lib/three/caps';
import { Icon } from '@/components/ui/Icon';
import { swatchStyle } from '@/components/ui/swatch';
import { PlanView } from './PlanView';
import s from './Planner.module.css';

type T = Dict['planner'];
type SceneT = { update: (l: ReturnType<typeof computeLayout>) => void; resize: (w: number, h: number) => void; start: () => void; stop: () => void; dispose: () => void };

const SHAPES: Shape[] = ['straight', 'L', 'U', 'galley', 'island'];

function ShapeIcon({ shape }: { shape: Shape }) {
  const r = (x: number, y: number, w: number, h: number) => <rect x={x} y={y} width={w} height={h} />;
  return (
    <svg viewBox="0 0 40 32" aria-hidden="true" className={s.shapeIcon}>
      <rect x="2" y="2" width="36" height="28" className={s.shapeRoom} />
      {shape === 'straight' && r(4, 4, 32, 6)}
      {shape === 'L' && (
        <>
          {r(4, 4, 32, 6)}
          {r(4, 10, 6, 14)}
        </>
      )}
      {shape === 'U' && (
        <>
          {r(4, 4, 32, 6)}
          {r(4, 10, 6, 14)}
          {r(30, 10, 6, 14)}
        </>
      )}
      {shape === 'galley' && (
        <>
          {r(4, 4, 6, 24)}
          {r(30, 4, 6, 24)}
        </>
      )}
      {shape === 'island' && (
        <>
          {r(4, 4, 32, 6)}
          {r(12, 17, 16, 7)}
        </>
      )}
    </svg>
  );
}

export function Planner({ locale, t, collectionNames, common, exampleLabel }: { locale: Locale; t: T; collectionNames: Record<CollectionId, string>; common: Dict['common']; exampleLabel: string }) {
  const [state, setState] = useState<PlannerState>(DEFAULT_STATE);
  const [view, setView] = useState<'3d' | 'plan'>('3d');
  const [webgl, setWebgl] = useState(true);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneT | null>(null);
  const layout = useMemo(() => computeLayout(state), [state]);
  const code = useMemo(() => encodePlan(state), [state]);

  // initial state from the URL (?p=code or ?collection=)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const fromCode = decodePlan(q.get('p'));
    const col = q.get('collection');
    if (fromCode) setState(fromCode);
    else if (isCollectionId(col)) setState((st) => ({ ...st, collection: col }));
    track('tool_start', { tool: 'planner' });
  }, []);

  // keep the URL shareable
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('p', code);
    url.searchParams.delete('collection');
    window.history.replaceState(null, '', url.toString());
    setSaved(false);
  }, [code]);

  // 3D scene
  useEffect(() => {
    if (view !== '3d') return;
    const c = canvasRef.current;
    if (!c) return;
    if (!webglAvailable()) {
      setWebgl(false);
      setView('plan');
      return;
    }
    let disposed = false;
    let off: (() => void) | null = null;
    (async () => {
      const { PlannerScene } = await import('./PlannerScene');
      if (disposed) return;
      const sc = new PlannerScene(c);
      sceneRef.current = sc;
      const r = c.getBoundingClientRect();
      sc.resize(r.width, r.height);
      sc.update(computeLayout(stateRef.current));
      sc.start();
      off = observeSize(c, (w, h) => sc.resize(w, h));
    })();
    return () => {
      disposed = true;
      off?.();
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, [view]);

  const stateRef = useRef(state);
  stateRef.current = state;
  useEffect(() => {
    sceneRef.current?.update(layout);
  }, [layout]);

  const set = useCallback(<K extends keyof PlannerState>(k: K, v: PlannerState[K]) => setState((st) => ({ ...st, [k]: v })), []);
  const setOpening = (id: string, patch: Partial<Opening>) => setState((st) => ({ ...st, openings: st.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) }));
  const addOpening = (type: Opening['type']) =>
    setState((st) => ({ ...st, openings: [...st.openings, { id: uid(), type, wall: (type === 'door' ? 'front' : 'back') as WallId, offset: 60, width: type === 'door' ? 90 : 100 }].slice(0, 8) }));

  const shareUrl = () => `${window.location.origin}${href(locale, '/planner')}?p=${code}`;
  const summary = fmt(t.summaryLine, { shape: t.shapes[layout.shapeUsed], w: state.width, d: state.depth });

  const save = () => {
    designStore.addPlan({
      id: uid(),
      createdAt: Date.now(),
      code,
      summary: { shape: layout.shapeUsed, width: state.width, depth: state.depth, counter: layout.counterLength, storage: layout.storage, collection: state.collection },
    });
    setSaved(true);
    track('plan_saved', { shape: layout.shapeUsed });
  };

  const share = async () => {
    const url = shareUrl();
    try {
      if (navigator.share) {
        await navigator.share({ title: t.shareText, text: summary, url });
        return;
      }
    } catch {
      /* fall back to copy */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt(t.share, url);
    }
  };

  const n = (v: number) => num(v, localeTag[locale]);
  const tri = layout.triangle;

  const numberField = (key: 'width' | 'depth' | 'height', label: string) => {
    const lim = LIMITS[key];
    return (
      <div className={s.num}>
        <label htmlFor={`pl-${key}`}>{label}</label>
        <div className={s.stepper}>
          <button type="button" onClick={() => set(key, Math.max(lim[0], state[key] - 10))} aria-label={`${label} −10`}>
            <Icon name="minus" size={16} />
          </button>
          <input
            id={`pl-${key}`}
            type="number"
            inputMode="numeric"
            min={lim[0]}
            max={lim[1]}
            step={5}
            value={state[key]}
            onChange={(e) => set(key, Number(e.target.value) || lim[0])}
            onBlur={(e) => set(key, Math.min(lim[1], Math.max(lim[0], Number(e.target.value) || lim[0])))}
          />
          <span className={s.unit}>{t.cm}</span>
          <button type="button" onClick={() => set(key, Math.min(lim[1], state[key] + 10))} aria-label={`${label} +10`}>
            <Icon name="plus" size={16} />
          </button>
        </div>
      </div>
    );
  };

  const allModules = layout.runs.flatMap((r) => r.modules.filter((m) => m.kind !== 'filler').map((m) => ({ run: r.id, ...m })));

  return (
    <div className={s.planner}>
      <aside className={s.controls} aria-label={t.room}>
        <fieldset className={s.group}>
          <legend className="label">{t.room}</legend>
          {numberField('width', t.width)}
          {numberField('depth', t.depth)}
          {numberField('height', t.height)}
        </fieldset>

        <fieldset className={s.group}>
          <legend className="label">{t.shape}</legend>
          <div className={s.shapes} role="radiogroup" aria-label={t.shape}>
            {SHAPES.map((sh) => (
              <button key={sh} type="button" role="radio" aria-checked={state.shape === sh} className={s.shapeBtn} onClick={() => set('shape', sh)}>
                <ShapeIcon shape={sh} />
                <span>{t.shapes[sh]}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className={s.group}>
          <legend className="label">{t.openings}</legend>
          <ul className={s.openings}>
            {state.openings.map((o) => (
              <li key={o.id} className={s.opening}>
                <span className={s.opType}>{o.type === 'window' ? t.window : t.door}</span>
                <label className="visually-hidden" htmlFor={`w-${o.id}`}>
                  {t.wall}
                </label>
                <select id={`w-${o.id}`} value={o.wall} onChange={(e) => setOpening(o.id, { wall: e.target.value as WallId })}>
                  {(['back', 'left', 'right', 'front'] as WallId[]).map((w) => (
                    <option key={w} value={w}>
                      {t.walls[w]}
                    </option>
                  ))}
                </select>
                <label className={s.small}>
                  <span>{o.wall === 'left' || o.wall === 'right' ? t.offsetSide : t.offset}</span>
                  <input type="number" inputMode="numeric" min={0} step={5} value={o.offset} onChange={(e) => setOpening(o.id, { offset: Number(e.target.value) || 0 })} />
                </label>
                <label className={s.small}>
                  <span>{t.openingWidth}</span>
                  <input type="number" inputMode="numeric" min={40} step={5} value={o.width} onChange={(e) => setOpening(o.id, { width: Number(e.target.value) || 60 })} />
                </label>
                <button type="button" className={s.remove} onClick={() => setState((st) => ({ ...st, openings: st.openings.filter((x) => x.id !== o.id) }))} aria-label={`${t.remove}: ${o.type === 'window' ? t.window : t.door}`}>
                  <Icon name="close" size={16} />
                </button>
              </li>
            ))}
          </ul>
          <div className={s.addRow}>
            <button type="button" className="chip" onClick={() => addOpening('window')}>
              <Icon name="plus" size={14} /> {t.addWindow}
            </button>
            <button type="button" className="chip" onClick={() => addOpening('door')}>
              <Icon name="plus" size={14} /> {t.addDoor}
            </button>
          </div>
        </fieldset>

        <fieldset className={s.group}>
          <legend className="label">{t.finish}</legend>
          <div className={s.finishes} role="radiogroup" aria-label={t.finish}>
            {collections.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={state.collection === c.id} className={s.finishBtn} onClick={() => set('collection', c.id)}>
                <span className={s.finishSw} style={swatchStyle(c.finish.front)} aria-hidden="true" />
                <span>{collectionNames[c.id]}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <button type="button" className="link-line" onClick={() => setState(DEFAULT_STATE)}>
          <Icon name="rotate" size={16} /> {t.reset}
        </button>
      </aside>

      <section className={s.stageCol} aria-label={t.results}>
        <div className={s.viewBar}>
          <div className={s.toggle} role="tablist" aria-label={t.view3d}>
            <button role="tab" type="button" aria-selected={view === '3d'} onClick={() => setView('3d')} disabled={!webgl}>
              {t.view3d}
            </button>
            <button role="tab" type="button" aria-selected={view === 'plan'} onClick={() => setView('plan')}>
              {t.viewPlan}
            </button>
          </div>
          <p className={s.summary}>{summary}</p>
        </div>
        <div className={s.stage}>
          {view === '3d' ? <canvas ref={canvasRef} className={s.canvas} role="img" aria-label={`${t.canvasLabel} ${summary}`} data-cursor data-cursor-label="⟲" /> : null}
          {view === 'plan' ? <PlanView layout={layout} labels={{ sink: t.legend.sink, hob: t.legend.hob, fridge: t.legend.fridge, cm: t.cm }} /> : null}
        </div>
        {layout.warnings.length ? (
          <ul className={s.warnings} aria-live="polite">
            {layout.warnings.map((w) => (
              <li key={w.key}>{fmt(t.warnings[w.key], { min: w.min ?? '' })}</li>
            ))}
          </ul>
        ) : null}

        <div className={s.metrics} aria-live="polite">
          <div className={s.metric}>
            <span className="label muted">{t.counter}</span>
            <span className={s.metricValue}>
              {n(Math.round(layout.counterLength) / 100)} <small>m</small>
            </span>
          </div>
          <div className={s.metric}>
            <span className="label muted">{t.storage}</span>
            <span className={s.metricValue}>
              {n(layout.storage)} <small>{t.litres}</small>
            </span>
          </div>
          <div className={s.metric}>
            <span className="label muted">{t.modules}</span>
            <span className={s.metricValue}>{layout.moduleCount}</span>
          </div>
          <div className={`${s.metric} ${s.metricWide}`}>
            <span className="label muted">{t.triangle}</span>
            {tri ? (
              <>
                <span className={s.metricValue}>
                  {tri.legs.map((l) => n(l)).join(' · ')} <small>{t.cm}</small>
                </span>
                <span className={tri.ok ? s.ok : s.warn}>
                  {tri.ok ? <Icon name="check" size={16} /> : <Icon name="sparkle" size={16} />} {tri.ok ? t.triangleOk : t.triangleWarn} · {n(tri.total)} {t.cm}
                </span>
              </>
            ) : (
              <span className={s.warn}>—</span>
            )}
            <span className="t-small muted">{t.triangleRule}</span>
          </div>
        </div>

        <div className={s.price}>
          <div>
            <span className="label muted">{t.price}</span>
            <span className={s.priceValue}>
              ₪{n(layout.price.low)} – ₪{n(layout.price.high)}
            </span>
          </div>
          <p className="t-small">
            <span className="example-tag">{exampleLabel}</span> {t.priceNote}
          </p>
        </div>

        <div className={s.actions}>
          <Link href={`${href(locale, '/book')}?plan=${code}`} className="btn" data-magnetic onClick={save}>
            {t.attach}
            <Icon name="arrow" className="arrow" />
          </Link>
          <button type="button" className="btn btn-ghost" onClick={save}>
            {saved ? <Icon name="check" size={18} /> : null}
            {saved ? common.saved : common.save}
          </button>
          <button type="button" className="btn btn-ghost" onClick={share}>
            <Icon name="share" size={18} />
            {copied ? common.copied : t.share}
          </button>
          <a className="btn btn-ghost" href={waLink(`${fmt(t.whatsappText, { shape: t.shapes[layout.shapeUsed], w: state.width, d: state.depth })}\n${typeof window !== 'undefined' ? shareUrl() : ''}`)} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={18} />
            {common.whatsappSend}
          </a>
        </div>

        <details className={s.list}>
          <summary>
            {t.modules} · {allModules.length}
          </summary>
          <ol>
            {layout.runs.map((r) => (
              <li key={r.id}>
                <strong>{r.wall === 'island' ? t.moduleNames.island : t.walls[r.wall as WallId]}</strong>
                <ul>
                  {r.modules.map((m, i) => (
                    <li key={i}>
                      {t.moduleNames[m.kind === 'corner' ? 'corner' : m.kind]} · {m.width} {t.cm}
                    </li>
                  ))}
                  {r.uppers.map((u, i) => (
                    <li key={`u${i}`}>
                      {t.moduleNames.wall} · {u.width} {t.cm}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {layout.island ? (
              <li>
                <strong>{t.moduleNames.island}</strong> · {layout.island.length} × {layout.island.depth} {t.cm}
              </li>
            ) : null}
          </ol>
        </details>
      </section>
    </div>
  );
}
