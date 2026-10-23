import { PixelBuffer } from "../pixel/PixelBuffer";
import { alpha, mix, shade } from "../pixel/color";
import { fbm, hash2 } from "../pixel/noise";
import type { Surface } from "../pixel/surface";
import type { SkyId } from "../world/areas";

/**
 * Screen-space backdrops behind the isometric world: dithered gradient
 * skies, tileable parallax mountain ridges, drifting cloud puffs, a sea of
 * clouds for floating islands, stars, moons and storm lightning.
 */

interface SkyStyle {
  stops: [number, string][];
  ridges: { colour: string; rim?: string; y: number; amp: number; seed: number; speed: number }[];
  clouds?: string;
  cloudSea?: string;
  stars?: boolean;
  moon?: { colour: string; glow: string; r: number; x: number; y: number };
  lightning?: boolean;
}

const SKIES: Record<SkyId, SkyStyle> = {
  day: {
    stops: [
      [0, "#4a7ad8"],
      [0.45, "#8ab8f0"],
      [0.8, "#d8ecff"],
      [1, "#fff4e0"],
    ],
    ridges: [
      { colour: "#9ab8e0", rim: "#d8e8ff", y: 0.42, amp: 30, seed: 1, speed: 0.04 },
      { colour: "#7a9ad0", y: 0.52, amp: 22, seed: 2, speed: 0.08 },
    ],
    clouds: "#ffffff",
    cloudSea: "#f4f8ff",
  },
  dusk: {
    stops: [
      [0, "#3a2a6a"],
      [0.4, "#c05a7a"],
      [0.75, "#f0a060"],
      [1, "#ffe0a0"],
    ],
    ridges: [
      { colour: "#7a4a7a", rim: "#c87a8a", y: 0.4, amp: 34, seed: 3, speed: 0.04 },
      { colour: "#5a3a6a", y: 0.5, amp: 24, seed: 4, speed: 0.08 },
      { colour: "#3a2a4a", y: 0.6, amp: 16, seed: 5, speed: 0.14 },
    ],
    clouds: "#ffc8a0",
  },
  forest: {
    stops: [
      [0, "#0e2a26"],
      [0.5, "#1e4a3a"],
      [1, "#3a6a4a"],
    ],
    ridges: [
      { colour: "#163a30", y: 0.3, amp: 26, seed: 6, speed: 0.05 },
      { colour: "#10302a", y: 0.45, amp: 20, seed: 7, speed: 0.1 },
    ],
  },
  night: {
    stops: [
      [0, "#080820"],
      [0.5, "#16204a"],
      [1, "#2a3a6a"],
    ],
    ridges: [
      { colour: "#1a2448", rim: "#3a4a80", y: 0.45, amp: 30, seed: 8, speed: 0.04 },
      { colour: "#121a38", y: 0.55, amp: 20, seed: 9, speed: 0.09 },
    ],
    stars: true,
    moon: { colour: "#fff8e0", glow: "#c8d8ff", r: 18, x: 0.78, y: 0.16 },
  },
  blood: {
    stops: [
      [0, "#1a0410"],
      [0.5, "#5a0a1e"],
      [1, "#a8202a"],
    ],
    ridges: [
      { colour: "#3a0a18", rim: "#8a1a2a", y: 0.42, amp: 36, seed: 10, speed: 0.04 },
      { colour: "#24060e", y: 0.55, amp: 24, seed: 11, speed: 0.09 },
    ],
    stars: true,
    moon: { colour: "#ff4050", glow: "#ff2030", r: 22, x: 0.72, y: 0.18 },
  },
  storm: {
    stops: [
      [0, "#120e24"],
      [0.5, "#2a2448"],
      [1, "#5a5080"],
    ],
    ridges: [{ colour: "#2a2448", rim: "#5a5088", y: 0.6, amp: 18, seed: 12, speed: 0.06 }],
    clouds: "#4a4270",
    cloudSea: "#6a6290",
    lightning: true,
  },
  // the warm dark around a cutaway room: no horizon, just lamplight fading out
  interior: {
    stops: [
      [0, "#0c0810"],
      [0.6, "#1a1018"],
      [1, "#24161a"],
    ],
    ridges: [],
  },
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function gradientAt(stops: [number, string][], t: number): string {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++)
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  return stops[stops.length - 1][1];
}

const RIDGE_W = 512;
const ridgeCache = new Map<string, PixelBuffer>();

/** A tileable mountain silhouette (integer sine frequencies so x=0 and x=RIDGE_W match). */
function ridge(colour: string, rim: string | undefined, amp: number, seed: number): PixelBuffer {
  const key = `${colour}/${amp}/${seed}`;
  let b = ridgeCache.get(key);
  if (b) return b;
  const H = Math.ceil(amp * 2.4 + 40);
  b = new PixelBuffer(RIDGE_W, H);
  const waves = [1, 2, 3, 5, 8].map((k, i) => ({ k: k + Math.floor(hash2(i, seed, 3) * 2), ph: hash2(i, seed, 4) * 6.28, a: amp / (i + 1.2) }));
  for (let x = 0; x < RIDGE_W; x++) {
    let h = 0;
    for (const w of waves) h += w.a * Math.sin((x / RIDGE_W) * Math.PI * 2 * w.k + w.ph);
    const top = Math.round(amp * 1.2 - h);
    for (let y = Math.max(0, top); y < H; y++) {
      const shadeSide = Math.sin((x / RIDGE_W) * Math.PI * 2 * waves[2].k + waves[2].ph) > 0.2 && y - top < 24;
      b.px(x, y, shadeSide ? shade(colour, 0.88) : colour);
    }
    if (rim && top >= 0) b.px(x, top, rim);
  }
  ridgeCache.set(key, b);
  return b;
}

const puffCache = new Map<string, PixelBuffer>();
function puff(colour: string, seed: number): PixelBuffer {
  const key = `${colour}/${seed}`;
  let b = puffCache.get(key);
  if (b) return b;
  const w = 48 + Math.floor(hash2(seed, 1, 9) * 40);
  const h = 18;
  b = new PixelBuffer(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / (w / 2);
      const ny = (y - h * 0.65) / (h * 0.65);
      const n = fbm(x * 0.12, y * 0.2, seed) * 0.6;
      const d = nx * nx + ny * ny * 1.6 - n;
      if (d < 0.35) b.px(x, y, y > h * 0.62 ? shade(colour, 0.9) : d < 0.05 && ny < -0.2 ? mix(colour, "#ffffff", 0.5) : colour);
    }
  puffCache.set(key, b);
  return b;
}

/** Paint the backdrop. `camX/camY` are the world camera's screen offsets (for parallax). */
export function drawSky(s: Surface, id: SkyId, t: number, camX: number, camY: number): void {
  const st = SKIES[id];
  const W = s.width;
  const H = s.height;
  // gradient, banded + dithered at band boundaries
  const bands = 18;
  const bandH = H / bands;
  for (let b = 0; b < bands; b++) {
    const y0 = Math.floor(b * bandH);
    const y1 = Math.floor((b + 1) * bandH);
    s.rect(0, y0, W, y1 - y0, gradientAt(st.stops, b / (bands - 1)));
    if (b < bands - 1) {
      const next = gradientAt(st.stops, (b + 1) / (bands - 1));
      for (let x = 0; x < W; x += 1) if (BAYER[(x & 3) + ((y1 - 1) & 3) * 4] < 6) s.px(x, y1 - 1, next);
    }
  }
  if (st.stars) {
    for (let k = 0; k < (W * H) / 900; k++) {
      const x = Math.floor(hash2(k, 1, 77) * W);
      const y = Math.floor(hash2(k, 2, 77) * H * 0.55);
      const tw = Math.sin(t * (1 + hash2(k, 3, 77) * 3) + k) > 0.4;
      s.px(x, y, tw ? "#ffffff" : alpha("#c8d8ff", 0.6));
    }
  }
  if (st.moon) {
    const { colour, glow, r, x, y } = st.moon;
    const mx = W * x - camX * 0.02;
    const my = H * y;
    for (let k = 3; k >= 1; k--) circle(s, mx, my, r + k * 6, alpha(glow, 0.07 + (3 - k) * 0.04));
    circle(s, mx, my, r, colour);
    circle(s, mx - r * 0.3, my - r * 0.25, r * 0.28, shade(colour, 0.92));
    circle(s, mx + r * 0.35, my + r * 0.3, r * 0.18, shade(colour, 0.9));
  }
  // parallax ridges
  for (const rg of st.ridges) {
    const buf = ridge(rg.colour, rg.rim, rg.amp, rg.seed);
    const y = Math.round(H * rg.y - rg.amp * 1.2 - camY * rg.speed * 0.5);
    const off = ((((-camX * rg.speed - t * 2 * rg.speed) % RIDGE_W) + RIDGE_W) % RIDGE_W) - RIDGE_W;
    for (let x = off; x < W; x += RIDGE_W) s.sprite(buf, x, y);
    if (y + buf.height < H) s.rect(0, y + buf.height, W, H - y - buf.height, rg.colour);
  }
  if (st.clouds) {
    for (let k = 0; k < 6; k++) {
      const p = puff(st.clouds, k + 1);
      const speed = 4 + hash2(k, 5, 1) * 6;
      const span = W + p.width * 2;
      const x = ((((hash2(k, 6, 1) * span + t * speed - camX * 0.06) % span) + span) % span) - p.width;
      const y = H * (0.08 + hash2(k, 7, 1) * 0.3) - camY * 0.05;
      s.sprite(p, x, y, false, 0.85);
    }
  }
  if (st.cloudSea) {
    for (let layer = 0; layer < 3; layer++) {
      const y0 = H * (0.62 + layer * 0.1) - camY * (0.15 + layer * 0.08);
      const c = shade(st.cloudSea, 0.9 + layer * 0.05);
      for (let k = -1; k < W / 40 + 2; k++) {
        const p = puff(c, 20 + ((k + layer * 7) & 7));
        const x = k * 40 + ((t * (3 + layer * 3) - camX * (0.1 + layer * 0.1)) % 40);
        s.sprite(p, Math.round(x - 20), Math.round(y0 + Math.sin(k * 1.7 + layer) * 4));
      }
      if (y0 + 14 < H) s.rect(0, y0 + 14, W, H - y0 - 14, c);
    }
  }
  if (st.lightning) {
    const cycle = t % 7;
    if (cycle < 0.18) {
      s.rect(0, 0, W, H, alpha("#e8e0ff", 0.25 * (1 - cycle / 0.18)));
      const x0 = W * (0.2 + hash2(Math.floor(t / 7), 1, 5) * 0.6);
      let x = x0;
      for (let y = 0; y < H * 0.5; y += 3) {
        x += (hash2(y, Math.floor(t / 7), 9) - 0.5) * 6;
        s.rect(x, y, 2, 3, "#ffffff");
      }
    }
  }
}

function circle(s: Surface, cx: number, cy: number, r: number, c: string): void {
  for (let y = -Math.ceil(r); y <= Math.ceil(r); y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, (r + 0.5) * (r + 0.5) - y * y)));
    s.rect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1, c);
  }
}
