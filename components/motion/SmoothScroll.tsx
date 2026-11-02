'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Lenis from 'lenis';
import { prefersReducedMotion } from '@/lib/motion';

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/**
 * Lenis smooth scrolling on wheel/trackpad (native on touch). Disabled for reduced motion.
 * Exposes the instance on window.__lenis so dialogs can pause scrolling and scenes can read it.
 */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ duration: 1.05, smoothWheel: true, wheelMultiplier: 0.95, touchMultiplier: 1 });
    window.__lenis = lenis;
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onPref = () => {
      if (prefersReducedMotion()) {
        lenis.destroy();
        window.__lenis = undefined;
        cancelAnimationFrame(raf);
      }
    };
    window.addEventListener('avivi:a11y', onPref);
    return () => {
      window.removeEventListener('avivi:a11y', onPref);
      cancelAnimationFrame(raf);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  // New page: start at the top (or at the hash target).
  useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const el = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (el) {
        if (window.__lenis) window.__lenis.scrollTo(el, { immediate: true, offset: -80 });
        else el.scrollIntoView();
        return;
      }
    }
    if (window.__lenis) window.__lenis.scrollTo(0, { immediate: true });
    else window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
