import { fbm } from "../pixel/noise";
import { COARSE_H, COARSE_W, WORLD_SCALE } from "./layout";

/**
 * The Encircling Sea (环海) and the continents it holds.
 *
 * The ground of the jianghu no longer hangs in a sea of cloud. It stands in a
 * real sea that runs out to every edge of the world, and the land is broken
 * into continents by straits a few dozen tiles across:
 *
 * - the Middle Continent (中洲): the old mainland, the far south, the Yellow
 *   Sands, the Golden River country east of Jinhe and the Tidewater Reach;
 * - the Eastern Continent (东洲): the steppe, the snows of Frostveil, the
 *   maple woods and Wavecrest Harbour's coast, across the Rainbow Bridge and
 *   the Strait of the Rising Sun;
 * - the Western Continent (西洲): the Mistmarsh, Hundred Herb Valley and the
 *   western half of the Golden River country, across the Reedwater Strait;
 * - the Southern Continent (南洲): the Stairlands and the Southern Heights,
 *   across the strait the Nine-Arch Bridge spans;
 * - the Sea of Pearls' archipelago, and, above it all, the floating realm of
 *   the Azure Cloud Sect, which still rides its own cloud (the only place
 *   left where the world drops away into sky).
 *
 * The roads cross the straits on plank bridges. Nobody crosses the sea at
 * the world's edge: within EDGE tiles of it the water is deep and the wind
 * turns back even a flying sword.
 *
 * Kept free of map-building code, so the runtime can ask where the edge is
 * without building the world.
 */

/** The deep-water band round the world's edge, in authoring tiles. */
export const EDGE = 7;
/** How close to the edge (in world tiles) anyone may go, walking, sailing or flying. */
export const EDGE_LIMIT = (EDGE - 2) * WORLD_SCALE;

/** Is a world point past the limit of the Encircling Sea (or off the map altogether)? */
export function pastEdge(x: number, y: number, w = COARSE_W * WORLD_SCALE, h = COARSE_H * WORLD_SCALE): boolean {
  return x < EDGE_LIMIT || y < EDGE_LIMIT || x > w - EDGE_LIMIT || y > h - EDGE_LIMIT;
}

/**
 * The cloud the Azure Cloud Sect floats on: a noisy oval round the sect, the
 * peak and their isles, out over the northern sea (authoring grid). Under it
 * the world still drops away into sky; everywhere else, the void becomes sea.
 */
export function inSky(i: number, j: number): boolean {
  const x = (i - 203) / 72;
  const y = (j - 42) / 46;
  return Math.hypot(x, y) < 1 + (fbm(i * 0.05, j * 0.05, 610) - 0.5) * 0.18;
}

/** How far an authoring tile is from the world's edge. */
const edgeDistance = (i: number, j: number) => Math.min(i, j, COARSE_W - 1 - i, COARSE_H - 1 - j);

/** Is an authoring tile inside the deep band round the world's edge? */
export function inEdge(i: number, j: number): boolean {
  return edgeDistance(i, j) < EDGE + (fbm(i * 0.08, j * 0.08, 611) - 0.5) * 3;
}

/**
 * Is an authoring tile in the wider, wandering margin the wild land falls
 * away from before the coast is carved (so the shore near the edge comes out
 * in bays and headlands, not ruled straight along the band)?
 */
export function nearEdge(i: number, j: number): boolean {
  return edgeDistance(i, j) < EDGE + 2 + Math.max(0, fbm(i * 0.022, j * 0.022, 613) - 0.36) * 70 + (fbm(i * 0.09, j * 0.09, 614) - 0.5) * 8;
}

export interface Strait {
  key: string;
  name: string;
  hanzi: string;
  /** Its course (authoring grid), from sea to sea. */
  pts: [number, number][];
  /** Its width in authoring tiles. */
  width: number;
}

/** The straits that part the continents (authoring grid). */
export const STRAITS: Strait[] = [
  {
    // down from the gorge the great waterfall falls into, then east along the foot of the maple woods to the eastern sea
    key: "risingsun",
    name: "The Strait of the Rising Sun",
    hanzi: "旭日海峡",
    pts: [[334, 150], [334, 198], [339, 250], [342, 300], [350, 333], [380, 335], [420, 333], [460, 336], [500, 334], [540, 337], [580, 335], [620, 338], [652, 336]],
    width: 13,
  },
  {
    // from the western sea along the Mistmarsh's northern edge, then south between the marsh and the plum hills to the southern sea
    key: "reedwater",
    name: "The Reedwater Strait",
    hanzi: "芦水海峡",
    pts: [[-4, 243], [40, 242], [80, 244], [112, 246], [121, 270], [122, 300], [121, 340], [119, 380], [119, 420], [118, 460], [118, 500], [118, 530], [118, 562]],
    width: 12,
  },
];

/** Distance from a point to a polyline. */
function lineDistance(pts: [number, number][], x: number, y: number): number {
  let best = Infinity;
  for (let p = 1; p < pts.length; p++) {
    const [x0, y0] = pts[p - 1];
    const [x1, y1] = pts[p];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(x - x0 - dx * t, y - y0 - dy * t));
  }
  return best;
}

/** The strait an authoring tile lies in, if any (its shores wander a little). */
export function straitAt(i: number, j: number): Strait | null {
  for (const s of STRAITS) {
    const d = lineDistance(s.pts, i + 0.5, j + 0.5);
    if (d < s.width / 2 + (fbm(i * 0.09, j * 0.09, 612 + s.key.length) - 0.5) * 3) return s;
  }
  return null;
}

export interface Continent {
  key: string;
  name: string;
  hanzi: string;
  /** A point well inside it (authoring grid). */
  c: [number, number];
}

export const CONTINENTS: Continent[] = [
  { key: "middle", name: "The Middle Continent", hanzi: "中洲", c: [200, 166] },
  { key: "east", name: "The Eastern Continent", hanzi: "东洲", c: [470, 200] },
  { key: "west", name: "The Western Continent", hanzi: "西洲", c: [56, 340] },
  { key: "south", name: "The Southern Continent", hanzi: "南洲", c: [150, 720] },
];
