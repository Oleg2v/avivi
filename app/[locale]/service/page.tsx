import type { Metadata } from 'next';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { PageHead } from '@/components/ui/PageHead';
import { Icon } from '@/components/ui/Icon';
import { ServiceForm } from '@/components/service/ServiceForm';
import s from '@/components/pages/Pages.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/service', t.service.title, t.service.intro);
}

export default async function ServicePage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const sv = t.service;
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: sv.title }]} title={sv.title} intro={sv.intro} />
      <div className="wrap">
        <div className={`${s.split} ${s.section}`}>
          <ServiceForm locale={locale} t={sv} common={t.common} />
          <section aria-labelledby="sv-w" className={s.sticky}>
            <h2 id="sv-w" className={s.h2} style={{ marginBlockEnd: 14 }}>
              {sv.warranty.title}
            </h2>
            <table className={s.table}>
              <thead>
                <tr>
                  <th scope="col">{sv.warranty.head[0]}</th>
                  <th scope="col">{sv.warranty.head[1]}</th>
                </tr>
              </thead>
              <tbody>
                {sv.warranty.rows.map(([part, terms]) => (
                  <tr key={part}>
                    <td>{part}</td>
                    <td>
                      <span className="example-tag">{terms}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className={s.note} style={{ marginBlockStart: 16 }}>
              <Icon name="sparkle" size={16} />
              {sv.warranty.note}
            </p>
          </section>
        </div>
        <section className={s.section} aria-labelledby="sv-care" id="care">
          <h2 id="sv-care" className={s.h2l} style={{ marginBlockEnd: 24 }}>
            {sv.care.title}
          </h2>
          <div className={s.cards}>
            {sv.care.items.map((c) => (
              <article key={c.title} className={s.card}>
                <h3 className={s.cardTitle}>{c.title}</h3>
                <p className="muted">{c.text}</p>
              </article>
            ))}
          </div>
          <p className={s.meta} style={{ marginBlockStart: 16 }}>
            {sv.care.note}
          </p>
        </section>
      </div>
    </>
  );
}
