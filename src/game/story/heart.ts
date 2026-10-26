import { cultivationNeeded } from "../engine/realms";
import { gainCultivation, setFlag, stats, type GameState } from "../engine/state";
import { say, type Choice, type Step } from "./script";
import { giveAttire } from "./wardrobe";
import { originOf } from "./origins";

/**
 * The turning point of the main quest: what Lin Yue does when she finally
 * stands before Patriarch Xue, what she does with the Jade Lotus Heart once
 * it is hers to hold, and what that makes of her at the very end. Every
 * answer is a story flag, and each one leaves its mark on the land (see the
 * terrain patches in world/continent.ts) and on how the tale can end.
 *
 *   heart:home      carry it home to Elder Mo (the old road to heaven)
 *   heart:planted   root it in the valley's wounded earth (the valley blooms)
 *   heart:devoured  drink its light (the blood moon spreads; Mo must be faced)
 */

export const HEART_FATES = ["home", "planted", "devoured"] as const;
export type HeartFate = (typeof HEART_FATES)[number];

/** What she did with the Heart (a save from before she could choose carried it home). */
export function heartFate(f: Record<string, boolean>): HeartFate | null {
  const chosen = HEART_FATES.find((h) => f[`heart:${h}`]);
  if (chosen) return chosen;
  return f.patriarchDefeated ? "home" : null;
}

/** Drank the Heart, and has not (yet) let Elder Mo draw it out of her again. */
export const crimsonPath = (f: Record<string, boolean>) => !!f["heart:devoured"] && !f.purged;

export const ENDING_IDS = ["ascension", "rooted", "guardian", "mortal", "crimson"] as const;
export type EndingId = (typeof ENDING_IDS)[number];

export const ENDINGS: Record<EndingId, { title: string; hanzi: string; line: string }> = {
  ascension: { title: "Immortal Ascension", hanzi: "白日飞升", line: "Lin Yue climbed heaven's stair. Wander the jianghu as you please." },
  rooted: { title: "The Lotus Takes Root", hanzi: "莲生大地", line: "Lin Yue ascended, and the Heart she planted stayed behind to keep the land. Wander the jianghu as you please." },
  guardian: { title: "Guardian of the Jianghu", hanzi: "地仙守土", line: "Lin Yue turned her back on heaven to keep the jianghu. Wander it as its guardian." },
  mortal: { title: "The Road Home", hanzi: "归乡", line: "Lin Yue went home to Willow Creek and taught its children to read. Wander the jianghu as you please." },
  crimson: { title: "The Blood Moon Sovereign", hanzi: "血月临天", line: "Lin Yue took heaven by force. The moon over the jianghu is red, and it is hers." },
};

export const endingOf = (f: Record<string, boolean>): EndingId | null => ENDING_IDS.find((e) => f[`ending:${e}`]) ?? (f.ascended ? "ascension" : null);

const flag = (...names: string[]): Step => ({ mutate: (s) => names.reduce((a, n) => setFlag(a, n), s) });

/** Who can talk Xue Ming down: a Willow Creek girl, or anyone who has learned where he came from and what Ou made him. */
export const canRedeemXue = (f: Record<string, boolean>) => originOf(f) === "foundling" || (!!f.shenLore && !!f.ouMet);

// ----------------------------------------------------------------------------- before the altar
/** Patriarch Xue waits at his blood altar. Most answers end in a fight; one may not. */
export function xueConfrontation(g: GameState, key: string): Step[] {
  const f = g.flags;
  const origin = originOf(f);
  const options: Choice[] = [
    {
      label: "Offer him a way back",
      hint: "He was once a boy from Willow Creek",
      then: [
        say("heroine", "Smith Ou still keeps a place for your sword on his hill. Elder Mo still calls you brother. Give back the Heart and come home, Xue Ming."),
        { emote: key, icon: "..." },
        say("patriarch", "…Nobody has called me that in forty years. Too late, little lotus. Far too late."),
        flag("xueOffered"),
      ],
    },
    { label: "Draw your sword", hint: "There is nothing left to say", then: [{ anim: "hero", name: "salute", wait: true }, say("heroine", "Then let it be decided.")] },
  ];
  if (origin === "disciple")
    options.push({
      label: "Recite the founder's sutra at him",
      hint: "The sect's oldest words shake his demonic qi (he starts the fight weakened)",
      then: [
        { anim: "hero", name: "cast", wait: true },
        say("heroine", "“Heaven treats all things as straw dogs. The cultivator asks nothing of heaven, and endures.” You learned it on the same stair I did."),
        { flash: "#9ff5de" },
        { emote: key, icon: "anger" },
        say("patriarch", "Mo's words in a child's mouth! They still burn. Good. Let them burn."),
        flag("xueShaken"),
      ],
    });
  if (origin === "defector")
    options.push({
      label: "Strike the old wound in his art",
      hint: "You know where his Blood Moon art is torn (he starts the fight badly weakened). He will never forgive it",
      then: [
        say("patriarch", "My little runaway. I wondered when you'd come home. Kneel, and I'll pretend you never left."),
        say("heroine", "You taught me where every cut goes, Master. You never thought I'd learn the one you hide."),
        { anim: "hero", name: "attack", wait: true },
        { flash: "#ff2040" },
        { shake: 0.5 },
        say("patriarch", "…Ungrateful… CHILD!"),
        flag("xueWounded"),
      ],
    });
  if (canRedeemXue(f))
    options.push({
      label: origin === "foundling" ? "Tell him who raised you, and where" : "Speak of Willow Creek, and of the sword Ou made him",
      hint: "No fight. He may yet lay the Heart down himself",
      then: xueRedeemed(g, key),
    });
  return [
    { face: "hero", to: key },
    say("patriarch", origin === "defector" ? "So the runaway climbs back down. Mo sends you to fetch his flower? How very like him." : "Mo sends a child to fetch his flower? How very like him."),
    say("heroine", "Return the Jade Lotus Heart, Patriarch Xue."),
    say("patriarch", "That 'flower' lets heaven decide who may ascend. I merely… remove heaven's veto."),
    { choose: options, prompt: "Patriarch Xue waits, the blood moon behind him." },
    { shake: 0.6 },
    say("patriarch", "Come then, little lotus! Let the blood moon judge us!"),
  ];
}

/** Xue Ming comes home: no battle, and the Heart is laid down, not taken. */
function xueRedeemed(g: GameState, key: string): Step[] {
  const foundling = originOf(g.flags) === "foundling";
  return [
    foundling
      ? say("heroine", "I grew up in Granny Hua's house, by the willow at the creek bend. Old Yu still talks about the Xue boy who climbed the mill wheel. Smith Ou still keeps Dawnfrost oiled.")
      : say("heroine", "Archivist Shen still has your name in the register: a boy from Willow Creek with eyes full of sky. And Smith Ou never sold Dawnfrost. He's waiting for it to come home."),
    { emote: key, icon: "..." },
    { wait: 0.8 },
    say("patriarch", "…The willow at the creek bend. I carved my name in it. Mo carved his under mine, and I was furious."),
    say("patriarch", "Forty years I told myself heaven was a locked door and I was the only one with the courage to break it. And here is a child who simply… remembers me."),
    { anim: key, name: "kowtow", wait: true },
    say("narrator", "Patriarch Xue kneels before his own altar. The blood moon above the valley flickers, like a lamp in a draught."),
    { anim: key, name: "offer", wait: true },
    say("patriarch", "Take it. Take it before I change my mind. It never bloomed for me. Not once."),
    { flash: "#ffd0e4" },
    { mutate: (s) => setFlag(setFlag(setFlag(setFlag({ ...s, bossDefeated: true }, "patriarchDefeated"), "xueRedeemed"), "xueForgiven"), "dawnfrost") },
    say("patriarch", "And this. Dawnfrost. Give it back to Ou. Tell him I'm sorry I never drew it on anyone. …No. Tell him I'm glad."),
    say("patriarch", "I'll walk to his hill myself, if he'll have me. Forty years of sweeping swords might begin to pay for forty years of this."),
    { fade: "out" },
    { reshape: true },
    { fade: "in" },
    say("narrator", "When she looks up, he is gone down the valley road. The blood moon goes out. For the first time in forty years an ordinary dusk settles over the valley, and the lava in the rivers begins to cool."),
    { mutate: (s) => giveAttire(s, "xuerobe") },
    { toast: "Patriarch Xue lays down the Jade Lotus Heart · Received Dawnfrost and Xue Ming's old outer-sect robe" },
    ...heartFateChoice(),
    { end: true },
  ];
}

// ----------------------------------------------------------------------------- the Heart in her hands
/** The Jade Lotus Heart is hers to hold. What she does with it changes the jianghu for good. */
export function heartFateChoice(): Step[] {
  return [
    say("narrator", "The Jade Lotus Heart lies open in her hands, petals of pure jade light. It is warm, and it is listening."),
    {
      choose: [
        {
          label: "Carry it home to Elder Mo",
          hint: "The old road: the sect's shrine, and heaven's stair on the Tribulation Peak",
          then: [{ anim: "hero", name: "offer", wait: true }, say("heroine", "Home, then. The sect has kept you for three hundred years. It can keep you a little longer."), flag("heart:home"), { toast: "Bring the Jade Lotus Heart home to Elder Mo" }],
        },
        {
          label: "Plant it in the valley's wounded earth",
          hint: "The Heart will heal the land for ever, and never go back to the shrine. The valley will bloom",
          then: [
            { anim: "hero", name: "plantsword", wait: true },
            say("heroine", "The founder didn't leave you on a shrine to be guarded. She left you behind for the land. This is the land that needs you most."),
            { anim: "hero", name: "offer", wait: true },
            { flash: "#9ff5de" },
            { shake: 0.8 },
            flag("heart:planted"),
            { reshape: true },
            say("narrator", "The Heart sinks into the ash like a seed into rain. Roots of light race out under the valley; the lava in its rivers hisses and turns to clear water, and a red sky turns, slowly, to gold."),
            { mutate: (s) => giveAttire(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.5)).state, "lotusqueen") },
            { anim: "hero", name: "twirl", wait: true },
            { toast: "The Heart takes root · The valley blooms · Received the Lotus Sovereign Gown · Tell Elder Mo what you have done" },
          ],
        },
        {
          label: "Drink its light yourself",
          hint: "Power beyond any realm, the blood moon for a crown, and Elder Mo for an enemy",
          then: [
            say("heroine", "Xue was right about one thing. Heaven shouldn't get to decide. …I will."),
            { anim: "hero", name: "roar", wait: true },
            { flash: "#ff2040" },
            { shake: 1 },
            flag("heart:devoured"),
            { reshape: true },
            { mutate: (s) => { const t = giveAttire(gainCultivation(s, cultivationNeeded(s.realm, s.stage) * 3).state, "bloodmoon"); return { ...t, hp: stats(t).maxHp, qi: stats(t).maxQi }; } },
            say("narrator", "The Heart's light pours into her and comes out red. Far to the east, over the bamboo and the creek, the moon turns the colour of blood, and stays that way."),
            { toast: "You drank the Jade Lotus Heart · Cultivation surges · Received the Blood Moon Sovereign form · Elder Mo will know" },
          ],
        },
      ],
      prompt: "What will you do with the Jade Lotus Heart?",
    },
  ];
}

// ----------------------------------------------------------------------------- Elder Mo, when the Heart did not come home
/** Elder Mo, once the Heart is planted in the valley or devoured (null when neither has something new to say). */
export function elderHeartScript(g: GameState): Step[] | null {
  const f = g.flags;
  if (f["heart:planted"] && !f.heartReturned)
    return [
      { emote: "elder", icon: "!" },
      say("heroine", "Master. I didn't bring the Heart home. I planted it in the Crimson Demon Valley."),
      { anim: "elder", name: "think", wait: true },
      say("elder", "…I felt the valley go green from here. I thought I was dreaming. Three hundred years we kept that flower under glass."),
      say("elder", "The founder threw a peach stone over her shoulder on the way up the mountain, and an orchard grew. Perhaps she always meant the Heart to be thrown, too."),
      ...(f.xueRedeemed ? [say("heroine", "And Xue Ming is on his way to Smith Ou's hill. He wanted you to know: he remembers the willow."), { anim: "elder", name: "cry", wait: true } as Step, say("elder", "…The willow. Yes. Of course he does.")] : []),
      say("elder", "Heavenly Tribulation Peak does not need a flower to let you climb it. It needs you. Cross the sky bridge behind this hall when you are ready."),
      { mutate: (s) => setFlag({ ...s, stones: s.stones + 200, pills: { heal: Math.min(99, s.pills.heal + 3), qi: Math.min(99, s.pills.qi + 3) } }, "heartReturned") },
      { toast: "Received 200 spirit stones and 6 pills · The sky bridge behind the Hall of Clouds opens" },
    ];
  if (crimsonPath(f) && !f.moBroken)
    return [
      { face: "elder", to: "hero" },
      say("elder", "You come back with the Heart's light in your eyes and blood on the moon. I felt it from here, Lin Yue. Every disciple in this sect felt it."),
      say("heroine", "Heaven was never going to open its door for a girl like me, Master. So I made my own."),
      { anim: "elder", name: "cry", wait: true },
      say("elder", "I said that once. To Xue. On the stair below this hall, forty years ago. He said those words back to me, and I let him go down the mountain."),
      say("elder", "I will not make that mistake twice."),
      { anim: "elder", name: "cast", wait: true },
      { shake: 0.8 },
      { battle: "elderMo", key: "elder-mo" },
    ];
  return null;
}

/** After the duel in the Hall of Clouds. */
export function elderMoVictory(): Step[] {
  return [
    say("narrator", "Elder Mo is on his knees on the marble, his whisk in pieces. He does not try to rise."),
    say("elder", "So. The student surpasses the teacher. It was always going to be you, or him."),
    {
      choose: [
        {
          label: "Break his cultivation",
          hint: "No one will stand between you and heaven's throne again. The Hall of Clouds will never forget",
          then: [
            { anim: "hero", name: "attack", wait: true },
            { flash: "#ff2040" },
            { shake: 1 },
            flag("moBroken"),
            { reshape: true },
            say("narrator", "When the light fades, the white marble before the Hall of Clouds is scorched black in a ring around where he knelt, and the man kneeling in it is only an old mortal with white hair."),
            say("elder", "…So this is what Xue felt, on the other side. Go, then. Heaven is waiting for you. I find I no longer am."),
            { toast: "Elder Mo's cultivation is broken · The sky bridge to Heavenly Tribulation Peak answers only to you now" },
          ],
        },
        {
          label: "Lower your blade",
          hint: "He will draw the Heart's light back out of you. It will cost you dearly",
          then: [
            { anim: "hero", name: "plantsword", wait: true },
            say("heroine", "…I can't. Master, I can't. Take it out of me. Please."),
            say("elder", "It will hurt, child. It will take much of what you have built. Hold still."),
            { anim: "elder", name: "cast", wait: true },
            { flash: "#9ff5de" },
            { shake: 0.6 },
            { mutate: (s) => setFlag(setFlag({ ...s, cultivation: 0, hp: Math.max(1, Math.round(stats(s).maxHp * 0.2)), qi: 0 }, "purged"), "heartReturned") },
            { reshape: true },
            say("narrator", "Red light pours out of her like smoke, and gathers in the old man's hands into a small, tired flower of jade. Over the bamboo, the moon turns pale again."),
            { anim: "hero", name: "cry", wait: true },
            say("elder", "There. The Heart goes back on its shrine, and you go back on the stair. A stair is only a stair. You can still climb it."),
            { toast: "Elder Mo draws the Heart out of you · Your cultivation is spent · The blood moon fades · The sky bridge behind the Hall of Clouds opens" },
          ],
        },
      ],
      prompt: "Elder Mo waits for your answer. So does the whole sect.",
    },
  ];
}

// ----------------------------------------------------------------------------- the end of the tale
/** After the final tribulation: heaven's stair, and the last choice of all. */
export function endingSteps(g: GameState, epilogue: string[]): Step[] {
  const f = g.flags;
  if (crimsonPath(f))
    return [
      flag("ascended", "ending:crimson"),
      { anim: "hero", name: "levitate" },
      {
        narrate: [
          "Nine bolts fell upon Heavenly Tribulation Peak, and nine times Lin Yue drank them down.",
          "No stair of white light came. She did not wait for one. She rose on her own red light, through the storm, into the ninth heaven, and the gate of heaven broke like ice.",
          f.moBroken ? "Below, in the Hall of Clouds, an old mortal in a grey robe swept the scorched marble every morning, and never once looked up." : "Below, on the stair of the Hall of Clouds, an old man watched the sky turn red, and did not look away.",
          "The moon over the jianghu turned the colour of blood, and never turned back. In every village, mothers told their children of the girl who went up the mountain and came down as heaven.",
          ...epilogue,
          "So ends the tale of the Jade Lotus Ascension — and so begins the reign of the Blood Moon Sovereign.",
        ],
      },
      { fade: "in" },
      { toast: "THE END · The Blood Moon Sovereign · Thank you for playing" },
    ];
  const rooted = !!f["heart:planted"];
  const options: Choice[] = [
    {
      label: "Climb heaven's stair",
      hint: rooted ? "Ascend. The Heart stays rooted in the land" : "Ascend, as the founder did",
      then: [
        flag(rooted ? "ending:rooted" : "ending:ascension"),
        { mutate: (s) => giveAttire(s, "celestial") },
        { anim: "hero", name: "levitate" },
        {
          narrate: [
            "Lin Yue set her foot on the first step of light, and then the next.",
            "Below, the spirit veins sang. Rice grew green in Willow Creek; fox kits played in the bamboo; an old man on a lake caught a fish made of moonlight.",
            ...(rooted ? ["In the valley that had been crimson, a jade lotus the size of a pavilion opened its petals, and the land around it never withered again."] : []),
            ...epilogue,
            "So ends the tale of the Jade Lotus Ascension — and so begins the tale of an immortal.",
          ],
        },
      ],
    },
    {
      label: "Turn your back on heaven, and stay",
      hint: "Become an earth immortal: the jianghu's guardian, not heaven's",
      then: [
        flag("ending:guardian"),
        { mutate: (s) => giveAttire(s, "guardian") },
        { reshape: true },
        { anim: "hero", name: "plantsword", wait: true },
        {
          narrate: [
            "Lin Yue looked up the stair of light for a long time. Then she turned round and sat down on the dais, with her back to heaven and her face to the world.",
            "The stair waited a day and a night, and then it went away. Where it had touched the peak, a jade lotus pushed up through the marble.",
            "From then on, travellers on every road of the jianghu told of a woman in a green mantle who appeared when a bridge broke or a beast ran mad, and was gone before anyone could thank her.",
            ...epilogue,
            "So ends the tale of the Jade Lotus Ascension — and so begins the tale of the Guardian of the Jianghu.",
          ],
        },
      ],
    },
  ];
  if (originOf(f) === "foundling")
    options.push({
      label: "Go home to Willow Creek",
      hint: "Let the stair go, and go back to Granny Hua",
      then: [
        flag("ending:mortal"),
        { mutate: (s) => giveAttire(s, "teacher") },
        { reshape: true },
        { anim: "hero", name: "cry", wait: true },
        {
          narrate: [
            "“Granny will have the tea on,” Lin Yue said to no one, and walked down the mountain.",
            "She went home to Willow Creek and opened a school in the old village hall. Every child in the valley learned to read there, and some of them learned to fly a sword, and one or two of them learned to sit very still under a red moon and not be afraid.",
            "Granny Hua lived to a hundred and four, and said the tea was too bitter every single day of it.",
            ...epilogue,
            "So ends the tale of the Jade Lotus Ascension — and so begins the tale of the teacher of Willow Creek.",
          ],
        },
      ],
    });
  return [
    flag("ascended"),
    {
      narrate: ["Nine bolts fell upon Heavenly Tribulation Peak, and nine times Lin Yue stood.", "The storm parted. A stair of white light descended from the ninth heaven, and stopped at her feet."],
    },
    { fade: "in" },
    { choose: options, prompt: "Heaven's stair waits at the edge of the dais." },
    { fade: "in" },
    { toast: "THE END · Thank you for playing" },
  ];
}
