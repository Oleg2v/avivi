'use client';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { useLocale } from '@/components/providers/LocaleContext';
import { href } from '@/lib/i18n';
import s from './Header.module.css';

type Prefs = { text: '' | 'lg' | 'xl'; contrast: boolean; motion: boolean; links: boolean };
const KEY = 'avivi-a11y';
const EMPTY: Prefs = { text: '', contrast: false, motion: false, links: false };

export function applyA11y(p: Prefs) {
  const d = document.documentElement.dataset;
  if (p.text) d.a11yText = p.text;
  else delete d.a11yText;
  if (p.contrast) d.a11yContrast = 'high';
  else delete d.a11yContrast;
  if (p.motion) d.a11yMotion = 'reduce';
  else delete d.a11yMotion;
  if (p.links) d.a11yLinks = 'underline';
  else delete d.a11yLinks;
  window.dispatchEvent(new CustomEvent('avivi:a11y'));
}

/** Native accessibility preferences (not an overlay): text size, contrast, motion, links. */
export function A11yPanel() {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(EMPTY);
  const panelId = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...EMPTY, ...(JSON.parse(raw) as Prefs) });
    } catch {
      /* ignore */
    }
  }, []);

  const update = useCallback((p: Prefs) => {
    setPrefs(p);
    applyA11y(p);
    try {
      localStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!panel.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    panel.current?.querySelector<HTMLElement>('button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const sizes: Prefs['text'][] = ['', 'lg', 'xl'];
  return (
    <div className={s.a11yWrap}>
      <button
        ref={btn}
        type="button"
        className={s.iconBtn}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        title={t.a11y.button}
      >
        <Icon name="a11y" />
        <span className="visually-hidden">{t.a11y.button}</span>
      </button>
      <div ref={panel} id={panelId} className={s.a11yPanel} hidden={!open} role="group" aria-label={t.a11y.title}>
        <p className={s.panelTitle}>{t.a11y.title}</p>
        <div className={s.a11yRow} role="radiogroup" aria-label={t.a11y.text}>
          <span>{t.a11y.text}</span>
          <div className={s.seg}>
            {sizes.map((sz, i) => (
              <button
                key={sz || 'base'}
                type="button"
                role="radio"
                aria-checked={prefs.text === sz}
                className="chip"
                onClick={() => update({ ...prefs, text: sz })}
              >
                {t.a11y.textOptions[i]}
              </button>
            ))}
          </div>
        </div>
        {(
          [
            ['contrast', t.a11y.contrast],
            ['motion', t.a11y.motion],
            ['links', t.a11y.links],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="switch"
            aria-checked={prefs[k]}
            className={s.switchRow}
            onClick={() => update({ ...prefs, [k]: !prefs[k] })}
          >
            <span>{label}</span>
            <span className={s.switch} aria-hidden="true" />
          </button>
        ))}
        <div className={s.a11yFoot}>
          <button type="button" className="link-line" onClick={() => update(EMPTY)}>
            {t.a11y.reset}
          </button>
          <a className="link-line" href={href(locale, '/accessibility')}>
            {t.a11y.statement}
          </a>
        </div>
      </div>
    </div>
  );
}
