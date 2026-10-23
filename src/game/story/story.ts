import { levelIndex, realmLabel, FINAL_REALM, atBottleneck } from "../engine/realms";
import { bump, learn, setFlag, stats, type GameState } from "../engine/state";
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
      { toast: "Learned: Sword Riding (F) · Willow Creek Village is open" },
      say("elder", "The art of Sword Riding. Press F to ride your blade. Below the sect gate a sky bridge leads down to the mortal lands, and with M your sword can carry you to any land you have opened."),
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
export function victoryScript(enemy: EnemyId, key: string, area: AreaId, g: GameState): Step[] {
  const steps: Step[] = [];
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
