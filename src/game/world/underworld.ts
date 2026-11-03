import type { PropId } from "../art/props";
import { CAVE_IDS, CAVE_MOUTH, type CaveId } from "./caves";
import { GUIXU } from "./immortals";

/**
 * The Underworld chart (地下): what lies under the jianghu, as the world
 * map's second layer. Every deep the heroine can go down into is marked
 * where its mouth opens in the world above, and the dragon veins (地脉), the
 * earth's own channels of qi, run between them: from the Dragon Vein under
 * the Dragonspine out to every other deep, and from all of them down to the
 * Nine Springs below the Ghost Gate, where every road ends. Under the sea
 * the chart shows only the black water of the abyss; under the ashen and
 * burning lands, the magma; under the snows, the old ice; and at the far
 * south-east, Guixu's throat, where the sea goes down and does not come up.
 *
 * Kept free of map-building code: the chart is drawn by runtime/worldmap.ts
 * from the miniature of the world above (world/overworld.ts).
 */

export interface Deep {
  id: CaveId;
  /** The mouth's place, on the authoring grid of the world above. */
  at: [number, number];
  /** What marks it on the chart. */
  icon: PropId;
  /** The glow its chamber gives off on the chart. */
  glow: string;
}

const LOOK: Record<CaveId, { icon: PropId; glow: string }> = {
  emberMine: { icon: "firejade", glow: "#ff7a2a" },
  grotto: { icon: "glowshroom", glow: "#7affc8" },
  vein: { icon: "veinheart", glow: "#ffd23a" },
  icesoul: { icon: "icecolumn", glow: "#bfe8ff" },
  sandtomb: { icon: "sarcophagus", glow: "#f2c55c" },
  tidecave: { icon: "tidepool", glow: "#5ad2ff" },
  bambooroots: { icon: "rootcurtain", glow: "#9aff6a" },
  underworld: { icon: "wisps", glow: "#c08aff" },
  drowned: { icon: "pearlclam", glow: "#8affff" },
};

export const DEEPS: Deep[] = CAVE_IDS.map((id) => ({ id, at: CAVE_MOUTH[id].at, ...LOOK[id] }));
export const deepOf = (id: CaveId): Deep => DEEPS.find((d) => d.id === id)!;

/**
 * The dragon veins between the deeps: the Dragon Vein's spirit vein runs out
 * to every deep of the old lands, and every deep drains, in the end, down to
 * the Nine Springs (and the Nine Springs to Guixu's throat).
 */
export const VEINS: [CaveId | "guixu", CaveId | "guixu"][] = [
  ["vein", "bambooroots"],
  ["vein", "grotto"],
  ["vein", "sandtomb"],
  ["sandtomb", "emberMine"],
  ["emberMine", "tidecave"],
  ["tidecave", "icesoul"],
  ["icesoul", "bambooroots"],
  ["grotto", "underworld"],
  ["sandtomb", "underworld"],
  ["emberMine", "drowned"],
  ["drowned", "underworld"],
  ["underworld", "guixu"],
  ["drowned", "guixu"],
];

/** Where a vein's end lies, on the authoring grid. */
export const veinEnd = (k: CaveId | "guixu"): [number, number] => (k === "guixu" ? GUIXU.c : CAVE_MOUTH[k].at);
