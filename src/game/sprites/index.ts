import { buildHeroine } from "./heroine";
import { buildElder, buildPatriarch, buildSister } from "./npcs";
import { buildFox, buildJiangshi, buildSerpent, buildWolf } from "./enemies";
import { buildCrane, buildLantern, buildLotus, buildMoonGate, buildQiOrb, buildShrine, buildSpiritHerb, buildSpiritSword } from "./objects";
import type { SpriteSheet } from "./types";

export type { Animation, SpriteSheet } from "./types";
export { frameAt, animDuration } from "./types";

const BUILDERS = {
  heroine: buildHeroine,
  elder: buildElder,
  sister: buildSister,
  patriarch: buildPatriarch,
  fox: buildFox,
  wolf: buildWolf,
  jiangshi: buildJiangshi,
  serpent: buildSerpent,
  spiritSword: buildSpiritSword,
  shrine: buildShrine,
  moonGate: buildMoonGate,
  herb: buildSpiritHerb,
  lotus: buildLotus,
  lantern: buildLantern,
  crane: buildCrane,
  qiOrb: buildQiOrb,
} as const;

export type SpriteId = keyof typeof BUILDERS;
export const SPRITE_IDS = Object.keys(BUILDERS) as SpriteId[];

export const SPRITE_GROUPS: { label: string; ids: SpriteId[] }[] = [
  { label: "Heroine", ids: ["heroine", "spiritSword"] },
  { label: "Allies & Rivals", ids: ["elder", "sister", "patriarch"] },
  { label: "Demonic Beasts", ids: ["fox", "wolf", "jiangshi", "serpent"] },
  { label: "World Objects", ids: ["shrine", "moonGate", "herb", "lotus", "lantern", "crane", "qiOrb"] },
];

const cache = new Map<SpriteId, SpriteSheet>();

/** Lazily paint (and memoise) a sprite sheet. */
export function getSprite(id: SpriteId): SpriteSheet {
  let s = cache.get(id);
  if (!s) {
    s = BUILDERS[id]();
    cache.set(id, s);
  }
  return s;
}
