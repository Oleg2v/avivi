'use client';
import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { Dict } from '@/content/en';
import { getCollection, type CollectionId } from '@/lib/data/collections';
import { href, type Locale } from '@/lib/i18n';
import { fmt } from '@/lib/fmt';
import { scoreStyle } from '@/lib/style';
import { designStore } from '@/lib/store';
import { submitLead } from '@/lib/leads';
import { track } from '@/lib/analytics';
import { Icon } from '@/components/ui/Icon';
import { swatchStyle } from '@/components/ui/swatch';
import s from './StyleFinder.module.css';

type Q = Dict['style']['questions'][number];

/** Small visual for each answer: material swatches for finishes, line drawings for the rest. */
function OptionVisual({ q, o }: { q: string; o: string }) {
  const sw = (kind: string, color: string) => <span className={s.sw} style={swatchStyle({ kind: kind as 'lacquer', color, rough: 0.5 })} />;
  if (q === 'tone') return o === 'light' ? sw('lacquer', '#F0ECE5') : o === 'dark' ? sw('lacquer', '#252423') : <span className={s.split}>{sw('lacquer', '#F0ECE5')}{sw('lacquer', '#252423')}</span>;
  if (q === 'material') return o === 'wood' ? sw('oak', '#C9A27A') : o === 'lacquer' ? sw('lacquer', '#C8C1B5') : <span className={s.split}>{sw('lacquer', '#C8C1B5')}{sw('oak', '#C9A27A')}</span>;
  const draw = (children: React.ReactNode) => (
    <svg viewBox="0 0 80 60" className={s.draw} aria-hidden="true">
      {children}
    </svg>
  );
  switch (`${q}.${o}`) {
    case 'handles.handleless':
      return draw(<><rect x="16" y="8" width="48" height="44" /><line x1="16" y1="14" x2="64" y2="14" className={s.accent} /></>);
    case 'handles.handles':
      return draw(<><rect x="16" y="8" width="48" height="44" /><line x1="30" y1="18" x2="50" y2="18" className={s.accentThick} /></>);
    case 'handles.any':
      return draw(<><rect x="16" y="8" width="48" height="44" /><line x1="30" y1="18" x2="50" y2="18" strokeDasharray="3 3" /></>);
    case 'lines.clean':
      return draw(<><rect x="10" y="8" width="28" height="44" /><rect x="42" y="8" width="28" height="44" /></>);
    case 'lines.framed':
      return draw(<><rect x="10" y="8" width="28" height="44" /><rect x="15" y="13" width="18" height="34" /><rect x="42" y="8" width="28" height="44" /><rect x="47" y="13" width="18" height="34" /></>);
    case 'lines.special':
      return draw(<>{Array.from({ length: 12 }, (_, i) => <line key={i} x1={12 + i * 5} y1="8" x2={12 + i * 5} y2="52" className={i % 2 ? s.accent : undefined} />)}</>);
    case 'island.yes':
      return draw(<><rect x="8" y="6" width="64" height="10" /><rect x="22" y="32" width="36" height="14" className={s.fill} /></>);
    case 'island.no':
      return draw(<><rect x="8" y="6" width="64" height="10" /><rect x="8" y="16" width="10" height="34" /></>);
    case 'island.unsure':
      return draw(<><rect x="8" y="6" width="64" height="10" /><rect x="22" y="32" width="36" height="14" strokeDasharray="3 3" /></>);
    case 'cook.daily':
      return draw(<><rect x="22" y="24" width="36" height="22" rx="3" /><line x1="14" y1="28" x2="22" y2="28" /><line x1="58" y1="28" x2="66" y2="28" /><path d="M32 18c0-4 4-4 4-8M42 18c0-4 4-4 4-8" className={s.accent} /></>);
    case 'cook.quick':
      return draw(<><circle cx="36" cy="34" r="14" /><line x1="50" y1="34" x2="70" y2="34" className={s.accentThick} /></>);
    case 'cook.bake':
      return draw(<><rect x="16" y="10" width="48" height="40" /><rect x="22" y="22" width="36" height="22" className={s.fill} /><line x1="22" y1="16" x2="58" y2="16" /></>);
    case 'cook.host':
      return draw(<><circle cx="26" cy="32" r="12" /><circle cx="54" cy="32" r="12" /><circle cx="26" cy="32" r="6" className={s.accent} /><circle cx="54" cy="32" r="6" className={s.accent} /></>);
    case 'who.solo':
      return draw(<circle cx="40" cy="30" r="8" className={s.fill} />);
    case 'who.couple':
      return draw(<><circle cx="30" cy="30" r="8" className={s.fill} /><circle cx="50" cy="30" r="8" className={s.fill} /></>);
    case 'who.family':
      return draw(<><circle cx="22" cy="28" r="8" className={s.fill} /><circle cx="40" cy="28" r="8" className={s.fill} /><circle cx="56" cy="34" r="5" className={s.fill} /><circle cx="66" cy="36" r="4" className={s.fill} /></>);
    case 'who.generations':
      return draw(<><circle cx="16" cy="28" r="6" className={s.fill} /><circle cx="32" cy="28" r="7" className={s.fill} /><circle cx="48" cy="28" r="7" className={s.fill} /><circle cx="64" cy="32" r="5" className={s.fill} /></>);
    case 'space.compact':
      return draw(<><rect x="24" y="10" width="32" height="40" /><rect x="24" y="10" width="32" height="7" className={s.fill} /></>);
    case 'space.standard':
      return draw(<><rect x="12" y="10" width="56" height="40" /><rect x="12" y="10" width="56" height="7" className={s.fill} /><rect x="12" y="17" width="7" height="24" className={s.fill} /></>);
    case 'space.open':
      return draw(<><path d="M6 50V10h68" /><rect x="6" y="10" width="40" height="7" className={s.fill} /><rect x="54" y="30" width="16" height="12" /></>);
    default:
      return draw(<rect x="16" y="8" width="48" height="44" />);
  }
}

export function StyleFinder({
  locale,
  t,
  collectionNames,
  taglines,
  heroes,
  common,
}: {
  locale: Locale;
  t: Dict['style'];
  collectionNames: Record<CollectionId, string>;
  taglines: Record<CollectionId, string>;
  heroes: Record<CollectionId, { src: string; w: number; h: number; blur: string } | null>;
  common: Dict['common'];
}) {
  const [i, setI] = useState(-1);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const total = t.questions.length;
  const done = i >= total;
  const result = useMemo(() => (done ? scoreStyle(answers) : null), [done, answers]);
  const brief = useMemo(() => (done ? t.questions.map((q) => t.brief[`${q.id}.${answers[q.id]}` as keyof typeof t.brief]).filter(Boolean) : []), [done, answers, t]);

  useEffect(() => {
    if (!done || !result) return;
    designStore.setStyle({ collection: result.collection, answers, brief, createdAt: Date.now() });
    void submitLead('style', { locale, attachments: { style: { collection: result.collection, brief } }, extra: { answers: JSON.stringify(answers) } });
    track('tool_complete', { tool: 'style', collection: result.collection });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const choose = (q: Q, o: string) => {
    setAnswers((a) => ({ ...a, [q.id]: o }));
    window.setTimeout(() => setI((x) => x + 1), 220);
  };

  if (i < 0) {
    return (
      <div className={s.start}>
        <button type="button" className="btn" data-magnetic onClick={() => setI(0)}>
          {t.start}
          <Icon name="arrow" className="arrow" />
        </button>
      </div>
    );
  }

  if (!done) {
    const q = t.questions[i];
    return (
      <div className={s.quiz}>
        <div className={s.progress}>
          <span className="t-small muted">{fmt(t.progress, { n: i + 1, total })}</span>
          <div className={s.bar}>
            <span style={{ width: `${((i + 1) / total) * 100}%` }} />
          </div>
        </div>
        <fieldset key={q.id} className={s.question}>
          <legend className={s.q}>{q.q}</legend>
          <div className={s.options}>
            {q.options.map((o) => (
              <button key={o.id} type="button" className={s.option} aria-pressed={answers[q.id] === o.id} onClick={() => choose(q, o.id)}>
                <OptionVisual q={q.id} o={o.id} />
                <span className={s.optLabel}>{o.label}</span>
                <span className="t-small muted">{o.note}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <div className={s.nav}>
          <button type="button" className="link-line" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0}>
            {common.back}
          </button>
        </div>
      </div>
    );
  }

  const c = result!.collection;
  const hero = heroes[c];
  const def = getCollection(c)!;
  return (
    <div className={s.result} aria-live="polite">
      <div className={s.resultMedia}>
        {hero ? <Image src={hero.src} alt={`${collectionNames[c]}`} width={hero.w} height={hero.h} sizes="(max-width: 900px) 100vw, 50vw" placeholder="blur" blurDataURL={hero.blur} /> : null}
      </div>
      <div className={s.resultText}>
        <p className="label accent">{t.result.kicker}</p>
        <h2 className={s.resultName}>{collectionNames[c]}</h2>
        <p className={s.resultTag}>{taglines[c]}</p>
        <ul className={s.sws} aria-hidden="true">
          {def.swatches.map((sw, k) => (
            <li key={k} style={swatchStyle(sw)} />
          ))}
        </ul>
        <h3 className="label muted">{t.result.why}</h3>
        <ul className={s.reasons}>
          {result!.reasons.map((r) => (
            <li key={r}>{t.reasons[r as keyof typeof t.reasons]}</li>
          ))}
        </ul>
        <h3 className="label muted">{t.result.brief}</h3>
        <ol className={s.brief}>
          {brief.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ol>
        <p className="t-small muted">
          <Icon name="check" size={14} /> {common.saved}
        </p>
        <div className={s.actions}>
          <Link href={`${href(locale, '/book')}?style=1`} className="btn" data-magnetic>
            {t.result.book}
            <Icon name="arrow" className="arrow" />
          </Link>
          <Link href={`${href(locale, '/visualiser')}?collection=${c}`} className="btn btn-ghost">
            {fmt(t.result.visualise, { name: collectionNames[c] })}
          </Link>
          <Link href={`${href(locale, '/planner')}?collection=${c}`} className="btn btn-ghost">
            {t.result.plan}
          </Link>
          <button
            type="button"
            className="link-line"
            onClick={() => {
              setAnswers({});
              setI(0);
            }}
          >
            {t.result.restart}
          </button>
        </div>
      </div>
    </div>
  );
}
