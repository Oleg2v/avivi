/**
 * The five collections named in the brief, with the finish recipes that drive
 * the 3D kitchens, the swatches and the style finder. Finish names are example
 * descriptions for the concept; Avivi's own catalogue names replace them.
 */
export type CollectionId = 'modern' | 'classic' | 'dark' | 'light' | 'specials';

export type MaterialKind =
  | 'lacquer'
  | 'oak'
  | 'paleOak'
  | 'walnut'
  | 'marble'
  | 'nero'
  | 'travertine'
  | 'stone'
  | 'quartz'
  | 'brass'
  | 'steel'
  | 'bronze';

export interface MaterialSpec {
  kind: MaterialKind;
  color: string;
  rough: number;
}

export interface Finish {
  front: MaterialSpec;
  tall: MaterialSpec;
  wall: MaterialSpec;
  island: MaterialSpec;
  counter: MaterialSpec;
  splash: MaterialSpec;
  handle: 'channel' | 'knob' | 'edge' | 'bar';
  handleMetal: MaterialSpec;
  frame: boolean;
  fluted: boolean;
  cornice: boolean;
  wallUnits: boolean;
  walls: string;
}

export interface CollectionDef {
  id: CollectionId;
  theme: 'light' | 'dark';
  /** UI palette for the collection page */
  palette: { bg: string; surface: string; ink: string; muted: string; accent: string; line: string };
  finish: Finish;
  swatches: MaterialSpec[];
}

const brass: MaterialSpec = { kind: 'brass', color: '#B48A4F', rough: 0.3 };

export const collections: CollectionDef[] = [
  {
    id: 'modern',
    theme: 'light',
    palette: { bg: '#EFEBE4', surface: '#E5E0D7', ink: '#1C1C1C', muted: '#5F5952', accent: '#9A7350', line: 'rgba(28,28,28,.14)' },
    finish: {
      front: { kind: 'lacquer', color: '#C8C1B5', rough: 0.56 },
      tall: { kind: 'oak', color: '#C9A27A', rough: 0.5 },
      wall: { kind: 'lacquer', color: '#C8C1B5', rough: 0.56 },
      island: { kind: 'oak', color: '#C9A27A', rough: 0.5 },
      counter: { kind: 'stone', color: '#D9D6D0', rough: 0.36 },
      splash: { kind: 'stone', color: '#D9D6D0', rough: 0.36 },
      handle: 'channel',
      handleMetal: { kind: 'bronze', color: '#3B342C', rough: 0.35 },
      frame: false,
      fluted: false,
      cornice: false,
      wallUnits: true,
      walls: '#E4DFD6',
    },
    swatches: [
      { kind: 'lacquer', color: '#C8C1B5', rough: 0.56 },
      { kind: 'oak', color: '#C9A27A', rough: 0.5 },
      { kind: 'stone', color: '#D9D6D0', rough: 0.36 },
      { kind: 'bronze', color: '#3B342C', rough: 0.35 },
    ],
  },
  {
    id: 'classic',
    theme: 'light',
    palette: { bg: '#F1EDE4', surface: '#E6E3D6', ink: '#1F211B', muted: '#5D5F52', accent: '#8C7347', line: 'rgba(31,33,27,.14)' },
    finish: {
      front: { kind: 'lacquer', color: '#C3C3AE', rough: 0.42 },
      tall: { kind: 'lacquer', color: '#C3C3AE', rough: 0.42 },
      wall: { kind: 'lacquer', color: '#C3C3AE', rough: 0.42 },
      island: { kind: 'lacquer', color: '#C3C3AE', rough: 0.42 },
      counter: { kind: 'marble', color: '#F0EDE8', rough: 0.1 },
      splash: { kind: 'lacquer', color: '#EDE6D8', rough: 0.1 },
      handle: 'knob',
      handleMetal: brass,
      frame: true,
      fluted: false,
      cornice: true,
      wallUnits: true,
      walls: '#EDE7DC',
    },
    swatches: [
      { kind: 'lacquer', color: '#C3C3AE', rough: 0.42 },
      { kind: 'marble', color: '#F0EDE8', rough: 0.1 },
      brass,
      { kind: 'oak', color: '#C9A27A', rough: 0.5 },
    ],
  },
  {
    id: 'dark',
    theme: 'dark',
    palette: { bg: '#121110', surface: '#1C1A18', ink: '#EDE6DA', muted: '#A39A8C', accent: '#C9A27A', line: 'rgba(237,230,218,.14)' },
    finish: {
      front: { kind: 'lacquer', color: '#252423', rough: 0.5 },
      tall: { kind: 'walnut', color: '#7C5436', rough: 0.42 },
      wall: { kind: 'lacquer', color: '#252423', rough: 0.5 },
      island: { kind: 'walnut', color: '#7C5436', rough: 0.42 },
      counter: { kind: 'nero', color: '#1C1B1A', rough: 0.14 },
      splash: { kind: 'nero', color: '#1C1B1A', rough: 0.14 },
      handle: 'edge',
      handleMetal: brass,
      frame: false,
      fluted: false,
      cornice: false,
      wallUnits: false,
      walls: '#8F877E',
    },
    swatches: [
      { kind: 'lacquer', color: '#252423', rough: 0.5 },
      { kind: 'walnut', color: '#7C5436', rough: 0.42 },
      { kind: 'nero', color: '#1C1B1A', rough: 0.14 },
      brass,
    ],
  },
  {
    id: 'light',
    theme: 'light',
    palette: { bg: '#F6F3EE', surface: '#ECE7DF', ink: '#1C1C1C', muted: '#625C55', accent: '#9A7350', line: 'rgba(28,28,28,.12)' },
    finish: {
      front: { kind: 'lacquer', color: '#F0ECE5', rough: 0.45 },
      tall: { kind: 'lacquer', color: '#F0ECE5', rough: 0.45 },
      wall: { kind: 'lacquer', color: '#F0ECE5', rough: 0.45 },
      island: { kind: 'paleOak', color: '#DCC19C', rough: 0.5 },
      counter: { kind: 'quartz', color: '#F3F1EC', rough: 0.16 },
      splash: { kind: 'lacquer', color: '#F4F2ED', rough: 0.1 },
      handle: 'bar',
      handleMetal: { kind: 'steel', color: '#CFCBC3', rough: 0.3 },
      frame: false,
      fluted: false,
      cornice: false,
      wallUnits: true,
      walls: '#F1EEE9',
    },
    swatches: [
      { kind: 'lacquer', color: '#F0ECE5', rough: 0.45 },
      { kind: 'paleOak', color: '#DCC19C', rough: 0.5 },
      { kind: 'quartz', color: '#F3F1EC', rough: 0.16 },
      { kind: 'steel', color: '#CFCBC3', rough: 0.3 },
    ],
  },
  {
    id: 'specials',
    theme: 'light',
    palette: { bg: '#EEEBE2', surface: '#E3E0D3', ink: '#1E211A', muted: '#5A5F50', accent: '#4D5B3A', line: 'rgba(30,33,26,.14)' },
    finish: {
      front: { kind: 'oak', color: '#C9A27A', rough: 0.5 },
      tall: { kind: 'lacquer', color: '#4D5B3A', rough: 0.5 },
      wall: { kind: 'lacquer', color: '#4D5B3A', rough: 0.5 },
      island: { kind: 'oak', color: '#C9A27A', rough: 0.5 },
      counter: { kind: 'travertine', color: '#D8C8AF', rough: 0.4 },
      splash: { kind: 'travertine', color: '#D8C8AF', rough: 0.4 },
      handle: 'knob',
      handleMetal: brass,
      frame: false,
      fluted: true,
      cornice: false,
      wallUnits: true,
      walls: '#ECE6DC',
    },
    swatches: [
      { kind: 'lacquer', color: '#4D5B3A', rough: 0.5 },
      { kind: 'oak', color: '#C9A27A', rough: 0.5 },
      { kind: 'travertine', color: '#D8C8AF', rough: 0.4 },
      brass,
    ],
  },
];

export const collectionIds = collections.map((c) => c.id);

export function getCollection(id: string | null | undefined): CollectionDef | undefined {
  return collections.find((c) => c.id === id);
}

export function isCollectionId(v: string | null | undefined): v is CollectionId {
  return !!v && collections.some((c) => c.id === v);
}
