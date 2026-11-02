'use client';
import { useId, useState } from 'react';
import s from './Inbox.module.css';

export interface Bar {
  key: string;
  label: string;
  value: number;
}

/**
 * Ranked horizontal bars, one series (one hue, so no legend: the title names it).
 * Value at the bar tip, per-bar hover and keyboard tooltip with the share, and a table view twin.
 */
export function BarChart({ title, data, labels, locale }: { title: string; data: Bar[]; labels: { tableView: string; share: string; count: string; empty: string }; locale: string }) {
  const id = useId();
  const [active, setActive] = useState<string | null>(null);
  const rows = [...data].sort((a, b) => b.value - a.value);
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((t, r) => t + r.value, 0);
  const nf = new Intl.NumberFormat(locale);
  const pf = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 });
  return (
    <figure className={s.chart} aria-labelledby={`${id}-t`}>
      <figcaption id={`${id}-t`} className={s.chartTitle}>
        {title}
      </figcaption>
      {total === 0 ? (
        <p className="t-small muted">{labels.empty}</p>
      ) : (
        <ul className={s.bars}>
          {rows.map((r) => {
            const w = (r.value / max) * 100;
            const share = total ? r.value / total : 0;
            return (
              <li
                key={r.key}
                className={s.barRow}
                tabIndex={0}
                aria-label={`${r.label}: ${nf.format(r.value)} (${pf.format(share)})`}
                onPointerEnter={() => setActive(r.key)}
                onPointerLeave={() => setActive((a) => (a === r.key ? null : a))}
                onFocus={() => setActive(r.key)}
                onBlur={() => setActive((a) => (a === r.key ? null : a))}
                data-active={active === r.key ? '1' : undefined}
              >
                <span className={s.barLabel}>{r.label}</span>
                <span className={s.barTrack}>
                  <span className={s.bar} style={{ inlineSize: `max(${w}%, ${r.value ? '3px' : '0px'})` }} />
                  <span className={s.barValue}>{nf.format(r.value)}</span>
                  {active === r.key ? (
                    <span className={s.tip} role="presentation" style={{ insetInlineStart: `min(${w}%, calc(100% - 120px))` }}>
                      <strong>{pf.format(share)}</strong>
                      <span>
                        {r.label} · {nf.format(r.value)}
                      </span>
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <details className={s.tableView}>
        <summary>{labels.tableView}</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">{title}</th>
              <th scope="col">{labels.count}</th>
              <th scope="col">{labels.share}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row">{r.label}</th>
                <td className="nums">{nf.format(r.value)}</td>
                <td className="nums">{pf.format(total ? r.value / total : 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
