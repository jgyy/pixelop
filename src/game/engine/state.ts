import { z } from "zod";
import { addCultivation, breakthrough, statsFor, type Stats } from "./realms";

export const REGION_IDS = ["sect", "bamboo", "lake", "demon"] as const;
export type RegionId = (typeof REGION_IDS)[number];

/** Serializable game state — this is exactly what gets saved server-side. */
export const GameStateSchema = z.object({
  version: z.literal(1),
  name: z.string().min(1).max(24),
  realm: z.number().int().min(0).max(5),
  stage: z.number().int().min(0).max(3),
  cultivation: z.number().int().min(0),
  hp: z.number().int().min(0),
  qi: z.number().int().min(0),
  stones: z.number().int().min(0),
  pills: z.object({ heal: z.number().int().min(0).max(99), qi: z.number().int().min(0).max(99) }),
  region: z.enum(REGION_IDS),
  x: z.number().min(0).max(10_000),
  bossDefeated: z.boolean(),
  kills: z.number().int().min(0),
  playTime: z.number().min(0),
  flags: z.record(z.string(), z.boolean()),
});

export type GameState = z.infer<typeof GameStateSchema>;

export function newGame(name = "Lin Yue"): GameState {
  const s = statsFor(0, 0);
  return {
    version: 1,
    name,
    realm: 0,
    stage: 0,
    cultivation: 0,
    hp: s.maxHp,
    qi: s.maxQi,
    stones: 20,
    pills: { heal: 2, qi: 1 },
    region: "sect",
    x: 120,
    bossDefeated: false,
    kills: 0,
    playTime: 0,
    flags: {},
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

export function applyBreakthrough(g: GameState): GameState {
  const p = breakthrough(g);
  if (p.realm === g.realm) return g;
  const s = statsFor(p.realm, p.stage);
  return { ...g, ...p, hp: s.maxHp, qi: s.maxQi };
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
