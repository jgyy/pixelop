import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS } from "@/game/engine/realms";
import { ENEMIES } from "@/game/engine/enemies";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { azureReply, currentFounding, disciplesAfter, fillFounding, FOUNDING_BOOK, FOUNDING_COUNT, FOUNDING_KINDS, foundingCultivated, foundingDone, foundingHunt, foundingLog, foundingOpen, foundingQuests, foundingTalk, sectSheet, springFate, stewardScript, syncFoundingFlags } from "@/game/story/founding";
import { FOUNDING_BOOKS_TEXT } from "@/game/story/foundingBooks";
import { getWorld } from "@/game/world/continent";
import { BUILDINGS, builtFlag, cityGodKey, FACILITIES, FOUNDING_BOOKS, FOUNDING_BOSSES, FOUNDING_C, GODS, sectName } from "@/game/world/founding";
import { COURTS } from "@/game/world/courts";
import { charDef, hasAnim, type HumanId } from "@/game/art/characters";
import { placementTiles } from "@/game/world/areas";
import { WORLD_SCALE } from "@/game/world/layout";

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
const closeups = (steps: Step[]) => {
  const out: Step[] = [];
  const walk = (ss: Step[]) => ss.forEach((s) => (out.push(s), "choose" in s && s.choose.forEach((c) => walk(c.then))));
  walk(steps);
  return out.filter((s) => "closeup" in s);
};
const said = (steps: Step[]) => steps.map((s) => ("text" in s ? s.text : "closeup" in s ? s.closeup.text : "narrate" in s ? s.narrate.join(" ") : "toast" in s ? s.toast : "")).join(" ");

function atLevel(g: GameState, level: number): GameState {
  let n = level;
  for (let r = 0; r < REALMS.length; r++) {
    if (n < REALMS[r].stages) return { ...g, realm: r, stage: n, cultivation: 0 };
    n -= REALMS[r].stages;
  }
  return g;
}
const ready = (): GameState => atLevel({ ...newGame(), flags: { metElder: true, metZhou: true, villageSaved: true } }, 4);

/** Do whatever the current quest asks, as the game would; returns the state and the steps it played. */
function doQuest(g: GameState, pick: number): { g: GameState; steps: Step[] } {
  const q = currentFounding(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  g = syncFoundingFlags(g);
  switch (q.kind) {
    case "hunt": {
      const all: Step[] = [];
      for (let k = 0; k < q.count; k++) {
        const r = foundingHunt(g, q.foe!);
        g = r.state;
        if (r.steps) {
          all.push(...r.steps);
          g = play(g, r.steps);
        }
      }
      return { g, steps: all };
    }
    case "gate": {
      const steps = foundingCultivated(g)!;
      return { g: play(g, steps), steps };
    }
    case "duel": {
      const boss = FOUNDING_BOSSES[q.book];
      const pre = preBattleScript(boss, `fdboss-${q.book}`, g)!;
      const steps = [...pre, ...victoryScript(boss, `fdboss-${q.book}`, "desert", g)];
      return { g: play(g, steps, [pick]), steps };
    }
    default: {
      const steps = foundingTalk(q.npc!, g)!;
      return { g: play(g, steps, [pick]), steps };
    }
  }
}

describe("the Founding", () => {
  const all = foundingQuests();
  const w = getWorld();
  const npcs = new Map(w.npcs.map((n) => [n.key, n]));

  it("is a thousand main quests in five books", () => {
    expect(all).toHaveLength(FOUNDING_COUNT);
    expect(FOUNDING_COUNT).toBe(1000);
    expect(FOUNDING_BOOKS_TEXT).toHaveLength(FOUNDING_BOOKS);
    for (const q of all) {
      expect(q.arc).toBe("main");
      expect(FOUNDING_KINDS).toContain(q.kind);
    }
    for (let b = 0; b < FOUNDING_BOOKS; b++) {
      const book = all.slice(b * FOUNDING_BOOK, (b + 1) * FOUNDING_BOOK);
      expect(book[0].kind).toBe("beat");
      expect(book[FOUNDING_BOOK / 2].kind).toBe("gate");
      expect(book[FOUNDING_BOOK - 1].kind).toBe("duel");
      for (const k of ["beat", "recruit", "lecture", "oversee", "petition", "hunt", "rite", "judge"]) expect(book.some((q) => q.kind === k), `book ${b} ${k}`).toBe(true);
      expect(FOUNDING_BOOKS_TEXT[b].beats.filter((x) => x.choice).length, `book ${b}`).toBeGreaterThanOrEqual(2);
    }
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    // every hall is raised by a quest of its own, in its own book
    for (const b of BUILDINGS) expect(all.filter((q) => q.kind === "build" && q.building === b.key).map((q) => q.book), b.key).toEqual([b.book]);
  });

  it("plays every one of its thousand quests with a close-up, and no two close-ups are alike", () => {
    const keys = new Set(all.map((q) => `${q.closeup.who}|${q.closeup.shot}|${q.closeup.text}`));
    expect(keys.size).toBe(FOUNDING_COUNT);
    expect(new Set(all.map((q) => q.closeup.scene)).size).toBe(FOUNDING_COUNT);
    for (const q of all) {
      expect(charDef(q.closeup.who as HumanId).portrait, `${q.id} ${q.closeup.who}`).toBe(true);
      expect(q.closeup.shot.length, `${q.id}`).toBeGreaterThan(8);
      expect(q.closeup.text.length, `${q.id}`).toBeGreaterThan(8);
    }
  });

  it("only sends her to people who are really in the world, and there at the time", () => {
    const g0 = ready();
    for (const q of all) {
      for (const t of [q.objective, q.done, q.title, q.closeup.text, q.closeup.shot]) expect(fillFounding(t, g0), `${q.id}`).not.toMatch(/\{|\}|undefined/);
      if (!q.npc) continue;
      const n = npcs.get(q.npc);
      expect(n, `${q.id} ${q.npc}`).toBeDefined();
      const flags = syncFoundingFlags({ ...g0, counters: { ...g0.counters, fd: q.id } }).flags;
      if (n!.when) expect(n!.when(flags), `${q.id} ${q.kind} ${q.npc}`).toBe(true);
    }
    // the hunts' foes and each book's trouble are about the basin while the book is hers
    for (let b = 0; b < FOUNDING_BOOKS; b++) {
      const flags = syncFoundingFlags({ ...g0, counters: { ...g0.counters, fd: b * FOUNDING_BOOK + FOUNDING_BOOK - 1 } }).flags;
      const here = w.enemies.filter((e) => !e.when || e.when(flags));
      expect(here.some((e) => e.enemy === FOUNDING_BOSSES[b]), `book ${b} boss`).toBe(true);
      expect(here.filter((e) => e.key.startsWith(`fdfoe-${b}-`)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it("opens once the far roads are open and she has reached Foundation Establishment", () => {
    expect(foundingOpen({ ...newGame(), flags: { metElder: true, metZhou: true } })).toBe(false);
    expect(foundingOpen(ready())).toBe(true);
    expect(foundingOpen({ ...ready(), flags: { metElder: true } })).toBe(false);
    expect(foundingLog(ready())!.chapter).toMatch(/Founding · I/);
  });

  it("is walked to its end: halls raised, elders seated, disciples taken in, gods come down, the sect named and founded", () => {
    let g = ready();
    const shots = new Set<string>();
    let played = 0;
    for (let n = 0; n < FOUNDING_COUNT; n++) {
      const q = currentFounding(g)!;
      expect(q.id).toBe(n);
      const r = doQuest(g, n % 3);
      for (const c of closeups(r.steps)) shots.add(JSON.stringify("closeup" in c ? [c.closeup.who, c.closeup.shot] : 0));
      played += closeups(r.steps).length;
      g = r.g;
      expect(foundingDone(g), `${n} ${q.kind}`).toBe(n + 1);
    }
    expect(played).toBeGreaterThanOrEqual(FOUNDING_COUNT);
    expect(g.flags["fd:done"]).toBe(true);
    expect(sectName(g.flags).hanzi).not.toBe("无名宗");
    for (const b of BUILDINGS) expect(g.flags[builtFlag(b.key)], b.key).toBe(true);
    const sheet = sectSheet(g)!;
    expect(sheet.elders.every((e) => e.seated)).toBe(true);
    expect(sheet.gods.every((x) => x.here)).toBe(true);
    expect(sheet.disciples).toBeGreaterThan(200);
    expect(sheet.tithe).toBeGreaterThan(100);
    for (let b = 0; b < FOUNDING_BOOKS; b++) expect(g.flags[`fd:fate:${b}`]).toBe(true);
    expect(foundingLog(g)!.title).toBe("The Sect Is Founded");
    expect(JSON.stringify(endingScript({ ...g, flags: { ...g.flags, heartReturned: true } }))).toContain("Yellow Sands");
  });

  it("lets her name the sect for her Dao, and calls it by that name ever after", () => {
    let g = ready();
    while (foundingDone(g) <= 245) g = doQuest(g, 3).g;
    expect(g.flags["fd:name:slaughter"]).toBe(true);
    expect(fillFounding("{Sect} keeps its gate.", g)).toBe("The Blood Lotus Sect keeps its gate.");
    let h = ready();
    while (foundingDone(h) <= 45) h = doQuest(h, 1).g;
    expect(h.flags["fd:name:mercy"]).toBe(true);
    expect(fillFounding("{sect}", h)).toBe("the Merciful Lotus Sect");
  });

  it("raises its halls in the world as the tale reaches them, and they block the ground only once they stand", () => {
    const g0 = ready();
    for (const b of BUILDINGS) {
      const parts = w.props.filter((p) => p.solid && p.when && p.when({ [builtFlag(b.key)]: true }) && !p.when({}));
      expect(parts.length, b.key).toBeGreaterThanOrEqual(b.parts.length);
      const before = syncFoundingFlags({ ...g0, counters: { fd: all.find((q) => q.building === b.key && q.kind === "build")!.id } }).flags;
      const after = syncFoundingFlags({ ...g0, counters: { fd: all.find((q) => q.building === b.key && q.kind === "build")!.id + 1 } }).flags;
      expect(before[builtFlag(b.key)], b.key).toBe(false);
      expect(after[builtFlag(b.key)], b.key).toBe(true);
    }
    // nobody ever stands, spawns or waits where a raised hall's walls will go
    const raised = new Set<number>();
    for (const p of w.props) {
      if (!p.solid) continue;
      const [i0, j0, i1, j1] = placementTiles(p);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) raised.add(j * w.map.w + i);
    }
    for (const x of [...w.npcs, ...w.enemies, ...w.interacts]) expect(raised.has(x.j * w.map.w + x.i), x.key).toBe(false);
    for (const n of w.npcs) for (const s of n.jobs ?? []) expect(raised.has(s.at[1] * w.map.w + s.at[0]), `${n.key} station`).toBe(false);
  });

  it("keeps its people busy: every worker goes round stations they can stand on, doing jobs they know how to do", () => {
    const workers = w.npcs.filter((n) => n.jobs);
    expect(workers.length).toBeGreaterThan(80);
    for (const n of workers) {
      expect(n.jobs!.length, n.key).toBeGreaterThanOrEqual(2);
      expect(n.jobs![0].at, n.key).toEqual([n.i, n.j]);
      for (const s of n.jobs!) {
        expect(hasAnim(n.char, s.anim), `${n.key} ${n.char} ${s.anim}`).toBe(true);
        expect(w.map.standable(...s.at), `${n.key} station ${s.at}`).toBe(true);
        expect(Math.hypot(s.at[0] - n.i, s.at[1] - n.j), `${n.key} keeps to its work`).toBeLessThan(32);
      }
    }
    // the capitals' facilities, each with its workers, and a City God at every temple door
    COURTS.forEach((C, b) => {
      expect(npcs.has(cityGodKey(b)), C.capital).toBe(true);
      for (const f of FACILITIES) expect(workers.filter((n) => n.key.startsWith(`fd-fac-${b}-${f.key}-`)).length, `${C.capital} ${f.key}`).toBe(f.workers.length);
    });
  });

  it("brings the Celestial Court down to the basin: the Jade Emperor, the Queen Mother of the West and the gods", () => {
    for (const g of GODS) {
      expect(npcs.has(g.key), g.id).toBe(true);
      expect(charDef(g.char).portrait).toBe(true);
    }
    expect(GODS.map((g) => g.char)).toEqual(expect.arrayContaining(["jadeemperor", "queenmother"]));
    const book = JSON.stringify(FOUNDING_BOOKS_TEXT[3]);
    for (const k of ["fd-god-jade", "fd-god-queen", "fd-god-hearth", "fd-god-letters", "fd-god-wealth", "fd-god-thunder", "fd-god-moon"]) expect(book, k).toMatch(k);
    // the six thrones are petitioned to recognise her sect, and remember that they did
    for (let b = 0; b < COURTS.length; b++) expect(all.some((q) => q.kind === "petition" && q.npc === `ct-${b}-emperor`), `${b}`).toBe(true);
    const q = all.find((x) => x.kind === "petition" && x.npc === "ct-2-emperor")!;
    let g = syncFoundingFlags(atLevel({ ...ready(), counters: { fd: q.id } }, q.level));
    expect(said(npcScript("ct-2-emperor", g))).toMatch(/has not sent for you/);
    g = play(g, foundingTalk(q.npc!, g)!);
    expect(g.flags["fd:audience:2"]).toBe(true);
    expect(said(npcScript("ct-2-emperor", g))).toMatch(/founder of the sect in the sands/);
  });

  it("holds council with her steward once a day, setting the sect to work", () => {
    let g = ready();
    while (foundingDone(g) <= 130) g = doQuest(g, 0).g;
    g = syncFoundingFlags(g);
    const s = stewardScript(g);
    expect(s.some((x) => "choose" in x)).toBe(true);
    const after = play(g, s, [0]);
    expect(after.stones).toBeGreaterThan(g.stones);
    expect(stewardScript(after).some((x) => "choose" in x)).toBe(false);
    // the steward speaks for the sect when the quest she is on is not his
    expect(npcScript("fd-steward", after).length).toBeGreaterThan(0);
  });

  it("ties the founding to the Heart: the spring follows what became of it, and the Azure Cloud's answer to her letter does too", () => {
    expect(springFate({ "heart:home": true })).toMatch(/Heart is home/);
    expect(springFate({ "heart:planted": true })).toMatch(/planted/);
    expect(springFate({ "heart:devoured": true })).toMatch(/drank/);
    expect(springFate({ "heart:devoured": true, purged: true })).toMatch(/Heart is home/);
    expect(springFate({})).toMatch(/Until the Heart is found/);
    expect(azureReply({ "heart:devoured": true })).toMatch(/Whatever you have become/);
    expect(azureReply({ "origin:defector": true })).toMatch(/Blood Moon/);
    expect(azureReply({})).toMatch(/carries it further/);
    const words = JSON.stringify(FOUNDING_BOOKS_TEXT);
    expect(words).toMatch(/Jade Lotus/);
    // where the Heart was before the Azure Cloud's shrine kept it: the Crimson Cauldron's record of nine petals is eight hundred years old
    expect(JSON.stringify(FOUNDING_BOOKS_TEXT[0].beats[0])).toMatch(/Six hundred years it grew in my lake.*nine petals.*three hundred years ago/);
  });

  it("counts its disciples from who came in", () => {
    expect(disciplesAfter(0)).toBe(0);
    for (let n = 1; n < FOUNDING_COUNT; n += 97) expect(disciplesAfter(n + 1)).toBeGreaterThanOrEqual(disciplesAfter(n));
    expect(disciplesAfter(FOUNDING_COUNT)).toBeGreaterThan(200);
  });

  it("stands the basin on open land in the Yellow Sands, with every soul of it reachable", () => {
    const S = WORLD_SCALE;
    const [cx, cy] = [FOUNDING_C[0] * S, FOUNDING_C[1] * S];
    expect(w.map.kind(cx, cy)).not.toBe("void");
    expect(w.landmarks.some((l) => l.key === "fd-basin")).toBe(true);
    for (const n of w.npcs.filter((x) => x.key.startsWith("fd-") && !x.key.startsWith("fd-fac-") && !x.key.startsWith("fd-citygod-"))) expect(Math.hypot(n.i - cx, n.j - cy), n.key).toBeLessThan(70);
    for (const id of FOUNDING_BOSSES) expect(ENEMIES[id].boss).toBe(true);
  });
});
