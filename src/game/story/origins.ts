import { newGame, setFlag, type GameState } from "../engine/state";
import { toWorld } from "../world/layout";
import { say, type Choice, type Step } from "./script";
import { giveAttire } from "./wardrobe";

/**
 * Where Lin Yue's tale begins. The origin is chosen on the title screen and
 * kept as a story flag (`origin:<id>`), so it rides along in any save: she
 * may wake in the sect as Elder Mo's disciple, in Willow Creek as the
 * foundling Granny Hua raised, or at the sect gate in the robes of the Blood
 * Moon Sect she has just run away from. Each beginning has its own opening,
 * its own way into the story, its own answer to Patriarch Xue, and colours
 * how the jianghu speaks to her (and how the tale can end).
 */
export const ORIGIN_IDS = ["disciple", "foundling", "defector"] as const;
export type OriginId = (typeof ORIGIN_IDS)[number];

export interface Origin {
  id: OriginId;
  name: string;
  hanzi: string;
  /** One line under the name on the title screen. */
  blurb: string;
  /** What this beginning brings (shown as a short list). */
  perks: string[];
}

export const ORIGINS: Record<OriginId, Origin> = {
  disciple: {
    id: "disciple",
    name: "Inner Disciple",
    hanzi: "内门弟子",
    blurb: "Elder Mo's own student wakes in the floating sect to the toll of alarm bells.",
    perks: ["Starts in the Azure Cloud Sect", "Can recite the founder's sutra at Patriarch Xue, shaking his qi before the fight", "The classic road"],
  },
  foundling: {
    id: "foundling",
    name: "Willow Creek Foundling",
    hanzi: "柳溪孤女",
    blurb: "Granny Hua's orphan girl, an outer-sect token in her pocket, wakes to a red moon over the village.",
    perks: ["Starts in Willow Creek, where the fox attacks at once", "Four healing pills, few spirit stones, homespun clothes", "Can always remind Xue Ming of the village he came from", "May go home at the very end"],
  },
  defector: {
    id: "defector",
    name: "Blood Moon Runaway",
    hanzi: "血月叛徒",
    blurb: "Raised as an acolyte in the Crimson Demon Valley, she has fled to the sect gate with the truth.",
    perks: ["Starts at the sect gate in Blood Moon robes, eyed with suspicion", "Rich in spirit stones and qi pills", "Knows a secret way into the valley, and the old wound in Xue's art"],
  },
};

export const originFlag = (id: OriginId) => `origin:${id}`;

/** Her beginning (saves from before there were others began as the sect's disciple). */
export const originOf = (f: Record<string, boolean>): OriginId => ORIGIN_IDS.find((o) => f[originFlag(o)]) ?? "disciple";

export const isOrigin = (s: unknown): s is OriginId => typeof s === "string" && (ORIGIN_IDS as readonly string[]).includes(s);

/** A new game begun from one of the three beginnings. */
export function newGameAs(origin: OriginId = "disciple", name = "Lin Yue"): GameState {
  const g = setFlag(newGame(name), originFlag(origin));
  if (origin === "foundling") {
    // Granny Hua's house, by the creek
    const [x, y] = toWorld("village", 11.5, 7.5);
    return giveAttire({ ...g, area: "village", x, y, dir: 0, stones: 8, pills: { heal: 4, qi: 0 } }, "homespun");
  }
  if (origin === "defector") {
    // just inside the sect gate, where Disciple Guo stops her
    const [x, y] = toWorld("sect", 15.5, 24.5);
    return giveAttire({ ...g, area: "sect", x, y, dir: 8, stones: 60, pills: { heal: 1, qi: 3 } }, "acolyte");
  }
  return g;
}

// ----------------------------------------------------------------------------- the openings
export function originIntro(origin: OriginId): Step[] | null {
  if (origin === "foundling")
    return [
      {
        narrate: [
          "Below the sea of clouds, where the creek bends through the rice, lies Willow Creek Village.",
          "Seventeen winters ago Granny Hua found a baby girl in a basket on her doorstep, wrapped in jade-green silk. She named her Lin Yue, and raised her on bitter tea and stubbornness.",
          "When Lin Yue was twelve, a cultivator passing through gave her an outer-sect token of the Azure Cloud Sect. “Come up when you are ready,” he said. She has carried it ever since.",
          "Last night, the moon over the village turned the colour of blood…",
        ],
      },
      { fade: "in" },
      { face: "hero", to: "hua" },
      say("hua", "Yue'er! There you are. Did you hear the howling all night? The moon went red as a persimmon, and the dogs still won't stop."),
      say("heroine", "Stay inside, Granny. Bar the door. I'll go and look."),
      { emote: "mei", icon: "!" },
      say("child", "Big Sister Yue! The fox from the bamboo — it's at the bridge, and its eyes are on fire!"),
      { mutate: (s) => setFlag(s, "villageArrived") },
      { camera: "village-fox" },
      { wait: 0.8 },
      { camera: null },
      { anim: "hero", name: "think", wait: true },
      say("heroine", "Granny's old practice sword and a token from a sect in the clouds… It'll have to do."),
      { toast: "Touch the fox spirit to fight it · Move with WASD / arrows · E or Space to talk" },
    ];
  if (origin === "defector")
    return [
      {
        narrate: [
          "In the Crimson Demon Valley, the Blood Moon Sect raises orphans as acolytes. Lin Yue was one of them: taught to kneel, to bleed, and to never look up at the sky.",
          "Three nights ago Patriarch Xue came home with a flower of jade light stolen from the clouds, and fed it the blood of a fox kit to make it weep red.",
          "She ran. Three days she climbed, through the red mist and the bamboo, up the long sky bridge, until there was nowhere left to climb but the gate of the sect her master hates…",
        ],
      },
      { fade: "in" },
      { face: "hero", to: "guo" },
      { face: "guo", to: "hero" },
      { emote: "guo", icon: "!" },
      { say: "discipleM", name: "Disciple Guo", text: "Halt! Blood Moon robes — at OUR gate? One step more and you'll learn how sharp an Azure Cloud blade is." },
      { anim: "hero", name: "kowtow", wait: true },
      say("heroine", "I haven't come to fight. I've come from the Crimson Demon Valley. I know who took the Jade Lotus Heart, and where he keeps it."),
      { spawn: "runner", char: "abao", at: toWorld("sect", 13.5, 15.5), dir: 1 },
      { walk: "runner", to: toWorld("sect", 15.5, 22.5) },
      { emote: "runner", icon: "..." },
      say("abao", "Senior Brother Guo! Elder Mo says to let her in. He says… he says he's been expecting someone from the valley for forty years."),
      { walk: "runner", to: toWorld("sect", 13.5, 15.5) },
      { despawn: "runner" },
      { toast: "Speak with Elder Mo before the Hall of Clouds (up the stairs to the north) · Move with WASD / arrows · E or Space to talk" },
    ];
  return null;
}

/** The objective before she has met Elder Mo, for the beginnings that do not wake in the sect. */
export function originPrologue(g: GameState): string | null {
  const f = g.flags;
  switch (originOf(f)) {
    case "foundling":
      return f.villageSaved ? "Climb the long sky bridge north of Willow Creek to the Azure Cloud Sect, and show Elder Mo your outer-sect token." : "Drive the maddened fox spirit away from Willow Creek's bridge.";
    case "defector":
      return "Speak with Elder Mo before the Hall of Clouds. The whole sect is watching the girl in Blood Moon robes.";
    default:
      return null;
  }
}

/** Elder Mo's first words, for the beginnings that change them (null: the disciple's own briefing). */
export function originElderMeeting(g: GameState, gifts: Step[]): Step[] | null {
  const origin = originOf(g.flags);
  if (origin === "foundling")
    return [
      { face: "elder", to: "hero" },
      say("elder", "An outer-sect token, five years old, and fox blood on the sleeve. You are Hua's girl from Willow Creek."),
      say("heroine", "Lin Yue, Elder. A fox spirit attacked the village last night. Its eyes were red, like the moon."),
      say("elder", "Last night the Jade Lotus Heart was stolen from our shrine. Without it the spirit veins wither, and the beasts below go mad. You have already met the first of them."),
      say("elder", "The thief is Xue, Patriarch of the Blood Moon. He was a Willow Creek child too, once, and my sworn brother. There is no time for the outer sect. From today you are my disciple."),
      { anim: "hero", name: "kowtow", wait: true },
      ...gifts,
      say("elder", "Go home first, and speak with your village head. The trail of corrupted qi begins in your own back yard."),
    ];
  if (origin === "defector")
    return [
      { face: "elder", to: "hero" },
      { emote: "elder", icon: "..." },
      say("elder", "Blood Moon robes. Xue's mark at the collar. Forty years I have waited for him to send someone up that bridge."),
      say("heroine", "He didn't send me, Elder. I ran. He has your Heart on his altar, and he feeds it blood every night to turn its qi to poison."),
      say("elder", "…And why should I believe one of his acolytes?"),
      {
        choose: [
          {
            label: "Swear on the founder's stele, and lay down your saber",
            hint: "He will trust you, and the sect will open its storerooms",
            then: [
              { anim: "hero", name: "plantsword", wait: true },
              say("heroine", "On the founder's stele. If I lie, let the tribulation burn me to ash."),
              say("elder", "…That is not an oath Xue's people make lightly. Qing! Give the girl what she needs."),
              { mutate: (s) => setFlag({ ...s, stones: s.stones + 40, pills: { heal: Math.min(99, s.pills.heal + 3), qi: Math.min(99, s.pills.qi + 1) } }, "moTrust") },
              { toast: "Received 40 spirit stones and 4 pills · Elder Mo trusts you" },
            ],
          },
          {
            label: "Tell him the secret way into the valley",
            hint: "The Crimson Demon Valley opens to you without the hermit of the lake (you still need Foundation)",
            then: [
              say("heroine", "Behind the bamboo there's a goat path the acolytes use, under the red mist. No guard, no seal. I can walk it blind."),
              { anim: "elder", name: "think", wait: true },
              say("elder", "Then you are either his gift to me or my gift from heaven. We will find out which."),
              { mutate: (s) => setFlag(s, "secretWay") },
              { toast: "The secret way: the Crimson Demon Valley opens to you at Foundation Establishment" },
            ],
          },
        ] satisfies Choice[],
        prompt: "Elder Mo waits. Half the sect is listening from the stairs.",
      },
      ...gifts,
      say("elder", "Start at Willow Creek below. The fox spirits are maddened with what he has done. Show the mortals a Blood Moon girl can save them, and perhaps my disciples will believe it too."),
    ];
  return null;
}

/** A line or two from the beginning she came from, for the ending. */
export function originEpilogue(f: Record<string, boolean>): string | null {
  switch (originOf(f)) {
    case "foundling":
      return "In Willow Creek, Granny Hua kept a cup of tea warm by the door every evening for the rest of her life, and said it was for her husband. Everyone knew which of them it was really for.";
    case "defector":
      return "In the Crimson Demon Valley, the last acolytes of the Blood Moon learned that one of their own had looked up at the sky. A few of them began to look up too.";
    default:
      return null;
  }
}
