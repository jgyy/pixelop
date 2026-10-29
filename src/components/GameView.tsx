"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPortrait, PORTRAIT, type HumanId } from "@/game/art/characters";
import { SKILLS, type BattleAction } from "@/game/engine/battle";
import { PILL_PRICE, type GameState } from "@/game/engine/state";
import { Game, type UiSnapshot } from "@/game/runtime/Game";
import { CanvasSurface } from "@/game/runtime/CanvasSurface";
import { pushSave } from "@/lib/saveClient";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/lib/settings";
import type { WorldView3D } from "@/game/three/WorldView3D";
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
  const skyRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HTMLCanvasElement>(null);
  const view3d = useRef<WorldView3D | null>(null);
  const [settings, setSettings] = useState<Settings>(() => (typeof window === "undefined" ? DEFAULT_SETTINGS : loadSettings()));
  const settingsRef = useRef(settings);
  const [view3dOn, setView3dOn] = useState(false);
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null);
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
      const v = view3d.current;
      const sky = skyRef.current;
      const gl = glRef.current;
      const in3d = !!v && game.showsWorld;
      if (sky && gl) {
        sky.style.display = gl.style.display = in3d ? "block" : "none";
        if (in3d) for (const c of [sky, gl]) Object.assign(c.style, { width: s.ctx.canvas.style.width, height: s.ctx.canvas.style.height });
      }
      s.ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (in3d && v && sky) {
        if (sky.width !== s.width || sky.height !== s.height) {
          sky.width = s.width;
          sky.height = s.height;
        }
        const skyCtx = sky.getContext("2d");
        if (skyCtx) game.world.renderSky(new CanvasSurface(skyCtx), game.clock, -v.camera.alpha * 90);
        v.resize(s.width, s.height, settingsRef.current.quality);
        v.render(dt);
        s.ctx.clearRect(0, 0, s.width, s.height);
      } else s.rect(0, 0, s.width, s.height, "#000000");
      s.ctx.setTransform(1, 0, 0, 1, dx, dy);
      game.render(s);
    },
    { fit: true },
  );

  // the 3D world: loaded on demand, and the pixel view stands in if this browser cannot draw it
  useEffect(() => {
    settingsRef.current = settings;
    saveSettings(settings);
  }, [settings]);
  useEffect(() => {
    if (settings.view !== "3d") return;
    let alive = true;
    let made: WorldView3D | null = null;
    import("@/game/three/WorldView3D")
      .then(({ WorldView3D }) => {
        if (!alive || !glRef.current) return;
        made = new WorldView3D(glRef.current, game);
        view3d.current = made;
        setView3dOn(true);
      })
      .catch((e) => {
        console.warn("3D view unavailable, drawing the isometric view instead", e);
        if (alive) setSettings((s) => ({ ...s, view: "2d" }));
      });
    return () => {
      alive = false;
      made?.dispose();
      if (view3d.current === made) view3d.current = null;
      setView3dOn(false);
      game.view3d = null;
    };
  }, [game, settings.view]);

  /** Turn the camera (radians) and zoom it (tiles), in the 3D view. */
  const turnCamera = useCallback((dAlpha: number, dBeta = 0, dRadius = 0) => {
    const v = view3d.current;
    if (!v) return;
    v.want.alpha += dAlpha;
    v.want.beta = Math.max(0.35, Math.min(1.3, v.want.beta + dBeta));
    v.want.radius = Math.max(7, Math.min(48, v.want.radius + dRadius));
  }, []);
  const resetCamera = useCallback(() => {
    const v = view3d.current;
    if (!v) return;
    // come back round the shorter way
    const iso = -Math.PI / 4;
    const turns = Math.round((v.want.alpha - iso) / (Math.PI * 2));
    Object.assign(v.want, { alpha: iso + turns * Math.PI * 2, beta: 0.88, radius: 21 });
  }, []);

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
      if (view3d.current && (game.mode === "explore" || game.mode === "meditate" || game.mode === "scene")) {
        const cam: Record<string, () => void> = {
          KeyZ: () => turnCamera(Math.PI / 4),
          KeyX: () => turnCamera(-Math.PI / 4),
          PageUp: () => turnCamera(0, 0, -3),
          PageDown: () => turnCamera(0, 0, 3),
          Equal: () => turnCamera(0, 0, -3),
          Minus: () => turnCamera(0, 0, 3),
          Home: () => resetCamera(),
        };
        if (cam[e.code]) {
          e.preventDefault();
          return cam[e.code]();
        }
      }
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
  }, [game, save, turnCamera, resetCamera]);

  const onCanvasPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (view3d.current && (e.button === 2 || e.button === 1)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY, moved: false };
      return;
    }
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
      <canvas ref={skyRef} className="pixel-canvas sky-canvas" aria-hidden style={{ display: "none" }} />
      <canvas ref={glRef} className="pixel-canvas world-3d" aria-hidden style={{ display: "none" }} data-testid="world-3d" />
      <canvas
        ref={canvasRef}
        className="pixel-canvas"
        aria-label="Game view"
        onPointerDown={onCanvasPointer}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          const k = settingsRef.current.invertDrag ? -1 : 1;
          turnCamera(((e.clientX - d.x) / 220) * k, -(e.clientY - d.y) / 300);
          d.x = e.clientX;
          d.y = e.clientY;
        }}
        onPointerUp={() => void (drag.current = null)}
        onPointerCancel={() => void (drag.current = null)}
        onContextMenu={(e) => view3d.current && e.preventDefault()}
        onWheel={(e) => turnCamera(0, 0, Math.sign(e.deltaY) * 2)}
      />
      {view3dOn && settings.compass && ui.mode === "explore" && !ui.dialog && <Compass view={view3d} />}
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
            {ui.dao.label && (
              <div className="dao" style={{ color: ui.dao.colour ?? undefined }} data-testid="dao" title={ui.dao.creed ?? undefined}>
                ☯ {ui.dao.label}
              </div>
            )}
            {ui.wu.label && (
              <div className="dao wu" style={{ color: ui.wu.colour ?? undefined }} data-testid="wu" title={`Great Daos comprehended: ${ui.wu.total} stages${ui.wu.domain ? " · Dao Domain open" : ""}`}>
                ✧ {ui.wu.label}
                {ui.wu.domain ? " · 道域" : ""}
              </div>
            )}
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
              <span>{ui.bottleneck ? (ui.blocked ? "BOTTLENECK · not yet ready" : "BOTTLENECK · face the tribulation") : `Cultivation ${s.cultivation}/${ui.cultivationNeeded}`}</span>
            </div>
            {ui.condition.label && (
              <div className="condition" data-testid="condition" title={ui.blocked ?? undefined}>
                ⚠ {ui.condition.label}
              </div>
            )}
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
            {ui.year && (
              <div className="errand year" data-testid="year-quest">
                ❀ {ui.year.title}: {ui.year.objective}
              </div>
            )}
            {ui.war && (
              <div className="errand war" data-testid="war-quest">
                ⚔ {ui.war.title}: {ui.war.objective}
              </div>
            )}
            {ui.road && (
              <div className="errand road" data-testid="road-quest">
                ✧ {ui.road.title}: {ui.road.objective}
              </div>
            )}
            {ui.halls && (
              <div className="errand halls" data-testid="halls-quest">
                ⛩ {ui.halls.title}: {ui.halls.objective}
              </div>
            )}
            {ui.notices.length > 0 && (
              <div className="errand notice" data-testid="notice">
                ✉ {ui.notices[0].text}
                {ui.notices.length > 1 && <small> (+{ui.notices.length - 1} more in the journal)</small>}
              </div>
            )}
          </div>
        )}

        <div className="hud-right">
          {!ui.interior?.cave && (
            <div className="chip panel calendar" data-testid="calendar" title={ui.calendar.label} style={{ borderColor: ui.calendar.colour }}>
              <span className="cn" style={{ color: ui.calendar.colour }}>
                {ui.calendar.hanzi}
              </span>{" "}
              {ui.calendar.seasonName} {ui.calendar.day} · {String(Math.floor(ui.calendar.hour)).padStart(2, "0")}:{String(Math.floor((ui.calendar.hour % 1) * 60)).padStart(2, "0")} {phaseIcon(ui.calendar.phase)}
            </div>
          )}
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
              <button className="btn" onClick={() => game.toggleWardrobe()} data-testid="attire" title={ui.attire.name}>
                Attire <span className="kbd">V</span>
              </button>
              <button className="btn" onClick={() => game.toggleJournal()} data-testid="journal-button">
                Journal <span className="kbd">J</span>
              </button>
              <button className="btn" onClick={() => void save()} data-testid="save">
                Save
              </button>
              <button className="btn" onClick={() => void save().finally(onQuit)} data-testid="quit">
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
            <h3>{ui.shopKeeper ? `${ui.shopKeeper}'s Wares` : "Alchemy Hall Wares"}</h3>
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
              {ui.shopKeeper === "Senior Sister Qing" || !ui.shopKeeper ? "Farewell, Senior Sister" : `Farewell, ${ui.shopKeeper}`}
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

        {ui.journal && <JournalPanel journal={ui.journal} ui={ui} game={game} onClose={() => game.toggleJournal()} />}

        {ui.wardrobe && <WardrobePanel ui={ui} game={game} />}

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
function JournalPanel({ journal, ui, game, onClose }: { journal: NonNullable<UiSnapshot["journal"]>; ui: UiSnapshot; game: Game; onClose: () => void }) {
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
      {ui.year && (
        <section data-testid="journal-year">
          <h4>
            ❀ {ui.year.chapter} · {ui.year.title}
          </h4>
          <p>{ui.year.objective}</p>
        </section>
      )}
      {ui.war && (
        <section data-testid="journal-war">
          <h4>
            ⚔ {ui.war.chapter} · {ui.warDone}/{ui.warCount}
          </h4>
          <p>
            <strong>{ui.war.title}</strong> — {ui.war.objective}
          </p>
          {ui.warFronts && (
            <ul className="fronts">
              {ui.warFronts.map((f) => (
                <li key={f.front} className={`front-${f.state}`}>
                  <span className="cn">{f.hanzi}</span> {f.front} <b>{f.state === "freed" ? `Freed${f.scar ? ` · ${f.scar}` : ""}` : f.state === "burning" ? "Burning" : "—"}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {ui.road && (
        <section data-testid="journal-road">
          <h4>
            ✧ {ui.road.chapter} · {ui.roadDone}/{ui.roadCount}
          </h4>
          <p>
            <strong>{ui.road.title}</strong> — {ui.road.objective}
          </p>
          {ui.roadSteles && (
            <ul className="fronts steles">
              {ui.roadSteles.map((f) => (
                <li key={f.stele} className={`front-${f.state === "restored" ? "freed" : f.state === "hollowed" || f.state === "devoured" ? "burning" : "waiting"}`}>
                  <span className="cn" style={{ color: f.colour }}>
                    {f.hanzi}
                  </span>{" "}
                  {f.stele} <b>{f.state === "restored" ? "Mended" : f.state === "devoured" ? "Eaten" : f.state === "hollowed" ? "Hollowed" : "—"}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {ui.halls && (
        <section data-testid="journal-halls">
          <h4>
            ⛩ {ui.halls.chapter} · {ui.hallsDone}/{ui.hallsCount}
          </h4>
          <p>
            <strong>{ui.halls.title}</strong> — {ui.halls.objective}
          </p>
          {ui.hallsList && (
            <ul className="fronts steles">
              {ui.hallsList.map((f) => (
                <li key={f.hall} className={`front-${f.state === "done" ? "freed" : f.state === "studying" ? "burning" : "waiting"}`}>
                  <span className="cn" style={{ color: f.colour }}>
                    {f.hanzi}
                  </span>{" "}
                  {f.hall} <b>{f.state === "done" ? "Done" : f.state === "studying" ? "Studying" : "—"}</b>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      {ui.condition.journal && (
        <section data-testid="journal-cultivation">
          <h4>☵ Cultivation · {ui.realm}</h4>
          <p className="muted">
            Qi kept: {ui.condition.journal.rate}% of what you draw in
            {ui.condition.journal.fails > 0 ? ` · Tribulations failed: ${ui.condition.journal.fails}` : ""}
          </p>
          <ul className="daos cultivation">
            {(
              [
                ["丹毒", "Pill poison", ui.condition.journal.toxicity, 100, "#c8e05a", "Every pill leaves some. Meditation burns it off; herbalists draw it out. At 80 your qi runs wild."],
                ["心魔", "Heart demons", ui.condition.journal.demons, 100, "#ff6a8a", "Fed by slaughter and failure. Meditation quiets a few; monks, friends and lamps quiet the rest. Heaven's lightning finds every one."],
                ["根基", "Cracked foundation", ui.condition.journal.wound, 100, "#b8a4ff", "Left by a failed tribulation. Halves the qi you keep, and heaven will not test you until it mends."],
                ["悟", "Insight", ui.condition.journal.insight, Math.max(1, ui.condition.journal.insightNeeded), "#f2c55c", `Needed to break out of ${ui.condition.journal.realmName}: ${ui.condition.journal.insightNeeded}. Steles, masters' pointers, new shrines and long sittings at the bottleneck.`],
              ] as const
            ).map(([cn, name, v, max, colour, tip]) => (
              <li key={cn} title={tip}>
                <span className="cn" style={{ color: colour }}>
                  {cn}
                </span>{" "}
                {name}
                <i className="daobar" aria-hidden>
                  <i style={{ width: `${Math.min(100, (v / max) * 100)}%`, background: colour }} />
                </i>
                <b>{cn === "悟" ? `${v}/${ui.condition.journal!.insightNeeded}` : v}</b>
              </li>
            ))}
          </ul>
          {ui.condition.journal.block && <p className="muted">{ui.condition.journal.block}</p>}
        </section>
      )}
      {ui.wu.paths && (
        <section data-testid="journal-wu">
          <h4>✧ The Great Daos · {ui.wu.total} stages comprehended{ui.wu.domain ? " · 道域 Dao Domain open" : ""}</h4>
          <p className="muted">Sit long at shrines where a Dao runs strong, walk the Founder&apos;s Road, and break through: no realm holds more of a Dao than it can bear.</p>
          <ul className="daos">
            {ui.wu.paths.map((d) => (
              <li key={d.id} title={`${d.verse} (${d.gift})`} className={d.tier ? "" : "dim"}>
                <span className="cn" style={{ color: d.colour }}>
                  {d.hanzi}
                </span>{" "}
                {d.name}
                <i className="daobar" aria-hidden>
                  <i style={{ width: `${Math.min(100, (d.points / 75) * 100)}%`, background: d.colour }} />
                </i>
                <b>
                  {d.stage}
                  {d.capped ? " · realm-bound" : ""}
                </b>
              </li>
            ))}
          </ul>
        </section>
      )}
      {ui.dao.paths && (
        <section data-testid="journal-dao">
          <h4>☯ The Dao Heart · {ui.dao.label ?? "no Dao leads yet"}</h4>
          {ui.dao.creed && <p className="muted">“{ui.dao.creed}”</p>}
          <ul className="daos">
            {ui.dao.paths.map((d) => (
              <li key={d.id} title={`${d.creed} (${d.gift})`}>
                <span className="cn" style={{ color: d.colour }}>
                  {d.hanzi}
                </span>{" "}
                {d.name}
                <i className="daobar" aria-hidden>
                  <i style={{ width: `${Math.min(100, (d.points / 50) * 100)}%`, background: d.colour }} />
                </i>
                <b>{d.points}</b>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section data-testid="journal-notices">
        <h4>
          Notices of the Jianghu · {ui.noticesDone}/{ui.noticeCount}
        </h4>
        {ui.notices.length === 0 && <p className="muted">No notices carried. Folk with a ✉ scroll over their heads have a favour to ask.</p>}
        {ui.notices.map((n) => (
          <div key={n.slot} className="entry notice">
            <strong>
              ✉ {n.title} <small>· {n.giver}</small>
            </strong>
            <p>{n.text}</p>
            <button className="btn small" onClick={() => game.abandonNotice(n.slot)} data-testid={`abandon-${n.slot}`}>
              Set aside
            </button>
          </div>
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
        <button className="btn" {...press("KeyV")} aria-label="Wardrobe">
          V
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

/** A little compass ring in the 3D view: north is up the map, and the hint for turning the camera. */
function Compass({ view }: { view: React.RefObject<WorldView3D | null> }) {
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = view.current;
      if (v) setAngle((a) => (Math.abs(a - v.camera.alpha) > 0.01 ? v.camera.alpha : a));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [view]);
  // north (map −y) on screen: the camera at angle α looks back along (cos α, sin α) in X/Z
  const deg = ((angle + Math.PI / 2) * 180) / Math.PI;
  return (
    <div className="compass panel" data-testid="compass" title="Z / X or right-drag to turn · wheel or +/− to zoom · Home to reset">
      <i style={{ transform: `rotate(${deg}deg)` }}>
        <b>北</b>
      </i>
      <small>
        <span className="kbd">Z</span>
        <span className="kbd">X</span> turn
      </small>
    </div>
  );
}

function phaseIcon(phase: string): string {
  return phase === "dawn" ? "🌅" : phase === "day" ? "☀" : phase === "dusk" ? "🌇" : "☾";
}

/** Lin Yue's wardrobe: every outfit in the jianghu, the ones she owns to put on, and how to earn the rest. */
function WardrobePanel({ ui, game }: { ui: UiSnapshot; game: Game }) {
  const list = ui.wardrobe!;
  return (
    <div className="wardrobe panel" data-testid="wardrobe">
      <h3>
        Wardrobe · 衣橱 <small>({list.filter((a) => a.owned).length}/{list.length})</small>
      </h3>
      <ul>
        {list.map((a) => (
          <li key={a.id} className={a.worn ? "worn" : a.owned ? "owned" : "locked"}>
            <button className="btn" disabled={!a.owned || a.worn} onClick={() => game.wear(a.id)} data-testid={`wear-${a.id}`}>
              <span className="cn">{a.hanzi}</span> {a.owned ? a.name : "？？？"}
              <small>{a.worn ? "✔ Wearing" : a.owned ? a.from : a.hint}</small>
            </button>
          </li>
        ))}
      </ul>
      <div className="hint">
        <span className="kbd">C</span> next outfit · <span className="kbd">V</span> / <span className="kbd">Esc</span> close
      </div>
      <button className="btn primary" onClick={() => game.toggleWardrobe()} data-testid="wardrobe-close">
        Close
      </button>
    </div>
  );
}
