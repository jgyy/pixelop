import type { PixelBuffer } from "../pixel/PixelBuffer";
import type { Surface } from "../pixel/surface";

const bitmapCache = new WeakMap<PixelBuffer, HTMLCanvasElement>();

/** Upload a PixelBuffer to an offscreen canvas once, then reuse it every frame. */
export function toCanvas(buf: PixelBuffer): HTMLCanvasElement {
  let c = bitmapCache.get(buf);
  if (!c) {
    c = document.createElement("canvas");
    c.width = buf.width;
    c.height = buf.height;
    const ctx = c.getContext("2d")!;
    ctx.putImageData(new ImageData(new Uint8ClampedArray(buf.data), buf.width, buf.height), 0, 0);
    bitmapCache.set(buf, c);
  }
  return c;
}

/** Surface backed by a low-resolution 2D canvas (scaled up with CSS `image-rendering: pixelated`). */
export class CanvasSurface implements Surface {
  constructor(readonly ctx: CanvasRenderingContext2D) {
    ctx.imageSmoothingEnabled = false;
  }
  get width() {
    return this.ctx.canvas.width;
  }
  get height() {
    return this.ctx.canvas.height;
  }
  rect(x: number, y: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  px(x: number, y: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  sprite(buf: PixelBuffer, x: number, y: number, flipX = false, opacity = 1) {
    const c = toCanvas(buf);
    const ctx = this.ctx;
    const prev = ctx.globalAlpha;
    if (opacity < 1) ctx.globalAlpha = Math.max(0, opacity);
    if (flipX) {
      ctx.save();
      ctx.scale(-1, 1);
      ctx.drawImage(c, -Math.round(x) - buf.width, Math.round(y));
      ctx.restore();
    } else ctx.drawImage(c, Math.round(x), Math.round(y));
    ctx.globalAlpha = prev;
  }
  spriteSlice(buf: PixelBuffer, x: number, y: number, sx: number, sw: number) {
    const x0 = Math.max(0, Math.round(sx));
    const x1 = Math.min(buf.width, Math.round(sx + sw));
    if (x1 <= x0) return;
    this.ctx.drawImage(toCanvas(buf), x0, 0, x1 - x0, buf.height, Math.round(x) + x0, Math.round(y), x1 - x0, buf.height);
  }
}
