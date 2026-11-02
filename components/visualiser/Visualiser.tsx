'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Dict } from '@/content/en';
import { collections, isCollectionId, type CollectionId } from '@/lib/data/collections';
import { href, type Locale } from '@/lib/i18n';
import { fmt } from '@/lib/fmt';
import { designStore, uid } from '@/lib/store';
import { track } from '@/lib/analytics';
import { waLink } from '@/lib/site';
import { Icon } from '@/components/ui/Icon';
import { BeforeAfter, type BAImage } from '@/components/ui/BeforeAfter';
import { swatchStyle } from '@/components/ui/swatch';
import s from './Visualiser.module.css';

type Room = 'a' | 'b' | 'c';
interface RenderRef {
  src: string;
  w: number;
  h: number;
  blur: string;
}

/** Downscale a photo in the browser before upload (phones produce 12 MP images). */
async function prepare(file: File, maxEdge = 1536): Promise<string> {
  const bmp = await createImageBitmap(file).catch(() => null);
  let w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  if (bmp) {
    w = bmp.width;
    h = bmp.height;
    draw = (ctx, cw, ch) => ctx.drawImage(bmp, 0, 0, cw, ch);
  } else {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new window.Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    w = img.naturalWidth;
    h = img.naturalHeight;
    draw = (ctx, cw, ch) => ctx.drawImage(img, 0, 0, cw, ch);
  }
  const k = Math.min(1, maxEdge / Math.max(w, h));
  const cw = Math.round(w * k);
  const ch = Math.round(h * k);
  const c = document.createElement('canvas');
  c.width = cw;
  c.height = ch;
  const ctx = c.getContext('2d')!;
  draw(ctx, cw, ch);
  return c.toDataURL('image/jpeg', 0.86);
}

async function thumb(dataUrl: string, maxEdge = 960): Promise<string> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new window.Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const k = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.8);
}

export function Visualiser({
  locale,
  t,
  common,
  meta,
  collectionNames,
  taglines,
  renders,
}: {
  locale: Locale;
  t: Dict['visualiser'];
  common: Dict['common'];
  meta: Dict['meta'];
  collectionNames: Record<CollectionId, string>;
  taglines: Record<CollectionId, string>;
  renders: Record<string, RenderRef>;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [collection, setCollection] = useState<CollectionId | null>(null);
  const [phase, setPhase] = useState<'pick' | 'generating' | 'result'>('pick');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<{ mode: 'live' | 'demo'; room: Room; image?: string; uploaded?: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const c = q.get('collection');
    const r = q.get('room');
    if (isCollectionId(c)) setCollection(c);
    if (r === 'a' || r === 'b' || r === 'c') setRoom(r);
    track('tool_start', { tool: 'visualiser' });
  }, []);

  const onFile = async (f: File | undefined | null) => {
    setError(null);
    if (!f) return;
    if (!f.type.startsWith('image/') && !/\.(heic|heif)$/i.test(f.name)) {
      setError(t.errors.type);
      return;
    }
    if (f.size > 15 * 1024 * 1024) {
      setError(t.errors.size);
      return;
    }
    try {
      const data = await prepare(f);
      setPhoto(data);
      setRoom(null);
    } catch {
      setError(t.errors.type);
    }
  };

  const generate = async (col: CollectionId | null = collection) => {
    if (!col || (!room && !photo)) return;
    setCollection(col);
    setError(null);
    setPhase('generating');
    setSaved(false);
    setStep(0);
    const steps = window.setInterval(() => setStep((x) => Math.min(t.generatingSteps.length - 1, x + 1)), 650);
    const minWait = new Promise((r) => setTimeout(r, photo ? 2600 : 1900));
    try {
      const res = await fetch('/api/visualise', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ collection: col, room: room ?? undefined, image: photo ?? undefined }),
      });
      const json = (await res.json()) as { ok: boolean; mode?: 'live' | 'demo'; room?: Room; image?: string; uploaded?: boolean };
      await minWait;
      if (!json.ok) throw new Error('fail');
      setResult({ mode: json.mode ?? 'demo', room: json.room ?? room ?? 'a', image: json.image, uploaded: json.uploaded });
      setPhase('result');
      track('visualisation', { collection: col, mode: json.mode ?? 'demo' });
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch {
      await minWait;
      // Demo fallback keeps the flow alive even if the endpoint is unreachable.
      if (room) {
        setResult({ mode: 'demo', room });
        setPhase('result');
      } else {
        setError(t.errors.generic);
        setPhase('pick');
      }
    } finally {
      window.clearInterval(steps);
    }
  };

  const shown = result;
  const shownRoom: Room = shown?.room ?? 'a';
  const beforeRef = renders[`room-${shownRoom}-before`];
  const afterRef = collection ? renders[`room-${shownRoom}-${collection}`] : undefined;
  const live = shown?.mode === 'live' && shown.image;
  const before: BAImage | null = live && photo ? { src: photo, w: 1500, h: 1000, alt: t.yourPhoto } : beforeRef ? { ...beforeRef, alt: `${t.examples[shownRoom].title}. ${t.result.before}` } : null;
  const after: BAImage | null =
    live && shown?.image ? { src: shown.image, w: 1536, h: 1024, alt: `${t.result.after}: ${collection ? collectionNames[collection] : ''}` } : afterRef && collection ? { ...afterRef, alt: `${t.examples[shownRoom].title}, ${collectionNames[collection]}. ${meta.render}.` } : null;

  const save = async () => {
    if (!collection) return;
    let image: string | undefined;
    let beforeThumb: string | undefined;
    if (live && shown?.image) {
      image = await thumb(shown.image).catch(() => undefined);
      beforeThumb = photo ? await thumb(photo, 640).catch(() => undefined) : undefined;
    }
    designStore.addVisualisation({ id: uid(), room: live ? 'upload' : shownRoom, collection, createdAt: Date.now(), image, before: beforeThumb });
    setSaved(true);
  };

  const shareLink = typeof window !== 'undefined' && collection ? `${window.location.origin}${href(locale, '/visualiser')}?room=${shownRoom}&collection=${collection}` : '';

  return (
    <div className={s.vis}>
      <ol className={s.steps} aria-label={t.title}>
        {t.steps.map((st, i) => {
          const done = (i === 0 && (room || photo)) || (i === 1 && collection) || (i === 2 && phase === 'result');
          return (
            <li key={st} data-done={done ? '1' : '0'}>
              <span className="index-num">0{i + 1}</span> {st}
            </li>
          );
        })}
      </ol>

      {/* Step 1: photo or example */}
      <section className={s.block} aria-labelledby="v-step1">
        <h2 id="v-step1" className="t-m">
          {t.upload.title}
        </h2>
        <div
          className={s.drop}
          data-drag={drag ? '1' : '0'}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            void onFile(e.dataTransfer.files?.[0]);
          }}
        >
          {photo ? (
            <div className={s.preview}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo} alt={t.yourPhoto} />
              <button type="button" className="chip" onClick={() => setPhoto(null)}>
                <Icon name="close" size={14} /> {common.remove}
              </button>
            </div>
          ) : (
            <>
              <Icon name="upload" size={28} />
              <p>
                {t.upload.drop}{' '}
                <button type="button" className="link-line" onClick={() => fileRef.current?.click()}>
                  {t.upload.choose}
                </button>
              </p>
              <button type="button" className={`btn btn-small btn-ghost ${s.camBtn}`} onClick={() => camRef.current?.click()}>
                <Icon name="camera" size={16} /> {t.upload.camera}
              </button>
              <p className="t-small muted">{t.upload.formats}</p>
              <ul className={s.tips}>
                {t.upload.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </>
          )}
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
        <p className={s.privacy}>
          <Icon name="check" size={16} /> {t.privacy}
        </p>
        <p className={s.or}>{t.orExample}</p>
        <div className={s.rooms} role="radiogroup" aria-label={t.orExample}>
          {(['a', 'b', 'c'] as Room[]).map((r) => {
            const ref = renders[`room-${r}-before`];
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={room === r && !photo}
                className={s.room}
                onClick={() => {
                  setRoom(r);
                  setPhoto(null);
                }}
              >
                {ref ? <Image src={ref.src} alt="" width={ref.w} height={ref.h} sizes="(max-width: 760px) 50vw, 25vw" placeholder="blur" blurDataURL={ref.blur} /> : null}
                <span className={s.roomTitle}>{t.examples[r].title}</span>
                <span className="t-small muted">{t.examples[r].meta}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: collection */}
      <section className={s.block} aria-labelledby="v-step2">
        <h2 id="v-step2" className="t-m">
          {t.choose}
        </h2>
        <div className={s.cols} role="radiogroup" aria-label={t.choose}>
          {collections.map((c) => (
            <button key={c.id} type="button" role="radio" aria-checked={collection === c.id} className={s.col} onClick={() => setCollection(c.id)}>
              <span className={s.colSwatches} aria-hidden="true">
                {c.swatches.slice(0, 3).map((sw, i) => (
                  <span key={i} style={swatchStyle(sw)} />
                ))}
              </span>
              <span className={s.colName}>{collectionNames[c.id]}</span>
              <span className="t-small muted">{taglines[c.id]}</span>
            </button>
          ))}
        </div>
        <div className={s.generateRow}>
          <button type="button" className="btn" data-magnetic disabled={!collection || (!room && !photo) || phase === 'generating'} onClick={() => void generate()}>
            <Icon name="sparkle" size={18} />
            {t.generate}
          </button>
          {error ? (
            <p className="error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      {/* Generating */}
      {phase === 'generating' ? (
        <section className={s.generating} aria-live="polite">
          <div className={s.genBar}>
            <span style={{ width: `${((step + 1) / t.generatingSteps.length) * 100}%` }} />
          </div>
          <p className="t-m">{t.generating}</p>
          <p className="muted">{t.generatingSteps[step]}</p>
        </section>
      ) : null}

      {/* Result */}
      {phase === 'result' && collection && before && after ? (
        <section ref={resultRef} className={s.result} aria-labelledby="v-result">
          <h2 id="v-result" className="t-l">
            {fmt(t.result.title, { name: collectionNames[collection] })}
          </h2>
          {shown?.mode === 'demo' && shown.uploaded ? (
            <div className={s.demoUpload}>
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photo} alt={t.yourPhoto} />
              ) : null}
              <p>{t.demoUpload}</p>
            </div>
          ) : null}
          <BeforeAfter before={before} after={after} beforeLabel={t.result.before} afterLabel={`${t.result.after} · ${collectionNames[collection]}`} dragLabel={t.result.drag} unoptimized={!!live} sizes="(max-width: 1100px) 100vw, 80vw" />
          <p className={s.aiLabel}>
            <Icon name="sparkle" size={16} /> {t.label}
          </p>
          {shown?.mode === 'demo' ? <p className="t-small muted">{t.demoMode}</p> : null}
          <div className={s.switch} role="radiogroup" aria-label={t.result.another}>
            <span className="label muted">{t.result.another}</span>
            {collections.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={collection === c.id} className="chip" onClick={() => (shown?.mode === 'live' ? void generate(c.id) : setCollection(c.id))}>
                {collectionNames[c.id]}
              </button>
            ))}
          </div>
          <div className={s.actions}>
            <Link
              href={`${href(locale, '/book')}?vis=${live ? 'upload' : shownRoom}:${collection}`}
              className="btn"
              data-magnetic
              onClick={() => {
                if (!saved) void save();
              }}
            >
              {t.result.book}
              <Icon name="arrow" className="arrow" />
            </Link>
            <button type="button" className="btn btn-ghost" onClick={() => void save()}>
              {saved ? <Icon name="check" size={18} /> : null}
              {saved ? common.saved : common.save}
            </button>
            <a className="btn btn-ghost" href={waLink(`${fmt(t.whatsappText, { name: collectionNames[collection] })}\n${shareLink}`)} target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={18} />
              {t.result.whatsapp}
            </a>
            <a className="btn btn-ghost" href={after.src} download={`avivi-${collection}.${live ? 'png' : 'webp'}`} data-no-transition>
              <Icon name="download" size={18} />
              {common.download}
            </a>
            <button
              type="button"
              className="link-line"
              onClick={() => {
                setPhase('pick');
                setResult(null);
                setPhoto(null);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              {t.result.newPhoto}
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
