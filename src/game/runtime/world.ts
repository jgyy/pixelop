import { alpha, mix } from "../pixel/color";
import { hash2 } from "../pixel/noise";
import type { PixelBuffer } from "../pixel/PixelBuffer";
import { fadedSurface, type Surface } from "../pixel/surface";
import { drawText } from "../pixel/font";
import { HALF_W, isoX, isoY, LEVEL_H, screenToWorld } from "../iso/projection";
import { charDef, frameAt, getAnim, type AnimId, type CharId } from "../art/characters";
import { getProp, glowSprite, propDef, type PropId } from "../art/props";
import { drawSky } from "../art/sky";
import { foamOverlay, LIQUID_FRAMES, liquidFrame, paintTile, type TileBuffer } from "../art/tiles";
import { AREA_IDS, placementTiles, type AreaDef, type AreaId, type Interactable, type PropPlacement, type SkyId, type Weather } from "../world/areas";
import { isWorldDef, regionAt, type WorldDef } from "../world/continent";
import { regionDistance, WORLD_SCALE } from "../world/layout";
import { LIQUID, type TileMap } from "../world/tilemap";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { Effects } from "./particles";

export type Emote = "!" | "?" | "..." | "heart" | "anger" | "note" | "zzz";

export interface Actor {
  key: string;
  kind: "hero" | "npc" | "enemy" | "critter";
  char: CharId;
  x: number;
  y: number;
  z: number;
  dir: number;
  anim: AnimId;
  animStart: number;
  /** Playback speed multiplier (chasing beasts gallop faster). */
  animRate?: number;
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
  running?: boolean;
  hidden?: boolean;
  opacity?: number;
  /** Seconds until this actor may pick a new wander target. */
  rest: number;
  /** Quest marker over the head. */
  marker?: boolean;
  /** Patrol route (NPCs walking the highway). */
  route?: [number, number][];
  routeK?: number;
  /** Facing to return to once the heroine walks away. */
  baseDir?: number;
  greeted?: boolean;
  alerted?: boolean;
  /** Critters: height above the ground while airborne. */
  alt?: number;
  /** Clock time of this actor's next idle fidget (a nod, a sniff, a peck…). */
  fidgetAt?: number;
  /** The outfit a person (or the heroine on horseback) is wearing. */
  outfit?: string;
  /** Walks with a carrying pole on the shoulders (porters, tea pickers). */
  carrier?: boolean;
  /** Their own name, when they share a look with other folk. */
  name?: string;
}

interface PropInst {
  id: PropId;
  i: number;
  j: number;
  /** Drawn k times its size. */
  k: number;
  /** Tiles covered [i0, j0, i1, j1]. */
  foot: [number, number, number, number];
  ax: number;
  ay: number;
  /** Lies on the floor (mats, cushions): drawn beneath whoever stands on it. */
  flat: boolean;
  phase: number;
  /** Shown only while this holds on the story flags. */
  when?: (flags: Record<string, boolean>) => boolean;
}

interface Env {
  sky: SkyId;
  sky2: SkyId | null;
  /** Weight of the second sky (0..0.5). */
  k: number;
  weather: [Weather, number][];
  night: number;
  tint: string;
  /** 0 = day, 1 = deepest night of the day/night cycle. */
  dusk: number;
}

const HERO_RADIUS = 0.22;
/** Length of a full day/night cycle in seconds of game time. */
export const DAY_LENGTH = 360;
/** Actors further than this from the heroine are frozen until she comes back. */
const ACTIVE_RANGE = 26;
const RESPAWN_AFTER = 60;
/** Idle fidgets an NPC may break into, when its character has the animation. */
const NPC_FIDGETS: AnimId[] = ["nod", "look", "stretch", "drink", "point", "dance", "cheer", "gather", "pour", "clap", "laugh", "flute", "eat", "juggle", "fan", "salute", "twirl", "kick"];
/** Idles that absorb an NPC (fishing, reading, weaving…): they neither turn to greet nor fidget. */
const ABSORBED = new Set<AnimId>(["fish", "practice", "meditate", "read", "weave", "tell", "pray", "sit", "hammer", "write", "hoe", "chop", "taichi", "kick", "umbrella"]);
/** …and the ones a roaming beast may (sleeping takes a while). */
const BEAST_FIDGETS: AnimId[] = ["sniff", "howl", "sniff", "sleep"];

/** Stable per-key hash, so actors don't all wander in lockstep. */
const keyHash = (key: string) => {
  let h = 2166136261;
  for (let k = 0; k < key.length; k++) h = Math.imul(h ^ key.charCodeAt(k), 16777619);
  return (h >>> 0) % 9973;
};

/** Painted terrain columns are shared between every World built on the same map. */
const tileCache = new WeakMap<TileMap, { tiles: (TileBuffer | null | undefined)[]; foams: (PixelBuffer | null | undefined)[] }>();

const SEAL_COLOUR: Record<AreaId, string> = { sect: "#ffffff", village: "#f4f8ff", bamboo: "#ffd27a", lake: "#c8d8ff", valley: "#ff3050", peak: "#d8c8ff", marsh: "#b8ffd8", terraces: "#f8fff0", desert: "#ffe0a0", harbor: "#d8f0ff", frost: "#e8f4ff" };

/** 0 at dawn (t = 0), 1 at midnight. */
export const duskAt = (t: number) => (1 - Math.cos((t / DAY_LENGTH) * Math.PI * 2)) / 2;

/**
 * The explorable world at runtime: lazily painted terrain, props, actors,
 * collision, AI, and the depth-sorted isometric renderer. Used for the one
 * continuous jianghu and for the small battle arenas.
 */
export class World {
  readonly def: AreaDef;
  readonly world: WorldDef | null;
  readonly hero: Actor;
  actors: Actor[] = [];
  readonly fx = new Effects();
  private readonly cache: { tiles: (TileBuffer | null | undefined)[]; foams: (PixelBuffer | null | undefined)[] };
  private props: PropInst[] = [];
  /** Props that emit particles or cast light, bucketed by patch of screen so a frame only looks at those near the view. */
  private emitters = new Map<number, PropInst[]>();
  private lights = new Map<number, PropInst[]>();
  private bucketProps: PropInst[][] = [];
  private maxH = 0;
  /** Boundary tiles between regions, where a sealed region's mist wall stands, by diagonal (i + j). */
  private border: { i: number; j: number; region: AreaId }[][] = [];
  /** Interactables currently "consumed" (taken chests/herbs). */
  taken = new Set<string>();
  /** Enemy spawn keys beaten, with the clock time of their defeat. */
  readonly defeated = new Map<string, number>();
  /** Which regions the heroine may not yet enter. */
  sealed: (id: AreaId) => boolean = () => false;
  /** The region whose seal the heroine last walked into (cleared by the game). */
  bumped: AreaId | null = null;
  /** Ambient day/night cycle (only in the open world). */
  dayNight: boolean;
  /** A building's cutaway room rather than open sky. */
  readonly interior: boolean;
  /** Interior wall tiles with lattice windows, which let the daylight in. */
  private windows: { i: number; j: number }[] = [];
  private flags: Record<string, boolean>;
  private footprints: { x: number; y: number; z: number; at: number; dark: string }[] = [];
  private stepDist = 0;
  private clock = 0;
  camX = 0;
  camY = 0;
  private camInit = false;

  readonly id: AreaId;

  constructor(def: AreaDef, hero: { x: number; y: number; dir: number }, flags: Record<string, boolean>, taken: string[]) {
    this.def = def;
    this.world = isWorldDef(def) ? def : null;
    this.id = this.world ? regionAt(this.world, hero.x, hero.y) : def.id;
    this.interior = def.sky === "interior";
    // rooms follow the day outside their windows too
    this.dayNight = !!this.world || this.interior;
    this.flags = flags;
    const m = def.map;
    let c = tileCache.get(m);
    if (!c) tileCache.set(m, (c = { tiles: new Array(m.w * m.h), foams: new Array(m.w * m.h) }));
    this.cache = c;
    for (let k = 0; k < m.heights.length; k++) this.maxH = Math.max(this.maxH, m.heights[k]);
    if (this.interior) m.each((i, j) => m.kind(i, j) === "window" && this.windows.push({ i, j }));
    this.bucketProps = Array.from({ length: m.w + m.h }, () => []);
    for (const p of def.props) this.addProp(p);
    for (const t of taken) this.taken.add(t);
    if (this.world) {
      const w = this.world;
      this.border = Array.from({ length: m.w + m.h }, () => []);
      m.each((i, j) => {
        if (m.kind(i, j) === "void") return;
        const r = w.regionOf[j * m.w + i];
        for (const [di, dj] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ])
          if (m.kind(i + di, j + dj) !== "void" && w.regionOf[(j + dj) * m.w + i + di] !== r) {
            this.border[i + j].push({ i, j, region: AREA_IDS[r] });
            break;
          }
      });
    }

    this.hero = this.makeActor("hero", "hero", "heroine", hero.x, hero.y, hero.dir, "idle");
    this.hero.speed = 3.2;
    this.actors.push(this.hero);
    this.syncPopulation(flags, true);
  }

  private makeActor(key: string, kind: Actor["kind"], char: CharId, x: number, y: number, dir: number, idle: AnimId): Actor {
    return { key, kind, char, x, y, z: this.groundZ(x, y), dir, anim: idle, idleAnim: idle, animStart: 0, home: [x, y], wander: 0, target: null, speed: 1, rest: hash2(Math.floor(x), Math.floor(y), 1) * 2 };
  }

  /**
   * Bring the cast in line with the story: NPCs and encounters appear or
   * leave as their flag conditions change, and beaten beasts return once the
   * heroine has been away for a while. Scripted actors are left alone.
   */
  syncPopulation(flags: Record<string, boolean>, initial = false): void {
    this.flags = flags;
    const present = new Set(this.actors.map((a) => a.key));
    const h = this.hero;
    for (const n of this.def.npcs) {
      const want = !n.when || n.when(flags);
      if (want && present.has(n.key) && n.outfit) {
        // a change of clothes as the story moves on (Willow Creek's festival best)
        const a = this.actor(n.key);
        if (a) this.dress(a, n.outfit(flags), n.anim);
      }
      if (want && !present.has(n.key)) {
        // a carrier stands about normally and shoulders the pole when walking
        const carrier = n.anim === "carry";
        const a = this.makeActor(n.key, "npc", n.char, n.i + 0.5, n.j + 0.5, n.dir, carrier ? "idle" : (n.anim ?? "idle"));
        a.carrier = carrier;
        a.name = n.name;
        if (n.outfit) this.dress(a, n.outfit(flags), n.anim);
        a.wander = n.wander ?? 0;
        a.speed = n.route ? 1.3 : 1.1;
        a.baseDir = n.dir;
        if (n.route) {
          a.route = n.route;
          a.routeK = 0;
        }
        this.actors.push(a);
      } else if (!want && present.has(n.key) && !initial) this.removeActor(n.key);
    }
    for (const e of this.def.enemies) {
      const want = !e.when || e.when(flags);
      const beaten = this.defeated.get(e.key);
      if (beaten !== undefined && !e.when && this.clock - beaten > RESPAWN_AFTER && Math.hypot(e.i - h.x, e.j - h.y) > 18) this.defeated.delete(e.key);
      if (want && !present.has(e.key) && !this.defeated.has(e.key)) {
        const d = ENEMIES[e.enemy];
        const a = this.makeActor(e.key, "enemy", d.sprite, e.i + 0.5, e.j + 0.5, Math.floor(hash2(e.i, e.j, 3) * 16), "idle");
        a.enemy = e.enemy;
        a.wander = e.range;
        a.speed = d.speed;
        if (!initial) a.opacity = 0;
        this.actors.push(a);
      } else if (!want && present.has(e.key) && !initial) this.removeActor(e.key);
    }
    if (initial)
      for (const c of this.def.critters ?? []) {
        const a = this.makeActor(c.key, "critter", c.char, c.i + 0.5, c.j + 0.5, Math.floor(hash2(c.i, c.j, 5) * 16), c.char === "bat" ? "fly" : "idle");
        a.wander = c.char === "horse" ? 3.5 : 2;
        a.speed = c.char === "horse" ? 0.9 : 0.6;
        a.alt = c.char === "bat" ? 2.2 : 0;
        this.actors.push(a);
      }
  }

  /** Put an NPC into an outfit; at the festival, folk who can hold up a lantern do so while they stand about. */
  private dress(a: Actor, outfit: string | undefined, anim: AnimId | undefined): void {
    if (a.outfit === outfit) return;
    a.outfit = outfit;
    const lantern = outfit === "festival" && !anim && charDef(a.char).anims.includes("lantern");
    const idle: AnimId = lantern ? "lantern" : (anim ?? "idle");
    if (a.idleAnim !== idle && (a.idleAnim === "idle" || a.idleAnim === "lantern")) {
      a.idleAnim = idle;
      if (a.holdUntil === undefined && !a.target) this.setAnim(a, idle, this.clock);
    }
  }

  /** Record a beaten encounter and take it off the map. */
  defeat(key: string): void {
    this.defeated.set(key, this.clock);
    this.removeActor(key);
  }

  private addProp(p: PropPlacement): void {
    const { id, i, j } = p;
    const def = propDef(id);
    const [x, y] = p.at ?? [i + 0.5, j + 0.5];
    const foot = placementTiles(p);
    const z = this.def.map.height(Math.floor(x), Math.floor(y));
    const inst: PropInst = { id, i, j, k: p.k ?? 1, foot, ax: isoX(x, y), ay: isoY(x, y, z), flat: !!def.flat, phase: hash2(i, j, 5) * 10, when: p.when };
    this.props.push(inst);
    if (def.emit) gridAdd(this.emitters, inst);
    if (def.light) gridAdd(this.lights, inst);
  }

  /** Depth buckets for a prop's screen columns: each 16 px strip sorts with the footprint tile it covers. */
  private propStrips(p: PropInst): { c: number; bucket: number }[] {
    // bigger sheets are only painted when first seen: estimate their columns from the size-1 sheet (with a pixel to spare per k)
    const sheet = getProp(p.id);
    const left = p.ax - sheet.ox * p.k - (p.k > 1 ? p.k : 0);
    const c0 = Math.floor(left / HALF_W);
    const c1 = Math.floor((left + sheet.frames[0].width * p.k + (p.k > 1 ? 2 * p.k : 0) - 1) / HALF_W);
    const footCols = new Map<number, number>();
    for (let fj = p.foot[1]; fj <= p.foot[3]; fj++)
      for (let fi = p.foot[0]; fi <= p.foot[2]; fi++)
        for (const c of [fi - fj - 1, fi - fj]) footCols.set(c, Math.max(footCols.get(c) ?? -1, fi + fj));
    const cols = [...footCols.keys()].sort((a, b) => a - b);
    const strips: { c: number; bucket: number }[] = [];
    for (let c = c0; c <= c1; c++) {
      const near = footCols.has(c) ? c : c < cols[0] ? cols[0] : cols[cols.length - 1];
      strips.push({ c, bucket: Math.max(0, Math.min(this.bucketProps.length - 1, footCols.get(near) ?? p.i + p.j)) });
    }
    return strips;
  }

  private stripsCache = new Map<PropInst, { c: number; bucket: number }[]>();
  private bucketed = false;
  /** How far (in screen px) the tallest prop rises above its footing: props this far below the view still poke into it. */
  private propRise = 0;
  /** Prop sheets are painted on first use, so bucket them lazily too. */
  private ensureBuckets(): void {
    if (this.bucketed) return;
    this.bucketed = true;
    for (const p of this.props) {
      this.propRise = Math.max(this.propRise, getProp(p.id).oy * p.k);
      const strips = this.propStrips(p);
      this.stripsCache.set(p, strips);
      for (const b of new Set(strips.map((s) => s.bucket))) this.bucketProps[b].push(p);
    }
  }

  // ------------------------------------------------------------------ queries
  groundZ(x: number, y: number): number {
    return Math.max(0, this.def.map.surface(Math.floor(x), Math.floor(y)));
  }

  /** The region a point belongs to (the arena's own id outside the open world). */
  regionAt(x: number, y: number): AreaId {
    return this.world ? regionAt(this.world, x, y) : this.def.id;
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
    const here = a.kind === "hero" && this.world ? this.regionAt(a.x, a.y) : null;
    const blockedByActor = (x: number, y: number) => a.kind === "hero" && this.actors.some((o) => o !== a && o.kind === "npc" && !o.hidden && Math.hypot(o.x - x, o.y - y) < 0.45 && Math.hypot(o.x - a.x, o.y - a.y) >= Math.hypot(o.x - x, o.y - y));
    const sealedAt = (x: number, y: number) => {
      if (!here) return false;
      const r = this.regionAt(x, y);
      if (r === here || !this.sealed(r)) return false;
      this.bumped = r;
      return true;
    };
    const tryAt = (x: number, y: number) => this.canStand(x, y, from, fly) && !blockedByActor(x, y) && !sealedAt(x, y);
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

  /** Teleport the heroine (fast travel, revival) and snap the camera. */
  placeHero(x: number, y: number, dir: number): void {
    const h = this.hero;
    h.x = x;
    h.y = y;
    h.dir = dir;
    h.target = null;
    h.flying = false;
    // she gets up off the ground she sat down on to wait
    if (h.idleAnim === "sit") h.idleAnim = "idle";
    h.z = this.groundZ(x, y);
    this.camInit = false;
    this.footprints = [];
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
      if (Math.abs(it.i - h.x) > 6 || Math.abs(it.j - h.y) > 6) continue;
      if ((it.kind === "chest" || it.kind === "herb") && this.taken.has(it.key)) continue;
      const d = Math.hypot(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
      // the taiji dais grows with the world, so its edge is further from its heart
      const reach = it.kind === "exit" || it.kind === "door" ? 1.6 : it.kind === "altar" ? 2.4 * WORLD_SCALE : 1.45;
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
      const an = getAnim(a.char, anim, a.dir, a.outfit);
      a.holdUntil = t + an.frames.length / an.fps / (a.animRate ?? 1);
    } else a.holdUntil = undefined;
  }

  private moveAnim(a: Actor): AnimId {
    if (a.flying) return "fly";
    if (a.carrier) return "carry";
    return a.running && charDef(a.char).anims.includes("run") ? "run" : "walk";
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
    if (!a.holdUntil) this.setAnim(a, this.moveAnim(a), t);
    return !moved;
  }

  /**
   * NPC wandering and patrols, greetings, enemy patrol/chase and skittish
   * wildlife. Returns the enemy that touched the hero, if any. `social`
   * (false during cutscenes) lets NPCs turn to greet the heroine.
   */
  update(dt: number, t: number, heroSafe: boolean, social = !heroSafe): Actor | null {
    this.clock = t;
    let touched: Actor | null = null;
    const h = this.hero;
    for (const a of this.actors) {
      if (a.opacity !== undefined && a.opacity < 1) a.opacity = Math.min(1, a.opacity + dt * 1.5);
      if (a.holdUntil !== undefined && t >= a.holdUntil) {
        a.holdUntil = undefined;
        this.setAnim(a, a.target ? this.moveAnim(a) : a.idleAnim, t);
      }
      const far = a !== h && !a.target && Math.abs(a.x - h.x) + Math.abs(a.y - h.y) > ACTIVE_RANGE;
      if (far) continue;
      const targetZ = this.groundZ(a.x, a.y) + (a.kind === "critter" ? (a.alt ?? 0) : a.flying ? 1.4 : 0);
      a.z += (targetZ - a.z) * Math.min(1, dt * (a.kind === "critter" ? 3 : 12));
      if (a.emote && t > a.emote.until) a.emote = undefined;
      if (a.hidden || (a.kind === "hero" && !a.target)) continue;
      if (a.kind === "critter") {
        this.critterStep(a, dt, t);
        continue;
      }
      if (a.target) {
        if (this.stepToward(a, a.target[0], a.target[1], dt, t)) {
          a.target = null;
          a.running = false;
          if (!a.holdUntil) this.setAnim(a, a.idleAnim, t);
        }
        continue;
      }
      const d = Math.hypot(h.x - a.x, h.y - a.y);
      if (a.kind === "enemy") {
        const def = ENEMIES[a.enemy!];
        if (!heroSafe && d < def.aggro && def.speed > 0) {
          if (!a.alerted) {
            a.alerted = true;
            a.emote = { icon: "!", until: t + 0.9 };
            // a dozing or sniffing beast leaps up at once
            if (a.holdUntil !== undefined) {
              a.holdUntil = undefined;
              this.setAnim(a, "run", t);
            }
          }
          a.running = true;
          a.animRate = 1.25;
          const from = [a.x, a.y];
          this.stepToward(a, h.x, h.y, dt * 1.25, t);
          if (Math.hypot(a.x - a.home[0], a.y - a.home[1]) > a.wander + 4) {
            // at the end of its territory: stand its ground and glare rather than run on the spot
            [a.x, a.y] = from;
            a.running = false;
            a.animRate = 1;
            if (!a.holdUntil) this.setAnim(a, a.idleAnim, t);
          }
        } else {
          if (a.alerted && d > def.aggro + 2) {
            a.alerted = false;
            a.emote = { icon: "?", until: t + 1 };
          }
          a.running = false;
          a.animRate = 1;
          if (!this.fidget(a, t, BEAST_FIDGETS)) this.wanderStep(a, dt, t);
        }
        if (!heroSafe && d < 0.62) touched = a;
        continue;
      }
      // NPCs turn to greet the heroine as she passes, then go back to what they were doing
      const busy = ABSORBED.has(a.idleAnim);
      if (social && !busy && d < 2.4) {
        if (a.holdUntil === undefined || a.anim === "wave") a.dir = dirFrom(h.x - a.x, h.y - a.y);
        if (!a.greeted && d < 2.2) {
          a.greeted = true;
          a.rest = Math.max(a.rest, 2.5);
          if (charDef(a.char).anims.includes("wave") && !a.holdUntil) this.setAnim(a, "wave", t, true);
        }
        continue;
      }
      if (a.greeted && d > 4) {
        a.greeted = false;
        if (a.baseDir !== undefined && !a.route && !a.wander) a.dir = a.baseDir;
      }
      if (a.idleAnim === "sleep" && !a.emote && hash2(Math.floor(t * 0.5), keyHash(a.key), 6) < 0.25) a.emote = { icon: "zzz", until: t + 1.6 };
      if (!busy && a.idleAnim !== "sleep" && a.idleAnim !== "sweep" && this.fidget(a, t, NPC_FIDGETS)) continue;
      if (a.route) this.patrolStep(a, dt, t);
      else if (a.wander > 0) this.wanderStep(a, dt, t);
    }
    this.fx.update(dt);
    return touched;
  }

  /**
   * Now and then an actor standing about breaks into a short idle animation.
   * Returns true while it is busy with one.
   */
  private fidget(a: Actor, t: number, pool: AnimId[]): boolean {
    if (a.holdUntil !== undefined) return a.anim !== "walk" && a.anim !== "run" && !a.target;
    if (a.target || a.anim !== a.idleAnim) return false;
    const h = keyHash(a.key);
    a.fidgetAt ??= t + 5 + (h % 70) / 10;
    if (t < a.fidgetAt) return false;
    const own = pool.filter((id) => charDef(a.char).anims.includes(id));
    a.fidgetAt = t + 7 + hash2(Math.floor(t), h, 8) * 9;
    if (!own.length) return false;
    const pick = own[Math.floor(hash2(Math.floor(t * 3), h, 9) * own.length)];
    a.dir = a.baseDir ?? a.dir;
    this.setAnim(a, pick, t, true);
    if (pick === "sleep") a.emote = { icon: "zzz", until: t + 2 };
    if (pick === "flute") a.emote = { icon: "note", until: t + 1.4 };
    return true;
  }

  private patrolStep(a: Actor, dt: number, t: number): void {
    a.rest -= dt;
    if (a.rest > 0 || !a.route) return;
    a.routeK = ((a.routeK ?? 0) + 1) % a.route.length;
    a.target = [...a.route[a.routeK]];
    a.rest = 3 + hash2(Math.floor(t), a.routeK, 4) * 3;
  }

  private wanderStep(a: Actor, dt: number, t: number): void {
    if (a.wander <= 0 || a.speed <= 0) return;
    a.rest -= dt;
    if (a.rest > 0) return;
    const k = keyHash(a.key);
    const ang = hash2(Math.floor(t * 10), k, 7) * Math.PI * 2;
    const r = Math.sqrt(hash2(Math.floor(t * 10), 3, k)) * a.wander;
    const tx = a.home[0] + Math.cos(ang) * r;
    const ty = a.home[1] + Math.sin(ang) * r;
    if (this.canStand(tx, ty, this.def.map.height(Math.floor(a.x), Math.floor(a.y)), false)) a.target = [tx, ty];
    a.rest = 1.5 + hash2(Math.floor(t), 9, k) * 3;
  }

  /**
   * Wild horses graze and amble about their pasture; one that sees the
   * heroine come close on foot tosses its head and gallops off, then wanders
   * back. They don't shy from another horse, so a rider can ride among them.
   */
  private horseStep(a: Actor, dt: number, t: number): void {
    const h = this.hero;
    const d = Math.hypot(h.x - a.x, h.y - a.y);
    if (!a.running && d < 3.4 && h.char !== "rider") {
      const l = d || 1;
      const tx = a.x + ((a.x - h.x) / l) * 8;
      const ty = a.y + ((a.y - h.y) / l) * 8;
      a.running = true;
      a.speed = 6.2;
      a.target = [tx, ty];
      a.holdUntil = undefined;
      a.emote = { icon: "!", until: t + 0.8 };
      this.setAnim(a, "run", t);
      a.rest = 4;
      return;
    }
    if (a.target) {
      if (this.stepToward(a, a.target[0], a.target[1], dt, t)) {
        a.target = null;
        a.running = false;
        a.speed = 0.9;
        a.rest = 1.5;
        this.setAnim(a, "idle", t);
      }
      return;
    }
    a.rest -= dt;
    if (a.rest > 0 || a.holdUntil !== undefined) return;
    const kh = keyHash(a.key);
    const roll = hash2(Math.floor(t * 2), kh, 31);
    a.rest = 2 + hash2(Math.floor(t), kh, 32) * 4;
    // far from home (after bolting), it walks back; otherwise it grazes, rears for joy now and then, or ambles
    if (Math.hypot(a.x - a.home[0], a.y - a.home[1]) > a.wander + 1) a.target = [...a.home];
    else if (roll < 0.55) this.setAnim(a, "graze", t, true);
    else if (roll < 0.62) this.setAnim(a, "rear", t, true);
    else {
      const ang = hash2(Math.floor(t * 3), kh, 33) * Math.PI * 2;
      const tx = a.home[0] + Math.cos(ang) * a.wander;
      const ty = a.home[1] + Math.sin(ang) * a.wander;
      if (this.canStand(tx, ty, this.def.map.height(Math.floor(a.x), Math.floor(a.y)), false)) a.target = [tx, ty];
    }
  }

  /** Cranes strut about and take wing when the heroine comes near; bats flit in circles. */
  private critterStep(a: Actor, dt: number, t: number): void {
    if (a.char === "horse") return this.horseStep(a, dt, t);
    const h = this.hero;
    const d = Math.hypot(h.x - a.x, h.y - a.y);
    const bat = a.char === "bat";
    const fly = (tx: number, ty: number, speed: number) => {
      const dx = tx - a.x;
      const dy = ty - a.y;
      const l = Math.hypot(dx, dy);
      if (l < 0.05) return true;
      const step = Math.min(l, speed * dt);
      a.x += (dx / l) * step;
      a.y += (dy / l) * step;
      a.dir = dirFrom(dx, dy);
      return false;
    };
    if (bat) {
      const ph = t * 0.9 + a.home[0];
      fly(a.home[0] + Math.cos(ph) * 2.2, a.home[1] + Math.sin(ph * 1.3) * 1.6, 2.4);
      a.alt = 2 + Math.sin(t * 3 + a.home[1]) * 0.4;
      return;
    }
    if (!a.flying && d < 2.6) {
      // startled: flap away from the heroine
      a.flying = true;
      a.alt = 3.2;
      const l = d || 1;
      a.target = [a.x + ((a.x - h.x) / l) * 7, a.y + ((a.y - h.y) / l) * 7];
      this.setAnim(a, "fly", t);
      a.rest = 4;
      return;
    }
    if (a.flying) {
      a.rest -= dt;
      const arrived = a.target ? fly(a.target[0], a.target[1], 3.4) : true;
      if (arrived && a.rest <= 0 && Math.hypot(h.x - a.home[0], h.y - a.home[1]) > 5) a.target = [...a.home];
      if (arrived && a.target && Math.hypot(a.x - a.home[0], a.y - a.home[1]) < 0.1) {
        a.flying = false;
        a.target = null;
        a.alt = 0;
        this.setAnim(a, "idle", t);
      }
      return;
    }
    // on the ground: an occasional slow step, or a peck at the grass
    a.rest -= dt;
    if (a.rest > 0) return;
    const kh = keyHash(a.key);
    a.rest = 2 + hash2(Math.floor(t), kh, 3) * 4;
    if (a.holdUntil === undefined && charDef(a.char).anims.includes("peck") && hash2(Math.floor(t), kh, 4) < 0.45) {
      this.setAnim(a, "peck", t, true);
      return;
    }
    const ang = hash2(Math.floor(t * 3), kh, 9) * Math.PI * 2;
    const tx = a.home[0] + Math.cos(ang) * a.wander;
    const ty = a.home[1] + Math.sin(ang) * a.wander;
    if (this.def.map.standable(Math.floor(tx), Math.floor(ty))) {
      a.dir = dirFrom(tx - a.x, ty - a.y);
      a.x += (tx - a.x) * 0.3;
      a.y += (ty - a.y) * 0.3;
    }
  }

  /** Footprints in sand and snow, ripples under a skimming sword (call as the hero moves). */
  trail(dist: number, t: number): void {
    const h = this.hero;
    this.stepDist += dist;
    if (this.stepDist < 0.42) return;
    this.stepDist = 0;
    const k = this.def.map.kind(Math.floor(h.x), Math.floor(h.y));
    if (h.flying) {
      if (LIQUID[k] === "water" || LIQUID[k] === "paddy") this.fx.emit({ x: isoX(h.x, h.y), y: isoY(h.x, h.y, this.groundZ(h.x, h.y)), life: 0.8, color: "#d8f0ff", size: 1, vx: 0, vy: 0, drag: 1 });
      return;
    }
    const dark = k === "snow" ? "#9aa4c8" : k === "sand" ? "#a8885a" : k === "ash" ? "#120a14" : k === "leaf" ? "#1e2a1a" : null;
    if (!dark) return;
    const side = this.footprints.length % 2 ? 1 : -1;
    const a = (h.dir / 16) * Math.PI * 2;
    this.footprints.push({ x: h.x + Math.cos(a) * 0.08 * side, y: h.y - Math.sin(a) * 0.08 * side, z: this.groundZ(h.x, h.y), at: t, dark });
    if (this.footprints.length > 80) this.footprints.shift();
  }

  /** Snap the camera onto its target at the next frame instead of gliding there. */
  recenter(): void {
    this.camInit = false;
  }

  updateCamera(viewW: number, viewH: number, dt: number, focus?: [number, number, number]): void {
    const m = this.def.map;
    // indoors the camera settles between the heroine and the middle of the room
    const room: [number, number, number] | undefined = this.interior ? [(this.hero.x + m.w / 2) / 2, (this.hero.y + m.h / 2) / 2, 1] : undefined;
    const [fx, fy, fz] = focus ?? room ?? [this.hero.x, this.hero.y, this.hero.z];
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

  // ------------------------------------------------------------------ environment
  /** Sky, weather and light at a world point, blended across region borders and the time of day. */
  envAt(x: number, y: number, t: number): Env {
    const dusk = this.dayNight ? duskAt(t) : 0;
    const w = this.world;
    const base = (d: AreaDef) => d.night + (1 - d.night) * 0.48 * dusk;
    if (!w) return { sky: this.def.sky, sky2: null, k: 0, weather: [[this.def.weather, 1]], night: base(this.def), tint: this.def.tint ?? "#1a1440", dusk };
    const near = AREA_IDS.map((id) => ({ id, d: regionDistance(id, x, y) })).sort((p, q) => p.d - q.d);
    const A = w.regions[near[0].id];
    const B = w.regions[near[1].id];
    const k = Math.max(0, 0.5 - (near[1].d - near[0].d) / (7 * WORLD_SCALE));
    const tintA = A.tint ?? "#1a1440";
    const tintB = B.tint ?? "#1a1440";
    const weather: [Weather, number][] = A.weather === B.weather ? [[A.weather, 1]] : [
      [A.weather, 1 - k],
      [B.weather, k],
    ];
    return { sky: A.sky, sky2: k > 0.02 && B.sky !== A.sky ? B.sky : null, k, weather, night: base(A) * (1 - k) + base(B) * k, tint: mix(tintA, tintB, k), dusk };
  }

  /** Take sky and light from this world point instead of the view's centre (a picture of the whole world painted in patches). */
  envPoint: [number, number] | null = null;
  /** A flat colour behind everything instead of the sky (same reason). */
  backdrop: string | null = null;

  /** The environment at the centre of the view. */
  viewEnv(s: Surface, t: number): Env {
    if (this.envPoint) return this.envAt(...this.envPoint, t);
    const [x, y] = screenToWorld(s.width / 2 - this.camX, s.height / 2 - 12 - this.camY, this.hero.z);
    return this.envAt(x, y, t);
  }

  // ------------------------------------------------------------------ rendering
  private tile(idx: number): TileBuffer | null {
    let tb = this.cache.tiles[idx];
    if (tb === undefined) {
      const m = this.def.map;
      const i = idx % m.w;
      const j = Math.floor(idx / m.w);
      tb = this.cache.tiles[idx] = m.kind(i, j) === "void" ? null : paintTile(m, i, j, this.def.base, 8, this.def.floating);
      this.cache.foams[idx] = tb ? foamOverlay(m, i, j) : null;
    }
    return tb;
  }

  render(s: Surface, t: number): void {
    this.ensureBuckets();
    const cx = Math.round(this.camX);
    const cy = Math.round(this.camY);
    const m = this.def.map;
    const env = this.viewEnv(s, t);
    if (this.backdrop) s.rect(0, 0, s.width, s.height, this.backdrop);
    else {
      drawSky(s, env.sky, t, cx, cy);
      if (env.sky2) drawSky(fadedSurface(s, env.k), env.sky2, t, cx, cy);
      if (env.dusk > 0.35 && !this.interior) this.drawNightSky(s, t, env.dusk);
    }
    const W = s.width;
    const H = s.height;
    const visible = (x: number, y: number, w: number, h: number) => x + w >= 0 && y + h >= 0 && x < W && y < H;

    // visible diagonals: tiles hang below their top corner by at most a column; props and actors rise far above it
    const bMin = Math.max(0, Math.floor((-cy - 64) / 8));
    const bTiles = Math.min(m.w + m.h - 2, Math.ceil((H - cy + this.maxH * LEVEL_H) / 8));
    const bMax = Math.min(m.w + m.h - 2, bTiles + Math.max(24, Math.ceil(this.propRise / 8) + 2));
    const dMin = Math.floor((-16 - cx) / 16) - 1;
    const dMax = Math.ceil((W - cx + 16) / 16) + 1;

    const actorBuckets = new Map<number, Actor[]>();
    for (const a of this.actors) {
      if (a.hidden) continue;
      const b = Math.floor(a.x) + Math.floor(a.y);
      if (b < bMin || b > bMax) continue;
      let arr = actorBuckets.get(b);
      if (!arr) actorBuckets.set(b, (arr = []));
      arr.push(a);
    }
    const prints = new Map<number, typeof this.footprints>();
    for (const f of this.footprints) {
      if (t - f.at > 7) continue;
      const b = Math.floor(f.x) + Math.floor(f.y);
      let arr = prints.get(b);
      if (!arr) prints.set(b, (arr = []));
      arr.push(f);
    }
    const seals = new Map<number, { i: number; j: number; region: AreaId }[]>();
    for (let b = bMin; b <= Math.min(bTiles, this.border.length - 1); b++)
      for (const e of this.border[b]) {
        if (!this.sealed(e.region)) continue;
        const d = e.i - e.j;
        if (d < dMin || d > dMax) continue;
        let arr = seals.get(b);
        if (!arr) seals.set(b, (arr = []));
        arr.push(e);
      }
    const lf = Math.floor(t * 6) % LIQUID_FRAMES;

    for (let b = bMin; b <= bMax; b++) {
      if (b <= bTiles)
        for (let d = dMin; d <= dMax; d++) {
          if ((b + d) & 1) continue;
          const i = (b + d) >> 1;
          const j = (b - d) >> 1;
          if (!m.inside(i, j)) continue;
          const idx = j * m.w + i;
          if (m.kinds[idx] === 0) continue;
          const tb = this.tile(idx);
          if (!tb) continue;
          const h = m.heights[idx];
          const x = isoX(i, j) + cx - 16;
          const y = isoY(i, j, h) + cy;
          if (!visible(x, y, 32, tb.buf.height)) continue;
          s.sprite(tb.buf, x, y);
          const liquid = LIQUID[m.kind(i, j)];
          if (liquid) {
            const phase = (lf + ((i * 3 + j * 5) % 2)) % LIQUID_FRAMES;
            s.sprite(liquidFrame(liquid, phase, m.kind(i, j) === "deep"), x, y + tb.sink);
            const foam = this.cache.foams[idx];
            if (foam) s.sprite(foam, x, y + tb.sink, false, 0.65 + 0.35 * Math.sin(t * 2 + i + j));
            if (m.kind(i + 1, j) === "void" || m.kind(i, j + 1) === "void") this.drawCascade(s, i, j, x, y + tb.sink, liquid, t);
          }
        }
      for (const f of prints.get(b) ?? []) {
        const k = 1 - (t - f.at) / 7;
        const fx = isoX(f.x, f.y) + cx;
        const fy = isoY(f.x, f.y, f.z) + cy;
        s.rect(fx, fy, 2, 1, alpha(f.dark, 0.55 * k));
      }
      const entries: { key: number; draw: () => void }[] = [];
      for (const p of this.bucketProps[b]) {
        if (p.when && !p.when(this.flags)) continue;
        const sheet = getProp(p.id, p.k);
        const fr = sheet.frames[Math.floor((t + p.phase) * sheet.fps) % sheet.frames.length];
        const px = p.ax + cx - sheet.ox;
        const py = p.ay + cy - sheet.oy;
        if (!visible(px, py, fr.width, fr.height)) continue;
        const frame = p.id === "chest" ? sheet.frames[this.isTakenAt(p.i, p.j) ? 1 : 0] : p.id === "herb" && this.isTakenAt(p.i, p.j) ? null : fr;
        if (!frame) continue;
        for (const st of this.stripsCache.get(p)!) if (st.bucket === b) entries.push({ key: p.flat ? b + 0.05 : b + 1, draw: () => s.spriteSlice(frame, px, py, st.c * HALF_W - (p.ax - sheet.ox), HALF_W) });
      }
      for (const a of actorBuckets.get(b) ?? []) entries.push({ key: a.x + a.y, draw: () => this.drawActor(s, a, t, cx, cy) });
      for (const e of seals.get(b) ?? []) entries.push({ key: e.i + e.j + 0.95, draw: () => this.drawSeal(s, e.i, e.j, e.region, t, cx, cy) });
      entries.sort((p, q) => p.key - q.key);
      for (const e of entries) e.draw();
    }

    // x-ray silhouette so the heroine stays visible behind tall props
    if (!this.hero.hidden) {
      const def = charDef(this.hero.char);
      const fr = frameAt(getAnim(this.hero.char, this.hero.anim, this.hero.dir, this.hero.outfit), (t - this.hero.animStart) * (this.hero.animRate ?? 1));
      const ground = this.groundZ(this.hero.x, this.hero.y);
      s.sprite(fr, isoX(this.hero.x, this.hero.y) + cx - def.ox, isoY(this.hero.x, this.hero.y, ground) + cy - (this.hero.z - ground) * LEVEL_H - def.oy, false, 0.28);
    }
    this.drawEmitters(s, t, cx, cy);
    this.drawLife(s, t, cx, cy, env, bMin, bTiles, dMin, dMax);
    this.fx.draw(s, cx, cy);
    for (const [w, k] of env.weather) this.drawWeather(s, w, k, t, cx, cy);
    this.drawLighting(s, t, cx, cy, env);
    if (this.interior) this.drawRoomLight(s, t, cx, cy, env);
    for (const a of this.actors) if (!a.hidden && a.kind !== "critter") this.drawOverhead(s, a, t, cx, cy);
  }

  private isTakenAt(i: number, j: number): boolean {
    if (!this.taken.size) return false;
    const it = this.def.interacts.find((x) => x.i === i && x.j === j && (x.kind === "chest" || x.kind === "herb"));
    return !!it && this.taken.has(it.key);
  }

  heroScreen(): [number, number] {
    return [isoX(this.hero.x, this.hero.y) + this.camX, isoY(this.hero.x, this.hero.y, this.hero.z) + this.camY];
  }

  private drawActor(s: Surface, a: Actor, t: number, cx: number, cy: number): void {
    const def = charDef(a.char);
    const anim = getAnim(a.char, a.anim, a.dir, a.outfit);
    const fr = frameAt(anim, (t - a.animStart) * (a.animRate ?? 1));
    const gx = isoX(a.x, a.y) + cx;
    const ground = this.groundZ(a.x, a.y);
    const gy = isoY(a.x, a.y, ground) + cy;
    const lift = (a.z - ground) * LEVEL_H;
    // a restless shade is only half there, and flickers
    const op = (a.opacity ?? 1) * (a.char === "ghost" ? 0.6 + Math.sin(t * 2.3 + a.x) * 0.08 : 1);
    // contact shadow shrinks as the actor rises
    const sw = Math.max(2, (a.char === "crane" || a.char === "bat" ? 5 : def.w > 60 ? 9 : 6) - lift * 0.15);
    for (let yy = -1; yy <= 1; yy++) {
      const half = Math.round(sw * Math.sqrt(1 - (yy * yy) / 2.2));
      s.rect(gx - half, gy + yy, half * 2 + 1, 1, alpha("#140a20", 0.32 * op));
    }
    if (a.flying && a.kind !== "critter") for (let k = 1; k < 6; k++) s.px(gx - Math.sin(t * 7 + k) * 2 - k * 2 * Math.sign(Math.sin((a.dir / 16) * Math.PI * 2) || 1), gy - lift + 2 + k * 0.4, alpha(k % 2 ? "#9ff5de" : "#ffffff", 0.7 - k * 0.1));
    s.sprite(fr, gx - def.ox, gy - lift - def.oy, false, op);
  }

  private drawOverhead(s: Surface, a: Actor, t: number, cx: number, cy: number): void {
    const def = charDef(a.char);
    const x = isoX(a.x, a.y) + cx;
    const seated = a.anim === "sit" || a.anim === "tell" || a.anim === "weave" || a.anim === "pray" || a.anim === "meditate" || a.anim === "fish" || a.anim === "sleep" || a.anim === "write";
    // a rider's head is about as high as a tall figure's, whatever the size of her (horse-wide) sprite
    const lift = a.char === "rider" ? 44 : (def.oy - 6) * (def.h > 70 ? 1 : 0.62);
    const top = isoY(a.x, a.y, a.z) + cy - lift - 22 + (seated ? 7 : 0);
    if (x < -20 || x > s.width + 20 || top < -30 || top > s.height + 30) return;
    if (a.emote) drawEmote(s, a.emote.icon, x, top - 6 + Math.round(Math.sin(t * 6)), t);
    else if (a.marker) {
      const y = top - 4 + Math.round(Math.sin(t * 4) * 2);
      drawText(s, "!", x - 1, y, "#ffd860", { outline: "#3a1a10" });
    }
  }

  /** Water (or lava) spilling off the edge of the land into the clouds below. */
  private drawCascade(s: Surface, i: number, j: number, x: number, y: number, liquid: "water" | "lava" | "paddy", t: number): void {
    const lava = liquid === "lava";
    const tones = lava ? ["#ffb040", "#f0601e", "#c8301a"] : ["#ffffff", "#9ad0ff", "#5aa0da", "#3a7cc0"];
    const fall = 96;
    for (let px = 1; px < 31; px += 1) {
      const left = px < 16;
      if (left ? this.def.map.kind(i, j + 1) !== "void" : this.def.map.kind(i + 1, j) !== "void") continue;
      const edge = left ? 8 + px * 0.5 : 16 - (px - 15) * 0.5;
      const speed = 70 + hash2(i * 32 + px, j, 3) * 30;
      s.rect(x + px, y + edge, 1, fall * 0.85, alpha(tones[2], 0.45));
      for (let k = 0; k < fall; k += 8) {
        const yy = (k + t * speed) % fall;
        const c = tones[Math.floor(hash2(px, k, i + j) * tones.length)];
        s.rect(x + px, y + edge + yy, 1, 5, alpha(c, (1 - yy / fall) * 0.9));
      }
      s.rect(x + px, y + edge, 1, 2, alpha(tones[0], 0.9));
    }
    // spray where it vanishes into the clouds
    for (let k = 0; k < 4; k++) {
      const a = (t * 0.7 + k / 4 + hash2(i, j, k)) % 1;
      s.rect(x + 4 + hash2(i, k, 2) * 22 + Math.sin(t + k) * 3, y + 16 + fall * 0.8 - a * 10, 3, 2, alpha(lava ? "#ff8040" : "#ffffff", 0.4 * (1 - a)));
    }
  }

  /** A shimmering wall of mist (or demonic qi, or heaven's seal) on a sealed region's border. */
  private drawSeal(s: Surface, i: number, j: number, region: AreaId, t: number, cx: number, cy: number): void {
    const m = this.def.map;
    const z = m.surface(i, j);
    const x = isoX(i + 0.5, j + 0.5) + cx;
    const y = isoY(i + 0.5, j + 0.5, Math.max(0, z)) + cy;
    const c = SEAL_COLOUR[region];
    // rising curtains of mist, brighter at the foot
    for (let k = 0; k < 8; k++) {
      const ph = t * 1.3 + k * 1.1 + (i + j) * 0.7;
      const h = 40 + Math.sin(ph) * 10;
      const xx = x - 16 + k * 4 + Math.sin(ph * 0.7) * 2;
      for (let yy = 0; yy < h; yy += 2) {
        const wave = 0.5 + 0.5 * Math.sin(yy * 0.25 - t * 3 + k);
        s.rect(xx, y - yy, 4, 2, alpha(c, (0.42 * (1 - yy / h) + 0.05) * (0.55 + 0.45 * wave)));
      }
    }
    s.rect(x - 12, y - 1, 24, 2, alpha(c, 0.45 + 0.2 * Math.sin(t * 4 + i + j)));
    // drifting sparks of the seal
    for (let k = 0; k < 2; k++) {
      const age = (t * 0.5 + hash2(i, j, k) ) % 1;
      const sx = x + (hash2(i, j, k + 4) - 0.5) * 26 + Math.sin(t * 2 + k) * 2;
      const sy = y - 4 - age * 34;
      s.rect(sx, sy, 2, 2, alpha(c, 0.9 * (1 - age)));
    }
  }

  private drawNightSky(s: Surface, t: number, dusk: number): void {
    const k = Math.min(1, (dusk - 0.35) / 0.4);
    for (let n = 0; n < (s.width * s.height) / 1400; n++) {
      const x = Math.floor(hash2(n, 1, 91) * s.width);
      const y = Math.floor(hash2(n, 2, 91) * s.height * 0.6);
      const tw = Math.sin(t * (1 + hash2(n, 3, 91) * 2) + n) > 0.3;
      s.px(x, y, alpha("#ffffff", (tw ? 0.9 : 0.4) * k));
    }
    // now and then a shooting star streaks across the sky
    const n = Math.floor(t / 6);
    const age = (t % 6) / 0.9;
    if (age < 1 && hash2(n, 7, 93) < 0.6) {
      const x0 = hash2(n, 1, 93) * s.width;
      const y0 = hash2(n, 2, 93) * s.height * 0.35;
      for (let k2 = 0; k2 < 10; k2++) {
        const u = age - k2 * 0.025;
        if (u < 0) break;
        s.px(x0 + u * 90, y0 + u * 34, alpha(k2 === 0 ? "#ffffff" : "#c8d8ff", k * (1 - age) * (1 - k2 / 10)));
      }
    }
  }

  /**
   * Ambient life: birds wheeling across the sky, butterflies over meadow
   * flowers, koi leaping in the water, and cloud shadows drifting over the land.
   */
  private drawLife(s: Surface, t: number, cx: number, cy: number, env: Env, bMin: number, bMax: number, dMin: number, dMax: number): void {
    if (this.interior) return;
    const m = this.def.map;
    const daylight = 1 - Math.min(1, env.night * 1.4);
    // butterflies and koi on the visible tiles
    for (let b = bMin; b <= bMax; b += 1)
      for (let d = dMin; d <= dMax; d++) {
        if ((b + d) & 1) continue;
        const i = (b + d) >> 1;
        const j = (b - d) >> 1;
        if (!m.inside(i, j)) continue;
        const k = m.kind(i, j);
        const r = hash2(i, j, 404);
        if (k === "meadow" && r < 0.12 && daylight > 0.3) {
          const ph = t * 1.6 + r * 50;
          const x = isoX(i + 0.5 + Math.sin(ph * 0.7) * 0.6, j + 0.5 + Math.cos(ph * 0.5) * 0.6) + cx;
          const y = isoY(i + 0.5, j + 0.5, m.height(i, j)) + cy - 6 - Math.abs(Math.sin(ph * 2)) * 4;
          const flap = Math.sin(t * 22 + r * 9) > 0;
          const c = ["#ffffff", "#ffe070", "#f6a6c9", "#a8d8ff"][Math.floor(r * 33) % 4];
          s.px(x, y, alpha(c, daylight));
          if (flap) {
            s.px(x - 1, y - 1, alpha(c, daylight));
            s.px(x + 1, y - 1, alpha(c, daylight));
          } else {
            s.px(x - 1, y, alpha(c, daylight * 0.7));
            s.px(x + 1, y, alpha(c, daylight * 0.7));
          }
        } else if (k === "water" && r > 0.97 && daylight > 0.4) {
          // dragonflies dart over the shallows and hover
          const ph = t * 0.8 + r * 77;
          const dart = Math.floor(ph) + (ph % 1 > 0.8 ? ((ph % 1) - 0.8) * 5 : 0);
          const x = isoX(i + 0.5 + Math.sin(dart * 2.3) * 0.7, j + 0.5 + Math.cos(dart * 1.7) * 0.7) + cx;
          const y = isoY(i + 0.5, j + 0.5, m.surface(i, j)) + cy - 7 + Math.sin(t * 3 + r * 9);
          const c = r > 0.985 ? "#3ad0e8" : "#e85a3a";
          s.rect(x - 1, y, 3, 1, alpha(c, daylight));
          s.px(x, y - (Math.sin(t * 40 + r * 9) > 0 ? 1 : 0), alpha("#e8f6ff", daylight * 0.8));
        } else if (k === "lava" && r < 0.08) {
          // lava bubbles swell and pop, spitting a spark
          const period = 2 + r * 30;
          const age = ((t + r * 97) % period) / 1.2;
          if (age < 1) {
            const x = isoX(i + 0.3 + r * 5, j + 0.6) + cx;
            const y = isoY(i + 0.5, j + 0.5, m.surface(i, j)) + cy + 2;
            if (age < 0.7) s.rect(x - 1, y - Math.round(age * 2), 1 + Math.round(age * 3), 1 + Math.round(age * 2), alpha("#ffd060", 0.85));
            else s.px(x, y - (age - 0.7) * 30, alpha("#ffb040", 1 - age));
          }
        } else if ((k === "grass" || k === "meadow" || k === "moss") && r > 0.985 && env.night > 0.3) {
          // fireflies rise from the grass after dusk
          const ph = t * 0.7 + r * 60;
          const x = isoX(i + 0.5 + Math.sin(ph) * 0.8, j + 0.5 + Math.cos(ph * 0.8) * 0.8) + cx;
          const y = isoY(i + 0.5, j + 0.5, m.height(i, j)) + cy - 5 - Math.sin(ph * 1.3) * 4;
          const glow = Math.sin(t * 2.2 + r * 40);
          if (glow > 0) {
            s.px(x, y, alpha("#e8ff90", 0.5 + glow * 0.5));
            if (glow > 0.7) s.sprite(glowSprite("#d8ff80", 4), x - 4, y - 2);
          }
        } else if ((k === "dirt" || k === "ash" || k === "sand") && r > 0.993 && daylight > 0.35) {
          // now and then a little dust devil (or a whirl of ash) spins along the ground and dies away
          const period = 8 + r * 300;
          const age = ((t + r * 977) % period) / 2.6;
          if (age < 1) {
            const x0 = isoX(i + 0.5, j + 0.5) + cx + age * 26;
            const y0 = isoY(i + 0.5, j + 0.5, m.height(i, j)) + cy;
            const fade = Math.sin(age * Math.PI);
            const c = k === "ash" ? "#6a5a6a" : k === "sand" ? "#f0dca0" : "#d8c49a";
            for (let n = 0; n < 12; n++) {
              const h = (n / 12) * 14 * fade;
              const a = t * 9 + n * 1.7;
              const rr = 1.5 + (n / 12) * 5;
              s.px(x0 + Math.cos(a) * rr, y0 - h + Math.sin(a) * rr * 0.35, alpha(c, 0.75 * fade));
            }
            if (k === "dirt") s.rect(x0 + Math.cos(t * 5) * 4, y0 - 10 * fade, 2, 1, alpha("#c84a2a", fade));
          }
        } else if (k === "grass" && r > 0.993 && daylight > 0.5) {
          // dandelion seeds drift on the wind
          const age = (t * 0.12 + r * 31) % 1;
          const x = isoX(i + 0.5, j + 0.5) + cx + age * 60 + Math.sin(age * 12 + r) * 4;
          const y = isoY(i + 0.5, j + 0.5, m.height(i, j)) + cy - 4 - age * 26 + Math.sin(age * 20) * 2;
          s.px(x, y, alpha("#ffffff", daylight * 0.9 * Math.sin(age * Math.PI)));
        } else if ((k === "water" || k === "deep") && r > 0.03 && r < 0.055 && daylight > 0.3) {
          // fish shadows glide in slow circles under the surface
          const ph = t * (0.3 + r * 4) + r * 200;
          const u = i + 0.5 + Math.cos(ph) * 0.7;
          const v = j + 0.5 + Math.sin(ph) * 0.7;
          const x = isoX(u, v) + cx;
          const y = isoY(u, v, m.surface(i, j)) + cy + 3;
          const hx = Math.round(isoX(-Math.sin(ph), Math.cos(ph)) / 16);
          const c = alpha("#0a1838", 0.32 * daylight);
          s.rect(x - 2, y, 4, 1, c);
          s.px(x - 1 + hx, y - 1, c);
          s.px(x - 3 * hx, y + (Math.sin(t * 6 + r * 50) > 0 ? 1 : -1), c);
        } else if ((k === "water" || k === "deep") && r < 0.025) {
          const period = 5 + r * 120;
          const age = (t + r * 300) % period;
          const x0 = isoX(i + 0.5, j + 0.5) + cx;
          const y0 = isoY(i + 0.5, j + 0.5, m.surface(i, j)) + cy + 2;
          if (age < 0.7) {
            const u = age / 0.7;
            const fx = x0 - 6 + u * 12;
            const fy = y0 - Math.sin(u * Math.PI) * 10;
            const koi = r < 0.012 ? "#ff8a3a" : "#e8eef8";
            s.rect(fx - 1, fy, 3, 1, koi);
            s.px(fx + (u < 0.5 ? 2 : -2), fy - (u < 0.5 ? 1 : -1), koi);
          } else if (age < 1.6) {
            const u = (age - 0.7) / 0.9;
            for (const side of [-1, 1]) for (const [ox, rr] of [[-6, 1], [6, 1]] as const) s.rect(x0 + ox + side * (2 + u * 6), y0 + rr - u, 2, 1, alpha("#e8f6ff", 0.7 * (1 - u)));
          }
        }
      }
    // birds (or bats under a blood moon) crossing the sky
    const sky = env.sky;
    if (sky !== "forest") {
      const bats = sky === "blood";
      const c = bats ? "#1a0610" : sky === "night" || sky === "storm" ? "#c8d0e8" : "#2a2040";
      for (let f = 0; f < 2; f++) {
        const span = s.width + 160;
        const fx = ((t * (14 + f * 5) + f * 260 - cx * 0.15) % span + span) % span - 80;
        const fy = 24 + f * 34 + Math.sin(t * 0.3 + f) * 10 - cy * 0.05;
        for (let n = 0; n < 5; n++) {
          const bx = fx - Math.abs(n - 2) * 7 + (bats ? Math.sin(t * 5 + n) * 3 : 0);
          const by = fy + Math.abs(n - 2) * 4 + n * (bats ? Math.sin(t * 4 + n) : 0);
          const flap = Math.sin(t * (bats ? 18 : 9) + n * 1.3) > 0 ? 1 : 0;
          s.px(bx - 1, by - flap, c);
          s.px(bx, by, c);
          s.px(bx + 1, by - flap, c);
          if (!bats) {
            s.px(bx - 2, by - flap * 2, c);
            s.px(bx + 2, by - flap * 2, c);
          }
        }
      }
    }
    // soft cloud shadows sliding over the land in daylight
    if ((sky === "day" || sky === "dusk") && daylight > 0.4)
      for (let k = 0; k < 3; k++) {
        const span = s.width + 400;
        const x = ((t * 9 + k * 330 + cx * 0.92) % span + span) % span - 200;
        const y = ((k * 170 + cy * 0.92) % (s.height + 200) + s.height + 200) % (s.height + 200) - 100;
        for (let yy = -24; yy <= 24; yy += 2) {
          const half = Math.round(90 * Math.sqrt(Math.max(0, 1 - (yy * yy) / 600)) * (0.8 + 0.2 * Math.sin(yy * 0.3 + k)));
          s.rect(x - half, y + yy, half * 2, 2, alpha("#0a1030", 0.07 * daylight));
        }
      }
  }

  /**
   * Indoors: shafts of daylight slant in through the lattice windows and
   * fade at dusk, with dust motes turning slowly in them.
   */
  private drawRoomLight(s: Surface, t: number, cx: number, cy: number, env: Env): void {
    const day = Math.max(0, 1 - env.dusk * 1.6);
    if (day <= 0.02) return;
    for (const { i, j } of this.windows) {
      // the window's centre on the wall face, and the patch of floor its light reaches
      const alongI = j === 0;
      const [wx, wy] = alongI ? [i + 0.5, 1] : [1, j + 0.5];
      const [fx, fy] = alongI ? [wx + 1.1, wy + 1.9] : [wx + 1.9, wy + 1.1];
      const x0 = isoX(wx, wy) + cx;
      const y0 = isoY(wx, wy, 5.4) + cy;
      const x1 = isoX(fx, fy) + cx;
      const y1 = isoY(fx, fy, 1) + cy;
      if (Math.max(x0, x1) < -40 || Math.min(x0, x1) > s.width + 40 || y1 < -20 || y0 > s.height + 20) continue;
      const steps = Math.max(1, Math.round(y1 - y0));
      for (let k = 0; k <= steps; k++) {
        const u = k / steps;
        const half = 5 + u * 7;
        const x = x0 + (x1 - x0) * u;
        s.rect(Math.round(x - half), Math.round(y0 + k), Math.round(half * 2), 1, alpha("#fff0c0", (0.1 + 0.06 * u) * day));
      }
      for (let yy = -4; yy <= 4; yy++) {
        const half = Math.round(16 * Math.sqrt(1 - (yy * yy) / 20));
        s.rect(Math.round(x1 - half), Math.round(y1 + yy), half * 2, 1, alpha("#fff0c0", 0.16 * day));
      }
      const g = glowSprite("#fff0c0", 14);
      s.sprite(g, x0 - g.width / 2, y0 - g.height / 2, false, 0.8 * day);
      for (let n = 0; n < 9; n++) {
        const r = hash2(i * 7 + n, j, 61);
        const u = (r + t * 0.03 * (0.5 + hash2(n, i + j, 62))) % 1;
        const x = x0 + (x1 - x0) * u + Math.sin(t * 0.7 + n * 2.3) * (4 + u * 5);
        const y = y0 + (y1 - y0) * u + Math.cos(t * 0.5 + n) * 2;
        s.px(x, y, alpha("#ffffff", (0.45 + 0.4 * Math.sin(t * 2 + n)) * day));
      }
    }
  }

  private drawEmitters(s: Surface, t: number, cx: number, cy: number): void {
    for (const p of gridNear(this.emitters, cx, cy, s.width, s.height)) {
      const def = propDef(p.id);
      if (!def.emit || (p.when && !p.when(this.flags))) continue;
      const x0 = p.ax + cx;
      const y0 = p.ay + cy;
      if (x0 < -60 * p.k || x0 > s.width + 60 * p.k || y0 < -40 || y0 > s.height + 120 * p.k) continue;
      const sheet = getProp(p.id, p.k);
      const top = y0 - sheet.oy;
      const K = p.k;
      for (let n = 0; n < 6; n++) {
        const age = (t * 0.45 + n / 6 + p.phase) % 1;
        const r = hash2(n, p.i * 7 + p.j, 3);
        switch (def.emit) {
          case "smoke": {
            // out of the chimney (houses, the stove), or straight up off the fire
            const chimney = p.id === "house" || p.id === "hearth";
            const sx = x0 + (p.id === "house" ? 10 * K : 0) + Math.sin(age * 4 + n) * 3 + age * 6;
            const sy = (chimney ? top + 4 * K : y0 - 12 * K) - age * 30 * Math.sqrt(K);
            const sz = Math.round((1 + Math.floor(age * 3)) * Math.sqrt(K));
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
          case "mist": {
            // steam curling up off a hot spring
            const sx = x0 + (r - 0.5) * 24 + Math.sin(age * 5 + n) * 4 + age * 8;
            const sy = y0 - 2 - age * 36;
            const sz = 2 + Math.floor(age * 5);
            s.rect(sx - sz / 2, sy, sz, Math.ceil(sz * 0.6), alpha("#f4f6ff", 0.32 * (1 - age) * (age < 0.15 ? age / 0.15 : 1)));
            break;
          }
          case "incense": {
            // one thin thread of smoke from the burner, curling as it rises
            if (n > 2) break;
            const sy = top + 8 - age * 26;
            const sx = x0 + Math.sin(age * 9 + n * 2 + t) * (1 + age * 4);
            s.px(sx, sy, alpha("#e8e4f0", 0.6 * (1 - age)));
            break;
          }
          case "steam": {
            // wisps off a teapot and its cups
            if (n > 3) break;
            const sx = x0 - 2 + (r - 0.5) * 10 + Math.sin(age * 6 + n) * 2;
            const sy = y0 - 16 - age * 14;
            s.px(sx, sy, alpha("#ffffff", 0.5 * (1 - age)));
            break;
          }
          case "dust": {
            // flour dust drifting off the turning millstone
            const a = r * Math.PI * 2 + t * 0.8;
            const sx = x0 + Math.cos(a) * (8 + age * 10);
            const sy = y0 - 10 - age * 12 + Math.sin(a) * 3;
            s.px(sx, sy, alpha("#fff8e8", 0.55 * (1 - age)));
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

  private drawWeather(s: Surface, w: Weather, density: number, t: number, cx: number, cy: number): void {
    if (w === "none" || density <= 0.02) return;
    const W = s.width;
    const H = s.height;
    const n = Math.floor(((W * H) / (w === "snow" ? 1800 : 3200)) * density);
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

  private drawLighting(s: Surface, t: number, cx: number, cy: number, env: Env): void {
    const night = env.night;
    if (night <= 0.01) return;
    s.rect(0, 0, s.width, s.height, alpha(env.tint, night * 0.35));
    s.rect(0, 0, s.width, s.height, alpha("#0a0618", night * 0.32));
    for (const p of gridNear(this.lights, cx, cy, s.width, s.height)) {
      const L = propDef(p.id).light;
      if (!L || (p.when && !p.when(this.flags))) continue;
      const x = p.ax + cx;
      const y = p.ay + cy - L.dy * p.k;
      const radius = L.radius * Math.sqrt(p.k);
      if (x < -radius || x > s.width + radius || y < -radius || y > s.height + radius) continue;
      const flick = 1 + Math.sin(t * 9 + p.phase) * 0.04;
      const g = glowSprite(L.color, Math.round(radius * flick));
      s.sprite(g, x - g.width / 2, y - g.height / 2, false, Math.min(1, 0.5 + night));
    }
    const [hx, hy] = this.heroScreen();
    const hg = glowSprite("#c8fff0", 26);
    s.sprite(hg, hx - hg.width / 2, hy - 18 - hg.height / 2, false, night * 0.8);
  }
}

/** Side of a square patch of screen space (px) that emitting and glowing props are bucketed by. */
const GRID = 256;
const gridKey = (gx: number, gy: number) => (gx + 32768) * 65536 + (gy + 32768);

function gridAdd(grid: Map<number, PropInst[]>, p: PropInst): void {
  const k = gridKey(Math.floor(p.ax / GRID), Math.floor(p.ay / GRID));
  let arr = grid.get(k);
  if (!arr) grid.set(k, (arr = []));
  arr.push(p);
}

/** The props of a grid anchored within reach of the view (smoke, sparks and glows spill a few hundred px past their anchor). */
function* gridNear(grid: Map<number, PropInst[]>, cx: number, cy: number, w: number, h: number, margin = 400): Generator<PropInst> {
  for (let gx = Math.floor((-cx - margin) / GRID); gx <= Math.floor((w - cx + margin) / GRID); gx++)
    for (let gy = Math.floor((-cy - margin) / GRID); gy <= Math.floor((h - cy + margin) / GRID); gy++) yield* grid.get(gridKey(gx, gy)) ?? [];
}

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
    case "zzz":
      drawText(s, "Z", x0 + 2 + (Math.floor(t * 2) % 2), y0 + 2, "#6a7ad8");
      if (Math.floor(t * 2) % 2) s.px(x0 + 8, y0 + 1, "#6a7ad8");
      break;
    case "note":
      s.rect(x0 + 6, y0 + 1, 1, 5, "#7a3ac8");
      s.rect(x0 + 4, y0 + 5, 2, 2, "#7a3ac8");
      s.px(x0 + 7, y0 + 2, "#7a3ac8");
      break;
  }
}
