import manifest from './data/renders.json';
import type { CollectionId } from './data/collections';

export interface RenderInfo {
  src: string;
  w: number;
  h: number;
  blur: string;
}

const m = manifest as Record<string, { w: number; h: number; blur: string }>;

export function render(name: string): RenderInfo | undefined {
  const r = m[name];
  return r ? { src: `/renders/${name}.webp`, w: r.w, h: r.h, blur: r.blur } : undefined;
}

/** Image order matches the art-direction notes in the dictionaries. */
export const collectionImages: Record<CollectionId, string[]> = {
  modern: ['room-a-modern', 'room-b-modern', 'room-c-modern', 'detail-modern'],
  classic: ['room-a-classic', 'room-b-classic', 'room-c-classic', 'detail-classic'],
  dark: ['room-b-dark-evening', 'room-a-dark', 'room-c-dark', 'detail-dark'],
  light: ['room-a-light', 'room-b-light', 'room-c-light', 'detail-light'],
  specials: ['room-b-specials', 'room-a-specials', 'room-c-specials', 'detail-specials'],
};

export type DemoRoom = 'a' | 'b' | 'c';
export const demoRooms: DemoRoom[] = ['a', 'b', 'c'];

export function roomImage(room: DemoRoom, collection: CollectionId | 'before'): string {
  return `room-${room}-${collection}`;
}
