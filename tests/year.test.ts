import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { BufferSurface } from "@/game/pixel/surface";
import { newGame, type GameState } from "@/game/engine/state";
import { Game } from "@/game/runtime/Game";
import { atTimeOfDay, calendarAt, DAY_LENGTH, passTime, phaseAt, rainingAt, SEASON_LENGTH, seasonAt, TIME_SKIP, worldTime, YEAR_LENGTH } from "@/game/world/calendar";
import { getWorld } from "@/game/world/continent";
import { WORLD_SCALE } from "@/game/world/layout";
import { allWoken, WARDENS, yearQuest } from "@/game/story/year";
import { hasAttire } from "@/game/story/wardrobe";
import { seasonFilter } from "@/game/art/seasons";
import { getProp } from "@/game/art/props";
import { getAnim, getPortrait, WINTER } from "@/game/art/characters";

const surface = () => new BufferSurface(new PixelBuffer(320, 180));

function talkThrough(game: Game, pick = 0, max = 200): void {
  for (let i = 0; i < max && (game.mode === "scene" || game.mode === "shop"); i++) {
    if (game.mode === "shop") game.closeShop();
    else if (game.snapshot().choice) game.choose(pick);
    else {
      game.keyDown("Enter");
      game.keyUp("Enter");
    }
    game.debugSkipTime(0.3);
  }
}

function standBy(game: Game, key: string): void {
  const w = getWorld();
  const n = [...w.npcs, ...w.interacts].find((x) => x.key === key)!;
  for (const [di, dj] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, -1],
    [0, -2],
    [-2, 0],
  ])
    if (w.map.standable(n.i + di, n.j + dj)) return game.debugGoto(n.i + di + 0.5, n.j + dj + 0.5);
  throw new Error(`nowhere to stand by ${key}`);
}

const press = (game: Game, code = "KeyE") => {
  game.keyDown(code);
  game.keyUp(code);
};

describe("the calendar", () => {
  it("runs noon → midnight → noon, two days to a season and four seasons to a year", () => {
    expect(calendarAt(0)).toMatchObject({ season: "spring", day: 1, dayOfSeason: 1, year: 1, phase: "day" });
    expect(calendarAt(0).hour).toBe(12);
    expect(phaseAt(DAY_LENGTH / 2)).toBe("night");
    expect(calendarAt(DAY_LENGTH / 2).dusk).toBeCloseTo(1);
    expect(seasonAt(SEASON_LENGTH)).toBe("summer");
    expect(seasonAt(SEASON_LENGTH * 2.5)).toBe("autumn");
    expect(seasonAt(SEASON_LENGTH * 3 + 1)).toBe("winter");
    expect(seasonAt(YEAR_LENGTH)).toBe("spring");
    expect(calendarAt(YEAR_LENGTH + 1).year).toBe(2);
    // showers fall only in spring and summer
    for (let t = SEASON_LENGTH * 2; t < YEAR_LENGTH; t += 7) expect(rainingAt(t)).toBe(0);
    let wet = 0;
    for (let t = SEASON_LENGTH; t < SEASON_LENGTH * 2; t += 3) wet += rainingAt(t) > 0 ? 1 : 0;
    expect(wet).toBeGreaterThan(0);
  });

  it("is kept in the save: time passed at the almanac, and the hour where she left it", () => {
    let g: GameState = { ...newGame(), playTime: 100 };
    expect(worldTime(g)).toBe(100);
    g = passTime(g, "night");
    expect(calendarAt(worldTime(g)).phase).toBe("night");
    g = passTime(g, "dawn");
    expect(calendarAt(worldTime(g)).phase).toBe("dawn");
    const before = calendarAt(worldTime(g)).season;
    g = passTime(g, "season");
    expect(calendarAt(worldTime(g)).season).not.toBe(before);
    expect(Number.isInteger(g.counters[TIME_SKIP])).toBe(true);
    g = atTimeOfDay(g, 0.5, "winter");
    expect(calendarAt(worldTime(g))).toMatchObject({ season: "winter", phase: "night" });
    // a reloaded game keeps the hour
    const game = new Game(g, { seed: 1 });
    expect(game.snapshot().calendar.season).toBe("winter");
    expect(game.snapshot().calendar.phase).toBe("night");
  });
});

describe("the seasons on the land", () => {
  it("turns leaves gold in autumn and lays snow on top in winter", () => {
    const pine = getProp("pine").frames[0];
    const autumn = seasonFilter(pine, "autumn", { leaves: true });
    const winter = seasonFilter(pine, "winter", { leaves: true, snow: true });
    expect(autumn.width).toBe(pine.width);
    const warm = (b: PixelBuffer) => {
      let n = 0;
      for (let k = 0; k < b.data.length; k += 4) if (b.data[k + 3] && b.data[k] > b.data[k + 1] + 30) n++;
      return n;
    };
    const white = (b: PixelBuffer) => {
      let n = 0;
      for (let k = 0; k < b.data.length; k += 4) if (b.data[k + 3] && b.data[k] > 230 && b.data[k + 1] > 230 && b.data[k + 2] > 230) n++;
      return n;
    };
    expect(warm(autumn)).toBeGreaterThan(warm(pine) * 3);
    expect(white(winter)).toBeGreaterThan(white(pine) + 20);
  });

  it("draws every season by day and night, and the folk wrap up in winter", () => {
    const game = new Game({ ...newGame(), flags: { metElder: true } }, { seed: 2 });
    game.debugTeleport("village", 15, 15);
    const frames: string[] = [];
    for (const season of ["spring", "summer", "autumn", "winter"] as const) {
      for (const k of [0, 0.5]) {
        game.debugSetTime(k, season);
        game.debugSkipTime(0.6);
        const s = surface();
        game.render(s);
        frames.push(Buffer.from(s.buffer.data).toString("base64").slice(0, 2000) + s.buffer.data.reduce((a, v) => (a + v) % 1000003, 0));
      }
      expect(game.snapshot().calendar.season).toBe(season);
    }
    expect(new Set(frames).size).toBe(8);
    // winter: the village folk are in their wool
    expect(game.world.actor("zhou")?.outfit).toBe(WINTER);
    expect(getAnim("villagerM", "idle", 0, WINTER).frames.length).toBeGreaterThan(0);
    expect(getPortrait("monk", WINTER)).toHaveLength(3);
    game.debugSetTime(0, "summer");
    game.debugSkipTime(0.6);
    expect(game.world.actor("zhou")?.outfit).toBeUndefined();
  });

  it("puts lanterns in the folk's hands after dark and turns a banner when the season changes", () => {
    const game = new Game({ ...newGame(), flags: { metElder: true } }, { seed: 2 });
    game.debugTeleport("village", 15, 15);
    game.debugSetTime(0.5, "spring");
    game.debugSkipTime(3);
    const lit = game.world.actors.filter((a) => a.kind === "npc" && a.anim === "lantern");
    expect(lit.length).toBeGreaterThan(0);
    game.debugSetTime(0.999, "spring");
    game.debugSkipTime(0.2);
    game.debugPatch({ playTime: game.state.playTime + SEASON_LENGTH });
    game.debugSkipTime(0.2);
    expect(game.snapshot().banner?.title).toBe("Summer");
  });
});

describe("the Turning of the Year", () => {
  it("Almanac Master Shi starts it, the sundial lets time pass, and the four Wardens wake in their seasons", () => {
    const base: GameState = { ...newGame(), realm: 1, flags: { metElder: true, metZhou: true, villageSaved: true, villageArrived: true, bambooArrived: true, marshArrived: true, terracesArrived: true, harborArrived: true, desertArrived: true } };
    const game = new Game(atTimeOfDay(base, 0.2, "spring"), { seed: 5 });
    game.debugSkipTime(0.2);
    expect(yearQuest(game.state, calendarAt(worldTime(game.state)))?.title).toBe("The Almanac");
    standBy(game, "almanac");
    game.debugSkipTime(0.1);
    press(game);
    expect(game.mode).toBe("scene");
    talkThrough(game);
    expect(game.state.flags.yearMet).toBe(true);
    expect(game.snapshot().year?.title).toContain("Lady Qingming");

    // the sundial: wait for nightfall
    standBy(game, "almanac-dial");
    game.debugSkipTime(0.1);
    press(game);
    expect(game.mode).toBe("scene");
    talkThrough(game, 1);
    expect(game.snapshot().calendar.phase).toBe("night");

    const tomb = getWorld().landmarks.find((l) => l.key === "swordtomb")!;
    const visit = (key: string) => {
      const l = getWorld().landmarks.find((x) => x.key === key)!;
      const m = getWorld().map;
      for (let r = 2; r < 12; r++)
        for (const [di, dj] of [
          [r, 0],
          [0, r],
          [-r, 0],
          [0, -r],
        ])
          if (m.standable(l.x + di, l.y + dj) && Math.hypot(di, dj) < 7 * WORLD_SCALE) {
            game.debugGoto(l.x + di + 0.5, l.y + dj + 0.5);
            game.debugSkipTime(1.2);
            return;
          }
    };
    // spring: sweep the graves, then the Plum Blossom Shrine at dawn
    expect(tomb).toBeDefined();
    visit("swordtomb");
    expect(game.mode).toBe("scene");
    talkThrough(game);
    expect(game.state.flags["yr:swept"]).toBe(true);
    game.debugSetTime(0.0, "spring"); // noon: the warden sleeps on
    visit("plum");
    expect(game.state.flags["woke:spring"]).toBeUndefined();
    game.debugSetTime(0.75, "spring"); // six in the morning
    visit("plum");
    expect(game.mode).toBe("scene");
    press(game, "Enter");
    game.debugSkipTime(0.5);
    game.render(surface());
    expect(game.world.actor("warden-spring")).toBeDefined();
    talkThrough(game);
    expect(game.state.flags["woke:spring"]).toBe(true);
    expect(hasAttire(game.state, WARDENS.spring.outfit)).toBe(true);

    // summer: zongzi from Noodle Seller Hu, the Rainbow Bridge at noon
    game.debugSetTime(0.0, "summer");
    standBy(game, "noodles");
    game.debugSkipTime(0.1);
    press(game);
    talkThrough(game);
    expect(game.state.flags["yr:zongzi"]).toBe(true);
    visit("rainbow");
    talkThrough(game);
    expect(game.state.flags["woke:summer"]).toBe(true);

    // autumn and winter, straight from the save
    game.debugPatch({ flags: { ...game.state.flags, "yr:mooncakes": true, "woke:autumn": true, "yr:tangyuan": true } });
    game.debugSetTime(0.5, "winter");
    visit("spring");
    talkThrough(game);
    expect(game.state.flags["woke:winter"]).toBe(true);
    expect(allWoken(game.state.flags)).toBe(true);

    standBy(game, "almanac");
    game.debugSkipTime(0.1);
    press(game);
    talkThrough(game);
    expect(game.state.flags.yearTurned).toBe(true);
    expect(hasAttire(game.state, "fourseasons")).toBe(true);
    expect(game.snapshot().year).toBeNull();
  });

  it("the wardrobe lists every outfit and puts on the one she picks", () => {
    const game = new Game({ ...newGame(), flags: { metElder: true, "attire:wayfarer": true, "attire:wintersnow": true } }, { seed: 6 });
    game.debugSkipTime(0.2);
    press(game, "KeyV");
    const w = game.snapshot().wardrobe!;
    expect(w.length).toBeGreaterThanOrEqual(21);
    expect(w.filter((a) => a.owned).map((a) => a.id)).toEqual(["jade", "wayfarer", "wintersnow"]);
    expect(w.find((a) => a.id === "empress")!.hint).toMatch(/1000/);
    game.wear("wintersnow");
    expect(game.snapshot().attire.id).toBe("wintersnow");
    game.wear("empress");
    expect(game.snapshot().attire.id).toBe("wintersnow");
    press(game, "Escape");
    expect(game.snapshot().wardrobe).toBeNull();
  });
});
