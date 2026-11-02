/**
 * Planner 3D view: the room (walls cut away towards the viewer, with window and door
 * openings), the SMART KITCHEN layout from the engine, and the work triangle on the floor.
 * Rebuilt live on every change; orbit with mouse or touch; renders on demand.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getCollection } from '@/lib/data/collections';
import { createEnvironment, createRenderer, deviceTier, disposeTree } from '@/lib/three/core';
import { MaterialLibrary } from '@/lib/three/materials';
import { buildKitchen, type KitchenSpec, type ModuleSpec, type RunSpec } from '@/lib/three/kitchen';
import { boxAt } from '@/lib/three/geo';
import type { Layout, Run } from '@/lib/planner/engine';

const CM = 0.01;

export class PlannerScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
  private controls: OrbitControls;
  private lib: MaterialLibrary;
  private content = new THREE.Group();
  private raf = 0;
  private needs = true;
  private running = false;
  private lastKey = '';

  constructor(canvas: HTMLCanvasElement) {
    const tier = deviceTier();
    this.renderer = createRenderer({ canvas, shadows: tier === 'high' });
    this.lib = new MaterialLibrary(this.renderer, tier === 'low' ? 'low' : 'high');
    this.scene.background = new THREE.Color('#ECE6DD');
    this.scene.environment = createEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.65;
    this.scene.add(new THREE.HemisphereLight('#fff7ee', '#b8a792', 0.9));
    const sun = new THREE.DirectionalLight('#fff3e2', 2.2);
    sun.position.set(4, 7, 6);
    sun.castShadow = tier === 'high';
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    this.scene.add(this.content);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.38;
    this.controls.enablePan = false;
    this.controls.addEventListener('change', () => (this.needs = true));
  }

  update(layout: Layout) {
    const s = layout.state;
    const key = JSON.stringify([layout.runs, layout.island, s.height, s.collection, s.openings]);
    if (key === this.lastKey) return;
    this.lastKey = key;
    const dims = `${s.width}x${s.depth}x${s.height}`;
    const sizeChanged = dims !== this.lastDims;
    this.lastDims = dims;
    disposeTreeKeepMaterials(this.content);
    this.content.clear();
    const W = s.width * CM;
    const D = s.depth * CM;
    const H = s.height * CM;
    const finish = getCollection(s.collection)!.finish;

    // room
    const wallMat = this.lib.wall(finish.walls);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + 0.24, 0.04, D + 0.12), this.lib.floorPlanks());
    // metric UVs for the floor
    const uv = floor.geometry.getAttribute('uv') as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (W + 0.24), uv.getY(i) * (D + 0.12));
    floor.position.set(0, -0.02, D / 2);
    floor.receiveShadow = true;
    this.content.add(floor);
    const T = 0.12;
    const wallWithOpenings = (wall: 'back' | 'left' | 'right') => {
      const len = wall === 'back' ? W : D;
      const ops = s.openings.filter((o) => o.wall === wall).map((o) => ({ a: o.offset * CM, b: (o.offset + o.width) * CM, y0: o.type === 'door' ? 0 : 1.0, y1: o.type === 'door' ? 2.1 : Math.min(H - 0.3, 2.3), type: o.type }));
      ops.sort((p, q) => p.a - q.a);
      const pieces: [number, number, number, number][] = [];
      let a = 0;
      for (const o of ops) {
        if (o.a > a) pieces.push([a, o.a, 0, H]);
        pieces.push([o.a, o.b, 0, o.y0]);
        pieces.push([o.a, o.b, o.y1, H]);
        a = Math.max(a, o.b);
      }
      if (a < len) pieces.push([a, len, 0, H]);
      for (const [p0, p1, y0, y1] of pieces) {
        if (p1 - p0 < 0.005 || y1 - y0 < 0.005) continue;
        let m: THREE.Mesh;
        if (wall === 'back') m = boxAt(wallMat, -W / 2 + p0, y0, -T, p1 - p0, y1 - y0, T, { cast: false });
        else if (wall === 'left') m = boxAt(wallMat, -W / 2 - T, y0, p0, T, y1 - y0, p1 - p0, { cast: false });
        else m = boxAt(wallMat, W / 2, y0, p0, T, y1 - y0, p1 - p0, { cast: false });
        this.content.add(m);
      }
      // window glass glow and door leaves
      for (const o of ops) {
        if (o.type === 'window') {
          const glass = new THREE.Mesh(new THREE.PlaneGeometry(o.b - o.a, o.y1 - o.y0), new THREE.MeshBasicMaterial({ color: '#dce8f2', toneMapped: false }));
          const mid = (o.a + o.b) / 2;
          if (wall === 'back') glass.position.set(-W / 2 + mid, (o.y0 + o.y1) / 2, -T * 0.6);
          else if (wall === 'left') {
            glass.position.set(-W / 2 - T * 0.6, (o.y0 + o.y1) / 2, mid);
            glass.rotation.y = Math.PI / 2;
          } else {
            glass.position.set(W / 2 + T * 0.6, (o.y0 + o.y1) / 2, mid);
            glass.rotation.y = -Math.PI / 2;
          }
          this.content.add(glass);
        }
      }
    };
    wallWithOpenings('back');
    wallWithOpenings('left');
    wallWithOpenings('right');
    // door swings on the floor (all walls, including the entrance wall)
    const arcMat = new THREE.LineBasicMaterial({ color: '#7a5634', transparent: true, opacity: 0.7 });
    for (const o of s.openings.filter((x) => x.type === 'door')) {
      const r = o.width * CM;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = (i / 24) * (Math.PI / 2);
        pts.push(new THREE.Vector3(Math.cos(t) * r, 0.005, Math.sin(t) * r));
      }
      const arc = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), arcMat);
      const a = o.offset * CM;
      if (o.wall === 'back') arc.position.set(-W / 2 + a, 0, 0);
      else if (o.wall === 'front') {
        arc.position.set(-W / 2 + a, 0, D);
        arc.rotation.y = 0;
        arc.scale.z = -1;
      } else if (o.wall === 'left') {
        arc.position.set(-W / 2, 0, a);
        arc.rotation.y = -Math.PI / 2;
        arc.scale.z = -1;
      } else {
        arc.position.set(W / 2, 0, a);
        arc.rotation.y = Math.PI / 2;
      }
      this.content.add(arc);
    }

    // kitchen
    const runs: RunSpec[] = layout.runs.map((r) => this.toRunSpec(r, s.width, s.depth));
    const spec: KitchenSpec = { finish, runs, ceiling: H };
    if (layout.island) {
      spec.island = {
        cx: (layout.island.cx - s.width / 2) * CM,
        cz: layout.island.cz * CM,
        length: layout.island.length * CM,
        depth: layout.island.depth * CM,
        modules: layout.island.modules.map((m) => ({ kind: m.kind === 'filler' ? 'filler' : 'drawers', width: m.width * CM })),
        pendants: layout.island.length >= 200 ? 3 : 2,
      };
    }
    const k = buildKitchen(spec, this.lib);
    k.ledMat.emissiveIntensity = 0.8;
    this.content.add(k.root);

    // work triangle
    if (layout.triangle) {
      const tr = layout.triangle;
      const P = (p: { x: number; z: number }) => new THREE.Vector3((p.x - s.width / 2) * CM, 0.012, p.z * CM);
      const pts = [P(tr.sink), P(tr.hob), P(tr.fridge), P(tr.sink)];
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: tr.ok ? '#B48A4F' : '#8d2f1f', dashSize: 0.08, gapSize: 0.05 }));
      line.computeLineDistances();
      this.content.add(line);
      for (const p of pts.slice(0, 3)) {
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.06, 24), new THREE.MeshBasicMaterial({ color: '#B48A4F' }));
        dot.rotation.x = -Math.PI / 2;
        dot.position.copy(p).setY(0.013);
        this.content.add(dot);
      }
    }

    if (sizeChanged || !this.framed) this.frame(W, D, H);
    this.needs = true;
  }

  private framed = false;
  private lastDims = '';

  private frame(W: number, D: number, H: number) {
    this.framed = true;
    const target = new THREE.Vector3(0, 0.9, D * 0.42);
    const dist = Math.max(W, D) * 1.45 + 1.2;
    this.camera.position.set(W * 0.55, H * 0.95 + dist * 0.35, D + dist * 0.55);
    this.controls.target.copy(target);
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = dist * 2;
    this.controls.update();
  }

  private toRunSpec(r: Run, Wcm: number, Dcm: number): RunSpec {
    const mods: ModuleSpec[] = [];
    const wallLen = r.length;
    // Left wall runs are built from the entrance end towards the back corner (builder frame).
    const rev = r.wall === 'left';
    const loc = (start: number, width: number) => (rev ? (wallLen - start - width) * CM : start * CM);
    const list = [...r.modules].map((m) => ({ ...m, ls: loc(m.start, m.width) })).sort((a, b) => a.ls - b.ls);
    for (const m of list) mods.push({ kind: m.kind === 'corner' ? 'corner' : m.kind, width: m.width * CM, start: m.ls });
    const counter = r.counter.map((c) => ({ from: loc(c.from, c.to - c.from), to: loc(c.from, c.to - c.from) + (c.to - c.from) * CM }));
    const wall = r.uppers.map((w) => ({ offset: loc(w.start, w.width), width: w.width * CM, kind: w.kind === 'hood' ? ('hood' as const) : ('wall' as const) }));
    let x = 0;
    let z = 0;
    let rot = 0;
    if (r.wall === 'back') {
      x = -Wcm * CM * 0.5;
      z = 0;
      rot = 0;
    } else if (r.wall === 'left') {
      x = -Wcm * CM * 0.5;
      z = Dcm * CM;
      rot = Math.PI / 2;
    } else {
      x = Wcm * CM * 0.5;
      z = 0;
      rot = -Math.PI / 2;
    }
    // splash pieces stop below windows
    const splash = counter.map((c) => ({ from: c.from, to: c.to }));
    return { id: r.id, x, z, rot, base: mods, wall, counter, splash };
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.needs = true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      this.controls.update();
      if (this.needs) {
        this.renderer.render(this.scene, this.camera);
        this.needs = false;
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.controls.dispose();
    disposeTree(this.content);
    this.lib.dispose();
    this.renderer.dispose();
  }
}

/** Dispose geometries (materials are shared and cached by the library). */
function disposeTreeKeepMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) if (!mat.name) mat.dispose();
  });
}
