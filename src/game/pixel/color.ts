/** RGBA tuple, each channel 0-255. */
export type RGBA = readonly [number, number, number, number];

const cache = new Map<string, RGBA>();

/** Parse `#rgb`, `#rrggbb` or `#rrggbbaa` into an RGBA tuple (memoised). */
export function parseColor(color: string): RGBA {
  const hit = cache.get(color);
  if (hit) return hit;
  let h = color.startsWith("#") ? color.slice(1) : color;
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  if (h.length !== 6 && h.length !== 8) throw new Error(`Invalid colour: ${color}`);
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) throw new Error(`Invalid colour: ${color}`);
  const rgba: RGBA =
    h.length === 6
      ? [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]
      : [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), parseInt(h.slice(6, 8), 16)];
  cache.set(color, rgba);
  return rgba;
}

const hex2 = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");

export function toHex([r, g, b, a]: RGBA): string {
  return a === 255 ? `#${hex2(r)}${hex2(g)}${hex2(b)}` : `#${hex2(r)}${hex2(g)}${hex2(b)}${hex2(a)}`;
}

/** Linear blend between two colours, t in [0,1]. */
export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  const k = Math.max(0, Math.min(1, t));
  return toHex([
    ca[0] + (cb[0] - ca[0]) * k,
    ca[1] + (cb[1] - ca[1]) * k,
    ca[2] + (cb[2] - ca[2]) * k,
    ca[3] + (cb[3] - ca[3]) * k,
  ]);
}

/** Same colour with a new alpha (0-1). */
export function alpha(color: string, a: number): string {
  const [r, g, b] = parseColor(color);
  return toHex([r, g, b, Math.round(Math.max(0, Math.min(1, a)) * 255)]);
}

/** Multiply the RGB channels (darken < 1 < lighten). */
export function shade(color: string, f: number): string {
  const [r, g, b, a] = parseColor(color);
  return toHex([r * f, g * f, b * f, a]);
}
