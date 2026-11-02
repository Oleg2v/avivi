/**
 * Procedural material textures, generated on the GPU at start-up.
 * Zero texture downloads: oak, walnut, marble, travertine, stone, brushed metal,
 * floor planks, plaster and tiles are painted by shaders into render targets.
 * All textures tile seamlessly (noise is sampled on a 4D torus).
 */
import * as THREE from 'three';

const NOISE = /* glsl */ `
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
float mod289(float x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+10.0)*x);}
float permute(float x){return mod289(((x*34.0)+10.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float taylorInvSqrt(float r){return 1.79284291400159-0.85373472095314*r;}
vec4 grad4(float j, vec4 ip){
  const vec4 ones=vec4(1.0,1.0,1.0,-1.0);
  vec4 p,s;
  p.xyz=floor(fract(vec3(j)*ip.xyz)*7.0)*ip.z-1.0;
  p.w=1.5-dot(abs(p.xyz),ones.xyz);
  s=vec4(lessThan(p,vec4(0.0)));
  p.xyz=p.xyz+(s.xyz*2.0-1.0)*s.www;
  return p;
}
float snoise(vec4 v){
  const vec4 C=vec4(0.138196601125011,0.276393202250021,0.414589803375032,-0.447213595499958);
  vec4 i=floor(v+dot(v,vec4(0.309016994374947451)));
  vec4 x0=v-i+dot(i,C.xxxx);
  vec4 i0;
  vec3 isX=step(x0.yzw,x0.xxx);
  vec3 isYZ=step(x0.zww,x0.yyz);
  i0.x=isX.x+isX.y+isX.z;
  i0.yzw=1.0-isX;
  i0.y+=isYZ.x+isYZ.y;
  i0.zw+=1.0-isYZ.xy;
  i0.z+=isYZ.z;
  i0.w+=1.0-isYZ.z;
  vec4 i3=clamp(i0,0.0,1.0);
  vec4 i2=clamp(i0-1.0,0.0,1.0);
  vec4 i1=clamp(i0-2.0,0.0,1.0);
  vec4 x1=x0-i1+C.xxxx;
  vec4 x2=x0-i2+C.yyyy;
  vec4 x3=x0-i3+C.zzzz;
  vec4 x4=x0+C.wwww;
  i=mod289(i);
  float j0=permute(permute(permute(permute(i.w)+i.z)+i.y)+i.x);
  vec4 j1=permute(permute(permute(permute(i.w+vec4(i1.w,i2.w,i3.w,1.0))+i.z+vec4(i1.z,i2.z,i3.z,1.0))+i.y+vec4(i1.y,i2.y,i3.y,1.0))+i.x+vec4(i1.x,i2.x,i3.x,1.0));
  vec4 ip=vec4(1.0/294.0,1.0/49.0,1.0/7.0,0.0);
  vec4 p0=grad4(j0,ip);
  vec4 p1=grad4(j1.x,ip);
  vec4 p2=grad4(j1.y,ip);
  vec4 p3=grad4(j1.z,ip);
  vec4 p4=grad4(j1.w,ip);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  p4*=taylorInvSqrt(dot(p4,p4));
  vec3 m0=max(0.6-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.0);
  vec2 m1=max(0.6-vec2(dot(x3,x3),dot(x4,x4)),0.0);
  m0=m0*m0;m1=m1*m1;
  return 49.0*(dot(m0*m0,vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2)))+dot(m1*m1,vec2(dot(p3,x3),dot(p4,x4))));
}
uniform vec2 uTile;
uniform float uSeed;
// Periodic noise: p in metres, freq in features per metre (per axis).
float tn(vec2 p, vec2 freq, float s){
  vec2 a=p/uTile*6.28318530718;
  vec2 R=freq*uTile/6.28318530718;
  return snoise(vec4(cos(a.x)*R.x, sin(a.x)*R.x, cos(a.y)*R.y+s*7.13, sin(a.y)*R.y+s*3.71));
}
float fbm(vec2 p, vec2 f, float s, int oct){
  float a=0.5, t=0.0;
  for(int i=0;i<6;i++){ if(i>=oct) break; t+=a*tn(p,f,s+float(i)*1.7); f*=2.03; a*=0.5; }
  return t;
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }
`;

const WOOD = /* glsl */ `
uniform vec3 cLight; uniform vec3 cMid; uniform vec3 cDark;
uniform float uLines; uniform float uWarp; uniform float uFigure; uniform float uPore; uniform float uRough;
uniform float uFlute; // 0 = flat veneer, >0 = rib pitch in metres (fluted fronts)
varying vec2 vUv;
void main(){
  vec2 p=vUv*uTile;
  float wA=tn(p, vec2(22.0,0.7), uSeed);
  float wB=tn(p, vec2(2.4,0.16), uSeed+3.1);
  float x=p.x+(wA*0.35+wB*1.0)*uWarp;
  float ph=x/uTile.x*uLines*6.28318530718;
  float lines=pow(0.5+0.5*sin(ph),7.0);
  float x2=p.x+(tn(p,vec2(30.0,1.0),uSeed+5.3)*0.4+wB*1.0)*uWarp;
  float lines2=pow(0.5+0.5*sin(x2/uTile.x*(uLines*2.0+7.0)*6.28318530718),10.0);
  float band=0.5+0.5*sin(x/uTile.x*floor(uLines/7.0)*6.28318530718);
  vec3 base=mix(cLight,cMid,band*0.7);
  float fade=clamp(tn(p,vec2(28.0,1.2),uSeed+7.0)*0.55+0.6,0.0,1.0);
  vec3 col=mix(base,cDark,lines*fade*0.68);
  col=mix(col,cDark,lines2*0.26);
  float fib=tn(p,vec2(220.0,1.4),uSeed+11.0);
  col*=1.0+fib*0.045;
  float drift=tn(p,vec2(1.4,0.28),uSeed+2.0);
  col*=1.0-uFigure*(0.5+0.5*drift)*0.2;
  float pn=tn(p,vec2(520.0,7.0),uSeed+5.0)*0.5+0.5;
  float pore=smoothstep(0.62,0.82,pn);
  col=mix(col,cDark*0.72,pore*uPore);
  float rib=0.0;
  if(uFlute>0.0){
    float t=fract(p.x/uFlute);
    rib=sqrt(max(0.0,1.0-pow(t*2.0-1.0,2.0)));
    col*=0.86+0.14*rib;
  }
#ifdef PROPS
  float h=lines*0.25-pore*0.6+rib*3.0;
  gl_FragColor=vec4(h*0.5+0.5, clamp(uRough+pore*0.12+lines*0.04,0.0,1.0), 0.0, 1.0);
#else
  gl_FragColor=vec4(col,1.0);
#endif
}
`;

const MARBLE = /* glsl */ `
uniform vec3 cBase; uniform vec3 cVein; uniform vec3 cSoft;
uniform float uWarp; uniform float uVein; uniform float uCloud; uniform float uSecondary; uniform float uRough;
uniform vec2 uDir; uniform float uBands; // uBands>0: travertine-style horizontal banding
varying vec2 vUv;
void main(){
  vec2 p=vUv*uTile; vec2 q=vUv;
  vec3 col=cBase;
  float rough=uRough; float h=0.0;
  if(uBands>0.0){
    float n=fbm(p,vec2(1.6,0.9),uSeed,4);
    float b=0.5+0.5*sin(6.28318530718*(q.y*uBands)+n*uWarp);
    float b2=0.5+0.5*sin(6.28318530718*(q.y*uBands*3.0)+n*uWarp*1.7);
    col=mix(cSoft,cBase,smoothstep(0.2,0.8,b));
    col=mix(col,cVein,smoothstep(0.75,1.0,b2)*0.55);
    float pits=smoothstep(0.62,0.8,tn(p,vec2(48.0,180.0),uSeed+9.0)*0.5+0.5);
    col=mix(col,cVein*0.82,pits*0.55);
    h=-pits;
    rough=uRough+pits*0.2;
  } else {
    float n=fbm(p,vec2(1.3),uSeed,5);
    float ph=6.28318530718*(q.x*uDir.x+q.y*uDir.y)+n*uWarp;
    float s=abs(sin(ph));
    float vein=1.0-smoothstep(0.0,uVein,s);
    float soft=1.0-smoothstep(0.0,uVein*7.0,s);
    float n2=fbm(p,vec2(2.6),uSeed+9.0,4);
    float ph2=6.28318530718*(q.x*(uDir.x+1.0)-q.y*(uDir.y*2.0+1.0))+n2*uWarp*1.5;
    float hair=1.0-smoothstep(0.0,uVein*0.45,abs(sin(ph2)));
    col=mix(col,cSoft,soft*0.32);
    col=mix(col,cVein,vein);
    col=mix(col,cSoft,hair*uSecondary);
    h=-vein*0.1;
  }
  float cl=fbm(p,vec2(2.2),uSeed+4.0,4);
  col*=1.0+cl*uCloud*0.07;
  float sp=tn(p,vec2(260.0),uSeed+12.0);
  col*=1.0+sp*0.012;
#ifdef PROPS
  gl_FragColor=vec4(h*0.5+0.5, clamp(rough+sp*0.02,0.0,1.0), 0.0, 1.0);
#else
  gl_FragColor=vec4(col,1.0);
#endif
}
`;

const METAL = /* glsl */ `
uniform vec3 cBase; uniform float uRough;
varying vec2 vUv;
void main(){
  vec2 p=vUv*uTile;
  float s=tn(p,vec2(2.0,320.0),uSeed)*0.6+tn(p,vec2(6.0,900.0),uSeed+2.0)*0.4;
#ifdef PROPS
  gl_FragColor=vec4(0.5+s*0.08, clamp(uRough+s*0.09,0.03,1.0), 1.0, 1.0);
#else
  gl_FragColor=vec4(cBase*(1.0+s*0.035),1.0);
#endif
}
`;

const PLANKS = /* glsl */ `
uniform vec3 cLight; uniform vec3 cMid; uniform vec3 cDark; uniform float uRough;
uniform float uPlankW; uniform float uPlankL;
varying vec2 vUv;
float hash(float n){return fract(sin(n*91.345)*47453.5453);}
void main(){
  vec2 p=vUv*uTile;
  float col_=floor(p.x/uPlankW);
  float off=hash(col_+uSeed)*uPlankL;
  float row=floor((p.y+off)/uPlankL);
  float id=col_*17.0+row*3.0;
  vec2 lp=vec2(fract(p.x/uPlankW)*uPlankW, fract((p.y+off)/uPlankL)*uPlankL);
  float edgeX=min(lp.x,uPlankW-lp.x);
  float edgeY=min(lp.y,uPlankL-lp.y);
  float seam=1.0-smoothstep(0.0,0.0016,min(edgeX,edgeY));
  float w=tn(p+vec2(hash(id)*3.0,0.0),vec2(30.0,0.8),uSeed+hash(id)*9.0);
  float x=p.x+w*0.004+hash(id)*0.3;
  float lines=pow(0.5+0.5*sin(x*900.0),6.0);
  float tone=hash(id*1.31);
  vec3 base=mix(cLight,cMid,tone*0.8);
  vec3 col=mix(base,cDark,lines*0.35);
  col*=1.0+tn(p,vec2(160.0,1.5),uSeed+3.0)*0.04;
  col=mix(col,cDark*0.6,seam*0.85);
#ifdef PROPS
  gl_FragColor=vec4(0.5-seam*0.5+lines*0.05, clamp(uRough+lines*0.05+seam*0.2,0.0,1.0), 0.0, 1.0);
#else
  gl_FragColor=vec4(col,1.0);
#endif
}
`;

const TILES = /* glsl */ `
uniform vec3 cBase; uniform vec3 cGrout; uniform vec2 uTileSize; uniform float uRough; uniform float uVar;
varying vec2 vUv;
float hash2(vec2 v){return fract(sin(dot(v,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec2 p=vUv*uTile;
  vec2 cell=floor(p/uTileSize);
  vec2 lp=fract(p/uTileSize)*uTileSize;
  float e=min(min(lp.x,uTileSize.x-lp.x),min(lp.y,uTileSize.y-lp.y));
  float grout=1.0-smoothstep(0.0008,0.0018,e);
  vec3 col=cBase*(1.0+(hash2(cell+uSeed)-0.5)*uVar);
  col*=1.0+fbm(p,vec2(3.0),uSeed+1.0,3)*0.04;
  col=mix(col,cGrout,grout);
#ifdef PROPS
  gl_FragColor=vec4(0.5-grout*0.5, clamp(uRough+grout*0.4,0.0,1.0), 0.0, 1.0);
#else
  gl_FragColor=vec4(col,1.0);
#endif
}
`;

const PLASTER = /* glsl */ `
uniform vec3 cBase; uniform float uRough; uniform float uPatch;
varying vec2 vUv;
void main(){
  vec2 p=vUv*uTile;
  float n=fbm(p,vec2(2.5),uSeed,5);
  float f=tn(p,vec2(70.0),uSeed+4.0);
  vec3 col=cBase*(1.0+n*0.035*(1.0+uPatch*3.0)+f*0.01);
#ifdef PROPS
  gl_FragColor=vec4(0.5+f*0.15+n*0.05, clamp(uRough,0.0,1.0), 0.0, 1.0);
#else
  gl_FragColor=vec4(col,1.0);
#endif
}
`;

export interface TexPair {
  map: THREE.Texture;
  props: THREE.Texture;
  tile: [number, number];
}

const quadGeo = new THREE.BufferGeometry();
quadGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
quadGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 2, 0, 0, 2], 2));

function render(renderer: THREE.WebGLRenderer, frag: string, uniforms: Record<string, THREE.IUniform>, size: number, props: boolean): THREE.WebGLRenderTarget {
  const rt = new THREE.WebGLRenderTarget(size, size, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
    wrapS: THREE.RepeatWrapping,
    wrapT: THREE.RepeatWrapping,
    depthBuffer: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: (props ? '#define PROPS\n' : '') + NOISE + frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(quadGeo, mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  const cam = new THREE.Camera();
  const prevRT = renderer.getRenderTarget();
  const prevTM = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cam);
  renderer.setRenderTarget(prevRT);
  renderer.toneMapping = prevTM;
  mat.dispose();
  rt.texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return rt;
}

const lin = (hex: string) => new THREE.Color(hex); // ColorManagement converts sRGB hex to linear

function pair(renderer: THREE.WebGLRenderer, frag: string, u: Record<string, unknown>, tile: [number, number], size: number): TexPair {
  const uniforms: Record<string, THREE.IUniform> = { uTile: { value: new THREE.Vector2(tile[0], tile[1]) } };
  for (const [k, v] of Object.entries(u)) uniforms[k] = { value: v };
  if (!uniforms.uSeed) uniforms.uSeed = { value: Math.random() * 10 };
  const a = render(renderer, frag, uniforms, size, false);
  const b = render(renderer, frag, uniforms, size, true);
  // Geometry UVs are in metres, so each texture repeats once per physical tile.
  a.texture.repeat.set(1 / tile[0], 1 / tile[1]);
  b.texture.repeat.set(1 / tile[0], 1 / tile[1]);
  return { map: a.texture, props: b.texture, tile };
}

export type WoodTone = 'oak' | 'paleOak' | 'walnut' | 'workshop' | 'bench';

const WOOD_TONES: Record<WoodTone, [string, string, string, number, number]> = {
  // light, mid, dark, figure, roughness
  oak: ['#D1A777', '#BA8E5D', '#8C623B', 0.18, 0.55],
  paleOak: ['#E2C8A2', '#D0B188', '#AA875F', 0.1, 0.55],
  walnut: ['#7D573A', '#634330', '#3A271B', 0.25, 0.45],
  workshop: ['#C79F70', '#AF8558', '#7F5A37', 0.25, 0.7],
  bench: ['#8E6E50', '#785A40', '#4A3726', 0.35, 0.8],
};

export function woodTex(renderer: THREE.WebGLRenderer, tone: WoodTone, opts: { flute?: number; size?: number; seed?: number } = {}): TexPair {
  const [l, m, d, fig, rough] = WOOD_TONES[tone];
  const tile: [number, number] = [1.2, 2.4];
  return pair(
    renderer,
    WOOD,
    {
      cLight: lin(l),
      cMid: lin(m),
      cDark: lin(d),
      uLines: Math.round(1.2 / 0.0058),
      uWarp: tone === 'walnut' ? 0.011 : 0.008,
      uFigure: fig,
      uPore: tone === 'walnut' ? 0.2 : 0.3,
      uRough: rough,
      uFlute: opts.flute ?? 0,
      uSeed: opts.seed ?? Math.random() * 10,
    },
    tile,
    opts.size ?? 1024,
  );
}

export type StoneKind = 'marble' | 'nero' | 'travertine' | 'stone' | 'quartz';

export function stoneTex(renderer: THREE.WebGLRenderer, kind: StoneKind, size = 1024): TexPair {
  const tile: [number, number] = [2, 2];
  switch (kind) {
    case 'marble':
      return pair(renderer, MARBLE, { cBase: lin('#F1EEE9'), cVein: lin('#86817A'), cSoft: lin('#C5BFB6'), uWarp: 5.5, uVein: 0.035, uCloud: 0.5, uSecondary: 0.45, uRough: 0.12, uDir: new THREE.Vector2(2, 1), uBands: 0 }, tile, size);
    case 'nero':
      return pair(renderer, MARBLE, { cBase: lin('#1D1C1B'), cVein: lin('#B9B2A7'), cSoft: lin('#4A4642'), uWarp: 5.0, uVein: 0.022, uCloud: 0.4, uSecondary: 0.3, uRough: 0.16, uDir: new THREE.Vector2(1, 2), uBands: 0 }, tile, size);
    case 'travertine':
      return pair(renderer, MARBLE, { cBase: lin('#D8C8AF'), cVein: lin('#C3AD8E'), cSoft: lin('#E2D5C1'), uWarp: 1.4, uVein: 0.05, uCloud: 0.6, uSecondary: 0, uRough: 0.42, uDir: new THREE.Vector2(0, 1), uBands: 9 }, tile, size);
    case 'quartz':
      return pair(renderer, MARBLE, { cBase: lin('#F3F1EC'), cVein: lin('#CFC9BF'), cSoft: lin('#E3DED6'), uWarp: 4.0, uVein: 0.03, uCloud: 0.3, uSecondary: 0.2, uRough: 0.18, uDir: new THREE.Vector2(1, 1), uBands: 0 }, tile, size);
    case 'stone':
    default:
      return pair(renderer, MARBLE, { cBase: lin('#D9D6D0'), cVein: lin('#BDB8B0'), cSoft: lin('#CCC8C1'), uWarp: 3.0, uVein: 0.02, uCloud: 0.8, uSecondary: 0.15, uRough: 0.38, uDir: new THREE.Vector2(1, 1), uBands: 0 }, tile, size);
  }
}

export function metalTex(renderer: THREE.WebGLRenderer, hex: string, rough: number, size = 256): TexPair {
  return pair(renderer, METAL, { cBase: lin(hex), uRough: rough }, [0.5, 0.5], size);
}

export function planksTex(renderer: THREE.WebGLRenderer, size = 1024): TexPair {
  return pair(renderer, PLANKS, { cLight: lin('#CFAE84'), cMid: lin('#B99268'), cDark: lin('#7C5B3C'), uRough: 0.5, uPlankW: 0.18, uPlankL: 1.2 }, [2.16, 2.4], size);
}

export function tilesTex(renderer: THREE.WebGLRenderer, base: string, grout: string, tileSize: [number, number], tile: [number, number], rough = 0.3, size = 1024): TexPair {
  return pair(renderer, TILES, { cBase: lin(base), cGrout: lin(grout), uTileSize: new THREE.Vector2(tileSize[0], tileSize[1]), uRough: rough, uVar: 0.04 }, tile, size);
}

export function plasterTex(renderer: THREE.WebGLRenderer, base: string, patch = 0, size = 512): TexPair {
  return pair(renderer, PLASTER, { cBase: lin(base), uRough: 0.92, uPatch: patch }, [3, 3], size);
}
