import { alpha } from "../pixel/color";
import { hash2 } from "../pixel/noise";
import type { PixelBuffer } from "../pixel/PixelBuffer";
import type { Surface } from "../pixel/surface";
import { drawText } from "../pixel/font";
import { HALF_W, isoX, isoY, LEVEL_H } from "../iso/projection";
import { charDef, frameAt, getAnim, type AnimId, type CharId } from "../art/characters";
import { getProp, glowSprite, propDef, type PropId } from "../art/props";
import { drawSky } from "../art/sky";
import { foamOverlay, LIQUID_FRAMES, liquidFrame, paintTile, type TileBuffer } from "../art/tiles";
import { getArea, type AreaDef, type AreaId, type Interactable } from "../world/areas";
import { LIQUID } from "../world/tilemap";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { Effects } from "./particles";

export type Emote = "!" | "?" | "..." | "heart" | "anger" | "note";

export interface Actor {
  key: string;
  kind: "hero" | "npc" | "enemy";
  char: CharId;
  x: number;
  y: number;
  z: number;
  dir: number;
  anim: AnimId;
  animStart: number;
  /** Scripted/one-shot animation that holds until it ends. */
  holdUntil?: number;
  home: [number, number];
  wander: number;
  target: [number, number] | null;
  idleAnim: AnimId;
  speed: number;
  enemy?: EnemyId;
  emote?: { icon: Emote; until: number };
  flying?: boolean;
  hidden?: boolean;
  opacity?: number;
  /** Seconds until this actor may pick a new wander target. */
  rest: number;
  /** Quest marker over the head. */
  marker?: boolean;
}

interface PropInst {
  id: PropId;
  i: number;
  j: number;
  ax: number;
  ay: number;
  key: number;
  /** [column, bucket] strips. */
  strips: { c: number; bucket: number }[];
  phase: number;
}

const HERO_RADIUS = 0.22;

/**
 * One explorable area at runtime: terrain buffers, props, actors, collision,
 * enemy AI and the depth-sorted isometric renderer.
 */
export class World {
  readonly def: AreaDef;
  readonly hero: Actor;
  actors: Actor[] = [];
  readonly fx = new Effects();
  private tiles: (TileBuffer | null)[] = [];
  private foams: (PixelBuffer | null)[] = [];
  private props: PropInst[] = [];
  private bucketTiles: number[][] = [];
  private bucketProps: { p: PropInst; c: number }[][] = [];
  /** Interactables currently "consumed" (taken chests/herbs). */
  taken = new Set<string>();
  camX = 0;
  camY = 0;
  private camInit = false;

  readonly id: AreaId;

  constructor(
    area: AreaId | AreaDef,
    hero: { x: number; y: number; dir: number },
    flags: Record<string, boolean>,
    taken: string[],
    defeated: Set<string>,
  ) {
    this.def = typeof area === "string" ? getArea(area) : area;
    this.id = this.def.id;
    const id = this.id;
    const m = this.def.map;
    for (let j = 0; j < m.h; j++)
      for (let i = 0; i < m.w; i++) {
        const k = m.kind(i, j);
        this.tiles.push(k === "void" ? null : paintTile(m, i, j, this.def.base, 7 + AREA_SEED[id], this.def.floating));
        this.foams.push(k === "void" ? null : foamOverlay(m, i, j));
      }
    const buckets = m.w + m.h;
    this.bucketTiles = Array.from({ length: buckets }, () => []);
    this.bucketProps = Array.from({ length: buckets }, () => []);
    for (let j = 0; j < m.h; j++) for (let i = 0; i < m.w; i++) if (this.tiles[j * m.w + i]) this.bucketTiles[i + j].push(j * m.w + i);
    for (const p of this.def.props) this.addProp(p.id, p.i, p.j);
    for (const t of taken) this.taken.add(t);

    this.hero = this.makeActor("hero", "hero", "heroine", hero.x, hero.y, hero.dir, "idle");
    this.hero.speed = 3.2;
    this.actors.push(this.hero);
    for (const n of this.def.npcs) {
      if (n.when && !n.when(flags)) continue;
      const a = this.makeActor(n.key, "npc", n.char, n.i + 0.5, n.j + 0.5, n.dir, n.anim ?? "idle");
      a.wander = n.wander ?? 0;
      a.speed = 1.1;
      this.actors.push(a);
    }
    for (const e of this.def.enemies) {
      if (e.when && !e.when(flags)) continue;
      if (defeated.has(e.key)) continue;
      const d = ENEMIES[e.enemy];
      const a = this.makeActor(e.key, "enemy", d.sprite, e.i + 0.5, e.j + 0.5, Math.floor(hash2(e.i, e.j, 3) * 16), "idle");
      a.enemy = e.enemy;
      a.wander = e.range;
      a.speed = d.speed;
      this.actors.push(a);
    }
  }

  private makeActor(key: string, kind: Actor["kind"], char: CharId, x: number, y: number, dir: number, idle: AnimId): Actor {
    return { key, kind, char, x, y, z: this.groundZ(x, y), dir, anim: idle, idleAnim: idle, animStart: 0, home: [x, y], wander: 0, target: null, speed: 1, rest: hash2(Math.floor(x), Math.floor(y), 1) * 2 };
  }

  private addProp(id: PropId, i: number, j: number): void {
    const sheet = getProp(id);
    const def = propDef(id);
    const m = this.def.map;
    const z = m.height(i, j);
    const ax = isoX(i + 0.5, j + 0.5);
    const ay = isoY(i + 0.5, j + 0.5, z);
    const left = ax - sheet.ox;
    const c0 = Math.floor(left / HALF_W);
    const c1 = Math.floor((left + sheet.frames[0].width - 1) / HALF_W);
    const footCols = new Map<number, number>();
    for (let fj = j + def.foot[1]; fj <= j + def.foot[3]; fj++)
      for (let fi = i + def.foot[0]; fi <= i + def.foot[2]; fi++)
        for (const c of [fi - fj - 1, fi - fj]) footCols.set(c, Math.max(footCols.get(c) ?? -1, fi + fj));
    const cols = [...footCols.keys()].sort((a, b) => a - b);
    const strips: { c: number; bucket: number }[] = [];
    for (let c = c0; c <= c1; c++) {
      const near = footCols.has(c) ? c : c < cols[0] ? cols[0] : cols[cols.length - 1];
      strips.push({ c, bucket: Math.max(0, Math.min(this.bucketProps.length - 1, footCols.get(near) ?? i + j)) });
    }
    const inst: PropInst = { id, i, j, ax, ay, key: i + j + 1 + (def.foot[2] + def.foot[3]) / 2, strips, phase: hash2(i, j, 5) * 10 };
    this.props.push(inst);
    for (const s of strips) this.bucketProps[s.bucket].push({ p: inst, c: s.c });
  }

  // ------------------------------------------------------------------ queries
  groundZ(x: number, y: number): number {
    const i = Math.floor(x);
    const j = Math.floor(y);
    return Math.max(0, this.def.map.surface(i, j));
  }

  /** Can an actor of radius r stand at (x, y) coming from height `fromZ`? */
  canStand(x: number, y: number, fromZ: number, flying: boolean, r = HERO_RADIUS): boolean {
    const m = this.def.map;
    for (const [ox, oy] of [
      [-r, -r],
      [r, -r],
      [-r, r],
      [r, r],
    ]) {
      const i = Math.floor(x + ox);
      const j = Math.floor(y + oy);
      if (!m.standable(i, j, flying)) return false;
      const h = m.height(i, j);
      if (Math.abs(h - fromZ) > (flying ? 2.6 : 1.05)) return false;
    }
    return true;
  }

  /** Move with collision and wall sliding. Returns true if the actor moved. */
  move(a: Actor, dx: number, dy: number): boolean {
    const from = this.def.map.height(Math.floor(a.x), Math.floor(a.y));
    const fly = !!a.flying;
    const blockedByActor = (x: number, y: number) => a.kind === "hero" && this.actors.some((o) => o !== a && o.kind === "npc" && !o.hidden && Math.hypot(o.x - x, o.y - y) < 0.45 && Math.hypot(o.x - a.x, o.y - a.y) >= Math.hypot(o.x - x, o.y - y));
    const tryAt = (x: number, y: number) => this.canStand(x, y, from, fly) && !blockedByActor(x, y);
    if (tryAt(a.x + dx, a.y + dy)) {
      a.x += dx;
      a.y += dy;
      return true;
    }
    if (dx && tryAt(a.x + dx, a.y)) {
      a.x += dx;
      return true;
    }
    if (dy && tryAt(a.x, a.y + dy)) {
      a.y += dy;
      return true;
    }
    return false;
  }

  actor(key: string): Actor | undefined {
    return this.actors.find((a) => a.key === key);
  }

  removeActor(key: string): void {
    this.actors = this.actors.filter((a) => a.key !== key);
  }

  /** Nearest NPC or interactable the hero can use right now. */
  nearestInteraction(): { npc?: Actor; it?: Interactable } | null {
    const h = this.hero;
    let best: { npc?: Actor; it?: Interactable; d: number } | null = null;
    for (const a of this.actors) {
      if (a.kind !== "npc" || a.hidden) continue;
      const d = Math.hypot(a.x - h.x, a.y - h.y);
      if (d < 1.5 && (!best || d < best.d)) best = { npc: a, d };
    }
    for (const it of this.def.interacts) {
      if ((it.kind === "chest" || it.kind === "herb") && this.taken.has(it.key)) continue;
      const d = Math.hypot(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
      const reach = it.kind === "exit" ? 1.6 : it.kind === "altar" ? 2.4 : 1.45;
      if (d < reach && (!best || d < best.d - 0.2)) best = { it, d };
    }
    return best;
  }

  // ------------------------------------------------------------------ simulation
  setAnim(a: Actor, anim: AnimId, t: number, hold = false): void {
    if (a.anim === anim && !hold) return;
    a.anim = anim;
    a.animStart = t;
    if (hold) {
      const an = getAnim(a.char, anim, a.dir);
      a.holdUntil = t + an.frames.length / an.fps;
    } else a.holdUntil = undefined;
  }

  /** Walk an actor toward a point; returns true on arrival. */
  stepToward(a: Actor, tx: number, ty: number, dt: number, t: number): boolean {
    const dx = tx - a.x;
    const dy = ty - a.y;
    const d = Math.hypot(dx, dy);
    if (d < 0.08) return true;
    const step = Math.min(d, a.speed * dt);
    a.dir = dirFrom(dx, dy);
    const moved = this.move(a, (dx / d) * step, (dy / d) * step);
    if (!a.holdUntil) this.setAnim(a, a.flying ? "fly" : "walk", t);
    return !moved;
  }

  /** NPC wandering and enemy patrol/chase. Returns the enemy that touched the hero, if any. */
  update(dt: number, t: number, heroSafe: boolean): Actor | null {
    let touched: Actor | null = null;
    for (const a of this.actors) {
      if (a.holdUntil !== undefined && t >= a.holdUntil) {
        a.holdUntil = undefined;
        this.setAnim(a, a.idleAnim, t);
      }
      const targetZ = this.groundZ(a.x, a.y) + (a.flying ? 1.4 : 0);
      a.z += (targetZ - a.z) * Math.min(1, dt * 12);
      if (a.emote && t > a.emote.until) a.emote = undefined;
      if (a.hidden || (a.kind === "hero" && !a.target)) continue;
      if (a.target) {
        if (this.stepToward(a, a.target[0], a.target[1], dt, t)) {
          a.target = null;
          if (!a.holdUntil) this.setAnim(a, a.idleAnim, t);
        }
        continue;
      }
      if (a.kind === "enemy") {
        const d = Math.hypot(this.hero.x - a.x, this.hero.y - a.y);
        const def = ENEMIES[a.enemy!];
        if (!heroSafe && d < def.aggro && def.speed > 0) {
          const from = [a.x, a.y];
          this.stepToward(a, this.hero.x, this.hero.y, dt * 1.25, t);
          if (Math.hypot(a.x - a.home[0], a.y - a.home[1]) > a.wander + 4) [a.x, a.y] = from;
        } else this.wanderStep(a, dt, t);
        if (!heroSafe && d < 0.62) touched = a;
        continue;
      }
      if (a.wander > 0) this.wanderStep(a, dt, t);
    }
    this.fx.update(dt);
    return touched;
  }

  private wanderStep(a: Actor, dt: number, t: number): void {
    if (a.wander <= 0 || a.speed <= 0) return;
    a.rest -= dt;
    if (a.rest > 0) return;
    const ang = hash2(Math.floor(t * 10), a.key.length * 13, 7) * Math.PI * 2;
    const r = hash2(Math.floor(t * 10), 3, a.key.length) * a.wander;
    const tx = a.home[0] + Math.cos(ang) * r;
    const ty = a.home[1] + Math.sin(ang) * r;
    if (this.canStand(tx, ty, this.def.map.height(Math.floor(a.x), Math.floor(a.y)), false)) a.target = [tx, ty];
    a.rest = 1.5 + hash2(Math.floor(t), 9, a.key.length) * 3;
  }

  updateCamera(viewW: number, viewH: number, dt: number, focus?: [number, number, number]): void {
    const [fx, fy, fz] = focus ?? [this.hero.x, this.hero.y, this.hero.z];
    const tx = Math.round(viewW / 2 - isoX(fx, fy));
    const ty = Math.round(viewH / 2 - isoY(fx, fy, fz) + 12);
    if (!this.camInit || dt <= 0) {
      this.camX = tx;
      this.camY = ty;
      this.camInit = true;
      return;
    }
    const k = Math.min(1, dt * 5);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
  }

  // ------------------------------------------------------------------ rendering
  render(s: Surface, t: number): void {
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const m = this.def.map;
    drawSky(s, this.def.sky, t, cx, cy);
    const W = s.width;
    const H = s.height;
    const visible = (x: number, y: number, w: number, h: number) => x + w >= 0 && y + h >= 0 && x < W && y < H;

    // actors into buckets
    const actorBuckets = new Map<number, Actor[]>();
    for (const a of this.actors) {
      if (a.hidden) continue;
      const b = Math.max(0, Math.min(this.bucketTiles.length - 1, Math.floor(a.x) + Math.floor(a.y)));
      let arr = actorBuckets.get(b);
      if (!arr) actorBuckets.set(b, (arr = []));
      arr.push(a);
    }
    const lf = Math.floor(t * 6) % LIQUID_FRAMES;

    for (let b = 0; b < this.bucketTiles.length; b++) {
      for (const idx of this.bucketTiles[b]) {
        const i = idx % m.w;
        const j = Math.floor(idx / m.w);
        const tb = this.tiles[idx]!;
        const h = m.height(i, j);
        const x = isoX(i, j) + cx - 16;
        const y = isoY(i, j, h) + cy;
        if (!visible(x, y, 32, tb.buf.height)) continue;
        s.sprite(tb.buf, x, y);
        const liquid = LIQUID[m.kind(i, j)];
        if (liquid) {
          const phase = (lf + ((i * 3 + j * 5) % 2)) % LIQUID_FRAMES;
          s.sprite(liquidFrame(liquid, phase, m.kind(i, j) === "deep"), x, y + tb.sink);
          const foam = this.foams[idx];
          if (foam) s.sprite(foam, x, y + tb.sink, false, 0.65 + 0.35 * Math.sin(t * 2 + i + j));
        }
      }
      const entries: { key: number; draw: () => void }[] = [];
      for (const { p, c } of this.bucketProps[b]) {
        const sheet = getProp(p.id);
        const fr = sheet.frames[Math.floor((t + p.phase) * sheet.fps) % sheet.frames.length];
        const px = p.ax + cx - sheet.ox;
        const py = p.ay + cy - sheet.oy;
        if (!visible(px, py, fr.width, fr.height)) continue;
        const frame = p.id === "chest" ? sheet.frames[this.isTakenAt(p.i, p.j) ? 1 : 0] : p.id === "herb" && this.isTakenAt(p.i, p.j) ? null : fr;
        if (!frame) continue;
        entries.push({ key: p.key, draw: () => s.spriteSlice(frame, px, py, c * HALF_W - (p.ax - sheet.ox), HALF_W) });
      }
      for (const a of actorBuckets.get(b) ?? []) entries.push({ key: a.x + a.y, draw: () => this.drawActor(s, a, t, cx, cy) });
      entries.sort((p, q) => p.key - q.key);
      for (const e of entries) e.draw();
    }

    // x-ray silhouette so the heroine stays visible behind tall props
    if (!this.hero.hidden) {
      const def = charDef(this.hero.char);
      const fr = frameAt(getAnim(this.hero.char, this.hero.anim, this.hero.dir), t - this.hero.animStart);
      const ground = this.groundZ(this.hero.x, this.hero.y);
      s.sprite(fr, isoX(this.hero.x, this.hero.y) + cx - def.ox, isoY(this.hero.x, this.hero.y, ground) + cy - (this.hero.z - ground) * LEVEL_H - def.oy, false, 0.28);
    }
    this.drawEmitters(s, t, cx, cy);
    this.fx.draw(s, cx, cy);
    this.drawWeather(s, t, cx, cy);
    this.drawLighting(s, t, cx, cy);
    for (const a of this.actors) if (!a.hidden) this.drawOverhead(s, a, t, cx, cy);
  }

  private isTakenAt(i: number, j: number): boolean {
    const it = this.def.interacts.find((x) => x.i === i && x.j === j && (x.kind === "chest" || x.kind === "herb"));
    return !!it && this.taken.has(it.key);
  }

  heroScreen(): [number, number] {
    return [isoX(this.hero.x, this.hero.y) + this.camX, isoY(this.hero.x, this.hero.y, this.hero.z) + this.camY];
  }

  private drawActor(s: Surface, a: Actor, t: number, cx: number, cy: number): void {
    const def = charDef(a.char);
    const anim = getAnim(a.char, a.anim, a.dir);
    const fr = frameAt(anim, t - a.animStart);
    const gx = isoX(a.x, a.y) + cx;
    const ground = this.groundZ(a.x, a.y);
    const gy = isoY(a.x, a.y, ground) + cy;
    const lift = (a.z - ground) * LEVEL_H;
    // contact shadow shrinks as the actor rises
    const sw = Math.max(3, (a.char === "crane" || a.char === "bat" ? 5 : def.w > 60 ? 9 : 6) - lift * 0.15);
    for (let yy = -1; yy <= 1; yy++) {
      const half = Math.round(sw * Math.sqrt(1 - (yy * yy) / 2.2));
      s.rect(gx - half, gy + yy, half * 2 + 1, 1, alpha("#140a20", 0.32));
    }
    if (a.flying) for (let k = 1; k < 6; k++) s.px(gx - Math.sin(t * 7 + k) * 2 - k * 2 * Math.sign(Math.sin((a.dir / 16) * Math.PI * 2) || 1), gy - lift + 2 + k * 0.4, alpha(k % 2 ? "#9ff5de" : "#ffffff", 0.7 - k * 0.1));
    s.sprite(fr, gx - def.ox, gy - lift - def.oy, false, a.opacity ?? 1);
  }

  private drawOverhead(s: Surface, a: Actor, t: number, cx: number, cy: number): void {
    const def = charDef(a.char);
    const x = isoX(a.x, a.y) + cx;
    const top = isoY(a.x, a.y, a.z) + cy - (def.oy - 6) * (def.h > 70 ? 1 : 0.62) - 22;
    if (a.emote) drawEmote(s, a.emote.icon, x, top - 6 + Math.round(Math.sin(t * 6)), t);
    else if (a.marker) {
      const y = top - 4 + Math.round(Math.sin(t * 4) * 2);
      drawText(s, "!", x - 1, y, "#ffd860", { outline: "#3a1a10" });
    }
  }

  private drawEmitters(s: Surface, t: number, cx: number, cy: number): void {
    for (const p of this.props) {
      const def = propDef(p.id);
      if (!def.emit) continue;
      const x0 = p.ax + cx;
      const y0 = p.ay + cy;
      if (x0 < -60 || x0 > s.width + 60 || y0 < -40 || y0 > s.height + 120) continue;
      const sheet = getProp(p.id);
      const top = y0 - sheet.oy;
      for (let n = 0; n < 6; n++) {
        const age = (t * 0.45 + n / 6 + p.phase) % 1;
        const r = hash2(n, p.i * 7 + p.j, 3);
        switch (def.emit) {
          case "smoke": {
            const sx = x0 + (p.id === "house" ? 10 : 0) + Math.sin(age * 4 + n) * 3 + age * 6;
            const sy = (p.id === "house" ? top + 4 : y0 - 12) - age * 30;
            const sz = 1 + Math.floor(age * 3);
            s.rect(sx, sy, sz, sz, alpha("#d8d4e4", 0.55 * (1 - age)));
            break;
          }
          case "embers":
            s.px(x0 + (r - 0.5) * 12 + Math.sin(age * 9 + n) * 2, y0 - 14 - age * 34, alpha(n % 2 ? "#ffb040" : "#ff6030", 1 - age));
            break;
          case "sparkle": {
            const a = r * Math.PI * 2 + t;
            const rr = 6 + r * 8;
            if (Math.sin(t * 5 + n * 2) > 0.2) s.px(x0 + Math.cos(a) * rr, top + 6 + age * 20 + Math.sin(a) * 4, alpha("#e8fff4", 1 - age));
            break;
          }
          case "petals":
          case "leaves": {
            const sx = x0 - 10 + r * 20 + age * 26 + Math.sin(age * 8 + n) * 4;
            const sy = top + 8 + age * (sheet.oy - 4);
            s.rect(sx, sy, 2, 1, alpha(def.emit === "petals" ? (n % 2 ? "#ffd0e4" : "#f8a8c8") : n % 2 ? "#f08a3a" : "#ffd070", 1 - age * 0.5));
            break;
          }
        }
      }
    }
  }

  private drawWeather(s: Surface, t: number, cx: number, cy: number): void {
    const w = this.def.weather;
    if (w === "none") return;
    const W = s.width;
    const H = s.height;
    const n = Math.floor((W * H) / (w === "snow" ? 1800 : 3200));
    for (let k = 0; k < n; k++) {
      const r1 = hash2(k, 1, 11);
      const r2 = hash2(k, 2, 11);
      const r3 = hash2(k, 3, 11);
      const wrap = (v: number, m: number) => ((v % m) + m) % m;
      switch (w) {
        case "petals":
        case "leaves": {
          const x = wrap(r1 * W + t * (10 + r3 * 14) + Math.sin(t + k) * 10 + cx * 0.3, W);
          const y = wrap(r2 * H + t * (12 + r3 * 10) + cy * 0.3, H);
          const c = w === "petals" ? (k % 3 ? "#ffc8dc" : "#ffffff") : k % 2 ? "#e88a3a" : "#c84a2a";
          s.rect(x, y, Math.sin(t * 3 + k) > 0 ? 2 : 1, 1, alpha(c, 0.9));
          break;
        }
        case "fireflies": {
          const x = wrap(r1 * W + Math.sin(t * 0.5 + k) * 20 + cx * 0.2, W);
          const y = wrap(r2 * H + Math.cos(t * 0.4 + k * 2) * 14 + cy * 0.2, H);
          const glow = Math.sin(t * (1.5 + r3) + k);
          if (glow > -0.2) {
            s.px(x, y, alpha("#e8ff90", 0.6 + glow * 0.4));
            if (glow > 0.6) s.sprite(glowSprite("#d8ff80", 5), x - 5, y - 2.5);
          }
          break;
        }
        case "embers": {
          const x = wrap(r1 * W + Math.sin(t + k) * 8 + cx * 0.2, W);
          const y = wrap(r2 * H - t * (14 + r3 * 18) + cy * 0.2, H);
          s.px(x, y, alpha(k % 2 ? "#ff8040" : "#ffd060", 0.5 + r3 * 0.5));
          break;
        }
        case "snow": {
          const x = wrap(r1 * W + Math.sin(t * 0.8 + k) * 12 + t * 6 + cx * 0.3, W);
          const y = wrap(r2 * H + t * (10 + r3 * 16) + cy * 0.3, H);
          s.rect(x, y, r3 > 0.7 ? 2 : 1, r3 > 0.7 ? 2 : 1, alpha("#ffffff", 0.85));
          break;
        }
      }
    }
  }

  private drawLighting(s: Surface, t: number, cx: number, cy: number): void {
    const night = this.def.night;
    if (night <= 0) return;
    s.rect(0, 0, s.width, s.height, alpha(this.def.tint ?? "#1a1440", night * 0.35));
    s.rect(0, 0, s.width, s.height, alpha("#0a0618", night * 0.32));
    for (const p of this.props) {
      const L = propDef(p.id).light;
      if (!L) continue;
      const x = p.ax + cx;
      const y = p.ay + cy - L.dy;
      if (x < -L.radius || x > s.width + L.radius || y < -L.radius || y > s.height + L.radius) continue;
      const flick = 1 + Math.sin(t * 9 + p.phase) * 0.04;
      const g = glowSprite(L.color, Math.round(L.radius * flick));
      s.sprite(g, x - g.width / 2, y - g.height / 2, false, Math.min(1, 0.5 + night));
    }
    const [hx, hy] = this.heroScreen();
    const hg = glowSprite("#c8fff0", 26);
    s.sprite(hg, hx - hg.width / 2, hy - 18 - hg.height / 2, false, night * 0.8);
  }
}

const AREA_SEED: Record<AreaId, number> = { sect: 1, village: 2, bamboo: 3, lake: 4, valley: 5, peak: 6 };

export function dirFrom(dx: number, dy: number): number {
  const a = Math.atan2(dx - dy, dx + dy);
  return ((Math.round(a / (Math.PI / 8)) % 16) + 16) % 16;
}

/** Little pixel speech bubble with an icon. */
export function drawEmote(s: Surface, icon: Emote, x: number, y: number, t: number): void {
  const w = 11;
  const h = 9;
  const x0 = Math.round(x - w / 2);
  const y0 = Math.round(y - h);
  s.rect(x0 + 1, y0, w - 2, h, "#1a1226");
  s.rect(x0, y0 + 1, w, h - 2, "#1a1226");
  s.rect(x0 + 1, y0 + 1, w - 2, h - 2, "#fff8e8");
  s.rect(x0 + 4, y0 + h, 3, 1, "#1a1226");
  s.px(x0 + 5, y0 + h + 1, "#1a1226");
  s.rect(x0 + 5, y0 + h - 1, 1, 1, "#fff8e8");
  const ix = x0 + 4;
  const iy = y0 + 2;
  switch (icon) {
    case "!":
      drawText(s, "!", ix, iy, "#e83a3a");
      break;
    case "?":
      drawText(s, "?", ix, iy, "#3a6ad8");
      break;
    case "...":
      for (let k = 0; k < 3; k++) if (Math.floor(t * 3) % 4 > k) s.px(x0 + 3 + k * 2, y0 + 5, "#1a1226");
      break;
    case "heart":
      for (const [dx, dy] of [
        [1, 1], [2, 1], [4, 1], [5, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [2, 4], [3, 4], [4, 4], [3, 5],
      ])
        s.px(x0 + 2 + dx, y0 + dy, "#f0507a");
      break;
    case "anger":
      for (const [dx, dy] of [
        [1, 1], [5, 1], [2, 2], [4, 2], [2, 4], [4, 4], [1, 5], [5, 5],
      ])
        s.px(x0 + 2 + dx, y0 + dy, "#e83a3a");
      break;
    case "note":
      s.rect(x0 + 6, y0 + 1, 1, 5, "#7a3ac8");
      s.rect(x0 + 4, y0 + 5, 2, 2, "#7a3ac8");
      s.px(x0 + 7, y0 + 2, "#7a3ac8");
      break;
  }
}
