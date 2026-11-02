'use client';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { href } from '@/lib/i18n';
import { site, waLink } from '@/lib/site';
import { useLocale } from '@/components/providers/LocaleContext';
import { Icon } from '@/components/ui/Icon';
import { LanguageSwitcher } from './LanguageSwitcher';
import s from './Header.module.css';

/** Full-screen menu built on <dialog>: focus is trapped, Esc closes, the page behind is inert. */
export function MobileMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { locale, t } = useLocale();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      window.__lenis?.stop();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onClose_ = () => {
      window.__lenis?.start();
      onClose();
    };
    d.addEventListener('close', onClose_);
    return () => d.removeEventListener('close', onClose_);
  }, [onClose]);

  const groups = [
    {
      title: t.nav.groups.explore,
      items: [
        ['/collections', t.nav.collections],
        ['/smart-kitchen', t.nav.smart],
        ['/story', t.nav.story],
        ['/magazine', t.nav.magazine],
      ],
    },
    {
      title: t.nav.groups.tools,
      items: [
        ['/visualiser', t.nav.visualiser],
        ['/style-finder', t.nav.styleFinder],
        ['/planner', t.nav.planner],
        ['/designer', t.nav.designer],
      ],
    },
    {
      title: t.nav.groups.visit,
      items: [
        ['/showrooms', t.nav.showrooms],
        ['/book', t.nav.book],
        ['/service', t.nav.service],
        ['/contact', t.nav.contact],
      ],
    },
    {
      title: t.nav.groups.company,
      items: [
        ['/professionals', t.nav.professionals],
        ['/new-apartment', t.nav.newApartment],
        ['/products', t.nav.products],
        ['/app', t.nav.app],
      ],
    },
  ];

  return (
    <dialog ref={ref} className={s.mobile} aria-label={t.nav.menu} onClick={(e) => e.target === ref.current && onClose()}>
      <div className={s.mobileInner} data-lenis-prevent>
        <div className={s.mobileTop}>
          <span className="label">{t.nav.menu}</span>
          <button type="button" className={s.iconBtn} onClick={onClose} autoFocus>
            <Icon name="close" />
            <span className="visually-hidden">{t.nav.close}</span>
          </button>
        </div>
        {groups.map((g) => (
          <nav key={g.title} aria-label={g.title} className={s.mobileGroup}>
            <p className="label muted">{g.title}</p>
            <ul>
              {g.items.map(([p, label]) => (
                <li key={p}>
                  <Link href={href(locale, p)} className={s.mobileLink} onClick={onClose}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
        <div className={s.mobileContact}>
          <a className="btn btn-block" href={`tel:${site.phone.tel}`}>
            <Icon name="phone" size={18} />
            <span dir="ltr">{site.phone.display}</span>
          </a>
          <a className="btn btn-ghost btn-block" href={waLink(t.meta.siteName)} target="_blank" rel="noopener noreferrer">
            <Icon name="chat" size={18} />
            {t.nav.whatsapp}
          </a>
          {site.phone.example ? <p className="example-tag">{t.common.exampleNumber}</p> : null}
        </div>
        <LanguageSwitcher variant="menu" />
      </div>
    </dialog>
  );
}
