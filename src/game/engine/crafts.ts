import type { Stats } from "./realms";
import type { GameState } from "./state";

/**
 * 百艺 The Hundred Arts: the professions of the jianghu.
 *
 * A cultivator does not only fight and sit. The jianghu lives on its crafts:
 * spirit fields to feed it, forges to arm it, cauldrons for its pills,
 * talismans, formations, tamed beasts, healers and cooks. Each art has a
 * master somewhere in the world (most of them in the six courts of the mortal
 * emperors, where the guilds keep their halls), and any of them will take Lin
 * Yue on as an apprentice.
 *
 * She may learn every art, but each is learned slowly: practice with its
 * master (once a day of the calendar) and the crafting quests of the
 * Thrones and the Crafts (story/courts.ts) raise her through six ranks, from
 * Apprentice to Grandmaster. Every rank gives her a little of what the art is
 * for (a forger's arm, a healer's breath, a formation master's footing), and
 * every practice gives something to carry away.
 *
 * Kept in the save's counters (`craft:<art>` for her skill, `craft:<art>:day`
 * for the last day she practised) and flags (`craft:<art>` once she is an
 * apprentice), so no new save version is needed.
 */

export const CRAFTS = ["farming", "refining", "alchemy", "talisman", "formation", "taming", "healing", "cuisine"] as const;
export type CraftId = (typeof CRAFTS)[number];

/** What practising an art leaves in her hands. */
export type CraftYield = { kind: "stones"; n: number } | { kind: "pill"; pill: "heal" | "qi"; n: number } | { kind: "rest" } | { kind: "insight"; k: number };

export interface CraftDef {
  id: CraftId;
  name: string;
  hanzi: string;
  /** What a practitioner is called. */
  title: string;
  /** What she does when she practises it (said in the toasts and the journal). */
  verb: string;
  /** The animation she practises it with. */
  anim: "plant" | "hammer" | "grind" | "inscribe" | "array" | "tame" | "pulse" | "knead";
  /** What each rank adds to her (fractions of a stat, or whole points of speed). */
  gift: Partial<Record<keyof Stats, number>>;
  yields: CraftYield;
  /** In a sentence, for the journal. */
  blurb: string;
}

export const CRAFT_DEFS: Record<CraftId, CraftDef> = {
  farming: { id: "farming", name: "Spirit Farming", hanzi: "灵植", title: "Spirit Farmer", verb: "tend the spirit fields", anim: "plant", gift: { maxHp: 0.02 }, yields: { kind: "stones", n: 12 }, blurb: "Spirit rice and qi-fed herbs. The art the whole jianghu eats from, and the first the courts tax." },
  refining: { id: "refining", name: "Artifact Refining", hanzi: "炼器", title: "Refiner", verb: "work the spirit forge", anim: "hammer", gift: { atk: 0.03 }, yields: { kind: "stones", n: 20 }, blurb: "Swords, bells and mirrors folded with qi. Every rank puts more of the forge into her strikes." },
  alchemy: { id: "alchemy", name: "Alchemy", hanzi: "炼丹", title: "Alchemist", verb: "tend the pill cauldron", anim: "grind", gift: { maxQi: 0.04 }, yields: { kind: "pill", pill: "heal", n: 1 }, blurb: "Pills out of herbs and fire. A good alchemist's qi runs deeper, and her satchel is never empty." },
  talisman: { id: "talisman", name: "Talisman Craft", hanzi: "符箓", title: "Talisman Master", verb: "brush talismans", anim: "inscribe", gift: { def: 0.04 }, yields: { kind: "pill", pill: "qi", n: 1 }, blurb: "Cinnabar on yellow paper, and a word of power in every stroke. Each rank wards her a little more." },
  formation: { id: "formation", name: "Formations", hanzi: "阵法", title: "Formation Master", verb: "lay out an array", anim: "array", gift: { def: 0.02, maxQi: 0.02 }, yields: { kind: "insight", k: 0.06 }, blurb: "Stones, flags and the lie of the land, set so qi runs where it should. It steadies her footing and her breath." },
  taming: { id: "taming", name: "Beast Taming", hanzi: "御兽", title: "Beast Tamer", verb: "work with the spirit beasts", anim: "tame", gift: { spd: 1 }, yields: { kind: "stones", n: 14 }, blurb: "Spirit beasts are not won by beating them. Each rank makes her a little quicker on her feet, as the beasts are." },
  healing: { id: "healing", name: "The Healer's Dao", hanzi: "医道", title: "Physician", verb: "take pulses and set needles", anim: "pulse", gift: { maxHp: 0.03 }, yields: { kind: "rest" }, blurb: "Needles, pulses and a quiet hand. A healer is hard to wear down, and leaves each lesson whole." },
  cuisine: { id: "cuisine", name: "Spirit Cuisine", hanzi: "灵膳", title: "Spirit Chef", verb: "cook with spirit ingredients", anim: "knead", gift: { maxHp: 0.01, maxQi: 0.01 }, yields: { kind: "rest" }, blurb: "Spirit rice, beast meat and a wok hot enough to temper qi. Every lesson ends with a meal." },
};

/** The ranks of an art, and the practice it takes to reach each. */
export const CRAFT_RANKS = ["Apprentice", "Journeyman", "Adept", "Expert", "Master", "Grandmaster"] as const;
export const CRAFT_XP = [0, 4, 12, 26, 48, 80];

/** Counters and flags in the save. */
export const craftKey = (id: CraftId) => `craft:${id}`;
export const craftDayKey = (id: CraftId) => `craft:${id}:day`;

export const isApprentice = (g: GameState, id: CraftId) => !!g.flags[craftKey(id)];
export const craftXp = (g: GameState, id: CraftId) => Math.max(0, g.counters[craftKey(id)] ?? 0);

/** Her rank in an art: 0 before she is apprenticed, then 1 (Apprentice) to 6 (Grandmaster). */
export function craftRank(g: GameState, id: CraftId): number {
  if (!isApprentice(g, id)) return 0;
  const xp = craftXp(g, id);
  let r = 0;
  for (let k = 0; k < CRAFT_XP.length; k++) if (xp >= CRAFT_XP[k]) r = k + 1;
  return r;
}

export const craftRankName = (rank: number) => (rank <= 0 ? "Unlearned" : CRAFT_RANKS[Math.min(rank, CRAFT_RANKS.length) - 1]);

/** Take her on as an apprentice of an art. */
export function apprentice(g: GameState, id: CraftId): GameState {
  if (isApprentice(g, id)) return g;
  return { ...g, flags: { ...g.flags, [craftKey(id)]: true }, counters: { ...g.counters, [craftKey(id)]: craftXp(g, id) } };
}

/** Practice an art (if she is its apprentice): her skill grows by `xp`. */
export function practise(g: GameState, id: CraftId, xp = 1): GameState {
  if (!isApprentice(g, id)) return g;
  return { ...g, counters: { ...g.counters, [craftKey(id)]: craftXp(g, id) + xp } };
}

/** Has she already practised this art today (the calendar's day)? */
export const practisedToday = (g: GameState, id: CraftId, day: number) => g.counters[craftDayKey(id)] === day;
export const markPractised = (g: GameState, id: CraftId, day: number): GameState => ({ ...g, counters: { ...g.counters, [craftDayKey(id)]: day } });

/** What her arts add to her stats. */
export function craftStats(s: Stats, g: GameState): Stats {
  const out = { ...s };
  for (const id of CRAFTS) {
    const r = craftRank(g, id);
    if (!r) continue;
    for (const [k, v] of Object.entries(CRAFT_DEFS[id].gift) as [keyof Stats, number][]) out[k] = k === "spd" ? out[k] + v * r : Math.round(out[k] * (1 + v * r));
  }
  return out;
}

/** The arts she knows, for the menu and the journal. */
export function craftSheet(g: GameState): { id: CraftId; name: string; hanzi: string; rank: string; xp: number; next: number | null; blurb: string }[] {
  return CRAFTS.filter((id) => isApprentice(g, id)).map((id) => {
    const r = craftRank(g, id);
    return { id, name: CRAFT_DEFS[id].name, hanzi: CRAFT_DEFS[id].hanzi, rank: craftRankName(r), xp: craftXp(g, id), next: r < CRAFT_XP.length ? CRAFT_XP[r] : null, blurb: CRAFT_DEFS[id].blurb };
  });
}
