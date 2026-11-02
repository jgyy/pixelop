import { cultivationNeeded, levelIndex, realmAtLevel, realmLabel } from "../engine/realms";
import { gainCultivation, heal, stats, type GameState } from "../engine/state";
import { DAOS, dominantDao, walkDao } from "../engine/dao";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { apprentice, CRAFT_DEFS, craftRank, craftRankName, isApprentice, markPractised, practise, practisedToday, type CraftId } from "../engine/crafts";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import { AREA_IDS, type AreaId } from "../world/ids";
import { HALL_DAOS } from "../world/halls";
import { DAY_LENGTH, worldTime } from "../world/calendar";
import { COURT_BOSSES, COURT_COUNT, COURT_FOES, COURTS, courtDiscipleKey, courtEmperorKey, courtFolkKey, courtGuideKey, courtLeaderKey, courtMasterKey, craftMasterKey, parseTownKey, townName, townTrade, WANDERING_CRAFTS, type CourtBossId, type CourtFoeId } from "../world/courts";
import { BOOKS as ROAD_BOOKS, roadPerson } from "./road";
import { heartFate } from "./heart";
import { originOf } from "./origins";
import type { Choice, Step } from "./script";
import type { Beat, BeatLine } from "./hallsBooks";
import { COURT_BOOKS } from "./courtsBooks";
import { fillStanding } from "./standing";

/**
 * The Thrones and the Crafts (帝道百业): the ninth thread of the main tale,
 * twelve hundred quests long, and the one that takes her among mortals.
 *
 * Since the Jade Lotus Heart was stolen, the spirit veins under the mortal
 * lands have run thin. The six thrones of the mortal world, and the six
 * sects sworn to guard them under the Covenant of Cloud and Throne, have
 * begun to blame one another; and someone is helping them, forging edicts in
 * the emperors' hands and decrees in the sect leaders', buying up the harvest,
 * arming bowmen with qi-drinking jade, feeding an old emperor an elixir,
 * collaring soldiers and walling a city. He is Fei Lian, Grand Tutor to six
 * thrones, and what he spends is a single petal of the Jade Lotus Heart,
 * broken off in the dark the night the Heart was stolen and sold to him by the
 * Blood Moon's thief.
 *
 * Each of the six books is two hundred quests: its main quests (the
 * hand-written beats, the ceremonies of its court, the long wait for her
 * realm to catch up, and its trouble at the end) and its side quests (its
 * folk's favours, its guild's lessons in the art the capital is famous for,
 * goods carried between the capitals, tales carried to the jianghu's folk,
 * hunts, sittings at lotus shrines all over the jianghu and walks to places
 * from the Sword Tomb to Penglai). Every quest is composed from its number,
 * so the save holds only how many are done (`courts`) and how far the
 * current one has got (`courtsp`).
 *
 * Along the way the guilds' masters take her on as an apprentice of their
 * arts (see engine/crafts.ts), and every lesson is a step up her ranks.
 */

export const COURTS_BOOK = 200;
export const COURTS_COUNT = COURT_COUNT * COURTS_BOOK;
export const COURT_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

export type CourtKind = "beat" | "rite" | "gate" | "duel" | "favour" | "craft" | "trade" | "tale" | "hunt" | "sit" | "visit";
/** The main quests carry the tale; the side quests are the life of the courts and the guilds about it. */
export const COURT_MAIN_KINDS: CourtKind[] = ["beat", "rite", "gate", "duel"];

export interface CourtQuest {
  id: number;
  book: number;
  step: number;
  kind: CourtKind;
  arc: "main" | "side";
  title: string;
  objective: string;
  /** Who she must speak to (beat, rite, favour, craft, trade, tale): an NPC key as it stands in the world. */
  npc?: string;
  count: number;
  /** Where (visit): a landmark, and how she must be there. */
  landmark?: string;
  how?: "any" | "night" | "day" | "ride" | "fly";
  /** Where (sit). */
  region?: AreaId;
  /** What she must beat (hunt). */
  foe?: CourtFoeId;
  /** The art a lesson is in (craft). */
  craft?: CraftId;
  /** The realm the book asks of her for this quest (an overall level index). */
  level: number;
  done: string;
  reward: { stones: number; cult: number };
}

// ----------------------------------------------------------------------------- the arts' masters
/** Which beat of which book takes her on as an apprentice of which art. */
const BEAT_CRAFT: Record<number, Record<number, CraftId>> = { 0: { 40: "farming" }, 1: { 40: "refining" }, 2: { 20: "healing", 60: "alchemy" }, 3: { 40: "talisman" }, 4: { 60: "formation" }, 5: { 40: "taming" } };
/** The step of a book at which she is apprenticed to its court's own art. */
const MASTER_STEP = COURTS.map((C, b) => Number(Object.entries(BEAT_CRAFT[b]).find(([, c]) => c === C.craft)![0]));

/** Where an art's master is found (an NPC key). */
export function masterOf(craft: CraftId): string {
  const b = COURTS.findIndex((C) => C.craft === craft);
  return b >= 0 ? courtMasterKey(b) : craftMasterKey(craft);
}
/** The art an NPC is master of, if any. */
export function craftOfMaster(key: string): CraftId | null {
  const m = /^ct-(\d)-master$/.exec(key);
  if (m) return COURTS[Number(m[1])].craft;
  const w = /^craftmaster:([a-z]+)$/.exec(key);
  return w ? (w[1] as CraftId) : null;
}

// ----------------------------------------------------------------------------- who is who
/** The NPC key a book's line means, as it stands in the world. */
function resolveNpc(key: string, book: number): string {
  if (key === "ct-emperor") return courtEmperorKey(book);
  if (key === "ct-guide") return courtGuideKey(book);
  if (key === "ct-leader") return courtLeaderKey(book);
  if (key === "ct-master") return courtMasterKey(book);
  const f = /^ct-folk-(\d)$/.exec(key);
  if (f) return courtFolkKey(book, Number(f[1]));
  const d = /^ct-disciple-(\d)$/.exec(key);
  if (d) return courtDiscipleKey(book, Number(d[1]));
  return key;
}

const REGION_PLACE: Record<AreaId, string> = {
  sect: "the Azure Cloud Sect",
  village: "Willow Creek",
  bamboo: "the Whispering Bamboo",
  lake: "the Lotus Lake",
  valley: "the Crimson Demon Valley",
  peak: "Heavenly Tribulation Peak",
  marsh: "the Mistmarsh",
  terraces: "the Cloudmist lands",
  desert: "the Yellow Sands",
  harbor: "the eastern shore",
  frost: "Frostveil",
};

/** Who answers to a court's NPC key (or a mainland folk's): a name, a look, and where they are found. */
export function courtsPerson(key: string): { key: string; name: string; char: HumanId; where: string } {
  const m = /^ct-(\d)-(emperor|guide|folk|leader|disciple|master)(?:-(\d))?$/.exec(key);
  if (m) {
    const b = Number(m[1]);
    const C = COURTS[b];
    const n = Number(m[3]);
    const who = { emperor: C.emperor, guide: C.guide, folk: C.folk[n], leader: C.sect.leader, disciple: C.sect.disciples[n], master: C.master }[m[2] as "emperor"];
    const where = m[2] === "leader" || m[2] === "disciple" ? C.sect.name : C.capital;
    return { key, name: who.name, char: who.char, where };
  }
  const t = parseTownKey(key);
  if (t) return { key, name: townName(t.book, t.n), char: townTrade(t.book, t.n).looks[0] as HumanId, where: COURTS[t.book].capital };
  const w = /^craftmaster:([a-z]+)$/.exec(key);
  if (w) {
    const W = WANDERING_CRAFTS.find((x) => x.craft === w[1])!;
    return { key, name: W.master.name, char: W.master.char, where: COURTS[W.court].capital };
  }
  const r = roadPerson(key);
  return { key, name: r.name, char: r.char, where: REGION_PLACE[r.region] };
}

function speaker(key: string, book: number): { name: string; char: HumanId } | null {
  if (key === "ct-boss") {
    const e = ENEMIES[COURTS[book].boss];
    return { name: e.name.split(",")[0], char: e.sprite as HumanId };
  }
  const p = courtsPerson(resolveNpc(key, book));
  return { name: p.name, char: p.char };
}

/** Every place she may be sent to see: the six capitals and their sects' seats, and old places all over the jianghu. */
const SIGHTS: { key: string; name: string; region: AreaId }[] = [
  ...COURTS.map((C) => ({ key: C.sight.key, name: C.sight.name, region: "terraces" as AreaId })),
  ...COURTS.map((C) => ({ key: `ct-${C.sect.key}`, name: `the seat of ${C.sect.name}`, region: "terraces" as AreaId })),
  { key: "teahouse", name: "the Crossroads Teahouse", region: "bamboo" },
  { key: "mill", name: "the Watermill", region: "lake" },
  { key: "swordtomb", name: "the Sword Tomb", region: "bamboo" },
  { key: "orchard", name: "the Peach Orchard", region: "lake" },
  { key: "herbvalley", name: "Hundred Herb Valley", region: "marsh" },
  { key: "steppe", name: "the Herders' Camp", region: "harbor" },
  { key: "phoenix", name: "the Scarlet Phoenix Sect", region: "desert" },
  { key: "caravan", name: "the Camel Bell Caravanserai", region: "desert" },
  { key: "jinhe", name: "Jinhe, the Golden River City", region: "terraces" },
  { key: "hailing", name: "Hailing, the Tide City", region: "harbor" },
  { key: "tianjie", name: "Tianjie, the City of Nine Tiers", region: "terraces" },
  { key: "sea-penglai", name: "Penglai, the Isle of Immortals", region: "harbor" },
];
const sightOf = (key: string) => SIGHTS.find((s) => s.key === key);

// ----------------------------------------------------------------------------- the life of the courts
const FAVOUR_TITLES = ["A Favour at Court", "Asked in the Square", "Small Kindnesses", "For the Common Folk"];
const TRADE_TITLES = ["Between the Capitals", "Tribute Carried", "A Gift From Throne to Throne", "The Imperial Post"];
const TRADE_DONE = [
  "“From them? For us? Then the roads between the thrones are open again.”",
  "“Tell them we'll send something back. Tell them we're grateful. Tell them it's been a long time.”",
  "“A gift from another court. We used to send each other these every New Year. Before.”",
  "“Carried by a cultivator, under the Covenant. Well. That's how it should be.”",
];
const TALE_TITLES = ["News of the Thrones", "Tell the Jianghu", "What the Courts Are Saying", "A Tale for the Teahouse"];
const HUNT_TITLES = ["Trouble on the Roads", "Clear the Way", "The Capital's Edge", "Before the Next Audience"];
const SIT_TITLES = ["A Breath for the Covenant", "Stillness Between Thrones", "Quiet Before the Audience", "A Lamp for the Common Folk"];
const VISIT_TITLES = ["See It With Your Own Eyes", "What the Court Wants Seen", "A Place Worth Knowing", "Walk the Realm"];
const CRAFT_TITLES = ["A Lesson in the Art", "The Guild's Task", "Practice Makes the Master", "At the Master's Elbow"];

// ----------------------------------------------------------------------------- composing the quests
const LEVELS = COURT_BOOKS.map((b) => b.level);
function levelFor(book: number, step: number): number {
  if (step === COURTS_BOOK - 1) return LEVELS[book] + 2;
  return LEVELS[book] + (step >= COURTS_BOOK / 2 ? 1 : 0);
}

const SIDE: [CourtKind, number][] = [
  ["favour", 0.2],
  ["craft", 0.16],
  ["visit", 0.16],
  ["sit", 0.14],
  ["hunt", 0.12],
  ["tale", 0.12],
  ["trade", 0.1],
];

function pickSide(r: number): CourtKind {
  for (const [k, w] of SIDE) {
    if (r < w) return k;
    r -= w;
  }
  return "favour";
}

/** The art a lesson at this point of the tale is in: the book's own once she is its apprentice, else the last book's. */
function lessonCraft(book: number, step: number): { craft: CraftId; book: number } | null {
  if (step > MASTER_STEP[book]) return { craft: COURTS[book].craft, book };
  if (book === 0) return null;
  return { craft: COURTS[book - 1].craft, book: book - 1 };
}

function compose(id: number): CourtQuest {
  const book = Math.floor(id / COURTS_BOOK);
  const step = id % COURTS_BOOK;
  const B = COURT_BOOKS[book];
  const C = COURTS[book];
  const h = (k: number) => hash2(id, k, 9241);
  const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  const level = levelFor(book, step);
  const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((16 + book * 9 + step * 0.12) * stoneK), cult: cultK });
  const base = { id, book, step, level };

  const beat = B.beats.find((b) => b.step === step);
  if (beat)
    return {
      ...base,
      kind: "beat",
      arc: "main",
      title: step === 0 ? `${C.realm} · ${B.title}` : beat.title,
      objective: beat.objective,
      npc: resolveNpc(beat.npc, book),
      count: 1,
      done: beat.done,
      reward: reward(step === 0 ? 0.08 : 0.06, step === 0 ? 2 : 1.4),
    };
  if (step === COURTS_BOOK - 1)
    return {
      ...base,
      kind: "duel",
      arc: "main",
      title: ENEMIES[C.boss].name,
      objective: `${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}. Face them near ${C.capital}.`,
      count: 1,
      done: B.boss.victory,
      reward: reward(0.4, 6),
    };
  if (step === COURTS_BOOK / 2)
    return {
      ...base,
      kind: "gate",
      arc: "main",
      title: "Strong Enough for a Throne",
      objective: `The court of ${C.realm} will trust you with no more of its trouble until you stand at ${realmLabel(...realmAtLevel(level))}. Cultivate.`,
      count: 1,
      done: `At ${C.capital} the guards at the gate stand straighter when she passes, and the next door of the palace opens.`,
      reward: reward(0.05),
    };
  if (step % 10 === 5) {
    // a ceremony waits for the tale to reach it (the gates are opened only once someone has found how)
    const rite = at(B.rites.filter((r) => (r.after ?? 0) < step), 1);
    const who = h(2) < 0.6 ? courtEmperorKey(book) : courtGuideKey(book);
    return { ...base, kind: "rite", arc: "main", title: rite.title, objective: `${courtsPerson(who).name} asks you to ${rite.ask} (${C.capital}).`, npc: who, count: 1, done: rite.done, reward: reward(0.06, 1.3) };
  }
  let kind = pickSide(h(3));
  const lesson = kind === "craft" ? lessonCraft(book, step) : null;
  if (kind === "craft" && !lesson) kind = "favour";
  switch (kind) {
    case "craft": {
      const L = lesson!;
      const task = at(COURT_BOOKS[L.book].lessons, 30);
      const who = masterOf(L.craft);
      return { ...base, kind, arc: "side", title: at(CRAFT_TITLES, 31), objective: `${courtsPerson(who).name} at ${COURTS[L.book].capital} sets you a lesson in ${CRAFT_DEFS[L.craft].name}: ${task.ask}.`, npc: who, craft: L.craft, count: 1, done: task.done, reward: reward(0.04, 1.1) };
    }
    case "favour": {
      // a favour for one of the court's folk, or for one of its townsfolk in the square
      const town = h(4) < 0.4;
      const n = Math.floor(h(26) * (town ? 40 : C.folk.length));
      const who = town ? `ct-${book}-town-${n}` : courtFolkKey(book, n);
      const f = at(B.favours, 5);
      return { ...base, kind, arc: "side", title: at(FAVOUR_TITLES, 6), objective: `${courtsPerson(who).name} at ${C.capital} asks you to ${f.ask}.`, npc: who, count: 1, done: f.done, reward: reward(0.04) };
    }
    case "trade": {
      const goods = at(B.goods, 7);
      // goods go to a court she already knows (the first book's go round Liangdu's own folk and to the Golden Crane)
      const k = book === 0 ? 0 : Math.floor(h(10) * book);
      const to = book === 0 ? (h(11) < 0.5 ? courtLeaderKey(0) : courtFolkKey(0, Math.floor(h(12) * 4))) : h(11) < 0.5 ? courtEmperorKey(k) : courtLeaderKey(k);
      return { ...base, kind, arc: "side", title: at(TRADE_TITLES, 8), objective: book === 0 ? `Carry ${goods} across Liangdu to ${courtsPerson(to).name}, with the emperor's compliments.` : `Carry ${goods} from ${C.capital} to ${courtsPerson(to).name} at ${courtsPerson(to).where}.`, npc: to, count: 1, done: at(TRADE_DONE, 12), reward: reward(0.05, 1.4) };
    }
    case "tale": {
      // the jianghu's folk, from every land the Founder's Road runs through
      const R = ROAD_BOOKS[HALL_DAOS[Math.floor(h(24) * HALL_DAOS.length)]];
      const who = roadPerson(at(R.folk, 13));
      return { ...base, kind, arc: "side", title: at(TALE_TITLES, 14), objective: `Tell ${who.name} (${REGION_PLACE[who.region]}) what is happening at the court of ${C.realm}, and hear what the common folk make of it.`, npc: who.key, count: 1, done: at(B.tales, 15), reward: reward(0.04, 1.2) };
    }
    case "hunt": {
      const n = 1 + Math.floor(h(16) * 3);
      const foe = ENEMIES[C.foe].name;
      return { ...base, kind, arc: "side", title: at(HUNT_TITLES, 17), objective: `Beat the ${foe} ${n === 1 ? "once" : `${n} times`} round ${C.capital}.`, foe: C.foe, count: n, done: "The roads round the capital are quiet tonight. In the square someone has left a bowl of rice and a cup of tea on the throne's dais for her.", reward: reward(0.04 + n * 0.01, 1.2) };
    }
    case "sit": {
      const n = 6 + Math.floor(h(18) * 4) * 2;
      const land = AREA_IDS[(book * 5 + step * 3 + Math.floor(h(25) * 4)) % AREA_IDS.length];
      return { ...base, kind, arc: "side", title: at(SIT_TITLES, 19), objective: `Sit ${n} breaths at a lotus shrine in ${REGION_PLACE[land]}, and hold the folk of ${C.realm} in your stillness.`, region: land, count: n, done: "In her stillness she hears a whole city going about its day: hammers, carts, a child crying, a hawker calling. None of them know she is listening. That is the point.", reward: reward(0.05) };
    }
    case "visit":
    default: {
      const s = h(20) < 0.4 ? sightOf(C.sight.key)! : at(SIGHTS, 21);
      const how = at(["any", "any", "night", "day", "ride", "fly"] as const, 22);
      const howText = { any: "", night: " after dark", day: " by daylight", ride: " on Cloudmane", fly: " on your flying sword" }[how];
      return { ...base, kind: "visit", arc: "side", title: at(VISIT_TITLES, 23), objective: `${C.guide.name} asks you to go to ${s.name}${howText}, and tell the court what the realm looks like from outside a palace.`, landmark: s.key, how, count: 1, done: `At ${s.name} she stands a while and looks, and remembers it for the court.`, reward: reward(0.05, 1.1) };
    }
  }
}

let all: CourtQuest[] | null = null;
/** Every quest of the Thrones and the Crafts (composed once). */
export function courtsQuests(): CourtQuest[] {
  return (all ??= Array.from({ length: COURTS_COUNT }, (_, id) => compose(id)));
}
export const courtsQuestAt = (id: number) => courtsQuests()[id];
const beatOf = (q: CourtQuest): Beat | undefined => (q.kind === "beat" ? COURT_BOOKS[q.book].beats.find((b) => b.step === q.step) : undefined);

// ----------------------------------------------------------------------------- the save
export const courtsDone = (g: GameState) => Math.max(0, Math.min(COURTS_COUNT, g.counters.courts ?? 0));
const courtsProgress = (g: GameState) => g.counters.courtsp ?? 0;

/** The thrones send for her once Elder Mo has sent her out into the jianghu and she has some standing (late Qi Condensation). */
export const courtsOpen = (g: GameState) => !!g.flags.metElder && (levelIndex(g.realm, g.stage) >= 3 || courtsDone(g) > 0);

/** The quest she is on, or null before the thrones send for her and after the tale ends. */
export function currentCourts(g: GameState): CourtQuest | null {
  if (!courtsOpen(g)) return null;
  const n = courtsDone(g);
  return n < COURTS_COUNT ? courtsQuestAt(n) : null;
}

export const strongEnough = (g: GameState, q: CourtQuest) => levelIndex(g.realm, g.stage) >= q.level;

/** Bring the courts' flags in line with the tale: `courts:book:<k>` while a book is hers, `courts:boss:<k>` while its trouble is out, `courts:begun` and `courts:done`. */
export function syncCourtsFlags(g: GameState): GameState {
  const n = courtsDone(g);
  const going = courtsOpen(g) && n < COURTS_COUNT;
  const book = Math.min(COURT_COUNT - 1, Math.floor(n / COURTS_BOOK));
  const step = n % COURTS_BOOK;
  const flags: Record<string, boolean> = { ...g.flags, "courts:begun": n >= 1, "courts:done": n >= COURTS_COUNT };
  for (let k = 0; k < COURT_COUNT; k++) {
    flags[`courts:book:${k}`] = going && book === k;
    flags[`courts:boss:${k}`] = going && book === k && step === COURTS_BOOK - 1;
  }
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

/** Mark the current quest done: pay out, and move the tale on. */
export function completeCourts(g: GameState, id: number): GameState {
  if (courtsDone(g) !== id) return g;
  const q = courtsQuestAt(id);
  let s: GameState = { ...g, counters: { ...g.counters, courts: id + 1, courtsp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  return syncCourtsFlags(s);
}

const advanceCourts = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, courtsp: courtsProgress(g) + by } });

// ----------------------------------------------------------------------------- how the courts speak
/** How the mortal lands' soil stands, as the farmers would say it: thin while the Heart is gone, coming back once it is home or planted. */
export function soilWord(f: Record<string, boolean>): string {
  const fate = f["heart:devoured"] && f.purged ? "home" : heartFate(f);
  if (fate === "home" || fate === "planted") return "the earth went thin when your sect lost its Heart, and it has only begun to come back since it was found";
  if (fate === "devoured") return "the earth went thin when your sect lost its Heart, and it stays thin, though they say the Heart was found";
  return "the earth has been thin since your sect lost its Heart, and thinner every year";
}
/** A court's line with her standing and the state of the soil filled in. */
const fillCourt = (text: string, g: GameState) => {
  const soil = soilWord(g.flags);
  return fillStanding(text.replace(/(^|[.!?]\s+)\{soil\}/g, (_, lead: string) => lead + soil.charAt(0).toUpperCase() + soil.slice(1)).replace(/\{soil\}/g, soil), g);
};

const narr = (text: string): Step => ({ say: "narrator", text });

function lineStep(l: BeatLine, book: number, g: GameState): Step {
  if (!Array.isArray(l)) return { anim: l.a === "hero" ? "hero" : resolveNpc(l.a, book), name: l.n, wait: true };
  const [who, raw] = l;
  const text = fillCourt(raw, g);
  if (who === "narr") return narr(text);
  if (who === "hero") return { say: "heroine", text };
  const s = speaker(who, book);
  return s ? { say: s.char, name: s.name, text } : narr(text);
}

function finish(q: CourtQuest, g: GameState): Step[] {
  const next = completeCourts(g, q.id);
  const steps: Step[] = [{ mutate: (s) => completeCourts(s, q.id) }, { toast: `The Thrones and the Crafts ${q.id + 1}/${COURTS_COUNT} (${q.arc === "main" ? "main" : "side"}): ${q.title} · +${q.reward.stones} spirit stones` }];
  const after = currentCourts(next);
  if (after && after.step === 0 && q.step !== 0) steps.push({ toast: `${COURT_NUMERALS[after.book]}: ${COURT_BOOKS[after.book].title} · ${courtsPerson(after.npc!).name} waits at ${courtsPerson(after.npc!).where}` });
  return steps;
}

function notYet(q: CourtQuest, who: { char: HumanId; name: string }, g: GameState): Step[] {
  const need = realmLabel(...realmAtLevel(q.level));
  return [{ say: who.char, name: who.name, text: fillStanding(`Forgive me, {title}. What is coming to ${COURTS[q.book].capital} would swallow you whole. Come back at ${need}.`, g) }, { toast: `The court of ${COURTS[q.book].realm} asks for ${need}` }];
}

/** Why she takes the thrones' errand, as her beginning would say it. */
function summonsReply(g: GameState): string {
  return {
    disciple: "Elder Mo always said a sect that forgets the people under its clouds forgets why it floats. I'll find your thief, Majesty.",
    foundling: "I grew up in a village that paid its tithe in a bad year and went hungry for it. I'll find out who took the rest.",
    defector: "The Blood Moon took what it wanted from villages like this one. I swore I'd never stand by and watch that again. I'll find your thief.",
  }[originOf(g.flags)];
}

/** What becomes of a lesson: she is the art's apprentice (if she wasn't) and a step further in it. */
/** The rest of a lesson's work: each of the art's further moves in turn, the master's eye on her. */
const craftMoves = (craft: CraftId): Step[] => CRAFT_DEFS[craft].moves.map((name) => ({ anim: "hero", name, wait: true }));

const learnStep = (craft: CraftId, xp = 1): Step => ({ mutate: (s) => practise(apprentice(s, craft), craft, xp) });

function beatSteps(q: CourtQuest, b: Beat, g: GameState): Step[] {
  const steps: Step[] = [{ emote: q.npc!, icon: "!" }, ...b.lines.map((l) => lineStep(l, q.book, g))];
  if (q.book === 0 && q.step === 0) steps.push({ say: "heroine", text: summonsReply(g) });
  if (b.choice) {
    const options: Choice[] = b.choice.options.map((o) => ({
      label: o.label,
      hint: DAOS[o.heart].name,
      then: [{ mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.heart, 1) }, narr(fillStanding(o.then, g)), lineStep(o.reply, q.book, g), { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` }],
    }));
    steps.push({ choose: options, prompt: fillStanding(b.choice.prompt, g) });
  }
  steps.push(...(b.after ?? []).map((l) => lineStep(l, q.book, g)), narr(fillStanding(b.done, g)));
  const craft = BEAT_CRAFT[q.book]?.[q.step];
  if (craft) steps.push({ anim: "hero", name: CRAFT_DEFS[craft].anim, wait: true }, ...craftMoves(craft), learnStep(craft), { toast: `You are now an apprentice of ${CRAFT_DEFS[craft].name} (${CRAFT_DEFS[craft].hanzi}) · see the Journal (J)` });
  steps.push(...finish(q, g));
  const C = COURTS[q.book];
  if (q.step === 0) steps.push({ toast: `${C.realm} (${C.hanzi}) · ${C.capital}` });
  if (q.book === 0 && q.step === 0) steps.push({ toast: "A new main quest: the Thrones and the Crafts · see the Journal (J)" });
  if (q.step === COURTS_BOOK - 2) steps.push({ toast: `${ENEMIES[C.boss].name} · face them near ${C.capital}` });
  return steps;
}

const TALK_KINDS: CourtKind[] = ["beat", "rite", "favour", "craft", "trade", "tale"];
const RITE_ANIM = ["sow", "appraise", "pulse", "inscribe", "array", "audience"] as const;

/** What talking to this person does for the Thrones and the Crafts right now (null when they have nothing to do with the quest she is on). */
export function courtsTalk(key: string, g: GameState): Step[] | null {
  const q = currentCourts(g);
  if (!q || q.npc !== key || !TALK_KINDS.includes(q.kind)) return null;
  const who = courtsPerson(key);
  if (!strongEnough(g, q)) return notYet(q, who, g);
  const b = beatOf(q);
  if (b) return beatSteps(q, b, g);
  const say = (text: string): Step => ({ say: who.char, name: who.name, text: fillStanding(text, g) });
  const C = COURTS[q.book];
  switch (q.kind) {
    case "rite":
      return [{ emote: key, icon: "!" }, { anim: "hero", name: RITE_ANIM[q.book], wait: true }, narr(fillStanding(q.done, g)), ...finish(q, g)];
    case "craft": {
      const craft = q.craft!;
      return [{ anim: key, name: CRAFT_DEFS[craft].moves[0], wait: false }, { anim: "hero", name: CRAFT_DEFS[craft].anim, wait: true }, ...craftMoves(craft), narr(fillStanding(q.done, g)), learnStep(craft, 2), { toast: `${CRAFT_DEFS[craft].name}: a lesson learned` }, ...finish(q, g)];
    }
    case "favour":
      return [{ anim: "hero", name: "nod", wait: true }, say(q.done), ...finish(q, g)];
    case "trade":
      return [{ say: "heroine", text: `${who.name}. I've come from ${C.capital}. This is for you.` }, { anim: "hero", name: "offer", wait: true }, say(q.done), ...finish(q, g)];
    case "tale":
    default:
      return [{ say: "heroine", text: `${who.name}, have you heard what's happening at the court of ${C.realm}? Let me tell you.` }, say(q.done), { anim: "hero", name: "bow", wait: true }, ...finish(q, g)];
  }
}

/** Whether someone wants a word for the Thrones and the Crafts (the quest she is on is theirs). */
export function courtsHasNews(key: string, g: GameState): boolean {
  const q = currentCourts(g);
  return !!q && q.npc === key && TALK_KINDS.includes(q.kind);
}

/** The land a quest sends her to (the courts stand in the far south and east; a court NPC's land is found from the world). */
export function courtsRegion(q: CourtQuest): AreaId | null {
  if (q.region) return q.region;
  if (q.landmark && !q.landmark.startsWith("ct-")) return sightOf(q.landmark)?.region ?? null;
  if (q.npc && !q.npc.startsWith("ct-") && !q.npc.startsWith("craftmaster:")) return roadPerson(q.npc).region;
  return null;
}

/** The quest line for the HUD and the journal (null before the thrones send for her). */
export function courtsLog(g: GameState, locked: (id: AreaId) => string | null = () => null): { chapter: string; title: string; objective: string; arc: "main" | "side" } | null {
  if (!courtsOpen(g)) return null;
  const n = courtsDone(g);
  if (n >= COURTS_COUNT) return { chapter: "The Thrones and the Crafts", title: "The Covenant Renewed", objective: `All ${COURTS_COUNT} quests of the Thrones and the Crafts are done. Six thrones and six sects sit at twelve chairs, the granaries are full, the walls are open, and the Seal of Heaven's Mandate is in no emperor's hand.`, arc: "main" };
  const q = courtsQuestAt(n);
  const B = COURT_BOOKS[q.book];
  const chapter = `Thrones · ${COURT_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${COURTS_COUNT} · ${q.arc === "main" ? "Main" : "Side"} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "gate") return { chapter, title, objective: `The court of ${COURTS[q.book].realm} asks for ${realmLabel(...realmAtLevel(q.level))} before it will trust you with more. You stand at ${realmLabel(g.realm, g.stage)}. Cultivate.`, arc: q.arc };
  const where = courtsRegion(q);
  const lock = where && locked(where);
  if (lock && where) return { chapter, title, objective: `The way lies through ${REGION_PLACE[where]}, which is still closed to you: ${lock}`, arc: q.arc };
  const progress = q.kind === "hunt" || q.kind === "sit" ? ` (${Math.min(q.count, courtsProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: fillStanding(q.objective, g) + progress, arc: q.arc };
}

const isCourtFoe = (id: EnemyId): id is CourtFoeId => (COURT_FOES as readonly string[]).includes(id);
const isCourtBoss = (id: EnemyId): id is CourtBossId => (COURT_BOSSES as readonly string[]).includes(id);

/** A foe of the courts beaten: it counts if the quest wants it. */
export function courtsHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentCourts(g);
  if (!q || q.kind !== "hunt" || !isCourtFoe(enemy) || q.foe !== enemy || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advanceCourts(g);
  if (courtsProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${courtsProgress(s)}/${q.count}` };
}

/** Breaths at a shrine: they count if the quest wants her to sit in this land. */
export function courtsBreath(g: GameState, area: AreaId): { state: GameState; steps: Step[] | null } {
  const q = currentCourts(g);
  if (!q || q.kind !== "sit" || q.region !== area || !strongEnough(g, q)) return { state: g, steps: null };
  const s = advanceCourts(g);
  if (courtsProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)] };
  return { state: s, steps: null };
}

/** At a landmark: seeing it at the hour and in the way she was asked. */
export function courtsLandmark(landmark: string, g: GameState, how: { night: boolean; riding: boolean; flying: boolean }): Step[] | null {
  const q = currentCourts(g);
  if (!q || q.kind !== "visit" || q.landmark !== landmark || !strongEnough(g, q)) return null;
  const ok = q.how === "any" || (q.how === "night" && how.night) || (q.how === "day" && !how.night) || (q.how === "ride" && how.riding) || (q.how === "fly" && how.flying);
  if (!ok) return null;
  return [...(how.flying || how.riding ? [] : [{ anim: "hero", name: "shade", wait: true } as Step]), narr(q.done), ...finish(q, g)];
}

/** Her realm has caught up: the book's second half opens by itself. */
export function courtsCultivated(g: GameState): Step[] | null {
  const q = currentCourts(g);
  if (!q || q.kind !== "gate" || !strongEnough(g, q)) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- each book's trouble
export function courtsPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentCourts(g);
  if (!q || q.kind !== "duel" || !isCourtBoss(enemy) || COURTS[q.book].boss !== enemy) return null;
  const B = COURT_BOOKS[q.book];
  const steps: Step[] = [{ shake: 0.3 }, narr(`${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}.`), ...B.boss.words.map((l) => lineStep(l, q.book, g))];
  const d = dominantDao(g);
  if (d) steps.push({ say: "heroine", text: { sword: "Then let's end it here.", mercy: "Nobody else has to be hurt by this. Not even you.", balance: "Let's see what the scales make of us both.", slaughter: "You've used people up all your life. I'll return the favour." }[d] });
  return steps;
}

/** After a book's trouble is beaten: what she does about it, and the court as it is left. */
export function courtsVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentCourts(g);
  if (!q || q.kind !== "duel" || !isCourtBoss(enemy) || COURTS[q.book].boss !== enemy) return null;
  const B = COURT_BOOKS[q.book];
  const last = q.id === COURTS_COUNT - 1;
  const options: Choice[] = B.boss.fates.map((f) => {
    const dark = f.heart === "slaughter";
    return {
      label: f.label,
      hint: DAOS[f.heart].name,
      then: [
        { mutate: (s) => walkDao(dark ? shift(s, CULT.demon, 6) : s, f.heart, 3) },
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`courts:fate:${q.book}`]: true, [`courts:fate:${q.book}:${f.heart}`]: true } }) },
        narr(f.line),
        ...finish(q, g),
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: dark ? "roar" : "comprehend", wait: true },
        narr(B.boss.victory),
        ...(last ? courtsEnd(f.heart, g) : [{ toast: `${COURT_NUMERALS[q.book]} is done: ${B.title}` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "victory", wait: true }, { choose: options, prompt: `${ENEMIES[enemy].name} is beaten. What now?` }];
}

/**
 * The petal comes home (or does not): what she does with the Seal of
 * Heaven's Mandate depends on what became of the Heart it was broken from.
 */
export function petalFate(f: Record<string, boolean>): string {
  // a Heart drunk and then drawn back out of her by Elder Mo is back on its shrine, whatever the flags of the drinking say
  const fate = f["heart:devoured"] && f.purged ? "home" : heartFate(f);
  if (fate === "planted") return "She carries the petal to where the Heart was planted and lays it among the roots. By morning there is a ninth leaf on the young lotus, green as jade, and the soil of six realms, very slowly, begins to thicken again.";
  if (fate === "devoured") return "The petal knows her. It knows the Heart she drank, and it goes into her palm like water into sand. For a moment she feels the six realms under her feet, every field and forge and city, all at once. Then it is only her own qi again, a little deeper than it was.";
  if (fate === "home") return "She carries the petal back to the Azure Cloud and sets it beside the Heart in the Hall of Clouds. It fits: a ninth petal, closing a gap nobody had ever noticed was there. Far below, in six realms, the harvests begin to come back.";
  return "The Heart itself is still in the Blood Moon's hands. She wraps the petal in silk and carries it next to her own heart. When she finds the rest of it, she will bring them home together.";
}

/** The Covenant is renewed (or broken in her hand): the tale ends. */
function courtsEnd(heart: string, g: GameState): Step[] {
  return [
    { shake: 0.6 },
    { flash: "#ffe8a0" },
    {
      narrate: [
        heart === "slaughter"
          ? "The six thrones renew the Covenant of Cloud and Throne in Longcheng's square, at twelve chairs, with their eyes on her the whole time. They swear it very carefully. They have seen what heaven's mandate looks like in a cultivator's hand."
          : "The six thrones and the six sects renew the Covenant of Cloud and Throne in Longcheng's square, at twelve chairs, and this time they write it out in their own hands, each one, with nobody to teach them how.",
        petalFate(g.flags),
        "In Liangdu the granaries are full. In Jinling the forges ring for ploughshares. In Jincheng an old emperor watches his grandson crowned. In Pingcheng the edicts are honest. In Linzi a boy flies a kite over open gates. And in Longcheng a princess opens a school for every child no sect would take.",
      ],
    },
    { anim: "hero", name: "bow", wait: true },
    { toast: "The Thrones and the Crafts is done · the Covenant of Cloud and Throne is renewed" },
  ];
}

// ----------------------------------------------------------------------------- the arts' masters, every day
/** A day of the calendar, counted from the very first. */
const dayOf = (g: GameState) => Math.floor(worldTime(g) / DAY_LENGTH);

/** What practising an art leaves in her hands. */
function yieldOf(craft: CraftId, g: GameState): { state: GameState; text: string } {
  const y = CRAFT_DEFS[craft].yields;
  const rank = Math.max(1, craftRank(g, craft));
  switch (y.kind) {
    case "stones":
      return { state: { ...g, stones: g.stones + y.n * rank }, text: `+${y.n * rank} spirit stones from the day's work` };
    case "pill": {
      const have = g.pills[y.pill];
      const n = Math.min(99 - have, y.n + Math.floor(rank / 3));
      return { state: { ...g, pills: { ...g.pills, [y.pill]: have + n } }, text: `+${n} ${y.pill === "heal" ? "Healing" : "Qi Gathering"} Pill${n === 1 ? "" : "s"} of your own making` };
    }
    case "insight":
      return { state: gainCultivation(g, Math.round(cultivationNeeded(g.realm, g.stage) * y.k)).state, text: "the array settles, and so does your qi (cultivation gained)" };
    case "rest":
    default: {
      const s = stats(g);
      return { state: heal(g, s.maxHp, s.maxQi), text: "you leave the lesson rested, fed and whole" };
    }
  }
}

/** Talking to an art's master when the tale has nothing for them: an offer of apprenticeship, or a day's practice. */
export function masterScript(key: string, g: GameState): Step[] | null {
  const craft = craftOfMaster(key);
  if (!craft) return null;
  const who = courtsPerson(key);
  const D = CRAFT_DEFS[craft];
  const say = (text: string): Step => ({ say: who.char, name: who.name, text: fillStanding(text, g) });
  if (!isApprentice(g, craft))
    return [
      say(`${D.name}, {title}. ${D.blurb} Would you learn it? I warn you: it is learned slowly, a day at a time.`),
      {
        choose: [
          { label: `Become an apprentice of ${D.name}`, hint: D.hanzi, then: [{ anim: "hero", name: "bow", wait: true }, learnStep(craft, 0), say("Good. Come back tomorrow, and every day after. We start with the basics. We always start with the basics."), { toast: `You are now an apprentice of ${D.name} (${D.hanzi}) · see the Journal (J)` }] },
          { label: "Not now", then: [say("The art will wait. It has waited a long time.")] },
        ],
        prompt: `Learn ${D.name}?`,
      },
    ];
  const day = dayOf(g);
  if (practisedToday(g, craft, day)) return [say(`Enough for today, {title}. An art practised too long in one day is an art practised badly. Come back tomorrow.`), { toast: `${D.name}: ${craftRankName(craftRank(g, craft))} · you have practised today` }];
  const before = craftRank(g, craft);
  const after = craftRank(practise(g, craft), craft);
  const got = yieldOf(craft, g);
  return [
    say(`Today we ${D.verb}. Watch, then do.`),
    { anim: key, name: D.moves[0], wait: false },
    { anim: "hero", name: D.anim, wait: true },
    ...craftMoves(craft),
    { mutate: (s) => markPractised(practise(yieldOf(craft, s).state, craft), craft, day) },
    { toast: `${D.name}: practised · ${got.text}` },
    ...(after > before ? [say(`You are ${craftRankName(after).toLowerCase()} now. I don't say that lightly.`), { toast: `${D.name}: you are now ${craftRankName(after)} (${D.title})` } as Step] : []),
  ];
}

// ----------------------------------------------------------------------------- everyday words
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + courtsDone(g)) % lines.length];
}

/** What a townsperson of the capitals says, by their trade. */
const TRADE_WORDS: Record<string, string[]> = {
  farmer: ["The soil's thin, these years. Thin, not dead. We plant anyway.", "Spirit rice wants water to the ankle and sun to the shoulder. Like people, really.", "My grandfather paid the tithe. My father paid the tithe. I'll pay it, if somebody tells me where it goes."],
  smith: ["Iron listens. Hit it right and it remembers.", "I make ploughshares mostly. Swords are for people who don't eat.", "A sect elder came in for a hairpin once. A hairpin! Paid in spirit stones. Best day of my life."],
  weaver: ["Silk from the south, wool from the north, and my fingers in the middle.", "A good bolt of brocade takes a season. A bad one takes a season too, that's the sad thing.", "The palace orders yellow. Always yellow. I dream in yellow."],
  cook: ["Eat. You're a cultivator, you can eat twice.", "Noodles in the morning, rice at noon, dumplings at night. The world's in order when I say so.", "The palace cook stole my recipe for pork buns. I'm flattered. I'm also going to poison him."],
  porter: ["Up the hill, down the hill. My shoulders know every stone.", "Carried a minister's sedan once. He was heavier than his ideas.", "Pay's fair. Feet aren't."],
  merchant: ["Buy low, sell high, and never trust a grey cart.", "Prices are up since the grain went missing. Mine too. I'm not a saint.", "Silk from Shu, iron from Chen, dates from Yan. I sell the whole world, a little at a time."],
  scribe: ["I write letters for people who can't. Love letters, mostly. Debt letters, the rest.", "Every hand has its own breath. I could tell you whose letter it is with my eyes shut.", "The Grand Tutor taught the emperors. Who taught the scribes? Hunger."],
  herbseller: ["Ginseng for strength, goji for the eyes, and a good night's sleep for everything else.", "The Crimson Cauldron buys from me. They pay well and complain more.", "Don't eat the purple ones. Don't ask me how I know."],
  woodcutter: ["Every tree I cut, I plant two. My father's rule.", "Pine for the palace, maple for the market, bamboo for everything else.", "The forest goes quiet before a storm, and before a war. The birds notice first."],
  fisher: ["The fish don't care who's on the throne. I envy them.", "Out before dawn, back after dusk. Sea's the only honest thing in the capital.", "Caught a carp this long once. Gave it to the empress. She threw it back. I respect that."],
  guard: ["Halt. …Oh. You. Go on, then.", "I guard the gate. The gate guards me. We have an understanding.", "Captain says to be polite to cultivators. I'm polite. I'm very polite. See?"],
  maid: ["Mind the floor, {title}. I've just swept it.", "Three hundred rooms in the palace and every one of them has a cobweb in it somewhere.", "The emperor says thank you to the maids. Nobody believes us when we say so."],
  courtier: ["Audience at the hour of the snake. Don't be late. Never be late.", "One bows to the throne. One kneels to the emperor. One prostrates oneself to the ancestors. One gets very tired.", "The court is all whispers this season. Everyone is whispering about you, {title}."],
  child: ["Are you a real cultivator? Can you fly? Fly! Fly now!", "I'm going to be an emperor when I grow up. Or a noodle-cook. One of those.", "My kite's stuck in the palace tree. Can you get it? Please? You can fly!"],
};

/** What the people of the courts and their sects say when the quest is not theirs. */
export function courtsNpcScript(key: string, g: GameState): Step[] | null {
  const master = masterScript(key, g);
  if (master) return master;
  const t = parseTownKey(key);
  if (t) {
    const trade = townTrade(t.book, t.n);
    return [{ say: trade.looks[0] as HumanId, name: townName(t.book, t.n), text: fillStanding(pick(g, TRADE_WORDS[trade.id]), g) }];
  }
  const m = /^ct-(\d)-(emperor|guide|folk|leader|disciple)/.exec(key);
  if (!m) return null;
  const k = Number(m[1]);
  const who = courtsPerson(key);
  const B = COURT_BOOKS[k];
  const C = COURTS[k];
  const all = m[2] === "emperor" ? B.emperor : m[2] === "guide" ? B.guide : m[2] === "leader" || m[2] === "disciple" ? B.leader : B.favours.map((f) => f.done);
  // what the emperor, the guide and the sect leader say between the beats follows the tale: until the book is well along (its fifth beat), only what they would say to anyone
  const early = m[2] !== "folk" && courtsDone(g) < k * COURTS_BOOK + 80;
  const lines = early ? all.slice(0, 1) : all;
  // a throne that has received her as the founder of a sect does not greet her as a stranger (see story/founding.ts)
  if (courtsDone(g) < k * COURTS_BOOK && m[2] === "emperor" && g.flags[`fd:audience:${k}`])
    return [{ say: who.char, name: who.name, text: fillStanding(`The founder of the sect in the sands. Our edict recognising it stands, {title}, under the Covenant. The throne of ${C.realm} has not yet had need of you for anything else. When it does, We will send.`, g) }];
  // before her book reaches them, the court is formal with a stranger (and the sect polite to a cultivator of another)
  if (courtsDone(g) < k * COURTS_BOOK)
    return [{ say: who.char, name: who.name, text: fillStanding(m[2] === "leader" || m[2] === "disciple" ? `The Azure Cloud's {peer}. ${C.sect.name.charAt(0).toUpperCase() + C.sect.name.slice(1)} guards ${C.realm}, under the Covenant. You are welcome to our seat, if you keep its peace.` : `A cultivator, at the court of ${C.realm}? The throne has not sent for you, {title}. Not yet.`, g) }];
  return [{ say: who.char, name: who.name, text: fillStanding(pick(g, lines), g) }];
}

/** The six books in the journal: each as it stands for her. */
export function courtsChronicle(g: GameState): { book: string; hanzi: string; where: string; state: "unknown" | "visiting" | "settled"; fate: string | null }[] {
  const n = courtsDone(g);
  return COURT_BOOKS.map((b, k) => {
    const fate = (["mercy", "sword", "balance", "slaughter"] as const).find((d) => g.flags[`courts:fate:${k}:${d}`]);
    return {
      book: `${COURT_NUMERALS[k]} · ${b.title}`,
      hanzi: b.hanzi,
      where: `${COURTS[k].capital} (${COURTS[k].realm} ${COURTS[k].hanzi})`,
      state: n >= (k + 1) * COURTS_BOOK ? "settled" : n >= k * COURTS_BOOK && n > 0 ? "visiting" : "unknown",
      fate: fate ? DAOS[fate].name : null,
    };
  });
}

/** The courts' line in the ending, if she went among the thrones. */
export function courtsEpilogue(g: GameState): string | null {
  const n = courtsDone(g);
  if (n < 2) return null;
  if (n >= COURTS_COUNT)
    return g.flags["courts:fate:5:slaughter"]
      ? "Down in the mortal world, six thrones keep the Covenant of Cloud and Throne to the letter, and every one of them keeps a chair empty at their councils, in case she should ever come back down. None of them wants her to."
      : "Down in the mortal world, six thrones and six sects meet once a year at twelve chairs, and the granaries are full, and in a school in Longcheng a hundred children with no roots at all are learning to write their own names.";
  return `The jade tally of Liang still hangs at her belt — ${n} of the Thrones and the Crafts' ${COURTS_COUNT} quests behind her, and somewhere among the six courts, a Grand Tutor still writing letters.`;
}
