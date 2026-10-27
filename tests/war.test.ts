import { describe, expect, it } from "vitest";
import { newGame, stats, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS, statsFor } from "@/game/engine/realms";
import { DAO_IDS, daoLabel, daoTier, dominantDao, walkDao } from "@/game/engine/dao";
import { openingWound } from "@/game/engine/battle";
import { ENEMIES, WAR_BOSSES } from "@/game/engine/enemies";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { BOOK, completeWar, currentWar, DILEMMAS, FRONTS, questRegion, syncWarFlags, WAR_COUNT, warBreath, warCultivated, warDone, warHunt, warLandmark, warLog, warQuests, warTalk } from "@/game/story/war";
import { daoAside } from "@/game/story/dao";
import { hasAttire } from "@/game/story/wardrobe";
import { getWorld } from "@/game/world/continent";
import { FRONT_IDS, frontBoss, frontFoes } from "@/game/world/war";
import { syncTerrain } from "@/game/runtime/world";
import { Game } from "@/game/runtime/Game";
import { charDef, getAnim, getPortrait, HUMAN_IDS, STYLES } from "@/game/art/characters";

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

/** Every question in a script, with its answers (first answers taken along the way). */
function questions(steps: Step[]): { prompt?: string; labels: string[] }[] {
  const out: { prompt?: string; labels: string[] }[] = [];
  const queue = [...steps];
  while (queue.length) {
    const st = queue.shift()!;
    if ("choose" in st) {
      out.push({ prompt: st.prompt, labels: st.choose.map((c) => c.label) });
      queue.unshift(...st.choose[0].then);
    }
  }
  return out;
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

/** A heroine the whole jianghu is open to. */
const ready = (): GameState => ({
  ...newGame(),
  flags: { metElder: true, villageSaved: true, metZhou: true, foxesCleared: true, metHuli: true, metWen: true, serpentKingDefeated: true, patriarchDefeated: true },
});

/** Do whatever the current quest asks, as the game would, answering questions with `pick`. */
function doQuest(g: GameState, pick: number): GameState {
  const q = currentWar(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  switch (q.kind) {
    case "muster":
    case "report":
    case "supply":
    case "dao":
    case "rally":
      return play(g, warTalk(q.npc!, g)!, [pick]);
    case "fight":
      for (let k = 0; k < q.count; k++) {
        const r = warHunt(g, frontFoes(q.front)[0], q.front);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "heal":
      for (let k = 0; k < q.count; k++) {
        const r = warBreath(g, q.region!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "scout":
    case "rescue":
      return play(g, warLandmark(q.landmark!, g, { night: true, riding: true, flying: true })!);
    case "cultivate":
      return play(g, warCultivated(g)!);
    case "siege": {
      const boss = frontBoss(q.front);
      expect(preBattleScript(boss, `siege-${q.front}`, g)).not.toBeNull();
      return play(g, victoryScript(boss, `siege-${q.front}`, q.front, g), [pick]);
    }
  }
}

describe("the War of the Iron Banner", () => {
  const all = warQuests();
  const w = getWorld();
  const npcKeys = new Set(w.npcs.map((n) => n.key));
  const landmarks = new Set(w.landmarks.map((l) => l.key));

  it("is a thousand quests in ten books, each opened by a muster and closed by its captain", () => {
    expect(all).toHaveLength(WAR_COUNT);
    expect(FRONT_IDS).toHaveLength(WAR_COUNT / BOOK);
    for (let b = 0; b < 10; b++) {
      const book = all.slice(b * BOOK, (b + 1) * BOOK);
      expect(book.every((q) => q.front === FRONT_IDS[b])).toBe(true);
      expect(book[0].kind).toBe("muster");
      expect(book[98].kind).toBe("rally");
      expect(book[99].kind).toBe("siege");
      expect(book[50].kind).toBe("cultivate");
      expect(book.filter((q) => q.kind === "dao")).toHaveLength(9);
      // nine different dilemmas in each book
      expect(new Set(book.filter((q) => q.kind === "dao").map((q) => q.dilemma)).size).toBe(9);
      for (const k of ["fight", "report", "supply", "scout", "heal", "rescue"]) expect(book.some((q) => q.kind === k), `${FRONT_IDS[b]} ${k}`).toBe(true);
    }
    // the same every time, and every one of them says what to do
    expect(warQuests()[517]).toBe(all[517]);
    for (const q of all) {
      expect(q.title.length, `${q.id}`).toBeGreaterThan(3);
      expect(q.objective).not.toMatch(/\{|\}|undefined/);
      expect(q.brief).not.toMatch(/\{|\}|undefined/);
      if (q.npc) expect(npcKeys.has(q.npc), `${q.id} ${q.npc}`).toBe(true);
      if (q.landmark) expect(landmarks.has(q.landmark), `${q.id} ${q.landmark}`).toBe(true);
    }
  });

  it("asks for more cultivation as it goes, up to the peak of Spirit Severing for the Khan", () => {
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    expect(all[0].level).toBe(0);
    expect(all[WAR_COUNT - 1].level).toBe(19);
    // a heroine below what the war asks is told to cultivate, not sent on
    let g = ready();
    g = play(g, warTalk("yue-village", g)!);
    g = { ...g, counters: { ...g.counters, war: 151 } };
    g = syncWarFlags(g);
    expect(warLog(g)!.objective).toMatch(/asks for/);
    expect(warTalk(currentWar(g)!.npc ?? "nobody", g) ?? []).not.toContainEqual(expect.objectContaining({ mutate: expect.anything() }));
  });

  it("is fought to the end: every front burns, is won back and is scarred by the Dao she walked", () => {
    let g = atLevel(ready(), 0);
    expect(warLog(newGame())).toBeNull();
    expect(currentWar(g)!.kind).toBe("muster");
    for (let n = 0; n < WAR_COUNT; n++) {
      const q = currentWar(g)!;
      expect(q.id).toBe(n);
      // the first books walked on mercy, then the sword, the balance and slaughter in turn (the first answer leads each)
      const pick = Math.floor(q.book / 3) % 4;
      g = doQuest(g, pick);
      expect(warDone(g), `quest ${n} (${q.kind})`).toBe(n + 1);
      if (q.kind === "muster") {
        expect(g.flags[`war:${q.front}`]).toBe(true);
        expect(g.flags[`camp:${q.front}`]).toBe(true);
      }
      if (q.kind === "rally") expect(g.flags[`siege:${q.front}`]).toBe(true);
      if (q.kind === "siege") {
        expect(g.flags[`war:${q.front}`]).toBe(false);
        expect(g.flags[`freed:${q.front}`]).toBe(true);
        expect(DAO_IDS.some((d) => g.flags[`scar:${q.front}:${d}`])).toBe(true);
      }
    }
    expect(currentWar(g)).toBeNull();
    expect(g.flags["war:won"]).toBe(true);
    expect(warLog(g)!.title).toBe("Peace");
    expect(hasAttire(g, "lamellar")).toBe(true);
    expect(hasAttire(g, "bannergeneral")).toBe(true);
    expect(["swordsaint", "bodhisattva", "taijisage", "asura"].some((a) => hasAttire(g, a))).toBe(true);
    // she has walked a Dao deep enough to show
    expect(dominantDao(g)).not.toBeNull();
    expect(daoTier(g)).toBeGreaterThanOrEqual(3);
    // and the ending remembers the war and the Dao
    const text = JSON.stringify(endingScript({ ...g, realm: 4, stage: 3, flags: { ...g.flags, heartReturned: true } }));
    expect(text).toMatch(/border|steles|grey|cairns/);
  }, 60_000);

  it("only counts the horde beaten on the front it burns, and shrines in the land it wounded", () => {
    let g = play(atLevel(ready(), 0), warTalk("yue-village", ready())!);
    // find the first fight of the book
    while (currentWar(g)!.kind !== "fight") g = doQuest(g, 0);
    const q = currentWar(g)!;
    expect(warHunt(g, "raider", "lake").steps).toBeNull();
    expect(warHunt(g, "raider", "lake").state).toBe(g);
    expect(warHunt(g, "wolf", q.front).state).toBe(g);
    const r = warHunt(g, "raider", q.front);
    expect(r.state.counters.warp).toBe(1);
    expect(warBreath(g, "desert").steps).toBeNull();
  });

  it("each dilemma leans her heart toward the Dao of her answer, and deeper cultivation opens other answers", () => {
    let g = play(atLevel(ready(), 0), warTalk("yue-village", ready())!);
    while (currentWar(g)!.kind !== "dao") g = doQuest(g, 0);
    const q = currentWar(g)!;
    const weak = questions(warTalk(q.npc!, g)!)[0];
    const strong = questions(warTalk(q.npc!, { ...g, realm: 3 })!)[0];
    expect(strong.labels.length).toBeGreaterThanOrEqual(weak.labels.length);
    expect(DILEMMAS.some((d) => d.options.some((o) => o.realm))).toBe(true);
    for (let k = 0; k < weak.labels.length; k++) {
      const after = play(g, warTalk(q.npc!, g)!, [k]);
      expect(warDone(after)).toBe(warDone(g) + 1);
      expect(DAO_IDS.reduce((n, d) => n + (after.counters[`dao:${d}`] ?? 0), 0)).toBeGreaterThan(0);
    }
  });
});

describe("the Dao", () => {
  it("leads once one Dao outweighs the others, and deepens through four tiers", () => {
    let g = newGame();
    expect(dominantDao(g)).toBeNull();
    expect(daoLabel(g)).toBeNull();
    g = walkDao(g, "sword", 3);
    expect(dominantDao(g)).toBe("sword");
    expect(daoLabel(g)).toBe("Dao of the Sword · Glimpse");
    g = walkDao(g, "balance", 3);
    expect(dominantDao(g)).toBeNull(); // pulled level: the heart is torn
    g = walkDao(g, "sword", 50);
    expect(daoTier(g)).toBe(4);
    // mercy and slaughter wear each other away
    let m = walkDao(newGame(), "mercy", 5);
    m = walkDao(m, "slaughter", 1);
    expect(m.counters["dao:mercy"]).toBe(4);
  });

  it("reshapes her body and qi as she walks it", () => {
    const base = statsFor(2, 0);
    const at = (d: (typeof DAO_IDS)[number]) => stats(walkDao({ ...newGame(), realm: 2, stage: 0 }, d, 25));
    expect(at("sword").atk).toBeGreaterThan(base.atk);
    expect(at("mercy").maxHp).toBeGreaterThan(base.maxHp);
    expect(at("balance").maxQi).toBeGreaterThan(base.maxQi);
    expect(at("slaughter").atk).toBeGreaterThan(at("sword").atk);
    expect(at("slaughter").def).toBeLessThan(base.def);
    expect(stats({ ...newGame(), realm: 2, stage: 0 })).toEqual(base);
  });

  it("the people who know her speak of it, once for each depth", () => {
    let g: GameState = walkDao<GameState>({ ...newGame(), flags: { metElder: true } }, "mercy", 3);
    const aside = daoAside("elder", g)!;
    expect(aside.some((s) => "say" in s && /pain/.test(s.text))).toBe(true);
    g = play(g, aside);
    expect(daoAside("elder", g)).toBeNull();
    g = walkDao(g, "mercy", 10);
    expect(daoAside("elder", g)).not.toBeNull();
    expect(daoAside("zhou", walkDao(newGame(), "slaughter", 3))!.some((s) => "say" in s && /bow/.test(s.text))).toBe(true);
    // the old master's last words before heaven name it
    expect(JSON.stringify(npcScript("elderPeak", g))).toMatch(/Compassion/);
  });
});

describe("cultivation in war", () => {
  it("a horde soldier falters before a cultivator far above him; a captain only a little", () => {
    expect(openingWound("raider", atLevel(newGame(), 0))).toBe(0);
    expect(openingWound("raider", atLevel(newGame(), 7))).toBeGreaterThan(0);
    expect(openingWound("raider", atLevel(newGame(), 12))).toBeGreaterThan(openingWound("raider", atLevel(newGame(), 7)));
    expect(openingWound("borte", atLevel(newGame(), 3))).toBe(0);
    expect(openingWound("borte", atLevel(newGame(), 9))).toBeGreaterThan(0);
    expect(openingWound("wolf", atLevel(newGame(), 19))).toBe(0);
  });

  it("each captain is stronger than the last", () => {
    for (let i = 1; i < WAR_BOSSES.length; i++) {
      expect(ENEMIES[WAR_BOSSES[i]].hp).toBeGreaterThan(ENEMIES[WAR_BOSSES[i - 1]].hp);
      expect(ENEMIES[WAR_BOSSES[i]].atk).toBeGreaterThan(ENEMIES[WAR_BOSSES[i - 1]].atk);
    }
  });
});

describe("the war on the land", () => {
  const w = getWorld();

  it("scorches a burning front, and takes it back off when the front is won", () => {
    syncTerrain(w, {});
    const kinds = w.map.kinds.slice();
    const changed = syncTerrain(w, { "war:village": true, "camp:village": true });
    expect(changed.length).toBeGreaterThan(200);
    syncTerrain(w, { "freed:village": true, "scar:village:slaughter": true });
    expect(w.map.kinds).not.toEqual(kinds);
    syncTerrain(w, { "freed:village": true, "scar:village:balance": true });
    expect(w.map.kinds).toEqual(kinds);
    syncTerrain(w, {});
  });

  it("raises camps and pickets on every front, a captain for each, and a refugee camp in Willow Creek", () => {
    for (const front of FRONT_IDS) {
      expect(w.npcs.some((n) => n.key === `yue-${front}`), front).toBe(true);
      expect(w.npcs.filter((n) => n.key.startsWith(`spear-${front}-`))).toHaveLength(4);
      expect(w.enemies.filter((e) => e.key.startsWith(`war-${front}-`)).length).toBeGreaterThanOrEqual(5);
      expect(w.enemies.find((e) => e.key === `siege-${front}`)!.enemy).toBe(frontBoss(front));
      expect(w.props.some((p) => p.id === "wartent" && p.when?.({ [`camp:${front}`]: true, "war:begun": true }) && !p.when?.({}))).toBe(true);
    }
    expect(w.props.filter((p) => p.id === "warfire").length).toBeGreaterThan(50);
    // the people of a burning front wait in Willow Creek's refugee camp
    const gu = w.npcs.find((n) => n.key === "gu")!;
    expect(gu.when!({ "war:begun": true })).toBe(true);
    expect(w.npcs.find((n) => n.key === "ref-lake-0")!.when!({ "war:lake": true })).toBe(true);
  });

  it("every one of the war's folk has something of their own to say", () => {
    const g = syncWarFlags({ ...ready(), counters: { war: 340 } });
    for (const n of w.npcs.filter((x) => /^(yue|bao|sulan|tian|feiyan|ashina|kou|spear|ref|home|gu)/.test(x.key))) {
      const s = npcScript(n.key, g);
      expect(s.length, n.key).toBeGreaterThan(0);
      expect(s.some((st) => "say" in st && st.say === "narrator" && st.text === "…"), n.key).toBe(false);
    }
  });

  it("asks only for lands that are open, and says which are not", () => {
    // the lake's book needs the lake: without Hu Li's mist lifted, the journal says why
    let g = syncWarFlags({ ...atLevel(newGame(), 4), flags: { metElder: true, villageSaved: true, metZhou: true }, counters: { war: 201 } });
    const q = currentWar(g)!;
    expect(questRegion(q)).toBeDefined();
    const log = warLog(g, (id) => (id === "lake" ? "A spirit mist hides the lake." : null))!;
    if (questRegion(q) === "lake") expect(log.objective).toMatch(/mist/);
    g = completeWar(g, 201);
    expect(warDone(g)).toBe(202);
  });
});

describe("the war in the runtime", () => {
  it("General Yue musters the army in Willow Creek: the fields catch fire, the camp goes up, and a raider beaten counts", () => {
    const game = new Game({ ...ready(), area: "village" }, { seed: 3 });
    game.debugSkipTime(0.2);
    const yue = getWorld().npcs.find((n) => n.key === "yue-village")!;
    game.debugGoto(yue.i + 1.5, yue.j + 0.5);
    game.debugSkipTime(0.6);
    expect(game.snapshot().war!.title).toMatch(/Muster/);
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.mode).toBe("scene");
    const speakers = new Set<string>();
    for (let i = 0; i < 200 && game.mode === "scene"; i++) {
      game.debugSkipTime(0.3);
      speakers.add(game.snapshot().dialog?.portrait ?? "");
      game.keyDown("Enter");
      game.keyUp("Enter");
    }
    expect(speakers.has("general")).toBe(true);
    expect(game.state.flags["war:village"]).toBe(true);
    expect(game.world.actors.some((a) => a.key === "bao-village")).toBe(true);
    expect(game.world.actors.some((a) => a.key.startsWith("war-village-") && a.kind === "enemy") || getWorld().enemies.some((e) => e.key.startsWith("war-village-"))).toBe(true);
    expect(game.snapshot().warDone).toBe(1);
    expect(game.snapshot().war!.chapter).toMatch(/Book I:/);
  });

  it("paints the war's folk at work and its foes in arms", () => {
    for (const [id, anim] of [
      ["soldier", "march"],
      ["soldier", "spear"],
      ["general", "banner"],
      ["drummer", "drum"],
      ["medic", "bandage"],
      ["widow", "grieve"],
      ["heroine", "rally"],
      ["heroine", "horn"],
      ["raider", "attack"],
      ["tuoba", "roar"],
    ] as const) {
      const a = getAnim(id, anim, 2);
      expect(new Set(a.frames.map((f) => Buffer.from(f.data).toString("base64"))).size, `${id} ${anim}`).toBeGreaterThan(2);
    }
    expect(getPortrait("general")[0].opaqueCount()).toBeGreaterThan(1500);
  });
});

describe("dialogue portraits", () => {
  it("have eyes half the size they were", () => {
    // a blink changes only the eyes: the old eyes changed some 150 pixels of the portrait, eyes half as wide and half as tall about a third of that
    // (glowing eyes never blink)
    for (const id of HUMAN_IDS.filter((h) => charDef(h).portrait && !STYLES[h].glowEyes)) {
      const [open, , blink] = getPortrait(id);
      let eye = 0;
      for (let i = 0; i < open.data.length; i += 4) if (open.data[i] !== blink.data[i] || open.data[i + 1] !== blink.data[i + 1] || open.data[i + 2] !== blink.data[i + 2] || open.data[i + 3] !== blink.data[i + 3]) eye++;
      expect(eye, id).toBeGreaterThan(8);
      expect(eye, id).toBeLessThan(80);
    }
  });
});

void FRONTS;
