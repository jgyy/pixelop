import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS } from "@/game/engine/realms";
import { ENEMIES } from "@/game/engine/enemies";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { currentSeas, SEA_MAIN_KINDS, seasBreath, seasChronicle, seasCultivated, seasDone, seasHunt, seasLandmark, seasLog, seasOpen, seasQuests, seasTalk, SEAS_BOOK, SEAS_COUNT, syncSeasFlags } from "@/game/story/seas";
import { SEA_BOOKS } from "@/game/story/seasBooks";
import { fillStanding } from "@/game/story/standing";
import { getWorld, regionAt } from "@/game/world/continent";
import { CAVE_IDS, CAVE_MOUTH, getCave } from "@/game/world/caves";
import { inSea, isleByKey, ISLES, onIsle, SEA_BOOK_COUNT, SEA_BOSSES, SEA_CAST, SEA_FOES, seaFolkKey, seaGuideKey, seaPatronKey } from "@/game/world/isles";
import { charDef, hasAnim, type HumanId } from "@/game/art/characters";
import { getProp } from "@/game/art/props";
import { propModel } from "@/game/three/propModels";
import { LIQUID } from "@/game/world/tilemap";
import { WORLD_SCALE } from "@/game/world/layout";
import { AREA_IDS } from "@/game/world/ids";

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

const ready = (): GameState => atLevel({ ...newGame(), flags: { metElder: true, metZhou: true, villageSaved: true } }, 2);

/** Do whatever the current quest asks, as the game would. */
function doQuest(g: GameState, pick: number): GameState {
  const q = currentSeas(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  g = syncSeasFlags(g);
  switch (q.kind) {
    case "beat":
    case "rite":
    case "favour":
    case "trade":
    case "tale":
      return play(g, seasTalk(q.npc!, g)!, [pick]);
    case "hunt":
      for (let k = 0; k < q.count; k++) {
        const r = seasHunt(g, q.foe!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "sit":
      for (let k = 0; k < q.count; k++) {
        const r = seasBreath(g, q.region!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "visit":
      return play(g, seasLandmark(q.landmark!, g, { night: q.how === "night", riding: q.how === "ride", flying: q.how === "fly" })!);
    case "gate":
      return play(g, seasCultivated(g)!);
    case "duel": {
      const boss = SEA_CAST[q.book].boss;
      expect(preBattleScript(boss, `seaboss-${q.book}`, g), boss).not.toBeNull();
      return play(g, victoryScript(boss, `seaboss-${q.book}`, "harbor", g), [pick]);
    }
  }
}

describe("the Sea of Pearls and the Nine Springs", () => {
  const all = seasQuests();
  const w = getWorld();
  const caveNpcs = CAVE_IDS.flatMap((id) => getCave(id).npcs);
  const npcKeys = new Set([...w.npcs, ...caveNpcs].map((n) => n.key));
  const landmarks = new Set(w.landmarks.map((l) => l.key));

  it("is twelve hundred quests in six books, main and side, sending her to every land of the jianghu", () => {
    expect(all).toHaveLength(SEAS_COUNT);
    expect(SEAS_COUNT).toBeGreaterThanOrEqual(1000);
    expect(SEA_BOOKS).toHaveLength(SEA_BOOK_COUNT);
    expect(all.filter((q) => q.arc === "main").length).toBeGreaterThan(150);
    expect(all.filter((q) => q.arc === "side").length).toBeGreaterThan(900);
    for (const q of all) expect(q.arc === "main", `${q.id}`).toBe(SEA_MAIN_KINDS.includes(q.kind));
    for (let b = 0; b < SEA_BOOK_COUNT; b++) {
      const book = all.slice(b * SEAS_BOOK, (b + 1) * SEAS_BOOK);
      expect(book[0].kind).toBe("beat");
      expect(book[SEAS_BOOK / 2].kind).toBe("gate");
      expect(book[SEAS_BOOK - 1].kind).toBe("duel");
      expect(SEA_BOOKS[b].beats.filter((x) => x.choice).length, `book ${b}`).toBeGreaterThanOrEqual(1);
      for (const k of ["rite", "favour", "trade", "tale", "hunt", "sit", "visit"]) expect(book.some((q) => q.kind === k), `book ${b} ${k}`).toBe(true);
    }
    const g = ready();
    for (const q of all) {
      for (const t of [q.objective, q.done, q.title]) expect(fillStanding(t, g), `${q.id}`).not.toMatch(/\{|\}|undefined/);
      if (q.npc) expect(npcKeys.has(q.npc), `${q.id} ${q.npc}`).toBe(true);
      if (q.landmark) expect(landmarks.has(q.landmark), `${q.id} ${q.landmark}`).toBe(true);
    }
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    // its sittings reach every land there is, from the sect in the sky to the eastern shore
    const lands = new Set(all.filter((q) => q.kind === "sit").map((q) => q.region));
    for (const id of AREA_IDS) expect(lands.has(id), id).toBe(true);
    // and its walks reach places all over the mainland, not only the isles
    expect(new Set(all.filter((q) => q.kind === "visit").map((q) => q.landmark)).size).toBeGreaterThan(20);
  });

  it("opens once Elder Mo has sent her out, with Pearl-Mother Bei on Pearlgate Isle", () => {
    expect(seasOpen({ ...ready(), realm: 0, stage: 1 })).toBe(false);
    expect(seasOpen({ ...ready(), flags: {} })).toBe(false);
    expect(seasLog(ready())!.objective).toMatch(/Pearlgate/);
    expect(all[0].npc).toBe(seaPatronKey(0));
  });

  it("asks her to grow stronger before each book's second half", () => {
    let g = ready();
    while (seasDone(g) < SEAS_BOOK / 2) g = doQuest(g, 0);
    g = atLevel(g, 2);
    expect(currentSeas(g)!.kind).toBe("gate");
    expect(seasLog(g)!.objective).toMatch(/Cultivate/);
  });

  it("can be walked to its end: every beat, rite, favour, trouble and fate", { timeout: 120_000 }, () => {
    let g = ready();
    const seen = new Set<string>();
    for (let n = 0; n < SEAS_COUNT; n++) {
      const q = currentSeas(g)!;
      expect(q.id, `quest ${n}`).toBe(n);
      g = doQuest(g, n === SEAS_COUNT - 1 ? 0 : n % 4);
      expect(seasDone(g), `${n} ${q.kind} ${q.title}`).toBe(n + 1);
      seen.add(q.kind);
    }
    expect(seen.size).toBe(10);
    expect(currentSeas(g)).toBeNull();
    g = syncSeasFlags(g);
    expect(g.flags["seas:done"]).toBe(true);
    for (let k = 0; k < SEA_BOOK_COUNT; k++) expect(g.flags[`seas:fate:${k}`], `fate ${k}`).toBe(true);
    expect(seasChronicle(g).every((p) => p.state === "settled")).toBe(true);
    expect(JSON.stringify(endingScript({ ...g, realm: 4, stage: 3, flags: { ...g.flags, heartReturned: true } }))).toContain("Pearlgate");
  });

  it("has a trouble for every book, tuned to its realm, waiting where the book says, and foes about each isle and court", () => {
    let last = 0;
    SEA_BOSSES.forEach((id, k) => {
      const e = ENEMIES[id];
      expect(e.boss).toBe(true);
      expect(e.level).toBeGreaterThan(last);
      last = e.level;
      expect(charDef(e.sprite).anims).toContain("attack");
      const spawns = [...w.enemies, ...CAVE_IDS.flatMap((c) => getCave(c).enemies)].filter((x) => x.key === `seaboss-${k}`);
      expect(spawns, id).toHaveLength(1);
      expect(spawns[0].enemy).toBe(id);
      expect(spawns[0].when!({ [`seas:boss:${k}`]: true })).toBe(true);
      expect(spawns[0].when!({})).toBe(false);
    });
    const everywhere = [...w.enemies, ...CAVE_IDS.flatMap((c) => getCave(c).enemies)];
    for (const [k, id] of SEA_FOES.entries()) {
      expect(ENEMIES[id].boss).toBeFalsy();
      expect(everywhere.filter((e) => e.enemy === id).length, id).toBeGreaterThanOrEqual(3);
      expect(SEA_CAST[k].foe).toBe(id);
      expect(charDef(ENEMIES[id].sprite).anims).toContain("attack");
    }
  });

  it("stands every book's people where they live, and gives each the manners its lines ask of them", () => {
    for (let b = 0; b < SEA_BOOK_COUNT; b++) {
      const C = SEA_CAST[b];
      for (const key of [seaPatronKey(b), seaGuideKey(b), ...C.folk.map((_, n) => seaFolkKey(b, n))]) expect(npcKeys.has(key), key).toBe(true);
      const keys = (C.isle === "deep" ? getCave("underworld").npcs : w.npcs).map((n) => n.key);
      expect(keys).toContain(seaPatronKey(b));
      for (const p of [C.patron, C.guide, ...C.folk]) if (p.anim) expect(hasAnim(p.char, p.anim), `${p.name} ${p.anim}`).toBe(true);
      for (const beat of SEA_BOOKS[b].beats)
        for (const l of beat.lines)
          if (!Array.isArray(l) && l.a !== "hero") {
            const who = l.a === "sp-patron" ? C.patron : l.a === "sp-guide" ? C.guide : C.folk[Number(l.a.slice(-1))];
            expect(hasAnim(who.char as HumanId, l.n), `${who.name} ${l.n}`).toBe(true);
          } else if (!Array.isArray(l)) expect(hasAnim("heroine", l.n), `heroine ${l.n}`).toBe(true);
    }
  });

  it("speaks to her as a stranger until her book reaches them", () => {
    expect(said(npcScript(seaFolkKey(2, 0), ready()))).toMatch(/stranger/);
    expect(said(npcScript(seaFolkKey(4, 0), ready()))).toMatch(/Meng Po/);
    let g = ready();
    while (seasDone(g) < 3) g = doQuest(g, 0);
    expect(said(npcScript(seaFolkKey(0, 1), g))).not.toMatch(/stranger/);
  });
});

describe("the Sea of Pearls on the map", () => {
  const w = getWorld();
  const m = w.map;
  const S = WORLD_SCALE;

  it("is real sea, deep and shallow, south of the Tidewater Reach, belonging to the eastern shore", () => {
    let deep = 0;
    let shallow = 0;
    for (let j = 540; j < 800; j += 2)
      for (let i = 300; i < 648; i += 2) {
        if (!inSea(i, j)) continue;
        const k = m.kind(i * S, j * S);
        if (k === "deep") deep++;
        if (k === "water") shallow++;
      }
    expect(deep).toBeGreaterThan(5000);
    expect(shallow).toBeGreaterThan(500);
    expect(regionAt(w, 560 * S, 650 * S)).toBe("harbor");
  });

  it("raises each isle in a shape of its own, with its biggest isles on the world map", () => {
    for (const s of ISLES) {
      let land = 0;
      for (let j = s.c[1] - 40; j <= s.c[1] + 40; j++) for (let i = s.c[0] - 40; i <= s.c[0] + 40; i++) if (onIsle(s, i, j) && !LIQUID[m.kind(i * S, j * S)] && m.kind(i * S, j * S) !== "void") land++;
      expect(land, s.key).toBeGreaterThan(s.landmark ? 120 : 12);
      if (s.landmark) expect(w.landmarks.some((l) => l.key === `sea-${s.key}`), s.key).toBe(true);
    }
    // the crescent's heart is open water between its horns, and the coral ring holds a lagoon
    const cr = isleByKey("crescent");
    expect(LIQUID[m.kind(cr.c[0] * S - 6 * S, cr.c[1] * S)]).toBeTruthy();
    const at = isleByKey("atoll");
    expect(LIQUID[m.kind(at.c[0] * S, at.c[1] * S)]).toBeTruthy();
  });

  it("strings the isles together with bridges, walkable from Hailing's quay to Penglai and the Stairlands", () => {
    // every isle's people can be walked to from the sect: the world test checks reachability of every NPC; here, the bridges are planks over water
    let planks = 0;
    for (let j = 530 * S; j < 760 * S; j++) for (let i = 280 * S; i < 640 * S; i++) if (m.kind(i, j) === "wood" && inSea(Math.floor(i / S), Math.floor(j / S))) planks++;
    expect(planks).toBeGreaterThan(1000);
  });

  it("builds the isles' houses in odd shapes: round houses, eight-sided towers, beehive huts and a crescent hall", () => {
    for (const id of ["tulou", "octotower", "domehut", "crescenthall"] as const) {
      expect(w.props.filter((p) => p.id === id).length, id).toBeGreaterThanOrEqual(1);
      expect(getProp(id).frames[0].width, id).toBeGreaterThan(8);
      expect(propModel(id).indices.length, id).toBeGreaterThan(300);
    }
  });

  it("opens the Nine Springs under Ghost Gate Isle and the Drowned Palace under the Dragon King's", () => {
    for (const id of ["underworld", "drowned"] as const) {
      const d = getCave(id);
      expect(d.map.w).toBeGreaterThanOrEqual(60);
      const [x, y] = CAVE_MOUTH[id].at;
      expect(w.props.some((p) => p.id === "cavemouth" && p.i === x * S && p.j === y * S), id).toBe(true);
    }
    expect(onIsle(isleByKey("ghostgate"), ...CAVE_MOUTH.underworld.at)).toBe(true);
    expect(onIsle(isleByKey("dragonking"), ...CAVE_MOUTH.drowned.at)).toBe(true);
    const u = getCave("underworld");
    expect(u.map.w * u.map.h).toBeGreaterThan(10000);
    expect(u.npcs.map((n) => n.key)).toEqual(expect.arrayContaining([seaPatronKey(4), seaPatronKey(5)]));
  });
});
