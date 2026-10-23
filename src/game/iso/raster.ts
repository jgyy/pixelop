import { PixelBuffer } from "../pixel/PixelBuffer";
import { parseColor } from "../pixel/color";

/**
 * A tiny z-buffered ray caster that paints pixel art.
 *
 * Every character, beast, tree and building in the game is described as a
 * handful of analytic solids (spheres, ellipsoids, sphere-swept curves and
 * convex polyhedra) in a model space, then ray cast per pixel through a fixed
 * isometric camera. Each solid gets a four-tone ramp (hue-shifted pixel-art
 * shading), optional per-pixel shaders for patterns, decals for faces, and a
 * final selective outline pass. Because models are real 3D, any facing angle
 * can be rendered, which is how all sprites get 16 directions for free.
 *
 * Camera space is (h, d, z): h points right on screen, d points toward the
 * viewer along the ground, z is up. The camera looks down at 30°, which gives
 * the classic 2:1 isometric tile ratio:
 *   screenX = h,  screenY = d·sin30° − z·cos30°.
 */

export type V3 = readonly [number, number, number];

export const SIN_E = 0.5;
export const COS_E = Math.sqrt(3) / 2;
/** Unit vector pointing from the scene toward the camera. */
const VIEW: V3 = [0, COS_E, SIN_E];

export const norm = (v: V3): V3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const lerp3 = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Key light from the upper left, slightly toward the viewer. */
const LIGHT = norm([-0.55, 0.45, 0.75]);

/** Four-tone ramp: highlight, base, shade, deep shadow. */
export type Ramp = readonly [string, string, string, string];

export interface Surf {
  /** Model-space surface point. */
  p: V3;
  /** Model-space unit normal. */
  n: V3;
  /** Parameter along a sweep (0 → 1), 0 for other solids. */
  u: number;
  /** Lambert lighting 0..1 including ambient. */
  lum: number;
  sx: number;
  sy: number;
}

/** Returns a colour, or null to leave the pixel untouched (cut-outs). */
export type Shader = (s: Surf, tone: (r: Ramp, bias?: number) => string) => string | null;

export interface Mat {
  ramp: Ramp;
  shader?: Shader;
  /** Pixels of different groups get a dark line where they overlap in depth. */
  group?: number;
  /** Outline colour used where this material meets empty space. */
  outline?: string;
  /** Dither between tone bands (nice on large surfaces). */
  dither?: boolean;
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number) => BAYER[(y & 3) * 4 + (x & 3)] / 16;

export function toneIndex(lum: number, sx: number, sy: number, dither = false): number {
  const v = lum * 3.2 + (dither ? bayer(sx, sy) * 0.5 - 0.25 : 0);
  if (v > 2.55) return 0;
  if (v > 1.55) return 1;
  if (v > 0.85) return 2;
  return 3;
}

/** 2D basis mapping model x/y axes into camera (h, d). */
export interface Basis {
  xh: number;
  xd: number;
  yh: number;
  yd: number;
}

/**
 * Basis for a character facing angle `a` (radians). 0 faces the viewer,
 * π/2 faces screen-right, π faces away. Model +y is forward, +x is the
 * character's right hand.
 */
export function facingBasis(a: number): Basis {
  return { xh: -Math.cos(a), xd: Math.sin(a), yh: Math.sin(a), yd: Math.cos(a) };
}

/** Model x/y aligned with the world tile grid (used by props and buildings). */
export const WORLD_BASIS: Basis = { xh: Math.SQRT1_2, xd: Math.SQRT1_2, yh: -Math.SQRT1_2, yd: Math.SQRT1_2 };

/** One isometric tile edge in model units (a tile is 32 px wide on screen). */
export const TILE_U = 16 * Math.SQRT2;
/** One terrain height level (8 px on screen) in model units. */
export const LEVEL_U = 8 / COS_E;

export interface Plane {
  n: V3;
  d: number;
}

export class Raster {
  readonly buf: PixelBuffer;
  private readonly depth: Float32Array;
  private readonly group: Int16Array;
  private readonly outlineOf: Int16Array;
  private readonly outlines: string[] = [];
  private readonly v: V3;

  constructor(
    readonly w: number,
    readonly h: number,
    /** Screen position of the model origin inside the buffer. */
    readonly ox: number,
    readonly oy: number,
    readonly basis: Basis = facingBasis(0),
    /** Uniform model scale (portraits are rendered large). */
    readonly k = 1,
  ) {
    this.buf = new PixelBuffer(w, h);
    this.depth = new Float32Array(w * h).fill(-Infinity);
    this.group = new Int16Array(w * h).fill(-1);
    this.outlineOf = new Int16Array(w * h).fill(-1);
    this.v = this.toModelDir(VIEW);
  }

  // ---------------------------------------------------------------- transforms
  toCam(p: V3): V3 {
    const b = this.basis;
    return [(p[0] * b.xh + p[1] * b.yh) * this.k, (p[0] * b.xd + p[1] * b.yd) * this.k, p[2] * this.k];
  }

  private camDir(n: V3): V3 {
    const b = this.basis;
    return [n[0] * b.xh + n[1] * b.yh, n[0] * b.xd + n[1] * b.yd, n[2]];
  }

  private toModelDir(c: V3): V3 {
    const b = this.basis;
    return [c[0] * b.xh + c[1] * b.xd, c[0] * b.yh + c[1] * b.yd, c[2]];
  }

  /** Screen position (buffer pixels) of a model-space point. */
  screen(p: V3): [number, number] {
    const c = this.toCam(p);
    return [this.ox + c[0], this.oy + c[1] * SIN_E - c[2] * COS_E];
  }

  /** Model-space ray (origin on the depth-0 plane, unit direction toward the viewer) through a pixel centre. */
  private ray(px: number, py: number): V3 {
    const X = px + 0.5 - this.ox;
    const Y = py + 0.5 - this.oy;
    const B: V3 = [X, Y * SIN_E, -Y * COS_E];
    const m = this.toModelDir(B);
    return [m[0] / this.k, m[1] / this.k, m[2] / this.k];
  }

  private light(nModel: V3): number {
    const n = this.camDir(nModel);
    return 0.28 + 0.72 * Math.max(0, dot(n, LIGHT));
  }

  private outlineIndex(c: string | undefined): number {
    if (!c) return -1;
    let i = this.outlines.indexOf(c);
    if (i < 0) {
      i = this.outlines.length;
      this.outlines.push(c);
    }
    return i;
  }

  private write(px: number, py: number, depth: number, p: V3, n: V3, u: number, mat: Mat, oi: number): void {
    const i = py * this.w + px;
    if (depth <= this.depth[i]) return;
    const lum = this.light(n);
    const tone = (r: Ramp, bias = 0) => r[Math.max(0, Math.min(3, toneIndex(lum, px, py, mat.dither) + bias))];
    const col = mat.shader ? mat.shader({ p, n, u, lum, sx: px, sy: py }, tone) : tone(mat.ramp);
    if (!col) return;
    const [r, g, b] = parseColor(col);
    const d = this.buf.data;
    d[i * 4] = r;
    d[i * 4 + 1] = g;
    d[i * 4 + 2] = b;
    d[i * 4 + 3] = 255;
    this.depth[i] = depth;
    this.group[i] = mat.group ?? 0;
    this.outlineOf[i] = oi;
  }

  private bounds(cx: number, cy: number, rx: number, ry: number): [number, number, number, number] {
    return [Math.max(0, Math.floor(cx - rx - 1)), Math.max(0, Math.floor(cy - ry - 1)), Math.min(this.w - 1, Math.ceil(cx + rx + 1)), Math.min(this.h - 1, Math.ceil(cy + ry + 1))];
  }

  // ---------------------------------------------------------------- primitives
  sphere(c: V3, r: number, mat: Mat, u = 0): void {
    if (r <= 0) return;
    const [sx, sy] = this.screen(c);
    const R = r * this.k;
    const [x0, y0, x1, y1] = this.bounds(sx, sy, R, R);
    const v = this.v;
    const oi = this.outlineIndex(mat.outline);
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const B = this.ray(px, py);
        const q0 = B[0] - c[0];
        const q1 = B[1] - c[1];
        const q2 = B[2] - c[2];
        const b = q0 * v[0] + q1 * v[1] + q2 * v[2];
        const disc = b * b - (q0 * q0 + q1 * q1 + q2 * q2 - r * r);
        if (disc < 0) continue;
        const t = -b + Math.sqrt(disc);
        const p: V3 = [B[0] + t * v[0], B[1] + t * v[1], B[2] + t * v[2]];
        const n: V3 = [(p[0] - c[0]) / r, (p[1] - c[1]) / r, (p[2] - c[2]) / r];
        this.write(px, py, t * this.k, p, n, u, mat, oi);
      }
  }

  /** Axis-aligned (model space) ellipsoid. */
  ellipsoid(c: V3, radii: V3, mat: Mat, u = 0): void {
    const [sx, sy] = this.screen(c);
    const R = Math.max(...radii) * this.k;
    const [x0, y0, x1, y1] = this.bounds(sx, sy, R, R);
    const v = this.v;
    const vs: V3 = [v[0] / radii[0], v[1] / radii[1], v[2] / radii[2]];
    const a = dot(vs, vs);
    const oi = this.outlineIndex(mat.outline);
    for (let py = y0; py <= y1; py++)
      for (let px = x0; px <= x1; px++) {
        const B = this.ray(px, py);
        const q: V3 = [(B[0] - c[0]) / radii[0], (B[1] - c[1]) / radii[1], (B[2] - c[2]) / radii[2]];
        const b = dot(q, vs);
        const disc = b * b - a * (dot(q, q) - 1);
        if (disc < 0) continue;
        const t = (-b + Math.sqrt(disc)) / a;
        const p: V3 = [B[0] + t * v[0], B[1] + t * v[1], B[2] + t * v[2]];
        const n = norm([(p[0] - c[0]) / (radii[0] * radii[0]), (p[1] - c[1]) / (radii[1] * radii[1]), (p[2] - c[2]) / (radii[2] * radii[2])]);
        this.write(px, py, t * this.k, p, n, u, mat, oi);
      }
  }

  /** Spheres swept along a polyline: limbs, tails, hair, robes, blades. */
  sweep(points: readonly V3[], radius: number | readonly number[] | ((u: number) => number), mat: Mat, step = 0.5): void {
    if (points.length === 0) return;
    const lens = [0];
    for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + Math.hypot(...sub(points[i], points[i - 1])));
    const total = lens[lens.length - 1];
    const rAt = (u: number): number => {
      if (typeof radius === "number") return radius;
      if (typeof radius === "function") return radius(u);
      const f = u * (radius.length - 1);
      const i = Math.min(radius.length - 2, Math.floor(f));
      return radius[i] + (radius[i + 1] - radius[i]) * (f - i);
    };
    const s = Math.min(step, 0.6 / this.k);
    const n = Math.max(1, Math.ceil(total / s));
    let seg = 1;
    for (let k = 0; k <= n; k++) {
      const dist = (k / n) * total;
      while (seg < points.length - 1 && lens[seg] < dist) seg++;
      const a = points[Math.max(0, seg - 1)];
      const b = points[Math.min(points.length - 1, seg)];
      const span = lens[seg] - lens[seg - 1] || 1;
      const p = points.length === 1 ? points[0] : lerp3(a, b, Math.max(0, Math.min(1, (dist - lens[seg - 1]) / span)));
      const u = total === 0 ? 0 : dist / total;
      this.sphere(p, rAt(u), mat, u);
    }
  }

  /** Convex polyhedron given by planes n·p ≤ d (model space) and a model AABB for culling. */
  convex(planes: readonly Plane[], min: V3, max: V3, mat: Mat): void {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const [sx, sy] = this.screen([i & 1 ? max[0] : min[0], i & 2 ? max[1] : min[1], i & 4 ? max[2] : min[2]]);
      x0 = Math.min(x0, sx);
      y0 = Math.min(y0, sy);
      x1 = Math.max(x1, sx);
      y1 = Math.max(y1, sy);
    }
    const [bx0, by0, bx1, by1] = [Math.max(0, Math.floor(x0)), Math.max(0, Math.floor(y0)), Math.min(this.w - 1, Math.ceil(x1)), Math.min(this.h - 1, Math.ceil(y1))];
    const v = this.v;
    const oi = this.outlineIndex(mat.outline);
    const dv = planes.map((pl) => dot(pl.n, v));
    for (let py = by0; py <= by1; py++)
      for (let px = bx0; px <= bx1; px++) {
        const B = this.ray(px, py);
        let tIn = -Infinity;
        let tOut = Infinity;
        let hit = -1;
        let miss = false;
        for (let i = 0; i < planes.length; i++) {
          const num = planes[i].d - dot(planes[i].n, B);
          const den = dv[i];
          if (Math.abs(den) < 1e-9) {
            if (num < 0) {
              miss = true;
              break;
            }
          } else if (den > 0) {
            const t = num / den;
            if (t < tOut) {
              tOut = t;
              hit = i;
            }
          } else {
            tIn = Math.max(tIn, num / den);
          }
          if (tIn > tOut) {
            miss = true;
            break;
          }
        }
        if (miss || hit < 0 || tIn > tOut) continue;
        const p: V3 = [B[0] + tOut * v[0], B[1] + tOut * v[1], B[2] + tOut * v[2]];
        this.write(px, py, tOut * this.k, p, planes[hit].n, 0, mat, oi);
      }
  }

  box(min: V3, max: V3, mat: Mat): void {
    this.convex(
      [
        { n: [1, 0, 0], d: max[0] },
        { n: [-1, 0, 0], d: -min[0] },
        { n: [0, 1, 0], d: max[1] },
        { n: [0, -1, 0], d: -min[1] },
        { n: [0, 0, 1], d: max[2] },
        { n: [0, 0, -1], d: -min[2] },
      ],
      min,
      max,
      mat,
    );
  }

  /** Vertical regular prism (a pixel-art cylinder). */
  prism(cx: number, cy: number, r: number, z0: number, z1: number, sides: number, mat: Mat, rot = 0): void {
    const planes: Plane[] = [
      { n: [0, 0, 1], d: z1 },
      { n: [0, 0, -1], d: -z0 },
    ];
    const ap = r * Math.cos(Math.PI / sides);
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const n: V3 = [Math.cos(a), Math.sin(a), 0];
      planes.push({ n, d: n[0] * cx + n[1] * cy + ap });
    }
    this.convex(planes, [cx - r, cy - r, z0], [cx + r, cy + r, z1], mat);
  }

  /** Regular pyramid / cone (apex up), optionally truncated. */
  cone(cx: number, cy: number, r0: number, z0: number, r1: number, z1: number, sides: number, mat: Mat, rot = 0): void {
    const planes: Plane[] = [
      { n: [0, 0, 1], d: z1 },
      { n: [0, 0, -1], d: -z0 },
    ];
    const c = Math.cos(Math.PI / sides);
    const a0 = r0 * c;
    const a1 = r1 * c;
    for (let i = 0; i < sides; i++) {
      const a = rot + (i / sides) * Math.PI * 2;
      const n = norm([Math.cos(a) * (z1 - z0), Math.sin(a) * (z1 - z0), a0 - a1]);
      const pt: V3 = [cx + Math.cos(a) * a0, cy + Math.sin(a) * a0, z0];
      planes.push({ n, d: dot(n, pt) });
    }
    this.convex(planes, [cx - r0, cy - r0, z0], [cx + r0, cy + r0, z1], mat);
  }

  /** Hip roof: rectangle (half sizes ax, ay) at z0 rising to a ridge rectangle (bx, by) at z1. */
  hipRoof(cx: number, cy: number, ax: number, ay: number, z0: number, bx: number, by: number, z1: number, mat: Mat): void {
    const h = z1 - z0;
    const side = (nx: number, ny: number, a: number, b: number): Plane => {
      const n = norm([nx * h, ny * h, a - b]);
      return { n, d: dot(n, [cx + nx * a, cy + ny * a, z0]) };
    };
    this.convex(
      [
        { n: [0, 0, 1], d: z1 },
        { n: [0, 0, -1], d: -z0 },
        side(1, 0, ax, bx),
        side(-1, 0, ax, bx),
        side(0, 1, ay, by),
        side(0, -1, ay, by),
      ],
      [cx - ax, cy - ay, z0],
      [cx + ax, cy + ay, z1],
      mat,
    );
  }

  // ---------------------------------------------------------------- decals
  /**
   * Where a surface point lands on screen and whether it is visible (facing
   * the camera and not hidden behind something already drawn).
   */
  facePoint(p: V3, n: V3, minFacing = 0.15): { x: number; y: number; visible: boolean; facing: number } {
    const [x, y] = this.screen(p);
    const facing = dot(this.camDir(n), VIEW);
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let visible = facing >= minFacing && ix >= 0 && iy >= 0 && ix < this.w && iy < this.h;
    if (visible) {
      const c = this.toCam(p);
      const depth = c[1] * COS_E + c[2] * SIN_E;
      if (this.depth[iy * this.w + ix] > depth + 1.5 * this.k) visible = false;
    }
    return { x: ix, y: iy, visible, facing };
  }

  /** Plot a decal pixel (only over existing pixels unless `force`). */
  plot(x: number, y: number, color: string, force = false): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (!force && this.depth[y * this.w + x] === -Infinity) return;
    this.buf.px(x, y, color);
  }

  // ---------------------------------------------------------------- finish
  /**
   * Selective outlining: a dark line where two groups overlap with a depth
   * gap (e.g. an arm in front of the torso), then a silhouette outline.
   */
  finish(opts: { outline?: string; inner?: boolean; innerGap?: number } = {}): PixelBuffer {
    const { w, h, depth, group, buf } = this;
    const d = buf.data;
    const gap = (opts.innerGap ?? 2.5) * this.k;
    if (opts.inner !== false) {
      const darken: number[] = [];
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (depth[i] === -Infinity) continue;
          for (const [ox, oy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
          ]) {
            const nx = x + ox;
            const ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (depth[j] === -Infinity || group[j] === group[i]) continue;
            if (depth[j] - depth[i] > gap) {
              darken.push(i);
              break;
            }
          }
        }
      for (const i of darken) {
        d[i * 4] = d[i * 4] * 0.55 + 10;
        d[i * 4 + 1] = d[i * 4 + 1] * 0.5 + 6;
        d[i * 4 + 2] = d[i * 4 + 2] * 0.6 + 20;
      }
    }
    const fallback = opts.outline;
    if (fallback === undefined && this.outlines.length === 0) return buf;
    const out = buf.clone();
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (depth[i] !== -Infinity || d[i * 4 + 3] > 0) continue;
        let oi = -2;
        for (const [ox, oy] of [
          [0, 1],
          [1, 0],
          [-1, 0],
          [0, -1],
        ]) {
          const nx = x + ox;
          const ny = y + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (depth[j] !== -Infinity) {
            oi = this.outlineOf[j];
            break;
          }
        }
        if (oi === -2) continue;
        const c = oi >= 0 ? this.outlines[oi] : fallback;
        if (c) out.px(x, y, c);
      }
    return out;
  }
}

/** Catmull-Rom spline through control points (for hair, tails, ribbons). */
export function spline(pts: readonly V3[], perSeg = 4): V3[] {
  if (pts.length < 3) return [...pts];
  const out: V3[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = 0; s < perSeg; s++) {
      const t = s / perSeg;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), f(p0[2], p1[2], p2[2], p3[2])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
