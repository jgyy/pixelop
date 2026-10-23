import { z } from "zod";
import { AREA_IDS } from "../world/ids";
import { REGION_SIZE, toWorld, WORLD_H, WORLD_W } from "../world/layout";
import { addCultivation, breakthrough, statsFor, type Stats } from "./realms";

export const SKILL_IDS = ["strike", "palm", "lotus", "swords", "thunder"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/**
 * Serializable game state — this is exactly what gets saved server-side.
 * Version 3 stores the heroine's position in world tiles of the continuous
 * jianghu; version 2 saves (one map per region) are migrated on load.
 */
const SaveFields = z.object({
  version: z.union([z.literal(2), z.literal(3)]),
  name: z.string().min(1).max(24),
  realm: z.number().int().min(0).max(5),
  stage: z.number().int().min(0).max(3),
  cultivation: z.number().int().min(0),
  hp: z.number().int().min(0),
  qi: z.number().int().min(0),
  stones: z.number().int().min(0),
  pills: z.object({ heal: z.number().int().min(0).max(99), qi: z.number().int().min(0).max(99) }),
  area: z.enum(AREA_IDS),
  x: z.number().min(0).max(WORLD_W),
  y: z.number().min(0).max(WORLD_H),
  dir: z.number().int().min(0).max(15),
  skills: z.array(z.enum(SKILL_IDS)).max(SKILL_IDS.length),
  bossDefeated: z.boolean(),
  kills: z.number().int().min(0),
  playTime: z.number().min(0),
  flags: z.record(z.string(), z.boolean()),
  counters: z.record(z.string(), z.number().int()),
  /** One-shot pickups already taken (chests, herbs). */
  taken: z.array(z.string()).max(200),
});

export const GameStateSchema = SaveFields.transform((s) => {
  if (s.version === 3) return { ...s, version: 3 as const };
  const [x, y] = toWorld(s.area, Math.min(s.x, REGION_SIZE[s.area] - 0.5), Math.min(s.y, REGION_SIZE[s.area] - 0.5));
  return { ...s, version: 3 as const, x, y };
});

export type GameState = z.output<typeof GameStateSchema>;

/** Where a new cultivator wakes: the sect's training ground. */
const START = toWorld("sect", 15.5, 20.5);

export function newGame(name = "Lin Yue"): GameState {
  const s = statsFor(0, 0);
  return {
    version: 3,
    name,
    realm: 0,
    stage: 0,
    cultivation: 0,
    hp: s.maxHp,
    qi: s.maxQi,
    stones: 20,
    pills: { heal: 2, qi: 1 },
    area: "sect",
    x: START[0],
    y: START[1],
    dir: 8,
    skills: ["strike", "palm", "lotus"],
    bossDefeated: false,
    kills: 0,
    playTime: 0,
    flags: {},
    counters: {},
    taken: [],
  };
}

export const stats = (g: GameState): Stats => statsFor(g.realm, g.stage);

const clampVitals = (g: GameState): GameState => {
  const s = stats(g);
  return { ...g, hp: Math.max(0, Math.min(s.maxHp, Math.round(g.hp))), qi: Math.max(0, Math.min(s.maxQi, Math.round(g.qi))) };
};

/** Gain cultivation; a stage-up fully restores vitals as the new qi settles. */
export function gainCultivation(g: GameState, amount: number): { state: GameState; stagesGained: number } {
  const r = addCultivation(g, amount);
  let next: GameState = { ...g, realm: r.realm, stage: r.stage, cultivation: r.cultivation };
  if (r.stagesGained > 0) {
    const s = stats(next);
    next = { ...next, hp: s.maxHp, qi: s.maxQi };
  }
  return { state: clampVitals(next), stagesGained: r.stagesGained };
}

/** Survive the tribulation: next realm, full vitals, and Core Formation unlocks the thunder technique. */
export function applyBreakthrough(g: GameState): GameState {
  const p = breakthrough(g);
  if (p.realm === g.realm) return g;
  const s = statsFor(p.realm, p.stage);
  const skills = p.realm >= 2 && !g.skills.includes("thunder") ? [...g.skills, "thunder" as const] : g.skills;
  return { ...g, ...p, hp: s.maxHp, qi: s.maxQi, skills };
}

export function heal(g: GameState, hp: number, qi: number): GameState {
  return clampVitals({ ...g, hp: g.hp + hp, qi: g.qi + qi });
}

export const PILL_PRICE = 15;
export const PILL_EFFECT = { heal: 0.45, qi: 0.6 } as const;

export function buyPill(g: GameState, kind: "heal" | "qi"): GameState | null {
  if (g.stones < PILL_PRICE || g.pills[kind] >= 99) return null;
  return { ...g, stones: g.stones - PILL_PRICE, pills: { ...g.pills, [kind]: g.pills[kind] + 1 } };
}

/** Consume a pill outside of battle. */
export function consumePill(g: GameState, kind: "heal" | "qi"): GameState | null {
  if (g.pills[kind] <= 0) return null;
  const s = stats(g);
  const next = { ...g, pills: { ...g.pills, [kind]: g.pills[kind] - 1 } };
  return kind === "heal" ? heal(next, s.maxHp * PILL_EFFECT.heal, 0) : heal(next, 0, s.maxQi * PILL_EFFECT.qi);
}

export const learn = (g: GameState, skill: SkillId): GameState => (g.skills.includes(skill) ? g : { ...g, skills: [...g.skills, skill] });
export const setFlag = (g: GameState, flag: string, on = true): GameState => ({ ...g, flags: { ...g.flags, [flag]: on } });
export const bump = (g: GameState, counter: string, by = 1): GameState => ({ ...g, counters: { ...g.counters, [counter]: (g.counters[counter] ?? 0) + by } });
