import { levelIndex, realmLabel, FINAL_REALM, atBottleneck } from "../engine/realms";
import { bump, gainCultivation, heal, learn, setFlag, stats, type GameState } from "../engine/state";
import { cultivationNeeded } from "../engine/realms";
import type { EnemyId } from "../engine/enemies";
import type { AreaId } from "../world/ids";
import { toWorld } from "../world/layout";
import { say, type Step } from "./script";

/**
 * The tale of the Jade Lotus Ascension: quest log, region gating, every
 * conversation and the cutscenes that tie the chapters together. All of it
 * is derived from story flags in the save, so progress survives reloads.
 */

export const FOXES_NEEDED = 3;
const LAKE_LEVEL = 2; // Qi Condensation · Late

export interface Quest {
  chapter: string;
  title: string;
  objective: string;
}

export function questLog(g: GameState): Quest {
  const f = g.flags;
  if (!f.metElder) return { chapter: "Prologue", title: "The Stolen Heart", objective: "Speak with Elder Mo before the Hall of Clouds." };
  if (!f.villageSaved) return { chapter: "Chapter I", title: "Trouble Below the Clouds", objective: "Go out through the sect gate and down the sky bridge to Willow Creek Village. Drive off the beast that haunts it." };
  if (!f.metZhou) return { chapter: "Chapter I", title: "Trouble Below the Clouds", objective: "Speak with Village Head Zhou in the village square." };
  if (!f.foxesCleared) return { chapter: "Chapter II", title: "Whispers in the Bamboo", objective: `Take the old highway west to the Whispering Bamboo Forest and calm its maddened fox spirits (${Math.min(FOXES_NEEDED, g.counters.foxes ?? 0)}/${FOXES_NEEDED}).` };
  if (!f.metHuli) return { chapter: "Chapter II", title: "Whispers in the Bamboo", objective: "Someone waits beneath the spirit tree at the heart of the grove." };
  if (!f.metWen)
    return levelIndex(g.realm, g.stage) < LAKE_LEVEL
      ? { chapter: "Chapter III", title: "The Moonlit Lake", objective: `Cultivate to ${realmLabel(0, LAKE_LEVEL)} (battles, herbs, shrine meditation), then seek the hermit of the Lotus Lake, east along the highway.` }
      : { chapter: "Chapter III", title: "The Moonlit Lake", objective: "Follow the highway east to the Moonlit Lotus Lake and seek the hermit who fishes there." };
  if (!f.serpentKingDefeated) return { chapter: "Chapter III", title: "The Moonlit Lake", objective: "Cross the stepping stones and subdue the Serpent King on the eastern isle." };
  if (!g.skills.includes("swords")) return { chapter: "Chapter III", title: "The Moonlit Lake", objective: "Return to Old Fisher Wen at the lake pavilion." };
  if (g.realm < 1) return { chapter: "Chapter IV", title: "Heaven's Gate", objective: "Break through to Foundation Establishment: fill your cultivation, meditate at a shrine and face the Heavenly Tribulation (B)." };
  if (!f.patriarchDefeated) return { chapter: "Chapter V", title: "The Blood Moon", objective: "Go west past the bamboo, through the red mist, and defeat Patriarch Xue at his blood altar in the Crimson Demon Valley." };
  if (!f.heartReturned) return { chapter: "Chapter V", title: "The Blood Moon", objective: "Bring the Jade Lotus Heart home to Elder Mo." };
  if (!f.ascended) return { chapter: "Epilogue", title: "Ascension", objective: `Reach the peak of Spirit Severing, cross the sky bridge behind the Hall of Clouds, and face the final tribulation at the dais of Heavenly Tribulation Peak. (${realmLabel(g.realm, g.stage)})` };
  return { chapter: "Fin", title: "Immortal", objective: "Lin Yue has ascended. Wander the jianghu as you please." };
}

/** Why a region is sealed on the world map, or null if it is open. */
export function lockReason(id: AreaId, g: GameState): string | null {
  const f = g.flags;
  switch (id) {
    case "sect":
      return null;
    case "village":
      return f.metElder ? null : "Speak with Elder Mo first.";
    case "bamboo":
      return f.metZhou ? null : "Village Head Zhou forbids the forest path.";
    case "lake":
      if (!f.metHuli) return "A spirit mist hides the lake.";
      return levelIndex(g.realm, g.stage) >= LAKE_LEVEL ? null : `The lake beasts would devour you. Reach ${realmLabel(0, LAKE_LEVEL)}.`;
    case "valley":
      if (!f.serpentKingDefeated) return "The way west is unknown.";
      return g.realm >= 1 ? null : "Demonic qi would tear you apart. Reach Foundation Establishment.";
    case "peak":
      return f.heartReturned ? null : "Only those the Heart chooses may climb.";
  }
}

export const areaUnlocked = (id: AreaId, g: GameState) => lockReason(id, g) === null;

// ----------------------------------------------------------------------------- opening
export function introScript(): Step[] {
  return [
    {
      narrate: [
        "Ten thousand li above the mortal world, the Azure Cloud Sect drifts upon a sea of clouds.",
        "For three hundred years its shrine guarded the Jade Lotus Heart — a flower of pure qi that blooms only for those who walk the Dao with an honest heart.",
        "Last night, beneath a blood-red moon, the Heart was stolen.",
        "Lin Yue, an inner disciple still at Qi Condensation, wakes to the toll of alarm bells…",
      ],
    },
    { fade: "in" },
    { spawn: "runner", char: "abao", at: toWorld("sect", 13.5, 15.5), dir: 1 },
    { walk: "runner", to: toWorld("sect", 15.5, 19.2) },
    { emote: "runner", icon: "!" },
    { face: "hero", to: "runner" },
    say("abao", "Senior Sister Lin! The Jade Lotus Heart — it's gone! Elder Mo is calling for you at the Hall of Clouds!"),
    { emote: "hero", icon: "..." },
    say("heroine", "Gone? No one has ever breached the shrine… Thank you, Ah Bao. I'll go at once."),
    say("abao", "Up the stairs to the north-east! And — be careful, Senior Sister. The elders look frightened."),
    { walk: "runner", to: toWorld("sect", 13.5, 15.5) },
    { despawn: "runner" },
    { toast: "Move with WASD / arrows · hold Shift to run · E or Space to talk · M for the map" },
  ];
}

// ----------------------------------------------------------------------------- NPCs
const after = (g: GameState) => g.flags;

export function hasNews(key: string, g: GameState): boolean {
  const f = after(g);
  switch (key) {
    case "elder":
      return !f.metElder || (f.patriarchDefeated && !f.heartReturned);
    case "qing":
      return !f.qingGift && !!f.metElder;
    case "zhou":
      return !!f.villageSaved && !f.metZhou;
    case "huli":
      return !f.metHuli;
    case "wen":
      return !f.metWen || (!!f.serpentKingDefeated && !g.skills.includes("swords"));
    case "hua":
      return !f.huaTea;
    case "elderPeak":
      return true;
    case "fang":
      return !f.fangTea;
    case "tang":
      return !f.tangGift;
    case "kong":
      return !f.kongSutra;
    case "yun":
      return !f.yunTeaching;
    case "han":
      return !!f.metElder && !f.hanDuel;
    case "wu":
      return !f.wuGift;
    case "shen":
      return !f.shenLore;
    case "lu":
      return !f.luGift;
    case "qiao":
      return !f.qiaoTale;
    case "ming":
      return !f.mingBlessing;
    default:
      return false;
  }
}

export function npcScript(key: string, g: GameState): Step[] {
  const f = g.flags;
  switch (key) {
    case "elder":
      return elderScript(g);
    case "peddler":
      return [
        say("peddler", pick(g, [
          "Ho, cultivator! Bai's the name, the highway's my shop. Pills for the road?",
          "I've walked this road from the red valley to the lotus lake. Never seen the foxes this wild.",
          "Cranes take off whenever someone hurries past. Walk softly and you can get close!",
          "They say the water from the Lotus Lake falls right off the edge of the world. I'd believe it.",
        ])),
        { shop: true },
      ];
    case "elderPeak":
      return [
        say("elder", "So. The Heart chose to bloom for you. Even my old master never saw that."),
        say("elder", `You stand at ${realmLabel(g.realm, g.stage)}. Reach the peak of Spirit Severing, then step onto the dais and call down the final tribulation.`),
        say("elder", "Nine bolts. Endure them, and you will walk where I cannot follow."),
      ];
    case "qing":
      if (!f.qingGift && f.metElder)
        return [
          { emote: "qing", icon: "heart" },
          say("qing", "Junior Sister! I heard Master is sending you down the mountain. Here — two Healing Pills, fresh from the furnace. Free, just this once!"),
          { mutate: (s) => setFlag({ ...s, pills: { ...s.pills, heal: Math.min(99, s.pills.heal + 2) } }, "qingGift") },
          { toast: "Received 2 Healing Pills" },
          say("qing", "When you need more, come back with spirit stones. Fifteen each — and don't tell the elders about the discount."),
          { shop: true },
        ];
      return [say("qing", "The Alchemy Hall's finest! What can I brew for you today?"), { shop: true }];
    case "abao":
      return [say("abao", pick(g, [
        f.metElder ? "Senior Sister, the sky bridge below the sect gate goes all the way down to the mortal lands! You can walk the whole jianghu from there." : "Elder Mo is waiting before the Hall of Clouds, up the stairs!",
        "If your qi runs dry, swallow a Qi Gathering Pill with Q. Healing pills are H!",
        "Feng says you can ride your sword with F. Lucky… I still fall off mine.",
        "Hold Shift and you can run! Elder Mo says a cultivator should never run in the plaza, though.",
        "When your cultivation bar is full at a realm's peak, meditate at a lotus shrine and press B. Then pray to heaven!",
      ]))];
    case "feng":
      return [say("discipleM", pick(g, ["Hah! Hyah! …Oh, Senior Sister Lin. One more thousand strikes before lunch.", "They say the Blood Moon Sect walked right past the guardian lions. How?", "Myriad Swords Return… our founder could do it. Imagine!"]))];
    case "lan":
      return [say("discipleF", pick(g, ["Keep your wrist loose and your heart still — that's what Elder Mo says.", "Bring the Heart back, Senior Sister. The spirit veins already feel thin.", "I'll guard the sect while you're gone! …Probably."]))];
    case "zhou":
      if (!f.villageSaved) return [{ emote: "zhou", icon: "!" }, say("zhou", "A cultivator! Please, the fox spirit by the bridge — it attacks anyone who crosses! Drive it off, I beg you!")];
      if (!f.metZhou)
        return [
          say("zhou", "You drove off the beast! Heaven has heard us at last. I am Zhou, head of Willow Creek."),
          say("zhou", "For seven nights fox spirits have come down from the Whispering Bamboo Forest. Their eyes burn red — like the moon on the night the sky turned to blood."),
          say("child", "I saw a man in red robes walking with them! He laughed, and the foxes howled…"),
          say("zhou", "Hush, Mei. …The forest lies west along the highway. I had it sealed with talismans, but you — you could find out what drives them mad."),
          say("heroine", "Red robes beneath a blood moon. The Blood Moon Sect… I'll go to the forest."),
          { mutate: (s) => setFlag({ ...s, stones: s.stones + 30 }, "metZhou") },
          { toast: "Received 30 spirit stones · The talisman seal on the bamboo forest lifts" },
        ];
      return [say("zhou", f.foxesCleared ? "The foxes are quiet again. The children play by the creek. Willow Creek owes you everything." : "Take the south road down to the old highway and follow it west. The bamboo starts where the creek bends. Be careful in there.")];
    case "hua":
      if (!f.huaTea)
        return [
          say("hua", "Come, come, child. You look pale. Drink — ginseng and snow lotus, steeped since dawn."),
          { mutate: (s) => setFlag({ ...s, hp: stats(s).maxHp, qi: stats(s).maxQi }, "huaTea") },
          { toast: "HP and QI fully restored" },
          say("hua", "Spirit herbs glow faintly where qi pools. Pick them when you see them — they feed a cultivator's foundation."),
        ];
      return [say("hua", pick(g, ["Shrines, herbs and honest fights — that's how cultivators grow. Patience, child.", "My husband was a sect disciple once. He never came home from the valley in the west.", "Have some more tea. No? Then off with you!"])), { mutate: (s) => ({ ...s, hp: stats(s).maxHp }) }];
    case "liu":
      return [say("farmer", pick(g, ["The rice drinks the creek, and the creek drinks the mountain's qi. If the mountain sickens, so do we.", "Foxes trampled half my paddy. Hope you gave them a good scare.", "Fine weather. Too fine. Feels like the calm before a storm."]))];
    case "mei":
      return [{ emote: "mei", icon: "note" }, say("child", pick(g, ["Are you a real immortal? Can you fly? Show me!", "Granny Hua's tea is SO bitter.", "When I grow up I'll join the sect in the clouds too!"]))];
    case "huli":
      if (!f.metHuli)
        return [
          say("huli", "Enough. …You fought my kin and did not kill them. A cultivator with mercy — how rare."),
          { emote: "hero", icon: "?" },
          say("heroine", "You're a fox spirit too. Why aren't you maddened like the others?"),
          say("huli", "Three hundred years of cultivation make for a stubborn mind. But the young ones… the Blood Moon Sect poured the Heart's stolen qi, twisted into poison, into this grove's spirit vein."),
          say("huli", "Patriarch Xue drinks the Heart slowly. Each night he grows stronger, and the land weaker."),
          say("huli", "The hermit of the Moonlit Lotus Lake knows the way into Xue's valley. Take my foxfire charm — the lake mist will part for you."),
          { anim: "huli", name: "cast", wait: true },
          { flash: "#ffb070" },
          { mutate: (s) => setFlag(s, "metHuli") },
          { toast: "Received the Foxfire Charm · The mist over the Moonlit Lotus Lake parts" },
          say("huli", `But grow stronger first, little sister. Below ${realmLabel(0, LAKE_LEVEL)}, the lake serpents will swallow you whole.`),
          { emote: "huli", icon: "heart" },
        ];
      return [say("huli", pick(g, ["The grove breathes easier. Thank you.", "Xue was a gentle boy once, they say. Power is a hungry thing.", "Visit the shrine by the stream. Its qi is sweet."]))];
    case "wen":
      if (!f.metWen)
        return [
          { anim: "wen", name: "idle" },
          say("wen", "Hm? The mist parted for you. Fox magic… so the old vixen trusts you."),
          say("wen", "I am only an old man who fishes for moonlight."),
          say("heroine", "Hu Li says you know the way to the Crimson Demon Valley."),
          say("wen", "The way is easy to find. Surviving it is not. The Serpent King on the eastern isle drank Xue's poisoned qi; now it attacks all who pass."),
          say("wen", "Cross the stepping stones and subdue it. Then I will know you are worth teaching."),
          { mutate: (s) => setFlag(s, "metWen") },
          { anim: "wen", name: "fish" },
        ];
      if (f.serpentKingDefeated && !g.skills.includes("swords"))
        return [
          say("wen", "The lake is quiet. You fight like your master did, long ago — all stubbornness and no sense."),
          say("wen", "Watch closely. One sword becomes ten thousand, and ten thousand return to one. Myriad Swords Return."),
          { anim: "wen", name: "cast", wait: true },
          { flash: "#c8f0ff" },
          { mutate: (s) => learn(s, "swords") },
          { toast: "Learned technique: Myriad Swords Return (3)" },
          say("wen", "Xue's valley lies beyond the bamboo, to the west. But as you are, its demonic qi will tear you apart."),
          say("wen", "Break through to Foundation Establishment. Meditate at a shrine when your qi is full and let heaven test you."),
          say("wen", "…And tell Mo his old teacher still fishes. He will understand."),
          { emote: "hero", icon: "!" },
          { anim: "wen", name: "fish" },
        ];
      return [say("wen", pick(g, ["The fish bite best when the mind is empty.", "Foundation first. Then the valley.", "Mo was my finest student. Don't tell him I said so."]))];
    case "fang":
      if (!f.fangTea)
        return [
          { anim: "fang", name: "bow" },
          say("teawoman", "Welcome, welcome! Sit, rest your feet. Everyone who walks the highway stops at Fang's sooner or later."),
          say("teawoman", "Cloud-mist tea, picked on the slopes below the sect. First cup is free — you look like you've walked a long way."),
          { anim: "hero", name: "drink", wait: true },
          { mutate: (s) => setFlag({ ...s, hp: stats(s).maxHp, qi: stats(s).maxQi }, "fangTea") },
          { toast: "HP and QI fully restored" },
          say("teawoman", "South of here the road splits for the stone forest. There's an old temple in there — a monk still sweeps it, they say, all alone."),
          { shop: true },
        ];
      return [say("teawoman", pick(g, ["Another cup? Spirit stones for pills, tea for friends.", "Peddler Bai owes me for three weeks of tea. Tell him I said so!", "The bandits up in the highland pines have been bolder lately. Mind the east road.", "Every cultivator who passes says they'll come back when they're immortal. You'll actually do it, won't you?"])), { shop: true }];
    case "tang":
      if (!f.tangGift)
        return [
          say("miller", "Hear that creak? That's the sweetest sound in the world. Forty years that wheel has turned and never once stopped."),
          say("miller", "…Well, it stopped the night the sky went red. The creek ran backwards for an hour. I've never been so frightened."),
          say("miller", "Here, take these. Granny Hua grinds them from the herbs I dry — they're no use to an old miller."),
          { mutate: (s) => setFlag({ ...s, pills: { ...s.pills, qi: Math.min(99, s.pills.qi + 2) } }, "tangGift") },
          { toast: "Received 2 Qi Gathering Pills" },
          { anim: "tang", name: "nod" },
        ];
      return [say("miller", pick(g, ["Flour for the village, water for the lake. The creek carries both.", "Cranes come to fish below the wheel at dawn. Lovely creatures.", "If you ever see the creek run backwards again — run the other way."]))];
    case "kong":
      if (!f.kongSutra)
        return [
          { anim: "kong", name: "idle" },
          { emote: "kong", icon: "..." },
          say("monk", "Amituofo. A visitor. The leaves fall faster than one old monk can sweep, but I keep sweeping."),
          say("heroine", "Why sweep a temple no one visits?"),
          say("monk", "The sweeping is not for the temple. Sit with me a moment, young cultivator, and breathe as the stone forest breathes."),
          { anim: "hero", name: "meditate" },
          { wait: 1.2 },
          { flash: "#9ff5de" },
          { mutate: (s) => setFlag(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.5)).state, "kongSutra") },
          { anim: "hero", name: "idle" },
          { toast: "The Still Water Sutra settles your qi · Cultivation rises" },
          say("monk", "Good. At night the dead walk these ruins — those who burned here never found their rest. Be gentle with them."),
          { anim: "kong", name: "sweep" },
        ];
      return [say("monk", pick(g, ["A swept floor, a still heart. Both get dusty again.", "The stone pillars here were once a mountain. Patience is a very long thing.", "If you meet the hopping dead, remember they were people once."]))];
    case "yun":
      if (!f.yunTeaching)
        return [
          { anim: "yun", name: "idle" },
          say("hermit", "Mm? Few walk the planks out here. Fewer still look down while they do it."),
          say("hermit", "I am Yun. Wen and I shared a teacher, long before Mo was born. He chose the lake; I chose the sky."),
          say("hermit", "Your qi is clear, but shallow, like a cloud's shadow on water. Let me show you how the clouds gather."),
          { anim: "yun", name: "cast", wait: true },
          { flash: "#c8f0ff" },
          { mutate: (s) => setFlag(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.6)).state, "yunTeaching") },
          { toast: "Master Yun's teaching deepens your cultivation" },
          say("hermit", "Now go. And if you see Wen, tell him the sky is still bigger than his lake."),
          { anim: "yun", name: "meditate" },
        ];
      return [say("hermit", pick(g, ["The clouds pass. So do worries.", "Even the Hall of Clouds looks small from here.", "Xue once sat where you stand. He asked how to own the sky. I had no answer for him."]))];
    case "han":
      if (!f.metElder) return [{ emote: "han", icon: "zzz" }, say("narrator", "A swordsman dozes by the spring, his blade across his knees.")];
      if (!f.hanDuel)
        return [
          { anim: "han", name: "idle" },
          { emote: "han", icon: "!" },
          say("swordsman", "An Azure Cloud disciple, this far south? Ha! I'm Xiao Han. I've crossed swords with every sect between here and the sea."),
          say("swordsman", "Except yours. Show me what the sect in the sky teaches — I promise not to hurt you. Much."),
          { battle: "swordsman", key: "han-duel" },
        ];
      return [say("swordsman", pick(g, ["The hot spring is the best place in the jianghu to lose a duel. Or win one.", "Next time I'll beat you. Probably.", "If you see bandits on the east road, give them my regards — with the flat of your blade."])), { anim: "han", name: "drink" }];
    case "wu":
      if (!f.wuGift)
        return [
          { say: "farmer", name: "Farmer Wu", text: "Careful of the paddies! …Oh, a cultivator. Pardon me, I thought you were a crow. The scarecrows do nothing these days." },
          { say: "farmer", name: "Farmer Wu", text: "My cousin Liu farms up in Willow Creek. Tell him the southern rice is taller. Here, for your trouble." },
          { mutate: (s) => setFlag({ ...s, stones: s.stones + 20 }, "wuGift") },
          { toast: "Received 20 spirit stones" },
        ];
      return [{ say: "farmer", name: "Farmer Wu", text: pick(g, ["The pagoda's lamps keep the night spirits off the fields. Or so Granny says.", "Rain from the highlands, sun from the sky. Good year, this one.", "Cranes in the paddy mean a fat harvest."]) }];
    case "shen":
      if (!f.shenLore)
        return [
          { anim: "shen", name: "idle" },
          say("archivist", "Shh — oh. Lin Yue. The whole sect is running about after those bells, and here I am, reading. Someone has to remember why we run."),
          say("archivist", "The Heart was never made, you know. It was left behind. When our founder Lian Qingxue ascended, the lotus in her dantian stayed on the shrine. Whoever holds it holds a little of her Dao."),
          say("archivist", "That is why Xue wants it. He was one of ours. A boy from Willow Creek with an outer-sect token and eyes full of sky."),
          { emote: "hero", icon: "!" },
          say("heroine", "Patriarch Xue… was an Azure Cloud disciple?"),
          say("archivist", "Read the register on the shelf by the door, if you doubt me. And take this: a page of the founder's own breathing method. I copied it for a student who never came back for it."),
          { anim: "hero", name: "read", wait: true },
          { flash: "#9ff5de" },
          { mutate: (s) => setFlag(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.4)).state, "shenLore") },
          { toast: "The founder's breathing method deepens your cultivation" },
          { anim: "shen", name: "read" },
        ];
      return [say("archivist", pick(g, [
        f.patriarchDefeated ? "So Xue Ming's line in the register is finished. I will write the ending myself: “He found the sky he was hungry for, and it was too heavy for him.”" : "History on the left wall, technique on the right. The scrolls nobody may read, I keep in my head.",
        "A sect that forgets its history is only some people living on a rock in the sky.",
        "Wen and Yun? I still have their old homework. Dreadful handwriting, the pair of them.",
        "Bow to the tablets before you leave. The founder liked good manners more than good swordwork.",
      ]))];
    case "lu":
      if (!f.luGift)
        return [
          { emote: "lu", icon: "!" },
          say("weaver", "Mind the threads! …Ah, you're the cultivator who saved our Mei. Mother Hua talks of nothing else."),
          say("weaver", "I'm Lü. I married Hua's son. He took our cloth down the river to the southern markets, and he's staying there until the foxes calm down."),
          say("weaver", "So I weave. This tapestry is the whole war of the Blood Moon, the way Mother tells it. Every time she remembers something new, I unpick a row and start again."),
          say("weaver", "Here. A woman alone keeps more healing pills than she can use, and you'll need them in the west."),
          { mutate: (s) => setFlag({ ...s, pills: { ...s.pills, heal: Math.min(99, s.pills.heal + 2) } }, "luGift") },
          { toast: "Received 2 Healing Pills" },
          { anim: "lu", name: "weave" },
        ];
      return [say("weaver", pick(g, [
        f.foxesCleared ? "A letter came! Now the bamboo's quiet, my husband is coming home from the south. I'm weaving him a new coat." : "Every night the foxes howl, I add another red thread. The tapestry is getting very red.",
        "The red in the tapestry is madder root. Mother says the real Blood Moon was redder.",
        "Mother still pours a cup of tea for her husband every morning. Don't tell her I told you.",
        "The founder in my tapestry has Mother's face. She doesn't know. Don't tell her that either.",
      ]))];
    case "qiao":
      if (!f.qiaoTale)
        return [
          { anim: "qiao", name: "clap" },
          say("storyteller", "Ah, a new listener! Sit, sit. Old Qiao tells the old tales for a cup of tea and a little quiet."),
          say("storyteller", "Long ago, before there was any sect in the clouds, a farm girl named Lian Qingxue climbed the tallest mountain to ask heaven why the rains had failed."),
          say("storyteller", "Heaven answered with lightning. She sat through it. Heaven sent more. She sat through that too. On the ninth bolt heaven gave in and sent the rain…"),
          say("storyteller", "…and the mountain was so ashamed of the sky's bad manners that it tore itself out of the earth and floated up to sit beside her. And that, little immortal, is why your sect floats!"),
          { anim: "hero", name: "laugh", wait: true },
          say("heroine", "That's not what the Annals say."),
          say("storyteller", "The Annals were written by people who weren't there either. Mine has better lightning."),
          { mutate: (s) => setFlag(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.25)).state, "qiaoTale") },
          { toast: "The old tale stirs your dao heart · Cultivation rises" },
          { anim: "qiao", name: "tell" },
        ];
      return pick(g, [
        [say("storyteller", "The tale of the seven farmers! When the Blood Moon came up the south road, seven farmers held it with hoes for one night."), say("storyteller", "The immortals came down at dawn. The farmers didn't see it. So the south built a pagoda, and lit a lamp for each of them.")],
        [say("storyteller", "The tale of the fox and the scholar! Three hundred years ago a fox spirit nursed a wounded scholar in the bamboo. He left to sit the imperial examinations and never came back."), say("storyteller", "She's waiting still, they say. Three tails and a very long memory."), { emote: "gu", icon: "..." }],
        [say("storyteller", "The tale of the two brothers! One of the lake, one of the sky. They quarrelled over whether water or cloud was the truer teacher."), say("storyteller", "That was eighty years ago. Neither has said sorry yet. Cultivators live far too long to make up quickly.")],
        f.patriarchDefeated
          ? [say("storyteller", "A new tale! A jade disciple walked into the red valley alone and walked out with the Heart of the founder."), say("storyteller", "I tell it with a great deal more lightning than I expect there was. Don't correct me."), { anim: "qiao", name: "laugh" }]
          : [say("storyteller", "The tale of the boy who stole moonlight. A boy from Willow Creek once carried the Heart's glow away in a jar, to light his mother's sickroom."), say("storyteller", "The sect threw him out. The jar went dark by morning. Nobody tells what happened to the boy. Not even me.")],
      ]);
    case "gu":
      return [say("scholar", pick(g, [
        "I'm on my way to sit the imperial examinations in the capital. Third attempt. The essay question is always about virtue, and I'm always too tired to have any.",
        "Qiao's tales are wrong in every detail and right in every way that matters.",
        "Do cultivators sit examinations? …With lightning? Oh. I'll stay with essays.",
        "Auntie Fang lets me pay for tea with poems. They have to rhyme, which is harder than it sounds.",
      ])), { anim: "gu", name: "read" }];
    case "dou":
      return [{ emote: "dou", icon: "note" }, say("millhand", pick(g, [
        "Master Tang says flour dust is mortal qi. If that's true, I sweep up an awful lot of qi.",
        "The night the creek ran backwards, the stones turned the wrong way all by themselves. I hid in a flour sack until morning!",
        "When I grow up I'm going to be a cultivator. Or a miller. A miller who can fly!",
        "Forty years the wheel's turned. Master Tang has a mark for every one on the shaft. I'm allowed to cut the next one.",
      ]))];
    case "ming":
      if (!f.mingBlessing)
        return [
          say("lampkeeper", "Seven lamps. I trim the wicks at dawn and fill the oil at dusk. Forty-one years now."),
          say("lampkeeper", "Little Qiu was one of my family. He was fourteen. He went with the others because Old Pan had the only lantern, and somebody had to carry it. Two hundred years, and we still say his name at New Year."),
          say("lampkeeper", "You're going west, aren't you? Towards the red valley. Kneel with me a moment."),
          { anim: "hero", name: "pray" },
          { wait: 1.4 },
          { flash: "#ffd070" },
          { mutate: (s) => setFlag(heal(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.3)).state, 9999, 9999), "mingBlessing") },
          { anim: "hero", name: "idle" },
          { toast: "The seven lamps bless you · Vitality restored, cultivation rises" },
          say("lampkeeper", "There. Now seven farmers walk the road with you."),
          { anim: "ming", name: "pray" },
        ];
      return [say("lampkeeper", pick(g, [
        f.patriarchDefeated ? "Last night all seven flames burned straight and still for the first time in my life. I think they know." : "The flames lean west on nights the moon turns red.",
        "Farmer Wu brings me rice every harvest. The fields remember who held the road.",
        "The scroll on the wall was painted by an immortal who came down too late. He stayed a year, painting it over and over.",
      ])), { anim: "ming", name: "pray" }];
    default:
      return [say("narrator", "…")];
  }
}

function elderScript(g: GameState): Step[] {
  const f = g.flags;
  if (!f.metElder)
    return [
      { face: "elder", to: "hero" },
      say("elder", "Lin Yue. You heard the bells."),
      say("heroine", "The shrine is empty, Master. Who would dare—"),
      say("elder", "The Blood Moon Sect. Their Patriarch, Xue, was once my sworn brother… before he chose the demonic path."),
      say("elder", "Without the Heart, the spirit veins of the land wither. Beasts go mad. Mortals suffer."),
      say("elder", "Word came at dawn from Willow Creek Village below: fox spirits attacking in the night. Start there. The trail of corrupted qi will lead you to Xue."),
      { anim: "elder", name: "cast", wait: true },
      { flash: "#9ff5de" },
      { mutate: (s) => setFlag(s, "metElder") },
      { toast: "Learned: Sword Riding (F) · Cloudmane's Whistle (R) · Willow Creek Village is open" },
      say("elder", "The art of Sword Riding. Press F to ride your blade. Below the sect gate a sky bridge leads down to the mortal lands, and with M your sword can carry you to any land you have opened."),
      say("elder", "And take this jade whistle. The jianghu is wide, and the roads are long. Blow it (R) and Cloudmane will come down out of the clouds to carry you — no beast on the road can catch her at a gallop."),
      say("elder", "Your cultivation is still shallow. Gather herbs, defeat corrupted beasts and meditate at lotus shrines. When your qi overflows at a realm's peak, face the Heavenly Tribulation."),
      { anim: "hero", name: "bow", wait: true },
      say("heroine", "I will bring the Heart home, Master."),
      say("elder", "Go. And Lin Yue — come back alive."),
    ];
  if (f.patriarchDefeated && !f.heartReturned)
    return [
      { emote: "elder", icon: "!" },
      say("heroine", "Master. The Jade Lotus Heart."),
      { anim: "hero", name: "cast", wait: true },
      { flash: "#ffd0e4" },
      say("elder", "…It blooms. In your hands, it blooms. Xue spent his life trying to force heaven's door, and you simply walked through it."),
      say("heroine", "Old Fisher Wen asked me to tell you: his old teacher still fishes."),
      { emote: "elder", icon: "..." },
      say("elder", "Master Wen… alive. Hah. Heaven has a sense of humour after all."),
      say("elder", "The Heart will restore the spirit veins. But it chose you, Lin Yue. Cross the sky bridge behind this hall to Heavenly Tribulation Peak. There, at the peak of Spirit Severing, you may ascend."),
      { mutate: (s) => setFlag({ ...s, stones: s.stones + 200, pills: { heal: Math.min(99, s.pills.heal + 3), qi: Math.min(99, s.pills.qi + 3) } }, "heartReturned") },
      { toast: "Received 200 spirit stones and 6 pills · The sky bridge behind the Hall of Clouds opens" },
    ];
  if (f.ascended) return [say("elder", "The sect's founder was the last to ascend, a thousand years ago. Now there are two names on the stele. I am proud of you.")];
  if (!f.villageSaved) return [say("elder", "Willow Creek lies below the clouds. Go out through the sect gate and down the sky bridge.")];
  if (f.patriarchDefeated) return [say("elder", "Heavenly Tribulation Peak awaits.")];
  if (g.realm >= 1 && f.serpentKingDefeated) return [say("elder", "Foundation Establishment already… Then go. Xue waits in his valley. Do not hesitate when the moment comes.")];
  return [say("elder", "Follow the corrupted qi. And do not neglect your cultivation — Xue's power is deep.")];
}

/** Deterministic variety: rotate lines with play time. */
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills) % lines.length];
}

// ----------------------------------------------------------------------------- arrivals & battles
export function arrivalScript(area: AreaId, g: GameState): Step[] | null {
  const f = g.flags;
  if (area === "village" && !f.villageArrived)
    return [
      { mutate: (s) => setFlag(s, "villageArrived") },
      { emote: "mei", icon: "!" },
      say("child", "Waaah! The fox is back! Somebody help!"),
      { emote: "hero", icon: "anger" },
      say("heroine", "A fox spirit, in broad daylight? Its eyes are burning red…"),
      { camera: "village-fox" },
      { wait: 0.8 },
      { camera: null },
      { toast: "Touch the fox spirit to fight it" },
    ];
  if (area === "bamboo" && !f.bambooArrived)
    return [{ mutate: (s) => setFlag(s, "bambooArrived") }, say("heroine", "The wind in the bamboo sounds like whispering… and growling. The foxes are close."), { toast: `Calm ${FOXES_NEEDED} fox spirits` }];
  if (area === "lake" && !f.lakeArrived)
    return [{ mutate: (s) => setFlag(s, "lakeArrived") }, say("heroine", "The mist parts before the foxfire charm… Lanterns on the water. Someone is fishing at the pavilion.")];
  if (area === "valley" && !f.valleyArrived)
    return [{ mutate: (s) => setFlag(s, "valleyArrived") }, { shake: 0.5 }, say("heroine", "The air tastes of iron. Blood moon, lava rivers… Xue's altar must be at the far end."), { toast: "Find Patriarch Xue" }];
  if (area === "peak" && !f.peakArrived)
    return [{ mutate: (s) => setFlag(s, "peakArrived") }, say("heroine", "Heavenly Tribulation Peak. The clouds churn as if they're watching me.")];
  return null;
}

/** Dialogue before special fights. */
export function preBattleScript(enemy: EnemyId, key: string): Step[] | null {
  if (enemy === "patriarch")
    return [
      { face: "hero", to: key },
      say("patriarch", "Mo sends a child to fetch his flower? How very like him."),
      say("heroine", "Return the Jade Lotus Heart, Patriarch Xue."),
      say("patriarch", "That 'flower' lets heaven decide who may ascend. I merely… remove heaven's veto."),
      { shake: 0.6 },
      say("patriarch", "Come then, little lotus! Let the blood moon judge us!"),
    ];
  if (enemy === "serpentKing") return [{ shake: 0.4 }, say("heroine", "The Serpent King… its scales are veined with Xue's crimson qi. Forgive me — I'll purge it!")];
  return null;
}

/** Story consequences of winning a fight. */
export function victoryScript(enemy: EnemyId, key: string, area: AreaId, g: GameState, won = true): Step[] {
  const steps: Step[] = [];
  if (enemy === "swordsman")
    return won
      ? [
          { mutate: (s) => setFlag({ ...s, stones: s.stones + 80 }, "hanDuel") },
          { anim: "han", name: "bow" },
          say("swordsman", "Hah… haha! Beaten fair and square. The sky sect still has teeth."),
          say("swordsman", "Take this — my winnings from the last three duels. I won't be needing them for a while."),
          { toast: "Received 80 spirit stones" },
        ]
      : [{ anim: "han", name: "nod" }, say("swordsman", "Not bad, not bad. Rest your feet in the spring and come back when you're stronger. I'll be here."), { toast: "Xiao Han lowers his blade. Talk to him again for a rematch." }];
  if (enemy === "bandit") {
    const n = (g.counters.bandits ?? 0) + 1;
    steps.push({ mutate: (s) => bump(s, "bandits") });
    if (n === 3) steps.push({ mutate: (s) => setFlag({ ...s, stones: s.stones + 40 }, "banditsRouted") }, say("heroine", "That's the last of their leaders. The east road should be safe for travellers now."), { toast: "The highland bandits scatter · Found 40 spirit stones in their camp" });
  }
  if (key === "village-fox") {
    steps.push({ mutate: (s) => setFlag(s, "villageSaved") }, { emote: "hero", icon: "..." }, say("heroine", "It fled into the west, toward the forest. Its eyes cleared just before it ran…"), { toast: "Speak with Village Head Zhou" });
  }
  if (enemy === "fox" && area === "bamboo" && !g.flags.foxesCleared) {
    const n = (g.counters.foxes ?? 0) + 1;
    steps.push({ mutate: (s) => bump(s, "foxes") });
    if (n >= FOXES_NEEDED)
      steps.push(
        { mutate: (s) => setFlag(s, "foxesCleared") },
        { shake: 0.3 },
        { flash: "#ffb070" },
        say("narrator", "A ring of foxfire flares at the heart of the grove, far to the north. Someone is calling."),
        { spawn: "huli", char: "huli", at: toWorld("bamboo", 16.5, 6.5), dir: 0 },
        { toast: "Go to the spirit tree at the heart of the grove" },
      );
    else steps.push({ toast: `Fox spirits calmed: ${n}/${FOXES_NEEDED}` });
  }
  if (enemy === "serpentKing") steps.push({ mutate: (s) => setFlag(s, "serpentKingDefeated") }, say("heroine", "The crimson veins fade from its scales… It's sinking back into the deep, at peace."), { toast: "Return to Old Fisher Wen" });
  if (enemy === "patriarch")
    steps.push(
      { mutate: (s) => setFlag({ ...s, bossDefeated: true }, "patriarchDefeated") },
      say("patriarch", "Impossible… heaven chose… a child of Foundation…"),
      say("patriarch", "Mo… you were right about the Dao… after all…"),
      { flash: "#ff2040" },
      { shake: 0.8 },
      say("narrator", "Patriarch Xue dissolves into crimson mist. Upon the altar, a lotus of pure jade light opens its petals."),
      { toast: "Obtained the Jade Lotus Heart · Return to Elder Mo" },
    );
  return steps;
}

// ----------------------------------------------------------------------------- the final altar
export function altarScript(g: GameState): Step[] {
  if (!g.flags.heartReturned) return [say("narrator", "The dais is cold and silent.")];
  if (g.flags.ascended) return [say("narrator", "Lightning-scarred marble hums faintly beneath your feet."), { meditate: true }];
  if (g.realm === FINAL_REALM - 1 && atBottleneck(g)) return [say("heroine", "My qi has reached its limit. It's time."), { meditate: true }];
  return [say("narrator", `The taiji dais hums. Meditating here gathers qi three times faster. (${realmLabel(g.realm, g.stage)} — the final tribulation requires the peak of Spirit Severing.)`), { meditate: true }];
}

export function endingScript(): Step[] {
  return [
    { mutate: (s) => setFlag(s, "ascended") },
    {
      narrate: [
        "Nine bolts fell upon Heavenly Tribulation Peak, and nine times Lin Yue stood.",
        "The storm parted. A stair of white light descended from the ninth heaven.",
        "Below, the spirit veins sang. Rice grew green in Willow Creek; fox kits played in the bamboo; an old man on a lake caught a fish made of moonlight.",
        "So ends the tale of the Jade Lotus Ascension — and so begins the tale of an immortal.",
      ],
    },
    { fade: "in" },
    { toast: "THE END · Thank you for playing" },
  ];
}
