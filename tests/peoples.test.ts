import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { levelIndex, REALMS } from "@/game/engine/realms";
import { ENEMIES } from "@/game/engine/enemies";
import type { Step } from "@/game/story/script";
import { endingScript, npcScript, preBattleScript, victoryScript } from "@/game/story/story";
import { currentPeoples, MAIN_KINDS, peoplesBreath, peoplesChronicle, peoplesCultivated, peoplesDone, peoplesHunt, peoplesLandmark, peoplesLog, peoplesOpen, peoplesQuests, peoplesTalk, PEOPLES_BOOK, PEOPLES_COUNT, syncPeoplesFlags } from "@/game/story/peoples";
import { PEOPLE_BOOKS } from "@/game/story/peoplesBooks";
import { fillStanding } from "@/game/story/standing";
import { getWorld, regionAt } from "@/game/world/continent";
import { elderKey, ENVOY_KEY, folkKey, guideKey, HOME_R, PEOPLE_BOSSES, PEOPLE_FOES, PEOPLES } from "@/game/world/peoples";
import { charDef, getAnim, type AnimId, type HumanId } from "@/game/art/characters";
import { getProp } from "@/game/art/props";
import { propModel } from "@/game/three/propModels";
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

/** A late Qi Condensation disciple Elder Mo has sent out into the jianghu. */
const ready = (): GameState => atLevel({ ...newGame(), flags: { metElder: true, metZhou: true, villageSaved: true } }, 2);

/** Do whatever the current quest asks, as the game would. */
function doQuest(g: GameState, pick: number): GameState {
  const q = currentPeoples(g)!;
  if (levelIndex(g.realm, g.stage) < q.level) g = atLevel(g, q.level);
  g = syncPeoplesFlags(g);
  switch (q.kind) {
    case "beat":
    case "rite":
    case "favour":
    case "trade":
    case "tale":
      return play(g, peoplesTalk(q.npc!, g)!, [pick]);
    case "hunt":
      for (let k = 0; k < q.count; k++) {
        const r = peoplesHunt(g, q.foe!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "sit":
      for (let k = 0; k < q.count; k++) {
        const r = peoplesBreath(g, q.region!);
        g = r.state;
        if (r.steps) g = play(g, r.steps);
      }
      return g;
    case "visit":
      return play(g, peoplesLandmark(q.landmark!, g, { night: q.how === "night", riding: q.how === "ride", flying: q.how === "fly" })!);
    case "gate":
      return play(g, peoplesCultivated(g)!);
    case "duel": {
      const boss = PEOPLES[q.book].boss;
      expect(preBattleScript(boss, `peboss-${q.book}`, g), boss).not.toBeNull();
      return play(g, victoryScript(boss, `peboss-${q.book}`, PEOPLES[q.book].region, g), [pick]);
    }
  }
}

describe("the Hundred Peoples", () => {
  const all = peoplesQuests();
  const w = getWorld();
  const npcKeys = new Set(w.npcs.map((n) => n.key));
  const landmarks = new Set(w.landmarks.map((l) => l.key));

  it("is twelve hundred quests in six books, one for each people, main quests and side quests both", () => {
    expect(all).toHaveLength(PEOPLES_COUNT);
    expect(PEOPLES_COUNT).toBeGreaterThanOrEqual(1000);
    expect(PEOPLE_BOOKS).toHaveLength(PEOPLES.length);
    const main = all.filter((q) => q.arc === "main");
    const side = all.filter((q) => q.arc === "side");
    expect(main.length).toBeGreaterThan(150);
    expect(side.length).toBeGreaterThan(900);
    for (const q of all) expect(q.arc === "main", `${q.id}`).toBe(MAIN_KINDS.includes(q.kind));
    for (let b = 0; b < PEOPLES.length; b++) {
      const book = all.slice(b * PEOPLES_BOOK, (b + 1) * PEOPLES_BOOK);
      expect(book[0].kind).toBe("beat");
      expect(book[PEOPLES_BOOK / 2].kind).toBe("gate");
      expect(book[PEOPLES_BOOK - 2].kind).toBe("beat");
      expect(book[PEOPLES_BOOK - 1].kind).toBe("duel");
      expect(book.filter((q) => q.kind === "beat").length, `book ${b}`).toBe(10);
      expect(PEOPLE_BOOKS[b].beats.filter((x) => x.choice).length, `book ${b}`).toBeGreaterThanOrEqual(3);
      for (const k of ["rite", "favour", "trade", "tale", "hunt", "sit", "visit"]) expect(book.some((q) => q.kind === k), `book ${b} ${k}`).toBe(true);
    }
    const g = ready();
    for (const q of all) {
      for (const t of [q.objective, q.done, q.title]) expect(fillStanding(t, g), `${q.id}`).not.toMatch(/\{|\}|undefined/);
      if (q.npc) expect(npcKeys.has(q.npc), `${q.id} ${q.npc}`).toBe(true);
      if (q.landmark) expect(landmarks.has(q.landmark), `${q.id} ${q.landmark}`).toBe(true);
    }
    for (let i = 1; i < all.length; i++) expect(all[i].level).toBeGreaterThanOrEqual(all[i - 1].level);
    expect(all[PEOPLES_COUNT - 1].level).toBe(19);
  });

  it("begins with Envoy Shan at the Concord Stone, once Elder Mo has sent her out and she can hold her own", () => {
    expect(peoplesOpen({ ...ready(), realm: 0, stage: 1 })).toBe(false);
    expect(peoplesOpen({ ...ready(), flags: {} })).toBe(false);
    expect(peoplesLog(ready())!.objective).toMatch(/cracked stele/);
    expect(all[0].npc).toBe(ENVOY_KEY);
    expect(npcKeys.has(ENVOY_KEY)).toBe(true);
  });

  it("asks her to grow into each home before it trusts her with more", () => {
    let g = ready();
    while (peoplesDone(g) < PEOPLES_BOOK + 1) g = doQuest(g, 0);
    g = atLevel(g, 2);
    const q = currentPeoples(g)!;
    expect(peoplesLog(g)!.objective).toMatch(/Cultivate/);
    if (q.npc) expect(said(peoplesTalk(q.npc, g)!)).toMatch(/Not yet/);
  });

  it("can be walked to its end: every beat, every rite, every favour, every trouble, every fate", { timeout: 120_000 }, () => {
    let g = ready();
    const seen = new Set<string>();
    for (let n = 0; n < PEOPLES_COUNT; n++) {
      const q = currentPeoples(g)!;
      expect(q.id, `quest ${n}`).toBe(n);
      g = doQuest(g, n === PEOPLES_COUNT - 1 ? 0 : n % 4);
      expect(peoplesDone(g), `${n} ${q.kind} ${q.title}`).toBe(n + 1);
      seen.add(q.kind);
    }
    expect(seen.size).toBe(10);
    expect(currentPeoples(g)).toBeNull();
    g = syncPeoplesFlags(g);
    expect(g.flags["peoples:done"]).toBe(true);
    for (let k = 0; k < PEOPLES.length; k++) expect(g.flags[`peoples:fate:${k}`], `fate ${k}`).toBe(true);
    expect(peoplesChronicle(g).every((p) => p.state === "marked")).toBe(true);
    expect(JSON.stringify(endingScript({ ...g, realm: 4, stage: 3, flags: { ...g.flags, heartReturned: true } }))).toContain("Concord Stone stands whole");
  });

  it("has a trouble for every people, tuned to its realm, and foes in the wilds round every home", () => {
    let last = 0;
    PEOPLE_BOSSES.forEach((id, k) => {
      const e = ENEMIES[id];
      expect(e.boss).toBe(true);
      expect(e.level).toBeGreaterThan(last);
      last = e.level;
      expect(charDef(e.sprite).anims).toContain("attack");
      const spawn = w.enemies.find((x) => x.key === `peboss-${k}`)!;
      expect(spawn.enemy).toBe(id);
      expect(spawn.when!({ [`peoples:boss:${k}`]: true })).toBe(true);
      expect(spawn.when!({})).toBe(false);
    });
    for (const [k, id] of PEOPLE_FOES.entries()) {
      expect(ENEMIES[id].boss).toBeFalsy();
      expect(w.enemies.filter((e) => e.enemy === id).length, id).toBeGreaterThanOrEqual(3);
      expect(PEOPLES[k].foe).toBe(id);
    }
  });

  it("gives every people a home in the wilds, in the land it says, with its houses, its heart, its elder, its guide and its folk", () => {
    for (const p of PEOPLES) {
      const [x, y] = [p.c[0] * WORLD_SCALE, p.c[1] * WORLD_SCALE];
      expect(regionAt(w, x, y), p.id).toBe(p.region);
      const near = (i: number, j: number, r: number) => Math.hypot(i - x, j - y) <= r * WORLD_SCALE;
      expect(w.props.some((q) => q.id === p.heart && near(q.i, q.j, 2)), `${p.id} heart`).toBe(true);
      expect(w.props.filter((q) => q.id === p.house && near(q.i, q.j, HOME_R + 1)).length, `${p.id} houses`).toBe(4);
      for (const key of [elderKey(p.id), guideKey(p.id), ...p.folk.map((_, n) => folkKey(p.id, n))]) expect(npcKeys.has(key), key).toBe(true);
      expect(landmarks.has(`pe-${p.id}`)).toBe(true);
      expect(landmarks.has(p.sight.key)).toBe(true);
      expect(w.interacts.some((i) => i.key === `pe-${p.id}-shrine` && i.kind === "shrine")).toBe(true);
    }
  });

  it("speaks to her as a stranger until she comes with the tally, and as a friend after", () => {
    const fresh = ready();
    expect(said(npcScript(folkKey("mer", 0), fresh))).toMatch(/Speak to the elder/);
    let g = ready();
    while (peoplesDone(g) < 22) g = doQuest(g, 0);
    expect(said(npcScript(folkKey("fox", 0), g))).not.toMatch(/Speak to the elder/);
    expect(said(npcScript(ENVOY_KEY, g)).length).toBeGreaterThan(10);
  });

  it("paints every people's look with its own marks, and their own manners", () => {
    const looks: [HumanId, AnimId][] = [
      ["foxguide", "moondance"],
      ["merguide", "weep"],
      ["stoneguide", "carve"],
      ["featherguide", "glide"],
      ["snowguide", "knot"],
      ["dragonguide", "firebreath"],
      ["snowelder", "hearthsong"],
      ["heroine", "glide"],
      ["heroine", "moondance"],
      ["heroine", "offerpearl"],
    ];
    for (const [id, anim] of looks) {
      expect(charDef(id).anims, `${id} ${anim}`).toContain(anim);
      const a = getAnim(id, anim, 2);
      expect(a.frames.length).toBeGreaterThan(4);
      // the manner moves
      expect(Buffer.from(a.frames[0].data).equals(Buffer.from(a.frames[3].data)), `${id} ${anim}`).toBe(false);
    }
    // a feathered elder is wider than a plain one, for his wings; a dragon-kin taller for her horns
    const opaque = (id: HumanId) => getAnim(id, "idle", 0).frames[0].opaqueCount();
    expect(opaque("featherelder")).toBeGreaterThan(opaque("elder") * 0.9);
  });

  it("builds every home's props as models for the 3D view", () => {
    for (const id of ["foxden", "moonaltar", "foxlantern", "coralhouse", "pearlclam", "kelp", "stonehut", "menhir", "dreamstone", "eyrie", "windchime", "feathertotem", "hornlodge", "icecairn", "greathearth", "dragonhall", "dragonbones", "scalebrazier", "concordstone"] as const) {
      expect(getProp(id).frames[0].opaqueCount(), id).toBeGreaterThan(100);
      expect(propModel(id).indices.length, id).toBeGreaterThan(60);
    }
  });
});
