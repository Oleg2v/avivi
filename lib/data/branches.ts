/**
 * The six showrooms named in the brief. Coordinates are approximate city centres
 * used only to place the dot on the map. Addresses and hours are EXAMPLE data.
 */
export type BranchId = 'rishon' | 'herzliya' | 'bnei-brak' | 'bnei-darom' | 'karmiel' | 'kiryat-ata';

export interface Branch {
  id: BranchId;
  lat: number;
  lon: number;
  isNew?: boolean;
  factory?: boolean;
  /** Search phrase used for Google Maps / Waze links (real search, not an invented address). */
  mapQuery: { he: string; en: string };
}

export const branches: Branch[] = [
  { id: 'karmiel', lat: 32.919, lon: 35.295, factory: true, mapQuery: { he: 'אביבי מטבחים כרמיאל', en: 'Avivi Kitchens Karmiel' } },
  { id: 'kiryat-ata', lat: 32.809, lon: 35.106, isNew: true, mapQuery: { he: 'אביבי מטבחים קריית אתא', en: 'Avivi Kitchens Kiryat Ata' } },
  // Herzliya Pituach sits on the shore; the dot is drawn a little inland so it never covers the coastline.
  { id: 'herzliya', lat: 32.163, lon: 34.83, mapQuery: { he: 'אביבי מטבחים הרצליה פיתוח', en: 'Avivi Kitchens Herzliya Pituach' } },
  { id: 'bnei-brak', lat: 32.084, lon: 34.834, mapQuery: { he: 'אביבי מטבחים בני ברק', en: 'Avivi Kitchens Bnei Brak' } },
  { id: 'rishon', lat: 31.964, lon: 34.804, mapQuery: { he: 'אביבי מטבחים ראשון לציון', en: 'Avivi Kitchens Rishon LeZion' } },
  { id: 'bnei-darom', lat: 31.819, lon: 34.693, factory: true, mapQuery: { he: 'אביבי מטבחים בני דרום', en: 'Avivi Kitchens Bnei Darom' } },
];

export const branchIds = branches.map((b) => b.id);

export function getBranch(id: string | null | undefined): Branch | undefined {
  return branches.find((b) => b.id === id);
}

export function mapsUrl(b: Branch, locale: 'he' | 'en' | 'ru' | 'fr') {
  const q = locale === 'he' ? b.mapQuery.he : b.mapQuery.en;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function wazeUrl(b: Branch) {
  return `https://waze.com/ul?q=${encodeURIComponent(b.mapQuery.he)}&navigate=yes`;
}

/** Example opening hours: Sun–Thu 10:00–20:00, Fri 09:00–13:00, Sat closed. */
export const exampleHours = {
  weekday: { open: '10:00', close: '20:00' },
  friday: { open: '09:00', close: '13:00' },
};

/** Example time slots for the booking demo. */
export function exampleSlots(date: Date): string[] {
  const day = date.getDay(); // 0 Sun ... 6 Sat
  if (day === 6) return [];
  if (day === 5) return ['09:00', '10:00', '11:00', '12:00'];
  return ['10:00', '11:00', '12:00', '13:30', '15:00', '16:30', '18:00', '19:00'];
}
