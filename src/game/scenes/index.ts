import { PixelBuffer } from "../pixel/PixelBuffer";
import { alpha } from "../pixel/color";
import { createRng, hashString, type Rng } from "../pixel/rng";
import { BufferSurface, sCircle, sLine, sRing, type Surface } from "../pixel/surface";
import { frameAt, getSprite } from "../sprites";
import { bamboo, blossomTree, ditherGradient, mountainRange, pagoda, pine, ridge, spikes, stoneGround, willow } from "./painters";

export const SCREEN_W = 384;
export const SCREEN_H = 216;
export const GROUND_Y = 186;
export const TILE_W = 768;

export type SceneId = "sect" | "bamboo" | "lake" | "demon" | "peak";
export const SCENE_IDS: SceneId[] = ["sect", "bamboo", "lake", "demon", "peak"];

type Fx = (s: Surface, t: number, camX: number) => void;

export interface SceneLayer {
  buffer: PixelBuffer;
  parallax: number;
}

export interface Scene {
  id: SceneId;
  name: string;
  subtitle: string;
  /** UI accent colour sampled from the scene. */
  accent: string;
  sky: PixelBuffer;
  layers: SceneLayer[];
  ground: SceneLayer;
  fx: { sky?: Fx; afterLayer?: Record<number, Fx>; ground?: Fx; front?: Fx };
}

/** Screen x for something living on a parallax plane, wrapped so it repeats forever. */
export function wrapX(worldX: number, parallax: number, camX: number, span = SCREEN_W + 64): number {
  const x = worldX - camX * parallax;
  return (((x % span) + span) % span) - 32;
}

function drawLayer(s: Surface, l: SceneLayer, camX: number): void {
  const off = -(((camX * l.parallax) % TILE_W) + TILE_W) % TILE_W;
  s.sprite(l.buffer, Math.round(off), 0);
  if (off + TILE_W < s.width) s.sprite(l.buffer, Math.round(off + TILE_W), 0);
}

export function drawBackground(scene: Scene, s: Surface, t: number, camX: number): void {
  s.sprite(scene.sky, 0, 0);
  scene.fx.sky?.(s, t, camX);
  scene.layers.forEach((l, i) => {
    drawLayer(s, l, camX);
    scene.fx.afterLayer?.[i]?.(s, t, camX);
  });
  drawLayer(s, scene.ground, camX);
  scene.fx.ground?.(s, t, camX);
}

export function drawForeground(scene: Scene, s: Surface, t: number, camX: number): void {
  scene.fx.front?.(s, t, camX);
}

const newLayer = (h = SCREEN_H) => new PixelBuffer(TILE_W, h);

// ---------------------------------------------------------------------------
// Particle helpers — every effect is a pure function of time, so scenes can be
// rendered live, exported as GIFs, or snapshot-tested without particle state.
// ---------------------------------------------------------------------------
interface Seeded {
  x: number;
  y: number;
  speed: number;
  phase: number;
  size: number;
}
function seeds(rng: Rng, n: number): Seeded[] {
  return Array.from({ length: n }, () => ({ x: rng() * (SCREEN_W + 64), y: rng() * SCREEN_H, speed: 0.5 + rng(), phase: rng() * Math.PI * 2, size: rng() }));
}

/** Falling things (petals, leaves, ash) drifting with a sway. */
function fallers(list: Seeded[], s: Surface, t: number, camX: number, opts: { colours: string[]; vy: number; vx: number; par: number; sway: number; leaf?: boolean }) {
  list.forEach((p, i) => {
    const y = ((p.y + t * opts.vy * p.speed) % (SCREEN_H + 20)) - 10;
    const x = wrapX(p.x + t * opts.vx * p.speed + Math.sin(t * 1.3 + p.phase) * opts.sway, opts.par, camX);
    const c = opts.colours[i % opts.colours.length];
    s.px(x, y, c);
    if (opts.leaf) {
      const flip = Math.sin(t * 3 + p.phase) > 0;
      s.px(x + (flip ? 1 : -1), y + (flip ? 0 : 1), c);
    } else if (p.size > 0.6) s.px(x + 1, y, c);
  });
}

/** Rising things (embers, lanterns' sparks, qi motes). */
function risers(list: Seeded[], s: Surface, t: number, camX: number, opts: { colours: string[]; vy: number; par: number; sway: number; blink?: boolean }) {
  list.forEach((p, i) => {
    const y = SCREEN_H + 10 - ((p.y + t * opts.vy * p.speed) % (SCREEN_H + 20));
    const x = wrapX(p.x + Math.sin(t * 0.9 + p.phase) * opts.sway, opts.par, camX);
    if (opts.blink && Math.sin(t * 3 + p.phase * 3) < -0.3) return;
    const c = opts.colours[i % opts.colours.length];
    s.px(x, y, c);
    if (p.size > 0.75) {
      s.px(x + 1, y, alpha(c, 0.5));
      s.px(x - 1, y, alpha(c, 0.5));
      s.px(x, y - 1, alpha(c, 0.5));
      s.px(x, y + 1, alpha(c, 0.5));
    }
  });
}

function cloudBlob(s: Surface, x: number, y: number, w: number, c: string, hi: string) {
  sCircle(s, x, y, w * 0.28, c);
  sCircle(s, x + w * 0.25, y - w * 0.12, w * 0.3, c);
  sCircle(s, x + w * 0.55, y, w * 0.24, c);
  s.rect(x - w * 0.1, y, w * 0.8, w * 0.22, c);
  sCircle(s, x + w * 0.22, y - w * 0.22, w * 0.12, hi);
}

// ---------------------------------------------------------------------------
// 1. Azure Cloud Sect — dawn over floating peaks
// ---------------------------------------------------------------------------
function buildSect(): Scene {
  const rng = createRng(hashString("sect"));
  const sky = new PixelBuffer(SCREEN_W, SCREEN_H);
  ditherGradient(sky, [
    [0, "#4b62b5"],
    [0.45, "#93a9e3"],
    [0.75, "#f2c0c8"],
    [1, "#ffd9a8"],
  ]);
  // sun with halo rings
  sky.circle(300, 92, 30, alpha("#fff4d0", 0.18));
  sky.circle(300, 92, 22, alpha("#fff4d0", 0.3));
  sky.circle(300, 92, 15, "#fff6dc");

  const far = newLayer();
  const h1 = ridge(TILE_W, rng, 120, [14, 9, 5]);
  mountainRange(far, h1, "#a9b3e0", { rim: "#d0d6f4", snow: "#eef0ff", snowLine: 112 });
  // floating islands with dangling roots
  const islands: number[] = [];
  for (let i = 0; i < 4; i++) {
    const x = 60 + i * 190 + rng() * 40;
    const y = 50 + rng() * 25;
    islands.push(x);
    far.polygon([[x - 22, y], [x + 22, y], [x + 4, y + 18], [x - 6, y + 14]], "#97a1d2");
    far.ellipse(x, y - 1, 22, 3, "#b9e0c0");
    pagoda(far, x, y - 1, 2 + (i % 2), { wall: "#c98b8b", roof: "#55608e", window: "#ffe9a8" }, 0.7);
  }
  const mid = newLayer();
  const h2 = ridge(TILE_W, rng, 150, [16, 8, 4, 2]);
  mountainRange(mid, h2, "#6f86b8", { rim: "#9fb2dc", shadeSide: "#61759f" });
  const pagodaXs = [90, 330, 560, 700];
  pagodaXs.forEach((x, i) => pagoda(mid, x, Math.round(h2(x)) + 2, 3 + (i % 3), { wall: "#d8a0a0", roof: "#3a4776", trim: "#f2c55c", window: "#ffe9a8" }));
  // rope bridge between two peaks
  for (let x = 330; x <= 560; x++) {
    const k = (x - 330) / 230;
    const y = Math.round(h2(330) - 8 + (h2(560) - h2(330)) * k + Math.sin(k * Math.PI) * 14);
    mid.px(x, y, "#4a3a3a");
    if (x % 6 === 0) mid.vline(x, y - 4, y, "#4a3a3a");
  }
  // mist band
  for (let y = 160; y < 186; y++) for (let x = 0; x < TILE_W; x++) if ((x + y * 3) % 4 === 0 || y > 172) mid.px(x, y, alpha("#ffffff", 0.18 + (y - 160) * 0.012));

  const near = newLayer();
  const h3 = ridge(TILE_W, rng, 168, [10, 5]);
  mountainRange(near, h3, "#3d5a6e", { rim: "#5d8a8e" });
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 128 + rng() * 40;
    if (i % 2) blossomTree(near, x, Math.round(h3(x)) + 4, 46, rng, { trunk: "#4a2a2a", bloom: "#f6b3cf", bloomHi: "#ffe4f0", bloomShade: "#d987ad" });
    else pine(near, x, Math.round(h3(x)) + 4, 40, rng, { trunk: "#3a2a28", leaf: "#2f6050", leafHi: "#4f8a70" });
  }

  const ground = newLayer();
  stoneGround(ground, GROUND_Y, { top: "#7fbf7a", stone: "#a3a7bd", stoneHi: "#c9cce0", mortar: "#6e7290", soil: "#4a4458" }, rng);
  // jade railing posts
  for (let x = 8; x < TILE_W; x += 48) {
    ground.rect(x, GROUND_Y - 10, 3, 10, "#cfd8e8");
    ground.px(x + 1, GROUND_Y - 11, "#3fb59a");
  }
  for (let x = 0; x < TILE_W; x++) ground.px(x, GROUND_Y - 7, "#cfd8e8");

  const petals = seeds(rng, 60);
  const frontPetals = seeds(rng, 16);
  const clouds = Array.from({ length: 6 }, () => ({ x: rng() * TILE_W, y: 20 + rng() * 60, w: 30 + rng() * 40 }));
  return {
    id: "sect",
    name: "Azure Cloud Sect",
    subtitle: "Dawn over the floating peaks",
    accent: "#3fb59a",
    sky,
    layers: [
      { buffer: far, parallax: 0.12 },
      { buffer: mid, parallax: 0.3 },
      { buffer: near, parallax: 0.6 },
    ],
    ground: { buffer: ground, parallax: 1 },
    fx: {
      sky: (s, t, cam) => {
        // sun shimmer
        const r = 17 + Math.sin(t * 1.5) * 1.5;
        sRing(s, 300, 92, r + 6, alpha("#fff4d0", 0.35));
        clouds.forEach((c) => {
          const x = ((((c.x + t * 4 - cam * 0.08) % (SCREEN_W + 120)) + SCREEN_W + 120) % (SCREEN_W + 120)) - 80;
          cloudBlob(s, x, c.y, c.w, alpha("#ffffff", 0.75), "#ffffff");
        });
      },
      afterLayer: {
        0: (s, t, cam) => {
          // waterfalls pouring from the floating islands
          islands.forEach((ix) => {
            const x = Math.round(ix - cam * 0.12) % TILE_W;
            for (const off of [0, TILE_W]) {
              const sx = x + off;
              if (sx < -4 || sx > SCREEN_W + 4) continue;
              for (let y = 60; y < 130; y++) {
                const v = (y + Math.floor(t * 30)) % 6;
                s.px(sx, y, v < 3 ? "#e8f4ff" : "#a8c8f0");
                if (v === 0) s.px(sx + 1, y, alpha("#ffffff", 0.6));
              }
            }
          });
        },
        1: (s, t, cam) => {
          // cranes gliding between peaks
          const crane = getSprite("crane").animations.fly;
          for (let i = 0; i < 3; i++) {
            const x = wrapX(i * 140 + t * (14 + i * 3), 0.35, cam, SCREEN_W + 120);
            const y = 60 + i * 18 + Math.sin(t * 0.8 + i) * 6;
            s.sprite(frameAt(crane, t + i * 0.3), x, y, true);
          }
        },
      },
      ground: (s, t, cam) => fallers(petals, s, t, cam, { colours: ["#f6b3cf", "#ffe4f0", "#d987ad"], vy: 14, vx: -8, par: 0.8, sway: 10, leaf: true }),
      front: (s, t, cam) => fallers(frontPetals, s, t, cam, { colours: ["#ffc6dc", "#ffffff"], vy: 22, vx: -14, par: 1.3, sway: 14, leaf: true }),
    },
  };
}

// ---------------------------------------------------------------------------
// 2. Whispering Bamboo Forest — god rays, fireflies, falling leaves
// ---------------------------------------------------------------------------
function buildBamboo(): Scene {
  const rng = createRng(hashString("bamboo"));
  const sky = new PixelBuffer(SCREEN_W, SCREEN_H);
  ditherGradient(sky, [
    [0, "#d5ecb0"],
    [0.6, "#a6d394"],
    [1, "#6aa86a"],
  ]);
  const mk = (n: number, w: [number, number], c: { stalk: string; hi: string; node: string; leaf: string }) => {
    const b = newLayer();
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rng() * (TILE_W - 8));
      bamboo(b, x, w[0] + Math.floor(rng() * (w[1] - w[0] + 1)), -10, GROUND_Y + 4, rng, c);
    }
    return b;
  };
  const far = mk(70, [2, 3], { stalk: "#b9dca0", hi: "#d4ecc0", node: "#9cc488", leaf: "#a8d090" });
  const mid = mk(38, [3, 4], { stalk: "#76b062", hi: "#a2d08a", node: "#4f8a44", leaf: "#5e9e4e" });
  const near = mk(16, [5, 7], { stalk: "#3d7a3e", hi: "#5f9e58", node: "#24502a", leaf: "#2e6a34" });
  // canopy overhang on near layer
  for (let x = 0; x < TILE_W; x += 3) near.ellipse(x, 4 + Math.sin(x * 0.07) * 6, 6, 5, x % 2 ? "#2e6a34" : "#3d7a3e");
  const ground = newLayer();
  stoneGround(ground, GROUND_Y, { top: "#5aa04a", stone: "#8a7a5a", stoneHi: "#a8986e", mortar: "#5a4a34", soil: "#3e3424" }, rng);
  for (let x = 0; x < TILE_W; x += 2) if (rng() < 0.6) ground.vline(x, GROUND_Y - 1 - Math.floor(rng() * 4), GROUND_Y, rng() < 0.5 ? "#5aa04a" : "#7cc062");
  const leaves = seeds(rng, 34);
  const motes = seeds(rng, 40);
  return {
    id: "bamboo",
    name: "Whispering Bamboo Forest",
    subtitle: "Where fox spirits play tricks",
    accent: "#76b062",
    sky,
    layers: [
      { buffer: far, parallax: 0.15 },
      { buffer: mid, parallax: 0.4 },
      { buffer: near, parallax: 0.75 },
    ],
    ground: { buffer: ground, parallax: 1 },
    fx: {
      afterLayer: {
        0: (s, t) => {
          // slanted god rays that slowly breathe
          for (let r = 0; r < 5; r++) {
            const x0 = 30 + r * 80 + Math.sin(t * 0.3 + r) * 6;
            const a = 0.08 + 0.05 * Math.sin(t * 0.8 + r * 1.7);
            for (let y = 0; y < GROUND_Y; y += 1) s.rect(x0 + y * 0.35, y, 10 + r * 2, 1, alpha("#fffbe0", a));
          }
        },
        1: (s, t, cam) => risers(motes, s, t, cam, { colours: ["#f4ff9a", "#c8ff8a", "#ffffff"], vy: 6, par: 0.5, sway: 12, blink: true }),
      },
      ground: (s, t, cam) => fallers(leaves, s, t, cam, { colours: ["#8ac860", "#c0e080", "#5e9e4e"], vy: 12, vx: -6, par: 0.9, sway: 12, leaf: true }),
      front: (s, t, cam) => {
        // butterflies
        for (let i = 0; i < 3; i++) {
          const x = wrapX(i * 130 + t * 10, 1.1, cam);
          const y = 140 + Math.sin(t * 1.7 + i * 2) * 18;
          const up = Math.sin(t * 14 + i) > 0;
          const c = ["#ffd23a", "#9fe6ff", "#ffffff"][i];
          s.px(x, y, "#2a2a2a");
          s.px(x - 1, y - (up ? 1 : 0), c);
          s.px(x + 1, y - (up ? 1 : 0), c);
          if (up) {
            s.px(x - 2, y - 2, c);
            s.px(x + 2, y - 2, c);
          }
        }
      },
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Moonlit Lotus Lake — stars, moon reflection, rising sky lanterns
// ---------------------------------------------------------------------------
function buildLake(): Scene {
  const rng = createRng(hashString("lake"));
  const sky = new PixelBuffer(SCREEN_W, SCREEN_H);
  ditherGradient(sky, [
    [0, "#070a24"],
    [0.55, "#1d2050"],
    [0.8, "#3a2f66"],
    [1, "#5a3f78"],
  ]);
  // moon with craters & halo
  sky.circle(96, 54, 34, alpha("#c8d0ff", 0.08));
  sky.circle(96, 54, 26, alpha("#c8d0ff", 0.14));
  sky.circle(96, 54, 19, "#f4f1dc");
  sky.circle(90, 50, 4, "#e0dcc4");
  sky.circle(102, 60, 3, "#e0dcc4");
  sky.circle(99, 46, 2, "#e0dcc4");
  const stars = Array.from({ length: 90 }, () => ({ x: Math.floor(rng() * SCREEN_W), y: Math.floor(rng() * 120), p: rng() * 6.28, big: rng() > 0.85 }));
  const far = newLayer();
  const h1 = ridge(TILE_W, rng, 132, [12, 7, 3]);
  mountainRange(far, h1, "#1c1f48", { rim: "#2e3266", bottom: 160 });
  pagoda(far, 520, Math.round(h1(520)) + 2, 5, { wall: "#2a2a58", roof: "#14163a", window: "#ffd27a" });
  const mid = newLayer();
  for (let i = 0; i < 5; i++) {
    const x = 70 + i * 150 + rng() * 30;
    willow(mid, x, 162, 34 + rng() * 10, rng, { trunk: "#121430", leaf: "#1d3a44" });
  }
  // lakeside pavilion
  mid.rect(300, 140, 40, 3, "#2a1a30");
  for (const x of [302, 336]) mid.rect(x, 128, 2, 20, "#3a2030");
  mid.polygon([[292, 129], [348, 129], [338, 120], [302, 120]], "#151530");
  mid.px(291, 128, "#151530");
  mid.px(348, 128, "#151530");
  mid.rect(318, 132, 4, 5, "#ffcf7a");
  const ground = newLayer();
  // wooden boardwalk over water
  ground.rect(0, GROUND_Y, TILE_W, SCREEN_H - GROUND_Y, "#2a1e28");
  for (let x = 0; x < TILE_W; x += 7) {
    ground.rect(x, GROUND_Y, 6, 5, "#7a5a48");
    ground.hline(x, x + 5, GROUND_Y, "#9a7a5e");
  }
  ground.rect(0, GROUND_Y + 5, TILE_W, 1, "#1a1018");
  for (let x = 10; x < TILE_W; x += 40) ground.rect(x, GROUND_Y + 6, 3, SCREEN_H - GROUND_Y, "#4a3438");
  for (let x = 4; x < TILE_W; x += 64) {
    ground.rect(x, GROUND_Y - 14, 2, 14, "#5a3a38");
    ground.rect(x - 2, GROUND_Y - 20, 6, 6, "#e0403a");
    ground.rect(x - 1, GROUND_Y - 18, 4, 2, "#ffd27a");
  }
  const lanterns = seeds(rng, 9);
  const flies = seeds(rng, 26);
  const lotusXs = Array.from({ length: 6 }, (_, i) => ({ x: i * 70 + rng() * 30, y: 166 + rng() * 12, ph: rng() * 2 }));
  return {
    id: "lake",
    name: "Moonlit Lotus Lake",
    subtitle: "Lanterns rise to the jade moon",
    accent: "#9fb4ff",
    sky,
    layers: [
      { buffer: far, parallax: 0.1 },
      { buffer: mid, parallax: 0.35 },
    ],
    ground: { buffer: ground, parallax: 1 },
    fx: {
      sky: (s, t) => {
        stars.forEach((st) => {
          const tw = Math.sin(t * 2 + st.p);
          if (tw < -0.6) return;
          s.px(st.x, st.y, tw > 0.6 ? "#ffffff" : "#aab4ff");
          if (st.big && tw > 0.3) {
            s.px(st.x + 1, st.y, alpha("#ffffff", 0.5));
            s.px(st.x - 1, st.y, alpha("#ffffff", 0.5));
            s.px(st.x, st.y - 1, alpha("#ffffff", 0.5));
            s.px(st.x, st.y + 1, alpha("#ffffff", 0.5));
          }
        });
        // shooting star every ~7s
        const cyc = t % 7;
        if (cyc < 0.8) {
          const k = cyc / 0.8;
          const x = 380 - k * 160;
          const y = 10 + k * 50;
          sLine(s, x, y, x + 10, y - 3, alpha("#ffffff", 1 - k));
        }
      },
      afterLayer: {
        1: (s, t, cam) => {
          // water body with moon reflection
          for (let y = 160; y < GROUND_Y; y++) s.rect(0, y, SCREEN_W, 1, y % 3 === 0 ? "#22285a" : "#1a1f4a");
          for (let y = 162; y < GROUND_Y; y += 2) {
            const w = 14 - (y - 160) * 0.3 + Math.sin(t * 3 + y) * 3;
            const x = 96 + Math.sin(t * 2 + y * 0.6) * 2 - cam * 0.02;
            s.rect(x - w / 2, y, w, 1, alpha("#f4f1dc", 0.65));
          }
          for (let i = 0; i < 20; i++) {
            const x = wrapX(i * 23, 0.5, cam);
            const y = 164 + ((i * 7) % 20);
            if (Math.sin(t * 2 + i) > 0.2) s.rect(x, y, 4, 1, alpha("#8a9aff", 0.5));
          }
          const lotus = getSprite("lotus").animations.bloom;
          lotusXs.forEach((l) => s.sprite(frameAt(lotus, t * 0.5 + l.ph), wrapX(l.x, 0.6, cam), l.y + Math.round(Math.sin(t + l.ph))));
          // lanterns rising into the night
          const lant = getSprite("lantern").animations.idle;
          lanterns.forEach((p) => {
            const y = SCREEN_H - ((p.y + t * 8 * p.speed) % (SCREEN_H + 30));
            const x = wrapX(p.x + Math.sin(t * 0.5 + p.phase) * 8, 0.45, cam);
            s.sprite(frameAt(lant, t + p.phase), x, y, false, 0.55 + 0.45 * (y / SCREEN_H));
          });
        },
      },
      front: (s, t, cam) => risers(flies, s, t, cam, { colours: ["#d6ff8a", "#ffef9a"], vy: 3, par: 1.1, sway: 16, blink: true }),
    },
  };
}

// ---------------------------------------------------------------------------
// 4. Crimson Demon Valley — blood moon, lava fissures, embers & ash
// ---------------------------------------------------------------------------
function buildDemon(): Scene {
  const rng = createRng(hashString("demon"));
  const sky = new PixelBuffer(SCREEN_W, SCREEN_H);
  ditherGradient(sky, [
    [0, "#14030a"],
    [0.5, "#4a0a18"],
    [0.85, "#a02218"],
    [1, "#e0582a"],
  ]);
  sky.circle(270, 62, 40, alpha("#ff3030", 0.1));
  sky.circle(270, 62, 30, "#c8202a");
  sky.circle(264, 56, 26, "#e83a3a");
  sky.hline(240, 300, 66, "#8a1020");
  sky.hline(244, 296, 70, "#8a1020");
  const far = newLayer();
  for (let i = 0; i < 26; i++) spikes(far, rng() * TILE_W, 150, 50 + rng() * 60, 14 + rng() * 16, "#2a0812", rng() < 0.4 ? "#ff4a2a" : undefined);
  far.rect(0, 148, TILE_W, SCREEN_H - 148, "#2a0812");
  const mid = newLayer();
  const h2 = ridge(TILE_W, rng, 160, [10, 6]);
  mountainRange(mid, h2, "#18050c", { rim: "#4a1018" });
  // ruined demonic temple
  for (const tx of [150, 520]) {
    const base = Math.round(h2(tx));
    pagoda(mid, tx, base + 2, 3, { wall: "#3a0a14", roof: "#0c0206", trim: "#c8203a", window: "#ff4a2a" }, 1.1);
    for (let k = -1; k <= 1; k += 2) {
      mid.rect(tx + k * 22, base - 30, 3, 32, "#2a0810");
      for (let y = base - 28; y < base; y += 3) mid.px(tx + k * 22 + 1 + (y % 2), y, "#5a5a6a");
    }
  }
  const near = newLayer();
  for (let i = 0; i < 9; i++) {
    const x = rng() * TILE_W;
    // dead trees
    near.thickLine(x, GROUND_Y + 2, x + 3, GROUND_Y - 40, 3, "#0e0306");
    near.line(x + 2, GROUND_Y - 26, x - 10, GROUND_Y - 40, "#0e0306");
    near.line(x + 3, GROUND_Y - 34, x + 14, GROUND_Y - 46, "#0e0306");
    // bones
    near.hline(x + 16, x + 22, GROUND_Y - 1, "#d8d0c0");
    near.px(x + 15, GROUND_Y - 2, "#d8d0c0");
    near.px(x + 23, GROUND_Y - 2, "#d8d0c0");
  }
  const ground = newLayer();
  ground.rect(0, GROUND_Y, TILE_W, SCREEN_H - GROUND_Y, "#1a0a10");
  ground.hline(0, TILE_W, GROUND_Y, "#3a1420");
  const cracks: { x: number; y: number; len: number }[] = [];
  for (let i = 0; i < 18; i++) cracks.push({ x: rng() * TILE_W, y: GROUND_Y + 4 + rng() * 22, len: 10 + rng() * 26 });
  for (let x = 0; x < TILE_W; x += 5) ground.rect(x, GROUND_Y + 1 + (x % 3), 4, 2, "#2a1018");
  const embers = seeds(rng, 50);
  const ash = seeds(rng, 30);
  return {
    id: "demon",
    name: "Crimson Demon Valley",
    subtitle: "Lair of the Blood Moon Sect",
    accent: "#e83a3a",
    sky,
    layers: [
      { buffer: far, parallax: 0.15 },
      { buffer: mid, parallax: 0.35 },
      { buffer: near, parallax: 0.65 },
    ],
    ground: { buffer: ground, parallax: 1 },
    fx: {
      sky: (s, t) => {
        // blood moon pulse
        sRing(s, 270, 62, 33 + Math.sin(t * 2) * 2, alpha("#ff5040", 0.4));
        // bats
        for (let i = 0; i < 4; i++) {
          const x = ((i * 97 + t * (20 + i * 4)) % (SCREEN_W + 40)) - 20;
          const y = 40 + i * 14 + Math.sin(t * 2 + i) * 8;
          const up = Math.sin(t * 12 + i) > 0;
          s.px(x, y, "#000000");
          s.px(x - 1, y + (up ? -1 : 1), "#000000");
          s.px(x + 1, y + (up ? -1 : 1), "#000000");
          s.px(x - 2, y + (up ? -2 : 1), "#000000");
          s.px(x + 2, y + (up ? -2 : 1), "#000000");
        }
      },
      afterLayer: { 0: (s, t, cam) => risers(embers, s, t, cam, { colours: ["#ff8a2a", "#ffcf4a", "#ff4a2a"], vy: 18, par: 0.4, sway: 6 }) },
      ground: (s, t, cam) => {
        // glowing lava fissures
        const glow = 0.6 + 0.4 * Math.sin(t * 2.5);
        cracks.forEach((c, i) => {
          const x = Math.round(c.x - cam) % TILE_W;
          for (const off of [0, TILE_W]) {
            const sx = (x + off + TILE_W) % (TILE_W * 2) - TILE_W;
            if (sx > SCREEN_W || sx + c.len < 0) continue;
            for (let k = 0; k < c.len; k++) {
              const y = c.y + Math.round(Math.sin(k * 0.4 + i) * 1.5);
              s.px(sx + k, y, alpha("#ff5a1a", glow));
              if (k % 3 === 0) s.px(sx + k, y - 1, alpha("#ffcf4a", glow * 0.8));
            }
          }
        });
      },
      front: (s, t, cam) => fallers(ash, s, t, cam, { colours: ["#8a8090", "#b0a8b8"], vy: 10, vx: 5, par: 1.2, sway: 6 }),
    },
  };
}

// ---------------------------------------------------------------------------
// 5. Heavenly Tribulation Peak — storm vortex, rain, lightning
// ---------------------------------------------------------------------------
function buildPeak(): Scene {
  const rng = createRng(hashString("peak"));
  const sky = new PixelBuffer(SCREEN_W, SCREEN_H);
  ditherGradient(sky, [
    [0, "#0a0718"],
    [0.6, "#24183f"],
    [1, "#3e2a5e"],
  ]);
  // heavy tribulation cloud bank
  for (let i = 0; i < 46; i++) {
    const x = rng() * SCREEN_W;
    const y = rng() * 46;
    sky.ellipse(x, y + 2, 14 + rng() * 16, 5 + rng() * 4, "#1c1434");
    sky.ellipse(x, y, 12 + rng() * 14, 4 + rng() * 3, i % 3 ? "#2c2250" : "#3a2e66");
  }
  const far = newLayer();
  const h1 = ridge(TILE_W, rng, 140, [20, 8, 4]);
  mountainRange(far, h1, "#1a1530", { rim: "#3a3060", snow: "#8a84b0", snowLine: 130 });
  const mid = newLayer();
  const h2 = ridge(TILE_W, rng, 170, [8, 4]);
  mountainRange(mid, h2, "#120e22", { rim: "#2e2650" });
  // altar pillars
  const ground = newLayer();
  stoneGround(ground, GROUND_Y, { top: "#6a6488", stone: "#4e4868", stoneHi: "#6a6488", mortar: "#2a2440", soil: "#1e1a30" }, rng);
  for (let x = 30; x < TILE_W; x += 120) {
    ground.rect(x, GROUND_Y - 34, 6, 34, "#5a5478");
    ground.vline(x, GROUND_Y - 34, GROUND_Y, "#7a74a0");
    ground.rect(x - 2, GROUND_Y - 37, 10, 3, "#7a74a0");
    ground.rect(x + 1, GROUND_Y - 30, 4, 8, "#c8a040");
    ground.px(x + 2, GROUND_Y - 28, "#2a1a10");
  }
  // bagua circle engraved in the ground
  for (let k = 0; k < 2; k++) {
    const cx = 200 + k * 384;
    for (let a = 0; a < 64; a++) {
      const ang = (a / 64) * Math.PI * 2;
      ground.px(cx + Math.cos(ang) * 30, GROUND_Y + 14 + Math.sin(ang) * 6, "#8a84c0");
    }
  }
  const rain = seeds(rng, 90);
  return {
    id: "peak",
    name: "Heavenly Tribulation Peak",
    subtitle: "Where heaven tests the worthy",
    accent: "#b8a4ff",
    sky,
    layers: [
      { buffer: far, parallax: 0.12 },
      { buffer: mid, parallax: 0.4 },
    ],
    ground: { buffer: ground, parallax: 1 },
    fx: {
      sky: (s, t) => {
        // rotating tribulation cloud vortex
        const cx = SCREEN_W / 2;
        const cy = 30;
        for (let arm = 0; arm < 5; arm++)
          for (let i = 0; i < 150; i++) {
            const r = i * 0.85;
            const a = arm * ((Math.PI * 2) / 5) + i * 0.045 + t * 0.4;
            const x = cx + Math.cos(a) * r * 1.7;
            const y = cy + Math.sin(a) * r * 0.42;
            const c = i % 9 < 3 ? "#6a5aa0" : i % 9 < 6 ? "#4a3c7a" : "#2e2452";
            s.rect(x, y, 4, 3, alpha(c, 0.8));
          }
        sCircle(s, cx, cy, 6 + Math.sin(t * 4) * 1.5, alpha("#e8dcff", 0.6));
      },
      front: (s, t, cam) => {
        rain.forEach((p) => {
          const y = ((p.y + t * 220 * p.speed) % (SCREEN_H + 20)) - 10;
          const x = wrapX(p.x - y * 0.25, 1.2, cam);
          sLine(s, x, y, x - 1, y + 4, alpha("#9aa4ff", 0.55));
        });
        // lightning every ~3.5s with screen flash
        const cyc = t % 3.5;
        if (cyc < 0.35) {
          const bolt = createRng(Math.floor(t / 3.5) + 7);
          let x = 80 + bolt() * 220;
          let y = 30;
          const a = cyc < 0.12 ? 1 : 0.5;
          while (y < GROUND_Y) {
            const nx = x + (bolt() - 0.5) * 18;
            const ny = y + 6 + bolt() * 10;
            sLine(s, x, y, nx, ny, alpha("#ffffff", a));
            sLine(s, x + 1, y, nx + 1, ny, alpha("#b8a4ff", a * 0.7));
            if (bolt() < 0.2) sLine(s, nx, ny, nx + (bolt() - 0.5) * 30, ny + 12, alpha("#b8a4ff", a * 0.6));
            x = nx;
            y = ny;
          }
          if (cyc < 0.08) s.rect(0, 0, SCREEN_W, SCREEN_H, alpha("#e8e0ff", 0.35));
        }
      },
    },
  };
}

const BUILDERS: Record<SceneId, () => Scene> = { sect: buildSect, bamboo: buildBamboo, lake: buildLake, demon: buildDemon, peak: buildPeak };
const cache = new Map<SceneId, Scene>();

export function getScene(id: SceneId): Scene {
  let s = cache.get(id);
  if (!s) {
    s = BUILDERS[id]();
    cache.set(id, s);
  }
  return s;
}

/** Render a full frame of a scene (without characters) into a software buffer. */
export function renderSceneFrame(id: SceneId, t: number, camX = 0): PixelBuffer {
  const buf = new PixelBuffer(SCREEN_W, SCREEN_H);
  const surf = new BufferSurface(buf);
  const scene = getScene(id);
  drawBackground(scene, surf, t, camX);
  drawForeground(scene, surf, t, camX);
  return buf;
}
