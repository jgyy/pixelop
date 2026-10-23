import { PixelBuffer } from "../pixel/PixelBuffer";
import { alpha, mix, shade } from "../pixel/color";
import { fbm, hash2, vnoise } from "../pixel/noise";
import { LEVEL_H, TILE_H, TILE_W } from "../iso/projection";
import { LIQUID, type TileKind, type TileMap } from "../world/tilemap";

/**
 * Terrain tiles are painted per pixel from continuous world-space textures,
 * so grass, flagstones, planks and sand flow seamlessly across tile borders.
 * Each tile is a column: a textured top diamond plus the two visible cliff
 * walls, with rim lighting where the ground drops and contact shadows where
 * it rises. Liquids get shared animated surfaces with per-tile shore foam.
 */

type Tex = (wx: number, wy: number) => string;

const pick = (tones: readonly string[], v: number) => tones[Math.max(0, Math.min(tones.length - 1, Math.floor(v * tones.length)))];

const GRASS = ["#3f7a34", "#4f9040", "#62a848", "#78bf55", "#93d566"];
const LEAF = ["#2a3a24", "#34482a", "#405a30", "#4f6a36"];
const DIRT = ["#7a5236", "#8f6440", "#a2774c", "#b48a5a"];
const SAND = ["#c8a86a", "#d8bc7c", "#e6cc8e", "#f0dca2"];
const STONE = ["#7a7690", "#8c88a2", "#9e9ab2", "#b0acc2"];
const MARBLE = ["#c8cce0", "#d8dcec", "#e6e8f4", "#f4f4fa"];
const SNOW = ["#c8d4ec", "#dce4f4", "#eef2fa", "#ffffff"];
const ASH = ["#241a2a", "#2e2234", "#3a2c40", "#46364c"];
const RED = ["#5a2420", "#6e2e24", "#84382a", "#9a4630"];
const FLOWERS = ["#ffffff", "#f6a6c9", "#ffe070", "#c8b5ea", "#ff8a8a"];

function grass(wx: number, wy: number, seed: number): string {
  const n = fbm(wx * 1.6, wy * 1.6, seed) * 0.75 + vnoise(wx * 7, wy * 7, seed + 9) * 0.25;
  const h = hash2(Math.floor(wx * 16), Math.floor(wy * 16), seed);
  if (h > 0.96) return GRASS[4];
  if (h < 0.03) return GRASS[0];
  return pick(GRASS, n * 1.15 - 0.05);
}

function slabs(wx: number, wy: number, seed: number, tones: readonly string[], size = 2): string {
  const sv = wy * size;
  const row = Math.floor(sv);
  const su = wx * size + (row % 2) * 0.5;
  const col = Math.floor(su);
  const fu = su - col;
  const fv = sv - row;
  if (fu < 0.07 || fv < 0.1) return shade(tones[0], 0.72);
  const h = hash2(col, row, seed);
  const n = vnoise(wx * 9, wy * 9, seed);
  let c = tones[1 + Math.floor(h * (tones.length - 1)) % (tones.length - 1)];
  if (n > 0.78) c = tones[tones.length - 1];
  if (fu > 0.9 || fv > 0.88) c = shade(c, 0.9);
  if (fu < 0.16 || fv < 0.2) c = mix(c, "#ffffff", 0.12);
  return c;
}

const TEX: Record<Exclude<TileKind, "void" | "water" | "deep" | "paddy" | "lava">, (seed: number) => Tex> = {
  grass: (seed) => (x, y) => grass(x, y, seed),
  meadow: (seed) => (x, y) => {
    const h = hash2(Math.floor(x * 16), Math.floor(y * 16), seed + 5);
    if (h > 0.955) return FLOWERS[Math.floor(hash2(Math.floor(x * 16), Math.floor(y * 16), seed + 6) * FLOWERS.length)];
    return grass(x, y, seed);
  },
  dirt: (seed) => (x, y) => {
    const h = hash2(Math.floor(x * 16), Math.floor(y * 16), seed);
    if (h > 0.97) return "#c8a070";
    if (h < 0.025) return "#5a3a28";
    return pick(DIRT, fbm(x * 2, y * 2, seed) * 1.1 - 0.05);
  },
  plaza: (seed) => (x, y) => slabs(x, y, seed, STONE),
  stairs: (seed) => (x, y) => {
    const s = (x + y) * 2;
    const f = s - Math.floor(s);
    if (f < 0.14) return "#4e4a62";
    if (f < 0.3) return STONE[3];
    return pick(STONE, 0.3 + vnoise(x * 8, y * 8, seed) * 0.5);
  },
  wood: (seed) => (x, y) => {
    const pv = y * 4;
    const plank = Math.floor(pv);
    const fv = pv - plank;
    const joint = (x + hash2(plank, 0, seed) * 3) % 1.5;
    if (fv < 0.14 || joint < 0.05) return "#4a2e20";
    const grain = vnoise(x * 3, pv * 6, seed + plank);
    const base = ["#8a5a36", "#9e6a40", "#b07a4a", "#c08a56"];
    return pick(base, grain * 0.8 + hash2(plank, 1, seed) * 0.25);
  },
  sand: (seed) => (x, y) => {
    const h = hash2(Math.floor(x * 16), Math.floor(y * 16), seed);
    if (h > 0.95) return "#fff0c0";
    if (h < 0.04) return "#a8885a";
    const ripple = Math.sin((x + y * 0.5) * 9 + fbm(x, y, seed) * 6) * 0.15;
    return pick(SAND, fbm(x * 2, y * 2, seed) + ripple);
  },
  leaf: (seed) => (x, y) => {
    const h = hash2(Math.floor(x * 16), Math.floor(y * 16), seed);
    if (h > 0.94) return ["#8a7a30", "#a06a2a", "#6a8a3a"][Math.floor(h * 300) % 3];
    return pick(LEAF, fbm(x * 2.4, y * 2.4, seed));
  },
  moss: (seed) => (x, y) => (fbm(x * 1.4, y * 1.4, seed + 3) > 0.55 ? grass(x, y, seed) : slabs(x, y, seed, STONE)),
  ash: (seed) => (x, y) => {
    const n = fbm(x * 1.3, y * 1.3, seed);
    if (Math.abs(n - 0.5) < 0.018) return "#ff7a2a";
    if (Math.abs(n - 0.5) < 0.035) return "#8a2a1a";
    return pick(ASH, vnoise(x * 6, y * 6, seed) * 0.9 + 0.05);
  },
  redrock: (seed) => (x, y) => {
    const n = fbm(x * 1.8, y * 1.8, seed);
    const h = hash2(Math.floor(x * 16), Math.floor(y * 16), seed);
    if (h > 0.97) return "#c86a40";
    return pick(RED, n);
  },
  marble: (seed) => (x, y) => {
    const v = Math.abs(Math.sin((x * 3 + fbm(x * 2, y * 2, seed) * 5) * 2));
    if (v < 0.06) return "#9aa0c0";
    return slabs(x, y, seed, MARBLE, 1.5);
  },
  snow: (seed) => (x, y) => {
    const h = hash2(Math.floor(x * 16), Math.floor(y * 16), seed);
    if (h > 0.985) return "#ffffff";
    return pick(SNOW, fbm(x * 1.8, y * 1.8, seed) * 0.9 + 0.1);
  },
  // the top of an interior wall: dark roof beams seen from above
  wall: (seed) => (x, y) => beam(x, y, seed),
  window: (seed) => (x, y) => beam(x, y, seed),
  rug: (seed) => (x, y) => {
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
    if (edge < 0.06) return "#5a1420";
    if (edge < 0.11) return "#e0b050";
    const d = Math.hypot(fx - 0.5, fy - 0.5);
    if (Math.abs(d - 0.24) < 0.04) return "#e0b050";
    if (d < 0.1) return hash2(Math.floor(x), Math.floor(y), seed) > 0.5 ? "#3a9a8a" : "#f0d080";
    const weave = vnoise(x * 24, y * 24, seed) > 0.62;
    return weave ? "#a83040" : "#922838";
  },
};

function beam(x: number, y: number, seed: number): string {
  const along = (x + y) * 3;
  const f = along - Math.floor(along);
  if (f < 0.12) return "#1e120c";
  return pick(["#3a2418", "#462c1e", "#523422"], vnoise(x * 4, y * 4, seed) * 0.9 + 0.05);
}

interface WallStyle {
  lip?: string;
  body: readonly string[];
  bricks?: boolean;
  posts?: boolean;
  /** Interior walls: timber frame, plaster, a wainscot and (some) lattice windows. */
  plaster?: boolean;
  window?: boolean;
}

const PLASTER = ["#e2d4ba", "#eadec8", "#d8c8ac"];


const WALLS: Record<TileKind, WallStyle> = {
  void: { body: STONE },
  grass: { lip: "#4f9040", body: ["#5a3a2a", "#6e4630", "#82563a"] },
  meadow: { lip: "#4f9040", body: ["#5a3a2a", "#6e4630", "#82563a"] },
  leaf: { lip: "#34482a", body: ["#3a2a22", "#4a3426", "#5a402e"] },
  dirt: { body: ["#5a3a2a", "#6e4630", "#82563a"] },
  plaza: { body: STONE, bricks: true },
  stairs: { body: STONE, bricks: true },
  moss: { lip: "#4f9040", body: STONE, bricks: true },
  wood: { body: ["#5a3a26", "#6e4a30", "#80583a"], posts: true },
  sand: { body: ["#a8885a", "#b8986a", "#c8a87a"] },
  ash: { body: ["#1a121e", "#241a2a", "#2e2234"] },
  redrock: { body: ["#4a1c1a", "#5a2420", "#6e2e24"] },
  marble: { body: MARBLE, bricks: true },
  snow: { lip: "#eef2fa", body: ["#7a7a9a", "#8a8aa8", "#9a9ab6"] },
  water: { body: ["#1a3a6a", "#22487a", "#2a568a"] },
  deep: { body: ["#10284a", "#18345a", "#1e406a"] },
  paddy: { body: ["#3a4a3a", "#4a5a40", "#5a6a48"] },
  lava: { body: ["#5a1010", "#8a1a10", "#c03010"] },
  wall: { body: PLASTER, plaster: true },
  window: { body: PLASTER, plaster: true, window: true },
  rug: { body: ["#5a1420", "#6a1a28", "#7a2030"] },
};

/** One pixel of a plastered interior wall face (`u` across the tile, `dy` down from the top, `len` the face height). */
function plasterPx(u: number, dy: number, len: number, col: number, seed: number, window: boolean): string {
  if (dy < 3) return dy === 2 ? "#1e120c" : "#3a2418";
  if (u < 0.07 || u > 0.94) return u < 0.03 ? "#24160e" : "#5a3420";
  const rail = Math.round(len * 0.62);
  if (dy >= len - 11) {
    if (dy === len - 11 || (col % 8 === 0 && dy < len - 2)) return "#2e1c12";
    return dy > len - 4 ? "#3a2418" : "#5a3a26";
  }
  if (dy === rail || dy === rail + 1) return "#4a2c1c";
  if (window && u > 0.2 && u < 0.8 && dy > 8 && dy < rail - 3) {
    if (u < 0.25 || u > 0.75 || dy < 10 || dy > rail - 6) return "#3a2418";
    const gx = Math.floor((u - 0.25) * 16 * 1.6);
    const gy = dy - 10;
    if (gx % 3 === 2 || gy % 4 === 3) return "#6a4028";
    return gy < 5 ? "#fff2c8" : "#ffe0a0";
  }
  return PLASTER[hash2(col, dy >> 1, seed) > 0.85 ? 2 : vnoise(col * 0.4, dy * 0.3, seed) > 0.7 ? 1 : 0];
}

export interface TileBuffer {
  buf: PixelBuffer;
  /** Pixels the top diamond is pushed down inside the buffer (sunken liquids). */
  sink: number;
}

/**
 * Paint the column for tile (i, j). The returned buffer's top corner sits at
 * x = 16, y = 0 for the tile's height; walls extend down to `base` (and much
 * further, as rocky undersides, at the rim of floating islands).
 */
export function paintTile(map: TileMap, i: number, j: number, base: number, seed: number, floating: boolean): TileBuffer {
  const kind = map.kind(i, j);
  const h = map.height(i, j);
  const liquid = LIQUID[kind];
  const sink = liquid ? 2 : 0;
  const voidFront = map.kind(i, j + 1) === "void" || map.kind(i + 1, j) === "void";
  const underside = floating && voidFront ? (kind === "wood" ? 5 : 40) : 0;
  // walls only need to reach down to the lower of the two tiles in front:
  // anything deeper is hidden behind those tiles' own columns
  const front = (di: number, dj: number) => (map.kind(i + di, j + dj) === "void" ? base : map.height(i + di, j + dj));
  const bottom = voidFront ? base : Math.max(base, Math.min(h, front(1, 0), front(0, 1)));
  const wallPx = Math.max(0, (h - bottom) * LEVEL_H) + underside + 2;
  const buf = new PixelBuffer(TILE_W, TILE_H + wallPx + 1);
  const tex = liquid ? null : TEX[kind as keyof typeof TEX](seed);
  const wall = WALLS[kind];
  const nH = (di: number, dj: number) => {
    const k = map.kind(i + di, j + dj);
    return k === "void" ? -99 : map.height(i + di, j + dj) - (LIQUID[k] ? 0.25 : 0);
  };
  const hSelf = h - (liquid ? 0.25 : 0);
  const dropR = nH(1, 0) < hSelf; // bottom-right edge
  const dropL = nH(0, 1) < hSelf; // bottom-left edge
  const riseTL = nH(-1, 0) > hSelf;
  const riseTR = nH(0, -1) > hSelf;

  // ---- top diamond
  if (tex) {
    for (let py = 0; py < TILE_H; py++)
      for (let px = 0; px < TILE_W; px++) {
        const sx = px - 16 + 0.5;
        const sy = py + 0.5;
        const a = (sx / 16 + sy / 8) / 2;
        const b = (sy / 8 - sx / 16) / 2;
        if (a < 0 || b < 0 || a >= 1 || b >= 1) continue;
        let c = tex(i + a, j + b);
        if ((dropR && a > 0.93) || (dropL && b > 0.93)) c = mix(c, "#fff6d8", 0.35);
        else if ((riseTL && a < 0.12) || (riseTR && b < 0.12)) c = shade(c, 0.72);
        buf.px(px, py, c);
      }
  }

  // ---- walls
  for (let px = 0; px < TILE_W; px++) {
    const left = px < 16;
    const edgeY = left ? 8 + px * 0.5 : 16 - (px - 15) * 0.5;
    const along = left ? i + px / 16 : j + 1 - (px - 16) / 16;
    const col = Math.floor(along * 16);
    const lipLen = wall.lip ? 1 + Math.floor(hash2(col, Math.floor(along), seed + 7) * 3) : 0;
    const taper = underside ? Math.floor(wallPx - underside + underside * (0.35 + 0.65 * hash2(col >> 1, 3, seed))) : wallPx;
    const light = left ? 0.95 : 0.72;
    const top = Math.ceil(edgeY) + sink;
    for (let dy = 0; dy < taper; dy++) {
      const py = top + dy;
      if (py >= buf.height) break;
      let c: string;
      if (liquid) {
        c = pick(wall.body, 1 - dy / Math.max(1, wallPx));
      } else if (wall.plaster) {
        c = plasterPx(along - Math.floor(along), dy, wallPx - 2, col, seed, !!wall.window);
      } else if (dy < lipLen) {
        c = wall.lip!;
      } else if (wall.bricks) {
        const course = Math.floor((dy + 2) / 4);
        const bx = Math.floor((col + (course % 2) * 4) / 8);
        const mortar = (dy + 2) % 4 === 0 || (col + (course % 2) * 4) % 8 === 0;
        c = mortar ? shade(wall.body[0], 0.6) : wall.body[1 + (hash2(bx, course, seed) > 0.6 ? 1 : 0)];
      } else if (wall.posts) {
        c = col % 6 === 0 ? shade(wall.body[0], 0.7) : wall.body[1 + (col % 6 > 3 ? 1 : 0)];
      } else {
        const strata = Math.floor((dy + vnoise(along * 3, 0, seed) * 4) / 5);
        c = wall.body[(strata + (hash2(col, strata, seed) > 0.85 ? 1 : 0)) % wall.body.length];
        if (hash2(col, dy, seed + 2) > 0.97) c = shade(c, 1.25);
      }
      if (dy > wallPx - underside) c = shade(c, 0.8 - ((dy - (wallPx - underside)) / underside) * 0.35);
      buf.px(px, py, shade(c, light));
    }
    // dark crease where the two walls meet
    if (px === 15 || px === 16) for (let dy = 1; dy < taper; dy++) buf.px(px, top + dy, alpha("#000000", 0.18));
  }
  return { buf, sink };
}

// ----------------------------------------------------------------------------- liquids
export const LIQUID_FRAMES = 8;

const WATER = ["#1e4a8a", "#2a62a6", "#3a7cc0", "#5aa0da"];
const LAVA = ["#8a1414", "#c8301a", "#f0601e", "#ffb040"];
const PADDY = ["#2e5a5a", "#3a6e64", "#4a8270", "#62987a"];

const liquidCache = new Map<string, PixelBuffer>();

/** Shared animated surface (seamless: every wave has whole periods per tile). */
export function liquidFrame(kind: "water" | "lava" | "paddy", frame: number, deep = false): PixelBuffer {
  const key = `${kind}/${frame}/${deep}`;
  let b = liquidCache.get(key);
  if (b) return b;
  b = new PixelBuffer(TILE_W, TILE_H);
  const ph = (frame / LIQUID_FRAMES) * Math.PI * 2;
  const tones = kind === "lava" ? LAVA : kind === "paddy" ? PADDY : deep ? WATER.map((c) => shade(c, 0.78)) : WATER;
  for (let py = 0; py < TILE_H; py++)
    for (let px = 0; px < TILE_W; px++) {
      const sx = px - 16 + 0.5;
      const sy = py + 0.5;
      const a = (sx / 16 + sy / 8) / 2;
      const c2 = (sy / 8 - sx / 16) / 2;
      if (a < 0 || c2 < 0 || a >= 1 || c2 >= 1) continue;
      const T = Math.PI * 2;
      let v: number;
      if (kind === "lava") {
        v = 0.5 + 0.28 * Math.sin(T * (a + c2) + ph) + 0.22 * Math.sin(T * (2 * a - c2) - ph) * Math.sin(T * c2 + ph * 0.5);
      } else {
        v = 0.5 + 0.25 * Math.sin(T * (2 * a + c2) + ph) + 0.2 * Math.sin(T * (a - 2 * c2) - ph);
      }
      let c = pick(tones, v * 0.95);
      if (kind !== "lava") {
        const glint = Math.sin(T * (3 * a + 2 * c2) + ph * 2) > 0.985;
        if (glint) c = "#d8f0ff";
      } else if (v > 0.9) c = "#ffe080";
      if (kind === "paddy" && Math.abs(((a * 4) % 1) - 0.5) < 0.06 && ((c2 * 4) % 1) < 0.45) c = (c2 * 4) % 1 < 0.2 ? "#a8e070" : "#6ab048";
      b.px(px, py, c);
    }
  liquidCache.set(key, b);
  return b;
}

/** Shoreline foam (or lava crust) where a liquid tile meets solid ground. */
export function foamOverlay(map: TileMap, i: number, j: number): PixelBuffer | null {
  const kind = map.kind(i, j);
  const liquid = LIQUID[kind];
  if (!liquid) return null;
  const solid = (di: number, dj: number) => {
    const k = map.kind(i + di, j + dj);
    return k !== "void" && !LIQUID[k];
  };
  const e = { tl: solid(-1, 0), tr: solid(0, -1), br: solid(1, 0), bl: solid(0, 1) };
  if (!e.tl && !e.tr && !e.br && !e.bl) return null;
  const b = new PixelBuffer(TILE_W, TILE_H);
  const col = liquid === "lava" ? "#2a1010" : "#e8f6ff";
  for (let py = 0; py < TILE_H; py++)
    for (let px = 0; px < TILE_W; px++) {
      const sx = px - 16 + 0.5;
      const sy = py + 0.5;
      const a = (sx / 16 + sy / 8) / 2;
      const c2 = (sy / 8 - sx / 16) / 2;
      if (a < 0 || c2 < 0 || a >= 1 || c2 >= 1) continue;
      const d = Math.min(e.tl ? a : 9, e.br ? 1 - a : 9, e.tr ? c2 : 9, e.bl ? 1 - c2 : 9);
      const wob = hash2(px, py, i * 31 + j) * 0.08;
      if (d < 0.07 + wob) b.px(px, py, alpha(col, 0.85));
      else if (d < 0.16 + wob && hash2(px, py, 77 + i + j) > 0.5) b.px(px, py, alpha(col, 0.4));
    }
  return b;
}
