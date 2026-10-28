import type { Stats } from "./realms";

/**
 * 大道感悟: the Great Daos of heaven and earth. The four Daos of the heart
 * (dao.ts) are what she chooses to be; these are what she comes to
 * understand about the world: how water yields and wins, how fire takes
 * and gives, how the void holds everything by holding nothing.
 *
 * She comprehends them by sitting at shrines where a Dao runs strong (the
 * lake's water, the peak's thunder, Frostveil's ice), by reading the
 * Founder's steles on the Founder's Road, and by answering the Road's
 * questions. Each Great Dao deepens through five stages, Entry to
 * Transcendence, and no realm can hold more of one than it can bear: a Qi
 * Condensation disciple can only glimpse the gate, while a Spirit Severing
 * cultivator can become the Dao.
 *
 * Every stage strengthens her a little in the Dao's own way, and once she
 * has reached Nascent Soul with enough understanding behind her, what she
 * comprehends unfolds round her as a Dao Domain (道域) that presses on any
 * foe who steps into it.
 *
 * Points live in counters `wu:<id>`, so any save can carry them.
 */
export const GREAT_DAO_IDS = ["water", "wood", "wind", "fire", "earth", "metal", "thunder", "ice", "lifedeath", "void"] as const;
export type GreatDaoId = (typeof GREAT_DAO_IDS)[number];

export interface GreatDaoInfo {
  id: GreatDaoId;
  name: string;
  hanzi: string;
  colour: string;
  /** What the Founder wrote of it, in one line. */
  verse: string;
  /** What it does for her, in one line (for the journal). */
  gift: string;
}

export const GREAT_DAOS: Record<GreatDaoId, GreatDaoInfo> = {
  water: { id: "water", name: "Dao of Water", hanzi: "水之道", colour: "#6ab8f0", verse: "Nothing is softer than water, and nothing wears down the hard so well.", gift: "A deeper dantian" },
  wood: { id: "wood", name: "Dao of Wood", hanzi: "木之道", colour: "#7ad07a", verse: "The bamboo bends to the storm, and is standing when the storm has gone.", gift: "A body that endures" },
  wind: { id: "wind", name: "Dao of Wind", hanzi: "风之道", colour: "#c8f0e8", verse: "The wind is seen only in what it moves. Be seen so.", gift: "A quicker step" },
  fire: { id: "fire", name: "Dao of Fire", hanzi: "火之道", colour: "#ff8a3a", verse: "Fire keeps nothing for itself. That is why it is never cold.", gift: "Fiercer strikes" },
  earth: { id: "earth", name: "Dao of Earth", hanzi: "土之道", colour: "#c8a060", verse: "The earth carries the mountain and the grave alike, and complains of neither.", gift: "A firmer guard" },
  metal: { id: "metal", name: "Dao of Metal", hanzi: "金之道", colour: "#d8e0f0", verse: "The edge is only the shape the metal agreed to keep.", gift: "Edge and guard" },
  thunder: { id: "thunder", name: "Dao of Thunder", hanzi: "雷之道", colour: "#b8a4ff", verse: "Heaven's anger lasts an instant. Its patience lasts forever.", gift: "Swift, striking qi" },
  ice: { id: "ice", name: "Dao of Ice", hanzi: "冰之道", colour: "#bfe8ff", verse: "Ice is water that has decided. Decide, and hold.", gift: "A cold, clear guard" },
  lifedeath: { id: "lifedeath", name: "Dao of Life and Death", hanzi: "生死之道", colour: "#f6a6c9", verse: "The lotus grows out of the mud of everything that died before it.", gift: "Vitality, and the strength to end it" },
  void: { id: "void", name: "Dao of the Void", hanzi: "虚空之道", colour: "#e8e0ff", verse: "The bowl is useful for the emptiness in it. So is the heart.", gift: "Room for qi, and stillness" },
};

/** The five stages of comprehending a Great Dao, by points. */
export const WU_TIERS = [
  { at: 3, name: "Entry", hanzi: "入门" },
  { at: 10, name: "Lesser Mastery", hanzi: "小成" },
  { at: 24, name: "Greater Mastery", hanzi: "大成" },
  { at: 45, name: "Perfection", hanzi: "圆满" },
  { at: 75, name: "Transcendence", hanzi: "化境" },
] as const;

interface Counted {
  counters: Record<string, number>;
}
type Cultivator = Counted & { realm: number };

export const wuKey = (id: GreatDaoId) => `wu:${id}`;
export const wuPoints = (g: Counted, id: GreatDaoId) => Math.max(0, g.counters[wuKey(id)] ?? 0);

/** How far she has comprehended a Great Dao: 0 not at all, 1 Entry … 5 Transcendence. */
export function wuTier(g: Counted, id: GreatDaoId): number {
  const p = wuPoints(g, id);
  return WU_TIERS.filter((t) => p >= t.at).length;
}

/** "Dao of Water · Lesser Mastery", or null before Entry. */
export function wuLabel(g: Counted, id: GreatDaoId): string | null {
  const t = wuTier(g, id);
  return t ? `${GREAT_DAOS[id].name} · ${WU_TIERS[t - 1].name}` : null;
}

/** The deepest stage a realm can hold: Qi Condensation only Entry, Spirit Severing (and beyond) Transcendence. */
export const wuCap = (realm: number) => Math.min(WU_TIERS.length, realm + 1);

/** The most points a realm can hold of one Great Dao: right up to the threshold of the stage beyond its cap. */
export function wuMax(realm: number): number {
  const cap = wuCap(realm);
  return cap >= WU_TIERS.length ? Infinity : WU_TIERS[cap].at - 1;
}

/**
 * Comprehend a little more of a Great Dao. What her realm cannot yet hold
 * is not lost to the world, only to her: the points stop at the gate of the
 * next stage until she breaks through. A Dao that is eaten, as the
 * Dao-Eater eats, goes in whole, whatever her realm.
 */
export function comprehend<G extends Cultivator>(g: G, id: GreatDaoId, by = 1, eaten = false): { state: G; tierUp: number | null; capped: boolean } {
  const before = wuPoints(g, id);
  // a Dao eaten rather than understood ignores what her realm can bear (that is the whole temptation of it)
  const max = eaten ? Infinity : wuMax(g.realm);
  // never take away what she already holds (a Dao she ate may sit above what her realm could reach)
  const after = Math.max(0, Math.max(Math.min(before, before + by), Math.min(max, before + by)));
  const state = { ...g, counters: { ...g.counters, [wuKey(id)]: after } };
  const t0 = wuTier(g, id);
  const t1 = wuTier(state, id);
  return { state, tierUp: t1 > t0 ? t1 : null, capped: before + by > max };
}

/** Every stage of every Great Dao she holds, added up. */
export const wuTotal = (g: Counted) => GREAT_DAO_IDS.reduce((n, id) => n + wuTier(g, id), 0);

/** The Great Dao she understands best (ties go to the one listed first), or null before any Entry. */
export function deepestWu(g: Counted): GreatDaoId | null {
  let best: GreatDaoId | null = null;
  for (const id of GREAT_DAO_IDS) if (wuTier(g, id) > 0 && (!best || wuPoints(g, id) > wuPoints(g, best))) best = id;
  return best;
}

/** Nascent Soul, and a dozen stages of the Great Daos behind her: what she understands unfolds round her as a domain. */
export const DOMAIN_REALM = 3;
export const DOMAIN_STAGES = 12;
export const domainOpen = (g: Cultivator) => g.realm >= DOMAIN_REALM && wuTotal(g) >= DOMAIN_STAGES;

/** How hard her Dao Domain presses on a foe as the battle opens (0 while it is closed). */
export function domainPress(g: Cultivator, boss: boolean): number {
  if (!domainOpen(g)) return 0;
  const extra = Math.min(0.1, (wuTotal(g) - DOMAIN_STAGES) * 0.01);
  return (boss ? 0.06 : 0.16) + extra;
}

/** Her stats as the Great Daos she comprehends strengthen them. */
export function wuStats(base: Stats, g: Counted): Stats {
  const s = { ...base };
  const t = (id: GreatDaoId) => wuTier(g, id);
  s.maxQi = Math.round(s.maxQi * (1 + 0.04 * t("water") + 0.02 * t("ice") + 0.03 * t("void")));
  s.maxHp = Math.round(s.maxHp * (1 + 0.04 * t("wood") + 0.03 * t("lifedeath")));
  s.atk = Math.round(s.atk * (1 + 0.03 * t("fire") + 0.02 * t("metal") + 0.02 * t("thunder") + 0.02 * t("lifedeath")));
  s.def = Math.round(s.def * (1 + 0.05 * t("earth") + 0.02 * t("metal") + 0.03 * t("ice")));
  s.spd += t("wind") + Math.floor(t("thunder") / 2) + Math.floor(t("void") / 2);
  return s;
}

/** The Great Dao that runs strongest at each land's shrines (sitting there long brings her nearer it). */
export const SHRINE_DAO: Record<string, GreatDaoId> = {
  sect: "wind",
  peak: "thunder",
  village: "earth",
  bamboo: "wood",
  lake: "water",
  valley: "lifedeath",
  marsh: "lifedeath",
  terraces: "earth",
  desert: "fire",
  harbor: "void",
  frost: "ice",
};

/** Breaths of stillness at a shrine for each step nearer its Dao. */
export const BREATHS_PER_WU = 30;

/** The Great Daos in the journal: each one's depth, and how far her realm lets her go. */
export function wuJournal(g: Cultivator) {
  return GREAT_DAO_IDS.map((id) => {
    const tier = wuTier(g, id);
    const next = WU_TIERS[tier];
    return {
      id,
      name: GREAT_DAOS[id].name,
      hanzi: GREAT_DAOS[id].hanzi,
      colour: GREAT_DAOS[id].colour,
      verse: GREAT_DAOS[id].verse,
      gift: GREAT_DAOS[id].gift,
      points: wuPoints(g, id),
      tier,
      stage: tier ? `${WU_TIERS[tier - 1].hanzi} ${WU_TIERS[tier - 1].name}` : "—",
      next: next ? next.at : null,
      capped: tier >= wuCap(g.realm) && tier < WU_TIERS.length,
    };
  });
}
