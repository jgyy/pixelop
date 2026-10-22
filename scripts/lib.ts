import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import { PixelBuffer } from "../src/game/pixel/PixelBuffer";
import type { SpriteSheet } from "../src/game/sprites/types";

/** Lay every animation of a sheet out as rows of frames on a backdrop. */
export function sheetToBuffer(sheet: SpriteSheet, bg = "#3a3550"): PixelBuffer {
  const anims = Object.values(sheet.animations);
  const cols = Math.max(...anims.map((a) => a.frames.length));
  const out = new PixelBuffer(cols * (sheet.width + 2), anims.length * (sheet.height + 2));
  out.fill(bg);
  anims.forEach((a, row) =>
    a.frames.forEach((fr, col) => out.blit(fr, col * (sheet.width + 2), row * (sheet.height + 2))),
  );
  return out;
}

export function writePng(buf: PixelBuffer, path: string): void {
  const png = new PNG({ width: buf.width, height: buf.height });
  png.data = Buffer.from(buf.data);
  writeFileSync(path, PNG.sync.write(png));
}
