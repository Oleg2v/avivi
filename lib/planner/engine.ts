/**
 * Kitchen planner engine (pure, deterministic, units in centimetres).
 *
 * Room convention (seen from the entrance, facing the back wall):
 *   x: 0 at the left wall .. W at the right wall; z: 0 at the back wall .. D at the entrance wall.
 * Opening offsets: back and front walls from the left corner; side walls from the back corner.
 *
 * The engine places SMART KITCHEN modules for five shapes, respecting windows (no wall or
 * tall units in front of glass, the sink goes under a window when possible) and doors
 * (nothing in front of a door, with 10 cm clearance), then computes counter length,
 * storage volume, the work triangle and an example price range.
 */
import type { CollectionId } from '@/lib/data/collections';

export type Shape = 'straight' | 'L' | 'U' | 'galley' | 'island';
export type WallId = 'back' | 'left' | 'right' | 'front';
export type ModKind = 'drawers' | 'sink' | 'hob' | 'dishwasher' | 'corner' | 'fridge' | 'oven' | 'pantry' | 'filler';

export interface Opening {
  id: string;
  type: 'window' | 'door';
  wall: WallId;
  offset: number;
  width: number;
}

export interface PlannerState {
  shape: Shape;
  width: number;
  depth: number;
  height: number;
  collection: CollectionId;
  openings: Opening[];
}

export interface PlacedModule {
  kind: ModKind;
  start: number; // along the run, cm
  width: number;
}

export interface PlacedWall {
  start: number;
  width: number;
  kind: 'wall' | 'hood' | 'open';
}

export interface Run {
  id: string;
  wall: WallId | 'island';
  /** origin in room coordinates (cm) and direction of the run along the floor. */
  origin: { x: number; z: number };
  dir: { x: number; z: number };
  /** unit vector pointing from the wall into the room (the fronts' facing). */
  normal: { x: number; z: number };
  length: number;
  modules: PlacedModule[];
  uppers: PlacedWall[];
  counter: { from: number; to: number }[];
}

export interface Triangle {
  sink: { x: number; z: number };
  hob: { x: number; z: number };
  fridge: { x: number; z: number };
  legs: [number, number, number];
  total: number;
  ok: boolean;
}

export interface Layout {
  state: PlannerState;
  shapeUsed: Shape;
  runs: Run[];
  island?: { cx: number; cz: number; length: number; depth: number; modules: PlacedModule[] };
  warnings: { key: 'galleyNarrow' | 'islandSmall' | 'doorBlock' | 'tooSmall'; min?: number }[];
  counterLength: number; // cm
  storage: number; // litres
  triangle: Triangle | null;
  price: { low: number; high: number };
  moduleCount: number;
}

export const LIMITS = { width: [180, 900], depth: [180, 900], height: [220, 320] } as const;
const BASE_D = 60;
const DOOR_CLEAR = 10;
const ENTRY_CLEAR = 90;
const MIN_AISLE = 100;

export const DEFAULT_STATE: PlannerState = {
  shape: 'L',
  width: 400,
  depth: 380,
  height: 270,
  collection: 'modern',
  openings: [
    { id: 'w1', type: 'window', wall: 'back', offset: 140, width: 120 },
    { id: 'd1', type: 'door', wall: 'front', offset: 270, width: 90 },
  ],
};

/* --------------------------------------------------------------------------- helpers */
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function wallLength(state: PlannerState, wall: WallId) {
  return wall === 'back' || wall === 'front' ? state.width : state.depth;
}

/** Spans [a,b] along a wall blocked by doors (with clearance). */
function doorSpans(state: PlannerState, wall: WallId): [number, number][] {
  return state.openings.filter((o) => o.type === 'door' && o.wall === wall).map((o) => [o.offset - DOOR_CLEAR, o.offset + o.width + DOOR_CLEAR]);
}

function windowSpans(state: PlannerState, wall: WallId): [number, number][] {
  return state.openings.filter((o) => o.type === 'window' && o.wall === wall).map((o) => [o.offset - 5, o.offset + o.width + 5]);
}

/** Subtract blocked spans from [a,b] → free segments (each at least min long). */
function freeSegments(a: number, b: number, blocked: [number, number][], min = 30): [number, number][] {
  let segs: [number, number][] = [[a, b]];
  for (const [x0, x1] of blocked) {
    const next: [number, number][] = [];
    for (const [s0, s1] of segs) {
      if (x1 <= s0 || x0 >= s1) next.push([s0, s1]);
      else {
        if (x0 > s0) next.push([s0, x0]);
        if (x1 < s1) next.push([x1, s1]);
      }
    }
    segs = next;
  }
  return segs.filter(([s0, s1]) => s1 - s0 >= min);
}

const WIDTHS = [120, 100, 90, 80, 60, 45, 40, 30];

/** Fill a length with standard drawer widths; leftover (< 30 cm) becomes a filler. */
function fill(len: number): number[] {
  const out: number[] = [];
  let rest = Math.round(len);
  // prefer 60/80/90 for a calm rhythm, use 120/100 only for long stretches
  while (rest >= 30) {
    let w = WIDTHS.find((x) => x <= rest && (rest - x === 0 || rest - x >= 30 || rest - x < 10)) ?? 30;
    if (w > 90 && rest < 240) w = WIDTHS.find((x) => x <= 90 && x <= rest) ?? w;
    out.push(w);
    rest -= w;
  }
  if (rest >= 15) {
    const narrow = Math.floor(rest / 5) * 5; // narrow pull-out (spices, trays)
    out.push(narrow);
    rest -= narrow;
  }
  if (rest > 0) out.push(-rest); // negative = filler
  return out;
}

function overlaps(a0: number, a1: number, b0: number, b1: number) {
  return a0 < b1 && b0 < a1;
}

/* --------------------------------------------------------------------------- runs */
interface RunPlan {
  id: string;
  wall: WallId;
  from: number;
  to: number;
  cornerAtStart?: boolean;
  cornerAtEnd?: boolean;
}

function runGeometry(state: PlannerState, wall: WallId, from: number) {
  const W = state.width;
  const D = state.depth;
  switch (wall) {
    case 'back':
      return { origin: { x: from, z: 0 }, dir: { x: 1, z: 0 }, normal: { x: 0, z: 1 } };
    case 'left':
      return { origin: { x: 0, z: from }, dir: { x: 0, z: 1 }, normal: { x: 1, z: 0 } };
    case 'right':
      return { origin: { x: W, z: from }, dir: { x: 0, z: 1 }, normal: { x: -1, z: 0 } };
    case 'front':
    default:
      return { origin: { x: from, z: D }, dir: { x: 1, z: 0 }, normal: { x: 0, z: -1 } };
  }
}

/** Point in room coordinates for a position along a run, at depth d from the wall. */
export function runPoint(run: Run, s: number, d: number) {
  return { x: run.origin.x + run.dir.x * s + run.normal.x * d, z: run.origin.z + run.dir.z * s + run.normal.z * d };
}

/* --------------------------------------------------------------------------- main */
export function computeLayout(input: PlannerState): Layout {
  const state: PlannerState = {
    ...input,
    width: clamp(Math.round(input.width), LIMITS.width[0], LIMITS.width[1]),
    depth: clamp(Math.round(input.depth), LIMITS.depth[0], LIMITS.depth[1]),
    height: clamp(Math.round(input.height), LIMITS.height[0], LIMITS.height[1]),
    openings: input.openings.map((o) => ({ ...o, offset: Math.max(0, Math.round(o.offset)), width: clamp(Math.round(o.width), 40, 400) })),
  };
  const W = state.width;
  const D = state.depth;
  const warnings: Layout['warnings'] = [];
  let shape = state.shape;

  if (W < 200 && D < 200) warnings.push({ key: 'tooSmall' });
  const galleyMin = BASE_D * 2 + MIN_AISLE;
  if (shape === 'galley' && W < galleyMin) {
    warnings.push({ key: 'galleyNarrow', min: galleyMin });
    shape = 'straight';
  }
  if (shape === 'U' && W < galleyMin + 30) {
    warnings.push({ key: 'galleyNarrow', min: galleyMin + 30 });
    shape = 'L';
  }
  const islandMin = BASE_D + 110 + 90 + 90;
  if (shape === 'island' && (D < islandMin || W < 300)) {
    warnings.push({ key: 'islandSmall', min: islandMin });
    shape = 'straight';
  }

  // Which walls carry runs
  const sideEnd = Math.max(BASE_D + 60, D - ENTRY_CLEAR);
  const plans: RunPlan[] = [];
  if (shape === 'galley') {
    // A door on the entrance wall close to a side keeps that run short of the corner.
    const front = doorSpans(state, 'front');
    const nearLeft = front.some(([a]) => a < BASE_D + 10);
    const nearRight = front.some(([, b]) => b > W - BASE_D - 10);
    plans.push({ id: 'left', wall: 'left', from: 0, to: D - (nearLeft ? 70 : 0) });
    plans.push({ id: 'right', wall: 'right', from: 0, to: D - (nearRight ? 70 : 0) });
  } else {
    plans.push({ id: 'back', wall: 'back', from: 0, to: W, cornerAtStart: shape === 'L' || shape === 'U', cornerAtEnd: shape === 'U' });
    if (shape === 'L' || shape === 'U') plans.push({ id: 'left', wall: 'left', from: BASE_D, to: Math.min(sideEnd, BASE_D + 330) });
    if (shape === 'U') plans.push({ id: 'right', wall: 'right', from: BASE_D, to: Math.min(sideEnd, BASE_D + 330) });
  }

  // Free segments per run (doors carve them up)
  const runs: Run[] = [];
  let blockedByDoor = false;
  for (const p of plans) {
    const doors = doorSpans(state, p.wall);
    // side runs also stop before doors on the front wall that sit in their corner
    const segs = freeSegments(p.from, p.to, doors, 30);
    const total = segs.reduce((a, [s0, s1]) => a + (s1 - s0), 0);
    if (total < (p.to - p.from) * 0.6 && doors.length) blockedByDoor = true;
    const g = runGeometry(state, p.wall, 0);
    runs.push({ id: p.id, wall: p.wall, origin: g.origin, dir: g.dir, normal: g.normal, length: wallLength(state, p.wall), modules: [], uppers: [], counter: [], _segs: segs, _plan: p } as unknown as Run & { _segs: [number, number][]; _plan: RunPlan });
  }
  if (blockedByDoor) warnings.push({ key: 'doorBlock' });

  type R = Run & { _segs: [number, number][]; _plan: RunPlan };
  const R = runs as R[];
  const main = R[0];

  // --- fixed placements ---------------------------------------------------
  const reserved: { run: R; kind: ModKind; start: number; width: number }[] = [];
  const isFree = (run: R, a: number, b: number) => run._segs.some(([s0, s1]) => a >= s0 - 0.01 && b <= s1 + 0.01) && !reserved.some((x) => x.run === run && overlaps(a, b, x.start, x.start + x.width));
  const reserve = (run: R, kind: ModKind, start: number, width: number) => {
    if (!isFree(run, start, start + width)) return false;
    reserved.push({ run, kind, start, width });
    return true;
  };

  // corners (blind corner unit, 90 wide, on the back run)
  if (main._plan.cornerAtStart) reserve(main, 'corner', 0, 90);
  if (main._plan.cornerAtEnd) reserve(main, 'corner', W - 90, 90);

  // tall units: fridge (+ oven column if room). L: far end of the back run (the hob goes on
  // the side run, which spreads the work triangle); U: end of the left run; galley: right run.
  const leftRun = R.find((r) => r.id === 'left');
  const leftUsable = leftRun ? leftRun._plan.to - leftRun._plan.from : 0;
  const tallRun = shape === 'U' || (shape === 'L' && leftUsable >= 200) ? leftRun! : shape === 'galley' ? R.find((r) => r.id === 'right')! : main;
  const tallSegs = tallRun._segs;
  const hasWindowOn = (run: R, a: number, b: number) => windowSpans(state, run.wall as WallId).some(([w0, w1]) => overlaps(a, b, w0, w1));
  let fridgeAt: { run: R; start: number } | null = null;
  {
    const first = tallSegs[0];
    const last = tallSegs[tallSegs.length - 1];
    const startCand = first ? first[0] + (tallRun === main && main._plan.cornerAtStart ? 90 : 0) : -1;
    const endCand = last ? last[1] - 60 - (tallRun === main && main._plan.cornerAtEnd ? 90 : 0) : -1;
    const wins = windowSpans(state, tallRun.wall as WallId);
    const winMid = wins.length ? (wins[0][0] + wins[0][1]) / 2 : tallRun.length * 0.35;
    let candidates: number[];
    if (shape === 'L' && tallRun === main) candidates = [endCand, startCand];
    else if (tallRun === main) candidates = Math.abs(startCand - winMid) >= Math.abs(endCand - winMid) ? [startCand, endCand] : [endCand, startCand];
    else candidates = [endCand, startCand];
    for (const c of candidates) {
      if (c >= 0 && !hasWindowOn(tallRun, c, c + 60) && reserve(tallRun, 'fridge', c, 60)) {
        fridgeAt = { run: tallRun, start: c };
        break;
      }
    }
    // fallback: the end of any other run
    if (!fridgeAt) {
      for (const run of R) {
        if (run === tallRun) continue;
        const segs = run._segs;
        const ends = segs.length ? [segs[segs.length - 1][1] - 60, segs[0][0]] : [];
        for (const c of ends) {
          if (c >= 0 && !hasWindowOn(run, c, c + 60) && reserve(run, 'fridge', c, 60)) {
            fridgeAt = { run, start: c };
            break;
          }
        }
        if (fridgeAt) break;
      }
    }
    const usable = (run: R) => run._plan.to - run._plan.from;
    if (fridgeAt && usable(tallRun) >= (tallRun === main ? 420 : 300)) {
      const towardsInside = fridgeAt.start > tallRun.length / 2 ? fridgeAt.start - 60 : fridgeAt.start + 60;
      if (!hasWindowOn(tallRun, towardsInside, towardsInside + 60)) reserve(tallRun, 'oven', towardsInside, 60);
    }
  }

  /** Snap a start position so the stretch before it fills with standard widths (15 cm grid). */
  const snap = (run: R, st: number) => {
    const seg = run._segs.find(([a, b]) => st >= a - 1 && st <= b + 1);
    if (!seg) return st;
    const prior = reserved
      .filter((x) => x.run === run && x.start + x.width <= st + 0.5 && x.start + x.width >= seg[0])
      .reduce((m, x) => Math.max(m, x.start + x.width), seg[0]);
    const gap = st - prior;
    if (gap < 15) return prior;
    return prior + Math.round(gap / 15) * 15;
  };

  // sink: under a window on a run, otherwise a third of the way along the main run
  let sinkAt: { run: R; start: number; width: number } | null = null;
  for (const run of R) {
    for (const [w0, w1] of windowSpans(state, run.wall as WallId)) {
      const c = (w0 + w1) / 2;
      for (const sw of [80, 60]) {
        const st = snap(run, Math.round(c - sw / 2));
        if (reserve(run, 'sink', st, sw)) {
          sinkAt = { run, start: st, width: sw };
          break;
        }
      }
      if (sinkAt) break;
    }
    if (sinkAt) break;
  }
  if (!sinkAt) {
    for (const [s0, s1] of main._segs) {
      for (let st = Math.round(s0 + (s1 - s0) * 0.35); st + 60 <= s1; st += 10) {
        const sw = st + 80 <= s1 ? 80 : 60;
        if (reserve(main, 'sink', st, sw)) {
          sinkAt = { run: main, start: st, width: sw };
          break;
        }
      }
      if (sinkAt) break;
    }
  }
  // dishwasher next to the sink
  if (sinkAt) {
    const { run, start, width } = sinkAt;
    if (!reserve(run, 'dishwasher', start + width, 60)) reserve(run, 'dishwasher', start - 60, 60);
  }
  // hob: prefer another run (L/U/galley), not under a window, away from the sink and tall units
  let hobAt: { run: R; start: number; width: number } | null = null;
  const placeHob = (sinkGap: number) => {
    const weight = (r: R) => (r === sinkAt?.run ? 2 : 0) + (r === fridgeAt?.run ? 1 : 0);
    const hobRuns = [...R].sort((a, b) => weight(a) - weight(b));
    for (const run of hobRuns) {
      for (const hw of [90, 60]) {
        for (const [s0, s1] of run._segs) {
          const mid = (s0 + s1) / 2;
          let order: number[] = [];
          for (let d = 0; d <= (s1 - s0) / 2; d += 10) order.push(mid - hw / 2 + d, mid - hw / 2 - d);
          if (fridgeAt && run === fridgeAt.run) {
            // on the fridge's run, keep the hob as far from the fridge as the run allows
            const fc = fridgeAt.start + 30;
            order = [];
            for (let st = s0; st + hw <= s1; st += 5) order.push(st);
            order.sort((a, b) => Math.abs(b + hw / 2 - fc) - Math.abs(a + hw / 2 - fc));
          }
          for (const st0 of order) {
            const st = snap(run, Math.round(st0 / 5) * 5);
            if (st < s0 || st + hw > s1) continue;
            if (hasWindowOn(run, st, st + hw)) continue;
            if (sinkAt && run === sinkAt.run && overlaps(st - sinkGap, st + hw + sinkGap, sinkAt.start, sinkAt.start + sinkAt.width)) continue;
            if (reserved.some((x) => x.run === run && (x.kind === 'fridge' || x.kind === 'oven') && overlaps(st - 30, st + hw + 30, x.start, x.start + x.width))) continue;
            if (reserve(run, 'hob', st, hw)) {
              hobAt = { run, start: st, width: hw };
              return true;
            }
          }
        }
      }
    }
    return false;
  };
  if (!placeHob(40) && sinkAt) {
    const dwIdx = reserved.findIndex((x) => x.kind === 'dishwasher');
    if (dwIdx >= 0) {
      const dw = reserved.splice(dwIdx, 1)[0];
      const other = dw.start > sinkAt.start ? sinkAt.start - 60 : sinkAt.start + sinkAt.width;
      if (!reserve(sinkAt.run, 'dishwasher', other, 60)) reserved.push(dw);
    }
    if (!placeHob(40)) placeHob(20);
  }
  // pull-out pantry beside the fridge when space allows
  if (fridgeAt) {
    const run = fridgeAt.run;
    const left = fridgeAt.start - 45;
    const right = fridgeAt.start + 60;
    const oven = reserved.find((x) => x.run === run && x.kind === 'oven');
    const alt = oven ? (oven.start < fridgeAt.start ? oven.start - 45 : oven.start + 60) : null;
    for (const st of [alt, right, left].filter((v): v is number => v !== null)) {
      if (!hasWindowOn(run, st, st + 45) && run._plan.to - run._plan.from >= (run === main ? 480 : 330) && reserve(run, 'pantry', st, 45)) break;
    }
  }

  // --- fill every run -----------------------------------------------------
  for (const run of R) {
    const fixed = reserved.filter((x) => x.run === run).sort((a, b) => a.start - b.start);
    const mods: PlacedModule[] = [];
    for (const [s0, s1] of run._segs) {
      let cursor = s0;
      const inSeg = fixed.filter((x) => x.start >= s0 - 0.01 && x.start + x.width <= s1 + 0.01);
      for (const f of [...inSeg, null]) {
        const end = f ? f.start : s1;
        if (end - cursor > 0.5) {
          let pos = cursor;
          for (const w of fill(end - cursor)) {
            mods.push({ kind: w < 0 ? 'filler' : 'drawers', start: pos, width: Math.abs(w) });
            pos += Math.abs(w);
          }
        }
        if (f) {
          mods.push({ kind: f.kind, start: f.start, width: f.width });
          cursor = f.start + f.width;
        }
      }
    }
    mods.sort((a, b) => a.start - b.start);
    run.modules = mods;
    // counters over contiguous base modules (tall units break them)
    const counter: { from: number; to: number }[] = [];
    for (const m of mods) {
      if (m.kind === 'fridge' || m.kind === 'oven' || m.kind === 'pantry') continue;
      const last = counter[counter.length - 1];
      if (last && Math.abs(last.to - m.start) < 0.5) last.to = m.start + m.width;
      else counter.push({ from: m.start, to: m.start + m.width });
    }
    run.counter = counter;
    // wall units: above base modules, not over windows or doors, hood above the hob
    const wins = windowSpans(state, run.wall as WallId);
    const walls: PlacedWall[] = [];
    for (const m of mods) {
      if (m.kind === 'fridge' || m.kind === 'oven' || m.kind === 'pantry' || m.kind === 'filler') continue;
      if (wins.some(([w0, w1]) => overlaps(m.start, m.start + m.width, w0, w1))) continue;
      if (m.kind === 'corner') {
        walls.push({ start: m.start, width: m.width, kind: 'wall' });
        continue;
      }
      walls.push({ start: m.start, width: m.width, kind: m.kind === 'hob' ? 'hood' : 'wall' });
    }
    run.uppers = walls;
    delete (run as Partial<R>)._segs;
    delete (run as Partial<R>)._plan;
  }

  // --- island ---------------------------------------------------------------
  let island: Layout['island'];
  if (shape === 'island') {
    const length = clamp(Math.floor((W - 2 * 90) / 10) * 10, 120, 300);
    const depth = 100;
    const cz = BASE_D + 110 + depth / 2;
    const mods: PlacedModule[] = [];
    let pos = 0;
    for (const w of fill(length)) {
      mods.push({ kind: w < 0 ? 'filler' : 'drawers', start: pos, width: Math.abs(w) });
      pos += Math.abs(w);
    }
    island = { cx: W / 2, cz, length, depth, modules: mods };
  }

  // --- metrics ---------------------------------------------------------------
  const counterLength = runs.reduce((a, r) => a + r.counter.reduce((b, c) => b + (c.to - c.from), 0), 0) + (island?.length ?? 0);
  const H_BASE = 70;
  const volume = (m: PlacedModule) => {
    const inner = Math.max(0, m.width - 3.6);
    switch (m.kind) {
      case 'drawers':
        return (inner * 52 * H_BASE * 0.88) / 1000;
      case 'hob':
        return (inner * 48 * H_BASE * 0.8) / 1000;
      case 'sink':
        return (inner * 52 * H_BASE * 0.45) / 1000;
      case 'corner':
        return (Math.max(0, 90 - 3.6) * 52 * H_BASE * 0.72) / 1000;
      case 'fridge':
        return (inner * 55 * 42) / 1000;
      case 'oven':
        return (inner * 55 * 95 * 0.85) / 1000;
      case 'pantry':
        return (inner * 55 * 200 * 0.85) / 1000;
      default:
        return 0;
    }
  };
  let storage = 0;
  for (const r of runs) {
    for (const m of r.modules) storage += volume(m);
    for (const w of r.uppers) if (w.kind === 'wall') storage += (Math.max(0, w.width - 3.6) * 32 * 72) / 1000;
  }
  if (island) for (const m of island.modules) storage += volume(m);

  // work triangle (front-edge centres)
  let triangle: Triangle | null = null;
  const pointOf = (kind: ModKind) => {
    for (const r of runs) {
      const m = r.modules.find((x) => x.kind === kind);
      if (m) return runPoint(r, m.start + m.width / 2, kind === 'fridge' ? 60 : 62);
    }
    return null;
  };
  const ps = pointOf('sink');
  const ph = pointOf('hob');
  const pf = pointOf('fridge');
  if (ps && ph && pf) {
    const d = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.round(Math.hypot(a.x - b.x, a.z - b.z));
    const legs: [number, number, number] = [d(ps, ph), d(ph, pf), d(pf, ps)];
    const total = legs[0] + legs[1] + legs[2];
    // One-wall layouts (straight, island prep) have no real triangle: only the upper limits apply.
    const lineal = shape === 'straight' || shape === 'island';
    const ok = lineal ? legs.every((l) => l <= 270) : legs.every((l) => l >= 120 && l <= 270) && total <= 790;
    triangle = { sink: ps, hob: ph, fridge: pf, legs, total, ok };
  }

  if (!triangle && !warnings.some((w) => w.key === 'tooSmall')) warnings.push({ key: 'tooSmall' });
  const price = examplePrice(runs, island, state.collection);
  const moduleCount = runs.reduce((a, r) => a + r.modules.filter((m) => m.kind !== 'filler').length + r.uppers.length, 0) + (island ? island.modules.length : 0);

  return { state, shapeUsed: shape, runs, island, warnings, counterLength, storage: Math.round(storage / 10) * 10, triangle, price, moduleCount };
}

/**
 * Example price range in NIS. EXAMPLE ONLY: illustrative per-metre rates for orientation,
 * not Avivi pricing. Shown with a clear label in the UI.
 */
export function examplePrice(runs: Run[], island: Layout['island'], collection: CollectionId) {
  const factor: Record<CollectionId, number> = { modern: 1, light: 1, classic: 1.15, dark: 1.1, specials: 1.25 };
  let low = 0;
  let high = 0;
  for (const r of runs) {
    for (const m of r.modules) {
      const metres = m.width / 100;
      if (m.kind === 'fridge' || m.kind === 'oven' || m.kind === 'pantry') {
        low += 4200 * metres * 1.6;
        high += 7600 * metres * 1.6;
      } else if (m.kind !== 'filler') {
        low += 3600 * metres;
        high += 6800 * metres;
      }
    }
    for (const w of r.uppers) {
      low += 1800 * (w.width / 100);
      high += 3400 * (w.width / 100);
    }
    for (const c of r.counter) {
      low += 1300 * ((c.to - c.from) / 100);
      high += 3200 * ((c.to - c.from) / 100);
    }
  }
  if (island) {
    low += (3600 + 1300) * (island.length / 100) * 1.4;
    high += (6800 + 3200) * (island.length / 100) * 1.4;
  }
  const f = factor[collection] ?? 1;
  const round = (v: number) => Math.round((v * f) / 1000) * 1000;
  return { low: round(low), high: round(high) };
}

/* --------------------------------------------------------------------------- share codes */
export function encodePlan(s: PlannerState): string {
  const compact = [s.shape, s.width, s.depth, s.height, s.collection, s.openings.map((o) => [o.type === 'window' ? 'w' : 'd', o.wall[0], o.offset, o.width])];
  const json = JSON.stringify(compact);
  const b64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodePlan(code: string | null | undefined): PlannerState | null {
  if (!code) return null;
  try {
    const b64 = code.replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? decodeURIComponent(escape(atob(b64))) : Buffer.from(b64, 'base64').toString('utf8');
    const [shape, width, depth, height, collection, ops] = JSON.parse(json) as [Shape, number, number, number, CollectionId, [string, string, number, number][]];
    const wallOf: Record<string, WallId> = { b: 'back', l: 'left', r: 'right', f: 'front' };
    if (!['straight', 'L', 'U', 'galley', 'island'].includes(shape)) return null;
    return {
      shape,
      width: Number(width),
      depth: Number(depth),
      height: Number(height),
      collection,
      openings: (ops || []).slice(0, 8).map((o, i) => ({ id: `o${i}`, type: o[0] === 'w' ? 'window' : 'door', wall: wallOf[o[1]] ?? 'back', offset: Number(o[2]), width: Number(o[3]) })),
    };
  } catch {
    return null;
  }
}
