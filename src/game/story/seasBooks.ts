import type { GameState } from "../engine/state";
import { CULT, shift } from "../engine/cultivation";
import type { Beat, Fate } from "./hallsBooks";

/**
 * The words of the Sea of Pearls and the Nine Springs (story/seas.ts
 * composes the quests): six books, four out on the isles and two down in the
 * underworld beneath Ghost Gate Isle. Each is a tale told in hand-written
 * beats, and between the beats the life of its isle or court: its rites (main
 * quests), its folk's favours, goods carried between the isles, tales carried
 * back to the mainland, hunts, sittings at shrines all over the jianghu and
 * walks to its places (side quests).
 *
 * Under all six runs one question: what is owed to the dead, and what the
 * dead owe the living. Somebody has been stealing the soup of forgetting from
 * Meng Po's pavilion, and the dead are coming back up the Yellow Springs road
 * remembering everything: first to the isles, then further.
 *
 * Keys: "sp-patron" and "sp-guide" are this book's patron and guide,
 * "sp-folk-<n>" one of its folk, and "sp-boss" its trouble. Lines may name her
 * standing: {title} (what a mortal calls her), {peer} (what a cultivator calls
 * her) and {realm}.
 */

export interface SeaBook {
  title: string;
  hanzi: string;
  /** The realm the book asks of her as it opens (an overall level index). */
  level: number;
  beats: Beat[];
  /** The rites of the isle or court (main quests between the beats): a title, what she must do, and how it goes. */
  rites: { title: string; ask: string; done: string }[];
  /** The folk's favours (side quests): what is asked, and what is said when it is done. */
  favours: { ask: string; done: string }[];
  /** What the isle sends to the other isles (trade side quests). */
  goods: string[];
  /** What the mainland says when she tells it of this place (tale side quests). */
  tales: string[];
  /** What the patron and the guide say between the beats. */
  patron: string[];
  guide: string[];
  boss: { intro: string; words: [string, string][]; fates: Fate[]; victory: string };
}

const feed = (by: number) => (g: GameState) => shift(g, CULT.demon, by);
const quiet = (by: number) => (g: GameState) => shift(g, CULT.demon, -by);

export const SEA_BOOKS: SeaBook[] = [
  // ------------------------------------------------------------------------------------------------ I · Pearlgate
  {
    title: "The Drowned Bell",
    hanzi: "沉钟",
    level: 2,
    beats: [
      {
        step: 0,
        npc: "sp-patron",
        title: "A Sea Where There Was Cloud",
        objective: "Below Hailing, where the sea of clouds used to begin, there is a real sea now, and a plank bridge out over it. Cross to Pearlgate Isle and find Pearl-Mother Bei among the round houses.",
        lines: [
          ["narr", "The planks run out from Hailing's south quay over green water. Gulls. Salt. A round earthen house as big as a village, with smoke going up out of the middle of it."],
          ["sp-patron", "A cultivator. Off the bridge, not off a cloud. Good: the ones who fly over us never stop."],
          ["sp-patron", "You'll have heard the bell, then. No? Every night at the third watch, out past the reef, a bronze bell rings under the water. There's no bell out there. There's no temple. There's forty fathoms of sea."],
          ["sp-patron", "And every night it rings, somebody on Pearlgate wakes up remembering a life that isn't theirs."],
        ],
        after: [["sp-patron", "Stay a while. Eat with us in the round house; everyone does. Then listen for the bell with me, {title}, and tell me I'm not mad."]],
        done: "Pearl-Mother Bei gives her a bowl of fish congee and a corner of the round house to sleep in. At the third watch, far out under the sea, a bell rings.",
      },
      {
        step: 20,
        npc: "sp-guide",
        title: "Forty Fathoms",
        objective: "Diver Ah Lan says she has seen the bell. Find her on Pearlgate and hear what is down there.",
        lines: [
          ["sp-guide", "I've seen it. Nobody believes me because I was out of breath when I saw it, and they say the deep makes you see things."],
          ["sp-guide", "It's a temple bell, big as a boat, hanging from nothing. And there were people round it. Standing on the sea floor. Not drowned. Waiting."],
          { a: "sp-guide", n: "castnet" },
          ["sp-guide", "One of them looked up at me. It was my grandmother. She's been dead nine years. She waved."],
        ],
        choice: {
          prompt: "Ah Lan wants to dive again tonight. With her.",
          options: [
            { heart: "mercy", label: "Promise to keep her safe", then: "She promises to stay at the boat's side and pull Ah Lan up the moment the rope jerks.", reply: ["sp-guide", "Then I'll jerk it twice if I see her. So you know it's not the deep talking."], effect: quiet(2) },
            { heart: "sword", label: "Say she'll go down herself", then: "She tells Ah Lan that a cultivator can hold her breath a great deal longer than a diver, and she will go.", reply: ["sp-guide", "…Fine. But you tell me everything. Everything."] },
            { heart: "balance", label: "Tell her to wait for the bell's rhythm first", then: "She asks Ah Lan to count the strokes for three nights, so they know what it wants before they go down to it.", reply: ["sp-guide", "Count it? It rings nine times. Always nine. Oh."] },
            { heart: "slaughter", label: "Tell her the dead should stay dead", then: "She says that whatever is down there, it is not Ah Lan's grandmother any more, and should be put back where it came from.", reply: ["sp-guide", "…You don't know that. You don't know that."], effect: feed(3) },
          ],
        },
        done: "The bell rings nine times. Somewhere under the sea, nine times, someone answers.",
      },
      {
        step: 40,
        npc: "sp-folk-0",
        title: "What the Ferryman Carried",
        objective: "Ferryman Lao Gu rows people from the reef to the round house and back. Ah Lan says he has been rowing more people than live here. Ask him.",
        lines: [
          ["sp-folk-0", "I don't count them. A ferryman doesn't count. But there's been more. Pale folk in old clothes, at the end of the night, asking to be taken to Pearlgate."],
          ["sp-folk-0", "They pay. They always pay, with old coins, the square-holed kind my grandfather used. Then they walk into the round house and sit down at a table and wait to be fed."],
          { a: "hero", n: "think" },
          ["sp-folk-0", "Nobody feeds them. They don't seem to mind. In the morning they're gone and somebody in the house is crying over a life they never had."],
        ],
        done: "Lao Gu gives her one of the coins. It is very cold, and there is salt in the square hole, and stamped round its edge is a reign name nobody has used for three hundred years.",
      },
      {
        step: 60,
        npc: "sp-patron",
        title: "The Black Sail",
        objective: "Pearl-Mother Bei has news: the Black Sail, the pirates of the outer sea, are diving for the bell too. Hear what she knows.",
        lines: [
          ["sp-patron", "Hei Fan's crew have been anchoring over the reef at night. Not raiding. Diving. With ropes and lead weights and a bronze hook the size of a man."],
          ["sp-patron", "Pirates don't dive for bells. Pirates dive for what a bell is worth. So somebody's told Hei Fan that bell is worth something."],
          ["sp-patron", "And the night they hooked it, the bell rang twelve times, not nine, and three of my people woke up who never woke up again. Find out who's paying her, {title}."],
        ],
        done: "Out on the dark water past the Lantern Reef, a black sail lies at anchor with no lantern lit. Someone on deck is singing a song for the dead, very badly.",
      },
      {
        step: 80,
        npc: "sp-folk-3",
        title: "The Lamp-Keeper's Ledger",
        objective: "Lamp-Keeper Deng writes down every ship that passes the reef. Ask to see his ledger.",
        lines: [
          ["sp-folk-3", "I write down every sail. Every one. Black ones too. Here. Three nights ago: the Black Sail, and a little grey boat with no name that met it, and went away north."],
          ["sp-folk-3", "North. Toward Ghost Gate Isle. Nobody rows toward Ghost Gate Isle. Nobody living."],
          { a: "sp-folk-3", n: "lantern" },
        ],
        done: "In the ledger, under the grey boat, Deng has drawn what he saw on its prow: a ladle, the kind for serving soup.",
      },
      {
        step: 140,
        npc: "sp-guide",
        title: "Nine Strokes",
        objective: "Ah Lan has counted the bell for a month. Hear what she has worked out.",
        lines: [
          ["sp-guide", "It's not ringing for us. It's a temple bell. It's ringing the hours. Nine strokes is the hour the dead cross a bridge, in the old sutras."],
          ["sp-guide", "Somebody moved a bell from the underworld into our sea. And the dead hear it ringing the crossing hour, and come to cross. Here."],
          ["sp-guide", "And they don't forget on the way, because they never got their soup."],
        ],
        done: "Ah Lan ties a red thread round her wrist, to remember which life is hers, and gives her one too.",
      },
    ],
    rites: [
      { title: "The Round House Supper", ask: "carry the great pots round the ring of the round house, one table to the next, the way a guest is honoured", done: "A hundred people at one long round table, and every one of them pours her a little tea." },
      { title: "Blessing the Nets", ask: "walk the nets out along the bridge and back, so the sea knows whose they are", done: "The nets come back salt-heavy and silver. Pearl-Mother Bei says the sea has answered." },
      { title: "The Pearl Count", ask: "sit with the divers while they count the season's pearls, and say each one aloud", done: "Three hundred and eleven pearls. She says each number. One of them is warm." },
      { title: "Lighting the Reef", ask: "carry oil out to the Lantern Reef before dusk", done: "The light goes up over the reef just as the sun goes down. Out on the water, a black sail turns away." },
    ],
    favours: [
      { ask: "mend the bridge planks the storm loosened", done: "“Good. Now nobody walks into the sea who didn't mean to.”" },
      { ask: "sing the round house's children to sleep, since their mother is down with a fever", done: "“They asked for you tomorrow. Sorry. You're a nursemaid now.”" },
      { ask: "help haul the big net in before the tide turns", done: "“Ha! A cultivator's back is worth three fishermen. Don't tell the fishermen.”" },
      { ask: "find the steward's lost abacus in the round house", done: "“Under the rice sacks? Who puts an abacus under the rice sacks? …Me. I do.”" },
      { ask: "carry dried fish to the old man in the domed hut who will not come out", done: "“He took it. He said thank you. He hasn't said thank you in six years.”" },
      { ask: "scrape the barnacles off the ferryman's boat", done: "“She'll row lighter. She'll row like she's young. Like I'm young.”" },
    ],
    goods: ["a basket of salted fish", "a string of river pearls", "a coil of net-rope", "a jar of fish sauce", "a round house's spare roof tiles"],
    tales: [
      "“A round house? Big as a village? With everyone eating at one table? …Sounds noisy. Sounds wonderful.”",
      "“A bell under the sea. My grandmother said she heard one, the night before she died. I thought it was a story.”",
      "“Pearlgate? I'll ship our rice there. If they've got pearls, they'll want rice.”",
      "“Pirates and ghosts in the same sea. I'll stay on the mainland, thank you.”",
    ],
    patron: ["Eat. You can save the sea after you've eaten.", "The round house was built round so nobody sits at the head of the table. Remember that, up on your sword.", "Three hundred people sleep in this house. Tonight one of them will wake up as someone else. I'm counting on you."],
    guide: ["I hold my breath for four hundred heartbeats. I counted. You?", "There are pearls down there as big as your fist, and people as old as the isle. I'd rather have the pearls.", "Red thread. Don't take it off. It's how we know you're you."],
    boss: {
      intro: "Hei Fan, Queen of the Black Sail, steps off her ship onto the reef with a gilded cutlass and a ladle-stamped purse at her belt",
      words: [
        ["sp-boss", "The bell's mine. I hooked it. I'll sell it to whoever pays most, and someone is paying very well."],
        ["hero", "Someone is paying you to drown Pearlgate in ghosts."],
        ["sp-boss", "Someone's paying me in soup. Do you know what the soup does, girl? One sip and you forget your debts. I've got a lot of debts."],
      ],
      fates: [
        { heart: "mercy", label: "Let her keep her ship, without the bell", line: "She lets Hei Fan sail away with her ship and her crew, and without the hook. The Black Sail goes over the horizon and does not come back." },
        { heart: "sword", label: "Break her cutlass and her flag", line: "She snaps the gilded cutlass across her knee and burns the black sail on the reef. Hei Fan's crew row home in the ship's boats." },
        { heart: "balance", label: "Make her raise the bell and return it", line: "She makes Hei Fan's crew dive one last time to unhook the bell, and they bring up three drowned pirates' bones with it, and bury them on the reef." },
        { heart: "slaughter", label: "Send her down to the bell", line: "She cuts the rope with Hei Fan on the end of it. The bell rings once more, and then is very quiet." },
      ],
      victory: "The bell stops ringing. In the round house, the people who had woken up as someone else wake up again, as themselves, and are hungry.",
    },
  },
  // ------------------------------------------------------------------------------------------------ II · Crescent Isle
  {
    title: "The Tide That Did Not Turn",
    hanzi: "不退之潮",
    level: 5,
    beats: [
      {
        step: 0,
        npc: "sp-patron",
        title: "The Crescent Hall",
        objective: "On Crescent Isle, south of Pearlgate, the sea abbesses keep a hall built round like the new moon. Abbess Jing Hai has sent for the cultivator who silenced the bell.",
        lines: [
          ["narr", "The Crescent Hall curves away from her on both sides like a held breath. Inside the horns of the isle the water is very still, and the tide line on the rocks is far too high."],
          ["sp-patron", "You silenced Pearlgate's bell. Good. Now help me with my tide. It came in eleven days ago, and it has not gone out."],
          ["sp-patron", "A tide that does not turn is a held breath. Something under the sea is holding its breath, and it is not ours."],
        ],
        done: "Abbess Jing Hai gives her a sea abbess's string of shells, to wear while she is a guest of the hall.",
      },
      {
        step: 20,
        npc: "sp-folk-1",
        title: "The Turtle-Watcher",
        objective: "Old Wu has watched the turtles of Turtleback Isle come ashore for sixty years. Find him and ask what the turtles are doing.",
        lines: [
          ["sp-folk-1", "They're not coming ashore. Sixty years, and this is the first spring they've not come ashore to lay."],
          ["sp-folk-1", "They're out there, all of them, a thousand turtles floating in a ring past the Dragon King's isle, heads up, like they're waiting to be let in somewhere."],
          { a: "sp-folk-1", n: "fish" },
        ],
        done: "Out past the Dragon King's isle, on the still water, a thousand small dark heads wait in a ring.",
      },
      {
        step: 40,
        npc: "sp-folk-0",
        title: "Brine in the Wells",
        objective: "Diver Mei says the island's wells have turned salt. Hear her out.",
        lines: [
          ["sp-folk-0", "Every well on the isle. Salt. You can't drink, you can't cook, you can't wash the salt off yourself with more salt."],
          ["sp-folk-0", "And the serpents. The tide's brought serpents up the beach, fat with seawater, too heavy to swim. They lie in the wells and hiss."],
        ],
        choice: {
          prompt: "The isle needs fresh water today. How does she get it?",
          options: [
            { heart: "mercy", label: "Carry water from Pearlgate, all day", then: "She walks the bridges with buckets until her arms shake.", reply: ["sp-folk-0", "That's two hundred buckets. You're mad. Thank you."], effect: quiet(2) },
            { heart: "sword", label: "Cut the serpents out of the wells", then: "She goes down each well with her sword.", reply: ["sp-folk-0", "The wells are still salt. But at least they're quiet."] },
            { heart: "balance", label: "Draw the salt out with her qi", then: "She sits by each well and draws the salt up into crystals, slowly, the way the tea masters taught her to draw bitterness.", reply: ["sp-folk-0", "It's… sweet. It's sweet water."] },
            { heart: "slaughter", label: "Poison the serpents' tide-pools", then: "She drops a poison pill into each tide-pool the serpents come from.", reply: ["sp-folk-0", "The fish are dead too. All the little fish."], effect: feed(3) },
          ],
        },
        done: "The isle drinks tonight. The tide is still in.",
      },
      {
        step: 60,
        npc: "sp-guide",
        title: "The Witch on the Turtle's Back",
        objective: "Novice Bei Ke has seen someone walking on the water at night. Find her.",
        lines: [
          ["sp-guide", "I swear it. A woman, walking on the water out past the turtles. With a staff. And wherever she walked, the sea came up after her, like a dog."],
          ["sp-guide", "Abbess says I shouldn't be out at night. Abbess was out at night too. I saw her. She was watching the woman, and crying."],
        ],
        done: "That night, far out on the still water, a woman with a staff walks across the moon's road, and the sea rises behind her.",
      },
      {
        step: 80,
        npc: "sp-patron",
        title: "My Sister",
        objective: "Ask Abbess Jing Hai who the woman on the water is.",
        lines: [
          ["sp-patron", "Hai Yao. My sister. We took our vows together in this hall, forty years ago. She was better at the tides than I will ever be."],
          ["sp-patron", "Her son drowned off the Coral Ring. She asked the sea to give him back. The sea said no. She asked the Dragon King. He was asleep."],
          ["sp-patron", "So she is holding the tide in until somebody answers. If the tide does not turn by midsummer, the isles go under. All of them."],
        ],
        done: "The abbess goes back to her prayers, and the hall curves round her like a held breath.",
      },
    ],
    rites: [
      { title: "The Moon Vigil", ask: "keep the night vigil in the horns of the crescent, until the moon sets", done: "The moon goes down over the still water. The tide does not move. She keeps the vigil anyway." },
      { title: "Counting the Shells", ask: "count the shells of the hall's long string, one prayer to each", done: "Nine hundred and ninety-nine shells. The abbess says the last one is always missing." },
      { title: "Sweeping the Tide Line", ask: "sweep the drowned weed from the hall's steps", done: "The weed comes off in long wet ropes. Underneath, the steps are carved with waves." },
      { title: "Calling the Turtles", ask: "beat the turtle drum at the water's edge at dawn", done: "A thousand heads turn toward the sound. None of them come." },
    ],
    favours: [
      { ask: "carry the old turtle-watcher's stool down to the beach", done: "“Sixty years I've carried it. My knees thank you.”" },
      { ask: "unpick a net tangled round the crescent's horn", done: "“There was a turtle in it. You let it go. Good. They're all we've got.”" },
      { ask: "teach Little Hai to swim, now the water is so high", done: "“He can float! He says he's a turtle now. He won't come out.”" },
      { ask: "fetch dry wood from Pearlgate, since everything here is wet", done: "“A dry fire. I'd forgotten what one smelled like.”" },
      { ask: "help the weaver hang her cloth above the waterline", done: "“Everything I made this year was blue. I didn't mean it to be.”" },
      { ask: "read the tide-tables aloud to the novices", done: "“They fell asleep. That's the right answer, with tide-tables.”" },
    ],
    goods: ["a bolt of sea-blue cloth", "a string of prayer shells", "a crock of turtle-egg custard", "a carved tide-staff", "a basket of crescent figs"],
    tales: [
      "“A hall built like the moon? So it's never finished? …Our hall's never finished either, but that's because we ran out of money.”",
      "“A tide that won't go out. My father said that happened once, before I was born, and the whole coast prayed.”",
      "“Sea abbesses. Shaved heads and shells. My aunt wanted to be one, but she couldn't swim.”",
      "“A mother holding the sea for her son. …I'd do it. I'd hold back the whole sky.”",
    ],
    patron: ["The tide is in. Pray as though it will go out.", "My sister taught me the tides. I am trying to remember everything she said.", "The hall is round so that whoever walks it comes back to where they began. Even her. Even her."],
    guide: ["The abbess says I'll be an abbess too someday. I'd rather be a turtle.", "Did you know turtles cry? It's salt. They cry the sea out of themselves.", "If the isles go under, can you carry me on your sword? Just asking. Just in case."],
    boss: {
      intro: "Hai Yao, the Tide Witch, walks up out of the sea on its own risen water, her staff dripping",
      words: [
        ["sp-boss", "Have you come to make the tide go out? Then make the sea give back my son."],
        ["hero", "I can't. Nobody can. The sea doesn't give back."],
        ["sp-boss", "Then nobody gets anything back. Not the isles, not the turtles, not my sister. Hold your breath, little cultivator."],
      ],
      fates: [
        { heart: "mercy", label: "Take her to her sister", line: "She carries the beaten witch up the steps of the Crescent Hall, and leaves the two sisters alone in the curve of it. In the morning the tide goes out." },
        { heart: "sword", label: "Break her staff", line: "She snaps the tide-staff, and the sea falls back all at once with a sound like a breath let go." },
        { heart: "balance", label: "Promise to ask the Dragon King for her", line: "She promises Hai Yao that she will go to the Dragon King's isle and wake him, and ask. The witch lets the tide go, a little at a time." },
        { heart: "slaughter", label: "Give her to the sea", line: "She throws the witch into the water she was holding. The tide goes out, fast, and takes her with it." },
      ],
      victory: "The tide turns. A thousand turtles come ashore on Turtleback Isle in one night, and dig, and lay, and go back into the sea.",
    },
  },
  // ------------------------------------------------------------------------------------------------ III · the Dragon King
  {
    title: "The Dragon King's Debt",
    hanzi: "龙王之债",
    level: 8,
    beats: [
      {
        step: 0,
        npc: "sp-patron",
        title: "The Sleeping King",
        objective: "On the Dragon King's Isle, south-east of the Crescent, Minister Gui of the Drowned Court keeps the temple. He has been waiting for someone who could wake his king.",
        lines: [
          ["narr", "The temple's roof is dragon-green and its doors are coral. An old man with a turtle-shell fan stands before them, reading a scroll that has been wet for a hundred years."],
          ["sp-patron", "You woke the tide. Will you wake a king? Ao Shun of the Southern Sea has been asleep under this isle for one hundred and four years."],
          ["sp-patron", "While he sleeps, the rain does not come to the isles when it should, and the drowned are not sent on. They stay in his palace. Waiting. Bored. The dead get bored, {title}. It's not good for them."],
        ],
        done: "Minister Gui unrolls the wet scroll for her. It is a list of the drowned, and it is very long.",
      },
      {
        step: 20,
        npc: "sp-guide",
        title: "The Pearl-Maid",
        objective: "Ao Lan, a pearl-maid of the drowned court, comes up out of the sea at dusk. Speak with her.",
        lines: [
          ["sp-guide", "You're the one who stopped the bell. Thank you. The bell kept waking the drowned, and the drowned kept waking me."],
          ["sp-guide", "I was the king's pearl-maid. When he went to sleep he told us to wait. We waited. Then the soldiers started forgetting they were dead, and walking up out of the sea in their armour."],
          { a: "sp-guide", n: "bow" },
        ],
        done: "Ao Lan gives her a pearl that is always cold, and says it will let her breathe in the king's palace, for a while.",
      },
      {
        step: 40,
        npc: "sp-folk-0",
        title: "The Shrimp-Captain's Watch",
        objective: "Shrimp-Captain Xia still stands guard over the palace door, a hundred years drowned. Ask him to let her in.",
        lines: [
          ["sp-folk-0", "Halt! Who goes there! …Oh. A living one. We don't get living ones."],
          ["sp-folk-0", "Orders are nobody wakes His Majesty. Orders were given a hundred and four years ago. Nobody's given me any new orders."],
        ],
        choice: {
          prompt: "Captain Xia will not stand aside without an order.",
          options: [
            { heart: "mercy", label: "Tell him he's done his duty, and can rest", then: "She tells the old soldier that a hundred and four years is a long enough watch for anyone.", reply: ["sp-folk-0", "…Is it? Nobody said. Nobody ever said."], effect: quiet(2) },
            { heart: "sword", label: "Order him aside, as a cultivator", then: "She draws herself up and gives the order in the voice Elder Mo uses on the outer disciples.", reply: ["sp-folk-0", "Yes, ma'am! At once, ma'am! …That felt good. Do it again."] },
            { heart: "balance", label: "Ask Minister Gui to write him an order", then: "She goes back up to the temple and has the minister write it out properly, with a seal.", reply: ["sp-folk-0", "A sealed order. Well. That's different. That's proper."] },
            { heart: "slaughter", label: "Walk through him", then: "She walks through the drowned captain like walking through cold water.", reply: ["sp-folk-0", "…Hey. Hey!"], effect: feed(3) },
          ],
        },
        done: "The coral doors of the Crystal Palace grind open, and the sea breathes out.",
      },
      {
        step: 60,
        npc: "sp-patron",
        title: "Why He Sleeps",
        objective: "Minister Gui says it is time she knew why his king went to sleep. Hear him.",
        lines: [
          ["sp-patron", "A hundred and four years ago there was a drought on the mainland. Three years without rain. The king was asked to make it rain, and he did not have the Heavenly Court's leave."],
          ["sp-patron", "He made it rain anyway. Heaven punished him with sleep. Not death. Sleep. A dragon king who cannot dream of rain."],
          ["sp-patron", "And someone has been feeding him soup while he sleeps. The soup of forgetting. I have seen the bowls. He is forgetting he was ever king."],
        ],
        done: "In the palace, beside the sleeping king's coral throne, there is a soup bowl, licked clean.",
      },
    ],
    rites: [
      { title: "Rice Wine for the King", ask: "pour rice wine into the sea before the temple at dusk", done: "The wine goes into the water in a gold thread, and somewhere below, something very large turns over in its sleep." },
      { title: "The Rain Prayer", ask: "kneel with the rain-priestess on the temple steps until it rains", done: "It rains. Very little, and not for long, but on the isles they come out and stand in it." },
      { title: "Reading the Drowned", ask: "read aloud ten names from the minister's list of the drowned", done: "Ten names. When she reads the last, the sea goes calm for a moment, as if listening." },
      { title: "Polishing the Pearl", ask: "polish the dragon pearl on the temple altar with a silk cloth", done: "It glows a little. Minister Gui says it hasn't glowed in fifty years." },
    ],
    favours: [
      { ask: "drag the fallen coral off the temple path", done: "“The king won't mind. The king doesn't mind anything, at present.”" },
      { ask: "carry the rain-priestess's drum up the hill", done: "“The drum is heavier than the rain. Most days.”" },
      { ask: "buy every clam on the clam-seller's tray", done: "“All of them? You'll be sick. …I'll give you a discount on being sick.”" },
      { ask: "help the temple-keeper rehang the bell ropes", done: "“There. Now if he wakes, we can tell everyone at once.”" },
      { ask: "dive for the minister's spectacles", done: "“Ah! The drowned list makes so much more sense now.”" },
      { ask: "sit with a drowned soldier who doesn't know he's dead", done: "“He told you about his wife? He tells everyone about his wife. She died eighty years ago. Don't tell him.”" },
    ],
    goods: ["a jar of rain gathered at the temple", "a cold pearl", "a coral comb", "a box of dragon-temple incense", "a sea-dragon scale"],
    tales: [
      "“The Dragon King? Asleep? That's why the rains have been wrong for a hundred years! My grandfather said so. Nobody listened to my grandfather.”",
      "“A king who made it rain without leave and got punished for it. …We should build him a shrine. A small one. So heaven doesn't notice.”",
      "“Drowned soldiers still on guard. My son's a soldier. Tell me they let them go home eventually.”",
      "“Crystal palace under the sea. I'd like to see it. Not from the inside of a drowning, though.”",
    ],
    patron: ["The king's breath is slow. Twice a day. I count it.", "A minister serves a sleeping king the way he serves a waking one. More carefully, really.", "If he forgets he is king, who is left to remember for him? Only me. And I am very old."],
    guide: ["The palace is beautiful. It's also wet. Everything is wet. I'd like to be dry, once.", "Shrimp-Captain Xia proposed to me eighty years ago. I said I'd think about it. I'm still thinking.", "The cold pearl lets you breathe. Don't take it out. I mean it."],
    boss: {
      intro: "Ao Shun, the Drowned Dragon King, wakes on his coral throne with soup on his breath and no memory of being king",
      words: [
        ["sp-boss", "Who are you. Who am I. Why is everything so wet."],
        ["hero", "You're the Dragon King of the Southern Sea. You've been asleep. Someone's been making you forget."],
        ["sp-boss", "Forget? I remember… rain. I remember a great deal of rain, and somebody crying. I don't like it. Make it stop."],
      ],
      fates: [
        { heart: "mercy", label: "Remind him gently who he is", line: "She sits at the foot of the throne and tells him about the drought, and the rain, and the people who stood in it. Slowly, the king remembers." },
        { heart: "sword", label: "Strike the soup out of him", line: "She strikes the king's chest, hard, and he coughs up a bowl's worth of soup of forgetting onto the coral. He blinks. He remembers." },
        { heart: "balance", label: "Bring Minister Gui down to him", line: "She brings the old minister down to the throne room, and the minister reads him the list of the drowned, and the king listens to every name." },
        { heart: "slaughter", label: "Take his pearl", line: "She takes the dragon pearl from the king's brow while he is weak. He will not remember anything now. The isles will have rain when she says so." },
      ],
      victory: "The Dragon King sends the drowned on, at last, and it rains over the isles for three days. Minister Gui stands in it with his face up, and does not use his fan.",
    },
  },
  // ------------------------------------------------------------------------------------------------ IV · Ghost Gate
  {
    title: "The Gate That Stands Open",
    hanzi: "鬼门大开",
    level: 11,
    beats: [
      {
        step: 0,
        npc: "sp-patron",
        title: "Ghost Gate Isle",
        objective: "West of Turtleback, the black isle with the dead trees: Ghost Gate Isle. An exorcist has set up camp at the gate itself. Find Zhong Kui-Er.",
        lines: [
          ["narr", "Nothing grows on Ghost Gate Isle but dead trees and lanterns. At its heart a stair goes down into the black rock, and above it, cut in a hand nobody living wrote: the living may go down."],
          ["sp-patron", "You're the one who woke the Dragon King. Then you know someone's stealing the soup of forgetting. I know where from. Down there."],
          ["sp-patron", "The Ghost Gate is supposed to open one month a year, at the Ghost Festival, and shut again. It's been open since spring. The dead are coming up through it, and they remember everything."],
        ],
        done: "Zhong Kui-Er hands her a peachwood charm against the dead, and says it won't work, but it's polite to carry one.",
      },
      {
        step: 20,
        npc: "sp-guide",
        title: "Little Lantern",
        objective: "A small ghost carrying a lantern has been following her round the isle. Speak to it.",
        lines: [
          ["sp-guide", "Hello. You can see me? Nobody sees me. I carry the lantern so people will see me, and they still don't."],
          ["sp-guide", "I'm waiting for my mother. She said she'd come and get me at the gate. That was a long time ago. Do you think she forgot?"],
          { a: "sp-guide", n: "bow" },
        ],
        done: "The little ghost walks beside her for the rest of the day, lantern held up high, very proud to be seen.",
      },
      {
        step: 40,
        npc: "sp-folk-2",
        title: "The Widow at the Gate",
        objective: "A widow sits at the top of the stair, every day. Ask her why.",
        lines: [
          ["sp-folk-2", "My husband came up through the gate in spring. He sat down at our table. He asked why the roof hadn't been mended. He asked about our daughter's wedding."],
          ["sp-folk-2", "Then at midnight he got up and walked back down the stair, and he said he had to go before they noticed he'd gone."],
          ["sp-folk-2", "Who? Who'd notice? I sit here every day to ask him."],
        ],
        choice: {
          prompt: "The widow wants to go down the stair to find him.",
          options: [
            { heart: "mercy", label: "Promise to bring her word of him", then: "She promises to look for him in the Nine Springs, and come back and tell her.", reply: ["sp-folk-2", "You'll know him. He'll be the one complaining about the roof."], effect: quiet(2) },
            { heart: "sword", label: "Forbid her to go", then: "She tells the widow plainly that the living who go down that stair don't come back.", reply: ["sp-folk-2", "…Then you go. You're half a ghost already, the way you fight."] },
            { heart: "balance", label: "Tell her to mend the roof first", then: "She tells the widow to mend the roof, so that when he comes up again there's nothing to complain about but her.", reply: ["sp-folk-2", "Ha. Ha! …He would complain about that too."] },
            { heart: "slaughter", label: "Tell her he's gone for good", then: "She tells the widow that what came up was not her husband, and she should stop waiting.", reply: ["sp-folk-2", "…Get away from me."], effect: feed(3) },
          ],
        },
        done: "The widow goes on sitting at the top of the stair, but she has brought a hammer and some roof tiles.",
      },
      {
        step: 60,
        npc: "sp-folk-3",
        title: "The Soul Guard",
        objective: "Ma Mian, a soul guard of the underworld, stands at the gate with a spear and a face like a horse's. Ask him why he has not shut it.",
        lines: [
          ["sp-folk-3", "Shut it? I'm not allowed to shut it. Only the warden shuts it. Ox-Head."],
          ["sp-folk-3", "Ox-Head says it stays open by order. Whose order, I asked. Mind your own gate, he said. This is my gate. That's the trouble."],
          { a: "sp-folk-3", n: "spear" },
        ],
        done: "Ma Mian lets her look down the stair. Far below there are lanterns, and a market, and a smell of soup.",
      },
    ],
    rites: [
      { title: "Floating the Lanterns", ask: "set paper lanterns on the sea for the dead who cannot find their way", done: "Two hundred lanterns drift away over the dark water. Some of them drift toward the isle, not away." },
      { title: "Burning Spirit Money", ask: "burn spirit money at the top of the stair for those below", done: "The paper goes up in curls. Somewhere below, something says thank you in a very small voice." },
      { title: "Sweeping the Graves", ask: "help the grave-sweeper tidy the isle's old graves", done: "Under the moss, every grave has the same date on it. The day the gate first opened." },
      { title: "The Exorcist's Circle", ask: "walk the circle of peachwood stakes round the gate, and drive in the ones that have worked loose", done: "The stakes hum when she touches them. Zhong Kui-Er says that's normal. It isn't." },
    ],
    favours: [
      { ask: "buy spirit money from old Fu, who has too much of it", done: "“Business is terrible. The dead are coming up to buy it themselves now. Cutting out the middleman.”" },
      { ask: "carry the little ghost's lantern while it rests", done: "“It's heavy. I didn't know it was heavy. Thank you for carrying it.”" },
      { ask: "help the grave-sweeper find a grave that has moved", done: "“It got up and walked twenty feet. Then lay down again. I'll never understand them.”" },
      { ask: "fetch the exorcist more peach wood from Penglai", done: "“Penglai peach. The best. Ghosts can't stand it. Neither can I, it gives me a rash.”" },
      { ask: "keep the widow company for an evening", done: "“You talk less than he did. That's nice. That's nice for a change.”" },
      { ask: "stand watch at the stair so the soul guard can sleep", done: "“First sleep in a hundred years. I dreamed of grass. I don't even like grass.”" },
    ],
    goods: ["a bundle of spirit money", "a peachwood charm", "a paper lantern for the dead", "a pot of ash-black tea", "a packet of grave-incense"],
    tales: [
      "“The Ghost Gate's open? Out there in the sea? …I'm moving inland. I'm moving to the Frostveil snows.”",
      "“My father came back once. At the Ghost Festival. He asked for his pipe. We'd buried him with it.”",
      "“A little ghost with a lantern, waiting for its mother. Don't tell my wife that one. She'll cry for a week.”",
      "“Living people going down the stair? Only fools and heroes do that. Which is she?”",
    ],
    patron: ["The gate wants shutting. The question is who opened it, and whose hand is on the latch.", "Peachwood, salt, and a loud voice. That's exorcism. The rest is showmanship.", "Don't eat anything down there. Not even if it smells like your grandmother's cooking. Especially then."],
    guide: ["I'll show you the way down. I know every step. I've sat on all of them.", "Do ghosts grow up? I don't think I have.", "If you see my mother down there, tell her I've still got the lantern."],
    boss: {
      intro: "Ox-Head, Warden of the Ghost Gate, comes up the stair with his soul-hook spear and a bowl of soup in his other hand",
      words: [
        ["sp-boss", "The gate stays open. The broker pays well for every soul that walks out of it unforgetting. Do you know what memories fetch, in the Ghost Market?"],
        ["hero", "They aren't yours to sell."],
        ["sp-boss", "Nothing down there is anyone's. That's the point of being dead."],
      ],
      fates: [
        { heart: "mercy", label: "Send him back to his post, to shut it himself", line: "She lets the beaten warden shut his own gate. He does it slowly, and the hinges scream, and when it is done he sits down beside it and weeps." },
        { heart: "sword", label: "Break the soul-hook", line: "She breaks the soul-hook spear across the stair, and Ma Mian steps forward and shuts the gate himself." },
        { heart: "balance", label: "Make him tell her who pays him", line: "She makes Ox-Head tell her the broker's name, and the market where he trades, and leaves the gate half-shut behind her as she goes down." },
        { heart: "slaughter", label: "Throw him down his own stair", line: "She kicks the warden down the stair into the dark. It is a long way down. It is a long way." },
      ],
      victory: "The Ghost Gate shuts. On the isle, the lanterns go out one by one, and in the morning there is green moss on the black rock.",
    },
  },
  // ------------------------------------------------------------------------------------------------ V · the Nine Springs
  {
    title: "Meng Po's Soup",
    hanzi: "孟婆汤",
    level: 14,
    beats: [
      {
        step: 0,
        npc: "sp-patron",
        title: "Down the Yellow Springs Road",
        objective: "Go down the stair under Ghost Gate Isle, along the Road of Yellow Springs, over the Naihe Bridge, and find Meng Po at her pavilion.",
        lines: [
          ["narr", "At the bottom of the stair the road is yellow and the light is yellow and the river beside it is so still it has forgotten how to be a river. Across the bridge, an old woman is stirring a pot."],
          ["sp-patron", "Living. Hmph. The living always want something. Sit. Don't touch the pot."],
          ["sp-patron", "Somebody steals my soup. Every night, a ladle's worth, and the dead go up the road with their whole lives in their heads. Three hundred years I've kept this pot. Never once has anyone stolen from it."],
        ],
        done: "Meng Po gives her a cup of plain tea, and watches her very carefully while she drinks it.",
      },
      {
        step: 20,
        npc: "sp-guide",
        title: "The Ghost Clerk",
        objective: "Ghost Clerk Bai keeps the books of the Ghost Market. He says he has numbers she should see.",
        lines: [
          ["sp-guide", "Numbers don't lie, even down here. Especially down here. Look: memories bought, this season. Ten thousand. Memories sold. Ten thousand and one."],
          ["sp-guide", "Someone is selling one more memory than was ever bought. Someone has a memory nobody gave up. Someone is selling their own."],
          { a: "sp-guide", n: "abacus" },
        ],
        done: "Clerk Bai circles a name in red ink: Broker Yin, of the Ghost Market, who buys what the dead would rather forget.",
      },
      {
        step: 40,
        npc: "sp-folk-2",
        title: "The Bride in Red",
        objective: "A bride in a red veil sits on the Naihe Bridge and will not cross. Ask her why.",
        lines: [
          ["sp-folk-2", "I sold my wedding day to the broker. He paid me in soup. One sip, he said, and you won't miss it."],
          ["sp-folk-2", "I drank the soup. I don't remember the wedding. But I remember selling it. Why did I sell it? It must have been the best day of my life, to be worth so much."],
        ],
        choice: {
          prompt: "The bride wants her wedding day back.",
          options: [
            { heart: "mercy", label: "Promise to buy it back for her", then: "She promises to find the day in the broker's stall and buy it back with her own spirit stones.", reply: ["sp-folk-2", "You'd spend your money on a stranger's wedding? …You'd have been invited."], effect: quiet(2) },
            { heart: "sword", label: "Promise to take it back for her", then: "She says the broker will give it back, one way or another.", reply: ["sp-folk-2", "Take it back? From him? …Bring the cake too. I bet there was cake."] },
            { heart: "balance", label: "Ask her if she wants it, truly", then: "She asks the bride gently whether a day she sold is a day she would want back.", reply: ["sp-folk-2", "…I don't know. I don't know. That's the worst of it."] },
            { heart: "slaughter", label: "Tell her to cross and forget the rest too", then: "She tells the bride the soup is a mercy, and she should go and drink all of it.", reply: ["sp-folk-2", "…Maybe you're right. Maybe it's easier."], effect: feed(3) },
          ],
        },
        done: "The bride in red stays on the bridge, but she lifts her veil, so she can see the far side.",
      },
      {
        step: 60,
        npc: "sp-folk-3",
        title: "The Ferryman of the Forgetting River",
        objective: "The ferryman of the River of Forgetting rows those who will not walk the bridge. He says he has rowed a grey boat full of soup. Ask him where.",
        lines: [
          ["sp-folk-3", "Up the river. Up and out. Through the sea, past the Dragon King's isle, to the Pearl Sea, to the Black Sail. A pot of soup a night."],
          ["sp-folk-3", "The broker pays the pirates in soup. The pirates owe the whole sea. A pirate who can forget his debts will do anything."],
          ["sp-folk-3", "I only row. A ferryman only rows. But I remember, miss. Ferrymen never drink the soup."],
        ],
        done: "The ferryman lets her look in the bottom of his boat. There are rings of soup on the planks, and a ladle stamped with the broker's mark.",
      },
    ],
    rites: [
      { title: "Stirring the Pot", ask: "stir Meng Po's pot one hundred times sunwise, and not one time the other way", done: "One hundred. Meng Po counts with her. On ninety-nine she says, “Careful.”" },
      { title: "The Bridge Toll", ask: "stand at the Naihe Bridge's end and see each soul across", done: "She sees forty across. Two turn back. One of them waves." },
      { title: "Gazing Homeward", ask: "climb the Terrace of Gazing Homeward and look for one of the dead's homes, for them", done: "She sees a fishing village, and a woman mending a net, and tells the soul who asked. He nods, and goes to his soup." },
      { title: "Lanterns of the Market", ask: "light the Ghost Market's lanterns, the ones the living forgot to burn", done: "The market brightens. Somebody laughs in it, for the first time in a long time." },
    ],
    favours: [
      { ask: "help the lost soldier find which way is home", done: "“Up the road and left. I'd have got there. Eventually. In a few hundred years.”" },
      { ask: "buy a lantern from the lantern-seller, who has sold none", done: "“A living customer! You've made my death.”" },
      { ask: "wash Meng Po's soup bowls in the river", done: "“Not in the river! Not in the river! …Oh. Well. They're very clean now. Forgetful, but clean.”" },
      { ask: "carry a letter from a dead mother up to her son", done: "“He'll read it. He won't believe it. That's all right. He'll keep it.”" },
      { ask: "sit with the bride on the bridge a while", done: "“You don't have to say anything. I didn't know a bride could be lonely.”" },
      { ask: "count the broker's stalls for Clerk Bai", done: "“Seven. There should be six. Numbers don't lie. Brokers do.”" },
    ],
    goods: ["a lantern for the dead", "a sealed jar of the soup", "a bundle of paper clothes", "a ledger page with a name struck out", "a cup of Meng Po's tea"],
    tales: [
      "“Meng Po's real? With her pot and everything? …I'd always hoped she'd be kind.”",
      "“They sell memories down there? I've got a few I'd sell. Cheap.”",
      "“A bride who sold her wedding day. Who'd do that? …Don't answer that.”",
      "“The ferryman never drinks the soup. So he remembers everyone he's rowed. Poor man.”",
    ],
    patron: ["Drink, child. It's tea. Only tea. I promise. My word's good; it's the only thing down here that is.", "Three hundred years at one pot. You'd think I'd be bored. I am. Stir it anyway.", "Forgetting is a mercy. Not for everyone. Not for you, I think."],
    guide: ["The books balance or they don't. Down here they never have.", "I was a clerk in life too. Nobody believes me when I say I'm happier now.", "The broker's ledger has a page missing. I'd like that page very much."],
    boss: {
      intro: "Broker Yin of the Ghost Market rises from behind his seventh stall with an abacus of finger-bones and a soup ladle in his belt",
      words: [
        ["sp-boss", "Everyone sells. Every soul who comes down the road has something they'd rather not carry. I only take it off their hands."],
        ["hero", "And pay them in stolen soup, and sell their lives to pirates."],
        ["sp-boss", "Pirates, kings, wardens. A market goes where the money is. You've cost me a great deal of money, girl."],
      ],
      fates: [
        { heart: "mercy", label: "Make him give the memories back", line: "She makes the broker open every jar, and the memories go home, each to its own soul. The bride in red remembers her wedding, and laughs out loud." },
        { heart: "sword", label: "Break his abacus and his scales", line: "She breaks the abacus of bones and the false scales, and the Ghost Market shuts its seventh stall forever." },
        { heart: "balance", label: "Give him to Clerk Bai's books", line: "She hands the broker to Clerk Bai, who will make him balance every account he ever kept, one by one. It will take him a long time." },
        { heart: "slaughter", label: "Feed him his own soup", line: "She pours a whole jar of soup down the broker's throat. He forgets his name, his stall, his debts, and wanders off down the Yellow Springs road." },
      ],
      victory: "Meng Po's pot is full again in the morning. The dead drink, and cross, and forget, and the road up to the Ghost Gate is quiet.",
    },
  },
  // ------------------------------------------------------------------------------------------------ VI · the Ten Courts
  {
    title: "The Ledger of Life and Death",
    hanzi: "生死簿",
    level: 17,
    beats: [
      {
        step: 0,
        npc: "sp-patron",
        title: "King Yama's Court",
        objective: "Beyond the Ghost Market the Ten Courts of the Nine Springs sit in judgement. King Yama of the Fifth Court has asked to see the living cultivator walking his roads.",
        lines: [
          ["narr", "The Fifth Court is black and red and gold, and so quiet she can hear the brush moving in the clerks' hands. King Yama does not look up from the ledger when she comes in."],
          ["sp-patron", "Lin Yue. Of Willow Creek, or the Azure Cloud Sect, depending on who you ask. Your page is here. It is a very busy page."],
          ["sp-patron", "You have closed the Ghost Gate and emptied the broker's stall. Now I have a harder thing for you. Someone has been writing in my ledger. Someone has been changing the years."],
        ],
        done: "King Yama turns the ledger round so she can read it. On her own page, someone has added a line in red, and then crossed it out.",
      },
      {
        step: 20,
        npc: "sp-guide",
        title: "Judge Cui",
        objective: "Judge Cui keeps the brush of the Fifth Court. Ask him whose hand wrote in the ledger.",
        lines: [
          ["sp-guide", "Not mine. The ink's the same, the brush is the same, but the hand… whoever it is writes as if they've been doing it a thousand years. Better than me."],
          ["sp-guide", "They give the wicked long lives and the kind ones short. Only a few. A few at a time. Enough to tip a world without anyone noticing."],
          { a: "sp-guide", n: "read" },
        ],
        done: "Judge Cui shows her the struck-out names: a fisherman's son off the Coral Ring, a pearl-diver's grandmother, a widow's husband. Everyone the isles have lost this year.",
      },
      {
        step: 40,
        npc: "sp-folk-2",
        title: "The Mirror of Retribution",
        objective: "The mirror-polisher says the Mirror of Retribution shows each soul what it did. She should look, before she goes further.",
        lines: [
          ["sp-folk-2", "Everyone looks. Even kings. Even you. The mirror only shows what's true. It's the truth that hurts, not the mirror."],
          { a: "hero", n: "look" },
          ["narr", "She looks. A girl with a sword, on a sky bridge. A fox. A lake. A valley full of red light. Everything after."],
        ],
        choice: {
          prompt: "The mirror shows her what she has done. What does she do with it?",
          options: [
            { heart: "mercy", label: "Ask forgiveness of those she has hurt", then: "She kneels before the mirror and names each one she has hurt, aloud.", reply: ["sp-folk-2", "The mirror cleared. It does that, sometimes. When it's said."], effect: quiet(3) },
            { heart: "sword", label: "Stand by every cut", then: "She looks at every one without looking away, and says she would make each cut again.", reply: ["sp-folk-2", "…It didn't crack. Most mirrors would have."] },
            { heart: "balance", label: "Accept both what she did and what was done to her", then: "She looks until she sees both sides of every choice, and sets them down together.", reply: ["sp-folk-2", "Balanced. The mirror likes that. So do I."] },
            { heart: "slaughter", label: "Shatter it", then: "She puts her fist through the Mirror of Retribution.", reply: ["sp-folk-2", "…That's the first one in a thousand years. I'll start polishing the pieces."], effect: feed(4) },
          ],
        },
        done: "The mirror-polisher goes back to his work. Whatever the mirror showed, it is hers now.",
      },
      {
        step: 60,
        npc: "sp-folk-1",
        title: "The Keeper of the Ledger",
        objective: "The Keeper of the Ledger keeps the vault where the books of life and death are stored. Ask him who has the key.",
        lines: [
          ["sp-folk-1", "Three keys. The king's. Mine. And the Tenth Court's. The Tenth Court sees the souls off to be reborn. Its king is Mo Xie."],
          ["sp-folk-1", "Mo Xie was a living cultivator once. He came down the stair, like you. He was going to go back up. He never did. He said the ledger was more interesting than living."],
          ["sp-folk-1", "He's been a king down here five hundred years. Nobody remembers who crowned him. Nobody can find it written anywhere."],
        ],
        done: "In the vault, on the Tenth Court's shelf, there is a ledger with no title on its spine, and a brush beside it that is still wet.",
      },
    ],
    rites: [
      { title: "Copying the Ledger", ask: "copy one page of the ledger in a clean hand, for the vault", done: "A page of names and years. Her hand shakes on a name she knows, and steadies again." },
      { title: "Weighing the Souls", ask: "stand with the clerks at the scales and weigh ten souls' deeds", done: "Ten souls. Most of them weigh about the same. That's the thing nobody tells you." },
      { title: "The Court Bell", ask: "ring the Fifth Court's bell to open the session", done: "The bell rings through all ten courts at once. Every brush stops, then starts again." },
      { title: "Lamps of the Nine Springs", ask: "carry oil to the lamps along the court road", done: "Nine lamps. Each one burns a different colour. The clerks say that's the point." },
    ],
    favours: [
      { ask: "fetch fresh ink for the Keeper from the market", done: "“Black. Not red. Never red, unless you mean it.”" },
      { ask: "help the soul guard find a soul that hid under a bench", done: "“Under the bench in the Fourth Court. They always hide in the Fourth Court. It's the warm one.”" },
      { ask: "read a sentence aloud for a clerk who has lost his voice", done: "“Thank you. That one was a long sentence. In both senses.”" },
      { ask: "carry a tray of tea to every court", done: "“Ten courts, ten trays. The Tenth Court sent it back. They always send it back.”" },
      { ask: "polish the court's brass weights", done: "“Bright enough to see yourself. Careful what you see.”" },
      { ask: "find the Keeper's spectacles in the vault", done: "“Ah. Now the names are names again, and not ants.”" },
    ],
    goods: ["a page of the ledger, copied clean", "a court brush", "a weight from the soul scales", "a sealed judgement", "a bottle of court ink"],
    tales: [
      "“King Yama? You met him? Is he… fair? Tell me he's fair.”",
      "“Somebody changing the years in the book of life and death? That explains my uncle. Ninety-six and still horrible.”",
      "“A mirror that shows you everything you did. I'd keep my eyes shut, I think.”",
      "“A cultivator who went down to the underworld and decided he liked it better. …Every sect has one of those.”",
    ],
    patron: ["Every page is a life. Some are short. That is not the same as unfinished.", "I do not hate the wicked. I weigh them. Hate is too light to weigh.", "Your page is very busy, Lin Yue. Try not to make it busier than it has to be."],
    guide: ["Judgement is slow because it must be. Anyone who judges fast is writing fiction.", "The red ink is for the end of a life. I've used a great deal of it. I still don't like it.", "When this is done I'd like to take a holiday. I've never taken one. Do the living have holidays?"],
    boss: {
      intro: "Mo Xie, the False King of the Tenth Court, rises from his throne with the wet brush in his hand and the untitled ledger open on his arm",
      words: [
        ["sp-boss", "I only fixed it. Five hundred years I read this book and watched it be unfair. The kind die young. The cruel live long. I made it right. A little at a time."],
        ["hero", "You stole their deaths and their lives. And the soup, to make them forget you'd done it."],
        ["sp-boss", "And who'll write you, little cultivator? I've been saving your page. I have such plans for your page."],
      ],
      fates: [
        { heart: "mercy", label: "Let him live again, as a mortal", line: "She asks King Yama to let Mo Xie drink the soup and be reborn, as anyone, anywhere. He drinks. He forgets. Somewhere on the mainland, a baby cries." },
        { heart: "sword", label: "Break the false brush", line: "She snaps the brush that rewrote the years, and the ink runs out of every line it ever wrote. The ledger is true again." },
        { heart: "balance", label: "Give him to the Ten Courts' judgement", line: "She gives the false king to the ten courts, all ten, to be judged by the book he changed. It will take them a long time. They are in no hurry." },
        { heart: "slaughter", label: "Strike his own name from the ledger", line: "She takes the wet brush and strikes out the name Mo Xie. He does not die. He was never there. Nobody remembers who she is talking about." },
      ],
      victory: "The ledger of life and death is true again. Up on the isles, the drowned fisherman's son comes home: not alive, but properly dead, to say goodbye to his mother on the Crescent Isle, and to cross.",
    },
  },
];
