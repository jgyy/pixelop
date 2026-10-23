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

const PROPS = {
  pine: {
    foot: [0, 0, 0, 0],
    blocks: true,
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
        if (fx && Math.abs(along + 6) < 4 && s.p[2] < 17) return tone(PAL.wood);
        if (!fx && Math.abs(along - 5) < 3.5 && Math.abs(s.p[2] - 14) < 3) return Math.abs(along - 5) < 0.6 || Math.abs(s.p[2] - 14) < 0.6 ? tone(PAL.woodDark) : "#ffd890";
        return tone(WALL);
      } }));
      r.hipRoof(cx, cy, W + 7, W + 7, 24, W * 0.6, 1, 40, md(ROOF_GREY, 3, { shader: roofTiles(ROOF_GREY) }));
      r.sweep([[cx - W * 0.6, cy, 40.5], [cx + W * 0.6, cy, 40.5]], 1.2, m(PAL.black, 4));
      r.box([cx + 6, cy - 9, 30], [cx + 10, cy - 5, 44], m(PAL.stone, 5));
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
      }
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
      r.prism(0, 0, W + 6, 0, 4, 8, md(PAL.stone, 1), Math.PI / 8);
      let z = 4;
      for (let k = 0; k < 5; k++) {
        const w = W * (1 - k * 0.13);
        const hgt = 15 - k * 1.4;
        r.prism(0, 0, w * 0.72, z, z + hgt, 8, md(WALL, 2 + k, { shader: (s, tone) => (Math.abs(s.p[2] - (z + hgt * 0.55)) < 2.4 && Math.abs(Math.sin(Math.atan2(s.p[1], s.p[0]) * 4)) < 0.35 ? (k === 1 ? "#ffd890" : tone(PAL.woodDark)) : tone(PILLAR)) }), Math.PI / 8);
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
      for (const x of [cx - W + 1, cx, cx + W - 1]) r.prism(x, cy + W - 1, 1.3, 3, 22, 6, m(PILLAR, 3));
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
          { n: [0, -1, 0], d: 6.3 },
          { n: [0, 1, 0], d: -5.7 },
          { n: [-1, 0, 0], d: 8 },
          { n: [1, 0, 0], d: 8 },
          { n: [0, 0, -1], d: -12 },
          { n: [0, 0, 1], d: 22.5 },
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
} satisfies Record<string, PropDef>;

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

const CANVAS = 200;
const ORIGIN_X = 100;
const ORIGIN_Y = 150;
const cache = new Map<PropId, PropSheet>();

/** Paint every frame of a prop and crop them all to one shared bounding box. */
export function getProp(id: PropId): PropSheet {
  let sheet = cache.get(id);
  if (sheet) return sheet;
  const def: PropDef = PROPS[id];
  const raw: PixelBuffer[] = [];
  for (let f = 0; f < def.frames; f++) {
    const r = new Raster(CANVAS, CANVAS, ORIGIN_X, ORIGIN_Y, WORLD_BASIS);
    def.paint(r, f, def.frames);
    raw.push(r.finish());
  }
  let x0 = CANVAS;
  let y0 = CANVAS;
  let x1 = 0;
  let y1 = 0;
  for (const b of raw)
    for (let y = 0; y < CANVAS; y++)
      for (let x = 0; x < CANVAS; x++)
        if (b.data[(y * CANVAS + x) * 4 + 3] > 0) {
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
    for (let y = 0; y < h; y++) out.data.set(b.data.subarray(((y + y0) * CANVAS + x0) * 4, ((y + y0) * CANVAS + x0 + w) * 4), y * w * 4);
    return out;
  });
  sheet = { frames, fps: def.fps, ox: ORIGIN_X - x0, oy: ORIGIN_Y - y0 };
  cache.set(id, sheet);
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
