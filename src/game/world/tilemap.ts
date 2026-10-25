import { fbm } from "../pixel/noise";

export const TILE_KINDS = [
  "void",
  "grass",
  "meadow",
  "dirt",
  "plaza",
  "stairs",
  "wood",
  "sand",
  "leaf",
  "moss",
  "ash",
  "redrock",
  "marble",
  "snow",
  "water",
  "deep",
  "paddy",
  "lava",
  // building interiors: plastered walls (some with lattice windows) and woven rugs
  "wall",
  "window",
  "rug",
  // underground: cave floors, the rock face behind them, mine tracks and frozen pools
  "cave",
  "rockwall",
  "rails",
  "ice",
] as const;
export type TileKind = (typeof TILE_KINDS)[number];

export const LIQUID: Partial<Record<TileKind, "water" | "lava" | "paddy">> = { water: "water", deep: "water", paddy: "paddy", lava: "lava" };

/** Height-mapped isometric tile grid with prop blocking. */
export class TileMap {
  readonly kinds: Uint8Array;
  readonly heights: Int8Array;
  readonly blocked: Uint8Array;

  constructor(
    readonly w: number,
    readonly h: number,
    fillKind: TileKind = "grass",
    fillHeight = 0,
  ) {
    this.kinds = new Uint8Array(w * h).fill(TILE_KINDS.indexOf(fillKind));
    this.heights = new Int8Array(w * h).fill(fillHeight);
    this.blocked = new Uint8Array(w * h);
  }

  inside(i: number, j: number): boolean {
    return i >= 0 && j >= 0 && i < this.w && j < this.h;
  }

  kind(i: number, j: number): TileKind {
    return this.inside(i, j) ? TILE_KINDS[this.kinds[j * this.w + i]] : "void";
  }

  height(i: number, j: number): number {
    return this.inside(i, j) ? this.heights[j * this.w + i] : -99;
  }

  set(i: number, j: number, kind?: TileKind, height?: number): void {
    if (!this.inside(i, j)) return;
    if (kind !== undefined) this.kinds[j * this.w + i] = TILE_KINDS.indexOf(kind);
    if (height !== undefined) this.heights[j * this.w + i] = height;
  }

  block(i: number, j: number, on = true): void {
    if (this.inside(i, j)) this.blocked[j * this.w + i] = on ? 1 : 0;
  }

  isBlocked(i: number, j: number): boolean {
    return this.inside(i, j) && this.blocked[j * this.w + i] === 1;
  }

  /** Can a walker stand on this tile? (Flyers may also cross liquids.) */
  standable(i: number, j: number, flying = false): boolean {
    const k = this.kind(i, j);
    if (k === "void" || k === "wall" || k === "window" || k === "rockwall") return false;
    if (this.isBlocked(i, j)) return false;
    if (LIQUID[k] && !flying) return false;
    return true;
  }

  /** Surface height at a tile (liquids sit a quarter level lower). */
  surface(i: number, j: number): number {
    const k = this.kind(i, j);
    return this.height(i, j) - (LIQUID[k] ? 0.25 : 0);
  }

  // ------------------------------------------------------------------ builder helpers
  rect(i0: number, j0: number, i1: number, j1: number, kind?: TileKind, height?: number): this {
    for (let j = Math.min(j0, j1); j <= Math.max(j0, j1); j++) for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) this.set(i, j, kind, height);
    return this;
  }

  /** Disc with optional noisy rim. */
  disc(ci: number, cj: number, r: number, kind?: TileKind, height?: number, rough = 0, seed = 1): this {
    for (let j = Math.floor(cj - r - 2); j <= Math.ceil(cj + r + 2); j++)
      for (let i = Math.floor(ci - r - 2); i <= Math.ceil(ci + r + 2); i++) {
        const d = Math.hypot(i - ci, j - cj);
        const rr = r + (rough ? (fbm(i * 0.35, j * 0.35, seed) - 0.5) * rough * 2 : 0);
        if (d <= rr) this.set(i, j, kind, height);
      }
    return this;
  }

  /** Thick polyline (roads, rivers). */
  path(points: [number, number][], width: number, kind?: TileKind, height?: number | ((i: number, j: number) => number | undefined)): this {
    for (let p = 1; p < points.length; p++) {
      const [x0, y0] = points[p - 1];
      const [x1, y1] = points[p];
      const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3));
      for (let s = 0; s <= steps; s++) {
        const cx = x0 + ((x1 - x0) * s) / steps;
        const cy = y0 + ((y1 - y0) * s) / steps;
        for (let j = Math.floor(cy - width); j <= Math.ceil(cy + width); j++)
          for (let i = Math.floor(cx - width); i <= Math.ceil(cx + width); i++) {
            if (Math.hypot(i - cx, j - cy) > width / 2 + 0.2) continue;
            const hh = typeof height === "function" ? height(i, j) : height;
            this.set(i, j, kind, hh);
          }
      }
    }
    return this;
  }

  each(fn: (i: number, j: number) => void): this {
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) fn(i, j);
    return this;
  }
}
