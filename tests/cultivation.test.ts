import { describe, expect, it } from "vitest";
import { cultivationNeeded, statsFor } from "@/game/engine/realms";
import { consumePill, newGame, stats, type GameState } from "@/game/engine/state";
import { walkDao } from "@/game/engine/dao";
import { boltDamage, breathGain, CULT, cultivationRate, DEVIATION_AT, failTribulation, foundationWound, heartDemons, insight, insightNeeded, passTribulation, shift, tendBreath, toxicity, tribulationBlock } from "@/game/engine/cultivation";
import { conditionAside, heartDemonTrial, pointerAside, realmAside, trialDue } from "@/game/story/cultivation";
import { townNpcScript } from "@/game/story/town";
import { tideNpcScript } from "@/game/story/tide";
import { roadNpcScript } from "@/game/story/road";
import { hallsNpcScript } from "@/game/story/halls";
import { crowdNpcScript } from "@/game/story/crowd";
import { getWorld } from "@/game/world/continent";
import { Game } from "@/game/runtime/Game";
import type { Choice, Step } from "@/game/story/script";

const at = (realm: number, stage = 3): GameState => ({ ...newGame(), realm, stage, cultivation: cultivationNeeded(realm, stage), hp: statsFor(realm, stage).maxHp });

describe("cultivation's toll", () => {
  it("makes every realm steeper than the last", () => {
    expect(cultivationNeeded(0, 0)).toBe(30);
    // the same level costs more the higher the realm it sits in
    expect(cultivationNeeded(2, 0) / cultivationNeeded(1, 3)).toBeGreaterThan(1.2);
  });

  it("leaves pill poison behind, which leaks qi away and, past its limit, sets the qi running wild", () => {
    const g = { ...newGame(), hp: 10 };
    const after = consumePill(g, "heal")!;
    expect(toxicity(after)).toBeGreaterThan(0);
    expect(cultivationRate(shift(g, CULT.tox, 60))).toBeLessThan(cultivationRate(g));
    const poisoned = shift(at(1), CULT.tox, DEVIATION_AT);
    const r = tendBreath(poisoned, stats(poisoned));
    expect(r.deviation).toBe(true);
    expect(r.state.hp).toBeLessThan(poisoned.hp);
    expect(heartDemons(r.state)).toBeGreaterThan(0);
    expect(toxicity(r.state)).toBeLessThan(DEVIATION_AT);
    // a clean breath burns off a little poison and knits the cracks
    const cracked = shift(shift(at(1), CULT.tox, 20), CULT.wound, 10);
    const t = tendBreath(cracked, stats(cracked));
    expect(t.deviation).toBe(false);
    expect(toxicity(t.state)).toBeLessThan(20);
    expect(foundationWound(t.state)).toBe(9);
  });

  it("thins the qi of a long sitting", () => {
    const g = at(1, 0);
    expect(breathGain(g, "sect", 80)).toBeLessThan(breathGain(g, "sect", 0));
    expect(breathGain(g, "peak", 0)).toBeGreaterThan(breathGain(g, "valley", 0));
  });

  it("asks for insight from Foundation Establishment on, and refuses a cracked foundation", () => {
    expect(tribulationBlock(at(0))).toBeNull();
    expect(tribulationBlock(at(1))).toMatch(/insight 0\/2/);
    const ready = shift(at(1), CULT.insight, insightNeeded(1));
    expect(tribulationBlock(ready)).toBeNull();
    expect(tribulationBlock(shift(ready, CULT.wound, 10))).toMatch(/cracked/);
    expect(tribulationBlock({ ...ready, cultivation: 0 })).toMatch(/not yet reached/);
  });

  it("lets a clean cultivator survive her first tribulation, and lightning find the demons in a troubled one", () => {
    const g = at(0);
    const s = stats(g);
    expect(boltDamage(g, s, false) * 3).toBeLessThan(s.maxHp);
    const troubled = shift(shift(g, CULT.demon, 40), CULT.tox, 40);
    expect(boltDamage(troubled, s, false) * 3).toBeGreaterThan(s.maxHp);
    // compassion turns a little of it aside; slaughter draws it
    const mercy = walkDao(g, "mercy", 30);
    const slaughter = walkDao(g, "slaughter", 30);
    expect(boltDamage(mercy, s, false)).toBeLessThan(boltDamage(slaughter, s, false));
  });

  it("scatters her qi and cracks her foundation when she fails, and burns her clean when she passes", () => {
    const g = shift(at(2), CULT.insight, 3);
    const f = failTribulation(g, stats(g));
    expect(f.realm).toBe(2);
    expect(f.cultivation).toBeLessThan(g.cultivation);
    expect(foundationWound(f)).toBeGreaterThan(0);
    expect(f.counters[CULT.fails]).toBe(1);
    expect(insight(f)).toBe(2);
    const p = passTribulation(shift(shift(g, CULT.tox, 50), CULT.demon, 50));
    expect(toxicity(p)).toBe(0);
    expect(heartDemons(p)).toBe(20);
    expect(insight(p)).toBe(0);
  });

  it("lets slaughter feed her heart demons and compassion starve them", () => {
    const g = walkDao(newGame(), "slaughter", 5);
    expect(heartDemons(g)).toBe(15);
    expect(heartDemons(walkDao(g, "mercy", 3))).toBe(9);
  });
});

describe("the jianghu answers her cultivation", () => {
  it("has the people who know her speak of each new realm once", () => {
    const g = at(2, 0);
    const steps = realmAside("elder", g)!;
    expect(steps.some((s) => "say" in s && /golden core/i.test(s.text))).toBe(true);
    const seen = steps.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);
    expect(realmAside("elder", seen)).toBeNull();
    expect(realmAside("elder", newGame())).toBeNull();
  });

  it("gives a master's pointer, worth insight, to a cultivator stuck at a bottleneck", () => {
    const g = at(1);
    const steps = pointerAside("xuan", g)!;
    const after = steps.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);
    expect(insight(after)).toBe(1);
    expect(pointerAside("xuan", after)).toBeNull();
    expect(pointerAside("xuan", at(1, 0))).toBeNull();
  });

  it("has the monks quiet her demons and the herbalists draw out her poison", () => {
    const g = shift(shift(at(1), CULT.demon, 50), CULT.tox, 60);
    const calm = conditionAside("xuan", g)!.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);
    expect(heartDemons(calm)).toBe(20);
    const clean = conditionAside("baizhi", g)!.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);
    expect(toxicity(clean)).toBe(10);
  });

  it("tests her heart before heaven tests her body: her Dao's answer starves the demon, any other feeds it", () => {
    const g = shift(walkDao(at(1), "sword", 5), CULT.demon, 10);
    expect(trialDue(g)).toBe(true);
    expect(trialDue(at(0))).toBe(false);
    const steps = heartDemonTrial(g, [10, 10]);
    expect(steps[steps.length - 1]).toEqual({ tribulation: true });
    const choice = steps.find((s): s is Extract<Step, { choose: Choice[] }> => "choose" in s)!;
    const run = (label: string) => choice.choose.find((c) => c.label === label)!.then.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);
    expect(heartDemons(run("Cut it down"))).toBe(0);
    expect(run("Cut it down").flags["demonTrial:1"]).toBe(true);
    expect(heartDemons(run("Devour it"))).toBe(30);
  });

  it("has Jinhe's folk speak to her realm, her failures and her poison", () => {
    const low = townNpcScript("rival", newGame())!;
    const high = townNpcScript("rival", at(2, 0))!;
    expect(low.some((s) => "say" in s && /cultivate/.test(s.text))).toBe(true);
    expect(high.some((s) => "choose" in s)).toBe(true);
    expect(townNpcScript("alchemist", shift(newGame(), CULT.tox, 70))!.some((s) => "shop" in s)).toBe(false);
    expect(townNpcScript("alchemist", newGame())!.some((s) => "shop" in s)).toBe(true);
    const failed = failTribulation(at(1), stats(at(1)));
    expect(townNpcScript("fortune", failed)!.some((s) => "say" in s && /threw you down/.test(s.text))).toBe(true);
    // every townsperson of the new lands has something of their own to say
    for (const n of getWorld().npcs.filter((x) => x.j > 464 * 2)) expect(townNpcScript(n.key, newGame()) ?? tideNpcScript(n.key, newGame()) ?? roadNpcScript(n.key, newGame()) ?? hallsNpcScript(n.key, newGame()) ?? crowdNpcScript(n.key, newGame()), n.key).not.toBeNull();
  });
});

describe("the tribulation in play", () => {
  const fresh = () => {
    const g = new Game(newGame(), { seed: 1 });
    g.debugSkipTime(0.2);
    return g;
  };
  const standByShrine = (game: Game) => {
    const s = getWorld().interacts.find((x) => x.key === "sect-shrine")!;
    for (const [di, dj] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ])
      if (getWorld().map.standable(s.i + di, s.j + dj)) {
        game.debugGoto(s.i + di + 0.5, s.j + dj + 0.5);
        return;
      }
  };

  it("throws a wounded, poisoned cultivator down, cracks her foundation and refuses her until it mends", () => {
    const game = fresh();
    standByShrine(game);
    game.debugPatch({ stage: 3, cultivation: cultivationNeeded(0, 3), hp: 30, counters: { [CULT.tox]: 40 } });
    game.keyDown("KeyB");
    game.keyUp("KeyB");
    expect(game.mode).toBe("tribulation");
    game.debugSkipTime(8);
    expect(game.mode).toBe("explore");
    expect(game.state.realm).toBe(0);
    expect(foundationWound(game.state)).toBeGreaterThan(0);
    expect(game.state.counters[CULT.fails]).toBe(1);
    // even with her qi full again, heaven will not test a cracked vessel
    game.debugPatch({ cultivation: cultivationNeeded(0, 3) });
    game.keyDown("KeyB");
    game.keyUp("KeyB");
    expect(game.mode).toBe("explore");
    expect(game.snapshot().toasts.some((t) => /cracked/.test(t.text))).toBe(true);
    expect(game.snapshot().condition.label).toMatch(/Cracked foundation/);
  });

  it("puts the heart demon trial before a Foundation cultivator's tribulation", () => {
    const game = fresh();
    standByShrine(game);
    game.debugPatch({ realm: 1, stage: 3, cultivation: cultivationNeeded(1, 3), hp: statsFor(1, 3).maxHp, counters: { [CULT.insight]: 2 } });
    game.keyDown("KeyB");
    game.keyUp("KeyB");
    expect(game.mode).toBe("scene");
    for (let k = 0; k < 12 && !game.snapshot().choice; k++) {
      game.keyDown("Enter");
      game.keyUp("Enter");
      game.debugSkipTime(0.4);
    }
    expect(game.snapshot().choice?.options.map((o) => o.label)).toContain("Let it pass");
    game.choose(2);
    for (let k = 0; k < 12 && game.mode === "scene"; k++) {
      game.keyDown("Enter");
      game.keyUp("Enter");
      game.debugSkipTime(0.4);
    }
    expect(game.mode).toBe("tribulation");
    game.debugSkipTime(10);
    expect(game.state.realm).toBe(2);
    expect(insight(game.state)).toBe(0);
  });
});
