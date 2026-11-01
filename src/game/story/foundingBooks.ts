import type { GameState } from "../engine/state";
import type { DaoId } from "../engine/dao";
import type { HumanId } from "../art/characters";
import { CULT, shift } from "../engine/cultivation";
import type { Beat, Fate } from "./hallsBooks";

/**
 * The words of the Founding (story/founding.ts composes the quests): five
 * books, from the first stone laid in the Withered Lotus Basin to the
 * morning six thrones and six sects come to watch her sect founded.
 *
 * Under all five runs one question: what it means to lead. A sect is not
 * its halls. It is the people in them, the rules they keep, the gods who
 * agree to hear their incense, and the one who stands at the front and
 * decides, every day, who comes in at the gate.
 *
 * Keys: "fd-steward" (her steward), "fd-earthgod" (the basin's Earth God),
 * "fd-elder-<n>" (her elders, once appointed), "fd-god-<id>" (the gods of
 * the Celestial Court, once they have come down), "fd-boss" (the book's
 * trouble), "hero" and "narr". Lines may name her standing ({title},
 * {peer}, {realm}) and her sect ({sect}, or {Sect} at the start of a
 * sentence).
 */

export interface Dilemma {
  title: string;
  /** The case, as it is put to her. */
  case: string;
  options: { heart: DaoId; label: string; line: string }[];
}

export interface FoundingBook {
  title: string;
  hanzi: string;
  /** The realm the book asks of her as it opens (an overall level index). */
  level: number;
  beats: Beat[];
  /** The sect's ceremonies: a title, what she must do, and how it goes. */
  rites: { title: string; ask: string; done: string }[];
  /** What she teaches the disciples, and what one of them says when it lands. */
  lectures: { topic: string; line: string }[];
  /** The cases brought to her as sect master. */
  dilemmas: Dilemma[];
  /** What the steward says between the beats. */
  steward: string[];
  boss: { intro: string; words: [string, string][]; fates: Fate[]; victory: string };
}

const feed = (by: number) => (g: GameState) => shift(g, CULT.demon, by);
const quiet = (by: number) => (g: GameState) => shift(g, CULT.demon, -by);
const named = (dao: DaoId) => (g: GameState) => ({ ...g, flags: { ...g.flags, [`fd:name:${dao}`]: true } });

export const FOUNDING_BOOKS_TEXT: FoundingBook[] = [
  // ------------------------------------------------------------------------------------------------ I · Choosing the Ground
  {
    title: "Choosing the Ground",
    hanzi: "择地",
    level: 4,
    beats: [
      {
        step: 0,
        npc: "fd-earthgod",
        title: "The Withered Lotus Basin",
        objective: "Three nights running you have dreamed of an old man no taller than your sash, leaning on a staff and asking you, very politely, to come and see his basin. The Withered Lotus Basin lies in the Yellow Sands, south of Hollowstone Hold. Find his shrine.",
        lines: [
          ["narr", "The basin is a bowl of cracked paving half drowned in sand. Dead reeds stand where water used to be. In the middle, a shrine no higher than her knee, and an old man sitting on it, swinging his feet."],
          ["fd-earthgod", "You came! Nobody comes. Caravans hurry past, armies march past, and in three hundred years the only one who stopped was a camel, and it only wanted the shade."],
          ["fd-earthgod", "I am the Earth God of this basin. Grandfather Earth, the caravans used to call me, back when they stopped here. It was a lake, then. There was a lotus in it."],
          ["fd-earthgod", "Your sect's founder planted it, {peer}. A young woman with a jade hairpin, before she had a sect at all. She sat by my lake for a year and a lotus grew out of her breath. Then she went up and built her sect in the clouds, and left the lotus with me."],
          ["fd-earthgod", "Six hundred years it grew in my lake, and the whole jianghu came to see it. The Crimson Cauldron's masters came to draw it once, and counted nine petals. Then, three hundred years ago, she came back for it and carried it up to her shrine. The spring followed it, and the basin has been dry ever since."],
          ["hero", "The Jade Lotus. She planted it here?"],
          ["fd-earthgod", "Every sect has to begin on some ground. Hers began on mine. And I have been thinking, the way old gods do, that the ground might like to be asked again."],
        ],
        after: [["fd-earthgod", "Found a sect here. Not a branch of hers. Your own. I can give you the ground, if you can give me back a reason for the caravans to stop."]],
        done: "She lights the first stick of incense the basin has smelled in three hundred years. Grandfather Earth sits up a little straighter on his shrine, and for a moment the sand round his feet is damp.",
      },
      {
        step: 15,
        npc: "fd-steward",
        title: "A Letter to the Azure Cloud",
        objective: "A disciple does not found a sect without telling her own. A man on the caravan road has offered to carry a letter up to the Azure Cloud for you, and he is waiting by the Earth God's shrine for it.",
        lines: [
          ["narr", "The man is thin, grey, and very neat, with ink on two fingers and an abacus tied to his belt like a sword."],
          ["fd-steward", "Bai Qiu, {title}. I kept a magistrate's books, until I kept them honestly and he noticed. I've been walking the caravan road since. I can carry a letter. I can also write one, if your hand shakes."],
          ["hero", "It doesn't shake. Much."],
        ],
        after: [
          ["narr", "The answer comes back in nine days, under the Azure Cloud's seal: “A disciple who founds a sect does not leave her own. She carries it further. Go on.”"],
          ["fd-steward", "Well. That's the first letter of your sect's archive. I'll keep it. Somebody has to keep things."],
        ],
        done: "The Azure Cloud gives her leave to found a sect of her own. Bai Qiu files the letter under a stone, since there is nowhere else yet to file anything.",
      },
      {
        step: 30,
        npc: "fd-steward",
        title: "A Steward Comes Down the Road",
        objective: "Bai Qiu has not left. He is sitting on the Earth God's shrine (with the Earth God's leave) doing sums in the sand. Ask him why.",
        lines: [
          ["fd-steward", "Because you haven't got a steward, {title}, and I've added it up. You'll need water, timber, stone, rice, and somebody to stand at the gate and say no to the wrong people. You can do the last one. I can do the rest."],
          ["fd-steward", "I don't want a sword or a pill. I want a door with my name on it, and books that nobody tells me to cook."],
        ],
        choice: {
          prompt: "What will you offer him?",
          options: [
            { heart: "mercy", label: "A door with his name on it, and your word", then: "She tells him the first door in the sect will be his, and that she will never ask him to cook a book.", reply: ["fd-steward", "…Then I'll keep yours straight till I die. That's not a promise. It's arithmetic."], effect: quiet(2) },
            { heart: "sword", label: "A fair wage, and the duty to tell you when you're wrong", then: "She offers him a wage and one duty above all: to tell her, to her face, when she is wrong.", reply: ["fd-steward", "That's two duties. I'll take them both."] },
            { heart: "balance", label: "A tenth of the sect's tithe, counted by him", then: "She offers him a tenth of whatever the sect takes in, counted by his own hand.", reply: ["fd-steward", "A tenth. Of nothing, today. You're a better merchant than you look, {title}."] },
            { heart: "slaughter", label: "His life, if he ever cheats you", then: "She tells him he may keep her books, and that if he ever cheats her she will know, and he will not need a door.", reply: ["fd-steward", "…Understood. I've worked for worse. Not much worse."], effect: feed(2) },
          ],
        },
        done: "Bai Qiu becomes the first steward of a sect that does not yet have a name, a wall, or a well.",
      },
      {
        step: 45,
        npc: "fd-steward",
        title: "What Shall It Be Called?",
        objective: "Bai Qiu cannot open a ledger for a sect without a name. Tell him what to write.",
        lines: [
          ["fd-steward", "I've got the ledger. I've got the brush. I've ground the ink twice. The page is waiting, {title}."],
          ["fd-earthgod", "A name is a kind of ground, too. Choose one you can stand on for a thousand years."],
        ],
        choice: {
          prompt: "What will your sect be called?",
          options: [
            { heart: "sword", label: "The Sword-Heart Sect (剑心宗)", then: "She names it the Sword-Heart Sect: “A blade that knows why it is drawn.”", reply: ["fd-steward", "Sword-Heart. Short, sharp, easy to carve. The masons will thank you."], effect: named("sword") },
            { heart: "mercy", label: "The Merciful Lotus Sect (慈莲宗)", then: "She names it the Merciful Lotus Sect: “No one turned from the gate.”", reply: ["fd-earthgod", "A lotus again. She would have liked that. So do I."], effect: named("mercy") },
            { heart: "balance", label: "The Even Cloud Sect (衡云宗)", then: "She names it the Even Cloud Sect: “Every weight on the scale.”", reply: ["fd-steward", "Even Cloud. A sect named after a pair of scales. You have no idea how happy that makes a bookkeeper."], effect: named("balance") },
            { heart: "slaughter", label: "The Blood Lotus Sect (血莲宗)", then: "She names it the Blood Lotus Sect: “What is ours, we keep.”", reply: ["fd-earthgod", "…Blood, in a dry basin. Well. At least it is wet."], effect: (g) => feed(3)(named("slaughter")(g)) },
          ],
        },
        done: "Bai Qiu writes the name at the top of the first page of the ledger, blows on it, and shows it to her. It is the first thing in the basin that is hers.",
      },
      {
        step: 60,
        npc: "fd-earthgod",
        title: "The Squatters in the Ruins",
        objective: "Grandfather Earth says someone has been selling the caravans water at the edge of the basin, and not paying him so much as a stick of incense for it. Ask him who.",
        lines: [
          ["fd-earthgod", "Tu Ba. The Dune Tyrant, he calls himself, which is a lot of name for a man with eleven camels. He has a cistern in the old ruins and he sells the caravans their own water back at ten times the price."],
          ["fd-earthgod", "And the dead don't like him either. He throws the ones who can't pay into the dunes. They come back up, sometimes. Hungry."],
          ["hero", "The sand ghouls."],
        ],
        after: [["fd-earthgod", "Clear the ghouls from the basin's edge first. Then he'll come to you. Men like Tu Ba always come once you've taken something from them, even if it was only their fear."]],
        done: "She learns the name of the basin's first trouble. Grandfather Earth draws Tu Ba's face in the sand with his staff, badly, and then wipes it out with his foot.",
      },
      {
        step: 75,
        npc: "fd-steward",
        title: "Children No Sect Would Take",
        objective: "The first people to come to the basin's gate are not cultivators. They are three caravan children, and every sect they have knocked at has turned them away for having no spiritual roots. Bai Qiu is waiting with them.",
        lines: [
          ["narr", "Three children stand in the sand by the half-built gate: a girl with a goat on a rope, a boy with a bandaged hand, and a smaller boy hiding behind both of them."],
          ["fd-steward", "No roots, {title}. Not a thread between them. I tested them with the stone the Golden Crane gave the caravans. It didn't even flicker."],
          ["hero", "And they walked here anyway."],
          ["fd-steward", "And they walked here anyway."],
        ],
        choice: {
          prompt: "What will your sect do with children who cannot cultivate?",
          options: [
            { heart: "mercy", label: "Take them in, roots or not", then: "She takes all three in. Whatever they can learn, they will learn here.", reply: ["fd-steward", "Then we'll need more rice than I'd planned. I'll plan."], effect: quiet(2) },
            { heart: "balance", label: "Take them in to learn the Hundred Arts", then: "She takes them in to learn the arts that need no roots: the fields, the forge, the brush and the pestle.", reply: ["fd-steward", "A sect that teaches a trade. The caravans will send you every child they have."] },
            { heart: "sword", label: "Take them in, and test them again in a year", then: "She takes them in on trial: a year of work and study, and then the stone again.", reply: ["fd-steward", "Fair. Harder than fair. They'll work twice as hard to prove you wrong."] },
            { heart: "slaughter", label: "Take them in as servants of the sect", then: "She takes them in to carry water and sweep the halls for the disciples to come.", reply: ["fd-steward", "…As you say. They'll eat, at least. That's more than they did yesterday."], effect: feed(2) },
          ],
        },
        done: "Her sect has its first three members, and none of them can cultivate. Grandfather Earth gives the goat a blessing, at the girl's insistence.",
      },
      {
        step: 120,
        npc: "fd-earthgod",
        title: "Water Under the Sand",
        objective: "Grandfather Earth has been listening to the sand. He says there is water under the basin still, a long way down, and that it remembers the lotus. Ask him where.",
        lines: [
          ["fd-earthgod", "Here. Under my shrine. Forty feet, perhaps fifty. Not the spring. The spring went up with the lotus. But the spring's little sister stayed behind, sulking."],
          ["hero", "Then we'll dig."],
          ["fd-earthgod", "You'll dig. I'll supervise. I'm very old, and supervising is what the very old are for."],
        ],
        done: "At forty-four feet the sand goes dark, and then wet, and then there is water, sweet and very cold. The children dance in the first bucket. The goat drinks the second.",
      },
      {
        step: 150,
        npc: "fd-steward",
        title: "Tu Ba's Letter",
        objective: "A letter has come from the ruins, tied to an arrow and shot into the gatepost. Bai Qiu has it.",
        lines: [
          ["fd-steward", "He wants half your well, {title}. Half the water, every day, carried to his cistern, or he says he'll bury the gate."],
          ["fd-steward", "The handwriting is terrible. The threat is not."],
        ],
        choice: {
          prompt: "What answer do you send Tu Ba?",
          options: [
            { heart: "balance", label: "Offer him a fair share for his camels, nothing more", then: "She sends back: his camels may drink at her well, as the caravans' do. His cistern may not.", reply: ["fd-steward", "Fair. He won't take it. But you'll have offered, and the caravans will hear you offered."] },
            { heart: "sword", label: "Send the arrow back with no letter", then: "She snaps the arrow's head off and sends the shaft back with no letter on it.", reply: ["fd-steward", "That's a letter too. A short one."] },
            { heart: "mercy", label: "Invite him to drink, and to stop", then: "She invites Tu Ba to come and drink at the well himself, and to stop selling water to people dying of thirst.", reply: ["fd-steward", "He'll think you're mad. Some of his men might not."], effect: quiet(1) },
            { heart: "slaughter", label: "Tell him you'll bury him in his cistern", then: "She tells him that if he comes to the gate, she will bury him in his own cistern.", reply: ["fd-steward", "…I'll copy that out neatly. It deserves neatness."], effect: feed(2) },
          ],
        },
        done: "The letter goes back to the ruins. That night the wind gets up out of the south, and it smells of something burning.",
      },
      {
        step: 180,
        npc: "fd-earthgod",
        title: "Before the Storm",
        objective: "The south wind has not stopped for three days. Grandfather Earth says it isn't weather. Ask him what it is.",
        lines: [
          ["fd-earthgod", "Tu Ba has a sand-talisman. Stolen from a tomb, I should think. He means to bring the dunes down on your gate and the ghouls up with them."],
          ["fd-earthgod", "I am a small god, {peer}. I can hold the ground under your feet. I cannot hold the sky."],
        ],
        after: [["hero", "Then hold the ground. I'll go and see about the sky."]],
        done: "Grandfather Earth plants his staff in front of the gate and does not move. She goes out into the storm to find Tu Ba.",
      },
    ],
    rites: [
      { title: "The Cornerstone", ask: "set the cornerstone of the Mountain Gate with the Earth God watching, and pour a cup of water over it", done: "The water sinks into the stone at once. Grandfather Earth says that means it was thirsty, which is a good sign in a cornerstone." },
      { title: "The Ledger Opened", ask: "write the first line in the sect's ledger with Bai Qiu", done: "The first line reads: “Received: one sect master, one steward, one goat.” Bai Qiu underlines the goat." },
      { title: "Incense for the Basin", ask: "light incense at Grandfather Earth's shrine at dawn, for every caravan that died crossing the sands", done: "The smoke goes straight up in the still air. Grandfather Earth names every caravan, one by one. It takes until noon." },
      { title: "The First Meal", ask: "eat the first meal in the basin with everyone there, from one pot", done: "Millet and dates and water from the new well. Nobody says it is good. Everybody has seconds." },
      { title: "The Beam Raised", ask: "raise the ridge-beam of the Hall of the Founding and tie the red cloth to it", done: "The beam goes up crooked, comes down, goes up straight. The red cloth flaps in the wind like it has always been there." },
      { title: "The Boundary Walked", ask: "walk the sect's boundary at night with the Earth God, setting a stone at every corner", done: "Four stones, four corners. Grandfather Earth taps each with his staff, and each one settles into the sand as if it had grown there." },
    ],
    lectures: [
      { topic: "how to breathe in the morning, when the sand is cold", line: "“In through the nose. Out through the… oh. Oh, I feel it. Is that qi? Is that what qi feels like?”" },
      { topic: "how to carry water without spilling half of it", line: "“It's in the knees? It was in the knees the whole time?”" },
      { topic: "why a sect has a gate, if anyone can climb the wall", line: "“So the gate's not for keeping people out. It's for knowing who came in.”" },
      { topic: "how to read the sky for a sandstorm", line: "“Yellow at the edges means wind by noon. My father knew that. I never listened to my father.”" },
      { topic: "the names of the ten realms of cultivation, from Qi Condensation to Immortal Ascension", line: "“That's a long way up. Where are you, {title}? …That far? Already?”" },
      { topic: "how to sit still for as long as a stick of incense burns", line: "“My leg's asleep. My other leg's asleep. Is my whole body supposed to be asleep?”" },
    ],
    dilemmas: [
      {
        title: "The Goat in the Hall",
        case: "The goat has eaten the red cloth off the ridge-beam. The girl who owns it is crying. The masons want it roasted.",
        options: [
          { heart: "mercy", label: "Keep the goat, buy new cloth", line: "The goat stays. Bai Qiu enters “one red cloth, replacement” in the ledger and sighs." },
          { heart: "balance", label: "The goat works off the cloth: it carries water for a month", line: "The goat carries water for a month, with the girl leading it. It does not seem to mind." },
        ],
      },
      {
        title: "The Caravan That Can't Pay",
        case: "A caravan has come in off the sands with nothing to pay for water. Their camels are dying. Bai Qiu says that if the well gives free water once, it gives free water forever.",
        options: [
          { heart: "mercy", label: "Water them, free", line: "The camels drink. The caravan-master weeps into his beard and swears to tell every road." },
          { heart: "balance", label: "Water them now, and let them pay in work", line: "The camels drink, and the caravan's men stay three days and haul timber for the hall." },
          { heart: "sword", label: "Water them for a fair price, on credit", line: "The camels drink, and the caravan-master signs Bai Qiu's ledger. He comes back in a month and pays every coin." },
        ],
      },
      {
        title: "Two Masons, One Wall",
        case: "Two masons have built the same wall twice, each knocking down the other's. Each says the other's is crooked.",
        options: [
          { heart: "balance", label: "Each builds half", line: "Each builds half. The wall has a bend in the middle, and both masons swear it's the other half that's wrong." },
          { heart: "sword", label: "Measure it yourself, and keep the straighter", line: "She drops a plumb line on both. One is straighter. That mason builds the wall; the other builds the next one." },
        ],
      },
      {
        title: "The Ghoul Who Asked for Water",
        case: "A sand ghoul has come to the gate at dusk and is standing there, not attacking, holding out its hands like a beggar.",
        options: [
          { heart: "mercy", label: "Give it water", line: "She pours it a cup. It drinks, and goes very still, and lies down in the sand, and does not get up again. Grandfather Earth says it had been thirsty a long time." },
          { heart: "slaughter", label: "Cut it down before it learns the way in", line: "She cuts it down at the gate. The children watch from the wall. Nobody says anything at supper.", },
        ],
      },
    ],
    steward: [
      "Timber's late. Stone's late. Rice is early, which is worse, because now I have to store it.",
      "The well gives three hundred buckets a day. I counted. Then I counted again, because I didn't believe it.",
      "A sect needs three things, {title}: water, rice, and somebody who says no. You're the third one.",
      "Grandfather Earth has asked for a cushion for his shrine. I've put it in the ledger under 'divine expenses'.",
    ],
    boss: {
      intro: "Tu Ba, the Dune Tyrant, rides out of the sandstorm on a camel with a stolen tomb-talisman burning in his fist",
      words: [
        ["fd-boss", "Half your well, little sect master. That was the price. Now it's all of it."],
        ["hero", "It was never yours to sell."],
        ["fd-boss", "The desert doesn't care whose it was. The desert only cares who's left standing."],
      ],
      fates: [
        { heart: "mercy", label: "Spare him, and give his men work", line: "She spares him, and offers his men work on the gate. Seven of the eleven take it. Tu Ba rides off alone with his camels into the sands, and is not seen again." },
        { heart: "sword", label: "Break the talisman, and hand him to the caravans' judgement", line: "She breaks the tomb-talisman across her knee and hands Tu Ba to the caravan-masters he robbed. They judge him by the old law of the sands: a waterskin, and a long walk." },
        { heart: "balance", label: "Make him pay back every caravan, in water", line: "She sets him to work hauling water from her well to every caravan he cheated, until the debt is paid. Bai Qiu keeps the tally. It will take him four years." },
        { heart: "slaughter", label: "Bury him in his cistern, as you said you would", line: "She keeps her word. The cistern is filled in over him, and the sand closes over the place, and the caravans do not ask." },
      ],
      victory: "The storm drops all at once. Behind her the gate is still standing, with a little old god leaning on his staff in front of it, covered in sand from head to foot and laughing.",
    },
  },

  // ------------------------------------------------------------------------------------------------ II · Taking Disciples
  {
    title: "Taking Disciples",
    hanzi: "收徒",
    level: 7,
    beats: [
      {
        step: 0,
        npc: "fd-steward",
        title: "The Gate Is Open",
        objective: "Word of the sect in the Withered Lotus Basin has gone along every caravan road. Bai Qiu says there is a line at the gate. Go and see.",
        lines: [
          ["narr", "The line goes from the gate down the slope and out across the sand: farmers' sons, runaway apprentices, a monk with no temple, two sisters from Hailing, an old woman who says she has always wanted to fly."],
          ["fd-steward", "Ninety-one, at dawn. A hundred and four now. They heard you took three children with no roots and didn't throw them out. They've all got something somebody threw them out for."],
          ["hero", "We can't take them all."],
          ["fd-steward", "No. But you have to be the one who says so. Every one of them walked here to hear it from you."],
        ],
        done: "She goes down the line herself, one face at a time, and learns every name. It takes three days. Bai Qiu writes every one in the ledger, taken or not.",
      },
      {
        step: 20,
        npc: "fd-steward",
        title: "The First Selection",
        objective: "Every great sect has a Grand Selection. Yours needs one too. Decide with Bai Qiu how your sect will choose.",
        lines: [
          ["fd-steward", "The Ten Halls test roots. The Golden Crane tests lineage. The Tidebreakers throw you in the sea. What does your sect test, {title}?"],
        ],
        choice: {
          prompt: "How will your sect choose its disciples?",
          options: [
            { heart: "sword", label: "A climb up the dune at noon: whoever reaches the top", then: "She sets the test: climb the great dune at noon, in the sun. Whoever reaches the top is in.", reply: ["fd-steward", "Hard and plain. The ones who make it will never forget it."] },
            { heart: "mercy", label: "A question: “Why did you come?”", then: "She sets the test as a question, asked of each alone: why did you come?", reply: ["fd-steward", "And if they lie? …Ah. You'll know. Of course you'll know."], effect: quiet(1) },
            { heart: "balance", label: "A month of work: whoever is still here", then: "She sets the test as a month of ordinary work. Whoever is still at it at the end of the month is a disciple.", reply: ["fd-steward", "The slowest test there is. And the fairest. I approve. I'm a bookkeeper; I always approve of slow."] },
            { heart: "slaughter", label: "Bouts: the strongest half stays", then: "She sets the test as bouts in the sand: the stronger half stays, the rest go home.", reply: ["fd-steward", "…Half go home bruised. Well. They'll know where they stand."], effect: feed(2) },
          ],
        },
        done: "Her sect's first Selection is held in the sand below the gate. When it is over, forty-two new disciples sleep in the basin, and the quarters are full for the first time.",
      },
      {
        step: 60,
        npc: "fd-steward",
        title: "A Swordswoman Without a Sect",
        objective: "A swordswoman has come to the gate asking for a bout with the sect master, and has beaten three of your disciples while waiting. Bai Qiu has asked her, politely, to stop.",
        lines: [
          ["fd-elder-0", "Jiang. Just Jiang. My sect went down in the war, all of it, and I've been walking the roads since looking for somewhere worth teaching."],
          ["fd-elder-0", "Your children hold their swords like spoons, {peer}. Somebody should show them how. I'd like it to be me. But I want to see your sword first."],
        ],
        after: [
          ["narr", "They fight in the practice yard until the sun goes down. Neither of them wins. Both of them are smiling at the end of it."],
          ["fd-elder-0", "Good. You'll do. I'll take the sword yard."],
        ],
        done: "Jiang becomes the sect's first elder, the Elder of the Sword. By the next morning every disciple is holding their sword like a sword.",
      },
      {
        step: 90,
        npc: "fd-steward",
        title: "Envoy in White",
        objective: "A delegation in white silk has arrived from the Orthodox Alliance, the league of the great old sects. Their envoy is asking for you at the gate.",
        lines: [
          ["narr", "The envoy is a smiling old man with a golden whisk and a train of servants carrying chests. He bows to her exactly as low as he has to, and not a hair lower."],
          ["fd-steward", "Qian Sou, he calls himself. Envoy of the Alliance. He says the Alliance would like to “help”. He's said “help” nine times. I counted."],
          ["hero", "What kind of help?"],
          ["fd-steward", "He's offered silver for your five best disciples. To “give them the future a small sect cannot”. He's offered it to their parents, too. Two of them took it."],
        ],
        done: "She sends the envoy away with his chests unopened. He bows again, exactly as low as he has to, and says the Alliance is patient.",
      },
      {
        step: 140,
        npc: "fd-steward",
        title: "The Alchemist Who Burned Her Hall Down",
        objective: "A woman has come to the gate with no eyebrows and a cauldron on her back. Bai Qiu says she wants to talk about the Pill Chamber. Urgently.",
        lines: [
          ["fd-elder-1", "Kang Lin. Pill-master, formerly of a sect I won't name because they'd only deny it. I burned their pill hall down. By accident. Mostly."],
          ["fd-elder-1", "I make the best Healing Pill south of the river, {peer}, and every eleventh batch explodes. I'm told you take people other sects throw out."],
        ],
        choice: {
          prompt: "Make her the Elder of Pills?",
          options: [
            { heart: "mercy", label: "Yes, and build her a pill chamber with thick walls", then: "She makes Kang Lin the Elder of Pills, and has the chamber's walls built twice as thick.", reply: ["fd-elder-1", "Thick walls. Oh, I could weep. Nobody ever thinks of the walls."] },
            { heart: "balance", label: "Yes, and every eleventh batch is made outside", then: "She makes Kang Lin the Elder of Pills on one condition: every eleventh batch is brewed out on the sand.", reply: ["fd-elder-1", "Outside. Brilliant. Why didn't I ever think of that? …Because nobody ever let me outside."] },
            { heart: "sword", label: "Yes, once she has shown you why the eleventh explodes", then: "She makes Kang Lin the Elder of Pills, once Kang Lin has worked out, in front of her, why every eleventh batch explodes.", reply: ["fd-elder-1", "It's the copper in the stirring rod. It's been the copper for twenty years. I could kiss you."] },
          ],
        },
        done: "Kang Lin becomes the Elder of Pills. The Pill Chamber's chimney smokes day and night, and the sect's disciples stop dying of fevers.",
      },
      {
        step: 160,
        npc: "fd-elder-0",
        title: "Missing Disciples",
        objective: "Three disciples have vanished from the quarters in the night. Elder Jiang found the tracks. Go to her.",
        lines: [
          ["fd-elder-0", "Sacks. Dragged. Through the wall, not over it, which means they had somebody inside to open it. And this, in the sand."],
          ["narr", "A strand of white silk, of the kind the Alliance's servants wear."],
          ["fd-elder-0", "The Disciple-Snatchers. They work for whoever pays them, and the Alliance pays them very well. They take the promising ones from small sects and sell them to great ones."],
        ],
        done: "She and Elder Jiang follow the tracks out into the dunes. They find two of the three before dawn, tied up in a cave. The third has already been sold on.",
      },
      {
        step: 185,
        npc: "fd-steward",
        title: "Qian Sou's Price",
        objective: "Qian Sou has written again. This time he is offering to buy the whole sect. Bai Qiu has the letter.",
        lines: [
          ["fd-steward", "He offers to take every disciple into the Alliance's sects, pay your debts, and give you a seat as a guest elder in the Golden Pavilion. Very generous. Very well written."],
          ["fd-steward", "And at the bottom, very small: “The third child sold on was not the last.”"],
          ["hero", "Where is he?"],
          ["fd-steward", "Waiting for your answer in the dunes south of the gate, with his snatchers about him. He doesn't think you'll come yourself. Men like him never do."],
        ],
        done: "She folds the letter in four and puts it in her sleeve. Then she goes south.",
      },
    ],
    rites: [
      { title: "The First Bows", ask: "receive the first bows of the newly chosen disciples in front of the Hall of the Founding", done: "Forty-two foreheads touch the paving. She bows back to them, which no sect master is supposed to do. Bai Qiu writes that down too." },
      { title: "The Robes Given Out", ask: "hand out the sect's first robes, sewn by the caravan women, one to each disciple", done: "The robes are every colour the caravans had cloth in. Nobody matches. Everybody looks like they belong to the same sect anyway." },
      { title: "The Sword Yard Swept", ask: "sweep the new sword yard with Elder Jiang before the first morning's forms", done: "Elder Jiang sweeps the way she fights: no wasted strokes. The yard is clean in a quarter of an hour." },
      { title: "The Rice Planted", ask: "plant the first spirit rice in the new fields with the children who came first", done: "The girl with the goat plants hers in a perfect row. The goat eats one. Everyone pretends not to see." },
      { title: "The First Pill", ask: "light the Pill Chamber's furnace with Elder Kang Lin and watch the first batch", done: "The first batch comes out perfect. Elder Kang Lin bursts into tears. “It's the walls,” she says. “It's the walls.”" },
      { title: "The Names Called", ask: "call the roll of every disciple in the sect at the hour of the dragon, from memory", done: "She gets every name. The smallest boy, who was sure she'd forget his, has to be sent away from the line to compose himself." },
      { title: "The Forge Lit", ask: "light the forge and strike the first blow on the sect's first sword", done: "The first sword is short, heavy and not very sharp. The smith says it will be the best one they ever make, because it was the first." },
    ],
    lectures: [
      { topic: "the three ways to hold a sword, and the one way not to", line: "“So the spoon grip is the one way not to. …I've been using the spoon grip for a month.”" },
      { topic: "why a cultivator eats rice and not only qi", line: "“The body is the cauldron. You don't let the cauldron rust. Can I have seconds, then?”" },
      { topic: "how to tell a Healing Pill from a poison", line: "“Smell it, look at it, and ask Elder Kang. Mostly ask Elder Kang.”" },
      { topic: "what to do when someone offers you silver to leave", line: "“Ask them why they want you so much. Then think about why.”" },
      { topic: "how to meditate when your roommate snores", line: "“The snoring is the wind. The wind is the Dao. My roommate is the Dao? …He won't like that.”" },
      { topic: "the forms of the Lotus Step, slowly, from the first to the ninth", line: "“Fifth form. I did the fifth form! Did you see? Did anyone see?”" },
      { topic: "how to fall without breaking your wrist", line: "“Roll. Always roll. I'm going to roll everywhere now. I'm going to roll to breakfast.”" },
      { topic: "why the strong owe the weak", line: "“Because one day you'll be weak again. Old, or hurt, or tired. And you'll want somebody to have learned this.”" },
    ],
    dilemmas: [
      {
        title: "The Boy Who Lied About His Age",
        case: "A boy who passed the Selection is not fourteen, as he said. He is ten. His mother is dead and he walked here from Willow Creek.",
        options: [
          { heart: "mercy", label: "He stays", line: "He stays. Elder Jiang gives him a wooden sword until he is old enough for a steel one." },
          { heart: "sword", label: "He stays, but he must tell everyone the truth himself", line: "He stays, once he has stood in the yard and told every disciple his real age. Nobody laughs. Jiang sees to that." },
        ],
      },
      {
        title: "The Disciple Who Took the Silver",
        case: "One of your disciples took Qian Sou's silver to leave, then changed his mind and came back. He still has the silver.",
        options: [
          { heart: "balance", label: "The silver goes to the sect; he stays", line: "The silver goes into Bai Qiu's chest, and the boy goes back to his bunk. He works harder than anyone for a month." },
          { heart: "sword", label: "He returns the silver to Qian Sou in person", line: "He carries the silver back to the envoy's camp himself and puts it on the table. He walks back with his head up." },
          { heart: "slaughter", label: "He leaves, silver and all", line: "He leaves with the silver. The others watch him go and do not forget it." },
        ],
      },
      {
        title: "Too Many Mouths",
        case: "Bai Qiu says that at this rate the rice runs out before the fields come in. Someone has to go hungry, or someone has to go.",
        options: [
          { heart: "mercy", label: "Everyone eats less, sect master first", line: "Everyone eats a little less, and she eats least. The rice lasts until the harvest, just." },
          { heart: "balance", label: "Send the strongest out on the caravan road to earn rice", line: "Twenty of the strongest go out guarding caravans for a month and come back with rice, salt and stories." },
        ],
      },
      {
        title: "A Bout Gone Too Far",
        case: "Two disciples fought in the yard, and one broke the other's arm. Each says the other started it.",
        options: [
          { heart: "sword", label: "Both are barred from the yard for a month", line: "Both are barred from the yard for a month. They spend it together carrying water, and come out of it friends." },
          { heart: "mercy", label: "The one who broke it nurses the other until it heals", line: "The one who broke the arm nurses the other until it heals. By the end he has learned to set bones." },
        ],
      },
    ],
    steward: [
      "A hundred and four hopefuls in a day. Twelve with roots. Ninety-two with feet. We'll need more bunks.",
      "Qian Sou's servants are buying dates in our market. Very politely. I don't like them.",
      "Elder Jiang has asked for forty practice swords and a barrel of liniment. In that order.",
      "The sect owns nine camels now. Don't ask me how. The ledger knows.",
    ],
    boss: {
      intro: "Qian Sou, the Disciple-Buyer, waits in the dunes south of the gate with a ring of snatchers about him and a ledger of names in his hand",
      words: [
        ["fd-boss", "Everything has a price, little sect master. Every disciple, every elder. Even you. I am only being honest about it."],
        ["hero", "You sold a child."],
        ["fd-boss", "I found a child a better home. Ask him in ten years whether he minds. Ask yourself whether you could have given him a tenth of it."],
      ],
      fates: [
        { heart: "mercy", label: "Make him buy back every child he sold", line: "She spares him on one condition: every child he ever sold, he buys back with his own silver and brings home. It takes him two years and every coin he has. He brings back sixty-one." },
        { heart: "sword", label: "Take his ledger to every sect it names", line: "She takes his ledger of names, every child sold and every sect that bought one, and carries it to each of those sects in turn. Some of them are ashamed. That is a start." },
        { heart: "balance", label: "Let the children he sold choose his fate", line: "She finds the children he sold, now disciples of great sects, and lets them decide. Most of them choose to let him go. One of them asks to come home with her." },
        { heart: "slaughter", label: "Sell him to the snatchers", line: "She sells Qian Sou to his own snatchers, at a fair price. They are very professional about it." },
      ],
      victory: "The snatchers scatter into the dunes. In the envoy's chest she finds the third child, asleep on a bed of silks, and carries him home on her back.",
    },
  },

  // ------------------------------------------------------------------------------------------------ III · Laying Down the Rules
  {
    title: "Laying Down the Rules",
    hanzi: "立规",
    level: 10,
    beats: [
      {
        step: 0,
        npc: "fd-steward",
        title: "Too Many Disciples, Too Few Rules",
        objective: "There has been a fight in the refectory: forty disciples, two benches, a pot of congee and a goat. Bai Qiu says it is time the sect had rules. Go to him.",
        lines: [
          ["fd-steward", "Nobody started it, everybody finished it, and the goat is the only one who isn't sorry. We have {disciples} disciples now, {title}. That many people need rules."],
          ["fd-steward", "And a rule is only as good as whoever keeps it. You can't keep them all yourself. You need elders who can say no when you're not there."],
          ["hero", "Then let's find them."],
        ],
        done: "She spends the night writing down every rule she can think of. In the morning she crosses most of them out. Nine are left.",
      },
      {
        step: 20,
        npc: "fd-steward",
        title: "The Old Man in the Scripture Pavilion",
        objective: "An old scholar has been sleeping in the new Scripture Pavilion and copying out its manuals by night, without asking. Bai Qiu caught him. Go and see.",
        lines: [
          ["fd-elder-2", "Zeng. I was a librarian in a sect that no longer exists. The Blood Moon burned it, and its library with it. I have spent twenty years writing down what I remember."],
          ["fd-elder-2", "You have eleven manuals here, {peer}, and four of them are copied wrong. Let me keep your books. I have nowhere else to keep mine."],
        ],
        done: "Zeng becomes the Elder of the Scriptures. By the end of the month the Scripture Pavilion holds a hundred and nine manuals, and none of them are copied wrong.",
      },
      {
        step: 40,
        npc: "fd-steward",
        title: "A Judge for the Sect",
        objective: "A sect needs an Elder of Discipline: someone who keeps the rules even when the sect master would rather not. Bai Qiu has found a candidate, and says you will not like him.",
        lines: [
          ["fd-elder-4", "Guan. I was a magistrate's constable for thirty years. I arrested Bai Qiu once. He was right and I was wrong, and he has never let me forget it."],
          ["fd-elder-4", "I will keep your rules, {peer}. All of them. On everyone. Including you. If you don't want that, don't hire me."],
        ],
        choice: {
          prompt: "Make Guan the Elder of Discipline, rules for everyone, sect master included?",
          options: [
            { heart: "sword", label: "Yes: the rules bind you too", then: "She makes Guan the Elder of Discipline and tells him the rules bind her first.", reply: ["fd-elder-4", "Good. Your bunk's a mess, by the way. Rule four."] },
            { heart: "balance", label: "Yes: but the sect master may pardon, once a year", then: "She makes Guan the Elder of Discipline, and keeps for herself a single pardon a year.", reply: ["fd-elder-4", "One pardon. Use it well. I'll be counting."] },
            { heart: "mercy", label: "Yes: and every punishment must teach something", then: "She makes Guan the Elder of Discipline on one condition: no punishment that teaches nothing.", reply: ["fd-elder-4", "…Hm. That's harder. I'll have to think of things. I don't mind thinking."] },
          ],
        },
        done: "Guan becomes the Elder of Discipline. On his first day he gives three disciples, two elders and Bai Qiu a warning. Bai Qiu frames his.",
      },
      {
        step: 60,
        npc: "fd-steward",
        title: "The Array-Wright From Linzi",
        objective: "A woman has been drawing circles in the sand round the basin all week, and the sand inside them has stopped blowing. Bai Qiu thinks she wants a job.",
        lines: [
          ["fd-elder-3", "Xiang. I studied arrays in Linzi, before the walls went strange there. I left. I didn't like what the walls were for."],
          ["fd-elder-3", "Your basin is a natural array, {peer}. A bowl, a spring, a shrine at the centre. Somebody very old drew it. Let me finish it."],
        ],
        done: "Xiang becomes the Elder of Arrays. When she has finished the ward the sandstorms go round the basin like water round a stone.",
      },
      {
        step: 80,
        npc: "fd-elder-4",
        title: "The Nine Rules",
        objective: "Elder Guan wants the sect's rules carved on a stele before the gate, where everyone who comes in can read them. Settle with him what they will say at the top.",
        lines: [
          ["fd-elder-4", "Nine rules is a good number. But the first one is the one they'll remember, {peer}. The rest are details. What's the first?"],
        ],
        choice: {
          prompt: "What is your sect's first rule?",
          options: [
            { heart: "mercy", label: "“Turn no one from the gate who comes in need.”", then: "The first rule is carved: “Turn no one from the gate who comes in need.”", reply: ["fd-elder-4", "That one's going to be expensive. Bai Qiu will cry. Carve it deep."], effect: quiet(2) },
            { heart: "sword", label: "“Draw no blade you cannot explain.”", then: "The first rule is carved: “Draw no blade you cannot explain.”", reply: ["fd-elder-4", "Good. Short. I can enforce that one in my sleep."] },
            { heart: "balance", label: "“What you take, return.”", then: "The first rule is carved: “What you take, return.”", reply: ["fd-elder-4", "Covers theft, debt, and borrowing my good brush. Excellent."] },
            { heart: "slaughter", label: "“No one strikes the sect and walks away.”", then: "The first rule is carved: “No one strikes the sect and walks away.”", reply: ["fd-elder-4", "…That one keeps itself. I'm not sure I like that."], effect: feed(2) },
          ],
        },
        done: "The Nine Rules are carved on a stele before the gate. The caravans stop to read them, and some of them stay.",
      },
      {
        step: 130,
        npc: "fd-elder-2",
        title: "A Stolen Manual",
        objective: "A manual has gone missing from the Scripture Pavilion: the Lotus Step, all nine forms. Elder Zeng is beside himself. Go to him.",
        lines: [
          ["fd-elder-2", "Not borrowed. Taken. The seal was cut, not broken. Somebody who knew how seals are made."],
          ["fd-elder-2", "And a new guest elder came to us last month with a letter of recommendation from the Golden Crane. Hou Mian. A very charming man. He has asked to see the Pavilion three times."],
        ],
        done: "The manual turns up in the refectory, in the bottom of the rice barrel, where anyone could have put it. Elder Zeng does not believe it got there by itself.",
      },
      {
        step: 150,
        npc: "fd-elder-4",
        title: "Two Halves of the Sect",
        objective: "The disciples have split into two camps: those who came first, with no roots, and those who came later, with them. They no longer eat at the same tables. Elder Guan wants a word.",
        lines: [
          ["fd-elder-4", "The rooted ones say the rootless are servants who think they're disciples. The rootless say the rooted ones came when it was easy. Both of them are quoting things you never said."],
          ["fd-elder-4", "Somebody is whispering to both halves. Hou Mian sits with the rooted at supper and the rootless at breakfast. Every time."],
        ],
        choice: {
          prompt: "How will you mend the sect?",
          options: [
            { heart: "mercy", label: "Eat with each half, every day, until they eat together", then: "She takes her meals at the rootless tables one day and the rooted the next, until the two halves begin, grudgingly, to sit together.", reply: ["fd-elder-4", "It'll take a month. It'll work. Hm."] },
            { heart: "sword", label: "Gather everyone in the yard and say it plainly", then: "She gathers the whole sect in the yard and says it plainly: there are no halves. Then she asks who has been telling them otherwise.", reply: ["fd-elder-4", "Nobody answered. But twenty of them looked at Hou Mian."] },
            { heart: "balance", label: "Pair every rooted disciple with a rootless one", then: "She pairs every rooted disciple with a rootless one, to train, eat and work together for a season.", reply: ["fd-elder-4", "They'll hate it for a week. Then they'll hate whoever split them."] },
          ],
        },
        done: "The sect begins to mend. Hou Mian smiles at her across the yard, the way a man smiles at a game that is going well.",
      },
      {
        step: 180,
        npc: "fd-elder-3",
        title: "The Array That Listens",
        objective: "Elder Xiang says the basin's ward has been hearing something it shouldn't: two voices from one room at night, where only one man sleeps. Go to her.",
        lines: [
          ["fd-elder-3", "The ward listens. That's what wards do. And at the hour of the rat, in the guest elder's room, it hears two voices. One is Hou Mian's. The other is also Hou Mian's."],
          ["fd-elder-3", "A two-faced art, {peer}. One face for each half of the sect. And a letter going out every week to the Orthodox Alliance."],
        ],
        after: [["hero", "Then it's time he showed us both faces at once."]],
        done: "She goes to the guest elder's room at the hour of the rat. It is empty. On the bed, two masks, and a note in the Alliance's hand: “The sect cannot hold.”",
      },
    ],
    rites: [
      { title: "The Rules Read Out", ask: "read the Nine Rules aloud to the whole sect in the yard at dawn", done: "{disciples} disciples listen without a sound. When she finishes, the goat bleats, and everyone laughs, and the rules are somehow better for it." },
      { title: "The Elders Seated", ask: "seat the elders in the Hall of the Founding for the first council", done: "Four chairs, then five, then six. Bai Qiu brings his abacus. Elder Guan brings the rules. Nobody brings tea, and that is the first thing the council decides about." },
      { title: "The Library Sealed", ask: "set the seal on the Scripture Pavilion with Elder Zeng, one character a night for nine nights", done: "On the ninth night the seal glows, and Elder Zeng says it will open now only for those who have read the Nine Rules." },
      { title: "The Ward Woken", ask: "wake the basin's ward with Elder Xiang at the four boundary stones", done: "The sand stills. The air goes cool. Far off, a sandstorm turns aside like a polite guest." },
      { title: "The First Mission", ask: "send the first disciples out from the Mission Hall to guard a caravan to Jincheng", done: "They come back in a month with the caravan's thanks, a bolt of brocade and a story about a bandit who ran away from a girl with a goat." },
      { title: "The Infirmary Blessed", ask: "light incense in the House of Healing for everyone who will ever be carried into it", done: "The healer places the incense herself, very carefully, by the first bed." },
    ],
    lectures: [
      { topic: "why a rule matters most when nobody is watching", line: "“Because that's when it's yours. Before that, it's just Elder Guan's.”" },
      { topic: "how to copy a manual without copying its mistakes", line: "“Read it three times. Copy it once. Ask Elder Zeng about the fourth character.”" },
      { topic: "the twelve basic talismans, and which three not to mix", line: "“Fire, wind and paper. Oh. Oh, that's why the Talisman Hall has a bucket by the door.”" },
      { topic: "how an array listens", line: "“It doesn't hear words. It hears weight. So if I think very lightly… no? No.”" },
      { topic: "how to set a bone", line: "“Pull, turn, splint. And talk to them the whole time. The talking is half of it.”" },
      { topic: "what it means to be the elder disciple of a sect", line: "“It means when something goes wrong, they look at you first. Even if you didn't do it.”" },
      { topic: "how to gentle a spirit camel", line: "“Don't look it in the eye. Don't turn your back. Don't stand downwind. Why do people like camels?”" },
      { topic: "why the two halves of a sect are one", line: "“Rooted or not, we all came through the same gate. We all ate the same congee. We were all in the same fight with the goat.”" },
    ],
    dilemmas: [
      {
        title: "The Elder's Nephew",
        case: "Elder Jiang's nephew broke rule three, and Elder Guan wants him punished like anyone else. Elder Jiang has asked you, privately, to go easy.",
        options: [
          { heart: "sword", label: "Like anyone else", line: "He is punished like anyone else. Elder Jiang does not speak to her for three days, and then thanks her." },
          { heart: "mercy", label: "Like anyone else, but you tell Jiang to her face first", line: "She tells Jiang herself before Guan does. Jiang nods once, and goes to tell the boy." },
        ],
      },
      {
        title: "The Thief Who Fed His Family",
        case: "A disciple has been stealing rice from the stores and carrying it to his family in the market town. Bai Qiu caught him at it.",
        options: [
          { heart: "mercy", label: "The rice is a gift; his family eats from the refectory", line: "His family are given places at the refectory's end table. He never steals again, and he cries at every meal for a week." },
          { heart: "balance", label: "He works it off in the fields", line: "He works it off in the spirit fields, one bushel for every bushel. By the harvest he is the best farmer in the sect." },
          { heart: "sword", label: "He confesses before the sect, and is forgiven", line: "He confesses before the whole sect. Elder Guan forgives him in front of everyone. Nobody steals rice that year." },
        ],
      },
      {
        title: "The Duel Over a Girl",
        case: "Two disciples want to duel over a third, who has asked them, loudly and in public, to stop it.",
        options: [
          { heart: "balance", label: "Let her decide whether there is a duel", line: "She lets the girl decide. There is no duel. There is, however, a great deal of extra water-carrying for two young men." },
          { heart: "sword", label: "They may duel: with Elder Jiang", line: "They may duel, says the sect master, but with Elder Jiang. Both of them change their minds." },
        ],
      },
      {
        title: "A Manual From the Blood Moon",
        case: "Elder Zeng has found a Blood Moon manual in a caravan's goods. It is very powerful. It is also very wicked.",
        options: [
          { heart: "balance", label: "Seal it in the Pavilion, unread", line: "It is sealed in the deepest shelf of the Pavilion, where only the sect master may open it. She never does." },
          { heart: "mercy", label: "Burn it", line: "She burns it in the forge. Elder Zeng weeps for the paper, and then agrees." },
          { heart: "slaughter", label: "Read it", line: "She reads it in one night. In the morning she knows nine new ways to kill a man, and her eyes are darker.", },
        ],
      },
    ],
    steward: [
      "{disciples} disciples, six elders, nine rules and one goat. The goat has more privileges than any of them.",
      "Elder Guan gave me a warning. For keeping the ledger in my sleeve. I'm keeping the warning in my sleeve now too.",
      "The Mission Hall took in forty silver this month. The House of Healing spent thirty-nine. I call that a good month.",
      "The caravans call it 'the basin sect' still. Your name's catching on in the towns, though. Slowly.",
    ],
    boss: {
      intro: "Hou Mian, the Two-Faced Elder, stands in the Hall of the Founding with a mask in each hand and both his faces laughing",
      words: [
        ["fd-boss", "A sect is a lie everyone agrees to tell together, little sect master. I only told each half the lie it wanted."],
        ["hero", "You told them they were two."],
        ["fd-boss", "They were always two. Rooted and rootless. Strong and weak. I didn't make the crack. I only leaned on it."],
      ],
      fates: [
        { heart: "mercy", label: "Let both halves of the sect see his faces, and forgive him", line: "She makes him take off both masks in the yard, in front of everyone, and then she forgives him in front of everyone. It is the worst thing anyone has ever done to him. He leaves the jianghu and becomes a farmer." },
        { heart: "sword", label: "Send him back to the Alliance with a letter in your hand", line: "She sends him back to the Orthodox Alliance with a letter in her own hand, telling them exactly what their guest elder did and that she knows who sent him." },
        { heart: "balance", label: "Let Elder Guan judge him by the Nine Rules", line: "Elder Guan judges him by the Nine Rules, every one of which he broke. The sentence is a year of labour, building a wall between nothing and nothing. He finishes it." },
        { heart: "slaughter", label: "Break both his faces", line: "She breaks both masks, and then the faces under them. The sect watches. It does not split again." },
      ],
      victory: "When it is over, {disciples} disciples are standing in the yard together, rooted and rootless all mixed up, and none of them could say which half they had been in.",
    },
  },

  // ------------------------------------------------------------------------------------------------ IV · The Celestial Court
  {
    title: "The Celestial Court",
    hanzi: "天庭",
    level: 13,
    beats: [
      {
        step: 0,
        npc: "fd-earthgod",
        title: "A Name Not in the Register",
        objective: "Grandfather Earth has been up to heaven for the first time in three hundred years, to report on the basin. He has come back very worried. Go to his shrine.",
        lines: [
          ["fd-earthgod", "Every sect under heaven is written in the Register of Sects, in the Jade Emperor's own library. Its name, its founder, its gate. When a sect lights incense, heaven looks it up, and listens."],
          ["fd-earthgod", "{Sect} is not in it, {peer}. I looked. I looked three times. There is a space where it should be, and the space has been scraped."],
          ["hero", "Scraped?"],
          ["fd-earthgod", "Somebody wrote you in, and somebody scraped you out. Without the Register, your founding rite is shouting into an empty room."],
        ],
        done: "Grandfather Earth goes back up to heaven to complain, which he says he is very good at. He leaves a note on his shrine: “Back soon. Do not let the goat eat this.”",
      },
      {
        step: 10,
        npc: "fd-god-hearth",
        title: "The Lord of the Hearth",
        objective: "Cook Big Pan says there is a stranger in the refectory, sitting by the stove and tasting everything. He has been there since dawn and he glows a little. Go and see.",
        lines: [
          ["fd-god-hearth", "Ah. The sect master. Sit. Taste this. No, the other one. Better? Better."],
          ["fd-god-hearth", "I am the Lord of the Hearth. I sit by every stove under heaven, and at the year's end I go up and tell the Jade Emperor what every house has been doing. Your Earth God asked me to report on your kitchen early. It is a very good kitchen."],
          ["fd-god-hearth", "But I must tell the truth up there, {peer}. Every word. So be good to your cook."],
        ],
        done: "The Lord of the Hearth stays by the refectory stove. Cook Big Pan feeds him malt candy, so that his report will be sweet, and he pretends not to notice why.",
      },
      {
        step: 20,
        npc: "fd-steward",
        title: "An Elder for the Outer Court",
        objective: "The market town outside the gate has grown so busy that Bai Qiu cannot keep both its books and the sect's. He has found someone to keep the outer court.",
        lines: [
          ["fd-elder-5", "Ren. I ran the biggest teahouse in Jinhe for twenty years, and the second biggest in Hailing for ten. I can keep a market. I can keep a hundred."],
          ["fd-elder-5", "Your market is lovely, {peer}, and every stallholder in it is cheating every other one, very slightly. Let me fix it. Gently."],
        ],
        done: "Ren becomes the Elder of the Outer Court. Within a month the market town has a guild, a night watch and a festival, and nobody is cheating anyone by more than a little.",
      },
      {
        step: 30,
        npc: "fd-god-letters",
        title: "The Star of Letters Reads the Copies",
        objective: "Elder Zeng says a scholar in a robe of stars is in the Scripture Pavilion, reading every manual and correcting the brushwork. Go and see.",
        lines: [
          ["fd-god-letters", "Your copies are very good. Very good. Who made them? An old man called Zeng? Tell him the Star of Letters says his fourth character is the best on earth."],
          ["fd-god-letters", "I keep heaven's library, {peer}. I came to see whether a sect with no name in my Register keeps its own books honestly. It does. That is more than I can say for my own clerks."],
        ],
        done: "The Star of Letters promises to look at the scraped page of the Register himself. Elder Zeng, told what was said about his fourth character, has to sit down.",
      },
      {
        step: 50,
        npc: "fd-god-wealth",
        title: "The Third Key",
        objective: "Bai Qiu says the new Treasury has three locks and he has only two keys. A fat, laughing man in red has just walked in and sat on the chest. Go and see.",
        lines: [
          ["fd-god-wealth", "The third key is mine! It always is. Every honest treasury under heaven has a lock only the Lord of Wealth can open, and I open it when the treasury deserves it."],
          ["fd-god-wealth", "Your steward is the most honest bookkeeper I have met in four hundred years. It's unbearable. Here."],
        ],
        done: "The Lord of Wealth leaves the third key in Bai Qiu's hand. Bai Qiu, for once, cannot think of anything to say.",
      },
      {
        step: 70,
        npc: "fd-god-thunder",
        title: "Thunder at the Gate",
        objective: "There is a storm over the basin with no clouds in it. The bell has rung itself three times. Someone very large is standing on top of the Bell Tower. Go to him.",
        lines: [
          ["fd-god-thunder", "I test new sects. That is my office. I strike the gate of every sect that asks heaven to listen to it, and if the gate falls, heaven does not listen."],
          ["fd-god-thunder", "Your gate is sand and stone and a little old god's stubbornness, {peer}. Let us see if it stands."],
        ],
        after: [
          ["narr", "The bolt comes down on the Mountain Gate with a sound like the sky splitting. When the light clears, the gate is still standing, black on one side, and Grandfather Earth is underneath it holding it up, swearing."],
          ["fd-god-thunder", "Ha! It stands! It stands with an Earth God under it. That counts. I'll allow it."],
        ],
        done: "The Lord of Thunder gives the sect's gate heaven's mark. It is still black on one side, and the disciples decide they like it that way.",
      },
      {
        step: 90,
        npc: "fd-god-moon",
        title: "A Face in the Well",
        objective: "On the night of the full moon, the disciples drawing water from the Sweet Well see a face in it that is not theirs. Go to the well.",
        lines: [
          ["fd-god-moon", "I look down at every spring and well under heaven, to see my face. It is lonely on the moon. Your well is the clearest I have seen in a hundred years."],
          ["fd-god-moon", "There was a lake here once, with a lotus in it. I used to look at myself in it every night. I have missed it, {peer}."],
        ],
        done: "The Lady of the Moon promises that when the basin's spring runs again, she will come down to see it. She leaves a silver hairpin on the well's edge, and Elder Ren locks it in the Treasury with the third key.",
      },
      {
        step: 140,
        npc: "fd-god-jade",
        title: "The Descent of the Jade Emperor",
        objective: "The Altar of Heaven is finished. At dawn a road of cloud has come down onto it, and two figures are standing at the top. The Earth God, very pale, says to go now.",
        lines: [
          ["narr", "The Jade Emperor is taller than the Bell Tower and also exactly her height, depending on how she looks. The Queen Mother of the West stands at his side, fanning herself, watching everything."],
          ["fd-god-jade", "The sect master of the Withered Basin. Our Hearth Lord reports a good kitchen. Our Star of Letters reports honest books. Our Lord of Wealth reports an unbearable steward. Our Lord of Thunder reports a gate held up by a very rude Earth God."],
          ["fd-god-jade", "And our Register reports nothing at all. Your page has been scraped nine times, {peer}. By a clerk of our own. Tell us why we should write you in a tenth time."],
        ],
        choice: {
          prompt: "What do you say to the Emperor of Heaven?",
          options: [
            { heart: "mercy", label: "“Because of who came in at the gate.”", then: "She tells him about the three children with no roots, and the hundred and four in the line, and every one since.", reply: ["fd-god-queen", "She did not tell us about herself at all. Write her in, husband."], effect: quiet(2) },
            { heart: "sword", label: "“Because the sect is real, whatever the page says.”", then: "She tells him that the sect stands whether heaven writes it down or not, and that a register that disagrees with the ground is the register that is wrong.", reply: ["fd-god-jade", "…Bold. Correct, and bold. We will remember both."] },
            { heart: "balance", label: "“Because the Register should be true.”", then: "She tells him that she does not ask to be written in as a favour, only that heaven's Register should say what is true.", reply: ["fd-god-jade", "A sect master who asks for accuracy. Our Star of Letters will want to adopt you."] },
            { heart: "slaughter", label: "“Because I will find whoever scraped it.”", then: "She tells him that she will find the clerk who scraped her page, and that heaven had better write her in before she does.", reply: ["fd-god-queen", "…Ah. Write her in quickly, husband. I don't think she is joking."], effect: feed(2) },
          ],
        },
        done: "The Jade Emperor writes {sect} into the Register of Sects with his own brush. It is the tenth time. He says that if it is scraped again, he will know whose hand did it.",
      },
      {
        step: 160,
        npc: "fd-god-queen",
        title: "The Queen Mother's Peach",
        objective: "The Queen Mother of the West has stayed behind on the Altar of Heaven after her husband went up. She has asked for you, and she is holding a peach.",
        lines: [
          ["fd-god-queen", "My orchard grows a peach every three thousand years. Whoever eats one lives as long as a mountain. I bring one down to earth, once in a very long while, for someone who has made something worth keeping."],
          ["fd-god-queen", "This one is for you, {peer}. Or for whoever you give it to. That is the test, of course. It is always the test."],
        ],
        choice: {
          prompt: "What will you do with the peach of long life?",
          options: [
            { heart: "mercy", label: "Give it to Grandfather Earth", then: "She gives the peach to Grandfather Earth, who has held up her gate and her ground for three hundred years with no one to light his incense.", reply: ["fd-earthgod", "For… me? I'm a small god. Small gods don't get peaches. …Oh. Oh, it's sweet."], effect: quiet(2) },
            { heart: "balance", label: "Plant its stone in the basin", then: "She eats the flesh, small and slow, and plants the stone in the basin by the well, for whoever comes after her in three thousand years.", reply: ["fd-god-queen", "Clever. Patient. A sect master thinks in thousands of years. Good."] },
            { heart: "sword", label: "Give it back: you will earn your own years", then: "She hands the peach back. Whatever years she gets, she will earn the hard way.", reply: ["fd-god-queen", "Ha! Nobody has ever given one back. I shall have to eat it myself. It's been ages."] },
          ],
        },
        done: "The Queen Mother goes back up the road of cloud, laughing, and leaves the Altar of Heaven smelling of peaches for a month.",
      },
      {
        step: 180,
        npc: "fd-god-jade",
        title: "The False Star",
        objective: "The Jade Emperor has come down again, and this time he is angry. The clerk who scraped the Register has been found, and has fled down to earth. Go to the Altar of Heaven.",
        lines: [
          ["fd-god-jade", "A minor star. A clerk of the Register for eight hundred years, who fell from his place in the sky and fell in with the Orthodox Alliance. They have paid him in incense for every new sect he scraped out. Yours was the forty-first."],
          ["fd-god-jade", "He has stolen the Register's brush, {peer}. With it he can unwrite you from heaven, earth and memory. He is coming here, to finish it."],
        ],
        after: [["hero", "Then he'll find us at home."]],
        done: "The Jade Emperor leaves his own guard on the Altar of Heaven. The sky over the basin goes the colour of old ink, and a single red star begins to fall.",
      },
    ],
    rites: [
      { title: "Malt Candy for the Hearth", ask: "set malt candy before the Lord of the Hearth at the refectory stove, the way the old houses do at the year's end", done: "He eats it all, very slowly, licking his fingers. “My report,” he says, “will be very sweet.”" },
      { title: "The Bell Hung", ask: "hang the great bell in the Bell Tower and strike it for the first time at dawn", done: "The note goes out over the sands for a day's ride in every direction. Three caravans turn towards it." },
      { title: "The Ancestor's Statue", ask: "set the statue of the Azure Cloud's founder in the Ancestral Shrine, facing the basin she planted", done: "Grandfather Earth stands in front of it for a long time, then says, “Her nose was smaller,” and leaves." },
      { title: "The Altar Swept", ask: "sweep the Altar of Heaven at dawn, the morning before the gods come down", done: "Not a grain of sand on it. Elder Guan inspects it twice and finds nothing to warn anyone about, which upsets him." },
      { title: "The Incense Heard", ask: "light incense at the Altar of Heaven and wait to hear whether heaven answers", done: "For a long moment, nothing. Then the smoke bends, very slightly, as if someone a long way up had breathed in." },
      { title: "The Treasury Counted", ask: "count the Treasury with Bai Qiu and the Lord of Wealth, coin by coin", done: "It comes out exact. The Lord of Wealth says it is the first exact treasury he has counted since the Han. Bai Qiu goes very pink." },
    ],
    lectures: [
      { topic: "what the gods are, and what they are not", line: "“So they're like elders. Very old, very tired elders. Who can throw lightning.”" },
      { topic: "why the Lord of the Hearth tells the truth", line: "“Because the kitchen is where everybody is honest. Nobody lies with their mouth full.”" },
      { topic: "how heaven's Register works, and why a name matters", line: "“If heaven doesn't know your name, it can't hear you. So we have to be loud. No, we have to be written down.”" },
      { topic: "how to bow to an emperor, and how to bow to a god", line: "“Lower for the god. Unless the emperor's watching. Then the same. Is that cheating?”" },
      { topic: "why the moon looks into wells", line: "“Because it's lonely. Everyone who looks into a well is a bit lonely. I do it all the time.”" },
      { topic: "what the strong owe heaven", line: "“Nothing, heaven says. But they owe the earth everything. Grandfather Earth said so. He was very firm.”" },
      { topic: "how to stand under lightning without running", line: "“Plant your feet. Breathe. Don't run. Don't run. Don't… I ran. Sorry.”" },
    ],
    dilemmas: [
      {
        title: "Incense for Which God?",
        case: "Now that gods walk the basin, the disciples argue whose shrine should get the first incense every morning.",
        options: [
          { heart: "balance", label: "Each god in turn, a day each", line: "Each god gets a day. Grandfather Earth gets two, because he was here first, and nobody argues with that." },
          { heart: "mercy", label: "Grandfather Earth first, always", line: "Grandfather Earth gets the first incense every morning, for three hundred years of no incense at all. The other gods agree with surprising grace." },
        ],
      },
      {
        title: "The Disciple Who Prayed for Lightning",
        case: "A disciple prayed to the Lord of Thunder to strike the boy who bullied him. The god very nearly did.",
        options: [
          { heart: "sword", label: "The bully apologises; the prayer is forbidden", line: "The bully apologises to the boy, and the boy apologises to the Lord of Thunder. Praying for lightning on a fellow disciple becomes rule ten." },
          { heart: "mercy", label: "Sit them down together and find out why", line: "She sits them down together. The bully has a reason, and it is a sad one. They come out of the room not friends, but not enemies either." },
        ],
      },
      {
        title: "The Peach-Stone Thief",
        case: "Someone has tried to dig up whatever the gods left in the basin, hoping for heaven's fruit. It was a merchant from the market town.",
        options: [
          { heart: "balance", label: "He fills in the hole and pays for the trouble", line: "He fills in the hole, pays a fine to Elder Ren, and leaves very quickly. The Queen Mother, told of it, laughs for an hour." },
          { heart: "slaughter", label: "Bar him from the market for good", line: "He is barred from the market for good. The other merchants take the point." },
        ],
      },
    ],
    steward: [
      "There's a god in the kitchen, a god in the library, and a god on the treasury chest. I'd like it written down that I stayed calm.",
      "The Lord of Wealth has asked to see last year's accounts. For pleasure, he says. For pleasure!",
      "The market town has three thousand people now. Three thousand. I remember when it had a goat.",
      "Elder Ren has organised a festival for the gods. The gods have asked if they can come to the festival. I've put it in the ledger.",
    ],
    boss: {
      intro: "the False Star falls into the basin with heaven's stolen brush in his hand, and every name he points it at begins to fade",
      words: [
        ["fd-boss", "Eight hundred years I wrote names in the Register, and not one of them ever thanked me. The Alliance thanked me. In incense. Do you know how hungry a star gets?"],
        ["hero", "Forty-one sects. You unwrote forty-one."],
        ["fd-boss", "Forty-one little sects nobody needed. There are enough sects under heaven, sect master. Gu Wuchen says so, and he is very old, and very sure."],
      ],
      fates: [
        { heart: "mercy", label: "Ask the Jade Emperor to let him write again", line: "She asks the Jade Emperor to give the False Star back his place, on one condition: that he writes the forty-one sects back in first, every name, with his own hand. He does. It takes him a year, and someone thanks him for every one." },
        { heart: "sword", label: "Give the brush back to heaven, and him with it", line: "She takes the brush from his hand and gives it, and him, back to the Jade Emperor's guard. Heaven judges its own." },
        { heart: "balance", label: "Make him the clerk of your sect's own register", line: "She asks for him as the clerk of her own sect's register on earth, where every name is thanked. He is astonished. He accepts." },
        { heart: "slaughter", label: "Unwrite him with his own brush", line: "She takes the brush and writes his name, and then scrapes it out. The False Star goes out like a lamp. Nobody, afterwards, can remember what he was called." },
      ],
      victory: "The ink-coloured sky clears all at once. On the Altar of Heaven the Register lies open, and on its page, written ten times and scraped nine, the name of her sect, clear and black and dry.",
    },
  },

  // ------------------------------------------------------------------------------------------------ V · The Founding Ceremony
  {
    title: "The Founding Ceremony",
    hanzi: "开宗大典",
    level: 16,
    beats: [
      {
        step: 0,
        npc: "fd-steward",
        title: "Invitations",
        objective: "Heaven has written {sect} in its Register. Now the jianghu must see it founded. Bai Qiu has drafted the invitations to the founding ceremony. Go to him.",
        lines: [
          ["fd-steward", "Six thrones. Six sworn sects. The Ten Halls, the Azure Cloud, the peoples of the hills and the sea. Every caravan-master who ever drank at our well. And the Orthodox Alliance, because if we don't invite them they'll come anyway, and angrier."],
          ["fd-steward", "Three hundred and twelve invitations, {title}. Every one needs your seal. I've ground a great deal of ink."],
        ],
        done: "She seals three hundred and twelve invitations, one by one, by lamplight. By the end the seal has worn a groove in her palm. Bai Qiu says that is how you know a sect master.",
      },
      {
        step: 20,
        npc: "fd-elder-5",
        title: "The Delegations Arrive",
        objective: "The first delegations are coming in across the sands. Elder Ren has the Guest House ready and needs you at the gate to greet them.",
        lines: [
          ["fd-elder-5", "Camels from Great Yan. Junks up the dry river from Southern Chen, on wheels, which I didn't know junks could do. Six cauldron-masters from Shu who want to see Elder Kang's walls."],
          ["fd-elder-5", "And the Alliance. They've pitched white tents on the dunes outside the gate, {peer}. Very many white tents."],
        ],
        done: "She greets every delegation herself. The Alliance does not come to the gate. Its tents stay on the dunes, and at night its banners snap in a wind that is not blowing anywhere else.",
      },
      {
        step: 40,
        npc: "fd-earthgod",
        title: "Grandfather Earth Grows Taller",
        objective: "Grandfather Earth has been getting taller. He was knee-high when you met him. He is now up to your shoulder, and very embarrassed about it. Go and see.",
        lines: [
          ["fd-earthgod", "It's the incense. An Earth God grows with the worship of his ground. Three thousand people in the market. {disciples} in the sect. Gods in the kitchen. I can't help it."],
          ["fd-earthgod", "I'll have to have a new shrine made, {peer}. And a new staff. And I'll have to get used to seeing over walls. It is all very undignified. I am enjoying it enormously."],
        ],
        done: "The disciples carve Grandfather Earth a new shrine, twice the size of the old one. He sits on it swinging his feet, which now reach the ground.",
      },
      {
        step: 70,
        npc: "fd-steward",
        title: "The Alliance's Ultimatum",
        objective: "A rider in white has brought a letter from Patriarch Gu Wuchen of the Orthodox Alliance himself. Bai Qiu has read it twice and not stopped frowning.",
        lines: [
          ["fd-steward", "“There are enough sects under heaven. Each new one takes a little qi from the old. The Alliance has kept the number of the great sects since before the Covenant. Dissolve your sect, or the Alliance will dissolve it.”"],
          ["fd-elder-2", "Gu Wuchen. I know the name. Fifty years ago he wrote the rule the great sects keep: that they take only the rooted. He turned away a nine-year-old boy once, a boy who grew up very bitter. Half the jianghu's troubles walk back to that rule."],
        ],
        choice: {
          prompt: "What answer do you send Gu Wuchen?",
          options: [
            { heart: "balance", label: "Invite him to the ceremony as an honoured guest", then: "She invites him to the ceremony as an honoured guest, with a seat at the front.", reply: ["fd-steward", "He'll take it as an insult. Which, between us, it is. A very polite one."] },
            { heart: "sword", label: "“The gate is open. Come through it if you can.”", then: "She sends back one line: the gate is open; let him come through it if he can.", reply: ["fd-elder-0", "Good. I'll sharpen something."] },
            { heart: "mercy", label: "Ask to meet him alone, before the ceremony", then: "She asks to meet him alone, before the ceremony, without swords.", reply: ["fd-steward", "He won't come alone. But he'll know you asked. So will everyone in those tents."], effect: quiet(1) },
            { heart: "slaughter", label: "Send the letter back burned", then: "She burns the letter and sends back the ash.", reply: ["fd-steward", "…I'll file a copy. I always make a copy."], effect: feed(2) },
          ],
        },
        done: "The answer goes out to the white tents. That night the zealots of the Alliance begin to come down off the dunes, one at a time, to test the gate.",
      },
      {
        step: 120,
        npc: "fd-elder-0",
        title: "The Disciples Ask to Fight",
        objective: "The disciples want to stand at the gate against the Alliance's zealots with you. Elder Jiang says it is your decision, and that she will not make it for you.",
        lines: [
          ["fd-elder-0", "They're ready, {peer}. Most of them. Some of them aren't, and want to anyway. That's the hard part of leading. Not the fighting. Deciding who doesn't."],
        ],
        choice: {
          prompt: "Who stands at the gate?",
          options: [
            { heart: "sword", label: "Only those Elder Jiang says are ready", then: "Only those Elder Jiang says are ready stand at the gate. The others hold the walls.", reply: ["fd-elder-0", "Good. Good. Thank you for not making me choose."] },
            { heart: "mercy", label: "No one: you stand at the gate alone", then: "She stands at the gate alone. The sect watches from the walls, and some of them are crying, and all of them are proud.", reply: ["fd-elder-0", "Foolish. Exactly what I'd have done. Don't die."] },
            { heart: "balance", label: "Everyone, rooted and rootless, in turns", then: "Everyone stands a watch at the gate in turn, rooted and rootless together, with an elder beside each.", reply: ["fd-elder-0", "Everyone. Hm. Yes. That's what a sect is, isn't it."] },
          ],
        },
        done: "The gate is held. The zealots come down the dunes and go back up them, again and again, and the white tents grow fewer.",
      },
      {
        step: 150,
        npc: "fd-earthgod",
        title: "The Spring Stirs",
        objective: "Grandfather Earth has felt something move under the basin, a long way down. Not the well. The spring. Go to his shrine.",
        lines: [
          ["fd-earthgod", "It's coming back, {peer}. The spring. The one that followed the lotus up into the clouds. It knows there's a sect here again. It can feel the feet."],
          ["fd-earthgod", "It won't come all the way by itself. Springs are like old gods: they need asking. Will you ask it?"],
        ],
        done: "She kneels by the shrine and asks. The ground under her hands is warm, and then wet, and somewhere deep under the basin, water begins to rise.",
      },
      {
        step: 170,
        npc: "fd-god-jade",
        title: "Heaven's Witness",
        objective: "The Jade Emperor has come down to the Altar of Heaven to witness the founding himself. He would like a word with the sect master before it begins.",
        lines: [
          ["fd-god-jade", "We have witnessed the founding of many sects, {peer}. Most of them were founded by the strong, for the strong. Yours was founded by a disciple, for three children and a goat."],
          ["fd-god-jade", "Gu Wuchen will come tomorrow. He is old and very strong and very sure. Heaven will not fight him for you. That is not what heaven is for. But we will watch."],
        ],
        done: "The Jade Emperor takes his seat on the Altar of Heaven, with the Queen Mother at his side and every god of the basin round them. The market town does not sleep at all that night.",
      },
      {
        step: 190,
        npc: "fd-steward",
        title: "The Morning of the Ceremony",
        objective: "It is the morning of the founding. Bai Qiu has been up since the hour of the ox, and is waiting for you in the Hall of the Founding with the ledger.",
        lines: [
          ["fd-steward", "{disciples} disciples. Six elders. Twenty halls. Seven gods, two of them very large. Six thrones' envoys and six sects'. One goat. Everything is written down, {title}."],
          ["fd-steward", "And Gu Wuchen is at the gate. Alone. He came alone after all. I suppose you knew he would."],
        ],
        after: [["hero", "Thank you, Bai Qiu. For all of it."], ["fd-steward", "Don't thank me. Go and found your sect. I'll write down what happens."]],
        done: "She walks out of the Hall of the Founding into the sun. Every disciple she has is standing in the yard. Every one of them bows. Then she walks on, to the gate.",
      },
    ],
    rites: [
      { title: "The Banners Raised", ask: "raise the sect's banners over the gate, the hall and the Bell Tower on the eve of the ceremony", done: "The banners go up, all at once, and the wind that has blown from the Alliance's tents all month drops. The banners hang still for a moment, then lift." },
      { title: "The Guests' Tea", ask: "pour the first cup of tea for every delegation in the Guest House yourself", done: "Forty-one cups. Southern Chen's envoy says it is the best tea she has had outside Jinling. Great Yan's envoy asks for it with butter." },
      { title: "The Rehearsal", ask: "walk the founding rite through with the elders, step by step, at midnight", done: "Elder Guan trips on the altar step. Elder Jiang catches him. Nobody mentions it ever again, which is how you know they are a council." },
      { title: "The Disciples' Gift", ask: "receive the gift the disciples have been making in secret", done: "It is a banner with every disciple's name stitched on it, {disciples} names, and the goat's in the corner. She hangs it in the Hall of the Founding behind her chair." },
      { title: "The Last Incense", ask: "light the last incense at Grandfather Earth's shrine before the ceremony, as you lit the first", done: "Grandfather Earth is taller than her now. He takes the incense from her hand and lights it himself, and says, “Thank you for asking.”" },
      { title: "The Envoys Seated", ask: "seat the envoys of the six thrones and six sects round the Altar of Heaven by rank, without offending anyone", done: "It cannot be done. She does it anyway, by seating them in a circle. Nobody can find the head of a circle." },
    ],
    lectures: [
      { topic: "what a founding ceremony is for", line: "“It's not for us. We already know we're a sect. It's for everyone else to know.”" },
      { topic: "how to stand at the gate against someone stronger", line: "“You don't have to win. You have to still be standing there when they stop.”" },
      { topic: "why the sect will outlive its founder", line: "“Because we'll remember. And then our disciples will. And theirs. That's what the ledger's for.”" },
      { topic: "how to greet a delegation from a throne", line: "“Bow, smile, don't mention the war. Any of the wars.”" },
      { topic: "what to do when the strong say there are enough of you", line: "“Count again. They always miss some.”" },
      { topic: "the ninth form of the Lotus Step, which she has never taught before", line: "“It isn't a step at all. It's standing still while everything else moves. Oh. Oh.”" },
    ],
    dilemmas: [
      {
        title: "The Zealot's Son",
        case: "One of the Alliance's zealots, taken at the gate, turns out to have a son among your disciples. The boy did not know.",
        options: [
          { heart: "mercy", label: "Let them talk, alone", line: "She lets them talk, alone, for as long as they need. The zealot leaves the Alliance's tents the next morning and goes home." },
          { heart: "balance", label: "Let the boy decide what happens to his father", line: "The boy decides. His father is sent home with a letter in his son's hand. Nobody reads it but them." },
        ],
      },
      {
        title: "The Envoy Who Wants a Seat",
        case: "A small sect nobody has heard of has come to the ceremony and asks for a seat among the great sects' envoys. The great sects object.",
        options: [
          { heart: "mercy", label: "Give them the seat", line: "They get the seat. The great sects sulk. The small sect's envoy sits through the whole ceremony with her back very straight." },
          { heart: "sword", label: "Seat them, and tell the great sects why", line: "She seats them, and tells the great sects that a year ago {sect} had no seat at all. The great sects stop objecting." },
        ],
      },
      {
        title: "Silver From the Alliance",
        case: "On the eve of the ceremony a chest of silver arrives from the white tents, with a note: “For the sect's expenses, should it decide to be dissolved.”",
        options: [
          { heart: "balance", label: "Send it back with a receipt", line: "She sends it back with a receipt, in Bai Qiu's best hand, for nothing." },
          { heart: "slaughter", label: "Keep it; feed the market town with it", line: "She keeps it and buys the whole market town dinner with it. The Alliance's tents hear the singing all night." },
        ],
      },
    ],
    steward: [
      "Three hundred and twelve invitations out. Two hundred and ninety answered. The rest are the Alliance, answering with tents.",
      "Every bed in the Guest House is full, and every floor. Southern Chen's envoy is sleeping in the Treasury. The Lord of Wealth is delighted.",
      "I have counted the Alliance's tents every morning. Sixty, then forty, then twenty-one. Today, nine.",
      "Whatever happens tomorrow, {title}, the ledger's balanced. I wanted you to know that.",
    ],
    boss: {
      intro: "Gu Wuchen, Patriarch of the Orthodox Alliance, stands alone in the Mountain Gate with his sword drawn and the wind of ten thousand old sects behind him",
      words: [
        ["fd-boss", "Eight hundred years the great sects have kept the number under heaven. Every new sect is a little qi taken from the old. Every rootless child taught is a little order lost. I have kept the gate shut for fifty years, girl. I will keep it shut today."],
        ["hero", "You kept it shut on a nine-year-old boy, once."],
        ["fd-boss", "…I have kept it shut on ten thousand children. I do not remember them. That is the point of a rule. You do not have to remember."],
      ],
      fates: [
        { heart: "mercy", label: "Invite him in through the gate", line: "She steps aside and invites him in through the gate. He stands there for a long time. Then he sheathes his sword and walks in, and sits at the back of the ceremony, and watches {disciples} disciples, rooted and rootless, bow together. When it is over, he is gone. The Orthodox Alliance never meets again." },
        { heart: "sword", label: "Break his sword, and his rule with it", line: "She breaks his sword at the gate, in front of every envoy under heaven. Then she has his rule read aloud, and breaks that too: from this day, the great sects may take whom they will. Six of the twelve sworn sects stand up and agree." },
        { heart: "balance", label: "Make him sit on the council of every sect's selection for a year", line: "She makes him the guest of every sect's selection for a year, to watch who is turned away and why. At the end of the year he writes a new rule himself, in a shaking hand: that no sect may turn away a child without the sect master's own word." },
        { heart: "slaughter", label: "Throw him out of the gate", line: "She throws him out of the gate and down the dune, in front of every envoy under heaven. The Alliance's last tents are struck by noon. The great sects bow to her very low, and do not meet her eyes." },
      ],
      victory: "The gate stands open. The sun is up over the basin, and on the Altar of Heaven the Jade Emperor rises, and lifts his hand, and the founding begins.",
    },
  },
];

// ----------------------------------------------------------------------------- those who come to the gate
/** Who comes to the gate to be taken in: a look, a name, and why they came. */
export const APPLICANTS: { char: HumanId; name: string; story: string }[] = [
  { char: "boy", name: "Little Pebble", story: "My father sold me to a mine. I walked out of the mine. I think that means I belong to me now." },
  { char: "child", name: "Swallow", story: "The Golden Crane said my roots were 'decorative'. What does decorative mean? Is it bad?" },
  { char: "villagerF", name: "Widow Liu", story: "I'm forty-one. Too old, they all said. I've buried a husband and two sons. I'm not too old for anything." },
  { char: "farmer", name: "Old Ox", story: "I can't fly and I can't fight. I can plant rice in sand. I heard you had sand." },
  { char: "outerM", name: "Runaway Hu", story: "I was an outer disciple of the Ten Halls. Four years of sweeping. I want to sweep somewhere that'll let me learn." },
  { char: "outerF", name: "Lan Xiaoyu", story: "My sect went to war and didn't come back. I'm the only one. I'd like to belong to something again." },
  { char: "boy", name: "Gou Dan", story: "I stole a bun in Jinhe and a cultivator chased me all the way here. Then I saw the gate. Can I stay if I give the bun back?" },
  { char: "child", name: "Moon-Moon", story: "My mother's a pearl diver. She says the sea's no place for a girl who can't hold her breath. I can't hold my breath. Can I learn to fly?" },
  { char: "villagerM", name: "Carter Shi", story: "I drove the caravan that brought your first timber. I liked what you were building. I'd like to help build it." },
  { char: "novice", name: "Brother Quiet", story: "My monastery said I asked too many questions. You look like someone who doesn't mind questions." },
  { char: "farmer", name: "Sister Millet", story: "The soil's thin where I come from. I heard your fields grow in sand. I want to know how. Then I want to go home and do it." },
  { char: "outerM", name: "Duan the Unlucky", story: "I failed the Grand Selection seven times. The seventh time they gave me a certificate for trying. I'd rather have a sect." },
  { char: "child", name: "Plum", story: "Grandmother told me there was a sect in the desert that took girls like me. I walked for a month. Is it you? Please let it be you." },
  { char: "villagerF", name: "Cook Hong", story: "I can feed three hundred people from one pot. Your steward says you have three hundred people and too few pots." },
  { char: "boy", name: "Ah Fu", story: "A fox-spirit told me to come here. I'm not making it up. She had a lantern." },
  { char: "outerF", name: "Swordless Qiu", story: "My master broke my sword when I beat his son. I want to learn from someone who won't." },
  { char: "farmer", name: "Herder Bayan", story: "My camels like your well. I like your camels. I think I'd like it here." },
  { char: "novice", name: "Little Brush", story: "I can write a thousand characters. Nobody needed them. Your elder of scriptures needs them, I heard." },
  { char: "villagerM", name: "Smith's Son Tie", story: "My father makes swords for sects. I want to make swords for a sect that knows why it needs them." },
  { char: "child", name: "Goat-Girl's Cousin", story: "My cousin came here first, with the goat. She says it's the best place in the world. She says I have to share the goat." },
  { char: "villagerF", name: "Weaver Jin", story: "Everyone in your sect wears a different colour. I can fix that. Or I can make it look on purpose." },
  { char: "outerM", name: "Deserter Ma", story: "I ran from the war. I'm not proud of it. I'd like to learn to stand, this time." },
  { char: "boy", name: "Stone-Eater", story: "They call me that because I'm always hungry. I hear you have a refectory. And a god in the refectory." },
  { char: "outerF", name: "Healer's Girl Su", story: "I set bones in the camps after the war. I want to learn the rest of it." },
];

/** What each of her people say when the work is going well. */
export const KEEPER_LINES: Record<string, string[]> = {
  well: ["Three hundred buckets by noon, {title}. The well's in a good mood.", "The water's sweeter this month. Grandfather Earth says it's because you're happy. I didn't know wells could tell."],
  quarters: ["Every bunk aired, every blanket counted. Two missing. The goat, again.", "The little ones want a lantern left on at night. I've said yes. Don't tell Elder Guan."],
  refectory: ["Congee at dawn, noodles at noon, dumplings at dusk. And malt candy for the stove, now. For the god.", "Three hundred mouths and not a grain wasted. I'm not boasting. I'm reporting."],
  fields: ["The spirit rice is knee-high, in sand. Sand, {title}! My grandfather would die again of shock.", "The goat's eaten the scarecrow. I'm building another. The goat is watching me build it."],
  forge: ["Forty practice swords this month, two real ones, and a bell-clapper for the tower.", "The disciples' blades are getting better. So are their hands. I can tell by the blisters."],
  talismans: ["Ward-papers for six caravans this week. None of them got robbed. The caravans are telling everyone.", "Fire, wind, paper. Never together. I keep a bucket by the door anyway."],
  healing: ["Two broken arms, a fever, and a boy who swallowed a coin. Everyone's mending.", "The caravan folk come to us now, not just the sect. I've had to put in more beds."],
  beasts: ["Nine camels, two horses, a spirit ox somebody left at the gate, and the goat. The goat runs the pens.", "The spirit camels smelt a storm coming three days early. I moved the caravans in. You're welcome."],
  guests: ["Every bed full, and the floors. Southern Chen's envoy wants a softer pillow. Great Yan's wants a harder one.", "I've had sect masters, generals and a god asleep in my rooms this month. Nobody snored but the god."],
};

/** What she is asked to make sure of when she goes round the sect's work. */
export const OVERSEE_ASKS: Record<string, string> = {
  well: "go round the Sweet Well with its water-carrier and make sure the water is reaching every hall",
  quarters: "go round the Disciples' Quarters with Aunt Fang and see that every bunk has a disciple and every disciple a bunk",
  refectory: "go round the Refectory with Cook Big Pan at the dinner hour and taste the pot",
  fields: "walk the Spirit Fields with Tian Er and look at the rice",
  forge: "watch Smith Iron Zhang at the forge and look over the disciples' new blades",
  talismans: "check the caravans' ward-papers with Talisman-Clerk Bi",
  healing: "go round the beds of the House of Healing with Healer Xiao Su",
  beasts: "look over the Spirit Beast Pens with Herder Ah Gu",
  guests: "go through the Guest House with Madam Rong before the delegations arrive",
};

/** What the six emperors and empresses say when the founder of a new sect comes before them. */
export const EMPEROR_AUDIENCE: string[] = [
  "A sect in the sands, west of Our granaries. Liang has always fed its sects. We will feed yours, if it guards the caravan roads. Is that a bargain, sect master? It is the oldest one there is.",
  "A new sect, and not one of the old families'. Good. Chen has had enough of old families. My ships will carry your disciples' letters, sect master. Write often.",
  "We are an old man, sect master, and We have trusted too many cultivators. But you came to Us yourself, and bowed, and asked. That counts for something in Shu.",
  "Northern Wei does not bend to sects. But it respects a sect that does not ask it to. Your sect may cross Our snows, sect master. Tell your disciples to dress warmly.",
  "Nurse-Mother says I'm to say something very important now. …Will your sect teach children who aren't cultivators? Then Eastern Qi will send you some. And me, when I'm older!",
  "The sands belong to no throne, sect master, and the Yan have always liked the sands best. Your sect is a neighbour now. Great Yan keeps its neighbours. Ask anyone.",
];

/** What a City God says when she comes to their temple on her sect's behalf. */
export const CITY_GOD_WORDS: string[] = [
  "I keep the ledger of every soul within these walls. A new sect far off in the sands shows in it, a little: people leaving to join you, and writing home that they are happy. Go on.",
  "Your sect's disciples came through my city last month guarding a caravan. Not one of them took a bribe. I wrote it down twice, to be sure.",
  "The Earth God of your basin and I were posted the same year, nine hundred years ago. Tell him the City God of this place still owes him a game of xiangqi.",
  "A city is a sect that forgot it was one, sect master. Remember that, when yours grows.",
  "The Lord of the Hearth told me about your kitchen. I've been jealous all month. Our cooks are dreadful.",
  "Every incense stick lit in this city for your sect, I pass upwards. There have been more of them lately. A great many more.",
];

/** What the gods say, when she goes to them on the sect's business. */
export const GOD_WORDS: Record<string, string[]> = {
  hearth: ["Your cook puts too much salt in the congee. Don't tell him I said so. I'll put it in the report.", "Every kitchen tells me the truth about its house. Yours tells me you eat last. Keep it up."],
  letters: ["Elder Zeng's copies have gone up to heaven's library. My own clerks are copying his. It is humiliating and I love it.", "A sect that keeps its books honestly lasts. A sect that keeps them beautifully lasts longer."],
  wealth: ["Your treasury is full and your steward is miserable about it. Both are excellent signs.", "Money that sits is a dragon asleep on gold. Money that moves is a river. Be a river, sect master."],
  thunder: ["Your gate's still black on one side. Good. Let them see where heaven tested it.", "I struck a sect's gate down last week. Not yours. Theirs was made of pride. Pride burns fast."],
  moon: ["The well is clear tonight. I can see my whole face. I can see yours, too, behind it. You look tired.", "When the spring runs again, sect master, I'll come down and stay a night. Just one. I promise."],
  jade: ["Heaven watches every sect, sect master. Most of them do not notice. You do. That is either wisdom or bad manners.", "The Register is open on Our desk at your page. We look at it, sometimes, when We are tired of looking at the old ones."],
  queen: ["My peaches ripen once in three thousand years, and I still find myself checking them every morning. Leading is like that.", "Your elders are good. Your steward is better. You are the youngest of them all, and the one they follow. Do you know why?"],
};
