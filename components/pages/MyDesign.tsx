'use client';
import Link from 'next/link';
import type { Dict } from '@/content/en';
import type { CollectionId } from '@/lib/data/collections';
import { href, type Locale } from '@/lib/i18n';
import { designCount, designStore, useMyDesign } from '@/lib/store';
import { Icon } from '@/components/ui/Icon';
import s from './MyDesign.module.css';

/** Everything the visitor saved on this device, ready to attach to a showroom visit. */
export function MyDesign({
  locale,
  t,
  common,
  collectionNames,
  roomTitles,
  productNames,
  planShapes,
  tools,
}: {
  locale: Locale;
  t: Dict['myDesign'];
  common: Dict['common'];
  collectionNames: Record<CollectionId, string>;
  roomTitles: Record<'a' | 'b' | 'c', string>;
  productNames: Record<string, string>;
  planShapes: Record<string, string>;
  tools: { path: string; label: string }[];
}) {
  const d = useMyDesign();
  const count = designCount(d);
  if (!count) {
    return (
      <div className={s.empty}>
        <p className="lead">{t.empty}</p>
        <div className={s.row}>
          {tools.map((x) => (
            <Link key={x.path} href={href(locale, x.path)} className="btn btn-ghost">
              {x.label}
            </Link>
          ))}
        </div>
        <p className="t-small muted">{t.local}</p>
      </div>
    );
  }
  return (
    <div className={s.wrap}>
      {d.visualisations.length ? (
        <section aria-labelledby="md-vis" className={s.group}>
          <h2 id="md-vis" className={s.h}>
            {t.visualisations} <span className="nums muted">{d.visualisations.length}</span>
          </h2>
          <ul className={s.grid}>
            {d.visualisations.map((v) => {
              const src = v.image || (v.room !== 'upload' ? `/renders/room-${v.room}-${v.collection}.webp` : '');
              return (
                <li key={v.id} className={s.item}>
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt={`${collectionNames[v.collection]}${v.room !== 'upload' ? ` · ${roomTitles[v.room]}` : ''}`} loading="lazy" />
                  ) : (
                    <span className={s.ph} aria-hidden="true">
                      <Icon name="sparkle" size={22} />
                    </span>
                  )}
                  <div className={s.meta}>
                    <span className={s.title}>{collectionNames[v.collection]}</span>
                    {v.room !== 'upload' ? <span className="muted t-small">{roomTitles[v.room]}</span> : null}
                  </div>
                  <div className={s.actions}>
                    <Link className="link-line t-small" href={`${href(locale, '/visualiser')}?collection=${v.collection}${v.room !== 'upload' ? `&room=${v.room}` : ''}`}>
                      {t.open}
                    </Link>
                    <button type="button" className={s.remove} onClick={() => designStore.removeVisualisation(v.id)}>
                      {common.remove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {d.plans.length ? (
        <section aria-labelledby="md-plans" className={s.group}>
          <h2 id="md-plans" className={s.h}>
            {t.plans} <span className="nums muted">{d.plans.length}</span>
          </h2>
          <ul className={s.list}>
            {d.plans.map((p) => (
              <li key={p.id} className={s.line}>
                <span className={s.title}>
                  {planShapes[p.summary.shape] ?? p.summary.shape} · <span className="nums">{p.summary.width} × {p.summary.depth}</span>
                </span>
                <span className="muted t-small">{collectionNames[p.summary.collection]}</span>
                <span className={s.actions}>
                  <Link className="link-line t-small" href={`${href(locale, '/planner')}?p=${p.code}`}>
                    {t.open}
                  </Link>
                  <button type="button" className={s.remove} onClick={() => designStore.removePlan(p.id)}>
                    {common.remove}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {d.style ? (
        <section aria-labelledby="md-style" className={s.group}>
          <h2 id="md-style" className={s.h}>
            {t.style}
          </h2>
          <div className={s.style}>
            <p className={s.big}>{collectionNames[d.style.collection]}</p>
            <ul>
              {d.style.brief.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
            <div className={s.actions}>
              <Link className="link-line t-small" href={href(locale, `/collections/${d.style.collection}`)}>
                {t.open}
              </Link>
              <button type="button" className={s.remove} onClick={() => designStore.setStyle(null)}>
                {common.remove}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {d.products.length ? (
        <section aria-labelledby="md-prod" className={s.group}>
          <h2 id="md-prod" className={s.h}>
            {t.products} <span className="nums muted">{d.products.length}</span>
          </h2>
          <ul className={s.list}>
            {d.products.map((id) => (
              <li key={id} className={s.line}>
                <span className={s.title}>{productNames[id] ?? id}</span>
                <span />
                <span className={s.actions}>
                  <button type="button" className={s.remove} onClick={() => designStore.toggleProduct(id)}>
                    {common.remove}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className={s.cta}>
        <Link href={href(locale, '/book')} className="btn" data-magnetic>
          {t.bookAll}
          <Icon name="arrow" className="arrow" />
        </Link>
        <button type="button" className="btn btn-ghost" onClick={() => designStore.clearDesign()}>
          {t.clear}
        </button>
        <p className="t-small muted">{t.local}</p>
      </div>
    </div>
  );
}
