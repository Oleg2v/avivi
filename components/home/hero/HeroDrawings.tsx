/**
 * Fallback and poster for the hero: four joinery line drawings (board, cut, joined,
 * assembled) drawn as SVG elevations with millimetre dimension lines.
 * The client crossfades them with scroll when WebGL is not available.
 */
const S = 0.32; // px per mm in the 1200 x 760 viewBox
const ox = 600;
const floor = 640;

function dim(x1: number, x2: number, y: number, label: string, key: string) {
  return (
    <g key={key} className="hd-dim">
      <line x1={x1} y1={y} x2={x2} y2={y} />
      <line x1={x1} y1={y - 7} x2={x1} y2={y + 7} />
      <line x1={x2} y1={y - 7} x2={x2} y2={y + 7} />
      <rect x={(x1 + x2) / 2 - 22} y={y - 9} width={44} height={18} className="hd-label-bg" />
      <text x={(x1 + x2) / 2} y={y + 4} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}

function vdim(x: number, y1: number, y2: number, label: string, key: string) {
  return (
    <g key={key} className="hd-dim">
      <line x1={x} y1={y1} x2={x} y2={y2} />
      <line x1={x - 7} y1={y1} x2={x + 7} y2={y1} />
      <line x1={x - 7} y1={y2} x2={x + 7} y2={y2} />
      <text x={x - 12} y={(y1 + y2) / 2} textAnchor="end">
        {label}
      </text>
    </g>
  );
}

function bench(boardPieces: number, gap: number) {
  const len = 2200 * S;
  const top = floor - 900 * S;
  const els = [
    <rect key="top" x={ox - len / 2} y={top} width={len} height={60 * S} />,
    <rect key="l1" x={ox - len / 2 + 120 * S} y={top + 60 * S} width={70 * S} height={840 * S - 60 * S} />,
    <rect key="l2" x={ox + len / 2 - 190 * S} y={top + 60 * S} width={70 * S} height={840 * S - 60 * S} />,
    <rect key="st" x={ox - len / 2 + 190 * S} y={floor - 240 * S} width={len - 380 * S} height={60 * S} />,
  ];
  const bl = 2400 * S;
  const pw = bl / boardPieces;
  for (let i = 0; i < boardPieces; i++) {
    const g = (i - (boardPieces - 1) / 2) * gap;
    els.push(<rect key={`p${i}`} className="hd-oak" x={ox - bl / 2 + i * pw + g} y={top - 22 * S} width={pw - (boardPieces > 1 ? 1 : 0)} height={22 * S} />);
  }
  return els;
}

export function HeroDrawings({ className }: { className?: string }) {
  const runX = ox - 2400 * S;
  const fronts: { x: number; w: number; y: number; h: number }[] = [];
  // base run: drawers 600 (3), sink 800 (2), dishwasher 600, hob 900 (2)
  const base = [
    { w: 600, split: [0.38, 0.38, 0.24] },
    { w: 800, split: [1], doors: 2 },
    { w: 600, split: [1] },
    { w: 900, split: [0.5, 0.5] },
  ];
  let x = runX + 1800 * S;
  for (const m of base) {
    const total = 740;
    let y = floor - 120 * S;
    if (m.doors) {
      fronts.push({ x, w: (m.w / 2) * S, y: y - total * S, h: total * S });
      fronts.push({ x: x + (m.w / 2) * S, w: (m.w / 2) * S, y: y - total * S, h: total * S });
    } else {
      for (const f of m.split) {
        const h = total * f * S;
        fronts.push({ x, w: m.w * S, y: y - h, h });
        y -= h;
      }
    }
    x += m.w * S;
  }
  const frontEls = (offsetY = 0) => fronts.map((f, i) => <rect key={`f${i}`} className="hd-oak" x={f.x + 1} y={f.y + 1 + offsetY} width={f.w - 2} height={f.h - 2} />);

  return (
    <svg className={className} viewBox="0 0 1200 760" role="img" aria-hidden="true" focusable="false">
      <defs>
        <pattern id="hd-grain" width="6" height="40" patternUnits="userSpaceOnUse">
          <path d="M3 0 C 4 10, 2 20, 3 40" className="hd-grain" />
        </pattern>
      </defs>
      <line className="hd-floor" x1="40" y1={floor} x2="1160" y2={floor} />
      {/* 1. a board of oak on the bench */}
      <g className="hd-frame" data-frame="0">
        {bench(1, 0)}
        {dim(ox - 1200 * S, ox + 1200 * S, floor - 900 * S - 70, '2400', 'd1')}
        {vdim(ox - 1100 * S - 40, floor - 900 * S, floor, '900', 'v1')}
      </g>
      {/* 2. cut into eight */}
      <g className="hd-frame" data-frame="1">
        {bench(8, 6)}
        {dim(ox - 1200 * S, ox - 900 * S, floor - 900 * S - 70, '300', 'd2')}
        <text className="hd-note" x={ox} y={floor - 900 * S - 110} textAnchor="middle">
          × 8
        </text>
      </g>
      {/* 3. joined: the pieces become fronts */}
      <g className="hd-frame" data-frame="2">
        <line className="hd-wall" x1={runX} y1={floor} x2={runX} y2={floor - 2250 * S} />
        {frontEls()}
        {dim(runX + 1800 * S, runX + 2400 * S, floor + 34, '600', 'd3')}
        {dim(runX + 2400 * S, runX + 3200 * S, floor + 34, '800', 'd4')}
        {dim(runX + 3800 * S, runX + 4700 * S, floor + 34, '900', 'd5')}
      </g>
      {/* 4. assembled kitchen */}
      <g className="hd-frame" data-frame="3">
        {[0, 600, 1200].map((tx, i) => (
          <rect key={`t${i}`} x={runX + tx * S + 1} y={floor - 2250 * S} width={600 * S - 2} height={(2250 - 120) * S} />
        ))}
        <rect x={runX + 1800 * S} y={floor - 860 * S} width={2900 * S} height={740 * S} className="hd-carcass" />
        {frontEls()}
        <rect x={runX + 1800 * S} y={floor - 900 * S} width={2900 * S} height={40 * S} className="hd-stone" />
        {[0, 600, 1400, 2000].map((wx, i) => (
          <rect key={`w${i}`} x={runX + (1800 + wx) * S + 1} y={floor - 2250 * S} width={([600, 800, 600, 900][i]) * S - 2} height={750 * S} />
        ))}
        <rect x={ox - 1200 * S + 250 * S} y={floor - 900 * S} width={2400 * S} height={40 * S} className="hd-stone" />
        <rect x={ox - 1200 * S + 250 * S} y={floor - 860 * S} width={2400 * S} height={740 * S} className="hd-oak hd-island" />
        {vdim(runX - 40, floor - 2250 * S, floor, '2250', 'v4')}
        {dim(runX, runX + 4800 * S, floor + 34, '4800', 'd6')}
      </g>
    </svg>
  );
}
