import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { BufferSurface } from "@/game/pixel/surface";
import { cultivationNeeded } from "@/game/engine/realms";
import { newGame, SKILL_IDS } from "@/game/engine/state";
import { Game, type UiSnapshot } from "@/game/runtime/Game";
import { renderTitle } from "@/game/runtime/title";
import { duskAt, DAY_LENGTH } from "@/game/runtime/world";
import { toWorld } from "@/game/world/layout";

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
    game.debugTeleport("sect", 15.5, 10.5);
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
    game.debugTeleport("sect", 7.5, 13.5);
    game.debugPatch({ stage: 3, cultivation: cultivationNeeded(0, 3) - 5 });
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
    game.debugTeleport("sect", 5.5, 10.4);
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
    game.debugTeleport("valley", 25.5, 7.05);
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
    game.setStick(-0.8, 0.4); // straight down the bridge (+y in world tiles)
    game.debugSkipTime(4.5);
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
    game.debugSkipTime(4.5);
    game.setStick(0, 0);
    expect(game.state.area).toBe("sect");
    expect(game.state.y).toBeLessThan(65);
    expect(game.snapshot().toasts.map((t) => t.text).join(" ")).toMatch(/Willow Creek Village: Speak with Elder Mo/);
  });

  it("holding Shift breaks into a run", () => {
    const walkFrom = (run: boolean) => {
      const game = fresh();
      game.debugTeleport("sect", 13.5, 15.5);
      const { x, y } = game.state;
      if (run) game.keyDown("ShiftLeft");
      game.keyDown("KeyW");
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

  it("cranes take flight when the heroine comes close", () => {
    const game = fresh();
    game.debugTeleport("sect", 20.5, 22.4);
    game.debugSkipTime(0.6);
    const crane = game.world.actor("crane-s1")!;
    expect(crane.flying).toBe(true);
    expect(crane.z).toBeGreaterThan(game.world.groundZ(crane.x, crane.y) + 0.5);
  });

  it("villagers turn to greet and wave at the heroine", () => {
    const game = fresh();
    game.debugPatch({ flags: { metElder: true, villageArrived: true, villageSaved: true } });
    game.debugTeleport("village", 12.4, 6.5);
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
});
