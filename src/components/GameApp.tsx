"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { newGame, type GameState } from "@/game/engine/state";
import { renderTitle } from "@/game/runtime/title";
import { SCREEN_H, SCREEN_W } from "@/game/scenes";
import { fetchLeaderboard, fetchSave, type LeaderRow } from "@/lib/saveClient";
import { GameView } from "./GameView";
import { useCanvasLoop } from "./useCanvasLoop";

export function GameApp() {
  const [playing, setPlaying] = useState<GameState | null>(null);
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

  const start = useCallback((state: GameState) => {
    setSession((n) => n + 1);
    setPlaying(state);
  }, []);

  if (playing) return <GameView key={session} initial={playing} onQuit={() => setPlaying(null)} />;
  return <TitleScreen existing={existing} leaders={leaders} onNew={() => start(newGame())} onContinue={() => existing && start(existing)} />;
}

function TitleScreen({
  existing,
  leaders,
  onNew,
  onContinue,
}: {
  existing: GameState | null | undefined;
  leaders: LeaderRow[];
  onNew: () => void;
  onContinue: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useCanvasLoop(ref, (s, t) => renderTitle(s, t));
  return (
    <main className="shell">
      <div className="stage" data-testid="title-screen">
        <canvas ref={ref} width={SCREEN_W} height={SCREEN_H} aria-label="Lin Yue flies over the Azure Cloud Sect" />
        <div className="title-overlay">
          <h1 className="logo">
            <span className="cn">玉莲飞升</span>
            <span className="en">Jade Lotus Ascension</span>
            <span className="sub">A pixel-art xianxia RPG</span>
          </h1>
          <div className="menu">
            <button className="btn primary" onClick={onNew} data-testid="new-game">
              Begin Cultivation
            </button>
            <button className="btn" onClick={onContinue} disabled={!existing} data-testid="continue">
              {existing === undefined ? "Consulting the jade slip…" : existing ? `Continue · ${existing.name}` : "Continue (no save)"}
            </button>
            <Link className="btn" href="/gallery" style={{ textAlign: "center" }} data-testid="gallery-link">
              Pixel Art Gallery
            </Link>
          </div>
        </div>
      </div>
      <section className="below">
        <div className="panel">
          <h2>How to cultivate</h2>
          <ul>
            <li>
              <span className="kbd">←→</span>/<span className="kbd">A D</span> walk · <span className="kbd">Space</span> jump · <span className="kbd">F</span> ride your flying sword
            </li>
            <li>
              <span className="kbd">E</span> talk, travel through moon gates, meditate at lotus shrines
            </li>
            <li>
              Touch a demonic beast to battle. <span className="kbd">1-4</span> skills · <span className="kbd">5 6</span> pills · <span className="kbd">0</span> flee
            </li>
            <li>
              At a realm&apos;s peak, meditate and press <span className="kbd">B</span> to face the Heavenly Tribulation.
            </li>
            <li>
              <span className="kbd">H</span>/<span className="kbd">Q</span> swallow a healing / qi pill while exploring.
            </li>
          </ul>
        </div>
        <div className="panel">
          <h2>Immortal Rankings</h2>
          {leaders.length === 0 ? (
            <p style={{ color: "var(--muted)", margin: 0 }}>No cultivator has left a mark yet.</p>
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
        </div>
      </section>
    </main>
  );
}
