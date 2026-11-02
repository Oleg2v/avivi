'use client';
import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { webglFast, observeSize, observeVisibility } from '@/lib/three/caps';

/**
 * Drives the hero: reads scroll progress through the pinned section, feeds it to the
 * WebGL scene (loaded lazily after first paint), and updates the overlay (tagline lines,
 * steps, millimetre ruler). Falls back to scroll-linked line drawings without WebGL and
 * to a still final frame with reduced motion.
 */
export function HeroCanvas({ label, className }: { label: string; className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const section = canvas.closest('section') as HTMLElement | null;
    if (!section) return;
    const counter = section.querySelector<HTMLElement>('[data-mm]');
    const lines = Array.from(section.querySelectorAll<HTMLElement>('[data-at]'));
    const steps = Array.from(section.querySelectorAll<HTMLElement>('[data-step-at]'));
    let disposed = false;
    let scene: { setProgress: (p: number) => void; start: () => void; stop: () => void; resize: (w: number, h: number) => void; dispose: () => void; snap: (p: number) => void } | null = null;
    const cleanups: (() => void)[] = [];

    const progress = () => {
      const r = section.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1;
    };

    let lastStep = -1;
    let lastHome = '';
    const overlay = (p: number) => {
      section.style.setProperty('--p', p.toFixed(4));
      for (const el of lines) {
        const at = Number(el.dataset.at);
        el.classList.toggle('is-on', p >= at);
      }
      let step = 0;
      steps.forEach((el, i) => {
        if (p >= Number(el.dataset.stepAt)) step = i;
      });
      if (step !== lastStep) {
        steps.forEach((el, i) => el.toggleAttribute('data-active', i === step));
        lastStep = step;
      }
      const theme = p > 0.74 ? 'light' : 'dark';
      if (theme !== lastHome) {
        section.dataset.theme = theme;
        lastHome = theme;
      }
      if (counter) counter.textContent = new Intl.NumberFormat('en-US').format(Math.round(p * 2400));
      section.style.setProperty('--frame', String(Math.min(3, Math.floor(p * 4.2))));
    };

    if (prefersReducedMotion()) {
      section.dataset.mode = 'static';
      overlay(1);
      return;
    }

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const p = progress();
        if (scene) scene.setProgress(p);
        else overlay(p);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    cleanups.push(() => window.removeEventListener('scroll', onScroll));
    overlay(progress());

    if (!webglFast()) {
      section.dataset.mode = 'drawings';
      return () => cleanups.forEach((c) => c());
    }

    const boot = async () => {
      const { HeroScene } = await import('./HeroScene');
      if (disposed) return;
      try {
        const s = new HeroScene(canvas, { onFrame: overlay });
        scene = s;
        const stage = canvas.parentElement!;
        cleanups.push(observeSize(stage, (w, h) => s.resize(w, h)));
        const r = stage.getBoundingClientRect();
        s.resize(Math.max(1, r.width), Math.max(1, r.height));
        s.snap(progress());
        cleanups.push(
          observeVisibility(section, (v) => {
            if (v) s.start();
            else s.stop();
          }, '0px'),
        );
        s.start();
        requestAnimationFrame(() => (section.dataset.ready = '1'));
        const onPref = () => {
          if (prefersReducedMotion()) {
            s.snap(1);
            s.stop();
            section.dataset.mode = 'static';
          }
        };
        window.addEventListener('avivi:a11y', onPref);
        cleanups.push(() => window.removeEventListener('avivi:a11y', onPref));
      } catch {
        section.dataset.mode = 'drawings';
      }
    };
    // After first paint, when the main thread is free.
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    const hasIdle = typeof w.requestIdleCallback === 'function';
    const id = hasIdle ? w.requestIdleCallback!(() => void boot(), { timeout: 900 }) : window.setTimeout(() => void boot(), 120);
    cleanups.push(() => {
      if (hasIdle && w.cancelIdleCallback) w.cancelIdleCallback(id);
      else window.clearTimeout(id);
    });

    return () => {
      disposed = true;
      cleanups.forEach((c) => c());
      scene?.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} role="img" aria-label={label} />;
}
