import Link from 'next/link';
import { href, type Locale } from '@/lib/i18n';
import s from './PageHead.module.css';

/** Interior page header: breadcrumb, title set line by line, lead paragraph. */
export function PageHead({
  locale,
  home,
  crumbs = [],
  kicker,
  title,
  intro,
  children,
  theme,
}: {
  locale: Locale;
  home: string;
  crumbs?: { label: string; path?: string }[];
  kicker?: string;
  title: string;
  intro?: string;
  children?: React.ReactNode;
  theme?: 'dark';
}) {
  return (
    <header className={s.head} data-theme={theme}>
      <div className="wrap">
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
        <h1 className={`lines ${s.title}`}>
          <span className="line">
            <span>{title}</span>
          </span>
        </h1>
        {intro ? <p className={`lead muted reveal ${s.intro}`}>{intro}</p> : null}
        {children}
      </div>
    </header>
  );
}
