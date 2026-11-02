import Link from 'next/link';
import type { Metadata } from 'next';
import { href } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { Icon } from '@/components/ui/Icon';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { SmartKitchen3D } from '@/components/smart/SmartKitchen3D';
import s from '@/components/smart/SmartPage.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/smart-kitchen', 'SMART KITCHEN', t.smart.intro);
}

export default async function SmartKitchenPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const sm = t.smart;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: 'SMART KITCHEN' }]} kicker={sm.kicker} title={sm.title} intro={sm.intro} />
      <SmartKitchen3D principles={sm.principles} modules={sm.modules} modulesTitle={sm.modulesTitle} scrollHint={sm.scrollHint} canvasLabel={sm.canvasLabel} principleLabel={sm.principle} />

      <section className={`wrap ${s.modules}`} aria-labelledby="mods-title">
        <h2 id="mods-title" className="t-l">
          {sm.modulesTitle}
        </h2>
        <dl className={s.modList}>
          {Object.entries(sm.modules).map(([k, v], i) => (
            <div key={k} className="reveal">
              <dt className="index-num">0{i + 1}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={s.tech} aria-labelledby="tech-title">
        <div className="wrap">
          <h2 id="tech-title" className="t-l">
            {sm.tech.title}
          </h2>
          <ul className={s.techList}>
            {sm.tech.items.map((it, i) => (
              <li key={it.title} className="reveal">
                <span className="index-num">0{i + 1}</span>
                <h3 className="t-m">{it.title}</h3>
                <p className="muted">{it.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={`wrap ${s.veneer}`} aria-labelledby="veneer-title">
        <PhotoSlot
          name="detail-specials"
          alt={`${sm.veneer.title} ${t.collections.items.specials.art[3]}`}
          art={t.collections.items.specials.art[3]}
          artLabel={t.meta.artDirection}
          renderLabel={t.meta.render}
          slotLabel={t.meta.photoSlot}
          ratio="4 / 3"
        />
        <div className={s.veneerText}>
          <p className="label accent">{sm.veneer.kicker}</p>
          <h2 id="veneer-title" className="t-xl">
            {sm.veneer.title}
          </h2>
          <p className="lead muted">{sm.veneer.text}</p>
          <Link href={`${href(locale, '/')}#material`} className="link-line">
            {sm.veneer.cta}
            <Icon name="arrow" size={16} className="flip-rtl" />
          </Link>
        </div>
      </section>

      <section className={`wrap ${s.cta}`}>
        <Link href={href(locale, '/planner')} className="btn" data-magnetic>
          {t.common.plan}
          <Icon name="arrow" className="arrow" />
        </Link>
        <Link href={href(locale, '/book')} className="btn btn-ghost" data-magnetic>
          {t.common.bookVisit}
        </Link>
      </section>
    </>
  );
}
