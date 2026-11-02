'use client';
import Image from 'next/image';
import { useId, useState } from 'react';
import s from './BeforeAfter.module.css';

export interface BAImage {
  src: string;
  w: number;
  h: number;
  blur?: string;
  alt: string;
}

/**
 * Before/after comparison. The divider is a native range input (keyboard and screen
 * reader friendly) and mirrors in RTL: "before" sits at the reading start.
 */
export function BeforeAfter({ before, after, beforeLabel, afterLabel, dragLabel, initial = 50, priority = false, sizes = '(max-width: 760px) 100vw, 70vw', unoptimized = false }: { before: BAImage; after: BAImage; beforeLabel: string; afterLabel: string; dragLabel: string; initial?: number; priority?: boolean; sizes?: string; unoptimized?: boolean }) {
  const [v, setV] = useState(initial);
  const id = useId();
  return (
    <div className={s.ba} style={{ ['--v' as string]: `${v}%`, aspectRatio: `${after.w} / ${after.h}` }}>
      <Image className={s.img} src={after.src} alt={after.alt} width={after.w} height={after.h} sizes={sizes} placeholder={after.blur ? 'blur' : 'empty'} blurDataURL={after.blur} priority={priority} unoptimized={unoptimized} />
      <div className={s.beforeWrap} aria-hidden="false">
        <Image className={s.img} src={before.src} alt={before.alt} width={before.w} height={before.h} sizes={sizes} placeholder={before.blur ? 'blur' : 'empty'} blurDataURL={before.blur} priority={priority} unoptimized={unoptimized} />
      </div>
      <span className={`${s.tag} ${s.tagBefore}`}>{beforeLabel}</span>
      <span className={`${s.tag} ${s.tagAfter}`}>{afterLabel}</span>
      <div className={s.handle} aria-hidden="true">
        <span className={s.knob}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </span>
      </div>
      <label htmlFor={id} className="visually-hidden">
        {dragLabel}
      </label>
      <input id={id} className={s.range} type="range" min={0} max={100} step={0.5} value={v} onChange={(e) => setV(Number(e.target.value))} data-cursor="drag" data-cursor-label="↔" />
    </div>
  );
}
