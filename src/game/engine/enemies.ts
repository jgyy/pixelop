import type { SpriteId } from "../sprites";

export type EnemyId = "fox" | "wolf" | "serpent" | "jiangshi" | "patriarch";

export interface EnemyDef {
  id: EnemyId;
  name: string;
  sprite: SpriteId;
  level: number;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  stones: number;
  /** Signature move used every `specialEvery` turns. */
  special: { name: string; power: number; every: number; drain?: number; colour: string };
  basic: string;
  boss?: boolean;
  /** Ground offset when drawn (sprites have different padding). */
  footY: number;
}

export const ENEMIES: Record<EnemyId, EnemyDef> = {
  fox: {
    id: "fox",
    name: "Fox Spirit",
    sprite: "fox",
    level: 1,
    hp: 60,
    atk: 14,
    def: 3,
    exp: 18,
    stones: 5,
    basic: "Fox Claw",
    special: { name: "Azure Foxfire", power: 1.6, every: 3, colour: "#7fd8ff" },
    footY: 36,
  },
  wolf: {
    id: "wolf",
    name: "Demon Wolf",
    sprite: "wolf",
    level: 3,
    hp: 110,
    atk: 21,
    def: 6,
    exp: 34,
    stones: 9,
    basic: "Rending Bite",
    special: { name: "Shadowflame Fang", power: 1.7, every: 3, colour: "#a46cff" },
    footY: 38,
  },
  serpent: {
    id: "serpent",
    name: "Lake Serpent",
    sprite: "serpent",
    level: 6,
    hp: 200,
    atk: 30,
    def: 10,
    exp: 70,
    stones: 16,
    basic: "Tail Lash",
    special: { name: "Jade Venom Coil", power: 1.6, every: 3, drain: 0.3, colour: "#3fd0a0" },
    footY: 44,
  },
  jiangshi: {
    id: "jiangshi",
    name: "Jiangshi",
    sprite: "jiangshi",
    level: 8,
    hp: 260,
    atk: 38,
    def: 15,
    exp: 100,
    stones: 22,
    basic: "Corpse Claw",
    special: { name: "Yin Corpse Qi", power: 1.7, every: 3, colour: "#8aff9a" },
    footY: 49,
  },
  patriarch: {
    id: "patriarch",
    name: "Patriarch Xue",
    sprite: "patriarch",
    level: 14,
    hp: 1200,
    atk: 70,
    def: 30,
    exp: 1500,
    stones: 300,
    basic: "Blood Saber",
    special: { name: "Blood Moon Slash", power: 1.8, every: 3, drain: 0.5, colour: "#ff2040" },
    boss: true,
    footY: 47,
  },
};
