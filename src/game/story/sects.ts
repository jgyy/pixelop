import { cultivationNeeded } from "../engine/realms";
import { bump, gainCultivation, heal, setFlag, stats, type GameState } from "../engine/state";
import type { EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { veinFate, type VeinFate } from "../world/caves";
import { say, type Choice, type Step } from "./script";
import { giveAttire } from "./wardrobe";
import { DEEP_ARRIVALS, deepHasNews, deepJournal, deepNpcScript, deepPreBattle, deepSignScript, deepVictory } from "./deeps";

/**
 * The three sects of the south and east, and the Dragon Vein they all want.
 * Each sect has its own trouble, and Lin Yue chooses how to settle it; each
 * choice moves the sects' regard for her and leaves its mark on the land.
 * Once two of the three are settled, the Dragonspine cracks open and the
 * sects meet over the vein, where her last choice decides whose it is.
 *
 * Standing with each sect is a counter in the save (`rep:<sect>`), and the
 * choices are story flags, so none of it needs a new save version.
 */

export const SECT_IDS = ["phoenix", "herb", "sword"] as const;
export type SectId = (typeof SECT_IDS)[number];

export const SECTS: Record<SectId, { name: string; hanzi: string; leader: string; home: string }> = {
  phoenix: { name: "Scarlet Phoenix Sect", hanzi: "赤凰门", leader: "Sect Mistress Yan Huo", home: "on its mesa in the red badlands, far to the south-east" },
  herb: { name: "Hundred Herb Valley", hanzi: "百草谷", leader: "Valley Master Bai Zhi", home: "in its ring of hills south of the Mistmarsh" },
  sword: { name: "Sword Sea Pavilion", hanzi: "剑海阁", leader: "Pavilion Master Ling Feng", home: "on its crag east of Frostveil Monastery" },
};

export const repOf = (g: GameState, sect: SectId) => g.counters[`rep:${sect}`] ?? 0;

/** How a sect regards her, from its standing. */
export function standing(rep: number): string {
  if (rep <= -2) return "Hostile";
  if (rep < 0) return "Wary";
  if (rep === 0) return "Neutral";
  if (rep < 3) return "Friendly";
  return "Allied";
}

/** Raise (or lower) a sect's regard; flags mark the sects that turn hostile or swear alliance. */
export function addRep(g: GameState, sect: SectId, by: number): GameState {
  const next = bump(g, `rep:${sect}`, by);
  const r = repOf(next, sect);
  return { ...next, flags: { ...next.flags, [`hostile:${sect}`]: r <= -2, [`allied:${sect}`]: r >= 3 } };
}

const rep = (sect: SectId, by: number): Step => ({ mutate: (s) => addRep(s, sect, by) });
const flag = (...names: string[]): Step => ({ mutate: (s) => names.reduce((a, n) => setFlag(a, n), s) });
const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });
const choose = (prompt: string, ...options: Choice[]): Step => ({ choose: options, prompt });
const cult = (k: number): Step => ({ mutate: (s) => gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * k)).state });
const stones = (n: number): Step => ({ mutate: (s) => ({ ...s, stones: Math.max(0, s.stones + n) }) });
const pills = (heal: number, qi: number): Step => ({ mutate: (s) => ({ ...s, pills: { heal: Math.min(99, s.pills.heal + heal), qi: Math.min(99, s.pills.qi + qi) } }) });

function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills) % lines.length];
}

/** Which sects' troubles she has settled. */
export const settled = (f: Record<string, boolean>): SectId[] => SECT_IDS.filter((s) => f[{ phoenix: "phxDone", herb: "herbDone", sword: "swdDone" }[s]]);

/**
 * Close a sect's quest; with the second one closed, the Dragonspine splits
 * open and the sects are summoned to the vein.
 */
function closeQuest(done: string, g: GameState): Step[] {
  const after = settled({ ...g.flags, [done]: true });
  const steps: Step[] = [flag(done)];
  if (after.length >= 2 && !g.flags.veinOpened) steps.push(...veinQuake());
  return steps;
}

export function veinQuake(): Step[] {
  return [
    { shake: 1 },
    { flash: "#9ff5de" },
    say("narrator", "The ground lurches. Far to the south, the Dragonspine groans like a waking beast, and a long crack of jade light runs down its flank."),
    flag("veinOpened"),
    { reshape: true },
    say("narrator", "Messenger cranes cross the sky from three directions at once: the Scarlet Phoenix, Hundred Herb Valley and the Sword Sea are all flying for the mountain. The Dragon Vein is open."),
    { toast: "The Dragon Vein Caverns have opened at the foot of the Dragonspine (south of the tea road) · The sects gather there" },
  ];
}

// ----------------------------------------------------------------------------- the quest journal
export interface JournalEntry {
  sect: SectId | "vein" | "rumour" | "deep";
  title: string;
  objective: string;
  done: boolean;
}

export function sectJournal(g: GameState): JournalEntry[] {
  const f = g.flags;
  const out: JournalEntry[] = [];
  // the Scarlet Phoenix: the Ember Mine
  if (f.phxMet) {
    const title = "Embers Beneath the Mesa";
    let o: string;
    if (f.phxDone) o = f["phx:fed"] ? "The burning vein feeds the Phoenix. Fire-jade for a hundred years, and the mesa's crown overflows." : "The burning vein is sealed. The miners are safe, and the Phoenix digs for what is left.";
    else if (!f.phxMine) o = "Hear out Sect Mistress Yan Huo atop the Phoenix mesa.";
    else if (!f.minersFound) o = "Enter the Ember Mine at the foot of the mesa and find the trapped miners.";
    else if (!f.wyrmDefeated) o = "Slay the Ember Wyrm at the burning vein, deep in the Ember Mine.";
    else if (!f["phx:sealed"] && !f["phx:fed"]) o = "Decide the fate of the burning vein (deep in the Ember Mine).";
    else o = "Return to Sect Mistress Yan Huo atop the mesa.";
    out.push({ sect: "phoenix", title, objective: o, done: !!f.phxDone });
  } else if (f.metZhou) out.push({ sect: "rumour", title: "Rumour: smoke over the mesa", objective: `Travellers say the ${SECTS.phoenix.name} ${SECTS.phoenix.home} has lost men in its mine.`, done: false });
  // Hundred Herb Valley: the withering
  if (f.herbAsk) {
    const title = "The Withering Garden";
    let o: string;
    if (f.herbDone) o = f["herb:drained"] ? "The valley blooms again. The black marsh pools were drained to make it so." : "The valley blooms again, and its spring runs clear.";
    else if (!f.kuDealt) o = "Find what poisons the valley's spring, down in the Sunken Grotto (its mouth is in the valley).";
    else if (!f["herb:purified"] && !f["herb:drained"]) o = "Cleanse the poisoned spring at the bottom of the Sunken Grotto.";
    else o = "Return to Valley Master Bai Zhi.";
    out.push({ sect: "herb", title, objective: o, done: !!f.herbDone });
  } else if (f.metElder) out.push({ sect: "rumour", title: "Rumour: a valley withering", objective: `${SECTS.herb.name}, ${SECTS.herb.home}, cannot grow so much as a weed this season.`, done: false });
  // the Sword Sea Pavilion: the thief
  if (f.swdMet) {
    const title = "The Thief of Ten Thousand Swords";
    const clues = [f.swdClueTang, f.swdClueStair].filter(Boolean).length;
    let o: string;
    if (f.swdDone) o = f["swd:bribed"] ? "You kept Jian Wuyou's secret for his silver. The Pavilion has not forgotten." : f["swd:exposed"] ? "Jian Wuyou was expelled. The old stair to the Sword Sea is open again." : "Jian Wuyou sweeps the old stair as penance. The way to the Sword Sea is open again.";
    else if (f["swd:exposed"] || f["swd:mercy"] || f["swd:bribed"]) o = "Report to Pavilion Master Ling Feng.";
    else if (clues < 2) o = `Find who is stealing the Pavilion's sword manuals. Ask the disciples, and look about the crag (${clues}/2 clues).`;
    else o = "Confront Jian Wuyou.";
    out.push({ sect: "sword", title, objective: o, done: !!f.swdDone });
  } else if (g.realm >= 1) out.push({ sect: "rumour", title: "Rumour: a thief among swords", objective: `The ${SECTS.sword.name} ${SECTS.sword.home} has barred its gates. Something has been stolen.`, done: false });
  // the conclave over the Dragon Vein
  if (f.veinOpened) {
    const fate = veinFate(f);
    out.push({ sect: "vein", title: "The Dragon Vein", objective: fate ? FATE_TEXT[fate] : "Go down into the Dragon Vein Caverns at the foot of the Dragonspine, where the three sects are gathering, and speak with the spirit of the vein.", done: !!fate });
  } else if (settled(f).length === 1) out.push({ sect: "rumour", title: "Rumour: the Dragonspine", objective: "Prospector Dong says the Dragonspine hums at night. Settle another sect's trouble and see what wakes.", done: false });
  // the four newer deeps
  for (const e of deepJournal(g)) out.push({ sect: "deep", ...e });
  return out;
}

const FATE_TEXT: Record<VeinFate, string> = {
  phoenix: "The Dragon Vein burns for the Scarlet Phoenix. A crater smokes on the Dragonspine.",
  herb: "The Dragon Vein feeds Hundred Herb Valley. The Dragonspine has turned green.",
  sword: "The Sword Sea Pavilion guards the Dragon Vein. A sword of stone stands on the mountain.",
  shared: "The Dragon Vein belongs to no one, and a spring runs from the Dragonspine for everyone.",
  taken: "You drank the Dragon Vein dry. The Dragonspine is ash, and the sects will not forget.",
};

/** The sect objective most worth showing under the quest tracker. */
export function sectObjective(g: GameState): string | null {
  const open = sectJournal(g).filter((e) => !e.done && e.sect !== "rumour");
  if (!open.length) return null;
  const e = open.find((x) => x.sect === "vein") ?? open[0];
  return `${e.title}: ${e.objective}`;
}

// ----------------------------------------------------------------------------- who has something to say
export function sectHasNews(key: string, g: GameState): boolean | null {
  const f = g.flags;
  switch (key) {
    case "yanhuo":
      return !f.phxMet || (!!(f["phx:sealed"] || f["phx:fed"]) && !f.phxDone) || (!!f["allied:phoenix"] && !f["attire:phoenix"]);
    case "tie":
    case "ahshi":
      return !f.minersFound;
    case "baizhi":
      return !f.herbAsk || (!!(f["herb:purified"] || f["herb:drained"]) && !f.herbDone);
    case "kushen":
      return !f.kuDealt;
    case "lingfeng":
      return !f.swdMet || (!!(f["swd:exposed"] || f["swd:mercy"] || f["swd:bribed"]) && !f.swdDone);
    case "tangyu":
      return !!f.swdMet && !f.swdClueTang;
    case "wuyou":
      return !!f.swdClueTang && !!f.swdClueStair && !f.swdDone && !f["swd:exposed"] && !f["swd:mercy"] && !f["swd:bribed"];
    case "longlao":
      return !!f.veinOpened && !veinFate(f);
    case "zhuque":
    case "phxchi":
    case "phxluo":
    case "tie2":
    case "ahshi2":
    case "minerWei":
    case "minerB":
    case "zhuque2":
    case "linger":
    case "herbHan":
    case "kushen2":
    case "wuyouSweep":
    case "rubing":
    case "wuyouHarbor":
    case "dong":
    case "yanhuoV":
    case "baizhiV":
    case "lingfengV":
      return false;
    default:
      return deepHasNews(key, g);
  }
}

// ----------------------------------------------------------------------------- conversations
export function sectNpcScript(key: string, g: GameState): Step[] | null {
  const f = g.flags;
  switch (key) {
    case "yanhuo":
      return yanHuo(g);
    case "zhuque":
      return [named("phoenix", "Disciple Zhu Que", pick(g, [f.phxDone ? "Mistress Yan says you're stubborn. From her, that's practically a poem." : "The Mistress hasn't slept since the mine fell in. Don't tell her I told you.", "Fire-jade burns in your hand if your heart is false. Mine just tickles.", "I can make a flame the size of a melon. Disciple Chi can only make a plum. He disputes this."])), { anim: "zhuque", name: "flame" }];
    case "phxchi":
      return [named("phoenix", "Disciple Chi Yan", pick(g, ["Hah! Hyah! …Sorry, I'm practising being frightening.", f["hostile:phoenix"] ? "The Mistress says you are not welcome here. I say you have nice sleeves. Both things are true." : "Our sect came from the sun, the elders say. I came from a pig farm. We all have to start somewhere.", "The mesa's crown is a lava pool. We cook eggs in it. Don't tell the elders."]))];
    case "phxluo":
      return [named("phoenix", "Disciple Luo Huo", pick(g, ["I keep the torches lit. Every one. Even in the day. It's tradition and I'm afraid to stop.", "From up here you can see the Yellow Sands turn gold at dusk. Worth the stairs.", "Old Tie was digging in the mine for forty years before any of us were born. If anyone gets out of that cave-in, it's him."]))];
    case "tie":
    case "ahshi":
      return trappedMiners(g, key);
    case "tie2":
      return [named("miner", "Old Tie", pick(g, [f["phx:sealed"] ? "Sealed it, did you? The rock's cool for the first time in forty years. My knees thank you." : "The vein's roaring louder every night. Good for the Phoenix's coffers. I've stopped going down past the rails.", "You came for us when nobody else would. Old Tie doesn't forget.", "My first pick is still down there. I'll go back for it when I'm brave. Or drunk."])), { anim: "tie2", name: "drink" }];
    case "ahshi2":
      return [named("miner", "Miner Ah Shi", f.shiBurned ? "The burns will scar, the doctors say. I'd rather have scars than be ash. Thank you for coming back for us." : pick(g, ["I owe you my life. I'll pay it back in fire-jade. Slowly. Very slowly.", "Old Tie says you fight like a falling mountain. He says that about everyone, but he meant it this time."]))];
    case "minerWei":
      return [named("villagerM", "Miner Wei", pick(g, ["Surface seams only for me, thanks. The deep rock talks back.", "The mesa's red because it's full of fire, the Mistress says. I think it's rust.", "We send the carts down to the sands in summer. The caravans pay in salt and gossip."])), { anim: "minerWei", name: "mine" }];
    case "minerB":
      return [named("miner", "Miner Lao Gou", pick(g, ["Back to work! The wyrm's gone, and the jade won't dig itself.", "Mind the rails. The carts don't stop for heroes."])), { anim: "minerB", name: "mine" }];
    case "zhuque2":
      return [named("phoenix", "Disciple Zhu Que", "The vein burns brighter every day. The Mistress says we'll dig for a hundred years. I say we'll be cooked in ten. We'll see who's right."), { anim: "zhuque2", name: "flame" }];
    case "baizhi":
      return baiZhi(g);
    case "linger":
      return [named("herbalist", "Ling'er", pick(g, [f.herbDone ? "Everything's growing! I planted moon-mint upside down and even that's growing!" : "The ginseng died first. Then the lotus. Then the weeds, and nothing kills weeds.", "Master Bai can tell a herb's age by smelling it. She can tell mine too. It's rude.", "Senior Brother Ku used to teach me. Then he was sent away. Nobody will say why."])), { anim: "linger", name: "gather" }];
    case "herbHan":
      return [named("villagerM", "Herbalist Han", pick(g, ["Three hundred kinds of herb in this valley, and three hundred ways to die from them. Read the labels.", f["herb:drained"] ? "The marsh pools are fields now. Granny Ye came by and shouted at the furnace for an hour." : "The Mistmarsh feeds our spring. When it sickens, we sicken.", "The furnace has been burning since the valley was founded. If it goes out, we have to say sorry to it."]))];
    case "kushen":
      return kuShen(g);
    case "kushen2":
      return [named("poisoner", "Herbalist Ku", pick(g, ["Pills, cultivator? Half the Alchemy Hall's price, twice the bitterness. They work.", "I'm writing the cure for the withering down properly this time. With a witness. Bai Zhi can read it when she's ready.", "You let me walk away. Most people only let me run."])), { shop: true }];
    case "lingfeng":
      return lingFeng(g);
    case "tangyu":
      if (f.swdMet && !f.swdClueTang)
        return [
          named("swordsea", "Disciple Tang Yu", "The manuals? Master's furious. Twelve gone from the library pagoda, the oldest forms first."),
          named("swordsea", "Disciple Tang Yu", "I… shouldn't say. But Senior Brother Wuyou goes down the old stair at night. The one that's been blocked for years. I thought he was meditating."),
          flag("swdClueTang"),
          { toast: "Clue: Jian Wuyou goes down the old stair at night" },
        ];
      return [named("swordsea", "Disciple Tang Yu", pick(g, ["Ten thousand swords in the sea below. Master says the sea keeps them better than we would.", "I practise until my hands bleed, then I practise more. Master says I'm improving. He says it like it hurts him.", f["swd:bribed"] ? "Someone saw Senior Brother Wuyou in a Blood Moon crescent. It can't be true." : "Wind's from the snows today. Good for the forms, bad for the fingers."]))];
    case "rubing":
      return [named("discipleF", "Disciple Ru Bing", pick(g, ["I sweep the snow off the crag every morning. By noon it's back. I've made my peace with it.", "The Pavilion takes disciples from every sect. I came from the Azure Cloud too, once. Say hello to Ah Bao for me.", "Master Ling has never lost a duel. He's also never fought one. Think about that."])), { anim: "rubing", name: "sweep" }];
    case "wuyou":
      return wuYou(g);
    case "wuyouSweep":
      return [named("swordsea", "Jian Wuyou", pick(g, ["Ten thousand steps. I'm on step four thousand. Master says when I reach the sea I can stop. I think he's lying.", "My mother's medicine came from the Pavilion's own herbalist, after all. Master paid. He didn't say a word about it.", "Thank you. For letting me be the one to say it."])), { anim: "wuyouSweep", name: "sweep" }];
    case "wuyouHarbor":
      return [named("swordsea", "Jian Wuyou", pick(g, ["I mend nets now. It's not so different from sword forms. More knots.", "Mother's cough is better. The sea air, the healer says. Or the shame of having me home.", "You did right, telling him. I hated you for a month. Now I just mend nets."])), { anim: "wuyouHarbor", name: "gather" }];
    case "dong":
      return [named("miner", "Prospector Dong", pick(g, [f.veinOpened ? "It's open! Forty years I've knocked on that rock and it opens for an earthquake. Typical." : "The Dragonspine hums at night. Put your ear to the rock. That's the vein, dreaming.", "Three sects swore never to dig here. I'm not a sect, so I dig. Very carefully.", veinFate(f) ? `Whatever you did down there, the mountain's ${veinFate(f) === "taken" ? "gone quiet. Too quiet." : "singing now."}` : "If the vein ever wakes, every sect from the sands to the snows will come running. Mark my words."])), { anim: "dong", name: "mine" }];
    case "longlao":
      return longLao(g);
    case "yanhuoV":
      return [named("yanhuo", "Yan Huo", "Fire is the oldest qi. The vein burns, it always has. Give it to those who know how to hold a flame, little cloud.")];
    case "baizhiV":
      return [named("baizhi", "Bai Zhi", "A vein is a root, child. Roots should feed the soil, not a furnace and not a sword.")];
    case "lingfengV":
      return [named("lingfeng", "Ling Feng", "Power unguarded is power stolen. The Pavilion would keep it, and keep it from everyone. Including us.")];
    default:
      return deepNpcScript(key, g);
  }
}

// ----------------------------------------------------------------------------- the Scarlet Phoenix
function yanHuo(g: GameState): Step[] {
  const f = g.flags;
  if (f["hostile:phoenix"] && f.phxDone) return [named("yanhuo", "Yan Huo", "You have taken enough from the Phoenix. Leave my mesa before my disciples remember how to be rude.")];
  if (!f.phxMet)
    return [
      named("yanhuo", "Yan Huo", "A cloud-dweller on my mesa. Has the Azure Cloud finally run out of sky?"),
      say("heroine", "I'm Lin Yue of the Azure Cloud Sect. I heard the Scarlet Phoenix lost men in its mine."),
      named("yanhuo", "Yan Huo", "Lost? Not yet. The burning vein beneath us flared three nights ago and the deep gallery came down. Old Tie and Ah Shi are behind the fall, if they're breathing."),
      named("yanhuo", "Yan Huo", "And something came up out of the vein. My disciples heard it singing. Fire that sings is not fire you send children against."),
      flag("phxMet"),
      choose(
        "How do you answer the Sect Mistress?",
        {
          label: "Bow, and offer to go down for the miners",
          hint: "The Phoenix respects courtesy (+ standing)",
          then: [{ anim: "hero", name: "salute", wait: true }, say("heroine", "Let me go down, Mistress. I don't need to be asked twice to save a life."), rep("phoenix", 1), named("yanhuo", "Yan Huo", "…Well. The clouds still grow some manners. Go, then. The mine's mouth is at the foot of the mesa.")],
        },
        {
          label: "Challenge her: “Your sect can't save its own miners?”",
          hint: "She will want to see if you can back it up",
          then: [
            say("heroine", "A sect of fire, afraid of a little singing? I'll go, since nobody up here will."),
            { emote: "yanhuo", icon: "anger" },
            named("yanhuo", "Yan Huo", "Bold. Bold is cheap. Zhu Que! Show our guest what the Phoenix is afraid of."),
            rep("phoenix", -1),
            flag("phxBold"),
            { battle: "phoenixguard", key: "phx-spar" },
          ],
        },
        {
          label: "Ask what the Phoenix will pay",
          hint: "Spirit stones when the job is done, but no warmth",
          then: [say("heroine", "And if I bring them out? The road from the clouds is long."), named("yanhuo", "Yan Huo", "A mercenary. At least you're honest. A hundred spirit stones for each miner alive. Nothing for the dead."), flag("phxPaid")],
        },
      ),
      flag("phxMine"),
      { toast: "Quest: Embers Beneath the Mesa · Find the trapped miners in the Ember Mine" },
    ];
  if ((f["phx:sealed"] || f["phx:fed"]) && !f.phxDone) {
    const paid: Step[] = f.phxPaid ? [stones(f.shiBurned ? 100 : 200), { toast: `Received ${f.shiBurned ? 100 : 200} spirit stones` }] : [];
    if (f["phx:fed"])
      return [
        { emote: "yanhuo", icon: "!" },
        named("yanhuo", "Yan Huo", "I felt it from up here. The crown of the mesa boiled over and the whole sect cheered. You gave the vein to the Phoenix."),
        named("yanhuo", "Yan Huo", "A hundred years of fire-jade. My grandmother's grandmother dreamed of this."),
        rep("phoenix", 2),
        rep("herb", -1),
        ...paid,
        named("yanhuo", "Yan Huo", "Take this. Phoenix plumage, woven with fire-jade thread. Only our own wear it. Today, you are our own."),
        { mutate: (s) => giveAttire(s, "phoenix") },
        { anim: "yanhuo", name: "flame", wait: true },
        { toast: "Received the Phoenix Plumage · The Scarlet Phoenix holds you in high regard" },
        ...closeQuest("phxDone", g),
      ];
    return [
      { emote: "yanhuo", icon: "anger" },
      named("yanhuo", "Yan Huo", "The crown of the mesa has gone cold. Cold! You sealed the burning vein."),
      say("heroine", "It was waking something that would have eaten the mesa, miners first. I'm sorry, Mistress."),
      { emote: "yanhuo", icon: "..." },
      named("yanhuo", "Yan Huo", "…My grandmother sealed a vein once. They called her a coward for twenty years and named the mine after her afterwards. Fire forgets nothing and forgives slowly."),
      ...(f.minersOut && !f.shiBurned ? [named("yanhuo", "Yan Huo", "And my miners are alive, both of them. I'll swallow my pride for that. It tastes of ash.")] : [rep("phoenix", -1)]),
      rep("herb", 1),
      ...paid,
      cult(0.3),
      { toast: "The Scarlet Phoenix will remember this, one way or the other · Cultivation rises" },
      ...closeQuest("phxDone", g),
    ];
  }
  if (f["allied:phoenix"] && !f["attire:phoenix"])
    return [named("yanhuo", "Yan Huo", "The whole mesa speaks your name, little cloud. Wear our colours. Let the badlands see whom the Phoenix calls friend."), { mutate: (s) => giveAttire(s, "phoenix") }, { toast: "Received the Phoenix Plumage" }];
  if (f.phxMine && !f.phxDone) return [named("yanhuo", "Yan Huo", f.minersOut ? "Tie and Ah Shi are out! Now the singing thing. Kill it, and then decide what you'll do with that vein. Choose like it's your own mesa." : "The mine's mouth is at the foot of the mesa, by the rails. Bring my people out.")];
  const fate = veinFate(f);
  return [named("yanhuo", "Yan Huo", pick(g, [fate === "phoenix" ? "The Dragon Vein burns for us now. You'll always have a seat by our fire." : fate ? "The vein went elsewhere. The Phoenix will fly on. We always have." : "Fire-jade, fire-silk, fire-wine. Everything up here burns, including the tempers.", "My disciples call me the Scarlet Mistress. My mother calls me Little Huo. Neither of them is afraid of me.", "You look cold. Everyone from the clouds looks cold."]))];
}

function trappedMiners(g: GameState, key: string): Step[] {
  const f = g.flags;
  if (f.minersFound) return [named("miner", key === "tie" ? "Old Tie" : "Miner Ah Shi", f.minersStay ? "We'll keep our heads down. Go on, the singing's down the far tunnel." : "Lead on, we're right behind you.")];
  return [
    { emote: key, icon: "!" },
    named("miner", "Old Tie", "Light! Ah Shi, there's a light! …And a girl with a sword. Phoenix sent a girl with a sword."),
    named("miner", "Miner Ah Shi", "There's something in the vein. It sings when it moves. It burned through the props like paper."),
    named("miner", "Old Tie", "We can walk, just about. But the tunnels back to the rails are crawling with its hounds."),
    flag("minersFound"),
    choose(
      "The miners are hurt and frightened. The thing in the vein is still awake.",
      {
        label: "Lead them out to the surface first",
        hint: "Slower, but they'll be safe (+ Phoenix standing)",
        then: [
          say("heroine", "Up, both of you. Hold onto my sash. Nobody gets left in the dark."),
          { fade: "out" },
          say("narrator", "She leads them back through the galleries, sword drawn, the hounds snarling just past the torchlight. At the mouth, the badlands' sun has never looked so bright."),
          flag("minersOut"),
          rep("phoenix", 1),
          { despawn: "tie" },
          { despawn: "ahshi" },
          { fade: "in" },
          { toast: "The miners are safe outside · Now find the burning vein" },
        ],
      },
      {
        label: "Tell them to hide here while you hunt the wyrm",
        hint: "Faster, and it ends the danger at its source, if nothing goes wrong",
        then: [say("heroine", "Stay here, out of sight. I'll end it at the vein, and then we all walk out together."), named("miner", "Old Tie", "Brave or mad. Same thing, in a mine."), flag("minersStay")],
      },
    ),
  ];
}

/** At the burning vein, once the wyrm is dead. */
export function emberVeinScript(g: GameState): Step[] {
  const f = g.flags;
  if (f["phx:sealed"]) return [say("narrator", "The crack in the rock is cold and dark. A little steam still rises from it, like breath on a winter morning.")];
  if (f["phx:fed"]) return [say("narrator", "The vein roars with liquid fire. Fire-jade grows along its edges as you watch, crackling like frost.")];
  return [
    say("narrator", "The burning vein: a crack in the rock running with liquid fire. Fire-jade grows out of it like frost on a window, and the whole cave hums with its heat."),
    say("heroine", "With the wyrm gone, the vein is quiet. But it won't stay quiet. I could close it… or open it wider."),
    choose(
      "What will you do with the burning vein?",
      {
        label: "Seal it with your own qi",
        hint: "The fire goes out: safe tunnels, little fire-jade. Yan Huo will not thank you",
        then: [{ anim: "hero", name: "cast", wait: true }, { flash: "#9ff5de" }, { shake: 0.6 }, flag("phx:sealed"), { reshape: true }, say("narrator", "Jade-green qi pours into the crack. The fire gutters, hisses and goes out. The lava hardens to black glass, groaning as it cools."), { toast: "The burning vein is sealed · Return to Yan Huo" }],
      },
      {
        label: "Feed it, and let it burn for the Phoenix",
        hint: "Fire-jade for a century, and the mesa's fire spills over the land",
        then: [{ anim: "hero", name: "flame", wait: true }, { flash: "#ff7040" }, { shake: 0.8 }, flag("phx:fed"), { reshape: true }, say("narrator", "She opens her palms and fans the vein with her own fire. It roars up to meet her. Far above, the crown of the mesa boils over and runs down the eastern cliffs."), { toast: "The burning vein blazes · Return to Yan Huo" }],
      },
      { label: "Leave it for now", then: [say("heroine", "Not yet. A choice like this deserves a clear head.")] },
    ),
  ];
}

// ----------------------------------------------------------------------------- Hundred Herb Valley
function baiZhi(g: GameState): Step[] {
  const f = g.flags;
  if (!f.herbAsk)
    return [
      { anim: "baizhi", name: "brew" },
      named("baizhi", "Bai Zhi", "Mind the beds, child. Not that there's anything in them left to trample."),
      named("baizhi", "Bai Zhi", "Hundred Herb Valley. Three hundred kinds of herb, and this spring every one of them has withered from the root up. The water from the grotto has turned bitter."),
      named("baizhi", "Bai Zhi", "Something is down there, at the source. I'm too old for caves and my disciples are too young. You look… neither."),
      flag("herbAsk"),
      say("heroine", "I'll find what's poisoning your spring, Master Bai."),
      named("baizhi", "Bai Zhi", "Take these. You'll want them where you're going."),
      pills(2, 1),
      { toast: "Quest: The Withering Garden · Received 2 Healing Pills and a Qi Pill · The Sunken Grotto's mouth is in the valley" },
    ];
  if ((f["herb:purified"] || f["herb:drained"]) && !f.herbDone) {
    const ku: Step[] = f.kuSpared
      ? [say("heroine", "It was Ku Shen, Master. I let him go. He says he was trying to cure his village's withering, and wrote you the formula."), { emote: "baizhi", icon: "..." }, named("baizhi", "Bai Zhi", "Ku Shen. My cleverest student, and my worst. He always did think the cure justified the poison. …I'll read his formula. I won't thank him for it."), rep("herb", f["herb:purified"] ? 0 : -1)]
      : [say("heroine", "It was Ku Shen, Master. He won't poison anything again."), named("baizhi", "Bai Zhi", "Ku Shen… I taught him to read his first herb label. I should have taught him to read people too."), rep("herb", 1)];
    const end: Step[] = f["herb:purified"]
      ? [named("baizhi", "Bai Zhi", "And you cleansed the spring with your own qi. I can taste it in the water: a little sweet. That will be you."), rep("herb", 2), cult(0.5)]
      : [named("baizhi", "Bai Zhi", "And the black pools of the marsh are dry fields now. The garden will drink, and the marsh spirits will go elsewhere. Granny Ye will never speak to me again. She hardly did before."), rep("herb", 1)];
    return [
      { emote: "baizhi", icon: "heart" },
      named("baizhi", "Bai Zhi", "Look! The roots are drinking. You did it, child."),
      ...ku,
      ...end,
      { reshape: true },
      named("baizhi", "Bai Zhi", "This was woven in the valley from a hundred dyes. It smells of rain on the beds. Wear it, and every herb in the jianghu will know a friend."),
      { mutate: (s) => giveAttire({ ...s, pills: { heal: Math.min(99, s.pills.heal + 3), qi: Math.min(99, s.pills.qi + 3) } }, "herbal") },
      { toast: "Received the Hundred Herb Robe and 6 pills · The valley blooms" },
      ...closeQuest("herbDone", g),
    ];
  }
  if (f.herbAsk && !f.herbDone) return [named("baizhi", "Bai Zhi", f.kuDealt ? "The poisoner is dealt with? Then the spring itself must be made clean. It's at the very bottom of the grotto." : "The grotto's mouth is at the edge of the valley, under the mossy rocks. Go carefully, the dark down there bites.")];
  const fate = veinFate(f);
  return [
    named("baizhi", "Bai Zhi", pick(g, [fate === "herb" ? "The Dragon Vein feeds the land now. I planted a seed on the Dragonspine and it came up the same morning." : "A herb is a poison that has learned manners. Remember that.", "Come and see the ginseng. It's older than Ling'er and better behaved.", f["hostile:herb"] ? "You are welcome to the valley's water. Not to its master's tea." : "Rest, child. Even immortals need tea."])),
    { mutate: (s) => heal(s, stats(s).maxHp * 0.5, stats(s).maxQi * 0.5) },
    { toast: "Bai Zhi's tea · HP and QI restored by half" },
  ];
}

function kuShen(g: GameState): Step[] {
  const f = g.flags;
  if (f.kuDealt) return [say("narrator", "…")];
  return [
    { emote: "kushen", icon: "!" },
    named("poisoner", "Ku Shen", "Visitors. From the Azure Cloud, by the sleeves. Bai Zhi must be desperate."),
    say("heroine", "You're poisoning the valley's spring."),
    named("poisoner", "Ku Shen", "I'm curing it. Slowly. My village in the marsh is dying of the same withering. I need it to spread so I can watch it work, and watch my cure work on it."),
    named("poisoner", "Ku Shen", "Bai Zhi expelled me for asking that question out loud. So I asked it quietly."),
    choose(
      "Ku Shen stands between you and the spring, fan half open.",
      {
        label: "Stop him by force",
        hint: "A fight. Bai Zhi gets her student back in chains",
        then: [say("heroine", "Your village isn't the only one in the jianghu. Stand aside, or be moved."), named("poisoner", "Ku Shen", "Always the sword with you people."), { battle: "poisoner", key: "ku-shen" }],
      },
      {
        label: "Hear him out, and let him go",
        hint: "He leaves the cure behind and wanders the roads. Bai Zhi may not forgive you",
        then: [
          say("heroine", "Write it down. All of it. The cure and the poison both. Then leave, and never come back to this spring."),
          { emote: "kushen", icon: "..." },
          named("poisoner", "Ku Shen", "…You'd trust me with that? Nobody has trusted me with anything since I was twelve."),
          { anim: "kushen", name: "kowtow", wait: true },
          named("poisoner", "Ku Shen", "Here. Every page. If you see me again, I'll be selling pills at an honest price. Probably."),
          flag("kuDealt", "kuSpared"),
          { despawn: "kushen" },
          { toast: "Ku Shen leaves the grotto · Now cleanse the poisoned spring" },
        ],
      },
    ),
  ];
}

/** At the poisoned spring, once Ku Shen is dealt with. */
export function springScript(g: GameState): Step[] {
  const f = g.flags;
  if (f["herb:purified"]) return [say("narrator", "The spring wells up clear and cold. A lotus has opened on it, which is impossible this far underground.")];
  if (f["herb:drained"]) return [say("narrator", "The spring runs thin and clean now that the marsh above is drained. Mud dries in rings around it.")];
  return [
    say("narrator", "The spring that feeds Hundred Herb Valley. Its water is black and smells of bitter almonds. Above, the marsh's dark pools seep down into it through the rock."),
    choose(
      "How will you make the water clean?",
      {
        label: "Purify it with your own qi",
        hint: "It will drain you to the dregs (HP and QI), but the marsh stays as it is",
        then: [{ anim: "hero", name: "meditate" }, { wait: 1.2 }, { flash: "#ffffff" }, { mutate: (s) => ({ ...s, hp: Math.max(1, Math.round(s.hp * 0.3)), qi: 0 }) }, flag("herb:purified"), { reshape: true }, say("narrator", "Her qi runs out into the black water like ink in reverse. The spring clears, then brightens. She sits back, empty and dizzy, and laughing."), { toast: "The spring is clean · HP and QI drained · Return to Bai Zhi" }],
      },
      {
        label: "Break the seep, and drain the marsh pools above",
        hint: "Quick and certain. The black pools become fields, and the marsh spirits lose their home",
        then: [{ anim: "hero", name: "attack", wait: true }, { shake: 0.8 }, flag("herb:drained"), { reshape: true }, say("narrator", "She cuts the seep with one stroke. Water roars away into the deep; far above, the marsh's black pools gurgle and sink into the earth."), { toast: "The marsh pools drain away · Return to Bai Zhi" }],
      },
      { label: "Leave it for now", then: [say("heroine", "Not yet. I need to think about what this costs.")] },
    ),
  ];
}

// ----------------------------------------------------------------------------- the Sword Sea Pavilion
function lingFeng(g: GameState): Step[] {
  const f = g.flags;
  if (!f.swdMet)
    return [
      { anim: "lingfeng", name: "sworddance", wait: true },
      named("lingfeng", "Ling Feng", "You climbed the long stair without stopping. Good lungs. The Azure Cloud teaches breathing, at least."),
      named("lingfeng", "Ling Feng", "I won't waste words. Twelve of the Pavilion's oldest sword manuals are gone. Someone inside these walls is selling them. To whom, I can guess: the Blood Moon's leftovers still crawl about the north."),
      named("lingfeng", "Ling Feng", "My disciples will not speak against each other to me. They might to a stranger. Find the thief."),
      flag("swdMet"),
      { toast: "Quest: The Thief of Ten Thousand Swords · Ask the disciples and look about the crag" },
    ];
  if ((f["swd:exposed"] || f["swd:mercy"] || f["swd:bribed"]) && !f.swdDone) {
    if (f["swd:exposed"])
      return [
        say("heroine", "It was Jian Wuyou, Master. He sold the manuals to pay for his mother's medicine."),
        { emote: "lingfeng", icon: "..." },
        named("lingfeng", "Ling Feng", "Wuyou. My first disciple. …Then he is my first disciple no longer. Bring him."),
        say("narrator", "Ling Feng breaks Jian Wuyou's sword across his knee in front of the whole Pavilion. Nobody speaks. The wind does."),
        rep("sword", 2),
        flag("swordStair"),
        { reshape: true },
        named("lingfeng", "Ling Feng", "The old stair to the Sword Sea was blocked so no one could slip down it. There is no one left to slip. I've had it cleared. Go down, and see what a sword is for."),
        { mutate: (s) => giveAttire(s, "swordsea") },
        cult(0.4),
        { toast: "Received the Sword Sea Blues · The stair to the Sword Sea is open · Cultivation rises" },
        ...closeQuest("swdDone", g),
      ];
    if (f["swd:mercy"])
      return [
        named("lingfeng", "Ling Feng", "Wuyou came to me before dawn and told me everything. He said you made him. He said you didn't make him at all."),
        named("lingfeng", "Ling Feng", "A thief who confesses is still a thief. A disciple who confesses is still a disciple. He'll sweep the ten thousand steps down to the Sword Sea until his hands remember why they hold a sword."),
        rep("sword", 1),
        flag("swordStair"),
        { reshape: true },
        named("lingfeng", "Ling Feng", "I had the stair cleared for his penance. You may use it too. And take this. He wanted you to have it, and I find I agree with him."),
        { mutate: (s) => giveAttire(s, "swordsea") },
        cult(0.6),
        { toast: "Received the Sword Sea Blues · The stair to the Sword Sea is open · Cultivation rises" },
        ...closeQuest("swdDone", g),
      ];
    return [
      say("heroine", "I couldn't find anyone, Master. Perhaps the manuals were misplaced."),
      { emote: "lingfeng", icon: "..." },
      named("lingfeng", "Ling Feng", "Perhaps. And perhaps Jian Wuyou vanished in the night with his bedroll and the last three manuals, and perhaps a disciple saw you count silver on the stair."),
      named("lingfeng", "Ling Feng", "I won't ask. I don't need to. The Pavilion's gates are open to you, Lin Yue. Its regard is not."),
      rep("sword", -3),
      { toast: "The Sword Sea Pavilion's regard falls · Jian Wuyou has fled to the Blood Moon" },
      ...closeQuest("swdDone", g),
    ];
  }
  if (f.swdMet && !f.swdDone) return [named("lingfeng", "Ling Feng", "Twelve manuals. One thief. The crag is not large. Look.")];
  const fate = veinFate(f);
  return [named("lingfeng", "Ling Feng", pick(g, [fate === "sword" ? "The Pavilion keeps the vein. We'll keep it so well nobody even remembers it's there. That's the point." : "A sword drawn is a question. A sword sheathed is the answer.", f["hostile:sword"] ? "You may stand on my crag. Don't expect me to share it." : "The wind up here tests everything. Tea, tempers, technique.", "My master told me the Sword Sea is ten thousand swords deep. I've never counted. Neither did he."]))];
}

function wuYou(g: GameState): Step[] {
  const f = g.flags;
  if (!(f.swdClueTang && f.swdClueStair))
    return [named("swordsea", "Jian Wuyou", pick(g, ["First disciple of the Pavilion. Busy. Excuse me.", "Master is in a mood. Best not to stand near him. Or me.", "The manuals? Terrible business. Terrible."])), { anim: "wuyou", name: "practice" }];
  return [
    say("heroine", "You go down the old stair at night, Senior Brother. And the wrapping on the nail up there has the Pavilion's seal on it."),
    { emote: "wuyou", icon: "!" },
    named("swordsea", "Jian Wuyou", "…Keep your voice down."),
    named("swordsea", "Jian Wuyou", "My mother is coughing blood in Wavecrest Harbour. The harbour doctor wanted forty silver. A man in a red hood paid sixty a manual. I told myself old forms nobody practises are just paper."),
    named("swordsea", "Jian Wuyou", "Please. I'll stop. I'll never go down the stair again. I'll give you every coin I have left."),
    flag("swdConfronted"),
    choose(
      "Jian Wuyou waits for your answer.",
      {
        label: "Take him to Ling Feng and tell the truth",
        hint: "Justice, done in the open. He will be expelled",
        then: [say("heroine", "I'm sorry for your mother. I'm not sorry for this. Come with me."), flag("swd:exposed"), { toast: "Report to Pavilion Master Ling Feng" }],
      },
      {
        label: "Tell him to confess to his master himself",
        hint: "Mercy, and a harder road for him. You must trust he'll go",
        then: [say("heroine", "Go to your master before dawn and tell him yourself. If you don't, I will."), { anim: "wuyou", name: "kowtow", wait: true }, named("swordsea", "Jian Wuyou", "…I'll go. I'll go tonight. Thank you, Junior Sister. Thank you."), flag("swd:mercy"), { toast: "Report to Pavilion Master Ling Feng" }],
      },
      {
        label: "Take his silver and keep quiet",
        hint: "120 spirit stones. The Pavilion will learn of it",
        then: [say("heroine", "Keep your voice down, then. And keep your silver coming."), stones(120), named("swordsea", "Jian Wuyou", "…You're no better than me. That's almost a comfort."), flag("swd:bribed"), { toast: "Received 120 spirit stones · Report to Pavilion Master Ling Feng" }],
      },
    ),
  ];
}

/** The scraps and scuffs at the top of the old stair. */
export function swordClueScript(g: GameState): Step[] {
  if (!g.flags.swdMet || g.flags.swdClueStair) return [say("narrator", "The old stair down the crag, heaped with fallen rock. The wind whistles through it like a flute.")];
  return [say("narrator", "Fresh scuff marks at the top of the old stair, and a scrap of oiled paper caught on a nail: the corner of a sword manual's wrapping, stamped with the Pavilion's seal."), flag("swdClueStair"), { toast: "Clue: someone has been climbing down the old stair" }];
}

// ----------------------------------------------------------------------------- the Dragon Vein
function longLao(g: GameState): Step[] {
  const f = g.flags;
  const fate = veinFate(f);
  if (!f.veinOpened && !fate)
    return [named("dragon", "Old Long", "Mm? A small cultivator, in my sleep. Go back up, little one. The vein is dreaming, and the dream is not for you. Not yet.")];
  if (fate) return [named("dragon", "Old Long", { phoenix: "It burns, it burns. I always liked a little warmth.", herb: "Roots in my beard. Mushrooms in my ears. I have never slept so well.", sword: "A sword stands over me. Nobody will dig here again. Lonely. Safe. Lonely.", shared: "The water runs out to everyone. I can hear children laughing in it.", taken: "…Small one. You took it all. I am so very tired." }[fate])];
  const r = (s: "phoenix" | "herb" | "sword") => `${standing(g.counters[`rep:${s}`] ?? 0)} with you`;
  return [
    { emote: "longlao", icon: "!" },
    named("dragon", "Old Long", "So. The one who woke the sects. Yes, I've been watching you. Through the fire in the mesa, the water in the valley, the swords in the sea. I am the vein. They call me Old Long."),
    named("yanhuo", "Yan Huo", "The Phoenix found this mountain first. Its fire is our fire."),
    named("baizhi", "Bai Zhi", "The vein feeds every root from here to the sea. Give it to the soil, where it belongs."),
    named("lingfeng", "Ling Feng", "Give it to anyone and the others will go to war. Give it to the Pavilion, and we will guard it from all of us."),
    named("dragon", "Old Long", "They will not agree. They never have. Three sects swore an oath over me four hundred years ago, and spent the next four hundred arguing about the wording. You, little cloud. You choose."),
    choose(
      "To whom does the Dragon Vein belong?",
      { label: "To the Scarlet Phoenix", hint: `Fire and fire-jade for the mesa (Phoenix: ${r("phoenix")})`, then: fateSteps("phoenix") },
      { label: "To Hundred Herb Valley", hint: `The vein feeds the soil (Herb Valley: ${r("herb")})`, then: fateSteps("herb") },
      { label: "To the Sword Sea Pavilion", hint: `Sealed and guarded by swords (Sword Sea: ${r("sword")})`, then: fateSteps("sword") },
      { label: "To no one: let it flow for everyone", hint: "No sect wins. Every sect may yet forgive you", then: fateSteps("shared") },
      { label: "To me. Drink the vein yourself", hint: "Power beyond measure, and the hatred of all three sects", then: fateSteps("taken") },
    ),
  ];
}

function fateSteps(fate: VeinFate): Step[] {
  const set: Step = { mutate: (s) => setFlag(s, `vein:${fate}`) };
  const done: Step[] = [set, { shake: 1 }, { reshape: true }];
  switch (fate) {
    case "phoenix":
      return [named("dragon", "Old Long", "Fire, then. I always liked a little warmth."), { flash: "#ff7040" }, ...done, named("yanhuo", "Yan Huo", "The Phoenix will remember this for a thousand years, Lin Yue. So will the mountain: feel it? It's breathing fire."), rep("phoenix", 3), rep("herb", -2), rep("sword", -1), named("baizhi", "Bai Zhi", "Fire never gives back what it takes, child."), { toast: "The Dragon Vein burns for the Scarlet Phoenix · A crater opens on the Dragonspine" }];
    case "herb":
      return [named("dragon", "Old Long", "Roots, then. They tickle."), { flash: "#9ff59a" }, ...done, named("baizhi", "Bai Zhi", "Listen. You can hear the seeds waking all the way up the mountain."), rep("herb", 3), rep("phoenix", -1), rep("sword", -1), named("yanhuo", "Yan Huo", "Weeds. You chose weeds over fire."), { toast: "The Dragon Vein feeds the land · The Dragonspine turns green" }];
    case "sword":
      return [named("dragon", "Old Long", "A sword over my head. Well. I've slept under worse."), { flash: "#dfe8f4" }, ...done, named("lingfeng", "Ling Feng", "No one will dig here again. Not even us. That is what guarding means."), rep("sword", 3), rep("phoenix", -1), rep("herb", -1), say("narrator", "On the mountain above, a sword of stone pushes up out of the rock and stands there, as if it always had."), { toast: "The Sword Sea guards the Dragon Vein · A stone sword rises on the Dragonspine" }];
    case "shared":
      return [named("dragon", "Old Long", "To everyone. Ha! Nobody has ever been brave enough to say it. Let it run, then."), { flash: "#9ad0ff" }, ...done, named("baizhi", "Bai Zhi", "…A spring. On the Dragonspine. Water for anyone who walks by."), named("yanhuo", "Yan Huo", "Hmph. Water. …Well. It's warm, at least."), named("lingfeng", "Ling Feng", "Then we will all have to guard it. Together. That will be new."), rep("phoenix", 1), rep("herb", 1), rep("sword", 1), { toast: "The Dragon Vein flows for everyone · A spring breaks from the Dragonspine" }];
    case "taken":
      return [
        say("heroine", "None of you. It's mine."),
        { emote: "longlao", icon: "..." },
        named("dragon", "Old Long", "…As you wish, small one."),
        { anim: "hero", name: "meditate" },
        { flash: "#ff2040" },
        ...done,
        { mutate: (s) => giveAttire(gainCultivation(s, cultivationNeeded(s.realm, s.stage) * 2).state, "dragonform") },
        say("narrator", "The vein's light pours into her until it pours out of her eyes. Above, the green Dragonspine goes grey, then black. When she opens her eyes the cavern is dark, and the three sect masters are staring at her as they once stared at Patriarch Xue."),
        // whatever they thought of her before, they fear her now
        { mutate: (s) => SECT_IDS.reduce((a, id) => addRep(a, id, Math.min(-5, -3 - repOf(a, id))), s) },
        named("lingfeng", "Ling Feng", "We have seen this before. It ended in a valley full of blood."),
        { toast: "You drank the Dragon Vein · Cultivation surges · Received the Dragon-Blood Form · Every sect turns against you" },
      ];
  }
}

// ----------------------------------------------------------------------------- battles
export function sectVictory(enemy: EnemyId, key: string, g: GameState, won: boolean): Step[] | null {
  if (won) {
    const deep = deepVictory(enemy);
    if (deep) return deep;
  }
  if (enemy === "phoenixguard")
    return won
      ? [{ anim: "zhuque", name: "salute" }, named("phoenix", "Disciple Zhu Que", "Ow. Ow! All right. You can back it up."), named("yanhuo", "Yan Huo", "Hm. The clouds have teeth after all. Go and find my miners, then."), rep("phoenix", 2), stones(40), { toast: "Received 40 spirit stones · Yan Huo's regard warms a little" }]
      : [named("phoenix", "Disciple Zhu Que", "Ha! The cloud girl falls down! …Get up. The miners don't care which of us won."), named("yanhuo", "Yan Huo", "Bold, and wrong. Go anyway. Prove the boldness, at least.")];
  if (enemy === "emberwyrm")
    return [
      flag("wyrmDefeated"),
      { shake: 0.6 },
      say("narrator", "The Ember Wyrm collapses into a river of sparks and drains back into the burning vein. The cavern hums."),
      ...(g.flags.minersStay && !g.flags.minersOut ? [flag("minersOut", "shiBurned"), say("narrator", "Old Tie and Ah Shi limp out of hiding. Ah Shi's arm is badly burned; the wyrm's last breath found their hiding place."), { despawn: "tie" }, { despawn: "ahshi" }] : []),
      { toast: "The Ember Wyrm is slain · Examine the burning vein" },
    ];
  if (enemy === "poisoner")
    return [flag("kuDealt", "kuCaptured"), named("poisoner", "Ku Shen", "Fine. Fine! Drag me back to her. She'll be so pleased to be right."), { despawn: "kushen" }, { toast: "Ku Shen is beaten and bound · Now cleanse the poisoned spring" }];
  if (enemy === "traitor") return [flag("traitorBeaten"), named("swordsea", "Jian Wuyou", "…Go on, then. Tell Master you finished what you started."), { toast: "Jian Wuyou flees north, beaten" }];
  return null;
}

/** Signs that are more than signs: places where the sect quests turn. */
export function signScript(key: string, g: GameState, text = ""): Step[] | null {
  const deep = deepSignScript(key, g, text);
  if (deep) return deep;
  if (key === "ember-vein") return emberVeinScript(g);
  if (key === "grotto-spring") return springScript(g);
  if (key === "sword-clue") return swordClueScript(g);
  return null;
}

/** The first time she goes underground into each cave. */
export function caveArrival(id: string, g: GameState): Step[] | null {
  const k = `${id}Arrived`;
  if (g.flags[k]) return null;
  const line = {
    emberMine: "It's hot enough down here to bake bread. Rails, carts, tools dropped mid-swing… and somewhere deep, something singing.",
    grotto: "Mushrooms glowing like lanterns, water dripping in the dark. And under the damp, a bitter smell, like almonds.",
    vein: "The rock itself is breathing. Every crystal in these walls is pulsing in time, like a heart.",
    ...DEEP_ARRIVALS,
  }[id];
  return line ? [flag(k), ...(DEEP_ARRIVALS[id] ? [{ anim: "hero", name: "peer", wait: true } as Step] : []), say("heroine", line)] : null;
}

/** Before special fights in the sect quests. */
export function sectPreBattle(enemy: EnemyId): Step[] | null {
  const deep = deepPreBattle(enemy);
  if (deep) return deep;
  if (enemy === "emberwyrm") return [{ shake: 0.6 }, say("heroine", "So that's what's singing. It's made of the vein's own fire…")];
  if (enemy === "traitor") return [named("swordsea", "Jian Wuyou", "You took my silver and I took their crescent. We're both what we are now. Draw.")];
  return null;
}

/** What the elder and the ending say about the vein. */
export function veinEpilogue(f: Record<string, boolean>): string | null {
  const fate = veinFate(f);
  if (!fate) return null;
  return {
    phoenix: "In the south the Dragonspine smoked, and the Scarlet Phoenix grew rich on fire-jade, and toasted her name each new year.",
    herb: "In the south the Dragonspine was green to its summit, and Hundred Herb Valley sent its first harvest to every sect, even the ones it disliked.",
    sword: "In the south a sword of stone stood over the Dragonspine, and no one ever dug there again.",
    shared: "In the south a spring ran from the Dragonspine, and three sects who had argued for four hundred years took turns keeping it clean.",
    taken: "In the south the Dragonspine stood grey and silent, and the sects told their children of the girl from the clouds who drank a mountain's heart.",
  }[fate];
}
