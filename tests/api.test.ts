import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { GET as health } from "@/app/api/health/route";
import { GET as leaderboard } from "@/app/api/leaderboard/route";
import { DELETE, GET, PUT } from "@/app/api/save/[playerId]/route";
import { newGame } from "@/game/engine/state";
import { FileSaveStore, setSaveStore } from "@/server/saveStore";

const dir = mkdtempSync(path.join(tmpdir(), "pixelop-"));
const file = path.join(dir, "saves.json");
const ctx = (playerId: string) => ({ params: Promise.resolve({ playerId }) });
const put = (id: string, body: unknown) => PUT(new Request("http://x", { method: "PUT", body: JSON.stringify(body) }), ctx(id));

beforeEach(() => {
  rmSync(file, { force: true });
  setSaveStore(new FileSaveStore(file));
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("API", () => {
  it("reports health", async () => {
    const res = health();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("saves, loads and deletes a game", async () => {
    const id = "player-123456";
    expect(await (await GET(new Request("http://x"), ctx(id))).json()).toEqual({ save: null });
    const state = { ...newGame(), stones: 77 };
    const saved = await put(id, { state });
    expect(saved.status).toBe(200);
    const loaded = await (await GET(new Request("http://x"), ctx(id))).json();
    expect(loaded.save.state.stones).toBe(77);
    // persisted to disk, readable by a fresh store
    expect(JSON.parse(readFileSync(file, "utf8"))[id].state.stones).toBe(77);
    setSaveStore(new FileSaveStore(file));
    expect((await (await GET(new Request("http://x"), ctx(id))).json()).save.state.stones).toBe(77);
    expect((await DELETE(new Request("http://x"), ctx(id))).status).toBe(204);
    expect((await DELETE(new Request("http://x"), ctx(id))).status).toBe(404);
  });

  it("validates ids and payloads", async () => {
    expect((await GET(new Request("http://x"), ctx("../etc"))).status).toBe(400);
    expect((await put("player-123456", { state: { ...newGame(), realm: 99 } })).status).toBe(422);
    const bad = await PUT(new Request("http://x", { method: "PUT", body: "not json" }), ctx("player-123456"));
    expect(bad.status).toBe(400);
  });

  it("ranks cultivators on the leaderboard", async () => {
    await put("player-aaaaaaaa", { state: { ...newGame("Mei"), realm: 1 } });
    await put("player-bbbbbbbb", { state: { ...newGame("Yue"), realm: 2, stage: 1 } });
    await put("player-cccccccc", { state: newGame("Lan") });
    const { leaderboard: rows } = await (await leaderboard()).json();
    expect(rows.map((r: { name: string }) => r.name)).toEqual(["Yue", "Mei", "Lan"]);
    expect(rows[0].realm).toBe("Core Formation · Middle");
  });
});
