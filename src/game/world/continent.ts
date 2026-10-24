import { fbm, hash2 } from "../pixel/noise";
import { propDef, type PropId } from "../art/props";
import { AREA_IDS, getArea, placementTiles, type AreaDef, type AreaId, type Critter, type EnemySpawn, type Interactable, type NpcPlacement, type PropPlacement } from "./areas";
import { getInterior, INTERIOR_IDS, interiorDoors } from "./interiors";
import { COARSE_H, COARSE_ORIGIN, COARSE_W, rectDistance, regionRect, toCoarse, toWorld, WORLD_H, WORLD_SCALE, WORLD_W } from "./layout";
import { companionOf, magnifyMap, magnifyProp, pointTile } from "./magnify";
import { LIQUID, TileMap, type TileKind } from "./tilemap";

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
const SKY: AreaId[] = ["sect", "peak"];

/** Wild biomes: the four mainland regions' own, plus the southern lands below the highway. */
type WildId = Mainland | "wastes" | "stoneforest" | "fields" | "highlands";

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

const WILD: Record<WildId, WildStyle> = {
  valley: { ground: ash, lift: 1, hills: 3.2, trees: ["deadtree", "deadtree", "boulder"], treeP: 0.07, extras: ["bones", "spikes", "bones"], extraP: 0.05, ashen: true },
  bamboo: { ground: (i, j) => (fbm(i * 0.2, j * 0.2, 9) > 0.62 ? "moss" : "leaf"), lift: 0, hills: 3.2, trees: ["bamboo", "bamboo", "bamboo", "pine"], treeP: 0.2, extras: ["rock", "tallgrass", "reeds"], extraP: 0.05 },
  village: { ground: (i, j) => (hash2(i, j, 9) > 0.8 ? "meadow" : "grass"), lift: 0, hills: 3.2, trees: ["maple", "cherry", "pine", "maple"], treeP: 0.06, extras: ["tallgrass", "rock", "tallgrass"], extraP: 0.06 },
  lake: { ground: (i, j) => (hash2(i, j, 4) > 0.82 ? "meadow" : "grass"), lift: 0, hills: 3.2, trees: ["willow", "pine", "willow"], treeP: 0.06, extras: ["reeds", "tallgrass", "rock"], extraP: 0.05 },
  wastes: { ground: ash, lift: 0, hills: 2.6, trees: ["deadtree", "boulder", "spikes", "deadtree"], treeP: 0.06, extras: ["bones", "bones", "rock"], extraP: 0.06, ashen: true },
  stoneforest: { ground: (i, j) => (fbm(i * 0.18, j * 0.18, 13) > 0.6 ? "moss" : hash2(i, j, 14) > 0.85 ? "meadow" : "grass"), lift: 0, hills: 2.6, trees: ["karst", "karst", "pine", "karst", "rock"], treeP: 0.1, extras: ["tallgrass", "rock", "tallgrass"], extraP: 0.06 },
  fields: { ground: (i, j) => (fbm(i * 0.15, j * 0.15, 17) > 0.6 ? "meadow" : hash2(i, j, 18) > 0.85 ? "meadow" : "grass"), lift: 0, hills: 1.8, trees: ["maple", "haystack", "cherry", "maple", "scarecrow"], treeP: 0.035, extras: ["tallgrass", "tallgrass", "rock"], extraP: 0.07 },
  highlands: { ground: (i, j) => (fbm(i * 0.09, j * 0.09, 31) > 0.66 ? "snow" : fbm(i * 0.25, j * 0.25, 19) > 0.64 ? "moss" : "grass"), lift: 1, hills: 4.4, trees: ["pine", "pine", "boulder", "pine", "rock"], treeP: 0.1, extras: ["rock", "tallgrass"], extraP: 0.05 },
};

/** The southern lands' biomes, as world rectangles [x0, y0, x1, y1]. */
const ZONES: [WildId, [number, number, number, number]][] = [
  ["wastes", [6, 184, 70, 228]],
  ["stoneforest", [82, 184, 140, 228]],
  ["fields", [156, 180, 222, 228]],
  ["highlands", [238, 178, 320, 228]],
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
];

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
];

const RIVERS: { pts: [number, number][]; kind: "water" | "lava"; width: number }[] = [
  // Willow Creek flows west into the bamboo grove's stream…
  { kind: "water", width: 3, pts: [[177, 108], [165, 110], [150, 116], [138, 121], [127, 124]] },
  // …and east past the watermill into the Lotus Lake…
  { kind: "water", width: 3, pts: [[207, 121], [222, 121], [238, 119], [252, 121], [265, 121]] },
  // …which spills over the eastern edge of the world as a waterfall.
  { kind: "water", width: 2.6, pts: [[280, 125], [296, 127], [310, 128], [324, 129]] },
  // The bamboo stream runs on west and south through the stone forest and off the southern cliffs.
  { kind: "water", width: 2.6, pts: [[93, 132], [86, 138], [81, 148], [78, 160], [75, 176], [80, 192], [76, 208], [72, 220], [70, 232]] },
  // A hot stream from the highland spring falls off the south edge too.
  { kind: "water", width: 2.2, pts: [[252, 195], [257, 206], [255, 218], [258, 232]] },
  // In the ashen wastes, lava wells up and pours off the world.
  { kind: "lava", width: 2.4, pts: [[56, 192], [60, 204], [57, 216], [60, 232]] },
];

const inRect = (id: AreaId, i: number, j: number) => {
  const [x0, y0, x1, y1] = regionRect(id, 1);
  return i >= x0 && j >= y0 && i < x1 && j < y1;
};

const mainlandMask = (i: number, j: number) => {
  const n = (fbm(i * 0.06, j * 0.06, 41) - 0.5) * 9 + (fbm(i * 0.2, j * 0.2, 42) - 0.5) * 2;
  return j >= 92 + n && j <= 226 + n && i >= 3 + n * 0.6 && i <= 320 + n * 0.6;
};

/** Floating isles in the sky: [centre x, centre y, radius, height]. */
const ISLES: { key: string; c: [number, number]; r: number; h: number }[] = [
  { key: "cloudrest", c: [192, 77], r: 4.4, h: 2 },
  { key: "cloudstepA", c: [219, 49], r: 4.6, h: 2 },
  { key: "cloudstepB", c: [236, 41], r: 3.8, h: 2 },
];

const rectDist = ([x0, y0, x1, y1]: [number, number, number, number], x: number, y: number) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));

/** Nearest wild biome, with a noisy border so biomes interleave. */
function wildRegion(i: number, j: number): WildId {
  let best: WildId = "village";
  let bd = Infinity;
  const consider = (id: WildId, d: number) => {
    const dd = d + (fbm(i * 0.17, j * 0.17, 60 + id.length) - 0.5) * 7;
    if (dd < bd) {
      bd = dd;
      best = id;
    }
  };
  for (const id of MAINLAND) consider(id, rectDistance(id, i + 0.5, j + 0.5, 1));
  for (const [id, r] of ZONES) consider(id, rectDist(r, i + 0.5, j + 0.5));
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
export const FLOATS = new Set<PropId>(["lotus", "boat", "reeds", "waterwheel"]);

function buildWorld(): WorldDef {
  const m = new TileMap(COARSE_W, COARSE_H, "void", 0);
  /** 0 = wild, 1 = region template or landmark site, 2 = carved road/river/bridge (fixed height). */
  const fixed = new Uint8Array(COARSE_W * COARSE_H);
  const wildOf = new Map<number, WildId>();
  const fix = (i: number, j: number, v: 1 | 2) => {
    if (m.inside(i, j)) fixed[j * COARSE_W + i] = v;
  };

  // 1. the mainland wilds
  m.each((i, j) => {
    if (!mainlandMask(i, j) && !MAINLAND.some((id) => inRect(id, i, j))) return;
    const r = wildRegion(i, j);
    wildOf.set(j * COARSE_W + i, r);
    const st = WILD[r];
    const hills = 1 + Math.round((fbm(i * 0.07, j * 0.07, 31) - 0.45) * st.hills);
    m.set(i, j, st.ground(i, j), Math.max(0, Math.min(5, hills + st.lift)));
  });
  const ashen = (i: number, j: number) => {
    const r = wildOf.get(j * COARSE_W + i);
    return r ? !!WILD[r].ashen : inRect("valley", i, j);
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
    m.each((i, j) => {
      if (Math.hypot(i - isle.c[0], j - isle.c[1]) < isle.r + 2 && m.kind(i, j) !== "void") {
        fix(i, j, 1);
        if (m.kind(i, j) === "grass" && hash2(i, j, 9) > 0.78) m.set(i, j, "meadow");
      }
    });
  }

  // 4. landmark sites in the wilds: levelled ground the roads lead to
  const site = (c: [number, number], r: number, kind: TileKind, h: number, rough = 0.6) => {
    m.each((i, j) => {
      const d = Math.hypot(i - c[0], j - c[1]);
      if (d > r + 1.5 || m.kind(i, j) === "void") return;
      const rr = r + (fbm(i * 0.35, j * 0.35, 90) - 0.5) * rough * 2;
      if (d <= rr) {
        m.set(i, j, kind, h);
        fix(i, j, 1);
      }
    });
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
  const [, valleyY] = toCoarse("valley", 0, 31);
  for (const b of BRANCHES) road(b.pts, 2.2, (i, j) => (b.valley && j <= valleyY + 2 ? 2 : 1));
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
  // snow only caps the higher highland hills
  m.each((i, j) => {
    if (!fixed[j * COARSE_W + i] && m.kind(i, j) === "snow" && m.height(i, j) < 3) m.set(i, j, "grass");
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
    npcs.push({ key: "wu", char: "farmer", i: 196, j: 186, dir: 3, wander: 1.5 });
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
  for (let x = 16; x < 310; x += 14) {
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
    const r = wildOf.get(idx);
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
  const finteracts: Interactable[] = [...interacts.map((x) => ({ ...x, ...xy(pt(x.i, x.j)) })), ...interiorDoors()];
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

  // 13. which region owns each tile
  const regionOf = new Uint8Array(WORLD_W * WORLD_H);
  fine.each((i, j) => {
    let best = 0;
    let bd = Infinity;
    AREA_IDS.forEach((id, n) => {
      const d = rectDistance(id, i + 0.5, j + 0.5);
      if (d < bd - 1e-6) {
        bd = d;
        best = n;
      }
    });
    regionOf[j * WORLD_W + i] = best;
  });

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
    landmarks: landmarks.map((l) => ({ ...l, x: l.x * S + (S - 1) / 2, y: l.y * S + (S - 1) / 2 })),
  };
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
