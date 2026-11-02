'use client';
/**
 * "My design": everything a visitor saves (visualisations, plans, style result,
 * product brief) plus locally submitted leads for the demo inbox.
 * Stored in localStorage on this device only. Tiny external store + React hook.
 */
import { useSyncExternalStore } from 'react';
import type { CollectionId } from './data/collections';

export interface SavedVisualisation {
  id: string;
  room: 'a' | 'b' | 'c' | 'upload';
  collection: CollectionId;
  createdAt: number;
  /** Data URL of a live AI result (uploads only, when the image service is connected). */
  image?: string;
  /** Data URL of the visitor's own photo, downscaled (kept only with a live result). */
  before?: string;
}

export interface SavedPlan {
  id: string;
  createdAt: number;
  /** Encoded planner state (same format as the share link). */
  code: string;
  summary: { shape: string; width: number; depth: number; counter: number; storage: number; collection: CollectionId };
}

export interface SavedStyle {
  collection: CollectionId;
  answers: Record<string, string>;
  brief: string[];
  createdAt: number;
}

export interface LocalLead {
  ref: string;
  type: string;
  createdAt: number;
  payload: Record<string, unknown>;
}

export interface DesignState {
  visualisations: SavedVisualisation[];
  plans: SavedPlan[];
  style: SavedStyle | null;
  products: string[];
  leads: LocalLead[];
}

const KEY = 'avivi-my-design-v1';
const EMPTY: DesignState = { visualisations: [], plans: [], style: null, products: [], leads: [] };

let state: DesignState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY, ...(JSON.parse(raw) as Partial<DesignState>) };
  } catch {
    state = EMPTY;
  }
}

function persist() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded: drop heavy images from older visualisations and retry once.
    try {
      state = {
        ...state,
        visualisations: state.visualisations.map((v, i) => (i < state.visualisations.length - 1 ? { ...v, image: undefined, before: undefined } : v)),
      };
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage unavailable: keep in memory only */
    }
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

export const designStore = {
  get(): DesignState {
    load();
    return state;
  },
  subscribe(listener: () => void) {
    load();
    listeners.add(listener);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) {
        loaded = false;
        load();
        listener();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener('storage', onStorage);
    };
  },
  addVisualisation(v: SavedVisualisation) {
    load();
    const others = state.visualisations.filter((x) => !(x.room === v.room && x.collection === v.collection && x.room !== 'upload'));
    state = { ...state, visualisations: [v, ...others].slice(0, 12) };
    emit();
  },
  removeVisualisation(id: string) {
    load();
    state = { ...state, visualisations: state.visualisations.filter((v) => v.id !== id) };
    emit();
  },
  addPlan(p: SavedPlan) {
    load();
    state = { ...state, plans: [p, ...state.plans.filter((x) => x.code !== p.code)].slice(0, 8) };
    emit();
  },
  removePlan(id: string) {
    load();
    state = { ...state, plans: state.plans.filter((p) => p.id !== id) };
    emit();
  },
  setStyle(s: SavedStyle | null) {
    load();
    state = { ...state, style: s };
    emit();
  },
  toggleProduct(id: string) {
    load();
    const has = state.products.includes(id);
    state = { ...state, products: has ? state.products.filter((p) => p !== id) : [...state.products, id] };
    emit();
  },
  addLead(l: LocalLead) {
    load();
    state = { ...state, leads: [l, ...state.leads].slice(0, 50) };
    emit();
  },
  clearDesign() {
    load();
    state = { ...EMPTY, leads: state.leads };
    emit();
  },
};

const serverSnapshot = () => EMPTY;

export function useMyDesign(): DesignState {
  return useSyncExternalStore(designStore.subscribe, designStore.get, serverSnapshot);
}

export function designCount(s: DesignState): number {
  return s.visualisations.length + s.plans.length + (s.style ? 1 : 0) + s.products.length;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
