import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { collections, getCollection, type CollectionId } from '@/lib/data/collections';
import { collectionImages, render } from '@/lib/renders';
import { getDict } from '@/lib/dict';
import { href, isLocale, locales, type Locale } from '@/lib/i18n';
import { fmt } from '@/lib/fmt';
import { pageMeta } from '@/lib/meta';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Icon } from '@/components/ui/Icon';
import { swatchStyle } from '@/components/ui/swatch';
import { DayNight } from '@/components/collections/DayNight';
import s from '@/components/collections/Collection.module.css';

type Props = { params: Promise<{ locale: string; slug: string }> };

export function generateStaticParams() {
  return locales.flatMap((locale) => collections.map((c) => ({ locale, slug: c.id })));
}

async function resolve(params: Props['params']) {
  const { locale, slug } = await params;
  const l: Locale = isLocale(locale) ? locale : 'he';
  const col = getCollection(slug);
  return { locale: l, col, t: getDict(l) };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, col, t } = await resolve(params);
  if (!col) return {};
  const it = t.collections.items[col.id];
  return pageMeta(locale, `/collections/${col.id}`, `${it.name} · ${t.collections.title}`, `${it.tagline} ${it.intro}`);
}

export default async function CollectionPage({ params }: Props) {
  const { locale, col, t } = await resolve(params);
  if (!col) notFound();
  const id = col.id as CollectionId;
  const it = t.collections.items[id];
  const L = t.collections.labels;
  const imgs = collectionImages[id];
  const hero = render(imgs[0]);
  const dark = col.theme === 'dark';
  const idx = collections.findIndex((c) => c.id === id);
  const next = collections[(idx + 1) % collections.length];
  const detailRows: [string, string][] = [
    [L.fronts, it.details.fronts],
    [L.handles, it.details.handles],
    [L.surfaces, it.details.surfaces],
    [L.accent, it.details.accent],
  ];
  const style = {
    ['--c-bg' as string]: col.palette.bg,
    ['--c-surface' as string]: col.palette.surface,
    ['--c-ink' as string]: col.palette.ink,
    ['--c-muted' as string]: col.palette.muted,
    ['--c-accent' as string]: col.palette.accent,
    ['--c-line' as string]: col.palette.line,
  };

  return (
    <div className={s.page} data-theme={dark ? 'dark' : undefined} style={style}>
      {/* Hero */}
      <section className={s.hero} aria-labelledby="col-name">
        {hero ? (
          <Image
            src={hero.src}
            alt={`${it.name}: ${it.art[0]}. ${t.meta.render}.`}
            width={hero.w}
            height={hero.h}
            priority
            sizes="100vw"
            placeholder="blur"
            blurDataURL={hero.blur}
            className={s.heroImg}
          />
        ) : null}
        <div className={s.heroShade} />
        <div className={`wrap ${s.heroText}`}>
          <nav aria-label="Breadcrumb" className={s.crumbs}>
            <Link href={href(locale, '/')}>{t.nav.home}</Link> / <Link href={href(locale, '/collections')}>{t.collections.title}</Link>
          </nav>
          <p className="index-num">0{idx + 1} / 05</p>
          <h1 id="col-name" className={s.name}>
            {it.name}
          </h1>
          <p className={s.heroTag}>{it.tagline}</p>
          <span className={s.renderTag}>{t.meta.render}</span>
        </div>
      </section>

      {/* Story */}
      <section className={`wrap ${s.story}`}>
        <p className={`${s.intro} reveal`}>{it.intro}</p>
        <ol className={s.storyList}>
          {it.story.map((line, i) => (
            <li key={line} className="reveal">
              <span className="index-num">0{i + 1}</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Day to night */}
      <section className={s.dayNight} aria-labelledby="dn-title">
        <div className="wrap">
          <div className={s.sectionHead}>
            <p className="label accent">{L.dayNight}</p>
            <h2 id="dn-title" className="t-l">
              {L.dayNightHint}
            </h2>
          </div>
          <DayNight
            finish={col.finish}
            dark={dark}
            labels={{
              title: L.dayNight,
              hint: `${L.view3d}. ${t.meta.render}.`,
              morning: L.morning,
              noon: L.noon,
              evening: L.evening,
              night: L.night,
              timeOfDay: L.timeOfDay,
              canvas: `${L.view3d}: ${it.name}. ${it.intro}`,
              play: L.dayNight,
            }}
            still={{
              day: render(dark ? 'room-b-dark' : imgs[0]) ?? hero!,
              night: dark ? render('room-b-dark-evening') : undefined,
              alt: `${it.name}: ${it.art[0]}. ${t.meta.render}.`,
            }}
          />
        </div>
      </section>

      {/* Materials */}
      <section className={`wrap ${s.materials}`} aria-labelledby="mat-title">
        <div className={s.sectionHead}>
          <p className="label accent">{L.materials}</p>
          <h2 id="mat-title" className="t-l">
            {L.details}
          </h2>
        </div>
        <ul className={s.matList}>
          {detailRows.map(([k, v], i) => (
            <li key={k} className="reveal">
              <span className={s.matSwatch} style={swatchStyle(col.swatches[i] ?? col.swatches[0])} aria-hidden="true" />
              <span className="label muted">{k}</span>
              <span className={s.matValue}>{v}</span>
            </li>
          ))}
        </ul>
        <p className="t-small muted">
          <span className="example-tag">{t.meta.example}</span> {L.finishNote}
        </p>
      </section>

      {/* Models with galleries */}
      <section className={s.models} aria-labelledby="models-title">
        <div className="wrap">
          <div className={s.sectionHead}>
            <p className="label accent">{L.gallery}</p>
            <h2 id="models-title" className="t-l">
              {L.models}
            </h2>
            <p className="t-small muted">
              <span className="example-tag to-confirm">{t.meta.toConfirm}</span> {L.modelNote}
            </p>
          </div>
          {it.models.map((m, mi) => {
            const pair = mi === 0 ? [imgs[1], imgs[3]] : [imgs[2], imgs[0]];
            const arts = mi === 0 ? [it.art[1], it.art[3]] : [it.art[2], it.art[0]];
            return (
              <article key={m.name + mi} className={s.model}>
                <header className={s.modelHead}>
                  <h3 className="t-m">{m.name}</h3>
                  <p className="muted">{m.note}</p>
                </header>
                <div className={s.gallery}>
                  {pair.map((img, gi) => (
                    <PhotoSlot
                      key={img + gi}
                      name={img}
                      alt={`${it.name}, ${m.name}: ${arts[gi]}`}
                      caption={`${m.name} · ${gi === 0 ? '01' : '02'}`}
                      art={arts[gi]}
                      artLabel={t.meta.artDirection}
                      renderLabel={t.meta.render}
                      slotLabel={t.meta.photoSlot}
                      ratio={gi === 0 ? '3 / 2' : '4 / 5'}
                      className={gi === 0 ? s.gWide : s.gTall}
                      sizes={gi === 0 ? '(max-width: 900px) 100vw, 62vw' : '(max-width: 900px) 100vw, 34vw'}
                    />
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Actions */}
      <section className={`wrap ${s.actions}`}>
        <Link href={href(locale, `/visualiser?collection=${id}`)} className={s.action} data-cursor data-cursor-label={t.common.open}>
          <Icon name="camera" />
          <span>{fmt(L.visualiseIn, { name: it.name })}</span>
          <Icon name="arrow" className="flip-rtl" />
        </Link>
        <Link href={href(locale, `/book?collection=${id}`)} className={s.action} data-cursor data-cursor-label={t.common.open}>
          <Icon name="pin" />
          <span>{fmt(L.bookIn, { name: it.name })}</span>
          <Icon name="arrow" className="flip-rtl" />
        </Link>
        <Link href={href(locale, `/planner?collection=${id}`)} className={s.action} data-cursor data-cursor-label={t.common.open}>
          <Icon name="calendar" />
          <span>{fmt(L.planIn, { name: it.name })}</span>
          <Icon name="arrow" className="flip-rtl" />
        </Link>
      </section>

      <Link href={href(locale, `/collections/${next.id}`)} className={s.next}>
        <span className="label muted">{L.next}</span>
        <span className={s.nextName}>{t.collections.items[next.id].name}</span>
        <Icon name="arrow" size={28} className="flip-rtl" />
      </Link>
    </div>
  );
}
