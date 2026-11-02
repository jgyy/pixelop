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
 * - Fusang (扶桑洲), the Dawn Continent, across the Strait of Dawn from
 *   Wavecrest Harbour: the Valley of Sunrise where the Fusang tree stands,
 *   the City of Ten Seats where the Synod legislates the Great Daos, and the
 *   Unbound's free port of Wuji on its southern horn;
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

/**
 * How far the coast is pushed about (authoring tiles): broad swells that
 * throw out headlands and bite in bays a few dozen tiles deep, and a finer
 * ripple on them, so no shore runs ruled along the box it was drawn in.
 */
export function coastWarp(i: number, j: number): [number, number] {
  const big = 30;
  const mid = 11;
  return [
    (fbm(i * 0.011, j * 0.011, 620) - 0.5) * 2 * big + (fbm(i * 0.04, j * 0.04, 622) - 0.5) * 2 * mid,
    (fbm(i * 0.011, j * 0.011, 621) - 0.5) * 2 * big + (fbm(i * 0.04, j * 0.04, 623) - 0.5) * 2 * mid,
  ];
}

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
  {
    // between Wavecrest Harbour's coast and Fusang, crossed only by the Dawn Causeway
    key: "dawn",
    name: "The Strait of Dawn",
    hanzi: "破晓海峡",
    pts: [[652, 150], [650, 200], [654, 252], [650, 300], [652, 360]],
    width: 16,
  },
];

/** Each strait's bounding box, grown by half its width, its wandering shores and the furthest its course can meander. */
const STRAIT_BOXES = STRAITS.map((st) => {
  const grow = st.width / 2 + 2 + 14;
  const xs = st.pts.map((p) => p[0]);
  const ys = st.pts.map((p) => p[1]);
  return [Math.min(...xs) - grow, Math.min(...ys) - grow, Math.max(...xs) + grow, Math.max(...ys) + grow] as const;
});

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

/**
 * The strait an authoring tile lies in, if any. Its course meanders (the
 * point is pushed about by slow noise before it is measured against the
 * ruled line) and its shores wander a little more on top of that.
 */
export function straitAt(i: number, j: number): Strait | null {
  // most of the world is nowhere near a strait: only the ones whose box (grown by the meander) holds the tile are measured
  if (!STRAIT_BOXES.some(([x0, y0, x1, y1]) => i >= x0 && i <= x1 && j >= y0 && j <= y1)) return null;
  const wx = (fbm(i * 0.021, j * 0.021, 630) - 0.5) * 22 + (fbm(i * 0.06, j * 0.06, 632) - 0.5) * 5;
  const wy = (fbm(i * 0.021, j * 0.021, 631) - 0.5) * 22 + (fbm(i * 0.06, j * 0.06, 633) - 0.5) * 5;
  for (const s of STRAITS) {
    const d = lineDistance(s.pts, i + 0.5 + wx, j + 0.5 + wy);
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
  { key: "fusang", name: "Fusang, the Dawn Continent", hanzi: "扶桑洲", c: [716, 300] },
];
