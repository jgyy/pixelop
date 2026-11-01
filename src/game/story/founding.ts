import { cultivationNeeded, levelIndex, realmAtLevel, realmLabel } from "../engine/realms";
import { gainCultivation, heal, stats, type GameState } from "../engine/state";
import { DAOS, dominantDao, walkDao, type DaoId } from "../engine/dao";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import { charDef, type HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import { DAY_LENGTH, worldTime } from "../world/calendar";
import { COURTS, courtEmperorKey } from "../world/courts";
import { BUILDINGS, builtFlag, cityGodKey, discFlag, disciple, DISCIPLE_SLOTS, EARTH_GOD, elderFlag, ELDERS, FOUNDING_BOOKS, FOUNDING_BOSSES, FOUNDING_FOES, godFlag, GODS, marketFlag, sectName, STEWARD, type FoundingBossId, type FoundingFoeId } from "../world/founding";
import { crimsonPath, heartFate } from "./heart";
import { originOf } from "./origins";
import type { Choice, CloseUp, Step } from "./script";
import type { Beat, BeatLine } from "./hallsBooks";
import { APPLICANTS, CITY_GOD_WORDS, EMPEROR_AUDIENCE, FOUNDING_BOOKS_TEXT, GOD_WORDS, KEEPER_LINES, OVERSEE_ASKS, type Dilemma } from "./foundingBooks";
import { fillStanding } from "./standing";

/**
 * The Founding (开宗立派): the tenth thread of the main tale, a thousand main
 * quests long, in which she founds a sect of her own and learns to lead it.
 *
 * Five books of two hundred quests: choosing the ground in the Withered
 * Lotus Basin and driving off the Dune Tyrant; taking disciples and keeping
 * them from the Orthodox Alliance's buyers; laying down the sect's rules and
 * mending it when a two-faced guest elder splits it; being written into
 * heaven's Register of Sects, with the Jade Emperor, the Queen Mother of the
 * West and the gods of the Celestial Court come down to see; and the
 * founding ceremony itself, with the Alliance's patriarch alone at her gate.
 *
 * Every quest of it is a main quest, and every one plays out with a close-up:
 * the camera pushes in on whoever matters most to that moment (the steward
 * reporting a hall raised, a child at the gate, an emperor on the throne, a
 * god at the altar, her own face after a fight) and lingers there while they
 * say their line. The close-ups are composed with the quests, a thousand of
 * them, no two alike.
 *
 * As the quests are done her sect is raised in the world, a building at a
 * time, and fills with elders, disciples and workers going about their day;
 * a market town grows outside her gate; and as its master she holds council
 * with her steward once a day, setting the sect to work. The save holds only
 * how many quests are done (`fd`) and how far the current one has got
 * (`fdp`): everything else is a function of those and her choices' flags.
 */

export const FOUNDING_BOOK = 200;
export const FOUNDING_COUNT = FOUNDING_BOOKS * FOUNDING_BOOK;
export const FOUNDING_NUMERALS = ["I", "II", "III", "IV", "V"];

export type FoundingKind = "beat" | "build" | "recruit" | "lecture" | "judge" | "oversee" | "rite" | "petition" | "hunt" | "gate" | "duel";
export const FOUNDING_KINDS: FoundingKind[] = ["beat", "build", "recruit", "lecture", "judge", "oversee", "rite", "petition", "hunt", "gate", "duel"];

export interface FoundingQuest {
  id: number;
  book: number;
  step: number;
  kind: FoundingKind;
  /** Every quest of the Founding is a main quest. */
  arc: "main";
  title: string;
  objective: string;
  /** Who she must speak to (an NPC key as it stands in the world). */
  npc?: string;
  count: number;
  foe?: FoundingFoeId;
  /** The building it raises (build) or looks over (oversee). */
  building?: string;
  /** The case put to her (judge). */
  dilemma?: Dilemma;
  /** The applicant taken in (recruit), and how many come with them. */
  applicant?: { char: HumanId; name: string; story: string; party: number };
  /** The realm the book asks of her for this quest (an overall level index). */
  level: number;
  done: string;
  reward: { stones: number; cult: number };
  /** The close-up the quest plays out with. */
  closeup: CloseUp;
}

// ----------------------------------------------------------------------------- the shape of the tale
const id = (book: number, step: number) => book * FOUNDING_BOOK + step;
/** When each building goes up (book, step). */
const BUILD_AT: Record<string, [number, number]> = {
  gate: [0, 8],
  hall: [0, 38],
  quarters: [0, 80],
  well: [0, 125],
  yard: [1, 10],
  refectory: [1, 30],
  fields: [1, 50],
  pills: [1, 130],
  forge: [1, 155],
  library: [2, 10],
  arrays: [2, 55],
  healing: [2, 105],
  beasts: [2, 115],
  missions: [2, 125],
  talismans: [2, 135],
  treasury: [3, 40],
  bell: [3, 60],
  altar: [3, 120],
  shrine: [3, 165],
  guests: [4, 10],
  spring: [4, 155],
};
/** The beat that seats each elder (their quest's id): they are in the world from the quest after. */
const ELDER_AT = [id(1, 60), id(1, 140), id(2, 20), id(2, 60), id(2, 40), id(3, 20)];
/** The beat each god comes down at. */
const GOD_AT: Record<string, number> = { hearth: id(3, 10), letters: id(3, 30), wealth: id(3, 50), thunder: id(3, 70), moon: id(3, 90), jade: id(3, 140), queen: id(3, 140) };
/** The steward joins her after the very first quest. */
const STEWARD_AT = 1;
/** How many come in at a beat (the first three children, the first Selection). */
const BEAT_DISCIPLES: Record<number, number> = { [id(0, 75)]: 3, [id(1, 20)]: 42 };

export const buildQuestId = (key: string) => id(...BUILD_AT[key]);
export const elderQuestId = (n: number) => ELDER_AT[n];
export const godQuestId = (g: string) => GOD_AT[g];

// ----------------------------------------------------------------------------- close-ups
const FRAMES = ["Close-up", "Extreme close-up", "Over her shoulder", "Two-shot", "Low angle", "High angle", "Profile", "Push-in", "Insert", "Slow push-in", "Tight two-shot", "Dutch angle"];
const DETAILS = [
  (n: string) => `${n}'s eyes, steady`,
  (n: string) => `${n}'s hands, still for once`,
  (n: string) => `the light across ${n}'s face`,
  (n: string) => `${n}'s mouth, choosing the words`,
  (n: string) => `sand on ${n}'s sleeve`,
  (n: string) => `${n}'s shadow on the paving`,
  (n: string) => `the wind in ${n}'s hair`,
  (n: string) => `${n}, half in shadow`,
  (n: string) => `${n}, looking past her at the gate`,
  (n: string) => `${n}'s knuckles, white`,
  (n: string) => `${n}'s slow smile`,
  (n: string) => `${n}, not quite meeting her eyes`,
  (n: string) => `the lamp behind ${n}`,
  (n: string) => `${n}'s breath in the cold dawn`,
  (n: string) => `dust of the road on ${n}`,
  (n: string) => `${n}'s brow, furrowed`,
  (n: string) => `incense smoke drifting past ${n}`,
  (n: string) => `${n}, framed in the doorway`,
  (n: string) => `${n}'s jaw, set`,
  (n: string) => `the sky reflected in ${n}'s eyes`,
];
const KIND_DETAILS: Partial<Record<FoundingKind, ((n: string, x: string) => string)[]>> = {
  build: [(n, x) => `${n} before the fresh timber of ${x}`, (n, x) => `the first tile set on ${x}, and ${n} under it`, (n, x) => `${n}'s ink-stained finger on the plan of ${x}`, (n, x) => `${x} rising behind ${n}`],
  recruit: [(n) => `${n}'s bare feet at the gate`, (n) => `${n} clutching a bundle`, (n) => `${n}, swaying with tiredness`, (n) => `${n}'s cracked lips`],
  petition: [(n, x) => `${n}, enthroned in ${x}`, (n) => `the seal in ${n}'s hand`, (n) => `the canopy stirring over ${n}`, (n) => `${n}, looking down at her`],
  hunt: [() => "her blade, still humming", () => "sand settling round her boots", () => "her own face, flecked with grit", () => "her breath, slowing"],
  gate: [() => "her own hands, glowing faintly", () => "her eyes opening", () => "qi settling in her palms like water"],
  lecture: [(n) => `${n}'s face as it lands`, (n) => `${n}, mouth open`, (n) => `${n}'s eyes going wide`],
  judge: [(n) => `${n}, waiting on her word`, (n) => `the rules stele behind ${n}`],
};

/** Every close-up, kept apart: a frame and a detail are tried in turn until the shot is one no other quest has used for that line. */
class Shots {
  private used = new Set<string>();
  take(seed: number, kind: FoundingKind, who: string, name: string, text: string, extra = ""): string {
    const own = KIND_DETAILS[kind] ?? [];
    const pool = [...own.map((f) => (n: string) => f(n, extra)), ...DETAILS];
    const n = pool.length * FRAMES.length;
    const start = Math.floor(hash2(seed, 3, 7717) * n);
    for (let k = 0; k < n; k++) {
      const c = (start + k * 7) % n;
      // ("the Jade Emperor's hands", not "The Jade Emperor's hands", in the middle of a caption)
      const shot = `${FRAMES[c % FRAMES.length]} · ${pool[Math.floor(c / FRAMES.length) % pool.length](name.replace(/^The /, "the "))}`;
      const key = `${who}|${shot}|${text}`;
      if (this.used.has(key)) continue;
      this.used.add(key);
      return shot;
    }
    return `${FRAMES[0]} · ${name}`;
  }
}

// ----------------------------------------------------------------------------- who is who
/** The NPC key a book's line means, as it stands in the world. */
function resolveNpc(key: string): string {
  if (key === "fd-steward") return STEWARD.key;
  if (key === "fd-earthgod") return EARTH_GOD.key;
  return key;
}

const HERO_NAME = "Lin Yue";

/** Who answers to one of the Founding's keys (or to an emperor's or a City God's). */
export function foundingPerson(key: string): { key: string; name: string; char: HumanId; where: string } {
  const basin = "the Withered Lotus Basin";
  if (key === STEWARD.key) return { key, name: STEWARD.name, char: STEWARD.char, where: basin };
  if (key === EARTH_GOD.key) return { key, name: EARTH_GOD.name, char: EARTH_GOD.char, where: basin };
  const e = ELDERS.find((x) => x.key === key);
  if (e) return { key, name: e.name, char: e.char, where: basin };
  const god = GODS.find((x) => x.key === key);
  if (god) return { key, name: god.name.charAt(0).toUpperCase() + god.name.slice(1), char: god.char, where: "the Altar of Heaven" };
  const d = /^fd-disc-(\d+)$/.exec(key);
  if (d) {
    const p = disciple(Number(d[1]));
    return { key, name: p.name, char: p.char, where: basin };
  }
  const k = /^fd-keeper-([a-z]+)$/.exec(key);
  if (k) {
    const b = BUILDINGS.find((x) => x.key === k[1])!;
    return { key, name: b.keeper!.name, char: b.keeper!.char, where: b.name };
  }
  const c = /^fd-citygod-(\d)$/.exec(key);
  if (c) return { key, name: `the City God of ${COURTS[Number(c[1])].capital.split(",")[0]}`, char: "citygod", where: COURTS[Number(c[1])].capital };
  const m = /^ct-(\d)-emperor$/.exec(key);
  if (m) {
    const C = COURTS[Number(m[1])];
    return { key, name: C.emperor.name, char: C.emperor.char, where: C.capital };
  }
  return { key, name: key, char: "villagerM", where: basin };
}

const keeperKey = (b: string) => `fd-keeper-${b}`;

function speaker(key: string, book: number): { name: string; char: HumanId } {
  if (key === "fd-boss") {
    const e = ENEMIES[FOUNDING_BOSSES[book]];
    return { name: e.name.split(",")[0], char: e.sprite as HumanId };
  }
  const p = foundingPerson(resolveNpc(key));
  return { name: p.name, char: p.char };
}

// ----------------------------------------------------------------------------- composing the quests
const LEVELS = FOUNDING_BOOKS_TEXT.map((b) => b.level);
function levelFor(book: number, step: number): number {
  if (step === FOUNDING_BOOK - 1) return LEVELS[book] + 2;
  return LEVELS[book] + (step >= FOUNDING_BOOK / 2 ? 1 : 0);
}

const OTHER: [FoundingKind, number][] = [
  ["recruit", 0.24],
  ["lecture", 0.17],
  ["oversee", 0.13],
  ["petition", 0.16],
  ["hunt", 0.14],
  ["rite", 0.08],
  ["judge", 0.08],
];
function pickKind(r: number): FoundingKind {
  for (const [k, w] of OTHER) {
    if (r < w) return k;
    r -= w;
  }
  return "recruit";
}

const PLACES = ["Willow Creek", "Jinhe", "Hailing", "the caravan road", "Liangdu", "Jinling", "Jincheng", "Pingcheng", "Linzi", "Longcheng", "the salt pans", "the Mistmarsh", "Frostveil", "the Camel Bell Caravanserai"];
const RECRUIT_TITLES = ["At the Gate", "One More for the Ledger", "Someone Walked Here", "A Name Written Down", "The Gate Stays Open"];
const LECTURE_TITLES = ["A Lesson in the Yard", "The Sect Master Teaches", "Under the Hall's Eaves", "A Morning Lesson"];
const OVERSEE_TITLES = ["The Day's Work", "Walking the Sect", "The Master Looks In", "How Goes the Work?"];
const PETITION_TITLES = ["An Audience for the Sect", "Before the Throne", "A Word With the Gods", "Recognised Under Heaven"];
const HUNT_TITLES = ["Trouble at the Edge of the Sands", "Keep the Basin Safe", "The Road to the Gate", "Before the Sect Wakes"];
const HUNT_LINES = [
  "That's the last of them. The road's safe, for today.",
  "They'll come back. So will I.",
  "Nobody comes to our gate frightened. Not while I'm here.",
  "The caravans can come in now. Tell Bai Qiu to put the kettle on.",
  "Every one of them was somebody, once. I hope they rest now.",
  "Still standing. Good.",
];
const GATE_LINES = [
  "Deeper. I can feel the whole basin under me now.",
  "A sect master who stops climbing stops leading. Not yet.",
  "My qi's like the well: a long way down, and sweet.",
  "There. Now I can carry them all a little further.",
  "Heaven can wait. My sect can't.",
];
const RITE_LINES = [
  "For everyone who came before, and everyone who will.",
  "Write it down, Bai Qiu. This one matters.",
  "It's only a ceremony. That's what makes it hold.",
  "A sect is made of days like this.",
  "Let the gods see this. Let the caravans see it.",
  "We'll remember we did this together.",
];
const JUDGE_LINES = [
  "We'll abide by what you say, sect master. All of us.",
  "It's yours to decide. That's what you're for.",
  "Whatever you say, the whole sect will hear of it by supper.",
  "The rules say one thing. My heart says another. What do you say?",
];

const EARTH_WORDS = [
  "The ground's happy. I can tell. It's humming.",
  "I remember when this was a lake. I remember when it was sand. I like it best like this, with feet on it.",
  "Light me a stick of incense, sect master? Just a small one. For old times.",
  "Your founder sat just there, once. You sit the same way. Elbows out.",
  "The caravans stop again. Did you know they leave dates on my shrine now? I'm getting fat.",
];

let all: FoundingQuest[] | null = null;
function build(): FoundingQuest[] {
  const shots = new Shots();
  const out: FoundingQuest[] = [];
  const builtBy = Object.fromEntries(Object.entries(BUILD_AT).map(([k, v]) => [id(...v), k]));
  let recruits = 0;
  for (let book = 0; book < FOUNDING_BOOKS; book++) {
    const B = FOUNDING_BOOKS_TEXT[book];
    const rites = [...B.rites];
    const dilemmas = [...B.dilemmas];
    let lecture = 0;
    for (let step = 0; step < FOUNDING_BOOK; step++) {
      const qid = id(book, step);
      const h = (k: number) => hash2(qid, k, 6203);
      const at = <T>(arr: readonly T[], k: number) => arr[Math.floor(h(k) * arr.length)];
      const level = levelFor(book, step);
      const reward = (cultK: number, stoneK = 1) => ({ stones: Math.round((18 + book * 11 + step * 0.12) * stoneK), cult: cultK });
      const base = { id: qid, book, step, level, arc: "main" as const, count: 1 };
      const close = (kind: FoundingKind, who: string, name: string, char: HumanId | "heroine", text: string, extra = "", focus?: string): CloseUp => ({
        who: char,
        name,
        text,
        focus: focus ?? (who === "hero" ? "hero" : who),
        scene: `Scene ${qid + 1} of ${FOUNDING_COUNT}`,
        shot: shots.take(qid, kind, who, name, text, extra),
      });
      const beat = B.beats.find((b) => b.step === step);
      if (beat) {
        const first = beat.lines.find((l): l is [string, string] => Array.isArray(l) && l[0] !== "narr") ?? ["hero", beat.done];
        const who = first[0] === "hero" ? "hero" : resolveNpc(first[0]);
        const sp = first[0] === "hero" ? { name: HERO_NAME, char: "heroine" as HumanId } : speaker(first[0], book);
        out.push({ ...base, kind: "beat", title: step === 0 ? `${FOUNDING_NUMERALS[book]} · ${B.title}` : beat.title, objective: beat.objective, npc: resolveNpc(beat.npc), done: beat.done, reward: reward(step === 0 ? 0.08 : 0.06, 1.6), closeup: close("beat", who, sp.name, sp.char, first[1], "", who === "hero" ? "hero" : resolveNpc(beat.npc)) });
        continue;
      }
      if (step === FOUNDING_BOOK - 1) {
        const e = ENEMIES[FOUNDING_BOSSES[book]];
        const [, line] = B.boss.words[0];
        out.push({ ...base, kind: "duel", title: e.name, objective: `${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}. Face them at the basin.`, done: B.boss.victory, reward: reward(0.4, 6), closeup: close("duel", `fdboss-${book}`, e.name.split(",")[0], e.sprite as HumanId, line, "", `fdboss-${book}`) });
        continue;
      }
      if (step === FOUNDING_BOOK / 2) {
        const need = realmLabel(...realmAtLevel(level));
        out.push({ ...base, kind: "gate", title: "A Sect Master's Strength", objective: `The sect has grown faster than its master. Before it can go further, you must reach ${need}. Cultivate.`, done: `She reaches ${need}, and feels the whole basin settle under her, as if the ground itself had been waiting.`, reward: reward(0.1, 2), closeup: close("gate", "hero", HERO_NAME, "heroine", at(GATE_LINES, 1)) });
        continue;
      }
      const raised = builtBy[qid];
      if (raised) {
        const Bd = BUILDINGS.find((x) => x.key === raised)!;
        const text = `${Bd.name.charAt(0).toUpperCase() + Bd.name.slice(1)} is up, {title}. ${Bd.use} I've entered it in the ledger.`;
        out.push({ ...base, kind: "build", title: `Raise ${Bd.name.replace(/^the /, "the ")}`, objective: `Bai Qiu has the timber, stone and hands for ${Bd.name} (${Bd.hanzi}). Tell him to begin, and put your own back into it.`, npc: STEWARD.key, building: raised, done: `${Bd.name.charAt(0).toUpperCase() + Bd.name.slice(1)} (${Bd.hanzi}) stands in the basin. ${Bd.use}`, reward: reward(0.07, 1.5), closeup: close("build", STEWARD.key, STEWARD.name, STEWARD.char, text, Bd.name) });
        continue;
      }
      // the rest of the book: the life of the sect, its master at the front of it
      const built = (key: string) => buildQuestId(key) < qid;
      const elders = ELDER_AT.filter((e) => e < qid).length;
      const visible = Math.min(DISCIPLE_SLOTS, recruits);
      let kind = pickKind(h(1));
      if (kind === "rite" && !rites.length) kind = "lecture";
      if (kind === "judge" && !dilemmas.length) kind = "oversee";
      if ((kind === "lecture" || kind === "hunt") && visible === 0) kind = "recruit";
      const keepers = BUILDINGS.filter((b) => b.keeper && built(b.key));
      if (kind === "oversee" && !keepers.length) kind = "recruit";
      const steward = { key: STEWARD.key, name: STEWARD.name, char: STEWARD.char };
      const judgeBy = ELDER_AT[4] < qid ? { key: ELDERS[4].key, name: ELDERS[4].name, char: ELDERS[4].char } : steward;
      switch (kind) {
        case "recruit": {
          const a = APPLICANTS[(recruits * 7 + book) % APPLICANTS.length];
          const name = `${a.name} of ${PLACES[Math.floor(recruits / APPLICANTS.length + recruits) % PLACES.length]}`;
          const party = 1 + Math.floor(h(4) * 4);
          recruits++;
          out.push({
            ...base,
            kind,
            title: at(RECRUIT_TITLES, 2),
            objective: `${party > 1 ? `${party} people have` : "Someone has"} come to the gate asking to be taken into {sect}. Bai Qiu is with them. Go and hear them out yourself.`,
            npc: STEWARD.key,
            applicant: { ...a, name, party },
            done: `${name}${party > 1 ? ` and ${party - 1} more` : ""} ${party > 1 ? "are" : "is"} taken in. Bai Qiu writes ${party > 1 ? "their names" : "the name"} in the ledger, very neatly.`,
            reward: reward(0.03),
            closeup: close("recruit", STEWARD.key, name, a.char, a.story, "", STEWARD.key),
          });
          continue;
        }
        case "lecture": {
          const L = B.lectures[lecture++ % B.lectures.length];
          const n = Math.floor(h(5) * visible);
          const d = disciple(n);
          out.push({ ...base, kind, title: at(LECTURE_TITLES, 2), objective: `Teach the disciples ${L.topic}. ${d.name} has asked first.`, npc: d.key, done: `She teaches ${L.topic}. By evening half the sect is trying it in the yard.`, reward: reward(0.03), closeup: close("lecture", d.key, d.name, d.char, L.line) });
          continue;
        }
        case "oversee": {
          const Bd = keepers[Math.floor(h(6) * keepers.length)];
          const lines = KEEPER_LINES[Bd.key];
          const key = keeperKey(Bd.key);
          out.push({ ...base, kind, title: at(OVERSEE_TITLES, 2), objective: `${OVERSEE_ASKS[Bd.key].charAt(0).toUpperCase() + OVERSEE_ASKS[Bd.key].slice(1)}.`, npc: key, building: Bd.key, done: `${Bd.keeper!.name} shows her round ${Bd.name}. The work is going well, and the sect's master has seen it.`, reward: reward(0.03), closeup: close("oversee", key, Bd.keeper!.name, Bd.keeper!.char, at(lines, 7)) });
          continue;
        }
        case "petition": {
          // the gods once they have come down, the thrones and the City Gods of the six capitals, and the Earth God at home
          const gods = GODS.filter((g) => GOD_AT[g.id] < qid);
          const r = h(8);
          if (gods.length && r < 0.5) {
            const G = gods[Math.floor(h(9) * gods.length)];
            const text = at(GOD_WORDS[G.id], 10);
            const nm = G.name.charAt(0).toUpperCase() + G.name.slice(1);
            out.push({ ...base, kind, title: at(PETITION_TITLES, 2), objective: `Go to ${G.name} (${G.hanzi}), ${G.office}, and ask heaven's blessing on the sect's work.`, npc: G.key, done: `${nm} hears her out, and the incense at the Altar of Heaven burns straight up all day.`, reward: reward(0.04), closeup: close("petition", G.key, nm, G.char, text, "the Altar of Heaven") });
          } else if (r < 0.62 + (gods.length ? 0 : 0.2)) {
            const b = Math.floor(h(9) * COURTS.length);
            const C = COURTS[b];
            out.push({ ...base, kind, title: at(PETITION_TITLES, 2), objective: `Go before ${C.emperor.name} at ${C.capital} and ask the throne of ${C.realm} to recognise {sect} under the Covenant of Cloud and Throne.`, npc: courtEmperorKey(b), done: `The throne of ${C.realm} recognises {sect}. A rider in ${C.realm}'s colours carries the edict to every caravanserai on the road.`, reward: reward(0.05, 1.2), closeup: close("petition", courtEmperorKey(b), C.emperor.name, C.emperor.char, EMPEROR_AUDIENCE[b], C.capital) });
          } else if (r < 0.85) {
            const b = Math.floor(h(9) * COURTS.length);
            const key = cityGodKey(b);
            const who = foundingPerson(key);
            out.push({ ...base, kind, title: at(PETITION_TITLES, 2), objective: `Light incense at the Temple of the City God in ${COURTS[b].capital}, and ask ${who.name} to pass the sect's name upwards.`, npc: key, done: `${who.name.charAt(0).toUpperCase() + who.name.slice(1)} writes the sect's name in the city's ledger, under "friends".`, reward: reward(0.04), closeup: close("petition", key, who.name.charAt(0).toUpperCase() + who.name.slice(1), "citygod", at(CITY_GOD_WORDS, 10), COURTS[b].capital) });
          } else {
            out.push({ ...base, kind, title: "Incense for Grandfather Earth", objective: "Grandfather Earth has asked, very politely, for a word and a stick of incense at his shrine.", npc: EARTH_GOD.key, done: "She lights his incense and sits with him a while. The sand round the shrine is damp all evening.", reward: reward(0.03), closeup: close("petition", EARTH_GOD.key, "Grandfather Earth", EARTH_GOD.char, at(EARTH_WORDS, 10), "the basin") });
          }
          continue;
        }
        case "hunt": {
          const foe = FOUNDING_FOES[book];
          const count = 3 + (step >= FOUNDING_BOOK / 2 ? 1 : 0);
          out.push({ ...base, kind, title: at(HUNT_TITLES, 2), objective: `Drive off ${count} ${ENEMIES[foe].name}s round the edge of the basin.`, foe, count, done: `The ${ENEMIES[foe].name.toLowerCase()}s are driven off, and the caravans come in to the gate without looking over their shoulders.`, reward: reward(0.05, 1.2), closeup: close("hunt", "hero", HERO_NAME, "heroine", at(HUNT_LINES, 11)) });
          continue;
        }
        case "rite": {
          const R = rites.shift()!;
          out.push({ ...base, kind, title: R.title, objective: `${R.ask.charAt(0).toUpperCase() + R.ask.slice(1)}.`, npc: elders > 0 && h(12) < 0.5 ? ELDERS[Math.floor(h(13) * elders) % ELDERS.length].key : STEWARD.key, done: R.done, reward: reward(0.05), closeup: close("rite", "hero", HERO_NAME, "heroine", `${at(RITE_LINES, 14)} ${R.title}.`) });
          continue;
        }
        case "judge":
        default: {
          const D = dilemmas.shift()!;
          out.push({ ...base, kind: "judge", title: D.title, objective: `A case for the sect master: ${D.case.charAt(0).toLowerCase() + D.case.slice(1)} ${judgeBy.name} brings it to you.`, npc: judgeBy.key, dilemma: D, done: `The sect hears how the sect master judged "${D.title}", and remembers.`, reward: reward(0.05), closeup: close("judge", judgeBy.key, judgeBy.name, judgeBy.char, `${at(JUDGE_LINES, 15)} It's "${D.title}".`) });
          continue;
        }
      }
    }
  }
  // the elders' and gods' quests must find them in the world: a quest sent to an elder before they are seated goes to the steward instead
  return out.map((q) => {
    const e = ELDERS.findIndex((x) => x.key === q.npc);
    if (e >= 0 && ELDER_AT[e] >= q.id) return { ...q, npc: STEWARD.key };
    return q;
  });
}

/** Every quest of the Founding (composed once). */
export function foundingQuests(): FoundingQuest[] {
  return (all ??= build());
}
export const foundingQuestAt = (n: number) => foundingQuests()[n];
const beatOf = (q: FoundingQuest): Beat | undefined => (q.kind === "beat" ? FOUNDING_BOOKS_TEXT[q.book].beats.find((b) => b.step === q.step) : undefined);

// ----------------------------------------------------------------------------- the save
export const foundingDone = (g: GameState) => Math.max(0, Math.min(FOUNDING_COUNT, g.counters.fd ?? 0));
const foundingProgress = (g: GameState) => g.counters.fdp ?? 0;

/** The basin's Earth God calls for her once she has met Village Head Zhou (the far roads are open) and reached Foundation Establishment. */
export const foundingOpen = (g: GameState) => !!g.flags.metElder && !!g.flags.metZhou && (levelIndex(g.realm, g.stage) >= 4 || foundingDone(g) > 0);

export function currentFounding(g: GameState): FoundingQuest | null {
  if (!foundingOpen(g)) return null;
  const n = foundingDone(g);
  return n < FOUNDING_COUNT ? foundingQuestAt(n) : null;
}

export const strongEnough = (g: GameState, q: FoundingQuest) => levelIndex(g.realm, g.stage) >= q.level;

/** How many disciples the sect has after n quests (the first children, the first Selection, and every party taken in at the gate). */
export function disciplesAfter(n: number): number {
  let total = 0;
  for (const q of foundingQuests()) {
    if (q.id >= n) break;
    total += (q.applicant?.party ?? 0) + (BEAT_DISCIPLES[q.id] ?? 0);
  }
  return total;
}
/** How many disciples are seen about the basin after n quests (one for each party taken in, up to the slots the basin has). */
function visibleAfter(n: number): number {
  let k = 0;
  for (const q of foundingQuests()) {
    if (q.id >= n) break;
    if (q.kind === "recruit") k++;
  }
  return Math.min(DISCIPLE_SLOTS, k + (n > id(0, 75) ? 1 : 0) + (n > id(1, 20) ? 2 : 0));
}

/**
 * Bring the Founding's flags in line with the tale: what is built, who has
 * been seated and taken in, which gods have come down, how far the market
 * has grown, which book is hers and whether its trouble is out.
 */
export function syncFoundingFlags(g: GameState): GameState {
  const n = foundingDone(g);
  const going = foundingOpen(g) && n < FOUNDING_COUNT;
  const book = Math.min(FOUNDING_BOOKS - 1, Math.floor(n / FOUNDING_BOOK));
  const step = n % FOUNDING_BOOK;
  const flags: Record<string, boolean> = { ...g.flags, "fd:begun": n >= 1, "fd:done": n >= FOUNDING_COUNT, "fd:steward": n >= STEWARD_AT };
  for (let k = 0; k < FOUNDING_BOOKS; k++) {
    flags[`fd:book:${k}`] = going && book === k;
    flags[`fd:boss:${k}`] = going && book === k && step === FOUNDING_BOOK - 1;
    flags[marketFlag(k)] = n > id(k, 0);
  }
  for (const b of BUILDINGS) flags[builtFlag(b.key)] = n > buildQuestId(b.key);
  ELDER_AT.forEach((at, e) => (flags[elderFlag(e)] = n > at));
  // a god is in the basin from the beat they come down at
  for (const god of GODS) flags[godFlag(god.id)] = n >= GOD_AT[god.id];
  const seen = visibleAfter(n);
  for (let d = 0; d < DISCIPLE_SLOTS; d++) flags[discFlag(d)] = d < seen;
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

export function completeFounding(g: GameState, qid: number): GameState {
  if (foundingDone(g) !== qid) return g;
  const q = foundingQuestAt(qid);
  let s: GameState = { ...g, counters: { ...g.counters, fd: qid + 1, fdp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  return syncFoundingFlags(s);
}

const advanceFounding = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, fdp: foundingProgress(g) + by } });

// ----------------------------------------------------------------------------- how the sect speaks
/** What the Azure Cloud answers when she writes that she means to found a sect (it depends on what she has done with its Heart). */
export function azureReply(f: Record<string, boolean>): string {
  if (crimsonPath(f)) return "The answer comes back unsigned, in Elder Mo's hand, and the seal on it is cracked: “Whatever you have become, the ground you build on is not ours to forbid. Build well. Build better than you have been.”";
  if (originOf(f) === "defector") return "The answer comes back in nine days, under the Azure Cloud's seal: “You came to us from the Blood Moon and we kept you. A disciple who founds a sect does not leave her own. She carries it further. Go on.”";
  return "The answer comes back in nine days, under the Azure Cloud's seal: “A disciple who founds a sect does not leave her own. She carries it further. Go on.”";
}

/** A line of the Founding with her standing, her sect's name and its size filled in. */
export function fillFounding(text: string, g: GameState): string {
  if (!text.includes("{")) return text;
  const S = sectName(g.flags);
  const proper = S.name.startsWith("her sect") ? "her sect" : S.name;
  const cap = proper.charAt(0).toUpperCase() + proper.slice(1);
  return fillStanding(
    text
      .replace(/\{Sect\}/g, cap)
      .replace(/\{sect\}/g, proper)
      .replace(/\{disciples\}/g, String(disciplesAfter(foundingDone(g))))
      .replace(/\{azure\}/g, azureReply(g.flags)),
    g,
  );
}

const narr = (text: string): Step => ({ say: "narrator", text });

function lineStep(l: BeatLine, book: number, g: GameState): Step {
  if (!Array.isArray(l)) return { anim: l.a === "hero" ? "hero" : resolveNpc(l.a), name: l.n, wait: true };
  const [who, raw] = l;
  const text = fillFounding(raw, g);
  if (who === "narr") return narr(text);
  if (who === "hero") return { say: "heroine", text };
  const s = speaker(who, book);
  return { say: s.char, name: s.name, text };
}

/** The quest's close-up, as a step of the script. */
const closeStep = (q: FoundingQuest, g: GameState): Step => ({ closeup: { ...q.closeup, text: fillFounding(q.closeup.text, g), shot: fillFounding(q.closeup.shot, g) } });

function finish(q: FoundingQuest, g: GameState): Step[] {
  const next = completeFounding(g, q.id);
  const steps: Step[] = [{ mutate: (s) => completeFounding(s, q.id) }, { toast: `The Founding ${q.id + 1}/${FOUNDING_COUNT} (main): ${fillFounding(q.title, g)} · +${q.reward.stones} spirit stones` }];
  // a throne that has recognised her sect remembers it (see courtsNpcScript)
  const throne = q.kind === "petition" && /^ct-(\d)-emperor$/.exec(q.npc ?? "");
  if (throne) steps.push({ mutate: (s) => ({ ...s, flags: { ...s.flags, [`fd:audience:${throne[1]}`]: true } }) });
  if (q.kind === "build") steps.push({ reshape: true }, { toast: `${BUILDINGS.find((b) => b.key === q.building)!.name.replace(/^the /, "The ")} stands in the basin` });
  if (q.kind === "recruit") steps.push({ toast: `{Sect} has ${disciplesAfter(q.id + 1)} disciples`.replace("{Sect}", fillFounding("{Sect}", next)) });
  const after = currentFounding(next);
  if (after && after.step === 0 && q.step !== 0) steps.push({ toast: `${FOUNDING_NUMERALS[after.book]}: ${FOUNDING_BOOKS_TEXT[after.book].title} · ${foundingPerson(after.npc!).name} waits at ${foundingPerson(after.npc!).where}` });
  return steps;
}

function notYet(q: FoundingQuest, who: { char: HumanId; name: string }, g: GameState): Step[] {
  const need = realmLabel(...realmAtLevel(q.level));
  return [{ say: who.char, name: who.name, text: fillFounding(`Not yet, {title}. What comes next for the sect needs its master at ${need}. Cultivate; we'll keep the gate.`, g) }, { toast: `The Founding asks for ${need}` }];
}

function beatSteps(q: FoundingQuest, b: Beat, g: GameState): Step[] {
  const steps: Step[] = [{ emote: q.npc!, icon: "!" }];
  // the beat's first spoken line plays as its close-up
  let shot = false;
  for (const l of b.lines) {
    if (!shot && Array.isArray(l) && l[0] !== "narr") {
      steps.push(closeStep(q, g));
      shot = true;
      continue;
    }
    steps.push(lineStep(l, q.book, g));
  }
  if (!shot) steps.push(closeStep(q, g));
  if (b.choice) {
    const options: Choice[] = b.choice.options.map((o) => ({
      label: o.label,
      hint: DAOS[o.heart].name,
      then: [{ mutate: (s) => walkDao(o.effect ? o.effect(s) : s, o.heart, 1) }, narr(fillFounding(o.then, g)), lineStep(o.reply, q.book, g), { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` }],
    }));
    steps.push({ choose: options, prompt: fillFounding(b.choice.prompt, g) });
  }
  // the Azure Cloud's answer to her letter depends on what she has done with its Heart
  const after = q.book === 0 && q.step === 15 ? [narr(azureReply(g.flags)), ...(b.after ?? []).slice(1).map((l) => lineStep(l, q.book, g))] : (b.after ?? []).map((l) => lineStep(l, q.book, g));
  steps.push(...after, narr(fillFounding(b.done, g)));
  steps.push(...finish(q, g));
  if (q.book === 0 && q.step === 0) steps.push({ toast: "A new main quest: the Founding · see the Journal (J)" });
  if (ELDER_AT.includes(q.id)) {
    const e = ELDERS[ELDER_AT.indexOf(q.id)];
    steps.push({ toast: `${e.name} is seated as ${e.office} (${e.hanzi})` });
  }
  for (const god of GODS) if (GOD_AT[god.id] === q.id) steps.push({ toast: `${god.name.charAt(0).toUpperCase() + god.name.slice(1)} (${god.hanzi}) has come down to the basin` });
  if (q.step === FOUNDING_BOOK - 2) steps.push({ toast: `${ENEMIES[FOUNDING_BOSSES[q.book]].name} · face them at the basin` });
  return steps;
}

const TALK_KINDS: FoundingKind[] = ["beat", "build", "recruit", "lecture", "judge", "oversee", "rite", "petition"];

/** What talking to this person does for the Founding right now (null when the quest she is on is not theirs). */
export function foundingTalk(key: string, g: GameState): Step[] | null {
  const q = currentFounding(g);
  if (!q || q.npc !== key || !TALK_KINDS.includes(q.kind)) return null;
  const who = foundingPerson(key);
  if (!strongEnough(g, q)) return notYet(q, who, g);
  const b = beatOf(q);
  if (b) return beatSteps(q, b, g);
  const say = (text: string): Step => ({ say: who.char, name: who.name, text: fillFounding(text, g) });
  const shot = closeStep(q, g);
  switch (q.kind) {
    case "build":
      return [{ emote: key, icon: "!" }, shot, { anim: "hero", name: "hammer", wait: true }, { anim: "hero", name: "carry", wait: true }, narr(fillFounding(q.done, g)), ...finish(q, g)];
    case "recruit": {
      const a = q.applicant!;
      return [say(`There's ${a.party > 1 ? `a party of ${a.party}` : "one more"} at the gate, {title}. ${a.party > 1 ? "Their eldest" : "This one"} wants to speak to you.`), shot, { anim: "hero", name: "nod", wait: true }, narr(fillFounding(q.done, g)), ...finish(q, g)];
    }
    case "lecture":
      return [{ anim: "hero", name: "point", wait: true }, shot, { anim: "hero", name: "nod", wait: true }, narr(fillFounding(q.done, g)), ...finish(q, g)];
    case "oversee":
      return [{ anim: "hero", name: "look", wait: true }, shot, narr(fillFounding(q.done, g)), ...finish(q, g)];
    case "rite":
      return [{ emote: key, icon: "!" }, { anim: "hero", name: "bow", wait: true }, shot, narr(fillFounding(q.done, g)), ...finish(q, g)];
    case "petition":
      return [{ anim: "hero", name: "bow", wait: true }, { say: "heroine", text: fillFounding(`I've come on behalf of {sect}.`, g) }, shot, narr(fillFounding(q.done, g)), ...finish(q, g)];
    case "judge":
    default: {
      const D = q.dilemma!;
      return [
        say(D.case),
        shot,
        {
          choose: D.options.map((o) => ({ label: o.label, hint: DAOS[o.heart].name, then: [{ mutate: (s: GameState) => walkDao(o.heart === "slaughter" ? shift(s, CULT.demon, 2) : s, o.heart, 1) }, narr(fillFounding(o.line, g)), { toast: `Your heart leans toward the ${DAOS[o.heart].name} (${DAOS[o.heart].hanzi})` } as Step] })),
          prompt: `${D.title}: how does the sect master judge?`,
        },
        narr(fillFounding(q.done, g)),
        ...finish(q, g),
      ];
    }
  }
}

export function foundingHasNews(key: string, g: GameState): boolean {
  const q = currentFounding(g);
  return !!q && q.npc === key && TALK_KINDS.includes(q.kind);
}

/** The quest line for the HUD and the journal (null before Grandfather Earth calls for her). */
export function foundingLog(g: GameState, locked: (id: "desert") => string | null = () => null): { chapter: string; title: string; objective: string; arc: "main" } | null {
  if (!foundingOpen(g)) return null;
  const n = foundingDone(g);
  const S = sectName(g.flags);
  if (n >= FOUNDING_COUNT) return { chapter: "The Founding", title: "The Sect Is Founded", objective: fillFounding(`All ${FOUNDING_COUNT} quests of the Founding are done. ${S.name.charAt(0).toUpperCase() + S.name.slice(1)} (${S.hanzi}) stands in the Withered Lotus Basin, written in heaven's Register, with {disciples} disciples, six elders and a spring.`, g), arc: "main" };
  const q = foundingQuestAt(n);
  const B = FOUNDING_BOOKS_TEXT[q.book];
  const chapter = `Founding · ${FOUNDING_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${FOUNDING_COUNT} · Main · ${fillFounding(q.title, g)}`;
  if (!strongEnough(g, q) && q.kind !== "gate") return { chapter, title, objective: `The sect needs its master at ${realmLabel(...realmAtLevel(q.level))} before it can go further. You stand at ${realmLabel(g.realm, g.stage)}. Cultivate.`, arc: "main" };
  const lock = q.npc?.startsWith("fd-") || q.kind === "hunt" ? locked("desert") : null;
  if (lock) return { chapter, title, objective: `The way to the Withered Lotus Basin lies through the Yellow Sands, which are still closed to you: ${lock}`, arc: "main" };
  const progress = q.kind === "hunt" ? ` (${Math.min(q.count, foundingProgress(g))}/${q.count})` : "";
  return { chapter, title, objective: fillFounding(q.objective, g) + progress, arc: "main" };
}

const isFoundingFoe = (e: EnemyId): e is FoundingFoeId => (FOUNDING_FOES as readonly string[]).includes(e);
const isFoundingBoss = (e: EnemyId): e is FoundingBossId => (FOUNDING_BOSSES as readonly string[]).includes(e);

export function foundingHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentFounding(g);
  if (!q || q.kind !== "hunt" || !isFoundingFoe(enemy) || q.foe !== enemy || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advanceFounding(g);
  if (foundingProgress(s) >= q.count) return { state: s, steps: [closeStep(q, s), narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${foundingProgress(s)}/${q.count}` };
}

/** Her realm has caught up: the book's second half opens by itself. */
export function foundingCultivated(g: GameState): Step[] | null {
  const q = currentFounding(g);
  if (!q || q.kind !== "gate" || !strongEnough(g, q)) return null;
  return [closeStep(q, g), narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- each book's trouble
export function foundingPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentFounding(g);
  if (!q || q.kind !== "duel" || !isFoundingBoss(enemy) || FOUNDING_BOSSES[q.book] !== enemy) return null;
  const B = FOUNDING_BOOKS_TEXT[q.book];
  const steps: Step[] = [{ shake: 0.3 }, narr(`${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}.`), closeStep(q, g), ...B.boss.words.slice(1).map((l) => lineStep(l, q.book, g))];
  const d = dominantDao(g);
  if (d) steps.push({ say: "heroine", text: { sword: "Then let's end it here.", mercy: "Nobody else has to be hurt by this. Not even you.", balance: "Let's see what the scales make of us both.", slaughter: "You came to my gate. You won't leave it." }[d] });
  return steps;
}

export function foundingVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentFounding(g);
  if (!q || q.kind !== "duel" || !isFoundingBoss(enemy) || FOUNDING_BOSSES[q.book] !== enemy) return null;
  const B = FOUNDING_BOOKS_TEXT[q.book];
  const last = q.id === FOUNDING_COUNT - 1;
  const options: Choice[] = B.boss.fates.map((f) => {
    const dark = f.heart === "slaughter";
    return {
      label: f.label,
      hint: DAOS[f.heart].name,
      then: [
        { mutate: (s) => walkDao(dark ? shift(s, CULT.demon, 6) : s, f.heart, 3) },
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`fd:fate:${q.book}`]: true, [`fd:fate:${q.book}:${f.heart}`]: true } }) },
        narr(fillFounding(f.line, g)),
        ...finish(q, g),
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: dark ? "roar" : "comprehend", wait: true },
        narr(fillFounding(B.boss.victory, g)),
        ...(last ? foundingEnd(f.heart, g) : [{ toast: `${FOUNDING_NUMERALS[q.book]} is done: ${B.title}` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "victory", wait: true }, { choose: options, prompt: `${ENEMIES[enemy].name} is beaten. What now?` }];
}

/** The spring comes home (or does not): it followed the Jade Lotus up into the clouds, and it follows what became of the Heart. */
export function springFate(f: Record<string, boolean>): string {
  // a Heart drunk and then drawn back out of her is back on its shrine, whatever the flags of the drinking say
  const fate = f["heart:devoured"] && f.purged ? "home" : heartFate(f);
  if (fate === "home") return "The spring comes up through the basin all at once, cold and clear, the way it ran before the founder carried the lotus away. The Heart is home on its shrine in the clouds, and the water knows it. By nightfall there is a lake, and the Lady of the Moon comes down, as she promised, to look at her face in it.";
  if (fate === "planted") return "The spring comes up slowly, warm and green, and Grandfather Earth says it has come the long way round, under the mountains, from the valley where the Heart was planted. By the year's end there is a lake, and in it, from nowhere, a lotus bud.";
  if (fate === "devoured") return "The spring will not come up for anyone but her. She kneels and puts her palms to the paving, and the Heart she drank calls it, and it comes, red at first and then clear. The lake that fills the basin is warm, and it always will be.";
  return "The spring stirs, a long way down, and stops. It is waiting, Grandfather Earth says, for the lotus to come home. Until the Heart is found it will only fill the well, and the well is enough for now.";
}

function foundingEnd(heart: string, g: GameState): Step[] {
  const S = sectName(g.flags);
  return [
    { shake: 0.6 },
    { flash: "#e8fff4" },
    {
      narrate: [
        `On the Altar of Heaven the Jade Emperor reads out the name in the Register: ${S.name.replace(/^the /, "the ")}, ${S.hanzi}, founded in the Withered Lotus Basin by ${HERO_NAME} of the Azure Cloud. ${S.motto}`,
        springFate(g.flags),
        heart === "slaughter"
          ? "The envoys of six thrones and six sects bow to her very low, and leave the basin very quickly. Her disciples watch them go, and stand a little straighter, and a little further from the gate."
          : "The envoys of six thrones and six sects bow, and the disciples bow, and the gods bow, and Grandfather Earth, taller than the Bell Tower now, bows last and lowest. Then everyone goes to the refectory, where the Lord of the Hearth has been cooking since dawn.",
      ],
    },
    { anim: "hero", name: "bow", wait: true },
    { toast: `The Founding is done · ${S.name.replace(/^the /, "The ")} (${S.hanzi}) is founded` },
  ];
}

// ----------------------------------------------------------------------------- leading the sect, every day
const dayOf = (g: GameState) => Math.floor(worldTime(g) / DAY_LENGTH);
const COUNCIL_DAY = "fdcouncil";

/** The daily tithe: what the sect's halls, workers and disciples bring in, by what has been raised. */
export function sectTithe(g: GameState): number {
  const n = foundingDone(g);
  const halls = BUILDINGS.filter((b) => n > buildQuestId(b.key)).reduce((t, b) => t + b.tithe, 0);
  return halls * 3 + Math.floor(disciplesAfter(n) / 4);
}

/** The sect as it stands: for the journal and the steward's report. */
export function sectSheet(g: GameState): { name: string; hanzi: string; motto: string; disciples: number; tithe: number; elders: { name: string; office: string; hanzi: string; seated: boolean }[]; halls: { name: string; hanzi: string; built: boolean; use: string }[]; gods: { name: string; hanzi: string; here: boolean }[] } | null {
  const n = foundingDone(g);
  if (n < 1) return null;
  const S = sectName(g.flags);
  return {
    name: S.name.replace(/^the /, "The ").replace(/^her sect/, "Her sect"),
    hanzi: S.hanzi,
    motto: S.motto,
    disciples: disciplesAfter(n),
    tithe: sectTithe(g),
    elders: ELDERS.map((e, k) => ({ name: e.name, office: e.office, hanzi: e.hanzi, seated: n > ELDER_AT[k] })),
    halls: BUILDINGS.map((b) => ({ name: b.name.replace(/^the /, "The "), hanzi: b.hanzi, built: n > buildQuestId(b.key), use: b.use })),
    gods: GODS.map((x) => ({ name: x.name.replace(/^the /, "The "), hanzi: x.hanzi, here: n > GOD_AT[x.id] })),
  };
}

/** What the sect does today, by its master's order: each order brings something different home. */
const ORDERS: { heart: DaoId; label: string; line: string; give: (g: GameState) => { state: GameState; text: string } }[] = [
  { heart: "balance", label: "Send them out on the caravan roads", line: "The disciples go out with the caravans, and come home at dusk with silver.", give: (g) => ({ state: { ...g, stones: g.stones + sectTithe(g) }, text: `+${sectTithe(g)} spirit stones in the day's tithe` }) },
  { heart: "sword", label: "Drill them in the yard all day", line: "The yard rings from dawn till dusk. She drills with them, and comes away sharper herself.", give: (g) => ({ state: gainCultivation(g, Math.round(cultivationNeeded(g.realm, g.stage) * 0.04)).state, text: "cultivation gained from a day of drills" }) },
  { heart: "mercy", label: "Open the House of Healing to the road", line: "The House of Healing opens its doors to every caravan on the road. She sits with the sick herself, and goes to bed lighter.", give: (g) => ({ state: shift(heal(g, stats(g).maxHp, stats(g).maxQi), CULT.demon, -1), text: "rested and whole, and a little lighter of heart" }) },
  { heart: "balance", label: "Work the fields and the Pill Chamber", line: "The fields and the Pill Chamber work all day. At dusk Elder Kang brings her a box of pills, still warm.", give: (g) => ({ state: { ...g, pills: { ...g.pills, heal: Math.min(99, g.pills.heal + 2) } }, text: "+2 Healing Pills from the Pill Chamber" }) },
];

/** Her steward, when the tale has nothing for him: the day's report and her order for the sect, once a day. */
export function stewardScript(g: GameState): Step[] {
  const sheet = sectSheet(g);
  const say = (t: string): Step => ({ say: STEWARD.char, name: STEWARD.name, text: fillFounding(t, g) });
  if (!sheet) return [say("The ledger's open, {title}. Nothing in it yet but the date.")];
  const day = dayOf(g);
  const halls = sheet.halls.filter((h) => h.built).length;
  const report = `Today's report, {title}: {disciples} disciples, ${sheet.elders.filter((e) => e.seated).length} elders, ${halls} halls standing. The tithe would come to ${sheet.tithe} spirit stones.`;
  if (g.counters[COUNCIL_DAY] === day) return [say(report), say(pick(g, FOUNDING_BOOKS_TEXT[Math.min(FOUNDING_BOOKS - 1, Math.floor(foundingDone(g) / FOUNDING_BOOK))].steward)), { toast: "The sect has its orders for today" }];
  const ready = foundingDone(g) > id(0, 45);
  if (!ready) return [say(report), say(pick(g, FOUNDING_BOOKS_TEXT[0].steward))];
  return [
    say(report),
    {
      choose: ORDERS.filter((o, k) => k !== 3 || foundingDone(g) > buildQuestId("pills")).map((o) => ({
        label: o.label,
        hint: DAOS[o.heart].name,
        then: [{ mutate: (s: GameState) => ({ ...o.give(s).state, counters: { ...o.give(s).state.counters, [COUNCIL_DAY]: day } }) }, narr(o.line), { toast: `The sect's orders: ${o.give(g).text}` } as Step],
      })),
      prompt: "What are the sect's orders for today?",
    },
  ];
}

function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills + foundingDone(g)) % lines.length];
}

/** What the people of the basin, its gods and the capitals' City Gods say when the quest she is on is not theirs. */
export function foundingNpcScript(key: string, g: GameState): Step[] | null {
  if (!key.startsWith("fd-")) return null;
  if (key === STEWARD.key) return stewardScript(g);
  const who = foundingPerson(key);
  const say = (t: string): Step => ({ say: who.char, name: who.name, text: fillFounding(t, g) });
  if (key === EARTH_GOD.key) return [say(foundingDone(g) ? pick(g, EARTH_WORDS) : "Oh! A visitor. Nobody visits. Sit, sit. Mind the sand.")];
  const god = GODS.find((x) => x.key === key);
  if (god) return [say(pick(g, GOD_WORDS[god.id]))];
  const k = /^fd-keeper-([a-z]+)$/.exec(key);
  if (k) return [say(pick(g, KEEPER_LINES[k[1]]))];
  if (/^fd-citygod-\d$/.test(key)) return [say(pick(g, CITY_GOD_WORDS))];
  if (/^fd-disc-\d+$/.test(key)) return [say(pick(g, ["Good morning, Sect Master!", "I did the fifth form today. Nearly.", "Elder Guan says I'm not to run in the yard. I'm walking very fast.", "Is it true the gods eat in our refectory? What do they eat?", "{Sect}'s the best sect under heaven. I've only been in one, but still."]))];
  const e = ELDERS.findIndex((x) => x.key === key);
  if (e >= 0) return [say(pick(g, [["Your guard's high today, sect master. Good.", "The children hold their swords like swords now. I'm almost disappointed."], ["Batch eleven came out perfect. Outside, of course.", "Fevers are down, burns are up. That's alchemy."], ["A hundred and nine manuals, and every one copied right.", "Someone dog-eared the Lotus Step. I will find them."], ["The ward hums tonight. The sands are restless.", "The basin was drawn as an array before anyone lived here. I keep finding more of it."], ["No warnings today. I'm suspicious.", "Rule four, sect master. Your bunk."], ["The market's quiet. Too quiet. I'll organise something.", "Three new stalls this month, and a puppet theatre."]][e]))];
  if (/^fd-mk-\d$/.test(key) || /^fd-fac-/.test(key)) return [say(pick(g, ["Busy day, {title}. Busy every day, now.", "Can't stop! Work to do.", "Mind your step, {title}, the cart's coming through.", "The work doesn't do itself. More's the pity."]))];
  return null;
}

/** The five books in the journal: each as it stands for her. */
export function foundingChronicle(g: GameState): { book: string; hanzi: string; state: "unknown" | "building" | "done"; fate: string | null }[] {
  const n = foundingDone(g);
  return FOUNDING_BOOKS_TEXT.map((b, k) => {
    const fate = (["mercy", "sword", "balance", "slaughter"] as const).find((d) => g.flags[`fd:fate:${k}:${d}`]);
    return { book: `${FOUNDING_NUMERALS[k]} · ${b.title}`, hanzi: b.hanzi, state: n >= (k + 1) * FOUNDING_BOOK ? "done" : n >= k * FOUNDING_BOOK && n > 0 ? "building" : "unknown", fate: fate ? DAOS[fate].name : null };
  });
}

/** Her sect's line in the ending, if she founded one (or began to). */
export function foundingEpilogue(g: GameState): string | null {
  const n = foundingDone(g);
  if (n < 2) return null;
  const S = sectName(g.flags);
  if (n >= FOUNDING_COUNT)
    return g.flags["fd:fate:4:slaughter"]
      ? `In the Yellow Sands, ${S.name.replace(/^the /, "the ")} keeps its gate, and its disciples are feared on every caravan road. Nobody turns it away from anywhere. Nobody asks it in.`
      : `In the Yellow Sands, ${S.name.replace(/^the /, "the ")} keeps its gate open. Its disciples have roots and have none; its elders argue in the council every morning; and on the shrine at its heart, an Earth God taller than the Bell Tower swings his feet and watches the caravans come in.`;
  return `In the Yellow Sands, ${S.name.startsWith("her sect") ? "the sect she began" : S.name.replace(/^the /, "the ")} is still being built, ${n} of the Founding's ${FOUNDING_COUNT} quests along, with Bai Qiu at its ledger and Grandfather Earth on his shrine.`;
}

/** Whether a character can play its part in a close-up (it has a face). */
export const hasFace = (char: HumanId | "heroine") => charDef(char as HumanId).portrait;
