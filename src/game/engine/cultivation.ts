import { atBottleneck, cultivationNeeded, FINAL_REALM, REALMS } from "./realms";
import { daoTier, dominantDao } from "./dao";
import type { Stats } from "./realms";

/**
 * The cultivator's body and heart. Filling the dantian is only half of
 * cultivation; the other half is what the filling does to her:
 *
 * - 丹毒 pill toxicity: every pill leaves a residue in the meridians. A
 *   poisoned dantian takes in less qi, and past a point the qi runs wild
 *   (a qi deviation) when she tries to sit with it. Meditation burns it off.
 * - 心魔 heart demons: what she has done and failed to do. Slaughter, failed
 *   tribulations and deviations feed them; prayer, meditation and the counsel
 *   of the wise starve them. Heaven's lightning finds every one.
 * - 根基 a cracked foundation: what a failed tribulation leaves behind. Qi
 *   leaks out through the cracks, and heaven will not test a cracked vessel
 *   until it has been mended in meditation.
 * - 悟 insight: from Foundation Establishment on, a full dantian is not
 *   enough to break through; she must understand what she is breaking
 *   into. Steles, the masters' pointers, new shrines and long sittings at the
 *   bottleneck bring it.
 *
 * Everything lives in counters `cult:*`, so any save can carry it.
 */
export const CULT = { tox: "cult:tox", demon: "cult:demon", wound: "cult:wound", insight: "cult:insight", fails: "cult:fails", deviations: "cult:deviations" } as const;

interface Counted {
  counters: Record<string, number>;
}

const read = (g: Counted, k: string) => Math.max(0, g.counters[k] ?? 0);
export const toxicity = (g: Counted) => read(g, CULT.tox);
export const heartDemons = (g: Counted) => read(g, CULT.demon);
export const foundationWound = (g: Counted) => read(g, CULT.wound);
export const insight = (g: Counted) => read(g, CULT.insight);
export const failedTribulations = (g: Counted) => read(g, CULT.fails);

/** Add to (or, with a negative amount, take from) one of her conditions; each stays within 0–100 (insight and tallies are uncapped). */
export function shift<G extends Counted>(g: G, key: string, by: number): G {
  const cap = key === CULT.tox || key === CULT.demon || key === CULT.wound ? 100 : Infinity;
  return { ...g, counters: { ...g.counters, [key]: Math.max(0, Math.min(cap, read(g, key) + Math.round(by))) } };
}

/** What one pill leaves behind in her meridians. */
export const PILL_TOXICITY = 14;
/** Past this much toxicity, sitting with her qi sets it running wild. */
export const DEVIATION_AT = 80;
/** Heart demons louder than this no longer quieten in meditation alone. */
export const DEMONS_LOUD = 40;

/** Insight she must hold to break through out of each realm (none to leave Qi Condensation). */
export const INSIGHT_NEEDED = [0, 2, 3, 4, 5] as const;
export const insightNeeded = (realm: number) => (realm >= FINAL_REALM ? 0 : INSIGHT_NEEDED[realm] ?? 0);

/** How much of the qi she draws in stays with her: poisons, cracks and demons all leak it away. */
export function cultivationRate(g: Counted): number {
  const tox = toxicity(g);
  const wound = foundationWound(g);
  const demon = heartDemons(g);
  const r = (1 - Math.min(0.6, tox / 150)) * (wound > 0 ? 0.5 : 1) * (1 - Math.min(0.3, demon / 300));
  return Math.max(0.2, r);
}

/** How rich the qi of each region's shrines is: the sect and the peak are steeped in it, the corrupted valley is thin and bitter. */
const DENSITY: Record<string, number> = { sect: 1.2, peak: 2.6, valley: 0.6, frost: 1.3, bamboo: 1.1, lake: 1.1, terraces: 1.05, desert: 0.8, marsh: 0.85, harbor: 0.9, village: 1 };
export const qiDensity = (area: string) => DENSITY[area] ?? 1;

/**
 * Qi gathered in one breath (a second) of meditation, `sitting` seconds into
 * the session. The longer she sits, the less each breath brings (the shrine's
 * qi thins around her); poison, cracks and demons take their share.
 */
export function breathGain(g: Counted & { realm: number; stage: number }, area: string, sitting: number): number {
  const need = cultivationNeeded(g.realm, g.stage);
  const thinning = Math.max(0.3, 1 - sitting / 90);
  return Math.max(3, Math.round((need / 36) * qiDensity(area) * thinning * cultivationRate(g)));
}

/** Why heaven will not yet test her (null when she may face the tribulation). */
export function tribulationBlock(g: Counted & { realm: number; stage: number; cultivation: number }): string | null {
  if (!atBottleneck(g)) return "Your qi has not yet reached its peak.";
  if (foundationWound(g) > 0) return `Your foundation is still cracked from the last tribulation (${foundationWound(g)}%). Meditate until it mends.`;
  const need = insightNeeded(g.realm);
  if (insight(g) < need) return `Your qi is full, but your understanding is not (insight ${insight(g)}/${need}). Read the old steles, seek the masters' pointers, sit at new shrines, or sit long at the bottleneck.`;
  return null;
}

/** Whether she could face the tribulation right now. */
export const readyForTribulation = (g: Counted & { realm: number; stage: number; cultivation: number }) => tribulationBlock(g) === null;

/**
 * How hard one of heaven's bolts strikes her, as a share of her vitality.
 * The ninefold final tribulation strikes more often but each bolt a little
 * less. Toxicity and heart demons draw the lightning; the Dao of Compassion
 * and of Heaven's Balance turn a little of it aside, and her body's guard
 * the rest.
 */
export function boltDamage(g: Counted & { realm: number }, s: Stats, final: boolean): number {
  const base = final ? 0.105 : 0.22 + 0.02 * g.realm;
  const demon = 1 + heartDemons(g) / 50;
  const tox = 1 + toxicity(g) / 100;
  const d = dominantDao(g);
  const shelter = d === "mercy" || d === "balance" ? 1 - 0.04 * daoTier(g) : d === "slaughter" ? 1 + 0.05 * daoTier(g) : 1;
  const guard = 1 - Math.min(0.15, s.def / 1000);
  return Math.max(1, Math.round(s.maxHp * base * demon * tox * shelter * guard));
}

/** What a failed tribulation does to her: her qi scatters, her foundation cracks, her demons feast. */
export function failTribulation<G extends Counted & { realm: number; stage: number; cultivation: number; hp: number; qi: number }>(g: G, s: Stats): G {
  const need = cultivationNeeded(g.realm, g.stage);
  let next = { ...g, cultivation: Math.round(need * 0.55), hp: Math.max(1, Math.round(s.maxHp * 0.1)), qi: 0 };
  next = shift(next, CULT.wound, 40);
  next = shift(next, CULT.demon, 12);
  next = shift(next, CULT.fails, 1);
  // what insight she had is shaken, though not lost entirely
  next = shift(next, CULT.insight, -1);
  return next;
}

/** What surviving does: heaven's fire burns the poison and the demons out of her, and the insight is spent. */
export function passTribulation<G extends Counted>(g: G): G {
  let next = shift(g, CULT.tox, -100);
  next = shift(next, CULT.demon, -heartDemons(g) * 0.6);
  return { ...next, counters: { ...next.counters, [CULT.insight]: 0 } };
}

/**
 * One breath of meditation tends her body: the poison burns off, the cracks
 * knit and the demons quieten. Returns whether her qi ran wild instead (a
 * deviation: she is hurt, the demons grow, and much of the poison is purged).
 */
export function tendBreath<G extends Counted & { hp: number }>(g: G, s: Stats): { state: G; deviation: boolean } {
  if (toxicity(g) >= DEVIATION_AT) {
    let next = { ...g, hp: Math.max(1, g.hp - Math.round(s.maxHp * 0.18)) };
    next = shift(next, CULT.tox, -30);
    next = shift(next, CULT.demon, 6);
    next = shift(next, CULT.deviations, 1);
    return { state: next, deviation: true };
  }
  let next = shift(g, CULT.tox, -3);
  next = shift(next, CULT.wound, -1);
  // a quiet heart settles in stillness; a heart that loud needs another voice (a monk, a master, an old friend)
  if (heartDemons(next) <= DEMONS_LOUD) next = shift(next, CULT.demon, -1);
  return { state: next, deviation: false };
}

/** Swallowing a pill: it works, and it leaves its mark. */
export const swallowPill = <G extends Counted>(g: G): G => shift(g, CULT.tox, PILL_TOXICITY);

/** One line on how she is, for the journal and the HUD (null when she is whole). */
export function conditionLabel(g: Counted & { realm: number; stage: number; cultivation: number }): string | null {
  const parts: string[] = [];
  if (foundationWound(g) > 0) parts.push(`Cracked foundation ${foundationWound(g)}%`);
  if (toxicity(g) >= 25) parts.push(toxicity(g) >= DEVIATION_AT ? "Pill poison: deviation near!" : `Pill poison ${toxicity(g)}`);
  if (heartDemons(g) >= 20) parts.push(`Heart demons ${heartDemons(g)}`);
  if (atBottleneck(g) && insight(g) < insightNeeded(g.realm)) parts.push(`Insight ${insight(g)}/${insightNeeded(g.realm)}`);
  return parts.length ? parts.join(" · ") : null;
}

/** Her cultivation's state in full, for the journal. */
export function conditionJournal(g: Counted & { realm: number; stage: number; cultivation: number }) {
  return {
    toxicity: toxicity(g),
    demons: heartDemons(g),
    wound: foundationWound(g),
    insight: insight(g),
    insightNeeded: insightNeeded(g.realm),
    fails: failedTribulations(g),
    rate: Math.round(cultivationRate(g) * 100),
    block: atBottleneck(g) ? tribulationBlock(g) : null,
    realmName: REALMS[g.realm]?.name ?? "",
  };
}
