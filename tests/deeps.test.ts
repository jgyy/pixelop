import { describe, expect, it } from "vitest";
import { charDef, getAnim } from "@/game/art/characters";
import { getProp, propDef, propSize } from "@/game/art/props";
import { ENEMIES } from "@/game/engine/enemies";
import { newGame, setFlag, type GameState } from "@/game/engine/state";
import { crowdNpcScript } from "@/game/story/crowd";
import { deepHasNews, deepJournal, deepNpcScript, deepSignScript, deepVictory } from "@/game/story/deeps";
import { newGameAs } from "@/game/story/origins";
import type { Step } from "@/game/story/script";
import { sectNpcScript } from "@/game/story/sects";
import { npcScript } from "@/game/story/story";
import { CAVE_IDS, getCave } from "@/game/world/caves";
import { getWorld } from "@/game/world/continent";
import { parseCrowdKey } from "@/game/world/crowds";

const withFlags = (g: GameState, ...flags: string[]) => flags.reduce((s, f) => setFlag(s, f), g);
const said = (steps: Step[] | null) => (steps ?? []).map((s) => ("text" in s ? s.text : "")).join(" ");

/** Run a script's state changes, taking the given answer at every question. */
function run(g: GameState, steps: Step[] | null, answer = 0): GameState {
  let s = g;
  for (const st of steps ?? []) {
    if ("mutate" in st) s = st.mutate(s);
    if ("choose" in st) s = run(s, st.choose[Math.min(answer, st.choose.length - 1)].then, answer);
  }
  return s;
}

function opaqueHeight(id: Parameters<typeof getProp>[0]): number {
  const b = getProp(id).frames[0];
  let y0 = b.height;
  let y1 = 0;
  for (let y = 0; y < b.height; y++)
    for (let x = 0; x < b.width; x++)
      if (b.data[(y * b.width + x) * 4 + 3]) {
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  return y1 - y0 + 1;
}

describe("trees of a real size", () => {
  it("stand several times as tall as a person, over the same one-tile trunk", () => {
    const hero = getAnim("heroine", "idle", 0).frames[0];
    let top = hero.height;
    let bottom = 0;
    for (let y = 0; y < hero.height; y++) for (let x = 0; x < hero.width; x++) if (hero.data[(y * hero.width + x) * 4 + 3]) [top, bottom] = [Math.min(top, y), Math.max(bottom, y)];
    const person = bottom - top + 1;
    for (const id of ["pine", "snowpine", "willow", "maple", "spirittree"] as const) {
      expect(propSize(id), id).toBeGreaterThan(1.9);
      expect(opaqueHeight(id), id).toBeGreaterThan(person * 3);
      expect(propDef(id).foot, id).toEqual([0, 0, 0, 0]);
    }
    // buildings keep the size they were built at
    expect(propSize("house")).toBe(1);
  });
});

describe("a busier jianghu", () => {
  const w = getWorld();
  const crowd = w.npcs.filter((n) => n.key.startsWith("crowd:"));

  it("gives nearly every person of the open world a neighbour of their own kind", () => {
    const folk = w.npcs.length - crowd.length;
    expect(crowd.length).toBeGreaterThan(folk * 0.95);
    for (const n of crowd) {
      expect(parseCrowdKey(n.key), n.key).not.toBeNull();
      expect(w.map.standable(n.i, n.j), n.key).toBe(true);
    }
  });

  it("runs the common beasts in pairs, and the birds and bats too", () => {
    const mates = w.enemies.filter((e) => e.key.endsWith("~2"));
    expect(mates.length).toBeGreaterThan(140);
    for (const e of mates) {
      const twin = w.enemies.find((o) => o.key === e.key.slice(0, -2))!;
      expect(twin.enemy).toBe(e.enemy);
      expect(Math.hypot(twin.i - e.i, twin.j - e.j)).toBeLessThan(12);
    }
    // the named foes, captains and sparring partners stay alone
    for (const e of w.enemies) if (ENEMIES[e.enemy].boss || ENEMIES[e.enemy].friendly) expect(e.key.endsWith("~2"), e.key).toBe(false);
    expect(w.enemies.some((e) => e.key === "village-fox~2")).toBe(false);
    expect(w.critters!.filter((c) => c.key.endsWith("~2")).length).toBe(w.critters!.length / 2);
  });

  it("keeps every key unique", () => {
    const keys = [...w.npcs, ...CAVE_IDS.flatMap((id) => getCave(id).npcs)].map((n) => n.key);
    expect(new Set(keys).size).toBe(keys.length);
    const foes = w.enemies.map((e) => e.key);
    expect(new Set(foes).size).toBe(foes.length);
  });

  it("lets every neighbour say something of their own, and talk of the war while it holds their land", () => {
    for (const n of crowd.slice(0, 60)) expect(said(npcScript(n.key, newGame())), n.key).not.toBe("…");
    const villager = crowd.find((n) => n.key.startsWith("crowd:village:villager"))!;
    const war = said(crowdNpcScript(villager.key, withFlags(newGame(), "war:village")));
    expect(war).toMatch(/scouts|plates|hold/);
  });
});

describe("the four new deeps", () => {
  it("opens the Bamboo Root Caverns only once the Blood Moon has set, and not if it rises for her", () => {
    const roots = getCave("bambooroots");
    expect(roots.opens!(newGame().flags)).toBe(false);
    expect(roots.opens!(withFlags(newGame(), "patriarchDefeated").flags)).toBe(true);
    expect(roots.opens!(withFlags(newGame(), "patriarchDefeated", "heart:devoured").flags)).toBe(false);
  });

  it("brings Brother Heng up out of the Icesoul Hollow", () => {
    let g = run(newGame(), deepNpcScript("mingjing", newGame()));
    expect(g.flags.iceAsk).toBe(true);
    expect(deepHasNews("heng", g)).toBe(true);
    g = run(g, deepNpcScript("heng", g));
    expect(g.flags.hengFound).toBe(true);
    expect(deepSignScript("icesoul-beads", g, "")).toBeNull();
    g = run(g, deepVictory("rimewyrm"));
    const stones = g.stones;
    g = run(g, deepSignScript("icesoul-beads", g, ""), 0);
    expect(g.flags["ice:returned"]).toBe(true);
    expect(deepHasNews("mingjing", g)).toBe(true);
    g = run(g, deepNpcScript("mingjing", g));
    expect(g.flags.iceDone).toBe(true);
    expect(g.stones).toBe(stones + 60);
    expect(deepJournal(g)[0].done).toBe(true);
  });

  it("asks for all three rubbings, and Scholar Ouyang remembers the queen's jade", () => {
    let g = run(newGame(), deepNpcScript("ouyang", newGame()));
    for (const n of [1, 2, 3]) g = run(g, deepSignScript(`tomb-stele-${n}`, g, "a stele"));
    expect(deepJournal(g)[0].objective).toMatch(/guardian/);
    g = run(g, deepVictory("dunewyrm"));
    const robbed = run(g, deepSignScript("tomb-coffin", g, ""), 0);
    expect(robbed.flags["tomb:robbed"]).toBe(true);
    expect(said(deepNpcScript("ouyang", robbed))).toMatch(/jade dust/);
    const honoured = run(g, deepSignScript("tomb-coffin", g, ""), 1);
    expect(honoured.flags["tomb:honoured"]).toBe(true);
    expect(getCave("sandtomb").interacts.find((x) => x.key === "tomb-gift")!.when!(honoured.flags)).toBe(true);
  });

  it("sends Little Shui home, with or without the pearl", () => {
    let g = run(newGame(), deepNpcScript("amu", newGame()));
    g = run(g, deepNpcScript("shui", g));
    g = run(g, deepVictory("pearlwyrm"));
    const kept = run(g, deepSignScript("tide-pearl-pool", g, ""), 1);
    expect(kept.flags["tide:kept"]).toBe(true);
    expect(kept.flags.shuiSaved).toBe(true);
    expect(kept.stones).toBe(g.stones + 150);
    const done = run(kept, deepNpcScript("amu", kept));
    expect(done.flags.tideDone).toBe(true);
    expect(said(deepNpcScript("amu", kept))).toMatch(/kept the pearl/);
  });

  it("lets her draw the Blood Moon out of its last fox, at the cost of her qi", () => {
    let g = withFlags(newGame(), "patriarchDefeated");
    g = run(g, deepNpcScript("aqiao", g));
    g = run(g, deepNpcScript("agou", g));
    g = run(g, deepVictory("shadowvixen"));
    g = run(g, deepSignScript("roots-den", g, ""), 0);
    expect(g.flags["vixen:purified"]).toBe(true);
    expect(g.qi).toBe(0);
    expect(g.flags.gouSaved).toBe(true);
    g = run(g, deepNpcScript("aqiao", g));
    expect(g.flags.vixenDone).toBe(true);
    expect(said(deepNpcScript("agou2", g))).toBeTruthy();
  });

  it("gives each deep's beasts and bosses a sprite and a place", () => {
    for (const id of ["frostfang", "rimewyrm", "dunewyrm", "pearlwyrm", "shadowvixen", "smuggler"] as const) {
      expect(ENEMIES[id].sprite).toBeTruthy();
      expect(getAnim(ENEMIES[id].sprite, "idle", 2).frames.length).toBeGreaterThan(0);
    }
    const all = CAVE_IDS.flatMap((id) => getCave(id).enemies.map((e) => e.enemy));
    for (const id of ["rimewyrm", "dunewyrm", "pearlwyrm", "shadowvixen"] as const) expect(all).toContain(id);
  });
});

describe("plot holes mended", () => {
  it("has the sect's disciples greet a Blood Moon runaway warily until Elder Mo has taken her in", () => {
    const runaway = newGameAs("defector");
    for (const key of ["feng", "lan", "abao"]) expect(said(npcScript(key, runaway)), key).not.toMatch(/Senior Sister/);
    expect(said(npcScript("feng", withFlags(runaway, "metElder", "patriarchDefeated")))).not.toMatch(/walked right past/);
  });

  it("has Herder Altan not take for granted that she rode in on Cloudmane", () => {
    expect(said(npcScript("herder", newGame()))).not.toMatch(/rider on the sky horse|saw yours/);
  });

  it("has Ling'er and Luo Huo keep up with what she has done", () => {
    expect(said(sectNpcScript("linger", withFlags(newGame(), "kuDealt", "kuSpared")))).not.toMatch(/Nobody will say why/);
    expect(said(sectNpcScript("phxluo", withFlags(newGame(), "minersOut")))).not.toMatch(/If anyone gets out/);
  });

  it("has Granny Hua speak to the foundling of her own grandfather", () => {
    const g = withFlags(newGameAs("foundling"), "huaTea");
    for (let t = 0; t < 30; t++) expect(said(npcScript("hua", { ...g, playTime: t * 7 }))).not.toMatch(/My husband was a sect disciple/);
  });
});

describe("new moves", () => {
  it("paints the nine new moves in every direction", () => {
    for (const anim of ["huddle", "chant", "rubbing", "castnet", "slingshot", "dig", "peer", "embrace", "holdup"] as const) {
      expect(charDef("heroine").anims).toContain(anim);
      for (const dir of [0, 4, 8, 12]) expect(getAnim("heroine", anim, dir).frames.length).toBeGreaterThan(5);
    }
    expect(charDef("boy").anims).toContain("huddle");
    expect(charDef("monk").anims).toContain("chant");
    expect(charDef("fishwife").anims).toContain("castnet");
  });

  it("paints the five new beasts and the four new props", () => {
    for (const id of ["frostfang", "rimewyrm", "dunewyrm", "pearlwyrm", "shadowvixen"] as const) expect(getAnim(id, "attack", 3).frames.length).toBeGreaterThan(3);
    for (const id of ["icecolumn", "sarcophagus", "tidepool", "rootcurtain"] as const) expect(getProp(id).frames[0].opaqueCount(), id).toBeGreaterThan(30);
  });
});
