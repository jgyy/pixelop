import { alpha } from "../pixel/color";
import { drawText, textWidth } from "../pixel/font";
import { sCircle, sLine, sRing, type Surface } from "../pixel/surface";
import { drawBackground, drawForeground, getScene, GROUND_Y, SCREEN_H, SCREEN_W } from "../scenes";
import { frameAt, getSprite, type SpriteSheet } from "../sprites";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { atBottleneck, cultivationNeeded, levelIndex, realmLabel, REALMS, type Stats } from "../engine/realms";
import { resolveTurn, reviveAtSect, SKILLS, startBattle, type BattleAction, type BattleEvent, type BattleState } from "../engine/battle";
import { applyBreakthrough, buyPill, gainCultivation, heal, stats, consumePill, type GameState, type RegionId } from "../engine/state";
import { elderDialogue, entryBlocker, GATE_MARGIN, REGIONS, sisterDialogue, type DialogueLine, type EnemySpawn } from "../engine/world";
import { Effects } from "./particles";

export type Mode = "explore" | "battle" | "dialog" | "shop" | "meditate" | "tribulation";

export interface UiSnapshot {
  mode: Mode;
  state: GameState;
  stats: Stats;
  realm: string;
  realmColour: string;
  cultivationNeeded: number;
  bottleneck: boolean;
  regionName: string;
  prompt: string | null;
  flying: boolean;
  dialog: (DialogueLine & { index: number; total: number }) | null;
  battle: { enemy: EnemyId; enemyName: string; enemyHp: number; enemyMax: number; heroHp: number; heroQi: number; busy: boolean; log: string[]; boss: boolean; turn: number } | null;
  tribulation: string | null;
  toasts: { id: number; text: string }[];
}

interface Actor {
  sheet: SpriteSheet;
  anim: string;
  start: number;
}

interface WorldEnemy {
  key: string;
  spawn: EnemySpawn;
  x: number;
  dir: 1 | -1;
  actor: Actor;
}

interface Projectile {
  kind: "orb" | "sword" | "crescent" | "foxfire";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  start: number;
  dur: number;
  color: string;
  arc?: number;
}

interface Timer {
  at: number;
  fn: () => void;
}

const WALK_SPEED = 72;
const FLY_SPEED = 150;
const HERO_FOOT = 43;
const HERO_CX = 24;
const NON_HOLD_RETURN = new Set(["attack", "cast", "hurt", "jump"]);

/**
 * The live game: owns the mutable runtime around the pure engine, steps the
 * simulation, and paints frames onto any Surface. React only renders HUD/menus
 * from UiSnapshots.
 */
export class Game {
  state: GameState;
  mode: Mode = "explore";
  clock = 0;
  private keys = new Set<string>();
  private timers: Timer[] = [];
  private fx = new Effects();
  private listeners = new Set<(s: UiSnapshot) => void>();
  private dirty = true;
  private toasts: { id: number; text: string; until: number }[] = [];
  private toastSeq = 0;

  // explore
  private hero: Actor = { sheet: getSprite("heroine"), anim: "idle", start: 0 };
  private heroY = 0;
  private heroVy = 0;
  private facing: 1 | -1 = 1;
  private flying = false;
  private swordX = 0;
  private swordY = 0;
  private camX = 0;
  private enemies: WorldEnemy[] = [];
  private herbs: number[] = [];
  private invulnerableUntil = 0;
  private prompt: string | null = null;
  private dustTimer = 0;
  private meditateTick = 0;

  // dialog / shop
  private dialog: DialogueLine[] = [];
  private dialogIndex = 0;
  private afterDialog: (() => void) | null = null;

  // battle
  private battle: BattleState | null = null;
  private battleEnemy: WorldEnemy | null = null;
  private foe: Actor | null = null;
  private busy = false;
  private log: string[] = [];
  private view = { heroHp: 0, heroQi: 0, enemyHp: 0 };
  private heroDx = 0;
  private heroDxTarget = 0;
  private foeDx = 0;
  private foeDxTarget = 0;
  private foeAlpha = 1;
  private projectiles: Projectile[] = [];
  private shake = 0;
  private flash = 0;
  private flashColor = "#ffffff";

  // tribulation
  private tribStage: string | null = null;
  private tribStart = 0;
  private bolts: { at: number; x: number }[] = [];

  constructor(state: GameState, private seed = Date.now()) {
    this.state = state;
    this.enterRegion(state.region, state.x, false);
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
  }

  getShake(): [number, number] {
    if (this.shake <= 0) return [0, 0];
    const m = Math.ceil(this.shake * 4);
    return [Math.round((Math.random() - 0.5) * m), Math.round((Math.random() - 0.5) * m)];
  }

  /** Replace state wholesale (load game). */
  load(state: GameState): void {
    this.state = state;
    this.mode = "explore";
    this.battle = null;
    this.timers = [];
    this.fx.clear();
    this.enterRegion(state.region, state.x, false);
    this.toast(`Welcome back, ${state.name}.`);
  }

  battleAction(action: BattleAction): void {
    if (this.mode !== "battle" || !this.battle || this.busy) return;
    const res = resolveTurn(this.state, this.battle, action);
    if (res.events.length === 1 && res.events[0].kind === "rejected") {
      this.toast(res.events[0].reason);
      return;
    }
    this.state = res.game;
    this.battle = res.battle;
    this.busy = true;
    this.playEvents(res.events);
    this.markDirty();
  }

  advanceDialog(): void {
    if (this.mode !== "dialog") return;
    this.dialogIndex++;
    if (this.dialogIndex >= this.dialog.length) {
      this.mode = "explore";
      const next = this.afterDialog;
      this.afterDialog = null;
      next?.();
    }
    this.markDirty();
  }

  buy(kind: "heal" | "qi"): void {
    const next = buyPill(this.state, kind);
    if (!next) return this.toast("Not enough spirit stones.");
    this.state = next;
    this.toast(kind === "heal" ? "Bought a Healing Pill." : "Bought a Qi Pill.");
  }

  closeShop(): void {
    if (this.mode === "shop") this.mode = "explore";
    this.markDirty();
  }

  takePill(kind: "heal" | "qi"): void {
    if (this.mode !== "explore" && this.mode !== "meditate") return;
    const next = consumePill(this.state, kind);
    if (!next) return this.toast("No pills of that kind.");
    this.state = next;
    this.fx.burst(this.state.x, GROUND_Y - 20, 14, kind === "heal" ? ["#ff8aa8", "#ffffff"] : ["#9ff5de", "#ffffff"], 40);
    this.toast(kind === "heal" ? "Healing Pill restores your vitality." : "Qi Pill replenishes your dantian.");
  }

  toggleFly(): void {
    if (this.mode !== "explore") return;
    this.flying = !this.flying;
    this.play(this.hero, this.flying ? "fly" : "idle");
    this.fx.burst(this.state.x, GROUND_Y - 4, 12, ["#9ff5de", "#ffffff"], 50);
    this.markDirty();
  }

  startTribulation(): void {
    if (!atBottleneck(this.state)) return this.toast("Your qi has not yet reached its peak.");
    if (this.mode !== "meditate" && this.mode !== "explore") return;
    this.mode = "tribulation";
    this.tribStart = this.clock;
    this.tribStage = "Heaven's lightning gathers above the peak...";
    this.fx.clear();
    this.bolts = [];
    const strikes = [1.6, 3.0, 4.4];
    strikes.forEach((t, i) =>
      this.after(t, () => {
        this.bolts.push({ at: this.clock, x: SCREEN_W / 2 });
        this.shake = 0.8;
        this.flash = 0.9;
        this.flashColor = "#e8e0ff";
        this.play(this.hero, "hurt");
        this.after(0.35, () => this.play(this.hero, "meditate"));
        this.fx.burst(SCREEN_W / 2, GROUND_Y - 20, 30, ["#ffffff", "#b8a4ff", "#9ff5de"], 90);
        this.fx.float(`BOLT ${i + 1}/3`, SCREEN_W / 2, GROUND_Y - 58, "#e8dcff", 1);
        this.tribStage = ["The first bolt tempers your meridians!", "The second bolt shatters your old limits!", "The third bolt — your dao heart does not waver!"][i];
        this.markDirty();
      }),
    );
    this.after(5.6, () => {
      const before = REALMS[this.state.realm].name;
      this.state = applyBreakthrough(this.state);
      const after = REALMS[this.state.realm];
      this.flash = 1;
      this.flashColor = after.colour;
      this.play(this.hero, "victory");
      for (let r = 0; r < 3; r++) this.fx.burst(SCREEN_W / 2, GROUND_Y - 22, 40, [after.colour, "#ffffff", "#f2c55c"], 60 + r * 40);
      this.tribStage = `Breakthrough! ${before} → ${after.name}`;
      this.toast(`Breakthrough! You have reached ${after.name} (${after.hanzi}).`);
      this.markDirty();
    });
    this.after(8.2, () => {
      this.mode = "explore";
      this.tribStage = null;
      this.play(this.hero, "idle");
      this.fx.clear();
      this.markDirty();
    });
    this.play(this.hero, "meditate");
    this.markDirty();
  }

  // ------------------------------------------------------------ debug / testing
  debugBattle(enemy: EnemyId): void {
    const spawn: EnemySpawn = { enemy, x: this.state.x + 30, range: 0 };
    const we: WorldEnemy = { key: `debug-${enemy}`, spawn, x: spawn.x, dir: -1, actor: { sheet: getSprite(ENEMIES[enemy].sprite), anim: "idle", start: 0 } };
    this.beginBattle(we);
  }

  debugTeleport(region: RegionId, x?: number): void {
    this.mode = "explore";
    this.enterRegion(region, x ?? 120, true);
  }

  debugPatch(patch: Partial<GameState>): void {
    this.state = { ...this.state, ...patch };
    this.markDirty();
  }

  debugSkipTime(seconds: number): void {
    const step = 1 / 30;
    for (let t = 0; t < seconds; t += step) this.update(step);
  }

  // ------------------------------------------------------------------ simulation
  update(dt: number): void {
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    this.state.playTime += dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt * 3);
    const due = this.timers.filter((t) => t.at <= this.clock);
    if (due.length) {
      this.timers = this.timers.filter((t) => t.at > this.clock);
      due.sort((a, b) => a.at - b.at).forEach((t) => t.fn());
    }
    this.fx.update(dt);
    if (this.toasts.length && this.toasts[0].until < this.clock) {
      this.toasts = this.toasts.filter((t) => t.until >= this.clock);
      this.markDirty();
    }
    switch (this.mode) {
      case "explore":
        this.updateExplore(dt);
        break;
      case "meditate":
        this.updateMeditate(dt);
        break;
      case "battle":
        this.updateBattle(dt);
        break;
      default:
        break;
    }
    this.updateSword(dt);
    if (this.dirty) {
      this.dirty = false;
      const snap = this.snapshot();
      this.listeners.forEach((l) => l(snap));
    }
  }

  private updateExplore(dt: number): void {
    const region = REGIONS[this.state.region];
    const left = this.keys.has("ArrowLeft") || this.keys.has("KeyA");
    const right = this.keys.has("ArrowRight") || this.keys.has("KeyD");
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const speed = this.flying ? FLY_SPEED : WALK_SPEED;
    if (dir !== 0) {
      this.facing = dir as 1 | -1;
      this.state.x = Math.max(16, Math.min(region.width - 16, this.state.x + dir * speed * dt));
    }
    // jump physics
    if (this.heroY < 0 || this.heroVy !== 0) {
      this.heroVy += 520 * dt;
      this.heroY += this.heroVy * dt;
      if (this.heroY >= 0) {
        this.heroY = 0;
        this.heroVy = 0;
        this.fx.burst(this.state.x, GROUND_Y, 6, ["#d8d0c0", "#ffffff"], 30, { vy: -10, gravity: 40 });
      }
    }
    const airborne = this.heroY < 0;
    const want = this.flying ? "fly" : airborne ? "jump" : dir !== 0 ? "walk" : "idle";
    if (this.hero.anim !== want && !(this.hero.anim === "jump" && airborne)) this.play(this.hero, want);
    // dust / qi trail
    this.dustTimer -= dt;
    if (dir !== 0 && this.dustTimer <= 0) {
      this.dustTimer = this.flying ? 0.04 : 0.18;
      if (this.flying) this.fx.emit({ x: this.state.x - this.facing * 14, y: GROUND_Y - 10 + Math.random() * 4, vx: -this.facing * 30, vy: -4, life: 0.5, color: Math.random() < 0.5 ? "#9ff5de" : "#ffffff" });
      else if (!airborne) this.fx.emit({ x: this.state.x - this.facing * 6, y: GROUND_Y - 1, vx: -this.facing * 12, vy: -10, life: 0.4, color: "#d8d0c0", gravity: 30 });
    }
    this.camX = Math.max(0, Math.min(region.width - SCREEN_W, this.state.x - SCREEN_W / 2));

    // patrolling enemies + collision
    for (const e of this.enemies) {
      if (e.spawn.range > 0) {
        e.x += e.dir * 22 * dt;
        if (e.x > e.spawn.x + e.spawn.range) e.dir = -1;
        if (e.x < e.spawn.x - e.spawn.range) e.dir = 1;
      }
      if (Math.abs(e.x - this.state.x) < 20 && this.clock > this.invulnerableUntil && !this.flying) {
        this.beginBattle(e);
        return;
      }
    }
    // herbs
    for (const hx of [...this.herbs]) {
      if (Math.abs(hx - this.state.x) < 12) {
        this.herbs = this.herbs.filter((h) => h !== hx);
        const s = stats(this.state);
        this.state = heal(this.state, 0, s.maxQi * 0.3);
        const r = gainCultivation(this.state, 6 + levelIndex(this.state.realm, this.state.stage) * 2);
        this.state = r.state;
        this.fx.burst(hx, GROUND_Y - 8, 16, ["#ffd23a", "#ffffff", "#9ff5de"], 45);
        this.fx.float("+QI", hx, GROUND_Y - 20, "#ffd23a");
        this.toast(r.stagesGained ? `Spirit herb absorbed — reached ${realmLabel(this.state.realm, this.state.stage)}!` : "Spirit herb absorbed. Qi surges through your meridians.");
      }
    }
    this.updatePrompt();
  }

  private updatePrompt(): void {
    const p = this.nearby();
    const text = p ? p.label : null;
    if (text !== this.prompt) {
      this.prompt = text;
      this.markDirty();
    }
  }

  private nearby(): { label: string; act: () => void } | null {
    const region = REGIONS[this.state.region];
    const x = this.state.x;
    for (const npc of region.npcs) {
      if (Math.abs(npc.x - x) < 28) {
        const name = npc.id === "elder" ? "Elder Mo" : "Senior Sister Qing";
        return {
          label: `E · Talk to ${name}`,
          act: () => {
            if (npc.id === "elder") {
              this.openDialog(elderDialogue(this.state), () => {
                this.state = { ...this.state, flags: { ...this.state.flags, metElder: true } };
              });
            } else this.openDialog(sisterDialogue(), () => {
              this.mode = "shop";
              this.markDirty();
            });
          },
        };
      }
    }
    if (region.shrineX !== undefined && Math.abs(region.shrineX - x) < 34) {
      return { label: atBottleneck(this.state) ? "E · Meditate   B · Face Tribulation" : "E · Meditate at the Lotus Shrine", act: () => this.beginMeditation() };
    }
    if (region.prev && x < GATE_MARGIN + 10) {
      const target = region.prev;
      return { label: `E · Travel to ${REGIONS[target].name}`, act: () => this.travel(target, "back") };
    }
    if (region.next && x > region.width - GATE_MARGIN - 10) {
      const target = region.next;
      return { label: `E · Travel to ${REGIONS[target].name}`, act: () => this.travel(target, "forward") };
    }
    return null;
  }

  private travel(target: RegionId, direction: "forward" | "back"): void {
    const block = entryBlocker(this.state, target);
    if (block) return this.toast(block);
    const r = REGIONS[target];
    this.enterRegion(target, direction === "forward" ? GATE_MARGIN + 30 : r.width - GATE_MARGIN - 30, true);
  }

  private enterRegion(id: RegionId, x: number, announce: boolean): void {
    const r = REGIONS[id];
    this.state = { ...this.state, region: id, x };
    this.enemies = r.enemies
      .filter((e) => !(e.enemy === "patriarch" && this.state.bossDefeated))
      .map((spawn, i) => ({ key: `${id}-${i}`, spawn, x: spawn.x, dir: (i % 2 ? 1 : -1) as 1 | -1, actor: { sheet: getSprite(ENEMIES[spawn.enemy].sprite), anim: "idle", start: i * 0.37 } }));
    this.herbs = [...r.herbs];
    this.camX = Math.max(0, Math.min(r.width - SCREEN_W, x - SCREEN_W / 2));
    this.swordX = x;
    this.swordY = GROUND_Y - 40;
    this.invulnerableUntil = this.clock + 1.5;
    this.fx.clear();
    if (announce) this.toast(`${r.name} — ${getScene(r.scene).subtitle}`);
    this.markDirty();
  }

  private beginMeditation(): void {
    this.mode = "meditate";
    this.flying = false;
    // sit on the cushion beside the altar, facing it
    const shrineX = REGIONS[this.state.region].shrineX;
    if (shrineX !== undefined) {
      this.state.x = shrineX + 30;
      this.facing = -1;
    }
    this.play(this.hero, "meditate");
    this.meditateTick = 0;
    this.toast("You sit in lotus position and draw in the qi of heaven and earth.");
    this.markDirty();
  }

  private updateMeditate(dt: number): void {
    const region = REGIONS[this.state.region];
    this.camX = Math.max(0, Math.min(region.width - SCREEN_W, this.state.x - SCREEN_W / 2));
    // qi motes spiral into the heroine
    if (Math.random() < dt * 30) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 30;
      this.fx.emit({ x: this.state.x + Math.cos(a) * r, y: GROUND_Y - 18 + Math.sin(a) * r * 0.6, tx: this.state.x, ty: GROUND_Y - 18, life: 1.2, color: Math.random() < 0.6 ? "#9ff5de" : "#ffffff" });
    }
    this.meditateTick += dt;
    if (this.meditateTick >= 1) {
      this.meditateTick -= 1;
      const s = stats(this.state);
      const L = levelIndex(this.state.realm, this.state.stage);
      const wasBottleneck = atBottleneck(this.state);
      const r = gainCultivation(heal(this.state, s.maxHp * 0.1, s.maxQi * 0.1), 3 + L * 2);
      this.state = r.state;
      if (!wasBottleneck) this.fx.float(`+${3 + L * 2}`, this.state.x, GROUND_Y - 44, "#9ff5de");
      if (r.stagesGained) {
        this.fx.burst(this.state.x, GROUND_Y - 18, 30, ["#9ff5de", "#ffffff", "#f2c55c"], 70);
        this.toast(`Your cultivation deepens: ${realmLabel(this.state.realm, this.state.stage)}.`);
      }
      if (!wasBottleneck && atBottleneck(this.state)) this.toast("Your qi has reached its peak! Press B to face the Heavenly Tribulation.");
      this.markDirty();
    }
  }

  private updateSword(dt: number): void {
    // the bonded jian trails the heroine like a loyal spirit
    if (this.mode === "battle") return;
    const tx = this.state.x - this.facing * 16;
    const ty = GROUND_Y - 40 + Math.sin(this.clock * 2.4) * 3 + this.heroY;
    this.swordX += (tx - this.swordX) * Math.min(1, dt * 5);
    this.swordY += (ty - this.swordY) * Math.min(1, dt * 5);
  }

  private onPress(code: string): void {
    if (this.mode === "dialog") {
      if (["KeyE", "Enter", "Space"].includes(code)) this.advanceDialog();
      return;
    }
    if (this.mode === "shop") {
      if (code === "Escape" || code === "KeyE") this.closeShop();
      return;
    }
    if (this.mode === "meditate") {
      if (code === "KeyB") return this.startTribulation();
      if (["KeyE", "Escape", "ArrowLeft", "ArrowRight", "KeyA", "KeyD", "Space"].includes(code)) {
        this.mode = "explore";
        this.play(this.hero, "idle");
        this.fx.clear();
        this.markDirty();
      }
      return;
    }
    if (this.mode === "battle") {
      const map: Record<string, BattleAction> = {
        Digit1: { type: "skill", skill: "strike" },
        Digit2: { type: "skill", skill: "palm" },
        Digit3: { type: "skill", skill: "swords" },
        Digit4: { type: "skill", skill: "lotus" },
        Digit5: { type: "item", item: "heal" },
        Digit6: { type: "item", item: "qi" },
        Digit0: { type: "flee" },
      };
      if (map[code]) this.battleAction(map[code]);
      return;
    }
    if (this.mode !== "explore") return;
    if ((code === "Space" || code === "ArrowUp" || code === "KeyW") && this.heroY === 0 && !this.flying) {
      this.heroVy = -170;
      this.heroY = -0.01;
      this.play(this.hero, "jump");
    } else if (code === "KeyE") this.nearby()?.act();
    else if (code === "KeyF") this.toggleFly();
    else if (code === "KeyB" && atBottleneck(this.state) && REGIONS[this.state.region].shrineX !== undefined && Math.abs(REGIONS[this.state.region].shrineX! - this.state.x) < 34) this.startTribulation();
    else if (code === "KeyH") this.takePill("heal");
    else if (code === "KeyQ") this.takePill("qi");
  }

  private openDialog(lines: DialogueLine[], then?: () => void): void {
    this.mode = "dialog";
    this.dialog = lines;
    this.dialogIndex = 0;
    this.afterDialog = then ?? null;
    this.markDirty();
  }

  // ---------------------------------------------------------------------- battle
  private beginBattle(e: WorldEnemy): void {
    this.mode = "battle";
    this.flying = false;
    this.battleEnemy = e;
    this.battle = startBattle(e.spawn.enemy, (this.seed + Math.floor(this.clock * 1000)) >>> 0);
    this.foe = { sheet: getSprite(ENEMIES[e.spawn.enemy].sprite), anim: "idle", start: this.clock };
    this.view = { heroHp: this.state.hp, heroQi: this.state.qi, enemyHp: this.battle.enemyHp };
    this.heroDx = -80;
    this.heroDxTarget = 0;
    this.foeDx = 80;
    this.foeDxTarget = 0;
    this.foeAlpha = 1;
    this.projectiles = [];
    this.fx.clear();
    this.flash = 0.8;
    this.flashColor = "#ffffff";
    const def = ENEMIES[e.spawn.enemy];
    this.log = [def.boss ? `${def.name} descends in a storm of blood qi!` : `A wild ${def.name} blocks your path!`];
    this.busy = true;
    this.play(this.hero, "walk");
    this.after(0.6, () => {
      this.play(this.hero, "idle");
      this.busy = false;
      this.markDirty();
    });
    this.markDirty();
  }

  private updateBattle(dt: number): void {
    const k = Math.min(1, dt * 10);
    this.heroDx += (this.heroDxTarget - this.heroDx) * k;
    this.foeDx += (this.foeDxTarget - this.foeDx) * k;
    this.projectiles = this.projectiles.filter((p) => this.clock - p.start < p.dur);
    // ambient battle motes
    if (Math.random() < dt * 8) this.fx.emit({ x: Math.random() * SCREEN_W, y: GROUND_Y, vy: -15 - Math.random() * 15, life: 2, color: alpha("#ffffff", 0.6) });
  }

  private heroCenter(): [number, number] {
    return [110 + this.heroDx, GROUND_Y - 20];
  }

  private foeCenter(): [number, number] {
    const d = this.battle ? ENEMIES[this.battle.enemy] : null;
    return [280 + this.foeDx, GROUND_Y - (d ? Math.min(30, d.footY / 2) : 18)];
  }

  private pushLog(line: string) {
    this.log = [...this.log.slice(-3), line];
    this.markDirty();
  }

  private playEvents(events: BattleEvent[]): void {
    let t = 0;
    const at = (delay: number, fn: () => void) => this.after(delay, fn);
    for (const ev of events) {
      const start = t;
      switch (ev.kind) {
        case "playerSkill": {
          const sk = SKILLS[ev.skill];
          at(start, () => this.pushLog(`Lin Yue uses ${sk.name} (${sk.hanzi})!`));
          if (ev.skill === "strike") {
            at(start, () => {
              this.heroDxTarget = 120;
              this.play(this.hero, "walk");
            });
            at(start + 0.25, () => this.play(this.hero, "attack"));
            at(start + 0.45, () => this.hitFoe(ev.hits[0].damage, ev.hits[0].crit, ["#ffffff", "#9ff5de"]));
            at(start + 0.8, () => {
              this.heroDxTarget = 0;
              this.play(this.hero, "idle");
            });
            t += 1.1;
          } else if (ev.skill === "palm") {
            at(start, () => this.play(this.hero, "cast"));
            at(start + 0.35, () => {
              const [hx, hy] = this.heroCenter();
              const [fx, fy] = this.foeCenter();
              this.projectiles.push({ kind: "orb", x0: hx + 16, y0: hy - 2, x1: fx, y1: fy, start: this.clock, dur: 0.35, color: "#9ff5de" });
            });
            at(start + 0.7, () => {
              this.hitFoe(ev.hits[0].damage, ev.hits[0].crit, ["#9ff5de", "#ffffff", "#f6a6c9"]);
              const [fx, fy] = this.foeCenter();
              for (let i = 0; i < 10; i++) {
                const a = (i / 10) * Math.PI * 2;
                this.fx.emit({ x: fx, y: fy, vx: Math.cos(a) * 50, vy: Math.sin(a) * 30, life: 0.8, color: "#f6a6c9", size: 2 });
              }
            });
            t += 1.2;
          } else if (ev.skill === "swords") {
            at(start, () => this.play(this.hero, "victory"));
            ev.hits.forEach((h, i) => {
              at(start + 0.3 + i * 0.28, () => {
                const [fx, fy] = this.foeCenter();
                this.projectiles.push({ kind: "sword", x0: 60 + i * 40, y0: 20, x1: fx - 4 + i * 4, y1: fy, start: this.clock, dur: 0.3, color: "#e3ecf7" });
              });
              at(start + 0.6 + i * 0.28, () => this.hitFoe(h.damage, h.crit, ["#e3ecf7", "#9ff5de", "#ffffff"]));
            });
            at(start + 1.5, () => this.play(this.hero, "idle"));
            t += 1.8;
          } else {
            at(start, () => this.play(this.hero, "cast"));
            at(start + 0.3, () => {
              const [hx] = this.heroCenter();
              for (let i = 0; i < 24; i++) this.fx.emit({ x: hx - 20 + Math.random() * 40, y: GROUND_Y, vy: -30 - Math.random() * 40, vx: (Math.random() - 0.5) * 10, life: 1.2, color: i % 3 ? "#f6a6c9" : "#9ff5de", size: 2 });
              this.view.heroHp = Math.min(this.view.heroHp + ev.heal, stats(this.state).maxHp);
              this.fx.float(`+${ev.heal}`, hx, GROUND_Y - 50, "#8aff9a", 2);
              this.markDirty();
            });
            at(start + 1.0, () => this.play(this.hero, "idle"));
            t += 1.2;
          }
          at(start + 0.2, () => {
            this.view.heroQi = Math.max(0, this.view.heroQi - sk.qi);
            this.markDirty();
          });
          break;
        }
        case "item": {
          at(start, () => {
            const [hx] = this.heroCenter();
            this.fx.burst(hx, GROUND_Y - 20, 18, ev.item === "heal" ? ["#ff8aa8", "#ffffff"] : ["#9ff5de", "#ffffff"], 45);
            this.fx.float(`+${ev.amount} ${ev.item === "heal" ? "HP" : "QI"}`, hx, GROUND_Y - 50, ev.item === "heal" ? "#8aff9a" : "#9ff5de", 1);
            if (ev.item === "heal") this.view.heroHp += ev.amount;
            else this.view.heroQi += ev.amount;
            this.pushLog(ev.item === "heal" ? "Lin Yue swallows a Healing Pill." : "Lin Yue swallows a Qi Pill.");
          });
          t += 0.8;
          break;
        }
        case "flee": {
          if (ev.success) {
            at(start, () => {
              this.pushLog("Lin Yue mounts her sword and escapes!");
              this.play(this.hero, "fly");
              this.heroDxTarget = -200;
            });
            at(start + 0.9, () => this.endBattle("fled"));
          } else {
            at(start, () => {
              this.pushLog("You failed to escape!");
              const [hx] = this.heroCenter();
              this.fx.float("FAILED", hx, GROUND_Y - 50, "#ffcf4a");
            });
          }
          t += ev.success ? 1 : 0.6;
          break;
        }
        case "enemyAttack": {
          const def = ENEMIES[this.battle!.enemy];
          at(start, () => {
            this.pushLog(`${def.name} uses ${ev.move}!`);
            if (this.foe) this.play(this.foe, "attack");
            if (ev.special && (def.id === "fox" || def.id === "patriarch")) return;
            this.foeDxTarget = -110;
          });
          if (ev.special && (def.id === "fox" || def.id === "patriarch")) {
            at(start + 0.35, () => {
              const [hx, hy] = this.heroCenter();
              const [fx, fy] = this.foeCenter();
              this.projectiles.push({ kind: def.id === "fox" ? "foxfire" : "crescent", x0: fx - 20, y0: fy - 6, x1: hx, y1: hy, start: this.clock, dur: 0.4, color: def.special.colour });
            });
          }
          at(start + 0.75, () => {
            this.view.heroHp = Math.max(0, this.view.heroHp - ev.damage);
            const [hx, hy] = this.heroCenter();
            this.play(this.hero, "hurt");
            this.fx.float(`${ev.damage}${ev.crit ? "!" : ""}`, hx, hy - 24, ev.crit ? "#ffcf4a" : "#ff6a7a", ev.crit || ev.special ? 2 : 1);
            this.fx.burst(hx, hy, ev.special ? 22 : 12, [def.special.colour, "#ffffff"], ev.special ? 80 : 50);
            this.shake = ev.special ? 1 : 0.5;
            if (ev.special) {
              this.flash = 0.6;
              this.flashColor = def.special.colour;
            }
            if (ev.drained) {
              this.view.enemyHp = Math.min(this.battle!.enemyMaxHp, this.view.enemyHp + ev.drained);
              const [fx, fy] = this.foeCenter();
              this.fx.float(`+${ev.drained}`, fx, fy - 30, "#ff8aa8");
            }
            this.markDirty();
          });
          at(start + 1.0, () => {
            this.foeDxTarget = 0;
            if (this.hero.anim === "hurt") this.play(this.hero, "idle");
          });
          t += 1.3;
          break;
        }
        case "victory": {
          at(start, () => {
            const [fx, fy] = this.foeCenter();
            this.pushLog(`Victory! +${ev.exp} cultivation, +${ev.stones} spirit stones${ev.drop ? `, found a ${ev.drop === "heal" ? "Healing" : "Qi"} Pill` : ""}.`);
            this.fx.burst(fx, fy, 50, ["#ffffff", "#f2c55c", "#9ff5de", ENEMIES[this.battle!.enemy].special.colour], 90);
            this.play(this.hero, "victory");
            this.fx.float(`+${ev.exp} EXP`, 110, GROUND_Y - 60, "#9ff5de", 1, 1.6);
            this.fx.float(`+${ev.stones} STONES`, 110, GROUND_Y - 70, "#f2c55c", 1, 1.6);
          });
          const fadeSteps = 10;
          for (let i = 1; i <= fadeSteps; i++) at(start + i * 0.06, () => (this.foeAlpha = 1 - i / fadeSteps));
          if (ev.stagesGained) at(start + 0.8, () => this.toast(`Your cultivation rises to ${realmLabel(this.state.realm, this.state.stage)}!`));
          if (this.state.bossDefeated && ENEMIES[this.battle!.enemy].boss)
            at(start + 1.2, () => this.toast("The Jade Lotus Heart is reclaimed! Return to Elder Mo."));
          at(start + 2.2, () => this.endBattle("won"));
          t += 2.3;
          break;
        }
        case "defeat": {
          at(start, () => {
            this.pushLog(`Lin Yue collapses... (lost ${ev.stonesLost} spirit stones)`);
            this.play(this.hero, "defeat");
          });
          at(start + 2.2, () => this.endBattle("lost"));
          t += 2.3;
          break;
        }
        default:
          break;
      }
    }
    at(t + 0.05, () => {
      if (this.mode === "battle") {
        this.busy = false;
        this.view = { heroHp: this.state.hp, heroQi: this.state.qi, enemyHp: this.battle?.enemyHp ?? 0 };
        this.markDirty();
      }
    });
  }

  private hitFoe(damage: number, crit: boolean, colours: string[]): void {
    if (!this.foe) return;
    const [fx, fy] = this.foeCenter();
    this.play(this.foe, "hurt");
    this.view.enemyHp = Math.max(0, this.view.enemyHp - damage);
    this.fx.float(`${damage}${crit ? "!" : ""}`, fx, fy - 26, crit ? "#ffcf4a" : "#ffffff", crit ? 2 : 1);
    if (crit) this.fx.float("CRIT", fx + 14, fy - 40, "#ffcf4a");
    this.fx.burst(fx, fy, crit ? 26 : 16, colours, crit ? 90 : 60);
    this.shake = crit ? 0.9 : 0.4;
    this.foeDxTarget = 6;
    this.after(0.2, () => (this.foeDxTarget = 0));
    this.markDirty();
  }

  private endBattle(result: "won" | "lost" | "fled"): void {
    this.mode = "explore";
    this.busy = false;
    this.projectiles = [];
    this.fx.clear();
    if (result === "won" && this.battleEnemy) {
      const key = this.battleEnemy.key;
      this.enemies = this.enemies.filter((e) => e.key !== key);
    }
    if (result === "lost") {
      this.state = reviveAtSect(this.state);
      this.enterRegion("sect", this.state.x, false);
      this.toast("You awaken at the Lotus Shrine of the Azure Cloud Sect.");
    }
    this.invulnerableUntil = this.clock + 2;
    this.battle = null;
    this.foe = null;
    this.battleEnemy = null;
    this.play(this.hero, "idle");
    this.markDirty();
  }

  // ------------------------------------------------------------------ rendering
  render(s: Surface): void {
    if (this.mode === "battle") this.renderBattle(s);
    else if (this.mode === "tribulation") this.renderTribulation(s);
    else this.renderWorld(s);
    if (this.flash > 0) s.rect(0, 0, SCREEN_W, SCREEN_H, alpha(this.flashColor, this.flash * 0.5));
  }

  private renderWorld(s: Surface): void {
    const region = REGIONS[this.state.region];
    const scene = getScene(region.scene);
    const t = this.clock;
    const cam = Math.round(this.camX);
    drawBackground(scene, s, t, cam);
    // moon gates at the region edges
    const gate = getSprite("moonGate").animations.idle;
    if (region.prev) s.sprite(frameAt(gate, t), 4 - cam, GROUND_Y - 58);
    if (region.next) s.sprite(frameAt(gate, t), region.width - 52 - cam, GROUND_Y - 58);
    if (region.shrineX !== undefined) s.sprite(frameAt(getSprite("shrine").animations.idle, t), region.shrineX - 20 - cam, GROUND_Y - 51);
    const herb = getSprite("herb").animations.idle;
    for (const hx of this.herbs) s.sprite(frameAt(herb, t + hx), hx - 8 - cam, GROUND_Y - 17);
    for (const npc of region.npcs) {
      const sheet = getSprite(npc.sprite);
      const talking = this.mode === "dialog" && this.dialog[this.dialogIndex]?.speaker.includes(npc.id === "elder" ? "Mo" : "Qing");
      const anim = sheet.animations[talking ? "talk" : "idle"];
      s.sprite(frameAt(anim, t + npc.x), npc.x - 24 - cam, GROUND_Y - 47, this.state.x < npc.x);
      if (Math.abs(npc.x - this.state.x) < 60) {
        const name = npc.id === "elder" ? "ELDER MO" : "SISTER QING";
        drawText(s, name, npc.x - cam - textWidth(name) / 2, GROUND_Y - 58, "#fff6dc", { outline: "#1a1226" });
      }
    }
    for (const e of this.enemies) {
      const d = ENEMIES[e.spawn.enemy];
      const sheet = e.actor.sheet;
      const anim = sheet.animations[e.spawn.range > 0 && sheet.animations.run ? "run" : "idle"];
      s.sprite(frameAt(anim, t + e.actor.start), e.x - sheet.width / 2 - cam, GROUND_Y - d.footY, e.dir > 0);
      if (d.boss) {
        const label = "PATRIARCH XUE";
        drawText(s, label, e.x - cam - textWidth(label) / 2, GROUND_Y - d.footY - 10, "#ff6070", { outline: "#1a0610" });
      }
    }
    // heroine & bonded sword
    const swordFrame = frameAt(getSprite("spiritSword").animations.hover, t);
    if (!this.flying && this.mode !== "meditate") s.sprite(swordFrame, this.swordX - 7 - cam, this.swordY);
    if (this.mode === "meditate") {
      const r = 22 + Math.sin(t * 2) * 2;
      sRing(s, this.state.x - cam, GROUND_Y - 18, r, alpha("#9ff5de", 0.45));
      sRing(s, this.state.x - cam, GROUND_Y - 18, r * 0.7, alpha("#ffffff", 0.25));
      // sword orbits during meditation
      const a = t * 1.5;
      s.sprite(swordFrame, this.state.x - cam + Math.cos(a) * 26 - 7, GROUND_Y - 34 + Math.sin(a) * 8);
    }
    const heroFrame = this.actorFrame(this.hero);
    const hover = this.flying ? -8 + Math.sin(t * 3) * 2 : 0;
    s.sprite(heroFrame, this.state.x - HERO_CX - cam, GROUND_Y - HERO_FOOT + Math.round(this.heroY + hover), this.facing < 0);
    this.fx.draw(s, cam);
    drawForeground(scene, s, t, cam);
  }

  private renderBattle(s: Surface): void {
    const region = REGIONS[this.state.region];
    const scene = getScene(region.scene);
    const t = this.clock;
    const cam = Math.round(this.camX);
    drawBackground(scene, s, t, cam);
    // dramatic letterbox + vignette
    s.rect(0, 0, SCREEN_W, SCREEN_H, alpha("#0a0612", 0.35));
    s.rect(0, 0, SCREEN_W, 14, "#0a0612");
    s.rect(0, SCREEN_H - 14, SCREEN_W, 14, "#0a0612");
    // battle circle under each fighter
    const [hx] = this.heroCenter();
    const [fx] = this.foeCenter();
    for (const [x, c] of [
      [hx, "#9ff5de"],
      [fx, ENEMIES[this.battle!.enemy].special.colour],
    ] as [number, string][]) {
      for (let a = 0; a < 40; a++) {
        const ang = (a / 40) * Math.PI * 2 + t;
        s.px(x + Math.cos(ang) * 22, GROUND_Y + 1 + Math.sin(ang) * 4, alpha(c, 0.6));
      }
    }
    if (this.foe && this.battle) {
      const d = ENEMIES[this.battle.enemy];
      const frame = this.actorFrame(this.foe);
      s.sprite(frame, fx - this.foe.sheet.width / 2, GROUND_Y - d.footY, false, this.foeAlpha);
      if (d.boss) {
        for (let i = 0; i < 3; i++) s.px(fx - 20 + Math.random() * 40, GROUND_Y - 50 + Math.random() * 50, alpha("#ff2040", 0.8));
      }
    }
    s.sprite(this.actorFrame(this.hero), hx - HERO_CX, GROUND_Y - HERO_FOOT);
    this.drawProjectiles(s);
    this.fx.draw(s, 0);
    drawForeground(scene, s, t, cam);
  }

  private drawProjectiles(s: Surface): void {
    for (const p of this.projectiles) {
      const k = Math.min(1, (this.clock - p.start) / p.dur);
      const x = p.x0 + (p.x1 - p.x0) * k;
      const y = p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * (p.kind === "foxfire" ? 14 : 0);
      if (p.kind === "orb" || p.kind === "foxfire") {
        sCircle(s, x, y, 6, alpha(p.color, 0.3));
        sCircle(s, x, y, 4, alpha(p.color, 0.8));
        sCircle(s, x, y, 2, "#ffffff");
        for (let i = 1; i < 6; i++) s.px(x - (p.x1 - p.x0) * 0.04 * i, y + Math.sin(this.clock * 20 + i) * 2, alpha(p.color, 0.8 - i * 0.12));
      } else if (p.kind === "sword") {
        const dx = p.x1 - p.x0;
        const dy = p.y1 - p.y0;
        const len = Math.hypot(dx, dy);
        const ux = dx / len;
        const uy = dy / len;
        sLine(s, x - ux * 22, y - uy * 22, x - ux * 6, y - uy * 6, alpha("#9ff5de", 0.4));
        sLine(s, x - ux * 6, y - uy * 6, x + ux * 8, y + uy * 8, "#e3ecf7");
        sLine(s, x - ux * 6 + 1, y - uy * 6, x + ux * 7 + 1, y + uy * 7, "#93a8c6");
        sLine(s, x - ux * 6 - uy * 3, y - uy * 6 + ux * 3, x - ux * 6 + uy * 3, y - uy * 6 - ux * 3, "#f2c55c");
        s.px(x + ux * 9, y + uy * 9, "#ffffff");
      } else {
        // blood moon crescent
        for (let a = -1.2; a <= 1.2; a += 0.08) {
          s.px(x - Math.cos(a) * 12, y + Math.sin(a) * 16, p.color);
          s.px(x - Math.cos(a) * 10, y + Math.sin(a) * 14, alpha("#ffffff", 0.8));
          s.px(x - Math.cos(a) * 14, y + Math.sin(a) * 17, alpha(p.color, 0.4));
        }
      }
    }
  }

  private renderTribulation(s: Surface): void {
    const scene = getScene("peak");
    const t = this.clock;
    drawBackground(scene, s, t, 0);
    const cx = SCREEN_W / 2;
    const elapsed = t - this.tribStart;
    // gathering qi pillar
    const charge = Math.min(1, elapsed / 5.6);
    sRing(s, cx, GROUND_Y - 18, 26 + Math.sin(t * 4) * 2, alpha("#b8a4ff", 0.3 + charge * 0.4));
    if (Math.random() < 0.6) this.fx.emit({ x: cx + (Math.random() - 0.5) * 120, y: GROUND_Y - Math.random() * 80, tx: cx, ty: GROUND_Y - 18, life: 1, color: Math.random() < 0.5 ? "#b8a4ff" : "#ffffff" });
    s.sprite(frameAt(getSprite("spiritSword").animations.hover, t), cx + Math.cos(t * 2) * 30 - 7, GROUND_Y - 44 + Math.sin(t * 2) * 8);
    s.sprite(this.actorFrame(this.hero), cx - HERO_CX, GROUND_Y - HERO_FOOT);
    // lightning bolts
    for (const b of this.bolts) {
      const age = t - b.at;
      if (age > 0.45) continue;
      let x = b.x + Math.sin(b.at * 13) * 40;
      let y = 20;
      let i = 0;
      while (y < GROUND_Y - 30) {
        const nx = x + Math.sin(b.at * 7 + i * 3.1) * 10 + (b.x - x) * 0.25;
        const ny = y + 12;
        sLine(s, x, y, nx, ny, age < 0.15 ? "#ffffff" : alpha("#ffffff", 0.6));
        sLine(s, x + 1, y, nx + 1, ny, alpha("#b8a4ff", 0.8));
        sLine(s, x - 1, y, nx - 1, ny, alpha("#b8a4ff", 0.5));
        x = nx;
        y = ny;
        i++;
      }
      sCircle(s, b.x, GROUND_Y - 22, 18 * (1 - age * 2), alpha("#ffffff", 0.5));
    }
    if (elapsed > 5.6) {
      const k = Math.min(1, (elapsed - 5.6) / 1.5);
      const c = REALMS[this.state.realm].colour;
      for (let r = 0; r < 3; r++) sRing(s, cx, GROUND_Y - 22, 10 + k * 120 + r * 12, alpha(c, (1 - k) * 0.8));
      s.rect(cx - 2, 0, 4, GROUND_Y - 20, alpha(c, (1 - k) * 0.6));
    }
    this.fx.draw(s, 0);
    drawForeground(scene, s, t, 0);
  }

  private actorFrame(a: Actor) {
    const anim = a.sheet.animations[a.anim] ?? a.sheet.animations.idle;
    const elapsed = this.clock - a.start;
    if (!anim.loop && NON_HOLD_RETURN.has(a.anim) && elapsed > anim.frames.length / anim.fps + 0.25 && a.anim !== "jump") {
      return frameAt(a.sheet.animations.idle ?? anim, this.clock);
    }
    return frameAt(anim, elapsed);
  }

  private play(a: Actor, anim: string): void {
    if (!a.sheet.animations[anim]) return;
    a.anim = anim;
    a.start = this.clock;
  }

  private after(delay: number, fn: () => void): void {
    this.timers.push({ at: this.clock + delay, fn });
  }

  private toast(text: string): void {
    this.toasts = [...this.toasts.slice(-2), { id: ++this.toastSeq, text, until: this.clock + 4 }];
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty = true;
  }

  snapshot(): UiSnapshot {
    const s = stats(this.state);
    const region = REGIONS[this.state.region];
    const d = this.battle ? ENEMIES[this.battle.enemy] : null;
    return {
      mode: this.mode,
      state: { ...this.state, pills: { ...this.state.pills }, flags: { ...this.state.flags } },
      stats: s,
      realm: realmLabel(this.state.realm, this.state.stage),
      realmColour: REALMS[this.state.realm].colour,
      cultivationNeeded: cultivationNeeded(this.state.realm, this.state.stage),
      bottleneck: atBottleneck(this.state),
      regionName: this.mode === "tribulation" ? "Heavenly Tribulation Peak" : region.name,
      prompt: this.mode === "explore" ? this.prompt : null,
      flying: this.flying,
      dialog: this.mode === "dialog" && this.dialog[this.dialogIndex] ? { ...this.dialog[this.dialogIndex], index: this.dialogIndex, total: this.dialog.length } : null,
      battle:
        this.battle && d
          ? {
              enemy: d.id,
              enemyName: d.name,
              enemyHp: Math.round(this.view.enemyHp),
              enemyMax: this.battle.enemyMaxHp,
              heroHp: Math.round(this.view.heroHp),
              heroQi: Math.round(this.view.heroQi),
              busy: this.busy,
              log: this.log,
              boss: !!d.boss,
              turn: this.battle.turn,
            }
          : null,
      tribulation: this.tribStage,
      toasts: this.toasts.map(({ id, text }) => ({ id, text })),
    };
  }
}
