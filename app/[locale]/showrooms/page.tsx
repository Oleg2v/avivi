import type { Metadata } from 'next';
import Link from 'next/link';
import { branches, mapsUrl, wazeUrl, type BranchId } from '@/lib/data/branches';
import { href } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { IsraelMap } from '@/components/ui/IsraelMap';
import { Icon } from '@/components/ui/Icon';
import s from '@/components/showrooms/Showrooms.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/showrooms', t.showrooms.title, t.showrooms.intro);
}

export default async function ShowroomsPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const sr = t.showrooms;
  const names = Object.fromEntries(branches.map((b) => [b.id, sr.branches[b.id].name])) as Record<BranchId, string>;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: sr.title }]} kicker={t.home.showrooms.kicker} title={sr.title} intro={sr.intro} />
      <div className={`wrap ${s.layout}`}>
        <div className={s.mapCol}>
          <IsraelMap names={names} label={sr.mapLabel} newLabel={sr.isNew} factoryLabel={sr.factory} hrefFor={(id) => `#${id}`} />
        </div>
        <ol className={s.list}>
          {branches.map((b, i) => (
            <li key={b.id} id={b.id} className={s.branch}>
              <div className={s.top}>
                <span className="index-num">{String(i + 1).padStart(2, '0')}</span>
                <h2 className={s.name}>{names[b.id]}</h2>
                <span className={s.tags}>
                  {b.isNew ? <span className={`${s.tag} ${s.tagNew}`}>{sr.isNew}</span> : null}
                  {b.factory ? <span className={s.tag}>{sr.factory}</span> : null}
                </span>
              </div>
              <p className={s.area}>{sr.branches[b.id].area}</p>
              <dl className={s.facts}>
                <div>
                  <dt>{sr.hours}</dt>
                  <dd>
                    <span className="nums">{sr.hoursExample}</span>
                    <span className="example-tag">{t.meta.example}</span>
                  </dd>
                </div>
                <div>
                  <dt>{sr.address}</dt>
                  <dd>
                    <span className="example-tag">{sr.addressToConfirm}</span>
                  </dd>
                </div>
              </dl>
              <div className={s.actions}>
                <Link href={`${href(locale, '/book')}?branch=${b.id}`} className="btn btn-small" data-magnetic>
                  {sr.book}
                  <Icon name="arrow" className="arrow" />
                </Link>
                <a className="link-line" href={mapsUrl(b, locale)} target="_blank" rel="noopener noreferrer">
                  {sr.directions}
                </a>
                <a className="link-line" href={wazeUrl(b)} target="_blank" rel="noopener noreferrer">
                  {sr.waze}
                </a>
              </div>
            </li>
          ))}
        </ol>
      </div>
      <div className="wrap">
        <section className={s.cta} aria-labelledby="sr-cta">
          <h2 id="sr-cta" className="display">
            {t.home.tools.title}
          </h2>
          <div className={s.ctaRow}>
            <Link href={href(locale, '/visualiser')} className="btn btn-ghost">
              {t.common.visualise}
            </Link>
            <Link href={href(locale, '/planner')} className="btn btn-ghost">
              {t.common.plan}
            </Link>
            <Link href={href(locale, '/designer')} className="btn btn-ghost">
              {t.common.askDesigner}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
