import type { Layout, Run } from '@/lib/planner/engine';
import { runPoint } from '@/lib/planner/engine';
import s from './Planner.module.css';

/** Plan drawing: walls, openings with door swings, modules with widths, island, triangle, dimensions. */
export function PlanView({ layout, labels }: { layout: Layout; labels: { sink: string; hob: string; fridge: string; cm: string } }) {
  const { state } = layout;
  const W = state.width;
  const D = state.depth;
  const M = 70; // margin for dimension lines
  const T = 12;
  const vb = `${-M} ${-M} ${W + 2 * M} ${D + 2 * M}`;
  const runPoly = (r: Run, a: number, b: number, d0: number, d1: number) => {
    const p = [runPoint(r, a, d0), runPoint(r, b, d0), runPoint(r, b, d1), runPoint(r, a, d1)];
    return p.map((q) => `${q.x},${q.z}`).join(' ');
  };
  const wallSeg = (wall: 'back' | 'left' | 'right' | 'front') => {
    const len = wall === 'back' || wall === 'front' ? W : D;
    const ops = state.openings.filter((o) => o.wall === wall).sort((a, b) => a.offset - b.offset);
    const segs: [number, number][] = [];
    let a = -T;
    for (const o of ops) {
      if (o.offset > a) segs.push([a, o.offset]);
      a = Math.max(a, o.offset + o.width);
    }
    segs.push([a, len + T]);
    return segs.map(([p0, p1], i) => {
      let x = 0,
        y = 0,
        w = 0,
        h = 0;
      if (wall === 'back') [x, y, w, h] = [p0, -T, p1 - p0, T];
      else if (wall === 'front') [x, y, w, h] = [p0, D, p1 - p0, T];
      else if (wall === 'left') [x, y, w, h] = [-T, p0, T, p1 - p0];
      else [x, y, w, h] = [W, p0, T, p1 - p0];
      return <rect key={`${wall}${i}`} className={s.pWall} x={x} y={y} width={w} height={h} />;
    });
  };
  const opening = (o: Layout['state']['openings'][number]) => {
    const a = o.offset;
    const b = o.offset + o.width;
    if (o.type === 'window') {
      const lines: [number, number, number, number][] =
        o.wall === 'back'
          ? [[a, -T * 0.66, b, -T * 0.66], [a, -T * 0.33, b, -T * 0.33]]
          : o.wall === 'front'
            ? [[a, D + T * 0.33, b, D + T * 0.33], [a, D + T * 0.66, b, D + T * 0.66]]
            : o.wall === 'left'
              ? [[-T * 0.66, a, -T * 0.66, b], [-T * 0.33, a, -T * 0.33, b]]
              : [[W + T * 0.33, a, W + T * 0.33, b], [W + T * 0.66, a, W + T * 0.66, b]];
      return (
        <g key={o.id} className={s.pWindow}>
          {lines.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </g>
      );
    }
    const r = o.width;
    let d = '';
    if (o.wall === 'back') d = `M${a} 0 L${a} ${r} A${r} ${r} 0 0 0 ${b} 0`;
    else if (o.wall === 'front') d = `M${a} ${D} L${a} ${D - r} A${r} ${r} 0 0 1 ${b} ${D}`;
    else if (o.wall === 'left') d = `M0 ${a} L${r} ${a} A${r} ${r} 0 0 1 0 ${b}`;
    else d = `M${W} ${a} L${W - r} ${a} A${r} ${r} 0 0 0 ${W} ${b}`;
    return <path key={o.id} className={s.pDoor} d={d} />;
  };

  const kindClass = (k: string) => (k === 'fridge' || k === 'oven' || k === 'pantry' ? s.pTall : k === 'filler' ? s.pFiller : s.pBase);
  const label = (k: string) => (k === 'sink' ? 'S' : k === 'hob' ? 'H' : k === 'fridge' ? 'F' : k === 'oven' ? 'O' : k === 'pantry' ? 'P' : k === 'dishwasher' ? 'DW' : k === 'corner' ? 'C' : '');

  return (
    <svg className={s.plan} viewBox={vb} role="img" aria-label={`${state.width} × ${state.depth} ${labels.cm}`}>
      <rect x={0} y={0} width={W} height={D} className={s.pFloor} />
      {(['back', 'left', 'right', 'front'] as const).map((w) => wallSeg(w))}
      {state.openings.map(opening)}
      {layout.runs.map((r) => (
        <g key={r.id}>
          {r.uppers.map((u, i) => (
            <polygon key={`u${i}`} className={s.pUpper} points={runPoly(r, u.start, u.start + u.width, 0, 35)} />
          ))}
          {r.modules.map((m, i) => {
            const depth = m.kind === 'fridge' || m.kind === 'oven' || m.kind === 'pantry' ? 60 : 60;
            const c = runPoint(r, m.start + m.width / 2, 30);
            return (
              <g key={i}>
                <polygon className={kindClass(m.kind)} points={runPoly(r, m.start, m.start + m.width, 0, depth)} />
                {m.width >= 30 ? (
                  <text x={c.x} y={c.z} className={s.pText} textAnchor="middle" dominantBaseline="middle">
                    {label(m.kind) ? `${label(m.kind)} ` : ''}
                    {Math.round(m.width)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {r.counter.map((c, i) => (
            <polygon key={`c${i}`} className={s.pCounter} points={runPoly(r, c.from, c.to, 60, 62)} />
          ))}
        </g>
      ))}
      {layout.island ? (
        <g>
          <rect className={s.pCounterFill} x={layout.island.cx - layout.island.length / 2} y={layout.island.cz - layout.island.depth / 2} width={layout.island.length} height={layout.island.depth} />
          {layout.island.modules.map((m, i) => (
            <rect key={i} className={s.pBase} x={layout.island!.cx - layout.island!.length / 2 + m.start} y={layout.island!.cz - layout.island!.depth / 2} width={m.width} height={60} />
          ))}
          <text x={layout.island.cx} y={layout.island.cz + layout.island.depth / 2 - 12} className={s.pText} textAnchor="middle">
            {layout.island.length} × {layout.island.depth}
          </text>
        </g>
      ) : null}
      {layout.triangle ? (
        <g className={layout.triangle.ok ? s.pTri : `${s.pTri} ${s.pTriWarn}`}>
          <polygon points={[layout.triangle.sink, layout.triangle.hob, layout.triangle.fridge].map((p) => `${p.x},${p.z}`).join(' ')} />
          {(
            [
              [layout.triangle.sink, labels.sink],
              [layout.triangle.hob, labels.hob],
              [layout.triangle.fridge, labels.fridge],
            ] as const
          ).map(([p, l]) => (
            <g key={l}>
              <circle cx={p.x} cy={p.z} r={7} />
              <text x={p.x + 10} y={p.z + 16} className={s.pTriText}>
                {l}
              </text>
            </g>
          ))}
        </g>
      ) : null}
      {/* dimensions */}
      <g className={s.pDim}>
        <line x1={0} y1={-T - 30} x2={W} y2={-T - 30} />
        <line x1={0} y1={-T - 38} x2={0} y2={-T - 22} />
        <line x1={W} y1={-T - 38} x2={W} y2={-T - 22} />
        <text x={W / 2} y={-T - 38} textAnchor="middle">
          {W} {labels.cm}
        </text>
        <line x1={-T - 30} y1={0} x2={-T - 30} y2={D} />
        <line x1={-T - 38} y1={0} x2={-T - 22} y2={0} />
        <line x1={-T - 38} y1={D} x2={-T - 22} y2={D} />
        <text x={-T - 40} y={D / 2} textAnchor="middle" transform={`rotate(-90 ${-T - 40} ${D / 2})`}>
          {D} {labels.cm}
        </text>
      </g>
    </svg>
  );
}
