import { z } from "zod";
import { GameStateSchema } from "@/game/engine/state";
import { getSaveStore, PLAYER_ID } from "@/server/saveStore";

type Ctx = { params: Promise<{ playerId: string }> };

const Body = z.object({ state: GameStateSchema });

async function playerId(ctx: Ctx): Promise<string | null> {
  const { playerId } = await ctx.params;
  return PLAYER_ID.test(playerId) ? playerId : null;
}

const badId = () => Response.json({ error: "Invalid player id" }, { status: 400 });

export async function GET(_req: Request, ctx: Ctx) {
  const id = await playerId(ctx);
  if (!id) return badId();
  // A missing save is a normal state for new players, so answer 200 with null.
  const rec = await getSaveStore().get(id);
  return Response.json({ save: rec });
}

export async function PUT(req: Request, ctx: Ctx) {
  const id = await playerId(ctx);
  if (!id) return badId();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) return Response.json({ error: "Invalid save data", issues: parsed.error.issues.slice(0, 5) }, { status: 422 });
  const rec = await getSaveStore().put(id, parsed.data.state);
  return Response.json({ save: rec });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = await playerId(ctx);
  if (!id) return badId();
  const removed = await getSaveStore().remove(id);
  return removed ? new Response(null, { status: 204 }) : Response.json({ error: "No save found" }, { status: 404 });
}
