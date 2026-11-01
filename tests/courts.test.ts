import { describe, expect, it } from "vitest";
import { newGame, stats, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS } from "@/game/engine/realms";
import { ENEMIES } from "@/game/engine/enemies";
import { apprentice, CRAFT_DEFS, CRAFT_XP, craftRank, craftSheet, CRAFTS, isApprentice, practise } from "@/game/engine/crafts";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { COURT_MAIN_KINDS, courtsBreath, courtsChronicle, courtsCultivated, courtsDone, courtsHunt, courtsLandmark, courtsLog, courtsOpen, courtsQuests, courtsTalk, COURTS_BOOK, COURTS_COUNT, currentCourts, masterOf, masterScript, petalFate, syncCourtsFlags } from "@/game/story/courts";
import { COURT_BOOKS } from "@/game/story/courtsBooks";
import { fillStanding } from "@/game/story/standing";
import { getWorld } from "@/game/world/continent";
import { casteOf, COURT_BOSSES, COURT_COUNT, COURT_FOES, COURTS, courtEmperorKey, courtFolkKey, courtGuideKey, courtLeaderKey, courtMasterKey, townKey, TOWNSFOLK_PER_COURT, WANDERING_CRAFTS } from "@/game/world/courts";
import { charDef, hasAnim, type AnimId, type HumanId } from "@/game/art/characters";
import { getProp } from "@/game/art/props";
import { propModel } from "@/game/three/propModels";
import { AREA_IDS } from "@/game/world/ids";
import { WORLD_SCALE } from "@/game/world/layout";

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

const ready = (): GameState => atLevel({ ...newGame(), flags: { metElder: true, metZhou: true, villageSaved: true } }, 3);

/** Do whatever the current quest asks, as the game would. */
function doQuest(g: GameState, pick: number): GameState {
  const q = currentCourts(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  g = syncCourtsFlags(g);
  switch (q.kind) {
    case "beat":
    case "rite":
    case "favour":
    case "craft":
    case "trade":
    case "tale":
      return play(g, courtsTalk(q.npc!, g)!, [pick]);
    case "hunt":
      for (let k = 0; k < q.count; k++) {
        const r = courtsHunt(g, q.foe!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "sit":
      for (let k = 0; k < q.count; k++) {
        const r = courtsBreath(g, q.region!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "visit":
      return play(g, courtsLandmark(q.landmark!, g, { night: q.how === "night", riding: q.how === "ride", flying: q.how === "fly" })!);
    case "gate":
      return play(g, courtsCultivated(g)!);
    case "duel": {
      const boss = COURTS[q.book].boss;
      expect(preBattleScript(boss, `courtboss-${q.book}`, g), boss).not.toBeNull();
      return play(g, victoryScript(boss, `courtboss-${q.book}`, "terraces", g), [pick]);
    }
  }
}

describe("the Thrones and the Crafts", () => {
  const all = courtsQuests();
  const w = getWorld();
  const npcKeys = new Set(w.npcs.map((n) => n.key));
  const landmarks = new Set(w.landmarks.map((l) => l.key));

  it("is twelve hundred quests in six books, main and side, sending her to every land of the jianghu", () => {
    expect(all).toHaveLength(COURTS_COUNT);
    expect(COURTS_COUNT).toBeGreaterThanOrEqual(1000);
    expect(COURT_BOOKS).toHaveLength(COURT_COUNT);
    expect(all.filter((q) => q.arc === "main").length).toBeGreaterThan(150);
    expect(all.filter((q) => q.arc === "side").length).toBeGreaterThan(900);
    for (const q of all) expect(q.arc === "main", `${q.id}`).toBe(COURT_MAIN_KINDS.includes(q.kind));
    for (let b = 0; b < COURT_COUNT; b++) {
      const book = all.slice(b * COURTS_BOOK, (b + 1) * COURTS_BOOK);
      expect(book[0].kind).toBe("beat");
      expect(book[COURTS_BOOK / 2].kind).toBe("gate");
      expect(book[COURTS_BOOK - 1].kind).toBe("duel");
      expect(COURT_BOOKS[b].beats.filter((x) => x.choice).length, `book ${b}`).toBeGreaterThanOrEqual(1);
      for (const k of ["rite", "favour", "trade", "tale", "hunt", "sit", "visit", "craft"]) expect(book.some((q) => q.kind === k), `book ${b} ${k}`).toBe(true);
    }
    const g = ready();
    for (const q of all) {
      for (const t of [q.objective, q.done, q.title]) expect(fillStanding(t, g), `${q.id}`).not.toMatch(/\{|\}|undefined/);
      if (q.npc) expect(npcKeys.has(q.npc), `${q.id} ${q.npc}`).toBe(true);
      if (q.landmark) expect(landmarks.has(q.landmark), `${q.id} ${q.landmark}`).toBe(true);
    }
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    const lands = new Set(all.filter((q) => q.kind === "sit").map((q) => q.region));
    for (const id of AREA_IDS) expect(lands.has(id), id).toBe(true);
    expect(new Set(all.filter((q) => q.kind === "visit").map((q) => q.landmark)).size).toBeGreaterThan(15);
  });

  it("is tied to the main tale: the stolen Heart's lost petal runs through all six books", () => {
    const words = JSON.stringify(COURT_BOOKS);
    expect(words).toMatch(/Jade Lotus Heart/);
    expect(words).toMatch(/petal/);
    for (const b of COURT_BOOKS) expect(JSON.stringify(b.beats) + b.boss.victory, b.title).toMatch(/Heart|petal|lotus|Grand Tutor|brush crossed with a tablet/);
    // what becomes of the petal follows what became of the Heart
    expect(petalFate({ "heart:planted": true })).toMatch(/roots/);
    expect(petalFate({ "heart:devoured": true })).toMatch(/palm/);
    // drunk, then drawn back out of her by Elder Mo: the Heart is home on its shrine
    expect(petalFate({ "heart:devoured": true, purged: true, heartReturned: true })).toMatch(/Hall of Clouds/);
    expect(petalFate({ patriarchDefeated: true })).toMatch(/Hall of Clouds/);
    expect(petalFate({})).toMatch(/Blood Moon's hands/);
  });

  it("opens once Elder Mo has sent her out and she has some standing, with Emperor Xuande at Liangdu", () => {
    expect(courtsOpen({ ...ready(), realm: 0, stage: 1 })).toBe(false);
    expect(courtsOpen({ ...ready(), flags: {} })).toBe(false);
    expect(courtsLog(ready())!.objective).toMatch(/Liangdu/);
    expect(all[0].npc).toBe(courtEmperorKey(0));
  });

  it("can be walked to its end: every beat, ceremony, lesson, favour, trouble and fate", { timeout: 180_000 }, () => {
    let g = ready();
    const seen = new Set<string>();
    for (let n = 0; n < COURTS_COUNT; n++) {
      const q = currentCourts(g)!;
      expect(q.id, `quest ${n}`).toBe(n);
      g = doQuest(g, n === COURTS_COUNT - 1 ? 0 : n % 4);
      expect(courtsDone(g), `${n} ${q.kind} ${q.title}`).toBe(n + 1);
      seen.add(q.kind);
    }
    expect(seen.size).toBe(11);
    expect(currentCourts(g)).toBeNull();
    g = syncCourtsFlags(g);
    expect(g.flags["courts:done"]).toBe(true);
    for (let k = 0; k < COURT_COUNT; k++) expect(g.flags[`courts:fate:${k}`], `fate ${k}`).toBe(true);
    expect(courtsChronicle(g).every((p) => p.state === "settled")).toBe(true);
    // the tale apprenticed her to every court's art, and the healer's, and its lessons raised her through the ranks
    for (const C of COURTS) expect(isApprentice(g, C.craft), C.craft).toBe(true);
    expect(isApprentice(g, "healing")).toBe(true);
    expect(Math.max(...COURTS.map((C) => craftRank(g, C.craft)))).toBeGreaterThanOrEqual(3);
    expect(JSON.stringify(endingScript({ ...g, realm: 4, stage: 3, flags: { ...g.flags, heartReturned: true } }))).toContain("twelve chairs");
  });

  it("has a trouble for every book, tuned to its realm, waiting near its capital, and foes about each", () => {
    let last = 0;
    COURT_BOSSES.forEach((id, k) => {
      const e = ENEMIES[id];
      expect(e.boss).toBe(true);
      expect(e.level).toBeGreaterThan(last);
      last = e.level;
      expect(charDef(e.sprite).anims).toContain("attack");
      const spawns = w.enemies.filter((x) => x.key === `courtboss-${k}`);
      expect(spawns, id).toHaveLength(1);
      expect(spawns[0].when!({ [`courts:boss:${k}`]: true })).toBe(true);
      expect(spawns[0].when!({})).toBe(false);
    });
    for (const [k, id] of COURT_FOES.entries()) {
      expect(ENEMIES[id].boss).toBeFalsy();
      expect(w.enemies.filter((e) => e.enemy === id).length, id).toBeGreaterThanOrEqual(3);
      expect(COURTS[k].foe).toBe(id);
      expect(charDef(ENEMIES[id].sprite).anims).toContain("attack");
    }
  });

  it("stands every court's people where they live, and gives each the manners its lines ask of them", () => {
    for (let b = 0; b < COURT_COUNT; b++) {
      const C = COURTS[b];
      for (const key of [courtEmperorKey(b), courtGuideKey(b), courtLeaderKey(b), courtMasterKey(b), ...C.folk.map((_, n) => courtFolkKey(b, n))]) expect(npcKeys.has(key), key).toBe(true);
      for (const p of [C.emperor, C.guide, ...C.folk, C.master, C.sect.leader, ...C.sect.disciples]) if (p.anim) expect(hasAnim(p.char, p.anim), `${p.name} ${p.anim}`).toBe(true);
      const cast: Record<string, { char: HumanId; name: string }> = { "ct-emperor": C.emperor, "ct-guide": C.guide, "ct-leader": C.sect.leader, "ct-master": C.master };
      C.folk.forEach((f, n) => (cast[`ct-folk-${n}`] = f));
      for (const beat of COURT_BOOKS[b].beats)
        for (const l of beat.lines)
          if (!Array.isArray(l)) {
            const who = l.a === "hero" ? { char: "heroine" as HumanId, name: "Lin Yue" } : cast[l.a];
            expect(who, `${b} ${l.a}`).toBeDefined();
            expect(hasAnim(who.char, l.n), `${who.name} ${l.n}`).toBe(true);
          }
    }
  });

  it("speaks to her formally until her book reaches the court", () => {
    expect(said(npcScript(courtFolkKey(3, 0), ready()))).toMatch(/not sent for you/);
    let g = ready();
    while (courtsDone(g) < 3) g = doQuest(g, 0);
    expect(said(npcScript(courtFolkKey(0, 1), g))).not.toMatch(/not sent for you/);
  });
});

describe("the six courts and their sects in the world", () => {
  const w = getWorld();
  const S = WORLD_SCALE;

  it("raises six capitals, each with a throne, and six sect seats, all on the world map", () => {
    expect(COURTS).toHaveLength(6);
    expect(new Set(COURTS.map((C) => C.emperor.char)).size).toBe(6);
    expect(new Set(COURTS.map((C) => C.sect.leader.char)).size).toBe(6);
    for (const C of COURTS) {
      expect(w.landmarks.some((l) => l.key === C.sight.key), C.key).toBe(true);
      expect(w.landmarks.some((l) => l.key === `ct-${C.sect.key}`), C.sect.key).toBe(true);
      expect(w.props.some((p) => p.id === "throne" && Math.hypot(p.i - C.c[0] * S, p.j - C.c[1] * S) < 24), C.key).toBe(true);
      const k = w.map.kind(C.c[0] * S, C.c[1] * S);
      expect(k === "plaza" || k === "marble", C.key).toBe(true);
    }
  });

  it("fills each capital with its townsfolk, every one at a trade", () => {
    for (let b = 0; b < COURT_COUNT; b++) {
      const town = w.npcs.filter((n) => n.key.startsWith(`ct-${b}-town-`));
      expect(town.length).toBe(TOWNSFOLK_PER_COURT);
      expect(new Set(town.map((n) => n.char)).size).toBeGreaterThan(8);
      expect(npcScript(townKey(b, 0), newGame()).some((s) => "text" in s && s.text.length > 10)).toBe(true);
    }
  });

  it("has about ten mortals for every cultivator among the jianghu's folk", () => {
    const count = { mortal: 0, cultivator: 0, spirit: 0 };
    for (const n of w.npcs) count[casteOf(n.char)]++;
    const ratio = count.mortal / count.cultivator;
    expect(ratio).toBeGreaterThan(9);
    expect(ratio).toBeLessThan(11);
    // emperors and their courts are mortal; sect leaders cultivate
    for (const C of COURTS) {
      expect(casteOf(C.emperor.char)).toBe("mortal");
      expect(casteOf(C.sect.leader.char)).toBe("cultivator");
    }
  });
});

describe("the Hundred Arts", () => {
  it("has eight arts, each with a master in the world, and six ranks", () => {
    expect(CRAFTS).toHaveLength(8);
    const keys = new Set(getWorld().npcs.map((n) => n.key));
    for (const c of CRAFTS) expect(keys.has(masterOf(c)), c).toBe(true);
    expect(WANDERING_CRAFTS.map((x) => x.craft).sort()).toEqual(["cuisine", "healing"]);
    expect(CRAFT_XP).toHaveLength(6);
  });

  it("raises her through the ranks as she practises, and each rank strengthens her", () => {
    let g = newGame();
    expect(craftRank(g, "refining")).toBe(0);
    expect(practise(g, "refining")).toBe(g);
    g = apprentice(g, "refining");
    expect(craftRank(g, "refining")).toBe(1);
    const atk = stats(g).atk;
    g = practise(g, "refining", CRAFT_XP[5]);
    expect(craftRank(g, "refining")).toBe(6);
    expect(stats(g).atk).toBeGreaterThan(atk);
    expect(craftSheet(g)[0]).toMatchObject({ id: "refining", rank: "Grandmaster" });
    g = practise(apprentice(g, "taming"), "taming", CRAFT_XP[2]);
    expect(stats(g).spd).toBe(stats(newGame()).spd + craftRank(g, "taming"));
  });

  it("lets a master take her on, then teach her once a day", () => {
    const g0 = { ...newGame(), playTime: 1000 };
    const offer = masterScript(masterOf("alchemy"), g0)!;
    let g = play(g0, offer, [0]);
    expect(isApprentice(g, "alchemy")).toBe(true);
    const pills = g.pills.heal;
    g = play(g, masterScript(masterOf("alchemy"), g)!);
    expect(craftRank(g, "alchemy")).toBe(1);
    expect(g.pills.heal).toBeGreaterThan(pills);
    expect(said(masterScript(masterOf("alchemy"), g)!)).toMatch(/Enough for today/);
    // a day later, another lesson
    g = { ...g, playTime: g.playTime + 60 * 60 * 24 };
    expect(said(masterScript(masterOf("alchemy"), g)!)).not.toMatch(/Enough for today/);
    // declining leaves her unlearned
    expect(isApprentice(play(g0, masterScript(masterOf("cuisine"), g0)!, [1]), "cuisine")).toBe(false);
    for (const c of CRAFTS) expect(hasAnim("heroine", CRAFT_DEFS[c].anim as AnimId), c).toBe(true);
  });
});

describe("the courts' new art", () => {
  it("draws the throne and the parasol, and twelve new moves", () => {
    for (const id of ["throne", "parasol"] as const) {
      expect(getProp(id).frames[0].width, id).toBeGreaterThan(8);
      expect(propModel(id).indices.length, id).toBeGreaterThan(200);
    }
    const moves: AnimId[] = ["sow", "grind", "inscribe", "array", "tame", "pulse", "knead", "proclaim", "enthrone", "audience", "appraise", "fanning"];
    for (const a of moves) {
      const who = (["heroine", "emperorliang", "minister", "palacemaid"] as HumanId[]).find((c) => hasAnim(c, a));
      expect(who, a).toBeDefined();
      expect(charDef(who!).anims).toContain(a);
    }
  });
});

describe("plot holes mended", () => {
  const w = getWorld();

  it("the East Ward stands from the first day, so its sign no longer says it was built the year the Heart came home", () => {
    const sign = w.interacts.find((x) => x.key === "ward-sign")!;
    expect(sign.text).not.toMatch(/Heart came home/);
    expect(sign.text).toMatch(/before the Heart was stolen/);
  });

  it("with six emperors under heaven, Willow Creek's watchman no longer speaks of 'the Emperor'", () => {
    for (let t = 0; t < 30; t++) expect(said(npcScript("willowguard", { ...newGame(), playTime: t * 7 }))).not.toMatch(/the Emperor's problem/);
  });

  it("a court's ceremonies never come before the part of the tale they belong to", () => {
    for (const q of courtsQuests()) {
      if (q.kind !== "rite") continue;
      const rite = COURT_BOOKS[q.book].rites.find((r) => r.title === q.title)!;
      expect((rite.after ?? 0) < q.step, `${q.id} ${q.title}`).toBe(true);
    }
  });

  it("the emperors, guides and sect leaders keep what they learn later to themselves until the tale gets there", () => {
    const g = ready();
    // the very start of book II: only the empress's first line, never the Grand Tutor's hand on her letters
    let s = { ...g, counters: { ...g.counters, courts: COURTS_BOOK + 1 } };
    for (let t = 0; t < 20; t++) expect(said(npcScript(courtGuideKey(1), { ...s, playTime: t * 7 }))).not.toMatch(/who else wrote like her/);
    s = { ...g, counters: { ...g.counters, courts: COURTS_BOOK * 2 } };
    const later = new Set<string>();
    for (let t = 0; t < 40; t++) later.add(said(npcScript(courtGuideKey(1), { ...s, playTime: t * 7 })));
    expect(later.size).toBeGreaterThan(1);
  });

  it("the farmers' soil is thin while the Heart is gone, and coming back once it is home or planted", () => {
    const beat = COURT_BOOKS[0].beats[0];
    const line = (f: Record<string, boolean>) => said(courtsTalk(courtEmperorKey(0), { ...ready(), flags: { ...ready().flags, ...f } })!);
    expect(line({})).toMatch(/thinner every year/);
    expect(line({ "heart:planted": true })).toMatch(/begun to come back/);
    expect(line({ "heart:devoured": true, purged: true })).toMatch(/begun to come back/);
    expect(JSON.stringify(beat.lines)).toContain("{soil}");
  });
});
