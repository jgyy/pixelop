import { parseColor } from "./color";

export type Point = readonly [number, number];

/**
 * A tiny software framebuffer. All of the game's pixel art is painted into
 * these, which keeps the art generators pure (they run in the browser, in
 * Node for PNG/GIF export, and in unit tests).
 */
export class PixelBuffer {
  readonly data: Uint8ClampedArray;

  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.data = new Uint8ClampedArray(width * height * 4);
  }

  clone(): PixelBuffer {
    const b = new PixelBuffer(this.width, this.height);
    b.data.set(this.data);
    return b;
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  /** Alpha of the pixel at (x,y), 0 when out of bounds. */
  alphaAt(x: number, y: number): number {
    if (!this.inBounds(x, y)) return 0;
    return this.data[(y * this.width + x) * 4 + 3];
  }

  getRGBA(x: number, y: number): [number, number, number, number] {
    const i = (y * this.width + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  /** Plot one pixel, source-over blending translucent colours. */
  px(x: number, y: number, color: string): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inBounds(x, y)) return;
    const [r, g, b, a] = parseColor(color);
    this.blendAt((y * this.width + x) * 4, r, g, b, a);
  }

  private blendAt(i: number, r: number, g: number, b: number, a: number): void {
    const d = this.data;
    if (a >= 255) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = 255;
      return;
    }
    if (a <= 0) return;
    const sa = a / 255;
    const da = d[i + 3] / 255;
    const oa = sa + da * (1 - sa);
    d[i] = (r * sa + d[i] * da * (1 - sa)) / oa;
    d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa;
    d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa;
    d[i + 3] = oa * 255;
  }

  /** Erase a pixel back to transparent. */
  clear(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    this.data.fill(0, (y * this.width + x) * 4, (y * this.width + x) * 4 + 4);
  }

  rect(x: number, y: number, w: number, h: number, color: string): void {
    x = Math.round(x);
    y = Math.round(y);
    for (let j = Math.max(0, y); j < Math.min(this.height, y + h); j++)
      for (let i = Math.max(0, x); i < Math.min(this.width, x + w); i++) this.px(i, j, color);
  }

  fill(color: string): void {
    this.rect(0, 0, this.width, this.height, color);
  }

  hline(x0: number, x1: number, y: number, color: string): void {
    const [a, b] = x0 < x1 ? [x0, x1] : [x1, x0];
    for (let x = Math.round(a); x <= Math.round(b); x++) this.px(x, y, color);
  }

  vline(x: number, y0: number, y1: number, color: string): void {
    const [a, b] = y0 < y1 ? [y0, y1] : [y1, y0];
    for (let y = Math.round(a); y <= Math.round(b); y++) this.px(x, y, color);
  }

  /** Bresenham line. */
  line(x0: number, y0: number, x1: number, y1: number, color: string): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.px(x0, y0, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** A line stamped with a square brush of the given width. */
  thickLine(x0: number, y0: number, x1: number, y1: number, width: number, color: string): void {
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    const half = (width - 1) / 2;
    const seen = new Set<number>();
    for (let s = 0; s <= steps; s++) {
      const cx = x0 + ((x1 - x0) * s) / steps;
      const cy = y0 + ((y1 - y0) * s) / steps;
      for (let j = Math.round(cy - half); j <= Math.round(cy + half); j++)
        for (let i = Math.round(cx - half); i <= Math.round(cx + half); i++) {
          const k = j * 4096 + i;
          if (seen.has(k)) continue;
          seen.add(k);
          this.px(i, j, color);
        }
    }
  }

  /** Polyline through points. */
  path(points: readonly Point[], color: string, width = 1): void {
    for (let i = 1; i < points.length; i++) {
      const [ax, ay] = points[i - 1];
      const [bx, by] = points[i];
      if (width <= 1) this.line(ax, ay, bx, by, color);
      else this.thickLine(ax, ay, bx, by, width, color);
    }
  }

  /** Filled ellipse centred on (cx,cy) with radii rx, ry. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x - cx) / (rx + 0.5);
        const ny = (y - cy) / (ry + 0.5);
        if (nx * nx + ny * ny <= 1) this.px(x, y, color);
      }
  }

  circle(cx: number, cy: number, r: number, color: string): void {
    this.ellipse(cx, cy, r, r, color);
  }

  /** Circle outline (ring) of radius r. */
  ring(cx: number, cy: number, r: number, color: string): void {
    const steps = Math.max(8, Math.ceil(r * 8));
    let last = -1;
    for (let s = 0; s < steps; s++) {
      const a = (s / steps) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(a) * r);
      const y = Math.round(cy + Math.sin(a) * r);
      const k = y * 4096 + x;
      if (k === last) continue;
      last = k;
      this.px(x, y, color);
    }
  }

  /** Scanline polygon fill (even-odd). */
  polygon(points: readonly Point[], color: string): void {
    if (points.length < 3) return;
    const ys = points.map((p) => p[1]);
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxY = Math.min(this.height - 1, Math.ceil(Math.max(...ys)));
    for (let y = minY; y <= maxY; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[(i + 1) % points.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.px(x, y, color);
      }
    }
  }

  /** Copy another buffer onto this one (alpha blended, optional mirror). */
  blit(src: PixelBuffer, dx: number, dy: number, flipX = false, opacity = 1): void {
    dx = Math.round(dx);
    dy = Math.round(dy);
    for (let y = 0; y < src.height; y++) {
      const ty = y + dy;
      if (ty < 0 || ty >= this.height) continue;
      for (let x = 0; x < src.width; x++) {
        const sx = flipX ? src.width - 1 - x : x;
        const tx = x + dx;
        if (tx < 0 || tx >= this.width) continue;
        const si = (y * src.width + sx) * 4;
        const a = opacity >= 1 ? src.data[si + 3] : src.data[si + 3] * opacity;
        if (a <= 0) continue;
        this.blendAt((ty * this.width + tx) * 4, src.data[si], src.data[si + 1], src.data[si + 2], a);
      }
    }
  }

  /** Returns a copy with a 1px outline drawn around every opaque pixel. */
  outlined(color: string, diagonal = false): PixelBuffer {
    const out = new PixelBuffer(this.width, this.height);
    const n4: Point[] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const n8: Point[] = [...n4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
    const ns = diagonal ? n8 : n4;
    for (let y = 0; y < this.height; y++)
      for (let x = 0; x < this.width; x++) {
        if (this.alphaAt(x, y) > 0) continue;
        if (ns.some(([ox, oy]) => this.alphaAt(x + ox, y + oy) > 40)) out.px(x, y, color);
      }
    out.blit(this, 0, 0);
    return out;
  }

  /** Replace every opaque pixel with a single colour (used for hit flashes / silhouettes). */
  tinted(color: string, amount = 1): PixelBuffer {
    const out = this.clone();
    const [r, g, b] = parseColor(color);
    for (let i = 0; i < out.data.length; i += 4) {
      if (out.data[i + 3] === 0) continue;
      out.data[i] += (r - out.data[i]) * amount;
      out.data[i + 1] += (g - out.data[i + 1]) * amount;
      out.data[i + 2] += (b - out.data[i + 2]) * amount;
    }
    return out;
  }

  /** Number of non-transparent pixels. */
  opaqueCount(): number {
    let n = 0;
    for (let i = 3; i < this.data.length; i += 4) if (this.data[i] > 0) n++;
    return n;
  }

  /** Nearest-neighbour upscale. */
  scaled(factor: number): PixelBuffer {
    const out = new PixelBuffer(this.width * factor, this.height * factor);
    for (let y = 0; y < out.height; y++)
      for (let x = 0; x < out.width; x++) {
        const si = (Math.floor(y / factor) * this.width + Math.floor(x / factor)) * 4;
        const di = (y * out.width + x) * 4;
        out.data[di] = this.data[si];
        out.data[di + 1] = this.data[si + 1];
        out.data[di + 2] = this.data[si + 2];
        out.data[di + 3] = this.data[si + 3];
      }
    return out;
  }
}

/** Paint into a fresh buffer and return it with an outline — the standard way sprite parts are built. */
export function layer(w: number, h: number, paint: (b: PixelBuffer) => void, outline?: string): PixelBuffer {
  const b = new PixelBuffer(w, h);
  paint(b);
  return outline ? b.outlined(outline) : b;
}
