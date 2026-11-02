'use client';
import { useEffect, useRef } from 'react';
import { isFinePointer, prefersReducedMotion } from '@/lib/motion';

/**
 * A small brass ring that follows the pointer (fine pointers only; the native cursor stays).
 * Over [data-cursor] modules it opens up and says "Open". Also drives magnetic buttons
 * ([data-magnetic]) through CSS variables, so there is a single pointer listener.
 */
export function Cursor({ label }: { label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!isFinePointer()) return;
    const el = ref.current;
    if (!el) return;
    let x = -100;
    let y = -100;
    let cx = x;
    let cy = y;
    let raf = 0;
    let mode = '';
    let shown = false;
    let magnet: HTMLElement | null = null;

    const setMode = (m: string, text?: string) => {
      if (m !== mode) {
        mode = m;
        el.dataset.mode = m;
      }
      if (labelRef.current) labelRef.current.textContent = text || label;
    };

    const releaseMagnet = () => {
      if (magnet) {
        magnet.style.setProperty('--mx', '0px');
        magnet.style.setProperty('--my', '0px');
        magnet = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!shown) {
        shown = true;
        cx = x;
        cy = y;
        el.dataset.visible = '1';
      }
      const t = e.target as Element | null;
      const open = t?.closest?.('[data-cursor]') as HTMLElement | null;
      if (open) setMode('open', open.dataset.cursorLabel);
      else if (t?.closest?.('input, textarea, select')) setMode('text');
      else if (t?.closest?.('a, button, [role="button"], label, summary')) setMode('link');
      else setMode('');

      const mag = t?.closest?.('[data-magnetic]') as HTMLElement | null;
      if (mag !== magnet) releaseMagnet();
      if (mag && !prefersReducedMotion()) {
        magnet = mag;
        const r = mag.getBoundingClientRect();
        const dx = (x - (r.left + r.width / 2)) * 0.22;
        const dy = (y - (r.top + r.height / 2)) * 0.32;
        mag.style.setProperty('--mx', `${dx.toFixed(1)}px`);
        mag.style.setProperty('--my', `${dy.toFixed(1)}px`);
      }
    };
    const onLeave = () => {
      shown = false;
      el.dataset.visible = '0';
      releaseMagnet();
    };
    const onDown = () => el.classList.add('is-down');
    const onUp = () => el.classList.remove('is-down');

    const loop = () => {
      const k = prefersReducedMotion() ? 1 : 0.24;
      cx += (x - cx) * k;
      cy += (y - cy) * k;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    document.documentElement.classList.add('has-cursor');
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      document.documentElement.classList.remove('has-cursor');
    };
  }, [label]);

  return (
    <div ref={ref} className="cursor" aria-hidden="true" data-visible="0">
      <span className="cursor-ring" />
      <span ref={labelRef} className="cursor-label">
        {label}
      </span>
    </div>
  );
}
