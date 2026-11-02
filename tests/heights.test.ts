import { describe, expect, it } from "vitest";
import { charDef, getAnim, hasAnim, type AnimId } from "@/game/art/characters";
import { getProp } from "@/game/art/props";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { BufferSurface } from "@/game/pixel/surface";
import { resolveTurn, SKILLS, startBattle } from "@/game/engine/battle";
import { CRAFT_DEFS, CRAFTS } from "@/game/engine/crafts";
import { applyBreakthrough, GameStateSchema, learn, newGame, SKILL_IDS, type GameState } from "@/game/engine/state";
import { Game } from "@/game/runtime/Game";
import { World } from "@/game/runtime/world";
import { heightsNpcScript } from "@/game/story/heights";
import { npcScript } from "@/game/story/story";
import type { Step } from "@/game/story/script";
import { getWorld } from "@/game/world/continent";
import { CITY, cityGround, GROVES, groveBridges, HEIGHTS_CAST, pillars, PORT, ringHeight, stairAngle, SUMMIT_H } from "@/game/world/heights";
import { WORLD_SCALE } from "@/game/world/layout";
import { LIQUID } from "@/game/world/tilemap";
import { loopLengths, SEA_LANES, SKY_LANES, voyageAt } from "@/game/world/voyages";
import { COURTS, WANDERING_CRAFTS } from "@/game/world/courts";

const S = WORLD_SCALE;

/** Every world tile she can walk to from a start (a level a step at most), as a mask. */
function walkable(from: [number, number]): Uint8Array {
  const m = getWorld().map;
  const seen = new Uint8Array(m.w * m.h);
  const q = [from[1] * m.w + from[0]];
  seen[q[0]] = 1;
  for (let n = 0; n < q.length; n++) {
    const c = q[n];
    const i = c % m.w;
    const j = (c - i) / m.w;
    for (const [a, b] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const ni = i + a;
      const nj = j + b;
      const k = nj * m.w + ni;
      if (!m.inside(ni, nj) || seen[k] || !m.standable(ni, nj) || Math.abs(m.height(ni, nj) - m.height(i, j)) > 1) continue;
      seen[k] = 1;
      q.push(k);
    }
  }
  return seen;
}

/** Is any tile of a level within r of a world point in the mask? */
function reaches(mask: Uint8Array, x: number, y: number, h: number, r = 10): boolean {
  const m = getWorld().map;
  for (let b = -r; b <= r; b++)
    for (let a = -r; a <= r; a++) {
      const i = Math.round(x) + a;
      const j = Math.round(y) + b;
      if (m.inside(i, j) && mask[j * m.w + i] && m.height(i, j) === h) return true;
    }
  return false;
}

const run = (g: GameState, steps: Step[]) => steps.reduce((s, st) => ("mutate" in st ? st.mutate(s) : s), g);

describe("the Southern Heights", () => {
  it("stand up out of the land: the Hanging City's terraces, the pillars and the port's steps", () => {
    const m = getWorld().map;
    const [cx, cy] = CITY.c;
    // each terrace six levels above the last, up to a summit thirty-eight levels high
    for (let k = 0; k < CITY.RINGS; k++) {
      const r = CITY.R - k * CITY.W - 1.5;
      const a = stairAngle(k) + Math.PI;
      const i = Math.floor((cx + Math.cos(a) * r) * S);
      const j = Math.floor((cy + Math.sin(a) * r) * S);
      expect(m.height(i, j), `terrace ${k}`).toBe(ringHeight(k));
    }
    expect(SUMMIT_H).toBe(38);
    expect(m.height(cx * S + 8, cy * S - 8)).toBe(SUMMIT_H);
    // no two stairs climb at the same angle, so every climb is a walk round the mountain
    const angles = Array.from({ length: CITY.RINGS }, (_, k) => (((stairAngle(k) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(2));
    expect(new Set(angles).size).toBe(CITY.RINGS);
    // the falls run down the south face, with a plank bridge on every terrace
    expect(cityGround(cx, cy + 30)?.kind).toMatch(/water|wood/);
    // pillars of ten to thirty levels, the grove pillars joined by stone bridges
    const ps = pillars();
    expect(ps.length).toBeGreaterThan(30);
    for (const p of ps) expect(m.height(p.c[0] * S, p.c[1] * S), `pillar ${p.c}`).toBe(p.h);
    expect(Math.max(...ps.map((p) => p.h))).toBeGreaterThanOrEqual(40);
    expect(groveBridges().length).toBeGreaterThan(5);
    // the port: five steps down the cliff to its quay, and water off the quay
    for (let t = 0; t < PORT.T; t++) expect(m.height((PORT.quay - t * PORT.W - 3) * S, (PORT.y0 + 20) * S), `step ${t}`).toBe(1 + PORT.RISE * t);
    expect(LIQUID[m.kind((PORT.quay + 12) * S, (PORT.y0 + 16) * S)]).toBe("water");
  });

  it("can all be walked: from the Stairlands to the summit, up every grove pillar and down to the quay", () => {
    const mask = walkable([222 * S, 640 * S]);
    const [cx, cy] = CITY.c;
    expect(reaches(mask, cx * S + 8, cy * S + 8, SUMMIT_H), "the summit").toBe(true);
    GROVES.forEach((g, n) => expect(reaches(mask, g.c[0] * S, g.c[1] * S, g.h), `grove ${n}`).toBe(true));
    for (const p of pillars().filter((x) => x.grove >= 0)) expect(reaches(mask, p.c[0] * S, p.c[1] * S, p.h), `grove pillar ${p.c}`).toBe(true);
    for (let t = 0; t < PORT.T; t++) expect(reaches(mask, (PORT.quay - t * PORT.W - 3) * S, ((PORT.y0 + PORT.y1) / 2) * S, 1 + PORT.RISE * t), `port step ${t}`).toBe(true);
  }, 60_000);

  it("are on the world map, furnished and peopled, and every one of their folk has something to say", () => {
    const w = getWorld();
    for (const k of ["xuancheng", "pillars", "yagang"]) expect(w.landmarks.some((l) => l.key === k), k).toBe(true);
    expect(w.props.filter((p) => p.id === "hoist").length).toBeGreaterThan(5);
    expect(w.props.filter((p) => p.id === "pagoda" || p.id === "lighthouse" || p.id === "pavilion").length).toBeGreaterThan(3);
    const folk = w.npcs.filter((n) => /^(xc|pf|yg)-/.test(n.key));
    expect(folk.length).toBeGreaterThan(40);
    expect(folk.filter((n) => n.jobs).length).toBeGreaterThan(20);
    const g = { ...newGame(), flags: { metElder: true } };
    for (const n of folk) {
      const s = heightsNpcScript(n.key, g);
      expect(s, n.key).not.toBeNull();
      expect(npcScript(n.key, g).length, n.key).toBeGreaterThan(0);
    }
    // everyone at work can do the work they are given
    for (const n of folk) for (const j of n.jobs ?? []) expect(charDef(n.char).anims, `${n.key} ${j.anim}`).toContain(j.anim);
  });
});

describe("ships and fliers", () => {
  it("chart every sea lane over the water and every sky lane overhead", () => {
    const w = getWorld();
    const vs = w.voyages ?? [];
    for (const L of SEA_LANES) expect(vs.some((v) => v.key.startsWith(`voy-${L.key}-`)), L.key).toBe(true);
    for (const L of SKY_LANES) expect(vs.some((v) => v.key.startsWith(`voy-${L.key}-`)), L.key).toBe(true);
    const m = w.map;
    for (const v of vs.filter((x) => x.alt === 0)) {
      const L = loopLengths(v.route);
      const total = L[L.length - 1];
      for (let s = 0; s < total; s += 0.5) {
        const p = voyageAt({ ...v, speed: 1, phase: 0 }, s, L);
        const k = m.kind(Math.floor(p.x), Math.floor(p.y));
        // on the water, or slipping under one of the isles' plank bridges
        expect(!!LIQUID[k] || k === "wood", `${v.key} at ${p.x.toFixed(1)},${p.y.toFixed(1)}: ${k}`).toBe(true);
      }
    }
    expect(vs.filter((x) => x.alt > 0).length).toBeGreaterThan(15);
    expect(vs.filter((x) => x.char === "junk").length).toBeGreaterThanOrEqual(4);
  });

  it("keep sailing and flying round their loops in the world, whoever is watching", () => {
    const w = getWorld();
    const world = new World(w, { x: CITY.c[0] * S, y: (CITY.c[1] - CITY.R - 4) * S, dir: 0 }, {}, []);
    const ships = world.actors.filter((a) => a.voyage);
    expect(ships.length).toBe(w.voyages!.length);
    const before = ships.map((a) => [a.x, a.y]);
    for (let t = 0; t < 40; t++) world.update(0.25, 1 + t * 0.25, true);
    ships.forEach((a, n) => expect(Math.hypot(a.x - before[n][0], a.y - before[n][1]), a.key).toBeGreaterThan(1));
    // a flier is up in the air, a ship sits on the water
    const flier = ships.find((a) => a.voyage!.alt > 0)!;
    expect(flier.z - world.groundZ(flier.x, flier.y)).toBeGreaterThan(2);
    const ship = ships.find((a) => a.char === "junk")!;
    expect(Math.abs(ship.z - world.groundZ(ship.x, ship.y))).toBeLessThan(0.5);
  });

  it("paint the junk, the skiff and the cloud-ship in every facing, and the hoist", () => {
    for (const id of ["junk", "skiff", "skyjunk"] as const) {
      const keys = new Set<string>();
      for (const d of [0, 4, 8, 12]) {
        const a = getAnim(id, "idle", d);
        expect(a.frames.length).toBe(6);
        expect(a.frames[0].width).toBe(charDef(id).w);
        expect(a.frames[0].opaqueCount()).toBeGreaterThan(300);
        keys.add(Buffer.from(a.frames[0].data).toString("base64"));
      }
      expect(keys.size, id).toBe(4);
    }
    const hoist = getProp("hoist");
    expect(hoist.frames.length).toBe(12);
    expect(Buffer.from(hoist.frames[0].data).equals(Buffer.from(hoist.frames[6].data))).toBe(false);
  });
});

describe("the arts and the techniques move", () => {
  it("gives every art moves of its own, which the heroine and its master both have", () => {
    const masters = [...COURTS.map((c) => [c.craft, c.master.char] as const), ...WANDERING_CRAFTS.map((w) => [w.craft, w.master.char] as const)];
    for (const c of CRAFTS) {
      const D = CRAFT_DEFS[c];
      expect(D.moves.length, c).toBeGreaterThanOrEqual(2);
      for (const mv of D.moves) expect(hasAnim("heroine", mv), `${c} ${mv}`).toBe(true);
      for (const [craft, char] of masters) if (craft === c) for (const mv of D.moves) expect(hasAnim(char, mv), `${char} ${mv}`).toBe(true);
    }
    // and the masters go round them at their workshops
    const w = getWorld();
    const jobs = w.npcs.filter((n) => /^(ct-\d-master|craftmaster:)/.test(n.key) && n.jobs && n.jobs.length >= 2);
    expect(jobs.length).toBeGreaterThanOrEqual(6);
  });

  it("paints the new moves: different frames, each one different from standing idle", () => {
    const moves: AnimId[] = ["water", "harvest", "bellows", "quench", "pillroll", "lidlift", "talismantoss", "sealpress", "luopan", "pace", "feed", "whistle", "acupuncture", "moxa", "wok", "chopveg", "dash", "palmstrike", "swordcall", "lotussutra", "thundercall", "whirl", "thrust", "phoenix", "starfall"];
    const idle = Buffer.from(getAnim("heroine", "idle", 2).frames[0].data).toString("base64");
    for (const mv of moves) {
      const a = getAnim("heroine", mv, 2);
      const frames = new Set(a.frames.map((f) => Buffer.from(f.data).toString("base64")));
      expect(frames.size, mv).toBeGreaterThan(2);
      expect(frames.has(idle), mv).toBe(false);
    }
    for (const [id, mv] of [
      ["monk", "cloudride"],
      ["discipleF", "fly"],
      ["villagerM", "haul"],
    ] as const)
      expect(getAnim(id, mv, 5).frames.length, `${id} ${mv}`).toBeGreaterThan(2);
  });

  it("opens the dragon and the phoenix with the realms, and the heights teach the other two", () => {
    expect(SKILL_IDS).toHaveLength(9);
    const g0 = newGame();
    for (const id of ["whirlwind", "dragon", "phoenix", "starfall"] as const) expect(g0.skills).not.toContain(id);
    // an old save of a Nascent Soul cultivator gets the dragon on loading
    const old = GameStateSchema.parse({ ...g0, realm: 3, skills: ["strike", "palm", "lotus", "thunder"] });
    expect(old.skills).toContain("dragon");
    expect(old.skills).not.toContain("phoenix");
    const peak = { ...g0, realm: 3, stage: 3, cultivation: 1e9 };
    expect(applyBreakthrough(peak).skills).toContain("phoenix");
    // the hermit on the tallest pillar teaches the whirlwind to whoever climbs to him
    const h = run(g0, heightsNpcScript(HEIGHTS_CAST.hermit.key, g0)!);
    expect(h.skills).toContain("whirlwind");
    expect(heightsNpcScript(HEIGHTS_CAST.hermit.key, h)!.some((s) => "mutate" in s)).toBe(false);
    // Lady Xuan waits for a laid foundation
    expect(run(g0, heightsNpcScript(HEIGHTS_CAST.lord.key, g0)!).skills).not.toContain("starfall");
    const f = { ...g0, realm: 1 };
    expect(run(f, heightsNpcScript(HEIGHTS_CAST.lord.key, f)!).skills).toContain("starfall");
  });

  it("strikes with every new technique, the starfall healing a little", () => {
    let g = { ...newGame(), realm: 4, stage: 0, qi: 999, hp: 10 };
    for (const id of ["whirlwind", "dragon", "phoenix", "starfall"] as const) g = learn(g, id);
    for (const id of ["whirlwind", "dragon", "phoenix", "starfall"] as const) {
      const r = resolveTurn(g, startBattle("wolf", 7), { type: "skill", skill: id });
      const ev = r.events.find((e) => e.kind === "playerSkill");
      expect(ev, id).toBeTruthy();
      if (ev?.kind === "playerSkill") {
        expect(ev.hits.length, id).toBe(SKILLS[id].hits);
        if (id === "starfall") expect(ev.heal).toBeGreaterThan(0);
      }
    }
  });

  it("plays every technique through in battle", () => {
    const game = new Game(newGame());
    game.debugPatch({ realm: 5, stage: 0, hp: 5000, qi: 5000, skills: [...SKILL_IDS] });
    game.debugBattle("fox");
    const surface = new BufferSurface(new PixelBuffer(320, 180));
    const order = SKILL_IDS.slice().reverse();
    for (let i = 0; i < 60 && game.mode === "battle"; i++) {
      game.battleAction({ type: "skill", skill: order[i % order.length] });
      game.debugSkipTime(0.4);
      game.render(surface);
    }
    expect(game.mode).toBe("explore");
  });
});
