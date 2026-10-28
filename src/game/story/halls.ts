import { cultivationNeeded, levelIndex, realmLabel, REALMS } from "../engine/realms";
import { gainCultivation, heal, type GameState } from "../engine/state";
import { DAOS, dominantDao, walkDao } from "../engine/dao";
import { comprehend, GREAT_DAOS, WU_TIERS, wuCap, wuTier, type GreatDaoId } from "../engine/comprehension";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import type { AreaId } from "../world/ids";
import { HALL_BOSSES, HALL_CAST, HALL_DAOS, HALL_SITES, ROOMMATES, type HallBossId, type RoommateKey } from "../world/halls";
import { BOOKS as ROAD_BOOKS, roadPerson } from "./road";
import { SIGHTS } from "./bounties";
import { originOf } from "./origins";
import type { Choice, Step } from "./script";
import { giveAttire } from "./wardrobe";
import { HALL_BOOKS, type Beat, type BeatLine } from "./hallsBooks";

/**
 * The Ten Halls (十殿问道): the fifth thread of the main tale, a thousand
 * quests long.
 *
 * Once in six years the Sect of Ten Thousand Daos opens its east gate to
 * anyone under thirty, of any sect or none, and ten thousand come for a
 * hundred places. Its ten halls each teach one of the Great Daos of heaven
 * and earth from the inside. Lin Yue queues with the ten thousand, climbs
 * the Stair of Asking Heart with her cultivation sealed at the Gate of Equal
 * Footing, and wins a bunk in Room Seven of the Outer Court, where the
 * Azure Cloud's founder once slept one winter, with five roommates: a farm
 * boy, a merchant's daughter, a porter's son, a girl who writes everything
 * down, and a twelve-year-old who swears he is sixteen and whose brother
 * "went home" six years ago and never arrived.
 *
 * Ten books of a hundred quests, one for each hall, each its own tale told
 * in hand-written beats (see hallsBooks.ts), with an outer disciple's life
 * between them: lectures, chores, missions, bouts in the ring, long
 * sittings and the roommates' own troubles. Under all ten runs the mystery
 * of the disciples who go home, which ends in the sealed Hall of the Void.
 *
 * Every quest is composed from its number, so the save holds only how many
 * are done (`halls`) and how far the current one has got (`hallsp`). The
 * flags the court answers to are derived from those (see syncHallsFlags).
 */

export const HALLS_COUNT = 1000;
export const HALLS_BOOK = 100;
/** The land the Ten Halls' court stands in (its shrine counts for the long sittings). */
export const HALLS_AREA: AreaId = "terraces";

export type HallKind = "beat" | "lecture" | "chore" | "roommate" | "mission" | "spar" | "contemplate" | "patrol" | "comprehend" | "duel";

export interface HallQuest {
  id: number;
  book: number;
  step: number;
  dao: GreatDaoId;
  kind: HallKind;
  title: string;
  objective: string;
  /** Who she must speak to (beat, lecture, chore, roommate, mission). */
  npc?: string;
  count: number;
  /** Where (patrol): a landmark, and how she must be there. */
  landmark?: string;
  how?: "any" | "night" | "day" | "ride" | "fly";
  /** Where (contemplate). */
  region?: AreaId;
  /** The realm the hall asks of her for this quest (an overall level index). */
  level: number;
  /** Said or narrated when it is done. */
  done: string;
  /** How far nearer the book's Great Dao it brings her. */
  wu: number;
  reward: { stones: number; cult: number };
}

export const HALL_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const daoNoun = (dao: GreatDaoId) => GREAT_DAOS[dao].name.replace(/^Dao of (the )?/, "");
const daoWord = (dao: GreatDaoId) => (dao === "void" ? "the void" : daoNoun(dao).toLowerCase());

/** Who answers to a Ten Halls NPC key: a name, a look, and where they are found. */
export function hallPerson(key: string): { key: string; name: string; char: HumanId; where: string } {
  const base = key.startsWith("wdf-") ? `wd-${key.slice(4)}` : key;
  const c = HALL_CAST[base];
  if (c) {
    const where = key.startsWith("wdf-") || key === "wd-yanshu" ? "outside the Ten Halls' east gate" : key === "wd-herald" ? "Willow Creek's market road" : (ROOMMATES as readonly string[]).includes(key) ? "Room Seven of the Outer Court" : "the court of the Ten Halls";
    return { key, name: c.name, char: c.char, where };
  }
  const p = roadPerson(key);
  return { key, name: p.name, char: p.char, where: REGION_PLACE[p.region] };
}

/** The bosses' and the court's other voices, for beats and duels. */
const SPEAKERS: Record<string, { name: string; char: HumanId }> = {
  ...HALL_CAST,
  "wd-kui": { name: "Enforcer Captain Kui", char: "enforcer" },
  "wd-frost": { name: "Frost Warden of the Library", char: "frostwarden" },
  "wd-hong": { name: "Murong Hong", char: "murongelder" },
};

const REGION_PLACE: Record<AreaId, string> = {
  sect: "the Azure Cloud Sect",
  village: "Willow Creek",
  bamboo: "the Whispering Bamboo",
  lake: "the Lotus Lake",
  valley: "the Crimson Demon Valley",
  peak: "Heavenly Tribulation Peak",
  marsh: "the Mistmarsh",
  terraces: "the Cloudmist lands (the Ten Halls' court has its own shrine)",
  desert: "the Yellow Sands",
  harbor: "the eastern shore",
  frost: "Frostveil",
};

/** Where a landmark is, in words. */
function sightName(key: string): string {
  if (key === "wandao") return "the square of the Ten Halls";
  if (key === "wdgate") return "the Gate of Equal Footing";
  if (key === "hailing") return "the port of Hailing";
  if (key === "saltwind") return "Saltwind's salt pans";
  return SIGHTS.find((x) => x.key === key)?.name ?? key;
}
const sightRegion = (key: string): AreaId => (key === "wandao" || key === "wdgate" ? HALLS_AREA : key === "hailing" || key === "saltwind" ? "harbor" : (SIGHTS.find((x) => x.key === key)?.region ?? HALLS_AREA));

// ----------------------------------------------------------------------------- an outer disciple's days
const CHORES: { title: string; objective: string; ask: string; done: string }[] = [
  { title: "Hot Water Before Dawn", objective: "Steward Gou wants the east row's water jars filled before the dawn bell.", ask: "Jars. Water. Before the bell. You know the way to the well.", done: "Twelve jars, filled. Steward Gou grunts, which is praise." },
  { title: "Sweep the Square", objective: "Steward Gou has a broom with your name on it. Sweep the square of the Ten Halls.", ask: "Broom. Square. Mind the corners; the masters notice corners.", done: "The square is swept. A wind from the Hall With No Walls unsweeps half of it." },
  { title: "Scrub the Dining Hall", objective: "Steward Gou says the dining hall floor has opinions about Room Seven. Scrub it.", ask: "The dining hall floor. On your knees, outer disciple. It builds character, and clean floors.", done: "The floor shines. Tie Niu's dinner bowl leaves a ring on it within the hour." },
  { title: "Night Count", objective: "Steward Gou wants help with the night count of the east row.", ask: "Count with me. Every bunk, every sleeper. Out loud.", done: "Every bunk counted, every sleeper breathing. Gou writes the number down twice." },
  { title: "Mend the Window", objective: "Room Seven's window still does not shut. Steward Gou has a hammer and opinions.", ask: "Hammer. Window. Room Seven's, the one that won't shut. Founder's bunk or not, it whistles.", done: "The window shuts. Mostly. The founder's bunk is a little less cold." },
  { title: "Laundry Day", objective: "It is laundry day in the Outer Court, and Steward Gou is counting sleeves.", ask: "Sleeves. Sixty robes. Count them twice; somebody always loses one.", done: "Sixty robes, washed and hung. One of Yao Zhi's is silk. Gou pretends not to notice." },
  { title: "Carry the Rice", objective: "The rice cart has come. Steward Gou needs strong backs at the dormitories.", ask: "Rice cart's here. Backs. Yours is a back.", done: "Forty sacks carried. Tie Niu carried twenty-five of them, and asked for more." },
  { title: "The Latrine Rota", objective: "It is Room Seven's turn on the latrine rota. Steward Gou is smiling, which is worse than frowning.", ask: "Your rota. Don't look at me like that. I did it for forty years.", done: "Done. Nobody in Room Seven will speak of it." },
];

const MISSION_TITLES = ["A Letter from the Mission Hall", "Contribution", "An Errand Outside the Walls", "The Hall's Business", "Carried and Delivered"];
const MISSION_ASKS = [
  "carry the {hall}'s letter to {who} and bring back an answer",
  "deliver a jar of the court's tea to {who}, with the {hall}'s thanks",
  "ask {who} what {dao} means to them, for the {hall}'s records",
  "bring {who} a remedy from the Ward of Long Sleep",
];
const MISSION_DONE = [
  "“For the Ten Halls? Tell them I said yes. Tell them I said it twice.”",
  "“A letter from a sect! Wait till my neighbour hears. Here, take some dried persimmons back for the steward.”",
  "“I've an answer for them. Write it down carefully, now: the world is bigger than any hall.”",
  "“Every six years they send someone, and every six years they're younger. Off you go, then.”",
  "“Thank your masters for me. And eat something. Cultivators always look hungry.”",
  "“The Ten Halls remember me? Well. I remember them. My cousin went home from there, once.”",
];
const SPAR_TITLES = ["A Bout in the Ring", "Sparring Partners", "The Ring Is Open", "Crossed Palms", "Practise on Each Other"];
const PATROL_TITLES = ["Patrol", "The Court's Business Abroad", "Watch the {daoN}", "A Lesson Outside the Walls"];
const SIT_TITLES = ["The Long Sitting", "Breathe With the {daoN}", "Stillness Hour", "Sit, and Do Not Try"];

const GENERIC_ROOMMATE: Record<RoommateKey, string[]> = {
  "wd-shenbai": ["Grandfather says hello. He says it in every letter. He means it every time.", "I traded my rice cake for a whetstone. For the hoe. Worth it."],
  "wd-yaozhi": ["Don't touch my tea. That is a statement of friendship, not hostility.", "I've decided Room Seven is my family's least embarrassing investment."],
  "wd-tieniu": ["Dumpling? It's squashed. They're always squashed. It's the pocket.", "I carried Steward Gou's chair up the stairs today. With him in it. He didn't say thank you. He said 'Again.'"],
  "wd-meilan": ["I've written down every word Steward Gou said this year. There are not many.", "Hold still. I'm drawing you. You look like someone who's about to do something brave."],
  "wd-qiu": ["I'm sixteen. …Fine. But I'm nearly the age I say I am.", "When Feng comes home I'm going to make him sleep in the cold bunk. Brothers' rules."],
};

// ----------------------------------------------------------------------------- composing the quests
/** What the halls ask of her at a quest: the book's realm, a step more after its middle, and Spirit Severing's late stage for the Examiner. */
function levelFor(book: number, step: number): number {
  if (book === 9 && step === 99) return 18;
  return HALL_BOOKS[book].level + (step >= 50 ? 1 : 0);
}

/** [realm, stage] for an overall level index. */
function realmOf(level: number): [number, number] {
  let n = level;
  for (let r = 0; r < REALMS.length; r++) {
    if (n < REALMS[r].stages) return [r, n];
    n -= REALMS[r].stages;
  }
  return [REALMS.length - 1, 0];
}

/** Whether a roommate is away from Room Seven at a point in the tale: Shen Bai asleep in the Ward, Mei Lan behind the sealed door. */
export function roommateAway(key: string, book: number, step: number): boolean {
  if (key === "wd-shenbai") return book === 8 && step >= 10;
  if (key === "wd-meilan") return book === 9;
  return false;
}

const KINDS: [HallKind, number][] = [
  ["roommate", 0.18],
  ["mission", 0.17],
  ["lecture", 0.15],
  ["spar", 0.14],
  ["chore", 0.12],
  ["contemplate", 0.12],
  ["patrol", 0.12],
];

function pickKind(r: number): HallKind {
  for (const [k, w] of KINDS) {
    if (r < w) return k;
    r -= w;
  }
  return "patrol";
}

const hallName = (book: number) => HALL_SITES[book].name;

function compose(id: number): HallQuest {
  const book = Math.floor(id / HALLS_BOOK);
  const step = id % HALLS_BOOK;
  const dao = HALL_DAOS[book];
  const B = HALL_BOOKS[book];
  const R = ROAD_BOOKS[dao];
  const h = (k: number) => hash2(id, k, 7717);
  const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  const level = levelFor(book, step);
  const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((10 + book * 7 + step * 0.2) * stoneK), cult: cultK });
  const base = { id, book, step, dao, level };
  const v = { hall: hallName(book), daoN: daoNoun(dao), dao: daoWord(dao) };
  const fill = (s: string, x: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => x[k] ?? k);

  const beat = B.beats.find((b) => b.step === step);
  if (beat)
    return {
      ...base,
      kind: "beat",
      title: step === 0 ? `Hall ${HALL_NUMERALS[book]} · ${B.title}` : beat.title,
      objective: beat.objective,
      npc: beat.npc,
      count: 1,
      done: beat.done,
      wu: step === 0 || step === 98 ? 2 : 1,
      reward: reward(step === 0 ? 0.08 : 0.06, step === 0 ? 2 : 1.4),
    };
  if (step === 99)
    return {
      ...base,
      kind: "duel",
      title: ENEMIES[HALL_BOSSES[book]].name,
      objective: `${cap(B.boss.intro.split(/[.,]/)[0])}. Face it in the court of the Ten Halls.`,
      count: 1,
      done: B.boss.victory,
      wu: 3,
      reward: reward(0.4, 6),
    };
  if (step === 50)
    return {
      ...base,
      kind: "comprehend",
      title: "The Hall's Second Gate",
      objective: `The ${hallName(book)} will teach you no further until you reach ${realmLabel(...realmOf(level))} and comprehend the ${GREAT_DAOS[dao].name} to ${WU_TIERS[1].name} (or as far as your realm can hold): sit, watch, ask, and attend the lectures.`,
      count: 1,
      done: "The hall's master looks at her for a long moment and nods: the second half of the year's teaching may begin.",
      wu: 0,
      reward: reward(0.05),
    };
  let kind = pickKind(h(2));
  // the Hall of the Void has no master to lecture until it is opened: the eldest teaches in its place
  const present = ROOMMATES.filter((k) => !roommateAway(k, book, step));
  switch (kind) {
    case "roommate": {
      const who = at(present, 3);
      const lines = [...(B.roommates[who] ?? []), ...GENERIC_ROOMMATE[who]];
      const p = hallPerson(who);
      return {
        ...base,
        kind,
        title: `${p.name}`,
        objective: `${p.name} wants a word in Room Seven of the Outer Court.`,
        npc: who,
        count: 1,
        done: at(lines, 4),
        wu: 1,
        reward: reward(0.03),
      };
    }
    case "mission": {
      const who = roadPerson(at(R.folk, 5));
      const ask = fill(at(MISSION_ASKS, 6), { ...v, who: who.name });
      return {
        ...base,
        kind,
        title: at(MISSION_TITLES, 7),
        objective: `Mission from Senior Sister Fan Yu: ${ask} (${REGION_PLACE[who.region].replace(/ \(.*\)$/, "")}).`,
        npc: who.key,
        count: 1,
        done: at(MISSION_DONE, 8),
        wu: 1,
        reward: reward(0.05, 1.3),
      };
    }
    case "lecture":
      return {
        ...base,
        kind,
        title: `A Lecture of the ${hallName(book).replace(/^The /, "")}`,
        objective: `${hallPerson(B.teacher).name} is lecturing in the court of the Ten Halls. Attend.`,
        npc: B.teacher,
        count: 1,
        done: at(B.lectures, 9),
        wu: 1,
        reward: reward(0.05),
      };
    case "chore": {
      const c = at(CHORES, 10);
      return { ...base, kind, title: c.title, objective: c.objective, npc: "wd-gou", count: 1, done: c.done, wu: 0, reward: reward(0.03, 0.8) };
    }
    case "spar": {
      const n = 1 + Math.floor(h(11) * 3);
      return {
        ...base,
        kind,
        title: at(SPAR_TITLES, 12),
        objective: `Win ${n} bout${n > 1 ? "s" : ""} against the sparring disciples in the ring of the Ten Halls.`,
        count: n,
        done: n === 1 ? "Her partner bows from the dust, laughing. “Again tomorrow?”" : "The last of them taps out. The row cheers, mostly for the ones who lost bravely.",
        wu: 1,
        reward: reward(0.04 + n * 0.01, 1.2),
      };
    }
    case "contemplate": {
      const region = at([...R.shrines, HALLS_AREA], 13);
      const n = 6 + Math.floor(h(14) * 4) * 2;
      return {
        ...base,
        kind,
        title: fill(at(SIT_TITLES, 15), v),
        objective: `Sit ${n} breaths at a lotus shrine in ${REGION_PLACE[region]}, as the ${hallName(book)} asks of its disciples.`,
        region,
        count: n,
        done: `At the bottom of her stillness she feels ${daoWord(dao)} move, the way her masters said it would.`,
        wu: 1,
        reward: reward(0.05),
      };
    }
    case "patrol":
    default: {
      kind = "patrol";
      const sight = at(["wandao", ...R.sights], 16);
      const how = at(["any", "any", "night", "day", "ride", "fly"] as const, 17);
      const howText = { any: "", night: " after dark", day: " by daylight", ride: " on Cloudmane", fly: " on your flying sword" }[how];
      return {
        ...base,
        kind,
        title: fill(at(PATROL_TITLES, 18), v),
        objective: `The ${hallName(book)} sends its disciples to watch ${daoWord(dao)} at work: go to ${sightName(sight)}${howText}.`,
        landmark: sight,
        how,
        count: 1,
        done: `She watches ${daoWord(dao)} at work at ${sightName(sight)}, and something her master said last week suddenly makes sense.`,
        wu: 1,
        reward: reward(0.05, 1.1),
      };
    }
  }
}

let all: HallQuest[] | null = null;
/** Every quest of the Ten Halls (composed once). */
export function hallsQuests(): HallQuest[] {
  return (all ??= Array.from({ length: HALLS_COUNT }, (_, id) => compose(id)));
}
export const hallsQuestAt = (id: number) => hallsQuests()[id];
const beatOf = (q: HallQuest): Beat | undefined => (q.kind === "beat" ? HALL_BOOKS[q.book].beats.find((b) => b.step === q.step) : undefined);

// ----------------------------------------------------------------------------- the save
export const hallsDone = (g: GameState) => Math.max(0, Math.min(HALLS_COUNT, g.counters.halls ?? 0));
const hallsProgress = (g: GameState) => g.counters.hallsp ?? 0;

/** The Selection is open to her once Elder Mo has sent her out into the jianghu and she can hold her own at the gate (late Qi Condensation). */
export const hallsOpen = (g: GameState) => !!g.flags.metElder && (levelIndex(g.realm, g.stage) >= 2 || hallsDone(g) > 0);

/** The quest she is on, or null before the Selection reaches her and after the tale ends. */
export function currentHalls(g: GameState): HallQuest | null {
  if (!hallsOpen(g)) return null;
  const n = hallsDone(g);
  return n < HALLS_COUNT ? hallsQuestAt(n) : null;
}

/** Whether her cultivation (and past a book's middle, her understanding) is what the hall asks. The Selection itself seals every cultivation, so it asks nothing. */
export function strongEnough(g: GameState, q: HallQuest): boolean {
  if (q.book === 0 && q.step < 8) return true;
  if (levelIndex(g.realm, g.stage) < q.level) return false;
  return q.step < 50 || q.kind === "comprehend" || wuTier(g, q.dao) >= Math.min(2, wuCap(g.realm));
}

/**
 * Bring the court's flags in line with the tale: `halls:selection` while the
 * hopefuls queue at the gate, `halls:joined` once she has her bunk,
 * `halls:away:<key>` while a roommate is missing from Room Seven,
 * `halls:boss:<book>` while a book's trouble is out, `halls:lupinggone` from
 * the night Lu Ping is carried off until he comes home, `halls:hallopen`
 * once the Hall of the Void is unsealed, and `halls:done` at the end.
 */
export function syncHallsFlags(g: GameState): GameState {
  const n = hallsDone(g);
  const open = hallsOpen(g);
  const book = Math.min(9, Math.floor(n / HALLS_BOOK));
  const step = n % HALLS_BOOK;
  const going = open && n < HALLS_COUNT;
  const flags: Record<string, boolean> = {
    ...g.flags,
    "halls:begun": n >= 1,
    "halls:selection": going && n >= 1 && n < 8,
    "halls:joined": n >= 8,
    "halls:lupinggone": n >= 280 && n < HALLS_COUNT,
    "halls:hallopen": n >= 991,
    "halls:done": n >= HALLS_COUNT,
  };
  for (const k of ROOMMATES) flags[`halls:away:${k}`] = going && roommateAway(k, book, step);
  HALL_BOSSES.forEach((_, b) => (flags[`halls:boss:${b}`] = going && book === b && step === 99));
  // the same state back when nothing has moved, so the game can keep them in step every tick for free
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

/** Outfits along the way. */
export const HALL_MILESTONES: { at: number; attire: string; note: string }[] = [
  { at: 500, attire: "innerrobe", note: "Five halls, five years: the Ten Halls name her an inner disciple. The new robe is deep blue, its cuffs stitched in the colours of the five Daos she has studied, and five more left bare." },
];

/** Grant what a hall brings: comprehension of its Dao (with a word if she reaches a new stage, or her realm holds her back). */
function understand(g: GameState, dao: GreatDaoId, by: number, eaten = false): { state: GameState; note: string | null } {
  if (by <= 0) return { state: g, note: null };
  const r = comprehend(g, dao, by, eaten);
  const G = GREAT_DAOS[dao];
  if (r.tierUp) return { state: r.state, note: `${G.hanzi} ${G.name}: ${WU_TIERS[r.tierUp - 1].hanzi} ${WU_TIERS[r.tierUp - 1].name}` };
  if (r.capped) return { state: r.state, note: `Your realm can hold no more of the ${G.name} yet` };
  return { state: r.state, note: null };
}

/** Mark the current quest done: pay out, deepen her understanding, move the tale on, and hand out any outfit. */
export function completeHalls(g: GameState, id: number): GameState {
  if (hallsDone(g) !== id) return g;
  const q = hallsQuestAt(id);
  let s: GameState = { ...g, counters: { ...g.counters, halls: id + 1, hallsp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  s = understand(s, q.dao, q.wu).state;
  const b = beatOf(q);
  if (b?.attire) s = giveAttire(s, b.attire);
  const m = HALL_MILESTONES.find((x) => x.at === id + 1);
  if (m) s = giveAttire(s, m.attire);
  return syncHallsFlags(s);
}

const advanceHalls = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, hallsp: hallsProgress(g) + by } });

// ----------------------------------------------------------------------------- how the halls speak
const narr = (text: string): Step => ({ say: "narrator", text });

/** A line of a beat, as a step. */
function lineStep(l: BeatLine): Step {
  if (!Array.isArray(l)) return { anim: l.a, name: l.n, wait: true };
  const [who, text] = l;
  if (who === "narr") return narr(text);
  if (who === "hero") return { say: "heroine", text };
  const s = SPEAKERS[who.startsWith("wdf-") ? `wd-${who.slice(4)}` : who];
  return s ? { say: s.char, name: s.name, text } : narr(text);
}

/** The steps that finish a quest: a toast, the understanding it brings, and any outfit. */
function finish(q: HallQuest, g: GameState): Step[] {
  const next = completeHalls(g, q.id);
  const m = HALL_MILESTONES.find((x) => x.at === q.id + 1);
  const b = beatOf(q);
  const gained = understand(g, q.dao, q.wu).note;
  const steps: Step[] = [{ mutate: (s) => completeHalls(s, q.id) }, { toast: `The Ten Halls ${q.id + 1}/${HALLS_COUNT}: ${q.title} · +${q.reward.stones} spirit stones${q.wu ? ` · the ${daoNoun(q.dao)} +${q.wu}` : ""}` }];
  if (gained) steps.push({ anim: "hero", name: "comprehend", wait: true }, { toast: gained });
  if (b?.attire) steps.push({ toast: "An outer disciple's robe: see the wardrobe (V)" });
  if (m) steps.push({ anim: "hero", name: "twirl", wait: true }, narr(m.note), { toast: "A gift of the Ten Halls: see the wardrobe (V)" });
  const after = currentHalls(next);
  if (after && after.step === 0 && q.step !== 0) steps.push({ toast: `Hall ${HALL_NUMERALS[after.book]}: ${HALL_BOOKS[after.book].title} · report to ${hallPerson(after.npc!).name}` });
  if (q.book === 0 && q.step === 7) steps.push({ reshape: true });
  return steps;
}

/** She is not yet strong enough, or does not yet understand enough: whoever she asked tells her so. */
function tooWeak(q: HallQuest, who: { char: HumanId; name: string }, g: GameState): Step[] {
  const need = levelIndex(g.realm, g.stage) < q.level ? realmLabel(...realmOf(q.level)) : `${WU_TIERS[1].name} of the ${GREAT_DAOS[q.dao].name}`;
  return [{ say: who.char, name: who.name, text: `Not yet, outer disciple. What the ${hallName(q.book)} teaches next would go straight through you. Come back at ${need}.` }, { toast: `The Ten Halls ask for ${need}` }];
}

/** Why she, of all people, queues at the Ten Halls' gate: as her beginning would say it. */
function heraldReply(g: GameState): string {
  return {
    disciple: "Elder Mo always says the Great Daos cannot be learned from books. If the Ten Halls teach them from the inside… I would leave my robe at a gate for that.",
    foundling: "Granny Hua says nobody in Willow Creek has ever been chosen for anything. Then I will be the first. Ten thousand? Good. I'm used to queues.",
    defector: "A gate where nobody asks what robe I used to wear. Where everyone is nobody. …I think I would like to be nobody for a while.",
  }[originOf(g.flags)];
}

/** A beat of the tale: its lines, its question if it has one, and what comes after. */
function beatSteps(q: HallQuest, b: Beat, g: GameState): Step[] {
  const steps: Step[] = [{ emote: q.npc!, icon: "!" }, ...b.lines.map(lineStep)];
  if (q.book === 0 && q.step === 0) steps.push({ say: "heroine", text: heraldReply(g) });
  if (b.choice) {
    const options: Choice[] = b.choice.options.map((o) => ({
      label: o.label,
      hint: DAOS[o.heart].name,
      then: [{ mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.heart, 1) }, narr(o.then), lineStep(o.reply), { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` }],
    }));
    steps.push({ choose: options, prompt: b.choice.prompt });
  }
  steps.push(...(b.after ?? []).map(lineStep), narr(b.done), ...finish(q, g));
  if (q.step === 0 && q.book > 0) steps.push({ toast: `${HALL_SITES[q.book].name} (${HALL_SITES[q.book].hanzi}) · the ${GREAT_DAOS[q.dao].name}` });
  if (q.book === 0 && q.step === 0) steps.push({ toast: "A new main quest: the Ten Halls · see the Journal (J)" });
  if (q.step === 98) steps.push({ reshape: true }, { toast: `${ENEMIES[HALL_BOSSES[q.book]].name} · face it in the court of the Ten Halls` });
  return steps;
}

const TALK_KINDS: HallKind[] = ["beat", "lecture", "chore", "roommate", "mission"];

/**
 * What talking to this person does for the Ten Halls right now: a beat of the
 * tale, a lecture, a chore, a roommate's word, a mission's errand. Null when
 * they have nothing to do with the quest she is on.
 */
export function hallsTalk(key: string, g: GameState): Step[] | null {
  const q = currentHalls(g);
  if (!q || q.npc !== key || !TALK_KINDS.includes(q.kind)) return null;
  const who = hallPerson(key);
  if (!strongEnough(g, q)) return tooWeak(q, who, g);
  const b = beatOf(q);
  if (b) return beatSteps(q, b, g);
  const say = (text: string): Step => ({ say: who.char, name: who.name, text });
  switch (q.kind) {
    case "lecture":
      return [{ anim: key, name: "lecture" }, say(q.done), { anim: "hero", name: "nod", wait: true }, ...finish(q, g)];
    case "chore":
      return [say(CHORES.find((c) => c.title === q.title)?.ask ?? "Chores. Off you go."), { anim: "hero", name: q.title.includes("Scrub") ? "scrub" : q.title.includes("Water") ? "bucket" : q.title.includes("Sweep") ? "sweep" : "carry", wait: true }, narr(q.done), ...finish(q, g)];
    case "roommate":
      return [{ emote: key, icon: "..." }, say(q.done), { anim: "hero", name: "laugh", wait: true }, ...finish(q, g)];
    case "mission":
    default:
      return [{ say: "heroine", text: `${who.name}? I come from the Ten Halls, on the Mission Hall's business.` }, say(q.done), { anim: "hero", name: "bow", wait: true }, ...finish(q, g)];
  }
}

/** Whether someone wants a word for the Ten Halls (the quest she is on is theirs). */
export function hallsHasNews(key: string, g: GameState): boolean {
  const q = currentHalls(g);
  return !!q && q.npc === key && TALK_KINDS.includes(q.kind);
}

/** The land a quest sends her to (null for the court itself, which is never sealed once the tale can reach her). */
export function hallsRegion(q: HallQuest): AreaId | null {
  if (q.region) return q.region === HALLS_AREA ? null : q.region;
  if (q.landmark) return q.landmark === "wandao" ? null : sightRegion(q.landmark);
  if (q.npc && !q.npc.startsWith("wd")) return roadPerson(q.npc).region;
  return null;
}

/** The quest line for the HUD and the journal (null before the Selection reaches her). */
export function hallsLog(g: GameState, locked: (id: AreaId) => string | null = () => null): { chapter: string; title: string; objective: string } | null {
  if (!hallsOpen(g)) return null;
  const n = hallsDone(g);
  if (n >= HALLS_COUNT) return { chapter: "The Ten Halls", title: "The Hall of the Void Has a Master Again", objective: `All ${HALLS_COUNT} quests of the Ten Halls are done. Room Seven is full again, and the east row sleeps soundly.` };
  const q = hallsQuestAt(n);
  const B = HALL_BOOKS[q.book];
  const chapter = `Halls · ${HALL_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${HALLS_COUNT} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "comprehend") {
    const need = levelIndex(g.realm, g.stage) < q.level ? realmLabel(...realmOf(q.level)) : `${WU_TIERS[1].name} of the ${GREAT_DAOS[q.dao].name}`;
    return { chapter, title, objective: `The ${hallName(q.book)} asks for ${need} before it will teach you further. Cultivate, and sit where the ${daoNoun(q.dao)} runs strong.` };
  }
  const where = hallsRegion(q);
  const lock = where && locked(where);
  if (lock && where) return { chapter, title, objective: `The errand waits on the way to ${REGION_PLACE[where]}, which is still closed to you: ${lock}` };
  const progress = q.kind === "spar" || q.kind === "contemplate" ? ` (${Math.min(q.count, hallsProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: q.objective + progress };
}

/** A bout won in the ring: it counts if the quest wants bouts. */
export function hallsHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentHalls(g);
  if (!q || q.kind !== "spar" || enemy !== "wdspar" || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advanceHalls(g);
  if (hallsProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${hallsProgress(s)}/${q.count}` };
}

/** Breaths at a shrine: they count if the quest wants her to sit in this land. */
export function hallsBreath(g: GameState, area: AreaId): { state: GameState; steps: Step[] | null } {
  const q = currentHalls(g);
  if (!q || q.kind !== "contemplate" || q.region !== area || !strongEnough(g, q)) return { state: g, steps: null };
  const s = advanceHalls(g);
  if (hallsProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)] };
  return { state: s, steps: null };
}

/** At a landmark: watching the Dao at work, at the hour and in the way the hall wanted. */
export function hallsLandmark(landmark: string, g: GameState, how: { night: boolean; riding: boolean; flying: boolean }): Step[] | null {
  const q = currentHalls(g);
  if (!q || q.kind !== "patrol" || q.landmark !== landmark || !strongEnough(g, q)) return null;
  const ok = q.how === "any" || (q.how === "night" && how.night) || (q.how === "day" && !how.night) || (q.how === "ride" && how.riding) || (q.how === "fly" && how.flying);
  if (!ok) return null;
  return [...(how.flying || how.riding ? [] : [{ anim: "hero", name: "look", wait: true } as Step]), narr(q.done), ...finish(q, g)];
}

/** Her realm and understanding have caught up: the hall's second gate opens by itself. */
export function hallsCultivated(g: GameState): Step[] | null {
  const q = currentHalls(g);
  if (!q || q.kind !== "comprehend" || levelIndex(g.realm, g.stage) < q.level || wuTier(g, q.dao) < Math.min(2, wuCap(g.realm))) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- each hall's trouble
const isHallBoss = (id: EnemyId): id is HallBossId => (HALL_BOSSES as readonly string[]).includes(id);

export function hallsPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentHalls(g);
  if (!q || q.kind !== "duel" || !isHallBoss(enemy) || HALL_BOSSES[q.book] !== enemy) return null;
  const B = HALL_BOOKS[q.book];
  const steps: Step[] = [{ shake: 0.3 }, narr(B.boss.intro), ...B.boss.words.map(lineStep)];
  const d = dominantDao(g);
  if (d) steps.push({ say: "heroine", text: { sword: "Then let the blade answer.", mercy: "I'd rather nobody got hurt. But I won't step aside.", balance: "Come, then. Let's see where this settles.", slaughter: "You chose the wrong outer disciple." }[d] });
  return steps;
}

/** After a hall's trouble is beaten: what she does about it, and the court as it is left. */
export function hallsVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentHalls(g);
  if (!q || q.kind !== "duel" || !isHallBoss(enemy) || HALL_BOSSES[q.book] !== enemy) return null;
  const B = HALL_BOOKS[q.book];
  const last = q.id === HALLS_COUNT - 1;
  const options: Choice[] = B.boss.fates.map((f) => {
    const dark = f.heart === "slaughter";
    return {
      label: f.label,
      hint: DAOS[f.heart].name,
      then: [
        { mutate: (s) => walkDao(dark ? shift(s, CULT.demon, 6) : s, f.heart, 3) },
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`halls:fate:${q.book}`]: true, [`halls:fate:${q.book}:${f.heart}`]: true } }) },
        narr(f.line),
        ...finish(q, g),
        { reshape: true },
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: dark ? "roar" : "comprehend", wait: true },
        narr(B.boss.victory),
        ...(last ? hallsEnd(f.heart) : [{ toast: `Hall ${HALL_NUMERALS[q.book]} is done: ${B.title} · the ${GREAT_DAOS[q.dao].name}` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "victory", wait: true }, { choose: options, prompt: `${ENEMIES[enemy].name} is beaten. What now?` }];
}

/** The Hall of the Void has its master again: the tale ends. */
function hallsEnd(heart: string): Step[] {
  return [
    { shake: 0.8 },
    { flash: "#e8e0ff" },
    {
      narrate: [
        "Ning Wuhen walks out of the Sealed Hall of the Void into daylight for the first time in sixty years, leaning on his granddaughter, and every master of the Ten Halls bows to him at once.",
        heart === "balance" ? "In the square, a thin old man with lovely handwriting sweeps the flagstones, and Steward Gou counts him in the row every night." : heart === "mercy" ? "Yan Shu follows his master out, a step behind, as he did sixty years ago, and nobody can decide whether to forgive him. Ning already has." : "Of the Examiner, nothing is left but his brush on a table in an empty chamber.",
        "That night Steward Gou does the count of the east row, and every bunk is full, and he writes the number down three times and then sits on the step outside Room Seven and weeps.",
      ],
    },
    { mutate: (s) => giveAttire(s, "tenhalls") },
    { anim: "hero", name: "twirl", wait: true },
    { toast: "The Ten Halls are done · the Robe of the Ten Halls is in the wardrobe (V)" },
  ];
}

// ----------------------------------------------------------------------------- everyday words
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + hallsDone(g)) % lines.length];
}

const IDLE: Record<string, string[]> = {
  "wd-herald": ["Once in six years! Any soul under thirty! Ten thousand come, one hundred stay!", "Leave your sect at the gate! Inside, every hopeful is equal!"],
  "wd-yanshu": ["The register is in order. It is always in order.", "Such a bright future. The stone thought so too.", "Everyone the seal says goes home, goes home."],
  "wd-gou": ["Curfew at the second watch. I count. I always count.", "Hot water's gone. It's always gone. Get up earlier.", "Room Seven. Of all the rooms."],
  "wd-fanyu": ["The board's full. It's always full. Take a slip.", "If anyone goes home in the night, tell me first.", "Contribution buys lectures, pills and the right to complain. Mostly complain."],
  "wd-murong": ["Murong Xiao. Outer disciple. Just that. It's lighter than I expected.", "Rice, plain rice. You get used to it. I'm getting used to it.", "I spar with first-years in the mornings. They hit very hard for people with no clan."],
  "wd-ning": ["Sixty years. The light is very bright out here.", "The void is not nothing, girl. It is room.", "Thank you for not opening the door. Everyone always wants to open the door."],
};

const OUTER_LINES = [
  "First year? Second? It all blurs after the Selection. Have you seen the steward's face when the hot water runs out?",
  "Room Seven! You're the ones who caught the wind. Everyone's heard.",
  "I came for the Hall of the Red Furnace and they put me on sweeping. Sweeping is a Dao too, Gou says.",
  "My roommate snores. Yours? …Ha. The whole row has heard Tie Niu.",
  "Lan Yi made me pour tea onto the floor for an hour today. I think I understand water now. Or floors.",
];

const HOPE_LINES = [
  "Ten thousand of us and a hundred places. I've been in this queue since the day before yesterday.",
  "My father says if I don't pass I'm to come home and marry the miller's son. I'm going to pass.",
  "They say the gate takes your cultivation away! I haven't got any, so that's fine.",
  "Did you see the stair? Nine hundred and ninety-nine steps! My knees are crying already.",
  "My cousin passed six years ago. He went home in his first spring. He never got home. People say things about this place.",
];

/** What the people of the Ten Halls say when the quest is not theirs. */
export function hallsNpcScript(key: string, g: GameState): Step[] | null {
  if (!key.startsWith("wd")) return null;
  if (key.startsWith("wd-hope-")) return [{ say: "narrator", text: pick(g, HOPE_LINES) }];
  if (key.startsWith("wd-outer-")) return [{ say: "narrator", text: pick(g, OUTER_LINES) }];
  if (key.startsWith("wd-spar-")) return [{ say: "discipleM", name: "Sparring Disciple", text: "The ring's open. Step in whenever you like; we're here to be hit." }];
  const who = hallPerson(key);
  if (!HALL_CAST[key.startsWith("wdf-") ? `wd-${key.slice(4)}` : key]) return null;
  const base = key.startsWith("wdf-") ? `wd-${key.slice(4)}` : key;
  const roommate = (ROOMMATES as readonly string[]).includes(base) ? GENERIC_ROOMMATE[base as RoommateKey] : null;
  const master = HALL_BOOKS.find((b) => b.teacher === base && b.dao !== "void");
  const lines = IDLE[base] ?? roommate ?? master?.lectures ?? null;
  if (!lines) return null;
  return [{ say: who.char, name: who.name, text: pick(g, lines) }];
}

/** The Ten Halls in the journal: each hall as it stands for her. */
export function hallsChronicle(g: GameState): { hall: string; hanzi: string; dao: GreatDaoId; colour: string; state: "waiting" | "studying" | "done" }[] {
  const n = hallsDone(g);
  return HALL_SITES.map((h, k) => ({
    hall: `${HALL_NUMERALS[k]} · ${h.name} · ${HALL_BOOKS[k].title}`,
    hanzi: h.hanzi,
    dao: h.dao,
    colour: GREAT_DAOS[h.dao].colour,
    state: n >= (k + 1) * HALLS_BOOK ? "done" : n >= k * HALLS_BOOK && n > 0 ? "studying" : "waiting",
  }));
}

/** The Ten Halls' line in the ending, if she sat the Selection. */
export function hallsEpilogue(g: GameState): string | null {
  const n = hallsDone(g);
  if (n < 2) return null;
  if (n >= HALLS_COUNT)
    return g.flags["halls:fate:9:slaughter"]
      ? "At the Ten Halls they still tell first-years about the outer disciple from Room Seven who fed the Examiner to his own door. They tell it to frighten them into keeping curfew. It works."
      : "Every six years, when the Ten Halls open their east gate, the hopefuls in the queue tell each other about the girl from Room Seven who brought the sleepers home. In the bunk by the window, under the founder's name, someone has carved a second: 林月, and beside it, in another hand, “She snored too.”";
  if (n < 8) return "She once queued with ten thousand others at the gate of the Ten Halls. Nobody in the queue ever knew who she was.";
  return `Room Seven kept her bunk by the window, marked 'away' in Steward Gou's register, for as long as there was a register — ${n} of the Ten Halls' thousand quests behind her.`;
}
