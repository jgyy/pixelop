import { GameStateSchema, type GameState } from "@/game/engine/state";

const KEY = "pixelop.playerId";

/** Anonymous per-browser id used as the save slot key. */
export function playerId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "");
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "guest-player-0001";
  }
}

export async function fetchSave(): Promise<GameState | null> {
  const res = await fetch(`/api/save/${playerId()}`, { cache: "no-store" });
  if (!res.ok) return null;
  const json = (await res.json()) as { save?: { state: unknown } };
  const parsed = GameStateSchema.safeParse(json.save?.state);
  return parsed.success ? parsed.data : null;
}

export async function pushSave(state: GameState): Promise<boolean> {
  const res = await fetch(`/api/save/${playerId()}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ state: { ...state, playTime: Math.round(state.playTime) } }),
  });
  return res.ok;
}

export interface LeaderRow {
  rank: number;
  name: string;
  realm: string;
  bossDefeated: boolean;
  kills: number;
}

export async function fetchLeaderboard(): Promise<LeaderRow[]> {
  const res = await fetch("/api/leaderboard", { cache: "no-store" });
  if (!res.ok) return [];
  return ((await res.json()) as { leaderboard: LeaderRow[] }).leaderboard;
}
