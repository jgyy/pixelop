import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import type { PixelBuffer } from "../src/game/pixel/PixelBuffer";

export function writePng(buf: PixelBuffer, path: string): void {
  const png = new PNG({ width: buf.width, height: buf.height });
  png.data = Buffer.from(buf.data);
  writeFileSync(path, PNG.sync.write(png));
}
