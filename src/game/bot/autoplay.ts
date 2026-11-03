import type { Game } from "../runtime/Game";
import type { Actor } from "../runtime/world";
import { SKILLS } from "../engine/battle";
import { ENEMIES } from "../engine/enemies";
import { atBottleneck, levelIndex, realmLabel } from "../engine/realms";
import { stats, type GameState, type SkillId } from "../engine/state";
import { tribulationBlock } from "../engine/cultivation";
import { hash2 } from "../pixel/noise";
import { AREA_IDS, type AreaId } from "../world/ids";
import { isWorldDef } from "../world/continent";
import { lockReason } from "../story/story";

/**
 * The autoplay bot (自动): plays Lin Yue through the jianghu on its own, so
 * the tale (thousands of quests long) can be tested without a person at the
 * keys. It drives the game only through what a player has (keys, taps on the
 * map, the battle menu, the choices put to her) and reads only what a player
 * sees (who has a marker over their head, where shrines and beasts are, the
 * HUD's quest lines), so what it finds broken a player would find broken.
 *
 * Each tick it looks at the mode the game is in and does one thing:
 *
 * - a scene: answer a question (by a policy: first, cycle or random) or read
 *   on;
 * - a battle: heal when low, restore qi when dry, otherwise the strongest
 *   technique it has the qi for;
 * - the world: take a pill if hurt; at the bottleneck, walk to a shrine and
 *   face the tribulation; otherwise go and talk to the nearest person with
 *   news (a marker over their head), and failing that hunt the nearest
 *   beast, visit a landmark not yet seen, or fly to a region not yet seen.
 *
 * When it walks, it walks: straight at the target, onto the sword when the
 * way is blocked, and (with `travel: "teleport"`, or when even the sword
 * cannot get round) it jumps there the way the tests do, and says so in its
 * log. When nothing has moved the tale on for a long while it logs a stall
 * with every quest line on the HUD, which is the point: a stall is a quest a
 * player could not finish either.
 *
 * Everything it does is in its report: quests done in every thread, people
 * spoken to, battles won and lost, choices made, stalls, and any exception
 * the game threw.
 */

export type ChoicePolicy = "first" | "cycle" | "random";

export interface BotOptions {
  /** How it gets about: on foot (and sword) with a jump when stuck, or straight there by a jump for anything far. */
  travel?: "walk" | "teleport";
  /** How it answers the questions put to her. */
  choose?: ChoicePolicy;
  /** Seed for its own choices (which beast, which landmark, a random answer). */
  seed?: number;
  /** Read every line (slow, like a player), or skip through talk (fast; battles and questions still stop it). */
  read?: boolean;
  /** Seconds of game time with nothing moving the tale on before it logs a stall and tries something else. */
  stallAfter?: number;
  /**
   * When a stall is only her realm being too low for what comes next, lift
   * her a stage (a testing assist; logged as such) instead of grinding.
   */
  assist?: boolean;
  /** Called with every log line as it happens. */
  onEvent?: (e: BotEvent) => void;
}

export type BotEventKind = "start" | "quest" | "talk" | "battle" | "won" | "lost" | "choice" | "travel" | "fly" | "teleport" | "stuck" | "stall" | "tribulation" | "meditate" | "pill" | "assist" | "error" | "map";

export interface BotEvent {
  /** Game clock, in seconds. */
  t: number;
  kind: BotEventKind;
  text: string;
}

export interface BotReport {
  seconds: number;
  realm: string;
  /** Quests done in each thread of the tale (from the save's counters). */
  threads: Record<string, number>;
  flags: number;
  talks: number;
  battles: { won: number; lost: number };
  choices: number;
  teleports: number;
  stalls: { t: number; objectives: string[] }[];
  errors: { t: number; message: string }[];
  regions: AreaId[];
  /** The last lines of its log. */
  log: BotEvent[];
}

/** The threads of the tale, by the counter that holds how many of each are done. */
export const THREAD_COUNTERS: Record<string, string> = {
  war: "war",
  road: "road",
  halls: "halls",
  tiers: "tiers",
  peoples: "peoples",
  seas: "seas",
  courts: "courts",
  founding: "fd",
  contention: "cn",
  notices: "bounties",
};

/** How far along the tale is: every flag set, and every quest done in every thread. */
export function progressScore(g: GameState): number {
  let n = 0;
  for (const v of Object.values(g.flags)) if (v) n++;
  for (const k of Object.values(THREAD_COUNTERS)) n += g.counters[k] ?? 0;
  return n + g.realm * 100 + g.stage * 10 + g.skills.length * 5;
}

/** The strongest techniques first. */
const SKILL_ORDER: SkillId[] = ["starfall", "phoenix", "dragon", "thunder", "whirlwind", "swords", "palm", "strike"];

type Goal = { kind: "talk"; key: string } | { kind: "hunt"; key: string } | { kind: "shrine"; key: string; trib: boolean } | { kind: "landmark"; key: string; x: number; y: number } | { kind: "region"; id: AreaId; x: number; y: number };

const goalId = (g: Goal) => `${g.kind}:${"key" in g ? g.key : g.id}`;

export class AutoPlayer {
  readonly opts: Required<Omit<BotOptions, "onEvent">> & Pick<BotOptions, "onEvent">;
  private log: BotEvent[] = [];
  private goal: Goal | null = null;
  private goalSince = 0;
  private bestDist = Infinity;
  private bestAt = 0;
  private flewAt = -99;
  private sceneAt = 0;
  private choiceN = 0;
  private rng = 0;
  private lastScore = 0;
  private lastProgress = 0;
  /** Goals that came to nothing, and when they may be tried again. */
  private shunned = new Map<string, number>();
  /** People who still had news after she spoke with them (each time), so a marker that never clears is not chased for ever. */
  private talkedTo = new Map<string, number>();
  private seenLandmarks = new Set<string>();
  private seenRegions = new Set<AreaId>();
  /** Every region she has stood in (for the report: seenRegions is forgotten when there is nothing left to do). */
  private visited = new Set<AreaId>();
  private stats = { talks: 0, won: 0, lost: 0, choices: 0, teleports: 0 };
  private stalls: BotReport["stalls"] = [];
  private errors: BotReport["errors"] = [];
  private wasMode = "";
  private scored = 0;
  private meditateUntil = 0;
  private questLine = "";

  constructor(
    readonly game: Game,
    opts: BotOptions = {},
  ) {
    this.opts = { travel: "walk", choose: "cycle", seed: 1, read: false, stallAfter: 600, assist: false, ...opts };
    this.rng = this.opts.seed;
    this.lastScore = progressScore(game.state);
    this.lastProgress = game.clock;
    this.emit("start", `Autoplay begins at ${realmLabel(game.state.realm, game.state.stage)} in ${game.state.area} (travel: ${this.opts.travel}, choices: ${this.opts.choose})`);
  }

  // ------------------------------------------------------------------ the loop
  /** Look at the game and do one thing (call once a frame, before game.update). */
  tick(): void {
    const g = this.game;
    try {
      this.watch();
      switch (g.mode) {
        case "scene":
          return this.scene();
        case "battle":
          return this.fight();
        case "worldmap":
          return g.closeMap();
        case "shop":
          return g.closeShop();
        case "meditate":
          return this.meditate();
        case "tribulation":
          return;
        case "explore":
          return this.explore();
      }
    } catch (e) {
      this.error(e);
    }
  }

  /** Run the game and the bot together for `seconds` of game time, headless (frames of `dt`). Exceptions are logged, not thrown. */
  run(seconds: number, dt = 1 / 20): BotReport {
    const end = this.game.clock + seconds;
    let errors = 0;
    while (this.game.clock < end) {
      this.tick();
      try {
        this.game.update(dt);
      } catch (e) {
        this.error(e);
        if (++errors > 50) break;
      }
    }
    return this.report();
  }

  report(): BotReport {
    const g = this.game.state;
    const threads: Record<string, number> = {};
    for (const [name, k] of Object.entries(THREAD_COUNTERS)) threads[name] = g.counters[k] ?? 0;
    return {
      seconds: Math.round(this.game.clock),
      realm: realmLabel(g.realm, g.stage),
      threads,
      flags: Object.values(g.flags).filter(Boolean).length,
      talks: this.stats.talks,
      battles: { won: this.stats.won, lost: this.stats.lost },
      choices: this.stats.choices,
      teleports: this.stats.teleports,
      stalls: this.stalls,
      errors: this.errors,
      regions: [...this.visited],
      log: this.log.slice(-60),
    };
  }

  /** The bot's last few lines, newest last. */
  recent(n = 6): BotEvent[] {
    return this.log.slice(-n);
  }

  /** What it is doing right now, in a few words (for the HUD badge). */
  get doing(): string {
    const g = this.goal;
    if (this.game.mode !== "explore") return this.game.mode;
    if (!g) return "looking about";
    return g.kind === "talk" ? `to speak with ${this.game.world.actor(g.key)?.name ?? g.key}` : g.kind === "hunt" ? "hunting" : g.kind === "shrine" ? (g.trib ? "to face the tribulation" : "to meditate") : g.kind === "landmark" ? "to see a landmark" : `to fly to ${g.id}`;
  }

  // ------------------------------------------------------------------ bookkeeping
  private emit(kind: BotEventKind, text: string): void {
    const e = { t: Math.round(this.game.clock * 10) / 10, kind, text };
    this.log.push(e);
    if (this.log.length > 400) this.log.shift();
    this.opts.onEvent?.(e);
  }

  private error(e: unknown): void {
    const message = e instanceof Error ? `${e.message}\n${e.stack?.split("\n").slice(1, 4).join("\n")}` : String(e);
    this.errors.push({ t: Math.round(this.game.clock), message });
    this.emit("error", message);
  }

  private random(): number {
    this.rng++;
    return hash2(this.rng, this.opts.seed, 977);
  }

  /** Note what has changed since last tick: quests done, battles ended, the tale stalled. */
  private watch(): void {
    const g = this.game;
    const s = g.state;
    // a battle's end, the moment its result is known
    const b = g.lastBattle;
    if (b && b.seq !== this.scored) {
      this.scored = b.seq;
      if (b.result === "won") this.stats.won++;
      else if (b.result === "lost") this.stats.lost++;
      this.emit(b.result === "won" ? "won" : "lost", b.result === "won" ? `Beats the ${b.enemy}.` : b.result === "lost" ? `Falls to the ${b.enemy}.` : `Flees the ${b.enemy}.`);
    }
    if (g.mode === "battle" && this.wasMode !== "battle") this.emit("battle", `A fight: ${g.battle?.enemy}.`);
    this.wasMode = g.mode;
    if (g.mode === "explore" && !g.inside) {
      this.seenRegions.add(s.area);
      this.visited.add(s.area);
    }
    const snap = g.snapshot();
    const line = snap.quest.objective;
    if (line !== this.questLine) {
      if (this.questLine) this.emit("quest", `${snap.quest.chapter} · ${snap.quest.title}: ${line}`);
      this.questLine = line;
    }
    const score = progressScore(s);
    if (score !== this.lastScore) {
      this.lastScore = score;
      this.lastProgress = g.clock;
      return;
    }
    if (g.clock - this.lastProgress > this.opts.stallAfter) this.stall();
  }

  /** Nothing has moved the tale on for a long while: say what the HUD asked of her, and try elsewhere. */
  private stall(): void {
    const g = this.game;
    const snap = g.snapshot();
    const objectives = [snap.quest, snap.year, snap.war, snap.road, snap.halls, snap.tiers, snap.peoples, snap.seas, snap.courts, snap.founding, snap.contention].filter((q): q is NonNullable<typeof q> => !!q).map((q) => `${q.title}: ${q.objective}`);
    this.stalls.push({ t: Math.round(g.clock), objectives });
    this.emit("stall", `Nothing has moved the tale on for ${Math.round(g.clock - this.lastProgress)} s. ${objectives[0] ?? ""}`);
    this.lastProgress = g.clock;
    this.shunned.clear();
    this.talkedTo.clear();
    this.goal = null;
    // most stalls are a realm gate: with the assist on, she is lifted a stage rather than left to grind
    if (this.opts.assist) {
      const s = g.state;
      const next = s.stage >= 9 ? { realm: Math.min(5, s.realm + 1), stage: 0 } : { realm: s.realm, stage: s.stage + 1 };
      g.debugPatch({ ...next, cultivation: 0 });
      this.emit("assist", `Testing assist: lifted to ${realmLabel(g.state.realm, g.state.stage)}.`);
    }
  }

  // ------------------------------------------------------------------ scenes
  private scene(): void {
    const g = this.game;
    const snap = g.snapshot();
    if (snap.choice) {
      const n = snap.choice.options.length;
      const k = this.opts.choose === "first" ? 0 : this.opts.choose === "random" ? Math.floor(this.random() * n) : this.choiceN++ % n;
      this.stats.choices++;
      this.emit("choice", `${snap.choice.prompt ?? "A choice"} → ${snap.choice.options[k].label}`);
      g.choose(k);
      return;
    }
    if (!this.opts.read) {
      g.skipScene();
      // (a battle or a question stops the skip; the next tick deals with it)
      if (g.mode === "scene" && !g.snapshot().choice) this.readOn();
      return;
    }
    this.readOn();
  }

  private readOn(): void {
    const g = this.game;
    if (g.clock - this.sceneAt < 0.25) return;
    this.sceneAt = g.clock;
    g.advance();
  }

  // ------------------------------------------------------------------ battle
  private fight(): void {
    const g = this.game;
    const b = g.battle;
    if (!b || b.busy || b.done) return;
    const s = g.state;
    const st = stats(s);
    const hp = b.view.heroHp;
    const qi = b.view.heroQi;
    if (hp < st.maxHp * 0.3 && s.pills.heal > 0) return g.battleAction({ type: "item", item: "heal" });
    if (hp < st.maxHp * 0.3 && s.skills.includes("lotus") && qi >= SKILLS.lotus.qi) return g.battleAction({ type: "skill", skill: "lotus" });
    if (qi < 10 && s.pills.qi > 0 && s.pills.qi > 2) return g.battleAction({ type: "item", item: "qi" });
    for (const k of SKILL_ORDER) if (s.skills.includes(k) && qi >= SKILLS[k].qi) return g.battleAction({ type: "skill", skill: k });
    g.battleAction({ type: "skill", skill: "strike" });
  }

  // ------------------------------------------------------------------ meditation
  private meditate(): void {
    const g = this.game;
    if (atBottleneck(g.state) && !tribulationBlock(g.state)) {
      this.emit("tribulation", `She faces the tribulation at ${realmLabel(g.state.realm, g.state.stage)}.`);
      g.keyDown("KeyB");
      g.keyUp("KeyB");
      return;
    }
    if (g.clock > this.meditateUntil) {
      g.keyDown("Escape");
      g.keyUp("Escape");
    }
  }

  // ------------------------------------------------------------------ the world
  private explore(): void {
    const g = this.game;
    if (g.overlayOpen) return g.closeOverlays();
    const s = g.state;
    const st = stats(s);
    if (s.hp < st.maxHp * 0.4 && s.pills.heal > 0) {
      this.emit("pill", "A Healing Pill.");
      g.takePill("heal");
    }
    if (!this.goal || g.clock - this.goalSince > 90) this.pick();
    const goal = this.goal;
    if (!goal) return;
    const at = this.where(goal);
    if (!at) {
      this.drop(goal, 60);
      return;
    }
    const h = g.world.hero;
    const d = Math.hypot(at[0] - h.x, at[1] - h.y);
    // close enough: do the thing
    const reach = goal.kind === "hunt" ? 0.6 : goal.kind === "landmark" || goal.kind === "region" ? 6 : 1.4;
    if (d <= reach) return this.arrive(goal);
    // far, and jumping is allowed: jump (beside it, on open ground)
    if (this.opts.travel === "teleport" && d > 40) return this.jump(goal, at);
    if (d < this.bestDist - 0.5) {
      this.bestDist = d;
      this.bestAt = g.clock;
    }
    const stuckFor = g.clock - this.bestAt;
    if (stuckFor > 3 && !h.flying && g.clock - this.flewAt > 8 && s.flags.metElder && !g.inside) {
      // blocked on foot: up onto the sword
      this.flewAt = g.clock;
      this.emit("fly", "Blocked: up onto her sword.");
      g.toggleFly();
    }
    if (stuckFor > 9) return this.jump(goal, at);
    // on the sword and close: come down to talk, fight or kneel
    if (h.flying && d < 3) g.toggleFly();
    g.steerTo(at);
  }

  /** Where a goal is now (people and beasts move about), or null if it is gone. */
  private where(goal: Goal): [number, number] | null {
    const w = this.game.world;
    if (goal.kind === "talk" || goal.kind === "hunt") {
      const a = w.actor(goal.key);
      return a && !a.hidden ? [a.x, a.y] : null;
    }
    if (goal.kind === "shrine") {
      const it = w.def.interacts.find((x) => x.key === goal.key);
      return it ? [it.i + 0.5, it.j + 0.5] : null;
    }
    return [goal.x, goal.y];
  }

  private arrive(goal: Goal): void {
    const g = this.game;
    const h = g.world.hero;
    if (h.flying) g.toggleFly();
    g.steerTo(null);
    switch (goal.kind) {
      case "talk": {
        const before = progressScore(g.state);
        const a = g.world.actor(goal.key);
        // face them and speak (the nearest one to speak with is them, standing this close)
        if (a) h.dir = Math.round(((Math.atan2(a.y - h.y, a.x - h.x) / (Math.PI * 2)) * 16 + 16)) % 16;
        g.keyDown("KeyE");
        g.keyUp("KeyE");
        if (g.mode === "scene") {
          this.stats.talks++;
          this.emit("talk", `Speaks with ${a?.name ?? goal.key}.`);
          const n = (this.talkedTo.get(goal.key) ?? 0) + 1;
          this.talkedTo.set(goal.key, n);
          if (n >= 3 && progressScore(g.state) === before) this.drop(goal, 240);
        } else this.drop(goal, 30);
        this.goal = null;
        return;
      }
      case "hunt":
        // walking into a beast starts the fight; if nothing happened it is gone or out of reach
        g.steerTo(this.where(goal));
        if (g.clock - this.goalSince > 20) this.drop(goal, 60);
        return;
      case "shrine":
        g.keyDown(goal.trib ? "KeyB" : "KeyE");
        g.keyUp(goal.trib ? "KeyB" : "KeyE");
        if (g.mode === "meditate" || g.mode === "scene" || g.mode === "tribulation") {
          this.meditateUntil = g.clock + 20;
          this.emit(goal.trib ? "tribulation" : "meditate", goal.trib ? "At a shrine: she calls down the tribulation." : "She sits down to meditate.");
        } else this.drop(goal, 120);
        this.goal = null;
        return;
      case "landmark":
        this.seenLandmarks.add(goal.key);
        this.emit("travel", `Sees ${goal.key}.`);
        this.goal = null;
        return;
      case "region":
        this.seenRegions.add(goal.id);
        this.goal = null;
        return;
    }
  }

  /** Jump beside a goal, as the tests do (the log says so). */
  private jump(goal: Goal, [x, y]: [number, number]): void {
    const g = this.game;
    const m = g.world.def.map;
    for (let r = 1; r <= 6; r++)
      for (const [dx, dy] of [[r, 0], [0, r], [-r, 0], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]]) {
        const i = Math.floor(x + dx);
        const j = Math.floor(y + dy);
        if (!m.standable(i, j)) continue;
        this.stats.teleports++;
        this.emit("teleport", `Jumps to ${goalId(goal)} (${i}, ${j}).`);
        if (g.inside) g.world.placeHero(i + 0.5, j + 0.5, 8);
        else g.debugGoto(i + 0.5, j + 0.5);
        this.bestDist = Infinity;
        this.bestAt = g.clock;
        return;
      }
    this.emit("stuck", `Nowhere to stand by ${goalId(goal)}.`);
    this.drop(goal, 300);
  }

  private drop(goal: Goal, seconds: number): void {
    this.shunned.set(goalId(goal), this.game.clock + seconds);
    if (this.goal && goalId(this.goal) === goalId(goal)) this.goal = null;
  }

  private ok(goal: Goal): boolean {
    return (this.shunned.get(goalId(goal)) ?? -1) < this.game.clock;
  }

  /** Choose what to do next. */
  private pick(): void {
    const g = this.game;
    const s = g.state;
    const w = g.world;
    const h = w.hero;
    const dist = (a: { x: number; y: number }) => Math.hypot(a.x - h.x, a.y - h.y);
    // only where a player could go: no region the story still seals (outdoors; indoors everything in the room is hers)
    const open = (a: { x: number; y: number }) => g.inside || !lockReason(w.regionAt(a.x, a.y), s);
    const set = (goal: Goal | null) => {
      if (goal && (!this.goal || goalId(goal) !== goalId(this.goal))) this.emit("travel", `Sets out ${this.describe(goal)}.`);
      this.goal = goal;
      this.goalSince = g.clock;
      this.bestDist = Infinity;
      this.bestAt = g.clock;
    };
    // at the bottleneck with nothing in the way: the nearest shrine, to face heaven
    if (atBottleneck(s) && !tribulationBlock(s) && !(s.realm >= 5)) {
      const shrine = this.nearestShrine(true);
      if (shrine) return set(shrine);
    }
    // anyone with news
    let best: Actor | null = null;
    let bd = Infinity;
    for (const a of w.actors) {
      if (a.kind !== "npc" || !a.marker || a.hidden || !open(a)) continue;
      const goal: Goal = { kind: "talk", key: a.key };
      if (!this.ok(goal)) continue;
      const d = dist(a);
      if (d < bd) {
        bd = d;
        best = a;
      }
    }
    if (best) return set({ kind: "talk", key: best.key });
    // a beast to fight, not too far (cultivation, and the hunts)
    let prey: Actor | null = null;
    let pd = 70;
    for (const a of w.actors) {
      if (a.kind !== "enemy" || a.hidden || !open(a)) continue;
      // nothing far above her (a boss the tale has not sent her to, a beast of a realm she has not reached), and no friendly sparring
      const foe = a.enemy ? ENEMIES[a.enemy] : null;
      if (foe && (foe.boss || foe.friendly || foe.level > levelIndex(s.realm, s.stage) + 4)) continue;
      if (!this.ok({ kind: "hunt", key: a.key })) continue;
      const d = dist(a);
      if (d < pd) {
        pd = d;
        prey = a;
      }
    }
    const L = levelIndex(s.realm, s.stage);
    if (prey && this.random() < 0.7) return set({ kind: "hunt", key: prey.key });
    // a landmark not yet seen (the year's wardens, the notices and the threads all send her to them)
    const def = w.def;
    if (isWorldDef(def)) {
      const marks = def.landmarks.filter((l) => !this.seenLandmarks.has(l.key) && open(l) && this.ok({ kind: "landmark", key: l.key, x: l.x, y: l.y }));
      if (marks.length && this.random() < 0.5) {
        marks.sort((p, q) => dist(p) - dist(q));
        const l = marks[Math.floor(this.random() * Math.min(4, marks.length))];
        return set({ kind: "landmark", key: l.key, x: l.x, y: l.y });
      }
      // a region not yet seen
      const regions = AREA_IDS.filter((id) => !this.seenRegions.has(id) && !lockReason(id, s) && this.ok({ kind: "region", id, x: 0, y: 0 }));
      if (regions.length) {
        const id = regions[Math.floor(this.random() * regions.length)];
        const [x, y] = def.waypoints[id];
        return set({ kind: "region", id, x, y });
      }
    }
    if (prey) return set({ kind: "hunt", key: prey.key });
    // nothing else: sit at a shrine and cultivate
    const shrine = this.nearestShrine(false);
    if (shrine && L < 60) return set(shrine);
    // and if even that is not there, forget what has been seen and look again
    this.seenLandmarks.clear();
    this.seenRegions.clear();
    set(null);
  }

  private nearestShrine(trib: boolean): Goal | null {
    const w = this.game.world;
    const h = w.hero;
    let best: Goal | null = null;
    let bd = Infinity;
    for (const it of w.def.interacts) {
      if (it.kind !== "shrine" && !(trib && it.kind === "altar")) continue;
      if (it.when && !it.when(this.game.state.flags)) continue;
      const goal: Goal = { kind: "shrine", key: it.key, trib };
      if (!this.ok(goal)) continue;
      const d = Math.hypot(it.i - h.x, it.j - h.y);
      if (d < bd) {
        bd = d;
        best = goal;
      }
    }
    return best;
  }

  private describe(goal: Goal): string {
    switch (goal.kind) {
      case "talk":
        return `to speak with ${this.game.world.actor(goal.key)?.name ?? goal.key}`;
      case "hunt":
        return `after ${this.game.world.actor(goal.key)?.char ?? goal.key}`;
      case "shrine":
        return goal.trib ? "for a shrine, to face the tribulation" : "for a shrine, to meditate";
      case "landmark":
        return `for ${goal.key}`;
      case "region":
        return `for ${goal.id}`;
    }
  }
}
