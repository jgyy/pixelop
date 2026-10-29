import { hash2 } from "../pixel/noise";
import type { HumanId } from "../art/characters";
import type { EnemyId } from "../engine/enemies";
import type { Critter, EnemySpawn, NpcPlacement } from "./areas";
import type { AreaId } from "./ids";
import type { TileMap } from "./tilemap";

/**
 * A busier jianghu. Every person who lives somewhere in the open world has a
 * neighbour now (a farmer by the farmer, a disciple by the disciple, a
 * soldier on the same picket), and every common beast and bird of the wilds
 * runs with a mate. The neighbours are ordinary folk with their own chatter;
 * their keys carry their region and their kind (`crowd:<region>:<kind>:<n>`)
 * so what they say needs nothing more than the key.
 */

export const CROWD_KINDS = ["villager", "disciple", "soldier", "refugee", "monk", "outer", "sword", "phoenix", "herb", "miner", "fisher", "nomad", "porter", "child"] as const;
export type CrowdKind = (typeof CROWD_KINDS)[number];

/** What kind of neighbour lives beside someone of each look. */
const KIN: Partial<Record<HumanId, CrowdKind>> = {
  discipleM: "disciple",
  discipleF: "disciple",
  abao: "disciple",
  taiji: "disciple",
  cook: "disciple",
  soldier: "soldier",
  general: "soldier",
  drummer: "soldier",
  quartermaster: "soldier",
  scout: "soldier",
  guard: "soldier",
  warcaptain: "soldier",
  medic: "refugee",
  refugeeM: "refugee",
  refugeeF: "refugee",
  deserter: "refugee",
  widow: "refugee",
  monk: "monk",
  novice: "monk",
  abbot: "monk",
  keeper: "monk",
  outerM: "outer",
  outerF: "outer",
  swordsea: "sword",
  phoenix: "phoenix",
  herbalist: "herb",
  miner: "miner",
  fishwife: "fisher",
  boatwoman: "fisher",
  captain: "fisher",
  nomad: "nomad",
  porter: "porter",
  merchant: "porter",
  peddler: "porter",
  child: "child",
  boy: "child",
};

/** The looks each kind of neighbour wears, picked between by the neighbour's number. */
const LOOKS: Record<CrowdKind, HumanId[]> = {
  villager: ["villagerM", "villagerF", "farmer", "woodcutter"],
  disciple: ["discipleM", "discipleF"],
  soldier: ["soldier"],
  refugee: ["refugeeM", "refugeeF"],
  monk: ["novice", "monk"],
  outer: ["outerM", "outerF"],
  sword: ["swordsea"],
  phoenix: ["phoenix"],
  herb: ["herbalist"],
  miner: ["miner"],
  fisher: ["fishwife", "villagerM"],
  nomad: ["nomad"],
  porter: ["porter", "merchant"],
  child: ["child", "boy"],
};

const SURNAMES = ["Wu", "Lei", "Hong", "Pan", "Du", "Jiang", "Xu", "Ma", "Cao", "Fu", "Gu", "He", "Kang", "Lu", "Mo", "Ning", "Ou", "Qian", "Ren", "Song", "Tao", "Wan", "Xiang", "Yu", "Zeng", "Bo", "Chu", "Duan", "Feng", "Guo"];
const GIVEN = ["Ping", "Lan", "Shan", "Hui", "Jun", "Rong", "Bao", "Lian", "Xin", "Tao", "Yan", "Kai", "Mei", "Qing", "Sheng", "Wei"];
const TITLES: Record<CrowdKind, [string, string]> = {
  villager: ["Uncle", "Auntie"],
  disciple: ["Disciple", "Disciple"],
  soldier: ["Soldier", "Soldier"],
  refugee: ["Old", "Sister"],
  monk: ["Brother", "Brother"],
  outer: ["Outer Disciple", "Outer Disciple"],
  sword: ["Swordsman", "Swordswoman"],
  phoenix: ["Disciple", "Disciple"],
  herb: ["Herbalist", "Herbalist"],
  miner: ["Miner", "Miner"],
  fisher: ["Fisher", "Fisherwoman"],
  nomad: ["Herder", "Herder"],
  porter: ["Porter", "Trader"],
  child: ["Little", "Little"],
};

const FEMALE = new Set<HumanId>(["villagerF", "discipleF", "refugeeF", "outerF", "fishwife", "herbalist", "child"]);

/** What a neighbour is called: a title for their kind, and a name. */
export function crowdName(kind: CrowdKind, n: number, char: HumanId): string {
  const sur = SURNAMES[Math.floor(hash2(n, 3, 91) * SURNAMES.length)];
  const given = GIVEN[Math.floor(hash2(n, 5, 92) * GIVEN.length)];
  const title = TITLES[kind][FEMALE.has(char) ? 1 : 0];
  if (kind === "child") return `${title} ${given}`;
  if (kind === "villager" || kind === "refugee") return `${title} ${sur}`;
  return `${title} ${sur} ${given}`;
}

export interface CrowdKey {
  region: AreaId;
  kind: CrowdKind;
  n: number;
}

export const crowdKey = (k: CrowdKey) => `crowd:${k.region}:${k.kind}:${k.n}`;

export function parseCrowdKey(key: string): CrowdKey | null {
  const m = /^crowd:([a-z]+):([a-z]+):(\d+)$/.exec(key);
  if (!m || !(CROWD_KINDS as readonly string[]).includes(m[2])) return null;
  return { region: m[1] as AreaId, kind: m[2] as CrowdKind, n: Number(m[3]) };
}

/** The look a neighbour wears. */
export function crowdLook(kind: CrowdKind, n: number): HumanId {
  const looks = LOOKS[kind];
  return looks[Math.floor(hash2(n, 7, 93) * looks.length)];
}

/** Beasts common enough in the wilds to come in pairs (the named foes, bosses and sparring partners stay alone). */
const PACK: ReadonlySet<EnemyId> = new Set<EnemyId>(["fox", "wolf", "serpent", "cultist", "jiangshi", "bandit", "raider", "ironguard", "bannerman", "hollowshade", "hollowmonk", "hollowsage", "stonehound", "frostfang", "smuggler"]);
/** Spawns the story fights by name: they stay single. */
const LONE = new Set(["village-fox"]);

interface Ground {
  map: TileMap;
  /** Whether a tile is free to put someone on (nobody else there, nothing built). */
  free?: (i: number, j: number) => boolean;
  region?: (i: number, j: number) => AreaId;
}

/**
 * A walkable tile between `near` and `far` steps from (i, j), reached from
 * it on foot without climbing more than a level at a time, in the same
 * region, and not already taken.
 */
function besideOf(g: Ground, i: number, j: number, near: number, far: number, taken: Set<number>, seed: number): [number, number] | null {
  const m = g.map;
  const home = g.region?.(i, j);
  const seen = new Map<number, number>([[j * m.w + i, 0]]);
  const q: [number, number][] = [[i, j]];
  const found: [number, number][] = [];
  while (q.length) {
    const [a, b] = q.shift()!;
    const d = seen.get(b * m.w + a)!;
    if (d >= near && !taken.has(b * m.w + a) && (g.free?.(a, b) ?? true) && (!home || g.region!(a, b) === home)) found.push([a, b]);
    if (d >= far) continue;
    for (const [da, db] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const [x, y] = [a + da, b + db];
      const k = y * m.w + x;
      if (seen.has(k) || !m.standable(x, y) || Math.abs(m.height(x, y) - m.height(a, b)) > 1) continue;
      seen.set(k, d + 1);
      q.push([x, y]);
    }
  }
  if (!found.length) return null;
  return found[Math.floor(hash2(i, j, seed) * found.length)];
}

/** Mark a tile and its eight neighbours as taken. */
function take(taken: Set<number>, m: TileMap, i: number, j: number): void {
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) taken.add((j + b) * m.w + i + a);
}

/** A neighbour for every person of the open world, of their own kind, standing close by. */
export function neighbours(g: Ground, npcs: readonly NpcPlacement[], enemies: readonly EnemySpawn[]): NpcPlacement[] {
  const m = g.map;
  const taken = new Set<number>();
  for (const p of [...npcs, ...enemies]) take(taken, m, p.i, p.j);
  const out: NpcPlacement[] = [];
  npcs.forEach((p, n) => {
    if (p.key.startsWith("crowd:")) return;
    const at = besideOf(g, p.i, p.j, 2, 5, taken, 301 + n) ?? besideOf(g, p.i, p.j, 1, 10, taken, 301 + n);
    if (!at) return;
    take(taken, m, at[0], at[1]);
    const region = g.region?.(at[0], at[1]) ?? "village";
    const kind: CrowdKind = KIN[p.char] ?? (region === "sect" || region === "peak" ? "disciple" : region === "frost" ? "monk" : region === "harbor" ? "fisher" : "villager");
    const char = crowdLook(kind, n);
    out.push({
      key: crowdKey({ region, kind, n }),
      name: crowdName(kind, n, char),
      char,
      i: at[0],
      j: at[1],
      dir: Math.floor(hash2(n, 9, 94) * 16),
      wander: p.wander || p.route ? 2.5 : 1.5,
      ...(p.when && { when: p.when }),
      ...(p.outfit && char === p.char && { outfit: p.outfit }),
    });
  });
  return out;
}

/** A mate for each common beast of a land: the same beast, a few steps off, there while it is. */
export function packmates(g: Ground, enemies: readonly EnemySpawn[], npcs: readonly NpcPlacement[] = []): EnemySpawn[] {
  const m = g.map;
  const taken = new Set<number>();
  for (const p of [...npcs, ...enemies]) take(taken, m, p.i, p.j);
  const out: EnemySpawn[] = [];
  enemies.forEach((e, n) => {
    if (!PACK.has(e.enemy) || LONE.has(e.key) || e.key.endsWith("~2")) return;
    const at = besideOf(g, e.i, e.j, 3, 6, taken, 401 + n) ?? besideOf(g, e.i, e.j, 1, 10, taken, 401 + n);
    if (!at) return;
    take(taken, m, at[0], at[1]);
    out.push({ ...e, key: `${e.key}~2`, i: at[0], j: at[1] });
  });
  return out;
}

/** And a second bird, bat or horse wherever there is one. */
export function flockmates(g: Ground, critters: readonly Critter[]): Critter[] {
  const m = g.map;
  const taken = new Set<number>();
  for (const c of critters) taken.add(c.j * m.w + c.i);
  const out: Critter[] = [];
  critters.forEach((c, n) => {
    if (c.key.endsWith("~2")) return;
    const at = besideOf(g, c.i, c.j, 2, 4, taken, 501 + n) ?? [c.i, c.j];
    taken.add(at[1] * m.w + at[0]);
    out.push({ ...c, key: `${c.key}~2`, i: at[0], j: at[1] });
  });
  return out;
}
