import { cultivationNeeded, levelIndex, realmAtLevel, realmLabel } from "../engine/realms";
import { gainCultivation, heal, type GameState } from "../engine/state";
import { DAOS, dominantDao, walkDao } from "../engine/dao";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import type { AreaId } from "../world/ids";
import { HALL_DAOS } from "../world/halls";
import { FOLLOWERS, followerKey, gateFlag, TIER_BOSSES, TIER_CAST, TIER_COUNT, TIER_LEVEL, TIER_PATRON, TIER_SITES, WARDEN_NAMES, wardenKey, type TierBossId } from "../world/tiers";
import { BOOKS as ROAD_BOOKS, roadPerson } from "./road";
import { SIGHTS } from "./bounties";
import { originOf } from "./origins";
import type { Choice, Step } from "./script";
import { giveAttire } from "./wardrobe";
import type { Beat, BeatLine } from "./hallsBooks";
import { TIER_BOOKS } from "./tiersBooks";
import { fillStanding, honorific, peerTitle, realmTier } from "./standing";

/**
 * The City of Nine Tiers (九阶天城): the sixth thread of the main tale, a
 * thousand quests long.
 *
 * Across the strait of cloud below Jinhe, at the end of the Nine-Arch
 * Bridge, a whole mountain is cut into nine terraces round a summit. Its law
 * is the Stair Code: a person lives, trades and is heard on the tier their
 * realm allows. Mortals carry for everyone on the Mud Tier at its foot, and
 * every spring the Weighing Hall weighs them, and the light ones go to sleep
 * and do not wake. Their years are drawn up the mountain into the Stair
 * Array, which holds the city up, and which the Sovereign of the Stair means
 * to fill at the next conjunction and lift the whole city into heaven.
 *
 * Lin Yue is weighed and given a jade tablet. With Ah Lou, a porter girl of
 * the Mud Tier whose father was weighed light, and Wen Qi, a registrar who
 * has begun to read his own ledgers, she climbs the city tier by tier as her
 * realm opens each gate: the debts of the Copper Tier, the forged tablets of
 * the Silver, the red threads of the Jade, the challenges of the Gold, the
 * weighed words of the Violet, the borrowed springs of the Cloud, the charts
 * of the Star, the severed of the Thunder, and at the top, Heaven's Step.
 *
 * Every quest is composed from its number, so the save holds only how many
 * are done (`tiers`) and how far the current one has got (`tiersp`). The
 * flags the city answers to are derived from those and from her realm (see
 * syncTiersFlags): every tier's gate opens to her realm alone, whatever she
 * has done in the tale.
 */

export const TIERS_COUNT = 1000;
export const TIERS_BOOK = 100;
/** The land the city stands in (its shrine counts for the long sittings). */
export const TIERS_AREA: AreaId = "terraces";

export type TierKind = "beat" | "petition" | "ahlou" | "vouch" | "registry" | "errand" | "challenge" | "contemplate" | "climb" | "gate" | "duel";

export interface TierQuest {
  id: number;
  book: number;
  step: number;
  kind: TierKind;
  title: string;
  objective: string;
  /** Who she must speak to (beat, petition, ahlou, vouch, registry, errand): an NPC key as it stands in the world. */
  npc?: string;
  count: number;
  /** Where (climb): a landmark, and how she must be there. */
  landmark?: string;
  how?: "any" | "night" | "day" | "ride" | "fly";
  /** Where (contemplate). */
  region?: AreaId;
  /** The realm the tier asks of her for this quest (an overall level index). */
  level: number;
  /** Said or narrated when it is done. */
  done: string;
  reward: { stones: number; cult: number };
}

export const TIER_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

// ----------------------------------------------------------------------------- who is who
/** The NPC key a book's beat or errand means, as it stands in the world. */
function resolveNpc(key: string, book: number): string {
  if ((FOLLOWERS as readonly string[]).includes(key)) return followerKey(key, book);
  if (key === "tj-patron") return resolveNpc(TIER_PATRON[book], book);
  if (key === "tj-warden") return book === 0 ? "tj-weigher" : wardenKey(book);
  return key;
}

/** Who answers to a key in a book's lines: a name and a look. */
function speaker(key: string, book: number): { name: string; char: HumanId } | null {
  const w = /^tj-warden-(\d+)$/.exec(key);
  if (w) return { name: WARDEN_NAMES[Number(w[1])], char: "tierwarden" };
  if (key === "tj-warden") return book === 0 ? TIER_CAST["tj-weigher"] : { name: WARDEN_NAMES[book], char: "tierwarden" };
  if (key === "tj-boss") {
    const e = ENEMIES[TIER_BOSSES[book]];
    return { name: e.name.split(",")[0], char: e.sprite as HumanId };
  }
  if (key === "tj-patron") return TIER_CAST[TIER_PATRON[book]];
  const base = key.replace(/-\d+$/, "");
  return TIER_CAST[base] ?? null;
}

/** Who answers to a City of Nine Tiers NPC key (or an errand's folk abroad): a name, a look, and where they are found. */
export function tierPerson(key: string): { key: string; name: string; char: HumanId; where: string } {
  const w = /^tj-warden-(\d+)$/.exec(key);
  if (w) return { key, name: WARDEN_NAMES[Number(w[1])], char: "tierwarden", where: `the foot of the stair to ${TIER_SITES[Number(w[1])].name}` };
  const f = /^tj-(ahlou|wenqi)-(\d+)$/.exec(key);
  if (f) return { key, ...TIER_CAST[`tj-${f[1]}`], where: TIER_SITES[Number(f[2])].name };
  const c = TIER_CAST[key];
  if (c) {
    const patron = TIER_PATRON.indexOf(key);
    const where = key === "tj-herald" ? "Jinhe's south gate" : key === "tj-weigher" ? "the Weighing Hall, in the flats below the city" : key === "tj-gao" ? "Heaven's Step" : patron >= 0 ? TIER_SITES[patron].name : "the City of Nine Tiers";
    return { key, name: c.name, char: c.char, where };
  }
  const p = roadPerson(key);
  return { key, name: p.name, char: p.char, where: REGION_PLACE[p.region] };
}

const REGION_PLACE: Record<AreaId, string> = {
  sect: "the Azure Cloud Sect",
  village: "Willow Creek",
  bamboo: "the Whispering Bamboo",
  lake: "the Lotus Lake",
  valley: "the Crimson Demon Valley",
  peak: "Heavenly Tribulation Peak",
  marsh: "the Mistmarsh",
  terraces: "the Cloudmist lands (the City of Nine Tiers has its own shrine)",
  desert: "the Yellow Sands",
  harbor: "the eastern shore",
  frost: "Frostveil",
};

const CITY_SIGHTS = ["tianjie", "ninearch", "weighhall"];
function sightName(key: string): string {
  return { tianjie: "the foot of the City of Nine Tiers", ninearch: "the Nine-Arch Bridge", weighhall: "the Weighing Hall", summit: "Heaven's Step" }[key] ?? SIGHTS.find((x) => x.key === key)?.name ?? key;
}
const sightRegion = (key: string): AreaId => (CITY_SIGHTS.includes(key) || key === "summit" ? TIERS_AREA : (SIGHTS.find((x) => x.key === key)?.region ?? TIERS_AREA));

// ----------------------------------------------------------------------------- the city's daily business
const VOUCH_TITLES = ["A Bearer's Pass", "Vouched For", "Through the Gate", "Word at the Stair"];
const VOUCH_ASKS = [
  "vouch for a porter of the Mud Tier to climb as your bearer",
  "vouch for a smith's apprentice who must deliver to the tier above",
  "stand surety at the gate for a child sent to the physician",
  "speak for a washerwoman whose tablet the warden doubts",
];
const VOUCH_DONE = [
  "The warden writes a name below hers in the gate book, in smaller letters. A porter climbs a stair he has carried loads up for twenty years and never stood on.",
  "“Your word, {peer}, is the weight of your tablet. The seal parts. Next.”",
  "The warden looks at her tablet, and then at the child, and then, for a moment, at nothing. “Pass.”",
  "“Vouched for by {realm}. That will do. It would do for the Sovereign's cook.”",
];
const REGISTRY_TITLES = ["The Registry", "Re-Stamped", "A Line in the Ledger", "Weighed Again"];
const REGISTRY_DONE = [
  "Wen Qi re-stamps her tablet: {realm}. “It opens {tier} now. Everyone on it will speak to you differently. You'll see.”",
  "Wen Qi copies a page of the second column for her, and files the original in the wrong drawer.",
  "Wen Qi reads her a list of this week's sleepers. He reads every name. It takes a long time.",
  "Wen Qi enters her vouchings in the Registry's book. “They'll have to read them now. Your seal is on every page.”",
];
const ERRAND_TITLES = ["The City's Business Abroad", "Across the Strait", "Carried and Delivered", "A Message from Tianjie"];
const ERRAND_ASKS = [
  "carry a sealed summons of the Census of the Stair to {who}, and bring back their answer",
  "ask {who} whether they would ever be weighed in Tianjie",
  "deliver a jar of Mud Tier soup to {who}, from Granny Pot, who has a cousin everywhere",
  "tell {who} what a tablet is, and hear what they make of it",
];
const ERRAND_DONE = [
  "“Weighed? Me? By a city on a mountain? Tell them I weigh what I eat. And I eat well.”",
  "“A tablet that says what a person's worth? We had one of those. It was called a landlord.”",
  "“Soup from the Mud Tier! It's thin. It's good. Tell Granny Pot her cousin's well and still owes her a hen.”",
  "“In my village we judged a cultivator by whether she'd help pull the cart out of the ditch. Simpler. Better.”",
  "“The Stair Code? Hah. Every city has one. Theirs is just carved in stone where you can read it.”",
  "“If they want to weigh me they can come down here and lift me. Tell them that.”",
];
const CHALLENGE_TITLES = ["The Stair Ring", "Challenged", "Under the Code", "A Bout in the Flats"];
const CLIMB_TITLES = ["The Long Way Round", "Walk the Avenue", "Seen From the Stair", "Out of the City"];
const SIT_TITLES = ["The Long Sitting", "Breathe Below the Stair", "Stillness on the Mud Tier", "Sit Where the Porters Sit"];

const GENERIC_AHLOU = [
  "My basket's lighter on the way down. Everything up there's heavier than it looks.",
  "Granny Pot says to eat. She says it to everyone. She means you especially, {title}.",
  "I counted the gates again. Still nine. I keep hoping they'll have taken one away.",
  "Wen Qi taught me to read the ledger. I wish he hadn't. I'm glad he did.",
];

// ----------------------------------------------------------------------------- composing the quests
function levelFor(book: number, step: number): number {
  if (book === 9 && step === 99) return 19;
  return TIER_BOOKS[book].level + (step >= 50 ? 1 : 0);
}

const KINDS: [TierKind, number][] = [
  ["petition", 0.17],
  ["ahlou", 0.15],
  ["errand", 0.14],
  ["vouch", 0.12],
  ["contemplate", 0.11],
  ["climb", 0.11],
  ["registry", 0.1],
  ["challenge", 0.1],
];

function pickKind(r: number): TierKind {
  for (const [k, w] of KINDS) {
    if (r < w) return k;
    r -= w;
  }
  return "climb";
}

const tierName = (book: number) => TIER_SITES[book].name;

function compose(id: number): TierQuest {
  const book = Math.floor(id / TIERS_BOOK);
  const step = id % TIERS_BOOK;
  const B = TIER_BOOKS[book];
  const R = ROAD_BOOKS[HALL_DAOS[book]];
  const h = (k: number) => hash2(id, k, 9119);
  const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  const level = levelFor(book, step);
  const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((12 + book * 8 + step * 0.2) * stoneK), cult: cultK });
  const base = { id, book, step, level };

  const beat = B.beats.find((b) => b.step === step);
  if (beat)
    return {
      ...base,
      kind: "beat",
      title: step === 0 ? `Tier ${TIER_NUMERALS[book]} · ${B.title}` : beat.title,
      objective: beat.objective,
      npc: resolveNpc(beat.npc, book),
      count: 1,
      done: beat.done,
      reward: reward(step === 0 ? 0.08 : 0.06, step === 0 ? 2 : 1.4),
    };
  if (step === 99)
    return {
      ...base,
      kind: "duel",
      title: ENEMIES[TIER_BOSSES[book]].name,
      objective: `${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}. Face ${book === 9 ? "him under Heaven's Step" : `the trouble on ${tierName(book)}`}.`,
      count: 1,
      done: B.boss.victory,
      reward: reward(0.4, 6),
    };
  if (step === 50)
    return {
      ...base,
      kind: "gate",
      title: "The Tier Weighs You Again",
      objective: `${tierName(book)} will tell you no more of itself until your tablet reads ${realmLabel(...realmAtLevel(level))}. Cultivate.`,
      count: 1,
      done: "Wen Qi re-stamps her tablet, and on the tier around her, people who had stopped talking when she came by start talking to her instead.",
      reward: reward(0.05),
    };
  const kind = pickKind(h(2));
  switch (kind) {
    case "petition": {
      const who = resolveNpc(TIER_PATRON[book], book);
      const p = tierPerson(who);
      return { ...base, kind, title: `${p.name}'s Petition`, objective: `${p.name} has a petition for someone whose tablet weighs more than theirs (${tierName(book)}).`, npc: who, count: 1, done: at(B.petitions, 3), reward: reward(0.05, 1.2) };
    }
    case "ahlou": {
      const who = followerKey("tj-ahlou", book);
      return { ...base, kind, title: "Ah Lou", objective: `Ah Lou wants a word, on ${tierName(book)}.`, npc: who, count: 1, done: at([...B.ahlou, ...GENERIC_AHLOU], 4), reward: reward(0.03) };
    }
    case "vouch": {
      const who = book === 0 ? "tj-weigher" : wardenKey(book);
      return { ...base, kind, title: at(VOUCH_TITLES, 5), objective: `Go to ${tierPerson(who).name} and ${at(VOUCH_ASKS, 6)}. Your tablet's weight is the whole of the argument.`, npc: who, count: 1, done: at(VOUCH_DONE, 7), reward: reward(0.04, 1.1) };
    }
    case "registry": {
      const who = followerKey("tj-wenqi", book);
      return { ...base, kind, title: at(REGISTRY_TITLES, 8), objective: `Registrar Wen Qi needs your seal on the Registry's books (${tierName(book)}).`, npc: who, count: 1, done: at(REGISTRY_DONE, 9), reward: reward(0.04) };
    }
    case "errand": {
      const who = roadPerson(at(R.folk, 10));
      const ask = at(ERRAND_ASKS, 11).replace("{who}", who.name);
      return { ...base, kind, title: at(ERRAND_TITLES, 12), objective: `For Wen Qi and the Registry: ${ask} (${REGION_PLACE[who.region].replace(/ \(.*\)$/, "")}).`, npc: who.key, count: 1, done: at(ERRAND_DONE, 13), reward: reward(0.05, 1.3) };
    }
    case "challenge": {
      const n = 1 + Math.floor(h(14) * 3);
      return { ...base, kind, title: at(CHALLENGE_TITLES, 15), objective: `Under the Stair Code anyone may challenge anyone. Win ${n} bout${n > 1 ? "s" : ""} against the challengers of the Stair Ring, in the flats west of the city.`, count: n, done: n === 1 ? "The challenger bows from the dust. “Under the Code, I owe you a bow. Here it is. And another, for free.”" : "The last challenger taps the dust. The Mud Tier, watching from the flats, cheers for the ones who lost bravely.", reward: reward(0.04 + n * 0.01, 1.2) };
    }
    case "contemplate": {
      const region = at([...R.shrines, TIERS_AREA, TIERS_AREA], 16);
      const n = 6 + Math.floor(h(17) * 4) * 2;
      return { ...base, kind, title: at(SIT_TITLES, 18), objective: `Sit ${n} breaths at a lotus shrine in ${REGION_PLACE[region]}, and let your realm settle before the city weighs it again.`, region, count: n, done: "At the bottom of her stillness she can feel the threads of the city running up the mountain behind her, and which way each one runs.", reward: reward(0.05) };
    }
    case "climb":
    default: {
      const sight = at([...CITY_SIGHTS, ...CITY_SIGHTS, ...R.sights], 19);
      const how = at(["any", "any", "night", "day", "ride", "fly"] as const, 20);
      const howText = { any: "", night: " after dark", day: " by daylight", ride: " on Cloudmane", fly: " on your flying sword" }[how];
      return { ...base, kind: "climb", title: at(CLIMB_TITLES, 21), objective: `Wen Qi asks you to see ${sightName(sight)}${howText}, and tell him what someone of your tablet sees there.`, landmark: sight, how, count: 1, done: `At ${sightName(sight)} she looks at the people, and for the first time counts which of them look back at her and which look at her tablet.`, reward: reward(0.05, 1.1) };
    }
  }
}

let all: TierQuest[] | null = null;
/** Every quest of the City of Nine Tiers (composed once). */
export function tiersQuests(): TierQuest[] {
  return (all ??= Array.from({ length: TIERS_COUNT }, (_, id) => compose(id)));
}
export const tiersQuestAt = (id: number) => tiersQuests()[id];
const beatOf = (q: TierQuest): Beat | undefined => (q.kind === "beat" ? TIER_BOOKS[q.book].beats.find((b) => b.step === q.step) : undefined);

// ----------------------------------------------------------------------------- the save
export const tiersDone = (g: GameState) => Math.max(0, Math.min(TIERS_COUNT, g.counters.tiers ?? 0));
const tiersProgress = (g: GameState) => g.counters.tiersp ?? 0;

/** The Census reaches her once Elder Mo has sent her out into the jianghu and she can hold her own (late Qi Condensation). */
export const tiersOpen = (g: GameState) => !!g.flags.metElder && (levelIndex(g.realm, g.stage) >= 2 || tiersDone(g) > 0);

/** The quest she is on, or null before the Census reaches her and after the tale ends. */
export function currentTiers(g: GameState): TierQuest | null {
  if (!tiersOpen(g)) return null;
  const n = tiersDone(g);
  return n < TIERS_COUNT ? tiersQuestAt(n) : null;
}

/** Whether her realm is what the tier asks. */
export const strongEnough = (g: GameState, q: TierQuest) => levelIndex(g.realm, g.stage) >= q.level;

/**
 * Bring the city's flags in line with the tale and her realm: `tiers:gate:<k>`
 * for every gate her realm opens (whatever she has done in the tale),
 * `tiers:book:<k>` while a book is hers, `tiers:boss:<k>` while its trouble
 * is out, `tiers:begun` and `tiers:done`.
 */
export function syncTiersFlags(g: GameState): GameState {
  const n = tiersDone(g);
  const going = tiersOpen(g) && n < TIERS_COUNT;
  const book = Math.min(TIER_COUNT - 1, Math.floor(n / TIERS_BOOK));
  const step = n % TIERS_BOOK;
  const L = levelIndex(g.realm, g.stage);
  const flags: Record<string, boolean> = { ...g.flags, "tiers:begun": n >= 1, "tiers:done": n >= TIERS_COUNT };
  for (let k = 0; k < TIER_COUNT; k++) {
    flags[gateFlag(k)] = L >= TIER_LEVEL[k];
    flags[`tiers:book:${k}`] = going && book === k;
    flags[`tiers:boss:${k}`] = going && book === k && step === 99;
  }
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

/** Outfits along the way. */
export const TIER_MILESTONES: { at: number; attire: string; note: string }[] = [
  { at: 500, attire: "climber", note: "Five tiers climbed. On the Mud Tier, Granny Pot and the porters have sewn her a jacket of porters' blue with a pocket for a clay tablet and a pocket for a jade one, “so you remember which is which, and that you carried both”." },
];

/** Mark the current quest done: pay out, move the tale on, and hand out any outfit. */
export function completeTiers(g: GameState, id: number): GameState {
  if (tiersDone(g) !== id) return g;
  const q = tiersQuestAt(id);
  let s: GameState = { ...g, counters: { ...g.counters, tiers: id + 1, tiersp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  const b = beatOf(q);
  if (b?.attire) s = giveAttire(s, b.attire);
  const m = TIER_MILESTONES.find((x) => x.at === id + 1);
  if (m) s = giveAttire(s, m.attire);
  return syncTiersFlags(s);
}

const advanceTiers = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, tiersp: tiersProgress(g) + by } });

// ----------------------------------------------------------------------------- how the city speaks
const narr = (text: string): Step => ({ say: "narrator", text });

/** A line of a beat, as a step, with her standing filled in. */
function lineStep(l: BeatLine, book: number, g: GameState): Step {
  if (!Array.isArray(l)) return { anim: l.a === "hero" ? "hero" : resolveNpc(l.a, book), name: l.n, wait: true };
  const [who, raw] = l;
  const text = fillStanding(raw, g);
  if (who === "narr") return narr(text);
  if (who === "hero") return { say: "heroine", text };
  const s = speaker(who, book);
  return s ? { say: s.char, name: s.name, text } : narr(text);
}

/** The steps that finish a quest: a toast, and any outfit. */
function finish(q: TierQuest, g: GameState): Step[] {
  const next = completeTiers(g, q.id);
  const m = TIER_MILESTONES.find((x) => x.at === q.id + 1);
  const steps: Step[] = [{ mutate: (s) => completeTiers(s, q.id) }, { toast: `The Nine Tiers ${q.id + 1}/${TIERS_COUNT}: ${q.title} · +${q.reward.stones} spirit stones` }];
  if (m) steps.push({ anim: "hero", name: "twirl", wait: true }, narr(m.note), { toast: "A gift from the Mud Tier: see the wardrobe (V)" });
  const after = currentTiers(next);
  if (after && after.step === 0 && q.step !== 0) steps.push({ toast: `Tier ${TIER_NUMERALS[after.book]}: ${TIER_BOOKS[after.book].title} · ${tierPerson(after.npc!).name} waits at ${tierPerson(after.npc!).where}` });
  return steps;
}

/** She is not yet heavy enough: whoever she asked tells her so, by the city's law. */
function tooLight(q: TierQuest, who: { char: HumanId; name: string }, g: GameState): Step[] {
  const need = realmLabel(...realmAtLevel(q.level));
  return [{ say: who.char, name: who.name, text: fillStanding(`Your tablet reads {realm}, {peer}. On ${tierName(q.book)} that is not heavy enough for this. Come back at ${need}. The Code is not my idea. It is only my job.`, g) }, { toast: `The City of Nine Tiers asks for ${need}` }];
}

/** Why she, of all people, crosses the bridge to be weighed: as her beginning would say it. */
function heraldReply(g: GameState): string {
  return {
    disciple: "Elder Mo says a cultivator's realm is between her and heaven. A whole city that weighs it in the street… I want to see what that does to people.",
    foundling: "Granny Hua says we were always weighed, in Willow Creek. Just by the landlord, and quietly. I'd like to see the scale.",
    defector: "The Blood Moon weighed people too. By how much blood they'd spill. I'd like to know if a jade tablet is any better.",
  }[originOf(g.flags)];
}

/** A beat of the tale: its lines, its question if it has one, and what comes after. */
function beatSteps(q: TierQuest, b: Beat, g: GameState): Step[] {
  const steps: Step[] = [{ emote: q.npc!, icon: "!" }, ...b.lines.map((l) => lineStep(l, q.book, g))];
  if (q.book === 0 && q.step === 0) steps.push({ say: "heroine", text: heraldReply(g) });
  if (b.choice) {
    const options: Choice[] = b.choice.options.map((o) => ({
      label: o.label,
      hint: DAOS[o.heart].name,
      then: [{ mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.heart, 1) }, narr(fillStanding(o.then, g)), lineStep(o.reply, q.book, g), { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` }],
    }));
    steps.push({ choose: options, prompt: fillStanding(b.choice.prompt, g) });
  }
  steps.push(...(b.after ?? []).map((l) => lineStep(l, q.book, g)), narr(fillStanding(b.done, g)), ...finish(q, g));
  if (q.step === 0) steps.push({ toast: `${TIER_SITES[q.book].name} (${TIER_SITES[q.book].hanzi}) · ${TIER_SITES[q.book].caste}` });
  if (q.book === 0 && q.step === 0) steps.push({ toast: "A new main quest: the City of Nine Tiers · see the Journal (J)" });
  if (q.step === 98) steps.push({ toast: `${ENEMIES[TIER_BOSSES[q.book]].name} · face them on ${q.book === 9 ? "Heaven's Step" : tierName(q.book)}` });
  return steps;
}

const TALK_KINDS: TierKind[] = ["beat", "petition", "ahlou", "vouch", "registry", "errand"];

/** What talking to this person does for the City of Nine Tiers right now (null when they have nothing to do with the quest she is on). */
export function tiersTalk(key: string, g: GameState): Step[] | null {
  const q = currentTiers(g);
  if (!q || q.npc !== key || !TALK_KINDS.includes(q.kind)) return null;
  const who = tierPerson(key);
  if (!strongEnough(g, q)) return tooLight(q, who, g);
  const b = beatOf(q);
  if (b) return beatSteps(q, b, g);
  const say = (text: string): Step => ({ say: who.char, name: who.name, text: fillStanding(text, g) });
  switch (q.kind) {
    case "petition":
      return [say(q.done), { anim: "hero", name: "nod", wait: true }, ...finish(q, g)];
    case "ahlou":
      return [{ emote: key, icon: "..." }, say(q.done), { anim: "hero", name: "laugh", wait: true }, ...finish(q, g)];
    case "vouch":
      return [{ say: "heroine", text: `${who.name}. I'll vouch. My tablet reads ${realmLabel(g.realm, g.stage)}.` }, { anim: "hero", name: "token", wait: true }, say(q.done), ...finish(q, g)];
    case "registry":
      return [{ anim: key, name: "stamp" }, say(q.done), ...finish(q, g)];
    case "errand":
    default:
      return [{ say: "heroine", text: `${who.name}? I come from Tianjie, the City of Nine Tiers, on the Registry's business.` }, say(q.done), { anim: "hero", name: "bow", wait: true }, ...finish(q, g)];
  }
}

/** Whether someone wants a word for the City of Nine Tiers (the quest she is on is theirs). */
export function tiersHasNews(key: string, g: GameState): boolean {
  const q = currentTiers(g);
  return !!q && q.npc === key && TALK_KINDS.includes(q.kind);
}

/** The land a quest sends her to (null for the city itself). */
export function tiersRegion(q: TierQuest): AreaId | null {
  if (q.region) return q.region === TIERS_AREA ? null : q.region;
  if (q.landmark) return CITY_SIGHTS.includes(q.landmark) ? null : sightRegion(q.landmark);
  if (q.npc && !q.npc.startsWith("tj")) return roadPerson(q.npc).region;
  return null;
}

/** The quest line for the HUD and the journal (null before the Census reaches her). */
export function tiersLog(g: GameState, locked: (id: AreaId) => string | null = () => null): { chapter: string; title: string; objective: string } | null {
  if (!tiersOpen(g)) return null;
  const n = tiersDone(g);
  if (n >= TIERS_COUNT) return { chapter: "The City of Nine Tiers", title: "The Stair Stands Still", objective: `All ${TIERS_COUNT} quests of the City of Nine Tiers are done. The Mud Tier eats Granny Pot's soup, and nobody is weighed in spring.` };
  const q = tiersQuestAt(n);
  const B = TIER_BOOKS[q.book];
  const chapter = `Tiers · ${TIER_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${TIERS_COUNT} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "gate") return { chapter, title, objective: `${tierName(q.book)} asks for ${realmLabel(...realmAtLevel(q.level))} before it will deal with you. Your tablet reads ${realmLabel(g.realm, g.stage)}. Cultivate.` };
  const where = tiersRegion(q);
  const lock = where && locked(where);
  if (lock && where) return { chapter, title, objective: `The errand waits on the way to ${REGION_PLACE[where]}, which is still closed to you: ${lock}` };
  const progress = q.kind === "challenge" || q.kind === "contemplate" ? ` (${Math.min(q.count, tiersProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: fillStanding(q.objective, g) + progress };
}

/** A bout won in the Stair Ring: it counts if the quest wants bouts. */
export function tiersHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentTiers(g);
  if (!q || q.kind !== "challenge" || enemy !== "tjring" || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advanceTiers(g);
  if (tiersProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${tiersProgress(s)}/${q.count}` };
}

/** Breaths at a shrine: they count if the quest wants her to sit in this land. */
export function tiersBreath(g: GameState, area: AreaId): { state: GameState; steps: Step[] | null } {
  const q = currentTiers(g);
  if (!q || q.kind !== "contemplate" || q.region !== area || !strongEnough(g, q)) return { state: g, steps: null };
  const s = advanceTiers(g);
  if (tiersProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)] };
  return { state: s, steps: null };
}

/** At a landmark: seeing it at the hour and in the way the Registry wanted. */
export function tiersLandmark(landmark: string, g: GameState, how: { night: boolean; riding: boolean; flying: boolean }): Step[] | null {
  const q = currentTiers(g);
  if (!q || q.kind !== "climb" || q.landmark !== landmark || !strongEnough(g, q)) return null;
  const ok = q.how === "any" || (q.how === "night" && how.night) || (q.how === "day" && !how.night) || (q.how === "ride" && how.riding) || (q.how === "fly" && how.flying);
  if (!ok) return null;
  return [...(how.flying || how.riding ? [] : [{ anim: "hero", name: "look", wait: true } as Step]), narr(q.done), ...finish(q, g)];
}

/** Her realm has caught up: the tier's second half opens by itself. */
export function tiersCultivated(g: GameState): Step[] | null {
  const q = currentTiers(g);
  if (!q || q.kind !== "gate" || !strongEnough(g, q)) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- each tier's trouble
const isTierBoss = (id: EnemyId): id is TierBossId => (TIER_BOSSES as readonly string[]).includes(id);

export function tiersPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentTiers(g);
  if (!q || q.kind !== "duel" || !isTierBoss(enemy) || TIER_BOSSES[q.book] !== enemy) return null;
  const B = TIER_BOOKS[q.book];
  const steps: Step[] = [{ shake: 0.3 }, narr(`${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}.`), ...B.boss.words.map((l) => lineStep(l, q.book, g))];
  const d = dominantDao(g);
  if (d) steps.push({ say: "heroine", text: { sword: "Then let the blade weigh it.", mercy: "Nobody needs to be weighed today. But I won't step aside.", balance: "Come, then. Let's see where the beam settles.", slaughter: "You've weighed the wrong cultivator." }[d] });
  return steps;
}

/** After a tier's trouble is beaten: what she does about it, and the city as it is left. */
export function tiersVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentTiers(g);
  if (!q || q.kind !== "duel" || !isTierBoss(enemy) || TIER_BOSSES[q.book] !== enemy) return null;
  const B = TIER_BOOKS[q.book];
  const last = q.id === TIERS_COUNT - 1;
  const options: Choice[] = B.boss.fates.map((f) => {
    const dark = f.heart === "slaughter";
    return {
      label: f.label,
      hint: DAOS[f.heart].name,
      then: [
        { mutate: (s) => walkDao(dark ? shift(s, CULT.demon, 6) : s, f.heart, 3) },
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`tiers:fate:${q.book}`]: true, [`tiers:fate:${q.book}:${f.heart}`]: true } }) },
        narr(f.line),
        ...finish(q, g),
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: dark ? "roar" : "comprehend", wait: true },
        narr(B.boss.victory),
        ...(last ? tiersEnd(f.heart) : [{ toast: `Tier ${TIER_NUMERALS[q.book]} is done: ${B.title}` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "victory", wait: true }, { choose: options, prompt: `${ENEMIES[enemy].name} is beaten. What now?` }];
}

/** The Stair stands still: the tale ends. */
function tiersEnd(heart: string): Step[] {
  return [
    { shake: 0.8 },
    { flash: "#fff0a0" },
    {
      narrate: [
        heart === "mercy"
          ? "The City of Nine Tiers settles, a hand's width a day, for a year. The terraces sink into one another until the stair is a slope, and then a hill, and then a city on a hill, where the porters walk up and down with nothing on their backs but their children."
          : heart === "balance"
            ? "Every gate of the City of Nine Tiers stands open, its seal gone dark, and the new Code is carved over the Weighing Hall's door in Wen Qi's hand: “Each tier open to anyone who climbs it. No thread drawn. No word weighed.”"
            : heart === "sword"
              ? "The great beam lies in two pieces under Heaven's Step, and without it the Array is only bronze and jade. The tablets go cold on every belt in the city. People take them off and look at them, and find they are only stones."
              : "The City of Nine Tiers hangs a hand's width above its mountain, held there by the weight of one cultivator, and every tier, mud to summit, looks up at her now.",
        "In the sleeping house on the Mud Tier, Lou Shan opens his eyes. His daughter is sitting beside him with an empty basket. His wife is standing in the door, without a helmet, not sure if she is allowed to come in.",
        "Granny Pot sets out bowls. She sets out a great many bowls. She sets out one for the Sovereign, who comes down the avenue on foot for the first time in two hundred and forty years, and eats it.",
      ],
    },
    { mutate: (s) => giveAttire(s, heart === "slaughter" ? "stairthrone" : "heavenstep") },
    { anim: "hero", name: "twirl", wait: true },
    { toast: `The City of Nine Tiers is done · the ${heart === "slaughter" ? "Robe of the Stair's Throne" : "Robe of Heaven's Step"} is in the wardrobe (V)` },
  ];
}

// ----------------------------------------------------------------------------- everyday words
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + tiersDone(g)) % lines.length];
}

const IDLE: Record<string, string[]> = {
  "tj-herald": ["By the edict of the Sovereign of the Stair! Every cultivator to be weighed!", "Cross the Nine-Arch Bridge! Carry the city's tablet! Be known for what you weigh!"],
  "tj-weigher": ["Next. Onto the pan.", "The beam says what the beam says.", "Mortals in spring. Cultivators whenever they climb. Everyone, in the end."],
  "tj-mudgran": ["Sit. Eat. That's the only law down here.", "Another bowl? Of course another bowl.", "You've got a jade tablet and an empty stomach. The stomach's more honest."],
  "tj-bellows": ["Strike, count, strike, count. The Guild counts too. Faster.", "Copper smells like blood and money. Mostly money.", "Hand me the tongs, {peer}. Cultivators' hands don't burn. Mine do."],
  "tj-forger": ["Close the door. Real tablets are too sure of themselves. I can feel yours from here.", "Every child I carve for is a little heavier than she was.", "Ink, needle, jade. That's all a person's worth, up here."],
  "tj-suwan": ["A girl's marriage is a stair. I'd rather it were a bridge.", "Shall I play? I only know sad songs. The academy only teaches sad songs.", "Madam Qiao says every thread is for my own good. Everyone's good is always someone else's idea."],
  "tj-jinwei": ["Wine? It's very good. Somebody paid a great deal for it. Not me.", "The Golden Tier is very stable. Stability is just a heavy thing nobody has moved yet.", "Lei Ba has never lost. That is the whole of the Jin clan's policy."],
  "tj-peilan": ["Contempt of weight. I'm guilty. I'm very, very guilty.", "A feather weighs nothing. Tie a hundred together and see what happens.", "Mud-born advocates win four cases in twenty years. I'm going for five."],
  "tj-mist": ["Sweep with me. The petals don't mind.", "Three hundred and one, and I look it. On this tier, that's a scandal.", "The tea tastes the same at any age. That's what they forget."],
  "tj-xinger": ["The stars are never that consistent. Not with anything.", "Unclear, I'd say. Most people are unclear. That's the honest reading.", "My mistress keeps the keys. I keep the ink."],
  "tj-shi": ["Nothing behind me. That's the oath. It's very quiet, nothing.", "I went to see the dog again.", "Severing is the art of this realm. The Guard cuts people. It's faster. It's not better."],
  "tj-gao": ["Order is the only mercy heaven allows.", "From the Step you can see every tier, and none of the faces. That was the idea.", "Two hundred and forty years. I have taken nothing for myself."],
};

const WARDEN_IDLE = [
  "Tablet, {peer}. Your tablet reads {realm}. It opens {tier}.",
  "The seal parts for the realm, not the person. I only hold the spear.",
  "Below this stair, a word weighs less. Above it, more. That's all a stair is.",
  "Vouch for a bearer, and her name goes in the book below yours. In smaller letters.",
];

/** What the people of the City of Nine Tiers say when the quest is not theirs. */
export function tiersNpcScript(key: string, g: GameState): Step[] | null {
  if (!key.startsWith("tj-") || key.startsWith("tj-folk-")) return null;
  const w = /^tj-warden-(\d+)$/.exec(key);
  if (w) {
    const k = Number(w[1]);
    const mine = realmTier(g);
    const text = mine >= k ? pick(g, WARDEN_IDLE) : `Halt. ${TIER_SITES[k].name} asks for ${realmLabel(...realmAtLevel(TIER_LEVEL[k]))}. Your tablet reads {realm}. The seal will not part, {peer}, and neither will I.`;
    return [{ say: "tierwarden", name: WARDEN_NAMES[k], text: fillStanding(text, g) }];
  }
  const who = tierPerson(key);
  const base = key.replace(/-\d+$/, "");
  if (base === "tj-ahlou") {
    const book = Number(key.slice(key.lastIndexOf("-") + 1));
    return [{ say: "ahlou", name: "Ah Lou", text: fillStanding(pick(g, [...TIER_BOOKS[book].ahlou, ...GENERIC_AHLOU]), g) }];
  }
  if (base === "tj-wenqi") return [{ say: "wenqi", name: "Registrar Wen Qi", text: fillStanding(pick(g, REGISTRY_DONE), g) }];
  const lines = IDLE[key];
  if (!lines) return null;
  return [{ say: who.char, name: who.name, text: fillStanding(pick(g, lines), g) }];
}

/** The City of Nine Tiers in the journal: each tier as it stands for her. */
export function tiersChronicle(g: GameState): { tier: string; hanzi: string; state: "sealed" | "open" | "climbing" | "done"; fate: string | null }[] {
  const n = tiersDone(g);
  const L = levelIndex(g.realm, g.stage);
  return TIER_SITES.map((t, k) => {
    const fate = (["mercy", "sword", "balance", "slaughter"] as const).find((d) => g.flags[`tiers:fate:${k}:${d}`]);
    return {
      tier: `${TIER_NUMERALS[k]} · ${t.name} · ${TIER_BOOKS[k].title}`,
      hanzi: t.hanzi,
      state: n >= (k + 1) * TIERS_BOOK ? "done" : n >= k * TIERS_BOOK && n > 0 ? "climbing" : L >= TIER_LEVEL[k] ? "open" : "sealed",
      fate: fate ? DAOS[fate].name : null,
    };
  });
}

/** The city's line in the ending, if she crossed the Nine-Arch Bridge. */
export function tiersEpilogue(g: GameState): string | null {
  const n = tiersDone(g);
  if (n < 2) return null;
  if (n >= TIERS_COUNT)
    return g.flags["tiers:fate:9:slaughter"]
      ? "The City of Nine Tiers still hangs a hand's width above its mountain, and on Heaven's Step there is only one seat now. The porters of the Mud Tier do not look up at it. They have learned not to."
      : "On the Mud Tier of what used to be the City of Nine Tiers there is a soup kitchen with a sign over the door in a porter's hand: “Everyone weighs the same here: one bowl.” Ah Lou runs it now. On the wall inside hangs a jade tablet with a crack across it, and under it, in Wen Qi's writing, the name of the cultivator who carried it.";
  return `Her jade tablet is still in a drawer somewhere, stamped at ${realmLabel(g.realm, g.stage)} — ${n} of the City of Nine Tiers' thousand quests behind her, and the Mud Tier still waiting for spring.`;
}

/** What she is told when a tier's seal turns her back. */
export function stairBarToast(why: string, g: GameState): string {
  const m = /stair to (.+)$/.exec(why);
  const k = m ? TIER_SITES.findIndex((t) => t.name === m[1]) : -1;
  const need = k > 0 ? realmLabel(...realmAtLevel(TIER_LEVEL[k])) : "a higher realm";
  return `${why}: your tablet reads ${realmLabel(g.realm, g.stage)} (${honorific(g)}, ${peerTitle(g)}). The seal parts for ${need}.`;
}


