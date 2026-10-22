import { describe, expect, it } from "vitest";
import { getSprite, SPRITE_GROUPS, SPRITE_IDS, frameAt } from "@/game/sprites";
import { buildHeroine } from "@/game/sprites/heroine";

describe("sprite sheets", () => {
  it.each(SPRITE_IDS)("%s has consistent, non-empty frames", (id) => {
    const sheet = getSprite(id);
    const anims = Object.entries(sheet.animations);
    expect(anims.length).toBeGreaterThan(0);
    for (const [, anim] of anims) {
      expect(anim.fps).toBeGreaterThan(0);
      expect(anim.frames.length).toBeGreaterThan(0);
      for (const f of anim.frames) {
        expect(f.width).toBe(sheet.width);
        expect(f.height).toBe(sheet.height);
        expect(f.opaqueCount()).toBeGreaterThan(20);
      }
    }
  });

  it("gives the heroine a full move set", () => {
    const h = getSprite("heroine");
    expect(Object.keys(h.animations)).toEqual(expect.arrayContaining(["idle", "walk", "jump", "attack", "cast", "meditate", "hurt", "victory", "fly", "defeat"]));
    // frames within an animation actually differ (it animates)
    const idle = h.animations.idle.frames;
    expect(Buffer.from(idle[0].data).equals(Buffer.from(idle[4].data))).toBe(false);
  });

  it("paints deterministically", () => {
    const a = buildHeroine().animations.walk.frames[3];
    const b = buildHeroine().animations.walk.frames[3];
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
  });

  it("loops or holds frames by time", () => {
    const attack = getSprite("heroine").animations.attack;
    expect(frameAt(attack, 999)).toBe(attack.frames[attack.frames.length - 1]);
    const idle = getSprite("heroine").animations.idle;
    expect(frameAt(idle, 1 / idle.fps)).toBe(idle.frames[1]);
    expect(frameAt(idle, idle.frames.length / idle.fps)).toBe(idle.frames[0]);
  });

  it("groups every sprite exactly once in the gallery", () => {
    const grouped = SPRITE_GROUPS.flatMap((g) => g.ids).sort();
    expect(grouped).toEqual([...SPRITE_IDS].sort());
  });
});
