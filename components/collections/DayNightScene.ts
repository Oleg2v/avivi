/**
 * Day to night: the collection's kitchen in a room with a side window. One parameter,
 * time t in [0, 1], moves the sun from morning to evening (shadows travel across the floor),
 * shifts the sky colour, then switches on under-cabinet LEDs, pendants and ceiling spots.
 * Renders on demand only (slider change, resize, pointer parallax).
 */
import * as THREE from 'three';
import type { Finish } from '@/lib/data/collections';
import { createEnvironment, createRenderer, deviceTier } from '@/lib/three/core';
import { MaterialLibrary } from '@/lib/three/materials';
import { buildKitchen } from '@/lib/three/kitchen';
import { boxAt } from '@/lib/three/geo';

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const sm = (t: number) => t * t * (3 - 2 * t);

const SKY = [
  { t: 0, c: new THREE.Color('#cfdbe8') },
  { t: 0.35, c: new THREE.Color('#e9eef2') },
  { t: 0.62, c: new THREE.Color('#f2c69a') },
  { t: 0.78, c: new THREE.Color('#5a5f7a') },
  { t: 1, c: new THREE.Color('#121826') },
];

function skyAt(t: number, out: THREE.Color) {
  for (let i = 0; i < SKY.length - 1; i++) {
    const a = SKY[i];
    const b = SKY[i + 1];
    if (t <= b.t) return out.copy(a.c).lerp(b.c, sm(seg(t, a.t, b.t)));
  }
  return out.copy(SKY[SKY.length - 1].c);
}

export class DayNightScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.05, 50);
  private lib: MaterialLibrary;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;
  private spots: THREE.SpotLight[] = [];
  private pendantLights: THREE.PointLight[] = [];
  private skyMat: THREE.MeshBasicMaterial;
  private kitchen: ReturnType<typeof buildKitchen>;
  private t = 0.15;
  private parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  private raf = 0;
  private visible = false;
  private needs = true;
  private dark: boolean;
  private camBase = new THREE.Vector3();
  private look = new THREE.Vector3(-0.3, 1.0, 0.9);

  constructor(canvas: HTMLCanvasElement, finish: Finish, dark: boolean) {
    const tier = deviceTier();
    this.dark = dark;
    this.renderer = createRenderer({ canvas, shadows: tier !== 'low' });
    this.lib = new MaterialLibrary(this.renderer, tier === 'low' ? 'low' : 'high');
    const s = this.scene;
    s.environment = createEnvironment(this.renderer);
    s.environmentIntensity = 0.5;
    s.background = new THREE.Color('#e6ded2');

    // Room with a window in the left wall
    const W = 6.2;
    const D = 6.4;
    const H = 2.7;
    const wallMat = this.lib.wall(finish.walls);
    const floorMat = this.lib.floorPlanks();
    const floor = boxAt(floorMat, -W / 2 - 1, -0.05, -0.2, W + 2, 0.05, D + 2, { cast: false });
    s.add(floor);
    const T = 0.14;
    const back = boxAt(wallMat, -W / 2 - T, 0, -T, W + 2 * T, H, T, { cast: true });
    s.add(back);
    const ceiling = boxAt(this.lib.plain('ceiling', { color: '#f1eee9', roughness: 0.95 }), -W / 2 - T, H, -T, W + 2 * T, 0.08, D, { cast: true });
    s.add(ceiling);
    // left wall around the window: z 1.3..3.6, y 0.9..2.35
    const wx0 = -W / 2 - T;
    const z0 = 1.3;
    const z1 = 3.6;
    const y0 = 0.9;
    const y1 = 2.35;
    s.add(boxAt(wallMat, wx0, 0, 0, T, H, z0));
    s.add(boxAt(wallMat, wx0, 0, z1, T, H, D - z1));
    s.add(boxAt(wallMat, wx0, 0, z0, T, y0, z1 - z0));
    s.add(boxAt(wallMat, wx0, y1, z0, T, H - y1, z1 - z0));
    const frame = this.lib.plain('frame', { color: '#2d2c2a', roughness: 0.5, metalness: 0.4 });
    s.add(boxAt(frame, wx0 + 0.05, y0, z0, 0.04, y1 - y0, 0.04), boxAt(frame, wx0 + 0.05, y0, z1 - 0.04, 0.04, y1 - y0, 0.04));
    s.add(boxAt(frame, wx0 + 0.05, y0, z0, 0.04, 0.04, z1 - z0), boxAt(frame, wx0 + 0.05, y1 - 0.04, z0, 0.04, 0.04, z1 - z0));
    s.add(boxAt(frame, wx0 + 0.05, y0, (z0 + z1) / 2 - 0.02, 0.04, y1 - y0, 0.04));
    this.skyMat = new THREE.MeshBasicMaterial({ color: '#dce6ee', toneMapped: false });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(8, 5), this.skyMat);
    sky.position.set(wx0 - 2.5, 1.6, (z0 + z1) / 2);
    sky.rotation.y = Math.PI / 2;
    s.add(sky);

    // Kitchen
    const wallUnits = finish.wallUnits;
    this.kitchen = buildKitchen(
      {
        finish,
        ceiling: H,
        runs: [
          {
            id: 'back',
            x: -2.6,
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
              { kind: 'drawers', width: 0.6 },
            ],
            wall: wallUnits
              ? [
                  { offset: 1.8, width: 0.6 },
                  { offset: 2.4, width: 0.8 },
                  { offset: 3.2, width: 0.6 },
                  { offset: 3.8, width: 0.9 },
                  { offset: 4.7, width: 0.6 },
                ]
              : [
                  { offset: 1.9, width: 1.8, kind: 'open' },
                  { offset: 3.8, width: 0.9, kind: 'hood' },
                ],
          },
        ],
        island: { cx: 0.1, cz: 2.55, length: 2.4, depth: 1.0, pendants: 3 },
      },
      this.lib,
    );
    s.add(this.kitchen.root);

    // Lights
    this.hemi = new THREE.HemisphereLight('#f4efe6', '#a89782', 0.6);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1dd', 3);
    this.sun.castShadow = tier !== 'low';
    const size = tier === 'high' ? 2048 : 1024;
    this.sun.shadow.mapSize.set(size, size);
    const c = this.sun.shadow.camera;
    c.left = -5;
    c.right = 5;
    c.top = 5;
    c.bottom = -5;
    c.near = 0.5;
    c.far = 30;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    s.add(this.sun, this.sun.target);
    this.sun.target.position.set(0, 0, 2.2);
    for (const x of [-1.6, 0, 1.6]) {
      const sp = new THREE.SpotLight('#ffd6a3', 0, 6, 0.75, 0.6, 1.4);
      sp.position.set(x, H - 0.02, 1.1);
      sp.target.position.set(x, 0, 1.1);
      s.add(sp, sp.target);
      this.spots.push(sp);
    }
    for (const p of this.kitchen.pendants) {
      const l = new THREE.PointLight('#ffc98c', 0, 5, 1.8);
      l.position.set(p.position.x, 1.58, p.position.z);
      s.add(l);
      this.pendantLights.push(l);
    }
    // warm wash from the under-cabinet LEDs onto the counter
    const counterSpot = new THREE.SpotLight('#ffcf94', 0, 3, 1.2, 1, 2);
    counterSpot.position.set(0.3, 1.45, 0.25);
    counterSpot.target.position.set(0.3, 0.9, 0.5);
    s.add(counterSpot, counterSpot.target);
    this.spots.push(counterSpot);

    this.camBase.set(3.4, 1.6, 6.3);
    this.apply();
  }

  setTime(t: number) {
    this.t = clamp(t);
    this.apply();
    this.needs = true;
  }

  setParallax(x: number, y: number) {
    this.parallax.tx = x;
    this.parallax.ty = y;
    this.needs = true;
  }

  private apply() {
    const t = this.t;
    // Sun: morning from the front-left (high), evening from the back-left (low).
    const day = 1 - seg(t, 0.68, 0.82);
    const elev = THREE.MathUtils.degToRad(8 + Math.sin(Math.PI * clamp(t / 0.78)) * 46);
    const az = THREE.MathUtils.degToRad(-35 + t * 95); // around the window wall
    const dist = 12;
    this.sun.position.set(-Math.cos(elev) * Math.cos(az) * dist, Math.sin(elev) * dist, 2.2 + Math.cos(elev) * Math.sin(az) * dist);
    const warm = seg(t, 0.4, 0.72);
    this.sun.color.set('#fff3e2').lerp(new THREE.Color('#ffb070'), warm);
    this.sun.intensity = 3.4 * day * (0.75 + 0.25 * Math.sin(Math.PI * clamp(t / 0.78)));
    const skyC = new THREE.Color();
    skyAt(t, skyC);
    this.skyMat.color.copy(skyC).multiplyScalar(1.15);
    this.hemi.color.copy(skyC).lerp(new THREE.Color('#fff7ee'), 0.5);
    this.hemi.intensity = 0.25 + 0.5 * day;
    this.scene.environmentIntensity = 0.12 + 0.45 * day;
    const bg = (this.scene.background as THREE.Color).copy(new THREE.Color('#e6ded2')).lerp(new THREE.Color(this.dark ? '#121110' : '#1b1917'), seg(t, 0.62, 0.95));
    void bg;
    const night = sm(seg(t, 0.66, 0.92));
    const led = sm(seg(t, 0.58, 0.85));
    this.kitchen.ledMat.emissiveIntensity = 0.2 + led * 3;
    this.kitchen.pendantGlow.emissiveIntensity = night * 3.2;
    this.pendantLights.forEach((l) => (l.intensity = night * 2.6));
    this.spots.forEach((sp, i) => (sp.intensity = (i === this.spots.length - 1 ? led * 1.6 : night * 9)));
    this.renderer.toneMappingExposure = 1.0 + night * 0.25;
  }

  resize(w: number, h: number) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const portrait = w / h < 1;
    this.camera.fov = portrait ? 52 : 36;
    this.camBase.set(portrait ? 2.6 : 3.4, portrait ? 1.75 : 1.6, portrait ? 7.4 : 6.3);
    this.camera.updateProjectionMatrix();
    this.needs = true;
  }

  start() {
    if (this.visible) return;
    this.visible = true;
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      const p = this.parallax;
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
        p.x += dx * 0.08;
        p.y += dy * 0.08;
        this.needs = true;
      }
      if (this.needs) {
        this.camera.position.set(this.camBase.x + p.x * 0.5, this.camBase.y + p.y * 0.2, this.camBase.z);
        this.camera.lookAt(this.look);
        this.renderer.render(this.scene, this.camera);
        this.needs = false;
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.visible = false;
    cancelAnimationFrame(this.raf);
  }

  dispose() {
    this.stop();
    this.lib.dispose();
    this.renderer.dispose();
  }
}
