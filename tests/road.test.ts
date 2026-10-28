import { describe, expect, it } from "vitest";
import { newGame, stats, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS, statsFor } from "@/game/engine/realms";
import { DAO_IDS, dominantDao } from "@/game/engine/dao";
import { openingWound, woundLine } from "@/game/engine/battle";
import { ECHO_BOSSES, ENEMIES } from "@/game/engine/enemies";
import { comprehend, DOMAIN_STAGES, domainOpen, GREAT_DAO_IDS, SHRINE_DAO, wuCap, wuJournal, wuPoints, wuStats, wuTier, wuTotal, WU_TIERS } from "@/game/engine/comprehension";
import { CULT } from "@/game/engine/cultivation";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { BOOKS, currentRoad, KOANS, keeperKey, roadBreath, roadChronicle, roadCultivated, roadDone, roadHunt, roadLandmark, roadLog, roadOpen, roadQuests, roadRegion, roadTalk, ROAD_BOOK, ROAD_COUNT, syncRoadFlags } from "@/game/story/road";
import { tideNpcScript } from "@/game/story/tide";
import { hasAttire } from "@/game/story/wardrobe";
import { getWorld, HAILING } from "@/game/world/continent";
import { echoOf, ROAD_DAOS, ROAD_SITES, STREET_FOLK, TIDE_FOLK } from "@/game/world/road";
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

/** Every question in a script, with its answers. */
function questions(steps: Step[]): { prompt?: string; labels: string[] }[] {
  return steps.filter((s): s is Extract<Step, { choose: unknown }> => "choose" in s).map((s) => ({ prompt: s.prompt, labels: s.choose.map((c) => c.label) }));
}

/** Her realm set to an overall level index. */
function atLevel(g: GameState, level: number): GameState {
  let n = level;
  for (let r = 0; r < REALMS.length; r++) {
    if (n < REALMS[r].stages) return { ...g, realm: r, stage: n, cultivation: 0 };
    n -= REALMS[r].stages;
  }
  return g;
}

/** A Foundation disciple the whole jianghu is open to. */
const ready = (): GameState => atLevel({ ...newGame(), flags: { metElder: true, villageSaved: true, metZhou: true, foxesCleared: true, metHuli: true, metWen: true, serpentKingDefeated: true, patriarchDefeated: true } }, 4);

/** Do whatever the current quest asks, as the game would, answering questions with `pick`. */
function doQuest(g: GameState, pick: number): GameState {
  const q = currentRoad(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  switch (q.kind) {
    case "seek":
    case "ask":
    case "koan":
    case "stele":
      return play(g, roadTalk(q.npc!, g)!, [pick]);
    case "trial":
      for (let k = 0; k < q.count; k++) {
        const r = roadHunt(g, q.foe!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "contemplate":
      for (let k = 0; k < q.count; k++) {
        const r = roadBreath(g, q.region!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "observe":
      return play(g, roadLandmark(q.landmark!, g, { night: q.how === "night", riding: q.how === "ride", flying: q.how === "fly" })!);
    case "comprehend":
      // whatever she still lacks, she sits with until she has it
      while (wuTier(g, q.dao) < Math.min(2, wuCap(g.realm))) g = comprehend(g, q.dao, 1).state;
      return play(g, roadCultivated(g)!);
    case "echo": {
      const boss = echoOf(q.book);
      expect(preBattleScript(boss, `echo-${q.dao}`, g)).not.toBeNull();
      return play(g, victoryScript(boss, `echo-${q.dao}`, ROAD_SITES[q.book].region, g), [pick]);
    }
  }
}

describe("the Great Daos of heaven and earth", () => {
  it("deepen through five stages, as far as her realm can hold", () => {
    let g = atLevel(newGame(), 0);
    expect(wuTier(g, "water")).toBe(0);
    g = comprehend(g, "water", 3).state;
    expect(wuTier(g, "water")).toBe(1);
    // Qi Condensation holds only Entry: the rest waits at the gate
    const capped = comprehend(g, "water", 50);
    expect(capped.capped).toBe(true);
    expect(wuTier(capped.state, "water")).toBe(1);
    expect(wuPoints(capped.state, "water")).toBe(WU_TIERS[1].at - 1);
    // a Spirit Severing cultivator can become the Dao
    const sage = comprehend(atLevel(newGame(), 16), "void", 200);
    expect(sage.tierUp).toBe(5);
    expect(wuCap(4)).toBe(5);
  });

  it("strengthens her in each Dao's own way", () => {
    const base = statsFor(2, 0);
    expect(wuStats(base, newGame())).toEqual(base);
    const w = (id: (typeof GREAT_DAO_IDS)[number]) => wuStats(base, comprehend(atLevel(newGame(), 12), id, 30).state);
    expect(w("water").maxQi).toBeGreaterThan(base.maxQi);
    expect(w("wood").maxHp).toBeGreaterThan(base.maxHp);
    expect(w("fire").atk).toBeGreaterThan(base.atk);
    expect(w("earth").def).toBeGreaterThan(base.def);
    expect(w("wind").spd).toBeGreaterThan(base.spd);
    // and the game's own stats include them
    const g = comprehend(atLevel(newGame(), 12), "earth", 30).state;
    expect(stats(g).def).toBeGreaterThan(stats(atLevel(newGame(), 12)).def);
  });

  it("unfolds a Dao Domain at Nascent Soul that staggers foes, and lets her see through an Echo of a Dao she truly knows", () => {
    let g = atLevel(newGame(), 12);
    for (const id of GREAT_DAO_IDS.slice(0, 4)) g = comprehend(g, id, 30).state;
    expect(wuTotal(g)).toBeGreaterThanOrEqual(DOMAIN_STAGES);
    expect(domainOpen(g)).toBe(true);
    expect(domainOpen(atLevel(g, 8))).toBe(false);
    expect(openingWound("wolf", g)).toBeGreaterThan(0);
    expect(woundLine("wolf", g)).toMatch(/Domain/);
    const weak = atLevel(newGame(), 4);
    expect(openingWound("echoWater", weak)).toBe(0);
    const knows = comprehend(atLevel(newGame(), 8), "water", 30).state;
    expect(openingWound("echoWater", knows)).toBeGreaterThan(0);
    expect(woundLine("echoWater", knows)).toMatch(/Water/);
  });

  it("runs strong at the shrines of every land, and shows in the journal", () => {
    for (const area of ["sect", "village", "bamboo", "lake", "marsh", "terraces", "desert", "harbor", "frost"]) expect(SHRINE_DAO[area], area).toBeDefined();
    const j = wuJournal(comprehend(atLevel(newGame(), 4), "fire", 12).state);
    expect(j).toHaveLength(10);
    expect(j.find((x) => x.id === "fire")!.stage).toMatch(/Lesser/);
    expect(j.find((x) => x.id === "fire")!.capped).toBe(true);
  });
});

describe("the Founder's Road", () => {
  const all = roadQuests();
  const w = getWorld();
  const npcKeys = new Set(w.npcs.map((n) => n.key));
  const landmarks = new Set(w.landmarks.map((l) => l.key));

  it("is a thousand quests in ten books, one for each Great Dao, opened by Qingxu and closed by an Echo", () => {
    expect(all).toHaveLength(ROAD_COUNT);
    expect(ROAD_DAOS).toHaveLength(ROAD_COUNT / ROAD_BOOK);
    for (let b = 0; b < 10; b++) {
      const book = all.slice(b * ROAD_BOOK, (b + 1) * ROAD_BOOK);
      expect(book.every((q) => q.dao === ROAD_DAOS[b])).toBe(true);
      expect(book[0].kind).toBe("seek");
      expect(book[0].npc).toBe(keeperKey(b));
      expect(book[50].kind).toBe("comprehend");
      expect(book[98].kind).toBe("stele");
      expect(book[99].kind).toBe("echo");
      expect(new Set(book.filter((q) => q.kind === "koan").map((q) => q.koan)).size).toBe(9);
      for (const k of ["contemplate", "observe", "ask", "trial"]) expect(book.some((q) => q.kind === k), `${ROAD_DAOS[b]} ${k}`).toBe(true);
    }
    expect(roadQuests()[333]).toBe(all[333]);
    for (const q of all) {
      expect(q.objective, `${q.id}`).not.toMatch(/\{|\}|undefined/);
      expect(q.brief, `${q.id}`).not.toMatch(/\{|\}|undefined/);
      expect(q.done, `${q.id}`).not.toMatch(/\{|\}|undefined/);
      if (q.npc) expect(npcKeys.has(q.npc), `${q.id} ${q.npc}`).toBe(true);
      if (q.landmark) expect(landmarks.has(q.landmark), `${q.id} ${q.landmark}`).toBe(true);
      if (q.region) expect(["sect", "village", "bamboo", "lake", "marsh", "terraces", "desert", "harbor", "frost", "valley", "peak"]).toContain(q.region);
      expect(roadRegion(q)).toBeDefined();
    }
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    expect(all[0].level).toBe(4);
    expect(all[ROAD_COUNT - 1].level).toBe(19);
  });

  it("opens once she has built her foundation, and not before", () => {
    const qi = { ...ready(), realm: 0, stage: 3 };
    expect(roadOpen(qi)).toBe(false);
    expect(roadLog(qi)).toBeNull();
    expect(roadOpen(ready())).toBe(true);
    expect(roadLog(ready())!.objective).toMatch(/Qingxu/);
    // past a book's middle, it waits on her understanding as well as her realm
    let g = syncRoadFlags({ ...ready(), counters: { road: 51 } });
    g = atLevel(g, 5);
    expect(roadLog(g)!.objective).toMatch(/Lesser Mastery/);
    g = comprehend(g, "water", 12).state;
    expect(roadLog(g)!.objective).not.toMatch(/asks for/);
  });

  it("is walked to the end: every stele is hollowed, mended and guarded, and the ending remembers it", () => {
    let g = ready();
    for (let n = 0; n < ROAD_COUNT; n++) {
      const q = currentRoad(g)!;
      expect(q.id).toBe(n);
      // never eat the Dao (the last answer) on the way, so the founder's robe is hers at the end
      g = doQuest(g, q.kind === "echo" ? (q.book % 3) : (q.book % 4) === 3 ? 2 : q.book % 4);
      expect(roadDone(g), `quest ${n} (${q.kind})`).toBe(n + 1);
      if (q.kind === "seek") expect(g.flags[`hollowed:${q.dao}`]).toBe(true);
      if (q.kind === "stele") expect(g.flags[`echo:${q.dao}`]).toBe(true);
      if (q.kind === "echo") {
        expect(g.flags[`restored:${q.dao}`]).toBe(true);
        expect(g.flags[`hollowed:${q.dao}`]).toBe(false);
        expect(g.flags[`devoured:${q.dao}`]).toBeFalsy();
        expect(wuTier(g, q.dao)).toBeGreaterThanOrEqual(2);
      }
    }
    expect(currentRoad(g)).toBeNull();
    expect(g.flags["road:done"]).toBe(true);
    expect(roadLog(g)!.title).toMatch(/Clear Snow/);
    for (const a of ["pilgrim", "daomantle", "clearsnow"]) expect(hasAttire(g, a), a).toBe(true);
    expect(hasAttire(g, "hollowrobe")).toBe(false);
    expect(roadChronicle(g).every((s) => s.state === "restored")).toBe(true);
    // she understands every Great Dao the Road passed through, and her domain is open
    for (const dao of ROAD_DAOS) expect(wuTier(g, dao), dao).toBeGreaterThanOrEqual(2);
    expect(domainOpen(g)).toBe(true);
    const text = JSON.stringify(endingScript({ ...g, realm: 4, stage: 3, flags: { ...g.flags, heartReturned: true } }));
    expect(text).toMatch(/second verse, signed Lin Yue/);
  }, 90_000);

  it("lets her eat a Dao, at a price the land and her heart both pay", () => {
    let g = ready();
    while (currentRoad(g)!.kind !== "echo") g = doQuest(g, 0);
    const q = currentRoad(g)!;
    const before = wuPoints(g, q.dao);
    const demons = g.counters[CULT.demon] ?? 0;
    const steps = victoryScript(echoOf(0), "echo-water", "lake", g);
    expect(questions(steps)[0].labels).toHaveLength(4);
    g = play(g, steps, [3]);
    expect(g.flags["devoured:water"]).toBe(true);
    expect(g.flags["restored:water"]).toBe(true);
    expect(wuPoints(g, "water")).toBeGreaterThan(before);
    expect(g.counters[CULT.demon] ?? 0).toBeGreaterThan(demons);
    expect(roadChronicle(g)[0].state).toBe("devoured");
    expect(dominantDao(g) === "slaughter" || (g.counters["dao:slaughter"] ?? 0) > 0).toBe(true);
  });

  it("only counts the hollowed for its trials and the right land's shrines for its sittings", () => {
    let g = play(ready(), roadTalk(keeperKey(0), ready())!);
    while (currentRoad(g)!.kind !== "trial") g = doQuest(g, 0);
    expect(roadHunt(g, "wolf").state).toBe(g);
    expect(roadHunt(g, "hollowshade").state.counters.roadp).toBe(1);
    while (currentRoad(g)!.kind !== "contemplate") g = doQuest(g, 0);
    const q = currentRoad(g)!;
    const wrong = q.region === "desert" ? "frost" : "desert";
    expect(roadBreath(g, wrong).steps).toBeNull();
    expect(roadBreath(g, wrong).state).toBe(g);
  });

  it("asks questions whose deeper answers only show to a deeper understanding", () => {
    expect(KOANS.length).toBeGreaterThanOrEqual(15);
    expect(KOANS.some((k) => k.options.some((o) => o.wu))).toBe(true);
    for (const k of KOANS) expect(new Set(k.options.map((o) => o.heart)).size, k.title).toBe(4);
    let g = play(ready(), roadTalk(keeperKey(0), ready())!);
    let found = false;
    for (let n = 0; n < 99 && !found; n++) {
      const q = currentRoad(g)!;
      if (q.kind === "koan" && KOANS[q.koan!].options.some((o) => o.wu)) {
        const shallow = questions(roadTalk(q.npc!, { ...g, counters: { ...g.counters, "wu:water": 0 } })!)[0];
        const deep = questions(roadTalk(q.npc!, comprehend(g, "water", 50).state)!)[0];
        expect(deep.labels.length).toBeGreaterThan(shallow.labels.length);
        expect(shallow.prompt).toMatch(/deeper understanding/);
        found = true;
      } else g = doQuest(g, 0);
    }
    expect(found).toBe(true);
  });

  it("stands its steles, its keeper, its hollowed and its Echoes on reachable ground", () => {
    for (let b = 0; b < 10; b++) {
      const dao = ROAD_DAOS[b];
      expect(w.landmarks.some((l) => l.key === `stele-${dao}`), dao).toBe(true);
      expect(w.npcs.some((n) => n.key === `keeper-${dao}`), dao).toBe(true);
      expect(w.enemies.some((e) => e.key === `echo-${dao}` && e.enemy === echoOf(b)), dao).toBe(true);
      expect(w.enemies.filter((e) => e.key.startsWith(`hollow-${dao}`)).length, dao).toBeGreaterThan(0);
    }
    expect(w.props.filter((p) => p.id === "daostele").length).toBe(10);
    // Qingxu stands only at the stele of the book she is on
    const keeper = w.npcs.find((n) => n.key === keeperKey(2))!;
    const at2 = syncRoadFlags({ ...ready(), counters: { road: 250 } });
    expect(keeper.when!(at2.flags)).toBe(true);
    expect(w.npcs.find((n) => n.key === keeperKey(0))!.when!(at2.flags)).toBe(false);
  });

  it("gives every Echo and the Dao-Eater a body, a battle and words", () => {
    for (const id of ECHO_BOSSES) {
      const e = ENEMIES[id];
      expect(e.boss).toBe(true);
      expect(charDef(e.sprite).anims).toContain("attack");
      expect(getAnim(e.sprite, "idle", 3).frames.length).toBeGreaterThan(0);
    }
    expect(ENEMIES.kongming.level).toBe(19);
    const g = syncRoadFlags({ ...ready(), counters: { road: 999 } });
    expect(JSON.stringify(preBattleScript("kongming", "echo-void", atLevel(g, 19)))).toMatch(/Tuoba Hong/);
    expect(questions(victoryScript("kongming", "echo-void", "harbor", atLevel(g, 19)))[0].labels.join(" ")).toMatch(/Eat the Dao-Eater/);
  });

  it("has Qingxu speak between quests, and says what each book's land has lost", () => {
    for (const dao of ROAD_DAOS) {
      expect(BOOKS[dao].hollowing.length).toBeGreaterThan(40);
      expect(BOOKS[dao].verse).toMatch(/“/);
    }
    const g = syncRoadFlags({ ...ready(), counters: { road: 3 } });
    expect(npcScript("keeper-water", g).some((s) => "say" in s && s.say === "keeper")).toBe(true);
  });
});

describe("the Tidewater Reach and the busier streets", () => {
  const w = getWorld();
  const S = WORLD_SCALE;
  it("raises the port of Hailing in the south-east, walled, with canals, bridges and sampans", () => {
    const { x0, y0, x1, y1, c, canalsJ } = HAILING;
    const inCity = (i: number, j: number) => i >= x0 * S && i <= (x1 + 1) * S && j >= y0 * S && j <= (y1 + 1) * S;
    expect(w.props.filter((p) => (p.id === "citywall" || p.id === "citywallY") && inCity(p.i, p.j)).length).toBeGreaterThan(100);
    expect(w.props.filter((p) => p.id === "sampan" && inCity(p.i, p.j)).length).toBeGreaterThanOrEqual(5);
    expect(w.props.filter((p) => p.id === "house" && inCity(p.i, p.j)).length).toBeGreaterThanOrEqual(12);
    // the canal is water, and the street crosses it on a bridge
    expect(w.map.kind(530 * S, canalsJ[0] * S)).toBe("water");
    expect(w.map.standable(c[0] * S, canalsJ[0] * S)).toBe(true);
    for (const l of ["hailing", "saltwind", "returningcloud"]) expect(w.landmarks.some((x) => x.key === l), l).toBe(true);
    // the causeway reaches the isle
    expect(w.map.standable(600 * S, 527 * S)).toBe(true);
  });

  it("fills Hailing's square, Jinhe's north-gate fair and Willow Creek's market road with people at work and play", () => {
    for (const f of TIDE_FOLK) expect(w.npcs.some((n) => n.key === f.key), f.key).toBe(true);
    for (const f of STREET_FOLK) expect(w.npcs.some((n) => n.key === f.key), f.key).toBe(true);
    const busy = new Set(w.npcs.filter((n) => /^(hl|jh|wc)/.test(n.key)).map((n) => n.anim));
    for (const a of ["liondance", "acrobat", "puppet", "abacus", "xiangqi", "firecracker", "hawk", "row"]) expect(busy.has(a as never), a).toBe(true);
    for (const id of ["puppetbooth", "xiangqitable", "steamer", "pinwheels", "firecrackers", "skylanterns", "prayerwheel", "saltpan"]) expect(w.props.some((p) => p.id === id), id).toBe(true);
    // and each of them has something to say, by her realm and the Road
    const g = newGame();
    for (const f of [...TIDE_FOLK, ...STREET_FOLK]) expect(tideNpcScript(f.key, g), f.key).not.toBeNull();
    const steps = tideNpcScript("jhlion1", g)!;
    expect(steps.some((s) => "say" in s && s.say === "liondancer" && s.name === "Lion Dancer Da Shan")).toBe(true);
    const restored = { ...g, flags: { ...g.flags, "restored:void": true } };
    expect(JSON.stringify([0, 1, 2, 3, 4, 5].map((k) => tideNpcScript("hlharbor", { ...restored, playTime: k * 7 })))).toMatch(/horizon/);
  });

  it("paints the new props and the new folk at their new work", () => {
    for (const id of ["daostele", "eatenstele", "qiwhirl", "firecrackers", "sampan", "steamer", "xiangqitable", "puppetbooth", "pinwheels", "skylanterns", "prayerwheel", "saltpan"] as const) expect(getProp(id).frames[0].opaqueCount(), id).toBeGreaterThan(30);
    for (const [c, a] of [
      ["liondancer", "liondance"],
      ["acrobat", "acrobat"],
      ["storyteller", "puppet"],
      ["merchant", "abacus"],
      ["villagerM", "firecracker"],
      ["cook", "hawk"],
      ["scholar", "xiangqi"],
      ["boatwoman", "row"],
      ["heroine", "comprehend"],
      ["heroine", "domain"],
      ["keeper", "read"],
      ["kongming", "levitate"],
    ] as const) {
      const anim = getAnim(c, a, 2);
      expect(charDef(c).anims, `${c} ${a}`).toContain(a);
      expect(new Set(anim.frames.map((f) => Buffer.from(f.data).toString("base64"))).size, `${c} ${a}`).toBeGreaterThan(1);
    }
  });
});

describe("plot holes, mended", () => {
  it("never sends Quartermaster Bao his own supplies, nor puts a mother's or a farmer's words in an officer's or a child's mouth", async () => {
    const { warQuests } = await import("@/game/story/war");
    for (const q of warQuests()) {
      if (q.kind === "supply") expect(q.npc!.startsWith("bao-"), `${q.id}`).toBe(false);
      if (q.kind === "report" && /^(bao|sulan|tian|feiyan|ashina|kou)-/.test(q.npc!)) {
        expect(q.done, `${q.id}`).not.toMatch(/his mother is well|Thank the army|We will rebuild/);
        expect(q.objective, `${q.id}`).not.toMatch(/their son rides|lost their home|under their floor/);
      }
    }
  });

  it("has the General speak of Patriarch Xue at the crimson front while he lives, and of a broken elder at the last", async () => {
    const { warTalk, syncWarFlags } = await import("@/game/story/war");
    const base = { ...ready(), flags: { ...ready().flags, patriarchDefeated: false } };
    const valley = atLevel(syncWarFlags({ ...base, counters: { war: 800 } }), 15);
    expect(JSON.stringify(warTalk("yue-valley", valley))).toMatch(/Xue/);
    const killed = atLevel(syncWarFlags({ ...ready(), counters: { war: 800 } }), 15);
    expect(JSON.stringify(warTalk("yue-valley", killed))).not.toMatch(/Xue still holds/);
    const broken = atLevel(syncWarFlags({ ...ready(), flags: { ...ready().flags, moBroken: true, "heart:devoured": true }, counters: { war: 900 } }), 17);
    expect(JSON.stringify(warTalk("yue-sect", broken))).toMatch(/mortal's broom/);
  });

  it("does not say she went up to heaven in an ending where she stayed", async () => {
    const { warEpilogue } = await import("@/game/story/war");
    const g = { ...ready(), counters: { war: 20 } };
    expect(warEpilogue(g)).not.toMatch(/went up/);
    expect(warEpilogue(g)).toMatch(/threshold/);
  });

  it("explains why a front's wounded land is mended at another land's shrine", async () => {
    const { warQuests } = await import("@/game/story/war");
    const heal = warQuests().find((q) => q.kind === "heal" && q.front === "valley")!;
    expect(heal.objective).toMatch(/fouled/);
  });

  it("names the man who taught the Khan to eat cores", () => {
    expect(KOANS.some((k) => /Tuoba Hong/.test(k.ask))).toBe(true);
    expect(DAO_IDS).toHaveLength(4);
  });
});
