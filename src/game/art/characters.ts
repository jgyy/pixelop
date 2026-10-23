import type { PixelBuffer } from "../pixel/PixelBuffer";
import type { V3 } from "../iso/raster";
import { BEAST_H, BEAST_OX, BEAST_OY, BEAST_W, FOX_STYLE, paintBat, paintCrane, paintQuad, paintSerpent, WOLF_STYLE, type BeastPose } from "./beasts";
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

export type AnimId = "idle" | "walk" | "run" | "talk" | "attack" | "cast" | "hurt" | "meditate" | "fly" | "victory" | "defeat" | "hop" | "practice" | "fish" | "bow" | "wave" | "gather" | "stretch" | "look";

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
};

// ----------------------------------------------------------------------------- beast poses
const beast: Partial<Record<AnimId, AnimSpec<BeastPose>>> = {
  idle: { n: 6, fps: 6, loop: true, pose: (i, n) => ({ t: ph(i, n) }) },
  walk: { n: 8, fps: 12, loop: true, pose: (i, n) => ({ t: ph(i, n) * 2, stride: ph(i, n), lift: Math.abs(Math.sin(ph(i, n))) * 0.4 }) },
  run: { n: 8, fps: 18, loop: true, pose: (i, n) => ({ t: ph(i, n) * 3, stride: ph(i, n), lift: 0.3 + Math.abs(Math.sin(ph(i, n))) * 1.4, lunge: 0.12 + Math.sin(ph(i, n) * 2) * 0.08 }) },
  attack: { n: 6, fps: 12, loop: false, pose: (i) => ({ t: i, lunge: [0, -0.3, 0.6, 1, 0.8, 0.2][i], mouth: i >= 2 && i <= 4 }) },
  hurt: { n: 3, fps: 8, loop: false, pose: (i) => ({ t: i, recoil: [1, 0.8, 0.3][i], flash: i === 0 ? 0.75 : 0, mouth: true }) },
  fly: { n: 6, fps: 10, loop: true, pose: (i, n) => ({ t: ph(i, n), wing: Math.sin(ph(i, n)) * 0.9, lift: 6 + Math.cos(ph(i, n)) }) },
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
  peddler: s({ robe: ramp("#b07a3a"), inner: PAL.paper, trim: PAL.brown, sash: PAL.green, hair: PAL.hairBrown, beard: PAL.hairBrown, hairStyle: "short", hat: "straw", hatRamp: PAL.straw, skin: PAL.skinTan, weapon: "staff", flare: 4.6, hem: 4.2, shoes: PAL.brown }),
  patriarch: s({ robe: PAL.crimson, inner: PAL.black, trim: PAL.gold, sash: PAL.black, hair: PAL.hairSilver, hairStyle: "long", hat: "crown", hatRamp: PAL.black, cape: PAL.black, weapon: "saber", scale: 1.3, glowEyes: "#ff2040", flare: 6.2 }),
} satisfies Record<string, HumanStyle>;

export type HumanId = keyof typeof STYLES;
export type BeastId = "fox" | "wolf" | "serpent" | "serpentKing" | "crane" | "bat";
export type CharId = HumanId | BeastId;

const HUMAN_ANIMS: Record<HumanId, AnimId[]> = {
  heroine: ["idle", "walk", "run", "talk", "attack", "cast", "hurt", "meditate", "fly", "victory", "defeat", "bow", "gather", "stretch", "look", "wave"],
  elder: ["idle", "walk", "talk", "cast", "bow", "wave"],
  qing: ["idle", "walk", "talk", "bow", "wave"],
  abao: ["idle", "walk", "run", "talk", "practice", "wave"],
  discipleM: ["idle", "walk", "practice", "bow"],
  discipleF: ["idle", "walk", "practice", "bow", "wave"],
  zhou: ["idle", "walk", "talk", "wave"],
  hua: ["idle", "walk", "talk", "wave"],
  farmer: ["idle", "walk", "talk", "gather", "wave"],
  child: ["idle", "walk", "run", "talk", "wave"],
  huli: ["idle", "walk", "talk", "cast", "bow", "wave"],
  wen: ["idle", "talk", "fish", "cast", "wave"],
  peddler: ["idle", "walk", "talk", "wave", "look"],
  cultist: ["idle", "walk", "attack", "hurt"],
  jiangshi: ["idle", "hop", "attack", "hurt"],
  patriarch: ["idle", "walk", "attack", "cast", "hurt", "defeat", "talk"],
};

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
  cultist: ["Blood Moon Cultist", "Demonic Sect Acolyte"],
  jiangshi: ["Jiangshi", "Hopping Corpse"],
  patriarch: ["Patriarch Xue", "Lord of the Blood Moon Sect"],
  fox: ["Fox Spirit", "Corrupted Beast"],
  wolf: ["Shadowflame Wolf", "Corrupted Beast"],
  serpent: ["Jade Serpent", "Lake Beast"],
  serpentKing: ["Serpent King", "Ancient Lake Guardian"],
  crane: ["Spirit Crane", "Messenger of the Sect"],
  bat: ["Blood Bat", "Valley Vermin"],
};

const BEAST_ANIMS: Record<BeastId, AnimId[]> = {
  fox: ["idle", "walk", "run", "attack", "hurt"],
  wolf: ["idle", "walk", "run", "attack", "hurt"],
  serpent: ["idle", "walk", "attack", "hurt"],
  serpentKing: ["idle", "walk", "attack", "hurt"],
  crane: ["idle", "fly"],
  bat: ["fly"],
};

export const HUMAN_IDS = Object.keys(STYLES) as HumanId[];
export const BEAST_IDS = Object.keys(BEAST_ANIMS) as BeastId[];
export const CHAR_IDS: CharId[] = [...HUMAN_IDS, ...BEAST_IDS];

const isHuman = (id: CharId): id is HumanId => id in STYLES;

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
      portrait: id !== "jiangshi" && id !== "cultist",
    };
  }
  if (id === "bat") return { id, name, title, w: 40, h: 32, ox: 20, oy: 26, anims: BEAST_ANIMS[id], portrait: false };
  return { id, name, title, w: BEAST_W, h: BEAST_H, ox: BEAST_OX, oy: BEAST_OY, anims: BEAST_ANIMS[id], portrait: false };
}

function paintFrame(id: CharId, anim: AnimId, i: number, dir: number): PixelBuffer {
  const a = dirAngle(dir);
  if (isHuman(id)) {
    const spec = human[anim] ?? human.idle!;
    const st = STYLES[id];
    const pose = spec.pose(i, spec.n);
    const def = charDef(id);
    // non-sword users keep the default resting hands for sword poses
    if (anim === "attack" && st.weapon !== "jian" && st.weapon !== "saber") pose.handR = pose.handR ?? REST_HAND_R;
    if (anim === "attack" || anim === "practice") pose.sword = "hand";
    if (id === "jiangshi" && anim !== "hop") {
      pose.handL = [-2.6, 8.4, 17.6];
      pose.handR = [2.6, 8.4, 17.6];
      pose.eyes = anim === "hurt" ? "hurt" : "closed";
    }
    if (pose.handL === undefined) pose.handL = REST_HAND_L;
    return paintHuman(st, pose, a, { w: def.w, h: def.h, ox: def.ox, oy: def.oy });
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
    case "crane":
      return paintCrane(anim === "fly" ? pose : { t: pose.t }, a);
    case "bat":
      return paintBat(beast.fly!.pose(i, 6), a);
  }
}

const cache = new Map<string, Anim>();

/** Lazily painted animation for a character in one of 16 directions. */
export function getAnim(id: CharId, anim: AnimId, dir: number): Anim {
  const def = charDef(id);
  const real: AnimId = def.anims.includes(anim) ? anim : anim === "walk" && def.anims.includes("hop") ? "hop" : anim === "walk" && def.anims.includes("fly") ? "fly" : def.anims[0];
  const d = ((dir % DIRS) + DIRS) % DIRS;
  const key = `${id}/${real}/${d}`;
  let a = cache.get(key);
  if (!a) {
    const spec = (isHuman(id) ? human[real] : beast[real]) ?? (isHuman(id) ? human.idle! : beast.idle!);
    const n = id === "bat" ? 6 : spec.n;
    a = { fps: spec.fps, loop: spec.loop, frames: Array.from({ length: n }, (_, i) => paintFrame(id, real, i, d)) };
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
export function getPortrait(id: HumanId): PixelBuffer[] {
  let p = portraitCache.get(id);
  if (!p) {
    const st = STYLES[id];
    const S = st.scale ?? 1;
    const k = 3 / S;
    const facing = id === "heroine" ? -0.45 : 0.45;
    const opts = { w: PORTRAIT, h: PORTRAIT, ox: PORTRAIT / 2, oy: Math.round(34 + 24.3 * S * k * 0.866), k, bust: true };
    const base: HumanPose = { t: 0.6, mouth: "smile", handL: [-4.4, 0.8, 10], handR: [4.4, 0.8, 10], wind: [0, -0.2, 0], sword: "none" };
    p = [paintHuman(st, base, facing, opts), paintHuman(st, { ...base, mouth: "open" }, facing, opts), paintHuman(st, { ...base, eyes: "blink" }, facing, opts)];
    portraitCache.set(id, p);
  }
  return p;
}
