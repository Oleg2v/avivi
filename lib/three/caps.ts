/**
 * WebGL capability checks and DOM observers. No three.js import, so pages can decide
 * whether to load a scene without pulling the 3D engine into their first bundle.
 */

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

let fastCache: boolean | null = null;

/**
 * True only when WebGL runs on a real GPU. Software renderers (SwiftShader, llvmpipe, WARP)
 * fail the major-performance-caveat check; ambient scenes then use their still or drawn
 * versions instead of loading the main thread. Interactive tools keep using webglAvailable().
 */
export function webglFast(): boolean {
  if (fastCache !== null) return fastCache;
  try {
    const c = document.createElement('canvas');
    const opts = { failIfMajorPerformanceCaveat: true } as WebGLContextAttributes;
    const gl = (c.getContext('webgl2', opts) || c.getContext('webgl', opts)) as WebGLRenderingContext | null;
    if (!gl) return (fastCache = false);
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const name = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    fastCache = !/swiftshader|llvmpipe|softpipe|software|microsoft basic render/i.test(name);
  } catch {
    fastCache = false;
  }
  return fastCache;
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
