"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { charDef, frameAt, getAnim, type AnimId } from "@/game/art/characters";
import type { GameState } from "@/game/engine/state";
import { newGameAs, ORIGIN_IDS, ORIGINS, type OriginId } from "@/game/story/origins";
import { renderTitle } from "@/game/runtime/title";
import { fetchLeaderboard, fetchSave, type LeaderRow } from "@/lib/saveClient";
import { GameView } from "./GameView";
import { useCanvasLoop } from "./useCanvasLoop";

export function GameApp() {
  const [playing, setPlaying] = useState<{ state: GameState; intro: boolean } | null>(null);
  const [existing, setExisting] = useState<GameState | null | undefined>(undefined);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [session, setSession] = useState(0);

  useEffect(() => {
    if (playing) return;
    let alive = true;
    fetchSave()
      .then((s) => alive && setExisting(s))
      .catch(() => alive && setExisting(null));
    fetchLeaderboard()
      .then((l) => alive && setLeaders(l))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [playing]);

  const start = useCallback((state: GameState, intro: boolean) => {
    setSession((n) => n + 1);
    setPlaying({ state, intro });
  }, []);

  if (playing) return <GameView key={session} initial={playing.state} intro={playing.intro} onQuit={() => setPlaying(null)} />;
  return <TitleScreen existing={existing} leaders={leaders} onNew={(origin) => start(newGameAs(origin), true)} onContinue={() => existing && start(existing, false)} />;
}

/** How each beginning looks on the title screen: her clothes, and what she is doing. */
const ORIGIN_LOOK: Record<OriginId, { outfit?: string; anim: AnimId }> = {
  disciple: { anim: "salute" },
  foundling: { outfit: "homespun", anim: "wave" },
  defector: { outfit: "acolyte", anim: "think" },
};

function OriginFigure({ origin }: { origin: OriginId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const def = charDef("heroine");
  const { outfit, anim } = ORIGIN_LOOK[origin];
  useCanvasLoop(
    ref,
    (s, t) => {
      const a = getAnim("heroine", anim, 2, outfit);
      const idle = getAnim("heroine", "idle", 2, outfit);
      const dur = a.frames.length / a.fps;
      // the gesture, then a breath of standing still, and again
      const k = t % (dur + 2);
      s.ctx.clearRect(0, 0, def.w, def.h);
      s.sprite(k < dur ? frameAt(a, k) : frameAt(idle, k), 0, 0);
    },
    { fps: 30 },
  );
  return <canvas ref={ref} className="origin-figure" width={def.w} height={def.h} />;
}

/** Choose where Lin Yue's tale begins. */
function OriginPicker({ onPick, onBack }: { onPick: (o: OriginId) => void; onBack: () => void }) {
  return (
    <div className="origins panel" role="dialog" aria-label="Choose your beginning" data-testid="origin-picker">
      <h2>
        Where does her tale begin? <small>Each beginning has its own road, its own answer for Patriarch Xue, and its own endings.</small>
      </h2>
      <ul>
        {ORIGIN_IDS.map((id) => {
          const o = ORIGINS[id];
          return (
            <li key={id}>
              <button className={`btn${id === "disciple" ? " primary" : ""}`} onClick={() => onPick(id)} data-testid={`origin-${id}`}>
                <OriginFigure origin={id} />
                <span className="origin-text">
                  <b>
                    {o.name} <span className="cn">{o.hanzi}</span>
                  </b>
                  <em>{o.blurb}</em>
                  <span className="perks">
                    {o.perks.map((p) => (
                      <small key={p}>· {p}</small>
                    ))}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <button className="btn" onClick={onBack} data-testid="origin-back">
        Back
      </button>
    </div>
  );
}

function TitleScreen({ existing, leaders, onNew, onContinue }: { existing: GameState | null | undefined; leaders: LeaderRow[]; onNew: (origin: OriginId) => void; onContinue: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [picking, setPicking] = useState(false);
  useCanvasLoop(ref, (s, t) => renderTitle(s, t), { fit: true });
  return (
    <main className="screen" data-testid="title-screen">
      <canvas ref={ref} className="pixel-canvas" aria-label="Lin Yue meditates in the floating Azure Cloud Sect" />
      <div className="title-overlay">
        <div className="title-left">
          <h1 className="logo">
            <span className="cn">玉莲飞升</span>
            <span className="en">Jade Lotus Ascension</span>
            <span className="sub">A 2.5D pixel xianxia RPG</span>
          </h1>
          <div className="menu">
            <button className="btn primary" onClick={() => setPicking(true)} data-testid="new-game">
              Begin Cultivation
            </button>
            <button className="btn" onClick={onContinue} disabled={!existing} data-testid="continue">
              {existing === undefined ? "Consulting the jade slip…" : existing ? `Continue · ${existing.name}` : "Continue (no save)"}
            </button>
            <Link className="btn" href="/gallery" data-testid="gallery-link">
              Pixel Art Gallery
            </Link>
          </div>
        </div>
        <aside className="title-right">
          <section className="panel">
            <h2>How to cultivate</h2>
            <ul>
              <li>
                <span className="kbd">WASD</span>/<span className="kbd">←↑→↓</span> walk · <span className="kbd">F</span> ride your sword · <span className="kbd">R</span> whistle for Cloudmane, your spirit horse (<span className="kbd">Shift</span> gallops)
              </li>
              <li>
                <span className="kbd">E</span>/<span className="kbd">Space</span> talk, meditate, open chests · <span className="kbd">M</span> world map · <span className="kbd">J</span> journal · <span className="kbd">C</span>/<span className="kbd">V</span> attire &amp; wardrobe
              </li>
              <li>
                Touch a demonic beast to battle: <span className="kbd">1-5</span> techniques · <span className="kbd">6 7</span> pills · <span className="kbd">0</span> flee
              </li>
              <li>
                At a realm&apos;s peak, meditate at a shrine and press <span className="kbd">B</span> to face the Heavenly Tribulation.
              </li>
            </ul>
          </section>
          <section className="panel">
            <h2>Immortal Rankings</h2>
            {leaders.length === 0 ? (
              <p className="muted">No cultivator has left a mark yet.</p>
            ) : (
              <table className="leader" data-testid="leaderboard">
                <tbody>
                  {leaders.map((l) => (
                    <tr key={l.rank}>
                      <td>#{l.rank}</td>
                      <td>{l.name}</td>
                      <td>{l.realm}</td>
                      <td>{l.bossDefeated ? "🪷" : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </aside>
      </div>
      {picking && <OriginPicker onPick={onNew} onBack={() => setPicking(false)} />}
    </main>
  );
}
