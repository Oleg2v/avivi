import type { Metadata } from 'next';
import Link from 'next/link';
import { href } from '@/lib/i18n';
import { pageMeta } from '@/lib/meta';
import { resolveLocale, type LocaleParams } from '@/lib/page';
import { site, waLink } from '@/lib/site';
import { PageHead } from '@/components/ui/PageHead';
import { Icon } from '@/components/ui/Icon';
import { ContactForm } from '@/components/pages/ContactForm';
import s from '@/components/pages/Pages.module.css';

export async function generateMetadata({ params }: LocaleParams): Promise<Metadata> {
  const { locale, t } = await resolveLocale(params);
  return pageMeta(locale, '/contact', t.contact.title, t.contact.intro);
}

export default async function ContactPage({ params }: LocaleParams) {
  const { locale, t } = await resolveLocale(params);
  const c = t.contact;
  const channels = [
    { key: 'sales', ...c.sales, phone: site.phone, email: site.email.sales, link: { path: '/book', label: t.common.bookVisit } },
    { key: 'service', ...c.service, phone: site.servicePhone, email: site.email.service, link: { path: '/service', label: t.service.title } },
    { key: 'pro', ...c.pro, phone: site.phone, email: site.email.pro, link: { path: '/professionals', label: t.pro.title } },
  ];
  return (
    <>
      <PageHead locale={locale} home={t.nav.home} crumbs={[{ label: c.title }]} title={c.title} intro={c.intro} />
      <div className="wrap">
        <section className={`${s.cards} ${s.section}`} aria-label={c.title}>
          {channels.map((ch) => (
            <article key={ch.key} className={s.card}>
              <h2 className={s.cardTitle}>{ch.title}</h2>
              <p className="muted">{ch.text}</p>
              <p>
                <a href={`tel:${ch.phone.tel}`} className="link-line nums" dir="ltr">
                  {ch.phone.display}
                </a>{' '}
                {ch.phone.example ? <span className="example-tag">{t.common.exampleNumber}</span> : null}
              </p>
              <p>
                <a href={`mailto:${ch.email}`} className="link-line" dir="ltr">
                  {ch.email}
                </a>{' '}
                {site.email.example ? <span className="example-tag">{t.common.exampleAddress}</span> : null}
              </p>
              <p style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBlockStart: 6 }}>
                <a href={waLink(ch.title)} target="_blank" rel="noopener noreferrer" className="link-line">
                  WhatsApp
                </a>
                <Link href={href(locale, ch.link.path)} className="link-line">
                  {ch.link.label}
                </Link>
              </p>
            </article>
          ))}
        </section>
        <div className={`${s.split} ${s.section}`}>
          <div className={s.sticky}>
            <p className="label muted">{c.phoneHours}</p>
            <p className="t-s nums" style={{ marginBlock: '8px 10px' }}>
              {c.phoneHoursExample}
            </p>
            <span className="example-tag">{t.meta.example}</span>
            <p style={{ marginBlockStart: 28 }}>
              <Link href={href(locale, '/designer')} className="btn btn-ghost">
                <Icon name="sparkle" size={18} /> {t.common.askDesigner}
              </Link>
            </p>
          </div>
          <ContactForm locale={locale} t={c.form} common={t.common} />
        </div>
      </div>
    </>
  );
}
