'use client';
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import { observeSize, observeVisibility, webglFast } from '@/lib/three/caps';
import s from './Smart.module.css';

type Scene = { setProgress: (p: number) => void; pick: (x: number, y: number, r: DOMRect) => string | null; resize: (w: number, h: number) => void; start: () => void; stop: () => void; snap: (p: number) => void; dispose: () => void };

export function SmartKitchen3D({
  principles,
  modules,
  modulesTitle,
  scrollHint,
  canvasLabel,
  principleLabel,
}: {
  principles: { id: string; title: string; text: string }[];
  modules: Record<string, string>;
  modulesTitle: string;
  scrollHint: string;
  canvasLabel: string;
  principleLabel: string;
}) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const [active, setActive] = useState(-1);
  const [mode, setMode] = useState<'scroll' | 'static' | 'fallback'>('scroll');
  const [tip, setTip] = useState<{ key: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const sec = section.current;
    const c = canvas.current;
    if (!sec || !c) return;
    const reduce = prefersReducedMotion();
    if (!webglFast()) {
      setMode('fallback');
      return;
    }
    if (reduce) setMode('static');
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const progress = () => {
      const r = sec.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      return total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
    };
    const station = (p: number) => Math.min(principles.length - 1, Math.max(-1, Math.round(p * principles.length) - 1));
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || scene.current || disposed) return;
        io.disconnect();
        const { SmartScene } = await import('./SmartScene');
        if (disposed) return;
        const sc = new SmartScene(c, (key, x, y) => setTip(key ? { key, x, y } : null));
        scene.current = sc;
        const r = c.getBoundingClientRect();
        sc.resize(r.width, r.height);
        sc.snap(reduce ? 0 : progress());
        cleanups.push(observeSize(c, (w, h) => sc.resize(w, h)));
        cleanups.push(observeVisibility(sec, (v) => (v ? sc.start() : sc.stop())));
        sc.start();
        sec.dataset.ready = '1';
      },
      { rootMargin: '300px' },
    );
    io.observe(sec);
    let ticking = false;
    const onScroll = () => {
      if (ticking || reduce) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const p = progress();
        scene.current?.setProgress(p);
        setActive(station(p));
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      disposed = true;
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      cleanups.forEach((f) => f());
      scene.current?.dispose();
      scene.current = null;
    };
  }, [principles.length]);

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const sc = scene.current;
    if (!sc) return;
    sc.pick(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  };

  return (
    <section ref={section} className={s.pinned} data-mode={mode} aria-label={canvasLabel}>
      <div className={s.sticky}>
        <canvas ref={canvas} className={s.canvas} onClick={onClick} role="img" aria-label={canvasLabel} data-cursor data-cursor-label="+" />
        <ol className={s.principles}>
          {principles.map((p, i) => (
            <li key={p.id} data-active={i === active || mode !== 'scroll' ? '1' : '0'}>
              <span className="index-num">
                {principleLabel} 0{i + 1}
              </span>
              <span className={s.pTitle}>{p.title}</span>
              <span className={s.pText}>{p.text}</span>
            </li>
          ))}
        </ol>
        <p className={s.modHint}>
          <span>{modulesTitle}</span>
          {mode === 'scroll' && active < 0 ? <span className={s.scroll}>{scrollHint}</span> : null}
        </p>
        <div className={s.tipLayer} aria-live="polite">
          {tip ? (
            <div className={s.tip} style={{ insetInlineStart: undefined, left: Math.min(tip.x, 9999), top: tip.y }}>
              {modules[tip.key] ?? ''}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
