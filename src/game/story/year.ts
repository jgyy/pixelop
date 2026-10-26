import { cultivationNeeded } from "../engine/realms";
import { gainCultivation, heal, setFlag, type GameState } from "../engine/state";
import type { HumanId } from "../art/characters";
import { passTime, SEASON_INFO, type CalendarDay, type Season } from "../world/calendar";
import type { Choice, Step } from "./script";
import { say } from "./script";
import { giveAttire } from "./wardrobe";

/**
 * The Turning of the Year: the second thread of the main tale. While the
 * Jade Lotus Heart was gone the Four Wardens of the Year — the spirits who
 * hand the seasons on, one to the next, at the solar terms — fell asleep, and
 * the seasons have been turning hollow, by habit. Almanac Master Shi of
 * Willow Creek sends Lin Yue to wake each warden in its own season, at its
 * own hour and place, with the offering of its festival: graves swept at
 * Qingming for spring, zongzi on the water at Duanwu for summer, mooncakes
 * under the Mid-Autumn moon, and tangyuan at the winter solstice.
 *
 * All of it is story flags (`yearMet`, `yr:<step>`, `woke:<season>`,
 * `yearTurned`), so it rides along in any save.
 */

export interface Warden {
  season: Season;
  char: HumanId;
  name: string;
  festival: string;
  /** Where she must be. */
  landmark: string;
  place: string;
  /** When: a test on the hour, and how it is said. */
  hour: (h: number) => boolean;
  when: string;
  /** The offering's flag, who gives it, and how the quest log names the errand. */
  offering: string;
  from: string;
  fetch: string;
  outfit: string;
}

export const WARDENS: Record<Season, Warden> = {
  spring: {
    season: "spring",
    char: "springWarden",
    name: "Lady Qingming",
    festival: "Qingming, the festival of clear brightness",
    landmark: "plum",
    place: "the Plum Blossom Shrine in the Mistmarsh",
    hour: (h) => h >= 4.5 && h < 8.5,
    when: "at dawn",
    offering: "yr:swept",
    from: "swordtomb",
    fetch: "Sweep the graves at the Sword Tomb (north of the western highway) in spring, as families do at Qingming.",
    outfit: "springblossom",
  },
  summer: {
    season: "summer",
    char: "summerWarden",
    name: "Lord Xiazhi",
    festival: "Duanwu, the dragon-boat festival, and the summer solstice",
    landmark: "rainbow",
    place: "the Rainbow Bridge, east of the steppe",
    hour: (h) => h >= 10 && h < 14.5,
    when: "at noon",
    offering: "yr:zongzi",
    from: "noodles",
    fetch: "In summer, ask Noodle Seller Hu at Wavecrest Harbour for zongzi to throw on the water at Duanwu.",
    outfit: "summerlotus",
  },
  autumn: {
    season: "autumn",
    char: "autumnWarden",
    name: "Grandmother Shuangjiang",
    festival: "the Mid-Autumn festival of the full moon",
    landmark: "pavilion",
    place: "the Moon-Gazing Pavilion, north of the creek",
    hour: (h) => h >= 19.5 || h < 4,
    when: "under the night moon",
    offering: "yr:mooncakes",
    from: "pang",
    fetch: "In autumn, ask Cook Pang in the sect's kitchens for mooncakes for the Mid-Autumn moon.",
    outfit: "autumnmaple",
  },
  winter: {
    season: "winter",
    char: "winterWarden",
    name: "Old Dongzhi",
    festival: "Dongzhi, the longest night of the winter solstice",
    landmark: "spring",
    place: "the Highland Hot Spring",
    hour: (h) => h >= 21 || h < 3,
    when: "in the depth of the night",
    offering: "yr:tangyuan",
    from: "hua",
    fetch: "In winter, ask Granny Hua in Willow Creek for tangyuan, the sweet rice balls of the solstice.",
    outfit: "wintersnow",
  },
};

const ORDER: Season[] = ["spring", "summer", "autumn", "winter"];
export const woken = (f: Record<string, boolean>, s: Season) => !!f[`woke:${s}`];
export const allWoken = (f: Record<string, boolean>) => ORDER.every((s) => woken(f, s));

/** The line of the year in the quest log, or null before it begins (or after it ends). */
export function yearQuest(g: GameState, cal: CalendarDay): { chapter: string; title: string; objective: string } | null {
  const f = g.flags;
  const chapter = "The Turning of the Year";
  if (!f.metZhou || f.yearTurned) return null;
  if (!f.yearMet) return { chapter, title: "The Almanac", objective: "Almanac Master Shi keeps the calendar by the sundial in Willow Creek's square. He has been asking for you." };
  if (allWoken(f)) return { chapter, title: "The Year Made Whole", objective: "All four Wardens are awake. Go back to Almanac Master Shi in Willow Creek." };
  // the warden of this season first; otherwise the next one asleep
  const start = ORDER.indexOf(cal.season);
  const next = [0, 1, 2, 3].map((k) => ORDER[(start + k) % 4]).find((s) => !woken(f, s))!;
  const w = WARDENS[next];
  const title = `${SEASON_INFO[next].name}: ${w.name}`;
  if (next !== cal.season) return { chapter, title, objective: `Wait for ${SEASON_INFO[next].name.toLowerCase()} to wake ${w.name}. (Turn the almanac by the sundial in Willow Creek to let time pass.)` };
  if (!f[w.offering]) return { chapter, title, objective: w.fetch };
  return { chapter, title, objective: `Go to ${w.place} ${w.when} this ${SEASON_INFO[next].name.toLowerCase()} and wait for ${w.name}.` };
}

export function yearHasNews(key: string, g: GameState, cal: CalendarDay): boolean {
  const f = g.flags;
  if (key === "almanac") return !!f.metZhou && (!f.yearMet || (allWoken(f) && !f.yearTurned));
  if (!f.yearMet) return false;
  const w = WARDENS[cal.season];
  return w.from === key && !woken(f, w.season) && !f[w.offering];
}

const cult = (k: number): Step => ({ mutate: (s) => gainCultivation(s, Math.round(cultivationNeeded(s.realm, s.stage) * k)).state });
const flag = (n: string): Step => ({ mutate: (s) => setFlag(s, n) });

/** Let time pass at the sundial: to dawn, to nightfall, or on to the next season. */
export function almanacScript(): Step[] {
  const wait = (to: "dawn" | "night" | "season", text: string): Choice => ({
    label: { dawn: "Wait for dawn", night: "Wait for nightfall", season: "Wait for the next season" }[to],
    hint: text,
    then: [{ anim: "hero", name: "meditate" }, { fade: "out" }, { mutate: (s) => heal(passTime(s, to), 9999, 9999) }, { reshape: true }, { wait: 0.4 }, { fade: "in" }, { anim: "hero", name: "idle" }, { toast: "Time passes. (The calendar is in the corner of the screen.)" }],
  });
  return [
    say("narrator", "The bronze dial turns its gnomon to the sun. Beside it the almanac lies open: the twenty-four solar terms, each in Master Shi's careful hand."),
    {
      choose: [wait("dawn", "Rest until the sun comes up"), wait("night", "Rest until the stars come out"), wait("season", "Sit with the almanac until the season turns (two days)"), { label: "Leave the almanac", then: [] }],
      prompt: "Turn the almanac's pages?",
    },
  ];
}

/** Almanac Master Shi. */
export function almanacMasterScript(g: GameState, cal: CalendarDay): Step[] {
  const f = g.flags;
  const shi = (text: string): Step => say("almanac", text);
  if (!f.metZhou) return [shi("Hm? Ah, the sky-sect girl. Head Zhou has trouble enough for you this week. Come back when the foxes are quiet.")];
  if (!f.yearMet)
    return [
      { anim: "almanac", name: "read" },
      shi("Ah. Lin Yue of the Azure Cloud. Sit, sit — no, not on the almanac. Twenty-four solar terms in there, and every one of them is late."),
      shi("You'll have noticed the seasons turning. Blossom, rain, gold leaves, snow, round and round, two days apiece. They turn because they always have. Habit. A wheel rolling downhill."),
      shi("But a year is not only a wheel. Every season has a Warden: a spirit who takes the year from the one before and hands it on. When the Heart was stolen, the Wardens fell asleep, one after another, like lamps going out down a corridor."),
      say("heroine", "And nobody noticed?"),
      shi("Farmers noticed. The rice is confused. The cranes came back a week early and stood about embarrassed. The old festivals were the people's half of the bargain: a grave swept, a dumpling thrown on the water, a cake held up to the moon, a bowl of sweet soup on the longest night. Without the Wardens nobody remembers why."),
      shi("Wake them. Each in its own season, at its own place and its own hour, with the offering of its festival. I'll write it all in your journal. And when you need a season to hurry along — the sundial. Turn the almanac and the days pass while you sit."),
      { anim: "hero", name: "bow", wait: true },
      flag("yearMet"),
      { toast: "Main quest: The Turning of the Year · Wake the four Wardens · The sundial lets time pass" },
      { anim: "almanac", name: "write" },
    ];
  if (allWoken(f) && !f.yearTurned)
    return [
      { emote: "almanac", icon: "!" },
      shi("…You did it. Last night the almanac's ink moved by itself. Every term in its place. Listen — the year is breathing again."),
      { shake: 0.3 },
      { flash: "#fff0c0" },
      say("narrator", "Four lights rise over the square — blossom-pink, lotus-green, maple-gold and snow-white — and circle the sundial once before they scatter to the four quarters of the jianghu."),
      shi("The Wardens send you this, through me. One thread from each of them: a raiment of the four seasons. It is warm in winter and cool in summer, and it will not let you forget what month it is."),
      { mutate: (s) => setFlag(giveAttire(heal(s, 9999, 9999), "fourseasons"), "yearTurned") },
      cult(1),
      { anim: "hero", name: "twirl", wait: true },
      { toast: "Received the Raiment of the Four Seasons · Cultivation rises greatly · The Turning of the Year is complete" },
      shi("Now. I believe I am owed forty years of late almanacs. Off with you; I have writing to do."),
      { anim: "almanac", name: "write" },
    ];
  const lines = [
    yearQuest(g, cal)?.objective ?? "The year turns.",
    `It is ${SEASON_INFO[cal.season].name.toLowerCase()}. ${cal.season === "spring" ? "The plum knows it before the farmers do." : cal.season === "summer" ? "The cicadas know it before anyone." : cal.season === "autumn" ? "The geese know it, and they are leaving." : "The pond knows it; it has a lid on."}`,
    "Two days to a season, eight to a year. The old almanacs said ninety days. The old almanacs were written by people who were never in a hurry.",
    "The sundial lies to nobody, but it only talks in daylight.",
  ];
  return [shi(lines[Math.floor(g.playTime / 9) % lines.length]), { anim: "almanac", name: "read" }];
}

/** A Warden's offering, given by the right person in the right season (played before what they would otherwise say). */
export function offeringScript(key: string, g: GameState, cal: CalendarDay): Step[] | null {
  const f = g.flags;
  if (!f.yearMet) return null;
  const w = WARDENS[cal.season];
  if (w.from !== key || woken(f, w.season) || f[w.offering]) return null;
  switch (key) {
    case "noodles":
      return [
        say("heroine", "Master Hu — zongzi, for Duanwu? Almanac Master Shi says the Warden of Summer is sleeping."),
        { say: "cook", name: "Noodle Seller Hu", text: "Duanwu! Nobody's asked for zongzi in seven years. Sticky rice, red dates, a salted egg yolk, wrapped in bamboo leaves and tied with a string. One to eat, one for the water, one for the poet who drowned. Here — still warm." },
        flag(w.offering),
        { toast: "Received zongzi wrapped in bamboo leaves · Take them to the Rainbow Bridge at noon" },
      ];
    case "pang":
      return [
        say("heroine", "Cook Pang, could you make mooncakes? For the Warden of Autumn."),
        say("cook", "Could I! Lotus paste, a whole salted yolk in each like a little moon. I've had the moulds oiled since the leaves turned. Take four. Not to eat. …Well. Eat one."),
        flag(w.offering),
        { toast: "Received mooncakes · Take them to the Moon-Gazing Pavilion after dark" },
      ];
    case "hua":
      return [
        say("heroine", "Granny Hua, do you make tangyuan for the solstice?"),
        say("hua", "Every year, child, though there's been nobody to eat them but me. Sweet rice balls in ginger soup, round as a family round the table. Here — carry the pot carefully. Take it up to the hot spring on the longest night, you say? Hm. Wrap up warm."),
        flag(w.offering),
        { toast: "Received a pot of tangyuan · Take it to the Highland Hot Spring deep in the night" },
      ];
  }
  return null;
}

/**
 * What happens when she stands at a landmark: graves to sweep at the Sword
 * Tomb in spring, and a Warden who wakes at the right place and hour.
 * `at` is where to spawn the warden (beside her).
 */
export function landmarkScript(landmark: string, g: GameState, cal: CalendarDay, at: [number, number]): Step[] | null {
  const f = g.flags;
  if (!f.yearMet) return null;
  if (landmark === "swordtomb" && cal.season === "spring" && !f["yr:swept"] && !woken(f, "spring"))
    return [
      say("narrator", "Spring. At Qingming families sweep the graves of their dead, and the Sword Tomb has three hundred and twelve swords and nobody to sweep for them."),
      { anim: "hero", name: "sweep", wait: true },
      { anim: "hero", name: "sweep", wait: true },
      { anim: "hero", name: "kowtow", wait: true },
      say("heroine", "There. Clean for the spring. Now — the Plum Blossom Shrine, at dawn."),
      flag("yr:swept"),
      { toast: "The graves are swept · Go to the Plum Blossom Shrine at dawn, in spring" },
    ];
  const w = WARDENS[cal.season];
  if (w.landmark !== landmark || woken(f, w.season) || !f[w.offering] || !w.hour(cal.hour)) return null;
  return wardenScene(w, at);
}

const WARDEN_WORDS: Record<Season, string[]> = {
  spring: [
    "Oh — someone swept the graves. I can smell the clean stone. I thought everybody had forgotten.",
    "I am Qingming, clear brightness. I come when the rain washes the air and the dead are remembered. Without the remembering I was only weather.",
    "Thank you, little lotus. Here. The cherry wove it while I slept — it was waiting for somebody to wake me.",
  ],
  summer: [
    "Zongzi on the water! Ha — the river spirits will be fighting over them for a week.",
    "I am Xiazhi, the longest day. When the sun stands highest I take the year from Qingming and carry it as far as it will go. I fell asleep at noon, of all hours. Embarrassing.",
    "Lotus gauze, cool as the shade under a bridge. Wear it when the cicadas are loudest.",
  ],
  autumn: [
    "Mooncakes. With the yolk in the middle. Somebody still knows how to do it properly.",
    "I am Shuangjiang, the descent of the frost. I gather the year in — the rice, the geese, the old people's stories — and I count it, so nothing is lost. I lost count when the Heart went. Not any more.",
    "Maple-red, for the road home. Every road is a road home in autumn.",
  ],
  winter: [
    "Tangyuan… round, like a family round the table. On the longest night, too. You have good manners for a sword-girl.",
    "I am Dongzhi. On this night the dark is deepest, and from tomorrow the light comes back, a grain of rice longer every day. Somebody has to hold the year still while it turns over. I'm good at sitting still.",
    "A cloak of snow-fox. It has never been cold in its life. Neither will you be.",
  ],
};

function wardenScene(w: Warden, at: [number, number]): Step[] {
  const key = `warden-${w.season}`;
  const words = WARDEN_WORDS[w.season];
  const speak = (text: string): Step => ({ say: w.char, text });
  return [
    { shake: 0.25 },
    { flash: SEASON_INFO[w.season].colour },
    say("narrator", `It is ${w.when.replace(/^(at|in|under) /, "")}, and the air changes: ${w.season === "spring" ? "a smell of rain and blossom" : w.season === "summer" ? "a heat that hums like cicadas" : w.season === "autumn" ? "a hush like a harvest field at dusk" : "a stillness so deep the snow stops falling to listen"}.`),
    { spawn: key, char: w.char, at, dir: 0 },
    { face: "hero", to: key },
    { emote: "hero", icon: "!" },
    speak(words[0]),
    speak(words[1]),
    { anim: key, name: "cast", wait: true },
    { flash: "#ffffff" },
    { mutate: (s) => setFlag(giveAttire(heal(s, 9999, 9999), w.outfit), `woke:${w.season}`) },
    cult(0.6),
    speak(words[2]),
    { anim: "hero", name: "twirl", wait: true },
    { toast: `${w.name}, Warden of ${SEASON_INFO[w.season].name}, is awake · Received the ${w.season === "spring" ? "Spring Blossom Hanfu" : w.season === "summer" ? "Summer Lotus Gauze" : w.season === "autumn" ? "Autumn Maple Robe" : "Snow-Fox Cloak"} · Cultivation rises` },
    { anim: key, name: "bow", wait: true },
    { despawn: key },
    say("heroine", `${w.festival.charAt(0).toUpperCase() + w.festival.slice(1)}… I'll remember it.`),
  ];
}

/** An extra line for the ending, once the year is whole again. */
export const yearEpilogue = (f: Record<string, boolean>) =>
  f.yearTurned ? "In Willow Creek an old man wrote twenty-four solar terms into a new almanac, and every one of them came on time." : null;
