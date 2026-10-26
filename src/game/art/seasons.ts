import { PixelBuffer } from "../pixel/PixelBuffer";
import { hash2, vnoise } from "../pixel/noise";
import type { Season } from "../world/calendar";
import type { TileKind } from "../world/tilemap";
import type { TileBuffer } from "./tiles";
import { getProp, type PropId, type PropSheet } from "./props";

/**
 * The year on the land: a pixel filter over painted sprites that turns the
 * greens of leaves and grass with the season. Spring freshens them and
 * scatters blossom, summer deepens them, autumn burns them gold and red, and
 * winter strips them grey and lays snow on every upward edge (crowns, roofs,
 * the tops of the ground). Painted art is never changed: filtered copies are
 * cached beside the originals.
 */

type RGB = [number, number, number];

function toHsl(r: number, g: number, b: number): RGB {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): RGB {
  h = (((h % 360) + 360) % 360) / 360;
  s = Math.max(0, Math.min(1, s));
  l = Math.max(0, Math.min(1, l));
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

const isLeaf = (h: number, s: number, l: number) => h >= 58 && h <= 178 && s > 0.12 && l > 0.05 && l < 0.88;
/** Pinks of blossom (cherry, peach): leafy for the rest of the year. */
const isBlossom = (h: number, s: number, l: number) => (h >= 295 || h <= 8) && s > 0.25 && l > 0.5;

const AUTUMN_HUES = [44, 32, 20, 8];
const SNOW: RGB = [244, 248, 255];
const SNOW_SHADE: RGB = [196, 210, 236];

/** The new colour of one leafy pixel (evergreens keep their needles through autumn, and only dull in the cold). */
function turnLeaf(season: Season, h: number, s: number, l: number, x: number, y: number, seed: number, blossom: boolean, evergreen = false): RGB | null {
  if (evergreen) {
    if (season === "autumn" || blossom) return null;
    if (season === "winter") return fromHsl(h + 12, s * 0.55, l * 0.82);
  }
  switch (season) {
    case "spring":
      if (blossom) return null;
      // fresh, yellow-green growth, with now and then a cluster of blossom
      if (hash2(x >> 1, y >> 1, seed + 3) < 0.05 && l > 0.25) return fromHsl(335, 0.7, 0.8);
      return fromHsl(h - 10, Math.min(1, s * 1.1), Math.min(0.9, l * 1.1 + 0.02));
    case "summer":
      if (blossom) return fromHsl(118, 0.5, l * 0.6);
      return fromHsl(h + 4, Math.min(1, s * 1.15), l * 0.92);
    case "autumn": {
      const n = vnoise(x / 5, y / 5, seed);
      const hue = AUTUMN_HUES[Math.min(3, Math.floor(n * 4))];
      return fromHsl(hue, Math.max(0.55, s), Math.min(0.75, l * (blossom ? 0.8 : 1.05)));
    }
    case "winter":
      return fromHsl(blossom ? 25 : 150, 0.12, l * (blossom ? 0.5 : 0.7));
  }
}

/** Snow lies along the top edge of whatever stands in the open: 1–3 px deep, deeper on broad flats. */
function snowcap(out: PixelBuffer, seed: number): void {
  const { width: w, height: h, data } = out;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      const above = y === 0 ? 0 : data[((y - 1) * w + x) * 4 + 3];
      if (above >= 128) continue;
      // an upward edge: the snow is laid on here, tapering off down steep sides
      const steep = (x > 0 && data[(y * w + x - 1) * 4 + 3] < 128) || (x < w - 1 && data[(y * w + x + 1) * 4 + 3] < 128);
      const depth = steep ? 1 : 2 + (hash2(x >> 1, y, seed) < 0.4 ? 1 : 0);
      for (let d = 0; d < depth && y + d < h; d++) {
        const k = ((y + d) * w + x) * 4;
        if (data[k + 3] < 128) break;
        const c = d === depth - 1 && depth > 1 ? SNOW_SHADE : SNOW;
        data[k] = c[0];
        data[k + 1] = c[1];
        data[k + 2] = c[2];
      }
    }
}

/** A seasonal copy of a sprite. `leaves` recolours foliage; `snow` lays a winter cap on top. */
export function seasonFilter(src: PixelBuffer, season: Season, opts: { leaves?: boolean; snow?: boolean; seed?: number; evergreen?: boolean }): PixelBuffer {
  const out = src.clone();
  const seed = opts.seed ?? 7;
  const d = out.data;
  if (opts.leaves)
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++) {
        const i = (y * out.width + x) * 4;
        if (d[i + 3] === 0) continue;
        const [h, s, l] = toHsl(d[i], d[i + 1], d[i + 2]);
        const blossom = isBlossom(h, s, l);
        if (!blossom && !isLeaf(h, s, l)) continue;
        const c = turnLeaf(season, h, s, l, x, y, seed, blossom, opts.evergreen);
        if (!c) continue;
        d[i] = c[0];
        d[i + 1] = c[1];
        d[i + 2] = c[2];
      }
  if (opts.snow && season === "winter") snowcap(out, seed);
  return out;
}

// ----------------------------------------------------------------------------- props
/** Props whose leaves turn with the year. */
const LEAFY = new Set<PropId>(["pine", "cherry", "bamboo", "willow", "tallgrass", "reeds", "peachtree", "teabush", "lotus", "herbbed", "palm", "haystack"]);
/** Leaves that stay on all year. */
const EVERGREEN = new Set<PropId>(["pine", "bamboo", "teabush", "palm"]);
/** Props that only take a cap of snow in winter (roofs, rocks, the red maples of the westwood). */
const SNOWY = new Set<PropId>(["maple", "deadtree", "rock", "boulder", "hall", "house", "pavilion", "gate", "teahouse", "pagoda", "stall", "tent", "stilthouse", "shrine", "stele", "lion", "well", "waterwheel", "fence", "fenceY", "karst", "ruin", "stupa", "cart", "barrels", "bench", "statue", "beehive", "grave", "scarecrow", "noodlecart", "lighthouse"]);

export const seasonal = (id: PropId) => LEAFY.has(id) || SNOWY.has(id);

const propCache = new Map<string, PropSheet>();

/** A prop as it looks in a season (the painted sheet itself when the season leaves it be). */
export function seasonalProp(id: PropId, k: number, season: Season | null): PropSheet {
  const base = getProp(id, k);
  if (!season || !seasonal(id)) return base;
  const leaves = LEAFY.has(id);
  if (!leaves && season !== "winter") return base;
  const key = `${id}*${k}/${season}`;
  let sheet = propCache.get(key);
  if (!sheet) {
    sheet = { ...base, frames: base.frames.map((f) => seasonFilter(f, season, { leaves, snow: id !== "lotus" && id !== "reeds", seed: id.length, evergreen: EVERGREEN.has(id) })) };
    propCache.set(key, sheet);
  }
  return sheet;
}

// ----------------------------------------------------------------------------- ground
const GRASSY = new Set<TileKind>(["grass", "meadow", "moss", "leaf"]);
const SNOWS_ON = new Set<TileKind>(["grass", "meadow", "moss", "leaf", "dirt", "plaza", "stairs", "redrock", "marble"]);

/** Whether a tile kind looks any different in this season. */
export const groundTurns = (kind: TileKind, season: Season) => (season === "winter" ? SNOWS_ON.has(kind) : season !== "summer" && GRASSY.has(kind));

/**
 * A tile's column in a season: its top diamond (rows 0–15 of the buffer)
 * greens or browns with the year, and in winter is laid with snow (patchy on
 * paths and paving, where feet and brooms keep it thin), with a lip of snow
 * over the edge of its walls.
 */
export function seasonTile(tb: TileBuffer, kind: TileKind, season: Season, i: number, j: number): TileBuffer {
  const out = tb.buf.clone();
  const d = out.data;
  const W = out.width;
  const grassy = GRASSY.has(kind);
  const patchy = !grassy && kind !== "redrock";
  for (let py = 0; py < Math.min(16, out.height); py++)
    for (let px = 0; px < W; px++) {
      const k = (py * W + px) * 4;
      if (d[k + 3] === 0) continue;
      const sx = px - 16 + 0.5;
      const sy = py + 0.5;
      const a = (sx / 16 + sy / 8) / 2;
      const b = (sy / 8 - sx / 16) / 2;
      if (a < 0 || b < 0 || a >= 1 || b >= 1) continue;
      const wx = i + a;
      const wy = j + b;
      let c: RGB | null = null;
      const [h, s, l] = toHsl(d[k], d[k + 1], d[k + 2]);
      if (season === "winter") {
        if (patchy && vnoise(wx * 1.3, wy * 1.3, 41) < 0.3) continue;
        const shadeK = 0.86 + l * 0.18 + (hash2(Math.floor(wx * 16), Math.floor(wy * 16), 43) < 0.08 ? -0.08 : 0);
        c = [SNOW[0] * shadeK, SNOW[1] * shadeK, Math.min(255, SNOW[2] * (shadeK + 0.04))];
      } else if (grassy && isLeaf(h, s, l)) {
        if (season === "spring") {
          const r = hash2(Math.floor(wx * 16), Math.floor(wy * 16), 47);
          c = r < 0.018 ? [255, 236, 120] : r < 0.03 ? [255, 210, 230] : fromHsl(h - 12, s * 1.1, Math.min(0.85, l * 1.12 + 0.02));
        } else {
          const n = vnoise(wx * 0.9, wy * 0.9, 45);
          c = fromHsl(n < 0.5 ? 46 : 34, Math.max(0.45, s * 0.9), l * (0.95 + n * 0.1));
        }
      }
      if (!c) continue;
      d[k] = c[0];
      d[k + 1] = c[1];
      d[k + 2] = c[2];
    }
  // a lip of snow hangs over the top of the walls
  if (season === "winter")
    for (let px = 0; px < W; px++) {
      const left = px < 16;
      const edgeY = Math.ceil(left ? 8 + px * 0.5 : 16 - (px - 15) * 0.5) + tb.sink;
      const n = 1 + (hash2(i * 32 + px, j, 49) < 0.3 ? 1 : 0);
      for (let dy = 0; dy < n; dy++) {
        const k = ((edgeY + dy) * W + px) * 4;
        if (edgeY + dy >= out.height || d[k + 3] === 0) break;
        d[k] = SNOW_SHADE[0];
        d[k + 1] = SNOW_SHADE[1];
        d[k + 2] = SNOW_SHADE[2];
      }
    }
  return { buf: out, sink: tb.sink };
}
