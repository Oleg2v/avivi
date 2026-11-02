import type { Metadata } from 'next';
import Link from 'next/link';
import { href, localeTag } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { articleArt } from '@/lib/magazine';
import { fmt } from '@/lib/fmt';
import { PageHead } from '@/components/ui/PageHead';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Icon } from '@/components/ui/Icon';
import s from '@/components/magazine/Magazine.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/magazine', t.magazine.title, t.magazine.intro);
}

export default async function MagazinePage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const m = t.magazine;
  const date = new Intl.DateTimeFormat(localeTag[locale], { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: m.title }]} title={m.title} intro={m.intro}>
        <p className="example-tag">{m.demo}</p>
      </PageHead>
      <div className="wrap">
        <ol className={s.list}>
          {m.articles.map((a, i) => (
            <li key={a.slug} className={`${s.item} reveal`}>
              <Link href={href(locale, `/magazine/${a.slug}`)} data-cursor data-cursor-label={m.read}>
                <div className={s.media}>
                  <PhotoSlot name={articleArt[a.slug]?.image} alt={a.title} art={t.meta.renderNote} artLabel={t.meta.artDirection} renderLabel={t.meta.render} slotLabel={t.meta.photoSlot} priority={i === 0} sizes="(max-width: 900px) 100vw, 58vw" />
                </div>
                <div>
                  <p className={s.meta}>
                    <span className={s.cat}>{a.category}</span>
                    <time dateTime={a.date}>{date.format(new Date(a.date))}</time>
                    <span>{fmt(m.readTime, { n: a.minutes })}</span>
                  </p>
                  <h2 className={s.title}>{a.title}</h2>
                  <p className={s.dek}>{a.dek}</p>
                  <span className={`${s.read} link-line`}>
                    {m.read}
                    <Icon name="arrow" size={16} className="flip-rtl" />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </>
  );
}
