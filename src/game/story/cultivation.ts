import { REALMS } from "../engine/realms";
import { atBottleneck } from "../engine/realms";
import { CULT, DEMONS_LOUD, failedTribulations, foundationWound, heartDemons, insight, insightNeeded, shift, toxicity } from "../engine/cultivation";
import { DAOS, dominantDao, type DaoId } from "../engine/dao";
import type { GameState } from "../engine/state";
import { charDef, type HumanId } from "../art/characters";
import { hash2 } from "../pixel/noise";
import type { Choice, Step } from "./script";

/**
 * Cultivation as the jianghu sees it. The people who know her notice every
 * realm she reaches, and say so once; the masters give her a pointer when she
 * is stuck at a bottleneck; the common folk stare, bow, or back away; and
 * everyone has something to say when heaven's lightning has thrown her down,
 * when she reeks of pills, or when her heart demons show in her eyes.
 *
 * Seen asides are flags: `rsn:<key>:<realm>` for a new realm, `ptr:<key>:<realm>`
 * for a master's pointer, `csn:<key>:<what>:<n>` for her condition, and
 * `awe:<realm>:<key>` for a passer-by's wonder.
 */

type Who = { who: HumanId; name?: string };
/** One line for each realm from Foundation Establishment (1) to Immortal Ascension (5). */
type RealmLines = [string, string, string, string, string];

const CAST: Record<string, Who & { lines: RealmLines }> = {
  elder: {
    who: "elder",
    lines: [
      "Foundation Establishment. The pillar is sunk, Lin Yue. Now everything you build will stand on it — so build slowly. Most disciples crack theirs in the first year by hurrying.",
      "A golden core. I felt it from across the hall. Do you know how many disciples I have watched fail that tribulation? I stopped counting at forty. I am glad I did not have to count you.",
      "Nascent Soul… a second you, sitting in your dantian, with your face. When I reached it I wept for three days and did not know why. You may find you do the same.",
      "Spirit Severing. You have cut threads I am still tangled in. I am your teacher, and I do not know what to teach you now. Only this: the last bolts do not strike the body.",
      "…You came back down. From there. To talk to an old man. Sit, then. I will make tea, and you will tell me what heaven looks like.",
    ],
  },
  qing: {
    who: "qing",
    lines: [
      "Foundation already? I took three years! …I am not jealous. I am a senior sister. Senior sisters are above jealousy. Mostly.",
      "Your core is singing. Literally — my pill furnace hums when you walk past it. Please stop walking past it, it spoils the batch.",
      "The juniors whisper that you have a Nascent Soul now and they are not allowed to look you in the eye. I told them that is nonsense. …Is it nonsense?",
      "I cannot read your cultivation at all any more. It is like looking at the sky and trying to see how deep it goes.",
      "Junior Sister. Immortal. Same thing, to me. Do you still want your tea with two leaves, or do immortals not drink tea?",
    ],
  },
  hua: {
    who: "hua",
    lines: [
      "You've grown. Not taller, child — the other way. The kettle boils faster when you sit by it now, have you noticed?",
      "Ah Bao says you have a golden pill inside you now. I told him not to be silly. …You don't, do you? It sounds uncomfortable.",
      "The old women at the well were bowing when you came down the lane. To you! I told them you still owe me for three bowls of rice.",
      "You walk without your feet touching the floor sometimes. I don't mind. Mind the rug, though.",
      "My husband always said the immortals forget us. You didn't forget me. Sit down. You'll always have a seat here.",
    ],
  },
  zhou: {
    who: "zhou",
    lines: [
      "Foundation Establishment! The children are calling you Immortal Lin already. I told them to wait until you actually are one.",
      "A Core Formation cultivator in Willow Creek… The magistrate will want to tax it. I won't tell him.",
      "There are folk come from three counties to see the cultivator who walks our lanes. The inn has never been so full. Thank you, I think.",
      "When you stood in the square yesterday the rain stopped around you. Just around you. Old Liu fainted.",
      "We're carving your name on the gate. You can't stop us. We voted.",
    ],
  },
  wen: {
    who: "wen",
    lines: [
      "Hm. Your shadow sits heavier on the water. Foundation, is it? The fish noticed before I did.",
      "A core. Good. Now learn to hold it like a rod: too tight and it snaps, too loose and you lose the fish.",
      "Nascent Soul. I knew a man who reached that and spent the rest of his life staring at the lake. I am beginning to think he was right.",
      "You sit so still now the herons stand on your shoulders. Not a figure of speech. There is one on you now.",
      "Immortal, and still you come down to fish with an old man. Hold the rod. No — not like that. Like that.",
    ],
  },
  huli: {
    who: "huli",
    lines: [
      "Sister! Your qi smells like rain on stone now. Foundation suits you.",
      "A golden core — oh, I can see it glow when you laugh. Three hundred years and I still only have two tails' worth.",
      "Your Nascent Soul looked at me just now. Through your eyes. It is very polite. It has your nose.",
      "The kits will not play near you now. Not from fear — they think you are the moon come down.",
      "Immortal sister. Will you remember the fox in the bamboo when you are a star? …Good. I will hold you to it for a thousand years.",
    ],
  },
  xuan: {
    who: "abbot",
    name: "Abbot Xuan",
    lines: [
      "Amituofo. A foundation is laid. The monks here laid one too, forty years ago, and are still sweeping the dust off it.",
      "A golden core, and you came to a cold monastery to show it to an old monk. Sit. The tea is terrible. It is good for the core.",
      "Amituofo. The Nascent Soul is the self looking at itself. Be kind to it. It will be with you a long time.",
      "You have severed what most of us spend lives tying knots in. Ha! Do not sever your friends, little sister. Those threads are not the bad ones.",
      "Amituofo. The bell rang by itself when you came up the stair. The novices are very excited. So am I.",
    ],
  },
  yun: {
    who: "hermit",
    name: "Master Yun",
    lines: [
      "The cloud has a floor now. Good. Clouds with floors can carry rain.",
      "A core like a small sun. Careful it does not dry you up, little cloud.",
      "Two of you now, I see. The other one is quieter. Listen to her sometimes.",
      "You drift higher than my isles. Come down and visit. Clouds should visit.",
      "Ah. Sky. Welcome home.",
    ],
  },
  lingfeng: {
    who: "lingfeng",
    lines: [
      "Foundation. Your sword stopped shaking in your hand. You did not notice. I did.",
      "Core Formation, and your sword intent has a shape now. It is narrower than I expected. Good.",
      "Ten thousand swords in my sea, and they all turned their points toward you when you came up the stair. Not to threaten. To salute.",
      "You could cut the mountain I stand on. You will not. That is why you are allowed to.",
      "An immortal who still carries a sword. I will tell the Sword Sea. They will argue about it for a century.",
    ],
  },
  baizhi: {
    who: "baizhi",
    lines: [
      "Foundation Establishment. Your pulse is slower and stronger. Keep it that way: do not live on pills.",
      "A golden core. Every pill you swallow from now on stays with it longer. I mean that as a warning, not a compliment.",
      "A Nascent Soul gets ill too, you know. In ways no herb can reach. Come to me if it does.",
      "Your blood would cure a village now. Please do not let anyone know I said that.",
      "Immortal. And still you look tired. Here — not a pill. Just tea.",
    ],
  },
  yanhuo: {
    who: "yanhuo",
    lines: [
      "Foundation! You burn steadier. A bonfire, not a match.",
      "A core like a coal in a furnace. The phoenixes on the banners turned to look at you. Do that again.",
      "Your Nascent Soul flickers like a flame behind your eyes. The disciples call it the second fire.",
      "Spirit Severing. Hm. Even our founder only got this far before she flew into the sun.",
      "Immortal. Fly past the mesa sometime, so the disciples can say they saw you.",
    ],
  },
  ou: {
    who: "smith",
    name: "Smith Ou",
    lines: [
      "Foundation. You hold the hammer differently. Lighter. Like you know where it wants to go.",
      "A core. Your qi warms the forge from the doorway. I could save on charcoal if you stood there all day.",
      "The swords in the tomb rattled when you came up the path. Never done that for anyone before.",
      "You could forge with your bare hands now, I reckon. Don't. I need the work.",
      "Immortal, and you came back to an old smith's forge. Here. I kept your first broken blade. Thought you should have it.",
    ],
  },
  han: {
    who: "swordsman",
    name: "Xiao Han",
    lines: [
      "Foundation, eh? Good. Now our spars won't be so embarrassing for me.",
      "A core. …Fine. I concede the next spar in advance. Saves time.",
      "Nascent Soul! I can feel your intent from here, and I'm in the hot spring. Stop it, it's ticklish.",
      "I used to think I'd be the one to reach Spirit Severing first. Well. Someone has to carry your wine.",
      "Immortal. Ha! Then the next round's on heaven.",
    ],
  },
  kong: {
    who: "monk",
    name: "Monk Kong",
    lines: [
      "The temple dust settles when you come in now. Even the dust can tell your foundation is set.",
      "A core. Sweep with me a while. Cores grow proud if they are not given small work.",
      "Nascent Soul. There is a sutra about this. I have forgotten it. Sit, and we will forget it together.",
      "Even the stone forest leans toward you. Be gentle with it; it is very old.",
      "Immortal. The temple has no roof, so heaven can always see in. Now heaven sweeps with me.",
    ],
  },
};

const realmFlag = (key: string, realm: number) => `rsn:${key}:${realm}`;

/** What someone who knows her says the first time they see her at a new realm (null otherwise). */
/**
 * Elder Mo as the tale has left him. While the blood moon she drank stands
 * between them he has no praise for her realm (he has a duel for her); once
 * she has broken his cultivation he is a mortal and can no longer feel hers;
 * and if she turned back from heaven's stair, he does not thank her for
 * coming down from a heaven she never entered.
 */
const elderEstranged = (f: Record<string, boolean>) => !!f["heart:devoured"] && !f.purged && !f.moBroken;
const BROKEN_ELDER: RealmLines = [
  "I cannot feel your foundation any more, girl. I cannot feel anything. The juniors tell me it is deep. I believe them.",
  "They say you carry a core of gold now. I used to see such things from across a hall. Now I see an old broom, and your shadow on the marble.",
  "A Nascent Soul. Once I would have wept to hear it. Now I sweep. The floor does not care what realm I was.",
  "Spirit Severing. Did you sever me too? …No. You did that with a sword. Go on. The bridge answers only to you.",
  "So you came down again, to look at what you left. Look, then. The marble is still black where I knelt.",
];
const TURNED_BACK = "You stood on heaven's first step and turned round. Forty years I waited for a disciple of mine to reach that stair, and you came back down it for us. Sit. I will make tea, and you will tell me why.";

function linesFor(key: string, g: GameState): string | null {
  const a = CAST[key];
  if (!a) return null;
  if (key !== "elder") return a.lines[g.realm - 1];
  const f = g.flags;
  if (elderEstranged(f)) return null;
  if (f.moBroken) return BROKEN_ELDER[g.realm - 1];
  if (g.realm === 5 && (f["ending:guardian"] || f["ending:mortal"])) return TURNED_BACK;
  return a.lines[g.realm - 1];
}

export function realmAside(key: string, g: GameState): Step[] | null {
  const a = CAST[key];
  if (!a || g.realm < 1 || g.flags[realmFlag(key, g.realm)]) return null;
  const text = linesFor(key, g);
  if (!text) return null;
  const r = REALMS[g.realm];
  return [
    { emote: key, icon: g.realm >= 3 ? "!" : "heart" },
    { say: a.who, ...(a.name && { name: a.name }), text },
    { mutate: (s) => ({ ...s, flags: { ...s.flags, [realmFlag(key, s.realm)]: true } }) },
    { toast: `${a.name ?? charDef(a.who).name} sees you at ${r.name} (${r.hanzi})` },
  ];
}

/**
 * The masters' pointers (指点). When she sits at a bottleneck without the
 * understanding to break it, those who have walked further give her one
 * thing to think about — once each, every realm — and it counts as insight.
 */
const POINTERS: Record<string, Who & { lines: [string, string, string, string] }> = {
  elder: {
    who: "elder",
    lines: [
      "",
      "You are pushing at the bottleneck like a door. It is not a door. It is a knot. Stop pushing and look at how it is tied.",
      "The core must crack for the soul to be born. You are afraid of the crack. So was I. Be afraid, and let it crack anyway.",
      "To sever, you must first know what you are tied to. Go and look at it: the people, the places. Then decide which threads are yours.",
    ],
  },
  xuan: {
    who: "abbot",
    name: "Abbot Xuan",
    lines: [
      "",
      "Amituofo. A full cup cannot take more tea. Empty a little of yourself before heaven pours.",
      "When you meditate, who is it that meditates? Sit with that until it makes you laugh.",
      "Severing is not cutting. It is letting go of the knife as well.",
    ],
  },
  yun: {
    who: "hermit",
    name: "Master Yun",
    lines: ["", "The cloud does not climb the mountain. It waits for the wind. Have you been waiting, or climbing?", "Rain falls, and becomes the river, and becomes the cloud. What of you must fall?", "Look down from my isle. Everything you care for is very small from here. Does it still matter? …Good. Then you are ready."],
  },
  kong: {
    who: "monk",
    name: "Monk Kong",
    lines: ["", "Sweep. No, really. Sweep. The bottleneck will still be there when you finish, and it will be smaller.", "The temple burned two hundred years ago. It is still a temple. What is a core, without its shell?", "The stone forest has stood ten thousand years by not wanting to be anything else. Want less."],
  },
  lingfeng: {
    who: "lingfeng",
    lines: ["", "Your sword is faster than your understanding. Slow it down until they walk together.", "A blade is forged by being broken and folded. Your core is the same. Fold it.", "The last cut is the one you do not make. Think on what you will not cut."],
  },
  baizhi: {
    who: "baizhi",
    lines: ["", "Your meridians are clogged with pill residue. Insight cannot flow through a blocked channel. Fast, and see.", "The soul is born like a child. You cannot pull it out. Breathe, and wait.", "Every poison has its cure. Every attachment, its release. Which one are you holding onto?"],
  },
  wen: {
    who: "wen",
    lines: ["", "Fish do not bite when you stare at the float. Look at the sky a while.", "The lake does not try to be deep. It just keeps being still, and gets deep.", "I have been fishing for sixty years. I have caught every fish worth catching. I still come. Why? Think about it."],
  },
  almanac: {
    who: "almanac",
    lines: ["", "Every season has its day to break ground. You are trying to plant in winter. Wait for the thaw in yourself.", "The sundial's shadow does not hurry, and it is never late.", "Even heaven's calendar ends at the year's turning, and starts again. Let something end."],
  },
};

const pointerFlag = (key: string, realm: number) => `ptr:${key}:${realm}`;

/** A master's pointer, when she is stuck at a bottleneck for want of insight (null otherwise). */
export function pointerAside(key: string, g: GameState): Step[] | null {
  const p = POINTERS[key];
  // a broken or estranged Elder Mo has no pointer to give her
  if (key === "elder" && (g.flags.moBroken || elderEstranged(g.flags))) return null;
  if (!p || g.realm < 1 || g.realm > 4 || !atBottleneck(g) || insight(g) >= insightNeeded(g.realm) || g.flags[pointerFlag(key, g.realm)]) return null;
  return [
    { emote: key, icon: "..." },
    { say: p.who, ...(p.name && { name: p.name }), text: p.lines[g.realm - 1] },
    { anim: "hero", name: "bow", wait: true },
    { mutate: (s) => shift({ ...s, flags: { ...s.flags, [pointerFlag(key, s.realm)]: true } }, CULT.insight, 1) },
    { toast: `A master's pointer · Insight ${Math.min(insight(g) + 1, insightNeeded(g.realm))}/${insightNeeded(g.realm)}` },
  ];
}

/**
 * Her condition, as the people who care for her notice it: the cracks a
 * failed tribulation left, the reek of too many pills, the demons in her
 * eyes. Those who can help, help: the monks and the fox quiet her demons,
 * the herbalists draw out the poison.
 */
const CALMERS: Record<string, Who & { line: string; by: number }> = {
  xuan: { who: "abbot", name: "Abbot Xuan", line: "Amituofo. There are shadows sitting on your shoulders, little sister. Sit with me and we will name them one by one. Named demons are only memories.", by: 30 },
  kong: { who: "monk", name: "Monk Kong", line: "You are carrying something heavy. Put it down here, by the broom. The temple has held worse. I will not tell anyone what it was.", by: 25 },
  huli: { who: "huli", line: "Sister, your eyes are red at the edges. Come. Foxes know how to chase off things that whisper at night. Lie in the grass and let me sing.", by: 20 },
  hua: { who: "hua", line: "You're not sleeping, child, I can see it. Here. Ginger soup, and you'll lie down on the bench and I won't hear a word about it.", by: 15 },
  ming: { who: "lampkeeper", name: "Sister Ming", line: "Light a lamp with me. One for each thing that haunts you. …There. Seven lamps, seven fewer shadows.", by: 20 },
};

const CLEANSERS: Record<string, Who & { line: string; by: number }> = {
  baizhi: { who: "baizhi", line: "You reek of pill residue. Sit still. This needle goes here, and this one — there. Breathe out. Out. That black sweat is your poison leaving.", by: 50 },
  linger: { who: "herbalist", name: "Ling'er", line: "Senior Sister Bai Zhi showed me how to do this! Hold out your wrist. …Ooh, that's a lot of pills. Stop eating them like sweets!", by: 30 },
  qing: { who: "qing", line: "Junior Sister! Your qi is cloudy with dan poison. Drink this. Don't ask what's in it. And no more pills for a while, you hear me?", by: 25 },
};

const WORRIERS: Record<string, Who & { fail: string; tox: string; demon: string }> = {
  elder: {
    who: "elder",
    fail: "I saw the lightning, and I saw you fall. Your foundation is cracked. Do not try again until it has mended — heaven does not fail a cracked vessel twice; it breaks it.",
    tox: "You smell of the alchemy hall. How many pills, Lin Yue? A pill is a loan against your own body. The interest is paid in deviation.",
    demon: "Your eyes. I have seen that look in Xue, before the Blood Moon. Go and see Abbot Xuan in Frostveil. Go now.",
  },
  qing: {
    who: "qing",
    fail: "You — you fell! The whole sect saw the lightning throw you down. Sit. Drink this. Do not argue, I outrank you in the alchemy hall.",
    tox: "",
    demon: "You flinched when I touched your shoulder. You never flinch. What did you see in there?",
  },
  hua: {
    who: "hua",
    fail: "They said the lightning came down on you and you didn't get up for an hour. You'll stay here tonight. I've made up the bed.",
    tox: "You're green round the mouth, child. Whatever those pills are, they're not food.",
    demon: "",
  },
  zhou: {
    who: "zhou",
    fail: "We saw heaven's lightning from the square, and then it stopped all at once. Old Liu said that means the cultivator lost. I told him to hush. …Are you all right?",
    tox: "",
    demon: "The children say you were talking to someone in the lane last night. There was nobody there, Lin Yue.",
  },
  huli: {
    who: "huli",
    fail: "The bamboo shook all night after the storm. I thought you were dead, sister. Don't do that again.",
    tox: "You smell of the alchemist's bottles. Foxes don't like that smell. Neither does your qi, I think.",
    demon: "",
  },
  han: {
    who: "swordsman",
    fail: "Heard heaven knocked you flat. Happens. It knocked me flat twice before I gave up trying. Don't give up, though. One of us should make it.",
    tox: "You've got the pill-shakes. I had those once. Lay off them a while or your sword hand'll go.",
    demon: "Your sword intent's gone sour. It pricks wrong. Something's eating at you.",
  },
  wen: {
    who: "wen",
    fail: "The lake caught the light of your tribulation, then went dark. Sit by the water a while. It mends things.",
    tox: "",
    demon: "The fish won't come near you today. They know when someone's carrying a storm.",
  },
};

const condFlag = (key: string, what: string, n: number) => `csn:${key}:${what}:${n}`;

/** Help from those who can give it, or a worried word from those who can only notice (null when she is whole, or they have said their piece). */
export function conditionAside(key: string, g: GameState): Step[] | null {
  const demons = heartDemons(g);
  const tox = toxicity(g);
  const calm = CALMERS[key];
  if (calm && demons > 15 && !g.flags[condFlag(key, "calm", g.realm)]) {
    return [
      { emote: key, icon: "..." },
      { say: calm.who, ...(calm.name && { name: calm.name }), text: calm.line },
      { anim: "hero", name: key === "hua" ? "sit" : "pray", wait: true },
      { mutate: (s) => shift({ ...s, flags: { ...s.flags, [condFlag(key, "calm", s.realm)]: true } }, CULT.demon, -calm.by) },
      { toast: `Your heart demons quieten · 心魔 ${Math.max(0, demons - calm.by)}` },
    ];
  }
  const clean = CLEANSERS[key];
  if (clean && tox >= 30 && !g.flags[condFlag(key, "clean", g.realm)]) {
    return [
      { emote: key, icon: "!" },
      { say: clean.who, ...(clean.name && { name: clean.name }), text: clean.line },
      { mutate: (s) => shift({ ...s, flags: { ...s.flags, [condFlag(key, "clean", s.realm)]: true } }, CULT.tox, -clean.by) },
      { toast: `The pill poison is drawn out · 丹毒 ${Math.max(0, tox - clean.by)}` },
    ];
  }
  const w = WORRIERS[key];
  if (!w || (key === "elder" && elderEstranged(g.flags))) return null;
  const fails = failedTribulations(g);
  if (w.fail && foundationWound(g) > 0 && fails > 0 && !g.flags[condFlag(key, "fail", fails)])
    return [{ emote: key, icon: "!" }, { say: w.who, ...(w.name && { name: w.name }), text: w.fail }, { mutate: (s) => ({ ...s, flags: { ...s.flags, [condFlag(key, "fail", fails)]: true } }) }];
  if (w.demon && demons > DEMONS_LOUD && !g.flags[condFlag(key, "demon", g.realm)])
    return [{ emote: key, icon: "..." }, { say: w.who, ...(w.name && { name: w.name }), text: w.demon }, { mutate: (s) => ({ ...s, flags: { ...s.flags, [condFlag(key, "demon", s.realm)]: true } }) }];
  if (w.tox && tox >= 45 && !g.flags[condFlag(key, "tox", g.realm)])
    return [{ emote: key, icon: "?" }, { say: w.who, ...(w.name && { name: w.name }), text: w.tox }, { mutate: (s) => ({ ...s, flags: { ...s.flags, [condFlag(key, "tox", s.realm)]: true } }) }];
  return null;
}

/** What a passer-by makes of a cultivator of her realm (and of one whose demons show). */
const AWE: string[][] = [
  [],
  ["Is that — is that the sect girl? She walks like she's standing on something we can't see.", "Look, Ma, a real cultivator! …Why is she glowing a little?", "Foundation Establishment, they say. I don't know what that means, but my rheumatism eased when she walked past."],
  ["Bow, you fool, bow! That's a Core Formation cultivator — the magistrate himself would bow!", "My grandfather saw a golden-core immortal once. He said the birds went quiet. …The birds have gone quiet.", "Please, immortal, bless my shop! …No? Just walking? Of course. Of course."],
  ["They say she has a second soul inside her, a little one, made of light. Don't stare! It might stare back.", "The well water's gone sweet since the Nascent Soul cultivator drank from it. We're charging for it now.", "I fell to my knees and I don't even know why. My knees did it by themselves."],
  ["…", "Don't look straight at her. My cousin did and saw the stars for a week.", "She's Spirit Severing, they say. Halfway to heaven. What's she doing buying noodles?"],
  ["An immortal. A real immortal. In our street. Somebody fetch a painter!", "The temple bells rang by themselves when she came through the gate.", "My daughter says the immortal smiled at her. She will not stop talking about it. I don't blame her."],
];
const DREAD = ["Mother says not to look at the cultivator with the red eyes.", "She smells of blood. Not on her clothes. In the air round her.", "Stay back. Something follows that one. Something we can't see."];
const FALLEN = ["Was it you heaven struck down? We saw it from the fields. Forgive me — I am glad you're walking.", "Heaven threw her down, they say. I'd have stayed down. She's up again. That's something.", "I lit incense for you when the lightning stopped. Silly, maybe."];

/**
 * A word from a passer-by about the cultivator before them: wonder at her
 * realm, fear of her demons, or relief that heaven did not kill her. Only
 * some folk say anything, once for each realm (or failure). `name` is who
 * they are (a noodle seller who wears a cook's look is not Cook Pang).
 */
export function aweAside(key: string, speaker: HumanId, g: GameState, name?: string): Step[] | null {
  if (CAST[key] || CALMERS[key] || CLEANSERS[key] || WORRIERS[key]) return null;
  const h = (salt: number) => hash2(key.length * 31 + key.charCodeAt(0), key.charCodeAt(key.length - 1) + salt, 7);
  if (heartDemons(g) > 60 && !g.flags[`awe:dread:${g.realm}:${key}`] && h(g.realm) < 0.45)
    return [{ emote: key, icon: "!" }, { say: speaker, name, text: DREAD[Math.floor(h(9) * DREAD.length)] }, { mutate: (s) => ({ ...s, flags: { ...s.flags, [`awe:dread:${s.realm}:${key}`]: true } }) }];
  const fails = failedTribulations(g);
  if (fails > 0 && foundationWound(g) > 0 && !g.flags[`awe:fall:${fails}:${key}`] && h(fails + 20) < 0.4)
    return [{ emote: key, icon: "..." }, { say: speaker, name, text: FALLEN[Math.floor(h(11) * FALLEN.length)] }, { mutate: (s) => ({ ...s, flags: { ...s.flags, [`awe:fall:${fails}:${key}`]: true } }) }];
  if (g.realm < 1 || g.flags[`awe:${g.realm}:${key}`] || h(g.realm + 40) > 0.4) return null;
  const lines = AWE[g.realm].filter((l) => l !== "…");
  return [
    { emote: key, icon: "!" },
    { anim: key, name: "bow" },
    { say: speaker, name, text: lines[Math.floor(h(13) * lines.length)] },
    { mutate: (s) => ({ ...s, flags: { ...s.flags, [`awe:${s.realm}:${key}`]: true } }) },
  ];
}

/** Whether someone has something to say about her cultivation (for the marker over their head). */
export const cultivationHasNews = (key: string, g: GameState) => !!(realmAside(key, g) ?? pointerAside(key, g) ?? conditionAside(key, g));

/**
 * The heart demon trial (心魔劫) that comes before every tribulation from
 * Foundation Establishment on: what she fears most speaks to her in her own
 * voice. Answering it the way her Dao would starves it; answering against
 * her heart feeds it, and heaven's lightning finds every demon that is fed.
 */
const VISIONS: [string, string][] = [
  ["", ""],
  ["You? A foundling the sect took in out of pity. Every elder knows it. A core is for real disciples.", "Her own face looks back at her out of the dark, sneering."],
  ["Mo will die, you know. Before you are strong enough to save him. You will stand at his grave with your Nascent Soul and it will be worth nothing.", "Elder Mo's voice, out of her own mouth, very tired."],
  ["Willow Creek burned once. It will burn again. And you will be on a mountain somewhere, severing yourself from caring.", "The smell of smoke, and children crying, and her own voice laughing."],
  ["Heaven is empty. You will climb the stair and find no one there. Only you, forever, alone.", "A great quiet, and in it her own voice, very small."],
];

const ANSWERS: { dao: DaoId; label: string; hint: string; text: string }[] = [
  { dao: "sword", label: "Cut it down", hint: "The Sword's answer", text: "Lin Yue draws, and cuts the voice in half. It does not scream. It simply stops." },
  { dao: "mercy", label: "Forgive it", hint: "Compassion's answer", text: "“You are afraid too,” she tells it. “I forgive you.” The voice weeps, and goes quiet." },
  { dao: "balance", label: "Let it pass", hint: "Heaven's Balance answers", text: "She does not answer. She breathes. The voice speaks on, and on, and the breath goes in and out, and the voice is only wind." },
  { dao: "slaughter", label: "Devour it", hint: "Slaughter's answer", text: "She opens her mouth and swallows it whole. It tastes of iron. Something in her grows." },
];

/** The trial's steps; they end by calling heaven's lightning down (a `tribulation` step). */
export function heartDemonTrial(g: GameState, at: [number, number]): Step[] {
  const realm = Math.min(4, Math.max(1, g.realm));
  const [text, scene] = VISIONS[realm];
  const own = dominantDao(g);
  const choose: Choice[] = ANSWERS.map((a) => {
    // with no Dao yet, any answer but devouring it holds; with one, only her own Dao's answer starves the demon
    const holds = own ? a.dao === own : a.dao !== "slaughter";
    return {
      label: a.label,
      hint: a.hint + (own === a.dao ? " · your Dao" : ""),
      then: [
        { say: "narrator", text: a.text },
        holds
          ? { mutate: (s: GameState) => shift({ ...s, flags: { ...s.flags, [`demonTrial:${s.realm}`]: true } }, CULT.demon, -Math.max(15, heartDemons(s))) }
          : { mutate: (s: GameState) => shift(s, CULT.demon, 20) },
        { toast: holds ? "The heart demon is starved · Heaven's lightning will find less to strike" : `The heart demon feeds · 心魔 +20${own ? ` · ${DAOS[own].name} would have answered otherwise` : ""}` },
      ],
    };
  });
  return [
    { flash: "#3a0a2a" },
    { spawn: "heartdemon", char: "ghost", at: [at[0] + 1.6, at[1] + 0.4], dir: 10 },
    { emote: "hero", icon: "!" },
    { say: "narrator", text: `The heart demon trial · 心魔劫. Before heaven tests her body, her own heart tests her. ${scene}` },
    { say: "heroine", name: "Heart Demon", text },
    { choose, prompt: "The heart demon waits for her answer" },
    { despawn: "heartdemon" },
    { tribulation: true },
  ];
}

/** Whether heaven will set a heart demon trial before this tribulation. */
export const trialDue = (g: GameState) => g.realm >= 1 && !g.flags[`demonTrial:${g.realm}`];
