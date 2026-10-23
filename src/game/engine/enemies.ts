import type { CharId } from "../art/characters";

export type EnemyId = "fox" | "wolf" | "serpent" | "serpentKing" | "cultist" | "jiangshi" | "bandit" | "swordsman" | "patriarch";

export interface EnemyDef {
  id: EnemyId;
  name: string;
  sprite: CharId;
  level: number;
  hp: number;
  atk: number;
  def: number;
  exp: number;
  stones: number;
  /** Signature move used every `every` turns. */
  special: { name: string; power: number; every: number; drain?: number; colour: string };
  basic: string;
  boss?: boolean;
  /** Opening line of the battle log (defaults to "A … bars your way!"). */
  intro?: string;
  /** Roaming speed on the map (tiles/s) and chase radius. */
  speed: number;
  aggro: number;
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
    speed: 1.6,
    aggro: 3,
  },
  wolf: {
    id: "wolf",
    name: "Shadowflame Wolf",
    sprite: "wolf",
    level: 3,
    hp: 110,
    atk: 21,
    def: 6,
    exp: 34,
    stones: 9,
    basic: "Rending Bite",
    special: { name: "Shadowflame Fang", power: 1.7, every: 3, colour: "#a46cff" },
    speed: 2,
    aggro: 3.5,
  },
  serpent: {
    id: "serpent",
    name: "Jade Serpent",
    sprite: "serpent",
    level: 5,
    hp: 180,
    atk: 28,
    def: 9,
    exp: 60,
    stones: 14,
    basic: "Tail Lash",
    special: { name: "Jade Venom Coil", power: 1.6, every: 3, drain: 0.3, colour: "#3fd0a0" },
    speed: 1.2,
    aggro: 2.5,
  },
  serpentKing: {
    id: "serpentKing",
    name: "Serpent King",
    sprite: "serpentKing",
    level: 7,
    hp: 260,
    atk: 22,
    def: 8,
    exp: 220,
    stones: 60,
    basic: "Crushing Coil",
    special: { name: "Moon Tide Breath", power: 1.8, every: 3, drain: 0.25, colour: "#7af0ff" },
    boss: true,
    speed: 0,
    aggro: 1.2,
  },
  cultist: {
    id: "cultist",
    name: "Blood Moon Cultist",
    sprite: "cultist",
    level: 8,
    hp: 240,
    atk: 40,
    def: 14,
    exp: 95,
    stones: 24,
    basic: "Blood Saber",
    special: { name: "Crimson Hex", power: 1.7, every: 3, drain: 0.2, colour: "#ff3050" },
    speed: 1.4,
    aggro: 3,
  },
  jiangshi: {
    id: "jiangshi",
    name: "Jiangshi",
    sprite: "jiangshi",
    level: 8,
    hp: 270,
    atk: 38,
    def: 16,
    exp: 100,
    stones: 22,
    basic: "Corpse Claw",
    special: { name: "Yin Corpse Qi", power: 1.7, every: 3, colour: "#8aff9a" },
    speed: 1.1,
    aggro: 2.5,
  },
  bandit: {
    id: "bandit",
    name: "Mountain Bandit",
    sprite: "bandit",
    level: 4,
    hp: 150,
    atk: 25,
    def: 7,
    exp: 48,
    stones: 30,
    basic: "Rusty Saber",
    special: { name: "Dirty Trick", power: 1.6, every: 3, colour: "#d8b060" },
    speed: 1.7,
    aggro: 3.2,
  },
  swordsman: {
    id: "swordsman",
    name: "Xiao Han",
    sprite: "swordsman",
    level: 6,
    hp: 320,
    atk: 30,
    def: 10,
    exp: 160,
    stones: 0,
    basic: "Drifting Cloud Cut",
    intro: "Xiao Han draws his blade with a grin. “Don't hold back!”",
    special: { name: "Lone Star Thrust", power: 1.9, every: 3, colour: "#ff6a8a" },
    speed: 0,
    aggro: 0,
  },
  patriarch: {
    id: "patriarch",
    name: "Patriarch Xue",
    sprite: "patriarch",
    level: 14,
    hp: 900,
    atk: 48,
    def: 20,
    exp: 1500,
    stones: 300,
    basic: "Blood Saber",
    special: { name: "Blood Moon Slash", power: 1.8, every: 3, drain: 0.5, colour: "#ff2040" },
    boss: true,
    speed: 0,
    aggro: 1.5,
  },
};
