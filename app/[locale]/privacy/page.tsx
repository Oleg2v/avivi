import type { Metadata } from 'next';
import Link from 'next/link';
import { href } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import s from '@/components/pages/Pages.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/privacy', t.privacy.title);
}

export default async function PrivacyPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const p = t.privacy;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: p.title }]} title={p.title}>
        <p className="example-tag">{p.updated}</p>
      </PageHead>
      <div className={`wrap ${s.legal}`}>
        {p.sections.map((sec) => (
          <section key={sec.h}>
            <h2>{sec.h}</h2>
            {sec.p.map((x) => (
              <p key={x}>{x}</p>
            ))}
          </section>
        ))}
        <p>
          <Link href={href(locale, '/cookies')} className="link-line">
            {t.cookies.title}
          </Link>
        </p>
      </div>
    </>
  );
}
