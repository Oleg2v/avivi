import Image from 'next/image';
import { render } from '@/lib/renders';
import s from './PhotoSlot.module.css';

/**
 * A framed photography slot. Shows a concept render when one exists (clearly labelled),
 * and always carries the art-direction note, so Avivi's own photography drops straight in.
 */
export function PhotoSlot({
  name,
  alt,
  caption,
  art,
  artLabel,
  renderLabel,
  slotLabel,
  ratio = '3 / 2',
  priority = false,
  sizes = '(max-width: 760px) 100vw, 50vw',
  className,
  dim,
}: {
  name?: string;
  alt: string;
  caption?: string;
  art: string;
  artLabel: string;
  renderLabel: string;
  slotLabel: string;
  ratio?: string;
  priority?: boolean;
  sizes?: string;
  className?: string;
  dim?: string;
}) {
  const r = name ? render(name) : undefined;
  return (
    <figure className={`${s.slot} ${className ?? ''}`}>
      <div className={s.frame} style={{ aspectRatio: ratio }}>
        {r ? (
          <Image
            src={r.src}
            alt={alt}
            width={r.w}
            height={r.h}
            sizes={sizes}
            placeholder="blur"
            blurDataURL={r.blur}
            priority={priority}
            quality={75}
            className={s.img}
          />
        ) : (
          <div className={s.placeholder} role="img" aria-label={alt}>
            <svg viewBox="0 0 300 200" aria-hidden="true">
              <path d="M20 170h260M40 170V70h60v100M100 110h160v60M100 102h160M140 40h100v40H140z" />
            </svg>
            <span className="label">{slotLabel}</span>
          </div>
        )}
        <span className={s.badge}>{r ? renderLabel : slotLabel}</span>
        {dim ? <span className={s.dim}>{dim}</span> : null}
      </div>
      {(caption || art) && (
        <figcaption className={s.caption}>
          {caption ? <span className={s.capText}>{caption}</span> : null}
          <span className={s.art}>
            <span className={s.artLabel}>{artLabel}</span> {art}
          </span>
        </figcaption>
      )}
    </figure>
  );
}
