import { PixelBuffer } from "../pixel/PixelBuffer";
import { alpha, mix, shade } from "../pixel/color";
import { hash2, fbm } from "../pixel/noise";
import { drawText, textWidth } from "../pixel/font";
import type { Surface } from "../pixel/surface";
import { charDef, frameAt, getAnim } from "../art/characters";
import { getPropScaled } from "../art/props";
import { drawSky } from "../art/sky";
import { getArea } from "../world/areas";
import { getRoom } from "../world/rooms";
import { AREA_IDS, type AreaId } from "../world/ids";
import { flightPath, MAP_H, MAP_SCALE, MAP_W, mapLandmarks, mapTerrain, NODES, type Biome } from "../world/overworld";
import { getWorld, regionAt } from "../world/continent";
import type { CaveId } from "../world/caves";
import { GUIXU } from "../world/immortals";
import { CONTINENTS } from "../world/oceans";
import { WORLD_SCALE } from "../world/layout";
import { DEEPS, deepOf, veinEnd, VEINS } from "../world/underworld";
import { dirFrom } from "./world";

/** Miniature isometric projection for the world map (16×8 tiles, 4 px per level). */
const mx = (x: number, y: number) => (x - y) * 8;
const my = (x: number, y: number, h = 0) => (x + y) * 4 - h * 4;
const MAX_H = 16;
const OX = MAP_H * 8 + 8;
const OY = MAX_H * 4 + 12;

const TOP: Record<Biome, string[]> = {
  void: ["#000000", "#000000", "#000000"],
  redrock: ["#6e2e24", "#84382a", "#5a2420"],
  sea: ["#1e4a8a", "#24549a", "#2a5ea6"],
  shore: ["#d8bc7c", "#e6cc8e", "#c8a86a"],
  plain: ["#6aa848", "#78b852", "#62a044"],
  meadow: ["#80c058", "#8ccc62", "#78b852"],
  forest: ["#3a7a3a", "#468a40", "#326a34"],
  bamboo: ["#4a8a40", "#56984a", "#3e7a38"],
  mountain: ["#8a8296", "#9a92a6", "#7a7288"],
  snow: ["#eef2fa", "#ffffff", "#dce4f4"],
  ash: ["#3a2a3a", "#46344a", "#2e2232"],
  lava: ["#e05a1a", "#f08a2a", "#c03a10"],
  lake: ["#2a62a6", "#3a7cc0", "#2a5a9a"],
  river: ["#2a62a6", "#3a7cc0", "#2a5a9a"],
  road: ["#c8a070", "#d4ae80", "#b89060"],
};

const SIDE: Partial<Record<Biome, string>> = { sea: "#183a6a", lake: "#1e4a80", river: "#1e4a80", snow: "#9a9ab6", mountain: "#5a5068", ash: "#241a26", redrock: "#4a1c1a", lava: "#8a2a10", shore: "#a8885a" };

let staticMap: PixelBuffer | null = null;

function paintStatic(): PixelBuffer {
  if (staticMap) return staticMap;
  const cells = mapTerrain();
  const W = (MAP_W + MAP_H) * 8 + 16;
  const H = (MAP_W + MAP_H) * 4 + OY + 16;
  const b = new PixelBuffer(W, H);
  for (let k = 0; k < MAP_W + MAP_H; k++)
    for (let x = 0; x < MAP_W; x++) {
      const y = k - x;
      if (y < 0 || y >= MAP_H) continue;
      const c = cells[y * MAP_W + x];
      if (c.biome === "void") continue;
      const tx = OX + mx(x, y);
      const ty = OY + my(x, y, c.h);
      const side = SIDE[c.biome] ?? "#6a4a32";
      // walls (a long rocky underside where the land ends above the clouds)
      const edge = (x + 1 < MAP_W ? cells[y * MAP_W + x + 1].biome === "void" : true) || (y + 1 < MAP_H ? cells[(y + 1) * MAP_W + x].biome === "void" : true);
      // water at the edge of the world (the rim, Guixu's lip, or under the sect's cloud) pours over it in a long curtain
      const wet = c.biome === "sea" || c.biome === "lake" || c.biome === "river";
      const under = edge ? (wet ? 34 : c.sky ? 26 : 14) : 0;
      const front = Math.min(x + 1 < MAP_W ? cells[y * MAP_W + x + 1].h : 0, y + 1 < MAP_H ? cells[(y + 1) * MAP_W + x].h : 0);
      const wall = (edge ? Math.min(c.h, 3) : Math.max(0, c.h - front)) * 4 + 4 + under;
      const edgeY = (px: number) => (px < 8 ? 4 + px * 0.5 : 8 - (px - 7) * 0.5);
      for (let px = 0; px < 16; px++) {
        const left = px < 8;
        const taper = under ? Math.floor(wall - under + under * (0.3 + 0.7 * hash2(x * 16 + px, y, 5))) : wall;
        for (let dy = 0; dy < taper; dy++) {
          let col = side;
          if (dy < 1 && c.biome !== "sea" && c.biome !== "lake" && c.biome !== "river") col = TOP[c.biome][2];
          if (dy > wall - under) col = shade("#6a5a6a", 0.9 - ((dy - (wall - under)) / Math.max(1, under)) * 0.4);
          if (wet && edge) {
            // the falls: streaks of white in blue, thinning into spray as they drop away
            const k = dy / Math.max(1, taper);
            const streak = hash2(x * 16 + px, y, 11) > 0.55;
            col = mix(streak ? "#e8f6ff" : "#5a9ad6", "#ffffff", k * 0.5);
            if (k > 0.6 && hash2(x * 16 + px, y * 64 + dy, 12) < (k - 0.6) * 2.2) continue;
            b.px(tx - 8 + px, ty + Math.ceil(edgeY(px)) + dy, alpha(shade(col, left ? 1 : 0.86), 1 - k * 0.55));
            continue;
          }
          b.px(tx - 8 + px, ty + Math.ceil(edgeY(px)) + dy, shade(col, left ? 0.95 : 0.72));
        }
      }
      // top
      for (let py = 0; py < 8; py++)
        for (let px = 0; px < 16; px++) {
          const sx = px - 8 + 0.5;
          const sy = py + 0.5;
          const a = (sx / 8 + sy / 4) / 2;
          const bb = (sy / 4 - sx / 8) / 2;
          if (a < 0 || bb < 0 || a >= 1 || bb >= 1) continue;
          const n = fbm((x + a) * 1.3, (y + bb) * 1.3, 4);
          const tones = TOP[c.biome];
          let col = tones[n > 0.6 ? 1 : n < 0.38 ? 2 : 0];
          if (c.biome === "meadow" && hash2(px + x * 16, py + y * 8, 3) > 0.94) col = ["#ffffff", "#f6a6c9", "#ffe070"][Math.floor(hash2(px, py, x + y) * 3)];
          if (c.biome === "ash" && Math.abs(n - 0.5) < 0.012) col = "#ff6a2a";
          if (c.biome === "mountain" && c.h > 6 && py < 3) col = mix(col, "#ffffff", 0.6);
          b.px(tx - 8 + px, ty + py, col);
        }
      // baked miniature trees / bamboo / peaks
      if (c.biome === "forest" && hash2(x, y, 7) > 0.35) {
        const fx = tx - 3 + Math.floor(hash2(x, y, 8) * 6);
        const fy = ty + 2;
        b.rect(fx, fy - 1, 1, 3, "#4a3a2a");
        b.ellipse(fx, fy - 3, 2.5, 2.5, "#2a5a2e");
        b.px(fx - 1, fy - 5, "#5a9a4a");
        b.px(fx, fy - 5, "#5a9a4a");
      }
      if (c.biome === "bamboo") for (let k2 = 0; k2 < 3; k2++) b.rect(tx - 5 + k2 * 4 + Math.floor(hash2(x, y, k2) * 2), ty - 6 + k2, 1, 8, k2 % 2 ? "#7ab848" : "#5a9a3a");
      if (c.biome === "mountain" && hash2(x, y, 9) > 0.7) b.polygon([[tx - 5, ty + 5], [tx + 5, ty + 5], [tx, ty - 5]], c.h > 6 ? "#e8ecf6" : "#7a7088");
    }
  staticMap = b;
  return b;
}

type UnderBiome = "abyss" | "rock" | "deeprock" | "magma" | "ice" | "river" | "sand" | "root";

const UNDER_TOP: Record<UnderBiome, string[]> = {
  abyss: ["#070812", "#0b0d1c", "#05060c"],
  rock: ["#2e2638", "#372e42", "#272030"],
  deeprock: ["#40364c", "#4a3f58", "#352c40"],
  magma: ["#4a1810", "#5e2014", "#3a120c"],
  ice: ["#4a6a8a", "#5a7ea0", "#3e5a78"],
  river: ["#123a6a", "#1a4a82", "#0e2e56"],
  sand: ["#4a3a28", "#564432", "#3e3020"],
  root: ["#2a3626", "#33422e", "#222c1e"],
};

/** What lies under each kind of land: black water under the sea, magma under the ash and the lava, old ice under the snows. */
function underOf(b: Biome): UnderBiome | null {
  switch (b) {
    case "void":
      return null;
    case "sea":
      return "abyss";
    case "lake":
    case "river":
      return "river";
    case "lava":
    case "ash":
    case "redrock":
      return "magma";
    case "snow":
      return "ice";
    case "mountain":
      return "deeprock";
    case "shore":
      return "sand";
    case "forest":
    case "bamboo":
      return "root";
    default:
      return "rock";
  }
}

let underMap: PixelBuffer | null = null;

/** The Underworld chart: the living rock under the jianghu, cut away like a cavern (generated once). */
function paintUnder(): PixelBuffer {
  if (underMap) return underMap;
  const cells = mapTerrain();
  const W = (MAP_W + MAP_H) * 8 + 16;
  const H = (MAP_W + MAP_H) * 4 + OY + 16;
  const b = new PixelBuffer(W, H);
  const kind = (x: number, y: number) => (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H ? underOf(cells[y * MAP_W + x].biome) : null);
  const lift = (x: number, y: number) => {
    const k = kind(x, y);
    const c = cells[y * MAP_W + x];
    return k === "abyss" || k === "river" ? 0 : k === "deeprock" || k === "ice" ? 2 + Math.min(3, Math.floor(c.h / 5)) : 1;
  };
  for (let k = 0; k < MAP_W + MAP_H; k++)
    for (let x = 0; x < MAP_W; x++) {
      const y = k - x;
      if (y < 0 || y >= MAP_H) continue;
      const u = kind(x, y);
      if (!u) continue;
      const h = lift(x, y);
      const tx = OX + mx(x, y);
      const ty = OY + my(x, y, h);
      const edge = !kind(x + 1, y) || !kind(x, y + 1);
      const front = Math.min(kind(x + 1, y) ? lift(x + 1, y) : 0, kind(x, y + 1) ? lift(x, y + 1) : 0);
      const wall = (edge ? 3 : Math.max(0, h - front)) * 4 + (edge ? 22 : 2);
      const edgeY = (px: number) => (px < 8 ? 4 + px * 0.5 : 8 - (px - 7) * 0.5);
      for (let px = 0; px < 16; px++) {
        const left = px < 8;
        const taper = edge ? Math.floor(wall * (0.45 + 0.55 * hash2(x * 16 + px, y, 15))) : wall;
        for (let dy = 0; dy < taper; dy++) {
          // the rock face: strata, and here and there a vein of ore glinting in it
          let col = u === "magma" ? (dy % 5 === 2 ? "#a83a14" : "#3a1410") : u === "ice" ? "#2e4660" : u === "abyss" ? "#04050a" : dy % 6 === 3 ? "#221a2a" : "#1a1420";
          if (edge && dy > wall * 0.55) col = mix(col, "#000000", (dy / wall - 0.55) * 1.6);
          if (u !== "abyss" && hash2(x * 16 + px, y * 64 + dy, 16) > 0.985) col = ["#ffd23a", "#9ff5de", "#c08aff"][Math.floor(hash2(x, dy, 17) * 3)];
          b.px(tx - 8 + px, ty + Math.ceil(edgeY(px)) + dy, shade(col, left ? 0.95 : 0.7));
        }
      }
      for (let py = 0; py < 8; py++)
        for (let px = 0; px < 16; px++) {
          const sx = px - 8 + 0.5;
          const sy = py + 0.5;
          const a = (sx / 8 + sy / 4) / 2;
          const bb = (sy / 4 - sx / 8) / 2;
          if (a < 0 || bb < 0 || a >= 1 || bb >= 1) continue;
          const n = fbm((x + a) * 1.3, (y + bb) * 1.3, 24);
          const tones = UNDER_TOP[u];
          let col = tones[n > 0.6 ? 1 : n < 0.38 ? 2 : 0];
          // cracks of magma, frost in the ice, a speck of glowing moss on the roots
          if (u === "magma" && Math.abs(n - 0.5) < 0.03) col = n > 0.5 ? "#ff8a2a" : "#ffd23a";
          if (u === "ice" && hash2(px + x * 16, py + y * 8, 25) > 0.93) col = "#dff4ff";
          if (u === "root" && hash2(px + x * 16, py + y * 8, 26) > 0.96) col = "#7affc8";
          if (u === "abyss" && hash2(px + x * 16, py + y * 8, 27) > 0.995) col = "#3a4a8a";
          b.px(tx - 8 + px, ty + py, col);
        }
      // stalagmites standing up out of the deep rock
      if ((u === "deeprock" || u === "rock") && hash2(x, y, 28) > 0.9) {
        const fx = tx - 3 + Math.floor(hash2(x, y, 29) * 6);
        b.polygon([[fx - 2, ty + 5], [fx + 2, ty + 5], [fx, ty - 3 - Math.floor(hash2(x, y, 30) * 4)]], u === "deeprock" ? "#5a4e6a" : "#463a52");
      }
      if (u === "ice" && hash2(x, y, 31) > 0.82) b.polygon([[tx - 3, ty + 5], [tx + 2, ty + 5], [tx, ty - 5]], "#bfe8ff");
    }
  underMap = b;
  return b;
}

/** Which layer of the world the map shows: the lands under heaven, or what lies under them. */
export type MapLayer = "over" | "under";

/** Overworld runtime: the heroine's flying-sword token over a miniature of the real world. */
export class WorldMap {
  /** What Lin Yue is wearing as she flies over the map. */
  outfit?: string;
  at: AreaId;
  pos: [number, number];
  dir = 2;
  private legs: { to: AreaId; deep?: CaveId; path: [number, number][]; k: number; speed: number }[] = [];
  camX = 0;
  camY = 0;
  private camInit = false;
  /** The layer shown: the Overworld (the lands, and the regions to fly to) or the Underworld (the deeps, and the veins between them). */
  layer: MapLayer = "over";
  /** The deep whose mouth she hovers over on the Underworld chart (null: none). */
  deep: CaveId | null = null;
  /** The whole world at a glance (Z): the chart shrunk to fit the screen, instead of the close view that follows her. */
  overview = false;
  /** Where the shrunk chart was drawn on the last overview frame (for hit-testing). */
  private ov = { x: 0, y: 0, k: 3 };

  /** `hero` is the heroine's position in world tiles (defaults to the region's landmark). */
  constructor(at: AreaId, hero?: [number, number]) {
    this.at = at;
    this.pos = hero ? [hero[0] / MAP_SCALE, hero[1] / MAP_SCALE] : [NODES[at].x, NODES[at].y];
  }

  get travelling(): boolean {
    return this.legs.length > 0;
  }

  /** Destination of the current journey (or the node we stand on). */
  get heading(): AreaId {
    return this.legs.length ? this.legs[this.legs.length - 1].to : this.at;
  }

  /** Turn the chart over: from the lands to what lies under them, or back. */
  toggleLayer(): MapLayer {
    this.layer = this.layer === "over" ? "under" : "over";
    return this.layer;
  }

  /** Where a deep's mouth is on the map (map cells). */
  static deepCell(id: CaveId): [number, number] {
    const [x, y] = deepOf(id).at;
    return [(x * WORLD_SCALE + 1) / MAP_SCALE, (y * WORLD_SCALE) / MAP_SCALE];
  }

  /** The region a deep's mouth opens in. */
  static deepRegion(id: CaveId): AreaId {
    const [x, y] = deepOf(id).at;
    return regionAt(getWorld(), x * WORLD_SCALE + 1, y * WORLD_SCALE);
  }

  /** Fly to the mouth of a deep, on the Underworld chart. Returns false if she is already over it or already flying. */
  travelToDeep(id: CaveId): boolean {
    if (this.travelling || this.deep === id) return false;
    const path = flightPath(this.pos, WorldMap.deepCell(id));
    const length = path.reduce((l, p, k) => (k ? l + Math.hypot(p[0] - path[k - 1][0], p[1] - path[k - 1][1]) : 0), 0);
    this.legs.push({ to: WorldMap.deepRegion(id), deep: id, path, k: 0, speed: Math.max(14, length / 4) });
    return true;
  }

  /** Begin a sword flight to an unlocked region. Returns false if it is sealed (or we're already there). */
  travelTo(target: AreaId, unlocked: (id: AreaId) => boolean): boolean {
    if (this.travelling || target === this.at || !unlocked(target)) return false;
    const path = flightPath(this.pos, [NODES[target].x, NODES[target].y]);
    this.deep = null;
    // the jianghu is wide now: long flights go faster, so none takes much more than four seconds
    const length = path.reduce((l, p, k) => (k ? l + Math.hypot(p[0] - path[k - 1][0], p[1] - path[k - 1][1]) : 0), 0);
    this.legs.push({ to: target, path, k: 0, speed: Math.max(14, length / 4) });
    return true;
  }

  /** Arrow-key navigation: fly to the unlocked region lying closest to the pressed screen direction. */
  nudge(sx: number, sy: number, unlocked: (id: AreaId) => boolean, deepOpen: (id: CaveId) => boolean = () => true): AreaId | CaveId | null {
    if (this.travelling) return null;
    const [hx, hy] = this.pos;
    if (this.layer === "under") {
      let pick: CaveId | null = null;
      let top = 0;
      for (const d of DEEPS) {
        if (d.id === this.deep || !deepOpen(d.id)) continue;
        const [ox, oy] = WorldMap.deepCell(d.id);
        const dx = mx(ox, oy) - mx(hx, hy);
        const dy = my(ox, oy) - my(hx, hy);
        const l = Math.hypot(dx, dy) || 1;
        const dot = (dx / l) * sx + (dy / l) * sy;
        const score = dot > 0.35 ? dot / Math.sqrt(l) : 0;
        if (score > top) {
          top = score;
          pick = d.id;
        }
      }
      if (pick) this.travelToDeep(pick);
      return pick;
    }
    let best: AreaId | null = null;
    let bestScore = 0;
    for (const n of AREA_IDS) {
      if (n === this.at || !unlocked(n)) continue;
      const o = NODES[n];
      const dx = mx(o.x, o.y) - mx(hx, hy);
      const dy = my(o.x, o.y) - my(hx, hy);
      const l = Math.hypot(dx, dy) || 1;
      const dot = (dx / l) * sx + (dy / l) * sy;
      // prefer what lies in that direction, then what is nearest
      const score = dot > 0.35 ? dot / Math.sqrt(l) : 0;
      if (score > bestScore) {
        bestScore = score;
        best = n;
      }
    }
    if (best) this.travelTo(best, unlocked);
    return best;
  }

  /** Advance travel; returns the node just arrived at, if any. */
  update(dt: number): AreaId | null {
    const leg = this.legs[0];
    if (!leg) return null;
    let move = dt * leg.speed;
    while (move > 0 && leg.k < leg.path.length - 1) {
      const [tx, ty] = leg.path[leg.k + 1];
      const dx = tx - this.pos[0];
      const dy = ty - this.pos[1];
      const d = Math.hypot(dx, dy);
      if (d <= move) {
        this.pos = [tx, ty];
        leg.k++;
        move -= d;
      } else {
        this.pos = [this.pos[0] + (dx / d) * move, this.pos[1] + (dy / d) * move];
        this.dir = dirFrom(dx, dy);
        move = 0;
      }
    }
    if (leg.k >= leg.path.length - 1) {
      this.legs.shift();
      this.at = leg.to;
      this.deep = leg.deep ?? null;
      return leg.to;
    }
    return null;
  }

  render(s: Surface, t: number, unlocked: (id: AreaId) => boolean, dt: number, deepOpen: (id: CaveId) => boolean = () => true): void {
    if (this.overview) return this.renderOverview(s, t, unlocked, deepOpen);
    const map = this.layer === "under" ? paintUnder() : paintStatic();
    const [px, py] = this.pos;
    const cells = mapTerrain();
    const hAt = (x: number, y: number) => cells[Math.max(0, Math.min(MAP_H - 1, Math.round(y))) * MAP_W + Math.max(0, Math.min(MAP_W - 1, Math.round(x)))].h;
    const tokenH = (this.layer === "under" ? 3 : hAt(px, py) + 3) + Math.sin(t * 2) * 0.4;
    const tx = s.width / 2 - (OX + mx(px, py));
    const ty = s.height / 2 - (OY + my(px, py, tokenH)) + 10;
    const minX = s.width - map.width;
    const minY = s.height - map.height;
    const clampX = map.width > s.width ? Math.max(minX, Math.min(0, tx)) : (s.width - map.width) / 2;
    const clampY = map.height > s.height ? Math.max(minY, Math.min(0, ty)) : (s.height - map.height) / 2;
    if (!this.camInit || dt <= 0) {
      this.camX = clampX;
      this.camY = clampY;
      this.camInit = true;
    } else {
      this.camX += (clampX - this.camX) * Math.min(1, dt * 4);
      this.camY += (clampY - this.camY) * Math.min(1, dt * 4);
    }
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    if (this.layer === "under") {
      this.renderUnder(s, t, cx, cy, deepOpen);
      this.drawToken(s, t, cx, cy, 1, tokenH);
      return;
    }
    // the sky behind the Encircling Sea (and below its rim, where the water falls away)
    drawSky(s, "day", t, cx * 0.5, cy * 0.5 - s.height * 0.6);
    s.sprite(map, cx, cy);
    // the falls at the rim of the world: foam sliding down the curtains, and spray where they vanish into the clouds
    for (const [x, y, h] of rimFalls()) {
      if (hash2(x, y, 41) > 0.5) continue;
      const bx = cx + OX + mx(x, y) + Math.floor(hash2(x, y, 42) * 12) - 4;
      if (bx < -20 || bx > s.width + 20) continue;
      const top = cy + OY + my(x, y, h) + 8;
      for (let k = 0; k < 3; k++) {
        const f = (t * 0.9 + hash2(x, y, 43 + k)) % 1;
        s.rect(bx + k * 3, top + Math.floor(f * 30), 1, 2, alpha("#ffffff", 0.85 - f * 0.7));
      }
      const puff = (t * 0.25 + hash2(x, y, 46)) % 1;
      ellipse(s, bx + 2, top + 34 + puff * 6, 3 + puff * 4, 1 + puff * 1.5, alpha("#ffffff", 0.35 * (1 - puff)));
    }
    // Guixu turns: the sea is drawn round and down into it in a slow spiral
    {
      const gx = (GUIXU.c[0] * WORLD_SCALE) / MAP_SCALE;
      const gy = (GUIXU.c[1] * WORLD_SCALE) / MAP_SCALE;
      const ox = cx + OX + mx(gx, gy);
      const oy = cy + OY + my(gx, gy, 0);
      for (let k = 0; k < 48; k++) {
        const f = (k / 48 + t * 0.06) % 1;
        const r = 26 - f * 22;
        const a = f * Math.PI * 7 + k * 0.4 - t * 1.6;
        s.px(ox + Math.cos(a) * r * 1.6, oy + Math.sin(a) * r * 0.8, alpha(k % 3 ? "#d8f0ff" : "#ffffff", 0.25 + f * 0.6));
      }
    }
    // water shimmer
    for (let k = 0; k < 220; k++) {
      const x = Math.floor(hash2(k, 5, 9) * MAP_W);
      const y = Math.floor(hash2(k, 6, 9) * MAP_H);
      const c = cells[y * MAP_W + x];
      if (c.biome !== "sea" && c.biome !== "lake" && c.biome !== "river") continue;
      if (Math.sin(t * 3 + k * 1.7) < 0.6) continue;
      s.rect(cx + OX + mx(x, y) - 2 + (k % 4), cy + OY + my(x, y, c.h) + 3, 2, 1, "#d8f0ff");
    }
    // the flight path ahead
    for (const leg of this.legs)
      leg.path.forEach(([x, y], i) => {
        if (i < leg.k || i % 2) return;
        s.rect(cx + OX + mx(x, y) - 1, cy + OY + my(x, y, hAt(x, y) + 3) + 3, 2, 1, alpha("#fff0c0", 0.8));
      });
    // the wayside landmarks of the wilds, small and unnamed until you walk there
    for (const l of mapLandmarks()) {
      const sheet = getPropScaled(l.icon, l.icon === "pagoda" || l.icon === "teahouse" ? 0.26 : 0.34);
      const fr = sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length];
      s.sprite(fr, cx + OX + mx(l.x, l.y) - sheet.ox, cy + OY + my(l.x, l.y, hAt(l.x, l.y)) + 4 - sheet.oy, false, 0.9);
    }
    // regions
    const nodes = Object.values(NODES).sort((p, q) => p.x + p.y - (q.x + q.y));
    for (const n of nodes) {
      const open = unlocked(n.id);
      const items = [...(n.extra ?? []).filter((e) => e.dy < 0), { icon: n.icon, dx: 0, dy: 0 }, ...(n.extra ?? []).filter((e) => e.dy >= 0)];
      for (const it of items) {
        const sheet = getPropScaled(it.icon, it.icon === "hall" || it.icon === "bloodaltar" || it.icon === "dais" ? 0.32 : 0.42);
        const fr = sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length];
        const x = n.x + it.dx;
        const y = n.y + it.dy;
        s.sprite(fr, cx + OX + mx(x, y) - sheet.ox, cy + OY + my(x, y, hAt(n.x, n.y)) + 4 - sheet.oy, false, open ? 1 : 0.45);
      }
    }
    // drifting clouds and their shadows
    for (let k = 0; k < 7; k++) {
      const span = map.width + 200;
      const x = ((hash2(k, 1, 6) * span + t * (6 + k)) % span) - 100;
      const y = hash2(k, 2, 6) * map.height * 0.9;
      for (let e = 0; e < 4; e++) {
        const ex = x + e * 9 - 14;
        const ey = y + Math.sin(e * 2 + k) * 3;
        ellipse(s, cx + ex + 10, cy + ey + 26, 10, 4, alpha("#0a1430", 0.12));
        ellipse(s, cx + ex, cy + ey, 11, 5, alpha("#ffffff", 0.55));
      }
    }
    // birds
    for (let k = 0; k < 5; k++) {
      const bx = ((t * 18 + k * 140) % (s.width + 60)) - 30;
      const by = 30 + k * 23 + Math.sin(t + k) * 6;
      const flap = Math.sin(t * 10 + k) > 0 ? 1 : 0;
      s.px(bx - 1, by - flap, "#1a1226");
      s.px(bx, by, "#1a1226");
      s.px(bx + 1, by - flap, "#1a1226");
    }
    // labels
    for (const n of nodes) {
      const open = unlocked(n.id);
      const name = getArea(n.id).name.toUpperCase();
      const x = cx + OX + mx(n.x, n.y);
      const y = cy + OY + my(n.x, n.y, hAt(n.x, n.y)) + 10;
      const w = textWidth(name);
      s.rect(x - w / 2 - 3, y - 2, w + 6, 9, alpha("#1a1226", 0.75));
      drawText(s, name, x - w / 2, y, open ? (n.id === this.at && !this.travelling ? "#ffe070" : "#fff6dc") : "#8a7a9a");
      if (!open) drawText(s, "SEALED", x - textWidth("SEALED") / 2, y + 9, "#ff6a6a", { outline: "#1a1226" });
    }
    this.drawToken(s, t, cx, cy, hAt(px, py), tokenH);
  }

  /** The heroine on her sword, its trail behind her (underground, a torch-glow round her and embers in her wake). */
  private drawToken(s: Surface, t: number, cx: number, cy: number, ground: number, tokenH: number): void {
    const [px, py] = this.pos;
    const sx = cx + OX + mx(px, py);
    const gy = cy + OY + my(px, py, ground);
    const under = this.layer === "under";
    if (under) for (let r = 18; r > 4; r -= 4) ellipse(s, sx, cy + OY + my(px, py, tokenH) - 8, r, r * 0.6, alpha("#ffb85a", 0.05));
    ellipse(s, sx, gy + 4, 6, 2, alpha("#0a0a20", 0.35));
    const def = charDef("heroine");
    const fr = frameAt(getAnim("heroine", "fly", this.dir, this.outfit), t);
    const sy = cy + OY + my(px, py, tokenH);
    const trail = under ? ["#ffb85a", "#ffe9a8"] : ["#9ff5de", "#ffffff"];
    for (let k = 1; k < 7; k++) s.px(sx - k * 2 * Math.sin((this.dir / 16) * Math.PI * 2), sy + 2 - k * Math.cos((this.dir / 16) * Math.PI * 2) * 0.5, alpha(k % 2 ? trail[0] : trail[1], 0.8 - k * 0.1));
    s.sprite(fr, sx - def.ox, sy - def.oy);
  }

  /** The Underworld chart: the dark under the world, the dragon veins pulsing between the deeps, and each deep's chamber aglow. */
  private renderUnder(s: Surface, t: number, cx: number, cy: number, deepOpen: (id: CaveId) => boolean): void {
    // the dark below everything, a little warmer toward the bottom where the fires are
    for (let y = 0; y < s.height; y += 4) s.rect(0, y, s.width, 4, mix("#05040a", "#1a0a10", y / s.height));
    s.sprite(paintUnder(), cx, cy);
    const at = (x: number, y: number, h = 1): [number, number] => [cx + OX + mx(x, y), cy + OY + my(x, y, h)];
    // the dragon veins: lines of gold through the rock, a pulse of qi running along each from the Dragon Vein outward
    VEINS.forEach(([a, b], v) => {
      const [ax, ay] = veinEnd(a).map((n) => (n * WORLD_SCALE) / MAP_SCALE) as [number, number];
      const [bx, by] = veinEnd(b).map((n) => (n * WORLD_SCALE) / MAP_SCALE) as [number, number];
      const n = Math.max(8, Math.ceil(Math.hypot(bx - ax, by - ay) * 1.5));
      const pulse = (t * 0.35 + v * 0.17) % 1;
      for (let k = 0; k <= n; k++) {
        const f = k / n;
        // the vein wanders a little, as the grain of the rock does
        const wob = Math.sin(f * Math.PI * 3 + v) * 2.5 * Math.sin(f * Math.PI);
        const x = ax + (bx - ax) * f + wob * 0.6;
        const y = ay + (by - ay) * f - wob * 0.6;
        const [qx, qy] = at(x, y);
        const near = Math.abs(f - pulse) < 0.05;
        s.rect(qx, qy + 3, near ? 2 : 1, 1, alpha(near ? "#fff6c0" : b === "guixu" || a === "guixu" ? "#8a9aff" : "#d8a83a", near ? 0.95 : 0.55));
      }
    });
    // embers rising from the magma, and drips falling from the roof
    const cells = mapTerrain();
    for (let k = 0; k < 260; k++) {
      const x = Math.floor(hash2(k, 7, 19) * MAP_W);
      const y = Math.floor(hash2(k, 8, 19) * MAP_H);
      const u = underOf(cells[y * MAP_W + x].biome);
      if (u !== "magma" && u !== "rock" && u !== "deeprock") continue;
      const [qx, qy] = at(x, y);
      const f = (t * 0.5 + hash2(k, 9, 19)) % 1;
      if (u === "magma") s.px(qx + Math.sin(t * 2 + k) * 2, qy - f * 18, alpha(f < 0.5 ? "#ffd23a" : "#ff6a2a", 1 - f));
      else if (k % 5 === 0) s.px(qx, qy - 20 + f * 22, alpha("#9ab8ff", 0.6 * (1 - f)));
    }
    // Guixu's throat: the sea coming down out of the abyss in a column of mist
    {
      const [gx, gy] = at((GUIXU.c[0] * WORLD_SCALE) / MAP_SCALE, (GUIXU.c[1] * WORLD_SCALE) / MAP_SCALE, 0);
      for (let k = 0; k < 40; k++) {
        const f = (t * 0.4 + k / 40) % 1;
        s.px(gx + Math.sin(k * 2.3 + t) * (4 + f * 10), gy - 40 + f * 44, alpha("#bcd0ff", 0.5 * (1 - Math.abs(f - 0.5) * 2)));
      }
      const name = "GUIXU · THE THROAT OF THE SEA";
      const w = textWidth(name);
      s.rect(gx - w / 2 - 3, gy + 8, w + 6, 9, alpha("#05040a", 0.75));
      drawText(s, name, gx - w / 2, gy + 10, "#bcd0ff");
    }
    // the deeps: a chamber aglow under each mouth, its mark, and its name
    for (const d of [...DEEPS].sort((p, q) => p.at[0] + p.at[1] - (q.at[0] + q.at[1]))) {
      const open = deepOpen(d.id);
      const [x, y] = WorldMap.deepCell(d.id);
      const [qx, qy] = at(x, y);
      const breathe = 0.7 + Math.sin(t * 2 + x) * 0.3;
      for (let r = 22; r > 4; r -= 3) ellipse(s, qx, qy, r, r * 0.5, alpha(open ? d.glow : "#5a5068", (open ? 0.07 : 0.04) * breathe));
      const sheet = getPropScaled(d.icon, 0.42);
      const fr = sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length];
      s.sprite(fr, qx - sheet.ox, qy + 4 - sheet.oy, false, open ? 1 : 0.4);
    }
    for (const d of DEEPS) {
      const open = deepOpen(d.id);
      const [x, y] = WorldMap.deepCell(d.id);
      const [qx, qy] = at(x, y);
      const name = getRoom(d.id).name.toUpperCase();
      const w = textWidth(name);
      s.rect(qx - w / 2 - 3, qy + 8, w + 6, 9, alpha("#05040a", 0.8));
      drawText(s, name, qx - w / 2, qy + 10, !open ? "#6a5a7a" : d.id === this.deep && !this.travelling ? "#ffe070" : "#f2dcb0");
      if (!open) drawText(s, "SEALED", qx - textWidth("SEALED") / 2, qy + 19, "#ff6a6a", { outline: "#05040a" });
    }
    // the flight path ahead, in torch-light
    for (const leg of this.legs)
      leg.path.forEach(([x, y], i) => {
        if (i < leg.k || i % 2) return;
        const [qx, qy] = at(x, y, 3);
        s.rect(qx - 1, qy + 3, 2, 1, alpha("#ffb85a", 0.8));
      });
  }

  /** Screen position of a deep's mouth on the Underworld chart, on the last rendered frame (for UI hit-testing). */
  deepScreen(id: CaveId): [number, number] {
    const [x, y] = WorldMap.deepCell(id);
    if (this.overview) return [this.ov.x + (OX + mx(x, y)) / this.ov.k, this.ov.y + (OY + my(x, y, 1)) / this.ov.k];
    return [Math.round(this.camX) + OX + mx(x, y), Math.round(this.camY) + OY + my(x, y, 1)];
  }

  /**
   * The whole world at a glance: the chart shrunk to fit, the rim of the
   * world round it, every region (or, turned over, every deep and the veins
   * between them) marked and named, the flight drawn, and where she is.
   */
  private renderOverview(s: Surface, t: number, unlocked: (id: AreaId) => boolean, deepOpen: (id: CaveId) => boolean): void {
    const under = this.layer === "under";
    // shrunk to fit what the side panel leaves of the screen (about three quarters of its width)
    const full = under ? paintUnder() : paintStatic();
    const K = Math.max(2, Math.ceil(Math.max(full.width / (s.width * 0.74), full.height / (s.height * 0.94))));
    const small = shrunkChart(this.layer, K);
    const x0 = Math.max(0, Math.round((s.width * 0.76 - small.width) / 2));
    const y0 = Math.round((s.height - small.height) / 2);
    this.ov = { x: x0, y: y0, k: K };
    if (under) for (let y = 0; y < s.height; y += 4) s.rect(0, y, s.width, 4, mix("#05040a", "#1a0a10", y / s.height));
    else drawSky(s, "day", t, 0, -s.height * 0.6);
    s.sprite(small, x0, y0);
    const cells = mapTerrain();
    const hAt = (x: number, y: number) => cells[Math.max(0, Math.min(MAP_H - 1, Math.round(y))) * MAP_W + Math.max(0, Math.min(MAP_W - 1, Math.round(x)))].h;
    const at = (x: number, y: number, h = 0): [number, number] => [x0 + (OX + mx(x, y)) / this.ov.k, y0 + (OY + my(x, y, h)) / this.ov.k];
    // the falls all round the rim catch the light, a glint running round them
    if (!under)
      for (const [x, y, h] of rimFalls()) {
        if (hash2(x, y, 51) > 0.35) continue;
        const [qx, qy] = at(x, y, h);
        const f = (t * 0.6 + hash2(x, y, 52)) % 1;
        s.px(qx + 1, qy + 3 + f * 9, alpha("#ffffff", 0.9 - f * 0.8));
      }
    // names go where they fit: the one she is at first, then the open ones, and a name that would sit on another is left off
    const taken: [number, number, number, number][] = [];
    const label = (name: string, qx: number, qy: number, colour: string, bg: string, force = false) => {
      const w = textWidth(name);
      const r: [number, number, number, number] = [qx - w / 2 - 2, qy + 4, qx + w / 2 + 2, qy + 12];
      if (!force && taken.some((o) => r[0] < o[2] && o[0] < r[2] && r[1] < o[3] && o[1] < r[3])) return;
      taken.push(r);
      s.rect(r[0], r[1], w + 4, 8, alpha(bg, 0.78));
      drawText(s, name, qx - w / 2, qy + 5, colour);
    };
    if (under) {
      VEINS.forEach(([a, b], v) => {
        const [ax, ay] = veinEnd(a).map((n) => (n * WORLD_SCALE) / MAP_SCALE) as [number, number];
        const [bx, by] = veinEnd(b).map((n) => (n * WORLD_SCALE) / MAP_SCALE) as [number, number];
        const n = Math.max(6, Math.ceil(Math.hypot(bx - ax, by - ay) / 2));
        const pulse = (t * 0.35 + v * 0.17) % 1;
        for (let k = 0; k <= n; k++) {
          const f = k / n;
          const [qx, qy] = at(ax + (bx - ax) * f, ay + (by - ay) * f, 1);
          const near = Math.abs(f - pulse) < 0.06;
          s.rect(qx, qy + 1, 1, 1, alpha(near ? "#fff6c0" : "#d8a83a", near ? 1 : 0.6));
        }
      });
      const order = [...DEEPS].sort((p, q) => Number(q.id === this.deep) - Number(p.id === this.deep) || Number(deepOpen(q.id)) - Number(deepOpen(p.id)));
      for (const d of order) {
        const open = deepOpen(d.id);
        const [cx2, cy2] = WorldMap.deepCell(d.id);
        const [qx, qy] = at(cx2, cy2, 1);
        for (let r = 9; r > 2; r -= 2) ellipse(s, qx, qy, r, r * 0.5, alpha(open ? d.glow : "#5a5068", 0.1 * (0.7 + Math.sin(t * 2 + cx2) * 0.3)));
        s.rect(qx - 1, qy - 1, 3, 3, open ? d.glow : "#6a5a7a");
        label(getRoom(d.id).name.toUpperCase(), qx, qy, !open ? "#6a5a7a" : d.id === this.deep && !this.travelling ? "#ffe070" : "#f2dcb0", "#05040a", d.id === this.deep);
      }
    } else {
      const order = Object.values(NODES).sort((p, q) => Number(q.id === this.at) - Number(p.id === this.at) || Number(unlocked(q.id)) - Number(unlocked(p.id)));
      for (const n of order) {
        const open = unlocked(n.id);
        const [qx, qy] = at(n.x, n.y, hAt(n.x, n.y));
        s.rect(qx - 2, qy - 2, 5, 5, "#1a1226");
        s.rect(qx - 1, qy - 1, 3, 3, open ? "#ffe070" : "#8a7a9a");
        label(getArea(n.id).name.toUpperCase(), qx, qy, open ? (n.id === this.at && !this.travelling ? "#ffe070" : "#fff6dc") : "#8a7a9a", "#1a1226", n.id === this.at);
      }
      // and the continents' names, faint, across the land
      for (const c of CONTINENTS) {
        const [qx, qy] = at((c.c[0] * WORLD_SCALE) / MAP_SCALE, (c.c[1] * WORLD_SCALE) / MAP_SCALE, 2);
        label(c.name.replace(/^The /, "").replace(/, the Dawn Continent$/, "").toUpperCase(), qx, qy - 14, "#cfe8ff", "#0a1a3a");
      }
    }
    // Guixu turns, small and far off
    if (!under) {
      const [gx, gy] = at((GUIXU.c[0] * WORLD_SCALE) / MAP_SCALE, (GUIXU.c[1] * WORLD_SCALE) / MAP_SCALE, 0);
      for (let k = 0; k < 24; k++) {
        const f = (k / 24 + t * 0.06) % 1;
        const a = f * Math.PI * 6 - t * 1.6;
        s.px(gx + Math.cos(a) * (9 - f * 8) * 1.6, gy + Math.sin(a) * (9 - f * 8) * 0.8, alpha("#ffffff", 0.3 + f * 0.6));
      }
    }
    // the flight ahead, and where she is: a ring that pulses
    for (const leg of this.legs)
      leg.path.forEach(([x, y], i) => {
        if (i < leg.k || i % 3) return;
        const [qx, qy] = at(x, y, under ? 1 : hAt(x, y));
        s.px(qx, qy, alpha(under ? "#ffb85a" : "#fff0c0", 0.9));
      });
    const [hx, hy] = at(this.pos[0], this.pos[1], under ? 1 : hAt(this.pos[0], this.pos[1]));
    const r = 4 + Math.sin(t * 4) * 1.5;
    ellipse(s, hx, hy, r + 2, (r + 2) * 0.55, alpha(under ? "#ffb85a" : "#9ff5de", 0.25));
    s.rect(hx - 1, hy - 1, 3, 3, "#ffffff");
    s.rect(hx, hy - 4, 1, 3, under ? "#ffb85a" : "#9ff5de");
  }

  /** Screen position of a node on the last rendered frame (for UI hit-testing). */
  nodeScreen(id: AreaId): [number, number] {
    const n = NODES[id];
    const h = mapTerrain()[n.y * MAP_W + n.x].h;
    if (this.overview) return [this.ov.x + (OX + mx(n.x, n.y)) / this.ov.k, this.ov.y + (OY + my(n.x, n.y, h)) / this.ov.k];
    return [Math.round(this.camX) + OX + mx(n.x, n.y), Math.round(this.camY) + OY + my(n.x, n.y, h)];
  }
}

const shrunk = new Map<string, PixelBuffer>();
/** The chart of a layer, shrunk by a whole factor to fit the screen (made once for each). */
function shrunkChart(layer: MapLayer, k: number): PixelBuffer {
  const key = `${layer}:${k}`;
  let b = shrunk.get(key);
  if (!b) shrunk.set(key, (b = (layer === "under" ? paintUnder() : paintStatic()).shrunk(k)));
  return b;
}

let falls: [number, number, number][] | null = null;
/** The map cells where water pours over the edge of the world into the clouds (their front edge open to the void). */
function rimFalls(): [number, number, number][] {
  if (falls) return falls;
  const cells = mapTerrain();
  const out: [number, number, number][] = [];
  const voidAt = (x: number, y: number) => x >= MAP_W || y >= MAP_H || cells[y * MAP_W + x].biome === "void";
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const c = cells[y * MAP_W + x];
      if ((c.biome === "sea" || c.biome === "lake" || c.biome === "river") && (voidAt(x + 1, y) || voidAt(x, y + 1))) out.push([x, y, c.h]);
    }
  falls = out;
  return out;
}

function ellipse(s: Surface, cx: number, cy: number, rx: number, ry: number, c: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))));
    s.rect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1, c);
  }
}
