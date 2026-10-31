import { cultivationNeeded, levelIndex, realmAtLevel, realmLabel } from "../engine/realms";
import { gainCultivation, heal, type GameState } from "../engine/state";
import { DAOS, dominantDao, walkDao } from "../engine/dao";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import type { AreaId } from "../world/ids";
import { HALL_DAOS } from "../world/halls";
import { elderKey, ENVOY_KEY, folkKey, guideKey, homeKey, PEOPLE_BOSSES, PEOPLE_COUNT, PEOPLE_FOES, PEOPLES, type PeopleBossId, type PeopleFoeId } from "../world/peoples";
import { BOOKS as ROAD_BOOKS, roadPerson } from "./road";
import { originOf } from "./origins";
import type { Choice, Step } from "./script";
import type { Beat, BeatLine } from "./hallsBooks";
import { PEOPLE_BOOKS } from "./peoplesBooks";
import { fillStanding } from "./standing";

/**
 * The Hundred Peoples (百族志): the seventh thread of the main tale, twelve
 * hundred quests long.
 *
 * The jianghu is not only human. The fox-folk of Moonfox Hollow, the
 * merfolk of Pearlsong Reef, the stone-born of Hollowstone Hold, the
 * feathered folk of Skyfeather Eyrie, the snow-folk of Rimehorn Lodge and
 * the dragon-kin of Emberscale Hold each keep a home, a custom and a grief
 * of their own. Three hundred years ago the Concord of a Hundred Peoples,
 * the oath that kept them and the human jianghu from one another's throats,
 * cracked on the night of the Purge of Strange Blood. Envoy Shan, its last
 * keeper, gives Lin Yue its tally, and she carries it from home to home.
 *
 * Each people's book is two hundred quests: its main quests (the hand-written
 * beats of its tale, the rites of its home, the long wait for her realm to
 * catch up, and its trouble at the end) and its side quests (its folk's
 * favours, goods carried between the peoples, tales carried to the human
 * jianghu, hunts in the wilds round the home, sittings at its shrines and
 * walks to its places). Every quest is composed from its number, so the
 * save holds only how many are done (`peoples`) and how far the current one
 * has got (`peoplesp`).
 */

export const PEOPLES_BOOK = 200;
export const PEOPLES_COUNT = PEOPLE_COUNT * PEOPLES_BOOK;
export const PEOPLE_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

export type PeopleKind = "beat" | "rite" | "gate" | "duel" | "favour" | "trade" | "tale" | "hunt" | "sit" | "visit";
/** The main quests carry the tale; the side quests are the life of the homes about it. */
export const MAIN_KINDS: PeopleKind[] = ["beat", "rite", "gate", "duel"];

export interface PeopleQuest {
  id: number;
  book: number;
  step: number;
  kind: PeopleKind;
  /** Main quests carry the tale; side quests are the life of the home. */
  arc: "main" | "side";
  title: string;
  objective: string;
  /** Who she must speak to (beat, rite, favour, trade, tale): an NPC key as it stands in the world. */
  npc?: string;
  count: number;
  /** Where (visit): a landmark, and how she must be there. */
  landmark?: string;
  how?: "any" | "night" | "day" | "ride" | "fly";
  /** Where (sit). */
  region?: AreaId;
  /** What she must beat (hunt). */
  foe?: PeopleFoeId;
  /** The realm the people asks of her for this quest (an overall level index). */
  level: number;
  /** Said or narrated when it is done. */
  done: string;
  reward: { stones: number; cult: number };
}

// ----------------------------------------------------------------------------- who is who
/** The NPC key a book's line means, as it stands in the world. */
function resolveNpc(key: string, book: number): string {
  const p = PEOPLES[book].id;
  if (key === "pe-elder") return elderKey(p);
  if (key === "pe-guide") return guideKey(p);
  const f = /^pe-folk-(\d)$/.exec(key);
  if (f) return folkKey(p, Number(f[1]));
  return key;
}

/** Who answers to a Hundred Peoples NPC key (or an errand's folk abroad): a name, a look, and where they are found. */
export function peoplesPerson(key: string): { key: string; name: string; char: HumanId; where: string } {
  if (key === ENVOY_KEY) return { key, name: "Envoy Shan", char: "concordenvoy", where: "the Concord Stone by the crossroads teahouse" };
  const m = /^pe-(\w+)-(elder|guide|folk)(?:-(\d))?$/.exec(key);
  const p = m && PEOPLES.find((x) => x.id === m[1]);
  if (m && p) {
    const who = m[2] === "elder" ? p.elder : m[2] === "guide" ? p.guide : p.folk[Number(m[3])];
    return { key, name: who.name, char: who.char, where: p.home };
  }
  const r = roadPerson(key);
  return { key, name: r.name, char: r.char, where: REGION_PLACE[r.region] };
}

/** Who speaks a line of a book: a name and a look. */
function speaker(key: string, book: number): { name: string; char: HumanId } | null {
  if (key === "pe-boss") {
    const e = ENEMIES[PEOPLES[book].boss];
    return { name: e.name.split(",")[0], char: e.sprite as HumanId };
  }
  const p = peoplesPerson(resolveNpc(key, book));
  return { name: p.name, char: p.char };
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

/** Every place of the peoples she may be sent to see, with its name and the land it lies in. */
const SIGHTS: { key: string; name: string; region: AreaId; book: number }[] = PEOPLES.flatMap((p, k) => [
  { key: homeKey(p.id), name: p.home, region: p.region, book: k },
  { key: p.sight.key, name: p.sight.name, region: p.region, book: k },
]);
const sightOf = (key: string) => SIGHTS.find((s) => s.key === key);

// ----------------------------------------------------------------------------- the life of the homes
const FAVOUR_TITLES = ["A Neighbour's Favour", "Small Kindnesses", "Asked at the Door", "Help Wanted"];
const TRADE_TITLES = ["Goods Between Peoples", "Carried in Trust", "A Gift Across the Wilds", "The Concord's Trade"];
const TRADE_DONE = [
  "“From them? For us? …We'll have to send something back. We haven't sent anything to anyone in three hundred years. What do people send?”",
  "“Tell them thank you. No: tell them we'll come and say it ourselves. Someday. Soon. Tell them soon.”",
  "“I'd heard they were all dead. I'd heard they said the same of us. Well.”",
  "“A gift. With the Concord's knot on it. My grandmother used to tie that knot. I never knew what it meant.”",
];
const TALE_TITLES = ["News for the Jianghu", "Tell Them of the Peoples", "A Tale Carried", "What the Humans Say"];
const HUNT_TITLES = ["Trouble in the Wilds", "Drive Them Off", "The Home's Edge", "Before They Come Closer"];
const SIT_TITLES = ["A Breath of Their Air", "Sit Where They Sit", "Stillness Among Strangers", "The Shrine of the Home"];
const VISIT_TITLES = ["See It for Yourself", "Walk Their Places", "Where They Keep Their Past", "A Place of Theirs"];
const ENVOY_TRADE = [
  "“For me? From them? …I'll keep it on the stone. So they can see it when they come.”",
  "“A gift for the Concord. The first in three hundred years. Hand it here; my hands are shaking.”",
];

// ----------------------------------------------------------------------------- composing the quests
const LEVELS = PEOPLE_BOOKS.map((b) => b.level);
function levelFor(book: number, step: number): number {
  if (step === PEOPLES_BOOK - 1) return LEVELS[book] + 2;
  return LEVELS[book] + (step >= PEOPLES_BOOK / 2 ? 1 : 0);
}

const SIDE: [PeopleKind, number][] = [
  ["favour", 0.24],
  ["visit", 0.18],
  ["hunt", 0.16],
  ["sit", 0.16],
  ["trade", 0.14],
  ["tale", 0.12],
];

function pickSide(r: number): PeopleKind {
  for (const [k, w] of SIDE) {
    if (r < w) return k;
    r -= w;
  }
  return "favour";
}

function compose(id: number): PeopleQuest {
  const book = Math.floor(id / PEOPLES_BOOK);
  const step = id % PEOPLES_BOOK;
  const B = PEOPLE_BOOKS[book];
  const P = PEOPLES[book];
  const R = ROAD_BOOKS[HALL_DAOS[book]];
  const h = (k: number) => hash2(id, k, 7717);
  const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  const level = levelFor(book, step);
  const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((14 + book * 9 + step * 0.12) * stoneK), cult: cultK });
  const base = { id, book, step, level };

  const beat = B.beats.find((b) => b.step === step);
  if (beat)
    return {
      ...base,
      kind: "beat",
      arc: "main",
      title: step === 0 ? `${P.name.replace(/^the /, "The ")} · ${B.title}` : beat.title,
      objective: beat.objective,
      npc: resolveNpc(beat.npc, book),
      count: 1,
      done: beat.done,
      reward: reward(step === 0 ? 0.08 : 0.06, step === 0 ? 2 : 1.4),
    };
  if (step === PEOPLES_BOOK - 1)
    return {
      ...base,
      kind: "duel",
      arc: "main",
      title: ENEMIES[P.boss].name,
      objective: `${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}. Face them at ${P.home}.`,
      count: 1,
      done: B.boss.victory,
      reward: reward(0.4, 6),
    };
  if (step === PEOPLES_BOOK / 2)
    return {
      ...base,
      kind: "gate",
      arc: "main",
      title: "Grown Into the Home",
      objective: `${P.name.charAt(0).toUpperCase() + P.name.slice(1)} will trust you with no more of their tale until you stand at ${realmLabel(...realmAtLevel(level))}. Cultivate.`,
      count: 1,
      done: `At ${P.home} they notice the change in her qi before she does, and the doors that were only half open stand wide.`,
      reward: reward(0.05),
    };
  if (step % 10 === 5) {
    const rite = at(B.rites, 1);
    const who = h(2) < 0.6 ? elderKey(P.id) : guideKey(P.id);
    return { ...base, kind: "rite", arc: "main", title: rite.title, objective: `${peoplesPerson(who).name} asks you to ${rite.ask} (${P.home}).`, npc: who, count: 1, done: rite.done, reward: reward(0.06, 1.3) };
  }
  const kind = pickSide(h(3));
  switch (kind) {
    case "favour": {
      const n = Math.floor(h(4) * P.folk.length);
      const f = at(B.favours, 5);
      return { ...base, kind, arc: "side", title: at(FAVOUR_TITLES, 6), objective: `${P.folk[n].name} at ${P.home} asks you to ${f.ask}.`, npc: folkKey(P.id, n), count: 1, done: f.done, reward: reward(0.04) };
    }
    case "trade": {
      const goods = at(B.goods, 7);
      if (book === 0)
        return { ...base, kind, arc: "side", title: at(TRADE_TITLES, 8), objective: `Carry ${goods} from ${P.home} to Envoy Shan at the Concord Stone, for the Concord.`, npc: ENVOY_KEY, count: 1, done: at(ENVOY_TRADE, 9), reward: reward(0.05, 1.3) };
      const k = Math.floor(h(10) * book);
      const to = h(11) < 0.5 ? elderKey(PEOPLES[k].id) : guideKey(PEOPLES[k].id);
      return { ...base, kind, arc: "side", title: at(TRADE_TITLES, 8), objective: `Carry ${goods} from ${P.home} to ${peoplesPerson(to).name} at ${PEOPLES[k].home}: the first goods between ${P.name} and ${PEOPLES[k].name} since the Purge.`, npc: to, count: 1, done: at(TRADE_DONE, 12), reward: reward(0.05, 1.4) };
    }
    case "tale": {
      const who = roadPerson(at(R.folk, 13));
      return { ...base, kind, arc: "side", title: at(TALE_TITLES, 14), objective: `Tell ${who.name} (${REGION_PLACE[who.region]}) of ${P.name} of ${P.home}, and hear what the human jianghu makes of them.`, npc: who.key, count: 1, done: at(B.tales, 15), reward: reward(0.04, 1.2) };
    }
    case "hunt": {
      const n = 1 + Math.floor(h(16) * 3);
      const foe = ENEMIES[P.foe].name;
      return { ...base, kind, arc: "side", title: at(HUNT_TITLES, 17), objective: `Beat the ${foe} ${n === 1 ? "once" : `${n} times`} in the wilds round ${P.home}.`, foe: P.foe, count: n, done: "The wilds round the home are quiet tonight. Someone has left a bowl of something warm on the path for her.", reward: reward(0.04 + n * 0.01, 1.2) };
    }
    case "sit": {
      const n = 6 + Math.floor(h(18) * 4) * 2;
      return { ...base, kind, arc: "side", title: at(SIT_TITLES, 19), objective: `Sit ${n} breaths at a lotus shrine in ${REGION_PLACE[P.region]} (the shrine at ${P.home} will do), and let the air of ${P.home} settle in your qi.`, region: P.region, count: n, done: `Somewhere in her stillness she hears ${P.name} going about their evening: ${P.custom}.`, reward: reward(0.05) };
    }
    case "visit":
    default: {
      const pool = SIGHTS.filter((s) => s.book <= book);
      const s = h(20) < 0.6 ? sightOf(P.sight.key)! : at(pool, 21);
      const how = at(["any", "any", "night", "day", "ride", "fly"] as const, 22);
      const howText = { any: "", night: " after dark", day: " by daylight", ride: " on Cloudmane", fly: " on your flying sword" }[how];
      return { ...base, kind: "visit", arc: "side", title: at(VISIT_TITLES, 23), objective: `${P.guide.name} asks you to go to ${s.name}${howText}, and see it the way ${PEOPLES[s.book].name} do.`, landmark: s.key, how, count: 1, done: `At ${s.name} she stands a long while, and for a moment sees it with other eyes than her own.`, reward: reward(0.05, 1.1) };
    }
  }
}

let all: PeopleQuest[] | null = null;
/** Every quest of the Hundred Peoples (composed once). */
export function peoplesQuests(): PeopleQuest[] {
  return (all ??= Array.from({ length: PEOPLES_COUNT }, (_, id) => compose(id)));
}
export const peoplesQuestAt = (id: number) => peoplesQuests()[id];
const beatOf = (q: PeopleQuest): Beat | undefined => (q.kind === "beat" ? PEOPLE_BOOKS[q.book].beats.find((b) => b.step === q.step) : undefined);

// ----------------------------------------------------------------------------- the save
export const peoplesDone = (g: GameState) => Math.max(0, Math.min(PEOPLES_COUNT, g.counters.peoples ?? 0));
const peoplesProgress = (g: GameState) => g.counters.peoplesp ?? 0;

/** The envoy finds her once Elder Mo has sent her out into the jianghu and she can hold her own (late Qi Condensation). */
export const peoplesOpen = (g: GameState) => !!g.flags.metElder && (levelIndex(g.realm, g.stage) >= 2 || peoplesDone(g) > 0);

/** The quest she is on, or null before the envoy finds her and after the tale ends. */
export function currentPeoples(g: GameState): PeopleQuest | null {
  if (!peoplesOpen(g)) return null;
  const n = peoplesDone(g);
  return n < PEOPLES_COUNT ? peoplesQuestAt(n) : null;
}

export const strongEnough = (g: GameState, q: PeopleQuest) => levelIndex(g.realm, g.stage) >= q.level;

/** Bring the peoples' flags in line with the tale: `peoples:book:<k>` while a book is hers, `peoples:boss:<k>` while its trouble is out, `peoples:begun` and `peoples:done`. */
export function syncPeoplesFlags(g: GameState): GameState {
  const n = peoplesDone(g);
  const going = peoplesOpen(g) && n < PEOPLES_COUNT;
  const book = Math.min(PEOPLE_COUNT - 1, Math.floor(n / PEOPLES_BOOK));
  const step = n % PEOPLES_BOOK;
  const flags: Record<string, boolean> = { ...g.flags, "peoples:begun": n >= 1, "peoples:done": n >= PEOPLES_COUNT };
  for (let k = 0; k < PEOPLE_COUNT; k++) {
    flags[`peoples:book:${k}`] = going && book === k;
    flags[`peoples:boss:${k}`] = going && book === k && step === PEOPLES_BOOK - 1;
  }
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

/** Mark the current quest done: pay out, and move the tale on. */
export function completePeoples(g: GameState, id: number): GameState {
  if (peoplesDone(g) !== id) return g;
  const q = peoplesQuestAt(id);
  let s: GameState = { ...g, counters: { ...g.counters, peoples: id + 1, peoplesp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  return syncPeoplesFlags(s);
}

const advancePeoples = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, peoplesp: peoplesProgress(g) + by } });

// ----------------------------------------------------------------------------- how the peoples speak
const narr = (text: string): Step => ({ say: "narrator", text });

function lineStep(l: BeatLine, book: number, g: GameState): Step {
  if (!Array.isArray(l)) return { anim: l.a === "hero" ? "hero" : resolveNpc(l.a, book), name: l.n, wait: true };
  const [who, raw] = l;
  const text = fillStanding(raw, g);
  if (who === "narr") return narr(text);
  if (who === "hero") return { say: "heroine", text };
  const s = speaker(who, book);
  return s ? { say: s.char, name: s.name, text } : narr(text);
}

function finish(q: PeopleQuest, g: GameState): Step[] {
  const next = completePeoples(g, q.id);
  const steps: Step[] = [{ mutate: (s) => completePeoples(s, q.id) }, { toast: `The Hundred Peoples ${q.id + 1}/${PEOPLES_COUNT} (${q.arc === "main" ? "main" : "side"}): ${q.title} · +${q.reward.stones} spirit stones` }];
  const after = currentPeoples(next);
  if (after && after.step === 0 && q.step !== 0) steps.push({ toast: `${PEOPLE_NUMERALS[after.book]}: ${PEOPLE_BOOKS[after.book].title} · ${peoplesPerson(after.npc!).name} waits at ${peoplesPerson(after.npc!).where}` });
  return steps;
}

function notYet(q: PeopleQuest, who: { char: HumanId; name: string }, g: GameState): Step[] {
  const need = realmLabel(...realmAtLevel(q.level));
  return [{ say: who.char, name: who.name, text: fillStanding(`Not yet, {peer}. Your qi is still a stranger's here. Come back at ${need}, and we'll talk.`, g) }, { toast: `${PEOPLES[q.book].home} asks for ${need}` }];
}

/** Why she takes up the Concord's tally, as her beginning would say it. */
function envoyReply(g: GameState): string {
  return {
    disciple: "Elder Mo says a sect is a promise to the jianghu. Nobody told me the jianghu had more than one people in it. I'll carry it.",
    foundling: "Granny Hua used to leave a bowl out for “the neighbours” on feast nights. I thought she meant the foxes. I'll carry it.",
    defector: "The Blood Moon hunted strange blood too. I watched. I didn't say anything. I'll carry it.",
  }[originOf(g.flags)];
}

function beatSteps(q: PeopleQuest, b: Beat, g: GameState): Step[] {
  const steps: Step[] = [{ emote: q.npc!, icon: "!" }, ...b.lines.map((l) => lineStep(l, q.book, g))];
  if (q.book === 0 && q.step === 0) steps.push({ say: "heroine", text: envoyReply(g) });
  if (b.choice) {
    const options: Choice[] = b.choice.options.map((o) => ({
      label: o.label,
      hint: DAOS[o.heart].name,
      then: [{ mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.heart, 1) }, narr(fillStanding(o.then, g)), lineStep(o.reply, q.book, g), { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` }],
    }));
    steps.push({ choose: options, prompt: fillStanding(b.choice.prompt, g) });
  }
  steps.push(...(b.after ?? []).map((l) => lineStep(l, q.book, g)), narr(fillStanding(b.done, g)), ...finish(q, g));
  const P = PEOPLES[q.book];
  if (q.step === 0) steps.push({ toast: `${P.home} (${P.homeHanzi}) · ${P.name} (${P.hanzi})` });
  if (q.book === 0 && q.step === 0) steps.push({ toast: "A new main quest: the Hundred Peoples · see the Journal (J)" });
  if (q.step === PEOPLES_BOOK - 2) steps.push({ toast: `${ENEMIES[P.boss].name} · face them at ${P.home}` });
  return steps;
}

const TALK_KINDS: PeopleKind[] = ["beat", "rite", "favour", "trade", "tale"];

/** What talking to this person does for the Hundred Peoples right now (null when they have nothing to do with the quest she is on). */
export function peoplesTalk(key: string, g: GameState): Step[] | null {
  const q = currentPeoples(g);
  if (!q || q.npc !== key || !TALK_KINDS.includes(q.kind)) return null;
  const who = peoplesPerson(key);
  if (!strongEnough(g, q)) return notYet(q, who, g);
  const b = beatOf(q);
  if (b) return beatSteps(q, b, g);
  const say = (text: string): Step => ({ say: who.char, name: who.name, text: fillStanding(text, g) });
  const P = PEOPLES[q.book];
  switch (q.kind) {
    case "rite":
      return [{ emote: key, icon: "!" }, { anim: "hero", name: P.id === "fox" ? "moondance" : P.id === "mer" ? "offerpearl" : P.id === "stone" ? "carve" : P.id === "feather" ? "glide" : P.id === "snow" ? "hearthsong" : "bow", wait: true }, narr(fillStanding(q.done, g)), ...finish(q, g)];
    case "favour":
      return [{ anim: "hero", name: "nod", wait: true }, say(q.done), ...finish(q, g)];
    case "trade":
      return [{ say: "heroine", text: `${who.name}. I've come from ${P.home}, for the Concord. This is for you.` }, { anim: "hero", name: "offerpearl", wait: true }, say(q.done), ...finish(q, g)];
    case "tale":
    default:
      return [{ say: "heroine", text: `${who.name}, have you ever heard of ${P.name}? Of ${P.home}? Let me tell you about them.` }, say(q.done), { anim: "hero", name: "bow", wait: true }, ...finish(q, g)];
  }
}

/** Whether someone wants a word for the Hundred Peoples (the quest she is on is theirs). */
export function peoplesHasNews(key: string, g: GameState): boolean {
  const q = currentPeoples(g);
  return !!q && q.npc === key && TALK_KINDS.includes(q.kind);
}

/** The land a quest sends her to (null for the home itself). */
export function peoplesRegion(q: PeopleQuest): AreaId | null {
  if (q.region) return q.region;
  if (q.landmark) return sightOf(q.landmark)?.region ?? null;
  if (q.npc && q.npc.startsWith("pe-")) return q.npc === ENVOY_KEY ? null : (PEOPLES.find((p) => q.npc!.startsWith(`pe-${p.id}-`))?.region ?? null);
  if (q.npc) return roadPerson(q.npc).region;
  if (q.foe) return PEOPLES[q.book].region;
  return null;
}

/** The quest line for the HUD and the journal (null before the envoy finds her). */
export function peoplesLog(g: GameState, locked: (id: AreaId) => string | null = () => null): { chapter: string; title: string; objective: string; arc: "main" | "side" } | null {
  if (!peoplesOpen(g)) return null;
  const n = peoplesDone(g);
  if (n >= PEOPLES_COUNT) return { chapter: "The Hundred Peoples", title: "The Concord Stands", objective: `All ${PEOPLES_COUNT} quests of the Hundred Peoples are done. Six marks warm the tally, and the peoples write to one another again.`, arc: "main" };
  const q = peoplesQuestAt(n);
  const B = PEOPLE_BOOKS[q.book];
  const chapter = `Peoples · ${PEOPLE_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${PEOPLES_COUNT} · ${q.arc === "main" ? "Main" : "Side"} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "gate") return { chapter, title, objective: `${PEOPLES[q.book].home} asks for ${realmLabel(...realmAtLevel(q.level))} before it will trust you with more. You stand at ${realmLabel(g.realm, g.stage)}. Cultivate.`, arc: q.arc };
  const where = peoplesRegion(q);
  const lock = where && locked(where);
  if (lock && where) return { chapter, title, objective: `The way lies through ${REGION_PLACE[where]}, which is still closed to you: ${lock}`, arc: q.arc };
  const progress = q.kind === "hunt" || q.kind === "sit" ? ` (${Math.min(q.count, peoplesProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: fillStanding(q.objective, g) + progress, arc: q.arc };
}

const isPeopleFoe = (id: EnemyId): id is PeopleFoeId => (PEOPLE_FOES as readonly string[]).includes(id);
const isPeopleBoss = (id: EnemyId): id is PeopleBossId => (PEOPLE_BOSSES as readonly string[]).includes(id);

/** A foe of the peoples beaten: it counts if the quest wants it. */
export function peoplesHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentPeoples(g);
  if (!q || q.kind !== "hunt" || !isPeopleFoe(enemy) || q.foe !== enemy || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advancePeoples(g);
  if (peoplesProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${peoplesProgress(s)}/${q.count}` };
}

/** Breaths at a shrine: they count if the quest wants her to sit in this land. */
export function peoplesBreath(g: GameState, area: AreaId): { state: GameState; steps: Step[] | null } {
  const q = currentPeoples(g);
  if (!q || q.kind !== "sit" || q.region !== area || !strongEnough(g, q)) return { state: g, steps: null };
  const s = advancePeoples(g);
  if (peoplesProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)] };
  return { state: s, steps: null };
}

/** At a landmark: seeing it at the hour and in the way she was asked. */
export function peoplesLandmark(landmark: string, g: GameState, how: { night: boolean; riding: boolean; flying: boolean }): Step[] | null {
  const q = currentPeoples(g);
  if (!q || q.kind !== "visit" || q.landmark !== landmark || !strongEnough(g, q)) return null;
  const ok = q.how === "any" || (q.how === "night" && how.night) || (q.how === "day" && !how.night) || (q.how === "ride" && how.riding) || (q.how === "fly" && how.flying);
  if (!ok) return null;
  return [...(how.flying || how.riding ? [] : [{ anim: "hero", name: "look", wait: true } as Step]), narr(q.done), ...finish(q, g)];
}

/** Her realm has caught up: the book's second half opens by itself. */
export function peoplesCultivated(g: GameState): Step[] | null {
  const q = currentPeoples(g);
  if (!q || q.kind !== "gate" || !strongEnough(g, q)) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- each people's trouble
export function peoplesPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentPeoples(g);
  if (!q || q.kind !== "duel" || !isPeopleBoss(enemy) || PEOPLES[q.book].boss !== enemy) return null;
  const B = PEOPLE_BOOKS[q.book];
  const steps: Step[] = [{ shake: 0.3 }, narr(`${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}.`), ...B.boss.words.map((l) => lineStep(l, q.book, g))];
  const d = dominantDao(g);
  if (d) steps.push({ say: "heroine", text: { sword: "Then I'll cut it short.", mercy: "Nobody has to be hunted today. Not even you.", balance: "Come, then. Let's see what the Concord makes of us.", slaughter: "You're not the only one who remembers how to hunt." }[d] });
  return steps;
}

/** After a people's trouble is beaten: what she does about it, and the home as it is left. */
export function peoplesVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentPeoples(g);
  if (!q || q.kind !== "duel" || !isPeopleBoss(enemy) || PEOPLES[q.book].boss !== enemy) return null;
  const B = PEOPLE_BOOKS[q.book];
  const last = q.id === PEOPLES_COUNT - 1;
  const options: Choice[] = B.boss.fates.map((f) => {
    const dark = f.heart === "slaughter";
    return {
      label: f.label,
      hint: DAOS[f.heart].name,
      then: [
        { mutate: (s) => walkDao(dark ? shift(s, CULT.demon, 6) : s, f.heart, 3) },
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`peoples:fate:${q.book}`]: true, [`peoples:fate:${q.book}:${f.heart}`]: true } }) },
        narr(f.line),
        ...finish(q, g),
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: dark ? "roar" : "comprehend", wait: true },
        narr(B.boss.victory),
        ...(last ? peoplesEnd(f.heart) : [{ toast: `${PEOPLE_NUMERALS[q.book]} is done: ${B.title}` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "victory", wait: true }, { choose: options, prompt: `${ENEMIES[enemy].name} is beaten. What now?` }];
}

/** The Concord stands (or does not): the tale ends. */
function peoplesEnd(heart: string): Step[] {
  return [
    { shake: 0.6 },
    { flash: "#fff0c0" },
    {
      narrate: [
        heart === "slaughter"
          ? "She carries the tally back to the crossroads with six marks on it and the last great dragon's fire at her back. The Concord Stone does not mend. The peoples set their marks on it anyway, because they are afraid of her, and that is a kind of concord too."
          : "She carries the tally back to the crossroads, and lays it against the Concord Stone, and the crack closes, slowly, like a wound that has decided to heal.",
        "Envoy Shan reads the six marks aloud to the teahouse. A fox, a scale, a hand, a feather, a horn, a claw. Then he reads the new line on the back of the tally, the one he wrote in the snow-folk's winter: “And no one put out into the snow.”",
        "That spring, for the first time in three hundred years, a fox-folk storyteller sits down in the crossroads teahouse and pays for her tea with a story. Nobody runs. Somebody asks for another.",
      ],
    },
    { anim: "hero", name: "offerpearl", wait: true },
    { toast: "The Hundred Peoples is done · the Concord of a Hundred Peoples stands again" },
  ];
}

// ----------------------------------------------------------------------------- everyday words
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + peoplesDone(g)) % lines.length];
}

const ENVOY_IDLE = ["A paw, a scale, a hand, a feather, a horn, a claw. A hundred marks, once. I read them every morning.", "The stone is warmer. Don't tell me it's the sun.", "Tea? The teahouse gives it to me free now. They say I'm a landmark."];

/** What the peoples (and the envoy) say when the quest is not theirs. */
export function peoplesNpcScript(key: string, g: GameState): Step[] | null {
  if (!key.startsWith("pe-")) return null;
  const who = peoplesPerson(key);
  if (key === ENVOY_KEY) return [{ say: who.char, name: who.name, text: fillStanding(pick(g, ENVOY_IDLE), g) }];
  const k = PEOPLES.findIndex((p) => key.startsWith(`pe-${p.id}-`));
  if (k < 0) return null;
  const B = PEOPLE_BOOKS[k];
  const P = PEOPLES[k];
  const lines = key === elderKey(P.id) ? B.elder : key === guideKey(P.id) ? B.guide : [`Here, ${P.custom}. You'll get used to it.`, ...B.favours.map((f) => f.done)];
  // before she has come to them with the tally, a home is wary of a human
  if (peoplesDone(g) < k * PEOPLES_BOOK + 21 && key !== elderKey(P.id)) return [{ say: who.char, name: who.name, text: `A human. At ${P.home}. …Speak to the elder, if you must speak to anyone.` }];
  return [{ say: who.char, name: who.name, text: fillStanding(pick(g, lines), g) }];
}

/** The peoples in the journal: each one as it stands for her. */
export function peoplesChronicle(g: GameState): { people: string; hanzi: string; home: string; custom: string; state: "unknown" | "visiting" | "marked"; fate: string | null }[] {
  const n = peoplesDone(g);
  return PEOPLES.map((p, k) => {
    const fate = (["mercy", "sword", "balance", "slaughter"] as const).find((d) => g.flags[`peoples:fate:${k}:${d}`]);
    return {
      people: `${PEOPLE_NUMERALS[k]} · ${p.name.replace(/^the /, "The ")} · ${PEOPLE_BOOKS[k].title}`,
      hanzi: p.hanzi,
      home: `${p.home} (${p.homeHanzi})`,
      custom: p.custom,
      state: n >= (k + 1) * PEOPLES_BOOK ? "marked" : n >= k * PEOPLES_BOOK && n > 0 ? "visiting" : "unknown",
      fate: fate ? DAOS[fate].name : null,
    };
  });
}

/** The peoples' line in the ending, if she took up the tally. */
export function peoplesEpilogue(g: GameState): string | null {
  const n = peoplesDone(g);
  if (n < 2) return null;
  if (n >= PEOPLES_COUNT)
    return g.flags["peoples:fate:5:slaughter"]
      ? "The Concord Stone still has its crack, and six marks on it set there out of fear. The peoples write to one another now. Mostly about her."
      : "At the crossroads below Willow Creek the Concord Stone stands whole, and on feast nights the teahouse is full of foxes, merfolk, stone-born, feathered folk, snow-folk and dragon-kin, arguing. Envoy Shan sits in the middle of them, very old, and very happy, and says nothing at all.";
  return `The Concord's tally still hangs at her belt with ${Math.floor(n / PEOPLES_BOOK)} of six marks on it — ${n} of the Hundred Peoples' ${PEOPLES_COUNT} quests behind her, and the old stone at the crossroads still cracked, still waiting.`;
}
