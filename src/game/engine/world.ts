import type { SceneId } from "../scenes";
import type { SpriteId } from "../sprites";
import type { EnemyId } from "./enemies";
import { levelIndex, realmLabel } from "./realms";
import type { GameState, RegionId } from "./state";

export interface NpcPlacement {
  id: "elder" | "sister";
  sprite: SpriteId;
  x: number;
}

export interface EnemySpawn {
  enemy: EnemyId;
  x: number;
  /** Patrol half-width in world pixels. */
  range: number;
}

export interface Region {
  id: RegionId;
  scene: SceneId;
  name: string;
  width: number;
  /** Required level index (realm/stage) to enter. */
  minLevel: number;
  prev?: RegionId;
  next?: RegionId;
  npcs: NpcPlacement[];
  shrineX?: number;
  herbs: number[];
  enemies: EnemySpawn[];
}

export const REGIONS: Record<RegionId, Region> = {
  sect: {
    id: "sect",
    scene: "sect",
    name: "Azure Cloud Sect",
    width: 1200,
    minLevel: 0,
    next: "bamboo",
    npcs: [
      { id: "elder", sprite: "elder", x: 330 },
      { id: "sister", sprite: "sister", x: 520 },
    ],
    shrineX: 760,
    herbs: [980],
    enemies: [],
  },
  bamboo: {
    id: "bamboo",
    scene: "bamboo",
    name: "Whispering Bamboo Forest",
    width: 1800,
    minLevel: 0,
    prev: "sect",
    next: "lake",
    npcs: [],
    shrineX: 960,
    herbs: [400, 1250, 1600],
    enemies: [
      { enemy: "fox", x: 420, range: 50 },
      { enemy: "fox", x: 700, range: 70 },
      { enemy: "wolf", x: 1180, range: 60 },
      { enemy: "fox", x: 1450, range: 60 },
    ],
  },
  lake: {
    id: "lake",
    scene: "lake",
    name: "Moonlit Lotus Lake",
    width: 1900,
    minLevel: 2,
    prev: "bamboo",
    next: "demon",
    npcs: [],
    shrineX: 1000,
    herbs: [500, 1400],
    enemies: [
      { enemy: "wolf", x: 420, range: 60 },
      { enemy: "serpent", x: 720, range: 40 },
      { enemy: "serpent", x: 1300, range: 50 },
      { enemy: "wolf", x: 1600, range: 60 },
    ],
  },
  demon: {
    id: "demon",
    scene: "demon",
    name: "Crimson Demon Valley",
    width: 2000,
    minLevel: 4,
    prev: "lake",
    npcs: [],
    shrineX: 300,
    herbs: [900],
    enemies: [
      { enemy: "jiangshi", x: 600, range: 50 },
      { enemy: "serpent", x: 900, range: 40 },
      { enemy: "jiangshi", x: 1200, range: 60 },
      { enemy: "jiangshi", x: 1450, range: 40 },
      { enemy: "patriarch", x: 1820, range: 0 },
    ],
  },
};

export const GATE_MARGIN = 40;

/** Human-readable requirement for a gated region, or null if the heroine may pass. */
export function entryBlocker(g: GameState, target: RegionId): string | null {
  const r = REGIONS[target];
  if (levelIndex(g.realm, g.stage) >= r.minLevel) return null;
  // find the realm/stage label for the required level
  let realm = 0;
  let stage = r.minLevel;
  while (stage >= 4) {
    stage -= 4;
    realm++;
  }
  return `${r.name} is sealed. Reach ${realmLabel(realm, stage)} first.`;
}

export interface DialogueLine {
  speaker: string;
  text: string;
}

export function elderDialogue(g: GameState): DialogueLine[] {
  if (g.bossDefeated)
    return [
      { speaker: "Elder Mo", text: "The Jade Lotus Heart blooms again on our peak. You have done what the elders could not." },
      { speaker: "Elder Mo", text: "Keep cultivating, Lin Yue. Immortality waits beyond the final tribulation." },
    ];
  if (!g.flags.metElder)
    return [
      { speaker: "Elder Mo", text: "Lin Yue. Last night the Blood Moon Sect stole the Jade Lotus Heart from our sacred shrine." },
      { speaker: "Elder Mo", text: "Patriarch Xue hides in the Crimson Demon Valley, beyond the bamboo forest and the lotus lake." },
      { speaker: "Elder Mo", text: "Defeat demonic beasts and meditate at lotus shrines to grow your cultivation. Only a Foundation Establishment cultivator may enter the valley." },
      { speaker: "Lin Yue", text: "I will bring it back, Master. My sword will not rest until it does." },
    ];
  return [{ speaker: "Elder Mo", text: "When your qi overflows at the peak of a realm, meditate at a shrine and face heaven's tribulation." }];
}

export function sisterDialogue(): DialogueLine[] {
  return [{ speaker: "Senior Sister Qing", text: "Junior Sister! Fresh pills from the Alchemy Hall — fifteen spirit stones each. Don't tell the elders I gave you a discount." }];
}
