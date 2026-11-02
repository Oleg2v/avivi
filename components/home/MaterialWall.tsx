'use client';
import { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/lib/motion';
import s from './MaterialWall.module.css';
import { webglFast } from '@/lib/three/caps';

/**
 * "Feel the material": five surfaces rendered live in one raw WebGL fragment shader
 * (no three.js, ~6 KB). A point light follows the pointer, a finger, or the arrow keys,
 * and drifts slowly when idle. GGX specular, clearcoat on lacquer and marble,
 * anisotropic highlights on brushed brass. Pauses off-screen.
 */
const FRAG = /* glsl */ `
precision highp float;
uniform vec2 uRes; uniform vec3 uLight; uniform float uRows; uniform float uRtl; uniform float uGap;
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+10.0)*x);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy)); vec2 x0=v-i+dot(i,C.xx);
  vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz; x12.xy-=i1; i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0); m=m*m; m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0; vec3 h=abs(x)-0.5; vec3 ox=floor(x+0.5); vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g; g.x=a0.x*x0.x+h.x*x0.y; g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}
float fbm(vec2 p){ float a=0.5,t=0.0; for(int i=0;i<4;i++){ t+=a*snoise(p); p*=2.02; a*=0.5; } return t; }

// Material sample: albedo, roughness, metalness, clearcoat, height. p in metres on the surface.
struct Mat { vec3 albedo; float rough; float metal; float coat; float height; float aniso; };

float woodLines(vec2 p, float spacing, float warp, float seed){
  float w=snoise(vec2(p.x*22.0, p.y*0.7+seed))*0.35+snoise(vec2(p.x*2.4, p.y*0.16+seed*2.0));
  float x=p.x+w*warp;
  return pow(0.5+0.5*sin(x/spacing*6.2831853),7.0);
}

Mat material(int id, vec2 p){
  Mat m; m.metal=0.0; m.coat=0.0; m.aniso=0.0; m.height=0.0;
  if(id==0){ // natural oak veneer
    float l=woodLines(p,0.0058,0.008,1.0);
    float l2=pow(0.5+0.5*sin((p.x+snoise(vec2(p.x*30.0,p.y))*0.004)/0.0023*6.2831853),10.0);
    float band=0.5+0.5*sin(p.x*36.0+snoise(vec2(p.x*3.0,p.y*0.3))*2.0);
    vec3 c=mix(vec3(0.64,0.40,0.21),vec3(0.50,0.30,0.15),band*0.6);
    c=mix(c,vec3(0.28,0.16,0.08),l*0.6+l2*0.2);
    float pore=smoothstep(0.62,0.85,snoise(vec2(p.x*520.0,p.y*7.0))*0.5+0.5);
    c=mix(c,vec3(0.2,0.12,0.06),pore*0.35);
    m.albedo=c; m.rough=0.52+pore*0.12; m.height=l*0.25-pore*0.7; m.coat=0.04;
  } else if(id==1){ // walnut veneer
    float l=woodLines(p,0.007,0.012,4.0);
    float fig=fbm(vec2(p.x*3.0,p.y*0.5));
    vec3 c=mix(vec3(0.20,0.11,0.06),vec3(0.13,0.07,0.04),0.5+0.5*fig);
    c=mix(c,vec3(0.05,0.03,0.02),l*0.55);
    float pore=smoothstep(0.65,0.88,snoise(vec2(p.x*480.0,p.y*6.0))*0.5+0.5);
    m.albedo=c*(1.0-pore*0.25); m.rough=0.44+pore*0.1; m.height=l*0.2-pore*0.6; m.coat=0.18;
  } else if(id==2){ // matte lacquer, graphite
    float o=snoise(p*220.0)*0.5+snoise(p*520.0)*0.25;
    m.albedo=vec3(0.021,0.020,0.019); m.rough=0.58; m.height=o*0.035; m.coat=0.06;
  } else if(id==3){ // white marble, polished
    float n=fbm(p*1.6);
    float s_=abs(sin(6.2831853*(p.x*0.9+p.y*0.45)+n*5.5));
    float vein=1.0-smoothstep(0.0,0.045,s_);
    float soft=1.0-smoothstep(0.0,0.28,s_);
    float n2=fbm(p*3.1+7.0);
    float hair=1.0-smoothstep(0.0,0.02,abs(sin(6.2831853*(p.x*1.8-p.y*2.2)+n2*7.0)));
    vec3 c=vec3(0.86,0.84,0.80);
    c=mix(c,vec3(0.56,0.54,0.50),soft*0.32);
    c=mix(c,vec3(0.22,0.21,0.20),vein*0.85);
    c=mix(c,vec3(0.52,0.50,0.47),hair*0.45);
    c*=1.0+fbm(p*4.0)*0.05;
    m.albedo=c; m.rough=0.1; m.coat=0.65; m.height=-vein*0.02;
  } else { // brushed brass
    float st=snoise(vec2(p.x*3.0,p.y*420.0))*0.6+snoise(vec2(p.x*8.0,p.y*1100.0))*0.4;
    m.albedo=vec3(0.80,0.58,0.30)*(1.0+st*0.04); m.metal=1.0; m.rough=0.32+st*0.06; m.aniso=0.75; m.height=st*0.06;
  }
  return m;
}

float D_GGX(float NoH, float a){ float a2=a*a; float d=NoH*NoH*(a2-1.0)+1.0; return a2/(3.14159*d*d); }
float D_GGXaniso(float NoH, vec3 H, vec3 T, vec3 B, float ax, float ay){
  float ToH=dot(T,H), BoH=dot(B,H);
  float d=ToH*ToH/(ax*ax)+BoH*BoH/(ay*ay)+NoH*NoH;
  return 1.0/(3.14159*ax*ay*d*d);
}
float V_SmithJoint(float NoV, float NoL, float a){ float a2=a*a; float gv=NoL*sqrt(NoV*NoV*(1.0-a2)+a2); float gl=NoV*sqrt(NoL*NoL*(1.0-a2)+a2); return 0.5/max(gv+gl,1e-4); }
vec3 F_Schlick(float VoH, vec3 f0){ return f0+(1.0-f0)*pow(1.0-VoH,5.0); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }

void main(){
  vec2 frag=gl_FragCoord.xy;
  vec2 uv=frag/uRes;
  float n=5.0;
  float t=uRows>0.5?(1.0-uv.y)*n:uv.x*n;
  float idxf=floor(t);
  float f=fract(t);
  float gapPx=uGap;
  float tilePx=(uRows>0.5?uRes.y:uRes.x)/n;
  float edge=min(f,1.0-f)*tilePx;
  vec3 bg=vec3(0.0060,0.0055,0.0050);
  int idx=int(idxf);
  if(uRtl>0.5 && uRows<0.5) idx=4-idx;
  // physical surface coordinates (metres): screen height = 1.4 m
  vec2 P=frag/uRes.y*1.4;
  Mat m=material(idx, P+vec2(float(idx)*3.7,0.0));
  // normal from height (finite differences)
  float e=0.0006;
  float h0=m.height;
  float hx=material(idx,P+vec2(e,0.0)+vec2(float(idx)*3.7,0.0)).height;
  float hy=material(idx,P+vec2(0.0,e)+vec2(float(idx)*3.7,0.0)).height;
  vec3 N=normalize(vec3(-(hx-h0)/e*0.0012,-(hy-h0)/e*0.0012,1.0));
  vec3 W=vec3(P,0.0);
  vec3 cam=vec3(uRes.x/uRes.y*0.7,0.7,2.6);
  vec3 V=normalize(cam-W);
  vec3 Lp=uLight;
  vec3 Lv=Lp-W; float dist=length(Lv); vec3 L=Lv/dist;
  float atten=1.0/(0.35+dist*dist*2.2);
  vec3 H=normalize(L+V);
  float NoL=max(dot(N,L),0.0), NoV=max(dot(N,V),1e-3), NoH=max(dot(N,H),0.0), VoH=max(dot(V,H),0.0);
  float a=max(m.rough*m.rough,0.002);
  vec3 f0=mix(vec3(0.04),m.albedo,m.metal);
  vec3 F=F_Schlick(VoH,f0);
  float D;
  if(m.aniso>0.0){ vec3 T=normalize(vec3(1.0,0.0,0.0)); vec3 B=normalize(cross(N,T)); D=D_GGXaniso(NoH,H,T,B,max(a*(1.0-m.aniso*0.85),0.004),max(a*(1.0+m.aniso*2.2),0.004)); }
  else D=D_GGX(NoH,a);
  float Vis=V_SmithJoint(NoV,NoL,a);
  vec3 spec=D*Vis*F;
  vec3 diff=(1.0-m.metal)*(1.0-F)*m.albedo/3.14159;
  vec3 lightCol=vec3(1.0,0.93,0.84)*7.5;
  vec3 col=(diff+spec)*lightCol*NoL*atten;
  // clearcoat lobe
  if(m.coat>0.0){
    vec3 Nc=vec3(0.0,0.0,1.0);
    float NoHc=max(dot(Nc,H),0.0);
    float Fc=0.04+0.96*pow(1.0-VoH,5.0);
    col+=m.coat*D_GGX(NoHc,0.012)*V_SmithJoint(max(dot(Nc,V),1e-3),max(dot(Nc,L),0.0),0.012)*Fc*lightCol*max(dot(Nc,L),0.0)*atten;
  }
  // ambient: soft room bounce + fake environment for metal
  vec3 R=reflect(-V,N);
  vec3 env=mix(vec3(0.012,0.011,0.010),vec3(0.06,0.055,0.05),smoothstep(-0.2,0.9,R.y));
  col+=m.albedo*(1.0-m.metal)*0.035+env*mix(vec3(0.04),m.albedo,m.metal)*(1.0-m.rough*0.6)*1.6;
  // gaps between tiles
  float gapMask=smoothstep(gapPx*0.5-0.75,gapPx*0.5+0.75,edge);
  col=mix(bg,col,gapMask);
  // vignette + grain
  vec2 q=uv-0.5; col*=1.0-dot(q,q)*0.55;
  col=aces(col*1.15);
  col=pow(col,vec3(1.0/2.2));
  float g=fract(sin(dot(frag,vec2(12.9898,78.233)))*43758.5453);
  col+= (g-0.5)*0.012;
  gl_FragColor=vec4(col,1.0);
}
`;

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

export interface WallLabel {
  name: string;
  collections: string;
}

export function MaterialWall({ labels, hint, keys, inLabel, fallback, rtl, title }: { labels: WallLabel[]; hint: string; keys: string; inLabel: string; fallback: string; rtl: boolean; title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = webglFast() ? canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: true }) : null;
    if (!gl) {
      setSupported(false);
      return;
    }
    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
      return sh;
    };
    let prog: WebGLProgram;
    try {
      prog = gl.createProgram()!;
      gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    } catch {
      setSupported(false);
      return;
    }
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {
      res: gl.getUniformLocation(prog, 'uRes'),
      light: gl.getUniformLocation(prog, 'uLight'),
      rows: gl.getUniformLocation(prog, 'uRows'),
      rtl: gl.getUniformLocation(prog, 'uRtl'),
      gap: gl.getUniformLocation(prog, 'uGap'),
    };

    const reduce = prefersReducedMotion();
    let scale = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 1;
    let h = 1;
    let rows = false;
    // light in normalised canvas coords (0..1, y down) + height
    const target = { x: 0.32, y: 0.38 };
    const cur = { x: 0.32, y: 0.38 };
    let lastInput = 0;
    let visible = false;
    let raf = 0;
    let needs = true;
    let frameMs = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      rows = r.width < 760;
      w = Math.max(1, Math.round(r.width * scale));
      h = Math.max(1, Math.round(r.height * scale));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      needs = true;
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    const draw = () => {
      const t0 = performance.now();
      const metresPerPx = 1.4 / h;
      const lx = cur.x * w * metresPerPx;
      const ly = (1 - cur.y) * h * metresPerPx;
      gl.uniform2f(U.res, w, h);
      gl.uniform3f(U.light, lx, ly, 0.34);
      gl.uniform1f(U.rows, rows ? 1 : 0);
      gl.uniform1f(U.rtl, rtl ? 1 : 0);
      gl.uniform1f(U.gap, 10 * scale);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      frameMs = frameMs * 0.8 + (performance.now() - t0) * 0.2;
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${(cur.x * 100).toFixed(2)}%, ${(cur.y * 100).toFixed(2)}%, 0)`;
    };

    let last = performance.now();
    let idleT = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduce && now - lastInput > 3200) {
        idleT += dt * 0.32;
        target.x = 0.5 + Math.sin(idleT) * 0.36;
        target.y = 0.42 + Math.sin(idleT * 2.0) * 0.18;
      }
      const k = reduce ? 1 : 1 - Math.exp(-9 * dt);
      const dx = target.x - cur.x;
      const dy = target.y - cur.y;
      if (Math.abs(dx) > 0.0004 || Math.abs(dy) > 0.0004 || needs) {
        cur.x += dx * k;
        cur.y += dy * k;
        draw();
        needs = false;
        // adapt resolution if the GPU struggles
        if (frameMs > 26 && scale > 0.6) {
          scale *= 0.8;
          resize();
        }
      }
    };

    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(loop);
      } else if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(canvas);

    const setFromEvent = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      target.x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      target.y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
      lastInput = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || dragging) setFromEvent(e);
    };
    let dragging = false;
    const onDown = (e: PointerEvent) => {
      dragging = true;
      setFromEvent(e);
    };
    const onUp = () => (dragging = false);
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 0.1 : 0.04;
      let used = true;
      if (e.key === 'ArrowLeft') target.x = Math.max(0, target.x - (rtl ? -step : step));
      else if (e.key === 'ArrowRight') target.x = Math.min(1, target.x + (rtl ? -step : step));
      else if (e.key === 'ArrowUp') target.y = Math.max(0, target.y - step);
      else if (e.key === 'ArrowDown') target.y = Math.min(1, target.y + step);
      else used = false;
      if (used) {
        e.preventDefault();
        lastInput = performance.now();
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener('keydown', onKey);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('keydown', onKey);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [rtl]);

  return (
    <div className={s.wall} data-supported={supported ? '1' : '0'}>
      <canvas ref={ref} className={s.canvas} tabIndex={0} role="img" aria-label={`${title} ${labels.map((l) => l.name).join(', ')}`} aria-describedby="material-keys" />
      <span ref={dotRef} className={s.dotLayer} aria-hidden="true">
        <span className={s.dot} />
      </span>
      <ul className={s.labels}>
        {labels.map((l, i) => (
          <li key={l.name} className={s.label} data-i={i}>
            <span className="index-num">0{i + 1}</span>
            <span className={s.name}>{l.name}</span>
            <span className={s.in}>
              {inLabel}: {l.collections}
            </span>
          </li>
        ))}
      </ul>
      <p className={s.hint}>
        <span>{hint}</span>
        <span id="material-keys" className={s.keys}>
          {keys}
        </span>
      </p>
      {!supported ? <p className={s.fallbackNote}>{fallback}</p> : null}
    </div>
  );
}
