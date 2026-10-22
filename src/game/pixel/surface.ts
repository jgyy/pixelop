import { PixelBuffer } from "./PixelBuffer";

/**
 * Minimal drawing target shared by the browser canvas and the software
 * PixelBuffer, so scenes/effects can be rendered live or exported offline.
 */
export interface Surface {
  readonly width: number;
  readonly height: number;
  rect(x: number, y: number, w: number, h: number, color: string): void;
  px(x: number, y: number, color: string): void;
  sprite(buf: PixelBuffer, x: number, y: number, flipX?: boolean, opacity?: number): void;
}

export class BufferSurface implements Surface {
  constructor(readonly buffer: PixelBuffer) {}
  get width() {
    return this.buffer.width;
  }
  get height() {
    return this.buffer.height;
  }
  rect(x: number, y: number, w: number, h: number, color: string) {
    this.buffer.rect(Math.round(x), Math.round(y), Math.round(w), Math.round(h), color);
  }
  px(x: number, y: number, color: string) {
    this.buffer.px(x, y, color);
  }
  sprite(buf: PixelBuffer, x: number, y: number, flipX = false, opacity = 1) {
    this.buffer.blit(buf, x, y, flipX, opacity);
  }
}

/** Bresenham line on any surface. */
export function sLine(s: Surface, x0: number, y0: number, x1: number, y1: number, color: string): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (let guard = 0; guard < 4096; guard++) {
    s.px(x0, y0, color);
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

/** Filled circle via horizontal spans (cheap on canvas). */
export function sCircle(s: Surface, cx: number, cy: number, r: number, color: string): void {
  const R = Math.max(0, r);
  for (let y = -Math.ceil(R); y <= Math.ceil(R); y++) {
    const half = Math.floor(Math.sqrt(Math.max(0, (R + 0.5) * (R + 0.5) - y * y)));
    s.rect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1, color);
  }
}

/** Circle outline. */
export function sRing(s: Surface, cx: number, cy: number, r: number, color: string): void {
  const steps = Math.max(12, Math.ceil(r * 7));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    s.px(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), color);
  }
}
