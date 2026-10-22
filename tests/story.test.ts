import { describe, expect, it } from "vitest";
import { newGame, type GameState } from "@/game/engine/state";
import { cultivationNeeded, FINAL_REALM } from "@/game/engine/realms";
import { AREA_IDS, getArea } from "@/game/world/areas";
import type { Step } from "@/game/story/script";
import { altarScript, areaUnlocked, arrivalScript, endingScript, FOXES_NEEDED, hasNews, introScript, lockReason, npcScript, preBattleScript, questLog, victoryScript } from "@/game/story/story";

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

  it("every NPC in every area has something to say", () => {
    const g = { ...newGame(), flags: { metElder: true } };
    for (const id of AREA_IDS) for (const n of getArea(id).npcs) expect(npcScript(n.key, g).length).toBeGreaterThan(0);
  });

  it("plays first-arrival scenes only once", () => {
    const g = newGame();
    const first = arrivalScript("village", g)!;
    expect(first.length).toBeGreaterThan(0);
    expect(arrivalScript("village", run(g, first))).toBeNull();
    expect(introScript().some((s) => "narrate" in s)).toBe(true);
  });
});
