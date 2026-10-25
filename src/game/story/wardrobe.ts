import type { GameState } from "../engine/state";

/**
 * Lin Yue's wardrobe. Each outfit is earned from someone she helps along the
 * way; the unlocks are story flags (`attire:<id>`) and the one she wears is
 * the `attire` counter, so wardrobes ride along in any save without a schema
 * change. Her jade robes are always to hand.
 */
export interface Attire {
  id: string;
  name: string;
  hanzi: string;
  /** Who gave it to her (shown when it is unlocked). */
  from: string;
}

export const ATTIRE: Attire[] = [
  { id: "jade", name: "Jade Lotus Robes", hanzi: "玉莲袍", from: "The Azure Cloud Sect" },
  { id: "wayfarer", name: "Wayfarer's Cloak", hanzi: "行者斗篷", from: "Granny Hua" },
  { id: "foxfire", name: "Foxfire Dress", hanzi: "狐火裙", from: "Hu Li" },
  { id: "cloudsilk", name: "Cloud-Silk Robes", hanzi: "云锦袍", from: "Master Yun and Old Fisher Wen" },
  { id: "mail", name: "Sword-Tomb Mail", hanzi: "剑冢甲", from: "Smith Ou" },
  { id: "festival", name: "Lantern Festival Dress", hanzi: "灯节裙", from: "Little Mei" },
  { id: "celestial", name: "Celestial Raiment", hanzi: "天衣", from: "Heaven itself" },
  // new outfits go on the end, so the attire counter in older saves still points at the same one
  { id: "seafarer", name: "Sea-Swallow Coat", hanzi: "海燕衣", from: "Captain Hai" },
  { id: "phoenix", name: "Phoenix Plumage", hanzi: "凤羽衣", from: "Yan Huo of the Scarlet Phoenix" },
  { id: "herbal", name: "Hundred Herb Robe", hanzi: "百草袍", from: "Bai Zhi of Hundred Herb Valley" },
  { id: "swordsea", name: "Sword Sea Blues", hanzi: "剑海衫", from: "Ling Feng of the Sword Sea" },
];

export const attireFlag = (id: string) => `attire:${id}`;

/** Her jade robes are always hers; heaven's raiment is hers once she has ascended (even in a save from before it was woven). */
export const hasAttire = (g: GameState, id: string) => id === "jade" || !!g.flags[attireFlag(id)] || (id === "celestial" && !!g.flags.ascended);

export const ownedAttire = (g: GameState): Attire[] => ATTIRE.filter((a) => hasAttire(g, a.id));

/** The outfit she has on (back to her jade robes if the counter points anywhere odd). */
export function currentAttire(g: GameState): Attire {
  const a = ATTIRE[g.counters.attire ?? 0];
  return a && hasAttire(g, a.id) ? a : ATTIRE[0];
}

/** Unlock an outfit and put it straight on. */
export function giveAttire(g: GameState, id: string): GameState {
  const k = ATTIRE.findIndex((a) => a.id === id);
  if (k < 0) return g;
  return { ...g, flags: { ...g.flags, [attireFlag(id)]: true }, counters: { ...g.counters, attire: k } };
}

/** Change into the next outfit she owns. */
export function nextAttire(g: GameState): GameState {
  const owned = ownedAttire(g);
  const at = owned.findIndex((a) => a.id === currentAttire(g).id);
  const next = owned[(at + 1) % owned.length];
  return { ...g, counters: { ...g.counters, attire: ATTIRE.indexOf(next) } };
}
