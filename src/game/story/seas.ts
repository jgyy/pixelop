import { cultivationNeeded, levelIndex, realmAtLevel, realmLabel } from "../engine/realms";
import { gainCultivation, heal, type GameState } from "../engine/state";
import { DAOS, dominantDao, walkDao } from "../engine/dao";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import { AREA_IDS, type AreaId } from "../world/ids";
import { HALL_DAOS } from "../world/halls";
import { SEA_BOOK_COUNT, SEA_BOSSES, SEA_CAST, SEA_FOES, seaFolkKey, seaGuideKey, seaPatronKey, type SeaBossId, type SeaFoeId } from "../world/isles";
import { BOOKS as ROAD_BOOKS, roadPerson } from "./road";
import { originOf } from "./origins";
import type { Choice, Step } from "./script";
import type { Beat, BeatLine } from "./hallsBooks";
import { SEA_BOOKS } from "./seasBooks";
import { fillStanding } from "./standing";

/**
 * The Sea of Pearls and the Nine Springs (珠海九泉): the eighth thread of the
 * main tale, twelve hundred quests long, and the one that sends her furthest.
 *
 * When the world grew south the last time, the cloud below the Tidewater
 * Reach became sea. Out on its isles a bell rings under the water, a tide
 * will not turn, a dragon king sleeps with soup on his breath, and the Ghost
 * Gate stands open. Down the stair beneath it, in the Nine Springs, someone
 * has been stealing Meng Po's soup of forgetting and rewriting the ledger of
 * life and death.
 *
 * Each of the six books is two hundred quests: its main quests (the
 * hand-written beats, the rites of its isle or court, the long wait for her
 * realm to catch up, and its trouble at the end) and its side quests (its
 * folk's favours, goods carried between the isles, tales carried back to the
 * mainland's folk in every land, hunts, sittings at lotus shrines all over
 * the jianghu and walks to places from the Sword Tomb to Penglai). Every quest
 * is composed from its number, so the save holds only how many are done
 * (`seas`) and how far the current one has got (`seasp`).
 */

export const SEAS_BOOK = 200;
export const SEAS_COUNT = SEA_BOOK_COUNT * SEAS_BOOK;
export const SEA_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

export type SeaKind = "beat" | "rite" | "gate" | "duel" | "favour" | "trade" | "tale" | "hunt" | "sit" | "visit";
/** The main quests carry the tale; the side quests are the life of the isles and courts about it. */
export const SEA_MAIN_KINDS: SeaKind[] = ["beat", "rite", "gate", "duel"];

export interface SeaQuest {
  id: number;
  book: number;
  step: number;
  kind: SeaKind;
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
  foe?: SeaFoeId;
  /** The realm the book asks of her for this quest (an overall level index). */
  level: number;
  done: string;
  reward: { stones: number; cult: number };
}

// ----------------------------------------------------------------------------- who is who
/** The NPC key a book's line means, as it stands in the world. */
function resolveNpc(key: string, book: number): string {
  if (key === "sp-patron") return seaPatronKey(book);
  if (key === "sp-guide") return seaGuideKey(book);
  const f = /^sp-folk-(\d)$/.exec(key);
  if (f) return seaFolkKey(book, Number(f[1]));
  return key;
}

/** Who answers to a Sea of Pearls NPC key (or a mainland folk's): a name, a look, and where they are found. */
export function seasPerson(key: string): { key: string; name: string; char: HumanId; where: string } {
  const m = /^sp-(\d)-(patron|guide|folk)(?:-(\d))?$/.exec(key);
  if (m) {
    const C = SEA_CAST[Number(m[1])];
    const who = m[2] === "patron" ? C.patron : m[2] === "guide" ? C.guide : C.folk[Number(m[3])];
    return { key, name: who.name, char: who.char, where: C.where };
  }
  const r = roadPerson(key);
  return { key, name: r.name, char: r.char, where: REGION_PLACE[r.region] };
}

function speaker(key: string, book: number): { name: string; char: HumanId } | null {
  if (key === "sp-boss") {
    const e = ENEMIES[SEA_CAST[book].boss];
    return { name: e.name.split(",")[0], char: e.sprite as HumanId };
  }
  const p = seasPerson(resolveNpc(key, book));
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
  harbor: "the eastern shore and the Sea of Pearls",
  frost: "Frostveil",
};

/** Every place she may be sent to see: the isles of the sea, and old places all over the mainland that the dead remember. */
const SIGHTS: { key: string; name: string; region: AreaId }[] = [
  { key: "sea-pearlgate", name: "Pearlgate Isle", region: "harbor" },
  { key: "sea-turtleback", name: "Turtleback Isle", region: "harbor" },
  { key: "sea-lanternreef", name: "the lighthouse on Lantern Reef", region: "harbor" },
  { key: "sea-crescent", name: "Crescent Isle", region: "harbor" },
  { key: "sea-dragonking", name: "the Dragon King's Isle", region: "harbor" },
  { key: "sea-ghostgate", name: "Ghost Gate Isle", region: "harbor" },
  { key: "sea-atoll", name: "the Coral Ring", region: "harbor" },
  { key: "sea-penglai", name: "Penglai, the Isle of Immortals", region: "harbor" },
  { key: "sea-pearls", name: "the bridge out over the Sea of Pearls", region: "harbor" },
  { key: "cloudrest", name: "Cloudrest Isle", region: "sect" },
  { key: "teahouse", name: "the Crossroads Teahouse", region: "bamboo" },
  { key: "mill", name: "the Watermill", region: "lake" },
  { key: "temple", name: "the Temple of Still Water", region: "marsh" },
  { key: "swordtomb", name: "the Sword Tomb", region: "bamboo" },
  { key: "pavilion", name: "the Moon-Gazing Pavilion", region: "bamboo" },
  { key: "orchard", name: "the Peach Orchard", region: "lake" },
  { key: "plum", name: "the Plum Blossom Shrine", region: "marsh" },
  { key: "herbvalley", name: "Hundred Herb Valley", region: "marsh" },
  { key: "swordsea", name: "the Sword Sea Pavilion", region: "frost" },
  { key: "steppe", name: "the Herders' Camp", region: "harbor" },
  { key: "phoenix", name: "the Scarlet Phoenix Sect", region: "desert" },
  { key: "caravan", name: "the Camel Bell Caravanserai", region: "desert" },
  { key: "jinhe", name: "Jinhe, the Golden River City", region: "terraces" },
  { key: "reedwater", name: "Reedwater Landing", region: "marsh" },
  { key: "hailing", name: "Hailing, the Tide City", region: "harbor" },
  { key: "returningcloud", name: "Returning Cloud Isle", region: "harbor" },
  { key: "tianjie", name: "Tianjie, the City of Nine Tiers", region: "terraces" },
];
const sightOf = (key: string) => SIGHTS.find((s) => s.key === key);
/** Each book's own place to be seen. */
const BOOK_SIGHT = SEA_CAST.map((c) => c.sight.key);

// ----------------------------------------------------------------------------- the life of the isles
const FAVOUR_TITLES = ["A Favour on the Isle", "Asked on the Quay", "Small Mercies", "Help Wanted, Salt Included"];
const FAVOUR_TITLES_DEEP = ["A Favour for the Dead", "Asked on the Yellow Road", "Small Mercies Below", "What the Dead Ask"];
const TRADE_TITLES = ["Carried Over the Water", "Between the Isles", "A Gift Across the Bridges", "The Ferry's Cargo"];
const TRADE_DONE = [
  "“From them? For us? Then the bridges are worth the planks.”",
  "“Tell them thank you, and tell them the bell is quiet here too.”",
  "“We'll send something back on the next tide. When there are tides again.”",
  "“A gift. Salt on it. Everything out here has salt on it.”",
];
const TALE_TITLES = ["News From the Sea", "Tell the Mainland", "A Tale Carried Ashore", "What the Living Say"];
const HUNT_TITLES = ["Trouble on the Water", "Drive Them Back", "The Isle's Edge", "Before the Next Tide"];
const HUNT_TITLES_DEEP = ["Trouble on the Yellow Road", "Back to the Dark", "The Court's Edge", "Before They Climb"];
const SIT_TITLES = ["A Breath for the Dead", "Remember Them Here", "Stillness Over the Water", "A Lamp for the Crossing"];
const VISIT_TITLES = ["What the Dead Remember", "See It for Them", "A Place Someone Loved", "Look Homeward"];

// ----------------------------------------------------------------------------- composing the quests
const LEVELS = SEA_BOOKS.map((b) => b.level);
function levelFor(book: number, step: number): number {
  if (step === SEAS_BOOK - 1) return LEVELS[book] + 2;
  return LEVELS[book] + (step >= SEAS_BOOK / 2 ? 1 : 0);
}

const SIDE: [SeaKind, number][] = [
  ["favour", 0.22],
  ["visit", 0.2],
  ["sit", 0.18],
  ["hunt", 0.14],
  ["tale", 0.14],
  ["trade", 0.12],
];

function pickSide(r: number): SeaKind {
  for (const [k, w] of SIDE) {
    if (r < w) return k;
    r -= w;
  }
  return "favour";
}

/** The lands a sitting may send her to: every one of them, the sky's and the deep's alike, in turn. */
const SIT_LANDS: AreaId[] = [...AREA_IDS];

function compose(id: number): SeaQuest {
  const book = Math.floor(id / SEAS_BOOK);
  const step = id % SEAS_BOOK;
  const B = SEA_BOOKS[book];
  const C = SEA_CAST[book];
  const deep = C.isle === "deep";
  const h = (k: number) => hash2(id, k, 9127);
  const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
  const level = levelFor(book, step);
  const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((15 + book * 9 + step * 0.12) * stoneK), cult: cultK });
  const base = { id, book, step, level };

  const beat = B.beats.find((b) => b.step === step);
  if (beat)
    return {
      ...base,
      kind: "beat",
      arc: "main",
      title: step === 0 ? `${C.where.replace(/^the /, "The ")} · ${B.title}` : beat.title,
      objective: beat.objective,
      npc: resolveNpc(beat.npc, book),
      count: 1,
      done: beat.done,
      reward: reward(step === 0 ? 0.08 : 0.06, step === 0 ? 2 : 1.4),
    };
  if (step === SEAS_BOOK - 1)
    return {
      ...base,
      kind: "duel",
      arc: "main",
      title: ENEMIES[C.boss].name,
      objective: `${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}. Face them ${book === 2 ? "in the Drowned Palace under the Dragon King's Isle" : `at ${C.where}`}.`,
      count: 1,
      done: B.boss.victory,
      reward: reward(0.4, 6),
    };
  if (step === SEAS_BOOK / 2)
    return {
      ...base,
      kind: "gate",
      arc: "main",
      title: deep ? "Strong Enough for the Dead" : "Strong Enough for the Sea",
      objective: `${C.where.charAt(0).toUpperCase() + C.where.slice(1)} will trust you with no more of its trouble until you stand at ${realmLabel(...realmAtLevel(level))}. Cultivate.`,
      count: 1,
      done: `At ${C.where} they notice the change in her qi before she does, and the next door opens.`,
      reward: reward(0.05),
    };
  if (step % 10 === 5) {
    const rite = at(B.rites, 1);
    const who = h(2) < 0.6 ? seaPatronKey(book) : seaGuideKey(book);
    return { ...base, kind: "rite", arc: "main", title: rite.title, objective: `${seasPerson(who).name} asks you to ${rite.ask} (${C.where}).`, npc: who, count: 1, done: rite.done, reward: reward(0.06, 1.3) };
  }
  const kind = pickSide(h(3));
  switch (kind) {
    case "favour": {
      const n = Math.floor(h(4) * C.folk.length);
      const f = at(B.favours, 5);
      return { ...base, kind, arc: "side", title: at(deep ? FAVOUR_TITLES_DEEP : FAVOUR_TITLES, 6), objective: `${C.folk[n].name} at ${C.where} asks you to ${f.ask}.`, npc: seaFolkKey(book, n), count: 1, done: f.done, reward: reward(0.04) };
    }
    case "trade": {
      const goods = at(B.goods, 7);
      // goods go to an isle or court she already knows (the first book's go back to Hailing's own folk)
      const k = book === 0 ? 0 : Math.floor(h(10) * book);
      const to = book === 0 ? seaFolkKey(0, Math.floor(h(11) * 4)) : h(11) < 0.5 ? seaPatronKey(k) : seaGuideKey(k);
      return { ...base, kind, arc: "side", title: at(TRADE_TITLES, 8), objective: book === 0 ? `Carry ${goods} round Pearlgate to ${seasPerson(to).name}, who has been asking for it.` : `Carry ${goods} from ${C.where} to ${seasPerson(to).name} at ${SEA_CAST[k].where}.`, npc: to, count: 1, done: at(TRADE_DONE, 12), reward: reward(0.05, 1.4) };
    }
    case "tale": {
      // the mainland's folk, from every land the Founder's Road runs through
      const R = ROAD_BOOKS[HALL_DAOS[Math.floor(h(24) * HALL_DAOS.length)]];
      const who = roadPerson(at(R.folk, 13));
      return { ...base, kind, arc: "side", title: at(TALE_TITLES, 14), objective: `Tell ${who.name} (${REGION_PLACE[who.region]}) of ${C.where}, and hear what the living make of it.`, npc: who.key, count: 1, done: at(B.tales, 15), reward: reward(0.04, 1.2) };
    }
    case "hunt": {
      const n = 1 + Math.floor(h(16) * 3);
      const foe = ENEMIES[C.foe].name;
      return { ...base, kind, arc: "side", title: at(deep ? HUNT_TITLES_DEEP : HUNT_TITLES, 17), objective: `Beat the ${foe} ${n === 1 ? "once" : `${n} times`} ${book === 2 ? "on the Dragon King's Isle or in his drowned palace" : `round ${C.where}`}.`, foe: C.foe, count: n, done: deep ? "The road is quiet behind her. Somewhere a lantern-seller lights one more lamp." : "The water round the isle is calm tonight. Someone has left a bowl of fish congee on the bridge for her.", reward: reward(0.04 + n * 0.01, 1.2) };
    }
    case "sit": {
      const n = 6 + Math.floor(h(18) * 4) * 2;
      const land = SIT_LANDS[(book * 7 + step * 3 + Math.floor(h(25) * 4)) % SIT_LANDS.length];
      return { ...base, kind, arc: "side", title: at(SIT_TITLES, 19), objective: `Sit ${n} breaths at a lotus shrine in ${REGION_PLACE[land]}, and hold the dead of ${C.where} in your stillness.`, region: land, count: n, done: `Somewhere in her stillness she hears the sea, very far off, and a bell that is not ringing any more.`, reward: reward(0.05) };
    }
    case "visit":
    default: {
      const s = h(20) < 0.35 ? sightOf(BOOK_SIGHT[book])! : at(SIGHTS, 21);
      const how = at(["any", "any", "night", "day", "ride", "fly"] as const, 22);
      const howText = { any: "", night: " after dark", day: " by daylight", ride: " on Cloudmane", fly: " on your flying sword" }[how];
      const asker = deep ? C.folk[Math.floor(h(23) * C.folk.length)].name : C.guide.name;
      return { ...base, kind: "visit", arc: "side", title: at(VISIT_TITLES, 23), objective: `${asker} asks you to go to ${s.name}${howText}, and look at it for someone who cannot any more.`, landmark: s.key, how, count: 1, done: `At ${s.name} she stands a long while, and looks at it for someone else.`, reward: reward(0.05, 1.1) };
    }
  }
}

let all: SeaQuest[] | null = null;
/** Every quest of the Sea of Pearls and the Nine Springs (composed once). */
export function seasQuests(): SeaQuest[] {
  return (all ??= Array.from({ length: SEAS_COUNT }, (_, id) => compose(id)));
}
export const seasQuestAt = (id: number) => seasQuests()[id];
const beatOf = (q: SeaQuest): Beat | undefined => (q.kind === "beat" ? SEA_BOOKS[q.book].beats.find((b) => b.step === q.step) : undefined);

// ----------------------------------------------------------------------------- the save
export const seasDone = (g: GameState) => Math.max(0, Math.min(SEAS_COUNT, g.counters.seas ?? 0));
const seasProgress = (g: GameState) => g.counters.seasp ?? 0;

/** The sea opens to her once Elder Mo has sent her out into the jianghu and she can hold her own (late Qi Condensation). */
export const seasOpen = (g: GameState) => !!g.flags.metElder && (levelIndex(g.realm, g.stage) >= 2 || seasDone(g) > 0);

/** The quest she is on, or null before the sea opens and after the tale ends. */
export function currentSeas(g: GameState): SeaQuest | null {
  if (!seasOpen(g)) return null;
  const n = seasDone(g);
  return n < SEAS_COUNT ? seasQuestAt(n) : null;
}

export const strongEnough = (g: GameState, q: SeaQuest) => levelIndex(g.realm, g.stage) >= q.level;

/** Bring the sea's flags in line with the tale: `seas:book:<k>` while a book is hers, `seas:boss:<k>` while its trouble is out, `seas:begun` and `seas:done`. */
export function syncSeasFlags(g: GameState): GameState {
  const n = seasDone(g);
  const going = seasOpen(g) && n < SEAS_COUNT;
  const book = Math.min(SEA_BOOK_COUNT - 1, Math.floor(n / SEAS_BOOK));
  const step = n % SEAS_BOOK;
  const flags: Record<string, boolean> = { ...g.flags, "seas:begun": n >= 1, "seas:done": n >= SEAS_COUNT };
  for (let k = 0; k < SEA_BOOK_COUNT; k++) {
    flags[`seas:book:${k}`] = going && book === k;
    flags[`seas:boss:${k}`] = going && book === k && step === SEAS_BOOK - 1;
  }
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

/** Mark the current quest done: pay out, and move the tale on. */
export function completeSeas(g: GameState, id: number): GameState {
  if (seasDone(g) !== id) return g;
  const q = seasQuestAt(id);
  let s: GameState = { ...g, counters: { ...g.counters, seas: id + 1, seasp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  return syncSeasFlags(s);
}

const advanceSeas = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, seasp: seasProgress(g) + by } });

// ----------------------------------------------------------------------------- how the sea and the dead speak
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

function finish(q: SeaQuest, g: GameState): Step[] {
  const next = completeSeas(g, q.id);
  const steps: Step[] = [{ mutate: (s) => completeSeas(s, q.id) }, { toast: `The Sea of Pearls ${q.id + 1}/${SEAS_COUNT} (${q.arc === "main" ? "main" : "side"}): ${q.title} · +${q.reward.stones} spirit stones` }];
  const after = currentSeas(next);
  if (after && after.step === 0 && q.step !== 0) steps.push({ toast: `${SEA_NUMERALS[after.book]}: ${SEA_BOOKS[after.book].title} · ${seasPerson(after.npc!).name} waits at ${seasPerson(after.npc!).where}` });
  return steps;
}

function notYet(q: SeaQuest, who: { char: HumanId; name: string }, g: GameState): Step[] {
  const need = realmLabel(...realmAtLevel(q.level));
  return [{ say: who.char, name: who.name, text: fillStanding(`Not yet, {peer}. The sea out here would swallow your qi whole. Come back at ${need}.`, g) }, { toast: `${SEA_CAST[q.book].where} asks for ${need}` }];
}

/** Why she crosses to the isles, as her beginning would say it. */
function crossingReply(g: GameState): string {
  return {
    disciple: "Elder Mo says a sect disciple goes where she's needed. Nobody said anything about boats. I'll stay.",
    foundling: "Granny Hua always said the dead deserve a good supper. I'll eat with you, and listen for your bell.",
    defector: "The Blood Moon kept its dead awake to frighten us. I know what that does to the living. I'll stay.",
  }[originOf(g.flags)];
}

function beatSteps(q: SeaQuest, b: Beat, g: GameState): Step[] {
  const steps: Step[] = [{ emote: q.npc!, icon: "!" }, ...b.lines.map((l) => lineStep(l, q.book, g))];
  if (q.book === 0 && q.step === 0) steps.push({ say: "heroine", text: crossingReply(g) });
  if (b.choice) {
    const options: Choice[] = b.choice.options.map((o) => ({
      label: o.label,
      hint: DAOS[o.heart].name,
      then: [{ mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.heart, 1) }, narr(fillStanding(o.then, g)), lineStep(o.reply, q.book, g), { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` }],
    }));
    steps.push({ choose: options, prompt: fillStanding(b.choice.prompt, g) });
  }
  steps.push(...(b.after ?? []).map((l) => lineStep(l, q.book, g)), narr(fillStanding(b.done, g)), ...finish(q, g));
  const C = SEA_CAST[q.book];
  if (q.step === 0) steps.push({ toast: `${C.where} (${C.hanzi})` });
  if (q.book === 0 && q.step === 0) steps.push({ toast: "A new main quest: the Sea of Pearls and the Nine Springs · see the Journal (J)" });
  if (q.step === SEAS_BOOK - 2) steps.push({ toast: `${ENEMIES[C.boss].name} · face them ${q.book === 2 ? "in the Drowned Palace" : `at ${C.where}`}` });
  return steps;
}

const TALK_KINDS: SeaKind[] = ["beat", "rite", "favour", "trade", "tale"];
const RITE_ANIM = ["offer", "pray", "bow", "lantern", "stir", "write"] as const;

/** What talking to this person does for the Sea of Pearls right now (null when they have nothing to do with the quest she is on). */
export function seasTalk(key: string, g: GameState): Step[] | null {
  const q = currentSeas(g);
  if (!q || q.npc !== key || !TALK_KINDS.includes(q.kind)) return null;
  const who = seasPerson(key);
  if (!strongEnough(g, q)) return notYet(q, who, g);
  const b = beatOf(q);
  if (b) return beatSteps(q, b, g);
  const say = (text: string): Step => ({ say: who.char, name: who.name, text: fillStanding(text, g) });
  const C = SEA_CAST[q.book];
  switch (q.kind) {
    case "rite":
      return [{ emote: key, icon: "!" }, { anim: "hero", name: RITE_ANIM[q.book], wait: true }, narr(fillStanding(q.done, g)), ...finish(q, g)];
    case "favour":
      return [{ anim: "hero", name: "nod", wait: true }, say(q.done), ...finish(q, g)];
    case "trade":
      return [{ say: "heroine", text: `${who.name}. I've come from ${C.where}. This is for you.` }, { anim: "hero", name: "offer", wait: true }, say(q.done), ...finish(q, g)];
    case "tale":
    default:
      return [{ say: "heroine", text: `${who.name}, have you heard? There's a sea below the Tidewater Reach now, and isles in it, and under one of them, ${C.where === "the Nine Springs, below Ghost Gate Isle" || C.isle === "deep" ? "the way down to the Nine Springs" : C.where}. Let me tell you.` }, say(q.done), { anim: "hero", name: "bow", wait: true }, ...finish(q, g)];
  }
}

/** Whether someone wants a word for the Sea of Pearls (the quest she is on is theirs). */
export function seasHasNews(key: string, g: GameState): boolean {
  const q = currentSeas(g);
  return !!q && q.npc === key && TALK_KINDS.includes(q.kind);
}

/** The land a quest sends her to. */
export function seasRegion(q: SeaQuest): AreaId | null {
  if (q.region) return q.region;
  if (q.landmark) return sightOf(q.landmark)?.region ?? null;
  if (q.npc && q.npc.startsWith("sp-")) return "harbor";
  if (q.npc) return roadPerson(q.npc).region;
  if (q.foe) return "harbor";
  return null;
}

/** The quest line for the HUD and the journal (null before the sea opens to her). */
export function seasLog(g: GameState, locked: (id: AreaId) => string | null = () => null): { chapter: string; title: string; objective: string; arc: "main" | "side" } | null {
  if (!seasOpen(g)) return null;
  const n = seasDone(g);
  if (n >= SEAS_COUNT) return { chapter: "The Sea of Pearls", title: "The Ledger Is True", objective: `All ${SEAS_COUNT} quests of the Sea of Pearls and the Nine Springs are done. The bell is quiet, the tide turns, the king dreams of rain, the gate is shut, and the dead drink their soup and cross.`, arc: "main" };
  const q = seasQuestAt(n);
  const B = SEA_BOOKS[q.book];
  const chapter = `Sea · ${SEA_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${SEAS_COUNT} · ${q.arc === "main" ? "Main" : "Side"} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "gate") return { chapter, title, objective: `${SEA_CAST[q.book].where} asks for ${realmLabel(...realmAtLevel(q.level))} before it will trust you with more. You stand at ${realmLabel(g.realm, g.stage)}. Cultivate.`, arc: q.arc };
  const where = seasRegion(q);
  const lock = where && locked(where);
  if (lock && where) return { chapter, title, objective: `The way lies through ${REGION_PLACE[where]}, which is still closed to you: ${lock}`, arc: q.arc };
  const progress = q.kind === "hunt" || q.kind === "sit" ? ` (${Math.min(q.count, seasProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: fillStanding(q.objective, g) + progress, arc: q.arc };
}

const isSeaFoe = (id: EnemyId): id is SeaFoeId => (SEA_FOES as readonly string[]).includes(id);
const isSeaBoss = (id: EnemyId): id is SeaBossId => (SEA_BOSSES as readonly string[]).includes(id);

/** A foe of the sea or the deep beaten: it counts if the quest wants it. */
export function seasHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentSeas(g);
  if (!q || q.kind !== "hunt" || !isSeaFoe(enemy) || q.foe !== enemy || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advanceSeas(g);
  if (seasProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${seasProgress(s)}/${q.count}` };
}

/** Breaths at a shrine: they count if the quest wants her to sit in this land. */
export function seasBreath(g: GameState, area: AreaId): { state: GameState; steps: Step[] | null } {
  const q = currentSeas(g);
  if (!q || q.kind !== "sit" || q.region !== area || !strongEnough(g, q)) return { state: g, steps: null };
  const s = advanceSeas(g);
  if (seasProgress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)] };
  return { state: s, steps: null };
}

/** At a landmark: seeing it at the hour and in the way she was asked. */
export function seasLandmark(landmark: string, g: GameState, how: { night: boolean; riding: boolean; flying: boolean }): Step[] | null {
  const q = currentSeas(g);
  if (!q || q.kind !== "visit" || q.landmark !== landmark || !strongEnough(g, q)) return null;
  const ok = q.how === "any" || (q.how === "night" && how.night) || (q.how === "day" && !how.night) || (q.how === "ride" && how.riding) || (q.how === "fly" && how.flying);
  if (!ok) return null;
  return [...(how.flying || how.riding ? [] : [{ anim: "hero", name: "look", wait: true } as Step]), narr(q.done), ...finish(q, g)];
}

/** Her realm has caught up: the book's second half opens by itself. */
export function seasCultivated(g: GameState): Step[] | null {
  const q = currentSeas(g);
  if (!q || q.kind !== "gate" || !strongEnough(g, q)) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- each book's trouble
export function seasPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentSeas(g);
  if (!q || q.kind !== "duel" || !isSeaBoss(enemy) || SEA_CAST[q.book].boss !== enemy) return null;
  const B = SEA_BOOKS[q.book];
  const steps: Step[] = [{ shake: 0.3 }, narr(`${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}.`), ...B.boss.words.map((l) => lineStep(l, q.book, g))];
  const d = dominantDao(g);
  if (d) steps.push({ say: "heroine", text: { sword: "Then I'll cut it short.", mercy: "Nobody has to drown today. Not even you.", balance: "Come, then. Let's see what the scales make of us both.", slaughter: "You're not the only one who can send people down." }[d] });
  return steps;
}

/** After a book's trouble is beaten: what she does about it, and the isle or court as it is left. */
export function seasVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentSeas(g);
  if (!q || q.kind !== "duel" || !isSeaBoss(enemy) || SEA_CAST[q.book].boss !== enemy) return null;
  const B = SEA_BOOKS[q.book];
  const last = q.id === SEAS_COUNT - 1;
  const options: Choice[] = B.boss.fates.map((f) => {
    const dark = f.heart === "slaughter";
    return {
      label: f.label,
      hint: DAOS[f.heart].name,
      then: [
        { mutate: (s) => walkDao(dark ? shift(s, CULT.demon, 6) : s, f.heart, 3) },
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`seas:fate:${q.book}`]: true, [`seas:fate:${q.book}:${f.heart}`]: true } }) },
        narr(f.line),
        ...finish(q, g),
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: dark ? "roar" : "comprehend", wait: true },
        narr(B.boss.victory),
        ...(last ? seasEnd(f.heart) : [{ toast: `${SEA_NUMERALS[q.book]} is done: ${B.title}` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "victory", wait: true }, { choose: options, prompt: `${ENEMIES[enemy].name} is beaten. What now?` }];
}

/** The ledger is true again (or hers): the tale ends. */
function seasEnd(heart: string): Step[] {
  return [
    { shake: 0.6 },
    { flash: "#c8e8ff" },
    {
      narrate: [
        heart === "slaughter"
          ? "She climbs the Yellow Springs road with the false king's brush in her sleeve. Up on the isles the dead stay dead and the tides keep their hours, and nobody asks who keeps the ledger now. Nobody dares."
          : "She climbs the Yellow Springs road and the Ghost Gate's stair, and comes out on Ghost Gate Isle into morning, and there is moss on the black rock and gulls over the water.",
        "On Pearlgate the round house eats at its one long table. On the Crescent Isle the abbesses sing the tide in and out. On the Dragon King's isle it rains, a little, when it should.",
        "And down below, in her pavilion over the River of Forgetting, Meng Po pours a cup of tea, and sets out a second cup, in case the living cultivator ever comes back down for a visit. She will not drink it herself. It is only tea. She promised.",
      ],
    },
    { anim: "hero", name: "bow", wait: true },
    { toast: "The Sea of Pearls and the Nine Springs is done · the ledger of life and death is true again" },
  ];
}

// ----------------------------------------------------------------------------- everyday words
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + seasDone(g)) % lines.length];
}

/** What the people of the sea and the deep say when the quest is not theirs. */
export function seasNpcScript(key: string, g: GameState): Step[] | null {
  const m = /^sp-(\d)-/.exec(key);
  if (!m) return null;
  const k = Number(m[1]);
  const who = seasPerson(key);
  const B = SEA_BOOKS[k];
  const C = SEA_CAST[k];
  const lines = key === seaPatronKey(k) ? B.patron : key === seaGuideKey(k) ? B.guide : B.favours.map((f) => f.done);
  // before her book reaches them, they are wary of a stranger
  if (seasDone(g) < k * SEAS_BOOK && key !== seaPatronKey(k)) return [{ say: who.char, name: who.name, text: C.isle === "deep" ? "A living one? Down here? …Go and see Meng Po. Everyone sees Meng Po first." : `A stranger on ${C.where}. …The round house feeds strangers. Go and eat. Then we'll talk.` }];
  return [{ say: who.char, name: who.name, text: fillStanding(pick(g, lines), g) }];
}

/** The six books in the journal: each as it stands for her. */
export function seasChronicle(g: GameState): { book: string; hanzi: string; where: string; state: "unknown" | "visiting" | "settled"; fate: string | null }[] {
  const n = seasDone(g);
  return SEA_BOOKS.map((b, k) => {
    const fate = (["mercy", "sword", "balance", "slaughter"] as const).find((d) => g.flags[`seas:fate:${k}:${d}`]);
    return {
      book: `${SEA_NUMERALS[k]} · ${b.title}`,
      hanzi: b.hanzi,
      where: `${SEA_CAST[k].where} (${SEA_CAST[k].hanzi})`,
      state: n >= (k + 1) * SEAS_BOOK ? "settled" : n >= k * SEAS_BOOK && n > 0 ? "visiting" : "unknown",
      fate: fate ? DAOS[fate].name : null,
    };
  });
}

/** The sea's line in the ending, if she crossed to the isles. */
export function seasEpilogue(g: GameState): string | null {
  const n = seasDone(g);
  if (n < 2) return null;
  if (n >= SEAS_COUNT)
    return g.flags["seas:fate:5:slaughter"]
      ? "Out on the Sea of Pearls the tides keep their hours, and below Ghost Gate Isle the ledger of life and death is kept in a hand nobody has seen before. It is very neat. It is hers."
      : "Out on the Sea of Pearls the round house of Pearlgate eats at one long table every night, and on feast nights they set a place for the dead, and a place for the cultivator who walked the Yellow Springs road and came back.";
  return `The red thread from Pearlgate is still round her wrist — ${n} of the Sea of Pearls' ${SEAS_COUNT} quests behind her, and somewhere under the sea, the soup still going missing.`;
}
