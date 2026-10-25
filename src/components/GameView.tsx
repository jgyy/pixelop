"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPortrait, PORTRAIT, type HumanId } from "@/game/art/characters";
import { SKILLS, type BattleAction } from "@/game/engine/battle";
import { PILL_PRICE, type GameState } from "@/game/engine/state";
import { Game, type UiSnapshot } from "@/game/runtime/Game";
import { CanvasSurface } from "@/game/runtime/CanvasSurface";
import { pushSave } from "@/lib/saveClient";
import { useCanvasLoop } from "./useCanvasLoop";

declare global {
  interface Window {
    __pixelop?: { game: Game; save: () => Promise<boolean> };
  }
}

const CAPTURE = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space"]);
const CONFIRM = new Set(["KeyE", "Enter", "Space", "NumpadEnter"]);
const AUTOSAVE_SECONDS = 60;
const TYPE_CPS = 60;

export function GameView({ initial, intro, onQuit }: { initial: GameState; intro: boolean; onQuit: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [game] = useState(() => new Game(structuredClone(initial), { intro }));
  const [ui, setUi] = useState<UiSnapshot>(() => game.snapshot());
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const typing = useRef<{ done: boolean; finish: () => void }>({ done: true, finish: () => undefined });

  useEffect(() => game.subscribe(setUi), [game]);

  const scale = useCanvasLoop(
    canvasRef,
    (s, _t, dt) => {
      game.update(dt);
      const [dx, dy] = game.getShake();
      s.ctx.setTransform(1, 0, 0, 1, 0, 0);
      s.rect(0, 0, s.width, s.height, "#000000");
      s.ctx.setTransform(1, 0, 0, 1, dx, dy);
      game.render(s);
    },
    { fit: true },
  );

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
      // browser shortcuts (Ctrl+F to find, Ctrl+R to reload, Cmd+C to copy) are not game keys
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (CAPTURE.has(e.code)) e.preventDefault();
      if (game.mode === "scene" && CONFIRM.has(e.code) && !typing.current.done) {
        typing.current.finish();
        return;
      }
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

  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // like Enter, a tap on the scene first finishes a line still being typed out
    if (game.mode === "scene" && ui.dialog && !typing.current.done) return typing.current.finish();
    const rect = e.currentTarget.getBoundingClientRect();
    const k = scale.current || 1;
    game.tap((e.clientX - rect.left) / k, (e.clientY - rect.top) / k);
  };

  const s = ui.state;
  const pct = (a: number, b: number) => `${Math.max(0, Math.min(100, (a / Math.max(1, b)) * 100))}%`;
  const heroHp = ui.battle ? ui.battle.heroHp : s.hp;
  const heroQi = ui.battle ? ui.battle.heroQi : s.qi;
  const exploring = ui.mode === "explore" || ui.mode === "meditate";

  return (
    <main className="screen" data-testid="game-stage" data-mode={ui.mode}>
      <canvas ref={canvasRef} className="pixel-canvas" aria-label="Game view" onPointerDown={onCanvasPointer} />
      <div className="overlay">
        {ui.mode !== "worldmap" && !ui.narration && (
          <div className="hud panel" data-testid="hud">
            <div className="name">
              <span>{s.name}</span>
              <span className="muted" data-testid="place">{ui.interior ? ui.interior.name : ui.area.name}</span>
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
        )}

        {ui.mode !== "battle" && !ui.narration && (
          <div className="quest panel" data-testid="quest">
            <div className="chapter">
              {ui.quest.chapter} · {ui.quest.title}
            </div>
            <div className="objective">{ui.quest.objective}</div>
            {ui.errand && (
              <div className="errand" data-testid="errand">
                ✦ {ui.errand}
              </div>
            )}
            {ui.sectQuest && (
              <div className="errand sect" data-testid="sect-quest">
                ◈ {ui.sectQuest}
              </div>
            )}
          </div>
        )}

        <div className="hud-right">
          <div className="chip panel" data-testid="stones">
            ◆ {s.stones} · 💊 {s.pills.heal} · 🔷 {s.pills.qi}
          </div>
          {exploring && (
            <div className="row">
              <button className="btn" onClick={() => game.openMap()} data-testid="map">
                Map <span className="kbd">M</span>
              </button>
              {s.flags.metElder && (
                <button className="btn" onClick={() => game.toggleFly()} data-testid="fly">
                  {ui.flying ? "Land" : "Fly"} <span className="kbd">F</span>
                </button>
              )}
              {s.flags.metElder && !ui.interior && (
                <button className="btn" onClick={() => game.toggleRide()} data-testid="ride">
                  {ui.riding ? "Dismount" : "Ride"} <span className="kbd">R</span>
                </button>
              )}
              {ui.attire.owned > 1 && (
                <button className="btn" onClick={() => game.changeAttire()} data-testid="attire" title={ui.attire.name}>
                  Attire <span className="kbd">C</span>
                </button>
              )}
              <button className="btn" onClick={() => game.toggleJournal()} data-testid="journal-button">
                Journal <span className="kbd">J</span>
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

        {ui.banner && (
          <div className="banner" key={ui.banner.seq} data-testid="banner">
            <span className="cn">{ui.banner.hanzi}</span>
            <strong>{ui.banner.title}</strong>
            <small>{ui.banner.subtitle}</small>
          </div>
        )}

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

        {ui.dialog && <Dialog key={ui.dialog.seq} dialog={ui.dialog} onAdvance={() => game.advance()} typingRef={typing} />}

        {ui.choice && (
          <div className="choice panel" key={ui.choice.seq} data-testid="choice">
            {ui.choice.prompt && <div className="prompt-text">{ui.choice.prompt}</div>}
            <ol>
              {ui.choice.options.map((o, k) => (
                <li key={o.label}>
                  <button className={`btn${k === ui.choice!.selected ? " primary" : ""}`} onClick={() => game.choose(k)} data-testid={`choice-${k}`}>
                    <span className="kbd">{k + 1}</span>
                    {o.label}
                    {o.hint && <small>{o.hint}</small>}
                  </button>
                </li>
              ))}
            </ol>
            <span className="next">
              <span className="kbd">1</span>–<span className="kbd">{ui.choice.options.length}</span> or ↑↓ · E · choose wisely, the jianghu remembers
            </span>
          </div>
        )}

        {ui.narration && (
          <div className="narration" onClick={() => game.advance()} data-testid="narration">
            <p key={ui.narration.index}>{ui.narration.text}</p>
            <span className="next">
              {ui.narration.index + 1}/{ui.narration.total} ▶ Enter
            </span>
          </div>
        )}

        {ui.canSkip && (
          <button className="btn skip" onClick={() => game.skipScene()} data-testid="skip">
            Skip <span className="kbd">Esc</span>
          </button>
        )}

        {ui.mode === "shop" && (
          <div className="shop panel" data-testid="shop">
            <h3>Alchemy Hall Wares</h3>
            <div>You carry ◆ {s.stones} spirit stones.</div>
            <div className="items">
              <button className="btn" onClick={() => game.buy("heal")} disabled={s.stones < PILL_PRICE}>
                <span className="kbd">1</span>💊 Healing Pill — {PILL_PRICE} stones (own {s.pills.heal})
              </button>
              <button className="btn" onClick={() => game.buy("qi")} disabled={s.stones < PILL_PRICE}>
                <span className="kbd">2</span>🔷 Qi Gathering Pill — {PILL_PRICE} stones (own {s.pills.qi})
              </button>
            </div>
            <button className="btn primary" onClick={() => game.closeShop()} data-testid="shop-close">
              Farewell, Senior Sister
            </button>
          </div>
        )}

        {ui.mode === "meditate" && (
          <div className="meditate panel" data-testid="meditating">
            Meditating… <span className="kbd">E</span> stand up {ui.bottleneck && <>· <span className="kbd">B</span> face the Heavenly Tribulation</>}
            {ui.bottleneck && (
              <button className="btn primary" onClick={() => game.startTribulation()} data-testid="tribulate">
                Face the Tribulation
              </button>
            )}
          </div>
        )}

        {ui.worldmap && <WorldMapPanel ui={ui} game={game} />}

        {ui.journal && <JournalPanel journal={ui.journal} onClose={() => game.toggleJournal()} />}

        {ui.battle && <EnemyBar ui={ui} />}
        {ui.battle && <BattleMenu ui={ui} act={(a) => game.battleAction(a)} />}

        {ui.tribulation && (
          <div className="tribulation-banner panel" data-testid="tribulation">
            ⚡ {ui.tribulation}
          </div>
        )}
      </div>
      {(ui.mode === "explore" || ui.mode === "scene" || ui.mode === "meditate") && <TouchControls game={game} typing={typing} />}
    </main>
  );
}

/** One line of dialogue, typed out letter by letter (remounted per line via `key`). */
function Dialog({ dialog, onAdvance, typingRef }: { dialog: NonNullable<UiSnapshot["dialog"]>; onAdvance: () => void; typingRef: React.RefObject<{ done: boolean; finish: () => void }> }) {
  const [shown, setShown] = useState(0);
  const total = dialog.text.length;
  useEffect(() => {
    const start = performance.now();
    const id = window.setInterval(() => {
      const n = Math.min(total, Math.floor(((performance.now() - start) / 1000) * TYPE_CPS));
      // never type backwards over a line the player already skipped to the end of
      setShown((s) => Math.max(s, n));
      if (n >= total) window.clearInterval(id);
    }, 16);
    return () => window.clearInterval(id);
  }, [total]);
  const done = shown >= total;
  useEffect(() => {
    typingRef.current = { done, finish: () => setShown(total) };
  }, [done, total, typingRef]);
  // once the line is gone (skipped, or the scene ended), nothing is being typed any more:
  // a stale "still typing" would swallow the next Enter meant for a question or the next scene
  useEffect(() => () => void (typingRef.current = { done: true, finish: () => undefined }), [typingRef]);
  return (
    <div className={`dialog panel${dialog.portrait ? " with-portrait" : ""}${dialog.speaker ? "" : " narrator"}`} onClick={() => (done ? onAdvance() : setShown(total))} data-testid="dialog">
      {dialog.portrait && <Portrait id={dialog.portrait} outfit={dialog.outfit} talking={!done} />}
      <div className="body">
        {dialog.speaker && <div className="speaker">{dialog.speaker}</div>}
        <div className="text">
          {dialog.text.slice(0, shown)}
          <span className="ghost">{dialog.text.slice(shown)}</span>
        </div>
      </div>
      <span className="next">{done ? "▶ E" : "…"}</span>
    </div>
  );
}

function Portrait({ id, outfit, talking }: { id: HumanId; outfit?: string; talking: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const talkRef = useRef(talking);
  useEffect(() => {
    talkRef.current = talking;
  });
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const surface = new CanvasSurface(ctx);
    const frames = getPortrait(id, outfit);
    let raf = 0;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const t = now / 1000;
      const f = talkRef.current ? (Math.floor(t * 8) % 2 ? 1 : 0) : t % 3.2 < 0.14 ? 2 : 0;
      ctx.clearRect(0, 0, PORTRAIT, PORTRAIT);
      surface.sprite(frames[f], 0, 0);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [id, outfit]);
  return <canvas ref={ref} className="portrait" width={PORTRAIT} height={PORTRAIT} data-testid="portrait" />;
}

/** The quest journal: the tale, the errands, the sects' troubles, and how each sect regards her. */
function JournalPanel({ journal, onClose }: { journal: NonNullable<UiSnapshot["journal"]>; onClose: () => void }) {
  return (
    <div className="journal panel" data-testid="journal">
      <h3>Journal · 江湖录</h3>
      <section>
        <h4>
          {journal.main.chapter} · {journal.main.title}
        </h4>
        <p>{journal.main.objective}</p>
        {journal.errands.map((e) => (
          <p key={e} className="errand">
            ✦ {e}
          </p>
        ))}
      </section>
      <section>
        <h4>The Sects</h4>
        <ul className="standing">
          {journal.standing.map((s) => (
            <li key={s.id} className={`rep-${s.label.toLowerCase()}`} data-testid={`standing-${s.id}`}>
              <span className="cn">{s.hanzi}</span> {s.name} <b>{s.label}</b>
              <i className="pips" aria-hidden>
                {Array.from({ length: 7 }, (_, k) => (
                  <span key={k} className={k - 3 === Math.max(-3, Math.min(3, s.rep)) ? "on" : k - 3 < 0 ? "neg" : "pos"} />
                ))}
              </i>
            </li>
          ))}
        </ul>
        {journal.sects.map((e) => (
          <div key={e.title} className={`entry${e.done ? " done" : ""}${e.sect === "rumour" ? " rumour" : ""}`}>
            <strong>
              {e.done ? "✔ " : e.sect === "rumour" ? "? " : "◈ "}
              {e.title}
            </strong>
            <p>{e.objective}</p>
          </div>
        ))}
      </section>
      <button className="btn primary" onClick={onClose} data-testid="journal-close">
        Close <span className="kbd">J</span>
      </button>
    </div>
  );
}

function WorldMapPanel({ ui, game }: { ui: UiSnapshot; game: Game }) {
  const wm = ui.worldmap!;
  return (
    <div className="worldmap panel" data-testid="worldmap">
      <h3>The Jianghu</h3>
      <ul>
        {wm.nodes.map((n) => {
          const here = n.id === wm.at && !wm.travelling;
          return (
            <li key={n.id} className={n.locked ? "locked" : here ? "here" : undefined}>
              <button className="btn" disabled={!!n.locked || wm.travelling} onClick={() => game.mapSelect(n.id)} data-testid={`map-${n.id}`}>
                <span className="cn">{n.hanzi}</span> {n.name}
                <small>{n.locked ?? (here ? "▶ Land here (E)" : n.subtitle)}</small>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hint">
        <span className="kbd">←↑→↓</span> fly along roads · <span className="kbd">E</span> land · <span className="kbd">M</span> close
      </div>
      <button className="btn" onClick={() => game.closeMap()} disabled={wm.travelling} data-testid="map-close">
        {wm.at === ui.area.id ? "Close map" : "Land"}
      </button>
    </div>
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
    <div className="battle-menu" data-testid="battle-menu">
      <div className="skills panel">
        {b.skills.map((id) => {
          const sk = SKILLS[id];
          return (
            <button key={id} className="btn" disabled={busy || b.heroQi < sk.qi} onClick={() => act({ type: "skill", skill: id })} data-testid={`skill-${id}`} title={sk.description}>
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
          <p key={`${i}-${l}`}>{l}</p>
        ))}
        <div className="items">
          <button className="btn" disabled={busy || s.pills.heal <= 0} onClick={() => act({ type: "item", item: "heal" })}>
            <span className="kbd">6</span>💊 {s.pills.heal}
          </button>
          <button className="btn" disabled={busy || s.pills.qi <= 0} onClick={() => act({ type: "item", item: "qi" })}>
            <span className="kbd">7</span>🔷 {s.pills.qi}
          </button>
          <button className="btn danger" disabled={busy || b.boss} onClick={() => act({ type: "flee" })} data-testid="flee">
            <span className="kbd">0</span>Flee
          </button>
        </div>
      </div>
    </div>
  );
}

/** Virtual joystick + action buttons for touch screens. */
function TouchControls({ game, typing }: { game: Game; typing: React.RefObject<{ done: boolean; finish: () => void }> }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.max(1, Math.hypot(x, y));
    setKnob([x / l, y / l]);
    game.setStick(x / l, y / l);
  };
  const end = () => {
    setKnob([0, 0]);
    game.setStick(0, 0);
  };
  const press = (code: string) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      // like Enter on a keyboard, E first finishes a line of dialogue that is still being typed out
      if (code === "KeyE" && game.mode === "scene" && !typing.current.done) return typing.current.finish();
      game.keyDown(code);
    },
    onPointerUp: () => game.keyUp(code),
    onPointerLeave: () => game.keyUp(code),
    onPointerCancel: () => game.keyUp(code),
  });
  return (
    <div className="touch">
      <div
        className="stick"
        ref={base}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => e.buttons && move(e)}
        onPointerUp={end}
        onPointerCancel={end}
        aria-label="Move"
      >
        <i style={{ transform: `translate(${knob[0] * 28}px, ${knob[1] * 28}px)` }} />
      </div>
      <div className="acts">
        <button className="btn" {...press("KeyE")}>
          E
        </button>
        <button className="btn" {...press("KeyF")}>
          F
        </button>
        <button className="btn" {...press("KeyR")} aria-label="Ride Cloudmane">
          R
        </button>
        <button className="btn" {...press("KeyM")}>
          M
        </button>
        <button className="btn" {...press("KeyC")} aria-label="Change attire">
          C
        </button>
        <button className="btn" {...press("KeyJ")} aria-label="Journal">
          J
        </button>
        <button className="btn" {...press("KeyB")}>
          B
        </button>
      </div>
    </div>
  );
}
