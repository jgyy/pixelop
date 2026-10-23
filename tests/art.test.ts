import { describe, expect, it } from "vitest";
import { CHAR_IDS, charDef, DIRS, dirFromWorld, getAnim, getPortrait, HUMAN_IDS, PORTRAIT, STYLES } from "@/game/art/characters";
import { paintHuman } from "@/game/art/humanoid";
import { getProp, getPropScaled, glowSprite, PROP_IDS, propDef } from "@/game/art/props";
import { foamOverlay, LIQUID_FRAMES, liquidFrame, paintTile } from "@/game/art/tiles";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { BufferSurface } from "@/game/pixel/surface";
import { drawSky } from "@/game/art/sky";
import { TileMap } from "@/game/world/tilemap";

describe("characters", () => {
  it("every character paints every animation in several directions", () => {
    for (const id of CHAR_IDS) {
      const def = charDef(id);
      for (const anim of def.anims)
        for (const dir of [0, 5, 11]) {
          const a = getAnim(id, anim, dir);
          expect(a.frames.length).toBeGreaterThan(0);
          for (const f of a.frames) {
            expect(f.width).toBe(def.w);
            expect(f.height).toBe(def.h);
            expect(f.opaqueCount()).toBeGreaterThan(40);
          }
        }
    }
  }, 60_000);

  it("renders all 16 facings of the heroine differently", () => {
    const frames = Array.from({ length: DIRS }, (_, d) => getAnim("heroine", "idle", d).frames[0]);
    const keys = new Set(frames.map((f) => Buffer.from(f.data).toString("base64")));
    expect(keys.size).toBe(DIRS);
  });

  it("is deterministic", () => {
    const a = paintHuman(STYLES.elder, { t: 1.2 }, 0.7);
    const b = paintHuman(STYLES.elder, { t: 1.2 }, 0.7);
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  it("maps world movement to facing indices", () => {
    expect(dirFromWorld(1, 1)).toBe(0); // toward the viewer
    expect(dirFromWorld(1, -1)).toBe(4); // screen right
    expect(dirFromWorld(-1, -1)).toBe(8); // away
    expect(dirFromWorld(-1, 1)).toBe(12); // screen left
  });

  it("paints dialogue portraits with blink and talk frames", () => {
    for (const id of HUMAN_IDS.filter((h) => charDef(h).portrait)) {
      const p = getPortrait(id);
      expect(p).toHaveLength(3);
      expect(p[0].width).toBe(PORTRAIT);
      expect(p[0].opaqueCount()).toBeGreaterThan(1500);
      expect(Buffer.from(p[0].data).equals(Buffer.from(p[1].data))).toBe(false);
    }
  });
});

describe("props", () => {
  it("every prop paints, crops and animates", () => {
    for (const id of PROP_IDS) {
      const sheet = getProp(id);
      const def = propDef(id);
      expect(sheet.frames).toHaveLength(def.frames);
      expect(sheet.frames[0].opaqueCount()).toBeGreaterThan(30);
      // the anchor sits within a tile's width of the art (wall-hung props hang off to one side of it)
      expect(sheet.ox).toBeGreaterThan(-16);
      expect(sheet.ox).toBeLessThan(sheet.frames[0].width + 16);
      if (def.frames > 1 && id !== "chest") expect(Buffer.from(sheet.frames[0].data).equals(Buffer.from(sheet.frames[1].data))).toBe(false);
    }
    expect(getPropScaled("hall", 0.3).frames[0].opaqueCount()).toBeGreaterThan(100);
    expect(glowSprite("#ffd070", 20).opaqueCount()).toBeGreaterThan(100);
  });
});

describe("terrain", () => {
  it("paints tile columns with tops, walls and shore foam", () => {
    const m = new TileMap(4, 4, "grass", 2);
    m.set(1, 1, "water", 1);
    m.set(3, 3, "plaza", 4);
    const col = paintTile(m, 3, 3, 0, 1, false);
    expect(col.buf.height).toBe(16 + 4 * 8 + 2 + 1);
    expect(col.buf.alphaAt(16, 2)).toBe(255);
    expect(col.buf.alphaAt(16, 30)).toBe(255);
    expect(foamOverlay(m, 1, 1)!.opaqueCount()).toBeGreaterThan(20);
    expect(foamOverlay(m, 0, 0)).toBeNull();
    const f0 = liquidFrame("water", 0);
    const f1 = liquidFrame("water", LIQUID_FRAMES / 2);
    expect(Buffer.from(f0.data).equals(Buffer.from(f1.data))).toBe(false);
  });

  it("paints every sky fully opaque", () => {
    for (const sky of ["day", "dusk", "forest", "night", "blood", "storm", "interior"] as const) {
      const b = new PixelBuffer(160, 90);
      drawSky(new BufferSurface(b), sky, 1.5, 0, 0);
      expect(b.opaqueCount()).toBe(160 * 90);
    }
  });
});
