import { learn, type GameState } from "../engine/state";
import { SKILLS } from "../engine/battle";
import { CITY_TRADES, HEIGHTS_CAST, pillarClimber, PORT_FOLK, stairWalker } from "../world/heights";
import type { HumanId } from "../art/characters";
import type { Step } from "./script";

/**
 * What the folk of the Southern Heights say: the Hanging City's lady and its
 * terrace folk, the Hermit Who Holds Up Heaven on the tallest pillar, the
 * herb-gatherers on the long stairs, and the Cliff Port's harbourmaster and
 * stevedores. Two of them teach her a technique each: the hermit the
 * Cloudstep Whirlwind (for climbing to him), and Lady Xuan the Starfall Lotus
 * Rain (once she is a Foundation Establishment cultivator or higher).
 */

function pick<T>(g: GameState, key: string, lines: T[]): T {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return lines[(h + Math.floor(g.playTime / 9)) % lines.length];
}

const TERRACE: Record<string, string[]> = {
  "a porter": ["Six levels a terrace, six terraces. I go up it eleven times a day. My knees have opinions.", "Mind the stair, miss. Never sit on it. Everybody sits on it.", "Rice up, night soil down. That's the Hanging City."],
  "a terrace gardener": ["Every terrace grows something. The top one grows tea, the bottom one grows gossip.", "Water runs down here. Everything else has to be carried up.", "The falls water my beans. The beans don't thank them."],
  "a cliff smith": ["Iron goes up in the hoist and comes down as pins for the hoist. Funny old trade.", "Quench it in falls water and it never rusts. So they say.", "Hammer's too loud for the cliff? Tell the cliff."],
  "a noodle-seller": ["Noodles! Hot! Thirty levels up and still hot!", "Chopped fresh. The wok's older than the city.", "Eat before you climb. Never after."],
  "a herb-drier": ["Cliff herbs are bitter. That's how you know they work.", "The pillar herbs are better, but who's going up there? The gatherers. Mad, all of them.", "Rolled, dried, rolled again."],
  "a cliff scribe": ["Every house here is written down by its terrace and its angle. Third terrace, a hundred and ten degrees. That's me.", "The compass swings wild up here. Too much stone.", "I copy deeds for the hoist guild. Nobody climbs to court."],
  "a hoist-hand": ["Heave! Sorry. Heave!", "A basket of rice weighs a hundred jin at the bottom and two hundred at the top.", "Ever ridden a hoist? Don't."],
  "a bone-setter": ["Every fall off a terrace comes to me. Most of them walk out.", "Needles for the knees, ointment for the pride.", "You've a climber's calves, miss. Good."],
  "a lantern monk": ["A lantern for every terrace edge, lit every dusk. A thousand and nine.", "The talismans keep the wind off the lanterns. Mostly.", "Six terraces, six sutras. I chant one on each."],
  "a terrace lady": ["One sees so far from the fourth terrace. Not as far as the fifth. One does not visit the fifth.", "The view is free. The tea is not.", "Do you climb for the view or for the climbing?"],
  "a porter on the stair": ["Up, down. Up, down.", "Forty steps to a stair, seven stairs, and they never line up. Lady Xuan's grandmother's idea."],
  "a water-carrier": ["The spring is at the top and everybody thirsty is at the bottom.", "Two buckets, six levels. Again."],
};

const PORT_LINES: Record<string, string[]> = {
  "a stevedore": ["Off the junk, up the steps, into the warehouse. Five steps. Five storeys. Every bale.", "Salt from Saltwind, pearls from Pearlgate, rice from Jinhe. And it all goes up."],
  "a fishwife": ["Fresh! Caught this morning off the Turtleback!", "Cast, haul, gut, sell. The sea doesn't wait."],
  "a boatwoman": ["The skiffs go out at dawn and come back when they're full. Or hungry.", "The ferry's on time when the tide is."],
  "a sea merchant": ["Junks to Hailing, junks to the isles, junks to anywhere with a coin.", "Weigh it twice. The sea lies about weight."],
  "a ship's carpenter": ["Every hull that puts in here leaves a little sounder.", "Camphor for the planks, tung oil for the seams."],
};

/** The Southern Heights' folk, or null if the key is none of theirs. */
export function heightsNpcScript(key: string, g: GameState): Step[] | null {
  const say = (char: HumanId, who: string, text: string): Step => ({ say: char, name: who, text });
  if (key === HEIGHTS_CAST.hermit.key) {
    const H = HEIGHTS_CAST.hermit;
    if (!g.skills.includes("whirlwind"))
      return [
        say(H.char, H.name, "Forty levels of stair, and you didn't stop once. I watched. I've a lot of time for watching."),
        say(H.char, H.name, "Everyone who climbs up here wants to learn to fly. You climbed anyway. That's worth something. Stand there. No, there. Now spring, and turn, and cut on the way round."),
        { anim: "hero", name: "whirl", wait: true },
        { mutate: (s) => learn(s, "whirlwind") },
        { toast: `New technique: ${SKILLS.whirlwind.name} (${SKILLS.whirlwind.hanzi}) · key ${SKILLS.whirlwind.key} in battle` },
        say(H.char, H.name, "Cloudstep Whirlwind. It's only climbing, sideways. Off you go. Mind the bridges."),
      ];
    return [say(H.char, H.name, pick(g, key, ["The pillars grow a finger's width a thousand years. I'm waiting to see it.", "The cranes bring me news. The news is always fish.", "You came back up? Then you liked the view. Sit."]))];
  }
  if (key === HEIGHTS_CAST.lord.key) {
    const L = HEIGHTS_CAST.lord;
    if (!g.skills.includes("starfall") && g.realm >= 1)
      return [
        say(L.char, L.name, "You climbed all six. Most cultivators fly up and miss the city on the way. You walked it. Good."),
        say(L.char, L.name, "My grandmother built this city to be nearer the stars. She never quite got there. But she learned to bring them down. Hold your hand up. Higher."),
        { anim: "hero", name: "starfall", wait: true },
        { mutate: (s) => learn(s, "starfall") },
        { toast: `New technique: ${SKILLS.starfall.name} (${SKILLS.starfall.hanzi}) · key ${SKILLS.starfall.key} in battle` },
        say(L.char, L.name, "Starfall Lotus Rain. It heals the hand that calls it, a little. Everything here does, if you climb for it."),
      ];
    if (!g.skills.includes("starfall"))
      return [say(L.char, L.name, "You climbed all six terraces with qi that thin? Come back when your foundation's laid, and I'll show you something my grandmother found up here.")];
    return [say(L.char, L.name, pick(g, key, ["The Hanging City has stood six hundred years and fallen down twice. Not today.", "From here you can see the Stairlands, the sea and, on a clear day, Penglai. On a very clear day, the Azure Cloud.", "The falls run every terrace. My grandmother said a city without water running through it forgets it is alive."]))];
  }
  if (key === HEIGHTS_CAST.harbourmaster.key) {
    const H = HEIGHTS_CAST.harbourmaster;
    return [say(H.char, H.name, pick(g, key, ["Junks for Hailing, for Pearlgate, for anywhere the tide goes. Watch them come round the point.", "The Pearl of the South is due on the next tide. She's always due on the next tide.", "Five steps up the cliff and every one a warehouse. Yagang doesn't waste a level."]))];
  }
  const who = heightsFolk(key);
  if (!who) return null;
  const lines = key.startsWith("yg-") ? PORT_LINES[who.name] : key.startsWith("pf-") ? CLIMBER : TERRACE[who.name];
  return [say(who.char, who.name.replace(/^a /, "").replace(/^\w/, (c) => c.toUpperCase()), pick(g, key, lines ?? ["Busy, miss. Busy."]))];
}

const CLIMBER = ["Every pillar has its herb. The tall ones have the good ones.", "Up the stair, over the bridges, and down again by dusk. Don't look down. Do look down, it's lovely.", "The hermit at the top? He's always there. He was always there."];

/** Who one of the heights' folk is (their look and what she would call them), from their key. */
export function heightsFolk(key: string): { char: HumanId; name: string } | null {
  let m = /^xc-folk-(\d+)-\d+$/.exec(key);
  if (m) return CITY_TRADES[Number(m[1])] ?? null;
  m = /^yg-folk-(\d+)-\d+$/.exec(key);
  if (m) return PORT_FOLK[Number(m[1])] ?? null;
  m = /^xc-stair-(\d+)$/.exec(key);
  if (m) {
    const [char, name] = stairWalker(Number(m[1]));
    return { char, name };
  }
  m = /^pf-climber-(\d+)$/.exec(key);
  if (m) {
    const [char, name] = pillarClimber(Number(m[1]));
    return { char, name };
  }
  return null;
}
