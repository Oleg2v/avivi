import type { Metadata } from 'next';
import { collections, type CollectionId } from '@/lib/data/collections';
import { render } from '@/lib/renders';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { Visualiser } from '@/components/visualiser/Visualiser';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/visualiser', t.visualiser.title, t.visualiser.intro);
}

export default async function VisualiserPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const names = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].name])) as Record<CollectionId, string>;
  const taglines = Object.fromEntries(collections.map((c) => [c.id, t.collections.items[c.id].tagline])) as Record<CollectionId, string>;
  const renders: Record<string, { src: string; w: number; h: number; blur: string }> = {};
  for (const r of ['a', 'b', 'c']) {
    for (const k of ['before', ...collections.map((c) => c.id)]) {
      const key = `room-${r}-${k}`;
      const info = render(key);
      if (info) renders[key] = info;
    }
  }
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.nav.tools }, { label: t.visualiser.title }]} kicker="AI" title={t.visualiser.title} intro={t.visualiser.intro} />
      <div className="wrap">
        <Visualiser locale={locale} t={t.visualiser} common={t.common} meta={t.meta} collectionNames={names} taglines={taglines} renders={renders} />
      </div>
    </>
  );
}
