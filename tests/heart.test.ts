import { describe, expect, it } from "vitest";
import { cultivationNeeded, FINAL_REALM } from "@/game/engine/realms";
import { openingWound, startBattle } from "@/game/engine/battle";
import { ENEMIES } from "@/game/engine/enemies";
import { type GameState } from "@/game/engine/state";
import type { Step } from "@/game/story/script";
import { altarScript, areaUnlocked, endingScript, hasNews, introScript, lockReason, npcScript, preBattleScript, questLog, victoryScript } from "@/game/story/story";
import { canRedeemXue, crimsonPath, ENDING_IDS, ENDINGS, endingOf, heartFate } from "@/game/story/heart";
import { newGameAs, ORIGIN_IDS, originOf } from "@/game/story/origins";
import { ATTIRE, ATTIRE_HINT, currentAttire, hasAttire } from "@/game/story/wardrobe";
import { getWorld } from "@/game/world/continent";
import { syncTerrain } from "@/game/runtime/world";
import { getArea, moodOf } from "@/game/world/areas";
import { toWorld } from "@/game/world/layout";
import { LIQUID } from "@/game/world/tilemap";
import { Game } from "@/game/runtime/Game";

/**
 * Play a script the way the game would: apply every mutation, answer each
 * question with the next of `picks` (the first answer when they run out),
 * win every fight, and stop where the script says to stop.
 */
function play(g: GameState, steps: Step[], picks: number[] = []): GameState {
  const queue = [...steps];
  while (queue.length) {
    const st = queue.shift()!;
    if ("mutate" in st) g = st.mutate(g);
    else if ("choose" in st) queue.unshift(...st.choose[picks.shift() ?? 0].then);
    else if ("battle" in st) queue.unshift(...victoryScript(st.battle, st.key, "sect", g));
    else if ("end" in st) break;
  }
  return g;
}

/** Whether a pre-battle script (taking these answers) goes on to the fight the game puts after it, or stops short. */
function fights(steps: Step[], picks: number[] = []): boolean {
  const queue = [...steps];
  while (queue.length) {
    const st = queue.shift()!;
    if ("end" in st) return false;
    if ("choose" in st) queue.unshift(...st.choose[picks.shift() ?? 0].then);
  }
  return true;
}

const labels = (steps: Step[]) => (steps.find((s) => "choose" in s) as { choose: { label: string }[] } | undefined)?.choose.map((c) => c.label) ?? [];

/** Everything a script narrates, taking these answers. */
function narration(steps: Step[], picks: number[] = []): string {
  const out: string[] = [];
  const queue = [...steps];
  while (queue.length) {
    const st = queue.shift()!;
    if ("narrate" in st) out.push(...st.narrate);
    else if ("choose" in st) queue.unshift(...st.choose[picks.shift() ?? 0].then);
  }
  return out.join(" ");
}

/** At Xue's altar, Foundation established, from the given beginning. */
const atAltar = (origin: (typeof ORIGIN_IDS)[number] = "disciple", extra: Record<string, boolean> = {}): GameState => {
  const g = newGameAs(origin);
  return { ...g, realm: 1, flags: { ...g.flags, metElder: true, villageSaved: true, metZhou: true, foxesCleared: true, metHuli: true, metWen: true, serpentKingDefeated: true, ...extra } };
};

/** Beat Xue (or talk him home) and choose the Heart's fate: 0 home, 1 planted, 2 devoured. */
function settleXue(g: GameState, xuePick: number, heart: number): GameState {
  const pre = preBattleScript("patriarch", "patriarch", g)!;
  const after = play(g, pre, [xuePick, heart]);
  if (!fights(pre, [xuePick])) return after;
  return play(after, victoryScript("patriarch", "patriarch", "valley", after), [heart]);
}

const ready = (g: GameState): GameState => ({ ...g, realm: FINAL_REALM - 1, stage: 3, cultivation: cultivationNeeded(FINAL_REALM - 1, 3) });

describe("three beginnings", () => {
  it("each origin starts somewhere of its own, dressed for it, with its own opening", () => {
    const starts = new Set<string>();
    for (const o of ORIGIN_IDS) {
      const g = newGameAs(o);
      expect(originOf(g.flags)).toBe(o);
      starts.add(`${g.area}:${Math.round(g.x)},${Math.round(g.y)}`);
      expect(introScript(g).length).toBeGreaterThan(3);
      expect(questLog(g).chapter).toBe("Prologue");
    }
    expect(starts.size).toBe(3);
    expect(currentAttire(newGameAs("foundling")).id).toBe("homespun");
    expect(currentAttire(newGameAs("defector")).id).toBe("acolyte");
    expect(newGameAs("foundling").area).toBe("village");
    // an old save (no origin flag) began as the sect's disciple
    expect(originOf({})).toBe("disciple");
  });

  it("the foundling fights the fox before she ever meets Elder Mo, then climbs to the sect", () => {
    let g = newGameAs("foundling");
    expect(areaUnlocked("village", g)).toBe(true);
    const fox = getWorld().enemies.find((e) => e.key === "village-fox")!;
    expect(fox.when!(g.flags)).toBe(true);
    expect(questLog(g).objective).toMatch(/fox/);
    g = play(g, victoryScript("fox", "village-fox", "village", g));
    expect(g.flags.villageSaved).toBe(true);
    expect(questLog(g).objective).toMatch(/sky bridge/);
    // Zhou sends her up the mountain rather than into the forest
    expect(hasNews("zhou", g)).toBe(false);
    g = play(g, npcScript("zhou", g));
    expect(g.flags.metZhou).toBeFalsy();
    g = play(g, npcScript("elder", g));
    expect(g.flags.metElder).toBe(true);
    expect(questLog(g).objective).toMatch(/Zhou/);
    g = play(g, npcScript("zhou", g));
    expect(g.flags.metZhou).toBe(true);
  });

  it("the runaway chooses what to give Elder Mo: her oath, or the secret way into the valley", () => {
    const g = newGameAs("defector");
    const oath = play(g, npcScript("elder", g), [0]);
    expect(oath.flags.moTrust).toBe(true);
    expect(oath.stones).toBeGreaterThan(g.stones);
    const way = play(g, npcScript("elder", g), [1]);
    expect(way.flags.secretWay).toBe(true);
    // the secret way opens the valley without the Serpent King, at Foundation
    const strong = { ...way, realm: 1, flags: { ...way.flags, metZhou: true } };
    expect(areaUnlocked("valley", strong)).toBe(true);
    expect(areaUnlocked("valley", { ...oath, realm: 1 })).toBe(false);
    expect(lockReason("valley", { ...way, realm: 0 })).toMatch(/Foundation/);
  });

  it("every beginning gets its own answer for Patriarch Xue", () => {
    const disciple = labels(preBattleScript("patriarch", "patriarch", atAltar("disciple"))!);
    const foundling = labels(preBattleScript("patriarch", "patriarch", atAltar("foundling"))!);
    const defector = labels(preBattleScript("patriarch", "patriarch", atAltar("defector"))!);
    expect(disciple.some((l) => /sutra/.test(l))).toBe(true);
    expect(foundling.some((l) => /raised you/.test(l))).toBe(true);
    expect(defector.some((l) => /wound/.test(l))).toBe(true);
    expect(new Set([disciple.join(), foundling.join(), defector.join()]).size).toBe(3);
  });

  it("the runaway's knowledge and the disciple's sutra weaken Xue before the first blow", () => {
    const wounded = play(atAltar("defector"), preBattleScript("patriarch", "patriarch", atAltar("defector"))!, [2]);
    expect(wounded.flags.xueWounded).toBe(true);
    expect(startBattle("patriarch", 1, openingWound("patriarch", wounded)).enemyHp).toBe(Math.round(ENEMIES.patriarch.hp * 0.6));
    const shaken = play(atAltar("disciple"), preBattleScript("patriarch", "patriarch", atAltar("disciple"))!, [2]);
    expect(openingWound("patriarch", shaken)).toBeCloseTo(0.2);
    expect(openingWound("patriarch", atAltar())).toBe(0);
    expect(openingWound("fox", wounded)).toBe(0);
  });
});

describe("Xue and the Heart", () => {
  it("talking Xue Ming home skips the fight, and he lays the Heart down himself", () => {
    expect(canRedeemXue(atAltar().flags)).toBe(false);
    expect(canRedeemXue(atAltar("disciple", { shenLore: true, ouMet: true }).flags)).toBe(true);
    const g = atAltar("foundling");
    const pre = preBattleScript("patriarch", "patriarch", g)!;
    const k = labels(pre).findIndex((l) => /raised you/.test(l));
    expect(fights(pre, [k])).toBe(false);
    expect(fights(pre, [0])).toBe(true);
    const after = play(g, pre, [k, 0]);
    expect(after.flags.xueRedeemed).toBe(true);
    expect(after.flags.patriarchDefeated).toBe(true);
    expect(after.bossDefeated).toBe(true);
    expect(hasAttire(after, "xuerobe")).toBe(true);
    expect(heartFate(after.flags)).toBe("home");
    // he is waiting at the Sword Tomb with a last teaching
    expect(getWorld().npcs.find((n) => n.key === "xueming")!.when!(after.flags)).toBe(true);
    expect(hasNews("xueming", after)).toBe(true);
    const taught = play(after, npcScript("xueming", after));
    expect(taught.cultivation).toBeGreaterThan(after.cultivation);
    expect(hasNews("xueming", taught)).toBe(false);
  });

  it("the Heart's three fates each take the tale somewhere else", () => {
    const home = settleXue(atAltar(), 1, 0);
    const planted = settleXue(atAltar(), 1, 1);
    const devoured = settleXue(atAltar(), 1, 2);
    expect([heartFate(home.flags), heartFate(planted.flags), heartFate(devoured.flags)]).toEqual(["home", "planted", "devoured"]);
    expect(questLog(home).objective).toMatch(/home to Elder Mo/);
    expect(questLog(planted).title).toBe("Roots of Heaven");
    expect(questLog(devoured).title).toBe("The Crimson Throne");
    expect(hasAttire(planted, "lotusqueen")).toBe(true);
    expect(currentAttire(devoured).id).toBe("bloodmoon");
    expect(devoured.realm * 10 + devoured.stage).toBeGreaterThan(atAltar().realm * 10);
    expect(crimsonPath(devoured.flags)).toBe(true);
    // the peak opens for the Heart's chosen, not for a thief
    for (const g of [home, planted]) {
      const told = play(g, npcScript("elder", g));
      expect(told.flags.heartReturned).toBe(true);
      expect(areaUnlocked("peak", told)).toBe(true);
    }
    expect(lockReason("peak", devoured)).toMatch(/Elder Mo/);
  });

  it("on the crimson path Elder Mo must be faced: broken, or let him draw the Heart back out", () => {
    const devoured = settleXue(atAltar(), 1, 2);
    expect(hasNews("elder", devoured)).toBe(true);
    const duel = npcScript("elder", devoured);
    expect(duel.some((s) => "battle" in s && s.battle === "elderMo")).toBe(true);
    const slain = play(devoured, duel, [0]);
    expect(slain.flags.moBroken).toBe(true);
    expect(areaUnlocked("peak", slain)).toBe(true);
    // he is still there (the notices he gives must stay givable), an old mortal in grey
    expect(getArea("sect").npcs.find((n) => n.key === "elder")!.outfit!(slain.flags)).toBe("broken");
    expect(npcScript("elder", slain).some((st) => "say" in st)).toBe(true);
    expect(questLog(slain).chapter).toBe("Epilogue");
    expect(altarScript(ready(slain)).some((s) => "meditate" in s)).toBe(true);

    const spared = play(devoured, duel, [1]);
    expect(spared.flags.purged).toBe(true);
    expect(spared.cultivation).toBe(0);
    expect(crimsonPath(spared.flags)).toBe(false);
    expect(spared.flags.heartReturned).toBe(true);
    expect(areaUnlocked("peak", spared)).toBe(true);
    expect(questLog(spared).title).toBe("The Second Climb");
  });
});

describe("five endings", () => {
  it("every road ends somewhere different, with its own title and its own clothes", () => {
    const told = (g: GameState) => play(g, npcScript("elder", g));
    const roads: [GameState, number][] = [
      [told(settleXue(atAltar(), 1, 0)), 0], // home, climb: ascension
      [told(settleXue(atAltar(), 1, 1)), 0], // planted, climb: rooted
      [told(settleXue(atAltar(), 1, 0)), 1], // home, turn back: guardian
      [told(settleXue(atAltar("foundling"), 1, 0)), 2], // the foundling goes home: mortal
      [play(settleXue(atAltar(), 1, 2), npcScript("elder", settleXue(atAltar(), 1, 2)), [0]), 0], // devoured, Mo slain: crimson
    ];
    const seen = new Set<string>();
    const texts = new Set<string>();
    for (const [g, pick] of roads) {
      const end = play(ready(g), endingScript(ready(g)), [pick]);
      expect(end.flags.ascended).toBe(true);
      const e = endingOf(end.flags)!;
      seen.add(e);
      texts.add(narration(endingScript(ready(g)), [pick]));
      expect(questLog(end).chapter).toBe("Fin");
      expect(questLog(end).title).toBe(ENDINGS[e].title);
    }
    expect([...seen].sort()).toEqual([...ENDING_IDS].sort());
    expect(texts.size).toBe(ENDING_IDS.length);
  });

  it("only the foundling may go home at the very end", () => {
    const g = play(settleXue(atAltar(), 1, 0), npcScript("elder", settleXue(atAltar(), 1, 0)));
    const f = play(settleXue(atAltar("foundling"), 1, 0), npcScript("elder", settleXue(atAltar("foundling"), 1, 0)));
    expect(labels(endingScript(ready(g)))).toHaveLength(2);
    expect(labels(endingScript(ready(f)))).toHaveLength(3);
  });

  it("heaven's raiment is woven only for those who climb its stair", () => {
    const g = play(settleXue(atAltar(), 1, 0), npcScript("elder", settleXue(atAltar(), 1, 0)));
    expect(hasAttire(play(ready(g), endingScript(ready(g)), [0]), "celestial")).toBe(true);
    const guardian = play(ready(g), endingScript(ready(g)), [1]);
    expect(hasAttire(guardian, "celestial")).toBe(false);
    expect(currentAttire(guardian).id).toBe("guardian");
    // a save from before there were other endings keeps it
    expect(hasAttire({ ...g, flags: { ...g.flags, ascended: true } }, "celestial")).toBe(true);
  });
});

describe("choices that change the land", () => {
  const w = getWorld();
  const m = w.map;
  const count = (pred: (i: number, j: number) => boolean, [x0, y0]: [number, number], r: number) => {
    let n = 0;
    for (let j = Math.floor(y0 - r); j <= y0 + r; j++) for (let i = Math.floor(x0 - r); i <= x0 + r; i++) if (pred(i, j)) n++;
    return n;
  };
  const lava = (i: number, j: number) => LIQUID[m.kind(i, j)] === "lava";

  it("the valley cools when Xue comes home, and blooms when the Heart is planted", () => {
    const at = toWorld("valley", 16, 16);
    syncTerrain(w, {});
    const lavaBefore = count(lava, at, 40);
    const ashBefore = count((i, j) => m.kind(i, j) === "ash", at, 36);
    expect(lavaBefore).toBeGreaterThan(20);
    syncTerrain(w, { patriarchDefeated: true, xueRedeemed: true });
    expect(count(lava, at, 40)).toBeLessThan(lavaBefore * 0.2);
    syncTerrain(w, { patriarchDefeated: true, "heart:planted": true });
    expect(count((i, j) => m.kind(i, j) === "ash", at, 36)).toBeLessThan(ashBefore * 0.3);
    expect(w.props.some((p) => p.id === "lotus" && p.when?.({ "heart:planted": true }) && !p.when?.({}))).toBe(true);
    syncTerrain(w, {});
    expect(count(lava, at, 40)).toBe(lavaBefore);
  });

  it("a devoured Heart blights the bamboo and Willow Creek until it is drawn back out", () => {
    const at = toWorld("bamboo", 16, 16);
    const grey = (i: number, j: number) => m.kind(i, j) === "ash" || m.kind(i, j) === "redrock";
    syncTerrain(w, {});
    const before = count(grey, at, 30);
    syncTerrain(w, { "heart:devoured": true });
    expect(count(grey, at, 30)).toBeGreaterThan(before + 500);
    syncTerrain(w, { "heart:devoured": true, purged: true });
    expect(count(grey, at, 30)).toBe(before);
    syncTerrain(w, {});
  });

  it("the Hall of Clouds is scorched where Elder Mo fell, and the guardian's peak turns green", () => {
    const hall = toWorld("sect", 15, 12);
    const peak = toWorld("peak", 12, 13);
    const ash = (i: number, j: number) => m.kind(i, j) === "ash" || m.kind(i, j) === "redrock";
    syncTerrain(w, {});
    const a = count(ash, hall, 6);
    const snow = count((i, j) => m.kind(i, j) === "snow", peak, 12);
    syncTerrain(w, { moBroken: true, "ending:guardian": true });
    expect(count(ash, hall, 6)).toBeGreaterThan(a + 20);
    expect(count((i, j) => m.kind(i, j) === "snow", peak, 12)).toBeLessThan(snow * 0.5);
    syncTerrain(w, {});
  });

  it("the sky answers too: the blood moon sets over the valley, or rises over the village", () => {
    expect(moodOf(w.regions.valley, {}).sky).toBe("blood");
    expect(moodOf(w.regions.valley, { xueRedeemed: true }).sky).not.toBe("blood");
    expect(moodOf(w.regions.valley, { "heart:planted": true }).sky).toBe("day");
    expect(moodOf(w.regions.village, { "heart:devoured": true }).sky).toBe("blood");
    expect(moodOf(w.regions.village, { "heart:devoured": true, purged: true }).sky).toBe(w.regions.village.sky);
    expect(moodOf(w.regions.sect, { moBroken: true }).sky).toBe("storm");
  });
});

describe("the wardrobe grows", () => {
  it("every outfit has a hint and paints", () => {
    expect(ATTIRE.length).toBeGreaterThanOrEqual(30);
    for (const a of ATTIRE.slice(1)) expect(ATTIRE_HINT[a.id], a.id).toBeTruthy();
    expect(new Set(ATTIRE.map((a) => a.id)).size).toBe(ATTIRE.length);
  });

  it("Hu Li makes her sworn sister a fox once the Blood Moon is over", () => {
    const g = { ...atAltar(), flags: { ...atAltar().flags, peiAtRest: true, patriarchDefeated: true } };
    expect(hasNews("huli", g)).toBe(true);
    const fox = play(g, npcScript("huli", g));
    expect(currentAttire(fox).id).toBe("foxform");
    expect(hasNews("huli", fox)).toBe(false);
    // not for the girl who drank the Heart
    expect(hasNews("huli", { ...g, flags: { ...g.flags, "heart:devoured": true } })).toBe(false);
  });
});

describe("in the running game", () => {
  it("a new game from each beginning opens on its own scene", () => {
    for (const o of ORIGIN_IDS) {
      const game = new Game(newGameAs(o), { intro: true, seed: 1 });
      expect(game.mode).toBe("scene");
      game.skipScene();
      expect(game.mode).toBe("explore");
      expect(game.state.area).toBe(o === "foundling" ? "village" : "sect");
    }
  });

  it("talking Xue home ends the scene without a fight, and without leaving her invulnerable", () => {
    const game = new Game({ ...atAltar("foundling"), area: "valley", ...(([x, y]) => ({ x, y }))(toWorld("valley", 24.5, 7.5)) }, { seed: 1 });
    const pre = preBattleScript("patriarch", "patriarch", game.state)!;
    const k = labels(pre).findIndex((l) => /raised you/.test(l));
    game.play([...pre, { battle: "patriarch", key: "patriarch" }]);
    let asked = 0;
    for (let guard = 0; guard < 400 && game.mode === "scene"; guard++) {
      game.skipScene();
      game.update(1 / 30);
      if (game.snapshot().choice) game.choose(asked++ === 0 ? k : 0);
    }
    expect(game.mode).toBe("explore");
    expect(game.battle).toBeNull();
    expect(game.state.flags.xueRedeemed).toBe(true);
    expect(game.state.flags["heart:home"]).toBe(true);
    game.update(3);
    // the scene's guard is down again: the next beast can touch her
    expect((game as unknown as { invulnerableUntil: number }).invulnerableUntil).toBeLessThan(game.clock + 10);
  });
});
