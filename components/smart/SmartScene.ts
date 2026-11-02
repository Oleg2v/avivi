/**
 * SMART KITCHEN, opened. A kitchen with real interiors. Scroll progress walks through the
 * five principles; each one opens the modules that prove it (corner swing-out, plinth
 * drawer, pull-out pantry, extending worktop, lift-up appliance cabinet, deep drawers).
 * Clicking a module toggles it and reports its key so the page can explain it.
 */
import * as THREE from 'three';
import { collections } from '@/lib/data/collections';
import { createEnvironment, createRenderer, deviceTier } from '@/lib/three/core';
import { MaterialLibrary } from '@/lib/three/materials';
import { buildKitchen, buildRoom, DIM, type BuiltKitchen, type Mover } from '@/lib/three/kitchen';
import { boxAt } from '@/lib/three/geo';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Which mover keys each principle opens (index = principle order in the dictionary). */
const PRINCIPLE_KEYS: string[][] = [
  ['corner', 'plinth', 'pantry'], // saving wasted space
  ['worktop', 'drawers'], // flexibility
  ['appliance', 'tall'], // clean design
  [], // adaptability (camera pulls back, all closed)
  ['veneer'], // materials (light sweep on veneer)
];

interface Key {
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export class SmartScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
  private lib: MaterialLibrary;
  private k: BuiltKitchen;
  private movers: Mover[] = [];
  private keys: Key[];
  private target = 0;
  private current = 0;
  private manual = new Map<string, number>(); // key -> target open (clicked)
  private manualCur = new Map<string, number>();
  private raf = 0;
  private running = false;
  private needs = true;
  private raycaster = new THREE.Raycaster();
  private sweep: THREE.SpotLight;
  private onPick?: (key: string | null, x: number, y: number) => void;

  constructor(canvas: HTMLCanvasElement, onPick?: (key: string | null, x: number, y: number) => void) {
    this.onPick = onPick;
    const tier = deviceTier();
    this.renderer = createRenderer({ canvas, shadows: tier !== 'low' });
    this.lib = new MaterialLibrary(this.renderer, tier === 'low' ? 'low' : 'high');
    const s = this.scene;
    s.background = new THREE.Color('#E9E2D7');
    s.environment = createEnvironment(this.renderer);
    s.environmentIntensity = 0.6;

    const room = buildRoom(this.lib, { width: 6, depth: 6, height: 2.7, wallColor: '#ECE6DD', floor: 'planks', left: true });
    s.add(room.group);

    const finish = { ...collections.find((c) => c.id === 'modern')!.finish, front: { kind: 'oak' as const, color: '#C9A27A', rough: 0.5 } };
    this.k = buildKitchen(
      {
        finish,
        interiors: true,
        ceiling: 2.7,
        runs: [
          {
            id: 'left',
            x: -2.4,
            z: 1.6,
            rot: Math.PI / 2,
            base: [
              { kind: 'drawers', width: 0.6, id: 'left-drawers' },
              { kind: 'corner', width: 1.0, id: 'corner' },
            ],
            splash: [{ from: 0, to: 1.6 }],
            counter: [{ from: 0, to: 1.6 }],
          },
          {
            id: 'back',
            x: -1.8,
            z: 0,
            rot: 0,
            base: [
              { kind: 'drawers', width: 0.9, id: 'deep-drawers' },
              { kind: 'sink', width: 0.8, id: 'sink' },
              { kind: 'hob', width: 0.9, id: 'hob' },
              { kind: 'drawers', width: 0.6, id: 'drawers-2' },
              { kind: 'oven', width: 0.6, id: 'oven' },
              { kind: 'pantry', width: 0.6, id: 'pantry' },
            ],
            wall: [
              { offset: 0, width: 0.9, kind: 'liftup', id: 'appliance' },
              { offset: 0.9, width: 0.8 },
              { offset: 1.7, width: 0.9 },
              { offset: 2.6, width: 0.6 },
            ],
          },
        ],
      },
      this.lib,
    );
    s.add(this.k.root);
    this.movers = this.k.movers.slice();

    // Extra SMART details: plinth drawer under the deep drawers, pull-out worktop under the counter.
    const back = this.k.runs.back;
    const plinthDrawer = new THREE.Group();
    plinthDrawer.add(boxAt(this.lib.get(finish.front), 0.0015, 0.004, DIM.baseD - 0.07, 0.897, DIM.plinth - 0.01, 0.018, { offset: [0, 0] }));
    plinthDrawer.add(boxAt(this.lib.plain('inner', { color: '#DCD6CC', roughness: 0.75 }), 0.03, 0.01, 0.06, 0.84, 0.08, DIM.baseD - 0.14));
    for (let i = 0; i < 3; i++) plinthDrawer.add(boxAt(this.lib.plain('tray', { color: '#9EA2A5', roughness: 0.3, metalness: 0.9 }), 0.06 + i * 0.27, 0.025, 0.1, 0.24, 0.01, 0.36));
    back.add(plinthDrawer);
    const worktop = new THREE.Group();
    worktop.add(boxAt(this.lib.get({ kind: 'oak', color: '#C9A27A', rough: 0.5 }), 0.92, DIM.baseTop - 0.07, 0.04, 0.76, 0.025, DIM.baseD - 0.02, { swap: true }));
    back.add(worktop);
    const mod = (id: string) => this.k.modules.find((m) => m.id === id)?.id ?? id;
    this.movers.push({ object: plinthDrawer, type: 'slide', amount: 0.42, key: 'plinth', moduleId: mod('deep-drawers'), base: plinthDrawer.position.clone(), baseRot: plinthDrawer.rotation.clone() });
    this.movers.push({ object: worktop, type: 'slide', amount: 0.42, key: 'worktop', moduleId: mod('sink'), base: worktop.position.clone(), baseRot: worktop.rotation.clone() });

    // Lights
    s.add(new THREE.HemisphereLight('#fff6ec', '#b8a792', 0.75));
    const sun = new THREE.DirectionalLight('#fff1dd', 2.4);
    sun.position.set(3.5, 5.5, 5);
    sun.castShadow = tier !== 'low';
    sun.shadow.mapSize.set(tier === 'high' ? 2048 : 1024, tier === 'high' ? 2048 : 1024);
    sun.shadow.camera.left = -4;
    sun.shadow.camera.right = 4;
    sun.shadow.camera.top = 4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    s.add(sun);
    this.sweep = new THREE.SpotLight('#ffe9c9', 0, 5, 0.35, 0.9, 1.5);
    s.add(this.sweep, this.sweep.target);
    this.k.ledMat.emissiveIntensity = 1.2;

    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    this.keys = [
      { pos: V(1.4, 1.5, 3.4), look: V(-1.6, 0.6, 0.8) }, // overview
      { pos: V(0.6, 1.25, 2.6), look: V(-1.7, 0.45, 0.9) }, // saving: corner + plinth + pantry
      { pos: V(0.7, 1.55, 2.4), look: V(-0.6, 0.8, 0.4) }, // flexibility: worktop + drawers
      { pos: V(0.9, 1.75, 2.6), look: V(-1.1, 1.6, 0.2) }, // clean: appliance cabinet, ovens
      { pos: V(2.6, 1.9, 5.2), look: V(-0.5, 0.9, 0.6) }, // adaptability: wide
      { pos: V(-0.3, 1.0, 1.7), look: V(-0.9, 0.55, 0.3) }, // materials: veneer close-up
    ];
    this.apply(0);
  }

  setProgress(p: number) {
    this.target = clamp(p);
    this.needs = true;
  }

  /** Raycast a click; toggles the module's movers. Returns the module key. */
  pick(clientX: number, clientY: number, rect: DOMRect): string | null {
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hits = this.raycaster.intersectObjects(this.k.root.children, true);
    for (const h of hits) {
      let o: THREE.Object3D | null = h.object;
      while (o && !o.name.startsWith('module:')) o = o.parent;
      if (!o) continue;
      const id = o.name.slice(7);
      const m = this.k.modules.find((x) => x.id === id);
      if (!m) continue;
      let key = m.key;
      if (id === 'deep-drawers') key = 'drawers';
      if (id === 'appliance') key = 'appliance';
      const open = (this.manual.get(id) ?? 0) > 0.5 ? 0 : 1;
      this.manual.set(id, open);
      this.needs = true;
      this.onPick?.(key, clientX - rect.left, clientY - rect.top);
      return key;
    }
    this.onPick?.(null, 0, 0);
    return null;
  }

  private apply(p: number) {
    // principle index and local progress (6 stations: overview + 5 principles)
    const stations = this.keys.length - 1;
    const f = p * stations;
    const i = Math.min(stations - 1, Math.floor(f));
    const local = f - i;
    const tcam = ease(seg(local, 0.0, 0.55));
    const a = this.keys[i];
    const b = this.keys[i + 1];
    this.camera.position.lerpVectors(a.pos, b.pos, tcam);
    this.camera.lookAt(new THREE.Vector3().lerpVectors(a.look, b.look, tcam));

    // which keys open: principle j (station j+1) opens while we are inside its window
    const openness = new Map<string, number>();
    PRINCIPLE_KEYS.forEach((keys, j) => {
      const center = j + 1; // station index
      const d = Math.abs(f - center);
      const amt = ease(clamp(1 - (d - 0.15) / 0.55));
      for (const k of keys) openness.set(k, Math.max(openness.get(k) ?? 0, amt));
    });

    for (const m of this.movers) {
      let amt = openness.get(m.key) ?? 0;
      // deep drawers only for the dedicated module in "flexibility"; keep others subtle
      if (m.key === 'drawers' && m.moduleId !== 'deep-drawers') amt *= 0.0;
      const manual = this.manualCur.get(m.moduleId) ?? 0;
      amt = Math.max(amt, manual);
      if (m.type === 'slide') {
        m.object.position.set(m.base.x, m.base.y, m.base.z + m.amount * amt);
      } else if (m.type === 'swing') {
        m.object.rotation.set(m.baseRot.x, m.baseRot.y + m.amount * amt * 0.92, m.baseRot.z);
      } else {
        m.object.rotation.set(m.baseRot.x + m.amount * amt, m.baseRot.y, m.baseRot.z);
      }
    }

    // materials: a light sweep across the veneer fronts
    const mat = openness.get('veneer') ?? 0;
    this.sweep.intensity = mat * 14;
    const sx = -1.8 + seg(local, 0.1, 0.9) * 3.4 * (i === stations - 1 ? 1 : 0);
    this.sweep.position.set(sx, 1.4, 1.4);
    this.sweep.target.position.set(sx - 0.2, 0.5, 0.5);
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w / h < 1 ? 50 : 36;
    this.camera.updateProjectionMatrix();
    this.needs = true;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      this.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      let moving = false;
      const before = this.current;
      this.current += (this.target - this.current) * (1 - Math.exp(-6 * dt));
      if (Math.abs(this.target - this.current) < 0.00005) this.current = this.target;
      if (Math.abs(before - this.current) > 0.00001) moving = true;
      this.manual.forEach((v, k) => {
        const c = this.manualCur.get(k) ?? 0;
        const n = c + (v - c) * (1 - Math.exp(-8 * dt));
        if (Math.abs(n - c) > 0.0005) moving = true;
        this.manualCur.set(k, Math.abs(v - n) < 0.001 ? v : n);
      });
      if (moving || this.needs) {
        this.apply(this.current);
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

  snap(p: number) {
    this.target = this.current = clamp(p);
    this.apply(this.current);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    this.lib.dispose();
    this.renderer.dispose();
  }
}
