import type { GameState } from "../engine/state";
import { CULT, shift } from "../engine/cultivation";
import type { Beat, Fate } from "./hallsBooks";

/**
 * The words of the Hundred Peoples (story/peoples.ts composes the quests):
 * six books, one for each people and its home. Each is a tale of its own
 * told in hand-written beats, and between the beats the life of the home:
 * its rites (main quests), its folk's favours, goods carried between the
 * peoples, tales carried to the human jianghu, hunts, sittings and walks
 * (side quests).
 *
 * Under all six runs one question: what a people owes a stranger, and a
 * stranger a people. The Concord of a Hundred Peoples, cracked three hundred
 * years ago when the sects hunted "strange blood" through the jianghu, once
 * answered it. Lin Yue carries its envoy's tally from home to home, and each
 * people decides whether to set its mark on it again.
 *
 * Keys: "pe-elder" and "pe-guide" are this book's people's elder and guide,
 * "pe-folk-<n>" one of its folk, "pe-envoy" Envoy Shan at the Concord Stone,
 * and "pe-boss" this book's trouble. Lines may name her standing: {title}
 * (what a mortal calls her), {peer} (what a cultivator calls her) and
 * {realm}.
 */

export interface PeopleBook {
  title: string;
  hanzi: string;
  /** The realm the book asks of her as it opens (an overall level index). */
  level: number;
  beats: Beat[];
  /** The rites of the home (main quests between the beats): a title, what she must do, and how it goes. */
  rites: { title: string; ask: string; done: string }[];
  /** The folk's favours (side quests): what is asked, and what is said when it is done. */
  favours: { ask: string; done: string }[];
  /** What the people send to the other peoples (trade side quests). */
  goods: string[];
  /** What the human jianghu says when she tells it of this people (tale side quests). */
  tales: string[];
  /** What the elder and the guide say between the beats. */
  elder: string[];
  guide: string[];
  boss: { intro: string; words: [string, string][]; fates: Fate[]; victory: string };
}

const feed = (by: number) => (g: GameState) => shift(g, CULT.demon, by);
const quiet = (by: number) => (g: GameState) => shift(g, CULT.demon, -by);

export const PEOPLE_BOOKS: PeopleBook[] = [
  // ------------------------------------------------------------------------------------------------ I · the Fox-Folk
  {
    title: "The Moon Pearl Wanes",
    hanzi: "月珠渐亏",
    level: 2,
    beats: [
      {
        step: 0,
        npc: "pe-envoy",
        title: "The Concord Stone",
        objective: "An old scholar is reading the cracked stele by the crossroads teahouse, below Willow Creek. Ask him what it says.",
        lines: [
          { a: "pe-envoy", n: "read" },
          ["pe-envoy", "You can see the marks? Most people see a stone with a crack in it. Here: a fox's paw. A fish-scale. A feather. A horn. A dragon's claw. A hand. A hundred marks, once."],
          ["pe-envoy", "The Concord of a Hundred Peoples. Before there were sects, the peoples of the jianghu swore on this stone not to hunt one another. Three hundred years ago the sects called it the Purge of Strange Blood, and hunted anyway. The stone cracked the same night."],
          ["pe-envoy", "I am Shan, its last envoy. Its last everything. I am too old to walk to the peoples, and they would not open their doors to me if I did. They might, to a cultivator who does not hunt them."],
          { a: "pe-envoy", n: "offerpearl" },
        ],
        after: [["pe-envoy", "This is the Concord's tally. Take it to Moonfox Hollow, in the maple woods south of the steppe, where the fox-folk keep a pearl that hides them from hunters. If they will set their mark on it again… it would be a beginning, {title}."]],
        done: "A tally of old bamboo, split down its length, hangs at her belt. Ninety-nine of its notches are empty.",
      },
      {
        step: 20,
        npc: "pe-elder",
        title: "An Oath in the Hollow",
        objective: "Find Grandmother Su Yao, matriarch of the fox-folk, at the moon altar of Moonfox Hollow, in the maple woods south of the steppe.",
        lines: [
          ["narr", "Blue fox-fire burns in the lanterns of Moonfox Hollow at noon. The fox-folk stop what they are doing and watch her come in, every ear turned toward her."],
          ["pe-elder", "A human. With a sect's token, and the Concord's tally beside it. The token kills us. The tally once kept us. Which of them are you carrying for, child?"],
          ["pe-elder", "In the hollow we have one law. Whatever you say here, you must mean to the letter. A fox may trick you. A fox may never lie to you. Swear it, or go."],
        ],
        choice: {
          prompt: "Grandmother Su Yao waits for her oath.",
          options: [
            { heart: "mercy", label: "Swear it, and mean it", then: "She swears, plainly, the way she would promise Granny Hua to be home for supper.", reply: ["pe-elder", "Simple. Good. The simple ones are the hardest to keep."], effect: quiet(2) },
            { heart: "sword", label: "Swear it on her blade", then: "She lays her sword across her palms and swears on the edge of it.", reply: ["pe-elder", "On the blade. Very well. A blade is honest about what it is for."] },
            { heart: "balance", label: "Swear to keep it as they keep theirs", then: "She swears to keep the hollow's law exactly as faithfully as the hollow keeps it with her.", reply: ["pe-elder", "Hah! A fox's oath. You'll do well here, child."] },
            { heart: "slaughter", label: "Refuse; she swears to no one", then: "She tells the matriarch that her word is her own business. The hollow goes very quiet.", reply: ["pe-elder", "Then you will be watched. Every hour. Don't mind the ears."], effect: feed(3) },
          ],
        },
        done: "Su Yao presses a thumb to the tally. When she lifts it, there is a fox's paw burned faintly into the bamboo, not yet dark: a promise of a mark, kept back until the hollow sees what she does.",
      },
      {
        step: 40,
        npc: "pe-guide",
        title: "The Moon-Eaten",
        objective: "Bai Ling, a young fox of the hollow, has been watching the moon pearl. Hear what she has seen.",
        lines: [
          ["pe-guide", "You're the oath-human. Grandmother says I'm to show you the hollow and not play any tricks on you. I'll try. I'm not good at not."],
          ["pe-guide", "Look at the pearl. Every night it's a little dimmer. When it goes out, the hunters' dogs will smell us again, and the sects' nets will find the hollow."],
          ["pe-guide", "And there are foxes in the woods with moonlight running out of their mouths. They don't know their own names. Something's been feeding them the pearl's light, and it's eating them while it does."],
          { a: "pe-guide", n: "cry" },
        ],
        done: "Bai Ling shows her the trail of silver drops the moon-eaten foxes leave on the maple leaves. It leads west, toward the Fox-Fire Glade.",
      },
      {
        step: 60,
        npc: "pe-folk-3",
        title: "A Debt of Stories",
        objective: "An old fox prays to the moon on the hollow's edge every night. Bai Ling says he owes a debt nobody can pay. Ask him what it is.",
        lines: [
          ["pe-folk-3", "In the hollow we pay what we owe in stories. A meal, one story. A life saved, a hundred. I owe a thousand, to a human woman who hid me from the Purge in her rice-barrel."],
          ["pe-folk-3", "She died before I could pay. Three hundred years I have been telling her stories to the moon, in case the moon passes them on."],
          { a: "hero", n: "nod" },
          ["pe-folk-3", "If you would carry one or two back to her people when you go… the debt would be lighter. A human ear. That's what was owed."],
        ],
        done: "He tells her a story about a rice-barrel. It is very short, and very funny, and at the end of it he is crying.",
      },
      {
        step: 80,
        npc: "pe-elder",
        title: "The Grandson",
        objective: "Su Yao sends for her. The matriarch knows who is drinking the moon.",
        lines: [
          ["pe-elder", "I lied to you, child, the first day. Not with words. With a silence, which is how foxes lie. I know who is eating the pearl's light."],
          ["pe-elder", "Hu Yan. My grandson. Seven tails, and he wants nine, and the nine-tailed are taken up to heaven's moon palace. He says the hollow is a burrow, and heaven a home. He would eat the pearl whole on the full moon, and leave us bare to the dogs."],
          ["pe-elder", "He is my blood. What would you have me do?"],
        ],
        choice: {
          prompt: "Grandmother Su Yao asks what she should do about her grandson.",
          options: [
            { heart: "mercy", label: "Talk to him first", then: "She says a grandson can still be talked to, and offers to go and talk.", reply: ["pe-elder", "He will trick you. Let him. It is how he says he is listening."] },
            { heart: "sword", label: "Stop him before the full moon", then: "She says the hollow comes before one fox's ambition, and she will stand between him and the pearl.", reply: ["pe-elder", "Yes. Someone has to. I am glad it is not me."] },
            { heart: "balance", label: "Let the hollow decide", then: "She says it is the hollow's pearl and the hollow's grandson, and asks that the hollow be told.", reply: ["pe-elder", "Tell them the truth? In a fox hollow? That would be a trick no one has tried."] },
            { heart: "slaughter", label: "Kill him and be done", then: "She says a thief who would leave his people to the dogs has already left them.", reply: ["pe-elder", "…I asked. I should not have asked a sword."], effect: feed(4) },
          ],
        },
        done: "Su Yao sits a long while by the moon altar with her tails wrapped round her feet, the way old foxes sit in snow.",
      },
      {
        step: 120,
        npc: "pe-guide",
        title: "The Secret Path",
        objective: "Bai Ling has been avoiding her for days. Find out why.",
        lines: [
          ["pe-guide", "It was me. I showed Hu Yan the path through the glade the hunters can't follow. He said he'd take me with him, up to the moon. Nobody's ever wanted to take me anywhere."],
          { a: "pe-guide", n: "cry" },
          ["pe-guide", "If I tell Grandmother she'll put me out of the hollow. Will you tell her? You swore to mean everything here. Does that mean you have to say everything too?"],
        ],
        choice: {
          prompt: "Bai Ling asks whether she will tell the matriarch.",
          options: [
            { heart: "mercy", label: "Keep her secret, and help her tell it herself", then: "She tells Bai Ling a secret kept is not a lie, and that she'll stand beside her when she's ready.", reply: ["pe-guide", "Beside me. Not in front. All right. All right."] },
            { heart: "sword", label: "Tell Su Yao at once", then: "She goes straight to the matriarch and tells her everything.", reply: ["pe-guide", "…You meant it. All of it. I hate that I like that."] },
            { heart: "balance", label: "Say nothing either way", then: "She says she swore not to lie, not to tell tales, and walks on.", reply: ["pe-guide", "A fox's answer. From a human! Grandmother will laugh herself sick."] },
            { heart: "slaughter", label: "Use it to make her guide you to Hu Yan", then: "She tells Bai Ling she will keep quiet for as long as Bai Ling is useful.", reply: ["pe-guide", "That's… that's a trick. That's a good trick. I wish you hadn't."], effect: feed(3) },
          ],
        },
        done: "Bai Ling walks her the secret path through the Fox-Fire Glade. Every few steps she looks back, the way someone looks back at a door they are not sure they closed.",
      },
      {
        step: 140,
        npc: "pe-envoy",
        title: "What the Stone Remembers",
        objective: "Go back to Envoy Shan at the Concord Stone, and tell him what the fox-folk asked of you.",
        lines: [
          ["pe-envoy", "A paw, half-burned into the tally. They're waiting to see what you do. Of course they are. The last human who carried the tally to them was the one who led the Purge to their door."],
          ["pe-envoy", "My master's master. Envoy Ruan. He carried their trust to the sects, and the sects used it as a map."],
          { a: "pe-envoy", n: "bow" },
          ["pe-envoy", "So. When they make you wait, don't be hurt. Be patient. Patience is the only apology a human has left that they'll accept."],
        ],
        done: "The envoy writes Envoy Ruan's name on a slip of paper and burns it at the foot of the Concord Stone. He does not say a prayer. He says sorry.",
      },
      {
        step: 160,
        npc: "pe-folk-1",
        title: "The Moon Dance",
        objective: "The hollow's moon-dancer will teach her the dance that calls the pearl's light home. Find her in Moonfox Hollow.",
        lines: [
          ["pe-folk-1", "The pearl answers the dance. It always has. The dance is a story told with feet: the night the first fox caught the moon in a lake and would not let go."],
          { a: "pe-folk-1", n: "moondance" },
          ["pe-folk-1", "You have heavy feet, human. Good. The moon likes being stamped at. Again."],
          { a: "hero", n: "moondance" },
        ],
        choice: {
          prompt: "The dancer asks what story her own feet are telling.",
          options: [
            { heart: "mercy", label: "A story of coming home", then: "She dances Willow Creek at dusk, and someone calling her in.", reply: ["pe-folk-1", "The pearl liked that. Look, it's brighter."] },
            { heart: "sword", label: "A story of a single cut", then: "She dances one long, clean step, and stops.", reply: ["pe-folk-1", "Short. The moon is used to longer. It'll learn."] },
            { heart: "balance", label: "A story of the moon itself", then: "She dances the moon going round, which is a dance that never ends, so she stops it in the middle.", reply: ["pe-folk-1", "The middle is the best place to stop a round thing."] },
            { heart: "slaughter", label: "A story of a hunt", then: "She dances the Purge, as she imagines it. The hollow stops to watch, and does not like it.", reply: ["pe-folk-1", "The pearl remembers that one. It went dim. Don't."], effect: feed(2) },
          ],
        },
        done: "That night the moon pearl is a little brighter, and the fox-folk dance round it until dawn, and leave a space in their circle for her.",
      },
      {
        step: 180,
        npc: "pe-elder",
        title: "The Paw on the Tally",
        objective: "Su Yao has made up her mind about the tally. Go to her at the moon altar.",
        lines: [
          ["pe-elder", "You kept your oath. Not perfectly. Nobody keeps an oath perfectly; foxes only pretend to. But in the hollow we have been watching how you fail, and you fail toward us."],
          { a: "pe-elder", n: "offerpearl" },
          ["pe-elder", "The fox-folk set their mark on the Concord again. One paw, burned dark. If the Purge comes back, it will be on your soul, child, and on the stone."],
          ["narr", "Out in the glade, a fox screams. Not a moon-eaten fox. A fox with seven tails."],
        ],
        done: "The first notch of ninety-nine is filled: a fox's paw, burned dark and smelling faintly of maple smoke.",
      },
      {
        step: 198,
        npc: "pe-guide",
        title: "The Full Moon",
        objective: "It is the night of the full moon. Bai Ling is waiting for her at the moon altar.",
        lines: [
          ["pe-guide", "He's coming. I can smell him. He smells like the moon tastes, cold and too sweet."],
          ["pe-guide", "Grandmother's at the altar with her back to it, so she won't have to watch. Will you stand with her? I'll stand with you. I'm a fox. I'll stand behind you. But close."],
          { a: "pe-guide", n: "moondance" },
        ],
        done: "The moon comes up over the maples, enormous, and the pearl in the altar flares to meet it. Out of the light walks a fox with seven tails and a fan.",
      },
    ],
    rites: [
      { title: "Fox-Fire Lamps", ask: "light the hollow's fox-fire lamps with Bai Ling at dusk, one breath of qi to each", done: "Blue flames bloom one by one round the hollow. Bai Ling lights the last from her own tail, and pretends it didn't hurt." },
      { title: "A Story for a Meal", ask: "pay for your supper the fox way: tell Grandmother Su Yao a story she has never heard", done: "She tells the one about Abao and the frog. Su Yao laughs so hard her ears go flat. “Paid. With change.”" },
      { title: "The Oath-Stone", ask: "renew your oath at the moon altar, as every guest of the hollow must at each new moon", done: "She lays her hand on the cold white stone and says it again. It is easier the second time, and means more." },
      { title: "Teaching Trickery", ask: "let the hollow's cubs play one trick on you, as is owed to every guest who stays a month", done: "They tie her sash to a maple root while she is asleep. She trips. The hollow decides she is family." },
      { title: "Moonlight Watch", ask: "keep watch by the moon pearl from moonrise to moonset, so no moon-eaten fox can drink from it", done: "Nothing comes. At dawn Su Yao brings her tea and says nothing comes because something was watching." },
      { title: "Names Returned", ask: "help the elder sing back the name of a moon-eaten fox who was brought home", done: "The fox lies very still while they sing. At the end, he says his name himself, in a small voice, and goes to sleep." },
    ],
    favours: [
      { ask: "find a lost tail-comb in the maples (the lamp-keeper dropped it when the moon-eaten came)", done: "“My comb! A fox without a comb is a fox with burrs. You have saved my dignity, which is the most expensive thing I own.”" },
      { ask: "carry a borrowed tale back to the teller who lent it", done: "“Returned, and not even worn. Most humans fold the corners down.”" },
      { ask: "stand very still while a cub practises disappearing behind you", done: "“Did you see me? You didn't! You didn't see me at all!” (She did.)" },
      { ask: "gather maple sap for the hollow's autumn wine", done: "“Sweet as a lie and twice as sticky. Come back when it's wine.”" },
      { ask: "sit with a fox who has lost her mate to the hunters, and say nothing", done: "After an hour the fox puts her head on her shoulder. After two, she says thank you." },
      { ask: "help mend the den roofs before the autumn rains", done: "“Thatch on a fox den! Tied with a sect knot! The others will be so jealous.”" },
    ],
    goods: ["a jar of maple wine from Moonfox Hollow", "a comb carved from a fox's shed claw", "a book of borrowed stories, each signed by its teller", "a pouch of fox-fire, which burns cold and lasts a year"],
    tales: [
      "“Fox-folk? My granny said they'd steal your shadow. Then again, she said that about the tax man.”",
      "“A fox that can't lie? I've married worse odds. Tell them I'll trade stories any time.”",
      "“The Purge… my sect's archive has a whole room on it. Nobody goes in. I think I should go in.”",
      "“If they pay in stories, I'm the richest woman on this road. Send them my way.”",
    ],
    elder: ["A fox may trick you. A fox may never lie to you. Remember the difference; it is the whole of us.", "Eat. You humans are always so thin. It's all that honesty.", "The pearl was brighter when I was a cub. Everything was. That's not the pearl's fault."],
    guide: ["Watch my tails, not my hands. No, my hands! Ha!", "Grandmother says I'm too young for nine tails. I'm too young for two.", "Have you got any stories? I'll trade you mine. Mine are mostly lies, but true ones."],
    boss: {
      intro: "out of the moonlight walks Hu Yan, the Moon-Eater, seven tails burning silver, the pearl's light running up his fan",
      words: [
        ["pe-boss", "The oath-human. Grandmother's new pet. Do you know what a fox is, in heaven? A celestial. In the hollow, a pelt."],
        ["pe-boss", "One pearl. One night. Nine tails, and I take her with me. All of them, if they'll come. The burrow can keep the dogs."],
        ["pe-guide", "Yan, they'll die without the pearl! I'll die without the pearl!"],
      ],
      fates: [
        { heart: "mercy", label: "Give him back to his grandmother", line: "She carries the seven-tailed fox to Su Yao and lays him at her feet. The matriarch wraps her tails round him and says nothing, which is how foxes forgive." },
        { heart: "sword", label: "Cut the moonlight from him", line: "Her blade passes through the silver light that runs up his fan, and the pearl's light goes home. He is left with seven tails, and no more." },
        { heart: "balance", label: "Make him swear the hollow's oath", line: "She makes him swear, before the whole hollow, never to drink from the pearl again. A fox may trick you. He may not lie. He swears, and it holds." },
        { heart: "slaughter", label: "Finish him and take his tails", line: "She ends him under the moon altar. The hollow watches. Nobody screams; foxes do not, for their own. The pearl does not grow brighter." },
      ],
      victory: "The moon pearl shines over Moonfox Hollow, bright enough to read by. Somewhere a long way off, a hunter's dog loses a scent it was sure of.",
    },
  },
  // ------------------------------------------------------------------------------------------------ II · the Merfolk
  {
    title: "Tears Like Pearls",
    hanzi: "泣珠成泪",
    level: 5,
    beats: [
      {
        step: 0,
        npc: "pe-envoy",
        title: "The Second Notch",
        objective: "Go back to Envoy Shan at the Concord Stone. One notch is filled; he will know where the tally goes next.",
        lines: [
          ["pe-envoy", "A paw! A real one! I touched it three times to be sure. Forgive an old man."],
          ["pe-envoy", "Next: the merfolk, the jiaoren, at Pearlsong Reef on the eastern shore, north of where the highway meets the sea. Their tears fall as pearls. You can imagine what the human jianghu did with that."],
          ["pe-envoy", "Be careful, {title}. The fox-folk hid. The merfolk didn't. They fought, and they lost, and they remember losing."],
        ],
        done: "The envoy wraps the tally in oilcloth for the sea air, the way a man wraps something he has decided he can bear to lose.",
      },
      {
        step: 20,
        npc: "pe-elder",
        title: "The Tide-Mother",
        objective: "Find Tide-Mother Lan Xi, elder of the merfolk, by the giant clam at the heart of Pearlsong Reef, north along the eastern shore.",
        lines: [
          ["narr", "The reef goes quiet as she comes up the sand. A net-caster stops with the net still in the air. Every merfolk on the beach has one hand near a spear."],
          ["pe-elder", "A human with the tally. The last time we saw one, they came for our children's eyes. Do you know why? Because a child cries the easiest."],
          ["pe-elder", "Say what you came to say. Say it to the sea; I don't look at humans anymore. The sea will tell me if you're lying."],
        ],
        choice: {
          prompt: "Tide-Mother Lan Xi will not look at her.",
          options: [
            { heart: "mercy", label: "Say she is sorry, to the sea", then: "She kneels at the edge of the water and says she is sorry, for all of them, to the sea.", reply: ["pe-elder", "…The sea says you mean it. The sea is very stupid about humans."], effect: quiet(2) },
            { heart: "sword", label: "Say she will hunt the hunters", then: "She tells the sea she will hunt every pearl poacher on the shore.", reply: ["pe-elder", "The sea likes that better than it should. So do I."] },
            { heart: "balance", label: "Say only what the Concord says", then: "She reads the Concord's oath off the tally, word for word, to the waves.", reply: ["pe-elder", "The old words. I'd forgotten how they go. The sea hadn't."] },
            { heart: "slaughter", label: "Say the reef needs a stronger friend than the sea", then: "She tells the Tide-Mother that the sea did not save them last time.", reply: ["pe-elder", "True. And neither will you. Go and sit on the sand."], effect: feed(3) },
          ],
        },
        done: "Lan Xi lets her stay on the reef: on the sand, not in the houses, with a merfolk spear always somewhere behind her.",
      },
      {
        step: 40,
        npc: "pe-guide",
        title: "Hai Yin",
        objective: "A young merfolk weaver, Hai Yin, has been watching her from the kelp. Speak to her.",
        lines: [
          ["pe-guide", "You're the one the Tide-Mother didn't throw back. I'm Hai Yin. I weave sea-silk. We never sell it. We give it, to people we decide are ours."],
          ["pe-guide", "My brother was taken last spring. The poachers keep us in jars of salt water and make us cry. Pearls are worth more if they're sad. They can tell the difference, the buyers."],
          { a: "pe-guide", n: "weep" },
          ["narr", "Two pearls fall onto the sand, small and blue-grey. Hai Yin kicks sand over them before Lin Yue can pick them up."],
        ],
        done: "Hai Yin tells her where the poachers beach their boats, and how many there are, and which of them laughs.",
      },
      {
        step: 60,
        npc: "pe-folk-5",
        title: "The Brother",
        objective: "A merfolk on the reef's edge sits with his back to the land. Hai Yin says he was taken with her brother, and came back alone. Hear him.",
        lines: [
          ["pe-folk-5", "I got out. He didn't. They kept him because he cried better than me. I was too angry to cry."],
          ["pe-folk-5", "They sell to a buyer in Hailing. A pearl-house with a blue door, on the canal. The pearls go into the jade of sect elders' crowns. Every crown in the jianghu has a little of us in it."],
          { a: "hero", n: "look" },
        ],
        done: "He draws the blue door in the wet sand, and a crown, and then wipes them both away with the side of his hand.",
      },
      {
        step: 80,
        npc: "pe-elder",
        title: "The Drowned Prince",
        objective: "Tide-Mother Lan Xi calls her down to the water's edge. Someone has come back from the deep sea.",
        lines: [
          ["pe-elder", "Chen Yuan has come back. My son. Thirty years ago he went into the deep to drown his grief and learn to fight. He has learned."],
          ["pe-elder", "He says the reef will go to war with the land. Every port. Every boat. Hailing first. He has an army of the drowned out past the breakers, and the sea is listening to him and not to me."],
          ["pe-elder", "And you, human, are the land's envoy. Tell me what the land would have me do."],
        ],
        choice: {
          prompt: "The Tide-Mother asks what the land would have the reef do.",
          options: [
            { heart: "mercy", label: "Give the land one chance to answer", then: "She asks the reef to wait one season, while she carries their grief to Hailing herself.", reply: ["pe-elder", "One season. The sea is not patient. I will be patient for it."] },
            { heart: "sword", label: "Strike the poachers, and only the poachers", then: "She says the reef has every right to strike the hunters, and she will strike with them.", reply: ["pe-elder", "Only the hunters. You will have to tell my son where the hunters end. He has forgotten."] },
            { heart: "balance", label: "Let the Concord bind both sides", then: "She says the tally binds the land too, and she means to make it.", reply: ["pe-elder", "Bind the land. Hah. The land does not even remember there is a knot."] },
            { heart: "slaughter", label: "Let them have their war", then: "She says the land has earned it.", reply: ["pe-elder", "…You are honest. That is the worst thing you could have been."], effect: feed(4) },
          ],
        },
        done: "Lan Xi goes into the water to her waist, and stands there all night, singing something to the deep that has no words in it.",
      },
      {
        step: 120,
        npc: "pe-envoy",
        title: "The Blue Door",
        objective: "Tell Envoy Shan about the pearl-house in Hailing. He may know who owns it.",
        lines: [
          ["pe-envoy", "A blue door on the canal. The Cerulean Pearl House. It pays more tax than any house in Hailing. The magistrate wears its pearls at his New Year."],
          ["pe-envoy", "I can write. I can write a great deal. A petition in the Concord's name, to the magistrate, setting out exactly what is in those jars. He will not read it. But others will, if it's nailed to his door."],
          { a: "pe-envoy", n: "write" },
        ],
        done: "The petition is eleven pages long. Envoy Shan signs it with the Concord's seal, which has not been pressed in three hundred years, and the wax cracks as it sets.",
      },
      {
        step: 140,
        npc: "pe-guide",
        title: "Sea-Silk",
        objective: "Hai Yin has something for her. Go to her on the reef.",
        lines: [
          ["pe-guide", "I wove you this. Don't say anything. We don't sell it, remember. We give it. It means you're ours now, a little, whether the Tide-Mother likes it or not."],
          { a: "pe-guide", n: "offerpearl" },
          ["pe-guide", "The poachers have my brother on a boat off the Weeping Rocks. Tonight. I'm going. You don't have to come. You do have to come."],
        ],
        choice: {
          prompt: "Hai Yin is going after her brother tonight.",
          options: [
            { heart: "mercy", label: "Go with her, to bring him home", then: "She goes with Hai Yin to bring her brother home, and nothing more.", reply: ["pe-guide", "Home. Yes. Only home."] },
            { heart: "sword", label: "Go ahead of her", then: "She tells Hai Yin to follow, and goes first, blade bare.", reply: ["pe-guide", "Ahead of me. All right. But I'm right behind you. Right behind."] },
            { heart: "balance", label: "Go, and leave the poachers to the land's law", then: "She says they will take the brother back and bring the poachers to the magistrate in chains.", reply: ["pe-guide", "To a magistrate who wears our pearls? …Fine. Let him look at them."] },
            { heart: "slaughter", label: "Go, and sink the boat", then: "She says the boat will not come back to the shore.", reply: ["pe-guide", "Yes. Yes. …I thought I'd feel better saying yes."], effect: feed(3) },
          ],
        },
        done: "Off the Weeping Rocks they find a boat with seven jars in its hold. In the fifth is Hai Yin's brother, who has stopped crying, which is worse.",
      },
      {
        step: 160,
        npc: "pe-folk-1",
        title: "The Song of the Currents",
        objective: "The reef's current-singer will sing the merfolk's mark onto the tally, if the reef agrees. Go to her.",
        lines: [
          ["pe-folk-1", "Our mark is a song, not a picture. The scale on the stone is just where the song was written down."],
          { a: "pe-folk-1", n: "flute" },
          ["pe-folk-1", "The reef has agreed. Not all of us. Enough of us. The Tide-Mother said: “The land's envoy brought back one of ours. The land can have one note.”"],
        ],
        done: "The singer sings a single long note into the tally. When it stops, there is a fish-scale shining in the second notch, wet as if it had just come out of the sea.",
      },
      {
        step: 180,
        npc: "pe-elder",
        title: "The Army of the Drowned",
        objective: "The Tide-Mother says her son is coming in on the tide. Go to her at the giant clam.",
        lines: [
          ["pe-elder", "He has heard that the reef set its mark on the land's tally. He calls it surrender. He's coming in with the tide to take the reef from me, and Hailing after."],
          ["pe-elder", "I cannot fight my own son. I have told the sea I cannot. The sea says that is why he is winning."],
          { a: "pe-elder", n: "weep" },
        ],
        done: "The Tide-Mother's tears fall into the clam at the heart of the reef: grey pearls, one after another, until it cannot close.",
      },
      {
        step: 198,
        npc: "pe-guide",
        title: "High Tide",
        objective: "The tide is coming in black. Hai Yin is waiting at the heart of the reef.",
        lines: [
          ["pe-guide", "He's my uncle. Did you know? He taught me to swim. He used to sing to me."],
          ["pe-guide", "He isn't singing now."],
          ["narr", "Out past the breakers, the sea stands up in a wave that does not fall, and on its crest stands a merfolk prince in a crown of drowned men's jade."],
        ],
        done: "Chen Yuan, the Drowned Prince, comes up the sand with the sea behind him.",
      },
    ],
    rites: [
      { title: "The Weeping Rite", ask: "keep the Tide-Mother company at the Weeping Rocks at dusk, where the merfolk go to cry where no one can sell it", done: "Nobody speaks. The pearls are thrown into the sea, every one, and Lin Yue throws in a stone of her own." },
      { title: "Silk Given", ask: "carry a length of sea-silk from Hai Yin to a family on the reef who lost their roof", done: "The family will not take it from her; she has to put it down and walk away. That is how it is done." },
      { title: "Current-Song", ask: "learn a verse of the current-song from the reef's singer, so you can find your way home by water", done: "She sings it badly. The singer says the sea will understand. The sea has heard worse from sailors." },
      { title: "Reef Watch", ask: "stand the night watch on the reef with the merfolk spear-line, watching for poachers' lights", done: "No lights tonight. The merfolk beside her shares a strip of dried fish, which is a great honour, and tastes of it." },
      { title: "Return of the Jars", ask: "bring back the empty jars from the poachers' boat, so the reef can break them on the rocks as is proper", done: "They break every one. The children are allowed to break the last. It takes them a long time, and they laugh." },
      { title: "Naming the Lost", ask: "speak the names of the merfolk taken this year into the giant clam, one by one, as the Tide-Mother reads them", done: "Eleven names. The clam closes on the last one, gently, as if keeping it." },
    ],
    favours: [
      { ask: "help mend a torn net before the evening tide", done: "“Human knots! They hold. Ugly, but they hold.”" },
      { ask: "fetch fresh water from the stream for the elders' gills", done: "“Sweet water. The sea is too salty for old gills. Thank you, land-girl.”" },
      { ask: "chase the gulls off the drying racks", done: "“Gone! Every gull on the shore will tell its children about you.”" },
      { ask: "sit with a child who has never seen a human, and let her touch your hands", done: "“They're dry! They're so dry! Do they hurt?” (They don't.)" },
      { ask: "carry a coral comb to the singer, from someone too shy to give it", done: "The singer looks at the comb a long time, then sings one note toward a merfolk on the far rocks, who dives into the sea and does not come up for an hour." },
      { ask: "dig out a sea-turtle buried in the sand by the storm", done: "The turtle walks to the water without looking back. The merfolk all bow to it, so she does too." },
    ],
    goods: ["a length of sea-silk, given, never sold", "a string of grey pearls cried in mourning, to be thrown into another people's water", "a jar of reef salt", "a song of the currents, written down on fish-skin"],
    tales: [
      "“Pearls from tears? I've seen those pearls. In my mistress's hair. I'll… I'll tell her, I think.”",
      "“Merfolk in jars. In Hailing? On our canal? Someone ought to break that blue door in.”",
      "“My father was a pearl diver. He said the best ones were warm. I always thought he meant from the sun.”",
      "“If they give their silk away, they're better merchants than any I know. Giving is how you get remembered.”",
    ],
    elder: ["The sea tells me you are still here. I told the sea to mind its own business.", "Every crown in the jianghu has a little of us in it. Remember that, next time you bow to one.", "Sit on the sand. The sand is neutral. The sand hates everyone equally."],
    guide: ["Do you want to learn a knot? It's the one that holds a net and a heart. Same knot.", "I don't cry in front of humans. …Mostly.", "When my brother came home he asked for you by name. You have a name in the reef now."],
    boss: {
      intro: "up the sand comes Chen Yuan, the Drowned Prince, a crown of drowned men's jade on his head and the sea standing at his back",
      words: [
        ["pe-boss", "Mother set our mark on the land's tally. The land's tally! The land sells our children by the jar."],
        ["pe-boss", "I learned in the deep that grief is a weapon. Everything the land took, the sea will take back. Starting with you."],
        ["pe-elder", "Yuan. Come home. The sea is not your mother. I am."],
      ],
      fates: [
        { heart: "mercy", label: "Carry him to his mother", line: "She lays the Drowned Prince at his mother's feet. Lan Xi takes off his crown of drowned men's jade and throws it into the sea, and holds him while he cries his first pearls in thirty years." },
        { heart: "sword", label: "Break his crown", line: "Her blade shatters the crown of drowned men's jade, and the wave behind him falls, all at once, harmlessly, into the sea." },
        { heart: "balance", label: "Bind him to the Concord", line: "She makes him lay his hand on the tally beside his mother's note. If the land breaks it, he may come for the land. If not, not. He agrees, because he believes the land will break it." },
        { heart: "slaughter", label: "Give him to the deep", line: "She drowns the Drowned Prince in his own wave. The reef watches from the sand. The Tide-Mother does not weep. She has no pearls left." },
      ],
      victory: "The tide goes out gently over Pearlsong Reef. In Hailing, the next morning, someone has painted the Cerulean Pearl House's blue door black.",
    },
  },
  // ------------------------------------------------------------------------------------------------ III · the Stone-Born
  {
    title: "The Long Sleep",
    hanzi: "长眠",
    level: 8,
    beats: [
      {
        step: 0,
        npc: "pe-envoy",
        title: "Two Marks",
        objective: "Return to Envoy Shan at the Concord Stone with two marks on the tally.",
        lines: [
          ["pe-envoy", "A paw and a scale. The stone is warmer. I swear it. Put your hand on it. …No, it's the sun. But I swear it anyway."],
          ["pe-envoy", "The stone-born next. Hollowstone Hold, in the red sands west of the caravan track. They live a thousand years and sleep a hundred at a time. Some of them slept through the Purge. They may not know it happened."],
          ["pe-envoy", "Think about that, {title}: a people who might wake up and find they have nobody to forgive."],
        ],
        done: "The envoy gives her a chisel, old and blunt, with the Concord's seal on the handle. “They'll want to carve something. They always do.”",
      },
      {
        step: 20,
        npc: "pe-elder",
        title: "Old Granite",
        objective: "Find Old Granite Lei Gu, elder of the stone-born, by the standing menhir at the heart of Hollowstone Hold, in the red sands west of the caravan track.",
        lines: [
          ["narr", "Hollowstone Hold is so quiet she can hear the sand move. Half its people are asleep on the ground like boulders, moss on their backs. The other half are carving."],
          ["pe-elder", "…A. Human. With. The tally."],
          ["pe-elder", "Forgive. Me. I have been awake. Only. Forty years. I am. Still. Slow."],
          ["pe-elder", "Sit. Down. This. Will. Take. A while."],
          { a: "hero", n: "sit" },
        ],
        choice: {
          prompt: "Old Granite is still getting to the end of his first sentence.",
          options: [
            { heart: "mercy", label: "Wait, however long it takes", then: "She sits in the sand and waits, and does not once look at the sun.", reply: ["pe-elder", "You. Waited. Nobody. Waits. Good."], effect: quiet(2) },
            { heart: "sword", label: "Say what she came for, plainly", then: "She says, plainly and once, that she has come for the Concord and the Hold's mark.", reply: ["pe-elder", "Fast. Like. A. Landslide. We. Respect. Landslides."] },
            { heart: "balance", label: "Carve her answer in the sand", then: "She writes her business in the sand with her finger, slowly, so it will keep while he reads.", reply: ["pe-elder", "Ah. You. Carve. Too. Then. We. Will. Get. On."] },
            { heart: "slaughter", label: "Tell him time is short for humans", then: "She tells him she hasn't got a hundred years to spare, and neither, perhaps, has the Hold.", reply: ["pe-elder", "True. That. Is. Why. You. Are. All. So. Rude."], effect: feed(2) },
          ],
        },
        done: "It takes the elder the rest of the day to ask her name. It takes her the rest of the day to learn to wait for him, which is the first thing the Hold teaches.",
      },
      {
        step: 40,
        npc: "pe-guide",
        title: "Pebble",
        objective: "A young stone-born, still soft enough to bruise, has been following her round the Hold. Speak to him.",
        lines: [
          ["pe-guide", "I'm Pebble. I'm only sixty. That's nothing. I talk fast, for us. Old Granite says I'll slow down when I harden. I don't want to harden."],
          ["pe-guide", "Something's wrong with the sleepers. Some of them don't wake. They go hollow inside, like a gourd, and then they're just sand, and then they get up and walk, and it isn't them walking."],
          { a: "pe-guide", n: "carve" },
          ["pe-guide", "I carved my mother on my arm. Before she went hollow. So I'll remember. That's what we do. We carve what we can't keep."],
        ],
        done: "Pebble shows her his arm. The carving is clumsy and very careful, and the mother in it is smiling.",
      },
      {
        step: 60,
        npc: "pe-folk-3",
        title: "What the Sleepers Forget",
        objective: "A keeper of the long sleep watches over the Field of Sleepers. Ask her why they go hollow.",
        lines: [
          ["pe-folk-3", "The vein under the Hold feeds us while we sleep. A warm thread of earth's qi. When we sleep, we drink. When we wake, we carve what we dreamed."],
          ["pe-folk-3", "The vein is running dry. Someone is drawing it all to one place, deep under the Hold. The sleepers drink nothing, and dream nothing, and go hollow."],
          ["pe-folk-3", "Only one of us goes down that deep. The king. He went down to sleep a hundred years ago. He has not come up."],
        ],
        done: "The keeper lays her hand on a sleeper's back, the way a mother checks a sleeping child's breath. She does not take it away for a long time.",
      },
      {
        step: 80,
        npc: "pe-elder",
        title: "The Hollow King",
        objective: "Old Granite has had time to think. He wants to speak to her by the menhir.",
        lines: [
          ["pe-elder", "Kuang. Yan. Our. King. Slept. Through. The. Purge."],
          ["pe-elder", "He. Woke. Ten. Years. Ago. Read. The. Carvings. Of. Those. Who. Were. Taken. And. Went. Back. Down."],
          ["pe-elder", "He. Draws. The. Vein. To. Himself. He. Means. To. Be. A. Mountain. That. No. Sect. Can. Break. And. He. Is. Eating. His. Own. People. To. Do. It."],
        ],
        choice: {
          prompt: "Old Granite asks, very slowly, what she would do.",
          options: [
            { heart: "mercy", label: "Wake him gently", then: "She says a king who slept through his people's grief deserves to be woken gently, and told.", reply: ["pe-elder", "Gently. Yes. That. Is. How. We. Do. Everything."] },
            { heart: "sword", label: "Cut the vein from him", then: "She says she will go down and sever whatever he has tied the vein to.", reply: ["pe-elder", "Cut. Carefully. A. Vein. Bleeds."] },
            { heart: "balance", label: "Let the vein find its own way back", then: "She says she will open what he has closed, and let the earth's qi run where it ran.", reply: ["pe-elder", "The. Earth. Knows. The. Way. Good."] },
            { heart: "slaughter", label: "Break him into gravel", then: "She says a king who eats his sleepers is a quarry, not a king.", reply: ["pe-elder", "…Gravel. Is. Still. Stone. Remember."], effect: feed(4) },
          ],
        },
        done: "Old Granite carves something on the back of his own hand while he waits for her to go. It takes him an hour. It is her name.",
      },
      {
        step: 120,
        npc: "pe-folk-0",
        title: "Carved in Skin",
        objective: "The Hold's carver of memories will carve her into the Hold's record, if she will sit for it. Find him.",
        lines: [
          ["pe-folk-0", "Every guest of the Hold is carved. On the guest-stone. Or on one of us, if we decide you matter. I have decided. Sit still. Very still. For three days."],
          { a: "pe-folk-0", n: "carve" },
          ["narr", "She sits. The carver works. On the second day, Pebble brings her water and sits beside her without speaking, which for Pebble is a gift."],
        ],
        done: "On the carver's left forearm there is now a small woman with a sword, sitting very still, beside a much smaller stone-born, also sitting very still.",
      },
      {
        step: 140,
        npc: "pe-envoy",
        title: "What Slept Through",
        objective: "Tell Envoy Shan that the stone-born's king slept through the Purge, and woke to read it.",
        lines: [
          ["pe-envoy", "Woke and read it. All at once. Three hundred years of grief in one morning."],
          ["pe-envoy", "We had three hundred years to get used to it. To make up reasons. He had a morning. I can't blame him. Heaven help me, I can't."],
          { a: "pe-envoy", n: "think" },
          ["pe-envoy", "Do what you think right, {title}. But remember that whatever you do to him, the Hold will carve it. They forget nothing. That's their whole trouble, and their whole worth."],
        ],
        done: "The envoy sits down on the step of the Concord Stone, which he never does, and asks the teahouse for something stronger than tea.",
      },
      {
        step: 160,
        npc: "pe-guide",
        title: "Hardening",
        objective: "Pebble wants to go down into the vein with her. Find him.",
        lines: [
          ["pe-guide", "I'm coming. I'm soft. Soft fits through gaps hard doesn't. Old Granite says no. Old Granite is too slow to stop me."],
          ["pe-guide", "And if I harden down there, from the vein… then I'll be hard, and I'll remember everything forever. My mother. You. Is that so bad?"],
        ],
        choice: {
          prompt: "Pebble wants to come down into the vein with her.",
          options: [
            { heart: "mercy", label: "Let him come, and keep him close", then: "She takes his hand, which is warm, like a stone that has been in the sun.", reply: ["pe-guide", "Close. All right. I'll be close and soft."] },
            { heart: "sword", label: "Order him to stay", then: "She tells him the Hold needs someone soft to carve what happens.", reply: ["pe-guide", "…That's a good reason. I hate good reasons."] },
            { heart: "balance", label: "Let him choose", then: "She says it is his hardness and his memory, and his choice.", reply: ["pe-guide", "Then I'm coming. I chose. Carve that."] },
            { heart: "slaughter", label: "Use him as a lamp in the dark", then: "She tells him to come and carry the light, and not to get in the way.", reply: ["pe-guide", "A lamp. Right. Lamps don't get carved. Lamps just… light."], effect: feed(2) },
          ],
        },
        done: "The way into the vein is a crack under the menhir, too narrow for a grown stone-born. It is exactly wide enough for her, and for Pebble.",
      },
      {
        step: 180,
        npc: "pe-elder",
        title: "The Mark of the Hold",
        objective: "Old Granite has been carving for days. Go to him at the menhir.",
        lines: [
          ["pe-elder", "The. Hold. Has. Decided."],
          { a: "pe-elder", n: "carve" },
          ["pe-elder", "We. Set. Our. Mark. A. Hand. Of. Stone. Beside. A. Human. Hand. It. Is. Carved. Now. It. Cannot. Be. Uncarved."],
          ["narr", "Under their feet, the whole Hold groans, like a sleeper turning over. Deep down, something has felt the tally take the mark, and does not like it."],
        ],
        done: "The third notch holds a little hand of red stone, carved so finely she can see the lines of its palm.",
      },
      {
        step: 198,
        npc: "pe-guide",
        title: "Into the Vein",
        objective: "The Hold is shaking. Pebble is waiting by the menhir to go down.",
        lines: [
          ["pe-guide", "He's awake. Really awake. The sleepers are all getting up at once and walking toward the menhir. Some of them are still them. Most of them aren't."],
          ["pe-guide", "Hold my hand. If I get hard down there, carve me something nice. Not a battle. Something with a tree in it."],
        ],
        done: "The menhir splits down the middle, and out of the earth beneath it climbs a stone-born king twice the height of a man, glowing at every crack like a kiln.",
      },
    ],
    rites: [
      { title: "The Guest-Stone", ask: "carve one line on the Hold's guest-stone, as every guest must, with the envoy's chisel", done: "She carves a lotus. It takes all afternoon. The stone-born watching say it is fast and crude and they like it." },
      { title: "Waking Song", ask: "hum the waking song with the keeper over a sleeper whose hundred years are up", done: "The sleeper opens his eyes and says “Hm” and then, an hour later, “Good morning.”" },
      { title: "Water for the Hold", ask: "carry water from the caravan track's well to the Hold, where no rain has fallen in nine years", done: "The stone-born don't drink it. They pour it on the oldest sleeper's moss, which turns green as she watches." },
      { title: "Reading the Skin", ask: "let Old Granite read you the carvings on his arms, from the oldest to the newest", done: "The oldest is a river that dried up nine hundred years ago. The newest is her." },
      { title: "The Slow Meal", ask: "share the Hold's one meal of the season: a stone soup, eaten very slowly", done: "It is a stone, in hot water, with salt. It tastes of patience. She finishes it in the time it takes the elder to lift his spoon." },
      { title: "A Grave of Sand", ask: "help the Hold bury a stone-born who went hollow, in the sand, with his carvings turned to the sky", done: "They bury him face up. “So. He. Can. Read. Himself,” says Old Granite." },
    ],
    favours: [
      { ask: "turn a sleeper over onto his other side, which takes three people and a lever", done: "“Thank. You. He. Was. Getting. Flat.”" },
      { ask: "fetch fresh moss from the Field of Sleepers for a sleeper's bald patch", done: "“Moss! Now he'll look his age. He'll be furious when he wakes. Ha.”" },
      { ask: "sharpen the Hold's chisels on your sword's whetstone", done: "“Sharp! Too sharp. We'll carve our fingers off. We'll love it.”" },
      { ask: "help Pebble carve a tree, which he has never seen, from your description", done: "The tree has eleven branches and a face. Pebble says trees are like that. She doesn't correct him." },
      { ask: "stand in the sun so a stone-born can warm her back on your shadow's edge", done: "“Warm. Humans are always warm. It must be exhausting.”" },
      { ask: "dig a sand husk's crystal out of the dunes, so the Hold can bury it", done: "The crystal is dull and cracked. The keeper wraps it in cloth and sings to it, the waking song, in case." },
    ],
    goods: ["a carving of the guest who brought it", "a crystal from the Hold's vein, warm to the touch", "a jar of stone soup (just the stone; add water)", "a chisel of red stone, for a people who carve"],
    tales: [
      "“Stone people who sleep a hundred years? I'd like that job. Tell them I'm applying.”",
      "“My grandmother said the boulders in the sands used to move. We laughed at her. I'm going to go and apologise to her grave.”",
      "“They carve everyone who matters? On their skin? Gods. I hope I'm carved somewhere.”",
      "“A king who slept through the Purge and woke up to read it… that's a tale for tonight. If I can bear to tell it.”",
    ],
    elder: ["Sit. Down. You. Are. Making. Me. Tired.", "In. A. Hundred. Years. I. Will. Tell. You. What. I. Think. Of. You.", "The. Sand. Remembers. Everything. It. Just. Moves. It. Around."],
    guide: ["Old Granite says I talk like a waterfall. I've never seen a waterfall. Is that good?", "I carved you on my leg. Don't look! It's not finished. It'll take sixty years.", "When I harden I want to be a cliff. With birds."],
    boss: {
      intro: "out of the split menhir climbs Kuang Yan, the Hollow King, the whole vein of the earth burning in his cracks",
      words: [
        ["pe-boss", "I. Read. Them. All. Every. Carving. Of. Every. One. Taken. In. One. Morning."],
        ["pe-boss", "Never. Again. I. Will. Be. A. Mountain. No. Sword. Breaks. A. Mountain."],
        ["pe-guide", "You're eating them, uncle! You're eating the sleepers! My mother was a sleeper!"],
      ],
      fates: [
        { heart: "mercy", label: "Wake him from his grief", line: "She lays her hand on the king's cracked chest and tells him, slowly, in the Hold's way, every name of every sleeper he ate. He listens to all of them. At the end he lets go of the vein, and lies down, and sleeps." },
        { heart: "sword", label: "Cut him from the vein", line: "Her blade finds the one bright thread that runs from his heart down into the earth, and severs it. The vein rushes back to the sleepers like water down a dry riverbed." },
        { heart: "balance", label: "Let the earth take back what is its own", line: "She opens his clenched stone hands, one finger at a time, and the vein's qi runs out of them and down into the earth, and back to everyone." },
        { heart: "slaughter", label: "Break him into gravel", line: "She breaks the Hollow King into gravel. The Hold gathers every piece of him, and carves a name on each one, and will be carving for a thousand years." },
      ],
      victory: "Across Hollowstone Hold, the sleepers turn over in their sleep, and their moss goes green, and one of them, very slowly, smiles.",
    },
  },
  // ------------------------------------------------------------------------------------------------ IV · the Feathered Folk
  {
    title: "The First Feather",
    hanzi: "初羽",
    level: 11,
    beats: [
      {
        step: 0,
        npc: "pe-envoy",
        title: "Three Marks",
        objective: "Return to Envoy Shan at the Concord Stone with three marks on the tally.",
        lines: [
          ["pe-envoy", "Three! A paw, a scale, a stone hand. The teahouse owner asked me what I was crying about. I told her the tally. She gave me a free cake."],
          ["pe-envoy", "The feathered folk next, the yumin, at Skyfeather Eyrie in the plum hills, past the shrine among the blossom. They carry messages for the whole jianghu and nobody remembers they do."],
          ["pe-envoy", "They didn't fight the Purge or hide from it. They flew. Their trouble isn't humans, {title}. It's the sky."],
        ],
        done: "The envoy ties a white feather to the tally. “The last one they gave us. They'll know it.”",
      },
      {
        step: 20,
        npc: "pe-elder",
        title: "The Wind-Speaker",
        objective: "Find Wind-Speaker Qing Yu, elder of the feathered folk, by the feather totem at the heart of Skyfeather Eyrie, in the plum hills.",
        lines: [
          ["narr", "The houses of Skyfeather Eyrie stand on poles taller than pines. Most of the folk are on the ground. Their wings hang behind them like wet washing."],
          ["pe-elder", "The tally! And our feather on it. You're welcome, envoy-girl. We're always glad of news. We used to carry it. Now we walk it, like you."],
          ["pe-elder", "Our wings are failing. All of us. A grey sickness, from the root of the feather. The young ones can't earn their flight feather, so they can't be named. We have a generation of children without names."],
        ],
        choice: {
          prompt: "The Wind-Speaker asks what she sees when she looks at the eyrie.",
          options: [
            { heart: "mercy", label: "Children who need names", then: "She says she sees children, and asks their names anyway.", reply: ["pe-elder", "They haven't got any. Make some up. They'd like that."], effect: quiet(2) },
            { heart: "sword", label: "A sickness with a cause", then: "She says sickness that comes all at once comes from somewhere.", reply: ["pe-elder", "Yes. From somewhere. From up."] },
            { heart: "balance", label: "A people standing on the ground for once", then: "She says the ground is not so bad, and they might learn it.", reply: ["pe-elder", "Ha! Spoken like someone with feet. We'll see."] },
            { heart: "slaughter", label: "A people too weak to keep the sky", then: "She says the sky belongs to whoever can hold it.", reply: ["pe-elder", "Someone up there agrees with you."], effect: feed(3) },
          ],
        },
        done: "The Wind-Speaker shows her the First Feather's case on the totem: a box of carved bone, open, and empty.",
      },
      {
        step: 40,
        npc: "pe-guide",
        title: "Fei Yan Cannot Fly",
        objective: "A young feathered girl, Fei Yan, is jumping off the lowest eyrie, again and again. Speak to her.",
        lines: [
          ["pe-guide", "Don't help me up. I'm practising. I'm practising falling. I'm very good at it now."],
          ["pe-guide", "I'm Fei Yan. That's not my name, I haven't got a name yet, it's what my mother calls me. You get your name when you fly from the First Leap. Nobody's flown in four years."],
          { a: "pe-guide", n: "glide" },
          ["narr", "She gets three feet off the ground, for one breath, and comes down hard."],
          ["pe-guide", "That's the best I've done. Did you see? Did you see it?"],
        ],
        done: "Lin Yue saw it. She tells Fei Yan so, and the girl does not stop grinning for the rest of the day.",
      },
      {
        step: 60,
        npc: "pe-folk-1",
        title: "Reading the Clouds",
        objective: "The eyrie's cloud-reader has seen something in the sky. Hear her out.",
        lines: [
          ["pe-folk-1", "The clouds over the plum hills have been wrong for four years. They come in from every side and stop over the eyrie and stay. Look up."],
          { a: "hero", n: "look" },
          ["pe-folk-1", "That one. It doesn't move with the wind. It moves against it. There's someone up there, keeping the sky shut over us like a lid on a pot."],
        ],
        done: "When she looks again, the cloud has moved, against the wind, a little closer.",
      },
      {
        step: 80,
        npc: "pe-elder",
        title: "The Storm-Lord",
        objective: "The Wind-Speaker has news. It came with a feather that fell out of the black cloud.",
        lines: [
          ["pe-elder", "A messenger feather. From up there. From Lie Feng. My student, once. The best flier the eyrie ever raised. He took the First Feather four years ago and flew into the storm with it."],
          ["pe-elder", "He writes: “The ground killed us in the Purge. The ground will never touch us again. I have made the sky ours. Come up, all who can fly.” And none of us can. Because he has the Feather."],
          ["pe-elder", "He thinks he's saving us. That's the worst kind of thief."],
        ],
        choice: {
          prompt: "The Wind-Speaker asks how she would answer Lie Feng's letter.",
          options: [
            { heart: "mercy", label: "Tell him the children have no names", then: "She writes back that there are children in the eyrie with no names, and asks him to come down and see them.", reply: ["pe-elder", "He'll read it. He'll hate reading it. Good."] },
            { heart: "sword", label: "Tell him she is coming up", then: "She writes back three words: I am coming.", reply: ["pe-elder", "Short. He'll respect that. He'll try to kill you, but he'll respect it."] },
            { heart: "balance", label: "Tell him the sky has room for both", then: "She writes that the sky is big, and the ground is big, and nobody needs to choose.", reply: ["pe-elder", "He won't believe it. He's young. It took me two hundred years."] },
            { heart: "slaughter", label: "Tell him the sky will be his grave", then: "She writes back a threat, and seals it with blood.", reply: ["pe-elder", "…I'll send it. I wish I hadn't read it."], effect: feed(4) },
          ],
        },
        done: "The letter goes up on the last messenger-kite the eyrie owns. The black cloud swallows it.",
      },
      {
        step: 120,
        npc: "pe-folk-0",
        title: "A Messenger Back From the East",
        objective: "An old messenger walked all the way back to the eyrie from the east, because he could not fly it. Hear what he carried.",
        lines: [
          ["pe-folk-0", "Four years, walking. I had a letter for the eyrie from the snow-folk. It's four years late. It says: “The winter is coming early. Send word if you have it too.”"],
          ["pe-folk-0", "We were the jianghu's wings. Every people's letters. Since the Feather went, nobody hears from anybody. The fox-folk don't know about the reef. The reef doesn't know about the Hold."],
          ["pe-folk-0", "You've been doing our work for us, carrying that tally. Did you know?"],
        ],
        done: "The old messenger hands her the snow-folk's letter, four years late, to carry onward. It is cold to the touch.",
      },
      {
        step: 140,
        npc: "pe-envoy",
        title: "News Travels",
        objective: "Tell Envoy Shan that the peoples have stopped hearing from one another.",
        lines: [
          ["pe-envoy", "That's what broke the Concord, you know. Not the Purge. The silence after. Each people thought it was the only one hunted. Each one thought the others had sold it."],
          ["pe-envoy", "If the feathered folk fly again… the peoples will start talking. Arguing. Trading. Lying to each other. Living."],
          { a: "pe-envoy", n: "write" },
          ["pe-envoy", "I'm writing to every people I can name, on the chance a bird will carry it. Help me fold."],
        ],
        done: "They fold a hundred letters into paper birds and set them on the Concord Stone. In the morning they are gone. It was probably the wind.",
      },
      {
        step: 160,
        npc: "pe-guide",
        title: "The First Leap",
        objective: "Fei Yan has gone to the First Leap, the cliff where the dead are given to the wind. Go after her.",
        lines: [
          ["pe-guide", "I'm going up there. Into the cloud. If I fly into his storm he'll have to catch me. Then I'll take the Feather back."],
          ["pe-guide", "I know I can't fly. That's the plan. He can't let a child fall. He used to be the wing-teacher. He taught my mother."],
        ],
        choice: {
          prompt: "Fei Yan is standing on the edge of the First Leap.",
          options: [
            { heart: "mercy", label: "Hold her back", then: "She takes the girl by the wrist and doesn't let go.", reply: ["pe-guide", "…Okay. Okay. You can let go now. I'm not going. Don't let go yet."] },
            { heart: "sword", label: "Go up in her place", then: "She steps onto her flying sword and tells Fei Yan to watch.", reply: ["pe-guide", "You've got a sword that flies?! That's cheating! Take me with you!"] },
            { heart: "balance", label: "Jump with her", then: "She takes the girl's hand and they jump together, and her sword catches them both a breath before the rocks.", reply: ["pe-guide", "We flew. We sort of flew. That counts. Wind-Speaker, does that count?"] },
            { heart: "slaughter", label: "Let her jump", then: "She lets the child jump to bait the storm-lord, and catches her only at the last moment.", reply: ["pe-guide", "You… you waited. You waited to see if he'd come."], effect: feed(3) },
          ],
        },
        done: "High above the First Leap, the black cloud stops moving. Something in it has seen a child fall, and has not come.",
      },
      {
        step: 180,
        npc: "pe-elder",
        title: "A Feather on the Tally",
        objective: "The eyrie has made up its mind about the tally. Go to the Wind-Speaker.",
        lines: [
          ["pe-elder", "We set our mark on it. A feather. Ours is easy; we've got plenty, even if they don't work."],
          { a: "pe-elder", n: "offerpearl" },
          ["pe-elder", "And when you go up into that storm, envoy-girl, take this. It's the case the First Feather lived in. When you have the Feather back, put it in. He'll know what it means. He carved this case."],
        ],
        done: "The fourth notch holds a white feather with a black tip, bound in with a thread of sea-silk from the reef. The peoples' marks are starting to touch.",
      },
      {
        step: 198,
        npc: "pe-guide",
        title: "Into the Storm",
        objective: "The black cloud has come down to the First Leap. Fei Yan is waiting at the totem.",
        lines: [
          ["pe-guide", "He's come down. All the way down. He's standing on the totem, on the top, like a crow. He says he'll give the Feather to whoever can take it."],
          ["pe-guide", "I can't take it. You can. Be quick, the wind's getting worse. I can feel it in my feathers. They hurt when he's angry."],
        ],
        done: "Lie Feng, Lord of the Storm, drops from the top of the feather totem with lightning in his spear.",
      },
    ],
    rites: [
      { title: "Messenger's Oath", ask: "swear the messenger's oath with the Wind-Speaker: to carry every letter, for anyone, and read none", done: "She swears it. The Wind-Speaker gives her a letter to carry at once, to see. She doesn't read it. It is blank. That was the test." },
      { title: "Wind-Chimes", ask: "hang new wind-chimes on the eyrie's poles, so the folk can hear the wind they can't ride", done: "The chimes ring all night. The folk sleep well for the first time in four years, listening." },
      { title: "Cloud-Reading", ask: "lie on the meadow with the cloud-reader for an hour and learn to read the sky", done: "She learns three clouds: rain, wind, and liar. The black one over the eyrie is a liar." },
      { title: "A Name for a Child", ask: "help the Wind-Speaker choose a temporary name for a child who cannot fly, as the eyrie has begun to do", done: "The child is called Not-Yet. She loves it. She says it's the best name in the eyrie because it's a promise." },
      { title: "The Wind-Funeral", ask: "stand at the First Leap while the eyrie gives an elder to the wind", done: "There is no wind to give him to. They wait all day. At dusk, a little breeze comes, and they let him go into it, and it is enough." },
      { title: "Feather-Mending", ask: "help the eyrie's healers bind grey feathers with silk and herbs, one by one", done: "It doesn't cure them. It holds them. Fei Yan says that's what flying is anyway: holding on to air." },
    ],
    favours: [
      { ask: "climb the ladder to an old flier's eyrie and bring her down for supper", done: "“Climbing! At my age! Ladders are for humans and shame.” (She eats two bowls.)" },
      { ask: "fetch a kite out of a plum tree for a feathered child", done: "“My kite! It flies better than me. Don't tell it.”" },
      { ask: "carry a letter to the next eyrie pole, which takes the folk a whole morning to climb now", done: "“Delivered! From one pole to the next, like the old days. Like the very, very old days.”" },
      { ask: "help oil the wind-chimes so they ring true", done: "“Hear that? That's a west wind. I'd forgotten what a west wind sounds like.”" },
      { ask: "teach a feathered child to swim, since they cannot fly", done: "“It's like flying! In soup!” She refuses to get out." },
      { ask: "gather fallen grey feathers from the meadow so nobody steps on them", done: "The healer puts them in a jar. “We keep them all. Every one is someone's.”" },
    ],
    goods: ["a bundle of letters four years late", "a wind-chime of hollow bones", "a messenger's kite, for a people who need to send word", "a flight feather, grey, given in trust"],
    tales: [
      "“Feathered folk? Who do you think carried my letters to my sister in the south for thirty years? I thought it was the post.”",
      "“Four years without a letter from my son. I thought he was dead. Maybe he just had no bird.”",
      "“Children with no names until they fly. That's sad. That's also how my sect named its disciples, only with swords.”",
      "“A storm-lord over the plum hills? That explains the plums this year. Terrible. Sour as a magistrate.”",
    ],
    elder: ["Look up. Always look up, envoy-girl. That's where trouble comes from, and supper.", "We used to say the ground was for the dead. Now we live on it. The dead must be furious.", "You walk very well. For someone who's never had a choice."],
    guide: ["I'm going to be called Swift. When I can fly. Or Sparrow. Or something better than Swift. Help me think.", "Can your sword carry two? Just asking. For no reason. For a friend.", "Did you see that? Three feet! No, four!"],
    boss: {
      intro: "down off the feather totem drops Lie Feng, Lord of the Storm, black-winged, the First Feather in his crown and lightning in his spear",
      words: [
        ["pe-boss", "The envoy. Carrying the ground's tally up into my sky. The ground killed us. I watched them throw nets over the eyrie. I was eleven."],
        ["pe-boss", "Never again. The sky is shut. Over us, it's ours. Nobody comes up who isn't one of us."],
        ["pe-guide", "Then nobody comes up at all! We can't fly! You taught my mother to fly!"],
      ],
      fates: [
        { heart: "mercy", label: "Put the Feather in its case, and give him the case", line: "She lays the First Feather in the bone case he carved, and puts it in his hands. Lie Feng looks at it a long time. Then he gives it to Fei Yan, and the clouds over the eyrie open." },
        { heart: "sword", label: "Cut the storm open", line: "She cuts straight up through the black cloud, and the sun pours into the plum hills. The First Feather falls out of the storm, turning over and over, into Fei Yan's hands." },
        { heart: "balance", label: "Give the sky back to the wind", line: "She takes the Feather from his crown and lets the wind have it. It blows straight to the totem, where it belongs, and every grey feather in the eyrie turns white at the root." },
        { heart: "slaughter", label: "Clip his wings", line: "She takes the Feather, and takes his wings with it. He will walk now, like the people he shut out of the sky. The eyrie does not cheer." },
      ],
      victory: "The next morning, Fei Yan flies from the First Leap. She is named Not-Yet's-Sister, because she insists, and she flies a letter all the way to the Concord Stone.",
    },
  },
  // ------------------------------------------------------------------------------------------------ V · the Snow-Folk
  {
    title: "The Hearth That Never Goes Out",
    hanzi: "不灭之炉",
    level: 14,
    beats: [
      {
        step: 0,
        npc: "pe-envoy",
        title: "Four Marks",
        objective: "Return to Envoy Shan at the Concord Stone, with the snow-folk's letter four years late.",
        lines: [
          ["pe-envoy", "A letter! From the snow-folk! “The winter is coming early.” Four years ago. Heaven, it'll be here by now."],
          ["pe-envoy", "Rimehorn Lodge, in the snowfields north of the steppe, on the way up to Frostveil. The snow-folk. Ram-horned herders of the ice-ox. A guest is sacred to them for three nights."],
          ["pe-envoy", "After three nights, {title}, you'd better be family. Or gone."],
        ],
        done: "The envoy gives her his own cloak, which is too thin for the snowfields and much too big for her. She takes it anyway.",
      },
      {
        step: 20,
        npc: "pe-elder",
        title: "Three Nights",
        objective: "Find Hearth-Keeper Aru, elder of the snow-folk, by the great hearth at the heart of Rimehorn Lodge, in the snowfields north of the steppe.",
        lines: [
          ["narr", "The great hearth of Rimehorn Lodge is burning low. Round it the snow-folk sit shoulder to shoulder, horns to horns, and every one of them is thin."],
          ["pe-elder", "A guest. Sit. Eat. You are sacred for three nights; nobody here may harm you, refuse you, or ask your business."],
          ["pe-elder", "On the fourth morning I'll ask your business. Until then, eat. There isn't much. You'll have the most of it. That's the law."],
        ],
        choice: {
          prompt: "Hearth-Keeper Aru sets the lodge's last good bowl in front of her.",
          options: [
            { heart: "mercy", label: "Give it to the thinnest child", then: "She passes the bowl to the thinnest child by the fire, and takes the child's bowl instead.", reply: ["pe-elder", "That's breaking the law. Nobody saw. Eat your water, guest."], effect: quiet(2) },
            { heart: "sword", label: "Eat it, and go hunting", then: "She eats, thanks them, and asks where the herds have gone.", reply: ["pe-elder", "Business, before the fourth morning. Rude. I like rude."] },
            { heart: "balance", label: "Share it round the fire", then: "She divides the bowl into twenty spoonfuls and passes them round.", reply: ["pe-elder", "Twenty spoons of soup. That's a feast in a winter like this. Thank you, guest."] },
            { heart: "slaughter", label: "Eat it all, as is her right", then: "She eats it all, slowly, while the lodge watches.", reply: ["pe-elder", "That is your right. We'll remember that you took it."], effect: feed(3) },
          ],
        },
        done: "For three nights nobody asks her anything. On the fourth morning, the Hearth-Keeper sits down beside her with a knotted cord in her hands.",
      },
      {
        step: 40,
        npc: "pe-guide",
        title: "Tuya Counts Winters",
        objective: "A snow-folk girl, Tuya, is tying knots in a cord by the lodge door. Ask her what she is counting.",
        lines: [
          ["pe-guide", "Winters. Each knot's one winter. This cord's the lodge's. Nine hundred knots. The hearth has burned through every one."],
          ["pe-guide", "Look. This knot isn't finished. I can't finish it. The winter isn't over. It's been winter for four years."],
          { a: "pe-guide", n: "knot" },
          ["pe-guide", "Spring stopped coming. The ice-oxen are dying. And the hearth is going down. Not because we've no wood. Because something is eating the heat out of it."],
        ],
        done: "Tuya ties a little extra knot at the end of the cord, for her. It means guest-who-stayed.",
      },
      {
        step: 60,
        npc: "pe-folk-2",
        title: "The Herder's Tale",
        objective: "A snow-folk herder has come back from the ice without her herd. Hear what she saw.",
        lines: [
          ["pe-folk-2", "I went to the Cairn Field to find the oxen. They were there. Standing. Frozen solid, all of them, standing up, looking north."],
          ["pe-folk-2", "And in the middle of them, eating the warm out of the last one alive, there was a snow-folk. Tall as two of us. Horns like ice. White all the way through."],
          ["pe-folk-2", "Kar. It was Kar. We cast him out ten winters ago for eating a guest's share. He's eating everything's share now."],
        ],
        done: "The herder's hands are blue to the wrist. Lin Yue holds them between hers until they are pink again, and the herder lets her.",
      },
      {
        step: 80,
        npc: "pe-elder",
        title: "The White Hunger",
        objective: "Hearth-Keeper Aru wants to talk about Kar. Go to her by the great hearth.",
        lines: [
          ["pe-elder", "We cast him out in the hungry winter. He took a guest's bowl. A guest! Sacred! We put him out into the snow with nothing, which is the worst thing the lodge knows how to do."],
          ["pe-elder", "He should have died. He didn't. He found something in the ice. An old hunger, from before the lodge. It's eating the winter's end and the hearth's heat, and he's eating with it."],
          ["pe-elder", "We made him. That's what I can't stop counting. We made him, the night we put him out."],
        ],
        choice: {
          prompt: "Hearth-Keeper Aru asks whether the lodge was wrong to cast Kar out.",
          options: [
            { heart: "mercy", label: "Yes, and he can still come home", then: "She says nobody should be put out into the snow, and that he might still come in.", reply: ["pe-elder", "Come in. After all this. …The law says a guest is sacred. It doesn't say anything about the cast out. Maybe it should."] },
            { heart: "sword", label: "No; he chose his hunger", then: "She says Kar chose, when he took the bowl, and chose again in the ice.", reply: ["pe-elder", "That's what we told ourselves. It helps, a little, less every winter."] },
            { heart: "balance", label: "Both; the law and the hunger are both too hard", then: "She says the law was hard and the hunger was harder, and the lodge needs a softer law.", reply: ["pe-elder", "A softer law. In the snow. You'd freeze to death writing it. Help me write it."] },
            { heart: "slaughter", label: "No; they should have finished it", then: "She says putting someone out to die is cowardice; they should have killed him.", reply: ["pe-elder", "…You may be right. I wish you weren't saying it by my hearth."], effect: feed(4) },
          ],
        },
        done: "Aru unties the knot of the hungry winter from the lodge's cord. It is the first time in nine hundred winters anyone has untied one.",
      },
      {
        step: 120,
        npc: "pe-folk-4",
        title: "The Hearth Song",
        objective: "A snow-folk child sings to the great hearth every night to keep it lit. She wants Lin Yue to sing with her.",
        lines: [
          ["pe-folk-4", "The hearth eats songs. That's what the old ones say. If you sing to it, it burns. I've sung every night for four years. It's not enough."],
          { a: "pe-folk-4", n: "hearthsong" },
          ["pe-folk-4", "Sing something from your home. The hearth's never heard a song from the south. It might be hungry for one."],
          { a: "hero", n: "hearthsong" },
        ],
        done: "She sings the Willow Creek harvest song, badly, with a child beside her. The great hearth crackles up a hand's width, and holds there.",
      },
      {
        step: 140,
        npc: "pe-envoy",
        title: "Cast Out",
        objective: "Tell Envoy Shan about the snow-folk's law, and what it made.",
        lines: [
          ["pe-envoy", "Cast out into the snow. We did that too, you know. To the peoples. We put them out of the jianghu and called it the Purge, and told ourselves they'd die out there."],
          ["pe-envoy", "They didn't. They went into the woods and the reefs and the sands and the sky. And we went hungry for them without knowing it. For their songs. Their stories. Their letters."],
          { a: "pe-envoy", n: "think" },
          ["pe-envoy", "If the Concord's going to be anything, it has to have room for the ones who were put out. All of them. Even the ones who came back wrong."],
        ],
        done: "The envoy writes a new line on the back of the tally, under the old oath, very small: “And no one put out into the snow.”",
      },
      {
        step: 160,
        npc: "pe-guide",
        title: "The Cairn Field",
        objective: "Tuya has gone to the Cairn Field alone, to tie a knot on her father's cairn. Go after her.",
        lines: [
          ["pe-guide", "My father went out to find Kar, two winters ago. This is his cairn. There's nothing under it. We build them anyway."],
          ["pe-guide", "I'm going to tie this winter's knot here. Unfinished. So he knows."],
          ["narr", "Across the Cairn Field, the frozen oxen are standing, all facing north. One of them turns its head."],
        ],
        choice: {
          prompt: "Tuya is kneeling by her father's cairn, and something is coming across the snow.",
          options: [
            { heart: "mercy", label: "Get her home first", then: "She picks Tuya up and carries her back toward the lodge, cord and all.", reply: ["pe-guide", "Put me down! …No. Don't put me down yet."] },
            { heart: "sword", label: "Stand between her and the snow", then: "She draws her sword and stands between the child and the frozen field.", reply: ["pe-guide", "Your sword's steaming. It's so cold the air's steaming off it."] },
            { heart: "balance", label: "Tie the knot with her, then go", then: "She kneels and helps her tie it, quickly and properly, and then they go.", reply: ["pe-guide", "Properly. You did it properly. Father'd have liked you."] },
            { heart: "slaughter", label: "Use the child as bait", then: "She tells Tuya to keep kneeling, and waits in the snow to see what comes for her.", reply: ["pe-guide", "…I'm cold. Please. I'm so cold."], effect: feed(3) },
          ],
        },
        done: "Whatever turned its head in the Cairn Field does not follow them. It stands with the frozen oxen, facing south now, toward the lodge.",
      },
      {
        step: 180,
        npc: "pe-elder",
        title: "A Horn on the Tally",
        objective: "Hearth-Keeper Aru has decided about the tally. Go to her by the great hearth.",
        lines: [
          ["pe-elder", "You came as a guest. Three nights. Then you stayed, which guests aren't meant to. Then you sang to our hearth, which only family does."],
          { a: "pe-elder", n: "knot" },
          ["pe-elder", "So the lodge sets its mark on the Concord. A horn, cut from my own. It'll grow back. Slowly. Like trust."],
          ["narr", "The great hearth gutters. Every flame in Rimehorn Lodge bends north, toward the ice, as if something were breathing in."],
        ],
        done: "The fifth notch holds a curl of horn, warm from the fire, knotted round with Tuya's cord.",
      },
      {
        step: 198,
        npc: "pe-guide",
        title: "The Fourth Winter's End",
        objective: "Kar is coming to eat the hearth. Tuya is waiting by it.",
        lines: [
          ["pe-guide", "He's coming in. Through the door. Like a guest. He's asking for his three nights."],
          ["pe-guide", "And the law says we have to give them to him. Hearth-Keeper's crying. I've never seen her cry. It freezes on her face."],
        ],
        done: "Kar, the White Hunger, ducks his great horns under the lodge's lintel and walks toward the hearth with his hands out, as if to warm them.",
      },
    ],
    rites: [
      { title: "Wood for the Hearth", ask: "haul a sledge of pine down from the snowline for the great hearth, as every guest who stays must", done: "The hearth takes it all and burns no brighter. Aru says it would have burned lower without it. That has to be enough." },
      { title: "A Knot for the Winter", ask: "tie a knot in the lodge's cord with Tuya, for the winter you spent with them", done: "Her knot is lumpy. Tuya says it's the most honest knot on the cord." },
      { title: "The Guest's Nights", ask: "keep the guest-law: wait on a traveller who has come in from the snow, for one night, and ask him nothing", done: "He leaves before dawn without saying where he was going. He leaves a coin under the bowl. They put it in the hearth." },
      { title: "Ice-Ox Calving", ask: "sit up through the night in the byre with the drovers, while the last ice-ox cow calves", done: "The calf is alive. The whole lodge comes to see it. Someone names it Envoy, and she cannot talk them out of it." },
      { title: "The Cairn-Builders", ask: "help build a cairn in the Cairn Field for a herder lost to the winter", done: "They build it high. On top, Aru puts the herder's knotted cord, still unfinished." },
      { title: "Singing the Fire", ask: "sing to the great hearth at midnight, when the snow-folk say it is hungriest", done: "She sings until her voice goes. The hearth holds steady. Aru brings her hot milk with butter in it, which in the lodge is a medal." },
    ],
    favours: [
      { ask: "dig a buried ice-ox out of a drift", done: "“Alive! Moaning, but alive. Like my husband.”" },
      { ask: "fetch snow-melt for the lodge's kettles before the evening meal", done: "“Water! Hot water! Tonight we are kings.”" },
      { ask: "mend a horn-sheath cracked in the cold", done: "“Bound with sect silk? My horns have never been so fashionable.”" },
      { ask: "warm a frozen child's hands with your qi", done: "The child's hands go pink. Then she puts them down your collar, which is a snow-folk joke." },
      { ask: "carry a kettle of butter tea to the sentries on the ridge", done: "“Butter tea! On the ridge! I take back everything I said about southerners.”" },
      { ask: "help repair the felt of a lodge torn in the night's wind", done: "“Patched. The draught's gone. Now we'll have to listen to Grandfather snore.”" },
    ],
    goods: ["a knotted cord counting one winter", "a jar of ice-ox butter", "a bundle of felt from Rimehorn Lodge", "a coal from the great hearth, wrapped in iron, still burning"],
    tales: [
      "“Ram-horned folk in the snows? The monks at Frostveil leave bread out for them. I thought it was for the birds.”",
      "“A guest sacred for three nights. My inn should try that. We'd go broke in a week.”",
      "“They put a man out into the snow, and he came back a monster. That's a ghost story. That's also my village.”",
      "“Winter for four years in the north? So that's why the wool's so dear.”",
    ],
    elder: ["Sit closer to the fire. Closer. You southerners always sit like you're about to leave.", "A knot for every winter. I've tied two hundred. My mother tied four hundred. The cord is long. The cord is patient.", "Eat. That's not hospitality, that's an order."],
    guide: ["Can you tie a knot that holds a winter? It's harder than it sounds. Winters wriggle.", "When spring comes I'm going to finish the knot so tight nobody can ever undo it.", "My horns are growing! Feel. No, gently. They're new."],
    boss: {
      intro: "in through the lodge door comes Kar, the White Hunger, horns of ice scraping the lintel, asking for his three nights as a guest",
      words: [
        ["pe-boss", "Three nights. I'm a guest. Sacred. You can't refuse me. You can't ask my business."],
        ["pe-boss", "My business is the hearth. You put me out into the snow. Now I've brought the snow in with me. It's cold out there, Hearth-Keeper. It's so cold."],
        ["pe-elder", "Kar. Come and sit down. Please. Just sit down."],
      ],
      fates: [
        { heart: "mercy", label: "Give him a place by the fire", line: "She sits him down by the great hearth and gives him a bowl. His hunger goes out of him, all at once, like breath on a cold morning, and Kar weeps, and his tears are only water." },
        { heart: "sword", label: "Cut the old hunger out of him", line: "Her blade goes through the White Hunger and out the other side, and the old thing from the ice goes out of him with it, shrieking, and melts on the hearthstone." },
        { heart: "balance", label: "Make the law soft enough to hold him", line: "She asks Aru to unknot the casting-out. Aru does it with her teeth. Kar is a guest, and then he is family, and the hunger has nowhere left to live." },
        { heart: "slaughter", label: "Put him out for good", line: "She throws Kar out into the snow, and makes sure, this time, that he does not come back. The lodge is warm again. The lodge is quiet." },
      ],
      victory: "In the morning it is spring at Rimehorn Lodge, four years late. Tuya finishes the knot so tightly that nobody will ever undo it.",
    },
  },
  // ------------------------------------------------------------------------------------------------ VI · the Dragon-Kin
  {
    title: "Wake the Bones",
    hanzi: "龙骨苏醒",
    level: 17,
    beats: [
      {
        step: 0,
        npc: "pe-envoy",
        title: "Five Marks",
        objective: "Return to Envoy Shan at the Concord Stone, with five marks on the tally.",
        lines: [
          ["pe-envoy", "Five. A paw, a scale, a hand, a feather and a horn. Five peoples talking to one another again. I had a letter from the reef yesterday. The reef! Writing to me!"],
          ["pe-envoy", "One more, and the Concord stands. The dragon-kin, at Emberscale Hold in the red badlands, down the road toward Hailing. They are the oldest people of all. The Concord Stone was cut from their mountain."],
          ["pe-envoy", "They were not hunted in the Purge, {title}. They watched. That's their wound. Be careful with it."],
        ],
        done: "The envoy goes very quiet, and then says, “When you've been, come back and tell me. Whatever happens. Come back.”",
      },
      {
        step: 20,
        npc: "pe-elder",
        title: "The Matriarch",
        objective: "Find Matriarch Ao Rong, elder of the dragon-kin, by the scale brazier at the heart of Emberscale Hold, in the red badlands.",
        lines: [
          ["narr", "Emberscale Hold is roofed in gold scales the size of shields. Every one was shed by a dragon-kin and given back to the Hold. Its libraries go down into the rock for a mile."],
          ["pe-elder", "The tally. Five marks on it. You've been busy, little cultivator. We heard. We hear everything. We hoard it."],
          ["pe-elder", "You want our claw on the stone. Of course you do. It's our stone. Do you know what we did, in the Purge? We sat in our libraries, and we wrote it all down, every hunt, every name. And we did nothing."],
        ],
        choice: {
          prompt: "Matriarch Ao Rong asks her what doing nothing deserves.",
          options: [
            { heart: "mercy", label: "Forgiveness, if it is asked", then: "She says anyone may be forgiven who asks the ones they failed.", reply: ["pe-elder", "Asks. We'd have to go out of our libraries to ask. Hm."] },
            { heart: "sword", label: "To be finally done", then: "She says that whatever was not done then can be done now.", reply: ["pe-elder", "Done now. Three hundred years late. The young ones say the same. Too loudly."] },
            { heart: "balance", label: "To be remembered truly", then: "She says that writing it all down was something, and that the writing must be read.", reply: ["pe-elder", "Read. Yes. By whom? You? Sit down. It's a long book."] },
            { heart: "slaughter", label: "Contempt", then: "She says the dragon-kin deserve exactly what they gave: nothing.", reply: ["pe-elder", "Fair. Exactly fair. My grandson would like you."], effect: feed(3) },
          ],
        },
        done: "The matriarch takes her down the first staircase into the libraries, and shows her the shelf of the Purge. It is longer than the Hold.",
      },
      {
        step: 40,
        npc: "pe-guide",
        title: "Ao Xun, Who Reads",
        objective: "A young dragon-kin scholar, Ao Xun, has been sent to guide her. Find him.",
        lines: [
          ["pe-guide", "I'm Ao Xun. I'm the one who reads the Purge shelf. All of it. Nobody else will. I've read it six times."],
          ["pe-guide", "Every people you've been to is in it. The fox hollow. The reef. The jars. The Hold's sleepers taken in their sleep. The eyrie's nets. The snow-folk's herds burned."],
          ["pe-guide", "And at the end of each one: “The Hold observed.” That's us. We observed."],
          { a: "pe-guide", n: "read" },
        ],
        done: "Ao Xun gives her a copy of the first page, in his own hand. He copied it seven times before it was neat enough.",
      },
      {
        step: 60,
        npc: "pe-folk-2",
        title: "Fire Practice",
        objective: "A young dragon-kin is breathing fire at the Bone Arch, alone. Ask him why.",
        lines: [
          ["pe-folk-2", "Practice. For when we wake the bones. Ao Kuang says when the last dragon's fire is in us, we'll never just observe again."],
          { a: "pe-folk-2", n: "firebreath" },
          ["pe-folk-2", "He says the sects that hunted the others are still there. Still sitting on their mountains. He says the dragon-kin owe a debt of fire, and it's time to pay."],
          ["narr", "The flame goes a long way out over the red earth. Where it lands, the sand turns to glass."],
        ],
        done: "The young dragon-kin's eyes are full of the Bone Arch. He does not look at her once.",
      },
      {
        step: 80,
        npc: "pe-elder",
        title: "Ao Kuang the Unbound",
        objective: "Matriarch Ao Rong wants to speak to her about her grandson.",
        lines: [
          ["pe-elder", "Ao Kuang. My grandson. He read the shelf too, before Xun did. He came out of the libraries and burned his own books."],
          ["pe-elder", "The bones in the Bone Arch are the last great dragon's. There's fire still in them. If it wakes in one of us, that one becomes a dragon. Ao Kuang means to be that one, and pay the sects back for every name on the shelf."],
          ["pe-elder", "Every sect. Yours too, little cultivator. The Azure Cloud floats over Willow Creek. It would come down on Willow Creek."],
        ],
        choice: {
          prompt: "Matriarch Ao Rong asks if her grandson is wrong.",
          options: [
            { heart: "mercy", label: "Wrong, because the innocent would burn", then: "She says the sects that hunted are gone, and the ones that would burn now are children.", reply: ["pe-elder", "Children. Yes. There are always children, under everything that falls."] },
            { heart: "sword", label: "Right about the debt, wrong about who pays", then: "She says the debt is real, and she will see it paid, but not in fire on villages.", reply: ["pe-elder", "Then you'll have to name who pays. That's a terrible thing to have to do. Do it well."] },
            { heart: "balance", label: "Wrong, because fire answers nothing", then: "She says fire would just put new names on the shelf.", reply: ["pe-elder", "New names on the shelf. Xun would have to read them. That's a reason I can hold onto."] },
            { heart: "slaughter", label: "Not wrong at all", then: "She says the sects earned it, and so did their villages, for looking away.", reply: ["pe-elder", "…That's what we did. Looked away. Is that what you think we deserve too?"], effect: feed(4) },
          ],
        },
        done: "The matriarch sheds a scale from her own wrist, gold and warm, and lays it in Lin Yue's hand. A debt of fire, given. She does not say for what.",
      },
      {
        step: 120,
        npc: "pe-folk-1",
        title: "The Hoard",
        objective: "The keeper of the Hold's hoard of books has found something on the Purge shelf. Go to her.",
        lines: [
          ["pe-folk-1", "The last page of the Purge. Nobody reads the last page. It's in the old script. Xun can't read the old script. I can."],
          ["pe-folk-1", "It says the Concord Stone didn't crack because of the hunts. It cracked because the dragon-kin took their claw-mark off it, the night before, to keep themselves out of it. So the sects would leave us alone."],
          ["pe-folk-1", "We broke the Concord. Not the humans. Us. And then we wrote down what happened to everyone else."],
        ],
        done: "The keeper closes the book and puts it back on the shelf. Then she takes it down again and gives it to Lin Yue, to carry to the envoy.",
      },
      {
        step: 140,
        npc: "pe-envoy",
        title: "Who Broke It",
        objective: "Take the last page of the Purge to Envoy Shan at the Concord Stone.",
        lines: [
          ["pe-envoy", "…The dragon-kin took their mark off. To save themselves. And the stone broke, and the sects took it for a sign, and the hunts started the next day."],
          { a: "pe-envoy", n: "think" },
          ["pe-envoy", "Three hundred years I've hated the sects for it. And the sects were only the hand. Everybody was the hand. Everybody always is."],
          ["pe-envoy", "Don't tell the other peoples, {title}. No. Do. Tell them. A Concord built on not knowing is what broke last time."],
        ],
        done: "The envoy reads the page three times, then lays it under the Concord Stone, under the crack, where it fits as if it had been cut to.",
      },
      {
        step: 160,
        npc: "pe-guide",
        title: "The Reader's Choice",
        objective: "Ao Xun has read the last page too. He is at the Bone Arch. Go to him.",
        lines: [
          ["pe-guide", "Ao Kuang asked me to wake the bones with him. He said I'd read the shelf, so I'd understand. I do understand. That's the trouble."],
          ["pe-guide", "If I go with him, there's fire. If I don't, I'm just observing again. Like the Hold. Like always."],
        ],
        choice: {
          prompt: "Ao Xun asks what a reader should do, when reading is not enough.",
          options: [
            { heart: "mercy", label: "Go to each people, and ask forgiveness", then: "She tells him to carry the last page to every people himself, and ask.", reply: ["pe-guide", "Out of the Hold? Me? …Yes. Yes, I'll go. You'll come? The first time?"] },
            { heart: "sword", label: "Stand against Ao Kuang", then: "She tells him to stand with her at the Bone Arch, between his cousin and the bones.", reply: ["pe-guide", "I've never stood against anyone. I've only read about it. …I'll stand."] },
            { heart: "balance", label: "Write a new last page", then: "She tells him to write what happens next himself, and to make it worth reading.", reply: ["pe-guide", "A new last page. Not “The Hold observed.” Something else. I'll think of a word."] },
            { heart: "slaughter", label: "Go with Ao Kuang, and watch the sects burn", then: "She tells him the sects deserve it, and he may as well watch closely.", reply: ["pe-guide", "…You'd let him? You carry the tally. You'd let him?"], effect: feed(3) },
          ],
        },
        done: "Ao Xun closes his book. It is the first time anyone in Emberscale Hold has seen him without one open.",
      },
      {
        step: 180,
        npc: "pe-elder",
        title: "The Claw Returned",
        objective: "Matriarch Ao Rong has gathered the whole Hold. Go to her at the scale brazier.",
        lines: [
          ["pe-elder", "We took our mark off the stone. Three hundred years ago. We are putting it back."],
          { a: "pe-elder", n: "offerpearl" },
          ["pe-elder", "And we are sending our readers out, with the last page, to every people on that tally. To ask. Not to observe. To ask."],
          ["narr", "Out at the Bone Arch, the bones of the last great dragon begin, very slowly, to glow."],
        ],
        done: "The sixth notch holds a dragon's claw of gold. And as it sets, the Concord's tally grows warm in her hands, all six marks at once, as if they were holding hands.",
      },
      {
        step: 198,
        npc: "pe-guide",
        title: "The Bone Arch Burns",
        objective: "Ao Kuang has gone to the Bone Arch to wake the bones. Ao Xun is waiting in the Hold.",
        lines: [
          ["pe-guide", "He's inside the ribs. The fire's coming up out of the ground into him. His horns have gone black. He's not my cousin anymore. He's becoming the thing on the shelf."],
          ["pe-guide", "If he finishes, every sect from here to the Azure Cloud burns. And the Concord with it. I'm coming with you. I've read enough."],
        ],
        done: "Ao Kuang the Unbound comes out of the Bone Arch on fire, black-horned, with the last great dragon's flame in his eyes.",
      },
    ],
    rites: [
      { title: "The Shed Scale", ask: "receive a shed scale from a dragon-kin of the Hold, and give one thing of yours back, as the debt of fire asks", done: "She gives a strand of her hair. It is placed in a lacquer box, labelled, and shelved. Forever." },
      { title: "A Page of the Hoard", ask: "copy one page of the Hold's library by hand, as every guest who reads there must", done: "She copies a page about rice. It takes a day. The keeper says it is the best page about rice in the Hold, because it was copied by someone who has planted it." },
      { title: "Tending the Braziers", ask: "keep the Hold's braziers fed through the night, as the dragon-kin's young do", done: "At dawn the young dragon-kin who should have done it brings her breakfast and asks her not to tell. She tells nobody." },
      { title: "Reading the Shelf", ask: "read one people's chapter of the Purge shelf with Ao Xun, aloud, all the way through", done: "It takes until midnight. Neither of them speaks when it is done. Ao Xun puts the book back very gently, as if it might wake." },
      { title: "The Fire-Oath", ask: "stand in the circle of braziers while the matriarch speaks the dragon-kin's fire-oath: never to observe again", done: "The braziers flare at the last word. The young dragon-kin cheer. The old ones only bow their heads." },
      { title: "A Letter for Each People", ask: "help the Hold's scholars write a letter to each people on the tally, asking forgiveness", done: "Six letters. Each one starts differently. Each one ends: “The Hold did not observe this time.”" },
    ],
    favours: [
      { ask: "carry a stack of books up from the deep library without dropping any", done: "“Not one dropped! You have the arms of a librarian. That's the highest praise we have.”" },
      { ask: "polish the Hold's roof-scales after a dust storm", done: "“Gleaming! From the badlands' edge they'll see us shine.”" },
      { ask: "fetch water for the brazier-tenders, who forget to drink", done: "“Water! Oh. Yes. I'd forgotten that was a thing. Thank you.”" },
      { ask: "help a young dragon-kin practise his fire without setting the library alight", done: "Only one book catches. It is a dull one. The keeper lets it burn." },
      { ask: "sharpen the hold-guard's sword on your own whetstone", done: "“A sect whetstone. So that's how you're so sharp. Hm. May I copy it?”" },
      { ask: "find a book that has been misshelved for a hundred years", done: "It was in the wrong row by one. The keeper weeps a little. “It's been so lonely.”" },
    ],
    goods: ["a shed gold scale, a debt of fire", "a copy of the last page of the Purge", "a book from the hoard, lent for a hundred years", "a coal from the Bone Arch, faintly glowing"],
    tales: [
      "“Dragon-kin, in the badlands? My sect's founder rode one, the legend says. I'm starting to think the legend has it backwards.”",
      "“They wrote everything down and did nothing. That's a magistrate. That's every magistrate.”",
      "“A library a mile deep. I'd walk to the badlands for that. On my knees.”",
      "“The ones who watched broke it, not the ones who hunted? Huh. That's a story my grandmother would have liked. She always said it was the watchers.”",
    ],
    elder: ["We hoard knowledge. It's heavier than gold. You can't spend it, and you can't put it down.", "Sit. Read something. You'll feel worse, and then better.", "A shed scale is a debt of fire. I have given you one. Mind how you spend it."],
    guide: ["I've read about you. In the letters. The fox-folk call you the oath-human. The reef calls you the land-girl. Which do you like?", "Have you read this? You must read this. Oh, you don't read the old script. I'll read it to you.", "I'm going to write the next shelf. A good one. With no observing in it."],
    boss: {
      intro: "out of the burning Bone Arch strides Ao Kuang the Unbound, black-horned, the last great dragon's fire in his eyes and his saber",
      words: [
        ["pe-boss", "The tally! Six marks! Very touching. And the sects still on their mountains, every one of them, never asked to pay."],
        ["pe-boss", "We observed. I read it. I will never observe again. I will be the fire on the shelf."],
        ["pe-guide", "Kuang, the last page! We broke it! Not them! Us!"],
        ["pe-boss", "Then I'll burn us too."],
      ],
      fates: [
        { heart: "mercy", label: "Read him the last page", line: "She holds him down in the ashes and reads him the last page of the Purge, aloud, in the old script, the way Ao Xun taught her. At the end, the fire goes out of his eyes, and he says: “Read it again.”" },
        { heart: "sword", label: "Cut the dragon's fire from him", line: "Her blade passes through the last great dragon's flame where it burns in his chest, and the fire goes back down into the bones, and the bones go dark and quiet and only bones." },
        { heart: "balance", label: "Give the fire back to the bones", line: "She takes his burning hand and lays it on the dragon's skull. The flame runs out of him and into it, gently, the way a tired child runs home. The Bone Arch glows a little, and will, forever." },
        { heart: "slaughter", label: "Take the dragon's fire for herself", line: "She takes the fire out of him, and keeps it. For a moment there are wings of flame at her back. The Hold kneels. The tally, at her belt, goes cold." },
      ],
      victory: "The Concord's tally hangs at her belt, six marks warm on it. At the crossroads below Willow Creek, the old stone's crack has closed by the width of a hair.",
    },
  },
];
