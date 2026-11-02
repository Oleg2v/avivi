import type { Metadata } from 'next';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import s from '@/components/pages/Pages.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/accessibility', t.accessibility.title, t.accessibility.intro);
}

export default async function AccessibilityPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const a = t.accessibility;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: a.title }]} title={a.title} intro={a.intro}>
        <p className={s.meta}>{a.updated}</p>
      </PageHead>
      <div className={`wrap ${s.legal}`}>
        {a.sections.map((sec) => (
          <section key={sec.h}>
            <h2>{sec.h}</h2>
            {sec.p.length > 2 ? (
              <ul>
                {sec.p.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            ) : (
              sec.p.map((p) => <p key={p}>{p}</p>)
            )}
          </section>
        ))}
      </div>
    </>
  );
}
