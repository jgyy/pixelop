/**
 * Export every procedural sprite sheet as PNG and animated GIF showcases
 * into docs/art (used by the README and PR). Run: `npm run assets`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { PixelBuffer } from "../src/game/pixel/PixelBuffer";
import { drawText, textWidth } from "../src/game/pixel/font";
import { BufferSurface } from "../src/game/pixel/surface";
import { renderSceneFrame, SCENE_IDS, SCREEN_H, SCREEN_W } from "../src/game/scenes";
import { frameAt, getSprite, SPRITE_IDS, type SpriteId } from "../src/game/sprites";
import { renderTitle } from "../src/game/runtime/title";
import { sheetToBuffer, writePng } from "./lib";

const OUT = path.resolve(process.argv[2] ?? "docs/art");
mkdirSync(OUT, { recursive: true });
const BG = "#2a2048";

function writeGif(file: string, frames: PixelBuffer[], fps: number): void {
  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    gif.writeFrame(applyPalette(f.data, palette), f.width, f.height, { palette, delay: Math.round(1000 / fps) });
  }
  gif.finish();
  writeFileSync(path.join(OUT, file), gif.bytes());
}

/** Grid of labelled animation cells, all playing in sync. */
function showcase(cells: { id: SpriteId; anim: string }[], cols: number, scale: number, seconds: number, fps = 12): PixelBuffer[] {
  const cw = Math.max(...cells.map((c) => getSprite(c.id).width)) + 8;
  const ch = Math.max(...cells.map((c) => getSprite(c.id).height)) + 14;
  const rows = Math.ceil(cells.length / cols);
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const t = i / fps;
    const buf = new PixelBuffer(cols * cw, rows * ch);
    buf.fill(BG);
    const s = new BufferSurface(buf);
    cells.forEach((c, k) => {
      const sheet = getSprite(c.id);
      const a = sheet.animations[c.anim];
      const dur = a.frames.length / a.fps;
      const time = a.loop ? t : t % (dur + 0.5);
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * ch;
      buf.rect(x + 2, y + 2, cw - 4, ch - 4, "#241a40");
      buf.blit(frameAt(a, time), x + (cw - sheet.width) / 2, y + 4 + (ch - 14 - sheet.height));
      const label = c.anim.toUpperCase();
      drawText(s, label, x + (cw - textWidth(label)) / 2, y + ch - 9, "#f2c55c");
    });
    frames.push(buf.scaled(scale));
  }
  return frames;
}

// 1. PNG sprite sheets
for (const id of SPRITE_IDS) writePng(sheetToBuffer(getSprite(id), BG).scaled(3), path.join(OUT, `sheet-${id}.png`));

// 2. Animated showcases
const heroAnims = Object.keys(getSprite("heroine").animations).map((anim) => ({ id: "heroine" as SpriteId, anim }));
writeGif("heroine.gif", showcase(heroAnims, 5, 3, 4), 12);
const bestiary = (["fox", "wolf", "jiangshi", "serpent", "patriarch"] as SpriteId[]).flatMap((id) =>
  ["idle", "attack", "hurt"].filter((a) => getSprite(id).animations[a]).map((anim) => ({ id, anim })),
);
writeGif("bestiary.gif", showcase(bestiary, 6, 2, 4), 12);
const cast = [
  { id: "elder" as SpriteId, anim: "idle" },
  { id: "elder" as SpriteId, anim: "talk" },
  { id: "elder" as SpriteId, anim: "bless" },
  { id: "sister" as SpriteId, anim: "idle" },
  { id: "sister" as SpriteId, anim: "talk" },
  { id: "spiritSword" as SpriteId, anim: "hover" },
];
writeGif("npcs.gif", showcase(cast, 6, 3, 3), 12);
const objects = (["shrine", "moonGate", "herb", "lotus", "lantern", "crane", "qiOrb"] as SpriteId[]).map((id) => ({ id, anim: Object.keys(getSprite(id).animations)[0] }));
writeGif("objects.gif", showcase(objects, 7, 3, 3), 12);

// 3. Scenes (stills + short animated loops)
for (const id of SCENE_IDS) {
  writePng(renderSceneFrame(id, 1.2, 0).scaled(3), path.join(OUT, `scene-${id}.png`));
  const frames = Array.from({ length: 36 }, (_, i) => renderSceneFrame(id, 1 + i / 12, i * 2).scaled(2));
  writeGif(`scene-${id}.gif`, frames, 12);
}
const title = Array.from({ length: 48 }, (_, i) => {
  const b = new PixelBuffer(SCREEN_W, SCREEN_H);
  renderTitle(new BufferSurface(b), 2 + i / 12);
  return b.scaled(2);
});
writeGif("title.gif", title, 12);

console.log(`Exported art to ${path.relative(process.cwd(), OUT)}`);
