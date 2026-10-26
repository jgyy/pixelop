"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { newGame, type GameState } from "@/game/engine/state";
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
  return <TitleScreen existing={existing} leaders={leaders} onNew={() => start(newGame(), true)} onContinue={() => existing && start(existing, false)} />;
}

function TitleScreen({ existing, leaders, onNew, onContinue }: { existing: GameState | null | undefined; leaders: LeaderRow[]; onNew: () => void; onContinue: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
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
            <button className="btn primary" onClick={onNew} data-testid="new-game">
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
    </main>
  );
}
