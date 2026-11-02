import { alpha } from "../pixel/color";
import { hash2 } from "../pixel/noise";
import type { Surface } from "../pixel/surface";
import { sCircle, sLine, sRing } from "../pixel/surface";
import { isoX, isoY } from "../iso/projection";
import type { PropId } from "../art/props";
import type { AnimId } from "../art/characters";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { openingWound, resolveTurn, woundLine, SKILLS, startBattle, type BattleAction, type BattleEvent, type BattleState } from "../engine/battle";
import { realmLabel } from "../engine/realms";
import { stats, type GameState } from "../engine/state";
import { getArea, moodOf, type AreaDef, type AreaId } from "../world/areas";
import { LIQUID, TileMap, type TileKind } from "../world/tilemap";
import { World, type Actor } from "./world";

/**
 * Turn-based battles staged on a small isometric arena themed after the
 * current region. The pure engine resolves a round; this class plays the
 * resulting events back as a timeline of animations and effects.
 */

interface Projectile {
  kind: "orb" | "sword" | "crescent" | "foxfire" | "venom" | "dragon" | "feather" | "star";
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  start: number;
  dur: number;
  color: string;
  arc?: number;
}

interface Bolt {
  x: number;
  y: number;
  at: number;
  color: string;
}

const ARENA: Record<AreaId, { ground: TileKind; ring: TileKind; edge: TileKind; props: PropId[] }> = {
  sect: { ground: "plaza", ring: "grass", edge: "meadow", props: ["cherry", "lantern", "pine", "banner"] },
  village: { ground: "dirt", ring: "grass", edge: "meadow", props: ["maple", "tallgrass", "fence", "redlantern"] },
  bamboo: { ground: "leaf", ring: "moss", edge: "leaf", props: ["bamboo", "bamboo", "rock", "bamboo"] },
  lake: { ground: "sand", ring: "grass", edge: "water", props: ["willow", "reeds", "lantern", "reeds"] },
  valley: { ground: "redrock", ring: "ash", edge: "lava", props: ["spikes", "brazier", "deadtree", "bones"] },
  peak: { ground: "marble", ring: "snow", edge: "snow", props: ["crystal", "pine", "crystal", "rock"] },
  marsh: { ground: "moss", ring: "grass", edge: "water", props: ["willow", "reeds", "deadtree", "wisps"] },
  terraces: { ground: "stairs", ring: "meadow", edge: "meadow", props: ["teabush", "cherry", "teabush", "lantern"] },
  desert: { ground: "sand", ring: "redrock", edge: "sand", props: ["palm", "boulder", "bones", "karst"] },
  harbor: { ground: "plaza", ring: "wood", edge: "water", props: ["barrels", "redlantern", "fishrack", "lantern"] },
  frost: { ground: "marble", ring: "snow", edge: "snow", props: ["snowpine", "crystal", "snowpine", "prayerflags"] },
};

/** Fights underground are staged on a ledge of cave floor hanging in the dark. */
const CAVE_ARENA = { ground: "cave" as TileKind, ring: "cave" as TileKind, edge: "rockwall" as TileKind, props: ["crystal", "torch", "glowshroom", "stalagmite"] as PropId[] };

function buildArena(area: AreaId, underground = false, flags: Record<string, boolean> = {}): AreaDef {
  // the arena is under the sky the story has left over the land (the blood moon set, or spreading)
  const base = moodOf(getArea(area), flags);
  const th = underground ? CAVE_ARENA : ARENA[area];
  const m = new TileMap(11, 9, th.edge, LIQUID[th.edge] ? 0 : 1);
  m.rect(1, 1, 9, 7, th.ring, 1);
  m.rect(2, 2, 8, 6, th.ground, 1);
  const props = [
    { id: th.props[0], i: 1, j: 1 },
    { id: th.props[1], i: 9, j: 1 },
    { id: th.props[2], i: 1, j: 7 },
    { id: th.props[3], i: 6, j: 1 },
    { id: th.props[0], i: 9, j: 5 },
    { id: th.props[2], i: 3, j: 1 },
  ];
  if (underground) {
    // rock behind, the drop into the dark in front
    m.rect(0, 8, 10, 8, "void", 0);
    m.rect(10, 0, 10, 8, "void", 0);
    m.rect(0, 0, 9, 0, "rockwall", 6);
    m.rect(0, 0, 0, 7, "rockwall", 6);
    return { ...base, id: area, map: m, base: -4, floating: false, sky: "cave", weather: "drips", night: 0.6, tint: "#2a8a8a", props, npcs: [], enemies: [], interacts: [], critters: [] };
  }
  return { ...base, id: area, map: m, base: -1, floating: false, props, npcs: [], enemies: [], interacts: [], critters: [] };
}

const HERO_POS: [number, number] = [3.6, 5.4];
const FOE_POS: [number, number] = [6.6, 2.4];

export class BattleScene {
  readonly world: World;
  readonly hero: Actor;
  readonly foe: Actor;
  battle: BattleState;
  busy = true;
  log: string[];
  view: { heroHp: number; heroQi: number; enemyHp: number };
  result: "won" | "lost" | "fled" | null = null;
  done = false;
  clock = 0;
  shake = 0;
  flash = 0;
  flashColor = "#ffffff";
  private projectiles: Projectile[] = [];
  private bolts: Bolt[] = [];
  private timers: { at: number; fn: () => void }[] = [];
  private foeAlpha = 1;
  private heroAt: [number, number] = [...HERO_POS];
  private foeAt: [number, number] = [...FOE_POS];
  private heroGoal: [number, number] = [...HERO_POS];
  private foeGoal: [number, number] = [...FOE_POS];
  /** Name of the last levelled realm, set when a victory raises the stage. */
  levelUp: string | null = null;

  constructor(
    readonly area: AreaId,
    readonly enemy: EnemyId,
    readonly enemyKey: string,
    state: GameState,
    seed: number,
    underground = false,
  ) {
    this.world = new World(buildArena(area, underground, state.flags), { x: HERO_POS[0] - 2.5, y: HERO_POS[1] + 1.5, dir: 3 }, {}, []);
    this.hero = this.world.hero;
    this.hero.speed = 5;
    const def = ENEMIES[enemy];
    this.foe = { ...this.hero, key: "foe", kind: "enemy", char: def.sprite, x: FOE_POS[0] + 2, y: FOE_POS[1] - 1.5, dir: 13, anim: "idle", idleAnim: "idle", enemy, speed: 5, target: null, holdUntil: undefined, emote: undefined, flying: false };
    this.world.actors.push(this.foe);
    const wound = openingWound(enemy, state);
    this.battle = startBattle(enemy, seed >>> 0, wound);
    this.view = { heroHp: state.hp, heroQi: state.qi, enemyHp: this.battle.enemyHp };
    this.log = [def.intro ?? (def.boss ? `${def.name} descends in a storm of killing intent!` : `A ${def.name} bars your way!`), ...(wound ? [woundLine(enemy, state)!] : [])];
    this.flash = 0.8;
    this.world.setAnim(this.hero, "walk", 0);
    this.world.setAnim(this.foe, def.sprite === "jiangshi" ? "hop" : "walk", 0);
    this.after(0.7, () => {
      this.world.setAnim(this.hero, "idle", this.clock);
      this.world.setAnim(this.foe, "idle", this.clock);
      this.hero.dir = 3;
      this.foe.dir = 13;
      this.busy = false;
    });
  }

  private after(delay: number, fn: () => void): void {
    this.timers.push({ at: this.clock + delay, fn });
  }

  private pushLog(line: string): void {
    this.log = [...this.log.slice(-3), line];
  }

  private center(which: "hero" | "foe"): [number, number] {
    const a = which === "hero" ? this.hero : this.foe;
    const tall = which === "foe" && ENEMIES[this.enemy].boss ? 22 : 14;
    return [isoX(a.x, a.y), isoY(a.x, a.y, a.z) - tall];
  }

  /** Resolve one round. Returns the new game state, or a rejection reason. */
  act(state: GameState, action: BattleAction): { state: GameState } | { rejected: string } {
    if (this.busy || this.result) return { rejected: "Wait for your opening…" };
    const res = resolveTurn(state, this.battle, action);
    if (res.events.length === 1 && res.events[0].kind === "rejected") return { rejected: res.events[0].reason };
    this.battle = res.battle;
    this.busy = true;
    this.playEvents(res.events, res.game);
    return { state: res.game };
  }

  update(dt: number): void {
    this.clock += dt;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt * 3);
    const due = this.timers.filter((t) => t.at <= this.clock).sort((a, b) => a.at - b.at);
    if (due.length) {
      this.timers = this.timers.filter((t) => t.at > this.clock);
      for (const t of due) t.fn();
    }
    // glide fighters toward their goals (dash in, recoil, return)
    for (const [a, at, goal] of [
      [this.hero, this.heroAt, this.heroGoal],
      [this.foe, this.foeAt, this.foeGoal],
    ] as const) {
      if (!a.target) {
        const k = Math.min(1, dt * 9);
        at[0] += (goal[0] - at[0]) * k;
        at[1] += (goal[1] - at[1]) * k;
        if (this.clock > 0.7) {
          a.x = at[0];
          a.y = at[1];
        }
      }
    }
    if (this.clock < 0.7) {
      const k = Math.min(1, this.clock / 0.6);
      this.hero.x = HERO_POS[0] - 2.5 * (1 - k);
      this.hero.y = HERO_POS[1] + 1.5 * (1 - k);
      this.foe.x = FOE_POS[0] + 2 * (1 - k);
      this.foe.y = FOE_POS[1] - 1.5 * (1 - k);
    }
    this.foe.opacity = this.foeAlpha;
    this.projectiles = this.projectiles.filter((p) => this.clock - p.start < p.dur);
    this.bolts = this.bolts.filter((b) => this.clock - b.at < 0.5);
    this.world.update(dt, this.clock, true);
    if (Math.random() < dt * 6) {
      const [cx, cy] = [isoX(5, 4), isoY(5, 4, 1)];
      this.world.fx.emit({ x: cx + (Math.random() - 0.5) * 160, y: cy + 20, vy: -12 - Math.random() * 12, life: 2, color: alpha("#ffffff", 0.5) });
    }
  }

  render(s: Surface): void {
    const [mx, my] = [(HERO_POS[0] + FOE_POS[0]) / 2, (HERO_POS[1] + FOE_POS[1]) / 2];
    this.world.updateCamera(s.width, s.height, 0, [mx, my, 1]);
    this.world.camY += Math.round(s.height * 0.04);
    const t = this.clock;
    // battle circles under the fighters
    this.world.render(s, t);
    const cx = Math.round(this.world.camX);
    const cy = Math.round(this.world.camY);
    for (const [a, c] of [
      [this.hero, "#9ff5de"],
      [this.foe, ENEMIES[this.enemy].special.colour],
    ] as const) {
      const gx = isoX(a.x, a.y) + cx;
      const gy = isoY(a.x, a.y, 1) + cy;
      for (let k = 0; k < 36; k++) {
        const ang = (k / 36) * Math.PI * 2 + t * (a === this.hero ? 1 : -1);
        if (k % 3 === 0) continue;
        s.px(gx + Math.cos(ang) * 16, gy + Math.sin(ang) * 8, alpha(c, 0.55));
      }
    }
    if (ENEMIES[this.enemy].boss) {
      const [fx, fy] = this.center("foe");
      for (let i = 0; i < 4; i++) s.px(fx + cx + (hash2(i, Math.floor(t * 12), 2) - 0.5) * 34, fy + cy + (hash2(i, Math.floor(t * 12), 3) - 0.3) * 40, alpha(ENEMIES[this.enemy].special.colour, 0.85));
    }
    this.drawProjectiles(s, cx, cy);
    this.drawBolts(s, cx, cy);
    // letterbox
    const bar = Math.max(8, Math.round(s.height * 0.05));
    s.rect(0, 0, s.width, bar, "#0a0612");
    s.rect(0, s.height - bar, s.width, bar, "#0a0612");
  }

  // ------------------------------------------------------------------ timeline
  private hitFoe(damage: number, crit: boolean, colours: string[]): void {
    const [fx, fy] = this.center("foe");
    this.world.setAnim(this.foe, "hurt", this.clock, true);
    this.view.enemyHp = Math.max(0, this.view.enemyHp - damage);
    this.world.fx.float(`${damage}${crit ? "!" : ""}`, fx, fy - 18, crit ? "#ffcf4a" : "#ffffff", crit ? 2 : 1);
    if (crit) this.world.fx.float("CRIT", fx + 14, fy - 32, "#ffcf4a");
    this.world.fx.burst(fx, fy, crit ? 26 : 16, colours, crit ? 90 : 60);
    this.shake = crit ? 0.9 : 0.45;
    this.foeGoal = [FOE_POS[0] + 0.35, FOE_POS[1] - 0.35];
    this.after(0.2, () => (this.foeGoal = [...FOE_POS]));
  }

  private playEvents(events: BattleEvent[], after: GameState): void {
    let t = 0;
    const at = (delay: number, fn: () => void) => this.after(delay, fn);
    const def = ENEMIES[this.enemy];
    for (const ev of events) {
      const start = t;
      switch (ev.kind) {
        case "playerSkill": {
          const sk = SKILLS[ev.skill];
          at(start, () => this.pushLog(`Lin Yue uses ${sk.name} (${sk.hanzi})!`));
          at(start + 0.15, () => (this.view.heroQi = Math.max(0, this.view.heroQi - sk.qi)));
          t += this.playSkill(ev, start, after);
          break;
        }
        case "item": {
          at(start, () => {
            const [hx, hy] = this.center("hero");
            this.world.fx.burst(hx, hy, 18, ev.item === "heal" ? ["#ff8aa8", "#ffffff"] : ["#9ff5de", "#ffffff"], 45);
            this.world.fx.float(`+${ev.amount} ${ev.item === "heal" ? "HP" : "QI"}`, hx, hy - 24, ev.item === "heal" ? "#8aff9a" : "#9ff5de");
            if (ev.item === "heal") this.view.heroHp += ev.amount;
            else this.view.heroQi += ev.amount;
            this.pushLog(ev.item === "heal" ? "Lin Yue swallows a Healing Pill." : "Lin Yue swallows a Qi Gathering Pill.");
          });
          t += 0.8;
          break;
        }
        case "flee": {
          if (ev.success) {
            at(start, () => {
              this.pushLog("Lin Yue leaps onto her sword and escapes!");
              this.hero.flying = true;
              this.world.setAnim(this.hero, "fly", this.clock);
              this.heroGoal = [HERO_POS[0] - 4, HERO_POS[1] + 3];
            });
            at(start + 0.9, () => this.finish("fled"));
          } else
            at(start, () => {
              this.pushLog("You failed to escape!");
              const [hx, hy] = this.center("hero");
              this.world.fx.float("FAILED", hx, hy - 24, "#ffcf4a");
            });
          t += ev.success ? 1 : 0.6;
          break;
        }
        case "enemyAttack": {
          const ranged = ev.special && def.id !== "wolf" && def.id !== "jiangshi";
          at(start, () => {
            this.pushLog(`${def.name} uses ${ev.move}!`);
            this.world.setAnim(this.foe, "attack", this.clock, true);
            if (!ranged) this.foeGoal = [HERO_POS[0] + 1.1, HERO_POS[1] - 0.8];
          });
          if (ranged)
            at(start + 0.3, () => {
              const [hx, hy] = this.center("hero");
              const [fx, fy] = this.center("foe");
              const kind = def.id === "fox" ? "foxfire" : def.id === "serpent" || def.id === "serpentKing" ? "venom" : def.id === "patriarch" || def.id === "cultist" ? "crescent" : "orb";
              this.projectiles.push({ kind, x0: fx - 12, y0: fy - 4, x1: hx, y1: hy, start: this.clock, dur: 0.42, color: def.special.colour });
            });
          at(start + 0.72, () => {
            this.view.heroHp = Math.max(0, this.view.heroHp - ev.damage);
            const [hx, hy] = this.center("hero");
            this.world.setAnim(this.hero, "hurt", this.clock, true);
            this.world.fx.float(`${ev.damage}${ev.crit ? "!" : ""}`, hx, hy - 18, ev.crit ? "#ffcf4a" : "#ff6a7a", ev.crit || ev.special ? 2 : 1);
            this.world.fx.burst(hx, hy, ev.special ? 22 : 12, [def.special.colour, "#ffffff"], ev.special ? 80 : 50);
            this.shake = ev.special ? 1 : 0.5;
            this.heroGoal = [HERO_POS[0] - 0.35, HERO_POS[1] + 0.35];
            if (ev.special) {
              this.flash = 0.6;
              this.flashColor = def.special.colour;
            }
            if (ev.drained) {
              this.view.enemyHp = Math.min(this.battle.enemyMaxHp, this.view.enemyHp + ev.drained);
              const [fx, fy] = this.center("foe");
              this.world.fx.float(`+${ev.drained}`, fx, fy - 22, "#ff8aa8");
            }
          });
          at(start + 1, () => {
            this.foeGoal = [...FOE_POS];
            this.heroGoal = [...HERO_POS];
          });
          t += 1.3;
          break;
        }
        case "victory": {
          at(start, () => {
            const [fx, fy] = this.center("foe");
            this.pushLog(`Victory! +${ev.exp} cultivation, +${ev.stones} spirit stones${ev.drop ? `, found a ${ev.drop === "heal" ? "Healing" : "Qi"} Pill` : ""}.`);
            this.world.fx.burst(fx, fy, 50, ["#ffffff", "#f2c55c", "#9ff5de", def.special.colour], 90);
            this.world.setAnim(this.hero, "victory", this.clock);
            const [hx, hy] = this.center("hero");
            this.world.fx.float(`+${ev.exp} EXP`, hx, hy - 34, "#9ff5de", 1, 1.6);
            if (ev.stones) this.world.fx.float(`+${ev.stones} STONES`, hx, hy - 44, "#f2c55c", 1, 1.6);
            if (ev.stagesGained) this.levelUp = realmLabel(after.realm, after.stage);
          });
          for (let i = 1; i <= 10; i++) at(start + i * 0.06, () => (this.foeAlpha = 1 - i / 10));
          at(start + 2.1, () => this.finish("won"));
          t += 2.2;
          break;
        }
        case "defeat": {
          at(start, () => {
            this.pushLog(ev.stonesLost ? `Lin Yue collapses… (lost ${ev.stonesLost} spirit stones)` : "Lin Yue yields the duel.");
            this.world.setAnim(this.hero, "defeat", this.clock, true);
            this.hero.holdUntil = Infinity;
          });
          at(start + 2.2, () => this.finish("lost"));
          t += 2.3;
          break;
        }
        default:
          break;
      }
    }
    at(t + 0.05, () => {
      if (!this.result) {
        this.busy = false;
        this.view = { heroHp: after.hp, heroQi: after.qi, enemyHp: this.battle.enemyHp };
      }
    });
  }

  private finish(result: "won" | "lost" | "fled"): void {
    this.result = result;
    this.done = true;
  }

  // ------------------------------------------------------------------ effects
  /**
   * Each technique's own choreography: the move she makes, what flies, what
   * lands and how the screen answers it. Returns how long it takes.
   */
  private playSkill(ev: Extract<BattleEvent, { kind: "playerSkill" }>, start: number, after: GameState): number {
    const at = (delay: number, fn: () => void) => this.after(delay, fn);
    const hero = (anim: AnimId, hold = true) => this.world.setAnim(this.hero, anim, this.clock, hold);
    const home = (when: number) =>
      at(when, () => {
        this.heroGoal = [...HERO_POS];
        this.hero.flying = false;
        this.world.setAnim(this.hero, "idle", this.clock);
      });
    const fx = this.world.fx;
    const ring = (x: number, y: number, n: number, speed: number, color: string, life = 0.7, size = 2) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        fx.emit({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed * 0.5, life, color, size });
      }
    };
    switch (ev.skill) {
      case "strike": {
        // a low dash with a wind-trail, the cut, and a crescent of light where the blade passed
        at(start, () => {
          this.heroGoal = [FOE_POS[0] - 1.1, FOE_POS[1] + 0.8];
          hero("dash", false);
          const [hx, hy] = this.center("hero");
          for (let i = 0; i < 10; i++) fx.emit({ x: hx - 6 + i, y: hy + 12, vx: -40 - i * 4, vy: -6, life: 0.4, color: i % 2 ? "#e8f8f0" : "#9ff5de", size: 1 });
        });
        at(start + 0.22, () => hero("attack"));
        at(start + 0.36, () => {
          const [fx0, fy0] = this.center("foe");
          this.projectiles.push({ kind: "crescent", x0: fx0 - 10, y0: fy0, x1: fx0 + 6, y1: fy0 - 2, start: this.clock, dur: 0.18, color: "#e3ecf7" });
        });
        at(start + 0.42, () => this.hitFoe(ev.hits[0].damage, ev.hits[0].crit, ["#ffffff", "#9ff5de"]));
        home(0.75 + start);
        return 1.05;
      }
      case "palm": {
        // drawn back to the hip, the palm driven out, a lotus of jade qi blooming on the foe
        at(start, () => hero("palmstrike"));
        at(start + 0.3, () => {
          const [hx, hy] = this.center("hero");
          const [fx0, fy0] = this.center("foe");
          this.projectiles.push({ kind: "orb", x0: hx + 10, y0: hy - 2, x1: fx0, y1: fy0, start: this.clock, dur: 0.32, color: "#9ff5de" });
          ring(hx + 10, hy - 2, 8, 30, "#9ff5de", 0.4, 1);
        });
        at(start + 0.64, () => {
          this.hitFoe(ev.hits[0].damage, ev.hits[0].crit, ["#9ff5de", "#ffffff", "#f6a6c9"]);
          const [fx0, fy0] = this.center("foe");
          ring(fx0, fy0, 12, 55, "#f6a6c9", 0.8);
          ring(fx0, fy0, 8, 30, "#ffffff", 0.5, 1);
        });
        home(start + 1.0);
        return 1.2;
      }
      case "swords": {
        // two fingers raised: the swords answer out of the sky, one after another, each in its own colour of qi
        at(start, () => hero("swordcall"));
        const cols = ["#e3ecf7", "#9ff5de", "#f2c55c", "#c8b0ff"];
        ev.hits.forEach((h, i) => {
          at(start + 0.3 + i * 0.24, () => {
            const [fx0, fy0] = this.center("foe");
            this.projectiles.push({ kind: "sword", x0: fx0 - 70 + i * 50, y0: fy0 - 90, x1: fx0 - 4 + i * 4, y1: fy0, start: this.clock, dur: 0.3, color: cols[i % cols.length] });
          });
          at(start + 0.6 + i * 0.24, () => this.hitFoe(h.damage, h.crit, [cols[i % cols.length], "#9ff5de", "#ffffff"]));
        });
        home(start + 0.6 + ev.hits.length * 0.24 + 0.3);
        return 0.9 + ev.hits.length * 0.24 + 0.2;
      }
      case "thunder": {
        // the sword thrust at the sky, the first bolt down onto the blade, the rest down onto the foe
        at(start, () => hero("thundercall"));
        at(start + 0.35, () => {
          const [hx, hy] = this.center("hero");
          this.bolts.push({ x: hx, y: hy - 20, at: this.clock, color: "#c8b0ff" });
          this.flash = 0.4;
          this.flashColor = "#e8e0ff";
        });
        ev.hits.forEach((h, i) => {
          at(start + 0.6 + i * 0.4, () => {
            const [fx0, fy0] = this.center("foe");
            this.bolts.push({ x: fx0, y: fy0 + 10, at: this.clock, color: "#c8b0ff" });
            this.flash = 0.7;
            this.flashColor = "#e8e0ff";
            this.hitFoe(h.damage, h.crit, ["#ffffff", "#c8b0ff", "#9ff5de"]);
          });
        });
        home(start + 0.6 + ev.hits.length * 0.4 + 0.2);
        return 0.9 + ev.hits.length * 0.4;
      }
      case "whirlwind": {
        // she springs up beside the foe and spins through it, four cuts in one turn, and comes down on one knee
        at(start, () => {
          this.heroGoal = [FOE_POS[0] - 0.9, FOE_POS[1] + 0.6];
          hero("dash", false);
        });
        at(start + 0.2, () => hero("whirl"));
        ev.hits.forEach((h, i) => {
          at(start + 0.3 + i * 0.13, () => {
            const [fx0, fy0] = this.center("foe");
            const a = i * 1.6;
            this.projectiles.push({ kind: "crescent", x0: fx0 + Math.cos(a) * 14, y0: fy0 + Math.sin(a) * 8, x1: fx0 - Math.cos(a) * 8, y1: fy0 - Math.sin(a) * 6, start: this.clock, dur: 0.12, color: "#e8f8f0" });
            this.hitFoe(h.damage, h.crit, ["#e8f8f0", "#9ff5de", "#ffffff"]);
            ring(fx0, fy0 + 10, 10, 50, "#e8f8f0", 0.5, 1);
          });
        });
        home(start + 0.3 + ev.hits.length * 0.13 + 0.4);
        return 1.0 + ev.hits.length * 0.13;
      }
      case "dragon": {
        // the lunge, and a dragon of jade sword qi pours off the point, coiling across to the foe
        at(start, () => hero("thrust"));
        at(start + 0.28, () => {
          const [hx, hy] = this.center("hero");
          const [fx0, fy0] = this.center("foe");
          this.projectiles.push({ kind: "dragon", x0: hx + 14, y0: hy - 4, x1: fx0, y1: fy0, start: this.clock, dur: 0.5, color: "#4ac8b0" });
        });
        at(start + 0.8, () => {
          this.hitFoe(ev.hits[0].damage, ev.hits[0].crit, ["#4ac8b0", "#9ff5de", "#ffffff"]);
          const [fx0, fy0] = this.center("foe");
          ring(fx0, fy0, 16, 70, "#4ac8b0", 0.9);
          this.flash = 0.35;
          this.flashColor = "#9ff5de";
        });
        home(start + 1.15);
        return 1.35;
      }
      case "phoenix": {
        // wings of fire unfold, she rises, and the phoenix dives on the foe again and again
        at(start, () => {
          hero("phoenix");
          this.hero.flying = true;
        });
        at(start + 0.35, () => {
          const [hx, hy] = this.center("hero");
          for (let i = 0; i < 24; i++) fx.emit({ x: hx + (Math.random() - 0.5) * 30, y: hy + 6, vx: (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 30, life: 0.9, color: i % 3 ? "#ffb040" : "#fff6c0", size: 2 });
        });
        ev.hits.forEach((h, i) => {
          at(start + 0.5 + i * 0.32, () => {
            const [hx, hy] = this.center("hero");
            const [fx0, fy0] = this.center("foe");
            this.projectiles.push({ kind: "feather", x0: hx + 6 - i * 10, y0: hy - 40 - i * 6, x1: fx0, y1: fy0, start: this.clock, dur: 0.24, color: "#ff7a2a" });
          });
          at(start + 0.74 + i * 0.32, () => {
            this.hitFoe(h.damage, h.crit, ["#ffb040", "#f0601e", "#fff6c0"]);
            const [fx0, fy0] = this.center("foe");
            ring(fx0, fy0, 14, 60, i % 2 ? "#f0601e" : "#ffb040", 0.8);
            this.flash = 0.4;
            this.flashColor = "#ffb060";
          });
        });
        home(start + 0.74 + ev.hits.length * 0.32 + 0.3);
        return 1.1 + ev.hits.length * 0.32;
      }
      case "starfall": {
        // a hand raised to the night: stars come down round the foe like lotus petals, and a little vitality comes back to her
        at(start, () => hero("starfall"));
        ev.hits.forEach((h, i) => {
          at(start + 0.3 + i * 0.16, () => {
            const [fx0, fy0] = this.center("foe");
            const ox = Math.sin(i * 2.4) * 22;
            this.projectiles.push({ kind: "star", x0: fx0 + ox - 30, y0: fy0 - 110, x1: fx0 + ox * 0.4, y1: fy0 + 4, start: this.clock, dur: 0.28, color: i % 2 ? "#c8d8ff" : "#f6a6c9" });
          });
          at(start + 0.58 + i * 0.16, () => this.hitFoe(h.damage, h.crit, ["#ffffff", "#c8d8ff", "#f6a6c9"]));
        });
        at(start + 0.6 + ev.hits.length * 0.16, () => {
          if (!ev.heal) return;
          const [hx, hy] = this.center("hero");
          this.view.heroHp = Math.min(this.view.heroHp + ev.heal, stats(after).maxHp);
          fx.float(`+${ev.heal}`, hx, hy - 24, "#8aff9a", 2);
          ring(hx, hy + 12, 12, 30, "#f6a6c9", 0.9);
        });
        home(start + 0.8 + ev.hits.length * 0.16);
        return 1.0 + ev.hits.length * 0.16;
      }
      default: {
        // the Lotus Heart Sutra: sat in the lotus, petals rising round her, her wounds closing
        at(start, () => hero("lotussutra"));
        at(start + 0.3, () => {
          const [hx, hy] = this.center("hero");
          for (let i = 0; i < 26; i++) fx.emit({ x: hx - 18 + Math.random() * 36, y: hy + 14, vy: -30 - Math.random() * 40, vx: (Math.random() - 0.5) * 10, life: 1.2, color: i % 3 ? "#f6a6c9" : "#9ff5de", size: 2 });
          ring(hx, hy + 14, 16, 26, "#f6a6c9", 1.1);
          this.view.heroHp = Math.min(this.view.heroHp + ev.heal, stats(after).maxHp);
          fx.float(`+${ev.heal}`, hx, hy - 24, "#8aff9a", 2);
        });
        home(start + 1.3);
        return 1.5;
      }
    }
  }

  private drawProjectiles(s: Surface, cx: number, cy: number): void {
    for (const p of this.projectiles) {
      const k = Math.min(1, (this.clock - p.start) / p.dur);
      const x = cx + p.x0 + (p.x1 - p.x0) * k;
      const y = cy + p.y0 + (p.y1 - p.y0) * k - Math.sin(k * Math.PI) * (p.kind === "foxfire" || p.kind === "venom" ? 16 : 0);
      if (p.kind === "orb" || p.kind === "foxfire" || p.kind === "venom") {
        sCircle(s, x, y, 6, alpha(p.color, 0.3));
        sCircle(s, x, y, 4, alpha(p.color, 0.85));
        sCircle(s, x, y, 2, "#ffffff");
        for (let i = 1; i < 7; i++) s.px(x - (p.x1 - p.x0) * 0.04 * i, y + Math.sin(this.clock * 20 + i) * 2, alpha(p.color, 0.8 - i * 0.11));
      } else if (p.kind === "sword") {
        const dx = p.x1 - p.x0;
        const dy = p.y1 - p.y0;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        sLine(s, x - ux * 26, y - uy * 26, x - ux * 6, y - uy * 6, alpha("#9ff5de", 0.4));
        sLine(s, x - ux * 6, y - uy * 6, x + ux * 9, y + uy * 9, "#e3ecf7");
        sLine(s, x - ux * 6 + 1, y - uy * 6, x + ux * 8 + 1, y + uy * 8, "#93a8c6");
        sLine(s, x - ux * 6 - uy * 3, y - uy * 6 + ux * 3, x - ux * 6 + uy * 3, y - uy * 6 - ux * 3, "#f2c55c");
        s.px(x + ux * 10, y + uy * 10, "#ffffff");
      } else if (p.kind === "dragon") {
        // a serpent of jade qi: a head of light and a body that coils behind it
        const dx = p.x1 - p.x0;
        const dy = p.y1 - p.y0;
        for (let i = 14; i >= 0; i--) {
          const back = Math.max(0, k - i * 0.04);
          const bx = cx + p.x0 + dx * back + Math.sin(this.clock * 18 - i * 0.7) * (4 + i * 0.3);
          const by = cy + p.y0 + dy * back + Math.cos(this.clock * 18 - i * 0.7) * 3;
          sCircle(s, bx, by, Math.max(1, 5 - i * 0.28), alpha(i ? p.color : "#ffffff", i ? 0.85 - i * 0.04 : 1));
        }
        sCircle(s, x, y, 3, "#ffffff");
        s.px(x + 2, y - 2, "#f2c55c");
      } else if (p.kind === "feather") {
        // the phoenix diving: a body of white fire and two trailing wings
        sCircle(s, x, y, 5, alpha("#ffb040", 0.6));
        sCircle(s, x, y, 3, "#fff6c0");
        for (let i = 1; i < 10; i++) {
          const tx = x - (p.x1 - p.x0) * 0.03 * i;
          const ty = y - (p.y1 - p.y0) * 0.03 * i;
          s.px(tx - i, ty - i * 0.6, alpha("#f0601e", 0.9 - i * 0.08));
          s.px(tx + i, ty - i * 0.6, alpha("#f0601e", 0.9 - i * 0.08));
          s.px(tx, ty, alpha("#ffb040", 0.8 - i * 0.07));
        }
      } else if (p.kind === "star") {
        // a falling star with a tail
        for (let i = 0; i < 8; i++) s.px(x - (p.x1 - p.x0) * 0.025 * i, y - (p.y1 - p.y0) * 0.025 * i, alpha(p.color, 0.9 - i * 0.1));
        sCircle(s, x, y, 2, "#ffffff");
        s.px(x - 3, y, alpha("#ffffff", 0.6));
        s.px(x + 3, y, alpha("#ffffff", 0.6));
        s.px(x, y - 3, alpha("#ffffff", 0.6));
        s.px(x, y + 3, alpha("#ffffff", 0.6));
      } else {
        for (let a = -1.2; a <= 1.2; a += 0.08) {
          s.px(x + Math.cos(a) * 12, y + Math.sin(a) * 16, p.color);
          s.px(x + Math.cos(a) * 10, y + Math.sin(a) * 14, alpha("#ffffff", 0.8));
          s.px(x + Math.cos(a) * 14, y + Math.sin(a) * 17, alpha(p.color, 0.4));
        }
      }
    }
  }

  private drawBolts(s: Surface, cx: number, cy: number): void {
    for (const b of this.bolts) {
      const age = this.clock - b.at;
      let x = cx + b.x + Math.sin(b.at * 13) * 30;
      let y = 0;
      const ty = cy + b.y;
      let i = 0;
      while (y < ty) {
        const nx = x + Math.sin(b.at * 7 + i * 3.1) * 9 + (cx + b.x - x) * 0.3;
        const ny = Math.min(ty, y + 12);
        sLine(s, x, y, nx, ny, age < 0.15 ? "#ffffff" : alpha("#ffffff", 0.6));
        sLine(s, x + 1, y, nx + 1, ny, alpha(b.color, 0.8));
        sLine(s, x - 1, y, nx - 1, ny, alpha(b.color, 0.5));
        x = nx;
        y = ny;
        i++;
      }
      sRing(s, cx + b.x, ty, 6 + age * 60, alpha("#ffffff", Math.max(0, 0.7 - age * 1.4)));
    }
  }
}
