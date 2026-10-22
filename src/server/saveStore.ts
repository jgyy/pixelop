import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { GameStateSchema, type GameState } from "@/game/engine/state";

export interface SaveRecord {
  playerId: string;
  state: GameState;
  updatedAt: string;
}

export interface SaveStore {
  get(playerId: string): Promise<SaveRecord | null>;
  put(playerId: string, state: GameState): Promise<SaveRecord>;
  remove(playerId: string): Promise<boolean>;
  list(): Promise<SaveRecord[]>;
}

export const PLAYER_ID = /^[A-Za-z0-9_-]{8,64}$/;

export class MemorySaveStore implements SaveStore {
  protected records = new Map<string, SaveRecord>();
  async get(id: string) {
    return this.records.get(id) ?? null;
  }
  async put(id: string, state: GameState) {
    const rec = { playerId: id, state, updatedAt: new Date().toISOString() };
    this.records.set(id, rec);
    return rec;
  }
  async remove(id: string) {
    return this.records.delete(id);
  }
  async list() {
    return [...this.records.values()];
  }
}

/**
 * JSON-file store: whole file rewritten atomically (tmp + rename) and writes
 * serialised through a promise chain so concurrent saves never interleave.
 */
export class FileSaveStore extends MemorySaveStore {
  private loaded: Promise<void> | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly file: string) {
    super();
  }

  private load(): Promise<void> {
    this.loaded ??= (async () => {
      try {
        const raw = JSON.parse(await readFile(this.file, "utf8")) as Record<string, unknown>;
        for (const [id, rec] of Object.entries(raw)) {
          const r = rec as SaveRecord;
          const parsed = GameStateSchema.safeParse(r?.state);
          if (parsed.success && PLAYER_ID.test(id)) this.records.set(id, { playerId: id, state: parsed.data, updatedAt: String(r.updatedAt) });
        }
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") console.warn("[saves] could not read save file, starting fresh", err);
      }
    })();
    return this.loaded;
  }

  private persist(): Promise<void> {
    const next = this.chain.then(async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify(Object.fromEntries(this.records), null, 2));
      await rename(tmp, this.file);
    });
    this.chain = next.catch(() => undefined);
    return next;
  }

  async get(id: string) {
    await this.load();
    return super.get(id);
  }
  async put(id: string, state: GameState) {
    await this.load();
    const rec = await super.put(id, state);
    await this.persist();
    return rec;
  }
  async remove(id: string) {
    await this.load();
    const had = await super.remove(id);
    if (had) await this.persist();
    return had;
  }
  async list() {
    await this.load();
    return super.list();
  }
}

let store: SaveStore | null = null;

export function getSaveStore(): SaveStore {
  if (!store) {
    store = process.env.SAVE_STORE === "memory" ? new MemorySaveStore() : new FileSaveStore(path.join(process.env.DATA_DIR ?? ".data", "saves.json"));
  }
  return store;
}

/** Test hook. */
export function setSaveStore(s: SaveStore | null): void {
  store = s;
}
