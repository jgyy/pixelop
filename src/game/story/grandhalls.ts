import { cultivationNeeded } from "../engine/realms";
import { gainCultivation, setFlag, type GameState } from "../engine/state";
import type { HumanId } from "../art/characters";
import type { Step } from "./script";
import { getWorld } from "../world/continent";
import type { HallNpc } from "../world/grandhalls";

let npcIndex: Map<string, HallNpc> | null = null;
/** One of the halls' folk, by key. */
function hallNpc(key: string): HallNpc | undefined {
  npcIndex ??= new Map([...getWorld().npcs.filter((n) => n.key.startsWith("gh-")).map((n) => ({ ...n, storey: -1 })), ...getWorld().halls.flatMap((h) => h.npcs)].map((n) => [n.key, n] as [string, HallNpc]));
  return npcIndex.get(key);
}
/** A line from one of the halls' folk, in their own face and name. */
const own = (key: string, text: string): Step => {
  const n = hallNpc(key);
  return { say: n?.char ?? "villagerF", name: n?.name, text };
};

/**
 * The folk of the sects' grand halls (see world/sectHalls.ts), and the two
 * quests that send her running after people who will not stand still:
 *
 *  - Three Overdue Scrolls: Librarian Wen of the Pavilion of Drifting
 *    Scriptures wants three scrolls back from three borrowers, one walking
 *    the lecture hall, one the stacks and one the starwatch gallery;
 *  - The Relay of Answers: Steward Pan of the Hall of Ten Thousand Debates
 *    has a question from the refectory that must go up to Debater Ji, who
 *    argues walking, and on up to Furnace Master Rong, who answers by
 *    burning things, and the answer must come back down.
 *
 * Every step is a story flag, so none of it needs a new save version.
 */

const flag = (...names: string[]): Step => ({ mutate: (s) => names.reduce((a, n) => setFlag(a, n), s) });
const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });
const hero = (text: string): Step => ({ say: "heroine", text });
const cult = (k: number): Step => ({ mutate: (s) => gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * k)).state });
const stones = (n: number): Step => ({ mutate: (s) => ({ ...s, stones: Math.max(0, s.stones + n) }) });
const pills = (h: number, q: number): Step => ({ mutate: (s) => ({ ...s, pills: { heal: Math.min(99, s.pills.heal + h), qi: Math.min(99, s.pills.qi + q) } }) });

function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills) % lines.length];
}

const BORROWERS = ["gh-borrow1", "gh-borrow2", "gh-borrow3"] as const;
const scrollFlag = (n: number) => `cj:s${n}`;
const returned = (f: Record<string, boolean>) => BORROWERS.filter((_, n) => f[scrollFlag(n + 1)]).length;

/** Whether one of the halls' folk has something new to say (null for anyone else). */
export function grandHallHasNews(key: string, g: GameState): boolean | null {
  const f = g.flags;
  switch (key) {
    case "gh-wen":
      return !f["cj:asked"] || (returned(f) === 3 && !f["cj:done"]);
    case "gh-borrow1":
    case "gh-borrow2":
    case "gh-borrow3":
      return !!f["cj:asked"] && !f[scrollFlag(BORROWERS.indexOf(key) + 1)];
    case "gh-pan":
      return !f["wl:asked"] || (!!f["wl:rong"] && !f["wl:done"]);
    case "gh-ji":
      return !!f["wl:asked"] && !f["wl:ji"];
    case "gh-rong":
      return !!f["wl:ji"] && !f["wl:rong"];
    default:
      return key.startsWith("gh-") ? false : null;
  }
}

/** A line for the quest log while one of the halls' quests is under way. */
export function grandHallErrand(f: Record<string, boolean>): string | null {
  if (f["cj:asked"] && !f["cj:done"]) {
    const n = returned(f);
    return n < 3 ? `Three Overdue Scrolls: catch the borrowers walking the Pavilion of Drifting Scriptures' three floors (${n}/3), east of the Azure Cloud Sect.` : "Three Overdue Scrolls: take the scrolls back to Librarian Wen by the Pavilion's door.";
  }
  if (f["wl:asked"] && !f["wl:done"]) {
    if (!f["wl:ji"]) return "The Relay of Answers: carry the refectory's question up to Debater Ji, pacing the Hall of Ten Thousand Debates' second floor.";
    if (!f["wl:rong"]) return "The Relay of Answers: take Ji's counter-question up to Furnace Master Rong on the furnace loft.";
    return "The Relay of Answers: bring the talisman back down to Steward Pan in the refectory.";
  }
  return null;
}

// ----------------------------------------------------------------------------- conversations
export function grandHallNpcScript(key: string, g: GameState): Step[] | null {
  if (!key.startsWith("gh-")) return null;
  const f = g.flags;
  switch (key) {
    case "gh-wen":
      return librarianWen(g);
    case "gh-borrow1":
      return borrower(g, 1, "outerM", "Disciple Hao", "The Sutra of Still Water, with Commentary", [
        "Overdue? It can't be. I only borrowed it in… spring. Last spring. Ah.",
        "I've been walking laps of the lecture hall reading it. Master Lu says you can't hear a lecture properly sitting down. Master Lu did not say that. I say that.",
      ]);
    case "gh-borrow2":
      return borrower(g, 2, "outerF", "Disciple Ruo", "A Field Guide to Spirit Herbs, Volume Three", [
        "Librarian Wen sent you? Up two flights of stairs after one book? She must really want it.",
        "I kept it because volume four is missing and I didn't want to lose my place. I suppose that isn't a reason. Here.",
      ]);
    case "gh-borrow3":
      return borrower(g, 3, "discipleF", "Senior Sister Lianyi", "The Founder's Star Charts", [
        "I walk while I read the charts. The stars move, so it seems only fair.",
        "Tell Librarian Wen I found the founder's birth star. Tell her it was exactly where it always is. She'll laugh. Probably.",
      ]);
    case "gh-pan":
      return stewardPan(g);
    case "gh-ji":
      return debaterJi(g);
    case "gh-rong":
      return furnaceRong(g);
    case "gh-lu":
      return [named("wdherald", "Master Lu of the Scriptures", pick(g, ["…and so the founder wrote: “Do not believe a word I say. Test it.” Which means, disciples, that you should also test that.", "You at the back, with the sword: this is a lecture hall, not a sword yard. Sit, listen, and let your qi settle like silt in a bowl.", "A scripture is only ink until someone lives it. Then it is still ink, but it has been somewhere."]))];
    case "gh-xi":
      return [named("monk", "Elder Xi of the Starwatch", pick(g, ["The stars over the sect have not changed in nine hundred years. I come up here every night to make sure.", "Sit, if you like. The cushion by the window is warmest. Breathe out until there is nothing left, and see what the night breathes back.", f.heartReturned ? "The Heart is home. Even the stars look settled. Or perhaps I do." : "Something is missing from the sect. The stars know it. I can feel them looking."]))];
    case "gh-arb":
      return [named("envoy", "Arbiter Sun of the Ten Halls", pick(g, ["I have judged ten thousand debates. Every one of them was about the same thing: what to do with the time we have. Nobody ever wins that one.", "The rule of this floor: the loser says the winner's argument back, better. Half my disciples lose on purpose, to practise.", "You may speak on this floor if you have a question. Answers are not admitted without a question attached."]))];
    case "gh-sweep":
    case "gh-mop":
      return [own(key, pick(g, ["One more lap and the floor is clean. Then everyone walks on it and I start again. Master says that's the Dao. I say it's the floor.", "Mind the wet tiles! Not those. Those. Too late.", "I'm on my rounds. Sweeping is a cultivation method, they told me. I'm on my nine-hundredth round and I still can't fly."]))];
    case "gh-tea":
    case "gh-serve1":
    case "gh-serve2":
      return [own(key, pick(g, ["Tea? No? I'll come round again. I always come round again.", "Excuse me, coming through! Hot! Hot! Mostly hot!", "Forty bowls up, forty bowls down, and someone always asks for forty-one."]))];
    case "gh-runner":
    case "gh-carry":
    case "gh-pace":
      return [own(key, pick(g, ["Can't stop, can't stop. If I stop I'll forget which shelf this goes on.", "Third trip up the stairs this hour. My legs are cultivating faster than my dantian.", "Walking helps me think. Thinking helps me walk. It's a very small circle, but it's mine."]))];
    default:
      return [own(key, pick(g, ["Shh. Some of us are trying to read. Or sleep. Mostly read.", "Three floors and they still haven't got enough room for every book. Or every argument.", "You're Lin Yue! I read about you! Well, I read a note someone pinned up about you. It was very complimentary. Mostly.", "Every floor of this hall has its own weather. Ground floor: draughty. Second floor: stuffy. Top floor: holy, and also draughty.", "If you're looking for the stairs, they're where everyone is going. If you're looking for quiet, they're where everyone is coming from."]))];
  }
}

function librarianWen(g: GameState): Step[] {
  const f = g.flags;
  const W = (text: string) => named("archivist", "Librarian Wen Su", text);
  if (!f["cj:asked"])
    return [
      W("You. You have the look of someone who walks quickly. Good. I have three scrolls out and three borrowers who will not sit still long enough to be scolded."),
      W("Disciple Hao reads walking laps of this hall. Disciple Ruo walks the stacks upstairs. Senior Sister Lianyi walks the starwatch gallery under the roof, because she says the stars move and so should she."),
      hero("You want me to chase them up and down three floors?"),
      W("I want my scrolls back. The chasing is your own affair. I will make it worth the stairs."),
      flag("cj:asked"),
      { toast: "Three Overdue Scrolls · catch the borrowers on each of the Pavilion's floors" },
    ];
  if (returned(f) < 3) return [W(`${returned(f)} of three. The others are still walking about with sect property under their arms. Up the stairs at the east end, then the west.`)];
  if (!f["cj:done"])
    return [
      W("All three. Hao's has a tea ring on it. Ruo's has a pressed leaf. Lianyi's has… are those star charts annotated in her own hand? Better than the founder's. Don't tell anyone I said that."),
      W("Your reward: spirit stones from the Pavilion's purse, two Qi pills from my own drawer, and something worth more: the run of the stacks. Read anything. Return it."),
      flag("cj:done"),
      stones(60),
      pills(0, 2),
      cult(0.3),
      { toast: "Three Overdue Scrolls complete · 60 spirit stones, 2 Qi Gathering Pills" },
    ];
  return [W(pick(g, ["The Pavilion's books are all home tonight. I can hear them breathing.", "Disciple Hao has borrowed another. I have given him until spring. Which spring, we did not discuss.", "If you ever write anything down, bring it here. The Pavilion keeps everything. Even the shopping lists."]))];
}

function borrower(g: GameState, n: number, who: HumanId, name: string, title: string, lines: [string, string]): Step[] {
  const f = g.flags;
  const B = (text: string) => named(who, name, text);
  if (!f["cj:asked"]) return [B(pick(g, ["Can't stop, I'm in the middle of a chapter. Walking helps it go in.", lines[0].replace(/^Overdue\? /, "")]))];
  if (f[scrollFlag(n)]) return [B(pick(g, ["I've already given it back! Look, empty hands. Well, a different book. Don't tell her.", "Still walking. Still reading. Still sorry."]))];
  return [B(lines[0]), B(lines[1]), flag(scrollFlag(n)), { toast: `Recovered: ${title} (${returned(f) + 1}/3)` }];
}

function stewardPan(g: GameState): Step[] {
  const f = g.flags;
  const P = (text: string) => named("steward", "Steward Pan of the Refectory", text);
  if (!f["wl:asked"])
    return [
      P("A cultivator with nothing in her hands. Good. Here: a question. The refectory asked it over supper and nobody down here can answer it."),
      P("“Is the fold of a dumpling its Dao, or only the way it keeps its filling in?” Take it up to Debater Ji on the second floor. He argues walking, so you will have to catch him."),
      hero("And when he answers?"),
      P("He won't answer. He'll ask something back. They always do. Take whatever he says up to the furnace loft and let Master Rong burn it into sense. Then bring it down to me before the congee gets cold."),
      flag("wl:asked"),
      { toast: "The Relay of Answers · carry the question up to Debater Ji" },
    ];
  if (!f["wl:rong"]) return [P(pick(g, ["Still going up? Good. The question will keep. The congee won't.", "Ji walks a circle round the debating floor. Stand in his way and he'll argue with you instead of walking round."]))];
  if (!f["wl:done"])
    return [
      P("A talisman? Let me see. “Eat it while it's hot.” …Master Rong always says that."),
      P("And yet, you know, every one of them down here will nod and say it was the answer all along. Ten thousand Daos and every one of them hungry. Thank you. Take these, and a bowl of congee on the house."),
      flag("wl:done"),
      stones(45),
      pills(2, 1),
      cult(0.25),
      { toast: "The Relay of Answers complete · 45 spirit stones, 2 Healing Pills, a Qi Gathering Pill" },
    ];
  return [P(pick(g, ["The refectory has a new question. Something about whether a bun is a dumpling that gave up. I've told them to ask it themselves.", "Upstairs they argue, downstairs we cook. Both floors are trying to feed people.", "Sit. Eat. The Dao will still be there after supper."]))];
}

function debaterJi(g: GameState): Step[] {
  const f = g.flags;
  const J = (text: string) => named("wdherald", "Debater Ji, Who Argues Walking", text);
  if (f["wl:asked"] && !f["wl:ji"])
    return [
      J("A question from the refectory? Read it to me while we walk. No, keep walking. Thought is a river; it dries up if you dam it."),
      J("“Is the fold of a dumpling its Dao?” Ha! Ask them this: when you eat the dumpling, where does its Dao go? Into you? Then are you now a little more dumpling?"),
      hero("That's not an answer."),
      J("It's better than an answer. It's a second question. Take it up to Rong on the furnace loft. He hates second questions. He'll burn it to make it stop."),
      flag("wl:ji"),
      { toast: "The Relay of Answers · take Ji's counter-question up to the furnace loft" },
    ];
  return [J(pick(g, ["Walk with me. Every debate I have lost, I lost sitting down.", "The Arbiter says I argue in circles. I say I argue in laps. It's healthier.", f["wl:done"] ? "The refectory called my counter-question “a good one, eaten cold”. I shall take that as a victory." : "Ask me anything. I won't answer, but I'll ask you something much better back."]))];
}

function furnaceRong(g: GameState): Step[] {
  const f = g.flags;
  const R = (text: string) => named("hmfire" as HumanId, "Furnace Master Rong", text);
  if (f["wl:ji"] && !f["wl:rong"])
    return [
      R("Ji sent you. I can tell by the shape of the question: it's got a question inside it like a pit in a plum. Give it here. Walk with me, I've got nine cauldrons to watch."),
      R("Into the furnace with it, then. Watch the smoke… there. You see? It's spelling it out."),
      { anim: "hero", name: "shade" },
      R("“Eat it while it's hot.” The smoke always says that. Here, I've written it on a talisman for the steward. Take it down, and take this for your trouble."),
      flag("wl:rong"),
      stones(15),
      { toast: "The Relay of Answers · bring the talisman down to Steward Pan" },
    ];
  return [R(pick(g, ["Keep clear of the furnace, the cauldrons and that disciple with the fan. She fans like she's angry with the coals.", "Some answers won't go into words. That's what fire is for.", "I've walked this loop ten thousand times watching the cauldrons. Not one has boiled while I was looking."]))];
}
