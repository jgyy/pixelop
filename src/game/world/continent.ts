import { fbm, hash2 } from "../pixel/noise";
import { propDef, type PropId } from "../art/props";
import { AREA_IDS, festive, getArea, placementTiles, type AreaDef, type AreaId, type Critter, type EnemySpawn, type Interactable, type NpcPlacement, type PropPlacement } from "./areas";
import { getInterior, INTERIOR_IDS } from "./interiors";
import { roomDoors } from "./rooms";
import { COARSE_H, COARSE_ORIGIN, COARSE_W, DOMAIN, heldBy, HOLDS, regionRect, toCoarse, toWorld, WORLD_H, WORLD_SCALE, WORLD_W } from "./layout";
import { companionOf, magnifyMap, magnifyProp, pointTile } from "./magnify";
import { LIQUID, TileMap, type TileKind } from "./tilemap";
import { CAVE_IDS, CAVE_MOUTH, deepFolk } from "./caves";
import { layWar } from "./warfront";
import { layRoad } from "./roadside";
import { STREET_FOLK, TIDE_FOLK } from "./road";
import { DORM_AT, FIELD, GREAT_HALL_AT, HALL_BOSS_AT, HALL_BOSSES, HALL_CAST, HALL_SITES, HALLS, HOPEFULS, hallMasterKey, MISSION_AT, OUTER_FOLK, RING, SPARRERS, STONE_AT } from "./halls";
import { PatchPainter, type TerrainPatch } from "./terrain";
import { flockmates, neighbours, packmates } from "./crowds";
import { EAST_WARD, JINHE_QUARTERS, WILLOW_WARD, type Quarter } from "./quarters";
import { AVENUE, CHALLENGERS, FLATS, followerKey, gateFlag, SCALE_AT, STAIR_RING, stairRow, TIANJIE_C, TIER_BOSSES, TIER_CAST, TIER_COUNT, TIER_FOLK, TIER_PATRON, TIER_SITES, tierAt, tierHeight, tierRect, tierSpots, tierWorldRect, WARDEN_NAMES, wardenKey, WEIGH_HALL_AT } from "./tiers";

/**
 * The jianghu as one continuous map. The six hand-built regions are stamped
 * into a single tile grid. Generated wilds fill the land between them, and
 * the old highway, rivers and sky bridges join them up. Smaller landmarks
 * (the teahouse crossroads, the watermill, the ruined temple, the pagoda
 * hill, the hot spring, two camps and the floating isles) are stamped into
 * the wilds with their own people, beasts and treasures. Every tile belongs
 * to the nearest region, which sets the sky, weather and light there and
 * decides where a sealed region's mist wall stands.
 */

export interface WorldDef extends AreaDef {
  /** Index into AREA_IDS of the region each tile belongs to. */
  regionOf: Uint8Array;
  /** The hand-built region templates (region-local coordinates): names, skies, weather. */
  regions: Record<AreaId, AreaDef>;
  /** Fast-travel landing spot of each region, in world tiles. */
  waypoints: Record<AreaId, [number, number]>;
  /** Named landmarks out in the wilds (shown on the world map). */
  landmarks: Landmark[];
  /** Ground she may not step onto until a flag is set: each tier of the City of Nine Tiers, sealed below its realm (world tiles, [x0, y0, x1, y1)). */
  bars: Bar[];
}

export interface Bar {
  key: string;
  rect: [number, number, number, number];
  /** The flag that lifts it. */
  flag: string;
  /** Said when she walks into it. */
  why: string;
}

export interface Landmark {
  key: string;
  name: string;
  hanzi: string;
  icon: PropId;
  /** World tile of the landmark's centre. */
  x: number;
  y: number;
}

type Mainland = "valley" | "bamboo" | "village" | "lake";
const MAINLAND: Mainland[] = ["valley", "bamboo", "village", "lake"];
/** Every region that stands on the ground (the sky islands float above). */
type Ground = Mainland | "marsh" | "terraces" | "desert" | "harbor" | "frost";
const GROUND: Ground[] = [...MAINLAND, "marsh", "terraces", "desert", "harbor", "frost"];
const SKY: AreaId[] = ["sect", "peak"];

/** Wild biomes: each ground region's own, the southern lands below the highway, and the far south and east the world grew into. */
type WildId = Ground | "wastes" | "stoneforest" | "fields" | "highlands" | "marshland" | "terracehills" | "plum" | "sands" | "badlands" | "autumn" | "steppe" | "frostlands" | "coast" | "riverlands" | "tidelands" | "stairlands";

interface WildStyle {
  ground: (i: number, j: number) => TileKind;
  lift: number;
  /** Hill amplitude (levels). */
  hills: number;
  trees: PropId[];
  treeP: number;
  extras: PropId[];
  extraP: number;
  /** Ashen ground: no sandy river banks, red-rock roads. */
  ashen?: boolean;
}

const ash = (i: number, j: number): TileKind => (fbm(i * 0.3, j * 0.3, 5) > 0.58 ? "redrock" : "ash");

function marshGround(i: number, j: number): TileKind {
  return fbm(i * 0.2, j * 0.2, 140) > 0.6 ? "grass" : "moss";
}

const BIOME: Record<Exclude<WildId, "marsh" | "terraces" | "desert" | "harbor" | "frost">, WildStyle> = {
  valley: { ground: ash, lift: 1, hills: 3.2, trees: ["deadtree", "deadtree", "boulder"], treeP: 0.07, extras: ["bones", "spikes", "bones"], extraP: 0.05, ashen: true },
  bamboo: { ground: (i, j) => (fbm(i * 0.2, j * 0.2, 9) > 0.62 ? "moss" : "leaf"), lift: 0, hills: 3.2, trees: ["bamboo", "bamboo", "bamboo", "pine"], treeP: 0.2, extras: ["rock", "tallgrass", "reeds"], extraP: 0.05 },
  village: { ground: (i, j) => (hash2(i, j, 9) > 0.8 ? "meadow" : "grass"), lift: 0, hills: 3.2, trees: ["maple", "cherry", "pine", "maple"], treeP: 0.06, extras: ["tallgrass", "rock", "tallgrass"], extraP: 0.06 },
  lake: { ground: (i, j) => (hash2(i, j, 4) > 0.82 ? "meadow" : "grass"), lift: 0, hills: 3.2, trees: ["willow", "pine", "willow"], treeP: 0.06, extras: ["reeds", "tallgrass", "rock"], extraP: 0.05 },
  wastes: { ground: ash, lift: 0, hills: 2.6, trees: ["deadtree", "boulder", "spikes", "deadtree"], treeP: 0.06, extras: ["bones", "bones", "rock"], extraP: 0.06, ashen: true },
  stoneforest: { ground: (i, j) => (fbm(i * 0.18, j * 0.18, 13) > 0.6 ? "moss" : hash2(i, j, 14) > 0.85 ? "meadow" : "grass"), lift: 0, hills: 2.6, trees: ["karst", "karst", "pine", "karst", "rock"], treeP: 0.1, extras: ["tallgrass", "rock", "tallgrass"], extraP: 0.06 },
  fields: { ground: (i, j) => (fbm(i * 0.15, j * 0.15, 17) > 0.6 ? "meadow" : hash2(i, j, 18) > 0.85 ? "meadow" : "grass"), lift: 0, hills: 1.8, trees: ["maple", "haystack", "cherry", "maple", "scarecrow"], treeP: 0.035, extras: ["tallgrass", "tallgrass", "rock"], extraP: 0.07 },
  highlands: { ground: (i, j) => (fbm(i * 0.09, j * 0.09, 31) > 0.66 ? "snow" : fbm(i * 0.25, j * 0.25, 19) > 0.64 ? "moss" : "grass"), lift: 1, hills: 4.4, trees: ["pine", "pine", "boulder", "pine", "rock"], treeP: 0.1, extras: ["rock", "tallgrass"], extraP: 0.05 },
  marshland: { ground: marshGround, lift: 0, hills: 1.4, trees: ["willow", "deadtree", "willow", "reeds"], treeP: 0.08, extras: ["reeds", "tallgrass", "reeds", "butterflies"], extraP: 0.08 },
  terracehills: { ground: (i, j) => (fbm(i * 0.2, j * 0.2, 141) > 0.62 ? "grass" : "meadow"), lift: 1, hills: 3.6, trees: ["teabush", "teabush", "cherry", "teabush", "pine"], treeP: 0.1, extras: ["tallgrass", "butterflies", "tallgrass"], extraP: 0.05 },
  plum: { ground: (i, j) => (hash2(i, j, 142) > 0.7 ? "meadow" : "grass"), lift: 0, hills: 2.6, trees: ["cherry", "cherry", "peachtree", "pine"], treeP: 0.07, extras: ["tallgrass", "rock", "butterflies"], extraP: 0.05 },
  sands: { ground: (i, j) => (fbm(i * 0.22, j * 0.22, 143) > 0.64 ? "redrock" : "sand"), lift: 0, hills: 2.4, trees: ["boulder", "karst", "deadtree", "palm", "bones"], treeP: 0.035, extras: ["bones", "rock"], extraP: 0.03, ashen: true },
  badlands: { ground: (i, j) => (fbm(i * 0.18, j * 0.18, 144) > 0.55 ? "sand" : "redrock"), lift: 1, hills: 4, trees: ["karst", "boulder", "deadtree", "karst"], treeP: 0.06, extras: ["rock", "bones"], extraP: 0.04, ashen: true },
  autumn: { ground: (i, j) => (fbm(i * 0.2, j * 0.2, 145) > 0.6 ? "grass" : "leaf"), lift: 0, hills: 3, trees: ["maple", "maple", "pine", "maple"], treeP: 0.13, extras: ["tallgrass", "rock", "butterflies"], extraP: 0.05 },
  steppe: { ground: (i, j) => (fbm(i * 0.12, j * 0.12, 146) > 0.58 ? "meadow" : "grass"), lift: 0, hills: 1.6, trees: ["rock", "boulder", "haystack"], treeP: 0.012, extras: ["tallgrass", "tallgrass", "butterflies"], extraP: 0.06 },
  frostlands: { ground: (i, j) => (fbm(i * 0.15, j * 0.15, 147) > 0.68 ? "marble" : fbm(i * 0.3, j * 0.3, 148) > 0.7 ? "grass" : "snow"), lift: 2, hills: 4, trees: ["snowpine", "snowpine", "rock", "crystal", "snowpine"], treeP: 0.1, extras: ["rock", "crystal"], extraP: 0.03 },
  coast: { ground: (i, j) => (fbm(i * 0.2, j * 0.2, 149) > 0.6 ? "sand" : "grass"), lift: 0, hills: 1.8, trees: ["pine", "palm", "rock", "pine"], treeP: 0.05, extras: ["tallgrass", "reeds"], extraP: 0.04 },
  // the Golden River country: low farmland running down to the southern sea, sandy toward the shore
  // the Tidewater Reach: salt meadows and sandy flats round the port of Hailing, palms and reeds along the lagoon
  tidelands: { ground: (i, j) => (fbm(i * 0.14, j * 0.14, 152) > 0.62 ? "sand" : fbm(i * 0.2, j * 0.2, 153) > 0.6 ? "meadow" : "grass"), lift: 0, hills: 1.2, trees: ["palm", "willow", "palm", "reeds", "pine"], treeP: 0.035, extras: ["reeds", "tallgrass", "butterflies"], extraP: 0.06 },
  // the Stairlands across the strait: karst pinnacles and terraced green round the City of Nine Tiers
  stairlands: { ground: (i, j) => (fbm(i * 0.18, j * 0.18, 162) > 0.62 ? "meadow" : hash2(i, j, 163) > 0.9 ? "moss" : "grass"), lift: 0, hills: 2, trees: ["karst", "bamboo", "pine", "karst", "cherry"], treeP: 0.06, extras: ["tallgrass", "rock", "butterflies"], extraP: 0.05 },
  riverlands: { ground: (i, j) => (j > 538 + fbm(i * 0.1, j * 0.1, 150) * 12 ? "sand" : fbm(i * 0.16, j * 0.16, 151) > 0.6 ? "meadow" : "grass"), lift: 0, hills: 1.4, trees: ["willow", "maple", "haystack", "cherry", "willow"], treeP: 0.04, extras: ["tallgrass", "reeds", "butterflies", "tallgrass"], extraP: 0.06 },
};
// the new regions' own surroundings take after the lands they stand in
const WILD: Record<WildId, WildStyle> = { ...BIOME, marsh: BIOME.marshland, terraces: BIOME.terracehills, desert: BIOME.sands, harbor: BIOME.coast, frost: BIOME.frostlands };

/** The southern lands' biomes, as world rectangles [x0, y0, x1, y1]. */
const ZONES: [WildId, [number, number, number, number]][] = [
  ["wastes", [6, 184, 70, 228]],
  ["stoneforest", [82, 184, 140, 228]],
  ["fields", [156, 180, 222, 228]],
  ["highlands", [238, 178, 320, 228]],
  // the far south
  ["marshland", [3, 236, 135, 452]],
  ["terracehills", [140, 238, 280, 335]],
  ["plum", [140, 340, 280, 452]],
  ["sands", [290, 330, 470, 452]],
  // and the east, across the Rainbow Bridge
  ["badlands", [480, 330, 640, 452]],
  ["autumn", [350, 240, 560, 325]],
  ["steppe", [350, 150, 560, 235]],
  ["frostlands", [350, 52, 640, 145]],
  ["coast", [565, 150, 640, 330]],
  // and the Golden River country, below the far south, down to the southern sea
  ["riverlands", [10, 458, 290, 552]],
  // and the Tidewater Reach, the south-east, round the port of Hailing
  ["tidelands", [470, 456, 630, 548]],
  // and across the strait of cloud, the Stairlands round the City of Nine Tiers
  ["stairlands", [140, 560, 310, 658]],
];

/** The old highway across the whole mainland, below the four regions. */
export const HIGHWAY: [number, number][] = [
  [10, 166],
  [30, 167.5],
  [52, 165],
  [76, 166],
  [100, 164.5],
  [126, 166],
  [150, 167],
  [176, 165.5],
  [200, 166],
  [226, 167],
  [250, 165],
  [274, 166],
  [296, 167],
  [312, 166],
  // the Rainbow Bridge over the great waterfall's gorge, and on across the eastern steppe to the sea
  [330, 166],
  [350, 166],
  [372, 168.5],
  [400, 172],
  [430, 180],
  [460, 192],
  [490, 205],
  [520, 220],
  [548, 236],
  [572, 248],
  [590, 252],
];

/** Jinhe's walls (authoring tiles, inclusive), and the crossroads at its heart where its two streets meet. */
const JINHE = { x0: 201, y0: 482, x1: 243, y1: 518, c: [222, 500] as [number, number] };
/** The city's old walls, before it grew: its first quarters still stand where they were, and the new ones ring them. */
const OLD_JINHE = { x0: 208, y0: 487, x1: 236, y1: 513 };

/** Hailing, the port of the Tidewater Reach (authoring tiles, inclusive): walls, two streets crossing at its square, and a ring of canals. */
export const HAILING = { x0: 526, y0: 484, x1: 568, y1: 520, c: [547, 502] as [number, number], canalsJ: [492, 512], canalsI: [535, 559] };
/** Returning Cloud Isle in its lagoon, off Hailing's east gate. */
const ISLE: { c: [number, number]; r: number; lagoon: number } = { c: [606, 531], r: 6.5, lagoon: 11 };

/** The planks of the Rainbow Bridge span the gorge between these x (authoring tiles). */
const GORGE: [number, number] = [314, 350];

/** Branch roads from the highway: up to each region's exit, and down into the southern lands. */
const BRANCHES: { pts: [number, number][]; valley?: boolean }[] = [
  { pts: [[20, 166], [20, 159]], valley: true },
  { pts: [[112, 164.8], [112, 143]] },
  { pts: [[192, 165.8], [192, 129]] },
  { pts: [[274, 166], [274, 137]] },
  // to the ruined temple in the stone forest
  { pts: [[150, 167], [150, 182], [143, 194], [126, 203], [112, 206]] },
  // to the pagoda hill among the fields
  { pts: [[192, 166], [194, 182], [190, 197]] },
  // to the hot spring and on to the bandit camp in the highlands
  { pts: [[250, 165], [248, 178], [250, 187]] },
  { pts: [[257, 191], [268, 197], [287, 205]] },
  // through the ashen wastes to the Blood Moon camp
  { pts: [[52, 165], [50, 177], [44, 189], [38, 196]] },
  // along the creek from Willow Creek to the watermill
  { pts: [[203, 105], [216, 107], [230, 110]] },
  // north through the westwood to the Sword Tomb
  { pts: [[70, 165.6], [74, 140], [80, 120], [82, 114]] },
  // a footpath from Willow Creek's west lane to the Moon-Gazing Pavilion
  { pts: [[175, 104], [164, 103], [155, 103]] },
  // east past the lake to the peach orchard
  { pts: [[300, 166.6], [301, 160], [303, 155]] },
  // the south road: on from the pagoda hill to the Cloudmist Tea Terraces
  { pts: [[190, 197], [192, 215], [194, 240], [196, 270], [196, 296]] },
  // through the ashen wastes, over the lava on a stone bridge, and down into the Mistmarsh
  { pts: [[50, 177], [56, 210], [58, 240], [56, 270], [56, 300]] },
  // the southern road, from the Mistmarsh's east boardwalk past the plum hills to the tea road…
  { pts: [[72, 315], [110, 300], [150, 285], [196, 270]] },
  // …and on south-east into the Yellow Sands
  { pts: [[196, 270], [240, 282], [290, 302], [330, 330], [350, 352]] },
  // the shrine among the plum blossom
  { pts: [[150, 285], [146, 330], [138, 372], [132, 396]] },
  // north from the steppe up into the snows to Frostveil Monastery
  { pts: [[400, 172], [430, 150], [462, 126], [494, 97]] },
  // the herders' camp on the steppe
  { pts: [[460, 192], [466, 178], [470, 168]] },
  // down from the steppe through the maple woods to the Yellow Sands' east side
  { pts: [[460, 192], [445, 240], [430, 278], [400, 318], [366, 366]] },
  // into the red cliffs of the badlands
  { pts: [[430, 278], [480, 330], [512, 372], [524, 396]] },
  // the Great South Road, from the southern road down through the plum hills to Jinhe's north gate
  { pts: [[240, 282], [234, 320], [228, 360], [224, 400], [222, 440], [222, 482]] },
  // out of Jinhe's west gate to Reedwater Landing, where the bamboo stream meets the sea
  { pts: [[201, 500], [180, 504], [150, 508], [120, 514], [104, 520]] },
  // out of the east gate, over the Golden River, to the caravanserai…
  { pts: [[243, 500], [260, 500], [290, 501], [326, 500]] },
  // …and the caravan track north to the Yellow Sands
  { pts: [[330, 496], [340, 470], [348, 440], [350, 404]] },
  // the south gate, down to the cliffs over the strait, where the Nine-Arch Bridge sets out for the City of Nine Tiers
  { pts: [[222, 518], [222, 530], [222, 552]] },
  // the Tide Road: on east from the caravanserai, across the salt meadows, to Hailing's west gate
  { pts: [[336, 500], [380, 503], [430, 505], [480, 503], [526, 502]] },
  // down from the red cliffs of the badlands to Hailing's north gate
  { pts: [[524, 404], [530, 430], [540, 458], [547, 484]] },
  // out of the east gate to Saltwind's salt pans…
  { pts: [[568, 502], [578, 494], [588, 486]] },
  // …and the long causeway across the lagoon to Returning Cloud Isle
  { pts: [[568, 504], [580, 510], [592, 520], [601, 528], [606, 531]] },
  // the south gate, down to the quay
  { pts: [[547, 520], [547, 528]] },
  // west off the Great South Road, through the selection field, to the Ten Halls' east gate (the Gate of Equal Footing)…
  { pts: [[222, 452], [206, 457], [192, 462], [181, 462]] },
  // …and out of its south gate, down to the road from Jinhe's west gate
  { pts: [[160, 481], [159, 494], [158, 506]] },
];

const RIVERS: { pts: [number, number][]; kind: "water" | "lava"; width: number }[] = [
  // Willow Creek flows west into the bamboo grove's stream…
  { kind: "water", width: 3, pts: [[177, 108], [165, 110], [150, 116], [138, 121], [127, 124]] },
  // …and east past the watermill into the Lotus Lake…
  { kind: "water", width: 3, pts: [[207, 121], [222, 121], [238, 119], [252, 121], [265, 121]] },
  // …which spills over the eastern edge of the world as a waterfall.
  { kind: "water", width: 2.6, pts: [[280, 125], [296, 127], [310, 128], [324, 129]] },
  // The bamboo stream runs on west and south through the stone forest and off the southern cliffs.
  { kind: "water", width: 2.6, pts: [[93, 132], [86, 138], [81, 148], [78, 160], [75, 176], [80, 192], [76, 208], [72, 220], [70, 232], [74, 260], [80, 300], [84, 340], [80, 380], [84, 420], [82, 464], [86, 500], [82, 530], [80, 560]] },
  // A hot stream from the highland spring winds south to the world's edge too.
  { kind: "water", width: 2.2, pts: [[252, 195], [257, 206], [255, 218], [258, 232], [262, 260], [270, 290], [268, 330], [275, 380], [272, 420], [274, 464], [278, 490], [272, 520], [276, 560]] },
  // The Jade River runs down out of the eastern snows and pours off the eastern edge into the sea of clouds.
  { kind: "water", width: 3, pts: [[520, 108], [532, 130], [548, 152], [575, 172], [606, 186], [648, 194]] },
  // In the ashen wastes, lava wells up and sinks back into a burning pool.
  { kind: "lava", width: 2.4, pts: [[56, 192], [60, 204], [57, 216], [60, 230]] },
];

const inRect = (id: AreaId, i: number, j: number) => {
  const [x0, y0, x1, y1] = regionRect(id, 1);
  return i >= x0 && j >= y0 && i < x1 && j < y1;
};

/**
 * The land below the clouds: the old mainland, the southern lands it grew
 * into (joined to it all along its southern shore), and the eastern lands
 * beyond the gorge, which meet the south below it. Wavecrest Harbour's bay
 * is the world's eastern edge.
 */
const mainlandMask = (i: number, j: number) => {
  const n = (fbm(i * 0.06, j * 0.06, 41) - 0.5) * 9 + (fbm(i * 0.2, j * 0.2, 42) - 0.5) * 2;
  const old = j >= 92 + n && j <= 226 + n && i >= 3 + n * 0.6 && i <= 320 + n * 0.6;
  // the new lands' outer shores wander in broad bays and headlands
  const shore = (fbm(i * 0.018, j * 0.018, 43) - 0.5) * 44;
  const south = j >= 200 + n && j <= 448 + n + shore && i >= 6 + n * 0.6 - shore && i <= 470 + n * 0.6;
  // the Golden River country, the world's newest land, runs on to the southern sea
  const river = j >= 400 + n && j <= 546 + n + shore * 0.3 && i >= 8 + n * 0.6 - shore * 0.3 && i <= 466 + n * 0.6 + shore * 0.2;
  // the Tidewater Reach, round the port of Hailing and its lagoon
  const tide = j >= 440 + n && j <= 548 + n + shore * 0.3 && i >= 460 + n * 0.6 && i <= 628 + n * 0.6 + shore * 0.2;
  // the Stairlands across the strait, round the City of Nine Tiers
  const stair = j >= 562 + n * 0.5 && j <= 656 && i >= 142 + n * 0.6 - shore * 0.15 && i <= 302 + n * 0.6 + shore * 0.15;
  const east = j >= 56 + n - shore && j <= 448 + n + shore && i >= 346 + n * 0.6 && (j > 222 && j < 282 ? i <= 621 : i <= 636 + n * 0.6 + shore);
  return old || south || east || river || tide || stair;
};

/**
 * Mountain ranges thrown up over the wilds (authoring grid): the land rises
 * toward each range's heart (or, with `ring`, toward a rim around a sheltered
 * valley) by up to `peak` levels, broken into ridges by noise. Roads, regions
 * and rivers stay where they are; the slopes ease down to meet them.
 */
const RANGES: { key: string; c: [number, number]; r: number; peak: number; seed: number; ring?: number }[] = [
  { key: "dragonspine", c: [244, 250], r: 20, peak: 11, seed: 501 },
  { key: "herbrim", c: [48, 392], r: 19, peak: 7, seed: 502, ring: 11 },
  { key: "frostpeaks", c: [560, 96], r: 30, peak: 10, seed: 503 },
  { key: "redmesas", c: [606, 408], r: 24, peak: 6, seed: 504 },
  { key: "highcrags", c: [272, 202], r: 20, peak: 4, seed: 505 },
  { key: "autumnridge", c: [420, 268], r: 24, peak: 4, seed: 506 },
  { key: "plumhills", c: [182, 372], r: 22, peak: 4, seed: 507 },
  { key: "westwood", c: [60, 140], r: 18, peak: 3, seed: 508 },
];

/** How many levels the ranges lift a wild tile. */
function uplift(i: number, j: number): number {
  let up = 0;
  for (const g of RANGES) {
    const d = Math.hypot(i - g.c[0], j - g.c[1]);
    if (d >= g.r) continue;
    const k = g.ring !== undefined ? Math.max(0, 1 - Math.abs(d - g.ring) / Math.max(1, g.r - g.ring)) * (d < g.ring ? Math.min(1, (d / g.ring) * 1.4) : 1) : 1 - d / g.r;
    const ridge = 1 - Math.abs(fbm(i * 0.09, j * 0.09, g.seed) * 2 - 1);
    // steep near the crest, easing out at the foot
    up = Math.max(up, Math.round(g.peak * Math.pow(k, 0.85) * (0.4 + 0.8 * ridge)));
  }
  return up;
}

/** Floating isles in the sky: [centre x, centre y, radius, height]. */
const ISLES: { key: string; c: [number, number]; r: number; h: number }[] = [
  { key: "cloudrest", c: [192, 77], r: 4.4, h: 2 },
  { key: "cloudstepA", c: [219, 49], r: 4.6, h: 2 },
  { key: "cloudstepB", c: [236, 41], r: 3.8, h: 2 },
  // the sect's own terraces, moored about its rim: the disciples' court, the taiji yard and the sword garden
  { key: "court", c: [163, 50], r: 7.6, h: 2 },
  { key: "taiji", c: [167, 32], r: 5.6, h: 2 },
  { key: "garden", c: [168, 67], r: 5.6, h: 2 },
];

const rectDist = ([x0, y0, x1, y1]: [number, number, number, number], x: number, y: number) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

/** Every wild biome with the rectangle it grows from (authoring grid). */
const BIOME_RECTS: [WildId, [number, number, number, number]][] = [...GROUND.map((id): [WildId, [number, number, number, number]] => [id, regionRect(id, 1)]), ...ZONES];
const WILD_IDS = Object.keys(WILD) as WildId[];

/** Nearest wild biome (an index into WILD_IDS), with a noisy border so biomes interleave. */
const BIOME_INDEX = BIOME_RECTS.map(([id]) => WILD_IDS.indexOf(id));
const BIOME_SEED = BIOME_RECTS.map(([id]) => 60 + id.length);
const biomeDist = new Float64Array(BIOME_RECTS.length);
function wildRegion(i: number, j: number): number {
  const x = i + 0.5;
  const y = j + 0.5;
  let nearest = Infinity;
  for (let k = 0; k < BIOME_RECTS.length; k++) {
    biomeDist[k] = rectDist(BIOME_RECTS[k][1], x, y);
    if (biomeDist[k] < nearest) nearest = biomeDist[k];
  }
  // the border noise (fine ripples on broad swells) moves a biome by at most 28.5 tiles, so only biomes about as near as the closest are worth the noise
  let best = BIOME_INDEX[0];
  let bd = Infinity;
  const noise = new Map<number, number>();
  for (let k = 0; k < BIOME_RECTS.length; k++) {
    if (biomeDist[k] > nearest + 57) continue;
    const seed = BIOME_SEED[k];
    let n = noise.get(seed);
    if (n === undefined) noise.set(seed, (n = (fbm(i * 0.17, j * 0.17, seed) - 0.5) * 7 + (fbm(i * 0.035, j * 0.035, seed + 40) - 0.5) * 50));
    const dd = biomeDist[k] + n;
    if (dd < bd) {
      bd = dd;
      best = BIOME_INDEX[k];
    }
  }
  return best;
}

/** Call `fn` once for every tile within `width / 2` of a polyline. */
function stroke(points: [number, number][], width: number, fn: (i: number, j: number) => void): void {
  const seen = new Set<number>();
  for (let p = 1; p < points.length; p++) {
    const [x0, y0] = points[p - 1];
    const [x1, y1] = points[p];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 3));
    for (let s = 0; s <= steps; s++) {
      const cx = x0 + ((x1 - x0) * s) / steps;
      const cy = y0 + ((y1 - y0) * s) / steps;
      for (let j = Math.floor(cy - width); j <= Math.ceil(cy + width); j++)
        for (let i = Math.floor(cx - width); i <= Math.ceil(cx + width); i++) {
          if (Math.hypot(i - cx, j - cy) > width / 2 + 0.2) continue;
          const k = j * 8192 + i;
          if (seen.has(k)) continue;
          seen.add(k);
          fn(i, j);
        }
    }
  }
}

/** Props that stand in water. */
export const FLOATS = new Set<PropId>(["lotus", "boat", "reeds", "waterwheel", "koi", "ship", "sampan"]);

function buildWorld(): WorldDef {
  const m = new TileMap(COARSE_W, COARSE_H, "void", 0);
  /** 0 = wild, 1 = region template or landmark site, 2 = carved road/river/bridge (fixed height). */
  const fixed = new Uint8Array(COARSE_W * COARSE_H);
  /** Each wild tile's biome, as 1 + its index into WILD_IDS (0 = not wild). */
  const wildOf = new Uint8Array(COARSE_W * COARSE_H);
  const fix = (i: number, j: number, v: 1 | 2) => {
    if (m.inside(i, j)) fixed[j * COARSE_W + i] = v;
  };

  // 1. the mainland wilds
  m.each((i, j) => {
    if (!mainlandMask(i, j) && !GROUND.some((id) => inRect(id, i, j))) return;
    const r = wildRegion(i, j);
    wildOf[j * COARSE_W + i] = r + 1;
    const st = WILD[WILD_IDS[r]];
    const hills = 1 + Math.round((fbm(i * 0.07, j * 0.07, 31) - 0.45) * st.hills);
    m.set(i, j, st.ground(i, j), Math.max(0, Math.min(5, hills + st.lift)) + uplift(i, j));
  });
  const ashen = (i: number, j: number) => {
    const r = wildOf[j * COARSE_W + i];
    return r ? !!WILD[WILD_IDS[r - 1]].ashen : inRect("valley", i, j);
  };

  // 2. stamp the hand-built regions
  const regions = {} as Record<AreaId, AreaDef>;
  const props: PropPlacement[] = [];
  const npcs: NpcPlacement[] = [];
  const enemies: EnemySpawn[] = [];
  const interacts: Interactable[] = [];
  const critters: Critter[] = [];
  for (const id of AREA_IDS) {
    const a = getArea(id);
    regions[id] = a;
    const [ox, oy] = COARSE_ORIGIN[id];
    a.map.each((i, j) => {
      const k = a.map.kind(i, j);
      if (k === "void") return;
      m.set(ox + i, oy + j, k, a.map.height(i, j));
      fix(ox + i, oy + j, 1);
    });
    for (const p of a.props) props.push({ ...p, i: p.i + ox, j: p.j + oy });
    for (const n of a.npcs) npcs.push({ ...n, i: n.i + ox, j: n.j + oy, route: n.route?.map(([x, y]) => [x + ox, y + oy]) });
    for (const e of a.enemies) enemies.push({ ...e, i: e.i + ox, j: e.j + oy });
    for (const it of a.interacts) interacts.push({ ...it, i: it.i + ox, j: it.j + oy });
    for (const c of a.critters ?? []) critters.push({ ...c, i: c.i + ox, j: c.j + oy });
  }

  // 3. floating isles beside the sky bridges
  for (const isle of ISLES) {
    m.disc(isle.c[0], isle.c[1], isle.r, "grass", isle.h, 0.8, 80 + isle.r);
    m.disc(isle.c[0], isle.c[1], isle.r * 0.45, "plaza", isle.h, 0, 1);
    const [cx, cy] = isle.c;
    const rr = Math.ceil(isle.r + 3);
    for (let j = cy - rr; j <= cy + rr; j++)
      for (let i = cx - rr; i <= cx + rr; i++) {
        if (Math.hypot(i - cx, j - cy) < isle.r + 2 && m.kind(i, j) !== "void") {
          fix(i, j, 1);
          if (m.kind(i, j) === "grass" && hash2(i, j, 9) > 0.78) m.set(i, j, "meadow");
        }
      }
  }

  // 4. landmark sites in the wilds: levelled ground the roads lead to
  const site = (c: [number, number], r: number, kind: TileKind, h: number, rough = 0.6) => {
    const n = Math.ceil(r + 2);
    for (let j = Math.floor(c[1]) - n; j <= Math.ceil(c[1]) + n; j++)
      for (let i = Math.floor(c[0]) - n; i <= Math.ceil(c[0]) + n; i++) {
        const d = Math.hypot(i - c[0], j - c[1]);
        if (d > r + 1.5 || m.kind(i, j) === "void") continue;
        const rr = r + (fbm(i * 0.35, j * 0.35, 90) - 0.5) * rough * 2;
        if (d <= rr) {
          m.set(i, j, kind, h);
          fix(i, j, 1);
        }
      }
  };
  site([150, 171], 5, "plaza", 1); // teahouse crossroads
  site([233, 112], 4.5, "grass", 1); // watermill
  site([106, 206], 7, "plaza", 1, 1); // ruined temple
  site([190, 203], 4.6, "grass", 2); // pagoda hill
  site([252, 192], 5.6, "sand", 1, 0.8); // hot spring
  site([292, 207], 5.6, "dirt", 1, 1); // bandit camp
  site([34, 200], 5.6, "ash", 1, 1); // blood moon camp
  site([83, 108], 6, "dirt", 1, 1); // sword tomb
  site([150, 101], 4.6, "grass", 1, 0.8); // moon-gazing pavilion
  site([304, 150], 6.4, "meadow", 1, 0.8); // peach orchard
  site([470, 166], 6, "meadow", 1, 0.8); // the herders' camp on the steppe
  site([430, 282], 5.4, "leaf", 1, 0.8); // the woodcutters' lodge in the maple woods
  site([132, 400], 6, "meadow", 1, 0.8); // the plum blossom shrine
  site([524, 400], 6, "sand", 1, 1); // the red cliff hideout
  site([352, 166], 3.4, "plaza", 1, 0.3); // the eastern bridgehead
  site([110, 300], 4.4, "grass", 1, 0.8); // the ferry landing by the southern road
  // the Scarlet Phoenix Sect on its mesa: a ring of red flats at the foot, sheer cliffs, the sect on top
  site([586, 372], 10.5, "sand", 2, 0.8);
  site([586, 372], 7, "redrock", 7, 0.5);
  site([586, 372], 3.6, "plaza", 7, 0);
  site([586, 372], 1.4, "lava", 7, 0);
  site([573, 381], 3.4, "redrock", 2, 0.4); // the Ember Mine's mouth
  // Hundred Herb Valley, sheltered in a ring of hills in the far south-west
  site([48, 392], 8.4, "meadow", 1, 0.8);
  site([48, 392], 3, "plaza", 1, 0);
  // the Sword Sea Pavilion on its crag above the eastern snows, and the ledge below it
  site([600, 116], 9.5, "snow", 3, 0.8);
  site([600, 116], 6, "marble", 10, 0.4);
  site([600, 116], 3, "plaza", 10, 0);
  site([615, 127], 3, "plaza", 5, 0.3);
  // the foot of the Dragonspine, where the Dragon Vein comes nearest the surface
  site([222, 262], 3.6, "dirt", 2, 0.6);
  // Willow Creek's market road: the village spills south along the road down to the highway
  site([192, 146], 11, "grass", 1, 0.5);
  // Willow Creek's East Ward: level ground below the creek, a paved street through it, and a lane west to the market road
  {
    const { x0, y0, x1, y1, street } = EAST_WARD;
    for (let j = y0; j <= y1; j++)
      for (let i = x0; i <= x1; i++) {
        if (m.kind(i, j) === "void" || LIQUID[m.kind(i, j)]) continue;
        const edge = Math.min(i - x0, x1 - i, j - y0, y1 - j);
        if (edge < 1 && hash2(i, j, 164) > 0.5 && Math.abs(j - street) > 1) continue;
        m.set(i, j, Math.abs(j - street) <= 1 ? "plaza" : hash2(i, j, 165) > 0.88 ? "dirt" : "grass", 1);
        fix(i, j, 1);
      }
    for (let i = 200; i < x0; i++)
      for (let j = street - 1; j <= street + 1; j++) {
        m.set(i, j, "plaza", 1);
        fix(i, j, 1);
      }
  }
  // paddies among the fields, edged by dikes
  for (const [x0, y0] of [
    [200, 175],
    [208, 175],
    [200, 182],
  ] as [number, number][]) {
    for (let j = y0; j <= y0 + 5; j++)
      for (let i = x0; i <= x0 + 6; i++) {
        const dike = j === y0 || j === y0 + 5 || i === x0 || i === x0 + 6;
        m.set(i, j, dike ? "dirt" : "paddy", dike ? 1 : 0);
        fix(i, j, 1);
      }
  }

  // Jinhe, the Golden River City: levelled ground inside its walls, two paved streets crossing at a square
  for (let j = JINHE.y0 - 3; j <= JINHE.y1 + 3; j++)
    for (let i = JINHE.x0 - 3; i <= JINHE.x1 + 3; i++) {
      if (m.kind(i, j) === "void") continue;
      const inside = i > JINHE.x0 && i < JINHE.x1 && j > JINHE.y0 && j < JINHE.y1;
      const street = Math.abs(i - JINHE.c[0]) <= 1 || Math.abs(j - JINHE.c[1]) <= 1;
      const square = Math.abs(i - JINHE.c[0]) <= 4 && Math.abs(j - JINHE.c[1]) <= 4;
      // where the old walls stood, a ring lane joins the old city to the new quarters round it
      const O = OLD_JINHE;
      const lane = ((i === O.x0 || i === O.x1) && j >= O.y0 && j <= O.y1) || ((j === O.y0 || j === O.y1) && i >= O.x0 && i <= O.x1);
      m.set(i, j, inside && (street || square || lane) ? "plaza" : inside && hash2(i, j, 152) > 0.86 ? "dirt" : "grass", 1);
      fix(i, j, 1);
    }
  site([100, 522], 7, "sand", 1, 0.8); // Reedwater Landing
  site([330, 500], 6.4, "sand", 1, 0.8); // the caravanserai
  // Hailing, the port of the Tidewater Reach: level ground in its walls, two paved streets, a square, and canals with bridges where the streets cross them
  {
    const { x0, y0, x1, y1, c, canalsJ, canalsI } = HAILING;
    for (let j = y0 - 3; j <= y1 + 3; j++)
      for (let i = x0 - 3; i <= x1 + 3; i++) {
        if (m.kind(i, j) === "void") continue;
        const inside = i > x0 && i < x1 && j > y0 && j < y1;
        const street = Math.abs(i - c[0]) <= 1 || Math.abs(j - c[1]) <= 1;
        const square = Math.abs(i - c[0]) <= 4 && Math.abs(j - c[1]) <= 4;
        const canal = inside && i > x0 + 1 && i < x1 - 1 && j > y0 + 1 && j < y1 - 1 && (canalsJ.includes(j) || canalsI.includes(i));
        if (canal && !square) m.set(i, j, street ? "wood" : "water", street ? 1 : 0);
        else m.set(i, j, inside && (street || square) ? "plaza" : inside && hash2(i, j, 154) > 0.84 ? "dirt" : "grass", 1);
        fix(i, j, 1);
      }
  }
  site([547, 527], 5, "plaza", 1, 0.4); // Hailing's quay
  // the Ten Halls: level ground inside its walls, a marble square, paved streets to the east and south gates, the sparring ring, and the selection field outside
  {
    const { x0, y0, x1, y1, c } = HALLS;
    for (let j = y0 - 3; j <= y1 + 3; j++)
      for (let i = x0 - 3; i <= x1 + 3; i++) {
        if (m.kind(i, j) === "void") continue;
        const inside = i > x0 && i < x1 && j > y0 && j < y1;
        const square = Math.abs(i - c[0]) <= 4 && Math.abs(j - c[1]) <= 4;
        const street = (Math.abs(j - c[1]) <= 1 && i >= c[0]) || (Math.abs(i - c[0]) <= 1 && (j >= c[1] || j >= GREAT_HALL_AT[1] + 2));
        const ring = Math.hypot(i - RING.c[0], j - RING.c[1]) <= RING.r;
        m.set(i, j, inside && square ? "marble" : inside && (street || ring) ? (ring ? "dirt" : "plaza") : inside && hash2(i, j, 158) > 0.9 ? "meadow" : "grass", 1);
        fix(i, j, 1);
      }
    site(FIELD.c, FIELD.r, "dirt", 1, 0.8);
  }
  site([590, 482], 6.4, "sand", 1, 0.8); // Saltwind
  // the City of Nine Tiers: the mud flats at its foot, nine terraces two levels apart round its summit, and the avenue's stairs up the north face (see world/tiers.ts)
  {
    const SURFACE: TileKind[] = ["dirt", "plaza", "plaza", "marble", "plaza", "marble", "meadow", "marble", "plaza", "marble"];
    const [fx0, fy0, fx1, fy1] = FLATS;
    for (let j = fy0; j < fy1; j++)
      for (let i = fx0; i < fx1; i++) {
        const k = tierAt(i, j);
        const avenue = i >= AVENUE[0] && i <= AVENUE[1] && j < TIANJIE_C[1];
        if (k < 0) m.set(i, j, hash2(i, j, 160) > 0.82 ? "dirt" : hash2(i, j, 161) > 0.9 ? "moss" : "grass", 1);
        else m.set(i, j, avenue ? "plaza" : k === 0 && hash2(i, j, 162) > 0.7 ? "grass" : SURFACE[k], tierHeight(k));
        fix(i, j, 1);
      }
    for (let k = 1; k < TIER_COUNT; k++) for (let i = AVENUE[0]; i <= AVENUE[1]; i++) m.set(i, stairRow(k), "stairs", tierHeight(k - 1) + 1);
    site(STAIR_RING.c, STAIR_RING.r, "dirt", 1, 0.3);
  }

  // 5. rivers, ponds, the hot spring and the lava pools
  for (const r of RIVERS)
    stroke(r.pts, r.width, (i, j) => {
      if (m.kind(i, j) === "void") return;
      m.set(i, j, r.kind, 0);
      fix(i, j, 2);
    });
  const pool = (x: number, y: number, r: number, kind: TileKind, seed: number) => {
    m.disc(x, y, r, kind, 0, 0.4, seed);
    m.each((i, j) => {
      if (Math.hypot(i - x, j - y) < r + 2 && LIQUID[m.kind(i, j)]) fix(i, j, 2);
    });
  };
  pool(...toCoarse("bamboo", -2.5, 19.5), 2.8, "water", 70);
  pool(...toCoarse("valley", 34, 8), 2.2, "lava", 71);
  pool(252, 192, 2.6, "water", 72);
  pool(56, 191, 2.4, "lava", 73);
  pool(60, 231, 2.6, "lava", 74);
  // still black pools out in the marshland, and the steppe's watering hole
  for (const [x, y, r, seed] of [
    [24, 262, 3, 75],
    [104, 352, 3.4, 76],
    [22, 410, 3.8, 77],
    [112, 432, 2.8, 78],
    [420, 204, 2.6, 79],
  ] as [number, number, number, number][])
    pool(x, y, r, "water", seed);
  // the lagoon round Returning Cloud Isle, and the isle in it
  pool(ISLE.c[0], ISLE.c[1], ISLE.lagoon, "water", 155);
  m.disc(ISLE.c[0], ISLE.c[1], ISLE.r, "grass", 1, 0.6, 156);
  m.disc(ISLE.c[0], ISLE.c[1], 2.4, "plaza", 1, 0, 1);
  for (let j = ISLE.c[1] - 9; j <= ISLE.c[1] + 9; j++)
    for (let i = ISLE.c[0] - 9; i <= ISLE.c[0] + 9; i++) if (Math.hypot(i - ISLE.c[0], j - ISLE.c[1]) < ISLE.r + 1 && m.kind(i, j) !== "void" && !LIQUID[m.kind(i, j)]) fix(i, j, 1);
  // sandy banks along the wild stretches of the rivers
  m.each((i, j) => {
    if (fixed[j * COARSE_W + i] || LIQUID[m.kind(i, j)] || m.kind(i, j) === "void") return;
    const wet = [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => m.kind(i + a, j + b) === "water"));
    if (wet && !ashen(i, j)) m.set(i, j, "sand", 1);
  });

  // 6. the highway and its branches (wooden bridges over water, stone over lava)
  const road = (pts: [number, number][], width: number, height: (i: number, j: number) => number) =>
    stroke(pts, width, (i, j) => {
      if (m.kind(i, j) === "void") return;
      const k = m.kind(i, j);
      m.set(i, j, LIQUID[k] === "lava" ? "plaza" : LIQUID[k] ? "wood" : ashen(i, j) ? "redrock" : "dirt", height(i, j));
      fix(i, j, 2);
    });
  road(HIGHWAY, 2.4, () => 1);
  // the Rainbow Bridge: planks laid across the gorge the great waterfall pours into
  stroke(HIGHWAY.filter(([x]) => x >= GORGE[0] - 4 && x <= GORGE[1] + 4), 2.4, (i, j) => {
    if (i < GORGE[0] || i > GORGE[1] || m.kind(i, j) !== "void") return;
    m.set(i, j, "wood", 1);
    fix(i, j, 2);
  });
  // the Nine-Arch Bridge: planks across the strait of cloud from the cliffs below Jinhe to the foot of the City of Nine Tiers
  for (let j = 540; j < FLATS[1] + 2; j++)
    for (let i = AVENUE[0]; i <= AVENUE[1]; i++) {
      if (m.kind(i, j) !== "void" && j > 552) continue;
      if (m.kind(i, j) === "void") m.set(i, j, "wood", 1);
      fix(i, j, 2);
    }
  const [, valleyY] = toCoarse("valley", 0, 31);
  for (const b of BRANCHES) road(b.pts, 2.2, (i, j) => (b.valley && j <= valleyY + 2 ? 2 : 1));
  // roads up onto the heights, climbing a level every few tiles (stone steps on the steep parts)
  const ramp = (pts: [number, number][], width: number, h0: number, h1: number) => {
    let total = 0;
    for (let p = 1; p < pts.length; p++) total += Math.hypot(pts[p][0] - pts[p - 1][0], pts[p][1] - pts[p - 1][1]);
    const seen = new Set<number>();
    let run = 0;
    for (let p = 1; p < pts.length; p++) {
      const [x0, y0] = pts[p - 1];
      const [x1, y1] = pts[p];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const steps = Math.ceil(len * 4);
      for (let st = 0; st <= steps; st++) {
        const cx = x0 + ((x1 - x0) * st) / steps;
        const cy = y0 + ((y1 - y0) * st) / steps;
        const h = Math.round(h0 + ((h1 - h0) * (run + (len * st) / steps)) / total);
        for (let j = Math.floor(cy - width); j <= Math.ceil(cy + width); j++)
          for (let i = Math.floor(cx - width); i <= Math.ceil(cx + width); i++) {
            if (Math.hypot(i - cx, j - cy) > width / 2 + 0.2 || seen.has(j * COARSE_W + i) || m.kind(i, j) === "void") continue;
            seen.add(j * COARSE_W + i);
            m.set(i, j, h0 === h1 ? (ashen(i, j) ? "redrock" : "dirt") : "stairs", h);
            fix(i, j, 2);
          }
      }
      run += len;
    }
  };
  // to the Scarlet Phoenix: along the red flats to the mine, and up the mesa's western stair
  road([[512, 372], [540, 375], [560, 379], [571, 381]], 2.2, () => 2);
  ramp([[558, 364], [568, 366], [580, 369]], 2.2, 2, 7);
  road([[548, 376], [556, 366], [558, 364]], 2.2, () => 2);
  // into Hundred Herb Valley from the southern road
  road([[72, 315], [72, 340], [64, 366], [54, 384]], 2.2, () => 1);
  // out from Frostveil to the Sword Sea Pavilion, then the long stair up its crag
  road([[494, 97], [520, 104], [548, 110], [570, 112]], 2.2, () => 3);
  ramp([[570, 112], [582, 113], [594, 115]], 2.2, 3, 10);
  // the old stair down the crag to the ledge of the Sword Sea
  ramp([[605, 120], [609, 123], [613, 126]], 2, 10, 5);
  // a track from the south road to the foot of the Dragonspine
  road([[195, 258], [208, 260], [220, 262]], 2.2, () => 1);
  // the village's north road runs on to the mainland's edge…
  const [gx, gy] = toCoarse("sect", 15, 27);
  const [, vy] = toCoarse("village", 0, 4);
  const onIsle = (i: number, j: number) => ISLES.some((s) => Math.hypot(i - s.c[0], j - s.c[1]) < s.r - 0.6);
  for (let j = gy; j <= vy; j++)
    for (let i = gx - 1; i <= gx + 1; i++) {
      if (onIsle(i, j)) continue;
      const land = mainlandMask(i, j) && j > gy + 20;
      // …where a sky bridge, resting on Cloudrest Isle half way, climbs to the sect gate,
      m.set(i, j, land ? "dirt" : j === gy ? "dirt" : "wood", land ? 1 : 2);
      fix(i, j, 2);
    }
  // a second one leads from behind the Hall of Clouds up to the peak,
  const [, sy0] = toCoarse("sect", 0, 0);
  for (let j = sy0 - 5; j <= sy0 + 2; j++)
    for (let i = gx + 1; i <= gx + 3; i++) {
      m.set(i, j, j <= sy0 - 5 ? "marble" : "wood", j <= sy0 - 3 ? 3 : 4);
      fix(i, j, 2);
    }
  // and plank walkways run east from the sect's lotus pond out to the Cloudstep Isles.
  const [dx, dy] = toCoarse("sect", 26, 16);
  const walkway = (pts: [number, number][], width: number) =>
    stroke(pts, width, (i, j) => {
      if (m.kind(i, j) !== "void") return;
      m.set(i, j, "wood", 2);
      fix(i, j, 2);
    });
  walkway([[dx, dy], [ISLES[1].c[0] - 2, ISLES[1].c[1] + 1]], 2.4);
  walkway([[ISLES[1].c[0] + 2, ISLES[1].c[1] - 2], [ISLES[2].c[0] - 1, ISLES[2].c[1] + 1]], 2.2);
  // and out from the sect's rim to its terraces
  walkway([toCoarse("sect", 4, 15), [ISLES[3].c[0] + 6, ISLES[3].c[1]]], 2.2);
  walkway([toCoarse("sect", 7, 7), [ISLES[4].c[0] + 4, ISLES[4].c[1] + 2]], 2.2);
  walkway([toCoarse("sect", 7, 24), [ISLES[5].c[0] + 4, ISLES[5].c[1] - 2]], 2.2);

  // 7. keep the wilds walkable: no tile rises or falls more than a level per
  // tile away from a region, road or river (multi-source distance fields)
  const lo = new Float32Array(COARSE_W * COARSE_H).fill(-99);
  const hi = new Float32Array(COARSE_W * COARSE_H).fill(99);
  const q: number[] = [];
  m.each((i, j) => {
    const idx = j * COARSE_W + i;
    if (!fixed[idx] || m.kind(i, j) === "void") return;
    const h = m.height(i, j);
    lo[idx] = LIQUID[m.kind(i, j)] ? -99 : h;
    hi[idx] = h;
    q.push(idx);
  });
  for (let qi = 0; qi < q.length; qi++) {
    const idx = q[qi];
    const i = idx % COARSE_W;
    const j = (idx / COARSE_W) | 0;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      if (!m.inside(ni, nj) || m.kind(ni, nj) === "void" || fixed[nj * COARSE_W + ni]) continue;
      const n = nj * COARSE_W + ni;
      const nlo = lo[idx] - 1;
      const nhi = hi[idx] + 1;
      if (nlo > lo[n] || nhi < hi[n]) {
        lo[n] = Math.max(lo[n], nlo);
        hi[n] = Math.min(hi[n], nhi);
        q.push(n);
      }
    }
  }
  m.each((i, j) => {
    const idx = j * COARSE_W + i;
    if (fixed[idx] || m.kind(i, j) === "void") return;
    const h = m.height(i, j);
    m.set(i, j, undefined, Math.round(Math.max(lo[idx], Math.min(hi[idx], h))));
  });
  // snow only caps the higher highland hills, and the tall peaks of the ranges wear it too (or bare red rock in the dry lands)
  m.each((i, j) => {
    const idx = j * COARSE_W + i;
    if (fixed[idx]) return;
    const k = m.kind(i, j);
    const h = m.height(i, j);
    if (k === "snow" && h < 3) m.set(i, j, "grass");
    else if (h >= 7 && !LIQUID[k] && k !== "void" && (fbm(i * 0.4, j * 0.4, 77) > 0.35 || h >= 8)) m.set(i, j, ashen(i, j) ? "redrock" : "snow");
    else if (h >= 6 && (k === "grass" || k === "meadow" || k === "leaf") && fbm(i * 0.3, j * 0.3, 78) > 0.55) m.set(i, j, "moss");
  });

  // 8. the landmarks: their buildings, keepers, beasts and treasures
  const P = (id: PropId, i: number, j: number) => props.push({ id, i, j });
  const it = (key: string, kind: Interactable["kind"], i: number, j: number, text?: string) => {
    interacts.push({ key, kind, i, j, text });
    if (kind === "sign") P(key.includes("stele") ? "stele" : "sign", i, j);
    else if (kind === "shrine" || kind === "chest" || kind === "herb") P(kind, i, j);
  };
  const landmarks: Landmark[] = [];
  const mark = (key: string, name: string, hanzi: string, icon: PropId, x: number, y: number) => landmarks.push({ key, name, hanzi, icon, x, y });

  // Cloudrest Isle, half way down the sky bridge
  {
    const [x, y] = ISLES[0].c;
    it("cloudrest-shrine", "shrine", x - 3, y - 1);
    P("lantern", x + 3, y - 2);
    P("lantern", x - 3, y + 2);
    P("pine", x + 3, y + 2);
    it("cloudrest-stele", "sign", x + 2, y - 3, "Cloudrest Isle. “Here the sect's founder paused on her way down to the mortal world, and planted a pine so that every traveller after her would have shade.”");
    critters.push({ key: "crane-cr", char: "crane", i: x + 2, j: y + 3 });
    mark("cloudrest", "Cloudrest Isle", "云憩岛", "shrine", x, y);
  }
  // the Cloudstep Isles, east of the sect
  {
    const [ax, ay] = ISLES[1].c;
    P("pagoda", ax, ay - 1);
    P("cherry", ax - 3, ay - 3);
    P("cherry", ax + 3, ay + 3);
    it("isle-herb", "herb", ax + 2, ay + 2);
    const [bx, by] = ISLES[2].c;
    npcs.push({ key: "yun", char: "hermit", i: bx, j: by - 1, dir: 1, anim: "meditate" });
    it("isle-chest", "chest", bx + 2, by + 1);
    it("isle-stele", "sign", bx - 2, by - 2, "Carved in a hand that wanders like clouds: “Ten thousand li of sky, and still the heart is the hardest place to reach.”");
    critters.push({ key: "crane-is", char: "crane", i: bx + 1, j: by + 2 });
    mark("cloudstep", "Cloudstep Isles", "云阶岛", "pagoda", ax + 6, ay - 4);
  }
  // the teahouse at the southern crossroads
  {
    P("teahouse", 145, 170);
    npcs.push({ key: "fang", char: "teawoman", i: 147, j: 173, dir: 1 });
    P("bench", 153, 171);
    P("bench", 153, 174);
    P("prayerflags", 146, 175);
    P("redlantern", 144, 173);
    P("lanterns", 150, 168);
    it("tea-shrine", "shrine", 155, 175);
    it("tea-sign", "sign", 153, 169, "The crossroads teahouse. ← West: the Whispering Bamboo Forest, and beyond the red mist the Crimson Demon Valley. → East: Willow Creek and the Moonlit Lotus Lake. ↓ South: the stone forest and the ruined temple.");
    mark("teahouse", "Crossroads Teahouse", "茶馆", "teahouse", 150, 171);
  }
  // the watermill on the creek east of Willow Creek
  {
    P("house", 234, 108);
    // the wheel dips into the creek's first water tile below the mill
    let wheel: [number, number] = [237, 118];
    for (let j = 112; j < 125; j++)
      if (LIQUID[m.kind(237, j)] === "water") {
        wheel = [237, j];
        break;
      }
    P("waterwheel", ...wheel);
    npcs.push({ key: "tang", char: "miller", i: 233, j: 113, dir: 2, anim: "idle", wander: 1.2 });
    P("haystack", 230, 114);
    P("fence", 229, 116);
    P("fence", 230, 116);
    it("mill-herb", "herb", 227, 114);
    mark("mill", "Watermill", "水磨坊", "waterwheel", 234, 114);
  }
  // the ruined temple in the stone forest
  {
    const [x, y] = [106, 206];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + 0.3;
      if (k === 2) continue;
      P("ruin", Math.round(x + Math.cos(a) * 5.4), Math.round(y + Math.sin(a) * 5.4));
    }
    it("temple-shrine", "shrine", x, y - 2);
    it("temple-stele", "sign", x - 3, y + 2, "The Temple of Still Water. Its name is still legible on the cracked lintel; the rest was burned in the war of the Blood Moon, two hundred years ago.");
    it("temple-chest", "chest", x + 3, y + 3);
    it("temple-herb", "herb", x + 9, y - 6);
    P("lantern", x - 2, y - 2);
    P("lantern", x + 2, y - 2);
    P("bell", x - 3, y - 4);
    npcs.push({ key: "kong", char: "monk", i: x + 1, j: y + 1, dir: 2, anim: "sweep" });
    enemies.push({ key: "temple-jiangshi-1", enemy: "jiangshi", i: x - 9, j: y + 7, range: 2 }, { key: "temple-jiangshi-2", enemy: "jiangshi", i: x + 11, j: y + 4, range: 2 });
    mark("temple", "Temple of Still Water", "静水寺", "ruin", x, y);
  }
  // the pagoda hill among the scarecrow fields
  {
    const [x, y] = [190, 203];
    P("pagoda", x, y);
    P("lantern", x - 3, y - 3);
    P("lantern", x + 3, y + 2);
    it("pagoda-stele", "sign", x + 3, y - 3, "The Pagoda of Seven Lamps, raised by the farmers of the south so that the immortals in the clouds would see their fields at night — and remember them.");
    it("pagoda-herb", "herb", x - 3, y + 3);
    for (const [i, j] of [
      [204, 181],
      [212, 181],
      [199, 178],
      [207, 186],
    ] as [number, number][])
      P("scarecrow", i, j);
    npcs.push({ key: "wu", name: "Farmer Wu", char: "farmer", i: 196, j: 186, dir: 3, wander: 1.5 });
    critters.push({ key: "crane-f1", char: "crane", i: 203, j: 177 }, { key: "crane-f2", char: "crane", i: 211, j: 184 });
    mark("pagoda", "Pagoda of Seven Lamps", "七灯塔", "pagoda", x, y);
  }
  // the highland hot spring, where a swordsman rests his feet
  {
    const [x, y] = [252, 192];
    for (const [dx2, dy2] of [
      [-3, -2],
      [3, -1],
      [-2, 3],
    ])
      P("steam", x + dx2, y + dy2);
    npcs.push({ key: "han", char: "swordsman", i: x + 4, j: y - 3, dir: 1, anim: "sleep" });
    it("spring-herb-1", "herb", x - 4, y + 1);
    it("spring-herb-2", "herb", x + 1, y - 4);
    P("pine", x - 5, y - 4);
    P("boulder", x + 5, y + 3);
    mark("spring", "Highland Hot Spring", "温泉", "steam", x, y);
  }
  // the bandits' camp in the high pines
  {
    const [x, y] = [292, 207];
    P("tent", x - 3, y - 3);
    P("tent", x + 3, y - 3);
    P("tent", x + 4, y + 2);
    P("campfire", x, y);
    P("banner", x - 4, y + 2);
    it("bandit-chest", "chest", x + 1, y + 4);
    enemies.push(
      { key: "bandit-1", enemy: "bandit", i: x - 2, j: y + 2, range: 2 },
      { key: "bandit-2", enemy: "bandit", i: x + 2, j: y - 1, range: 2 },
      { key: "bandit-3", enemy: "bandit", i: x - 8, j: y - 5, range: 2.5 },
      { key: "high-wolf-1", enemy: "wolf", i: 276, j: 214, range: 2.5 },
      { key: "high-wolf-2", enemy: "wolf", i: 306, j: 196, range: 2.5 },
    );
    mark("bandits", "Bandit Camp", "山寨", "tent", x, y);
  }
  // the Blood Moon Sect's outpost in the ashen wastes
  {
    const [x, y] = [34, 200];
    P("tent", x - 3, y - 2);
    P("tent", x + 3, y - 3);
    P("brazier", x - 1, y + 3);
    P("brazier", x + 3, y + 2);
    P("bones", x - 4, y + 3);
    it("camp-chest", "chest", x, y - 4);
    it("camp-stele", "sign", x + 1, y + 1, "A cultist's orders, pinned under a stone: “Gather blood-ash for the Patriarch's altar. Any who wander south of the highway are to be fed to the lava.”");
    enemies.push({ key: "camp-cultist-1", enemy: "cultist", i: x - 2, j: y + 1, range: 2 }, { key: "camp-cultist-2", enemy: "cultist", i: x + 4, j: y - 1, range: 2 });
    critters.push({ key: "bat-w2", char: "bat", i: x + 2, j: y - 6 }, { key: "bat-w3", char: "bat", i: 58, j: 205 });
    mark("camp", "Blood Moon Camp", "血月营", "brazier", x, y);
  }

  // the Sword Tomb in the westwood, where an old smith keeps the swords of the fallen
  {
    const [x, y] = [83, 108];
    P("swordtomb", x - 1, y - 2);
    P("forge", x + 4, y + 2);
    P("house", x - 6, y + 1);
    P("lantern", x - 2, y + 4);
    P("lantern", x + 2, y - 5);
    P("banner", x + 5, y - 3);
    npcs.push({ key: "ou", char: "smith", i: x + 3, j: y + 4, dir: 3, anim: "hammer" });
    // and, if she talked him home, the boy he made Dawnfrost for, oiling the swords of the fallen
    npcs.push({ key: "xueming", name: "Xue Ming", char: "patriarch", i: x - 2, j: y + 5, dir: 2, anim: "sweep", when: (f) => !!f.xueRedeemed, outfit: () => "redeemed" });
    it("tomb-stele", "sign", x + 1, y + 3, "The Sword Tomb. “Here rest the swords of those who held the west against the Blood Moon. Their names are on the blades. Their bones are in the valley. Walk softly.”");
    it("tomb-shrine", "shrine", x - 4, y - 4);
    it("tomb-chest", "chest", x + 5, y - 5);
    it("tomb-herb", "herb", x - 6, y + 5);
    enemies.push({ key: "tomb-wolf-1", enemy: "wolf", i: x - 10, j: y + 9, range: 2 }, { key: "tomb-wolf-2", enemy: "wolf", i: x + 11, j: y + 7, range: 2 });
    critters.push({ key: "crane-st", char: "crane", i: x + 8, j: y - 4 });
    mark("swordtomb", "Sword Tomb", "剑冢", "swordtomb", x, y);
  }
  // the Moon-Gazing Pavilion north of the creek, where a scholar once watched the moon with a fox
  {
    const [x, y] = [150, 101];
    P("pavilion", x, y - 1);
    P("grave", x - 4, y + 1);
    P("wisps", x - 3, y + 3);
    P("willow", x + 4, y + 2);
    P("willow", x - 5, y - 3);
    P("lantern", x + 2, y + 3);
    npcs.push(
      { key: "pei", char: "ghost", i: x - 2, j: y + 2, dir: 2, anim: "float", when: (f) => !!f.metHuli && !f.peiAtRest },
      { key: "huliPav", char: "huli", i: x - 1, j: y + 3, dir: 14, when: (f) => !!f.huliLetter && !f.peiAtRest },
    );
    it("pavilion-stele", "sign", x + 2, y - 3, "A poem carved into the pavilion's post, the strokes worn soft: “The moon on the creek is the same moon over the capital. Wherever I am, look up, and we are looking at each other.”");
    it("pavilion-herb", "herb", x + 5, y - 2);
    mark("pavilion", "Moon-Gazing Pavilion", "望月亭", "pavilion", x, y);
  }
  // the peach orchard east of the lake, its trees grown from a stone the founder threw away
  {
    const [x, y] = [304, 150];
    for (const [dx2, dy2] of [
      [-4, -3],
      [-1, -4],
      [2, -3],
      [-4, 1],
      [4, 0],
      [-2, 4],
      [3, 4],
    ] as [number, number][])
      P("peachtree", x + dx2, y + dy2);
    P("beehive", x + 5, y - 4);
    P("beehive", x + 6, y - 2);
    P("house", x - 7, y - 2);
    P("fence", x - 6, y + 3);
    P("fence", x - 5, y + 3);
    P("haystack", x + 6, y + 3);
    npcs.push({ key: "rong", char: "orchardist", i: x, j: y + 1, dir: 2, wander: 1.5 });
    it("orchard-sign", "sign", x + 1, y + 6, "Rong's Peach Orchard. “Peaches for travellers: take one, leave a story.” Below, in a child's hand: “Peddler Bai owes three peaches.”");
    it("orchard-chest", "chest", x + 7, y + 5);
    it("orchard-herb", "herb", x - 6, y - 6);
    critters.push({ key: "crane-or", char: "crane", i: x - 3, j: y + 7 });
    mark("orchard", "Peach Orchard", "桃园", "peachtree", x, y);
  }
  // Willow Creek's market road: houses, stalls and folk all the way down to the highway, under a paifang arch
  {
    for (const [i, j] of [
      [186, 136],
      [186, 142],
      [186, 149],
      [196, 138],
      [196, 146],
      [196, 152],
    ] as [number, number][])
      P("house", i, j);
    P("gate", 192, 158);
    P("lanterns", 192, 134);
    P("lanterns", 192, 151);
    P("redlantern", 190, 147);
    P("redlantern", 194, 141);
    P("stall", 194, 134);
    P("stall", 194, 135);
    P("noodlecart", 189, 140);
    P("well", 182, 146);
    P("cart", 183, 140);
    P("barrels", 194, 155);
    P("laundry", 183, 152);
    P("butterflies", 181, 150);
    P("fountain", 189, 155);
    npcs.push(
      { key: "marketporter", name: "Porter Kang", char: "porter", i: 192, j: 145, dir: 0, anim: "carry", route: [[192.5, 132.5], [192.5, 161.5]] },
      { key: "ba", char: "woodcutter", i: 183, j: 137, dir: 4, anim: "chop" },
      { key: "shun", char: "boy", i: 189, j: 152, dir: 2, anim: "kick", outfit: festive },
      { key: "lianhua", name: "Lianhua", char: "villagerF", i: 190, j: 144, dir: 2, wander: 1, outfit: festive },
      { key: "hawker", name: "Hawker Sun", char: "villagerM", i: 194, j: 137, dir: 6 },
      { key: "willowguard", name: "Watchman Tie", char: "guard", i: 190, j: 159, dir: 2 },
      { key: "noodleseller", name: "Noodle Seller Ma", char: "cook", i: 189, j: 142, dir: 4 },
    );
    // under the willows, the old men's xiangqi; buns steaming by the noodle cart; a pinwheel seller; and at festival time, the lion and the firecrackers
    P("xiangqitable", 183, 144);
    P("steamer", 191, 138);
    P("pinwheels", 195, 143);
    props.push({ id: "firecrackers", i: 190, j: 150, when: (f) => !!f.heartReturned }, { id: "skylanterns", i: 194, j: 150, when: (f) => !!f.heartReturned });
    npcs.push(
      ...STREET_FOLK.filter((f) => f.town === "willow").map((f): NpcPlacement => ({ key: f.key, name: f.name, char: f.char, i: f.at[0], j: f.at[1], dir: f.dir, anim: f.anim, when: f.festival ? (fl) => !!fl.heartReturned : undefined, outfit: festive })),
    );
    it("market-sign", "sign", 194, 160, "Willow Creek market road. “Noodles, firewood, gossip. Fresh every morning, except the gossip, which is fresh every hour.”");
  }
  // the Azure Cloud Sect's terraces: the disciples' court, the taiji yard and the sword garden
  {
    const [cx, cy] = ISLES[3].c;
    P("house", cx - 4, cy - 4);
    P("house", cx - 4, cy + 2);
    P("house", cx + 1, cy + 5);
    P("pagoda", cx + 3, cy - 5);
    P("well", cx - 2, cy - 1);
    P("noodlecart", cx + 4, cy + 3);
    P("laundry", cx - 2, cy + 7);
    P("lantern", cx + 5, cy - 2);
    P("lantern", cx + 5, cy + 2);
    P("cherry", cx - 7, cy);
    npcs.push(
      { key: "pang", char: "cook", i: cx + 3, j: cy + 2, dir: 2 },
      { key: "chen", name: "Disciple Chen", char: "discipleM", i: cx + 1, j: cy - 3, dir: 2, anim: "kick" },
      { key: "xiu", name: "Disciple Xiu", char: "discipleF", i: cx, j: cy + 1, dir: 6, wander: 1.5 },
    );
    it("court-stele", "sign", cx + 6, cy + 1, "The Disciples' Court. “Lights out at the second watch. No sword practice in the dormitories. No flying to breakfast.” Someone has added: “No kicking shuttlecocks at the cook.”");
    const [tx, ty] = ISLES[4].c;
    P("drum", tx - 4, ty - 3);
    P("censer", tx, ty - 4);
    P("fountain", tx + 4, ty - 2);
    P("pine", tx - 5, ty + 2);
    npcs.push(
      { key: "qiu", char: "taiji", i: tx, j: ty - 1, dir: 2, anim: "taichi" },
      { key: "wei", name: "Disciple Wei", char: "discipleM", i: tx - 2, j: ty + 2, dir: 2, anim: "taichi" },
      { key: "rou", name: "Disciple Rou", char: "discipleF", i: tx + 2, j: ty + 2, dir: 2, anim: "taichi" },
    );
    const [sx, sy] = ISLES[5].c;
    P("target", sx - 3, sy - 3);
    P("target", sx, sy - 4);
    P("target", sx + 3, sy - 3);
    P("dummy", sx - 4, sy + 2);
    P("bell", sx + 4, sy + 3);
    P("banner", sx - 2, sy + 4);
    npcs.push({ key: "jian", name: "Disciple Jian", char: "discipleM", i: sx - 1, j: sy, dir: 8, anim: "practice" }, { key: "su2", name: "Disciple Su", char: "discipleF", i: sx + 2, j: sy + 1, dir: 8, anim: "practice" });
    it("garden-herb", "herb", sx + 1, sy + 4);
    mark("terraces-sect", "Sect Terraces", "宗门台", "pagoda", cx, cy);
  }
  // the Rainbow Bridge over the gorge, with a paifang at its eastern end
  {
    P("gate", 353, 166);
    P("lantern", 313, 163);
    P("lantern", 313, 169);
    P("lantern", 351, 163);
    P("lantern", 351, 169);
    it("bridge-stele", "sign", 310, 162, "The Rainbow Bridge. “When the great waterfall catches the morning sun, the bridge stands in a rainbow, and travellers who cross it then are said to have good fortune for a year.” → East: the steppe, Frostveil Monastery and Wavecrest Harbour.");
    it("bridge-shrine", "shrine", 355, 162);
    mark("rainbow", "Rainbow Bridge", "虹桥", "gate", 332, 166);
  }
  // the herders' camp on the eastern steppe
  {
    const [x, y] = [470, 166];
    P("tent", x - 3, y - 3);
    P("tent", x + 3, y - 3);
    P("tent", x + 4, y + 3);
    P("campfire", x, y);
    P("banner", x - 4, y + 2);
    P("fence", x - 5, y + 4);
    P("fence", x - 4, y + 4);
    npcs.push({ key: "herder", name: "Herder Altan", char: "villagerM", i: x - 2, j: y + 2, dir: 2, wander: 1 }, { key: "oyun", name: "Oyun", char: "villagerF", i: x + 2, j: y + 1, dir: 14, anim: "pour" });
    it("steppe-chest", "chest", x + 6, y - 1);
    critters.push(...([[480, 180], [483, 183], [478, 186], [486, 179]] as [number, number][]).map(([i, j], k): Critter => ({ key: `horse-steppe-${k}`, char: "horse", i, j })));
    mark("steppe", "Herders' Camp", "牧民营", "tent", x, y);
  }
  // the woodcutters' lodge in the maple woods
  {
    const [x, y] = [430, 282];
    P("house", x - 5, y - 3);
    P("cart", x + 3, y - 2);
    P("sacks", x + 4, y + 2);
    P("campfire", x + 1, y + 3);
    P("lantern", x - 1, y - 4);
    npcs.push({ key: "gao", name: "Woodcutter Gao", char: "villagerM", i: x, j: y + 1, dir: 4, anim: "chop" });
    it("lodge-herb", "herb", x - 4, y + 4);
    mark("lodge", "Woodcutters' Lodge", "伐木屋", "house", x, y);
  }
  // the plum blossom shrine in the southern hills, where a poet comes to write
  {
    const [x, y] = [132, 400];
    P("pavilion", x - 1, y - 2);
    P("fountain", x + 4, y + 2);
    P("butterflies", x - 4, y + 3);
    P("lantern", x + 3, y - 3);
    for (const [dx2, dy2] of [
      [-5, -4],
      [5, -5],
      [-6, 1],
      [6, 4],
      [-2, 6],
    ] as [number, number][])
      P("cherry", x + dx2, y + dy2);
    npcs.push({ key: "yan", name: "Poet Yan", char: "lady", i: x + 1, j: y + 2, dir: 2, anim: "umbrella" });
    it("plum-shrine", "shrine", x - 4, y - 1);
    it("plum-stele", "sign", x + 2, y - 4, "A poem brushed on a board under the eaves: “The plum does not wait for spring. It blooms in the snow, and spring comes running to catch up.”");
    mark("plum", "Plum Blossom Shrine", "梅花祠", "cherry", x, y);
  }
  // the red cliff hideout in the badlands, where the desert raiders lie up
  {
    const [x, y] = [524, 400];
    P("tent", x - 3, y - 3);
    P("tent", x + 3, y - 3);
    P("campfire", x, y);
    P("banner", x + 4, y + 2);
    P("barrels", x - 4, y + 2);
    it("redcliff-chest", "chest", x + 1, y + 4);
    enemies.push(
      { key: "cliff-bandit-1", enemy: "bandit", i: x - 2, j: y + 2, range: 2 },
      { key: "cliff-bandit-2", enemy: "bandit", i: x + 2, j: y - 1, range: 2 },
      { key: "cliff-bandit-3", enemy: "bandit", i: x - 6, j: y - 5, range: 2.5 },
    );
    mark("redcliff", "Red Cliff Hideout", "赤崖寨", "tent", x, y);
  }
  // the wayside inn on the southern road
  {
    const [x, y] = [110, 300];
    P("house", x - 4, y - 3);
    P("bench", x + 3, y - 2);
    P("noodlecart", x + 2, y + 2);
    P("redlantern", x - 1, y + 2);
    P("lanterns", x, y - 4);
    npcs.push({ key: "innkeeper", name: "Innkeeper Zhao", char: "villagerF", i: x, j: y + 1, dir: 2, wander: 1 }, { key: "restporter", name: "Porter Lao", char: "porter", i: x + 3, j: y, dir: 6, anim: "eat" });
    mark("inn", "Wayside Inn", "客栈", "house", x, y);
  }
  // the Scarlet Phoenix Sect on its mesa in the red badlands
  {
    const [x, y] = [586, 372];
    P("hall", x + 1, y - 5);
    P("phoenixstatue", x - 3, y - 1);
    P("phoenixstatue", x + 3, y - 1);
    P("phoenixbanner", x - 4, y + 3);
    P("phoenixbanner", x + 4, y + 3);
    P("brazier", x - 2, y + 2);
    P("brazier", x + 2, y + 2);
    P("tent", x - 5, y - 2);
    P("dummy", x + 5, y - 1);
    P("torch", x - 1, y + 5);
    P("torch", x + 1, y + 5);
    npcs.push(
      { key: "yanhuo", char: "yanhuo", i: x, j: y + 4, dir: 0 },
      { key: "zhuque", name: "Disciple Zhu Que", char: "phoenix", i: x - 3, j: y + 4, dir: 2, anim: "flame", when: (f) => !f["phx:fed"] },
      { key: "phxchi", name: "Disciple Chi Yan", char: "phoenix", i: x + 4, j: y + 1, dir: 6, anim: "practice" },
      { key: "phxluo", name: "Disciple Luo Huo", char: "phoenix", i: x - 4, j: y, dir: 2, anim: "torch" },
      // the miners, once she has led them out of the mine
      { key: "tie2", name: "Old Tie", char: "miner", i: 575, j: 383, dir: 14, anim: "drink", when: (f) => !!f.minersOut },
      { key: "ahshi2", name: "Miner Ah Shi", char: "miner", i: 574, j: 384, dir: 12, anim: "eat", when: (f) => !!f.minersOut },
      { key: "minerWei", name: "Miner Wei", char: "villagerM", i: 569, j: 383, dir: 2, anim: "mine" },
    );
    it("phx-stele", "sign", x + 3, y + 5, "The Scarlet Phoenix Sect. “Our founder flew down from the sun's road and landed on this mesa in a shower of sparks. The sparks are still in the rock. We dig them out and call them fire-jade.”");
    it("phx-shrine", "shrine", x - 5, y + 2);
    it("phx-chest", "chest", x - 2, y - 3);
    it("mine-sign", "sign", 575, 379, "THE EMBER MINE. “Helmets on. Water skins full. If the rock sings, run.”");
    enemies.push({ key: "phx-hound-1", enemy: "wolf", i: 552, j: 392, range: 2.5 }, { key: "phx-raider", enemy: "bandit", i: 600, j: 394, range: 2.5 });
    mark("phoenix", "Scarlet Phoenix Sect", "赤凰门", "phoenixstatue", x, y);
  }
  // Hundred Herb Valley, sheltered among its hills in the far south-west
  {
    const [x, y] = [48, 392];
    const healed = (f: Record<string, boolean>) => !!f.herbDone;
    P("furnace", x, y);
    P("house", x + 3, y - 6);
    P("house", x + 5, y - 1);
    P("herbrack", x - 2, y - 3);
    P("well", x - 4, y + 1);
    P("lantern", x - 2, y + 4);
    P("lantern", x + 2, y + 4);
    for (const [dx2, dy2] of [
      [-4, 4],
      [-2, 6],
      [1, 6],
      [3, 4],
      [5, 5],
      [-5, 6],
    ] as [number, number][]) {
      props.push({ id: "herbbed", i: x + dx2, j: y + dy2, when: healed });
      props.push({ id: "witheredbed", i: x + dx2, j: y + dy2, when: (f) => !healed(f) });
    }
    npcs.push(
      { key: "baizhi", char: "baizhi", i: x, j: y + 2, dir: 0, anim: "brew" },
      { key: "linger", char: "herbalist", i: x - 3, j: y + 3, dir: 2, anim: "gather" },
      { key: "herbHan", name: "Herbalist Han", char: "villagerM", i: x + 3, j: y + 2, dir: 6, wander: 1 },
    );
    it("herb-stele", "sign", x + 2, y - 3, "Hundred Herb Valley. “Every herb has a poison in it, and every poison a cure. Our sect only argues about which comes first.”");
    it("herb-shrine", "shrine", x - 5, y - 3);
    it("herb-chest", "chest", x + 6, y + 2);
    it("herb-herb", "herb", x - 6, y + 2);
    mark("herbvalley", "Hundred Herb Valley", "百草谷", "furnace", x, y);
  }
  // the Sword Sea Pavilion on its crag, and the ledge of the Sword Sea below it
  {
    const [x, y] = [600, 116];
    const mercy = (f: Record<string, boolean>) => !!f["swd:mercy"];
    P("pavilion", x, y - 3);
    P("banner", x - 4, y + 2);
    P("banner", x + 4, y - 1);
    P("swordrack", x - 3, y - 3);
    P("dummy", x + 3, y + 3);
    P("bell", x - 4, y - 1);
    P("lantern", x - 2, y + 4);
    P("lantern", x + 2, y + 4);
    P("swordspire", 617, 128);
    npcs.push(
      { key: "lingfeng", char: "lingfeng", i: x, j: y + 2, dir: 0 },
      { key: "wuyou", name: "Jian Wuyou", char: "swordsea", i: x - 3, j: y + 2, dir: 2, anim: "practice", when: (f) => !f.swdDone },
      { key: "wuyouSweep", name: "Jian Wuyou", char: "swordsea", i: 606, j: 121, dir: 4, anim: "sweep", when: mercy },
      { key: "tangyu", name: "Disciple Tang Yu", char: "swordsea", i: x + 3, j: y + 1, dir: 6, anim: "practice" },
      { key: "rubing", name: "Disciple Ru Bing", char: "discipleF", i: x - 1, j: y + 4, dir: 2, anim: "sweep" },
      // the exposed thief goes home to the harbour to mend nets beside his mother
      { key: "wuyouHarbor", name: "Jian Wuyou", char: "swordsea", ...xy(toCoarse("harbor", 17, 15)), dir: 2, anim: "gather", when: (f) => !!f["swd:exposed"] },
    );
    it("sword-clue", "sign", 604, 119, "Fresh scuff marks at the top of the old stair, and a scrap of oiled paper caught on a nail: the corner of a sword manual's wrapping, stamped with the Pavilion's seal.");
    it("sword-stele", "sign", x - 2, y - 5, "The Sword Sea Pavilion. “Ten thousand swords rest in the sea below the crag. A disciple who brings one up has learned nothing. A disciple who leaves it there has begun.”");
    it("sword-shrine", "shrine", 614, 125);
    it("sword-chest", "chest", 616, 129);
    enemies.push({ key: "sword-traitor", enemy: "traitor", i: 588, j: 113, range: 2, when: (f) => !!f["swd:bribed"] && !f.traitorBeaten });
    mark("swordsea", "Sword Sea Pavilion", "剑海阁", "pavilion", x, y);
  }
  // the foot of the Dragonspine, where the Dragon Vein runs nearest the surface
  {
    const [x, y] = [222, 262];
    npcs.push({ key: "dong", name: "Prospector Dong", char: "miner", i: x + 2, j: y + 3, dir: 14, anim: "mine" });
    it("vein-sign", "sign", x + 3, y + 1, "A boundary stone half sunk in the scree: “The Dragonspine. Beneath it sleeps the Dragon Vein. Three sects swore here never to dig for it. Read the oath again before you lift a pick.”");
    mark("dragonspine", "Dragonspine", "龙脊山", "cavemouth", x + 4, y - 6);
  }
  // Jinhe, the Golden River City: walls and watchtowers, a magistrate's yamen, an opera stage on the square, a
  // city-god temple, shops under their banners, an academy, a teahouse, and the busiest streets in the jianghu
  {
    const { x0, y0, x1, y1, c } = JINHE;
    const [cx, cy] = c;
    const gap = (v: number, at: number) => Math.abs(v - at) <= 1;
    for (let i = x0 + 1; i < x1; i++)
      for (const j of [y0, y1])
        if (!gap(i, cx)) P("citywall", i, j);
    for (let j = y0 + 1; j < y1; j++)
      for (const i of [x0, x1])
        if (!gap(j, cy)) P("citywallY", i, j);
    for (const i of [x0, x1]) for (const j of [y0, y1]) P("watchtower", i, j);
    P("gate", cx, y0);
    P("gate", cx, y1);
    for (const [i, j] of [
      [cx - 2, y0 + 1],
      [cx + 2, y0 + 1],
      [cx - 2, y1 - 1],
      [cx + 2, y1 - 1],
      [x0 + 1, cy - 2],
      [x0 + 1, cy + 2],
      [x1 - 1, cy - 2],
      [x1 - 1, cy + 2],
    ] as [number, number][])
      P("redlantern", i, j);
    // the north-west: the magistrate's yamen and the houses of the well-to-do
    P("hall", 213, 491);
    P("drum", 216, 494);
    P("house", 217, 489);
    P("house", 210, 495);
    P("shopflag", 220, 492);
    P("stall", 219, 495);
    P("shopflag", 220, 496);
    // the north-east: merchants' houses and the teahouse
    P("house", 225, 489);
    P("house", 229, 489);
    P("house", 233, 489);
    P("teahouse", 230, 494);
    P("stall", 226, 494);
    P("stall", 227, 494);
    P("shopflag", 224, 493);
    P("shopflag", 228, 497);
    P("bench", 234, 497);
    // the south-west: the opera stage, the forge and the lanes behind
    P("operastage", 216, 506);
    P("bench", 219, 509);
    P("bench", 220, 509);
    P("house", 210, 503);
    P("house", 210, 508);
    P("house", 214, 510);
    P("forge", 213, 504);
    P("well", 216, 503);
    P("laundry", 213, 507);
    P("barrels", 218, 511);
    // the south-east: the city-god temple, the academy and the noodle stalls
    P("pagoda", 231, 508);
    P("censer", 228, 506);
    P("bell", 234, 511);
    P("house", 233, 502);
    P("house", 225, 509);
    P("noodlecart", 226, 503);
    P("shopflag", 224, 506);
    P("stall", 229, 503);
    // the square at the crossroads
    P("fountain", cx, cy);
    P("lanterns", cx, y0 + 4);
    P("lanterns", cx, y1 - 4);
    P("lanterns", x0 + 5, cy);
    P("lanterns", x1 - 5, cy);
    P("lantern", cx - 4, cy - 4);
    P("lantern", cx + 4, cy - 4);
    P("lantern", cx - 4, cy + 4);
    P("lantern", cx + 4, cy + 4);
    npcs.push(
      { key: "magistrate", name: "Magistrate Lu", char: "scholar", i: 213, j: 494, dir: 2, anim: "read" },
      { key: "constable", name: "Constable Tie Shan", char: "guard", i: cx, j: y0 + 3, dir: 2, route: [[cx + 0.5, y0 + 2.5], [cx + 0.5, y1 - 2.5]] },
      { key: "gateguardN", name: "Gate Guard Wu", char: "guard", i: cx - 2, j: y0 + 2, dir: 0 },
      { key: "gateguardS", name: "Gate Guard Pan", char: "guard", i: cx + 2, j: y1 - 2, dir: 8 },
      { key: "alchemist", name: "Alchemist Hu Mei", char: "herbalist", i: 219, j: 497, dir: 4 },
      { key: "silk", name: "Silk Merchant Jin", char: "lady", i: 227, j: 497, dir: 2, anim: "fan" },
      { key: "fortune", name: "Fortune-Teller Ma", char: "storyteller", i: 219, j: 502, dir: 6, anim: "sit" },
      { key: "operaYu", name: "Opera Singer Yu", char: "lady", i: 219, j: 507, dir: 6, anim: "twirl" },
      { key: "operaHong", name: "Opera Singer Hong", char: "discipleF", i: 220, j: 505, dir: 6, anim: "sworddance" },
      { key: "rival", name: "Shangguan Yan", char: "swordsea", i: 225, j: 499, dir: 4, anim: "practice" },
      { key: "recruiter", name: "Recruiter Mei", char: "discipleF", i: 219, j: 499, dir: 2 },
      { key: "beggar", name: "Old Ding the Beggar", char: "refugeeM", i: cx + 3, j: y0 - 2, dir: 0, anim: "warmhands" },
      { key: "academy", name: "Academy Master Kong Wen", char: "archivist", i: 227, j: 506, dir: 2, anim: "read" },
      { key: "student", name: "Student Xu", char: "scholar", i: 229, j: 505, dir: 4, anim: "write" },
      { key: "templeNovice", name: "Novice Ji", char: "novice", i: 229, j: 510, dir: 2, anim: "sweep" },
      { key: "wineseller", name: "Auntie Qiao", char: "villagerF", i: 231, j: 497, dir: 2, anim: "pour" },
      { key: "teakeeper", name: "Teahouse Keeper Bo", char: "cook", i: 233, j: 497, dir: 4 },
      { key: "tao", name: "Little Tao", char: "child", i: 224, j: 502, dir: 6, anim: "juggle" },
      { key: "pang2", name: "Little Pang", char: "boy", i: 220, j: 503, dir: 2, anim: "kick" },
      { key: "jinporter", name: "Porter Gui", char: "porter", i: 212, j: cy, dir: 4, anim: "carry", route: [[x0 + 2.5, cy + 0.5], [x1 - 2.5, cy + 0.5]] },
      { key: "pawn", name: "Pawnbroker Qian", char: "villagerM", i: 211, j: 498, dir: 6 },
      { key: "noodlefu", name: "Noodle Seller Fu", char: "cook", i: 227, j: 502, dir: 2 },
      { key: "washer", name: "Washerwoman Liang", char: "villagerF", i: 215, j: 502, dir: 4, anim: "gather" },
      { key: "physician", name: "Physician Zhang", char: "medic", i: 215, j: 497, dir: 2 },
      { key: "clerk", name: "Clerk Hou", char: "villagerM", i: 217, j: 494, dir: 2, wander: 1.5 },
      { key: "ladyshen", name: "Lady Shen", char: "lady", i: 230, j: 499, dir: 6, anim: "umbrella", wander: 1.5 },
      { key: "apprentice", name: "Apprentice Gang", char: "villagerM", i: 214, j: 505, dir: 6, anim: "mine" },
      { key: "jinfarmer", name: "Farmer Sun", char: "villagerM", i: 223, j: 509, dir: 0, anim: "carry", route: [[cx + 1.5, cy + 3.5], [cx + 1.5, y1 + 6.5]] },
    );
    // the fair outside the north gate: a lion-dance troupe, acrobats, a puppet theatre, xiangqi under the willows, buns, pinwheels and firecrackers
    P("puppetbooth", cx - 5, y0 - 8);
    P("xiangqitable", cx + 5, y0 - 6);
    P("steamer", cx - 4, y0 - 4);
    P("pinwheels", cx + 4, y0 - 10);
    P("firecrackers", cx - 6, y0 - 12);
    P("skylanterns", cx + 6, y0 - 12);
    P("stall", cx + 3, y0 - 4);
    P("stall", cx - 3, y0 - 10);
    npcs.push(
      ...STREET_FOLK.filter((f) => f.town === "jinhe").map((f): NpcPlacement => ({ key: f.key, name: f.name, char: f.char, i: cx + f.at[0], j: y0 + f.at[1], dir: f.dir, anim: f.anim })),
    );
    it("jinhe-shrine", "shrine", 228, 509);
    it("jinhe-stele", "sign", 233, 506, "The City God of Jinhe, carved on the temple stele: “I keep the ledger of every soul within these walls. The cultivator's page is written in lightning; the porter's in sweat. Both pages weigh the same.”");
    it("jinhe-sign", "sign", cx + 2, y0 - 2, "JINHE · 金河城 · THE GOLDEN RIVER CITY. “By order of Magistrate Lu: no flying swords over the market, no duels on the square, no qi in the wells.”");
    it("jinhe-chest", "chest", 234, 492);
    it("jinhe-herb", "herb", 211, 511);
    mark("jinhe", "Jinhe, the Golden River City", "金河城", "hall", cx, cy);
  }
  // the town and the city, twice the size: Jinhe's new quarters between the old wall's line and the new, and Willow Creek's East Ward (see world/quarters.ts)
  const quarter = (q: Quarter) => {
    for (const [id, i, j] of q.props) P(id, i, j);
    for (const f of q.folk) npcs.push({ key: f.key, name: f.name, char: f.char, i: f.at[0], j: f.at[1], dir: f.dir, anim: f.anim, wander: f.wander, route: f.route });
  };
  quarter(JINHE_QUARTERS);
  quarter(WILLOW_WARD);
  it("jinhe-drumstele", "sign", 214, 487, "Carved on the drum tower's plinth: “When Jinhe outgrew its walls, it did not pull them down. It walked round them, and built another. The old wall is a lane now, and the children race along the line where the soldiers stood.”");
  it("jinhe-ladder", "sign", 210, 513, "A notice pasted on the dyers' row: “ROOMS ABOVE THE SHOP. Second storey, window on the lane. Cultivators of Foundation and above: half rent, for the honour of the house. Qi Condensation: full rent. Mortals: ask.”");
  it("ward-sign", "sign", EAST_WARD.x0 + 1, EAST_WARD.street - 3, "WILLOW CREEK · EAST WARD · 柳溪东坊. Painted on a new board under the paifang: “Built the year the Heart came home, by every family in the village, two storeys high so that the creek can see over the willows.”");
  it("ward-chest", "chest", 245, 157);
  mark("eastward", "Willow Creek's East Ward", "柳溪东坊", "hall", EAST_WARD.x0 + 18, EAST_WARD.street);
  // the City of Nine Tiers: a gate at the head of every stair with its warden at the foot and a seal of gold light on it,
  // houses up both sides of every tier, its people and its troubles, the Weighing Hall and the Stair Ring in the flats (see world/tiers.ts)
  {
    const [cx] = TIANJIE_C;
    const C = (key: string, i: number, j: number, dir: number, extra: Partial<NpcPlacement> = {}): NpcPlacement => ({ key, name: TIER_CAST[key.replace(/-\d+$/, "")]?.name, char: TIER_CAST[key.replace(/-\d+$/, "")].char, i, j, dir, ...extra });
    for (let k = 1; k < TIER_COUNT; k++) {
      P("tiergate", cx, tierRect(k)[1]);
      props.push({ id: "stairseal", i: cx, j: stairRow(k), when: (f) => !f[gateFlag(k)] });
      const w = tierSpots(k).warden;
      npcs.push({ key: wardenKey(k), name: WARDEN_NAMES[k], char: "tierwarden", i: w[0], j: w[1], dir: 10, anim: "salute" });
    }
    for (let k = 0; k < TIER_COUNT; k++) {
      const [x0, y0, x1, y1] = tierRect(k);
      const inner = k + 1 < TIER_COUNT ? tierRect(k + 1) : null;
      const kinds = TIER_SITES[k].buildings;
      // houses up the outer edge of both side bands, with room to walk between them and the wall of the tier above
      if (inner && kinds.length)
        for (let j = inner[1] + 1, n = 0; j + 3 <= inner[3]; j += 6, n++) {
          const id = kinds[n % kinds.length];
          const big = id === "towerinn" || id === "drumtower" || id === "pagoda" || id === "hall";
          P(id, big ? x0 + 2 : x0 + 1, big ? j + 1 : j);
          P(id, big ? x1 - 2 : x1 - 3, big ? j + 1 : j);
        }
      // a row of trees along each tier's south side, cherry on the lower tiers and pine above
      if (inner)
        for (let i = inner[0] + 2; i < inner[2] - 1; i += 5) P(k < 3 ? "willow" : k < 6 ? "cherry" : "pine", i, Math.floor((inner[3] + y1) / 2));
      // lanterns down the avenue, and what each tier keeps on its north face
      P("redlantern", AVENUE[0] - 1, y0 + 1);
      P("redlantern", AVENUE[1] + 1, y0 + 1);
      const sp = tierSpots(k);
      if (k < TIER_COUNT - 1) {
        npcs.push(C(TIER_PATRON[k], sp.patron[0], sp.patron[1], 2, { anim: k === 0 ? "gather" : k === 1 ? "hammer" : k === 2 ? "write" : k === 4 ? "fan" : k === 6 ? "meditate" : k === 7 ? "stargaze" : k === 8 ? "salute" : "idle" }));
        TIER_FOLK[k].forEach((f, n) => npcs.push({ key: `tj-folk-${k}-${n}`, name: f.name, char: f.char, i: sp.folk[n][0], j: sp.folk[n][1], dir: n % 2 ? 6 : 2, anim: f.anim }));
      } else TIER_FOLK[k].forEach((f, n) => npcs.push({ key: `tj-folk-${k}-${n}`, name: f.name, char: f.char, i: [216, 228, 216, 228, 217, 227][n], j: [607, 607, 609, 609, 612, 612][n], dir: n % 2 ? 6 : 2, anim: f.anim }));
      // Ah Lou and Wen Qi climb with her: each stands on the tier of the book she is on
      npcs.push(C(followerKey("tj-ahlou", k), sp.follower[0], sp.follower[1], 4, { anim: k === 0 ? "carry" : "idle", when: (f) => !!f[`tiers:book:${k}`] }));
      npcs.push(C(followerKey("tj-wenqi", k), sp.wenqi[0], sp.wenqi[1], 4, { anim: "write", when: (f) => !!f[`tiers:book:${k}`] }));
      enemies.push({ key: `tjboss-${k}`, enemy: TIER_BOSSES[k], i: sp.boss[0], j: sp.boss[1], range: 0, when: (f) => !!f[`tiers:boss:${k}`] });
    }
    // the summit: the Sovereign's palace on Heaven's Step, and the Sovereign before it until his hour comes
    P("hall", cx, TIANJIE_C[1] + 2);
    P("lion", cx - 3, TIANJIE_C[1] - 1);
    P("lion", cx + 3, TIANJIE_C[1] - 1);
    npcs.push(C("tj-gao", cx, TIANJIE_C[1] - 3, 0, { anim: "decree", when: (f) => !f["tiers:boss:9"] && !f["tiers:done"] }));
    // the herald cries the Census of the Stair at Jinhe's south gate until she heeds him
    npcs.push(C("tj-herald", cx + 2, JINHE.y1 - 2, 2, { anim: "decree", when: (f) => !f["tiers:begun"] }));
    // the Weighing Hall in the flats west of the city, its great steelyard, and the weigher at its door
    P("hall", ...WEIGH_HALL_AT);
    P("bigscale", ...SCALE_AT);
    npcs.push(C("tj-weigher", SCALE_AT[0] + 2, SCALE_AT[1] + 1, 4, { anim: "weigh" }));
    // the Stair Ring, where anyone may challenge anyone (and the city's challengers wait for her)
    P("weaponrack", STAIR_RING.c[0] + 4, STAIR_RING.c[1] - 3);
    P("banner", STAIR_RING.c[0] - 4, STAIR_RING.c[1] - 3);
    CHALLENGERS.forEach((key, n) => enemies.push({ key, enemy: "tjring", i: STAIR_RING.c[0] + [-1, 2, 0][n], j: STAIR_RING.c[1] + [1, 0, -2][n], range: 0.5 }));
    // shanties and stilt houses of the mud flats east of the city, and the market at the bridge's foot
    for (const [id, i, j] of [
      ["stilthouse", 283, 578],
      ["stilthouse", 284, 590],
      ["house", 283, 602],
      ["stilthouse", 284, 614],
      ["house", 283, 626],
      ["stilthouse", 284, 638],
      ["stall", 215, 568],
      ["stall", 229, 568],
      ["steamer", 213, 570],
      ["noodlecart", 231, 570],
      ["laundry", 172, 570],
      ["barrels", 190, 569],
      ["karst", 157, 572],
      ["karst", 287, 650],
      ["karst", 156, 650],
    ] as [PropId, number, number][])
      P(id, i, j);
    it("tj-shrine", "shrine", 192, 568);
    it("tj-stele", "sign", cx - 3, 569, "THE STAIR CODE · 阶律, carved at the foot of the avenue: “As a cultivator stands, so may she stand. Each realm its tier, each tier its gate. Below the gate, a word weighs what its speaker weighs.” Below, scratched by a hundred hands over a hundred years: “And the mud weighs nothing.”");
    it("tj-chest", "chest", 286, 584);
    it("tj-herb", "herb", 158, 644);
    it("tj-weighsign", "sign", SCALE_AT[0] - 1, SCALE_AT[1] + 3, "The Weighing Hall · 称骨堂. “Every soul who enters Tianjie is weighed. Bones and qi together: the steelyard does not lie.” A smaller board, nailed lower down: “Mortals weighed in spring. Bring your tablet.”");
    mark("tianjie", "Tianjie, the City of Nine Tiers", "天阶城", "pagoda", cx, tierRect(0)[1] + 1);
    mark("ninearch", "The Nine-Arch Bridge", "九孔桥", "gate", cx, 556);
    mark("weighhall", "The Weighing Hall", "称骨堂", "hall", WEIGH_HALL_AT[0], WEIGH_HALL_AT[1]);
    mark("summit", "Heaven's Step", "天阶", "hall", cx, TIANJIE_C[1]);
  }
  // Reedwater Landing, where the bamboo stream meets the southern sea
  {
    const [x, y] = [100, 522];
    P("stilthouse", x - 6, y - 4);
    P("stilthouse", x + 1, y + 3);
    P("house", x + 4, y - 5);
    P("fishrack", x - 2, y - 2);
    P("fishrack", x + 5, y + 1);
    P("fishrack", x - 4, y + 3);
    P("lanterns", x, y - 3);
    P("barrels", x + 6, y - 1);
    let boat: [number, number] | null = null;
    for (let i = x - 10; i > x - 24 && !boat; i--) if (LIQUID[m.kind(i, y)] === "water") boat = [i, y];
    if (boat) P("boat", ...boat);
    npcs.push(
      { key: "laoji", name: "Fisherman Lao Ji", char: "villagerM", i: x - 7, j: y + 1, dir: 12, anim: "fish" },
      { key: "ahhong", name: "Fishwife Ah Hong", char: "fishwife", i: x + 2, j: y - 1, dir: 2, wander: 1 },
      { key: "ferryman", name: "Ferryman Shui", char: "captain", i: x - 4, j: y - 5, dir: 6 },
      { key: "reedkid", name: "Little Lu", char: "child", i: x + 5, j: y + 6, dir: 2, anim: "kite" },
    );
    it("reed-shrine", "shrine", x + 6, y + 5);
    it("reed-stele", "sign", x - 1, y + 6, "A sea-worn stele at the landing: “The stream comes down from the bamboo, past the marsh, through the hills, and gives itself to the sea. So does every cultivator, in the end. Some only take longer.”");
    it("reed-chest", "chest", x + 8, y - 4);
    mark("reedwater", "Reedwater Landing", "芦水渡", "stilthouse", x, y);
  }
  // the Camel Bell Caravanserai, where the caravans out of the Yellow Sands rest before the city
  {
    const [x, y] = [330, 500];
    P("tent", x - 4, y - 3);
    P("tent", x + 4, y - 3);
    P("house", x - 1, y - 6);
    P("cart", x + 3, y + 2);
    P("cart", x - 5, y + 2);
    P("barrels", x + 5, y);
    P("sacks", x - 3, y + 4);
    P("well", x, y + 1);
    P("palm", x + 6, y + 4);
    P("palm", x - 6, y - 5);
    P("campfire", x + 1, y + 4);
    P("prayerflags", x - 2, y - 2);
    npcs.push(
      { key: "caravanmaster", name: "Caravan Master Temujin", char: "nomad", i: x - 1, j: y + 3, dir: 2 },
      { key: "camelhand", name: "Drover Ilkhan", char: "villagerM", i: x + 2, j: y - 1, dir: 6, anim: "carry", wander: 1 },
      { key: "caravanguard", name: "Caravan Guard Aru", char: "guard", i: x + 5, j: y + 3, dir: 4 },
    );
    critters.push(...([[x + 8, y - 4], [x + 9, y - 2]] as [number, number][]).map(([i, j], k): Critter => ({ key: `horse-caravan-${k}`, char: "horse", i, j })));
    it("caravan-stele", "sign", x + 2, y - 4, "Scratched into the caravanserai's gatepost in six scripts: “Water for the camel first, then the drover, then the merchant. The cultivator can fly to the river.”");
    it("caravan-chest", "chest", x - 6, y + 5);
    mark("caravan", "Camel Bell Caravanserai", "驼铃驿", "tent", x, y);
  }
  // Hailing, the port of the Tidewater Reach: walls and watchtowers, canals with sampans, a guild hall, the shrine of the tides,
  // and the liveliest square in the jianghu: lion dancers, acrobats, a puppet theatre, xiangqi under the lanterns, buns and firecrackers
  {
    const { x0, y0, x1, y1, c, canalsJ, canalsI } = HAILING;
    const [cx, cy] = c;
    const gap = (v: number, at: number) => Math.abs(v - at) <= 1;
    for (let i = x0 + 1; i < x1; i++) for (const j of [y0, y1]) if (!gap(i, cx)) P("citywall", i, j);
    for (let j = y0 + 1; j < y1; j++) for (const i of [x0, x1]) if (!gap(j, cy) && !(i === x1 && gap(j, cy + 2))) P("citywallY", i, j);
    for (const i of [x0, x1]) for (const j of [y0, y1]) P("watchtower", i, j);
    P("gate", cx, y0);
    P("gate", cx, y1);
    // houses wherever a block has room for one, clear of canals, streets and each other
    const built = new Set<number>();
    const fits = (i0: number, j0: number, i1: number, j1: number) => {
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) {
          const k = m.kind(i, j);
          if (k === "void" || k === "plaza" || k === "wood" || LIQUID[k] || built.has(j * COARSE_W + i) || i <= x0 || i >= x1 || j <= y0 || j >= y1) return false;
        }
      return true;
    };
    const build = (id: PropId, i: number, j: number, r: [number, number, number, number]) => {
      if (!fits(i + r[0], j + r[1], i + r[2], j + r[3])) return false;
      for (let jj = j + r[1] - 1; jj <= j + r[3] + 1; jj++) for (let ii = i + r[0] - 1; ii <= i + r[2] + 1; ii++) built.add(jj * COARSE_W + ii);
      P(id, i, j);
      return true;
    };
    // the guild hall, the teahouse, the tide shrine's pagoda and the opera stage first, then houses fill the rest
    build("hall", 531, 498, [-2, -2, 2, 2]);
    build("teahouse", 563, 497, [-2, -2, 2, 2]);
    build("pagoda", 563, 515, [-2, -2, 2, 2]);
    build("operastage", 553, 507, [-1, -1, 2, 2]);
    // the tide shrine's court, the stele and the warehouse corner keep their ground too
    for (const [id, i, j] of [
      ["prayerwheel", 556, 515],
      ["censer", 557, 514],
      ["bell", 555, 518],
      ["barrels", 529, 515],
      ["sacks", 530, 517],
    ] as [PropId, number, number][])
      build(id, i, j, [0, 0, 0, 0]);
    for (const [i, j] of [
      [557, 517],
      [566, 509],
      [529, 487],
    ] as [number, number][])
      built.add(j * COARSE_W + i);
    for (let j = y0 + 2; j <= y1 - 3; j += 3)
      for (let i = x0 + 2; i <= x1 - 3; i += 3) if (hash2(i, j, 157) > 0.18) build("house", i, j, [-1, -1, 2, 2]);
    // sampans moored along the canals
    for (const [i, j] of [
      [530, canalsJ[0]],
      [541, canalsJ[0]],
      [553, canalsJ[1]],
      [564, canalsJ[1]],
      [canalsI[0], 507],
      [canalsI[1], 489],
    ] as [number, number][])
      P("sampan", i, j);
    // lanterns over the streets, banners over the shops
    for (const [i, j] of [
      [cx - 2, y0 + 1],
      [cx + 2, y0 + 1],
      [cx - 2, y1 - 1],
      [cx + 2, y1 - 1],
      [x0 + 1, cy - 2],
      [x0 + 1, cy + 2],
      [x1 - 1, cy - 2],
      [x1 - 1, cy + 2],
    ] as [number, number][])
      P("redlantern", i, j);
    P("lanterns", cx, y0 + 5);
    P("lanterns", cx, y1 - 5);
    P("lanterns", x0 + 6, cy);
    P("lanterns", x1 - 6, cy);
    // the square: a fountain, the puppet theatre, the xiangqi tables, the stalls and their wares
    P("fountain", cx, cy);
    P("puppetbooth", cx - 3, cy + 3);
    P("xiangqitable", cx + 3, cy - 3);
    P("xiangqitable", cx + 3, cy + 3);
    P("steamer", cx - 3, cy - 3);
    P("pinwheels", cx - 4, cy - 1);
    P("firecrackers", cx + 4, cy + 1);
    P("skylanterns", cx, cy - 4);
    P("stall", cx - 4, cy + 1);
    P("stall", cx + 4, cy - 1);
    P("shopflag", cx - 2, cy - 6);
    P("shopflag", cx + 2, cy + 6);
    P("shopflag", cx - 6, cy + 2);
    P("shopflag", cx + 6, cy - 2);
    // the quay below the south gate, and its lighthouse
    P("lighthouse", 553, 529);
    P("barrels", 543, 528);
    P("sacks", 545, 530);
    P("fishrack", 550, 530);
    const T = (key: string, i: number, j: number, dir: number, extra: Partial<NpcPlacement> = {}): NpcPlacement => {
      const f = TIDE_FOLK.find((x) => x.key === key)!;
      return { key, name: f.name, char: f.char, i, j, dir, ...extra };
    };
    npcs.push(
      T("hlharbor", 547, 526, 2, { anim: "point" }),
      T("hlboatwoman", 541, canalsJ[0] + 1, 4, { anim: "row" }),
      T("hlboatman", 553, canalsJ[1] - 1, 12, { anim: "row" }),
      T("hllion1", cx - 1, cy + 1, 4, { anim: "liondance" }),
      T("hllion2", cx - 2, cy + 2, 4, { anim: "drum" }),
      T("hlacrobat", cx + 2, cy, 6, { anim: "acrobat" }),
      T("hlacrobat2", cx + 1, cy + 2, 6, { anim: "juggle" }),
      T("hlpuppeteer", cx - 3, cy + 5, 8, { anim: "puppet" }),
      T("hlabacus", 539, cy - 1, 2, { anim: "abacus" }),
      T("hlspice", 555, cy + 1, 6, { anim: "hawk" }),
      T("hlchess1", cx + 2, cy - 3, 4, { anim: "xiangqi" }),
      T("hlchess2", cx + 4, cy - 4, 12, { anim: "xiangqi" }),
      T("hlfirecracker", cx + 5, cy + 2, 6, { anim: "firecracker" }),
      T("hlhawker", cx - 2, cy - 3, 4, { anim: "hawk" }),
      T("hlpearl", 549, 530, 0, { anim: "gather" }),
      T("hlkids", cx + 1, y1 - 3, 2, { anim: "firecracker", wander: 1.5 }),
      T("hlkids2", cx - 1, y0 + 3, 2, { anim: "acrobat", wander: 1.5 }),
      T("hlmonk", 556, 517, 6, { anim: "pray" }),
      T("hlguard", cx + 2, y0 + 2, 0, { route: [[cx + 0.5, y0 + 2.5], [cx + 0.5, y1 - 2.5]] }),
      T("hlshrine", 604, 520, 12, { anim: "sweep" }),
    );
    it("hailing-shrine", "shrine", 557, 517);
    it("hailing-sign", "sign", cx + 2, y0 - 2, "HAILING · 海陵 · THE TIDE CITY. “Lion dancers on the square, boats on the canals, firecrackers by permit only. The permit office is closed.”");
    it("hailing-stele", "sign", 565, 509, "The tide stele of Hailing: “The founder sat on this stone the morning she went up, and looked at the isle, and laughed. Nobody knows why. The tide still comes in twice a day to find out.”");
    it("hailing-chest", "chest", 543, 525);
    it("hailing-herb", "herb", 551, 526);
    mark("hailing", "Hailing, the Tide City", "海陵城", "hall", cx, cy);
  }
  // the Sect of Ten Thousand Daos: walls and two gates, the Hall of Ten Thousand Daos at the head of its square, a hall for each Great Dao,
  // the Outer Court's dormitories (Room Seven among them), the Mission Hall's board, the ring, and the ten thousand at the gate (see world/halls.ts)
  {
    const { x0, y0, x1, y1, c } = HALLS;
    const [cx, cy] = c;
    const gap = (v: number, at: number) => Math.abs(v - at) <= 1;
    for (let i = x0 + 1; i < x1; i++) for (const j of [y0, y1]) if (!(j === y1 && gap(i, cx))) P("citywall", i, j);
    for (let j = y0 + 1; j < y1; j++) for (const i of [x0, x1]) if (!(i === x1 && gap(j, cy))) P("citywallY", i, j);
    for (const i of [x0, x1]) for (const j of [y0, y1]) P("watchtower", i, j);
    P("gate", cx, y1);
    P("lion", x1 + 1, cy - 2);
    P("lion", x1 + 1, cy + 2);
    P("hall", ...GREAT_HALL_AT);
    for (const h of HALL_SITES) P(h.prop, ...h.at);
    P("voiddoor", 175, 473);
    P("house", ...DORM_AT);
    P("house", 146, 469);
    P("missionboard", ...MISSION_AT);
    P("affinitystone", ...STONE_AT);
    P("tenlamps", cx, cy);
    P("gong", 164, 452);
    P("noodlecart", 163, 457);
    P("well", 150, 471);
    P("laundry", 151, 467);
    // the Old Pine's garden, the Red Furnace, the forge of the Edge, the Ward's herb beds, the stones of the Hall of Bearing
    for (const [id, i, j] of [
      ["peachtree", 158, 447],
      ["cherry", 152, 452],
      ["teabush", 157, 453],
      ["teabush", 153, 454],
      ["furnace", 176, 452],
      ["forge", 177, 466],
      ["herbbed", 158, 478],
      ["boulder", 151, 459],
      ["drum", 176, 459],
      ["shelf", 170, 477],
      ["dummy", RING.c[0] - 4, RING.c[1] - 2],
      ["dummy", RING.c[0] + 4, RING.c[1] + 2],
      ["weaponrack", RING.c[0] + 3, RING.c[1] - 4],
      ["target", RING.c[0] - 3, RING.c[1] + 4],
    ] as [PropId, number, number][])
      P(id, i, j);
    for (const [i, j] of [
      [cx - 2, y1 - 1],
      [cx + 2, y1 - 1],
      [x1 - 1, cy - 2],
      [x1 - 1, cy + 2],
      [cx - 5, cy - 5],
      [cx + 5, cy + 5],
    ] as [number, number][])
      P("redlantern", i, j);
    // the selection field: banners, stalls and steam, and the ten thousand
    P("banner", FIELD.c[0] - 5, FIELD.c[1] - 7);
    P("banner", FIELD.c[0] - 5, FIELD.c[1] + 7);
    P("stall", FIELD.c[0] + 5, FIELD.c[1] - 6);
    P("steamer", FIELD.c[0] + 6, FIELD.c[1] + 5);
    P("tent", FIELD.c[0] + 9, FIELD.c[1] - 1);
    const selection = (f: Record<string, boolean>) => !!f["halls:selection"];
    const joined = (f: Record<string, boolean>) => !!f["halls:joined"];
    const C = (key: string, i: number, j: number, dir: number, extra: Partial<NpcPlacement> = {}): NpcPlacement => {
      const base = HALL_CAST[key.startsWith("wdf-") ? `wd-${key.slice(4)}` : key];
      return { key, name: base.name, char: base.char, i, j, dir, ...extra };
    };
    npcs.push(
      C("wd-yanshu", x1 + 1, cy + 3, 2, { anim: "write", when: (f) => !f["halls:done"] || !!f["halls:fate:9:balance"] || !!f["halls:fate:9:mercy"] }),
      C("wd-gou", 149, 473, 2, { anim: "sweep" }),
      C("wd-fanyu", MISSION_AT[0] + 1, MISSION_AT[1] + 1, 4, { anim: "abacus" }),
      C("wd-murong", RING.c[0] - 2, RING.c[1] - 3, 2, { anim: "spar", when: joined }),
      C("wdf-murong", FIELD.c[0] - 2, FIELD.c[1] - 1, 10, { anim: "spar", when: selection }),
      C("wdf-tieniu", FIELD.c[0] - 3, FIELD.c[1] + 1, 10, { anim: "pant", when: selection }),
      C("wdf-yaozhi", STONE_AT[0] - 1, STONE_AT[1] + 2, 8, { anim: "fan", when: selection }),
      C("wdf-shenbai", FIELD.c[0], FIELD.c[1] + 3, 10, { anim: "pant", when: selection }),
      ...HALL_SITES.map((h) => C(hallMasterKey(h.dao), h.master[0], h.master[1], 2, { anim: h.dao === "void" ? "meditate" : "lecture", ...(h.dao === "void" && { when: (f: Record<string, boolean>) => !!f["halls:hallopen"] }) })),
      ...HOPEFULS.map((p) => ({ key: p.key, name: p.name, char: p.char, i: p.at[0], j: p.at[1], dir: p.dir, anim: p.anim, when: selection })),
      ...HOPEFULS.filter((p) => p.stays).map((p) => ({ key: `wd-outer-${p.key.slice(8)}h`, name: `Outer Disciple (${p.name.replace(/^An? /, "once a ")})`, char: p.char, i: p.stays![0], j: p.stays![1], dir: p.dir, anim: "bow" as const, when: joined })),
      ...OUTER_FOLK.map((p) => ({ key: p.key, name: p.name, char: p.char, i: p.at[0], j: p.at[1], dir: p.dir, anim: p.anim, wander: p.wander, when: p.key === "wd-outer-0" ? (f: Record<string, boolean>) => joined(f) && !f["halls:lupinggone"] : joined })),
    );
    // the herald cries the Selection on Willow Creek's market road until she heeds him
    npcs.push(C("wd-herald", 187, 141, 4, { anim: "hawk", when: (f) => !f["halls:begun"] }));
    // sparring partners always in the ring, and each hall's trouble where it comes to a head
    SPARRERS.forEach((key, k) => enemies.push({ key, enemy: "wdspar", i: RING.c[0] + [-1, 2, 0][k], j: RING.c[1] + [1, 0, -2][k], range: 0.5 }));
    HALL_BOSSES.forEach((enemy, b) => enemies.push({ key: `wdboss-${b}`, enemy, i: HALL_BOSS_AT[b][0], j: HALL_BOSS_AT[b][1], range: 0, when: (f) => !!f[`halls:boss:${b}`] }));
    it("wandao-shrine", "shrine", cx - 3, cy - 3);
    it("wandao-sign", "sign", x1 + 2, cy + 5, "THE SECT OF TEN THOUSAND DAOS · 万道宗. “Once in six years this gate opens to anyone under thirty, of any sect or none. Leave your robe here. Inside, every hopeful stands on equal footing.” Scratched underneath, small: “Some of us went home.”");
    it("wandao-stele", "sign", cx + 3, cy - 5, "The stele of the Ten Halls: ten Daos carved round a blank circle. “Water, Wood, Wind, Fire, Earth, Metal, Thunder, Ice, Life and Death. And the tenth, which is room for all the others.” The tenth hall's name has been chiselled smooth.");
    it("wandao-chest", "chest", 144, 448);
    it("wandao-herb", "herb", 154, 451);
    mark("wandao", "The Ten Halls", "万道宗", "hall", cx, cy - 6);
    mark("wdgate", "The Gate of Equal Footing", "平等门", "gate", x1 + 3, cy);
  }
  // Saltwind, on its salt pans east of the city
  {
    const [x, y] = [590, 482];
    P("saltpan", x - 4, y + 2);
    P("saltpan", x + 2, y + 3);
    P("saltpan", x - 1, y - 4);
    P("house", x + 3, y - 4);
    P("fishrack", x + 5, y + 1);
    P("lantern", x - 5, y - 2);
    P("prayerflags", x, y);
    P("palm", x + 6, y + 5);
    npcs.push(
      { key: "hlsalt", name: "Salt-Raker Old Lu", char: "farmer", i: x - 3, j: y + 4, dir: 2, anim: "rake" },
      { key: "hlsalt2", name: "Salt-Raker Meimei", char: "villagerF", i: x + 3, j: y + 1, dir: 6, anim: "rake" },
    );
    it("salt-stele", "sign", x - 2, y + 6, "Scratched on a salt-crusted post: “The sea gives, the sun takes, the salt stays. Be the salt.”");
    it("salt-chest", "chest", x + 6, y - 3);
    mark("saltwind", "Saltwind", "盐风村", "house", x, y);
  }
  // Returning Cloud Isle in its lagoon, where the founder carved her last stele
  {
    const [x, y] = ISLE.c;
    P("prayerflags", x - 3, y - 2);
    P("pine", x + 3, y - 3);
    P("lantern", x - 2, y + 3);
    P("lantern", x + 2, y + 3);
    it("isle-shrine", "shrine", x + 3, y + 2);
    mark("returningcloud", "Returning Cloud Isle", "归云屿", "pavilion", x, y - 1);
  }
  // wolves and bandits on the Tide Road, horses on the salt meadows, cranes over the lagoon
  enemies.push(
    { key: "tide-bandit-1", enemy: "bandit", i: 420, j: 508, range: 2 },
    { key: "tide-bandit-2", enemy: "bandit", i: 500, j: 498, range: 2 },
    { key: "tide-wolf-1", enemy: "wolf", i: 536, j: 446, range: 2 },
    { key: "tide-serpent-1", enemy: "serpent", i: 596, j: 538, range: 1.5 },
  );
  for (const [k, i, j] of [
    [0, 470, 520],
    [1, 474, 523],
    [2, 468, 524],
  ] as [number, number, number][])
    critters.push({ key: `horse-tide-${k}`, char: "horse", i, j });
  critters.push({ key: "crane-tide-1", char: "crane", i: 598, j: 522 }, { key: "crane-tide-2", char: "crane", i: 612, j: 540 });
  it("tide-herb-1", "herb", 452, 512);
  it("tide-chest-1", "chest", 512, 470);
  // treasure, beasts and birds out in the Golden River country
  for (const [k, i, j] of [
    [18, 160, 470],
    [19, 60, 500],
    [20, 290, 530],
    [21, 400, 480],
    [22, 180, 540],
  ] as [number, number, number][])
    it(`wild-herb-${k}`, "herb", i, j);
  for (const [k, i, j] of [
    [12, 140, 530],
    [13, 380, 520],
    [14, 30, 470],
  ] as [number, number, number][])
    it(`wild-chest-${k}`, "chest", i, j);
  enemies.push(
    { key: "south-bandit-1", enemy: "bandit", i: 300, j: 470, range: 2 },
    { key: "south-bandit-2", enemy: "bandit", i: 345, j: 455, range: 2 },
    { key: "south-wolf-1", enemy: "wolf", i: 160, j: 525, range: 2 },
    { key: "south-fox-1", enemy: "fox", i: 50, j: 480, range: 2 },
    { key: "south-serpent-1", enemy: "serpent", i: 92, j: 540, range: 1.5 },
  );
  critters.push(
    { key: "crane-s1", char: "crane", i: 130, j: 520 },
    { key: "crane-s2", char: "crane", i: 250, j: 530 },
    ...([[180, 480], [183, 482], [178, 484]] as [number, number][]).map(([i, j], k): Critter => ({ key: `horse-riverlands-${k}`, char: "horse", i, j })),
  );

  // a wandering herbalist at the inn, if she let Ku Shen go
  npcs.push({ key: "kushen2", name: "Herbalist Ku", char: "poisoner", i: 113, j: 302, dir: 6, anim: "brew", when: (f) => !!f.kuSpared });

  // treasure, beasts and birds out in the new lands
  for (const [k, i, j] of [
    [10, 40, 250],
    [11, 160, 380],
    [12, 300, 300],
    [13, 400, 250],
    [14, 520, 120],
    [15, 600, 300],
    [16, 380, 420],
    [17, 240, 420],
  ] as [number, number, number][])
    it(`wild-herb-${k}`, "herb", i, j);
  for (const [k, i, j] of [
    [6, 20, 440],
    [7, 250, 350],
    [8, 460, 300],
    [9, 620, 160],
    [10, 560, 430],
    [11, 380, 90],
  ] as [number, number, number][])
    it(`wild-chest-${k}`, "chest", i, j);
  enemies.push(
    { key: "wild-wolf-4", enemy: "wolf", i: 420, j: 296, range: 2 },
    { key: "wild-wolf-5", enemy: "wolf", i: 540, j: 300, range: 2 },
    { key: "wild-wolf-6", enemy: "wolf", i: 560, j: 100, range: 2 },
    { key: "wild-fox-3", enemy: "fox", i: 170, j: 410, range: 2 },
    { key: "wild-serpent-2", enemy: "serpent", i: 30, j: 330, range: 1.5 },
    { key: "wild-jiangshi-1", enemy: "jiangshi", i: 100, j: 420, range: 2 },
    { key: "wild-bandit-1", enemy: "bandit", i: 380, j: 186, range: 2 },
    { key: "wild-cultist-2", enemy: "cultist", i: 62, j: 252, range: 2 },
  );
  critters.push(
    { key: "crane-w4", char: "crane", i: 600, j: 210 },
    { key: "crane-w5", char: "crane", i: 90, j: 360 },
    { key: "crane-w6", char: "crane", i: 230, j: 400 },
    { key: "bat-w4", char: "bat", i: 500, j: 420 },
  );

  // Willow Creek's festival: fireworks over the square once the Heart is home
  {
    const homecoming = (f: Record<string, boolean>) => !!f.heartReturned;
    for (const [lx, ly] of [
      [14, 8],
      [20, 9],
      [22, 12],
    ] as [number, number][]) {
      const [i, j] = toCoarse("village", lx, ly);
      props.push({ id: "fireworks", i, j, when: homecoming });
    }
  }

  // 9. wayside landmarks, rewards and wanderers along the highway
  const [nx] = toCoarse("village", 16, 0);
  P("lantern", nx - 3, vy - 6);
  P("lantern", nx + 3, vy - 6);
  P("lantern", gx - 2, gy + 1);
  for (let x = 16; x < 586; x += 14) {
    if (x > GORGE[0] - 4 && x < GORGE[1] + 4) continue;
    const [i, j] = [x, Math.round(roadY(x)) + (x % 28 === 2 ? -3 : 3)];
    P(x < 60 ? "brazier" : "lantern", i, j);
  }
  it("road-shrine", "shrine", 182, 170);
  it("road-sign", "sign", 196, 169, "A weathered milestone. ← West: the Whispering Bamboo Forest and, beyond the red mist, the Crimson Demon Valley. → East: the watermill and the Moonlit Lotus Lake. ↑ North: Willow Creek, and the sky bridge to the Azure Cloud Sect. ↓ South: the scarecrow fields.");
  it("road-stele", "sign", 62, 169, "Scratched into the stone in a shaking hand: “Past this point the qi turns to blood. Turn back, traveller.”");
  it("road-sign-east", "sign", 270, 169, "← West: Willow Creek. ↑ North: the Moonlit Lotus Lake. ↓ South: the highland hot spring. “Beware the bandits in the pines.”");
  for (const [k, i, j] of [
    [1, 30, 172],
    [2, 176, 172],
    [3, 244, 172],
    [4, 132, 186],
    [5, 214, 214],
    [6, 286, 186],
    [7, 24, 214],
    [8, 150, 100],
    [9, 300, 150],
  ] as [number, number, number][])
    it(`wild-herb-${k}`, "herb", i, j);
  for (const [k, i, j] of [
    [1, 310, 172],
    [2, 128, 172],
    [3, 164, 214],
    [4, 236, 100],
    [5, 60, 146],
  ] as [number, number, number][])
    it(`wild-chest-${k}`, "chest", i, j);
  P("redlantern", 108, 162);
  P("redlantern", 196, 162);
  P("brazier", 22, 162);
  P("lantern", 278, 162);
  npcs.push({
    key: "peddler",
    char: "peddler",
    i: 170,
    j: 166,
    dir: 4,
    route: [
      [128.5, 166.4],
      [188.5, 166.2],
    ],
    when: (f) => !!f.metElder,
  });
  enemies.push(
    { key: "wild-fox-1", enemy: "fox", i: 224, j: 172, range: 2 },
    { key: "wild-fox-2", enemy: "fox", i: 88, j: 172, range: 2 },
    { key: "wild-wolf-1", enemy: "wolf", i: 140, j: 176, range: 2 },
    { key: "wild-wolf-2", enemy: "wolf", i: 292, j: 172, range: 2 },
    { key: "wild-wolf-3", enemy: "wolf", i: 120, j: 190, range: 2 },
    { key: "wild-cultist-1", enemy: "cultist", i: 40, j: 172, range: 2 },
    { key: "wild-serpent-1", enemy: "serpent", i: 300, j: 140, range: 1.5 },
  );
  // herds of wild horses on the open pastures
  for (const [herd, pts] of [
    ["fields", [[170, 200], [173, 202], [168, 204]]],
    ["highlands", [[275, 198], [278, 196], [276, 201], [281, 199]]],
    ["lakeside", [[305, 118], [308, 121]]],
    ["westwood", [[68, 126], [71, 129]]],
  ] as [string, [number, number][]][])
    pts.forEach(([i, j], k) => critters.push({ key: `horse-${herd}-${k}`, char: "horse", i, j }));
  critters.push(
    { key: "crane-w1", char: "crane", i: 244, j: 128 },
    { key: "crane-w2", char: "crane", i: 160, j: 120 },
    { key: "crane-w3", char: "crane", i: 84, j: 186 },
    { key: "bat-w1", char: "bat", i: 54, j: 150 },
  );

  // 10. scatter trees and undergrowth over the wilds, clear of roads and landmarks
  const taken = new Set(props.map((p) => p.j * COARSE_W + p.i));
  const keepClear = [...interacts, ...npcs, ...enemies, ...critters].map((x) => [x.i, x.j] as [number, number]);
  const clearGrid = new Uint8Array(COARSE_W * COARSE_H);
  for (const [x, y] of keepClear)
    for (let dj = -3; dj <= 3; dj++)
      for (let di = -3; di <= 3; di++) if (Math.hypot(di, dj) <= 2.2 && m.inside(x + di, y + dj)) clearGrid[(y + dj) * COARSE_W + x + di] = 1;
  const clear = (i: number, j: number, r: number) => {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (fixed[(j + dj) * COARSE_W + i + di] === 2) return false;
    return !clearGrid[j * COARSE_W + i];
  };
  m.each((i, j) => {
    const idx = j * COARSE_W + i;
    const r = WILD_IDS[wildOf[idx] - 1];
    if (!r || fixed[idx] || taken.has(idx)) return;
    const k = m.kind(i, j);
    if (k === "void" || LIQUID[k] || k === "sand") return;
    if (m.kind(i + 1, j) === "void" || m.kind(i, j + 1) === "void") return;
    const st = WILD[r];
    const h = hash2(i, j, 77);
    let id: PropId | null = null;
    if (h < st.treeP && clear(i, j, 2)) id = st.trees[Math.floor(hash2(i, j, 78) * st.trees.length)];
    else if (h > 1 - st.extraP && clear(i, j, 1)) id = st.extras[Math.floor(hash2(i, j, 79) * st.extras.length)];
    // pines on the snowy highland tops
    if (id && k === "snow" && st.trees.includes(id)) id = "pine";
    if (id) {
      props.push({ id, i, j });
      taken.add(idx);
    }
  });

  // 11. magnify the authoring grid into the world: the land doubles, the
  // buildings grow with it (the ones she can enter to the size of their rooms),
  // and the wild grows thicker so the bigger land doesn't feel empty
  const S = WORLD_SCALE;
  const coarse = m;
  const fixedAt = (i: number, j: number) => fixed[Math.floor(j / S) * COARSE_W + Math.floor(i / S)];
  const fine = magnifyMap(coarse, (i, j) => fixed[j * COARSE_W + i] === 2 && !LIQUID[coarse.kind(i, j)]);
  const pt = (i: number, j: number) => pointTile(coarse, fine, i, j);
  const fnpcs: NpcPlacement[] = npcs.map((n) => ({ ...n, ...xy(pt(n.i, n.j)), wander: n.wander && n.wander * 1.5, route: n.route?.map(([x, y]) => [x * S, y * S] as [number, number]) }));
  const fenemies: EnemySpawn[] = enemies.map((e) => ({ ...e, ...xy(pt(e.i, e.j)), range: e.range * 1.5 }));
  const finteracts: Interactable[] = [...interacts.map((x) => ({ ...x, ...xy(pt(x.i, x.j)) })), ...roomDoors()];
  const fcritters: Critter[] = critters.map((c) => ({ ...c, ...xy(pt(c.i, c.j)) }));
  const busy = new Set<number>();
  for (const x of [...fnpcs, ...fenemies, ...finteracts, ...fcritters]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) busy.add((x.j + dj) * WORLD_W + x.i + di);
  const rooms = new Map(INTERIOR_IDS.map((id) => {
    const d = getInterior(id);
    return [`${d.source.id}@${d.source.i},${d.source.j}`, d.building] as const;
  }));
  const fprops: PropPlacement[] = [];
  for (const p of props) {
    const room = rooms.get(`${p.id}@${p.i},${p.j}`);
    if (room) {
      fprops.push(room);
      continue;
    }
    const q: PropPlacement = { ...magnifyProp(p, coarse, fine), ...(p.when && { when: p.when }) };
    fprops.push(q);
    const c = companionOf(p, q, coarse, fine);
    if (c && !busy.has(c.j * WORLD_W + c.i)) fprops.push(c);
  }

  // 12. props never stand in rivers, on roads or over the void (buildings only mind the void)
  const kept = fprops.filter((p) => {
    const d = propDef(p.id);
    const big = (p.k ?? 1) > 1;
    const [i0, j0, i1, j1] = placementTiles(p);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = fine.kind(i, j);
        if (k === "void") return false;
        if (big) continue;
        const wet = !!LIQUID[k] && !FLOATS.has(p.id);
        const afloat = FLOATS.has(p.id) && !!LIQUID[k];
        if (wet || (fixedAt(i, j) === 2 && d.blocks && !afloat)) return false;
      }
    return true;
  });
  for (const p of kept) {
    if (!propDef(p.id).blocks || p.when) continue;
    const [i0, j0, i1, j1] = placementTiles(p);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fine.block(i, j);
  }

  // 12b. the cave mouths, and the rock that buries the Dragon Vein's until the earth shakes it loose
  for (const id of CAVE_IDS) {
    const { at, prop } = CAVE_MOUTH[id];
    const p: PropPlacement = { id: prop, i: at[0] * S, j: at[1] * S };
    kept.push(p);
    const [i0, j0, i1, j1] = placementTiles(p);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fine.block(i, j);
  }
  // and who waits outside the four newer deeps
  fnpcs.push(...deepFolk());
  const [mx, my] = [CAVE_MOUTH.vein.at[0] * S, CAVE_MOUTH.vein.at[1] * S];
  const buried = (f: Record<string, boolean>) => !f.veinOpened;
  for (const [dx2, dy2] of [
    [1, 0],
    [2, -1],
    [2, 1],
    [3, 0],
    [1, 2],
    [1, -2],
  ] as [number, number][])
    kept.push({ id: "rubble", i: mx + dx2, j: my + dy2, when: buried });

  // 12c. the story's marks on the land (see world/terrain.ts)
  const patches: TerrainPatch[] = [];
  const F = (v: number) => v * S;
  const at = (pts: [number, number][]): [number, number][] => pts.map(([a, b]) => [F(a), F(b)]);
  // the story never pours lava or water over someone standing about, or over something to pick up
  const occupied = new Set<number>();
  for (const x of [...fnpcs, ...fenemies, ...finteracts]) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) occupied.add((x.j + dj) * WORLD_W + x.i + di);
  const free = (i: number, j: number) => !fine.isBlocked(i, j) && !occupied.has(j * WORLD_W + i);
  {
    // the Dragon Vein's mouth lies under a rockfall until the conclave is called
    const p = new PatchPainter(fine);
    p.disc(mx + 2, my, 3.4, (i, j) => (i > mx ? { kind: "dirt", height: fine.height(i, j) + 1, block: true } : undefined), 0.6, 9);
    patches.push(p.build("vein-rockfall", buried));
  }
  {
    // the Patriarch's lava pool cools to stone and a clean spring wells up through it
    const [cx, cy] = toCoarse("valley", 34, 8);
    const p = new PatchPainter(fine);
    p.disc(F(cx), F(cy), 5.6, (i, j) => (LIQUID[fine.kind(i, j)] === "lava" ? { kind: "water" } : fine.kind(i, j) === "ash" ? { kind: "moss" } : undefined), 1, 31);
    patches.push(p.build("valley-spring", (f) => !!f.patriarchDefeated));
  }
  {
    // the fire in the mesa's crown: fed, it bursts out down the eastern cliffs; sealed, it goes out
    const fed = new PatchPainter(fine);
    // it wells up in a crack at the eastern rim, then runs down the cliffs and away across the flats
    fed.path(at([[591, 375], [594, 378], [598, 384], [603, 394], [610, 408], [616, 420]]), 2.6, (i, j) => (free(i, j) && fine.kind(i, j) !== "plaza" && fine.kind(i, j) !== "stairs" ? { kind: "lava" } : undefined));
    fed.disc(F(586), F(372), 6, (i, j) => (fine.kind(i, j) === "redrock" && fbm(i * 0.3, j * 0.3, 41) > 0.62 && free(i, j) ? { kind: "ash" } : undefined));
    patches.push(fed.build("phoenix-fed", (f) => !!f["phx:fed"]));
    const sealed = new PatchPainter(fine);
    sealed.disc(F(586), F(372), 3.4, (i, j) => (LIQUID[fine.kind(i, j)] === "lava" ? { kind: "redrock" } : undefined));
    patches.push(sealed.build("phoenix-sealed", (f) => !!f["phx:sealed"]));
  }
  {
    // the valley withers until its spring runs clean; the marsh pools drain if she chooses so
    const withered = new PatchPainter(fine);
    withered.disc(F(48), F(392), 17, (i, j) => {
      const k = fine.kind(i, j);
      if (k === "meadow" || k === "grass") return { kind: fbm(i * 0.2, j * 0.2, 51) > 0.5 ? "dirt" : "leaf" };
      return undefined;
    }, 1.4, 52);
    patches.push(withered.build("herb-withered", (f) => !f.herbDone));
    const drained = new PatchPainter(fine);
    drained.disc(F(36), F(402), 52, (i, j) => (LIQUID[fine.kind(i, j)] === "water" && fine.height(i, j) <= 0 ? { kind: fbm(i * 0.3, j * 0.3, 53) > 0.5 ? "paddy" : "meadow", height: 0 } : undefined));
    patches.push(drained.build("herb-drained", (f) => !!f["herb:drained"]));
  }
  {
    // the stair down to the Sword Sea is heaped with fallen rock until Ling Feng orders it cleared
    const p = new PatchPainter(fine);
    p.path(at([[605, 120], [609, 123], [613, 126]]), 4, (i, j) => (fine.kind(i, j) === "stairs" ? { block: true } : undefined));
    patches.push(p.build("sword-stair", (f) => !f.swordStair));
    for (const [a, b] of [
      [607, 121],
      [610, 124],
    ] as [number, number][])
      kept.push({ id: "rubble", i: F(a), j: F(b), when: (f) => !f.swordStair });
  }
  {
    // what the conclave's choice does to the Dragonspine
    const [cx, cy] = [F(228), F(256)];
    const bloom = new PatchPainter(fine);
    bloom.disc(cx, cy, 22, (i, j) => {
      const k = fine.kind(i, j);
      return k === "snow" || k === "dirt" || k === "grass" || k === "moss" || k === "leaf" ? (free(i, j) || k !== "dirt" ? { kind: hash2(i, j, 61) > 0.5 ? "meadow" : "grass" } : undefined) : undefined;
    }, 3, 62);
    patches.push(bloom.build("spine-bloom", (f) => !!f["vein:herb"]));
    const crater = new PatchPainter(fine);
    crater.disc(F(246), F(248), 3.2, () => ({ kind: "lava" }), 1, 63);
    crater.disc(F(246), F(248), 6, (i, j) => (fine.kind(i, j) !== "void" && !LIQUID[fine.kind(i, j)] ? { kind: "ash" } : undefined), 1.6, 64);
    patches.push(crater.build("spine-crater", (f) => !!f["vein:phoenix"]));
    const spring = new PatchPainter(fine);
    spring.disc(F(228), F(254), 2.2, () => ({ kind: "water" }), 0.6, 65);
    spring.path(at([[228, 254], [220, 250], [212, 248], [205, 247]]), 1.6, (i, j) => (free(i, j) ? { kind: "water" } : undefined));
    spring.disc(F(204), F(247), 2.6, (i, j) => (free(i, j) ? { kind: "water" } : undefined), 0.6, 66);
    patches.push(spring.build("spine-spring", (f) => !!f["vein:shared"]));
    const blight = new PatchPainter(fine);
    blight.disc(cx, cy, 18, (i, j) => (fine.kind(i, j) !== "void" && !LIQUID[fine.kind(i, j)] && fine.kind(i, j) !== "dirt" ? { kind: fbm(i * 0.3, j * 0.3, 67) > 0.55 ? "redrock" : "ash" } : undefined), 3, 68);
    patches.push(blight.build("spine-blight", (f) => !!f["vein:taken"]));
    const steel = new PatchPainter(fine);
    steel.disc(F(234), F(252), 2.4, () => ({ kind: "plaza" }), 0, 1);
    patches.push(steel.build("spine-steel", (f) => !!f["vein:sword"]));
    kept.push(
      { id: "swordspire", i: F(234), j: F(252), when: (f) => !!f["vein:sword"] },
      { id: "brazier", i: F(243), j: F(252), when: (f) => !!f["vein:phoenix"] },
      { id: "peachtree", i: F(232), j: F(262), when: (f) => !!f["vein:herb"] },
      { id: "peachtree", i: F(217), j: F(254), when: (f) => !!f["vein:herb"] },
      { id: "butterflies", i: F(226), j: F(266), when: (f) => !!f["vein:herb"] },
      { id: "lotus", i: F(204), j: F(247), when: (f) => !!f["vein:shared"] },
      { id: "deadtree", i: F(230), j: F(266), when: (f) => !!f["vein:taken"] },
      { id: "deadtree", i: F(215), j: F(255), when: (f) => !!f["vein:taken"] },
      { id: "steam", i: F(586) + 4, j: F(372) + 1, when: (f) => !!f["phx:sealed"] },
      { id: "lotus", i: F(22), j: F(410), when: (f) => !!f["herb:purified"] },
      { id: "lotus", i: F(104), j: F(352), when: (f) => !!f["herb:purified"] },
    );
  }
  {
    // the main quest's marks on the land: what Lin Yue did with Xue and with the Jade Lotus Heart
    const local = (area: AreaId, x: number, y: number): [number, number] => toWorld(area, x, y);
    const [vx, vy] = local("valley", 16, 16);
    const planted = (f: Record<string, boolean>) => !!f["heart:planted"];
    const dawn = (f: Record<string, boolean>) => !!f.xueRedeemed || planted(f);
    // talked home or rooted over, the blood moon sets: the valley's lava rivers cool to clear water and moss creeps over the ash
    const cool = new PatchPainter(fine);
    cool.disc(vx, vy, 40, (i, j) => {
      const k = fine.kind(i, j);
      if (LIQUID[k] === "lava") return { kind: "water" };
      if (k === "ash" && fbm(i * 0.25, j * 0.25, 71) > 0.46) return { kind: "moss" };
      return undefined;
    }, 4, 72);
    patches.push(cool.build("valley-dawn", dawn));
    // the planted Heart turns the whole valley into a garden of jade lotus and blossom
    const bloom = new PatchPainter(fine);
    bloom.disc(vx, vy, 36, (i, j) => {
      const k = fine.kind(i, j);
      if (k === "ash" || k === "moss" || (k === "redrock" && fbm(i * 0.3, j * 0.3, 73) > 0.45)) return { kind: hash2(i, j, 74) > 0.35 ? "meadow" : "grass" };
      return undefined;
    }, 3, 75);
    patches.push(bloom.build("valley-lotus", planted));
    // lotus on every pool that was lava, and blossom on the banks
    for (let j = vy - 34; j <= vy + 34; j += 3)
      for (let i = vx - 34; i <= vx + 34; i += 3) {
        const k = fine.kind(i, j);
        const h = hash2(i, j, 76);
        if (LIQUID[k] === "lava" && h > 0.7) kept.push({ id: "lotus", i, j, when: planted });
        else if ((k === "ash" || k === "redrock") && free(i, j) && h > 0.93) kept.push({ id: hash2(i, j, 77) > 0.5 ? "peachtree" : "cherry", i, j, when: planted });
        else if (k === "ash" && free(i, j) && h < 0.03) kept.push({ id: "butterflies", i, j, when: planted });
      }
    // a Heart drunk dry bleeds the bamboo grey and red, until Elder Mo draws it out of her again
    const blood = (f: Record<string, boolean>) => !!f["heart:devoured"] && !f.purged;
    const [bx, by] = local("bamboo", 16, 16);
    const blight = new PatchPainter(fine);
    blight.disc(bx, by, 44, (i, j) => {
      const k = fine.kind(i, j);
      if (k === "leaf" || k === "moss" || k === "meadow" || k === "grass") return { kind: fbm(i * 0.3, j * 0.3, 78) > 0.55 ? "redrock" : "ash" };
      return undefined;
    }, 5, 79);
    // and Willow Creek's paddies wither to cracked earth
    const [wx, wy] = local("village", 16, 16);
    blight.disc(wx, wy, 34, (i, j) => (fine.kind(i, j) === "paddy" || (fine.kind(i, j) === "meadow" && fbm(i * 0.3, j * 0.3, 80) > 0.5) ? { kind: "dirt", height: Math.max(0, fine.height(i, j)) } : undefined), 3, 81);
    patches.push(blight.build("crimson-blight", blood));
    for (const [a, x, y] of [
      ["bamboo", 9, 12],
      ["bamboo", 22, 18],
      ["bamboo", 13, 26],
      ["village", 7, 18],
      ["village", 24, 9],
    ] as [AreaId, number, number][]) {
      const [i, j] = local(a, x, y);
      if (free(i, j)) kept.push({ id: "deadtree", i, j, when: blood });
    }
    // where Elder Mo fell, the marble before the Hall of Clouds is scorched black
    const [hx, hy] = local("sect", 15, 12);
    const scar = new PatchPainter(fine);
    scar.disc(hx, hy, 6, (i, j) => (fine.kind(i, j) !== "void" && !LIQUID[fine.kind(i, j)] && fine.kind(i, j) !== "stairs" ? { kind: fbm(i * 0.4, j * 0.4, 82) > 0.5 ? "ash" : "redrock" } : undefined), 1.4, 83);
    patches.push(scar.build("sect-scar", (f) => !!f.moBroken));
    // the guardian sat down with her back to heaven: moss and blossom push up through the peak's snow
    const [px, py] = local("peak", 12, 13);
    const green = new PatchPainter(fine);
    green.disc(px, py, 12, (i, j) => (fine.kind(i, j) === "snow" ? { kind: hash2(i, j, 84) > 0.4 ? "moss" : "meadow" } : undefined), 2, 85);
    patches.push(green.build("peak-green", (f) => !!f["ending:guardian"]));
    for (const [x, y] of [
      [7, 14],
      [17, 14],
      [6, 9],
      [18, 9],
    ] as [number, number][]) {
      const [i, j] = local("peak", x, y);
      if (free(i, j)) kept.push({ id: "cherry", i, j, when: (f) => !!f["ending:guardian"] });
    }
    // the teacher of Willow Creek: lanterns and banners for the new school in the village hall
    for (const [id, x, y] of [
      ["lantern", 13, 9],
      ["lantern", 19, 9],
      ["banner", 12, 11],
      ["banner", 20, 11],
    ] as [PropId, number, number][]) {
      const [i, j] = local("village", x, y);
      if (free(i, j)) kept.push({ id, i, j, when: (f) => !!f["ending:mortal"] });
    }
  }

  // 12d. the War of the Iron Banner: camps, pickets, raiders, refugees, burning fields (see world/warfront.ts)
  {
    const touched = new Set<number>();
    for (const p of patches) for (const idx of p.idx) touched.add(idx);
    const waypoints = {} as Record<AreaId, [number, number]>;
    for (const id of AREA_IDS) waypoints[id] = toWorld(id, ...regions[id].arrive);
    const war = layWar({
      map: fine,
      waypoints,
      free: (i, j) => free(i, j) && fine.standable(i, j) && !touched.has(j * WORLD_W + i),
      claim: (i, j) => {
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) occupied.add((j + dj) * WORLD_W + i + di);
      },
      road: (i, j) => fixedAt(i, j) === 2,
    });
    fnpcs.push(...war.npcs);
    fenemies.push(...war.enemies);
    kept.push(...war.props);
    patches.push(...war.patches);
  }

  // 12e. the Founder's Road: the ten steles, Qingxu, the hollowed and the Echoes (see world/roadside.ts)
  const roadMarks: Landmark[] = [];
  {
    const road = layRoad(
      {
        map: fine,
        free: (i, j) => free(i, j) && fine.standable(i, j),
        claim: (i, j) => {
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) occupied.add((j + dj) * WORLD_W + i + di);
        },
        road: (i, j) => fixedAt(i, j) === 2,
      },
      S,
    );
    fnpcs.push(...road.npcs);
    fenemies.push(...road.enemies);
    // nothing of the wild grows right up against a stele
    const wild = new Set<PropId>(["pine", "cherry", "maple", "bamboo", "willow", "deadtree", "rock", "boulder", "tallgrass", "reeds", "bones", "spikes", "crystal", "karst", "haystack", "peachtree", "teabush", "snowpine", "palm"]);
    const cleared = kept.filter((p) => !(wild.has(p.id) && !p.when && road.landmarks.some((l) => Math.hypot(p.i + 0.5 - l.x, p.j + 0.5 - l.y) < 5)));
    kept.length = 0;
    kept.push(...cleared, ...road.props);
    roadMarks.push(...road.landmarks);
  }

  // 13. which region owns each tile
  const regionOf = regionOwners(fine);

  // 14. a busier jianghu: a neighbour for every person, a mate for every common beast and bird (see world/crowds.ts)
  {
    const touched = new Set<number>();
    for (const p of patches) for (const idx of p.idx) touched.add(idx);
    const ground = {
      map: fine,
      free: (i: number, j: number) => free(i, j) && !touched.has(j * WORLD_W + i),
      region: (i: number, j: number) => AREA_IDS[regionOf[j * WORLD_W + i]],
    };
    const folk = neighbours(ground, fnpcs, fenemies);
    const mates = packmates(ground, fenemies, [...fnpcs, ...folk]);
    fnpcs.push(...folk);
    fenemies.push(...mates);
    fcritters.push(...flockmates(ground, fcritters));
  }

  const waypoints = {} as Record<AreaId, [number, number]>;
  for (const id of AREA_IDS) waypoints[id] = toWorld(id, ...regions[id].arrive);
  const sect = regions.sect;
  return {
    ...sect,
    name: "The Jianghu",
    hanzi: "江湖",
    subtitle: "One world beneath heaven",
    map: fine,
    base: 0,
    floating: true,
    arrive: waypoints.sect,
    props: kept,
    npcs: fnpcs,
    enemies: fenemies,
    interacts: finteracts,
    critters: fcritters,
    regionOf,
    regions,
    waypoints,
    landmarks: [...landmarks.map((l) => ({ ...l, x: l.x * S + (S - 1) / 2, y: l.y * S + (S - 1) / 2 })), ...roadMarks],
    patches,
    bars: Array.from({ length: TIER_COUNT - 1 }, (_, n): Bar => ({ key: `tier-${n + 1}`, rect: tierWorldRect(n + 1), flag: gateFlag(n + 1), why: `${WARDEN_NAMES[n + 1]} bars the stair to ${TIER_SITES[n + 1].name}` })),
  };
}

/**
 * Which region owns each world tile: the nearest of each region's template
 * and wider lands. Kept out of buildWorld so the engine optimises it (it runs
 * once for every one of the million-odd tiles).
 */
function regionOwners(fine: TileMap): Uint8Array {
  const regionOf = new Uint8Array(WORLD_W * WORLD_H);
  // each region's template and wider lands as flat world rectangles in typed arrays, each one's vertical distance worked out once a row
  const holds = AREA_IDS.flatMap((id, n) => [regionRect(id), ...(DOMAIN[id] ?? []).map((r) => r.map((v) => v * WORLD_SCALE))].map((r) => [n, ...r]));
  const owner = Uint8Array.from(holds, (h) => h[0]);
  const hx0 = Float64Array.from(holds, (h) => h[1]);
  const hx1 = Float64Array.from(holds, (h) => h[3]);
  const hy0 = Float64Array.from(holds, (h) => h[2]);
  const hy1 = Float64Array.from(holds, (h) => h[4]);
  const dy2 = new Float64Array(holds.length);
  const [W, H, kinds, n] = [WORLD_W, WORLD_H, fine.kinds, holds.length];
  const heldRows = new Set(HOLDS.flatMap(([, [, y0, , y1]]) => Array.from({ length: (y1 - y0) * WORLD_SCALE }, (_, k) => y0 * WORLD_SCALE + k)));
  for (let j = 0; j < H; j++) {
    const y = j + 0.5;
    for (let k = 0; k < n; k++) {
      const dy = Math.max(hy0[k] - y, 0, y - hy1[k]);
      dy2[k] = dy * dy;
    }
    for (let i = 0; i < W; i++) {
      if (kinds[j * W + i] === 0) continue;
      const x = i + 0.5;
      let best = 0;
      let bd = Infinity;
      for (let k = 0; k < n; k++) {
        const a = hx0[k] - x;
        const b = x - hx1[k];
        const dx = a > 0 ? a : b > 0 ? b : 0;
        const d = Math.sqrt(dx * dx + dy2[k]);
        if (d < bd - 1e-6) {
          bd = d;
          best = owner[k];
        }
      }
      regionOf[j * W + i] = best;
    }
    // ground a region owns outright (Willow Creek's East Ward)
    for (let i = 0; i < W && heldRows.has(j); i++) {
      if (kinds[j * W + i] === 0) continue;
      const held = heldBy(i + 0.5, y);
      if (held) regionOf[j * W + i] = AREA_IDS.indexOf(held);
    }
  }
  return regionOf;
}

const xy = ([i, j]: [number, number]) => ({ i, j });

/** Height of the highway's centreline at a world x (for roadside decorations). */
function roadY(x: number): number {
  for (let k = 1; k < HIGHWAY.length; k++) {
    const [x0, y0] = HIGHWAY[k - 1];
    const [x1, y1] = HIGHWAY[k];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return HIGHWAY[HIGHWAY.length - 1][1];
}

let world: WorldDef | null = null;

/** Build (once) and return the continuous world. */
export function getWorld(): WorldDef {
  return (world ??= buildWorld());
}

/** Which region a world position belongs to. */
export function regionAt(w: WorldDef, x: number, y: number): AreaId {
  const i = Math.max(0, Math.min(w.map.w - 1, Math.floor(x)));
  const j = Math.max(0, Math.min(w.map.h - 1, Math.floor(y)));
  return AREA_IDS[w.regionOf[j * w.map.w + i]];
}

export const isWorldDef = (d: AreaDef): d is WorldDef => "regionOf" in d;

export { MAINLAND, SKY };
