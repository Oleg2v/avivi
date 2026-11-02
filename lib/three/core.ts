/**
 * Shared three.js plumbing: renderer with a capped DPR, environment lighting,
 * visibility/size observers so scenes pause off-screen, and capability checks.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function isMobileViewport(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
}

/** Rough device class used to choose shadow resolution and DPR. */
export function deviceTier(): 'low' | 'mid' | 'high' {
  if (typeof navigator === 'undefined') return 'mid';
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 4;
  const mobile = isMobileViewport();
  if (mobile && (cores <= 4 || mem <= 3)) return 'low';
  if (mobile) return 'mid';
  return cores >= 8 ? 'high' : 'mid';
}

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  alpha?: boolean;
  shadows?: boolean;
  maxDpr?: number;
  antialias?: boolean;
}

export function createRenderer({ canvas, alpha = false, shadows = false, maxDpr, antialias = true }: RendererOptions) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha,
    antialias,
    powerPreference: 'high-performance',
    stencil: false,
    preserveDrawingBuffer: false,
  });
  const tier = deviceTier();
  const cap = maxDpr ?? (tier === 'low' ? 1.25 : tier === 'mid' ? 1.6 : 2);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

/** Soft studio reflections from three's procedural RoomEnvironment (no HDR download). */
export function createEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const rt = pmrem.fromScene(room, 0.035);
  room.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }
  });
  pmrem.dispose();
  return rt.texture;
}

/** Calls cb(true/false) as the element enters/leaves the viewport (with a margin). */
export function observeVisibility(el: Element, cb: (visible: boolean) => void, rootMargin = '120px'): () => void {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.isIntersecting)), { rootMargin });
  io.observe(el);
  return () => io.disconnect();
}

export function observeSize(el: Element, cb: (w: number, h: number) => void): () => void {
  const ro = new ResizeObserver((entries) => {
    const r = entries[0]?.contentRect;
    if (r) cb(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)));
  });
  ro.observe(el);
  return () => ro.disconnect();
}

/** Dispose every geometry, material and texture under an object. */
export function disposeTree(root: THREE.Object3D) {
  const textures = new Set<THREE.Texture>();
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v && (v as THREE.Texture).isTexture) textures.add(v as THREE.Texture);
      mat.dispose();
    }
  });
  textures.forEach((t) => t.dispose());
}

export const damp = (current: number, target: number, lambda: number, dt: number) =>
  THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
