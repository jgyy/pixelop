import { PixelBuffer } from "../pixel/PixelBuffer";
import { alpha, mix, shade } from "../pixel/color";
import { hash2, fbm } from "../pixel/noise";
import { drawText, textWidth } from "../pixel/font";
import type { Surface } from "../pixel/surface";
import { charDef, frameAt, getAnim } from "../art/characters";
import { getPropScaled } from "../art/props";
import { drawSky } from "../art/sky";
import { getArea } from "../world/areas";
import { AREA_IDS, type AreaId } from "../world/ids";
import { flightPath, MAP_H, MAP_SCALE, MAP_W, mapLandmarks, mapTerrain, NODES, type Biome } from "../world/overworld";
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
      const under = edge ? (c.sky ? 26 : 14) : 0;
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

/** Overworld runtime: the heroine's flying-sword token over a miniature of the real world. */
export class WorldMap {
  at: AreaId;
  pos: [number, number];
  dir = 2;
  private legs: { to: AreaId; path: [number, number][]; k: number }[] = [];
  camX = 0;
  camY = 0;
  private camInit = false;

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

  /** Begin a sword flight to an unlocked region. Returns false if it is sealed (or we're already there). */
  travelTo(target: AreaId, unlocked: (id: AreaId) => boolean): boolean {
    if (this.travelling || target === this.at || !unlocked(target)) return false;
    this.legs.push({ to: target, path: flightPath(this.pos, [NODES[target].x, NODES[target].y]), k: 0 });
    return true;
  }

  /** Arrow-key navigation: fly to the unlocked region lying closest to the pressed screen direction. */
  nudge(sx: number, sy: number, unlocked: (id: AreaId) => boolean): AreaId | null {
    if (this.travelling) return null;
    const [hx, hy] = this.pos;
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
    let move = dt * 14;
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
      return leg.to;
    }
    return null;
  }

  render(s: Surface, t: number, unlocked: (id: AreaId) => boolean, dt: number): void {
    const map = paintStatic();
    const [px, py] = this.pos;
    const cells = mapTerrain();
    const hAt = (x: number, y: number) => cells[Math.max(0, Math.min(MAP_H - 1, Math.round(y))) * MAP_W + Math.max(0, Math.min(MAP_W - 1, Math.round(x)))].h;
    const tokenH = hAt(px, py) + 3 + Math.sin(t * 2) * 0.4;
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
    // the whole world floats on a sea of clouds
    drawSky(s, "day", t, cx * 0.5, cy * 0.5 - s.height * 0.6);
    s.sprite(map, cx, cy);
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
    // the heroine on her sword
    const sx = cx + OX + mx(px, py);
    const gy = cy + OY + my(px, py, hAt(px, py));
    ellipse(s, sx, gy + 4, 6, 2, alpha("#0a0a20", 0.35));
    const def = charDef("heroine");
    const fr = frameAt(getAnim("heroine", "fly", this.dir), t);
    const sy = cy + OY + my(px, py, tokenH);
    for (let k = 1; k < 7; k++) s.px(sx - k * 2 * Math.sin((this.dir / 16) * Math.PI * 2), sy + 2 - k * Math.cos((this.dir / 16) * Math.PI * 2) * 0.5, alpha(k % 2 ? "#9ff5de" : "#ffffff", 0.8 - k * 0.1));
    s.sprite(fr, sx - def.ox, sy - def.oy);
  }

  /** Screen position of a node on the last rendered frame (for UI hit-testing). */
  nodeScreen(id: AreaId): [number, number] {
    const n = NODES[id];
    const h = mapTerrain()[n.y * MAP_W + n.x].h;
    return [Math.round(this.camX) + OX + mx(n.x, n.y), Math.round(this.camY) + OY + my(n.x, n.y, h)];
  }
}

function ellipse(s: Surface, cx: number, cy: number, rx: number, ry: number, c: string): void {
  for (let y = -ry; y <= ry; y++) {
    const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry + 0.5))));
    s.rect(Math.round(cx) - half, Math.round(cy) + y, half * 2 + 1, 1, c);
  }
}
