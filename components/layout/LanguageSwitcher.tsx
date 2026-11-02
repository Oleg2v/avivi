'use client';
import { usePathname } from 'next/navigation';
import { href, locales, localeNames, localeShort, machineAssisted, stripLocale } from '@/lib/i18n';
import { useLocale } from '@/components/providers/LocaleContext';
import s from './Header.module.css';

/** Real language versions on the same domain; keeps the visitor on the same page. */
export function LanguageSwitcher({ variant = 'inline' }: { variant?: 'inline' | 'menu' }) {
  const pathname = usePathname() || '/';
  const { locale, t } = useLocale();
  const base = stripLocale(pathname);
  return (
    <nav aria-label={t.nav.language} className={variant === 'menu' ? s.langMenu : s.lang}>
      <ul>
        {locales.map((l) => (
          <li key={l}>
            <a
              href={href(l, base)}
              hrefLang={l}
              lang={l}
              aria-current={l === locale ? 'true' : undefined}
              title={localeNames[l] + (machineAssisted[l] ? ' · machine-assisted' : '')}
              className={l === locale ? s.langOn : undefined}
            >
              {variant === 'menu' ? localeNames[l] : localeShort[l]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
