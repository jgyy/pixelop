import { z } from "zod";
import { AREA_IDS as AREAS, OLD_AREA_IDS, type AreaId, type OldAreaId } from "../world/ids";
import { LEGACY_REGION_ORIGIN, TEMPLATE_SIZE, toWorld, WORLD_H, WORLD_SCALE, WORLD_W } from "../world/layout";
import { addCultivation, breakthrough, statsFor, type Stats } from "./realms";
import { daoStats } from "./dao";

export const SKILL_IDS = ["strike", "palm", "lotus", "swords", "thunder"] as const;
export type SkillId = (typeof SKILL_IDS)[number];

/**
 * Serializable game state — this is exactly what gets saved server-side.
 * Version 5 stores the heroine's position in world tiles of the continuous
 * jianghu. Older saves are migrated on load: version 4 positions are in the
 * world before it doubled (every tile is now WORLD_SCALE × WORLD_SCALE),
 * version 3 positions are in the smaller world that one grew out of, and
 * version 2 positions are local to one map per region.
 */
const SaveFields = z.object({
  version: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  name: z.string().min(1).max(24),
  realm: z.number().int().min(0).max(5),
  stage: z.number().int().min(0).max(3),
  cultivation: z.number().int().min(0),
  hp: z.number().int().min(0),
  qi: z.number().int().min(0),
  stones: z.number().int().min(0),
  pills: z.object({ heal: z.number().int().min(0).max(99), qi: z.number().int().min(0).max(99) }),
  area: z.enum(AREAS),
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

/** Region-local coordinates, clamped inside the region's layout. */
const local = (area: AreaId, x: number, y: number): [number, number] => {
  const n = TEMPLATE_SIZE[area];
  return toWorld(area, Math.max(0.5, Math.min(x, n - 0.5)), Math.max(0.5, Math.min(y, n - 0.5)));
};

/**
 * Move a version 3 position into the grown world: keep it relative to the
 * region it was in (or nearest to). The game snaps it to open ground if the
 * spot is no longer walkable.
 */
function fromLegacyWorld(x: number, y: number): { area: AreaId; x: number; y: number } {
  let best: OldAreaId = "sect";
  let bd = Infinity;
  for (const id of OLD_AREA_IDS) {
    const [ox, oy] = LEGACY_REGION_ORIGIN[id];
    const n = TEMPLATE_SIZE[id];
    const d = Math.hypot(Math.max(ox - x, 0, x - ox - n), Math.max(oy - y, 0, y - oy - n));
    if (d < bd) {
      bd = d;
      best = id;
    }
  }
  const [ox, oy] = LEGACY_REGION_ORIGIN[best];
  const [nx, ny] = local(best, x - ox, y - oy);
  return { area: best, x: nx, y: ny };
}

export const GameStateSchema = SaveFields.transform((s) => {
  if (s.version === 5) return { ...s, version: 5 as const };
  if (s.version === 4) return { ...s, version: 5 as const, x: Math.min(WORLD_W, s.x * WORLD_SCALE), y: Math.min(WORLD_H, s.y * WORLD_SCALE) };
  if (s.version === 3) return { ...s, version: 5 as const, ...fromLegacyWorld(s.x, s.y) };
  const [x, y] = local(s.area, s.x, s.y);
  return { ...s, version: 5 as const, x, y };
});

export type GameState = z.output<typeof GameStateSchema>;

/** Where a new cultivator wakes: the sect's training ground. */
const START = toWorld("sect", 15.5, 20.5);

export function newGame(name = "Lin Yue"): GameState {
  const s = statsFor(0, 0);
  return {
    version: 5,
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

/** Her stats: what her realm gives her, as the Dao she walks reshapes it. */
export const stats = (g: GameState): Stats => daoStats(statsFor(g.realm, g.stage), g);

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
  const s = stats({ ...g, ...p });
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

/** Whether a pill of that kind would do her any good right now (a full dantian has no room for one). */
export function pillUseful(g: GameState, kind: "heal" | "qi"): boolean {
  const s = stats(g);
  return kind === "heal" ? g.hp < s.maxHp : g.qi < s.maxQi;
}

/** Consume a pill outside of battle (none is wasted when she is already whole). */
export function consumePill(g: GameState, kind: "heal" | "qi"): GameState | null {
  if (g.pills[kind] <= 0 || !pillUseful(g, kind)) return null;
  const s = stats(g);
  const next = { ...g, pills: { ...g.pills, [kind]: g.pills[kind] - 1 } };
  return kind === "heal" ? heal(next, s.maxHp * PILL_EFFECT.heal, 0) : heal(next, 0, s.maxQi * PILL_EFFECT.qi);
}

export const learn = (g: GameState, skill: SkillId): GameState => (g.skills.includes(skill) ? g : { ...g, skills: [...g.skills, skill] });
export const setFlag = (g: GameState, flag: string, on = true): GameState => ({ ...g, flags: { ...g.flags, [flag]: on } });
export const bump = (g: GameState, counter: string, by = 1): GameState => ({ ...g, counters: { ...g.counters, [counter]: (g.counters[counter] ?? 0) + by } });
