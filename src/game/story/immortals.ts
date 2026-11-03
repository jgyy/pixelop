import { gainCultivation, type GameState } from "../engine/state";
import { cultivationNeeded } from "../engine/realms";
import { CULT, shift } from "../engine/cultivation";
import { IMMORTAL_FOLK, immortalTown } from "../world/immortals";
import type { Step } from "./script";

/**
 * What the immortals of the Three Isles, their servants and the Watcher of
 * the Last Lamp say to the heroine (see world/immortals.ts for who and where
 * they are).
 *
 * The three masters each give her one gift the first time she comes: Anqi of
 * Penglai a breath of the elixir's steam (cultivation), Old Fang of the
 * Square Isle a sip of the Pool of a Hundred Years (insight), and Lady Ying a
 * sprig of jade grass (pills). The Watcher of the Last Lamp tells her what
 * the rim of the world is, once she has met all three: `im:rim` is set, and
 * the menu's book of places knows the edge of the world for what it is.
 */

const MASTERS = ["im-anqi", "im-fang", "im-ying"] as const;
export const metAllMasters = (f: Record<string, boolean>) => MASTERS.every((k) => f[`im:met:${k}`]);

const flag = (g: GameState, k: string): GameState => ({ ...g, flags: { ...g.flags, [k]: true } });

/** A line by the playtime, so the same person says something else next time. */
const pick = <T,>(g: GameState, xs: T[]): T => xs[Math.floor(g.playTime / 7 + g.kills) % xs.length];

export function immortalNpcScript(key: string, g: GameState): Step[] | null {
  const f = g.flags;
  const who = IMMORTAL_FOLK.find((p) => p.key === key);
  const town = /^im-town-(\d+)$/.exec(key);
  if (town) {
    const t = immortalTown(Number(town[1]));
    const say = (text: string): Step => ({ say: t.char, name: t.name, text });
    return [
      say(
        pick(g, [
          "You came over the jade causeway? On foot? The immortals laid it for mortals eight thousand years ago. You are the third.",
          "The turtles under the isles shift in their sleep once a century. Hold on to something.",
          "I came for the elixir. I stayed for the peaches. I am two hundred and six. The peaches are very good.",
          "Down south the sea runs out. Not into a shore: into nothing. The Watcher keeps a lamp there so the water has something to look back at.",
          "Nobody here is in a hurry. When you have forever, a long walk is a short one.",
          "The cranes are not for riding. They will let you think they are, and then they are not.",
        ]),
      ),
    ];
  }
  if (!who) return null;
  const say = (text: string): Step => ({ say: who.char, name: who.name, text });
  const met = `im:met:${key}`;
  const first: Step[] = f[met] ? [] : [{ mutate: (s) => flag(s, met) }];
  switch (key) {
    case "im-anqi":
      if (!f[met])
        return [
          say("Ah. A mortal who walked. The last one who walked here was Xu Fu, and he is still here, because he would not leave without the elixir and we would not give it to him."),
          say("I will not give it to you either. But the steam off the cauldron is free. Breathe."),
          { anim: "hero", name: "elixirbreath", wait: true },
          { mutate: (s) => gainCultivation(flag(s, met), Math.round(cultivationNeeded(s.realm, s.stage) * 0.6)).state },
          { toast: "A breath of the elixir's steam · cultivation surges" },
          say("Now you have breathed what emperors have died for. Most of them would have been disappointed. It smells of peaches."),
        ];
      return [say(pick(g, ["The elixir is brewed once in nine thousand years. We are three thousand in. Come back.", "Fangzhang's hermits think a hundred years is a long sip. Ying thinks a hundred years is a nap. I think you should go and ask them both.", "The rim? Ask the Watcher. He has looked at it longer than I have looked at anything."]))];
    case "im-fang":
      if (!f[met])
        return [
          say("You are standing on my game. No, the other foot. Thank you."),
          say("The Pool of a Hundred Years: one sip is a hundred years of thinking, done in a breath. Take one. Only one."),
          { anim: "hero", name: "poolsip", wait: true },
          { mutate: (s) => shift(flag(s, met), CULT.insight, 2) },
          { toast: "A sip of the Pool of a Hundred Years · Insight +2" },
          say("There. You have thought about it for a hundred years. Do you still want to go back to the mainland? Most do. That is the strange part."),
        ];
      return [say(pick(g, ["Two sips and you forget you ever had a question. The hermits at the board took three. They have been playing the same game since the Shang.", "The Square Isle is not square. The first immortal to land here was very bad at drawing.", "When the sea runs out at Guixu, where does it go? Under. Everything goes under in the end. The Underworld chart shows it, if you know how to turn the map over."]))];
    case "im-ying":
      if (!f[met])
        return [
          say("The mist parted for you, so it must like you. It does not like Xu Fu."),
          say("Bow to the turtle first. It is under your feet, and it has been very patient."),
          { anim: "hero", name: "turtlebow", wait: true },
          say("Jade grass, from the meadow below. It wakes the dead, though not kindly. For the living it does well enough. Take a sprig, and the pills I made from the last."),
          { mutate: (s) => ({ ...flag(s, met), pills: { heal: Math.min(99, s.pills.heal + 3), qi: Math.min(99, s.pills.qi + 3) } }) },
          { toast: "Received 3 Healing Pills and 3 Qi Gathering Pills" },
          say("Go and see the Last Lamp, when you have seen all three of us. The Watcher waits for visitors. He has had four."),
        ];
      return [say(pick(g, ["Listen. That is the turtle under us, breathing. Once a year it breathes out.", "The flute is for the mist. It comes in when I play and goes out when I stop. We have an arrangement.", "Penglai has the elixir, Fangzhang the pool, and we have the mist. Everybody wants the elixir. Nobody asks what the mist is for."]))];
    case "im-lamp":
      if (!metAllMasters(f))
        return [
          ...first,
          say("A visitor. Good. Sit, if you can find a dry rock. There is one. It is mine, but sit."),
          say("You have not been to all three isles yet. Go. Then come back, and I will tell you what is at the edge of the world. It is a short story, but it is better at the end of a long walk."),
        ];
      if (!f["im:rim"])
        return [
          ...first,
          say("All three. Then you have earned the short story."),
          say("The world has no shore at its edge. The Encircling Sea runs out to a lip, all the way round, and over the lip it falls into the clouds under everything. Guixu is where the lip bends in, like a drain in a basin."),
          say("Every river under heaven comes here in the end. Every rain. Every tear, the monks say, though monks say that kind of thing. It has never filled. Nobody knows where it goes."),
          { anim: "hero", name: "rimgaze", wait: true },
          say("I keep the lamp lit so the water has something to look back at, on its way down. That is all. It is not a great work. But someone should."),
          { mutate: (s) => gainCultivation(shift(flag(s, "im:rim"), CULT.insight, 1), Math.round(cultivationNeeded(s.realm, s.stage) * 0.4)).state },
          { toast: "The rim of the world · Insight +1" },
        ];
      return [say(pick(g, ["Still falling. Still not full.", "A fish came up out of Guixu once. Just the one. It looked very surprised.", "If you fly too near the lip, the wind will push you back. It is the only kind thing the edge of the world does."]))];
    case "im-xu":
      return [...first, say(pick(g, ["The First Emperor sent me for the elixir with three thousand boys and girls. I found the isle. They will not give it to me. I have been asking for two thousand years. I think it is a matter of time.", "Do not tell the emperor I found it. Any emperor. They all want the same thing."]))];
    case "im-peach":
      if (!f[met]) return [...first, say("One. You may pick one. Smell it, do not eat it: it is three thousand years from ripe."), { anim: "hero", name: "peachpick", wait: true }, say("There. Now you have smelled what the Queen Mother counts.")];
      return [say(pick(g, ["One peach every three thousand years per tree. The Queen Mother counts them. She is very good at counting.", "You may smell the peaches. Smelling is free."]))];
    case "im-crane":
      if (!f[met]) return [...first, say("Stand like them! On one leg! Bao says you are doing it wrong."), { anim: "hero", name: "cranestance", wait: true }, say("Bao says that was better. Bao is being kind.")];
      return [say(pick(g, ["This one is called Bao. That one is also called Bao. I am very bad at names.", "They only eat what you hold flat on your hand. Like a horse. Do not tell them I said they were like a horse."]))];
    case "im-gatewarden":
      return [...first, say(pick(g, ["The Golden Terraces. Wipe your feet. Mortals track the mainland in with them.", "No one has tried to steal the elixir in four hundred years. I am beginning to feel unnecessary."]))];
    case "im-pool":
      return [...first, say(pick(g, ["One sip. I count.", "The pool does not get lower. It gets older."]))];
    case "im-chess":
      return [...first, say(pick(g, ["Shh. He is about to move. He has been about to move for nine hundred years.", "I am winning. I have been winning since the Zhou. He disagrees."]))];
    case "im-grass":
      return [...first, say(pick(g, ["Do not step on the jade grass. It remembers.", "I pick it at dawn, before the mist is awake enough to argue."]))];
    case "im-turtle":
      return [...first, say(pick(g, ["The turtle under Yingzhou is the youngest. Only eleven thousand. It fidgets.", "If you see the sea bulge, that is the turtle yawning. Stand on something high."]))];
    default:
      return [...first, say("…")];
  }
}

/** Who on the isles has something for her: each master the first time, and the Watcher once she has met all three. */
export function immortalHasNews(key: string, g: GameState): boolean {
  const f = g.flags;
  if ((MASTERS as readonly string[]).includes(key)) return !f[`im:met:${key}`];
  if (key === "im-lamp") return !f["im:rim"] && (metAllMasters(f) || !f["im:met:im-lamp"]);
  return false;
}
