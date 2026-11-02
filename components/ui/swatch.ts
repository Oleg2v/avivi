import type { CSSProperties } from 'react';
import type { MaterialSpec } from '@/lib/data/collections';

/** CSS approximations of the materials, for small UI swatches (no images). */
export function swatchStyle(spec: MaterialSpec): CSSProperties {
  switch (spec.kind) {
    case 'oak':
      return { background: 'repeating-linear-gradient(92deg, rgba(110,70,35,.0) 0 5px, rgba(110,70,35,.22) 5px 6px, rgba(110,70,35,0) 6px 11px, rgba(110,70,35,.12) 11px 12px), linear-gradient(90deg,#C99F70,#D3AD80 40%,#BF9466)' };
    case 'paleOak':
      return { background: 'repeating-linear-gradient(92deg, rgba(140,100,60,0) 0 6px, rgba(140,100,60,.16) 6px 7px, rgba(140,100,60,0) 7px 13px), linear-gradient(90deg,#DDC29D,#E6CFAD 45%,#D4B68F)' };
    case 'walnut':
      return { background: 'repeating-linear-gradient(94deg, rgba(20,10,5,0) 0 4px, rgba(20,10,5,.3) 4px 5px, rgba(20,10,5,0) 5px 9px), linear-gradient(90deg,#6E4B33,#7E583C 40%,#5A3C29)' };
    case 'marble':
      return { background: 'linear-gradient(118deg, transparent 0 38%, rgba(110,104,96,.55) 39%, transparent 41% 62%, rgba(140,134,126,.35) 63%, transparent 64%), #EFECE7' };
    case 'nero':
      return { background: 'linear-gradient(122deg, transparent 0 44%, rgba(220,212,200,.6) 45%, transparent 46.5% 70%, rgba(200,190,180,.3) 71%, transparent 72%), #1E1D1C' };
    case 'travertine':
      return { background: 'repeating-linear-gradient(0deg, rgba(160,130,95,.0) 0 7px, rgba(160,130,95,.22) 7px 8px, rgba(160,130,95,0) 8px 15px), #D8C8AF' };
    case 'quartz':
      return { background: 'linear-gradient(130deg, transparent 0 50%, rgba(190,182,170,.4) 51%, transparent 52.5%), #F2F0EB' };
    case 'stone':
      return { background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,.35), transparent 60%), #D6D3CD' };
    case 'brass':
      return { background: 'linear-gradient(135deg,#8C6A3A,#D2AC6E 45%,#9B7743 70%,#C9A15F)' };
    case 'steel':
      return { background: 'linear-gradient(135deg,#9EA2A4,#E2E3E3 45%,#A9ADAF 70%,#D2D4D5)' };
    case 'bronze':
      return { background: 'linear-gradient(135deg,#2B2520,#5A4B3C 45%,#2F2822 70%,#4A3E33)' };
    case 'lacquer':
    default:
      return { background: `linear-gradient(160deg, rgba(255,255,255,.12), rgba(0,0,0,.06)), ${spec.color}` };
  }
}
