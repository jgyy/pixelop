import { levelIndex, realmLabel, REALMS } from "../engine/realms";
import type { GameState } from "../engine/state";
import { heartDemons } from "../engine/cultivation";
import { dominantDao } from "../engine/dao";
import type { HumanId } from "../art/characters";
import { JINHE_QUARTERS, WILLOW_WARD } from "../world/quarters";
import { TIER_FOLK, TIER_LEVEL, TIER_SITES } from "../world/tiers";
import type { CrowdKind } from "../world/crowds";
import type { Step } from "./script";

/**
 * Standing (身份): what her realm makes her in the eyes of the jianghu.
 *
 * A cultivator's realm is not a private matter. It decides what the folk
 * call her (Miss, Immortal, Venerable, Ancestor), whether a mortal looks
 * her in the eye or goes down on both knees, whether a sect's disciple calls
 * her Junior or Senior, which tier of the City of Nine Tiers her tablet
 * lets her stand on, whose word outweighs whose, and whether a door opens.
 * Everyone she meets in the town, the city and the wilds now speaks to her
 * realm, and the folk of the new quarters have a line for each of them.
 */

/** Her overall level (realm and stage together). */
export const levelOf = (g: GameState) => levelIndex(g.realm, g.stage);

/** What a mortal calls her, by her realm. */
const MORTAL_TITLE = ["Miss Cultivator", "Young Immortal", "Venerable Immortal", "Ancestor", "Exalted One", "Heavenly Immortal"];
/** What another cultivator calls her, by her realm. */
const PEER_TITLE = ["Junior Sister", "Fellow Daoist", "Senior", "Senior Ancestor", "Venerable Senior", "Immortal Senior"];

export const honorific = (g: GameState) => MORTAL_TITLE[Math.min(5, g.realm)];
export const peerTitle = (g: GameState) => PEER_TITLE[Math.min(5, g.realm)];

/** The highest tier of the City of Nine Tiers her realm opens (0, the Mud Tier, for anyone). */
export function realmTier(g: GameState): number {
  const L = levelOf(g);
  let t = 0;
  TIER_LEVEL.forEach((need, k) => {
    if (L >= need) t = k;
  });
  return t;
}

/** Fill a line's placeholders: {title} (what a mortal calls her), {peer} (what a cultivator calls her), {realm} (her realm and stage), {tier} (the highest tier her tablet opens). */
export function fillStanding(text: string, g: GameState): string {
  if (!text.includes("{")) return text;
  return text.replace(/\{(title|peer|realm|tier)\}/g, (_, k: string) => (k === "title" ? honorific(g) : k === "peer" ? peerTitle(g) : k === "realm" ? realmLabel(g.realm, g.stage) : TIER_SITES[realmTier(g)].name));
}

// ----------------------------------------------------------------------------- the jianghu's ordinary folk
type Caste = "mortal" | "cultivator" | "soldier";
const CASTE: Record<CrowdKind, Caste> = {
  villager: "mortal",
  disciple: "cultivator",
  soldier: "soldier",
  refugee: "mortal",
  monk: "cultivator",
  outer: "cultivator",
  sword: "cultivator",
  phoenix: "cultivator",
  herb: "mortal",
  miner: "mortal",
  fisher: "mortal",
  nomad: "mortal",
  porter: "mortal",
  child: "mortal",
  noble: "mortal",
};

/** What the folk make of a cultivator of her realm, by who they are: one list for each realm, Qi Condensation to Immortal Ascension. */
const BY_REALM: Record<Caste, string[][]> = {
  mortal: [
    ["A sect girl! Are you really a cultivator? You look like you eat rice like the rest of us.", "Cultivator, eh? My cousin says the little ones of your kind are no stronger than a good ox. No offence, miss.", "Mind the chickens, miss cultivator. They don't know you're special."],
    ["{title}! Forgive me — I didn't see your foundation. I mean, I can't see it. But my knees knew.", "They say a Foundation cultivator can lift a millstone. Would you… no. No, of course not. Sorry, {title}.", "The headman says when a Foundation cultivator walks through, you give way on the road. I'm giving way. See?"],
    ["Bow, children, bow! A golden core walks past once in a lifetime!", "{title}… I… my mother is sick. No — forgive me. It isn't my place to ask a Core Formation cultivator for anything.", "I'll not lift my eyes, {title}. My grandfather said a golden core can burn a man who stares."],
    ["Ancestor… ancestor, I've knelt on these stones forty years and never for anyone but the magistrate. I don't know the words. Please forgive my words.", "The whole lane's on its knees, {title}. Even the dog. You needn't stop for us.", "A Nascent Soul… my son will never believe a Nascent Soul cultivator asked after his mother."],
    ["…", "Exalted One. The air goes thin round you, like the mountains. We'll wait till you've passed to breathe.", "I'm told a Spirit Severing cultivator's word can end a dynasty. I hope you only want directions."],
    ["Heavenly Immortal… is it true? Have you come down to us?", "The temple's lit every lamp since the word went round that an Immortal walks the roads. Bless us, {title}, if you've a moment.", "My little girl says the Immortal smiled at her. I've told her to remember it for her grandchildren."],
  ],
  cultivator: [
    ["Junior Sister! First time out of the sect? Stay near the road and you'll live to break through.", "Qi Condensation? Hm. I remember those days. Mostly I remember being beaten by everyone.", "We're of a realm, you and I. Spar sometime? Neither of us would be embarrassed."],
    ["Fellow Daoist. Foundation, isn't it? Steady footing. I'm still knocking at that door.", "A Foundation cultivator… Senior Sister, then, if you'll allow it. The rules are the rules.", "Fellow Daoist, would you look at my stance? A word from someone with a foundation is worth a month of forms."],
    ["Senior! Forgive this junior for not greeting you sooner. A golden core — I could feel it like a stove behind a wall.", "Senior, a pointer for a junior? No? No. Of course not. Thank you for your time, Senior.", "My master is Core Formation. He wouldn't speak to me this long. Thank you, Senior."],
    ["Senior Ancestor! This disciple salutes you! My sect would give its last stone to host a Nascent Soul.", "I won't spar you, Senior Ancestor. I'd like to live to my next breakthrough.", "Is it true a Nascent Soul can leave the body and walk? Don't answer. I'm not worthy to know."],
    ["…Venerable Senior. My dantian is shaking. Is it meant to do that near you?", "The elders say a Spirit Severing cultivator has cut away fear. I haven't. Forgive me.", "This disciple will tell his grandchildren he stood in the same street as a Spirit Severing cultivator. If he has grandchildren. If he lives."],
    ["Immortal Senior. Every sect in the jianghu will want to say you once passed through. Ours will say it loudest.", "We were told you would come down. We were not told you would smile.", "Immortal Senior… is it like they say, up there? No. Forgive me. I'll find out for myself."],
  ],
  soldier: [
    ["Halt — oh. A sect girl. On you go, but keep your sword sheathed in town.", "Cultivator? Fine. Rules are the same for all of you below Foundation: no flying over the roofs.", "Papers? No? Sect token will do. On you go."],
    ["A Foundation cultivator, the sergeant said to let you through and not to ask. I'm not asking.", "{title}. If there's trouble, we'd be glad of you. Very glad. We're only spears.", "My spear wouldn't scratch a Foundation cultivator. Don't tell the bandits."],
    ["Present arms! — sorry, {title}. Habit. The captain said to salute golden cores.", "A Core Formation cultivator on our picket. The lads will sleep sound tonight.", "If you ever want a commission, {title}, the army would make you a general before supper."],
    ["The whole watch is kneeling, {title}. The captain says it's regulation for a Nascent Soul. I say it's sense.", "Ancestor, we'll clear the road ahead of you. Nobody need trouble you with talk.", "My captain says one Nascent Soul is worth a regiment. Then you're worth all of us, Ancestor."],
    ["…", "Exalted One. We were told to stand aside and not look. We're standing aside.", "If you ever lose your temper, Exalted One, would you warn us first?"],
    ["Heavenly Immortal. There are no orders for this. We're making them up as we go.", "Heavenly Immortal, the general asks if you'd bless the standard. He asks very humbly.", "We'd die for you, Immortal. Not that you'd need us to."],
  ],
};

/** A mortal goes down on her knees before someone this far above her (Nascent Soul on, or a golden core now and then). */
export const kneels = (caste: Caste, g: GameState, n: number) => caste === "mortal" && (g.realm >= 3 || (g.realm === 2 && n % 3 === 0));

/**
 * What one of the jianghu's ordinary folk says to her realm, now and then:
 * the steps before their own chatter (a kneel, and a word for her realm), or
 * null when they only want to talk about their own lives today.
 */
export function crowdRealm(key: string, kind: CrowdKind, n: number, g: GameState, speaker: HumanId, name: string): Step[] | null {
  const caste = CASTE[kind];
  // they always notice a realm above Qi Condensation; below it, only now and then
  const turn = Math.floor(g.playTime / 9 + g.kills + n * 5);
  if (g.realm === 0 && turn % 3 !== 0) return null;
  if (g.realm > 0 && turn % 2 === 1) return null;
  const lines = BY_REALM[caste][Math.min(5, g.realm)].filter((l) => l !== "…");
  const text = fillStanding(lines[(n + turn) % lines.length], g);
  const steps: Step[] = [];
  if (kneels(caste, g, n)) steps.push({ anim: key, name: "kneel" });
  if (heartDemons(g) > 60 && caste === "mortal") return [{ say: speaker, name, text: "D-don't come closer, {title}. Please. I've children.".replace("{title}", honorific(g)) }];
  steps.push({ say: speaker, name, text });
  return steps;
}

// ----------------------------------------------------------------------------- the new quarters of Jinhe and Willow Creek
/** Each of the new folk's line for each realm (Qi Condensation, Foundation, Core, and Nascent Soul or beyond). */
const QUARTER_LINES: Record<string, [string, string, string, string]> = {
  "jx-teahost": [
    "Welcome to the Pavilion of Nine Fragrances! Ground floor's for everybody. The upper floor is for cultivators of standing — Foundation and above, miss. House rule. I don't make the rules. Well, I do. But I didn't want to.",
    "A Foundation cultivator! Upstairs, {title}, upstairs! The window seat over the lane is yours. The poet will move. Won't you, Shu Ye?",
    "{title}, the whole upper floor is yours tonight. I've sent the merchants home. They understood. A golden core under my roof — I'll put it on the signboard.",
    "Ancestor… the Pavilion is yours. All three storeys. I'll bring the wine myself. My father would weep to see this.",
  ],
  "jx-poet": [
    "I write verses for whoever buys the wine. You won't buy the wine. Ha. Nobody below Foundation ever does.",
    "A Foundation cultivator. Shall I write you a verse? “She walked the lane, and the lane remembered.” …It needs work.",
    "For a golden core I'd write a whole cycle. Twelve poems. Seasons and so on. Free. Well — nearly free.",
    "I tore up every poem I'd written when I saw you, {title}. They were all about smaller things.",
  ],
  "jx-saltlord": [
    "The commissioner's residence. Petitions to the side door. Cultivators below Foundation queue with the merchants.",
    "Ah, a Foundation cultivator. Come in, come in — the side door is for petitioners, not for you. Tea?",
    "{title}! The salt monopoly is honoured. If there is anything Jinhe's salt can do for a golden core, name it.",
    "Ancestor, I have written to the capital that a Nascent Soul cultivator walks Jinhe's streets. They have written back asking me to beg you not to leave.",
  ],
  "jx-saltlady": [
    "My husband says I mustn't speak to wandering cultivators. You look harmless. That's not a compliment, dear.",
    "My daughter is fourteen and has a spirit root. Would a Foundation cultivator consider… no. Forgive a mother.",
    "{title}, my daughter is fourteen and has a spirit root. Look at her once, only once, and tell me if she's worth a teacher.",
    "I have watched from this balcony thirty years for something worth watching, {title}. Today it walked past.",
  ],
  "jx-bearer1": [
    "Chair for hire! Mortals and Qi Condensation, two coppers a street. You walk? Suit yourself.",
    "Carry a Foundation cultivator? On our shoulders? The lads'd fight for it, {title}. No charge.",
    "{title}, we'd carry you to the capital for nothing. Then we'd tell everyone we did.",
    "We'd kneel, {title}, but if we kneel the chair falls over. Will a bow do?",
  ],
  "jx-bearer2": [
    "Left foot, right foot, don't spill the merchant. That's the whole of the job.",
    "My brother says a Foundation cultivator weighs no more than a merchant. He's never carried one.",
    "Golden core, they say. I'd carry it even if it was hot.",
    "Ancestor. Forgive me. I'm only a bearer. I've only got shoulders.",
  ],
  "jx-drummer": [
    "I beat the hours from the drum tower. Dawn, noon, dusk, the second watch. Cultivators hear it like the rest of us.",
    "When a Foundation cultivator comes through the gate, I give the drum three beats. It's tradition. I made it up last week.",
    "A golden core in town: nine beats. The magistrate's orders. The whole city knows you're here, {title}.",
    "There's no number of beats for a Nascent Soul. I just kept beating till my arms gave out, {title}.",
  ],
  "jx-dyer": [
    "Indigo, madder, gardenia. My hands are blue to the elbow. Cultivators don't dye, do they? They just stay clean somehow.",
    "Dye you a sash, {title}? Foundation blue, we call it. The colour of a clear morning.",
    "For a golden core there's only one colour: gardenia gold. I'll dye you a length for nothing.",
    "My whole vat turned gold when you walked past, {title}. I'm not complaining. I'm selling it.",
  ],
  "jx-guild": [
    "The Grain Guild does not lend to cultivators below Foundation, miss. Too many of you die young. Nothing personal.",
    "For a Foundation cultivator the Guild extends credit — fifty silver, no interest for a season. A cultivator's word is good.",
    "{title}, the Guild would be honoured to have a golden core on its board. You'd do nothing. That's what the board does.",
    "Ancestor, the Guild's ledgers are open to you. All of them. Even the ones the magistrate hasn't seen.",
  ],
  "jx-clerk2": [
    "Stamp, stamp. Every sack of grain gets a stamp. Every cultivator who passes gets a line. Qi Condensation… there.",
    "Foundation Establishment. I'll write it in red. Red is for people who matter.",
    "Core Formation. I'll write it in gold. We had to buy gold ink. We bought it this morning.",
    "I've no ink for a Nascent Soul, {title}. I'll just leave a space and let people imagine.",
  ],
  "jx-haggler": [
    "Three coppers for the radish? Robbery! Two! …You're a cultivator? Then it's four. Cultivators can afford four.",
    "Foundation, are you? Then I won't haggle. Much. Two and a half.",
    "{title}, take the radish. Take the basket. Haggling with a golden core is how my mother lost her eyebrows.",
    "I've never not haggled in my life, {title}. Here. Free. I feel faint.",
  ],
  "jx-stallman": [
    "Combs, mirrors, hairpins! Cultivators' hairpins, guaranteed to hold through a qi deviation!",
    "For a Foundation cultivator, the jade pin. It's not jade. But you'd make it look like jade.",
    "{title}, choose anything. Then let me hang a sign: “A golden core bought here.”",
    "I'll close the stall, {title}. Nobody will buy anything after you've looked at it anyway.",
  ],
  "jx-gossipA": [
    "Psst. That one's a cultivator. Only Qi Condensation. My nephew's further along and he's a fool.",
    "Psst — Foundation. She's Foundation. Don't stare, Kang, she'll know.",
    "A golden core, Kang. A golden core in the south lane. Get the good teacups out.",
    "Kang… Kang, kneel. It's a Nascent Soul. No, I don't care if your hip hurts. Kneel.",
  ],
  "jx-gossipB": [
    "Lin says you're a cultivator. Lin says everyone's a cultivator. Lin says the cat's a cultivator.",
    "Lin says Foundation. I say she has a nice face. We're both right.",
    "Golden core. Golden. Core. I'm telling my sister in Reedwater before Lin can.",
    "My hip does hurt. But I'm kneeling, {title}. See? Kneeling.",
  ],
  "jx-beggar2": [
    "A copper for a blind man? …You smell of qi. Cultivator's coins are lucky, they say.",
    "Foundation, by the weight of your step. A Foundation cultivator gave me a silver once. I lived on it a month.",
    "I can't see you, {title}, but the warmth off you… is that a golden core? Sit with me a moment. I'm cold.",
    "Ancestor. I can see light. I can't see anything, and I can see light. Don't go yet.",
  ],
  "jx-watch": [
    "Watchman's round. Cultivators below Foundation, mind the curfew like anyone else.",
    "{title}, curfew doesn't apply to Foundation cultivators. It's in the bylaws. Small print.",
    "Golden cores don't have curfews, they have escorts. Shall I walk with you, {title}?",
    "I'll call the hours quieter tonight, {title}, so as not to wake you. If Nascent Souls sleep.",
  ],
  "jx-lantern": [
    "I light the lanterns up the west lane. Can you light them with qi? Show me! …Oh. Only a little spark. That's all right.",
    "A Foundation cultivator! Light them all at once! Please? …Wow.",
    "{title}, if you light the lanterns they'll burn gold. Everyone says so. Go on.",
    "The lanterns lit themselves when you came up the lane, {title}. I'm out of a job. I don't mind.",
  ],
  "jx-scribe": [
    "Letters written, a copper a page. Cultivators write their own, mostly. Show-offs.",
    "A letter home, {title}? For a Foundation cultivator I'll use the good paper.",
    "I'll write it in my best hand, {title}. A golden core's letter will be kept, framed, fought over.",
    "Ancestor, anything you dictate I'll copy a hundred times and sell. Forgive me. I'm honest about it.",
  ],
  "jx-cultivator": [
    "Qi Condensation? Me too. Rogue cultivator — no sect. We eat what we catch. Good luck out there, little sister.",
    "Foundation… you broke through before me. Fine. I'll call you Senior Sister. Through gritted teeth.",
    "Senior. Forgive my rudeness before. A golden core — I'll wander a hundred years and not see one up close again.",
    "Senior Ancestor! If you ever take a disciple — I'm forty-three and I snore, but I'm very loyal.",
  ],
  "jx-sectgirl": [
    "The Golden Pavilion recruits at Foundation. Come back when you're someone.",
    "A Foundation cultivator! The Golden Pavilion would like to invite you to tea. Shangguan Yan would like it less.",
    "Senior! The Pavilion Master begs you to visit. She says “begs”. She has never begged.",
    "Senior Ancestor, the Golden Pavilion would close its gates for a day for you. It has never closed its gates.",
  ],
  "jx-porter2": [
    "Out the way, out the way! Unless you're a cultivator — then I'm out of yours.",
    "Foundation, they said in the square. I'll go round you, {title}. The long way.",
    "{title}! I'll carry your things, whatever they are. A golden core shouldn't carry things.",
    "I'm putting it down, {title}. Whatever it is. I'm putting it down and kneeling.",
  ],
  "jx-mother": [
    "Hush, little one, hush. The cultivator won't hurt you. Will you, miss?",
    "{title}, would you hold her a moment? They say a Foundation cultivator's touch makes a child strong.",
    "Bless her, {title}. Please. A golden core's blessing… I'll tell her when she's grown.",
    "Ancestor, my daughter is called nothing yet. Would you name her? I'll call her whatever you say.",
  ],
  "jx-kid": [
    "My kite's a dragon! A real one! …A paper one. Are you a real cultivator?",
    "Foundation! Can you fly my kite higher? Higher than the drum tower?",
    "Mother says not to talk to golden cores. But you smiled. That makes it all right.",
    "Is it true you can see the stars in the day, {title}? Can you see my kite?",
  ],
  "jx-balcony": [
    "I watch the lane from up here. Mostly porters. Now and then a cultivator. You're a small one.",
    "Up here, {title}! The rooms over the shop are let to cultivators at half rent. Foundation and above. Come and see.",
    "{title}, I've watched this lane twenty years. Nobody's ever looked up at me first. You did.",
    "You needn't climb the stair, {title}. I'll come down. I'll come down and stand in the street like everyone else.",
  ],
  "jx-matchmaker": [
    "Married? No? A cultivator below Foundation fetches very little in the marriage market, dear. Climb first. Then come back.",
    "Foundation Establishment! Oh, the matches I could make you. A merchant's son. Two merchants' sons.",
    "A golden core is worth a magistrate, dear. Three magistrates. I have a list.",
    "Nobody below Nascent Soul is worth your hand, {title}. I shall have to start a new list. A short one.",
  ],
  "jx-herbboy": [
    "Herbs for the alchemist! Out of the way — oh, a cultivator. Out of the way anyway, I'm late.",
    "Foundation! Hu Mei says Foundation cultivators can smell a spirit herb from a street away. Can you?",
    "Golden core! Hu Mei says I'm to give you the best ginseng if you ask. You didn't ask. Here.",
    "Ancestor, the whole basket's yours. Hu Mei will understand. Hu Mei will faint.",
  ],
  // Willow Creek's East Ward
  "ew-innkeep": [
    "The Willow Inn! Three storeys! The whole village laughed when we built it. Nobody's laughing now. Cultivators sleep on the second floor, mortals the first, and the third's for — well, nobody yet.",
    "A Foundation cultivator, from our own village! The second floor's yours, {title}. The best room. The one with a view of the creek.",
    "{title}, the third floor at last. We built it for a golden core and prayed one would come home. You came home.",
    "Ancestor… we'll rename the inn. We'll call it after you. You can't stop us. Zhou already ordered the board.",
  ],
  "ew-liu": [
    "The Liu clan has kept the village's rice ledger for eight generations. Cultivators below Foundation pay the ward tax like anyone.",
    "Foundation! Then the Liu clan bows. My great-grandfather was Foundation. We still talk about him at New Year.",
    "{title}. The Liu clan would be honoured to add your name to our hall's tablets. As a friend of the clan. We have a tablet ready.",
    "Ancestor, the Liu clan will move its ancestral hall a hand's width west, so that yours, when the village builds it, has the best light.",
  ],
  "ew-liuwife": [
    "You grew up here? I don't remember you. But then I don't remember anyone below Foundation, dear.",
    "Granny Hua's girl, at Foundation! We'll need to invite you to dinner now. I'll have to remember your name.",
    "{title}, I was unkind when you were small. Forgive a foolish woman who only looks at people when they've a golden core.",
    "I'll kneel, {title}. Don't stop me. I've been rude to you for twenty years and my knees owe you.",
  ],
  "ew-drum": [
    "I beat the drum when there's a fire, a flood or a festival. You're none of those, so I won't.",
    "Foundation! That's worth a festival roll. Bom-bom-bom!",
    "A golden core come home! I'll beat until the ward wakes up and comes out to look.",
    "Ancestor, I beat the drum so long my arms went dead. Then Old Liu's son took over. Then his son.",
  ],
  "ew-tailor": [
    "A sect robe? I can take it in. Or let it out, if you're planning on eating more. Cultivators always eat more.",
    "For a Foundation cultivator, I'll line it with silk. Foundation should rustle when it walks.",
    "{title}, I'll sew your realm into the hem in gold thread. Discreetly. Everybody will notice anyway.",
    "Ancestor, I've no thread fine enough. I'm going to Jinhe to buy some. Don't go anywhere.",
  ],
  "ew-baker": [
    "Sesame cakes, hot! One copper! Cultivators pay one copper too, before you ask.",
    "For a Foundation cultivator, two cakes for one copper. I'm told it's good luck.",
    "{title}, take the tray. Take it! A golden core ate my cakes. I'll double the price for everyone else.",
    "Ancestor, I baked a cake in your shape. It's not a good likeness. The village loves it.",
  ],
  "ew-scholar": [
    "Children, look: a cultivator. Qi Condensation, first of the five realms. Who can name the other four? …No one? Again.",
    "Children, a Foundation cultivator. What does Foundation mean? Ah Fu? Yes — a pillar sunk deep. Bow, all of you.",
    "Children, stand. A golden core. You will never in your lives stand nearer to heaven than this. Bow lower.",
    "Children… kneel. I have nothing to teach you today that this Ancestor has not already said by walking past.",
  ],
  "ew-pupil1": [
    "Teacher says cultivators are five realms! You're the first one. Is that the easy one?",
    "Foundation! I knew it. I told Lingling. She said you were too short.",
    "Golden core! Is it really gold? Can I see? …No? Can I see a little?",
    "I'm kneeling. Teacher said to. Can I get up? My knees are wet.",
  ],
  "ew-pupil2": [
    "Are you a fairy? Teacher says fairies aren't real. Cultivators are, though.",
    "You're Foundation! That's the second one! I can count to five realms!",
    "If you have a golden core, why don't you rattle when you walk?",
    "Teacher's crying. Is that because of you? He says it's the good kind.",
  ],
  "ew-gossip1": [
    "Ren, that's Granny Hua's girl. Still Qi Condensation, they say. The Liu boy was Foundation at her age.",
    "Ren — Foundation. Hua's girl is Foundation. I always said she'd come to something.",
    "Ren, a golden core. A golden core from our lane! I'm writing to my sister in the capital.",
    "Ren… get down. Get down, she's Nascent Soul. Yes, the one we used to give the burnt rice cakes.",
  ],
  "ew-gossip2": [
    "Song says she'll never amount to much. Song says that about everybody.",
    "Song's changed her mind. Song always changes her mind.",
    "Song wants you to bless her teapot. I told her not to ask. She's asking.",
    "I'm already down, Song. I got down before you. You owe me a copper.",
  ],
  "ew-farmer": [
    "Rain's late, cultivator. Don't suppose you can call it? No, not at Qi Condensation. Never mind.",
    "{title}, a Foundation cultivator walking past the field is worth a week of rain, my father said. I'll take it.",
    "Would you stand in the paddy a moment, {title}? Just stand. The seedlings lean toward a golden core.",
    "The rice is coming up in rings round where you walked, Ancestor. I'll leave those rings be.",
  ],
  "ew-carter": [
    "Carts through the ward, mind your toes! Cultivators too!",
    "I'll stop the cart for a Foundation cultivator. The ox won't, but I will.",
    "{title}, the ox stopped by itself. He's never stopped for anyone. Not even the magistrate.",
    "Ancestor, the ox is kneeling. I didn't know oxen could kneel.",
  ],
  "ew-bearer": [
    "Madam Liu's chair. Not for hire. Unless you're Foundation. Then it's for you.",
    "{title}, Madam Liu says the chair's yours whenever you like. She said it through her teeth.",
    "Madam Liu says the chair's too humble for a golden core. She's ordering a new one.",
    "Ancestor, the chair's yours. Madam Liu's walking. She says it's good for her.",
  ],
  "ew-lady": [
    "You're the sect girl. I'm the Liu girl. That's all either of us is, really.",
    "Foundation. Mother says I'm to be nice to you now. I was always nice to you. Mostly.",
    "{title}, will you teach me? Just a little? Mother says a golden core would never. But you're you.",
    "I don't know whether to kneel or hug you, {title}. Mother's watching. I'll do both.",
  ],
  "ew-toaster": [
    "A toast to the road! And to anyone fool enough to walk it. Even cultivators.",
    "A toast to Foundation! May it hold up everything you build on it!",
    "A toast to the golden core of Willow Creek! Everybody stand! Everybody!",
    "I can't lift the cup, {title}. My hand is shaking. Somebody lift it for me.",
  ],
  "ew-traveller": [
    "Come from Jinhe. They say this village has a cultivator. You? Hm.",
    "Foundation. They're saying in Jinhe the village has a Foundation cultivator. Here's to her.",
    "A golden core in a village this size. Jinhe will be jealous. Jinhe is always jealous.",
    "They told me in Jinhe, and I laughed. Forgive me, Ancestor. I'm not laughing.",
  ],
  "ew-watch": [
    "Ward-watch. Nothing happens here. Nothing happened before you came. Nothing happens now.",
    "{title}, the ward feels safer with a Foundation cultivator in it. I'll still walk my round.",
    "With a golden core in the ward I could sleep through my round. I won't. But I could.",
    "Ancestor. I'll guard the ward. And you'll guard… everything. That seems fair.",
  ],
  "ew-kid": [
    "My kite's stuck in the willow! Can you get it? With qi? …With a jump, then.",
    "Foundation can jump to the top of the willow! Teacher said! Go on!",
    "{title}, could you make my kite fly without any wind? Just once?",
    "The kite's still flying, {title}. There's no wind. It's been up there since you came.",
  ],
  "ew-weigher": [
    "Rice weighed honest, a catty's a catty. Cultivators' rice weighs the same, before you ask.",
    "For a Foundation cultivator I'll throw in an extra scoop. It's not cheating if it's a gift.",
    "{title}, the steelyard won't settle when you stand near it. I'll have to weigh after you've gone.",
    "The steelyard's broken, {title}. It snapped when you walked past. I'm keeping the pieces.",
  ],
  "ew-widow": [
    "Sit, child. My legs don't go any more. You're Hua's girl? Still small. Still small.",
    "Foundation, Hua says. I knew your grandfather. He was Foundation. He never came home.",
    "A golden core. He'd have been so proud. Your grandfather. I always thought you had his eyes.",
    "I can't kneel, Ancestor. I'll sit very straight instead. There. Tell Hua I sat very straight.",
  ],
  "ew-courier": [
    "Letters to Jinhe and back in three days! Cultivators who can fly can take their own.",
    "{title}, a letter for you from the sect. They wanted it to reach a Foundation cultivator quickly.",
    "Letters for a golden core, {title}. Seven. Three are proposals. One is from a sect I've never heard of.",
    "Ancestor, I've a sack of letters for you. I couldn't carry it. I dragged it.",
  ],
};

/** The folk inside the two inns, upstairs and down: who they are, and their line for each realm. */
const INN_FOLK: Record<string, { name: string; char: HumanId; lines: [string, string, string, string] }> = {
  "fr-cook": { name: "Cook Yang of the Nine Fragrances", char: "cook", lines: ["Noodles? Two coppers. The stair's for Foundation and above, miss — sorry. House rule.", "Upstairs, {title}! Mind the third step, it creaks for everyone below Core Formation. Joke. It creaks for everyone.", "I'll carry your noodles up myself, {title}. A golden core shouldn't have to wait for a cook.", "Ancestor, I've cooked for magistrates. My hands are shaking. That's never happened."] },
  "fr-porter": { name: "A Porter at Supper", char: "porter", lines: ["Can't go up either, eh? Ground floor's warmer anyway. Closer to the kitchen.", "You can go up, {title}. Don't mind us. We're used to the sound of feet over our heads.", "A golden core eating down here with us? Don't let the cook see. He'll faint.", "…I'll just finish my noodles on my knees, Ancestor. If that's all right."] },
  "fr-merchant": { name: "A Salt Merchant", char: "merchant", lines: ["Salt's up, rice is down, and cultivators below Foundation drink downstairs. Cheers.", "A toast, {title}! To Foundation, and a good view from the upper floor.", "{title}, would a golden core take a share in a salt barge? Silent. Very silent. Profitable.", "I'll pay for every table in the house tonight, Ancestor. Let it be said I once bought a Nascent Soul a drink."] },
  "fr-storyteller": { name: "Storyteller Ban", char: "storyteller", lines: ["Tonight: the tale of the City of Nine Tiers, where they weigh you on a steelyard! Ha! Imagine.", "A Foundation cultivator in the audience! I'll tell the tale of the Jade Lotus tonight, in your honour.", "Tonight, friends, a new tale: the golden core who eats downstairs. I've only got the first line.", "I'll tell no tale tonight, Ancestor. Tonight the tale is sitting at table four."] },
  "fr-lord": { name: "A Gold-Tier Lord Visiting Jinhe", char: "nobleM", lines: ["(He does not look at a Qi Condensation girl who should not be up here.)", "A Foundation cultivator. In Tianjie you'd be Silver. Here you get the window seat. How quaint.", "Core Formation! In my city you'd stand on the Jade Tier. Sit, Venerable. Wine?", "Senior Ancestor. In Tianjie you would stand above me. I'll stand now, if you don't mind. Old habits."] },
  "fr-lady": { name: "Lady Wan of the Golden Pavilion", char: "nobleF", lines: ["You're not supposed to be up here, dear.", "Foundation. Welcome to the upper floor. One sees so much more of the street from up here, and so much less of it.", "{title}, the Pavilion Master would want me to invite you. Consider yourself invited.", "I've leaned on this rail twenty years looking down at people, Ancestor. I find I want to sit up straight."] },
  "fr-sword": { name: "A Swordsman of the Sword Sea", char: "swordsea", lines: ["…", "Fellow Daoist. The wine's poor and the view is good. Like most of the jianghu.", "Senior. Your sword intent's quieter than mine. That's a compliment, from the Sword Sea.", "Senior Ancestor. I'll tell Master Ling I drank with you. He'll pretend not to be impressed."] },
  "fr-poet": { name: "Poet Shu Ye, Upstairs at Last", char: "scholar", lines: ["(He hides his poem from someone with no standing to read it.)", "Upstairs at last! A merchant bought me in. The view is exactly as good as I imagined, and the wine is worse.", "{title}, I've written a line for you: “The lane looked up, and saw her looking down, and was not ashamed.”", "I've stopped writing, Ancestor. Up here, with you in the room, it all sounds like the ground floor."] },
  "wi-maid": { name: "Serving Girl Lianlian", char: "villagerF", lines: ["Tea? The top floor's kept, you know. For our golden core. Whoever that is.", "Foundation! The second floor's yours, {title}. The top's still kept. You know who for.", "The top floor! It's open for you, {title}! Granny Hua's girl! I'll bring the good tea!", "I'm kneeling, Ancestor. I've kneeled to the magistrate. This is different. This is ours."] },
  "wi-farmer": { name: "Farmer Wu's Cousin", char: "farmer", lines: ["Hua's girl! Sit. Eat. You've grown. Not in the realm. Just grown.", "Foundation, eh? My cousin always said you'd come to something. I said so too, later.", "A golden core in my cousin's village. I'm going to tell everyone in the terraces it was my village.", "…I'll stand, Ancestor. I can't sit while you're standing. I don't know why."] },
  "wi-guest": { name: "A Guest from the Tea Terraces", char: "teapicker", lines: ["Is this the village with the cultivator? It's prettier than they said.", "{title}! Tea Master Lu sends his regards. He says a Foundation cultivator should drink third-steep.", "Tea Master Lu says a golden core should drink first-steep and never pay for it.", "Tea Master Lu says nothing about Nascent Souls. He's never had one in for tea."] },
  "wi-zhou": { name: "Village Head Zhou, Waiting Upstairs", char: "zhou", lines: ["…", "…", "You came up! The top floor! We kept it, Lin Yue. Every family swore. Sit, sit, the tablet's for you, the gilding's for you, the whole village is downstairs pretending not to listen.", "Ancestor — no. Lin Yue. I'll call you Lin Yue up here. Down there you're the Ancestor. Up here, you're ours."] },
};

/** What one of the new quarters' folk says to her realm (null for anyone else). */
export function quarterNpcScript(key: string, g: GameState): Step[] | null {
  const inn = INN_FOLK[key];
  if (inn) return [{ say: inn.char, name: inn.name, text: fillStanding(inn.lines[Math.min(3, g.realm)], g) }];
  const lines = QUARTER_LINES[key];
  if (!lines) return null;
  const f = [...JINHE_QUARTERS.folk, ...WILLOW_WARD.folk].find((x) => x.key === key);
  if (!f) return null;
  const text = fillStanding(lines[Math.min(3, g.realm)], g);
  const steps: Step[] = [];
  if (g.realm >= 3 && f.char !== "swordsman" && f.char !== "discipleF") steps.push({ anim: key, name: "kneel" });
  steps.push({ say: f.char, name: f.name, text });
  // the Willow Creek ward's folk knew her before she was anyone
  const dao = dominantDao(g);
  if (dao === "slaughter" && key.startsWith("ew-") && g.realm >= 2) steps.push({ say: f.char, name: f.name, text: "…They say you've killed a great many people since you left, {title}. We don't believe it here. We won't.".replace("{title}", honorific(g)) });
  return steps;
}

// ----------------------------------------------------------------------------- the folk of the Nine Tiers
/** What each tier's folk say about their own tier, whoever they are talking to. */
const TIER_TALK: string[][] = [
  [
    "Mud Tier. We carry what the upper tiers buy up the stair and what they throw away back down it.",
    "They weigh us every spring. The heavy ones go back to work. The light ones go to sleep.",
    "My tablet's clay. Clay doesn't climb. Clay holds the stair up.",
    "Don't look up the avenue too long. The gates have eyes.",
  ],
  [
    "Copper Tier. Everybody here broke through on a borrowed pill. Everybody here is paying for it.",
    "The Guild weighs our debts in years. I owe nine. I'm twenty-two.",
    "We forge the Silver Tier's blades and the Gold Tier's bells. We're not allowed to use either.",
    "Qi Condensation's the first realm. Here it's the first rung of a debt.",
  ],
  [
    "Silver Tier. Everything's for sale, and the price is written on your tablet.",
    "A Silver tablet opens the free school. A Copper one opens the back door of it, if you're lucky.",
    "They auction tablets on the fifteenth. The rich buy their sons a tier.",
    "The Inquisitor looks at every tablet twice. Some of us look at the floor.",
  ],
  [
    "Jade Tier. We marry by realm. A girl's dowry is her teacher's name.",
    "The academies here teach that the higher the realm, the truer the heart. I've met the higher realms.",
    "Madam Qiao has a red thread for every daughter on the tier. She ties them where they'll climb furthest.",
    "Jade breaks if you drop it. So do we.",
  ],
  [
    "Golden Tier. Under the Code, a lower realm may challenge a higher one. Once. Win, and you take his tier.",
    "The clans hire champions so nobody below them ever wins a challenge.",
    "Lei Ba hasn't lost a challenge in thirty years. He hasn't been challenged in ten.",
    "Gold weighs a great deal. That's the point of it.",
  ],
  [
    "Violet Tier. At the Tribunal, testimony is weighed by realm. A mortal's word weighs a feather.",
    "If a Core Formation witness says it rained and a hundred Foundation witnesses say it didn't, it rained.",
    "The Justiciar has never been overruled. Nobody above him has ever bothered.",
    "Every word is weighed. Mine are very light. I've stopped using them.",
  ],
  [
    "Cloud Tier. The elders here have lived four hundred years, five hundred. Nobody asks how.",
    "There's a market on this tier where years are sold by the spring.",
    "The Mist-Keeper won't buy them. He's the only elder here who looks his age.",
    "The gardens are beautiful. Nothing in them is the age it ought to be.",
  ],
  [
    "Star Tier. Every child born in the city has its chart drawn here. The chart says which tier it belongs to.",
    "The stars are never wrong. The registrars who read them sometimes are, but only downward.",
    "A mud-born chart says mud. A gold-born chart says gold. The stars are very consistent.",
    "We are counting toward a conjunction. Nobody below this tier is told which.",
  ],
  [
    "Thunder Tier. To stand here you must have severed everyone who could pull you back down.",
    "I had a mother once. I think. I severed her. It doesn't hurt. That's how you know it worked.",
    "The Captain of the Ninth Gate severed a husband and a daughter. She is the best of us.",
    "Nothing behind us. That's the oath. Nothing behind, and only the summit ahead.",
  ],
  [
    "Heaven's Step. Only the Sovereign stands higher. Only heaven.",
    "We do not speak of the Ascent to anyone below the Step. You are on the Step.",
    "The Sovereign says the city will rise whole into heaven. All nine tiers. Or most of them.",
    "Mind the edge. From here the Mud Tier looks like a ring of dirt round a cake.",
  ],
];

/** How a tier's folk greet someone whose tablet stands above, beside or (impossibly) below their own tier. */
function tierGreeting(k: number, g: GameState): string {
  const mine = realmTier(g);
  if (k === 0) return mine === 0 ? "Clay or copper? …Clay. Like us. Watch your back, sister." : mine >= 4 ? "Forgive us, {title}! We'll get off the avenue — we didn't see your tablet!" : "{title}. You've a tablet above the mud. You needn't speak to us.";
  if (mine > k + 2) return "(They step back off the avenue, eyes on the stones, until a tablet so far above theirs has passed.)";
  if (mine > k) return "Your tablet's above ours, {peer}. We'll make way.";
  return "Same tier as us, by your tablet. Welcome, {peer}.";
}

/** What one of the Nine Tiers' folk says to her (null for anyone else). */
export function tierFolkScript(key: string, g: GameState): Step[] | null {
  const m = /^tj-folk-(\d+)-(\d+)$/.exec(key);
  if (!m) return null;
  const k = Number(m[1]);
  const n = Number(m[2]);
  const f = TIER_FOLK[k]?.[n];
  if (!f) return null;
  const talk = TIER_TALK[k];
  const line = talk[Math.floor(g.playTime / 9 + g.kills + n) % talk.length];
  const steps: Step[] = [];
  const mine = realmTier(g);
  if (k <= 1 && mine >= k + 3 && ["porter", "refugeeF", "refugeeM", "villagerF", "bearer", "miner", "villagerM"].includes(f.char)) steps.push({ anim: key, name: "kneel" });
  steps.push({ say: f.char, name: f.name, text: fillStanding(tierGreeting(k, g), g) }, { say: f.char, name: f.name, text: line });
  return steps;
}

/** The realm her tablet would show, for the HUD and the journal. */
export function standingLabel(g: GameState): string {
  return `${honorific(g)} · ${TIER_SITES[realmTier(g)].hanzi} ${TIER_SITES[realmTier(g)].name}`;
}

/** The standing page of the journal: what the mortals and the cultivators call her, and the tier her tablet opens. */
export function standingJournal(g: GameState): { title: string; peer: string; realm: string; tier: string; tierHanzi: string } {
  const t = realmTier(g);
  return { title: honorific(g), peer: peerTitle(g), realm: `${REALMS[g.realm].hanzi} ${realmLabel(g.realm, g.stage)}`, tier: TIER_SITES[t].name, tierHanzi: TIER_SITES[t].hanzi };
}

/** Turned back at the foot of a house's stair: the upper floors are for cultivators of standing. */
export function floorRefusal(id: string, g: GameState): Step[] {
  const fragrance = id === "fragranceup";
  const need = fragrance ? "Foundation Establishment" : "Core Formation";
  return [
    { emote: "hero", icon: "?" },
    fragrance
      ? { say: "cook", name: "Cook Yang of the Nine Fragrances", text: fillStanding("Ah — not up there, {title}. The upper floor is for Foundation and above. House rule. I'm sorry. Have the noodles. The noodles don't know what realm you are.", g) }
      : { say: "villagerF", name: "Serving Girl Lianlian", text: fillStanding("The top floor's kept, {title}. For Willow Creek's own golden core. The whole village swore. …It's going to be you, isn't it? Then hurry up.", g) },
    { toast: `The floor above is for ${need} and beyond · your realm: ${realmLabel(g.realm, g.stage)}` },
  ];
}
