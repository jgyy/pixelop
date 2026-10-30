import type { GameState } from "../engine/state";
import { CULT, shift } from "../engine/cultivation";
import type { Beat, Fate } from "./hallsBooks";

/**
 * The words of the City of Nine Tiers (story/tiers.ts composes the quests):
 * ten books, one for each tier and the summit. Each is a tale of its own
 * told in hand-written beats, and between the beats the business of the
 * tier: its patron's petitions, Ah Lou's word, the warden at the gate, the
 * registry, errands abroad, bouts in the Stair Ring and long sittings.
 *
 * Under all ten runs one question: what a realm makes a person worth. The
 * city has an answer carved at the foot of its avenue. Lin Yue's own realm
 * changes how every tier speaks to her, and lines may name it: {title} is
 * what a mortal calls her, {peer} what a cultivator calls her, {realm} her
 * realm and stage, and {tier} the highest tier her tablet opens.
 *
 * Keys: "tj-ahlou" and "tj-wenqi" are whichever of them climbs with her on
 * this book's tier; "tj-warden" is the warden of this book's gate (the
 * weigher's, on the Mud Tier); "tj-boss" is this book's trouble.
 */

export interface TierBook {
  title: string;
  hanzi: string;
  /** The realm the book asks of her as it opens (an overall level index). */
  level: number;
  beats: Beat[];
  /** The tier patron's petitions (what is said when one is done). */
  petitions: string[];
  /** What Ah Lou has to say on this tier, between the beats. */
  ahlou: string[];
  boss: { intro: string; words: [string, string][]; fates: Fate[]; victory: string };
}

const feed = (by: number) => (g: GameState) => shift(g, CULT.demon, by);
const quiet = (by: number) => (g: GameState) => shift(g, CULT.demon, -by);
const purse = (by: number) => (g: GameState) => ({ ...g, stones: Math.max(0, g.stones + by) });

export const TIER_BOOKS: TierBook[] = [
  // ------------------------------------------------------------------------------------------------ I · the Mud Tier
  {
    title: "Weighed and Found Light",
    hanzi: "称骨",
    level: 2,
    beats: [
      {
        step: 0,
        npc: "tj-herald",
        title: "The Census of the Stair",
        objective: "A herald in yellow silk is reading a decree at Jinhe's south gate. Hear it.",
        lines: [
          { a: "tj-herald", n: "decree" },
          ["tj-herald", "By the edict of Gao Qiong, Sovereign of the Stair: every cultivator of the jianghu who would be known as one shall cross the Nine-Arch Bridge and be weighed at Tianjie, the City of Nine Tiers, and carry its tablet!"],
          ["tj-herald", "As a cultivator stands, so may she stand! Each realm its tier, each tier its gate! Below the gate, a word weighs what its speaker weighs!"],
          ["narr", "The crowd at the gate is mostly porters and fishwives. They listen to the decree the way people listen to weather."],
        ],
        after: [
          ["tj-herald", "You, {title} — you carry a sect's token. The city will want to weigh you. Over the bridge, through the strait of cloud. You cannot miss it: it is the only mountain that has stairs on the outside."],
        ],
        done: "He presses a slip of yellow paper into her hand: a summons to the Weighing Hall, with a blank where her realm will go.",
      },
      {
        step: 9,
        npc: "tj-warden",
        title: "The Weighing",
        objective: "Stand on the great steelyard of the Weighing Hall, in the flats west of the City of Nine Tiers.",
        lines: [
          ["narr", "The queue for the Weighing Hall runs out of the door and twice round the steelyard. Mortals stand at the back. Nobody told them to. They simply know."],
          ["tj-weigher", "Next. Onto the pan. Feet together. Do not breathe out your qi; the beam is not interested in your pride."],
          { a: "hero", n: "token" },
          { a: "tj-weigher", n: "weigh" },
          ["tj-weigher", "Bones of a girl of twenty. Qi of… {realm}. Hm. The beam says what the beam says."],
          ["tj-weigher", "Your tablet. Jade for cultivators, clay for the rest. It opens {tier}, and every tier below it. Lose it and you are clay."],
          ["narr", "When she steps off the pan, the mortals at the back of the queue go down on their knees to the tablet at her belt. Not to her. To the tablet."],
        ],
        done: "A jade tablet hangs at her belt, stamped with her realm. Behind her, the next man on the pan is a porter, and the beam hardly moves.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "The Porter Girl",
        objective: "A porter girl is being beaten at the foot of the avenue. Go to her.",
        lines: [
          ["narr", "At the foot of the avenue a girl of fourteen is down on the stones under a basket bigger than she is. A broad man in brown stands over her with a lash."],
          ["tj-boss", "Dropped it. Dropped the Silver Tier's porcelain on the Mud Tier's stones. What's a cup worth, mud? More than you. Say it."],
          ["tj-ahlou", "…More than me."],
        ],
        choice: {
          prompt: "Overseer Kuang raises the lash again.",
          options: [
            { heart: "mercy", label: "Kneel down and pick up the shards with her", then: "She kneels on the mud beside the girl and gathers porcelain. The overseer stares: a jade tablet, on its knees in the mud.", reply: ["tj-boss", "…Cultivators. You never understand the stair. Get up, {title}, before someone sees you."], effect: quiet(3) },
            { heart: "sword", label: "Catch the lash", then: "She catches the lash in her fist. It stops as if it had struck a wall.", reply: ["tj-boss", "Touch an officer of the Stair and you'll be weighed again, {title}. Heavier, this time. I'll remember your tablet."] },
            { heart: "balance", label: "Pay for the cup", then: "She counts spirit stones into the overseer's palm until he stops looking at the girl.", reply: ["tj-boss", "Paid in full. You see, mud? Everything's a price. Her tablet's price is higher than yours, that's all."], effect: purse(-20) },
            { heart: "slaughter", label: "Break his wrist", then: "Bone snaps. The overseer sits down on the stones, white-faced, cradling his arm.", reply: ["tj-boss", "You'll pay for that. Not you. Her. They always make the mud pay."], effect: feed(3) },
          ],
        },
        after: [
          ["tj-ahlou", "I'm Ah Lou. Basket-porter. Don't do that again, {title}. You go home tonight. I live here."],
          ["tj-ahlou", "…But thank you."],
        ],
        done: "Ah Lou picks up her basket and goes on up the avenue as far as the first gate, and no further.",
      },
      {
        step: 27,
        npc: "tj-mudgran",
        title: "Granny Pot",
        objective: "Ah Lou says to ask Granny Pot about the spring weighing. She keeps the soup on the Mud Tier.",
        lines: [
          ["tj-mudgran", "Sit. Eat. Everybody who comes down here gets soup, tablet or no tablet. That's the only law on the Mud Tier."],
          ["tj-mudgran", "The spring weighing? Every spring they weigh us. Bones and years. The heavy go back to carrying. The light go to the sleeping house. They don't wake."],
          ["hero", "They die?"],
          ["tj-mudgran", "They sleep. Sleeping isn't dying, the Weigher says. It's resting. For the stair. My husband's been resting eleven years."],
        ],
        done: "The soup is thin and very hot, and Granny Pot will not take a spirit stone for it.",
      },
      {
        step: 36,
        npc: "tj-wenqi",
        title: "The Registrar's Ledger",
        objective: "A young registrar in grey has been following you at a distance. Speak to him.",
        lines: [
          ["tj-wenqi", "Forgive me, {title}. Registrar Wen Qi, of the Registry of Heaven's Stair. I stamp the tablets. I am — I am not supposed to show anyone this."],
          ["narr", "He opens a ledger. The spring weighings, year by year. The number sent to the sleeping house rises every year, a little, like water behind a dam."],
          ["tj-wenqi", "Fifty, a century ago. Two hundred last spring. And the ledger has a second column. 'Years credited.' Credited to what, the column does not say."],
          ["tj-wenqi", "I am Foundation Establishment. A Silver tablet. I am supposed to believe the stair is just. I would like someone above me to tell me it is."],
        ],
        done: "Wen Qi closes the ledger and walks away very fast, the way people walk when they have done something brave for the first time.",
      },
      {
        step: 45,
        npc: "tj-ahlou",
        title: "The Sleeping House",
        objective: "Ah Lou will take you to the sleeping house, where her father lies.",
        lines: [
          ["narr", "A long low shed of clay. Two hundred pallets. Two hundred sleepers, breathing very slowly, very cold."],
          ["tj-ahlou", "That's him. Lou Shan. He carried the Gold Tier's bells up the stair when I was small. All nine. On his back. They weighed him light."],
          { a: "hero", n: "comprehend" },
          ["narr", "She lays two fingers on his wrist. His life is not leaving him. It is being drawn: a thin thread of years, running up out of the shed and away up the mountain, toward the summit."],
          ["hero", "Something is drinking from him, Ah Lou. From all of them. Something up there."],
        ],
        done: "Ah Lou tucks her father's blanket in again, though it was already tucked, and does not cry.",
      },
      {
        step: 58,
        npc: "tj-mudgran",
        title: "The Porters' Strike",
        objective: "The Mud Tier's porters have set down their baskets at the foot of the avenue. Granny Pot asks you to come.",
        lines: [
          ["narr", "Three hundred baskets on the stones. Nothing going up the stair. On the Silver Tier, they will run out of fresh water by noon."],
          ["tj-mudgran", "No more weighing until they wake the sleepers. That's what we're asking. They'll send the overseer. They'll send worse."],
        ],
        choice: {
          prompt: "Three hundred porters look at the jade tablet at your belt.",
          options: [
            { heart: "mercy", label: "Carry water up the stair yourself, so nobody up there goes thirsty", then: "She takes up a yoke and carries water to the Silver Tier, and the porters' strike holds, and nobody can say the mud let a child go thirsty.", reply: ["tj-mudgran", "A cultivator carrying for the mud. They'll talk about that up there. Good."], effect: quiet(3) },
            { heart: "sword", label: "Stand at the foot of the avenue with them", then: "She stands in the front row, her tablet in plain sight. The overseer's men come down the avenue, see it, and go back up.", reply: ["tj-mudgran", "Your tablet's a wall, {title}. Stand there as long as you can."] },
            { heart: "balance", label: "Take their demands up to the Registry", then: "She carries the porters' list to the Registry in Wen Qi's hand, and the Registry, startled, promises to read it.", reply: ["tj-mudgran", "Promises. Well. Up there, a promise from a jade tablet is worth something. Down here we'll wait and see."] },
            { heart: "slaughter", label: "Tell them to burn the first gate", then: "The gate burns for an hour. The seal behind it does not even flicker. The next morning, eleven porters are taken to be weighed out of season.", reply: ["tj-mudgran", "Eleven. Eleven, for a fire that didn't scorch the seal. Go home, {title}. Go home."], effect: feed(4) },
          ],
        },
        done: "The strike holds for three days. On the fourth, the Weighing Hall opens for an out-of-season weighing.",
      },
      {
        step: 67,
        npc: "tj-ahlou",
        title: "The One Who Climbed",
        objective: "Ah Lou wants to tell you something, by the first gate.",
        lines: [
          ["tj-ahlou", "My mother's up there. Somewhere. She had a spirit root. She broke through when I was four and they gave her a copper tablet, and she went up the stair, and she didn't come down."],
          ["tj-ahlou", "Father said she'd come back for us when she was high enough. He said that every spring until he went to sleep."],
          ["tj-ahlou", "I don't want her to come back. I want to know how high is high enough."],
        ],
        done: "Ah Lou doesn't look up the avenue for the rest of the day. Lin Yue does.",
      },
      {
        step: 76,
        npc: "tj-warden",
        title: "A Warning on the Scale",
        objective: "Weigher Bai Gu has sent for you.",
        lines: [
          ["tj-weigher", "I weighed you once, {title}. The beam said {realm}. Now it says more. Every time you climb, you weigh more, and the stair notices."],
          ["tj-weigher", "I have weighed eleven thousand souls. I know what the second column of the ledger means. I do not say it. I am the Weigher. The Weigher says what the beam says."],
          ["tj-weigher", "But I will tell you this, because you weigh more than I do now: the overseer takes a tithe of every sleeper for himself. He was clay once. He is very afraid of being clay again."],
        ],
        done: "Bai Gu goes back to his steelyard. His hands, on the beam, are shaking.",
      },
      {
        step: 85,
        npc: "tj-wenqi",
        title: "The Overseer's Years",
        objective: "Wen Qi has found the overseer's name in the second column.",
        lines: [
          ["tj-wenqi", "Kuang. Overseer of the Mud Tier. Born on the Mud Tier fifty years ago. Qi Condensation at twenty. He should be an old man."],
          ["tj-wenqi", "He has forty-one years credited. Forty-one sleepers' years, poured into a man who used to carry baskets."],
          ["tj-wenqi", "If I take this to the Registry, the Registry will thank me and burn it. He is an officer. I am a clerk. You are… you are the only person I know whose tablet nobody here can wave away."],
        ],
        done: "Wen Qi gives her the page. It is warm from being held so long.",
      },
      {
        step: 98,
        npc: "tj-ahlou",
        title: "The Out-of-Season Weighing",
        objective: "Overseer Kuang is dragging sleepers to the Weighing Hall. Ah Lou's father among them. Go.",
        lines: [
          ["narr", "They are carrying the sleepers out of the shed on doors, on ladders, on porters' baskets. Ah Lou is clinging to her father's pallet."],
          ["tj-ahlou", "{title}! They're taking them all! He says the stair is hungry!"],
        ],
        done: "The sleepers are laid down in the flats. The overseer turns to face her across them.",
      },
    ],
    petitions: [
      "“The well rope's broken again. Thank you, {title}. Cultivators' hands don't blister. Ours do.”",
      "“You carried the old man's basket to the first gate? He'll talk about it till he's weighed.”",
      "“Soup for the shed. They can't eat it. We set it down by them anyway. It's the smell that matters.”",
      "“The children want to see your tablet. Just to see it. Thank you. They've never seen jade.”",
      "“A word with the Copper Tier's fence about the price of rice? Your word weighs more than ours, {title}. That's the only reason I asked.”",
    ],
    ahlou: [
      "Mud Tier rule: carry what you're given, don't look up, and never drop the porcelain.",
      "I carried a Gold Tier lady's mirror up nine gates once. She looked in it the whole way. She never once looked at me.",
      "You've got a jade tablet and you eat Granny's soup. People are talking.",
      "When I'm big I'm going to carry something up the stair that nobody up there wants. I don't know what yet.",
    ],
    boss: {
      intro: "Overseer Kuang plants his feet among the sleepers, lash in one hand, the out-of-season summons in the other",
      words: [
        ["tj-boss", "You think I don't know what the stair is? I was clay. I carried. I was weighed and I was heavy, and I was heavy every spring because I took a little from the light ones. That's how you stay heavy, {title}."],
        ["tj-boss", "Your tablet says {realm}. Mine says Qi Condensation. Up there, you outrank me. Down here — down here, it's my mud."],
      ],
      fates: [
        { heart: "mercy", label: "Weigh him on his own scale, and send him to carry baskets", line: "She sets him on the great steelyard. The beam, freed of forty-one stolen years, hardly moves. Bai Gu reads it out to the whole Mud Tier. The next morning Kuang is carrying baskets, and the porters let him carry the heaviest." },
        { heart: "sword", label: "Break the lash, and his cultivation with it", line: "She snaps the lash across her knee and touches two fingers to his dantian. The stolen years go out of him like breath. He is an old man, sitting in the mud, and he knows it." },
        { heart: "balance", label: "Give him to the Registry, with Wen Qi's page", line: "Wen Qi reads the page aloud at the Registry's door, with Lin Yue's jade tablet beside him. The Registry, which would have burned a clerk's page, cannot burn a page a cultivator of her tablet stands behind. Kuang is taken up the stair in chains." },
        { heart: "slaughter", label: "Kill him among the sleepers", line: "He dies on the stones. The forty-one years go out of him in a cold grey breath, and none of them go back where they came from." },
      ],
      victory: "The sleepers lie in the flats under the open sky. None of them wake. But the thread of years running up the mountain from the Mud Tier is, for the first time in a hundred years, a little thinner.",
    },
  },
  // ------------------------------------------------------------------------------------------------ II · the Copper Tier
  {
    title: "The Debt of Copper",
    hanzi: "铜债",
    level: 4,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Copper Gate",
        objective: "Climb the avenue to the Copper Gate. Its warden will look at your tablet.",
        lines: [
          ["narr", "The seal over the first stair is a curtain of gold light. When she lifts her jade tablet to it, the light parts like a bead curtain. Ah Lou, a step behind her with her basket, stops dead."],
          ["tj-warden", "Foundation tablet. Pass, {peer}. The porter stays. Clay does not climb."],
          ["tj-ahlou", "It's all right. I'll wait. I always wait."],
        ],
        choice: {
          prompt: "Under the Stair Code, a cultivator may vouch for a mortal to climb as her bearer.",
          options: [
            { heart: "mercy", label: "“She is my bearer. I vouch for her.”", then: "She says it formally, the way Wen Qi showed her. The warden writes Ah Lou's name in a book, below Lin Yue's, in smaller letters.", reply: ["tj-ahlou", "…I've never been above the first gate. Is it — is it different?"] },
            { heart: "balance", label: "“She carries for me. The Code allows it.”", then: "The warden checks the Code, and the Code allows it, and that is that.", reply: ["tj-ahlou", "The Code allows it. Huh. I didn't know the Code allowed anything."] },
            { heart: "sword", label: "Walk through and hold the light open for her", then: "She stands in the seal and holds it parted with her own qi until Ah Lou has stepped through. The warden says nothing. His hands are on his spear.", reply: ["tj-ahlou", "You didn't ask him. You just did it. Are you allowed?"] },
            { heart: "slaughter", label: "Tell him what happens to wardens who refuse her", then: "She tells him, in some detail. The warden writes Ah Lou's name in the book with a shaking hand.", reply: ["tj-ahlou", "He was scared. Of you. I didn't like that as much as I thought I would."], effect: feed(2) },
          ],
        },
        done: "Ah Lou climbs the first stair for the first time in her life, and stands on copper, and holds very tightly to her basket.",
      },
      {
        step: 9,
        npc: "tj-bellows",
        title: "Bellows Hua",
        objective: "On the Copper Tier, a woman smith is working a forge by herself. Speak to her.",
        lines: [
          ["tj-bellows", "Copper tablet. Qi Condensation, late stage. Bonded to the Copper Guild for eleven years. That's my whole life in three sentences, {peer}, so save yourself asking."],
          ["tj-bellows", "Everyone here broke through on a borrowed pill. The Guild lends you the pill, you break through, and you climb a tier. Then you pay it back."],
          ["hero", "In stones?"],
          ["tj-bellows", "In years. The Guild doesn't want stones. Nobody up here wants stones."],
        ],
        done: "Bellows Hua goes back to her forge. Every stroke of the hammer she counts under her breath, the way the Mud Tier counts its sleepers.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "Mud on Copper",
        objective: "Ah Lou is standing very still on the Copper Tier. Go to her.",
        lines: [
          ["narr", "A Copper-Tier child has stopped in front of Ah Lou and is pointing at her clay tablet."],
          ["narr", "“Mud,” the child says. Not unkindly. The way you'd name a bird."],
          ["tj-ahlou", "It's true. I am. I just didn't know it showed so much up here."],
        ],
        done: "Ah Lou turns her clay tablet round on its cord so that the blank side faces out.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "Pills Priced in Years",
        objective: "Wen Qi has copied the Copper Guild's price list.",
        lines: [
          ["tj-wenqi", "Qi Gathering Pill, one year. Foundation Pill, seven years. A pill to break the Core Formation bottleneck, thirty."],
          ["tj-wenqi", "The years come out of the borrower slowly. Grey hair at twenty-five. A cough at thirty. And the years go… up. To the Silver Tier, the ledger says. And then the ledger stops saying."],
          ["tj-wenqi", "Your sect gave you pills for free, {peer}? …I can see from your face that it did. Hold on to that sect."],
        ],
        done: "Wen Qi files the copy in a drawer that locks, and then, after a moment, in his sleeve.",
      },
      {
        step: 36,
        npc: "tj-bellows",
        title: "The Apprentice",
        objective: "Bellows Hua's forge has gone quiet. Go and see why.",
        lines: [
          ["narr", "Her apprentice is lying by the cold forge. Seventeen. He took a second pill before the first had settled, to break through faster, to pay his debt faster. His qi ran wild."],
          ["tj-bellows", "He wanted to be heavy enough not to owe anyone. That's all he wanted."],
          { a: "hero", n: "bandage" },
          ["narr", "She steadies his meridians with her own qi until the wild current eases. He will live. He will never break through again."],
        ],
        done: "Bellows Hua lights the forge again. She works through the night, because the debt doesn't sleep.",
      },
      {
        step: 45,
        npc: "tj-bellows",
        title: "Hua's Bottleneck",
        objective: "Bellows Hua asks you for something she shouldn't.",
        lines: [
          ["tj-bellows", "I'm at the peak of Qi Condensation. If I break through, I'm Foundation, Silver Tier, and my debt is renegotiated at Silver rates. Halved. The Guild's own rule."],
          ["tj-bellows", "You're above me, {peer}. A senior can guide a junior through a bottleneck. It's dangerous. It's done."],
        ],
        choice: {
          prompt: "Bellows Hua asks you to force her breakthrough.",
          options: [
            { heart: "mercy", label: "Teach her to break through slowly, with no pill at all", then: "It takes her a month of sitting, and she curses every day of it, and on the last day she breaks through clean.", reply: ["tj-bellows", "No pill. No debt. I didn't know that was allowed. I didn't know anything was allowed."], effect: quiet(3) },
            { heart: "sword", label: "Force the bottleneck open with your own qi", then: "She drives her qi through Hua's meridians like a blade through a knot. Hua screams, and breaks through, and bleeds from the nose for an hour.", reply: ["tj-bellows", "Foundation. Silver tablet. Debt halved. Ow. Thank you. Ow."] },
            { heart: "balance", label: "Tell her the truth: the Guild will raise the Silver rate", then: "She shows Hua Wen Qi's copy. The Silver rate is double the Copper.", reply: ["tj-bellows", "So climbing makes it worse. Of course it does. Of course."] },
            { heart: "slaughter", label: "Offer to kill her creditors instead", then: "Hua looks at her for a long time.", reply: ["tj-bellows", "…No. They'd only send more. And then they'd send them to me."], effect: feed(2) },
          ],
        },
        done: "Whatever Bellows Hua's tablet says now, her forge burns on through the night.",
      },
      {
        step: 58,
        npc: "tj-ahlou",
        title: "Carrying for the Copper Children",
        objective: "Ah Lou has been carrying for the Copper Tier's children. She wants you to see.",
        lines: [
          ["narr", "A dozen Copper-Tier children, sitting on the stairs, sharing a basket of dried persimmons Ah Lou carried up from the Mud Tier."],
          ["tj-ahlou", "They're bonded too. Their parents' debts. A child inherits the debt with the tablet. They didn't tell us that on the Mud Tier. We thought copper was rich."],
          ["tj-ahlou", "The one who called me mud gave me his persimmon. So."],
        ],
        done: "The children turn their tablets round on their cords, blank side out, the way Ah Lou does.",
      },
      {
        step: 67,
        npc: "tj-wenqi",
        title: "Where the Copper Goes",
        objective: "Wen Qi has followed the Copper Guild's years up a tier.",
        lines: [
          ["tj-wenqi", "The Guild pays the Silver Tier, which pays the Jade Tier, which pays the Gold. Each takes its tithe. By the Violet Tier the years have a new name: 'contributions to the Array'."],
          ["tj-wenqi", "The Stair Array. It holds the city up. Every tier rests on the one below, and every tier pays the one above. The Mud Tier holds up everything and pays the most."],
          ["tj-wenqi", "It is a very beautiful formation, {peer}. I have seen the diagrams. It is the most beautiful thing I have ever seen. I want to be sick."],
        ],
        done: "Wen Qi sits on the stairs with the Copper children for a while, and nobody asks him for his tablet.",
      },
      {
        step: 76,
        npc: "tj-bellows",
        title: "The Smiths Down Tools",
        objective: "The Copper Tier's smiths have banked their forges. Bellows Hua asks you to stand with them.",
        lines: [
          ["narr", "Every forge on the tier is cold. The Copper Guild's debt-clerks walk the rows with their abacuses, writing down the names of the cold forges."],
          ["tj-bellows", "Guildmaster Tong says every hour a forge is cold is an hour added to its smith's debt. We've worked out that we'll all owe him a hundred years by next spring. So we might as well rest."],
        ],
        done: "The forges stay cold. The Guild's clerks write and write. Somewhere above, a bell the Copper Tier forged rings out of tune.",
      },
      {
        step: 85,
        npc: "tj-ahlou",
        title: "Burn the Ledgers",
        objective: "Ah Lou has a lamp and a look in her eye.",
        lines: [
          ["tj-ahlou", "If there's no ledger, there's no debt. That's simple. That's mud sense."],
          ["hero", "There are copies. Wen Qi has copies. The Registry has copies of the copies."],
          ["tj-ahlou", "…Then I'll need a bigger lamp."],
        ],
        done: "Lin Yue takes the lamp from her gently. Ah Lou lets her. Neither of them blows it out.",
      },
      {
        step: 98,
        npc: "tj-bellows",
        title: "The Debts Called In",
        objective: "Guildmaster Tong has come to call in every debt on the Copper Tier at once. Go to Bellows Hua.",
        lines: [
          ["narr", "The Guildmaster walks down the row of cold forges with an abacus the size of a door, and at every forge he stops and the smith beside it ages a year."],
          ["tj-bellows", "{peer}! He's calling them all in! Every year we owe, now!"],
        ],
        done: "Guildmaster Tong's abacus clicks. He turns to her.",
      },
    ],
    petitions: [
      "“A hinge for the Silver Tier's door, forged and carried. Thank you, {peer}. They pay late. They always pay late.”",
      "“You talked the debt-clerk down a month? On the Copper Tier, a month is a lot of hair.”",
      "“Bellows charcoal from the Mud Tier, carried up. Ah Lou carried half. Don't tell the Guild.”",
      "“The boy's meridians are calmer since you sat with him. He asks after you. He calls you {peer}. He means it.”",
      "“A blade for a hired sword, tempered right. He'll die anyway, the way they work them. But not because of my blade.”",
    ],
    ahlou: [
      "Copper smells like blood and money. Mostly money.",
      "They work all night up here. On the Mud Tier we at least sleep. Until we sleep for good.",
      "Bellows Hua lets me pump the bellows. I'm good at it. She says I've got porter's lungs.",
      "If my mother climbed, she climbed through here. Maybe she owed the Guild too. Maybe she still does.",
    ],
    boss: {
      intro: "Guildmaster Tong sets down his great abacus in the middle of the Copper Tier and cracks his knuckles",
      words: [
        ["tj-boss", "A debt is a promise, {peer}. The whole city is a tower of promises. Pull one out and the tower falls on everyone, the mud first."],
        ["tj-boss", "I'll tell you what you're worth. Your tablet says {realm}. At Copper rates, that's a great many years. Shall I write them down?"],
      ],
      fates: [
        { heart: "mercy", label: "Forgive the debts, and make him watch", line: "She breaks the great abacus bead by bead, and Wen Qi reads each smith's name as it goes. Tong weeps, not for the years but for the ledger. The smiths light their forges again for no one." },
        { heart: "sword", label: "Break his abacus and his hand that held it", line: "The abacus splits down its frame. His right hand will never hold a pen again. The debts are still written somewhere. But nobody on the Copper Tier can find the man who can collect them." },
        { heart: "balance", label: "Make him renegotiate every debt at mortal rates", line: "Under the Code, the higher realm sets the terms. She sets them: stones, not years, at the price a Mud Tier porter would pay. Tong signs, because a tablet higher than his own is standing over the paper." },
        { heart: "slaughter", label: "Collect his years, as he collected theirs", line: "She takes everything the abacus ever counted out of him. What is left is very small and very old and very quiet." },
      ],
      victory: "The forges of the Copper Tier light one by one, and for the first time anyone can remember, nobody is counting the strokes of the hammer.",
    },
  },
  // ------------------------------------------------------------------------------------------------ III · the Silver Tier
  {
    title: "The Forged Tablet",
    hanzi: "假牌",
    level: 6,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Silver Gate",
        objective: "Climb to the Silver Gate and show your tablet.",
        lines: [
          ["tj-warden", "Foundation tablet, late stage. Pass, {peer}. Your bearer's name is already in the book. The Copper Gate sent word. You are… talked about."],
          ["narr", "The Silver Tier is a street of shophouses two storeys high, with balconies over the lane and banners in every window. Everything is for sale, and the price is written on the buyer's tablet."],
        ],
        done: "On the Silver Tier, the shopkeepers read her tablet before they read her face, and their prices change while she watches.",
      },
      {
        step: 9,
        npc: "tj-forger",
        title: "Faceless Liu",
        objective: "Ah Lou has heard of a woman who sells tablets in the back lanes of the Silver Tier. Find her.",
        lines: [
          ["narr", "A narrow room above a shop. Rows of blank jade on a table, and an old woman with ink to the wrists carving tiny characters with a needle."],
          ["tj-forger", "Close the door, {peer}. I know your tablet's real. I can tell from across the room; real ones are a little too sure of themselves."],
          ["tj-forger", "I make Silver tablets for mortal children. A Silver tablet opens the free school and the free physician. A clay one opens the sleeping house. The arithmetic isn't difficult."],
        ],
        done: "Faceless Liu goes on carving. The child on the stool beside her is from the Mud Tier, and is learning her own name on a tablet that says she is Foundation Establishment.",
      },
      {
        step: 18,
        npc: "tj-patron",
        title: "The Auction of Tablets",
        objective: "On the fifteenth, the Silver Tier auctions tablets. Faceless Liu wants you to see it.",
        lines: [
          ["narr", "Under the great balconies of the auction house, a Gold Tier tablet is held up to the crowd. 'Core Formation, early stage. Bloodline Jin. Lot forty.'"],
          ["narr", "The bidding is in years. A merchant bids twenty of his own. A clan bids two hundred of other people's."],
          ["tj-forger", "That one will hang from a boy who has never sat at a shrine in his life. He'll climb four tiers on it. Nobody calls that forgery. Forgery is when the poor do it."],
        ],
        done: "Lot forty goes to the Jin clan for two hundred and six years, paid in porters.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "Threads of the Array",
        objective: "Wen Qi has discovered what a tablet really is.",
        lines: [
          ["tj-wenqi", "Every tablet I stamp is tied to the Stair Array by a thread of qi. That's how the seals know who may pass. That's how the Array knows who to draw from."],
          ["tj-wenqi", "A clay tablet's thread runs one way: out. A jade tablet's thread runs in. The higher the tablet, the more runs in."],
          ["tj-wenqi", "I have been stamping them for six years, {peer}. Every tablet I stamped, I tied someone to that."],
          { a: "tj-wenqi", n: "kneel" },
        ],
        done: "Wen Qi sits on the floor of the Registry among his stamps until it is dark.",
      },
      {
        step: 36,
        npc: "tj-forger",
        title: "The Inquisitor's Eye",
        objective: "Inquisitor Sima is going door to door on the Silver Tier. Warn Faceless Liu.",
        lines: [
          ["narr", "A tall figure in silver, with a white lacquer mask, is checking tablets in the street. He holds each to his eye. Some he hands back. Some he snaps in two, and the person whose tablet it was is led away to the Mud Tier."],
          ["tj-forger", "Sima. He can feel a forged thread. He has felt fourteen of mine this month. Fourteen children back in the mud."],
        ],
        done: "Faceless Liu packs her needles into a sleeve and her blanks into a rice sack.",
      },
      {
        step: 45,
        npc: "tj-forger",
        title: "Forger or Thief",
        objective: "Faceless Liu needs a decision from you.",
        lines: [
          ["tj-forger", "I need a real thread, {peer}. One real jade thread to copy, and my tablets will pass the Inquisitor's eye. Yours."],
          ["tj-forger", "It won't hurt you. It might hurt the Array. That's rather the point."],
        ],
        choice: {
          prompt: "Faceless Liu holds out a blank tablet to copy your thread into.",
          options: [
            { heart: "mercy", label: "Give her your thread", then: "She presses her tablet to the blank. Something passes between them, warm, like a hand on a cold hand.", reply: ["tj-forger", "There. Every child I carve for now has a little of you on her belt. Don't be offended if they start calling you aunt."], effect: quiet(3) },
            { heart: "balance", label: "Give her your thread, but only for children", then: "She makes Liu swear: only for children, only for the school and the physician. Liu swears with ink on her hands.", reply: ["tj-forger", "Only for children. Fine. It's who I carve for anyway. The grown-ups have to take their chances."] },
            { heart: "sword", label: "Refuse: forge the Array's undoing, not its tablets", then: "“A better forgery is still a thread into the Array,” she says. Liu looks at her a long time.", reply: ["tj-forger", "You want to cut the rope, not copy it. Hah. All right, {peer}. I'll help you find the rope."] },
            { heart: "slaughter", label: "Give her your thread, and a name: the Inquisitor's", then: "She gives her thread, and the name, and where he sleeps.", reply: ["tj-forger", "I'm a forger, {peer}. Not a murderer. …Leave the name with me. I'll think about it."], effect: feed(2) },
          ],
        },
        done: "Faceless Liu blows on the blank tablet to cool it. Whatever it now carries, it is warm.",
      },
      {
        step: 58,
        npc: "tj-ahlou",
        title: "A Silver Tablet for Ah Lou",
        objective: "Faceless Liu has made Ah Lou a tablet. Ah Lou doesn't know what to do with it.",
        lines: [
          ["narr", "A Silver tablet, Foundation Establishment, carved with Ah Lou's name in a very fine hand. She holds it in two fingers, as if it might burn."],
          ["tj-ahlou", "If I wear this I can go to the free school. I can see the physician about my cough. Nobody will call me mud."],
          ["tj-ahlou", "If I wear this, I'm saying the stair's right. That people like me are worth less until somebody carves us better."],
        ],
        choice: {
          prompt: "Ah Lou asks what you would do.",
          options: [
            { heart: "mercy", label: "“Wear it. Get the cough seen to. You can be angry and well.”", then: "Ah Lou puts it on. The cough is seen to. She stays angry.", reply: ["tj-ahlou", "It's heavy. Heavier than clay. That's not a good sign, is it?"] },
            { heart: "sword", label: "“Don't. Stand as you are. Make them look at you.”", then: "Ah Lou gives it back to Liu, who keeps it in her sleeve, in case.", reply: ["tj-ahlou", "Clay. Fine. If they want to step on me they'll have to look down."] },
            { heart: "balance", label: "“Keep it in your pocket. Wear it when you need it.”", then: "Ah Lou ties it inside her jacket, next to the clay one.", reply: ["tj-ahlou", "Two tablets. One for the stair and one for me. That's how the merchants do it, I bet."] },
            { heart: "slaughter", label: "“Wear it, and make them pay for every time they called you mud.”", then: "Ah Lou wears it on the outside. On the Silver Tier, a merchant who once spat at her bows to her, and she laughs in his face.", reply: ["tj-ahlou", "That felt good. That felt… I don't like that it felt good."], effect: feed(1) },
          ],
        },
        done: "Whatever Ah Lou wears, she climbs the next stair beside Lin Yue, and the seal parts for both of them.",
      },
      {
        step: 67,
        npc: "tj-forger",
        title: "Why Liu Carves",
        objective: "Faceless Liu is sitting on the balcony above her shop. Sit with her.",
        lines: [
          ["tj-forger", "I was a Silver merchant. Real tablet. A daughter with no spirit root — clay, by the law. I paid the Registry to look away for twelve years."],
          ["tj-forger", "The year I couldn't pay, they weighed her. She was light. She was always so light, {peer}. She weighed nothing at all."],
          ["tj-forger", "So now I carve. Every child I carve for is a little heavier than she was."],
        ],
        done: "The lanterns on the balcony swing in the evening wind. Liu does not light them.",
      },
      {
        step: 76,
        npc: "tj-wenqi",
        title: "Years Credited to Wen Qi",
        objective: "Wen Qi has found his own name in the second column.",
        lines: [
          ["tj-wenqi", "Wen Qi. Registrar. Silver. Years credited: three. I never asked for them. I never knew. Every clerk of the Registry gets a little, 'for service'."],
          ["tj-wenqi", "Three years. Three springs of somebody's life. I'm twenty-six and I might live to be eighty-nine, and three of those years were a porter's."],
          ["tj-wenqi", "I want to give them back. I don't know how. I don't know whose they were."],
        ],
        done: "Wen Qi spends the night going through the sleeping house's names, one by one, trying to guess.",
      },
      {
        step: 85,
        npc: "tj-forger",
        title: "The Inquisitor Comes",
        objective: "Inquisitor Sima has found Faceless Liu's shop. Go.",
        lines: [
          ["narr", "The shop's door hangs off one hinge. Inside, the blanks are broken on the floor, every one, and the needles snapped."],
          ["tj-forger", "He took the children's tablets. All of them. He took them up the stair to the Registry. He'll read the threads, and find them, every one, and walk them back to the mud."],
        ],
        done: "Liu picks up one broken needle, and then another, and then sits among them.",
      },
      {
        step: 98,
        npc: "tj-forger",
        title: "Every Thread Read",
        objective: "Inquisitor Sima is reading the stolen tablets in the street, one child at a time. Stop him.",
        lines: [
          ["narr", "A queue of children in the street, a Silver tablet on each, and at the head of it the white mask, holding each tablet to its eye, snapping, snapping."],
        ],
        done: "The Inquisitor sets down the tablet in his hand, and turns his mask toward her tablet, and holds out his hand for it.",
      },
    ],
    petitions: [
      "“A blank of good jade from the Copper Tier, carried up in a rice sack. Thank you, {peer}. They search the baskets, not the cultivators.”",
      "“You read the child's tablet out to the physician in your voice. He listened. A Silver tablet in a Foundation voice: of course he listened.”",
      "“Ink from Jinhe. The Silver Tier's ink is watered. Everything up here is watered except the prices.”",
      "“A word with the free school's master about a new pupil. Your word, {peer}. Not mine. Mine's on a forger's tablet.”",
      "“You stood in the shop while the Inquisitor's men walked past. They saw your tablet and kept walking. That's all I needed.”",
    ],
    ahlou: [
      "Everything on the Silver Tier has a price on it. I looked for one on me. There wasn't one. I was almost disappointed.",
      "The balconies up here are full of people looking down. I've never been looked down on from so close.",
      "Faceless Liu says I've a good hand for carving. Porters' hands don't shake.",
      "My father carried the Silver Tier's water for twenty years. I asked a shopkeeper if he remembered him. He didn't. Of course he didn't.",
    ],
    boss: {
      intro: "Inquisitor Sima lifts his white mask a finger's width, so she can see his eyes are real",
      words: [
        ["tj-boss", "A forged thread is a lie told to heaven, {peer}. Heaven is very patient with liars. I am not."],
        ["tj-boss", "Your tablet reads true. {realm}. And yet there is a little of it in every forgery in that queue. Shall I read you too?"],
      ],
      fates: [
        { heart: "mercy", label: "Take off his mask, and give the children their tablets", line: "Under the mask is a tired man of forty with a clay-coloured birthmark across one cheek, the mark the Star Registry writes on mud-born charts. He watches her give back the tablets. He does not stop her." },
        { heart: "sword", label: "Break his eye's art, so he can never read a thread again", line: "She cuts the art out of his sight with one stroke of qi. He can see; he can no longer read. The queue scatters, every child with a tablet on its belt." },
        { heart: "balance", label: "Make him read every tablet on the Silver Tier, the real ones too", line: "He reads them all, at her word, in the street, aloud: the bought ones, the auctioned ones, the inherited ones. By nightfall the Silver Tier has learned how many of its tablets were forged by the rich." },
        { heart: "slaughter", label: "Snap him in two, as he snapped them", line: "She breaks the Inquisitor as he broke the tablets. The children run home with theirs. Some of them saw. All of them will remember." },
      ],
      victory: "Faceless Liu sets up her table again in the lane below the balconies, in the open, and the children of the Silver Tier queue for their names.",
    },
  },
  // ------------------------------------------------------------------------------------------------ IV · the Jade Tier
  {
    title: "The Red Thread",
    hanzi: "红线",
    level: 8,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Jade Gate",
        objective: "Climb to the Jade Gate, the first tier of the golden core.",
        lines: [
          ["tj-warden", "A golden core. Pass, {title} — forgive me. {peer}. On the Jade Tier we address golden cores as Venerable. The mortals will call you Ancestor before long."],
          ["narr", "The Jade Tier is academies and gardens and the long white walls of clan houses. A girl is playing a flute on a balcony above the lane, and stops when she sees Lin Yue's tablet."],
        ],
        done: "Above her the flute begins again, very carefully, the way people play when they know someone of standing is listening.",
      },
      {
        step: 9,
        npc: "tj-patron",
        title: "Su Wan",
        objective: "The girl with the flute has come down to the lane. She wants to speak to you.",
        lines: [
          ["tj-suwan", "Su Wan. Jade tablet, Foundation, middle stage. Third daughter of the Su clan. I'm to be married on the first of next month, {peer}."],
          ["tj-suwan", "To Elder Mei Shou of the Cloud Tier. He is a Nascent Soul. He is four hundred and sixty years old. If I marry him, my whole clan climbs a tier. A girl's marriage is a stair."],
          ["tj-suwan", "Madam Qiao arranged it. She arranges everything. She has a red thread for every daughter on the Jade Tier."],
        ],
        done: "Su Wan plays them a song afterwards. It's a wedding song. She plays it as if it were a funeral.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "The Academies",
        objective: "Ah Lou has sneaked into a Jade Tier academy lecture. Get her out before someone notices.",
        lines: [
          ["narr", "A hall of white-robed students. A master at the lectern: “And thus the higher the realm, the purer the heart. Virtue rises with cultivation as cream rises in milk.”"],
          ["tj-ahlou", "{title}! He says the mud is mud because our hearts are dirty. Is that true? Tell him he's wrong. He'll listen to your tablet."],
        ],
        choice: {
          prompt: "The master has seen your tablet, and stopped mid-sentence, and is waiting.",
          options: [
            { heart: "mercy", label: "Tell the students about Granny Pot's soup", then: "She tells them about a woman on the Mud Tier who feeds everyone who comes down, tablet or none. The students write it down. They do not know what else to do with it.", reply: ["tj-ahlou", "They wrote down Granny Pot. In a book. On the Jade Tier."] },
            { heart: "sword", label: "Tell the master he is wrong, in front of all of them", then: "“Your Nascent Soul elders eat porters' years,” she says. The master, a Core Formation like her, cannot contradict a word of equal weight in his own hall.", reply: ["tj-ahlou", "He went white. White as his robes. I'm keeping that forever."] },
            { heart: "balance", label: "Ask the master to weigh her heart and Ah Lou's", then: "The master holds his hand over both of them for a long time. Then he says, very quietly, that his art cannot tell them apart.", reply: ["tj-ahlou", "Can't tell us apart. A golden core and the mud. I'll take that."] },
            { heart: "slaughter", label: "Show them what a pure heart can do to a lectern", then: "The lectern is splinters. The students do not move.", reply: ["tj-ahlou", "I'd have liked it better if you'd just told him."], effect: feed(2) },
          ],
        },
        done: "That evening there are students in white robes on the Mud Tier, carrying soup.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "The Marriage Ledger",
        objective: "Wen Qi has found the Red Thread House's accounts.",
        lines: [
          ["tj-wenqi", "Every match Madam Qiao makes is registered: the bride's tier, the groom's, the 'dowry of years' the bride's clan pays the groom. The bride's years, {peer}."],
          ["tj-wenqi", "Elder Mei Shou has married eleven times. All Jade Tier girls. All Foundation. He has outlived every one of them by three centuries."],
        ],
        done: "Wen Qi files the accounts under 'M', for murder, and then crosses that out and files them under 'Marriage', which is what the Registry would call it.",
      },
      {
        step: 36,
        npc: "tj-patron",
        title: "The Lover on the Copper Tier",
        objective: "Su Wan asks you to carry a letter down to the Copper Tier.",
        lines: [
          ["tj-suwan", "His name is Hua Jun. Bellows Hua's brother. Qi Condensation. A smith. We met when he brought the academy its new bell."],
          ["tj-suwan", "We can't meet. A Jade daughter can't go below the Silver Gate without a bearer's pass, and he can't come above the Copper Gate at all."],
          ["tj-suwan", "You're above us both, {peer}. The gates open for you. Would you be our gate?"],
        ],
        done: "The letter is folded very small and smells of the plum blossom in the Jade gardens.",
      },
      {
        step: 45,
        npc: "tj-patron",
        title: "A Letter Each Way",
        objective: "Hua Jun's answer has come back. Give it to Su Wan.",
        lines: [
          ["tj-suwan", "He says he'll break through. He says he'll climb. He says he'll challenge Elder Mei Shou under the Code, a lower realm against a higher, once."],
          ["tj-suwan", "He's Qi Condensation. Mei Shou is Nascent Soul. He'll be dead before the first stroke."],
        ],
        choice: {
          prompt: "Su Wan asks what she should write back.",
          options: [
            { heart: "mercy", label: "“Tell him to live. That's the bravest thing he can do.”", then: "She writes it. Her hand shakes. She writes it again so it won't shake.", reply: ["tj-patron", "Live. Yes. I'll tell him to live. I'll tell myself the same."] },
            { heart: "sword", label: "“Tell him I'll stand beside him in the ring.”", then: "She writes it. Then she looks at Lin Yue's tablet and writes it again, bigger.", reply: ["tj-patron", "A golden core beside him. The Code doesn't say you can't. Nobody ever thought anyone would."] },
            { heart: "balance", label: "“Tell him the Code can be turned round: marriage needs the bride's consent.”", then: "Wen Qi finds the clause. It is very old and very small. Nobody has used it in two hundred years.", reply: ["tj-patron", "Consent. I can say no? …I can say no."] },
            { heart: "slaughter", label: "“Tell him there will be no one to challenge.”", then: "She writes nothing. She just looks at Lin Yue.", reply: ["tj-patron", "…I don't want anyone to die for me. Not even him. Not even Mei Shou."], effect: feed(2) },
          ],
        },
        done: "The letter goes down the stair in Ah Lou's basket, under the persimmons.",
      },
      {
        step: 58,
        npc: "tj-ahlou",
        title: "The Go-Betweens",
        objective: "Ah Lou has been watching Madam Qiao's go-betweens. She's found something.",
        lines: [
          ["tj-ahlou", "They don't just do marriages. They do mud girls too. 'Service contracts.' A clay girl goes up to a Jade house to serve, and her years go with her."],
          ["tj-ahlou", "Granny Pot's granddaughter went up two years ago. Nobody's heard from her. The go-between said she was 'very well placed'."],
        ],
        done: "Ah Lou writes the names of every girl she can remember on the back of a persimmon wrapper. There are a lot of names.",
      },
      {
        step: 67,
        npc: "tj-patron",
        title: "Madam Qiao Calls",
        objective: "Madam Qiao has come to the Su house. Su Wan asks you to be there.",
        lines: [
          ["narr", "Madam Qiao in red, a fan in one hand and a spool of red thread in the other. When she sees Lin Yue's tablet, she smiles very widely."],
          ["tj-boss", "A golden core! Unmarried! Oh, {peer}, what a match I could make for you. The Gold Tier. The Violet. With a tablet like yours, I could tie you to the Cloud Tier itself."],
          ["tj-boss", "Su Wan is spoken for, of course. A thread once tied is never cut."],
        ],
        done: "Madam Qiao leaves a red thread on the table as she goes, very neatly coiled, as a gift.",
      },
      {
        step: 76,
        npc: "tj-wenqi",
        title: "The Clause of Consent",
        objective: "Wen Qi has found the oldest clause of the Stair Code. Read it.",
        lines: [
          ["tj-wenqi", "“No bond shall be tied across the tiers without the word of the one bound.” It's in the first edition of the Code. The Sovereign's great-grandfather wrote it. Every later edition has it, in smaller and smaller letters."],
          ["tj-wenqi", "A bride's word weighs what her tablet weighs. Su Wan is Foundation. Madam Qiao is Core Formation. Her word outweighs Su Wan's. Unless…"],
          ["tj-wenqi", "Unless someone above them both stands beside the bride when she says it."],
        ],
        done: "Wen Qi copies the clause out in very large letters, on very good paper.",
      },
      {
        step: 85,
        npc: "tj-ahlou",
        title: "The Girl Who Went Up",
        objective: "Ah Lou has found Granny Pot's granddaughter. On the Cloud Tier. Go to her.",
        lines: [
          ["narr", "From the Jade Tier's highest garden you can see over the wall onto the Cloud Tier. A girl of sixteen is sweeping a terrace there. Her hair is grey."],
          ["tj-ahlou", "That's Little Pot. She's sixteen. Her hair's grey, {title}. Her hair's grey."],
        ],
        done: "Ah Lou does not cry. She folds the persimmon wrapper with the names on it and puts it inside her jacket, next to both tablets.",
      },
      {
        step: 98,
        npc: "tj-patron",
        title: "The Wedding Procession",
        objective: "Madam Qiao has come for Su Wan with a sedan chair and a red thread. Go.",
        lines: [
          ["narr", "Drums and gongs and a red sedan chair, and four bearers in red, and Madam Qiao in front with the thread already between her fingers."],
          ["tj-patron", "{peer}! I said no! I said it twice! She can't hear me. My word's too light."],
        ],
        done: "Madam Qiao turns. The red thread lifts off her spool by itself and hangs in the air between them.",
      },
    ],
    petitions: [
      "“A book of poems from Jinhe, for the academy library. Thank you, {peer}. The library only buys books written by Nascent Souls. This one's written by a porter.”",
      "“You sat in on a lecture and asked a question. The master is still trying to answer it.”",
      "“Plum blossom for the Su clan's altar, carried from the Copper Tier's one tree. Su Wan says it smells different down there. Truer.”",
      "“The zither teacher wants a student from below the Silver Gate. You vouched. Thank you. It's never been done.”",
      "“A red thread, cut. Don't tell Madam Qiao which girl's. She'll know. She always knows.”",
    ],
    ahlou: [
      "The Jade Tier's gardens are prettier than anything. The people in them look like they've swallowed something sour.",
      "A lady asked me if I was your bearer. I said yes. She asked how much you paid. I said, in soup.",
      "Su Wan let me hold her flute. I didn't play it. I just wanted to know what it weighed.",
      "Everyone up here talks about who's marrying who. Nobody talks about who's marrying who they want.",
    ],
    boss: {
      intro: "Madam Qiao spreads her red thread across the lane like a net",
      words: [
        ["tj-boss", "Every marriage I have made has lifted a clan, {peer}. Do you know how many daughters climbed a tier in my threads? Hundreds. You want to cut them all?"],
        ["tj-boss", "A Core Formation's word against a Core Formation's. Ours weigh the same. Then let us see whose thread is stronger."],
      ],
      fates: [
        { heart: "mercy", label: "Untie every thread she ever tied", line: "She draws the threads out of the air one by one, and each one, as it goes, lets a girl somewhere in the city look up from what she is doing. Madam Qiao sits down on the steps of the Su house with an empty spool." },
        { heart: "sword", label: "Cut her thread at the spool", line: "One stroke, and the spool falls apart. The bonds she tied still hold, but no new one ever will. Su Wan says no a third time, and this time the whole lane hears it." },
        { heart: "balance", label: "Stand beside Su Wan while she invokes the clause", line: "Su Wan reads the clause of consent aloud, with Lin Yue's tablet beside her, and the Red Thread House, by its own Code, cannot tie her. Madam Qiao bows, stiffly, and unties it herself." },
        { heart: "slaughter", label: "Tie her in her own thread, and leave her", line: "Madam Qiao hangs in red thread in the middle of the Jade Tier for a day and a night. Nobody cuts her down. Nobody who owes her a daughter, which is everybody." },
      ],
      victory: "On the first of the month there is no wedding on the Jade Tier. There is, a week later, a letter from the Copper Tier, which Su Wan reads on her balcony, and then plays a song that is not a wedding song at all.",
    },
  },
  // ------------------------------------------------------------------------------------------------ V · the Golden Tier
  {
    title: "The Law of Challenge",
    hanzi: "挑战律",
    level: 10,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Golden Gate",
        objective: "Climb to the Golden Gate.",
        lines: [
          ["tj-warden", "Core Formation, late stage. Pass, {peer}. On the Golden Tier the clans will want to measure you. Every clan has a champion. Every champion has a list."],
          ["narr", "The Golden Tier is drum towers and clan halls and a ring of hammered bronze in the middle of the tier where the challenges are fought. A crowd is always round it."],
        ],
        done: "As she passes the ring, a clan champion looks her up and down, and writes something on a list.",
      },
      {
        step: 9,
        npc: "tj-patron",
        title: "Lord Jin Wei",
        objective: "Lord Jin Wei of the Jin clan has invited you to his drum tower.",
        lines: [
          ["tj-jinwei", "Lin Yue. The disciple who carries soup on the Mud Tier and cuts threads on the Jade. Sit. Wine?"],
          { a: "tj-jinwei", n: "toast" },
          ["tj-jinwei", "Under the Code, a lower realm may challenge a higher once in a lifetime. Win, and he takes the higher one's tier. It is the only door in the city that opens upward without a tablet."],
          ["tj-jinwei", "So every clan on this tier keeps a champion. Lei Ba is ours. If anyone below us ever challenges a Jin, Lei Ba answers. Nobody has won a challenge on the Golden Tier in thirty years. It is very stable."],
        ],
        done: "Lord Jin Wei's wine is very good. It is, he mentions, paid for in Copper Tier years.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "The Challenge Ring",
        objective: "Ah Lou has gone to watch the challenges at the bronze ring.",
        lines: [
          ["narr", "A Copper smith with burned hands is in the ring with Lei Ba. The smith challenged a Jin cousin who broke his sister's hand. Lei Ba stepped in for the cousin, as the Code allows."],
          ["narr", "It is over in one stroke. The smith is carried out. The crowd applauds the champion, because the champion is Gold."],
          ["tj-ahlou", "That's Hua Jun. Su Wan's Hua Jun. He climbed four gates on Liu's tablet to get here. He'll live. He won't hold a hammer again."],
        ],
        done: "Ah Lou carries Hua Jun down the stair on her back, all four gates, and won't let anyone help.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "Thirty Years Undefeated",
        objective: "Wen Qi has looked up every challenge fought on the Golden Tier.",
        lines: [
          ["tj-wenqi", "Three hundred and twelve challenges in thirty years. Three hundred and twelve answered by champions. Every champion is one realm above the challenger. The clans hire them that way."],
          ["tj-wenqi", "The Code says the challenger may name his opponent. The clans read it as: the challenger may name the clan. Nobody has ever contested the reading."],
          ["tj-wenqi", "A ruling of the Violet Tier could. If someone heavy enough asked."],
        ],
        done: "Wen Qi drafts the petition to the Tribunal. It is his ninth draft. He's getting better at them.",
      },
      {
        step: 36,
        npc: "tj-patron",
        title: "A Champion's Offer",
        objective: "Lord Jin Wei has an offer.",
        lines: [
          ["tj-jinwei", "Be our champion, {peer}. A golden core like yours. The Jin clan would give you a hall, a drum tower, a seat at the clan's table and a tablet two tiers above your realm."],
          ["tj-jinwei", "You need not fight often. With you behind us, nobody would dare challenge a Jin at all."],
        ],
        choice: {
          prompt: "Lord Jin Wei pours another cup and waits.",
          options: [
            { heart: "mercy", label: "“Make your clan open to challenges with no champion at all.”", then: "Lord Jin Wei laughs. Then he sees she means it, and stops laughing.", reply: ["tj-jinwei", "A clan with no champion. On the Golden Tier. You want us to bleed, {peer}."] },
            { heart: "sword", label: "“I'll be a champion. Anyone's. Whoever challenges a Jin, I'll fight for them.”", then: "Lord Jin Wei sets down his cup. Around the drum tower, a dozen clan servants find something to look at very hard.", reply: ["tj-jinwei", "You'd stand for the challengers. Against us. …That has never been done. It has never been thought of."] },
            { heart: "balance", label: "“I'll judge the challenges, and fight for neither side.”", then: "She proposes that challenges be judged by someone higher than both. Lord Jin Wei, after a long silence, admits it would be more fair, and less profitable.", reply: ["tj-jinwei", "Fair. Yes. I've heard of fair. It's what Mud Tier porters say when they're about to be weighed."] },
            { heart: "slaughter", label: "Accept, and name your price: his hall", then: "She names it. He gives it. It is a very large hall.", reply: ["tj-jinwei", "Our champion. Welcome. You will find the Jin clan very generous to those who frighten it."], effect: (g: GameState) => feed(3)(purse(120)(g)) },
          ],
        },
        done: "Word of the offer, and her answer, is on every balcony of the Golden Tier by nightfall.",
      },
      {
        step: 45,
        npc: "tj-ahlou",
        title: "Ah Lou's Challenge",
        objective: "Ah Lou says she's going to challenge someone. Stop her, or don't.",
        lines: [
          ["tj-ahlou", "A lower realm may challenge a higher one. Once. I'm mortal. Everybody's higher. I'm going to challenge the Sovereign."],
          ["hero", "You'll die."],
          ["tj-ahlou", "He has to accept. It's the Code. Mortal or not, the Code says once in a lifetime. I'll walk up the avenue to the summit with every gate open, because I'm going to challenge the Sovereign. They'll have to let me past."],
          ["tj-ahlou", "I just want to see it. Once. The top."],
        ],
        choice: {
          prompt: "Ah Lou is already walking toward the avenue.",
          options: [
            { heart: "mercy", label: "“Not like that. I'll take you up, when it's time. I promise.”", then: "Ah Lou stops. She looks at the jade tablet, and then at Lin Yue's face, and decides to believe the face.", reply: ["tj-ahlou", "A promise from a golden core. On the Golden Tier that's worth a clan. To me it's worth more. Don't break it."] },
            { heart: "sword", label: "“Then challenge someone you can beat, and work up.”", then: "She shows Ah Lou how to hold a staff. Ah Lou is very bad at it, and keeps at it until dark.", reply: ["tj-ahlou", "Work up. Like a porter. One gate at a time. …My arms hurt. Again."] },
            { heart: "balance", label: "“The Code says once in a lifetime. Spend it when it counts.”", then: "Ah Lou thinks about it for a long time, then folds her one challenge away, as carefully as the persimmon wrapper.", reply: ["tj-ahlou", "Once. Then I'll save it. For the one person it matters for."] },
            { heart: "slaughter", label: "“Go. Let them see what the Code does to the mud.”", then: "Ah Lou gets as far as the Violet Gate before a warden turns her back with the butt of his spear. She comes down the stair with a split lip.", reply: ["tj-ahlou", "They didn't even ask my name. They just pushed. …You knew they would."], effect: feed(2) },
          ],
        },
        done: "Ah Lou writes 'the Sovereign' on the persimmon wrapper, under all the names, and underlines it.",
      },
      {
        step: 58,
        npc: "tj-wenqi",
        title: "A Ruling Requested",
        objective: "Wen Qi's petition to the Violet Tier is ready. It needs a name heavy enough to send it.",
        lines: [
          ["tj-wenqi", "“May a challenger name his opponent, or only his opponent's clan?” Signed: Registrar Wen Qi, Silver. Seconded…"],
          ["tj-wenqi", "Your name, {peer}. Your tablet's weight. Or it will sit on a Violet clerk's desk until we are both very old."],
          { a: "hero", n: "write" },
        ],
        done: "The petition goes up the stair with her seal on it. It arrives the same day.",
      },
      {
        step: 67,
        npc: "tj-patron",
        title: "The Clans Gather",
        objective: "The clans of the Golden Tier are meeting in Lord Jin Wei's drum tower. You are invited, which means you are expected.",
        lines: [
          ["narr", "Thirty clan heads round a table. Thirty champions behind them. Every eye on her tablet."],
          ["tj-jinwei", "The Violet Tier has ruled. A challenger may name his opponent. The man, not the clan. Champions may not answer for anyone but themselves. You did this, {peer}."],
          ["tj-jinwei", "Next month there will be a hundred challenges on the Golden Tier. Some of them will be won. Do you understand what you've done to the stair?"],
          ["hero", "I've made a door open upward."],
        ],
        done: "The clan heads leave one by one. Some look at her with hatred. Two, quietly, with something else.",
      },
      {
        step: 76,
        npc: "tj-ahlou",
        title: "Hua Jun Walks",
        objective: "Hua Jun is walking again. Ah Lou wants you to see.",
        lines: [
          ["narr", "Hua Jun on the Copper Tier, in the forge, holding a hammer in his left hand because his right will not close. Bellows Hua is pumping the bellows. Su Wan is sitting on an anvil, not supposed to be there, playing the flute."],
          ["tj-ahlou", "He says he'll challenge again. Properly. Name the man. Lei Ba himself. When his left hand's ready."],
        ],
        done: "The sound of a one-handed hammer is slower, and steadier, than the sound of two.",
      },
      {
        step: 85,
        npc: "tj-wenqi",
        title: "Lei Ba's Challenge",
        objective: "Lei Ba has challenged you. Under the Code, he may — he is a Core Formation, as you are, and he says he is lower.",
        lines: [
          ["tj-wenqi", "He claims he is one stage below you. Core Formation, middle, to your late. So he may challenge. If he wins, he takes your tier — and your bearer's pass, and your seal on the petition."],
          ["tj-wenqi", "The Code is very clear. He chose you by name. It's the new ruling. Your ruling."],
        ],
        done: "Lin Yue goes to the bronze ring. The whole Golden Tier comes with her.",
      },
      {
        step: 98,
        npc: "tj-patron",
        title: "The Bronze Ring",
        objective: "Lei Ba waits in the bronze ring of the Golden Tier.",
        lines: [
          ["narr", "The ring is hammered bronze, warm from the sun. Every balcony on the Golden Tier is full. Below, on the stair, the Copper and the Silver and even the Mud Tier have climbed as far as their gates allow, and are watching through the gold light."],
          ["tj-jinwei", "Thirty years, {peer}. He's never lost. Not once. If he loses, every clan on this tier learns it can."],
        ],
        done: "Lei Ba steps into the ring and bows, which nobody on the Golden Tier has ever seen him do.",
      },
    ],
    petitions: [
      "“A message to the Thunder Tier's barracks, carried by someone the seals let past. Thank you, {peer}. The clans can't afford a Thunder pass.”",
      "“You watched the challenge and said nothing. The challenger saw your tablet in the crowd. He fought better.”",
      "“A wine jar for the drum-keeper. He beats the hours for the whole tier and nobody pours for him.”",
      "“You trained the clan's youngest for an hour. She's Qi Condensation. She'll remember a golden core's hour all her life.”",
      "“Wine to the challenge ring's healer. She's Mud-born. The clans pay her in bruises.”",
    ],
    ahlou: [
      "The Golden Tier's so heavy with gold you'd think it'd sink.",
      "Every clan here has a drum tower. They beat them at each other. It's like dogs barking over a wall.",
      "Lord Jin Wei gave me a coin. I gave it to Hua Jun. Hua Jun gave it to a Mud Tier kid. It's going back down the stair one person at a time.",
      "If I challenged someone, I'd challenge Lord Jin Wei's wine steward. He's only Foundation. I'd lose. But he'd have to look at me.",
    ],
    boss: {
      intro: "Lei Ba, Champion of the Golden Tier, draws his saber in the bronze ring",
      words: [
        ["tj-boss", "Thirty years nobody has named me. They named my clan, and I answered. You named nobody, {peer}. You named the rule. Now I name you."],
        ["tj-boss", "If I win, your ruling stands, and I have the tier. If you win… then a champion has lost, and the Code is a door. Come."],
      ],
      fates: [
        { heart: "mercy", label: "Help him up, and offer him a place teaching challengers", line: "She helps him up off the bronze. He looks at her hand for a long time before he takes it. A month later there is a school on the Copper Tier where a former champion teaches smiths to fight one-handed." },
        { heart: "sword", label: "Take his saber and hang it over the ring", line: "His saber hangs over the bronze ring for anyone to look up at. Under it, the next month, a hundred challenges are fought, and nineteen are won." },
        { heart: "balance", label: "Leave him his tier, and take nothing", line: "She walks out of the ring with nothing in her hands. Under the Code, the winner may decline. Nobody ever has. It is talked of more than the fight." },
        { heart: "slaughter", label: "Finish it, as the clans finished three hundred challengers", line: "She does not let him get up. The balconies go very quiet. The Golden Tier has learned that a door that opens upward can let something terrible up too." },
      ],
      victory: "The clans of the Golden Tier take down their champions' lists. Some of them take down their drum towers' banners as well, and do not put them back up.",
    },
  },
  // ------------------------------------------------------------------------------------------------ VI · the Violet Tier
  {
    title: "The Weight of a Word",
    hanzi: "言重",
    level: 12,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Violet Gate",
        objective: "Climb to the Violet Gate, the first tier of the Nascent Soul.",
        lines: [
          ["tj-warden", "A Nascent Soul. Pass, Senior Ancestor. The Tribunal of Realms sits on this tier. Every word spoken here is weighed. Yours will be very heavy."],
          ["narr", "The Violet Tier is a single great hall with a balance carved over its doors, and around it the houses of advocates and the cells of the accused. It is very quiet. Everybody up here is listening."],
        ],
        done: "When she speaks to the warden's clerk, three passers-by stop to listen to how much her words weigh.",
      },
      {
        step: 9,
        npc: "tj-patron",
        title: "Advocate Pei Lan",
        objective: "An advocate is waiting for you outside the Tribunal. He says he has a case.",
        lines: [
          ["tj-peilan", "Pei Lan. Advocate. Foundation Establishment. Mud-born, if you're wondering why my sleeves are short. I take cases nobody else will."],
          ["tj-peilan", "The Tribunal weighs testimony by realm. A Core Formation witness outweighs a hundred Foundation witnesses. A mortal's word weighs a feather. I've won four cases in twenty years. All four were mortals against mortals."],
          ["tj-peilan", "I have a case. Lou Shan of the Mud Tier, against the Weighing Hall. For his years. The plaintiff is asleep. His daughter would testify. Her word weighs a feather."],
        ],
        done: "Pei Lan gives her a copy of the case. It is very thin. The weight of a case, on the Violet Tier, is not measured in paper.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "A Feather's Testimony",
        objective: "Ah Lou has been called to give testimony at the Tribunal. Go with her.",
        lines: [
          ["narr", "The Tribunal's great balance hangs over the floor, its two pans of bronze. A witness stands on one pan to speak. Their realm sets how far the pan falls."],
          ["narr", "Ah Lou steps onto the pan. It does not move at all. She speaks for an hour about her father, the bells, the spring weighing, the cold shed, and the pan does not move."],
          ["tj-boss", "The witness weighs nothing. Her testimony is entered as nothing. Next."],
        ],
        done: "Ah Lou steps down off the pan. She is not crying. She is very, very still.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "Who Weighs the Justiciar",
        objective: "Wen Qi has looked into Justiciar Yan Heng.",
        lines: [
          ["tj-wenqi", "Yan Heng. Nascent Soul, late stage. Chief Justiciar for two hundred years. Never overruled. Nobody above him has ever taken a case to the Tribunal; they don't need to."],
          ["tj-wenqi", "His years credited: one hundred and nine. His court's fees are paid in years. Every losing party pays. The losing party is almost always the lighter one."],
        ],
        done: "Wen Qi adds Yan Heng to the list on the back of Ah Lou's persimmon wrapper. It is getting crowded.",
      },
      {
        step: 36,
        npc: "tj-patron",
        title: "To Stand on the Pan",
        objective: "Advocate Pei Lan asks you to testify for Lou Shan.",
        lines: [
          ["tj-peilan", "You laid your hand on Lou Shan's wrist in the sleeping house. You felt his years drawn up the mountain. You are a Nascent Soul. If you say it on the pan, it weighs."],
          ["tj-peilan", "It will not be enough to win. Yan Heng is heavier. But it will be heard. It will be in the record. Nobody heavy has ever spoken for the mud in the record."],
        ],
        choice: {
          prompt: "Will you stand on the pan for Lou Shan?",
          options: [
            { heart: "mercy", label: "Stand on the pan, and hold Ah Lou's hand while you speak", then: "She steps onto the pan with Ah Lou beside her, holding her hand, so that whatever the pan weighs, it weighs both of them.", reply: ["tj-patron", "Two on the pan. The Code says one witness. It does not say one person. Oh, that's good. That's very good."], effect: quiet(3) },
            { heart: "sword", label: "Stand on the pan and accuse the Weighing Hall outright", then: "She names the Hall, the column, the years credited. The pan drops so hard it rings.", reply: ["tj-patron", "The pan rang. The pan never rings."] },
            { heart: "balance", label: "Stand on the pan and say only what you felt, exactly", then: "She describes the thread of years, exactly, in a level voice. The pan settles slowly and stays down.", reply: ["tj-patron", "Exact. Nothing for him to strike from the record. Ha!"] },
            { heart: "slaughter", label: "Refuse the pan, and tell the Justiciar what you'll weigh instead", then: "She tells the Justiciar, before the whole court, that she does not need a pan to weigh him.", reply: ["tj-patron", "…That will be in the record too, Senior Ancestor. I'm not sure that it helps."], effect: feed(2) },
          ],
        },
        done: "For the first time in the Tribunal's records, the case of a sleeper of the Mud Tier has testimony that weighs.",
      },
      {
        step: 45,
        npc: "tj-ahlou",
        title: "The Ruling",
        objective: "The Tribunal has ruled on Lou Shan. Ah Lou is outside.",
        lines: [
          ["tj-ahlou", "He ruled the Weighing Hall acted within the Code. He said your testimony weighed a great deal, Senior Ancestor. He said his weighed more."],
          ["tj-ahlou", "But it's in the record. Advocate Pei says that's something. He says that next time, there'll be the record."],
          ["tj-ahlou", "There won't be a next time for my father."],
        ],
        done: "Ah Lou sits on the Tribunal's steps until the evening bell, and the advocates walking past step round her.",
      },
      {
        step: 58,
        npc: "tj-wenqi",
        title: "The Scale of Words",
        objective: "Wen Qi has found how the Tribunal's balance really works.",
        lines: [
          ["tj-wenqi", "It isn't weighing the witness. It's weighing the witness's thread to the Array. The heavier the thread, the more the Array listens. The Tribunal's balance is the Array's ear."],
          ["tj-wenqi", "A mortal's word weighs nothing because a mortal's thread runs the wrong way. Out, not in. The Array doesn't hear things it eats."],
        ],
        done: "Wen Qi draws the diagram on the back of a court summons. His hand has stopped shaking. He hasn't noticed.",
      },
      {
        step: 67,
        npc: "tj-patron",
        title: "A Hundred Feathers",
        objective: "Advocate Pei Lan has an idea. A dangerous one.",
        lines: [
          ["tj-peilan", "One feather weighs nothing. A hundred feathers still weigh nothing, the Code says, unless they're tied together."],
          ["tj-peilan", "A joint testimony. Every sleeper's family on the pan at once, bound by one witness heavy enough to tie them. You."],
        ],
        choice: {
          prompt: "Pei Lan asks you to tie a hundred feathers together.",
          options: [
            { heart: "mercy", label: "Tie them with your own thread to the Array", then: "She lets every family hold a corner of her sleeve. A hundred feathers and a Nascent Soul, on one pan.", reply: ["tj-patron", "The pan went down. Not far. Down."] },
            { heart: "balance", label: "Tie them with Wen Qi's ledger, page by page", then: "Each family stands on the pan with its page of the ledger in its hand, and she reads the second column aloud.", reply: ["tj-patron", "Numbers. Numbers weigh, on the Violet Tier. I never thought of that."] },
            { heart: "sword", label: "Tie them with a challenge: you against the Justiciar's ruling", then: "She challenges the ruling itself under the Code of Challenge, which no one has ever thought to do to a ruling.", reply: ["tj-patron", "You can't challenge a ruling. …Can you? Oh, the clerks are going to be up all night."] },
            { heart: "slaughter", label: "Tie them with fear: let the court feel your soul", then: "She lets her Nascent Soul show in her eyes. The court weighs what it sees, and decides very quickly.", reply: ["tj-patron", "That wasn't testimony, Senior Ancestor. That was a threat. They'll remember that it worked."], effect: feed(3) },
          ],
        },
        done: "The joint testimony is entered in the record. The Justiciar's pen, signing it, leaves a blot.",
      },
      {
        step: 76,
        npc: "tj-ahlou",
        title: "The Justiciar's Visitor",
        objective: "Ah Lou saw who visits Justiciar Yan Heng at night. Listen.",
        lines: [
          ["tj-ahlou", "A lady in a star-blue robe with a veil. From the Star Tier. She brings him a chart every new moon. He reads it, and burns it, and rules."],
          ["tj-ahlou", "The guards bow to her lower than they bow to him."],
        ],
        done: "Lin Yue writes 'Star Tier' on the persimmon wrapper, above the Sovereign.",
      },
      {
        step: 85,
        npc: "tj-patron",
        title: "The Advocate Accused",
        objective: "Advocate Pei Lan has been arrested for 'contempt of weight'. Go to the Tribunal.",
        lines: [
          ["narr", "Pei Lan in a cell under the Tribunal's balance, his short sleeves torn."],
          ["tj-peilan", "Contempt of weight. I bound feathers. It's in the Code, under 'disturbances to the Array'. The penalty is to be weighed. On the spring scale. With the mud."],
          ["tj-peilan", "Funny. I always meant to go home."],
        ],
        done: "The cell door has a seal on it. The seal parts for her tablet. Pei Lan does not come out. He says he wants to be tried.",
      },
      {
        step: 98,
        npc: "tj-wenqi",
        title: "The Last Ruling",
        objective: "Justiciar Yan Heng will rule on Pei Lan himself, today. Go to the Tribunal.",
        lines: [
          ["narr", "Every advocate on the Violet Tier is in the gallery. Every clerk. Wen Qi, with his ledger. Ah Lou, in the back, on her toes."],
          ["tj-wenqi", "If he weighs Pei Lan, he weighs every feather Pei Lan tied. Senior Ancestor, it's not one man on the pan. It's all of them."],
        ],
        done: "Justiciar Yan Heng rises from his seat under the balance and steps down to the floor to rule in person.",
      },
    ],
    petitions: [
      "“A brief carried to the Golden Tier's clerks. Nobody below Violet may serve a Violet brief. Thank you, Senior Ancestor.”",
      "“You read the old Code with me all night. I've never had anyone heavy enough to read it with.”",
      "“A witness from the Copper Tier, escorted up four gates. She'd never have got past the Silver one alone.”",
      "“A visit to the cells. The prisoners saw your tablet and stood up. Nobody has stood up in there for years.”",
      "“A word with a Violet clerk about a misfiled appeal. One word. From you, one was enough.”",
    ],
    ahlou: [
      "Everyone up here whispers. They're scared their words weigh too much. I've never had that problem.",
      "Advocate Pei's mud-born like me. He says the trick is to be so annoying they can't pretend you're not there.",
      "I stood on the pan again when nobody was looking. Still nothing. I'm consistent.",
      "If a mortal's word weighs nothing, then nothing I say can hurt anyone up here. So I'm going to say everything.",
    ],
    boss: {
      intro: "Justiciar Yan Heng lifts his gavel, and the great balance over the Tribunal floor swings toward her",
      words: [
        ["tj-boss", "Two hundred years I have weighed words, Senior Ancestor. I have never once been wrong, because I have never once been outweighed."],
        ["tj-boss", "Your word weighs {realm}. Mine weighs the Array's. Step onto the pan and let us see."],
      ],
      fates: [
        { heart: "mercy", label: "Put him on the pan, and let the feathers weigh him", line: "Yan Heng stands on the pan, and Ah Lou and a hundred families stand on the other, and Lin Yue stands beside them, and the balance swings, slowly, all the way. He steps down, and sits on the floor, and asks Pei Lan for a lawyer." },
        { heart: "sword", label: "Break the great balance", line: "The balance cracks down its beam and the two pans fall to the floor. Without it, the Tribunal will have to listen to words. Pei Lan walks out of his cell and argues his own case to a court with no scale." },
        { heart: "balance", label: "Make him rule again, on the record, without the balance", line: "She sets the record before him and makes him read it all, every feather, aloud. Then she makes him rule. He rules for Pei Lan. He rules, very quietly, for Lou Shan." },
        { heart: "slaughter", label: "Weigh him as he weighed them", line: "She lets her soul fall on him like a pan. He is a feather after all." },
      ],
      victory: "The Tribunal of Realms adjourns without a Justiciar for the first time in two hundred years. Pei Lan, released, stands on the steps in his short sleeves, and the advocates of the Violet Tier queue to shake his hand.",
    },
  },
  // ------------------------------------------------------------------------------------------------ VII · the Cloud Tier
  {
    title: "A Thousand Borrowed Springs",
    hanzi: "借春",
    level: 14,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Cloud Gate",
        objective: "Climb to the Cloud Gate.",
        lines: [
          ["tj-warden", "Nascent Soul, late stage. Pass, Senior Ancestor. The elders of the Cloud Tier have been expecting you. They say you have been… disturbing."],
          ["narr", "The Cloud Tier is gardens. Terraced, misted, full of flowers that bloom out of season and old men and women who look forty and walk like they are four hundred."],
        ],
        done: "An elder sitting by a pond watches her pass, and smiles, and his smile is very young.",
      },
      {
        step: 9,
        npc: "tj-patron",
        title: "The Mist-Keeper",
        objective: "An old abbot is sweeping the Cloud Tier's one bare terrace. Speak to him.",
        lines: [
          ["tj-mist", "Yun Shu. Mist-Keeper. Nascent Soul, peak. I am three hundred and one years old and I look it, which on this tier is a scandal."],
          ["tj-mist", "Every other elder here buys years. There is a market on the north terrace. A spring costs what a Nascent Soul spends in a month on tea."],
          ["tj-mist", "I don't buy them. I'd like to say it was virtue. Mostly it is that I have seen where they come from."],
        ],
        done: "Yun Shu goes back to sweeping. The petals he sweeps are from a tree that should have finished flowering two hundred years ago.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "Little Pot",
        objective: "Ah Lou has found Granny Pot's granddaughter on the Cloud Tier at last.",
        lines: [
          ["narr", "A girl of sixteen with grey hair, sweeping an elder's terrace. When she sees Ah Lou she drops the broom."],
          ["tj-ahlou", "Little Pot! Your granny makes soup every night and sets a bowl out for you!"],
          ["narr", "Little Pot looks at her service contract, tied in red thread round her wrist, and at Lin Yue's tablet, and starts to cry, very quietly, as if she might be weighed for it."],
        ],
        done: "Lin Yue cuts the red thread. Under the Cloud Tier's law, only someone heavier than the contract's holder may. She is.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "The Year Market",
        objective: "Wen Qi has gone to the Year Market. He looks ill.",
        lines: [
          ["narr", "Jars of mist on silk-covered tables. Each jar is labelled: a tier, a name, a season. 'Mud Tier. Lou family. Spring.' An elder is uncorking one and breathing it in."],
          ["tj-wenqi", "They label them by name, {peer}. They don't even pretend."],
        ],
        done: "Wen Qi buys one jar with every stone he has. It is labelled 'Lou Shan, Spring'. He doesn't know what to do with it. He carries it carefully.",
      },
      {
        step: 36,
        npc: "tj-patron",
        title: "A Jar of Spring",
        objective: "Take Wen Qi's jar to the Mist-Keeper. He may know what can be done with it.",
        lines: [
          ["tj-mist", "A year, bottled, can be drunk. Or it can be poured out. Poured where it came from, if you know where that is."],
          ["tj-mist", "It will not wake him. A year is a year; a life is more. But it will make him less cold."],
        ],
        choice: {
          prompt: "The jar of Lou Shan's spring sits on the Mist-Keeper's table.",
          options: [
            { heart: "mercy", label: "Carry it down to the sleeping house yourself", then: "She carries the jar down seven gates to the Mud Tier and pours it out over Lou Shan's hands, and his fingers, for a moment, curl.", reply: ["tj-ahlou", "His hands are warm. His hands are warm, Senior Ancestor."], effect: quiet(4) },
            { heart: "balance", label: "Give it to Ah Lou to carry", then: "Ah Lou carries it down seven gates on her own, and pours it herself.", reply: ["tj-ahlou", "I carried him a year. He carried bells for me for ten. We're not even. We're closer."] },
            { heart: "sword", label: "Smash the market's jars, every one", then: "The jars break. The mist goes out over the Cloud Tier's gardens like weather. Nobody can tell whose spring is whose any more.", reply: ["tj-patron", "Well. That is one way. The elders will be very old by morning."] },
            { heart: "slaughter", label: "Drink it, and feel what they feel", then: "She breathes it in. For a moment she is a porter carrying bells up the stair in the spring. Then it is in her, and it is hers, and she is a little younger, and a little worse.", reply: ["tj-patron", "…Now you know why they do it. I am sorry you know."], effect: feed(5) },
          ],
        },
        done: "In the sleeping house on the Mud Tier, Lou Shan sleeps on, a little less cold.",
      },
      {
        step: 45,
        npc: "tj-ahlou",
        title: "Su Wan's Betrothed",
        objective: "Ah Lou has seen Elder Mei Shou. Su Wan's would-have-been husband.",
        lines: [
          ["narr", "In the finest garden on the Cloud Tier, a young man of perhaps thirty sits by a pond, feeding the koi. Behind him, eleven memorial tablets on a little shrine. Eleven Jade Tier names."],
          ["tj-ahlou", "He's four hundred and sixty. He looks like Hua Jun's older brother. He looks nice."],
          ["tj-boss", "Ah. The Senior Ancestor who made my twelfth bride say no. Sit, sit. I don't hold grudges. Grudges age you."],
        ],
        done: "Elder Mei Shou offers her tea. It is very good. She does not drink it.",
      },
      {
        step: 58,
        npc: "tj-patron",
        title: "Why the Mist-Keeper Stopped",
        objective: "Yun Shu has a story to tell, if you'll sweep with him.",
        lines: [
          { a: "hero", n: "sweep" },
          ["tj-mist", "I bought one spring, once. When I was two hundred, and afraid. It tasted of rain on a roof. A Mud Tier roof. I could hear a child laughing under it."],
          ["tj-mist", "I went down and found the roof. The child was weighed the year after. I have not bought a spring since. I have been dying, slowly, for a hundred years, as one should."],
        ],
        done: "They sweep the terrace together until the petals are gone, and then the tree drops more.",
      },
      {
        step: 67,
        npc: "tj-wenqi",
        title: "Where the Market Buys",
        objective: "Wen Qi has followed the Year Market's suppliers.",
        lines: [
          ["tj-wenqi", "The Weighing Hall doesn't keep the years. It passes them up. The Registry, the Tribunal, the Cloud Tier. And at every tier, someone takes a jar for themselves."],
          ["tj-wenqi", "What reaches the top is a fraction. And the Star Tier is counting it. Every jar. Toward something."],
        ],
        done: "Wen Qi puts the empty jar on his desk in the Registry, where everyone can see it.",
      },
      {
        step: 76,
        npc: "tj-ahlou",
        title: "Little Pot Goes Home",
        objective: "Take Little Pot home to Granny Pot, down seven gates.",
        lines: [
          ["narr", "Seven gates, seven stairs, seven seals parting for Lin Yue's tablet and for the girl who walks beside her with grey hair and no tablet at all."],
          ["tj-mudgran", "…Little Pot? Little Pot. Sit down. Eat. Eat, I said."],
          { a: "tj-ahlou", n: "embrace" },
        ],
        done: "Granny Pot sets out the bowl she has been setting out every night for two years, and this time someone eats from it.",
      },
      {
        step: 85,
        npc: "tj-patron",
        title: "The Elders' Council",
        objective: "The elders of the Cloud Tier have called you before their council.",
        lines: [
          ["narr", "Forty elders on forty cushions, all young, all ancient. Elder Mei Shou on the highest."],
          ["tj-boss", "We are the oldest cultivators in the jianghu, Senior Ancestor. Wisdom is years. Do you want the jianghu to lose four hundred years of wisdom because a porter is cold?"],
          ["tj-mist", "She wants you to grow old, Mei Shou. As I have. It is not so bad. The tea tastes the same."],
        ],
        choice: {
          prompt: "Forty young faces with old eyes wait for the Nascent Soul from below to answer.",
          options: [
            { heart: "mercy", label: "“Grow old with us. We'll sit with you while you do.”", then: "She offers to sit with any elder who stops buying years, through whatever it does to them. Three of the forty look at their hands.", reply: ["tj-mist", "Three. Three is a great many, on this tier. I was alone for a hundred years."] },
            { heart: "balance", label: "“Wisdom you bought is somebody else's. Give it back and keep what's yours.”", then: "She tells them their wisdom will survive the years they return, if it was ever theirs. The council is very quiet.", reply: ["tj-mist", "If it was ever theirs. Oh, that is cruel, and true. Some of them are counting."] },
            { heart: "sword", label: "“There will be no market by morning.”", then: "She says it once, plainly, as a Nascent Soul to Nascent Souls. Nobody contradicts her. Nobody needs to.", reply: ["tj-mist", "A promise, from that tablet, is a sentence. The market's keepers will be packing tonight."] },
            { heart: "slaughter", label: "“Then I'll take your years, and see how wise they make me.”", then: "The council goes very still. One elder, the youngest-looking, begins quietly to weep.", reply: ["tj-mist", "…That is exactly what they would say, Senior Ancestor. That is what frightens me."], effect: feed(3) },
          ],
        },
        done: "The council does not vote. It does not need to. Every elder there is looking at the jars on the north terrace.",
      },
      {
        step: 98,
        npc: "tj-patron",
        title: "The Year Market at Dawn",
        objective: "Elder Mei Shou has gone to the Year Market to drink every jar before she can pour them out. Go.",
        lines: [
          ["narr", "At dawn Elder Mei Shou stands among the silk tables with jars uncorked all round him, breathing them in one after another, growing younger and stranger with every breath."],
          ["tj-mist", "Senior Ancestor! He's drinking the Mud Tier! All of it!"],
        ],
        done: "Elder Mei Shou turns round. He looks about twenty. His eyes are four hundred and sixty.",
      },
    ],
    petitions: [
      "“A sack of plain rice for the Mist-Keeper's terrace. Everything else on this tier is grown on borrowed years.”",
      "“You sat with the old woman who refuses to buy years. She said nobody heavy had sat with her in a century.”",
      "“Petals swept from the north terrace. Every one, Senior Ancestor. They grow back. We sweep them anyway.”",
      "“A letter to the Cloud Tier's koi-keeper, a mortal bonded here eighty years. He's eighty-nine. He was eighteen when he came up.”",
      "“A walk in the gardens with an elder who's thinking of stopping. Just a walk. You didn't say anything. That helped.”",
    ],
    ahlou: [
      "Everyone up here looks young and walks old. It's horrible. It's like a puppet show.",
      "The flowers here don't smell. Yun Shu says it's because they're the wrong age.",
      "Little Pot's hair is still grey. Granny Pot says it suits her. Granny Pot's lying.",
      "I tried to breathe a jar when nobody was looking. Then I didn't. It said Mud Tier on it.",
    ],
    boss: {
      intro: "Elder Mei Shou, Eater of Years, rises from the Year Market young as a spring morning",
      words: [
        ["tj-boss", "Four hundred and sixty springs, and every one of them was somebody's. Do you know what I've learned in that time, Senior Ancestor? Everybody's spring tastes the same."],
        ["tj-boss", "Your Nascent Soul is young. {realm}. You've a great many springs in you. I wonder what yours taste of."],
      ],
      fates: [
        { heart: "mercy", label: "Let the years go out of him, and sit with him while he ages", line: "She draws the borrowed springs out of him slowly and lets them go back down the mountain like mist. He grows old in an afternoon, holding her hand. At the end he is very old and very frightened and very, for the first time in centuries, himself." },
        { heart: "sword", label: "Cut the borrowed years out of him in one stroke", line: "One stroke, and four hundred years fall away from him like a robe. He is an old man of thirty in a young man's clothes, and he is dying, as he should have done long ago." },
        { heart: "balance", label: "Pour every jar out over the Cloud Tier", line: "She breaks every jar, and the mist goes out over the gardens and down the stair and the old elders of the Cloud Tier grow old, all of them, at once, and the flowers out of season wilt, and something on the Mud Tier breathes easier." },
        { heart: "slaughter", label: "Drink him", line: "She takes the springs, all of them, into her own soul. They taste of rain on a Mud Tier roof. She is very young, and very full, and very hungry." },
      ],
      victory: "The Year Market's silk tables stand empty on the north terrace. The elders of the Cloud Tier are old, and the tea, Yun Shu says, tastes exactly the same.",
    },
  },
  // ------------------------------------------------------------------------------------------------ VIII · the Star Tier
  {
    title: "The Chart of Every Child",
    hanzi: "星命",
    level: 16,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Star Gate",
        objective: "Climb to the Star Gate, the first tier of Spirit Severing.",
        lines: [
          ["tj-warden", "Spirit Severing. Pass, Exalted One. The Star Registry has your chart already. It has had it since you crossed the bridge."],
          ["narr", "The Star Tier is observatories and pagodas and long galleries of shelves, every shelf a box, every box a child's birth chart. On the roofs, star-readers in blue watch the sky by day as well as by night."],
        ],
        done: "On the gallery nearest the gate, a star-reader takes down a box with her name on it, and opens it, and frowns.",
      },
      {
        step: 9,
        npc: "tj-patron",
        title: "Apprentice Xing'er",
        objective: "A young star-reader wants to show you a box.",
        lines: [
          ["tj-xinger", "Xing'er. Apprentice of the Star Registry. Spirit Severing, early. I was born on the Gold Tier. My chart said Star."],
          ["tj-xinger", "Every child born in Tianjie has a chart drawn here. The chart says which tier the child belongs to. The tablet follows the chart. Nobody climbs higher than their chart, Exalted One, except by challenge, and challenges are… rare."],
          ["tj-xinger", "I've been reading the charts. Mud-born children's charts always say mud. Gold-born children's always say gold. The stars are never that consistent. Not with anything."],
        ],
        done: "Xing'er hands her a box. It is Ah Lou's chart. Under 'Tier' it says 'Mud', in a hand that wrote it before the stars were read.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "Ah Lou's Chart",
        objective: "Show Ah Lou her chart. Or don't.",
        lines: [
          ["tj-ahlou", "Mud. Forever. It's written in ink, not in stars."],
        ],
        choice: {
          prompt: "Ah Lou holds her own birth chart in two fingers, as she held the forged tablet.",
          options: [
            { heart: "mercy", label: "“It was never true. You've climbed seven gates.”", then: "She tells Ah Lou to count the gates. Ah Lou counts them on her fingers, all seven.", reply: ["tj-ahlou", "Seven. On a mud chart. The stars are going to be so embarrassed."] },
            { heart: "sword", label: "Burn it", then: "The chart burns in her palm. The Registry will draw another. It won't be this one.", reply: ["tj-ahlou", "Good. Let them draw me again. I'll be different this time."] },
            { heart: "balance", label: "“Read the real stars. Let Xing'er read them.”", then: "Xing'er reads Ah Lou's stars properly, for the first time. It takes all night. In the morning she says: “Unclear.”", reply: ["tj-ahlou", "Unclear. I like unclear. Nobody can weigh unclear."] },
            { heart: "slaughter", label: "Find the hand that wrote it", then: "She finds the clerk who wrote 'Mud' fourteen years ago, and makes him read the chart aloud, over and over, until he is crying.", reply: ["tj-ahlou", "He was just a clerk. He was just a clerk like Wen Qi. …Stop. Please."], effect: feed(3) },
          ],
        },
        done: "Ah Lou keeps the ashes, or the chart, or the night of star-reading, inside her jacket, with everything else.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "The Conjunction",
        objective: "Wen Qi has found the Star Registry's great count.",
        lines: [
          ["tj-wenqi", "They're counting the years that reach the top. Every jar, every thread. Toward a total. When the count reaches it, and the stars align over the summit, the Array will be full."],
          ["tj-wenqi", "Full enough to lift the city, Exalted One. All nine tiers. Off the mountain, into heaven. The Ascent of the Stair."],
          ["tj-wenqi", "Except the arithmetic doesn't work. The count is short. It's always been short. Unless at the conjunction every mortal thread in the city is drawn at once."],
        ],
        done: "Wen Qi's ink has run out halfway through the arithmetic. He finishes it in pencil, then in his own blood, without noticing.",
      },
      {
        step: 36,
        npc: "tj-patron",
        title: "The Registrar of Stars",
        objective: "Xing'er says her mistress, Star-Registrar Qu Xing, wants to read your chart to your face.",
        lines: [
          ["tj-boss", "Lin Yue. Born under the Azure Cloud, or under a Willow Creek roof, or in the Blood Moon's shadow — your chart is confused about that. Born for the summit. It is very clear about that."],
          ["tj-boss", "The Sovereign has seen your chart, Exalted One. He would like you at the Ascent. In heaven, there will need to be a second seat."],
        ],
        done: "Qu Xing closes the box with Lin Yue's chart in it, and locks it, and keeps the key.",
      },
      {
        step: 45,
        npc: "tj-ahlou",
        title: "The Children's Gallery",
        objective: "Ah Lou has found the gallery where the newborns' charts are kept.",
        lines: [
          ["narr", "A gallery of tiny boxes. Every child born in Tianjie this year. Most of the boxes are marked 'Mud'. Some have a second mark in red: 'Conjunction'."],
          ["tj-ahlou", "The red ones are the Mud Tier kids. Every one. What's Conjunction? Why do the babies have it?"],
        ],
        done: "Lin Yue does not answer. Ah Lou does not ask again. They both know.",
      },
      {
        step: 58,
        npc: "tj-patron",
        title: "Rewriting the Stars",
        objective: "Xing'er has an idea.",
        lines: [
          ["tj-xinger", "If the charts decide where every thread is tied, then a chart can untie it. If I rewrite the Mud Tier children's charts — every one — they won't be drawn at the conjunction."],
          ["tj-xinger", "There are four thousand boxes. I'd need someone the Registry can't stop. Someone above my mistress. You're above my mistress, Exalted One."],
        ],
        choice: {
          prompt: "Four thousand boxes. One night before the Registry notices.",
          options: [
            { heart: "mercy", label: "Rewrite every one, through the night", then: "She writes until her hand is numb. In the morning four thousand children's charts say: “Unclear.”", reply: ["tj-patron", "Unclear. All of them. The Registry will never be able to read the city again."], effect: quiet(3) },
            { heart: "balance", label: "Rewrite them all to the same tier: no tier", then: "Every chart, from mud to gold, rewritten to say only 'Tianjie'. No tier at all.", reply: ["tj-patron", "Even the gold children. Oh, their parents will scream."] },
            { heart: "sword", label: "Burn the gallery instead", then: "The gallery burns. Four thousand charts, four thousand threads, gone. The Array, for a moment, shudders.", reply: ["tj-patron", "The Array felt that. I felt it feel it. We've cut something."] },
            { heart: "slaughter", label: "Rewrite the gold children's charts to say mud", then: "She rewrites the Gold-born, the Jade-born, the Violet-born. Mud, every one.", reply: ["tj-patron", "…That's not mercy, Exalted One. That's just turning the stair upside down. The stair doesn't care which way up it is."], effect: feed(3) },
          ],
        },
        done: "In the morning the Star Registry's galleries are very quiet, and very full of ink.",
      },
      {
        step: 67,
        npc: "tj-wenqi",
        title: "The Sovereign's Count",
        objective: "Wen Qi has found the Sovereign's own ledger.",
        lines: [
          ["tj-wenqi", "Gao Qiong. Spirit Severing, peak. Sovereign for two hundred and forty years. Years credited: none. Not one. He has never taken a jar."],
          ["tj-wenqi", "Every jar that reaches the top goes into the Array. Every one. He isn't eating them. He's saving them. For the Ascent."],
          ["tj-wenqi", "He believes it, Exalted One. He believes the city should go to heaven, and he's paid for it with nothing of his own. I don't know if that's better or worse."],
        ],
        done: "Wen Qi stares at the empty column for a long time.",
      },
      {
        step: 76,
        npc: "tj-ahlou",
        title: "The Woman with the Spear",
        objective: "Ah Lou saw a woman at the Thunder Gate. She wants you to come.",
        lines: [
          ["tj-ahlou", "A captain, at the top of the next stair. A spear. A helmet. She looked down at me through the seal, and then she looked away, very fast."],
          ["tj-ahlou", "She had my nose. Father always said I had her nose."],
        ],
        done: "Ah Lou stands at the foot of the Thunder Stair until the seal's light goes orange in the evening, and the woman with the spear does not look down again.",
      },
      {
        step: 85,
        npc: "tj-patron",
        title: "The Mistress Knows",
        objective: "Star-Registrar Qu Xing has found the rewritten charts. Xing'er is in trouble.",
        lines: [
          ["narr", "Xing'er on her knees in the gallery among the boxes, her ink-stained hands bound in star-blue silk."],
          ["tj-boss", "You have unwritten the conjunction, child. The Array will be short by four thousand. The Ascent will fall a tier short. Somebody will have to be left behind."],
          ["tj-boss", "The Sovereign is very disappointed. He has asked me to rewrite them back. Tonight."],
        ],
        done: "Qu Xing begins to rewrite, one box at a time. Every box she rewrites, the stars over the summit move, very slightly.",
      },
      {
        step: 98,
        npc: "tj-patron",
        title: "Under the Fated Star",
        objective: "Stop Star-Registrar Qu Xing before she rewrites the last box.",
        lines: [
          ["narr", "The gallery at midnight. A single lamp. Qu Xing with her brush. Behind her, a window, and in the window a star that should not be there."],
          ["tj-patron", "Exalted One, she's on the last row! Every chart she rewrites, the conjunction comes closer!"],
        ],
        done: "Qu Xing sets down her brush, and the star in the window flares.",
      },
    ],
    petitions: [
      "“A box of charts carried to the archive without anyone reading them. Thank you, Exalted One. Nobody below Spirit Severing may carry them unread.”",
      "“You looked at the stars with me last night. You saw the wrong star. I saw you see it.”",
      "“Ink, from the Mud Tier's soot. It makes the best black. Nobody up here knows that.”",
      "“A word with the gallery's keeper about a lost box. One child's. He found it after you spoke.”",
      "“You stood in the observatory door while my mistress passed. She didn't ask what I was writing.”",
    ],
    ahlou: [
      "They read the stars up here and write them down and put them in boxes. Like a porter, but for heaven.",
      "Xing'er says I'm unclear. I'm telling everyone.",
      "There are more boxes on the Star Tier than people in Tianjie. Some of them are for people who aren't born yet.",
      "If I had a chart that said summit, I'd still carry baskets. Somebody has to.",
    ],
    boss: {
      intro: "Star-Registrar Qu Xing lifts her fan, and the fated star in the window burns down into the gallery",
      words: [
        ["tj-boss", "Every child in this city is where its stars put it. I only write it down, Exalted One. If you want someone to blame, blame heaven."],
        ["tj-boss", "Your chart says summit. {realm}. You were born to stand beside him. Do you really mean to stand against your own stars?"],
      ],
      fates: [
        { heart: "mercy", label: "Give her the brush, and ask her to read the stars honestly", line: "Qu Xing reads the real stars over the city for the first time in forty years, at Lin Yue's side, through the night. In the morning she rewrites her own chart. It says: unclear." },
        { heart: "sword", label: "Cut down the fated star", line: "One stroke into the window, and the star that should not be there goes out. Without it, there will be no conjunction this year, or for a hundred years." },
        { heart: "balance", label: "Lock her in the gallery with the charts until the conjunction passes", line: "She seals the gallery with her own tablet. Qu Xing, inside, rages, then reads, then weeps. When the conjunction passes, the city is still on its mountain." },
        { heart: "slaughter", label: "Write her chart: mud", line: "She writes the Star-Registrar's chart herself: mud. The tablet at Qu Xing's belt turns to clay as she watches. The Thunder Gate's seal, above, does not part for her again." },
      ],
      victory: "The Star Tier's galleries are open to the sky at last. The children's charts lie in their boxes, unclear, every one, and above the summit the stars are only stars.",
    },
  },
  // ------------------------------------------------------------------------------------------------ IX · the Thunder Tier
  {
    title: "Nothing Behind Me",
    hanzi: "无后",
    level: 17,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Thunder Gate",
        objective: "Climb to the Thunder Gate.",
        lines: [
          ["tj-warden", "Spirit Severing, middle stage. Pass, Exalted One. To stand on the Thunder Tier you must have nothing behind you. The guard will ask what you have severed."],
          ["narr", "The Thunder Tier is barracks and drill-yards and drum towers, and the Severed Guard in masks, very quiet, very fast. Ah Lou, a step behind, holds very tightly to her basket."],
        ],
        done: "As she passes the drill-yard, a woman captain in a lilac-crested helmet stops her drill, and does not look at Ah Lou.",
      },
      {
        step: 9,
        npc: "tj-patron",
        title: "Severed Guard Shi Wu",
        objective: "A guard of the Severed has been sent to escort you. Talk to him.",
        lines: [
          ["tj-shi", "Shi Wu. Severed Guard. Spirit Severing, early. I severed a wife, two sons, a mother and a dog. The dog was the hardest."],
          ["tj-shi", "Severing is the art of this realm, Exalted One. You cut the threads that hold you down. Most cultivators cut desire, or fear. The Guard cuts people. It is faster."],
          ["tj-shi", "What have you severed, Exalted One? …Nothing? And you stand at Spirit Severing? That is not possible."],
        ],
        done: "Shi Wu walks beside her for the rest of the day, looking at her sideways, as if she might be a trick.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "Captain of the Ninth Gate",
        objective: "Ah Lou has stopped in front of the captain in the lilac crest. Go to her.",
        lines: [
          ["tj-ahlou", "Lou Feng. That's your name. You're Lou Feng. You're my mother."],
          ["narr", "The captain looks at her for a long time. There is nothing at all in her face."],
          ["tj-boss", "I have no daughter. I severed her. I severed a husband and a daughter at the Thunder Gate, ten years ago. The thread is cut. You are a porter. Get off my drill-yard."],
        ],
        done: "Ah Lou gets off the drill-yard. She walks as far as the stair, and sits down on it, and stays there.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "What Severing Severs",
        objective: "Wen Qi has found how the Guard's severing is done.",
        lines: [
          ["tj-wenqi", "They don't just let go. The Array does it. It cuts the thread between two tablets and takes what ran along it. Love, mostly. It weighs a great deal, love. It's the heaviest thing in the ledgers."],
          ["tj-wenqi", "The Severed are the Array's best supply. Every one of them sent up everything they felt for someone. And then they guard the summit."],
          ["tj-wenqi", "Lou Feng sent up her husband and her daughter. The ledger says: forty years of love, credited."],
        ],
        done: "Wen Qi closes the ledger and sits on the stair beside Ah Lou, and says nothing at all, which is the right thing.",
      },
      {
        step: 36,
        npc: "tj-patron",
        title: "The Dog",
        objective: "Shi Wu asks you to go down to the Silver Tier with him. He won't say why.",
        lines: [
          ["narr", "A courtyard behind a shophouse on the Silver Tier. An old yellow dog asleep in the sun. It lifts its head when Shi Wu comes through the gate."],
          ["tj-shi", "He doesn't know he's severed. I sent up everything I felt for him. He didn't send up anything. Dogs don't have tablets."],
          { a: "tj-shi", n: "kneel" },
          ["tj-shi", "…I don't feel anything. I wanted to see if I would."],
        ],
        done: "The dog licks his hand anyway. Shi Wu stays crouched there long after they should have gone back up.",
      },
      {
        step: 45,
        npc: "tj-ahlou",
        title: "Every Day at the Stair",
        objective: "Ah Lou has come back to the Thunder Tier's drill-yard every day for a month. Go to her.",
        lines: [
          ["tj-ahlou", "She drills at dawn. I sit on the stair. She doesn't look. I don't leave. That's the whole thing."],
          ["tj-ahlou", "Yesterday she missed a stroke. Her spear went wide. The guard behind her stared. She's never missed a stroke."],
        ],
        done: "At dawn the next day, Lou Feng's spear goes wide again, and she does not look at the stair, very carefully.",
      },
      {
        step: 58,
        npc: "tj-patron",
        title: "Can a Thread Be Tied Again",
        objective: "Ask Shi Wu whether a severed thread can be tied again.",
        lines: [
          ["tj-shi", "The Array takes what runs along the thread. It doesn't give it back. Nothing comes down the stair once it's gone up."],
          ["tj-shi", "Unless someone heavier than the Array ties it. Nobody is heavier than the Array, Exalted One. Not even the Sovereign. He's tied to it like the rest of us."],
        ],
        choice: {
          prompt: "Shi Wu asks what you would do with the thread between the captain and her daughter.",
          options: [
            { heart: "mercy", label: "“Leave it to them. Ah Lou will tie it herself.”", then: "Shi Wu considers this for a long time, as if it were an order in a language he used to speak.", reply: ["tj-patron", "The mud tying a thread the Array cut. …I'd like to see that. I think I'd like to see that."] },
            { heart: "balance", label: "“Tie it with Lou Shan's spring, from the jar.”", then: "She tells him about the jar, and the sleeping house, and the warm hands.", reply: ["tj-patron", "A year of the husband she severed, to tie the daughter. That's — that's arithmetic. The Array understands arithmetic."] },
            { heart: "sword", label: "“Cut the Array's hold on her, and see what's left.”", then: "Shi Wu looks at his own hands. “And on me?” he asks.", reply: ["tj-patron", "If you can cut the Array off the captain, you can cut it off the Guard. All of us. …Would we still be anyone?"] },
            { heart: "slaughter", label: "“Sever her from the Array the way she severed them.”", then: "Shi Wu is quiet. Then: “That would kill her, Exalted One. The Array's all she has left.”", reply: ["tj-patron", "But you know that. You'd do it anyway. …The Guard would follow you, I think. That frightens me. Thank you. It's good to be frightened."], effect: feed(2) },
          ],
        },
        done: "That night, for the first time, Shi Wu takes off his mask to sleep.",
      },
      {
        step: 67,
        npc: "tj-wenqi",
        title: "The Ninth Gate",
        objective: "Wen Qi has learned what Lou Feng guards.",
        lines: [
          ["tj-wenqi", "The Ninth Gate is the stair to the summit. To Heaven's Step. Lou Feng holds it. At the conjunction she'll open it for the Sovereign, and close it behind him, and hold it while the Array draws the city's threads."],
          ["tj-wenqi", "Every mortal thread in Tianjie, Exalted One. Including her daughter's. She'll be standing at the gate when it happens. She'll feel nothing. That's what she's for."],
        ],
        done: "Wen Qi says this very calmly. Then he goes and is sick behind the drum tower.",
      },
      {
        step: 76,
        npc: "tj-ahlou",
        title: "A Song She Used to Sing",
        objective: "Ah Lou is going to sing on the stair. She asks you to stand by her.",
        lines: [
          ["narr", "A porter's song. A Mud Tier song for carrying bells up the stair, with a line for every gate. Ah Lou sings it badly and loudly at the foot of the Thunder Gate, all nine gates of it."],
          ["narr", "On the drill-yard the Severed Guard stop. At the last line, the captain's spear falls out of her hand."],
          ["tj-boss", "…That was my song. That was — I taught you that. I don't remember teaching you that. Why do I know every word?"],
        ],
        done: "Lou Feng picks up her spear, and walks away very fast, and does not drill again that day.",
      },
      {
        step: 85,
        npc: "tj-patron",
        title: "The Guard Divided",
        objective: "Half the Severed Guard have taken off their masks. Shi Wu asks you to come.",
        lines: [
          ["narr", "The drill-yard is split down the middle. On one side, masks. On the other, faces, uncertain, some wet."],
          ["tj-shi", "The captain has ordered the unmasked off the tier. She says the conjunction is close. She says nothing must be behind us when it comes."],
          ["tj-shi", "Exalted One, I went to see the dog again. I felt something. It was very small. I'm not giving it back."],
        ],
        choice: {
          prompt: "Both halves of the Severed Guard are looking at the one cultivator on the tier who has severed nothing.",
          options: [
            { heart: "mercy", label: "Stand with the unmasked, unarmed", then: "She walks across the drill-yard and stands among the unmasked with her hands empty. Two more masks come off.", reply: ["tj-patron", "Two more. They didn't decide. Their hands did. I know how that feels now."] },
            { heart: "sword", label: "Stand between the two halves, sword drawn", then: "She plants herself in the middle of the yard. Nobody on either side will cross her blade to reach the other.", reply: ["tj-patron", "Nobody will fight through you, Exalted One. Not today. That's a day we didn't have."] },
            { heart: "balance", label: "Tell them both to go home for one night and come back", then: "She tells every guard, masked and not, to go down the stair for one night to whoever they severed, and come back if they still want to.", reply: ["tj-patron", "Half came back. Half of them didn't. The captain counted. She didn't say anything."] },
            { heart: "slaughter", label: "Tell the masked to take theirs off, or you will", then: "Every mask on the tier comes off. Nobody is sure, afterwards, who took them off.", reply: ["tj-patron", "They're unmasked. They're also afraid. That isn't what I meant by feeling something, Exalted One."], effect: feed(3) },
          ],
        },
        done: "The unmasked stand their ground. So does the captain. Between them, the Ninth Gate's seal hums like a bell about to ring.",
      },
      {
        step: 98,
        npc: "tj-ahlou",
        title: "The Captain of the Ninth Gate",
        objective: "Lou Feng holds the Ninth Gate against the conjunction. Ah Lou has gone to stand before her. Go.",
        lines: [
          ["narr", "Lou Feng at the foot of the last stair, her spear across it. Ah Lou in front of her with her basket on her back, very small."],
          ["tj-ahlou", "You can't sever me again. I'm already severed. I just kept coming up the stair anyway."],
        ],
        done: "Lou Feng lifts her spear, not at Ah Lou. At the cultivator behind her.",
      },
    ],
    petitions: [
      "“A sealed message to the Ninth Gate, carried by someone who isn't severed. Thank you, Exalted One. We can't carry messages any more. We don't remember why they matter.”",
      "“You drilled with the unmasked this morning. You missed a stroke on purpose. They noticed.”",
      "“A mask, returned to the armoury. Its owner didn't want it any more. He didn't want to give it back himself.”",
      "“The dog's fed. You went down nine gates to feed a dog. Every guard on the tier is talking about it.”",
      "“A letter to a wife on the Copper Tier. He doesn't remember what to say. You wrote it with him.”",
    ],
    ahlou: [
      "Nobody up here laughs. Nobody up here cries. They just drill.",
      "Shi Wu let me pat his dog. He watched me do it the whole time like he was trying to learn how.",
      "I'm not going to cry in front of her. I'm going to sing in front of her. That's worse.",
      "Father says she had my nose. She does. She's got my nose and she's not using it for anything.",
    ],
    boss: {
      intro: "Lou Feng, Captain of the Ninth Gate, levels her spear across the last stair",
      words: [
        ["tj-boss", "Nothing behind me. That's the oath. I cut everything I loved and sent it up the stair so the city could rise. Do you know what it costs, to keep standing here and feel nothing?"],
        ["tj-boss", "You stand at {realm} and you've severed nothing. Then you're not Spirit Severing. You're a liar with a tablet. Let me show you severing."],
      ],
      fates: [
        { heart: "mercy", label: "Step aside, and let Ah Lou reach her", line: "Lin Yue steps out of the way. Ah Lou walks up to her mother, very slowly, the way you walk up to a frightened horse, and puts her arms round her. Lou Feng stands there, spear in hand, feeling nothing, and then feeling everything at once, and goes down on her knees on the last stair." },
        { heart: "sword", label: "Cut the Array's thread out of her", line: "One stroke, very fine, and the thread that runs from Lou Feng's tablet up to the summit parts. Everything the Array took from her it cannot give back. But it can no longer take any more. She looks at Ah Lou with nothing in her face, and then, slowly, something." },
        { heart: "balance", label: "Pour Lou Shan's spring into her hands", line: "She gives Lou Feng the last of the jar of Lou Shan's spring. Lou Feng breathes it in and smells a Mud Tier roof in the rain, and a man singing a porter's song, and a child laughing under the roof, and she knows the child, and the child is here." },
        { heart: "slaughter", label: "Sever her from the Array, and let her fall", line: "She cuts Lou Feng loose from the Array entirely, as one would sever a rope. The captain falls down the last stair and does not get up. Ah Lou sits beside her for a very long time, and does not look at Lin Yue at all." },
      ],
      victory: "The Ninth Gate stands open, its seal guttering. Above it, the last stair climbs to Heaven's Step, and the conjunction is very close.",
    },
  },
  // ------------------------------------------------------------------------------------------------ X · Heaven's Step
  {
    title: "Heaven's Step",
    hanzi: "天阶",
    level: 18,
    beats: [
      {
        step: 0,
        npc: "tj-warden",
        title: "The Last Stair",
        objective: "Climb the last stair to Heaven's Step.",
        lines: [
          ["tj-warden", "Spirit Severing, late. The seal parts. Pass, Exalted One. The Sovereign is expecting you. He has had a second seat built."],
          ["narr", "Heaven's Step is a single marble terrace at the top of the world, the summit of the mountain cut flat, and on it a palace with golden doors, and in front of the palace, a man in white and gold looking down at the city as if it were a garden he had planted."],
        ],
        done: "From the top of the stair she can see all nine tiers below her, and the strait of cloud, and Jinhe, and on a very clear day the sea of clouds in the north where the Azure Cloud floats.",
      },
      {
        step: 9,
        npc: "tj-gao",
        title: "The Sovereign of the Stair",
        objective: "Gao Qiong, Sovereign of the Stair, waits on Heaven's Step.",
        lines: [
          ["tj-gao", "Lin Yue. Sit. I had the chair carved from the same stone as mine. I have read your chart, your tablet, the Registry's ledger and every record of the Tribunal you disturbed. You are very heavy, Exalted One."],
          ["tj-gao", "I have never taken a single year for myself. Wen Qi will have told you. Every jar is in the Array. Every thread. For the Ascent."],
          ["tj-gao", "Heaven is real. I have felt it, at the top of Spirit Severing, pressing on the sky like a ceiling. A whole city could pass through. Not one cultivator, Exalted One. Everyone. All nine tiers, taken up at once, by order."],
          ["hero", "And the Mud Tier?"],
          ["tj-gao", "The Mud Tier is the step. A step is not taken up. It is stood on. That is what a step is for."],
        ],
        done: "The Sovereign offers her the second seat. It is very comfortable. From it you can see every tier, and none of the faces.",
      },
      {
        step: 18,
        npc: "tj-ahlou",
        title: "A Porter on the Summit",
        objective: "Ah Lou has come up the last stair after you. She's standing on Heaven's Step with her basket.",
        lines: [
          ["tj-ahlou", "I said I'd see the top once. I've seen it. It's marble. My father carried this marble up. Every slab."],
          ["tj-gao", "A mortal on the Step. Under the Code, a mortal who reaches the summit by challenge… there has never been one. What do you want, child?"],
          ["tj-ahlou", "I want my father to wake up."],
        ],
        done: "The Sovereign looks at Ah Lou for longer than he has looked at anyone in two hundred and forty years.",
      },
      {
        step: 27,
        npc: "tj-wenqi",
        title: "The Array's Heart",
        objective: "Wen Qi has found the heart of the Stair Array, under the palace.",
        lines: [
          ["narr", "Under Heaven's Step, a hall of bronze and jade, and in the middle a great steelyard, a hundred times the size of the Weighing Hall's, its pan heaped with jars of mist, its beam hung with ten thousand threads."],
          ["tj-wenqi", "This is where every thread goes. The Weighing Hall's pan, the Tribunal's balance, every tablet I ever stamped. All of it weighs on this beam. When it tips, the city rises."],
          ["tj-wenqi", "It's so close to tipping, Exalted One. It needs one more weight. A heavy one."],
        ],
        done: "The beam trembles as she stands near it, as if it can feel how much she weighs.",
      },
      {
        step: 36,
        npc: "tj-gao",
        title: "The Second Seat",
        objective: "The Sovereign has a request.",
        lines: [
          ["tj-gao", "Stand on the pan, Exalted One. Your weight, at {realm}, would tip the beam without a single mortal thread. I have done the arithmetic."],
          ["tj-gao", "The city rises. Nobody below is drawn. You and I go first, through the ceiling, and the nine tiers follow. That is the bargain I have looked for for two hundred and forty years. I did not think it would come walking up the avenue with a porter."],
        ],
        choice: {
          prompt: "Stand on the great pan, and lift the city to heaven on your own weight?",
          options: [
            { heart: "mercy", label: "“Not to heaven. Down. Let it come down to the land.”", then: "She tells him to use her weight to lower the city instead: to set every tier on the same ground. He laughs. Then he stops.", reply: ["tj-gao", "Down. Nobody has ever asked the Array to go down."] },
            { heart: "balance", label: "“I'll stand on it when every tier can stand on it with me.”", then: "She says she will step on the pan beside the Mud Tier and no sooner.", reply: ["tj-gao", "Every tier on one pan. Then nobody would be lifted, Exalted One. That's not an Ascent. That's a floor."] },
            { heart: "sword", label: "“No. Your Array ends today.”", then: "She tells him plainly. He nods, as if he had expected it.", reply: ["tj-gao", "Then we will settle it the old way. Under the Code. A challenge. You, a step below me, may name me. Name me, then."] },
            { heart: "slaughter", label: "“I'll stand on it. And you'll stand under it.”", then: "She tells him what she would do with a city that rises on her own weight. The Sovereign, for the first time, looks afraid.", reply: ["tj-gao", "…I have built a stair for two hundred and forty years. I see now I built it for someone like you. That is the worst thing I have ever understood."], effect: feed(3) },
          ],
        },
        done: "The great beam under Heaven's Step trembles, waiting.",
      },
      {
        step: 45,
        npc: "tj-ahlou",
        title: "The Basket",
        objective: "Ah Lou has something in her basket for the Sovereign.",
        lines: [
          ["narr", "Ah Lou empties her basket on the marble in front of the Sovereign. The persimmon wrapper with the names. A clay tablet. A forged Silver one. The ashes of a chart. An empty jar labelled 'Lou Shan, Spring'. A red thread, cut. A broken bead from an abacus."],
          ["tj-ahlou", "This is what came up the stair. All of it. I carried it."],
        ],
        choice: {
          prompt: "The Sovereign looks up from the persimmon wrapper, at you.",
          options: [
            { heart: "mercy", label: "Kneel beside him and read the names with him", then: "She kneels on the marble beside the Sovereign of the Stair and reads the names aloud with him, one by one, all the way to the bottom.", reply: ["tj-gao", "I knew the numbers. Every one. I never knew a single name."], effect: quiet(3) },
            { heart: "balance", label: "“Now weigh them, as your city weighs everyone.”", then: "She sets the persimmon wrapper on the Sovereign's own palm, and waits.", reply: ["tj-gao", "…It weighs nothing. Of course it weighs nothing. And I cannot lift my hand."] },
            { heart: "sword", label: "“That is your city. Look at it.”", then: "She says nothing else. The Sovereign looks.", reply: ["tj-gao", "I have looked down from this step for two hundred and forty years. I am looking now."] },
            { heart: "slaughter", label: "Crush the wrapper in your fist", then: "The names crumple in her fist. Ah Lou cries out as if struck.", reply: ["tj-gao", "So. You and I are the same after all, Exalted One. The names are only paper, to us."], effect: feed(3) },
          ],
        },
        done: "The Sovereign kneels, slowly, in white and gold, and reads the names on the persimmon wrapper one by one.",
      },
      {
        step: 58,
        npc: "tj-wenqi",
        title: "The Ledger's Last Page",
        objective: "Wen Qi has finished the arithmetic. He wants you to read it.",
        lines: [
          ["tj-wenqi", "If the Array lets go — not tips, lets go — every thread runs back the way it came. Every year goes back down the stair. Not to the sleepers only. To everyone it came from. The Cloud elders will die. The Severed will feel. The clans will be poor."],
          ["tj-wenqi", "And the city will sink. Not fall. Sink. Nine tiers settling, slowly, into one mountain. It will take a year. Nobody will die of it. Except the stair."],
        ],
        done: "Wen Qi signs the last page of the ledger in his own name, as a witness, for the first time.",
      },
      {
        step: 67,
        npc: "tj-gao",
        title: "The Conjunction Rises",
        objective: "The fated star is rising over the summit. The Sovereign wants to speak.",
        lines: [
          ["narr", "Above Heaven's Step, in daylight, a star. The great beam under the palace groans. Down the mountain, on every tier, people look up."],
          ["tj-gao", "Whatever you have done to the charts, the conjunction comes. The Array will draw what it can. If nobody stands on the pan, it draws the mud. I can't stop it, Exalted One. I built it not to be stopped."],
        ],
        done: "On the Mud Tier, in the sleeping house, two hundred sleepers stir at once, and go still.",
      },
      {
        step: 76,
        npc: "tj-ahlou",
        title: "Every Tier on the Avenue",
        objective: "The whole city has come up the avenue. Every gate is open. Go and see.",
        lines: [
          ["narr", "Every seal has guttered out. Up the avenue, gate by gate, the city is climbing: porters, smiths, forgers, Jade daughters, clan heirs, advocates, old elders leaning on young ones, star-readers, unmasked guards. Granny Pot with a pot of soup. Bellows Hua. Faceless Liu. Su Wan with her flute. Pei Lan. Yun Shu. Xing'er. Shi Wu with a yellow dog."],
          ["tj-ahlou", "If the stair's going to draw us, it can draw us up here, where it has to look at us."],
        ],
        done: "The marble of Heaven's Step is full from edge to edge of people of every tier, and nobody can tell which is which.",
      },
      {
        step: 85,
        npc: "tj-wenqi",
        title: "The Weight of Everyone",
        objective: "Wen Qi says the Array has noticed the crowd.",
        lines: [
          ["tj-wenqi", "Every thread on the Step at once. The beam can't decide which way to tip. It's never had everyone in one place before."],
          ["tj-wenqi", "The Sovereign's gone down to the beam, Exalted One. He's going to stand on the pan himself. He'll tip it the only way he knows. Up."],
        ],
        done: "Under Heaven's Step, the great beam begins, very slowly, to move.",
      },
      {
        step: 98,
        npc: "tj-ahlou",
        title: "The Ascent of the Stair",
        objective: "Gao Qiong stands on the great pan of the Stair Array, under Heaven's Step. Go down to him.",
        lines: [
          ["narr", "The hall of the Array, every thread taut. The Sovereign on the pan, in white and gold, his soul blazing, his weight added to the city's, and the beam rising."],
          ["tj-ahlou", "He's lifting it! Exalted One — the city's lifting!"],
        ],
        done: "Gao Qiong turns on the pan. Behind him, through the hall's high window, the strait of cloud is falling away.",
      },
    ],
    petitions: [
      "“A message for every tier at once: the gates are open. Carried by the only person every seal still parts for. Thank you.”",
      "“You sat with the Sovereign in silence for an hour. He says it was the first silence anyone has offered him that wasn't fear.”",
      "“Soup, carried up all nine gates. Granny Pot insisted. The Sovereign ate it. He didn't know what to do with his hands.”",
      "“A list of every sleeper, for the Array's hall. Wen Qi wrote it. You carried it down.”",
      "“You stood on the edge of the Step and looked down at every tier for a long time. Everyone below looked up.”",
    ],
    ahlou: [
      "It's windy up here. You'd think heaven would be less windy.",
      "The marble's cold. My father carried it in winter. I can tell.",
      "The Sovereign asked me what porters eat. I told him. He wrote it down.",
      "I'm on the top of the stair. I thought I'd feel taller.",
    ],
    boss: {
      intro: "Gao Qiong, Sovereign of the Stair, blazing on the great pan as the city lifts off its mountain",
      words: [
        ["tj-gao", "Order is the only mercy heaven allows, Exalted One. Every soul in its place, every place on a stair, and the stair going up. I have given my whole life to it. I have taken nothing."],
        ["tj-gao", "You weigh {realm}. I weigh a city. Step onto the pan, or step off the mountain."],
      ],
      fates: [
        { heart: "mercy", label: "Let the Array go, and the city sink to the land", line: "She lays her hand on the beam, not to tip it but to let go of it, and every thread in the hall goes slack at once. The years run back down the stair like water down a terrace. The city settles, a hand's width a day, for a year." },
        { heart: "balance", label: "Re-carve the Stair Code: every gate open to anyone who climbs, and nothing drawn", line: "She carves the new Code into the beam itself, with Wen Qi beside her and Ah Lou holding the lamp: “Each tier open to anyone who climbs it. No thread drawn. No word weighed.” The beam settles level, and stays level." },
        { heart: "sword", label: "Cut the beam in two", line: "One stroke, through bronze and jade and ten thousand threads. The pan falls. The Sovereign falls with it, onto a marble floor, a man of two hundred and forty years who has never once been tired, very tired." },
        { heart: "slaughter", label: "Take the pan, and the city, for yourself", line: "She steps onto the pan and pushes the Sovereign off it. The beam tips. The city lifts, a hand's width, toward a heaven that does not open, and hangs there, and is hers." },
      ],
      victory: "Under Heaven's Step, the great steelyard of the Stair Array stands still. Above it, the conjunction passes, and the fated star goes back to being only a star.",
    },
  },
];
