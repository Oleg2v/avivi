/**
 * "From a carpenter's bench": a single oak board on a workbench is cut into eight pieces,
 * the pieces become the eight fronts of the base run, the kitchen assembles around them,
 * the bench becomes the island, and workshop light turns into home light.
 * Everything is a pure function of scroll progress p in [0, 1], so it reverses perfectly.
 */
import * as THREE from 'three';
import { collections, type Finish } from '@/lib/data/collections';
import { createEnvironment, createRenderer, deviceTier } from '@/lib/three/core';
import { MaterialLibrary } from '@/lib/three/materials';
import { buildKitchen, buildRoom, DIM, type BuiltKitchen, type BuiltModule } from '@/lib/three/kitchen';
import { boxAt } from '@/lib/three/geo';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => t * t * (3 - 2 * t);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeIO = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const modern = collections.find((c) => c.id === 'modern')!.finish;
/** Hero finish: oak veneer base run (from the oak board), bone lacquer tall and wall units. */
const HERO_FINISH: Finish = {
  ...modern,
  front: { kind: 'oak', color: '#C9A27A', rough: 0.5 },
  tall: { kind: 'lacquer', color: '#D9D3C9', rough: 0.55 },
  wall: { kind: 'lacquer', color: '#D9D3C9', rough: 0.55 },
  island: { kind: 'oak', color: '#C9A27A', rough: 0.5 },
};

const BENCH = { cx: 0.25, cz: 2.25, len: 2.2, depth: 0.8, top: 0.9 };

interface Piece {
  mesh: THREE.Mesh;
  original: THREE.Mesh;
  start: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 };
  end: { pos: THREE.Vector3; quat: THREE.Quaternion; scale: THREE.Vector3 };
  index: number;
}

interface Key {
  p: number;
  pos: THREE.Vector3;
  look: THREE.Vector3;
}

export interface HeroOptions {
  onReady?: () => void;
  onFrame?: (p: number) => void;
}

export class HeroScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private lib: MaterialLibrary;
  private kitchen!: BuiltKitchen;
  private pieces: Piece[] = [];
  private bench = new THREE.Group();
  private benchLegs: THREE.Object3D[] = [];
  private benchTop!: THREE.Mesh;
  private kerf!: THREE.Mesh;
  private kerfLight!: THREE.PointLight;
  private dust!: THREE.Points;
  private shaft!: THREE.Mesh;
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  private fill!: THREE.SpotLight;
  private pendantLights: THREE.PointLight[] = [];
  private wallMat!: THREE.MeshStandardMaterial;
  private floorMat!: THREE.MeshStandardMaterial;
  private keys: Key[] = [];
  private target = 0;
  private current = 0;
  private raf = 0;
  private running = false;
  private last = 0;
  private time = 0;
  private dirty = true;
  private mobile: boolean;
  private opts: HeroOptions;
  private bgDark = new THREE.Color('#121110');
  private bgLight = new THREE.Color('#E6DED2');
  private tmpColor = new THREE.Color();
  private modules: { base: BuiltModule[]; tall: BuiltModule[]; wall: BuiltModule[]; island: BuiltModule[] } = { base: [], tall: [], wall: [], island: [] };
  private counterBase = new Map<THREE.Object3D, number>();

  constructor(canvas: HTMLCanvasElement, opts: HeroOptions = {}) {
    this.opts = opts;
    this.mobile = window.matchMedia('(max-aspect-ratio: 4/5)').matches || window.innerWidth < 760;
    const tier = deviceTier();
    this.renderer = createRenderer({ canvas, shadows: tier !== 'low', antialias: tier !== 'low' });
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.camera = new THREE.PerspectiveCamera(this.mobile ? 50 : 34, 1, 0.05, 60);
    this.lib = new MaterialLibrary(this.renderer, tier === 'low' ? 'low' : 'high');
    this.build(tier);
    this.setKeys();
    this.apply(0);
    this.renderer.compile(this.scene, this.camera);
  }

  /* ------------------------------------------------------------------ build */
  private build(tier: 'low' | 'mid' | 'high') {
    const s = this.scene;
    s.background = this.bgDark.clone();
    s.fog = new THREE.Fog(this.bgDark.clone(), 6, 16);
    s.environment = createEnvironment(this.renderer);
    s.environmentIntensity = 0.12;

    // Room shell
    const room = buildRoom(this.lib, { width: 6.6, depth: 7, height: 2.7, wallColor: '#E8E1D6', floor: 'planks', left: true, right: false });
    this.wallMat = room.wallMat;
    this.floorMat = room.floorMat;
    s.add(room.group);

    // Kitchen in its final position
    this.kitchen = buildKitchen(
      {
        finish: HERO_FINISH,
        ceiling: 2.7,
        runs: [
          {
            id: 'back',
            x: -2.4,
            z: 0,
            rot: 0,
            base: [
              { kind: 'fridge', width: 0.6 },
              { kind: 'oven', width: 0.6 },
              { kind: 'pantry', width: 0.6 },
              { kind: 'drawers', width: 0.6 },
              { kind: 'sink', width: 0.8 },
              { kind: 'dishwasher', width: 0.6 },
              { kind: 'hob', width: 0.9 },
              { kind: 'filler', width: 0.1 },
            ],
            wall: [
              { offset: 1.8, width: 0.6 },
              { offset: 2.4, width: 0.8 },
              { offset: 3.2, width: 0.6 },
              { offset: 3.8, width: 0.9 },
            ],
          },
        ],
        island: { cx: BENCH.cx, cz: BENCH.cz, length: 2.4, depth: 1.0, pendants: 3 },
      },
      this.lib,
    );
    s.add(this.kitchen.root);
    this.kitchen.root.updateMatrixWorld(true);
    for (const m of this.kitchen.modules) this.modules[m.category].push(m);
    for (const c of this.kitchen.counters) this.counterBase.set(c, c.position.y);

    // Workbench (becomes the island)
    const oakBench = this.lib.bench();
    const steel = this.lib.plain('benchSteel', { color: '#3a3836', roughness: 0.6, metalness: 0.4 });
    const b = BENCH;
    this.benchTop = boxAt(oakBench, b.cx - b.len / 2, b.top - 0.06, b.cz - b.depth / 2, b.len, 0.06, b.depth, { bevel: 0.004, swap: true });
    this.bench.add(this.benchTop);
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const leg = boxAt(oakBench, b.cx + sx * (b.len / 2 - 0.12) - 0.035, 0, b.cz + sz * (b.depth / 2 - 0.08) - 0.035, 0.07, b.top - 0.06, 0.07);
        this.bench.add(leg);
        this.benchLegs.push(leg);
      }
    const stretcher = boxAt(oakBench, b.cx - b.len / 2 + 0.12, 0.18, b.cz - 0.03, b.len - 0.24, 0.06, 0.06);
    this.bench.add(stretcher);
    this.benchLegs.push(stretcher);
    // try square and pencil on the bench
    const sq = new THREE.Group();
    sq.add(boxAt(steel, 0, 0, 0, 0.3, 0.003, 0.03), boxAt(oakBench, 0, 0, 0, 0.03, 0.012, 0.2));
    sq.position.set(b.cx + 0.55, b.top, b.cz + 0.12);
    sq.rotation.y = 0.3;
    const pencil = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.17, 8), this.lib.plain('pencil', { color: '#C9A13A', roughness: 0.5 }));
    pencil.rotation.z = Math.PI / 2;
    pencil.rotation.y = 0.5;
    pencil.position.set(b.cx - 0.65, b.top + 0.004, b.cz + 0.25);
    this.bench.add(sq, pencil);
    this.benchLegs.push(sq, pencil);
    this.bench.traverse((o) => {
      o.castShadow = true;
      o.receiveShadow = true;
    });
    s.add(this.bench);

    // Pieces: the eight base-run fronts start life as one board on the bench.
    const fronts: THREE.Mesh[] = [];
    for (const m of this.modules.base) {
      if (m.run !== 'back' || m.kind === 'filler') continue;
      for (const f of m.fronts) fronts.push(f);
    }
    const n = fronts.length;
    const boardLen = 2.4;
    const pieceL = boardLen / n;
    fronts.forEach((orig, i) => {
      orig.updateMatrixWorld(true);
      const endPos = new THREE.Vector3();
      const endQuat = new THREE.Quaternion();
      const endScale = new THREE.Vector3();
      orig.matrixWorld.decompose(endPos, endQuat, endScale);
      const geo = orig.geometry as THREE.BufferGeometry;
      geo.computeBoundingBox();
      const bb = geo.boundingBox!;
      const w = bb.max.x - bb.min.x;
      const h = bb.max.y - bb.min.y;
      const mesh = new THREE.Mesh(geo, orig.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // lying flat, grain along the board
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI / 2, 'YXZ'));
      const startPos = new THREE.Vector3(b.cx - boardLen / 2 + pieceL * (i + 0.5), b.top + 0.0095, b.cz + 0.02);
      const startScale = new THREE.Vector3(0.3 / w, pieceL / h, 1.05);
      this.scene.add(mesh);
      orig.visible = false;
      this.pieces.push({ mesh, original: orig, index: i, start: { pos: startPos, quat: q, scale: startScale }, end: { pos: endPos, quat: endQuat, scale: endScale } });
    });

    // Saw kerf: a hot line travelling along the board
    this.kerf = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.03, 0.36), new THREE.MeshBasicMaterial({ color: '#FFD9A6', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.kerf.position.set(b.cx - boardLen / 2, b.top + 0.012, b.cz + 0.02);
    s.add(this.kerf);
    this.kerfLight = new THREE.PointLight('#FFB066', 0, 1.2, 2);
    s.add(this.kerfLight);

    // Lights
    this.hemi = new THREE.HemisphereLight('#2b2f36', '#17130f', 0.35);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#dfe8ff', 4.2);
    this.sun.position.set(-3.2, 6.2, 3.6);
    this.sun.target.position.set(BENCH.cx, 0.6, BENCH.cz - 0.4);
    this.sun.castShadow = tier !== 'low';
    const sm = tier === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(sm, sm);
    this.sun.shadow.camera.left = -4;
    this.sun.shadow.camera.right = 4;
    this.sun.shadow.camera.top = 4;
    this.sun.shadow.camera.bottom = -3;
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 16;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.sun.shadow.radius = 4;
    s.add(this.sun, this.sun.target);
    this.fill = new THREE.SpotLight('#ffe3c4', 0, 14, 0.7, 0.8, 1.6);
    this.fill.position.set(3.6, 3.4, 6.4);
    this.fill.target.position.set(-0.6, 0.9, 0.6);
    s.add(this.fill, this.fill.target);
    for (const p of this.kitchen.pendants) {
      const l = new THREE.PointLight('#FFC98C', 0, 4.5, 1.8);
      l.position.set(p.position.x, 1.6, p.position.z);
      s.add(l);
      this.pendantLights.push(l);
    }

    // Light shaft (fake volumetric) and dust motes in it
    const shaftTex = this.shaftTexture();
    this.shaft = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 6.2),
      new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, color: '#cfdcff' }),
    );
    const dir = new THREE.Vector3().subVectors(this.sun.target.position, this.sun.position).normalize();
    const mid = new THREE.Vector3().copy(this.sun.target.position).addScaledVector(dir, -2.8);
    this.shaft.position.copy(mid);
    this.shaft.lookAt(mid.clone().add(new THREE.Vector3(0, 0, 1)));
    this.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    this.shaft.rotateY(Math.PI / 4);
    s.add(this.shaft);
    this.dust = this.makeDust(tier === 'low' ? 90 : 180);
    s.add(this.dust);
  }

  private shaftTexture() {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 256;
    const g = c.getContext('2d')!;
    const grad = g.createLinearGradient(0, 0, 64, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 256);
    const v = g.createLinearGradient(0, 0, 0, 256);
    v.addColorStop(0, 'rgba(0,0,0,1)');
    v.addColorStop(0.25, 'rgba(0,0,0,0)');
    v.addColorStop(0.85, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,1)');
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = v;
    g.fillRect(0, 0, 64, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  private makeDust(count: number) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // inside the shaft volume, between the window and the bench
      const t = Math.random();
      pos[i * 3] = BENCH.cx - 1.6 * t - 0.4 + (Math.random() - 0.5) * 0.9;
      pos[i * 3 + 1] = 1.0 + t * 2.0 + (Math.random() - 0.5) * 0.5;
      pos[i * 3 + 2] = BENCH.cz + 0.8 * t - 0.2 + (Math.random() - 0.5) * 0.9;
      seed[i] = Math.random() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSize: { value: (this.mobile ? 7 : 9) * this.renderer.getPixelRatio() } },
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime; uniform float uSize; varying float vA;
        void main(){
          vec3 p = position;
          p.x += sin(uTime*0.13 + seed)*0.08;
          p.y += mod(uTime*0.012 + seed*0.01, 0.4) - 0.2;
          p.z += cos(uTime*0.11 + seed*1.3)*0.08;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = min(uSize * 2.2, uSize * (0.4 + fract(seed)*0.6) / max(0.4, -mv.z));
          vA = 0.35 + 0.65*fract(seed*7.13);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uOpacity; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(1.0,0.96,0.9, a*vA*uOpacity); }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    return pts;
  }

  /* ------------------------------------------------------------------ camera */
  private setKeys() {
    const b = BENCH;
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    this.keys = this.mobile
      ? [
          { p: 0, pos: V(b.cx + 0.25, 2.25, b.cz + 1.15), look: V(b.cx, b.top, b.cz - 0.05) },
          { p: 0.2, pos: V(b.cx + 0.1, 2.5, b.cz + 1.5), look: V(b.cx, b.top, b.cz - 0.1) },
          { p: 0.4, pos: V(b.cx + 0.9, 2.3, b.cz + 4.2), look: V(0, 0.95, 0.5) },
          { p: 0.62, pos: V(1.6, 1.95, 6.4), look: V(0, 1.0, 0.8) },
          { p: 0.86, pos: V(1.9, 1.7, 7.0), look: V(-0.1, 1.05, 1.0) },
          { p: 1, pos: V(1.95, 1.68, 7.1), look: V(-0.1, 1.05, 1.0) },
        ]
      : [
          { p: 0, pos: V(b.cx + 1.25, 2.05, b.cz + 1.75), look: V(b.cx - 0.55, b.top - 0.1, b.cz - 0.15) },
          { p: 0.2, pos: V(b.cx + 0.7, 2.2, b.cz + 1.6), look: V(b.cx - 0.45, b.top - 0.05, b.cz - 0.2) },
          { p: 0.4, pos: V(b.cx + 1.9, 2.05, b.cz + 3.4), look: V(0.1, 0.95, 0.5) },
          { p: 0.62, pos: V(2.8, 1.85, 5.4), look: V(-0.05, 1.0, 0.7) },
          { p: 0.86, pos: V(3.25, 1.6, 5.8), look: V(-0.35, 1.05, 0.95) },
          { p: 1, pos: V(3.3, 1.58, 5.86), look: V(-0.38, 1.05, 0.95) },
        ];
  }

  private cameraAt(p: number) {
    const k = this.keys;
    let i = 0;
    while (i < k.length - 2 && p > k[i + 1].p) i++;
    const a = k[i];
    const b = k[i + 1];
    const t = easeIO(seg(p, a.p, b.p));
    this.camera.position.lerpVectors(a.pos, b.pos, t);
    const look = new THREE.Vector3().lerpVectors(a.look, b.look, t);
    // subtle handheld breathing in the workshop
    const breath = (1 - seg(p, 0.6, 0.85)) * 0.012;
    this.camera.position.y += Math.sin(this.time * 0.6) * breath;
    this.camera.lookAt(look);
  }

  /* ------------------------------------------------------------------ timeline */
  private apply(p: number) {
    const b = BENCH;
    const boardLen = 2.4;
    const n = this.pieces.length;

    // 1. CUT: 0.07 – 0.22
    const cut = seg(p, 0.07, 0.22);
    const kerfX = b.cx - boardLen / 2 + boardLen * cut;
    const kerfMat = this.kerf.material as THREE.MeshBasicMaterial;
    kerfMat.opacity = cut > 0 && cut < 1 ? 0.95 : 0;
    this.kerf.position.x = kerfX;
    this.kerfLight.position.set(kerfX, b.top + 0.05, b.cz + 0.1);
    this.kerfLight.intensity = cut > 0 && cut < 1 ? 2.2 : 0;

    // 2. JOIN: pieces fly to become fronts, 0.22 – 0.46 (staggered)
    const tmpQ = new THREE.Quaternion();
    for (const pc of this.pieces) {
      const i = pc.index;
      const cutPos = b.cx - boardLen / 2 + (boardLen / n) * (i + 1);
      const separated = kerfX > cutPos - 0.001 ? 1 : 0;
      const gap = (i - (n - 1) / 2) * 0.006 * (separated || cut >= 1 ? 1 : 0);
      const t0 = 0.22 + i * 0.022;
      const t = easeIO(seg(p, t0, t0 + 0.14));
      const lift = Math.sin(Math.PI * t) * 0.55;
      pc.mesh.position.lerpVectors(pc.start.pos, pc.end.pos, t);
      pc.mesh.position.x += gap * (1 - t);
      pc.mesh.position.y += lift;
      tmpQ.slerpQuaternions(pc.start.quat, pc.end.quat, t);
      pc.mesh.quaternion.copy(tmpQ);
      pc.mesh.scale.lerpVectors(pc.start.scale, pc.end.scale, easeOut(t));
    }

    // 3. ASSEMBLE: 0.42 – 0.66
    const carc = easeOut(seg(p, 0.42, 0.52));
    for (const m of this.modules.base) {
      if (m.run !== 'back') continue;
      m.group.scale.z = Math.max(0.0001, carc);
      m.group.visible = carc > 0.001;
    }
    this.kitchen.modules.filter((m) => m.kind === 'filler').forEach((m) => {
      m.fronts.forEach((f) => (f.visible = carc > 0.95));
    });
    this.modules.tall.forEach((m, i) => {
      const t = easeOut(seg(p, 0.46 + i * 0.03, 0.56 + i * 0.03));
      m.group.scale.y = Math.max(0.0001, t);
      m.group.visible = t > 0.001;
    });
    this.modules.wall.forEach((m, i) => {
      const t = easeOut(seg(p, 0.52 + i * 0.02, 0.62 + i * 0.02));
      m.group.position.y = (1 - t) * 1.4;
      m.group.visible = t > 0.001;
    });
    const top = easeOut(seg(p, 0.5, 0.6));
    for (const c of this.kitchen.counters) {
      if (c.name === 'islandTop') continue;
      c.position.y = (this.counterBase.get(c) ?? c.position.y) + (1 - top) * 1.1;
      c.visible = top > 0.001;
    }
    this.kitchen.channels.forEach((c) => (c.visible = carc > 0.98));
    const splash = easeOut(seg(p, 0.56, 0.64));
    for (const sp of this.kitchen.splashes) {
      sp.scale.y = Math.max(0.0001, splash);
      sp.position.y = DIM.counter + ((DIM.wallY0 - DIM.counter) * splash) / 2;
      sp.visible = splash > 0.001;
    }
    // sink/hob/tap details appear with the counter
    this.kitchen.runs.back?.children.forEach((ch) => {
      if ((ch as THREE.Mesh).isMesh && !['counter', 'splash', 'channel'].includes(ch.name)) ch.visible = top > 0.98;
      if ((ch as THREE.Group).isGroup && !ch.name.startsWith('module')) ch.visible = top > 0.98;
    });

    // Bench → island
    const isl = easeOut(seg(p, 0.5, 0.64));
    const legs = 1 - easeIO(seg(p, 0.48, 0.58));
    this.benchLegs.forEach((l) => {
      l.scale.y = Math.max(0.0001, legs);
      l.visible = legs > 0.01;
    });
    this.benchTop.position.y = b.top - 0.03 - (1 - legs) * 0.28;
    this.benchTop.visible = isl < 0.98;
    if (this.kitchen.island) {
      const { body, top: islTop } = this.kitchen.island;
      body.forEach((o) => {
        o.scale.y = Math.max(0.0001, isl);
        o.visible = isl > 0.001;
      });
      islTop.position.y = DIM.baseTop + DIM.ct / 2 + (1 - easeOut(seg(p, 0.58, 0.66))) * 0.9;
      islTop.visible = p > 0.58;
    }
    this.kitchen.pendants.forEach((pd, i) => {
      const t = easeOut(seg(p, 0.6 + i * 0.02, 0.7 + i * 0.02));
      pd.position.y = (1 - t) * 1.2;
      pd.visible = t > 0.001;
    });

    // 4. HOME LIGHT: 0.6 – 0.86
    const home = ease(seg(p, 0.52, 0.8));
    const workshop = 1 - home;
    this.tmpColor.copy(this.bgDark).lerp(this.bgLight, home);
    (this.scene.background as THREE.Color).copy(this.tmpColor);
    (this.scene.fog as THREE.Fog).color.copy(this.tmpColor);
    (this.scene.fog as THREE.Fog).near = 6 + home * 10;
    (this.scene.fog as THREE.Fog).far = 16 + home * 20;
    const wallTint = 0.07 + home * 0.93;
    this.wallMat.color.setScalar(wallTint);
    this.floorMat.color.setScalar(0.2 + home * 0.8);
    this.scene.environmentIntensity = 0.05 + home * 0.8;
    this.hemi.color.set('#2b2f36').lerp(new THREE.Color('#fff4e6'), home);
    this.hemi.groundColor.set('#17130f').lerp(new THREE.Color('#b8a48c'), home);
    this.hemi.intensity = 0.14 + home * 1.0;
    this.sun.color.set('#dfe8ff').lerp(new THREE.Color('#ffe2bf'), home);
    this.sun.intensity = 5.6 - home * 3.2;
    this.fill.intensity = home * 22;
    const glow = ease(seg(p, 0.64, 0.86));
    this.kitchen.pendantGlow.emissiveIntensity = glow * 3.2;
    this.kitchen.ledMat.emissiveIntensity = 0.2 + glow * 2.2;
    this.pendantLights.forEach((l) => (l.intensity = glow * 2.4));
    (this.shaft.material as THREE.MeshBasicMaterial).opacity = 0.22 * workshop * (1 - seg(p, 0.46, 0.62));
    (this.dust.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.55 * workshop;
    this.renderer.toneMappingExposure = 0.92 + home * 0.18;

    this.cameraAt(p);
  }

  /* ------------------------------------------------------------------ loop */
  setProgress(p: number) {
    this.target = clamp(p);
    this.dirty = true;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    const portrait = aspect < 0.8;
    if (portrait !== this.mobile) {
      this.mobile = portrait;
      this.camera.fov = portrait ? 50 : 34;
      this.setKeys();
    }
    this.camera.updateProjectionMatrix();
    this.dirty = true;
    if (!this.running) this.renderOnce();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const loop = (now: number) => {
      if (!this.running) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.time += dt;
      const before = this.current;
      this.current += (this.target - this.current) * (1 - Math.exp(-7 * dt));
      if (Math.abs(this.target - this.current) < 0.00005) this.current = this.target;
      const animating = this.current < 0.8 || Math.abs(before - this.current) > 0.00001 || this.dirty;
      if (animating) {
        (this.dust.material as THREE.ShaderMaterial).uniforms.uTime.value = this.time;
        this.apply(this.current);
        this.renderer.render(this.scene, this.camera);
        this.opts.onFrame?.(this.current);
        this.dirty = false;
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  renderOnce() {
    this.apply(this.current);
    this.renderer.render(this.scene, this.camera);
  }

  /** Jump without smoothing (reduced motion, first frame). */
  snap(p: number) {
    this.target = this.current = clamp(p);
    this.renderOnce();
  }

  dispose() {
    this.stop();
    this.lib.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
  }
}
