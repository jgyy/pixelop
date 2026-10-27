/** Cultivation realms — the xianxia levelling ladder. */
export interface Realm {
  id: string;
  name: string;
  hanzi: string;
  colour: string;
  /** Number of minor stages inside the realm. */
  stages: number;
}

export const REALMS: Realm[] = [
  { id: "qi", name: "Qi Condensation", hanzi: "练气", colour: "#9ff5de", stages: 4 },
  { id: "foundation", name: "Foundation Establishment", hanzi: "筑基", colour: "#93c5ff", stages: 4 },
  { id: "core", name: "Core Formation", hanzi: "结丹", colour: "#f2c55c", stages: 4 },
  { id: "nascent", name: "Nascent Soul", hanzi: "元婴", colour: "#f6a6c9", stages: 4 },
  { id: "spirit", name: "Spirit Severing", hanzi: "化神", colour: "#c8a4ff", stages: 4 },
  { id: "ascension", name: "Immortal Ascension", hanzi: "飞升", colour: "#ffffff", stages: 1 },
];

export const STAGE_NAMES = ["Early", "Middle", "Late", "Peak"];
export const FINAL_REALM = REALMS.length - 1;

export interface Progress {
  realm: number;
  stage: number;
  cultivation: number;
}

/** Overall level index used for stat scaling (0-based). */
export function levelIndex(realm: number, stage: number): number {
  let n = 0;
  for (let r = 0; r < realm; r++) n += REALMS[r].stages;
  return n + stage;
}

/**
 * Cultivation required to fill the current stage. Each realm is steeper
 * than the last: the higher she climbs, the thinner heaven's qi is to her and
 * the more of it a stage takes.
 */
export function cultivationNeeded(realm: number, stage: number): number {
  const L = levelIndex(realm, stage);
  return Math.round((30 + 25 * L + 6 * L * L) * (1 + 0.35 * realm));
}

export function realmLabel(realm: number, stage: number): string {
  const r = REALMS[realm];
  if (!r) return "Unknown";
  return r.stages === 1 ? r.name : `${r.name} · ${STAGE_NAMES[stage]}`;
}

export function isAtPeak(p: Progress): boolean {
  return p.stage >= REALMS[p.realm].stages - 1;
}

/** True when the cultivator is full and must face a heavenly tribulation to advance. */
export function atBottleneck(p: Progress): boolean {
  return p.realm < FINAL_REALM && isAtPeak(p) && p.cultivation >= cultivationNeeded(p.realm, p.stage);
}

/**
 * Add cultivation; minor stages advance automatically, realm breakthroughs
 * cap at the bottleneck (excess qi dissipates).
 */
export function addCultivation(p: Progress, amount: number): Progress & { stagesGained: number } {
  const { realm } = p;
  let { stage, cultivation } = p;
  let stagesGained = 0;
  cultivation += Math.max(0, Math.floor(amount));
  if (realm >= FINAL_REALM) return { realm, stage, cultivation: 0, stagesGained };
  for (;;) {
    const need = cultivationNeeded(realm, stage);
    if (cultivation < need) break;
    if (stage >= REALMS[realm].stages - 1) {
      cultivation = need;
      break;
    }
    cultivation -= need;
    stage++;
    stagesGained++;
  }
  return { realm, stage, cultivation, stagesGained };
}

/** Advance to the next major realm (after surviving the tribulation). */
export function breakthrough(p: Progress): Progress {
  if (!atBottleneck(p)) return p;
  return { realm: p.realm + 1, stage: 0, cultivation: 0 };
}

export interface Stats {
  maxHp: number;
  maxQi: number;
  atk: number;
  def: number;
  spd: number;
}

export function statsFor(realm: number, stage: number): Stats {
  const L = levelIndex(realm, stage);
  return {
    maxHp: 80 + L * 28 + realm * 40,
    maxQi: 40 + L * 10 + realm * 15,
    atk: 14 + L * 5 + realm * 8,
    def: 4 + L * 2 + realm * 3,
    spd: 10 + L,
  };
}
