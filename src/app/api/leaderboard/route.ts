import { realmLabel } from "@/game/engine/realms";
import { getSaveStore } from "@/server/saveStore";

export const dynamic = "force-dynamic";

/** Top cultivators across all saves, ranked by realm, stage, then cultivation. */
export async function GET() {
  const saves = await getSaveStore().list();
  const top = saves
    .map((r) => r.state)
    .sort((a, b) => b.realm - a.realm || b.stage - a.stage || b.cultivation - a.cultivation || b.kills - a.kills)
    .slice(0, 10)
    .map((s, i) => ({ rank: i + 1, name: s.name, realm: realmLabel(s.realm, s.stage), bossDefeated: s.bossDefeated, kills: s.kills }));
  return Response.json({ leaderboard: top });
}
