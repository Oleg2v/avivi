/**
 * Example technical files for the professionals' library:
 *   public/downloads/avivi-base-unit-600-example.dxf   (DXF R12, millimetres)
 *   public/downloads/avivi-tall-unit-600-example.dxf
 *   public/downloads/avivi-technical-sheet-example.pdf (rendered with Playwright/Chromium)
 * Dimensions are common modular values drawn for the concept, not Avivi specifications.
 * Run: node scripts/downloads/make_files.cjs
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', '..', 'public', 'downloads');
fs.mkdirSync(OUT, { recursive: true });

/* ---------- DXF ---------- */
function dxf(entities) {
  const layers = [
    ['CARCASS', 7],
    ['FRONT', 3],
    ['PLINTH', 8],
    ['WORKTOP', 5],
    ['DIMENSIONS', 1],
    ['NOTES', 2],
  ];
  const out = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '0', 'ENDSEC'];
  out.push('0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', String(layers.length));
  for (const [name, color] of layers) out.push('0', 'LAYER', '2', name, '70', '0', '62', String(color), '6', 'CONTINUOUS');
  out.push('0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES');
  for (const e of entities) out.push(...e);
  out.push('0', 'ENDSEC', '0', 'EOF');
  return out.join('\r\n') + '\r\n';
}
const f = (n) => n.toFixed(1);
const line = (layer, x1, y1, x2, y2) => ['0', 'LINE', '8', layer, '10', f(x1), '20', f(y1), '30', '0.0', '11', f(x2), '21', f(y2), '31', '0.0'];
const rect = (layer, x, y, w, h) => [line(layer, x, y, x + w, y), line(layer, x + w, y, x + w, y + h), line(layer, x + w, y + h, x, y + h), line(layer, x, y + h, x, y)];
const text = (layer, x, y, h, s) => ['0', 'TEXT', '8', layer, '10', f(x), '20', f(y), '30', '0.0', '40', f(h), '1', s];
function dimH(x1, x2, y, label) {
  return [line('DIMENSIONS', x1, y, x2, y), line('DIMENSIONS', x1, y - 15, x1, y + 15), line('DIMENSIONS', x2, y - 15, x2, y + 15), text('DIMENSIONS', (x1 + x2) / 2 - label.length * 9, y + 12, 24, label)];
}
function dimV(y1, y2, x, label) {
  return [line('DIMENSIONS', x, y1, x, y2), line('DIMENSIONS', x - 15, y1, x + 15, y1), line('DIMENSIONS', x - 15, y2, x + 15, y2), text('DIMENSIONS', x + 14, (y1 + y2) / 2, 24, label)];
}

function unitDrawing({ height, name, door }) {
  const W = 600, D = 560, P = 100, T = 40, F = 19;
  const e = [];
  // front elevation
  e.push(...rect('PLINTH', 40, 0, W - 80, P));
  e.push(...rect('CARCASS', 0, P, W, height));
  if (door === 'drawers') {
    const h = height;
    const parts = [h * 0.22, h * 0.36, h * 0.42];
    let y = P;
    for (const ph of parts.reverse()) {
      e.push(...rect('FRONT', 2, y + 2, W - 4, ph - 4));
      y += ph;
    }
  } else {
    e.push(...rect('FRONT', 2, P + 2, W - 4, height - 4));
  }
  if (door === 'drawers') e.push(...rect('WORKTOP', -10, P + height, W + 20, T));
  e.push(...dimH(0, W, -60, '600'));
  e.push(...dimV(P, P + height, -70, String(height)));
  e.push(...dimV(0, P, -70, String(P)));
  // side section
  const sx = 900;
  e.push(...rect('PLINTH', sx + 60, 0, D - 60, P));
  e.push(...rect('CARCASS', sx, P, D, height));
  e.push(...rect('FRONT', sx + D, P, F, height));
  if (door === 'drawers') e.push(...rect('WORKTOP', sx - 10, P + height, D + F + 30, T));
  e.push(...dimH(sx, sx + D, -60, String(D)));
  // notes
  const top = P + height + (door === 'drawers' ? T : 0) + 140;
  e.push(text('NOTES', 0, top + 70, 34, `AVIVI KITCHENS - ${name} - EXAMPLE BLOCK`));
  e.push(text('NOTES', 0, top + 20, 22, 'Units: mm. Common modular values drawn for a design concept. Not an Avivi specification.'));
  e.push(text('NOTES', 0, top - 20, 22, 'Front elevation (left) and side section (right). Replace with Avivi technical catalogue.'));
  return dxf(e);
}

fs.writeFileSync(path.join(OUT, 'avivi-base-unit-600-example.dxf'), unitDrawing({ height: 720, name: 'BASE UNIT 600', door: 'drawers' }));
fs.writeFileSync(path.join(OUT, 'avivi-tall-unit-600-example.dxf'), unitDrawing({ height: 2100, name: 'TALL UNIT 600', door: 'door' }));
console.log('dxf written');

/* ---------- PDF ---------- */
const svgUnit = `
<svg viewBox="-120 -120 1700 1180" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">
  <g transform="translate(0 940) scale(1 -1)" fill="none" stroke="#1c1c1c" stroke-width="2.4">
    <rect x="40" y="0" width="520" height="100" stroke="#8a847c"/>
    <rect x="0" y="100" width="600" height="720"/>
    <rect x="2" y="102" width="596" height="298" stroke="#b48a4f"/>
    <rect x="2" y="402" width="596" height="258" stroke="#b48a4f"/>
    <rect x="2" y="662" width="596" height="156" stroke="#b48a4f"/>
    <rect x="-10" y="820" width="620" height="40" fill="#ece6dd"/>
    <rect x="960" y="0" width="500" height="100" stroke="#8a847c"/>
    <rect x="900" y="100" width="560" height="720"/>
    <rect x="1460" y="100" width="19" height="720" stroke="#b48a4f"/>
    <rect x="890" y="820" width="609" height="40" fill="#ece6dd"/>
    <g stroke="#7a5634" stroke-width="1.6">
      <path d="M0 -60H600M0 -75V-45M600 -75V-45"/>
      <path d="M-70 100V820M-85 100H-55M-85 820H-55"/>
      <path d="M-70 0V100M-85 0H-55"/>
      <path d="M900 -60H1460M900 -75V-45M1460 -75V-45"/>
    </g>
  </g>
  <g fill="#7a5634" font-size="30">
    <text x="270" y="1032">600</text>
    <text x="-112" y="480" transform="rotate(-90 -100 480)">720</text>
    <text x="-112" y="900">100</text>
    <text x="1150" y="1032">560</text>
  </g>
  <g fill="#645e57" font-size="24" letter-spacing="2">
    <text x="0" y="-70">FRONT ELEVATION</text>
    <text x="900" y="-70">SIDE SECTION</text>
  </g>
</svg>`;

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
body { margin: 0; font-family: Helvetica, Arial, sans-serif; color: #1c1c1c; background: #faf8f4; }
.page { width: 210mm; height: 297mm; padding: 18mm 18mm 16mm; position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 9mm; }
.wm { position: absolute; inset: 0; display: grid; place-items: center; pointer-events: none; }
.wm span { transform: rotate(-32deg); font-size: 120px; letter-spacing: 18px; color: rgba(180,138,79,0.10); font-weight: 700; }
header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid #1c1c1c; padding-bottom: 5mm; }
.brand { font-family: Georgia, serif; font-size: 26px; }
.brand small { font-family: Helvetica, Arial, sans-serif; font-size: 9px; letter-spacing: 3px; margin-left: 8px; color: #645e57; }
.tag { font-size: 9px; letter-spacing: 2px; text-transform: uppercase; border: 1px solid #b48a4f; color: #7a5634; padding: 4px 8px; border-radius: 99px; }
h1 { font-family: Georgia, serif; font-weight: 400; font-size: 34px; margin: 0; }
.sub { color: #645e57; font-size: 12px; margin-top: 2mm; }
.drawing { border: 1px solid rgba(28,28,28,0.14); background: #fff; padding: 8mm; }
.drawing svg { width: 100%; height: auto; display: block; }
table { width: 100%; border-collapse: collapse; font-size: 11px; }
th, td { text-align: left; padding: 7px 0; border-bottom: 1px solid rgba(28,28,28,0.14); vertical-align: top; }
th { width: 42%; font-weight: 500; color: #645e57; }
td em { font-style: normal; font-size: 9px; letter-spacing: 1px; text-transform: uppercase; color: #7a5634; border: 1px dashed #b48a4f; padding: 2px 6px; border-radius: 99px; margin-left: 6px; }
.cols { display: grid; grid-template-columns: 1.2fr 1fr; gap: 10mm; }
.note { font-size: 10px; color: #645e57; line-height: 1.55; }
footer { margin-top: auto; display: flex; justify-content: space-between; font-size: 9px; color: #645e57; border-top: 1px solid rgba(28,28,28,0.14); padding-top: 4mm; }
</style></head><body><div class="page">
<div class="wm"><span>EXAMPLE</span></div>
<header><div class="brand">Avivi<small>KITCHENS</small></div><span class="tag">Example file · design concept</span></header>
<div><h1>Base unit 600 · drawers</h1><div class="sub">Technical sheet layout for architects and interior designers. Values shown are common modular dimensions drawn for this concept.</div></div>
<div class="drawing">${svgUnit}</div>
<div class="cols">
<table>
<tr><th>Width</th><td>600 mm <em>example</em></td></tr>
<tr><th>Carcass height</th><td>720 mm <em>example</em></td></tr>
<tr><th>Carcass depth</th><td>560 mm <em>example</em></td></tr>
<tr><th>Plinth</th><td>100 mm <em>example</em></td></tr>
<tr><th>Worktop</th><td>Per project <em>to confirm</em></td></tr>
<tr><th>Fronts</th><td>Per collection: Modern, Classic, Dark, Light, Avivi Specials</td></tr>
<tr><th>Carcass material and edging</th><td><em>to confirm</em></td></tr>
<tr><th>Runners and hinges</th><td><em>to confirm</em></td></tr>
</table>
<div class="note">
<p><strong>About this file.</strong> This sheet shows how Avivi’s technical documentation could look in the professionals’ area of the new site. It is an example made for a design concept and is not an Avivi specification.</p>
<p>In production, every sheet is generated from Avivi’s technical catalogue, together with the matching CAD block (DXF/DWG) and material swatches, and is updated when the catalogue changes.</p>
<p>CAD block: avivi-base-unit-600-example.dxf</p>
</div>
</div>
<footer><span>Design concept. Not the official Avivi Kitchens website.</span><span>Sheet AV-EX-600 · Rev. example</span></footer>
</div></body></html>`;

(async () => {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.log('playwright not available: PDF skipped');
    return;
  }
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.pdf({ path: path.join(OUT, 'avivi-technical-sheet-example.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('pdf written');
})();
