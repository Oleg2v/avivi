import type { Metadata } from 'next';
import { collections, type CollectionId } from '@/lib/data/collections';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { MyDesign } from '@/components/pages/MyDesign';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/my-design', t.myDesign.title, t.myDesign.intro);
}

export default async function MyDesignPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const collectionNames = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].name])) as Record<CollectionId, string>;
  const roomTitles = { a: t.visualiser.examples.a.title, b: t.visualiser.examples.b.title, c: t.visualiser.examples.c.title };
  const productNames = Object.fromEntries(Object.entries(t.products.items).map(([id, p]) => [id, p.name]));
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.myDesign.title }]} title={t.myDesign.title} intro={t.myDesign.intro} />
      <div className="wrap">
        <MyDesign
          locale={locale}
          t={t.myDesign}
          common={t.common}
          collectionNames={collectionNames}
          roomTitles={roomTitles}
          productNames={productNames}
          planShapes={t.planner.shapes}
          tools={[
            { path: '/visualiser', label: t.common.visualise },
            { path: '/style-finder', label: t.common.findStyle },
            { path: '/planner', label: t.common.plan },
            { path: '/products', label: t.products.title },
          ]}
        />
      </div>
    </>
  );
}
