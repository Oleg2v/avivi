import { coast, project } from '@/lib/data/coast';
import { branches, type BranchId } from '@/lib/data/branches';
import s from './IsraelMap.module.css';

/**
 * A drafting-style map: the Mediterranean coastline as a single line, a latitude scale,
 * and the six showrooms as brass points. No borders are drawn.
 * Interactive (booking) when onSelect is given; otherwise points link to #branch.
 */
export function IsraelMap({
  names,
  label,
  selected,
  onSelect,
  newLabel,
  factoryLabel,
  hrefFor,
}: {
  names: Record<BranchId, string>;
  label: string;
  selected?: BranchId | null;
  onSelect?: (id: BranchId) => void;
  newLabel?: string;
  factoryLabel?: string;
  hrefFor?: (id: BranchId) => string;
}) {
  const lats = [31.6, 31.8, 32.0, 32.2, 32.4, 32.6, 32.8, 33.0];
  return (
    <svg className={s.map} viewBox={`-60 -20 ${coast.width + 120} ${coast.height + 50}`} role="group" aria-label={label}>
      <defs>
        <pattern id="sea" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" className={s.hatch} />
        </pattern>
      </defs>
      {/* sea hatch: everything west of the coastline */}
      <path d={`${coast.d}L-60 ${coast.height + 30}L-60 -20Z`} fill="url(#sea)" className={s.sea} />
      <path d={coast.d} className={s.coast} />
      {/* latitude scale */}
      <g className={s.scale} aria-hidden="true">
        {lats.map((lat) => {
          const [, y] = project(34.3, lat);
          return (
            <g key={lat}>
              <line x1={coast.width + 30} x2={coast.width + 40} y1={y} y2={y} />
              <text x={coast.width + 46} y={y + 3}>
                {lat.toFixed(1)}°
              </text>
            </g>
          );
        })}
        <line x1={coast.width + 30} x2={coast.width + 30} y1={project(34.3, 33.0)[1]} y2={project(34.3, 31.6)[1]} />
        <g transform={`translate(${coast.width - 10} 14)`}>
          <path d="M0 18 L6 0 L12 18 L6 13 Z" className={s.north} />
          <text x="6" y="32" textAnchor="middle">
            N
          </text>
        </g>
      </g>
      {branches.map((b) => {
        const [x, y] = project(b.lon, b.lat);
        const isSel = selected === b.id;
        const content = (
          <>
            <circle cx={x} cy={y} r={isSel ? 9 : 6} className={s.dot} />
            <circle cx={x} cy={y} r={isSel ? 16 : 12} className={s.halo} />
            {b.factory ? <rect x={x - 3} y={y - 22} width={6} height={6} className={s.factory} /> : null}
            <text x={x + 14} y={y + 4} className={s.name}>
              {names[b.id]}
              {b.isNew && newLabel ? <tspan className={s.newTag}> · {newLabel}</tspan> : null}
            </text>
          </>
        );
        if (onSelect) {
          return (
            <g
              key={b.id}
              className={s.point}
              data-selected={isSel ? '1' : '0'}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={names[b.id]}
              onClick={() => onSelect(b.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(b.id);
                }
              }}
            >
              {content}
            </g>
          );
        }
        return (
          <a key={b.id} href={hrefFor ? hrefFor(b.id) : `#${b.id}`} className={s.point} aria-label={names[b.id]}>
            {content}
          </a>
        );
      })}
      {factoryLabel ? (
        <g className={s.legend} transform={`translate(0 ${coast.height + 18})`}>
          <rect x="0" y="-6" width="6" height="6" className={s.factory} />
          <text x="12" y="0">
            {factoryLabel}
          </text>
        </g>
      ) : null}
    </svg>
  );
}
