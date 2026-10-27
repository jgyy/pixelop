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
  { id: "springblossom", name: "Spring Blossom Hanfu", hanzi: "春樱襦裙", from: "Lady Qingming, Warden of Spring" },
  { id: "summerlotus", name: "Summer Lotus Gauze", hanzi: "夏荷纱衣", from: "Lord Xiazhi, Warden of Summer" },
  { id: "autumnmaple", name: "Autumn Maple Robe", hanzi: "秋枫袍", from: "Grandmother Shuangjiang, Warden of Autumn" },
  { id: "wintersnow", name: "Snow-Fox Cloak", hanzi: "冬雪狐裘", from: "Old Dongzhi, Warden of Winter" },
  { id: "fourseasons", name: "Raiment of the Four Seasons", hanzi: "四季天衣", from: "Almanac Master Shi" },
  { id: "ranger", name: "Ranger's Leathers", hanzi: "游侠皮甲", from: "The folk of the roads (10 notices)" },
  { id: "nightheron", name: "Night Heron Silks", hanzi: "夜鹭衣", from: "The night watchmen (50 notices)" },
  { id: "scholar", name: "Candidate's Robes", hanzi: "书生袍", from: "The teahouse scholars (150 notices)" },
  { id: "moonrabbit", name: "Moon Rabbit Dress", hanzi: "玉兔裙", from: "The children of the jianghu (400 notices)" },
  { id: "empress", name: "Empress of the Jianghu", hanzi: "江湖女皇袍", from: "Every road in the jianghu (1000 notices)" },
  // where she began, and what the main quest's choices made of her
  { id: "homespun", name: "Willow Creek Homespun", hanzi: "柳溪布衣", from: "Granny Hua, who raised her" },
  { id: "acolyte", name: "Blood Moon Acolyte's Robes", hanzi: "血月道袍", from: "The Blood Moon Sect, which she fled" },
  { id: "xuerobe", name: "Xue Ming's Outer-Sect Robe", hanzi: "薛明旧袍", from: "Xue Ming, who came home" },
  { id: "lotusqueen", name: "Lotus Sovereign Gown", hanzi: "莲后衣", from: "The Jade Lotus Heart, rooted in the land" },
  { id: "bloodmoon", name: "Blood Moon Sovereign", hanzi: "血月之主", from: "The Jade Lotus Heart, devoured" },
  { id: "guardian", name: "Earth Immortal's Mantle", hanzi: "地仙氅", from: "The jianghu she would not leave" },
  { id: "teacher", name: "Village Teacher's Robe", hanzi: "村塾先生袍", from: "The children of Willow Creek" },
  { id: "foxform", name: "Nine-Tailed Form", hanzi: "九尾形", from: "Hu Li, her sworn sister" },
  { id: "dragonform", name: "Dragon-Blood Form", hanzi: "龙血形", from: "Old Long, the Dragon Vein" },
  // the War of the Iron Banner
  { id: "lamellar", name: "Northern Army Lamellar", hanzi: "北军鳞甲", from: "General Yue Wushuang (100 war quests)" },
  { id: "bannergeneral", name: "Banner General's Panoply", hanzi: "旗帅战袍", from: "The Northern Army (500 war quests)" },
  { id: "swordsaint", name: "Sword Saint's Robe", hanzi: "剑圣袍", from: "The war, won on the Dao of the Sword" },
  { id: "bodhisattva", name: "Robe of the Merciful", hanzi: "慈悲衣", from: "The war, won on the Dao of Compassion" },
  { id: "taijisage", name: "Taiji Sage's Robe", hanzi: "太极道袍", from: "The war, won on the Dao of Heaven's Balance" },
  { id: "asura", name: "Asura's Warplate", hanzi: "修罗甲", from: "The war, won on the Dao of Slaughter" },
];

/** How an outfit she does not yet own may be earned (shown, greyed, in the wardrobe). */
export const ATTIRE_HINT: Record<string, string> = {
  wayfarer: "Calm the foxes of the bamboo, then visit Granny Hua.",
  foxfire: "Carry a scholar's letter to the one he loved.",
  cloudsilk: "Make peace between two old brothers, one of the lake and one of the sky.",
  mail: "Bring a sword home to the Sword Tomb.",
  festival: "Bring the Jade Lotus Heart home in time for the festival.",
  celestial: "Ascend.",
  seafarer: "Run an errand for a sea captain's mother.",
  phoenix: "Settle the Scarlet Phoenix's trouble.",
  herbal: "Heal Hundred Herb Valley.",
  swordsea: "Catch the thief of ten thousand swords.",
  springblossom: "Wake the Warden of Spring.",
  summerlotus: "Wake the Warden of Summer.",
  autumnmaple: "Wake the Warden of Autumn.",
  wintersnow: "Wake the Warden of Winter.",
  fourseasons: "Turn the whole year with the Almanac Master.",
  ranger: "Fulfil 10 notices.",
  nightheron: "Fulfil 50 notices.",
  scholar: "Fulfil 150 notices.",
  moonrabbit: "Fulfil 400 notices.",
  empress: "Fulfil all 1000 notices.",
  homespun: "Begin as Granny Hua's foundling of Willow Creek.",
  acolyte: "Begin as a runaway of the Blood Moon Sect.",
  xuerobe: "Bring Patriarch Xue home without a fight.",
  lotusqueen: "Plant the Jade Lotus Heart in the land.",
  bloodmoon: "Drink the Jade Lotus Heart yourself.",
  guardian: "Turn back from heaven's stair.",
  teacher: "Go home to Willow Creek, at the very end.",
  lamellar: "Fulfil 100 quests of the War of the Iron Banner.",
  bannergeneral: "Fulfil 500 quests of the War of the Iron Banner.",
  swordsaint: "End the war walking the Dao of the Sword.",
  bodhisattva: "End the war walking the Dao of Compassion.",
  taijisage: "End the war walking the Dao of Heaven's Balance (or no Dao at all).",
  asura: "End the war walking the Dao of Slaughter.",
  foxform: "Lay a scholar's shade to rest, and end the Blood Moon. Hu Li has a secret.",
  dragonform: "Drink the Dragon Vein.",
};

export const attireFlag = (id: string) => `attire:${id}`;

/** Her jade robes are always hers; heaven's raiment is hers once she has ascended (a save from before it was woven, or from before the tale had other endings, keeps it; the stair itself weaves it now). */
export const hasAttire = (g: GameState, id: string) => id === "jade" || !!g.flags[attireFlag(id)] || (id === "celestial" && !!g.flags.ascended && !Object.keys(g.flags).some((k) => k.startsWith("ending:")));

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

/** Put on an outfit she owns (by id). */
export function wearAttire(g: GameState, id: string): GameState {
  const k = ATTIRE.findIndex((a) => a.id === id);
  if (k < 0 || !hasAttire(g, id)) return g;
  return { ...g, counters: { ...g.counters, attire: k } };
}

/** Change into the next outfit she owns. */
export function nextAttire(g: GameState): GameState {
  const owned = ownedAttire(g);
  const at = owned.findIndex((a) => a.id === currentAttire(g).id);
  const next = owned[(at + 1) % owned.length];
  return { ...g, counters: { ...g.counters, attire: ATTIRE.indexOf(next) } };
}
