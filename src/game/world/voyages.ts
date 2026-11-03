import { hash2 } from "../pixel/noise";
import type { AnimId, CharId } from "../art/characters";
import type { Voyage } from "./areas";
import { LIQUID, type TileMap } from "./tilemap";
import { CITY, FOREST, GROVES, PORT } from "./heights";
import { HALLS } from "./halls";
import { COURTS } from "./courts";

/**
 * The jianghu's traffic by sea and by air.
 *
 * Junks under battened sails run between Hailing, the isles of the Sea of
 * Pearls and the Cliff Port; fishing skiffs work the shallows round the isles.
 * Overhead, disciples ride their swords between the Azure Cloud and Willow
 * Creek, a cloud-ship of the sects plies the long road south to the Hanging
 * City, sword-riders and an old immortal on his cloud circle the Hanging
 * City's summit, and cranes wheel over the Thousand-Pillar Forest.
 *
 * A sea lane is a loop of waypoints on the authoring grid; the ship's actual
 * course is found over the water between them (so it never runs aground, and
 * slips under the plank bridges between the isles). A sky lane is flown
 * straight.
 */

interface Lane {
  key: string;
  name: string;
  char: CharId;
  anim: AnimId;
  pts: [number, number][];
  speed: number;
  alt: number;
  /** How many travel it, spaced evenly round the loop. */
  n: number;
  outfit?: string;
  /** Others who fly with the first, by look (cycled). */
  crew?: CharId[];
}

const ring = (c: [number, number], r: number, n = 10, a0 = 0): [number, number][] => Array.from({ length: n }, (_, k) => [Math.round(c[0] + Math.cos(a0 + (k / n) * Math.PI * 2) * r), Math.round(c[1] + Math.sin(a0 + (k / n) * Math.PI * 2) * r * 0.8)] as [number, number]);

/** Hailing, the port of the Tidewater Reach (as world/continent.ts lays it out): its square, and the water off its south quay. */
const HAILING_C: [number, number] = [547, 502];
const QUAY: [number, number] = [547, 534];
const YAGANG: [number, number] = [PORT.quay + 12, Math.round((PORT.y0 + PORT.y1) / 2)];

export const SEA_LANES: Lane[] = [
  { key: "pearlrun", name: "the junk Pearl of the South", char: "junk", anim: "idle", speed: 2.4, alt: 0, n: 2, pts: [QUAY, [578, 596], [596, 664], [600, 700], [552, 770], [470, 784], [404, 748], [352, 686], YAGANG, [420, 616], [500, 560]] },
  { key: "ferry", name: "the Yagang ferry", char: "junk", anim: "idle", speed: 2, alt: 0, n: 1, pts: [YAGANG, [300, 690], [330, 624], [420, 596], [500, 566], QUAY, [496, 580], [410, 610], [320, 640]] },
  { key: "southrun", name: "a salt junk", char: "junk", anim: "idle", speed: 1.8, alt: 0, n: 1, pts: [[330, 760], [420, 790], [520, 792], [620, 760], [640, 680], [560, 740], [460, 770], [380, 740]] },
  { key: "skiff-turtle", name: "a fishing skiff", char: "skiff", anim: "idle", speed: 1.3, alt: 0, n: 2, pts: ring([458, 636], 46, 12) },
  { key: "skiff-crescent", name: "a fishing skiff", char: "skiff", anim: "idle", speed: 1.2, alt: 0, n: 2, pts: ring([522, 684], 40, 12, 0.5) },
  { key: "skiff-yagang", name: "a fishing skiff", char: "skiff", anim: "idle", speed: 1.1, alt: 0, n: 2, pts: [[YAGANG[0], YAGANG[1] - 18], [300, 700], [312, 740], [290, 770], [YAGANG[0], YAGANG[1] + 18]] },
  { key: "skiff-pearlgate", name: "a pearl-diver's skiff", char: "skiff", anim: "idle", speed: 1.2, alt: 0, n: 1, pts: ring([538, 600], 42, 12, 1) },
];

const SECT_GATE: [number, number] = [192, 62];
const WILLOW: [number, number] = [192, 116];

export const SKY_LANES: Lane[] = [
  // the Azure Cloud's disciples ride their swords down to Willow Creek on the sect's errands, and back
  { key: "sword-willow", name: "an Azure Cloud disciple on her sword", char: "discipleF", anim: "fly", speed: 3.6, alt: 5, n: 4, crew: ["discipleF", "discipleM", "outerF", "discipleM"], pts: [[SECT_GATE[0] - 4, SECT_GATE[1] - 6], [WILLOW[0] + 8, WILLOW[1] - 4], [WILLOW[0] - 10, WILLOW[1] + 4], [SECT_GATE[0] - 12, SECT_GATE[1]]] },
  // and out over the Cloudstep Isles and round the sect, practising
  { key: "sword-sect", name: "a disciple at sword-flight practice", char: "discipleM", anim: "fly", speed: 3, alt: 6, n: 3, crew: ["discipleM", "outerM", "discipleF"], pts: ring([200, 48], 26, 12) },
  // the sects' cloud-ship: the long road south, from the Azure Cloud to the Ten Halls, Jinhe, the City of Nine Tiers and the Hanging City, and home by the west
  { key: "cloudship", name: "the Azure Cloud's cloud-ship", char: "skyjunk", anim: "idle", speed: 4.2, alt: 13, n: 2, pts: [[200, 40], [190, 200], HALLS.c, [222, 500], [222, 610], CITY.c, [Math.round((FOREST[0] + FOREST[2]) / 2), FOREST[1] + 20], [60, 520], [40, 300], [80, 120]] },
  // a second plies the east: Hailing, the Tidewater Reach, the capitals of the east and Frostveil
  { key: "cloudship-east", name: "the Golden Crane's cloud-ship", char: "skyjunk", anim: "idle", speed: 3.6, alt: 13, n: 1, pts: [HAILING_C, COURTS[1].c, COURTS[4].c, COURTS[3].c, [400, 166], [300, 300], [380, 470]] },
  // sword-riders and an immortal on his cloud round the Hanging City's summit
  { key: "sword-xuancheng", name: "a sword-rider of the Hanging City", char: "swordsman", anim: "fly", speed: 3.2, alt: 6, n: 3, crew: ["swordsman", "discipleF", "outerM"], pts: ring(CITY.c, CITY.R - 8, 14) },
  { key: "immortal-xuancheng", name: "an old immortal on his cloud", char: "monk", anim: "cloudride", speed: 1.4, alt: 5, n: 1, pts: ring(CITY.c, 22, 10, 1.2) },
  // cranes wheel over the Thousand-Pillar Forest, and one old hermit rides his cloud between the groves
  { key: "cranes-pillars", name: "a crane", char: "crane", anim: "fly", speed: 2.4, alt: 7, n: 4, pts: ring([Math.round((FOREST[0] + FOREST[2]) / 2), Math.round((FOREST[1] + FOREST[3]) / 2)], 38, 12) },
  { key: "monk-cloud", name: "a wandering immortal on his cloud", char: "monk", anim: "cloudride", speed: 1.2, alt: 4, n: 1, pts: GROVES.map((g) => g.c) },
  // and cranes over the Sea of Pearls
  { key: "cranes-sea", name: "a sea crane", char: "crane", anim: "fly", speed: 2.8, alt: 6, n: 3, pts: ring([500, 660], 80, 14, 0.3) },
  // and over the Three Isles of the Immortals: cranes round Penglai's golden terraces, and an immortal riding his cloud from isle to isle
  { key: "cranes-penglai", name: "an immortal's crane", char: "crane", anim: "fly", speed: 2.6, alt: 9, n: 5, pts: ring([838, 214], 34, 12, 0.2) },
  { key: "immortal-isles", name: "an immortal on his cloud", char: "hermit", anim: "cloudride", speed: 1.6, alt: 7, n: 1, pts: [[838, 204], [852, 330], [852, 420], [836, 520], [826, 596], [848, 470], [860, 300]] },
];

/** Can a ship pass this tile (open water, or under a plank bridge)? */
const sails = (m: TileMap, i: number, j: number) => {
  const k = m.kind(i, j);
  return !!LIQUID[k] && k !== "lava" && k !== "paddy";
};
const roomy = (m: TileMap, i: number, j: number) => {
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if (!sails(m, i + a, j + b) && m.kind(i + a, j + b) !== "wood") return false;
  return true;
};

/** The nearest roomy water to a point (searching outward), or null. */
function snapWater(m: TileMap, [x, y]: [number, number]): [number, number] | null {
  for (let r = 0; r < 40; r++)
    for (let b = -r; b <= r; b++)
      for (let a = -r; a <= r; a++) {
        if (Math.max(Math.abs(a), Math.abs(b)) !== r) continue;
        if (roomy(m, x + a, y + b)) return [x + a, y + b];
      }
  return null;
}

/** The shortest course over the water (8 ways, under the bridges) between two points, or null. */
function course(m: TileMap, from: [number, number], to: [number, number]): [number, number][] | null {
  const W = m.w;
  const prev = new Int32Array(W * m.h).fill(-1);
  const start = from[1] * W + from[0];
  const goal = to[1] * W + to[0];
  prev[start] = start;
  const q = [start];
  for (let n = 0; n < q.length; n++) {
    const c = q[n];
    if (c === goal) break;
    const i = c % W;
    const j = (c - i) / W;
    for (const [a, b] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const ni = i + a;
      const nj = j + b;
      const k = nj * W + ni;
      if (!m.inside(ni, nj) || prev[k] >= 0) continue;
      const k2 = m.kind(ni, nj);
      if (!(sails(m, ni, nj) || k2 === "wood") || !roomy(m, ni, nj)) continue;
      prev[k] = c;
      q.push(k);
    }
  }
  if (prev[goal] < 0) return null;
  const out: [number, number][] = [];
  for (let c = goal; c !== start; c = prev[c]) out.push([c % W, Math.floor(c / W)]);
  out.push(from);
  return out.reverse();
}

/** Drop the points of a course that a straight run over roomy water can skip. */
function pull(m: TileMap, pts: [number, number][]): [number, number][] {
  const clear = (a: [number, number], b: [number, number]) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let s = 0; s <= n; s++) {
      const i = Math.round(a[0] + ((b[0] - a[0]) * s) / n);
      const j = Math.round(a[1] + ((b[1] - a[1]) * s) / n);
      if (!roomy(m, i, j)) return false;
    }
    return true;
  };
  const out = [pts[0]];
  let k = 0;
  while (k < pts.length - 1) {
    let far = k + 1;
    for (let n = Math.min(pts.length - 1, k + 60); n > k + 1; n--)
      if (clear(pts[k], pts[n])) {
        far = n;
        break;
      }
    out.push(pts[far]);
    k = far;
  }
  return out;
}

/**
 * Chart every lane over the finished authoring grid and set its travellers
 * out round it, in world tiles (the grid magnified `scale` times).
 */
export function chartVoyages(m: TileMap, scale: number): Voyage[] {
  const out: Voyage[] = [];
  const toWorld = ([x, y]: [number, number]): [number, number] => [x * scale + scale / 2, y * scale + scale / 2];
  const crew = (L: Lane, n: number) => L.crew?.[n % L.crew.length] ?? L.char;
  for (const L of SEA_LANES) {
    const stops = L.pts.map((p) => snapWater(m, p)).filter((p): p is [number, number] => !!p);
    const loop: [number, number][] = [];
    let ok = stops.length >= 2;
    for (let s = 0; s < stops.length && ok; s++) {
      const leg = course(m, stops[s], stops[(s + 1) % stops.length]);
      if (!leg) ok = false;
      else loop.push(...pull(m, leg).slice(0, -1));
    }
    if (!ok || loop.length < 2) continue;
    const route = loop.map(toWorld);
    for (let n = 0; n < L.n; n++) out.push({ key: `voy-${L.key}-${n}`, name: L.name, char: crew(L, n), anim: L.anim, route, speed: L.speed, alt: 0, phase: n / L.n + hash2(n, L.key.length, 801) * 0.05 });
  }
  for (const L of SKY_LANES) {
    const route = L.pts.map(toWorld);
    for (let n = 0; n < L.n; n++) out.push({ key: `voy-${L.key}-${n}`, name: L.name, char: crew(L, n), anim: L.anim, route, speed: L.speed * (1 + (n % 3) * 0.06), alt: L.alt + (n % 2) * 0.8, phase: n / L.n });
  }
  return out;
}

/** Where a traveller is on its loop at a clock time: position, heading and which leg. */
export function voyageAt(v: Pick<Voyage, "route" | "speed" | "phase">, t: number, lengths?: number[]): { x: number; y: number; dx: number; dy: number } {
  const r = v.route;
  const L = lengths ?? loopLengths(r);
  const total = L[L.length - 1];
  let s = (((t * v.speed + v.phase * total) % total) + total) % total;
  let k = 0;
  while (k < r.length - 1 && L[k + 1] <= s) k++;
  s -= L[k];
  const a = r[k];
  const b = r[(k + 1) % r.length];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const u = Math.min(1, s / len);
  return { x: a[0] + (b[0] - a[0]) * u, y: a[1] + (b[1] - a[1]) * u, dx: b[0] - a[0], dy: b[1] - a[1] };
}

/** Running length of a closed loop at each of its points (and the whole loop last). */
export function loopLengths(r: [number, number][]): number[] {
  const out = [0];
  for (let k = 0; k < r.length; k++) {
    const a = r[k];
    const b = r[(k + 1) % r.length];
    out.push(out[k] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return out;
}
