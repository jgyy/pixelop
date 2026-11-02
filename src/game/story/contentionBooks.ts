import type { GameState } from "../engine/state";
import type { GreatDaoId } from "../engine/comprehension";
import { CULT, shift } from "../engine/cultivation";
import { steadyHeart } from "../engine/dao";
import { TIES, tieKey } from "../world/powers";
import type { Beat, Fate } from "./hallsBooks";
import { revealTie, shiftTie, sway } from "./powers";

/**
 * The words of the Contention of the Daos (百道争鸣): six books, the beats
 * that carry each one, the Ten Writs and how each Great Dao is read, and
 * who waits at the end of each book. The shape of the tale (what kind of
 * quest comes when) is in story/contention.ts.
 *
 * Cast keys: `cn-speaker` (Speaker Xi He), `cn-keeper` (the Keeper of the
 * Fusang tree), `cn-feng` (Harbour-Master Feng Buji), `cn-seat-<dao>` (the
 * Synod's Seat-holders), `cn-envoy-<power>` (each power's envoy), and any
 * NPC key that already stands in the world.
 */

export interface ContentionBook {
  title: string;
  hanzi: string;
  /** The Great Dao the book turns on (its vigils deepen it). */
  dao: GreatDaoId;
  /** What the book is about, for the journal. */
  blurb: string;
  beats: Beat[];
  /** The ties whose truths its intrigues bring to light, in order (tie keys). */
  intrigues: string[];
  boss: { intro: string; words: [string, string][]; fates: Fate[]; victory: string };
}

// ----------------------------------------------------------------------------- what her choices do to the web
type Fx = (g: GameState) => GameState;
const all =
  (...fx: Fx[]): Fx =>
  (g) =>
    fx.reduce((s, f) => f(s), g);
const sw =
  (key: string, by: number): Fx =>
  (g) =>
    sway(g, key, by);
const tieOf = (a: string, b: string) => {
  const t = TIES.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a));
  if (!t) throw new Error(`no tie ${a}~${b}`);
  return t;
};
const mend =
  (a: string, b: string, by: number): Fx =>
  (g) =>
    shiftTie(g, tieOf(a, b), by);
const expose =
  (a: string, b: string): Fx =>
  (g) =>
    revealTie(g, tieOf(a, b));
const flag =
  (f: string): Fx =>
  (g) => ({ ...g, flags: { ...g.flags, [f]: true } });
const feed =
  (by: number): Fx =>
  (g) =>
    shift(g, CULT.demon, by);
const steady =
  (by: number): Fx =>
  (g) =>
    steadyHeart(g, by);
export const tk = (a: string, b: string) => tieKey(tieOf(a, b));

// ----------------------------------------------------------------------------- the Ten Writs
/**
 * Each Great Dao three ways: as the Synod's Writ has it, as the Unfettered
 * read it, and (once she understands it well enough to say anything at
 * all) as she has come to see it herself.
 */
export const WRITS: Record<GreatDaoId, { writ: string; free: string; own: string }> = {
  water: {
    writ: "The Writ of Water: water yields. A cultivator of Water who strikes first has not understood it, and must not teach.",
    free: "Water yields until it does not. Ask a flood whether it yields.",
    own: "Water yields to the shape of what holds it, and wears that shape away. It is both, and it is the same water.",
  },
  wood: {
    writ: "The Writ of Wood: wood grows toward heaven. A root that grows sideways is a weed.",
    free: "The bamboo spreads under the ground for five years before it shows a shoot. You would have weeded it.",
    own: "Wood grows toward whatever light there is. Heaven is one light. The forest floor has others.",
  },
  wind: {
    writ: "The Writ of Wind: wind serves the season. A wind out of season is a calamity, and its cultivator a calamity too.",
    free: "No one ever wrote the wind a letter and had it answered.",
    own: "The wind is seen only in what it moves. It does not obey the season; the season is what we call the wind we are used to.",
  },
  fire: {
    writ: "The Writ of Fire: fire is kept. A fire not in a hearth, a furnace or a lamp is arson.",
    free: "Every hearth fire was once a wildfire someone was brave enough to carry home.",
    own: "Fire keeps nothing for itself. A Writ that keeps it is not about fire; it is about who is allowed to be warm.",
  },
  earth: {
    writ: "The Writ of Earth: earth bears what is set on it, and does not move. A cultivator of Earth who moves mountains has misread it.",
    free: "Ask the Yellow Sands whether earth moves.",
    own: "The earth carries the mountain and the grave alike, and it carries them somewhere. Slowly. It complains of neither.",
  },
  metal: {
    writ: "The Writ of Metal: metal is refined. Ore is not yet metal, and its cultivator is not yet a cultivator.",
    free: "Every sword was ore once. Some of us like it that way.",
    own: "The edge is only the shape the metal agreed to keep. Ore has agreed to nothing yet. That is not a fault.",
  },
  thunder: {
    writ: "The Writ of Thunder: thunder is heaven's judgement, and only heaven's. A cultivator who calls it down on a mortal is a usurper.",
    free: "Then heaven should judge more often, and more fairly, and we would not need to.",
    own: "Heaven's anger lasts an instant and its patience forever. A cultivator who borrows the instant must carry the patience too.",
  },
  ice: {
    writ: "The Writ of Ice: ice is water that has decided. A decision once made is not unmade. To thaw is to recant.",
    free: "Every spring, the whole north recants. Nobody has burned it for heresy yet.",
    own: "Ice is water that has decided. Spring is water deciding again. Holding fast and letting go are one Dao, a season apart.",
  },
  lifedeath: {
    writ: "The Writ of Life and Death: every life is entered once in heaven's Register and struck once in the Springs'. What is not written does not live.",
    free: "The peoples lived for ten thousand years before anyone wrote them down.",
    own: "The lotus grows out of the mud of everything that died before it, written or not. The Register remembers; it does not decide.",
  },
  void: {
    writ: "The Writ of the Void: the void holds everything by holding nothing. It is the Speaker's seat, and it holds the other nine.",
    free: "A bowl that holds the other nine bowls is not empty. It is a cupboard.",
    own: "The bowl is useful for the emptiness in it. Fill it with rulings and it is only a bowl of rulings.",
  },
};

// ----------------------------------------------------------------------------- the six books
export const CONTENTION_BOOKS_TEXT: ContentionBook[] = [
  // ============================================================================================== I
  {
    title: "The Envoy of the Dawn",
    hanzi: "破晓之使",
    dao: "void",
    blurb: "An envoy of the Synod of Ten Seats waits at the Dawn Causeway with the Ten Writs and an invitation to the Great Council. Across the Strait of Dawn lies Fusang, where the Great Daos are law.",
    intrigues: [tk("orthodox", "synod"), tk("talisman", "synod"), tk("qi", "synod")],
    beats: [
      {
        step: 0,
        npc: "cn-envoy-synod",
        title: "The Envoy at the Causeway",
        objective: "An envoy in white and gold has waited forty days at the western end of the Dawn Causeway, past Wavecrest Harbour, for someone. Go and see who.",
        lines: [
          ["narr", "The envoy stands at the head of the causeway in robes the colour of the sky an hour before sunrise, with a lacquered scroll-case under her arm and forty days of sea-salt on her hem."],
          ["cn-envoy-synod", "Lin Yue. Of course. You are smaller than your Dao heart. Forgive me; the Speaker read it from across the sea, and it looked very tall."],
          ["cn-envoy-synod", "I am Mei Zhao, envoy of the Synod of Ten Seats, in Fusang, the Dawn Continent, where the sun comes up. Over the strait. You may have heard of us as a rumour, or as a heresy, depending on who told you."],
          ["cn-envoy-synod", "Once a century the Synod calls a Great Council of the Daos. This one is different. The Speaker means to have the Ten Writs signed by every throne and every sect under heaven, so that each Great Dao means one thing, everywhere, for good."],
          ["hero", "One thing. Who decides which thing?"],
          ["cn-envoy-synod", "Ten Seats, one for each Great Dao, each held by whoever understands that Dao deepest. That is the whole of our law. It has kept Fusang at peace for three thousand years."],
          { a: "cn-envoy-synod", n: "envoy" },
          ["cn-envoy-synod", "The Speaker asks that you come. A cultivator whose Dao heart can be seen from across the sea is a cultivator the Council will listen to. She would rather you listened to her first."],
        ],
        choice: {
          prompt: "Mei Zhao holds out the scroll-case with both hands. What does she say?",
          options: [
            { heart: "balance", label: "Take it, and thank her for the long wait", then: "She takes the case in both hands, the way it was given, and bows. Mei Zhao's shoulders come down an inch for the first time in forty days.", reply: ["cn-envoy-synod", "Thank you. Truly. The tide tables at this end are a misery."], effect: sw("synod", 1) },
            { heart: "sword", label: "“I'll come and listen. I won't sign anything.”", then: "She takes the case and does not open it. “I'll come and listen,” she says. “Signing is another road.”", reply: ["cn-envoy-synod", "That is what everyone says at the causeway. Say it again at the Council. It will mean more there."] },
            { heart: "mercy", label: "Ask who has refused the Writs before", then: "“Who said no last time?” she asks. Mei Zhao looks out at the strait for a long moment.", reply: ["cn-envoy-synod", "…Ask in Wuji, on the southern horn. Not in my hearing.”"], effect: flag("cn:askedwuji") },
            { heart: "slaughter", label: "“Tell your Speaker to keep her law on her side of the water.”", then: "She does not take the case. Mei Zhao sets it down on the causeway's first plank, very carefully, and steps back from it.", reply: ["cn-envoy-synod", "I will tell her. She will come anyway, you know. She always does."], effect: all(sw("synod", -2), feed(2)) },
          ],
        },
        after: [["cn-envoy-synod", "The causeway is two hours' walk, the strait under it the whole way. Mind the eleventh span: it sings in a west wind. Everybody thinks it is a ghost. It is a loose plank."]],
        done: "Mei Zhao gives her the Synod's invitation and a copy of the Ten Writs, and the Dawn Causeway opens east across the strait to Fusang.",
      },
      {
        step: 15,
        npc: "cn-speaker",
        title: "The Speaker of Ten Seats",
        objective: "Cross the Dawn Causeway to Fusang and present yourself to Speaker Xi He in the City of Ten Seats.",
        lines: [
          ["narr", "The square of the City of Ten Seats is a ring of ten stone chairs under ten bronze parasols. Nine are taken. The tenth has a white cloth over it."],
          ["cn-speaker", "Lin Yue. Sit, if you like. Not there: that is the Seat of Life and Death, and it is waiting for someone who understands it better than anyone alive."],
          ["cn-speaker", "I am Xi He. I hold the Seat of the Void, and so I speak for the other nine, because the Void holds everything by holding nothing. That is the joke the Synod was founded on. Nobody laughs any more."],
          ["cn-speaker", "Your people tell a story about ten suns. They rose together one morning and burned the world, and the archer Hou Yi shot nine of them down. Here is ours: they were not suns. They were ten readings of the same light, every one of them true. The world could not bear all of them at once."],
          ["cn-speaker", "Hou Yi did not shoot nine suns. He shot nine readings. And the world was cool enough to live in. The Synod has been doing his work, gently, ever since."],
          { a: "hero", n: "think" },
          ["hero", "And the nine readings that were shot down. Where did they go?"],
          ["cn-speaker", "Where everything goes that is not written down, Lin Yue. Nowhere at all. That is the mercy of it."],
        ],
        done: "Speaker Xi He receives her in the square of the Ten Seats and tells her the Synod's story of the ten suns: ten true readings of one light, and a world that could not bear them all.",
      },
      {
        step: 30,
        npc: "cn-seat-water",
        title: "How a Writ Is Made",
        objective: "Han Qiulan, Seat of Water, has offered to show you how the Synod makes a Writ. Find her in the square of the Ten Seats.",
        lines: [
          ["cn-seat-water", "You want to know how we can tell anyone what water means. Fair. Everyone does. Come and read."],
          ["narr", "She unrolls the Writ of Water across the Seat's stone arm. It is short. The commentary under it runs the length of the square."],
          ["cn-seat-water", "A hundred and twelve years of argument, from every cultivator of Water in Fusang who wished to speak. Then a vote of the Seat. Then the seal. Then the readings that lost are struck."],
          ["hero", "Struck. What happens to the people who held them?"],
          ["cn-seat-water", "They are asked to recant. Most do. You know what a Dao heart is: it is built on what you understand. Take a stone out of the bottom and the wall leans. Some walls fall."],
          ["cn-seat-water", "I held the losing reading of Water once, when I was young. I recanted. Look at me: I hold the Seat now. It can be done."],
          { a: "cn-seat-water", n: "pour" },
          ["cn-seat-water", "…My hands shake, in the rain. Only in the rain. It is nothing."],
        ],
        choice: {
          prompt: "Han Qiulan rolls up the Writ, her hands not quite steady. What does she say?",
          options: [
            { heart: "mercy", label: "Take her hands until they are still", then: "She takes the Seat of Water's hands in hers and holds them until they stop. Neither of them says anything about it.", reply: ["cn-seat-water", "…The Synod would call that sentiment. I would call it… Thank you. Do not tell the Speaker."], effect: all(sw("synod", 1), flag("cn:qiulan")) },
            { heart: "balance", label: "“If it can be done, it can be undone. That's water, too.”", then: "“If a reading can be struck,” she says, “it can be written back.” Han Qiulan looks at her sharply, and then away.", reply: ["cn-seat-water", "Careful. That sentence has been struck."] },
            { heart: "sword", label: "“A Dao that has to be held up by a vote isn't a Dao.”", then: "She says it plainly, in the middle of the square, and three clerks look up from their desks.", reply: ["cn-seat-water", "Then most of the jianghu walks no Dao at all, little sister. Including, I suspect, you."], effect: all(sw("synod", -1), sw("unfettered", 1)) },
            { heart: "slaughter", label: "“So you broke yourself to keep a chair.”", then: "She says it to wound, and it does. Han Qiulan's face closes like a door.", reply: ["cn-seat-water", "Yes. Go and sit in it, if you think it was not worth it."], effect: all(sw("synod", -2), feed(1)) },
          ],
        },
        done: "Han Qiulan shows her how a Writ is made, argued and voted and sealed, and what becomes of the readings that lose: they are struck, and those who hold them are asked to recant.",
      },
      {
        step: 45,
        npc: "cn-keeper",
        title: "Under the Fusang Tree",
        objective: "North of the City of Ten Seats, in the Valley of Sunrise, the Fusang tree stands where the sun comes up. Its keeper has asked for you.",
        lines: [
          ["narr", "The Fusang tree is so tall that its crown is still in sunlight after the valley has gone blue with evening. Its leaves are the size of doors. A great many of them lie on the ground."],
          ["cn-keeper", "Hou Qing. Keeper of the tree, of the line of the archer, for my sins. Sit; you are standing on its roots, they don't mind."],
          ["cn-keeper", "The Speaker told you the story of the ten suns. Shall I tell you the version my grandmother told me? Hou Yi did not shoot the nine readings for the world's sake. He was paid to. The ones who paid him built a council in this valley, and wrote down the reading that was left, and called it the only one."],
          ["hero", "And the world didn't burn?"],
          ["cn-keeper", "The world did not burn. That part is true. That is why it is hard to argue with them."],
          { a: "cn-keeper", n: "seagaze" },
          ["cn-keeper", "But look up. The tree drinks the dawn, and for three hundred years the dawn has come a little thinner every spring. The leaves fall before they turn. I have been counting. Nobody in the City wants my numbers."],
        ],
        done: "Keeper Hou Qing, of the archer's line, tells her the other story of the ten suns, and shows her the Fusang tree dropping its leaves green: the dawn has been coming thinner for three hundred years.",
      },
      {
        step: 60,
        npc: "cn-envoy-unfettered",
        title: "A Grey Sail at the Landing",
        objective: "A fishing boat with a grey patch on its sail keeps coming in at the Dawn Landing at night. Someone aboard wants to meet you. Go down to the landing.",
        lines: [
          ["narr", "The woman on the boat has a sailor's hands and a scholar's eyes, and she keeps one on the landing's lantern the whole time she talks."],
          ["cn-envoy-unfettered", "Qiao Ling. First mate to Feng Buji of Wuji, whom the Synod calls a heretic, a pirate and its former Seat of Wind. All three are true."],
          ["cn-envoy-unfettered", "He sent me with one sentence for you: come and see what the Writs do before you sign anything. That's all. He said you'd understand it, or you wouldn't."],
          { a: "cn-envoy-unfettered", n: "beckon" },
          ["cn-envoy-unfettered", "Wuji is on the southern horn, past the Hall of Writs. Don't take the road past the Hall in daylight. Don't take it at night either, if you can help it."],
        ],
        choice: {
          prompt: "Qiao Ling's boat is carrying a hold full of something wrapped in oilcloth. What does she do?",
          options: [
            { heart: "balance", label: "Ask nothing about the cargo", then: "She does not ask about the oilcloth. Qiao Ling notices that she does not ask, and likes her the better for it.", reply: ["cn-envoy-unfettered", "Good. Books are heavy enough without questions."], effect: sw("unfettered", 1) },
            { heart: "sword", label: "Ask straight out what's in the hold", then: "“What are you carrying?” she asks. Qiao Ling lifts one corner of the oilcloth: books, bound in the plain grey board of Wuji.", reply: ["cn-envoy-unfettered", "Struck readings. The Synod burns them; we copy them. Want one? The Writ of Fire's losing side is a cracking read."], effect: all(sw("unfettered", 1), flag("cn:greybooks")) },
            { heart: "mercy", label: "Warn her the Inquisition watches the landing", then: "“The Inquisition has a man on the causeway,” she says quietly. “Grey sails are what he watches for.”", reply: ["cn-envoy-unfettered", "Bai Lü. I know. I'll come in on the other tide. Thank you; you didn't have to."], effect: all(sw("unfettered", 2), flag("cn:warnedqiao")) },
            { heart: "slaughter", label: "Tell her to leave before you call the Inquisition", then: "She tells Qiao Ling to cast off before she calls the watch. Qiao Ling casts off, and does not look back.", reply: ["cn-envoy-unfettered", "Feng said you might. He said to tell you that's a reading too."], effect: all(sw("unfettered", -2), sw("synod", 1), feed(1)) },
          ],
        },
        done: "Qiao Ling of the Unfettered brings her one sentence from Feng Buji of Wuji: come and see what the Writs do before you sign anything.",
      },
      {
        step: 85,
        npc: "cn-seat-ice",
        title: "The Grand Inquisitor",
        objective: "Ling Shuang, Seat of Ice and Grand Inquisitor of the Synod, has asked to meet you in the square of the Ten Seats.",
        lines: [
          ["narr", "The Seat of Ice sits very straight, and the stone of her chair is frosted where her hands rest on it."],
          ["cn-seat-ice", "You have been talking to grey sails. Don't trouble to deny it; it is my work to know, and I am very good at my work."],
          ["cn-seat-ice", "I am not going to warn you off. I am going to tell you why the Inquisition exists. When I was nineteen, a cultivator of Ice in the north of Fusang read the Dao her own way: that ice must never thaw. She froze a valley so that nothing in it would ever change again. Four villages."],
          ["cn-seat-ice", "She was not wicked. She was certain. That is what a reading is, Lin Yue, when nobody is allowed to tell it it is wrong."],
          ["hero", "And you? You're certain too."],
          ["cn-seat-ice", "Yes. That is why I keep the Inquisition, and not the other way about. I recanted once, on the Hall of Writs' floor, to keep this seat. I know exactly what I am asking of people. I ask it anyway."],
        ],
        done: "Ling Shuang, Grand Inquisitor and Seat of Ice, tells her why the Inquisition exists: a certain reading once froze four villages, and she recanted her own to hold the seat that guards against it.",
      },
      {
        step: 105,
        npc: "cn-envoy-synod",
        title: "Mei Zhao's Brother",
        objective: "Mei Zhao has sent word from the western end of the Dawn Causeway: she must see the Witness, tonight. Go to her.",
        lines: [
          ["cn-envoy-synod", "Bai Lü has taken Qiao Ling. At the landing, last night, on the other tide. He knew which tide. Somebody told him."],
          ["cn-envoy-synod", "…I am going to tell you something I should not. My brother is in Wuji. Mei Lan, who read the Dao of Wood the wrong way, and would not recant, and was put on a boat. I carry the Synod's letters because if I am useful enough they might let me write to him."],
          { a: "cn-envoy-synod", n: "cry" },
          ["cn-envoy-synod", "Qiao Ling carried his letters to me. Twelve years. If she goes before the Hall of Writs, every letter she ever carried will be read into the record."],
        ],
        choice: {
          prompt: "Mei Zhao has her face in her hands under the empty seat. What does she do?",
          options: [
            { heart: "mercy", label: "Promise to get Qiao Ling out", then: "“I'll get her out,” she says. It is a promise, and she hears herself make it.", reply: ["cn-envoy-synod", "Don't promise. Just… do it, if you can. Promises get written down here."], effect: all(sw("unfettered", 1), flag("cn:promisedqiao")) },
            { heart: "balance", label: "Go to the Speaker and ask for a fair hearing", then: "She goes straight to the Speaker's chair and asks for a fair hearing for Qiao Ling, before the Seats, not the Inquisition.", reply: ["cn-speaker", "A hearing she will have. Fair it will be. That is not the same as kind, and you should not confuse them."], effect: sw("synod", 1) },
            { heart: "sword", label: "“Then the letters must vanish before the hearing.”", then: "“Then the letters vanish,” she says, “before anyone reads them.” Mei Zhao looks up at her in something like terror.", reply: ["cn-envoy-synod", "You would break into the Hall of Writs? …Yes. I think you would."], effect: flag("cn:letters") },
            { heart: "slaughter", label: "“If Bai Lü stands in the way, he won't stand long.”", then: "She says it quietly. It is not a boast. Mei Zhao believes her, and is afraid of how glad she is.", reply: ["cn-envoy-synod", "Don't. He has a daughter. Everybody has a daughter, in this city."], effect: feed(2) },
          ],
        },
        done: "Mei Zhao tells her that Bai Lü has taken Qiao Ling, and that her own brother is an exile in Wuji whose letters Qiao Ling carried for twelve years.",
      },
      {
        step: 125,
        npc: "cn-seat-wind",
        title: "The Seat of Wind Remembers",
        objective: "Lie Yukou, Seat of Wind, sent a paper crane to find you. Go to the square of the Ten Seats.",
        lines: [
          ["cn-seat-wind", "Sit with me. I hold the seat Feng Buji held. I took it the day he was put on the boat; I voted for the Writ that put him there."],
          ["cn-seat-wind", "His reading was better than mine. Everybody on the Seat knew it. That is exactly why it had to be struck. A reading that good, held by a man that stubborn, could have blown the whole Synod into the sea."],
          ["hero", "Do you believe that?"],
          { a: "cn-seat-wind", n: "windback" },
          ["cn-seat-wind", "I believed it for thirty years. Then the wind in this valley stopped coming from the sea. It comes from the land now, every day, the same way. That is not a reading. That is a Dao going thin."],
        ],
        done: "Lie Yukou, Seat of Wind, admits Feng Buji's reading was the better one, and that since it was struck the valley's wind has blown one way only.",
      },
      {
        step: 140,
        npc: "cn-speaker",
        title: "The Hearing at the Hall of Writs",
        objective: "Qiao Ling's hearing is set for the Hall of Writs. Go to the Speaker in the square of the Ten Seats before it begins.",
        lines: [
          ["cn-speaker", "I know what you came to ask. The answer is no. If the Synod bends its Writ for a guest it has no Writ, and then it has nothing to stop the next valley freezing."],
          ["cn-speaker", "Bai Lü holds the causeway road to the Hall with the Inquisition's dogs. If you mean to stop him, you will have to stop him. I will not help you. I will not hinder you either. That is all the Void can offer."],
          { a: "cn-speaker", n: "mudra" },
          ["cn-speaker", "Go on, then. Show the Council what you are. They will be watching. They always are."],
        ],
        done: "The Speaker will neither help nor hinder her: Bai Lü holds the road to the Hall of Writs with the Inquisition's hounds, and Qiao Ling's hearing is at dawn.",
      },
    ],
    boss: {
      intro: "Bai Lü, Inquisitor-Captain of the Causeway, waits on the Hall of Writs road with the Writ of Ice chained to his wrist and the Inquisition's hounds at his heel",
      words: [
        ["cn-boss", "Guest of the Synod. Go back to the square. This is a lawful hearing."],
        ["hero", "Then let her be heard. Not hounded."],
        ["cn-boss", "She smuggled struck readings into a city that keeps the world from burning. I have a daughter in that city. Go back."],
      ],
      fates: [
        { heart: "mercy", label: "Spare him, and go to the hearing at his side", line: "She helps Bai Lü up and walks to the Hall of Writs with him, as his guest, not his prisoner. Qiao Ling's hearing is fair, and short, and she is put on a boat to Wuji instead of before the Inquisition. Bai Lü writes a report that says only: the guest was correct." },
        { heart: "sword", label: "Cut the Writ's chain from his wrist", line: "One cut, and the chain that bound the Writ of Ice to his wrist falls on the road. Bai Lü stares at his bare wrist as if it belonged to someone else. Qiao Ling walks free out of the Hall's side door while the clerks are still looking for the Writ." },
        { heart: "balance", label: "Make him read the struck reading aloud, then judge", line: "She makes Bai Lü read Qiao Ling's struck books aloud on the steps of the Hall, a page from each, and then asks him whether they deserve fire. He reads until dawn. When he finishes, he lets Qiao Ling go himself." },
        { heart: "slaughter", label: "End him on the road", line: "She ends it on the road. The hounds scatter into the dark. Qiao Ling walks free, and will not look at her, and the whole of the City of Ten Seats knows by noon what the Council's guest does to those who stand in her road." },
      ],
      victory: "The Inquisition's hounds are gone from the Hall of Writs road. Word goes round the City of Ten Seats that the Council's guest is not anyone's guest.",
    },
  },
  // ============================================================================================== II
  {
    title: "The Ten Writs Go West",
    hanzi: "十律西行",
    dao: "earth",
    blurb: "The Speaker asks her to carry the Ten Writs to the six thrones as the Council's witness. Every throne answers, and every answer has something underneath it.",
    intrigues: [tk("wei", "synod"), tk("liang", "goldcrane"), tk("yan", "ironbanner")],
    beats: [
      {
        step: 0,
        npc: "cn-speaker",
        title: "The Council's Witness",
        objective: "The Speaker has sent for you again. Go to the square of the Ten Seats.",
        lines: [
          ["cn-speaker", "Whatever you did on the Hall road, the Council now believes you belong to no one. That makes you useful to everyone, and to me most of all."],
          ["cn-speaker", "Carry the Ten Writs to the six thrones of the west. Not as my envoy: Mei Zhao is my envoy. As the Council's witness. Tell me what each throne says, and, more to the point, what it means."],
          ["hero", "And if they say no?"],
          ["cn-speaker", "Then they say no, and you tell me why. Everyone has a reason, Lin Yue. The reason is always more interesting than the answer."],
        ],
        choice: {
          prompt: "The Speaker holds out six sealed copies of the Ten Writs. What does she say?",
          options: [
            { heart: "balance", label: "Agree, and promise to report every answer truly", then: "She takes the six copies and promises to bring back every answer exactly as it is given.", reply: ["cn-speaker", "Exactly as it is given. Yes. And then tell me what you think, separately. Never mix the two."], effect: sw("synod", 1) },
            { heart: "sword", label: "Agree, but only if she may speak her own mind at each court", then: "“I'll carry them,” she says. “And at every court I'll say what I think of them.”", reply: ["cn-speaker", "You were always going to. I am only glad you told me."] },
            { heart: "mercy", label: "Ask that Qiao Ling's people may write home freely while she is gone", then: "She asks, as her price, that the exiles of Wuji may send letters into Fusang unread while she carries the Writs.", reply: ["cn-speaker", "…Granted, until you return. You bargain like a fishwife. I mean that kindly."], effect: all(sw("unfettered", 2), flag("cn:letterspeace")) },
            { heart: "slaughter", label: "“And if a throne threatens me, I answer how I like.”", then: "She takes the Writs and makes no other promise. The Speaker inclines her head, slowly.", reply: ["cn-speaker", "Then try not to start a war with a sealed copy of the law in your sleeve."], effect: feed(1) },
          ],
        },
        done: "She agrees to carry the Ten Writs to the six thrones of the west as the Council's witness.",
      },
      {
        step: 15,
        npc: "ct-3-emperor",
        title: "The Iron Throne Signs First",
        objective: "Carry the Ten Writs to Emperor Wei Lie on the Iron Throne of Pingcheng, under the snows.",
        lines: [
          ["ct-3-emperor", "The Ten Writs. Bring them here. Wei will sign. Today, if your Speaker likes."],
          ["hero", "Your Majesty hasn't read them."],
          ["ct-3-emperor", "I have read the only one that matters. A throne that holds the Writs holds the Mandate written down. No more omens. No more Qi astronomers telling my people heaven has turned its face from Wei because a comet went the wrong way."],
          { a: "ct-3-emperor", n: "decree" },
          ["ct-3-emperor", "My sons are on the wall against the Iron Banner. They should not have to wonder whether heaven is on the wall with them. Let it be written."],
        ],
        done: "Emperor Wei Lie will sign the Ten Writs at once: a throne that holds them holds the Mandate of Heaven written down, and his sons are on the wall.",
      },
      {
        step: 30,
        npc: "ct-5-emperor",
        title: "The Sand Throne Will Sign",
        objective: "Carry the Ten Writs on to Emperor Murong Tuo on the Sand Throne of Longcheng.",
        lines: [
          ["ct-5-emperor", "Yan signs. Yan always signs. Ask anyone: whatever the six do, Yan does too, and then Yan is blamed for it."],
          ["ct-5-emperor", "My daughter says I should read them first. My daughter reads everything. That is why I have her."],
          { a: "ct-5-emperor", n: "toast" },
          ["ct-5-emperor", "Drink with me, Witness. To the Writs, and a world where every throne's reasons are written down and nobody has to guess them. Ha. Ha."],
          ["narr", "He laughs a little too long, and Princess Murong Xue, at his elbow, does not laugh at all."],
        ],
        done: "Emperor Murong Tuo of Great Yan will sign, as Yan always does, and laughs too long at his own toast about reasons written down.",
      },
      {
        step: 45,
        npc: "ct-2-emperor",
        title: "Shu Will Not Sign",
        objective: "Carry the Ten Writs to Emperor Wenhe on the Brocade Throne of Jincheng.",
        lines: [
          ["ct-2-emperor", "No."],
          ["hero", "Your Majesty, the Council asks only that you —"],
          ["ct-2-emperor", "Read me the Writ of Life and Death. Aloud. …There. Every life entered once and struck once. I have been struck, Witness. The night Xu Fu's elixir stopped my heart, the Springs crossed my name out. My heart started again. Nobody corrected the ledger."],
          ["ct-2-emperor", "If Shu signs a Writ that says what is not written does not live, then by its own law I am a dead man on a throne, and my son is emperor at fourteen, and the Crimson Cauldron's pills that keep the elixir from bursting me are medicine for a corpse. Shu will not sign."],
          { a: "ct-2-emperor", n: "think" },
        ],
        choice: {
          prompt: "Emperor Wenhe coughs into a silk cloth and does not show her what is on it. What does she say?",
          options: [
            { heart: "mercy", label: "“Then I'll tell the Council a living man refused.”", then: "“Then I will tell the Council that a living man refused,” she says. The old emperor looks at her for a long moment.", reply: ["ct-2-emperor", "Living. Yes. Tell them that word exactly."], effect: all(sw("shu", 2), sw("cauldron", 1)) },
            { heart: "balance", label: "Ask what the Cauldron's pills cost him", then: "“What do the pills cost Shu?” she asks. The emperor's physician, at his shoulder, goes very still.", reply: ["ct-2-guide", "…Ask Sect Master Dan Qiu. In private. Please."], effect: flag("cn:askpills") },
            { heart: "sword", label: "“The Writ is wrong about you. Say so to the Council yourself.”", then: "“Then the Writ is wrong,” she says, “and you should say so to its face.”", reply: ["ct-2-emperor", "At my age, Witness, one does not travel to Fusang to be told one is dead in person."], effect: sw("shu", 1) },
            { heart: "slaughter", label: "“A throne that won't sign may not stay a throne.”", then: "She says it as a warning, not a threat. It lands as a threat.", reply: ["ct-2-emperor", "Get out of my hall."], effect: all(sw("shu", -3), feed(1)) },
          ],
        },
        done: "Emperor Wenhe of Shu refuses: by the Writ of Life and Death he died the night Xu Fu's elixir stopped his heart, and lives on only by the Crimson Cauldron's pills.",
      },
      {
        step: 60,
        npc: "ct-1-emperor",
        title: "Chen Wants a Price",
        objective: "Carry the Ten Writs to Empress Chen Yuhua on the Tide Throne of Jinling.",
        lines: [
          ["ct-1-emperor", "The Ten Writs, and a Council in Fusang. Very well. Chen will sign the Writ of Water the day the Synod strikes the Dragon King's tribute from the sea lanes."],
          ["ct-1-emperor", "Every junk out of Jinling pays the Dragon King a pearl for fair winds. Every one. If the Synod can rule on what water means, it can rule on who owns the sea."],
          ["hero", "And the Dragon King?"],
          { a: "ct-1-emperor", n: "fanning" },
          ["ct-1-emperor", "Is a drowned old fish with a palace full of other people's pearls. Witness, everyone in this hall has a price. I am only honest enough to name mine."],
        ],
        done: "Empress Chen Yuhua names her price: Chen signs the Writ of Water the day the Synod strikes the Dragon King's tribute from the sea.",
      },
      {
        step: 85,
        npc: "ct-0-emperor",
        title: "Liang Cannot Sign",
        objective: "Carry the Ten Writs to Emperor Xuande on the Granary Throne of Liangdu.",
        lines: [
          ["ct-0-emperor", "Liang would sign. Liang would like to sign. Liang… is not, at present, able to sign."],
          ["hero", "Your Majesty has a brush."],
          ["ct-0-emperor", "His Majesty has a brush. His Majesty does not have a seal. Or he has a seal, Witness, which is a very good copy of a seal."],
          { a: "ct-0-emperor", n: "whisper" },
          ["ct-0-emperor", "Ask He Lingxiao of the Golden Crane where the Granary Seal of Liang has been for forty years. Ask her kindly. She is owed a great deal, and she has never once said so."],
        ],
        done: "Emperor Xuande of Liang cannot sign: the Granary Seal of Liang has been in the Golden Crane's keeping for forty years.",
      },
      {
        step: 105,
        npc: "ct-4-emperor",
        title: "Qi Already Knew",
        objective: "Carry the Ten Writs to Emperor Qi Yuan on the Maple Throne of Linzi.",
        lines: [
          ["ct-4-emperor", "Ah. The Witness. We have been expecting you since the ninth day of the month. Astronomer Gan foresaw it."],
          ["hero", "Foresaw what, Majesty?"],
          ["ct-4-emperor", "That the Synod would send the Writs west this year. That Wei would sign first. That Shu would refuse. Gan sees a great deal. Gan sees, sometimes, a little before the heavens do."],
          { a: "ct-4-emperor", n: "stargaze" },
          ["ct-4-emperor", "Qi will stand where it always stands, between the others, and sign whatever the others can agree on, and nothing they cannot. Tell your Speaker that. She will not be surprised. She is never surprised by Qi."],
        ],
        done: "Emperor Qi Yuan already knew every throne's answer before she arrived: his Court Astronomer Gan sees, sometimes, a little before the heavens do.",
      },
      {
        step: 125,
        npc: "ct-5-guide",
        title: "What the Tribute Bought",
        objective: "Princess Murong Xue of Great Yan has sent a camel-boy after you with a letter that says only: the oasis, at night. Go back to Longcheng.",
        lines: [
          ["ct-5-guide", "My father laughed too long at that toast. You noticed. Everybody notices; nobody asks. You are going to ask, so I will save you the trouble."],
          ["ct-5-guide", "Yan pays the Iron Banner a tribute of camels every spring. Everyone knows. Not everyone knows what the tribute bought: the Banner's road. We let the horde cross the Yellow Sands unopposed, on the understanding it would ride on east and south into Liang and the jianghu, and leave Longcheng standing. It did."],
          ["hero", "Willow Creek. The bamboo. The lake. The marsh."],
          ["ct-5-guide", "Yes. All of it. And if Yan signs the Writs, and the Synod's Inquisitors read our archives into the record, as they read everyone's, the six thrones will know too. My father would sign the Writs to look loyal. He has not thought it through. He never thinks anything through."],
          { a: "ct-5-guide", n: "fanning" },
          ["ct-5-guide", "There is a man who has. Murong Ce, my cousin, my father's spymaster. He brokered the pact. He means to bury it before the Council, and anyone who knows of it. Including, I suppose, you. And me."],
        ],
        done: "Princess Murong Xue tells her what Yan's tribute bought: the Iron Banner's road across the Yellow Sands into the jianghu. Her cousin Murong Ce brokered it, and means to bury it.",
      },
      {
        step: 140,
        npc: "ct-5-guide",
        title: "The Spymaster's Knives",
        objective: "Murong Ce means to bury Yan's pact with the Iron Banner, and everyone who knows of it. Go back to Princess Murong Xue in Longcheng.",
        lines: [
          ["ct-5-guide", "He has gone into the dunes south of the city with his knives. He knows you know. He will come for you on the caravan road."],
          ["ct-5-guide", "Whatever you do to him, Witness, Yan will remember it. Be careful which Yan you want to be remembered by."],
        ],
        done: "Murong Ce, spymaster of Great Yan, waits in the dunes south of Longcheng with his knives, to bury the pact and the Witness who learned of it.",
      },
    ],
    boss: {
      intro: "Murong Ce, Spymaster of Great Yan, rises out of the sand on the caravan road with a knife in each hand and the pact's only copy sewn into his sleeve",
      words: [
        ["cn-boss", "Witness. You read too much. It's a family failing; my cousin has it too."],
        ["hero", "Willow Creek burned for your pact."],
        ["cn-boss", "And Longcheng did not. Every throne has a city it chose to save. Ours was honest enough to pay."],
      ],
      fates: [
        { heart: "mercy", label: "Spare him, and let Yan confess it in its own words", line: "She spares him, and gives him and the princess one month to put the pact before the six thrones in Yan's own words, before the Council does it for them. Murong Ce rides north to the Banner to unpick what he stitched. It is the first honest errand of his life." },
        { heart: "sword", label: "Cut the copy from his sleeve and take it to the Council", line: "She cuts the pact from his sleeve and takes it, whole, to the City of Ten Seats. It is read into the Council's record in Murong Ce's own hand. Great Yan does not forgive her. Liang, for the first time in a generation, sends Yan no grain." },
        { heart: "balance", label: "Keep the copy yourself, and keep Yan's secret, for now", line: "She takes the copy and keeps it, and tells no one. Murong Ce understands perfectly: Yan now owes her a throne's secret. He bows very low, and means it, and hates her for the rest of his life." },
        { heart: "slaughter", label: "Bury him in the dunes with his pact", line: "She buries Murong Ce in the dune he rose out of, with the pact sewn into his sleeve. The secret goes into the sand with him. The princess never asks where he went, and never quite meets her eye again." },
      ],
      victory: "Murong Ce's knives are in the sand. The six thrones' answers to the Ten Writs go back to the City of Ten Seats with her, and some of what lies under them.",
    },
  },
  // ============================================================================================== III
  {
    title: "The Unfettered of Wuji",
    hanzi: "无羁之港",
    dao: "wind",
    blurb: "On Fusang's southern horn the exiles who would not recant keep a free port. The Synod's fleet is coming to make them.",
    intrigues: [tk("chen", "unfettered"), tk("chen", "tidebreaker"), tk("celestial", "synod")],
    beats: [
      {
        step: 0,
        npc: "cn-feng",
        title: "The Harbour-Master of Wuji",
        objective: "Go south past the Hall of Writs to Wuji, the free port on Fusang's southern horn, and find Feng Buji.",
        lines: [
          ["narr", "Wuji is two hundred houses round a harbour full of grey sails, and on every door a reading of some Dao, painted in the owner's hand: struck, every one of them."],
          ["cn-feng", "The Council's Witness. Qiao Ling says you're either a good woman or a very good liar. I've been both; it's hard to tell from outside."],
          ["cn-feng", "Feng Buji. I held the Seat of Wind for forty years. I read the wind as free: it goes where it will, and the seasons are just names for where it usually goes. The Synod ruled that a wind out of season is a calamity. I said, then I'm a calamity. They agreed."],
          { a: "cn-feng", n: "laugh" },
          ["cn-feng", "Look round. Two thousand calamities. Fishers, potters, a very bad poet. Every one of them read some Dao their own way and wouldn't give it back. You're going to the Council to decide whether that was a crime. Thought you should meet the criminals."],
        ],
        done: "Feng Buji, once the Synod's Seat of Wind, shows her Wuji: two thousand exiles who read a Great Dao their own way and would not give it back.",
      },
      {
        step: 15,
        npc: "cn-envoy-unfettered",
        title: "Qiao Ling's Ledger",
        objective: "Qiao Ling keeps Wuji's books, and runs its cargoes in at the Dawn Landing. Find her there.",
        lines: [
          ["cn-envoy-unfettered", "You want to know how a heretics' port eats. Here. Chen's admiralty buys our grey-board books and sells us rice. They turn away our sails in daylight and unload them at night. Twelve years now."],
          ["hero", "Chen? The Empress wants the Synod to give her the sea."],
          ["cn-envoy-unfettered", "Chen wants everything. The Empress signs the Writ of Water with one hand and buys the struck readings of Water with the other. They sell well, in Jinling. Everybody wants to know what they're not allowed to know."],
          { a: "cn-envoy-unfettered", n: "abacus" },
        ],
        done: "Qiao Ling shows her Wuji's ledger: Chen's admiralty has fed the heretics' port for twelve years, buying the very readings its empress would sign away.",
      },
      {
        step: 30,
        npc: "cn-seat-wind",
        title: "The Seat of Wind Comes South",
        objective: "Lie Yukou, Seat of Wind, has come to Wuji in a fisherman's coat. He is waiting at the end of the quay.",
        lines: [
          ["cn-seat-wind", "Don't tell Ling Shuang I'm here. Don't tell Feng either. I only want to look at him."],
          ["narr", "Down the quay, Feng Buji is arguing with a sail-maker about the wind, cheerfully, at the top of his voice."],
          ["cn-seat-wind", "The fleet sails for Wuji at the new moon. Ling Shuang has the Speaker's seal on the order. Every exile on this horn will be offered the Writs, one last time. The ones who refuse will be taken to the Hall."],
          { a: "cn-seat-wind", n: "seagaze" },
          ["cn-seat-wind", "I voted for it. I would vote for it again. I don't know why I came to tell you."],
        ],
        choice: {
          prompt: "Lie Yukou won't look at her; he is watching Feng Buji. What does she say?",
          options: [
            { heart: "mercy", label: "“Go and talk to him. You won't get another chance.”", then: "“Go and talk to him,” she says. Lie Yukou stands there a long time, and then walks down the quay.", reply: ["cn-feng", "Yukou! You old weathervane! Come here and tell me I was right!"], effect: all(sw("synod", 1), sw("unfettered", 1), flag("cn:windmet")) },
            { heart: "balance", label: "“Then vote against it at the Council. That's what a seat is for.”", then: "“Then vote the other way at the Council,” she says. “That's what a seat is for.”", reply: ["cn-seat-wind", "…A seat is for keeping the wind in season. I'm no longer sure there is a season."], effect: flag("cn:windwavers") },
            { heart: "sword", label: "“You came because you know it's wrong. Say it.”", then: "“You came because it's wrong,” she says. “Say it.” Lie Yukou's jaw works.", reply: ["cn-seat-wind", "It is wrong. There. The wind heard it. Nothing changed."] },
            { heart: "slaughter", label: "“If the fleet comes, it won't go home.”", then: "She says it to the sea. Lie Yukou turns and looks at her as if he has seen a storm out of season.", reply: ["cn-seat-wind", "Then you'll have proved the Speaker right about everything."], effect: all(sw("synod", -2), feed(1)) },
          ],
        },
        done: "Lie Yukou warns her that the Synod's fleet sails for Wuji at the new moon, with Ling Shuang at its head and the Speaker's seal on the order.",
      },
      {
        step: 45,
        npc: "cn-feng",
        title: "The Exiles' Own Writ",
        objective: "Feng Buji has called the exiles of Wuji together on the quay. Go and hear what they decide.",
        lines: [
          ["narr", "Two thousand people on a quay, all talking at once. It sounds exactly like the Synod's square, only louder and with fish."],
          ["cn-feng", "The fleet's coming. So we vote. Hands up for: we fight. Hands up for: we sail away again, further. Hands up for: we write the Synod a reply."],
          ["narr", "A woman in a potter's apron stands on a barrel. “We should write it down,” she shouts. “Our readings. All of them. So they can't say we don't know what we believe.”"],
          ["cn-feng", "…And then? The next one who reads the wind differently from me gets put on a boat out of Wuji?"],
          { a: "cn-feng", n: "shrug" },
          ["cn-feng", "That's how it starts, Witness. That's exactly how it started. Three thousand years ago in that valley, a few people wrote down their reading so they wouldn't forget it."],
        ],
        choice: {
          prompt: "The quay has gone quiet. Feng Buji is looking at her. What does she tell the exiles?",
          options: [
            { heart: "balance", label: "Write down every reading, including the ones that disagree", then: "“Write them all down,” she says. “Every one. Side by side, the ones that disagree too. A library, not a law.”", reply: ["cn-feng", "A library. Ha. The Synod has one. It's in the cellar, under the Hall of Writs, and it's on fire."], effect: all(sw("unfettered", 2), flag("cn:library")) },
            { heart: "sword", label: "Write nothing. Fight for the right not to.", then: "“Write nothing,” she says. “Fight for the right not to have to.”", reply: ["cn-feng", "Fight a fleet with a fishing village? I like you. I like you a lot. It won't work."], effect: sw("unfettered", 1) },
            { heart: "mercy", label: "Get the children and the old out before the fleet comes", then: "“First,” she says, “the children and the old. Off the horn before the new moon. Then argue.”", reply: ["cn-feng", "…Yes. Yes. Qiao Ling, the junks. You heard her."], effect: all(sw("unfettered", 2), flag("cn:evacuated")) },
            { heart: "slaughter", label: "Arm the port and burn the fleet as it comes in", then: "“Arm every boat,” she says, “and burn the fleet in the harbour mouth.” Half the quay cheers. Feng Buji does not.", reply: ["cn-feng", "That's a reading too, Witness. It's the one they've got about us."], effect: all(sw("unfettered", -1), sw("synod", -2), feed(2)) },
          ],
        },
        done: "The exiles of Wuji vote on how to meet the Synod's fleet, and Feng Buji warns them that writing their readings down is how the Synod began.",
      },
      {
        step: 60,
        npc: "ct-1-leader",
        title: "The Tidebreaker's Sister",
        objective: "Chen's sect, the Tidebreakers, could break any fleet. Go back to Jinling and ask Sect Mistress Lan Ruoshui.",
        lines: [
          ["ct-1-leader", "Break the Synod's fleet. For Wuji. You know Chen's admiralty trades with them? Of course you do. You know everything; it's very tiresome."],
          ["ct-1-leader", "Here is something you don't know. The Empress is my sister. Half-sister. Our father loved a pearl-diver before he married an empress, and I am the pearl-diver's daughter, and the elder."],
          { a: "ct-1-leader", n: "seagaze" },
          ["ct-1-leader", "If the Tidebreakers sail against the Synod, Yuhua loses her Writ of Water and her sea. If we don't, the sea loses a port that reads it freely. I have been choosing between my sister and the sea since I was eleven. I am tired of it."],
        ],
        done: "Sect Mistress Lan Ruoshui confesses she is the Empress's elder half-sister, and torn between her sister's throne and the sea.",
      },
      {
        step: 85,
        npc: "cn-envoy-dragonking",
        title: "The Dragon King's Price",
        objective: "Hai Yin of Pearlsong Reef has come to Wuji with word from the Dragon King. She is waiting where the quay meets the sea.",
        lines: [
          ["cn-envoy-dragonking", "The Dragon King says: Fusang's fleets sail his sea without paying for the wind. He has been patient for nine years. His patience has run out at a very convenient moment, for Wuji."],
          ["cn-envoy-dragonking", "He will send a storm out of season into the harbour mouth at the new moon. No fleet will pass it. In return, every grey sail out of Wuji pays him a pearl, forever, like everyone else."],
          ["hero", "A storm out of season. The Synod calls that a calamity."],
          { a: "cn-envoy-dragonking", n: "offerpearl" },
          ["cn-envoy-dragonking", "The Dragon King calls it Tuesday."],
        ],
        choice: {
          prompt: "Hai Yin holds out a pearl the size of a fist. What does she say?",
          options: [
            { heart: "balance", label: "Accept for Wuji, and pay the first pearl yourself", then: "She accepts the Dragon King's storm on Wuji's behalf, and pays the first pearl out of her own purse.", reply: ["cn-envoy-dragonking", "He will like that. He likes people who pay first. It is very rare."], effect: all(sw("dragonking", 2), sw("unfettered", 1), sw("synod", -1), flag("cn:storm")) },
            { heart: "sword", label: "Refuse. Wuji won't trade one master for another.", then: "“Wuji didn't run from one master to buy another,” she says. Hai Yin closes her hand round the pearl.", reply: ["cn-envoy-dragonking", "He will not be offended. He will only remember."], effect: sw("dragonking", -1) },
            { heart: "mercy", label: "Ask for the storm to drive the fleet off, not sink it", then: "“A storm to turn them back,” she says, “not to drown them. There are sailors on those ships with mothers.”", reply: ["cn-envoy-dragonking", "…He has never been asked that. I will ask him. I think he will say yes, out of sheer surprise."], effect: all(sw("dragonking", 1), sw("unfettered", 1), sw("synod", 1), flag("cn:storm"), flag("cn:gentlestorm")) },
            { heart: "slaughter", label: "Ask for the storm to sink every ship", then: "“Sink them,” she says. Hai Yin looks at her for a long time with her sea-coloured eyes.", reply: ["cn-envoy-dragonking", "The sea will do it. The sea does not mind. I mind."], effect: all(sw("dragonking", 1), sw("synod", -3), feed(3), flag("cn:storm")) },
          ],
        },
        done: "The Dragon King offers Wuji a storm out of season against the Synod's fleet, for a pearl from every grey sail, forever.",
      },
      {
        step: 105,
        npc: "cn-envoy-celestial",
        title: "Heaven Is Watching",
        objective: "A star has come down on Wuji's quay. Star-Lord Wenqu of the Celestial Court wishes to speak with the Witness.",
        lines: [
          ["cn-envoy-celestial", "The Jade Emperor has been watching Fusang for three thousand years. He has been waiting for the Synod to overreach. A fleet sent to make a port recant: that is overreaching."],
          ["cn-envoy-celestial", "Heaven keeps the Register of Sects. The Synod's rulings are written in it because heaven could not afford to quarrel with a council that keeps the world cool. That was then."],
          { a: "cn-envoy-celestial", n: "stargaze" },
          ["cn-envoy-celestial", "If the fleet takes Wuji, the Jade Emperor will strike the Synod from the Register. Every cultivator in Fusang will be a cultivator heaven does not recognise. You understand what that would do to their foundations."],
          ["hero", "It would crack them. All of them. The Synod and Wuji alike."],
          ["cn-envoy-celestial", "Heaven does not do fine distinctions at this distance, Witness. That is what people like you are for."],
        ],
        done: "Star-Lord Wenqu warns her that if the Synod's fleet takes Wuji, the Jade Emperor will strike the Synod from heaven's Register, and every foundation in Fusang will crack with it.",
      },
      {
        step: 125,
        npc: "cn-seat-ice",
        title: "Ling Shuang's Terms",
        objective: "The fleet has anchored off the southern horn. Ling Shuang has come ashore under a white flag. Meet her on the quay.",
        lines: [
          ["cn-seat-ice", "Witness. Here are the Synod's terms. Every exile signs the Writ of their Dao, or sails with me to the Hall. No one will be harmed. No one will be harmed who signs."],
          ["cn-seat-ice", "Feng Buji will refuse. He always refuses. He will be the first on my ship. Then the rest will see what refusing costs, and most of them will sign. That is how it is done. It is how it was done to me."],
          { a: "cn-seat-ice", n: "rebuke" },
          ["cn-seat-ice", "Stand aside, and I will remember you stood aside. Stand in my way, and I will remember that too. I do not forget anything. That is the Dao of Ice."],
        ],
        done: "Ling Shuang lays out the Synod's terms on the quay of Wuji: sign the Writs, or sail to the Hall of Writs. Feng Buji will be the first to refuse.",
      },
      {
        step: 140,
        npc: "cn-feng",
        title: "The New Moon",
        objective: "It is the night of the new moon. Ling Shuang is coming ashore with her inquisitors. Go to Feng Buji on the quay.",
        lines: [
          ["cn-feng", "Here she comes. I've known Ling Shuang since she was nineteen and froze half a mountain to stop a valley freezing. She's the bravest person I ever met, and she's wrong."],
          ["cn-feng", "Don't kill her, if you can help it. I'd like to lose this argument to her one day, fair and square."],
        ],
        done: "On the night of the new moon, Ling Shuang comes ashore at Wuji with her inquisitors.",
      },
    ],
    boss: {
      intro: "Ling Shuang, Seat of Ice and Grand Inquisitor, walks up Wuji's quay with the frost spreading out from her feet across the wet stones, and every grey sail in the harbour stiffens with ice",
      words: [
        ["cn-boss", "Sign, or sail. Last offer. I don't make a second."],
        ["hero", "Ice is water that has decided. Spring is water deciding again."],
        ["cn-boss", "Spring is how valleys flood. I have seen it. Draw your sword."],
      ],
      fates: [
        { heart: "mercy", label: "Spare her, and walk her to Feng Buji", line: "She helps Ling Shuang up and walks her to Feng Buji's door. The two of them sit up all night on the quay, arguing about the Dao of Ice, and by dawn neither has convinced the other and the fleet has gone home without its prisoners." },
        { heart: "sword", label: "Break the seal on the fleet's order", line: "She cuts the Speaker's seal off the fleet's order in Ling Shuang's own hand. Without it, the inquisitors have no warrant, and they are very lawful people. The fleet sails home. Ling Shuang goes with it, without her seal, and asks for no other." },
        { heart: "balance", label: "Make her a counter-offer: a hearing at the Council", line: "She offers Ling Shuang terms of her own: the exiles of Wuji will come to the Great Council and be heard, as a power, beside the others. Ling Shuang looks at her a long time, and agrees, and writes it down, because she always writes everything down." },
        { heart: "slaughter", label: "Freeze her where she stands", line: "She turns Ling Shuang's own cold back on her and leaves the Grand Inquisitor standing on the quay in a pillar of her own ice. The fleet sails at dawn without its admiral. They thaw her out in the City of Ten Seats three days later; she takes her seat again, and never once raises her voice above a whisper after, and never holds another inquisition." },
      ],
      victory: "The Synod's fleet leaves the harbour mouth of Wuji. Whatever happens at the Great Council, the Unfettered will be at it.",
    },
  },
  // ============================================================================================== IV
  {
    title: "The Writ of Strange Blood",
    hanzi: "异血之律",
    dao: "lifedeath",
    blurb: "The Purge of Strange Blood was not a madness of the old sects. It was a ruling, written in the City of Ten Seats, and it has never been struck.",
    intrigues: [tk("concord", "synod"), tk("orthodox", "concord"), tk("beasthall", "concord")],
    beats: [
      {
        step: 0,
        npc: "pe-envoy",
        title: "Envoy Shan's Question",
        objective: "Envoy Shan of the Concord has heard the Witness is carrying the Writs. Go to the Concord Stone.",
        lines: [
          ["pe-envoy", "Three hundred years ago the sects called it the Purge of Strange Blood, and hunted my peoples. I have always wondered who told them it was allowed."],
          ["pe-envoy", "Every sect that hunted had a reason in its records. The same reason, in the same words: what is not human cannot comprehend a Great Dao, and so steals heaven's qi by cultivating. Twenty sects, the same sentence. Someone wrote it once."],
          { a: "pe-envoy", n: "unfurl" },
          ["pe-envoy", "You are going to the City of Ten Seats. Where they write sentences down. Find out whose that is."],
        ],
        done: "Envoy Shan shows her that every sect that hunted in the Purge of Strange Blood gave the same reason, in the same words: someone wrote it once.",
      },
      {
        step: 15,
        npc: "cn-envoy-concord",
        title: "The Peoples Come to Council",
        objective: "The Concord has sent its own envoy to the City of Ten Seats for the first time in three hundred years. Find Bai Ling of the fox-folk in the square.",
        lines: [
          ["cn-envoy-concord", "Lin Yue! The clerks didn't know what to do with me. One of them tried to write down how many tails I have. I let him count. It took a while."],
          ["cn-envoy-concord", "The Speaker received me very politely. Nobody would tell me why every Seat looked at the floor when I came in. Except the Seat of Earth. He looked at me as if I were a ghost."],
          { a: "cn-envoy-concord", n: "sniff" },
          ["cn-envoy-concord", "This city smells of old ink and old fear. Under the Hall of Writs it smells of something else. Burnt fur. Very old. Don't laugh; foxes know."],
        ],
        done: "Bai Ling of the fox-folk comes to the City of Ten Seats as the Concord's first envoy in three hundred years, and smells old burnt fur under the Hall of Writs.",
      },
      {
        step: 30,
        npc: "cn-envoy-orthodox",
        title: "The Alliance Remembers Nothing",
        objective: "The Orthodox Alliance's envoy, Situ Heng, has asked to be introduced to the Concord's. Go to the square of the Ten Seats.",
        lines: [
          ["cn-envoy-orthodox", "The Purge. Ah. A dark time. The old sects acted in error, out of fear, three hundred years ago. The Alliance regrets it. The Alliance has always regretted it."],
          ["hero", "In error. On whose authority?"],
          ["cn-envoy-orthodox", "On its own, Witness. On its own. The Alliance answers to no one; that is what orthodoxy means."],
          { a: "cn-envoy-orthodox", n: "rebuke" },
          ["narr", "He says it smoothly, and his hand goes to the jade token at his belt as he says it. It has the Synod's ten-rayed sun cut into the back."],
        ],
        done: "Situ Heng of the Orthodox Alliance says the old sects purged the peoples on their own authority, with the Synod's ten-rayed sun on the jade token at his belt.",
      },
      {
        step: 45,
        npc: "cn-seat-earth",
        title: "The Eleventh Writ",
        objective: "Hou Kun, Seat of Earth, keeps the archive under the Hall of Writs. He has sent for you. Go to him in the square of the Ten Seats.",
        lines: [
          ["cn-seat-earth", "Earth bears what is set on it and does not move. I have borne this for sixty years. I'll move it now."],
          ["narr", "He unrolls it across the Seat of Earth: an eleventh writ, older than the ten, its seal cracked down the middle."],
          ["cn-seat-earth", "The Writ of Strange Blood. Written in this square three hundred and four years ago. What is not human cannot comprehend a Great Dao; its cultivation is theft of heaven's qi; it may be ended without sin. It was sent to the Orthodox Alliance under seal, and they carried it out, sect by sect."],
          ["hero", "And it was never struck."],
          ["cn-seat-earth", "Never struck. A writ is struck by the Council that made it, and the Council would have to admit it made it. So it sits under the other ten, in the dark, and every Speaker for three hundred years has known it is there."],
          { a: "cn-seat-earth", n: "kowtow" },
        ],
        choice: {
          prompt: "The Seat of Earth has gone down on his knees before the eleventh writ. What does she do?",
          options: [
            { heart: "mercy", label: "Take it to Bai Ling, now, before anyone can stop you", then: "She rolls up the Writ of Strange Blood and takes it straight across the square to Bai Ling of the fox-folk, and puts it in her paws.", reply: ["cn-envoy-concord", "…This? This is the whole of it? One page? We burned for one page?"], effect: all(sw("concord", 3), sw("synod", -1)) },
            { heart: "balance", label: "Copy it, and leave the original where it lies, for the Council", then: "She copies it in her own hand, word for word, and leaves the original where it lies. The Council will have to strike it where it was made.", reply: ["cn-seat-earth", "Yes. It must be struck here, or it is only taken away, and things taken away come back."], effect: all(sw("concord", 1), sw("synod", 1), flag("cn:copied")) },
            { heart: "sword", label: "Read it aloud in the square, here and now", then: "She walks out into the square of the Ten Seats and reads the Writ of Strange Blood aloud, to the clerks, the Seats and the envoys, every word.", reply: ["cn-speaker", "…Thank you, Witness. That has needed doing for three hundred years. I did not have the courage."], effect: all(sw("concord", 2), sw("orthodox", -2), flag("cn:readaloud")) },
            { heart: "slaughter", label: "Burn it, and the archive with it", then: "She holds the eleventh writ to the lamp. Hou Kun cries out and does not move to stop her.", reply: ["cn-seat-earth", "Then there is no proof. Do you understand? Now nobody ever has to say they did it."], effect: all(sw("concord", -1), sw("synod", -2), feed(2)) },
          ],
        },
        done: "Hou Kun, Seat of Earth, shows her the eleventh writ under the other ten: the Writ of Strange Blood, written in the City of Ten Seats, carried out by the Orthodox Alliance, and never struck.",
      },
      {
        step: 60,
        npc: "ct-5-leader",
        title: "The Collars in the Vault",
        objective: "Bai Ling says the Beast-Taming Hall's golden collars smell wrong. Go to Hall Master Shou Tianlang at the oasis under Longcheng.",
        lines: [
          ["ct-5-leader", "Collars. Yes. Very old ones in the vault. Lovely work. Too small for camels, too big for wolves; my grandfather never said what they were for."],
          ["hero", "Bai Ling of the fox-folk says they smell of foxes."],
          { a: "ct-5-leader", n: "tame" },
          ["ct-5-leader", "…Then they are what you think they are. The Hall was paid for them, in the Purge. By the Alliance, with Fusang's silver. I didn't know. I didn't ask. I've never asked about anything, Witness; it's why I am good at what I do."],
        ],
        done: "Hall Master Shou Tianlang admits the old golden collars in his vault were made for fox-folk and feathered folk in the Purge, paid for with Fusang's silver.",
      },
      {
        step: 85,
        npc: "cn-envoy-orthodox",
        title: "Gu Wuchen's Letter",
        objective: "Situ Heng has asked for you again, in a much quieter voice. Go to the square of the Ten Seats.",
        lines: [
          ["cn-envoy-orthodox", "A letter came from the Patriarch. From Gu Wuchen himself. I am to read it to you and to no one else."],
          ["cn-envoy-orthodox", "“The Alliance carried out the Writ of Strange Blood because we were paid to and because we believed it. The Synod has paid the Alliance every year since, to keep the old sects orthodox, and we have taken it. Our buyers at the new sects' gates spend Fusang's silver. I will not deny this at the Council. I am too old to be ashamed in private any longer.”"],
          { a: "cn-envoy-orthodox", n: "kowtow" },
          ["cn-envoy-orthodox", "He means it. I have served him forty years; I have never heard him say I was wrong. He has written it to you."],
        ],
        done: "Patriarch Gu Wuchen writes that the Orthodox Alliance carried out the Purge for Fusang's silver and belief, and has been paid by the Synod every year since.",
      },
      {
        step: 105,
        npc: "cn-speaker",
        title: "What the Speaker Wants",
        objective: "The Speaker knows the eleventh writ has been found. She has asked for the Witness. Go to the square of the Ten Seats.",
        lines: [
          ["cn-speaker", "I knew it was there. Every Speaker knows. We are told on the first night, by the Speaker before, in the dark under the Hall."],
          ["cn-speaker", "I will put it to the Great Council to be struck. I will strike it with my own seal. I have wanted to for forty years. But you must understand what striking it means: a Writ of the Synod was wrong. Not misread. Wrong."],
          { a: "cn-speaker", n: "mudra" },
          ["cn-speaker", "If one was wrong, any of them may be. The whole Council will smell it. And then the ten suns begin to rise again, one reading at a time. I will strike it anyway. That is the only thing I will promise you."],
        ],
        done: "The Speaker promises to put the Writ of Strange Blood to the Great Council and strike it with her own seal, knowing that if one Writ was wrong, any of them may be.",
      },
      {
        step: 125,
        npc: "cn-envoy-concord",
        title: "The Peoples' Terms",
        objective: "The six homes of the Concord have sent their answer to the Council by Bai Ling. Go to her in the square of the Ten Seats.",
        lines: [
          ["cn-envoy-concord", "The six homes have talked. Old Granite talked for nine days. Here is what they want. The Writ struck, in the square, by the Speaker's hand. The collars brought out of the Beast-Hall's vault and melted in front of the feathered folk. And the Alliance's patriarch to come to the Concord Stone, not send a letter."],
          { a: "cn-envoy-concord", n: "envoy" },
          ["cn-envoy-concord", "And they want you there when it's done. The last human who carried the Concord's tally led the Purge to our door. They want to see the next one do the opposite."],
        ],
        done: "The six homes of the Concord name their terms: the Writ struck by the Speaker's hand, the collars melted, and the Alliance's patriarch at the Concord Stone in person.",
      },
      {
        step: 140,
        npc: "cn-seat-earth",
        title: "The Keeper of the Writ",
        objective: "Someone has gone down into the archive under the Hall of Writs with a lamp and a jar of oil. Hou Kun has sent for you in a panic.",
        lines: [
          ["cn-seat-earth", "Duanmu Jue. The Alliance's old Keeper of the Writ, who carried it out with his own sword three hundred years ago and has kept it ever since. He is in the archive with oil. If the original burns, the Council cannot strike it, and he never has to have done anything."],
          ["cn-seat-earth", "Go. Go! Earth doesn't move fast. You do."],
        ],
        done: "Duanmu Jue, who carried out the Writ of Strange Blood three hundred years ago, has gone down into the archive under the Hall of Writs to burn it.",
      },
    ],
    boss: {
      intro: "Duanmu Jue, Keeper of the Writ of Strange Blood, turns from the burning shelves of the Hall of Writs with his old sword in his hand and three centuries of collars hung from his belt",
      words: [
        ["cn-boss", "Child. I was there. I know what was done. Let it burn, and nobody will ever have to know it again."],
        ["hero", "They know. They've known for three hundred years. Only you've forgotten."],
        ["cn-boss", "Then let me forget. I am owed that. I did my duty."],
      ],
      fates: [
        { heart: "mercy", label: "Spare him, and take him to the Concord Stone", line: "She spares him and takes him, his collars and all, to the Concord Stone, and he stands before the six homes and says what he did, in order, for two days. The fox-folk do not forgive him. They let him finish." },
        { heart: "sword", label: "Cut the collars from his belt and save the Writ", line: "She cuts the collars from his belt and pulls the Writ of Strange Blood out of the fire, scorched but whole. Duanmu Jue sits down among the smouldering shelves and does not get up again for a long time." },
        { heart: "balance", label: "Make him carry the Writ up to the Council himself", line: "She saves the Writ and puts it into Duanmu Jue's hands, and makes him carry it up the steps of the Hall and across the square to the Speaker, past every envoy. It is the longest walk of his long life." },
        { heart: "slaughter", label: "Let him burn with what he guarded", line: "She lets the archive's fire have him. The Writ comes out of the flames in her hand. The man who carried it out does not. Bai Ling, when she hears, says nothing at all, and the Concord's knot is tied a little tighter on her wrist." },
      ],
      victory: "The Writ of Strange Blood is saved from the fire, scorched, to be struck where it was made.",
    },
  },
  // ============================================================================================== V
  {
    title: "The Starving Daos",
    hanzi: "饿道",
    dao: "wood",
    blurb: "In Fusang, where each Great Dao may be read one way only, the Daos themselves are thinning. The Fusang tree drops its leaves green; the dawn comes late.",
    intrigues: [tk("wei", "talisman"), tk("shu", "cauldron"), tk("qi", "arrays")],
    beats: [
      {
        step: 0,
        npc: "cn-keeper",
        title: "The Leaves Fall Green",
        objective: "Keeper Hou Qing has finished his count. Go up the Valley of Sunrise to the Fusang tree.",
        lines: [
          ["cn-keeper", "Three hundred and four years of numbers. Here. The dawn reaches the tree a breath later every spring. The leaves fall a day earlier. The tree is starving, Witness, in the one place under heaven where the sun is born."],
          ["cn-keeper", "Do you know what a Great Dao eats? Not qi. Not incense. It eats being walked. Every cultivator who reads it, reads it a little differently, and every reading is a root. The Writs cut nine roots out of ten. Then they wonder why the tree is thin."],
          { a: "cn-keeper", n: "pluck" },
          ["cn-keeper", "The Founder of your sect knew this. Ask your old Elder Mo. A Dao is a road, and a road nobody may walk but one way grows over."],
        ],
        done: "Keeper Hou Qing's count is finished: a Great Dao lives by being walked in many ways, and in Fusang, where the Writs allow one way only, the Daos are starving.",
      },
      {
        step: 15,
        npc: "cn-seat-water",
        title: "Water That Flows One Way",
        objective: "Han Qiulan, Seat of Water, wants to show you something by the river below the square.",
        lines: [
          ["cn-seat-water", "Look at the river. Watch the leaves on it."],
          ["narr", "The leaves on the river go downstream, every one. And then she sees that the eddies by the bank go downstream too. Every swirl. There are no backwaters in the river at all."],
          ["cn-seat-water", "The Writ of Water says water yields. So it yields. Always. It never pools, never pushes back, never floods. The rice paddies along it have not flooded in a hundred years. They have not been watered properly in a hundred years either."],
          { a: "cn-seat-water", n: "pour" },
          ["cn-seat-water", "My hands are shaking and it isn't raining. I think I would like to hear your reading of Water now. If you have one."],
        ],
        done: "Han Qiulan shows her a river in Fusang with no eddies: water that only ever yields, as its Writ says, and the paddies along it thirsty for a hundred years.",
      },
      {
        step: 30,
        npc: "cn-seat-fire",
        title: "The Cold Furnaces",
        objective: "Zhu Rong'e, Seat of Fire, has let her hearth go out. Find her in the square of the Ten Seats.",
        lines: [
          ["cn-seat-fire", "The Writ of Fire: fire is kept. In a hearth, a furnace, a lamp. So every fire in Fusang is kept. And every one is a little colder each year, and nobody can say why."],
          ["cn-seat-fire", "I read the struck readings of Fire last winter. Qiao Ling sells them very reasonably. Fire keeps nothing for itself. A fire that is only ever kept forgets what it is for."],
          { a: "cn-seat-fire", n: "warmhands" },
          ["cn-seat-fire", "If you have something warm to say at the Council, Witness, I will vote for it. I am tired of being cold in the Seat of Fire."],
        ],
        done: "Zhu Rong'e, Seat of Fire, has read the struck readings of Fire in secret, and will vote for anything warm the Witness has to say at the Council.",
      },
      {
        step: 45,
        npc: "elder",
        title: "A Letter to Elder Mo",
        objective: "Keeper Hou Qing said to ask Elder Mo about the Founder and the Daos. Go home to the Azure Cloud Sect.",
        lines: [
          ["elder", "The Founder? She used to say: I did not comprehend the Dao of the Wind. I comprehended my Dao of the Wind, and so did every disciple after me, and the Wind is all of us."],
          ["elder", "When she wrote her steles on the Founder's Road, she wrote questions, not answers. People thought it was modesty. It was not. A question can be walked many ways. An answer, only one."],
          { a: "elder", n: "lecture" },
          ["elder", "If the Synod's Writs are signed under heaven, Lin Yue, the steles will be read one way only. And the sect will float a little lower every year, and nobody will know why."],
        ],
        done: "Elder Mo tells her the Founder wrote questions on her steles, not answers, because a question can be walked many ways and an answer only one.",
      },
      {
        step: 60,
        npc: "cn-envoy-ninesprings",
        title: "Yan Ling's Name",
        objective: "Ghost-Clerk Cui Jue of the Nine Springs has brought a page from King Yama's ledger. Find him under the parasol of the empty seat.",
        lines: [
          ["cn-envoy-ninesprings", "Yan Ling, last Seat of Life and Death. Her name was struck in our ledger nine years ago. Cause of death, as entered: recantation."],
          ["cn-envoy-ninesprings", "She read Life and Death as the peoples do: that what is not written still lives. The Synod asked her to recant. She did, on the floor of the Hall. Her Dao heart cracked through. She was dead by morning."],
          { a: "cn-envoy-ninesprings", n: "unfurl" },
          ["cn-envoy-ninesprings", "King Yama has asked me to say this to the Council: the Springs have never once struck a name for holding the wrong opinion. The Synod has. We would like it to stop doing our work for us."],
        ],
        done: "Ghost-Clerk Cui Jue brings King Yama's ledger: Yan Ling, last Seat of Life and Death, died of recanting a reading the Synod had struck.",
      },
      {
        step: 85,
        npc: "cn-speaker",
        title: "The Speaker's Fear",
        objective: "Speaker Xi He has gone up the Valley of Sunrise alone, at night. Follow her to the Fusang tree.",
        lines: [
          ["narr", "The Speaker is sitting among the roots of the Fusang tree in the dark, with a fallen leaf over her knees like a blanket."],
          ["cn-speaker", "I know. I have known for twenty years. I read Hou Qing's numbers before he did; I am the Seat of the Void, I hold everything."],
          ["cn-speaker", "A starved Dao is a safe Dao, Lin Yue. A thin dawn burns nobody. I have watched what one certain reading did to four villages in the north. Imagine ten readings of every Dao, walked freely, by a hundred thousand cultivators. Imagine ten suns."],
          { a: "cn-speaker", n: "daodoubt" },
          ["cn-speaker", "I would rather the tree died slowly than the world burned quickly. That is my reading. I have never told anyone. Now I have told you, and you will tell the Council, and they will tear me down for it."],
        ],
        choice: {
          prompt: "The Speaker is waiting, under the dying tree, for the Witness to say she is wrong. What does she say?",
          options: [
            { heart: "mercy", label: "“You were afraid. That isn't a crime.”", then: "She sits down in the roots beside the Speaker. “You were afraid,” she says. “For everyone. That isn't a crime.”", reply: ["cn-speaker", "…No one has said that to me in forty years. I did not know I wanted to hear it."], effect: all(sw("synod", 2), flag("cn:speakerheard")) },
            { heart: "balance", label: "“Ten suns burned. One starves. There's a road between.”", then: "“Ten suns burned the world,” she says. “One is starving it. There's a road between the two, and nobody has walked it.”", reply: ["cn-speaker", "Then walk it. In front of the Council. If you fall, you fall in front of everyone."], effect: all(sw("synod", 1), flag("cn:middleroad")) },
            { heart: "sword", label: "“You chose for a whole world. That was never yours.”", then: "“You chose for everyone,” she says. “Nobody gave you that.” The Speaker does not flinch.", reply: ["cn-speaker", "The Void gave it to me. Holding everything is the seat. You may have it, if you think you can do it better."] },
            { heart: "slaughter", label: "“Then the Council will tear you down, and I'll help.”", then: "She stands up out of the roots. “They will tear you down,” she says, “and I'll hand them the rope.”", reply: ["cn-speaker", "Yes. I thought you might. I have been wrong about a great many things; not about you."], effect: all(sw("synod", -2), feed(2)) },
          ],
        },
        done: "Under the dying Fusang tree, Speaker Xi He confesses she has known the Daos were starving for twenty years, and chose a slow death for the tree over ten suns for the world.",
      },
      {
        step: 105,
        npc: "cn-envoy-celestial",
        title: "Heaven's Register Thins",
        objective: "Star-Lord Wenqu has come down again, with a page of heaven's Register of Sects. Find him in the square of the Ten Seats.",
        lines: [
          ["cn-envoy-celestial", "Every sect under heaven is written in the Register, and every Great Dao it walks. Here is Fusang's page. Here it is a century ago. Here it is three centuries ago."],
          ["narr", "The oldest page is crowded to the edges with names and readings, written over each other, in a hundred hands. The newest has ten lines on it, in one hand, very neat."],
          { a: "cn-envoy-celestial", n: "unfurl" },
          ["cn-envoy-celestial", "Heaven does not mind neatness. Heaven minds an empty page. The Jade Emperor bids me ask the Witness: is the Synod keeping the Daos, or keeping them from us?"],
        ],
        done: "Star-Lord Wenqu shows her Fusang's page in heaven's Register: three centuries ago crowded with a hundred readings, now ten neat lines in one hand.",
      },
      {
        step: 125,
        npc: "cn-keeper",
        title: "What Was Struck Comes Back",
        objective: "Something is moving under the Fusang tree at night. Keeper Hou Qing has sent for the Witness urgently.",
        lines: [
          ["cn-keeper", "The Speaker told you struck readings go nowhere at all. That was the mercy of it. She was wrong. They go into the roots."],
          ["cn-keeper", "Three thousand years of every reading the Synod struck, of every Dao, piled up in the dark under the tree that drinks the dawn. Starving. Last night they stood up."],
          { a: "cn-keeper", n: "recoil" },
          ["cn-keeper", "It calls itself the Unwritten. It wants to be read. It wants to be read so much it will eat anyone who can read, to have their eyes."],
        ],
        done: "Every reading the Synod has struck in three thousand years has gathered in the roots of the Fusang tree, starving, and stood up as the Unwritten.",
      },
      {
        step: 140,
        npc: "cn-keeper",
        title: "Under the Roots",
        objective: "The Unwritten has come up out of the roots of the Fusang tree. Go to Keeper Hou Qing in the Valley of Sunrise.",
        lines: [
          ["cn-keeper", "It's at the foot of the tree. Ten Daos, all wrong and all right, in one body. Whatever you do to it, Witness, you do to every heretic Fusang ever had."],
        ],
        done: "The Unwritten waits at the foot of the Fusang tree: every struck reading of every Great Dao, in one starving body.",
      },
    ],
    boss: {
      intro: "The Unwritten rises out of the roots of the Fusang tree: a shape made of ten thousand struck readings of ten Great Daos, every one of them whispering its own meaning at once",
      words: [
        ["cn-boss", "Read us. Read us. Read us. Nobody reads us."],
        ["hero", "I can't read all of you at once."],
        ["cn-boss", "Then we will read you."],
      ],
      fates: [
        { heart: "mercy", label: "Read it aloud, every reading, until it is quiet", line: "She sits down in the roots and reads the Unwritten aloud, reading after reading, all night, the way a mother reads to a feverish child. One by one the readings stop whispering and lie down. At dawn the light reaches the Fusang tree a breath earlier than it did the day before." },
        { heart: "sword", label: "Cut it apart into its readings and set each one free", line: "She cuts the Unwritten apart along its seams, reading from reading, and each one goes up into the branches of the Fusang tree like a moth. By morning the tree is full of them, rustling, arguing, alive." },
        { heart: "balance", label: "Seal it under the tree, and promise it a hearing", line: "She seals the Unwritten back under the roots, gently, with a promise: at the Great Council, every struck reading will be read into the record. It goes down quiet, to wait. It has waited three thousand years. It can wait a little longer." },
        { heart: "slaughter", label: "Devour it: three thousand years of readings, all yours", line: "She opens her dantian and eats it. Three thousand years of forbidden understanding pours into her at once. For a moment she understands everything, every way, and it burns. When it is over she can barely stand, and the Fusang tree has lost every leaf it had." },
      ],
      victory: "The Unwritten is quiet under the Fusang tree. The Great Council of the Daos is called for the next new moon.",
    },
  },
  // ============================================================================================== VI
  {
    title: "The Great Council of the Daos",
    hanzi: "论道大会",
    dao: "thunder",
    blurb: "Every power under heaven sits in the square of the Ten Seats to decide what the Great Daos mean. The Witness speaks last.",
    intrigues: [tk("wei", "ironbanner"), tk("shu", "yan"), tk("liang", "chen")],
    beats: [
      {
        step: 0,
        npc: "cn-speaker",
        title: "The Council Is Opened",
        objective: "Every envoy under heaven has come to the City of Ten Seats. The Speaker opens the Great Council of the Daos. Go to the square.",
        lines: [
          ["narr", "The square of the Ten Seats is full to the walls: twenty-two envoys under twenty-two banners, clerks at a hundred desks, and the exiles of Wuji standing at the back in grey."],
          ["cn-speaker", "The Great Council of the Daos is open. We are here to sign the Ten Writs, so that every Great Dao means one thing under heaven. Or we are here to decide not to. I no longer know which."],
          { a: "cn-speaker", n: "mudra" },
          ["cn-speaker", "The Witness has carried the Writs to every throne, seen the exiles of Wuji, found the eleventh writ and faced what lives under the tree. She will speak last. Everyone else speaks first."],
        ],
        done: "Speaker Xi He opens the Great Council of the Daos before twenty-two envoys and the exiles of Wuji, and gives the Witness the last word.",
      },
      {
        step: 15,
        npc: "cn-envoy-wei",
        title: "Wei Speaks for the Writs",
        objective: "Northern Wei's envoy, Dou Mao, has the floor. Go and hear him.",
        lines: [
          ["cn-envoy-wei", "Wei will sign. Wei has a wall, and a wall needs to know what heaven means by it. Sign, and no throne need ever again say its sons died under the wrong omen."],
          ["narr", "He sits down to applause from the Orthodox Alliance's benches. Across the square, the Iron Banner's envoy, Ashide, is watching him with an odd, flat expression."],
          { a: "cn-envoy-ironbanner", n: "rebuke" },
        ],
        done: "Northern Wei's envoy speaks for the Writs, to the Alliance's applause, while the Iron Banner's envoy watches him oddly.",
      },
      {
        step: 30,
        npc: "cn-envoy-ironbanner",
        title: "The Khan's Envoy",
        objective: "Banner-Speaker Ashide of the Iron Banner has asked to speak to the Witness before he speaks to the Council.",
        lines: [
          ["cn-envoy-ironbanner", "Witness. You have heard Wei say the Writs will tell its sons heaven is on its wall. I will tell you something about Wei's wall. Two of its passes were sold to our scouts by Wei's own Conscription Office. We paid in gold."],
          ["cn-envoy-ironbanner", "The war that fills Wei's ranks fills its nobles' purses. Wei does not want a Mandate written down. Wei wants nobody ever to read its accounts."],
          { a: "cn-envoy-ironbanner", n: "cupfist" },
          ["cn-envoy-ironbanner", "The Khan does not want the Writs. The Khan wants grass, and a peace he does not have to beg for. Tell the Council that, if you think anyone will listen to a wolf."],
        ],
        done: "Banner-Speaker Ashide of the Iron Banner tells her Wei's Conscription Office sold two passes to the horde's scouts, and that the Khan wants grass, not writs.",
      },
      {
        step: 45,
        npc: "cn-envoy-bloodmoon",
        title: "The Crimson Envoy",
        objective: "The Blood Moon has sent an envoy too, and the whole square has moved its benches away from him. Go and hear what he wants.",
        lines: [
          ["cn-envoy-bloodmoon", "Don't touch your sword. Everyone touches their sword. I am here under the Synod's own peace, with the Synod's own seal."],
          ["cn-envoy-bloodmoon", "The orthodox call our road demonic because it is short. Fine. But we read the Dao of Life and Death, Witness. Badly, cruelly, our own way. If the Writs are signed, our reading is struck, and every cultivator of the Blood Moon cracks overnight. A thousand of us. Some of them are children."],
          { a: "cn-envoy-bloodmoon", n: "bow" },
          ["cn-envoy-bloodmoon", "I am not asking you to like us. I am asking whether you want a thousand of us to die of a vote."],
        ],
        choice: {
          prompt: "The Blood Moon's envoy waits with his hands folded in his sleeves, and the whole square is watching her. What does she say?",
          options: [
            { heart: "mercy", label: "“No one should die of a vote. Not even you.”", then: "“No one should die of a vote,” she says, loudly enough for the square. “Not even the Blood Moon.” Half the benches mutter. The Nine Springs' clerk writes something down.", reply: ["cn-envoy-bloodmoon", "…I was told you were the Azure Cloud's. I see I was told wrong. Or right, in a way they did not mean."], effect: all(sw("bloodmoon", 3), sw("azure", -1), sw("ninesprings", 1)) },
            { heart: "balance", label: "“Then give the Springs back the names you stole, and be heard.”", then: "“Give the Nine Springs back the names you stole,” she says, “and the Council will hear you like anyone else.”", reply: ["cn-envoy-bloodmoon", "That is a price. I can carry a price home. I can't carry a refusal."], effect: all(sw("bloodmoon", 1), sw("ninesprings", 2), mend("bloodmoon", "ninesprings", 1)) },
            { heart: "sword", label: "“Your reading should be struck. You shouldn't.”", then: "“Your reading of Life and Death should be struck,” she says, “and you should live to read it better.”", reply: ["cn-envoy-bloodmoon", "That is the most orthodox thing anyone has said to me, and the kindest. I don't know what to do with it."], effect: sw("bloodmoon", 1) },
            { heart: "slaughter", label: "“A thousand fewer Blood Moon cultivators. I'll vote for that.”", then: "She says it to his face. The Alliance's benches laugh. The Blood Moon's envoy does not.", reply: ["cn-envoy-bloodmoon", "Then you and the Synod are the same thing, Witness, only louder."], effect: all(sw("bloodmoon", -3), sw("orthodox", 1), feed(3)) },
          ],
        },
        done: "The Blood Moon's envoy asks whether the Council means a thousand of its cultivators, some of them children, to die of a vote.",
      },
      {
        step: 60,
        npc: "cn-seat-thunder",
        title: "The Seat of Thunder",
        objective: "Lei Zhenzi, Seat of Thunder, has the floor, and has said he will speak only to the Witness. Go and hear him.",
        lines: [
          ["cn-seat-thunder", "Thunder is heaven's judgement, the Writ says, and only heaven's. Very well. Heaven has sent its envoy, and he says the Jade Emperor will strike the Synod from the Register if it oversteps. Thunder, Witness. Coming for the Synod."],
          ["cn-seat-thunder", "I have voted for every Writ for sixty years. I believe in them. I believe in heaven more. If heaven says the Writs overreach, the Seat of Thunder votes with heaven."],
          { a: "cn-seat-thunder", n: "thundercall" },
          ["cn-seat-thunder", "That is two Seats you have turned without saying a word in the Council. Fire, and now me. The Speaker has noticed. Be careful."],
        ],
        done: "Lei Zhenzi, Seat of Thunder, will vote with heaven against the Writs if heaven says they overreach.",
      },
      {
        step: 85,
        npc: "cn-feng",
        title: "Wuji at the Council",
        objective: "The Unfettered have been given a bench at the Council. Feng Buji means to speak for Wuji, and wants a word with the Witness before he sails up. Go to Wuji.",
        lines: [
          ["cn-feng", "Here's what I'll say up there. We are the exiles of Wuji. We are the ones the Writs are for. Every reading the Synod ever struck lives in our port, in grey board, in our hands."],
          ["cn-feng", "We don't want the Writs burned. We'd like to read them, very much, side by side with ours. We don't want to be the law. We want to stop being the crime."],
          { a: "cn-feng", n: "unfurl" },
          ["narr", "He holds up a grey-board book. “Zhu Rong'e has one of these, you know. The Seat of Fire. She's going to hold hers up when I hold up mine. In front of everyone.”"],
        ],
        done: "Feng Buji will speak for Wuji at the Council: the exiles want to read the Writs side by side with their own readings, and stop being the crime.",
      },
      {
        step: 105,
        npc: "cn-speaker",
        title: "The Witness Speaks",
        objective: "Every envoy has spoken. It is the Witness's turn. Go to the Speaker's chair in the square of the Ten Seats.",
        lines: [
          ["cn-speaker", "Witness. The Council has heard everyone but you. What do you say?"],
          { a: "hero", n: "daovow" },
          ["narr", "She stands up in the middle of the square of the Ten Seats, under ten parasols and twenty-two banners, and says what she has come to say."],
        ],
        choice: {
          prompt: "The whole of the Great Council of the Daos is listening. What does the Witness say?",
          options: [
            { heart: "balance", label: "A Charter of a Hundred Daos: every reading written, none struck", then: "“Keep the Writs,” she says. “Every one. And beside each, every reading the Synod ever struck, and every reading anyone brings. A Charter, not a law. The Daos live on being walked. Let them be walked.”", reply: ["cn-speaker", "A library under heaven. …Hou Qing will be insufferable."], effect: all(flag("cn:proposed:charter"), steady(4)) },
            { heart: "sword", label: "Strike all Ten Writs. No Dao has an owner.", then: "“Strike them,” she says. “All ten. And the eleventh. No Dao has an owner, and a reading that needs a writ to stand was never a reading.”", reply: ["cn-feng", "Ha! She stole my line. She stole my line in front of the whole Council!"], effect: flag("cn:proposed:strike") },
            { heart: "mercy", label: "Strike the eleventh writ first, then talk about the ten", then: "“First,” she says, “strike the Writ of Strange Blood, in front of the peoples, today. Then we can talk about the other ten as people who have done one right thing.”", reply: ["cn-envoy-concord", "…She said it. She said it in the square."], effect: all(flag("cn:proposed:mercy"), sw("concord", 2)) },
            { heart: "slaughter", label: "Sign the Writs, and let the weak readings break", then: "“Sign them,” she says. “If a reading breaks under a vote, it was never strong enough to walk.”", reply: ["cn-seat-ice", "…I did not expect the Witness to be on my side. I find I do not like it."], effect: all(flag("cn:proposed:sign"), sw("unfettered", -4), feed(3)) },
          ],
        },
        done: "The Witness speaks to the Great Council of the Daos.",
      },
      {
        step: 125,
        npc: "cn-speaker",
        title: "The Vote",
        objective: "The Council votes. Go back to the square of the Ten Seats.",
        lines: [
          ["narr", "Twenty-two banners. Nine Seats and an empty one. A hundred clerks. One vote each, cast in silence, a black stone or a white one into the bronze bowl under the Speaker's chair."],
          ["cn-speaker", "{vote}"],
          { a: "cn-speaker", n: "sealtreaty" },
        ],
        done: "The Great Council of the Daos votes.",
      },
      {
        step: 140,
        npc: "cn-speaker",
        title: "The Void Will Not Yield",
        objective: "The vote is cast. The Speaker has risen from the Seat of the Void, and the air in the square has gone very still. Go to her.",
        lines: [
          ["cn-speaker", "I said I would strike the eleventh writ, and I have. I did not say I would watch the ten suns rise."],
          ["cn-speaker", "The Void holds everything. Today it will hold the Council, and you, until you show me the road between the burning and the starving is real. Not in words. Words are what we have had for three thousand years."],
          { a: "cn-speaker", n: "mudra" },
        ],
        done: "Speaker Xi He rises from the Seat of the Void, and will hold the whole Council in her domain until the Witness proves the road between ten suns and one is real.",
      },
    ],
    boss: {
      intro: "Xi He, Speaker of the Synod, rises from the Seat of the Void, and the square of the Ten Seats folds away into a stillness with nothing in it but the two of them and ten faint suns",
      words: [
        ["cn-boss", "Show me, Witness. Show me a world with every reading in it that does not burn."],
        ["hero", "I can't show you. Nobody can. We'll have to walk it."],
        ["cn-boss", "Then walk it through me."],
      ],
      fates: [
        { heart: "mercy", label: "Lay down your sword, and hold her until the Void lets go", line: "She lays down her sword in the Void and holds the Speaker, who has held everything for forty years and been held by no one. The Void lets go of the square all at once. Xi He weeps in front of the whole Council, and stays Speaker, and is a different one." },
        { heart: "sword", label: "Cut the Void open, and let the square back in", line: "She cuts the Void open from the inside, one stroke, and the square of the Ten Seats comes flooding back, noise and banners and clerks and all. Xi He stands in the middle of it, emptied, and steps down from the Seat of the Void of her own accord." },
        { heart: "balance", label: "Offer her the Charter to keep, as its first keeper", line: "She offers Xi He the Charter to keep, not the Writs: every reading, side by side, and a Speaker whose work is to keep them all, not to choose. The Speaker takes it. The Void folds itself away into a reading room." },
        { heart: "slaughter", label: "End the Speaker in her own Void", line: "She ends the Speaker inside her own Void, where no one can see. When the square comes back, the Seat of the Void is empty, and every envoy in it is looking at the Witness the way the Synod used to look at the ten suns." },
      ],
      victory: "The Void lets go of the square of the Ten Seats. Whatever the Council decided, the Great Daos of the world are walked a little differently from today.",
    },
  },
];
