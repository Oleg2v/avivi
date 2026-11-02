import type { Metadata } from 'next';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { DesignerChat } from '@/components/designer/DesignerChat';
import { AskExamples } from '@/components/designer/AskExamples';
import s from '@/components/designer/DesignerPage.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/designer', t.designer.title, t.designer.intro);
}

export default async function DesignerPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const d = t.designer;
  return (
    <PageHead
      locale={locale}
      home={t.nav.home}
      crumbs={[{ label: t.nav.tools }, { label: d.name }]}
      kicker={d.pageKicker}
      title={d.title}
      intro={d.intro}
      side={
        <div id="designer-chat" className={s.chat}>
          <DesignerChat variant="page" />
        </div>
      }
    >
      <div className={s.aside}>
        <section className={s.block} aria-labelledby="dz-try">
          <h2 id="dz-try" className="label muted">
            {d.tryTitle}
          </h2>
          <AskExamples items={[...d.suggestions, ...d.examples]} label={d.tryTitle} />
          <p className={s.note} style={{ marginBlockStart: 14 }}>
            {d.languagesNote}
          </p>
        </section>
        <section className={s.block} aria-labelledby="dz-can">
          <h2 id="dz-can" className="label muted">
            {d.canTitle}
          </h2>
          <ul className={s.can}>
            {d.canItems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
        <section className={s.block} aria-labelledby="dz-cant">
          <h2 id="dz-cant" className="label muted">
            {d.cantTitle}
          </h2>
          <ul className={s.cant}>
            {d.cantItems.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      </div>
    </PageHead>
  );
}
