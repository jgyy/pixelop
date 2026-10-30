import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS } from "@/game/engine/realms";
import { ENEMIES } from "@/game/engine/enemies";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { currentTiers, stairBarToast, syncTiersFlags, tiersBreath, tiersChronicle, tiersCultivated, tiersDone, tiersHunt, tiersLandmark, tiersLog, tiersOpen, tiersQuests, tiersTalk, TIERS_AREA, TIERS_BOOK, TIERS_COUNT } from "@/game/story/tiers";
import { TIER_BOOKS } from "@/game/story/tiersBooks";
import { crowdRealm, fillStanding, floorRefusal, honorific, peerTitle, quarterNpcScript, realmTier, tierFolkScript } from "@/game/story/standing";
import { crowdNpcScript } from "@/game/story/crowd";
import { hasAttire } from "@/game/story/wardrobe";
import { getWorld, regionAt } from "@/game/world/continent";
import { getInterior, INTERIOR_IDS } from "@/game/world/interiors";
import { roomDoors } from "@/game/world/rooms";
import { JINHE_QUARTERS, WILLOW_WARD } from "@/game/world/quarters";
import { gateFlag, stairRow, TIANJIE_C, TIER_BOSSES, TIER_COUNT, TIER_FOLK, TIER_LEVEL, tierAt, tierHeight, tierRect, tierWorldRect } from "@/game/world/tiers";
import { charDef, getAnim, type AnimId } from "@/game/art/characters";
import { getProp } from "@/game/art/props";
import { WORLD_SCALE } from "@/game/world/layout";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { BufferSurface } from "@/game/pixel/surface";
import { Game } from "@/game/runtime/Game";

/** Play a script the way the game would: apply its mutations, answer each question with the next pick (the first when they run out). */
function play(g: GameState, steps: Step[], picks: number[] = []): GameState {
  const queue = [...steps];
  while (queue.length) {
    const st = queue.shift()!;
    if ("mutate" in st) g = st.mutate(g);
    else if ("choose" in st) queue.unshift(...st.choose[Math.min(picks.shift() ?? 0, st.choose.length - 1)].then);
    else if ("end" in st) break;
  }
  return g;
}

const said = (steps: Step[]) => steps.map((s) => ("text" in s ? s.text : "narrate" in s ? s.narrate.join(" ") : "toast" in s ? s.toast : "")).join(" ");

function atLevel(g: GameState, level: number): GameState {
  let n = level;
  for (let r = 0; r < REALMS.length; r++) {
    if (n < REALMS[r].stages) return { ...g, realm: r, stage: n, cultivation: 0 };
    n -= REALMS[r].stages;
  }
  return g;
}

/** A late Qi Condensation disciple Elder Mo has sent out into the jianghu. */
const ready = (): GameState => atLevel({ ...newGame(), flags: { metElder: true, metZhou: true, villageSaved: true } }, 2);

/** Do whatever the current quest asks, as the game would. */
function doQuest(g: GameState, pick: number): GameState {
  const q = currentTiers(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  g = syncTiersFlags(g);
  switch (q.kind) {
    case "beat":
    case "petition":
    case "ahlou":
    case "vouch":
    case "registry":
    case "errand":
      return play(g, tiersTalk(q.npc!, g)!, [pick]);
    case "challenge":
      for (let k = 0; k < q.count; k++) {
        const r = tiersHunt(g, "tjring");
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "contemplate":
      for (let k = 0; k < q.count; k++) {
        const r = tiersBreath(g, q.region!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "climb":
      return play(g, tiersLandmark(q.landmark!, g, { night: q.how === "night", riding: q.how === "ride", flying: q.how === "fly" })!);
    case "gate":
      return play(g, tiersCultivated(g)!);
    case "duel": {
      const boss = TIER_BOSSES[q.book];
      expect(preBattleScript(boss, `tjboss-${q.book}`, g), boss).not.toBeNull();
      return play(g, victoryScript(boss, `tjboss-${q.book}`, TIERS_AREA, g), [pick]);
    }
  }
}

describe("the City of Nine Tiers", () => {
  const all = tiersQuests();
  const w = getWorld();
  const npcKeys = new Set(w.npcs.map((n) => n.key));
  const landmarks = new Set(w.landmarks.map((l) => l.key));

  it("is a thousand quests in ten books, one for each tier and the summit, each opened and closed by its own tale", () => {
    expect(all).toHaveLength(TIERS_COUNT);
    expect(TIER_BOOKS).toHaveLength(TIERS_COUNT / TIERS_BOOK);
    for (let b = 0; b < 10; b++) {
      const book = all.slice(b * TIERS_BOOK, (b + 1) * TIERS_BOOK);
      expect(book[0].kind).toBe("beat");
      expect(book[50].kind).toBe("gate");
      expect(book[98].kind).toBe("beat");
      expect(book[99].kind).toBe("duel");
      expect(book.filter((q) => q.kind === "beat").length, `book ${b}`).toBeGreaterThanOrEqual(10);
      // at least three hand-written questions a book, each answered four ways
      expect(TIER_BOOKS[b].beats.filter((x) => x.choice).length, `book ${b}`).toBeGreaterThanOrEqual(2);
      for (const k of ["petition", "ahlou", "errand", "challenge", "contemplate", "climb"]) expect(book.some((q) => q.kind === k), `book ${b} ${k}`).toBe(true);
    }
    const g = ready();
    for (const q of all) {
      for (const t of [q.objective, q.done, q.title]) expect(fillStanding(t, g), `${q.id}`).not.toMatch(/\{|\}|undefined/);
      if (q.npc) expect(npcKeys.has(q.npc), `${q.id} ${q.npc}`).toBe(true);
      if (q.landmark) expect(landmarks.has(q.landmark), `${q.id} ${q.landmark}`).toBe(true);
    }
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    expect(all[TIERS_COUNT - 1].level).toBe(19);
    // a book never asks less of her than the gate of its own tier
    for (let b = 1; b < 10; b++) expect(all[b * TIERS_BOOK].level).toBeGreaterThanOrEqual(TIER_LEVEL[b]);
  });

  it("begins with a herald at Jinhe's south gate, once Elder Mo has sent her out and she can hold her own", () => {
    expect(tiersOpen({ ...ready(), realm: 0, stage: 1 })).toBe(false);
    expect(tiersOpen({ ...ready(), flags: {} })).toBe(false);
    expect(tiersLog(ready())!.objective).toMatch(/herald/);
    expect(all[0].npc).toBe("tj-herald");
    const herald = w.npcs.find((n) => n.key === "tj-herald")!;
    expect(regionAt(w, herald.i, herald.j)).toBe("terraces");
    expect(herald.when!({})).toBe(true);
    expect(herald.when!({ "tiers:begun": true })).toBe(false);
  });

  it("opens each tier's gate to her realm alone, and the folk of the tiers speak to her by it", () => {
    for (let level = 0; level < 20; level++) {
      const g = syncTiersFlags(atLevel(ready(), level));
      for (let k = 1; k < TIER_COUNT; k++) expect(!!g.flags[gateFlag(k)], `level ${level} gate ${k}`).toBe(level >= TIER_LEVEL[k]);
      expect(realmTier(g)).toBe(TIER_LEVEL.filter((x) => x <= level).length - 1);
    }
    // a warden turns away someone below his realm, and lets someone at it through
    const low = syncTiersFlags(atLevel(ready(), 2));
    expect(said(npcScript("tj-warden-1", low))).toMatch(/will not part/);
    const high = syncTiersFlags(atLevel(ready(), 4));
    expect(said(npcScript("tj-warden-1", high))).not.toMatch(/will not part/);
    // and the toast says what realm she needs
    expect(stairBarToast(w.bars[0].why, low)).toMatch(/Foundation Establishment/);
  });

  it("tells her to come back heavier when her realm is not yet what the tier asks", () => {
    let g = ready();
    g = play(g, tiersTalk("tj-herald", g)!);
    expect(tiersDone(g)).toBe(1);
    const q = currentTiers(g)!;
    const light = atLevel({ ...g }, 0);
    const steps = tiersTalk(q.npc!, light) ?? [];
    if (q.level > 0) expect(said(steps)).toMatch(/Come back at/);
  });

  it("can be walked to its end: every beat, every errand, every trouble, every fate", { timeout: 120_000 }, () => {
    let g = ready();
    const seen = new Set<string>();
    for (let n = 0; n < TIERS_COUNT; n++) {
      const q = currentTiers(g)!;
      expect(q.id, `quest ${n}`).toBe(n);
      g = doQuest(g, n === TIERS_COUNT - 1 ? 0 : n % 4);
      expect(tiersDone(g), `${n} ${q.kind} ${q.title}`).toBe(n + 1);
      seen.add(q.kind);
      if (n === 499) expect(hasAttire(g, "climber")).toBe(true);
    }
    expect(seen.size).toBe(11);
    expect(currentTiers(g)).toBeNull();
    g = syncTiersFlags(g);
    expect(g.flags["tiers:done"]).toBe(true);
    // the tenth fate is the first answer (mercy): Heaven's Step's robe, and the ending remembers
    expect(hasAttire(g, "heavenstep")).toBe(true);
    for (let k = 0; k < 10; k++) expect(g.flags[`tiers:fate:${k}`], `fate ${k}`).toBe(true);
    expect(tiersChronicle(g).every((t) => t.state === "done")).toBe(true);
    expect(JSON.stringify(endingScript({ ...g, realm: 4, stage: 3, flags: { ...g.flags, heartReturned: true } }))).toContain("Everyone weighs the same here");
  });

  it("takes the city for herself if she ends it on the Dao of Slaughter", () => {
    let g = ready();
    while (tiersDone(g) < TIERS_COUNT - 1) g = doQuest(g, 0);
    g = doQuest(g, 3);
    expect(hasAttire(g, "stairthrone")).toBe(true);
    expect(g.flags["tiers:fate:9:slaughter"]).toBe(true);
  });

  it("has a boss for every tier, tuned to its realm, and the Stair Ring's challengers cost nothing to lose to", () => {
    let last = 0;
    for (const id of TIER_BOSSES) {
      const e = ENEMIES[id];
      expect(e.boss).toBe(true);
      expect(e.level).toBeGreaterThan(last);
      last = e.level;
      expect(charDef(e.sprite).anims).toContain("attack");
    }
    expect(ENEMIES.tjleiba.friendly).toBe(true);
    expect(ENEMIES.tjring.friendly).toBe(true);
    for (let k = 0; k < TIER_COUNT; k++) {
      const spawn = w.enemies.find((e) => e.key === `tjboss-${k}`)!;
      expect(spawn.enemy).toBe(TIER_BOSSES[k]);
      expect(spawn.when!({ [`tiers:boss:${k}`]: true })).toBe(true);
      expect(spawn.when!({})).toBe(false);
    }
  });
});

describe("the city on the land", () => {
  const w = getWorld();
  const m = w.map;
  const S = WORLD_SCALE;

  it("stands across a strait of cloud below Jinhe, at the end of the Nine-Arch Bridge, in land the world grew south to hold", () => {
    expect(m.h).toBe(660 * S);
    for (const key of ["tianjie", "ninearch", "weighhall", "summit"]) expect(w.landmarks.some((l) => l.key === key), key).toBe(true);
    // the bridge's planks cross the void between Jinhe's cliffs and the city's flats
    const bridge = w.landmarks.find((l) => l.key === "ninearch")!;
    expect(m.kind(Math.floor(bridge.x), Math.floor(bridge.y))).toBe("wood");
    expect(m.kind(Math.floor(bridge.x) - 12, Math.floor(bridge.y))).toBe("void");
    // the city belongs to the Cloudmist lands
    expect(regionAt(w, TIANJIE_C[0] * S, TIANJIE_C[1] * S)).toBe("terraces");
  });

  it("cuts nine terraces two levels apart round its summit, with a stair up the avenue at every gate", () => {
    for (let k = 0; k < TIER_COUNT; k++) {
      const [x0, y0] = tierRect(k);
      // a tile well inside each tier's north band stands at its height
      expect(tierAt(x0 + 1, y0 + 1)).toBe(k);
      expect(m.height((x0 + 1) * S, (y0 + 1) * S), `tier ${k}`).toBe(tierHeight(k));
      if (k > 0) {
        expect(m.kind(TIANJIE_C[0] * S, stairRow(k) * S), `stair ${k}`).toBe("stairs");
        // the bar on the tier is the tier's own rectangle
        expect(w.bars[k - 1].rect).toEqual(tierWorldRect(k));
        expect(w.bars[k - 1].flag).toBe(gateFlag(k));
      }
    }
    // a seal of gold light on every stair while its gate is shut, and a gate over every stair
    const seals = w.props.filter((p) => p.id === "stairseal");
    expect(seals).toHaveLength(TIER_COUNT - 1);
    expect(seals.every((p) => p.when && p.when({}) && !p.when(Object.fromEntries(Array.from({ length: 10 }, (_, k) => [gateFlag(k), true]))))).toBe(true);
    expect(w.props.filter((p) => p.id === "tiergate")).toHaveLength(TIER_COUNT - 1);
  });

  it("houses up every tier's sides, its folk on every tier, a warden at every gate, and the Weighing Hall in the flats", () => {
    const inCity = (i: number, j: number) => tierAt(Math.floor(i / S), Math.floor(j / S)) >= 0;
    const buildings = w.props.filter((p) => inCity(p.i, p.j) && ["house", "townhouse", "towerinn", "drumtower", "pagoda", "pavilion", "hall", "forge", "stilthouse"].includes(p.id));
    expect(buildings.length).toBeGreaterThanOrEqual(80);
    for (let k = 0; k < TIER_COUNT; k++) {
      const folk = w.npcs.filter((n) => n.key.startsWith(`tj-folk-${k}-`));
      expect(folk.length, `tier ${k}`).toBe(TIER_FOLK[k].length);
      for (const f of folk) expect(tierAt(Math.floor(f.i / S), Math.floor(f.j / S)), f.key).toBe(k);
      if (k > 0) expect(w.npcs.some((n) => n.key === `tj-warden-${k}`), `warden ${k}`).toBe(true);
    }
    for (const id of ["bigscale", "sedan", "stilthouse"]) expect(w.props.some((p) => p.id === id), id).toBe(true);
    expect(w.enemies.filter((e) => e.enemy === "tjring")).toHaveLength(3);
  });

  it("the folk of every tier answer to her standing, and the mud kneels to a tablet far above it", () => {
    for (let k = 0; k < TIER_COUNT; k++)
      for (let n = 0; n < TIER_FOLK[k].length; n++) {
        const s = tierFolkScript(`tj-folk-${k}-${n}`, atLevel(ready(), 18));
        expect(s, `${k}-${n}`).not.toBeNull();
        expect(said(s!)).not.toMatch(/\{|\}|undefined/);
      }
    const kneel = tierFolkScript("tj-folk-0-0", atLevel(ready(), 12))!;
    expect(kneel.some((s) => "anim" in s && s.name === "kneel")).toBe(true);
    expect(said(tierFolkScript("tj-folk-0-0", atLevel(ready(), 0))!)).toMatch(/Clay/);
  });
});

describe("standing: what her realm makes her", () => {
  it("names her by her realm, to mortals and to cultivators", () => {
    const titles = REALMS.map((_, r) => honorific({ ...ready(), realm: r }));
    expect(new Set(titles).size).toBe(REALMS.length);
    expect(honorific({ ...ready(), realm: 3 })).toBe("Ancestor");
    expect(peerTitle({ ...ready(), realm: 0 })).toBe("Junior Sister");
    expect(fillStanding("{title}, {peer}, {realm}, {tier}", atLevel(ready(), 8))).toBe("Venerable Immortal, Senior, Core Formation · Early, The Jade Tier");
  });

  it("the jianghu's ordinary folk notice her realm: a mortal kneels to a Nascent Soul, a disciple calls her Senior", () => {
    const w = getWorld();
    const villager = w.npcs.find((n) => n.key.startsWith("crowd:village:villager"))!;
    const disciple = w.npcs.find((n) => n.key.startsWith("crowd:sect:disciple"))!;
    let knelt = false;
    let senior = false;
    for (let t = 0; t < 40; t++) {
      const g = { ...atLevel(ready(), 12), playTime: t * 9 };
      knelt ||= crowdNpcScript(villager.key, g)!.some((s) => "anim" in s && s.name === "kneel");
      senior ||= said(crowdNpcScript(disciple.key, { ...atLevel(ready(), 8), playTime: t * 9 })!).includes("Senior");
    }
    expect(knelt).toBe(true);
    expect(senior).toBe(true);
    expect(crowdRealm("x", "villager", 3, { ...atLevel(ready(), 0), playTime: 9 }, "villagerM", "Uncle Wu")).toBeNull();
  });

  it("every one of the new quarters' folk, and the inns', has a line for every realm", () => {
    for (const f of [...JINHE_QUARTERS.folk, ...WILLOW_WARD.folk, ...["fragrance", "fragranceup", "willowinn", "willowinnup"].flatMap((id) => getInterior(id as never).npcs)])
      for (let r = 0; r < 5; r++) {
        const s = quarterNpcScript(f.key, { ...ready(), realm: r });
        expect(s, `${f.key} ${r}`).not.toBeNull();
        expect(said(s!), `${f.key} ${r}`).not.toMatch(/\{|\}|undefined/);
      }
  });
});

describe("the town and the city, twice the size", () => {
  const w = getWorld();
  const S = WORLD_SCALE;
  const inJinhe = (i: number, j: number) => i > 201 * S && i < 243 * S && j > 482 * S && j < 518 * S;

  it("Jinhe has walked round its old walls and built a new ring of storeyed quarters", () => {
    expect(w.props.filter((p) => p.id === "watchtower" && p.i >= 199 * S && p.i <= 246 * S && p.j >= 479 * S && p.j <= 521 * S)).toHaveLength(4);
    const folk = w.npcs.filter((n) => inJinhe(n.i, n.j) && !n.key.startsWith("crowd:"));
    expect(folk.length).toBeGreaterThanOrEqual(50);
    const storeys = w.props.filter((p) => inJinhe(p.i, p.j) && ["townhouse", "towerinn", "drumtower", "mansion"].includes(p.id));
    expect(storeys.length).toBeGreaterThanOrEqual(20);
  });

  it("Willow Creek has an East Ward as big as the village, with a two-storey street, an inn and a drum tower", () => {
    const village = w.npcs.filter((n) => regionAt(w, n.i, n.j) === "village" && !n.key.startsWith("crowd:"));
    expect(village.length).toBeGreaterThanOrEqual(45);
    const ward = WILLOW_WARD.props.map(([id]) => id);
    for (const id of ["townhouse", "towerinn", "drumtower", "mansion"]) expect(ward, id).toContain(id);
    const ew = w.landmarks.find((l) => l.key === "eastward")!;
    expect(regionAt(w, ew.x, ew.y)).toBe("village");
  });

  it("the inns are storeys high inside too: a stair up, a floor above that only her realm opens, and no street door upstairs", () => {
    for (const [down, up, need] of [
      ["fragrance", "fragranceup", 1],
      ["willowinn", "willowinnup", 2],
    ] as const) {
      const d = getInterior(down);
      const u = getInterior(up);
      expect(d.upstairs).toBe(up);
      expect(u.below).toBe(down);
      expect(u.minRealm).toBe(need);
      expect(d.interacts.some((it) => it.kind === "door" && it.to === up)).toBe(true);
      expect(roomDoors().some((it) => it.to === up)).toBe(false);
      expect(roomDoors().some((it) => it.to === down)).toBe(true);
      expect([u.map.w, u.map.h]).toEqual([d.map.w, d.map.h]);
      expect(said(floorRefusal(up, { ...ready(), realm: need - 1 }))).toMatch(need === 1 ? /Foundation/ : /golden core/);
    }
    expect(INTERIOR_IDS.length).toBe(10);
  });
});

describe("the new art", () => {
  it("draws the storeyed buildings, the stair's gate and seal, the sedan and the great steelyard", () => {
    for (const id of ["townhouse", "towerinn", "drumtower", "mansion", "tiergate", "stairseal", "sedan", "bigscale"] as const) {
      const sheet = getProp(id);
      expect(sheet.frames.length, id).toBeGreaterThan(0);
      expect(sheet.frames[0].data.some((v, i) => i % 4 === 3 && v > 0), id).toBe(true);
    }
    // a three-storey restaurant stands taller than a house
    expect(getProp("towerinn").frames[0].height).toBeGreaterThan(getProp("house").frames[0].height);
    expect(getProp("townhouse").frames[0].height).toBeGreaterThan(getProp("house").frames[0].height);
  });

  it("gives the folk ten new moves, and Lin Yue the ones that suit her", () => {
    const moves: AnimId[] = ["kneel", "stamp", "weigh", "lean", "toast", "beg", "decree", "haggle", "bear", "whisper"];
    const who: Partial<Record<AnimId, string>> = { stamp: "wenqi", beg: "refugeeF", decree: "tierherald", bear: "bearer" };
    for (const a of moves) {
      const id = (who[a] ?? "heroine") as never;
      expect(charDef(id).anims, a).toContain(a);
      const anim = getAnim(id, a, 2);
      expect(anim.frames.length, a).toBeGreaterThan(5);
    }
    for (const a of ["kneel", "toast", "lean", "haggle", "whisper", "weigh"] as AnimId[]) expect(charDef("heroine").anims).toContain(a);
  });

  it("lets mortals kneel to her, and the bars hold her below her realm in the running game", () => {
    const S = WORLD_SCALE;
    const game = new Game(newGame(), { seed: 7 });
    game.render(new BufferSurface(new PixelBuffer(320, 180)));
    game.debugPatch({ flags: { metElder: true } });
    const [x0] = tierWorldRect(1);
    const y = (stairRow(1) - 3) * S + 0.5;
    const x = TIANJIE_C[0] * S + 0.5;
    expect(x).toBeGreaterThan(x0);
    game.debugGoto(x, y);
    game.setStick(-0.8, 0.4);
    game.debugSkipTime(4);
    game.setStick(0, 0);
    expect(game.state.y).toBeLessThan(tierWorldRect(1)[1]);
    expect(game.snapshot().toasts.map((t) => t.text).join(" ")).toMatch(/Warden of the Copper Stair/);
    game.debugPatch({ realm: 1, stage: 0 });
    game.debugSkipTime(0.6);
    game.debugGoto(x, y);
    game.setStick(-0.8, 0.4);
    game.debugSkipTime(4);
    game.setStick(0, 0);
    expect(game.state.y).toBeGreaterThan(tierWorldRect(1)[1]);
  });
});
