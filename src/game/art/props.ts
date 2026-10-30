import { PixelBuffer } from "../pixel/PixelBuffer";
import { alpha, mix } from "../pixel/color";
import { fbm, hash2 } from "../pixel/noise";
import { add, LEVEL_U, Raster, spline, TILE_U, WORLD_BASIS, type Mat, type Ramp, type Shader, type V3 } from "../iso/raster";
import { OUTLINE, PAL, ramp, tones } from "./palette";

/**
 * World props — trees, lanterns, halls, shrines — ray cast in world-aligned
 * model space (1 tile = TILE_U units, 1 height level = LEVEL_U units).
 * Animated props (swaying trees, flickering fire, waving banners, bobbing
 * lotuses) render several frames; all frames are auto-cropped to a shared box.
 */

export interface PropSheet {
  frames: PixelBuffer[];
  fps: number;
  /** Screen offset of the prop's ground anchor inside each frame. */
  ox: number;
  oy: number;
}

export interface Light {
  color: string;
  radius: number;
  /** Height of the light source above the anchor, in screen px. */
  dy: number;
}

export type Emitter = "petals" | "smoke" | "embers" | "sparkle" | "mist" | "leaves" | "incense" | "steam" | "dust";

export interface PropDef {
  /** Footprint in tiles relative to the anchor tile (inclusive). */
  foot: [number, number, number, number];
  blocks: boolean;
  frames: number;
  fps: number;
  light?: Light;
  emit?: Emitter;
  /** Lies flat on the floor (mats, cushions): always drawn beneath whoever stands on it. */
  flat?: boolean;
  /**
   * Drawn this many times the size it is modelled at, wherever it stands, while
   * its footprint stays as it is (trees grow tall over a one-tile trunk).
   */
  size?: number;
  paint: (r: Raster, f: number, n: number) => void;
}

const T = TILE_U;
const L = LEVEL_U;
const TAU = Math.PI * 2;

const m = (ramp: Ramp, group = 0, extra: Partial<Mat> = {}): Mat => ({ ramp, group, outline: OUTLINE, ...extra });
const md = (ramp: Ramp, group = 0, extra: Partial<Mat> = {}): Mat => m(ramp, group, { dither: true, ...extra });

const LEAVES = ramp("#4a8a3a", { lo: "#123a2a" });
const PINE = ramp("#2e6a4a", { lo: "#0a2a2a" });
const BLOSSOM = tones("#fff0f6", "#f8bcd6", "#e48ab4", "#a85a8a");
const MAPLE = tones("#ffd070", "#f08a3a", "#c04a2a", "#7a2030");
const BAMBOO = ramp("#7ab848", { lo: "#1a4a2a" });
const BARK = ramp("#6a4a3a", { lo: "#20141a" });
const ROOF_TEAL = ramp("#3a8a8a", { lo: "#10304a" });
const ROOF_GREY = ramp("#5a5a72", { lo: "#1a1a2a" });
const ROOF_RED = ramp("#a83a3a", { lo: "#3a0a20" });
const PILLAR = ramp("#c03a32", { lo: "#4a0a1a" });
const WALL = ramp("#f2e8d6", { lo: "#8a7a8a" });
const BRONZE = ramp("#b08a40", { lo: "#3a2a1a" });
const FIRE = tones("#fff6c0", "#ffb040", "#f0601e", "#a81a10");

const leafShader =
  (r: Ramp, seed: number): Shader =>
  (s, tone) => {
    const n = fbm(s.p[0] * 0.5 + seed, s.p[1] * 0.5 + s.p[2] * 0.3, seed);
    return tone(r, n > 0.62 ? -1 : n < 0.36 ? 1 : 0);
  };

/** Wind sway offset in world-aligned model space (screen-horizontal), growing with height. */
const swayAt = (f: number, n: number, z: number, amp: number): V3 => {
  const s = Math.sin((f / n) * TAU) * amp * (z / 60);
  return [s * 0.7, -s * 0.7, 0];
};

function roofTiles(base: Ramp): Shader {
  return (s, tone) => {
    const along = (s.p[0] - s.p[1]) * 0.35;
    if (Math.sin(along * 2.2) > 0.75) return tone(base, 1);
    return tone(base);
  };
}

/**
 * The everyday wear of a lived-in house, outside its east-facing door: a
 * stone step, a lean-to over the door, the New Year couplets either side of
 * it, a red lantern, rafter ends under the eaves, curled ridge ends, a capped
 * chimney, a flower box under the window, a water vat and a stack of firewood.
 */
function houseDetails(r: Raster, cx: number, cy: number, W: number, eave: number, roof: Ramp): void {
  r.box([cx + W + 1, cy - 5, 0], [cx + W + 4, cy + 5, 1.6], m(PAL.stone, 13));
  r.hipRoof(cx + W, cy, 5, 7.5, eave - 6, 1, 6.5, eave - 2.5, md(roof, 14, { shader: roofTiles(roof) }));
  for (const o of [-6.5, 5]) r.box([cx + W, cy + o, 5], [cx + W + 0.7, cy + o + 1.5, eave - 7], m(PAL.red, 15, { shader: (q, tone) => (Math.abs(((q.p[2] + 1) % 3) - 1.5) < 0.45 ? tone(PAL.gold) : tone(PAL.red)) }));
  r.box([cx + W, cy - 4.5, eave - 6.8], [cx + W + 0.7, cy + 4.5, eave - 5.4], m(PAL.red, 15));
  r.sweep([[cx + W + 4, cy + 8, eave - 2], [cx + W + 4, cy + 8, eave - 5]], 0.2, m(PAL.black, 16));
  r.sphere([cx + W + 4, cy + 8, eave - 7], 1.8, m(PAL.red, 16));
  r.box([cx + W + 3.2, cy + 7.2, eave - 9.4], [cx + W + 4.8, cy + 8.8, eave - 8.6], m(PAL.gold, 16));
  for (let o = -W + 1; o <= W - 1; o += 3.6) {
    r.box([cx + W + 4.4, cy + o - 0.5, eave + 0.6], [cx + W + 6, cy + o + 0.5, eave + 1.6], m(PAL.woodDark, 17));
    r.box([cx + o - 0.5, cy + W + 4.4, eave + 0.6], [cx + o + 0.5, cy + W + 6, eave + 1.6], m(PAL.woodDark, 17));
  }
  for (const sx of [-1, 1]) r.sweep([[cx + sx * W * 0.6, cy, eave + 16.5], [cx + sx * (W * 0.6 + 2.5), cy, eave + 17.5], [cx + sx * (W * 0.6 + 3.2), cy, eave + 20]], [1.2, 0.9, 0.5], m(PAL.black, 4));
  r.box([cx + 5.4, cy - 9.6, eave + 20], [cx + 10.6, cy - 4.4, eave + 21.4], m(PAL.stone, 5));
  r.box([cx + 1, cy + W, 8.4], [cx + 9, cy + W + 2.6, 10.4], m(PAL.wood, 18));
  for (let k = 0; k < 4; k++) r.sphere([cx + 2 + k * 2, cy + W + 1.3, 11], 1.1, m(k % 2 ? PAL.red : ramp("#e8d060"), 19));
  r.prism(cx + W + 3, cy - W + 2.5, 2.6, 0, 6, 8, m(ramp("#6a4a3a", { lo: "#20141a" }), 20));
  r.prism(cx + W + 3, cy - W + 2.5, 2.1, 5.6, 6.1, 8, m(ramp("#4a7aa8"), 21));
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 3 - row; k++) r.sweep([[cx - W + 1, cy + W + 2.2 + k * 2.2 + row * 1.1, 1.1 + row * 1.9], [cx - 6, cy + W + 2.2 + k * 2.2 + row * 1.1, 1.1 + row * 1.9]], 1, m(PAL.wood, 22, { shader: (q, tone) => (q.u < 0.04 || q.u > 0.96 ? tone(PAL.straw) : tone(PAL.wood)) }));
}

/** A low railing of posts and a top rail along a straight run, as a balcony or terrace edge has. */
function railing(r: Raster, a: V3, b: V3, mat: Mat, high = 4, gap = 3.2): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.round(len / gap));
  for (let k = 0; k <= n; k++) {
    const p: V3 = [a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n, a[2]];
    r.sweep([p, add(p, [0, 0, high])], 0.45, mat);
  }
  r.sweep([add(a, [0, 0, high]), add(b, [0, 0, high])], 0.6, mat);
  if (high > 3) r.sweep([add(a, [0, 0, high * 0.45]), add(b, [0, 0, high * 0.45])], 0.35, mat);
}

const PROPS = {
  pine: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.6,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [1, -1, 18], add([0, 0, 30], swayAt(f, n, 30, 1.5))], [2.6, 2, 1.4], m(BARK, 1));
      for (let i = 0; i < 4; i++) {
        const z = 16 + i * 10;
        const sw = swayAt(f, n, z, 2);
        r.cone(sw[0], sw[1], 13 - i * 2.6, z, 2 - i * 0.3, z + 14, 9, md(PINE, 2 + i, { shader: leafShader(PINE, i) }), i * 0.4);
      }
    },
  },
  cherry: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.4,
    frames: 6,
    fps: 4,
    emit: "petals",
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [1, 0, 14], [-2, 3, 24]], [2.8, 2.2, 1.4], m(BARK, 1));
      r.sweep([[1, 0, 14], [7, -4, 26]], [1.6, 0.9], m(BARK, 1));
      const blobs: [number, number, number, number][] = [
        [-4, 4, 30, 9],
        [7, -4, 30, 8.5],
        [2, -1, 36, 9],
        [-5, -5, 32, 7],
        [6, 5, 31, 7],
      ];
      blobs.forEach(([x, y, z, rr], k) => r.sphere(add([x, y, z], swayAt(f, n, z, 1.8)), rr, md(BLOSSOM, 2 + k, { shader: leafShader(BLOSSOM, k + 3) })));
    },
  },
  maple: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.6,
    frames: 6,
    fps: 4,
    emit: "leaves",
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 16], [2, -2, 24]], [2.6, 2, 1.4], m(BARK, 1));
      const blobs: [number, number, number, number][] = [
        [0, 0, 34, 10],
        [-6, 3, 28, 7.5],
        [6, -3, 28, 7.5],
        [3, 5, 30, 6.5],
      ];
      blobs.forEach(([x, y, z, rr], k) => r.sphere(add([x, y, z], swayAt(f, n, z, 1.6)), rr, md(MAPLE, 2 + k, { shader: leafShader(MAPLE, k + 7) })));
    },
  },
  bamboo: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 1.8,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      const stalks: [number, number, number][] = [
        [-5, 3, 74],
        [4, -4, 82],
        [0, 6, 66],
        [6, 4, 70],
        [-4, -5, 78],
      ];
      stalks.forEach(([x, y, hgt], k) => {
        const ph = (f / n) * TAU + k;
        const top: V3 = [x + Math.sin(ph) * 2.2, y - Math.sin(ph) * 2.2, hgt];
        const mid: V3 = [x + Math.sin(ph) * 0.8, y - Math.sin(ph) * 0.8, hgt * 0.5];
        r.sweep([[x, y, 0], mid, top], [1.2, 1.0, 0.7], m(BAMBOO, 1 + k, { shader: (s, tone) => (Math.abs(((s.p[2] + k * 3) % 11) - 0.5) < 0.7 ? tone(BAMBOO, 1) : tone(BAMBOO)) }));
        for (let l = 0; l < 3; l++) {
          const lz = hgt * (0.55 + l * 0.17);
          const base: V3 = [x + Math.sin(ph) * (lz / hgt) * 2, y - Math.sin(ph) * (lz / hgt) * 2, lz];
          const dir = (k + l) % 2 ? 1 : -1;
          r.sweep([base, add(base, [dir * 6, dir * 2, -3]), add(base, [dir * 9, dir * 3, -7])], [0.4, 1.3, 0.3], m(LEAVES, 6 + k));
        }
      });
    },
  },
  willow: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.8,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [-1, 1, 14], [0, 0, 26]], [3, 2.4, 1.8], m(BARK, 1));
      r.ellipsoid([0, 0, 32], [10, 10, 6], md(ramp("#7ab060", { lo: "#1a3a2a" }), 2, { shader: leafShader(ramp("#7ab060", { lo: "#1a3a2a" }), 2) }));
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * TAU;
        const sw = Math.sin((f / n) * TAU + k * 0.7) * 1.8;
        const top: V3 = [Math.cos(a) * 8.5, Math.sin(a) * 8.5, 30];
        r.sweep([top, add(top, [sw * 0.6, -sw * 0.6, -12]), add(top, [sw * 1.2, -sw * 1.2, -20 - (k % 3) * 2])], [1.1, 0.8, 0.4], m(ramp("#8ac46a", { lo: "#1a3a2a" }), 3));
      }
    },
  },
  deadtree: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.0,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const bark = ramp("#4a3a4a", { lo: "#0a060e" });
      r.sweep(spline([[0, 0, 0], [2, -1, 12], [-2, 1, 24], [1, 0, 34]], 3), [3, 2.2, 1.4, 0.5], m(bark, 1));
      r.sweep(spline([[1, -1, 14], [7, -3, 20], [10, -2, 27]], 3), [1.3, 0.9, 0.3], m(bark, 1));
      r.sweep(spline([[-2, 1, 22], [-8, 3, 27], [-9, 6, 33]], 3), [1.1, 0.7, 0.2], m(bark, 1));
    },
  },
  spirittree: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.4,
    frames: 8,
    fps: 5,
    light: { color: "#9ff5de", radius: 46, dy: 40 },
    emit: "sparkle",
    paint: (r, f, n) => {
      r.sweep(spline([[0, 0, 0], [-2, 2, 16], [1, -1, 30], [0, 0, 40]], 3), [5, 3.6, 2.6, 1.8], m(ramp("#8a7a9a", { lo: "#1a1030" }), 1));
      const canopy = tones("#e6fff8", "#7ae0c8", "#3a9a9a", "#1a4a5a");
      const blobs: [number, number, number, number][] = [
        [0, 0, 50, 13],
        [-11, 5, 42, 9],
        [10, -6, 43, 9],
        [5, 9, 45, 8],
        [-6, -9, 46, 8],
      ];
      blobs.forEach(([x, y, z, rr], k) => r.sphere(add([x, y, z], swayAt(f, n, z, 1)), rr, md(canopy, 2 + k, { shader: leafShader(canopy, k + 11) })));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + (f / n) * TAU * 0.25;
        r.sphere([Math.cos(a) * 14, Math.sin(a) * 14, 34 + Math.sin(a * 2 + f) * 2], 1.3, m(PAL.gold, 9));
      }
    },
  },
  rock: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const st = md(PAL.stone, 1, { shader: (s, tone) => (fbm(s.p[0] * 0.4, s.p[1] * 0.4 + s.p[2] * 0.4, 3) > 0.6 ? tone(ramp("#6a8a5a"), 0) : tone(PAL.stone)) });
      r.sphere([0, 0, 4], 7.5, st);
      r.sphere([5, -3, 3], 5, st);
      r.sphere([-4, 4, 2], 4.5, st);
      r.sphere([1, 1, 9], 4.5, st);
    },
  },
  boulder: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const st = md(ramp("#5a4458", { lo: "#120814" }), 1);
      r.sphere([0, 0, 6], 9, st);
      r.sphere([6, 4, 3], 5, st);
      r.cone(-3, -2, 5, 8, 0.5, 22, 5, m(ramp("#3a2a3a", { lo: "#0a040a" }), 2));
    },
  },
  crystal: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 6,
    light: { color: "#9ff5de", radius: 30, dy: 14 },
    emit: "sparkle",
    paint: (r, f, n) => {
      const glow = Math.sin((f / n) * TAU) * 0.5 + 0.5;
      const c = tones("#ffffff", mix("#7ae8d0", "#c0fff0", glow), "#3aa8a0", "#1a5a6a");
      const shards: [number, number, number, number, number][] = [
        [0, 0, 26, 4, 0],
        [5, -2, 16, 3, 0.5],
        [-4, 3, 18, 3, 1],
        [3, 5, 12, 2.4, 0.2],
      ];
      shards.forEach(([x, y, hgt, rr, rot], k) => {
        r.prism(x, y, rr, 0, hgt * 0.75, 6, m(c, k + 1), rot);
        r.cone(x, y, rr, hgt * 0.75, 0.2, hgt, 6, m(c, k + 1), rot);
      });
    },
  },
  lantern: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 6,
    light: { color: "#ffd070", radius: 34, dy: 22 },
    paint: (r, f) => {
      const st = m(PAL.stone, 1);
      r.prism(0, 0, 5, 0, 3, 6, st);
      r.prism(0, 0, 2, 3, 13, 6, st);
      r.prism(0, 0, 4.5, 13, 15, 6, st);
      const flick = [0.95, 1, 0.85, 1][f];
      const glow = tones("#ffffff", mix("#ffd070", "#fff6c0", flick - 0.8), "#f0a040", "#a05020");
      r.box([-3, -3, 15], [3, 3, 22], m(PAL.stone, 2, { shader: (s, tone) => (Math.abs(s.n[2]) < 0.5 && Math.abs(s.p[2] - 18.5) < 2.2 && (Math.abs(s.p[0]) < 1.6 || Math.abs(s.p[1]) < 1.6) ? glow[1] : tone(PAL.stone)) }));
      r.cone(0, 0, 7, 22, 1, 27, 6, st);
      r.sphere([0, 0, 28], 1.4, st);
    },
  },
  redlantern: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 5,
    light: { color: "#ff7050", radius: 30, dy: 30 },
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 42]], 1.2, m(PAL.woodDark, 1));
      r.sweep([[0, 0, 40], [7, -7, 40]], 0.8, m(PAL.woodDark, 1));
      const sw = Math.sin((f / n) * TAU) * 1.5;
      const c: V3 = [7 + sw, -7 - sw, 32];
      r.sweep([[7, -7, 40], add(c, [0, 0, 4])], 0.25, m(PAL.black, 2));
      r.ellipsoid(c, [3.4, 3.4, 4.2], m(tones("#ffd0a0", "#e84a3a", "#a82030", "#5a0a20"), 3, { shader: (s, tone) => (Math.abs(s.p[2] - c[2]) > 3.4 ? tone(PAL.gold) : s.lum > 0.4 ? "#ff8a6a" : tone(PAL.red)) }));
      r.sweep([add(c, [0, 0, -4]), add(c, [sw * 0.5, -sw * 0.5, -8])], 0.5, m(PAL.gold, 3));
    },
  },
  brazier: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 10,
    light: { color: "#ff6030", radius: 40, dy: 18 },
    emit: "embers",
    paint: (r, f, n) => {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU;
        r.sweep([[Math.cos(a) * 5, Math.sin(a) * 5, 0], [Math.cos(a) * 3, Math.sin(a) * 3, 11]], 0.9, m(PAL.black, 1));
      }
      r.cone(0, 0, 4, 9, 7, 15, 8, m(BRONZE, 2));
      for (let k = 0; k < 7; k++) {
        const ph = (f / n) * TAU + k * 1.7;
        const hgt = 6 + Math.sin(ph) * 3 + (k % 3) * 2;
        const x = Math.cos(k * 2.4) * 2.6;
        const y = Math.sin(k * 2.4) * 2.6;
        r.sweep([[x, y, 15], [x * 0.4 + Math.sin(ph) * 0.8, y * 0.4, 15 + hgt]], [2.2, 0.2], m(FIRE, 3, { shader: (s, tone) => tone(FIRE, s.u > 0.6 ? 1 : s.u < 0.3 ? -1 : 0) }));
      }
    },
  },
  shrine: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 6,
    light: { color: "#9ff5de", radius: 44, dy: 30 },
    emit: "sparkle",
    paint: (r, f, n) => {
      const st = md(ramp("#c8c4d8", { lo: "#4a3a6a" }), 1);
      r.prism(0, 0, 10, 0, 3, 8, st, Math.PI / 8);
      r.prism(0, 0, 7.5, 3, 6, 8, st, Math.PI / 8);
      r.prism(0, 0, 3.4, 6, 15, 8, m(ramp("#a8a4c0", { lo: "#3a2a5a" }), 2), Math.PI / 8);
      r.cone(0, 0, 3.4, 15, 6, 18, 8, st, Math.PI / 8);
      const ph = (f / n) * TAU;
      const z = 26 + Math.sin(ph) * 1.5;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + ph * 0.25;
        r.sweep([[0, 0, z - 1], [Math.cos(a) * 5.5, Math.sin(a) * 5.5, z + 2]], [0.8, 2.2], m(PAL.rose, 3, { shader: (s, tone) => (s.u > 0.7 ? "#fff0f6" : tone(PAL.rose)) }));
      }
      r.sphere([0, 0, z + 0.5], 2.4, m(PAL.gold, 4));
    },
  },
  gate: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 1,
    fps: 1,
    paint: (r) => {
      // spans the world x axis, so a road running along y passes through it
      for (const s of [-1, 1]) {
        r.prism(s * 17, 0, 2.4, 0, 46, 8, m(PILLAR, 1));
        r.prism(s * 17, 0, 4, 0, 4, 8, m(PAL.stone, 1));
      }
      r.box([-21, -1.6, 36], [21, 1.6, 39], m(PILLAR, 2));
      r.box([-25, -2.2, 44], [25, 2.2, 47], m(PAL.black, 3));
      r.hipRoof(0, 0, 30, 5, 47, 26, 0.6, 52, m(ROOF_TEAL, 4, { shader: roofTiles(ROOF_TEAL) }));
      r.box([-3, -2, 39], [3, 2, 44], m(PAL.gold, 5));
    },
  },
  hall: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const W = T * 1.35;
      r.box([-W - 2, -W - 2, 0], [W + 2, W + 2, 4], md(PAL.stone, 1));
      // walls between pillars
      r.box([-W + 3, -W + 3, 4], [W - 3, W - 3, 30], md(WALL, 2, { shader: (s, tone) => (s.p[2] < 9 ? tone(PILLAR, 1) : Math.abs(s.n[0]) > 0.5 && Math.abs(s.p[1]) < 6 && s.p[2] < 24 ? tone(PAL.woodDark) : Math.abs(s.n[1]) > 0.5 && Math.abs(s.p[0]) < 6 && s.p[2] < 24 ? tone(PAL.woodDark) : (Math.abs(s.n[0]) > 0.5 || Math.abs(s.n[1]) > 0.5) && s.p[2] > 15 && s.p[2] < 22 && Math.abs(((s.p[0] + s.p[1] + 60) % 14) - 7) < 3 ? "#5a3a3a" : tone(WALL)) }));
      for (const x of [-W + 2, -W / 3, W / 3, W - 2])
        for (const y of [-W + 2, W - 2]) {
          r.prism(x, y, 1.9, 4, 31, 8, m(PILLAR, 3));
          r.prism(y, x, 1.9, 4, 31, 8, m(PILLAR, 3));
        }
      r.box([-W - 1, -W - 1, 30], [W + 1, W + 1, 33], m(PAL.jade, 4));
      r.hipRoof(0, 0, W + 9, W + 9, 33, W * 0.45, W * 0.2, 46, md(ROOF_TEAL, 5, { shader: roofTiles(ROOF_TEAL) }));
      r.box([-W * 0.55, -W * 0.55, 46], [W * 0.55, W * 0.55, 54], md(WALL, 6, { shader: (s, tone) => (s.p[2] > 51 ? tone(PAL.jade) : tone(PILLAR)) }));
      r.hipRoof(0, 0, W * 0.75, W * 0.75, 54, W * 0.3, 2, 66, md(ROOF_TEAL, 7, { shader: roofTiles(ROOF_TEAL) }));
      r.sweep([[-W * 0.3, 0, 66.5], [W * 0.3, 0, 66.5]], 1.3, m(PAL.gold, 8));
      r.sphere([0, 0, 70], 2.2, m(PAL.gold, 8));
      // upturned eave corners
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          r.sweep([[sx * (W + 7), sy * (W + 7), 34], [sx * (W + 11), sy * (W + 11), 38]], [1.2, 0.5], m(ROOF_TEAL, 9));
          r.sweep([[sx * W * 0.7, sy * W * 0.7, 54.5], [sx * W * 0.86, sy * W * 0.86, 58]], [1, 0.4], m(ROOF_TEAL, 9));
        }
      r.box([W + 2, -6, 22], [W + 3.4, 6, 28], m(PAL.black, 10, { shader: (s, tone) => (Math.abs(s.p[1]) < 4 && Math.abs(s.p[2] - 25) < 1.6 ? tone(PAL.gold) : tone(PAL.black)) }));
      // the great doors, studded with gold, with a pair of bronze rings
      r.box([W - 3, -5.6, 4], [W - 2.4, 5.6, 23], m(PILLAR, 11, { shader: (s, tone) => (Math.abs(s.p[1]) < 0.3 ? tone(PAL.black) : Math.abs(((s.p[1] + 20) % 2.2) - 1.1) < 0.4 && Math.abs(((s.p[2] + 20) % 2.6) - 1.3) < 0.45 ? tone(PAL.gold) : tone(PILLAR)) }));
      for (const o of [-1.4, 1.4]) r.sphere([W - 2.2, o, 13], 0.9, m(BRONZE, 12));
      // carved brackets where each pillar meets the beam
      for (const x of [-W + 2, -W / 3, W / 3, W - 2])
        for (const y of [-W + 2, W - 2]) {
          r.box([x - 2.8, y - 1.2, 28], [x + 2.8, y + 1.2, 30], m(PAL.jade, 13));
          r.box([y - 1.2, x - 2.8, 28], [y + 1.2, x + 2.8, 30], m(PAL.jade, 13));
        }
      // a stone balustrade around the terrace, open before the doors
      const rail = m(ramp("#d8d4dc", { lo: "#5a5a72" }), 14);
      railing(r, [W + 1.4, -W - 1.4, 4], [W + 1.4, -8, 4], rail, 4, 5);
      railing(r, [W + 1.4, 8, 4], [W + 1.4, W + 1.4, 4], rail, 4, 5);
      railing(r, [-W - 1.4, W + 1.4, 4], [W + 1.4, W + 1.4, 4], rail, 4, 5);
      // red lanterns under the front eaves, and dragon-fish ridge ends curling up off the top roof
      for (const o of [-W + 6, W - 6]) {
        r.sweep([[W + 6, o, 33], [W + 6, o, 29]], 0.25, m(PAL.black, 15));
        r.ellipsoid([W + 6, o, 26.5], [2.4, 2.4, 2.8], m(PAL.red, 16, { shader: (s, tone) => (Math.abs(s.p[2] - 26.5) > 2.2 ? tone(PAL.gold) : tone(PAL.red)) }));
        r.sweep([[W + 6, o, 23.6], [W + 6, o, 21.6]], 0.5, m(PAL.gold, 16));
        r.sweep([[o, W + 6, 33], [o, W + 6, 29]], 0.25, m(PAL.black, 15));
        r.ellipsoid([o, W + 6, 26.5], [2.4, 2.4, 2.8], m(PAL.red, 16, { shader: (s, tone) => (Math.abs(s.p[2] - 26.5) > 2.2 ? tone(PAL.gold) : tone(PAL.red)) }));
      }
      for (const sx of [-1, 1]) r.sweep([[sx * W * 0.3, 0, 66.5], [sx * (W * 0.3 + 2.5), 0, 67.5], [sx * (W * 0.3 + 2), 0, 71], [sx * (W * 0.3 + 0.6), 0, 72]], [1.6, 1.3, 0.9, 0.4], m(PAL.gold, 17));
    },
  },
  house: {
    foot: [0, 0, 1, 1],
    blocks: true,
    frames: 1,
    fps: 1,
    emit: "smoke",
    paint: (r) => {
      const cx = T / 2;
      const cy = T / 2;
      const W = T * 0.85;
      r.box([cx - W - 1, cy - W - 1, 0], [cx + W + 1, cy + W + 1, 3], m(PAL.stone, 1));
      r.box([cx - W, cy - W, 3], [cx + W, cy + W, 24], md(WALL, 2, { shader: (s, tone) => {
        const fx = Math.abs(s.n[0]) > 0.5;
        const along = fx ? s.p[1] - cy : s.p[0] - cx;
        if (Math.abs(along) > W - 2.5 || s.p[2] > 21.5 || s.p[2] < 5) return tone(PAL.woodDark);
        if (fx && s.n[0] > 0 && Math.abs(along) < 4 && s.p[2] < 17) return Math.abs(along) < 0.4 ? tone(PAL.woodDark) : tone(PAL.wood);
        if (!fx && Math.abs(along - 5) < 3.5 && Math.abs(s.p[2] - 14) < 3) return Math.abs(along - 5) < 0.6 || Math.abs(s.p[2] - 14) < 0.6 ? tone(PAL.woodDark) : "#ffd890";
        return tone(WALL);
      } }));
      r.hipRoof(cx, cy, W + 7, W + 7, 24, W * 0.6, 1, 40, md(ROOF_GREY, 3, { shader: roofTiles(ROOF_GREY) }));
      r.sweep([[cx - W * 0.6, cy, 40.5], [cx + W * 0.6, cy, 40.5]], 1.2, m(PAL.black, 4));
      r.box([cx + 6, cy - 9, 30], [cx + 10, cy - 5, 44], m(PAL.stone, 5));
      houseDetails(r, cx, cy, W, 24, ROOF_GREY);
    },
  },
  pavilion: {
    foot: [0, 0, 1, 1],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const cx = T / 2;
      const cy = T / 2;
      const W = T * 0.8;
      r.prism(cx, cy, W + 2, 0, 3, 6, m(PAL.wood, 1));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        r.prism(cx + Math.cos(a) * W, cy + Math.sin(a) * W, 1.5, 3, 26, 6, m(PILLAR, 2));
      }
      r.prism(cx, cy, W + 0.6, 7, 8.4, 6, m(PILLAR, 3, { shader: (s, tone) => (s.n[2] > 0.5 ? null : tone(PILLAR)) }));
      r.prism(cx, cy, 5, 3, 9, 8, m(PAL.stone, 4));
      r.cone(cx, cy, W + 9, 25, 1, 40, 6, md(ROOF_RED, 5, { shader: roofTiles(ROOF_RED) }));
      r.sphere([cx, cy, 41.5], 2, m(PAL.gold, 6));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        r.sweep([[cx + Math.cos(a) * (W + 7), cy + Math.sin(a) * (W + 7), 26], [cx + Math.cos(a) * (W + 11), cy + Math.sin(a) * (W + 11), 30]], [1.1, 0.4], m(ROOF_RED, 7));
        // a railing between the pillars (one side left open for the steps), and a bell at each eave tip
        const b = ((k + 1) / 6) * TAU;
        if (k !== 0) railing(r, [cx + Math.cos(a) * W, cy + Math.sin(a) * W, 3], [cx + Math.cos(b) * W, cy + Math.sin(b) * W, 3], m(PILLAR, 8), 5, 2.6);
        r.sphere([cx + Math.cos(a) * (W + 11), cy + Math.sin(a) * (W + 11), 28.6], 0.8, m(PAL.gold, 9));
      }
      const mid = Math.PI / 6;
      for (let s = 0; s < 3; s++) r.box([cx + Math.cos(mid) * (W + 2 + s * 2) - 1, cy + Math.sin(mid) * (W + 2) - 4, 0], [cx + Math.cos(mid) * (W + 2 + s * 2) + 1, cy + Math.sin(mid) * (W + 2) + 4, 3 - s], m(PAL.stone, 10));
    },
  },
  stall: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 4,
    paint: (r, f, n) => {
      const W = T * 0.45;
      r.box([-W, -W, 0], [W, W, 10], m(PAL.wood, 1));
      for (let k = 0; k < 5; k++) r.sphere([-W + 3 + k * 3.5, -2 + (k % 2) * 4, 11.5], 1.8, m([PAL.orange, PAL.green, PAL.red, PAL.gold, PAL.rose][k], 2));
      for (const s of [-1, 1]) for (const t of [-1, 1]) r.sweep([[s * W, t * W, 0], [s * W, t * W, 24]], 0.8, m(PAL.woodDark, 3));
      const flap = Math.sin((f / n) * TAU) * 1.2;
      r.convex(beamPlanes(W + 3, W + 3, 24, 26), [-W - 4, -W - 4, 24], [W + 4, W + 4, 26], m(PAL.red, 4, { shader: (s, tone) => (Math.floor((s.p[0] - s.p[1] + 40) / 4) % 2 ? tone(PAL.white) : tone(PAL.red)) }));
      r.sweep([[W + 3, -W - 3, 24], [W + 3 + flap, W + 3, 21 + flap]], 0.6, m(PAL.red, 5));
    },
  },
  well: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.prism(0, 0, 7, 0, 7, 10, md(PAL.stone, 1, { shader: (s, tone) => (s.n[2] > 0.5 && Math.hypot(s.p[0], s.p[1]) < 5 ? "#1a2a4a" : tone(PAL.stone)) }));
      for (const s of [-1, 1]) r.sweep([[s * 6, -s * 6, 7], [s * 6, -s * 6, 24]], 0.9, m(PAL.woodDark, 2));
      r.hipRoof(0, 0, 10, 4, 24, 9, 0.5, 30, m(ROOF_GREY, 3));
      r.sweep([[0, 0, 22], [0, 0, 14]], 0.2, m(PAL.black, 4));
      r.prism(0, 0, 1.6, 11, 14, 6, m(PAL.wood, 4));
    },
  },
  cauldron: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 6,
    light: { color: "#b0ff90", radius: 26, dy: 12 },
    emit: "smoke",
    paint: (r, f, n) => {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.5;
        r.sweep([[Math.cos(a) * 6, Math.sin(a) * 6, 0], [Math.cos(a) * 4, Math.sin(a) * 4, 6]], 1, m(BRONZE, 1));
      }
      const bub = Math.sin((f / n) * TAU);
      r.ellipsoid([0, 0, 10], [7.5, 7.5, 6], m(BRONZE, 2, { shader: (s, tone) => (s.p[2] > 14 && Math.hypot(s.p[0], s.p[1]) < 5.4 ? (fbm(s.p[0] + bub, s.p[1], 4) > 0.55 ? "#e0ffb0" : "#7ad860") : tone(BRONZE)) }));
      for (const s of [-1, 1]) r.sweep([[s * 7, 0, 14], [s * 8.5, 0, 17]], 0.8, m(BRONZE, 3));
    },
  },
  dummy: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.sweep([[0, 0, 0], [0, 0, 26]], 1.4, m(PAL.woodDark, 1));
      r.sweep([[-7, 7, 18], [7, -7, 18]], 1.1, m(PAL.woodDark, 2));
      r.ellipsoid([0, 0, 18], [3.4, 3.4, 6], m(PAL.straw, 3));
      r.sphere([0, 0, 27], 3, m(PAL.straw, 4));
    },
  },
  banner: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 7,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 52]], 1, m(PAL.woodDark, 1));
      r.sphere([0, 0, 53], 1.6, m(PAL.gold, 1));
      for (let k = 0; k < 5; k++) {
        const z = 48 - k * 5;
        const pts: V3[] = [];
        for (let s = 0; s <= 6; s++) {
          const w = Math.sin((f / n) * TAU - s * 0.9 + k * 0.2) * (s / 6) * 2.2;
          pts.push([s * 2 + w * 0.5, -s * 2 + w * 0.5, z - s * 0.4 + w * 0.3]);
        }
        r.sweep(pts, 2.6, m(k === 0 ? PAL.jade : PAL.azure, 2, { shader: (s, tone) => (k === 2 && s.u > 0.35 && s.u < 0.65 ? tone(PAL.white) : tone(k === 0 ? PAL.jade : PAL.azure)) }));
      }
    },
  },
  lion: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const st = md(PAL.stone, 1);
      r.box([-6, -6, 0], [6, 6, 5], m(PAL.stone, 1));
      r.ellipsoid([0, -1, 10], [4.5, 5.5, 5], st);
      r.sphere([2, 3, 17], 4.6, md(PAL.stone, 2, { shader: (s, tone) => (fbm(s.p[0], s.p[2], 9) > 0.55 ? tone(PAL.stone, 1) : tone(PAL.stone)) }));
      r.sphere([5, 6, 15.5], 1.4, m(PAL.stone, 3));
      r.sphere([-3, -5, 5.5], 2.6, m(PAL.stone, 4));
    },
  },
  lotus: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 4,
    fps: 3,
    paint: (r, f, n) => {
      const bob = Math.sin((f / n) * TAU) * 0.5;
      r.ellipsoid([3, 2, -1.5 + bob], [6, 6, 0.8], m(ramp("#4aa060", { lo: "#103a2a" }), 1));
      r.ellipsoid([-5, -4, -1.6 - bob], [4, 4, 0.7], m(ramp("#4aa060", { lo: "#103a2a" }), 2));
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        r.sweep([[3, 2, 0 + bob], [3 + Math.cos(a) * 2.6, 2 + Math.sin(a) * 2.6, 3 + bob]], [0.6, 1.5], m(PAL.rose, 3, { shader: (s, tone) => (s.u > 0.6 ? "#fff0f6" : tone(PAL.rose)) }));
      }
      r.sphere([3, 2, 1.6 + bob], 1, m(PAL.gold, 4));
    },
  },
  reeds: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 5,
    paint: (r, f, n) => {
      for (let k = 0; k < 7; k++) {
        const x = Math.cos(k * 2.3) * 6;
        const y = Math.sin(k * 2.3) * 6;
        const hgt = 14 + (k % 3) * 4;
        const sw = Math.sin((f / n) * TAU + k * 0.8) * 2;
        r.sweep([[x, y, -1], [x + sw * 0.7, y - sw * 0.7, hgt]], [0.7, 0.3], m(ramp("#8ab050", { lo: "#2a4a2a" }), 1 + k));
        if (k % 2 === 0) r.ellipsoid([x + sw * 0.7, y - sw * 0.7, hgt], [0.9, 0.9, 2.2], m(PAL.brown, 1 + k));
      }
    },
  },
  tallgrass: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 5,
    paint: (r, f, n) => {
      for (let k = 0; k < 9; k++) {
        const x = Math.cos(k * 2.7) * (3 + (k % 3) * 2);
        const y = Math.sin(k * 2.7) * (3 + (k % 3) * 2);
        const hgt = 5 + (k % 4) * 1.6;
        const sw = Math.sin((f / n) * TAU + k * 0.5) * 1.3;
        r.sweep([[x, y, 0], [x + sw * 0.7, y - sw * 0.7, hgt]], [0.8, 0.25], m(ramp("#7ac050", { lo: "#1a4a2a" }), 1));
      }
    },
  },
  bones: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const b = m(ramp("#e8e0c8", { lo: "#5a4a5a" }), 1);
      r.sweep([[-6, 2, 0.8], [5, -1, 0.8]], 0.8, b);
      r.sweep([[-3, -5, 0.8], [2, 5, 0.8]], 0.7, b);
      r.sphere([4, 3, 2.4], 2.6, m(ramp("#e8e0c8", { lo: "#5a4a5a" }), 2, { shader: (s, tone) => (s.n[1] > 0.4 && Math.abs(Math.abs(s.n[0]) - 0.35) < 0.18 && s.n[2] > 0 && s.n[2] < 0.5 ? "#1a0a10" : tone(ramp("#e8e0c8", { lo: "#5a4a5a" }))) }));
    },
  },
  spikes: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 4,
    light: { color: "#ff3040", radius: 18, dy: 6 },
    paint: (r, f, n) => {
      const g = 0.5 + 0.5 * Math.sin((f / n) * TAU);
      const obs = m(ramp("#2a1a30", { lo: "#050208" }), 1, { shader: (s, tone) => (Math.abs(s.n[0] * 3 + s.p[2] * 0.25 - Math.round(s.n[0] * 3 + s.p[2] * 0.25)) < 0.06 ? mix("#a01020", "#ff5040", g) : tone(ramp("#2a1a30", { lo: "#050208" }))) });
      r.cone(0, 0, 5, 0, 0.3, 28, 5, obs);
      r.cone(6, -3, 3.5, 0, 0.2, 17, 5, obs, 0.6);
      r.cone(-5, 4, 3.6, 0, 0.2, 19, 5, obs, 1.1);
    },
  },
  chest: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 2,
    fps: 1,
    paint: (r, f) => {
      const wood = m(PAL.wood, 1, { shader: (s, tone) => (Math.abs(s.p[0]) > 5.2 || Math.abs(s.p[1]) > 3.4 ? tone(PAL.gold) : tone(PAL.wood)) });
      r.box([-6, -4, 0], [6, 4, 6], wood);
      if (f === 0) r.box([-6, -4, 6], [6, 4, 9], m(PAL.wood, 2, { shader: (s, tone) => (Math.abs(s.p[0]) < 1 ? tone(PAL.gold) : tone(PAL.wood)) }));
      else {
        r.box([-6, -6, 6], [6, -4, 14], m(PAL.wood, 2));
        r.sphere([0, 0, 6.5], 2.6, m(PAL.gold, 3));
      }
    },
  },
  herb: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 6,
    light: { color: "#c0ff90", radius: 16, dy: 6 },
    emit: "sparkle",
    paint: (r, f, n) => {
      const g = Math.sin((f / n) * TAU);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        r.sweep([[0, 0, 0], [Math.cos(a) * 4, Math.sin(a) * 4, 3 + g * 0.3]], [0.5, 1.4], m(ramp("#6ad060", { lo: "#1a4a2a" }), 1));
      }
      r.sweep([[0, 0, 0], [0, 0, 8]], 0.4, m(ramp("#6ad060"), 2));
      r.sphere([0, 0, 9 + g * 0.5], 1.9, m(tones("#ffffff", mix("#e8ffb0", "#ffffff", g * 0.5 + 0.5), "#a0e060", "#5a9a3a"), 3));
    },
  },
  fence: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const w = m(PAL.wood, 1);
      for (const x of [-10, 0, 10]) r.box([x - 1, -1, 0], [x + 1, 1, 12], w);
      r.box([-11.3, -0.6, 8], [11.3, 0.6, 10], m(PAL.wood, 2));
      r.box([-11.3, -0.6, 3.5], [11.3, 0.6, 5.5], m(PAL.wood, 2));
    },
  },
  fenceY: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const w = m(PAL.wood, 1);
      for (const y of [-10, 0, 10]) r.box([-1, y - 1, 0], [1, y + 1, 12], w);
      r.box([-0.6, -11.3, 8], [0.6, 11.3, 10], m(PAL.wood, 2));
      r.box([-0.6, -11.3, 3.5], [0.6, 11.3, 5.5], m(PAL.wood, 2));
    },
  },
  dais: {
    foot: [-1, -1, 1, 1],
    blocks: false,
    frames: 8,
    fps: 4,
    light: { color: "#c8d8ff", radius: 60, dy: 4 },
    paint: (r, f, n) => {
      const rot = (f / n) * TAU * 0.25;
      r.prism(0, 0, T * 1.45, 0, 3, 16, md(ramp("#d8dcf0", { lo: "#4a4a7a" }), 1, { shader: (s, tone) => {
        if (s.n[2] < 0.5) return tone(ramp("#b8bcd8", { lo: "#3a3a6a" }));
        const x = s.p[0];
        const y = s.p[1];
        const rr = Math.hypot(x, y);
        if (rr > T * 1.3) return tone(PAL.gold);
        const a = Math.atan2(y, x) - rot;
        const R = T * 1.05;
        if (rr > R) return tone(ramp("#d8dcf0"));
        // taiji
        const ux = Math.cos(a) * rr;
        const uy = Math.sin(a) * rr;
        const top = Math.hypot(ux, uy - R / 2) < R / 2;
        const bot = Math.hypot(ux, uy + R / 2) < R / 2;
        let dark = ux < 0;
        if (top) dark = true;
        if (bot) dark = false;
        if (Math.hypot(ux, uy - R / 2) < R / 7) dark = false;
        if (Math.hypot(ux, uy + R / 2) < R / 7) dark = true;
        return dark ? "#2a2a4a" : "#f4f4fa";
      } }));
    },
  },
  bloodaltar: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 6,
    fps: 6,
    light: { color: "#ff2040", radius: 56, dy: 30 },
    emit: "embers",
    paint: (r, f, n) => {
      const obs = md(ramp("#3a2030", { lo: "#08030a" }), 1);
      r.box([-T, -T, 0], [T, T, 6], obs);
      r.box([-T * 0.6, -T * 0.6, 6], [T * 0.6, T * 0.6, 12], md(ramp("#5a2030", { lo: "#10040a" }), 2));
      for (const s of [-1, 1]) for (const t of [-1, 1]) r.cone(s * T * 0.8, t * T * 0.8, 3.4, 6, 0.2, 30, 5, m(ramp("#2a1a30", { lo: "#050208" }), 3));
      const g = 0.5 + 0.5 * Math.sin((f / n) * TAU);
      const heart = tones("#ffffff", mix("#ff4060", "#ffb0c0", g), "#c01030", "#5a0018");
      r.prism(0, 0, 4, 12, 22 + g * 2, 6, m(heart, 4), (f / n) * 1.0);
      r.cone(0, 0, 4, 22 + g * 2, 0.2, 30 + g * 2, 6, m(heart, 4), (f / n) * 1.0);
    },
  },
  boat: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 2,
    paint: (r, f, n) => {
      const bob = Math.sin((f / n) * TAU) * 0.6;
      r.ellipsoid([0, 0, 1 + bob], [5, 13, 3.4], m(PAL.wood, 1, { shader: (s, tone) => (s.n[2] > 0.7 ? tone(PAL.woodDark) : tone(PAL.wood)) }));
      r.hipRoof(0, 2, 5, 6, 5 + bob, 4, 4, 9 + bob, m(PAL.straw, 2));
    },
  },
  stele: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.box([-7, -4, 0], [7, 4, 4], m(PAL.stone, 1));
      r.box([-5, -1.5, 4], [5, 1.5, 28], md(ramp("#6a6a80", { lo: "#1a1a2a" }), 2, { shader: (s, tone) => (s.n[1] > 0.5 && Math.abs(s.p[0]) < 3 && s.p[2] > 8 && s.p[2] < 25 && Math.floor(s.p[2] * 0.6) % 2 === 0 && hash2(Math.floor(s.p[0] * 0.7), Math.floor(s.p[2] * 0.6), 4) > 0.4 ? "#c8b060" : tone(ramp("#6a6a80"))) }));
      r.hipRoof(0, 0, 6.5, 2.5, 28, 5, 0.5, 31, m(PAL.stone, 3));
    },
  },
  sign: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.sweep([[0, 0, 0], [0, 0, 20]], 1, m(PAL.woodDark, 1));
      r.box([-1, -7, 13], [1, 7, 20], m(PAL.wood, 2, { shader: (s, tone) => (Math.abs(s.n[0]) > 0.5 && Math.abs(s.p[1]) < 5 && Math.abs(s.p[2] - 16.5) < 0.6 ? tone(PAL.black) : tone(PAL.wood)) }));
    },
  },
  waterwheel: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 8,
    paint: (r, f, n) => {
      // a wheel turning in the plane of world y (it stands beside a creek running along x)
      const rot = (f / n) * (TAU / 8);
      const R = 15;
      const hub: V3 = [0, 0, 16];
      const at = (a: number, rr: number): V3 => [0, hub[1] + Math.cos(a) * rr, hub[2] + Math.sin(a) * rr];
      for (const x of [-3, 3]) {
        const rim: V3[] = [];
        for (let k = 0; k <= 16; k++) rim.push(add(at((k / 16) * TAU, R), [x, 0, 0]));
        r.sweep(rim, 0.9, m(PAL.woodDark, 1));
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + rot;
        r.sweep([add(hub, [0, 0, 0]), at(a, R)], 0.6, m(PAL.wood, 2));
        const p = at(a, R + 1.5);
        r.box([p[0] - 3.5, p[1] - 1.2, p[2] - 1.2], [p[0] + 3.5, p[1] + 1.2, p[2] + 1.2], m(PAL.wood, 3));
      }
      r.sweep([[-6, 0, 16], [6, 0, 16]], 1.6, m(PAL.black, 4));
      // trestle
      for (const y of [-6, 6]) r.sweep([[-7, y, 0], [-7, 0, 17]], 1, m(PAL.woodDark, 5));
      // spilling water from the paddles
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + 0.5 + k * 0.35 + (f % 2) * 0.12;
        const p = at(a, R + 2);
        r.sphere(p, 1.1, m(tones("#ffffff", "#c8ecff", "#7ab8e8", "#3a78b8"), 6));
      }
    },
  },
  campfire: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 10,
    light: { color: "#ff8a40", radius: 44, dy: 8 },
    emit: "embers",
    paint: (r, f, n) => {
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        r.sphere([Math.cos(a) * 7, Math.sin(a) * 7, 1.2], 2, md(PAL.stone, 1));
      }
      r.sweep([[-5, -2, 1.5], [5, 2, 2.5]], 1.2, m(PAL.woodDark, 2));
      r.sweep([[-2, 5, 1.5], [2, -5, 2.5]], 1.2, m(PAL.woodDark, 2));
      for (let k = 0; k < 6; k++) {
        const ph = (f / n) * TAU + k * 1.9;
        const hgt = 9 + Math.sin(ph) * 3.5 + (k % 3) * 2.4;
        const x = Math.cos(k * 2.2) * 2.6;
        const y = Math.sin(k * 2.2) * 2;
        r.sweep([[x, y, 2.5], [x * 0.3 + Math.sin(ph) * 0.9, y * 0.3, 2.5 + hgt]], [2.8, 0.2], m(FIRE, 3, { shader: (s, tone) => tone(FIRE, s.u > 0.55 ? 1 : s.u < 0.3 ? -1 : 0) }));
      }
    },
  },
  scarecrow: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      const sw = Math.sin((f / n) * TAU);
      const tilt = swayAt(f, n, 28, 1.2);
      r.sweep([[0, 0, 0], add([0, 0, 30], tilt)], 1, m(PAL.woodDark, 1));
      const sh = add([0, 0, 22], tilt);
      r.sweep([add(sh, [-9, 9, 0]), add(sh, [9, -9, 0])], 0.8, m(PAL.woodDark, 1));
      r.ellipsoid(add([0, 0, 18], tilt), [3.4, 3, 5.5], m(ramp("#5a7a9a"), 2, { shader: (s, tone) => (Math.abs(s.p[2] - 16) < 0.8 ? tone(PAL.red) : tone(ramp("#5a7a9a"))) }));
      for (const side of [-1, 1]) {
        const hand = add(sh, [side * 8, -side * 8, -0.5]);
        r.sweep([add(sh, [side * 2, -side * 2, 0]), add(hand, [0, 0, -1.5 - sw * side * 1.4])], [1.8, 2.4], m(ramp("#5a7a9a"), 3));
        r.sweep([hand, add(hand, [side * 1.6, -side * 1.6, -2 + sw])], [0.6, 0.3], m(PAL.straw, 3));
      }
      const head = add([0, 0, 28], tilt);
      r.sphere(head, 3, m(PAL.straw, 4, { shader: (s, tone) => (s.n[1] > 0.6 && Math.abs(Math.abs(s.n[0]) - 0.3) < 0.14 && s.n[2] > 0 ? "#1a1226" : tone(PAL.straw)) }));
      r.cone(head[0], head[1], 7.5, head[2] + 1.5, 0.5, head[2] + 6, 12, m(PAL.straw, 5, { shader: strawShaderProp }));
    },
  },
  pagoda: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 6,
    fps: 4,
    light: { color: "#ffd070", radius: 52, dy: 64 },
    paint: (r, f, n) => {
      const W = T * 0.78;
      // a square stone terrace as wide as the pagoda's footprint, with the octagonal tower on it
      const E = T * 1.45;
      r.box([-E, -E, 0], [E, E, 2], md(PAL.stone, 1));
      r.prism(0, 0, W + 6, 2, 4, 8, md(PAL.stone, 1), Math.PI / 8);
      // the lamplit door on the east face
      r.box([W * 0.66, -4, 4], [W * 0.74 + 1, 4, 14], m(PAL.woodDark, 12, { shader: (s, tone) => (s.n[0] > 0.5 && Math.abs(s.p[1]) < 3 && s.p[2] < 13 ? (Math.abs(s.p[1]) < 0.4 ? tone(PAL.black) : "#ffcf78") : tone(PAL.woodDark)) }));
      let z = 4;
      for (let k = 0; k < 5; k++) {
        const w = W * (1 - k * 0.13);
        const hgt = 15 - k * 1.4;
        r.prism(0, 0, w * 0.72, z, z + hgt, 8, md(WALL, 2 + k, { shader: (s, tone) => (Math.abs(s.p[2] - (z + hgt * 0.55)) < 2.4 && Math.abs(Math.sin(Math.atan2(s.p[1], s.p[0]) * 4)) < 0.35 ? (k === 1 ? "#ffd890" : tone(PAL.woodDark)) : tone(PILLAR)) }), Math.PI / 8);
        // a walkway with its railing round the second and fourth storeys
        if (k === 1 || k === 3) {
          const bw = w * 0.72 + 2.4;
          r.prism(0, 0, bw, z - 0.6, z + 0.4, 8, m(PAL.woodDark, 13), Math.PI / 8);
          for (let c = 0; c < 8; c++) {
            const a0 = (c / 8) * TAU + Math.PI / 8;
            const a1 = ((c + 1) / 8) * TAU + Math.PI / 8;
            railing(r, [Math.cos(a0) * bw * 0.97, Math.sin(a0) * bw * 0.97, z + 0.4], [Math.cos(a1) * bw * 0.97, Math.sin(a1) * bw * 0.97, z + 0.4], m(PILLAR, 14), 2.6, 9);
          }
        }
        z += hgt;
        r.cone(0, 0, w + 4, z, w * 0.55, z + 4.5, 8, md(ROOF_TEAL, 2 + k, { shader: roofTiles(ROOF_TEAL) }), Math.PI / 8);
        // a wind chime swinging under each eave
        for (let c = 0; c < 4; c++) {
          const a = (c / 4) * TAU + Math.PI / 4;
          const ex = Math.cos(a) * (w + 3);
          const ey = Math.sin(a) * (w + 3);
          const swing = Math.sin((f / n) * TAU + c + k) * 1.2;
          r.sweep([[ex, ey, z], [ex + swing * 0.7, ey - swing * 0.7, z - 3]], 0.25, m(PAL.gold, 10));
          r.sphere([ex + swing * 0.7, ey - swing * 0.7, z - 3.4], 0.8, m(PAL.gold, 10));
        }
        z += 4.5;
      }
      r.sweep([[0, 0, z], [0, 0, z + 14]], 0.9, m(PAL.gold, 11));
      for (let k = 0; k < 4; k++) r.sphere([0, 0, z + 3 + k * 3], 1.6 - k * 0.25, m(PAL.gold, 11));
    },
  },
  teahouse: {
    foot: [0, 0, 1, 1],
    blocks: true,
    frames: 6,
    fps: 5,
    emit: "smoke",
    light: { color: "#ffb060", radius: 40, dy: 18 },
    paint: (r, f, n) => {
      const cx = T / 2;
      const cy = T / 2;
      const W = T * 0.85;
      r.box([cx - W - 2, cy - W - 2, 0], [cx + W + 2, cy + W + 2, 3], m(PAL.wood, 1));
      // three closed walls; the front (facing +y) stands open on its pillars
      r.box([cx - W, cy - W, 3], [cx + W, cy - W + 2, 22], md(WALL, 2));
      r.box([cx - W, cy - W, 3], [cx - W + 2, cy + W, 22], md(WALL, 2));
      r.box([cx + W - 2, cy - W, 3], [cx + W, cy + W, 22], md(WALL, 2, { shader: (s, tone) => (Math.abs(s.p[1] - cy) < 4 && Math.abs(s.p[2] - 13) < 3 ? "#ffd890" : tone(WALL)) }));
      for (const x of [cx - W + 1, cx - W / 3, cx + W / 3, cx + W - 1]) r.prism(x, cy + W - 1, 1.3, 3, 22, 6, m(PILLAR, 3));
      // a table with a teapot inside
      r.box([cx - 5, cy - 2, 3], [cx + 5, cy + 4, 9], m(PAL.woodDark, 4));
      r.sphere([cx, cy + 1, 11], 2, m(ramp("#e8e0d0"), 5));
      r.hipRoof(cx, cy, W + 8, W + 8, 22, W * 0.55, 1, 36, md(ROOF_RED, 6, { shader: roofTiles(ROOF_RED) }));
      r.box([cx + 6, cy - 9, 27], [cx + 10, cy - 5, 40], m(PAL.stone, 7));
      // the hanging 茶 flag sways in the wind
      const pole: V3 = [cx - W - 3, cy + W + 3, 0];
      r.sweep([pole, add(pole, [0, 0, 40])], 0.8, m(PAL.woodDark, 8));
      const pts: V3[] = [];
      for (let s = 0; s <= 5; s++) {
        const w = Math.sin((f / n) * TAU - s * 0.8) * (s / 5) * 1.8;
        pts.push(add(pole, [s * 1.6 + w * 0.4, -s * 1.6 + w * 0.4, 36 - s * 0.2]));
      }
      r.sweep(pts, 3, m(PAL.paper, 9, { shader: (s, tone) => (s.u > 0.35 && s.u < 0.7 && Math.abs(s.p[2] - 36) < 1.2 ? tone(PAL.red) : tone(PAL.paper)) }));
      // a lacquered signboard over the open front, and a lantern swinging at each end of it
      r.box([cx - 7, cy + W + 0.6, 17], [cx + 7, cy + W + 1.6, 21], m(PAL.black, 10, { shader: (s, tone) => (s.n[1] > 0.5 && Math.abs(s.p[2] - 19) < 1 && Math.abs(((s.p[0] - cx + 21) % 4) - 2) < 1.1 ? tone(PAL.gold) : tone(PAL.black)) }));
      for (const o of [-W + 4, W - 4]) {
        const sw = Math.sin((f / n) * TAU + o) * 0.8;
        r.sweep([[cx + o, cy + W + 4, 22], [cx + o + sw * 0.5, cy + W + 4 - sw * 0.5, 19]], 0.2, m(PAL.black, 11));
        r.ellipsoid([cx + o + sw * 0.7, cy + W + 4 - sw * 0.7, 16.5], [1.8, 1.8, 2.3], m(PAL.red, 12));
      }
      // rafter ends under the eaves and a potted plant at the corner pillar
      for (let o = -W + 1; o <= W - 1; o += 3.6) r.box([cx + o - 0.5, cy + W + 4.6, 22.6], [cx + o + 0.5, cy + W + 6.2, 23.6], m(PAL.woodDark, 13));
      r.prism(cx + W + 3, cy + W + 2, 2.2, 0, 4.5, 8, m(ramp("#8a5a4a", { lo: "#2a1410" }), 14));
      r.sphere([cx + W + 3, cy + W + 2, 7.5], 3, md(LEAVES, 15, { shader: leafShader(LEAVES, 4) }));
      r.box([cx - W + 1, cy + W + 2, 0], [cx - W + 9, cy + W + 4, 4], m(PAL.wood, 16));
    },
  },
  tent: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 5,
    paint: (r, f, n) => {
      const canvas = ramp("#b89a6a", { lo: "#4a3020" });
      const W = 10;
      r.hipRoof(0, 0, W, W, 0, 0.6, W * 0.9, 20, md(canvas, 1, { shader: (s, tone) => (Math.abs(s.p[0]) < 3 && s.n[1] > 0.3 && s.p[2] < 12 ? "#2a1a14" : tone(canvas)) }));
      const flap = Math.sin((f / n) * TAU) * 1.5;
      r.sweep([[3, W - 1, 12], [4 + flap, W + 1.5, 2]], [1.6, 2.4], m(canvas, 2));
      r.sweep([[0, -W - 1, 0], [0, -W - 1, 23]], 0.6, m(PAL.woodDark, 3));
      r.sweep([[0, -W - 1, 23], [flap * 0.6 + 3, -W - 4, 22]], 1.2, m(PAL.red, 4));
    },
  },
  ruin: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const st = md(ramp("#9a96a8", { lo: "#3a3048" }), 1, { shader: (s, tone) => (fbm(s.p[0] * 0.3, s.p[2] * 0.3 + s.p[1] * 0.3, 8) > 0.62 ? tone(ramp("#5a8a4a"), 0) : tone(ramp("#9a96a8", { lo: "#3a3048" }))) });
      r.prism(-4, -4, 4, 0, 3, 8, st);
      r.prism(-4, -4, 2.8, 3, 26, 8, st);
      r.cone(-4, -4, 2.8, 26, 1.2, 30, 8, st, 0.7);
      r.prism(6, 5, 4, 0, 3, 8, st);
      r.prism(6, 5, 2.8, 3, 11, 8, st);
      r.box([0, -2, 0], [10, 4, 3.5], st);
      r.sphere([-8, 6, 1.5], 2.4, st);
    },
  },
  karst: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const lime = ramp("#b8b0c0", { lo: "#3a3048" });
      const st = md(lime, 1, { shader: (s, tone) => (Math.sin(s.p[2] * 0.8 + fbm(s.p[0] * 0.3, s.p[1] * 0.3, 2) * 6) > 0.7 ? tone(lime, 1) : s.n[2] > 0.6 ? tone(ramp("#5a9a4a")) : tone(lime)) });
      r.cone(0, 0, 8, 0, 4.5, 40, 7, st, 0.3);
      r.cone(0, 0, 4.5, 40, 1.5, 56, 7, st, 0.9);
      r.cone(6, -3, 4.5, 0, 1.2, 24, 6, st, 0.2);
      r.sphere([0.5, 0.5, 50], 3.5, md(PINE, 2, { shader: leafShader(PINE, 4) }));
      r.sphere([-5, 4, 2], 3.4, st);
    },
  },
  steam: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 1,
    fps: 1,
    emit: "mist",
    paint: (r) => {
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + 0.3;
        r.sphere([Math.cos(a) * 6, Math.sin(a) * 6, 1], 2.4 - (k % 2) * 0.6, md(PAL.stone, 1));
      }
    },
  },
  bench: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.box([-9, -3, 6], [9, 3, 8], m(PAL.wood, 1));
      for (const x of [-7, 7]) r.box([x - 1, -2, 0], [x + 1, 2, 6], m(PAL.woodDark, 2));
    },
  },
  prayerflags: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 6,
    paint: (r, f, n) => {
      const a: V3 = [-14, 14, 0];
      const b: V3 = [14, -14, 0];
      r.sweep([a, add(a, [0, 0, 30])], 0.8, m(PAL.woodDark, 1));
      r.sweep([b, add(b, [0, 0, 30])], 0.8, m(PAL.woodDark, 1));
      const cols = [PAL.azure, PAL.white, PAL.red, PAL.green, PAL.gold];
      for (let k = 0; k <= 8; k++) {
        const u = k / 8;
        const sag = Math.sin(u * Math.PI) * 6;
        const p: V3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 30 - sag];
        if (k > 0 && k < 8) {
          const w = Math.sin((f / n) * TAU + k * 0.9) * 1.6;
          r.sweep([p, add(p, [w * 0.6, -w * 0.6 + 1.5, -5])], [1.6, 1.2], m(cols[k % cols.length], 2 + (k % 3)));
        }
        if (k < 8) {
          const u2 = (k + 1) / 8;
          r.sweep([p, [a[0] + (b[0] - a[0]) * u2, a[1] + (b[1] - a[1]) * u2, 30 - Math.sin(u2 * Math.PI) * 6]], 0.25, m(PAL.black, 6));
        }
      }
    },
  },
  haystack: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.cone(0, 0, 8, 0, 3, 14, 10, md(PAL.straw, 1, { shader: strawShaderProp }));
      r.cone(0, 0, 3, 14, 0.5, 18, 10, md(PAL.straw, 1, { shader: strawShaderProp }));
      r.sweep([[0, 0, 17], [0, 0, 21]], 0.6, m(PAL.woodDark, 2));
    },
  },

  // ------------------------------------------------------------------ building interiors
  shelf: { foot: [0, 0, 0, 0], blocks: true, frames: 1, fps: 1, paint: (r) => paintShelf(r, false) },
  shelfX: { foot: [0, 0, 0, 0], blocks: true, frames: 1, fps: 1, paint: (r) => paintShelf(r, true) },
  scroll: { foot: [0, 0, 0, 0], blocks: true, frames: 6, fps: 3, paint: (r, f, n) => paintScroll(r, false, f, n) },
  scrollX: { foot: [0, 0, 0, 0], blocks: true, frames: 6, fps: 3, paint: (r, f, n) => paintScroll(r, true, f, n) },
  table: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    emit: "steam",
    paint: (r) => {
      r.box([-8, -8, 7], [8, 8, 9], m(PAL.woodDark, 1));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.box([sx * 6.5 - 1, sy * 6.5 - 1, 0], [sx * 6.5 + 1, sy * 6.5 + 1, 7], m(PAL.woodDark, 2));
      const clay = ramp("#e8e0d0", { lo: "#6a6a8a" });
      r.ellipsoid([-1, 1, 11.5], [2.6, 2.6, 2.4], m(clay, 3, { shader: (s, tone) => (Math.abs(s.p[2] - 11.5) < 0.6 ? tone(PAL.azure) : tone(clay)) }));
      r.sweep([[1.6, -0.6, 12], [4, -2.4, 13.4]], [0.7, 0.4], m(clay, 3));
      r.sphere([-1, 1, 14], 0.8, m(clay, 3));
      for (const [x, y] of [[4, 4], [-4.5, -3.5], [4.5, -4.5]] as const) r.prism(x, y, 1.3, 9, 11, 8, m(clay, 4, { shader: (s, tone) => (s.n[2] > 0.5 ? "#7a5a2a" : tone(clay)) }));
    },
  },
  cushion: {
    foot: [0, 0, 0, 0],
    blocks: false,
    flat: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.ellipsoid([0, 0, 1.2], [6, 6, 1.6], m(PAL.crimson, 1, { shader: (s, tone) => (Math.hypot(s.p[0], s.p[1]) < 1.6 ? tone(PAL.gold) : tone(PAL.crimson)) }));
    },
  },
  mat: {
    foot: [0, 0, 0, 0],
    blocks: false,
    flat: true,
    frames: 1,
    fps: 1,
    light: { color: "#fff0c8", radius: 30, dy: 2 },
    paint: (r) => {
      r.box([-9, -9, 0], [9, 9, 0.8], m(PAL.straw, 1, { shader: strawShaderProp }));
    },
  },
  hearth: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 9,
    light: { color: "#ff9040", radius: 46, dy: 8 },
    emit: "smoke",
    paint: (r, f, n) => {
      const brick = md(ramp("#a86a52", { lo: "#3a1a1a" }), 1, { shader: (s, tone) => (Math.floor(s.p[2] / 3) % 2 === 0 ? (Math.abs((s.p[0] + s.p[1] + 40) % 6) < 0.6 ? "#3a1a1a" : tone(ramp("#a86a52", { lo: "#3a1a1a" }))) : Math.abs((s.p[0] + s.p[1] + 43) % 6) < 0.6 ? "#3a1a1a" : tone(ramp("#a86a52", { lo: "#3a1a1a" }))) });
      r.box([-9, -9, 0], [9, 9, 12], brick);
      // the fire mouth, glowing
      const glow = (f / n) * TAU;
      r.box([-4, 8.6, 1.5], [4, 9.4, 8], m(FIRE, 2, { shader: (s, tone) => tone(FIRE, Math.sin(s.p[0] * 1.3 + glow * 2) > 0.3 ? -1 : s.p[2] > 6 ? 1 : 0) }));
      r.box([8.6, -4, 1.5], [9.4, 4, 8], m(FIRE, 2, { shader: (s, tone) => tone(FIRE, Math.sin(s.p[1] * 1.3 + glow * 2) > 0.3 ? -1 : s.p[2] > 6 ? 1 : 0) }));
      for (let k = 0; k < 3; k++) {
        const ph = glow + k * 2.1;
        r.sweep([[4 + k * 1.6, 9.6, 2], [4.4 + k * 1.6 + Math.sin(ph) * 0.8, 10.4, 5 + Math.sin(ph) * 1.5 + k]], [1.2, 0.2], m(FIRE, 3));
      }
      // the wok and its lid
      r.ellipsoid([0, 0, 13], [6, 6, 2.6], m(PAL.black, 4));
      r.ellipsoid([0, 0, 15 + Math.sin(glow) * 0.3], [4.4, 4.4, 1.4], m(PAL.woodDark, 5));
      r.sphere([0, 0, 16.6 + Math.sin(glow) * 0.3], 0.9, m(PAL.woodDark, 5));
      r.prism(-6, -6, 1.8, 12, 34, 6, m(ramp("#8a5a4a", { lo: "#2a1414" }), 6));
    },
  },
  loom: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 6,
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      for (const x of [-9, 9]) {
        r.box([x - 1, -7, 0], [x + 1, -5, 24], m(PAL.wood, 1));
        r.box([x - 1, 5, 0], [x + 1, 7, 12], m(PAL.wood, 1));
        r.box([x - 1, -6, 10], [x + 1, 6, 12], m(PAL.wood, 1));
      }
      r.sweep([[-9, -6, 23], [9, -6, 23]], 1.4, m(PAL.woodDark, 2));
      r.sweep([[-9, 6, 11.5], [9, 6, 11.5]], 1.8, m(ramp("#4aa0a0", { lo: "#1a3a4a" }), 3, { shader: (s, tone) => (Math.sin(s.p[0] * 2) > 0.6 ? tone(PAL.gold) : tone(ramp("#4aa0a0", { lo: "#1a3a4a" }))) }));
      // the warp threads, with a tapestry growing up them
      r.convex(
        [
          { n: [0, -1, 0] as V3, d: 6.3 },
          { n: [0, 1, 0] as V3, d: -5.7 },
          { n: [-1, 0, 0] as V3, d: 8 },
          { n: [1, 0, 0] as V3, d: 8 },
          { n: [0, 0, -1] as V3, d: -12 },
          { n: [0, 0, 1] as V3, d: 22.5 },
        ],
        [-8, -6.3, 12],
        [8, -5.7, 22.5],
        m(PAL.paper, 4, { shader: (s, tone) => (s.p[2] < 17 ? (fbm(s.p[0] * 0.4, s.p[2] * 0.4, 3) > 0.55 ? tone(PAL.crimson) : tone(ramp("#4aa0a0", { lo: "#1a3a4a" }))) : Math.floor(s.p[0] * 1.5) % 2 ? tone(PAL.paper, 1) : tone(PAL.paper)) }),
      );
      // the beater swings and the shuttle flies across
      const beat = Math.max(0, Math.sin(ph)) * 3;
      r.sweep([[-8.5, -2 + beat, 13], [8.5, -2 + beat, 13]], 0.9, m(PAL.woodDark, 5));
      r.ellipsoid([Math.cos(ph) * 7, -3.6 + beat * 0.6, 14.6], [2.2, 0.9, 0.8], m(PAL.wood, 6));
    },
  },
  millstone: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 8,
    fps: 6,
    emit: "dust",
    paint: (r, f, n) => {
      const a = (f / n) * TAU;
      const granite = ramp("#a8a4b4", { lo: "#3a3048" });
      // a wooden curb round the bed stone, catching the flour
      r.prism(0, 0, 21, 0, 4, 12, m(PAL.wood, 1));
      r.prism(0, 0, 19, 3.6, 4.4, 12, m(ramp("#f4f0e8", { lo: "#8a8070" }), 1));
      r.prism(0, 0, 14, 4, 11, 14, md(granite, 2));
      r.prism(0, 0, 13, 11, 19, 14, md(granite, 3, { shader: (s, tone) => (s.n[2] > 0.5 ? (Math.sin(Math.atan2(s.p[1], s.p[0]) * 6 - a) > 0.7 ? tone(granite, 1) : tone(granite)) : Math.sin(Math.atan2(s.p[1], s.p[0]) * 10 - a * 2) > 0.8 ? tone(granite, 1) : tone(granite)) }), a / 7);
      r.prism(0, 0, 3, 18, 22, 8, m(PAL.woodDark, 4));
      r.prism(0, 0, 2, 19, 64, 6, m(PAL.woodDark, 4), a);
      // the crown wheel turns with the shaft, driven from the waterwheel outside
      for (let k = 0; k < 10; k++) {
        const b = a + (k / 10) * TAU;
        r.sweep([[0, 0, 50], [Math.cos(b) * 10, Math.sin(b) * 10, 50]], 0.9, m(PAL.wood, 5));
        r.box([Math.cos(b) * 10 - 1, Math.sin(b) * 10 - 1, 50], [Math.cos(b) * 10 + 1, Math.sin(b) * 10 + 1, 53], m(PAL.wood, 5));
      }
      r.prism(0, 0, 10.5, 49, 50.5, 16, m(PAL.wood, 6));
      // a hopper of grain above the eye of the stone
      r.cone(0, 0, 2, 26, 7, 36, 8, m(PAL.wood, 7, { shader: (s, tone) => (s.n[2] > 0.6 ? tone(PAL.straw) : tone(PAL.wood)) }));
      r.cone(14, 9, 4, 4, 0.6, 7, 8, md(ramp("#f4f0e8", { lo: "#8a8070" }), 8));
    },
  },
  sacks: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const burlap = md(ramp("#c8a878", { lo: "#5a3a2a" }), 1, { shader: (s, tone) => ((Math.floor(s.p[0] * 2) + Math.floor(s.p[2] * 2)) % 2 ? tone(ramp("#c8a878", { lo: "#5a3a2a" }), 1) : tone(ramp("#c8a878", { lo: "#5a3a2a" }))) });
      r.ellipsoid([-3, -3, 5], [5, 4.4, 5.4], burlap);
      r.ellipsoid([4, 1, 5], [4.6, 5, 5.2], burlap);
      r.ellipsoid([0, 0, 12], [4.4, 4, 4.4], burlap);
      for (const [x, y, z] of [[-3, -3, 10.6], [4, 1, 10.4], [0, 0, 16.2]] as const) r.sweep([[x, y, z - 0.6], [x, y, z + 1]], 0.9, m(ramp("#8a6a4a"), 2));
    },
  },
  altar: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 6,
    light: { color: "#ffc070", radius: 38, dy: 18 },
    emit: "incense",
    paint: (r, f) => {
      r.box([-10, -9, 0], [10, -1, 12], m(PAL.woodDark, 1, { shader: (s, tone) => (s.n[1] > 0.5 && Math.abs(s.p[0]) < 7 && s.p[2] > 3 && s.p[2] < 10 ? tone(PAL.crimson) : tone(PAL.woodDark)) }));
      r.box([-10.6, -9.6, 12], [10.6, -0.4, 13.2], m(PAL.crimson, 2, { shader: (s, tone) => (Math.abs(s.p[2] - 12.6) < 0.4 ? tone(PAL.gold) : tone(PAL.crimson)) }));
      // three ancestor tablets
      for (const [x, h] of [[-5, 9], [0, 12], [5, 9]] as const) {
        r.box([x - 1.8, -7.6, 13], [x + 1.8, -6.4, 13 + h], m(PAL.black, 3, { shader: (s, tone) => (s.n[1] > 0.5 && Math.abs(s.p[0] - x) < 0.6 && s.p[2] > 15 && s.p[2] < 11 + h ? tone(PAL.gold) : tone(PAL.black)) }));
        r.box([x - 2.2, -8, 13 + h], [x + 2.2, -6, 14 + h], m(PAL.gold, 3));
      }
      r.cone(0, -3, 2.6, 13, 2, 16, 8, m(BRONZE, 4));
      for (const dx of [-0.8, 0, 0.8]) r.sweep([[dx, -3, 15.5], [dx * 1.5, -3, 21]], 0.3, m(PAL.red, 5));
      // candles at either end
      for (const sx of [-1, 1]) {
        r.prism(sx * 8, -4, 1, 13, 18, 6, m(PAL.red, 6));
        const fl = [1, 0.8, 1.15, 0.9][f];
        r.sweep([[sx * 8, -4, 18.4], [sx * 8, -4, 18.4 + 2.4 * fl]], [0.9, 0.1], m(FIRE, 7));
      }
    },
  },
  candle: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 7,
    light: { color: "#ffd080", radius: 34, dy: 28 },
    paint: (r, f) => {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU;
        r.sweep([[Math.cos(a) * 4, Math.sin(a) * 4, 0], [0, 0, 4]], 0.7, m(BRONZE, 1));
      }
      r.sweep([[0, 0, 3], [0, 0, 22]], 0.9, m(BRONZE, 1));
      r.cone(0, 0, 3.6, 22, 2, 24, 8, m(BRONZE, 2));
      r.prism(0, 0, 1.3, 24, 28.5, 6, m(PAL.white, 3));
      const fl = [1, 0.75, 1.2, 0.9][f];
      r.sweep([[0, 0, 29], [Math.sin(f * 2) * 0.3, 0, 29 + 3 * fl]], [1.1, 0.1], m(FIRE, 4));
    },
  },
  screen: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const silk = ramp("#f4ecd8", { lo: "#8a7a6a" });
      for (let k = 0; k < 3; k++) {
        const x0 = -10 + k * 7;
        const y = k % 2 ? 2 : -1;
        r.box([x0, y - 0.6, 1], [x0 + 6.6, y + 0.6, 26], m(silk, 1 + k, { shader: (s, tone) => {
          if (s.p[2] < 3 || s.p[2] > 24.5 || s.p[0] < x0 + 0.6 || s.p[0] > x0 + 6) return tone(PAL.woodDark);
          const ridge = 9 + Math.sin((s.p[0] + 12) * 0.5) * 3 + Math.sin((s.p[0] + 12) * 1.3) * 1.2;
          if (s.p[2] < ridge) return tone(ramp("#5a7aa0", { lo: "#1a2a4a" }), s.p[2] < ridge - 3 ? 1 : 0);
          if (Math.hypot(s.p[0] - 5, s.p[2] - 20) < 1.6) return tone(PAL.red);
          return tone(silk);
        } }));
      }
    },
  },
  bed: {
    foot: [0, 0, 1, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.box([-10, -10, 0], [T + 10, 10, 8], md(ramp("#a86a52", { lo: "#3a1a1a" }), 1));
      r.box([-9, -9, 8], [T + 6, 9, 10.5], m(ramp("#4a7aa8"), 2, { shader: (s, tone) => (Math.sin(s.p[0] * 0.8) * Math.sin(s.p[1] * 0.8) > 0.4 ? tone(PAL.white) : tone(ramp("#4a7aa8"))) }));
      r.ellipsoid([-5, 0, 11], [3.4, 6, 2], m(PAL.paper, 3));
      r.ellipsoid([T * 0.5 + 2, 0, 10.6], [9, 8, 2.2], m(ramp("#4a7aa8"), 4));
    },
  },
  herbrack: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      for (const x of [-8, 8]) r.sweep([[x, 0, 0], [x, 0, 26]], 0.9, m(PAL.wood, 1));
      r.sweep([[-9, 0, 25], [9, 0, 25]], 0.8, m(PAL.wood, 1));
      const herbs = [ramp("#6a9a4a"), ramp("#a8884a"), ramp("#7a5aa0"), ramp("#c86a4a"), ramp("#5a8a6a")];
      for (let k = 0; k < 5; k++) {
        const x = -6 + k * 3;
        const sw = Math.sin((f / n) * TAU + k * 1.3) * 0.9;
        r.sweep([[x, 0, 25], [x + sw * 0.5, -sw * 0.5, 21]], 0.2, m(PAL.straw, 2));
        r.cone(x + sw, -sw, 2, 14, 0.6, 20.5, 6, md(herbs[k], 3 + k));
      }
    },
  },
  vase: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const porcelain = ramp("#f4f6ff", { lo: "#6a7aa0" });
      r.ellipsoid([0, 0, 8], [5, 5, 7.5], m(porcelain, 1, { shader: (s, tone) => (Math.abs(s.p[2] - 8) < 1 || Math.sin(Math.atan2(s.p[1], s.p[0]) * 5 + s.p[2] * 0.6) > 0.75 ? tone(ramp("#3a5aa8")) : tone(porcelain)) }));
      r.cone(0, 0, 2.2, 14, 3.2, 20, 10, m(porcelain, 2, { shader: (s, tone) => (s.p[2] > 19 ? tone(ramp("#3a5aa8")) : tone(porcelain)) }));
    },
  },
  lampstand: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 6,
    light: { color: "#ffd070", radius: 50, dy: 22 },
    paint: (r, f, n) => {
      r.prism(0, 0, 6, 0, 3, 8, md(PAL.stone, 1), Math.PI / 8);
      r.sweep([[0, 0, 3], [0, 0, 26]], 1.1, m(BRONZE, 2));
      // seven oil lamps on three tiers, each flame on its own rhythm
      const lamps: [number, number, number][] = [[0, 0, 27]];
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        lamps.push([Math.cos(a) * (k % 2 ? 5 : 7), Math.sin(a) * (k % 2 ? 5 : 7), k % 2 ? 21 : 14]);
      }
      lamps.forEach(([x, y, z], k) => {
        if (k) r.sweep([[0, 0, z - 1], [x, y, z - 1]], 0.4, m(BRONZE, 2));
        r.cone(x, y, 1.6, z - 1.5, 2.2, z, 8, m(BRONZE, 3));
        const fl = 1 + Math.sin((f / n) * TAU + k * 1.9) * 0.3;
        r.sweep([[x, y, z], [x, y, z + 2.4 * fl]], [0.8, 0.1], m(FIRE, 4));
      });
    },
  },
  statue: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const jadeStone = md(ramp("#9ad0b8", { lo: "#1a4a4a" }), 1);
      r.prism(0, 0, 9, 0, 4, 8, md(PAL.stone, 1), Math.PI / 8);
      r.cone(0, 0, 8, 4, 6, 7, 8, m(PAL.gold, 2, { shader: (s, tone) => (Math.sin(Math.atan2(s.p[1], s.p[0]) * 8) > 0.3 ? tone(PAL.gold) : tone(PAL.rose)) }), Math.PI / 8);
      r.ellipsoid([0, 0, 11], [7, 6, 4.6], jadeStone);
      r.ellipsoid([0, 0, 17], [4.6, 3.8, 6], jadeStone);
      r.sphere([0, 1, 26], 3.6, jadeStone);
      r.sphere([0, 0.5, 30], 1.6, jadeStone);
      for (const sx of [-1, 1]) r.sweep([[sx * 4.4, 0, 21], [sx * 4, 3, 15], [sx * 1, 4, 13]], 1.4, jadeStone);
      r.sphere([0, 4.4, 13.4], 1.4, jadeStone);
    },
  },
  swordrack: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      for (const x of [-6, 6]) r.box([x - 0.8, -11, 18], [x + 0.8, -8.6, 21], m(PAL.woodDark, 1));
      r.box([-9, -9.6, 20.6], [9, -8.2, 22.4], m(ramp("#3a6ab0"), 2, { shader: (s, tone) => (Math.abs(s.p[0]) < 1 ? tone(PAL.gold) : tone(ramp("#3a6ab0"))) }));
      r.sweep([[-9, -8.8, 21.5], [-12, -8.8, 21.5]], 0.6, m(PAL.gold, 3));
      r.sweep([[9, -8.8, 21.5], [11, -8.8, 18]], [0.5, 0.3], m(ramp("#6aa0d0"), 4));
      r.box([-8, -11, 0], [8, -6, 9], m(PAL.wood, 5));
      r.ellipsoid([-3, -8.4, 10.6], [2.4, 2.4, 1.6], m(ramp("#e8e0d0"), 6));
    },
  },
  laundry: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 6,
    paint: (r, f, n) => {
      const a: V3 = [-13, 13, 0];
      const b: V3 = [13, -13, 0];
      for (const p of [a, b]) r.sweep([p, add(p, [0, 0, 26])], 0.9, m(PAL.woodDark, 1));
      const cloth = [PAL.azure, PAL.white, PAL.red, ramp("#e8d8a0")];
      for (let k = 0; k < 4; k++) {
        const u = 0.18 + k * 0.21;
        const top: V3 = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 25 - Math.sin(u * Math.PI) * 3];
        const w = Math.sin((f / n) * TAU + k * 1.4) * 1.8;
        r.sweep([top, add(top, [w * 0.7 + 1.2, -w * 0.7 + 1.2, -8])], [2.6, 2.2], m(cloth[k], 2 + k));
      }
      for (let k = 0; k < 8; k++) {
        const u0 = k / 8;
        const u1 = (k + 1) / 8;
        const p0: V3 = [a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0, 25 - Math.sin(u0 * Math.PI) * 3];
        const p1: V3 = [a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1, 25 - Math.sin(u1 * Math.PI) * 3];
        r.sweep([p0, p1], 0.25, m(PAL.black, 6));
      }
    },
  },
  // a festival string of red lanterns between two poles, swinging in the breeze
  lanterns: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 5,
    light: { color: "#ff7a40", radius: 50, dy: 26 },
    paint: (r, f, n) => {
      const a: V3 = [-24, 24, 0];
      const b: V3 = [24, -24, 0];
      for (const p of [a, b]) {
        r.sweep([p, add(p, [0, 0, 36])], 1, m(PAL.woodDark, 1));
        r.sphere(add(p, [0, 0, 36.6]), 1.3, m(PAL.gold, 1));
      }
      const at = (u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, 34 - Math.sin(u * Math.PI) * 6];
      for (let k = 0; k < 10; k++) r.sweep([at(k / 10), at((k + 1) / 10)], 0.25, m(PAL.black, 2));
      for (let k = 0; k < 5; k++) {
        const u = 0.17 + k * 0.165;
        const top = at(u);
        const sw = Math.sin((f / n) * TAU + k * 1.3) * 1.6;
        const c: V3 = add(top, [sw * 0.7, -sw * 0.7, -4.6]);
        r.sweep([top, c], 0.2, m(PAL.black, 3 + k));
        r.ellipsoid(c, [2.2, 2.2, 2.8], m(k % 2 ? ramp("#ff5a3a", { hi: "#ffd27a", lo: "#7a1020" }) : ramp("#f0402a", { hi: "#ffc070", lo: "#6a0a1a" }), 3 + k, { shader: (s, tone) => (Math.abs(s.n[2]) > 0.8 ? tone(PAL.gold) : Math.sin(Math.atan2(s.n[1], s.n[0]) * 6) > 0.8 ? tone(PAL.red, 1) : tone(PAL.red, -1)) }));
        r.sweep([add(c, [0, 0, -2.8]), add(c, [sw * 0.5, -sw * 0.5, -5.2])], [0.5, 0.2], m(PAL.gold, 3 + k));
      }
    },
  },
  // a bronze temple bell in a wooden frame; now and then it swings and rings
  bell: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 12,
    fps: 6,
    paint: (r, f, n) => {
      for (const x of [-9, 9]) {
        r.box([x - 1.2, -1.2, 0], [x + 1.2, 1.2, 30], m(PAL.woodDark, 1));
        r.box([x - 2, -2, 0], [x + 2, 2, 2], m(PAL.stone, 1));
      }
      r.box([-12, -1.6, 29], [12, 1.6, 32], m(PILLAR, 2));
      r.hipRoof(0, 0, 15, 6, 32, 9, 0.5, 38, md(ROOF_GREY, 3, { shader: roofTiles(ROOF_GREY) }));
      // it swings for the first half of the loop and hangs still for the rest
      const swing = f < n / 2 ? Math.sin((f / (n / 2)) * TAU) * 0.32 * (1 - f / (n / 2)) : 0;
      const pivot: V3 = [0, 0, 28.6];
      const hang = (l: number, x = 0): V3 => [x, Math.sin(swing) * l, pivot[2] - Math.cos(swing) * l];
      r.sweep([pivot, hang(3)], 0.5, m(PAL.black, 4));
      r.cone(hang(9)[0], hang(9)[1], 5.4, hang(16)[2], 3, hang(4)[2], 14, md(BRONZE, 5, { shader: (s, tone) => (Math.abs(s.p[2] - hang(13)[2]) < 0.6 || Math.abs(s.p[2] - hang(7)[2]) < 0.5 ? tone(BRONZE, 1) : tone(BRONZE)) }));
      r.sphere(hang(3.6), 3, md(BRONZE, 5));
      // the wooden striker on its ropes
      r.sweep([[12, -6, 21], [4, -6, 21]], 1.1, m(PAL.wood, 6));
      for (const x of [6, 10]) r.sweep([[x, -6, 21], [x, -1.6, 30]], 0.2, m(PAL.black, 6));
    },
  },
  // a paper kite on a long string, tied to a stake: it bobs and its tail ripples
  kite: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 4,
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      r.sweep([[0, 0, 0], [0, 0, 5]], 0.6, m(PAL.woodDark, 1));
      const kite: V3 = [14 + Math.sin(ph) * 2, -14 + Math.sin(ph) * 2, 96 + Math.cos(ph) * 3];
      // the string sags in a long curve
      const pts: V3[] = [];
      for (let k = 0; k <= 10; k++) {
        const u = k / 10;
        pts.push([kite[0] * u, kite[1] * u, 5 + (kite[2] - 5) * u - Math.sin(u * Math.PI) * 10]);
      }
      r.sweep(pts, 0.2, m(PAL.paper, 2));
      const tilt = Math.sin(ph * 2) * 1.5;
      const top = add(kite, [tilt * 0.3, -tilt * 0.3, 7]);
      const bottom = add(kite, [-tilt * 0.3, tilt * 0.3, -8]);
      const left = add(kite, [-6, -6, 1]);
      const right = add(kite, [6, 6, 1]);
      const red = m(PAL.red, 3, { shader: (s, tone) => (Math.abs(s.p[2] - kite[2] - 1) < 1.2 ? tone(PAL.gold) : tone(PAL.red)) });
      // a diamond of paper over a cross of bamboo
      for (const [p, q] of [
        [top, left],
        [left, bottom],
        [bottom, right],
        [right, top],
      ] as [V3, V3][])
        r.sweep([p, q], 0.5, m(PAL.woodDark, 4));
      r.sweep([top, bottom], 3.4, red);
      r.sweep([left, right], 2.2, red);
      r.sweep([top, bottom], 0.35, m(PAL.woodDark, 4));
      r.sweep([left, right], 0.35, m(PAL.woodDark, 4));
      // and a tail of little bows, rippling
      let prev = bottom;
      for (let k = 1; k <= 5; k++) {
        const p: V3 = add(bottom, [Math.sin(ph * 2 + k) * 1.6, -k * 2.2, -k * 3.4]);
        r.sweep([prev, p], 0.2, m(PAL.paper, 5));
        r.sphere(p, 0.9, m(k % 2 ? PAL.gold : PAL.jade, 5));
        prev = p;
      }
    },
  },
  // the almanac's sundial: a bronze dial tilted to the sky on a stone drum; one frame per two hours, its gnomon's shadow swinging round
  sundial: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 12,
    fps: 1,
    paint: (r, f, n) => {
      r.prism(0, 0, 8, 0, 9, 10, md(PAL.stone, 1));
      r.prism(0, 0, 9.2, 9, 11, 10, m(PAL.stone, 1));
      // the dial face, its rim marked with the twelve watches
      const hour = (f / n) * 24;
      const sun = hour >= 6 && hour <= 18;
      const ang = ((hour - 12) / 12) * Math.PI;
      const bronze = ramp("#d8a858", { lo: "#4a2a10" });
      r.prism(0, 0, 7.4, 11, 12.4, 16, m(bronze, 2, { shader: (sv, tone) => {
        if (sv.n[2] < 0.5) return tone(bronze);
        const d = Math.hypot(sv.p[0], sv.p[1]);
        const a = Math.atan2(sv.p[1], sv.p[0]);
        // the brass pointer of the watch now passing, bright on the rim
        const watch = (hour / 24) * TAU;
        if (d > 5.2 && Math.abs(Math.atan2(Math.sin(a - watch), Math.cos(a - watch))) < 0.22) return "#fff0a0";
        if (d > 6 && Math.abs(Math.sin(a * 6)) < 0.18) return "#3a2410";
        // the shadow of the gnomon, long at morning and evening, short at noon
        if (sun) {
          const sa = ang + Math.PI / 2;
          const along = sv.p[0] * Math.cos(sa) + sv.p[1] * Math.sin(sa);
          const across = -sv.p[0] * Math.sin(sa) + sv.p[1] * Math.cos(sa);
          if (along > 0 && along < 2 + Math.abs(hour - 12) * 0.6 && Math.abs(across) < 0.8) return "#3a2a30";
        }
        return tone(bronze, d < 2 ? 1 : 0);
      } }));
      r.sweep([[0, 0, 12.4], [0, -2.4, 18]], 0.5, m(bronze, 3));
    },
  },
  // a snowman with a coal-black grin, a carrot nose and a straw hat (winter, in the villages)
  snowman: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const snow = ramp("#ffffff", { lo: "#8a9ab8" });
      r.sphere([0, 0, 6], 6.4, m(snow, 1));
      r.sphere([0, 0, 15], 4.6, m(snow, 1));
      r.sphere([0, 0, 22], 3.4, m(snow, 1, { shader: (sv, tone) => (sv.n[1] > 0.6 && Math.abs(sv.p[0]) > 0.6 && Math.abs(sv.p[0]) < 1.6 && Math.abs(sv.p[2] - 23) < 0.6 ? "#1a1428" : tone(snow)) }));
      r.sweep([[0, 3, 22], [0, 6, 21.6]], [0.7, 0.1], m(PAL.orange, 2));
      for (const k of [-1, 1]) r.sweep([[k * 4, 0, 15], [k * 8, 0.6, 19]], 0.35, m(PAL.woodDark, 2));
      r.cone(0, 0, 4.4, 24.4, 0.6, 27.4, 10, m(PAL.straw, 3));
      r.sweep([[-3, 3, 18], [0, 4.4, 18.6], [3, 3, 18]], 0.7, m(PAL.red, 3));
    },
  },
  // a heap of raked leaves, a few blowing off the top (autumn)
  leafpile: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 4,
    fps: 3,
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      r.ellipsoid([0, 0, 0], [8, 7, 5], md(MAPLE, 1, { shader: (sv, tone) => tone(MAPLE, hash2(Math.floor(sv.p[0] * 1.4), Math.floor(sv.p[1] * 1.4 + sv.p[2]), 3) > 0.6 ? 1 : 0) }));
      for (let k = 0; k < 3; k++) r.sphere([Math.cos(ph + k * 2) * 6, Math.sin(ph + k * 2) * 6, 6 + k * 2 + Math.sin(ph * 2 + k) * 1.4], 0.9, m(k % 2 ? MAPLE : LEAVES, 2));
    },
  },
  // persimmons strung up to dry under the eaves, glowing orange (autumn)
  persimmons: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      for (const k of [-1, 1]) r.sweep([[k * 8, -k * 8, 0], [k * 8, -k * 8, 26]], 0.8, m(PAL.woodDark, 1));
      r.sweep([[-8, 8, 25], [8, -8, 25]], 0.7, m(PAL.woodDark, 1));
      for (let s = 0; s < 5; s++) {
        const x = -6 + s * 3;
        r.sweep([[x, -x, 25], [x, -x, 9]], 0.15, m(PAL.straw, 2));
        for (let k = 0; k < 4; k++) r.sphere([x, -x, 22 - k * 3.6], 1.5, m(ramp("#ffa040", { lo: "#8a2a10" }), 3));
      }
    },
  },
  // a nursery bed of green rice seedlings in rows, nodding (spring)
  seedbed: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 4,
    fps: 2,
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      r.box([-8, -8, 0], [8, 8, 1.4], m(ramp("#6a5a3a", { lo: "#2a1a10" }), 1));
      for (let a = -6; a <= 6; a += 3) for (let b = -6; b <= 6; b += 3) r.sweep([[a, b, 1.4], [a + Math.sin(ph + a) * 0.6, b, 5]], 0.4, m(PAL.green, 2));
    },
  },
  // a village forge: a brick furnace roaring under its hood, bellows that breathe, and an anvil
  forge: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 8,
    light: { color: "#ff7a30", radius: 48, dy: 14 },
    emit: "embers",
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const brick = md(ramp("#a85a42", { lo: "#3a1a1a" }), 1, { shader: (s, tone) => ((Math.floor(s.p[2] / 2.4) % 2 ? Math.sin(s.p[0] * 1.3) : Math.sin(s.p[0] * 1.3 + 1.6)) > 0.92 || s.p[2] % 2.4 < 0.4 ? tone(ramp("#a85a42", { lo: "#3a1a1a" }), 2) : tone(ramp("#a85a42", { lo: "#3a1a1a" }))) });
      r.box([-8, -9, 0], [6, 3, 14], brick);
      // the glowing mouth of the furnace on its front face
      r.box([-4.6, 2.6, 3], [2.6, 3.4, 9], m(FIRE, 2, { shader: (s, tone) => tone(FIRE, Math.sin(s.p[0] * 0.9 + ph * 2) > 0.3 ? -1 : 0) }));
      for (let k = 0; k < 4; k++) {
        const x = -3.6 + k * 1.9;
        r.sweep([[x, 0, 14], [x + Math.sin(ph + k) * 0.6, 0, 16.5 + Math.sin(ph * 2 + k * 1.7) * 1.6]], [1.4, 0.2], m(FIRE, 3));
      }
      // a stone hood and its chimney
      r.cone(-1, -3, 9, 14.5, 3.6, 22, 4, md(PAL.stone, 4), Math.PI / 4);
      r.prism(-1, -3, 2.6, 22, 34, 4, md(PAL.stone, 4), Math.PI / 4);
      // the leather bellows, swelling and emptying
      const b = 1.4 + Math.max(0, Math.sin(ph)) * 1.4;
      r.ellipsoid([-11.4, -3, 6], [2.6, 4, b], m(ramp("#6a4a30"), 5));
      r.sweep([[-11.4, -3, 6 + b], [-14, -3, 10 - b * 0.6]], 0.6, m(PAL.woodDark, 5));
      // the anvil on its stump, in front of the furnace
      r.prism(8, 9, 2.6, 0, 6, 8, m(BARK, 6));
      r.box([5.4, 7.8, 6], [10.6, 10.2, 8.6], m(ramp("#6a6a7a", { lo: "#141420" }), 7));
      r.sweep([[10.6, 9, 7.8], [13, 9, 7.6]], [1, 0.3], m(ramp("#6a6a7a", { lo: "#141420" }), 7));
      // a red-hot blade cooling on it
      r.sweep([[6, 9, 9], [10, 9.4, 9]], [0.6, 0.25], m(f % 4 < 2 ? FIRE : tones("#ffe0a0", "#ff9040", "#c84020", "#6a1a10"), 8));
    },
  },
  // the Sword Tomb: a cairn bristling with the swords of the fallen, glinting in turn
  swordtomb: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 8,
    fps: 5,
    emit: "sparkle",
    paint: (r, f, n) => {
      const st = md(PAL.stone, 1, { shader: (s, tone) => (fbm(s.p[0] * 0.3, s.p[1] * 0.3 + s.p[2] * 0.2, 5) > 0.6 ? tone(ramp("#6a8a5a", { lo: "#1a2a1a" })) : tone(PAL.stone)) });
      r.ellipsoid([0, 0, 0], [20, 20, 10], st);
      r.ellipsoid([-2, 2, 7], [10, 10, 7], st);
      const glint = f;
      for (let k = 0; k < 13; k++) {
        const a = k * 2.399;
        const d = 3 + (k % 5) * 3.2;
        const base: V3 = [Math.cos(a) * d, Math.sin(a) * d, Math.max(2, 13 - d * 0.75)];
        const tilt: V3 = [Math.cos(a) * 3 + Math.sin(k) * 2, Math.sin(a) * 3, 15 + (k % 3) * 3];
        const tip = add(base, tilt);
        const bright = k % n === glint;
        const blade = bright ? tones("#ffffff", "#ffffff", "#dfe8f4", "#9aaccc") : PAL.steel;
        r.sweep([base, tip], [0.9, 0.2], m(blade, 2 + (k % 4)));
        // crossguard and grip poke out of the stones
        const g0 = add(base, [tilt[0] * 0.05, tilt[1] * 0.05, -0.6]);
        r.sweep([add(g0, [-1.6, 1.6, 0]), add(g0, [1.6, -1.6, 0])], 0.45, m(k % 3 ? BRONZE : PAL.gold, 2 + (k % 4)));
      }
      // one great sword stands upright at the summit, a red tassel stirring
      r.sweep([[-2, 2, 13], [-2, 2, 38]], [1.6, 0.3], m(PAL.steel, 6));
      r.sweep([[-5, 5, 13.5], [1, -1, 13.5]], 0.8, m(PAL.gold, 7));
      r.sweep([[-2, 2, 13], [-2, 2, 9]], 0.7, m(PAL.woodDark, 7));
      const sw = Math.sin((f / n) * TAU) * 1.2;
      r.sweep([[-2, 2, 9], [-2 + sw, 2 - sw, 4.6]], [0.6, 0.2], m(PAL.red, 8));
    },
  },
  // a peach tree, heavy with blossom and fruit, swaying in the breeze
  peachtree: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.0,
    frames: 6,
    fps: 4,
    emit: "petals",
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [-1, 1, 10], [2, -1, 18]], [2.6, 2, 1.4], m(BARK, 1));
      r.sweep([[-1, 1, 10], [-7, 4, 20]], [1.4, 0.8], m(BARK, 1));
      const leaf = ramp("#6aa84a", { lo: "#1a4a2a" });
      const blobs: [number, number, number, number][] = [
        [2, -2, 28, 10],
        [-7, 5, 25, 8.5],
        [7, 5, 23, 7.5],
        [-3, -7, 24, 7.5],
      ];
      // pink blossom over a few patches of fresh green
      blobs.forEach(([x, y, z, rr], k) =>
        r.sphere(add([x, y, z], swayAt(f, n, z, 1.6)), rr, md(BLOSSOM, 2 + k, { shader: (s, tone) => (fbm(s.p[0] * 0.5 + k, s.p[1] * 0.5 + s.p[2] * 0.3, 21 + k) > 0.62 ? tone(leaf) : tone(BLOSSOM, s.n[2] > 0.5 ? -1 : s.n[2] < -0.2 ? 1 : 0)) })),
      );
      // ripe peaches peeping from the leaves
      for (let k = 0; k < 6; k++) {
        const [x, y, z, rr] = blobs[k % 4];
        const a = k * 1.9;
        const p = add([x + Math.cos(a) * rr * 0.8, y + Math.sin(a) * rr * 0.8, z - rr * 0.45], swayAt(f, n, z, 1.6));
        r.sphere(p, 1.5, m(tones("#fff0c0", "#ffa070", "#e8504a", "#8a1a3a"), 6));
      }
    },
  },
  // a straw beehive skep on a stand, with bees looping round it
  beehive: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 10,
    paint: (r, f, n) => {
      r.box([-5, -5, 0], [5, 5, 6], m(PAL.woodDark, 1));
      r.ellipsoid([0, 0, 6], [6, 6, 9], md(PAL.straw, 2, { shader: (s, tone) => (Math.sin(s.p[2] * 1.6) > 0.6 ? tone(PAL.straw, 1) : tone(PAL.straw)) }));
      r.box([-1.2, 5.4, 7], [1.2, 6, 8.6], m(PAL.black, 3));
      for (let k = 0; k < 5; k++) {
        const a = (f / n) * TAU * (k % 2 ? 1 : -1) + k * 1.3;
        const rr = 8 + (k % 3) * 2.4;
        r.sphere([Math.cos(a) * rr, Math.sin(a) * rr, 10 + Math.sin(a * 2 + k) * 4], 0.9, m(k % 2 ? PAL.gold : tones("#fff0a0", "#3a3a3a", "#2a2238", "#120c22"), 4));
      }
    },
  },
  // a lonely grave mound with a stone tablet and a stick of incense
  grave: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    emit: "incense",
    paint: (r) => {
      r.ellipsoid([0, -2, 0], [8, 7, 5], md(ramp("#6a8a4a", { lo: "#1a2a1a" }), 1));
      r.box([-4, 3, 0], [4, 5, 13], md(PAL.stone, 2, { shader: (s, tone) => (Math.abs(s.p[0]) < 1 && s.p[2] > 3 && s.p[2] < 11 && Math.floor(s.p[2]) % 3 ? "#2a2238" : tone(PAL.stone)) }));
      r.cone(0, 4, 4.6, 13, 3.4, 14.6, 4, md(PAL.stone, 2), Math.PI / 4);
      r.cone(0, 8, 2, 0, 1.6, 2, 8, m(BRONZE, 3));
      r.sweep([[0, 8, 2], [0, 8, 7]], 0.25, m(PAL.red, 4));
    },
  },
  // ghostly will-o'-wisps that drift and bob above the ground
  wisps: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 5,
    light: { color: "#8ad0ff", radius: 36, dy: 18 },
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      for (let k = 0; k < 3; k++) {
        const a = ph + (k * TAU) / 3;
        const c: V3 = [Math.cos(a) * 7, Math.sin(a) * 7, 14 + Math.sin(ph * 2 + k * 2) * 3 + k * 2];
        r.sphere(c, 1.8, m(tones("#ffffff", "#c8f0ff", "#6ab0ff", "#3a5aa8"), 1 + k, { outline: undefined }));
        r.sweep([c, add(c, [Math.cos(a + 1.6) * 3, Math.sin(a + 1.6) * 3, -1.4])], [1.2, 0.2], m(tones("#e8f8ff", "#9ad8ff", "#5a9ae8", "#3a5aa8"), 1 + k, { outline: undefined }));
      }
    },
  },
  // festival fireworks: a rocket climbs from its stand and bursts into a chrysanthemum of sparks that drift down
  fireworks: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 14,
    fps: 7,
    light: { color: "#ffb060", radius: 44, dy: 8 },
    paint: (r, f, n) => {
      r.box([-2.6, -2.6, 0], [2.6, 2.6, 4], m(PAL.red, 1));
      r.sweep([[0, 0, 4], [0, 0, 8]], 0.6, m(PAL.gold, 1));
      const rise = 4;
      const cols = [PAL.gold, PAL.rose, PAL.qi, tones("#ffffff", "#ffb040", "#f0601e", "#a81a10")];
      if (f < rise) {
        const z = 12 + (f / rise) * 84;
        r.sweep([[0, 0, z - 12], [0, 0, z]], [0.2, 1.2], m(FIRE, 2));
        return;
      }
      const k = (f - rise) / (n - rise);
      const rad = 8 + Math.sqrt(k) * 34;
      const c: V3 = [0, 0, 100 - k * 14];
      for (let s = 0; s < 22; s++) {
        const a = (s / 22) * TAU;
        const e = Math.sin(s * 2.1) * 0.7;
        const dir: V3 = [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
        const fall = k * k * 12;
        const tip = add(c, [dir[0] * rad, dir[1] * rad, dir[2] * rad - fall]);
        const tail = add(c, [dir[0] * rad * 0.6, dir[1] * rad * 0.6, dir[2] * rad * 0.6 - fall * 0.5]);
        // the sparks thin out and wink as the burst fades
        if (k > 0.75 && (s + f) % 3 === 0) continue;
        r.sweep([tail, tip], [0.3, k > 0.8 ? 0.6 : 1.3], m(cols[s % cols.length], 3, { outline: undefined }));
      }
    },
  },
  // a clipped row of tea bushes on the terraces, shivering in the hill wind, new leaves bright at the tips
  teabush: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      const tea = ramp("#4a9a4a", { lo: "#103a26" });
      for (let k = 0; k < 3; k++) {
        const x = -7 + k * 7;
        const sw = swayAt(f + k, n, 10, 0.9);
        r.ellipsoid(add([x, -x * 0.2, 6], sw), [6, 6, 6.4], md(tea, 1 + k, { shader: (s, tone) => (s.n[2] > 0.55 && hash2(Math.floor(s.p[0] * 0.8), Math.floor(s.p[1] * 0.8), 7) > 0.6 ? tone(ramp("#a8e070", { lo: "#3a6a2a" })) : leafShader(tea, k + 11)(s, tone)) }));
      }
    },
  },
  // three koi circling just under the surface of a pond, flicking their tails
  koi: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 12,
    fps: 6,
    paint: (r, f, n) => {
      const cols = [PAL.orange, PAL.white, PAL.gold];
      for (let k = 0; k < 3; k++) {
        const a = (f / n) * TAU + (k * TAU) / 3;
        const rad = 6 + k * 1.6;
        const c: V3 = [Math.cos(a) * rad, Math.sin(a) * rad, -1.2];
        const d: V3 = [-Math.sin(a), Math.cos(a), 0];
        const flick = Math.sin((f / n) * TAU * 4 + k) * 0.8;
        const tail: V3 = [c[0] - d[0] * 4 + d[1] * flick, c[1] - d[1] * 4 - d[0] * flick, -1.2];
        r.sweep([add(c, [d[0] * 2.6, d[1] * 2.6, 0]), c, tail], [1.3, 1.5, 0.4], m(cols[k], 1 + k, { outline: undefined, shader: (s, tone) => (k === 1 && hash2(Math.floor(s.p[0]), Math.floor(s.p[1]), 3) > 0.6 ? tone(PAL.red) : tone(cols[k])) }));
        r.sweep([tail, add(tail, [-d[0] * 1.6 + d[1] * flick, -d[1] * 1.6 - d[0] * flick, 0])], [1.2, 0.2], m(cols[k], 1 + k, { outline: undefined }));
      }
    },
  },
  // butterflies dancing over a patch of wildflowers
  butterflies: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 8,
    paint: (r, f, n) => {
      for (let k = 0; k < 6; k++) {
        const a = k * 1.1;
        r.sweep([[Math.cos(a) * 6, Math.sin(a) * 6, 0], [Math.cos(a) * 6, Math.sin(a) * 6, 3]], 0.3, m(PAL.green, 1));
        r.sphere([Math.cos(a) * 6, Math.sin(a) * 6, 3.4], 1, m([PAL.rose, PAL.gold, PAL.white][k % 3], 1));
      }
      const wings = [PAL.gold, tones("#ffffff", "#c8e8ff", "#7aa8e8", "#3a5aa8"), PAL.rose];
      for (let k = 0; k < 3; k++) {
        const ph = (f / n) * TAU + k * 2.1;
        const c: V3 = [Math.cos(ph) * (7 + k * 2), Math.sin(ph * 2) * 5, 10 + k * 4 + Math.sin(ph * 3) * 2.4];
        const flap = f % 2 === k % 2 ? 2.4 : 0.6;
        for (const s of [-1, 1]) r.ellipsoid(add(c, [s * 1.4, -s * 1.4, flap * 0.5]), [1.8, 1.8, flap], m(wings[k], 2 + k, { outline: undefined }));
        r.sphere(c, 0.5, m(PAL.black, 2 + k, { outline: undefined }));
      }
    },
  },
  // a junk riding at anchor: battened sails stirring, a lantern at the stern, bobbing on the swell
  ship: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 3,
    light: { color: "#ffb060", radius: 26, dy: 22 },
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const bob = Math.sin(ph) * 0.8;
      const roll = Math.sin(ph) * 0.06;
      const hull = ramp("#8a4a2a", { lo: "#2a0a10" });
      r.ellipsoid([0, 0, 2 + bob], [8, 22, 5], m(hull, 1, { shader: (s, tone) => (s.n[2] > 0.75 ? tone(PAL.wood) : Math.abs(s.p[2] - 3 - bob) < 0.6 ? tone(PAL.red) : tone(hull)) }));
      r.box([-6, 10, 3 + bob], [6, 20, 11 + bob], m(PAL.woodDark, 2));
      r.hipRoof(0, 15, 7, 6, 11 + bob, 4, 3, 15 + bob, m(ROOF_RED, 3));
      for (const [y, h, w] of [
        [-6, 46, 9],
        [5, 38, 7],
      ] as [number, number, number][]) {
        const top: V3 = [roll * h, y, h + bob];
        r.sweep([[0, y, 3 + bob], top], 0.8, m(PAL.woodDark, 4));
        const billow = Math.sin(ph + y) * 1.2;
        // a battened sail of red-brown matting
        r.convex(
          [
            { n: [1, 0, 0] as V3, d: 0.8 + billow + roll * h },
            { n: [-1, 0, 0] as V3, d: 0.8 - billow - roll * h },
            { n: [0, 1, 0] as V3, d: y + w },
            { n: [0, -1, 0] as V3, d: -(y - w) },
            { n: [0, 0, 1] as V3, d: h - 1 + bob },
            { n: [0, 0, -1] as V3, d: -(h * 0.35 + bob) },
          ],
          [-1 + billow + roll * h, y - w, h * 0.35 + bob],
          [1 + billow + roll * h, y + w, h + bob],
          m(ramp("#b0603a", { lo: "#3a1420" }), 5, { shader: (s, tone) => (Math.sin(s.p[2] * 1.1) > 0.85 ? tone(PAL.woodDark) : tone(ramp("#b0603a", { lo: "#3a1420" }))) }),
        );
      }
      r.ellipsoid([0, 21, 15 + bob], [1.4, 1.4, 1.8], m(PAL.red, 6));
    },
  },
  // a stone lighthouse on the harbour point: its lamp turns, throwing a beam over the sea
  lighthouse: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 4,
    light: { color: "#fff0a0", radius: 56, dy: 70 },
    paint: (r, f, n) => {
      const tower = md(WALL, 1, { shader: (s, tone) => (Math.floor(s.p[2] / 12) % 2 ? tone(PAL.red) : tone(WALL)) });
      r.prism(0, 0, 10, 0, 4, 8, m(PAL.stone, 1));
      r.cone(0, 0, 8, 4, 5, 60, 10, tower);
      r.prism(0, 0, 7, 60, 62, 8, m(PAL.woodDark, 2));
      r.prism(0, 0, 4.4, 62, 70, 8, m(tones("#fffbe0", "#fff0a0", "#f2c55c", "#c08a30"), 3, { outline: undefined }));
      r.cone(0, 0, 6.6, 70, 0.6, 77, 8, md(ROOF_RED, 4));
      // the beam sweeps round, long when it points across the screen
      const a = (f / n) * TAU;
      const d: V3 = [Math.cos(a), Math.sin(a), 0];
      r.sweep([[d[0] * 4, d[1] * 4, 66], [d[0] * 34, d[1] * 34, 64]], [1.6, 5], m(tones("#ffffff", "#fffbe0", "#fff0a0", "#f2c55c"), 5, { outline: undefined }));
    },
  },
  // a great bronze incense burner on three legs, its smoke curling up
  censer: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    emit: "incense",
    paint: (r) => {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.4;
        r.sweep([[Math.cos(a) * 5, Math.sin(a) * 5, 0], [Math.cos(a) * 4, Math.sin(a) * 4, 6]], [1.4, 1], m(BRONZE, 1));
      }
      r.ellipsoid([0, 0, 10], [8, 8, 5.6], md(BRONZE, 2, { shader: (s, tone) => (Math.abs(s.p[2] - 10) < 0.7 ? tone(PAL.gold) : tone(BRONZE)) }));
      for (const s of [-1, 1]) r.sweep([[s * 7, -s * 7, 13], [s * 8.4, -s * 8.4, 17]], 0.9, m(BRONZE, 3));
      r.cone(0, 0, 6, 15, 2.6, 21, 8, md(BRONZE, 4));
      r.sphere([0, 0, 22], 1.6, m(PAL.gold, 5));
      for (let k = 0; k < 3; k++) r.sweep([[-2 + k * 2, 0, 15], [-2 + k * 2, 0, 22]], 0.25, m(PAL.red, 6));
    },
  },
  // a house raised on stilts over the marsh, with a ladder and a reed-thatched roof
  stilthouse: {
    foot: [0, 0, 1, 1],
    blocks: true,
    frames: 1,
    fps: 1,
    emit: "smoke",
    paint: (r) => {
      const cx = T / 2;
      const cy = T / 2;
      const W = T * 0.75;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.sweep([[cx + sx * W, cy + sy * W, -2], [cx + sx * W, cy + sy * W, 12]], 1.3, m(PAL.woodDark, 1));
      r.box([cx - W - 3, cy - W - 3, 11], [cx + W + 3, cy + W + 3, 13], m(PAL.wood, 2));
      r.box([cx - W, cy - W, 13], [cx + W, cy + W, 30], md(ramp("#b08a5a", { lo: "#4a2a2a" }), 3, { shader: (s, tone) => {
        const fx = Math.abs(s.n[0]) > 0.5;
        const along = fx ? s.p[1] - cy : s.p[0] - cx;
        if (fx && s.n[0] > 0 && Math.abs(along) < 3.6 && s.p[2] < 25) return tone(PAL.woodDark);
        if (!fx && Math.abs(along) < 3 && Math.abs(s.p[2] - 22) < 2.4) return "#ffd890";
        return Math.sin(along * 1.4) > 0.8 ? tone(ramp("#b08a5a"), 1) : tone(ramp("#b08a5a"));
      } }));
      r.hipRoof(cx, cy, W + 6, W + 6, 30, W * 0.2, W * 0.2, 46, md(PAL.straw, 4, { shader: strawShaderProp }));
      // a ladder down to the water's edge by the door
      for (const o of [-2.4, 2.4]) r.sweep([[cx + W + 3, cy + o, 12], [cx + W + 9, cy + o, -1]], 0.5, m(PAL.wood, 5));
      for (let k = 1; k < 4; k++) r.sweep([[cx + W + 3 + k * 1.5, cy - 2.4, 12 - k * 3.2], [cx + W + 3 + k * 1.5, cy + 2.4, 12 - k * 3.2]], 0.35, m(PAL.wood, 5));
      // a railing round the deck with a fishing net hung over it, strings of drying peppers and a gourd by the door
      railing(r, [cx - W - 2.6, cy + W + 2.6, 13], [cx + W + 2.6, cy + W + 2.6, 13], m(PAL.wood, 6), 4.5);
      railing(r, [cx + W + 2.6, cy + 4, 13], [cx + W + 2.6, cy + W + 2.6, 13], m(PAL.wood, 6), 4.5);
      railing(r, [cx + W + 2.6, cy - W - 2.6, 13], [cx + W + 2.6, cy - 4, 13], m(PAL.wood, 6), 4.5);
      r.sweep([[cx - W, cy + W + 2.8, 17.5], [cx - 2, cy + W + 3.6, 14], [cx + 4, cy + W + 3.2, 17.5]], [0.6, 1.6, 0.6], m(ramp("#8a8a6a", { lo: "#2a2a1a" }), 7, { shader: (s, tone) => (Math.abs(((s.p[0] + 40) % 1.6) - 0.8) < 0.3 || Math.abs(((s.p[2] + 40) % 1.6) - 0.8) < 0.3 ? tone(ramp("#8a8a6a"), 1) : null) }));
      for (const o of [-W + 3, W - 3]) for (let k = 0; k < 4; k++) r.sphere([cx + W + 0.8, cy + o, 28 - k * 1.6], 0.8, m(PAL.red, 8));
      r.sphere([cx + W + 1.2, cy - 5.6, 21], 1.4, m(ramp("#c8a050"), 9));
      r.sphere([cx + W + 1.2, cy - 5.6, 23.2], 0.9, m(ramp("#c8a050"), 9));
    },
  },
  // a rack of fish drying in the sea wind, swinging on their strings
  fishrack: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      for (const s of [-1, 1]) r.sweep([[s * 9, -s * 9, 0], [s * 9, -s * 9, 20]], 0.8, m(PAL.woodDark, 1));
      r.sweep([[-10, 10, 19], [10, -10, 19]], 0.6, m(PAL.wood, 2));
      for (let k = 0; k < 5; k++) {
        const u = -7 + k * 3.5;
        const sw = Math.sin((f / n) * TAU + k * 1.2) * 1.2;
        const top: V3 = [u, -u, 19];
        const fish: V3 = [u + sw * 0.7, -u - sw * 0.7, 12];
        r.sweep([top, add(fish, [0, 0, 3])], 0.15, m(PAL.black, 3 + k));
        r.sweep([add(fish, [0, 0, 3]), fish, add(fish, [0, 0, -3])], [0.6, 1.4, 0.3], m(tones("#e8eef8", "#a8b8c8", "#6a7a8a", "#3a4a5a"), 3 + k));
        r.sweep([add(fish, [0, 0, -3]), add(fish, [0.8, -0.8, -4.4])], [0.9, 0.2], m(tones("#e8eef8", "#a8b8c8", "#6a7a8a", "#3a4a5a"), 3 + k));
      }
    },
  },
  // a pine under a fresh fall of snow, swaying stiffly
  snowpine: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.6,
    frames: 6,
    fps: 3,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 26]], [2.4, 1.2], m(BARK, 1));
      for (let i = 0; i < 4; i++) {
        const z = 12 + i * 9;
        const sw = swayAt(f, n, z, 1.2);
        r.cone(sw[0], sw[1], 12 - i * 2.4, z, 1.6 - i * 0.3, z + 13, 9, md(PINE, 2 + i, { shader: (s, tone) => (s.n[2] > 0.55 ? tone(PAL.white, s.n[2] > 0.8 ? -1 : 0) : tone(PINE, 1)) }), i * 0.4);
      }
    },
  },
  // a whitewashed stupa with a gilded spire, prayer flags fluttering from its tip
  stupa: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 4,
    paint: (r, f, n) => {
      r.box([-11, -11, 0], [11, 11, 5], md(WALL, 1));
      r.box([-8, -8, 5], [8, 8, 9], md(WALL, 1));
      r.ellipsoid([0, 0, 9], [8, 8, 9], md(WALL, 2));
      r.box([-3, -3, 17], [3, 3, 20], m(PAL.red, 3));
      r.cone(0, 0, 2.6, 20, 0.6, 36, 8, m(PAL.gold, 4, { shader: (s, tone) => (Math.sin(s.p[2] * 1.6) > 0.6 ? tone(PAL.gold, 1) : tone(PAL.gold)) }));
      const flags = [PAL.blue, PAL.white, PAL.red, PAL.green, PAL.gold];
      for (const dir of [-1, 1]) {
        const end: V3 = [dir * 18, dir * 2, 4];
        for (let k = 0; k < 5; k++) {
          const u = (k + 0.5) / 5;
          const p: V3 = [end[0] * u, end[1] * u, 34 - (34 - end[2]) * u - Math.sin(u * Math.PI) * 4];
          const flap = Math.sin((f / n) * TAU + k + dir) * 1.2;
          r.box(add(p, [-1.2, -0.3, -3]), add(p, [1.2 + flap * 0.3, 0.3 + flap, 0]), m(flags[k], 5 + k, { outline: undefined }));
        }
        r.sweep([[0, 0, 34], end], 0.15, m(PAL.black, 5));
      }
    },
  },
  // a noodle cart with a bubbling pot, steam rising off the broth
  noodlecart: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 5,
    emit: "steam",
    light: { color: "#ffb060", radius: 22, dy: 18 },
    paint: (r, f) => {
      r.box([-8, -6, 4], [8, 6, 12], m(PAL.wood, 1, { shader: (s, tone) => (Math.abs(s.n[1]) > 0.5 && Math.abs(s.p[0]) < 5 && Math.abs(s.p[2] - 8) < 2 ? tone(PAL.red) : tone(PAL.wood)) }));
      for (const x of [-6, 6]) r.prism(x, 7, 3.4, 1, 2.4, 10, m(PAL.woodDark, 2), Math.PI / 2);
      r.prism(-3, 0, 4, 12, 16, 10, m(ramp("#4a4a5a", { lo: "#141420" }), 3, { shader: (s, tone) => (s.n[2] > 0.5 ? tone(f % 2 ? PAL.paper : PAL.straw) : tone(ramp("#4a4a5a"))) }));
      for (const s of [-1, 1]) r.sweep([[s * 8, -6, 12], [s * 8, -6, 26]], 0.6, m(PAL.woodDark, 4));
      r.box([-10, -8, 26], [10, 2, 27], m(PAL.red, 5));
      r.ellipsoid([5, 0, 13], [2, 2, 1.2], m(PAL.white, 6));
      r.ellipsoid([7, 3, 13], [1.6, 1.6, 1], m(PAL.white, 6));
      r.ellipsoid([8, -6, 23], [1.6, 1.6, 2], m(PAL.red, 7));
    },
  },
  // a straw archery butt on a stand, a couple of arrows still in it
  target: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      for (const s of [-1, 1]) r.sweep([[s * 4, -4, 0], [s * 3, 0, 18]], 0.7, m(PAL.woodDark, 1));
      r.sweep([[0, 4, 0], [0, 0.5, 16]], 0.7, m(PAL.woodDark, 1));
      r.ellipsoid([0, 0, 16], [7.6, 1.6, 7.6], m(PAL.straw, 2, { shader: (s, tone) => {
        const rr = Math.hypot(s.p[0], s.p[2] - 16);
        if (s.n[1] < 0.6) return tone(PAL.straw);
        return rr < 1.8 ? tone(PAL.gold) : rr < 3.6 ? tone(PAL.red) : rr < 5.2 ? tone(PAL.azure) : tone(PAL.white);
      } }));
      r.sweep([[1, 2, 17], [3, 9, 18]], 0.25, m(PAL.wood, 3));
      r.sweep([[-2.4, 2, 14], [-3, 9, 13]], 0.25, m(PAL.wood, 3));
    },
  },
  // a great war drum on a red stand; now and then it booms and shivers
  drum: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 6,
    paint: (r, f) => {
      for (const s of [-1, 1]) r.sweep([[s * 9, s * 2, 0], [s * 8, 0, 18]], 1, m(PILLAR, 1));
      const shiver = f === 0 ? 0.6 : f === 1 ? -0.4 : 0;
      r.ellipsoid([0, 0, 18 + shiver], [9.6, 6, 9.6], m(PILLAR, 2, { shader: (s, tone) => (Math.abs(s.n[1]) > 0.8 ? tone(ramp("#f4e2c0", { lo: "#8a6a4a" })) : Math.abs(Math.abs(s.p[1]) - 4.4) < 0.5 ? tone(PAL.gold) : tone(PILLAR)) }));
      r.sweep([[0, 0, 28], [0, 0, 32]], 1.2, m(PAL.gold, 3));
    },
  },
  // a fan palm over the oasis, fronds tossing
  palm: {
    foot: [0, 0, 0, 0],
    blocks: true,
    size: 2.2,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      const top = add([3, -3, 34], swayAt(f, n, 34, 1.4));
      r.sweep([[0, 0, 0], [2, -1, 14], [3, -2, 26], top], [2.4, 2, 1.7, 1.3], m(BARK, 1, { shader: (s, tone) => (Math.sin(s.u * 40) > 0.6 ? tone(BARK, 1) : tone(BARK)) }));
      const frond = ramp("#5aa848", { lo: "#123a26" });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU + Math.sin((f / n) * TAU + k) * 0.08;
        const mid = add(top, [Math.cos(a) * 8, Math.sin(a) * 8, 3]);
        const tip = add(top, [Math.cos(a) * 15, Math.sin(a) * 15, -5 + Math.sin((f / n) * TAU + k) * 1.2]);
        r.sweep([top, mid, tip], [1.8, 2.2, 0.4], md(frond, 2 + k));
      }
      for (let k = 0; k < 3; k++) r.sphere(add(top, [Math.cos(k * 2) * 1.6, Math.sin(k * 2) * 1.6, -2]), 1.2, m(PAL.brown, 9));
    },
  },
  // a two-wheeled handcart loaded with sacks and a jar
  cart: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.box([-6, -9, 6], [6, 7, 8], m(PAL.wood, 1));
      for (const s of [-1, 1]) r.box([s * 6 - 0.6, -9, 8], [s * 6 + 0.6, 7, 12], m(PAL.wood, 1));
      for (const s of [-1, 1]) r.prism(s * 7, 0, 6, -0.8, 0.8, 12, m(PAL.woodDark, 2, { shader: (sf, tone) => (Math.hypot(sf.p[1], sf.p[2] - 6) < 1.4 ? tone(PAL.black) : tone(PAL.woodDark)) }), 0);
      for (const s of [-1, 1]) r.sweep([[s * 3, 7, 7], [s * 3, 18, 3]], 0.7, m(PAL.wood, 3));
      r.ellipsoid([-2, -4, 11], [3.4, 3.4, 3.6], m(PAL.straw, 4));
      r.ellipsoid([2.4, 1, 11], [3, 3, 3.2], m(PAL.straw, 4));
      r.ellipsoid([0, -7, 12], [2.4, 2.4, 3.4], m(ramp("#6a4a3a"), 5));
    },
  },
  // crates and wine jars stacked on the quay
  barrels: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.box([-9, -8, 0], [1, 2, 9], m(PAL.wood, 1, { shader: (s, tone) => (Math.abs(s.p[2] - 4.5) < 0.5 || Math.abs(s.p[0] + 4) < 0.5 ? tone(PAL.woodDark) : tone(PAL.wood)) }));
      r.box([-7, -6, 9], [0, 1, 15], m(PAL.wood, 2, { shader: (s, tone) => (Math.abs(s.p[2] - 12) < 0.5 ? tone(PAL.woodDark) : tone(PAL.wood)) }));
      const jar = ramp("#7a4a3a", { lo: "#2a1020" });
      for (const [x, y] of [
        [5, 4],
        [6, -4],
        [-2, 7],
      ] as [number, number][]) {
        r.ellipsoid([x, y, 5], [3.6, 3.6, 5], md(jar, 3));
        r.prism(x, y, 1.8, 9, 11, 8, m(PAL.red, 4));
      }
    },
  },
  // a stone fountain whose dragon spout throws a glittering arc into the basin
  fountain: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 8,
    emit: "sparkle",
    paint: (r, f, n) => {
      r.prism(0, 0, 10, 0, 5, 12, md(PAL.stone, 1, { shader: (s, tone) => (s.n[2] > 0.5 && Math.hypot(s.p[0], s.p[1]) < 8.4 ? tone(tones("#c8f0ff", "#6ab0e8", "#3a7ac0", "#1a3a7a"), Math.sin(Math.hypot(s.p[0], s.p[1]) * 1.4 - (f / n) * TAU) > 0.6 ? -1 : 0) : tone(PAL.stone)) }));
      r.prism(0, 0, 2.4, 5, 16, 8, md(PAL.stone, 2));
      r.sphere([0, 0, 17], 2.6, m(BRONZE, 3));
      const water = tones("#ffffff", "#c8f0ff", "#6ab0e8", "#3a7ac0");
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + Math.PI / 4;
        const pts: V3[] = [];
        for (let u = 0; u <= 1.001; u += 0.2) pts.push([Math.cos(a) * u * 7, Math.sin(a) * u * 7, 18 + u * 4 - u * u * 13]);
        r.sweep(pts, [0.9, 0.7, 0.6, 0.6, 0.5, 0.4], m(water, 4 + k, { outline: undefined }));
        const drop = ((f / n + k * 0.25) % 1) * 1;
        r.sphere([Math.cos(a) * drop * 7, Math.sin(a) * drop * 7, 18 + drop * 4 - drop * drop * 13 + 1], 0.6, m(water, 8, { outline: undefined }));
      }
    },
  },
  // ---------------------------------------------------------------- the four new deeps
  // a pillar of old blue ice where a drip froze for a thousand years, a glint running up it
  icecolumn: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 5,
    light: { color: "#9ad8ff", radius: 22, dy: 20 },
    paint: (r, f, n) => {
      const ice = ramp("#9ad0f0", { hi: "#ffffff", lo: "#2a4a7a" });
      const glint = ((f / n) * 44) % 44;
      const mat = md(ice, 1, { shader: (s, tone) => (Math.abs(s.p[2] - glint) < 1.6 ? "#ffffff" : tone(ice, Math.sin(s.p[2] * 0.7 + s.p[0]) > 0.7 ? -1 : 0)) });
      r.sweep(spline([[0, 0, 0], [1, -1, 12], [-1, 1, 26], [0, 0, 42]], 3), [5.4, 3.6, 2.8, 2.2, 3.4], mat);
      r.cone(4, 3, 3.2, 0, 0.3, 14, 6, m(ice, 2));
      r.cone(-4, -2, 2.6, 0, 0.3, 10, 6, m(ice, 3));
      r.cone(-1, 4, 2, 0, 0.2, 7, 6, m(ice, 4));
    },
  },
  // a stone coffin on a plinth, its lid carved with a sleeping queen and set with jade, two candles guttering at its head
  sarcophagus: {
    foot: [0, -1, 0, 1],
    blocks: true,
    frames: 6,
    fps: 6,
    light: { color: "#ffd070", radius: 30, dy: 14 },
    paint: (r, f, n) => {
      const sand = ramp("#c8aa78", { lo: "#4a3418" });
      r.box([-9, -T * 1.4, 0], [9, T * 1.4, 4], md(sand, 1));
      r.box([-7, -T * 1.2, 4], [7, T * 1.2, 13], m(sand, 2, { shader: (s, tone) => (Math.abs(((s.p[1] + 60) % 6) - 3) < 0.4 ? tone(sand, 1) : tone(sand)) }));
      r.box([-7.8, -T * 1.25, 13], [7.8, T * 1.25, 15], m(ramp("#d8c090", { lo: "#5a4420" }), 3));
      // the queen carved on the lid, hands folded over a disc of jade
      r.ellipsoid([0, -T * 0.6, 16.4], [3, 3, 2], m(sand, 4));
      r.ellipsoid([0, T * 0.1, 15.8], [4, T * 0.6, 1.6], m(sand, 4));
      r.sphere([0, -T * 0.1, 17.4], 1.6, m(PAL.jade, 5));
      for (const y of [-T * 0.9, T * 0.9]) r.sphere([0, y, 15.8], 0.9, m(PAL.jade, 5));
      for (const x of [-11, 11]) {
        r.prism(x, -T * 1.1, 1.1, 0, 7, 6, m(PAL.paper, 6));
        const fl = 1 + Math.sin((f / n) * TAU * 2 + x) * 0.25;
        r.ellipsoid([x, -T * 1.1, 8.6], [0.7, 0.7, 1.4 * fl], m(FIRE, 7, { outline: undefined }));
      }
    },
  },
  // a rock pool the tide leaves behind, ripples running across it and a crab picking its way round the rim
  tidepool: {
    foot: [0, 0, 0, 0],
    blocks: false,
    flat: true,
    frames: 8,
    fps: 5,
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const rock = md(ramp("#5a6a72", { lo: "#141c24" }), 1);
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        r.sphere([Math.cos(a) * 9, Math.sin(a) * 9, 0.5], 3 + hash2(k, 1, 3) * 1.4, rock);
      }
      const sea = ramp("#3a9ab0", { hi: "#c8f8ff", lo: "#0a2a3a" });
      r.prism(0, 0, 8, 0, 1.4, 12, m(sea, 2, { outline: undefined, shader: (s, tone) => (Math.abs(Math.hypot(s.p[0], s.p[1]) - ((f / n) * 8 + 1)) < 0.6 ? "#e8ffff" : tone(sea)) }));
      for (const [x, y, c] of [[-3, 2, PAL.rose], [3, -2, PAL.gold], [1, 4, PAL.jade]] as const) r.sphere([x, y, 0.8], 0.9, m(c, 3));
      const ca = ph * 0.5;
      const cx = Math.cos(ca) * 10;
      const cy = Math.sin(ca) * 10;
      const crab = ramp("#e0603a", { lo: "#6a1a10" });
      r.ellipsoid([cx, cy, 3.2], [1.8, 1.4, 0.9], m(crab, 4));
      for (const s of [-1, 1]) r.sweep([[cx + s * 1.4, cy, 3.4], [cx + s * 2.6, cy + 1, 3.8 + Math.sin(ph * 2) * 0.4]], 0.45, m(crab, 4));
    },
  },
  // roots of the bamboo above, hanging through the roof of the cave like a curtain and glowing faintly where the qi runs in them
  rootcurtain: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 4,
    light: { color: "#b8f0a0", radius: 20, dy: 26 },
    paint: (r, f, n) => {
      const root = ramp("#8a6a4a", { lo: "#20140a" });
      for (let k = 0; k < 7; k++) {
        const x = -8 + k * 2.6;
        const y = Math.sin(k * 1.7) * 3;
        const sw = Math.sin((f / n) * TAU + k * 0.9) * 1.2;
        const low = 6 + (k % 3) * 4;
        const glow = (k + f) % 3 === 0;
        r.sweep([[x, y, 44], [x + sw * 0.4, y - sw * 0.4, 30], [x + sw, y - sw, low]], [1.1, 0.8, 0.35], m(root, 1 + (k % 2), { shader: (s, tone) => (glow && Math.abs(((s.p[2] + k * 5) % 9) - 4.5) < 0.6 ? "#d8ffb0" : tone(root)) }));
        r.sphere([x + sw, y - sw, low - 0.4], 0.7, m(ramp("#b8f0a0", { hi: "#ffffff" }), 3));
      }
    },
  },
  // ---------------------------------------------------------------- underground and the sects
  // a cave mouth in a mound of mossy boulders, cold mist breathing out of the dark arch on its east face
  cavemouth: {
    foot: [-1, -1, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    emit: "mist",
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const rock = md(PAL.stone, 1, { shader: (s, tone) => (s.n[2] > 0.45 && fbm(s.p[0] * 0.25, s.p[1] * 0.25, 3) > 0.5 ? tone(PAL.moss) : tone(PAL.stone)) });
      r.ellipsoid([-T * 0.5, -T * 0.5, 0], [T * 1.05, T * 1.05, 30], rock);
      r.ellipsoid([-T * 0.9, -T * 0.2, 18], [12, 12, 16], rock);
      r.ellipsoid([-T * 0.2, -T * 1.0, 14], [12, 12, 14], rock);
      // the arch: a dark hollow cut into the east face, deepening to black
      const dark = tones("#3a3448", "#1e1a28", "#120e1a", "#06040a");
      r.ellipsoid([T * 0.42, -2, 0], [4, 9, 17], m(dark, 2, { outline: undefined, shader: (s, tone) => tone(dark, s.p[2] > 12 ? 0 : s.p[2] > 6 ? 1 : 2) }));
      // a lintel stone and a rope of paper charms swinging in the draught
      r.sweep([[T * 0.42, -11, 17], [T * 0.42, 7, 17]], 2.2, m(PAL.stone, 3));
      for (let k = 0; k < 4; k++) {
        const y = -7 + k * 4.4;
        const sw = Math.sin(ph + k) * 1.2;
        r.sweep([[T * 0.46, y, 16], [T * 0.46 + sw * 0.5, y, 11]], [0.8, 0.6], m(PAL.paper, 4, { shader: (s, tone) => (s.u > 0.4 && s.u < 0.6 ? tone(PAL.red) : tone(PAL.paper)) }));
      }
    },
  },
  // a timber-framed mine adit driven into a red rock mound, a lantern swinging by the entrance and rails running in
  minemouth: {
    foot: [-1, -1, 0, 0],
    blocks: true,
    frames: 6,
    fps: 5,
    light: { color: "#ffb060", radius: 32, dy: 24 },
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const red = ramp("#a8543a", { lo: "#3a1018" });
      const rock = md(red, 1, { shader: (s, tone) => tone(red, Math.sin(s.p[2] * 0.6 + fbm(s.p[0] * 0.2, s.p[1] * 0.2, 4) * 4) > 0.6 ? 1 : 0) });
      r.ellipsoid([-T * 0.5, -T * 0.5, 0], [T * 1.15, T * 1.15, 22], rock);
      r.ellipsoid([-T * 1.0, -T * 0.4, 10], [12, 13, 16], rock);
      r.ellipsoid([-T * 0.3, -T * 1.1, 8], [11, 10, 13], rock);
      const dark = tones("#3a2a28", "#1e1418", "#120a10", "#060306");
      r.box([T * 0.3, -7, 0], [T * 0.5, 7, 16], m(dark, 2, { outline: undefined }));
      // the timber frame: two posts and a cap beam
      for (const y of [-8, 8]) r.box([T * 0.44, y - 1.2, 0], [T * 0.54, y + 1.2, 18], m(PAL.wood, 3));
      r.box([T * 0.42, -10, 17], [T * 0.56, 10, 19.6], m(PAL.woodDark, 3));
      // a lantern on a bracket, swinging
      r.sweep([[T * 0.56, 9, 17], [T * 0.56 + 4, 9, 17]], 0.5, m(PAL.black, 4));
      const c: V3 = [T * 0.56 + 4 + Math.sin(ph) * 0.8, 9, 12.5];
      r.sweep([[T * 0.56 + 4, 9, 17], add(c, [0, 0, 2])], 0.2, m(PAL.black, 4));
      r.box(add(c, [-1.4, -1.4, -2]), add(c, [1.4, 1.4, 2]), m(tones("#fff6c0", "#ffd070", "#c08a30", "#6a3a10"), 5, { shader: (s, tone) => (Math.abs(s.n[2]) < 0.5 ? (f % 3 === 0 ? "#fff6c0" : "#ffd070") : tone(PAL.black)) }));
    },
  },
  // a heap of fallen rock: rubble from a landslide or a cave-in
  rubble: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const st = md(PAL.stone, 1);
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4;
        const d = (k % 4) * 3;
        r.ellipsoid([Math.cos(a) * d, Math.sin(a) * d, 3 + (3 - (k % 4)) * 2.4], [4.4 - (k % 3), 4 - (k % 2), 3.6 - (k % 3) * 0.6], k % 3 ? st : md(ramp("#8a6a5a", { lo: "#3a2a2a" }), 2));
      }
    },
  },
  // a cluster of stalagmites, beaded with water; now and then a drop falls from the dark above and splashes on the tallest
  stalagmite: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 6,
    paint: (r, f, n) => {
      const st = md(ramp("#6a6478", { lo: "#1a1622" }), 1, { shader: (s, tone) => tone(ramp("#6a6478", { lo: "#1a1622" }), Math.sin(s.p[2] * 1.2) > 0.7 ? -1 : 0) });
      r.cone(0, 0, 5, 0, 0.4, 30, 7, st);
      r.cone(5, -3, 3.4, 0, 0.3, 17, 6, st, 0.5);
      r.cone(-4, 3, 3, 0, 0.3, 13, 6, st, 1);
      r.cone(2, 5, 2.2, 0, 0.2, 8, 5, st, 0.2);
      const u = f / (n - 2);
      const drop = tones("#ffffff", "#c8e8ff", "#7ab0e0", "#3a6aa8");
      if (f < n - 2) r.sphere([0, 0, 60 - u * 29], 0.9, m(drop, 2, { outline: undefined }));
      else for (let k = 0; k < 4; k++) r.sphere([Math.cos(k * 1.6) * (2 + (f - n + 2) * 2), Math.sin(k * 1.6) * (2 + (f - n + 2) * 2), 31 - (f - n + 2) * 1.5], 0.5, m(drop, 2, { outline: undefined }));
    },
  },
  // glowing mushrooms in the dark, their caps breathing light in and out
  glowshroom: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 4,
    light: { color: "#7affd8", radius: 30, dy: 8 },
    emit: "sparkle",
    paint: (r, f, n) => {
      const pulse = 0.5 + 0.5 * Math.sin((f / n) * TAU);
      const cap = tones("#ffffff", mix("#5ae8c8", "#c8fff0", pulse), "#2a9a9a", "#1a4a6a");
      const cap2 = tones("#ffffff", mix("#a88aff", "#e8d8ff", pulse), "#6a4ac8", "#2a1a6a");
      const shrooms: [number, number, number, number][] = [
        [0, 0, 9, 4],
        [5, -2, 6, 3],
        [-4, 3, 7, 3.2],
        [3, 5, 4, 2.2],
        [-5, -4, 4.4, 2.4],
      ];
      shrooms.forEach(([x, y, hgt, rad], k) => {
        r.sweep([[x, y, 0], [x + Math.sin(k) * 0.6, y, hgt]], [rad * 0.3, rad * 0.22], m(tones("#ffffff", "#e8eef8", "#9aa8c8", "#4a5a7a"), 1 + k));
        r.ellipsoid([x + Math.sin(k) * 0.6, y, hgt + rad * 0.2], [rad, rad, rad * 0.55], m(k % 2 ? cap2 : cap, 1 + k, { outline: undefined, shader: (s, tone) => (s.n[2] > 0.6 && hash2(Math.floor(s.p[0] * 2), Math.floor(s.p[1] * 2), k) > 0.8 ? "#ffffff" : tone(k % 2 ? cap2 : cap)) }));
      });
    },
  },
  // a mine cart on its rails, heaped with ore that glints as it rocks on its axles
  minecart: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 4,
    paint: (r, f) => {
      const rock = Math.sin((f / 4) * TAU) * 0.4;
      const iron = ramp("#6a6a7a", { lo: "#1a1a26" });
      for (const x of [-5, 5]) for (const y of [-6, 6]) r.sweep([[x, y - 1, 3], [x, y + 1, 3]], 3, m(PAL.black, 1));
      r.box([-7, -9, 4 + rock], [7, 9, 13 + rock], m(iron, 2, { shader: (s, tone) => (Math.abs(s.p[2] - 8.5 - rock) < 0.7 ? tone(BRONZE) : tone(iron)) }));
      const ore = tones("#ffe0c0", "#ff6a3a", "#a82a2a", "#4a0a1a");
      for (let k = 0; k < 7; k++) {
        const a = k * 2.3;
        r.sphere([Math.cos(a) * 4, Math.sin(a) * 5, 14 + rock + (k % 3)], 2.6, md(k % 3 ? PAL.stone : ore, 3 + (k % 2), { shader: (s, tone) => ((k + f) % 4 === 0 && s.n[2] > 0.7 ? "#ffffff" : tone(k % 3 ? PAL.stone : ore)) }));
      }
    },
  },
  // an iron torch stand: a basket of burning pitch on a tall pole, spitting sparks
  torch: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 10,
    light: { color: "#ff9a40", radius: 38, dy: 30 },
    emit: "embers",
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 26]], [1.4, 0.9], m(PAL.black, 1));
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU;
        r.sweep([[Math.cos(a) * 4, Math.sin(a) * 4, 0], [0, 0, 6]], 0.6, m(PAL.black, 1));
      }
      r.cone(0, 0, 1.6, 25, 3.6, 30, 6, m(PAL.black, 2));
      for (let k = 0; k < 5; k++) {
        const ph = (f / n) * TAU + k * 1.9;
        const hgt = 5 + Math.sin(ph) * 2.4 + (k % 2) * 2;
        const x = Math.cos(k * 2.4) * 1.6;
        const y = Math.sin(k * 2.4) * 1.6;
        r.sweep([[x, y, 30], [x * 0.3 + Math.sin(ph) * 0.8, y * 0.3, 30 + hgt]], [1.8, 0.2], m(FIRE, 3, { shader: (s, tone) => tone(FIRE, s.u > 0.6 ? 1 : s.u < 0.3 ? -1 : 0) }));
      }
    },
  },
  // fire-jade: red crystal shot through with a slow inner flame, the treasure of the Ember Mine
  firejade: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 5,
    light: { color: "#ff6a4a", radius: 32, dy: 14 },
    emit: "embers",
    paint: (r, f, n) => {
      const glow = Math.sin((f / n) * TAU) * 0.5 + 0.5;
      const c = tones("#fff0d0", mix("#ff5a3a", "#ffb080", glow), "#a82030", "#4a0a20");
      const shards: [number, number, number, number, number][] = [
        [0, 0, 24, 4, 0.3],
        [5, -3, 15, 3, 0.9],
        [-4, 2, 18, 3.2, 1.4],
        [2, 5, 11, 2.4, 0.1],
        [-3, -4, 9, 2, 0.6],
      ];
      shards.forEach(([x, y, hgt, rr, rot], k) => {
        r.prism(x, y, rr, 0, hgt * 0.72, 6, m(c, k + 1), rot);
        r.cone(x, y, rr, hgt * 0.72, 0.2, hgt, 6, m(c, k + 1), rot);
      });
    },
  },
  // the Dragon Vein's heart: a knot of jade and gold light hanging over a cracked stone basin, three rings of script turning round it
  veinheart: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 12,
    fps: 6,
    light: { color: "#9ff5de", radius: 70, dy: 40 },
    emit: "sparkle",
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      r.prism(0, 0, 20, 0, 6, 10, md(PAL.stone, 1, { shader: (s, tone) => (s.n[2] > 0.5 && Math.sin(Math.atan2(s.p[1], s.p[0]) * 7 + Math.hypot(s.p[0], s.p[1]) * 0.6) > 0.85 ? "#9ff5de" : tone(PAL.stone)) }));
      r.prism(0, 0, 12, 6, 10, 10, md(PAL.stone, 2));
      const bob = Math.sin(ph) * 2;
      const core = tones("#ffffff", "#c8fff0", "#4ac8b0", "#1a7a7a");
      r.sphere([0, 0, 28 + bob], 9, m(core, 3, { outline: undefined, shader: (s, tone) => (Math.sin(s.p[2] * 0.8 + ph * 2) > 0.6 ? tone(PAL.gold) : tone(core)) }));
      for (let ring = 0; ring < 3; ring++) {
        const tilt = 0.5 + ring * 0.5;
        const rad = 14 + ring * 4;
        const pts: V3[] = [];
        for (let k = 0; k <= 24; k++) {
          const a = (k / 24) * TAU + ph * (ring % 2 ? -1 : 1);
          pts.push([Math.cos(a) * rad, Math.sin(a) * rad * Math.cos(tilt), 28 + bob + Math.sin(a) * rad * Math.sin(tilt) * 0.6]);
        }
        r.sweep(pts, 0.7, m(ring === 1 ? PAL.gold : PAL.qi, 4 + ring, { outline: undefined, shader: (s, tone) => (Math.sin(s.u * 60) > 0.4 ? tone(ring === 1 ? PAL.gold : PAL.qi) : null) }));
      }
    },
  },
  // the Scarlet Phoenix: a firebird of red bronze on a pillar, wings half spread, flames licking along its feathers
  phoenixstatue: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 8,
    light: { color: "#ff7040", radius: 44, dy: 44 },
    emit: "embers",
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const bronze = ramp("#c8502a", { hi: "#ffe0a0", lo: "#3a0a1a" });
      r.prism(0, 0, 6, 0, 4, 8, md(PAL.stone, 1));
      r.prism(0, 0, 3.6, 4, 30, 8, m(PILLAR, 1));
      r.prism(0, 0, 5, 30, 33, 8, m(PAL.gold, 2));
      r.ellipsoid([0, 0, 39], [3.4, 4.4, 4.4], m(bronze, 3));
      r.sweep([[0, 2.4, 41], [0, 4.6, 47], [0, 6.4, 46]], [1.6, 1.2, 0.5], m(bronze, 3));
      for (const s of [-1, 1]) {
        const lift = Math.sin(ph) * 2;
        r.sweep([[s * 2.6, 0, 41], [s * 9, -2, 46 + lift], [s * 13, -5, 50 + lift * 1.4]], [2.4, 1.6, 0.4], m(bronze, 4, { shader: (sf, tone) => (Math.sin(sf.u * 24) > 0.5 ? tone(PAL.gold) : tone(bronze)) }));
      }
      r.sweep([[0, -3, 38], [0, -9, 32], [0, -12, 26]], [1.6, 1, 0.3], m(bronze, 4));
      for (let k = 0; k < 6; k++) {
        const a = ph * 1.5 + k * 1.1;
        const z = 40 + (k % 3) * 3;
        r.sweep([[Math.cos(k) * 4, Math.sin(k) * 3 - 2, z], [Math.cos(k) * 4 + Math.sin(a) * 1.4, Math.sin(k) * 3 - 2, z + 5 + Math.sin(a) * 2]], [1.4, 0.2], m(FIRE, 5, { outline: undefined, shader: (s, tone) => tone(FIRE, s.u > 0.6 ? 1 : s.u < 0.3 ? -1 : 0) }));
      }
    },
  },
  // a tall banner of the Scarlet Phoenix: crimson silk with a gold flame, cracking in the hot wind
  phoenixbanner: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 8,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 56]], 1, m(PAL.black, 1));
      r.cone(0, 0, 1.6, 56, 0, 61, 5, m(PAL.gold, 1));
      for (let k = 0; k < 6; k++) {
        const z = 52 - k * 5;
        const pts: V3[] = [];
        for (let s = 0; s <= 6; s++) {
          const w = Math.sin((f / n) * TAU - s * 1.1 + k * 0.25) * (s / 6) * 2.8;
          pts.push([s * 2.2 + w * 0.5, -s * 2.2 + w * 0.5, z - s * 0.5 + w * 0.3]);
        }
        r.sweep(pts, 2.6, m(PAL.crimson, 2, { shader: (s, tone) => ((k === 2 || k === 3) && s.u > 0.3 && s.u < 0.7 ? tone(PAL.gold) : tone(k === 0 ? PAL.gold : PAL.crimson)) }));
      }
    },
  },
  // a raised bed of spirit herbs in a wooden frame, rows of leaves stirring and the odd flower nodding
  herbbed: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      r.box([-10, -10, 0], [10, 10, 4], m(PAL.wood, 1, { shader: (s, tone) => (s.n[2] > 0.5 && Math.abs(s.p[0]) < 9 && Math.abs(s.p[1]) < 9 ? tone(PAL.brown, 1) : tone(PAL.wood)) }));
      const leaf = ramp("#5ab848", { lo: "#103a26" });
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 3; k++) {
          const x = -6 + k * 6;
          const y = -6 + row * 6;
          const sw = swayAt(f + row + k, n, 10, 1);
          r.ellipsoid(add([x, y, 7], sw), [2.6, 2.6, 3.4], md(leaf, 2 + row, { shader: leafShader(leaf, row * 3 + k) }));
          if ((row + k) % 2 === 0) r.sphere(add([x, y, 10.6], sw), 1, m([PAL.rose, PAL.gold, PAL.white][(row + k) % 3], 2 + row));
        }
    },
  },
  // the same bed withered: dry brown stalks bent over grey earth
  witheredbed: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.box([-10, -10, 0], [10, 10, 4], m(PAL.woodDark, 1, { shader: (s, tone) => (s.n[2] > 0.5 && Math.abs(s.p[0]) < 9 && Math.abs(s.p[1]) < 9 ? tone(PAL.grey, 1) : tone(PAL.woodDark)) }));
      const dry = ramp("#8a6a3a", { lo: "#2a1a10" });
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 3; k++) {
          const x = -6 + k * 6;
          const y = -6 + row * 6;
          r.sweep([[x, y, 4], [x + 1.4, y - 1, 8], [x + 3, y - 1.6, 7]], [0.7, 0.4, 0.2], m(dry, 2 + row));
        }
    },
  },
  // a great bronze alchemy furnace on three legs, fire roaring beneath it, smoke curling from its lid
  furnace: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 8,
    light: { color: "#ff8040", radius: 40, dy: 10 },
    emit: "smoke",
    paint: (r, f, n) => {
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * TAU + 0.4;
        r.sweep([[Math.cos(a) * 9, Math.sin(a) * 9, 0], [Math.cos(a) * 6, Math.sin(a) * 6, 10]], [1.6, 1.2], m(BRONZE, 1));
      }
      r.ellipsoid([0, 0, 20], [11, 11, 12], m(BRONZE, 2, { shader: (s, tone) => (Math.abs(s.p[2] - 20) < 1 || Math.sin(Math.atan2(s.p[1], s.p[0]) * 6) > 0.92 ? tone(PAL.gold) : tone(BRONZE)) }));
      r.cone(0, 0, 8, 30, 3, 35, 10, m(BRONZE, 3));
      r.sphere([0, 0, 36], 2.4, m(PAL.gold, 3));
      for (const s of [-1, 1]) r.sweep([[s * 8, s * 8, 28], [s * 9.6, s * 9.6, 33], [s * 7, s * 7, 34]], 1, m(BRONZE, 3));
      for (let k = 0; k < 7; k++) {
        const ph = (f / n) * TAU + k * 1.7;
        const x = Math.cos(k * 2.4) * 4;
        const y = Math.sin(k * 2.4) * 4;
        r.sweep([[x, y, 2], [x * 0.5 + Math.sin(ph), y * 0.5, 9 + Math.sin(ph) * 2]], [2.2, 0.3], m(FIRE, 4, { outline: undefined, shader: (s, tone) => tone(FIRE, s.u > 0.6 ? 1 : s.u < 0.3 ? -1 : 0) }));
      }
    },
  },
  // a sword of stone ten men tall driven into the crag, a glint of light running up its blade
  swordspire: {
    foot: [-1, -1, 0, 0],
    blocks: true,
    frames: 8,
    fps: 5,
    emit: "sparkle",
    paint: (r, f, n) => {
      const base: V3 = [-T * 0.5, -T * 0.5, 0];
      r.ellipsoid(base, [T, T, 12], md(PAL.stone, 1, { shader: (s, tone) => (fbm(s.p[0] * 0.3, s.p[1] * 0.3, 7) > 0.6 ? tone(PAL.moss) : tone(PAL.stone)) }));
      const glint = 14 + (f / n) * 80;
      const blade = (s: Parameters<Shader>[0], tone: Parameters<Shader>[1]) => (Math.abs(s.p[2] - glint) < 3 ? "#ffffff" : tone(PAL.steel, s.n[0] > 0.3 ? -1 : 0));
      r.box([-T * 0.5 - 2.4, -T * 0.5 - 6, 10], [-T * 0.5 + 2.4, -T * 0.5 + 6, 96], m(PAL.steel, 2, { shader: blade }));
      r.box([-T * 0.5 - 0.6, -T * 0.5 - 6.4, 10], [-T * 0.5 + 0.6, -T * 0.5 + 6.4, 96], m(PAL.steel, 2, { shader: (s, tone) => (Math.abs(s.p[2] - glint) < 3 ? "#ffffff" : tone(PAL.steel, 1)) }));
      r.box([-T * 0.5 - 3.4, -T * 0.5 - 15, 96], [-T * 0.5 + 3.4, -T * 0.5 + 15, 102], m(BRONZE, 3));
      r.sweep([[-T * 0.5, -T * 0.5, 102], [-T * 0.5, -T * 0.5, 122]], 3, m(PAL.woodDark, 4, { shader: (s, tone) => (Math.sin(s.u * 30) > 0.3 ? tone(PAL.red) : tone(PAL.woodDark)) }));
      r.sphere([-T * 0.5, -T * 0.5, 125], 4, m(PAL.gold, 4));
    },
  },
  // ---------------------------------------------------------------- the War of the Iron Banner
  // wreckage still burning where the horde passed: charred beams, a broken wheel, flames licking up through it
  warfire: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 10,
    light: { color: "#ff6a2a", radius: 46, dy: 10 },
    emit: "smoke",
    paint: (r, f, n) => {
      const char = md(ramp("#4a3a34", { lo: "#0a0606" }), 1, { shader: (sf, tone) => (fbm(sf.p[0] * 0.6, sf.p[1] * 0.6 + sf.p[2] * 0.4, 5) > 0.66 ? "#ff8a3a" : tone(ramp("#4a3a34", { lo: "#0a0606" }))) });
      r.sweep([[-8, -3, 1.2], [7, 3, 2.4]], 1.4, char);
      r.sweep([[-3, 7, 1.2], [4, -6, 4.6]], 1.2, char);
      r.sweep([[2, 4, 1], [-5, 1, 8]], 1, char);
      r.prism(6, -5, 3.6, 0, 1.4, 10, m(PAL.woodDark, 2, { shader: (sf, tone) => (Math.hypot(sf.p[1] + 5, sf.p[2] - 4) < 1.2 ? tone(PAL.black) : tone(PAL.woodDark)) }), 0);
      for (let k = 0; k < 7; k++) {
        const ph = (f / n) * TAU + k * 1.7;
        const hgt = 8 + Math.sin(ph) * 3.4 + (k % 3) * 2.6;
        const x = Math.cos(k * 2.3) * 4.4;
        const y = Math.sin(k * 2.3) * 3.4;
        r.sweep([[x, y, 2], [x * 0.5 + Math.sin(ph) * 1.1, y * 0.5, 2 + hgt]], [2.6, 0.2], m(FIRE, 3, { shader: (sf, tone) => tone(FIRE, sf.u > 0.55 ? 1 : sf.u < 0.3 ? -1 : 0) }));
      }
    },
  },
  // a farmhouse the raiders burned: blackened posts, a fallen roof beam, smoke curling up
  burnthouse: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 4,
    emit: "smoke",
    light: { color: "#ff5a20", radius: 26, dy: 6 },
    paint: (r, f, n) => {
      const charred = md(ramp("#5a4a44", { lo: "#0a0606" }), 1);
      for (const [x, y, h] of [
        [-8, -8, 22],
        [8, -8, 15],
        [-8, 8, 11],
        [8, 8, 19],
      ])
        r.prism(x, y, 1.4, 0, h, 4, charred);
      r.box([-9, -9, 0], [9, -7.6, 7], md(WALL, 2, { shader: (sf, tone) => (fbm(sf.p[0] * 0.3, sf.p[2] * 0.3, 9) > 0.5 ? "#2a1e1a" : tone(WALL, 1)) }));
      r.box([-9, -9, 0], [-7.6, 9, 5], md(WALL, 2, { shader: (sf, tone) => (fbm(sf.p[1] * 0.3, sf.p[2] * 0.3, 11) > 0.45 ? "#2a1e1a" : tone(WALL, 1)) }));
      r.sweep([[-8, -8, 21], [8, 8, 2]], 1.3, charred);
      r.sweep([[8, -8, 14], [-3, 6, 1]], 1, charred);
      const glow = 0.5 + 0.5 * Math.sin((f / n) * TAU);
      r.ellipsoid([1, 1, 0.6], [6, 5, 1.4], m(ramp("#2a1a16"), 3, { shader: (sf) => (fbm(sf.p[0] * 0.8, sf.p[1] * 0.8, 3 + f) > 0.6 - glow * 0.08 ? mix("#c03010", "#ffb040", glow) : "#2a1a16") }));
    },
  },
  // the horde's black banner: a wolf's head on grey, a horsetail streaming from the crossbar
  wolfbanner: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 7,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 56]], 1, m(PAL.black, 1));
      r.sweep([[-4, 4, 50], [4, -4, 50]], 0.7, m(PAL.black, 1));
      r.cone(0, 0, 1.4, 56, 0.2, 61, 5, m(PAL.steel, 1));
      for (let k = 0; k < 5; k++) {
        const z = 49 - k * 5;
        const pts: V3[] = [];
        for (let q = 0; q <= 6; q++) {
          const w = Math.sin((f / n) * TAU - q * 0.9 + k * 0.25) * (q / 6) * 2.6;
          pts.push([q * 2 + w * 0.5, -q * 2 + w * 0.5, z - q * 0.5 + w * 0.3]);
        }
        const grey = ramp("#5a5a62", { lo: "#0a0a0e" });
        r.sweep(pts, 2.6, m(grey, 2, { shader: (sf, tone) => ((k === 1 || k === 2) && sf.u > 0.3 && sf.u < 0.62 ? tone(ramp("#e8e0d0", { lo: "#5a5048" })) : k === 4 ? tone(PAL.crimson) : tone(grey)) }));
      }
      const tail: V3[] = [[0, 0, 50]];
      for (let q = 1; q <= 4; q++) tail.push([-q * 0.6 + Math.sin((f / n) * TAU + q) * 0.8, q * 0.6, 50 - q * 3.4]);
      r.sweep(tail, [1.4, 1.2, 1, 0.6, 0.2], m(ramp("#d8c8a8", { lo: "#4a3a2a" }), 3));
    },
  },
  // the Northern Army's standard: crimson silk with a gold border on a pole tipped with a spearhead
  warbanner: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 6,
    fps: 7,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 54]], 1, m(PAL.woodDark, 1));
      r.cone(0, 0, 1.6, 54, 0.1, 61, 4, m(PAL.steel, 1));
      r.sweep([[0, 0, 53], [-1.6, 1.6, 49 + Math.sin((f / n) * TAU) * 0.6]], 0.8, m(PAL.red, 1));
      for (let k = 0; k < 5; k++) {
        const z = 51 - k * 5;
        const pts: V3[] = [];
        for (let q = 0; q <= 6; q++) {
          const w = Math.sin((f / n) * TAU - q * 0.8 + k * 0.2) * (q / 6) * 2.4;
          pts.push([q * 2 + w * 0.5, -q * 2 + w * 0.5, z - q * 0.4 + w * 0.3]);
        }
        r.sweep(pts, 2.6, m(k === 0 || k === 4 ? PAL.gold : PAL.crimson, 2, { shader: (sf, tone) => (k === 2 && sf.u > 0.4 && sf.u < 0.62 ? tone(PAL.gold) : tone(k === 0 || k === 4 ? PAL.gold : PAL.crimson)) }));
      }
    },
  },
  // sharpened stakes lashed into an X: the line the horde must not cross
  barricade: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.sweep([[-10, 10, 4], [10, -10, 4]], 1.2, m(PAL.woodDark, 1));
      for (const t of [-7, 0, 7]) {
        const [x, y] = [t, -t];
        r.sweep([[x - 4, y - 4, 0], [x + 5, y + 5, 12]], [1.2, 0.2], m(PAL.wood, 2));
        r.sweep([[x + 4, y + 4, 0], [x - 5, y - 5, 12]], [1.2, 0.2], m(PAL.wood, 2));
      }
    },
  },
  // a counterweight trebuchet: the arm swings up and flings its stone, then is winched back down
  catapult: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 5,
    paint: (r, f, n) => {
      const wood = m(PAL.wood, 1);
      for (const s of [-1, 1]) {
        r.sweep([[s * 6 - 6, s * 6 + 6, 0], [s * 3, s * 3, 22]], 1.2, wood);
        r.sweep([[s * 6 + 6, s * 6 - 6, 0], [s * 3, s * 3, 22]], 1.2, wood);
      }
      r.box([-9, -9, 0], [9, 9, 2], m(PAL.woodDark, 2));
      const swing = [0, 0.2, 0.9, 1, 0.8, 0.5, 0.25, 0.05][f % n];
      const a = -0.9 + swing * 2.2;
      const piv: V3 = [0, 0, 22];
      const dir: V3 = [Math.cos(a) * 0.7, -Math.cos(a) * 0.7, Math.sin(a)];
      r.sweep([add(piv, [-dir[0] * 8, -dir[1] * 8, -dir[2] * 8]), add(piv, [dir[0] * 18, dir[1] * 18, dir[2] * 18])], [1.4, 0.9], m(PAL.woodDark, 3));
      r.box(add(piv, [-dir[0] * 8 - 3, -dir[1] * 8 - 3, -dir[2] * 8 - 6]), add(piv, [-dir[0] * 8 + 3, -dir[1] * 8 + 3, -dir[2] * 8]), m(PAL.stone, 4));
      if (swing < 0.85) r.sphere(add(piv, [dir[0] * 18, dir[1] * 18, dir[2] * 18 - 1]), 2.2, md(PAL.stone, 5));
      else r.sphere([16 + swing * 6, -16 - swing * 6, 50 + swing * 8], 2.2, md(PAL.stone, 5));
    },
  },
  // an army tent with a pennant: the canvas breathes in the wind
  wartent: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 5,
    paint: (r, f, n) => {
      const canvas = ramp("#e8dcc0", { lo: "#5a4a3a" });
      const W = 11;
      const flap = Math.sin((f / n) * TAU) * 1.2;
      r.hipRoof(0, 0, W, W, 0, 0.6 + flap * 0.1, W * 0.6, 22, md(canvas, 1, { shader: (sf, tone) => (Math.abs(sf.p[0] - sf.p[1]) < 3 && sf.n[0] + sf.n[1] > 0.4 && sf.p[2] < 13 ? "#2a1a14" : Math.abs((sf.p[0] + sf.p[1]) % 8) < 0.8 ? tone(PAL.red) : tone(canvas)) }));
      r.sweep([[0, 0, 22], [0, 0, 34]], 0.6, m(PAL.woodDark, 2));
      const pts: V3[] = [];
      for (let q = 0; q <= 4; q++) pts.push([q * 1.6 + Math.sin((f / n) * TAU - q) * 0.6 * q * 0.3, -q * 1.6, 33 - q * 0.3]);
      r.sweep(pts, 1.4, m(PAL.crimson, 3));
    },
  },
  // a rack of spears and shields outside the camp
  weaponrack: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.sweep([[-9, 9, 10], [9, -9, 10]], 0.8, m(PAL.woodDark, 1));
      for (const s of [-1, 1]) r.sweep([[s * 9, -s * 9, 0], [s * 9, -s * 9, 12]], 0.9, m(PAL.woodDark, 1));
      for (let k = 0; k < 5; k++) {
        const t = -7 + k * 3.5;
        r.sweep([[t, -t + 2, 0], [t, -t - 1, 28]], 0.4, m(PAL.wood, 2));
        r.cone(t, -t - 1, 0.9, 28, 0.1, 32, 4, m(PAL.steel, 3));
      }
      for (const t of [-5, 4]) r.ellipsoid([t, -t + 3.4, 6], [3.6, 0.8, 4.4], m(PAL.crimson, 4, { shader: (sf, tone) => (Math.hypot(sf.p[0] - t, sf.p[2] - 6) < 1.3 ? tone(PAL.gold) : tone(PAL.crimson)) }));
    },
  },
  // a cairn of field stones over the fallen, with a strip of white mourning cloth
  cairn: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 3,
    emit: "incense",
    paint: (r, f, n) => {
      const st = md(PAL.stone, 1);
      r.sphere([0, 0, 2.4], 6, st);
      r.sphere([1, -1, 7.4], 4.4, st);
      r.sphere([0, 0, 11.4], 3, st);
      r.sphere([-0.4, 0.4, 14.2], 1.8, st);
      const w = Math.sin((f / n) * TAU) * 1.2;
      r.sweep([[0, 0, 15.6], [2 + w * 0.4, -3, 13], [3 + w, -5, 9]], [0.9, 0.8, 0.5], m(PAL.white, 2));
    },
  },
  // a memorial stele to the fallen of a battle, a sword driven into the ground before it, its edge glinting
  warmemorial: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      r.box([-7, -3, 0], [7, 3, 3], md(PAL.stone, 1));
      r.box([-5, -1.6, 3], [5, 1.6, 26], md(PAL.stone, 2, { shader: (sf, tone) => (Math.abs(sf.p[0]) < 1.4 && sf.p[2] > 7 && sf.p[2] < 23 && Math.floor(sf.p[2] * 0.7) % 2 && sf.n[1] > 0.5 ? "#2a2238" : tone(PAL.stone)) }));
      r.cone(0, 0, 6.4, 26, 0.6, 30, 4, md(ROOF_GREY, 3), Math.PI / 4);
      const glint = 6 + (f / n) * 22;
      r.box([5.4, 5.4, 0], [6.4, 6.6, 16], m(PAL.steel, 4, { shader: (sf, tone) => (Math.abs(sf.p[2] - glint) < 2 ? "#ffffff" : tone(PAL.steel)) }));
      r.box([4, 5, 15.6], [7.8, 7, 17], m(PAL.gold, 4));
      r.sweep([[5.9, 6, 17], [5.9, 6, 21]], 0.6, m(PAL.black, 4));
    },
  },
  // crows circling over a battlefield
  crows: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 6,
    paint: (r, f, n) => {
      for (let k = 0; k < 5; k++) {
        const ph = (f / n) * TAU + (k * TAU) / 5;
        const c: V3 = [Math.cos(ph) * (9 + k * 1.6), Math.sin(ph) * (9 + k * 1.6), 40 + k * 4 + Math.sin(ph * 2) * 2];
        const flap = (f + k) % 2 ? 2.6 : -1.4;
        for (const s of [-1, 1]) r.sweep([c, add(c, [Math.cos(ph + Math.PI / 2) * s * 4.4, Math.sin(ph + Math.PI / 2) * s * 4.4, flap])], [1.3, 0.5], m(ramp("#2a2a36", { lo: "#000000" }), 1 + k));
        r.sphere(c, 1.4, m(PAL.black, 1 + k));
      }
    },
  },
  // a stretch of grey-brick city rampart with crenellations, running along the world x axis
  citywall: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => paintRampart(r, false),
  },
  // the same rampart, running along the world y axis
  citywallY: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => paintRampart(r, true),
  },
  // a corner watchtower on the city wall: a brick bastion with a lookout pavilion and a lantern that flickers on watch
  watchtower: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 5,
    light: { color: "#ffc070", radius: 40, dy: 58 },
    paint: (r, f) => {
      const brick = md(BRICK, 1, { shader: brickShader });
      r.box([-11.3, -11.3, 0], [11.3, 11.3, 32], brick);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.box([sx * 11.3 - 2.5, sy * 11.3 - 2.5, 32], [sx * 11.3 + 2.5, sy * 11.3 + 2.5, 37], brick);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.prism(sx * 6.5, sy * 6.5, 1.3, 32, 46, 6, m(PILLAR, 2));
      r.box([-7.5, -7.5, 32], [7.5, 7.5, 34], m(PAL.wood, 3));
      r.hipRoof(0, 0, 12, 12, 46, 3, 1, 58, md(ROOF_GREY, 4, { shader: roofTiles(ROOF_GREY) }));
      r.sphere([0, 0, 59], 1.6, m(PAL.gold, 5));
      const flick = [0.9, 1, 0.8, 1][f];
      r.ellipsoid([0, 7.2, 40], [2.2, 2.2, 3], m(tones("#ffffff", mix("#ff7050", "#ffd0a0", flick - 0.7), "#c03a32", "#6a1020"), 6));
    },
  },
  // an opera stage on the city square: red pillars, a painted backdrop, and banners that stir over the boards
  operastage: {
    foot: [0, 0, 1, 1],
    blocks: true,
    frames: 6,
    fps: 4,
    light: { color: "#ffb070", radius: 46, dy: 24 },
    paint: (r, f, n) => {
      const cx = T / 2;
      const cy = T / 2;
      const W = T * 0.9;
      const sw = Math.sin((f / n) * TAU);
      r.box([cx - W, cy - W, 0], [cx + W, cy + W, 8], md(PAL.stone, 1));
      r.box([cx - W + 1, cy - W + 1, 8], [cx + W - 1, cy + W - 1, 9], m(PAL.wood, 2));
      // the painted backdrop on the far side: mountains and a moon on red silk
      r.box([cx - W + 1, cy - W + 1, 9], [cx - W + 3, cy + W - 1, 34], m(ramp("#a83a3a", { lo: "#3a0a20" }), 3, { shader: (sf, tone) => {
        const y = sf.p[1] - cy;
        const z = sf.p[2];
        if (Math.hypot(y - 6, z - 27) < 3.2) return "#fff0c0";
        if (z < 16 + Math.abs(Math.sin(y * 0.35)) * 6) return tone(PAL.gold, 1);
        return tone(ramp("#a83a3a", { lo: "#3a0a20" }));
      } }));
      for (const [x, y] of [[cx + W - 2, cy - W + 2], [cx + W - 2, cy + W - 2], [cx - W + 2, cy - W + 2], [cx - W + 2, cy + W - 2]] as [number, number][]) r.prism(x, y, 1.4, 9, 34, 6, m(PILLAR, 4));
      r.hipRoof(cx, cy, W + 6, W + 6, 34, W * 0.5, 1, 48, md(ROOF_RED, 5, { shader: roofTiles(ROOF_RED) }));
      r.sweep([[cx - W * 0.5, cy, 48.5], [cx + W * 0.5, cy, 48.5]], 1.2, m(PAL.gold, 6));
      // valance and side curtains that sway a little
      r.box([cx + W - 1.2, cy - W + 2, 30], [cx + W - 0.4, cy + W - 2, 33], m(PAL.gold, 7));
      for (const s of [-1, 1]) r.sweep([[cx + W - 0.8, cy + s * (W - 3), 30], [cx + W - 0.8 + sw * 0.6, cy + s * (W - 5), 20], [cx + W - 0.8 + sw, cy + s * (W - 4), 10]], [1.6, 1.4, 1.2], m(ramp("#c03a32", { lo: "#4a0a1a" }), 7));
      for (const s of [-1, 1]) {
        const top: V3 = [cx + W + 3, cy + s * (W + 2), 46];
        r.sweep([[top[0], top[1], 8], top], 0.5, m(PAL.woodDark, 8));
        r.sweep([top, [top[0] + 1 + sw * 1.5, top[1] + s * 2, 43], [top[0] + 1 + sw * 2.5, top[1] + s * 3, 38]], [1.4, 1.2, 1], m(s > 0 ? PAL.gold : PAL.jade, 8));
      }
    },
  },
  // a tall shop banner on a pole, its cloth swaying in front of a shop
  shopflag: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      const sw = Math.sin((f / n) * TAU);
      r.box([-1, -1, 0], [1, 1, 40], m(PAL.woodDark, 1));
      r.sweep([[0, 0, 39], [0, 7, 39]], 0.5, m(PAL.woodDark, 1));
      const cloth = m(ramp("#2a5a9a", { lo: "#0a1a3a" }), 2, { shader: (sf, tone) => (Math.abs(sf.p[2] - 30) < 2.2 || Math.abs(sf.p[2] - 22) < 2.2 ? tone(PAL.gold) : tone(ramp("#2a5a9a", { lo: "#0a1a3a" }))) });
      for (let k = 0; k <= 6; k++) {
        const y = 1 + k;
        r.sweep([[sw * 0.3 * (k / 6), y, 38.5], [sw * (1 + k * 0.25), y, 26], [sw * (1.6 + k * 0.4), y + 0.3, 14]], 0.6, cloth);
      }
    },
  },
  // the Founder's stele: a tall slab of grey-green stone on a lotus plinth, its carved verse glowing and fading like breath
  daostele: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 4,
    light: { color: "#9ff5de", radius: 34, dy: 26 },
    emit: "sparkle",
    paint: (r, f, n) => {
      const glow = 0.5 + 0.5 * Math.sin((f / n) * TAU);
      const slab = ramp("#9aa8a0", { lo: "#2a3430" });
      r.prism(0, 0, 9, 0, 3, 8, m(PAL.stone, 1));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        r.ellipsoid([Math.cos(a) * 6.4, Math.sin(a) * 6.4, 4], [3, 3, 1.6], m(tones("#fff0f6", "#f8bcd6", "#d88ab4", "#7a4a6a"), 2));
      }
      r.box([-5, -2, 4], [5, 2, 36], md(slab, 3, { shader: (sf, tone) => {
        // columns of carved glyphs on the face, lit by what they say
        const along = Math.abs(sf.n[1]) > 0.5 ? sf.p[0] : sf.p[1];
        const z = sf.p[2];
        const carved = z > 8 && z < 31 && Math.abs(along) < 3.6 && (Math.round(along * 0.9) % 2 === 0) && Math.sin(z * 1.7 + along * 3) > 0.1;
        if (carved) return glow > 0.55 ? "#e8fff8" : tone(tones("#c8fff0", "#9ff5de", "#4ab89a", "#1a5a4a"));
        return tone(slab);
      } }));
      r.box([-6, -2.6, 35], [6, 2.6, 38], m(PAL.stone, 4));
      r.sphere([0, 0, 40], 1.6 + glow * 0.4, m(tones("#ffffff", "#c8fff0", "#9ff5de", "#4ab89a"), 5, { outline: undefined }));
    },
  },
  // a stele the Dao-Eater has emptied: cracked through, its verse gone grey, grey motes leaking out of the cracks
  eatenstele: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      const slab = ramp("#7a7a80", { lo: "#1a1a20" });
      r.prism(0, 0, 9, 0, 3, 8, m(PAL.stone, 1));
      r.box([-5, -2, 4], [5, 2, 20], md(slab, 2, { shader: (sf, tone) => (Math.abs(sf.p[0] + sf.p[2] * 0.3 - 4) < 0.6 ? tone(PAL.black) : tone(slab)) }));
      // the upper half has slid off and lies askew at its foot
      r.box([4, -2, 0], [18, 2, 4], md(slab, 3));
      for (let k = 0; k < 4; k++) {
        const ph = ((f / n) + k / 4) % 1;
        r.sphere([Math.sin(k * 2.3) * 3, Math.cos(k * 1.7) * 1.4, 20 + ph * 22], Math.max(0.6, 1.4 * (1 - ph)), m(tones("#ffffff", "#d8d4e8", "#9a96a8", "#4a4658"), 4, { outline: undefined }));
      }
    },
  },
  // where a Great Dao has been eaten out of the land: a slow grey whirl of motes over dead ground
  qiwhirl: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 6,
    flat: true,
    paint: (r, f, n) => {
      const a0 = (f / n) * TAU;
      for (let k = 0; k < 14; k++) {
        const a = a0 + (k / 14) * TAU;
        const rad = 3 + (k % 3) * 3;
        r.sphere([Math.cos(a + k) * rad, Math.sin(a + k) * rad, 1 + (k % 4) * 1.6], 1.3, m(tones("#ffffff", "#c8c4d8", "#8a86a0", "#3a3648"), 1, { outline: undefined }));
      }
    },
  },
  // a long string of red firecrackers hanging from a bamboo pole, sparks spitting off its lower end
  firecrackers: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 10,
    light: { color: "#ffb040", radius: 18, dy: 6 },
    paint: (r, f) => {
      r.sweep([[0, 0, 0], [0, 0, 40]], 0.8, m(BAMBOO, 1));
      r.sweep([[0, 0, 40], [0, 8, 40]], 0.5, m(BAMBOO, 1));
      for (let k = 0; k < 12; k++) {
        const z = 38 - k * 2.6;
        const sw = Math.sin(f * 1.3 + k * 0.6) * 0.5;
        r.sweep([[sw - 1.4, 8, z], [sw + 1.4, 8, z]], 0.8, m(PAL.red, 2, { shader: (sf, tone) => (Math.abs(sf.u - 0.5) > 0.38 ? tone(PAL.gold) : tone(PAL.red)) }));
      }
      for (let k = 0; k < 4; k++) {
        const a = f * 1.7 + k * 1.6;
        r.sphere([Math.cos(a) * 3, 8 + Math.sin(a) * 2, 6 + Math.sin(a * 2) * 2], 0.9, m(tones("#ffffff", "#fff0a0", "#ffb040", "#f0601e"), 3, { outline: undefined }));
      }
    },
  },
  // a canal sampan with a woven-bamboo awning, rocking on the water
  sampan: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 4,
    paint: (r, f, n) => {
      const rock = Math.sin((f / n) * TAU) * 0.8;
      const hull = ramp("#8a5a3a", { lo: "#2a160a" });
      r.ellipsoid([0, 0, 1 + rock * 0.4], [6, 15, 3], md(hull, 1));
      r.box([-4.6, -12, 3 + rock * 0.4], [4.6, 12, 4 + rock * 0.4], m(PAL.wood, 2));
      r.sweep([[-5, -4, 4], [-4, -4, 10], [0, -4, 12.5], [4, -4, 10], [5, -4, 4]], 1.2, m(PAL.straw, 3));
      r.sweep([[-5, 4, 4], [-4, 4, 10], [0, 4, 12.5], [4, 4, 10], [5, 4, 4]], 1.2, m(PAL.straw, 3));
      r.box([-4.4, -4, 9], [4.4, 4, 12], m(PAL.straw, 3));
      r.sweep([[0, 13, 5], [rock * 2, 20, 2]], 0.6, m(PAL.woodDark, 4));
    },
  },
  // a stack of bamboo steamers on a stove, clouds of steam rolling off the buns inside
  steamer: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 4,
    emit: "steam",
    light: { color: "#ffb070", radius: 20, dy: 6 },
    paint: (r, f) => {
      r.prism(0, 0, 7, 0, 8, 8, md(BRICK2, 1));
      r.ellipsoid([0, 6.6, 3], [2.4, 0.8, 1.6], m(tones("#fff6c0", "#ffb040", "#f0601e", "#a81a10"), 2, { outline: undefined }));
      for (let k = 0; k < 3; k++) r.prism(0, 0, 6 - k * 0.3, 8 + k * 3.4, 11 + k * 3.4, 10, m(PAL.straw, 3, { shader: (sf, tone) => (sf.p[2] % 3.4 < 0.6 ? tone(PAL.straw, 1) : tone(PAL.straw)) }));
      r.cone(0, 0, 5.6, 18.2, 1, 21, 10, m(PAL.straw, 4));
      r.sphere([0, 0, 21.4 + (f % 2) * 0.4], 0.8, m(PAL.woodDark, 5));
    },
  },
  // a stone table with a xiangqi board carved in its top, and two stools
  xiangqitable: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      r.prism(0, 0, 2.6, 0, 9, 8, m(PAL.stone, 1));
      r.prism(0, 0, 8, 9, 11, 12, m(PAL.stone, 2, { shader: (sf, tone) => (sf.n[2] > 0.5 && (Math.abs(sf.p[0] % 2.4) < 0.25 || Math.abs(sf.p[1] % 2.4) < 0.25) ? tone(PAL.stone, 1) : tone(PAL.stone)) }));
      for (let k = 0; k < 8; k++) r.sphere([-4.8 + (k % 4) * 3.2, k < 4 ? -2.8 : 2.8, 11.6], 1, m(k % 3 ? PAL.red : PAL.black, 3));
      for (const s of [-1, 1]) r.prism(0, s * 13, 2.6, 0, 6, 8, m(PAL.stone, 4));
    },
  },
  // a puppet theatre: a little curtained booth whose painted general and maiden bow and spin above the ledge
  puppetbooth: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 6,
    paint: (r, f, n) => {
      const a = (f / n) * TAU;
      const curtain = ramp("#c03a32", { lo: "#3a0a10" });
      r.box([-8, -8, 0], [8, 8, 18], md(curtain, 1, { shader: (sf, tone) => (Math.sin((sf.p[0] + sf.p[1]) * 1.2) > 0.6 ? tone(curtain, 1) : tone(curtain)) }));
      r.box([-9, -9, 18], [9, 9, 19.5], m(PAL.gold, 2));
      for (const [x, y] of [[-8, -8], [8, -8], [-8, 8], [8, 8]] as [number, number][]) r.sweep([[x, y, 19], [x, y, 36]], 0.7, m(PAL.woodDark, 3));
      r.box([-9, -9, 35], [9, 9, 37], m(PAL.red, 4));
      // two puppets dancing on the ledge
      for (const [k, col] of [[0, PAL.gold], [1, PAL.azure]] as [number, typeof PAL.gold][]) {
        const x = (k ? 3.4 : -3.4) + Math.sin(a + k * 3) * 1.2;
        const z = 21 + Math.abs(Math.sin(a * 2 + k)) * 2;
        r.cone(x, 8, 1.8, z, 0.6, z + 4.4, 8, m(col, 5));
        r.sphere([x, 8, z + 5.4], 1.3, m(tones("#ffffff", "#f4d8c0", "#c89878", "#6a4030"), 6));
        r.sweep([[x - 1.6, 8, z + 3.4], [x - 2.6 + Math.sin(a * 2) * 0.8, 8, z + 5]], 0.45, m(col, 5));
      }
    },
  },
  // a hawker's frame of paper pinwheels, all turning in the breeze
  pinwheels: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 8,
    paint: (r, f, n) => {
      r.sweep([[0, 0, 0], [0, 0, 30]], 0.8, m(BAMBOO, 1));
      const spin = (f / n) * (TAU / 4);
      const cols = [PAL.red, PAL.gold, PAL.azure, PAL.jade, PAL.rose];
      for (let k = 0; k < 5; k++) {
        const c: V3 = [Math.cos(k * 1.3) * 4, Math.sin(k * 1.3) * 4, 16 + k * 3];
        r.sweep([[0, 0, c[2] - 2], c], 0.35, m(BAMBOO, 1));
        for (let b = 0; b < 4; b++) {
          const ang = spin + (b / 4) * TAU + k;
          r.sweep([c, [c[0] + Math.cos(ang) * 3, c[1] + 0.6, c[2] + Math.sin(ang) * 3]], [1.4, 0.4], m(cols[(k + b) % cols.length], 2 + k, { outline: undefined }));
        }
      }
    },
  },
  // paper sky lanterns rising slowly off a festival frame into the dusk
  skylanterns: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 3,
    light: { color: "#ffc070", radius: 30, dy: 40 },
    paint: (r, f, n) => {
      for (let k = 0; k < 4; k++) {
        const ph = ((f / n) + k / 4) % 1;
        const c: V3 = [Math.sin(k * 2.1) * 6 + ph * 2, Math.cos(k * 1.4) * 5, 10 + ph * 46];
        r.box([c[0] - 2, c[1] - 2, c[2]], [c[0] + 2, c[1] + 2, c[2] + 4.6], m(tones("#fff6d0", "#ffd070", "#ff8a3a", "#a8401a"), 1 + k, { outline: undefined }));
        r.sphere([c[0], c[1], c[2] + 0.6], 0.9, m(tones("#ffffff", "#fff0a0", "#ffb040", "#f0601e"), 1 + k, { outline: undefined }));
      }
    },
  },
  // a bronze prayer wheel in its little roofed frame, turning as the faithful pass
  prayerwheel: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 6,
    paint: (r, f, n) => {
      const rot = (f / n) * TAU;
      for (const s of [-1, 1]) r.sweep([[s * 7, 0, 0], [s * 7, 0, 26]], 0.8, m(PAL.red, 1));
      r.hipRoof(0, 0, 10, 6, 26, 4, 1, 32, m(ROOF_RED, 2));
      r.prism(0, 0, 4.6, 6, 22, 10, m(BRONZE, 3, { shader: (sf, tone) => (Math.sin(Math.atan2(sf.p[1], sf.p[0]) * 5 + rot * 5) > 0.6 && sf.p[2] > 10 && sf.p[2] < 18 ? tone(PAL.gold) : tone(BRONZE)) }), rot);
      r.sweep([[0, 0, 4], [0, 0, 24]], 0.6, m(PAL.woodDark, 4));
    },
  },
  // salt pans: shallow square beds of brine drying white in the sun, with a raked heap of salt
  saltpan: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 4,
    fps: 2,
    flat: true,
    paint: (r, f) => {
      for (const [x, y] of [[-6, -6], [6, -6], [-6, 6], [6, 6]] as [number, number][]) {
        r.box([x - 5.4, y - 5.4, 0], [x + 5.4, y + 5.4, 1], m(PAL.stone, 1));
        r.box([x - 4.6, y - 4.6, 1], [x + 4.6, y + 4.6, 1.3], m(tones("#ffffff", "#e8f0f8", "#a8c8e0", "#5a7a9a"), 2, { shader: (sf, tone) => (Math.sin(sf.p[0] * 2 + sf.p[1] + f) > 0.92 ? "#ffffff" : tone(tones("#ffffff", "#e8f0f8", "#a8c8e0", "#5a7a9a"))) }));
      }
      r.cone(6, 6, 3, 1, 0.4, 4.6, 8, m(tones("#ffffff", "#f4f6fa", "#c8d0dc", "#7a8496"), 3));
      // the sun glints off the brine, a different pan each moment
      const [gx, gy] = [[-6, -6], [6, -6], [6, 6], [-6, 6]][f % 4];
      r.sphere([gx + 2, gy - 1, 1.6], 0.9, m(tones("#ffffff", "#ffffff", "#e8f6ff", "#c8e0f0"), 4, { outline: undefined }));
    },
  },
  // the Ten Halls' Stone of Affinity: a great egg of pale stone on a lotus plinth, its heart glowing through the colours of the ten Great Daos in turn
  affinitystone: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 10,
    fps: 3,
    light: { color: "#bfe8ff", radius: 30, dy: 18 },
    emit: "sparkle",
    paint: (r, f) => {
      const hues = ["#6ab8f0", "#7ad07a", "#c8f0e8", "#ff8a3a", "#c8a060", "#d8e0f0", "#b8a4ff", "#bfe8ff", "#f6a6c9", "#ffffff"];
      const glow = tones("#ffffff", hues[f], hues[f], "#4a4a6a");
      r.prism(0, 0, 9, 0, 3, 8, m(PAL.stone, 1));
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        r.ellipsoid([Math.cos(a) * 6.4, Math.sin(a) * 6.4, 4], [3, 3, 1.4], m(tones("#fff6fa", "#e8d8f0", "#b8a8d0", "#5a4a7a"), 2));
      }
      // veins of light run round the stone, lit in the colour of whichever Dao it is thinking of
      r.ellipsoid([0, 0, 15], [7, 7, 11], md(ramp("#e8e4ec", { lo: "#5a5470" }), 3, { shader: (sf, tone) => (Math.sin(sf.p[2] * 1.3 + Math.atan2(sf.p[1], sf.p[0]) * 2) > 0.72 ? tone(glow, -1) : tone(ramp("#e8e4ec", { lo: "#5a5470" }))) }));
      r.sphere([0, 0, 27.4], 1.8, m(glow, 4, { outline: undefined }));
    },
  },
  // a two-tier bunk of plain pine for the Outer Court's dormitories: a straw mattress and a quilt on each tier, a ladder up the end
  bunkbed: {
    foot: [0, 0, 1, 0],
    blocks: true,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const pine = ramp("#b88a5a", { lo: "#3a2414" });
      for (const x of [-10, T + 10]) for (const y of [-9, 9]) r.box([x - 1.2, y - 1.2, 0], [x + 1.2, y + 1.2, 30], m(pine, 1));
      for (const z of [7, 21]) {
        r.box([-10, -9, z], [T + 10, 9, z + 2], md(pine, 2));
        r.box([-9, -8, z + 2], [T + 8, 8, z + 4], m(PAL.straw, 3));
        r.ellipsoid([-5, 0, z + 5], [3, 5, 1.6], m(PAL.paper, 4));
        r.box([-1, -8.4, z + 4], [T + 8, 8.4, z + 5.6], m(ramp(z < 10 ? "#5a7aa8" : "#a85a6a"), 5, { shader: (s, tone) => (Math.sin(s.p[0] * 0.9) > 0.7 ? tone(PAL.white) : tone(ramp(z < 10 ? "#5a7aa8" : "#a85a6a"))) }));
      }
      for (let z = 4; z < 28; z += 4) r.sweep([[T + 12, -4, z], [T + 12, 4, z]], 0.5, m(pine, 6));
      r.sweep([[T + 12, -4, 0], [T + 12, -4, 30]], 0.6, m(pine, 6));
      r.sweep([[T + 12, 4, 0], [T + 12, 4, 30]], 0.6, m(pine, 6));
    },
  },
  // the Mission Hall's board: a roofed notice board crowded with slips of paper that flutter in the breeze
  missionboard: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 6,
    fps: 5,
    paint: (r, f, n) => {
      for (const x of [-11, 11]) r.box([x - 1.2, -1.2, 0], [x + 1.2, 1.2, 30], m(PAL.woodDark, 1));
      r.box([-11, -1, 8], [11, 1, 28], m(PAL.wood, 2));
      r.hipRoof(0, 0, 14, 5, 30, 7, 0.5, 35, md(ROOF_TEAL, 3, { shader: roofTiles(ROOF_TEAL) }));
      for (let k = 0; k < 12; k++) {
        const x = -8.6 + (k % 6) * 3.4;
        const z = 24 - Math.floor(k / 6) * 9;
        const flap = Math.sin((f / n) * TAU + k * 1.7);
        r.sweep([[x, -1.4, z], [x + flap * 0.8, -1.6 - Math.abs(flap) * 2.4, z - 6]], 1.1, m(k % 4 === 1 ? PAL.red : PAL.paper, 4));
      }
    },
  },
  // a bronze gong in a red frame, shivering after it is struck, its hammer hanging beside it
  gong: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 8,
    paint: (r, f, n) => {
      for (const x of [-10, 10]) r.box([x - 1.2, -1.2, 0], [x + 1.2, 1.2, 32], m(PILLAR, 1));
      r.box([-12, -1.4, 31], [12, 1.4, 34], m(PILLAR, 2));
      const shiver = f < n / 2 ? Math.sin(f * 3) * 0.6 * (1 - f / (n / 2)) : 0;
      r.sweep([[-4, 0, 31], [-4, shiver, 26]], 0.3, m(PAL.black, 3));
      r.sweep([[4, 0, 31], [4, shiver, 26]], 0.3, m(PAL.black, 3));
      r.ellipsoid([0, shiver, 17], [8.6, 1.4, 8.6], md(BRONZE, 4, { shader: (s, tone) => (Math.abs(Math.hypot(s.p[0], s.p[2] - 17) - 5) < 0.6 ? tone(BRONZE, 1) : Math.hypot(s.p[0], s.p[2] - 17) < 2 ? tone(PAL.gold, -1) : tone(BRONZE)) }));
      r.sweep([[12, -3, 18], [12, -3, 4]], 0.7, m(PAL.wood, 5));
      r.sphere([12, -3, 3.4], 1.8, m(PAL.red, 5));
    },
  },
  // a bronze lamp-tree with ten flames, one in the colour of each Great Dao; the tenth burns clear, and sometimes not at all
  tenlamps: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 6,
    light: { color: "#ffd890", radius: 36, dy: 30 },
    paint: (r, f, n) => {
      const hues = ["#6ab8f0", "#7ad07a", "#c8f0e8", "#ff8a3a", "#c8a060", "#d8e0f0", "#b8a4ff", "#bfe8ff", "#f6a6c9", "#ffffff"];
      r.prism(0, 0, 7, 0, 3, 8, m(PAL.stone, 1));
      r.sweep([[0, 0, 3], [0, 0, 34]], 1.4, md(BRONZE, 2));
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * TAU;
        const z = 14 + (k % 3) * 7;
        const tip: V3 = [Math.cos(a) * 9, Math.sin(a) * 9, z];
        r.sweep([[0, 0, z - 4], tip], 0.5, m(BRONZE, 3));
        r.cone(tip[0], tip[1], 1.6, z, 2.2, z + 1.4, 8, m(BRONZE, 3));
        const flick = Math.sin((f / n) * TAU * 2 + k * 1.3);
        if (k === 9 && f % 4 === 1) continue;
        r.ellipsoid([tip[0], tip[1], z + 3 + flick * 0.4], [1, 1, 2 + flick * 0.4], m(tones("#ffffff", hues[k], hues[k], "#5a4a3a"), 4 + k, { outline: undefined }));
      }
      r.sphere([0, 0, 36], 2, m(PAL.gold, 15));
    },
  },
  // the round door of the Sealed Hall of the Void: black stone carved with a closed eye, bound in chains and talismans, breathing a faint violet light
  voiddoor: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 4,
    light: { color: "#c8b8ff", radius: 24, dy: 16 },
    paint: (r, f, n) => {
      const pulse = 0.5 + 0.5 * Math.sin((f / n) * TAU);
      const stone = ramp("#3a3448", { lo: "#0a0810" });
      r.box([-13, -3, 0], [13, 3, 3], m(PAL.stone, 1));
      r.ellipsoid([0, 0, 16], [12, 2.4, 13], md(stone, 2, { shader: (s, tone) => {
        const d = Math.hypot(s.p[0] * 1.4, s.p[2] - 16);
        if (Math.abs(d - 5) < 0.6 && s.p[2] < 17) return pulse > 0.5 ? "#e8e0ff" : tone(ramp("#8a7ab8"));
        if (Math.abs(s.p[2] - 16) < 0.5 && Math.abs(s.p[0]) < 4) return tone(ramp("#8a7ab8"));
        return tone(stone);
      } }));
      // chains in an X across the face, and two talismans
      for (const s of [-1, 1]) r.sweep(spline([[-11 * s, -2.8, 26], [0, -3.4, 16], [11 * s, -2.8, 6]], 4), 0.7, m(PAL.steel, 3, { shader: (sf, tone) => (Math.sin(sf.u * 40) > 0 ? tone(PAL.steel) : tone(PAL.steel, 1)) }));
      for (const x of [-6, 6]) r.box([x - 1.2, -3.6, 18], [x + 1.2, -3.2, 24 + Math.sin(f + x) * 0.4], m(PAL.paper, 4, { shader: (sf, tone) => (Math.abs(sf.p[0] - x) < 0.3 ? tone(PAL.red) : tone(PAL.paper)) }));
    },
  },
  // a two-storey shophouse: an open shopfront below with its shutters folded back, a jettied upper floor with a balcony over the street, and a skirt roof between the storeys
  townhouse: {
    foot: [0, 0, 1, 1],
    blocks: true,
    frames: 6,
    fps: 4,
    emit: "smoke",
    light: { color: "#ffb060", radius: 40, dy: 34 },
    paint: (r, f, n) => {
      const cx = T / 2;
      const cy = T / 2;
      const W = T * 0.85;
      const lattice = (z0: number, z1: number) => (s: { p: V3; n: V3 }, tone: (r: Ramp, d?: number) => string) => {
        const fx = Math.abs(s.n[0]) > 0.5;
        const along = fx ? s.p[1] - cy : s.p[0] - cx;
        if (Math.abs(along) > W - 2.2 || s.p[2] > z1 - 1.6 || s.p[2] < z0 + 1.2) return tone(PAL.woodDark);
        if (Math.abs(s.p[2] - (z0 + z1) / 2) < 3 && Math.abs(Math.abs(along) - 6) < 3.4) return Math.abs(((along + 30) % 1.7) - 0.85) < 0.25 || Math.abs(((s.p[2] + 30) % 1.7) - 0.85) < 0.25 ? tone(PAL.woodDark) : "#ffd890";
        return tone(WALL);
      };
      r.box([cx - W - 1, cy - W - 1, 0], [cx + W + 1, cy + W + 1, 3], m(PAL.stone, 1));
      // the ground floor: three plastered walls, and the open shopfront on the east face with a counter and its goods
      r.box([cx - W, cy - W, 3], [cx + W - 4, cy + W, 22], md(WALL, 2, { shader: lattice(3, 22) }));
      for (const y of [cy - W + 1, cy - W / 3, cy + W / 3, cy + W - 1]) r.prism(cx + W - 1, y, 1.2, 3, 22, 6, m(PILLAR, 3));
      r.box([cx + W - 4, cy - W + 2, 3], [cx + W - 1, cy + W - 2, 9], m(PAL.wood, 4));
      for (let k = 0; k < 4; k++) r.sphere([cx + W - 2.5, cy - W + 5 + k * 4.2, 10.4], 1.4, m([PAL.orange, PAL.green, PAL.red, PAL.gold][k], 5));
      r.box([cx + W - 4.6, cy - W, 15], [cx + W - 4, cy + W, 22], m(PAL.woodDark, 6));
      // a skirt roof of grey tiles between the storeys
      r.hipRoof(cx, cy, W + 6, W + 6, 20, W + 1, W + 1, 25, md(ROOF_GREY, 7, { shader: roofTiles(ROOF_GREY) }));
      // the upper floor juts out a little over the street
      r.box([cx - W - 1, cy - W - 1, 25], [cx + W + 1, cy + W + 1, 42], md(WALL, 8, { shader: lattice(25, 42) }));
      // a balcony on the east face with its railing, a curtain stirring in the doorway behind it
      r.box([cx + W + 1, cy - W + 1, 25], [cx + W + 6, cy + W - 1, 26.4], m(PAL.woodDark, 9));
      railing(r, [cx + W + 5.6, cy - W + 1.5, 26.4], [cx + W + 5.6, cy + W - 1.5, 26.4], m(PILLAR, 10), 4.2, 3);
      const st = Math.sin((f / n) * TAU) * 0.8;
      r.box([cx + W + 0.8, cy - 4, 27], [cx + W + 1.4 + Math.max(0, st), cy + 4, 39], m(ramp("#e86a7a", { lo: "#5a1a3a" }), 11));
      // the top roof, with curled ridge ends and a chimney
      r.hipRoof(cx, cy, W + 8, W + 8, 42, W * 0.6, 1, 58, md(ROOF_GREY, 12, { shader: roofTiles(ROOF_GREY) }));
      r.sweep([[cx - W * 0.6, cy, 58.5], [cx + W * 0.6, cy, 58.5]], 1.2, m(PAL.black, 13));
      for (const sx of [-1, 1]) r.sweep([[cx + sx * W * 0.6, cy, 58.5], [cx + sx * (W * 0.6 + 2.5), cy, 59.5], [cx + sx * (W * 0.6 + 3.2), cy, 62]], [1.2, 0.9, 0.5], m(PAL.black, 13));
      r.box([cx + 6, cy - 9, 48], [cx + 10, cy - 5, 62], m(PAL.stone, 14));
      // red lanterns swinging from the balcony's eave
      for (const o of [-W + 4, W - 4]) {
        const sw = Math.sin((f / n) * TAU + o) * 0.9;
        r.sweep([[cx + W + 7, cy + o, 42], [cx + W + 7 + sw * 0.5, cy + o - sw * 0.5, 38.5]], 0.2, m(PAL.black, 15));
        r.ellipsoid([cx + W + 7 + sw * 0.7, cy + o - sw * 0.7, 36.4], [1.9, 1.9, 2.4], m(PAL.red, 16, { shader: (q, tone) => (Math.abs(q.p[2] - 36.4) > 2 ? tone(PAL.gold) : tone(PAL.red)) }));
      }
      // a shop banner hung from the upper floor, swaying
      const pole: V3 = [cx + W + 1, cy + W + 1, 40];
      const pts: V3[] = [];
      for (let k = 0; k <= 5; k++) {
        const w = Math.sin((f / n) * TAU - k * 0.7) * (k / 5) * 1.2;
        pts.push(add(pole, [w * 0.5, 2 - w * 0.5, -k * 2.6]));
      }
      r.sweep(pts, 1.6, m(PAL.paper, 17, { shader: (q, tone) => (q.u > 0.3 && q.u < 0.7 && Math.abs(((q.p[2] + 40) % 4) - 2) < 0.9 ? tone(PAL.red) : tone(PAL.paper)) }));
    },
  },
  // a three-storey restaurant (酒楼): a gallery with its railing round each upper floor, a skirt roof under each, a tall gilt signboard, wine flags, and strings of red lanterns down the eaves
  towerinn: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 6,
    fps: 4,
    emit: "smoke",
    light: { color: "#ffb060", radius: 60, dy: 56 },
    paint: (r, f, n) => {
      const E = T * 1.45;
      r.box([-E, -E, 0], [E, E, 3], md(PAL.stone, 1));
      let z = 3;
      const storeys = [21, 18, 17];
      for (let k = 0; k < 3; k++) {
        const W = T * (1.28 - k * 0.12);
        const h = storeys[k];
        const z0 = z;
        r.box([-W, -W, z0], [W, W, z0 + h], md(WALL, 2 + k, {
          shader: (s, tone) => {
            const fx = Math.abs(s.n[0]) > 0.5;
            const along = fx ? s.p[1] : s.p[0];
            if (Math.abs(along) > W - 2 || s.p[2] > z0 + h - 1.4 || s.p[2] < z0 + 1) return tone(PILLAR);
            if (k === 0 && fx && s.n[0] > 0 && Math.abs(along) < 6 && s.p[2] < z0 + 15) return Math.abs(along) < 0.4 ? tone(PAL.woodDark) : tone(PILLAR, 1);
            if (Math.abs(s.p[2] - (z0 + h * 0.55)) < h * 0.26 && Math.abs(((along + 60) % 9) - 4.5) < 3) return Math.abs(((along + 60) % 1.6) - 0.8) < 0.22 || Math.abs(((s.p[2] + 60) % 1.6) - 0.8) < 0.22 ? tone(PAL.woodDark) : "#ffd890";
            return tone(WALL);
          },
        }));
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.prism(sx * (W - 0.6), sy * (W - 0.6), 1.4, z0, z0 + h, 6, m(PILLAR, 6));
        z += h;
        // a skirt roof, then the next floor's gallery with its railing
        r.hipRoof(0, 0, W + 6, W + 6, z - 3, W + 0.5, W + 0.5, z + 2, md(ROOF_RED, 7 + k, { shader: roofTiles(ROOF_RED) }));
        for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.sweep([[sx * (W + 5), sy * (W + 5), z - 2.6], [sx * (W + 8), sy * (W + 8), z + 1]], [1, 0.4], m(ROOF_RED, 10));
        if (k < 2) {
          const G = T * (1.28 - (k + 1) * 0.12) + 4;
          r.box([-G, -G, z + 1], [G, G, z + 2.2], m(PAL.woodDark, 11));
          for (const [a, b] of [
            [[-G, -G], [G, -G]],
            [[G, -G], [G, G]],
            [[G, G], [-G, G]],
            [[-G, G], [-G, -G]],
          ] as [[number, number], [number, number]][])
            railing(r, [a[0] * 0.98, a[1] * 0.98, z + 2.2], [b[0] * 0.98, b[1] * 0.98, z + 2.2], m(PILLAR, 12), 3.4, 3.2);
          z += 2.2;
        }
        // strings of red lanterns swinging under the eaves on the street side
        for (const o of [-W + 3, 0, W - 3]) {
          const sw = Math.sin((f / n) * TAU + o + k) * 0.9;
          r.sweep([[W + 5, o, z - 1], [W + 5 + sw * 0.5, o - sw * 0.5, z - 4]], 0.2, m(PAL.black, 13));
          r.ellipsoid([W + 5 + sw * 0.7, o - sw * 0.7, z - 6], [1.8, 1.8, 2.2], m(PAL.red, 14, { shader: (q, tone) => (Math.abs(q.p[2] - (z - 6)) > 1.8 ? tone(PAL.gold) : tone(PAL.red)) }));
        }
      }
      // the top roof, steep and upturned, with a gilt pearl on its ridge
      const W = T * 1.04;
      r.hipRoof(0, 0, W + 8, W + 8, z, W * 0.4, 1, z + 17, md(ROOF_RED, 15, { shader: roofTiles(ROOF_RED) }));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.sweep([[sx * (W + 7), sy * (W + 7), z + 1], [sx * (W + 11), sy * (W + 11), z + 5]], [1.2, 0.4], m(ROOF_RED, 16));
      r.sweep([[-W * 0.4, 0, z + 17.5], [W * 0.4, 0, z + 17.5]], 1.2, m(PAL.gold, 17));
      r.sphere([0, 0, z + 20], 2, m(PAL.gold, 17));
      // a tall black signboard with gold characters between the first and second floors
      const SW = T * 1.28;
      r.box([SW + 0.4, -3, 26], [SW + 1.6, 3, 44], m(PAL.black, 18, { shader: (q, tone) => (q.n[0] > 0.5 && Math.abs(q.p[1]) < 1.6 && Math.abs(((q.p[2] + 40) % 5.5) - 2.75) < 1.6 ? tone(PAL.gold) : tone(PAL.black)) }));
      // two wine flags (酒) on poles at the front corners
      for (const o of [-1, 1]) {
        const pole: V3 = [SW + 4, o * (SW + 2), 0];
        r.sweep([pole, add(pole, [0, 0, 46])], 0.8, m(PAL.woodDark, 19));
        const pts: V3[] = [];
        for (let k = 0; k <= 5; k++) {
          const w = Math.sin((f / n) * TAU - k * 0.8 + o) * (k / 5) * 1.8;
          pts.push(add(pole, [w * 0.4, o * (k * 1.7) + w * 0.4, 42 - k * 0.2]));
        }
        r.sweep(pts, 3.2, m(o < 0 ? PAL.paper : ramp("#3a6ab8"), 20, { shader: (q, tone) => (q.u > 0.35 && q.u < 0.7 && Math.abs(q.p[2] - 42) < 1.2 ? tone(PAL.red) : tone(o < 0 ? PAL.paper : ramp("#3a6ab8"))) }));
      }
    },
  },
  // a drum tower: a brick podium with an arched passage, and a pavilion of two roofs over it where the great drum hangs
  drumtower: {
    foot: [-1, -1, 1, 1],
    blocks: true,
    frames: 4,
    fps: 3,
    light: { color: "#ffd070", radius: 44, dy: 70 },
    paint: (r, f, n) => {
      const E = T * 1.4;
      r.box([-E, -E, 0], [E, E, 30], md(ramp("#8a8a96", { lo: "#2a2a3a" }), 1, {
        shader: (s, tone) => {
          const along = Math.abs(s.n[0]) > 0.5 ? s.p[1] : s.p[0];
          if (Math.abs(s.n[2]) < 0.5 && Math.abs(along) < 7 && s.p[2] < 14 + Math.sqrt(Math.max(0, 49 - along * along)) * 0.6) return "#1a1420";
          if (s.p[2] % 3 < 0.45) return tone(ramp("#8a8a96", { lo: "#2a2a3a" }), 1);
          return tone(ramp("#8a8a96", { lo: "#2a2a3a" }));
        },
      }));
      r.box([-E - 0.6, -E - 0.6, 30], [E + 0.6, E + 0.6, 32], m(PAL.stone, 2));
      for (const [a, b] of [
        [[-E, -E], [E, -E]],
        [[E, -E], [E, E]],
        [[E, E], [-E, E]],
        [[-E, E], [-E, -E]],
      ] as [[number, number], [number, number]][])
        railing(r, [a[0], a[1], 32], [b[0], b[1], 32], m(PAL.stone, 3), 3.6, 4.4);
      const W = T * 0.95;
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.prism(sx * W, sy * W, 1.6, 32, 52, 8, m(PILLAR, 4));
      r.box([-W + 2, -W + 2, 32], [W - 2, W - 2, 46], md(WALL, 5, { shader: (s, tone) => (Math.abs(((s.p[0] + s.p[1] + 60) % 6) - 3) < 1 ? tone(PILLAR) : tone(WALL)) }));
      // the great drum on its stand, struck now and then
      const beat = f % 2 === 0 ? 0.6 : 0;
      r.ellipsoid([W + 1.6, 0, 40], [2.4 + beat * 0.3, 6.6, 6.6], m(PAL.red, 6, { shader: (s, tone) => (s.n[0] > 0.6 ? tone(ramp("#f4e2c0")) : Math.abs(Math.abs(s.p[1]) - 6) < 0.6 ? tone(PAL.gold) : tone(PAL.red)) }));
      r.hipRoof(0, 0, W + 8, W + 8, 52, W + 1, W + 1, 56, md(ROOF_TEAL, 7, { shader: roofTiles(ROOF_TEAL) }));
      r.box([-W * 0.75, -W * 0.75, 56], [W * 0.75, W * 0.75, 64], md(WALL, 8, { shader: (s, tone) => (s.p[2] > 61 ? tone(PAL.jade) : tone(PILLAR)) }));
      r.hipRoof(0, 0, W + 4, W + 4, 64, W * 0.3, 1, 78, md(ROOF_TEAL, 9, { shader: roofTiles(ROOF_TEAL) }));
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) {
          r.sweep([[sx * (W + 7), sy * (W + 7), 53], [sx * (W + 11), sy * (W + 11), 57]], [1.1, 0.4], m(ROOF_TEAL, 10));
          r.sweep([[sx * (W + 3), sy * (W + 3), 65], [sx * (W + 6.5), sy * (W + 6.5), 69]], [1, 0.4], m(ROOF_TEAL, 10));
        }
      r.sweep([[-W * 0.3, 0, 78.5], [W * 0.3, 0, 78.5]], 1.2, m(PAL.gold, 11));
      // a pennant streaming from the top
      const pts: V3[] = [];
      for (let k = 0; k <= 5; k++) pts.push([k * 1.6, -k * 1.6 + Math.sin((f / n) * TAU - k) * (k / 5) * 1.4, 88 - k * 0.3]);
      r.sweep([[0, 0, 78], [0, 0, 90]], 0.6, m(PAL.woodDark, 12));
      r.sweep(pts, 1.4, m(PAL.red, 13));
    },
  },
  // a long two-storey mansion: a colonnade before the ground floor, a gallery with its railing running the length of the upper floor, under a single great roof
  mansion: {
    foot: [0, 0, 2, 1],
    blocks: true,
    frames: 4,
    fps: 3,
    emit: "smoke",
    light: { color: "#ffd070", radius: 44, dy: 36 },
    paint: (r, f, n) => {
      const cx = T;
      const cy = T / 2;
      const WX = T * 1.35;
      const WY = T * 0.85;
      r.box([cx - WX - 2, cy - WY - 2, 0], [cx + WX + 2, cy + WY + 2, 3], md(PAL.stone, 1));
      const win = (z0: number, z1: number) => (s: { p: V3; n: V3 }, tone: (r: Ramp, d?: number) => string) => {
        const fx = Math.abs(s.n[0]) > 0.5;
        const along = fx ? s.p[1] - cy : s.p[0] - cx;
        const half = fx ? WY : WX;
        if (Math.abs(along) > half - 2 || s.p[2] > z1 - 1.4 || s.p[2] < z0 + 1) return tone(PAL.woodDark);
        if (Math.abs(s.p[2] - (z0 + z1) / 2) < 3.2 && Math.abs(((along + 90) % 10) - 5) < 3.2) return Math.abs(((along + 90) % 1.6) - 0.8) < 0.22 ? tone(PAL.woodDark) : "#ffd890";
        return tone(WALL);
      };
      r.box([cx - WX, cy - WY, 3], [cx + WX, cy + WY - 3, 22], md(WALL, 2, { shader: win(3, 22) }));
      for (let x = cx - WX + 1; x <= cx + WX - 1 + 0.01; x += (WX * 2 - 2) / 5) r.prism(x, cy + WY - 0.5, 1.3, 3, 23, 6, m(PILLAR, 3));
      r.box([cx - 4, cy + WY - 3.4, 3], [cx + 4, cy + WY - 2.8, 17], m(PAL.woodDark, 4, { shader: (s, tone) => (Math.abs(s.p[0] - cx) < 0.35 ? tone(PAL.black) : tone(PILLAR)) }));
      r.hipRoof(cx, cy, WX + 5, WY + 5, 20, WX + 0.5, WY + 0.5, 24, md(ROOF_TEAL, 5, { shader: roofTiles(ROOF_TEAL) }));
      r.box([cx - WX, cy - WY, 24], [cx + WX, cy + WY - 4, 40], md(WALL, 6, { shader: win(24, 40) }));
      r.box([cx - WX, cy + WY - 4, 24], [cx + WX, cy + WY + 1, 25.2], m(PAL.woodDark, 7));
      railing(r, [cx - WX + 0.5, cy + WY + 0.6, 25.2], [cx + WX - 0.5, cy + WY + 0.6, 25.2], m(PILLAR, 8), 4, 3.4);
      for (let x = cx - WX + 1; x <= cx + WX - 1 + 0.01; x += (WX * 2 - 2) / 5) r.prism(x, cy + WY + 0.4, 1, 25, 40, 6, m(PILLAR, 9));
      r.hipRoof(cx, cy, WX + 8, WY + 8, 40, WX * 0.6, 1, 56, md(ROOF_TEAL, 10, { shader: roofTiles(ROOF_TEAL) }));
      r.sweep([[cx - WX * 0.6, cy, 56.5], [cx + WX * 0.6, cy, 56.5]], 1.3, m(PAL.gold, 11));
      for (const sx of [-1, 1])
        for (const sy of [-1, 1]) r.sweep([[cx + sx * (WX + 7), cy + sy * (WY + 7), 41], [cx + sx * (WX + 11), cy + sy * (WY + 11), 45]], [1.1, 0.4], m(ROOF_TEAL, 12));
      // lanterns along the gallery, swaying
      for (let k = 0; k < 4; k++) {
        const x = cx - WX + 5 + k * ((WX * 2 - 10) / 3);
        const sw = Math.sin((f / n) * TAU + k) * 0.8;
        r.sweep([[x, cy + WY + 5, 40], [x + sw * 0.5, cy + WY + 5 - sw * 0.5, 36.5]], 0.2, m(PAL.black, 13));
        r.ellipsoid([x + sw * 0.7, cy + WY + 5 - sw * 0.7, 34.5], [1.8, 1.8, 2.2], m(PAL.red, 14));
      }
    },
  },
  // the gate at the head of each stair of the City of Nine Tiers: two stone pillars carved with the tier's name and a lintel with its numeral (spans x, the stair runs through it)
  tiergate: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 1,
    fps: 1,
    paint: (r) => {
      const stone = ramp("#d8d0c0", { lo: "#4a4458" });
      for (const s of [-1, 1]) {
        r.box([s * 20 - 3, -3, 0], [s * 20 + 3, 3, 54], md(stone, 1, { shader: (q, tone) => (Math.abs(q.n[1]) > 0.5 && Math.abs(q.p[0] - s * 20) < 1 && q.p[2] > 10 && q.p[2] < 46 && Math.abs(((q.p[2] + 30) % 5) - 2.5) < 1.4 ? tone(PAL.gold) : tone(stone)) }));
        r.prism(s * 20, 0, 5, 0, 4, 8, m(PAL.stone, 2));
        r.sphere([s * 20, 0, 57], 3, m(PAL.gold, 3));
      }
      r.box([-26, -3.4, 46], [26, 3.4, 52], md(stone, 4, { shader: (q, tone) => (Math.abs(q.n[1]) > 0.5 && Math.abs(q.p[0]) < 5 && Math.abs(q.p[2] - 49) < 2 ? tone(PAL.red) : tone(stone)) }));
      r.hipRoof(0, 0, 30, 6, 52, 26, 0.6, 58, m(ROOF_GREY, 5, { shader: roofTiles(ROOF_GREY) }));
    },
  },
  // heaven's stair sealed: a curtain of gold light strung across a tier's stair, strands rippling, the seal of the tier glowing in its middle (it bars anyone below the tier's realm)
  stairseal: {
    foot: [0, 0, 0, 0],
    blocks: false,
    frames: 8,
    fps: 6,
    light: { color: "#ffe08a", radius: 36, dy: 20 },
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const light = m(ramp("#fff6c8", { lo: "#d8a040" }), 1, { outline: undefined });
      // strands of light hanging from the top of the gate to the stair, each rippling in its own time
      for (let k = 0; k <= 10; k++) {
        const x = -15 + k * 3;
        const pts: V3[] = [];
        for (let z = 0; z <= 30; z += 5) pts.push([x + Math.sin(ph + k * 0.9 + z * 0.15) * 0.7, 0, z]);
        r.sweep(pts, 0.32, light);
      }
      r.sweep([[-16, 0, 31], [16, 0, 31]], 0.6, m(PAL.gold, 2));
      // the tier's seal: a ring of gold with a bar through it, turning slowly
      const rr = 5.2;
      const ring: V3[] = [];
      for (let a = 0; a <= 16; a++) ring.push([Math.cos((a / 16) * TAU) * rr * Math.cos(ph * 0.5), Math.sin((a / 16) * TAU) * rr * Math.sin(ph * 0.5) * 0.3, 16 + Math.sin((a / 16) * TAU) * rr]);
      r.sweep(ring, 0.55, m(PAL.gold, 3, { outline: undefined }));
      r.sweep([[-3.4, 0, 16], [3.4, 0, 16]], 0.5, m(PAL.gold, 3, { outline: undefined }));
      for (let k = 0; k < 4; k++) r.sphere([Math.cos(ph + k * 1.6) * 14, 0, 4 + ((k * 8 + f * 3) % 26)], 0.8, m(PAL.gold, 4, { outline: undefined }));
    },
  },
  // a lacquered sedan chair with its carrying poles, the curtain stirring (the upper tiers do not walk the stair)
  sedan: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 4,
    fps: 4,
    paint: (r, f, n) => {
      const st = Math.sin((f / n) * TAU) * 0.6;
      for (const y of [-6, 6]) r.sweep([[-16, y, 13], [16, y, 13]], 0.9, m(PAL.woodDark, 1));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.box([sx * 4 - 0.6, sy * 4 - 0.6, 0], [sx * 4 + 0.6, sy * 4 + 0.6, 10], m(PAL.woodDark, 2));
      r.box([-5.6, -5.4, 10], [5.6, 5.4, 26], md(PAL.red, 3, { shader: (q, tone) => (Math.abs(q.p[2] - 18) < 3.4 && (Math.abs(q.n[0]) > 0.5 ? Math.abs(q.p[1]) < 3 : Math.abs(q.p[0]) < 3) ? tone(PAL.gold, 1) : tone(PAL.red)) }));
      r.box([5.6, -3, 12], [6.2 + Math.max(0, st), 3, 24], m(PAL.gold, 4));
      r.hipRoof(0, 0, 8, 8, 26, 1.4, 1.4, 33, m(PAL.black, 5));
      r.sphere([0, 0, 34], 1.6, m(PAL.gold, 6));
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) r.sweep([[sx * 7.4, sy * 7.4, 26.4], [sx * 9, sy * 9, 24]], 0.3, m(PAL.gold, 7));
    },
  },
  // the Weighing Hall's great steelyard: a beam on a frame of black timber, the brass weight sliding and the pan swinging, for weighing the bones of everyone who comes to the city
  bigscale: {
    foot: [0, 0, 0, 0],
    blocks: true,
    frames: 8,
    fps: 4,
    paint: (r, f, n) => {
      const ph = (f / n) * TAU;
      const tilt = Math.sin(ph) * 2.2;
      r.box([-3, -10, 0], [3, 10, 2], m(PAL.stone, 1));
      for (const y of [-8, 8]) r.sweep([[0, y, 2], [0, y * 0.4, 40]], 1.2, m(PAL.black, 2));
      r.sweep([[0, -4, 40], [0, 4, 40]], 1.4, m(PAL.black, 2));
      const a: V3 = [-14, 0, 37 + tilt];
      const b: V3 = [20, 0, 37 - tilt * 1.4];
      r.sweep([a, b], 0.9, m(PAL.woodDark, 3, { shader: (q, tone) => (Math.sin(q.u * 60) > 0.75 ? tone(PAL.gold) : tone(PAL.woodDark)) }));
      r.sweep([[0, 0, 40], [0, 0, 37]], 0.5, m(PAL.gold, 4));
      const pan: V3 = [-14 + Math.sin(ph * 2) * 0.6, 0, 18 + tilt];
      for (const o of [-3, 3]) for (const p of [-3, 3]) r.sweep([a, [pan[0] + o, pan[1] + p, pan[2] + 0.4]], 0.18, m(PAL.black, 5));
      r.ellipsoid(pan, [5, 5, 1], m(PAL.gold, 6));
      const w = 6 + Math.cos(ph) * 6;
      r.sweep([[w, 0, 37 - (tilt * 1.4 * w) / 20], [w, 0, 31 - (tilt * 1.4 * w) / 20]], 0.25, m(PAL.black, 7));
      r.prism(w, 0, 2.2, 26 - (tilt * 1.4 * w) / 20, 31 - (tilt * 1.4 * w) / 20, 8, m(PAL.gold, 8));
    },
  },
} satisfies Record<string, PropDef>;

const BRICK2 = ramp("#8a5a4a", { lo: "#2a1410" });

const BRICK = ramp("#8a8a96", { lo: "#2a2a3a" });

/** Courses of grey brick, with a darker line at every course and a stagger between them. */
function brickShader(...[sf, tone]: Parameters<Shader>): string {
  const z = sf.p[2];
  const along = Math.abs(sf.n[0]) > 0.5 ? sf.p[1] : sf.p[0];
  const course = Math.floor(z / 3);
  if (z % 3 < 0.45) return tone(BRICK, 1);
  if (Math.abs(sf.n[2]) < 0.5 && (along + (course % 2) * 3 + 60) % 6 < 0.5) return tone(BRICK, 1);
  return tone(BRICK);
}

/** A rampart segment: a brick wall with a walkway and merlons along its outer edge. */
function paintRampart(r: Raster, sw: boolean): void {
  const Q = (v: V3): V3 => (sw ? [v[1], v[0], v[2]] : v);
  const B = (a: V3, b: V3, mat: Mat) => {
    const [p, q] = [Q(a), Q(b)];
    r.box([Math.min(p[0], q[0]), Math.min(p[1], q[1]), p[2]], [Math.max(p[0], q[0]), Math.max(p[1], q[1]), q[2]], mat);
  };
  const brick = md(BRICK, 1, { shader: brickShader });
  B([-11.3, -6, 0], [11.3, 6, 26], brick);
  B([-11.3, -6, 26], [11.3, 6, 27], m(PAL.stone, 2));
  for (const x of [-9, -1.5, 6]) B([x, -6, 27], [x + 4.5, -3.2, 33], brick);
  for (const x of [-9, -1.5, 6]) B([x, 3.2, 27], [x + 4.5, 6, 30], brick);
}

/** A bookcase backed against an interior wall: `sw` puts it on the wall along the other axis. */
function paintShelf(r: Raster, sw: boolean): void {
  const Q = (v: V3): V3 => (sw ? [v[1], v[0], v[2]] : v);
  const B = (a: V3, b: V3, mat: Mat) => r.box(Q(a), Q(b), mat);
  const wood = m(PAL.woodDark, 1);
  B([-9.5, -11, 0], [9.5, -10, 34], wood);
  B([-9.5, -11, 0], [-8.3, -4.6, 34], wood);
  B([8.3, -11, 0], [9.5, -4.6, 34], wood);
  for (const z of [0, 9, 18, 27, 33]) B([-9.5, -11, z], [9.5, -4.6, z + 1.2], m(PAL.wood, 2));
  const spines = [PAL.crimson, PAL.navy, PAL.jade, PAL.paper, PAL.brown, PAL.teal, PAL.gold];
  for (const z of [1.2, 10.2, 19.2, 28.2]) {
    let x = -8;
    let k = Math.floor(z);
    while (x < 7.6) {
      const w = 1.1 + hash2(k, 1, 3) * 0.9;
      const h = (z > 28 ? 3.6 : 5.2) + hash2(k, 2, 3) * 2.4;
      if (hash2(k, 4, 3) > 0.12) B([x, -10, z], [Math.min(8.2, x + w), -5.2 - hash2(k, 5, 3) * 1.2, z + h], m(spines[k % spines.length], 3 + (k % 4), { shader: (s, tone) => (Math.abs(s.p[2] - z - h * 0.7) < 0.5 ? tone(PAL.gold) : tone(spines[k % spines.length])) }));
      x += w + 0.25;
      k++;
    }
  }
}

/** A hanging scroll painting on an interior wall; the silk stirs in the draught. */
function paintScroll(r: Raster, sw: boolean, f: number, n: number): void {
  const Q = (v: V3): V3 => (sw ? [v[1], v[0], v[2]] : v);
  const st = Math.sin((f / n) * TAU) * 0.35;
  const silk = ramp("#f4ecd8", { lo: "#8a7a6a" });
  r.box(Q([-5, -11.2, 12]), Q([5, -10.6 + st, 36]), m(silk, 1, { shader: (s, tone) => {
    const u = sw ? s.p[1] : s.p[0];
    if (s.p[2] > 34.5 || s.p[2] < 13.5 || Math.abs(u) > 4.2) return tone(ramp("#4a7a6a", { lo: "#1a2a2a" }));
    const ridge = 20 + Math.sin(u * 0.9 + 1) * 4 + Math.sin(u * 2.3) * 1.4;
    if (s.p[2] < ridge) return tone(ramp("#6a6a7a", { lo: "#1a1a2a" }), s.p[2] < ridge - 4 ? 1 : 0);
    if (Math.abs(u + 2.6) < 0.5 && s.p[2] > 26 && s.p[2] < 32) return "#2a2030";
    if (Math.hypot(u - 2, s.p[2] - 30) < 1.2) return tone(PAL.red);
    return tone(silk);
  } }));
  for (const z of [12, 36]) r.sweep([Q([-6, -10.6, z]), Q([6, -10.6, z])], 0.7, m(PAL.woodDark, 2));
}

/** Woven straw (hats, haystacks). */
function strawShaderProp(...[s, tone]: Parameters<Shader>): string {
  return Math.sin(Math.atan2(s.p[1], s.p[0]) * 14 + s.p[2] * 0.4) > 0.6 ? tone(PAL.straw, 1) : tone(PAL.straw);
}

/** A flat horizontal slab rotated 45° to run along the screen (gate beams, awnings). */
function beamPlanes(half: number, depth: number, z0: number, z1: number) {
  const a = Math.SQRT1_2;
  return [
    { n: [a, -a, 0] as V3, d: half },
    { n: [-a, a, 0] as V3, d: half },
    { n: [a, a, 0] as V3, d: depth },
    { n: [-a, -a, 0] as V3, d: depth },
    { n: [0, 0, 1] as V3, d: z1 },
    { n: [0, 0, -1] as V3, d: -z0 },
  ];
}

export type PropId = keyof typeof PROPS;
export const PROP_IDS = Object.keys(PROPS) as PropId[];
export const propDef = (id: PropId): PropDef => PROPS[id];
/** How many times its modelled size a prop is drawn at (trees stand several times a person's height). */
export const propSize = (id: PropId): number => (PROPS[id] as PropDef).size ?? 1;

const CANVAS = 200;
const ORIGIN_X = 100;
const ORIGIN_Y = 150;
const cache = new Map<string, PropSheet>();

/**
 * Footprint box of a prop in tiles, relative to its model origin (the centre
 * of the anchor tile at size 1), as [x0, y0, x1, y1].
 */
export function footBox(id: PropId): [number, number, number, number] {
  const f = PROPS[id].foot;
  return [f[0] - 0.5, f[1] - 0.5, f[2] + 0.5, f[3] + 0.5];
}

/**
 * The tiles (inclusive [i0, j0, i1, j1]) a prop covers when its model origin
 * stands at world point (x, y) and it is drawn k times its size.
 */
export function footTiles(id: PropId, x: number, y: number, k = 1): [number, number, number, number] {
  const [b0, b1, b2, b3] = footBox(id);
  return [Math.round(x + b0 * k), Math.round(y + b1 * k), Math.round(x + b2 * k) - 1, Math.round(y + b3 * k) - 1];
}

/**
 * Where to stand a k-times prop's model origin so that its footprint is whole
 * tiles centred (as near as tiles allow) on world point (cx, cy).
 */
export function originFor(id: PropId, cx: number, cy: number, k = 1): [number, number] {
  const [b0, b1, b2, b3] = footBox(id);
  const t0 = Math.round(cx - ((b2 - b0) * k) / 2);
  const u0 = Math.round(cy - ((b3 - b1) * k) / 2);
  return [t0 - b0 * k, u0 - b1 * k];
}

/** Paint every frame of a prop (k times its placed size) and crop them all to one shared bounding box. */
export function getProp(id: PropId, k = 1): PropSheet {
  const key = k === 1 ? id : `${id}*${k}`;
  let sheet = cache.get(key);
  if (sheet) return sheet;
  const def: PropDef = PROPS[id];
  const s = k * (def.size ?? 1);
  const W = Math.ceil(CANVAS * s);
  const H = Math.ceil(CANVAS * s);
  const OX = Math.round(ORIGIN_X * s);
  const OY = Math.round(ORIGIN_Y * s);
  const raw: PixelBuffer[] = [];
  for (let f = 0; f < def.frames; f++) {
    const r = new Raster(W, H, OX, OY, WORLD_BASIS, s);
    def.paint(r, f, def.frames);
    raw.push(r.finish());
  }
  let x0 = W;
  let y0 = H;
  let x1 = 0;
  let y1 = 0;
  for (const b of raw)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (b.data[(y * W + x) * 4 + 3] > 0) {
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
  if (x1 < x0) {
    x0 = y0 = 0;
    x1 = y1 = 0;
  }
  const w = x1 - x0 + 1;
  const h = y1 - y0 + 1;
  const frames = raw.map((b) => {
    const out = new PixelBuffer(w, h);
    for (let y = 0; y < h; y++) out.data.set(b.data.subarray(((y + y0) * W + x0) * 4, ((y + y0) * W + x0 + w) * 4), y * w * 4);
    return out;
  });
  sheet = { frames, fps: def.fps, ox: OX - x0, oy: OY - y0 };
  cache.set(key, sheet);
  return sheet;
}

const miniCache = new Map<string, PropSheet>();

/** A prop rendered at a smaller scale (world-map landmarks). */
export function getPropScaled(id: PropId, k: number): PropSheet {
  const key = `${id}/${k}`;
  let sheet = miniCache.get(key);
  if (sheet) return sheet;
  const def: PropDef = PROPS[id];
  const size = 100;
  const frames: PixelBuffer[] = [];
  for (let f = 0; f < def.frames; f++) {
    const r = new Raster(size, size, size / 2, size * 0.75, WORLD_BASIS, k);
    def.paint(r, f, def.frames);
    frames.push(r.finish());
  }
  sheet = { frames, fps: def.fps, ox: size / 2, oy: size * 0.75 };
  miniCache.set(key, sheet);
  return sheet;
}

/** Soft radial glow sprite for fake lighting (cached per colour/radius). */
const glowCache = new Map<string, PixelBuffer>();
export function glowSprite(color: string, radius: number): PixelBuffer {
  const key = `${color}/${radius}`;
  let g = glowCache.get(key);
  if (!g) {
    const R = Math.ceil(radius);
    g = new PixelBuffer(R * 2 + 1, R + 1);
    for (let y = 0; y <= R; y++)
      for (let x = 0; x <= R * 2; x++) {
        const d = Math.hypot((x - R) / R, ((y - R / 2) * 2) / R);
        if (d >= 1) continue;
        const k = Math.pow(1 - d, 1.6) * 0.5;
        const q = Math.round(k * 8) / 8;
        if (q > 0) g.px(x, y, alpha(color, q));
      }
    glowCache.set(key, g);
  }
  return g;
}

export { L as LEVEL_UNITS, T as TILE_UNITS };
