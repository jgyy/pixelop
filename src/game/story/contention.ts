import { cultivationNeeded, levelIndex, realmAtLevel, realmLabel } from "../engine/realms";
import { gainCultivation, heal, type GameState } from "../engine/state";
import { DAOS, daoDoubt, dominantDao, HEART_STATES, heartState, steadyHeart, walkDao, type DaoId } from "../engine/dao";
import { comprehend, GREAT_DAO_IDS, GREAT_DAOS, WU_TIERS, wuTier, type GreatDaoId } from "../engine/comprehension";
import { CULT, shift } from "../engine/cultivation";
import { ENEMIES, type EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import { COURTS, courtEmperorKey, courtLeaderKey } from "../world/courts";
import { CN_BOSSES, CN_FOES, FENG, fusangTown, KEEPER, parseFusangTownKey, SEATS, SPEAKER, type CnBossId, type CnFoeId } from "../world/fusang";
import { envoyKey, POWERS, powerOf, tieByKey, TIES, type Tie } from "../world/powers";
import type { Choice, Step } from "./script";
import type { BeatLine } from "./hallsBooks";
import { CONTENTION_BOOKS_TEXT, WRITS } from "./contentionBooks";
import { courtsPerson } from "./courts";
import { revealTie, shiftTie, standing, standingName, sway, tieKnown, tieWarmth, webWarmth } from "./powers";

/**
 * The Contention of the Daos (百道争鸣): the eleventh thread of the main
 * tale, nine hundred quests long, and the one in which the Great Daos stop
 * being something she understands and become something the world argues
 * over.
 *
 * In Fusang, across the Strait of Dawn, the Synod of Ten Seats rules what
 * each Great Dao means, and means to have its Ten Writs signed by every
 * throne and sect under heaven at a Great Council. Lin Yue, whose Dao heart
 * the Speaker read from across the sea, is asked to come as the Council's
 * Witness: she carries the Writs to the six thrones, meets the exiles who
 * would not recant, finds the eleventh writ (the Writ of Strange Blood that
 * ordered the Purge), faces what lives under the starving Fusang tree, and
 * speaks last at the Council.
 *
 * Six books of a hundred and fifty quests. Their main quests are the
 * hand-written beats (contentionBooks.ts); Dao debates, in which what she
 * can say depends on what she truly comprehends; mediations between powers
 * whose ties she can mend or break; intrigues that bring a tie's hidden
 * truth to light; the long wait for her realm; and the book's trouble at
 * the end. Its side quests are letters carried between the powers, vigils
 * under the Fusang tree that steady her Dao heart, and hunts.
 *
 * The save holds only how many are done (`cn`) and how far the current one
 * has got (`cnp`); her standing with the powers and the state of the ties
 * between them live in story/powers.ts.
 */

export const CN_BOOK = 150;
export const CN_BOOKS = CONTENTION_BOOKS_TEXT.length;
export const CONTENTION_COUNT = CN_BOOKS * CN_BOOK;
export const CN_NUMERALS = ["I", "II", "III", "IV", "V", "VI"];

export type CnKind = "beat" | "debate" | "mediate" | "intrigue" | "letter" | "vigil" | "hunt" | "gate" | "duel";
export const CN_MAIN_KINDS: CnKind[] = ["beat", "debate", "mediate", "intrigue", "gate", "duel"];

export interface CnQuest {
  id: number;
  book: number;
  step: number;
  kind: CnKind;
  arc: "main" | "side";
  title: string;
  objective: string;
  /** Who she must speak to (an NPC key as it stands in the world). */
  npc?: string;
  count: number;
  /** The Great Dao argued (debate) or sat with (vigil). */
  dao?: GreatDaoId;
  /** The tie mediated, carried along (letter) or brought to light (intrigue). */
  tie?: string;
  /** The power a letter is carried from. */
  from?: string;
  foe?: CnFoeId;
  level: number;
  done: string;
  reward: { stones: number; cult: number };
}

// ----------------------------------------------------------------------------- who is who
/** The NPC key that answers for a power where it holds its seat (a throne's emperor, a sect's leader, the Azure Cloud's Elder Mo, the Concord's envoy), or its envoy at the Council. */
export function seatNpc(power: string): string {
  const t = COURTS.findIndex((C) => C.key === power);
  if (t >= 0) return courtEmperorKey(t);
  const s = COURTS.findIndex((C) => C.sect.key === power);
  if (s >= 0) return courtLeaderKey(s);
  if (power === "azure") return "elder";
  if (power === "concord") return "pe-envoy";
  return envoyKey(power);
}

const ENVOY_WHERE: Record<string, string> = { synod: "the western end of the Dawn Causeway", unfettered: "the Dawn Landing" };

/** Who answers to one of the Contention's NPC keys (or any other the tale sends her to): a name, a look, and where they are found. */
export function contentionPerson(key: string): { key: string; name: string; char: HumanId; where: string } {
  const m = /^cn-envoy-([a-z]+)$/.exec(key);
  if (m) {
    const p = powerOf(m[1]);
    return { key, name: p.envoy.name, char: p.envoy.char, where: ENVOY_WHERE[p.key] ?? "the City of Ten Seats" };
  }
  const seat = SEATS.find((x) => x.key === key);
  if (seat) return { key, name: seat.name, char: seat.char, where: "the City of Ten Seats" };
  if (key === SPEAKER.key) return { ...SPEAKER, where: "the City of Ten Seats" };
  if (key === KEEPER.key) return { ...KEEPER, where: "the Valley of Sunrise" };
  if (key === FENG.key) return { ...FENG, where: "Wuji" };
  if (key === "elder") return { key, name: "Elder Mo", char: "elder", where: "the Azure Cloud Sect" };
  if (key === "pe-envoy") return { key, name: "Envoy Shan", char: "concordenvoy", where: "the Concord Stone" };
  return courtsPerson(key);
}

/** The Seat (or the voice) a Great Dao is argued with. */
function debater(dao: GreatDaoId): string {
  if (dao === "void") return SPEAKER.key;
  if (dao === "lifedeath") return envoyKey("ninesprings");
  return SEATS.find((s) => s.dao === dao)!.key;
}

// ----------------------------------------------------------------------------- the shape of the tale
const id = (book: number, step: number) => book * CN_BOOK + step;
const GATE = 70;
const INTRIGUE_AT = [22, 52, 95];
/** Between the beats, a round of ten that comes back again and again. */
const ROUND: CnKind[] = ["debate", "letter", "hunt", "mediate", "vigil", "debate", "letter", "hunt", "mediate", "letter"];
/** How deep she must understand a Great Dao to argue her own reading of it, book by book. */
export const OWN_NEEDS = [1, 1, 2, 2, 2, 3];

const levelFor = (book: number, step: number) => 8 + book * 2 + (step > GATE ? 1 : 0);
const rewardFor = (book: number, main: boolean) => ({ stones: 40 + book * 15 + (main ? 20 : 0), cult: main ? 0.07 : 0.045 });

const LETTER_TITLES = ["A Sealed Letter", "Words Between Courts", "The Courier's Road", "A Letter Under Two Seals", "An Answer Awaited", "A Reply in Plain Ink", "Carried by Hand", "Not to Be Opened"];
const MEDIATE_TITLES = ["A Quarrel Before the Council", "Two Banners, One Bench", "Old Grievances", "Terms to Be Found", "The Witness Is Asked", "A Dispute Brought to Fusang", "Between Two Oaths", "Neither Will Yield"];
const DEBATE_TITLES = ["A Debate of the Dao", "On the Meaning of", "The Seat Argues", "Reading Against Reading", "A Question in the Square", "Disputation"];
const VIGIL_TITLES = ["A Vigil Under the Fusang Tree", "Sitting With What Was Done", "Dawn Comes Late", "The Leaves That Fall Green", "A Night in the Roots"];
const HUNT_TITLES = ["Trouble on the Road", "Hounds in the Hills", "What the Writs Sent", "Clear the Way", "Ambush at Dusk"];

const pick = <T,>(list: T[], book: number, step: number, salt: number) => list[Math.floor(hash2(book, step, salt) * list.length)];

/** Every tie the round's mediations and letters go round (all of them, a different start for each book). */
const tieAt = (book: number, n: number) => TIES[(book * 7 + n * 5) % TIES.length];

function build(): CnQuest[] {
  const out: CnQuest[] = [];
  for (let book = 0; book < CN_BOOKS; book++) {
    const B = CONTENTION_BOOKS_TEXT[book];
    let debates = 0;
    let ties = 0;
    for (let step = 0; step < CN_BOOK; step++) {
      const base = { id: id(book, step), book, step, level: levelFor(book, step), count: 1 };
      const beat = B.beats.find((b) => b.step === step);
      if (beat) {
        out.push({ ...base, kind: "beat", arc: "main", title: beat.title, objective: beat.objective, npc: beat.npc, done: beat.done, reward: rewardFor(book, true) });
        continue;
      }
      if (step === GATE) {
        out.push({ ...base, kind: "gate", arc: "main", title: "The Council Waits", objective: `The Council will not hear a Witness below ${realmLabel(...realmAtLevel(base.level + 1))}. Cultivate.`, level: base.level + 1, done: "Her realm has caught up with what the Council asks of her Witness.", reward: rewardFor(book, true) });
        continue;
      }
      if (step === CN_BOOK - 1) {
        const boss = ENEMIES[CN_BOSSES[book]];
        out.push({ ...base, kind: "duel", arc: "main", title: boss.name, objective: `${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}. Face them.`, done: B.boss.victory, reward: { stones: 200 + book * 60, cult: 0.2 } });
        continue;
      }
      const k = INTRIGUE_AT.indexOf(step);
      if (k >= 0) {
        const t = tieByKey(B.intrigues[k])!;
        const a = powerOf(t.a);
        const b = powerOf(t.b);
        // the truth is learned from whoever is likeliest to let it slip: the weaker end of the tie, at its own seat
        const npc = seatNpc(a.kind === "synod" ? b.key : a.key);
        out.push({ ...base, kind: "intrigue", arc: "main", title: `What Lies Between ${short(a.name)} and ${short(b.name)}`, objective: `Everyone knows ${lower(t.face)} Not everyone believes it. Ask ${contentionPerson(npc).name} at ${contentionPerson(npc).where}.`, npc, tie: t.a + "~" + t.b, done: `She learns what really lies between ${a.name} and ${b.name}.`, reward: rewardFor(book, true) });
        continue;
      }
      const kind = ROUND[step % ROUND.length];
      if (kind === "debate") {
        const dao = GREAT_DAO_IDS[(book * 3 + debates++) % GREAT_DAO_IDS.length];
        const npc = debater(dao);
        out.push({ ...base, kind, arc: "main", dao, npc, title: `${pick(DEBATE_TITLES, book, step, 911)}: ${GREAT_DAOS[dao].name}`, objective: `${contentionPerson(npc).name} will argue the ${GREAT_DAOS[dao].name} (${GREAT_DAOS[dao].hanzi}) with the Witness at ${contentionPerson(npc).where}.`, done: `She argues the ${GREAT_DAOS[dao].name} before the Synod.`, reward: rewardFor(book, true) });
      } else if (kind === "mediate") {
        const t = tieAt(book, ties++);
        const npc = envoyKey(t.a);
        out.push({ ...base, kind, arc: "main", tie: t.a + "~" + t.b, npc, title: pick(MEDIATE_TITLES, book, step, 912), objective: `${short(powerOf(t.a).name)} and ${short(powerOf(t.b).name)} have brought their ${t.kind === "coldpeace" ? "cold peace" : t.kind} before the Council, and ask the Witness to hear it. ${contentionPerson(npc).name} waits at ${contentionPerson(npc).where}.`, done: `She hears ${powerOf(t.a).name} and ${powerOf(t.b).name} out before the Council.`, reward: rewardFor(book, true) });
      } else if (kind === "letter") {
        const t = tieAt(book, ties++ + 3);
        const npc = seatNpc(t.b);
        out.push({ ...base, kind, arc: "side", tie: t.a + "~" + t.b, from: t.a, npc, title: pick(LETTER_TITLES, book, step, 913), objective: `${powerOf(t.a).envoy.name} has given the Witness a letter for ${contentionPerson(npc).name}, at ${contentionPerson(npc).where}. Carry it.`, done: `She carries a letter from ${powerOf(t.a).name} to ${powerOf(t.b).name}.`, reward: rewardFor(book, false) });
      } else if (kind === "vigil") {
        out.push({ ...base, kind, arc: "side", dao: B.dao, npc: KEEPER.key, title: pick(VIGIL_TITLES, book, step, 914), objective: `Sit a night's vigil under the Fusang tree with Keeper Hou Qing, and let your Dao heart settle (it will deepen your grasp of the ${GREAT_DAOS[B.dao].name}).`, done: "She sits the night out in the roots of the Fusang tree, and the dawn finds her steadier.", reward: rewardFor(book, false) });
      } else {
        const foe = CN_FOES[book];
        const n = 3 + (step % 3);
        out.push({ ...base, kind: "hunt", arc: "side", foe, count: n, title: pick(HUNT_TITLES, book, step, 915), objective: `Beat ${n} ${ENEMIES[foe].name}s ${HUNT_WHERE[book]}.`, done: `The ${ENEMIES[foe].name}s are driven off ${HUNT_WHERE[book]}.`, reward: rewardFor(book, false) });
      }
    }
  }
  return out;
}
const HUNT_WHERE = ["on the road to the Hall of Writs", "in the dunes south of Longcheng", "on the hills above Wuji", "round the Hall of Writs", "in the Valley of Sunrise", "about the City of Ten Seats"];
const short = (name: string) => name.replace(/^the /, "").replace(/ of the Sea of Pearls$/, "").replace(/^Courts of the /, "");
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

let all: CnQuest[] | null = null;
export function contentionQuests(): CnQuest[] {
  return (all ??= build());
}
export const contentionQuestAt = (n: number) => contentionQuests()[n];

// ----------------------------------------------------------------------------- the save
export const contentionDone = (g: GameState) => Math.max(0, Math.min(CONTENTION_COUNT, g.counters.cn ?? 0));
const progress = (g: GameState) => g.counters.cnp ?? 0;

/** Mei Zhao waits at the causeway for a cultivator of Core Formation who has met Elder Mo and Village Head Zhou (the far roads are open). */
export const contentionOpen = (g: GameState) => !!g.flags.metElder && !!g.flags.metZhou && (levelIndex(g.realm, g.stage) >= 8 || contentionDone(g) > 0);

export function currentContention(g: GameState): CnQuest | null {
  if (!contentionOpen(g)) return null;
  const n = contentionDone(g);
  return n < CONTENTION_COUNT ? contentionQuestAt(n) : null;
}
export const strongEnough = (g: GameState, q: CnQuest) => levelIndex(g.realm, g.stage) >= q.level;

/** Bring the Contention's flags in line with the tale: which book is hers, whether its trouble is out, and who is where. */
export function syncContentionFlags(g: GameState): GameState {
  const n = contentionDone(g);
  const going = contentionOpen(g) && n < CONTENTION_COUNT;
  const book = Math.min(CN_BOOKS - 1, Math.floor(n / CN_BOOK));
  const step = n % CN_BOOK;
  const flags: Record<string, boolean> = { ...g.flags, "cn:begun": n >= 1, "cn:done": n >= CONTENTION_COUNT, "cn:open": contentionOpen(g) };
  for (let k = 0; k < CN_BOOKS; k++) {
    flags[`cn:book:${k}`] = going && book === k;
    flags[`cn:boss:${k}`] = going && book === k && step === CN_BOOK - 1;
  }
  // Qiao Ling is in the Inquisition's cells from Bai Lü's arrest until the Hall road is cleared
  flags["cn:qiaotaken"] = n > id(0, 105) && n < id(1, 0);
  return Object.keys(flags).some((k) => !!flags[k] !== !!g.flags[k]) ? { ...g, flags } : g;
}

export function completeContention(g: GameState, qid: number): GameState {
  if (contentionDone(g) !== qid) return g;
  const q = contentionQuestAt(qid);
  let s: GameState = { ...g, counters: { ...g.counters, cn: qid + 1, cnp: 0 }, stones: g.stones + q.reward.stones };
  s = gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * q.reward.cult)).state;
  return syncContentionFlags(s);
}
const advance = (g: GameState, by = 1): GameState => ({ ...g, counters: { ...g.counters, cnp: progress(g) + by } });

// ----------------------------------------------------------------------------- the vote
export type CnOutcome = "charter" | "strike" | "amended" | "signed";

/** The Seats she has turned (each beat that turns one leaves its mark), and the powers that will vote with her. */
export function councilCount(g: GameState): { seats: number; powers: number; against: number } {
  const f = g.flags;
  const seats = [f["cn:qiulan"], true /* fire */, true /* thunder */, f["cn:windmet"] || f["cn:windwavers"], true /* earth, once the eleventh writ is found */, f["cn:fate:2:balance"] || f["cn:fate:2:mercy"], f["cn:speakerheard"] || f["cn:middleroad"]].filter(Boolean).length;
  const powers = POWERS.filter((p) => standing(g, p.key) >= 2).length;
  const against = POWERS.filter((p) => standing(g, p.key) <= -3).length;
  return { seats, powers, against };
}

/** What the Council decides: what she proposed, carried or not by the Seats she turned, the powers that trust her and how warm the web runs. */
export function councilOutcome(g: GameState): CnOutcome {
  const f = g.flags;
  if (f["cn:proposed:sign"]) return "signed";
  const { seats, powers, against } = councilCount(g);
  const carried = seats >= 4 && powers - against >= 6 && webWarmth(g) >= -10;
  if (!carried) return "amended";
  return f["cn:proposed:strike"] ? "strike" : "charter";
}

const OUTCOME_LINES: Record<CnOutcome, string> = {
  charter: "The bowl is counted twice. White. The Ten Writs stand, and beside each, from today, every reading the Synod ever struck and every reading anyone brings: a Charter of a Hundred Daos. The Writ of Strange Blood is struck, by my own seal, in front of the peoples.",
  strike: "The bowl is counted twice. White. The Ten Writs are struck, all ten, and the eleventh with them. From today no Great Dao under heaven has a Writ. …I hope you know what you have done. I hope I am wrong about the suns.",
  amended: "The bowl is counted twice. Not enough white. The Ten Writs stand, unsigned by most of the west. The Writ of Strange Blood is struck, by my own seal, in front of the peoples. The struck readings will be read into the record, every one. It is not what you asked. It is not nothing.",
  signed: "The bowl is counted twice. Black. The Ten Writs are signed, under heaven, by everyone who would. The readings they strike will be struck everywhere. The Writ of Strange Blood alone is struck, by my own seal. …You argued my case better than I ever did, Witness. I find I cannot thank you.",
};

/** A line of the Contention with her standing filled in. */
export function fillContention(text: string, g: GameState): string {
  return text.replace(/\{vote\}/g, OUTCOME_LINES[councilOutcome(g)]);
}

// ----------------------------------------------------------------------------- how the tale speaks
const narr = (text: string): Step => ({ say: "narrator", text });
const speakerOf = (key: string): { char: HumanId; name: string } => {
  const p = contentionPerson(key);
  return { char: p.char, name: p.name };
};

function lineStep(l: BeatLine, g: GameState, book: number): Step {
  if (!Array.isArray(l)) return { anim: l.a === "hero" ? "hero" : l.a, name: l.n, wait: true };
  const [who, raw] = l;
  const text = fillContention(raw, g);
  if (who === "narr") return narr(text);
  if (who === "hero") return { say: "heroine", text };
  if (who === "cn-boss") return { say: ENEMIES[CN_BOSSES[book]].sprite as HumanId, name: ENEMIES[CN_BOSSES[book]].name, text };
  const s = speakerOf(who);
  return { say: s.char, name: s.name, text };
}

const leanToast = (d: DaoId): Step => ({ toast: `Your heart leans toward the ${DAOS[d].name} (${DAOS[d].hanzi})` });

/** Lean her heart (a Dao heart that walks deep wavers or steadies for it: see engine/dao.ts). */
const lean = (d: DaoId, by = 1): Step[] => [{ mutate: (s) => walkDao(s, d, by) }, leanToast(d)];

function finish(q: CnQuest, g: GameState): Step[] {
  const steps: Step[] = [{ mutate: (s) => completeContention(s, q.id) }, { toast: `The Contention ${q.id + 1}/${CONTENTION_COUNT} (${q.arc}): ${q.title} · +${q.reward.stones} spirit stones` }];
  const next = currentContention(completeContention(g, q.id));
  if (next && next.step === 0 && q.step !== 0) steps.push({ toast: `${CN_NUMERALS[next.book]}: ${CONTENTION_BOOKS_TEXT[next.book].title} · ${contentionPerson(next.npc!).name} waits at ${contentionPerson(next.npc!).where}` });
  return steps;
}

function notYet(q: CnQuest, who: { char: HumanId; name: string }): Step[] {
  const need = realmLabel(...realmAtLevel(q.level));
  return [{ say: who.char, name: who.name, text: `Not yet, Witness. The Council would not hear this from anyone below ${need}. Cultivate; the Daos have waited three thousand years.` }, { toast: `The Contention asks for ${need}` }];
}

function beatSteps(q: CnQuest, g: GameState): Step[] {
  const B = CONTENTION_BOOKS_TEXT[q.book];
  const b = B.beats.find((x) => x.step === q.step)!;
  const steps: Step[] = [{ emote: q.npc!, icon: "!" }, ...b.lines.map((l) => lineStep(l, g, q.book))];
  if (b.choice) {
    const options: Choice[] = b.choice.options.map((o) => ({
      label: o.label,
      hint: DAOS[o.heart].name,
      then: [...(o.effect ? [{ mutate: o.effect } as Step] : []), ...lean(o.heart), narr(fillContention(o.then, g)), lineStep(o.reply, g, q.book)],
    }));
    steps.push({ choose: options, prompt: b.choice.prompt });
  }
  steps.push(...(b.after ?? []).map((l) => lineStep(l, g, q.book)), narr(fillContention(b.done, g)));
  // the vote's outcome is written into the world's flags as it is read out
  if (q.book === CN_BOOKS - 1 && q.step === 125) steps.push({ mutate: (s) => ({ ...s, flags: { ...s.flags, [`cn:outcome:${councilOutcome(s)}`]: true } }) }, { toast: "The Great Council of the Daos has voted · see the Powers page of the Menu" });
  steps.push(...finish(q, g));
  if (q.id === 0) steps.push({ toast: "A new main quest: the Contention of the Daos · see the Journal (J) and the Powers page of the Menu" });
  if (q.step === CN_BOOK - 2) steps.push({ toast: `${ENEMIES[CN_BOSSES[q.book]].name} · ${HUNT_WHERE[q.book]}` });
  return steps;
}

/** A Dao debate: what she may say depends on what she truly understands. */
function debateSteps(q: CnQuest, g: GameState): Step[] {
  const dao = q.dao!;
  const W = WRITS[dao];
  const who = speakerOf(q.npc!);
  const need = OWN_NEEDS[q.book];
  const have = wuTier(g, dao);
  const can = have >= need;
  const Dao = GREAT_DAOS[dao];
  const own: Choice = can
    ? {
        label: "Speak from your own understanding",
        hint: `${Dao.name} · ${WU_TIERS[have - 1].name}`,
        then: [
          { anim: "hero", name: "mudra", wait: true },
          { say: "heroine", text: W.own },
          { mutate: (s) => comprehend(sway(sway({ ...s, flags: { ...s.flags, [`cn:charter:${dao}`]: true } }, "synod", 1), "unfettered", 1), dao, 1).state },
          { say: who.char, name: who.name, text: "…That is not the Writ. It is not the grey books' reading either. Say it again, slowly, so the clerks can take it down." },
          { toast: `A third reading of the ${Dao.name} is written into the record · your grasp of it deepens` },
        ],
      }
    : {
        label: "Speak from your own understanding",
        hint: `needs ${WU_TIERS[need - 1].name} of the ${Dao.name} (you are at ${have ? WU_TIERS[have - 1].name : "nothing yet"})`,
        then: [
          { anim: "hero", name: "daodoubt", wait: true },
          narr(`She opens her mouth to say what she understands of the ${Dao.name}, and finds she does not understand it well enough to say anything at all. The square waits. She sits down.`),
          { mutate: (s) => ({ ...s, counters: { ...s.counters, "dao:doubt": Math.min(30, daoDoubt(s) + 1) } }) },
          { toast: `You cannot argue a Dao you have not comprehended · sit at its shrines, read its steles` },
        ],
      };
  return [
    { emote: q.npc!, icon: "?" },
    { say: who.char, name: who.name, text: `The ${Dao.name}, Witness. ${W.writ}` },
    narr(`Someone at the back of the square calls out the struck reading, the one in Wuji's grey-board books: “${W.free}”`),
    {
      choose: [
        { label: "Uphold the Writ", hint: DAOS.balance.name, then: [{ mutate: (s: GameState) => sway(sway(s, "synod", 1), "unfettered", -1) } as Step, ...lean("balance"), { anim: "hero", name: "bow", wait: true }, { say: who.char, name: who.name, text: "Thank you. It is good to hear it from someone who did not have to say it." }] },
        { label: "Speak for the struck reading", hint: DAOS.sword.name, then: [{ mutate: (s: GameState) => sway(sway(s, "unfettered", 1), "synod", -1) } as Step, ...lean("sword"), { say: "heroine", text: W.free }, { say: who.char, name: who.name, text: "You know that has been struck. …Yes. Of course you know." }] },
        own,
        { label: "Silence the square with your sword intent", hint: DAOS.slaughter.name, then: [{ mutate: (s: GameState) => shift(sway(sway(s, "synod", -1), "unfettered", -1), CULT.demon, 2) } as Step, ...lean("slaughter"), { anim: "hero", name: "rebuke", wait: true }, narr("Her sword intent goes through the square like a cold wind, and nobody says anything else about the Dao for the rest of the afternoon.")] },
      ],
      prompt: `${Dao.name} (${Dao.hanzi}): what does the Witness say?`,
    },
    narr(q.done),
    ...finish(q, g),
  ];
}

/** Hearing out two powers: side with one, find terms, speak for those the quarrel hurts, or set them at each other. */
function mediateSteps(q: CnQuest, g: GameState): Step[] {
  const t = tieByKey(q.tie!)!;
  const A = powerOf(t.a);
  const Bp = powerOf(t.b);
  const who = speakerOf(q.npc!);
  const truth = tieKnown(g, t) && t.secret ? t.secret.truth : t.face;
  const terms = standing(g, A.key) + standing(g, Bp.key) >= -2;
  const side = (win: Tie["a"], lose: Tie["a"]): Step[] => [{ mutate: (s) => shiftTie(sway(sway(s, win, 1), lose, -1), t, -1) }];
  return [
    { emote: q.npc!, icon: "!" },
    { say: who.char, name: who.name, text: `Witness. ${A.name.charAt(0).toUpperCase() + A.name.slice(1)} asks you to hear us, against ${Bp.name}. You know what lies between us: ${lower(truth)}` },
    { anim: q.npc!, name: "rebuke", wait: true },
    {
      choose: [
        { label: `Side with ${short(A.name)}`, hint: DAOS.sword.name, then: [...side(A.key, Bp.key), ...lean("sword"), narr(`She hears both out and finds for ${A.name}. ${Bp.name.charAt(0).toUpperCase() + Bp.name.slice(1)} will remember it.`)] },
        { label: `Side with ${short(Bp.name)}`, hint: DAOS.sword.name, then: [...side(Bp.key, A.key), ...lean("sword"), narr(`She hears both out and finds for ${Bp.name}. ${A.name.charAt(0).toUpperCase() + A.name.slice(1)} will remember it.`)] },
        {
          label: "Find terms both can keep",
          hint: terms ? DAOS.balance.name : `${DAOS.balance.name} · neither trusts you enough yet`,
          then: terms ? [{ mutate: (s: GameState) => shiftTie(s, t, 1) } as Step, ...lean("balance"), { anim: "hero", name: "sealtreaty", wait: true }, narr(`She finds terms: small ones, the kind both can keep. ${A.name.charAt(0).toUpperCase() + A.name.slice(1)} and ${Bp.name} put their seals to them side by side.`)] : [...lean("balance"), narr("She proposes terms. Neither side trusts her enough to take them from her hand. They will have to come to it some other way.")],
        },
        { label: "Speak for the people their quarrel hurts", hint: DAOS.mercy.name, then: [{ mutate: (s: GameState) => shiftTie(s, t, 1) } as Step, ...lean("mercy"), narr("She does not take a side. She tells them, at length and by name, who has paid for their quarrel. It is a long list. By the end neither envoy will look at the other, and neither will look away.")] },
        { label: "Set them at each other, and watch", hint: DAOS.slaughter.name, then: [{ mutate: (s: GameState) => shift(shiftTie(s, t, -2), CULT.demon, 2) } as Step, ...lean("slaughter"), narr("She says exactly the wrong thing to each of them, very quietly. The quarrel will outlast them both.")] },
      ],
      prompt: `${short(A.name)} and ${short(Bp.name)} (${tieWarmthWord(tieWarmth(g, t))}): how does the Witness judge?`,
    },
    narr(q.done),
    ...finish(q, g),
  ];
}
const tieWarmthWord = (w: number) => ["at war", "bitter", "cold", "uneasy", "civil", "warm", "close"][Math.max(0, Math.min(6, w + 3))];

/** Bringing a tie's truth to light, and deciding what to do with it. */
function intrigueSteps(q: CnQuest, g: GameState): Step[] {
  const t = tieByKey(q.tie!)!;
  const who = speakerOf(q.npc!);
  const A = powerOf(t.a);
  const Bp = powerOf(t.b);
  return [
    { emote: q.npc!, icon: "..." },
    { say: who.char, name: who.name, text: `You've heard that ${lower(t.face)} …Sit down, Witness. Close the door.` },
    { anim: q.npc!, name: "whisper", wait: true },
    { say: who.char, name: who.name, text: t.secret!.truth },
    { mutate: (s) => revealTie(s, t) },
    { toast: `A secret of the powers comes to light: ${short(A.name)} and ${short(Bp.name)} · see the Powers page of the Menu` },
    {
      choose: [
        { label: "Keep it, and let them know you know", hint: DAOS.balance.name, then: [{ mutate: (s: GameState) => sway(sway(s, A.key, 1), Bp.key, 1) } as Step, ...lean("balance"), narr("She keeps it. Both of them learn, by the next post, that she knows and has not said. They are very polite to her after that.")] },
        { label: "Lay it before the Council", hint: DAOS.sword.name, then: [{ mutate: (s: GameState) => shiftTie(sway(sway(s, A.key, -2), Bp.key, -1), t, -1) } as Step, ...lean("sword"), narr("She lays it before the Council, plainly, in the square. The clerks write it into the record. The envoys of both look at the floor.")] },
        { label: "Use it to mend what it broke", hint: DAOS.mercy.name, then: [{ mutate: (s: GameState) => shiftTie(s, t, 1) } as Step, ...lean("mercy"), narr("She goes to each of them alone, with what she knows, and asks only that they make it right between themselves. One of them weeps. The other pretends not to have.")] },
        { label: "Sell it to their enemies", hint: DAOS.slaughter.name, then: [{ mutate: (s: GameState) => shift(shiftTie(sway(sway(s, A.key, -3), Bp.key, -3), t, -2), CULT.demon, 3) } as Step, ...lean("slaughter"), narr("She sells it to whoever will pay most. Somebody does. By winter the whole Council knows, and knows who sold it.")] },
      ],
      prompt: `What does the Witness do with what lies between ${short(A.name)} and ${short(Bp.name)}?`,
    },
    narr(q.done),
    ...finish(q, g),
  ];
}

const TALK_KINDS: CnKind[] = ["beat", "debate", "mediate", "intrigue", "letter", "vigil"];

/** What talking to this person does for the Contention right now (null when the quest she is on is not theirs). */
export function contentionTalk(key: string, g: GameState): Step[] | null {
  const q = currentContention(g);
  if (!q || q.npc !== key || !TALK_KINDS.includes(q.kind)) return null;
  const who = speakerOf(key);
  if (!strongEnough(g, q)) return notYet(q, who);
  switch (q.kind) {
    case "beat":
      return beatSteps(q, g);
    case "debate":
      return debateSteps(q, g);
    case "mediate":
      return mediateSteps(q, g);
    case "intrigue":
      return intrigueSteps(q, g);
    case "letter": {
      const from = powerOf(q.from!);
      return [{ anim: "hero", name: "envoy", wait: true }, { say: "heroine", text: `A letter from ${from.name}, by the Witness's hand.` }, { say: who.char, name: who.name, text: "…So they have finally put it in writing. Thank you, Witness. Tell them they will have an answer, and that it will be longer." }, narr(q.done), ...finish(q, g)];
    }
    case "vigil":
    default:
      return [
        { say: who.char, name: who.name, text: "Sit. Don't think about the Council. Think about the roots: they go down a very long way, and they don't argue." },
        { anim: "hero", name: "steadyheart", wait: true },
        { mutate: (s) => comprehend(steadyHeart(s, 3), q.dao!, 1).state },
        { toast: `Your Dao heart settles (${HEART_STATES[0].hanzi}) · the ${GREAT_DAOS[q.dao!].name} grows clearer` },
        narr(q.done),
        ...finish(q, g),
      ];
  }
}

export function contentionHasNews(key: string, g: GameState): boolean {
  const q = currentContention(g);
  return !!q && q.npc === key && TALK_KINDS.includes(q.kind);
}

/** The quest line for the HUD and the journal (null before Mei Zhao comes to the causeway). */
export function contentionLog(g: GameState, locked: (id: "harbor") => string | null = () => null): { chapter: string; title: string; objective: string; arc: "main" | "side" } | null {
  if (!contentionOpen(g)) return null;
  const n = contentionDone(g);
  if (n >= CONTENTION_COUNT) {
    const o = (["charter", "strike", "amended", "signed"] as CnOutcome[]).find((x) => g.flags[`cn:outcome:${x}`]) ?? "amended";
    return { chapter: "The Contention of the Daos", title: "The Council Has Spoken", objective: `All ${CONTENTION_COUNT} quests of the Contention are done. ${OUTCOME_SUMMARY[o]}`, arc: "main" };
  }
  const q = contentionQuestAt(n);
  const B = CONTENTION_BOOKS_TEXT[q.book];
  const chapter = `Contention · ${CN_NUMERALS[q.book]}: ${B.title}`;
  const title = `${n + 1}/${CONTENTION_COUNT} · ${q.arc === "main" ? "Main" : "Side"} · ${q.title}`;
  if (!strongEnough(g, q) && q.kind !== "gate") return { chapter, title, objective: `The Council would not hear its Witness below ${realmLabel(...realmAtLevel(q.level))}. You stand at ${realmLabel(g.realm, g.stage)}. Cultivate.`, arc: q.arc };
  const lock = locked("harbor");
  if (lock) return { chapter, title, objective: `The Dawn Causeway sets out from the coast past Wavecrest Harbour, which is still closed to you: ${lock}`, arc: q.arc };
  const prog = q.kind === "hunt" ? ` (${Math.min(q.count, progress(g))}/${q.count})` : "";
  return { chapter, title, objective: q.objective + prog, arc: q.arc };
}

const OUTCOME_SUMMARY: Record<CnOutcome, string> = {
  charter: "The Great Council wrote a Charter of a Hundred Daos: the Ten Writs stand beside every reading they once struck, and the Writ of Strange Blood is struck.",
  strike: "The Great Council struck all eleven Writs. No Great Dao under heaven has an owner, and nobody knows yet whether the suns will rise.",
  amended: "The Great Council struck the Writ of Strange Blood and read every struck reading into the record, but the Ten Writs stand.",
  signed: "The Great Council signed the Ten Writs under heaven. Only the Writ of Strange Blood was struck.",
};

const isFoe = (e: EnemyId): e is CnFoeId => (CN_FOES as readonly string[]).includes(e);
const isBoss = (e: EnemyId): e is CnBossId => (CN_BOSSES as readonly string[]).includes(e);

export function contentionHunt(g: GameState, enemy: EnemyId): { state: GameState; steps: Step[] | null; note: string | null } {
  const q = currentContention(g);
  if (!q || q.kind !== "hunt" || !isFoe(enemy) || q.foe !== enemy || !strongEnough(g, q)) return { state: g, steps: null, note: null };
  const s = advance(g);
  if (progress(s) >= q.count) return { state: s, steps: [narr(q.done), ...finish(q, s)], note: null };
  return { state: s, steps: null, note: `${q.title}: ${progress(s)}/${q.count}` };
}

/** Her realm has caught up: the book's second half opens by itself. */
export function contentionCultivated(g: GameState): Step[] | null {
  const q = currentContention(g);
  if (!q || q.kind !== "gate" || !strongEnough(g, q)) return null;
  return [narr(q.done), ...finish(q, g)];
}

// ----------------------------------------------------------------------------- each book's trouble
export function contentionPreBattle(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentContention(g);
  if (!q || q.kind !== "duel" || !isBoss(enemy) || CN_BOSSES[q.book] !== enemy) return null;
  const B = CONTENTION_BOOKS_TEXT[q.book];
  const steps: Step[] = [{ shake: 0.3 }, narr(`${B.boss.intro.charAt(0).toUpperCase() + B.boss.intro.slice(1)}.`), ...B.boss.words.map((l) => lineStep(l, g, q.book))];
  const d = dominantDao(g);
  if (d) steps.push({ say: "heroine", text: { sword: "Then we settle it with what we understand.", mercy: "Nobody has to be struck out today. Not even you.", balance: "Let's find out which reading the Dao itself prefers.", slaughter: "You stood in my road." }[d] });
  return steps;
}

export function contentionVictory(enemy: EnemyId, g: GameState): Step[] | null {
  const q = currentContention(g);
  if (!q || q.kind !== "duel" || !isBoss(enemy) || CN_BOSSES[q.book] !== enemy) return null;
  const B = CONTENTION_BOOKS_TEXT[q.book];
  const last = q.id === CONTENTION_COUNT - 1;
  const options: Choice[] = B.boss.fates.map((f) => {
    const dark = f.heart === "slaughter";
    // what she does to the book's foe the powers hear of: the Synod for the Synod's own, the Unfettered and the peoples for theirs
    const fx: Record<number, (s: GameState) => GameState> = {
      0: (s) => sway(s, "synod", dark ? -2 : 1),
      1: (s) => sway(sway(s, "yan", f.heart === "sword" ? -3 : f.heart === "balance" ? 1 : dark ? -1 : 2), "liang", f.heart === "sword" ? 2 : 0),
      2: (s) => sway(sway(s, "unfettered", dark ? 1 : 2), "synod", dark ? -3 : f.heart === "sword" ? -1 : 1),
      3: (s) => sway(sway(s, "concord", dark ? 0 : 2), "orthodox", f.heart === "mercy" ? 1 : -1),
      4: (s) => (dark ? comprehend(comprehend(s, "void", 6, true).state, "lifedeath", 6, true).state : sway(s, "synod", 1)),
      5: (s) => sway(s, "synod", dark ? -5 : f.heart === "balance" ? 3 : 1),
    };
    return {
      label: f.label,
      hint: DAOS[f.heart].name,
      then: [
        { mutate: (s) => fx[q.book](dark ? shift(s, CULT.demon, 6) : s) },
        ...lean(f.heart, 3),
        { mutate: (s) => ({ ...s, flags: { ...s.flags, [`cn:fate:${q.book}`]: true, [`cn:fate:${q.book}:${f.heart}`]: true } }) },
        narr(f.line),
        ...finish(q, g),
        { mutate: (s) => heal(s, 9999, 9999) },
        { anim: "hero", name: dark ? "roar" : "comprehend", wait: true },
        narr(B.boss.victory),
        ...(last ? contentionEnd(g) : [{ toast: `${CN_NUMERALS[q.book]} is done: ${B.title}` } as Step]),
      ],
    };
  });
  return [{ anim: "hero", name: "victory", wait: true }, { choose: options, prompt: `${ENEMIES[enemy].name} is beaten. What now?` }];
}

function contentionEnd(g: GameState): Step[] {
  const steps: Step[] = [
    narr("The square of the Ten Seats empties slowly, envoy by envoy, back across the Strait of Dawn and out over the Sea of Pearls and up into the sky. Keeper Hou Qing, up in the Valley of Sunrise, counts the dawn the next morning, and writes the number down, and looks at it for a long time."),
    { toast: "The Contention of the Daos is done" },
    { mutate: (s: GameState) => syncContentionFlags(s) },
  ];
  if (g.flags["cn:outcome:signed"]) steps.push({ toast: "The Ten Writs are signed under heaven" });
  return steps;
}

// ----------------------------------------------------------------------------- the people of Fusang between quests
const IDLE: Record<string, string[]> = {
  [SPEAKER.key]: ["The Void holds everything, Witness. Mostly it holds paperwork.", "Ten seats. Nine voices. One chair with a cloth over it. I count them every morning.", "When I was a girl, the dawn came up over the tree like a gong. Now it comes up like a cough."],
  [KEEPER.key]: ["Mind the roots. They don't mind you.", "Three hundred and four years of numbers, and the Synod has never once asked to see them.", "Every leaf that falls green, I write down. My ink costs more than my rice."],
  [FENG.key]: ["Wind's from the south today. Out of season. Arrest me.", "Every door in Wuji has a struck reading painted on it. Mine says: the wind has no owner. It's spelled wrong. On purpose.", "Ling Shuang and I used to argue the Dao all night. I miss it more than the Seat."],
};
const FOLK_LINES: Record<string, string[]> = {
  "cn-folk-clerk1": ["Forty years copying the Writ of Water. I have never once seen the sea.", "Third copy of the commentary today. The commentary on the commentary is worse."],
  "cn-folk-clerk2": ["We keep the struck readings too, you know. In the cellar. For reference. Nobody is allowed to reference them."],
  "cn-folk-clerk3": ["Every word of the Council is written down twice. Once for the record. Once in case the record is struck."],
  "cn-folk-sweeper": ["Leaves from the Fusang tree, every morning, all the way down here. Never used to. Green ones."],
  "cn-folk-tea": ["Tea, Witness? It's the Writ-approved blend. The other one's better, but I'd have to whisper."],
  "cn-folk-child": ["My mother says when I grow up I can hold a Seat. I want the empty one. It has the nicest cloth."],
  "cn-folk-guard1": ["Move along, please. No readings in the square without a clerk present."],
  "cn-folk-guard2": ["The Hall of Writs is closed to everyone. Except clerks. And inquisitors. And you, apparently."],
  "cn-folk-inquisitor": ["I've read every struck reading in the cellar. For the work. Some of them are beautiful. That's the problem."],
  "cn-folk-archivist": ["The archive goes down nine floors. The bottom floor has one shelf. I am not allowed on the bottom floor."],
  "cn-folk-pilgrim1": ["I walked from the north coast to see the sun come up through the tree. It came up late. I waited."],
  "cn-folk-pilgrim2": ["Amituofo. The tree is very old and very hungry. So am I. We sit together."],
  "cn-folk-gardener": ["I rake the fallen leaves into heaps and the Keeper counts them. Neither of us likes the number."],
  "cn-folk-potter": ["The Writ says earth bears and does not move. I'm a potter. Earth moves on my wheel all day. They exiled me for saying so."],
  "cn-folk-poet": ["“O Wind, O Wind, out of season blowing…” Don't go! There are nine more verses."],
  "cn-folk-sailor1": ["Grey sail, grey board, grey hair. Wuji's very loyal to a colour."],
  "cn-folk-sailor2": ["Rice in, books out. Don't ask which ones. All of them."],
  "cn-folk-fisher": ["I read water as something that pushes back. The Synod said that was un-water. The fish didn't seem to mind."],
  "cn-folk-meilan": ["My sister carries the Synod's letters. I've had one a month for twelve years. Tell her the beans came up. She'll understand."],
  "cn-folk-ferry": ["Toll's a copper each way. Ghost on the eleventh span is free. It's a loose plank."],
};

const TOWN_LINES: Record<string, string[]> = {
  clerk: ["The commentary on the Writ of Wood is longer than the forest it's about.", "Third copy today. If I misspell a single word it counts as a reading. They'd strike it.", "I'm not allowed to have opinions until I'm forty. Then I'm allowed one."],
  reader: ["I read the Writs aloud in the square at noon. Nobody listens. That's how you know it's working.", "They say the struck readings are beautiful. I wouldn't know. I'm told I wouldn't know."],
  merchant: ["Ink, brushes, seals, sealing wax. The Council's coming; I'll sell more ink this month than in ten years.", "Grey-board books? Never heard of them. Come back after dark."],
  tea: ["Writ-approved tea, Witness. Steeped exactly as long as the Writ of Water allows.", "My grandmother read Fire the wrong way. Her tea was better."],
  porter: ["Twenty-two banners to carry up to the square. Every one heavier than the last.", "The envoys bring a great deal of luggage for people who only came to argue."],
  weaver: ["Ten parasols for the ten seats, rewoven every spring. The Life-and-Death one never gets sat under. Still gets rewoven.", "The silk comes from Chen. Don't tell the Synod. Everything comes from somewhere you're not supposed to say."],
  cook: ["Dumplings, eight fillings, one for each Seat that's speaking to the others this week.", "The Speaker eats plain rice. Every day. You'd think the Void would want something."],
  sweeper: ["Green leaves, all the way down from the valley. Never used to come this far.", "I sweep the square, they write the Writs. Somebody has to keep the ground clear for all that certainty."],
  warden: ["Keep to the paving, please. The grass belongs to the Seat of Wood.", "No readings in the square without a clerk present."],
  child: ["I can say all ten Writs backwards! Wollah... wollah... I forget the rest.", "Mother says if I read Water wrong I'll get put on a boat. I'd like a boat."],
  fisher: ["Water pushes back, Witness. Any fisher can tell you. They exiled me for saying it in a poem.", "Best fishing in Fusang, off Wuji. The fish here don't know they're heretic fish."],
  sailor: ["Grey sail up at dusk, down at dawn. The Inquisition's launches don't like the dark.", "I sailed for the Synod once. Now I sail for whoever can read."],
  smith: ["They said metal is refined or it isn't metal. I make ploughs out of ore. They plough.", "Every blade I forge here has a struck reading cut into the tang. Nobody looks there."],
  copyist: ["One copy for us, one for the next boat, one for the day the Synod wants them back.", "This is the Writ of Ice's losing side. Three hundred years old. Still warm."],
  pilgrim: ["I walked from the north coast to see the sun come up through the tree. It came up late. I waited.", "They say the dawn comes a breath later every spring. I came while there was still some."],
};
const COUNCIL_TALK: Record<CnOutcome, string> = {
  charter: "Did you hear? Every reading, side by side. My grandmother's too. I read it out loud in the square and nobody stopped me.",
  strike: "No Writs. None. The clerks don't know what to copy any more. I've never seen them so happy and so frightened.",
  amended: "They struck the eleventh writ, anyway. And they read the struck readings into the record. That's something. That's a lot, here.",
  signed: "Signed, everywhere. Everyone knows what everything means now. It's very quiet.",
};

/** What the Contention's people say when the tale has nothing for them; the envoys say how their powers see her. */
export function contentionNpcScript(key: string, g: GameState): Step[] | null {
  const day = contentionDone(g) + key.length;
  const town = parseFusangTownKey(key);
  if (town !== null) {
    const f = fusangTown(town);
    const outcome = (["charter", "strike", "amended", "signed"] as CnOutcome[]).find((x) => g.flags[`cn:outcome:${x}`]);
    const lines = TOWN_LINES[f.trade] ?? TOWN_LINES.pilgrim;
    return [{ say: f.char, name: f.name, text: outcome && (town + day) % 2 === 0 ? COUNCIL_TALK[outcome] : lines[(town + day) % lines.length] }];
  }
  const m = /^cn-envoy-([a-z]+)$/.exec(key);
  if (m) {
    const p = powerOf(m[1]);
    const v = standing(g, p.key);
    const s = standingName(v);
    const who = { char: p.envoy.char, name: p.envoy.name };
    return [
      { say: who.char, name: who.name, text: `${p.name.charAt(0).toUpperCase() + p.name.slice(1)} holds: “${p.doctrine}”` },
      { say: who.char, name: who.name, text: v >= 4 ? `${short(p.name)} counts you a friend, Witness (${s.name}, ${s.hanzi}). Do not make me regret telling you so.` : v <= -3 ? `${short(p.name)} has not forgotten you, Witness (${s.name}, ${s.hanzi}). Say what you came to say.` : `${short(p.name)} is watching you, Witness (${s.name}, ${s.hanzi}), as it watches everyone.` },
    ];
  }
  const seat = SEATS.find((x) => x.key === key);
  if (seat) {
    const W = WRITS[seat.dao];
    return [{ say: seat.char, name: seat.name, text: [W.writ, `I hold the Seat of the ${GREAT_DAOS[seat.dao].name.replace(/^Dao of (the )?/, "")}. Do you understand it, Witness? ${wuTier(g, seat.dao) ? "A little, I see. That is how it begins." : "Not yet, I see. Nobody does, at first."}`][day % 2] }];
  }
  const idle = IDLE[key] ?? FOLK_LINES[key];
  if (!idle) return null;
  const who = contentionPerson(key.startsWith("cn-folk-") ? SPEAKER.key : key);
  const folk = key.startsWith("cn-folk-");
  return [{ say: folk ? "narrator" : who.char, name: folk ? undefined : who.name, text: idle[day % idle.length] }];
}

/** The Contention in the journal: each book, whether it is done, and what she made of its trouble. */
export function contentionChronicle(g: GameState): { book: string; hanzi: string; state: "unknown" | "going" | "done"; fate: string | null }[] {
  const n = contentionDone(g);
  return CONTENTION_BOOKS_TEXT.map((B, k) => {
    const state = n >= id(k + 1, 0) ? "done" : n >= id(k, 0) && contentionOpen(g) ? "going" : "unknown";
    const heart = (["mercy", "sword", "balance", "slaughter"] as DaoId[]).find((d) => g.flags[`cn:fate:${k}:${d}`]);
    return { book: `${CN_NUMERALS[k]}: ${B.title}`, hanzi: B.hanzi, state, fate: heart ? B.boss.fates.find((f) => f.heart === heart)!.line : null };
  });
}

/** One line for the tale's epilogue, once the Council has spoken. */
export function contentionEpilogue(g: GameState): string | null {
  if (contentionDone(g) < CONTENTION_COUNT) return null;
  const o = (["charter", "strike", "amended", "signed"] as CnOutcome[]).find((x) => g.flags[`cn:outcome:${x}`]) ?? "amended";
  return {
    charter: "Across the Strait of Dawn, in the City of Ten Seats, the Charter of a Hundred Daos is read aloud every new moon, and the dawn reaches the Fusang tree a little earlier every spring.",
    strike: "In Fusang there are no Writs any more, and the Synod meets only to argue. Every spring Keeper Hou Qing counts the dawn, and it is earlier, and nobody yet has seen a second sun.",
    amended: "The Ten Writs still stand in the City of Ten Seats, unsigned by half the west; but the struck readings are read into the record every new moon, and the Writ of Strange Blood is ash.",
    signed: "Under heaven the Ten Writs are signed, and the Great Daos mean one thing each, everywhere. The Fusang tree has very few leaves. Nobody burns.",
  }[o];
}

/** What the Dao heart's state is called, for the journal. */
export const heartLabel = (g: GameState) => `${HEART_STATES[heartState(g)].name} (${HEART_STATES[heartState(g)].hanzi})`;
