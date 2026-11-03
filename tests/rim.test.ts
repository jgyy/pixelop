import { describe, expect, it } from "vitest";
import { getWorld, regionAt } from "@/game/world/continent";
import { COARSE_H, COARSE_W, WORLD_SCALE } from "@/game/world/layout";
import { beyondRim, pastEdge } from "@/game/world/oceans";
import { GUIXU, IMMORTAL_FOLK, IMMORTAL_ISLES, IMMORTAL_MARKS, immortalIsleAt, inGuixu, LAST_LAMP, rimDepth } from "@/game/world/immortals";
import { CAVE_IDS } from "@/game/world/caves";
import { DEEPS, VEINS } from "@/game/world/underworld";
import { LIQUID } from "@/game/world/tilemap";
import { immortalHasNews, immortalNpcScript, metAllMasters } from "@/game/story/immortals";
import { newGame, type GameState } from "@/game/engine/state";
import { CULT } from "@/game/engine/cultivation";
import { Game } from "@/game/runtime/Game";
import { WorldMap } from "@/game/runtime/worldmap";
import { AutoPlayer, progressScore } from "@/game/bot/autoplay";
import type { Step } from "@/game/story/script";

const S = WORLD_SCALE;
const w = getWorld();
const m = w.map;

/** Run a conversation's mutations against a state, as the game would. */
const play = (g: GameState, steps: Step[]) => steps.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);

describe("the rim of the world", () => {
  it("ends the Encircling Sea in a ragged, rounded rim, not a rectangle", () => {
    // the corners of the old rectangle are all past the rim; the middles of its sides need not be
    for (const [i, j] of [
      [2, 2],
      [COARSE_W - 3, 2],
      [2, COARSE_H - 3],
      [COARSE_W - 3, COARSE_H - 3],
    ])
      expect(beyondRim(i, j), `${i},${j}`).toBe(true);
    expect(rimDepth(COARSE_W / 2, COARSE_H / 2, COARSE_W, COARSE_H)).toBeGreaterThan(300);
    // how far in from the old rectangle the rim runs, along each side: it wanders by tens of tiles
    const inset: number[] = [];
    for (let i = 40; i < COARSE_W - 40; i += 8) {
      let j = 0;
      while (j < COARSE_H / 2 && beyondRim(i, j)) j++;
      inset.push(j);
    }
    expect(Math.max(...inset) - Math.min(...inset)).toBeGreaterThan(20);
  });

  it("drops into the clouds past the rim, never cutting the land, and turns everyone back before the lip", () => {
    let past = 0;
    for (let j = 0; j < COARSE_H; j += 2)
      for (let i = 0; i < COARSE_W; i += 2) {
        if (!beyondRim(i, j)) continue;
        past++;
        const k = m.kind(i * S, j * S);
        expect(k, `${i},${j}`).toBe("void");
        // and there is no land right beside it
        for (const [di, dj] of [
          [3, 0],
          [-3, 0],
          [0, 3],
          [0, -3],
        ]) {
          const k2 = m.kind((i + di) * S, (j + dj) * S);
          expect(k2 === "void" || !!LIQUID[k2], `land beside the rim at ${i + di},${j + dj}`).toBe(true);
        }
        // the wind turns her back well short of it
        expect(pastEdge(i * S + 1, j * S + 1, m.w, m.h)).toBe(true);
      }
    expect(past).toBeGreaterThan(5000);
    // the sea falls over the lip all round: water beside the void, with nothing between
    let falls = 0;
    m.each((i, j) => {
      if (LIQUID[m.kind(i, j)] === "water" && m.kind(i + 1, j) === "void" && beyondRim(Math.floor((i + 1) / S), Math.floor(j / S))) falls++;
    });
    expect(falls).toBeGreaterThan(400);
  });

  it("has Guixu, the abyss the sea drains into, at the far south-east", () => {
    expect(inGuixu(...GUIXU.c)).toBe(true);
    expect(beyondRim(...GUIXU.c)).toBe(true);
    expect(m.kind(GUIXU.c[0] * S, GUIXU.c[1] * S)).toBe("void");
    // and the Last Lamp stands on its rock at the lip, on land
    const k = m.kind(LAST_LAMP[0] * S, LAST_LAMP[1] * S);
    expect(k === "void" || LIQUID[k]).toBeFalsy();
  });
});

describe("the Three Isles of the Immortals", () => {
  it("raises Penglai, Fangzhang and Yingzhou past Fusang, each of its own ragged shape, joined by jade causeways", () => {
    for (const isle of IMMORTAL_ISLES) {
      let land = 0;
      for (let j = isle.c[1] - 60; j <= isle.c[1] + 60; j++) for (let i = isle.c[0] - 60; i <= isle.c[0] + 60; i++) if (immortalIsleAt(i, j) === isle && !LIQUID[m.kind(i * S, j * S)] && m.kind(i * S, j * S) !== "void") land++;
      expect(land, isle.key).toBeGreaterThan(1500);
      // its sanctum stands on its heights
      expect(m.height(isle.c[0] * S, isle.c[1] * S), isle.key).toBeGreaterThanOrEqual(isle.level);
      expect(regionAt(w, isle.c[0] * S, isle.c[1] * S)).toBe("harbor");
    }
    for (const [key] of IMMORTAL_MARKS) expect(w.landmarks.some((l) => l.key === key), key).toBe(true);
    // the causeways are planks over the sea
    let planks = 0;
    for (let j = 150; j < 740; j++) for (let i = 750; i < 880; i++) if (m.kind(i * S, j * S) === "wood") planks++;
    expect(planks).toBeGreaterThan(200);
    for (const p of IMMORTAL_FOLK) expect(w.npcs.some((n) => n.key === p.key), p.key).toBe(true);
    expect(w.npcs.filter((n) => n.key.startsWith("im-town-")).length).toBeGreaterThan(100);
  });

  it("has each master give her a gift once, and the Watcher tell her what the rim is once she has met all three", () => {
    let g = newGame();
    expect(immortalHasNews("im-anqi", g)).toBe(true);
    const cult = g.cultivation;
    g = play(g, immortalNpcScript("im-anqi", g)!);
    expect(g.flags["im:met:im-anqi"]).toBe(true);
    expect(g.cultivation + g.stage * 1000).toBeGreaterThan(cult);
    expect(immortalHasNews("im-anqi", g)).toBe(false);
    const insight = g.counters[CULT.insight] ?? 0;
    g = play(g, immortalNpcScript("im-fang", g)!);
    expect(g.counters[CULT.insight]).toBe(insight + 2);
    const pills = g.pills.heal;
    g = play(g, immortalNpcScript("im-ying", g)!);
    expect(g.pills.heal).toBe(pills + 3);
    expect(metAllMasters(g.flags)).toBe(true);
    // a second word with a master gives nothing more
    expect(play(g, immortalNpcScript("im-fang", g)!).counters[CULT.insight]).toBe(insight + 2);
    expect(immortalHasNews("im-lamp", g)).toBe(true);
    g = play(g, immortalNpcScript("im-lamp", g)!);
    expect(g.flags["im:rim"]).toBe(true);
    expect(immortalHasNews("im-lamp", g)).toBe(false);
    // the new moves are what she does there
    const steps = immortalNpcScript("im-anqi", newGame())!;
    expect(steps.some((s) => "anim" in s && s.name === "elixirbreath")).toBe(true);
    expect(immortalNpcScript("im-town-3", g)?.length).toBe(1);
  });
});

describe("the Underworld chart", () => {
  it("marks every deep, with the dragon veins running between them down to Guixu", () => {
    expect(DEEPS.map((d) => d.id).sort()).toEqual([...CAVE_IDS].sort());
    const ends = new Set(VEINS.flat());
    for (const id of CAVE_IDS) expect(ends.has(id), id).toBe(true);
    expect(ends.has("guixu")).toBe(true);
  });

  it("turns the map over, flies to a deep's mouth, and goes down into it", () => {
    const game = new Game({ ...newGame(), flags: { metElder: true, villageSaved: true, metZhou: true } }, { seed: 1 });
    game.debugSkipTime(0.2);
    game.openMap();
    expect(game.mode).toBe("worldmap");
    game.toggleMapLayer();
    expect(game.worldMap!.layer).toBe("under");
    const snap = game.snapshot().worldmap!;
    expect(snap.layer).toBe("under");
    expect(snap.deeps).toHaveLength(CAVE_IDS.length);
    // the Dragon Vein's mouth is buried until the earth shakes it loose
    expect(snap.deeps.find((d) => d.id === "vein")!.locked).not.toBeNull();
    const open = snap.deeps.find((d) => !d.locked)!;
    expect(open).toBeDefined();
    game.mapSelectDeep(open.id);
    expect(game.worldMap!.travelling).toBe(true);
    for (let k = 0; k < 400 && game.worldMap?.travelling; k++) game.update(1 / 20);
    expect(game.worldMap!.deep).toBe(open.id);
    expect(game.worldMap!.at).toBe(WorldMap.deepRegion(open.id));
    game.mapSelectDeep(open.id);
    expect(game.mode === "explore" || game.mode === "scene").toBe(true);
    if (game.mode === "explore") expect(game.inside).toBe(open.id);
    // and turned back over, the map shows the lands again
    game.debugGoto(...w.waypoints.village);
    game.openMap();
    expect(game.worldMap!.layer).toBe("over");
  });
});

describe("the autoplay bot", () => {
  it("plays the opening on its own: speaks with Elder Mo, goes down to the village, and moves the tale on without an error", () => {
    const game = new Game(newGame(), { intro: true, seed: 2 });
    const before = progressScore(game.state);
    const bot = new AutoPlayer(game, { travel: "teleport", seed: 2, stallAfter: 120 });
    const report = bot.run(150);
    expect(report.errors).toEqual([]);
    expect(game.state.flags.metElder).toBe(true);
    expect(report.talks).toBeGreaterThan(3);
    expect(progressScore(game.state)).toBeGreaterThan(before + 10);
    expect(report.regions.length).toBeGreaterThan(1);
    expect(report.log.length).toBeGreaterThan(5);
  }, 240_000);

  it("walks rather than jumps when told to, and answers questions by its policy", () => {
    const game = new Game({ ...newGame(), flags: { metElder: true } }, { seed: 3 });
    game.debugSkipTime(0.2);
    const bot = new AutoPlayer(game, { travel: "walk", choose: "first", seed: 3 });
    const report = bot.run(40);
    expect(report.errors).toEqual([]);
    expect(report.log.some((e) => e.kind === "travel")).toBe(true);
    expect(bot.doing.length).toBeGreaterThan(0);
  }, 120_000);
});
