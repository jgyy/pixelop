"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SKILLS, type BattleAction, type SkillId } from "@/game/engine/battle";
import { PILL_PRICE, type GameState } from "@/game/engine/state";
import { Game, type UiSnapshot } from "@/game/runtime/Game";
import { SCREEN_H, SCREEN_W } from "@/game/scenes";
import { pushSave } from "@/lib/saveClient";
import { useCanvasLoop } from "./useCanvasLoop";

declare global {
  interface Window {
    __pixelop?: { game: Game; save: () => Promise<boolean> };
  }
}

const CAPTURE = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);
const AUTOSAVE_SECONDS = 60;

export function GameView({ initial, onQuit }: { initial: GameState; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game] = useState(() => new Game(structuredClone(initial)));
  const [ui, setUi] = useState<UiSnapshot>(() => game.snapshot());
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  useEffect(() => game.subscribe(setUi), [game]);

  useCanvasLoop(canvasRef, (s, _t, dt) => {
    game.update(dt);
    const [dx, dy] = game.getShake();
    s.ctx.setTransform(1, 0, 0, 1, 0, 0);
    s.rect(0, 0, SCREEN_W, SCREEN_H, "#000000");
    s.ctx.setTransform(1, 0, 0, 1, dx, dy);
    game.render(s);
  });

  const save = useCallback(async () => {
    setSaveMsg("Saving…");
    const ok = await pushSave(game.state).catch(() => false);
    setSaveMsg(ok ? "Saved to the jade slip ✓" : "Save failed");
    setTimeout(() => setSaveMsg(null), 2000);
    return ok;
  }, [game]);

  useEffect(() => {
    window.__pixelop = { game, save };
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (CAPTURE.has(e.code)) e.preventDefault();
      game.keyDown(e.code);
    };
    const up = (e: KeyboardEvent) => game.keyUp(e.code);
    const blur = () => game.releaseAll();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    const autosave = window.setInterval(() => {
      if (game.mode === "explore") void pushSave(game.state).catch(() => false);
    }, AUTOSAVE_SECONDS * 1000);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.clearInterval(autosave);
      if (window.__pixelop?.game === game) delete window.__pixelop;
    };
  }, [game, save]);

  const s = ui.state;
  const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;
  const heroHp = ui.battle ? ui.battle.heroHp : s.hp;
  const heroQi = ui.battle ? ui.battle.heroQi : s.qi;

  return (
    <main className="shell">
      <div className="stage" data-testid="game-stage" data-mode={ui.mode}>
        <canvas ref={canvasRef} width={SCREEN_W} height={SCREEN_H} aria-label="Game view" />
        <div className="overlay">
          <div className="hud panel" data-testid="hud">
            <div className="name">
              <span>{s.name}</span>
              <span style={{ color: "var(--muted)" }}>{ui.regionName}</span>
            </div>
            <div className="realm" style={{ color: ui.realmColour }} data-testid="realm">
              {ui.realm}
            </div>
            <div className="bar hp">
              <i style={{ width: pct(heroHp, ui.stats.maxHp) }} />
              <span>
                HP {heroHp}/{ui.stats.maxHp}
              </span>
            </div>
            <div className="bar qi">
              <i style={{ width: pct(heroQi, ui.stats.maxQi) }} />
              <span>
                QI {heroQi}/{ui.stats.maxQi}
              </span>
            </div>
            <div className={`bar cult${ui.bottleneck ? " full" : ""}`}>
              <i style={{ width: pct(s.cultivation, ui.cultivationNeeded) }} />
              <span>{ui.bottleneck ? "BOTTLENECK · face the tribulation" : `Cultivation ${s.cultivation}/${ui.cultivationNeeded}`}</span>
            </div>
          </div>

          <div className="hud-right">
            <div className="chip panel" data-testid="stones">
              ◆ {s.stones} stones · 💊 {s.pills.heal} · 🔷 {s.pills.qi}
            </div>
            {ui.mode === "explore" && (
              <div className="row">
                <button className="btn" onClick={() => game.toggleFly()} data-testid="fly">
                  {ui.flying ? "Land" : "Fly"}
                </button>
                <button className="btn" onClick={() => void save()} data-testid="save">
                  Save
                </button>
                <button className="btn" onClick={onQuit} data-testid="quit">
                  Title
                </button>
              </div>
            )}
            {saveMsg && (
              <div className="chip panel" data-testid="save-status">
                {saveMsg}
              </div>
            )}
          </div>

          {ui.prompt && (
            <div className="prompt panel" data-testid="prompt">
              {ui.prompt}
            </div>
          )}

          <div className="toasts" data-testid="toasts">
            {ui.toasts.map((t) => (
              <div className="toast" key={t.id}>
                {t.text}
              </div>
            ))}
          </div>

          {ui.dialog && (
            <div className="dialog panel" onClick={() => game.advanceDialog()} data-testid="dialog">
              <div className="speaker">{ui.dialog.speaker}</div>
              <div>{ui.dialog.text}</div>
              <span className="next">
                {ui.dialog.index + 1}/{ui.dialog.total} ▶ E
              </span>
            </div>
          )}

          {ui.mode === "shop" && (
            <div className="shop panel" data-testid="shop">
              <h3>Alchemy Hall Wares</h3>
              <div>You carry ◆ {s.stones} spirit stones.</div>
              <div className="items">
                <button className="btn" onClick={() => game.buy("heal")} disabled={s.stones < PILL_PRICE}>
                  💊 Healing Pill — {PILL_PRICE} stones (own {s.pills.heal})
                </button>
                <button className="btn" onClick={() => game.buy("qi")} disabled={s.stones < PILL_PRICE}>
                  🔷 Qi Gathering Pill — {PILL_PRICE} stones (own {s.pills.qi})
                </button>
              </div>
              <button className="btn primary" onClick={() => game.closeShop()}>
                Farewell, Senior Sister
              </button>
            </div>
          )}

          {ui.battle && <EnemyBar ui={ui} />}

          {ui.tribulation && (
            <div className="tribulation-banner panel" data-testid="tribulation">
              ⚡ {ui.tribulation}
            </div>
          )}
        </div>
      </div>
      {ui.battle && <BattleMenu ui={ui} act={(a) => game.battleAction(a)} />}
      <TouchControls game={game} mode={ui.mode} />
    </main>
  );
}

function EnemyBar({ ui }: { ui: UiSnapshot }) {
  const b = ui.battle!;
  return (
    <div className="battle-top panel" data-testid="battle">
      <div className={b.boss ? "boss" : undefined}>
        {b.boss ? "☠ " : ""}
        {b.enemyName}
      </div>
      <div className="bar enemy">
        <i style={{ width: `${(b.enemyHp / b.enemyMax) * 100}%` }} />
        <span data-testid="enemy-hp">
          {b.enemyHp}/{b.enemyMax}
        </span>
      </div>
    </div>
  );
}

function BattleMenu({ ui, act }: { ui: UiSnapshot; act: (a: BattleAction) => void }) {
  const b = ui.battle!;
  const s = ui.state;
  const busy = b.busy;
  return (
    <>
      <div className="battle-menu" data-testid="battle-menu">
        <div className="skills panel">
          {(Object.keys(SKILLS) as SkillId[]).map((id) => {
            const sk = SKILLS[id];
            return (
              <button key={id} className="btn" disabled={busy || b.heroQi < sk.qi} onClick={() => act({ type: "skill", skill: id })} data-testid={`skill-${id}`}>
                <span className="kbd">{sk.key}</span>
                {sk.name}
                <small>
                  {sk.hanzi} · {sk.qi ? `${sk.qi} qi` : "free"}
                </small>
              </button>
            );
          })}
        </div>
        <div className="battle-log panel">
          {b.log.map((l, i) => (
            <p key={`${b.turn}-${i}`}>{l}</p>
          ))}
          <div className="items">
            <button className="btn" disabled={busy || s.pills.heal <= 0} onClick={() => act({ type: "item", item: "heal" })}>
              <span className="kbd">5</span>💊 {s.pills.heal}
            </button>
            <button className="btn" disabled={busy || s.pills.qi <= 0} onClick={() => act({ type: "item", item: "qi" })}>
              <span className="kbd">6</span>🔷 {s.pills.qi}
            </button>
            <button className="btn danger" disabled={busy || b.boss} onClick={() => act({ type: "flee" })} data-testid="flee">
              <span className="kbd">0</span>Flee
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

function TouchControls({ game, mode }: { game: Game; mode: UiSnapshot["mode"] }) {
  const hold = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      game.keyDown(code);
    },
    onPointerUp: () => game.keyUp(code),
    onPointerLeave: () => game.keyUp(code),
    onPointerCancel: () => game.keyUp(code),
  });
  if (mode === "battle") return null;
  return (
    <div className="touch">
      <div className="pad">
        <button className="btn" {...hold("ArrowLeft")} aria-label="Move left">
          ◀
        </button>
        <button className="btn" {...hold("ArrowRight")} aria-label="Move right">
          ▶
        </button>
      </div>
      <div className="acts">
        <button className="btn" {...hold("Space")}>
          Jump
        </button>
        <button className="btn" {...hold("KeyE")}>
          E
        </button>
        <button className="btn" {...hold("KeyB")}>
          B
        </button>
      </div>
    </div>
  );
}
