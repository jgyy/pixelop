import type { Stats } from "./realms";

/**
 * The Dao she walks. Every hard choice of the war (and a few elsewhere)
 * leans her heart toward one of four Daos; whichever leads becomes her Dao,
 * and the deeper she walks it the more it shapes her: her qi and her body,
 * what the folk say of her, how the land heals behind her, and how the tale
 * ends.
 *
 * Points live in counters `dao:<id>`, so any save can carry them.
 */
export const DAO_IDS = ["sword", "mercy", "balance", "slaughter"] as const;
export type DaoId = (typeof DAO_IDS)[number];

export interface DaoInfo {
  id: DaoId;
  name: string;
  hanzi: string;
  colour: string;
  /** What walking it means, in one line. */
  creed: string;
  /** What it does for her, in one line (for the journal). */
  gift: string;
}

export const DAOS: Record<DaoId, DaoInfo> = {
  sword: { id: "sword", name: "Dao of the Sword", hanzi: "剑道", colour: "#c8d8ff", creed: "Cut what must be cut, and nothing more.", gift: "Sharper strikes" },
  mercy: { id: "mercy", name: "Dao of Compassion", hanzi: "慈道", colour: "#9ff5de", creed: "Every life weighs the same on heaven's scale.", gift: "A sturdier body" },
  balance: { id: "balance", name: "Dao of Heaven's Balance", hanzi: "天道", colour: "#f2c55c", creed: "Act without forcing; the river finds the sea.", gift: "A deeper dantian, a quicker step" },
  slaughter: { id: "slaughter", name: "Dao of Slaughter", hanzi: "杀道", colour: "#ff4a5a", creed: "Peace is what is left when the enemy is gone.", gift: "Terrible strength, at the cost of guard" },
};

/** How deep she walks her Dao, by its points. */
export const DAO_TIERS = [
  { at: 3, name: "Glimpse" },
  { at: 10, name: "Path" },
  { at: 25, name: "Heart" },
  { at: 50, name: "Embodiment" },
] as const;

interface Counted {
  counters: Record<string, number>;
}

export const daoPoints = (g: Counted, id: DaoId) => Math.max(0, g.counters[`dao:${id}`] ?? 0);

/** The Dao that leads her heart, or null while none does (too few points, or two pulling level). */
export function dominantDao(g: Counted): DaoId | null {
  const ranked = [...DAO_IDS].sort((a, b) => daoPoints(g, b) - daoPoints(g, a));
  const top = daoPoints(g, ranked[0]);
  return top >= DAO_TIERS[0].at && top > daoPoints(g, ranked[1]) ? ranked[0] : null;
}

/** How deep she walks her leading Dao: 0 none, 1 Glimpse … 4 Embodiment. */
export function daoTier(g: Counted): number {
  const d = dominantDao(g);
  if (!d) return 0;
  const p = daoPoints(g, d);
  return DAO_TIERS.filter((t) => p >= t.at).length;
}

/** "Dao of the Sword · Heart", or null when no Dao leads. */
export function daoLabel(g: Counted): string | null {
  const d = dominantDao(g);
  return d ? `${DAOS[d].name} · ${DAO_TIERS[daoTier(g) - 1].name}` : null;
}

/** Her stats as her Dao reshapes them. */
export function daoStats(base: Stats, g: Counted): Stats {
  const d = dominantDao(g);
  const t = daoTier(g);
  if (!d || !t) return base;
  const s = { ...base };
  switch (d) {
    case "sword":
      s.atk = Math.round(s.atk * (1 + 0.06 * t));
      s.spd += t;
      break;
    case "mercy":
      s.maxHp = Math.round(s.maxHp * (1 + 0.07 * t));
      s.def = Math.round(s.def * (1 + 0.05 * t));
      break;
    case "balance":
      s.maxQi = Math.round(s.maxQi * (1 + 0.09 * t));
      s.spd += t * 2;
      break;
    case "slaughter":
      s.atk = Math.round(s.atk * (1 + 0.1 * t));
      s.def = Math.round(s.def * (1 - 0.05 * t));
      break;
  }
  return s;
}

/** Lean her heart toward a Dao (her other Daos fade a little when she acts strongly against them). */
export function walkDao<G extends Counted>(g: G, id: DaoId, by = 1): G {
  const counters = { ...g.counters, [`dao:${id}`]: daoPoints(g, id) + by };
  // the sword and slaughter both kill; mercy is what slaughter wears away, and slaughter what mercy does
  const opposed: Partial<Record<DaoId, DaoId>> = { mercy: "slaughter", slaughter: "mercy" };
  const o = opposed[id];
  if (o && by > 0 && daoPoints(g, o) > 0) counters[`dao:${o}`] = Math.max(0, daoPoints(g, o) - 1);
  // and what she does feeds her heart demons or starves them (see cultivation.ts)
  const demon = id === "slaughter" ? 3 * by : id === "mercy" ? -2 * by : 0;
  if (demon) counters["cult:demon"] = Math.max(0, Math.min(100, (g.counters["cult:demon"] ?? 0) + demon));
  return { ...g, counters };
}
