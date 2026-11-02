import { readFileSync, writeFileSync } from 'node:fs';
import { feature } from 'topojson-client';
const topo = JSON.parse(readFileSync('node_modules/world-atlas/land-10m.json', 'utf8'));
const land = feature(topo, topo.objects.land);
// bbox: Mediterranean coast from Rosh HaNikra to Ashkelon
const LON0 = 34.3, LON1 = 35.62, LAT0 = 31.58, LAT1 = 33.12;
const W = 520, H = 760; // svg units
const k = Math.cos(32.35 * Math.PI / 180);
const sx = W / ((LON1 - LON0) * k), sy = H / (LAT1 - LAT0);
const s = Math.min(sx, sy);
const proj = ([lon, lat]) => [((lon - LON0) * k) * s, (LAT1 - lat) * s];
// collect coastline points: rings' vertices inside bbox, keep only the sea-facing edge (west of 35.2 roughly)
let best = [];
for (const f of [land]) {
  const geoms = f.features ? f.features.map((x) => x.geometry) : [f.geometry];
  for (const g of geoms) {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      const ring = poly[0];
      let run = [];
      for (const p of ring) {
        const inside = p[0] >= LON0 && p[0] <= 35.12 && p[1] >= LAT0 && p[1] <= LAT1;
        if (inside) run.push(p);
        else { if (run.length > best.length) best = run; run = []; }
      }
      if (run.length > best.length) best = run;
    }
  }
}
// order north -> south
if (best.length && best[0][1] < best[best.length - 1][1]) best.reverse();
// simplify (Douglas-Peucker in projected space)
const pts = best.map(proj);
function dp(points, eps) {
  if (points.length < 3) return points;
  const [a, b] = [points[0], points[points.length - 1]];
  let idx = -1, max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const num = Math.abs((b[1] - a[1]) * p[0] - (b[0] - a[0]) * p[1] + b[0] * a[1] - b[1] * a[0]);
    const den = Math.hypot(b[1] - a[1], b[0] - a[0]) || 1;
    const d = num / den;
    if (d > max) { max = d; idx = i; }
  }
  if (max > eps) return [...dp(points.slice(0, idx + 1), eps).slice(0, -1), ...dp(points.slice(idx), eps)];
  return [a, b];
}
const simp = dp(pts, 0.6);
const d = 'M' + simp.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L');
const out = { width: Math.round((LON1 - LON0) * k * s), height: Math.round((LAT1 - LAT0) * s), bbox: [LON0, LAT0, LON1, LAT1], k, s, coast: d, points: simp.length };
writeFileSync('coast.json', JSON.stringify(out));
console.log('points', best.length, '->', simp.length, 'size', out.width, out.height);
