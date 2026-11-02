import Link from 'next/link';
import type { Metadata } from 'next';
import { collections } from '@/lib/data/collections';
import { collectionImages } from '@/lib/renders';
import { href } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { PhotoSlot } from '@/components/ui/PhotoSlot';
import { Icon } from '@/components/ui/Icon';
import { swatchStyle } from '@/components/ui/swatch';
import s from '@/components/collections/Collection.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/collections', t.collections.title, t.collections.intro);
}

export default async function CollectionsPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.collections.title }]} title={t.collections.title} intro={t.collections.intro} />
      <section className={`wrap ${s.index}`}>
        {collections.map((c, i) => {
          const it = t.collections.items[c.id];
          return (
            <article key={c.id} className={`${s.indexRow} reveal`}>
              <Link href={href(locale, `/collections/${c.id}`)} className={s.indexLink} data-cursor data-cursor-label={t.common.open}>
                <PhotoSlot
                  name={collectionImages[c.id][0]}
                  alt={`${it.name}: ${it.art[0]}`}
                  art={it.art[0]}
                  artLabel={t.meta.artDirection}
                  renderLabel={t.meta.render}
                  slotLabel={t.meta.photoSlot}
                  ratio="16 / 10"
                  sizes="(max-width: 900px) 100vw, 55vw"
                  priority={i === 0}
                />
                <div className={s.indexText}>
                  <span className="index-num">0{i + 1} / 05</span>
                  <h2 className={s.indexName}>{it.name}</h2>
                  <p className={s.indexTag}>{it.tagline}</p>
                  <p className="muted">{it.intro}</p>
                  <ul className={s.swatchRow} aria-hidden="true">
                    {c.swatches.map((sw, k) => (
                      <li key={k} style={swatchStyle(sw)} />
                    ))}
                  </ul>
                  <span className="link-line">
                    {t.home.collections.explore}
                    <Icon name="arrow" size={16} className="flip-rtl" />
                  </span>
                </div>
              </Link>
            </article>
          );
        })}
      </section>
    </>
  );
}
