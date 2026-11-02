/**
 * Kitchen builder. Turns a layout (runs of modules, an optional island) and a collection
 * finish into a three.js group with named parts, so scenes can animate fronts (hero),
 * open drawers (SMART KITCHEN), relight (day to night) or rebuild live (planner).
 *
 * Conventions: metres, Y up, back wall at z = 0, the room opens towards +z.
 * A run's local frame: +x along the run, +z out of the wall (towards the user).
 */
import * as THREE from 'three';
import type { Finish } from '@/lib/data/collections';
import { boxAt, boxGeo, cylinder } from './geo';
import type { MaterialLibrary } from './materials';

export const DIM = {
  plinth: 0.12,
  baseTop: 0.86,
  ct: 0.04,
  counter: 0.9,
  baseD: 0.56,
  frontT: 0.019,
  wallY0: 1.5,
  wallY1: 2.25,
  wallD: 0.35,
  tallTop: 2.25,
  tallD: 0.58,
  gap: 0.0015,
};

export type ModuleKind =
  | 'drawers'
  | 'drawers2'
  | 'sink'
  | 'hob'
  | 'dishwasher'
  | 'door'
  | 'corner'
  | 'filler'
  | 'fridge'
  | 'oven'
  | 'pantry'
  | 'appliance';

export interface ModuleSpec {
  kind: ModuleKind;
  width: number;
  id?: string;
}

export interface WallSpec {
  offset: number;
  width: number;
  kind?: 'wall' | 'open' | 'hood' | 'liftup';
  id?: string;
}

export interface RunSpec {
  id: string;
  x: number;
  z: number;
  rot: number;
  base: ModuleSpec[];
  wall?: WallSpec[];
  /** Counter extent along the run (defaults to the base modules' extent, minus tall units). */
  counter?: { from: number; to: number }[] | false;
  splash?: { from: number; to: number; height?: number }[] | false;
}

export interface IslandSpec {
  cx: number;
  cz: number;
  length: number;
  depth?: number;
  modules?: ModuleSpec[];
  pendants?: number;
}

export interface KitchenSpec {
  runs: RunSpec[];
  island?: IslandSpec;
  finish: Finish;
  interiors?: boolean;
  ceiling?: number;
}

export type MoverType = 'slide' | 'swing' | 'lift';

export interface Mover {
  object: THREE.Object3D;
  type: MoverType;
  /** slide: metres along local +z. swing/lift: radians. */
  amount: number;
  key: string;
  moduleId: string;
  base: THREE.Vector3;
  baseRot: THREE.Euler;
}

export interface BuiltModule {
  id: string;
  kind: ModuleKind | 'wall' | 'open' | 'hood' | 'liftup' | 'island';
  category: 'base' | 'tall' | 'wall' | 'island';
  run: string;
  group: THREE.Group;
  fronts: THREE.Mesh[];
  carcass: THREE.Mesh[];
  width: number;
  start: number;
  key: string;
}

export interface BuiltKitchen {
  root: THREE.Group;
  runs: Record<string, THREE.Group>;
  modules: BuiltModule[];
  movers: Mover[];
  counters: THREE.Mesh[];
  splashes: THREE.Mesh[];
  channels: THREE.Mesh[];
  leds: THREE.Mesh[];
  pendants: THREE.Group[];
  pendantGlow: THREE.MeshStandardMaterial;
  ledMat: THREE.MeshStandardMaterial;
  island?: { group: THREE.Group; top: THREE.Mesh; body: THREE.Object3D[] };
  points: { sink?: THREE.Vector3; hob?: THREE.Vector3; fridge?: THREE.Vector3 };
  hitTargets: THREE.Object3D[];
}

const KEY_BY_KIND: Partial<Record<string, string>> = {
  drawers: 'drawers',
  drawers2: 'drawers',
  hob: 'drawers',
  sink: 'bin',
  corner: 'corner',
  pantry: 'pantry',
  oven: 'tall',
  fridge: 'tall',
  appliance: 'appliance',
  liftup: 'appliance',
  dishwasher: 'drawers',
};

export function buildKitchen(spec: KitchenSpec, lib: MaterialLibrary): BuiltKitchen {
  const f = spec.finish;
  const M = {
    front: lib.get(f.front, f.fluted ? 'fluted' : ''),
    tall: lib.get(f.tall),
    wall: lib.get(f.wall),
    island: lib.get(f.island, f.fluted && f.island.kind !== 'lacquer' ? 'fluted' : ''),
    islandPanel: lib.get(f.island),
    counter: lib.get(f.counter),
    splash: lib.get(f.splash),
    handle: lib.get(f.handleMetal),
    carcass: lib.plain('carcass', { color: '#E6E2DB', roughness: 0.7 }),
    inner: lib.plain('inner', { color: '#DCD6CC', roughness: 0.75 }),
    plinth: lib.plain('plinth', { color: '#262422', roughness: 0.8 }),
    gap: lib.plain('gap', { color: '#141312', roughness: 0.9 }),
    glass: lib.plain('glass', { color: '#0b0b0c', roughness: 0.05, metalness: 0.2 }),
    steel: lib.get({ kind: 'steel', color: '#C9CBCC', rough: 0.3 }),
    ring: lib.plain('ring', { color: '#3a3a3b', roughness: 0.35 }),
    shelf: lib.get(f.island.kind === 'lacquer' ? { kind: 'oak', color: '#C9A27A', rough: 0.5 } : f.island),
    jar: lib.plain('jar', { color: '#C7B39A', roughness: 0.7 }),
    plate: lib.plain('plate', { color: '#F1EEE8', roughness: 0.25 }),
    pot: lib.plain('pot', { color: '#9EA2A5', roughness: 0.3, metalness: 0.9 }),
  };
  const ledMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: new THREE.Color('#FFD7A0'), emissiveIntensity: 0.4, roughness: 0.5 });
  const pendantGlow = new THREE.MeshStandardMaterial({ color: '#F4EDE2', emissive: new THREE.Color('#FFCF94'), emissiveIntensity: 0, roughness: 0.5 });

  const root = new THREE.Group();
  root.name = 'kitchen';
  const out: BuiltKitchen = {
    root,
    runs: {},
    modules: [],
    movers: [],
    counters: [],
    splashes: [],
    channels: [],
    leds: [],
    pendants: [],
    pendantGlow,
    ledMat,
    points: {},
    hitTargets: [],
  };

  const channel = f.handle === 'channel';

  /* ---------------------------------------------------------------- handles */
  function handle(parent: THREE.Object3D, x0: number, x1: number, y0: number, y1: number, zf: number, drawer: boolean, hingeLeft: boolean, tall = false) {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    switch (f.handle) {
      case 'channel':
        return;
      case 'edge': {
        if (drawer || y1 < 1.2) {
          const L = Math.min(0.22, w * 0.5);
          parent.add(boxAt(M.handle, cx - L / 2, y1 - 0.004, zf - 0.002, L, 0.006, 0.024, { bevel: 0.0015 }));
        } else {
          const xe = hingeLeft ? x1 - 0.008 : x0 + 0.002;
          const yc = tall ? 1.05 : y0 + 0.18;
          parent.add(boxAt(M.handle, xe, yc - 0.12, zf - 0.002, 0.006, 0.24, 0.024, { bevel: 0.0015 }));
        }
        return;
      }
      case 'bar': {
        const horizontal = drawer || (!tall && y1 < 1.2);
        const L = horizontal ? Math.min(0.32, w - 0.12) : 0.24;
        const bar = cylinder(M.handle, 0.0055, L, 14);
        let px: number, py: number;
        if (horizontal) {
          bar.rotation.z = Math.PI / 2;
          px = cx;
          py = y1 - h05(y0, y1);
        } else {
          px = hingeLeft ? x1 - 0.05 : x0 + 0.05;
          py = tall ? 1.05 : y0 > 1.4 ? y0 + 0.16 : y1 - 0.18;
        }
        bar.position.set(px, py, zf + 0.032);
        parent.add(bar);
        for (const sgn of [-1, 1]) {
          const post = cylinder(M.handle, 0.004, 0.03, 10);
          post.rotation.x = Math.PI / 2;
          post.position.set(horizontal ? px + sgn * (L / 2 - 0.02) : px, horizontal ? py : py + sgn * (L / 2 - 0.02), zf + 0.016);
          parent.add(post);
        }
        return;
      }
      case 'knob':
      default: {
        if (drawer) {
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.09, 20, 1, false, 0, Math.PI), M.handle);
          cup.rotation.z = Math.PI / 2;
          cup.rotation.y = Math.PI;
          cup.scale.set(1, 1, 0.55);
          cup.position.set(cx, y1 - h05(y0, y1) + 0.01, zf + 0.004);
          cup.castShadow = true;
          parent.add(cup);
        } else {
          const xe = hingeLeft ? x1 - 0.045 : x0 + 0.045;
          const yc = tall ? 1.05 : y0 > 1.4 ? y0 + 0.07 : y1 - 0.07;
          const stem = cylinder(M.handle, 0.006, 0.022, 12);
          stem.rotation.x = Math.PI / 2;
          stem.position.set(xe, yc, zf + 0.011);
          const knob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 20, 12), M.handle);
          knob.scale.set(1, 1, 0.72);
          knob.position.set(xe, yc, zf + 0.026);
          knob.castShadow = true;
          parent.add(stem, knob);
        }
      }
    }
  }
  function h05(y0: number, y1: number) {
    return y1 - y0 > 0.25 ? 0.055 : (y1 - y0) / 2;
  }

  /* ---------------------------------------------------------------- fronts */
  function front(
    parent: THREE.Object3D,
    mod: BuiltModule,
    mat: THREE.Material,
    x0: number,
    x1: number,
    y0: number,
    y1: number,
    zBack: number,
    o: { drawer?: boolean; hingeLeft?: boolean; tall?: boolean; handle?: boolean; offset?: number; frame?: boolean } = {},
  ): THREE.Group {
    const g = new THREE.Group();
    const fx0 = x0 + DIM.gap;
    const fx1 = x1 - DIM.gap;
    const fy0 = y0 + DIM.gap;
    const fy1 = y1 - DIM.gap;
    const w = fx1 - fx0;
    const h = fy1 - fy0;
    const off = (o.offset ?? 0) + fx0;
    const framed = (o.frame ?? f.frame) && w > 0.18 && h > 0.12;
    let zFace = zBack + DIM.frontT;
    if (framed) {
      const panel = boxAt(mat, fx0, fy0, zBack, w, h, DIM.frontT - 0.007, { offset: [off, fy0], bevel: 0.001 });
      const rw = h > 0.25 ? 0.062 : 0.045;
      const zt = zBack + DIM.frontT - 0.007;
      const rails = [
        boxAt(mat, fx0, fy0, zt, rw, h, 0.009, { offset: [off, fy0], bevel: 0.0018 }),
        boxAt(mat, fx1 - rw, fy0, zt, rw, h, 0.009, { offset: [off + w - rw, fy0], bevel: 0.0018 }),
        boxAt(mat, fx0 + rw, fy0, zt, w - 2 * rw, rw, 0.009, { offset: [off + rw, fy0], bevel: 0.0018 }),
        boxAt(mat, fx0 + rw, fy1 - rw, zt, w - 2 * rw, rw, 0.009, { offset: [off + rw, fy1 - rw], bevel: 0.0018 }),
      ];
      g.add(panel, ...rails);
      mod.fronts.push(panel, ...rails);
      zFace = zt + 0.009;
    } else {
      const m = boxAt(mat, fx0, fy0, zBack, w, h, DIM.frontT, { offset: [off, fy0], bevel: 0.0016 });
      m.name = 'front';
      g.add(m);
      mod.fronts.push(m);
    }
    if (o.handle !== false) handle(g, fx0, fx1, fy0, fy1, zFace, !!o.drawer, o.hingeLeft ?? true, !!o.tall);
    parent.add(g);
    return g;
  }

  function addMover(obj: THREE.Object3D, type: MoverType, amount: number, mod: BuiltModule, key?: string) {
    out.movers.push({ object: obj, type, amount, key: key || mod.key, moduleId: mod.id, base: obj.position.clone(), baseRot: obj.rotation.clone() });
  }

  /** Drawer interior: sides, back and bottom that slide with the front. */
  function drawerBox(g: THREE.Group, x0: number, x1: number, y0: number, h: number, deep: boolean) {
    const t = 0.012;
    const d = DIM.baseD - 0.05;
    const z0 = DIM.baseD - d;
    const hh = Math.max(0.06, h - 0.04);
    g.add(
      boxAt(M.inner, x0 + 0.02, y0 + 0.015, z0, t, hh, d, { cast: false }),
      boxAt(M.inner, x1 - 0.02 - t, y0 + 0.015, z0, t, hh, d, { cast: false }),
      boxAt(M.inner, x0 + 0.02, y0 + 0.015, z0, x1 - x0 - 0.04, hh, t, { cast: false }),
      boxAt(M.inner, x0 + 0.02, y0 + 0.012, z0, x1 - x0 - 0.04, 0.008, d, { cast: false }),
    );
    // Contents: pots in deep drawers, plates or cutlery trays in shallow ones.
    const cx = (x0 + x1) / 2;
    if (deep) {
      const pot = cylinder(M.pot, 0.1, 0.13, 28);
      pot.position.set(cx - 0.1, y0 + 0.085, z0 + d * 0.5);
      const pot2 = cylinder(M.pot, 0.08, 0.1, 28);
      pot2.position.set(cx + 0.13, y0 + 0.07, z0 + d * 0.45);
      g.add(pot, pot2);
    } else {
      for (let i = 0; i < 4; i++) g.add(boxAt(M.shelf, x0 + 0.04 + i * ((x1 - x0 - 0.08) / 4), y0 + 0.02, z0 + 0.04, 0.006, 0.05, d - 0.08, { cast: false }));
    }
  }

  /* ---------------------------------------------------------------- modules */
  function baseModule(runG: THREE.Group, runId: string, ms: ModuleSpec, s: number, offsetBase: number, mats = M.front, islandMode = false) {
    const id = ms.id || `${runId}-${out.modules.length}`;
    const mod: BuiltModule = { id, kind: ms.kind, category: islandMode ? 'island' : 'base', run: runId, group: new THREE.Group(), fronts: [], carcass: [], width: ms.width, start: s, key: KEY_BY_KIND[ms.kind] || 'drawers' };
    const g = mod.group;
    g.name = `module:${id}`;
    const w = ms.width;
    const x0 = s;
    const x1 = s + w;
    const carcass = boxAt(M.carcass, x0 + 0.001, DIM.plinth, 0, w - 0.002, DIM.baseTop - DIM.plinth, DIM.baseD, { cast: true });
    mod.carcass.push(carcass);
    g.add(carcass);
    g.add(boxAt(M.plinth, x0, 0, 0.03, w, DIM.plinth - 0.002, DIM.baseD - 0.09, { cast: false }));
    const top = channel ? DIM.baseTop - 0.035 : DIM.baseTop;
    const zb = DIM.baseD;
    const off = offsetBase;
    const interiors = !!spec.interiors;

    const drawers = (splits: number[]) => {
      const total = splits.reduce((a, b) => a + b, 0);
      let y = DIM.plinth;
      splits.forEach((fr, i) => {
        const h = ((top - DIM.plinth) * fr) / total;
        const dg = new THREE.Group();
        front(dg, mod, mats, x0, x1, y, y + h, zb, { drawer: true, offset: off - x0 });
        if (interiors) drawerBox(dg, x0, x1, y, h, i < splits.length - 1 && h > 0.2);
        g.add(dg);
        if (interiors) addMover(dg, 'slide', 0.42 - i * 0.03, mod);
        y += h;
      });
    };
    const doors = (y0: number, y1: number, tall = false, matD = mats) => {
      if (w > 0.62) {
        const xm = (x0 + x1) / 2;
        const l = new THREE.Group();
        const r = new THREE.Group();
        front(l, mod, matD, x0, xm, y0, y1, zb, { hingeLeft: false, tall, offset: off - x0 });
        front(r, mod, matD, xm, x1, y0, y1, zb, { hingeLeft: true, tall, offset: off - x0 });
        const pl = new THREE.Group();
        pl.position.set(x0, 0, zb);
        l.position.set(-x0, 0, -zb);
        pl.add(l);
        const pr = new THREE.Group();
        pr.position.set(x1, 0, zb);
        r.position.set(-x1, 0, -zb);
        pr.add(r);
        g.add(pl, pr);
        if (interiors) {
          addMover(pl, 'swing', -1.6, mod);
          addMover(pr, 'swing', 1.6, mod);
        }
      } else {
        const d = new THREE.Group();
        front(d, mod, matD, x0, x1, y0, y1, zb, { tall, offset: off - x0 });
        const p = new THREE.Group();
        p.position.set(x0, 0, zb);
        d.position.set(-x0, 0, -zb);
        p.add(d);
        g.add(p);
        if (interiors) addMover(p, 'swing', -1.6, mod);
      }
    };

    switch (ms.kind) {
      case 'drawers':
        drawers([0.38, 0.38, 0.24]);
        break;
      case 'drawers2':
      case 'hob':
        drawers([0.5, 0.5]);
        break;
      case 'dishwasher':
        front(g, mod, mats, x0, x1, DIM.plinth, top, zb, { drawer: true, offset: off - x0 });
        break;
      case 'filler':
        front(g, mod, mats, x0, x1, DIM.plinth, top, zb, { handle: false, frame: false, offset: off - x0 });
        break;
      case 'corner': {
        doors(DIM.plinth, top);
        if (interiors) {
          // swing-out corner shelves (pulled towards the user when opened)
          const sg = new THREE.Group();
          for (const y of [0.3, 0.58]) {
            const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.02, 32, 1, false, 0, Math.PI), M.shelf);
            shelf.position.set(x0 + w / 2, y, 0.3);
            shelf.rotation.y = Math.PI / 2;
            sg.add(shelf);
            const jar = cylinder(M.jar, 0.05, 0.14, 18);
            jar.position.set(x0 + w / 2 - 0.08, y + 0.08, 0.36);
            sg.add(jar);
          }
          g.add(sg);
          addMover(sg, 'slide', 0.36, mod, 'corner');
        }
        break;
      }
      case 'sink':
      case 'door':
      case 'appliance':
      default:
        doors(DIM.plinth, top);
        break;
    }
    if (interiors && ms.kind === 'sink') {
      // waste sorting bins behind the doors
      for (let i = 0; i < 2; i++) {
        const bin = boxAt(lib.plain('bin', { color: '#5f6b5a', roughness: 0.6 }), x0 + 0.08 + i * (w / 2 - 0.04), DIM.plinth + 0.03, 0.1, w / 2 - 0.12, 0.34, 0.38, { cast: false });
        g.add(bin);
      }
    }
    runG.add(g);
    out.modules.push(mod);
    out.hitTargets.push(g);
    return mod;
  }

  function tallModule(runG: THREE.Group, runId: string, ms: ModuleSpec, s: number, offsetBase: number) {
    const id = ms.id || `${runId}-${out.modules.length}`;
    const mod: BuiltModule = { id, kind: ms.kind, category: 'tall', run: runId, group: new THREE.Group(), fronts: [], carcass: [], width: ms.width, start: s, key: KEY_BY_KIND[ms.kind] || 'tall' };
    const g = mod.group;
    g.name = `module:${id}`;
    const w = ms.width;
    const x0 = s;
    const x1 = s + w;
    const zb = DIM.tallD;
    const carcass = boxAt(M.carcass, x0 + 0.001, DIM.plinth, 0, w - 0.002, DIM.tallTop - DIM.plinth, DIM.tallD);
    mod.carcass.push(carcass);
    g.add(carcass);
    g.add(boxAt(M.plinth, x0, 0, 0.03, w, DIM.plinth - 0.002, DIM.tallD - 0.09, { cast: false }));
    const off = offsetBase - x0;
    const fm = M.tall;
    if (ms.kind === 'fridge') {
      front(g, mod, fm, x0, x1, DIM.plinth, 1.68, zb, { tall: true, offset: off, frame: f.frame });
      front(g, mod, fm, x0, x1, 1.68, DIM.tallTop, zb, { offset: off, frame: f.frame });
    } else if (ms.kind === 'oven') {
      front(g, mod, fm, x0, x1, DIM.plinth, 0.5, zb, { drawer: true, offset: off });
      g.add(boxAt(M.glass, x0 + 0.004, 0.502, zb, w - 0.008, 0.59, 0.02, { bevel: 0.002 }));
      const bar = boxAt(M.steel, x0 + 0.06, 1.04, zb + 0.03, w - 0.12, 0.014, 0.014, { bevel: 0.003 });
      g.add(bar);
      g.add(boxAt(M.glass, x0 + 0.004, 1.096, zb, w - 0.008, 0.44, 0.02, { bevel: 0.002 }));
      g.add(boxAt(M.steel, x0 + 0.06, 1.49, zb + 0.03, w - 0.12, 0.014, 0.014, { bevel: 0.003 }));
      front(g, mod, fm, x0, x1, 1.54, DIM.tallTop, zb, { offset: off });
    } else {
      // pantry: full-height pull-out
      const pg = new THREE.Group();
      front(pg, mod, fm, x0, x1, DIM.plinth, DIM.tallTop, zb, { tall: true, offset: off, hingeLeft: true });
      if (spec.interiors) {
        for (let i = 0; i < 5; i++) {
          const y = 0.3 + i * 0.36;
          pg.add(boxAt(M.shelf, x0 + 0.03, y, 0.06, w - 0.06, 0.016, DIM.tallD - 0.1, { cast: false }));
          for (let k = 0; k < 3; k++) {
            const jar = cylinder(k % 2 ? M.plate : M.jar, 0.04, 0.12 + (k % 2) * 0.04, 16);
            jar.position.set(x0 + 0.1 + k * ((w - 0.2) / 2), y + 0.08, 0.15 + (k % 2) * 0.18);
            pg.add(jar);
          }
        }
      }
      g.add(pg);
      if (spec.interiors) addMover(pg, 'slide', 0.5, mod, 'pantry');
    }
    if (f.cornice) cornice(g, x0, x1, DIM.tallTop, DIM.tallD, offsetBase);
    runG.add(g);
    out.modules.push(mod);
    out.hitTargets.push(g);
    return mod;
  }

  function cornice(g: THREE.Group, x0: number, x1: number, y: number, depth: number, off: number) {
    g.add(boxAt(M.wall, x0, y, 0, x1 - x0, 0.03, depth + 0.02, { bevel: 0.004, offset: [off, y] }));
    g.add(boxAt(M.wall, x0, y + 0.03, 0, x1 - x0, 0.04, depth + 0.045, { bevel: 0.006, offset: [off, y] }));
  }

  function wallModule(runG: THREE.Group, runId: string, ws: WallSpec, offsetBase: number) {
    const id = ws.id || `${runId}-w${out.modules.length}`;
    const kind = ws.kind || 'wall';
    const mod: BuiltModule = { id, kind, category: 'wall', run: runId, group: new THREE.Group(), fronts: [], carcass: [], width: ws.width, start: ws.offset, key: kind === 'liftup' ? 'appliance' : 'clean' };
    const g = mod.group;
    g.name = `module:${id}`;
    const x0 = ws.offset;
    const x1 = ws.offset + ws.width;
    if (kind === 'open' || (!f.wallUnits && kind === 'wall')) {
      for (const y of [1.62, 1.98]) g.add(boxAt(M.shelf, x0, y, 0, ws.width, 0.035, 0.26, { bevel: 0.002, swap: true }));
      // dressing
      let x = x0 + 0.08;
      let i = 0;
      while (x < x1 - 0.14) {
        if (i % 3 === 0) {
          for (let k = 0; k < 4; k++) {
            const p = cylinder(M.plate, 0.1, 0.012, 32);
            p.position.set(x + 0.1, 1.662 + k * 0.013, 0.13);
            g.add(p);
          }
          x += 0.26;
        } else {
          const j = cylinder(M.jar, 0.05, 0.16, 20);
          j.position.set(x + 0.05, 1.655 + 0.08, 0.13);
          g.add(j);
          x += 0.16;
        }
        i++;
      }
      const led = boxAt(ledMat, x0 + 0.02, 1.612, 0.18, ws.width - 0.04, 0.006, 0.01, { cast: false, receive: false });
      out.leds.push(led);
      g.add(led);
    } else if (kind === 'hood' && !f.wallUnits) {
      const cx = (x0 + x1) / 2;
      g.add(boxAt(M.front, x0 + 0.01, 1.62, 0, ws.width - 0.02, 0.08, 0.5, { bevel: 0.003 }));
      g.add(boxAt(M.front, cx - 0.17, 1.7, 0, 0.34, (spec.ceiling ?? 2.7) - 1.7, 0.26, { bevel: 0.003 }));
    } else {
      const carcass = boxAt(M.carcass, x0 + 0.001, DIM.wallY0, 0, ws.width - 0.002, DIM.wallY1 - DIM.wallY0, DIM.wallD - 0.02);
      mod.carcass.push(carcass);
      g.add(carcass);
      const y0 = DIM.wallY0 - (channel ? 0.02 : 0);
      const zb = DIM.wallD - 0.02;
      if (kind === 'liftup') {
        const lg = new THREE.Group();
        front(lg, mod, M.wall, x0, x1, y0, DIM.wallY1, zb, { offset: offsetBase });
        const pivot = new THREE.Group();
        pivot.position.set(0, DIM.wallY1, zb);
        lg.position.set(0, -DIM.wallY1, -zb);
        pivot.add(lg);
        g.add(pivot);
        if (spec.interiors) {
          // coffee machine and toaster behind the lift-up door
          g.add(boxAt(M.glass, x0 + 0.08, DIM.wallY0 + 0.02, 0.05, 0.22, 0.3, 0.24));
          g.add(boxAt(M.steel, x0 + 0.36, DIM.wallY0 + 0.02, 0.06, 0.2, 0.16, 0.16, { bevel: 0.01 }));
          addMover(pivot, 'lift', -1.25, mod, 'appliance');
        }
      } else if (ws.width > 0.62) {
        const xm = (x0 + x1) / 2;
        front(g, mod, M.wall, x0, xm, y0, DIM.wallY1, zb, { hingeLeft: false, offset: offsetBase });
        front(g, mod, M.wall, xm, x1, y0, DIM.wallY1, zb, { hingeLeft: true, offset: offsetBase });
      } else {
        front(g, mod, M.wall, x0, x1, y0, DIM.wallY1, zb, { offset: offsetBase });
      }
      const led = boxAt(ledMat, x0 + 0.01, DIM.wallY0 - 0.008, zb - 0.05, ws.width - 0.02, 0.006, 0.012, { cast: false, receive: false });
      out.leds.push(led);
      g.add(led);
      if (f.cornice) cornice(g, x0, x1, DIM.wallY1, DIM.wallD, offsetBase);
    }
    runG.add(g);
    out.modules.push(mod);
    out.hitTargets.push(g);
  }

  /* ---------------------------------------------------------------- appliances on top */
  function sinkTop(runG: THREE.Group, s: number, w: number) {
    const cx = s + w / 2;
    const bw = Math.min(0.72, w - 0.1);
    const rim = boxAt(lib.plain('sinkRim', { color: '#8E9295', roughness: 0.35, metalness: 0.85 }), cx - bw / 2 - 0.01, DIM.counter, 0.11 - 0.01, bw + 0.02, 0.002, 0.44, { cast: false });
    const basin = boxAt(lib.plain('sinkBasin', { color: '#3B3E40', roughness: 0.45, metalness: 0.6 }), cx - bw / 2, DIM.counter + 0.0005, 0.11, bw, 0.002, 0.42, { cast: false });
    runG.add(rim, basin);
    const tap = new THREE.Group();
    const post = cylinder(M.handle, 0.014, 0.32, 18);
    post.position.set(0, 0.16, 0);
    const spout = cylinder(M.handle, 0.012, 0.2, 18);
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0, 0.32, 0.1);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.0142, 16, 12), M.handle);
    joint.position.set(0, 0.32, 0);
    const tip = cylinder(M.handle, 0.012, 0.04, 16);
    tip.position.set(0, 0.3, 0.2);
    tap.add(post, spout, joint, tip);
    tap.position.set(cx, DIM.counter, 0.06);
    runG.add(tap);
    return new THREE.Vector3(cx, 0, 0.32);
  }

  function hobTop(runG: THREE.Group, s: number, w: number) {
    const cx = s + w / 2;
    const hw = Math.min(0.78, w - 0.08);
    runG.add(boxAt(M.glass, cx - hw / 2, DIM.counter, 0.07, hw, 0.006, 0.51, { bevel: 0.002, cast: false }));
    const ringGeo = new THREE.TorusGeometry(1, 0.02, 6, 48);
    for (const [dx, dz, r] of [
      [-0.19, 0.2, 0.09],
      [0.19, 0.2, 0.075],
      [-0.19, 0.44, 0.075],
      [0.19, 0.44, 0.1],
    ] as const) {
      if (Math.abs(dx) > hw / 2 - 0.06) continue;
      const ring = new THREE.Mesh(ringGeo, M.ring);
      ring.scale.set(r, r, 0.0018 / 0.02);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(cx + dx, DIM.counter + 0.0063, dz);
      runG.add(ring);
    }
    return new THREE.Vector3(cx, 0, 0.3);
  }

  /* ---------------------------------------------------------------- runs */
  for (const run of spec.runs) {
    const rg = new THREE.Group();
    rg.name = `run:${run.id}`;
    rg.position.set(run.x, 0, run.z);
    rg.rotation.y = run.rot;
    root.add(rg);
    rg.updateMatrixWorld(true);
    out.runs[run.id] = rg;

    let s = 0;
    const baseSpans: [number, number][] = [];
    const sinkAt: number[] = [];
    const hobAt: number[] = [];
    for (const ms of run.base) {
      if (ms.kind === 'fridge' || ms.kind === 'oven' || ms.kind === 'pantry') {
        tallModule(rg, run.id, ms, s, s);
      } else {
        baseModule(rg, run.id, ms, s, s);
        baseSpans.push([s, s + ms.width]);
        if (ms.kind === 'sink') sinkAt.push(s);
        if (ms.kind === 'hob') hobAt.push(s);
      }
      s += ms.width;
    }
    // merge contiguous base spans into counter groups
    const groups: [number, number][] = [];
    for (const [a, b] of baseSpans) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last[1] - a) < 1e-6) last[1] = b;
      else groups.push([a, b]);
    }
    const counters = run.counter === false ? [] : run.counter ?? groups.map(([from, to]) => ({ from, to }));
    for (const c of counters) {
      const ct = boxAt(M.counter, c.from, DIM.baseTop, 0, c.to - c.from, DIM.ct, 0.62, { bevel: 0.002, swap: false });
      ct.name = 'counter';
      rg.add(ct);
      out.counters.push(ct);
      if (channel) {
        const ch = boxAt(M.handle, c.from, DIM.baseTop - 0.035, DIM.baseD - 0.03, c.to - c.from, 0.035, 0.025, { cast: false, name: 'channel' });
        rg.add(ch);
        out.channels.push(ch);
      }
    }
    const splashes = run.splash === false ? [] : run.splash ?? counters.map((c) => ({ from: c.from, to: c.to, height: undefined as number | undefined }));
    for (const sp of splashes) {
      const h = sp.height ?? DIM.wallY0 - DIM.counter;
      const m = boxAt(M.splash, sp.from, DIM.counter, 0, sp.to - sp.from, h, 0.012, { cast: false });
      m.name = 'splash';
      rg.add(m);
      out.splashes.push(m);
    }
    for (const at of sinkAt) {
      const ms = run.base.find((_, i) => run.base.slice(0, i).reduce((a, b) => a + b.width, 0) === at);
      const p = sinkTop(rg, at, ms?.width ?? 0.8);
      out.points.sink = rg.localToWorld(p.clone());
    }
    for (const at of hobAt) {
      const ms = run.base.find((_, i) => run.base.slice(0, i).reduce((a, b) => a + b.width, 0) === at);
      const p = hobTop(rg, at, ms?.width ?? 0.9);
      out.points.hob = rg.localToWorld(p.clone());
    }
    for (const ws of run.wall ?? []) wallModule(rg, run.id, ws, 0);
    const fr = out.modules.find((m) => m.run === run.id && m.kind === 'fridge');
    if (fr) out.points.fridge = rg.localToWorld(new THREE.Vector3(fr.start + fr.width / 2, 0, DIM.tallD + 0.1));
  }

  /* ---------------------------------------------------------------- island */
  if (spec.island) {
    const isl = spec.island;
    const L = isl.length;
    const depth = isl.depth ?? 1.0;
    const ig = new THREE.Group();
    ig.name = 'island';
    // place so the top is centred on (cx, cz): local top z spans [-(depth-0.6), 0.6]
    const zCenterLocal = (0.6 - (depth - 0.6)) / 2;
    ig.position.set(isl.cx + L / 2, 0, isl.cz + zCenterLocal);
    ig.rotation.y = Math.PI;
    root.add(ig);
    const mods = isl.modules ?? splitIsland(L);
    let s = 0;
    const body: THREE.Object3D[] = [];
    for (const ms of mods) {
      const mod = baseModule(ig, 'island', ms, s, s, M.island, true);
      body.push(mod.group);
      s += ms.width;
    }
    if (channel) {
      const ch = boxAt(M.handle, 0, DIM.baseTop - 0.035, DIM.baseD - 0.03, L, 0.035, 0.025, { cast: false });
      ig.add(ch);
      body.push(ch);
    }
    const back = new THREE.Group();
    back.add(boxAt(M.carcass, 0, DIM.plinth, -0.1, L, DIM.baseTop - DIM.plinth, 0.1));
    // seating-side panels (mirrored frame so fronts face the user)
    const mirror = new THREE.Group();
    mirror.position.set(L, 0, 0);
    mirror.rotation.y = Math.PI;
    const n = f.fluted ? 1 : 4;
    const fake: BuiltModule = { id: 'island-back', kind: 'island', category: 'island', run: 'island', group: back, fronts: [], carcass: [], width: L, start: 0, key: 'flexibility' };
    for (let i = 0; i < n; i++) front(mirror, fake, M.island, (i * L) / n, ((i + 1) * L) / n, DIM.plinth, DIM.baseTop, 0.1, { handle: false });
    back.add(mirror);
    back.add(boxAt(M.plinth, 0, 0, -0.06, L, DIM.plinth - 0.002, 0.06, { cast: false }));
    ig.add(back);
    body.push(back);
    for (const xe of [-0.02, L]) {
      const end = boxAt(M.islandPanel, xe, 0, -(depth - 0.6), 0.02, DIM.baseTop, depth, { bevel: 0.0015 });
      ig.add(end);
      body.push(end);
    }
    const top = boxAt(M.counter, -0.02, DIM.baseTop, -(depth - 0.6), L + 0.04, DIM.ct, depth, { bevel: 0.002 });
    top.name = 'islandTop';
    ig.add(top);
    out.counters.push(top);
    out.island = { group: ig, top, body };
    // pendants
    const count = isl.pendants ?? 3;
    const ceiling = spec.ceiling ?? 2.7;
    for (let i = 0; i < count; i++) {
      const p = pendant(lib, f, ceiling, pendantGlow);
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      p.position.set(isl.cx + t * Math.min(L - 0.6, 1.6), 0, isl.cz);
      root.add(p);
      out.pendants.push(p);
    }
  }

  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && m.receiveShadow === undefined) m.receiveShadow = true;
  });
  return out;
}

function splitIsland(L: number): ModuleSpec[] {
  const n = Math.max(1, Math.round(L / 0.9));
  const w = L / n;
  return Array.from({ length: n }, () => ({ kind: 'drawers' as const, width: w }));
}

/** Pendant light: style follows the collection (cylinder, dome, slim tube, globe). */
export function pendant(lib: MaterialLibrary, f: Finish, ceiling: number, glow: THREE.MeshStandardMaterial): THREE.Group {
  const g = new THREE.Group();
  g.name = 'pendant';
  const cordMat = lib.plain('cord', { color: '#1d1c1b', roughness: 0.6 });
  const bottom = 1.65;
  let shadeH = 0.26;
  const style = f.handle === 'knob' && f.frame ? 'dome' : f.handle === 'edge' ? 'slim' : f.fluted ? 'globe' : 'cylinder';
  const metal = lib.get(f.handleMetal);
  if (style === 'dome') {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.19, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), metal);
    dome.scale.set(1, 0.8, 1);
    dome.position.y = bottom;
    dome.material.side = THREE.DoubleSide;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), glow);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = bottom + 0.05;
    g.add(dome, disc);
    shadeH = 0.15;
  } else if (style === 'slim') {
    shadeH = 0.42;
    const tube = cylinder(metal, 0.035, shadeH, 28);
    tube.position.y = bottom + shadeH / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.03, 20), glow);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = bottom - 0.001;
    g.add(tube, disc);
  } else if (style === 'globe') {
    shadeH = 0.38;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.19, 40, 24), glow);
    globe.position.y = bottom + 0.19;
    g.add(globe);
  } else {
    const light = new THREE.Color(f.front.color).getHSL({ h: 0, s: 0, l: 0 }).l > 0.75;
    const shade = cylinder(lib.plain(`shade:${light ? 'bone' : 'graphite'}`, { color: light ? '#EFEBE4' : '#1C1C1C', roughness: 0.5 }), 0.09, shadeH, 36);
    shade.position.y = bottom + shadeH / 2;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.084, 32), glow);
    disc.rotation.x = Math.PI / 2;
    disc.position.y = bottom - 0.001;
    g.add(shade, disc);
  }
  const cordLen = ceiling - (bottom + shadeH);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.002, 0.002, cordLen, 6), cordMat);
  cord.position.y = bottom + shadeH + cordLen / 2;
  g.add(cord);
  return g;
}

/** Room shell: floor, back and side walls (cut away towards the viewer). */
export function buildRoom(
  lib: MaterialLibrary,
  o: { width: number; depth: number; height: number; wallColor: string; floor?: 'planks' | 'tiles'; left?: boolean; right?: boolean; window?: { wall: 'back' | 'left' | 'right'; a0: number; a1: number; y0: number; y1: number } },
) {
  const g = new THREE.Group();
  g.name = 'room';
  const wallMat = lib.wall(o.wallColor);
  const floorMat = o.floor === 'tiles' ? lib.floorTiles() : lib.floorPlanks();
  const floor = new THREE.Mesh(boxGeo(o.width + 2, 0.05, o.depth + 2, 0, [0, 0]), floorMat);
  floor.position.set(0, -0.025, o.depth / 2);
  floor.receiveShadow = true;
  g.add(floor);
  const T = 0.12;
  const wall = (x0: number, x1: number, y0: number, y1: number) => {
    const m = boxAt(wallMat, x0, y0, -T, x1 - x0, y1 - y0, T, { cast: false });
    g.add(m);
  };
  const W2 = o.width / 2;
  if (o.window?.wall === 'back') {
    const w = o.window;
    wall(-W2 - T, w.a0, 0, o.height);
    wall(w.a1, W2 + T, 0, o.height);
    wall(w.a0, w.a1, 0, w.y0);
    wall(w.a0, w.a1, w.y1, o.height);
  } else {
    wall(-W2 - T, W2 + T, 0, o.height);
  }
  if (o.left !== false) {
    const m = boxAt(wallMat, -W2 - T, 0, 0, T, o.height, o.depth, { cast: false });
    g.add(m);
  }
  if (o.right) {
    const m = boxAt(wallMat, W2, 0, 0, T, o.height, o.depth, { cast: false });
    g.add(m);
  }
  return { group: g, wallMat, floorMat };
}
