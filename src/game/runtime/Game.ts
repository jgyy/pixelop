import { alpha } from "../pixel/color";
import type { Surface } from "../pixel/surface";
import { sRing } from "../pixel/surface";
import { isoX, isoY, screenDirToWorld } from "../iso/projection";
import { charDef, type AnimId, type HumanId } from "../art/characters";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { reviveAtSect, type BattleAction } from "../engine/battle";
import { atBottleneck, cultivationNeeded, FINAL_REALM, levelIndex, realmLabel, REALMS, type Stats } from "../engine/realms";
import { applyBreakthrough, buyPill, consumePill, gainCultivation, heal, stats, type GameState, type SkillId } from "../engine/state";
import { getArea, type AreaId } from "../world/areas";
import { getWorld } from "../world/continent";
import { getInterior, isInteriorId, type InteriorDef, type InteriorId } from "../world/interiors";
import { AREA_IDS } from "../world/ids";
import { toWorld, WORLD_SCALE } from "../world/layout";
import { NODES } from "../world/overworld";
import type { Step } from "../story/script";
import { altarScript, areaUnlocked, arrivalScript, endingScript, hasNews, introScript, lockReason, npcScript, preBattleScript, questLog, victoryScript, type Quest } from "../story/story";
import { BattleScene } from "./battle";
import { dirFrom, World, type Actor } from "./world";
import { WorldMap } from "./worldmap";

export type Mode = "explore" | "scene" | "battle" | "worldmap" | "shop" | "meditate" | "tribulation";

export interface UiSnapshot {
  mode: Mode;
  state: GameState;
  stats: Stats;
  realm: string;
  realmColour: string;
  cultivationNeeded: number;
  bottleneck: boolean;
  area: { id: AreaId; name: string; hanzi: string; subtitle: string };
  prompt: string | null;
  flying: boolean;
  /** Riding Cloudmane, her spirit horse. */
  riding: boolean;
  quest: Quest;
  dialog: { speaker: string; portrait: HumanId | null; text: string; seq: number } | null;
  narration: { text: string; index: number; total: number } | null;
  battle: { enemy: EnemyId; enemyName: string; enemyHp: number; enemyMax: number; heroHp: number; heroQi: number; busy: boolean; log: string[]; boss: boolean; skills: SkillId[] } | null;
  worldmap: { at: AreaId; travelling: boolean; heading: AreaId; nodes: { id: AreaId; name: string; hanzi: string; subtitle: string; locked: string | null }[] } | null;
  tribulation: string | null;
  banner: { title: string; hanzi: string; subtitle: string; seq: number } | null;
  /** The building she is inside, if any. */
  interior: { id: InteriorId; name: string; hanzi: string } | null;
  toasts: { id: number; text: string }[];
  canSkip: boolean;
}

const MOVE_KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
};

const CONFIRM = new Set(["KeyE", "Enter", "Space", "NumpadEnter"]);
/** One-shot animations that walking away interrupts. */
const IDLE_FIDGETS = new Set<AnimId>(["stretch", "look", "gather", "nod", "point", "cheer", "drink", "read", "pray", "clap", "laugh", "rear", "flute"]);
/** Seated or absorbed idles that a speaker keeps while talking instead of standing up. */
const SEATED = new Set<AnimId>(["fish", "sit", "tell", "weave", "pray"]);
const RUN_KEYS = ["ShiftLeft", "ShiftRight"];
const WALK_SPEED = 3.3;
const RUN_SPEED = 5.2;
const FLY_SPEED = 5.6;
/** Cloudmane at a canter, and flat out at a gallop (Shift): the fastest way across the jianghu's roads. */
const CANTER_SPEED = 7.4;
const GALLOP_SPEED = 11;

interface Runner {
  steps: Step[];
  i: number;
  /** Seconds left on a timed step. */
  wait: number;
  /** Actor we're waiting on (walk / anim). */
  waitActor?: Actor;
  waitAnim?: boolean;
  waitInput: boolean;
  narrIndex: number;
}

/**
 * The live game. Owns the save state and the active scene (an explorable
 * area, the world map, or a battle), runs cutscene scripts, and paints frames
 * to any Surface. React renders the HUD and menus from UiSnapshots.
 */
export class Game {
  state: GameState;
  mode: Mode = "explore";
  clock = 0;
  world: World;
  worldMap: WorldMap | null = null;
  battle: BattleScene | null = null;

  private keys = new Set<string>();
  private stick: [number, number] = [0, 0];
  private tapTarget: [number, number] | null = null;
  private listeners = new Set<(s: UiSnapshot) => void>();
  private dirty = true;
  private toasts: { id: number; text: string; until: number }[] = [];
  private seq = 0;
  private runner: Runner | null = null;
  private queue: Step[][] = [];
  private dialog: UiSnapshot["dialog"] = null;
  private narration: UiSnapshot["narration"] = null;
  private banner: UiSnapshot["banner"] = null;
  private bannerUntil = 0;
  private prompt: string | null = null;
  private invulnerableUntil = 0;
  private idleTime = 0;
  private fidgets = 0;
  /** The landmark whose banner was shown last (until she walks away from it). */
  private landmark: string | null = null;
  private sealToastAt = -99;
  private syncAt = 0;
  private fade = 0;
  private fadeTarget = 0;
  private shake = 0;
  private flash = 0;
  private flashColor = "#ffffff";
  private cameraFocus: [number, number, number] | null = null;
  private medTick = 0;
  private trib: { start: number; bolts: number; struck: number; final: boolean; done: boolean } | null = null;
  private tribText: string | null = null;
  private boltFx: { at: number }[] = [];
  private returnMode: Mode = "explore";
  /** The room she is standing in, and the open world waiting outside it. */
  private interior: { def: InteriorDef; outdoor: World } | null = null;

  constructor(state: GameState, opts: { intro?: boolean; seed?: number } = {}) {
    this.state = state;
    this.seed = opts.seed ?? Date.now();
    this.world = this.makeWorld(Game.openGround([state.x, state.y], state.area), state.dir);
    this.state = { ...this.state, x: this.world.hero.x, y: this.world.hero.y, area: this.world.regionAt(this.world.hero.x, this.world.hero.y) };
    this.showBanner();
    if (opts.intro) {
      this.fade = 1;
      this.play(introScript());
    }
  }

  private readonly seed: number;

  /**
   * A loaded position that is no longer open ground (an old save, a world
   * that grew around it) would leave the heroine stuck: land her at the
   * nearest open tile instead, or failing that at her region's waypoint.
   */
  private static openGround([x, y]: [number, number], area: AreaId): [number, number] {
    const m = getWorld().map;
    const ok = (i: number, j: number) => m.standable(i, j) && [-1, 0, 1].every((d) => m.standable(i + d, j) && m.standable(i, j + d));
    if (ok(Math.floor(x), Math.floor(y))) return [x, y];
    for (let r = 1; r <= 4; r++)
      for (let dj = -r; dj <= r; dj++)
        for (let di = -r; di <= r; di++) {
          const i = Math.floor(x) + di;
          const j = Math.floor(y) + dj;
          if (ok(i, j)) return [i + 0.5, j + 0.5];
        }
    return getWorld().waypoints[area];
  }

  // ------------------------------------------------------------------ public API
  subscribe(fn: (s: UiSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => this.listeners.delete(fn);
  }

  keyDown(code: string): void {
    if (this.keys.has(code)) return;
    this.keys.add(code);
    this.onPress(code);
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  releaseAll(): void {
    this.keys.clear();
    this.stick = [0, 0];
  }

  /** Analog input from the touch joystick (screen space, -1..1). */
  setStick(x: number, y: number): void {
    this.stick = [x, y];
    if (x || y) this.tapTarget = null;
  }

  /** Tap/click on the canvas (in canvas pixels): walk there, or pick a world-map destination. */
  tap(sx: number, sy: number): void {
    if (this.mode === "worldmap" && this.worldMap) {
      for (const id of AREA_IDS) {
        const [x, y] = this.worldMap.nodeScreen(id);
        if (Math.hypot(sx - x, sy - y) < 18) return this.mapSelect(id);
      }
      return;
    }
    if (this.mode === "scene") return this.advance();
    if (this.mode !== "explore") return;
    const w = this.world;
    const z = w.hero.z;
    const a = (sx - w.camX) / 16;
    const b = (sy - w.camY + z * 8) / 8;
    this.tapTarget = [(a + b) / 2, (b - a) / 2];
  }

  getShake(): [number, number] {
    const s = Math.max(this.shake, this.battle?.shake ?? 0);
    if (s <= 0) return [0, 0];
    const m = Math.ceil(s * 4);
    return [Math.round((Math.random() - 0.5) * m), Math.round((Math.random() - 0.5) * m)];
  }

  get flying(): boolean {
    return !!this.world.hero.flying;
  }

  get riding(): boolean {
    return this.world.hero.char === "rider";
  }

  /** Whistle Cloudmane down out of the clouds, or swing down from her saddle. */
  toggleRide(): void {
    if (this.mode !== "explore") return;
    if (this.riding) return this.dismount(true);
    if (!this.state.flags.metElder) return this.toast("Elder Mo has not given you Cloudmane's whistle yet.");
    if (this.interior) return this.toast("Cloudmane waits outside — there's no room for a horse in here.");
    const h = this.world.hero;
    if (h.flying) {
      if (!this.world.def.map.standable(Math.floor(h.x), Math.floor(h.y))) return this.toast("Cloudmane can't stand on water.");
      h.flying = false;
    }
    h.char = "rider";
    h.idleAnim = "idle";
    this.idleTime = 0;
    // she rears as she arrives, tossing her cloud mane
    this.world.setAnim(h, "rear", this.clock, true);
    const [x, y] = [isoX(h.x, h.y), isoY(h.x, h.y, h.z)];
    this.world.fx.burst(x, y - 10, 26, ["#ffffff", "#e8fff8", "#9ff5de"], 60);
    if (!this.state.flags.rodeCloudmane) {
      this.state = { ...this.state, flags: { ...this.state.flags, rodeCloudmane: true } };
      this.toast("Cloudmane gallops down out of the clouds. Shift to gallop, R to dismount.");
    }
    this.markDirty();
  }

  /** Step down from the saddle (Cloudmane melts back into the clouds). */
  private dismount(effects = false): void {
    const h = this.world.hero;
    if (h.char !== "rider") return;
    h.char = "heroine";
    h.running = false;
    this.world.setAnim(h, "idle", this.clock);
    if (effects) {
      const [x, y] = [isoX(h.x, h.y), isoY(h.x, h.y, h.z)];
      this.world.fx.burst(x, y - 10, 20, ["#ffffff", "#e8fff8"], 45);
    }
    this.markDirty();
  }

  toggleFly(): void {
    if (this.mode !== "explore") return;
    if (!this.state.flags.metElder) return this.toast("You have not learned Sword Riding yet.");
    if (this.interior) return this.toast("There's no room to ride a sword in here.");
    this.dismount();
    const h = this.world.hero;
    if (h.flying) {
      const m = this.world.def.map;
      if (!m.standable(Math.floor(h.x), Math.floor(h.y), false)) return this.toast("You can't land here.");
    }
    h.flying = !h.flying;
    if (h.idleAnim === "sit") h.idleAnim = "idle";
    this.world.setAnim(h, h.flying ? "fly" : "idle", this.clock);
    const [x, y] = [isoX(h.x, h.y), isoY(h.x, h.y, h.z)];
    this.world.fx.burst(x, y, 14, ["#9ff5de", "#ffffff"], 50);
    this.markDirty();
  }

  takePill(kind: "heal" | "qi"): void {
    if (this.mode !== "explore" && this.mode !== "meditate") return;
    const next = consumePill(this.state, kind);
    if (!next) return this.toast("No pills of that kind.");
    this.state = next;
    const h = this.world.hero;
    if (!h.flying && !this.riding && this.mode === "explore") this.world.setAnim(h, "drink", this.clock, true);
    this.world.fx.burst(isoX(h.x, h.y), isoY(h.x, h.y, h.z) - 14, 14, kind === "heal" ? ["#ff8aa8", "#ffffff"] : ["#9ff5de", "#ffffff"], 40);
    this.toast(kind === "heal" ? "A Healing Pill restores your vitality." : "A Qi Gathering Pill refills your dantian.");
  }

  buy(kind: "heal" | "qi"): void {
    const next = buyPill(this.state, kind);
    if (!next) return this.toast("Not enough spirit stones.");
    this.state = next;
    this.toast(kind === "heal" ? "Bought a Healing Pill." : "Bought a Qi Gathering Pill.");
  }

  closeShop(): void {
    if (this.mode !== "shop") return;
    this.mode = "explore";
    this.advanceRunner();
    this.markDirty();
  }

  battleAction(action: BattleAction): void {
    if (this.mode !== "battle" || !this.battle) return;
    const r = this.battle.act(this.state, action);
    if ("rejected" in r) return this.toast(r.rejected);
    this.state = r.state;
    this.markDirty();
  }

  /** Advance dialogue / narration (E, Enter, Space, click). */
  advance(): void {
    const r = this.runner;
    if (this.mode !== "scene" || !r || !r.waitInput) return;
    const step = r.steps[r.i];
    if (step && "narrate" in step && r.narrIndex < step.narrate.length - 1) {
      r.narrIndex++;
      this.narration = { text: step.narrate[r.narrIndex], index: r.narrIndex, total: step.narrate.length };
      this.markDirty();
      return;
    }
    r.waitInput = false;
    this.dialog = null;
    this.narration = null;
    r.i++;
    this.markDirty();
  }

  /** Fast-forward the current cutscene, applying its effects but skipping talk and waits. */
  skipScene(): void {
    let guard = 0;
    while (this.mode === "scene" && this.runner && guard++ < 500) {
      const r = this.runner;
      const step = r.steps[r.i];
      if (step && "battle" in step) break;
      if (r.waitInput) {
        r.waitInput = false;
        this.dialog = null;
        this.narration = null;
        r.i++;
      } else if (r.waitActor) {
        if (r.waitActor.target) {
          [r.waitActor.x, r.waitActor.y] = r.waitActor.target;
          r.waitActor.target = null;
          this.world.setAnim(r.waitActor, r.waitActor.idleAnim, this.clock);
        }
        r.waitActor = undefined;
        r.i++;
      } else if (r.wait > 0) {
        r.wait = 0;
        r.i++;
      } else this.runSteps(0);
    }
    this.fade = this.fadeTarget;
    this.markDirty();
  }

  // ------------------------------------------------------------------ world map
  openMap(): void {
    if (this.mode !== "explore") return;
    if (!this.state.flags.metElder) return this.toast("Elder Mo is waiting for you. Speak with him before leaving the sect.");
    if (this.interior) return this.toast("Step outside to see the roads of the jianghu.");
    this.worldMap = new WorldMap(this.state.area, [this.world.hero.x, this.world.hero.y]);
    this.mode = "worldmap";
    this.markDirty();
  }

  closeMap(): void {
    if (this.mode !== "worldmap" || this.worldMap?.travelling) return;
    const at = this.worldMap!.at;
    this.worldMap = null;
    if (at === this.state.area) this.mode = "explore";
    else this.enterArea(at);
    this.markDirty();
  }

  /** Pick a destination on the world map (fly there, or enter if already there). */
  mapSelect(id: AreaId): void {
    const wm = this.worldMap;
    if (this.mode !== "worldmap" || !wm) return;
    const reason = lockReason(id, this.state);
    if (reason) return this.toast(`${getArea(id).name}: ${reason}`);
    if (wm.at === id && !wm.travelling) return this.enterArea(id);
    if (!wm.travelTo(id, (n) => areaUnlocked(n, this.state))) this.toast("No open road leads there yet.");
    this.markDirty();
  }

  /** Fast travel: land at a region's waypoint (or a given world position) in the one continuous world. */
  enterArea(id: AreaId, pos?: [number, number]): void {
    this.dropInterior();
    this.dismount();
    const [x, y] = pos ?? getWorld().waypoints[id];
    this.state = { ...this.state, area: id, x, y };
    this.world.placeHero(x, y, 8);
    this.world.syncPopulation(this.state.flags);
    this.worldMap = null;
    this.mode = "explore";
    this.invulnerableUntil = this.clock + 1.5;
    this.fade = 1;
    this.fadeTarget = 0;
    this.showBanner();
    const arrival = arrivalScript(id, this.state);
    if (arrival) this.play(arrival);
    this.markDirty();
  }

  // ------------------------------------------------------------------ debug hooks (tests)
  debugPatch(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    this.markDirty();
  }

  /** Jump to region-local coordinates (as the hand-built region layouts are authored). */
  debugTeleport(area: AreaId, lx: number, ly: number): void {
    this.debugGoto(...toWorld(area, lx, ly));
  }

  /** Jump to a point of the open world, in world tiles. */
  debugGoto(x: number, y: number): void {
    this.dismount();
    this.runner = null;
    this.queue = [];
    this.dialog = null;
    this.narration = null;
    this.battle = null;
    this.dropInterior();
    this.state = { ...this.state, area: this.world.regionAt(x, y), x, y };
    this.world.placeHero(x, y, 8);
    this.world.syncPopulation(this.state.flags);
    this.worldMap = null;
    this.mode = "explore";
    this.fade = 0;
    this.fadeTarget = 0;
    this.invulnerableUntil = this.clock + 1;
    this.markDirty();
  }

  /** Walk straight into a building (tests and screenshots). */
  debugEnter(id: InteriorId): void {
    this.runner = null;
    this.queue = [];
    this.mode = "explore";
    this.dropInterior();
    this.enterInterior(id);
    this.fade = 0;
  }

  get inside(): InteriorId | null {
    return this.interior?.def.key ?? null;
  }

  debugBattle(enemy: EnemyId, key = `debug-${enemy}`): void {
    this.runner = null;
    this.startBattle(enemy, key);
  }

  debugSkipTime(seconds: number, dt = 1 / 30): void {
    for (let t = 0; t < seconds; t += dt) this.update(dt);
  }

  // ------------------------------------------------------------------ internals
  private makeWorld([x, y]: [number, number], dir: number): World {
    const w = new World(getWorld(), { x, y, dir }, this.state.flags, this.state.taken);
    w.sealed = (id) => !areaUnlocked(id, this.state);
    w.updateCamera(480, 270, 0);
    // the real view may be any size: snap to it on the first frame rather than sliding across
    w.recenter();
    return w;
  }

  /** Step through a door into one of the jianghu's buildings. */
  private enterInterior(id: InteriorId): void {
    if (this.interior) return;
    const outdoor = this.world;
    if (outdoor.hero.flying) return this.toast("Step down from your sword first.");
    // Cloudmane waits in the clouds while she is indoors
    this.dismount();
    const base = getInterior(id);
    // the room belongs to the region its door stands in
    const def: InteriorDef = { ...base, id: this.state.area };
    outdoor.placeHero(def.outside[0], def.outside[1], dirFrom(-def.inward[0], -def.inward[1]));
    outdoor.setAnim(outdoor.hero, "idle", this.clock);
    const w = new World(def, { x: def.arrive[0], y: def.arrive[1], dir: dirFrom(def.inward[0], def.inward[1]) }, this.state.flags, this.state.taken);
    w.updateCamera(480, 270, 0);
    w.recenter();
    this.world = w;
    this.interior = { def, outdoor };
    this.tapTarget = null;
    this.idleTime = 0;
    this.fade = 1;
    this.fadeTarget = 0;
    this.banner = { title: def.name, hanzi: def.hanzi, subtitle: def.subtitle, seq: ++this.seq };
    this.bannerUntil = this.clock + 3;
    this.markDirty();
  }

  /** Back out through the door, onto the step in front of the building. */
  private exitInterior(): void {
    const it = this.interior;
    if (!it) return;
    this.dropInterior();
    const h = this.world.hero;
    this.world.placeHero(it.def.outside[0], it.def.outside[1], dirFrom(-it.def.inward[0], -it.def.inward[1]));
    this.world.setAnim(h, "idle", this.clock);
    this.world.syncPopulation(this.state.flags);
    this.state = { ...this.state, x: h.x, y: h.y, dir: h.dir };
    this.tapTarget = null;
    this.idleTime = 0;
    this.fade = 1;
    this.fadeTarget = 0;
    this.markDirty();
  }

  /** Leave whatever room she is in without ceremony (fast travel, defeat, debug teleports). */
  private dropInterior(): void {
    if (!this.interior) return;
    this.world = this.interior.outdoor;
    this.interior = null;
  }

  /**
   * Walking into a doorway goes through it: bumping into a building from its
   * door step enters it, and walking out over a room's threshold leaves.
   */
  private throughDoorway(dx: number, dy: number): boolean {
    const w = this.world;
    const h = w.hero;
    if (h.flying) return false;
    const it = this.interior;
    const doors = it ? [{ i: it.def.exit[0], j: it.def.exit[1], dir: [-it.def.inward[0], -it.def.inward[1]], to: "out" }] : Game.doors();
    for (const d of doors) {
      if (Math.hypot(d.i + 0.5 - h.x, d.j + 0.5 - h.y) > 0.75) continue;
      if ((dx * d.dir[0] + dy * d.dir[1]) / (Math.hypot(dx, dy) || 1) < 0.6) continue;
      // only once she is up against the wall (or the room's open edge)
      if (w.canStand(h.x + d.dir[0] * 0.45, h.y + d.dir[1] * 0.45, w.def.map.height(Math.floor(h.x), Math.floor(h.y)), false)) continue;
      if (d.to === "out") this.exitInterior();
      else if (isInteriorId(d.to)) this.enterInterior(d.to);
      return this.world !== w;
    }
    return false;
  }

  private static doorCache: { i: number; j: number; dir: number[]; to: string }[] | null = null;
  private static doors() {
    return (Game.doorCache ??= getWorld()
      .interacts.filter((it) => it.kind === "door" && isInteriorId(it.to))
      .map((it) => ({ i: it.i, j: it.j, dir: getInterior(it.to as InteriorId).inward, to: it.to! })));
  }

  /** Crossing into another region: new banner, and its first-arrival scene. */
  private trackRegion(): void {
    const h = this.world.hero;
    const r = this.world.regionAt(h.x, h.y);
    if (r === this.state.area) return;
    this.state = { ...this.state, area: r };
    this.showBanner();
    const arrival = arrivalScript(r, this.state);
    if (arrival) this.play(arrival);
    this.markDirty();
  }

  /** Walking up to a landmark of the wilds names it, like crossing into a region. */
  private trackLandmark(): void {
    if (this.interior) return;
    const h = this.world.hero;
    const near = getWorld().landmarks.find((l) => Math.hypot(l.x + 0.5 - h.x, l.y + 0.5 - h.y) < 7 * WORLD_SCALE);
    if (!near) {
      if (this.landmark && !getWorld().landmarks.some((l) => l.key === this.landmark && Math.hypot(l.x + 0.5 - h.x, l.y + 0.5 - h.y) < 11 * WORLD_SCALE)) this.landmark = null;
      return;
    }
    if (near.key === this.landmark) return;
    this.landmark = near.key;
    this.banner = { title: near.name, hanzi: near.hanzi, subtitle: getArea(this.state.area).name, seq: ++this.seq };
    this.bannerUntil = this.clock + 3;
    this.markDirty();
  }

  private showBanner(): void {
    const d = getArea(this.state.area);
    this.banner = { title: d.name, hanzi: d.hanzi, subtitle: d.subtitle, seq: ++this.seq };
    this.bannerUntil = this.clock + 3.5;
  }

  private toast(text: string): void {
    this.toasts = [...this.toasts.slice(-2), { id: ++this.seq, text, until: this.clock + 4.5 }];
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty = true;
  }

  /** Queue a script; it starts immediately if nothing else is running. */
  play(steps: Step[]): void {
    if (steps.length === 0) return;
    // she swings down from the saddle to talk, read or watch
    this.dismount();
    if (this.runner) {
      this.queue.push(steps);
      return;
    }
    this.runner = { steps, i: 0, wait: 0, waitInput: false, narrIndex: 0 };
    if (this.mode === "explore" || this.mode === "meditate") this.returnMode = "explore";
    this.mode = "scene";
    this.runSteps(0);
    this.markDirty();
  }

  private actorByKey(key: string): Actor | undefined {
    return this.world.actor(key);
  }

  private endRunner(): void {
    this.runner = null;
    this.dialog = null;
    this.narration = null;
    this.cameraFocus = null;
    if (this.mode === "scene") this.mode = this.returnMode === "meditate" ? "meditate" : "explore";
    const next = this.queue.shift();
    if (next) this.play(next);
    this.markDirty();
  }

  private advanceRunner(): void {
    if (this.runner) {
      this.runner.i++;
      this.mode = "scene";
      this.runSteps(0);
    }
  }

  /** Execute steps until one needs to wait. */
  private runSteps(dt: number): void {
    const r = this.runner;
    if (!r) return;
    for (let guard = 0; guard < 200; guard++) {
      if (r.waitInput) return;
      if (r.wait > 0) {
        r.wait -= dt;
        if (r.wait > 0) return;
        r.wait = 0;
        r.i++;
        dt = 0;
        continue;
      }
      if (r.waitActor) {
        const a = r.waitActor;
        const busy = r.waitAnim ? a.holdUntil !== undefined : a.target !== null;
        if (busy) return;
        r.waitActor = undefined;
        r.waitAnim = false;
        r.i++;
        continue;
      }
      const step = r.steps[r.i];
      if (!step) return this.endRunner();
      this.markDirty();
      if ("say" in step) {
        const portrait = step.say !== "narrator" && charDef(step.say).portrait ? step.say : null;
        const speaker = step.name ?? (step.say === "narrator" ? "" : charDef(step.say).name);
        this.dialog = { speaker, portrait, text: step.text, seq: ++this.seq };
        r.waitInput = true;
        // the nearest NPC of that character speaks (two villagers may share a look)
        const h = this.world.hero;
        const actor =
          step.say === "heroine"
            ? h
            : this.world.actors.filter((a) => a.char === step.say && a.kind === "npc").sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
        if (actor && actor.kind === "npc" && !SEATED.has(actor.idleAnim) && charDef(actor.char).anims.includes("talk") && !actor.holdUntil) {
          this.world.setAnim(actor, "talk", this.clock);
          const back = actor;
          setTimeoutish(this, 2.2, () => back.anim === "talk" && this.world.setAnim(back, back.idleAnim, this.clock));
        }
        return;
      }
      if ("narrate" in step) {
        r.narrIndex = 0;
        this.narration = { text: step.narrate[0], index: 0, total: step.narrate.length };
        r.waitInput = true;
        this.fade = 1;
        this.fadeTarget = 1;
        return;
      }
      if ("emote" in step) {
        const a = step.emote === "hero" ? this.world.hero : this.actorByKey(step.emote);
        if (a) a.emote = { icon: step.icon, until: this.clock + 1.4 };
        r.wait = step.wait ?? 0.6;
        continue;
      }
      if ("face" in step) {
        const a = step.face === "hero" ? this.world.hero : this.actorByKey(step.face);
        const b = step.to === "hero" ? this.world.hero : this.actorByKey(step.to);
        if (a && b) a.dir = dirFrom(b.x - a.x, b.y - a.y);
        r.i++;
        continue;
      }
      if ("walk" in step) {
        const a = step.walk === "hero" ? this.world.hero : this.actorByKey(step.walk);
        if (!a) {
          r.i++;
          continue;
        }
        a.target = [...step.to];
        // scripted walks are at a walk, even if she was running a moment ago
        if (a.kind === "hero") {
          a.speed = 3;
          a.running = false;
        }
        if (step.wait === false) {
          r.i++;
          continue;
        }
        r.waitActor = a;
        r.waitAnim = false;
        return;
      }
      if ("anim" in step) {
        const a = step.anim === "hero" ? this.world.hero : this.actorByKey(step.anim);
        if (a) {
          const hold = step.name !== a.idleAnim && step.name !== "fish" && step.name !== "idle";
          if (step.name === "fish" || step.name === "idle") a.idleAnim = step.name;
          this.world.setAnim(a, step.name, this.clock, hold);
          if (step.wait && hold) {
            r.waitActor = a;
            r.waitAnim = true;
            return;
          }
        }
        r.i++;
        continue;
      }
      if ("wait" in step) {
        r.wait = step.wait;
        return;
      }
      if ("shake" in step) {
        this.shake = step.shake;
        r.i++;
        continue;
      }
      if ("flash" in step) {
        this.flash = 1;
        this.flashColor = step.flash;
        r.i++;
        continue;
      }
      if ("fade" in step) {
        this.fadeTarget = step.fade === "out" ? 1 : 0;
        r.wait = 0.5;
        continue;
      }
      if ("camera" in step) {
        const c = step.camera;
        if (c === null) this.cameraFocus = null;
        else if (typeof c === "string") {
          const a = c === "hero" ? this.world.hero : this.actorByKey(c);
          if (a) this.cameraFocus = [a.x, a.y, a.z];
        } else this.cameraFocus = [c[0], c[1], this.world.groundZ(c[0], c[1])];
        r.i++;
        continue;
      }
      if ("toast" in step) {
        this.toast(step.toast);
        r.i++;
        continue;
      }
      if ("spawn" in step) {
        if (!this.actorByKey(step.spawn)) {
          const a: Actor = { key: step.spawn, kind: "npc", char: step.char, x: step.at[0], y: step.at[1], z: this.world.groundZ(step.at[0], step.at[1]), dir: step.dir ?? 0, anim: "idle", animStart: this.clock, idleAnim: "idle", target: null, speed: 2.4, wander: 0, home: [...step.at], rest: 0 };
          this.world.actors.push(a);
          this.world.fx.burst(isoX(a.x, a.y), isoY(a.x, a.y, a.z) - 12, 16, ["#ffffff", "#ffb070"], 40);
        }
        r.i++;
        continue;
      }
      if ("despawn" in step) {
        this.world.removeActor(step.despawn);
        r.i++;
        continue;
      }
      if ("mutate" in step) {
        this.state = step.mutate(this.state);
        r.i++;
        continue;
      }
      if ("shop" in step) {
        this.mode = "shop";
        return;
      }
      if ("meditate" in step) {
        r.i = r.steps.length;
        this.endRunner();
        this.beginMeditation();
        return;
      }
      if ("travel" in step) {
        r.i = r.steps.length;
        this.endRunner();
        this.openMap();
        return;
      }
      if ("battle" in step) {
        r.i++;
        const rest = r.steps.slice(r.i);
        this.runner = null;
        this.dialog = null;
        if (rest.length) this.queue.unshift(rest);
        this.startBattle(step.battle, step.key);
        return;
      }
    }
  }

  // ------------------------------------------------------------------ battle
  /** Step off the flying sword — unless she is hovering over water, where she would sink. */
  private land(): void {
    const h = this.world.hero;
    if (h.flying && this.world.def.map.standable(Math.floor(h.x), Math.floor(h.y))) h.flying = false;
  }

  private startBattle(enemy: EnemyId, key: string): void {
    this.land();
    this.dismount();
    this.battle = new BattleScene(this.state.area, enemy, key, this.state, (this.seed + Math.floor(this.clock * 1000)) >>> 0);
    this.mode = "battle";
    this.dialog = null;
    this.markDirty();
  }

  private endBattle(): void {
    const b = this.battle!;
    this.battle = null;
    this.mode = "explore";
    this.invulnerableUntil = this.clock + 2.2;
    this.land();
    this.world.setAnim(this.world.hero, this.world.hero.flying ? "fly" : "idle", this.clock);
    if (b.result === "won") {
      this.world.defeat(b.enemyKey);
      if (b.levelUp) this.toast(`Your cultivation rises: ${b.levelUp}!`);
      if (atBottleneck(this.state)) this.toast("Your qi has reached its peak! Meditate at a shrine and press B to face the tribulation.");
      this.play(victoryScript(b.enemy, b.enemyKey, this.state.area, this.state));
    } else if (b.result === "lost" && ENEMIES[b.enemy].friendly) {
      // a friendly duel: Xiao Han lowers his blade instead of letting her fall
      const s = stats(this.state);
      this.state = { ...this.state, hp: Math.max(this.state.hp, Math.ceil(s.maxHp * 0.3)) };
      this.world.setAnim(this.world.hero, "bow", this.clock, true);
      this.play(victoryScript(b.enemy, b.enemyKey, this.state.area, this.state, false));
    } else if (b.result === "lost") {
      this.queue = [];
      this.dropInterior();
      this.state = reviveAtSect(this.state);
      this.world.placeHero(this.state.x, this.state.y, 0);
      this.fade = 1;
      this.showBanner();
      this.toast("You awaken beside the lotus shrine of the Azure Cloud Sect.");
    } else {
      const next = this.queue.shift();
      if (next) this.play(next);
    }
    this.markDirty();
  }

  // ------------------------------------------------------------------ meditation & tribulation
  private beginMeditation(): void {
    const h = this.world.hero;
    this.land();
    this.dismount();
    this.mode = "meditate";
    this.world.setAnim(h, "meditate", this.clock);
    h.idleAnim = "meditate";
    this.medTick = 0;
    this.toast(atBottleneck(this.state) ? "Your qi is full. Press B to call down the Heavenly Tribulation." : "You sit in lotus position and draw in the qi of heaven and earth…");
    this.markDirty();
  }

  private stopMeditation(): void {
    const h = this.world.hero;
    h.idleAnim = "idle";
    this.world.setAnim(h, "idle", this.clock);
    this.mode = "explore";
    this.markDirty();
  }

  private updateMeditate(dt: number): void {
    const h = this.world.hero;
    const [hx, hy] = [isoX(h.x, h.y), isoY(h.x, h.y, h.z) - 12];
    if (Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      const r = 30 + Math.random() * 30;
      this.world.fx.emit({ x: hx + Math.cos(a) * r, y: hy + Math.sin(a) * r * 0.5, tx: hx, ty: hy, life: 1.2, color: Math.random() < 0.6 ? "#9ff5de" : "#ffffff" });
    }
    this.medTick += dt;
    if (this.medTick < 1) return;
    this.medTick -= 1;
    const s = stats(this.state);
    const altar = this.state.area === "peak";
    const need = cultivationNeeded(this.state.realm, this.state.stage);
    const gain = Math.max(3, Math.round(need / (altar ? 7 : 20)));
    const was = atBottleneck(this.state);
    const r = gainCultivation(heal(this.state, s.maxHp * 0.08, s.maxQi * 0.08), gain);
    this.state = r.state;
    if (!was && this.state.realm < FINAL_REALM) this.world.fx.float(`+${gain}`, hx, hy - 20, "#9ff5de");
    if (r.stagesGained) {
      this.world.fx.burst(hx, hy, 30, ["#9ff5de", "#ffffff", "#f2c55c"], 70);
      this.toast(`Your cultivation deepens: ${realmLabel(this.state.realm, this.state.stage)}.`);
    }
    if (!was && atBottleneck(this.state)) this.toast("Your qi has reached its peak! Press B to face the Heavenly Tribulation.");
    this.markDirty();
  }

  startTribulation(): void {
    if (this.mode !== "meditate" && this.mode !== "explore") return;
    if (!atBottleneck(this.state)) return this.toast("Your qi has not yet reached its peak.");
    if (this.mode === "explore") {
      const near = this.world.nearestInteraction();
      if (!near?.it || (near.it.kind !== "shrine" && near.it.kind !== "altar")) return this.toast("Face the tribulation while meditating at a shrine.");
      this.beginMeditation();
    }
    const final = this.state.realm === FINAL_REALM - 1;
    if (final && this.state.area !== "peak") return this.toast("The final tribulation can only be faced on Heavenly Tribulation Peak.");
    this.mode = "tribulation";
    this.trib = { start: this.clock, bolts: final ? 9 : 3, struck: 0, final, done: false };
    this.tribText = final ? "The heavens split open. Nine bolts gather above the peak…" : "Heaven's lightning gathers above you…";
    this.markDirty();
  }

  private updateTribulation(): void {
    const tr = this.trib!;
    const h = this.world.hero;
    const el = this.clock - tr.start;
    const gap = tr.final ? 1.1 : 1.4;
    const due = Math.floor((el - 1.4) / gap) + 1;
    const [hx, hy] = [isoX(h.x, h.y), isoY(h.x, h.y, h.z)];
    if (Math.random() < 0.5) this.world.fx.emit({ x: hx + (Math.random() - 0.5) * 140, y: hy - Math.random() * 90, tx: hx, ty: hy - 12, life: 1, color: Math.random() < 0.5 ? "#b8a4ff" : "#ffffff" });
    while (tr.struck < Math.min(tr.bolts, due)) {
      tr.struck++;
      this.boltFx.push({ at: this.clock });
      this.shake = 0.9;
      this.flash = 0.9;
      this.flashColor = "#e8e0ff";
      this.world.setAnim(h, "hurt", this.clock, true);
      this.world.fx.burst(hx, hy - 14, 30, ["#ffffff", "#b8a4ff", "#9ff5de"], 90);
      this.world.fx.float(`BOLT ${tr.struck}/${tr.bolts}`, hx, hy - 44, "#e8dcff");
      const lines = ["The bolt tempers your meridians!", "Your old limits shatter!", "Your dao heart does not waver!"];
      this.tribText = tr.final ? `Bolt ${tr.struck} of nine — ${lines[(tr.struck - 1) % 3]}` : lines[tr.struck - 1];
      this.markDirty();
    }
    if (h.holdUntil === undefined && h.anim !== "meditate" && !tr.done) this.world.setAnim(h, "meditate", this.clock);
    const end = 1.4 + tr.bolts * gap + 0.6;
    if (!tr.done && el > end) {
      tr.done = true;
      const before = REALMS[this.state.realm].name;
      this.state = applyBreakthrough(this.state);
      const after = REALMS[this.state.realm];
      this.flash = 1;
      this.flashColor = after.colour;
      this.world.setAnim(h, "victory", this.clock);
      h.idleAnim = "idle";
      for (let k = 0; k < 3; k++) this.world.fx.burst(hx, hy - 14, 40, [after.colour, "#ffffff", "#f2c55c"], 60 + k * 40);
      this.tribText = `Breakthrough! ${before} → ${after.name}`;
      this.toast(`Breakthrough! You have reached ${after.name} (${after.hanzi}).${this.state.realm === 2 ? " Learned: Nine Heavens Thunder (5)" : ""}`);
      this.markDirty();
    }
    if (tr.done && el > end + 2.6) {
      this.trib = null;
      this.tribText = null;
      this.mode = "explore";
      this.world.setAnim(h, "idle", this.clock);
      if (tr.final) this.play(endingScript());
      this.markDirty();
    }
  }

  // ------------------------------------------------------------------ explore
  private moveInput(): [number, number] {
    let sx = this.stick[0];
    let sy = this.stick[1];
    for (const k of this.keys) {
      const v = MOVE_KEYS[k];
      if (v) {
        sx += v[0];
        sy += v[1];
      }
    }
    return [Math.max(-1, Math.min(1, sx)), Math.max(-1, Math.min(1, sy))];
  }

  private updateExplore(dt: number): void {
    const w = this.world;
    const h = w.hero;
    const [sx, sy] = this.moveInput();
    let dx = 0;
    let dy = 0;
    let run = RUN_KEYS.some((k) => this.keys.has(k));
    if (sx || sy) {
      [dx, dy] = screenDirToWorld(sx, sy);
      const mag = Math.min(1, Math.hypot(sx, sy));
      dx *= mag;
      dy *= mag;
      // a joystick pushed all the way breaks into a run
      if (this.stick[0] || this.stick[1]) run ||= Math.hypot(...this.stick) > 0.95;
    } else if (this.tapTarget) {
      const tx = this.tapTarget[0] - h.x;
      const ty = this.tapTarget[1] - h.y;
      const d = Math.hypot(tx, ty);
      if (d < 0.12) this.tapTarget = null;
      else {
        dx = tx / d;
        dy = ty / d;
        run ||= d > 4;
      }
    }
    run &&= !h.flying;
    const riding = h.char === "rider";
    const speed = h.flying ? FLY_SPEED : riding ? (run ? GALLOP_SPEED : CANTER_SPEED) : run ? RUN_SPEED : WALK_SPEED;
    if (dx || dy) {
      this.idleTime = 0;
      h.dir = dirFrom(dx, dy);
      const [x0, y0] = [h.x, h.y];
      if (h.idleAnim === "sit") h.idleAnim = "idle";
      if (this.throughDoorway(dx, dy)) return;
      const moved = w.move(h, dx * speed * dt, dy * speed * dt);
      if (!moved) this.tapTarget = null;
      w.trail(Math.hypot(h.x - x0, h.y - y0), this.clock);
      h.running = run;
      if (h.holdUntil === undefined || IDLE_FIDGETS.has(h.anim)) w.setAnim(h, h.flying ? "fly" : run ? "run" : "walk", this.clock);
      if (!h.flying && Math.random() < dt * (run ? 16 : 6) * (riding ? 2 : 1)) w.fx.emit({ x: isoX(h.x, h.y) - dx * 4 + (riding ? (Math.random() - 0.5) * 10 : 0), y: isoY(h.x, h.y, h.z), vx: -dx * (run ? 18 : 8) * (riding ? 1.6 : 1), vy: run ? -14 : -8, life: run ? 0.5 : 0.4, color: "#e8dcc8", gravity: 20, size: (run || riding) && Math.random() < 0.4 ? 2 : 1 });
      // Cloudmane's hooves leave little wisps of cloud
      if (riding && Math.random() < dt * 10) w.fx.emit({ x: isoX(h.x, h.y) + (Math.random() - 0.5) * 12, y: isoY(h.x, h.y, h.z) - 2, vx: -dx * 10, vy: -6, life: 0.7, color: Math.random() < 0.5 ? "#ffffff" : "#c8fff0" });
      if (h.flying && Math.random() < dt * 25) w.fx.emit({ x: isoX(h.x, h.y), y: isoY(h.x, h.y, h.z) + 2, vx: -dx * 30, vy: -4, life: 0.5, color: Math.random() < 0.5 ? "#9ff5de" : "#ffffff" });
    } else if (h.holdUntil === undefined) {
      w.setAnim(h, h.flying ? "fly" : h.idleAnim, this.clock);
      // left alone for a while, Lin Yue stretches or glances around (and Cloudmane rears now and then)
      this.idleTime += dt;
      if (riding && this.idleTime > 9) {
        this.idleTime = 0;
        w.setAnim(h, "rear", this.clock, true);
      } else if (!h.flying && !riding && this.idleTime > 8) {
        this.idleTime = -4;
        // first a stretch or a glance around; left alone longer, she hums, nods off or practises a pointing form
        const pool: AnimId[] = this.fidgets++ < 1 ? ["look", "stretch"] : ["stretch", "look", "nod", "point", "cheer", "clap", "laugh", "flute"];
        // left alone long enough, she sits down where she stands until she moves again
        if (this.fidgets > 4 && h.idleAnim === "idle") h.idleAnim = "sit";
        else {
          const pick = pool[Math.floor(this.clock) % pool.length];
          w.setAnim(h, pick, this.clock, true);
          // the dizi plays a few bars
          if (pick === "flute") h.emote = { icon: "note", until: this.clock + 1.6 };
        }
      }
    }
    // indoors, the save remembers the step outside the door
    const anchor = this.interior ? this.interior.outdoor.hero : h;
    this.state.x = anchor.x;
    this.state.y = anchor.y;
    this.state.dir = anchor.dir;
    if (w.bumped) {
      const r = w.bumped;
      w.bumped = null;
      this.tapTarget = null;
      if (this.clock - this.sealToastAt > 3) {
        this.sealToastAt = this.clock;
        this.toast(`${getArea(r).name}: ${lockReason(r, this.state) ?? "The way is sealed."}`);
      }
    }
    this.trackRegion();
    this.trackLandmark();
    if (this.mode !== "explore") return;

    if (this.clock > this.syncAt) {
      this.syncAt = this.clock + 0.5;
      w.syncPopulation(this.state.flags);
    }
    const touched = w.update(dt, this.clock, h.flying === true || this.clock < this.invulnerableUntil, true);
    if (touched && touched.enemy) {
      this.tapTarget = null;
      const pre = preBattleScript(touched.enemy, touched.key);
      if (pre) {
        this.invulnerableUntil = this.clock + 999;
        this.play([...pre, { battle: touched.enemy, key: touched.key }]);
      } else this.startBattle(touched.enemy, touched.key);
      return;
    }
    this.updatePrompt();
  }

  private updatePrompt(): void {
    const near = this.world.nearestInteraction();
    let text: string | null = null;
    if (near?.npc) text = `E · Talk to ${charDef(near.npc.char).name}`;
    else if (near?.it) {
      const it = near.it;
      text = {
        shrine: atBottleneck(this.state) ? "E · Meditate   B · Face the Tribulation" : "E · Meditate at the lotus shrine",
        exit: "E · Open the world map",
        chest: "E · Open the chest",
        herb: "E · Gather the spirit herb",
        sign: "E · Read",
        altar: "E · Step onto the taiji dais",
        door: it.to === "out" ? "E · Step outside" : `E · Enter ${doorName(it.to)}`,
      }[it.kind];
    }
    if (text !== this.prompt) {
      this.prompt = text;
      this.markDirty();
    }
  }

  private interact(): void {
    const near = this.world.nearestInteraction();
    if (!near) return;
    // she swings down from the saddle to talk, gather, open or read (a world-map gate she can use from horseback)
    if (near.it?.kind !== "exit") this.dismount();
    const h = this.world.hero;
    if (near.npc) {
      const npc = near.npc;
      h.dir = dirFrom(npc.x - h.x, npc.y - h.y);
      if (npc.idleAnim !== "fish" && npc.idleAnim !== "practice") npc.dir = dirFrom(h.x - npc.x, h.y - npc.y);
      npc.target = null;
      this.play(npcScript(npc.key, this.state));
      return;
    }
    const it = near.it!;
    switch (it.kind) {
      case "shrine":
        h.dir = dirFrom(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
        this.beginMeditation();
        break;
      case "altar":
        this.play(altarScript(this.state));
        break;
      case "exit":
        this.openMap();
        break;
      case "sign":
        h.dir = dirFrom(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
        if (!h.flying) this.world.setAnim(h, it.anim ?? "read", this.clock, true);
        this.play([{ say: "narrator", text: it.text ?? "" }]);
        break;
      case "door":
        if (it.to === "out") this.exitInterior();
        else if (isInteriorId(it.to)) this.enterInterior(it.to);
        break;
      case "herb": {
        h.dir = dirFrom(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
        if (!h.flying) this.world.setAnim(h, "gather", this.clock, true);
        this.state = { ...this.state, taken: [...this.state.taken, it.key] };
        this.world.taken.add(it.key);
        const s = stats(this.state);
        const r = gainCultivation(heal(this.state, s.maxHp * 0.2, s.maxQi * 0.4), Math.round(cultivationNeeded(this.state.realm, this.state.stage) * 0.35));
        this.state = r.state;
        const [x, y] = [isoX(it.i + 0.5, it.j + 0.5), isoY(it.i + 0.5, it.j + 0.5, this.world.groundZ(it.i + 0.5, it.j + 0.5))];
        this.world.fx.burst(x, y - 8, 18, ["#ffd23a", "#ffffff", "#9ff5de"], 45);
        this.world.fx.float("+QI", x, y - 16, "#ffd23a");
        this.toast(r.stagesGained ? `Spirit herb absorbed — you reach ${realmLabel(this.state.realm, this.state.stage)}!` : "Spirit herb absorbed. Qi surges through your meridians.");
        break;
      }
      case "chest": {
        h.dir = dirFrom(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
        if (!h.flying) this.world.setAnim(h, "gather", this.clock, true);
        const L = levelIndex(this.state.realm, this.state.stage);
        const stones = 25 + L * 10;
        this.state = { ...this.state, taken: [...this.state.taken, it.key], stones: this.state.stones + stones, pills: { heal: Math.min(99, this.state.pills.heal + 1), qi: Math.min(99, this.state.pills.qi + 1) } };
        this.world.taken.add(it.key);
        const [x, y] = [isoX(it.i + 0.5, it.j + 0.5), isoY(it.i + 0.5, it.j + 0.5, this.world.groundZ(it.i + 0.5, it.j + 0.5))];
        this.world.fx.burst(x, y - 8, 20, ["#f2c55c", "#ffffff"], 50);
        this.toast(`Found ${stones} spirit stones, a Healing Pill and a Qi Gathering Pill!`);
        break;
      }
    }
    this.markDirty();
  }

  private onPress(code: string): void {
    switch (this.mode) {
      case "scene":
        if (CONFIRM.has(code)) this.advance();
        else if (code === "Escape") this.skipScene();
        return;
      case "shop":
        if (code === "Escape" || code === "KeyE") this.closeShop();
        else if (code === "Digit1") this.buy("heal");
        else if (code === "Digit2") this.buy("qi");
        return;
      case "meditate":
        if (code === "KeyB") return this.startTribulation();
        if (code === "KeyH") return this.takePill("heal");
        if (code === "KeyQ") return this.takePill("qi");
        if (CONFIRM.has(code) || code === "Escape" || MOVE_KEYS[code]) this.stopMeditation();
        return;
      case "battle": {
        const map: Record<string, BattleAction> = {
          Digit1: { type: "skill", skill: "strike" },
          Digit2: { type: "skill", skill: "palm" },
          Digit3: { type: "skill", skill: "swords" },
          Digit4: { type: "skill", skill: "lotus" },
          Digit5: { type: "skill", skill: "thunder" },
          Digit6: { type: "item", item: "heal" },
          Digit7: { type: "item", item: "qi" },
          Digit0: { type: "flee" },
        };
        if (map[code]) this.battleAction(map[code]);
        return;
      }
      case "worldmap": {
        const v = MOVE_KEYS[code];
        const wm = this.worldMap!;
        if (v) {
          const n = wm.nudge(v[0], v[1] * 0.5, (id) => areaUnlocked(id, this.state));
          if (!n) this.toast("No open road in that direction.");
          this.markDirty();
        } else if (CONFIRM.has(code) && !wm.travelling) this.enterArea(wm.at);
        else if (code === "Escape" || code === "KeyM") this.closeMap();
        return;
      }
      case "explore":
        if (CONFIRM.has(code)) this.interact();
        else if (code === "KeyF") this.toggleFly();
        else if (code === "KeyR") this.toggleRide();
        else if (code === "KeyB") this.startTribulation();
        else if (code === "KeyH") this.takePill("heal");
        else if (code === "KeyQ") this.takePill("qi");
        else if (code === "KeyM") this.openMap();
        return;
      default:
        return;
    }
  }

  // ------------------------------------------------------------------ loop
  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    this.state.playTime += dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.fade += (this.fadeTarget - this.fade) * Math.min(1, dt * 4);
    if (Math.abs(this.fade - this.fadeTarget) < 0.01) this.fade = this.fadeTarget;
    this.tickTimers();
    if (this.toasts.length && this.toasts[0].until < this.clock) {
      this.toasts = this.toasts.filter((t) => t.until >= this.clock);
      this.markDirty();
    }
    if (this.banner && this.clock > this.bannerUntil) {
      this.banner = null;
      this.markDirty();
    }
    switch (this.mode) {
      case "explore":
        this.updateExplore(dt);
        break;
      case "scene":
        this.world.update(dt, this.clock, true, false);
        this.runSteps(dt);
        break;
      case "meditate":
        this.world.update(dt, this.clock, true);
        this.updateMeditate(dt);
        break;
      case "tribulation":
        this.world.update(dt, this.clock, true);
        this.updateTribulation();
        break;
      case "shop":
        this.world.update(dt, this.clock, true);
        break;
      case "worldmap": {
        const arrived = this.worldMap!.update(dt);
        if (arrived) {
          this.toast(`${getArea(arrived).name} — press E / Enter to land`);
          this.markDirty();
        }
        break;
      }
      case "battle": {
        const b = this.battle!;
        const before = [b.view.heroHp, b.view.heroQi, b.view.enemyHp, b.busy, b.log.length, b.log[b.log.length - 1]].join("|");
        b.update(dt);
        if ([b.view.heroHp, b.view.heroQi, b.view.enemyHp, b.busy, b.log.length, b.log[b.log.length - 1]].join("|") !== before) this.markDirty();
        if (b.done) this.endBattle();
        break;
      }
    }
    for (const a of this.world.actors) if (a.kind === "npc") a.marker = this.mode === "explore" && hasNews(a.key, this.state);
    if (this.dirty) {
      this.dirty = false;
      const snap = this.snapshot();
      this.listeners.forEach((l) => l(snap));
    }
  }

  private timers: { at: number; fn: () => void }[] = [];
  /** @internal used by script helpers */
  schedule(delay: number, fn: () => void): void {
    this.timers.push({ at: this.clock + delay, fn });
  }
  private tickTimers(): void {
    if (!this.timers.length) return;
    const due = this.timers.filter((t) => t.at <= this.clock);
    if (!due.length) return;
    this.timers = this.timers.filter((t) => t.at > this.clock);
    for (const t of due) t.fn();
  }

  render(s: Surface): void {
    if (this.mode === "battle" && this.battle) {
      this.battle.render(s);
      if (this.battle.flash > 0) s.rect(0, 0, s.width, s.height, alpha(this.battle.flashColor, this.battle.flash * 0.45));
      return;
    }
    if (this.mode === "worldmap" && this.worldMap) {
      this.worldMap.render(s, this.clock, (id) => areaUnlocked(id, this.state), 1 / 60);
      this.drawOverlays(s);
      return;
    }
    const w = this.world;
    w.updateCamera(s.width, s.height, 1 / 60, this.cameraFocus ?? undefined);
    w.render(s, this.clock);
    if (this.mode === "meditate" || this.mode === "tribulation") {
      const h = w.hero;
      const x = isoX(h.x, h.y) + w.camX;
      const y = isoY(h.x, h.y, h.z) + w.camY;
      const r = 18 + Math.sin(this.clock * 2) * 2;
      sRing(s, x, y - 2, r, alpha("#9ff5de", 0.45));
      sRing(s, x, y - 2, r * 0.6, alpha("#ffffff", 0.3));
    }
    if (this.mode === "tribulation" && this.trib) this.drawTribulation(s);
    this.drawOverlays(s);
  }

  private drawTribulation(s: Surface): void {
    const tr = this.trib!;
    const w = this.world;
    const h = w.hero;
    const el = this.clock - tr.start;
    const dark = Math.min(0.55, el * 0.3) * (tr.done ? Math.max(0, 1 - (el - (1.4 + tr.bolts * (tr.final ? 1.1 : 1.4) + 0.6)) * 0.8) : 1);
    s.rect(0, 0, s.width, s.height, alpha("#0a0620", dark));
    const x = Math.round(isoX(h.x, h.y) + w.camX);
    const y = Math.round(isoY(h.x, h.y, h.z) + w.camY);
    for (const b of this.boltFx) {
      const age = this.clock - b.at;
      if (age > 0.45) continue;
      let bx = x + Math.sin(b.at * 13) * 40;
      let by = 0;
      let i = 0;
      while (by < y - 14) {
        const nx = bx + Math.sin(b.at * 7 + i * 3.1) * 10 + (x - bx) * 0.25;
        const ny = Math.min(y - 14, by + 12);
        for (const [ox, c] of [
          [0, age < 0.15 ? "#ffffff" : alpha("#ffffff", 0.6)],
          [1, alpha("#b8a4ff", 0.8)],
          [-1, alpha("#b8a4ff", 0.5)],
        ] as [number, string][]) {
          const steps = Math.max(1, Math.ceil(Math.hypot(nx - bx, ny - by)));
          for (let k = 0; k <= steps; k++) s.px(bx + ((nx - bx) * k) / steps + ox, by + ((ny - by) * k) / steps, c);
        }
        bx = nx;
        by = ny;
        i++;
      }
      sRing(s, x, y - 12, 18 * (1 - age * 2), alpha("#ffffff", 0.5));
    }
    this.boltFx = this.boltFx.filter((b) => this.clock - b.at < 0.5);
    if (tr.done) {
      const k = Math.min(1, (el - (1.4 + tr.bolts * (tr.final ? 1.1 : 1.4) + 0.6)) / 1.5);
      const c = REALMS[this.state.realm].colour;
      for (let r = 0; r < 3; r++) sRing(s, x, y - 12, 10 + k * 120 + r * 12, alpha(c, Math.max(0, 1 - k) * 0.8));
      s.rect(x - 2, 0, 4, y - 10, alpha(c, Math.max(0, 1 - k) * 0.6));
    }
  }

  private drawOverlays(s: Surface): void {
    if (this.flash > 0) s.rect(0, 0, s.width, s.height, alpha(this.flashColor, this.flash * 0.45));
    if (this.fade > 0.005) s.rect(0, 0, s.width, s.height, alpha("#0a0612", this.fade));
  }

  snapshot(): UiSnapshot {
    const s = stats(this.state);
    const area = getArea(this.state.area);
    const b = this.battle;
    const wm = this.worldMap;
    return {
      mode: this.mode,
      state: { ...this.state, pills: { ...this.state.pills }, flags: { ...this.state.flags }, skills: [...this.state.skills] },
      stats: s,
      realm: realmLabel(this.state.realm, this.state.stage),
      realmColour: REALMS[this.state.realm].colour,
      cultivationNeeded: cultivationNeeded(this.state.realm, this.state.stage),
      bottleneck: atBottleneck(this.state),
      area: { id: area.id, name: area.name, hanzi: area.hanzi, subtitle: area.subtitle },
      prompt: this.mode === "explore" ? this.prompt : null,
      flying: this.flying,
      riding: this.riding,
      quest: questLog(this.state),
      dialog: this.mode === "scene" ? this.dialog : null,
      narration: this.mode === "scene" ? this.narration : null,
      battle: b
        ? {
            enemy: b.enemy,
            enemyName: ENEMIES[b.enemy].name,
            enemyHp: Math.round(b.view.enemyHp),
            enemyMax: b.battle.enemyMaxHp,
            heroHp: Math.round(b.view.heroHp),
            heroQi: Math.round(b.view.heroQi),
            busy: b.busy,
            log: b.log,
            boss: !!ENEMIES[b.enemy].boss,
            skills: [...this.state.skills],
          }
        : null,
      worldmap: wm
        ? {
            at: wm.at,
            travelling: wm.travelling,
            heading: wm.heading,
            nodes: (Object.keys(NODES) as AreaId[]).map((id) => {
              const d = getArea(id);
              return { id, name: d.name, hanzi: d.hanzi, subtitle: d.subtitle, locked: lockReason(id, this.state) };
            }),
          }
        : null,
      tribulation: this.mode === "tribulation" ? this.tribText : null,
      banner: this.mode === "explore" || this.mode === "scene" ? this.banner : null,
      interior: this.interior ? { id: this.interior.def.key, name: this.interior.def.name, hanzi: this.interior.def.hanzi } : null,
      toasts: this.toasts.map(({ id, text }) => ({ id, text })),
      canSkip: this.mode === "scene",
    };
  }
}

/** "the Hall of Clouds", but "Granny Hua's Cottage". */
function doorName(to: string | undefined): string {
  if (!isInteriorId(to)) return "";
  const name = getInterior(to).name;
  return /^\S+ \S+'s /.test(name) ? name : `the ${name}`;
}

/** Run a callback after `delay` seconds of game time. */
function setTimeoutish(game: Game, delay: number, fn: () => void): void {
  game.schedule(delay, fn);
}
