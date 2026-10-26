import { describe, expect, it } from "vitest";
import { addCultivation, atBottleneck, breakthrough, cultivationNeeded, levelIndex, realmLabel, REALMS, statsFor } from "@/game/engine/realms";
import { mitigate, resolveTurn, reviveAtSect, SKILLS, startBattle } from "@/game/engine/battle";
import { toWorld } from "@/game/world/layout";
import { applyBreakthrough, buyPill, consumePill, GameStateSchema, gainCultivation, newGame, PILL_PRICE, SKILL_IDS, stats } from "@/game/engine/state";
import { ENEMIES } from "@/game/engine/enemies";

describe("realms", () => {
  it("requires more cultivation at each level", () => {
    let prev = 0;
    for (let r = 0; r < REALMS.length - 1; r++)
      for (let s = 0; s < REALMS[r].stages; s++) {
        const need = cultivationNeeded(r, s);
        expect(need).toBeGreaterThan(prev);
        prev = need;
      }
  });

  it("advances stages automatically and caps at the bottleneck", () => {
    const p = addCultivation({ realm: 0, stage: 0, cultivation: 0 }, 100_000);
    expect(p.realm).toBe(0);
    expect(p.stage).toBe(3);
    expect(p.cultivation).toBe(cultivationNeeded(0, 3));
    expect(p.stagesGained).toBe(3);
    expect(atBottleneck(p)).toBe(true);
    expect(breakthrough(p)).toEqual({ realm: 1, stage: 0, cultivation: 0 });
  });

  it("refuses to break through before the peak", () => {
    const p = { realm: 0, stage: 1, cultivation: 5 };
    expect(atBottleneck(p)).toBe(false);
    expect(breakthrough(p)).toBe(p);
  });

  it("scales stats with level and labels realms", () => {
    expect(statsFor(1, 0).atk).toBeGreaterThan(statsFor(0, 3).atk);
    expect(levelIndex(2, 1)).toBe(9);
    expect(realmLabel(1, 2)).toBe("Foundation Establishment · Late");
    expect(realmLabel(5, 0)).toBe("Immortal Ascension");
  });
});

describe("game state", () => {
  it("creates a valid new game", () => {
    const g = newGame();
    expect(GameStateSchema.parse(g)).toEqual(g);
    expect(g.hp).toBe(stats(g).maxHp);
  });

  it("migrates version 2 saves (one map per region) into world coordinates", () => {
    const old = { ...newGame(), version: 2, area: "village", x: 16.5, y: 29.5 };
    const g = GameStateSchema.parse(old);
    expect(g.version).toBe(5);
    expect([g.x, g.y]).toEqual(toWorld("village", 16.5, 29.5));
    expect(GameStateSchema.safeParse({ ...newGame(), version: 1 }).success).toBe(false);
  });

  it("migrates version 3 saves from the smaller world, keeping the spot relative to its region", () => {
    // Willow Creek's square in the old 162 × 116 world, and a spot on the old highway
    const square = GameStateSchema.parse({ ...newGame(), version: 3, area: "village", x: 84 + 16.5, y: 66 + 10.5 });
    expect(square.version).toBe(5);
    expect([square.x, square.y]).toEqual(toWorld("village", 16.5, 10.5));
    expect(square.area).toBe("village");
    const lake = GameStateSchema.parse({ ...newGame(), version: 3, area: "lake", x: 124 + 3.5, y: 66 + 28.5 });
    expect([lake.x, lake.y]).toEqual(toWorld("lake", 3.5, 28.5));
    const road = GameStateSchema.parse({ ...newGame(), version: 3, area: "village", x: 100.5, y: 103.5 });
    expect(road.area).toBe("village");
  });

  it("migrates version 4 saves into the doubled world, at the same spot", () => {
    // Willow Creek's square on the version 4 map (the authoring grid)
    const v4 = GameStateSchema.parse({ ...newGame(), version: 4, area: "village", x: 176 + 16.5, y: 98 + 10.5 });
    expect(v4.version).toBe(5);
    expect([v4.x, v4.y]).toEqual(toWorld("village", 16.5, 10.5));
    expect(v4.area).toBe("village");
  });

  it("restores vitals on stage-up and breakthrough", () => {
    const g = { ...newGame(), hp: 1 };
    const { state, stagesGained } = gainCultivation(g, cultivationNeeded(0, 0));
    expect(stagesGained).toBe(1);
    expect(state.hp).toBe(stats(state).maxHp);
    const peak = { ...newGame(), stage: 3, cultivation: cultivationNeeded(0, 3), hp: 3 };
    const up = applyBreakthrough(peak);
    expect(up.realm).toBe(1);
    expect(up.hp).toBe(stats(up).maxHp);
  });

  it("learns Nine Heavens Thunder on reaching Core Formation", () => {
    const peak = { ...newGame(), realm: 1, stage: 3, cultivation: cultivationNeeded(1, 3) };
    expect(applyBreakthrough(peak).skills).toContain("thunder");
    expect(newGame().skills).not.toContain("thunder");
  });

  it("buys and consumes pills", () => {
    const g = { ...newGame(), stones: PILL_PRICE, hp: 10 };
    const bought = buyPill(g, "heal")!;
    expect(bought.stones).toBe(0);
    expect(bought.pills.heal).toBe(g.pills.heal + 1);
    expect(buyPill(bought, "heal")).toBeNull();
    const healed = consumePill(bought, "heal")!;
    expect(healed.hp).toBeGreaterThan(10);
    expect(consumePill({ ...g, pills: { heal: 0, qi: 0 } }, "qi")).toBeNull();
  });

  it("never wastes a pill on a heroine who is already whole (in the field or in battle)", () => {
    const g = newGame();
    expect(consumePill(g, "heal")).toBeNull();
    expect(consumePill(g, "qi")).toBeNull();
    const b = startBattle("fox", 7);
    const r = resolveTurn(g, b, { type: "item", item: "heal" });
    expect(r.events[0].kind).toBe("rejected");
    expect(r.game.pills.heal).toBe(g.pills.heal);
    expect(r.battle.turn).toBe(0);
  });
});

describe("battle", () => {
  const strong = () => ({ ...newGame(), realm: 3, stage: 0, hp: statsFor(3, 0).maxHp, qi: statsFor(3, 0).maxQi, skills: [...SKILL_IDS] });

  it("mitigates damage with diminishing returns", () => {
    expect(mitigate(100, 0)).toBe(100);
    expect(mitigate(100, 100)).toBe(25);
    expect(mitigate(0.1, 50)).toBe(1);
  });

  it("is deterministic for the same seed", () => {
    const g = newGame();
    const a = resolveTurn(g, startBattle("fox", 7), { type: "skill", skill: "strike" });
    const b = resolveTurn(g, startBattle("fox", 7), { type: "skill", skill: "strike" });
    expect(a).toEqual(b);
  });

  it("rejects techniques that have not been learned", () => {
    const r = resolveTurn(newGame(), startBattle("fox", 1), { type: "skill", skill: "swords" });
    expect(r.events[0]).toMatchObject({ kind: "rejected", reason: expect.stringMatching(/not learned/) });
  });

  it("rejects skills without enough qi", () => {
    const g = { ...newGame(), qi: 0, skills: [...SKILL_IDS] };
    const r = resolveTurn(g, startBattle("fox", 1), { type: "skill", skill: "swords" });
    expect(r.events[0].kind).toBe("rejected");
    expect(r.game).toBe(g);
  });

  it("lets a strong cultivator win and collect rewards", () => {
    const g = strong();
    let b = startBattle("fox", 3);
    let state = g;
    for (let i = 0; i < 10 && b.phase === "active"; i++) {
      const r = resolveTurn(state, b, { type: "skill", skill: "swords" });
      state = r.game;
      b = r.battle;
    }
    expect(b.phase).toBe("won");
    expect(state.stones).toBe(g.stones + ENEMIES.fox.stones);
    expect(state.kills).toBe(1);
  });

  it("multi-hit skills report every hit and spend qi", () => {
    const g = strong();
    const r = resolveTurn(g, startBattle("patriarch", 11), { type: "skill", skill: "swords" });
    const ev = r.events.find((e) => e.kind === "playerSkill");
    expect(ev && ev.kind === "playerSkill" && ev.hits.length).toBe(3);
    expect(r.game.qi).toBeLessThanOrEqual(g.qi - SKILLS.swords.qi);
  });

  it("enemies use their special every few turns", () => {
    let g = strong();
    let b = startBattle("patriarch", 5);
    const moves: string[] = [];
    for (let i = 0; i < 3; i++) {
      const r = resolveTurn(g, b, { type: "skill", skill: "lotus" });
      g = { ...r.game, qi: statsFor(3, 0).maxQi };
      b = r.battle;
      const e = r.events.find((x) => x.kind === "enemyAttack");
      if (e && e.kind === "enemyAttack") moves.push(e.move);
    }
    expect(moves[2]).toBe(ENEMIES.patriarch.special.name);
  });

  it("cannot flee from a boss and handles defeat", () => {
    const g = { ...newGame(), hp: 1 };
    const r = resolveTurn(g, startBattle("patriarch", 9), { type: "flee" });
    expect(r.events[0]).toEqual({ kind: "flee", success: false });
    expect(r.battle.phase).toBe("lost");
    const revived = reviveAtSect(r.game);
    expect(revived.area).toBe("sect");
    expect(revived.hp).toBeGreaterThan(0);
  });

  it("refuses to act once the battle is over", () => {
    const b = { ...startBattle("fox", 1), phase: "won" as const };
    expect(resolveTurn(newGame(), b, { type: "flee" }).events[0].kind).toBe("rejected");
  });

  it("keeps version 5 saves where they were when the world doubled again, and accepts spots in the new lands", () => {
    const old = GameStateSchema.parse({ ...newGame(), area: "village", x: (176 + 16.5) * 2, y: (98 + 10.5) * 2 });
    expect([old.x, old.y]).toEqual(toWorld("village", 16.5, 10.5));
    const harbour = GameStateSchema.safeParse({ ...newGame(), area: "harbor", ...Object.fromEntries(["x", "y"].map((k, n) => [k, toWorld("harbor", 10, 16)[n]])) });
    expect(harbour.success).toBe(true);
  });
});
