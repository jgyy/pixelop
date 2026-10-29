import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { BufferSurface } from "@/game/pixel/surface";
import { cultivationNeeded, statsFor } from "@/game/engine/realms";
import { newGame, SKILL_IDS } from "@/game/engine/state";
import { Game, type UiSnapshot } from "@/game/runtime/Game";
import { renderTitle } from "@/game/runtime/title";
import { duskAt, DAY_LENGTH } from "@/game/runtime/world";
import { toWorld, WORLD_SCALE } from "@/game/world/layout";
import { getWorld } from "@/game/world/continent";
import { getInterior } from "@/game/world/interiors";

const surface = () => new BufferSurface(new PixelBuffer(320, 180));

/** Press confirm until the current cutscene/dialogue ends. */
function talkThrough(game: Game, max = 200): void {
  for (let i = 0; i < max && game.mode === "scene"; i++) {
    game.keyDown("Enter");
    game.keyUp("Enter");
    game.debugSkipTime(0.3);
  }
}

const dirTo = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const ang = Math.atan2(b.x - a.x - (b.y - a.y), b.x - a.x + (b.y - a.y));
  return ((Math.round(ang / (Math.PI / 8)) % 16) + 16) % 16;
};

/** Stand the heroine on open ground right beside a tile of the open world. */
function standBeside(game: Game, i: number, j: number): void {
  const m = getWorld().map;
  for (const [di, dj] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, 1],
    [1, -1],
    [-1, -1],
  ])
    if (m.standable(i + di, j + dj)) return game.debugGoto(i + di + 0.5, j + dj + 0.5);
  throw new Error(`nowhere to stand beside ${i},${j}`);
}

/** Stand beside something of the open world by its key (an NPC, a beast's den, a chest, a shrine, a crane). */
function standBy(game: Game, key: string): void {
  const w = getWorld();
  const x = [...w.npcs, ...w.enemies, ...w.interacts, ...(w.critters ?? [])].find((n) => n.key === key);
  if (!x) throw new Error(`no ${key} in the world`);
  standBeside(game, x.i, x.j);
}

/** Stand the heroine on open ground beside an NPC of the open world, and talk to them. */
function talkTo(game: Game, key: string): void {
  standBy(game, key);
  game.debugSkipTime(0.1);
  game.keyDown("KeyE");
  game.keyUp("KeyE");
}

const fresh = () => {
  const g = new Game(newGame(), { seed: 1 });
  g.debugSkipTime(0.2);
  return g;
};

describe("Game runtime", () => {
  it("plays the opening, which can be skipped, then renders the sect", () => {
    const game = new Game(newGame(), { intro: true, seed: 1 });
    expect(game.mode).toBe("scene");
    expect(game.snapshot().narration?.text).toMatch(/Azure Cloud Sect/);
    game.skipScene();
    game.debugSkipTime(0.5);
    expect(game.mode).toBe("explore");
    const s = surface();
    game.render(s);
    expect((s as BufferSurface).buffer.opaqueCount()).toBe(320 * 180);
  });

  it("walks with screen-relative input and collides with the island's edge", () => {
    const game = fresh();
    const { x, y } = game.state;
    game.keyDown("KeyW");
    game.debugSkipTime(0.6);
    game.keyUp("KeyW");
    expect(game.state.x).toBeLessThan(x);
    expect(game.state.y).toBeLessThan(y);
    // walk south-west forever: the cloud sea stops us before we fall off
    game.keyDown("KeyA");
    game.keyDown("KeyS");
    game.debugSkipTime(8);
    const m = game.world.def.map;
    expect(m.standable(Math.floor(game.state.x), Math.floor(game.state.y))).toBe(true);
  });

  it("taps walk the heroine toward the tapped tile", () => {
    const game = fresh();
    game.render(surface());
    const [hx, hy] = game.world.heroScreen();
    game.tap(hx + 30, hy);
    game.debugSkipTime(1);
    expect(game.world.heroScreen()[0]).toBeGreaterThan(hx + 10);
  });

  it("talks to Elder Mo and learns to ride the sword", () => {
    const game = fresh();
    standBy(game, "elder");
    let snap: UiSnapshot | null = null;
    game.subscribe((s) => (snap = s));
    game.debugSkipTime(0.1);
    expect(snap!.prompt).toMatch(/Elder Mo/);
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.mode).toBe("scene");
    expect(game.snapshot().dialog?.portrait).toBe("elder");
    talkThrough(game);
    expect(game.state.flags.metElder).toBe(true);
    game.toggleFly();
    expect(game.flying).toBe(true);
    game.toggleFly();
    expect(game.flying).toBe(false);
  });

  it("travels the world map to an unlocked region", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    game.openMap();
    expect(game.mode).toBe("worldmap");
    game.mapSelect("bamboo");
    expect(game.worldMap!.travelling).toBe(false); // sealed
    game.mapSelect("village");
    expect(game.worldMap!.travelling).toBe(true);
    game.render(surface());
    game.debugSkipTime(8);
    expect(game.worldMap!.at).toBe("village");
    game.keyDown("Enter");
    expect(game.state.area).toBe("village");
    // the first visit triggers the village cutscene
    expect(game.mode).toBe("scene");
    talkThrough(game);
    expect(game.mode).toBe("explore");
  });

  it("fights a battle to victory through the event timeline", () => {
    const game = fresh();
    game.debugPatch({ realm: 2, stage: 0, hp: 500, qi: 300, skills: [...SKILL_IDS] });
    game.debugBattle("fox");
    expect(game.mode).toBe("battle");
    game.render(surface());
    for (let i = 0; i < 40 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: i % 2 ? "thunder" : "swords" });
      game.debugSkipTime(0.5);
      game.render(surface());
    }
    expect(game.mode).toBe("explore");
    expect(game.state.kills).toBe(1);
  });

  it("wakes at the sect shrine after a defeat", () => {
    const game = fresh();
    game.debugTeleport("valley", 4.5, 29.5);
    game.debugPatch({ hp: 1 });
    game.debugBattle("patriarch");
    game.debugSkipTime(1);
    game.battleAction({ type: "skill", skill: "strike" });
    game.debugSkipTime(6);
    expect(game.mode).toBe("explore");
    expect(game.state.area).toBe("sect");
    expect(game.state.hp).toBeGreaterThan(0);
  });

  it("meditates at a shrine, faces the tribulation and breaks through", () => {
    const game = fresh();
    standBy(game, "sect-shrine");
    // heaven's bolts strike hard: she faces them whole
    game.debugPatch({ stage: 3, cultivation: cultivationNeeded(0, 3) - 5, hp: statsFor(0, 3).maxHp });
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.mode).toBe("meditate");
    game.debugSkipTime(2.2);
    expect(game.snapshot().bottleneck).toBe(true);
    game.keyDown("KeyB");
    game.keyUp("KeyB");
    expect(game.mode).toBe("tribulation");
    game.render(surface());
    game.debugSkipTime(4);
    game.render(surface());
    game.debugSkipTime(6);
    expect(game.mode).toBe("explore");
    expect(game.state.realm).toBe(1);
  });

  it("collects herbs and chests once", () => {
    const game = fresh();
    standBy(game, "sect-chest");
    const stones = game.state.stones;
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.state.stones).toBeGreaterThan(stones);
    expect(game.state.taken).toContain("sect-chest");
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.state.taken.filter((t) => t === "sect-chest")).toHaveLength(1);
  });

  it("touching Patriarch Xue starts his speech, then the boss battle", () => {
    const game = fresh();
    game.debugPatch({ realm: 1, flags: { metElder: true, valleyArrived: true } });
    standBy(game, "patriarch");
    const xue = game.world.actor("patriarch")!;
    Object.assign(game.world.hero, { x: xue.x + 0.3, y: xue.y + 0.3 });
    game.debugSkipTime(1.2);
    expect(game.mode).toBe("scene");
    expect(game.snapshot().dialog?.speaker).toBe("Patriarch Xue");
    talkThrough(game);
    expect(game.mode).toBe("battle");
    expect(game.snapshot().battle?.boss).toBe(true);
  });

  it("calming the third fox summons Hu Li at the spirit tree", () => {
    const game = fresh();
    game.debugPatch({ realm: 2, hp: 400, qi: 300, counters: { foxes: 2 }, flags: { metElder: true, metZhou: true, villageSaved: true, bambooArrived: true }, skills: [...SKILL_IDS] });
    game.debugTeleport("bamboo", 16.5, 20.5);
    game.debugBattle("fox", "fox-a");
    for (let i = 0; i < 40 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: "swords" });
      game.debugSkipTime(0.5);
    }
    talkThrough(game);
    expect(game.state.flags.foxesCleared).toBe(true);
    expect(game.world.actor("huli")).toBeDefined();
    expect(game.snapshot().quest.objective).toMatch(/spirit tree/);
  });

  it("walks from the sect down the sky bridge into the village — one world, no loading", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true } });
    game.debugTeleport("sect", 15.5, 25.5);
    const world = game.world;
    game.setStick(-0.8, 0.4); // straight down the bridge (+y in world tiles), across Cloudrest Isle
    game.debugSkipTime(15 * WORLD_SCALE);
    game.setStick(0, 0);
    expect(game.world).toBe(world);
    expect(game.state.area).toBe("village");
    expect(game.state.y).toBeGreaterThan(toWorld("village", 0, 0)[1]);
    expect(game.snapshot().area.name).toBe("Willow Creek Village");
  });

  it("a sealed region's mist turns the heroine back and says why", () => {
    const game = fresh();
    game.debugTeleport("sect", 15.5, 25.5);
    game.setStick(-0.8, 0.4);
    game.debugSkipTime(10 * WORLD_SCALE);
    game.setStick(0, 0);
    expect(game.state.area).toBe("sect");
    expect(game.state.y).toBeLessThan(toWorld("village", 0, 0)[1] - 12 * WORLD_SCALE);
    expect(game.snapshot().toasts.map((t) => t.text).join(" ")).toMatch(/Willow Creek Village: Speak with Elder Mo/);
  });

  it("holding Shift breaks into a run", () => {
    const walkFrom = (run: boolean) => {
      const game = fresh();
      // down the open road to the sect gate
      const { x, y } = game.state;
      if (run) game.keyDown("ShiftLeft");
      game.keyDown("KeyS");
      game.debugSkipTime(0.8);
      const anim = game.world.hero.anim;
      return { d: Math.hypot(game.state.x - x, game.state.y - y), anim };
    };
    const walk = walkFrom(false);
    const run = walkFrom(true);
    expect(walk.anim).toBe("walk");
    expect(run.anim).toBe("run");
    expect(run.d).toBeGreaterThan(walk.d * 1.3);
  });

  it("whistles Cloudmane down to ride: a canter outpaces a run, a gallop outpaces the sword, and she steps down to talk", () => {
    const distance = (mode: "run" | "canter" | "gallop" | "fly") => {
      const game = fresh();
      game.debugPatch({ flags: { metElder: true } });
      if (mode === "fly") game.toggleFly();
      if (mode === "canter" || mode === "gallop") {
        game.keyDown("KeyR");
        game.keyUp("KeyR");
        expect(game.riding).toBe(true);
        expect(game.world.hero.char).toBe("rider");
      }
      const { x, y } = game.state;
      if (mode !== "canter") game.keyDown("ShiftLeft");
      game.keyDown("KeyS"); // down the open road to the sect gate
      game.debugSkipTime(0.5);
      if (mode === "gallop") expect(game.world.hero.anim).toBe("run");
      return Math.hypot(game.state.x - x, game.state.y - y);
    };
    const run = distance("run");
    expect(distance("canter")).toBeGreaterThan(run * 1.3);
    expect(distance("gallop")).toBeGreaterThan(Math.max(run * 2, distance("fly") * 1.6));

    // before Elder Mo hands over the whistle there is no horse
    const early = fresh();
    early.toggleRide();
    expect(early.riding).toBe(false);

    // she swings down from the saddle to talk to someone, and never rides indoors
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    standBy(game, "qing");
    game.toggleRide();
    expect(game.riding).toBe(true);
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.mode).toBe("scene");
    expect(game.riding).toBe(false);
    for (let i = 0; i < 5 && game.mode !== "explore"; i++) {
      talkThrough(game);
      if (game.mode === "shop") game.closeShop();
    }
    game.toggleRide();
    expect(game.riding).toBe(true);
    game.debugEnter("hall");
    expect(game.riding).toBe(false);
    game.toggleRide();
    expect(game.riding).toBe(false);
  });

  it("wild horses bolt from her on foot, but let a rider among them", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    standBy(game, "horse-fields-0");
    const horse = game.world.actor("horse-fields-0")!;
    const d0 = Math.hypot(horse.x - game.world.hero.x, horse.y - game.world.hero.y);
    game.debugSkipTime(0.8);
    expect(horse.anim).toBe("run");
    expect(Math.hypot(horse.x - game.world.hero.x, horse.y - game.world.hero.y)).toBeGreaterThan(d0 + 1.5);

    const calm = fresh();
    calm.debugPatch({ flags: { metElder: true } });
    standBy(calm, "horse-highlands-0");
    calm.toggleRide();
    calm.debugSkipTime(0.8);
    expect(calm.world.actor("horse-highlands-0")!.running).toBeFalsy();
  });

  it("cranes take flight when the heroine comes close", () => {
    const game = fresh();
    standBy(game, "crane-s1");
    game.debugSkipTime(0.6);
    const crane = game.world.actor("crane-s1")!;
    expect(crane.flying).toBe(true);
    expect(crane.z).toBeGreaterThan(game.world.groundZ(crane.x, crane.y) + 0.5);
  });

  it("villagers turn to greet and wave at the heroine", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true } });
    standBy(game, "hua");
    game.debugSkipTime(0.2);
    const hua = game.world.actor("hua")!;
    expect(hua.anim).toBe("wave");
    expect(hua.dir).toBe(dirTo(hua, game.world.hero));
  });

  it("beaten beasts roam again after the heroine has been away", () => {
    const game = fresh();
    game.debugPatch({ realm: 2, hp: 400, qi: 300, skills: [...SKILL_IDS], flags: { metElder: true, metZhou: true, villageSaved: true, bambooArrived: true } });
    game.debugTeleport("bamboo", 14.5, 12.5);
    game.debugBattle("wolf", "wolf-a");
    for (let i = 0; i < 40 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: "thunder" });
      game.debugSkipTime(0.5);
    }
    talkThrough(game);
    expect(game.world.actor("wolf-a")).toBeUndefined();
    game.debugTeleport("sect", 15.5, 20.5);
    game.debugSkipTime(62, 1 / 10);
    expect(game.world.actor("wolf-a")).toBeDefined();
  });

  it("Lin Yue stretches or looks around when left idle, and night falls with the day cycle", () => {
    const game = fresh();
    game.debugSkipTime(8.5);
    expect(["stretch", "look"]).toContain(game.world.hero.anim);
    expect(duskAt(0)).toBe(0);
    expect(duskAt(DAY_LENGTH / 2)).toBeCloseTo(1);
  });

  it("the folk of the wilds: tea at the crossroads, the miller's pills, the monk's sutra and the hermit's teaching", () => {
    const game = fresh();
    game.debugPatch({ hp: 1, qi: 0, flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true, lakeArrived: true, metHuli: true } });
    talkTo(game, "fang");
    expect(game.mode).toBe("scene");
    for (let i = 0; i < 5 && game.mode !== "explore"; i++) {
      talkThrough(game);
      if (game.mode === "shop") game.closeShop();
    }
    expect(game.state.flags.fangTea).toBe(true);
    expect(game.state.hp).toBe(game.snapshot().stats.maxHp);

    const qi = game.state.pills.qi;
    talkTo(game, "tang");
    talkThrough(game);
    expect(game.state.flags.tangGift).toBe(true);
    expect(game.state.pills.qi).toBe(qi + 2);

    for (const [key, flag] of [
      ["kong", "kongSutra"],
      ["yun", "yunTeaching"],
    ] as const) {
      const before = game.state.cultivation + game.state.stage * 1000;
      talkTo(game, key);
      talkThrough(game);
      expect(game.state.flags[flag], key).toBe(true);
      expect(game.state.cultivation + game.state.stage * 1000, key).toBeGreaterThan(before);
    }
    const stones = game.state.stones;
    talkTo(game, "wu");
    talkThrough(game);
    expect(game.state.stones).toBe(stones + 20);
    expect(game.snapshot().dialog).toBeNull();
  });

  it("walking up to a landmark of the wilds names it", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true } });
    const tea = getWorld().landmarks.find((l) => l.key === "teahouse")!;
    // on the highway just beyond the teahouse's name, then a few steps down the road to it
    game.debugGoto(tea.x + 0.5, tea.y + 0.5 - 7 * WORLD_SCALE - 1);
    game.debugSkipTime(4);
    expect(game.snapshot().banner?.title).not.toBe("Crossroads Teahouse");
    game.tap(...game.world.heroScreen().map((v, k) => v + (k ? 40 : 0)) as [number, number]);
    game.debugSkipTime(0.8);
    expect(game.snapshot().banner?.title).toBe("Crossroads Teahouse");
    expect(game.snapshot().banner?.hanzi).toBe("茶馆");
  });

  it("Xiao Han's friendly duel never sends her home, and a win pays out", () => {
    const game = fresh();
    game.debugPatch({ hp: 5, flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, bambooArrived: true, lakeArrived: true, metHuli: true } });
    const purse = game.state.stones;
    talkTo(game, "han");
    talkThrough(game);
    expect(game.mode).toBe("battle");
    for (let i = 0; i < 40 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: "strike" });
      game.debugSkipTime(0.5);
    }
    talkThrough(game);
    expect(game.state.flags.hanDuel).toBeFalsy();
    // a friendly duel lost costs no spirit stones
    expect(game.state.stones).toBe(purse);
    expect(game.state.area).not.toBe("sect");
    expect(game.state.hp).toBeGreaterThan(0);
    // a rematch, now at Core Formation
    game.debugPatch({ realm: 2, hp: 600, qi: 400, skills: [...SKILL_IDS] });
    const stones = game.state.stones;
    talkTo(game, "han");
    talkThrough(game);
    expect(game.mode).toBe("battle");
    for (let i = 0; i < 40 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: "thunder" });
      game.debugSkipTime(0.5);
    }
    talkThrough(game);
    expect(game.state.flags.hanDuel).toBe(true);
    expect(game.state.stones).toBe(stones + 80);
  });

  it("beasts sniff, howl and doze, and cranes peck, when left alone", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    // hover on the sword above the highway (safe from the beasts) near the bandit camp's wolves
    game.debugGoto(300 * WORLD_SCALE, 172.5 * WORLD_SCALE);
    game.toggleFly();
    const seen = new Set<string>();
    for (let k = 0; k < 120; k++) {
      game.debugSkipTime(0.25, 1 / 20);
      for (const a of game.world.actors) if (a.kind !== "hero") seen.add(`${a.char}:${a.anim}`);
    }
    expect([...seen].some((x) => /wolf:(sniff|howl|sleep)/.test(x)), [...seen].join(" ")).toBe(true);
  });

  it("a beast that reaches the edge of its territory stands its ground instead of running on the spot", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    const spawn = getWorld().enemies.find((e) => e.key === "wild-wolf-1")!;
    const m = getWorld().map;
    // find a line out from its den along which both the beast and the heroine can stand
    const dir = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).find(([dx, dy]) => [5, 6, 7, 8].every((k) => m.standable(spawn.i + dx * k, spawn.j + dy * k)))!;
    // its packmate keeps to its own den: take it off the map so only this one is watched
    game.world.defeat("wild-wolf-1~2");
    game.debugGoto(spawn.i + 0.5 + dir[0] * 8, spawn.j + 0.5 + dir[1] * 8);
    game.debugSkipTime(1.2);
    const wolf = game.world.actor("wild-wolf-1")!;
    Object.assign(wolf, { x: spawn.i + 0.5 + dir[0] * 5.9, y: spawn.j + 0.5 + dir[1] * 5.9, target: null, holdUntil: undefined });
    game.debugSkipTime(1);
    expect(game.mode).toBe("explore");
    expect(wolf.alerted).toBe(true);
    expect(wolf.anim).toBe("idle");
    expect(Math.hypot(wolf.x - wolf.home[0], wolf.y - wolf.home[1])).toBeLessThanOrEqual(spawn.range + 4 + 0.01);
  });

  it("once she has sat down to wait, riding her sword or travelling gets her up for good", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    game.debugSkipTime(90, 1 / 10);
    expect(game.world.hero.idleAnim).toBe("sit");
    game.toggleFly();
    game.toggleFly();
    game.debugSkipTime(0.5);
    expect(game.world.hero.anim).toBe("idle");
    game.debugSkipTime(90, 1 / 10);
    expect(game.world.hero.idleAnim).toBe("sit");
    game.enterArea("village");
    expect(game.world.hero.idleAnim).toBe("idle");
  });

  it("scripted walks are at a walking pace even straight after a run", () => {
    const game = fresh();
    const h = game.world.hero;
    h.running = true;
    game.play([{ walk: "hero", to: [h.x + 2, h.y] }]);
    game.debugSkipTime(0.2);
    expect(h.anim).toBe("walk");
  });

  it("opening the world map while flying over water does not drop her into the lake", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, metHuli: true, lakeArrived: true }, realm: 1 });
    game.debugTeleport("lake", 16.5, 20.5); // on the jetty
    game.toggleFly();
    game.keyDown("KeyD"); // out over the open water
    game.debugSkipTime(0.4 * WORLD_SCALE);
    game.keyUp("KeyD");
    const m = game.world.def.map;
    expect(m.standable(Math.floor(game.state.x), Math.floor(game.state.y))).toBe(false);
    game.openMap();
    game.closeMap();
    expect(game.mode).toBe("explore");
    const { x, y } = game.state;
    game.keyDown("KeyA");
    game.debugSkipTime(0.6);
    game.keyUp("KeyA");
    expect(Math.hypot(game.state.x - x, game.state.y - y)).toBeGreaterThan(0.5);
  });

  it("a save made while flying over water (or off the land) loads onto open ground", () => {
    const m = getWorld().map;
    const [lx, ly] = toWorld("lake", 16.5, 6.5); // the middle of the Lotus Lake
    expect(m.standable(Math.floor(lx), Math.floor(ly))).toBe(false);
    for (const [x, y, area] of [
      [lx, ly, "lake"],
      [3.5, 3.5, "village"],
    ] as const) {
      const game = new Game({ ...newGame(), x, y, area }, { seed: 1 });
      expect(m.standable(Math.floor(game.state.x), Math.floor(game.state.y))).toBe(true);
      const { x: x0, y: y0 } = game.state;
      game.keyDown("KeyS");
      game.debugSkipTime(0.5);
      expect(Math.hypot(game.state.x - x0, game.state.y - y0)).toBeGreaterThan(0.3);
    }
  });

  it("walks in through the Hall of Clouds' door, learns from the archivist, reads the annals and walks back out", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    const hall = getInterior("hall");
    game.debugGoto(hall.door[0] + 0.5, hall.door[1] + 0.5);
    game.debugSkipTime(0.1);
    expect(game.snapshot().prompt).toBe("E · Enter the Hall of Clouds");
    // walking into the building from its door step goes through the door (the hall's door faces +x, so walk up-left)
    game.keyDown("KeyW");
    game.keyDown("KeyA");
    game.debugSkipTime(0.4);
    game.keyUp("KeyW");
    game.keyUp("KeyA");
    expect(game.inside).toBe("hall");
    expect(game.snapshot().interior?.name).toBe("Hall of Clouds");
    expect(game.snapshot().banner?.title).toBe("Hall of Clouds");
    // indoors the save keeps her on the step outside, so a reload lands in the open world
    expect(game.state.x).toBeCloseTo(hall.outside[0]);
    expect(game.state.y).toBeCloseTo(hall.outside[1]);
    // no sword riding or world map under a roof
    game.keyDown("KeyF");
    game.keyUp("KeyF");
    expect(game.flying).toBe(false);
    game.keyDown("KeyM");
    game.keyUp("KeyM");
    expect(game.mode).toBe("explore");
    expect(game.snapshot().toasts.at(-1)?.text).toMatch(/Step outside/);

    // the archivist shares the founder's breathing method
    const shen = game.world.actor("shen")!;
    Object.assign(game.world.hero, { x: shen.x + 1, y: shen.y });
    game.debugSkipTime(0.1);
    expect(game.snapshot().prompt).toBe("E · Talk to Archivist Shen");
    const before = game.state.cultivation + game.state.stage * 1000;
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    talkThrough(game);
    expect(game.state.flags.shenLore).toBe(true);
    expect(game.state.cultivation + game.state.stage * 1000).toBeGreaterThan(before);

    // she reads the shelves (and bows in prayer at the ancestral altar)
    Object.assign(game.world.hero, { x: 2.5, y: 2.5 });
    game.debugSkipTime(0.1);
    expect(game.snapshot().prompt).toBe("E · Read");
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.world.hero.anim).toBe("read");
    expect(game.snapshot().dialog?.text).toMatch(/Jade Lotus Heart/);
    talkThrough(game);
    Object.assign(game.world.hero, { x: 4.5, y: 2.5 });
    game.debugSkipTime(0.1);
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.world.hero.anim).toBe("pray");
    talkThrough(game);

    // and the threshold leads back out onto the step
    Object.assign(game.world.hero, { x: hall.exit[0] + 0.5, y: hall.exit[1] + 0.5 });
    game.debugSkipTime(0.1);
    expect(game.snapshot().prompt).toBe("E · Step outside");
    game.keyDown("KeyS");
    game.keyDown("KeyD");
    game.debugSkipTime(0.3);
    game.keyUp("KeyS");
    game.keyUp("KeyD");
    expect(game.inside).toBeNull();
    expect(Math.hypot(game.world.hero.x - hall.outside[0], game.world.hero.y - hall.outside[1])).toBeLessThan(1.5);
    expect(game.state.area).toBe("sect");
  });

  it("every building renders, and its folk live, sit and work inside", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    for (const id of ["hall", "cottage", "teahouse", "mill", "pagoda"] as const) {
      game.debugEnter(id);
      game.debugSkipTime(1);
      const s = surface();
      game.render(s);
      expect((s as BufferSurface).buffer.opaqueCount(), id).toBe(320 * 180);
      for (const n of getInterior(id).npcs) expect(game.world.actor(n.key)?.anim, `${id}/${n.key}`).toBe(n.anim);
      // E at the mat steps back out
      const d = getInterior(id);
      Object.assign(game.world.hero, { x: d.exit[0] + 0.5, y: d.exit[1] + 0.5 });
      game.debugSkipTime(0.1);
      game.keyDown("KeyE");
      game.keyUp("KeyE");
      expect(game.inside, id).toBeNull();
    }
  });

  it("losing a fight indoors wakes her at the sect shrine, outside", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    game.debugEnter("teahouse");
    game.debugPatch({ hp: 1 });
    game.debugBattle("wolf");
    for (let i = 0; i < 40 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: "strike" });
      game.debugSkipTime(1.5);
    }
    expect(game.mode).toBe("explore");
    expect(game.inside).toBeNull();
    expect(game.state.area).toBe("sect");
  });

  it("renders every region and the title backdrop", () => {
    const game = fresh();
    for (const area of ["sect", "village", "bamboo", "lake", "valley", "peak"] as const) {
      game.enterArea(area);
      game.skipScene();
      game.debugSkipTime(0.2);
      const s = surface();
      game.render(s);
      expect((s as BufferSurface).buffer.opaqueCount()).toBe(320 * 180);
    }
    const t = surface();
    renderTitle(t, 3);
    expect((t as BufferSurface).buffer.opaqueCount()).toBe(320 * 180);
  });

  it("changes attire with C: a twirl, a new look in the world, in battle and in her portrait", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, "attire:wayfarer": true } });
    game.debugGoto(...toWorld("sect", 15.5, 20.5));
    game.debugSkipTime(0.2);
    expect(game.snapshot().attire).toEqual({ id: "jade", name: "Jade Lotus Robes", owned: 2 });
    game.keyDown("KeyC");
    game.keyUp("KeyC");
    game.debugSkipTime(0.1);
    expect(game.snapshot().attire.id).toBe("wayfarer");
    expect(game.world.hero.outfit).toBe("wayfarer");
    expect(game.world.hero.anim).toBe("twirl");
    expect(game.snapshot().toasts.some((t) => /Wayfarer/.test(t.text))).toBe(true);
    // she rides in it too, and fights in it
    game.toggleRide();
    game.debugSkipTime(0.1);
    expect(game.world.hero.char).toBe("rider");
    expect(game.world.hero.outfit).toBe("wayfarer");
    game.debugBattle("fox");
    expect(game.battle!.hero.outfit).toBe("wayfarer");
  });

  it("with only her jade robes, C explains how to find more", () => {
    const game = fresh();
    game.keyDown("KeyC");
    game.keyUp("KeyC");
    expect(game.snapshot().attire.id).toBe("jade");
    expect(game.snapshot().toasts.some((t) => /Jade Lotus Robes/.test(t.text))).toBe(true);
  });

  it("Willow Creek's folk put on their festival best (lanterns in hand) once the Heart is home", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, patriarchDefeated: true } });
    game.debugTeleport("village", 16.5, 12.5);
    game.debugSkipTime(0.6);
    const zhou = game.world.actor("zhou")!;
    expect(zhou.outfit).toBeUndefined();
    game.debugPatch({ flags: { ...game.state.flags, heartReturned: true, festivalSeen: true } });
    game.debugSkipTime(0.6);
    expect(zhou.outfit).toBe("festival");
    expect(zhou.idleAnim).toBe("lantern");
    const s = surface();
    game.render(s);
    expect(s.buffer.opaqueCount()).toBeGreaterThan(0);
  });

  it("the scholar's shade writes at the Moon-Gazing Pavilion, and finds his rest when Hu Li comes", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, foxesCleared: true, bambooArrived: true, metHuli: true } });
    talkTo(game, "pei");
    expect(game.mode).toBe("scene");
    game.debugSkipTime(1);
    expect(game.snapshot().dialog?.speaker).toBe("Scholar Pei");
    talkThrough(game);
    expect(game.state.flags.peiMet).toBe(true);
    expect(game.snapshot().errand).toMatch(/Hu Li/);
    talkTo(game, "huli");
    talkThrough(game);
    expect(game.state.flags.huliLetter).toBe(true);
    talkTo(game, "pei");
    game.debugSkipTime(0.6);
    expect(game.world.actor("huliPav")).toBeDefined();
    talkThrough(game);
    expect(game.state.flags.peiAtRest).toBe(true);
    expect(game.snapshot().attire.id).toBe("foxfire");
    game.debugSkipTime(0.6);
    expect(game.world.actor("pei")).toBeUndefined();
  });

  it("refusing the final tribulation away from the peak doesn't leave her sitting in meditation", () => {
    const game = fresh();
    game.debugPatch({ realm: 4, stage: 3, cultivation: cultivationNeeded(4, 3), flags: { metElder: true } });
    standBy(game, "sect-shrine");
    game.keyDown("KeyB");
    game.keyUp("KeyB");
    expect(game.mode).toBe("explore");
    expect(game.world.hero.idleAnim).toBe("idle");
    expect(game.snapshot().toasts.some((t) => /Tribulation Peak/.test(t.text))).toBe(true);
  });

  it("walking on starts her idle habits afresh, rather than sitting straight back down", () => {
    const game = fresh();
    // left alone long enough, she sits down
    for (let k = 0; k < 6 && game.world.hero.idleAnim !== "sit"; k++) game.debugSkipTime(12.5);
    expect(game.world.hero.idleAnim).toBe("sit");
    game.keyDown("KeyD");
    game.debugSkipTime(0.4);
    game.keyUp("KeyD");
    // the next time she is left alone, she glances about or stretches first
    game.debugSkipTime(8.5);
    expect(game.world.hero.idleAnim).toBe("idle");
    expect(["stretch", "look"]).toContain(game.world.hero.anim);
  });

  it("names the folk who share a look by their own names", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true } });
    standBy(game, "wu");
    game.debugSkipTime(0.3);
    expect(game.snapshot().prompt).toBe("E · Talk to Farmer Wu");
    standBy(game, "herder");
    game.debugSkipTime(0.3);
    expect(game.snapshot().prompt).toBe("E · Talk to Herder Altan");
  });

  it("crosses the Rainbow Bridge on foot into the eastern lands, which answer to Wavecrest Harbour", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true, metZhou: true, metHuli: true, harborArrived: true }, realm: 1 });
    const bridge = getWorld().landmarks.find((l) => l.key === "rainbow")!;
    game.debugGoto(bridge.x - 24, bridge.y + 0.5);
    game.keyDown("ShiftLeft");
    // right and down on screen is due east in the world
    game.keyDown("KeyD");
    game.keyDown("KeyS");
    game.debugSkipTime(9);
    game.keyUp("KeyD");
    game.keyUp("KeyS");
    game.keyUp("ShiftLeft");
    expect(game.state.x).toBeGreaterThan(bridge.x + 20);
    expect(game.state.area).toBe("harbor");
  });

  it("long flights across the doubled world map still take only a few seconds", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageSaved: true, metZhou: true }, realm: 1 });
    game.openMap();
    game.mapSelect("harbor");
    expect(game.worldMap?.travelling).toBe(true);
    game.debugSkipTime(4.5);
    expect(game.worldMap?.travelling).toBe(false);
    expect(game.worldMap?.at).toBe("harbor");
  });

  it("Elder Qiu teaches taiji, and the folk of the new lands work, play and carry their loads", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true } });
    talkTo(game, "qiu");
    talkThrough(game);
    expect(game.state.flags.qiuForm).toBe(true);
    // the porter on the market road shoulders his pole as he walks
    standBy(game, "marketporter");
    game.debugSkipTime(6);
    const porter = game.world.actor("marketporter")!;
    expect(porter.carrier).toBe(true);
    expect(["carry", "idle", "wave"]).toContain(porter.anim);
    standBy(game, "ba");
    game.debugSkipTime(0.5);
    expect(game.world.actor("ba")!.anim).toBe("chop");
    game.render(surface());
  });
});
