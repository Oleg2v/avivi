/**
 * Mediterranean coastline of Israel (Rosh HaNikra to Ashkelon), from Natural Earth 1:10m
 * land polygons (public domain), simplified. Coastline only: no borders are drawn.
 * Regenerate with scripts/geo/coast.mjs.
 */
export const coast = {
 "width": 520,
 "height": 718,
 "bbox": [
  34.3,
  31.58,
  35.62,
  33.12
 ],
 "k": 0.8447952010360832,
 "s": 466.3134845655542,
 "d": "M317.4 3.8L314.6 8.5L316.0 10.1L316.0 11.7L317.4 11.7L317.4 14.8L314.6 14.8L317.4 18.0L311.7 24.3L313.2 32.1L311.7 41.6L306.1 56.5L301.8 92.0L306.1 94.3L307.5 99.9L300.4 121.9L286.2 136.9L283.4 137.7L277.7 136.1L269.2 131.4L263.5 129.8L257.9 132.9L255.0 142.4L253.6 184.1L243.7 222.7L245.1 229.0L242.3 235.3L240.8 256.5L238.0 260.5L225.2 321.9L212.5 391.2L179.9 491.2L174.2 494.3L175.6 501.4L174.2 503.8L162.8 544.7L154.3 556.6L144.4 581.0L121.7 631.4L84.8 695.9L74.9 708.5L72.1 716.4"
} as const;

export function project(lon: number, lat: number): [number, number] {
  const [lon0, , , lat1] = coast.bbox;
  return [(lon - lon0) * coast.k * coast.s, (lat1 - lat) * coast.s];
}
