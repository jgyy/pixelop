import type { AnimId, HumanId } from "../art/characters";
import type { GreatDaoId } from "../engine/comprehension";
import { ECHO_BOSSES, type EchoId } from "../engine/enemies";
import type { AreaId } from "./ids";

/**
 * Where the Founder's Road runs on the land: the ten places where Lian
 * Qingxue, the Azure Cloud's founder, understood a Great Dao of heaven and
 * earth and carved what she understood into a stele, before she went up.
 * Kept free of the story's words so the world builder can lay the steles,
 * the Stele-Keeper and the Hollow Echoes without pulling in the tale.
 */
export const ROAD_DAOS = ["water", "wood", "wind", "fire", "earth", "metal", "thunder", "ice", "lifedeath", "void"] as const satisfies readonly GreatDaoId[];

export interface RoadSite {
  dao: GreatDaoId;
  /** The land the stele stands in. */
  region: AreaId;
  /** Where the stele stands, on the authoring grid (the layout walks out from here to open ground). */
  at: [number, number];
  /** The stele's name on the map. */
  name: string;
  hanzi: string;
}

export const ROAD_SITES: RoadSite[] = [
  { dao: "water", region: "lake", at: [238, 112], name: "The Founder's Stele of Water", hanzi: "水碑" },
  { dao: "wood", region: "bamboo", at: [146, 99], name: "The Founder's Stele of Wood", hanzi: "木碑" },
  { dao: "wind", region: "harbor", at: [474, 170], name: "The Founder's Stele of Wind", hanzi: "风碑" },
  { dao: "fire", region: "desert", at: [520, 398], name: "The Founder's Stele of Fire", hanzi: "火碑" },
  { dao: "earth", region: "terraces", at: [226, 264], name: "The Founder's Stele of Earth", hanzi: "土碑" },
  { dao: "metal", region: "bamboo", at: [86, 110], name: "The Founder's Stele of Metal", hanzi: "金碑" },
  { dao: "thunder", region: "terraces", at: [192, 205], name: "The Founder's Stele of Thunder", hanzi: "雷碑" },
  { dao: "ice", region: "frost", at: [602, 118], name: "The Founder's Stele of Ice", hanzi: "冰碑" },
  { dao: "lifedeath", region: "marsh", at: [50, 394], name: "The Founder's Stele of Life and Death", hanzi: "生死碑" },
  { dao: "void", region: "harbor", at: [606, 531], name: "The Founder's Stele of the Void", hanzi: "虚空碑" },
];

export const steleKey = (book: number) => `stele-${ROAD_DAOS[book]}`;

/** The Hollow Echo that guards each broken stele (the last is Wei Kongming himself). */
export const echoOf = (book: number): EchoId => ECHO_BOSSES[book];

/**
 * The folk of the Tidewater Reach, the south-east the world grew into: the
 * port city of Hailing, Saltwind village on its salt pans and the causeway
 * out to Returning Cloud Isle. Placed by the world builder, spoken for by
 * the Road (they answer its questions in book X) and by the city's own words.
 */
export const TIDE_FOLK: { key: string; name: string; char: HumanId }[] = [
  { key: "hlharbor", name: "Harbourmaster Ruan", char: "captain" },
  { key: "hlboatwoman", name: "Boatwoman Xiu", char: "boatwoman" },
  { key: "hlboatman", name: "Boatman Chang", char: "boatwoman" },
  { key: "hllion1", name: "Lion Dancer Ah Fei", char: "liondancer" },
  { key: "hllion2", name: "Lion Dancer Ah Kit", char: "liondancer" },
  { key: "hlacrobat", name: "Acrobat Lingling", char: "acrobat" },
  { key: "hlacrobat2", name: "Acrobat Dou Dou", char: "acrobat" },
  { key: "hlpuppeteer", name: "Puppeteer Old He", char: "storyteller" },
  { key: "hlabacus", name: "Moneychanger Qian Duo", char: "merchant" },
  { key: "hlspice", name: "Spice Merchant Farrukh", char: "merchant" },
  { key: "hlchess1", name: "Old Man Pan", char: "villagerM" },
  { key: "hlchess2", name: "Old Man Gu", char: "scholar" },
  { key: "hlfirecracker", name: "Firework-Maker Lei", char: "villagerM" },
  { key: "hlhawker", name: "Dumpling Seller Bao Mei", char: "cook" },
  { key: "hlpearl", name: "Pearl Diver A-Nan", char: "fishwife" },
  { key: "hlkids", name: "Little Shell", char: "child" },
  { key: "hlkids2", name: "Little Crab", char: "boy" },
  { key: "hlmonk", name: "Tide Monk Jingkong", char: "monk" },
  { key: "hlguard", name: "Watchman Fu", char: "guard" },
  { key: "hlsalt", name: "Salt-Raker Old Lu", char: "farmer" },
  { key: "hlsalt2", name: "Salt-Raker Meimei", char: "villagerF" },
  { key: "hlshrine", name: "Shrine-Keeper Ama", char: "villagerF" },
];

export const tideFolk = (key: string) => TIDE_FOLK.find((f) => f.key === key);

/**
 * Street folk of Jinhe's north-gate fair and Willow Creek's market road, who
 * do what Hailing's street folk do (and talk like them: `as` names whose
 * words they borrow). `at` is relative to Jinhe's north gate, or a tile in
 * Willow Creek; `festival` folk only come out once the Heart is home.
 */
export const STREET_FOLK: { key: string; name: string; char: HumanId; as: string; town: "jinhe" | "willow"; at: [number, number]; dir: number; anim: AnimId; festival?: boolean }[] = [
  { key: "jhlion1", name: "Lion Dancer Da Shan", char: "liondancer", as: "hllion1", town: "jinhe", at: [-1, -7], dir: 2, anim: "liondance" },
  { key: "jhlion2", name: "Drummer Xiao Shan", char: "liondancer", as: "hllion2", town: "jinhe", at: [-3, -6], dir: 4, anim: "drum" },
  { key: "jhacrobat", name: "Acrobat Yanyan", char: "acrobat", as: "hlacrobat", town: "jinhe", at: [2, -8], dir: 6, anim: "acrobat" },
  { key: "jhpuppet", name: "Puppeteer Granny Lou", char: "storyteller", as: "hlpuppeteer", town: "jinhe", at: [-5, -6], dir: 0, anim: "puppet" },
  { key: "jhchess1", name: "Old Man Kuang", char: "scholar", as: "hlchess1", town: "jinhe", at: [4, -6], dir: 4, anim: "xiangqi" },
  { key: "jhchess2", name: "Old Man Wei", char: "villagerM", as: "hlchess2", town: "jinhe", at: [6, -7], dir: 12, anim: "xiangqi" },
  { key: "jhbuns", name: "Bun Seller Auntie Hu", char: "cook", as: "hlhawker", town: "jinhe", at: [-4, -3], dir: 2, anim: "hawk" },
  { key: "jhfire", name: "Firework-Maker Pao", char: "villagerM", as: "hlfirecracker", town: "jinhe", at: [-6, -11], dir: 2, anim: "firecracker" },
  { key: "jhkid", name: "Little Pinwheel", char: "child", as: "hlkids", town: "jinhe", at: [3, -10], dir: 2, anim: "firecracker" },
  { key: "wcchess1", name: "Old Liang", char: "farmer", as: "hlchess1", town: "willow", at: [182, 144], dir: 4, anim: "xiangqi" },
  { key: "wcchess2", name: "Old Shu", char: "villagerM", as: "hlchess2", town: "willow", at: [184, 143], dir: 12, anim: "xiangqi" },
  { key: "wcbuns", name: "Bun Seller Fat Jin", char: "cook", as: "hlhawker", town: "willow", at: [191, 139], dir: 2, anim: "hawk" },
  { key: "wclion", name: "Willow Creek's Lion", char: "liondancer", as: "hllion1", town: "willow", at: [193, 148], dir: 2, anim: "liondance", festival: true },
  { key: "wckid", name: "Little Firecracker", char: "boy", as: "hlkids2", town: "willow", at: [189, 150], dir: 2, anim: "firecracker", festival: true },
];
export const streetFolk = (key: string) => STREET_FOLK.find((f) => f.key === key);

export type { EchoId };
