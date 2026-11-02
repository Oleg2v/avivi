'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { href, machineAssisted, stripLocale } from '@/lib/i18n';
import { site } from '@/lib/site';
import { useLocale } from '@/components/providers/LocaleContext';
import { designCount, useMyDesign } from '@/lib/store';
import { Icon } from '@/components/ui/Icon';
import { Wordmark } from './Wordmark';
import { LanguageSwitcher } from './LanguageSwitcher';
import { A11yPanel } from './A11yPanel';
import { MobileMenu } from './MobileMenu';
import s from './Header.module.css';

/**
 * Site header. Adapts its colour to the section underneath ([data-theme]),
 * hides while reading downwards and returns on scroll up.
 */
export function Header() {
  const { locale, t } = useLocale();
  const pathname = usePathname() || '/';
  const base = stripLocale(pathname);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const design = useMyDesign();
  const count = designCount(design);
  const toolsId = useId();
  const toolsBtn = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let raf = 0;
    let lastY = window.scrollY;
    const update = () => {
      raf = 0;
      const y = window.scrollY;
      setScrolled(y > 8);
      if (!menuOpen && !toolsOpen) setHidden(y > 240 && y > lastY + 2 ? true : y < lastY - 2 ? false : (h) => h);
      lastY = y;
      // Theme from the section under the header's centre line.
      const h = headerRef.current?.offsetHeight ?? 64;
      const els = document.elementsFromPoint(window.innerWidth / 2, h / 2);
      const under = els.find((el) => !headerRef.current?.contains(el));
      const themed = under?.closest('[data-theme]') as HTMLElement | null;
      setTheme(themed?.dataset.theme === 'dark' ? 'dark' : 'light');
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [menuOpen, toolsOpen, pathname]);

  useEffect(() => {
    setToolsOpen(false);
    setMenuOpen(false);
    setHidden(false);
  }, [pathname]);

  useEffect(() => {
    if (!toolsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setToolsOpen(false);
        toolsBtn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setToolsOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [toolsOpen]);

  const nav = [
    { path: '/collections', label: t.nav.collections },
    { path: '/smart-kitchen', label: t.nav.smart },
    { path: '/showrooms', label: t.nav.showrooms },
    { path: '/professionals', label: t.nav.professionals },
    { path: '/story', label: t.nav.story },
  ];
  const tools = [
    { path: '/visualiser', label: t.nav.visualiser, n: '01' },
    { path: '/style-finder', label: t.nav.styleFinder, n: '02' },
    { path: '/planner', label: t.nav.planner, n: '03' },
    { path: '/designer', label: t.nav.designer, n: '04' },
  ];
  const isActive = (p: string) => base === p || base.startsWith(p + '/');

  return (
    <header
      ref={headerRef}
      role="banner"
      className={s.header}
      data-theme={theme}
      data-scrolled={scrolled ? '1' : '0'}
      data-hidden={hidden ? '1' : '0'}
      data-tools={toolsOpen ? '1' : '0'}
    >
      <div className={s.bar}>
        <Link href={href(locale, '/')} className={s.logo} aria-label={`${t.meta.siteName} · ${t.nav.home}`}>
          <Wordmark locale={locale} />
        </Link>

        <nav className={s.nav} aria-label={t.nav.menu}>
          <ul>
            <li>
              <Link href={href(locale, nav[0].path)} className={s.navLink} aria-current={isActive(nav[0].path) ? 'page' : undefined}>
                {nav[0].label}
              </Link>
            </li>
            <li>
              <Link href={href(locale, nav[1].path)} className={s.navLink} aria-current={isActive(nav[1].path) ? 'page' : undefined}>
                {nav[1].label}
              </Link>
            </li>
            <li>
              <button
                ref={toolsBtn}
                type="button"
                className={s.navLink}
                aria-expanded={toolsOpen}
                aria-controls={toolsId}
                onClick={() => setToolsOpen((o) => !o)}
              >
                {t.nav.tools}
                <span className={s.caret} aria-hidden="true" />
              </button>
            </li>
            {nav.slice(2).map((item) => (
              <li key={item.path}>
                <Link href={href(locale, item.path)} className={s.navLink} aria-current={isActive(item.path) ? 'page' : undefined}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className={s.actions}>
          <a className={s.phone} href={`tel:${site.phone.tel}`} title={site.phone.example ? t.common.exampleNumber : undefined}>
            <Icon name="phone" size={18} />
            <span dir="ltr" className="nums">
              {site.phone.display}
            </span>
          </a>
          <div className={s.desktopOnly}>
            <LanguageSwitcher />
          </div>
          <A11yPanel />
          <Link href={href(locale, '/my-design')} className={s.iconBtn} title={t.nav.myDesign}>
            <Icon name="bag" />
            <span className="visually-hidden">{t.nav.myDesign}</span>
            {count > 0 ? (
              <span className={s.badge} aria-label={String(count)}>
                {count}
              </span>
            ) : null}
          </Link>
          <Link href={href(locale, '/book')} className={`btn btn-small ${s.book}`} data-magnetic>
            <span className={s.bookLong}>{t.nav.book}</span>
            <span className={s.bookShort}>{t.nav.bookShort}</span>
          </Link>
          <button type="button" className={`${s.iconBtn} ${s.menuBtn}`} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <Icon name="menu" />
            <span className="visually-hidden">{t.nav.menu}</span>
          </button>
        </div>
      </div>

      <div id={toolsId} className={s.tools} hidden={!toolsOpen}>
        <ul className={s.toolsGrid}>
          {tools.map((tool) => (
            <li key={tool.path}>
              <Link href={href(locale, tool.path)} className={s.toolLink}>
                <span className="index-num">{tool.n}</span>
                <span className={s.toolName}>{tool.label}</span>
                <Icon name="arrow" className="flip-rtl" />
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {machineAssisted[locale] ? <p className={s.machine}>{t.meta.machine}</p> : null}

      <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </header>
  );
}
