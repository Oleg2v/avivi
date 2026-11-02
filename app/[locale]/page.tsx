import type { Metadata } from 'next';
import { getDict } from '@/lib/dict';
import { isLocale, type Locale } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { Hero } from '@/components/home/hero/Hero';
import {
  AppTeaser,
  CollectionsChapters,
  Facts,
  FinalCta,
  MagazineTeaser,
  MaterialSection,
  ProAndUpgrade,
  ShowroomsSection,
  SmartTeaser,
  StoryTeaser,
  ToolsDrawers,
  VisualiserTeaser,
} from '@/components/home/Sections';

type Props = { params: Promise<{ locale: string }> };

async function loc(params: Props['params']): Promise<Locale> {
  const { locale } = await params;
  return isLocale(locale) ? locale : 'he';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await loc(params);
  const t = getDict(l);
  return { ...pageMeta(l, '/', t.meta.titleSuffix, t.meta.description), title: { absolute: `${t.home.hero.lines.join(' ')} · ${t.meta.titleSuffix}` } };
}

export default async function Home({ params }: Props) {
  const locale = await loc(params);
  const t = getDict(locale);
  const p = { locale, t };
  return (
    <>
      <Hero {...p} />
      <Facts {...p} />
      <VisualiserTeaser {...p} />
      <CollectionsChapters {...p} />
      <MaterialSection {...p} />
      <SmartTeaser {...p} />
      <ToolsDrawers {...p} />
      <ShowroomsSection {...p} />
      <ProAndUpgrade {...p} />
      <AppTeaser {...p} />
      <StoryTeaser {...p} />
      <MagazineTeaser {...p} />
      <FinalCta {...p} />
    </>
  );
}
