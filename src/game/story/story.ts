import { levelIndex, realmLabel, FINAL_REALM, atBottleneck, REALMS } from "../engine/realms";
import { bump, gainCultivation, heal, learn, newGame, setFlag, stats, type GameState } from "../engine/state";
import { cultivationNeeded } from "../engine/realms";
import type { EnemyId } from "../engine/enemies";
import type { AreaId } from "../world/ids";
import { toWorld } from "../world/layout";
import type { HumanId } from "../art/characters";
import { say, type Step } from "./script";
import { giveAttire } from "./wardrobe";
import { sectHasNews, sectNpcScript, sectPreBattle, sectVictory, veinEpilogue } from "./sects";
import { crowdNpcScript } from "./crowd";
import { veinFate } from "../world/caves";
import { calendarAt, worldTime } from "../world/calendar";
import { almanacMasterScript, yearEpilogue, yearHasNews } from "./year";
import { originElderMeeting, originEpilogue, originIntro, originOf, originPrologue } from "./origins";
import { warEpilogue, warNpcScript, warPreBattle, warVictory } from "./war";
import { daoEpilogue } from "./dao";
import { roadEpilogue, roadNpcScript, roadPreBattle, roadVictory } from "./road";
import { hallsEpilogue, hallsNpcScript, hallsPreBattle, hallsVictory } from "./halls";
import { tiersEpilogue, tiersNpcScript, tiersPreBattle, tiersVictory } from "./tiers";
import { peoplesEpilogue, peoplesNpcScript, peoplesPreBattle, peoplesVictory } from "./peoples";
import { quarterNpcScript, tierFolkScript } from "./standing";
import { tideNpcScript } from "./tide";
import { townNpcScript } from "./town";
import { DAOS, dominantDao } from "../engine/dao";
import { canRedeemXue, crimsonPath, elderHeartScript, elderMoVictory, endingOf, ENDINGS, endingSteps, heartFate, heartFateChoice, xueConfrontation } from "./heart";

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
  if (!f.metElder) return { chapter: "Prologue", title: "The Stolen Heart", objective: originPrologue(g) ?? "Speak with Elder Mo before the Hall of Clouds." };
  // the defector's secret way can bring her to Xue before the lake (or even the bamboo) ever sees her
  if (f.patriarchDefeated) return afterXue(g);
  if (!f.villageSaved) return { chapter: "Chapter I", title: "Trouble Below the Clouds", objective: "Go out through the sect gate and down the sky bridge to Willow Creek Village. Drive off the beast that haunts it." };
  if (!f.metZhou) return { chapter: "Chapter I", title: "Trouble Below the Clouds", objective: "Speak with Village Head Zhou in the village square." };
  if (!f.foxesCleared) return { chapter: "Chapter II", title: "Whispers in the Bamboo", objective: `Take the old highway west to the Whispering Bamboo Forest and calm its maddened fox spirits (${Math.min(FOXES_NEEDED, g.counters.foxes ?? 0)}/${FOXES_NEEDED}).` };
  if (!f.metHuli) return { chapter: "Chapter II", title: "Whispers in the Bamboo", objective: "Someone waits beneath the spirit tree at the heart of the grove." };
  const secret = f.secretWay && !f.serpentKingDefeated ? " (Or, at Foundation Establishment, take your secret way west through the red mist to Xue's valley.)" : "";
  if (!f.metWen)
    return levelIndex(g.realm, g.stage) < LAKE_LEVEL
      ? { chapter: "Chapter III", title: "The Moonlit Lake", objective: `Cultivate to ${realmLabel(0, LAKE_LEVEL)} (battles, herbs, shrine meditation), then seek the hermit of the Lotus Lake, east along the highway.${secret}` }
      : { chapter: "Chapter III", title: "The Moonlit Lake", objective: `Follow the highway east to the Moonlit Lotus Lake and seek the hermit who fishes there.${secret}` };
  if (!f.serpentKingDefeated) return { chapter: "Chapter III", title: "The Moonlit Lake", objective: `Cross the stepping stones and subdue the Serpent King on the eastern isle.${secret}` };
  if (!g.skills.includes("swords")) return { chapter: "Chapter III", title: "The Moonlit Lake", objective: "Return to Old Fisher Wen at the lake pavilion." };
  if (g.realm < 1) return { chapter: "Chapter IV", title: "Heaven's Gate", objective: "Break through to Foundation Establishment: fill your cultivation, meditate at a shrine and face the Heavenly Tribulation (B)." };
  return { chapter: "Chapter V", title: "The Blood Moon", objective: `Go west past the bamboo, through the red mist, and ${canRedeemXue(f) ? "face" : "defeat"} Patriarch Xue at his blood altar in the Crimson Demon Valley.` };
}

/** The tale once Xue is dealt with: it runs on as the Heart's fate chose. */
function afterXue(g: GameState): Quest {
  const f = g.flags;
  const fate = heartFate(f);
  const climb = `Reach the peak of Spirit Severing, cross the sky bridge behind the Hall of Clouds, and face the final tribulation at the dais of Heavenly Tribulation Peak. (${realmLabel(g.realm, g.stage)})`;
  if (f.ascended) {
    const e = ENDINGS[endingOf(f) ?? "ascension"];
    return { chapter: "Fin", title: e.title, objective: e.line };
  }
  if (crimsonPath(f)) {
    if (!f.moBroken) return { chapter: "Chapter VI", title: "The Crimson Throne", objective: "Elder Mo felt the blood moon rise. Face him before the Hall of Clouds." };
    return { chapter: "Epilogue", title: "The Crimson Throne", objective: `Nothing stands between you and heaven now. ${climb}` };
  }
  if (!f.heartReturned)
    return fate === "planted"
      ? { chapter: "Chapter V", title: "Roots of Heaven", objective: "The Heart has taken root in the valley. Go home and tell Elder Mo what you have done." }
      : { chapter: "Chapter V", title: "The Blood Moon", objective: "Bring the Jade Lotus Heart home to Elder Mo." };
  return { chapter: "Epilogue", title: f.purged ? "The Second Climb" : "Ascension", objective: climb };
}

/**
 * The side errand most worth mentioning: favours the folk of the jianghu have
 * asked of her, in the order she is likely to pick them up. Null when nobody
 * is waiting on her.
 */
export function errand(g: GameState): string | null {
  const f = g.flags;
  if (f.peiMet && !f.huliLetter) return "Scholar Pei's letter: tell Hu Li, beneath the spirit tree in the bamboo, that he never forgot her.";
  if (f.huliLetter && !f.peiAtRest) return "Scholar Pei's letter: Hu Li waits at the Moon-Gazing Pavilion, north of the creek. Speak with the scholar's shade.";
  if (f.ouMet && hasDawnfrost(f) && !f.ouMail) return "Dawnfrost: bring Xue Ming's first sword home to Smith Ou at the Sword Tomb, north of the western highway.";
  if (f.yunTea && !f.wenReply) return "The brothers' quarrel: take Master Yun's tea brick to Old Fisher Wen at the Lotus Lake.";
  if (f.wenReply && !f.brothersReconciled) return "The brothers' quarrel: carry Old Fisher Wen's answer back to Master Yun on the Cloudstep Isles.";
  if (f.ouMet && !hasDawnfrost(f)) return "Dawnfrost: Smith Ou asks you to look for the sword he forged for Xue Ming.";
  if (f.haiMet && !f.haiPeach) return "The Sea-Swallow's errand: bring Captain Hai a peach from Auntie Rong's orchard, east of the Lotus Lake.";
  if (f.haiPeach && !f.haiCoat) return "The Sea-Swallow's errand: take the peach to Captain Hai at Wavecrest Harbour, east over the Rainbow Bridge.";
  if (f.heartReturned && !f.festivalSeen) return "Willow Creek is lighting its lanterns. Go home to the village for the festival.";
  return null;
}

/** Why a region is sealed on the world map, or null if it is open. */
export function lockReason(id: AreaId, g: GameState): string | null {
  const f = g.flags;
  switch (id) {
    case "sect":
      return null;
    case "village":
      return f.metElder || originOf(f) === "foundling" ? null : "Speak with Elder Mo first.";
    case "bamboo":
      return f.metZhou ? null : "Village Head Zhou forbids the forest path.";
    case "lake":
      if (!f.metHuli) return "A spirit mist hides the lake.";
      return levelIndex(g.realm, g.stage) >= LAKE_LEVEL ? null : `The lake beasts would devour you. Reach ${realmLabel(0, LAKE_LEVEL)}.`;
    case "valley":
      if (!f.serpentKingDefeated && !f.secretWay) return "The way west is unknown.";
      return g.realm >= 1 ? null : "Demonic qi would tear you apart. Reach Foundation Establishment.";
    case "peak":
      if (f.moBroken) return null;
      if (crimsonPath(f)) return "The sky bridge will not carry you while Elder Mo stands before it.";
      return f.heartReturned ? null : "Only those the Heart chooses may climb.";
    case "terraces":
    case "marsh":
      return f.metElder ? null : "Speak with Elder Mo first.";
    case "desert":
    case "harbor":
      return f.metZhou ? null : "The far roads are closed until Willow Creek is safe. Speak with Village Head Zhou.";
    case "frost":
      if (!f.metElder) return "Speak with Elder Mo first.";
      return g.realm >= 1 ? null : "Frostveil's cold would freeze your meridians. Reach Foundation Establishment.";
  }
}

export const areaUnlocked = (id: AreaId, g: GameState) => lockReason(id, g) === null;

// ----------------------------------------------------------------------------- opening
export function introScript(g?: GameState): Step[] {
  const own = originIntro(originOf(g?.flags ?? {}));
  if (own) return own;
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
      return !f.metElder || (f.patriarchDefeated && !f.heartReturned && !(crimsonPath(f) && f.moBroken)) || (!!veinFate(f) && !f.elderVein && !f.ascended);
    case "qing":
      return !f.qingGift && !!f.metElder;
    case "zhou":
      return !!f.villageSaved && !f.metZhou && !!f.metElder;
    case "elderPeak":
      return true;
    case "fang":
      return !f.fangTea;
    case "tang":
      return !f.tangGift;
    case "kong":
      return !f.kongSutra;
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
    case "hua":
      return !f.huaTea || (!!f.foxesCleared && !f.huaCloak);
    case "huli":
      return !f.metHuli || (!!f.peiMet && !f.huliLetter) || foxformReady(f);
    case "xueming":
      return !f.xueAtTomb;
    case "wen":
      return !f.metWen || (!!f.serpentKingDefeated && !g.skills.includes("swords")) || (!!f.yunTea && !f.wenReply);
    case "yun":
      return !f.yunTeaching || (!!f.metWen && !f.yunTea) || (!!f.wenReply && !f.brothersReconciled);
    case "ou":
      return !f.ouMet || (hasDawnfrost(f) && !f.ouMail);
    case "pei":
      return !f.peiMet || !!f.huliLetter;
    case "rong":
      return !f.rongGift || (!!f.haiMet && !f.haiPeach);
    case "pang":
      return !f.pangMeal;
    case "qiu":
      return !f.qiuForm;
    case "ye":
      return !f.yeCharm;
    case "luyu":
      return !f.luyuTea;
    case "batu":
      return !f.batuSong;
    case "hai":
      return !f.haiMet || (!!f.haiPeach && !f.haiCoat);
    case "xuan":
      return !f.xuanTaiji;
    case "herder":
      return !f.herderMilk;
    case "mei":
      return !!f.heartReturned && !f[`attire:festival`];
    case "almanac":
      return yearHasNews(key, g, calendarAt(worldTime(g)));
    default:
      return sectHasNews(key, g) ?? false;
  }
}

export function npcScript(key: string, g: GameState): Step[] {
  const f = g.flags;
  switch (key) {
    case "elder":
      return elderScript(g);
    case "almanac":
      return almanacMasterScript(g, calendarAt(worldTime(g)));
    case "peddler":
      return [
        say("peddler", pick(g, [
          "Ho, cultivator! Bai's the name, the highway's my shop. Pills for the road?",
          f.foxesCleared ? "I've walked this road from the red valley to the lotus lake. The foxes are back to stealing chickens, thank heaven. Honest thieves." : "I've walked this road from the red valley to the lotus lake. Never seen the foxes this wild.",
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
        ...(dominantDao(g) ? [say("elder", `Go up as what you are: ${DAOS[dominantDao(g)!].name}. ${DAOS[dominantDao(g)!].creed} Heaven will ask you whether you meant it.`)] : []),
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
      if (originOf(f) === "defector" && !f.metElder) return [say("abao", "You're… you're from the Blood Moon? You don't look like a demon. Elder Mo is waiting before the Hall of Clouds, up the stairs. Um. Welcome?")];
      return [say("abao", pick(g, [
        f.metElder ? "Senior Sister, the sky bridge below the sect gate goes all the way down to the mortal lands! You can walk the whole jianghu from there." : "Elder Mo is waiting before the Hall of Clouds, up the stairs!",
        "If your qi runs dry, swallow a Qi Gathering Pill with Q. Healing pills are H!",
        "Feng says you can ride your sword with F. Lucky… I still fall off mine.",
        "Hold Shift and you can run! Elder Mo says a cultivator should never run in the plaza, though.",
        "When your cultivation bar is full at a realm's peak, meditate at a lotus shrine and press B. Then pray to heaven!",
      ]))];
    case "feng":
      // a runaway in Blood Moon red is nobody's senior sister until Elder Mo has taken her in
      if (originOf(f) === "defector" && !f.metElder) return [{ emote: "feng", icon: "anger" }, say("discipleM", "Blood Moon robes, inside our gate. Elder Mo says you're to be let through to him. I say I'm watching you.")];
      return [say("discipleM", pick(g, ["Hah! Hyah! …Oh, Senior Sister Lin. One more thousand strikes before lunch.", f.patriarchDefeated ? "The guardian lions have a fresh coat of gold. Nobody's walking past them again." : originOf(f) === "defector" ? "You came in past the guardian lions the same way they did, didn't you? …Elder Mo says you're one of us now. I'm trying." : "They say the Blood Moon Sect walked right past the guardian lions. How?", "Myriad Swords Return… our founder could do it. Imagine!"]))];
    case "lan":
      if (originOf(f) === "defector" && !f.metElder) return [say("discipleF", "You're the runaway from the valley? Elder Mo is waiting for you before the Hall of Clouds. …Up the stairs. Please don't burn anything on the way.")];
      return [say("discipleF", pick(g, ["Keep your wrist loose and your heart still — that's what Elder Mo says.", f.heartReturned ? "The Heart is home and the spirit veins feel full again. I slept through the night for the first time in months." : "Bring the Heart back, Senior Sister. The spirit veins already feel thin.", "I'll guard the sect while you're gone! …Probably."]))];
    case "zhou":
      if (!f.villageSaved) return [{ emote: "zhou", icon: "!" }, say("zhou", "A cultivator! Please, the fox spirit by the bridge — it attacks anyone who crosses! Drive it off, I beg you!")];
      if (!f.metZhou && !f.metElder)
        return [say("zhou", "Yue'er! You drove that thing off with Hua's old practice sword? Heaven help us. …No. Heaven isn't helping. Go up the sky bridge, child, show the immortals your token, and tell them what is happening down here.")];
      if (!f.metZhou)
        return [
          say("zhou", originOf(f) === "foundling" ? "Hua's Yue'er, in sect robes — well, nearly. Heaven has heard us at last, and it sent one of our own." : "You drove off the beast! Heaven has heard us at last. I am Zhou, head of Willow Creek."),
          say("zhou", "For seven nights fox spirits have come down from the Whispering Bamboo Forest. Their eyes burn red — like the moon on the night the sky turned to blood."),
          say("child", "I saw a man in red robes walking with them! He laughed, and the foxes howled…"),
          say("zhou", "Hush, Mei. …The forest lies west along the highway. I had it sealed with talismans, but you — you could find out what drives them mad."),
          say("heroine", "Red robes beneath a blood moon. The Blood Moon Sect… I'll go to the forest."),
          { mutate: (s) => setFlag({ ...s, stones: s.stones + 30 }, "metZhou") },
          { toast: "Received 30 spirit stones · The talisman seal on the bamboo forest lifts" },
        ];
      if (crimsonPath(f)) return [{ emote: "zhou", icon: "..." }, say("zhou", "The moon's been red for weeks. The children won't go out after dark. …Forgive me, cultivator. I don't think I know you any more.")];
      return [say("zhou", f.foxesCleared ? "The foxes are quiet again. The children play by the creek. Willow Creek owes you everything." : "Take the south road down to the old highway and follow it west. The bamboo starts where the creek bends. Be careful in there.")];
    case "hua":
      if (!f.huaTea)
        return [
          say("hua", originOf(f) === "foundling" ? "There's my Yue'er, home already, and pale as a radish. Sit. Drink. Ginseng and snow lotus, steeped since dawn, like every morning of your life." : "Come, come, child. You look pale. Drink — ginseng and snow lotus, steeped since dawn."),
          { mutate: (s) => setFlag({ ...s, hp: stats(s).maxHp, qi: stats(s).maxQi }, "huaTea") },
          { toast: "HP and QI fully restored" },
          say("hua", "Spirit herbs glow faintly where qi pools. Pick them when you see them — they feed a cultivator's foundation."),
        ];
      if (f.foxesCleared && !f.huaCloak)
        return [
          { emote: "hua", icon: "heart" },
          say("hua", "There she is. The foxes sleep at night again, and so do I. Come here, child — no, closer. Arms out."),
          say("hua", "This was my husband's travelling cloak. Forty years it has hung by the door, waiting. Lü took it in for you; she says you're narrower in the shoulder than a sword disciple ought to be."),
          say("heroine", "Granny Hua, I can't take his cloak. What if he—"),
          say("hua", "Comes home? Then he can come home in his house clothes. A cloak is for the road, and you are the one on the road."),
          { mutate: (s) => setFlag(giveAttire(s, "wayfarer"), "huaCloak") },
          { anim: "hero", name: "twirl", wait: true },
          { toast: "Received the Wayfarer's Cloak · Press C to change your attire" },
          say("hua", "Hm. The straw hat suits you better than it ever suited him. Don't tell him I said so."),
        ];
      if (crimsonPath(f)) return [{ anim: "hua", name: "cry", wait: true }, say("hua", originOf(f) === "foundling" ? "I raised you on bitter tea so you'd never want anything too sweet. Oh, Yue'er. What have you swallowed?" : "Your eyes are red, child. Not from crying. Sit down. Drink the tea anyway.")];
      return [say("hua", pick(g, ["Shrines, herbs and honest fights — that's how cultivators grow. Patience, child.", originOf(f) === "foundling" ? "I still set out a cup for your grandfather every evening, you know. Forty years since he went west to the valley. Habits are stubborn." : "My husband was a sect disciple once. He never came home from the valley in the west.", "Have some more tea. No? Then off with you!"])), { mutate: (s) => ({ ...s, hp: stats(s).maxHp }) }];
    case "liu":
      return [say("farmer", pick(g, ["The rice drinks the creek, and the creek drinks the mountain's qi. If the mountain sickens, so do we.", "Foxes trampled half my paddy. Hope you gave them a good scare.", "Fine weather. Too fine. Feels like the calm before a storm."]))];
    case "mei":
      if (crimsonPath(f)) return [{ emote: "mei", icon: "..." }, say("child", "Granny Hua says not to look at the moon. Big Sister… is the moon yours now?")];
      if (f.heartReturned && !f["attire:festival"]) return festivalScript();
      if (f.heartReturned)
        return [{ emote: "mei", icon: "heart" }, say("child", pick(g, ["You look like a lantern! A pretty one!", "Granny says the Heart made the rice green overnight. I checked. It's true!", "Watch the sky! Head Zhou bought ALL the fireworks."]))];
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
      if (f.peiMet && !f.huliLetter)
        return [
          say("heroine", "Hu Li… at the pavilion north of the creek, I met a scholar's shade. His name is Pei. He's been writing you a letter for three hundred years."),
          { emote: "huli", icon: "..." },
          { wait: 0.8 },
          say("huli", "…Pei. He said he'd be back before the plum rains. I waited through three hundred of them."),
          say("huli", "He never broke a promise in his life. So I told myself he'd simply never died. That was easier."),
          say("huli", "The Moon-Gazing Pavilion. Of course it's there. Go ahead of me, little sister. A fox needs a moment to tidy her tails."),
          { mutate: (s) => setFlag(s, "huliLetter") },
          { toast: "Hu Li will meet you at the Moon-Gazing Pavilion" },
        ];
      if (foxformReady(f))
        return [
          { emote: "huli", icon: "heart" },
          say("huli", "Little sister. The Blood Moon is gone, and Pei is at peace, and I find there is one thing left I want to give away."),
          say("huli", "Three hundred years ago a fox taught a scholar to read the moon. Tonight a fox will teach a cultivator to wear one. Hold still. It tickles."),
          { anim: "huli", name: "cast", wait: true },
          { flash: "#ffe0a0" },
          { mutate: (s) => setFlag(giveAttire(s, "foxform"), "huliSister") },
          { anim: "hero", name: "twirl", wait: true },
          { toast: "Received the Nine-Tailed Form · Hu Li calls you sister" },
          say("huli", "Nine tails! I only have three. …I am not jealous. I am three hundred years old and not at all jealous."),
        ];
      if (f.peiAtRest) return [say("huli", pick(g, ["I go to the pavilion on clear nights. The moon is the same moon. He was right about that.", "Wear the dress when you need courage. Fox-fire never goes out — it only waits.", "The kits ask why I smile now. I tell them a scholar finally finished his homework."]))];
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
      if (f.yunTea && !f.wenReply)
        return [
          say("heroine", "Master Wen, Master Yun sent this. A brick of cloud-mist tea. He said, and I quote, “it is not an apology.”"),
          { emote: "wen", icon: "..." },
          say("wen", "…Cloud-mist from the high terraces. He remembered. Eighty years, and the old cloud remembered I like it bitter."),
          say("wen", "Hmph. Then this is not a reply."),
          { anim: "wen", name: "cast", wait: true },
          say("wen", "A moon-pearl from the deepest part of the lake. Tell him — tell him the lake is deep enough to hold the whole sky. That is all. He'll understand."),
          { mutate: (s) => setFlag(s, "wenReply") },
          { toast: "Received Old Fisher Wen's moon-pearl, for Master Yun" },
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
      if (f.wenReply && !f.brothersReconciled)
        return [
          say("heroine", "Master Yun. From Master Wen: a moon-pearl. He says the lake is deep enough to hold the whole sky."),
          { emote: "yun", icon: "!" },
          { wait: 0.6 },
          say("hermit", "…Ha. Hahaha! The stubborn old carp. That was my line. I said it to him eighty years ago, and he threw his rod at me."),
          say("hermit", "Water holds the sky; the sky fills the water. We were both right, and too proud to be right together."),
          say("hermit", "Next spring I will go down to the lake. Or he will come up. One of us will have to cross the bridge first. …Probably me."),
          say("hermit", "You walked between us without taking a side. That is rarer than any technique. Here — cloud-silk, woven on the isles from the morning mist. It has waited a long time for someone light enough to wear it."),
          { anim: "yun", name: "cast", wait: true },
          { flash: "#c8f0ff" },
          { mutate: (s) => setFlag(gainCultivation(giveAttire(s, "cloudsilk"), Math.round(cultivationNeeded(s.realm, s.stage) * 0.3)).state, "brothersReconciled") },
          { toast: "Received the Cloud-Silk Robes · Cultivation rises" },
          { anim: "hero", name: "salute", wait: true },
          { anim: "yun", name: "meditate" },
        ];
      if (f.yunTeaching && f.metWen && !f.yunTea)
        return [
          say("hermit", "You have been to the lake. I can smell it on you — mud and moonlight. How is he?"),
          say("heroine", "Master Wen? He fishes. He said you chose the sky and he chose the lake."),
          say("hermit", "Hmph. Eighty years, and still a sentence like a closed door."),
          say("hermit", "Take him this. Cloud-mist tea from the high terraces. And tell him it is NOT an apology."),
          { mutate: (s) => setFlag(s, "yunTea") },
          { toast: "Received a brick of cloud-mist tea, for Old Fisher Wen" },
          { anim: "yun", name: "meditate" },
        ];
      if (f.brothersReconciled) return [say("hermit", pick(g, ["I practised walking down the sky bridge yesterday. I got as far as Cloudrest Isle and had a sit.", "Tell Wen the tea was not an apology. He will know it was.", "The cloud-silk suits you. It always wanted to go somewhere."]))];
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
    case "ou":
      return smithScript(g);
    case "xueming":
      if (!f.xueAtTomb)
        return [
          { anim: "xueming", name: "plantsword", wait: true },
          named("patriarch", "Xue Ming", "Ou put me to work the morning I arrived. Three hundred and twelve swords to oil, and he says I'm doing it wrong."),
          named("patriarch", "Xue Ming", "Mo came down the sky bridge last week. He didn't say anything. He sat on that rock and watched me oil swords for an hour, and then he went home. It was the best conversation we've had in forty years."),
          { mutate: (s) => setFlag(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.4)).state, "xueAtTomb") },
          named("patriarch", "Xue Ming", "Here. The one true thing the Blood Moon taught me: power you take is a debt. Power you're given is a road. Walk yours."),
          { toast: "Xue Ming's last teaching · Cultivation rises" },
        ];
      return [named("patriarch", "Xue Ming", pick(g, ["Dawnfrost is at the top of the hill. Ou says it's the first sword on the hill whose owner came back for it.", "I carved a new name in the willow at Willow Creek. Underneath Mo's. He'll be furious.", "If you see a Blood Moon acolyte on the roads, send them here. There are more swords than one old fool can oil.", "Heaven never opened its door for me. It turns out I was knocking on the wrong one."])), { anim: "xueming", name: "sweep" }];
    case "pei":
      return peiScript(g);
    case "huliPav":
      return [say("huli", "He's still talking to the moon, isn't he? Speak to him, little sister. I… can't be the first.")];
    case "rong":
      if (f.haiMet && !f.haiPeach)
        return [
          say("heroine", "Auntie Rong, a sea captain in Wavecrest Harbour asks for one of your peaches, for his mother. He said she planted a stone here once."),
          { emote: "rong", icon: "!" },
          say("orchardist", "Hai's mother! She left for the coast when I was a girl and took my grandmother's heart with her. The oldest tree is hers. Here — the ripest one. Wrap it in your sleeve, it bruises."),
          { mutate: (s) => setFlag(s, "haiPeach") },
          { toast: "Received a peach from the oldest tree, for Captain Hai" },
        ];
      if (!f.rongGift)
        return [
          { anim: "rong", name: "wave" },
          say("orchardist", "A traveller! Mind the bees — they're cross with me for taking their honey. Rong's the name; the peaches are mine, and the bees think the peaches are theirs."),
          say("orchardist", "They say the first tree here grew from a peach stone the founder threw over her shoulder on her way up the mountain. My grandmother's grandmother saw it sprout. Or said she did."),
          say("orchardist", "Here, take a few for the road. Peaches of long life, the old stories call them. They're really just very good peaches."),
          { anim: "hero", name: "eat", wait: true },
          { mutate: (s) => setFlag({ ...heal(s, 9999, 9999), pills: { ...s.pills, heal: Math.min(99, s.pills.heal + 2) } }, "rongGift") },
          { toast: "HP and QI fully restored · Received 2 Healing Pills (well, peaches)" },
          say("orchardist", "If the Serpent of the lake's outflow bothers you, throw it a peach. It won't help, but you'll feel better."),
        ];
      return [say("orchardist", pick(g, [
        f.heartReturned ? "This spring every tree blossomed in one night. Every single one! The bees were so surprised they forgot to sting me." : "The blossoms came late this year. The trees know when the land is unwell.",
        "Peddler Bai owes me three peaches. Tell him I've written it on the gate. In big letters.",
        "Old Fisher Wen trades me fish for peaches. He always says the peaches are too sweet, and he always comes back.",
        "Bees are like cultivators: they work all their lives for something sweet, and they get very cross if you interrupt.",
      ])), { anim: "rong", name: "gather" }];
    // ------------------------------------------------------------------ Willow Creek's busier streets
    case "shunpal":
    case "shun":
      return [{ emote: key, icon: "note" }, named("boy", key === "shun" ? "Little Shun" : "Little Hu", pick(g, ["Watch! Forty-one kicks without dropping it! …Forty-one and a half.", "Mei says girls kick shuttlecocks better. Mei is WRONG.", f.heartReturned ? "There's a shuttlecock made of festival paper. It flies all wobbly. I love it." : "When I'm a cultivator I'll kick it all the way up to the sect.", "Do immortals play shuttlecock? With their feet? Or do they just float it?"]))];
    case "chun":
      return [named("villagerF", "Auntie Chun", pick(g, ["Liu's my husband. He talks to the rice. The rice doesn't answer, but it grows, so who am I to say.", "Picking water chestnuts. Mind your feet, the paddy is deeper than it looks.", "The foxes ate my best hen. A cultivator came and drove them off. Was that you? Then you're owed an egg."]))];
    case "dikehoe":
      return [named("farmer", "Farmer Liu Er", pick(g, ["Liu's younger brother. He farms, I farm. He talks, I hoe.", "Hoe the dike, keep the water in. That's the whole secret of rice.", "My cousin Wu down south swears his rice is taller. It isn't."]))];
    case "yu":
      return [named("villagerM", "Old Yu", pick(g, ["Sixty years in Willow Creek and I've never been up the sky bridge. Heights. Can't abide them.", "The market road was a goat track when I was a boy. Now there's noodles. Progress!", f.foxesCleared ? "The foxes are quiet. Even my knees feel better." : "Foxes on the bridge again last night. Bold as tax collectors."]))];
    case "marketporter":
      return [named("porter", "Porter Kang", pick(g, ["Firewood up, rice down. My shoulders know every stone of this road.", "The pole sings when the load's right. Hear it creak? That's a happy pole.", "Niu carries tea up the terraces in the south. I carry everything else."]))];
    case "ba":
      return [say("woodcutter", pick(g, ["Hah! — One more log for Granny Hua's stove. She pays in dumplings.", "Willow burns too fast. Maple burns sweet. Pine spits. Every tree has a temper.", "I saw a fox spirit once, in the woodlot. It bowed to me. I bowed back. We were both very polite."])), { anim: "ba", name: "chop" }];
    case "lianhua":
      return [named("villagerF", "Lianhua", pick(g, [f.heartReturned ? "Lanterns on every eave! I haven't seen the creek so bright since my wedding." : "Buying radishes, selling gossip. Did you hear the Head's nephew wants to join the sect?", "The noodle man came up from the harbour in the east. His broth tastes of the sea.", "If you're going south, the tea terraces are worth the walk. Bring a hat."]))];
    case "hawker":
      return [named("villagerM", "Hawker Sun", pick(g, ["Hairpins! Combs! Lucky knots! — Oh. A cultivator. Do cultivators need lucky knots? Everyone needs lucky knots.", "Radishes from the paddies, fans from the capital, and a mirror that only shows your good side. Very popular.", "Business is good since the road was mended. Even the bandits buy combs."]))];
    case "willowguard":
      return [{ anim: "willowguard", name: "salute" }, named("guard", "Watchman Tie", pick(g, ["The arch marks Willow Creek's land. Past it, the highway's the Emperor's problem.", "I guard the arch. Mostly from goats.", f.foxesCleared ? "Quiet nights since the foxes calmed. I've taken up whittling." : "Foxes again last night. I shouted at them very sternly."]))];
    case "noodleseller":
    case "noodles":
      return [named("cook", key === "noodles" ? "Noodle Seller Hu" : "Noodle Seller Ma", pick(g, ["Hand-pulled, one long noodle per bowl — long life for whoever eats it without biting! Sit, sit.", "The broth's been simmering since my grandfather's time. We just keep adding to it.", "Cultivators eat less than mortals, they say. Not the ones I've fed."])), { anim: "hero", name: "eat", wait: true }, { mutate: (s) => heal(s, stats(s).maxHp * 0.3, 0) }, { toast: "A bowl of long-life noodles · Vitality restored a little" }];
    // ------------------------------------------------------------------ the sect's terraces
    case "guo":
      return [{ anim: "guo", name: "salute" }, say("discipleM", pick(g, ["Gate watch, Senior Sister. Nobody gets past me. Except the cranes. And the wind.", "The Blood Moon came in over the walkways, not through the gate. I keep telling them.", "If you see Ah Bao, tell him the gate is not a racecourse."]))];
    case "ning":
      return [named("discipleF", "Disciple Ning", pick(g, ["Slowly… slowly… Elder Qiu says if you can't do it slowly, you can't do it.", "The koi in the pond are older than I am. One of them is older than Elder Mo.", "Taiji in the morning, swords in the afternoon, scrolls at night. And sleep? Sleep is for mortals, apparently."]))];
    case "pang":
      if (!f.pangMeal)
        return [
          say("cook", "Lin Yue! You're going down the mountain on an empty stomach? Not from MY kitchen you're not."),
          say("cook", "Sit. Steamed buns with lotus paste, a bowl of congee, and one dumpling for luck. Then one more dumpling, because one is unlucky."),
          { anim: "hero", name: "eat", wait: true },
          { mutate: (s) => setFlag({ ...heal(s, 9999, 9999), pills: { ...s.pills, heal: Math.min(99, s.pills.heal + 1) } }, "pangMeal") },
          { toast: "HP and QI fully restored · Received a Healing Pill (wrapped in a bun)" },
          say("cook", "The bun's for later. Don't let the elders see you eating on the sword."),
        ];
      return [say("cook", pick(g, ["Cultivators who skip breakfast fall off their swords. I have seen it. Twice.", "Elder Mo likes his tea bitter and his congee plain. A man of no joy.", "Chen kicked a shuttlecock into my soup again. I put it back in his bowl."])), { mutate: (s) => heal(s, stats(s).maxHp * 0.25, 0) }];
    case "chen":
      return [{ emote: "chen", icon: "note" }, named("discipleM", "Disciple Chen", pick(g, ["Shuttlecock is footwork training. Elder Qiu said so. Probably.", "Forty kicks without touching the ground. Then the cook shouted at me and I lost count.", "Senior Sister, can you kick it with qi? Show me! …Oh. Right. The bells."]))];
    case "xiu":
      return [named("discipleF", "Disciple Xiu", pick(g, ["The dormitories are cold in winter. We sleep three to a bed and argue about the blanket.", "The library pagoda has a scroll on every beast in the jianghu. I'm on page four hundred.", "Did you know the sect's terraces are moored with chains of qi? If they snap, the court floats away. I check every morning."]))];
    case "qiu":
      if (!f.qiuForm)
        return [
          { anim: "qiu", name: "taichi" },
          say("taiji", "Ah, Lin Yue. Always running, always flying. Stand still for one breath. Yes, like that."),
          say("taiji", "Hands like holding a ball of water. Weight sinks into the heel. When the enemy pushes, become the door that was never there."),
          { anim: "hero", name: "taichi", wait: true },
          { flash: "#ffffff" },
          { mutate: (s) => setFlag(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.3)).state, "qiuForm") },
          { toast: "Elder Qiu's taiji settles your qi · Cultivation rises · Left alone, you may practise it yourself" },
          say("taiji", "Good. The slower you go, the further you get. Nobody believes me until they're old."),
        ];
      return [say("taiji", pick(g, ["Soft overcomes hard. Water overcomes stone. Breakfast overcomes everyone.", "Wei rushes the form. Rou rushes nothing. Between them they make one decent student.", "The Abbot of Frostveil in the east does this in the snow. Barefoot. Show-off."]))];
    case "wei":
    case "rou":
      return [named(key === "wei" ? "discipleM" : "discipleF", key === "wei" ? "Disciple Wei" : "Disciple Rou", pick(g, ["Cloud hands… single whip… my legs are on fire.", "Elder Qiu says I breathe like a frightened goose.", "Slow is hard. Fast is easy. Who knew?"]))];
    case "jian":
    case "su2":
      return [named(key === "jian" ? "discipleM" : "discipleF", key === "jian" ? "Disciple Jian" : "Disciple Su", pick(g, ["The targets are for archery, but we use them to practise flying sword strikes. The archers are very cross.", "One more thousand cuts before the bell. Then another thousand after it.", "The bell rings when someone hits the centre. It hasn't rung all week."]))];
    // ------------------------------------------------------------------ the Mistmarsh
    case "ye":
      if (!f.yeCharm)
        return [
          { emote: "ye", icon: "..." },
          say("marshwitch", "Mm. Jade robes, clean boots. The marsh will fix those. Come in, come in, mind the frog — that one's called Wen, after a fisherman I once knew. Very stubborn frog."),
          say("marshwitch", "Everything in the Mistmarsh is drowned or drowning or only pretending. The wisps are lost souls looking for the road. I give them directions."),
          say("marshwitch", "You've a tangle in your meridians, child. Hold still."),
          { anim: "ye", name: "cast", wait: true },
          { flash: "#b8ffd8" },
          { mutate: (s) => setFlag({ ...gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.3)).state, pills: { ...s.pills, qi: Math.min(99, s.pills.qi + 2) } }, "yeCharm") },
          { toast: "Granny Ye untangles your qi · Cultivation rises · Received 2 Qi Gathering Pills" },
          say("marshwitch", "And if the hopping dead come for you on the boards, stand still. They can only see what moves. Like tax collectors."),
        ];
      return [say("marshwitch", pick(g, ["The mist is the marsh breathing out. At dawn it breathes in, and you can see all the way to the plum hills.", "Hua of Willow Creek and I were girls together. She got the herbs. I got the frogs. I think I won.", "Don't eat the glowing mushrooms. Or do. You'll have a very interesting week."]))];
    case "reedcutter":
      return [named("villagerM", "Reed-cutter Mo", pick(g, ["Reeds for roofs, reeds for mats, reeds for boats. The marsh gives, if you ask politely.", "The stilts keep the houses dry. Mostly. My grandfather's house swam away in the flood of '62.", "Granny Ye named every frog in the village. She's never wrong about which is which."]))];
    case "netmaker":
      return [named("villagerF", "Net-mender Ping", pick(g, ["Eel nets, frog nets, nets for catching nets that drifted off. Busy, busy.", "The wisps come close to the lanterns at night. I leave a light in the window for them.", "Pip, stop kicking that thing at the houses!"]))];
    case "pip":
      return [{ emote: "pip", icon: "note" }, named("boy", "Pip", pick(g, ["If it goes in the water I have to swim for it. I am a very good swimmer.", "The hopping dead can't hop on the boardwalks — too wobbly! I've seen them fall in.", "You're from the sect? Is it true you have a cook who makes buns as big as your head?"]))];
    // ------------------------------------------------------------------ the Cloudmist Tea Terraces
    case "luyu":
      if (!f.luyuTea)
        return [
          { anim: "luyu", name: "pour" },
          say("teamaster", "A cultivator, climbing my hill on foot? Good. Tea tastes better to tired legs. Sit."),
          say("teamaster", "First steep is for the leaves to wake. Second is for the guest. Third is for the friendship. I pour all three; you decide which one you're drinking."),
          { anim: "hero", name: "drink", wait: true },
          { flash: "#c8ffb0" },
          { mutate: (s) => setFlag(heal(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.35)).state, 9999, 9999), "luyuTea") },
          { toast: "Cloud-mist tea · HP and QI restored · Cultivation rises" },
          say("teamaster", f.yunTea || f.brothersReconciled ? "You carried one of my bricks to the lake, I hear. Yun buys a brick every spring and drinks it alone. I'm glad it found its way to Wen at last." : "Every spring a hermit from the sky isles buys one brick of my best. He never says who it's for."),
        ];
      return [say("teamaster", pick(g, ["One bud, two leaves. More than that and it's salad.", "The cloud sits on the hill till noon. The tea drinks it. That's the whole trick.", "Porter Niu has carried tea up to the sect for thirty years. They should name a peak after him.", "The terraces were cut by the founder's own hand, they say. She liked her tea."])), { anim: "luyu", name: "pour" }];
    case "cui":
    case "cui2":
      return [named("teapicker", key === "cui" ? "Picker Cui" : "Picker Hong", pick(g, ["One bud and two leaves, one bud and two leaves… I say it in my sleep.", "Sing while you pick and the tea tastes happier. Master Lu says that's nonsense. He hums anyway.", "The cherry trees bloom just as the first flush is ready. Then everyone sneezes."]))];
    case "niu":
      return [say("porter", pick(g, ["Up the steps with empty baskets, down with full. Or is it the other way round? Thirty years and I still forget.", "Nine hundred steps to the top of the sect's sky bridge. I've counted. Every day.", "The baskets weigh the same as my wife. Don't tell her I said so."]))];
    case "terrace-kid":
      return [named("boy", "Little Bo", pick(g, ["I'm guarding the tea from the wolf! …There's a wolf. Over there. Please go and fight it.", "Ma picks, Pa carries, I guard. It's the most important job.", "Can you fly me to the top? The steps are SO many."]))];
    // ------------------------------------------------------------------ the Yellow Sands
    case "batu":
      if (!f.batuSong)
        return [
          { anim: "batu", name: "flute" },
          say("nomad", "Sit by the fire, sky-sister. The sand is cold at night, even here at the spring."),
          say("nomad", "We take caravans west, to kingdoms you've never heard of. Silk out, horses back. The horses you see on the steppe — half of them are cousins of mine. The horses, not the herders."),
          say("nomad", "Here. A cultivator once paid me in stones for a song. I never spent them. Now you pay me with a listen."),
          { anim: "batu", name: "flute" },
          { wait: 1 },
          { mutate: (s) => setFlag({ ...s, stones: s.stones + 30 }, "batuSong") },
          { toast: "Received 30 spirit stones" },
        ];
      return [say("nomad", pick(g, ["The stupa was here before the oasis. The oasis came to keep it company.", "Raiders hide in the red cliffs to the east. They steal from caravans and sell to caravans. Clever, if you like that sort of thing.", "The sand sings when the wind is right. Sounds like this—", "Saran makes the best milk tea in the desert. Don't tell her I said 'in the desert' — she'd say 'in the world'."])), { anim: "batu", name: "flute" }];
    case "saran":
      return [named("villagerF", "Saran", pick(g, ["Milk tea, salted, with butter. You'll hate the first cup and need the second.", "Batu plays that flute every night. The camels used to complain. Now they sing along.", "The spring never runs dry. My grandmother said a dragon sleeps under it. I think it's just a very good spring."]))];
    case "temur":
      return [named("boy", "Temur", pick(g, ["I rode a horse before I could walk! …Well, I fell off a horse before I could walk.", "There are bones in the dunes from before the sect. Big ones. I'm not scared. I'm a little scared.", "Is it true there's a sea in the east? A lake so big you can't see across? That's silly."]))];
    case "caravaneer":
      return [named("porter", "Caravaneer Kuo", pick(g, ["Seven days to the west kingdoms, three to the next well. I count wells, not days.", "We rest at the oasis, trade at the harbour, pray at the stupa. In that order.", "The bandits in the red cliffs took my best mule. If you're passing… just a thought."]))];
    // ------------------------------------------------------------------ Wavecrest Harbour
    case "hai":
      if (!f.haiMet)
        return [
          { anim: "hai", name: "point" },
          say("captain", "Ahoy, sky-girl! See that junk? The Sea-Swallow. Fastest hull from here to the eastern isles. And she's mine."),
          say("captain", "We sail with the turn of the season. Only my old mother up the coast wants one thing before I go: a peach from Rong's orchard, by the Lotus Lake. Says the sea air makes her forget the taste of home."),
          say("captain", "It's a long walk west for an old sailor's knees. But you've got a sword to fly on, eh?"),
          { mutate: (s) => setFlag(s, "haiMet") },
          { toast: "Side errand: bring a peach from Auntie Rong's orchard to Captain Hai" },
        ];
      if (f.haiPeach && !f.haiCoat)
        return [
          say("heroine", "Captain Hai. A peach from Auntie Rong's orchard. She said to tell you it's from the oldest tree."),
          { emote: "hai", icon: "heart" },
          say("captain", "The oldest tree… my mother planted the stone it grew from, before she ever saw the sea. Ha! She'll cry. Then she'll pretend it's the salt."),
          say("captain", "You're no sailor, but you've the legs for it. Here — a Sea-Swallow coat. Every hand on my junk gets one, and you've done more for her than most of 'em."),
          { mutate: (s) => setFlag(giveAttire(s, "seafarer"), "haiCoat") },
          { anim: "hero", name: "twirl", wait: true },
          { toast: "Received the Sea-Swallow Coat · Press C to change your attire" },
        ];
      return [say("captain", pick(g, [f.haiCoat ? "The coat suits you! Next season, come east with us. The isles have mountains that float upside down." : "Rong's orchard is by the Lotus Lake, west over the Rainbow Bridge. Ask for the oldest tree.", "The lighthouse? My sister keeps it. She keeps everything. Including my debts.", "There's a sea of clouds past the bay's edge, and the water spills right off into it. Best view in the world, if you don't fall in.", "Fish, silk, tea and gossip. A harbour runs on all four."]))];
    case "alan":
      return [named("fishwife", "Fishwife Ah Lan", pick(g, ["Fresh mackerel! Dried squid! Healing pills, if you're the kind who needs those more than squid!", "My husband sails with Captain Hai. He says he misses my cooking. He means he misses eating.", "Qi pills from the sect, passed down the coast. Don't ask how. Fifteen stones."])), { shop: true }];
    case "dockporter":
      return [named("porter", "Dock Porter Gang", pick(g, ["Barrels off, crates on, mind your toes!", "Tea from the terraces, silk from the capital, salt fish from here. It all goes through my shoulders.", "Thirty barrels a day. Thirty-one when the cook's watching."]))];
    case "harborguard":
      return [{ anim: "harborguard", name: "salute" }, named("guard", "Harbour Watchman", pick(g, ["Welcome to Wavecrest. No duelling on the quay, no flying over the market, no feeding the gulls.", "Pirates? Not since the lighthouse was lit. They don't like being seen.", "The road west goes over the steppe and the Rainbow Bridge. Long way. Lovely bridge."]))];
    case "su":
    case "yan":
      return [{ anim: key, name: "fan" }, named("lady", key === "su" ? "Lady Su" : "Poet Yan", key === "su" ? pick(g, ["I came from the capital to see the sea. It is much wetter than the poems suggest.", "The parasol is for the sun. And for the gulls. Mostly the gulls.", "A cultivator from the sky! In the capital they say your sect is a myth. I shall write and tell them they're wrong."]) : pick(g, ["The plum blooms in the snow. I come every winter to watch it be braver than me.", "I write a poem a day and burn it at dusk. The good ones, the smoke remembers.", "There is a scholar's shade by the Moon-Gazing Pavilion, they say, still writing. I envy him his patience."]))];
    case "dockhand":
      return [named("villagerM", "Dockhand Lei", pick(g, ["Rope burns, salt sores, sunburn. Best job in the world.", "The Sea-Swallow's hull is camphor wood. Smells like a grandmother's cupboard.", "If you want passage east, butter up the captain. He likes peaches."]))];
    case "netmender":
      return [named("villagerF", "Net-mender Wu", pick(g, ["Every hole tells a story. This one's a shark. This one's my nephew.", "The tide brings everything eventually. Once it brought a whole temple bell.", "Ah Lan sells the fish I catch. I'm the brains. She's the voice."]))];
    case "gullboy":
      return [{ emote: "gullboy", icon: "note" }, named("boy", "Haizi", pick(g, ["I chase the gulls and the gulls chase me. It's fair.", "When I'm big I'll be captain of the Sea-Swallow! Captain Hai says I can be cabin boy first. For twenty years.", "There's a crab under the pier as big as a dog. I named him General."]))];
    case "harbor-elder":
      return pick(g, [
        [named("storyteller", "Old Salt Fang", "The tale of the sea at the world's edge! The water pours off into the clouds, and the clouds rain on the sky islands, and the sky islands' streams fall back into the sea. Round and round, since the founder floated her mountain.")],
        [named("storyteller", "Old Salt Fang", "The tale of the lighthouse! It was lit by a fox who loved a fisherman, so he'd always find his way home. He did. She's still lighting it."), { emote: "hero", icon: "?" }],
        [named("storyteller", "Old Salt Fang", "The tale of the Rainbow Bridge! A thousand planks, a thousand talismans, laid by the sect when the gorge cracked open. The waterfall's been trying to wash it away ever since.")],
      ]);
    // ------------------------------------------------------------------ Frostveil Monastery
    case "xuan":
      if (!f.xuanTaiji)
        return [
          { anim: "xuan", name: "bow" },
          say("abbot", "Amituofo. A disciple of the Azure Cloud, so far east. Your elder Mo and I argued once about whether the Dao is a road or a river. He still owes me a cup of tea."),
          say("abbot", "The cold here teaches one thing: what is not needed, let it go. Breathe out the warmth you are clinging to. Move with me."),
          { anim: "hero", name: "taichi", wait: true },
          { anim: "hero", name: "meditate" },
          { wait: 1.2 },
          { flash: "#e8f4ff" },
          { mutate: (s) => setFlag(gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * 0.6)).state, "xuanTaiji") },
          { anim: "hero", name: "idle" },
          { toast: "The Frostveil form · Cultivation rises greatly" },
          say("abbot", "Good. Now you are a little lighter. Come back when you have more to let go of."),
          { anim: "xuan", name: "taichi" },
        ];
      return [say("abbot", pick(g, ["Snow falls on the hall roof and on the beggar's hat alike.", "The novices complain of the cold. In twenty years they will complain of the warm.", "Tell Mo the Dao is a river. He will be very annoyed. That is my gift to him."])), { anim: "xuan", name: "taichi" }];
    case "tuo":
      return [say("novice", pick(g, ["Sweep, sweep. The snow falls, I sweep. The snow wins. The Abbot says that's the lesson.", "I kicked the shuttlecock onto the hall roof. The Abbot says I may retrieve it when I can fly.", "The bell is rung at dawn by the youngest novice. That's me. Every. Single. Dawn."])), { anim: "tuo", name: "sweep" }];
    case "novice-1":
    case "novice-2":
    case "novice-3":
      return [named("novice", key === "novice-1" ? "Novice Ji" : key === "novice-2" ? "Novice Hui" : "Novice Pu", pick(g, ["Cold hands… cold feet… warm heart, the Abbot says. My heart is also cold.", "Wave hands like clouds… my clouds are frozen.", "Have you come to join? You'd have to shave your head. It's very cold."]))];
    // ------------------------------------------------------------------ the wilds
    case "herder":
      if (!f.herderMilk)
        return [
          named("villagerM", "Herder Altan", "A cultivator out of the clouds, on the steppe! The herd smelled the sky on you from a li off. Sit, drink — mare's milk, fresh this morning. Warms you like a brazier."),
          { anim: "hero", name: "drink", wait: true },
          { mutate: (s) => setFlag(heal(s, 9999, 9999), "herderMilk") },
          { toast: "HP and QI fully restored" },
          named("villagerM", "Herder Altan", "The wild horses run from walkers but they'll let a rider among them. If that jade whistle on your belt calls what I think it calls, ride in among them some time."),
        ];
      return [named("villagerM", "Herder Altan", pick(g, ["Grass from the bridge to the sea. Best pasture in the jianghu.", "We follow the grass. The grass follows the rain. The rain follows nobody.", "The road north climbs to Frostveil. Monks up there, barefoot in the snow. Mad as hares."]))];
    case "oyun":
      return [named("villagerF", "Oyun", pick(g, ["Milk tea for the traveller! Salt or sugar? We only have salt.", "The tents fold up in an hour. We could be gone by noon if the grass says so.", "Batu in the Yellow Sands is my brother. Tell him to write. He can't write. Tell him to visit."]))];
    case "gao":
      return [named("villagerM", "Woodcutter Gao", pick(g, ["Maple for the harbour's boats, pine for the monastery's stoves. Every tree here has an order on it.", "The leaves turn red in autumn and stay red all year in these woods. Something in the soil. Or someone.", "Wolves in the woods lately. Big grey ones. They don't like axes."])), { anim: "gao", name: "chop" }];
    case "innkeeper":
      return [named("villagerF", "Innkeeper Zhao", pick(g, ["Rooms upstairs, noodles downstairs, gossip everywhere. Rest a while.", "Porters, pilgrims and poets — that's my custom. You're the first cultivator this month.", "South-east to the sands, north to the tea, west to the marsh. Everything passes my door eventually."])), { mutate: (s) => heal(s, 9999, 9999) }, { toast: "A night's rest at the inn · HP and QI restored" }, { shop: true }];
    case "restporter":
      return [named("porter", "Porter Lao", pick(g, ["Eating. Talking costs breath, and breath costs noodles.", "From the terraces to the sands with tea, from the sands to the harbour with salt. Then home to sleep for a week.", "My pole's older than me. My father's. Same shoulders, too."])), { anim: "restporter", name: "eat" }];
    default:
      return warNpcScript(key, g) ?? roadNpcScript(key, g) ?? hallsNpcScript(key, g) ?? tiersNpcScript(key, g) ?? peoplesNpcScript(key, g) ?? tierFolkScript(key, g) ?? quarterNpcScript(key, g) ?? sectNpcScript(key, g) ?? townNpcScript(key, g) ?? tideNpcScript(key, g) ?? crowdNpcScript(key, g) ?? [say("narrator", "…")];
  }
}

/** Hu Li has one more gift once Pei is at rest and the Blood Moon is over (and not if the blood moon now rises for Lin Yue). */
const foxformReady = (f: Record<string, boolean>) => !!f.peiAtRest && !!f.patriarchDefeated && !f["attire:foxform"] && !crimsonPath(f);

/** Dawnfrost lay on Xue's altar: whoever beat him has it (saves from before the smith knew of it included). */
const hasDawnfrost = (f: Record<string, boolean>) => !!(f.dawnfrost || f.patriarchDefeated);

/** Smith Ou at the Sword Tomb, and the sword he made for Xue Ming. */
function smithScript(g: GameState): Step[] {
  const f = g.flags;
  if (!f.ouMet)
    return [
      say("smith", "Hm. You're not here to buy a sword. Nobody comes here to buy a sword. They come to look at the ones that aren't for sale."),
      say("smith", "Ou. I was the sect's smith once, when there was a war to forge for. When it was over I carried every sword the west lost up this hill, one at a time. Three hundred and twelve trips."),
      say("heroine", "Every sword here belonged to someone who fell?"),
      say("smith", "Every one. And one that's missing. I took an apprentice, after — a boy from Willow Creek, all elbows and questions. Xue Ming. When the sect took him up to the clouds, I made him a blade. Dawnfrost. Bright as the first frost on the paddies."),
      say("smith", "If you're going where I think you're going… he'll have it with him still, or he'll have thrown it away. Either way. Bring it home. It belongs on this hill, not in his hand."),
      { mutate: (s) => setFlag({ ...s, pills: { ...s.pills, heal: Math.min(99, s.pills.heal + 1) } }, "ouMet") },
      ...(hasDawnfrost(f) ? [] : [{ toast: "Received a Healing Pill · Smith Ou asks you to find Dawnfrost" }, { anim: "ou", name: "hammer" } as Step]),
      // she already carries it: the valley is behind her
      ...(hasDawnfrost(f) && !f.ouMail ? dawnfrostHome(f) : []),
    ];
  if (hasDawnfrost(f) && !f.ouMail) return dawnfrostHome(f);
  return smithTalk(g);
}

function dawnfrostHome(f: Record<string, boolean>): Step[] {
  // talked home, Xue Ming gave it to her himself (and is coming up the hill behind her)
  const given = !!f.xueRedeemed;
  return [
    say("heroine", given ? "Master Ou. He gave it to me himself, at his altar. Dawnfrost. He said to tell you he's glad he never drew it." : "Master Ou. It was on his altar, under the Heart. Dawnfrost."),
    { emote: "ou", icon: "..." },
    { wait: 0.8 },
    say("smith", "…Not a nick on it. He never used it on anyone. Forty years a demon and he never once drew the sword I made him."),
    say("smith", given ? "Glad. Hmph. The boy always did have to have the last word. …If he comes up this hill, I'll hand him an oil rag and say nothing. That's how we did it, him and me." : "That's something. That's not nothing."),
    { anim: "ou", name: "salute", wait: true },
    say("smith", "It goes at the top, upright. Like it was always meant to. …And you'll take this. I made it for no one, out of the swords' broken tips. It's been waiting for someone who could bring one home."),
    { flash: "#dfe8f4" },
    { mutate: (s) => setFlag(giveAttire({ ...s, stones: s.stones + 60 }, "mail"), "ouMail") },
    { toast: "Received the Sword-Tomb Mail and 60 spirit stones" },
    { anim: "hero", name: "salute", wait: true },
    { anim: "ou", name: "hammer" },
  ];
}

function smithTalk(g: GameState): Step[] {
  const f = g.flags;
  return [say("smith", pick(g, [
    f.ouMail ? "Some nights the swords hum. I think Dawnfrost is telling them about you." : "Three hundred and twelve. I still count them every morning.",
    "A good sword is mostly patience and a little bit of fire. Same as a good cultivator.",
    "Xiao Han came by once and asked to duel the tomb. I told him to try. He bowed to it instead. Good lad.",
    "The forge never goes out. If it goes out, I'll have to start remembering things without hitting them.",
  ])), { anim: "ou", name: "hammer" }];
}

/** Scholar Pei, three hundred years dead, still writing the letter he never sent. */
function peiScript(g: GameState): Step[] {
  const f = g.flags;
  if (!f.huliLetter)
    return [
      { emote: "hero", icon: "!" },
      say("ghost", "Oh! You can see me. Forgive me — I haven't had a visitor since the Song dynasty. Possibly the one before."),
      say("ghost", "Pei. Candidate for the imperial examinations, eternally. I was on my way to the capital, and I stopped here to watch the moon one last time, and… well. The road was longer than I was."),
      say("ghost", "There was a fox in the bamboo who nursed me when I was hurt. I promised her I'd come back before the plum rains. I've been writing to explain why I'm late."),
      say("ghost", "Three hundred years and I can't find the last line. If you meet a fox with three tails and a long memory — would you tell her I never forgot?"),
      { mutate: (s) => setFlag(s, "peiMet") },
      { toast: "The scholar's shade asks you to find his fox" },
      { anim: "pei", name: "write" },
    ];
  return [
    { face: "pei", to: "huliPav" },
    say("ghost", "…You came. You came, and I'm the one who's late. I'm sorry, Li. I'm so sorry."),
    say("huli", "Three hundred plum rains, you foolish man. Did you think I'd stopped counting?"),
    say("ghost", "I never finished the letter. I couldn't find the last line."),
    say("huli", "Then say it. I'm right here."),
    say("ghost", "…“Wherever I am, look up, and we are looking at each other.”"),
    { emote: "huliPav", icon: "heart" },
    { flash: "#c8e0ff" },
    say("narrator", "The moon comes out from behind a cloud. For a moment the scholar is not pale at all. Then there is only moonlight on the pavilion floor, and a sheet of paper, finished."),
    { despawn: "pei" },
    { wait: 1 },
    say("huli", "…He always did take forever to get to the point."),
    say("huli", "Little sister. You carried a dead man's words three hundred years late and didn't drop a single one. Take this — fox-fire silk. It was going to be my wedding dress. It should go somewhere instead of waiting."),
    { anim: "huliPav", name: "twirl", wait: true },
    { mutate: (s) => setFlag(gainCultivation(giveAttire(s, "foxfire"), Math.round(cultivationNeeded(s.realm, s.stage) * 0.3)).state, "peiAtRest") },
    { toast: "Received the Foxfire Dress · Cultivation rises" },
    { anim: "hero", name: "bow", wait: true },
  ];
}

/** Willow Creek's lantern festival, once the Heart is home. */
export function festivalScript(): Step[] {
  return [
    { mutate: (s) => setFlag(s, "festivalSeen") },
    { camera: "mei" },
    { emote: "mei", icon: "!" },
    say("child", "Big Sister Lin! You came back for the festival! Everyone said you'd be too busy being immortal!"),
    say("zhou", "Willow Creek has not lit its lanterns in seven years. Tonight we light every one. The rice is green, the creek runs the right way, and the foxes only come to the square to beg for dumplings."),
    { shake: 0.2 },
    { flash: "#ffd27a" },
    say("narrator", "A rocket whistles up from the square and bursts gold over the creek. Somebody's dog begins to howl along."),
    say("child", "Granny and Auntie Lü sewed this. It's a festival dress! Red is for luck, and gold is because Granny ran out of red."),
    { mutate: (s) => giveAttire(s, "festival") },
    { anim: "hero", name: "twirl", wait: true },
    { toast: "Received the Lantern Festival Dress · Press C to change your attire" },
    { anim: "mei", name: "cheer", wait: true },
    { camera: null },
    say("heroine", "Thank you, Mei. Thank you, all of you. …Save me a dumpling?"),
    say("zhou", "Save you one? You're the guest of honour. Sit, eat, and let an old man make a very long speech."),
  ];
}

function elderScript(g: GameState): Step[] {
  const f = g.flags;
  if (!f.metElder) return originElderMeeting(g, elderGifts()) ?? discipleBriefing();
  const heart = elderHeartScript(g);
  if (heart) return heart;
  if (f.patriarchDefeated && !f.heartReturned)
    return [
      { emote: "elder", icon: "!" },
      say("heroine", "Master. The Jade Lotus Heart."),
      { anim: "hero", name: "offer", wait: true },
      { flash: "#ffd0e4" },
      say("elder", "…It blooms. In your hands, it blooms. Xue spent his life trying to force heaven's door, and you simply walked through it."),
      ...(f.metWen ? [say("heroine", "Old Fisher Wen asked me to tell you: his old teacher still fishes."), { emote: "elder", icon: "..." } as Step, say("elder", "Master Wen… alive. Hah. Heaven has a sense of humour after all.")] : []),
      ...(f.xueRedeemed ? [say("heroine", "And Xue Ming laid it down himself, Master. He's gone to Smith Ou's hill. He remembers the willow."), { anim: "elder", name: "cry", wait: true } as Step, say("elder", "…The willow. Forty years, and he remembers the willow.")] : []),
      say("elder", "The Heart will restore the spirit veins. But it chose you, Lin Yue. Cross the sky bridge behind this hall to Heavenly Tribulation Peak. There, at the peak of Spirit Severing, you may ascend."),
      { mutate: (s) => setFlag({ ...s, stones: s.stones + 200, pills: { heal: Math.min(99, s.pills.heal + 3), qi: Math.min(99, s.pills.qi + 3) } }, "heartReturned") },
      { toast: "Received 200 spirit stones and 6 pills · The sky bridge behind the Hall of Clouds opens" },
    ];
  if (f.moBroken)
    return [{ anim: "elder", name: "sweep" }, say("elder", pick(g, ["The marble remembers. So do I. Go on, Lin Yue. There is nothing here you need.", "A mortal broom is heavier than a whisk. Who knew.", f.ascended ? "The moon is red every night now. I sweep by its light." : "Heaven's door is up there. You have the key you made. Use it."]))];
  if (f.ascended) return [say("elder", { ascension: "The sect's founder was the last to ascend, a thousand years ago. Now there are two names on the stele. I am proud of you.", rooted: "Two names on the stele, and a lotus in the valley. The founder would have laughed out loud.", guardian: "You came back down. Of course you did. The jianghu is luckier than it knows.", mortal: "A teacher in Willow Creek. Hua sends me her tea every month. It is unbearably bitter. I drink every drop.", crimson: "…" }[endingOf(f) ?? "ascension"])];
  return elderTalk(g);
}

/** The Sword Riding, the whistle and the counsel Elder Mo gives every beginning. */
function elderGifts(): Step[] {
  return [
    { anim: "elder", name: "cast", wait: true },
    { flash: "#9ff5de" },
    { mutate: (s) => setFlag(s, "metElder") },
    { toast: "Learned: Sword Riding (F) · Cloudmane's Whistle (R) · Willow Creek Village is open" },
    say("elder", "The art of Sword Riding. Press F to ride your blade. Below the sect gate a sky bridge leads down to the mortal lands, and with M your sword can carry you to any land you have opened."),
    say("elder", "And take this jade whistle. The jianghu is wide, and the roads are long. Blow it (R) and Cloudmane will come down out of the clouds to carry you — no beast on the road can catch her at a gallop."),
    say("elder", "Your cultivation is still shallow. Gather herbs, defeat corrupted beasts and meditate at lotus shrines. When your qi overflows at a realm's peak, face the Heavenly Tribulation."),
  ];
}

function discipleBriefing(): Step[] {
  return [
      { face: "elder", to: "hero" },
      say("elder", "Lin Yue. You heard the bells."),
      say("heroine", "The shrine is empty, Master. Who would dare—"),
      say("elder", "The Blood Moon Sect. Their Patriarch, Xue, was once my sworn brother… before he chose the demonic path."),
      say("elder", "Without the Heart, the spirit veins of the land wither. Beasts go mad. Mortals suffer."),
      say("elder", "Word came at dawn from Willow Creek Village below: fox spirits attacking in the night. Start there. The trail of corrupted qi will lead you to Xue."),
      ...elderGifts(),
      { anim: "hero", name: "bow", wait: true },
      say("heroine", "I will bring the Heart home, Master."),
      say("elder", "Go. And Lin Yue — come back alive."),
    ];
}

function elderTalk(g: GameState): Step[] {
  const f = g.flags;
  const fate = veinFate(f);
  if (fate && !f.elderVein)
    return [
      say("elder", fate === "taken" ? "I felt the Dragonspine go dark from here, Lin Yue. I felt what you drank." : "Word has come from the south. The Dragon Vein, the three sects, and you in the middle of them."),
      say("elder", { phoenix: "Fire for the Phoenix. Yan Huo will be insufferable, and loyal to you till the stars burn out.", herb: "The vein to the soil. Bai Zhi wrote to me. She has never written to me in sixty years.", sword: "The Pavilion guards it. Ling Feng will guard it from everyone, even himself. Wise, perhaps.", shared: "To no one, and so to everyone. That is the founder's answer. I wish I had thought of it.", taken: "Xue began with one stolen jar of light. Be careful, child. Be very careful what you become." }[fate]),
      { mutate: (s) => setFlag(s, "elderVein") },
    ];
  if (!f.villageSaved) return [say("elder", "Willow Creek lies below the clouds. Go out through the sect gate and down the sky bridge.")];
  if (f.patriarchDefeated) return [say("elder", f.purged ? "Your foundation will grow back. Foundations do. Climb again, slowly this time." : "Heavenly Tribulation Peak awaits.")];
  if (g.realm >= 1 && f.serpentKingDefeated) return [say("elder", "Foundation Establishment already… Then go. Xue waits in his valley. Do not hesitate when the moment comes.")];
  return [say("elder", "Follow the corrupted qi. And do not neglect your cultivation — Xue's power is deep.")];
}

/** A line spoken by someone wearing another character's look (the folk of the jianghu share a few faces). */
const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });

/** Deterministic variety: rotate lines with play time. */
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills) % lines.length];
}

// ----------------------------------------------------------------------------- arrivals & battles
export function arrivalScript(area: AreaId, g: GameState): Step[] | null {
  const f = g.flags;
  if (area === "village" && f.heartReturned && !f.festivalSeen) return festivalScript();
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
  if (area === "marsh" && !f.marshArrived)
    return [{ mutate: (s) => setFlag(s, "marshArrived") }, say("heroine", "Mist to my knees, and lights drifting over the water… Those aren't lanterns. Keep to the boards, Lin Yue.")];
  if (area === "terraces" && !f.terracesArrived)
    return [{ mutate: (s) => setFlag(s, "terracesArrived") }, say("heroine", "Terraces of tea all the way up into the cloud. So this is where the sect's tea comes from. It smells like the morning.")];
  if (area === "desert" && !f.desertArrived)
    return [{ mutate: (s) => setFlag(s, "desertArrived") }, say("heroine", "Sand as far as the sky. And there — palms, tents, smoke. An oasis.")];
  if (area === "harbor" && !f.harborArrived)
    return [{ mutate: (s) => setFlag(s, "harborArrived") }, say("heroine", "Gulls, salt, sails… and past the bay the sea just pours off the edge of the world into the clouds. Hu Li would love this.")];
  if (area === "frost" && !f.frostArrived)
    return [{ mutate: (s) => setFlag(s, "frostArrived") }, say("heroine", "So cold my breath freezes… and still the monks are practising, barefoot in the snow.")];
  if (area === "valley" && !f.valleyArrived)
    return [{ mutate: (s) => setFlag(s, "valleyArrived") }, { shake: 0.5 }, say("heroine", "The air tastes of iron. Blood moon, lava rivers… Xue's altar must be at the far end."), { toast: "Find Patriarch Xue" }];
  if (area === "peak" && !f.peakArrived)
    return [{ mutate: (s) => setFlag(s, "peakArrived") }, say("heroine", "Heavenly Tribulation Peak. The clouds churn as if they're watching me.")];
  return null;
}

/** Dialogue before special fights. */
export function preBattleScript(enemy: EnemyId, key: string, g?: GameState): Step[] | null {
  if (enemy === "patriarch") return xueConfrontation(g ?? newGame(), key);
  const war = g && (warPreBattle(enemy, g) ?? roadPreBattle(enemy, g) ?? hallsPreBattle(enemy, g) ?? tiersPreBattle(enemy, g) ?? peoplesPreBattle(enemy, g));
  if (war) return war;
  const sect = sectPreBattle(enemy);
  if (sect) return sect;
  if (enemy === "serpentKing") return [{ shake: 0.4 }, say("heroine", "The Serpent King… its scales are veined with Xue's crimson qi. Forgive me — I'll purge it!")];
  return null;
}

/** Story consequences of winning a fight. */
export function victoryScript(enemy: EnemyId, key: string, area: AreaId, g: GameState, won = true): Step[] {
  const steps: Step[] = [];
  const sect = sectVictory(enemy, key, g, won);
  if (sect) return sect;
  const war = won ? (warVictory(enemy, g) ?? roadVictory(enemy, g) ?? hallsVictory(enemy, g) ?? tiersVictory(enemy, g) ?? peoplesVictory(enemy, g)) : null;
  if (war) return war;
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
    steps.push({ mutate: (s) => setFlag(s, "villageSaved") }, { emote: "hero", icon: "..." }, say("heroine", "It fled into the west, toward the forest. Its eyes cleared just before it ran…"));
    if (g.flags.metElder) steps.push({ toast: "Speak with Village Head Zhou" });
    else steps.push(say("heroine", "Red eyes, a red moon… This is beyond Granny's practice sword. It's time I climbed the sky bridge."), { toast: "Climb the sky bridge north of the village to the Azure Cloud Sect" });
  }
  if (enemy === "elderMo") return won ? elderMoVictory() : [];
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
      say("patriarch", `Impossible… heaven chose… a child of ${REALMS[g.realm]?.name ?? "Foundation"}…`),
      ...(g.flags.xueOffered
        ? [say("patriarch", "You offered… you actually offered. Tell Ou… I never drew it. Tell Mo… his brother came home… a little."), { mutate: (s: GameState) => setFlag(s, "xueForgiven") }]
        : [say("patriarch", "Mo… you were right about the Dao… after all…")]),
      { flash: "#ff2040" },
      { shake: 0.8 },
      say("narrator", "Patriarch Xue dissolves into crimson mist. Upon the altar, a lotus of pure jade light opens its petals."),
      ...(g.flags.ouMet
        ? [say("narrator", "Beneath the Heart lies a plain sword in a dusty scabbard, bright as the first frost on the paddies. Its blade has never been drawn in anger."), { mutate: (s: GameState) => setFlag(s, "dawnfrost") }, { toast: "Found Dawnfrost · Bring it to Smith Ou" }]
        : [{ mutate: (s: GameState) => setFlag(s, "dawnfrost") }]),
      ...heartFateChoice(),
    );
  return steps;
}

// ----------------------------------------------------------------------------- the final altar
export function altarScript(g: GameState): Step[] {
  if (!g.flags.heartReturned && !g.flags.moBroken) return [say("narrator", "The dais is cold and silent.")];
  if (g.flags.ascended) return [say("narrator", "Lightning-scarred marble hums faintly beneath your feet."), { meditate: true }];
  if (g.realm === FINAL_REALM - 1 && atBottleneck(g)) return [say("heroine", crimsonPath(g.flags) ? "Heaven, open your door. Or I will open it for you." : "My qi has reached its limit. It's time."), { meditate: true }];
  return [say("narrator", `The taiji dais hums. Meditating here gathers qi three times faster. (${realmLabel(g.realm, g.stage)} — the final tribulation requires the peak of Spirit Severing.)`), { meditate: true }];
}

export function endingScript(g?: GameState): Step[] {
  const f = g?.flags ?? {};
  const vein = veinEpilogue(f);
  const year = yearEpilogue(f);
  const origin = originEpilogue(f);
  const epilogue = [
    ...(vein ? [vein] : []),
    ...(year ? [year] : []),
    ...(f.xueRedeemed
      ? ["On a hill in the westwood, an old man in an outer-sect robe oiled three hundred and twelve swords every morning, and on clear evenings a white-haired elder came down from the clouds to sit beside him and say nothing at all."]
      : f.xueForgiven
        ? ["On a hill in the westwood, beside a sword that was never drawn, someone left a cup of tea for Xue Ming. It was still warm."]
        : []),
    ...(origin ? [origin] : []),
    ...(g && warEpilogue(g) ? [warEpilogue(g)!] : []),
    ...(g && roadEpilogue(g) ? [roadEpilogue(g)!] : []),
    ...(g && hallsEpilogue(g) ? [hallsEpilogue(g)!] : []),
    ...(g && tiersEpilogue(g) ? [tiersEpilogue(g)!] : []),
    ...(g && peoplesEpilogue(g) ? [peoplesEpilogue(g)!] : []),
    ...(g && daoEpilogue(g) ? [daoEpilogue(g)!] : []),
  ];
  return endingSteps(g ?? newGame(), epilogue);
}
