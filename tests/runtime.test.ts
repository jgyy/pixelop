import { describe, expect, it } from "vitest";
import { PixelBuffer } from "@/game/pixel/PixelBuffer";
import { BufferSurface } from "@/game/pixel/surface";
import { cultivationNeeded } from "@/game/engine/realms";
import { newGame } from "@/game/engine/state";
import { REGIONS } from "@/game/engine/world";
import { Game, type UiSnapshot } from "@/game/runtime/Game";
import { renderTitle } from "@/game/runtime/title";
import { SCREEN_H, SCREEN_W } from "@/game/scenes";

const surface = () => new BufferSurface(new PixelBuffer(SCREEN_W, SCREEN_H));

describe("Game runtime", () => {
  it("walks the heroine and renders frames", () => {
    const game = new Game(newGame(), 1);
    const x0 = game.state.x;
    game.keyDown("ArrowRight");
    game.debugSkipTime(1);
    game.keyUp("ArrowRight");
    expect(game.state.x).toBeGreaterThan(x0 + 50);
    const s = surface();
    game.render(s);
    expect(s.buffer.opaqueCount()).toBe(SCREEN_W * SCREEN_H);
  });

  it("talks to the elder and remembers it", () => {
    const game = new Game({ ...newGame(), x: REGIONS.sect.npcs[0].x }, 1);
    game.debugSkipTime(0.1);
    game.keyDown("KeyE");
    expect(game.mode).toBe("dialog");
    for (let i = 0; i < 10 && game.mode === "dialog"; i++) game.advanceDialog();
    expect(game.mode).toBe("explore");
    expect(game.state.flags.metElder).toBe(true);
  });

  it("plays out a battle to victory", () => {
    const game = new Game({ ...newGame(), realm: 2, stage: 0, hp: 500, qi: 200 }, 3);
    const snaps: UiSnapshot[] = [];
    game.subscribe((s) => snaps.push(s));
    game.debugBattle("fox");
    expect(game.mode).toBe("battle");
    for (let i = 0; i < 12 && game.mode === "battle"; i++) {
      game.debugSkipTime(0.8);
      game.battleAction({ type: "skill", skill: "palm" });
      const s = surface();
      game.render(s);
      game.debugSkipTime(3);
    }
    expect(game.mode).toBe("explore");
    expect(game.state.kills).toBe(1);
    expect(snaps.some((s) => s.battle?.log.some((l) => l.startsWith("Victory")))).toBe(true);
  });

  it("meditates and survives the heavenly tribulation", () => {
    const peak = { ...newGame(), stage: 3, cultivation: cultivationNeeded(0, 3) - 1, x: REGIONS.sect.shrineX! };
    const game = new Game(peak, 2);
    game.debugSkipTime(0.1);
    game.keyDown("KeyE");
    game.keyUp("KeyE");
    expect(game.mode).toBe("meditate");
    game.debugSkipTime(1.2);
    expect(game.snapshot().bottleneck).toBe(true);
    game.keyDown("KeyB");
    expect(game.mode).toBe("tribulation");
    game.render(surface());
    game.debugSkipTime(9);
    expect(game.mode).toBe("explore");
    expect(game.state.realm).toBe(1);
  });

  it("blocks sealed regions and travels through open gates", () => {
    const game = new Game({ ...newGame(), region: "lake", x: REGIONS.lake.width - 45 }, 4);
    game.debugSkipTime(0.1);
    game.keyDown("KeyE");
    expect(game.state.region).toBe("lake");
    expect(game.snapshot().toasts.at(-1)?.text).toMatch(/sealed/);
    const g2 = new Game({ ...newGame(), x: REGIONS.sect.width - 45 }, 4);
    g2.debugSkipTime(0.1);
    g2.keyDown("KeyE");
    expect(g2.state.region).toBe("bamboo");
  });

  it("draws the title screen", () => {
    const s = surface();
    renderTitle(s, 3);
    expect(s.buffer.opaqueCount()).toBe(SCREEN_W * SCREEN_H);
  });
});
