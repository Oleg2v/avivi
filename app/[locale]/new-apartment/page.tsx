import type { Metadata } from 'next';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { render } from '@/lib/renders';
import { PageHead } from '@/components/ui/PageHead';
import { BeforeAfter } from '@/components/ui/BeforeAfter';
import { Icon } from '@/components/ui/Icon';
import { LeadForm } from '@/components/pro/ProForms';
import s from '@/components/pages/Pages.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/new-apartment', t.newApt.title, t.newApt.intro);
}

export default async function NewApartmentPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const n = t.newApt;
  const before = render('room-b-before')!;
  const after = render('room-b-light')!;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: t.nav.tools }, { label: n.title }]} title={n.title} intro={n.intro} />
      <div className="wrap">
        <section className={s.section} aria-labelledby="na-compare">
          <h2 id="na-compare" className={`${s.h2}`} style={{ marginBlockEnd: 20 }}>
            {n.compare.title}
          </h2>
          <BeforeAfter
            before={{ ...before, alt: `${n.compare.standard} · ${t.meta.render}` }}
            after={{ ...after, alt: `${n.compare.upgraded} · ${t.meta.render}` }}
            beforeLabel={n.compare.standard}
            afterLabel={n.compare.upgraded}
            dragLabel={t.visualiser.result.drag}
            sizes="(max-width: 1100px) 100vw, 1200px"
          />
          <p className={s.meta} style={{ marginBlockStart: 10 }}>
            {t.meta.renderNote}
          </p>
        </section>
        <div className={`${s.split} ${s.section}`}>
          <div className={s.sticky}>
            <ol className={s.steps}>
              {n.steps.map((st) => (
                <li key={st.title}>
                  <span className={s.stepTitle}>{st.title}</span>
                  <span className={s.stepText}>{st.text}</span>
                </li>
              ))}
            </ol>
            <p className={s.note} style={{ marginBlockStart: 20 }}>
              <Icon name="sparkle" size={16} />
              {n.note}
            </p>
          </div>
          <LeadForm
            locale={locale}
            common={t.common}
            type="developer"
            title={n.form.title}
            submit={n.form.submit}
            success={n.form.success}
            fields={[
              { k: 'developer', label: n.form.developer, auto: 'organization' },
              { k: 'project', label: n.form.project },
              { k: 'handover', label: n.form.handover, type: 'month', optional: true },
            ]}
          />
        </div>
      </div>
    </>
  );
}
