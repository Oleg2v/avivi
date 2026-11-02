import Link from 'next/link';
import type { Dict } from '@/content/en';
import { href, type Locale } from '@/lib/i18n';
import { site, waLink } from '@/lib/site';
import { collections } from '@/lib/data/collections';
import { branches } from '@/lib/data/branches';
import { collectionImages, render } from '@/lib/renders';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { BeforeAfter } from '@/components/ui/BeforeAfter';
import { IsraelMap } from '@/components/ui/IsraelMap';
import { swatchStyle } from '@/components/ui/swatch';
import { MaterialWall } from './MaterialWall';
import s from './Home.module.css';

type P = { locale: Locale; t: Dict };

function Lines({ text, as: Tag = 'h2', className, id }: { text: string | string[]; as?: 'h1' | 'h2' | 'h3' | 'p'; className?: string; id?: string }) {
  const parts = Array.isArray(text) ? text : [text];
  return (
    <Tag className={`lines ${className ?? ''}`} id={id}>
      {parts.map((l) => (
        <span className="line" key={l}>
          <span>{l}</span>
        </span>
      ))}
    </Tag>
  );
}

/* ------------------------------------------------------------------ facts */
export function Facts({ t }: P) {
  const f = t.home.facts;
  return (
    <section className={s.facts} aria-labelledby="facts-title">
      <div className="wrap">
        <header className={s.headRow}>
          <p className="label accent">{f.kicker}</p>
          <Lines id="facts-title" text={f.title} className={`t-l ${s.factsTitle}`} />
        </header>
        <ol className={s.factList}>
          {f.items.map((it, i) => (
            <li key={it.value} className={`${s.fact} reveal`} style={{ transitionDelay: `${i * 70}ms` }}>
              <span className={`${s.factValue} nums`} dir="ltr">
                {it.value}
              </span>
              <span className={s.factRule} aria-hidden="true">
                <i />
              </span>
              <span className={s.factLabel}>{it.label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ visualiser teaser */
export function VisualiserTeaser({ locale, t }: P) {
  const v = t.home.visualiser;
  const before = render('room-a-before');
  const after = render('room-a-modern');
  return (
    <section className={s.vis} aria-labelledby="vis-title">
      <div className={`wrap ${s.visGrid}`}>
        <div className={s.visText}>
          <p className="label accent">{v.kicker}</p>
          <Lines id="vis-title" text={v.title} className="t-l" />
          <p className="lead muted reveal">{v.text}</p>
          <div className={`${s.ctaRow} reveal`}>
            <Link href={href(locale, '/visualiser')} className="btn" data-magnetic>
              <Icon name="camera" size={18} />
              {v.cta}
            </Link>
          </div>
          <p className={`${s.aiNote} reveal`}>
            <Icon name="sparkle" size={16} /> {t.visualiser.label}
          </p>
        </div>
        <div className={`${s.visMedia} reveal`}>
          {before && after ? (
            <BeforeAfter
              before={{ ...before, alt: `${v.room}. ${t.visualiser.result.before}` }}
              after={{ ...after, alt: `${t.collections.items.modern.name}: ${t.collections.items.modern.art[0]}` }}
              beforeLabel={t.visualiser.result.before}
              afterLabel={`${t.visualiser.result.after} · ${t.collections.items.modern.name}`}
              dragLabel={t.visualiser.result.drag}
              initial={46}
            />
          ) : null}
          <p className={s.mediaCaption}>
            <span>{v.room}</span>
            <span className="example-tag">{t.meta.render}</span>
          </p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ collections */
export function CollectionsChapters({ locale, t }: P) {
  const c = t.home.collections;
  return (
    <section className={s.chapters} aria-labelledby="col-title">
      <div className="wrap">
        <header className={s.headRow}>
          <p className="label accent">{c.kicker}</p>
          <Lines id="col-title" text={c.title} className="t-l" />
        </header>
      </div>
      {collections.map((col, i) => {
        const it = t.collections.items[col.id];
        const img = collectionImages[col.id][0];
        const dark = col.theme === 'dark';
        return (
          <article
            key={col.id}
            className={`${s.chapter} ${i % 2 ? s.flip : ''}`}
            data-theme={dark ? 'dark' : undefined}
            style={dark ? { background: col.palette.bg } : undefined}
            aria-labelledby={`ch-${col.id}`}
          >
            <div className={`wrap ${s.chapterGrid}`}>
              <div className={`${s.chapterMedia} reveal`}>
                <Link href={href(locale, `/collections/${col.id}`)} aria-hidden="true" tabIndex={-1} data-cursor data-cursor-label={t.common.open}>
                  <PhotoSlot
                    name={img}
                    alt={`${it.name}: ${it.art[0]}`}
                    art={it.art[0]}
                    artLabel={t.meta.artDirection}
                    renderLabel={t.meta.render}
                    slotLabel={t.meta.photoSlot}
                    ratio="3 / 2"
                    sizes="(max-width: 1100px) 100vw, 58vw"
                  />
                </Link>
              </div>
              <div className={s.chapterText}>
                <p className="index-num">0{i + 1} / 05</p>
                <h3 id={`ch-${col.id}`} className={s.chapterName}>
                  {it.name}
                </h3>
                <p className={s.tagline}>{it.tagline}</p>
                <p className="muted measure">{it.intro}</p>
                <ul className={s.swatches} aria-label={t.collections.labels.materials}>
                  {col.swatches.map((sw, k) => (
                    <li key={k} style={swatchStyle(sw)} title={Object.values(it.details)[k]} />
                  ))}
                </ul>
                <Link href={href(locale, `/collections/${col.id}`)} className="link-line">
                  {c.explore} · {it.name}
                  <Icon name="arrow" size={16} className="flip-rtl" />
                </Link>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

/* ------------------------------------------------------------------ material wall */
export function MaterialSection({ locale, t }: P) {
  const m = t.home.material;
  const it = t.collections.items;
  const labels = [
    { name: m.names[0], collections: `${it.modern.name} · ${it.specials.name}` },
    { name: m.names[1], collections: it.dark.name },
    { name: m.names[2], collections: `${it.dark.name} · ${it.modern.name}` },
    { name: m.names[3], collections: `${it.classic.name} · ${it.light.name}` },
    { name: m.names[4], collections: `${it.classic.name} · ${it.dark.name} · ${it.specials.name}` },
  ];
  return (
    <section className={s.material} data-theme="dark" aria-labelledby="mat-title" id="material">
      <div className={`wrap ${s.materialHead}`}>
        <p className="label accent">{m.kicker}</p>
        <Lines id="mat-title" text={m.title} className="t-xl" />
        <p className="lead muted">{m.text}</p>
      </div>
      <MaterialWall labels={labels} hint={m.hint} keys={m.keys} inLabel={m.in} fallback={m.fallback} rtl={locale === 'he'} title={m.title} />
    </section>
  );
}

/* ------------------------------------------------------------------ smart kitchen teaser */
export function SmartTeaser({ locale, t }: P) {
  const sm = t.home.smart;
  return (
    <section className={s.smart} aria-labelledby="smart-title">
      <div className={`wrap ${s.smartGrid}`}>
        <div>
          <p className="label accent">{sm.kicker}</p>
          <Lines id="smart-title" text={sm.title} className="t-xl" />
          <p className="lead muted reveal">{sm.text}</p>
          <Link href={href(locale, '/smart-kitchen')} className="btn reveal" data-magnetic>
            {sm.cta}
            <Icon name="arrow" className="arrow" />
          </Link>
        </div>
        <div className={`${s.smartDrawing} reveal`} aria-hidden="true">
          <svg viewBox="0 0 520 420">
            <g className={s.cab}>
              <rect x="60" y="40" width="300" height="340" />
              <line x1="60" y1="380" x2="360" y2="380" />
            </g>
            <g className={`${s.drawer} ${s.d1}`}>
              <rect x="64" y="44" width="292" height="90" />
              <rect x="64" y="44" width="292" height="90" className={s.drawerBox} transform="translate(0 0)" />
              <line x1="190" y1="70" x2="230" y2="70" />
            </g>
            <g className={`${s.drawer} ${s.d2}`}>
              <rect x="64" y="138" width="292" height="114" />
              <line x1="190" y1="166" x2="230" y2="166" />
            </g>
            <g className={`${s.drawer} ${s.d3}`}>
              <rect x="64" y="256" width="292" height="120" />
              <line x1="190" y1="284" x2="230" y2="284" />
            </g>
            <g className={s.dims}>
              <line x1="60" y1="400" x2="360" y2="400" />
              <line x1="60" y1="394" x2="60" y2="406" />
              <line x1="360" y1="394" x2="360" y2="406" />
              <text x="210" y="415" textAnchor="middle">
                600
              </text>
              <line x1="390" y1="40" x2="390" y2="380" />
              <line x1="384" y1="40" x2="396" y2="40" />
              <line x1="384" y1="380" x2="396" y2="380" />
              <text x="402" y="214">
                740
              </text>
            </g>
          </svg>
          <ol className={s.principles}>
            {t.smart.principles.map((p, i) => (
              <li key={p.id}>
                <span className="index-num">0{i + 1}</span>
                <span>{p.title}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ tools as drawers */
export function ToolsDrawers({ locale, t }: P) {
  const tl = t.home.tools;
  const paths: Record<string, string> = { visualiser: '/visualiser', style: '/style-finder', planner: '/planner', designer: '/designer' };
  return (
    <section className={s.tools} aria-labelledby="tools-title">
      <div className="wrap">
        <header className={s.headRow}>
          <p className="label accent">{tl.kicker}</p>
          <Lines id="tools-title" text={tl.title} className="t-l" />
          <p className="muted measure reveal">{tl.text}</p>
        </header>
        <ul className={s.drawers}>
          {tl.items.map((it, i) => (
            <li key={it.id} className="reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <Link href={href(locale, paths[it.id])} className={s.drawerRow} data-cursor data-cursor-label={t.common.open}>
                <span className="index-num">0{i + 1}</span>
                <span className={s.drawerTitle}>{it.title}</span>
                <span className={s.drawerText}>{it.text}</span>
                <span className={s.drawerMeta}>{it.meta}</span>
                <span className={s.drawerPull} aria-hidden="true" />
                <Icon name="arrow" className={`flip-rtl ${s.drawerArrow}`} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ showrooms */
export function ShowroomsSection({ locale, t }: P) {
  const sh = t.home.showrooms;
  const names = Object.fromEntries(branches.map((b) => [b.id, t.showrooms.branches[b.id].name])) as Record<(typeof branches)[number]['id'], string>;
  return (
    <section className={s.showrooms} aria-labelledby="show-title">
      <div className={`wrap ${s.showGrid}`}>
        <div className={s.showMap}>
          <IsraelMap names={names} label={t.showrooms.mapLabel} newLabel={t.showrooms.isNew} factoryLabel={t.showrooms.factory} hrefFor={(id) => href(locale, `/showrooms#${id}`)} />
        </div>
        <div className={s.showText}>
          <p className="label accent">{sh.kicker}</p>
          <Lines id="show-title" text={sh.title} className="t-xl" />
          <p className="lead muted reveal">{sh.text}</p>
          <ul className={s.branchList}>
            {branches.map((b) => (
              <li key={b.id} className="reveal">
                <Link href={href(locale, `/book?branch=${b.id}`)}>
                  <span className={s.branchName}>
                    {t.showrooms.branches[b.id].name}
                    {b.isNew ? <span className="example-tag"> {t.showrooms.isNew}</span> : null}
                  </span>
                  <span className="muted t-small">{t.showrooms.hoursExample}</span>
                  <Icon name="arrow" size={16} className="flip-rtl" />
                </Link>
              </li>
            ))}
          </ul>
          <p className="t-small muted">
            <span className="example-tag">{t.meta.exampleData}</span>
          </p>
          <div className={s.ctaRow}>
            <Link href={href(locale, '/book')} className="btn" data-magnetic>
              {sh.cta}
              <Icon name="arrow" className="arrow" />
            </Link>
            <a href={`tel:${site.phone.tel}`} className="btn btn-ghost">
              <Icon name="phone" size={18} />
              <span className="visually-hidden">{sh.phoneLabel}</span>
              <span dir="ltr" className="nums">
                {site.phone.display}
              </span>
            </a>
            <a href={waLink(t.meta.siteName)} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={18} />
              {t.nav.whatsapp}
            </a>
          </div>
          {site.phone.example ? <p className="example-tag">{t.common.exampleNumber}</p> : null}
          <Link href={href(locale, '/showrooms')} className="link-line">
            {sh.all}
            <Icon name="arrow" size={16} className="flip-rtl" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ professionals + developer kitchens */
export function ProAndUpgrade({ locale, t }: P) {
  const pr = t.home.pro;
  const na = t.home.newApt;
  return (
    <section className={s.pro} aria-labelledby="pro-title">
      <div className="wrap">
        <header className={s.headRow}>
          <p className="label accent">{pr.kicker}</p>
          <Lines id="pro-title" text={pr.title} className="t-l" />
        </header>
        <div className={s.proGrid}>
          {[
            { ...pr.architects, to: '/professionals' },
            { ...pr.contractors, to: '/professionals#contractors' },
          ].map((b) => (
            <Link key={b.title} href={href(locale, b.to)} className={`${s.proCard} reveal`}>
              <svg className={s.proDrawing} viewBox="0 0 400 160" aria-hidden="true">
                <rect x="20" y="40" width="120" height="100" />
                <rect x="140" y="40" width="120" height="100" />
                <rect x="260" y="40" width="120" height="100" />
                <line x1="20" y1="20" x2="380" y2="20" />
                <line x1="20" y1="14" x2="20" y2="26" />
                <line x1="380" y1="14" x2="380" y2="26" />
              </svg>
              <h3 className="t-m">{b.title}</h3>
              <p className="muted">{b.text}</p>
              <span className="link-line">
                {b.cta}
                <Icon name="arrow" size={16} className="flip-rtl" />
              </span>
            </Link>
          ))}
        </div>
        <div className={`${s.upgrade} reveal`}>
          <div>
            <p className="label accent">{na.kicker}</p>
            <h3 className="t-l">{na.title}</h3>
            <p className="muted measure">{na.text}</p>
          </div>
          <ol className={s.upgradeSteps}>
            {t.newApt.steps.slice(0, 4).map((st, i) => (
              <li key={st.title}>
                <span className="index-num">0{i + 1}</span>
                <span>{st.title}</span>
              </li>
            ))}
          </ol>
          <Link href={href(locale, '/new-apartment')} className="btn btn-ghost" data-magnetic>
            {na.cta}
            <Icon name="arrow" className="arrow" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ app */
export function AppTeaser({ locale, t }: P) {
  const ap = t.home.app;
  return (
    <section className={s.app} aria-labelledby="app-title">
      <div className={`wrap ${s.appGrid}`}>
        <PhoneMock t={t} />
        <div>
          <p className="label accent">{ap.kicker}</p>
          <Lines id="app-title" text={ap.title} className="t-l" />
          <p className="lead muted reveal">{ap.text}</p>
          <Link href={href(locale, '/app')} className="link-line">
            {ap.cta}
            <Icon name="arrow" size={16} className="flip-rtl" />
          </Link>
        </div>
      </div>
    </section>
  );
}

export function PhoneMock({ t }: { t: Dict }) {
  const stages = t.app.stages;
  const now = 3;
  return (
    <div className={`${s.phone} reveal`} role="img" aria-label={`${t.app.title}. ${t.app.screensNote}`}>
      <div className={s.phoneScreen}>
        <div className={s.phoneTop}>
          <span className={s.phoneBrand}>Avivi Smart &amp; Simple</span>
        </div>
        <p className={s.phoneTitle}>{t.app.stagesTitle}</p>
        <ol className={s.phoneStages}>
          {stages.map((st, i) => (
            <li key={st} data-state={i < now ? 'done' : i === now ? 'now' : 'next'}>
              <span className={s.phoneDot} />
              <span>{st}</span>
              {i === now ? <span className={s.phoneNow}>{t.app.stageNow}</span> : null}
            </li>
          ))}
        </ol>
        <span className={s.phoneNote}>{t.app.screensNote}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ story */
export function StoryTeaser({ locale, t }: P) {
  const st = t.home.story;
  return (
    <section className={s.story} aria-labelledby="story-title">
      <div className={`wrap ${s.storyGrid}`}>
        <PhotoSlot
          alt={t.story.portrait}
          art={t.story.portraitArt}
          artLabel={t.meta.artDirection}
          renderLabel={t.meta.render}
          slotLabel={t.meta.photoSlot}
          ratio="4 / 5"
          className="reveal"
        />
        <div>
          <p className="label accent">{st.kicker}</p>
          <Lines id="story-title" text={st.title} className="t-xl" />
          <p className="lead reveal">{st.text}</p>
          <Link href={href(locale, '/story')} className="link-line">
            {st.cta}
            <Icon name="arrow" size={16} className="flip-rtl" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ magazine */
export const articleImages: Record<string, string> = {
  'small-kitchen-big-storage': 'room-a-light',
  'natural-wood-veneer': 'detail-specials',
  'before-your-showroom-visit': 'room-c-before',
};

export function MagazineTeaser({ locale, t }: P) {
  const mg = t.home.magazine;
  return (
    <section className={s.mag} aria-labelledby="mag-title">
      <div className="wrap">
        <header className={s.headSplit}>
          <div>
            <p className="label accent">{mg.kicker}</p>
            <Lines id="mag-title" text={mg.title} className="t-l" />
          </div>
          <Link href={href(locale, '/magazine')} className="link-line">
            {mg.cta}
            <Icon name="arrow" size={16} className="flip-rtl" />
          </Link>
        </header>
        <ul className={s.magList}>
          {t.magazine.articles.map((a, i) => (
            <li key={a.slug} className={`${i === 0 ? s.magLead : ''} reveal`}>
              <Link href={href(locale, `/magazine/${a.slug}`)} className={s.magItem}>
                <PhotoSlot
                  name={articleImages[a.slug]}
                  alt={a.title}
                  art={a.dek}
                  artLabel={t.meta.artDirection}
                  renderLabel={t.meta.render}
                  slotLabel={t.meta.photoSlot}
                  ratio={i === 0 ? '16 / 10' : '4 / 3'}
                  sizes={i === 0 ? '(max-width: 900px) 100vw, 60vw' : '(max-width: 900px) 100vw, 30vw'}
                />
                <span className={s.magMeta}>
                  <span>{a.category}</span>
                  <span className="example-tag">{t.magazine.demo}</span>
                </span>
                <span className={s.magTitle}>{a.title}</span>
                <span className="muted t-small">{a.dek}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ final */
export function FinalCta({ locale, t }: P) {
  const f = t.home.final;
  return (
    <section className={s.final} aria-labelledby="final-title">
      <div className="wrap">
        <Lines id="final-title" text={f.title} className="t-xxl" />
        <p className="lead muted reveal">{f.text}</p>
        <Link href={href(locale, '/book')} className="btn reveal" data-magnetic>
          {f.cta}
          <Icon name="arrow" className="arrow" />
        </Link>
      </div>
    </section>
  );
}
