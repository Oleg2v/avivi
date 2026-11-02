import Link from 'next/link';
import type { Dict } from '@/content/en';
import { href, locales, localeNames, type Locale } from '@/lib/i18n';
import { site, waLink } from '@/lib/site';
import { branches } from '@/lib/data/branches';
import { Wordmark } from './Wordmark';
import { Icon } from '@/components/ui/Icon';
import s from './Footer.module.css';

const CONCEPT_EN = 'Design concept. Not the official Avivi Kitchens website.';

export function Footer({ locale, t }: { locale: Locale; t: Dict }) {
  const cols: { title: string; links: [string, string][] }[] = [
    {
      title: t.nav.collections,
      links: [
        ['/collections/modern', t.collections.items.modern.name],
        ['/collections/classic', t.collections.items.classic.name],
        ['/collections/dark', t.collections.items.dark.name],
        ['/collections/light', t.collections.items.light.name],
        ['/collections/specials', t.collections.items.specials.name],
        ['/smart-kitchen', t.nav.smart],
      ],
    },
    {
      title: t.nav.groups.tools,
      links: [
        ['/visualiser', t.nav.visualiser],
        ['/style-finder', t.nav.styleFinder],
        ['/planner', t.nav.planner],
        ['/designer', t.nav.designer],
        ['/my-design', t.nav.myDesign],
      ],
    },
    {
      title: t.nav.groups.company,
      links: [
        ['/story', t.nav.story],
        ['/professionals', t.nav.professionals],
        ['/new-apartment', t.nav.newApartment],
        ['/products', t.nav.products],
        ['/app', t.nav.app],
        ['/magazine', t.nav.magazine],
      ],
    },
    {
      title: t.nav.groups.visit,
      links: [
        ['/book', t.nav.book],
        ['/service', t.nav.service],
        ['/contact', t.nav.contact],
        ['/accessibility', t.nav.accessibility],
        ['/privacy', t.nav.privacy],
        ['/cookies', t.nav.cookies],
      ],
    },
  ];

  return (
    <footer className={s.footer} data-theme="dark">
      <div className={`wrap ${s.top}`}>
        <div className={s.visit}>
          <p className={`display ${s.visitTitle}`}>{t.footer.visit}</p>
          <p className="muted">{t.footer.visitText}</p>
          <div className={s.ctaRow}>
            <Link href={href(locale, '/book')} className="btn" data-magnetic>
              {t.nav.book}
              <Icon name="arrow" className="arrow" />
            </Link>
            <a href={`tel:${site.phone.tel}`} className="btn btn-ghost">
              <Icon name="phone" size={18} />
              <span dir="ltr" className="nums">
                {site.phone.display}
              </span>
            </a>
            <a href={waLink(t.meta.siteName)} className="btn btn-ghost" target="_blank" rel="noopener noreferrer">
              <Icon name="chat" size={18} />
              {t.nav.whatsapp}
            </a>
          </div>
          {site.phone.example ? <span className="example-tag">{t.common.exampleNumber}</span> : null}
        </div>
        <ul className={s.branches} aria-label={t.nav.showrooms}>
          {branches.map((b) => (
            <li key={b.id}>
              <Link href={href(locale, `/showrooms#${b.id}`)}>{t.showrooms.branches[b.id].name}</Link>
              <span className="muted">{t.showrooms.hoursExample}</span>
            </li>
          ))}
          <li className={s.branchNote}>
            <span className="example-tag">{t.meta.exampleData}</span>
          </li>
        </ul>
      </div>

      <div className={`wrap ${s.cols}`}>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="label muted">{c.title}</p>
            <ul>
              {c.links.map(([p, label]) => (
                <li key={p}>
                  <Link href={href(locale, p)}>{label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className={`wrap ${s.bottom}`}>
        <Link href={href(locale, '/')} aria-label={t.meta.siteName} className={s.mark}>
          <Wordmark locale={locale} />
        </Link>
        <nav aria-label={t.footer.languages} className={s.langs}>
          {locales.map((l) => (
            <a key={l} href={href(l, '/')} hrefLang={l} lang={l} aria-current={l === locale ? 'true' : undefined}>
              {localeNames[l]}
            </a>
          ))}
        </nav>
        <p className={s.concept}>
          <span>{t.meta.concept}</span>
          {locale !== 'en' ? (
            <span lang="en" dir="ltr">
              {CONCEPT_EN}
            </span>
          ) : null}
        </p>
        <p className={s.rights}>
          {t.footer.rights} · {site.domain} · <Link href={href(locale, '/inbox')}>{t.nav.inbox}</Link>
        </p>
      </div>
    </footer>
  );
}
