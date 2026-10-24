import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { cultivationNeeded, FINAL_REALM } from "@/game/engine/realms";
import { AREA_IDS, getArea } from "@/game/world/areas";
import { getWorld } from "@/game/world/continent";
import { getInterior, INTERIOR_IDS } from "@/game/world/interiors";
import type { Step } from "@/game/story/script";
import { ATTIRE, currentAttire, giveAttire, nextAttire, ownedAttire } from "@/game/story/wardrobe";
import { altarScript, areaUnlocked, arrivalScript, endingScript, errand, FOXES_NEEDED, hasNews, introScript, lockReason, npcScript, preBattleScript, questLog, victoryScript } from "@/game/story/story";

/** Apply every state mutation in a script (what the game does as it plays it). */
const run = (g: GameState, steps: Step[]) => steps.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);

describe("story", () => {
  it("walks the whole main quest from prologue to ascension", () => {
    let g = newGame();
    expect(questLog(g).chapter).toBe("Prologue");
    expect(areaUnlocked("village", g)).toBe(false);

    g = run(g, npcScript("elder", g));
    expect(g.flags.metElder).toBe(true);
    expect(areaUnlocked("village", g)).toBe(true);
    expect(questLog(g).objective).toMatch(/Willow Creek/);

    g = run(g, victoryScript("fox", "village-fox", "village", g));
    expect(g.flags.villageSaved).toBe(true);
    g = run(g, npcScript("zhou", g));
    expect(g.flags.metZhou).toBe(true);
    expect(areaUnlocked("bamboo", g)).toBe(true);

    for (let i = 0; i < FOXES_NEEDED; i++) {
      expect(questLog(g).objective).toContain(`${i}/${FOXES_NEEDED}`);
      g = run(g, victoryScript("fox", `fox-${i}`, "bamboo", g));
    }
    expect(g.flags.foxesCleared).toBe(true);
    g = run(g, npcScript("huli", g));
    expect(g.flags.metHuli).toBe(true);
    expect(lockReason("lake", g)).toMatch(/Late/);
    g = { ...g, stage: 2 };
    expect(areaUnlocked("lake", g)).toBe(true);

    g = run(g, npcScript("wen", g));
    expect(g.flags.metWen).toBe(true);
    g = run(g, victoryScript("serpentKing", "serpent-king", "lake", g));
    g = run(g, npcScript("wen", g));
    expect(g.skills).toContain("swords");
    expect(lockReason("valley", g)).toMatch(/Foundation/);
    g = { ...g, realm: 1, stage: 0 };
    expect(areaUnlocked("valley", g)).toBe(true);
    expect(preBattleScript("patriarch", "patriarch")!.length).toBeGreaterThan(3);

    g = run(g, victoryScript("patriarch", "patriarch", "valley", g));
    expect(g.bossDefeated).toBe(true);
    expect(hasNews("elder", g)).toBe(true);
    g = run(g, npcScript("elder", g));
    expect(g.flags.heartReturned).toBe(true);
    expect(areaUnlocked("peak", g)).toBe(true);

    const ready = { ...g, realm: FINAL_REALM - 1, stage: 3, cultivation: cultivationNeeded(FINAL_REALM - 1, 3) };
    expect(altarScript(ready).some((s) => "meditate" in s)).toBe(true);
    g = run(ready, endingScript());
    expect(g.flags.ascended).toBe(true);
    expect(questLog(g).chapter).toBe("Fin");
  });

  it("every NPC in every area, the wilds and every building has something of their own to say", () => {
    const g = { ...newGame(), flags: { metElder: true } };
    const npcs = [...AREA_IDS.flatMap((id) => getArea(id).npcs), ...getWorld().npcs, ...INTERIOR_IDS.flatMap((id) => getInterior(id).npcs)];
    for (const n of npcs) {
      const script = npcScript(n.key, g);
      expect(script.length, n.key).toBeGreaterThan(0);
      // nobody falls through to the narrator's shrug
      expect(script.some((st) => "say" in st && st.say === "narrator" && st.text === "…"), n.key).toBe(false);
    }
  });

  it("the folk indoors give their gifts once, then fall back to small talk", () => {
    let g: GameState = { ...newGame(), flags: { metElder: true } };
    for (const [key, flag] of [
      ["shen", "shenLore"],
      ["lu", "luGift"],
      ["qiao", "qiaoTale"],
      ["ming", "mingBlessing"],
    ] as const) {
      expect(hasNews(key, g), key).toBe(true);
      const before = { ...g };
      g = run(g, npcScript(key, g));
      expect(g.flags[flag], key).toBe(true);
      expect(hasNews(key, g), key).toBe(false);
      expect(run(g, npcScript(key, g)).flags, key).toEqual(g.flags);
      expect(g.cultivation + g.stage * 1000 + g.pills.heal, key).toBeGreaterThan(before.cultivation + before.stage * 1000 + before.pills.heal);
    }
  });

  it("plays first-arrival scenes only once", () => {
    const g = newGame();
    const first = arrivalScript("village", g)!;
    expect(first.length).toBeGreaterThan(0);
    expect(arrivalScript("village", run(g, first))).toBeNull();
    expect(introScript().some((s) => "narrate" in s)).toBe(true);
  });

  it("side errands: the scholar's letter, the brothers' quarrel, Dawnfrost and Granny Hua's cloak each end in an outfit", () => {
    let g: GameState = { ...newGame(), flags: { metElder: true, villageSaved: true, metZhou: true, foxesCleared: true, metHuli: true, metWen: true, yunTeaching: true, huaTea: true } };
    expect(errand(g)).toBeNull();

    // the scholar's letter
    expect(hasNews("pei", g)).toBe(true);
    g = run(g, npcScript("pei", g));
    expect(errand(g)).toMatch(/Hu Li/);
    expect(hasNews("huli", g)).toBe(true);
    g = run(g, npcScript("huli", g));
    expect(g.flags.huliLetter).toBe(true);
    expect(errand(g)).toMatch(/Moon-Gazing Pavilion/);
    // she keeps her vigil at the pavilion, not in the grove
    const bambooHuli = getWorld().npcs.find((n) => n.key === "huli")!;
    const pavHuli = getWorld().npcs.find((n) => n.key === "huliPav")!;
    expect(bambooHuli.when!(g.flags)).toBe(false);
    expect(pavHuli.when!(g.flags)).toBe(true);
    g = run(g, npcScript("pei", g));
    expect(g.flags.peiAtRest).toBe(true);
    expect(currentAttire(g).id).toBe("foxfire");
    expect(bambooHuli.when!(g.flags)).toBe(true);
    expect(pavHuli.when!(g.flags)).toBe(false);

    // the brothers' quarrel
    g = run(g, npcScript("yun", g));
    expect(g.flags.yunTea).toBe(true);
    expect(hasNews("wen", g)).toBe(true);
    g = run(g, npcScript("wen", g));
    expect(g.flags.wenReply).toBe(true);
    g = run(g, npcScript("yun", g));
    expect(g.flags.brothersReconciled).toBe(true);
    expect(currentAttire(g).id).toBe("cloudsilk");

    // Granny Hua's cloak
    expect(hasNews("hua", g)).toBe(true);
    g = run(g, npcScript("hua", g));
    expect(currentAttire(g).id).toBe("wayfarer");

    // Dawnfrost: met the smith, then beat Xue
    g = run(g, npcScript("ou", g));
    expect(g.flags.ouMet).toBe(true);
    expect(errand(g)).toMatch(/Dawnfrost/);
    g = run(g, victoryScript("patriarch", "patriarch", "valley", g));
    expect(g.flags.dawnfrost).toBe(true);
    expect(hasNews("ou", g)).toBe(true);
    g = run(g, npcScript("ou", g));
    expect(g.flags.ouMail).toBe(true);
    expect(currentAttire(g).id).toBe("mail");
    expect(ownedAttire(g).map((a) => a.id)).toEqual(["jade", "wayfarer", "foxfire", "cloudsilk", "mail"]);
  });

  it("Smith Ou takes Dawnfrost at the first meeting if she already carries it", () => {
    let g: GameState = { ...newGame(), flags: { metElder: true, patriarchDefeated: true, dawnfrost: true } };
    g = run(g, npcScript("ou", g));
    expect(g.flags.ouMet && g.flags.ouMail).toBe(true);
    expect(currentAttire(g).id).toBe("mail");
  });

  it("Willow Creek holds its lantern festival once the Heart is home, dressing its folk and her", () => {
    let g: GameState = { ...newGame(), flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, patriarchDefeated: true, heartReturned: true } };
    const zhou = getWorld().npcs.find((n) => n.key === "zhou")!;
    expect(zhou.outfit!({})).toBeUndefined();
    expect(zhou.outfit!(g.flags)).toBe("festival");
    expect(errand(g)).toMatch(/festival/);
    const scene = arrivalScript("village", g)!;
    expect(scene).not.toBeNull();
    g = run(g, scene);
    expect(g.flags.festivalSeen).toBe(true);
    expect(currentAttire(g).id).toBe("festival");
    expect(arrivalScript("village", g)).toBeNull();
    // and heaven itself dresses her at the end
    g = run(g, endingScript());
    expect(currentAttire(g).id).toBe("celestial");
  });

  it("the wardrobe cycles through what she owns and falls back to her jade robes", () => {
    let g = newGame();
    expect(currentAttire(g).id).toBe("jade");
    expect(currentAttire(nextAttire(g)).id).toBe("jade");
    g = giveAttire(giveAttire(g, "wayfarer"), "festival");
    expect(currentAttire(g).id).toBe("festival");
    g = nextAttire(g);
    expect(currentAttire(g).id).toBe("jade");
    g = nextAttire(g);
    expect(currentAttire(g).id).toBe("wayfarer");
    // a counter pointing at something she doesn't own (or nothing at all) means her robes
    expect(currentAttire({ ...g, counters: { attire: ATTIRE.findIndex((a) => a.id === "celestial") } }).id).toBe("jade");
    expect(currentAttire({ ...g, counters: { attire: 99 } }).id).toBe("jade");
    expect(giveAttire(g, "nonsense")).toBe(g);
  });

  it("saves from before the wardrobe still get Dawnfrost home and heaven's raiment", () => {
    let g: GameState = { ...newGame(), flags: { metElder: true, patriarchDefeated: true, heartReturned: true, ascended: true } };
    expect(ownedAttire(g).map((a) => a.id)).toContain("celestial");
    g = run(g, npcScript("ou", g));
    expect(g.flags.ouMail).toBe(true);
  });
});
