/**
 * Material library: turns the collection finish recipes into physically based materials
 * backed by GPU-generated textures. One library per renderer; everything is cached.
 */
import * as THREE from 'three';
import type { MaterialSpec } from '@/lib/data/collections';
import { metalTex, planksTex, plasterTex, stoneTex, tilesTex, woodTex, type TexPair, type WoodTone } from './texgen';

export class MaterialLibrary {
  private renderer: THREE.WebGLRenderer;
  private tex = new Map<string, TexPair>();
  private mats = new Map<string, THREE.Material>();
  readonly quality: 'low' | 'high';

  constructor(renderer: THREE.WebGLRenderer, quality: 'low' | 'high' = 'high') {
    this.renderer = renderer;
    this.quality = quality;
  }

  private size(n: number) {
    return this.quality === 'low' ? Math.max(256, n / 2) : n;
  }

  private texPair(key: string, make: () => TexPair): TexPair {
    let t = this.tex.get(key);
    if (!t) {
      t = make();
      this.tex.set(key, t);
    }
    return t;
  }

  wood(tone: WoodTone, flute = 0): TexPair {
    return this.texPair(`wood:${tone}:${flute}`, () => woodTex(this.renderer, tone, { flute, size: this.size(1024) }));
  }

  /** Worn workshop bench wood (darker than the fresh oak board). */
  bench(): THREE.Material {
    const k = 'bench';
    const c = this.mats.get(k);
    if (c) return c;
    const t = this.wood('bench');
    const m = new THREE.MeshStandardMaterial({ map: t.map, roughnessMap: t.props, bumpMap: t.props, bumpScale: 0.9, roughness: 1 });
    this.mats.set(k, m);
    return m;
  }

  /** Material for a finish spec. `variant` distinguishes e.g. fluted fronts. */
  get(spec: MaterialSpec, variant: '' | 'fluted' = ''): THREE.Material {
    const key = `${spec.kind}:${spec.color}:${spec.rough}:${variant}`;
    const cached = this.mats.get(key);
    if (cached) return cached;
    let m: THREE.Material;
    switch (spec.kind) {
      case 'oak':
      case 'paleOak':
      case 'walnut': {
        const t = this.wood(spec.kind, variant === 'fluted' ? 0.024 : 0);
        m = new THREE.MeshPhysicalMaterial({
          map: t.map,
          roughnessMap: t.props,
          bumpMap: t.props,
          bumpScale: variant === 'fluted' ? 3.2 : 0.6,
          roughness: 1,
          metalness: 0,
          clearcoat: spec.kind === 'walnut' ? 0.12 : 0.04,
          clearcoatRoughness: 0.45,
          sheen: 0.15,
          sheenRoughness: 0.8,
          sheenColor: new THREE.Color('#f3dcc0'),
        });
        break;
      }
      case 'marble':
      case 'nero':
      case 'travertine':
      case 'stone':
      case 'quartz': {
        const t = this.texPair(`stone:${spec.kind}`, () => stoneTex(this.renderer, spec.kind as 'marble', this.size(1024)));
        const polished = spec.kind === 'marble' || spec.kind === 'nero' || spec.kind === 'quartz';
        m = new THREE.MeshPhysicalMaterial({
          map: t.map,
          roughnessMap: t.props,
          bumpMap: spec.kind === 'travertine' ? t.props : null,
          bumpScale: 0.8,
          roughness: 1,
          clearcoat: polished ? 0.55 : 0.0,
          clearcoatRoughness: polished ? 0.12 : 0.6,
          specularIntensity: polished ? 0.7 : 0.4,
        });
        break;
      }
      case 'brass':
      case 'steel':
      case 'bronze': {
        const t = this.texPair(`metal:${spec.color}`, () => metalTex(this.renderer, spec.color, spec.rough, 256));
        m = new THREE.MeshPhysicalMaterial({
          color: spec.color,
          roughnessMap: t.props,
          metalness: 1,
          roughness: 1,
          anisotropy: 0.55,
        });
        break;
      }
      case 'lacquer':
      default: {
        m = new THREE.MeshPhysicalMaterial({
          color: spec.color,
          roughness: spec.rough,
          metalness: 0,
          clearcoat: spec.rough < 0.45 ? 0.25 : 0.06,
          clearcoatRoughness: 0.5,
          specularIntensity: 0.5,
        });
      }
    }
    m.name = key;
    this.mats.set(key, m);
    return m;
  }

  plain(key: string, params: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial {
    const k = `plain:${key}`;
    const c = this.mats.get(k);
    if (c) return c as THREE.MeshStandardMaterial;
    const m = new THREE.MeshStandardMaterial(params);
    m.name = k;
    this.mats.set(k, m);
    return m;
  }

  emissive(key: string, color: string, intensity = 1): THREE.MeshStandardMaterial {
    return this.plain(`emit:${key}`, { color: '#ffffff', emissive: new THREE.Color(color), emissiveIntensity: intensity, roughness: 0.6 });
  }

  floorPlanks(): THREE.MeshStandardMaterial {
    const t = this.texPair('planks', () => planksTex(this.renderer, this.size(1024)));
    return this.plain('floor:planks', { map: t.map, roughnessMap: t.props, bumpMap: t.props, bumpScale: 0.8, roughness: 1 });
  }

  floorTiles(base = '#D3CCC1'): THREE.MeshStandardMaterial {
    const t = this.texPair(`tiles:${base}`, () => tilesTex(this.renderer, base, '#B7AEA2', [0.8, 0.8], [3.2, 3.2], 0.32, this.size(1024)));
    return this.plain(`floor:tiles:${base}`, { map: t.map, roughnessMap: t.props, bumpMap: t.props, bumpScale: 0.6, roughness: 1 });
  }

  wall(color: string): THREE.MeshStandardMaterial {
    const t = this.texPair(`plaster:${color}`, () => plasterTex(this.renderer, color, 0, this.size(512)));
    return this.plain(`wall:${color}`, { map: t.map, roughnessMap: t.props, bumpMap: t.props, bumpScale: 0.25, roughness: 1 });
  }

  dispose() {
    this.mats.forEach((m) => m.dispose());
    this.tex.forEach((t) => {
      t.map.dispose();
      t.props.dispose();
    });
    this.mats.clear();
    this.tex.clear();
  }
}
