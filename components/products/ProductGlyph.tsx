/** Hairline drawings for the product schedule (drafting style, no stock photography). */
const G: Record<string, React.ReactNode> = {
  'marble-white': (
    <>
      <rect x="14" y="16" width="92" height="58" className="fill-paper" />
      <path d="M14 30c18 4 26 18 44 16s24-18 48-12M30 74c6-12 18-16 26-26M72 16c-2 12 6 22 4 34" className="vein" />
    </>
  ),
  'marble-dark': (
    <>
      <rect x="14" y="16" width="92" height="58" className="fill-ink" />
      <path d="M14 44c20-6 30 10 50 2s26-20 42-14M40 16c4 14-4 30 4 42" className="vein-light" />
    </>
  ),
  travertine: (
    <>
      <rect x="14" y="16" width="92" height="58" className="fill-sand" />
      <path d="M14 28c30 3 60-2 92 1M14 40c26-2 64 3 92 0M14 52c34 2 58-3 92 1M14 63c28-1 62 2 92-1" className="band" />
    </>
  ),
  'stone-light': (
    <>
      <rect x="14" y="16" width="92" height="58" className="fill-paper" />
      {[22, 34, 47, 58, 70, 83, 95].map((x, i) => (
        <circle key={x} cx={x} cy={24 + ((i * 17) % 44)} r="0.9" className="dot" />
      ))}
      {[28, 41, 52, 66, 77, 90].map((x, i) => (
        <circle key={x} cx={x} cy={30 + ((i * 23) % 38)} r="0.7" className="dot" />
      ))}
    </>
  ),
  'tiles-handmade': (
    <>
      {[0, 1, 2].map((r) =>
        [0, 1, 2, 3].map((c) => <path key={`${r}${c}`} d={`M${16 + c * 23} ${15 + r * 21}l20 .6.4 18.6-20.2-.4z`} className="tile" />),
      )}
    </>
  ),
  'tiles-stack': (
    <>
      {[0, 1, 2, 3, 4, 5, 6, 7].map((c) => [0, 1].map((r) => <rect key={`${c}${r}`} x={16 + c * 11.2} y={14 + r * 31} width="10" height="29" className="tile" />))}
    </>
  ),
  'slab-splash': (
    <>
      <rect x="12" y="14" width="96" height="44" className="fill-paper" />
      <rect x="10" y="58" width="100" height="6" className="fill-paper" />
      <path d="M12 26c22 6 40-6 62 4s22 6 34 2" className="vein" />
      <path d="M12 64v14M108 64v14" className="thin" />
    </>
  ),
  'oven-column': (
    <>
      <rect x="40" y="6" width="40" height="80" />
      <rect x="44" y="22" width="32" height="20" />
      <rect x="44" y="46" width="32" height="20" />
      <path d="M48 26h24M48 50h24" className="thin" />
    </>
  ),
  'induction-flush': (
    <>
      <path d="M8 60l18-30h86l-18 30z" className="fill-paper" />
      <path d="M30 56l12-21h48l-12 21z" className="fill-ink" />
      <ellipse cx="52" cy="41" rx="7" ry="3.4" className="ring" />
      <ellipse cx="72" cy="41" rx="6" ry="3" className="ring" />
      <ellipse cx="47" cy="50" rx="6" ry="3" className="ring" />
      <ellipse cx="68" cy="50" rx="7.5" ry="3.6" className="ring" />
    </>
  ),
  'fridge-integrated': (
    <>
      <rect x="38" y="6" width="44" height="80" />
      <path d="M38 40h44" />
      <path d="M44 12v22M44 46v34" className="thin" />
    </>
  ),
  'sink-steel': (
    <>
      <rect x="18" y="20" width="84" height="50" className="fill-paper" />
      <rect x="30" y="28" width="60" height="34" rx="4" />
      {[33, 38, 43, 48, 53, 58].map((y) => (
        <path key={y} d={`M34 ${y}h52`} className="brush" />
      ))}
      <circle cx="60" cy="45" r="3" />
    </>
  ),
  'sink-ceramic': (
    <>
      <path d="M18 30h84" />
      <path d="M24 30v10c0 14 10 24 36 24s36-10 36-24V30" className="fill-paper" />
      <path d="M60 14v10M54 14h12" className="thin" />
    </>
  ),
  'sink-granite': (
    <>
      <rect x="18" y="20" width="84" height="50" className="fill-paper" />
      <rect x="30" y="28" width="60" height="34" rx="6" className="fill-ink" />
      <circle cx="60" cy="45" r="3" className="ring-light" />
    </>
  ),
  'organiser-oak': (
    <>
      <rect x="14" y="16" width="92" height="58" className="fill-sand" />
      <path d="M44 16v58M74 16v58M14 44h30M74 34h32M74 54h32" />
    </>
  ),
  'led-strip': (
    <>
      <rect x="18" y="12" width="84" height="26" />
      <path d="M22 40h76" className="glow" />
      <path d="M22 41l-10 38M98 41l10 38" className="thin" />
      <path d="M8 80h104" />
    </>
  ),
  'waste-system': (
    <>
      <path d="M12 30h96v44H12z" />
      <rect x="20" y="38" width="22" height="30" />
      <rect x="48" y="38" width="22" height="30" />
      <rect x="76" y="38" width="24" height="30" />
      <path d="M50 22h20" className="thin" />
    </>
  ),
};

export function ProductGlyph({ id, className }: { id: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 90" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true" focusable="false">
      {G[id] ?? <rect x="20" y="20" width="80" height="50" />}
    </svg>
  );
}
