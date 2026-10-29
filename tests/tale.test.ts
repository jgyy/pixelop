import { describe, expect, it } from "vitest";
import { charDef, getAnim } from "@/game/art/characters";
import { pointerAside, realmAside, conditionAside } from "@/game/story/cultivation";
import { newGameAs, originElderMeeting } from "@/game/story/origins";
import { setFlag, type GameState } from "@/game/engine/state";
import { CULT, shift } from "@/game/engine/cultivation";

const at = (realm: number, ...flags: string[]): GameState => flags.reduce((g, f) => setFlag(g, f), { ...newGameAs("disciple"), realm, stage: 0 } as GameState);
const text = (steps: ReturnType<typeof realmAside>) => (steps ?? []).map((s) => ("text" in s ? s.text : "")).join(" ");

describe("Elder Mo as the tale leaves him", () => {
  it("praises each realm she reaches while all is well between them", () => {
    expect(text(realmAside("elder", at(2)))).toContain("golden core");
  });

  it("has no praise for her realm while the blood moon she drank stands between them (he has a duel for her)", () => {
    expect(realmAside("elder", at(3, "patriarchDefeated", "heart:devoured"))).toBeNull();
    expect(pointerAside("elder", at(3, "patriarchDefeated", "heart:devoured"))).toBeNull();
    // once he has drawn the Heart back out of her, he is her teacher again
    expect(realmAside("elder", at(3, "patriarchDefeated", "heart:devoured", "purged", "heartReturned"))).not.toBeNull();
  });

  it("cannot feel her cultivation once she has broken his", () => {
    const line = text(realmAside("elder", at(4, "patriarchDefeated", "heart:devoured", "moBroken")));
    expect(line).not.toContain("I felt");
    expect(line).toMatch(/sever/i);
    const g = shift(at(3, "patriarchDefeated", "heart:devoured", "moBroken"), CULT.insight, 0);
    expect(pointerAside("elder", g)).toBeNull();
  });

  it("does not thank her for coming down from a heaven she turned back from", () => {
    expect(text(realmAside("elder", at(5, "ascended", "ending:ascension")))).toContain("came back down");
    expect(text(realmAside("elder", at(5, "ascended", "ending:guardian")))).toContain("turned round");
    expect(text(realmAside("elder", at(5, "ascended", "ending:mortal")))).toContain("turned round");
  });

  it("keeps his worries to himself on the eve of the duel", () => {
    const g = shift(at(2, "patriarchDefeated", "heart:devoured"), CULT.tox, 60);
    expect(conditionAside("elder", g)).toBeNull();
  });
});

describe("the foundling at the Hall of Clouds", () => {
  const gifts = [] as const;
  const said = (g: GameState) =>
    (originElderMeeting(g, [...gifts]) ?? [])
      .map((s) => ("text" in s ? s.text : ""))
      .join(" ");

  it("is known by the fox blood on her sleeve once she has driven the fox off", () => {
    expect(said(setFlag(newGameAs("foundling"), "villageSaved"))).toContain("fox blood");
  });

  it("is not, if she ran up the bridge before facing it", () => {
    const line = said(newGameAs("foundling"));
    expect(line).not.toContain("fox blood");
    expect(line).not.toContain("You have already met the first of them");
    expect(line).toContain("howls at your bridge");
  });
});

describe("new moves", () => {
  it("paints the heroine's rummage, shade and beckon in every direction", () => {
    for (const anim of ["rummage", "shade", "beckon"] as const) {
      expect(charDef("heroine").anims).toContain(anim);
      for (const dir of [0, 4, 8, 12]) expect(getAnim("heroine", anim, dir).frames.length).toBeGreaterThan(5);
    }
  });

  it("lets anyone who can wave beckon her over", () => {
    for (const id of ["hua", "zhou", "farmer", "qing"] as const) expect(charDef(id).anims).toContain("beckon");
  });
});
