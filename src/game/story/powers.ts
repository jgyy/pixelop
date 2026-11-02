import { DAOS, dominantDao, daoTier } from "../engine/dao";
import { GREAT_DAOS, wuTier } from "../engine/comprehension";
import type { GameState } from "../engine/state";
import { POWERS, powerOf, SECRET_TIES, TIE_NAMES, TIE_WARMTH, tieKey, TIES, type Power, type Tie, type TieKind } from "../world/powers";

/**
 * How the powers of the world receive her, and what now lies between them.
 *
 * Her standing with a power is not a reputation meter that goes up with
 * errands. It is three things added together:
 *
 * - her Dao of the heart against its doctrine: a power that holds her Dao
 *   right warms to her as she walks it deeper, and one that holds it a
 *   crime cools in step;
 * - what she comprehends: every power honours one Great Dao above the
 *   others, and a cultivator who understands it deeply is listened to;
 * - what she has done for or against it (`pw:<key>`).
 *
 * The ties between the powers move too. Each has a face (what everyone
 * knows) and some have a truth underneath; once she uncovers a truth
 * (`tie:<a>~<b>:known`) the tie is what it really is, and what she does in
 * the Contention of the Daos can mend it or break it further
 * (`tie:<a>~<b>`, −3 … +3).
 */

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export const STANDINGS = [
  { at: -10, name: "Sworn Enemy", hanzi: "死敌" },
  { at: -6, name: "Hostile", hanzi: "敌视" },
  { at: -3, name: "Wary", hanzi: "戒备" },
  { at: -1, name: "Neutral", hanzi: "中立" },
  { at: 2, name: "Cordial", hanzi: "友善" },
  { at: 4, name: "Trusted", hanzi: "信任" },
  { at: 7, name: "Honoured", hanzi: "尊崇" },
] as const;

export const powerKey = (key: string) => `pw:${key}`;

/** What her Dao of the heart is worth to a power's doctrine. */
export function doctrineWeight(g: GameState, p: Power): number {
  const d = dominantDao(g);
  if (!d) return 0;
  const t = Math.min(3, daoTier(g));
  return d === p.heart ? t : d === p.abhors ? -t : 0;
}

/** What her comprehension of a power's patron Great Dao is worth to it. */
export const patronWeight = (g: GameState, p: Power) => {
  const t = wuTier(g, p.patron);
  return t >= 4 ? 2 : t >= 2 ? 1 : 0;
};

export const deedsWith = (g: GameState, key: string) => g.counters[powerKey(key)] ?? 0;

/** Her standing with a power, −10 … +10. */
export function standing(g: GameState, key: string): number {
  const p = powerOf(key);
  return clamp(deedsWith(g, key) + doctrineWeight(g, p) + patronWeight(g, p), -10, 10);
}

export function standingName(v: number): { name: string; hanzi: string } {
  let s: (typeof STANDINGS)[number] = STANDINGS[0];
  for (const x of STANDINGS) if (v >= x.at) s = x;
  return s;
}

/** Do something for (or against) a power. */
export function sway(g: GameState, key: string, by: number): GameState {
  return { ...g, counters: { ...g.counters, [powerKey(key)]: clamp(deedsWith(g, key) + by, -10, 10) } };
}

// ----------------------------------------------------------------------------- the ties
export const tieShiftKey = (t: Tie) => `tie:${tieKey(t)}`;
export const tieKnownFlag = (t: Tie) => `tie:${tieKey(t)}:known`;
export const tieKnown = (g: GameState, t: Tie) => !t.secret || !!g.flags[tieKnownFlag(t)];

/** What a tie is, as far as she knows it. */
export const tieKindNow = (g: GameState, t: Tie): TieKind => (t.secret && g.flags[tieKnownFlag(t)] ? t.secret.kind : t.kind);

/** How warm a tie runs now, −3 … +3: what it is, and what she has done to it. */
export function tieWarmth(g: GameState, t: Tie): number {
  return clamp(TIE_WARMTH[tieKindNow(g, t)] + (g.counters[tieShiftKey(t)] ?? 0), -3, 3);
}

/** Mend (or break) a tie. */
export function shiftTie(g: GameState, t: Tie, by: number): GameState {
  return { ...g, counters: { ...g.counters, [tieShiftKey(t)]: clamp((g.counters[tieShiftKey(t)] ?? 0) + by, -3, 3) } };
}

/** Bring a tie's truth to light. */
export const revealTie = (g: GameState, t: Tie): GameState => ({ ...g, flags: { ...g.flags, [tieKnownFlag(t)]: true } });

export const secretsKnown = (g: GameState) => SECRET_TIES.filter((t) => g.flags[tieKnownFlag(t)]).length;

/** How warm the whole web runs (the sum of every tie's warmth): the Great Council's mood. */
export const webWarmth = (g: GameState) => TIES.reduce((n, t) => n + tieWarmth(g, t), 0);

const WARMTH_WORDS = ["open war", "bitter", "cold", "uneasy", "civil", "warm", "close"];
export const warmthWord = (w: number) => WARMTH_WORDS[clamp(w + 3, 0, 6)];

/** The powers page of the journal and the menu: every power, how it receives her and why, and its ties as she knows them. */
export function powersSheet(g: GameState) {
  const d = dominantDao(g);
  return {
    secrets: { known: secretsKnown(g), total: SECRET_TIES.length },
    warmth: webWarmth(g),
    powers: POWERS.map((p) => {
      const v = standing(g, p.key);
      const s = standingName(v);
      return {
        key: p.key,
        name: p.name.replace(/^the /, "The "),
        hanzi: p.hanzi,
        kind: p.kind,
        colour: p.colour,
        leader: p.leader,
        seat: p.seat,
        doctrine: p.doctrine,
        holds: `${DAOS[p.heart].name} (${DAOS[p.heart].hanzi}) · abhors the ${DAOS[p.abhors].name} · honours the ${GREAT_DAOS[p.patron].name}`,
        standing: v,
        standingName: s.name,
        standingHanzi: s.hanzi,
        why: [
          d ? (d === p.heart ? `it holds your ${DAOS[d].name} right` : d === p.abhors ? `it holds your ${DAOS[d].name} a crime` : `it has no quarrel with your ${DAOS[d].name}`) : "your heart has not chosen a Dao",
          patronWeight(g, p) ? `you understand the ${GREAT_DAOS[p.patron].name}` : null,
          deedsWith(g, p.key) ? `${deedsWith(g, p.key) > 0 ? "you have done it good turns" : "you have crossed it"}` : null,
        ].filter((x): x is string => !!x),
        ties: TIES.filter((t) => t.a === p.key || t.b === p.key).map((t) => {
          const other = powerOf(t.a === p.key ? t.b : t.a);
          const known = tieKnown(g, t);
          const kind = tieKindNow(g, t);
          return { with: other.name.replace(/^the /, "The "), withKey: other.key, kind: TIE_NAMES[kind], warmth: tieWarmth(g, t), face: t.face, truth: known && t.secret ? t.secret.truth : null, hidden: !!t.secret && !known };
        }),
      };
    }),
  };
}
