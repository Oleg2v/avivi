import Link from 'next/link';
import type { Dict } from '@/content/en';
import { href, type Locale } from '@/lib/i18n';
import { Icon } from '@/components/ui/Icon';
import { HeroCanvas } from './HeroCanvas';
import { HeroDrawings } from './HeroDrawings';
import s from './Hero.module.css';

const STEP_AT = [0, 0.08, 0.24, 0.44, 0.7];
const TICKS = Array.from({ length: 25 }, (_, i) => i);

export function Hero({ locale, t }: { locale: Locale; t: Dict }) {
  const h = t.home.hero;
  return (
    <section className={s.hero} data-theme="dark" aria-labelledby="hero-title">
      <div className={s.sticky}>
        <div className={s.stage}>
          <HeroDrawings className={s.drawings} />
          <HeroCanvas className={s.canvas} label={h.canvasLabel} />
          <div className={s.scrim} aria-hidden="true" />
        </div>

        <div className={s.copy}>
          <div className={s.titleBlock}>
            <p className={`label ${s.kicker}`}>{h.kicker}</p>
            <h1 id="hero-title" className={s.title}>
              <span className={`${s.line} is-on`} data-at="0">
                <span>{h.lines[0]}</span>
              </span>
              <span className={s.line} data-at="0.27">
                <span>{h.lines[1]}</span>
              </span>
            </h1>
          </div>
          <div className={s.end} data-at="0.8">
            <p className={s.next}>{h.next}</p>
            <p className={s.sub}>{h.sub}</p>
            <div className={s.ctas}>
              <Link href={href(locale, '/book')} className="btn" data-magnetic>
                {h.ctaBook}
                <Icon name="arrow" className="arrow" />
              </Link>
              <Link href={href(locale, '/visualiser')} className={`btn btn-ghost ${s.ghost}`} data-magnetic>
                {h.ctaVisualise}
              </Link>
            </div>
          </div>
        </div>

        <div className={s.hud} aria-hidden="true">
          <ol className={s.steps}>
            {h.steps.map((label, i) => (
              <li key={label} data-step-at={STEP_AT[i]} data-active={i === 0 ? '' : undefined}>
                <span className="index-num">0{i + 1}</span> {label}
              </li>
            ))}
          </ol>
          <div className={s.ruler}>
            <div className={s.ticks}>
              {TICKS.map((i) => (
                <span key={i} className={i % 6 === 0 ? s.major : undefined} />
              ))}
            </div>
            <div className={s.marker} />
            <p className={s.mm}>
              <span data-mm>0</span> mm <span className={s.of}>/ 2,400</span>
            </p>
          </div>
          <p className={s.hint}>
            {h.scroll}
            <span className={s.hintLine} />
          </p>
        </div>
      </div>
    </section>
  );
}
