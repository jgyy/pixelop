import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { ENEMIES } from "@/game/engine/enemies";
import type { Step } from "@/game/story/script";
import { endingScript, hasNews, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { emberVeinScript, repOf, sectJournal, sectObjective, settled, signScript, springScript, standing } from "@/game/story/sects";
import { hasAttire } from "@/game/story/wardrobe";
import { Game } from "@/game/runtime/Game";
import { syncTerrain } from "@/game/runtime/world";
import { CAVE_IDS, getCave, VEIN_FATES } from "@/game/world/caves";
import { getWorld } from "@/game/world/continent";
import { getRoom, roomOpen } from "@/game/world/rooms";
import { LIQUID, TILE_KINDS, type TileMap } from "@/game/world/tilemap";

/**
 * Play a script the way the game would, without the game: apply every
 * mutation, answer each question with the next of `picks` (the first answer
 * when they run out), and win every fight.
 */
function play(g: GameState, steps: Step[], picks: number[] = [], won = true): GameState {
  const queue = [...steps];
  while (queue.length) {
    const st = queue.shift()!;
    if ("mutate" in st) g = st.mutate(g);
    else if ("choose" in st) queue.unshift(...st.choose[picks.shift() ?? 0].then);
    else if ("battle" in st) queue.unshift(...victoryScript(st.battle, st.key, "desert", g, won));
  }
  return g;
}

const talk = (g: GameState, key: string, picks: number[] = []) => play(g, npcScript(key, g), picks);
const started = (): GameState => ({ ...newGame(), realm: 1, flags: { metElder: true, villageSaved: true, metZhou: true } });

/** The Phoenix's quest from the first word to the last, with the given answers at each turn. */
function phoenix(g: GameState, meet: number, miners: number, vein: number): GameState {
  g = talk(g, "yanhuo", [meet]);
  g = talk(g, "tie", [miners]);
  g = play(g, victoryScript("emberwyrm", "ember-wyrm", "desert", g));
  g = play(g, emberVeinScript(g), [vein]);
  return talk(g, "yanhuo");
}

function herb(g: GameState, ku: number, spring: number): GameState {
  g = talk(g, "baizhi");
  g = talk(g, "kushen", [ku]);
  g = play(g, springScript(g), [spring]);
  return talk(g, "baizhi");
}

function sword(g: GameState, verdict: number): GameState {
  g = talk(g, "lingfeng");
  g = talk(g, "tangyu");
  g = play(g, signScript("sword-clue", g)!);
  g = talk(g, "wuyou", [verdict]);
  return talk(g, "lingfeng");
}

describe("choices in the runtime", () => {
  const game = () => {
    const g = new Game(newGame(), { seed: 1 });
    g.debugSkipTime(0.2);
    return g;
  };
  const question: Step[] = [
    { say: "narrator", text: "Which way?" },
    {
      choose: [
        { label: "Left", then: [{ mutate: (s) => ({ ...s, flags: { ...s.flags, left: true } }) }] },
        { label: "Right", hint: "the long way", then: [{ mutate: (s) => ({ ...s, flags: { ...s.flags, right: true } }) }] },
      ],
      prompt: "A fork in the road",
    },
    { mutate: (s) => ({ ...s, flags: { ...s.flags, after: true } }) },
  ];

  it("waits for an answer, runs the chosen branch, then carries on", () => {
    const g = game();
    g.play(question);
    g.keyDown("Enter");
    g.keyUp("Enter");
    g.debugSkipTime(0.05);
    const c = g.snapshot().choice!;
    expect(c.prompt).toBe("A fork in the road");
    expect(c.options.map((o) => o.label)).toEqual(["Left", "Right"]);
    expect(c.options[1].hint).toBe("the long way");
    // skipping a cutscene never skips a question
    g.skipScene();
    expect(g.snapshot().choice).not.toBeNull();
    g.keyDown("Digit2");
    g.keyUp("Digit2");
    g.debugSkipTime(0.2);
    expect(g.state.flags.right).toBe(true);
    expect(g.state.flags.left).toBeUndefined();
    expect(g.state.flags.after).toBe(true);
    expect(g.mode).toBe("explore");
  });

  it("the arrow keys move the highlight and Enter picks it", () => {
    const g = game();
    g.play(question.slice(1));
    expect(g.snapshot().choice!.selected).toBe(0);
    g.keyDown("ArrowDown");
    g.keyUp("ArrowDown");
    expect(g.snapshot().choice!.selected).toBe(1);
    g.keyDown("ArrowDown");
    g.keyUp("ArrowDown");
    expect(g.snapshot().choice!.selected).toBe(0);
    g.keyDown("ArrowUp");
    g.keyUp("ArrowUp");
    g.keyDown("Enter");
    g.keyUp("Enter");
    expect(g.state.flags.right).toBe(true);
  });

  it("opens the journal with J, listing the tale and every sect's standing", () => {
    const g = game();
    g.debugPatch({ flags: { metElder: true, metZhou: true }, counters: { "rep:phoenix": 2, "rep:sword": -2 } });
    g.keyDown("KeyJ");
    g.keyUp("KeyJ");
    const j = g.snapshot().journal!;
    expect(j.main.chapter).toBeTruthy();
    expect(j.standing.find((s) => s.id === "phoenix")!.label).toBe("Friendly");
    expect(j.standing.find((s) => s.id === "sword")!.label).toBe("Hostile");
    expect(j.sects.some((e) => e.sect === "rumour")).toBe(true);
    g.keyDown("Escape");
    g.keyUp("Escape");
    expect(g.snapshot().journal).toBeNull();
  });
});

describe("the sects' quests", () => {
  it("names a standing for every regard", () => {
    expect([-3, -1, 0, 2, 3].map(standing)).toEqual(["Hostile", "Wary", "Neutral", "Friendly", "Allied"]);
  });

  it("the Scarlet Phoenix: feeding the burning vein wins the Phoenix and its plumage", () => {
    const g = phoenix(started(), 0, 0, 1);
    expect(g.flags["phx:fed"]).toBe(true);
    expect(g.flags.phxDone).toBe(true);
    expect(g.flags.minersOut).toBe(true);
    expect(repOf(g, "phoenix")).toBe(4);
    expect(repOf(g, "herb")).toBe(-1);
    expect(hasAttire(g, "phoenix")).toBe(true);
    expect(g.flags["allied:phoenix"]).toBe(true);
  });

  it("the Scarlet Phoenix: sealing it angers Yan Huo, hiding the miners costs Ah Shi his arm, and the paid road pays", () => {
    const g = phoenix(started(), 2, 1, 0);
    expect(g.flags["phx:sealed"]).toBe(true);
    expect(g.flags.shiBurned).toBe(true);
    expect(repOf(g, "phoenix")).toBe(-1);
    expect(repOf(g, "herb")).toBe(1);
    expect(hasAttire(g, "phoenix")).toBe(false);
    expect(g.stones).toBe(started().stones + 100);
  });

  it("the Scarlet Phoenix: a bold answer means a sparring match first", () => {
    let g = talk(started(), "yanhuo", [1]);
    expect(g.flags.phxBold).toBe(true);
    // the spar won: her regard climbs back above where it started
    expect(repOf(g, "phoenix")).toBe(1);
    expect(ENEMIES.phoenixguard.friendly).toBe(true);
    g = play(started(), npcScript("yanhuo", started()), [1], false);
    expect(repOf(g, "phoenix")).toBe(-1);
    expect(g.flags.phxMine).toBe(true);
  });

  it("Hundred Herb Valley: mercy for Ku Shen sends him to the inn; purifying the spring costs her qi", () => {
    const g = herb(started(), 1, 0);
    expect(g.flags.kuSpared).toBe(true);
    expect(g.flags["herb:purified"]).toBe(true);
    expect(g.flags.herbDone).toBe(true);
    expect(repOf(g, "herb")).toBe(2);
    expect(hasAttire(g, "herbal")).toBe(true);
    const inn = getWorld().npcs.find((n) => n.key === "kushen2")!;
    expect(inn.when!(g.flags)).toBe(true);
  });

  it("Hundred Herb Valley: beating Ku Shen and draining the marsh", () => {
    const g = herb(started(), 0, 1);
    expect(g.flags.kuCaptured).toBe(true);
    expect(g.flags["herb:drained"]).toBe(true);
    expect(repOf(g, "herb")).toBe(2);
    // the drained lake gives up a chest in the grotto
    const sunken = getCave("grotto").interacts.find((x) => x.key === "grotto-sunken")!;
    expect(sunken.when!(g.flags)).toBe(true);
    expect(sunken.when!(herb(started(), 0, 0).flags)).toBe(false);
  });

  it("the Sword Sea: exposing, sparing or selling out Jian Wuyou each end differently", () => {
    const exposed = sword(started(), 0);
    expect(exposed.flags.swordStair).toBe(true);
    expect(repOf(exposed, "sword")).toBe(2);
    expect(getWorld().npcs.find((n) => n.key === "wuyouHarbor")!.when!(exposed.flags)).toBe(true);
    const mercy = sword(started(), 1);
    expect(mercy.flags.swordStair).toBe(true);
    expect(repOf(mercy, "sword")).toBe(1);
    expect(hasAttire(mercy, "swordsea")).toBe(true);
    const bribed = sword(started(), 2);
    expect(bribed.flags.swordStair).toBeUndefined();
    expect(repOf(bribed, "sword")).toBe(-3);
    expect(bribed.flags["hostile:sword"]).toBe(true);
    expect(bribed.stones).toBe(started().stones + 120);
    // the bribe comes back to haunt her on the crag
    expect(getWorld().enemies.find((e) => e.key === "sword-traitor")!.when!(bribed.flags)).toBe(true);
  });

  it("settling two sects' troubles splits the Dragonspine open", () => {
    let g = phoenix(started(), 0, 0, 0);
    expect(g.flags.veinOpened).toBeUndefined();
    expect(sectObjective(g)).toBeNull();
    g = herb(g, 0, 0);
    expect(settled(g.flags)).toEqual(["phoenix", "herb"]);
    expect(g.flags.veinOpened).toBe(true);
    expect(roomOpen("vein", g.flags)).toBe(true);
    expect(roomOpen("vein", started().flags)).toBe(false);
    expect(sectObjective(g)).toMatch(/Dragon Vein/);
    expect(hasNews("longlao", g)).toBe(true);
  });

  it("the conclave: each of the five fates changes the sects, the ending and the land", () => {
    const base = herb(phoenix(started(), 0, 0, 0), 0, 0);
    const endings = new Set<string>();
    VEIN_FATES.forEach((fate, k) => {
      const g = talk(base, "longlao", [k]);
      expect(g.flags[`vein:${fate}`], fate).toBe(true);
      expect(sectJournal(g).find((e) => e.sect === "vein")!.done).toBe(true);
      const ending = endingScript(g).find((s) => "narrate" in s) as { narrate: string[] };
      endings.add(ending.narrate.join(" "));
      // Elder Mo has something to say about it, once
      const told = talk(g, "elder");
      expect(told.flags.elderVein, fate).toBe(true);
    });
    expect(endings.size).toBe(VEIN_FATES.length);
    const taken = talk(base, "longlao", [4]);
    expect(["phoenix", "herb", "sword"].every((s) => taken.flags[`hostile:${s}`])).toBe(true);
    const shared = talk(base, "longlao", [3]);
    expect(repOf(shared, "sword")).toBe(1);
  });

  it("offering Patriarch Xue a way back changes his last words and the ending", () => {
    let g: GameState = { ...started(), flags: { ...started().flags, serpentKingDefeated: true } };
    g = play(g, preBattleScript("patriarch", "patriarch")!, [0]);
    expect(g.flags.xueOffered).toBe(true);
    g = play(g, victoryScript("patriarch", "patriarch", "valley", g));
    expect(g.flags.xueForgiven).toBe(true);
    const ending = endingScript(g).find((s) => "narrate" in s) as { narrate: string[] };
    expect(ending.narrate.join(" ")).toMatch(/Xue Ming/);
  });

  it("every new sect NPC has something of their own to say", () => {
    const keys = [...getWorld().npcs, ...CAVE_IDS.flatMap((id) => getCave(id).npcs)].map((n) => n.key);
    for (const key of ["yanhuo", "zhuque", "tie", "baizhi", "linger", "kushen", "kushen2", "lingfeng", "wuyou", "tangyu", "longlao", "dong"]) {
      expect(keys, key).toContain(key);
      const script = npcScript(key, started());
      expect(script.some((s) => "say" in s && s.say !== "narrator"), key).toBe(true);
    }
  });
});

describe("the land answers the story", () => {
  const w = getWorld();
  const count = (m: TileMap, pred: (i: number, j: number) => boolean, [x0, y0, x1, y1]: number[]) => {
    let n = 0;
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) if (pred(i, j)) n++;
    return n;
  };

  it("lays patches on and takes them off again as the flags change", () => {
    const box = [1160, 730, 1240, 840];
    const lava = (i: number, j: number) => LIQUID[w.map.kind(i, j)] === "lava";
    syncTerrain(w, {});
    const before = count(w.map, lava, box);
    const kinds = w.map.kinds.slice();
    expect(syncTerrain(w, { "phx:fed": true, veinOpened: true }).length).toBeGreaterThan(20);
    expect(count(w.map, lava, box)).toBeGreaterThan(before + 20);
    // nothing changes when nothing new happened
    expect(syncTerrain(w, { "phx:fed": true, veinOpened: true })).toEqual([]);
    syncTerrain(w, { "phx:sealed": true });
    expect(count(w.map, lava, box)).toBeLessThan(before);
    syncTerrain(w, {});
    expect(w.map.kinds).toEqual(kinds);
  });

  it("steps her out of the way when the land changes under her feet", () => {
    syncTerrain(w, {});
    const fed = w.patches!.find((p) => p.key === "phoenix-fed")!;
    const lavaIdx = TILE_KINDS.indexOf("lava");
    let at = -1;
    for (let k = 0; k < fed.idx.length && at < 0; k++) {
      const i = fed.idx[k] % w.map.w;
      const j = Math.floor(fed.idx[k] / w.map.w);
      if (fed.kinds[k] === lavaIdx && [-1, 0, 1].every((d) => w.map.standable(i + d, j) && w.map.standable(i, j + d))) at = fed.idx[k];
    }
    expect(at).toBeGreaterThan(0);
    const g = new Game(newGame(), { seed: 2 });
    g.debugGoto((at % w.map.w) + 0.5, Math.floor(at / w.map.w) + 0.5);
    g.debugPatch({ flags: { "phx:fed": true } });
    g.debugSkipTime(1);
    const h = g.world.hero;
    expect(w.map.standable(Math.floor(h.x), Math.floor(h.y))).toBe(true);
    syncTerrain(w, {});
  });

  it("the Dragon Vein's mouth is buried under rock until the conclave is called", () => {
    const door = getRoom("vein").door;
    syncTerrain(w, {});
    expect(w.map.standable(door[0], door[1])).toBe(false);
    syncTerrain(w, { veinOpened: true });
    expect(w.map.standable(door[0], door[1])).toBe(true);
    syncTerrain(w, {});
  });

  it("the ranges raise mountains far above the old hills, and the sects stand on heights of their own", () => {
    let top = 0;
    for (let k = 0; k < w.map.heights.length; k++) top = Math.max(top, w.map.heights[k]);
    expect(top).toBeGreaterThanOrEqual(10);
    const mesa = w.landmarks.find((l) => l.key === "phoenix")!;
    const crag = w.landmarks.find((l) => l.key === "swordsea")!;
    expect(w.map.height(Math.floor(mesa.x) - 6, Math.floor(mesa.y))).toBe(7);
    expect(w.map.height(Math.floor(crag.x), Math.floor(crag.y) + 4)).toBe(10);
  });
});

describe("caves", () => {
  /** Tiles reachable on foot from a start tile (steps of at most one level). */
  function reach(m: TileMap, from: [number, number]): Set<number> {
    const seen = new Set<number>([Math.floor(from[1]) * m.w + Math.floor(from[0])]);
    const q = [...seen];
    for (let n = 0; n < q.length; n++) {
      const i = q[n] % m.w;
      const j = Math.floor(q[n] / m.w);
      for (const [di, dj] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const k = (j + dj) * m.w + i + di;
        if (seen.has(k) || !m.standable(i + di, j + dj) || Math.abs(m.height(i + di, j + dj) - m.height(i, j)) > 1) continue;
        seen.add(k);
        q.push(k);
      }
    }
    return seen;
  }
  const near = (r: Set<number>, m: TileMap, i: number, j: number) => [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => r.has((j + b) * m.w + i + a)));

  for (const id of CAVE_IDS) {
    it(`${id}: every chamber, keeper, beast and treasure is reachable from the mouth`, () => {
      const d = getCave(id);
      const m = d.map;
      const r = reach(m, d.arrive);
      expect(r.size).toBeGreaterThan(300);
      expect(r.has(d.exit[1] * m.w + d.exit[0])).toBe(true);
      // the way out faces the open front of the cave
      expect(m.kind(d.exit[0] + 1, d.exit[1])).toBe("void");
      for (const n of d.npcs) expect(near(r, m, n.i, n.j), `${id}/${n.key}`).toBe(true);
      for (const e of d.enemies) {
        expect(ENEMIES[e.enemy]).toBeDefined();
        expect(m.standable(e.i, e.j), `${id}/${e.key} on open ground`).toBe(true);
        expect(near(r, m, e.i, e.j), `${id}/${e.key}`).toBe(true);
      }
      for (const it of d.interacts.filter((x) => !x.when)) {
        expect(near(r, m, it.i, it.j), `${id}/${it.key}`).toBe(true);
        if (it.kind !== "sign" && it.kind !== "door") expect(m.standable(it.i, it.j) || m.isBlocked(it.i, it.j), `${id}/${it.key} on the floor`).toBe(true);
      }
      // what the story uncovers (the drained lake's chest, the burning vein) is reachable once it is uncovered
      syncTerrain(d, { "herb:drained": true });
      const r2 = reach(m, d.arrive);
      for (const it of d.interacts.filter((x) => x.when)) expect(near(r2, m, it.i, it.j), `${id}/${it.key}`).toBe(true);
      syncTerrain(d, {});
      for (const p of d.props) expect(["void", "rockwall"], `${id}/${p.id} at ${p.i},${p.j}`).not.toContain(m.kind(p.i, p.j));
      // every chest, herb and shrine can be seen where it is
      for (const it of d.interacts.filter((x) => x.kind === "chest" || x.kind === "herb" || x.kind === "shrine")) expect(d.props.some((p) => p.id === it.kind && p.i === it.i && p.j === it.j), `${id}/${it.key} prop`).toBe(true);
      // the rock behind is wall nobody can stand on
      expect(m.kinds.some((_, k) => m.kind(k % m.w, Math.floor(k / m.w)) === "rockwall")).toBe(true);
      // every story patch leaves the way back out open
      for (const p of d.patches ?? []) {
        syncTerrain(d, Object.fromEntries([[p.key, true], ...["phx:sealed", "phx:fed", "herb:purified", "herb:drained", ...VEIN_FATES.map((v) => `vein:${v}`)].map((f) => [f, true])]));
      }
      syncTerrain(d, {});
    });
  }

  it("each cave mouth stands on reachable ground in the world, the rock beside its door", () => {
    const w = getWorld();
    syncTerrain(w, {});
    for (const id of CAVE_IDS) {
      const d = getCave(id);
      const [i, j] = d.door;
      expect(w.interacts.some((it) => it.kind === "door" && it.to === id && it.i === i && it.j === j), id).toBe(true);
      expect(w.map.isBlocked(i - 1, j), `${id} mouth`).toBe(true);
    }
  });

  it("she walks into a cave with a torch, fights on a ledge in the dark, and comes back out to the mouth", () => {
    const g = new Game({ ...newGame(), flags: { metElder: true, phxMine: true } }, { seed: 3 });
    g.debugEnter("emberMine");
    g.debugSkipTime(0.2);
    expect(g.inside).toBe("emberMine");
    expect(g.world.cave).toBe(true);
    expect(g.world.hero.idleAnim).toBe("torch");
    expect(g.snapshot().interior!.cave).toBe(true);
    g.debugBattle("emberwyrm", "ember-wyrm");
    expect(g.battle!.world.def.sky).toBe("cave");
    g.debugEnter("grotto");
    expect(g.inside).toBe("grotto");
  });
});
