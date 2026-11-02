import type { Metadata } from 'next';
import { collections, type CollectionId } from '@/lib/data/collections';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { Planner } from '@/components/planner/Planner';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/planner', t.planner.title, t.planner.intro);
}

export default async function PlannerPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const names = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].name])) as Record<CollectionId, string>;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.nav.tools }, { label: t.planner.title }]} kicker="SMART KITCHEN" title={t.planner.title} intro={t.planner.intro} />
      <div className="wrap">
        <Planner locale={locale} t={t.planner} collectionNames={names} common={t.common} exampleLabel={t.meta.example} />
      </div>
    </>
  );
}
