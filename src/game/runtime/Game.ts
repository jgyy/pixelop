import { alpha } from "../pixel/color";
import type { Surface } from "../pixel/surface";
import { sRing } from "../pixel/surface";
import { isoX, isoY, screenDirToWorld } from "../iso/projection";
import { turnToView, type View3D } from "./view";
import { charDef, type AnimId, type HumanId } from "../art/characters";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { reviveAtSect, type BattleAction } from "../engine/battle";
import { atBottleneck, cultivationNeeded, FINAL_REALM, levelIndex, realmLabel, REALMS, type Stats } from "../engine/realms";
import { applyBreakthrough, buyPill, consumePill, gainCultivation, heal, pillUseful, stats, type GameState, type SkillId } from "../engine/state";
import { getArea, type AreaId } from "../world/areas";
import { getWorld } from "../world/continent";
import type { InteriorDef } from "../world/interiors";
import { getRoom, isRoomId, roomOpen, type RoomId } from "../world/rooms";
import { AREA_IDS } from "../world/ids";
import { toWorld, WORLD_SCALE } from "../world/layout";
import { NODES } from "../world/overworld";
import { atTimeOfDay, calendarAt, calendarLabel, CLIMATE, rainingAt, SEASON_INFO, TIME_SKIP, worldTime, YEAR_LENGTH, type Season } from "../world/calendar";
import type { Step } from "../story/script";
import { ATTIRE, ATTIRE_HINT, currentAttire, hasAttire, nextAttire, ownedAttire, wearAttire } from "../story/wardrobe";
import { abandon, advance, BOUNTY_COUNT, bountiesDone, carried, deliveryScript, folk, fulfil, offerFrom, offerScript, progressText, rewardText, slotsFree, type Carried } from "../story/bounties";
import { almanacScript, landmarkScript, offeringScript, yearHasNews, yearQuest } from "../story/year";
import { altarScript, areaUnlocked, arrivalScript, endingScript, errand, hasNews, introScript, lockReason, npcScript, preBattleScript, questLog, victoryScript, type Quest } from "../story/story";
import { BattleScene } from "./battle";
import { currentWar, daoJournal, daoLabel, warBreath, warChronicle, warCultivated, warDone, warHasNews, warHunt, warLandmark, warLog, warTalk, WAR_COUNT } from "../story/war";
import { daoAside, daoHasNews } from "../story/dao";
import { currentRoad, roadBreath, roadChronicle, roadCultivated, roadDone, roadHasNews, roadHunt, roadLandmark, roadLog, roadTalk, ROAD_COUNT, syncRoadFlags } from "../story/road";
import { hallsBreath, hallsChronicle, hallsCultivated, hallsDone, hallsHasNews, hallsHunt, hallsLandmark, hallsLog, hallsTalk, HALLS_COUNT, syncHallsFlags } from "../story/halls";
import { peoplesBreath, peoplesChronicle, peoplesCultivated, peoplesDone, peoplesHasNews, peoplesHunt, peoplesLandmark, peoplesLog, peoplesTalk, PEOPLES_COUNT, syncPeoplesFlags } from "../story/peoples";
import { stairBarToast, syncTiersFlags, tiersBreath, tiersChronicle, tiersCultivated, tiersDone, tiersHasNews, tiersHunt, tiersLandmark, tiersLog, tiersTalk, TIERS_COUNT } from "../story/tiers";
import { floorRefusal, standingJournal, standingLabel } from "../story/standing";
import { BREATHS_PER_WU, comprehend, deepestWu, domainOpen, GREAT_DAOS, SHRINE_DAO, WU_TIERS, wuJournal, wuTotal } from "../engine/comprehension";
import { aweAside, conditionAside, cultivationHasNews, heartDemonTrial, pointerAside, realmAside, trialDue } from "../story/cultivation";
import { boltDamage, breathGain, conditionJournal, conditionLabel, CULT, failTribulation, foundationWound, heartDemons, insight, insightNeeded, passTribulation, shift, tendBreath, toxicity, tribulationBlock } from "../engine/cultivation";
import { DAOS, dominantDao } from "../engine/dao";
import { dirFrom, syncTerrain, World, type Actor } from "./world";
import { WorldMap } from "./worldmap";
import { caveArrival, repOf, SECT_IDS, SECTS, sectJournal, sectObjective, signScript, standing, type JournalEntry, type SectId } from "../story/sects";

export type Mode = "explore" | "scene" | "battle" | "worldmap" | "shop" | "meditate" | "tribulation";

export interface UiSnapshot {
  mode: Mode;
  state: GameState;
  stats: Stats;
  realm: string;
  realmColour: string;
  cultivationNeeded: number;
  bottleneck: boolean;
  /** At the bottleneck, why heaven will not yet test her (null when she may face it). */
  blocked: string | null;
  area: { id: AreaId; name: string; hanzi: string; subtitle: string };
  prompt: string | null;
  flying: boolean;
  /** Riding Cloudmane, her spirit horse. */
  riding: boolean;
  quest: Quest;
  /** A side errand someone in the jianghu has asked of her, if any. */
  errand: string | null;
  /** The most pressing of the sects' troubles she has taken on. */
  sectQuest: string | null;
  /** Every quest she knows of (the journal, J), and how the sects regard her. */
  journal: { main: Quest; errands: string[]; sects: JournalEntry[]; standing: { id: SectId; name: string; hanzi: string; rep: number; label: string }[] } | null;
  /** The outfit she has on, and how many she owns. */
  attire: { id: string; name: string; owned: number };
  dialog: { speaker: string; portrait: HumanId | null; outfit?: string; text: string; seq: number } | null;
  /** A question put to the heroine, waiting for her answer. */
  choice: { prompt: string | null; options: { label: string; hint?: string }[]; selected: number; seq: number } | null;
  narration: { text: string; index: number; total: number } | null;
  battle: { enemy: EnemyId; enemyName: string; enemyHp: number; enemyMax: number; heroHp: number; heroQi: number; busy: boolean; log: string[]; boss: boolean; skills: SkillId[] } | null;
  worldmap: { at: AreaId; travelling: boolean; heading: AreaId; nodes: { id: AreaId; name: string; hanzi: string; subtitle: string; locked: string | null }[] } | null;
  tribulation: string | null;
  banner: { title: string; hanzi: string; subtitle: string; seq: number } | null;
  /** The building she is inside, if any. */
  interior: { id: RoomId; name: string; hanzi: string; cave: boolean } | null;
  /** The second thread of the tale: the Turning of the Year (null before it starts and after it ends). */
  year: Quest | null;
  /** The third thread: the War of the Iron Banner, a thousand quests long (null before it reaches her). */
  war: Quest | null;
  warDone: number;
  warCount: number;
  /** The fronts of the war as they stand (in the journal). */
  warFronts: { front: string; hanzi: string; state: "waiting" | "burning" | "freed"; scar: string | null }[] | null;
  /** The fourth thread: the Founder's Road, a thousand quests long (null before it reaches her). */
  road: Quest | null;
  roadDone: number;
  roadCount: number;
  /** The founder's ten steles as they stand (in the journal). */
  roadSteles: { stele: string; hanzi: string; dao: string; colour: string; state: "waiting" | "hollowed" | "restored" | "devoured" }[] | null;
  /** The fifth thread: the Ten Halls, a thousand quests long (null before the Selection reaches her). */
  halls: Quest | null;
  hallsDone: number;
  hallsCount: number;
  /** The ten halls of the Sect of Ten Thousand Daos as they stand for her (in the journal). */
  hallsList: { hall: string; hanzi: string; dao: string; colour: string; state: "waiting" | "studying" | "done" }[] | null;
  /** The sixth thread: the City of Nine Tiers, a thousand quests long (null before the Census reaches her). */
  tiers: Quest | null;
  tiersDone: number;
  tiersCount: number;
  /** The tiers of the city as they stand for her (in the journal). */
  tiersList: { tier: string; hanzi: string; state: "sealed" | "open" | "climbing" | "done"; fate: string | null }[] | null;
  /** The seventh thread: the Hundred Peoples, twelve hundred quests long, main and side (null before the envoy finds her). */
  peoples: (Quest & { arc: "main" | "side" }) | null;
  peoplesDone: number;
  peoplesCount: number;
  /** The peoples as they stand for her (in the journal). */
  peoplesList: ReturnType<typeof peoplesChronicle> | null;
  /** What her realm makes her in the eyes of the jianghu: for the HUD, and the journal's standing. */
  standing: { label: string; journal: ReturnType<typeof standingJournal> | null };
  /** The Great Daos she comprehends: the deepest one for the HUD, every one in the journal, and whether her Dao Domain has opened. */
  wu: { label: string | null; colour: string | null; total: number; domain: boolean; paths: ReturnType<typeof wuJournal> | null };
  /** The Dao she walks: its name and depth (null while none leads), and every Dao's weight in her heart (in the journal). */
  dao: { label: string | null; colour: string | null; creed: string | null; paths: { id: string; name: string; hanzi: string; colour: string; points: number; creed: string; gift: string }[] | null };
  /** Her cultivation's condition: one line for the HUD (null while she is whole), and the full picture in the journal. */
  condition: { label: string | null; journal: ReturnType<typeof conditionJournal> | null };
  /** The notices (favours) she carries, and how many of the thousand she has fulfilled. */
  notices: { slot: number; title: string; giver: string; text: string }[];
  noticesDone: number;
  noticeCount: number;
  /** The wardrobe, when it is open: every outfit, owned or not. */
  wardrobe: { id: string; name: string; hanzi: string; from: string; owned: boolean; worn: boolean; hint: string }[] | null;
  /** The jianghu's calendar: season, day and hour. */
  calendar: { season: Season; seasonName: string; hanzi: string; colour: string; day: number; hour: number; phase: string; label: string };
  toasts: { id: number; text: string }[];
  canSkip: boolean;
  /** Who is selling, while the pill shop is open. */
  shopKeeper: string | null;
  /** The game menu (Esc / Tab) is open. */
  menu: boolean;
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
const IDLE_FIDGETS = new Set<AnimId>(["rummage", "shade", "stretch", "look", "gather", "nod", "point", "cheer", "drink", "read", "pray", "clap", "laugh", "rear", "flute", "salute", "twirl", "taichi", "kick", "sworddance", "flame", "roar", "rally", "grieve", "bow", "banner", "horn", "comprehend", "domain", "acrobat", "firecracker", "liondance"]);
/** Seated or absorbed idles that a speaker keeps while talking instead of standing up. */
const SEATED = new Set<AnimId>(["fish", "sit", "tell", "weave", "pray", "bandage", "grieve", "xiangqi", "puppet", "abacus", "row", "comprehend"]);
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
  /** Waiting for the player to answer a question. */
  waitChoice?: boolean;
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
  private choice: UiSnapshot["choice"] = null;
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
  /** The 3D view, while one draws the world (null: the isometric pixel view). */
  view3d: View3D | null = null;
  private medTick = 0;
  /** Seconds she has sat in this session (each breath brings less), and the shrine she sits at. */
  private medSitting = 0;
  private medShrine: string | null = null;
  private trib: { start: number; bolts: number; struck: number; final: boolean; done: boolean; failed: boolean; damage: number } | null = null;
  private tribText: string | null = null;
  private boltFx: { at: number }[] = [];
  private returnMode: Mode = "explore";
  /** The room she is standing in, and the open world waiting outside it. */
  private interior: { def: InteriorDef; outdoor: World } | null = null;
  /** Whoever last spoke in a scene: a shop that opens belongs to them. */
  private lastSpeaker: string | null = null;

  constructor(state: GameState, opts: { intro?: boolean; seed?: number } = {}) {
    this.state = state;
    this.seed = opts.seed ?? Date.now();
    // the land as this save left it, before looking for open ground to stand on
    syncTerrain(getWorld(), state.flags);
    this.world = this.makeWorld(Game.openGround([state.x, state.y], state.area), state.dir);
    this.state = { ...this.state, x: this.world.hero.x, y: this.world.hero.y, area: this.world.regionAt(this.world.hero.x, this.world.hero.y) };
    this.syncClock();
    this.showBanner();
    if (opts.intro) {
      this.fade = 1;
      this.play(introScript(this.state));
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
    if (this.view3d) {
      this.tapTarget = this.view3d.pick(sx, sy);
      return;
    }
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

  /** Change into the next outfit in her wardrobe (with a twirl, if she has room for one). */
  changeAttire(): void {
    if (this.mode !== "explore") return;
    if (ownedAttire(this.state).length < 2) return this.toast("You have only your Jade Lotus Robes. Help the folk of the jianghu, and some may have clothes to spare.");
    this.state = nextAttire(this.state);
    const h = this.world.hero;
    this.dressHero();
    if (!h.flying && h.char === "heroine") {
      if (h.idleAnim === "sit") h.idleAnim = "idle";
      this.world.setAnim(h, "twirl", this.clock, true);
    }
    this.world.fx.burst(isoX(h.x, h.y), isoY(h.x, h.y, h.z) - 12, 22, ["#ffffff", "#f8bcd6", "#f2c55c"], 50);
    this.idleTime = 0;
    const a = currentAttire(this.state);
    this.toast(`Attire: ${a.name} · ${a.hanzi} (${a.from})`);
  }

  /** Keep her sprite in the outfit the save says she is wearing. */
  private dressHero(): void {
    const id = currentAttire(this.state).id;
    this.world.hero.outfit = id;
    if (this.interior) this.interior.outdoor.hero.outfit = id;
  }

  takePill(kind: "heal" | "qi"): void {
    if (this.mode !== "explore" && this.mode !== "meditate") return;
    if (this.state.pills[kind] > 0 && !pillUseful(this.state, kind)) return this.toast(kind === "heal" ? "Your vitality is already full — the pill would be wasted." : "Your dantian is already brimming with qi.");
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
    if (!next) return this.toast(this.state.pills[kind] >= 99 ? "Your pill gourd is full (99)." : "Not enough spirit stones.");
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
    if (this.mode !== "scene" || !r || !r.waitInput || r.waitChoice) return;
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

  /** Answer the question on screen with option `k` (its steps run next). */
  choose(k: number): void {
    const r = this.runner;
    const step = r?.steps[r.i];
    if (this.mode !== "scene" || !r || !r.waitChoice || !step || !("choose" in step)) return;
    const opt = step.choose[k];
    if (!opt) return;
    r.steps = [...r.steps.slice(0, r.i + 1), ...opt.then, ...r.steps.slice(r.i + 1)];
    r.waitChoice = false;
    this.choice = null;
    r.i++;
    this.markDirty();
    this.runSteps(0);
  }

  /** Move the highlight between the answers (arrow keys). */
  private nudgeChoice(by: number): void {
    const c = this.choice;
    if (!c) return;
    c.selected = (c.selected + by + c.options.length) % c.options.length;
    c.seq = ++this.seq;
    this.markDirty();
  }

  /** Fast-forward the current cutscene, applying its effects but skipping talk and waits. */
  skipScene(): void {
    let guard = 0;
    while (this.mode === "scene" && this.runner && guard++ < 500) {
      const r = this.runner;
      const step = r.steps[r.i];
      // a battle, or a question only the player can answer, stops the skip
      if (step && ("battle" in step || "choose" in step)) break;
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
    this.worldMap.outfit = currentAttire(this.state).id;
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
    this.choice = null;
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
  debugEnter(id: RoomId): void {
    this.runner = null;
    this.queue = [];
    this.choice = null;
    this.dialog = null;
    this.mode = "explore";
    this.dropInterior();
    this.enterInterior(id);
    this.fade = 0;
  }

  get inside(): RoomId | null {
    return this.interior?.def.key ?? null;
  }

  debugBattle(enemy: EnemyId, key = `debug-${enemy}`): void {
    this.runner = null;
    this.startBattle(enemy, key);
  }

  /** Set the hour (0 noon, 0.5 midnight, as a fraction of the day) and, optionally, the season. */
  debugSetTime(k: number, season?: Season): void {
    this.state = atTimeOfDay(this.state, k, season);
    this.syncClock();
    this.markDirty();
  }

  /** Skip ahead to the next summer shower at its heaviest (screenshots). */
  debugShower(): void {
    const t0 = worldTime(this.state);
    for (let t = t0; t < t0 + YEAR_LENGTH * 40; t += 30)
      if (rainingAt(t) > 0.95) {
        this.state = { ...this.state, counters: { ...this.state.counters, [TIME_SKIP]: (this.state.counters[TIME_SKIP] ?? 0) + Math.ceil(t - t0) } };
        this.syncClock();
        return;
      }
  }

  /** Keep every world on the save's calendar (and tell the HUD when the hour turns). */
  private syncClock(): void {
    const t = worldTime(this.state);
    this.world.time = t;
    if (this.interior) this.interior.outdoor.time = t;
    const c = calendarAt(t);
    const stamp = `${c.season}/${c.dayOfSeason}/${Math.floor(c.hour)}`;
    if (stamp !== this.calendarStamp) {
      const turned = this.calendarStamp && this.calendarStamp.split("/")[0] !== c.season;
      this.calendarStamp = stamp;
      if (turned) this.seasonTurned(c.season);
      this.markDirty();
    }
  }
  private calendarStamp = "";

  /** The year turns: a banner, and a gust of the new season's petals, rain, leaves or snow about her. */
  private seasonTurned(season: Season): void {
    const info = SEASON_INFO[season];
    this.banner = { title: info.name, hanzi: info.hanzi, subtitle: { spring: "The plum and cherry wake", summer: "Long days, warm rain", autumn: "The leaves turn to gold", winter: "Snow on the jianghu" }[season], seq: ++this.seq };
    this.bannerUntil = this.clock + 3.5;
    const h = this.world.hero;
    const cols = { spring: ["#ffd0e4", "#f8a8c8", "#ffffff"], summer: ["#9ae870", "#ffffff", "#ffe070"], autumn: ["#f08a3a", "#ffd070", "#c04a2a"], winter: ["#ffffff", "#e8f4ff", "#c8e0ff"] }[season];
    this.world.fx.burst(isoX(h.x, h.y), isoY(h.x, h.y, h.z) - 16, 40, cols, 80);
  }

  debugSkipTime(seconds: number, dt = 1 / 30): void {
    for (let t = 0; t < seconds; t += dt) this.update(dt);
  }

  // ------------------------------------------------------------------ internals
  private makeWorld([x, y]: [number, number], dir: number): World {
    const w = new World(getWorld(), { x, y, dir }, this.state.flags, this.state.taken);
    w.sealed = (id) => !areaUnlocked(id, this.state);
    // the tiers of the City of Nine Tiers bar anyone below their realm, on foot or on a sword
    const bars = getWorld().bars;
    const inside = (r: [number, number, number, number], x: number, y: number) => x >= r[0] && x < r[2] && y >= r[1] && y < r[3];
    w.barred = (x, y, fx, fy) => {
      for (const b of bars) if (!this.state.flags[b.flag] && inside(b.rect, x, y) && !inside(b.rect, fx, fy)) return b.why;
      return null;
    };
    w.updateCamera(480, 270, 0);
    // the real view may be any size: snap to it on the first frame rather than sliding across
    w.recenter();
    return w;
  }

  /** Step through a door into one of the jianghu's buildings. */
  private enterInterior(id: RoomId): void {
    if (this.interior) return;
    const outdoor = this.world;
    if (outdoor.hero.flying) return this.toast("Step down from your sword first.");
    // Cloudmane waits in the clouds while she is indoors
    this.dismount();
    const base = getRoom(id);
    // the room belongs to the region its door stands in
    const def: InteriorDef = { ...base, id: this.state.area };
    outdoor.placeHero(def.outside[0], def.outside[1], dirFrom(-def.inward[0], -def.inward[1]));
    outdoor.setAnim(outdoor.hero, "idle", this.clock);
    const w = new World(def, { x: def.arrive[0], y: def.arrive[1], dir: dirFrom(def.inward[0], def.inward[1]) }, this.state.flags, this.state.taken);
    // underground she lights a torch and holds it up while she stands
    if (w.cave) w.hero.idleAnim = "torch";
    w.time = worldTime(this.state);
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
    const first = caveArrival(id, this.state);
    if (first) this.play(first);
    this.markDirty();
  }

  /**
   * Up or down the stair of a building of several storeys: the floor above is
   * a room of its own over the same footprint, and some houses only let a
   * cultivator of standing up (her realm, not her purse, decides).
   */
  private changeFloor(id: RoomId): void {
    const it = this.interior;
    if (!it) return;
    const base = getRoom(id);
    if ((base.minRealm ?? 0) > this.state.realm) {
      this.play(floorRefusal(id, this.state));
      return;
    }
    const def: InteriorDef = { ...base, id: this.state.area };
    const [si, sj] = def.stair ?? def.exit;
    const w = new World(def, { x: si + 0.5 + def.inward[0] * -0.2, y: sj + 1.5, dir: 2 }, this.state.flags, this.state.taken);
    w.time = worldTime(this.state);
    w.updateCamera(480, 270, 0);
    w.recenter();
    this.world = w;
    this.interior = { def, outdoor: it.outdoor };
    this.tapTarget = null;
    this.idleTime = 0;
    this.fade = 1;
    this.fadeTarget = 0;
    this.banner = { title: def.name, hanzi: def.hanzi, subtitle: def.subtitle, seq: ++this.seq };
    this.bannerUntil = this.clock + 3;
    if (def.below) this.play([{ anim: "hero", name: "climb", wait: true }]);
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
      if (d.to === "out") {
        if (it?.def.below) this.changeFloor(it.def.below);
        else this.exitInterior();
      } else if (isRoomId(d.to) && roomOpen(d.to, this.state.flags)) this.enterInterior(d.to);
      return this.world !== w;
    }
    return false;
  }

  private static doorCache: { i: number; j: number; dir: number[]; to: string }[] | null = null;
  private static doors() {
    return (Game.doorCache ??= getWorld()
      .interacts.filter((it) => it.kind === "door" && isRoomId(it.to))
      .map((it) => ({ i: it.i, j: it.j, dir: getRoom(it.to as RoomId).inward, to: it.to! })));
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
    this.lookOutAt = this.clock;
    this.banner = { title: near.name, hanzi: near.hanzi, subtitle: getArea(this.state.area).name, seq: ++this.seq };
    this.bannerUntil = this.clock + 3;
    this.markDirty();
  }

  /** When a landmark last came into view: the next time she stands still she shades her eyes to look at it. */
  private lookOutAt = -99;

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
    this.journalOpen = false;
    this.wardrobeOpen = false;
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
    this.markerAt = 0;
    this.dialog = null;
    this.choice = null;
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
      if (r.waitInput || r.waitChoice) return;
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
        r.waitInput = true;
        // the nearest NPC of that character speaks (two villagers may share a look)
        const h = this.world.hero;
        const actor =
          step.say === "heroine"
            ? h
            : this.world.actors.filter((a) => a.char === step.say && a.kind === "npc").sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0];
        // the portrait wears what the speaker is wearing
        const outfit = step.say === "heroine" ? currentAttire(this.state).id : actor?.outfit;
        this.dialog = { speaker, portrait, ...(outfit && { outfit }), text: step.text, seq: ++this.seq };
        if (step.say !== "heroine" && speaker) this.lastSpeaker = speaker;
        if (actor && actor.kind === "npc" && !SEATED.has(actor.idleAnim) && charDef(actor.char).anims.includes("talk") && !actor.holdUntil) {
          this.world.setAnim(actor, "talk", this.clock);
          const back = actor;
          setTimeoutish(this, 2.2, () => back.anim === "talk" && this.world.setAnim(back, back.idleAnim, this.clock));
        }
        return;
      }
      if ("choose" in step) {
        r.waitChoice = true;
        this.dialog = null;
        this.choice = { prompt: step.prompt ?? null, options: step.choose.map(({ label, hint }) => ({ label, ...(hint && { hint }) })), selected: 0, seq: ++this.seq };
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
      if ("tribulation" in step) {
        r.i = r.steps.length;
        this.endRunner();
        this.beginMeditation(this.medShrine);
        this.callLightning();
        return;
      }
      if ("end" in step) {
        r.i = r.steps.length;
        // the fight it skips would have taken the scene's invulnerability off again
        this.invulnerableUntil = this.clock + 2.2;
        continue;
      }
      if ("reshape" in step) {
        this.world.syncPopulation(this.state.flags);
        r.i++;
        continue;
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
    this.battle = new BattleScene(this.state.area, enemy, key, this.state, (this.seed + Math.floor(this.clock * 1000)) >>> 0, this.interior?.def.sky === "cave");
    this.battle.hero.outfit = currentAttire(this.state).id;
    // the arena wears the season outside
    this.battle.world.time = worldTime(this.state);
    this.mode = "battle";
    this.menuOpen = false;
    this.tally(`seen:${enemy}`);
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
      this.tally(`slain:${b.enemy}`);
      if (b.levelUp) this.toast(`Your cultivation rises: ${b.levelUp}!`);
      if (atBottleneck(this.state)) this.toast("Your qi has reached its peak! Meditate at a shrine and press B to face the tribulation.");
      this.play(victoryScript(b.enemy, b.enemyKey, this.state.area, this.state));
      this.noticeHunt(b.enemy);
      this.warHunt(b.enemy);
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
      // she wakes at the sect: forget where she was walking to, and let the sect's folk be who they should be
      this.tapTarget = null;
      this.world.syncPopulation(this.state.flags);
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
  private beginMeditation(shrine: string | null = null): void {
    const h = this.world.hero;
    this.land();
    this.dismount();
    this.mode = "meditate";
    this.world.setAnim(h, "meditate", this.clock);
    h.idleAnim = "meditate";
    this.medTick = 0;
    this.medSitting = 0;
    this.medShrine = shrine;
    const block = tribulationBlock(this.state);
    this.toast(atBottleneck(this.state) ? (block ? block : "Your qi is full. Press B to call down the Heavenly Tribulation.") : "You sit in lotus position and draw in the qi of heaven and earth…");
    // the first sitting at a shrine in each realm shows her something new
    const seen = shrine && `ins:shrine:${shrine}:${this.state.realm}`;
    if (seen && this.state.realm >= 1 && !this.state.flags[seen] && !this.interior) {
      this.state = shift({ ...this.state, flags: { ...this.state.flags, [seen]: true } }, CULT.insight, 1);
      this.toast(`A new shrine, a new view of the Dao · Insight ${insight(this.state)}${atBottleneck(this.state) ? `/${insightNeeded(this.state.realm)}` : ""}`);
    }
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
    const gain = breathGain(this.state, this.interior ? "village" : this.state.area, this.medSitting);
    this.medSitting++;
    this.noticeBreath();
    // the breath tends her body first: poison burns off, cracks knit, demons quieten (or, too poisoned, her qi runs wild)
    const tended = tendBreath(this.state, s);
    this.state = tended.state;
    if (tended.deviation) {
      this.shake = 0.6;
      this.flash = 0.6;
      this.flashColor = "#5a1030";
      this.world.setAnim(h, "hurt", this.clock, true);
      this.world.fx.burst(hx, hy, 26, ["#5a1030", "#9a2a4a", "#2a2030"], 60);
      this.world.fx.float("QI DEVIATION", hx, hy - 26, "#ff6a8a");
      this.toast("Qi deviation! The pill poison sets your qi running wild through your meridians · Heart demons stir");
      this.reactNearby("!", null);
      this.markDirty();
      return;
    }
    const was = atBottleneck(this.state);
    const r = gainCultivation(heal(this.state, s.maxHp * 0.08, s.maxQi * 0.08), gain);
    this.state = r.state;
    if (!was && this.state.realm < FINAL_REALM) this.world.fx.float(`+${gain}`, hx, hy - 20, "#9ff5de");
    if (r.stagesGained) {
      this.world.fx.burst(hx, hy, 30, ["#9ff5de", "#ffffff", "#f2c55c"], 70);
      this.toast(`Your cultivation deepens: ${realmLabel(this.state.realm, this.state.stage)}.`);
      this.reactNearby("heart", "clap");
    }
    if (!was && atBottleneck(this.state)) this.toast(tribulationBlock(this.state) ?? "Your qi has reached its peak! Press B to face the Heavenly Tribulation.");
    // sitting long at the bottleneck, she begins to understand it
    if (was && insight(this.state) < insightNeeded(this.state.realm) && this.medSitting % 45 === 0) {
      this.state = shift(this.state, CULT.insight, 1);
      this.world.fx.burst(hx, hy - 20, 20, ["#f2c55c", "#ffffff"], 40);
      this.toast(`A flash of insight · 顿悟 · Insight ${insight(this.state)}/${insightNeeded(this.state.realm)}`);
    }
    // sitting long where a Great Dao runs strong, she comes a little nearer it
    this.sitWithDao(hx, hy);
    if (this.woundWas > 0 && foundationWound(this.state) === 0) this.toast("Your foundation has mended. Heaven may test you again.");
    this.woundWas = foundationWound(this.state);
    this.markDirty();
  }
  private woundWas = 0;
  private toxClock = 0;

  /** Every so many breaths at an outdoor shrine, a step nearer the Great Dao that runs strong in that land (as far as her realm can hold). */
  private sitWithDao(hx: number, hy: number): void {
    const dao = SHRINE_DAO[this.state.area];
    if (!dao || this.interior || !this.medShrine || this.medSitting % BREATHS_PER_WU !== 0) return;
    const r = comprehend(this.state, dao, 1);
    const opened = !domainOpen(this.state) && domainOpen(r.state);
    this.state = r.state;
    const G = GREAT_DAOS[dao];
    if (r.capped) return;
    this.world.fx.burst(hx, hy - 20, 16, [G.colour, "#ffffff"], 40);
    if (r.tierUp) {
      this.world.setAnim(this.world.hero, "comprehend", this.clock, true);
      this.world.hero.idleAnim = "comprehend";
      this.toast(`感悟 · You comprehend the ${G.name}: ${WU_TIERS[r.tierUp - 1].hanzi} ${WU_TIERS[r.tierUp - 1].name}`);
      this.reactNearby("!", "bow");
    } else this.toast(`The ${G.name} stirs in you (${G.hanzi})`);
    if (opened) {
      this.world.setAnim(this.world.hero, "domain", this.clock, true);
      this.flash = 0.5;
      this.flashColor = G.colour;
      this.toast("道域 · Your Dao Domain unfolds: foes who step into it will stagger");
    }
  }

  /** Folk standing nearby react to what heaven does to her: a cheer, a bow, a gasp. */
  private reactNearby(icon: "!" | "heart" | "...", anim: AnimId | null): void {
    const h = this.world.hero;
    for (const a of this.world.actors) {
      if (a.kind !== "npc" || Math.hypot(a.x - h.x, a.y - h.y) > 14) continue;
      a.emote = { icon, until: this.clock + 2 };
      a.dir = dirFrom(h.x - a.x, h.y - a.y);
      const anims = charDef(a.char).anims;
      const pick = anim && anims.includes(anim) ? anim : anims.includes("bow") && icon === "heart" ? "bow" : null;
      if (pick && !a.holdUntil) this.world.setAnim(a, pick, this.clock, true);
    }
  }

  startTribulation(): void {
    if (this.mode !== "meditate" && this.mode !== "explore") return;
    if (!atBottleneck(this.state)) return this.toast("Your qi has not yet reached its peak.");
    const final = this.state.realm === FINAL_REALM - 1;
    // checked before she sits down, so a refusal doesn't leave her meditating
    if (final && (this.state.area !== "peak" || this.interior)) return this.toast("The final tribulation can only be faced on Heavenly Tribulation Peak.");
    const block = tribulationBlock(this.state);
    if (block) return this.toast(block);
    if (this.mode === "explore") {
      const near = this.world.nearestInteraction();
      if (!near?.it || (near.it.kind !== "shrine" && near.it.kind !== "altar")) return this.toast("Face the tribulation while meditating at a shrine.");
      this.beginMeditation(near.it.key);
    }
    // from Foundation Establishment on, her own heart tests her before heaven does
    if (trialDue(this.state)) {
      const h = this.world.hero;
      this.play(heartDemonTrial(this.state, [h.x, h.y]));
      return;
    }
    this.callLightning();
  }

  /** Heaven's lightning gathers: three bolts, or nine at the last. */
  private callLightning(): void {
    const final = this.state.realm === FINAL_REALM - 1;
    this.mode = "tribulation";
    this.trib = { start: this.clock, bolts: final ? 9 : 3, struck: 0, final, done: false, failed: false, damage: boltDamage(this.state, stats(this.state), final) };
    this.tribText = final ? "The heavens split open. Nine bolts gather above the peak…" : heartDemons(this.state) >= 30 || toxicity(this.state) >= 30 ? "Heaven's lightning gathers — and it can smell the poison and the demons in you…" : "Heaven's lightning gathers above you…";
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
    while (!tr.failed && tr.struck < Math.min(tr.bolts, due)) {
      tr.struck++;
      // every bolt strikes her body; if it falls before heaven is done, the tribulation fails
      this.state = { ...this.state, hp: Math.max(0, this.state.hp - tr.damage) };
      this.boltFx.push({ at: this.clock });
      this.shake = 0.9;
      this.flash = 0.9;
      this.flashColor = "#e8e0ff";
      this.world.setAnim(h, "hurt", this.clock, true);
      this.world.fx.burst(hx, hy - 14, 30, ["#ffffff", "#b8a4ff", "#9ff5de"], 90);
      this.world.fx.float(`BOLT ${tr.struck}/${tr.bolts}`, hx, hy - 44, "#e8dcff");
      this.world.fx.float(`-${tr.damage}`, hx + 14, hy - 30, "#ff8aa8");
      const lines = ["The bolt tempers your meridians!", "Your old limits shatter!", "Your dao heart does not waver!"];
      this.tribText = tr.final ? `Bolt ${tr.struck} of nine — ${lines[(tr.struck - 1) % 3]}` : lines[tr.struck - 1];
      if (this.state.hp <= 0) {
        tr.failed = true;
        tr.done = true;
        tr.start = this.clock - (1.4 + tr.bolts * gap + 0.6);
        this.state = failTribulation(this.state, stats(this.state));
        this.woundWas = foundationWound(this.state);
        this.flash = 1;
        this.flashColor = "#2a1030";
        this.world.setAnim(h, "defeat", this.clock);
        h.idleAnim = "idle";
        this.world.fx.burst(hx, hy - 10, 40, ["#3a2a4a", "#9a8aaa", "#ffffff"], 80);
        this.tribText = `The ${["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"][tr.struck - 1]} bolt throws you down — the tribulation fails!`;
        this.toast("Tribulation failed · Your qi scatters and your foundation cracks · Meditate to mend it, purge your poison and quiet your demons before you try again");
        this.reactNearby("!", null);
      }
      this.markDirty();
    }
    if (h.holdUntil === undefined && h.anim !== "meditate" && !tr.done) this.world.setAnim(h, "meditate", this.clock);
    const end = 1.4 + tr.bolts * gap + 0.6;
    if (!tr.done && el > end) {
      tr.done = true;
      const before = REALMS[this.state.realm].name;
      this.state = applyBreakthrough(passTribulation(this.state));
      this.reactNearby("heart", "cheer");
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
      if (tr.final && !tr.failed) this.play(endingScript(this.state));
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
      // under a turned 3D camera, "up" still walks up the screen
      if (this.view3d) [dx, dy] = turnToView([dx, dy], this.view3d.ground());
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
      // walking on starts her idle habits afresh: a glance and a stretch before she sits down again
      this.fidgets = 0;
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
    } else if (h.holdUntil === undefined && this.clock - this.lookOutAt < 6 && !h.flying && !riding) {
      this.lookOutAt = -99;
      w.setAnim(h, "shade", this.clock, true);
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
        const pool: AnimId[] = this.fidgets++ < 1 ? ["look", "stretch"] : ["stretch", "look", "nod", "point", "cheer", "clap", "laugh", "flute", "salute", "twirl", "taichi", "kick", "sworddance", ...(this.state.flags.phxDone ? (["flame"] as AnimId[]) : []), ...this.weatherFidgets(), ...this.daoFidgets()];
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
    if (w.bumpedBar) {
      const why = w.bumpedBar;
      w.bumpedBar = null;
      this.tapTarget = null;
      if (this.clock - this.sealToastAt > 3) {
        this.sealToastAt = this.clock;
        this.toast(stairBarToast(why, this.state));
      }
    }
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
      // the Founder's Road reaches her as her realm does, not only as its quests are done
      this.state = syncPeoplesFlags(syncTiersFlags(syncHallsFlags(syncRoadFlags(this.state))));
      w.syncPopulation(this.state.flags);
      this.landmarkEvents();
      if (this.mode !== "explore") return;
      const grown = warCultivated(this.state) ?? roadCultivated(this.state) ?? hallsCultivated(this.state) ?? tiersCultivated(this.state) ?? peoplesCultivated(this.state);
      if (grown) return this.play(grown);
    }
    const touched = w.update(dt, this.clock, h.flying === true || this.clock < this.invulnerableUntil, true);
    if (touched && touched.enemy) {
      this.tapTarget = null;
      const pre = preBattleScript(touched.enemy, touched.key, this.state);
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
    if (near?.npc) text = `E · Talk to ${near.npc.name ?? charDef(near.npc.char).name}`;
    else if (near?.it) {
      const it = near.it;
      text = {
        shrine: atBottleneck(this.state) ? "E · Meditate   B · Face the Tribulation" : "E · Meditate at the lotus shrine",
        exit: "E · Open the world map",
        chest: "E · Open the chest",
        herb: "E · Gather the spirit herb",
        sign: "E · Read",
        altar: "E · Step onto the taiji dais",
        door: it.to === "out" ? (this.interior?.def.below ? "E · Go back downstairs" : "E · Step outside") : this.interior ? "E · Climb the stair to the floor above" : `E · Enter ${doorName(it.to)}`,
      }[it.kind];
    }
    if (text !== this.prompt) {
      this.prompt = text;
      this.markDirty();
    }
  }

  /**
   * A conversation: parcels she carries for this person are handed over
   * first, then a Warden's offering if it is theirs to give, then what they
   * have to say; folk with nothing pressing to say ask a favour instead.
   */
  private talkTo(key: string): Step[] {
    const g = this.state;
    // first, what they make of the Dao she walks (once for each depth of it)
    // then, once each, what they make of her realm, her condition, or the bottleneck she is stuck at
    const npc = this.world.actor(key);
    // the folk she has spoken with fill the menu's book of people
    if (npc && charDef(npc.char).portrait) this.tally(`met:${npc.char}`);
    const seen = daoAside(key, g) ?? realmAside(key, g) ?? conditionAside(key, g) ?? pointerAside(key, g) ?? (npc && charDef(npc.char).portrait ? aweAside(key, npc.char as HumanId, g, npc.name) : null);
    return [...(seen ?? []), ...this.conversation(key, g)];
  }

  /** What someone says: parcels, offerings, the war's business, the tale, and favours to ask. */
  private conversation(key: string, g: GameState): Step[] {
    const cal = calendarAt(worldTime(g));
    const pre: Step[] = [];
    for (const c of carried(g)) if (c.bounty.kind === "deliver" && c.bounty.to === key) pre.push(...deliveryScript(c));
    const offering = offeringScript(key, g, cal);
    if (offering) pre.push(...offering);
    const news = hasNews(key, g);
    const war = warTalk(key, g) ?? roadTalk(key, g) ?? hallsTalk(key, g) ?? tiersTalk(key, g) ?? peoplesTalk(key, g);
    if (war) return news ? [...pre, ...npcScript(key, g), ...war] : [...pre, ...war];
    if (pre.length && !news) return pre;
    const story = npcScript(key, g);
    if (news || pre.length) return [...pre, ...story];
    const b = offerFrom(key, g, (id) => areaUnlocked(id, g));
    return b ? [...story, ...offerScript(b, slotsFree(g) === 0)] : story;
  }

  /** The habits her Dao gives her: sword forms, prayers, taiji, a wolfish roar; and on a burning front, the war's own. */
  private daoFidgets(): AnimId[] {
    const d = dominantDao(this.state);
    const own: AnimId[] = d ? { sword: ["sworddance", "sworddance"], mercy: ["pray", "bow"], balance: ["taichi", "taichi"], slaughter: ["roar", "kick"] }[d] as AnimId[] : [];
    const q = currentWar(this.state);
    const road = currentRoad(this.state);
    const deep: AnimId[] = wuTotal(this.state) >= 4 ? ["comprehend"] : [];
    return q && this.state.flags[`war:${q.front}`] && this.state.area === q.front ? [...own, ...deep, "rally", "grieve"] : road && this.state.flags[`hollowed:${road.dao}`] ? [...own, ...deep, "look"] : [...own, ...deep];
  }

  /** What the hour and the season move her to do when she stands about outdoors: shiver in the snow, fly a kite in spring, gaze at the stars. */
  private weatherFidgets(): AnimId[] {
    if (this.interior) return [];
    const c = calendarAt(worldTime(this.state));
    const climate = CLIMATE[this.state.area];
    const out: AnimId[] = [];
    if (climate === "frozen" || (climate === "temperate" && c.season === "winter")) out.push("shiver", "warmhands", "snowball");
    else if (climate === "temperate" && c.season === "spring") out.push("kite");
    else if (climate === "temperate" && c.season === "autumn") out.push("rake");
    if (c.dusk > 0.55) out.push("stargaze", "yawn");
    return out;
  }

  /** Give up a notice she carries (from the journal). */
  abandonNotice(slot: number): void {
    const c = carried(this.state).find((x) => x.slot === slot);
    if (!c) return;
    this.state = abandon(this.state, slot);
    this.markerAt = 0;
    this.toast(`Notice set aside: ${c.bounty.title}. ${folk(c.bounty.giver)?.name ?? "They"} will ask again.`);
  }

  /** A notice is done: pay out, and tell her (with a milestone outfit, now and then). */
  private fulfilNotice(c: Carried, steps: Step[] = []): void {
    const before = ownedAttire(this.state).length;
    const next = fulfil(this.state, c);
    const gained = ownedAttire(next).length > before;
    this.play([
      ...steps,
      { mutate: (s) => fulfil(s, c) },
      { toast: `Notice fulfilled: ${c.bounty.title} · ${rewardText(c.bounty)} · ${bountiesDone(next)}/${BOUNTY_COUNT}` },
      ...(gained ? [{ anim: "hero", name: "twirl", wait: true } as Step, { toast: `A gift from the jianghu: the ${currentAttire(next).name} · Press C or open the wardrobe` } as Step] : []),
    ]);
    this.markerAt = 0;
  }

  /** A beast beaten where a notice wanted it beaten. */
  private noticeHunt(enemy: EnemyId): void {
    for (const c of carried(this.state)) {
      const b = c.bounty;
      if (b.kind !== "hunt" || b.foe !== enemy || b.region !== this.state.area) continue;
      this.state = advance(this.state, c.slot);
      const p = c.progress + 1;
      if (p >= b.count) this.fulfilNotice({ ...c, progress: p });
      else this.toast(`${b.title}: ${p}/${b.count}`);
      return;
    }
  }

  /** At a landmark: notices that wanted her there (at night, on horseback, on the sword, in a season), and the Wardens of the year. */
  private landmarkEvents(): void {
    if (this.interior || this.mode !== "explore" || this.runner) return;
    const h = this.world.hero;
    const near = getWorld().landmarks.find((l) => Math.hypot(l.x + 0.5 - h.x, l.y + 0.5 - h.y) < 7 * WORLD_SCALE);
    if (!near) return;
    const cal = calendarAt(worldTime(this.state));
    const year = landmarkScript(near.key, this.state, cal, [h.x + 1.2, h.y + 0.4]);
    if (year) return this.play(year);
    const how = { night: cal.dusk > 0.55, riding: this.riding, flying: !!h.flying };
    const war = warLandmark(near.key, this.state, how) ?? roadLandmark(near.key, this.state, how) ?? hallsLandmark(near.key, this.state, how) ?? tiersLandmark(near.key, this.state, how) ?? peoplesLandmark(near.key, this.state, how);
    if (war) return this.play(war);
    for (const c of carried(this.state)) {
      const b = c.bounty;
      if (b.landmark !== near.key) continue;
      const ok = b.kind === "visit" || (b.kind === "night" && cal.dusk > 0.55) || (b.kind === "ride" && this.riding) || (b.kind === "fly" && !!h.flying) || (b.kind === "season" && cal.season === b.season);
      if (!ok) continue;
      const act: Step[] = b.kind === "fly" || !b.anim ? [] : [{ anim: "hero", name: b.anim, wait: true }];
      return this.fulfilNotice(c, [...act, { say: "narrator", text: b.done }]);
    }
  }

  /** A foe of the horde beaten where the war wanted it beaten. */
  private warHunt(enemy: EnemyId): void {
    for (const hunt of [() => warHunt(this.state, enemy, this.state.area), () => roadHunt(this.state, enemy), () => hallsHunt(this.state, enemy), () => tiersHunt(this.state, enemy), () => peoplesHunt(this.state, enemy)]) {
      const r = hunt();
      this.state = r.state;
      if (r.steps) return this.play(r.steps);
      if (r.note) return this.toast(r.note);
    }
  }

  /** Breaths held at a shrine count towards a notice that asked for stillness there. */
  private noticeBreath(): void {
    if (!this.interior) {
      const r = warBreath(this.state, this.state.area);
      this.state = r.state;
      if (r.steps) return this.play(r.steps);
      const road = roadBreath(this.state, this.state.area);
      this.state = road.state;
      if (road.steps) return this.play(road.steps);
      const halls = hallsBreath(this.state, this.state.area);
      this.state = halls.state;
      if (halls.steps) return this.play(halls.steps);
      const tiers = tiersBreath(this.state, this.state.area);
      this.state = tiers.state;
      if (tiers.steps) return this.play(tiers.steps);
      const peoples = peoplesBreath(this.state, this.state.area);
      this.state = peoples.state;
      if (peoples.steps) return this.play(peoples.steps);
    }
    for (const c of carried(this.state)) {
      const b = c.bounty;
      if (b.kind !== "meditate" || b.region !== this.state.area || this.interior) continue;
      this.state = advance(this.state, c.slot);
      if (c.progress + 1 >= b.count) this.fulfilNotice({ ...c, progress: c.progress + 1 });
      return;
    }
  }

  /** Bounty markers over heads (refreshed twice a second, or at once after a scene). */
  private markerAt = 0;
  private bountyMarkers = new Map<string, "bounty" | "deliver">();
  private refreshMarkers(): void {
    this.markerAt = this.clock + 0.5;
    const g = this.state;
    const m = new Map<string, "bounty" | "deliver">();
    for (const c of carried(g)) if (c.bounty.kind === "deliver" && c.bounty.to) m.set(c.bounty.to, "deliver");
    const open = (id: AreaId) => areaUnlocked(id, g);
    for (const a of this.world.actors) if (a.kind === "npc" && !m.has(a.key) && slotsFree(g) > 0 && offerFrom(a.key, g, open)) m.set(a.key, "bounty");
    this.bountyMarkers = m;
  }

  // ------------------------------------------------------------------ wardrobe
  private wardrobeOpen = false;

  /** Open or close the wardrobe (V, or the Attire button). */
  toggleWardrobe(): void {
    if (!this.wardrobeOpen && this.mode !== "explore") return;
    this.wardrobeOpen = !this.wardrobeOpen;
    this.journalOpen = false;
    this.menuOpen = false;
    this.markDirty();
  }

  /** Put on an outfit from the wardrobe (with a twirl). */
  wear(id: string): void {
    if (this.mode !== "explore" || !hasAttire(this.state, id)) return;
    if (currentAttire(this.state).id === id) return;
    this.state = wearAttire(this.state, id);
    this.dressHero();
    const h = this.world.hero;
    if (!h.flying && h.char === "heroine") {
      if (h.idleAnim === "sit") h.idleAnim = "idle";
      this.world.setAnim(h, "twirl", this.clock, true);
    }
    this.world.fx.burst(isoX(h.x, h.y), isoY(h.x, h.y, h.z) - 12, 22, ["#ffffff", "#f8bcd6", "#f2c55c"], 50);
    this.markDirty();
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
      this.play(this.talkTo(npc.key));
      return;
    }
    const it = near.it!;
    switch (it.kind) {
      case "shrine":
        h.dir = dirFrom(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
        this.beginMeditation(it.key);
        break;
      case "altar":
        this.play(altarScript(this.state));
        break;
      case "exit":
        this.openMap();
        break;
      case "sign": {
        h.dir = dirFrom(it.i + 0.5 - h.x, it.j + 0.5 - h.y);
        if (!h.flying) this.world.setAnim(h, it.anim ?? "read", this.clock, true);
        this.play(it.key === "almanac-dial" ? almanacScript() : (signScript(it.key, this.state, it.text) ?? [{ say: "narrator", text: it.text ?? "" }]));
        // an old stele, read with a cultivator's eyes, is a lesson (once in each realm)
        const lesson = `ins:stele:${it.key}:${this.state.realm}`;
        if (it.key.includes("stele") && this.state.realm >= 1 && !this.state.flags[lesson]) {
          this.state = shift({ ...this.state, flags: { ...this.state.flags, [lesson]: true } }, CULT.insight, 1);
          this.toast(`The old words open something in you · Insight ${insight(this.state)}${atBottleneck(this.state) ? `/${insightNeeded(this.state.realm)}` : ""}`);
        }
        break;
      }
      case "door":
        if (it.to === "out") {
          if (this.interior?.def.below) this.changeFloor(this.interior.def.below);
          else this.exitInterior();
        } else if (isRoomId(it.to)) {
          if (this.interior) this.changeFloor(it.to);
          else this.enterInterior(it.to);
        }
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
        if (this.choice) {
          const n = /^(?:Digit|Numpad)([1-9])$/.exec(code);
          if (n) this.choose(Number(n[1]) - 1);
          else if (code === "ArrowUp" || code === "KeyW") this.nudgeChoice(-1);
          else if (code === "ArrowDown" || code === "KeyS") this.nudgeChoice(1);
          else if (CONFIRM.has(code)) this.choose(this.choice.selected);
          return;
        }
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
        if (this.menuOpen) {
          if (code === "Escape" || code === "Tab") this.toggleMenu();
          return;
        }
        if (code === "Escape" && !this.journalOpen && !this.wardrobeOpen) return this.toggleMenu();
        if (code === "Tab") return this.toggleMenu();
        if (code === "KeyJ") return this.toggleJournal();
        if (code === "KeyV") return this.toggleWardrobe();
        if (this.journalOpen && (code === "Escape" || CONFIRM.has(code))) return this.toggleJournal();
        if (this.wardrobeOpen && (code === "Escape" || CONFIRM.has(code))) return this.toggleWardrobe();
        if (CONFIRM.has(code)) this.interact();
        else if (code === "KeyF") this.toggleFly();
        else if (code === "KeyR") this.toggleRide();
        else if (code === "KeyC") this.changeAttire();
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
    this.syncClock();
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
        // with the menu open the world goes on, but she stands still
        if (this.menuOpen) {
          this.world.update(dt, this.clock, true);
          break;
        }
        this.updateExplore(dt);
        // the body clears a little pill poison by itself as she goes about, slowly
        this.toxClock += dt;
        if (this.toxClock >= 20) {
          this.toxClock -= 20;
          if (toxicity(this.state) > 0) this.state = shift(this.state, CULT.tox, -1);
        }
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
    if (this.world.quakeAt > this.quakeSeen) {
      this.quakeSeen = this.world.quakeAt;
      this.shake = Math.max(this.shake, 0.7);
    }
    if (this.mode === "explore" && this.clock >= this.markerAt) this.refreshMarkers();
    const cal = calendarAt(worldTime(this.state));
    for (const a of this.world.actors) if (a.kind === "npc") a.marker = this.mode === "explore" && ((hasNews(a.key, this.state) || yearHasNews(a.key, this.state, cal) || warHasNews(a.key, this.state) || roadHasNews(a.key, this.state) || hallsHasNews(a.key, this.state) || tiersHasNews(a.key, this.state) || peoplesHasNews(a.key, this.state) || daoHasNews(a.key, this.state) || cultivationHasNews(a.key, this.state)) || (this.bountyMarkers.get(a.key) ?? false));
    if (this.world.hero.outfit !== currentAttire(this.state).id) this.dressHero();
    this.world.heroRealm = this.state.realm;
    this.world.heroDread = heartDemons(this.state) > 60;
    if (this.dirty) {
      this.dirty = false;
      const snap = this.snapshot();
      this.listeners.forEach((l) => l(snap));
    }
  }

  private quakeSeen = -99;
  /** The journal of quests and sect standing is open over the world. */
  private journalOpen = false;

  /** The game menu (Esc or Tab): her status, skills, bag, bestiary, the people and places she knows, and the settings. */
  private menuOpen = false;
  toggleMenu(): void {
    if (!this.menuOpen && this.mode !== "explore") return;
    this.menuOpen = !this.menuOpen;
    this.journalOpen = false;
    this.wardrobeOpen = false;
    this.tapTarget = null;
    // she goes through her satchel while the menu is up
    const h = this.world.hero;
    if (this.menuOpen && !h.flying && !this.riding) this.world.setAnim(h, "rummage", this.clock, true);
    this.markDirty();
  }

  /** Count something in the save (beasts seen and slain, people met). */
  private tally(key: string): void {
    this.state = { ...this.state, counters: { ...this.state.counters, [key]: (this.state.counters[key] ?? 0) + 1 } };
  }

  /** Open or close the journal (J). */
  toggleJournal(): void {
    if (!this.journalOpen && this.mode !== "explore" && this.mode !== "meditate") return;
    this.journalOpen = !this.journalOpen;
    this.wardrobeOpen = false;
    this.menuOpen = false;
    this.markDirty();
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

  /** True while the world itself (not a battle or the world map) fills the screen. */
  get showsWorld(): boolean {
    return this.mode !== "battle" && this.mode !== "worldmap";
  }

  /** What the camera looks at: a cutscene's focus, the middle of a room, or the heroine. */
  cameraTarget(): [number, number, number] {
    if (this.cameraFocus) return this.cameraFocus;
    const w = this.world;
    const m = w.def.map;
    if (w.interior) return [(w.hero.x + m.w / 2) / 2, (w.hero.y + m.h / 2) / 2, 1];
    return [w.hero.x, w.hero.y, w.hero.z];
  }

  /** Where a map point lands on the pixel canvas, in whichever view is drawing the world. */
  private screenOf(x: number, y: number, z: number): [number, number] {
    const w = this.world;
    return this.view3d?.project(x, y, z) ?? [isoX(x, y) + w.camX, isoY(x, y, z) + w.camY];
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
    if (this.view3d) w.renderOverlay3D(s, this.clock, this.view3d);
    else {
      w.updateCamera(s.width, s.height, 1 / 60, this.cameraFocus ?? undefined);
      w.render(s, this.clock);
    }
    if (this.mode === "meditate" || this.mode === "tribulation") {
      const h = w.hero;
      const [x, y] = this.screenOf(h.x, h.y, h.z);
      const r = (18 + Math.sin(this.clock * 2) * 2) * (this.view3d ? Math.max(0.6, this.view3d.tileScale() / 22.6) : 1);
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
    const [x, y] = this.screenOf(h.x, h.y, h.z).map(Math.round);
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

  private calendarSnapshot(): UiSnapshot["calendar"] {
    const c = calendarAt(worldTime(this.state));
    const info = SEASON_INFO[c.season];
    return { season: c.season, seasonName: info.name, hanzi: info.hanzi, colour: info.colour, day: c.dayOfSeason, hour: c.hour, phase: c.phase, label: calendarLabel(c) };
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
      blocked: atBottleneck(this.state) ? tribulationBlock(this.state) : null,
      area: { id: area.id, name: area.name, hanzi: area.hanzi, subtitle: area.subtitle },
      prompt: this.mode === "explore" ? this.prompt : null,
      flying: this.flying,
      riding: this.riding,
      quest: questLog(this.state),
      errand: errand(this.state),
      sectQuest: sectObjective(this.state),
      journal: this.journalOpen
        ? {
            main: questLog(this.state),
            errands: [errand(this.state)].filter((e): e is string => !!e),
            sects: sectJournal(this.state),
            standing: SECT_IDS.map((id) => ({ id, name: SECTS[id].name, hanzi: SECTS[id].hanzi, rep: repOf(this.state, id), label: standing(repOf(this.state, id)) })),
          }
        : null,
      attire: { id: currentAttire(this.state).id, name: currentAttire(this.state).name, owned: ownedAttire(this.state).length },
      dialog: this.mode === "scene" ? this.dialog : null,
      choice: this.mode === "scene" && this.choice ? { ...this.choice, options: this.choice.options.map((o) => ({ ...o })) } : null,
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
      interior: this.interior ? { id: this.interior.def.key, name: this.interior.def.name, hanzi: this.interior.def.hanzi, cave: this.interior.def.sky === "cave" } : null,
      calendar: this.calendarSnapshot(),
      year: yearQuest(this.state, calendarAt(worldTime(this.state))),
      war: warLog(this.state, (id) => lockReason(id, this.state)),
      warDone: warDone(this.state),
      warCount: WAR_COUNT,
      warFronts: this.journalOpen && warDone(this.state) > 0 ? warChronicle(this.state) : null,
      road: roadLog(this.state, (id) => lockReason(id, this.state)),
      roadDone: roadDone(this.state),
      roadCount: ROAD_COUNT,
      roadSteles: this.journalOpen && roadDone(this.state) > 0 ? roadChronicle(this.state) : null,
      halls: hallsLog(this.state, (id) => lockReason(id, this.state)),
      hallsDone: hallsDone(this.state),
      hallsCount: HALLS_COUNT,
      hallsList: this.journalOpen && hallsDone(this.state) > 0 ? hallsChronicle(this.state) : null,
      tiers: tiersLog(this.state, (id) => lockReason(id, this.state)),
      tiersDone: tiersDone(this.state),
      tiersCount: TIERS_COUNT,
      tiersList: this.journalOpen && tiersDone(this.state) > 0 ? tiersChronicle(this.state) : null,
      peoples: peoplesLog(this.state, (id) => lockReason(id, this.state)),
      peoplesDone: peoplesDone(this.state),
      peoplesCount: PEOPLES_COUNT,
      peoplesList: this.journalOpen && peoplesDone(this.state) > 0 ? peoplesChronicle(this.state) : null,
      standing: { label: standingLabel(this.state), journal: this.journalOpen ? standingJournal(this.state) : null },
      wu: (() => {
        const w = deepestWu(this.state);
        const j = wuJournal(this.state);
        const top = w ? j.find((x) => x.id === w)! : null;
        return { label: top ? `${top.hanzi} ${top.stage}` : null, colour: top ? top.colour : null, total: wuTotal(this.state), domain: domainOpen(this.state), paths: this.journalOpen ? j : null };
      })(),
      dao: (() => {
        const d = dominantDao(this.state);
        return { label: daoLabel(this.state), colour: d ? DAOS[d].colour : null, creed: d ? DAOS[d].creed : null, paths: this.journalOpen ? daoJournal(this.state) : null };
      })(),
      condition: { label: conditionLabel(this.state), journal: this.journalOpen ? conditionJournal(this.state) : null },
      notices: carried(this.state).map((c) => ({ slot: c.slot, title: c.bounty.title, giver: folk(c.bounty.giver)?.name ?? "", text: progressText(c) })),
      noticesDone: bountiesDone(this.state),
      noticeCount: BOUNTY_COUNT,
      wardrobe: this.wardrobeOpen
        ? ATTIRE.map((a) => ({ id: a.id, name: a.name, hanzi: a.hanzi, from: a.from, owned: hasAttire(this.state, a.id), worn: currentAttire(this.state).id === a.id, hint: ATTIRE_HINT[a.id] ?? "" }))
        : null,
      toasts: this.toasts.map(({ id, text }) => ({ id, text })),
      canSkip: this.mode === "scene",
      shopKeeper: this.mode === "shop" ? this.lastSpeaker : null,
      menu: this.menuOpen && this.mode === "explore",
    };
  }
}

/** "the Hall of Clouds", but "Granny Hua's Cottage". */
function doorName(to: string | undefined): string {
  if (!isRoomId(to)) return "";
  const name = getRoom(to).name;
  return /^\S+ \S+'s /.test(name) ? name : `the ${name}`;
}

/** Run a callback after `delay` seconds of game time. */
function setTimeoutish(game: Game, delay: number, fn: () => void): void {
  game.schedule(delay, fn);
}
