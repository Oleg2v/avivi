/**
 * Geometry helpers. UVs are rewritten in metres (from position and normal), so procedural
 * textures keep real-world scale on every part, and grain continues across neighbouring
 * fronts when they share a world offset.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/** Rewrite UVs in metres. swap=true turns vertical grain into horizontal (shelves, tops). */
export function metricUV(geo: THREE.BufferGeometry, offset: [number, number] = [0, 0], swap = false) {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const nor = geo.getAttribute('normal') as THREE.BufferAttribute;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i));
    const ny = Math.abs(nor.getY(i));
    const nz = Math.abs(nor.getZ(i));
    let u: number;
    let v: number;
    if (nx >= ny && nx >= nz) {
      u = z;
      v = y;
    } else if (ny >= nx && ny >= nz) {
      u = x;
      v = z;
    } else {
      u = x;
      v = y;
    }
    if (swap) [u, v] = [v, u];
    uv[i * 2] = u + offset[0];
    uv[i * 2 + 1] = v + offset[1];
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/** A box with optional bevel (rounded edges catch highlights like real fronts). */
export function boxGeo(w: number, h: number, d: number, bevel = 0, offset: [number, number] = [0, 0], swap = false) {
  const g = bevel > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(bevel, w / 2.2, h / 2.2, d / 2.2)) : new THREE.BoxGeometry(w, h, d);
  return metricUV(g, offset, swap);
}

/** Mesh positioned by its min corner (x0,y0,z0) rather than its centre. */
export function boxAt(
  mat: THREE.Material,
  x0: number,
  y0: number,
  z0: number,
  w: number,
  h: number,
  d: number,
  opts: { bevel?: number; offset?: [number, number]; swap?: boolean; name?: string; cast?: boolean; receive?: boolean } = {},
) {
  // offset = coordinate of the min corner in a shared frame (run coordinates), so the
  // texture continues seamlessly from one front to the next.
  const o = opts.offset ?? [x0, y0];
  const m = new THREE.Mesh(boxGeo(w, h, d, opts.bevel ?? 0, [o[0] + w / 2, o[1] + h / 2], opts.swap ?? false), mat);
  m.position.set(x0 + w / 2, y0 + h / 2, z0 + d / 2);
  if (opts.name) m.name = opts.name;
  m.castShadow = opts.cast ?? true;
  m.receiveShadow = opts.receive ?? true;
  return m;
}

export function cylinder(mat: THREE.Material, r: number, h: number, seg = 24) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
  m.castShadow = true;
  return m;
}
