import type { Metadata } from 'next';
import Link from 'next/link';
import { branches, type BranchId } from '@/lib/data/branches';
import { href } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { IsraelMap } from '@/components/ui/IsraelMap';
import { Icon } from '@/components/ui/Icon';
import s from '@/components/story/Story.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/story', t.story.title, t.story.intro);
}

export default async function StoryPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const st = t.story;
  const names = Object.fromEntries(branches.map((b) => [b.id, t.showrooms.branches[b.id].name])) as Record<BranchId, string>;
  const soft = (y: string) => !/^\d{4}$/.test(y);
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: st.title }]} title={st.title} intro={st.intro} />
      <div className="wrap">
        <section className={s.open} aria-label={st.portrait}>
          <div className={s.openText}>
            <p className={`${s.big} nums`}>{st.chapters[0].year}</p>
            <h2 className={s.chTitle}>{st.chapters[0].title}</h2>
            <p className="lead muted">{st.chapters[0].text}</p>
          </div>
          <PhotoSlot alt={st.portrait} caption={st.portrait} art={st.portraitArt} artLabel={t.meta.artDirection} renderLabel={t.meta.render} slotLabel={t.meta.photoSlot} ratio="4 / 5" />
        </section>

        <ol className={s.timeline}>
          {st.chapters.slice(1).map((c, i) => (
            <li key={i} className={`${s.chapter} reveal`}>
              <p className={`${s.year} ${soft(c.year) ? s.yearSoft : ''}`}>{c.year}</p>
              <div>
                <h2 className={s.chTitle}>{c.title}</h2>
                <p className={s.chText}>{c.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className={s.factories} aria-labelledby="st-fac">
          <div className={s.mapWrap}>
            <IsraelMap names={names} label={st.factories.title} factoryLabel={t.showrooms.factory} newLabel={t.showrooms.isNew} hrefFor={(id) => href(locale, `/showrooms#${id}`)} />
          </div>
          <div>
            <h2 id="st-fac" className="label muted" style={{ marginBlockEnd: 16 }}>
              {st.factories.title}
            </h2>
            <div className={s.factoryList}>
              {[st.factories.karmiel, st.factories.darom].map((f) => (
                <div key={f.name} className={s.factory}>
                  <p className={s.factoryName}>{f.name}</p>
                  <p className="muted">{f.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <section className={s.future} data-theme="dark" aria-labelledby="st-future">
        <div className={`wrap ${s.futureInner}`}>
          <p className="label accent">{st.future.kicker}</p>
          <h2 id="st-future" className={s.futureTitle}>
            {st.future.title}
          </h2>
          <p className="lead muted">{st.future.text}</p>
          <dl className={s.figures}>
            {st.future.figures.map((f) => (
              <div key={f.label} className={s.figure}>
                <dt className={`${s.figValue} nums`}>{f.value}</dt>
                <dd className={s.figLabel}>{f.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="wrap">
        <section className={s.family} aria-labelledby="st-family">
          <h2 id="st-family" className={s.familyTitle}>
            {st.family.title}
          </h2>
          <p className="lead muted">{st.family.text}</p>
          <div>
            <Link href={href(locale, '/showrooms')} className="btn" data-magnetic>
              {t.footer.visit}
              <Icon name="arrow" className="arrow" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
