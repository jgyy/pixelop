import { DAOS, DAO_TIERS, daoTier, dominantDao, type DaoId } from "../engine/dao";
import type { GameState } from "../engine/state";
import type { HumanId } from "../art/characters";
import type { Step } from "./script";

/**
 * The Dao she walks, as the people who know her see it. The first time
 * each of them meets her at a new depth of her Dao (a Glimpse, a Path, a
 * Heart, its Embodiment), they say what they make of it — once, before
 * whatever else they have to say. Seen asides are flags `dsn:<key>:<dao>:<tier>`.
 */

type Lines = Record<DaoId, string>;

const ASIDES: Record<string, { who: HumanId; name?: string; lines: Lines }> = {
  elder: {
    who: "elder",
    lines: {
      sword: "Your qi has an edge on it now. The sword is a narrow road, Lin Yue. Narrow roads go far, and they do not forgive.",
      mercy: "You carry other people's pain in your qi now. I can feel it. The founder walked that road. It is the heaviest one there is.",
      balance: "Hm. You have stopped pushing at the world. You let it move you, and then you move it. I spent forty years learning that.",
      slaughter: "…There is blood in your qi. Not on your hands — in your qi. I have seen this once before, in Xue. Be careful which way you are walking.",
    },
  },
  hua: {
    who: "hua",
    lines: {
      sword: "You stand like your sword now, child, straight up and down. Sit. Have some tea. Even swords rest in a scabbard.",
      mercy: "The refugees talk about you in my kitchen. I was so proud I burned the rice.",
      balance: "You have gone quiet inside. Like the creek in winter: still on top, moving underneath.",
      slaughter: "You came in the door and the cat ran. The cat has never run from you. What has the war done to you?",
    },
  },
  zhou: {
    who: "zhou",
    lines: {
      sword: "They say you settle things with one cut. Village business takes longer, I am afraid. A great deal longer.",
      mercy: "Half the refugees want to stay in Willow Creek because of you. Where am I going to put them? …We will find room.",
      balance: "You did not take sides in the Liu and Chun quarrel, and somehow both of them think you agreed with them. Teach me that.",
      slaughter: "The villagers bow lower than they used to when you pass. I do not think it is respect.",
    },
  },
  qing: {
    who: "qing",
    lines: {
      sword: "Your sword intent pricked my skin when you came in. Junior Sister! You could warn people.",
      mercy: "The alchemy hall wants to name a healing pill after you. I told them you would be embarrassed. Are you embarrassed? You are.",
      balance: "Your qi is so smooth now, my furnace burns steadier when you stand near it. That is not a figure of speech.",
      slaughter: "Junior Sister… you smell of smoke. Every time. Even after you bathe.",
    },
  },
  wen: {
    who: "wen",
    lines: {
      sword: "The fish see your sword before they see your shadow. Fishing with you is hopeless now.",
      mercy: "You catch fish and let them go, I hear. Good. Good. So do I, most days.",
      balance: "Sit. Hold the rod. No — do not try. There. You see? That is all there is to it, and to everything.",
      slaughter: "The lake goes still when you come down to it. Not the good stillness.",
    },
  },
  xuan: {
    who: "abbot",
    name: "Abbot Xuan",
    lines: {
      sword: "Amituofo. A sword that cuts cleanly still cuts. Remember to look at what it has cut.",
      mercy: "Amituofo. You have the bodhisattva's road under your feet, and you did not even ask for it.",
      balance: "Tell Mo the Dao is a river. Ha! You already know. You are swimming in it.",
      slaughter: "Amituofo… Sit with me a while. Not to talk. Only to sit.",
    },
  },
  yun: {
    who: "hermit",
    name: "Master Yun",
    lines: {
      sword: "The cloud does not cut the mountain, little cloud. But I see you have decided to be a sword anyway.",
      mercy: "You let your qi go where it is needed, like rain. That is the cloud's way too.",
      balance: "You drift now, like a cloud that knows where it is going. I have nothing left to teach you.",
      slaughter: "There is a thunderhead in you. Storms end. Remember that they end.",
    },
  },
  huli: {
    who: "huli",
    lines: {
      sword: "Sister, your sword sings when you walk. My tails stand on end. In a nice way. Mostly.",
      mercy: "The fox kits follow you about now. You smell of kindness. Foxes know.",
      balance: "You move like a fox in long grass now. No one sees you, and then you are there.",
      slaughter: "Sister… you smell of blood. The kits hide when you come. Come and sit with me, and let it wash off.",
    },
  },
  lingfeng: {
    who: "lingfeng",
    lines: {
      sword: "Ten thousand swords in my pavilion, and yours is the first in years to make them all ring at once.",
      mercy: "A sword that chooses not to kill. Rarer than any blade in my pavilion.",
      balance: "Your sword is sheathed and your intent is everywhere. That is the last step before the sword is not needed.",
      slaughter: "There is a reason the Sword Sea forbids the killing sword. Look at what it is doing to your eyes.",
    },
  },
  yanhuo: {
    who: "yanhuo",
    lines: {
      sword: "A blade as hot as phoenix fire. You would have made a fine Scarlet disciple.",
      mercy: "You put out fires, I hear, as often as you start them. That is a phoenix's real work.",
      balance: "You burn steadily now. No flare, no smoke. A good fire, for a long night.",
      slaughter: "Fire that eats everything ends as ash. Even the phoenix knows that.",
    },
  },
  baizhi: {
    who: "baizhi",
    lines: {
      sword: "Clean cuts heal fastest. You know that already, I see.",
      mercy: "Your qi would make a fine medicine. Do not let them bottle you.",
      balance: "Every herb has its poison and its cure. You have learned to hold both.",
      slaughter: "You have swallowed something you should not have. I can smell it. Come to the valley when you want it out.",
    },
  },
  almanac: {
    who: "almanac",
    lines: {
      sword: "The almanac says: a good day to cut cloth, to sign contracts, and to end things. It says that about you now.",
      mercy: "The almanac says: a good day for weddings, for planting, and for forgiving. Every day you are here.",
      balance: "You walk in step with the seasons now. The sundial and you keep the same time.",
      slaughter: "The almanac marks some days as unlucky. I have started marking the days you pass through.",
    },
  },
  ou: {
    who: "smith",
    name: "Smith Ou",
    lines: {
      sword: "Let me see your sword. …You have worn the edge to the shape of your own intent. I have not seen that since Xue Ming was young.",
      mercy: "Your sword has hardly a nick on it. You have been choosing not to use it. Good steel can wait.",
      balance: "The blade is balanced right at the guard now. You did that. I did not.",
      slaughter: "There is blood in the grain of your blade that will not polish out. It will not, girl. I have tried.",
    },
  },
  han: {
    who: "swordsman",
    name: "Xiao Han",
    lines: {
      sword: "Ha! Now that is a sword intent. Let us spar again sometime — properly, this time.",
      mercy: "You let the bandits on the road go home, I heard. Soft! …I would have too, probably.",
      balance: "You do not even take a stance any more. That is either very good or very lazy.",
      slaughter: "I heard what you did on the front. I do not want to spar any more, Lin Yue.",
    },
  },
};

const seenFlag = (key: string, dao: DaoId, tier: number) => `dsn:${key}:${dao}:${tier}`;

/** What someone who knows her says about her Dao, the first time they see it at its new depth (null otherwise). */
export function daoAside(key: string, g: GameState): Step[] | null {
  const a = ASIDES[key];
  const d = dominantDao(g);
  const t = daoTier(g);
  if (!a || !d || !t || g.flags[seenFlag(key, d, t)]) return null;
  const tierName = DAO_TIERS[t - 1].name;
  return [
    { emote: key, icon: t >= 3 ? "!" : "..." },
    { say: a.who, ...(a.name && { name: a.name }), text: a.lines[d] },
    { mutate: (s) => ({ ...s, flags: { ...s.flags, [seenFlag(key, d, t)]: true } }) },
    { toast: `${DAOS[d].name} · ${tierName} (${DAOS[d].hanzi})` },
  ];
}

/** Whether someone has a word to say about her Dao. */
export const daoHasNews = (key: string, g: GameState) => daoAside(key, g) !== null;

/** The Dao she walked, as the ending tells it. */
export function daoEpilogue(g: GameState): string | null {
  const d = dominantDao(g);
  if (!d) return null;
  const t = daoTier(g);
  const deep = t >= 3;
  return {
    sword: deep ? "Long after, swordsmen of every sect still tried to learn the cut she called the Last Stroke. None of them could, because it was not a technique. It was a decision." : "She was remembered as a swordswoman first, and a cultivator second; she would not have minded.",
    mercy: deep ? "In temples across the jianghu, the folk lit lamps to a figure in jade robes with a bowl of medicine in her hands. The monks did not know who she was. The folk did." : "The folk remembered her kindness longer than her cultivation, which is the right way round.",
    balance: deep ? "The Taoists of the far mountains wrote that in her generation the Dao of Heaven walked the earth in a girl's shoes, and that it went mostly unnoticed, which was how it preferred things." : "Those who met her said afterwards that the world had seemed, for a while, to be in no hurry at all.",
    slaughter: deep ? "Mothers in the north told their children that the Red Blade would come for them if they did not sleep. In the south, they told them she would come if they ever needed saving. Both were true." : "She was feared, and she was safe to be near, and those were not always the same thing.",
  }[d];
}
