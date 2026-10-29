import { parseColor } from "../pixel/color";
import { COS_E, norm, Raster, sub, TILE_U, WORLD_BASIS, type Mat, type Plane, type Ramp, type V3 } from "../iso/raster";

/**
 * The 3D view's twin of the pixel ray caster.
 *
 * Every prop in the game is painted by handing analytic solids (spheres,
 * ellipsoids, swept spheres, convex polyhedra) to a {@link Raster}. A
 * MeshRaster takes the very same calls and, instead of casting rays, records
 * triangles: so the hall, the pagoda, the pines and the lanterns of the 3D
 * world are the same models the isometric art was drawn from, not
 * look-alikes. Colours come from each material's base tone (or its pattern
 * shader, sampled per vertex), and the 3D view does the shading.
 *
 * Output is in the 3D view's frame: tiles as units, Y up, and the map's
 * y axis running along −Z (which keeps the isometric view unmirrored).
 */
export interface Geometry {
  positions: number[];
  normals: number[];
  /** RGBA per vertex; alpha carries how much the vertex sways in the wind (0 = rigid). */
  colors: number[];
  indices: number[];
}

/** A shader's view of the surface, with the light fixed at the ramp's base tone. */
const BASE_LUM = 0.65;

export class MeshRaster extends Raster {
  readonly geo: Geometry = { positions: [], normals: [], colors: [], indices: [] };

  constructor(private readonly detail = 1) {
    super(1, 1, 0, 0, WORLD_BASIS, 1);
  }

  private colour(p: V3, n: V3, u: number, mat: Mat): [number, number, number] | null {
    const h = (p[0] - p[1]) * Math.SQRT1_2;
    const d = (p[0] + p[1]) * Math.SQRT1_2;
    const sx = Math.round(h);
    const sy = Math.round(d * 0.5 - p[2] * COS_E);
    const tone = (r: Ramp, bias = 0) => r[Math.max(0, Math.min(3, 1 + bias))];
    const c = mat.shader ? mat.shader({ p, n, u, lum: BASE_LUM, sx, sy }, tone) : tone(mat.ramp);
    if (!c) return null;
    const [r, g, b] = parseColor(c);
    return [r, g, b];
  }

  /** Append a vertex (model space in, view frame out); returns its index, or -1 where the shader cuts the surface away. */
  private vertex(p: V3, n: V3, u: number, mat: Mat, col?: [number, number, number] | null): number {
    const c = col === undefined ? this.colour(p, n, u, mat) : col;
    if (!c) return -1;
    const g = this.geo;
    const k = g.positions.length / 3;
    g.positions.push(p[0] / TILE_U, p[2] / TILE_U, -p[1] / TILE_U);
    g.normals.push(n[0], n[2], -n[1]);
    g.colors.push(c[0] / 255, c[1] / 255, c[2] / 255, 0);
    return k;
  }

  private tri(a: number, b: number, c: number): void {
    if (a < 0 || b < 0 || c < 0) return;
    this.geo.indices.push(a, b, c);
  }

  /**
   * A grid of points (rows × cols, wrapping round the columns) stitched into
   * quads. Each quad takes one colour, sampled at its middle, so patterns
   * and dithering come out in blocks like the painted pixels.
   */
  private grid(rows: number, cols: number, at: (r: number, c: number) => [V3, V3], u: (r: number) => number, mat: Mat): void {
    const pts: [V3, V3][] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) pts.push(at(r, c));
    for (let r = 0; r < rows - 1; r++)
      for (let c = 0; c < cols; c++) {
        const q = [pts[r * cols + c], pts[r * cols + ((c + 1) % cols)], pts[(r + 1) * cols + ((c + 1) % cols)], pts[(r + 1) * cols + c]];
        const mid = (k: 0 | 1) => norm([q[0][k][0] + q[1][k][0] + q[2][k][0] + q[3][k][0], q[0][k][1] + q[1][k][1] + q[2][k][1] + q[3][k][1], q[0][k][2] + q[1][k][2] + q[2][k][2] + q[3][k][2]]);
        const pm: V3 = [(q[0][0][0] + q[1][0][0] + q[2][0][0] + q[3][0][0]) / 4, (q[0][0][1] + q[1][0][1] + q[2][0][1] + q[3][0][1]) / 4, (q[0][0][2] + q[1][0][2] + q[2][0][2] + q[3][0][2]) / 4];
        const col = this.colour(pm, mid(1), (u(r) + u(r + 1)) / 2, mat);
        if (!col) continue;
        const ids = q.map(([p, n]) => this.vertex(p, n, 0, mat, col));
        this.tri(ids[0], ids[3], ids[1]);
        this.tri(ids[1], ids[3], ids[2]);
      }
  }

  override sphere(c: V3, r: number, mat: Mat, u = 0): void {
    if (r > 0) this.ellipsoid(c, [r, r, r], mat, u);
  }

  override ellipsoid(c: V3, radii: V3, mat: Mat, u = 0): void {
    const R = Math.max(...radii);
    if (R <= 0) return;
    const lon = Math.round(Math.max(6, Math.min(14, R * 0.7)) * this.detail);
    const lat = Math.max(4, Math.round(lon / 2) + 1);
    this.grid(
      lat,
      lon,
      (i, j) => {
        const th = (i / (lat - 1)) * Math.PI;
        const ph = (j / lon) * Math.PI * 2;
        const s = [Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), -Math.cos(th)] as const;
        const p: V3 = [c[0] + s[0] * radii[0], c[1] + s[1] * radii[1], c[2] + s[2] * radii[2]];
        return [p, norm([s[0] / radii[0], s[1] / radii[1], s[2] / radii[2]])];
      },
      () => u,
      mat,
    );
  }

  override sweep(points: readonly V3[], radius: number | readonly number[] | ((u: number) => number), mat: Mat): void {
    if (points.length === 0) return;
    const rAt = (u: number): number => {
      if (typeof radius === "number") return radius;
      if (typeof radius === "function") return radius(u);
      const f = u * (radius.length - 1);
      const i = Math.min(radius.length - 2, Math.floor(f));
      return radius[i] + (radius[i + 1] - radius[i]) * (f - i);
    };
    const lens = [0];
    for (let i = 1; i < points.length; i++) lens.push(lens[i - 1] + Math.hypot(...sub(points[i], points[i - 1])));
    const total = lens[lens.length - 1];
    if (points.length === 1 || total < 1e-6) return this.sphere(points[0], rAt(0), mat, 0);
    // resample at about a radius apart, so tapers and bends survive
    const at = (dist: number): V3 => {
      let s = 1;
      while (s < points.length - 1 && lens[s] < dist) s++;
      const span = lens[s] - lens[s - 1] || 1;
      const t = Math.max(0, Math.min(1, (dist - lens[s - 1]) / span));
      const [a, b] = [points[s - 1], points[s]];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
    };
    const minR = Math.max(0.6, Math.min(rAt(0), rAt(0.5), rAt(1)));
    const n = Math.max(1, Math.min(48, Math.ceil(total / Math.max(1.2, minR * 1.5))));
    const ring = Math.max(5, Math.round(Math.min(10, 4 + minR * 0.8) * this.detail));
    const samples = Array.from({ length: n + 1 }, (_, k) => at((k / n) * total));
    let ref: V3 = [0, 0, 1];
    const frames = samples.map((p, k) => {
      const a = samples[Math.max(0, k - 1)];
      const b = samples[Math.min(n, k + 1)];
      const t = norm(sub(b, a));
      // a side vector at right angles to the path, carried along it so the tube does not twist
      if (Math.abs(t[0] * ref[0] + t[1] * ref[1] + t[2] * ref[2]) > 0.95) ref = Math.abs(t[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
      const s1 = norm(cross(t, ref));
      const s2 = cross(t, s1);
      ref = s2;
      return { p, s1, s2 };
    });
    this.grid(
      n + 1,
      ring,
      (r, c) => {
        const { p, s1, s2 } = frames[r];
        const a = (c / ring) * Math.PI * 2;
        const dir: V3 = [s1[0] * Math.cos(a) + s2[0] * Math.sin(a), s1[1] * Math.cos(a) + s2[1] * Math.sin(a), s1[2] * Math.cos(a) + s2[2] * Math.sin(a)];
        const rr = rAt(r / n);
        return [[p[0] + dir[0] * rr, p[1] + dir[1] * rr, p[2] + dir[2] * rr], dir];
      },
      (r) => r / n,
      mat,
    );
    // rounded ends, as the swept spheres had
    this.sphere(samples[0], rAt(0), mat, 0);
    this.sphere(samples[n], rAt(1), mat, 1);
  }

  override convex(planes: readonly Plane[], min: V3, max: V3, mat: Mat): void {
    const scale = Math.max(1, max[0] - min[0], max[1] - min[1], max[2] - min[2]);
    const eps = 1e-4 * scale;
    const corners: V3[] = [];
    const inside = (p: V3) => planes.every((pl) => dot(pl.n, p) <= pl.d + eps);
    for (let a = 0; a < planes.length; a++)
      for (let b = a + 1; b < planes.length; b++)
        for (let c = b + 1; c < planes.length; c++) {
          const p = solve3(planes[a], planes[b], planes[c]);
          if (!p || !inside(p)) continue;
          if (corners.some((q) => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) + Math.abs(q[2] - p[2]) < eps * 3)) continue;
          corners.push(p);
        }
    if (corners.length < 4) return;
    for (const pl of planes) {
      const on = corners.filter((p) => Math.abs(dot(pl.n, p) - pl.d) < eps * 4);
      if (on.length < 3) continue;
      const cx = on.reduce<V3>((s, p) => [s[0] + p[0] / on.length, s[1] + p[1] / on.length, s[2] + p[2] / on.length], [0, 0, 0]);
      const e1 = norm(Math.abs(pl.n[2]) < 0.9 ? cross(pl.n, [0, 0, 1]) : cross(pl.n, [1, 0, 0]));
      const e2 = cross(pl.n, e1);
      on.sort((p, q) => Math.atan2(dot(sub(p, cx), e2), dot(sub(p, cx), e1)) - Math.atan2(dot(sub(q, cx), e2), dot(sub(q, cx), e1)));
      this.face(on, pl.n, e1, e2, mat);
    }
  }

  /**
   * A flat convex face, cut into cells about a painted pixel or two across
   * (fewer on very large faces), each clipped to the face and coloured by
   * the material at its middle: planks, lattices, tiles and windows show.
   */
  private face(poly: V3[], n: V3, e1: V3, e2: V3, mat: Mat): void {
    const o = poly[0];
    const uv = poly.map((p) => [dot(sub(p, o), e1), dot(sub(p, o), e2)] as [number, number]);
    let [u0, v0, u1, v1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const [u, v] of uv) [u0, v0, u1, v1] = [Math.min(u0, u), Math.min(v0, v), Math.max(u1, u), Math.max(v1, v)];
    const area = (u1 - u0) * (v1 - v0);
    const step = Math.max(2 / this.detail, Math.sqrt(area / 360));
    const to3 = (u: number, v: number): V3 => [o[0] + e1[0] * u + e2[0] * v, o[1] + e1[1] * u + e2[1] * v, o[2] + e1[2] * u + e2[2] * v];
    // the face's edges as half-planes, for clipping cells to it
    const sign = Math.sign(cross2(uv[0], uv[1], uv[2])) || 1;
    for (let v = v0; v < v1 - 1e-6; v += step)
      for (let u = u0; u < u1 - 1e-6; u += step) {
        let cell: [number, number][] = [
          [u, v],
          [Math.min(u1, u + step), v],
          [Math.min(u1, u + step), Math.min(v1, v + step)],
          [u, Math.min(v1, v + step)],
        ];
        for (let k = 0; k < uv.length && cell.length >= 3; k++) cell = clip(cell, uv[k], uv[(k + 1) % uv.length], sign);
        if (cell.length < 3) continue;
        const cu = cell.reduce((s2, p) => s2 + p[0], 0) / cell.length;
        const cv = cell.reduce((s2, p) => s2 + p[1], 0) / cell.length;
        const col = this.colour(to3(cu, cv), n, 0, mat);
        if (!col) continue;
        const ids = cell.map(([cu2, cv2]) => this.vertex(to3(cu2, cv2), n, 0, mat, col));
        for (let k = 1; k < ids.length - 1; k++) this.tri(ids[0], ids[k], ids[k + 1]);
      }
  }

  // decals (eyes on a statue, a sign's glyphs) are a pixel-art nicety the models do without
  override facePoint(): { x: number; y: number; visible: boolean; facing: number } {
    return { x: 0, y: 0, visible: false, facing: 0 };
  }

  override plot(): void {}
}

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

const cross2 = (a: [number, number], b: [number, number], c: [number, number]) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Clip a polygon to the inner side of edge a→b (Sutherland–Hodgman). */
function clip(poly: [number, number][], a: [number, number], b: [number, number], sign: number): [number, number][] {
  const out: [number, number][] = [];
  const side = (p: [number, number]) => cross2(a, b, p) * sign;
  for (let k = 0; k < poly.length; k++) {
    const p = poly[k];
    const q = poly[(k + 1) % poly.length];
    const sp = side(p);
    const sq = side(q);
    if (sp >= -1e-9) out.push(p);
    if ((sp >= -1e-9) !== (sq >= -1e-9)) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

/** Where three planes meet (null when two of them are parallel). */
function solve3(a: Plane, b: Plane, c: Plane): V3 | null {
  const bc = cross(b.n, c.n);
  const det = dot(a.n, bc);
  if (Math.abs(det) < 1e-9) return null;
  const ca = cross(c.n, a.n);
  const ab = cross(a.n, b.n);
  return [(a.d * bc[0] + b.d * ca[0] + c.d * ab[0]) / det, (a.d * bc[1] + b.d * ca[1] + c.d * ab[1]) / det, (a.d * bc[2] + b.d * ca[2] + c.d * ab[2]) / det];
}
