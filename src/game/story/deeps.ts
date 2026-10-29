import { cultivationNeeded } from "../engine/realms";
import { gainCultivation, heal, setFlag, type GameState } from "../engine/state";
import type { EnemyId } from "../engine/enemies";
import type { HumanId } from "../art/characters";
import { say, type Choice, type Step } from "./script";

/**
 * The four newer deeps, one under each corner of the jianghu, and the
 * trouble that waits at each mouth: a monk who went down to listen to the
 * ice under Frostveil, a scholar copying a buried queen's steles under the
 * Yellow Sands, a fisher boy sent diving for smugglers' pearls under the
 * harbour's headland, and, once the Blood Moon has set, the last fox it held,
 * gone to ground under the Whispering Bamboo with a hunter's little brother.
 *
 * Every step is a story flag, so none of it needs a new save version.
 */

const flag = (...names: string[]): Step => ({ mutate: (s) => names.reduce((a, n) => setFlag(a, n), s) });
const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });
const choose = (prompt: string, ...options: Choice[]): Step => ({ choose: options, prompt });
const cult = (k: number): Step => ({ mutate: (s) => gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * k)).state });
const stones = (n: number): Step => ({ mutate: (s) => ({ ...s, stones: Math.max(0, s.stones + n) }) });
const pills = (h: number, q: number): Step => ({ mutate: (s) => ({ ...s, pills: { heal: Math.min(99, s.pills.heal + h), qi: Math.min(99, s.pills.qi + q) } }) });

function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills) % lines.length];
}

const steles = (f: Record<string, boolean>) => [1, 2, 3].filter((n) => f[`tombStele${n}`]).length;

// ----------------------------------------------------------------------------- who has something to say
export function deepHasNews(key: string, g: GameState): boolean | null {
  const f = g.flags;
  switch (key) {
    case "mingjing":
      return !f.iceAsk || (!!(f["ice:returned"] || f["ice:left"]) && !f.iceDone);
    case "heng":
      return !f.hengFound;
    case "ouyang":
      return !f.tombAsk || (steles(f) === 3 && !!(f["tomb:robbed"] || f["tomb:honoured"]) && !f.tombDone);
    case "amu":
      return !f.tideAsk || (!!f.shuiSaved && !f.tideDone);
    case "shui":
      return !f.shuiFound;
    case "aqiao":
      return !f.vixenAsk || (!!f.gouSaved && !f.vixenDone);
    case "agou":
      return !f.gouFound;
    case "mingjing2":
    case "heng2":
    case "shui2":
    case "agou2":
      return false;
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------- conversations
export function deepNpcScript(key: string, g: GameState): Step[] | null {
  const f = g.flags;
  switch (key) {
    case "mingjing":
      return mingJing(g);
    case "mingjing2":
      return [named("novice", "Novice Ming Jing", pick(g, [f["ice:returned"] ? "Abbot Xuan wears the first abbot's beads at the dawn sitting now. He says they are heavier than they look." : "Brother Heng says the first abbot is still listening down there. I go and sit at the mouth sometimes, in case he has anything to say.", "Brother Heng made me promise never to go down alone. I made him promise the same. He laughed. I wasn't joking.", "The frost wolves don't come up the hollow any more. The yaks have stopped looking at it."]))];
    case "heng":
      return brotherHeng(g);
    case "heng2":
      return [named("monk", "Brother Heng", pick(g, ["I went down to hear the ice. I heard my own heart instead, very slowly. I think that was the lesson.", "My toes will never be warm again. A small price. Most of them are still there.", "Thank you for coming down for a foolish monk. The abbot says I should be grateful and quiet. I'm working on the second one."])), { anim: "heng2", name: "warmhands" }];
    case "ouyang":
      return ouYang(g);
    case "amu":
      return ahMu(g);
    case "shui":
      return littleShui(g);
    case "shui2":
      return [named("boy", "Little Shui", pick(g, [f["tide:given"] ? "Ma sold the pearl and paid every copper of the debt. Then she cried for an hour. Happy crying, she says." : "We're still poor. But I'm home, and nobody's sending me down into the dark any more.", "I can hold my breath for two hundred heartbeats. I'm never going to do it again.", "When I'm big I'm going to be a cultivator like you. Or a fisherman. Probably a fisherman."]))];
    case "aqiao":
      return ahQiao(g);
    case "agou":
      return ahGou(g);
    case "agou2":
      return [named("boy", "Ah Gou", pick(g, [f["vixen:purified"] ? "There's a white fox at the edge of the bamboo now. It watches me. Sister says it's saying thank you." : "Sister won't let me go into the bamboo by myself any more. That's fair.", "The black fox looked at me like it was sorry. Then it looked at me like it was hungry. I ran.", "I'm going to be a hunter like Sister. A hunter of rabbits. Small rabbits."]))];
    default:
      return null;
  }
}

// ----------------------------------------------------------------------------- the Icesoul Hollow
function mingJing(g: GameState): Step[] {
  const f = g.flags;
  if (!f.iceAsk)
    return [
      { emote: "mingjing", icon: "!" },
      named("novice", "Novice Ming Jing", "Elder sister! You're a cultivator, aren't you? Please, it's Brother Heng. He went down into the Icesoul Hollow three days ago and hasn't come up."),
      named("novice", "Novice Ming Jing", "A hundred years ago our first abbot walked down there to listen to the ice, and never came back. Brother Heng said he only wanted to hear what the abbot heard."),
      named("novice", "Novice Ming Jing", "And yesterday the frost wolves came up out of the hollow, white ones, with blue eyes. Something down there woke up."),
      say("heroine", "Stay up here by the mouth. I'll go down and bring him back."),
      flag("iceAsk"),
      { toast: "Quest: The Monk Who Went Down to Listen · Find Brother Heng in the Icesoul Hollow" },
    ];
  if ((f["ice:returned"] || f["ice:left"]) && !f.iceDone)
    return [
      { emote: "mingjing", icon: "heart" },
      named("novice", "Novice Ming Jing", "Brother Heng! He's walking, he's blue, but he's walking! Thank you, elder sister."),
      ...(f["ice:returned"]
        ? [named("novice", "Novice Ming Jing", "And these… the first abbot's beads. Frostveil has chanted without them for a hundred years. Abbot Xuan will not know what to say. Neither do I."), stones(60), pills(2, 2), { toast: "Received 60 spirit stones, 2 Healing Pills and 2 Qi Pills" }]
        : [named("novice", "Novice Ming Jing", "You left the beads with him? …Yes. He went down to listen. Let him keep listening. The ice is quieter for it, isn't it? I can feel it from here."), cult(0.3), { toast: "The hollow's stillness settles in you · Cultivation rises" }]),
      flag("iceDone"),
    ];
  return [named("novice", "Novice Ming Jing", f.rimeDefeated ? "Something went quiet down there, like a held breath let go. Is Brother Heng all right?" : "Brother Heng is somewhere past the frozen lake, I think. He always liked the quietest corner of any room.")];
}

function brotherHeng(g: GameState): Step[] {
  const f = g.flags;
  if (!f.hengFound)
    return [
      { emote: "heng", icon: "..." },
      named("monk", "Brother Heng", "A… a cultivator? Forgive me for not standing. My legs are listening to the ice too closely to move."),
      named("monk", "Brother Heng", "I found him, the first abbot. He sits by the frozen lake, still in the lotus seat, with his beads in his lap. And round him, asleep, a wyrm made of winter."),
      named("monk", "Brother Heng", "I began to chant for him. It woke. I ran up here and the cold followed me. Please, be careful of the lake. It does not like noise."),
      flag("hengFound"),
      { toast: "The Rime Wyrm sleeps by the frozen lake, coiled round the first abbot" },
    ];
  if (f.rimeDefeated && !(f["ice:returned"] || f["ice:left"])) return [named("monk", "Brother Heng", "It's gone? Then go to him, please. The beads… I don't know what is right. You decide. You were braver than me to reach him.")];
  if (f["ice:returned"] || f["ice:left"]) return [named("monk", "Brother Heng", "I can stand again. Slowly. Go on up, I'll follow at a monk's pace, which is the pace of a glacier.")];
  return [named("monk", "Brother Heng", "The lake is past the white wolves' den, through the ice tunnel. Please don't wake it twice.")];
}

function iceBeadsScript(g: GameState): Step[] | null {
  const f = g.flags;
  if (!f.rimeDefeated || f["ice:returned"] || f["ice:left"]) return null;
  return [
    { anim: "hero", name: "pray", wait: true },
    say("narrator", "The first abbot of Frostveil sits as he sat a hundred years ago, his bones white under a skin of ice, his hands still folded on a string of frost-white beads."),
    choose(
      "What becomes of the first abbot's beads?",
      {
        label: "Carry them up to Frostveil",
        hint: "The monastery has its relic back (stones and pills)",
        then: [{ anim: "hero", name: "holdup", wait: true }, say("heroine", "Your monastery has missed these, Abbot. I'll carry them home for you."), flag("ice:returned"), { toast: "Taken: the first abbot's prayer beads · Return to Novice Ming Jing" }],
      },
      {
        label: "Leave them in his hands",
        hint: "Let him go on listening (cultivation)",
        then: [{ anim: "hero", name: "pray", wait: true }, say("heroine", "You came down here to listen. I won't take that from you."), say("narrator", "The ice round the old monk clears a little, like breath on a window drying. The hollow is very quiet."), flag("ice:left"), { toast: "The first abbot keeps his beads · Return to Novice Ming Jing" }],
      },
    ),
    { despawn: "heng" },
  ];
}

// ----------------------------------------------------------------------------- the Tomb Beneath the Sands
function ouYang(g: GameState): Step[] {
  const f = g.flags;
  const n = steles(f);
  if (!f.tombAsk)
    return [
      named("scholar", "Scholar Ouyang", "Mind the sand, it's the oldest thing here. Older than your sect, cultivator, older than the stupa, older than the name “Yellow Sands”."),
      named("scholar", "Scholar Ouyang", "Under this dune lies Queen Ayala of the caravans, who built a road of wells from the sands to the sea. Three steles tell her story, and I have copied the first line of none of them."),
      named("scholar", "Scholar Ouyang", "The tomb guards are… still on duty, shall we say. Would you take rubbings of the three steles for me? Take nothing else. Tombs keep accounts."),
      flag("tombAsk"),
      { toast: "Quest: The Buried Queen · Copy the three steles in the Tomb Beneath the Sands" },
    ];
  if (n === 3 && (f["tomb:robbed"] || f["tomb:honoured"]) && !f.tombDone) {
    if (f["tomb:robbed"])
      return [
        named("scholar", "Scholar Ouyang", "All three! Let me read… “Let none who loved her disturb her.” And there is jade dust on your sleeve."),
        { emote: "ouyang", icon: "..." },
        named("scholar", "Scholar Ouyang", "I'll pay you for the rubbings. Scholars are paid in disappointment as a rule, so I know how it is done."),
        stones(40),
        flag("tombDone"),
        { toast: "Received 40 spirit stones · Scholar Ouyang will remember the jade" },
      ];
    return [
      named("scholar", "Scholar Ouyang", "All three, and in a fine hand! “She asked for rain, and the dunes were offended.” I have waited twenty years to read that line."),
      named("scholar", "Scholar Ouyang", "And you closed her coffin again. Then you are one who loved her, by the third stele's reckoning, and so am I. Here: my own copy of the Caravan Queen's breathing method. She crossed the sands on one breath a day, they say."),
      cult(0.45),
      stones(80),
      flag("tombDone"),
      { toast: "Received 80 spirit stones · The Caravan Queen's breathing method · Cultivation rises" },
    ];
  }
  if (n < 3) return [named("scholar", "Scholar Ouyang", `${n} of the three steles so far. The other${3 - n > 1 ? "s are" : " is"} deeper in. Mind the guards; they walk the way the dead walk, which is to say stiffly and forever.`)];
  return [named("scholar", "Scholar Ouyang", f.duneDefeated ? "The queen's coffin is open to you now, I suppose. What you do there is between you and her." : "You have all three! But something ground and grumbled under the dune when you came out. The queen's guardian, I'd guess. Be careful in the burial hall.")];
}

function tombSteleScript(key: string, g: GameState, text: string): Step[] | null {
  const n = Number(key.slice(-1));
  const f = g.flags;
  if (!f.tombAsk || f[`tombStele${n}`]) return null;
  const now = steles(f) + 1;
  return [say("narrator", text), { anim: "hero", name: "rubbing", wait: true }, flag(`tombStele${n}`), { toast: `Rubbing taken (${now}/3)${now === 3 ? " · Return to Scholar Ouyang, or see what the queen guards" : ""}` }];
}

function tombCoffinScript(g: GameState): Step[] | null {
  const f = g.flags;
  if (!f.duneDefeated || f["tomb:robbed"] || f["tomb:honoured"]) return null;
  return [
    say("narrator", "The lid of Queen Ayala's coffin has slid aside where the wyrm struck it. Inside, under a veil turned to lace by the years, a crown of green jade."),
    choose(
      "What do you do at the queen's coffin?",
      {
        label: "Take the jade crown",
        hint: "Worth a great many spirit stones",
        then: [say("heroine", "She won't need it now. The living do."), stones(180), flag("tomb:robbed"), { toast: "Received 180 spirit stones' worth of jade" }],
      },
      {
        label: "Close the lid and pour her a little water",
        hint: "She asked for rain",
        then: [{ anim: "hero", name: "offer", wait: true }, say("heroine", "You asked for rain, Your Majesty. It's only from my flask, but it's yours."), say("narrator", "Somewhere behind the coffin a stone slides back, and a little chest is set in the wall where none was."), flag("tomb:honoured")],
      },
    ),
  ];
}

// ----------------------------------------------------------------------------- the Tidevoice Cave
function ahMu(g: GameState): Step[] {
  const f = g.flags;
  if (!f.tideAsk)
    return [
      { emote: "amu", icon: "!" },
      named("fishwife", "Fishwife Ah Mu", "You there, cultivator! My boy, my Shui. His father owed money to the pearl men, and they took Shui instead, to dive for them in the Tidevoice Cave."),
      named("fishwife", "Fishwife Ah Mu", "There's a serpent in the deep pool there that keeps the pearls. Two boys from the harbour went down this year and didn't come up. Please."),
      say("heroine", "Wait here. I'll bring him back to you."),
      flag("tideAsk"),
      { toast: "Quest: The Pearl Divers · Find Little Shui in the Tidevoice Cave" },
    ];
  if (f.shuiSaved && !f.tideDone)
    return [
      { emote: "amu", icon: "heart" },
      { anim: "amu", name: "embrace", wait: true },
      named("fishwife", "Fishwife Ah Mu", "Shui! Shui, you stupid, brave boy! …Thank you. Thank you. I have nothing but fish and gratitude, and you can have all of both."),
      ...(f["tide:given"] ? [named("fishwife", "Fishwife Ah Mu", "And a pearl like a moon… With this the debt's paid twice over. Take these pills at least, the healer owes me a favour.")] : [named("fishwife", "Fishwife Ah Mu", "He says you kept the pearl. Well. You went into the dark for it, I suppose. The debt will wait; my son is home.")]),
      pills(f["tide:given"] ? 3 : 1, f["tide:given"] ? 2 : 0),
      flag("tideDone"),
      { toast: f["tide:given"] ? "Received 3 Healing Pills and 2 Qi Pills" : "Received a Healing Pill" },
    ];
  return [named("fishwife", "Fishwife Ah Mu", "The cave's mouth is under the headland, there. Mind the tide, it comes in fast and it talks.")];
}

function littleShui(g: GameState): Step[] {
  const f = g.flags;
  if (!f.shuiFound)
    return [
      { emote: "shui", icon: "!" },
      named("boy", "Little Shui", "Don't hurt me! Oh. You're not one of them."),
      named("boy", "Little Shui", "They make us dive in the deep pool for the serpent's pearls. It has the biggest one in its mouth and it never sleeps. I hid down here when they shouted for me."),
      named("boy", "Little Shui", "I can't go home without paying Pa's debt, they'll only take me again. Unless the serpent's gone. Unless the pearl's ours."),
      flag("shuiFound"),
      { toast: "The Pearl Serpent guards the deep pool at the back of the cave" },
    ];
  return [named("boy", "Little Shui", f.pearlDefeated ? "You beat it? Really? Is the big pearl still there on the rock?" : "The deep pool's back past the smugglers' camp. Don't let it see you first.")];
}

function pearlPoolScript(g: GameState): Step[] | null {
  const f = g.flags;
  if (!f.pearlDefeated || f["tide:given"] || f["tide:kept"]) return null;
  const home: Step[] = [say("narrator", "Little Shui comes running out of the dark, slips on the wet rock, gets up and runs on, up toward the light and his mother."), { despawn: "shui" }, flag("shuiSaved"), { toast: "Little Shui is on his way home · Return to Fishwife Ah Mu" }];
  return [
    say("narrator", "On the rock above the still pool, where the serpent kept it, lies a pearl the size of a fist, glowing like a small moon."),
    choose(
      "What becomes of the serpent's pearl?",
      { label: "It's Shui's family's: it pays their debt", hint: "They will never be sent diving again", then: [{ anim: "hero", name: "holdup", wait: true }, say("heroine", "This one buys a boy his freedom. That's the best price a pearl ever fetched."), flag("tide:given"), ...home] },
      { label: "Keep it", hint: "Worth 150 spirit stones", then: [say("heroine", "I'll keep this one. The boy is safe; that's what I came for."), stones(150), flag("tide:kept"), ...home] },
    ),
  ];
}

// ----------------------------------------------------------------------------- the Bamboo Root Caverns
function ahQiao(g: GameState): Step[] {
  const f = g.flags;
  if (!f.vixenAsk)
    return [
      { emote: "aqiao", icon: "!" },
      named("villagerF", "Huntress Ah Qiao", "The Blood Moon's down and the foxes in the bamboo are themselves again, everyone says. Then why did a black fox with red eyes walk past my door last night?"),
      named("villagerF", "Huntress Ah Qiao", "My little brother Ah Gou went after it with his slingshot. It went to ground in this cave, and he went in after it. I can hear him calling, very far down, and I can't find him."),
      say("heroine", "Red eyes… the crimson qi again. Stay here, I'll find him."),
      flag("vixenAsk"),
      { toast: "Quest: The Last Fox of the Blood Moon · Find Ah Gou in the Bamboo Root Caverns" },
    ];
  if (f.gouSaved && !f.vixenDone)
    return [
      { emote: "aqiao", icon: "heart" },
      { anim: "aqiao", name: "embrace", wait: true },
      named("villagerF", "Huntress Ah Qiao", "Ah Gou! Come here, you… you… come here. Thank you, sister. Thank you."),
      ...(f["vixen:purified"]
        ? [named("villagerF", "Huntress Ah Qiao", "And the fox? You drew the red out of it? A white fox went by just now, slow, like it was learning to walk. It looked at me and didn't run."), cult(0.25), stones(60)]
        : [named("villagerF", "Huntress Ah Qiao", "And the fox is dead. Good. …No, I don't know if it's good. It's done. Here, take what I'd have sold its pelt for."), stones(90)]),
      flag("vixenDone"),
      { toast: f["vixen:purified"] ? "Received 60 spirit stones · Cultivation rises" : "Received 90 spirit stones" },
    ];
  return [named("villagerF", "Huntress Ah Qiao", "He's still calling, high up and far back, I think. Hurry.")];
}

function ahGou(g: GameState): Step[] {
  const f = g.flags;
  if (!f.gouFound)
    return [
      { emote: "agou", icon: "!" },
      named("boy", "Ah Gou", "I wasn't crying. There's water on my face from the roots. …Is Sister angry?"),
      named("boy", "Ah Gou", "The black fox is down there in the red den. It has five tails. It looked at me and its eyes went from sorry to hungry. I ran up here and I can't get past it to go back."),
      flag("gouFound"),
      { toast: "The Shadow Vixen lies in the red den at the heart of the caverns" },
    ];
  return [named("boy", "Ah Gou", f.vixenDefeated ? "Is it… is it dead? It doesn't look dead. It looks tired." : "It's in the red den. Please don't let it look at me again.")];
}

function vixenDenScript(g: GameState): Step[] | null {
  const f = g.flags;
  if (!f.vixenDefeated || f["vixen:purified"] || f["vixen:slain"]) return null;
  const home: Step[] = [say("narrator", "Ah Gou edges past the den, then runs, up toward the light and his sister."), { despawn: "agou" }, flag("gouSaved"), { toast: "Ah Gou is on his way home · Return to Huntress Ah Qiao" }];
  return [
    say("narrator", "The Shadow Vixen lies curled where she fell. The crimson qi seeps out of her like smoke from a doused fire, and under the soot her fur is white at the roots."),
    choose(
      "What becomes of the last fox of the Blood Moon?",
      {
        label: "Draw the crimson qi out of her",
        hint: "It will drain your qi to nothing",
        then: [{ anim: "hero", name: "cast", wait: true }, { flash: "#ff2a40" }, { mutate: (s) => heal(s, 0, -99999) }, say("narrator", "The red pours out of her into Lin Yue's palms and burns away to nothing. What is left on the moss is a small white fox, very tired, very much alive."), flag("vixen:purified"), ...home],
      },
      {
        label: "End it",
        hint: "The Blood Moon's last remnant dies with her",
        then: [{ anim: "hero", name: "attack", wait: true }, say("narrator", "The crimson qi goes out of the world with her last breath. The roots overhead stop glowing red."), cult(0.4), flag("vixen:slain"), ...home],
      },
    ),
  ];
}

// ----------------------------------------------------------------------------- signs, battles, arrivals, the journal
export function deepSignScript(key: string, g: GameState, text: string): Step[] | null {
  if (key === "icesoul-beads") return iceBeadsScript(g);
  if (key.startsWith("tomb-stele-")) return tombSteleScript(key, g, text);
  if (key === "tomb-coffin") return tombCoffinScript(g);
  if (key === "tide-pearl-pool") return pearlPoolScript(g);
  if (key === "roots-den") return vixenDenScript(g);
  return null;
}

export const DEEP_ARRIVALS: Record<string, string> = {
  icesoul: "My breath freezes before it leaves my lips. The ice in the walls is blue all the way down, and it hums, very softly, like a held note.",
  sandtomb: "Sand pours through the cracks in the roof like water through a sieve. Lamps that should have gone out a thousand years ago are still burning.",
  tidecave: "The sea comes in under the headland and whispers round the rocks. It sounds like voices, talking just too quietly to hear.",
  bambooroots: "The bamboo's roots hang through the roof, glowing where the qi runs in them. And down there, the smell of soot and old blood.",
};

export function deepPreBattle(enemy: EnemyId): Step[] | null {
  if (enemy === "rimewyrm") return [{ shake: 0.4 }, say("heroine", "It's coiled round him like a mother round a child. I'm sorry. I'll be quick.")];
  if (enemy === "dunewyrm") return [say("heroine", "The queen's guardian. I haven't come to rob her, wyrm. …Not yet decided, anyway.")];
  if (enemy === "pearlwyrm") return [say("heroine", "So you're the one who keeps the pearls, and the boys who dive for them.")];
  if (enemy === "shadowvixen") return [{ flash: "#ff2a40" }, say("heroine", "The Blood Moon's last ember… Patriarch Xue is gone. There's nothing left for you to serve.")];
  return null;
}

export function deepVictory(enemy: EnemyId): Step[] | null {
  if (enemy === "rimewyrm") return [flag("rimeDefeated"), { shake: 0.5 }, say("narrator", "The Rime Wyrm shatters into a drift of snow that settles softly over the frozen lake."), { toast: "The Rime Wyrm is gone · Kneel by the first abbot at the lake's edge" }];
  if (enemy === "dunewyrm") return [flag("duneDefeated"), say("narrator", "The Dune Wyrm sinks back into the sand it came from, and the burial hall falls still."), { toast: "The queen's guardian rests · Look to Queen Ayala's coffin" }];
  if (enemy === "pearlwyrm") return [flag("pearlDefeated"), say("narrator", "The Pearl Serpent slides back into the deep pool and does not come up again. The smugglers' shouting has stopped."), { toast: "The Pearl Serpent is beaten · Its pearl lies on the rock above the pool" }];
  if (enemy === "shadowvixen") return [flag("vixenDefeated"), say("narrator", "The Shadow Vixen falls, and does not get up. Her five tails lie still on the scorched moss."), { toast: "The Shadow Vixen is beaten · Go to her in the den" }];
  return null;
}

export interface DeepEntry {
  title: string;
  objective: string;
  done: boolean;
}

export function deepJournal(g: GameState): DeepEntry[] {
  const f = g.flags;
  const out: DeepEntry[] = [];
  if (f.iceAsk) {
    const o = f.iceDone ? (f["ice:returned"] ? "Brother Heng is home, and Frostveil has its first abbot's beads again." : "Brother Heng is home. The first abbot keeps his beads, and goes on listening.") : !f.hengFound ? "Find Brother Heng in the Icesoul Hollow, below Frostveil." : !f.rimeDefeated ? "Defeat the Rime Wyrm by the frozen lake in the Icesoul Hollow." : !(f["ice:returned"] || f["ice:left"]) ? "Kneel by the first abbot's bones at the frozen lake." : "Return to Novice Ming Jing at the hollow's mouth.";
    out.push({ title: "The Monk Who Went Down to Listen", objective: o, done: !!f.iceDone });
  }
  if (f.tombAsk) {
    const n = steles(f);
    const o = f.tombDone ? (f["tomb:robbed"] ? "You took the queen's jade. Scholar Ouyang paid for the rubbings, and said little." : "Queen Ayala sleeps again, and Scholar Ouyang has her story.") : n < 3 ? `Take rubbings of the three steles in the Tomb Beneath the Sands (${n}/3).` : !f.duneDefeated ? "Face the queen's guardian in the burial hall." : !(f["tomb:robbed"] || f["tomb:honoured"]) ? "Decide what to do at Queen Ayala's coffin." : "Return to Scholar Ouyang at the tomb's mouth.";
    out.push({ title: "The Buried Queen", objective: o, done: !!f.tombDone });
  }
  if (f.tideAsk) {
    const o = f.tideDone ? "Little Shui is home with his mother." : !f.shuiFound ? "Find Little Shui in the Tidevoice Cave under the harbour's headland." : !f.pearlDefeated ? "Defeat the Pearl Serpent in the deep pool." : !f.shuiSaved ? "Decide what becomes of the serpent's pearl." : "Return to Fishwife Ah Mu.";
    out.push({ title: "The Pearl Divers", objective: o, done: !!f.tideDone });
  }
  if (f.vixenAsk) {
    const o = f.vixenDone ? (f["vixen:purified"] ? "The last fox of the Blood Moon is white again, and Ah Gou is home." : "The last fox of the Blood Moon is dead, and Ah Gou is home.") : !f.gouFound ? "Find Ah Gou in the Bamboo Root Caverns." : !f.vixenDefeated ? "Defeat the Shadow Vixen in her red den." : !f.gouSaved ? "Decide what becomes of the Shadow Vixen." : "Return to Huntress Ah Qiao.";
    out.push({ title: "The Last Fox of the Blood Moon", objective: o, done: !!f.vixenDone });
  }
  return out;
}
