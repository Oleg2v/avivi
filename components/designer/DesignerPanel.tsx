'use client';
import { useEffect, useRef } from 'react';
import { DesignerChat } from './DesignerChat';
import s from './Designer.module.css';

const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Avivi Designer as a modal panel: focus stays inside, Escape closes, focus returns to the launcher. */
export function DesignerPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.__lenis?.stop();
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    if (window.matchMedia('(max-width: 640px)').matches) root.style.overflow = 'hidden';

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      window.__lenis?.start();
      root.style.overflow = prevOverflow;
      returnTo.current?.focus({ preventScroll: true });
    };
  }, [open]);

  return (
    <div className={s.layer} data-open={open ? '1' : '0'} inert={!open}>
      <div className={s.backdrop} onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} className={s.panel} role="dialog" aria-modal="true" aria-labelledby="avivi-designer-title">
        <DesignerChat variant="panel" onClose={onClose} active={open} titleId="avivi-designer-title" />
      </div>
    </div>
  );
}
