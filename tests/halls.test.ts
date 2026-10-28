import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS } from "@/game/engine/realms";
import { comprehend, wuCap, wuTier } from "@/game/engine/comprehension";
import { ENEMIES } from "@/game/engine/enemies";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { currentHalls, hallsBreath, hallsChronicle, hallsCultivated, hallsDone, hallsHunt, hallsLandmark, hallsLog, hallsOpen, hallsQuests, hallsTalk, HALLS_AREA, HALLS_BOOK, HALLS_COUNT, roommateAway, syncHallsFlags } from "@/game/story/halls";
import { HALL_BOOKS } from "@/game/story/hallsBooks";
import { newGameAs } from "@/game/story/origins";
import { hasAttire } from "@/game/story/wardrobe";
import { getWorld, regionAt } from "@/game/world/continent";
import { getInterior } from "@/game/world/interiors";
import { HALL_BOSSES, HALL_CAST, HALL_DAOS, HALLS, HOPEFULS, ROOMMATES } from "@/game/world/halls";
import { charDef, getAnim } from "@/game/art/characters";
import { getProp } from "@/game/art/props";
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

const questions = (steps: Step[]) => steps.filter((s): s is Extract<Step, { choose: unknown }> => "choose" in s);

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
  const q = currentHalls(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  g = syncHallsFlags(g);
  switch (q.kind) {
    case "beat":
    case "lecture":
    case "chore":
    case "roommate":
    case "mission":
      return play(g, hallsTalk(q.npc!, g)!, [pick]);
    case "spar":
      for (let k = 0; k < q.count; k++) {
        const r = hallsHunt(g, "wdspar");
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "contemplate":
      for (let k = 0; k < q.count; k++) {
        const r = hallsBreath(g, q.region!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "patrol":
      return play(g, hallsLandmark(q.landmark!, g, { night: q.how === "night", riding: q.how === "ride", flying: q.how === "fly" })!);
    case "comprehend":
      while (wuTier(g, q.dao) < Math.min(2, wuCap(g.realm))) g = comprehend(g, q.dao, 1).state;
      return play(g, hallsCultivated(g)!);
    case "duel": {
      const boss = HALL_BOSSES[q.book];
      expect(preBattleScript(boss, `wdboss-${q.book}`, g), boss).not.toBeNull();
      return play(g, victoryScript(boss, `wdboss-${q.book}`, HALLS_AREA, g), [pick]);
    }
  }
}

describe("the Ten Halls", () => {
  const all = hallsQuests();
  const w = getWorld();
  const dorm = getInterior("dorm");
  const npcKeys = new Set([...w.npcs.map((n) => n.key), ...dorm.npcs.map((n) => n.key)]);
  const landmarks = new Set(w.landmarks.map((l) => l.key));

  it("is a thousand quests in ten books, one for each hall and its Great Dao, each opened and closed by its own tale", () => {
    expect(all).toHaveLength(HALLS_COUNT);
    expect(HALL_BOOKS).toHaveLength(HALLS_COUNT / HALLS_BOOK);
    for (let b = 0; b < 10; b++) {
      const book = all.slice(b * HALLS_BOOK, (b + 1) * HALLS_BOOK);
      expect(book.every((q) => q.dao === HALL_DAOS[b])).toBe(true);
      expect(book[0].kind).toBe("beat");
      expect(book[50].kind).toBe("comprehend");
      expect(book[98].kind).toBe("beat");
      expect(book[99].kind).toBe("duel");
      // hand-written beats carry each book's own story, at least ten of them
      expect(book.filter((q) => q.kind === "beat").length, HALL_DAOS[b]).toBeGreaterThanOrEqual(10);
      for (const k of ["lecture", "roommate", "mission", "spar", "contemplate", "patrol"]) expect(book.some((q) => q.kind === k), `${HALL_DAOS[b]} ${k}`).toBe(true);
    }
    for (const q of all) {
      for (const t of [q.objective, q.done, q.title]) expect(t, `${q.id}`).not.toMatch(/\{|\}|undefined/);
      if (q.npc) expect(npcKeys.has(q.npc), `${q.id} ${q.npc}`).toBe(true);
      if (q.landmark) expect(landmarks.has(q.landmark), `${q.id} ${q.landmark}`).toBe(true);
    }
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    expect(all[HALLS_COUNT - 1].level).toBe(18);
  });

  it("begins with a herald, ten thousand at the gate, the Selection, and a bunk in Room Seven", () => {
    expect(hallsOpen({ ...ready(), realm: 0, stage: 1 })).toBe(false);
    expect(hallsOpen({ ...ready(), flags: {} })).toBe(false);
    expect(hallsLog(ready())!.objective).toMatch(/herald/);
    const titles = all.slice(0, 11).map((q) => q.title).join(" | ");
    for (const t of ["Gate of Equal Footing", "Stair of Asking Heart", "Stone of Affinity", "Long Run", "Ring", "Final Question", "Room Seven", "Six Bunks", "First Night", "Mission Hall"]) expect(titles).toMatch(t);
    // she queues with the crowd while the Selection runs, and the crowd goes home after
    let g = play(ready(), hallsTalk("wd-herald", ready())!);
    g = syncHallsFlags(g);
    expect(g.flags["halls:selection"]).toBe(true);
    const crowd = w.npcs.filter((n) => n.key.startsWith("wd-hope-"));
    expect(crowd.length).toBe(HOPEFULS.length);
    expect(crowd.every((n) => n.when!(g.flags))).toBe(true);
    // the Selection seals every cultivation, so even a Qi Condensation disciple may sit it
    for (let k = 0; k < 7; k++) g = doQuest({ ...g, realm: 0, stage: 2 }, 0);
    expect(hallsDone(g)).toBe(8);
    expect(g.flags["halls:selection"]).toBe(false);
    expect(g.flags["halls:joined"]).toBe(true);
    expect(crowd.some((n) => n.when!(g.flags))).toBe(false);
    expect(hasAttire(g, "outerrobe")).toBe(true);
    // and Room Seven is full: five roommates, the founder's bunk, a window that whistles
    for (const k of ROOMMATES) expect(dorm.npcs.find((n) => n.key === k)!.when!(g.flags), k).toBe(true);
    expect(dorm.interacts.find((i) => i.key === "dorm-bunk")!.text).toMatch(/Lian Qingxue slept here/);
    const meet = hallsTalk("wd-meilan", g)!;
    for (const k of ROOMMATES) expect(meet.some((s) => "say" in s && s.name === HALL_CAST[k].name), k).toBe(true);
  });

  it("asks a realm of her after the Selection, and the Dao too past each book's middle", () => {
    const g = syncHallsFlags({ ...ready(), counters: { halls: 140 } });
    expect(hallsLog(atLevel(g, 2))!.objective).toMatch(/asks for/);
    const deep = atLevel(syncHallsFlags({ ...ready(), counters: { halls: 151 } }), 9);
    expect(hallsLog(deep)!.objective).toMatch(/Lesser Mastery/);
  });

  it("is walked to the end: every hall, every roommate, and the sleepers brought home", () => {
    let g = ready();
    for (let n = 0; n < HALLS_COUNT; n++) {
      const q = currentHalls(g)!;
      expect(q.id).toBe(n);
      g = doQuest(g, q.kind === "duel" ? q.book % 3 : q.book % 3);
      expect(hallsDone(g), `quest ${n} (${q.kind})`).toBe(n + 1);
      if (q.kind === "duel") expect(g.flags[`halls:fate:${q.book}`]).toBe(true);
    }
    expect(currentHalls(g)).toBeNull();
    expect(g.flags["halls:done"]).toBe(true);
    expect(hallsLog(g)!.title).toMatch(/Hall of the Void/);
    for (const a of ["outerrobe", "innerrobe", "tenhalls"]) expect(hasAttire(g, a), a).toBe(true);
    expect(hallsChronicle(g).every((h) => h.state === "done")).toBe(true);
    // the Hall of Still Water is studied at Qi Condensation, which holds only Entry; every later hall leaves Lesser Mastery or more
    HALL_DAOS.forEach((dao, b) => expect(wuTier(g, dao), dao).toBeGreaterThanOrEqual(b === 0 ? 1 : 2));
    const text = JSON.stringify(endingScript({ ...g, realm: 4, stage: 3, flags: { ...g.flags, heartReturned: true } }));
    expect(text).toMatch(/She snored too/);
    // Ning Wuhen is out of the Sealed Hall, and Lu Ping is home
    expect(w.npcs.find((n) => n.key === "wd-ning")!.when!(g.flags)).toBe(true);
    expect(w.npcs.find((n) => n.key === "wd-outer-0")!.when!(g.flags)).toBe(true);
  }, 90_000);

  it("counts only the ring's bouts for sparring, and the right land's shrines for sitting", () => {
    let g = ready();
    while (currentHalls(g)!.kind !== "spar") g = doQuest(g, 0);
    expect(hallsHunt(g, "wolf").state).toBe(g);
    expect(hallsHunt(g, "wdspar").state.counters.hallsp).toBe(1);
    while (currentHalls(g)!.kind !== "contemplate") g = doQuest(g, 0);
    const q = currentHalls(g)!;
    const wrong = q.region === "desert" ? "frost" : "desert";
    expect(hallsBreath(g, wrong).steps).toBeNull();
  });

  it("keeps each roommate out of Room Seven while the tale has them elsewhere, and never sends her to an absent one", () => {
    expect(roommateAway("wd-shenbai", 8, 40)).toBe(true);
    expect(roommateAway("wd-meilan", 9, 10)).toBe(true);
    expect(roommateAway("wd-tieniu", 8, 40)).toBe(false);
    for (const q of all) if (q.npc && (ROOMMATES as readonly string[]).includes(q.npc)) expect(roommateAway(q.npc, q.book, q.step), `${q.id} ${q.npc}`).toBe(false);
    const g = syncHallsFlags({ ...ready(), counters: { halls: 920 } });
    expect(dorm.npcs.find((n) => n.key === "wd-meilan")!.when!(g.flags)).toBe(false);
    expect(dorm.npcs.find((n) => n.key === "wd-qiu")!.when!(g.flags)).toBe(true);
  });

  it("stands the court, its gate, its halls, its ring and its troubles on reachable ground in the world", () => {
    const S = WORLD_SCALE;
    const { x0, y0, x1, y1, c } = HALLS;
    const inCourt = (i: number, j: number) => i >= x0 * S && i <= (x1 + 1) * S && j >= y0 * S && j <= (y1 + 1) * S;
    expect(w.props.filter((p) => (p.id === "citywall" || p.id === "citywallY") && inCourt(p.i, p.j)).length).toBeGreaterThan(100);
    for (const id of ["affinitystone", "missionboard", "gong", "tenlamps", "voiddoor"]) expect(w.props.some((p) => p.id === id), id).toBe(true);
    for (const l of ["wandao", "wdgate"]) expect(landmarks.has(l), l).toBe(true);
    expect(regionAt(w, c[0] * S, c[1] * S)).toBe(HALLS_AREA);
    expect(w.map.standable(c[0] * S + 4, c[1] * S + 4)).toBe(true);
    for (let b = 0; b < 10; b++) expect(w.enemies.some((e) => e.key === `wdboss-${b}` && e.enemy === HALL_BOSSES[b]), `${b}`).toBe(true);
    expect(w.enemies.filter((e) => e.enemy === "wdspar").length).toBe(3);
    expect(w.interacts.some((i) => i.kind === "door" && i.to === "dorm")).toBe(true);
    // every one of them has something to say
    const g = syncHallsFlags({ ...ready(), counters: { halls: 120 } });
    for (const n of [...w.npcs.filter((x) => x.key.startsWith("wd")), ...dorm.npcs]) expect(npcScript(n.key, g).some((s) => "say" in s && s.text !== "…"), n.key).toBe(true);
  });

  it("gives each hall's trouble a body and a battle, and lets her choose what becomes of it", () => {
    for (const id of [...HALL_BOSSES, "wdspar" as const]) {
      const e = ENEMIES[id];
      expect(charDef(e.sprite).anims, id).toContain("attack");
      expect(getAnim(e.sprite, "idle", 3).frames.length).toBeGreaterThan(0);
    }
    expect(ENEMIES.wdmurong.friendly).toBe(true);
    expect(ENEMIES.wdyanshu.level).toBe(18);
    const g = atLevel(syncHallsFlags({ ...ready(), counters: { halls: 999 } }), 18);
    expect(g.flags["halls:boss:9"]).toBe(true);
    expect(JSON.stringify(preBattleScript("wdyanshu", "wdboss-9", g))).toMatch(/founder slept in your bunk/);
    expect(questions(victoryScript("wdyanshu", "wdboss-9", HALLS_AREA, g))[0].choose).toHaveLength(4);
  });
});

describe("the Ten Halls' art", () => {
  it("paints the new props and the new moves", () => {
    for (const id of ["affinitystone", "bunkbed", "missionboard", "gong", "tenlamps", "voiddoor"] as const) expect(getProp(id).frames[0].opaqueCount(), id).toBeGreaterThan(30);
    for (const [c, a] of [
      ["heroine", "spar"],
      ["heroine", "tiptoe"],
      ["heroine", "token"],
      ["heroine", "scrub"],
      ["heroine", "bucket"],
      ["heroine", "pillow"],
      ["heroine", "pant"],
      ["heroine", "climb"],
      ["hmwater", "lecture"],
      ["qiu", "pillow"],
      ["tieniu", "carry"],
      ["outerM", "scrub"],
    ] as const) {
      const anim = getAnim(c, a, 2);
      expect(charDef(c).anims, `${c} ${a}`).toContain(a);
      expect(new Set(anim.frames.map((f) => Buffer.from(f.data).toString("base64"))).size, `${c} ${a}`).toBeGreaterThan(1);
    }
  });

  it("speaks as each beginning would at the herald", () => {
    for (const o of ["disciple", "foundling", "defector"] as const) {
      const g = atLevel({ ...newGameAs(o), flags: { ...newGameAs(o).flags, metElder: true } }, 2);
      const steps = hallsTalk("wd-herald", g)!;
      expect(steps.some((s) => "say" in s && s.say === "heroine"), o).toBe(true);
    }
  });
});

describe("plot holes, mended (the Founder's Road)", () => {
  it("never has the Dao-Eater claim nine Daos his Echoes no longer hold", async () => {
    const { syncRoadFlags, BOOKS } = await import("@/game/story/road");
    const base = syncRoadFlags({ ...ready(), flags: { ...ready().flags, villageSaved: true, patriarchDefeated: true }, counters: { road: 999 } });
    const g = atLevel(base, 19);
    const pre = JSON.stringify(preBattleScript("kongming", "echo-void", g));
    expect(pre).not.toMatch(/Nine Daos in me/);
    expect(pre).toMatch(/sent every one of them home/);
    // and if she ate some herself, he says so
    const ate = { ...g, flags: { ...g.flags, "devoured:water": true, "devoured:fire": true } };
    expect(JSON.stringify(preBattleScript("kongming", "echo-void", ate))).toMatch(/2 of them you ate yourself/);
    expect(ENEMIES.kongming.intro).not.toMatch(/Nine Daos, and I still/);
    expect(BOOKS.void.keeper).toMatch(/taken all nine back/);
    // nor do his fates speak of nine Daos bursting out of a man who no longer holds them
    const fates = JSON.stringify(victoryScript("kongming", "echo-void", "harbor", g));
    expect(fates).not.toMatch(/nine stolen Daos|nine Daos out of him/);
    // and eating only him does not leave ten Daos burning in her
    const eaten = play(g, victoryScript("kongming", "echo-void", "harbor", g), [3]);
    expect(eaten.flags["devoured:void"]).toBe(true);
    expect(JSON.stringify(victoryScript("kongming", "echo-void", "harbor", g))).not.toMatch(/Ten Daos burn/);
  });

  it("does not hand a runaway or a foundling the founder's sword she was never given", async () => {
    const { roadTalk, keeperKey } = await import("@/game/story/road");
    for (const o of ["disciple", "foundling", "defector"] as const) {
      const g = atLevel({ ...newGameAs(o), flags: { ...newGameAs(o).flags, metElder: true } }, 4);
      const text = JSON.stringify(roadTalk(keeperKey(0), g));
      expect(text, o).not.toMatch(/founder's sword/);
    }
    const run = atLevel({ ...newGameAs("defector"), flags: { ...newGameAs("defector").flags, metElder: true } }, 4);
    expect(JSON.stringify(roadTalk(keeperKey(0), run))).toMatch(/Blood Moon/);
  });
});
