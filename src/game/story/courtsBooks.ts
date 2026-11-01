import type { GameState } from "../engine/state";
import { CULT, shift } from "../engine/cultivation";
import type { Beat, Fate } from "./hallsBooks";

/**
 * The words of the Thrones and the Crafts (story/courts.ts composes the
 * quests): six books, one for each throne of the mortal world and the sect
 * sworn to guard it. Each is a tale told in hand-written beats, and between
 * the beats the life of its court: its ceremonies (main quests), its folk's
 * favours, its guild's lessons, goods carried between the capitals, tales
 * carried to the jianghu's folk, hunts, sittings at shrines all over the
 * jianghu and walks to its places (side quests).
 *
 * Under all six runs one question: what the strong owe the weak, and what the
 * weak owe the strong. The Covenant of Cloud and Throne kept sects and
 * emperors apart for eight hundred years. Since the Jade Lotus Heart was
 * stolen, the spirit veins under the mortal lands have run thin, the harvests
 * have failed, and someone has been forging edicts in the emperors' names and
 * decrees in the sect leaders', to set the two against each other. He is
 * Fei Lian, Grand Tutor to six thrones, who taught every one of the six
 * rulers their letters, and whom no sect would take when he was nine.
 *
 * Keys: "ct-emperor" and "ct-guide" are this book's emperor and guide,
 * "ct-folk-<n>" one of the court's folk, "ct-leader" the sect's leader,
 * "ct-disciple-<n>" one of its disciples, "ct-master" the guild's master and
 * "ct-boss" its trouble. Lines may name her standing: {title} (what a mortal
 * calls her), {peer} (what a cultivator calls her) and {realm}.
 */

export interface CourtBook {
  title: string;
  hanzi: string;
  /** The realm the book asks of her as it opens (an overall level index). */
  level: number;
  beats: Beat[];
  /** The court's ceremonies (main quests between the beats): a title, what she must do, and how it goes (and, for a ceremony that only makes sense once the tale has got so far, the step of the book it waits for). */
  rites: { title: string; ask: string; done: string; after?: number }[];
  /** The folk's favours (side quests): what is asked, and what is said when it is done. */
  favours: { ask: string; done: string }[];
  /** The guild's lessons (craft side quests): what the master sets her to, and what is said of her work. */
  lessons: { ask: string; done: string }[];
  /** What the capital sends to the other capitals (trade side quests). */
  goods: string[];
  /** What the jianghu says when she tells it of this court (tale side quests). */
  tales: string[];
  /** What the emperor and the guide say between the beats (the first line from the start of the book, the rest once its tale is well along). */
  emperor: string[];
  guide: string[];
  /** What the sect's leader says between the beats. */
  leader: string[];
  boss: { intro: string; words: [string, string][]; fates: Fate[]; victory: string };
}

const feed = (by: number) => (g: GameState) => shift(g, CULT.demon, by);
const quiet = (by: number) => (g: GameState) => shift(g, CULT.demon, -by);

export const COURT_BOOKS: CourtBook[] = [
  // ------------------------------------------------------------------------------------------------ I · Great Liang
  {
    title: "The Empty Granaries",
    hanzi: "空仓",
    level: 3,
    beats: [
      {
        step: 0,
        npc: "ct-emperor",
        title: "Summoned to the Granary Throne",
        objective: "A rider in imperial yellow has been asking along every road for 'the Azure Cloud's wandering disciple'. Emperor Xuande of Great Liang summons you to Liangdu, west of the Golden River. Go to the throne in the palace square.",
        lines: [
          ["narr", "The square of Liangdu is paved in yellow stone. A golden throne stands under a silk canopy in the open air, so that the people can see their emperor. The emperor is old, and he is not sitting on it. He is standing beside it, reading a granary tally."],
          ["ct-emperor", "You are not of the Golden Crane. Good. You are not of any sect that eats from my fields. That is why I sent for you."],
          ["ct-emperor", "The harvest of Liang was fair this year. Not rich: {soil}, the farmers say. But fair. And my granaries are empty."],
          ["ct-emperor", "Eight hundred years ago the first Liang emperor and the first Golden Crane swore the Covenant of Cloud and Throne. The sect guards us; we feed it a tithe of a tenth. A tenth, {title}. Somebody is taking half."],
        ],
        after: [["ct-emperor", "Find out who. If it is the sect, I will tear up the Covenant with my own hands, and the other five thrones will follow me. If it is not, I will owe a cultivator an apology, which no Liang emperor has ever done."]],
        done: "Emperor Xuande gives her a jade tally that opens every granary door in Liang. Minister Tian Shou bows and says, in a voice the emperor cannot hear, that the granaries were full last spring.",
      },
      {
        step: 20,
        npc: "ct-leader",
        title: "The Golden Crane's Answer",
        objective: "The Golden Crane Sect's seat stands on its levelled terrace north-west of Liangdu. Ask Sect Master He Lingxiao about the tithe.",
        lines: [
          ["ct-leader", "Half? We have received less than a tenth for three years. We have been eating our own spirit rice and saying nothing, because a sect that complains of hunger to mortals is a sect that has forgotten what it is for."],
          { a: "ct-leader", n: "meditate" },
          ["ct-leader", "And now a decree arrives under my own seal, ordering my disciples to take the tithe by force from any village that is late. I did not write it. It is my seal. It is my hand. I did not write it."],
          ["ct-leader", "Someone wants Liang and the Crane at each other's throats, {peer}. Someone who can write like an emperor and like a sect master both."],
        ],
        choice: {
          prompt: "He Lingxiao asks what she means to tell the emperor.",
          options: [
            { heart: "mercy", label: "The truth, and that both are being robbed", then: "She says she will tell the emperor that his granaries and the Crane's storehouses are being emptied by the same hand.", reply: ["ct-leader", "Then tell him gently. Old men who are frightened tear up covenants."], effect: quiet(2) },
            { heart: "sword", label: "Nothing until she has the thief", then: "She says words are worth nothing at court. She will bring the emperor a thief, not a theory.", reply: ["ct-leader", "A cultivator's answer. Bring him the thief, then. Alive, if you can."] },
            { heart: "balance", label: "Ask him to send a disciple with her", then: "She asks for one of the Crane's disciples to walk the granaries with her, so that throne and sect see the same thing.", reply: ["ct-leader", "Disciple Yu. He is honest and too young to lie well. Take him."] },
            { heart: "slaughter", label: "Warn him the emperor may need frightening", then: "She says an emperor who threatens covenants should be reminded what a sect is.", reply: ["ct-leader", "…No. That is exactly what whoever forged my seal wants. Do not give it to him."], effect: feed(3) },
          ],
        },
        done: "Sect Master He shows her the forged decree. The seal is perfect. In the corner, almost too small to see, the paper has a watermark: a writing brush crossed with a scholar's tablet.",
      },
      {
        step: 40,
        npc: "ct-master",
        title: "What the Fields Know",
        objective: "Old Field-Master Tian Lao has farmed spirit rice for sixty years. He says the fields will tell you what the granary clerks won't. Take up the art of spirit farming with him and listen.",
        lines: [
          ["ct-master", "Kneel. No, in the mud. A cultivator who won't kneel in a paddy will never grow anything but her own head."],
          { a: "ct-master", n: "sow" },
          ["ct-master", "Feel that? The qi under the water is thin. {soil}. But it isn't gone. A field that gives a third less still gives. The harvest was there."],
          ["ct-master", "And the carts came for it. Grey carts, with no tally flags. They paid the farmers in good coin, more than the tithe. Every farmer in Liang sold to them. Who wouldn't?"],
        ],
        done: "Tian Lao takes her on as his apprentice. Her hands come out of the paddy green to the wrist, and they smell of rice for a day. (The art of Spirit Farming: see the Journal.)",
      },
      {
        step: 60,
        npc: "ct-folk-3",
        title: "The Clerk's Second Ledger",
        objective: "Granary Clerk Wu keeps the tallies. Ask to see them, and ask why there are two sets.",
        lines: [
          ["ct-folk-3", "Two? There aren't — there aren't two. Magistrate Gou keeps the second. I only copy. I only copy what I'm given, {title}, I have a mother."],
          { a: "ct-folk-3", n: "write" },
          ["ct-folk-3", "The grey carts are his. He buys the harvest before the tithe can be taken, then sells it north, east, everywhere, to whoever sends a man with a brush-and-tablet seal. He says it's for the Grand Tutor's charity granaries."],
          ["ct-folk-3", "The Grand Tutor. Fei Lian. He taught the emperor his letters. He taught all six emperors their letters. Nobody asks the Grand Tutor anything."],
        ],
        choice: {
          prompt: "Clerk Wu is shaking. If Magistrate Gou learns he talked, he will lose more than his post.",
          options: [
            { heart: "mercy", label: "Promise him protection", then: "She tells him to go to the Golden Crane's seat tonight and stay there until it is over.", reply: ["ct-folk-3", "The sect? They'll — yes. Yes. Thank you."], effect: quiet(2) },
            { heart: "sword", label: "Take the ledger and go now", then: "She takes the second ledger and goes straight for the magistrate's granary.", reply: ["ct-folk-3", "Now? Tonight? Heaven help us."] },
            { heart: "balance", label: "Ask him to copy it for the emperor", then: "She asks him to make one more copy, for the emperor, in his own hand, so the throne has its own proof.", reply: ["ct-folk-3", "A copy. Yes. Copying I can do."] },
            { heart: "slaughter", label: "Tell him he should have spoken sooner", then: "She tells him his silence fed the thief for three years, and walks out.", reply: ["ct-folk-3", "…I know. I know. I have a mother."], effect: feed(3) },
          ],
        },
        done: "In the second ledger, every sale is stamped with the same small seal: a brush crossed with a scholar's tablet. Beside the last entry, in a different hand: 'Enough. Burn the rest.'",
      },
      {
        step: 80,
        npc: "ct-guide",
        title: "The Minister's Doubt",
        objective: "Granary Minister Tian Shou has been watching you. He wants a word away from the throne.",
        lines: [
          ["ct-guide", "The Grand Tutor visited His Majesty last spring. He asked how full the granaries were. He asked very kindly. He always asks very kindly."],
          ["ct-guide", "Then he went on to Southern Chen, and to Shu, and to Wei, and to Qi, and to Yan. He visits all six courts every year. Every year since before any of them were crowned."],
          ["ct-guide", "I am a granary minister. I count. And I count that whatever is happening here began the year the Heart was stolen from your sect, and that Fei Lian's charity granaries are full of rice that nobody is eating."],
        ],
        done: "Tian Shou gives her the Grand Tutor's itinerary for the year. Liang, Chen, Shu, Wei, Qi, Yan, in that order. The same order every year.",
      },
      {
        step: 140,
        npc: "ct-emperor",
        title: "The Granary Rat",
        objective: "Magistrate Gou has been seen burning ledgers at the old granary south of the capital. Tell the emperor what you know before you go after him.",
        lines: [
          ["ct-emperor", "Gou. I made him magistrate. His father carried my father's sedan. And he has been starving my people to fill a tutor's charity."],
          ["ct-emperor", "The Grand Tutor I cannot touch. He has no office to strip, no lands to seize, and every court under heaven would ask why Liang raised its hand against the man who taught us all to write. But Gou I can."],
          { a: "ct-emperor", n: "proclaim" },
          ["ct-emperor", "Go, {title}. Bring me the Granary Rat. And tell He Lingxiao that the emperor of Liang owes the Golden Crane an apology, and that he will make it in person, kneeling, in the mud of a paddy if that is where the old fool wants it."],
        ],
        done: "The emperor writes the warrant himself. Out on the south road, the smoke of burning paper goes up from the old granary.",
      },
    ],
    rites: [
      { title: "The First Furrow", ask: "walk behind the emperor as he cuts the year's first furrow with a golden plough, and carry the seed basket", done: "The emperor cuts the furrow crooked. Nobody says so. The farmers cheer anyway, and the seed she scatters comes up the next morning, which nobody has seen happen in forty years." },
      { title: "The Granary Rite", ask: "stand witness at the opening of the Ever-Normal Granary, where the throne keeps grain against famine, and count the sacks", done: "She counts the sacks twice. They are all there. The minister weeps a little, then pretends it is the dust." },
      { title: "Rice for the Crane", after: 80, ask: "carry the year's tithe of spirit rice up to the Golden Crane's seat in the emperor's own name", done: "He Lingxiao receives the tithe kneeling. He has not knelt to a mortal's gift in two hundred years. 'It is not to the gift,' he says. 'It is to the hand that sent it.'" },
      { title: "The Harvest Moon Feast", after: 20, ask: "sit at the harvest feast in the palace square, between a farmer and a sect elder, and keep them both talking", done: "The farmer tells the elder how long it takes to grow a grain of rice. The elder tells the farmer how long it takes to grow a golden core. By the end of the feast they are arguing about which is harder, and enjoying it." },
      { title: "The Locust Watch", after: 20, ask: "keep watch over the southern paddies through the night, with the Crane's disciples and the farmers' sons together, in case the locusts come", done: "The locusts do not come. The disciples and the farmers' sons play xiangqi on an upturned basket till dawn, and the farmers' sons win." },
    ],
    favours: [
      { ask: "find her ox, which wandered into the Golden Crane's terrace and will not come down", done: "“He likes the sect. He likes the quiet. Well. He can visit on holidays.”" },
      { ask: "read a letter from her son in the army to her, because she never learned", done: "“He says he's well. He says the food is bad. He's well, then. He always complains when he's well.”" },
      { ask: "carry a bowl of rice gruel to the old granary-keeper who lost his post", done: "“From her? She's a kind girl. Tell her I'm eating it. Tell her I'm eating it slowly.”" },
      { ask: "help mend the dyke on the east paddy before the rains", done: "“A cultivator with mud to her knees. Now I've seen everything. Thank you, {title}. Truly.”" },
      { ask: "ask the Golden Crane disciples to stop flying over the market, because the chickens stop laying", done: "“They said sorry! A sect said sorry to a chicken-wife! Liang has changed.”" },
      { ask: "find out why the well in the square tastes of copper", done: "“Coins at the bottom. Wishes. Hundreds of years of wishes. We'll leave them, I think.”" },
    ],
    lessons: [
      { ask: "sow a paddy of spirit rice by hand, a seed to each finger-width, without letting your qi touch the water", done: "Tian Lao walks the rows and nods. 'Straight enough. The rice will forgive you the rest.'" },
      { ask: "listen to the qi under three fields and tell him which one is sick", done: "She picks the sick one. Tian Lao grunts. 'Most cultivators pick the one with the best view.'" },
      { ask: "graft a cutting of thousand-year ginseng onto common root, the way the old farmers do", done: "The graft takes. Tian Lao says she has a farmer's hands, and then, so it won't go to her head, that they're small ones." },
      { ask: "cook a pot of spirit rice for the field hands, and eat with them", done: "The field hands say it's the best rice they've had all year, because they grew it. Tian Lao says that is the whole of the art." },
    ],
    goods: ["a sack of Liang's spirit rice", "a jar of plum sauce from the palace kitchens", "a bolt of yellow silk with the granary seal", "a basket of millet cakes"],
    tales: [
      "“An emperor who'd tear up the Covenant over a granary? Heaven help the rest of us.”",
      "“Grey carts. We had grey carts here too. Paid well. I didn't ask.”",
      "“Liang's rice is the best under heaven. If they're short, we'll all be short.”",
      "“The Grand Tutor? He came through once. Very kind man. Asked how much grain we had.”",
    ],
    emperor: [
      "A throne is only a chair, {title}. It is the granary behind it that makes a man an emperor.",
      "My grandfather said the sects were wolves we had tamed. My father said they were dogs we fed. I begin to think they are farmers too, of a kind.",
      "The Grand Tutor taught me to write my name. I wonder, now, what else he taught me to write.",
    ],
    guide: [
      "I count sacks. Sacks do not lie. Ministers lie, emperors lie, sacks do not.",
      "If you see Magistrate Gou, do not let him talk. He talks very well. That is how he became a magistrate.",
      "Every court has a minister who counts. Ask for them, in the other five. We all write to each other.",
    ],
    leader: [
      "A sect that rules mortals stops being a sect. A throne that binds cultivators stops being a throne. That is the whole Covenant.",
      "Eight hundred years. We were here before the first Liang emperor's father, and we will be here after the last one's son.",
      "My disciples are hungry and they are not complaining. I am very proud of them, {peer}.",
    ],
    boss: {
      intro: "the old granary south of Liangdu is burning, and Magistrate Gou stands in the smoke with an armful of ledgers and a club made from a granary tally-stick",
      words: [
        ["ct-boss", "You don't understand. The Grand Tutor pays in good silver. The emperor pays in titles. Which would you choose?"],
        ["ct-boss", "And the people? The people sold me their rice. Willingly! I gave them more than the tithe! I'm the only friend they've got!"],
      ],
      fates: [
        { heart: "mercy", label: "Make him buy the grain back and give it away", line: "She makes Gou buy back every sack he can find with his own silver and carry them to the villages himself. It takes him the whole winter. By spring the farmers have stopped spitting when he passes." },
        { heart: "sword", label: "Hand him to the emperor's justice", line: "She drags him before the throne. The emperor sentences him to keep the Ever-Normal Granary for the rest of his life, counted every day by Minister Tian. 'You love grain,' the emperor says. 'Now love it honestly.'" },
        { heart: "balance", label: "Make him the farmers' tithe-keeper", line: "She makes him tithe-keeper for the villages he robbed, answerable to them and not to the throne. The farmers choose who checks his tallies. It is the old granary-keeper he had sacked." },
        { heart: "slaughter", label: "Throw him into his own fire", line: "She throws the Granary Rat back into the burning granary with his ledgers. The farmers who watch say nothing at all, and the next day the emperor's guard ask her, very politely, to leave Liang for a while." },
      ],
      victory: "In the ashes of the ledgers one page has not burned: a letter, in a fine scholar's hand, sealed with a brush crossed with a tablet. 'Southern Chen next,' it says. 'The bows are ready.'",
    },
  },
  // ------------------------------------------------------------------------------------------------ II · Southern Chen
  {
    title: "The Sect-Breaker Bows",
    hanzi: "破宗弩",
    level: 6,
    beats: [
      {
        step: 0,
        npc: "ct-emperor",
        title: "The Empress of the Tide",
        objective: "Southern Chen's capital, Jinling-by-the-Tide, stands on the tidelands north-west of Hailing. Empress Chen Yuhua has heard what happened in Liang. Go to her throne.",
        lines: [
          ["narr", "Jinling's square smells of salt and hot iron. Somewhere in the city a hundred forges are ringing at once. The empress sits her throne straight-backed, a fan closed in her lap like a sword."],
          ["ct-emperor", "You ended a famine in Liang with a club fight in a granary. Xuande writes that you are honest. Xuande has never written that about anyone, including himself."],
          ["ct-emperor", "Here is my trouble. My armourers have been making crossbows I did not order. Bolts tipped with green jade that drinks qi. A cultivator struck with one falls like a mortal. They call them Sect-Breakers."],
          ["ct-emperor", "Someone wants Chen to own a weapon that kills cultivators. And the Tidebreakers, who guard my coast, have found out, and they think the someone is me."],
        ],
        after: [["ct-emperor", "Find the bows, {title}. Find who ordered them. And find it before Lan Ruoshui finds me."]],
        done: "The empress gives her a pass to every forge in Jinling. Lady Secretary Su Wan'er, at her shoulder, opens her fan and says nothing at all, very loudly.",
      },
      {
        step: 20,
        npc: "ct-leader",
        title: "The Tidebreakers Arm",
        objective: "The Tidebreaker Sect's seat stands on the shore south-west of Jinling. Sect Mistress Lan Ruoshui has called her disciples to arms. Talk to her before somebody draws.",
        lines: [
          ["ct-leader", "One of my disciples was shot on the beach. Here. A bolt with a green tip. She fell like a stone and woke a mortal. Her cultivation is gone, {peer}. Twelve years of it."],
          { a: "ct-leader", n: "sworddance" },
          ["ct-leader", "The bolt was stamped with the Chen imperial forge mark. What would you do?"],
        ],
        choice: {
          prompt: "Lan Ruoshui's sword is half out of its sheath. Behind her, forty disciples are waiting for the word.",
          options: [
            { heart: "mercy", label: "Ask to see the disciple who was shot", then: "She asks to sit with the girl whose cultivation was taken, before anyone decides anything.", reply: ["ct-leader", "…She's in the infirmary. She keeps asking for her sword. Go, then. Go and tell her it was the empress."], effect: quiet(2) },
            { heart: "sword", label: "Say she will find the bowman herself", then: "She says she will bring the man who loosed that bolt to the Tidebreakers' gate by the next tide, if they hold till then.", reply: ["ct-leader", "One tide. I will hold my disciples for one tide."] },
            { heart: "balance", label: "Show her the forged decree from Liang", then: "She shows Lan Ruoshui the decree forged in He Lingxiao's hand, and its watermark, and asks her to look at the bolt's mark again.", reply: ["ct-leader", "A brush and a tablet. …It's on the bolt too. Under the forge mark. Heaven's teeth."] },
            { heart: "slaughter", label: "Offer to go to the palace with her", then: "She tells Lan Ruoshui that if the empress ordered it, she will stand beside the Tidebreakers when they take the palace.", reply: ["ct-leader", "…Will you. A cultivator of the Azure Cloud, offering to topple a throne. That is what the Covenant was written against."], effect: feed(3) },
          ],
        },
        done: "Lan Ruoshui holds her disciples back. On the bolt, beneath the forge mark, someone has scratched a tiny brush crossed with a tablet.",
      },
      {
        step: 40,
        npc: "ct-master",
        title: "The Forge-Master's Eye",
        objective: "Forge-Master Ou Ye has worked Jinling's forges for fifty years and knows every hammer by its ring. Take up the art of refining with him, and ask him whose forge made the bows.",
        lines: [
          ["ct-master", "Hold the hammer like a friend's hand. Not a lover's. Not an enemy's. A friend's. Now strike."],
          { a: "ct-master", n: "hammer" },
          ["ct-master", "That jade on the bolts. That's not Chen jade. That's not any jade I know. It's green as a lotus leaf and it drinks qi the way sand drinks water."],
          ["ct-master", "Only one forge in Jinling could work it, and that's the Tide Gate armoury. Kuai Tong's forge. He bought it three years ago with silver nobody knew he had."],
        ],
        done: "Ou Ye takes her on as his apprentice. Her first blade comes out of the quench ringing a note he says is 'not bad, for a sect girl'. (The art of Artifact Refining: see the Journal.)",
      },
      {
        step: 60,
        npc: "ct-folk-3",
        title: "Admiral Fang's Silence",
        objective: "Admiral Fang commands the Tide Gate. Ask him who comes and goes from Kuai Tong's armoury by sea.",
        lines: [
          ["ct-folk-3", "Grey boats. Every new moon. They come in empty and go out low in the water. North, toward Liang. East, toward Qi. They carry the Grand Tutor's flag."],
          ["ct-folk-3", "I asked once. A letter came from the empress herself telling me not to. In her hand, with her seal."],
          { a: "ct-folk-3", n: "look" },
          ["ct-folk-3", "Except the empress was in the north that month, visiting her mother's grave. I counted the days. I'm a sailor. I count days. She could not have written it."],
        ],
        done: "Admiral Fang gives her the dates of every grey boat for three years. The first one sailed nine days after the Jade Lotus Heart was stolen.",
      },
      {
        step: 80,
        npc: "ct-guide",
        title: "The Secretary's Fan",
        objective: "Lady Secretary Su Wan'er writes all the empress's letters. Ask her who else could write in the empress's hand.",
        lines: [
          ["ct-guide", "Nobody. I've been her hand for twenty years. Nobody else knows how she makes the stroke for 'heaven', with the little hook. Except—"],
          { a: "ct-guide", n: "fanning" },
          ["ct-guide", "Except the man who taught her. Grand Tutor Fei Lian taught Her Majesty calligraphy when she was six. He taught all six of them. They all write 'heaven' with the little hook. It's his hook."],
          ["ct-guide", "He could write any of them. He could write all of them. Heaven above. He could have been writing to all six thrones for years in each other's hands."],
        ],
        done: "Su Wan'er shows her a letter from the empress to the Tidebreakers, refusing their complaint. It has the little hook on 'heaven'. The empress swears she never saw it.",
      },
      {
        step: 140,
        npc: "ct-emperor",
        title: "The Tide Gate Armoury",
        objective: "Kuai Tong has barred the Tide Gate armoury and is arming his bowmen. Tell the empress you are going in.",
        lines: [
          ["ct-emperor", "Kuai Tong was a blacksmith's son with a debt. Now he has three hundred bowmen and enough jade to kill every cultivator on my coast."],
          ["ct-emperor", "I sent my guard. He shot them with ordinary bolts. He saves the green ones for your kind."],
          { a: "ct-emperor", n: "proclaim" },
          ["ct-emperor", "Go in, {title}. Bring me the jade. All of it. I want to see what my Grand Tutor has been buying with my silver."],
        ],
        done: "The empress orders the Tide Gate closed. Out on the water the Tidebreakers stand on the waves in a long line, swords drawn, waiting, and for once they are on the same side as the throne.",
      },
    ],
    rites: [
      { title: "The Launching of the Tide Ships", ask: "break the jar of wine over the prow of the empress's new war junk at the launching", done: "She breaks the jar. The junk slides down into the water and floats. The shipwrights cheer as if they had not been sure it would." },
      { title: "The Sea Audience", ask: "stand at the empress's side when the fishing guilds come to petition the throne, and keep the Tidebreakers' envoy from shouting", done: "The envoy does not shout. The fishing guilds get their new harbour wall. Everyone goes home surprised." },
      { title: "The Quenching Rite", ask: "carry the first blade of the year from the forges to the sea and quench it in the tide, as Chen's smiths have done for six hundred years", done: "The blade hisses in the tide. The smiths say the sea accepted it. They say that every year." },
      { title: "The Blessing of the Nets", after: 20, ask: "walk the beach with the Tidebreakers' mistress and the empress's steward, blessing the fishing nets together", done: "It is the first time a sect mistress and a palace steward have walked the beach side by side. The fishermen take bets on who will speak first. Nobody wins." },
      { title: "The Lantern Tide", ask: "set the empress's lantern afloat at the lantern tide, for those lost at sea", done: "Her lantern floats out past the Tide Gate with ten thousand others. For a while the sea is full of light." },
    ],
    favours: [
      { ask: "fetch her husband's hammer from the bottom of the harbour, where he dropped it in a temper", done: "“He'll say thank you. He won't mean it. He'll mean it tomorrow.”" },
      { ask: "tell the Tidebreakers' disciples to stop sparring on the fishing boats", done: "“They said they'd spar on the beach! On the beach! Like normal people!”" },
      { ask: "sharpen the knives of the whole fish market, because the grinder's son ran off to join a sect", done: "“Sharper than they've been in years. Don't tell the grinder.”" },
      { ask: "find the forge-cat, who has gone missing since the bowmen came", done: "“In the coal store! Black as night and twice as cross! Thank you, {title}.”" },
      { ask: "read the tide-tables to the old pilot whose eyes have gone", done: "“Spring tide on the ninth. I knew it. I just wanted to hear it.”" },
      { ask: "carry a pot of crab soup to the girl at the Tidebreakers' seat who lost her cultivation", done: "“She ate it all. She asked if I could teach her to make it. A cultivator, learning to make soup. Well. She's mortal now. It's a start.”" },
    ],
    lessons: [
      { ask: "fold a billet of spirit iron sixteen times without letting the fire go out", done: "Ou Ye holds the billet to the light and says the folds are even. Then he says 'mostly' and hides a smile." },
      { ask: "temper a sword-spine in the spring tide, the way Chen's smiths always have", done: "The spine rings true. Ou Ye says the sea did half the work. She suspects he's right." },
      { ask: "listen to twelve hammers ring and tell him which smith is tired", done: "She picks the right one. Ou Ye sends the smith home. 'A tired smith makes a blade that breaks,' he says. 'Remember that, when you're tired.'" },
      { ask: "mend a Tidebreaker disciple's notched sword so it sings again", done: "The disciple draws it and it sings. He bows to her twice, once for the sword and once for the singing." },
    ],
    goods: ["a crate of Jinling sword-blanks", "a jar of salted crab", "a coil of tide-silk rope", "a bronze mirror from the Tide Gate forges"],
    tales: [
      "“Bows that kill cultivators? …I'd sleep better if nobody had those. Anybody.”",
      "“The empress and the Tidebreakers at each other's throats? Over bows? I'd keep clear of Jinling a while.”",
      "“Jinling iron is the best. Everybody knows that. Everybody in Jinling, anyway.”",
      "“A Grand Tutor who writes letters in the empress's hand? That's a story for the teahouse, that is.”",
    ],
    emperor: [
      "I was six when Fei Lian taught me to hold a brush. He held my hand on it. I remember how warm his hand was.",
      "A throne that owns a weapon to kill sects will one day be asked to use it. I would rather not be asked.",
      "Lan Ruoshui and I have not spoken in nine years. We had a quarrel about a harbour wall. It seems very small now.",
    ],
    guide: [
      "In court, a fan is for hiding your face when your face would say too much. I've worn out three this month.",
      "Twenty years of the empress's letters, and I never once thought to wonder who else wrote like her.",
      "If the Grand Tutor writes in all six hands, then every quarrel between the thrones for twenty years might be his. Every one.",
    ],
    leader: [
      "We stand on the waves so the fishing boats don't have to stand on them. That's the whole of it.",
      "The girl who was shot asked me today if she could still be a Tidebreaker. I said yes. I'll make it true.",
      "Kuai Tong was a smith's son with a debt. Someone paid his debt and taught him to hate us. I want to meet the someone.",
    ],
    boss: {
      intro: "in the Tide Gate armoury, among racks of green-tipped bolts, Kuai Tong levels a great Sect-Breaker crossbow, and three hundred more are levelled behind him",
      words: [
        ["ct-boss", "My father was a smith. A cultivator broke his arm in a tavern for spilling wine on his robe. Nobody punished the cultivator. Who punishes cultivators?"],
        ["ct-boss", "The Grand Tutor does. The Grand Tutor gave me the jade. One bolt, and you're as mortal as my father was."],
      ],
      fates: [
        { heart: "mercy", label: "Find the cultivator who broke his father's arm", line: "She finds the man, now an old outer elder of a little sect, and brings him to Kuai Tong's cell, and makes him kneel. Kuai Tong weeps. So, after a while, does the old elder." },
        { heart: "sword", label: "Break every bow, and give him to the empress", line: "She breaks the three hundred bows over her knee one by one and hands Kuai Tong to the empress's guard. He watches every bow break. By the last one he has stopped shouting." },
        { heart: "balance", label: "Make him forge for the Tidebreakers", line: "She sentences him to forge for the Tidebreakers, at their seat, under their eyes, for as long as the Covenant stands. The first sword he makes them is the best he has ever made. He says it was the sea air." },
        { heart: "slaughter", label: "Shoot him with his own bolt", line: "She takes a green-tipped bolt and puts it through Kuai Tong's shoulder. He was never a cultivator; it does nothing a common bolt wouldn't. But he understands, and the bowmen understand, and none of them ever picks up a bow again." },
      ],
      victory: "The jade on the bolts is all cut from one stone, green as a lotus leaf. Ou Ye looks at it a long time, then says the grain of it is not stone at all. 'It grew,' he says. 'It's a petal. Turned to jade. Something enormous lost a petal.' In Kuai Tong's strongbox: a letter. 'Western Shu next. The old man wants to live forever.'",
    },
  },
  // ------------------------------------------------------------------------------------------------ III · Western Shu
  {
    title: "The Elixir of Ten Thousand Years",
    hanzi: "万年丹",
    level: 9,
    beats: [
      {
        step: 0,
        npc: "ct-emperor",
        title: "The Dying Emperor",
        objective: "Western Shu's capital, Jincheng of the Brocade, stands in the plum hills south of the tea terraces. Emperor Wenhe is very old and very ill. His physician has sent for you. Go to the throne.",
        lines: [
          ["narr", "The emperor of Western Shu sits his throne wrapped in three robes of brocade, and still he shivers. His hands are silver to the wrist. Not the silver of age. The silver of mercury."],
          ["ct-emperor", "Physician Sun says I am poisoned. My alchemist says I am becoming immortal. One of them is going to have to be wrong, and I would very much like to know which before I die."],
          ["ct-emperor", "The alchemist is Xu Fu. He came to my court with a letter from the Grand Tutor. The Grand Tutor taught me to read, so I read the letter. It said Xu Fu could make the Elixir of Ten Thousand Years."],
          ["ct-emperor", "I am ninety-one, {title}. I wanted to see my grandson crowned. That is all. Was that so greedy?"],
        ],
        after: [["ct-emperor", "The Crimson Cauldron says Xu Fu is a fraud. Xu Fu says the Crimson Cauldron wants the secret of immortality for itself. Find out which. Quickly."]],
        done: "The emperor's hand, when he gives her the jade token of the court, is cold as a coin. Physician Sun watches her take it, and his face says: hurry.",
      },
      {
        step: 20,
        npc: "ct-guide",
        title: "The Physician's Needles",
        objective: "Imperial Physician Sun Simiao has been fighting the poison alone. Ask him what the elixir is made of.",
        lines: [
          ["ct-guide", "Cinnabar. Mercury. Realgar. The old poisons every fool alchemist reaches for. That much I could fight. But there's something else in it."],
          { a: "ct-guide", n: "pulse" },
          ["ct-guide", "His pulse is wrong. Not weak. Strong. Too strong, for a man of ninety-one. Something in that elixir is pouring qi into a mortal body that has no meridians to hold it. It will burst him like an overfilled wineskin."],
          ["ct-guide", "I took a grain of it to the Crimson Cauldron. Sect Master Dan Qiu turned white and threw it in the fire. He wouldn't tell me why."],
        ],
        choice: {
          prompt: "Physician Sun asks whether to stop the elixir. Without it the emperor may die of withdrawal within days. With it, within a month.",
          options: [
            { heart: "mercy", label: "Stop it, and sit with him", then: "She tells Sun to stop the elixir, and says she will sit with the emperor through the worst of it.", reply: ["ct-guide", "Then sit close. He talks in his sleep. He talks to his son, who died forty years ago."], effect: quiet(2) },
            { heart: "sword", label: "Stop it, and go for Xu Fu", then: "She tells Sun to stop it, and goes straight to find the alchemist.", reply: ["ct-guide", "Xu Fu has guards. Cultivators, some of them, who've drunk his pills. Be careful."] },
            { heart: "balance", label: "Taper it slowly while she learns what's in it", then: "She asks Sun to taper the dose while she finds out what the last ingredient is, so they know what they are fighting.", reply: ["ct-guide", "Wise. A healer's answer. Have you ever thought of learning the needles?"] },
            { heart: "slaughter", label: "Let it run, and use the month", then: "She says the emperor chose the elixir, and a month is time enough to catch the man who made it.", reply: ["ct-guide", "He chose it because he was frightened. You'd let a frightened old man burst for a month's head start?"], effect: feed(3) },
          ],
        },
        done: "Physician Sun takes her on as his student in the healer's art. 'Every alchemist,' he says, 'should first learn what her pills do to the people who swallow them.' (The Healer's Dao: see the Journal.)",
      },
      {
        step: 40,
        npc: "ct-leader",
        title: "What Dan Qiu Threw in the Fire",
        objective: "The Crimson Cauldron's seat stands north of Jincheng. Ask Sect Master Dan Qiu what he saw in the elixir.",
        lines: [
          ["ct-leader", "I saw a petal. Ground fine. A petal of something that was never a flower, and was never only jade. It has qi in it like a spring has water. It's the purest qi I have ever felt, {peer}."],
          { a: "ct-leader", n: "grind" },
          ["ct-leader", "You're of the Azure Cloud. You'll know better than I do. Your sect had a Heart, a Jade Lotus Heart, that held up your mountain. It was stolen. When it was stolen, did anyone count its petals?"],
          ["ct-leader", "Because somebody has one. And they're grinding it up and feeding it to emperors."],
        ],
        done: "Dan Qiu gives her the sect's oldest record of the Jade Lotus Heart, from a visit eight hundred years ago. It shows nine petals. Every account of the Heart she has ever heard, from Elder Mo's lessons to the Blood Moon's boasts, speaks of eight.",
      },
      {
        step: 60,
        npc: "ct-master",
        title: "Mother Yao's Cauldron",
        objective: "Mother Yao of the Pill Guild has made pills for four emperors. Take up alchemy with her, and ask her how a mortal could have come by a petal of the Heart.",
        lines: [
          ["ct-master", "Fire first. Always fire first. A cauldron is a stomach, girl, and you're its cook. Too hot, it burns. Too cold, it sulks."],
          { a: "ct-master", n: "grind" },
          ["ct-master", "A petal of your Heart? The Blood Moon took the Heart. Every alchemist in the south knows that. And every alchemist in the south knows the Blood Moon sold things, afterwards, to pay for passage through the passes. Pills. Recipes. Relics."],
          ["ct-master", "If one of their thieves broke a petal off in the dark and kept it for himself, he'd have sold it to the richest man who'd ask no questions. And the richest man who asks no questions is the one who can write any emperor's name."],
        ],
        done: "Mother Yao takes her on as her apprentice. Her first pill comes out of the cauldron round, which Mother Yao says is 'a start', and green, which Mother Yao says is 'a worry'. (The art of Alchemy: see the Journal.)",
      },
      {
        step: 80,
        npc: "ct-folk-3",
        title: "The Crown Prince Reads",
        objective: "Crown Prince Liu Chan has been reading his grandfather's letters from the Grand Tutor. He wants to show you something.",
        lines: [
          ["ct-folk-3", "Forty years of letters. Fei Lian writes to grandfather every month. About poetry, mostly. About the weather. About how worried he is that the sects are growing too strong."],
          ["ct-folk-3", "And then three years ago, a new kind of letter. 'I have found a way for a mortal to hold qi. Imagine, Majesty. Imagine an emperor who need not beg the sects for anything.'"],
          { a: "ct-folk-3", n: "read" },
          ["ct-folk-3", "Grandfather didn't want to hold qi. He wanted to see me crowned. Fei Lian used that. He used the one thing grandfather wanted to test his petal on a mortal. My grandfather was his experiment."],
        ],
        done: "The prince gives her the last letter. 'If the old man survives the elixir,' it says, 'we shall know a mortal can hold it, and I shall make a seal of the rest.'",
      },
      {
        step: 140,
        npc: "ct-emperor",
        title: "The False Immortal",
        objective: "Xu Fu has fled the palace for his tower outside Jincheng with the last of the elixir. The emperor is lucid this morning. Tell him.",
        lines: [
          ["ct-emperor", "So I was a test. An old man's fear, ground up with a stolen petal and fed back to him by a man he trusted."],
          ["ct-emperor", "I am not angry, {title}. I am too old to be angry. I am sorry. I am sorry I wanted so much to live that I let him make me a cup to pour into."],
          { a: "ct-emperor", n: "enthrone" },
          ["ct-emperor", "Bring back what is left of the petal. It is not mine, and it is not Xu Fu's. It belongs to your sect. Or to heaven. Or to whoever is wise enough to know what to do with it, which is not an emperor."],
        ],
        done: "The emperor stands, without his stick, for the first time in a month. 'Go,' he says. 'I intend to be alive when you come back. Out of spite.'",
      },
    ],
    rites: [
      { title: "The Brocade Audience", ask: "attend the emperor's audience in the palace square, and stand with the crown prince while the ministers kneel", done: "The ministers kneel. The prince does not know where to put his hands. She shows him: one over the other, like holding a cup. He holds them that way for the rest of his life." },
      { title: "The Physicians' Oath", ask: "witness the young physicians of Shu swear the Great Physician's Oath before the throne", done: "Thirty young physicians swear to treat rich and poor alike. Physician Sun mouths every word with them, as he does every year." },
      { title: "The Pill-Burning", after: 20, ask: "burn every one of Xu Fu's remaining elixirs before the people, so none can be sold in the markets", done: "The pills burn green, then silver, then nothing. The crowd cheers. Mother Yao says it is the most expensive bonfire in Shu's history." },
      { title: "The Tea Offering", ask: "carry the year's first tea from the Cloudmist terraces to the emperor, as the tea masters' guild has done since the dynasty began", done: "The emperor drinks it and says it tastes of spring. It is the first thing he has tasted in a month." },
      { title: "The Ancestors' Hall", ask: "kneel with the crown prince in the hall of the Shu ancestors and light the incense", done: "The prince lights his grandfather's incense too, though his grandfather is still alive. 'Just in case,' he says. 'He's very old.'" },
    ],
    favours: [
      { ask: "fetch her a pinch of the Crimson Cauldron's ash for her hens, which she swears lay better on it", done: "“Ten eggs this morning! Ten! Tell the sect master thank you, and that his ash is wasted on pills.”" },
      { ask: "talk her son out of drinking a 'longevity pill' he bought in the market", done: "“He threw it in the river. The fish are all very lively now. But he's alive. Thank you.”" },
      { ask: "deliver a bolt of Shu brocade to the palace seamstresses before the festival", done: "“Just in time! They'd have had to wear last year's! The shame!”" },
      { ask: "help him carry his mother up to the hot spring on the hill, because her joints ache", done: "“She says the water's too hot, the view's too high and the company's too young. She's happy. That's how she's happy.”" },
      { ask: "ask the Crimson Cauldron's disciples not to test their pills on the stray dogs", done: "“They've adopted the dogs instead! A whole sect of dog-keepers! Well, it's better.”" },
      { ask: "find her grandfather's recipe for chilli oil, which he hid somewhere in the house before he died", done: "“Inside the ancestor tablet! He always said it was the most important thing in the house. Ha!”" },
    ],
    lessons: [
      { ask: "keep a cauldron's fire steady through a whole night without nodding off", done: "The fire never wavers. Mother Yao finds her at dawn, red-eyed and proud, and says, 'Good. Now do it a thousand more times.'" },
      { ask: "grind nine herbs to the fineness of flour, each in its own mortar, without mixing them", done: "Mother Yao tastes each one with the tip of her tongue and spits. 'Clean. Good. Never do that yourself.'" },
      { ask: "brew a Gathering Pill for the guild's poorest customer, and charge them nothing", done: "The customer is a porter with a cough. He comes back a week later with a basket of plums. Mother Yao says that's the proper price." },
      { ask: "take the pulses of three patients with Physician Sun and say which pill each one needs", done: "She gets two right. Sun says the third was a trick: the patient needed rest, not a pill. 'The best pill,' he says, 'is often none.'" },
    ],
    goods: ["a bolt of Shu brocade", "a jar of Jincheng chilli oil", "a box of Physician Sun's healing pills", "a cake of the emperor's own tea"],
    tales: [
      "“An elixir of ten thousand years? My uncle bought one of those. He's dead now. Of course he is.”",
      "“Poor old emperor. He only wanted to see the boy crowned.”",
      "“A petal of the Jade Lotus Heart, in a pill? …That's sacrilege, that is. Even I know that.”",
      "“Shu chilli oil. Put it on anything. Put it on everything.”",
    ],
    emperor: [
      "I have outlived two empresses, four sons and one dynasty's worth of ministers. Now I would like to outlive one alchemist.",
      "The Grand Tutor wrote me a poem on my eightieth birthday. It was very good. I should have read it more carefully.",
      "My grandson reads too much. Good. Someone in this family should.",
    ],
    guide: [
      "A physician learns quickly that the people who most want to live forever are the ones most afraid of dying tomorrow.",
      "The emperor's pulse is better. Not good. Better. I'll take better.",
      "When this is over, I'd like to teach you the needles properly. Cultivators heal fast. They forget that other people don't.",
    ],
    leader: [
      "An alchemist's first lesson: everything is a medicine, and everything is a poison, and the difference is how much.",
      "Xu Fu was a disciple of mine, once. I threw him out for testing pills on beggars. I should have thrown him further.",
      "A petal of the Heart. Heaven help us, {peer}. If he can make a mortal hold qi, what else can he make?",
    ],
    boss: {
      intro: "on the top of his tower outside Jincheng, among cauldrons glowing green and silver, Xu Fu the False Immortal turns from the window with a cup of elixir in his hand, his skin silvered like a mirror",
      words: [
        ["ct-boss", "I've drunk it, you see. I've drunk all of it. I can feel the qi in me like the sea in a seashell. I'm immortal, cultivator. Can you say the same?"],
        ["ct-boss", "The Grand Tutor wanted a test. I gave him a better one. Me."],
      ],
      fates: [
        { heart: "mercy", label: "Draw the poison out of him", line: "She draws the petal's qi out of him, a thread at a time, and he shrinks back into an ordinary old man with silver scars. He spends the rest of his life in Physician Sun's infirmary, washing bandages, and asks every patient how they are." },
        { heart: "sword", label: "Seal his meridians and hand him over", line: "She seals what the petal opened in him and hands him to the Crimson Cauldron. Dan Qiu sets him to sweep the sect's furnace rooms. 'He wanted to live forever near a cauldron,' Dan Qiu says. 'Now he will.'" },
        { heart: "balance", label: "Let the emperor judge him", line: "She carries him down to the throne. The old emperor looks at him for a long time and sentences him to read to the crown prince every evening, for as long as they both shall live. Xu Fu reads very well. Nobody expected that." },
        { heart: "slaughter", label: "Let the elixir finish what it started", line: "She stands back and lets the qi he has drunk do what it was always going to do. When it is over there is a silver stain on the tower floor and a smell of burnt cinnabar. The emperor, told of it, says nothing for a whole day." },
      ],
      victory: "In Xu Fu's last cauldron: a little dust of green jade, and a letter. 'Enough of the petal has been used,' it says, in the fine scholar's hand. 'What remains I shall cut into a seal. Wei next: the Iron Emperor wants soldiers who cannot be refused.'",
    },
  },
  // ------------------------------------------------------------------------------------------------ IV · Northern Wei
  {
    title: "The Burning Edicts",
    hanzi: "焚诏",
    level: 12,
    beats: [
      {
        step: 0,
        npc: "ct-emperor",
        title: "The Iron Emperor",
        objective: "Northern Wei's capital, Pingcheng under the Snows, stands in the frost peaks east of the Sword Sea Pavilion. Emperor Wei Lie has issued an edict conscripting every cultivator in his realm into his army. Go to his throne.",
        lines: [
          ["narr", "Pingcheng's square is swept clear of snow every hour by a hundred soldiers. The Iron Emperor sits his throne in armour. Behind him a hundred edicts are nailed to the palace doors, every one with the vermilion seal."],
          ["ct-emperor", "You have come about the conscription edict. Every cultivator has come about the conscription edict. I will tell you what I told them."],
          ["ct-emperor", "I did not write it."],
          ["ct-emperor", "I am a soldier. I would like nothing better than an army of cultivators. And I did not write it, because I swore the Covenant on my father's grave, and I keep my oaths. And yet there it is, in my hand, with my seal, and the Talisman Abbey is ready to burn Pingcheng to the snow over it."],
        ],
        after: [["ct-emperor", "Someone writes better than me in my own hand, {title}. I would like you to find him so I can explain to him, at length, how much I dislike that."]],
        done: "The Iron Emperor gives her his sword-token. 'It opens every door in Wei,' he says. 'And if it doesn't, it's heavy enough to break them.'",
      },
      {
        step: 20,
        npc: "ct-leader",
        title: "The Abbess's Talisman",
        objective: "The Thousand Talisman Abbey stands on the snowy slope south-west of Pingcheng. Abbess Fu Yinzi has brushed a thousand war-talismans. Talk to her before she uses them.",
        lines: [
          ["ct-leader", "He says he did not write it? Of course he says so. Emperors always say so after."],
          { a: "ct-leader", n: "inscribe" },
          ["ct-leader", "And yet. I brushed a seeing-talisman on the edict, to read the hand. The ink was not ground in Wei. It was ground with water from a spring in the far south. And the brush was held at an angle no northerner holds a brush."],
          ["ct-leader", "So I have a thousand talismans ready to burn a city, {peer}, and a growing suspicion that I am being made a fool of. Tell me which you would have me trust."],
        ],
        choice: {
          prompt: "Abbess Fu Yinzi holds a war-talisman between two fingers. It is already smoking at the edges.",
          options: [
            { heart: "mercy", label: "Trust the emperor's oath", then: "She tells the abbess that the Iron Emperor swore on his father's grave, and a man like that does not lie about it.", reply: ["ct-leader", "…No. A man like that doesn't. Very well. I will put this one back in the drawer. Only this one."], effect: quiet(2) },
            { heart: "sword", label: "Trust your own talisman", then: "She tells the abbess to trust her own art: the ink, the brush, the hand. Talismans don't lie.", reply: ["ct-leader", "Talismans don't. Then whoever wrote this edict lives in the south, and is no emperor. Find me him."] },
            { heart: "balance", label: "Ask her to read the hand with the emperor watching", then: "She asks the abbess to brush her seeing-talisman again, in the palace square, with the emperor beside her, so both see the same thing.", reply: ["ct-leader", "In front of him? …Yes. Let him see his own hand turn into someone else's."] },
            { heart: "slaughter", label: "Tell her to burn the edicts and the hand that nailed them", then: "She tells the abbess that whoever nailed the edicts up deserves to burn with them.", reply: ["ct-leader", "Whoever nailed them up is a soldier who was told to. I will not burn soldiers for obeying, {peer}."], effect: feed(3) },
          ],
        },
        done: "The abbess's talisman, brushed over the edict's seal, flares green as a lotus leaf. 'That's not cinnabar,' she says. 'That's jade dust in the vermilion. Someone is sealing with a seal made of jade that has qi in it.'",
      },
      {
        step: 40,
        npc: "ct-master",
        title: "The Brusher's Hand",
        objective: "Talisman-Brusher Huang Yi teaches the art in Pingcheng's square. Take up the talisman craft with him and learn to read a forged hand.",
        lines: [
          ["ct-master", "Every hand has a breath. You breathe in on the down-stroke, out on the hook. A forger copies the shape. He can't copy the breath."],
          { a: "ct-master", n: "inscribe" },
          ["ct-master", "Look at the edict. The breath is wrong. Too patient. This hand was taught to write very young, by someone very old, and has written emperors' names for forty years."],
          ["ct-master", "There's only one man who taught all six thrones to write. You know his name. Nobody in Wei will say it aloud."],
        ],
        done: "Huang Yi takes her on as his apprentice. Her first talisman burns before it's finished, which he says happens to everyone, and her second wards a door, which he says happens to almost no one. (The art of Talisman Craft: see the Journal.)",
      },
      {
        step: 60,
        npc: "ct-folk-3",
        title: "The Conscription Officer",
        objective: "Conscription Officer Dou has been enforcing the edict with General Helian's soldiers. Ask him where his orders come from.",
        lines: [
          ["ct-folk-3", "From General Helian. Who has them from the emperor. Who says he didn't send them. So who did?"],
          ["ct-folk-3", "Helian's soldiers aren't Wei soldiers anyway. Half of them have golden collars round their necks, with edict-script on them. They don't eat. They don't sleep. They just obey."],
          { a: "ct-folk-3", n: "audience" },
          ["ct-folk-3", "Helian says the collars are the future. Soldiers who cannot refuse. He says the Grand Tutor showed him how to make them, with a seal that commands."],
        ],
        done: "Dou resigns his commission on the spot and hands her the key to the conscription rolls. Every name on them has a tick beside it in vermilion, and the vermilion glints green.",
      },
      {
        step: 80,
        npc: "ct-guide",
        title: "Prince Wei Ming's Map",
        objective: "Prince Wei Ming has found where General Helian keeps his collared soldiers. He wants to go with you.",
        lines: [
          ["ct-guide", "In the old fortress on the pass. Three hundred of them, and Helian, and a forge where he makes the collars. I've drawn it."],
          ["ct-guide", "Father won't send the army. He says if Wei soldiers fight Wei soldiers, whoever wrote those edicts wins. He's right. He's always right. It's very annoying."],
          ["ct-guide", "So it has to be you, {title}. And the abbess. A cultivator and a sect, against a general of Wei, with the emperor's blessing. Do you see how strange that is? It's exactly what the Covenant was for."],
        ],
        done: "The prince's map shows the fortress, the forge, and in its heart a room marked only with a brush crossed with a tablet.",
      },
      {
        step: 140,
        npc: "ct-emperor",
        title: "Burner of Edicts",
        objective: "General Helian has burned the emperor's real edicts and nailed his own in their place. Tell the Iron Emperor you are going up the pass.",
        lines: [
          ["ct-emperor", "Helian served my father. He carried me on his shoulders when I was four. And now he puts collars on men and calls it the future."],
          ["ct-emperor", "I will not send the army. I will not make Wei fight Wei. But I will tell you this, {title}, as a soldier: go up the pass at night, from the east side, where the wall is low."],
          { a: "ct-emperor", n: "proclaim" },
          ["ct-emperor", "And when you find the seal he uses, bring it to me. I want to see what my hand looks like when it is not mine."],
        ],
        done: "The Iron Emperor unbuckles his own sword and lays it on the throne. 'For when you come back,' he says. 'I'll want to have something in my hands.'",
      },
    ],
    rites: [
      { title: "The Snow Review", ask: "stand on the palace steps beside the emperor at the winter review of the troops", done: "The troops march past. The emperor salutes every banner. At the end he salutes the cooks, too. 'An army marches on them,' he says." },
      { title: "The Talisman of the Gate", after: 20, ask: "carry Abbess Fu's warding talisman to the palace gate and set it over the door, with the emperor's leave", done: "The talisman settles over the gate. For the first time in a hundred years, the Abbey's ward and the throne's door are the same door." },
      { title: "The Oath Renewed", after: 20, ask: "witness the Iron Emperor renew the Covenant of Cloud and Throne at his father's grave", done: "He swears it again in the snow, bareheaded. The abbess, beside him, swears it too. Neither of them looks at the other. Both of them mean it." },
      { title: "The Edict-Burning", ask: "help burn every forged edict in Pingcheng in the palace square, before the people", done: "A hundred edicts burn. The smoke goes up straight and green. The people of Pingcheng cheer louder than they have for any real edict in years." },
      { title: "The Winter Lanterns", ask: "light the winter lanterns along the palace wall, one for each soldier lost on the pass", done: "Two hundred and nine lanterns. She lights every one. The emperor knows every name." },
    ],
    favours: [
      { ask: "fetch firewood for the widows' quarter, because the conscription took their sons", done: "“Warm tonight. First time in a month. Thank you, {title}.”" },
      { ask: "dig his cart out of a snowdrift on the pass road", done: "“A cultivator with a shovel! I'll tell my grandchildren. If they believe me.”" },
      { ask: "brush a small ward on her door, because the wind howls through it like a ghost", done: "“Quiet as a temple! The wind's gone and found another door.”" },
      { ask: "find his son, who hid from the conscription in the abbey's woodshed", done: "“In the woodshed! The abbess has been feeding him porridge for a week! Bless her.”" },
      { ask: "carry hot millet to the soldiers on the gate, who haven't been relieved since dawn", done: "“Millet! Hot! Heaven bless the Azure Cloud!”" },
      { ask: "help her read the conscription roll and find out if her husband's name is on it", done: "“Not there. Not there! Oh, {title}. Oh.”" },
    ],
    lessons: [
      { ask: "grind cinnabar into vermilion ink, fine enough that it flows without a breath of grit", done: "Huang Yi rubs a drop between finger and thumb. 'Good ink,' he says. 'Ink is half the talisman. The other half is not being a fool.'" },
      { ask: "brush the character 'ward' a hundred times until the hundredth has breath in it", done: "The hundredth glows faintly. Huang Yi tears up the other ninety-nine. 'Practice,' he says. 'Never keep practice.'" },
      { ask: "read three forged documents and say which hand forged each", done: "She reads the breath in each. Huang Yi says she has a forger's eye, and that it's a compliment, mostly." },
      { ask: "brush a warming talisman for the barracks' stove", done: "The barracks are warm for a week. The soldiers start bowing to her. Huang Yi says that's the real reward of the art." },
    ],
    goods: ["a bundle of Wei war-talismans", "a cask of Pingcheng sorghum spirit", "a sheaf of fine snow-paper", "a fur cloak from the palace stores"],
    tales: [
      "“Soldiers with collars that make them obey? …That's the worst thing I've heard this year.”",
      "“An emperor who swears he never wrote his own edict? Either he's lying or someone's very clever.”",
      "“Wei sorghum spirit. One cup warms you. Two cups, you're a poet. Three cups, you're asleep.”",
      "“Forged edicts. Forged decrees. Who can you believe, these days?”",
    ],
    emperor: [
      "A soldier's oath is the only thing he truly owns. Everything else belongs to the throne.",
      "Fei Lian taught me to write with a soldier's hand. Straight lines, he said. No flourishes. I wonder if he was laughing.",
      "My son wants to go up the pass with you. Let him. He'll be emperor one day. He should know what a pass is.",
    ],
    guide: [
      "Father says a prince should watch and learn. I've watched for twenty years. I'd like to learn something now.",
      "The abbess frightens me. Everybody's frightened of the abbess. Father isn't. Father's frightened of nothing. It's very tiring.",
      "When I'm emperor I'll learn talismans. Then nobody will ever be able to forge my hand.",
    ],
    leader: [
      "A talisman is a promise written in fire. You do not write one you do not mean.",
      "The Iron Emperor is a stubborn, cold, unbearable man. He is also, I am beginning to think, an honest one.",
      "Jade dust in vermilion, {peer}. Someone has a seal of qi-jade. We must find it before they make every edict obey itself.",
    ],
    boss: {
      intro: "in the forge-hall of the old fortress on the pass, among racks of golden collars, General Helian turns from the anvil with a sealed saber in his hand and three hundred collared soldiers at his back",
      words: [
        ["ct-boss", "The future, cultivator. An army that never refuses. No deserters, no mutinies, no soldiers weeping for their mothers. What emperor would not want it?"],
        ["ct-boss", "The Grand Tutor has the seal that commands. I have the soldiers who obey. When the six thrones are one, I shall be its general."],
      ],
      fates: [
        { heart: "mercy", label: "Unlock every collar first", line: "She breaks the collars one by one before she touches Helian, and three hundred soldiers wake up in the snow, weeping, asking for their mothers. Helian watches. By the end, so is he." },
        { heart: "sword", label: "Break his saber and bind him for the emperor", line: "She breaks his saber across her knee and carries him down the pass to the Iron Emperor, who looks at the old man who carried him on his shoulders and says only, 'You should have asked me.'" },
        { heart: "balance", label: "Put his own collar on him", line: "She closes one of his own golden collars round his neck, with the seal-script scratched out and her own word written in: 'Remember.' He wears it the rest of his life. He remembers every soldier he collared, by name." },
        { heart: "slaughter", label: "Burn him with his edicts", line: "She burns the forge, the collars and the general together. The soldiers, freed, walk down the pass in silence. Not one of them thanks her. Not one of them looks back." },
      ],
      victory: "In the room marked with the brush and tablet: no seal, but an empty jade box, lined with silk, cut to the shape of a seal, and a note. 'Qi next. The boy emperor has a regent who wants walls that cannot be crossed.'",
    },
  },
  // ------------------------------------------------------------------------------------------------ V · Eastern Qi
  {
    title: "The Walls of Linzi",
    hanzi: "临淄城",
    level: 15,
    beats: [
      {
        step: 0,
        npc: "ct-emperor",
        title: "The Boy Emperor",
        objective: "Eastern Qi's capital, Linzi of the Maples, stands in the autumn woods east of the woodcutters' lodge. Emperor Qi Yuan is nine years old. He has sent you a letter in his own hand. Go to his throne.",
        lines: [
          ["narr", "The throne of Eastern Qi is far too big for its emperor. His feet do not reach the dais. He has a kite on his lap, and he is trying very hard to look as if it is not his."],
          ["ct-emperor", "The regent says I'm not allowed to write letters. I wrote one anyway. I wrote it in my worst handwriting so he'd know it was really me."],
          ["ct-emperor", "Regent Sima built walls round Linzi. Array walls. You can see through them but you can't cross them. He says they're to keep the sects out. But they keep everybody in. Nurse-Mother Wang can't go home to her village. The farmers can't bring in the maples."],
          ["ct-emperor", "And the Myriad Arrays sect says they didn't build them, and the regent says they did, and I'm nine, {title}, and nobody will tell me who's lying."],
        ],
        after: [["ct-emperor", "Will you find out? I can pay you. I've got a kite. It's a very good kite."]],
        done: "The emperor gives her his kite. Nurse-Mother Wang, behind the throne, gives her a look that says: you will give that back.",
      },
      {
        step: 20,
        npc: "ct-guide",
        title: "Nurse-Mother Wang",
        objective: "Nurse-Mother Wang raised the emperor from a baby. She knows everything that happens in the palace. Ask her about the regent.",
        lines: [
          ["ct-guide", "Sima Heng was a good minister once. Then the Grand Tutor came to teach the little one his letters, and stayed to teach Sima Heng other things."],
          { a: "ct-guide", n: "knead" },
          ["ct-guide", "Arrays, mostly. Sima Heng can't cultivate, any more than I can. But the Grand Tutor gave him a jade the colour of a lotus leaf, and now he can make the old wall-arrays wake up and do as they're told."],
          ["ct-guide", "My village is on the other side of the wall. My daughter is having her first child next month. I would like to be there, {title}. That's all. Is that treason now?"],
        ],
        done: "Nurse-Mother Wang gives her a basket of buns for the road, and the name of the stone where the regent goes to wake the arrays: the old Astronomer's Stone, east of the palace.",
      },
      {
        step: 40,
        npc: "ct-leader",
        title: "The Sect of Myriad Arrays",
        objective: "The Sect of Myriad Arrays' seat stands south-east of Linzi. Sect Master Zhen Wuji built the old wall-arrays three hundred years ago. Ask him how a mortal could wake them.",
        lines: [
          ["ct-leader", "I built them to keep out demon beasts, not people. Three hundred years they've slept. Now they're awake and they don't answer me. They answer a mortal regent."],
          { a: "ct-leader", n: "array" },
          ["ct-leader", "An array is a question asked of the land, {peer}. 'Let qi flow here, not there.' To ask it, you need qi. A mortal has none. Unless someone gave him a stone full of it that the land recognises."],
          ["ct-leader", "The land recognises very little. It recognised the Jade Lotus Heart. Every array in the jianghu was laid out to bow toward it, back when it held up your mountain."],
        ],
        choice: {
          prompt: "Zhen Wuji says he could tear the walls down from outside. It would take a week and might shake half of Linzi to the ground.",
          options: [
            { heart: "mercy", label: "No. Find the regent's stone instead", then: "She tells him not to risk Linzi's houses. She will find the stone that commands the walls and take it from the regent's hand.", reply: ["ct-leader", "From inside. Brave. Foolish. Arrays don't like being argued with from inside."], effect: quiet(2) },
            { heart: "sword", label: "Tear one gate open, just one", then: "She asks him to break one gate only, at the north, so the farmers and the nurse-mother can pass while she finds the rest.", reply: ["ct-leader", "One gate. I can break one gate gently. Give me a night."] },
            { heart: "balance", label: "Teach her to read the arrays", then: "She asks him to teach her enough of his art to read the walls from inside, so she can find where they are being told what to do.", reply: ["ct-leader", "A week to read an array, a lifetime to write one. Come. We'll start with the week."] },
            { heart: "slaughter", label: "Tear it all down, houses or no", then: "She says Linzi can rebuild houses. It can't rebuild a boy emperor who grows up in a cage.", reply: ["ct-leader", "And the families in the houses? …No. No, {peer}. We do not trade houses for walls."], effect: feed(3) },
          ],
        },
        done: "Zhen Wuji draws the shape of the walls in the dust. At their heart, where every line bends, is the Astronomer's Stone, and on the stone, someone has set something green.",
      },
      {
        step: 60,
        npc: "ct-master",
        title: "Gongshu's Lines",
        objective: "Array-Wright Gongshu lays out the arrays of Linzi's houses. Take up the art of formations with him and learn to find the stone that holds the walls.",
        lines: [
          ["ct-master", "Six flags. Four stones. A line of salt. And the lie of the land, always the lie of the land. Here. Plant that one to the left."],
          { a: "ct-master", n: "array" },
          ["ct-master", "Feel how the qi bends round it? Now feel the wall. Everything bends east. Toward the Astronomer's Stone. And there's something in the bend like a heartbeat."],
          ["ct-master", "Not a heartbeat. A petal's pulse. Like a lotus breathing. I've never felt anything like it in forty years of laying lines."],
        ],
        done: "Gongshu takes her on as his apprentice. Her first array wakes a little dust-devil in the yard that will not stop until he kicks one of her stones. (The art of Formations: see the Journal.)",
      },
      {
        step: 80,
        npc: "ct-folk-3",
        title: "The Astronomer's Stone",
        objective: "Court Astronomer Gan watches the stars from the palace roof. Ask him what the regent does at the Astronomer's Stone at night.",
        lines: [
          ["ct-folk-3", "He goes out at the third watch with a lantern and a box. He kneels. He opens the box. And every wall in Linzi lights up green, like the night sky's been turned inside out."],
          ["ct-folk-3", "Then he speaks to it. Not to the stone. To the box. As if there's someone in it."],
          { a: "ct-folk-3", n: "stargaze" },
          ["ct-folk-3", "Last night, someone answered. A man's voice, very old, very kind. It said: 'Hold the walls until I come. When the six thrones are one, there will be no need of walls.'"],
        ],
        done: "Gan gives her his star-chart. The night the regent first woke the walls is marked: three years ago, nine days after the Heart was stolen.",
      },
      {
        step: 140,
        npc: "ct-emperor",
        title: "The Regent at the Stone",
        objective: "Regent Sima Heng has closed every gate and gone out to the Astronomer's Stone with his box. Tell the boy emperor.",
        lines: [
          ["ct-emperor", "Nurse-Mother Wang says I mustn't be frightened. I'm not. Emperors aren't allowed to be frightened. I read it."],
          ["ct-emperor", "Regent Sima used to let me fly my kite off the palace roof. Before the Grand Tutor came. He was nice. I'd like him to be nice again."],
          { a: "ct-emperor", n: "enthrone" },
          ["ct-emperor", "Please don't hurt him too much, {title}. But open the walls. Nurse-Mother's daughter is having a baby. You can keep the kite."],
        ],
        done: "The boy emperor stands on the throne to see over the crowd as she goes. Nurse-Mother Wang holds his ankle so he won't fall.",
      },
    ],
    rites: [
      { title: "The Kite Festival", ask: "fly the emperor's kite from the palace roof at the autumn kite festival, because he's not allowed", done: "The kite goes up higher than any in Linzi. The emperor, watching from below, forgets to look dignified for a whole hour." },
      { title: "The Maple Harvest", ask: "help the farmers bring the maple sap in through the one open gate before it sours", done: "Two hundred buckets of sap come through the gate. The whole city smells of syrup for a week." },
      { title: "The Lesson of the Stars", ask: "sit with the boy emperor while Astronomer Gan teaches him the stars", done: "He learns the Weaver and the Herd-Boy. He asks why they can only meet once a year. Gan says, 'Because of a wall.' The emperor is very quiet after that." },
      { title: "The Opening of the Gates", after: 40, ask: "stand at the north gate when Zhen Wuji opens it, and be the first through", done: "The gate opens. She walks through. Behind her, a thousand people who have not left Linzi in a year walk through too, laughing." },
      { title: "The Regency Council", after: 80, ask: "sit at the first council the boy emperor holds in his own name, with the regent made to stand at the back, and help him keep the ministers to the point", done: "The ministers talk for three hours. The emperor says one thing: 'Open all the gates.' It is the shortest council in Qi's history." },
    ],
    favours: [
      { ask: "carry a letter over the wall to her daughter in the village", done: "“She wrote back! Already! She says the baby kicks! Thank you, {title}, thank you.”" },
      { ask: "fetch his maple bucket, which he left on the far side of the wall when it woke", done: "“Still full! Sap doesn't care about walls. Wise sap.”" },
      { ask: "find the palace cat, who walked through the wall before it woke and can't get back", done: "“She walked through the wall? Of course she did. Cats.”" },
      { ask: "tell the Myriad Arrays disciples to stop laying practice arrays in the market, because the stalls keep drifting", done: "“My stall drifted three feet to the left! Three feet! Thank you!”" },
      { ask: "teach the palace children a game that doesn't involve the walls", done: "“They're playing tag! Real tag! With running! Heaven be praised.”" },
      { ask: "read the emperor a bedtime story, because Nurse-Mother Wang's voice has gone", done: "“He was asleep before the dragon. He always is. Thank you, {title}.”" },
    ],
    lessons: [
      { ask: "lay a ward of six flags round a house so the rain falls round it and not on it", done: "The rain falls round. Gongshu says that's the easy part. The hard part, he says, is making the rain not mind." },
      { ask: "read the qi of a hillside and say where a well should go", done: "They dig where she says. Water comes up at nine feet. Gongshu says it would have come up anywhere, but she didn't know that." },
      { ask: "unpick a stranger's array without waking it", done: "It sleeps on. Gongshu says that's the most important skill in the art, and the one nobody wants to learn." },
      { ask: "lay a little warming array in the nurseries of Linzi before winter", done: "The nurseries are warm. The children sleep. Gongshu says that's what arrays were for, before people started building walls with them." },
    ],
    goods: ["a jar of Linzi maple syrup", "a set of array flags from the Myriad Arrays' workshop", "a box of star-charts from the palace observatory", "a basket of Nurse-Mother Wang's buns"],
    tales: [
      "“Walls you can see through but can't cross? …That's every border I've ever crossed.”",
      "“A boy emperor with a kite. Poor little mite. Somebody should let him fly it.”",
      "“Linzi maple syrup. On rice cakes. You haven't lived.”",
      "“A regent who talks to a box at night? I'd lock the box away.”",
    ],
    emperor: [
      "When I'm grown up I'm going to take all the walls down. Even the ones round the palace. Especially those.",
      "I'm learning to write properly now. Not the Grand Tutor's way. Nurse-Mother's way. She writes like a hen walking, but it's hers.",
      "Can cultivators fly kites from their swords? Could you show me? Just once? Nobody needs to know.",
    ],
    guide: [
      "Twenty years in the palace and I've never once been allowed to sit on a chair in the throne room. The little one lets me now. I don't. It's not proper. But he lets me.",
      "Sima Heng used to bring the boy plums. Before. I hope there's something of that left in him.",
      "Here. Another bun. You're too thin for a cultivator. Do they not feed you up there?",
    ],
    leader: [
      "An array is a promise the land makes. Someone has been making the land promise things it shouldn't.",
      "Three hundred years I've kept those walls sleeping. One mortal with a stolen petal woke them in a night.",
      "When this is over, {peer}, I'm going to lay a new array round Linzi. One that keeps out nothing at all, and lets everyone know they're home.",
    ],
    boss: {
      intro: "at the Astronomer's Stone, under a sky turned green by the waking walls, Regent Sima Heng kneels over an open jade box, a tablet of office in his hand, and every array in Linzi turns its face toward you",
      words: [
        ["ct-boss", "You don't understand what the walls are for. The sects come and go as they please. They take tithe, they take disciples, they take children with good roots and never send them home. The walls keep the sects out."],
        ["ct-boss", "The Grand Tutor promised me that when the six thrones are one, no child of Qi will ever be taken up a mountain again."],
      ],
      fates: [
        { heart: "mercy", label: "Ask him who was taken", line: "She asks him who was taken up a mountain. His sister, he says. Thirty years ago. She finds the sister, an outer elder of a little sect in the south, and brings her to Linzi. The regent opens every gate himself, the morning she arrives." },
        { heart: "sword", label: "Break the box and bind him", line: "She breaks the jade box from his hands and the walls go dark all at once. She binds the regent and brings him to the boy emperor, who looks at him for a long time and gives him a plum." },
        { heart: "balance", label: "Make him keep the gates", line: "She makes him the keeper of Linzi's gates, every one of them, under the emperor's eye. His duty is to keep them open. He keeps them open for forty years, and greets everyone who comes through by name." },
        { heart: "slaughter", label: "Let the walls take him", line: "She turns the walls' question back on the man who asked it, and the arrays close round the regent and do not open again. The boy emperor is told the regent went away. He does not believe it. He is nine, not a fool." },
      ],
      victory: "The box is empty. Whatever was in it answered the regent from somewhere else. On its lid, scratched in a fine hand: 'Yan. The Sand Emperor. The thrones meet there at the new moon, and I shall give them a seal.'",
    },
  },
  // ------------------------------------------------------------------------------------------------ VI · Great Yan
  {
    title: "The Mandate of Heaven",
    hanzi: "天命",
    level: 18,
    beats: [
      {
        step: 0,
        npc: "ct-emperor",
        title: "The Conclave of Thrones",
        objective: "All six thrones have been summoned to Longcheng of the Sands, Great Yan's capital in the red badlands, for a conclave the Grand Tutor has called. The Sand Emperor Murong Tuo waits at his throne. Go.",
        lines: [
          ["narr", "Longcheng's square has six thrones in it today. Liang's old emperor, Chen's empress, Shu's emperor on his own two feet, Wei's Iron Emperor, Qi's boy emperor with a nurse behind him, and Yan's Sand Emperor, who is the youngest grown man of them and the most nervous."],
          ["ct-emperor", "The Grand Tutor wrote to all of us. He said he had found a way to end the Covenant forever. A seal: the Seal of Heaven's Mandate. Whoever holds it commands qi, as a cultivator does, without being one."],
          ["ct-emperor", "He says he will give it to whichever throne the others agree should hold it. One throne, over six realms. One emperor, who never again has to beg a sect for anything."],
          ["ct-emperor", "And then he says he will come himself to hand it over, at the new moon. I am the one he chose to host. I have been sick with fear for a month, {title}. Not of the sects. Of being chosen."],
        ],
        after: [["ct-emperor", "The six sect leaders are here too, uninvited, in their own camp outside the walls. Everyone is waiting for someone to draw first. Please don't be that someone."]],
        done: "The Sand Emperor gives her a seat on the dais between the thrones. It is the only seat in the square with no one's name on it.",
      },
      {
        step: 20,
        npc: "ct-leader",
        title: "The Six Sect Leaders",
        objective: "The six sect leaders have pitched their camp at the Beast-Taming Hall south of Longcheng. Hall Master Shou Tianlang speaks for them. Talk to him.",
        lines: [
          ["ct-leader", "He Lingxiao of the Crane. Lan Ruoshui of the Tide. Dan Qiu of the Cauldron. Fu Yinzi of the Talismans. Zhen Wuji of the Arrays. And me. Six sects, six thrones. We have never all stood in one place before. Not once in eight hundred years."],
          { a: "ct-leader", n: "tame" },
          ["ct-leader", "The Scarlet Phoenix, the Hundred Herbs and the Sword Sea sent word too: Yan Huo, Bai Zhi and Ling Feng say that if the Covenant falls, they will stand with whoever keeps it. Even the Azure Cloud has written. Your elder writes a very short letter, {peer}."],
          ["ct-leader", "We are agreed on one thing only. If any throne takes that seal, we take the throne. And then there will be no Covenant at all, only war, and the Grand Tutor will have won either way."],
        ],
        choice: {
          prompt: "Shou Tianlang asks her to carry the sects' word to the six thrones.",
          options: [
            { heart: "mercy", label: "Ask the sects to swear they will not draw first", then: "She asks the six leaders to swear, before her, that they will not draw first, whatever the thrones do.", reply: ["ct-leader", "…Swear it. All six of us. Very well. If you can make the thrones swear the same."], effect: quiet(2) },
            { heart: "sword", label: "Say she will take the seal herself", then: "She tells them she will take the seal from the Grand Tutor's hand before any throne can, and the sects can keep their swords sheathed.", reply: ["ct-leader", "You? Against a man who has been planning this since before you were born? …Yes. You might. Go on."] },
            { heart: "balance", label: "Propose the thrones and the sects meet as one council", then: "She proposes that the six thrones and the six sects sit together in the square, twelve chairs in a circle, before the Grand Tutor comes.", reply: ["ct-leader", "Twelve chairs. Nobody has ever thought of twelve chairs. Fetch the chairs."] },
            { heart: "slaughter", label: "Say a throne that reaches for it deserves to fall", then: "She says that any throne that reaches for the seal deserves whatever the sects do to it.", reply: ["ct-leader", "That's what he wants you to say. That's what he wants all of us to say."], effect: feed(3) },
          ],
        },
        done: "The six sect leaders walk into Longcheng's square together, unarmed. The six rulers stand to meet them. For a long moment nobody knows whether to bow, and then the boy emperor of Qi bows first, and everybody else has to.",
      },
      {
        step: 40,
        npc: "ct-master",
        title: "The Collared Beasts",
        objective: "Tamer Ah Qiao keeps the Sand Emperor's stables. The beasts round Longcheng have started wearing golden collars no one put on them. Take up beast taming with her and find out where they're coming from.",
        lines: [
          ["ct-master", "Down. Slowly. Hand out, flat. Don't look her in the eye. She's not a wolf any more, she's a frightened thing in a collar."],
          { a: "ct-master", n: "tame" },
          ["ct-master", "The collars are edict-script. Same as General Helian's soldiers, they say. Somebody is collaring the spirit beasts of the badlands to bring them to the conclave. A guard of beasts who cannot refuse."],
          ["ct-master", "They all came from the south. From the dunes past the Beast-Taming Hall. Someone is out there with a brush and a seal, writing beasts into obedience."],
        ],
        done: "Ah Qiao takes her on as her apprentice. The first beast she gentles is a sand-fox in a golden collar; when the collar breaks, the fox bites her, which Ah Qiao says means it is feeling better. (The art of Beast Taming: see the Journal.)",
      },
      {
        step: 60,
        npc: "ct-guide",
        title: "The Princess's Doubt",
        objective: "Princess Murong Xue is the Sand Emperor's sister and the only member of the Yan court the Grand Tutor never taught. Ask her why.",
        lines: [
          ["ct-guide", "I was a girl. He only taught heirs. He said a girl's hand didn't need to write anything an emperor might sign. So I learned to read on my own, from his letters, which he left lying about."],
          { a: "ct-guide", n: "fanning" },
          ["ct-guide", "He was nine when the sects turned him away. All of them. The Golden Crane, the Tidebreakers, the Cauldron, all six, and the Azure Cloud too. No roots, they said. Not a drop of spirit in him. He has been writing about it ever since. Forty years of letters."],
          ["ct-guide", "He doesn't want an emperor to hold that seal, {title}. Don't you see? He wants the six thrones to tear the sects down for him, and then he'll take the seal back. He's the only one who knows how to use it."],
        ],
        done: "Princess Murong Xue gives her a letter she found, unfinished, in the Grand Tutor's old rooms. 'When the sects are gone,' it says, 'there will be no one left to say I had no roots.'",
      },
      {
        step: 80,
        npc: "ct-folk-3",
        title: "The Camel-Master's Road",
        objective: "Camel-Master Batbayar has seen a grey caravan come in from the dunes every night this month. Ask him where it goes.",
        lines: [
          ["ct-folk-3", "Into the old royal tomb, under the square. Nobody's opened the tomb in two hundred years. The grey caravan opens it every night."],
          ["ct-folk-3", "There's an old man rides in the last cart. Thin. Kind face. Smells of ink. He tipped me a silver tael and asked me how my camels were. I liked him. I'm sorry to say it. I liked him."],
          { a: "ct-folk-3", n: "tame" },
          ["ct-folk-3", "He'll come up into the square at the new moon, through the tomb. That's tonight, {title}. That's tonight."],
        ],
        done: "Batbayar shows her the tomb's door, in the paving of the square, right in front of the six thrones. Someone has swept the sand off it very carefully.",
      },
      {
        step: 140,
        npc: "ct-emperor",
        title: "The New Moon",
        objective: "It is the night of the new moon. The six thrones and the six sects are gathered in Longcheng's square. Stand with the Sand Emperor and wait for the Grand Tutor.",
        lines: [
          ["narr", "Twelve chairs in a circle. Six thrones, six sects. In the middle, the tomb's door in the paving. At the third watch, very slowly, it opens."],
          ["ct-emperor", "He's coming up. Heaven help us all. He's coming up."],
          { a: "ct-emperor", n: "enthrone" },
          ["ct-emperor", "Whatever happens, {title}, I want you to know: you're the one I'd give it to. You're the only one here who doesn't want it."],
        ],
        done: "Up out of the dark comes an old man in black scholar's robes with a writing brush in one hand and, in the other, a seal of green jade, cut from one petal of a lotus, glowing like a lantern.",
      },
    ],
    rites: [
      { title: "The Twelve Chairs", after: 20, ask: "carry the twelve chairs into Longcheng's square and set them in a circle, thrones and sects alternating", done: "She sets them so that no throne sits beside another throne, and no sect beside another sect. Everyone has to talk to someone they've never talked to before." },
      { title: "The Six Seals", after: 20, ask: "carry each ruler's seal to the centre of the circle and lay them on a single cloth, as a pledge none will reach for another", done: "Six seals on one cloth. The old emperor of Liang lays his down first, with a hand that shakes a little. The Iron Emperor lays his down last, very hard." },
      { title: "The Camel Race", ask: "ride in the Sand Emperor's camel race, to show the court the conclave is a festival and not a war", done: "She comes third. A Beast-Taming disciple comes first, and a palace maid second. The crowd cheers all three." },
      { title: "The Oath of the Twelve", after: 20, ask: "witness the six rulers and the six sect leaders swear the Covenant of Cloud and Throne anew, all twelve together", done: "Twelve voices. It is the first time the oath has been sworn by more than two. The words are the same as they were eight hundred years ago. They sound different." },
      { title: "The Feast of the Desert", ask: "sit at the Sand Emperor's feast and make sure every throne and every sect gets a cup from the same jar", done: "Same jar, same cups. Nobody is poisoned. It is the most relaxed feast in Yan's history, everyone agrees afterwards." },
    ],
    favours: [
      { ask: "water his camels, because the stable boys ran to see the conclave", done: "“Forty camels, forty buckets. You've earned a camel ride. Not a race. A ride.”" },
      { ask: "carry a parasol over the boy emperor of Qi, because the desert sun is fierce", done: "“He kept trying to give it to me. Such manners! Thank you, {title}.”" },
      { ask: "find her daughter, who ran off to watch the Beast-Taming Hall's beasts", done: "“Riding a sand-tiger? Riding? …Well. She was always going to be trouble.”" },
      { ask: "help her serve tea to twelve rulers and leaders without spilling a drop", done: "“Not a drop! Not one! I'll dine on this for years.”" },
      { ask: "fetch his grandfather's old sword from the market, where he sold it in a bad year", done: "“The same sword! The very same notch! Thank you. Thank you.”" },
      { ask: "teach the palace children to make a sand-sculpture of all twelve chairs", done: "“They've made thirteen! They say the thirteenth is yours!”" },
    ],
    lessons: [
      { ask: "gentle a collared sand-fox and break its collar without breaking its trust", done: "The fox lets her near. The collar breaks. The fox bites her, then licks the bite. Ah Qiao says that's the whole art in one fox." },
      { ask: "groom the Sand Emperor's old warhorse, who bites everyone but children", done: "The horse does not bite her. Ah Qiao says she must have something of a child about her still. She chooses to take it as a compliment." },
      { ask: "sit a night in the stables with a spirit beast that is too frightened to eat, until it eats", done: "At dawn it eats from her hand. Ah Qiao says it was the patience, not the hand." },
      { ask: "lead a string of the Beast-Taming Hall's spirit camels across the dunes and back without losing one", done: "Not one lost. One tried. She sang to it. Ah Qiao says that's a technique, and asks her to teach it." },
    ],
    goods: ["a bolt of Yan camel-hair cloth", "a jar of desert honey", "a set of the Beast-Taming Hall's bone whistles", "a sack of Longcheng dates"],
    tales: [
      "“Six thrones and six sects in one square? I'd have paid to see that.”",
      "“The Grand Tutor? That kind old man? …Heaven, you can't trust anyone.”",
      "“A seal that lets a mortal command qi. My cousin would want it. That's why nobody should have it.”",
      "“Yan dates. Sweetest under heaven. The Sand Emperor eats a sack a week, they say.”",
    ],
    emperor: [
      "My father made me read every one of the Grand Tutor's letters aloud at supper. I know his hand better than my own.",
      "Twelve chairs. If my father could see this he would drop his soup.",
      "I don't want to be the emperor of six realms. I can barely manage one. I have a sister who could manage six. Nobody asks her.",
    ],
    guide: [
      "My brother is a better man than he thinks. He's just not a very good emperor yet. He'll learn.",
      "He never taught me. It's the best thing he ever did for me.",
      "When this is over I'm going to found a school. For girls. And for children nobody's sect would take. Every hand should learn to write its own name.",
    ],
    leader: [
      "A beast tamed by a collar is not tamed. It is only waiting. So is a realm.",
      "Six sects in one camp and nobody has drawn a sword. I'm prouder of that than of anything I've tamed.",
      "If the Grand Tutor had had roots, {peer}, he'd have been the greatest sect master of his age. That's the tragedy of it.",
    ],
    boss: {
      intro: "in the square of Longcheng, between twelve empty chairs, Fei Lian the Grand Tutor raises the Seal of Heaven's Mandate, and the qi of a stolen lotus petal pours through a mortal body that was never meant to hold it",
      words: [
        ["ct-boss", "I was nine. I walked up seven mountains. Seven sects looked into me and said: nothing. No roots. Go home and be a farmer. I went home and became the teacher of emperors instead."],
        ["ct-boss", "This is the Mandate of Heaven, child. Not a throne. Not a sect. A seal that says: I decide. And no one, ever again, will look into a child and say nothing."],
      ],
      fates: [
        { heart: "mercy", label: "Look into him and tell him what you see", line: "She looks into him, as the seven sects did, and tells him what she sees: a man who taught six children to write and loved every one of them. He lets go of the seal. He spends his last years teaching at Princess Murong Xue's school, and never once asks a child about their roots." },
        { heart: "sword", label: "Cut the seal from his hand", line: "She cuts the seal from his hand and the petal's qi goes out of him all at once, leaving a frail old man on the paving between the twelve chairs. The six rulers sentence him together: exile to a hermitage in the hills, with paper, ink, and no seal ever again." },
        { heart: "balance", label: "Give the seal to no one, and the man to everyone", line: "She takes the seal and gives it to no one. Fei Lian she gives to all twelve: thrones and sects decide together, round the circle, and decide that he will write the new Covenant out, in his own hand at last, and sign his own name to it." },
        { heart: "slaughter", label: "Turn the Mandate on him", line: "She turns the seal on him and commands. Heaven's Mandate, it turns out, obeys whoever holds it. The Grand Tutor's last word is her name. The twelve rulers and leaders look at her afterwards the way the seven sects once looked at him." },
      ],
      victory: "The Seal of Heaven's Mandate lies in her palm, green and warm, a petal of the Jade Lotus Heart carved into a square. The six thrones and the six sects stand round her in a circle, and none of them reaches for it.",
    },
  },
];
