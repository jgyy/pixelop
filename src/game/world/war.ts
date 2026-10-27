import type { AnimId, HumanId } from "../art/characters";
import { WAR_BOSSES, type EnemyId, type WarBossId } from "../engine/enemies";
import type { AreaId } from "./ids";

/**
 * The fronts of the War of the Iron Banner, in the order the horde strikes
 * them, and the story flags the war leaves on the land. Kept free of story
 * code so the map builder and the region moods can read it.
 *
 * Flags (all derived from the war's progress, see story/war.ts):
 * - `camp:<front>`  the Northern Army is camped at this front
 * - `war:<front>`   the front burns: raiders roam, the fields are scorched, the sky is smoke
 * - `siege:<front>` its captain has come out to fight
 * - `freed:<front>` the front has been won back
 * - `scar:<front>:<dao>` how the land healed, by the Dao she walked when she won it
 */
export const FRONT_IDS = ["village", "bamboo", "lake", "marsh", "terraces", "harbor", "desert", "frost", "valley", "sect"] as const satisfies readonly AreaId[];
export type FrontId = (typeof FRONT_IDS)[number];

export const isFront = (id: string): id is FrontId => (FRONT_IDS as readonly string[]).includes(id);

/** The war's moods: smoke and embers over a burning front; afterwards, the sky the victory earned. */
export function warMood(id: AreaId, flags: Record<string, boolean>): { sky?: "dusk" | "storm" | "day"; weather?: "embers" | "petals" | "leaves" | "none"; night?: number; tint?: string } | undefined {
  if (!isFront(id)) return undefined;
  if (flags[`war:${id}`]) return { sky: "storm", weather: "embers", night: 0.3, tint: "#5a1a10" };
  if (flags[`scar:${id}:slaughter`]) return { sky: "dusk", weather: "embers", night: 0.18, tint: "#4a1018" };
  if (flags[`scar:${id}:mercy`]) return { weather: "petals" };
  return undefined;
}

// ----------------------------------------------------------------------------- who the war brings
/** Where on a front someone stands: in the army's camp, on its picket line, in Willow Creek's refugee camp, or back at home once the front is won. */
export type WarPost = "camp" | "picket" | "refuge" | "home";

export interface WarNpc {
  key: string;
  char: HumanId;
  name: string;
  anim?: AnimId;
  post: WarPost;
  /** Walk a short beat back and forth along the picket line. */
  patrol?: boolean;
  when: (f: Record<string, boolean>) => boolean;
}

/** The Northern Army's officers, who follow General Yue from front to front. */
export const OFFICERS = [
  { role: "general", key: "yue", char: "general", name: "General Yue", anim: undefined },
  { role: "quartermaster", key: "bao", char: "quartermaster", name: "Quartermaster Bao", anim: "write" },
  { role: "medic", key: "sulan", char: "medic", name: "Medic Su Lan", anim: "bandage" },
  { role: "drummer", key: "tian", char: "drummer", name: "Drummer Tian", anim: "drum" },
  { role: "scout", key: "feiyan", char: "scout", name: "Scout Feiyan", anim: "look" },
  { role: "deserter", key: "ashina", char: "deserter", name: "Ashina", anim: undefined },
  { role: "envoy", key: "kou", char: "envoy", name: "Envoy Kou", anim: "fan" },
] as const satisfies readonly { role: string; key: string; char: HumanId; name: string; anim: AnimId | undefined }[];
export type WarRole = (typeof OFFICERS)[number]["role"] | "soldier" | "refugee";

/** The four spearmen of each front's picket, and the two families it drove out. */
const SPEARMEN: Record<FrontId, string[]> = {
  village: ["Spearman Zhang", "Spearman Li", "Spearman Wang", "Standard-Bearer Zhao"],
  bamboo: ["Spearman Chen", "Spearman Liu", "Spearman Huang", "Standard-Bearer Zhou"],
  lake: ["Spearman Wu", "Spearman Xu", "Spearman Sun", "Standard-Bearer Ma"],
  marsh: ["Spearman Zhu", "Spearman Hu", "Spearman Guo", "Standard-Bearer He"],
  terraces: ["Spearman Lin", "Spearman Luo", "Spearman Gao", "Standard-Bearer Zheng"],
  harbor: ["Spearman Liang", "Spearman Xie", "Spearman Song", "Standard-Bearer Tang"],
  desert: ["Spearman Han", "Spearman Feng", "Spearman Deng", "Standard-Bearer Cao"],
  frost: ["Spearman Peng", "Spearman Zeng", "Spearman Xiao", "Standard-Bearer Tian"],
  valley: ["Spearman Pan", "Spearman Yuan", "Spearman Cai", "Standard-Bearer Jiang"],
  sect: ["Disciple-Spearman Yu", "Disciple-Spearman Du", "Disciple-Spearman Ye", "Standard-Bearer Cheng"],
};
const REFUGEES: Record<FrontId, [string, string]> = {
  village: ["Old Pan of the Outer Paddies", "Widow Tao of the Outer Paddies"],
  bamboo: ["Charcoal-Burner Lu", "Mother Qi of the Grove"],
  lake: ["Boatman Shi", "Lotus-Picker Jin"],
  marsh: ["Eel-Fisher Mao", "Reed-Weaver Fan"],
  terraces: ["Terrace-Farmer Kang", "Tea-Roller Bai"],
  harbor: ["Net-Maker Hong", "Fish-Seller Lan"],
  desert: ["Camel-Driver Ogedai", "Felt-Maker Saran"],
  frost: ["Yak-Herder Dorje", "Lamp-Nun Pema"],
  valley: ["Ex-Cultist Wei", "Ash-Gatherer Ruo"],
  sect: ["Outer Disciple Gou", "Kitchen-Hand Mei"],
};

const on = (flag: string) => (f: Record<string, boolean>) => !!f[flag];

/** Everyone the war puts on (or drives off) one front. */
export function warRoster(front: FrontId): WarNpc[] {
  const camp = on(`camp:${front}`);
  const out: WarNpc[] = OFFICERS.map((o) => ({
    key: `${o.key}-${front}`,
    char: o.char,
    name: o.name,
    anim: o.anim,
    post: "camp" as const,
    when:
      o.role === "general" && front === "village"
        ? (f: Record<string, boolean>) => camp(f) || (!!f.metZhou && !f["war:begun"])
        : o.role === "deserter"
          ? (f: Record<string, boolean>) => camp(f) && !!f["freed:village"]
          : o.role === "envoy"
            ? (f: Record<string, boolean>) => camp(f) && !!f["freed:lake"]
            : (f: Record<string, boolean>) => camp(f) && !!f["war:begun"],
  }));
  SPEARMEN[front].forEach((name, k) =>
    out.push({ key: `spear-${front}-${k}`, char: "soldier", name, anim: k === 3 ? "banner" : k === 2 ? "spear" : undefined, post: "picket", patrol: k < 2, when: (f) => camp(f) && !!f["war:begun"] }),
  );
  REFUGEES[front].forEach((name, k) => out.push({ key: `ref-${front}-${k}`, char: k ? "refugeeF" : "refugeeM", name, anim: k ? "grieve" : "cower", post: "refuge", when: on(`war:${front}`) }));
  out.push({ key: `home-${front}`, char: "refugeeM", name: REFUGEES[front][0], anim: "cheer", post: "home", when: on(`freed:${front}`) });
  return out;
}

/** Those who stand outside the fronts: Lady Gu at Willow Creek's war memorial, and the General once the war is over. */
export const WAR_FOLK: WarNpc[] = [
  { key: "gu", char: "widow", name: "Lady Gu", anim: "grieve", post: "refuge", when: on("war:begun") },
  { key: "yue-peace", char: "general", name: "General Yue", anim: undefined, post: "refuge", when: on("war:won") },
];

/** The foes that roam a burning front (beaten ones come back while it burns), and the captain who holds it. */
export function frontFoes(front: FrontId): EnemyId[] {
  const c = FRONT_IDS.indexOf(front);
  return c < 3 ? ["raider", "raider", "raider", "raider", "raider", "raider"] : c < 6 ? ["ironguard", "raider", "ironguard", "ironguard", "raider", "ironguard"] : ["bannerman", "ironguard", "bannerman", "bannerman", "ironguard", "bannerman"];
}
export const frontBoss = (front: FrontId): WarBossId => WAR_BOSSES[FRONT_IDS.indexOf(front)];
