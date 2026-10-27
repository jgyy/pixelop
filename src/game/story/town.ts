import { atBottleneck, realmLabel, REALMS } from "../engine/realms";
import { CULT, failedTribulations, foundationWound, heartDemons, insight, insightNeeded, shift, toxicity } from "../engine/cultivation";
import { DAOS, dominantDao, walkDao } from "../engine/dao";
import { heal, stats, type GameState } from "../engine/state";
import type { HumanId } from "../art/characters";
import type { Step } from "./script";

/**
 * The folk of the Golden River country: Jinhe's streets, Reedwater Landing
 * and the Camel Bell Caravanserai. A city sees more cultivators than a
 * village, and has opinions about every one of them, so nearly everyone here
 * answers to her realm, her Dao, her failures and her condition.
 */

const named = (who: HumanId, name: string, text: string): Step => ({ say: who, name, text });

/** Deterministic variety: rotate lines with play time. */
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills) % lines.length];
}

/** Lines by her realm: Qi Condensation, Foundation, Core, and Nascent Soul or beyond. */
const byRealm = (g: GameState, lines: [string, string, string, string]) => lines[Math.min(3, g.realm)];

const once = (flag: string): Step => ({ mutate: (s) => ({ ...s, flags: { ...s.flags, [flag]: true } }) });

/** The rival's own cultivation: Foundation Establishment, late stage. */
const RIVAL_LEVEL = { realm: 1, stage: 2 };

export function townNpcScript(key: string, g: GameState): Step[] | null {
  const f = g.flags;
  const realm = REALMS[g.realm];
  const dao = dominantDao(g);
  switch (key) {
    case "magistrate":
      return [
        named("scholar", "Magistrate Lu", byRealm(g, [
          "Another wandering cultivator. Read the notice at the gate: no flying swords over the market, no duels on the square. Jinhe has laws, young lady, even for your kind.",
          "Foundation Establishment, my clerk tells me. Then you will understand why the city has laws for cultivators: a careless one of your strength could flatten the fish market.",
          "A Core Formation cultivator in my yamen… Please, sit. Tea! Bring tea! The good tea, you fool. Forgive me, immortal, the city is honoured.",
          `${realm.name}. I have read about cultivators of your realm in the histories. They usually appear just before something terrible. Is something terrible about to happen? Please say no.`,
        ])),
        ...(f.jinheSaved ? [] : g.realm >= 2 ? [named("scholar", "Magistrate Lu", "If you would — the river pirates on the caravan road grow bolder. A cultivator of your standing need only be seen there. I can offer the city's thanks, and the city's silver."), { mutate: (s: GameState) => ({ ...s, stones: s.stones + 60, flags: { ...s.flags, jinheSaved: true } }) } as Step, { toast: "Magistrate Lu presses 60 spirit stones on you for the city's peace" } as Step] : []),
      ];
    case "constable":
      return [named("guard", "Constable Tie Shan", byRealm(g, [
        "Move along, move along. Cultivator or not, you queue at the noodle stall like everyone else.",
        "Foundation, eh? Then if there's a brawl, you're on my side. That's not a request. …It's a little bit of a request.",
        "I'll walk ahead of you, immortal, and clear the street. No, no — it's an honour. And it stops the crowds following you.",
        "The crowd parts for you before I can even shout. I'm out of a job when you're in town.",
      ]))];
    case "gateguardN":
    case "gateguardS": {
      const n = key === "gateguardN" ? "Gate Guard Wu" : "Gate Guard Pan";
      if (heartDemons(g) > 60) return [{ emote: key, icon: "!" }, named("guard", n, "Halt — no, sorry, go on, go on. Your eyes, miss. For a moment I thought… never mind. Go on in.")];
      return [named("guard", n, byRealm(g, [
        "Name? Lin Yue. Business? Cultivating. Weapons? …One sword. Fine. Through you go.",
        "Foundation Establishment cultivators sign the ledger. There. Lovely handwriting. Through you go.",
        "No need to sign, immortal. No need at all. We'll just — open the gate wider. There.",
        "We were told to bow when you pass. I'm bowing. Pan's bowing. Even the dog's bowing.",
      ]))];
    }
    case "alchemist": {
      const tox = toxicity(g);
      const warn: Step[] =
        tox >= 60
          ? [{ emote: key, icon: "!" }, named("herbalist", "Alchemist Hu Mei", `Oh no. No, no. Your skin has the pill-sheen — your toxicity's at ${tox}. I won't sell you another pill until you've meditated some of that out. A qi deviation in my shop would wreck the stock.`)]
          : tox >= 25
            ? [named("herbalist", "Alchemist Hu Mei", `Your dan poison's at about ${tox}, by the colour of your nails. Pills are a loan against your own body, you know. I sell them, I don't have to like it.`)]
            : [];
      if (tox >= 60) return warn;
      return [
        ...warn,
        named("herbalist", "Alchemist Hu Mei", byRealm(g, [
          "Healing pills, qi pills, fresh from the furnace! Every pill leaves a little poison in the meridians, mind. Sit at a shrine afterwards and let it burn off.",
          "Foundation-level customers get the good furnace. Same price. Don't tell the others.",
          "A golden core! Your body holds pill-poison longer now. Buy fewer, meditate more. That's the best advice you'll get for free in this city.",
          "Immortal, my pills are like water to you now. But even water can drown you. Mind the poison.",
        ])),
        { shop: true },
      ];
    }
    case "physician": {
      const s = stats(g);
      const crack = foundationWound(g);
      const pulse = [crack ? `your foundation is cracked (${crack}%) — that is a tribulation's work, and only stillness mends it` : "your foundation is sound", toxicity(g) >= 25 ? `there is pill poison in your blood (${toxicity(g)})` : "your blood is clean", heartDemons(g) >= 20 ? `and your heart is beating to someone else's drum — demons, ${heartDemons(g)} of them by my count` : "and your heart is steady"];
      return [
        named("medic", "Physician Zhang", `Give me your wrist. …Hm. ${pulse[0]}; ${pulse[1]}; ${pulse[2]}.`),
        ...(g.hp < s.maxHp ? [named("medic", "Physician Zhang", "I can at least bind what's bleeding. Hold still."), { anim: "hero", name: "sit", wait: true } as Step, { mutate: (st: GameState) => heal(st, 9999, 0) } as Step, { toast: "Physician Zhang binds your wounds · HP restored" } as Step] : []),
        ...(crack > 0 && !f[`jinheNeedles:${failedTribulations(g)}`]
          ? [named("medic", "Physician Zhang", "And for the cracks: needles. They will not mend the foundation, but they will stop it splintering further while you sit."), { mutate: (st: GameState) => shift({ ...st, flags: { ...st.flags, [`jinheNeedles:${failedTribulations(st)}`]: true } }, CULT.wound, -15) } as Step, { toast: "Needles steady your cracked foundation · 根基 −15" } as Step]
          : []),
      ];
    }
    case "fortune": {
      const stuck = atBottleneck(g) && g.realm >= 1 && insight(g) < insightNeeded(g.realm) && !f[`ptr:fortune:${g.realm}`];
      if (stuck)
        return [
          { emote: key, icon: "..." },
          named("storyteller", "Fortune-Teller Ma", "Sit, sit. The sticks say… your qi is a full river with nowhere to go. You're looking at the dam. Stop looking at the dam. Look at the sea it's trying to reach."),
          { anim: "hero", name: "think", wait: true },
          { mutate: (s) => shift({ ...s, flags: { ...s.flags, [`ptr:fortune:${s.realm}`]: true } }, CULT.insight, 1) },
          { toast: `Strange words open something in you · Insight ${Math.min(insight(g) + 1, insightNeeded(g.realm))}/${insightNeeded(g.realm)}` },
        ];
      const fate = failedTribulations(g) > 0 && foundationWound(g) > 0
        ? "The sticks fell crossed. Heaven threw you down once already. It will try again. Next time, go up clean: no poison in you, no demons on your back, nothing owing."
        : dao
          ? `The sticks say: ${DAOS[dao].creed} …You knew that. They say it anyway. Sticks are like that.`
          : byRealm(g, [
              "The sticks say you'll go a long way. Everyone's sticks say that. Yours say it louder.",
              "A foundation laid on sand or stone? The sticks won't tell me. They're cowards.",
              "A golden core. The sticks are standing on end. I've never seen that. Keep your money — this one's on me.",
              "I won't read for you. The sticks get too hot. Last time one caught fire.",
            ]);
      return [named("storyteller", "Fortune-Teller Ma", fate)];
    }
    case "operaYu":
    case "operaHong": {
      const verseFlag = `ballad:${g.realm}:${failedTribulations(g)}`;
      const verse = failedTribulations(g) > 0 && foundationWound(g) > 0
        ? "♪ Heaven's fire struck the jade-robed girl, and down she fell like rain — / but rain goes up again as cloud, and so will she again! ♪"
        : g.realm === 0
          ? "♪ A girl came down from the floating sect with a sword too big for her hand… ♪ Oh, it's you! We're still writing the rest."
          : `♪ ${["", "She laid her foundation on the mountain's bones", "She swallowed lightning and it turned to gold", "A second soul was born behind her eyes", "She cut the threads that tie us to the earth", "She climbed heaven's stair and looked back down at us"][g.realm]}${dao ? `, and walked the ${DAOS[dao].name.replace("Dao of ", "road of ")}` : ""}… ♪`;
      const name = key === "operaYu" ? "Opera Singer Yu" : "Opera Singer Hong";
      const who: HumanId = key === "operaYu" ? "lady" : "discipleF";
      return [
        { anim: key, name: key === "operaYu" ? "twirl" : "sworddance" },
        named(who, name, f[verseFlag] ? pick(g, ["We sing the Ballad of Lin Yue twice nightly now. The crowds are enormous. Don't come to the evening show, you'll cause a riot.", "Is it true you once fought a fox? We need a fox for the second act. Hong refuses to wear the tail.", "Bring us a new verse, immortal. Break through something. Anything!"]) : `A new verse for the Ballad of Lin Yue! Listen: ${verse}`),
        ...(f[verseFlag] ? [] : [once(verseFlag), { toast: "The opera of Jinhe sings of you" } as Step]),
      ];
    }
    case "rival": {
      const above = g.realm > RIVAL_LEVEL.realm || (g.realm === RIVAL_LEVEL.realm && g.stage > RIVAL_LEVEL.stage);
      const level = realmLabel(RIVAL_LEVEL.realm, RIVAL_LEVEL.stage);
      if (!above)
        return [named("swordsea", "Shangguan Yan", g.realm === RIVAL_LEVEL.realm ? `${realmLabel(g.realm, g.stage)}? Hm. You're catching up. I'm ${level}. Don't think the gap closes by itself.` : `An Azure Cloud disciple, still at ${realm.name}? I'm ${level}, and I'm the weakest of my brothers. Go home and cultivate, little sister.`)];
      if (!f.rivalHumbled)
        return [
          { emote: key, icon: "!" },
          named("swordsea", "Shangguan Yan", `You — ${realmLabel(g.realm, g.stage)}?! Last season you were nothing. …I spoke out of turn before. Forgive me. Would you — would you point out what's wrong with my sword form?`),
          {
            choose: [
              { label: "Correct his form", hint: "The Sword's way · he will remember it", then: [{ anim: "hero", name: "sworddance", wait: true }, named("swordsea", "Shangguan Yan", "…Oh. Oh. The wrist. It was always the wrist. Thank you, senior."), { mutate: (s: GameState) => ({ ...walkDao(s, "sword", 1), flags: { ...s.flags, rivalHumbled: true } }) }] },
              { label: "Tell him to be kinder to juniors", hint: "Compassion's way", then: [named("heroine", "Lin Yue", "Your form is fine. The way you speak to people who are behind you is not."), named("swordsea", "Shangguan Yan", "…That's fair. That is fair. I'll apologise to the juniors."), { mutate: (s: GameState) => ({ ...walkDao(s, "mercy", 1), flags: { ...s.flags, rivalHumbled: true } }) }] },
              { label: "Say nothing, and walk on", hint: "Heaven's Balance", then: [named("swordsea", "Shangguan Yan", "…I see. Even the silence is a lesson. Thank you, senior."), { mutate: (s: GameState) => ({ ...walkDao(s, "balance", 1), flags: { ...s.flags, rivalHumbled: true } }) }] },
            ],
            prompt: "Shangguan Yan waits, head bowed",
          },
        ];
      return [named("swordsea", "Shangguan Yan", pick(g, ["Senior! I've been practising. The wrist. Always the wrist.", "My brothers don't believe I bowed to an Azure Cloud girl. I told them they'd bow too.", `${realm.name}… I'll get there. Maybe. Some day. Watch for me.`]))];
    }
    case "recruiter":
      return [named("discipleF", "Recruiter Mei", byRealm(g, [
        "The Golden Pavilion Sect is recruiting! Do you have spiritual roots? …You do? Wonderful! Oh, you're already in a sect. Never mind.",
        "Foundation Establishment! The Pavilion would make you an inner disciple on the spot. And pay you! No? Loyalty. How tiresome. How admirable.",
        "A Core Formation cultivator walking around unrecruited! The Pavilion would make you an elder. With a hall! With a garden! …I'm not allowed to offer the garden, actually.",
        "I've been told not to bother you. I've been told that by three separate sects. I'm bothering you anyway. Golden Pavilion? Please?",
      ]))];
    case "beggar":
      if (!f.beggarAnswered)
        return [
          named("refugeeM", "Old Ding the Beggar", "A coin for an old man, cultivator? I was a cultivator once. Qi Condensation, third stage. Swallowed too many pills chasing the fourth. Now look at me."),
          {
            choose: [
              { label: "Give him ten spirit stones", hint: "Compassion · −10 stones", then: [{ mutate: (s: GameState) => ({ ...walkDao(s, "mercy", 1), stones: Math.max(0, s.stones - 10), flags: { ...s.flags, beggarAnswered: true } }) }, named("refugeeM", "Old Ding the Beggar", "Ten! Heaven bless you. Here — a word for a word: never chase a stage with pills. Sit with it. I didn't, and here I am.")] },
              { label: "Ask what happened to him", hint: "Learn from his fall", then: [{ mutate: (s: GameState) => ({ ...s, flags: { ...s.flags, beggarAnswered: true } }) }, named("refugeeM", "Old Ding the Beggar", "The poison built up and one night my qi ran backwards. Burnt half my meridians. A qi deviation. If your hands ever go cold while you're sitting, girl, stand up and walk away.")] },
              { label: "Walk past", hint: "", then: [{ mutate: (s: GameState) => ({ ...s, flags: { ...s.flags, beggarAnswered: true } }) }] },
            ],
          },
        ];
      return [named("refugeeM", "Old Ding the Beggar", toxicity(g) >= 40 ? "You've the pill-sheen on you, girl. I know it. I had it. Go and sit. Go and sit." : pick(g, ["Bless you, cultivator.", "The constable lets me sleep in the gatehouse when it rains. He's a good man under the shouting.", "Still sitting with it, are you? Good girl."]))];
    case "academy": {
      const flag = `ptr:academy:${g.realm}`;
      if (g.realm >= 1 && atBottleneck(g) && insight(g) < insightNeeded(g.realm) && !f[flag])
        return [
          named("archivist", "Academy Master Kong Wen", "The classics have a passage for your trouble. “The great square has no corners; the great vessel is finished last.” You are a vessel not yet finished. That is not a failure. It is a description."),
          { anim: "hero", name: "read", wait: true },
          { mutate: (s) => shift({ ...s, flags: { ...s.flags, [flag]: true } }, CULT.insight, 1) },
          { toast: `The classics deepen your understanding · Insight ${Math.min(insight(g) + 1, insightNeeded(g.realm))}/${insightNeeded(g.realm)}` },
        ];
      return [named("archivist", "Academy Master Kong Wen", byRealm(g, [
        "Our students sit the imperial examination. Yours sit heaven's. I think ours is harder. They think yours is.",
        "Foundation. In our histories, cultivators who rush past Foundation crack within the year. Do not rush.",
        "A golden core. Would you let the students look at you? From a respectful distance. They are writing essays on the Dao.",
        "I have nothing to teach you but old words. Come anyway. Old words are good company at your height.",
      ]))];
    }
    case "student":
      return [named("scholar", "Student Xu", byRealm(g, [
        "Is cultivating harder than the imperial examination? …Is it? Really? Oh no.",
        "My essay is on the Foundation Establishment tribulation! Could you tell me — how much did it hurt? For accuracy.",
        "Master Kong says I may not ask you questions. I'll write them down and leave them by the temple.",
        "I'm going to put you in my essay. As a footnote. A very large footnote.",
      ]))];
    case "templeNovice":
      return [named("novice", "Novice Ji", heartDemons(g) > 40 ? "Amituofo… The City God's incense bends away from you. Please, light a stick before you go. For whatever follows you." : byRealm(g, ["The City God keeps a ledger of everyone in Jinhe. You're in it now too.", "The incense leans toward you when you come in. It does that for good cultivators.", "The bell rang when you walked in. I didn't touch it. Honestly.", "The City God's statue looks… smaller, with you standing next to it. Don't tell the abbot I said that."]))];
    case "wineseller":
      return [named("villagerF", "Auntie Qiao", byRealm(g, ["Rice wine, plum wine, osmanthus wine! Cultivators drink for free on festival days. Today isn't a festival day.", "A Foundation cultivator! First cup's free. Second cup's double. Third cup you're dancing on the table.", "Immortal, would you bless the wine jar? Just touch it. People will pay three times as much. I'll split it with you!", "I'm naming a wine after you. It's very strong and it makes you see heaven. Accurate, I think."]))];
    case "teakeeper":
      return [named("cook", "Teahouse Keeper Bo", byRealm(g, ["Tea's a copper. Gossip's free. They say a cultivator's been failing tribulations up in the hills. Not you, I hope?", "The table by the window, for the Foundation cultivator! Clear it, clear it.", "You'll take the upstairs room? The view of the river is the best in the city. Free, of course. Free, of course.", "Half my customers come to see if you'll come in. Sit by the door, would you? Good for business."].map((l, i) => (i === 0 && failedTribulations(g) > 0 ? "They say heaven knocked you flat. Tea's on the house. Everyone deserves a cup after that." : l)) as [string, string, string, string]))];
    case "tao":
      return [{ anim: "tao", name: "juggle" }, named("child", "Little Tao", byRealm(g, ["Can you fly? Fly! Fly! …Oh. Maybe later.", "Are you a real immortal? You don't LOOK like an immortal. You look like my cousin.", "Can you juggle with qi? Can you juggle FIRE? Please juggle fire.", "Mother says if I'm good I'll grow up to be like you. I'm being SO good."]))];
    case "pang2":
      return [named("boy", "Little Pang", byRealm(g, ["Bet I can kick it higher than you. …Without qi! No qi!", "You've got Foundation? Is that like having a really strong house?", "Everyone says you have a gold pill inside you. Can I see it? Can I touch it? Can I have it?", "I told everyone at the academy I met you and nobody believed me. Can you sign my shuttlecock?"]))];
    case "jinporter":
      return [named("porter", "Porter Gui", g.realm >= 2 ? "Immortal, if you ever need anything carried, I — oh. You can probably carry the whole city. Never mind." : "Out of the way, out of the way — oh, sorry, cultivator. Heavy load.")];
    case "pawn":
      return [named("villagerM", "Pawnbroker Qian", toxicity(g) >= 40 ? "Pawn your pills, cultivator? You look like you've had enough of them. I'll give you a fair price. Well. A price." : byRealm(g, ["Swords, jade, mirrors, the deeds to your grandmother's house. Qian buys everything.", "A Foundation cultivator's cast-off robe goes for a fortune. Anything you're not wearing?", "If you ever shed a… a golden core flake? Do they flake? I'd pay very well.", "Don't sell me anything, immortal. I couldn't afford it. Nobody could."]))];
    case "noodlefu":
      return [named("cook", "Noodle Seller Fu", byRealm(g, ["Hand-pulled! Sixty strands from one ball of dough. Cultivators get extra chilli.", "Foundation cultivators eat like three men. That'll be three bowls.", "For the golden-core immortal: the longest noodle I've ever pulled. One noodle. For long life. Not that you need it.", "You don't need to eat any more, do you? …You'll eat anyway? For the taste? Ha! Sit down, sit down."]))];
    case "washer":
      return [named("villagerF", "Washerwoman Liang", heartDemons(g) > 60 ? "The well water went cold when you leaned over it. Cold as winter. Mind yourself, girl." : pick(g, ["The river's clean again this year. Some cultivator purged a poison spring upstream, they say.", "The opera's singing about some sword girl now. Silly stuff. Love it.", "Hold this end. Twist. There. You're stronger than you look."]))];
    case "clerk":
      return [named("villagerM", "Clerk Hou", `The magistrate keeps a register of cultivators passing through. Let's see… Lin Yue, Azure Cloud Sect, ${realmLabel(g.realm, g.stage)}${failedTribulations(g) ? `, tribulations failed: ${failedTribulations(g)}` : ""}${dao ? `, ${DAOS[dao].name}` : ""}. Is that right? I like to be right.`)];
    case "ladyshen":
      return [named("lady", "Lady Shen", byRealm(g, ["A sect girl in the city! How exciting. Do you know any eligible young cultivators? For my daughter. She's very patient.", "Foundation! My daughter would adore you. She wants to be a cultivator. I want her to marry one. We argue.", "Oh, immortal, would you come to dinner? Everyone who is anyone would come if you came.", "I fainted the last time you passed. I'm told it was very elegant."]))];
    case "apprentice":
      return [named("villagerM", "Apprentice Gang", g.realm >= 2 ? "Master's out. If you could just — put your hand on the anvil? Golden-core qi tempers the iron better than any fire. He'll never know." : "Master's out buying charcoal. Mind the sparks!")];
    case "jinfarmer":
      return [named("villagerM", "Farmer Sun", byRealm(g, ["Rice to the city, every morning. The road's long but the price is good.", "The fields came up early this year. Maybe from all the cultivators passing. Maybe from the rain.", "Bless my fields, immortal? Just walk across them. Barefoot, if it's not too much trouble.", "The rice bowed when you walked by. I saw it. I'm not mad."]))];
    case "silk":
      return [{ anim: "silk", name: "fan" }, named("lady", "Silk Merchant Jin", byRealm(g, ["Silk from the capital, silk from the south, silk that changes colour in moonlight. Cultivator's robes tear so easily — let me measure you!", "A Foundation cultivator in my shop! Wear my silk to your next tribulation, and tell everyone where you got it.", "Lightning-proof silk! …Well. Lightning-resistant. Mostly resistant. It's very pretty.", "I'll dress you for free, immortal. Just let me hang a sign that says you shop here."]))];
    case "laoji":
      return [named("villagerM", "Fisherman Lao Ji", byRealm(g, ["The stream brings everything down to the sea. Leaves, fish, once a sword. Never a cultivator. Until now.", "A cultivator came down the stream last year on a lotus leaf. Showing off. You're not going to do that, are you?", "Sit, immortal. The fish don't care what realm you are. That's why I like them.", "The sea goes quiet when you stand on the shore. The fish stop biting. Go away a little, would you? Kindly."]))];
    case "ahhong":
      return [named("fishwife", "Fishwife Ah Hong", toxicity(g) >= 40 ? "You're green, girl. Eat some salt fish, it draws out poison. Old wives' cure. Works better than pills." : pick(g, ["Fresh from the sea! Well, fresh from this morning.", "The Jinhe folk think we're bumpkins. We think they're soft. Both are true.", "Lao Ji's been fishing that spot thirty years and caught the same carp eleven times. He's named it."]))];
    case "ferryman":
      return [named("captain", "Ferryman Shui", g.realm >= 2 ? "You'll not need my boat, I expect. You'll walk on the water. …Ride anyway? For the company? Ha! Sit, then." : "Across the stream mouth? Two coppers. Cultivators pay double, they rock the boat.")];
    case "reedkid":
      return [named("child", "Little Lu", g.realm >= 3 ? "My kite went higher than ever when you walked past! It wants to follow you!" : "Watch my kite! It's a crane. It's a bad crane. It mostly falls down.")];
    case "caravanmaster":
      return [named("nomad", "Caravan Master Temujin", byRealm(g, ["From the far side of the Yellow Sands, forty camels, and not one bandit got near us. Do you want to know why? We pay them.", "A Foundation cultivator! Ride with us to the next well and I'll not pay the bandits this time. They'll see you and run.", "Immortal, one of my camels is sick. Not that you heal camels. …Do you heal camels?", "The sands have stories about cultivators of your realm. In the stories they walk across the desert in a day and the dunes bow. Will you? The dunes, I mean."]))];
    case "camelhand":
      return [named("villagerM", "Drover Ilkhan", "Mind the horses, they're skittish. They can smell qi. Yours smells… big.")];
    case "caravanguard":
      return [named("guard", "Caravan Guard Aru", byRealm(g, ["Bandits on the track north. Ride with steel drawn, cultivator.", "With you on the road, I could take a nap. Could I take a nap?", "The bandits have stopped coming. Word travels. You're the word.", "I've put my spear down. What's the point, with you here?"]))];
  }
  return null;
}
