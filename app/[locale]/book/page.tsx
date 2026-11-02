import type { Metadata } from 'next';
import { collections, type CollectionId } from '@/lib/data/collections';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { Booking } from '@/components/book/Booking';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/book', t.book.title, t.book.intro);
}

export default async function BookPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const collectionNames = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].name])) as Record<CollectionId, string>;
  const roomTitles = { a: t.visualiser.examples.a.title, b: t.visualiser.examples.b.title, c: t.visualiser.examples.c.title };
  const productNames = Object.fromEntries(Object.entries(t.products.items).map(([id, p]) => [id, p.name]));
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.nav.showrooms, path: '/showrooms' }, { label: t.book.title }]} title={t.book.title} intro={t.book.intro} />
      <div className="wrap">
        <Booking
          locale={locale}
          t={t.book}
          common={t.common}
          sr={t.showrooms}
          collectionNames={collectionNames}
          roomTitles={roomTitles}
          productNames={productNames}
          productsTitle={t.products.title}
          planShapes={t.planner.shapes}
        />
      </div>
    </>
  );
}
