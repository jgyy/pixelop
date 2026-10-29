import type { GameState } from "../engine/state";
import { calendarAt, worldTime } from "../world/calendar";
import { crowdLook, crowdName, parseCrowdKey, type CrowdKind } from "../world/crowds";
import type { AreaId } from "../world/ids";
import type { Step } from "./script";

/**
 * What the jianghu's ordinary folk (the neighbours of world/crowds.ts) say
 * when she stops to talk: a line for their kind of life, one for where they
 * live, and now and then one for the hour, the season or what the land has
 * lived through. They know only what everyone knows, so they never get
 * ahead of the tale.
 */

const BY_KIND: Record<CrowdKind, string[]> = {
  villager: [
    "Rice in the paddies, beans on the dikes, and a pig that thinks it owns the house. That's my whole world, and it's enough.",
    "My grandmother saw a cultivator fly once. She talked about it until the day she died. Now I've seen one walk. Less of a story.",
    "The well's sweet this year. Last year it tasted of iron and we all blamed the neighbours.",
    "If you're going on, take a rice ball. No, take two. You look like you forget to eat.",
  ],
  disciple: [
    "Three hundred sword forms before breakfast. Then breakfast. Then three hundred more because I dropped my sword in the porridge.",
    "Senior Sister says my qi circulates like a sleepy river. I've decided it's a compliment.",
    "The elders say the cloud-sea below us is bottomless. I dropped a pebble once and waited. I'm still waiting.",
    "We sweep the steps every morning. The wind unsweeps them every afternoon. It's a kind of cultivation, I'm told.",
  ],
  soldier: [
    "Night watch again. The stars don't change, and neither does the cold.",
    "My spear's older than the captain. So am I, nearly.",
    "Keep to the road, cultivator. The road we can guard. The hills, nobody can.",
    "Rations are millet and more millet. If you've a peach about you, I'm a wealthy man.",
  ],
  refugee: [
    "We left with what we could carry. My son carried the chickens. He has not forgiven them.",
    "When the fields are safe again we'll go home. Until then, home is wherever the soup is.",
    "Thank you for asking how we are. Nobody asks. We are tired, mostly.",
    "My husband counts our coins every night. There are not many to count. It calms him anyway.",
  ],
  monk: [
    "The abbot says the snow is a teacher. It mostly teaches me that my feet are cold.",
    "Breathe in for four, out for eight. You'll find the mountain breathes with you if you let it.",
    "I polish the bell each dawn. It doesn't need it. I do.",
    "Every stupa holds a teacher's last words. I like to guess what they were. Mostly, I think, “Mind the step.”",
  ],
  outer: [
    "The Mission Hall gave me “catch the escaped goose” again. That goose has a cultivation base, I swear it.",
    "Ten thousand came, one hundred stayed, and I'm still the one who cleans the ring.",
    "Room Four snores. Room Five sings. Room Six does both. I'd trade places with Room Seven in a heartbeat.",
    "If you see an Enforcer, look busy. If you are busy, look busier.",
  ],
  sword: [
    "A sword is ten thousand cuts, and nine thousand nine hundred of them are into the air.",
    "The wind off the Sword Sea sings through the blades below. Some nights it sounds like someone calling.",
    "Master Ling says a blade remembers every hand that held it. Mine must remember being dropped a great deal.",
  ],
  phoenix: [
    "Fire-jade warms the hand of an honest cultivator. Mine is lukewarm. I'm working on it.",
    "We eat our noodles spicy enough to strip paint. Building character, the Mistress says.",
    "From the mesa you can see three lands at once on a clear day. And four tempers on a cloudy one.",
  ],
  herb: [
    "Never taste a root you can't name. Never trust a herbalist who tastes them all.",
    "Moon-mint, cloud-moss, dragon's-whisker. Every plant has a temper, like people.",
    "I dry the leaves in the shade. Sun steals the qi out of them, my teacher said, and she was usually right.",
  ],
  miner: [
    "Down there it's warm and dark and quiet. Up here it's bright and loud. I prefer the rock.",
    "Tap the wall, listen. Hollow means a seam. Ringing means trouble. Silence means run.",
    "Forty carts a day. My arms are made of rope now.",
  ],
  fisher: [
    "The sea gives, the sea takes, and the fishmonger takes the most of all.",
    "Mend the nets on land, curse the knots at sea. That's the whole trade.",
    "If the gulls fly inland, a storm is coming. If they fly at your bucket, it's lunch.",
  ],
  nomad: [
    "The horses know the way home better than I do. I just hold on.",
    "Sky above, grass below, tea in the pot. What else is there?",
    "We move when the grass says. Good grass talks loud.",
  ],
  porter: [
    "Salt to the hills, tea to the coast, gossip both ways. Gossip weighs the least and sells the best.",
    "My knees have climbed more stairs than any immortal. Nobody gives knees a title.",
    "Three days to the next town if the bridges hold. Two if they don't and you can swim.",
  ],
  child: [
    "Are you an immortal? Can you fly? Can you fly me? Just a little way?",
    "I'm the fastest in the village. Except for the dog. And my sister. And the chickens.",
    "Mother says not to talk to cultivators. You don't count, you smiled.",
    "I found a stone shaped like a turtle! You can hold it. Don't keep it.",
  ],
};

const BY_REGION: Partial<Record<AreaId, string[]>> = {
  sect: ["On a clear morning you can see Willow Creek from the bridge, small as a rice grain.", "The cranes nest under the eaves of the archive. Archivist Shen pretends to mind."],
  village: ["Willow Creek's had foxes in the bamboo and lanterns in the square. I prefer the lanterns.", "Granny Hua's tangyuan are the best in the province. Don't tell my wife I said so."],
  bamboo: ["The bamboo whispers when there's no wind. My father said it was gossip. My mother said it was the foxes.", "Don't follow lights in the bamboo at night. Follow the road. The road doesn't laugh at you."],
  lake: ["Old Fisher Wen says the lotuses bloom brighter at the full moon. I've never been awake to check.", "The lake spills off the edge of the world at the falls. The spray makes rainbows every afternoon."],
  valley: ["Nobody goes west to the red valley if they can help it. The rocks there are warm at night.", "Ash on the wind from the valley again. Shut the windows."],
  peak: ["Up here even the clouds keep their voices down.", "The thunder lives above us. We're only visiting."],
  marsh: ["Granny Ye knows every frog in the Mistmarsh by name. The frogs know her too. They go quiet when she passes.", "Stay on the boardwalks. The black pools keep what they're given."],
  terraces: ["Six terraces, and my legs know every step. Tea tastes better when you've climbed for it.", "Tea Master Lu can tell which terrace a leaf came from by its smell. I can tell by the blisters."],
  desert: ["Water's worth more than silver out here. Silver doesn't keep you alive.", "Batu's flute brings the caravans in at dusk, like a lamp you can hear."],
  harbor: ["Captain Hai's junk is the fastest in the bay. He says so himself, every evening, loudly.", "The lighthouse beam sweeps the bay all night. I count the turns when I can't sleep."],
  frost: ["Frostveil's bell carries across the snow for a day's walk. On a still day, two.", "The monks practise barefoot. I tried it once. I'm a cook now."],
};

/** While the Iron Banner holds a land (or since it burned it), its folk talk of nothing else. */
const WAR = ["Keep your voice down. Their scouts were on the ridge again this morning.", "We buried the good plates under the floor. If they burn the house, at least we'll have plates.", "The soldiers say hold, so we hold. I'd rather run, but where to?"];
const SCARRED = ["They burned the fields and the shrine with them. We're replanting the fields. The shrine will have to wait.", "My brother didn't come back from the war. I still walk to the crossroads at dusk, in case."];

const NIGHT = ["Late to be about. The lanterns are lit, but the roads are dark between them.", "Can't sleep either? The moon's too bright tonight."];
const SEASON: Record<string, string[]> = {
  spring: ["Plum blossom on the wind. Every spring I forget how sweet it smells, and every spring it reminds me."],
  summer: ["Hot enough to cook an egg on the stones. My son tried. The dog ate it."],
  autumn: ["Persimmons on the eaves and leaves in the well. Autumn, the busiest season for brooms."],
  winter: ["Snow on the roofs and soup on the stove. Winter's not so bad if you've both."],
};

/** What one of the folk has to say. */
export function crowdNpcScript(key: string, g: GameState): Step[] | null {
  const c = parseCrowdKey(key);
  if (!c) return null;
  const char = crowdLook(c.kind, c.n);
  const name = crowdName(c.kind, c.n, char);
  const f = g.flags;
  const war = f[`war:${c.region}`];
  const lines = war && c.kind !== "soldier" ? [...WAR] : [...BY_KIND[c.kind], ...(BY_REGION[c.region] ?? []), ...(f[`scar:${c.region}:slaughter`] ? SCARRED : [])];
  const cal = calendarAt(worldTime(g));
  if (!war) {
    if (cal.dusk > 0.7) lines.push(...NIGHT);
    lines.push(...SEASON[cal.season]);
  }
  if (c.region === "village" && f.heartReturned) lines.push("Since the Heart came home the willows have never been greener. The whole village says so, so it must be true.");
  if (c.region === "village" && f.villageSaved && !f.heartReturned) lines.push("The fox that came into the square had red eyes. They cleared before it ran. I keep thinking about that.");
  const line = lines[Math.floor((g.playTime / 9 + g.kills + c.n * 7) % lines.length)];
  return [{ say: char, name, text: line }];
}
