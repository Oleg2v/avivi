import type { Metadata } from 'next';
import { collections, type CollectionId } from '@/lib/data/collections';
import { collectionImages, render } from '@/lib/renders';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { StyleFinder } from '@/components/style/StyleFinder';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/style-finder', t.style.title, t.style.intro);
}

export default async function StylePage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const names = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].name])) as Record<CollectionId, string>;
  const taglines = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].tagline])) as Record<CollectionId, string>;
  const heroes = Object.fromEntries(collections.map((c) => [c.id, render(collectionImages[c.id][0]) ?? null])) as Record<CollectionId, ReturnType<typeof render> | null>;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.nav.tools }, { label: t.style.title }]} title={t.style.title} intro={t.style.intro} />
      <div className="wrap">
        <StyleFinder locale={locale} t={t.style} collectionNames={names} taglines={taglines} heroes={heroes as Record<CollectionId, { src: string; w: number; h: number; blur: string } | null>} common={t.common} />
      </div>
    </>
  );
}
