/**
 * Export the procedural art as PNG stills and animated GIF showcases into
 * docs/art (used by the README and PR). Run: `npm run assets [outDir]`.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { PixelBuffer } from "../src/game/pixel/PixelBuffer";
import { drawText, textWidth } from "../src/game/pixel/font";
import { BufferSurface } from "../src/game/pixel/surface";
import { BEAST_IDS, charDef, DIRS, frameAt, getAnim, getPortrait, HUMAN_IDS, PORTRAIT, type AnimId, type CharId } from "../src/game/art/characters";
import { getProp, PROP_IDS } from "../src/game/art/props";
import { World } from "../src/game/runtime/world";
import { WorldMap } from "../src/game/runtime/worldmap";
import { renderTitle } from "../src/game/runtime/title";
import { AREA_IDS, getArea } from "../src/game/world/areas";
import { writePng } from "./lib";

const OUT = path.resolve(process.argv[2] ?? "docs/art");
const QUICK = process.argv.includes("--quick");
mkdirSync(OUT, { recursive: true });
const BG = "#2a2048";
const CELL_BG = "#241a40";

function writeGif(file: string, frames: PixelBuffer[], fps: number): void {
  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    gif.writeFrame(applyPalette(f.data, palette), f.width, f.height, { palette, delay: Math.round(1000 / fps) });
  }
  gif.finish();
  writeFileSync(path.join(OUT, file), gif.bytes());
}

interface Cell {
  id: CharId;
  anim: AnimId;
  dir: number | "spin";
  label: string;
}

/** Grid of labelled animation cells, all playing in sync. */
function showcase(cells: Cell[], cols: number, scale: number, seconds: number, fps = 12): PixelBuffer[] {
  const cw = Math.max(...cells.map((c) => charDef(c.id).w)) + 4;
  const ch = Math.max(...cells.map((c) => charDef(c.id).h)) + 10;
  const rows = Math.ceil(cells.length / cols);
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const t = i / fps;
    const buf = new PixelBuffer(cols * cw, rows * ch);
    buf.fill(BG);
    const s = new BufferSurface(buf);
    cells.forEach((c, k) => {
      const def = charDef(c.id);
      const dir = c.dir === "spin" ? Math.floor(t * 4) % DIRS : c.dir;
      const a = getAnim(c.id, c.anim, dir);
      const dur = a.frames.length / a.fps;
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * ch;
      buf.rect(x + 1, y + 1, cw - 2, ch - 2, CELL_BG);
      buf.blit(frameAt(a, a.loop ? t : t % (dur + 0.5)), x + (cw - def.w) / 2, y + 2 + (ch - 10 - def.h));
      const label = c.label.toUpperCase();
      drawText(s, label, x + (cw - textWidth(label)) / 2, y + ch - 7, "#f2c55c");
    });
    frames.push(buf.scaled(scale));
  }
  return frames;
}

const seconds = QUICK ? 1 : 4;

// 1. Characters
const heroAnims = charDef("heroine").anims.map((anim): Cell => ({ id: "heroine", anim, dir: 2, label: anim }));
writeGif("heroine-moves.gif", showcase(heroAnims, 6, 2, seconds), 12);
const turntable = Array.from({ length: DIRS }, (_, d): Cell => ({ id: "heroine", anim: "walk", dir: d, label: `dir ${d}` }));
writeGif("heroine-16dir.gif", showcase(turntable, 8, 2, QUICK ? 1 : 2), 12);
const cast = HUMAN_IDS.filter((id) => id !== "heroine").map((id): Cell => ({ id, anim: charDef(id).anims.includes("walk") ? "walk" : charDef(id).anims.includes("hop") ? "hop" : "idle", dir: "spin", label: charDef(id).name.split(" ").pop()! }));
writeGif("cast.gif", showcase(cast, 7, 2, seconds), 12);
const bestiary = BEAST_IDS.flatMap((id) => charDef(id).anims.filter((a) => a !== "walk").map((anim): Cell => ({ id, anim, dir: 2, label: `${id} ${anim}` })));
writeGif("bestiary.gif", showcase(bestiary, 6, 2, seconds), 12);

// 2. Portraits
const portraitIds = HUMAN_IDS.filter((id) => charDef(id).portrait);
const pb = new PixelBuffer(portraitIds.length * (PORTRAIT + 4), PORTRAIT + 4);
pb.fill(BG);
portraitIds.forEach((id, i) => {
  pb.rect(i * (PORTRAIT + 4) + 2, 2, PORTRAIT, PORTRAIT, CELL_BG);
  pb.blit(getPortrait(id)[0], i * (PORTRAIT + 4) + 2, 2);
});
writePng(pb.scaled(2), path.join(OUT, "portraits.png"));

// 3. Props
{
  const sheets = PROP_IDS.map((id) => ({ id, sheet: getProp(id) }));
  const cols = 8;
  const cw = 132;
  const ch = 140;
  const rows = Math.ceil(sheets.length / cols);
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    const t = i / 10;
    const buf = new PixelBuffer(cols * cw, rows * ch);
    buf.fill(BG);
    const s = new BufferSurface(buf);
    sheets.forEach(({ id, sheet }, k) => {
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * ch;
      buf.rect(x + 1, y + 1, cw - 2, ch - 2, CELL_BG);
      const fr = sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length];
      const k2 = fr.width > cw - 4 || fr.height > ch - 14 ? 0.5 : 1;
      const img = k2 < 1 ? half(fr) : fr;
      buf.blit(img, x + cw / 2 - sheet.ox * k2, y + ch - 14 - Math.max(0, img.height - sheet.oy * k2) - sheet.oy * k2 + Math.min(0, 0));
      const label = id.toUpperCase();
      drawText(s, label, x + (cw - textWidth(label)) / 2, y + ch - 9, "#f2c55c");
    });
    frames.push(buf);
  }
  writeGif("props.gif", frames, 10);
}

function half(b: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(Math.ceil(b.width / 2), Math.ceil(b.height / 2));
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const i = (y * 2 * b.width + x * 2) * 4;
      out.data.set(b.data.subarray(i, i + 4), (y * out.width + x) * 4);
    }
  return out;
}

// 4. Regions (stills + panning loops)
const W = 480;
const H = 270;
for (const id of AREA_IDS) {
  const area = getArea(id);
  const world = new World(id, { x: area.arrive[0], y: area.arrive[1] - 6, dir: 8 }, { metElder: true, foxesCleared: true, metWen: true }, [], new Set());
  const frame = (t: number) => {
    const b = new PixelBuffer(W, H);
    world.update(1 / 12, t, true);
    const k = Math.sin(t * 0.25);
    world.updateCamera(W, H, 0, [area.map.w / 2 + k * 3, area.map.h / 2 - k * 2, 2]);
    world.render(new BufferSurface(b), t);
    return b;
  };
  writePng(frame(1.2).scaled(2), path.join(OUT, `area-${id}.png`));
  if (!QUICK) writeGif(`area-${id}.gif`, Array.from({ length: 36 }, (_, i) => frame(1 + i / 12)), 12);
}

// 5. World map
{
  const wm = new WorldMap("village");
  const frames: PixelBuffer[] = [];
  wm.travelTo("sect", () => true);
  for (let i = 0; i < (QUICK ? 6 : 60); i++) {
    const b = new PixelBuffer(W, H);
    wm.update(1 / 12);
    wm.render(new BufferSurface(b), i / 12, () => true, 1 / 12);
    frames.push(b);
  }
  writePng(frames[frames.length - 1].scaled(2), path.join(OUT, "worldmap.png"));
  writeGif("worldmap.gif", frames, 12);
}

// 6. Title attract mode
writeGif(
  "title.gif",
  Array.from({ length: QUICK ? 4 : 36 }, (_, i) => {
    const b = new PixelBuffer(W, H);
    renderTitle(new BufferSurface(b), 2 + i / 12);
    return b;
  }),
  12,
);

console.log(`Exported art to ${path.relative(process.cwd(), OUT) || "."}`);
