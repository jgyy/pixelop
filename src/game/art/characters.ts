import type { PixelBuffer } from "../pixel/PixelBuffer";
import type { V3 } from "../iso/raster";
import { BEAST_H, BEAST_OX, BEAST_OY, BEAST_W, DUNE_WYRM, EMBER_WYRM, FOX_STYLE, FROSTFANG_STYLE, paintBat, paintCrane, paintQuad, paintSerpent, PEARL_WYRM, RIME_WYRM, SHADOW_VIXEN_STYLE, STONEHOUND_STYLE, WOLF_STYLE, type BeastPose } from "./beasts";
import { CLOUDMANE, gaitAt, HORSE_H, HORSE_OX, HORSE_OY, HORSE_W, paintHorse, paintRider, RIDER_H, RIDER_OX, RIDER_OY, RIDER_W, WILD_HORSE, type HorsePose } from "./horse";
import { HUMAN_H, HUMAN_OX, HUMAN_OY, HUMAN_W, paintHuman, REST_HAND_L, REST_HAND_R, type HumanPose, type HumanStyle } from "./humanoid";
import { PAL, ramp } from "./palette";

/**
 * Every character in the game: a style plus a set of animations. Frames are
 * painted lazily per (animation, direction) and memoised, so a sprite only
 * pays for the directions it actually faces.
 */

export const DIRS = 16;
const TAU = Math.PI * 2;

/** Facing angle for a direction index: 0 faces the viewer, 4 faces screen-right, 8 faces away. */
export const dirAngle = (dir: number) => (((dir % DIRS) + DIRS) % DIRS) * (TAU / DIRS);

/** Direction index for a movement vector in world tile units. */
export function dirFromWorld(dx: number, dy: number): number {
  const a = Math.atan2(dx - dy, dx + dy);
  return ((Math.round(a / (TAU / DIRS)) % DIRS) + DIRS) % DIRS;
}

export type AnimId =
  | "idle"
  | "walk"
  | "run"
  | "talk"
  | "attack"
  | "cast"
  | "hurt"
  | "meditate"
  | "fly"
  | "victory"
  | "defeat"
  | "hop"
  | "practice"
  | "fish"
  | "bow"
  | "wave"
  | "gather"
  | "stretch"
  | "look"
  | "sweep"
  | "sleep"
  | "drink"
  | "dance"
  | "cheer"
  | "point"
  | "nod"
  | "howl"
  | "sniff"
  | "peck"
  | "read"
  | "sit"
  | "pray"
  | "weave"
  | "pour"
  | "clap"
  | "laugh"
  | "tell"
  | "graze"
  | "rear"
  | "flute"
  | "eat"
  | "juggle"
  | "fan"
  | "salute"
  | "twirl"
  | "hammer"
  | "write"
  | "float"
  | "lantern"
  | "hoe"
  | "chop"
  | "carry"
  | "kick"
  | "umbrella"
  | "taichi"
  | "mine"
  | "torch"
  | "brew"
  | "flame"
  | "kowtow"
  | "sworddance"
  | "cower"
  | "rake"
  | "plant"
  | "snowball"
  | "kite"
  | "shiver"
  | "warmhands"
  | "yawn"
  | "stargaze"
  | "offer"
  | "think"
  | "shrug"
  | "cry"
  | "levitate"
  | "roar"
  | "plantsword"
  | "march"
  | "spear"
  | "banner"
  | "drum"
  | "bandage"
  | "horn"
  | "grieve"
  | "rally"
  | "shieldwall"
  | "liondance"
  | "acrobat"
  | "puppet"
  | "abacus"
  | "firecracker"
  | "hawk"
  | "xiangqi"
  | "row"
  | "comprehend"
  | "domain"
  | "spar"
  | "lecture"
  | "tiptoe"
  | "token"
  | "scrub"
  | "bucket"
  | "pillow"
  | "pant"
  | "climb"
  | "rummage"
  | "shade"
  | "beckon"
  | "huddle"
  | "chant"
  | "rubbing"
  | "castnet"
  | "slingshot"
  | "dig"
  | "peer"
  | "embrace"
  | "holdup"
  | "kneel"
  | "stamp"
  | "weigh"
  | "lean"
  | "toast"
  | "beg"
  | "decree"
  | "haggle"
  | "bear"
  | "whisper"
  | "moondance"
  | "weep"
  | "carve"
  | "glide"
  | "firebreath"
  | "knot"
  | "offerpearl"
  | "hearthsong";

export interface Anim {
  fps: number;
  loop: boolean;
  frames: PixelBuffer[];
}

interface AnimSpec<P> {
  n: number;
  fps: number;
  loop: boolean;
  pose: (i: number, n: number) => P;
}

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  w: number;
  h: number;
  ox: number;
  oy: number;
  anims: AnimId[];
  /** Whether this character has a dialogue portrait. */
  portrait: boolean;
}

// ----------------------------------------------------------------------------- human poses
const ph = (i: number, n: number) => (i / n) * TAU;
const W_BACK: V3 = [0, -0.35, 0];

const human: Partial<Record<AnimId, AnimSpec<HumanPose>>> = {
  idle: {
    n: 6,
    fps: 5,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), bob: i >= 2 && i <= 3 ? 0.6 : 0, eyes: i === 4 ? "blink" : "open", mouth: "smile", wind: [Math.sin(ph(i, n)) * 0.2, -0.3, 0] }),
  },
  walk: {
    n: 8,
    fps: 11,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      return {
        t: a * 2,
        bob: Math.abs(Math.cos(a)) * 0.9,
        footL: [-1.7, s * 3.2, Math.max(0, Math.cos(a)) * 1.3],
        footR: [1.7, -s * 3.2, Math.max(0, -Math.cos(a)) * 1.3],
        handL: [-4.5, 0.6 - s * 2.4, 11.6],
        handR: [4.5, 0.6 + s * 2.4, 11.6],
        lean: 0.04,
        mouth: "smile",
        wind: [0, -0.9, 0],
      };
    },
  },
  run: {
    n: 8,
    fps: 15,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      const c = Math.cos(a);
      return {
        t: a * 2,
        bob: Math.abs(c) * 1.5,
        footL: [-1.6, s * 4.6, Math.max(0, c) * 2.6],
        footR: [1.6, -s * 4.6, Math.max(0, -c) * 2.6],
        handL: [-4.1, 1.6 - s * 3.8, 13 + Math.max(0, -s) * 1.6],
        handR: [4.1, 1.6 + s * 3.8, 13 + Math.max(0, s) * 1.6],
        lean: 0.17,
        mouth: i % 4 === 1 ? "open" : "smile",
        wind: [Math.sin(a) * 0.3, -2.3, 0.4],
      };
    },
  },
  wave: {
    n: 6,
    fps: 7,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), handR: [4.6 + Math.sin(ph(i, n)) * 1.6, 1.8, 23 + Math.cos(ph(i, n)) * 0.6], mouth: i % 3 === 0 ? "open" : "smile", eyes: i === 4 ? "blink" : "open", bob: i % 3 === 1 ? 0.4 : 0, wind: [0, -0.3, 0] }),
  },
  gather: {
    n: 7,
    fps: 8,
    loop: false,
    pose: (i) =>
      (
        [
          { t: 0, lean: 0.1, handR: [3.8, 2.2, 11] },
          { t: 0.5, stance: "kneel", lean: 0.2, handR: [2.4, 5, 6.5], handL: [-3.6, 2.4, 9] },
          { t: 1, stance: "kneel", lean: 0.26, handR: [2, 6, 3.4], handL: [-3, 3.2, 8], eyes: "closed" },
          { t: 1.5, stance: "kneel", lean: 0.24, handR: [1.8, 5.8, 3.8], handL: [-1.6, 5.4, 5.4], eyes: "closed" },
          { t: 2, stance: "kneel", lean: 0.12, handR: [1.8, 4.4, 10.5], handL: [-1.8, 4.4, 10.5], mouth: "open" },
          { t: 2.5, lean: 0.02, handR: [2, 4.2, 14], handL: [-2, 4.2, 14], mouth: "smile" },
          { t: 3, handR: [2.2, 3.4, 13], handL: [-2.2, 3.4, 13], mouth: "smile", eyes: "closed" },
        ] as HumanPose[]
      )[i],
  },
  stretch: {
    n: 8,
    fps: 6,
    loop: false,
    pose: (i) => {
      const up = [0, 0.5, 1, 1, 1, 0.7, 0.3, 0][i];
      return { t: i * 0.7, lean: -0.1 * up, bob: up * 0.8, handL: [-2.6 - up, 0.6, 11.2 + up * 15], handR: [2.6 + up, 0.6, 11.2 + up * 15], eyes: up > 0.6 ? "closed" : i === 7 ? "blink" : "open", mouth: up > 0.9 ? "open" : "smile", footL: [-1.7 - up * 0.5, 0, 0], footR: [1.7 + up * 0.5, 0, 0], wind: [0, -0.2, up * 0.4] };
    },
  },
  look: {
    n: 8,
    fps: 5,
    loop: false,
    pose: (i) => {
      const sway = [0, -0.6, -1, -1, 0.2, 1, 1, 0][i];
      return { t: i, lean: 0.03, handL: [-4.2, 0.4 + sway * 0.6, 11.4], handR: [3.2, 2.6, 16 + Math.abs(sway) * 1.6], footL: [-1.7, sway * 0.6, 0], footR: [1.7, -sway * 0.6, 0], eyes: i === 4 ? "blink" : "open", mouth: i > 4 ? "neutral" : "smile", wind: [sway * 0.5, -0.3, 0] };
    },
  },
  talk: {
    n: 4,
    fps: 4,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), handR: [3.6, 3.4, 14.5 + (i % 2) * 1.2], mouth: i % 2 ? "open" : "smile", eyes: i === 3 ? "blink" : "open", wind: W_BACK }),
  },
  attack: {
    n: 6,
    fps: 14,
    loop: false,
    pose: (i) =>
      (
        [
          { t: 0, handR: [3.6, -1.6, 19], swordDir: [0.25, -0.5, 0.85], lean: -0.05, eyes: "fierce" },
          { t: 0.6, handR: [3.8, -0.6, 21.5], swordDir: [0, -0.15, 1], lean: -0.06, eyes: "fierce", footR: [1.7, 1.6, 0] },
          { t: 1.2, handR: [3, 5, 17.5], swordDir: [-0.2, 0.95, 0.25], lean: 0.08, eyes: "fierce", footR: [1.7, 3, 0], wind: [0, -1, 0] },
          { t: 1.8, handR: [1.2, 6.4, 13], swordDir: [-0.65, 0.65, -0.35], lean: 0.16, eyes: "fierce", footR: [1.7, 3.4, 0], wind: [0, -1.2, 0], mouth: "open" },
          { t: 2.4, handR: [-0.4, 5.8, 11], swordDir: [-0.85, 0.35, -0.4], lean: 0.14, eyes: "fierce", footR: [1.7, 3.2, 0], wind: [0, -0.8, 0] },
          { t: 3, handR: [4, 3, 12], swordDir: [0.2, 0.8, -0.5], lean: 0.04, mouth: "smile" },
        ] as Omit<HumanPose, "sword">[]
      )[i] as HumanPose,
  },
  cast: {
    n: 6,
    fps: 10,
    loop: false,
    pose: (i, n) => ({
      t: ph(i, n),
      handL: [-2.2, 5.4 + Math.min(i, 3) * 0.5, 15],
      handR: [2.2, 5.4 + Math.min(i, 3) * 0.5, 15],
      footR: [1.7, 2.2, 0],
      lean: 0.08,
      eyes: "fierce",
      mouth: i > 2 ? "open" : "neutral",
      wind: [0, -1.1, 0.2],
    }),
  },
  hurt: {
    n: 3,
    fps: 8,
    loop: false,
    pose: (i) => ({ t: i, lean: -0.14 + i * 0.03, eyes: "hurt", mouth: "open", flash: i === 0 ? 0.7 : 0, handL: [-4.8, -1, 13], handR: [4.8, -1, 13], wind: [0, 0.6, 0] }),
  },
  meditate: {
    n: 4,
    fps: 3,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), stance: "sit", handL: [-2, 3.2, 12.4], handR: [2, 3.2, 12.4], eyes: "closed", mouth: "smile", bob: i >= 2 ? 0.5 : 0, wind: [Math.sin(ph(i, n)) * 0.3, -0.2, 0.3] }),
  },
  fly: {
    n: 4,
    fps: 8,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n) * 2, sword: "under", footL: [-1.5, -1.6, 0], footR: [1.5, 1.4, 0], handL: [-5, -2.5, 12.5], handR: [4.4, 1.6, 12], lean: 0.1, mouth: "smile", wind: [Math.sin(ph(i, n)) * 0.3, -1.6, 0] }),
  },
  victory: {
    n: 4,
    fps: 5,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), handR: [3, 1.5, 25.5], swordDir: [0.05, 0.15, 1], sword: "hand", mouth: "smile", eyes: i === 3 ? "blink" : "open", bob: i % 2 ? 0.5 : 0, wind: [0, -0.5, 0] }),
  },
  defeat: {
    n: 3,
    fps: 5,
    loop: false,
    pose: (i) => ({ t: i, stance: i === 0 ? "stand" : "kneel", lean: i === 0 ? -0.1 : 0.12, eyes: i === 0 ? "hurt" : "closed", handL: [-3.8, 2.4, 9], handR: [3.8, 2.4, 9], flash: i === 0 ? 0.4 : 0 }),
  },
  hop: {
    n: 6,
    fps: 9,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), lift: Math.abs(Math.sin(ph(i, n) / 2)) * 4, footL: [-1.1, 0, 0], footR: [1.1, 0, 0], handL: [-2.6, 8.4, 17.6], handR: [2.6, 8.4, 17.6], eyes: "closed", mouth: "neutral", wind: [0, -0.4, -0.6] }),
  },
  practice: {
    n: 8,
    fps: 8,
    loop: true,
    pose: (i) => {
      const keys: Partial<HumanPose>[] = [
        { handR: [3.6, -1.4, 19], swordDir: [0.25, -0.5, 0.85] },
        { handR: [3.8, -0.4, 21.5], swordDir: [0, -0.1, 1] },
        { handR: [3, 5, 17.5], swordDir: [-0.2, 0.95, 0.25], footR: [1.7, 2.6, 0], lean: 0.08 },
        { handR: [1.2, 6.2, 13], swordDir: [-0.65, 0.65, -0.35], footR: [1.7, 3, 0], lean: 0.14 },
        { handR: [1.4, 6, 13.5], swordDir: [-0.6, 0.7, -0.3], footR: [1.7, 3, 0], lean: 0.12 },
        { handR: [4, 4, 15], swordDir: [0.1, 1, 0.1], footR: [1.7, 1.6, 0], lean: 0.06 },
        { handR: [4.4, 6, 15.5], swordDir: [0, 1, 0], footR: [1.7, 2.4, 0], lean: 0.1 },
        { handR: [4, 2.4, 13], swordDir: [0.2, 0.8, -0.5] },
      ];
      return { t: i, sword: "hand", eyes: "fierce", wind: [0, -0.6, 0], ...keys[i] } as HumanPose;
    },
  },
  fish: {
    n: 4,
    fps: 2,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), stance: "sit", handL: [-1.4, 4.4, 13.4], handR: [1.2, 4.6, 13.6], eyes: i === 2 ? "blink" : "closed", mouth: "smile", bob: i % 2 ? 0.4 : 0 }),
  },
  bow: {
    n: 4,
    fps: 4,
    loop: false,
    pose: (i) => ({ t: i, lean: [0, 0.18, 0.26, 0.26][i], handL: [-1.2, 4.6, 15], handR: [1.2, 4.6, 15], eyes: i > 0 ? "closed" : "open", mouth: "smile" }),
  },
  sweep: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const s = Math.sin(ph(i, n));
      return { t: ph(i, n), lean: 0.16, handR: [2.4 + s * 3, 5.6, 9.5 + Math.abs(s)], handL: [-0.6 + s * 2.4, 4.6, 13.5], footR: [1.7, 1.2, 0], eyes: i % 4 === 3 ? "blink" : "open", mouth: "neutral", wind: [s * 0.4, -0.3, 0] };
    },
  },
  sleep: {
    n: 8,
    fps: 2,
    loop: true,
    pose: (i) => ({ t: i * 0.4, stance: "sit", lean: 0.2 + (i % 2) * 0.05, bob: (i % 2) * -0.5, handL: [-2.4, 3.6, 11.6], handR: [2.4, 3.6, 11.6], eyes: "closed", mouth: i % 4 === 2 ? "open" : "neutral", wind: [0, -0.2, 0] }),
  },
  drink: {
    n: 7,
    fps: 6,
    loop: false,
    pose: (i) => {
      const up = [0, 0.5, 1, 1, 1, 0.5, 0][i];
      return { t: i, lean: -0.06 * up, handR: [3.6 - up * 2.4, 1 + up * 3.6, 11.4 + up * 10], handL: [-3.4 + up * 1.4, 2 + up * 2, 12 + up * 3], eyes: up > 0.9 ? "closed" : "open", mouth: up > 0.9 ? "open" : "smile", wind: [0, -0.3, 0] };
    },
  },
  dance: {
    n: 8,
    fps: 8,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      const c = Math.cos(a);
      return {
        t: a * 2,
        lift: Math.abs(Math.sin(a)) * 1.6,
        lean: c * 0.06,
        handL: [-4.4 - c * 1.6, 1.4 + s * 2.4, 16 + s * 6],
        handR: [4.4 - c * 1.6, 1.4 - s * 2.4, 16 - s * 6],
        footL: [-1.7 - Math.max(0, s) * 1.2, s * 1.4, Math.max(0, s) * 1.4],
        footR: [1.7 + Math.max(0, -s) * 1.2, -s * 1.4, Math.max(0, -s) * 1.4],
        eyes: i === 5 ? "closed" : "open",
        mouth: i % 2 ? "grin" : "smile",
        wind: [s * 0.8, -0.6, c * 0.4],
      };
    },
  },
  cheer: {
    n: 6,
    fps: 9,
    loop: false,
    pose: (i) => {
      const up = [0.2, 0.8, 1, 0.6, 1, 0.7][i];
      return { t: i, lift: [0, 2.6, 3.6, 0, 2.4, 0][i], handL: [-3.2 - up, 1, 14 + up * 13], handR: [3.2 + up, 1, 14 + up * 13], eyes: i > 1 ? "closed" : "open", mouth: "grin", wind: [0, -0.2, -0.8 * up] };
    },
  },
  point: {
    n: 5,
    fps: 6,
    loop: false,
    pose: (i) => {
      const k = [0, 0.6, 1, 1, 1][i];
      return { t: i, lean: 0.06 * k, handR: [3.8 - k * 1.2, 1 + k * 8.4, 12 + k * 5.6], footR: [1.7, k * 1.4, 0], eyes: "open", mouth: i >= 3 ? "open" : "smile", wind: [0, -0.4, 0] };
    },
  },
  nod: {
    n: 6,
    fps: 7,
    loop: false,
    pose: (i) => ({ t: i, lean: [0, 0.1, 0.16, 0.04, 0.14, 0][i], bob: [0, -0.3, -0.5, 0, -0.4, 0][i], eyes: i === 2 || i === 4 ? "closed" : "open", mouth: "smile" }),
  },
  // reading a book held at the chest, eyes down, turning a page now and then
  read: {
    n: 8,
    fps: 4,
    loop: true,
    pose: (i) => {
      const turn = i === 5 ? 1 : i === 6 ? 0.5 : 0;
      return { t: i * 0.5, lean: 0.12, handL: [-1.8, 5, 14.4], handR: [1.8 - turn * 3, 5 + turn * 0.6, 14.4 + turn * 1.4], eyes: i === 3 ? "blink" : "closed", mouth: i === 6 ? "smile" : "neutral", bob: i % 4 === 2 ? 0.3 : 0, wind: [0, -0.2, 0] };
    },
  },
  // sitting on a stool or cushion, hands on the knees, breathing
  sit: {
    n: 4,
    fps: 3,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), stance: "sit", handL: [-2.8, 3.8, 11.2], handR: [2.8, 3.8, 11.2], bob: i >= 2 ? 0.4 : 0, eyes: i === 3 ? "blink" : "open", mouth: "smile", wind: [0, -0.2, 0] }),
  },
  // kneeling with palms pressed together, bowing low and rising again
  pray: {
    n: 8,
    fps: 4,
    loop: true,
    pose: (i) => {
      const low = [0, 0.1, 0.25, 0.34, 0.34, 0.25, 0.1, 0][i];
      return { t: i * 0.4, stance: "kneel", lean: 0.04 + low, handL: [-0.6, 4.2, 16 - low * 3], handR: [0.6, 4.2, 16 - low * 3], eyes: "closed", mouth: "neutral", wind: [0, -0.2, 0] };
    },
  },
  // seated at the loom: the shuttle passes from hand to hand and the beater comes down
  weave: {
    n: 8,
    fps: 7,
    loop: true,
    pose: (i, n) => {
      const s = Math.sin(ph(i, n));
      const beat = i === 2 || i === 6 ? 1 : 0;
      return { t: ph(i, n), stance: "sit", lean: 0.1 + beat * 0.06, handL: [-2.4 + s * 2.6, 5.4 + beat, 12.6], handR: [2.4 + s * 2.6, 5.4 + beat, 12.6], eyes: i === 4 ? "blink" : "open", mouth: "neutral", wind: [s * 0.2, -0.2, 0] };
    },
  },
  // lifting a teapot and pouring a long stream into a cup
  pour: {
    n: 8,
    fps: 6,
    loop: false,
    pose: (i) => {
      const up = [0, 0.5, 1, 1, 1, 1, 0.5, 0][i];
      return { t: i, lean: 0.06 * up, handR: [3.6 - up * 0.8, 1 + up * 4.6, 11.4 + up * 7], handL: [-3.4 + up * 2.4, 1 + up * 4, 11.4 + up * 2], eyes: i === 4 ? "blink" : "open", mouth: "smile", wind: [0, -0.3, 0] };
    },
  },
  clap: {
    n: 6,
    fps: 9,
    loop: false,
    pose: (i) => {
      const shut = i % 2 === 1;
      return { t: i, bob: shut ? 0.3 : 0, handL: shut ? [-0.7, 4, 15.6] : [-3.6, 3.2, 15], handR: shut ? [0.7, 4, 15.6] : [3.6, 3.2, 15], eyes: i > 2 ? "closed" : "open", mouth: "grin", wind: [0, -0.3, 0] };
    },
  },
  laugh: {
    n: 6,
    fps: 7,
    loop: false,
    pose: (i) => ({ t: i, lean: -0.08, bob: i % 2 ? 0.7 : 0, handL: [-1.8, 3.6, 10.6], handR: [3.8, 2.2, 13 + (i % 2) * 1.2], eyes: "closed", mouth: i % 2 ? "open" : "grin", wind: [0, -0.2, 0] }),
  },
  // a seated storyteller's sweeping gestures
  tell: {
    n: 8,
    fps: 5,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      const c = Math.cos(a);
      return { t: a, stance: "sit", lean: 0.04 + c * 0.04, handR: [3.6 + s * 1.6, 3 + c * 2.2, 15 + Math.max(0, s) * 4], handL: [-3.2 + Math.max(0, -s) * -1.4, 2.6, 13 + Math.max(0, -s) * 3], eyes: i === 6 ? "closed" : "open", mouth: i % 2 ? "open" : "smile", wind: [s * 0.3, -0.2, 0] };
    },
  },
  // playing the bamboo dizi: eyes closed, fingers lifting along the flute, swaying to the tune
  flute: {
    n: 8,
    fps: 5,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const f = i % 2 ? 0.4 : 0;
      return { t: a, held: "flute", lean: Math.sin(a) * 0.05, bob: Math.max(0, Math.sin(a * 2)) * 0.4, handL: [1.4, 4.8, 21 + f], handR: [5.2, 3.8, 20.6 - f], eyes: i === 3 ? "blink" : "closed", mouth: "neutral", wind: [Math.sin(a) * 0.4, -0.3, 0] };
    },
  },
  // a bowl of noodles: chopsticks dip to the bowl and up to the mouth
  eat: {
    n: 8,
    fps: 6,
    loop: false,
    pose: (i) => {
      const up = [0, 0.4, 1, 1, 0.3, 0, 0.6, 1][i];
      return { t: i, held: "bowl", lean: 0.05, handL: [-1.2, 4.2, 14.2 + up * 1.6], handR: [1.2, 4.6 - up * 0.4, 14.8 + up * 5.6], eyes: up > 0.9 ? "closed" : "open", mouth: up > 0.9 ? "open" : "smile", wind: [0, -0.2, 0] };
    },
  },
  // three bright balls tossed in a shower
  juggle: {
    n: 8,
    fps: 9,
    loop: false,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a * 2, held: "balls", handL: [-2.6, 4, 14.4 + Math.max(0, Math.sin(a * 2)) * 1.4], handR: [2.6, 4, 14.4 + Math.max(0, -Math.sin(a * 2)) * 1.4], bob: i % 2 ? 0.3 : 0, eyes: "open", mouth: i % 4 === 2 ? "grin" : "smile", wind: [0, -0.3, 0] };
    },
  },
  // cooling off with a folding fan
  fan: {
    n: 6,
    fps: 7,
    loop: false,
    pose: (i, n) => {
      const s = Math.sin(ph(i, n) * 2);
      return { t: i, lean: -0.04, handR: [3.6 + s * 0.8, 4.2, 19.4 + s * 1.2], eyes: i === 3 ? "blink" : "open", mouth: "smile", wind: [s * 0.3, -0.4, 0.2] };
    },
  },
  // the cultivator's salute: right fist into the left palm before the chest, and a small bow
  salute: {
    n: 6,
    fps: 6,
    loop: false,
    pose: (i) => {
      const k = [0, 0.7, 1, 1, 1, 0.4][i];
      return { t: i, lean: [0, 0.04, 0.12, 0.14, 0.08, 0][i], handL: [-0.4 - (1 - k) * 3.6, 4.6 * k + 0.6, 11.2 + k * 5.4], handR: [0.5 + (1 - k) * 3.6, 4.4 * k + 0.6, 11.2 + k * 5.2], eyes: i === 3 ? "closed" : "open", mouth: i >= 2 ? "smile" : "neutral", wind: [0, -0.3, 0] };
    },
  },
  // a twirl on the spot that flares the skirts out (the facing turns a full circle, see paintFrame)
  twirl: {
    n: 8,
    fps: 10,
    loop: false,
    pose: (i, n) => {
      const a = ph(i, n);
      const out = Math.sin((i / (n - 1)) * Math.PI);
      return { t: a * 2, lift: out * 1.2, handL: [-5 - out * 2.4, 0.4, 13 + out * 5], handR: [5 + out * 2.4, 0.4, 13 + out * 5], eyes: i > 2 && i < 6 ? "closed" : "open", mouth: "grin", wind: [-1.6 * out, 0.8 * out, 0.6 * out] };
    },
  },
  // a smith at the anvil: the hammer rises over the shoulder and rings down
  hammer: {
    n: 6,
    fps: 8,
    loop: true,
    pose: (i) => {
      const up = [0.2, 0.7, 1, 0.6, 0, 0][i];
      return { t: i, held: "hammer", lean: 0.12 - up * 0.08, handR: [3.4, 3 + (1 - up) * 2.6, 12 + up * 10], handL: [-2.6, 4.6, 11], footR: [1.7, 1.4, 0], eyes: up < 0.1 ? "closed" : "fierce", mouth: up < 0.1 ? "open" : "neutral", wind: [0, -0.3, 0] };
    },
  },
  // kneeling at a low desk with a brush: strokes left to right, a pause to dip in the ink
  write: {
    n: 8,
    fps: 4,
    loop: true,
    pose: (i) => {
      const x = [-1.6, -0.6, 0.4, 1.4, 2.2, 2.2, -2.6, -1.6][i];
      return { t: i * 0.5, held: "brush", stance: "kneel", lean: 0.2, handR: [1.6 + x, 6, 9.6 + (i === 6 ? 1.6 : 0)], handL: [-2.8, 4.6, 10.4], eyes: i === 4 ? "blink" : "closed", mouth: "neutral", wind: [0, -0.2, 0] };
    },
  },
  // a restless shade drifts above the ground, sleeves trailing
  float: {
    n: 8,
    fps: 4,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, lift: 2.6 + Math.sin(a) * 1.2, lean: 0.06, handL: [-3.4, 2.6, 12 + Math.sin(a) * 0.6], handR: [3.4, 2.6, 12 + Math.sin(a + 1) * 0.6], footL: [-1, 0.6, 0], footR: [1, 0.6, 0], eyes: i === 5 ? "blink" : "closed", mouth: "neutral", wind: [Math.sin(a) * 0.6, -0.8, -0.4] };
    },
  },
  // holding a paper lantern up on its pole for the festival, swaying it gently
  lantern: {
    n: 6,
    fps: 4,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), held: "lantern", handR: [3.6, 2.4, 15.4 + Math.sin(ph(i, n)) * 0.6], bob: i % 3 === 1 ? 0.3 : 0, eyes: i === 4 ? "blink" : "open", mouth: "smile", wind: [Math.sin(ph(i, n)) * 0.3, -0.3, 0] }),
  },
  // working the soil: the hoe swings up over the shoulder and bites down into the earth
  hoe: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i) => {
      const up = [0, 0.3, 0.7, 1, 1, 0.6, 0.15, 0][i];
      const L = (a: V3, b: V3): V3 => [a[0] + (b[0] - a[0]) * up, a[1] + (b[1] - a[1]) * up, a[2] + (b[2] - a[2]) * up];
      return { t: i, held: "hoe", lean: 0.18 - up * 0.14, handR: L([2.6, 2.4, 13], [2.6, 1.6, 16]), handL: L([1, 5.6, 9], [1.2, 3.4, 21]), footR: [1.7, 1.4, 0], eyes: up > 0.9 ? "fierce" : "open", mouth: up < 0.1 ? "open" : "neutral", wind: [0, -0.3, 0] };
    },
  },
  // splitting firewood: the axe goes high overhead and comes down hard
  chop: {
    n: 8,
    fps: 7,
    loop: true,
    pose: (i) => {
      const up = [0.1, 0.5, 0.9, 1, 1, 0.5, 0, 0][i];
      return { t: i, held: "axe", lean: 0.16 - up * 0.2, handR: [1.4, 6 - up * 6, 11 + up * 13], handL: [-0.4, 5.6 - up * 6, 10.4 + up * 13], footL: [-2.2, 0, 0], footR: [2.2, 0.6, 0], eyes: up < 0.05 ? "closed" : "fierce", mouth: up < 0.05 ? "open" : "neutral", wind: [0, -0.3, 0] };
    },
  },
  // walking with a carrying pole on the shoulders, baskets swinging in time with the steps
  carry: {
    n: 8,
    fps: 9,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      return { t: a * 2, held: "pole", bob: Math.abs(Math.cos(a)) * 0.7, footL: [-1.7, s * 2.6, Math.max(0, Math.cos(a)) * 1.1], footR: [1.7, -s * 2.6, Math.max(0, -Math.cos(a)) * 1.1], handL: [-4.2, 0.2, 18.6], handR: [4.2, 0.2, 18.6], lean: 0.08, mouth: "smile", wind: [0, -0.6, 0] };
    },
  },
  // keeping a feathered shuttlecock in the air with the side of the foot
  kick: {
    n: 8,
    fps: 8,
    loop: true,
    pose: (i) => {
      const kicking = i === 7 || i === 0;
      return { t: i, held: "shuttlecock", toss: [3.4, 5.6, [7, 16, 25, 30, 25, 16, 9, 6][i]], footR: kicking ? [2.2, 2.4, 3.4] : [1.7, 0, 0], handL: [-5.6, 1, 13.6], handR: [5.6, 1, 13.6], lift: kicking ? 0.4 : 0, lean: kicking ? -0.06 : 0, eyes: "open", mouth: kicking ? "grin" : "smile", wind: [0, -0.3, 0] };
    },
  },
  // strolling under an oiled-paper umbrella, twirling it now and then
  umbrella: {
    n: 6,
    fps: 4,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), held: "umbrella", handR: [2.4, 2.6, 14.6], handL: [-1.4, 3.6, 12.6], bob: i % 3 === 1 ? 0.3 : 0, eyes: i === 4 ? "blink" : "open", mouth: "smile", wind: [Math.sin(ph(i, n)) * 0.3, -0.3, 0] }),
  },
  // the slow, flowing forms of taiji: arms circling as the weight shifts from foot to foot
  taichi: {
    n: 12,
    fps: 4,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const w = Math.sin(a);
      return {
        t: a,
        lean: 0.04,
        bob: -0.6 - Math.abs(Math.cos(a)) * 0.4,
        footL: [-2.8, 0.6, 0],
        footR: [2.8, -0.4, 0],
        handL: [-3.6 + Math.sin(a) * 2.4, 3.4 + Math.cos(a) * 2, 14.6 + Math.sin(a) * 3.4],
        handR: [3.6 + Math.sin(a + Math.PI) * 2.4, 3.4 + Math.cos(a + Math.PI) * 2, 14.6 + Math.sin(a + Math.PI) * 3.4],
        eyes: "closed",
        mouth: "neutral",
        wind: [w * 0.5, -0.3, 0],
      };
    },
  },
  // a miner's pick swung two-handed into the rock face, chips flying on the stroke
  mine: {
    n: 8,
    fps: 8,
    loop: true,
    pose: (i) => {
      const up = [0.2, 0.6, 1, 1, 0.7, 0.2, 0, 0][i];
      return { t: i, held: "pickaxe", lean: 0.2 - up * 0.2, handR: [2.4, 6 - up * 2.6, 10.6 + up * 10], handL: [0.4, 5.4 - up * 2.6, 10 + up * 9], footL: [-2.2, -0.6, 0], footR: [2.2, 0.8, 0], eyes: up < 0.1 ? "closed" : "fierce", mouth: up < 0.1 ? "open" : "neutral", wind: [0, -0.3, 0] };
    },
  },
  // holding a burning torch high to light the way, the flame bending and leaping
  torch: {
    n: 6,
    fps: 8,
    loop: true,
    pose: (i, n) => ({ t: ph(i, n), held: "torch", handR: [4.6, 3, 19 + Math.sin(ph(i, n)) * 0.4], bob: i % 3 === 1 ? 0.3 : 0, eyes: i === 4 ? "blink" : "open", mouth: "neutral", wind: [Math.sin(ph(i, n)) * 0.3, -0.4, 0] }),
  },
  // stirring a cauldron with a long ladle, leaning in to sniff the brew
  brew: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, held: "ladle", lean: 0.16 + (i === 5 ? 0.1 : 0), handR: [1.6 + Math.cos(a) * 2.2, 6 + Math.sin(a) * 1.6, 12], handL: [1 + Math.cos(a) * 2.2, 5 + Math.sin(a) * 1.6, 15.4], eyes: i === 5 ? "closed" : "open", mouth: i === 5 ? "smile" : "neutral", wind: [0, -0.3, 0] };
    },
  },
  // a fire palm: a ball of flame gathered between cupped hands, then thrust forward
  flame: {
    n: 8,
    fps: 8,
    loop: false,
    pose: (i) => {
      const push = [0, 0, 0.1, 0.2, 0.4, 1, 1, 0.5][i];
      return { t: i, held: "fireball", lean: -0.04 + push * 0.12, handL: [-2.2, 3 + push * 4, 13.4], handR: [2.2, 3 + push * 4, 13.4], footL: [-2.4, -1.2, 0], footR: [2.4, 1.4, 0], eyes: push > 0.5 ? "fierce" : "closed", mouth: push > 0.5 ? "open" : "neutral", flash: i >= 5 ? 0.25 : 0, wind: [0, -0.8 - push, 0.2] };
    },
  },
  // a kowtow: down on both knees, forehead to the ground, three times
  kowtow: {
    n: 8,
    fps: 5,
    loop: false,
    pose: (i) => {
      const down = [0.2, 0.9, 0.3, 0.9, 0.3, 0.9, 0.4, 0][i];
      return { t: i, stance: "kneel", lean: down * 0.9, handL: [-2.4, 6 + down * 3, 4 + (1 - down) * 6], handR: [2.4, 6 + down * 3, 4 + (1 - down) * 6], eyes: "closed", mouth: "neutral", wind: [0, -0.2, 0] };
    },
  },
  // a sword dance: the blade sweeps round in a circle of light as she spins and lunges
  sworddance: {
    n: 12,
    fps: 10,
    loop: false,
    pose: (i, n) => {
      const a = ph(i, n);
      const out = Math.sin((i / (n - 1)) * Math.PI);
      return { t: a * 2, lift: out * 0.8, lean: Math.sin(a) * 0.12, handR: [Math.cos(a) * 7, Math.sin(a) * 6 + 2, 15 + Math.sin(a * 2) * 4], handL: [-5, -1, 15 + out * 4], swordDir: [Math.cos(a), Math.sin(a), 0.3], footL: [-2.6, Math.sin(a) * 1.4, 0], footR: [2.6, -Math.sin(a) * 1.4, out], eyes: "fierce", mouth: "neutral", wind: [-Math.cos(a) * 1.2, -Math.sin(a) * 1.2, 0.4] };
    },
  },
  // raking fallen leaves into a pile, the bamboo rake drawn back and pushed out
  rake: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const s = Math.sin(ph(i, n));
      return { t: ph(i, n), held: "rake", lean: 0.14, handR: [1.8 + s * 0.6, 4.6 + s * 2.6, 10.6], handL: [0.4 + s * 0.6, 2 + s * 2.6, 14.4], footL: [-2, -0.8, 0], footR: [2, 1, 0], eyes: i % 4 === 3 ? "blink" : "open", mouth: "neutral", wind: [s * 0.3, -0.3, 0] };
    },
  },
  // planting rice seedlings: stoop, press one into the mud, step back, again
  plant: {
    n: 8,
    fps: 5,
    loop: true,
    pose: (i) => {
      const down = [0.2, 0.6, 1, 1, 0.6, 0.3, 0.2, 0.2][i];
      return { t: i, held: "seedling", lean: 0.2 + down * 0.4, handL: [-2.2, 4, 10 - down * 2], handR: [2, 5 + down * 2, 10 - down * 6], footL: [-2.2, -0.6, 0], footR: [2.2, 0.6, 0], eyes: down > 0.9 ? "closed" : "open", mouth: "neutral", wind: [0, -0.2, 0] };
    },
  },
  // scooping up snow, patting it round and lobbing it at somebody
  snowball: {
    n: 10,
    fps: 8,
    loop: false,
    pose: (i) => {
      const crouch = [0.2, 0.8, 1, 0.8, 0.4, 0.2, 0, 0, 0, 0][i];
      const throwK = [0, 0, 0, 0, 0, 0.3, 0.8, 1, 0.6, 0.2][i];
      return { t: i, held: i < 8 ? "snowball" : undefined, stance: crouch > 0.7 ? "kneel" : "stand", lean: crouch * 0.4 - throwK * 0.1, handR: throwK ? [4 - throwK * 2, 2 + throwK * 6, 15 + throwK * 6] : [2, 4.6, 8 + (1 - crouch) * 4], handL: [-2, 4.6, 8 + (1 - crouch) * 4], toss: i >= 7 ? [2, 10 + (i - 7) * 6, 22 + (i - 7) * 2] : undefined, eyes: throwK > 0.7 ? "fierce" : "open", mouth: throwK > 0.7 ? "grin" : "smile", wind: [0, -0.3 - throwK, 0] };
    },
  },
  // flying a paper kite, the string tugging the hand back and forth
  kite: {
    n: 8,
    fps: 5,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, held: "kite", lean: -0.06, handR: [3.4 + Math.sin(a) * 0.8, 3, 17 + Math.cos(a) * 1.2], handL: [-2.6, 2.4, 13], eyes: i === 5 ? "blink" : "open", mouth: i % 4 === 1 ? "open" : "smile", wind: [Math.sin(a) * 0.5, -0.6, 0.2] };
    },
  },
  // shivering in the cold, arms wrapped round, hopping from foot to foot
  shiver: {
    n: 6,
    fps: 10,
    loop: false,
    pose: (i) => {
      const k = i % 2 ? 0.35 : -0.35;
      return { t: i, bob: i % 3 === 0 ? 0.4 : 0, handL: [2.4 + k * 0.2, 3.6, 15.6], handR: [-2.4 + k * 0.2, 3.6, 15.6], footL: [-1.7, 0, i % 2 ? 0.6 : 0], footR: [1.7, 0, i % 2 ? 0 : 0.6], eyes: "closed", mouth: "neutral", wind: [k, -0.2, 0] };
    },
  },
  // rubbing her hands together and blowing on them
  warmhands: {
    n: 8,
    fps: 6,
    loop: false,
    pose: (i) => {
      const rub = Math.sin(i * 1.6) * 0.8;
      const blow = i >= 5;
      return { t: i, lean: 0.04, handL: [-0.8 + rub, 4.6, blow ? 20 : 15], handR: [0.8 + rub, 4.6, blow ? 20 : 15], eyes: blow ? "closed" : "open", mouth: blow ? "open" : "neutral", wind: [0, -0.2, 0] };
    },
  },
  // a big yawn and a stretch of the arms
  yawn: {
    n: 8,
    fps: 5,
    loop: false,
    pose: (i) => {
      const up = [0, 0.4, 0.8, 1, 1, 0.7, 0.3, 0][i];
      return { t: i, lean: -0.08 * up, handL: [-2 - up * 2, 1, 12 + up * 10], handR: [2 + up * 2, 1, 12 + up * 10], eyes: up > 0.5 ? "closed" : "open", mouth: up > 0.5 ? "open" : "neutral", wind: [0, -0.2, 0] };
    },
  },
  // leaning back to look up at the stars, a hand shading her eyes from the lamps
  stargaze: {
    n: 10,
    fps: 4,
    loop: false,
    pose: (i) => {
      const back = [0, 0.4, 0.8, 1, 1, 1, 1, 0.8, 0.4, 0][i];
      return { t: i, lean: -0.22 * back, handR: [2.6, 3.4, 15 + back * 7], handL: [-3, -1.2, 11.6], footL: [-2, 0.4, 0], footR: [2, -0.4, 0], eyes: i === 5 ? "blink" : "open", mouth: back > 0.9 ? "smile" : "neutral", wind: [0, -0.2, 0.2] };
    },
  },
  // cowering: crouched low, arms over the head, trembling
  cower: {
    n: 6,
    fps: 10,
    loop: true,
    pose: (i) => {
      const shiver = i % 2 ? 0.4 : -0.4;
      return { t: i, stance: "kneel", lean: 0.3, bob: -1, handL: [-2 + shiver * 0.3, 3.4, 22], handR: [2 + shiver * 0.3, 3.4, 22], eyes: "closed", mouth: "open", wind: [shiver, -0.2, 0] };
    },
  },
  // holding something precious out in both cupped hands (the Heart, a gift), then lifting it a little
  offer: {
    n: 8,
    fps: 6,
    loop: false,
    pose: (i) => {
      const k = [0, 0.4, 0.8, 1, 1, 1, 0.7, 0.3][i];
      return { t: i, lean: 0.06 + k * 0.08, handL: [-1.4, 2 + k * 4.4, 11.4 + k * 2.6], handR: [1.4, 2 + k * 4.4, 11.4 + k * 2.6], eyes: k === 1 && i === 4 ? "closed" : "open", mouth: "smile", wind: [0, -0.3, 0] };
    },
  },
  // thinking it over: a hand to the chin, the head tipped, a slow nod
  think: {
    n: 8,
    fps: 4,
    loop: false,
    pose: (i) => {
      const k = [0.3, 0.8, 1, 1, 1, 1, 0.8, 0.3][i];
      return { t: i, bob: i === 4 || i === 5 ? 0.4 : 0, lean: -0.02, handR: [1 + (1 - k) * 3, 3.2 * k + 0.6, 11.2 + k * 10.4], handL: [-1.2, 3.4, 15.4 - (1 - k) * 4], eyes: i === 3 ? "closed" : "open", mouth: "neutral", wind: [0, -0.2, 0] };
    },
  },
  // a shrug: palms up, shoulders up, who knows?
  shrug: {
    n: 6,
    fps: 7,
    loop: false,
    pose: (i) => {
      const k = [0, 0.6, 1, 1, 0.6, 0][i];
      return { t: i, bob: k * 0.8, handL: [-4.4 - k * 2, 0.6 + k * 2.4, 11.2 + k * 3.4], handR: [4.4 + k * 2, 0.6 + k * 2.4, 11.2 + k * 3.4], eyes: k === 1 ? "closed" : "open", mouth: k > 0.5 ? "grin" : "smile", wind: [0, -0.3, 0] };
    },
  },
  // weeping: both hands to the face, shoulders shaking
  cry: {
    n: 8,
    fps: 7,
    loop: false,
    pose: (i) => {
      const sob = i % 2 ? 0.5 : 0;
      return { t: i, lean: 0.16, bob: -sob, handL: [-1.6, 4.2, 22.4 - sob], handR: [1.6, 4.2, 22.4 - sob], eyes: "closed", mouth: "open", wind: [0, -0.2, -0.2] };
    },
  },
  // rising off the ground on a column of qi, arms opening wide (ascension, and the crimson throne)
  levitate: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, lift: 4 + Math.sin(a) * 1.4, footL: [-1.2, 0.6, 0.4], footR: [1.2, -0.4, 0], handL: [-6.4, 0.6, 17 + Math.sin(a) * 1.2], handR: [6.4, 0.6, 17 + Math.sin(a) * 1.2], eyes: "closed", mouth: "smile", flash: 0.12, wind: [Math.sin(a) * 0.6, 0, 1.4] };
    },
  },
  // a roar of power: crouch, then fling the arms wide and throw the head back
  roar: {
    n: 8,
    fps: 8,
    loop: false,
    pose: (i) => {
      const k = [0, 0.2, 0.1, 0.8, 1, 1, 1, 0.5][i];
      return { t: i, stance: i < 3 ? "kneel" : "stand", lean: i < 3 ? 0.3 : -0.16 * k, handL: [-3 - k * 4, 2 - k * 2, 11 + k * 12], handR: [3 + k * 4, 2 - k * 2, 11 + k * 12], footL: [-2.4, 0, 0], footR: [2.4, 0, 0], eyes: k > 0.5 ? "glow" : "closed", mouth: k > 0.5 ? "open" : "neutral", flash: k === 1 ? 0.3 : 0, wind: [0, -0.4 - k, 0.8 * k] };
    },
  },
  // driving a sword point-down into the earth and kneeling behind it (a vow, a grave, a surrender)
  plantsword: {
    n: 8,
    fps: 6,
    loop: false,
    pose: (i) => {
      const k = [0, 0.4, 0.8, 1, 1, 1, 1, 1][i];
      return { t: i, sword: "hand", swordDir: [0, 0.1, -1], stance: i >= 4 ? "kneel" : "stand", lean: 0.1 * k, handR: [0.6, 3 + k * 2, 18 - k * 4], handL: [-0.6, 3 + k * 2, 17 - k * 4], eyes: i >= 5 ? "closed" : "fierce", mouth: "neutral", wind: [0, -0.3, 0] };
    },
  },
  // marching in step: the spear held upright at the shoulder, the free arm swinging, knees high
  march: {
    n: 8,
    fps: 10,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      return { t: a * 2, bob: Math.abs(Math.cos(a)) * 1.1, footL: [-1.7, s * 3, Math.max(0, Math.cos(a)) * 2], footR: [1.7, -s * 3, Math.max(0, -Math.cos(a)) * 2], handL: [-4.4, 0.6 - s * 2.6, 12], handR: [4.2, 1.2, 12.6], lean: 0.02, eyes: "fierce", mouth: "neutral", wind: [0, -0.9, 0] };
    },
  },
  // spear drill: crouch, thrust, recover, as a squad does on the parade ground
  spear: {
    n: 6,
    fps: 8,
    loop: true,
    pose: (i) => {
      const k = [0, 0.3, 1, 1, 0.6, 0.2][i];
      return { t: i, sword: "hand", swordDir: [0.05, 1, 0.12 - k * 0.1], handR: [2.6, 1.4 + k * 5.4, 13.4], handL: [-1.4, 3.4 + k * 4, 13.6], footR: [1.7, 1.4 + k * 2.2, 0], footL: [-1.7, -1.2, 0], lean: 0.04 + k * 0.12, eyes: "fierce", mouth: k === 1 ? "open" : "neutral", wind: [0, -0.4 - k * 0.6, 0] };
    },
  },
  // holding a war banner high in both hands and swinging it from side to side
  banner: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const sw = Math.sin(ph(i, n));
      return { t: ph(i, n), held: "warbanner", handR: [1.6 + sw * 1.2, 2.2, 21.5], handL: [0.6 + sw * 0.6, 2, 13.4], lean: -0.04, bob: i % 4 === 1 ? 0.4 : 0, eyes: "fierce", mouth: i % 4 === 2 ? "open" : "neutral", wind: [sw * 0.6, -0.6, 0.3] };
    },
  },
  // beating the war drum at the hip, the sticks rising and falling in turn
  drum: {
    n: 6,
    fps: 9,
    loop: true,
    pose: (i) => {
      const l = [1, 0.2, 0, 0.6, 1, 1][i];
      const r = [0, 0.6, 1, 1, 0.2, 0][i];
      return { t: i, held: "drum", handL: [-2.2, 3.2, 11 + l * 5], handR: [2.2, 3.2, 11 + r * 5], bob: i % 3 === 0 ? 0.5 : 0, eyes: "fierce", mouth: i % 3 === 1 ? "open" : "neutral", wind: [0, -0.3, 0] };
    },
  },
  // kneeling over the wounded, winding a bandage round and round
  bandage: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, stance: "kneel", held: "bandage", lean: 0.24, handL: [-1.4 + Math.cos(a) * 1.4, 5.6 + Math.sin(a) * 0.8, 6.4 + Math.sin(a) * 1.2], handR: [1.6 - Math.cos(a) * 1.4, 5.6 - Math.sin(a) * 0.8, 6.4 - Math.sin(a) * 1.2], eyes: i === 5 ? "blink" : "open", mouth: "neutral", wind: [0, -0.2, 0] };
    },
  },
  // the war horn: raised to the lips, a long call, lowered
  horn: {
    n: 8,
    fps: 6,
    loop: false,
    pose: (i) => {
      const k = [0, 0.5, 1, 1, 1, 1, 0.6, 0.1][i];
      return { t: i, held: k > 0.3 ? "horn" : undefined, lean: -0.1 * k, handR: [3 - k * 2.2, 2 + k * 3.4, 12 + k * 8.6], handL: [-4.2 + k * 2.4, 1 + k * 3, 11.4 + k * 6], bob: k * 0.6, eyes: k === 1 ? "closed" : "open", mouth: k === 1 ? "open" : "neutral", wind: [0, -0.3 - k * 0.4, 0.2 * k] };
    },
  },
  // kneeling at a grave, head bowed, shoulders shaking now and then
  grieve: {
    n: 6,
    fps: 4,
    loop: true,
    pose: (i) => {
      const sob = i === 2 || i === 4 ? 0.5 : 0;
      return { t: i, stance: "kneel", lean: 0.34, bob: sob, handL: [-2.6, 3.6, 8.4 + sob], handR: [2.6, 3.6, 8.4 + sob], eyes: "closed", mouth: "neutral", wind: [0, -0.15, 0] };
    },
  },
  // the rallying cry: the blade thrust up at heaven, a shout to the ranks behind
  rally: {
    n: 8,
    fps: 8,
    loop: false,
    pose: (i) => {
      const k = [0, 0.4, 0.9, 1, 1, 1, 0.7, 0.3][i];
      return { t: i, sword: "hand", swordDir: [0.1, 0.25 - k * 0.2, 1], handR: [3.6, 1.6, 14 + k * 12], handL: [-4.6 - k, 1.4, 12 + k * 2], footL: [-2.2, -0.6, 0], footR: [2.2, 1.2, 0], lean: -0.12 * k, eyes: "fierce", mouth: k > 0.8 ? "open" : "neutral", flash: k === 1 && i === 4 ? 0.2 : 0, wind: [0, -0.8 - k * 0.6, 0.4 * k] };
    },
  },
  // braced behind a raised arm (or a shield), feet planted, waiting for the charge
  shieldwall: {
    n: 6,
    fps: 5,
    loop: true,
    pose: (i) => {
      const brace = i % 3 === 0 ? 0.6 : 0;
      return { t: i, stance: "stand", lean: 0.1, bob: -0.6 - brace * 0.4, handL: [-1.2, 4.8, 16.4 - brace], handR: [3.8, 2, 12.4], footL: [-2.4, 1.6, 0], footR: [2.4, -1.4, 0], eyes: "fierce", mouth: "neutral", wind: [0, -0.4, 0] };
    },
  },
  // the lion dance: the painted lion's head held high in both hands, bobbing, snapping and shaking its mane to the drum
  liondance: {
    n: 8,
    fps: 9,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const snap = i % 4 === 2 ? 1 : 0;
      return { t: a, held: "lionhead", stance: i % 4 === 0 ? "kneel" : "stand", handL: [-3.2 + Math.sin(a) * 0.8, 3.6, 22 + Math.cos(a * 2) * 1.4 + snap], handR: [3.2 + Math.sin(a) * 0.8, 3.6, 22 + Math.cos(a * 2) * 1.4 + snap], footL: [-2.4, Math.sin(a) * 1.4, Math.max(0, Math.sin(a)) * 1.2], footR: [2.4, -Math.sin(a) * 1.4, Math.max(0, -Math.sin(a)) * 1.2], lean: 0.08, bob: Math.abs(Math.sin(a)) * 1.2, eyes: "fierce", mouth: "grin", wind: [Math.sin(a) * 0.8, -0.6, 0.3] };
    },
  },
  // a street acrobat's tumble: crouch, spring high with knees tucked, arms flung out, and land with a flourish
  acrobat: {
    n: 8,
    fps: 9,
    loop: false,
    pose: (i) => {
      const up = [0, 0, 0.7, 1, 0.8, 0.3, 0, 0][i];
      const tuck = i >= 2 && i <= 4;
      return { t: i, stance: i <= 1 || i === 6 ? "kneel" : "stand", lift: up * 9, lean: tuck ? 0.3 : -0.06, footL: tuck ? [-1.6, 2.4, 5] : [-2, 0, 0], footR: tuck ? [1.6, 2.4, 5] : [2, 0, 0], handL: tuck ? [-2, 4, 10] : [-6.4, 0.6, 18 + up * 4], handR: tuck ? [2, 4, 10] : [6.4, 0.6, 18 + up * 4], eyes: up > 0.5 ? "closed" : "open", mouth: i === 7 ? "grin" : "open", wind: [0, 0, up * 1.4] };
    },
  },
  // working a string puppet from a wooden cross held over a little stage, making it bow and dance
  puppet: {
    n: 8,
    fps: 7,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, held: "puppet", handR: [3 + Math.sin(a) * 1.2, 4.4, 17 + Math.cos(a * 2) * 1.2], handL: [-1.4, 4, 15 + Math.sin(a * 2) * 0.8], lean: 0.08, eyes: i === 5 ? "blink" : "open", mouth: i % 4 === 1 ? "open" : "smile", wind: [0, -0.3, 0] };
    },
  },
  // flicking the beads of an abacus at the counter, then a nod at the sum
  abacus: {
    n: 6,
    fps: 8,
    loop: true,
    pose: (i) => ({ t: i, held: "abacus", handL: [-2.2, 4.4, 12], handR: [1.2 + (i % 2) * 1.2, 4.6, 12.6 + (i % 3) * 0.4], lean: 0.1, eyes: i === 4 ? "blink" : "open", mouth: i === 5 ? "smile" : "neutral", bob: i === 5 ? 0.3 : 0, wind: [0, -0.2, 0] }),
  },
  // lighting a string of firecrackers held out at arm's length, then leaping back with the hands over the ears
  firecracker: {
    n: 8,
    fps: 8,
    loop: false,
    pose: (i) => {
      const back = i >= 4 ? 1 : 0;
      return { t: i, held: back ? undefined : "firecracker", toss: [5, 6 - i * 0.3, 18], handR: back ? [2.4, 2, 22.6] : [4.6, 4.4, 16], handL: back ? [-2.4, 2, 22.6] : [-2.2, 3.4, 13 + i], footR: [1.7, back ? -2.4 : 1, 0], lean: back ? -0.12 : 0.06, eyes: back ? "closed" : "open", mouth: back ? "grin" : "smile", lift: i === 4 ? 1.6 : 0, wind: [0, back ? 0.6 : -0.3, 0] };
    },
  },
  // a hawker crying her wares: a hand cupped to the mouth, the other beckoning
  hawk: {
    n: 6,
    fps: 6,
    loop: true,
    pose: (i) => {
      const call = i % 3 !== 2 ? 1 : 0;
      return { t: i, handL: [-1.6, 5.4, 21.4], handR: [5 - call * 0.6, 3 + call, 15 + call * 2], lean: -0.04 * call, bob: call * 0.3, mouth: call ? "open" : "smile", eyes: i === 4 ? "blink" : "open", wind: [0, -0.3, 0] };
    },
  },
  // seated over a xiangqi board, the hand hovering, then slapping a piece down
  xiangqi: {
    n: 8,
    fps: 5,
    loop: true,
    pose: (i) => {
      const k = [0, 0.4, 0.8, 1, 1, 0.2, 0, 0][i];
      return { t: i, stance: "sit", held: "xiangqi", handR: [1.6, 6 + k * 1.4, 10.4 + (k > 0.9 ? -1 : k * 1.4)], handL: [-3.4, 3.4, 12.4], lean: 0.12, eyes: i === 6 ? "blink" : k > 0.5 ? "fierce" : "open", mouth: i === 4 ? "grin" : "neutral", wind: [0, -0.2, 0] };
    },
  },
  // rowing a sampan with a long sculling oar, leaning into each stroke
  row: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      return { t: a, held: "oar", handR: [2.6 + s * 2.2, 2.4 - s * 1.6, 15], handL: [-0.6 + s * 2, 2.6 - s * 1.4, 13.4], footL: [-2, -1.4, 0], footR: [2, 1.6, 0], lean: 0.1 + s * 0.08, eyes: i === 6 ? "blink" : "open", mouth: "neutral", wind: [s * 0.4, -0.4, 0] };
    },
  },
  // comprehending a Great Dao: seated in stillness, rising a little off the ground, the eyes opening onto something bright
  comprehend: {
    n: 8,
    fps: 5,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, stance: "sit", lift: 1.6 + Math.sin(a) * 1, handL: [-2.6, 3.6, 13 + Math.sin(a) * 0.6], handR: [2.6, 3.6, 13 + Math.sin(a) * 0.6], eyes: i === 3 || i === 4 ? "glow" : "closed", mouth: "smile", flash: i === 4 ? 0.18 : 0.06, wind: [Math.sin(a) * 0.4, 0, 0.8] };
    },
  },
  // unfolding a Dao Domain: the arms sweep out and down, the feet leave the ground, the world bends round her
  domain: {
    n: 8,
    fps: 7,
    loop: false,
    pose: (i) => {
      const k = [0, 0.3, 0.7, 1, 1, 1, 0.8, 0.5][i];
      return { t: i, lift: k * 3, handL: [-3 - k * 4.6, 1.6 + k * 2, 18 - k * 5], handR: [3 + k * 4.6, 1.6 + k * 2, 18 - k * 5], footL: [-1.4, 0, 0.6 * k], footR: [1.4, 0, 0.6 * k], lean: -0.06 * k, eyes: k > 0.6 ? "glow" : "closed", mouth: "neutral", flash: k === 1 && i === 4 ? 0.3 : 0.08 * k, wind: [0, 0, 1.6 * k] };
    },
  },
  // sparring in the ring: a low stance, palms striking out left, right, left, the rear hand guarding
  spar: {
    n: 8,
    fps: 10,
    loop: true,
    pose: (i) => {
      const left = i % 4 < 2;
      const k = i % 2 ? 1 : 0.3;
      return { t: i, lean: 0.1, bob: k * 0.3, handL: left ? [-1.2, 3 + k * 4.6, 16.4] : [-3.4, 2.4, 14.6], handR: left ? [3.2, 2.6, 14.4] : [1.2, 3 + k * 4.6, 16.4], footL: [-2.6, 1.6, 0], footR: [2.6, -1.4, 0], eyes: "fierce", mouth: k > 0.5 ? "open" : "neutral", wind: [0, -0.4, 0] };
    },
  },
  // a hall master lecturing: a bamboo pointer raised for each point made, the other hand tucked behind the back
  lecture: {
    n: 8,
    fps: 5,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const up = Math.max(0, Math.sin(a));
      return { t: a, held: "pointer", handR: [3.6, 3.4 + up * 1.6, 15 + up * 6], handL: [-2.2, -2.6, 11.6], lean: -0.04, bob: up * 0.3, mouth: i % 3 === 1 ? "open" : "neutral", eyes: i === 6 ? "blink" : "open", wind: [0, -0.3, 0] };
    },
  },
  // on tiptoe at the back of a crowd, a hand shading the eyes, trying to see over ten thousand heads
  tiptoe: {
    n: 6,
    fps: 5,
    loop: true,
    pose: (i) => {
      const up = [0, 0.6, 1, 1, 0.6, 0][i];
      return { t: i, lift: up * 1.6, handR: [2.2, 3.6, 22.4], footL: [-1.7, 0, up * 0.6], footR: [1.7, 0, up * 0.6], lean: -0.06 * up, eyes: "open", mouth: up > 0.8 ? "open" : "neutral", wind: [0, -0.2, 0] };
    },
  },
  // holding up a jade token at arm's length: at the gate, at the dining hall, at the Sealed Hall
  token: {
    n: 6,
    fps: 6,
    loop: false,
    pose: (i) => {
      const k = [0, 0.4, 0.8, 1, 1, 1][i];
      return { t: i, held: "token", handR: [2.4, 2 + k * 4, 12 + k * 7], lean: 0.04, eyes: i === 5 ? "blink" : "open", mouth: k === 1 ? "smile" : "neutral", flash: i === 4 ? 0.08 : 0, wind: [0, -0.2, 0] };
    },
  },
  // on the knees, scrubbing the dining hall floor with a rag, back and forth
  scrub: {
    n: 8,
    fps: 8,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      return { t: a, stance: "kneel", held: "rag", handR: [1.6 + s * 3, 6.4, 3.4], handL: [-2.6, 5.2, 4.4], lean: 0.36, bob: Math.abs(s) * 0.3, eyes: "open", mouth: "neutral", wind: [0, -0.2, 0] };
    },
  },
  // hauling a full water bucket in one hand, leaning away from its weight, the free arm out for balance
  bucket: {
    n: 8,
    fps: 6,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      return { t: a, held: "bucket", handR: [5.2, 0.4, 9.4 + Math.sin(a * 2) * 0.4], handL: [-5.8, 0.2, 13 + s * 0.6], lean: 0.04, bob: Math.abs(s) * 0.4, footL: [-1.7, s * 1.2, Math.max(0, s) * 0.8], footR: [1.7, -s * 1.2, Math.max(0, -s) * 0.8], eyes: i === 5 ? "blink" : "open", mouth: "neutral", wind: [0, -0.3, 0] };
    },
  },
  // a pillow fight after curfew: the pillow swung up over the head in both hands and brought down with a whump
  pillow: {
    n: 8,
    fps: 9,
    loop: true,
    pose: (i) => {
      const k = [0, 0.5, 1, 0.7, 0.2, 0, 0, 0][i];
      const down = i === 3 || i === 4 ? 6 : 0;
      return { t: i, held: "pillow", handR: [3 - k * 1.6, 2 + k * 2.4, 19 + k * 5 - down], handL: [-3 + k * 1.6, 2 + k * 2.4, 19 + k * 5 - down], lean: down ? 0.2 : -0.08 * k, lift: i === 2 ? 0.8 : 0, eyes: k > 0.6 ? "closed" : "open", mouth: "grin", wind: [0, -0.3, 0] };
    },
  },
  // hands on knees after the long run, chest heaving
  pant: {
    n: 6,
    fps: 5,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      return { t: a, handL: [-2.6, 3.4, 7.4], handR: [2.6, 3.4, 7.4], lean: 0.34 + Math.sin(a) * 0.04, bob: Math.sin(a) * 0.4, footL: [-2.4, 0, 0], footR: [2.4, 0, 0], eyes: i % 3 === 0 ? "closed" : "hurt", mouth: "open", wind: [0, -0.2, 0] };
    },
  },
  // climbing a long stair: a knee high at every step, the arms swinging, leaning into the slope
  climb: {
    n: 8,
    fps: 7,
    loop: true,
    pose: (i, n) => {
      const a = ph(i, n);
      const s = Math.sin(a);
      return { t: a, lift: Math.abs(s) * 1.4, footL: [-1.7, 1.6 + s * 1.6, Math.max(0, s) * 4], footR: [1.7, 1.6 - s * 1.6, Math.max(0, -s) * 4], handL: [-4.2, -s * 2, 12], handR: [4.2, s * 2, 12], lean: 0.16, eyes: "open", mouth: Math.abs(s) > 0.8 ? "open" : "neutral", wind: [0, -0.4, 0] };
    },
  },
};

// rummaging in the satchel at her hip, then holding up what she found (opening her bag)
human.rummage = {
  n: 10,
  fps: 7,
  loop: false,
  pose: (i) => {
    const dig = i >= 2 && i <= 6;
    const up = i >= 7 ? Math.min(1, (i - 6) / 2) : 0;
    const jig = dig ? Math.sin(i * 2.4) * 0.9 : 0;
    return {
      t: i,
      lean: dig ? 0.14 : 0.05,
      handR: up ? [3.2 - up, 3 + up * 1.6, 11 + up * 5] : [-2.6 + jig, 2.2, dig ? 8.6 : 10],
      handL: dig ? [-4.6, 1.6 - jig * 0.5, 9.4] : [-4.4, 0.6, 11.2],
      held: up ? "token" : undefined,
      eyes: i === 4 ? "blink" : "open",
      mouth: up ? "smile" : "neutral",
      wind: [0, -0.2, 0],
    };
  },
};
// a hand at her brow against the glare, looking far off (a landmark comes into view)
human.shade = {
  n: 10,
  fps: 5,
  loop: false,
  pose: (i) => {
    const k = [0, 0.5, 1, 1, 1, 1, 1, 1, 0.5, 0][i];
    const scan = Math.sin((i / 9) * Math.PI * 2) * 0.6;
    return { t: i, lean: -0.06 * k, handR: [1.6 + scan * k, 2.8 + 2.4 * k, 11.2 + 12.6 * k], handL: [-4.4, 0.6, 11.2], footL: [-2, 0.3, 0], footR: [2, -0.3, 0], eyes: k === 1 && i === 5 ? "blink" : "open", mouth: "neutral", wind: [0, -0.2, 0.15] };
  },
};
// beckoning someone over: palm up, fingers curling (folk with a favour to ask)
human.beckon = {
  n: 8,
  fps: 8,
  loop: false,
  pose: (i, n) => {
    const c = Math.sin(ph(i, n) * 2);
    return { t: ph(i, n), lean: 0.05, handR: [3.4, 5.2 + c * 1.4, 15.6 - c * 1.2], handL: [-4.4, 0.6, 11.2], mouth: i % 4 === 0 ? "open" : "smile", eyes: i === 6 ? "blink" : "open", bob: i % 4 === 2 ? 0.3 : 0, wind: [0, -0.2, 0] };
  },
};

// hiding: sat on the ground hugging the knees, rocking a little (children lost underground)
human.huddle = {
  n: 8,
  fps: 4,
  loop: true,
  pose: (i, n) => {
    const rock = Math.sin(ph(i, n)) * 0.08;
    return { t: ph(i, n), stance: "sit", lean: 0.28 + rock, bob: -0.6, handL: [-1.6, 4.2, 8.6], handR: [1.6, 4.2, 8.6], eyes: i % 4 === 3 ? "closed" : "open", mouth: "neutral", wind: [0, -0.2, 0] };
  },
};
// chanting a sutra: palms together before the chest, a small bow on every fourth beat
human.chant = {
  n: 8,
  fps: 4,
  loop: true,
  pose: (i) => {
    const bow = i % 4 === 0 ? 0.12 : 0.03;
    return { t: i, lean: bow, handL: [-0.6, 4.4, 16.4 - bow * 6], handR: [0.6, 4.4, 16.4 - bow * 6], eyes: "closed", mouth: i % 2 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};
// taking a rubbing of an inscription: paper pressed flat with one hand, the ink pad dabbed over it with the other
human.rubbing = {
  n: 8,
  fps: 7,
  loop: false,
  pose: (i) => {
    const dab = i % 2 ? 0.9 : 0;
    const row = Math.floor(i / 2) * 1.4;
    return { t: i, lean: 0.1, handL: [-2.6, 7.4, 17 - row * 0.5], handR: [1.2 + row * 0.4, 6.6 + dab, 18.4 - row], held: "rag", eyes: "open", mouth: "neutral", wind: [0, -0.2, 0] };
  },
};
// casting a fishing net: swung back low, then flung out wide in front
human.castnet = {
  n: 10,
  fps: 8,
  loop: false,
  pose: (i) => {
    const k = [0, -0.6, -1, -0.8, 0.2, 1, 1, 0.8, 0.4, 0][i];
    const wide = k > 0 ? k : 0;
    return { t: i, lean: k * 0.12, handL: [-2.4 - wide * 3, 2 + k * 5, 12 + k * 4], handR: [2.4 + wide * 3, 2 + k * 5, 12 + k * 4], footL: [-1.9, 0.8, 0], footR: [1.9, -0.8, 0], eyes: "open", mouth: k > 0.8 ? "open" : "neutral", wind: [0, -0.4 * k, 0] };
  },
};
// a slingshot drawn back to the cheek, aimed, and let go
human.slingshot = {
  n: 8,
  fps: 7,
  loop: false,
  pose: (i) => {
    const draw = [0, 0.4, 0.8, 1, 1, 1, 0, 0][i];
    return { t: i, lean: -0.04, handL: [-0.4, 7.2, 18], handR: [0.4, 7.2 - draw * 5.4, 18.6], footL: [-2, 0.6, 0], footR: [2, -0.6, 0], eyes: draw === 1 && i === 4 ? "closed" : "open", mouth: i === 6 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};
// digging in sand or soil, the hoe driven in and the spoil thrown over the shoulder
human.dig = {
  n: 8,
  fps: 7,
  loop: true,
  pose: (i, n) => {
    const s = Math.sin(ph(i, n));
    return { t: ph(i, n), lean: 0.12 + s * 0.12, held: "hoe", handR: [1.6, 4 + s, 13 + s * 4], handL: [-1, 3.6 + s, 9.6 + s * 4], footL: [-1.8, 1, 0], footR: [1.8, -1, 0], eyes: "open", mouth: s > 0.8 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};
// peering into the dark with the torch held out ahead
human.peer = {
  n: 8,
  fps: 5,
  loop: false,
  pose: (i) => {
    const k = [0, 0.5, 1, 1, 1, 1, 0.5, 0][i];
    const scan = Math.sin(i * 0.9) * 0.8 * k;
    return { t: i, lean: 0.16 * k, held: "torch", handR: [2.4 + scan, 4 + k * 3.4, 15 + k * 3], handL: [-3.8, 1.6, 11.6], eyes: i === 4 ? "blink" : "open", mouth: "neutral", wind: [0, -0.2, 0] };
  },
};
// arms flung open for someone coming home, then closed round them
human.embrace = {
  n: 10,
  fps: 7,
  loop: false,
  pose: (i) => {
    const open = [0, 0.6, 1, 1, 1, 0.6, 0.2, 0.1, 0.1, 0][i];
    const shut = i >= 5 && i <= 8;
    return { t: i, lean: shut ? 0.12 : -0.04 * open, handL: shut ? [-1.4, 5, 14.6] : [-4.4 - open * 4, 1.4 + open, 11.2 + open * 6], handR: shut ? [1.4, 5, 14.6] : [4.4 + open * 4, 1.4 + open, 11.2 + open * 6], eyes: shut ? "closed" : "open", mouth: "smile", wind: [0, -0.2, 0] };
  },
};
// holding something found high overhead in both hands, to see it in the light (a pearl, a relic)
human.holdup = {
  n: 8,
  fps: 6,
  loop: false,
  pose: (i) => {
    const up = [0, 0.4, 0.8, 1, 1, 1, 0.6, 0.2][i];
    return { t: i, lean: -0.08 * up, held: "token", handL: [-1, 2.4 + up, 12 + up * 15], handR: [1, 2.4 + up, 12 + up * 15], eyes: up === 1 && i === 4 ? "blink" : "open", mouth: up > 0.5 ? "smile" : "neutral", wind: [0, -0.2, 0.1] };
  },
};

// down on both knees, forehead not quite to the stones, hands flat before them: a mortal before a cultivator far above her realm
human.kneel = {
  n: 8,
  fps: 4,
  loop: true,
  pose: (i, n) => {
    const tremble = Math.sin(ph(i, n) * 3) * 0.02;
    return { t: ph(i, n), stance: "kneel", lean: 0.42 + tremble, bob: -0.4, handL: [-2.2, 5.2, 3.6], handR: [2.2, 5.2, 3.6], eyes: "closed", mouth: "neutral", wind: [0, -0.2, 0] };
  },
};
// a registrar's seal raised, breathed on, and brought down hard on the ledger
human.stamp = {
  n: 8,
  fps: 8,
  loop: true,
  pose: (i) => {
    const k = [0, 0.5, 1, 1, 0.2, -0.2, 0, 0][i];
    return { t: i, lean: 0.1 + (k < 0 ? 0.08 : 0), held: "seal", handR: [2.6, 4.6, 12 + k * 6], handL: [-2.8, 4.4, 10.4], mouth: i === 2 ? "open" : "neutral", eyes: i === 5 ? "closed" : "open", bob: k < 0 ? -0.3 : 0, wind: [0, -0.2, 0] };
  },
};
// weighing on a steelyard: the brass weight slid out along the beam until it hangs level
human.weigh = {
  n: 8,
  fps: 5,
  loop: true,
  pose: (i, n) => {
    const a = ph(i, n);
    return { t: a, held: "steelyard", handL: [-2.6, 4.6, 17], handR: [3.6 + Math.cos(a) * 1.2, 4.4, 14.8], lean: -0.04, eyes: i === 6 ? "blink" : "open", mouth: "neutral", wind: [0, -0.2, 0] };
  },
};
// leaning on a balcony rail with her chin on her hand, watching the street below
human.lean = {
  n: 8,
  fps: 3,
  loop: true,
  pose: (i, n) => {
    const a = ph(i, n);
    return { t: a, lean: 0.26, handL: [-2.6, 6.4, 13.6], handR: [1.2, 4.6, 19 + Math.sin(a) * 0.3], footL: [-1.6, 0.4, 0], footR: [1.8, -1.2, 0.6], eyes: i === 5 ? "blink" : "open", mouth: i < 4 ? "smile" : "neutral", wind: [Math.sin(a) * 0.3, -0.4, 0] };
  },
};
// a wine cup raised high to the table, then tossed back
human.toast = {
  n: 10,
  fps: 7,
  loop: false,
  pose: (i) => {
    const up = [0, 0.5, 1, 1, 1, 0.6, 0.3, 0.3, 0.2, 0][i];
    const drink = i >= 5 && i <= 7;
    return { t: i, held: "cup", lean: drink ? -0.16 : -0.04 * up, handR: drink ? [1.2, 4.6, 21.4] : [3.4, 3 + up * 3, 13 + up * 10], handL: [-4.4, 0.6, 11.2], eyes: drink ? "closed" : "open", mouth: up === 1 && i === 3 ? "open" : "smile", wind: [0, -0.2, 0] };
  },
};
// a beggar on her knees, a chipped bowl held up in both hands to whoever passes
human.beg = {
  n: 8,
  fps: 4,
  loop: true,
  pose: (i, n) => {
    const lift = Math.max(0, Math.sin(ph(i, n))) * 1.6;
    return { t: ph(i, n), stance: "kneel", held: "bowl", lean: 0.12, handL: [-0.6, 5.6, 10 + lift], handR: [1.4, 5, 10.6 + lift], eyes: lift > 1 ? "open" : "closed", mouth: lift > 1 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};
// a herald reading out a decree of yellow silk, held open between both hands
human.decree = {
  n: 8,
  fps: 5,
  loop: true,
  pose: (i) => {
    const say = i % 2 === 0;
    return { t: i, held: "decree", handL: [-4.6, 5.4, 17], handR: [4.6, 5.4, 17], lean: -0.06, bob: say ? 0.2 : 0, eyes: "open", mouth: say ? "open" : "neutral", wind: [0, -0.3, 0] };
  },
};
// haggling: fingers held up to name a price, a hand thrown out in disbelief, a shake of the head
human.haggle = {
  n: 10,
  fps: 7,
  loop: true,
  pose: (i) => {
    const k = [0, 1, 1, 0.5, 0, -1, -1, -0.5, 0, 0][i];
    return { t: i, lean: 0.06 * Math.abs(k), handR: k > 0 ? [2.6, 5.6, 19.4] : [4.4 - k * 2, 2 - k * 2, 12 - k * 2], handL: k < 0 ? [-4.4 + k * 2, 2 - k * 2, 12 - k * 2] : [-4.4, 0.6, 11.2], eyes: i === 8 ? "blink" : k < 0 ? "fierce" : "open", mouth: k !== 0 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};
// bearing a sedan chair: the carrying pole on the shoulder, steadied with both hands, stepping in time with the other bearers
human.bear = {
  n: 8,
  fps: 8,
  loop: true,
  pose: (i, n) => {
    const a = ph(i, n);
    const s = Math.sin(a);
    return { t: a * 2, lean: 0.12, bob: Math.abs(Math.cos(a)) * 0.6, footL: [-1.7, s * 2.4, Math.max(0, Math.cos(a)) * 1], footR: [1.7, -s * 2.4, Math.max(0, -Math.cos(a)) * 1], handL: [-2.2, 3.4, 20.6], handR: [2.6, 1.6, 21], eyes: "open", mouth: "neutral", wind: [0, -0.6, 0] };
  },
};
// leaning in to whisper behind a cupped hand (gossip of who has climbed and who has fallen)
human.whisper = {
  n: 8,
  fps: 5,
  loop: true,
  pose: (i) => {
    const k = [0, 0.6, 1, 1, 1, 1, 0.6, 0][i];
    return { t: i, lean: 0.12 * k, handR: [1.6 + k * 0.8, 4.4 + k * 2, 13 + k * 8.4], handL: [-4.4, 0.6, 11.2], eyes: k === 1 && i === 4 ? "blink" : "open", mouth: k === 1 && i % 2 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};

// ----------------------------------------------------------------------------- the peoples' own manners
// the fox-folk's moon dance: a slow turn on the toes, one hand raised to the moon and the other trailing, the tails following
human.moondance = {
  n: 12,
  fps: 7,
  loop: true,
  pose: (i, n) => {
    const a = ph(i, n);
    return { t: a * 2, lift: Math.abs(Math.sin(a)) * 1.2, lean: -0.06, handL: [-3 + Math.cos(a) * 2, 2 + Math.sin(a) * 2, 25 + Math.sin(a) * 2], handR: [5.6, -1 + Math.cos(a), 12 + Math.sin(a) * 2], footL: [-1.2, Math.sin(a) * 1.4, Math.max(0, Math.sin(a)) * 1.2], footR: [1.4, -Math.sin(a) * 1.4, 0], eyes: i % 6 === 3 ? "blink" : "closed", mouth: "smile", wind: [Math.sin(a) * 1.2, Math.cos(a) * 0.8, 0.4] };
  },
};
// weeping into the hands, shoulders shaking (a merfolk's tears fall as pearls)
human.weep = {
  n: 8,
  fps: 5,
  loop: true,
  pose: (i) => {
    const sob = i % 2 ? 0.5 : 0;
    return { t: i, lean: 0.18, bob: -sob, handL: [-1.4, 5, 21.6 - sob], handR: [1.4, 5, 21.6 - sob], eyes: "closed", mouth: i % 4 === 1 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};
// carving: down on one knee, a chisel set to the stone and the mallet brought down on it
human.carve = {
  n: 8,
  fps: 8,
  loop: true,
  pose: (i) => {
    const up = [0, 0.5, 1, 1, 0.4, 0, 0, 0][i];
    return { t: i, stance: "kneel", lean: 0.22, held: "hammer", handL: [-1.2, 6.2, 8.6], handR: [2.2, 5.4, 10 + up * 7], eyes: up === 0 && i > 4 ? "blink" : "fierce", mouth: "neutral", wind: [0, -0.2, 0] };
  },
};
// gliding: arms flung wide like wings, lifted off the ground and banking from side to side
human.glide = {
  n: 8,
  fps: 6,
  loop: true,
  pose: (i, n) => {
    const a = ph(i, n);
    const bank = Math.sin(a);
    return { t: a, lift: 3 + Math.cos(a) * 1.2, lean: 0.28, handL: [-8.6, -0.6, 17 + bank * 2], handR: [8.6, -0.6, 17 - bank * 2], footL: [-1.2, -2.4, 0.6], footR: [1.2, -2.8, 0.4], eyes: "open", mouth: "smile", wind: [bank * 0.6, -2.4, 0.6] };
  },
};
// breathing fire: a deep breath drawn in, then a gout of flame from the lips (the fireball held before the mouth)
human.firebreath = {
  n: 10,
  fps: 8,
  loop: false,
  pose: (i) => {
    const draw = [0, 0.4, 0.8, 1, 1, 0, 0, 0, 0.3, 0][i];
    const blow = i >= 5 && i <= 7;
    return { t: i, lean: blow ? 0.18 : -0.12 * draw, bob: draw * 0.6, held: blow ? "fireball" : undefined, handL: blow ? [-1.2, 7.8, 22] : [-4.4, 0.6, 11.2 + draw * 2], handR: blow ? [1.2, 8.4, 22.6] : [4.4, 0.6, 11.2 + draw * 2], eyes: blow ? "fierce" : draw > 0.5 ? "closed" : "open", mouth: blow ? "open" : "neutral", wind: blow ? [0, 0.8, 0] : [0, -0.3, 0] };
  },
};
// counting the winter on a knotted cord: a knot tied, pulled tight, run through the fingers
human.knot = {
  n: 8,
  fps: 5,
  loop: true,
  pose: (i) => {
    const pull = i % 4 === 2 ? 1.6 : 0;
    return { t: i, held: "rag", lean: 0.1, handL: [-1.6 - pull, 5.6, 14.4], handR: [1.6 + pull, 5.6, 14.6], eyes: i === 6 ? "blink" : "open", mouth: i % 4 === 0 ? "open" : "neutral", wind: [0, -0.2, 0] };
  },
};
// a pearl (or a scale, or a feather: any token of trust) offered on an open palm with a small bow
human.offerpearl = {
  n: 8,
  fps: 5,
  loop: false,
  pose: (i) => {
    const k = [0, 0.4, 0.8, 1, 1, 1, 0.6, 0.2][i];
    return { t: i, held: "token", lean: 0.12 * k, handR: [1.4, 3 + k * 4, 12 + k * 4], handL: [-1, 3 + k * 3.6, 11.6 + k * 3.4], eyes: k === 1 ? "closed" : "open", mouth: "smile", wind: [0, -0.2, 0] };
  },
};
// the snow-folk's hearth song: sitting by the fire, swaying, hands held out to it, mouth open on the long notes
human.hearthsong = {
  n: 12,
  fps: 5,
  loop: true,
  pose: (i, n) => {
    const a = ph(i, n);
    return { t: a, stance: "sit", lean: Math.sin(a) * 0.08 + 0.06, handL: [-3, 6, 9 + Math.sin(a)], handR: [3, 6, 9 + Math.sin(a)], eyes: "closed", mouth: Math.sin(a * 2) > 0 ? "open" : "smile", wind: [Math.sin(a) * 0.4, -0.2, 0] };
  },
};

// ----------------------------------------------------------------------------- beast poses
const beast: Partial<Record<AnimId, AnimSpec<BeastPose>>> = {
  idle: { n: 6, fps: 6, loop: true, pose: (i, n) => ({ t: ph(i, n) }) },
  walk: { n: 8, fps: 12, loop: true, pose: (i, n) => ({ t: ph(i, n) * 2, stride: ph(i, n), lift: Math.abs(Math.sin(ph(i, n))) * 0.4 }) },
  run: { n: 8, fps: 18, loop: true, pose: (i, n) => ({ t: ph(i, n) * 3, stride: ph(i, n), lift: 0.3 + Math.abs(Math.sin(ph(i, n))) * 1.4, lunge: 0.12 + Math.sin(ph(i, n) * 2) * 0.08 }) },
  attack: { n: 6, fps: 12, loop: false, pose: (i) => ({ t: i, lunge: [0, -0.3, 0.6, 1, 0.8, 0.2][i], mouth: i >= 2 && i <= 4 }) },
  hurt: { n: 3, fps: 8, loop: false, pose: (i) => ({ t: i, recoil: [1, 0.8, 0.3][i], flash: i === 0 ? 0.75 : 0, mouth: true }) },
  fly: { n: 6, fps: 10, loop: true, pose: (i, n) => ({ t: ph(i, n), wing: Math.sin(ph(i, n)) * 0.9, lift: 6 + Math.cos(ph(i, n)) }) },
  sleep: { n: 8, fps: 2, loop: true, pose: (i) => ({ t: i * 0.35, crouch: 1, head: -0.7, closed: true, breath: i % 2 }) },
  howl: { n: 8, fps: 6, loop: false, pose: (i) => ({ t: i, crouch: [0, 0.4, 0.6, 0.6, 0.6, 0.6, 0.4, 0][i], head: [0, 0.6, 1, 1, 1, 1, 0.6, 0][i], mouth: i >= 2 && i <= 5 }) },
  sniff: { n: 8, fps: 6, loop: false, pose: (i) => ({ t: i, head: [-0.3, -0.8, -1, -0.9, -1, -0.8, -0.4, 0][i], stride: i % 2 ? 0.3 : 0 }) },
  peck: { n: 6, fps: 7, loop: false, pose: (i) => ({ t: i, head: [0, -0.6, -1, -0.5, -1, 0][i] }) },
};

// ----------------------------------------------------------------------------- horses and their rider
const horse: Partial<Record<AnimId, AnimSpec<HorsePose>>> = {
  idle: { n: 8, fps: 5, loop: true, pose: (i, n) => ({ t: gaitAt(i, n), head: i === 5 ? 0.25 : 0, tail: Math.sin(gaitAt(i, n)) * (i > 3 ? 1 : 0.3), ears: i === 6 ? 0.6 : 0 }) },
  walk: { n: 8, fps: 9, loop: true, pose: (i, n) => ({ t: gaitAt(i, n) * 2, gait: gaitAt(i, n), kind: "walk", lift: Math.abs(Math.sin(gaitAt(i, n) * 2)) * 0.3, head: Math.sin(gaitAt(i, n) * 2) * 0.12 }) },
  run: { n: 8, fps: 14, loop: true, pose: (i, n) => ({ t: gaitAt(i, n) * 2, gait: gaitAt(i, n), kind: "gallop", lift: Math.max(0, Math.sin(gaitAt(i, n))) * 1.6, head: Math.cos(gaitAt(i, n)) * 0.25 - 0.1, ears: 0.4 }) },
  graze: { n: 10, fps: 4, loop: true, pose: (i) => ({ t: i * 0.6, head: [-1, -1, -0.95, -1, -1, -0.9, -1, -1, -0.6, -1][i], tail: Math.sin(i * 1.4) * (i % 4 === 0 ? 1 : 0.3) }) },
  rear: { n: 8, fps: 8, loop: false, pose: (i) => ({ t: i * 0.8, rear: [0.3, 0.7, 1, 1, 0.9, 0.6, 0.25, 0][i], head: [0.3, 0.8, 1, 1, 0.8, 0.5, 0.2, 0][i], tail: Math.sin(i), ears: 0.3 }) },
};

/** What the rider does on each of her horse's animations. */
const ridden: Partial<Record<AnimId, (i: number, n: number) => HumanPose>> = {
  idle: (i, n) => ({ t: ph(i, n), handL: [-1.6, 4.4, 12.6], handR: [1.6, 4.4, 12.6], eyes: i === 4 ? "blink" : "open", mouth: "smile", bob: i % 4 === 2 ? 0.3 : 0, wind: [0, -0.4, 0] }),
  walk: (i, n) => ({ t: ph(i, n) * 2, handL: [-1.6, 4.6, 12.6], handR: [1.6, 4.6, 12.6], lean: 0.05, bob: Math.abs(Math.sin(ph(i, n) * 2)) * 0.6, mouth: "smile", wind: [0, -0.9, 0] }),
  run: (i, n) => ({ t: ph(i, n) * 2, handL: [-1.5, 5.4, 12], handR: [1.5, 5.4, 12], lean: 0.2, bob: Math.max(0, Math.sin(ph(i, n))) * 1.4, mouth: i % 4 === 1 ? "open" : "smile", eyes: "fierce", wind: [Math.sin(ph(i, n)) * 0.3, -2.6, 0.5] }),
  rear: (i) => ({ t: i, handL: [-1.4, 4.8, 14], handR: [3.4, 2, 24.5 - Math.abs(i - 3.5)], mouth: "grin", eyes: i > 1 && i < 6 ? "closed" : "open", wind: [0, -1.6, 0.4] }),
};

// ----------------------------------------------------------------------------- styles
const s = (o: Partial<HumanStyle> & Pick<HumanStyle, "robe" | "hairStyle">): HumanStyle => ({
  skin: PAL.skin,
  hair: PAL.hairBlack,
  inner: PAL.white,
  trim: PAL.gold,
  sash: PAL.gold,
  shoes: PAL.black,
  eye: "#2a1c3f",
  ...o,
});

export const STYLES = {
  heroine: s({ robe: PAL.white, inner: PAL.lavender, trim: PAL.jade, sash: PAL.jade, shoes: PAL.jadeDeep, eye: "#2f8f7f", hairStyle: "bun", female: true, shawl: PAL.rose, weapon: "jian" }),
  elder: s({ robe: ramp("#6a7ab0"), inner: PAL.white, trim: PAL.white, sash: PAL.navy, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", hat: "crown", hatRamp: PAL.gold, weapon: "whisk", hunch: 0.05, flare: 6 }),
  qing: s({ robe: ramp("#4aa070"), inner: PAL.white, trim: PAL.gold, sash: PAL.rose, hairStyle: "twin", female: true, eye: "#3a6a2a", shawl: ramp("#f4e2a0") }),
  abao: s({ robe: PAL.azure, inner: PAL.white, trim: PAL.white, sash: PAL.navy, hairStyle: "topknot", scale: 0.78, hair: PAL.hairBrown }),
  discipleM: s({ robe: PAL.white, inner: PAL.azure, trim: PAL.azure, sash: PAL.navy, hairStyle: "topknot", weapon: "jian", flare: 4.8 }),
  discipleF: s({ robe: PAL.white, inner: PAL.azure, trim: PAL.azure, sash: PAL.azure, hairStyle: "long", female: true, weapon: "jian", hair: PAL.hairBrown }),
  zhou: s({ robe: ramp("#8a5a3a"), inner: PAL.paper, trim: PAL.paper, sash: PAL.red, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "short", hat: "scholar", hatRamp: PAL.black, weapon: "fan", flare: 5.4 }),
  hua: s({ robe: ramp("#7a6a9a"), inner: PAL.paper, trim: PAL.green, sash: PAL.green, hair: PAL.hairWhite, hairStyle: "bun", female: true, hunch: 0.16, scale: 0.92, weapon: "staff" }),
  farmer: s({ robe: ramp("#5a7a9a"), inner: PAL.white, trim: PAL.brown, sash: PAL.brown, hairStyle: "short", hat: "straw", skin: PAL.skinTan, flare: 4.2, hem: 4.6, shoes: PAL.brown }),
  child: s({ robe: PAL.red, inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hairStyle: "twin", female: true, scale: 0.66, eye: "#3a2a1a" }),
  huli: s({ robe: ramp("#fbe6d6"), inner: PAL.orange, trim: PAL.orange, sash: PAL.red, hair: ramp("#e87a3a", { lo: "#8a2a3a" }), hairStyle: "long", female: true, eye: "#d06a10", foxEars: ramp("#e87a3a"), tails: ramp("#f08a3a", { lo: "#8a2a40" }), shawl: ramp("#ffb070") }),
  wen: s({ robe: ramp("#7a8a8a"), inner: PAL.white, trim: PAL.teal, sash: PAL.teal, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "topknot", hat: "straw", hatRamp: PAL.straw, weapon: "rod", flare: 5.6 }),
  cultist: s({ robe: PAL.crimson, inner: PAL.black, trim: PAL.black, sash: PAL.gold, hairStyle: "short", hat: "hood", hatRamp: PAL.black, mask: ramp("#e8e0d0"), glowEyes: "#ff3050", weapon: "saber", flare: 5 }),
  jiangshi: s({ robe: ramp("#3a5a8a"), inner: PAL.black, trim: PAL.red, sash: PAL.red, skin: PAL.skinPale, hairStyle: "short", hat: "jiangshi", hatRamp: PAL.black, talisman: true, hem: 3, flare: 4.6 }),
  monk: s({ robe: ramp("#d88a3a", { lo: "#7a2a20" }), inner: PAL.paper, trim: PAL.red, sash: PAL.red, skin: PAL.skinTan, hairStyle: "bald", weapon: "staff", weaponRamp: PAL.wood, flare: 5.2, shawl: ramp("#c04a2a") }),
  teawoman: s({ robe: ramp("#4a7aa8"), inner: PAL.white, trim: PAL.white, sash: PAL.paper, hair: PAL.hairBrown, hairStyle: "bun", female: true, eye: "#3a2a1a", flare: 5, hem: 3.4, shoes: PAL.brown }),
  miller: s({ robe: ramp("#8a8a6a"), inner: PAL.white, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "short", hat: "straw", hatRamp: PAL.straw, skin: PAL.skinTan, flare: 4.4, hem: 4.4, shoes: PAL.brown }),
  hermit: s({ robe: ramp("#e8ecf8", { lo: "#5a6a9a" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.navy, hair: PAL.hairSilver, beard: PAL.hairSilver, hairStyle: "long", hat: "crown", hatRamp: PAL.jade, weapon: "whisk", hunch: 0.08, flare: 6 }),
  swordsman: s({ robe: PAL.black, inner: PAL.crimson, trim: PAL.crimson, sash: PAL.crimson, hairStyle: "wild", hair: PAL.hairBlack, weapon: "jian", shawl: ramp("#8a2a3a"), flare: 4.6, eye: "#3a1a2a" }),
  bandit: s({ robe: ramp("#6a5a4a"), inner: PAL.black, trim: PAL.black, sash: PAL.red, skin: PAL.skinTan, hairStyle: "wild", hair: PAL.hairBrown, beard: PAL.hairBrown, hat: "hood", hatRamp: ramp("#4a3a2a"), weapon: "saber", flare: 4.4, hem: 4.6, shoes: PAL.brown }),
  peddler: s({ robe: ramp("#b07a3a"), inner: PAL.paper, trim: PAL.brown, sash: PAL.green, hair: PAL.hairBrown, beard: PAL.hairBrown, hairStyle: "short", hat: "straw", hatRamp: PAL.straw, skin: PAL.skinTan, weapon: "staff", flare: 4.6, hem: 4.2, shoes: PAL.brown }),
  archivist: s({ robe: ramp("#4a5a7a"), inner: PAL.paper, trim: PAL.paper, sash: PAL.jade, hair: PAL.hairGrey, hairStyle: "bun", female: true, hat: "scholar", hatRamp: PAL.black, eye: "#2a2a3a", hunch: 0.06, flare: 5.6 }),
  storyteller: s({ robe: ramp("#8a3a3a"), inner: PAL.paper, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", weapon: "fan", hunch: 0.1, flare: 5.4 }),
  weaver: s({ robe: ramp("#a86a8a"), inner: PAL.white, trim: PAL.paper, sash: PAL.teal, hair: PAL.hairBrown, hairStyle: "bun", female: true, eye: "#3a2a1a", flare: 5, hem: 3.6, shoes: PAL.brown }),
  millhand: s({ robe: ramp("#a89a7a"), inner: PAL.white, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairBrown, hairStyle: "short", skin: PAL.skinTan, scale: 0.82, flare: 4, hem: 4.6, shoes: PAL.brown }),
  lampkeeper: s({ robe: ramp("#9a9aa8", { lo: "#3a3a5a" }), inner: PAL.white, trim: PAL.gold, sash: PAL.gold, hairStyle: "bald", female: true, shawl: ramp("#e0b050"), eye: "#3a2a3a", hunch: 0.08, flare: 5.4 }),
  scholar: s({ robe: ramp("#8ab0d0"), inner: PAL.white, trim: PAL.navy, sash: PAL.navy, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.black, weapon: "fan", flare: 5 }),
  smith: s({ robe: ramp("#5a4a3a"), inner: PAL.white, trim: PAL.red, sash: PAL.red, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "short", skin: PAL.skinTan, shawl: ramp("#3a2a26"), hunch: 0.04, flare: 4.4, hem: 4.6, shoes: PAL.brown, eye: "#3a2a1a" }),
  ghost: s({ robe: ramp("#c8d8f0", { lo: "#4a5a8a" }), inner: PAL.white, trim: PAL.navy, sash: PAL.navy, skin: PAL.skinPale, hair: PAL.hairBlack, hairStyle: "long", hat: "scholar", hatRamp: PAL.black, eye: "#4a6a9a", flare: 5.4, hem: 1.6 }),
  orchardist: s({ robe: ramp("#e88aa0"), inner: PAL.white, trim: PAL.green, sash: PAL.green, hair: PAL.hairBrown, hairStyle: "bun", female: true, hat: "straw", hatRamp: PAL.straw, skin: PAL.skinTan, eye: "#3a2a1a", flare: 5, hem: 3.6, shoes: PAL.brown }),
  villagerM: s({ robe: ramp("#6a8a6a"), inner: PAL.paper, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairBlack, hairStyle: "short", skin: PAL.skinTan, flare: 4.4, hem: 4.4, shoes: PAL.brown }),
  villagerF: s({ robe: ramp("#c87a5a"), inner: PAL.white, trim: PAL.paper, sash: PAL.green, hair: PAL.hairBlack, hairStyle: "bun", female: true, eye: "#3a2a1a", flare: 5, hem: 3.6, shoes: PAL.brown }),
  boy: s({ robe: ramp("#4a7ac8"), inner: PAL.white, trim: PAL.white, sash: PAL.red, hairStyle: "topknot", scale: 0.68, eye: "#3a2a1a", hem: 4.6, flare: 4 }),
  woodcutter: s({ robe: ramp("#6a5a3a"), inner: PAL.paper, trim: PAL.brown, sash: PAL.red, hair: PAL.hairBrown, beard: PAL.hairBrown, hairStyle: "wild", skin: PAL.skinTan, flare: 4.2, hem: 4.8, shoes: PAL.brown }),
  porter: s({ robe: ramp("#8a9aaa"), inner: PAL.white, trim: PAL.navy, sash: PAL.navy, hairStyle: "short", hat: "straw", hatRamp: PAL.straw, skin: PAL.skinTan, flare: 4.2, hem: 4.8, shoes: PAL.brown }),
  lady: s({ robe: ramp("#b88ad8", { lo: "#4a2a6a" }), inner: PAL.white, trim: PAL.gold, sash: PAL.rose, hair: PAL.hairBlack, hairStyle: "long", female: true, shawl: ramp("#f8d8f0"), eye: "#3a2a4a", flare: 6 }),
  guard: s({ robe: ramp("#3a4a6a", { lo: "#10182a" }), inner: PAL.red, trim: PAL.steel, sash: PAL.red, hairStyle: "topknot", hat: "hood", hatRamp: PAL.black, weapon: "saber", weaponRamp: PAL.steel, flare: 4.6, hem: 4.2 }),
  fishwife: s({ robe: ramp("#4a8aa0"), inner: PAL.white, trim: PAL.white, sash: PAL.orange, hair: PAL.hairBrown, hairStyle: "bun", female: true, skin: PAL.skinTan, eye: "#3a2a1a", flare: 5, hem: 3.6, shoes: PAL.brown }),
  captain: s({ robe: ramp("#2a4a7a"), inner: PAL.white, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "wild", hat: "straw", hatRamp: ramp("#3a3a4a"), skin: PAL.skinTan, cape: ramp("#8a2a2a"), flare: 4.8, hem: 4 }),
  abbot: s({ robe: ramp("#e8c050", { lo: "#7a4a20" }), inner: PAL.crimson, trim: PAL.crimson, sash: PAL.crimson, skin: PAL.skinTan, hairStyle: "bald", beard: PAL.hairWhite, weapon: "staff", weaponRamp: PAL.gold, shawl: ramp("#a8282a"), hunch: 0.06, flare: 5.6 }),
  novice: s({ robe: ramp("#c8a070", { lo: "#5a3a2a" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.brown, skin: PAL.skinTan, hairStyle: "bald", scale: 0.78, flare: 4.6 }),
  nomad: s({ robe: ramp("#c06a3a", { lo: "#4a1a20" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.navy, hair: PAL.hairBlack, hairStyle: "long", hat: "hood", hatRamp: ramp("#e8d8b0"), skin: PAL.skinTan, weapon: "saber", flare: 4.8, hem: 3.8, shoes: PAL.brown }),
  marshwitch: s({ robe: ramp("#4a6a4a", { lo: "#102a1a" }), inner: PAL.paper, trim: PAL.purple, sash: PAL.purple, hair: PAL.hairWhite, hairStyle: "wild", female: true, hunch: 0.18, scale: 0.9, weapon: "staff", eye: "#8a4ab0", shawl: ramp("#6a5a8a") }),
  teapicker: s({ robe: ramp("#7aa86a"), inner: PAL.white, trim: PAL.white, sash: PAL.rose, hair: PAL.hairBlack, hairStyle: "twin", female: true, hat: "straw", hatRamp: PAL.straw, skin: PAL.skinTan, eye: "#3a2a1a", flare: 4.8, hem: 3.8, shoes: PAL.brown }),
  teamaster: s({ robe: ramp("#5a7a5a", { lo: "#1a2a2a" }), inner: PAL.paper, trim: PAL.paper, sash: PAL.gold, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.black, weapon: "fan", hunch: 0.08, flare: 5.6 }),
  cook: s({ robe: PAL.white, inner: PAL.white, trim: PAL.red, sash: PAL.red, hair: PAL.hairBlack, hairStyle: "short", hat: "hood", hatRamp: PAL.white, skin: PAL.skinTan, scale: 1.04, flare: 5.8, hem: 3.8, shoes: PAL.black }),
  taiji: s({ robe: PAL.white, inner: PAL.black, trim: PAL.black, sash: PAL.black, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", hat: "crown", hatRamp: PAL.black, weapon: "whisk", flare: 5.8 }),
  // the three sects of the south and east, and the spirit of the Dragon Vein
  yanhuo: s({ robe: PAL.crimson, inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairAuburn, hairStyle: "long", female: true, hat: "crown", hatRamp: PAL.gold, cape: ramp("#f06a2a", { hi: "#ffe0a0", lo: "#5a0a10" }), weapon: "jian", weaponRamp: PAL.gold, eye: "#c84a1a", flare: 5.8 }),
  phoenix: s({ robe: ramp("#c8402a", { lo: "#3a0a14" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.black, hairStyle: "topknot", weapon: "saber", weaponRamp: PAL.gold, flare: 4.8, eye: "#5a1a1a" }),
  miner: s({ robe: ramp("#7a6a5a", { lo: "#2a1a1a" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.red, hair: PAL.hairBrown, beard: PAL.hairGrey, hairStyle: "short", hat: "straw", hatRamp: ramp("#6a6a7a"), skin: PAL.skinTan, flare: 4.2, hem: 4.8, shoes: PAL.brown, eye: "#3a2a1a" }),
  baizhi: s({ robe: ramp("#e8f0d8", { lo: "#4a6a4a" }), inner: PAL.green, trim: PAL.green, sash: PAL.jade, hair: PAL.hairWhite, hairStyle: "bun", female: true, hunch: 0.06, weapon: "staff", weaponRamp: PAL.wood, shawl: ramp("#9ad08a", { lo: "#2a4a2a" }), eye: "#3a5a2a", flare: 5.6 }),
  herbalist: s({ robe: ramp("#6aa85a", { lo: "#1a3a2a" }), inner: PAL.white, trim: PAL.white, sash: PAL.rose, hair: PAL.hairBrown, hairStyle: "twin", female: true, scale: 0.86, eye: "#3a2a1a", flare: 4.8, hem: 3.8, shoes: PAL.brown }),
  poisoner: s({ robe: ramp("#4a5a3a", { lo: "#0a140a" }), inner: PAL.black, trim: PAL.purple, sash: PAL.purple, hair: PAL.hairBlack, hairStyle: "wild", hat: "hood", hatRamp: ramp("#2a3a2a"), skin: PAL.skinPale, weapon: "fan", weaponRamp: PAL.purple, eye: "#6ad04a", flare: 5 }),
  lingfeng: s({ robe: ramp("#dfe8f4", { lo: "#3a4a6a" }), inner: PAL.navy, trim: PAL.steel, sash: PAL.navy, hair: PAL.hairSilver, beard: PAL.hairSilver, hairStyle: "long", hat: "crown", hatRamp: PAL.steel, cape: ramp("#3a5a8a", { lo: "#0a1a3a" }), weapon: "jian", eye: "#2a3a6a", flare: 5.2 }),
  swordsea: s({ robe: ramp("#3a5a8a", { lo: "#0a1a3a" }), inner: PAL.white, trim: PAL.steel, sash: PAL.white, hairStyle: "topknot", weapon: "jian", flare: 4.6 }),
  dragon: s({ robe: ramp("#9ff5de", { hi: "#ffffff", lo: "#1a5a6a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hair: ramp("#e8fff8", { lo: "#5a9a9a" }), beard: ramp("#e8fff8", { lo: "#5a9a9a" }), hairStyle: "long", hat: "crown", hatRamp: PAL.jade, weapon: "whisk", glowEyes: "#ffe040", scale: 1.12, hem: 1.6, flare: 6.4 }),
  patriarch: s({ robe: PAL.crimson, inner: PAL.black, trim: PAL.gold, sash: PAL.black, hair: PAL.hairSilver, hairStyle: "long", hat: "crown", hatRamp: PAL.black, cape: PAL.black, weapon: "saber", scale: 1.3, glowEyes: "#ff2040", flare: 6.2 }),
  // the keeper of the almanac, and the four wardens of the year
  almanac: s({ robe: ramp("#c89a4a", { lo: "#4a2a1a" }), inner: PAL.paper, trim: PAL.navy, sash: PAL.navy, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.black, weapon: "fan", weaponRamp: PAL.paper, hunch: 0.1, flare: 5.6, eye: "#3a2a1a" }),
  springWarden: s({ robe: ramp("#ffe0ee", { lo: "#a85a8a" }), inner: PAL.green, trim: PAL.rose, sash: PAL.green, hair: ramp("#5a3a6a"), hairStyle: "long", female: true, hat: "veil", hatRamp: ramp("#fff0f6"), shawl: ramp("#f8bcd6", { lo: "#a85a8a" }), eye: "#a83a6a", hem: 1.4, flare: 6.4 }),
  summerWarden: s({ robe: ramp("#4ab06a", { lo: "#0a3a2a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.azure, hair: PAL.hairBlack, hairStyle: "topknot", hat: "crown", hatRamp: PAL.jade, cape: ramp("#78c8ff", { lo: "#1a4a8a" }), weapon: "fan", weaponRamp: PAL.jade, eye: "#2a6a3a", hem: 1.4, flare: 6.2 }),
  autumnWarden: s({ robe: ramp("#d8702a", { lo: "#5a1a10" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.crimson, hair: PAL.hairSilver, hairStyle: "bun", female: true, hunch: 0.12, weapon: "staff", weaponRamp: PAL.gold, shawl: ramp("#f0c050", { lo: "#7a3a10" }), eye: "#7a3a10", hem: 1.4, flare: 6 }),
  winterWarden: s({ robe: ramp("#e8f0ff", { lo: "#4a5a8a" }), inner: PAL.navy, trim: PAL.steel, sash: PAL.navy, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "long", hat: "hood", hatRamp: ramp("#ffffff", { lo: "#8a9ab8" }), cape: ramp("#c8d8f0", { lo: "#3a4a7a" }), weapon: "staff", weaponRamp: PAL.steel, glowEyes: "#9ad8ff", hunch: 0.06, hem: 1.4, flare: 6.4 }),
  // the War of the Iron Banner: the imperial army, the folk the war drove from their homes, and the horde
  general: s({ robe: ramp("#b02a2a", { lo: "#3a0a10" }), inner: PAL.steel, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairBlack, hairStyle: "long", female: true, hat: "helmet", hatRamp: ramp("#c8ccd8", { lo: "#2a2e3e" }), cape: ramp("#d83a3a", { lo: "#4a0a10" }), weapon: "spear", eye: "#3a1a1a", flare: 4.6, hem: 3.8, shoes: PAL.black }),
  soldier: s({ robe: ramp("#a8382e", { lo: "#3a0a10" }), inner: PAL.steel, trim: PAL.steel, sash: PAL.black, hairStyle: "topknot", hat: "helmet", hatRamp: ramp("#9aa0b0", { lo: "#22263a" }), skin: PAL.skinTan, weapon: "spear", flare: 4.2, hem: 4.6, shoes: PAL.black }),
  medic: s({ robe: ramp("#f0f0e8", { lo: "#6a6a7a" }), inner: PAL.green, trim: PAL.red, sash: PAL.green, hair: PAL.hairBlack, hairStyle: "bun", female: true, eye: "#2a3a2a", flare: 4.8, hem: 3.8, shoes: PAL.brown, shawl: ramp("#c8e0b8", { lo: "#3a5a3a" }) }),
  drummer: s({ robe: ramp("#c83a2a", { lo: "#4a0a10" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.black, hairStyle: "topknot", scale: 0.74, eye: "#3a2a1a", hem: 4.6, flare: 4 }),
  quartermaster: s({ robe: ramp("#8a6a3a", { lo: "#2a1a10" }), inner: PAL.paper, trim: PAL.red, sash: PAL.red, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "short", hat: "scholar", hatRamp: PAL.black, weapon: "fan", weaponRamp: PAL.paper, scale: 1.04, flare: 5.6, hem: 4 }),
  refugeeM: s({ robe: ramp("#7a7a72", { lo: "#24221e" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairBlack, hairStyle: "wild", skin: PAL.skinTan, hunch: 0.08, flare: 4.2, hem: 4.8, shoes: PAL.brown }),
  refugeeF: s({ robe: ramp("#8a7a6a", { lo: "#2a2018" }), inner: PAL.paper, trim: PAL.paper, sash: PAL.grey, hair: PAL.hairBlack, hairStyle: "bun", female: true, hat: "hood", hatRamp: ramp("#6a645a", { lo: "#1a1814" }), eye: "#3a2a1a", hunch: 0.06, flare: 4.8, hem: 3.8, shoes: PAL.brown }),
  scout: s({ robe: ramp("#3a5a3a", { lo: "#0a1a10" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairBrown, hairStyle: "twin", female: true, hat: "hood", hatRamp: ramp("#4a6a3a", { lo: "#10200a" }), weapon: "jian", eye: "#2a4a2a", flare: 4.2, hem: 4.6, shoes: PAL.brown }),
  deserter: s({ robe: ramp("#8a7a5a", { lo: "#2a2010" }), inner: PAL.black, trim: ramp("#c8b890"), sash: PAL.red, hair: PAL.hairBlack, beard: PAL.hairBlack, hairStyle: "long", skin: PAL.skinTan, cape: ramp("#6a5a4a", { lo: "#1a120a" }), weapon: "saber", flare: 4.4, hem: 4.4, shoes: PAL.brown }),
  envoy: s({ robe: ramp("#2a2a3a", { lo: "#06060e" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.gold, weapon: "fan", weaponRamp: PAL.gold, flare: 5.8 }),
  widow: s({ robe: ramp("#f4f2ee", { lo: "#7a7a8a" }), inner: PAL.white, trim: PAL.paper, sash: PAL.white, hair: PAL.hairBlack, hairStyle: "long", female: true, hat: "veil", hatRamp: ramp("#ffffff", { lo: "#9a9aaa" }), eye: "#3a3a4a", flare: 5.6 }),
  raider: s({ robe: ramp("#7a5a3a", { lo: "#20140a" }), inner: PAL.black, trim: ramp("#d8c8a0"), sash: PAL.black, skin: PAL.skinTan, hairStyle: "wild", beard: PAL.hairBlack, hat: "hood", hatRamp: ramp("#c8b898", { lo: "#4a3a2a" }), weapon: "spear", weaponRamp: PAL.woodDark, flare: 4.2, hem: 4.6, shoes: PAL.brown, eye: "#3a1a10" }),
  ironguard: s({ robe: ramp("#5a5e6e", { lo: "#10121a" }), inner: PAL.black, trim: PAL.steel, sash: PAL.red, skin: PAL.skinTan, hairStyle: "short", beard: PAL.hairBlack, hat: "helmet", hatRamp: ramp("#6a6e7e", { lo: "#10121a" }), cape: ramp("#2a2a32", { lo: "#000000" }), weapon: "saber", flare: 4.4, hem: 4.2, shoes: PAL.black }),
  bannerman: s({ robe: ramp("#2a1a20", { lo: "#000000" }), inner: PAL.crimson, trim: PAL.crimson, sash: PAL.gold, skin: PAL.skinTan, hairStyle: "wild", hair: PAL.hairBlack, hat: "helmet", hatRamp: ramp("#3a2a30", { lo: "#000000" }), cape: PAL.crimson, glowEyes: "#ff7a2a", weapon: "spear", weaponRamp: PAL.black, flare: 4.6, hem: 4 }),
  warcaptain: s({ robe: ramp("#6a4a2a", { lo: "#1a0e06" }), inner: PAL.black, trim: PAL.gold, sash: PAL.red, skin: PAL.skinTan, hairStyle: "wild", beard: PAL.hairBrown, hair: PAL.hairBrown, hat: "helmet", hatRamp: ramp("#c8a050", { lo: "#3a2a10" }), cape: ramp("#d8c8a8", { lo: "#5a4a3a" }), weapon: "saber", scale: 1.14, flare: 5 }),
  ironmarshal: s({ robe: ramp("#4a5060", { lo: "#08080e" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.black, skin: PAL.skinTan, hairStyle: "topknot", beard: PAL.hairGrey, hair: PAL.hairGrey, hat: "helmet", hatRamp: ramp("#f0c050", { lo: "#4a2a10" }), cape: ramp("#1a1a2a", { lo: "#000000" }), weapon: "spear", weaponRamp: PAL.black, scale: 1.2, flare: 5.4 }),
  shaman: s({ robe: ramp("#5a1020", { lo: "#100004" }), inner: PAL.black, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairWhite, hairStyle: "wild", hat: "hood", hatRamp: ramp("#2a0a10", { lo: "#000000" }), glowEyes: "#ff3050", weapon: "staff", weaponRamp: PAL.black, scale: 1.12, flare: 5.8, shawl: ramp("#c8b898", { lo: "#3a2a1a" }) }),
  tuoba: s({ robe: ramp("#1a1a22", { lo: "#000000" }), inner: PAL.crimson, trim: PAL.gold, sash: PAL.gold, skin: PAL.skinTan, hairStyle: "long", hair: PAL.hairBlack, hat: "helmet", hatRamp: ramp("#ffd060", { lo: "#5a2a00" }), cape: ramp("#e8dcc0", { lo: "#4a3a2a" }), glowEyes: "#ffb040", weapon: "saber", weaponRamp: PAL.gold, scale: 1.3, flare: 6.2 }),
  // the Founder's Road: Daoist Qingxu the Stele-Keeper, Wei Kongming the Dao-Eater, the hollowed who follow him, and the Echoes that wear the eaten Daos
  keeper: s({ robe: ramp("#c8c0a8", { lo: "#4a4030" }), inner: PAL.paper, trim: PAL.jade, sash: PAL.jade, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", hat: "straw", hatRamp: PAL.straw, weapon: "staff", hunch: 0.12, flare: 5.6, shawl: ramp("#7a6a4a", { lo: "#2a2010" }) }),
  kongming: s({ robe: ramp("#e8e4f0", { lo: "#3a3450" }), inner: PAL.black, trim: ramp("#b8a8e8"), sash: PAL.black, skin: PAL.skinPale, hair: PAL.hairSilver, hairStyle: "long", hat: "none", glowEyes: "#e8e0ff", weapon: "whisk", scale: 1.18, flare: 6.4, cape: ramp("#2a2440", { lo: "#000000" }) }),
  hollow: s({ robe: ramp("#9a96a8", { lo: "#2a2834" }), inner: PAL.grey, trim: PAL.grey, sash: PAL.black, skin: PAL.skinPale, hair: PAL.hairGrey, hairStyle: "bald", hat: "hood", hatRamp: ramp("#6a6678", { lo: "#1a1824" }), glowEyes: "#d8d0ff", flare: 5.2, hem: 1.8, hunch: 0.08 }),
  hollowsage: s({ robe: ramp("#d8d4e4", { lo: "#3a364a" }), inner: PAL.black, trim: ramp("#b8a8e8"), sash: PAL.black, skin: PAL.skinPale, hair: PAL.hairSilver, beard: PAL.hairSilver, hairStyle: "long", hat: "crown", hatRamp: PAL.grey, glowEyes: "#e8e0ff", weapon: "whisk", flare: 6, hem: 1.6, scale: 1.08 }),
  echoWater: s({ robe: ramp("#6ab8f0", { lo: "#0a2a5a" }), inner: PAL.white, trim: PAL.white, sash: PAL.azure, skin: PAL.skinPale, hair: ramp("#bfe8ff"), hairStyle: "long", female: true, hat: "veil", hatRamp: ramp("#e8f6ff"), glowEyes: "#ffffff", scale: 1.15, flare: 6.4, hem: 1.4 }),
  echoWood: s({ robe: ramp("#7a9a4a", { lo: "#1a2a0a" }), inner: PAL.moss, trim: PAL.brown, sash: PAL.brown, skin: ramp("#c8b080"), hair: ramp("#9ac070"), hairStyle: "wild", glowEyes: "#d8ff9a", weapon: "staff", weaponRamp: PAL.wood, scale: 1.15, flare: 6, hem: 1.6, shawl: ramp("#c8d880", { lo: "#3a4a10" }) }),
  echoWind: s({ robe: ramp("#c8f0e8", { lo: "#2a5a5a" }), inner: PAL.white, trim: PAL.teal, sash: PAL.teal, skin: PAL.skinPale, hair: PAL.hairWhite, hairStyle: "long", glowEyes: "#ffffff", weapon: "fan", scale: 1.15, flare: 6.6, hem: 1.2, shawl: ramp("#e8fff8", { lo: "#4a7a7a" }) }),
  echoFire: s({ robe: ramp("#8a8a8a", { lo: "#1a1a1a" }), inner: PAL.black, trim: ramp("#c8c8c8"), sash: PAL.black, skin: ramp("#a8a0a0"), hair: ramp("#d8d8d8"), hairStyle: "wild", glowEyes: "#ffffff", weapon: "saber", weaponRamp: PAL.grey, scale: 1.18, flare: 6, hem: 1.6, cape: ramp("#5a5a5a", { lo: "#0a0a0a" }) }),
  echoEarth: s({ robe: ramp("#a88a5a", { lo: "#2a1e0a" }), inner: PAL.stone, trim: PAL.stone, sash: PAL.brown, skin: ramp("#b89a6a"), hair: PAL.hairBrown, hairStyle: "bald", glowEyes: "#ffe0a0", scale: 1.32, flare: 6.8, hem: 2.4 }),
  echoMetal: s({ robe: ramp("#8a92a8", { lo: "#1a1e2a" }), inner: PAL.steel, trim: ramp("#c87a4a"), sash: ramp("#c87a4a"), skin: PAL.skinPale, hair: PAL.hairGrey, hairStyle: "topknot", hat: "helmet", hatRamp: ramp("#9aa0b0", { lo: "#2a2e3a" }), glowEyes: "#ffffff", weapon: "jian", weaponRamp: ramp("#c87a4a"), scale: 1.18, flare: 5.6, hem: 2.4 }),
  echoThunder: s({ robe: ramp("#6a5aa8", { lo: "#120a2a" }), inner: PAL.black, trim: ramp("#e8e0ff"), sash: ramp("#e8e0ff"), skin: PAL.skinPale, hair: ramp("#e8e0ff"), hairStyle: "wild", glowEyes: "#ffffff", weapon: "spear", weaponRamp: ramp("#e8e0ff"), scale: 1.2, flare: 6.2, hem: 1.6, cape: ramp("#3a2a6a", { lo: "#000000" }) }),
  echoIce: s({ robe: ramp("#bfe8ff", { lo: "#2a4a6a" }), inner: PAL.white, trim: PAL.white, sash: PAL.azure, skin: ramp("#e8f6ff"), hair: PAL.hairWhite, hairStyle: "long", female: true, hat: "crown", hatRamp: ramp("#e8f6ff"), glowEyes: "#a8e0ff", weapon: "jian", weaponRamp: ramp("#e8f6ff"), scale: 1.16, flare: 6.4, hem: 1.4 }),
  echoLife: s({ robe: ramp("#f6a6c9", { lo: "#3a0a2a" }), inner: PAL.black, trim: PAL.moss, sash: PAL.moss, skin: PAL.skinPale, hair: PAL.hairBlack, hairStyle: "long", female: true, hat: "veil", hatRamp: ramp("#3a2a3a"), glowEyes: "#f6a6c9", weapon: "whisk", scale: 1.16, flare: 6.4, hem: 1.6, shawl: ramp("#9ac070", { lo: "#1a2a0a" }) }),
  // the Tidewater Reach: boatfolk of Hailing's canals, lion dancers, street acrobats and the moneychangers of the port
  boatwoman: s({ robe: ramp("#3a6a8a"), inner: PAL.white, trim: PAL.white, sash: PAL.teal, skin: PAL.skinTan, hairStyle: "bun", female: true, hat: "straw", hatRamp: PAL.straw, flare: 4.2, hem: 4.6, shoes: PAL.brown }),
  liondancer: s({ robe: ramp("#e8c040", { lo: "#5a3a00" }), inner: PAL.red, trim: PAL.red, sash: PAL.red, skin: PAL.skinTan, hairStyle: "short", flare: 3.8, hem: 4.8, shoes: PAL.black }),
  acrobat: s({ robe: ramp("#e84a6a", { lo: "#4a0a1a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.jade, hairStyle: "twin", female: true, scale: 0.86, flare: 3.6, hem: 5, shoes: PAL.red }),
  merchant: s({ robe: ramp("#6a3a8a", { lo: "#1a0a2a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairBlack, beard: PAL.hairBlack, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.black, flare: 6, hunch: 0.04 }),
  // the Ten Halls: the court's officers, the five of Room Seven and the young master, the ten hall masters, and the troubles at the end of each hall's tale
  wdherald: s({ robe: ramp("#e8d8a8", { lo: "#5a4a2a" }), inner: PAL.azure, trim: PAL.navy, sash: PAL.navy, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.black, weapon: "fan", weaponRamp: PAL.paper, flare: 5 }),
  yanshu: s({ robe: ramp("#c8c8d0", { lo: "#3a3a4a" }), inner: PAL.black, trim: ramp("#b8a8e8"), sash: PAL.black, skin: PAL.skinPale, hair: PAL.hairBlack, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.black, weapon: "whisk", flare: 5.8, hunch: 0.04, scale: 1.08 }),
  steward: s({ robe: ramp("#7a6a5a", { lo: "#2a1a14" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.black, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "short", hat: "hood", hatRamp: ramp("#4a3a2a"), weapon: "staff", weaponRamp: PAL.wood, hunch: 0.14, flare: 5, hem: 3.6, shoes: PAL.brown }),
  fanyu: s({ robe: ramp("#3a6a9a", { lo: "#0a1a3a" }), inner: PAL.white, trim: PAL.white, sash: PAL.gold, hair: PAL.hairBlack, hairStyle: "bun", female: true, weapon: "jian", eye: "#2a2a3a", flare: 5 }),
  outerM: s({ robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.navy, hairStyle: "topknot", hair: PAL.hairBlack, flare: 4.6, hem: 4 }),
  outerF: s({ robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.azure, hairStyle: "bun", female: true, hair: PAL.hairBrown, eye: "#3a2a1a", flare: 4.8, hem: 3.8 }),
  shenbai: s({ robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.azure, trim: PAL.brown, sash: PAL.brown, hairStyle: "short", hair: PAL.hairBrown, skin: PAL.skinTan, weapon: "staff", weaponRamp: PAL.wood, eye: "#3a2a1a", flare: 4.4, hem: 4.4, shoes: PAL.brown }),
  yaozhi: s({ robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.rose, hairStyle: "long", female: true, hair: PAL.hairBlack, hat: "crown", hatRamp: PAL.gold, weapon: "fan", weaponRamp: PAL.gold, eye: "#4a2a3a", flare: 5.2, shawl: ramp("#f8e0a0", { lo: "#8a6a20" }) }),
  tieniu: s({ robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.azure, trim: PAL.navy, sash: PAL.red, hairStyle: "short", hair: PAL.hairBlack, skin: PAL.skinTan, scale: 1.2, eye: "#3a2a1a", flare: 5.4, hem: 4.2, shoes: PAL.brown }),
  meilan: s({ robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.azure, trim: PAL.purple, sash: PAL.purple, hairStyle: "twin", female: true, hair: PAL.hairBlack, eye: "#3a2a4a", scale: 0.92, flare: 4.8 }),
  qiu: s({ robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.red, hairStyle: "topknot", hair: PAL.hairBrown, scale: 0.72, eye: "#3a2a1a", hem: 4.6, flare: 4 }),
  murong: s({ robe: ramp("#4a3a7a", { lo: "#10082a" }), inner: PAL.white, trim: PAL.gold, sash: PAL.gold, hairStyle: "long", hair: PAL.hairBlack, hat: "crown", hatRamp: PAL.gold, weapon: "jian", weaponRamp: PAL.gold, eye: "#2a1a3a", flare: 5, cape: ramp("#8a6ac8", { lo: "#1a0a3a" }) }),
  hmwater: s({ robe: ramp("#6ab8f0", { lo: "#0a2a5a" }), inner: PAL.white, trim: PAL.white, sash: PAL.navy, hair: PAL.hairWhite, hairStyle: "bun", female: true, hat: "veil", hatRamp: ramp("#e8f6ff"), weapon: "whisk", eye: "#2a4a6a", hunch: 0.04, flare: 6 }),
  hmwood: s({ robe: ramp("#5a8a4a", { lo: "#102a10" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", hat: "straw", hatRamp: PAL.straw, weapon: "staff", weaponRamp: PAL.wood, hunch: 0.18, scale: 0.94, flare: 5.4 }),
  hmwind: s({ robe: ramp("#c8f0e8", { lo: "#2a5a5a" }), inner: PAL.white, trim: PAL.teal, sash: PAL.teal, hair: PAL.hairSilver, hairStyle: "wild", weapon: "fan", weaponRamp: PAL.white, flare: 5.2, shawl: ramp("#e8fff8", { lo: "#4a7a7a" }) }),
  hmfire: s({ robe: ramp("#c8402a", { lo: "#3a0a14" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.black, hair: PAL.hairAuburn, hairStyle: "bun", female: true, skin: PAL.skinTan, eye: "#8a2a1a", flare: 5, hem: 3.6, shawl: ramp("#f08a3a", { lo: "#5a1a0a" }) }),
  hmearth: s({ robe: ramp("#a88a5a", { lo: "#2a1e0a" }), inner: PAL.stone, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairBrown, hairStyle: "bald", skin: PAL.skinTan, scale: 1.3, flare: 6.2, hem: 3.6, shoes: PAL.brown }),
  hmmetal: s({ robe: ramp("#8a92a8", { lo: "#1a1e2a" }), inner: PAL.steel, trim: ramp("#c87a4a"), sash: ramp("#c87a4a"), hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "topknot", skin: PAL.skinTan, weapon: "jian", weaponRamp: PAL.steel, flare: 4.8, hem: 4, shawl: ramp("#3a2a26") }),
  hmthunder: s({ robe: ramp("#4a3a8a", { lo: "#0a0a2a" }), inner: PAL.black, trim: ramp("#e8e0ff"), sash: ramp("#e8e0ff"), hair: PAL.hairBlack, hairStyle: "long", female: true, hat: "crown", hatRamp: PAL.steel, weapon: "spear", weaponRamp: ramp("#e8e0ff"), eye: "#3a2a6a", flare: 5.4, cape: ramp("#2a2a5a", { lo: "#000000" }) }),
  hmice: s({ robe: ramp("#e8f6ff", { lo: "#4a6a8a" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.navy, skin: PAL.skinPale, hair: ramp("#bfe8ff"), hairStyle: "long", hat: "scholar", hatRamp: PAL.navy, weapon: "fan", weaponRamp: ramp("#bfe8ff"), eye: "#2a4a6a", flare: 5.8 }),
  hmlife: s({ robe: ramp("#f0e8f0", { lo: "#5a4a5a" }), inner: PAL.moss, trim: PAL.rose, sash: PAL.moss, hair: PAL.hairGrey, hairStyle: "bun", female: true, weapon: "staff", weaponRamp: PAL.wood, eye: "#4a2a3a", hunch: 0.08, flare: 5.6, shawl: ramp("#f6a6c9", { lo: "#5a1a3a" }) }),
  ning: s({ robe: ramp("#e8e0ff", { lo: "#3a3450" }), inner: PAL.black, trim: ramp("#b8a8e8"), sash: PAL.black, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "long", hat: "crown", hatRamp: ramp("#b8a8e8"), weapon: "whisk", hunch: 0.12, flare: 6.2 }),
  blight: s({ robe: ramp("#3a4a2a", { lo: "#0a1004" }), inner: PAL.black, trim: ramp("#8a7aa8"), sash: PAL.brown, skin: ramp("#6a5a4a"), hair: ramp("#9a8ac0"), hairStyle: "wild", glowEyes: "#d8ff9a", weapon: "staff", weaponRamp: PAL.woodDark, scale: 1.3, flare: 6.6, hem: 1.4, shawl: ramp("#c8a8e8", { lo: "#3a2a5a" }) }),
  furnacespirit: s({ robe: ramp("#7a7470", { lo: "#1a1410" }), inner: PAL.orange, trim: ramp("#c8c0b8"), sash: PAL.black, skin: ramp("#a89890"), hair: ramp("#d8d0c8"), hairStyle: "wild", glowEyes: "#ffb040", scale: 1.3, flare: 6.6, hem: 1.6, cape: ramp("#5a5450", { lo: "#0a0808" }) }),
  golem: s({ robe: ramp("#9a9488", { lo: "#2a2620" }), inner: PAL.stone, trim: PAL.stone, sash: PAL.brown, skin: ramp("#a8a094"), hair: PAL.hairGrey, hairStyle: "bald", glowEyes: "#ffe0a0", scale: 1.4, flare: 7, hem: 2.6 }),
  enforcer: s({ robe: ramp("#2a2a3a", { lo: "#08080e" }), inner: PAL.crimson, trim: PAL.steel, sash: PAL.crimson, hair: PAL.hairBlack, beard: PAL.hairBlack, hairStyle: "topknot", hat: "hood", hatRamp: PAL.black, weapon: "rod", weaponRamp: PAL.steel, scale: 1.14, flare: 4.8, hem: 4 }),
  frostwarden: s({ robe: ramp("#bfe8ff", { lo: "#2a4a6a" }), inner: PAL.white, trim: PAL.white, sash: PAL.azure, skin: ramp("#e8f6ff"), hair: PAL.hairWhite, hairStyle: "long", hat: "crown", hatRamp: ramp("#e8f6ff"), glowEyes: "#a8e0ff", weapon: "staff", weaponRamp: ramp("#e8f6ff"), scale: 1.28, flare: 6.4, hem: 1.4 }),
  murongelder: s({ robe: ramp("#6a4a8a", { lo: "#1a0a2a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, skin: ramp("#c8b8b0"), hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.gold, weapon: "fan", weaponRamp: PAL.gold, glowEyes: "#f6a6c9", scale: 1.22, flare: 6.4, hunch: 0.06 }),
  // the City of Nine Tiers: the porter girl and the registrar who walk it with her, the folk of each tier, and the trouble at the top of each stair
  ahlou: s({ robe: ramp("#8a6a4a", { lo: "#2a1a10" }), inner: PAL.paper, trim: PAL.red, sash: PAL.red, hairStyle: "twin", female: true, hair: PAL.hairBlack, skin: PAL.skinTan, hat: "straw", hatRamp: PAL.straw, eye: "#3a2a1a", scale: 0.84, hem: 4.8, flare: 4, shoes: PAL.brown }),
  wenqi: s({ robe: ramp("#b8c0d0", { lo: "#3a4058" }), inner: PAL.navy, trim: PAL.navy, sash: PAL.navy, hairStyle: "topknot", hair: PAL.hairBlack, hat: "scholar", hatRamp: PAL.black, eye: "#2a2a3a", flare: 5, hem: 3.4 }),
  weigher: s({ robe: ramp("#ece6d8", { lo: "#6a6458" }), inner: PAL.black, trim: PAL.gold, sash: PAL.black, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "bald", skin: PAL.skinPale, hunch: 0.1, flare: 5.6, eye: "#3a3a3a" }),
  tierwarden: s({ robe: ramp("#5a5a72", { lo: "#141428" }), inner: PAL.steel, trim: PAL.gold, sash: PAL.red, hairStyle: "topknot", hair: PAL.hairBlack, hat: "helmet", hatRamp: PAL.steel, weapon: "spear", weaponRamp: PAL.steel, scale: 1.08, flare: 4.4, hem: 3.6, cape: ramp("#8a2a2a", { lo: "#2a0a0a" }) }),
  overseer: s({ robe: ramp("#6a5a3a", { lo: "#1a1408" }), inner: PAL.black, trim: PAL.brown, sash: PAL.black, hair: PAL.hairBlack, beard: PAL.hairBlack, hairStyle: "short", skin: PAL.skinTan, weapon: "rod", weaponRamp: PAL.woodDark, scale: 1.2, flare: 4.6, hem: 3.8, shoes: PAL.brown }),
  debtsmith: s({ robe: ramp("#c8783a", { lo: "#3a1408" }), inner: PAL.black, trim: PAL.gold, sash: PAL.brown, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "topknot", skin: PAL.skinTan, weapon: "saber", weaponRamp: ramp("#e8a060"), scale: 1.18, flare: 4.8, hem: 3.6 }),
  inquisitor: s({ robe: ramp("#d8dce8", { lo: "#4a5068" }), inner: PAL.black, trim: PAL.steel, sash: PAL.steel, hair: PAL.hairSilver, hairStyle: "long", hat: "crown", hatRamp: PAL.steel, weapon: "whisk", eye: "#3a3a5a", flare: 5.4, mask: ramp("#e8ecf4") }),
  matchmaker: s({ robe: ramp("#d83a4a", { lo: "#4a0a1a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hair: PAL.hairBlack, hairStyle: "bun", female: true, hat: "crown", hatRamp: PAL.gold, weapon: "fan", weaponRamp: PAL.red, eye: "#4a1a2a", flare: 5.8, shawl: ramp("#ffb0c0", { lo: "#8a2a4a" }) }),
  champion: s({ robe: ramp("#e8b83a", { lo: "#4a2a08" }), inner: PAL.red, trim: PAL.red, sash: PAL.black, hair: PAL.hairBlack, beard: PAL.hairBlack, hairStyle: "wild", skin: PAL.skinTan, hat: "helmet", hatRamp: PAL.gold, weapon: "saber", weaponRamp: PAL.gold, scale: 1.2, flare: 5, hem: 3.4 }),
  justiciar: s({ robe: ramp("#6a3a8a", { lo: "#1a0a2a" }), inner: PAL.black, trim: PAL.gold, sash: PAL.black, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.black, weapon: "staff", weaponRamp: PAL.gold, scale: 1.12, flare: 6, hunch: 0.04 }),
  yearelder: s({ robe: ramp("#f0f4ff", { lo: "#5a6480" }), inner: PAL.jade, trim: PAL.jade, sash: PAL.jade, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "long", skin: ramp("#f4e0d0"), weapon: "whisk", hunch: 0.16, flare: 6.4, eye: "#4a6a5a" }),
  starregistrar: s({ robe: ramp("#2a3a7a", { lo: "#060a20" }), inner: PAL.gold, trim: ramp("#fff0a0"), sash: PAL.gold, hair: PAL.hairBlack, hairStyle: "long", female: true, hat: "veil", hatRamp: ramp("#c8d0ff"), weapon: "fan", weaponRamp: PAL.navy, eye: "#2a2a6a", flare: 6, cape: ramp("#1a2a5a", { lo: "#000010" }) }),
  loufeng: s({ robe: ramp("#3a3a5a", { lo: "#08081a" }), inner: ramp("#e8e0ff"), trim: ramp("#e8e0ff"), sash: PAL.purple, hair: PAL.hairBlack, hairStyle: "bun", female: true, hat: "helmet", hatRamp: ramp("#b8b0e8"), weapon: "spear", weaponRamp: ramp("#e8e0ff"), eye: "#3a2a4a", scale: 1.1, flare: 4.8, cape: ramp("#5a4a9a", { lo: "#10082a" }) }),
  sovereign: s({ robe: ramp("#f8f0d8", { lo: "#6a5a3a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.crimson, hair: PAL.hairBlack, beard: PAL.hairBlack, hairStyle: "topknot", hat: "crown", hatRamp: PAL.gold, weapon: "jian", weaponRamp: PAL.gold, scale: 1.18, flare: 6.6, cape: ramp("#f2c55c", { lo: "#5a3a10" }) }),
  nobleM: s({ robe: ramp("#3a7a6a", { lo: "#0a2a20" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hairStyle: "topknot", hair: PAL.hairBlack, hat: "scholar", hatRamp: PAL.gold, weapon: "fan", weaponRamp: PAL.paper, flare: 5.6 }),
  nobleF: s({ robe: ramp("#c86a9a", { lo: "#3a0a2a" }), inner: PAL.white, trim: PAL.gold, sash: PAL.gold, hairStyle: "bun", female: true, hair: PAL.hairBlack, hat: "crown", hatRamp: PAL.gold, eye: "#4a2a3a", flare: 6, shawl: ramp("#f8e0f0", { lo: "#8a5a7a" }) }),
  severed: s({ robe: ramp("#4a4a6a", { lo: "#0a0a1a" }), inner: PAL.black, trim: ramp("#c8c0ff"), sash: ramp("#c8c0ff"), hairStyle: "topknot", hair: PAL.hairBlack, hat: "helmet", hatRamp: PAL.steel, weapon: "jian", weaponRamp: ramp("#e8e0ff"), mask: ramp("#d8d4e8"), scale: 1.06, flare: 4.6 }),
  bearer: s({ robe: ramp("#c83a3a", { lo: "#3a0a0a" }), inner: PAL.paper, trim: PAL.gold, sash: PAL.black, hairStyle: "short", hair: PAL.hairBlack, skin: PAL.skinTan, hat: "straw", hatRamp: PAL.straw, hem: 4.6, flare: 4, shoes: PAL.brown }),
  tierherald: s({ robe: ramp("#f2d050", { lo: "#5a3a08" }), inner: PAL.red, trim: PAL.red, sash: PAL.red, hairStyle: "topknot", hair: PAL.hairBlack, hat: "scholar", hatRamp: PAL.red, flare: 5.2 }),
  forger: s({ robe: ramp("#5a5a6a", { lo: "#141420" }), inner: PAL.paper, trim: PAL.black, sash: PAL.black, hairStyle: "bun", female: true, hair: PAL.hairGrey, hat: "hood", hatRamp: ramp("#3a3a4a"), eye: "#3a3a4a", hunch: 0.06, flare: 4.8, hem: 3.8 }),
  suwan: s({ robe: ramp("#9ad8c0", { lo: "#1a4a3a" }), inner: PAL.white, trim: PAL.jade, sash: PAL.rose, hairStyle: "long", female: true, hair: PAL.hairBlack, eye: "#2a3a3a", scale: 0.94, flare: 5.2, shawl: ramp("#e8fff4", { lo: "#4a7a6a" }) }),
  // the jianghu's other peoples (see world/peoples.ts): the Concord's envoy, and for each people its elder, its guide, its folk and its trouble
  concordenvoy: s({ robe: ramp("#e8dcc0", { lo: "#5a5040" }), inner: PAL.jade, trim: PAL.jade, sash: PAL.jade, hair: PAL.hairGrey, beard: PAL.hairGrey, hairStyle: "topknot", hat: "scholar", hatRamp: PAL.jadeDeep, weapon: "staff", weaponRamp: PAL.wood, hunch: 0.06, flare: 5.4 }),
  foxelder: s({ robe: ramp("#f4f0f8", { lo: "#6a5a7a" }), inner: PAL.orange, trim: PAL.orange, sash: PAL.red, hair: PAL.hairWhite, hairStyle: "long", female: true, eye: "#d06a10", foxEars: ramp("#f4f0f8"), tails: ramp("#ffffff", { lo: "#8a7aa0" }), hunch: 0.1, flare: 6, weapon: "whisk" }),
  foxguide: s({ robe: ramp("#e87a3a", { lo: "#5a1a20" }), inner: PAL.white, trim: PAL.white, sash: PAL.gold, hair: ramp("#f08a3a", { lo: "#8a2a3a" }), hairStyle: "twin", female: true, eye: "#d06a10", foxEars: ramp("#f08a3a"), tails: ramp("#f08a3a", { lo: "#8a2a40" }), scale: 0.9, hem: 4.2, flare: 4.4 }),
  foxfolkM: s({ robe: ramp("#8a5a3a", { lo: "#2a140a" }), inner: PAL.paper, trim: PAL.orange, sash: PAL.orange, hair: ramp("#c86a2a"), hairStyle: "short", eye: "#c06010", foxEars: ramp("#c86a2a"), tails: ramp("#c86a2a", { lo: "#5a2010" }), hem: 4.4, flare: 4.4 }),
  foxfolkF: s({ robe: ramp("#c8a0d8", { lo: "#3a2050" }), inner: PAL.white, trim: PAL.orange, sash: PAL.purple, hair: ramp("#e8a050"), hairStyle: "bun", female: true, eye: "#c06010", foxEars: ramp("#e8a050"), tails: ramp("#e8a050", { lo: "#6a3010" }), flare: 5 }),
  foxusurper: s({ robe: ramp("#3a2a5a", { lo: "#0a0418" }), inner: PAL.crimson, trim: ramp("#c8b0ff"), sash: PAL.crimson, hair: ramp("#2a1a3a"), hairStyle: "long", eye: "#b040ff", foxEars: ramp("#4a3a6a"), tails: ramp("#6a4a9a", { lo: "#10042a" }), glowEyes: "#d080ff", weapon: "fan", weaponRamp: PAL.crimson, scale: 1.18, flare: 6, cape: ramp("#2a1a4a", { lo: "#000008" }) }),
  merelder: s({ robe: ramp("#4ab0b8", { lo: "#0a2a3a" }), inner: PAL.white, trim: ramp("#f8e8f0"), sash: ramp("#f8c8d8"), skin: ramp("#d8ecec", { lo: "#4a7a8a", spread: 0.8 }), hair: ramp("#bfe8ff"), hairStyle: "long", female: true, eye: "#2a6a8a", fins: ramp("#8ad8e8", { lo: "#1a5a7a" }), weapon: "staff", weaponRamp: ramp("#f8e8f0"), hunch: 0.08, flare: 6.2 }),
  merguide: s({ robe: ramp("#3a8ad8", { lo: "#0a1a4a" }), inner: ramp("#e8fff8"), trim: ramp("#f8c8d8"), sash: ramp("#f8c8d8"), skin: ramp("#e0f0ee", { lo: "#4a7a8a", spread: 0.8 }), hair: ramp("#5ad8c8", { lo: "#0a4a5a" }), hairStyle: "wild", female: true, eye: "#1a5a7a", fins: ramp("#5ad8c8", { lo: "#0a4a5a" }), scale: 0.92, hem: 4, flare: 4.4 }),
  merfolkM: s({ robe: ramp("#2a6a8a", { lo: "#04142a" }), inner: PAL.white, trim: ramp("#e8f0f8"), sash: PAL.teal, skin: ramp("#d0e4e4", { lo: "#3a6a7a", spread: 0.8 }), hair: ramp("#2a5a7a"), hairStyle: "short", eye: "#1a4a6a", fins: ramp("#4ab0c8", { lo: "#0a3a5a" }), hem: 4.4, flare: 4.4, weapon: "spear", weaponRamp: ramp("#f8e8f0") }),
  merfolkF: s({ robe: ramp("#8ad8c8", { lo: "#0a3a3a" }), inner: PAL.white, trim: ramp("#f8c8d8"), sash: ramp("#f8a8c8"), skin: ramp("#e0f0ee", { lo: "#4a7a8a", spread: 0.8 }), hair: ramp("#e8f0ff"), hairStyle: "bun", female: true, eye: "#1a5a7a", fins: ramp("#a8e8f0", { lo: "#2a6a8a" }), flare: 5.4 }),
  merprince: s({ robe: ramp("#1a3a5a", { lo: "#000818" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.black, skin: ramp("#a8c8c8", { lo: "#2a4a5a", spread: 0.8 }), hair: ramp("#0a2a3a"), hairStyle: "wild", eye: "#0a3a5a", fins: ramp("#1a6a7a", { lo: "#00141a" }), glowEyes: "#5af0e0", weapon: "spear", weaponRamp: PAL.gold, hat: "crown", hatRamp: ramp("#f8e8f0"), scale: 1.2, flare: 5, cape: ramp("#0a4a5a", { lo: "#000810" }) }),
  stoneelder: s({ robe: ramp("#8a8478", { lo: "#24201a" }), inner: PAL.stone, trim: ramp("#c8a060"), sash: ramp("#c8a060"), skin: ramp("#b0aaa0", { lo: "#4a4440", spread: 0.7 }), hair: PAL.hairGrey, beard: ramp("#c8c0b0"), hairStyle: "bald", eye: "#e8a040", shards: ramp("#d8a0f0", { lo: "#4a2a6a" }), hunch: 0.14, scale: 1.12, flare: 6.4, hem: 3, weapon: "staff", weaponRamp: PAL.stone }),
  stoneguide: s({ robe: ramp("#a89a80", { lo: "#2a2418" }), inner: PAL.paper, trim: ramp("#a8e0ff"), sash: ramp("#a8e0ff"), skin: ramp("#c0b8ac", { lo: "#5a5048", spread: 0.7 }), hair: ramp("#8a8478"), hairStyle: "short", eye: "#3a8ac8", shards: ramp("#a8e0ff", { lo: "#2a4a7a" }), scale: 0.8, hem: 4.4, flare: 4 }),
  stonefolkM: s({ robe: ramp("#6a6058", { lo: "#141010" }), inner: PAL.stone, trim: PAL.brown, sash: PAL.brown, skin: ramp("#a8a094", { lo: "#4a4440", spread: 0.7 }), hair: PAL.hairGrey, hairStyle: "bald", eye: "#e8a040", shards: ramp("#f0c860", { lo: "#6a4a10" }), scale: 1.08, hem: 3.6, flare: 4.8 }),
  stonefolkF: s({ robe: ramp("#9a8a7a", { lo: "#241a14" }), inner: PAL.paper, trim: ramp("#d8a0f0"), sash: ramp("#d8a0f0"), skin: ramp("#b8b0a4", { lo: "#544c46", spread: 0.7 }), hair: ramp("#6a6460"), hairStyle: "bun", female: true, eye: "#c070e0", shards: ramp("#d8a0f0", { lo: "#4a2a6a" }), flare: 5.2 }),
  stoneking: s({ robe: ramp("#4a4038", { lo: "#0a0806" }), inner: PAL.orange, trim: PAL.gold, sash: PAL.black, skin: ramp("#7a7268", { lo: "#24201c", spread: 0.7 }), hair: PAL.hairGrey, hairStyle: "bald", glowEyes: "#ffb040", shards: ramp("#ff9040", { lo: "#5a1a0a" }), hat: "crown", hatRamp: PAL.stone, scale: 1.4, flare: 7, hem: 2.4 }),
  featherelder: s({ robe: ramp("#e8f0f8", { lo: "#5a6a80" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.navy, hair: PAL.hairWhite, beard: PAL.hairWhite, hairStyle: "topknot", eye: "#c88a20", wings: ramp("#f0f0f8", { lo: "#7a7a9a" }), hunch: 0.1, flare: 5.6, weapon: "fan", weaponRamp: PAL.white }),
  featherguide: s({ robe: ramp("#6ab0e8", { lo: "#0a2a5a" }), inner: PAL.white, trim: PAL.gold, sash: PAL.gold, hair: ramp("#3a4a7a"), hairStyle: "long", female: true, eye: "#c88a20", wings: ramp("#6a9ad8", { lo: "#1a2a5a" }), scale: 0.92, hem: 4.2, flare: 4.2 }),
  featherfolkM: s({ robe: ramp("#c8a060", { lo: "#3a2410" }), inner: PAL.white, trim: PAL.brown, sash: PAL.brown, hair: PAL.hairBrown, hairStyle: "wild", eye: "#c88a20", wings: ramp("#a87a4a", { lo: "#3a2010" }), hem: 4.4, flare: 4.4 }),
  featherfolkF: s({ robe: ramp("#f0d8e8", { lo: "#6a4a5a" }), inner: PAL.white, trim: PAL.rose, sash: PAL.rose, hair: ramp("#2a2a3a"), hairStyle: "bun", female: true, eye: "#c88a20", wings: ramp("#e8e8f0", { lo: "#6a6a80" }), flare: 5.2 }),
  stormlord: s({ robe: ramp("#3a3a5a", { lo: "#04040e" }), inner: ramp("#e8e0ff"), trim: ramp("#e8e0ff"), sash: PAL.purple, hair: ramp("#1a1a2a"), hairStyle: "wild", glowEyes: "#c8e0ff", wings: ramp("#2a2a4a", { lo: "#000004" }), weapon: "spear", weaponRamp: ramp("#e8e0ff"), scale: 1.22, flare: 5, cape: ramp("#4a4a7a", { lo: "#08081a" }) }),
  snowelder: s({ robe: ramp("#c8b8a0", { lo: "#4a3a2a" }), inner: PAL.red, trim: PAL.red, sash: PAL.red, skin: PAL.skinTan, hair: PAL.hairWhite, hairStyle: "long", female: true, eye: "#3a2a1a", horns: ramp("#e8dcc8", { lo: "#6a5a4a" }), hornStyle: "ram", shawl: ramp("#e8dcc8", { lo: "#6a5a4a" }), hunch: 0.12, flare: 6 }),
  snowguide: s({ robe: ramp("#8a6a4a", { lo: "#2a1a0a" }), inner: ramp("#e8dcc8"), trim: PAL.blue, sash: PAL.blue, skin: PAL.skinTan, hair: PAL.hairBlack, hairStyle: "twin", female: true, eye: "#3a2a1a", horns: ramp("#d8c8b0", { lo: "#5a4a3a" }), hornStyle: "ram", scale: 0.9, hem: 4.6, flare: 4.6, shoes: PAL.brown }),
  snowfolkM: s({ robe: ramp("#6a4a3a", { lo: "#1a0e08" }), inner: ramp("#e8dcc8"), trim: PAL.red, sash: PAL.red, skin: PAL.skinTan, hair: PAL.hairBrown, beard: PAL.hairBrown, hairStyle: "wild", eye: "#3a2a1a", horns: ramp("#c8b8a0", { lo: "#4a3a2a" }), hornStyle: "ram", scale: 1.06, hem: 4.6, flare: 5, shoes: PAL.brown, weapon: "spear", weaponRamp: PAL.wood }),
  snowfolkF: s({ robe: ramp("#4a6a9a", { lo: "#0a1a3a" }), inner: ramp("#e8dcc8"), trim: PAL.gold, sash: PAL.gold, skin: PAL.skinTan, hair: PAL.hairBlack, hairStyle: "bun", female: true, eye: "#3a2a1a", horns: ramp("#e8dcc8", { lo: "#6a5a4a" }), hornStyle: "ram", flare: 5.4, shawl: ramp("#e8dcc8", { lo: "#6a5a4a" }) }),
  whitehunger: s({ robe: ramp("#e8f0f8", { lo: "#4a5a7a" }), inner: PAL.black, trim: ramp("#a8c8ff"), sash: PAL.black, skin: ramp("#c8d8e8", { lo: "#3a4a6a", spread: 0.8 }), hair: PAL.hairWhite, hairStyle: "wild", glowEyes: "#a8e0ff", horns: ramp("#f0f0ff", { lo: "#5a6a8a" }), hornStyle: "ram", weapon: "staff", weaponRamp: ramp("#e8f6ff"), scale: 1.34, flare: 6.4, hem: 1.6, cape: ramp("#e8f6ff", { lo: "#4a5a7a" }) }),
  dragonelder: s({ robe: ramp("#a8302a", { lo: "#2a0408" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, skin: ramp("#f0d0b0", { lo: "#8a4a3a", spread: 0.8 }), hair: PAL.hairSilver, hairStyle: "long", female: true, eye: "#e8a020", horns: ramp("#f2e0a0", { lo: "#7a5a20" }), hornStyle: "dragon", weapon: "staff", weaponRamp: PAL.gold, hunch: 0.06, scale: 1.1, flare: 6.4 }),
  dragonguide: s({ robe: ramp("#2a8a6a", { lo: "#04201a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.red, skin: ramp("#f0d8b8", { lo: "#8a5a3a", spread: 0.8 }), hair: ramp("#1a5a4a"), hairStyle: "topknot", eye: "#e8a020", horns: ramp("#e8d8a0", { lo: "#6a5a20" }), hornStyle: "dragon", weapon: "jian", weaponRamp: PAL.gold, hem: 4, flare: 4.6 }),
  dragonfolkM: s({ robe: ramp("#7a3a2a", { lo: "#1a0806" }), inner: PAL.gold, trim: PAL.orange, sash: PAL.orange, skin: PAL.skinTan, hair: PAL.hairAuburn, hairStyle: "short", eye: "#e8a020", horns: ramp("#c8b080", { lo: "#4a3a1a" }), hornStyle: "dragon", scale: 1.06, hem: 4.2, flare: 4.6 }),
  dragonfolkF: s({ robe: ramp("#d8a040", { lo: "#4a2a08" }), inner: PAL.red, trim: PAL.red, sash: PAL.red, skin: ramp("#f0d0b0", { lo: "#8a4a3a", spread: 0.8 }), hair: PAL.hairBlack, hairStyle: "bun", female: true, eye: "#e8a020", horns: ramp("#f2e0a0", { lo: "#7a5a20" }), hornStyle: "dragon", flare: 5.4 }),
  dragonlord: s({ robe: ramp("#1a1a1a", { lo: "#000000" }), inner: PAL.orange, trim: PAL.gold, sash: PAL.crimson, skin: ramp("#c8a088", { lo: "#4a2018", spread: 0.8 }), hair: PAL.hairBlack, hairStyle: "wild", glowEyes: "#ffb040", horns: ramp("#3a3030", { lo: "#000000" }), hornStyle: "dragon", weapon: "saber", weaponRamp: PAL.gold, scale: 1.36, flare: 6.4, cape: ramp("#a8182e", { lo: "#2a0010" }) }),
} satisfies Record<string, HumanStyle>;

export type HumanId = keyof typeof STYLES;

/**
 * Attire: alternative outfits a character can wear, as overrides of their
 * style. Lin Yue collects hers over the story (see story/wardrobe.ts); the
 * folk of Willow Creek put on their festival best once the Heart is home.
 */
const FESTIVAL_SHAWL = ramp("#ffd27a", { lo: "#8a4a20" });
const tonesWhite = ramp("#ffffff", { lo: "#b4b0c8" });
/** Warm wool the folk wrap up in when the snow comes. */
const WOOL = ramp("#e8dcc8", { lo: "#6a5a4a" });
const WOOL_HOOD = ramp("#c8b8a0", { lo: "#4a3a2a" });
export const OUTFITS: Partial<Record<HumanId, Record<string, Partial<HumanStyle>>>> = {
  heroine: {
    wayfarer: { robe: ramp("#8a7a5a"), inner: PAL.paper, trim: PAL.teal, sash: PAL.teal, shoes: PAL.brown, hat: "straw", hatRamp: PAL.straw, shawl: undefined, cape: ramp("#4a6a5a", { lo: "#1a2a3a" }), hem: 3.4, flare: 4.6 },
    foxfire: { robe: ramp("#fbe6d6"), inner: PAL.orange, trim: PAL.orange, sash: PAL.red, shawl: ramp("#ffb070"), eye: "#c06a20" },
    cloudsilk: { robe: ramp("#e8ecf8", { lo: "#5a6a9a" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.navy, shoes: PAL.navy, hat: "veil", hatRamp: ramp("#e8f0ff"), shawl: ramp("#c8e0ff"), flare: 5.6 },
    mail: { robe: ramp("#4a4a5e", { lo: "#141428" }), inner: PAL.crimson, trim: PAL.steel, sash: PAL.crimson, shoes: PAL.black, shawl: undefined, cape: PAL.crimson, hem: 4.2, flare: 4.4 },
    festival: { robe: PAL.red, inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, shawl: FESTIVAL_SHAWL, shoes: PAL.red },
    seafarer: { robe: ramp("#2a5a8a", { lo: "#0a1a3a" }), inner: PAL.white, trim: PAL.gold, sash: PAL.red, shoes: PAL.brown, shawl: undefined, cape: ramp("#c8483a", { lo: "#3a0a1a" }), hat: "straw", hatRamp: ramp("#3a3a4a"), hem: 3.6, flare: 4.8 },
    phoenix: { robe: PAL.crimson, inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, shoes: PAL.red, shawl: undefined, cape: ramp("#f06a2a", { hi: "#ffe0a0", lo: "#5a0a10" }), flare: 5.4 },
    herbal: { robe: ramp("#e8f0d8", { lo: "#4a6a4a" }), inner: PAL.green, trim: PAL.green, sash: PAL.jade, shoes: PAL.brown, shawl: ramp("#9ad08a", { lo: "#2a4a2a" }), hat: "straw", hatRamp: PAL.straw, flare: 5 },
    swordsea: { robe: ramp("#3a5a8a", { lo: "#0a1a3a" }), inner: PAL.white, trim: PAL.steel, sash: PAL.white, shoes: PAL.navy, shawl: undefined, cape: ramp("#dfe8f4", { lo: "#3a4a6a" }), hem: 3.8, flare: 4.6 },
    celestial: { robe: PAL.white, inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, shoes: PAL.gold, hat: "crown", hatRamp: PAL.gold, shawl: ramp("#fff0a0", { lo: "#a87a30" }), flare: 6 },
    // the four wardens' gifts, and the year made whole
    springblossom: { robe: ramp("#ffe8f2", { lo: "#a85a8a" }), inner: PAL.green, trim: PAL.rose, sash: PAL.green, shoes: PAL.rose, shawl: ramp("#f8bcd6", { lo: "#a85a8a" }), hat: "veil", hatRamp: ramp("#fff0f6"), flare: 6 },
    summerlotus: { robe: ramp("#c8f0d8", { lo: "#2a6a4a" }), inner: PAL.white, trim: PAL.jade, sash: PAL.rose, shoes: PAL.jadeDeep, shawl: ramp("#f39bc0", { lo: "#8a3a7a" }), hat: "straw", hatRamp: PAL.straw, hem: 3.2, flare: 5 },
    autumnmaple: { robe: ramp("#c8502a", { lo: "#4a0a10" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.brown, shoes: PAL.brown, shawl: ramp("#ffd070", { lo: "#8a4a10" }), flare: 5.4 },
    wintersnow: { robe: ramp("#f0f4ff", { lo: "#5a6a9a" }), inner: PAL.navy, trim: PAL.steel, sash: PAL.navy, shoes: PAL.navy, shawl: undefined, cape: ramp("#ffffff", { lo: "#7a8aaa" }), hat: "hood", hatRamp: ramp("#ffffff", { lo: "#8a9ab8" }), hem: 3, flare: 5.2 },
    fourseasons: { robe: ramp("#fff6e0", { lo: "#8a6a4a" }), inner: PAL.rose, trim: PAL.jade, sash: PAL.orange, shoes: PAL.navy, shawl: ramp("#c8e0ff", { lo: "#3a4a7a" }), cape: ramp("#f08a3a", { lo: "#5a1a10" }), hat: "crown", hatRamp: PAL.jade, flare: 6 },
    // rewards of the notices
    ranger: { robe: ramp("#7a5a3a", { lo: "#2a1a10" }), inner: PAL.paper, trim: PAL.green, sash: PAL.green, shoes: PAL.brown, shawl: undefined, cape: ramp("#4a6a3a", { lo: "#14241a" }), hat: "straw", hatRamp: PAL.straw, hem: 4.4, flare: 4.2 },
    nightheron: { robe: ramp("#2a2a3e", { lo: "#08080e" }), inner: PAL.crimson, trim: PAL.steel, sash: PAL.crimson, shoes: PAL.black, shawl: undefined, cape: ramp("#1a1a2a", { lo: "#000000" }), hat: "hood", hatRamp: ramp("#2a2a3e"), hem: 4, flare: 4.4 },
    scholar: { robe: ramp("#8ab0d0"), inner: PAL.white, trim: PAL.navy, sash: PAL.navy, shoes: PAL.black, shawl: undefined, hat: "scholar", hatRamp: PAL.black, flare: 5.4 },
    moonrabbit: { robe: PAL.white, inner: ramp("#ffd0e4"), trim: ramp("#ffd0e4"), sash: PAL.gold, shoes: PAL.white, shawl: ramp("#e8e6f0"), foxEars: tonesWhite, flare: 5.8 },
    empress: { robe: ramp("#f0c040", { lo: "#7a3a10" }), inner: PAL.crimson, trim: PAL.crimson, sash: PAL.crimson, shoes: PAL.red, shawl: undefined, cape: PAL.crimson, hat: "crown", hatRamp: PAL.gold, flare: 6.4 },
    // where she began: a Willow Creek girl's homespun, or the robes of the Blood Moon's acolytes
    homespun: { robe: ramp("#6a7a9a", { lo: "#1a2a3a" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.red, shoes: PAL.brown, shawl: undefined, hem: 4.2, flare: 4.6 },
    acolyte: { robe: ramp("#6a1a24", { lo: "#1a0408" }), inner: PAL.black, trim: PAL.gold, sash: PAL.black, shoes: PAL.black, shawl: undefined, hat: "hood", hatRamp: ramp("#3a0a14", { lo: "#0a0004" }), hem: 3.4, flare: 4.8, eye: "#7a2a3a" },
    // what the main quest's choices make of her
    xuerobe: { robe: ramp("#c8d8e8", { lo: "#3a4a6a" }), inner: PAL.azure, trim: PAL.navy, sash: PAL.navy, shoes: PAL.navy, shawl: undefined, hem: 3.6, flare: 4.6 },
    lotusqueen: { robe: ramp("#f8e8f0", { lo: "#8a5a8a" }), inner: PAL.jade, trim: PAL.jade, sash: PAL.rose, shoes: PAL.jadeDeep, shawl: ramp("#9ff5de", { lo: "#2a7a6a" }), hat: "crown", hatRamp: PAL.jade, flare: 6.4 },
    bloodmoon: { robe: ramp("#8a0a1a", { lo: "#200006" }), inner: PAL.black, trim: PAL.gold, sash: PAL.black, shoes: PAL.black, shawl: undefined, cape: PAL.black, hat: "crown", hatRamp: PAL.black, hair: ramp("#e8e0e8", { lo: "#6a5a7a" }), glowEyes: "#ff2040", flare: 6 },
    guardian: { robe: ramp("#e8dcc0", { lo: "#6a5a3a" }), inner: PAL.jade, trim: PAL.gold, sash: PAL.jade, shoes: PAL.brown, shawl: undefined, cape: ramp("#5a8a6a", { lo: "#1a3a2a" }), hat: "veil", hatRamp: ramp("#f0fff8"), flare: 5.8 },
    teacher: { robe: ramp("#9a8a6a", { lo: "#3a2a1a" }), inner: PAL.paper, trim: PAL.navy, sash: PAL.navy, shoes: PAL.brown, shawl: undefined, hat: "scholar", hatRamp: PAL.black, weapon: "fan", weaponRamp: PAL.paper, flare: 5 },
    // and the shapes she may take: a fox spirit's, a dragon's
    foxform: { robe: ramp("#fbe6d6"), inner: PAL.gold, trim: PAL.gold, sash: PAL.orange, shoes: PAL.white, shawl: ramp("#ffd8a0"), hair: ramp("#f8f0e0", { lo: "#a08a6a" }), foxEars: ramp("#fff4e0", { lo: "#c08a3a" }), tails: ramp("#fff4e0", { lo: "#c08a3a" }), eye: "#e0a020" },
    dragonform: { robe: ramp("#1a5a6a", { lo: "#04141a" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, shoes: PAL.gold, shawl: undefined, cape: ramp("#9ff5de", { lo: "#1a5a6a" }), hat: "crown", hatRamp: PAL.jade, hair: ramp("#9ff5de", { hi: "#ffffff", lo: "#1a5a6a" }), glowEyes: "#ffe040", flare: 5.6 },
    // what the War of the Iron Banner makes of her
    lamellar: { robe: ramp("#a8382e", { lo: "#3a0a10" }), inner: PAL.steel, trim: PAL.steel, sash: PAL.black, shoes: PAL.black, shawl: undefined, cape: ramp("#d83a3a", { lo: "#4a0a10" }), hat: "helmet", hatRamp: ramp("#c8ccd8", { lo: "#2a2e3e" }), hem: 4.2, flare: 4.4 },
    bannergeneral: { robe: ramp("#2a2a3a", { lo: "#06060e" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.crimson, shoes: PAL.black, shawl: undefined, cape: ramp("#f0c040", { lo: "#7a3a10" }), hat: "helmet", hatRamp: ramp("#ffd060", { lo: "#5a2a00" }), hem: 4, flare: 4.8 },
    swordsaint: { robe: ramp("#f0f4ff", { lo: "#4a5a8a" }), inner: PAL.steel, trim: PAL.steel, sash: PAL.navy, shoes: PAL.navy, shawl: undefined, cape: ramp("#9ab8f0", { lo: "#1a2a5a" }), hat: "crown", hatRamp: PAL.steel, flare: 5 },
    bodhisattva: { robe: ramp("#fff8ec", { lo: "#8a7a6a" }), inner: PAL.jade, trim: PAL.gold, sash: PAL.jade, shoes: PAL.white, shawl: ramp("#c8f8e8", { lo: "#3a7a6a" }), hat: "veil", hatRamp: ramp("#fffaf0"), flare: 6.2 },
    taijisage: { robe: ramp("#f4f0e8", { lo: "#5a5a6a" }), inner: PAL.black, trim: PAL.black, sash: PAL.gold, shoes: PAL.black, shawl: ramp("#2a2a32", { lo: "#000000" }), hat: "crown", hatRamp: PAL.black, flare: 5.8 },
    asura: { robe: ramp("#3a0a12", { lo: "#0a0004" }), inner: PAL.crimson, trim: PAL.gold, sash: PAL.gold, shoes: PAL.black, shawl: undefined, cape: ramp("#a8182a", { lo: "#2a0008" }), hat: "helmet", hatRamp: ramp("#3a2a30", { lo: "#000000" }), glowEyes: "#ff3040", hem: 3.8, flare: 4.8 },
    pilgrim: { robe: ramp("#c8b890", { lo: "#4a3a20" }), inner: PAL.paper, trim: PAL.brown, sash: PAL.brown, shoes: PAL.brown, hat: "straw", hatRamp: PAL.straw, shawl: undefined, cape: ramp("#8a7a5a", { lo: "#2a2010" }), hem: 3.6, flare: 4.6 },
    daomantle: { robe: ramp("#2a3a4a", { lo: "#0a1018" }), inner: PAL.jade, trim: PAL.gold, sash: PAL.jade, shoes: PAL.black, shawl: undefined, cape: ramp("#e8e0c8", { lo: "#4a4030" }), hat: "crown", hatRamp: PAL.jade, flare: 5.4 },
    clearsnow: { robe: ramp("#ffffff", { lo: "#6a7a9a" }), inner: ramp("#bfe8ff"), trim: ramp("#9ff5de"), sash: ramp("#9ff5de"), shoes: PAL.white, hat: "veil", hatRamp: ramp("#f0f8ff"), shawl: ramp("#e8f6ff", { lo: "#5a7a9a" }), flare: 6, hem: 1.8 },
    hollowrobe: { robe: ramp("#e8e4f0", { lo: "#3a3450" }), inner: PAL.black, trim: ramp("#b8a8e8"), sash: PAL.black, shoes: PAL.black, shawl: undefined, cape: ramp("#2a2440", { lo: "#000000" }), glowEyes: "#e8e0ff", flare: 6 },
    outerrobe: { robe: ramp("#c8ccd4", { lo: "#4a4a5a" }), inner: PAL.azure, trim: PAL.azure, sash: PAL.navy, shoes: PAL.black, shawl: undefined, cape: undefined, hat: "none", flare: 4.8, hem: 3.8 },
    innerrobe: { robe: ramp("#2a4a8a", { lo: "#0a1430" }), inner: PAL.white, trim: ramp("#9ff5de"), sash: PAL.gold, shoes: PAL.black, shawl: ramp("#c8e8ff", { lo: "#3a5a8a" }), hat: "crown", hatRamp: PAL.jade, flare: 5.4 },
    tenhalls: { robe: ramp("#f4f0ff", { lo: "#5a5480" }), inner: ramp("#6ab8f0"), trim: ramp("#f2c55c"), sash: ramp("#b8a4ff"), shoes: PAL.white, shawl: ramp("#e8e0ff", { lo: "#4a4470" }), hat: "veil", hatRamp: ramp("#f8f4ff"), flare: 6, hem: 1.8 },
    climber: { robe: ramp("#3a5a9a", { lo: "#0a1a3a" }), inner: PAL.paper, trim: PAL.red, sash: PAL.straw, shoes: PAL.brown, hat: "straw", hatRamp: PAL.straw, flare: 4.4, hem: 4.2 },
    heavenstep: { robe: ramp("#fff8e8", { lo: "#6a5a3a" }), inner: ramp("#8a6a4a"), trim: PAL.gold, sash: ramp("#3a5a9a"), shoes: PAL.white, shawl: ramp("#f4e2a0", { lo: "#8a6a30" }), flare: 6.2, hem: 1.6 },
    stairthrone: { robe: ramp("#2a2018", { lo: "#000000" }), inner: PAL.gold, trim: PAL.gold, sash: PAL.crimson, shoes: PAL.black, hat: "crown", hatRamp: PAL.gold, cape: ramp("#f2c55c", { lo: "#5a3a10" }), flare: 6.6, hem: 1.4 },
  },
  zhou: { festival: { robe: PAL.red, inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, hatRamp: PAL.red } },
  hua: { festival: { robe: ramp("#c04a6a"), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold, shawl: FESTIVAL_SHAWL } },
  child: { festival: { robe: ramp("#f39bc0"), inner: PAL.white, trim: PAL.gold, sash: PAL.red, shawl: FESTIVAL_SHAWL } },
  farmer: { festival: { robe: ramp("#c8603a"), inner: PAL.gold, trim: PAL.gold, sash: PAL.red, hat: "none" } },
  weaver: { festival: { robe: ramp("#d84a4a"), inner: PAL.white, trim: PAL.gold, sash: PAL.gold, shawl: FESTIVAL_SHAWL } },
  villagerM: { festival: { robe: ramp("#c8483a"), inner: PAL.gold, trim: PAL.gold, sash: PAL.gold } },
  villagerF: { festival: { robe: ramp("#e86a8a"), inner: PAL.gold, trim: PAL.gold, sash: PAL.red, shawl: FESTIVAL_SHAWL } },
  boy: { festival: { robe: PAL.red, inner: PAL.gold, trim: PAL.gold, sash: PAL.gold } },
  // Elder Mo, his cultivation broken on the crimson path: grey mortal cloth, no crown, no whisk
  elder: { broken: { robe: ramp("#8a8a90", { lo: "#2a2a30" }), inner: PAL.paper, trim: PAL.paper, sash: PAL.brown, hat: "none", weapon: "none", hunch: 0.14 } },
  // Xue Ming come home: the crown and the blood-red eyes put away, an old outer-sect robe let out at the seams
  patriarch: { redeemed: { robe: ramp("#c8d8e8", { lo: "#3a4a6a" }), inner: PAL.azure, trim: PAL.navy, sash: PAL.navy, cape: undefined, hat: "none", glowEyes: undefined, eye: "#3a3a5a", weapon: "none", scale: 1.1 } },
};

/** A character's style in one of their outfits (their everyday clothes when it is unknown). */
export function styleOf(id: HumanId, outfit?: string): HumanStyle {
  const o = outfit ? (OUTFITS[id]?.[outfit] ?? (outfit === WINTER ? winterLook(id) : undefined)) : undefined;
  return o ? { ...STYLES[id], ...o } : STYLES[id];
}

/** The folk's winter clothes: anyone without their own wraps a wool shawl round them and pulls up a hood. */
export const WINTER = "winter";
function winterLook(id: HumanId): Partial<HumanStyle> | undefined {
  const st = STYLES[id];
  if (id === "heroine" || st.glowEyes || st.talisman || id === "ghost" || id === "dragon") return undefined;
  const bare = !st.hat || st.hat === "none" || st.hat === "straw";
  return { shawl: st.shawl ?? WOOL, ...(bare && !st.foxEars ? { hat: "hood" as const, hatRamp: WOOL_HOOD } : {}) };
}

/** Whether a character has a look of that name (their own outfits, or the folk's winter wool). */
export const hasOutfit = (id: HumanId, outfit: string) => !!OUTFITS[id]?.[outfit] || (outfit === WINTER && !!winterLook(id));
export type BeastId = "fox" | "wolf" | "serpent" | "serpentKing" | "crane" | "bat" | "horse" | "emberwyrm" | "stonehound" | "frostfang" | "rimewyrm" | "dunewyrm" | "pearlwyrm" | "shadowvixen";
/** Lin Yue on Cloudmane, her spirit horse. */
export type MountId = "rider";
export type CharId = HumanId | BeastId | MountId;

const HUMAN_ANIMS: Record<HumanId, AnimId[]> = {
  heroine: ["idle", "walk", "run", "talk", "attack", "cast", "hurt", "meditate", "fly", "victory", "defeat", "bow", "gather", "stretch", "look", "wave", "drink", "cheer", "point", "nod", "read", "sit", "pray", "clap", "laugh", "flute", "salute", "twirl", "write", "taichi", "kick", "umbrella", "eat", "torch", "kowtow", "sworddance", "flame", "sweep", "rake", "plant", "snowball", "kite", "shiver", "warmhands", "yawn", "stargaze", "offer", "think", "shrug", "cry", "levitate", "roar", "plantsword", "rally", "banner", "bandage", "grieve", "horn", "comprehend", "domain", "firecracker", "acrobat", "liondance", "xiangqi", "row", "spar", "tiptoe", "token", "scrub", "bucket", "pillow", "pant", "climb", "brew", "hammer", "carry", "sleep", "rummage", "shade", "beckon", "huddle", "chant", "rubbing", "castnet", "slingshot", "dig", "peer", "embrace", "holdup"],
  elder: ["idle", "walk", "talk", "cast", "sweep", "bow", "wave", "nod", "read", "salute", "write", "taichi", "sworddance", "offer", "think", "shrug", "cry", "plantsword", "attack", "hurt", "defeat"],
  qing: ["idle", "walk", "talk", "bow", "wave", "nod", "cheer", "clap", "pour", "salute"],
  abao: ["idle", "walk", "run", "talk", "practice", "wave", "cheer", "laugh", "clap", "juggle", "salute", "kick", "snowball", "kite", "yawn", "shiver", "cry", "shrug"],
  discipleM: ["idle", "walk", "practice", "bow", "nod", "clap", "salute", "taichi", "kick", "sworddance", "snowball", "stargaze", "yawn"],
  discipleF: ["idle", "walk", "practice", "bow", "wave", "clap", "salute", "taichi", "sworddance", "kite", "stargaze", "yawn", "umbrella"],
  zhou: ["idle", "walk", "talk", "wave", "nod", "point", "laugh", "fan", "lantern", "think", "shrug", "bow"],
  hua: ["idle", "walk", "talk", "wave", "drink", "nod", "pour", "laugh", "lantern", "cry", "think", "bow"],
  farmer: ["idle", "walk", "talk", "gather", "wave", "nod", "stretch", "laugh", "eat", "lantern", "hoe", "plant", "rake", "shiver", "warmhands", "umbrella", "bow", "xiangqi", "dig"],
  child: ["idle", "walk", "run", "talk", "wave", "dance", "cheer", "clap", "laugh", "juggle", "twirl", "lantern", "kick", "kite", "snowball", "shiver", "yawn", "cry", "shrug", "firecracker", "acrobat", "huddle"],
  huli: ["idle", "walk", "talk", "cast", "bow", "wave", "dance", "flute", "twirl", "offer", "think", "cry"],
  wen: ["idle", "talk", "fish", "cast", "wave", "sleep", "flute"],
  monk: ["idle", "walk", "talk", "sweep", "bow", "nod", "wave", "meditate", "pray", "eat", "taichi", "kowtow", "rake", "warmhands", "comprehend", "chant"],
  teawoman: ["idle", "walk", "talk", "wave", "drink", "nod", "bow", "pour", "laugh", "umbrella", "lantern", "yawn"],
  miller: ["idle", "walk", "talk", "gather", "wave", "nod", "point", "stretch", "laugh", "eat", "rake", "yawn", "umbrella", "bow"],
  hermit: ["idle", "talk", "meditate", "cast", "nod", "bow", "flute", "comprehend"],
  swordsman: ["idle", "walk", "talk", "practice", "sleep", "attack", "cast", "hurt", "defeat", "drink", "nod", "wave", "laugh", "flute", "salute"],
  bandit: ["idle", "walk", "run", "attack", "hurt", "point", "cheer", "eat"],
  peddler: ["idle", "walk", "talk", "wave", "look", "nod", "point", "laugh", "clap", "juggle", "eat", "carry", "umbrella", "yawn", "lantern", "hawk", "abacus"],
  archivist: ["idle", "walk", "talk", "read", "nod", "bow", "point"],
  storyteller: ["idle", "talk", "tell", "sit", "laugh", "clap", "nod", "drink", "fan", "shrug", "think", "puppet", "xiangqi"],
  weaver: ["idle", "walk", "talk", "weave", "nod", "wave", "laugh", "lantern", "twirl", "bow"],
  millhand: ["idle", "walk", "talk", "sweep", "wave", "cheer", "laugh", "eat"],
  lampkeeper: ["idle", "talk", "pray", "bow", "nod", "meditate"],
  scholar: ["idle", "talk", "read", "sit", "drink", "nod", "laugh", "clap", "fan", "write", "stargaze", "umbrella", "yawn", "xiangqi", "dig", "rubbing"],
  smith: ["idle", "walk", "talk", "hammer", "nod", "wave", "laugh", "drink", "salute", "mine", "think", "plantsword"],
  ghost: ["float", "talk", "write", "bow", "nod"],
  orchardist: ["idle", "walk", "talk", "gather", "wave", "nod", "laugh", "eat", "pour", "cheer", "rake", "plant", "umbrella", "bow"],
  villagerM: ["idle", "walk", "talk", "wave", "nod", "gather", "carry", "hoe", "chop", "eat", "laugh", "stretch", "lantern", "mine", "torch", "rake", "plant", "shiver", "warmhands", "yawn", "umbrella", "think", "shrug", "bow", "fish", "firecracker", "xiangqi", "hawk", "castnet", "dig"],
  villagerF: ["idle", "walk", "talk", "wave", "nod", "gather", "pour", "laugh", "carry", "umbrella", "dance", "clap", "lantern", "kowtow", "rake", "plant", "shiver", "warmhands", "yawn", "stargaze", "think", "shrug", "bow", "hawk", "firecracker", "embrace"],
  boy: ["idle", "walk", "run", "talk", "wave", "kick", "cheer", "laugh", "juggle", "clap", "kite", "snowball", "shiver", "yawn", "firecracker", "acrobat", "huddle", "slingshot"],
  woodcutter: ["idle", "walk", "talk", "chop", "carry", "wave", "nod", "stretch", "drink", "laugh", "rake", "warmhands", "shiver", "bow"],
  porter: ["idle", "walk", "talk", "carry", "wave", "nod", "stretch", "eat", "drink", "yawn", "warmhands", "umbrella", "bow"],
  lady: ["idle", "walk", "talk", "umbrella", "fan", "bow", "nod", "laugh", "twirl", "flute", "stargaze", "kite"],
  guard: ["idle", "walk", "talk", "salute", "practice", "nod", "point", "stretch", "yawn", "warmhands", "lantern", "shiver", "xiangqi"],
  fishwife: ["idle", "walk", "talk", "gather", "wave", "laugh", "point", "carry", "pour", "umbrella", "warmhands", "shiver", "bow", "hawk", "castnet", "embrace"],
  captain: ["idle", "walk", "talk", "point", "wave", "laugh", "drink", "nod", "look", "bow", "row"],
  abbot: ["idle", "talk", "taichi", "meditate", "pray", "bow", "nod", "cast", "comprehend", "chant"],
  novice: ["idle", "walk", "talk", "sweep", "kick", "bow", "pray", "laugh", "taichi", "snowball", "shiver", "warmhands", "chant"],
  nomad: ["idle", "walk", "talk", "wave", "point", "drink", "laugh", "flute", "look", "bow"],
  marshwitch: ["idle", "walk", "talk", "cast", "gather", "laugh", "nod", "pour", "brew"],
  teapicker: ["idle", "walk", "talk", "gather", "carry", "wave", "laugh", "dance", "cheer", "plant", "umbrella", "shiver", "bow"],
  teamaster: ["idle", "talk", "pour", "drink", "nod", "fan", "bow", "taichi"],
  cook: ["idle", "walk", "talk", "pour", "eat", "laugh", "nod", "wave", "warmhands", "yawn", "bow", "hawk"],
  taiji: ["idle", "walk", "talk", "taichi", "bow", "nod", "cast", "salute"],
  cultist: ["idle", "walk", "attack", "hurt"],
  jiangshi: ["idle", "hop", "attack", "hurt"],
  patriarch: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "offer", "cry", "plantsword", "roar", "sweep", "nod"],
  yanhuo: ["idle", "walk", "talk", "cast", "flame", "bow", "nod", "laugh", "salute", "point"],
  phoenix: ["idle", "walk", "talk", "practice", "flame", "salute", "attack", "hurt", "nod", "cheer", "torch"],
  miner: ["idle", "walk", "talk", "mine", "cower", "wave", "nod", "drink", "eat", "kowtow", "torch", "carry", "bow", "dig"],
  baizhi: ["idle", "walk", "talk", "brew", "gather", "nod", "bow", "pour", "cast"],
  herbalist: ["idle", "walk", "talk", "gather", "brew", "wave", "cheer", "laugh", "kowtow"],
  poisoner: ["idle", "walk", "talk", "attack", "hurt", "cast", "laugh", "kowtow", "brew", "cower"],
  lingfeng: ["idle", "walk", "talk", "sworddance", "practice", "salute", "nod", "bow", "cast"],
  swordsea: ["idle", "walk", "talk", "practice", "sworddance", "salute", "bow", "sweep", "attack", "hurt", "kowtow", "nod"],
  dragon: ["float", "talk", "cast", "nod", "bow"],
  almanac: ["idle", "walk", "talk", "read", "write", "nod", "point", "look", "fan", "stargaze", "yawn"],
  springWarden: ["float", "talk", "cast", "bow", "twirl", "nod"],
  summerWarden: ["float", "talk", "cast", "bow", "nod", "fan"],
  autumnWarden: ["float", "talk", "cast", "bow", "nod"],
  winterWarden: ["float", "talk", "cast", "bow", "nod"],
  general: ["idle", "walk", "talk", "point", "nod", "salute", "march", "spear", "banner", "horn", "rally", "think", "grieve", "shieldwall"],
  soldier: ["idle", "walk", "talk", "march", "spear", "salute", "nod", "shieldwall", "yawn", "warmhands", "grieve", "cheer"],
  medic: ["idle", "walk", "talk", "bandage", "nod", "bow", "brew", "pray", "grieve", "cry", "think"],
  drummer: ["idle", "walk", "talk", "drum", "cheer", "salute", "cry", "yawn", "shrug"],
  quartermaster: ["idle", "walk", "talk", "write", "read", "nod", "point", "fan", "shrug", "think"],
  refugeeM: ["idle", "walk", "talk", "cower", "grieve", "carry", "warmhands", "shiver", "nod", "kowtow", "cheer", "bow"],
  refugeeF: ["idle", "walk", "talk", "cower", "grieve", "cry", "pray", "carry", "warmhands", "kowtow", "cheer", "bow", "embrace"],
  scout: ["idle", "walk", "run", "talk", "look", "point", "salute", "nod", "practice", "stargaze"],
  deserter: ["idle", "walk", "talk", "kowtow", "grieve", "salute", "nod", "plantsword", "shrug", "think"],
  envoy: ["idle", "walk", "talk", "bow", "fan", "nod", "point", "laugh", "think"],
  widow: ["idle", "talk", "grieve", "pray", "cry", "bow", "nod", "offer"],
  raider: ["idle", "walk", "run", "attack", "hurt", "march", "spear", "cheer", "point"],
  ironguard: ["idle", "walk", "run", "attack", "hurt", "march", "shieldwall"],
  bannerman: ["idle", "walk", "run", "attack", "hurt", "march", "spear", "roar"],
  warcaptain: ["idle", "walk", "attack", "hurt", "defeat", "talk", "roar", "point", "kowtow", "horn"],
  ironmarshal: ["idle", "walk", "attack", "hurt", "defeat", "talk", "spear", "salute", "kowtow", "horn"],
  shaman: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "roar", "kowtow"],
  tuoba: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "roar", "kowtow", "plantsword", "horn", "point"],
  keeper: ["idle", "walk", "talk", "read", "nod", "bow", "point", "meditate", "write", "comprehend", "think", "laugh", "cast"],
  kongming: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "kowtow", "levitate", "domain", "think", "shrug", "cry", "bow"],
  hollow: ["idle", "walk", "attack", "cast", "hurt", "meditate"],
  hollowsage: ["idle", "walk", "attack", "cast", "hurt", "read"],
  echoWater: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoWood: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoWind: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoFire: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoEarth: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoMetal: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoThunder: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoIce: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  echoLife: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "levitate", "kowtow"],
  boatwoman: ["idle", "walk", "talk", "row", "wave", "nod", "laugh", "fish", "hawk", "bow", "umbrella", "carry"],
  liondancer: ["idle", "walk", "talk", "liondance", "drum", "cheer", "bow", "laugh", "acrobat", "wave"],
  acrobat: ["idle", "walk", "run", "talk", "acrobat", "juggle", "twirl", "bow", "cheer", "laugh", "wave", "kick"],
  merchant: ["idle", "walk", "talk", "abacus", "hawk", "nod", "bow", "laugh", "point", "fan", "think", "shrug"],
  wdherald: ["idle", "walk", "talk", "hawk", "bow", "point", "wave", "lecture"],
  yanshu: ["idle", "walk", "talk", "write", "read", "nod", "bow", "think", "point", "attack", "cast", "hurt", "defeat", "kowtow", "cry", "levitate"],
  steward: ["idle", "walk", "talk", "sweep", "nod", "point", "bucket", "yawn", "think", "shrug", "cry", "lecture"],
  fanyu: ["idle", "walk", "talk", "nod", "point", "read", "write", "salute", "bow", "spar", "abacus"],
  outerM: ["idle", "walk", "talk", "bow", "salute", "spar", "bucket", "scrub", "sweep", "carry", "read", "taichi", "tiptoe", "pant", "token", "attack", "hurt", "defeat", "pillow", "climb"],
  outerF: ["idle", "walk", "talk", "bow", "salute", "spar", "bucket", "scrub", "sweep", "carry", "read", "taichi", "tiptoe", "pant", "token", "pillow", "climb"],
  shenbai: ["idle", "walk", "talk", "sit", "hoe", "laugh", "pant", "bucket", "salute", "sleep", "eat", "cry", "nod", "pillow", "spar", "tiptoe", "climb"],
  yaozhi: ["idle", "walk", "talk", "read", "write", "fan", "laugh", "think", "shrug", "salute", "pillow", "spar", "token", "tiptoe"],
  tieniu: ["idle", "walk", "talk", "eat", "carry", "laugh", "salute", "cry", "sleep", "bucket", "pillow", "climb", "pant", "spar"],
  meilan: ["idle", "walk", "talk", "write", "read", "nod", "think", "cry", "token", "pillow", "tiptoe", "sleep"],
  qiu: ["idle", "walk", "run", "talk", "pillow", "cry", "laugh", "cheer", "kite", "salute", "tiptoe", "token", "sleep", "pant", "climb"],
  murong: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "spar", "salute", "bow", "laugh", "shrug", "think", "bucket", "kowtow"],
  hmwater: ["idle", "walk", "talk", "lecture", "pour", "nod", "bow", "meditate", "comprehend", "think"],
  hmwood: ["idle", "walk", "talk", "lecture", "plant", "rake", "nod", "bow", "point", "comprehend"],
  hmwind: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "lecture", "laugh", "twirl", "acrobat", "kite", "point", "levitate"],
  hmfire: ["idle", "walk", "talk", "lecture", "brew", "flame", "point", "nod", "laugh"],
  hmearth: ["idle", "walk", "talk", "lecture", "carry", "nod", "mine", "salute"],
  hmmetal: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "lecture", "hammer", "nod", "salute", "plantsword", "sworddance"],
  hmthunder: ["idle", "walk", "talk", "lecture", "salute", "nod", "point", "cast", "spear"],
  hmice: ["idle", "walk", "talk", "lecture", "read", "write", "nod", "think", "comprehend"],
  hmlife: ["idle", "walk", "talk", "lecture", "bandage", "brew", "pray", "nod", "cry"],
  ning: ["idle", "walk", "talk", "meditate", "levitate", "comprehend", "bow", "cry", "nod", "lecture"],
  blight: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "levitate"],
  furnacespirit: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "flame", "roar"],
  golem: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "roar"],
  enforcer: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "point", "salute"],
  frostwarden: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "levitate"],
  murongelder: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk", "kowtow", "fan", "laugh", "cry"],  ahlou: ["idle", "walk", "run", "talk", "carry", "bear", "bow", "wave", "laugh", "cry", "kneel", "beg", "embrace", "huddle", "cheer", "nod", "climb", "pant", "whisper"],
  wenqi: ["idle", "walk", "talk", "stamp", "read", "write", "nod", "bow", "think", "shrug", "whisper", "kneel", "point"],
  weigher: ["idle", "walk", "talk", "weigh", "stamp", "nod", "bow", "read", "think", "attack", "cast", "hurt", "defeat", "kowtow"],
  tierwarden: ["idle", "walk", "talk", "salute", "spear", "nod", "point", "march", "bow", "kneel", "yawn"],
  overseer: ["idle", "walk", "talk", "point", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "roar", "haggle"],
  debtsmith: ["idle", "walk", "talk", "hammer", "abacus", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "haggle"],
  inquisitor: ["idle", "walk", "talk", "read", "stamp", "point", "attack", "cast", "hurt", "defeat", "kowtow", "think"],
  matchmaker: ["idle", "walk", "talk", "fan", "laugh", "whisper", "haggle", "attack", "cast", "hurt", "defeat", "kowtow", "toast"],
  champion: ["idle", "walk", "talk", "practice", "roar", "salute", "attack", "cast", "hurt", "defeat", "kowtow", "toast", "laugh"],
  justiciar: ["idle", "walk", "talk", "read", "stamp", "decree", "point", "attack", "cast", "hurt", "defeat", "kowtow", "think"],
  yearelder: ["idle", "walk", "talk", "meditate", "levitate", "laugh", "toast", "attack", "cast", "hurt", "defeat", "kowtow", "cry"],
  starregistrar: ["idle", "walk", "talk", "stargaze", "read", "write", "fan", "attack", "cast", "hurt", "defeat", "kowtow", "levitate"],
  loufeng: ["idle", "walk", "talk", "salute", "spear", "march", "attack", "cast", "hurt", "defeat", "kowtow", "cry", "embrace", "kneel"],
  sovereign: ["idle", "walk", "talk", "decree", "levitate", "domain", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "point"],
  nobleM: ["idle", "walk", "talk", "fan", "toast", "lean", "whisper", "haggle", "nod", "bow", "laugh", "read", "xiangqi"],
  nobleF: ["idle", "walk", "talk", "fan", "toast", "lean", "whisper", "umbrella", "nod", "bow", "laugh", "twirl", "flute"],
  severed: ["idle", "walk", "talk", "salute", "practice", "sworddance", "attack", "cast", "hurt", "defeat", "kneel", "march"],
  bearer: ["idle", "walk", "talk", "bear", "carry", "bow", "kneel", "nod", "yawn", "pant", "wave"],
  tierherald: ["idle", "walk", "talk", "decree", "hawk", "bow", "point", "nod", "wave"],
  forger: ["idle", "walk", "talk", "write", "stamp", "whisper", "think", "nod", "bow", "cry", "kneel", "cower"],
  suwan: ["idle", "walk", "talk", "flute", "cry", "bow", "nod", "lean", "twirl", "embrace", "think", "kneel"],
  concordenvoy: ["idle", "walk", "talk", "nod", "bow", "read", "write", "point", "think", "offerpearl", "wave"],
  foxelder: ["idle", "walk", "talk", "nod", "bow", "pray", "think", "laugh", "cry", "moondance", "offerpearl"],
  foxguide: ["idle", "walk", "run", "talk", "nod", "bow", "wave", "laugh", "cheer", "cry", "point", "moondance", "offerpearl"],
  foxfolkM: ["idle", "walk", "talk", "nod", "bow", "wave", "moondance", "lantern", "pray"],
  foxfolkF: ["idle", "walk", "talk", "nod", "bow", "wave", "moondance", "pray", "fan"],
  foxusurper: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "roar", "moondance"],
  merelder: ["idle", "walk", "talk", "nod", "bow", "pray", "think", "laugh", "cry", "weep", "offerpearl"],
  merguide: ["idle", "walk", "run", "talk", "nod", "bow", "wave", "laugh", "cheer", "cry", "point", "weep", "offerpearl"],
  merfolkM: ["idle", "walk", "talk", "nod", "bow", "wave", "weep", "castnet", "fish"],
  merfolkF: ["idle", "walk", "talk", "nod", "bow", "wave", "weep", "fish", "flute"],
  merprince: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "roar", "weep"],
  stoneelder: ["idle", "walk", "talk", "nod", "bow", "pray", "think", "laugh", "cry", "carve", "offerpearl"],
  stoneguide: ["idle", "walk", "run", "talk", "nod", "bow", "wave", "laugh", "cheer", "cry", "point", "carve", "offerpearl"],
  stonefolkM: ["idle", "walk", "talk", "nod", "bow", "wave", "carve", "mine", "dig"],
  stonefolkF: ["idle", "walk", "talk", "nod", "bow", "wave", "carve", "dig", "hammer"],
  stoneking: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "roar", "carve"],
  featherelder: ["idle", "walk", "talk", "nod", "bow", "pray", "think", "laugh", "cry", "glide", "offerpearl"],
  featherguide: ["idle", "walk", "run", "talk", "nod", "bow", "wave", "laugh", "cheer", "cry", "point", "glide", "offerpearl"],
  featherfolkM: ["idle", "walk", "talk", "nod", "bow", "wave", "glide", "stargaze", "kite"],
  featherfolkF: ["idle", "walk", "talk", "nod", "bow", "wave", "glide", "kite", "flute"],
  stormlord: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "roar", "glide"],
  snowelder: ["idle", "walk", "talk", "nod", "bow", "pray", "think", "laugh", "cry", "knot", "hearthsong"],
  snowguide: ["idle", "walk", "run", "talk", "nod", "bow", "wave", "laugh", "cheer", "cry", "point", "knot", "hearthsong"],
  snowfolkM: ["idle", "walk", "talk", "nod", "bow", "wave", "knot", "carry", "chop"],
  snowfolkF: ["idle", "walk", "talk", "nod", "bow", "wave", "knot", "chop", "warmhands"],
  whitehunger: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "roar", "knot"],
  dragonelder: ["idle", "walk", "talk", "nod", "bow", "pray", "think", "laugh", "cry", "firebreath", "offerpearl"],
  dragonguide: ["idle", "walk", "run", "talk", "nod", "bow", "wave", "laugh", "cheer", "cry", "point", "firebreath", "offerpearl"],
  dragonfolkM: ["idle", "walk", "talk", "nod", "bow", "wave", "firebreath", "read", "hammer"],
  dragonfolkF: ["idle", "walk", "talk", "nod", "bow", "wave", "firebreath", "hammer", "sworddance"],
  dragonlord: ["idle", "walk", "talk", "attack", "cast", "hurt", "defeat", "kowtow", "laugh", "roar", "firebreath"],
};

/** Whether a character has an animation of its own. */
export const hasAnim = (id: HumanId, anim: AnimId) => HUMAN_ANIMS[id].includes(anim);

// the jianghu's new manners: mortals kneel to a cultivator far above them, gossip behind a hand, haggle and raise a cup
const MORE: [AnimId, HumanId[]][] = [
  ["kneel", ["heroine", "villagerM", "villagerF", "farmer", "porter", "fishwife", "cook", "peddler", "refugeeM", "refugeeF", "miner", "teapicker", "orchardist", "woodcutter", "merchant", "teawoman", "miller", "millhand", "weaver", "boatwoman", "herbalist", "guard", "lady", "scholar", "storyteller", "nomad"]],
  ["whisper", ["heroine", "villagerM", "villagerF", "lady", "merchant", "cook", "teawoman", "fishwife", "peddler", "scholar", "storyteller", "guard", "porter"]],
  ["haggle", ["heroine", "merchant", "peddler", "villagerF", "villagerM", "cook", "fishwife", "teawoman", "nomad"]],
  ["toast", ["heroine", "swordsman", "scholar", "merchant", "villagerM", "captain", "nomad", "storyteller", "lady", "cook"]],
  ["lean", ["heroine", "lady", "scholar", "villagerF", "teawoman"]],
  ["weigh", ["heroine", "merchant", "peddler", "herbalist"]],
  ["stamp", ["quartermaster", "scholar", "archivist", "guard"]],
  ["beg", ["refugeeM", "refugeeF"]],
  ["decree", ["wdherald", "envoy"]],
  ["bear", ["porter", "villagerM", "soldier"]],
  // the peoples' manners, which she learns among them
  ["moondance", ["heroine", "huli"]],
  ["glide", ["heroine"]],
  ["weep", ["heroine", "villagerF", "refugeeF"]],
  ["offerpearl", ["heroine"]],
  ["hearthsong", ["heroine", "nomad"]],
  ["knot", ["nomad"]],
  ["carve", ["heroine", "smith", "miner"]],
];
for (const [anim, ids] of MORE) for (const id of ids) if (!HUMAN_ANIMS[id].includes(anim)) HUMAN_ANIMS[id].push(anim);

// folk who stand about to ask favours wave her over (anyone who can already wave can beckon)
for (const id of Object.keys(HUMAN_ANIMS) as HumanId[]) if (id !== "heroine" && HUMAN_ANIMS[id].includes("wave") && !HUMAN_ANIMS[id].includes("beckon")) HUMAN_ANIMS[id].push("beckon");

const NAMES: Record<CharId, [string, string]> = {
  heroine: ["Lin Yue", "Jade Lotus Disciple"],
  elder: ["Elder Mo", "Hall Master of the Azure Cloud Sect"],
  qing: ["Senior Sister Qing", "Alchemy Hall Disciple"],
  abao: ["Ah Bao", "Outer-sect Junior"],
  discipleM: ["Disciple Feng", "Sword Practice Yard"],
  discipleF: ["Disciple Lan", "Sword Practice Yard"],
  zhou: ["Village Head Zhou", "Willow Creek"],
  hua: ["Granny Hua", "Herbalist of Willow Creek"],
  farmer: ["Farmer Liu", "Rice Paddies"],
  child: ["Little Mei", "Willow Creek"],
  huli: ["Hu Li", "Three-tailed Fox Maiden"],
  wen: ["Old Fisher Wen", "Hermit of the Lotus Lake"],
  peddler: ["Peddler Bai", "Wandering Merchant of the Highway"],
  monk: ["Monk Kong", "Keeper of the Ruined Temple"],
  teawoman: ["Auntie Fang", "Crossroads Teahouse"],
  miller: ["Miller Tang", "Watermill on the Creek"],
  hermit: ["Master Yun", "Hermit of the Cloudstep Isles"],
  archivist: ["Archivist Shen", "Keeper of the Hall of Scrolls"],
  storyteller: ["Storyteller Qiao", "Teller of Old Tales"],
  weaver: ["Weaver Lü", "Granny Hua's Daughter-in-law"],
  millhand: ["Little Dou", "Miller Tang's Apprentice"],
  lampkeeper: ["Sister Ming", "Keeper of the Seven Lamps"],
  scholar: ["Scholar Gu", "Examination Candidate"],
  smith: ["Smith Ou", "Keeper of the Sword Tomb"],
  ghost: ["Scholar Pei", "A Restless Shade"],
  orchardist: ["Auntie Rong", "Keeper of the Peach Orchard"],
  swordsman: ["Xiao Han", "Wandering Swordsman"],
  bandit: ["Mountain Bandit", "Highland Outlaw"],
  cultist: ["Blood Moon Cultist", "Demonic Sect Acolyte"],
  jiangshi: ["Jiangshi", "Hopping Corpse"],
  villagerM: ["Villager", "Folk of the Jianghu"],
  villagerF: ["Villager", "Folk of the Jianghu"],
  boy: ["Little Shun", "Willow Creek"],
  woodcutter: ["Woodcutter Ba", "Willow Creek Woodlot"],
  porter: ["Porter Niu", "Carrier of the Roads"],
  lady: ["Lady Su", "A Traveller from the Capital"],
  guard: ["Gate Guard", "Watchman"],
  fishwife: ["Fishwife Ah Lan", "Wavecrest Harbour"],
  captain: ["Captain Hai", "Master of the Junk Sea-Swallow"],
  abbot: ["Abbot Xuan", "Frostveil Monastery"],
  novice: ["Novice Tuo", "Frostveil Monastery"],
  nomad: ["Batu", "Rider of the Yellow Sands"],
  marshwitch: ["Granny Ye", "Wise Woman of the Mistmarsh"],
  teapicker: ["Picker Cui", "Cloudmist Tea Terraces"],
  teamaster: ["Tea Master Lu", "Cloudmist Tea Terraces"],
  cook: ["Cook Pang", "Kitchens of the Azure Cloud"],
  taiji: ["Elder Qiu", "Master of the Taiji Yard"],
  patriarch: ["Patriarch Xue", "Lord of the Blood Moon Sect"],
  yanhuo: ["Yan Huo", "Sect Mistress of the Scarlet Phoenix"],
  phoenix: ["Phoenix Disciple", "Scarlet Phoenix Sect"],
  miner: ["Old Tie", "Foreman of the Ember Mine"],
  baizhi: ["Bai Zhi", "Valley Master of Hundred Herbs"],
  herbalist: ["Ling'er", "Apprentice of Hundred Herb Valley"],
  poisoner: ["Ku Shen", "An Expelled Herbalist"],
  lingfeng: ["Ling Feng", "Master of the Sword Sea Pavilion"],
  swordsea: ["Sword Sea Disciple", "Sword Sea Pavilion"],
  dragon: ["Old Long", "Spirit of the Dragon Vein"],
  almanac: ["Almanac Master Shi", "Keeper of the Calendar"],
  springWarden: ["Lady Qingming", "Warden of Spring"],
  summerWarden: ["Lord Xiazhi", "Warden of Summer"],
  autumnWarden: ["Grandmother Shuangjiang", "Warden of Autumn"],
  winterWarden: ["Old Dongzhi", "Warden of Winter"],
  general: ["General Yue Wushuang", "Commander of the Northern Army"],
  soldier: ["Imperial Spearman", "Northern Army"],
  medic: ["Field Medic Su Lan", "Northern Army Infirmary"],
  drummer: ["Drummer Tian", "Northern Army"],
  quartermaster: ["Quartermaster Bao", "Northern Army Stores"],
  refugeeM: ["Refugee", "Driven from Home by the War"],
  refugeeF: ["Refugee", "Driven from Home by the War"],
  scout: ["Scout Feiyan", "Eyes of the Northern Army"],
  deserter: ["Ashina", "Who Rode with the Iron Wolves"],
  envoy: ["Envoy Kou", "Voice of the Iron Banner"],
  widow: ["Lady Gu", "Widow of the Frontier"],
  raider: ["Iron Wolf Raider", "The Iron Banner Horde"],
  ironguard: ["Iron Banner Guard", "The Iron Banner Horde"],
  bannerman: ["Black Banner Reaver", "The Iron Banner Horde"],
  warcaptain: ["Iron Wolf Captain", "The Iron Banner Horde"],
  ironmarshal: ["Iron Marshal", "The Iron Banner Horde"],
  shaman: ["Blood Banner Shaman", "The Iron Banner Horde"],
  tuoba: ["Tuoba Hong", "Khan of the Iron Banner"],
  keeper: ["Daoist Qingxu", "Keeper of the Founder's Steles"],
  kongming: ["Wei Kongming", "The Dao-Eater"],
  hollow: ["Hollow Shade", "Follower of the Dao-Eater"],
  hollowsage: ["Hollow Sage", "Follower of the Dao-Eater"],
  echoWater: ["Echo of Still Water", "A Hollowed Dao"],
  echoWood: ["Echo of the Withered Grove", "A Hollowed Dao"],
  echoWind: ["Echo of the Stopped Wind", "A Hollowed Dao"],
  echoFire: ["Echo of the Cold Flame", "A Hollowed Dao"],
  echoEarth: ["Echo of the Hollow Mountain", "A Hollowed Dao"],
  echoMetal: ["Echo of the Blunted Edge", "A Hollowed Dao"],
  echoThunder: ["Echo of the Silent Storm", "A Hollowed Dao"],
  echoIce: ["Echo of the Endless Winter", "A Hollowed Dao"],
  echoLife: ["Echo of the Unending", "A Hollowed Dao"],
  boatwoman: ["Boatwoman", "Folk of Hailing's Canals"],
  liondancer: ["Lion Dancer", "Hailing's Dragon-and-Lion Troupe"],
  acrobat: ["Acrobat", "Street Performer of Hailing"],
  merchant: ["Merchant", "Moneychanger of the Port"],
  wdherald: ["Herald of the Ten Halls", "The Sect of Ten Thousand Daos"],
  yanshu: ["Yan Shu", "Examiner of the Ten Halls"],
  steward: ["Steward Gou", "Keeper of the Outer Court"],
  fanyu: ["Fan Yu", "Senior Sister of the Mission Hall"],
  outerM: ["Outer Disciple", "The Ten Halls"],
  outerF: ["Outer Disciple", "The Ten Halls"],
  shenbai: ["Shen Bai", "Room Seven"],
  yaozhi: ["Yao Zhi", "Room Seven"],
  tieniu: ["Tie Niu", "Room Seven"],
  meilan: ["Mei Lan", "Room Seven"],
  qiu: ["Little Qiu", "Room Seven"],
  murong: ["Murong Xiao", "Young Master of the Murong Clan"],
  hmwater: ["Lan Yi", "Master of the Hall of Still Water"],
  hmwood: ["Gu Song", "Master of the Hall of the Old Pine"],
  hmwind: ["Feng Qi", "Master of the Hall With No Walls"],
  hmfire: ["Zhu Yan", "Master of the Hall of the Red Furnace"],
  hmearth: ["Hou Tu", "Master of the Hall of Bearing"],
  hmmetal: ["Jin Ge", "Master of the Hall of the Edge"],
  hmthunder: ["Lei Ting", "Master of the Hall of Discipline"],
  hmice: ["Han Shuang", "Keeper of the Library of Frozen Words"],
  hmlife: ["Wen Ru", "Keeper of the Ward of Long Sleep"],
  ning: ["Ning Wuhen", "Master of the Hall of the Void"],
  blight: ["Blighted Wisteria", "A Tree Spirit Drunk Dry"],
  furnacespirit: ["Furnace Spirit", "The Great Furnace of the Red Hall"],
  golem: ["Tunnel Warden", "Guardian of the Founder's Cellars"],
  enforcer: ["Captain Kui", "Enforcer of the Ten Halls"],
  frostwarden: ["Frost Warden", "Guardian of the Frozen Words"],
  murongelder: ["Murong Hong", "Uncle of the Murong Clan"],
  ahlou: ["Ah Lou", "Porter of the Mud Tier"],
  wenqi: ["Registrar Wen Qi", "Registry of Heaven's Stair"],
  weigher: ["Weigher Bai Gu", "Master of the Weighing Hall"],
  tierwarden: ["Tier Warden", "Guard of the Stair"],
  overseer: ["Overseer Kuang", "Warden of the Mud Tier"],
  debtsmith: ["Guildmaster Tong", "The Copper Guild"],
  inquisitor: ["Inquisitor Sima", "Examiner of Tablets"],
  matchmaker: ["Madam Qiao", "The Red Thread House"],
  champion: ["Lei Ba", "Champion of the Golden Tier"],
  justiciar: ["Justiciar Yan Heng", "Tribunal of Realms"],
  yearelder: ["Elder Mei Shou", "The Cloud Tier"],
  starregistrar: ["Star-Registrar Qu Xing", "The Star Registry"],
  loufeng: ["Lou Feng", "Captain of the Ninth Gate"],
  sovereign: ["Gao Qiong", "Sovereign of the Stair"],
  nobleM: ["Young Lord", "The Upper Tiers"],
  nobleF: ["Lady of the Tiers", "The Upper Tiers"],
  severed: ["Severed Guard", "The Thunder Tier"],
  bearer: ["Sedan Bearer", "The Stair Road"],
  tierherald: ["Herald of the Stair", "City of Nine Tiers"],
  forger: ["Faceless Liu", "Forger of Tablets"],
  suwan: ["Su Wan", "Daughter of the Jade Tier"],
  concordenvoy: ["Envoy Shan", "The Concord of a Hundred Peoples"],
  foxelder: ["Grandmother Su Yao", "Matriarch of Moonfox Hollow"],
  foxguide: ["Bai Ling", "Fox-Folk of Moonfox Hollow"],
  foxfolkM: ["Fox-Folk", "Moonfox Hollow"],
  foxfolkF: ["Fox-Folk", "Moonfox Hollow"],
  foxusurper: ["Hu Yan", "The Moon-Eater"],
  merelder: ["Tide-Mother Lan Xi", "Pearlsong Reef"],
  merguide: ["Hai Yin", "Merfolk of Pearlsong Reef"],
  merfolkM: ["Merfolk", "Pearlsong Reef"],
  merfolkF: ["Merfolk", "Pearlsong Reef"],
  merprince: ["Chen Yuan", "The Drowned Prince"],
  stoneelder: ["Old Granite Lei Gu", "Elder of Hollowstone Hold"],
  stoneguide: ["Pebble", "Stone-Born of Hollowstone Hold"],
  stonefolkM: ["Stone-Born", "Hollowstone Hold"],
  stonefolkF: ["Stone-Born", "Hollowstone Hold"],
  stoneking: ["Kuang Yan", "The Hollow King"],
  featherelder: ["Wind-Speaker Qing Yu", "Skyfeather Eyrie"],
  featherguide: ["Fei Yan", "Feathered Folk of Skyfeather Eyrie"],
  featherfolkM: ["Feathered Folk", "Skyfeather Eyrie"],
  featherfolkF: ["Feathered Folk", "Skyfeather Eyrie"],
  stormlord: ["Lie Feng", "Lord of the Storm"],
  snowelder: ["Hearth-Keeper Aru", "Rimehorn Lodge"],
  snowguide: ["Tuya", "Snow-Folk of Rimehorn Lodge"],
  snowfolkM: ["Snow-Folk", "Rimehorn Lodge"],
  snowfolkF: ["Snow-Folk", "Rimehorn Lodge"],
  whitehunger: ["Kar", "The White Hunger"],
  dragonelder: ["Matriarch Ao Rong", "Emberscale Hold"],
  dragonguide: ["Ao Xun", "Dragon-Kin of Emberscale Hold"],
  dragonfolkM: ["Dragon-Kin", "Emberscale Hold"],
  dragonfolkF: ["Dragon-Kin", "Emberscale Hold"],
  dragonlord: ["Ao Kuang", "The Unbound"],
  fox: ["Fox Spirit", "Corrupted Beast"],
  wolf: ["Shadowflame Wolf", "Corrupted Beast"],
  serpent: ["Jade Serpent", "Lake Beast"],
  serpentKing: ["Serpent King", "Ancient Lake Guardian"],
  crane: ["Spirit Crane", "Messenger of the Sect"],
  bat: ["Blood Bat", "Valley Vermin"],
  horse: ["Wild Horse", "Highland Herd"],
  emberwyrm: ["Ember Wyrm", "Fire in the Vein"],
  stonehound: ["Stone Hound", "Guardian of the Dragon Vein"],
  frostfang: ["Frostfang Wolf", "Hunter of the Icesoul Hollow"],
  rimewyrm: ["Rime Wyrm", "Coiled Round the First Abbot"],
  dunewyrm: ["Dune Wyrm", "Guardian of the Buried Queen"],
  pearlwyrm: ["Pearl Serpent", "Hoarder of the Tidevoice Cave"],
  shadowvixen: ["Shadow Vixen", "The Blood Moon's Last Fox"],
  rider: ["Lin Yue", "Riding Cloudmane"],
};

const BEAST_ANIMS: Record<BeastId, AnimId[]> = {
  fox: ["idle", "walk", "run", "attack", "hurt", "sniff", "sleep"],
  wolf: ["idle", "walk", "run", "attack", "hurt", "howl", "sniff", "sleep"],
  serpent: ["idle", "walk", "attack", "hurt"],
  serpentKing: ["idle", "walk", "attack", "hurt"],
  crane: ["idle", "fly", "peck"],
  bat: ["fly"],
  horse: ["idle", "walk", "run", "graze", "rear"],
  emberwyrm: ["idle", "walk", "attack", "hurt"],
  stonehound: ["idle", "walk", "run", "attack", "hurt", "howl", "sniff", "sleep"],
  frostfang: ["idle", "walk", "run", "attack", "hurt", "howl", "sniff", "sleep"],
  rimewyrm: ["idle", "walk", "attack", "hurt"],
  dunewyrm: ["idle", "walk", "attack", "hurt"],
  pearlwyrm: ["idle", "walk", "attack", "hurt"],
  shadowvixen: ["idle", "walk", "run", "attack", "hurt", "sniff", "sleep"],
};
const RIDER_ANIMS: AnimId[] = ["idle", "walk", "run", "rear"];

export const HUMAN_IDS = Object.keys(STYLES) as HumanId[];
export const BEAST_IDS = Object.keys(BEAST_ANIMS) as BeastId[];
export const CHAR_IDS: CharId[] = [...HUMAN_IDS, ...BEAST_IDS, "rider"];

const isHuman = (id: CharId): id is HumanId => id in STYLES;
/** Rank-and-file foes, who never speak in a dialogue box. */
const FACELESS = new Set<string>(["jiangshi", "cultist", "bandit", "raider", "ironguard", "bannerman", "hollow", "hollowsage", "inquisitor", "severed"]);

export function charDef(id: CharId): CharacterDef {
  const [name, title] = NAMES[id];
  if (isHuman(id)) {
    const S = STYLES[id].scale ?? 1;
    const big = S > 1.05;
    return {
      id,
      name,
      title,
      w: big ? Math.round(HUMAN_W * S) : HUMAN_W,
      h: big ? Math.round(HUMAN_H * S) : HUMAN_H,
      ox: big ? Math.round(HUMAN_OX * S) : HUMAN_OX,
      oy: big ? Math.round(HUMAN_OY * S) : HUMAN_OY,
      anims: HUMAN_ANIMS[id],
      portrait: !FACELESS.has(id),
    };
  }
  if (id === "bat") return { id, name, title, w: 40, h: 32, ox: 20, oy: 26, anims: BEAST_ANIMS[id], portrait: false };
  if (id === "rider") return { id, name, title, w: RIDER_W, h: RIDER_H, ox: RIDER_OX, oy: RIDER_OY, anims: RIDER_ANIMS, portrait: false };
  if (id === "horse") return { id, name, title, w: HORSE_W, h: HORSE_H, ox: HORSE_OX, oy: HORSE_OY, anims: BEAST_ANIMS[id], portrait: false };
  return { id, name, title, w: BEAST_W, h: BEAST_H, ox: BEAST_OX, oy: BEAST_OY, anims: BEAST_ANIMS[id], portrait: false };
}

function paintFrame(id: CharId, anim: AnimId, i: number, dir: number, outfit?: string): PixelBuffer {
  let a = dirAngle(dir);
  if (isHuman(id)) {
    const spec = human[anim] ?? human.idle!;
    const st = styleOf(id, outfit);
    const pose = spec.pose(i, spec.n);
    // a twirl turns her once round on the spot, ending where she started
    if (anim === "twirl") a += (i / spec.n) * TAU;
    const def = charDef(id);
    // non-sword users keep the default resting hands for sword poses
    if (anim === "attack" && st.weapon !== "jian" && st.weapon !== "saber") pose.handR = pose.handR ?? REST_HAND_R;
    if (anim === "attack" || anim === "practice" || anim === "sworddance") pose.sword = "hand";
    if (id === "jiangshi" && anim !== "hop") {
      pose.handL = [-2.6, 8.4, 17.6];
      pose.handR = [2.6, 8.4, 17.6];
      pose.eyes = anim === "hurt" ? "hurt" : "closed";
    }
    if (pose.handL === undefined) pose.handL = REST_HAND_L;
    return paintHuman(st, pose, a, { w: def.w, h: def.h, ox: def.ox, oy: def.oy });
  }
  if (id === "rider" || id === "horse") {
    const spec = horse[anim] ?? horse.idle!;
    const hp = spec.pose(i, spec.n);
    if (id === "horse") return paintHorse(WILD_HORSE, hp, a);
    return paintRider(styleOf("heroine", outfit), CLOUDMANE, hp, (ridden[anim] ?? ridden.idle!)(i, spec.n), a);
  }
  const spec = beast[anim] ?? beast.idle!;
  const pose = spec.pose(i, spec.n);
  switch (id) {
    case "fox":
      return paintQuad(FOX_STYLE, pose, a);
    case "wolf":
      return paintQuad(WOLF_STYLE, pose, a);
    case "serpent":
    case "serpentKing":
      return paintSerpent({ ...pose, lunge: pose.lunge, stride: undefined }, a, id === "serpentKing");
    case "emberwyrm":
      return paintSerpent({ ...pose, lunge: pose.lunge, stride: undefined }, a, true, EMBER_WYRM);
    case "stonehound":
      return paintQuad(STONEHOUND_STYLE, pose, a);
    case "frostfang":
      return paintQuad(FROSTFANG_STYLE, pose, a);
    case "shadowvixen":
      return paintQuad(SHADOW_VIXEN_STYLE, pose, a);
    case "rimewyrm":
      return paintSerpent({ ...pose, lunge: pose.lunge, stride: undefined }, a, true, RIME_WYRM);
    case "dunewyrm":
      return paintSerpent({ ...pose, lunge: pose.lunge, stride: undefined }, a, true, DUNE_WYRM);
    case "pearlwyrm":
      return paintSerpent({ ...pose, lunge: pose.lunge, stride: undefined }, a, false, PEARL_WYRM);
    case "crane":
      return paintCrane(anim === "fly" ? pose : { t: pose.t, head: pose.head }, a);
    case "bat":
      return paintBat(beast.fly!.pose(i, 6), a);
  }
}

const cache = new Map<string, Anim>();

/** Lazily painted animation for a character in one of 16 directions (and, for people, one of their outfits). */
export function getAnim(id: CharId, anim: AnimId, dir: number, outfit?: string): Anim {
  const def = charDef(id);
  const real: AnimId = def.anims.includes(anim) ? anim : anim === "walk" && def.anims.includes("hop") ? "hop" : anim === "walk" && def.anims.includes("fly") ? "fly" : def.anims[0];
  const d = ((dir % DIRS) + DIRS) % DIRS;
  const dress = outfit && (id === "rider" ? OUTFITS.heroine?.[outfit] : isHuman(id) && hasOutfit(id, outfit)) ? outfit : "";
  const key = `${id}/${real}/${d}/${dress}`;
  let a = cache.get(key);
  if (!a) {
    const spec = (isHuman(id) ? human[real] : id === "rider" || id === "horse" ? horse[real] : beast[real]) ?? (isHuman(id) ? human.idle! : beast.idle!);
    const n = id === "bat" ? 6 : spec.n;
    a = { fps: spec.fps, loop: spec.loop, frames: Array.from({ length: n }, (_, i) => paintFrame(id, real, i, d, dress || undefined)) };
    cache.set(key, a);
  }
  return a;
}

export function frameAt(anim: Anim, seconds: number): PixelBuffer {
  const i = Math.floor(seconds * anim.fps);
  const n = anim.frames.length;
  return anim.frames[anim.loop ? ((i % n) + n) % n : Math.min(n - 1, Math.max(0, i))];
}

export const animDuration = (a: Anim) => a.frames.length / a.fps;

// ----------------------------------------------------------------------------- portraits
export const PORTRAIT = 72;
const portraitCache = new Map<string, PixelBuffer[]>();

/** Dialogue portrait frames: [neutral, talking, blink]. */
export function getPortrait(id: HumanId, outfit?: string): PixelBuffer[] {
  const dress = outfit && hasOutfit(id, outfit) ? outfit : "";
  const key = `${id}/${dress}`;
  let p = portraitCache.get(key);
  if (!p) {
    const st = styleOf(id, dress || undefined);
    const S = st.scale ?? 1;
    const k = 3 / S;
    const facing = id === "heroine" ? -0.45 : 0.45;
    const opts = { w: PORTRAIT, h: PORTRAIT, ox: PORTRAIT / 2, oy: Math.round(34 + 24.3 * S * k * 0.866), k, bust: true };
    const base: HumanPose = { t: 0.6, mouth: "smile", handL: [-4.4, 0.8, 10], handR: [4.4, 0.8, 10], wind: [0, -0.2, 0], sword: "none" };
    p = [paintHuman(st, base, facing, opts), paintHuman(st, { ...base, mouth: "open" }, facing, opts), paintHuman(st, { ...base, eyes: "blink" }, facing, opts)];
    portraitCache.set(key, p);
  }
  return p;
}
