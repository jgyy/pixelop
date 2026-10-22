import { PixelBuffer, type Point } from "../pixel/PixelBuffer";
import { mix, shade } from "../pixel/color";
import type { Rng } from "../pixel/rng";

/** Shared painting helpers for the parallax backgrounds. */

const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

export const bayer = (x: number, y: number) => BAYER4[((y % 4) + 4) % 4][((x % 4) + 4) % 4] / 16;

/** Colour at position t through a list of [t, colour] stops. */
export function gradientAt(stops: [number, string][], t: number): string {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1];
      const [t1, c1] = stops[i];
      return mix(c0, c1, (t - t0) / (t1 - t0));
    }
  }
  return stops[stops.length - 1][1];
}

/** Vertical banded + Bayer-dithered gradient, the classic pixel-art sky. */
export function ditherGradient(b: PixelBuffer, stops: [number, string][], y0 = 0, y1 = b.height, bands = 14): void {
  const colours = Array.from({ length: bands }, (_, i) => gradientAt(stops, i / (bands - 1)));
  for (let y = y0; y < y1; y++) {
    const v = ((y - y0) / Math.max(1, y1 - y0 - 1)) * (bands - 1);
    const base = Math.floor(v);
    const frac = v - base;
    for (let x = 0; x < b.width; x++) {
      const band = frac > bayer(x, y) ? Math.min(bands - 1, base + 1) : base;
      b.px(x, y, colours[band]);
    }
  }
}

/** Tileable ridge-line heights (integer frequencies so x=0 and x=width match). */
export function ridge(width: number, rng: Rng, base: number, amps: number[]): (x: number) => number {
  const waves = amps.map((amp, i) => ({ amp, k: i + 1 + Math.floor(rng() * (i + 2)), ph: rng() * Math.PI * 2 }));
  return (x: number) => base + waves.reduce((acc, w) => acc + w.amp * Math.sin((Math.PI * 2 * w.k * x) / width + w.ph), 0);
}

/** Fill everything below a ridge function, with a lighter rim on top. */
export function mountainRange(
  b: PixelBuffer,
  h: (x: number) => number,
  colour: string,
  opts: { rim?: string; bottom?: number; snow?: string; snowLine?: number; shadeSide?: string } = {},
): void {
  const bottom = opts.bottom ?? b.height;
  for (let x = 0; x < b.width; x++) {
    const top = Math.round(h(x));
    const slope = h(x + 1) - h(x - 1);
    for (let y = Math.max(0, top); y < bottom; y++) {
      let c = colour;
      if (opts.shadeSide && slope > 0.3 && y < top + 30) c = opts.shadeSide;
      if (opts.snow && opts.snowLine !== undefined && top < opts.snowLine && y < top + 3 + bayer(x, y) * 3) c = opts.snow;
      b.px(x, y, c);
    }
    if (opts.rim) b.px(x, top, opts.rim);
  }
}

/** Multi-tier pagoda silhouette / building. */
export function pagoda(
  b: PixelBuffer,
  cx: number,
  baseY: number,
  tiers: number,
  c: { wall: string; roof: string; trim?: string; window?: string },
  scale = 1,
): void {
  let y = baseY;
  for (let i = 0; i < tiers; i++) {
    const w = Math.round((14 - i * 2.4) * scale);
    const h = Math.round(6 * scale);
    b.rect(cx - Math.floor(w / 2), y - h, w, h, c.wall);
    if (c.window) {
      for (let k = -1; k <= 1; k++) b.px(cx + k * Math.max(2, Math.round(w / 4)), y - Math.ceil(h / 2), c.window);
    }
    y -= h;
    const rw = w + Math.round(6 * scale);
    b.polygon(
      [
        [cx - rw / 2 - 1, y + 1],
        [cx + rw / 2 + 1, y + 1],
        [cx + rw / 2 - 2 * scale, y - 2 * scale],
        [cx - rw / 2 + 2 * scale, y - 2 * scale],
      ],
      c.roof,
    );
    b.px(cx - rw / 2 - 2, y, c.roof);
    b.px(cx + rw / 2 + 1, y, c.roof);
    if (c.trim) b.hline(cx - rw / 2, cx + rw / 2, y + 1, c.trim);
    y -= Math.round(2 * scale);
  }
  b.vline(cx, y - Math.round(4 * scale), y, c.roof);
}

/** Wind-twisted pine (yingke song). */
export function pine(b: PixelBuffer, x: number, baseY: number, h: number, rng: Rng, c: { trunk: string; leaf: string; leafHi: string }): void {
  const pts: Point[] = [];
  for (let i = 0; i <= 6; i++) pts.push([x + Math.sin(i * 0.9 + rng() * 2) * 2 + i * 0.6, baseY - (h * i) / 6]);
  b.path(pts, c.trunk, 3);
  for (let i = 2; i <= 6; i++) {
    const [px, py] = pts[i];
    const dir = i % 2 === 0 ? 1 : -1;
    const len = 6 + rng() * 8 - i;
    b.line(px, py, px + dir * len, py - 2, c.trunk);
    b.ellipse(px + dir * len, py - 3, 5 + rng() * 3, 2, c.leaf);
    b.hline(px + dir * len - 3, px + dir * len + 3, py - 5, c.leafHi);
  }
}

/** Cherry blossom tree with a big pink canopy. */
export function blossomTree(b: PixelBuffer, x: number, baseY: number, h: number, rng: Rng, c: { trunk: string; bloom: string; bloomHi: string; bloomShade: string }): void {
  b.thickLine(x, baseY, x + 2, baseY - h * 0.6, 3, c.trunk);
  b.line(x + 2, baseY - h * 0.6, x - 8, baseY - h * 0.85, c.trunk);
  b.line(x + 2, baseY - h * 0.6, x + 10, baseY - h * 0.9, c.trunk);
  const blobs = 7;
  for (let i = 0; i < blobs; i++) {
    const bx = x - 12 + rng() * 26;
    const by = baseY - h * 0.75 - rng() * h * 0.3;
    b.ellipse(bx, by + 1, 6 + rng() * 3, 4, c.bloomShade);
    b.ellipse(bx, by, 5 + rng() * 3, 3.5, c.bloom);
    for (let k = 0; k < 6; k++) b.px(bx - 4 + rng() * 8, by - 3 + rng() * 3, c.bloomHi);
  }
}

/** A bamboo stalk with nodes and leaf sprigs. */
export function bamboo(b: PixelBuffer, x: number, w: number, top: number, bottom: number, rng: Rng, c: { stalk: string; hi: string; node: string; leaf: string }): void {
  b.rect(x, top, w, bottom - top, c.stalk);
  b.vline(x, top, bottom, c.hi);
  const seg = 14 + Math.floor(rng() * 10);
  for (let y = bottom - seg; y > top; y -= seg) {
    b.hline(x - 1, x + w, y, c.node);
    if (rng() < 0.45) {
      const dir = rng() < 0.5 ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        const lx = x + (dir > 0 ? w : -1);
        b.line(lx, y - k * 2, lx + dir * (5 + k * 2), y - k * 2 + 3, c.leaf);
        b.line(lx, y - k * 2 + 1, lx + dir * (4 + k * 2), y - k * 2 + 3, c.leaf);
      }
    }
  }
}

/** Willow with drooping strands. */
export function willow(b: PixelBuffer, x: number, baseY: number, h: number, rng: Rng, c: { trunk: string; leaf: string }): void {
  b.thickLine(x, baseY, x - 2, baseY - h, 4, c.trunk);
  b.ellipse(x - 2, baseY - h, 14, 5, c.leaf);
  for (let i = -14; i <= 14; i += 2) {
    const len = h * (0.5 + rng() * 0.4);
    b.vline(x - 2 + i, baseY - h, baseY - h + len * (1 - Math.abs(i) / 20), c.leaf);
  }
}

/** Tileable stone path / ground strip. */
export function stoneGround(b: PixelBuffer, y0: number, c: { top: string; stone: string; stoneHi: string; mortar: string; soil: string }, rng: Rng): void {
  b.rect(0, y0, b.width, b.height - y0, c.soil);
  b.rect(0, y0, b.width, 2, c.top);
  const rowH = 6;
  for (let row = 0; row < 2; row++) {
    const y = y0 + 2 + row * rowH;
    let x = -row * 7;
    while (x < b.width) {
      const w = 12 + Math.floor(rng() * 8);
      // the last stone of a row stretches to the edge so the strip tiles seamlessly
      const ww = b.width - (x + w) < 12 ? b.width - x : w;
      b.rect(x, y, ww - 1, rowH - 1, c.stone);
      b.hline(x, x + ww - 2, y, c.stoneHi);
      b.vline(x + ww - 1, y, y + rowH - 1, c.mortar);
      x += ww;
    }
    b.hline(0, b.width - 1, y + rowH - 1, c.mortar);
  }
  for (let i = 0; i < b.width / 6; i++) b.px(Math.floor(rng() * b.width), y0 + 15 + Math.floor(rng() * (b.height - y0 - 15)), shade(c.soil, 1.25));
}

/** Rough silhouette spikes (demonic rocks). */
export function spikes(b: PixelBuffer, x: number, baseY: number, h: number, w: number, colour: string, glow?: string): void {
  b.polygon([[x - w / 2, baseY], [x + w / 2, baseY], [x + w * 0.1, baseY - h]], colour);
  if (glow) b.line(x, baseY - 2, x + w * 0.05, baseY - h * 0.6, glow);
}
