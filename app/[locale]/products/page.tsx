import type { Metadata } from 'next';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { Products } from '@/components/products/Products';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/products', t.products.title, t.products.intro);
}

export default async function ProductsPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.products.title }]} title={t.products.title} intro={t.products.intro} />
      <div className="wrap">
        <Products locale={locale} t={t.products} myDesignLabel={t.myDesign.title} bookLabel={t.myDesign.bookAll} />
      </div>
    </>
  );
}
