import { fbm, hash2 } from "../pixel/noise";
import { propDef, type PropId } from "../art/props";
import { AREA_IDS, getArea, type AreaDef, type AreaId, type Critter, type EnemySpawn, type Interactable, type NpcPlacement, type PropPlacement } from "./areas";
import { REGION_ORIGIN, rectDistance, regionRect, toWorld, WORLD_H, WORLD_W } from "./layout";
import { LIQUID, TileMap, type TileKind } from "./tilemap";

/**
 * The jianghu as one continuous map. The six hand-built regions are stamped
 * into a single tile grid. Generated wilds fill the land between them, and
 * the old highway, rivers and two sky bridges join them up. Every tile
 * belongs to the nearest region, which sets the sky, weather and light there
 * and decides where a sealed region's mist wall stands.
 */

export interface WorldDef extends AreaDef {
  /** Index into AREA_IDS of the region each tile belongs to. */
  regionOf: Uint8Array;
  /** The hand-built region templates (region-local coordinates): names, skies, weather. */
  regions: Record<AreaId, AreaDef>;
  /** Fast-travel landing spot of each region, in world tiles. */
  waypoints: Record<AreaId, [number, number]>;
}

type Mainland = "valley" | "bamboo" | "village" | "lake";
const MAINLAND: Mainland[] = ["valley", "bamboo", "village", "lake"];
const SKY: AreaId[] = ["sect", "peak"];

interface WildStyle {
  ground: (i: number, j: number) => TileKind;
  lift: number;
  trees: PropId[];
  treeP: number;
  extras: PropId[];
  extraP: number;
}

const WILD: Record<Mainland, WildStyle> = {
  valley: { ground: (i, j) => (fbm(i * 0.3, j * 0.3, 5) > 0.58 ? "redrock" : "ash"), lift: 1, trees: ["deadtree", "deadtree", "boulder"], treeP: 0.07, extras: ["bones", "spikes", "bones"], extraP: 0.05 },
  bamboo: { ground: (i, j) => (fbm(i * 0.2, j * 0.2, 9) > 0.62 ? "moss" : "leaf"), lift: 0, trees: ["bamboo", "bamboo", "bamboo", "pine"], treeP: 0.2, extras: ["rock", "tallgrass", "reeds"], extraP: 0.05 },
  village: { ground: (i, j) => (hash2(i, j, 9) > 0.8 ? "meadow" : "grass"), lift: 0, trees: ["maple", "cherry", "pine", "maple"], treeP: 0.06, extras: ["tallgrass", "rock", "tallgrass"], extraP: 0.06 },
  lake: { ground: (i, j) => (hash2(i, j, 4) > 0.82 ? "meadow" : "grass"), lift: 0, trees: ["willow", "pine", "willow"], treeP: 0.06, extras: ["reeds", "tallgrass", "rock"], extraP: 0.05 },
};

/** The old highway along the mainland's southern edge, and the branches up into each region. */
export const HIGHWAY: [number, number][] = [
  [8, 103],
  [22, 104.5],
  [40, 103],
  [60, 102.5],
  [80, 104],
  [100, 103],
  [120, 102],
  [140, 103],
  [150, 104],
];
const BRANCHES: [number, number][][] = [
  [
    [8, 103],
    [8, 97],
  ],
  [
    [60, 102.5],
    [60, 97],
  ],
  [
    [100, 103],
    [100, 97],
  ],
  [
    [140, 103],
    [140, 97],
  ],
];

const RIVERS: { pts: [number, number][]; kind: "water" | "lava"; width: number }[] = [
  // Willow Creek flows west into the bamboo grove's stream…
  {
    kind: "water",
    width: 3,
    pts: [
      [85, 76],
      [81, 76.5],
      [78, 77.5],
      [74, 78],
    ],
  },
  // …and east into the Lotus Lake…
  {
    kind: "water",
    width: 3,
    pts: [
      [114, 89],
      [120, 88],
      [126, 85],
      [132, 82],
    ],
  },
  // …which spills over the edge of the world as a waterfall.
  {
    kind: "water",
    width: 2.6,
    pts: [
      [146, 85],
      [152, 86],
      [162, 87],
    ],
  },
];

const inRect = (id: AreaId, i: number, j: number) => {
  const [x0, y0, x1, y1] = regionRect(id);
  return i >= x0 && j >= y0 && i < x1 && j < y1;
};

const mainlandMask = (i: number, j: number) => {
  const n = (fbm(i * 0.12, j * 0.12, 41) - 0.5) * 5;
  return j >= 62 + n && j <= 111 + n && i >= 1.5 + n * 0.6 && i <= 159.5 + n * 0.6;
};

/** Nearest mainland region, with a noisy border so biomes interleave. */
function wildRegion(i: number, j: number): Mainland {
  let best: Mainland = "village";
  let bd = Infinity;
  for (const id of MAINLAND) {
    const d = rectDistance(id, i + 0.5, j + 0.5) + (fbm(i * 0.17, j * 0.17, 60 + id.length) - 0.5) * 7;
    if (d < bd) {
      bd = d;
      best = id;
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
          const k = j * 4096 + i;
          if (seen.has(k)) continue;
          seen.add(k);
          fn(i, j);
        }
    }
  }
}

function buildWorld(): WorldDef {
  const m = new TileMap(WORLD_W, WORLD_H, "void", 0);
  /** 0 = wild, 1 = region template, 2 = carved road/river/bridge (fixed height). */
  const fixed = new Uint8Array(WORLD_W * WORLD_H);
  const wildOf = new Map<number, Mainland>();

  // 1. the mainland wilds
  m.each((i, j) => {
    if (!mainlandMask(i, j) && !MAINLAND.some((id) => inRect(id, i, j))) return;
    const r = wildRegion(i, j);
    wildOf.set(j * WORLD_W + i, r);
    const hills = 1 + Math.round((fbm(i * 0.07, j * 0.07, 31) - 0.45) * 3.2);
    m.set(i, j, WILD[r].ground(i, j), Math.max(0, Math.min(4, hills + WILD[r].lift)));
  });

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
    const [ox, oy] = REGION_ORIGIN[id];
    a.map.each((i, j) => {
      const k = a.map.kind(i, j);
      if (k === "void") return;
      m.set(ox + i, oy + j, k, a.map.height(i, j));
      fixed[(oy + j) * WORLD_W + ox + i] = 1;
    });
    for (const p of a.props) props.push({ ...p, i: p.i + ox, j: p.j + oy });
    for (const n of a.npcs) npcs.push({ ...n, i: n.i + ox, j: n.j + oy, route: n.route?.map(([x, y]) => [x + ox, y + oy]) });
    for (const e of a.enemies) enemies.push({ ...e, i: e.i + ox, j: e.j + oy });
    for (const it of a.interacts) interacts.push({ ...it, i: it.i + ox, j: it.j + oy });
    for (const c of a.critters ?? []) critters.push({ ...c, i: c.i + ox, j: c.j + oy });
  }

  // 3. rivers, ponds and the lava pool where the valley's river ends
  for (const r of RIVERS)
    stroke(r.pts, r.width, (i, j) => {
      if (m.kind(i, j) === "void") return;
      m.set(i, j, r.kind, 0);
      fixed[j * WORLD_W + i] = 2;
    });
  m.disc(41.5, 85.5, 2.8, "water", 0, 0.5, 70);
  m.disc(38, 74, 2.2, "lava", 0, 0.4, 71);
  for (let j = 68; j <= 92; j++) for (let i = 34; i <= 46; i++) if (LIQUID[m.kind(i, j)] && !fixed[j * WORLD_W + i]) fixed[j * WORLD_W + i] = 2;
  // sandy banks along the wild stretches of the rivers
  m.each((i, j) => {
    if (fixed[j * WORLD_W + i] || LIQUID[m.kind(i, j)] || m.kind(i, j) === "void") return;
    const wet = [-1, 0, 1].some((a) => [-1, 0, 1].some((b) => m.kind(i + a, j + b) === "water"));
    if (wet && wildOf.get(j * WORLD_W + i) !== "valley") m.set(i, j, "sand", 1);
  });

  // 4. the highway and its branches (wooden bridges where they cross water)
  const road = (pts: [number, number][], width: number, height: (i: number, j: number) => number) =>
    stroke(pts, width, (i, j) => {
      if (m.kind(i, j) === "void") return;
      const valley = (wildOf.get(j * WORLD_W + i) ?? (inRect("valley", i, j) ? "valley" : "")) === "valley";
      m.set(i, j, LIQUID[m.kind(i, j)] ? "wood" : valley ? "redrock" : "dirt", height(i, j));
      fixed[j * WORLD_W + i] = 2;
    });
  road(HIGHWAY, 2.4, () => 1);
  for (const b of BRANCHES) road(b, 2.2, (i, j) => (b[0][0] === 8 && j <= 100 ? 2 : 1));
  // the village's north road runs on to the mainland's edge…
  for (let j = 62; j <= 70; j++) for (let i = 99; i <= 101; i++) {
    m.set(i, j, "dirt", 1);
    fixed[j * WORLD_W + i] = 2;
  }
  // …where a sky bridge climbs to the sect gate,
  for (let j = 57; j <= 61; j++) for (let i = 99; i <= 101; i++) {
    m.set(i, j, j === 57 ? "dirt" : "wood", 2);
    fixed[j * WORLD_W + i] = 2;
  }
  // and a second one leads from behind the Hall of Clouds up to the peak.
  for (let j = 25; j <= 32; j++) for (let i = 101; i <= 103; i++) {
    m.set(i, j, j <= 25 ? "marble" : "wood", j <= 27 ? 3 : 4);
    fixed[j * WORLD_W + i] = 2;
  }

  // 5. keep the wilds walkable: no tile rises or falls more than a level per
  // tile away from a region, road or river (multi-source distance fields)
  const lo = new Float32Array(WORLD_W * WORLD_H).fill(-99);
  const hi = new Float32Array(WORLD_W * WORLD_H).fill(99);
  const q: number[] = [];
  m.each((i, j) => {
    const idx = j * WORLD_W + i;
    if (!fixed[idx] || m.kind(i, j) === "void") return;
    const h = m.height(i, j);
    lo[idx] = LIQUID[m.kind(i, j)] ? -99 : h;
    hi[idx] = h;
    q.push(idx);
  });
  for (let qi = 0; qi < q.length; qi++) {
    const idx = q[qi];
    const i = idx % WORLD_W;
    const j = (idx / WORLD_W) | 0;
    for (const [di, dj] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + di;
      const nj = j + dj;
      if (!m.inside(ni, nj) || m.kind(ni, nj) === "void" || fixed[nj * WORLD_W + ni]) continue;
      const n = nj * WORLD_W + ni;
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
    const idx = j * WORLD_W + i;
    if (fixed[idx] || m.kind(i, j) === "void") return;
    const h = m.height(i, j);
    m.set(i, j, undefined, Math.round(Math.max(lo[idx], Math.min(hi[idx], h))));
  });

  // 6. wayside landmarks, rewards and wanderers out in the wilds
  props.push(
    { id: "lantern", i: 97, j: 63 },
    { id: "lantern", i: 103, j: 63 },
    { id: "lantern", i: 98, j: 56 },
    { id: "shrine", i: 82, j: 99 },
    { id: "sign", i: 97, j: 101 },
    { id: "stele", i: 38, j: 101 },
    { id: "herb", i: 30, j: 106 },
    { id: "herb", i: 88, j: 107 },
    { id: "herb", i: 122, j: 107 },
    { id: "chest", i: 154, j: 106 },
    { id: "chest", i: 64, j: 107 },
    { id: "redlantern", i: 58, j: 100 },
    { id: "redlantern", i: 102, j: 100 },
    { id: "lantern", i: 138, j: 100 },
    { id: "brazier", i: 10, j: 100 },
  );
  for (let x = 16; x < 150; x += 14) {
    const [i, j] = [x, Math.round(roadY(x)) + (x % 28 === 2 ? -3 : 3)];
    props.push({ id: x < 40 ? "brazier" : "lantern", i, j });
  }
  interacts.push(
    { key: "road-shrine", kind: "shrine", i: 82, j: 99 },
    { key: "road-sign", kind: "sign", i: 97, j: 101, text: "A weathered milestone. ← West: the Whispering Bamboo Forest and, beyond the red mist, the Crimson Demon Valley. → East: the Moonlit Lotus Lake. ↑ North: Willow Creek, and the sky bridge to the Azure Cloud Sect." },
    { key: "road-stele", kind: "sign", i: 38, j: 101, text: "Scratched into the stone in a shaking hand: “Past this point the qi turns to blood. Turn back, traveller.”" },
    { key: "wild-herb-1", kind: "herb", i: 30, j: 106 },
    { key: "wild-herb-2", kind: "herb", i: 88, j: 107 },
    { key: "wild-herb-3", kind: "herb", i: 122, j: 107 },
    { key: "wild-chest-1", kind: "chest", i: 154, j: 106 },
    { key: "wild-chest-2", kind: "chest", i: 64, j: 107 },
  );
  npcs.push({
    key: "peddler",
    char: "peddler",
    i: 92,
    j: 103,
    dir: 4,
    route: [
      [66.5, 103.2],
      [96.5, 103.6],
    ],
    when: (f) => !!f.metElder,
  });
  enemies.push(
    { key: "wild-fox-1", enemy: "fox", i: 112, j: 107, range: 2 },
    { key: "wild-wolf-1", enemy: "wolf", i: 70, j: 107, range: 2 },
    { key: "wild-wolf-2", enemy: "wolf", i: 146, j: 107, range: 2 },
    { key: "wild-cultist-1", enemy: "cultist", i: 20, j: 106, range: 2 },
  );
  critters.push(
    { key: "crane-w1", char: "crane", i: 118, j: 92 },
    { key: "crane-w2", char: "crane", i: 79, j: 80 },
    { key: "bat-w1", char: "bat", i: 26, j: 94 },
  );

  // 7. scatter trees and undergrowth over the wilds, clear of roads and landmarks
  const taken = new Set(props.map((p) => p.j * WORLD_W + p.i));
  const keepClear = [...interacts, ...npcs, ...enemies, ...critters].map((x) => [x.i, x.j] as [number, number]);
  const clear = (i: number, j: number, r: number) => {
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (fixed[(j + dj) * WORLD_W + i + di] === 2) return false;
    return keepClear.every(([x, y]) => Math.hypot(x - i, y - j) > 2.2);
  };
  m.each((i, j) => {
    const idx = j * WORLD_W + i;
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
    if (id) {
      props.push({ id, i, j });
      taken.add(idx);
    }
  });

  // 8. props never stand in rivers, on roads or over the void
  const kept = props.filter((p) => {
    const d = propDef(p.id);
    for (let j = p.j + d.foot[1]; j <= p.j + d.foot[3]; j++)
      for (let i = p.i + d.foot[0]; i <= p.i + d.foot[2]; i++) {
        const k = m.kind(i, j);
        const wet = !!LIQUID[k] && p.id !== "lotus" && p.id !== "boat" && p.id !== "reeds";
        if (k === "void" || wet || (fixed[j * WORLD_W + i] === 2 && d.blocks)) return false;
      }
    return true;
  });
  for (const p of kept) {
    const d = propDef(p.id);
    if (!d.blocks) continue;
    for (let j = p.j + d.foot[1]; j <= p.j + d.foot[3]; j++) for (let i = p.i + d.foot[0]; i <= p.i + d.foot[2]; i++) m.block(i, j);
  }

  // 9. which region owns each tile
  const regionOf = new Uint8Array(WORLD_W * WORLD_H);
  m.each((i, j) => {
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
    map: m,
    base: 0,
    floating: true,
    arrive: waypoints.sect,
    props: kept,
    npcs,
    enemies,
    interacts,
    critters,
    regionOf,
    regions,
    waypoints,
  };
}

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
