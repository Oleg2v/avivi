/**
 * Converts the raw Cycles renders (PNG) into web images:
 *   public/renders/<name>.webp (1500 px) and a manifest with blur placeholders.
 * Usage: RAW_DIR=/path/to/pngs node scripts/optimise-renders.mjs
 */
import { readdir, mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const RAW = process.env.RAW_DIR || 'renders-raw';
const OUT = 'public/renders';
const MANIFEST = 'lib/data/renders.json';

await mkdir(OUT, { recursive: true });
const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};
const files = (await readdir(RAW)).filter((f) => f.endsWith('.png'));
for (const f of files) {
  const name = f.replace(/\.png$/, '');
  const src = path.join(RAW, f);
  const img = sharp(src);
  const meta = await img.metadata();
  await img.clone().resize({ width: 1500 }).webp({ quality: 82, effort: 6 }).toFile(path.join(OUT, `${name}.webp`));
  const blur = await img.clone().resize({ width: 24 }).webp({ quality: 50 }).toBuffer();
  manifest[name] = { w: 1500, h: Math.round((1500 * meta.height) / meta.width), blur: `data:image/webp;base64,${blur.toString('base64')}` };
  console.log('ok', name);
}
await writeFile(MANIFEST, JSON.stringify(manifest, null, 1));
