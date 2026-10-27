import { createRng } from "../pixel/rng";
import { ENEMIES, isWarFoe, type EnemyId } from "./enemies";
import { levelIndex } from "./realms";
import { gainCultivation, PILL_EFFECT, stats, type GameState, type SkillId } from "./state";
import { toWorld } from "../world/layout";
import { CULT, cultivationRate, shift, swallowPill } from "./cultivation";
import { dominantDao } from "./dao";

export type { SkillId } from "./state";

export interface Skill {
  id: SkillId;
  name: string;
  hanzi: string;
  qi: number;
  /** Damage multiplier per hit. */
  power: number;
  hits: number;
  /** Fraction of max HP restored. */
  heal?: number;
  /** Fraction of enemy DEF ignored. */
  pierce?: number;
  description: string;
  key: string;
}

export const SKILLS: Record<SkillId, Skill> = {
  strike: { id: "strike", name: "Azure Sword Strike", hanzi: "青锋", qi: 0, power: 1, hits: 1, description: "A clean jian slash. Costs no qi.", key: "1" },
  palm: { id: "palm", name: "Jade Lotus Palm", hanzi: "玉莲掌", qi: 10, power: 1.8, hits: 1, pierce: 0.5, description: "Palm strike of condensed qi; pierces half of DEF.", key: "2" },
  swords: { id: "swords", name: "Myriad Swords Return", hanzi: "万剑归宗", qi: 25, power: 0.85, hits: 3, description: "Summon three flying swords to strike in succession.", key: "3" },
  lotus: { id: "lotus", name: "Lotus Heart Sutra", hanzi: "莲心诀", qi: 15, power: 0, hits: 0, heal: 0.35, description: "Recite the sutra to restore 35% HP.", key: "4" },
  thunder: { id: "thunder", name: "Nine Heavens Thunder", hanzi: "九霄雷", qi: 40, power: 1.35, hits: 2, pierce: 0.3, description: "Call down twin bolts of tribulation lightning.", key: "5" },
};

export type BattleAction = { type: "skill"; skill: SkillId } | { type: "item"; item: "heal" | "qi" } | { type: "flee" };

export type BattleEvent =
  | { kind: "playerSkill"; skill: SkillId; hits: { damage: number; crit: boolean }[]; heal: number }
  | { kind: "item"; item: "heal" | "qi"; amount: number }
  | { kind: "enemyAttack"; move: string; special: boolean; damage: number; crit: boolean; drained: number }
  | { kind: "flee"; success: boolean }
  | { kind: "victory"; exp: number; stones: number; stagesGained: number; drop: "heal" | "qi" | null }
  | { kind: "defeat"; stonesLost: number }
  | { kind: "rejected"; reason: string };

export type BattlePhase = "active" | "won" | "lost" | "fled";

export interface BattleState {
  enemy: EnemyId;
  enemyHp: number;
  enemyMaxHp: number;
  turn: number;
  phase: BattlePhase;
  seed: number;
}

export function startBattle(enemy: EnemyId, seed: number, wounded = 0): BattleState {
  const e = ENEMIES[enemy];
  return { enemy, enemyHp: Math.max(1, Math.round(e.hp * (1 - wounded))), enemyMaxHp: e.hp, turn: 0, phase: "active", seed: seed >>> 0 };
}

/**
 * How much of a foe's strength the story has already taken before the first
 * blow: a Blood Moon runaway knows the old wound in her master's art, and
 * strikes it first, and one of Mo's own disciples shakes him with the founder's sutra.
 */
export function openingWound(enemy: EnemyId, g: GameState): number {
  if (enemy === "patriarch" && g.flags.xueWounded) return 0.4;
  // the founder's sutra, recited by one of Mo's own, shakes his demonic qi
  if (enemy === "patriarch" && g.flags.xueShaken) return 0.2;
  return realmAura(enemy, g);
}

/**
 * Cultivation tells in war: a soldier of the horde facing a cultivator far
 * above his strength falters before her aura (a captain only a little), and
 * the first blow lands on a man already half beaten.
 */
export function realmAura(enemy: EnemyId, g: GameState): number {
  if (!isWarFoe(enemy)) return 0;
  const e = ENEMIES[enemy];
  const gap = levelIndex(g.realm, g.stage) - e.level;
  if (e.boss) return gap >= 4 ? 0.15 : 0;
  return gap >= 8 ? 0.5 : gap >= 4 ? 0.3 : 0;
}

/** What the battle log says about the opening wound. */
export function woundLine(enemy: EnemyId, g: GameState): string | null {
  if (!openingWound(enemy, g)) return null;
  if (enemy === "patriarch") return "You strike the old wound in his art before he can raise his saber!";
  return ENEMIES[enemy].boss ? `Your cultivation presses down on ${ENEMIES[enemy].name} like a mountain; the first blow lands on a staggering foe.` : `The ${ENEMIES[enemy].name} falters before your aura — a cultivator far beyond him!`;
}

/** Damage after defence: diminishing returns rather than flat subtraction. */
export function mitigate(raw: number, def: number): number {
  return Math.max(1, Math.round(raw * (100 / (100 + def * 3))));
}

export interface TurnResult {
  game: GameState;
  battle: BattleState;
  events: BattleEvent[];
}

/**
 * Resolve one full round: the heroine acts, then (if it survives) the enemy.
 * Pure — the RNG seed lives in the battle state so replays are deterministic.
 */
export function resolveTurn(game: GameState, battle: BattleState, action: BattleAction): TurnResult {
  if (battle.phase !== "active") return { game, battle, events: [{ kind: "rejected", reason: "The battle is over." }] };
  const rng = createRng(battle.seed);
  const enemy = ENEMIES[battle.enemy];
  const ps = stats(game);
  const events: BattleEvent[] = [];
  let g = { ...game, pills: { ...game.pills } };
  const b = { ...battle, turn: battle.turn + 1 };
  const variance = () => 0.9 + rng() * 0.2;

  // --- heroine's action -----------------------------------------------------
  if (action.type === "skill") {
    const sk = SKILLS[action.skill];
    if (!g.skills.includes(sk.id)) return { game, battle, events: [{ kind: "rejected", reason: `You have not learned ${sk.name}.` }] };
    if (g.qi < sk.qi) return { game, battle, events: [{ kind: "rejected", reason: `Not enough qi for ${sk.name}.` }] };
    g.qi -= sk.qi;
    const hits: { damage: number; crit: boolean }[] = [];
    for (let i = 0; i < sk.hits; i++) {
      const crit = rng() < 0.12;
      const def = enemy.def * (1 - (sk.pierce ?? 0));
      const dmg = mitigate(ps.atk * sk.power * variance() * (crit ? 1.6 : 1), def);
      hits.push({ damage: dmg, crit });
      b.enemyHp = Math.max(0, b.enemyHp - dmg);
    }
    let healed = 0;
    if (sk.heal) {
      healed = Math.min(ps.maxHp - g.hp, Math.round(ps.maxHp * sk.heal));
      g.hp += healed;
    }
    events.push({ kind: "playerSkill", skill: sk.id, hits, heal: healed });
  } else if (action.type === "item") {
    if (g.pills[action.item] <= 0) return { game, battle, events: [{ kind: "rejected", reason: "No pills left." }] };
    // a pill swallowed at full strength would be wasted, and the turn with it
    if (action.item === "heal" ? g.hp >= ps.maxHp : g.qi >= ps.maxQi) return { game, battle, events: [{ kind: "rejected", reason: action.item === "heal" ? "Your vitality is already full." : "Your qi is already full." }] };
    g.pills[action.item]--;
    g = swallowPill(g);
    if (action.item === "heal") {
      const amt = Math.min(ps.maxHp - g.hp, Math.round(ps.maxHp * PILL_EFFECT.heal));
      g.hp += amt;
      events.push({ kind: "item", item: "heal", amount: amt });
    } else {
      const amt = Math.min(ps.maxQi - g.qi, Math.round(ps.maxQi * PILL_EFFECT.qi));
      g.qi += amt;
      events.push({ kind: "item", item: "qi", amount: amt });
    }
  } else {
    const chance = enemy.boss ? 0 : Math.min(0.9, 0.5 + (ps.spd - enemy.level * 2) * 0.03);
    const success = rng() < chance;
    events.push({ kind: "flee", success });
    if (success) {
      b.phase = "fled";
      b.seed = Math.floor(rng() * 2 ** 32);
      return { game: g, battle: b, events };
    }
  }

  // --- victory? -------------------------------------------------------------
  if (b.enemyHp <= 0) {
    b.phase = "won";
    const roll = rng();
    const drop = roll < 0.25 ? "heal" : roll < 0.4 ? "qi" : null;
    if (drop) g.pills[drop] = Math.min(99, g.pills[drop] + 1);
    g.stones += enemy.stones;
    g.kills += 1;
    if (enemy.id === "patriarch") g.bossDefeated = true;
    // a poisoned or cracked dantian keeps less of what the fight stirred up; a killing heart feeds its demons
    const exp = Math.max(1, Math.round(enemy.exp * cultivationRate(g)));
    if (dominantDao(g) === "slaughter" && !enemy.friendly) g = shift(g, CULT.demon, 2);
    const gained = gainCultivation(g, exp);
    g = gained.state;
    events.push({ kind: "victory", exp, stones: enemy.stones, stagesGained: gained.stagesGained, drop });
    b.seed = Math.floor(rng() * 2 ** 32);
    return { game: g, battle: b, events };
  }

  // --- enemy's response -------------------------------------------------------
  const special = b.turn % enemy.special.every === 0;
  const crit = rng() < 0.08;
  const power = special ? enemy.special.power : 1;
  const dmg = mitigate(enemy.atk * power * variance() * (crit ? 1.5 : 1), ps.def);
  g.hp = Math.max(0, g.hp - dmg);
  let drained = 0;
  if (special && enemy.special.drain) {
    drained = Math.round(dmg * enemy.special.drain);
    b.enemyHp = Math.min(b.enemyMaxHp, b.enemyHp + drained);
  }
  events.push({ kind: "enemyAttack", move: special ? enemy.special.name : enemy.basic, special, damage: dmg, crit, drained });

  if (g.hp <= 0) {
    b.phase = "lost";
    const lost = enemy.friendly ? 0 : Math.floor(g.stones * 0.1);
    g.stones -= lost;
    events.push({ kind: "defeat", stonesLost: lost });
  }
  b.seed = Math.floor(rng() * 2 ** 32);
  return { game: g, battle: b, events };
}

/** After a defeat the heroine wakes beside the sect shrine. */
export function reviveAtSect(g: GameState): GameState {
  const s = stats(g);
  const [x, y] = toWorld("sect", 7.5, 15.5);
  return { ...g, hp: Math.ceil(s.maxHp * 0.5), qi: Math.ceil(s.maxQi * 0.5), area: "sect", x, y, dir: 0 };
}
