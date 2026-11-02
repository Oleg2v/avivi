import type { Metadata } from 'next';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { CookieSettings } from '@/components/pages/CookieSettings';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/cookies', t.cookies.title, t.cookies.intro);
}

export default async function CookiesPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.cookies.title }]} title={t.cookies.title} intro={t.cookies.intro} />
      <div className="wrap">
        <CookieSettings t={t.cookies} />
      </div>
    </>
  );
}
