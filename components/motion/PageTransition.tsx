'use client';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { prefersReducedMotion } from '@/lib/motion';

/** Procedural oak grain, painted once into a canvas (no image download). */
function woodTexture(): string {
  const c = document.createElement('canvas');
  c.width = 384;
  c.height = 1024;
  const g = c.getContext('2d');
  if (!g) return '';
  const base = g.createLinearGradient(0, 0, c.width, 0);
  base.addColorStop(0, '#C59D72');
  base.addColorStop(0.35, '#CFA97E');
  base.addColorStop(0.62, '#C29A6E');
  base.addColorStop(1, '#CBA478');
  g.fillStyle = base;
  g.fillRect(0, 0, c.width, c.height);
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    const x0 = rnd() * c.width;
    const w = 0.4 + rnd() * 1.9;
    const a = 0.03 + rnd() * 0.13;
    g.strokeStyle = `rgba(${80 + rnd() * 40 | 0},${52 + rnd() * 22 | 0},28,${a.toFixed(3)})`;
    g.lineWidth = w;
    g.beginPath();
    const f1 = 0.002 + rnd() * 0.004;
    const f2 = 0.01 + rnd() * 0.01;
    const p = rnd() * 10;
    for (let y = 0; y <= c.height; y += 12) {
      const x = x0 + Math.sin(y * f1 + p) * 7 + Math.sin(y * f2 + p * 2) * 1.6;
      if (y === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // pores
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(70,45,24,${(0.05 + rnd() * 0.12).toFixed(3)})`;
    g.fillRect(rnd() * c.width, rnd() * c.height, 0.8, 2 + rnd() * 5);
  }
  return c.toDataURL('image/jpeg', 0.8);
}

const PLANKS = 5;

/**
 * Page transitions as a wood-grain wipe: oak planks rise to cover the page, the route changes,
 * and the planks continue upward to reveal it. Order follows reading direction (RTL in Hebrew).
 * Skipped entirely with reduced motion.
 */
export function PageTransition() {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<'idle' | 'cover' | 'reveal'>('idle');
  const target = useRef<string | null>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  useEffect(() => {
    const url = woodTexture();
    if (url && overlay.current) overlay.current.style.setProperty('--grain', `url(${url})`);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a') as HTMLAnchorElement | null;
      if (!a || !a.href) return;
      if ((a.target && a.target !== '_self') || a.hasAttribute('download') || a.dataset.noTransition !== undefined) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname.startsWith('/api') || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      if (prefersReducedMotion()) return;
      e.preventDefault();
      target.current = url.pathname + url.search + url.hash;
      setPhase('cover');
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  // When covered, navigate.
  useEffect(() => {
    if (phase !== 'cover' || !target.current) return;
    const go = window.setTimeout(() => {
      const dest = target.current!;
      router.push(dest, { scroll: true });
    }, 560);
    const safety = window.setTimeout(() => setPhase('reveal'), 5000);
    return () => {
      window.clearTimeout(go);
      window.clearTimeout(safety);
    };
  }, [phase, router]);

  // Route changed: reveal.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (phase === 'cover') {
      requestAnimationFrame(() => setPhase('reveal'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (phase !== 'reveal') return;
    const t = window.setTimeout(() => {
      setPhase('idle');
      target.current = null;
    }, 900);
    return () => window.clearTimeout(t);
  }, [phase]);

  return (
    <div ref={overlay} className="wipe" data-phase={phase} aria-hidden="true">
      {Array.from({ length: PLANKS }, (_, i) => (
        <span key={i} className="plank" style={{ ['--i' as string]: i, backgroundPosition: `${(i * 37) % 100}% ${(i * 53) % 100}%` }} />
      ))}
    </div>
  );
}
