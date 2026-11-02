import { describe, expect, it } from "vitest";
import { newGame, stats, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS } from "@/game/engine/realms";
import { ENEMIES } from "@/game/engine/enemies";
import { daoDoubt, daoTier, heartState, steadyHeart, steadyTier, walkDao } from "@/game/engine/dao";
import { comprehend } from "@/game/engine/comprehension";
import type { Step } from "@/game/story/script";
import { npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { CN_BOOK, CONTENTION_COUNT, contentionChronicle, contentionCultivated, contentionDone, contentionHunt, contentionLog, contentionOpen, contentionQuests, contentionTalk, councilOutcome, currentContention, OWN_NEEDS, syncContentionFlags } from "@/game/story/contention";
import { CONTENTION_BOOKS_TEXT, WRITS } from "@/game/story/contentionBooks";
import { powersSheet, revealTie, shiftTie, standing, sway, tieKindNow, tieWarmth } from "@/game/story/powers";
import { getWorld } from "@/game/world/continent";
import { CN_BOSSES, CN_FOES, fusangLand, TEN_SEATS, WUJI, YANGGU, HALL_OF_WRITS } from "@/game/world/fusang";
import { envoyKey, POWERS, powerOf, SECRET_TIES, TIES } from "@/game/world/powers";
import { CONTINENTS } from "@/game/world/oceans";
import { WORLD_SCALE } from "@/game/world/layout";
import { charDef, getAnim, type AnimId, type HumanId } from "@/game/art/characters";
import { GREAT_DAO_IDS } from "@/game/engine/comprehension";

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
const every = (steps: Step[]) => {
  const out: Step[] = [];
  const walk = (ss: Step[]) => ss.forEach((s) => (out.push(s), "choose" in s && s.choose.forEach((c) => walk(c.then))));
  walk(steps);
  return out;
};

function atLevel(g: GameState, level: number): GameState {
  let n = level;
  for (let r = 0; r < REALMS.length; r++) {
    if (n < REALMS[r].stages) return { ...g, realm: r, stage: n, cultivation: 0 };
    n -= REALMS[r].stages;
  }
  return g;
}
const ready = (): GameState => atLevel({ ...newGame(), flags: { metElder: true, metZhou: true, villageSaved: true } }, 8);

function doQuest(g: GameState, pick: number): { g: GameState; steps: Step[] } {
  const q = currentContention(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  g = syncContentionFlags(g);
  switch (q.kind) {
    case "hunt": {
      const all: Step[] = [];
      for (let k = 0; k < q.count; k++) {
        const r = contentionHunt(g, q.foe!);
        g = r.state;
        if (r.steps) {
          all.push(...r.steps);
          g = play(g, r.steps);
        }
      }
      return { g, steps: all };
    }
    case "gate": {
      const steps = contentionCultivated(g)!;
      return { g: play(g, steps), steps };
    }
    case "duel": {
      const boss = CN_BOSSES[q.book];
      const steps = [...preBattleScript(boss, `cnboss-${q.book}`, g)!, ...victoryScript(boss, `cnboss-${q.book}`, "harbor", g)];
      return { g: play(g, steps, [pick]), steps };
    }
    default: {
      const steps = contentionTalk(q.npc!, g)!;
      expect(steps, `${q.id} ${q.kind} ${q.npc}`).not.toBeNull();
      return { g: play(g, steps, [pick]), steps };
    }
  }
}

describe("the Contention of the Daos", () => {
  const all = contentionQuests();
  const w = getWorld();
  const npcs = new Map(w.npcs.map((n) => [n.key, n]));

  it("is nine hundred quests in six books, main and side, each book ending in its trouble", () => {
    expect(all.length).toBe(CONTENTION_COUNT);
    expect(CONTENTION_COUNT).toBe(900);
    all.forEach((q, k) => expect(q.id).toBe(k));
    for (let b = 0; b < CONTENTION_BOOKS_TEXT.length; b++) {
      const book = all.filter((q) => q.book === b);
      expect(book.length).toBe(CN_BOOK);
      expect(book[CN_BOOK - 1].kind).toBe("duel");
      expect(book.filter((q) => q.kind === "beat").length).toBe(CONTENTION_BOOKS_TEXT[b].beats.length);
      expect(book.filter((q) => q.kind === "intrigue").length).toBe(3);
      expect(book.filter((q) => q.kind === "debate").length).toBeGreaterThan(10);
      expect(book.filter((q) => q.kind === "mediate").length).toBeGreaterThan(5);
      expect(book.filter((q) => q.arc === "side").length).toBeGreaterThan(30);
    }
    // the levels only ever rise, and stay within what a cultivator can reach
    for (let k = 1; k < all.length; k++) expect(all[k].level).toBeGreaterThanOrEqual(all[k - 1].level - 1);
    expect(Math.max(...all.map((q) => q.level))).toBeLessThanOrEqual(20);
  });

  it("only sends her to people who are really in the world, and there at the time", () => {
    const g0 = ready();
    for (const q of all) {
      for (const t of [q.objective, q.done, q.title]) expect(t, `${q.id}`).not.toMatch(/\{|\}|undefined|NaN/);
      if (!q.npc) continue;
      const n = npcs.get(q.npc);
      expect(n, `${q.id} ${q.npc}`).toBeDefined();
      const flags = syncContentionFlags({ ...g0, counters: { ...g0.counters, cn: q.id } }).flags;
      if (n!.when) expect(n!.when(flags), `${q.id} ${q.kind} ${q.npc}`).toBe(true);
    }
    // the hunts' foes and each book's trouble are out while the book is hers
    for (let b = 0; b < CONTENTION_BOOKS_TEXT.length; b++) {
      const flags = syncContentionFlags({ ...g0, counters: { ...g0.counters, cn: b * CN_BOOK + CN_BOOK - 1 } }).flags;
      const here = w.enemies.filter((e) => !e.when || e.when(flags));
      expect(here.some((e) => e.enemy === CN_BOSSES[b]), `book ${b} boss`).toBe(true);
      expect(here.filter((e) => e.enemy === CN_FOES[b]).length, `book ${b} foes`).toBeGreaterThanOrEqual(3);
      expect(ENEMIES[CN_BOSSES[b]].boss).toBe(true);
    }
    // every power has its envoy standing somewhere
    for (const p of POWERS) expect(npcs.has(envoyKey(p.key)), p.key).toBe(true);
  });

  it("uses only moves its people have, and every one of them can be drawn", () => {
    for (const B of CONTENTION_BOOKS_TEXT)
      for (const b of B.beats)
        for (const l of [...b.lines, ...(b.after ?? [])]) {
          if (Array.isArray(l)) continue;
          const char: HumanId = l.a === "hero" ? "heroine" : (npcs.get(l.a)!.char as HumanId);
          expect(npcs.has(l.a) || l.a === "hero", l.a).toBe(true);
          expect(charDef(char).anims, `${l.a} (${char}) ${l.n}`).toContain(l.n);
        }
    for (const anim of ["envoy", "cupfist", "rebuke", "unfurl", "sealtreaty", "mudra", "daovow", "daodoubt", "steadyheart"] as AnimId[]) {
      expect(charDef("heroine").anims).toContain(anim);
      const a = getAnim("heroine", anim, 3);
      expect(a.frames.length).toBeGreaterThan(5);
      expect(a.loop).toBe(false);
    }
  });

  it("opens at Core Formation once the far roads are open", () => {
    expect(contentionOpen(atLevel({ ...newGame(), flags: { metElder: true, metZhou: true } }, 7))).toBe(false);
    expect(contentionOpen(ready())).toBe(true);
    expect(contentionLog(ready())!.title).toMatch(/^1\/900 · Main · The Envoy at the Causeway/);
    expect(currentContention(ready())!.npc).toBe(envoyKey("synod"));
  });

  it("is walked to its end, the powers moved, the secrets uncovered and the Council's vote cast", () => {
    let g = ready();
    for (let n = 0; n < CONTENTION_COUNT; n++) {
      const pick = n % 3 === 0 ? 2 : 0;
      g = doQuest(g, pick).g;
      expect(contentionDone(g), `quest ${n}`).toBe(n + 1);
    }
    expect(currentContention(g)).toBeNull();
    expect(g.flags["cn:done"]).toBe(true);
    expect(contentionLog(g)!.title).toBe("The Council Has Spoken");
    // every book is chronicled with a fate, and the vote is written into the world
    expect(contentionChronicle(g).every((c) => c.state === "done" && !!c.fate)).toBe(true);
    expect(["charter", "strike", "amended", "signed"].some((o) => g.flags[`cn:outcome:${o}`])).toBe(true);
    // eighteen intrigues bring eighteen secrets to light
    expect(powersSheet(g).secrets.known).toBe(SECRET_TIES.length);
    // and the powers no longer receive her as they did
    expect(POWERS.filter((p) => standing(g, p.key) !== standing(ready(), p.key)).length).toBeGreaterThan(10);
  });

  it("lets her argue a Dao in her own words only once she comprehends it", () => {
    const q = all.find((x) => x.kind === "debate" && x.book === 2)!;
    let g: GameState = { ...ready(), counters: { ...ready().counters, cn: q.id } };
    g = atLevel(g, q.level);
    const own = (s: GameState) => contentionTalk(q.npc!, s)!.find((st) => "choose" in st) as Extract<Step, { choose: unknown }>;
    expect(own(g).choose[2].hint).toMatch(/^needs /);
    const faltered = play(g, contentionTalk(q.npc!, g)!, [2]);
    expect(daoDoubt(faltered)).toBe(daoDoubt(g) + 1);
    expect(faltered.flags[`cn:charter:${q.dao}`]).toBeUndefined();
    // understand it well enough, and she can say it, and it goes into the record
    let wise = g;
    while (true) {
      const r = comprehend(wise, q.dao!, 5);
      wise = r.state;
      if (!own(wise).choose[2].hint!.startsWith("needs")) break;
    }
    expect(OWN_NEEDS[q.book]).toBe(2);
    const spoke = play(wise, contentionTalk(q.npc!, wise)!, [2]);
    expect(spoke.flags[`cn:charter:${q.dao}`]).toBe(true);
    expect(standing(spoke, "synod")).toBeGreaterThan(standing(wise, "synod"));
    expect(standing(spoke, "unfettered")).toBeGreaterThan(standing(wise, "unfettered"));
    // every Great Dao is read three ways
    for (const d of GREAT_DAO_IDS) expect(Object.values(WRITS[d]).every((t) => t.length > 30)).toBe(true);
  });

  it("decides the Council by the Seats she turned, the powers that trust her and how warm the web runs", () => {
    const base = { ...ready(), flags: { ...ready().flags, "cn:proposed:charter": true } };
    expect(councilOutcome(base)).toBe("amended");
    let won: GameState = { ...base, flags: { ...base.flags, "cn:qiulan": true, "cn:windmet": true, "cn:speakerheard": true } };
    for (const p of POWERS.slice(0, 10)) won = sway(won, p.key, 5);
    expect(councilOutcome(won)).toBe("charter");
    expect(councilOutcome({ ...won, flags: { ...won.flags, "cn:proposed:strike": true } })).toBe("strike");
    expect(councilOutcome({ ...won, flags: { ...won.flags, "cn:proposed:sign": true } })).toBe("signed");
  });

  it("gives the envoys something to say about how their powers see her", () => {
    const g = ready();
    for (const p of POWERS) {
      const s = npcScript(envoyKey(p.key), g);
      expect(s.length).toBeGreaterThan(0);
      expect(s.map((x) => ("text" in x ? x.text : "")).join(" ")).toContain(p.doctrine);
    }
  });
});

describe("the powers and what lies between them", () => {
  it("names every tie between powers that exist, and none twice", () => {
    const keys = new Set(POWERS.map((p) => p.key));
    const seen = new Set<string>();
    for (const t of TIES) {
      expect(keys.has(t.a) && keys.has(t.b), `${t.a}~${t.b}`).toBe(true);
      const k = [t.a, t.b].sort().join("~");
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
    // a web, not a list: every power is tied to at least two others, and many ties are not what they seem
    for (const p of POWERS) expect(TIES.filter((t) => t.a === p.key || t.b === p.key).length, p.key).toBeGreaterThanOrEqual(2);
    expect(SECRET_TIES.length).toBeGreaterThanOrEqual(15);
    // every book's intrigues uncover a real secret, and all eighteen are uncovered once each
    const intrigued = CONTENTION_BOOKS_TEXT.flatMap((b) => b.intrigues);
    expect(new Set(intrigued).size).toBe(intrigued.length);
    for (const k of intrigued) expect(SECRET_TIES.some((t) => `${t.a}~${t.b}` === k), k).toBe(true);
  });

  it("receives her by her Dao against its doctrine, by what she comprehends, and by what she has done", () => {
    let g = newGame();
    const shu = powerOf("shu");
    expect(standing(g, "shu")).toBe(0);
    g = walkDao(g, shu.heart, 12);
    expect(standing(g, "shu")).toBeGreaterThan(0);
    const cold = walkDao(newGame(), shu.abhors, 12);
    expect(standing(cold, "shu")).toBeLessThan(0);
    const wise = comprehend({ ...newGame(), realm: 4 }, shu.patron, 30).state;
    expect(standing(wise, "shu")).toBeGreaterThan(0);
    expect(standing(sway(newGame(), "shu", 3), "shu")).toBe(3);
  });

  it("shows a tie's truth once she uncovers it, and lets her mend or break it", () => {
    const t = TIES.find((x) => x.a === "yan" && x.b === "ironbanner")!;
    const g = newGame();
    expect(tieKindNow(g, t)).toBe("tribute");
    const known = revealTie(g, t);
    expect(tieKindNow(known, t)).toBe("pact");
    expect(tieWarmth(shiftTie(known, t, 2), t)).toBe(tieWarmth(known, t) + 2);
    const sheet = powersSheet(known).powers.find((p) => p.key === "yan")!;
    expect(sheet.ties.find((x) => x.withKey === "ironbanner")!.truth).toMatch(/Yellow Sands/);
  });
});

describe("the Dao heart", () => {
  it("wavers when she acts against a Dao she walks deep, cracks if she keeps on, and costs her its gifts", () => {
    let g = { ...walkDao(newGame(), "sword", 12), realm: 2, stage: 0 };
    expect(daoTier(g)).toBe(2);
    expect(heartState(g)).toBe(0);
    const sharp = stats(g).atk;
    // her own Dao settles her; another shakes her; the one hers is most at war with shakes her twice as hard
    expect(daoDoubt(walkDao(g, "balance", 1))).toBe(2);
    expect(daoDoubt(walkDao(g, "mercy", 1))).toBe(1);
    for (let k = 0; k < 3; k++) g = walkDao(g, "balance", 1);
    expect(heartState(g)).toBe(1);
    expect(steadyTier(g)).toBe(daoTier(g) - 1);
    expect(stats(g).atk).toBeLessThan(sharp);
    for (let k = 0; k < 3; k++) g = walkDao(g, "balance", 1);
    expect(heartState(g)).toBe(2);
    // a cracked heart feeds her heart demons
    const demons = g.counters["cult:demon"] ?? 0;
    expect(walkDao(g, "mercy", 1).counters["cult:demon"] ?? 0).toBeGreaterThan(demons - 2);
    // a vigil steadies it again
    expect(heartState(steadyHeart(g, 30))).toBe(0);
  });

  it("asks nothing of a heart that has not chosen a Dao deep enough to doubt", () => {
    const g = walkDao(walkDao(newGame(), "sword", 5), "mercy", 3);
    expect(daoDoubt(g)).toBe(0);
  });
});

describe("Fusang, the Dawn Continent", () => {
  const w = getWorld();
  const S = WORLD_SCALE;
  it("stands on land of its own across the Strait of Dawn, with its places on open ground", () => {
    expect(CONTINENTS.some((c) => c.key === "fusang")).toBe(true);
    for (const [i, j] of [TEN_SEATS, YANGGU, WUJI, HALL_OF_WRITS]) {
      expect(fusangLand(i, j) || w.map.kind(i * S, j * S) !== "deep", `${i},${j}`).toBe(true);
      expect(["deep", "water", "void"]).not.toContain(w.map.kind(i * S, j * S));
    }
    for (const key of ["cn-seats", "cn-yanggu", "cn-writs", "cn-wuji", "cn-landing"]) expect(w.landmarks.some((l) => l.key === key), key).toBe(true);
  });
});
