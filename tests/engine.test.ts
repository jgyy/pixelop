import { describe, expect, it } from "vitest";
import { addCultivation, atBottleneck, breakthrough, cultivationNeeded, levelIndex, realmLabel, REALMS, statsFor } from "@/game/engine/realms";
import { mitigate, resolveTurn, reviveAtSect, SKILLS, startBattle } from "@/game/engine/battle";
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
});
