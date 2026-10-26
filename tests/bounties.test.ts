import { describe, expect, it } from "vitest";
import { ENEMIES } from "@/game/engine/enemies";
import { newGame, SKILL_IDS, type GameState } from "@/game/engine/state";
import { Game } from "@/game/runtime/Game";
import { getWorld, regionAt } from "@/game/world/continent";
import { areaUnlocked, hasNews } from "@/game/story/story";
import { accept, abandon, bounties, bountiesDone, bountiesOf, bountyDone, BOUNTY_COUNT, carried, FOLK, fulfil, MILESTONES, offerFrom, SIGHTS, slotsFree } from "@/game/story/bounties";
import { currentAttire, hasAttire } from "@/game/story/wardrobe";
import { WORLD_SCALE } from "@/game/world/layout";

const OPEN = { metElder: true, metZhou: true, villageSaved: true, villageArrived: true, metHuli: true, bambooArrived: true, lakeArrived: true, marshArrived: true, terracesArrived: true, desertArrived: true, harborArrived: true, frostArrived: true, valleyArrived: true };
const opened = (): GameState => ({ ...newGame(), realm: 1, stage: 0, flags: { ...OPEN } });

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

function talkTo(game: Game, key: string): void {
  const n = getWorld().npcs.find((x) => x.key === key)!;
  const m = getWorld().map;
  for (const [di, dj] of [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
    [1, 1],
    [-1, -1],
  ])
    if (m.standable(n.i + di, n.j + dj)) {
      game.debugGoto(n.i + di + 0.5, n.j + dj + 0.5);
      break;
    }
  game.debugSkipTime(0.1);
  game.keyDown("KeyE");
  game.keyUp("KeyE");
}

describe("the thousand notices of the jianghu", () => {
  it("composes exactly a thousand notices, the same every time, with a dozen or so for each of the folk", () => {
    const all = bounties();
    expect(all).toHaveLength(BOUNTY_COUNT);
    expect(new Set(all.map((b) => b.id)).size).toBe(BOUNTY_COUNT);
    for (const b of all) {
      expect(b.title.length).toBeGreaterThan(3);
      expect(b.ask.length).toBeGreaterThan(20);
      expect(b.objective).not.toMatch(/\{|\}|undefined/);
      expect(b.ask).not.toMatch(/\{|\}|undefined/);
      expect(b.reward.stones).toBeGreaterThan(0);
      expect(b.count).toBeGreaterThanOrEqual(1);
    }
    for (const f of FOLK) expect(bountiesOf(f.key).length).toBeGreaterThanOrEqual(10);
    // every kind of favour is asked for
    const kinds = new Set(all.map((b) => b.kind));
    expect([...kinds].sort()).toEqual(["deliver", "fly", "hunt", "meditate", "night", "ride", "season", "visit"]);
    // and most titles are their own
    expect(new Set(all.map((b) => `${b.giver}:${b.title}`)).size).toBeGreaterThan(900);
  });

  it("only names folk, places and beasts that are really out there", () => {
    const w = getWorld();
    for (const f of FOLK) {
      const n = w.npcs.find((x) => x.key === f.key);
      expect(n, f.key).toBeDefined();
      // always there to be found, in the land the notices say
      expect(n!.when, f.key).toBeUndefined();
      expect(regionAt(w, n!.i, n!.j), f.key).toBe(f.region);
    }
    for (const s of SIGHTS) {
      const l = w.landmarks.find((x) => x.key === s.key);
      expect(l, s.key).toBeDefined();
      expect(regionAt(w, l!.x, l!.y), s.key).toBe(s.region);
    }
    for (const b of bounties()) {
      if (b.kind === "deliver") expect(FOLK.some((f) => f.key === b.to)).toBe(true);
      if (b.kind === "hunt") {
        expect(ENEMIES[b.foe!]).toBeDefined();
        // a beast of that kind roams (and comes back) in that land
        expect(w.enemies.some((e) => !e.when && e.enemy === b.foe && regionAt(w, e.i, e.j) === b.region), `${b.foe} in ${b.region}`).toBe(true);
      }
      if (b.kind === "meditate") expect(w.interacts.some((it) => it.kind === "shrine" && !it.when && regionAt(w, it.i, it.j) === b.region)).toBe(true);
    }
  });

  it("offers only notices whose lands are open, three at a time, and remembers the done ones as bits", () => {
    const fresh = newGame();
    expect(offerFrom("abao", fresh, () => true)).toBeNull();
    let g = opened();
    const open = (id: Parameters<typeof areaUnlocked>[0]) => areaUnlocked(id, g);
    const first = offerFrom("abao", g, open)!;
    expect(first.regions.every(open)).toBe(true);
    for (const k of ["abao", "qing", "feng", "lan"]) {
      const b = offerFrom(k, g, open)!;
      g = accept(g, b.id);
    }
    expect(carried(g)).toHaveLength(3);
    expect(slotsFree(g)).toBe(0);
    const c = carried(g)[0];
    g = fulfil(g, c);
    expect(bountyDone(g, c.bounty.id)).toBe(true);
    expect(bountiesDone(g)).toBe(1);
    expect(carried(g)).toHaveLength(2);
    expect(g.stones).toBe(20 + c.bounty.reward.stones);
    // the next one Ah Bao offers is another
    expect(offerFrom(c.bounty.giver, g, open)?.id).not.toBe(c.bounty.id);
    g = abandon(g, carried(g)[0].slot);
    expect(carried(g)).toHaveLength(1);
    // bits for the highest notice of all
    const last = bounties()[BOUNTY_COUNT - 1];
    g = fulfil(accept(g, last.id), carried(accept(g, last.id)).find((x) => x.bounty.id === last.id)!);
    expect(bountyDone(g, last.id)).toBe(true);
  });

  it("hands out the milestone outfits", () => {
    let g = opened();
    for (let id = 0; id < MILESTONES[0].at; id++) g = fulfil(accept(g, id), carried(accept(g, id)).find((c) => c.bounty.id === id)!);
    expect(bountiesDone(g)).toBe(10);
    expect(hasAttire(g, "ranger")).toBe(true);
    expect(currentAttire(g).id).toBe("ranger");
  });

  it("in the world: a scroll over someone's head, a favour taken, a parcel handed over", () => {
    const game = new Game(opened(), { seed: 3 });
    game.debugSkipTime(0.2);
    // a giver whose next notice is a delivery to someone else
    const b = bounties().find((x) => x.kind === "deliver" && !hasNews(x.giver, game.state) && !hasNews(x.to!, game.state) && x === offerFrom(x.giver, game.state, (id) => areaUnlocked(id, game.state)))!;
    expect(b).toBeDefined();
    talkTo(game, b.giver);
    expect(game.mode).toBe("scene");
    talkThrough(game, 0);
    expect(carried(game.state).map((c) => c.bounty.id)).toContain(b.id);
    expect(game.snapshot().notices[0].title).toBe(b.title);
    // the one it's for wears a parcel marker
    talkTo(game, b.to!);
    talkThrough(game);
    expect(bountyDone(game.state, b.id)).toBe(true);
    expect(game.snapshot().noticesDone).toBe(1);
  });

  it("in the world: a landmark reached on the sword, after dark, and a hunt", () => {
    const g0 = opened();
    const game = new Game({ ...g0, realm: 2, hp: 600, qi: 400, skills: [...SKILL_IDS] }, { seed: 4 });
    game.debugSkipTime(0.2);
    const visit = bounties().find((x) => x.kind === "night")!;
    game.debugPatch({ counters: { ...game.state.counters, "bqa:0": visit.id + 1, "bqp:0": 0 } });
    const l = getWorld().landmarks.find((x) => x.key === visit.landmark)!;
    // by day nothing happens
    game.debugSetTime(0);
    game.debugGoto(l.x + 0.5 + WORLD_SCALE, l.y + 0.5);
    game.debugSkipTime(1.2);
    expect(bountyDone(game.state, visit.id)).toBe(false);
    game.debugSetTime(0.5);
    game.debugSkipTime(1.2);
    expect(game.mode).toBe("scene");
    talkThrough(game);
    expect(bountyDone(game.state, visit.id)).toBe(true);

    const hunt = bounties().find((x) => x.kind === "hunt" && x.foe === "wolf" && x.region === "bamboo" && x.count === 1)!;
    game.debugPatch({ counters: { ...game.state.counters, "bqa:1": hunt.id + 1, "bqp:1": 0 } });
    game.debugTeleport("bamboo", 14.5, 12.5);
    game.debugBattle("wolf", "wolf-a");
    for (let i = 0; i < 40 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: "thunder" });
      game.debugSkipTime(0.5);
    }
    talkThrough(game);
    expect(bountyDone(game.state, hunt.id)).toBe(true);
  });
});
