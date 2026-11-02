import Link from 'next/link';
import { href, type Locale } from '@/lib/i18n';
import s from './PageHead.module.css';

/** Interior page header: breadcrumb, title and lead. Visible at first paint (CSS-only entrance, no JS gate). */
export function PageHead({
  locale,
  home,
  crumbs = [],
  kicker,
  title,
  intro,
  children,
  theme,
  side,
}: {
  locale: Locale;
  home: string;
  crumbs?: { label: string; path?: string }[];
  kicker?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
  theme?: 'dark';
  /** Split layout: a tool shown beside the heading on desktop, right after it on mobile. */
  side?: React.ReactNode;
}) {
  const heading = (
    <>
      <nav aria-label="Breadcrumb" className={s.crumbs}>
        <ol>
          <li>
            <Link href={href(locale, '/')}>{home}</Link>
          </li>
          {crumbs.map((c) => (
            <li key={c.label}>{c.path ? <Link href={href(locale, c.path)}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}</li>
          ))}
        </ol>
      </nav>
      {kicker ? <p className="label accent">{kicker}</p> : null}
      <h1 className={`rise ${s.title}`}>{title}</h1>
      {intro ? <p className={`lead muted rise rise-2 ${s.intro}`}>{intro}</p> : null}
    </>
  );
  if (side) {
    return (
      <header className={`${s.head} ${s.split}`} data-theme={theme}>
        <div className="wrap">
          <div className={s.main}>{heading}</div>
          <div className={s.side}>{side}</div>
          {children ? <div className={s.extra}>{children}</div> : null}
        </div>
      </header>
    );
  }
  return (
    <header className={s.head} data-theme={theme}>
      <div className="wrap">
        {heading}
        {children}
      </div>
    </header>
  );
}
