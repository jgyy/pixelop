import { REALMS } from "../engine/realms";
import { deepestWu, domainOpen, GREAT_DAOS } from "../engine/comprehension";
import { dominantDao } from "../engine/dao";
import { heal, type GameState } from "../engine/state";
import type { AnimId } from "../art/characters";
import { streetFolk, tideFolk } from "../world/road";
import type { Step } from "./script";

/**
 * The folk of the Tidewater Reach: the port of Hailing, its canals, its
 * square full of lion dancers, acrobats and puppeteers, the moneychangers
 * on the quay, Saltwind's salt-rakers and the shrine at the head of the
 * causeway. A port hears everything first, so they talk of the Founder's
 * Road, of the war, of her realm and of what she has come to understand.
 */

/** Deterministic variety: rotate lines with play time. */
function pick<T>(g: GameState, lines: T[]): T {
  return lines[Math.floor(g.playTime / 7 + g.kills) % lines.length];
}

/** Lines by her realm: Qi Condensation, Foundation, Core, and Nascent Soul or beyond. */
const byRealm = (g: GameState, lines: [string, string, string, string]) => lines[Math.min(3, g.realm)];

/** What each of them is doing when she walks up to them. */
const BUSY: Record<string, AnimId> = {
  hllion1: "liondance",
  hllion2: "drum",
  hlacrobat: "acrobat",
  hlacrobat2: "juggle",
  hlpuppeteer: "puppet",
  hlabacus: "abacus",
  hlspice: "hawk",
  hlchess1: "xiangqi",
  hlchess2: "xiangqi",
  hlfirecracker: "firecracker",
  hlhawker: "hawk",
  hlboatwoman: "row",
  hlboatman: "row",
  hlsalt: "rake",
  hlsalt2: "rake",
  hlmonk: "pray",
  hlkids: "firecracker",
  hlkids2: "acrobat",
};

export function tideNpcScript(key: string, g: GameState): Step[] | null {
  // the street folk of Jinhe's fair and Willow Creek's market talk like their Hailing fellows
  const street = streetFolk(key);
  if (street) {
    const steps = tideNpcScript(street.as, g);
    return steps && steps.map((s) => ("say" in s && s.say !== "narrator" ? { ...s, say: street.char, name: street.name } : "anim" in s && s.anim === street.as ? { ...s, anim: key } : s)) as Step[];
  }
  const who = tideFolk(key);
  if (!who) return null;
  const say = (text: string): Step => ({ say: who.char, name: who.name, text });
  const f = g.flags;
  const realm = REALMS[g.realm];
  const wu = deepestWu(g);
  const dao = dominantDao(g);
  const road = (n: number) => !!f[`restored:${["water", "wood", "wind", "fire", "earth", "metal", "thunder", "ice", "lifedeath", "void"][n]}`];
  const busy: Step[] = BUSY[key] ? [{ anim: key, name: BUSY[key] }] : [];
  let lines: string[];
  switch (key) {
    case "hlharbor":
      lines = [
        byRealm(g, [
          "Harbourmaster Ruan. Every hull in Hailing pays its berth to me, and every cultivator pays me the courtesy of not flying over the masts.",
          "Foundation Establishment? Then you can walk on the water if you must. Please don't. The fishermen find it upsetting.",
          "A golden core in my harbour. I'll have the pilots salute when you pass. They'll do it badly; they are pilots.",
          `${realm.name}. When you walk down the quay the water goes flat under the boats. The tide-tables are going to be wrong for a week.`,
        ]),
        f["hollowed:void"] ? "Nothing sails east any more. There's no horizon out there. A ship that can't see the edge of the world can't find its way back." : f["restored:void"] ? "The horizon's back. I stood on the quay and cried like a boy. Don't tell the pilots." : "Seven hundred ships a year come in past the isle. Spices from the west, pearls from the south, and gossip from everywhere.",
        f["war:won"] ? "The war's over, they say. The salt price came down the next morning. That's how a port knows peace." : "War up north. We hear the price of iron before we hear the battles.",
      ];
      break;
    case "hlboatwoman":
    case "hlboatman":
      lines = [
        "Canal boat, immortal? Two coppers to the fish market, three to the shrine, five if you want me to sing.",
        "Hailing's built on a hundred islands and a thousand bridges. Mind your head under the low ones.",
        wu ? `You sit in my boat like you know the ${GREAT_DAOS[wu].name.replace(/^Dao of /, "").toLowerCase()} by name. My grandmother sat like that.` : "Lean with the boat, not against it. There. You're a natural.",
        road(0) ? "The canals run sweeter since spring. My grandmother says the water remembered something." : "The water in the canals has been slow lately. Lazy, almost. My oar feels it.",
      ];
      break;
    case "hllion1":
    case "hllion2":
      lines = [
        "The lion dance chases off bad luck! We've chased off so much this month we're running out of drumsticks.",
        "Ah Fei's the head, I'm the tail. The tail does all the work and gets none of the glory. Like a husband.",
        byRealm(g, ["Want to try the head? It's heavier than it looks.", "A cultivator in the lion! Now that would chase off bad luck.", "Bow to the lion, immortal! …Ha, the lion bows to you. Look at that.", "We'll dance for you for free. It'd be bad luck not to."]),
        f["restored:void"] ? "Dancing every day since the horizon came back. My knees will never forgive me." : "The firework-maker says the lion needs a new mane. The firework-maker says that about everything.",
      ];
      break;
    case "hlacrobat":
    case "hlacrobat2":
      lines = [
        "Hup! Did you see? Three turns! Lingling can only do two. Don't tell her I said that.",
        byRealm(g, ["Can cultivators flip? Show me! No? Ha, I win.", "You can stand on air, people say. That's cheating. I like it.", "I saw you walk on the canal. Teach me! I'll teach you the triple turn.", "Will you throw me really high? Higher than the pagoda? Please?"]),
        "The trick is not to be scared on the way up. On the way down, being scared is fine.",
      ];
      break;
    case "hlpuppeteer":
      lines = [
        "Old He's puppets! Tonight: the Founder and the Ten Steles. Tomorrow: the Khan and the Cultivator. Every night: a lot of shouting.",
        f["road:begun"] ? "I've added a new puppet. A girl in jade robes, walking behind a sad man who eats the world. The children boo the sad man. I don't." : "The best puppet is the empty one. Put a hand inside and it can be anybody.",
        dao ? { sword: "In my play the jade girl has a sword. The children like that part best.", mercy: "In my play the jade girl forgives everyone. The children cry. Their mothers cry harder.", balance: "In my play the jade girl never hurries and is never late. The children think she's boring until the end.", slaughter: "In my play the jade girl… well. I've had complaints." }[dao] : "I can't decide what your puppet should do yet. You keep surprising me.",
      ];
      break;
    case "hlabacus":
      lines = [
        "Silver to copper, copper to spirit stones, stones to pearls. Click, click. The abacus never lies, which is more than I can say for my customers.",
        `${g.stones} spirit stones in your purse, I'd guess. No? Close? I'm never wrong about purses.`,
        f["devoured:void"] ? "The Dao of the Void? Can't price it. Nobody wants to buy what you ate." : "Everything has a price. The steles out on the isle? Priceless. That's the most expensive price there is.",
      ];
      break;
    case "hlspice":
      lines = [
        "Pepper from the far west, cinnamon from the south! Smell that? That's a thousand li in a jar.",
        "In my country we have no cultivators, only very patient grandmothers. Same thing, I think.",
        "Camel from the sands to Jinhe, boat from Jinhe to here. My spices travel further than most kings.",
      ];
      break;
    case "hlchess1":
    case "hlchess2":
      lines = [
        "Hush. He's thinking. He's been thinking since the last moon.",
        "The cannon jumps the river! Ha! …Oh. Oh no.",
        byRealm(g, ["Play the winner? You'll lose. Everyone loses to Pan.", "A cultivator at xiangqi? Your general's very calm. Too calm.", "You see three moves ahead. I see four. It's the only thing I'm better than an immortal at.", "Sit, immortal. I'll lose to you gracefully. I've had practice."]),
        "Most of the board is empty squares. The game's in the empty squares. Remember that, girl.",
      ];
      break;
    case "hlfirecracker":
      lines = [
        "Firecrackers! For weddings, funerals, new shops, and frightening my neighbours.",
        "Stand back — no, further — no, FURTHER —",
        domainOpen(g) ? "Strange. My fuses won't light when you stand that close. The air round you is… arranged." : "Gunpowder is just fire that's in a hurry. I'm a patient man selling impatience.",
      ];
      break;
    case "hlhawker":
      return [
        { anim: key, name: "hawk" },
        say(pick(g, ["Shrimp dumplings! Pork buns! Lotus-paste buns for the immortal! Hot, hot, hot!", "Bao Mei's buns! Eat three, walk to the isle and back, eat three more.", "The steamer's never cold. Neither am I. Buy something."])),
        { mutate: (s) => heal(s, 9999, 9999) },
        { toast: "Hot buns from Bao Mei · HP and QI restored" },
        { shop: true },
      ];
    case "hlpearl":
      lines = [
        "I dive for pearls out by the isle. Down there it's quiet. Up here everyone talks.",
        f["hollowed:void"] ? "The tide comes in and goes out at the same time out there now. I nearly drowned. I don't dive by the isle any more." : "When the tide goes out you see what was always there. Mud, mostly. And pearls.",
        byRealm(g, ["Can you hold your breath? Cultivators should be good at breathing.", "Foundation cultivators can breathe underwater, I heard. Is it true? Liar.", "Your qi's like a warm current. The fish follow you along the quay.", "Come diving. The pearls will come to you, I think."]),
      ];
      break;
    case "hlkids":
    case "hlkids2":
      lines = [
        "Bang! Bang! Ha! Did I scare you? I scared you.",
        "Watch me flip! …That was nearly a flip.",
        byRealm(g, ["Are you a real cultivator? Prove it.", "Can you fly? FLY. Fly now!", "My ma says not to bother you. Hello! What's your name? Can you fly?", "Everyone bows to you. Why? You look normal. Hello!"]),
      ];
      break;
    case "hlmonk":
      lines = [
        "The tide comes in. The tide goes out. I sit here and ring the bell at both. Thirty years.",
        wu ? `You carry the ${GREAT_DAOS[wu].name}. Gently, I see. Good. The ones who carry it roughly break.` : "Breathe out with the tide, young one. Breathe in with it. That's all the sutra there is.",
        f["restored:void"] ? "The horizon is back. I rang the bell a hundred and eight times. My arm still aches. Worth it." : "A man came through here two springs ago. Silver hair, eyes like an empty bowl. He asked me how the tide felt. I could not tell him.",
      ];
      break;
    case "hlguard":
      lines = [
        "Watchman Fu. Lion dancers on the square, acrobats on the bridges, firecrackers at all hours. I just stand here and hope.",
        byRealm(g, ["No flying swords over the canals, please. The boats tip.", "Foundation, eh? Then if the lion dancers start a brawl again, you're deputised.", "I'll clear a path, immortal. MOVE, you lot. Immortal coming through.", "I'm not going to tell you anything. I'm just going to stand here. Respectfully."]),
      ];
      break;
    case "hlsalt":
    case "hlsalt2":
      lines = [
        "Sea in the pans, sun on the pans, rake, rake, rake. Salt. Same as my grandfather.",
        "Salt keeps fish, keeps meat, keeps the gods happy at new year. Keeps us poor, mostly.",
        f["restored:wind"] ? "The wind's back on the steppe, the caravans say. Wind dries the pans faster. Good wind, good salt." : "The pans dry slow this year. Air's too still, they say, even up north.",
      ];
      break;
    case "hlshrine":
      lines = [
        "This shrine faces the isle so the founder can see us from up there. Silly, maybe. I sweep it anyway.",
        f["roadat:void"] && !f["restored:void"] ? "The old Daoist with the brushes went out along the causeway. He looked frightened, and then he looked brave. Go after him." : "Pilgrims used to come for the stele on the isle. Now it's mostly lovers and fishermen.",
        g.realm >= 3 ? "Bow to the shrine with me? …It bowed back. Did you see? Something in the shrine bowed back." : "Light a stick of incense for the sea. It never asks for anything. Somebody should give it something.",
      ];
      break;
    default:
      return null;
  }
  return [...busy, say(pick(g, lines))];
}
