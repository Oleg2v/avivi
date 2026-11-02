'use client';
import { useEffect, useRef, useState } from 'react';
import type { Finish } from '@/lib/data/collections';
import { prefersReducedMotion } from '@/lib/motion';
import { observeSize, observeVisibility, webglFast } from '@/lib/three/caps';
import { Icon } from '@/components/ui/Icon';
import s from './DayNight.module.css';

type Scene = { setTime: (t: number) => void; setParallax: (x: number, y: number) => void; resize: (w: number, h: number) => void; start: () => void; stop: () => void; dispose: () => void };

/**
 * "Day to night" slider on every collection page. The 3D scene loads only when the
 * section approaches the viewport. The slider is a native range input, mirrored in RTL.
 */
export function DayNight({
  finish,
  dark,
  labels,
  fallbackImage,
}: {
  finish: Finish;
  dark: boolean;
  labels: { title: string; hint: string; morning: string; noon: string; evening: string; night: string; timeOfDay: string; canvas: string; play: string };
  fallbackImage?: React.ReactNode;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const scene = useRef<Scene | null>(null);
  const [t, setT] = useState(0.15);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'fallback'>('idle');
  const playing = useRef(0);

  useEffect(() => {
    const el = wrap.current;
    const c = canvas.current;
    if (!el || !c) return;
    if (!webglFast()) {
      setState('fallback');
      return;
    }
    let disposed = false;
    const cleanups: (() => void)[] = [];
    const io = new IntersectionObserver(
      async ([e]) => {
        if (!e.isIntersecting || scene.current || disposed) return;
        io.disconnect();
        setState('loading');
        try {
          const { DayNightScene } = await import('./DayNightScene');
          if (disposed) return;
          const sc = new DayNightScene(c, finish, dark);
          scene.current = sc;
          const r = c.getBoundingClientRect();
          sc.resize(r.width, r.height);
          sc.setTime(0.15);
          cleanups.push(observeSize(c, (w, h) => sc.resize(w, h)));
          cleanups.push(observeVisibility(el, (v) => (v ? sc.start() : sc.stop())));
          sc.start();
          setState('ready');
        } catch {
          setState('fallback');
        }
      },
      { rootMargin: '400px' },
    );
    io.observe(el);
    return () => {
      disposed = true;
      io.disconnect();
      cleanups.forEach((f) => f());
      scene.current?.dispose();
      scene.current = null;
      cancelAnimationFrame(playing.current);
    };
  }, [finish, dark]);

  const update = (v: number) => {
    setT(v);
    scene.current?.setTime(v);
  };

  const play = () => {
    cancelAnimationFrame(playing.current);
    if (prefersReducedMotion()) {
      update(t > 0.5 ? 0.15 : 0.95);
      return;
    }
    const from = t >= 0.95 ? 0 : t;
    const start = performance.now();
    const dur = 7000 * (1 - from);
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur);
      update(from + (1 - from) * k);
      if (k < 1) playing.current = requestAnimationFrame(step);
    };
    playing.current = requestAnimationFrame(step);
  };

  const name = t < 0.25 ? labels.morning : t < 0.55 ? labels.noon : t < 0.78 ? labels.evening : labels.night;
  const hours = 7 + t * 15; // 07:00 → 22:00 (illustrative)
  const clock = `${String(Math.floor(hours)).padStart(2, '0')}:${String(Math.round((hours % 1) * 60) % 60).padStart(2, '0')}`;

  return (
    <div ref={wrap} className={s.wrap} data-state={state} style={{ ['--t' as string]: t }}>
      <div className={s.stage} onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        scene.current?.setParallax(((e.clientX - r.left) / r.width - 0.5) * 2, ((e.clientY - r.top) / r.height - 0.5) * -2);
      }}>
        {state === 'fallback' ? fallbackImage : null}
        <canvas ref={canvas} className={s.canvas} role="img" aria-label={labels.canvas} />
        <div className={s.timeBadge} aria-hidden="true">
          <span className="nums">{clock}</span>
          <span>{name}</span>
        </div>
        {state === 'loading' ? <div className={s.loading} aria-hidden="true" /> : null}
      </div>
      <div className={s.controls}>
        <button type="button" className={`btn btn-small btn-ghost ${s.play}`} onClick={play} aria-label={labels.play}>
          <Icon name="play" size={16} />
        </button>
        <div className={s.slider}>
          <label htmlFor="daynight" className="visually-hidden">
            {labels.timeOfDay}
          </label>
          <input
            id="daynight"
            className="range"
            type="range"
            min={0}
            max={1}
            step={0.005}
            value={t}
            aria-valuetext={`${clock}, ${name}`}
            onChange={(e) => {
              cancelAnimationFrame(playing.current);
              update(Number(e.target.value));
            }}
          />
          <div className={s.ticks} aria-hidden="true">
            <span>{labels.morning}</span>
            <span>{labels.noon}</span>
            <span>{labels.evening}</span>
            <span>{labels.night}</span>
          </div>
        </div>
      </div>
      <p className={s.hint}>{labels.hint}</p>
    </div>
  );
}
