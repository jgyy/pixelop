import type { PropId } from "../art/props";
import { propDef } from "../art/props";
import { festive, placementTiles, type AreaDef, type Interactable, type NpcPlacement, type PropPlacement } from "./areas";
import { toCoarse } from "./layout";
import { buildingTiles, magnifyBuilding } from "./magnify";
import { TileMap, type TileKind } from "./tilemap";
import type { CaveId } from "./caves";
import { DORM_AT, HALL_CAST, ROOM_SEVEN, ROOMMATES } from "./halls";

/**
 * The buildings the heroine can step inside. Each interior is a small
 * cutaway room: plastered walls along the two back edges (some with lattice
 * windows), a raised floor and an open front, furnished with ray-cast props
 * and lived in by its own folk. Rooms are tiny AreaDefs, so the same World
 * runtime that runs the open jianghu runs them too.
 *
 * Inside and outside are one to one: a room's tile map is exactly the
 * building's footprint in the world (walls included), and its door is the
 * same tile row or column as the building's front door.
 */

export const INTERIOR_IDS = ["hall", "cottage", "teahouse", "mill", "pagoda", "dorm", "fragrance", "fragranceup", "willowinn", "willowinnup"] as const;
export type InteriorId = (typeof INTERIOR_IDS)[number];

export interface InteriorDef extends AreaDef {
  key: InteriorId | CaveId;
  /** The building in the open world (its footprint is the room's map). */
  building: PropPlacement;
  /** The same building where it stands on the authoring grid. */
  source: PropPlacement;
  /** The open-world tile in front of the building's door. */
  door: [number, number];
  /** Unit vector pointing from the door into the building (walking that way enters it). */
  inward: [number, number];
  /** Where she stands outside after leaving, in world tiles. */
  outside: [number, number];
  /** The tile inside the room that leads back out (on an upper floor: back down the stair). */
  exit: [number, number];
  /** A floor above, reached by the stair at `stair` (multi-storey buildings). */
  upstairs?: InteriorId;
  /** The floor below, for an upper floor (it has no door of its own onto the street). */
  below?: InteriorId;
  /** Where the stair stands in this room. */
  stair?: [number, number];
  /** The realm she must have reached before the house lets her up (0 Qi Condensation, 1 Foundation, 2 Core Formation…). */
  minRealm?: number;
}

/**
 * A room the size of a building's footprint: a floor at height 1, plastered
 * walls (7 high) along i = 0 and j = 0, and lattice windows where asked.
 */
function room(building: PropPlacement, floor: TileKind, windows: [number, number][]): TileMap {
  const [i0, j0, i1, j1] = buildingTiles(building);
  const m = new TileMap(i1 - i0 + 1, j1 - j0 + 1, floor, 1);
  for (let i = 0; i < m.w; i++) m.set(i, 0, "wall", 7);
  for (let j = 0; j < m.h; j++) m.set(0, j, "wall", 7);
  for (const [i, j] of windows) m.set(i, j, "window", 7);
  return m;
}

/** A building standing on authoring-grid tile (i, j), grown k times into the world. */
function building(id: PropId, k: number, [i, j]: [number, number]): PropPlacement & { source: PropPlacement } {
  return { ...magnifyBuilding({ id, i, j }, k), source: { id, i, j } };
}

const P = (id: PropId, i: number, j: number): PropPlacement => ({ id, i, j });

interface Spec {
  key: InteriorId;
  name: string;
  hanzi: string;
  subtitle: string;
  building: PropPlacement & { source: PropPlacement };
  map: TileMap;
  props: PropPlacement[];
  npcs: NpcPlacement[];
  interacts: Interactable[];
  /** Unit vector from the door into the building: [-1, 0] for a door on the east face, [0, -1] on the south face. */
  inward: [number, number];
  night?: number;
  upstairs?: InteriorId;
  below?: InteriorId;
  stair?: [number, number];
  minRealm?: number;
}

function interior(sp: Spec): InteriorDef {
  const m = sp.map;
  for (const p of sp.props) {
    if (!propDef(p.id).blocks) continue;
    const [i0, j0, i1, j1] = placementTiles(p);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) m.block(i, j);
  }
  // the front door sits in the middle of the east (or south) face, and the room's threshold is the same row (or column)
  const [bi0, bj0, bi1, bj1] = buildingTiles(sp.building);
  const [di, dj] = sp.inward;
  const midI = Math.floor((bi0 + bi1 + 1) / 2);
  const midJ = Math.floor((bj0 + bj1 + 1) / 2);
  const door: [number, number] = di < 0 ? [bi1 + 1, midJ] : [midI, bj1 + 1];
  const [ei, ej]: [number, number] = di < 0 ? [m.w - 1, midJ - bj0] : [midI - bi0, m.h - 1];
  return {
    id: "sect",
    key: sp.key,
    name: sp.name,
    hanzi: sp.hanzi,
    subtitle: sp.subtitle,
    map: m,
    base: 0,
    floating: false,
    sky: "interior",
    weather: "none",
    night: sp.night ?? 0.42,
    tint: "#ff9a50",
    // she arrives one step inside the door
    arrive: [ei + 0.5 + di * 0.6, ej + 0.5 + dj * 0.6],
    props: [...sp.props, P("mat", ei, ej)],
    npcs: sp.npcs,
    enemies: [],
    interacts: [...sp.interacts, { key: `${sp.key}-exit`, kind: "door", i: ei, j: ej, to: "out" }, ...(sp.upstairs && sp.stair ? [{ key: `${sp.key}-stair`, kind: "door" as const, i: sp.stair[0], j: sp.stair[1], to: sp.upstairs }] : [])],
    building: { id: sp.building.id, i: sp.building.i, j: sp.building.j, k: sp.building.k, at: sp.building.at },
    source: sp.building.source,
    door,
    inward: sp.inward,
    outside: [door[0] + 0.5 - di * 0.7, door[1] + 0.5 - dj * 0.7],
    exit: [ei, ej],
    ...(sp.upstairs && { upstairs: sp.upstairs }),
    ...(sp.below && { below: sp.below }),
    ...(sp.stair && { stair: sp.stair }),
    ...(sp.minRealm !== undefined && { minRealm: sp.minRealm }),
  };
}

// ----------------------------------------------------------------------------- the Hall of Clouds
function buildHall(): InteriorDef {
  // 9 × 9 tiles inside and out
  const b = building("hall", 3, toCoarse("sect", 15, 6));
  const m = room(b, "marble", [[3, 0], [6, 0], [0, 4]]);
  m.rect(3, 3, 7, 6, "rug");
  return interior({
    key: "hall",
    name: "Hall of Clouds",
    hanzi: "云殿",
    subtitle: "Ancestral hall and archive of the Azure Cloud Sect",
    building: b,
    map: m,
    inward: [-1, 0],
    props: [
      P("statue", 1, 1),
      P("shelf", 2, 1),
      P("candle", 3, 1),
      P("altar", 4, 1),
      P("candle", 5, 1),
      P("scroll", 6, 1),
      P("shelf", 7, 1),
      P("shelf", 8, 1),
      P("shelfX", 1, 2),
      P("shelfX", 1, 3),
      P("scrollX", 1, 5),
      P("shelfX", 1, 6),
      P("shelfX", 1, 7),
      P("vase", 8, 8),
      P("vase", 1, 8),
      P("screen", 7, 8),
      P("cushion", 4, 4),
      P("chest", 2, 8),
    ],
    npcs: [{ key: "shen", char: "archivist", i: 6, j: 3, dir: 1, anim: "read" }],
    interacts: [
      { key: "hall-altar", kind: "sign", i: 4, j: 1, anim: "pray", text: "Three ancestor tablets in black lacquer. The tallest reads: “Lian Qingxue, Founder. She asked heaven for nothing, and heaven gave way.” Incense smoke curls up past the gold characters. You bow three times." },
      { key: "hall-annals", kind: "sign", i: 2, j: 1, text: "The Annals of the Azure Cloud, volume one: “In the founder's ninetieth year a lotus bloomed in her dantian and would not wilt. When she ascended, the flower stayed behind on the shrine. The disciples named it the Jade Lotus Heart, and swore that the sect would guard it for as long as the clouds held it up.”" },
      { key: "hall-war", kind: "sign", i: 1, j: 3, text: "A war record, its corners burned: “Year 812. The Blood Moon Sect descended on the stone forest and fed the Temple of Still Water to the flames. Our elders drove them into the western valley and sealed it with their own lives. Nine went down the mountain. Two came home.”" },
      { key: "hall-register", kind: "sign", i: 1, j: 7, text: "A register of outer disciples. One line has been struck through in red: “Xue Ming. Age nine. Willow Creek. A gifted boy, hungry for the sky. Expelled at seventeen for stealing the Heart's light in a jar from the shrine. He wept and did not deny it.”" },
      { key: "hall-bridge", kind: "sign", i: 8, j: 1, text: "A builder's ledger for the sky bridges: “Each plank is laid with a talisman beneath it. Should the sect ever fall, the bridges will fall with it, so that no thief can climb to an empty shrine.”" },
      { key: "hall-oath", kind: "sign", i: 1, j: 6, text: "The Oath of the Dragonspine, copied in three hands: “The Scarlet Phoenix, Hundred Herb Valley and the Sword Sea swear that none shall dig for the Dragon Vein, nor drink from it, nor give it away, until all three agree.” A note in the margin, in Elder Mo's hand: “They have not agreed on anything since.”" },
      { key: "hall-chest", kind: "chest", i: 2, j: 8 },
    ],
  });
}

// ----------------------------------------------------------------------------- Granny Hua's cottage
function buildCottage(): InteriorDef {
  // 8 × 8 tiles inside and out
  const b = building("house", 4, toCoarse("village", 11, 3));
  const m = room(b, "wood", [[4, 0], [0, 4]]);
  m.rect(4, 4, 6, 6, "rug");
  return interior({
    key: "cottage",
    name: "Granny Hua's Cottage",
    hanzi: "华婆小屋",
    subtitle: "Herbs drying in the rafters, a loom by the hearth",
    building: b,
    map: m,
    inward: [-1, 0],
    props: [
      P("hearth", 1, 1),
      P("herbrack", 3, 1),
      P("swordrack", 4, 1),
      P("bed", 5, 1),
      P("shelfX", 1, 3),
      P("scrollX", 1, 5),
      P("loom", 3, 5),
      P("table", 5, 5),
      P("cushion", 5, 6),
      P("vase", 1, 7),
      P("sacks", 7, 7),
    ],
    npcs: [{ key: "lu", char: "weaver", i: 3, j: 4, dir: 0, anim: "weave", outfit: festive }],
    interacts: [
      { key: "cottage-sword", kind: "sign", i: 4, j: 1, text: "A sheathed sword wrapped in faded azure silk, the sect's cloud crest still stitched on the hilt. Beneath it a cup of tea has been poured and left to go cold — fresh, by the smell of it, this very morning." },
      { key: "cottage-shelf", kind: "sign", i: 1, j: 3, text: "Jars of dried herbs, each labelled in a careful hand: snow lotus, ginseng, fox-ear moss, “for Mei's cough”, and one marked only “for when he comes home”." },
      { key: "cottage-herbs", kind: "herb", i: 6, j: 3 },
    ],
  });
}

// ----------------------------------------------------------------------------- the crossroads teahouse
function buildTeahouse(): InteriorDef {
  // 8 × 8 tiles inside and out; its open front faces the crossroads
  const b = building("teahouse", 4, [145, 170]);
  const m = room(b, "wood", [[3, 0], [6, 0], [0, 4]]);
  return interior({
    key: "teahouse",
    name: "Crossroads Teahouse",
    hanzi: "茶馆",
    subtitle: "Every road in the jianghu passes Fang's door",
    building: b,
    map: m,
    inward: [0, -1],
    props: [
      P("hearth", 1, 1),
      P("candle", 2, 1),
      P("shelf", 3, 1),
      P("shelf", 4, 1),
      P("scroll", 5, 1),
      P("screen", 7, 1),
      P("shelfX", 1, 3),
      P("cushion", 2, 3),
      P("table", 3, 3),
      P("table", 6, 3),
      P("cushion", 6, 2),
      P("table", 2, 6),
      P("cushion", 6, 6),
      P("vase", 1, 7),
      P("candle", 7, 5),
    ],
    npcs: [
      { key: "qiao", char: "storyteller", i: 6, j: 6, dir: 14, anim: "tell" },
      { key: "gu", char: "scholar", i: 2, j: 3, dir: 4, anim: "read" },
    ],
    interacts: [
      { key: "tea-menu", kind: "sign", i: 4, j: 1, text: "Painted on a board above the tea jars: Cloud-mist green — 2 coppers. Fox-ear oolong — 3 coppers. Snow lotus white — “ask Fang”. Below, in fresher ink: “Cultivators pay in stories.”" },
      { key: "tea-wall", kind: "sign", i: 1, j: 3, text: "Travellers have carved their names into the post: a Blood Moon crescent scratched out with a knife, “Xiao Han was here (undefeated)”, and, very small, “Bai owes Fang 21 coppers”." },
    ],
  });
}

// ----------------------------------------------------------------------------- the watermill
function buildMill(): InteriorDef {
  // 8 × 8 tiles inside and out
  const b = building("house", 4, [234, 108]);
  const m = room(b, "wood", [[5, 0], [0, 3]]);
  return interior({
    key: "mill",
    name: "Watermill",
    hanzi: "水磨坊",
    subtitle: "Stones turning to the creek's own rhythm",
    building: b,
    map: m,
    inward: [-1, 0],
    props: [
      P("millstone", 4, 3),
      P("sacks", 1, 1),
      P("sacks", 2, 1),
      P("sacks", 1, 2),
      P("herbrack", 6, 1),
      P("candle", 7, 1),
      P("sacks", 7, 2),
      P("shelfX", 1, 5),
      P("haystack", 1, 7),
      P("vase", 3, 7),
      P("table", 6, 6),
    ],
    npcs: [{ key: "dou", char: "millhand", i: 6, j: 5, dir: 2, anim: "sweep" }],
    interacts: [
      { key: "mill-stone", kind: "sign", i: 5, j: 4, text: "The great stones grind with a sound like distant thunder. Scratched into the shaft, a row of tally marks — one for every year the wheel has turned. The fortieth mark is circled twice." },
      { key: "mill-chest", kind: "chest", i: 7, j: 7 },
    ],
  });
}

// ----------------------------------------------------------------------------- the Pagoda of Seven Lamps
function buildPagoda(): InteriorDef {
  // 9 × 9 tiles inside and out
  const b = building("pagoda", 3, [190, 203]);
  const m = room(b, "plaza", [[4, 0], [0, 4]]);
  m.rect(3, 3, 6, 6, "rug");
  return interior({
    key: "pagoda",
    name: "Pagoda of Seven Lamps",
    hanzi: "七灯塔",
    subtitle: "Seven flames for seven farmers who never came home",
    building: b,
    map: m,
    inward: [-1, 0],
    night: 0.6,
    props: [
      P("altar", 4, 1),
      P("statue", 1, 1),
      P("candle", 2, 1),
      P("candle", 6, 1),
      P("scroll", 7, 1),
      P("scrollX", 1, 3),
      P("scrollX", 1, 6),
      P("lampstand", 4, 4),
      P("cushion", 4, 6),
      P("vase", 1, 8),
      P("vase", 8, 8),
    ],
    npcs: [{ key: "ming", char: "lampkeeper", i: 4, j: 6, dir: 8, anim: "pray" }],
    interacts: [
      { key: "pagoda-lamps", kind: "sign", i: 4, j: 4, anim: "pray", text: "Seven oil lamps on a bronze tree. A name is cut beneath each one: Wu Da, Wu Er, Old Pan, Little Qiu, the twins Lan and Lin, and Zhao the ferryman. The flames lean towards you, then settle." },
      { key: "pagoda-scroll", kind: "sign", i: 1, j: 3, text: "A painted scroll: seven farmers with hoes and pitchforks standing at the mouth of a red valley, and behind them the fields, small and gold. The colophon reads: “They held the road for one night, so that the immortals had time to come down.”" },
      { key: "pagoda-chest", kind: "chest", i: 8, j: 1 },
    ],
  });
}

// ----------------------------------------------------------------------------- Room Seven of the Ten Halls' Outer Court
function buildDorm(): InteriorDef {
  // 8 × 8 tiles inside and out: six bunks, one table, one lamp, and a window that does not quite shut
  const b = building("house", 4, DORM_AT);
  const m = room(b, "wood", [[4, 0], [0, 3]]);
  m.rect(3, 4, 5, 5, "rug");
  return interior({
    key: "dorm",
    name: "Room Seven",
    hanzi: "东舍七号",
    subtitle: "Six bunks in the Outer Court of the Ten Halls",
    building: b,
    map: m,
    inward: [-1, 0],
    night: 0.5,
    props: [
      P("bunkbed", 1, 1),
      P("bunkbed", 5, 1),
      P("bunkbed", 1, 7),
      P("lampstand", 3, 1),
      P("chest", 7, 1),
      P("shelfX", 1, 4),
      P("table", 4, 4),
      P("cushion", 3, 5),
      P("vase", 7, 7),
      P("sacks", 4, 7),
    ],
    npcs: ROOMMATES.map((key) => {
      const r = ROOM_SEVEN[key];
      // each of them is here once she has her bunk, and not while they are missing from the room
      return { key, name: HALL_CAST[key].name, char: HALL_CAST[key].char, i: r.at[0], j: r.at[1], dir: r.dir, anim: r.anim, when: (f: Record<string, boolean>) => !!f["halls:joined"] && !f[`halls:away:${key}`] };
    }),
    interacts: [
      { key: "dorm-bunk", kind: "sign", i: 6, j: 1, anim: "sleep", text: "The bunk by the window: the coldest in Room Seven. Carved small on the underside of the slats, worn almost smooth: 清雪, Clear Snow. Beside it, in another hand: “Lian Qingxue slept here one winter and snored. — her roommate.” You lie down for a moment and listen to the window whistle." },
      { key: "dorm-rota", kind: "sign", i: 1, j: 4, text: "The Outer Court's rules, pinned to the shelf in Steward Gou's square hand: “Curfew at the second watch. Hot water before dawn. No cooking in the rooms (Tie Niu). No kites on the roof (Qiu). No silk on the washing line (Yao Zhi). Bunks marked ‘away’ are not to be touched by ANYONE.”" },
      { key: "dorm-chest", kind: "chest", i: 7, j: 1 },
    ],
  });
}


// ----------------------------------------------------------------------------- the Pavilion of Nine Fragrances, Jinhe's three-storey restaurant: the ground floor, and the floor above for cultivators of standing
const FRAGRANCE_AT: [number, number] = [204, 495];
function buildFragrance(): InteriorDef {
  // 9 × 9 tiles inside and out
  const b = building("towerinn", 3, FRAGRANCE_AT);
  const m = room(b, "wood", [[3, 0], [6, 0], [0, 4]]);
  m.rect(3, 3, 5, 5, "rug");
  return interior({
    key: "fragrance",
    name: "Pavilion of Nine Fragrances",
    hanzi: "九香楼",
    subtitle: "Ground floor: porters, merchants and anyone with a copper",
    building: b,
    map: m,
    inward: [-1, 0],
    upstairs: "fragranceup",
    stair: [1, 7],
    props: [
      P("hearth", 1, 1),
      P("shelf", 2, 1),
      P("barrels", 4, 1),
      P("screen", 7, 1),
      P("table", 3, 3),
      P("cushion", 3, 4),
      P("table", 6, 3),
      P("cushion", 6, 4),
      P("table", 3, 6),
      P("table", 6, 6),
      P("lampstand", 8, 8),
      P("vase", 1, 3),
    ],
    npcs: [
      { key: "fr-cook", name: "Cook Yang of the Nine Fragrances", char: "cook", i: 2, j: 2, dir: 2, anim: "pour" },
      { key: "fr-porter", name: "A Porter at Supper", char: "porter", i: 4, j: 4, dir: 10, anim: "eat" },
      { key: "fr-merchant", name: "A Salt Merchant", char: "merchant", i: 6, j: 5, dir: 14, anim: "toast" },
      { key: "fr-storyteller", name: "Storyteller Ban", char: "storyteller", i: 5, j: 7, dir: 12, anim: "tell" },
    ],
    interacts: [
      { key: "fr-menu", kind: "sign", i: 2, j: 1, text: "A painted menu by the stair: Noodles — 2 coppers. Wine — 3 coppers. Below, in red: “THE UPPER FLOOR is for cultivators of Foundation Establishment and above. Mortals and Qi Condensation may not go up, however much they pay. — The Management, with apologies to Qi Condensation.”" },
      { key: "fr-chest", kind: "chest", i: 8, j: 1 },
    ],
  });
}

function buildFragranceUp(): InteriorDef {
  // the same 9 × 9 tiles, one storey up: lattice windows on every wall, a balcony rail along the open front over the lane
  const b = building("towerinn", 3, FRAGRANCE_AT);
  const m = room(b, "wood", [[2, 0], [4, 0], [6, 0], [0, 2], [0, 6]]);
  m.rect(2, 2, 6, 6, "rug");
  return interior({
    key: "fragranceup",
    name: "Pavilion of Nine Fragrances · Upper Floor",
    hanzi: "九香楼·雅座",
    subtitle: "The upper floor: for cultivators of standing only",
    building: b,
    map: m,
    inward: [-1, 0],
    below: "fragrance",
    stair: [1, 7],
    minRealm: 1,
    night: 0.36,
    props: [
      P("screen", 1, 1),
      P("scroll", 3, 1),
      P("vase", 5, 1),
      P("lampstand", 7, 1),
      P("table", 3, 3),
      P("cushion", 3, 4),
      P("table", 6, 3),
      P("cushion", 6, 4),
      P("table", 4, 6),
      P("cushion", 5, 6),
      P("candle", 8, 2),
      P("candle", 8, 6),
    ],
    npcs: [
      { key: "fr-lord", name: "A Gold-Tier Lord Visiting Jinhe", char: "nobleM", i: 3, j: 2, dir: 2, anim: "toast" },
      { key: "fr-lady", name: "Lady Wan of the Golden Pavilion", char: "nobleF", i: 7, j: 4, dir: 12, anim: "lean" },
      { key: "fr-sword", name: "A Swordsman of the Sword Sea", char: "swordsea", i: 6, j: 5, dir: 14, anim: "drink" },
      { key: "fr-poet", name: "Poet Shu Ye, Upstairs at Last", char: "scholar", i: 2, j: 5, dir: 4, anim: "write" },
    ],
    interacts: [
      { key: "fr-window", kind: "sign", i: 4, j: 0, text: "From the upper floor's lattice you can see the whole lane below: porters, bearers, the dyers' blue hands, the old wall's line. Nobody down there is looking up. Nobody down there is allowed to come up and look down." },
      { key: "fr-up-chest", kind: "chest", i: 1, j: 3 },
    ],
  });
}

// ----------------------------------------------------------------------------- the Willow Inn in Willow Creek's East Ward: three storeys, and a top floor the village built for a golden core of its own
const WILLOW_INN_AT: [number, number] = [230, 139];
function buildWillowInn(): InteriorDef {
  const b = building("towerinn", 3, WILLOW_INN_AT);
  const m = room(b, "wood", [[3, 0], [0, 3], [0, 6]]);
  m.rect(3, 3, 6, 5, "rug");
  return interior({
    key: "willowinn",
    name: "The Willow Inn",
    hanzi: "柳溪客栈",
    subtitle: "Three storeys, built by every family in the village",
    building: b,
    map: m,
    inward: [0, -1],
    upstairs: "willowinnup",
    stair: [7, 1],
    props: [
      P("hearth", 1, 1),
      P("shelf", 3, 1),
      P("barrels", 5, 1),
      P("table", 3, 4),
      P("cushion", 4, 4),
      P("table", 6, 6),
      P("cushion", 5, 6),
      P("vase", 1, 8),
      P("lampstand", 8, 4),
    ],
    npcs: [
      { key: "wi-maid", name: "Serving Girl Lianlian", char: "villagerF", i: 2, j: 3, dir: 2, anim: "pour" },
      { key: "wi-farmer", name: "Farmer Wu's Cousin", char: "farmer", i: 4, j: 5, dir: 10, anim: "eat" },
      { key: "wi-guest", name: "A Guest from the Tea Terraces", char: "teapicker", i: 6, j: 4, dir: 14, anim: "drink" },
    ],
    interacts: [
      { key: "wi-board", kind: "sign", i: 3, j: 1, text: "The inn's rules, chalked on a board: “Ground floor: anyone. Second floor: anyone who pays. Top floor: kept for the day Willow Creek has a golden core of its own. (Core Formation and above. Granny Hua's girl, this means you.)”" },
      { key: "wi-chest", kind: "chest", i: 8, j: 8 },
    ],
  });
}

function buildWillowInnUp(): InteriorDef {
  const b = building("towerinn", 3, WILLOW_INN_AT);
  const m = room(b, "wood", [[2, 0], [5, 0], [0, 2], [0, 5]]);
  m.rect(2, 2, 6, 6, "rug");
  return interior({
    key: "willowinnup",
    name: "The Willow Inn · Top Floor",
    hanzi: "柳溪客栈·顶楼",
    subtitle: "Kept for Willow Creek's own golden core",
    building: b,
    map: m,
    inward: [0, -1],
    below: "willowinn",
    stair: [7, 1],
    minRealm: 2,
    night: 0.36,
    props: [
      P("bed", 2, 1),
      P("screen", 4, 1),
      P("scroll", 6, 1),
      P("table", 4, 4),
      P("cushion", 4, 5),
      P("vase", 1, 7),
      P("candle", 8, 3),
      P("altar", 1, 4),
    ],
    npcs: [{ key: "wi-zhou", name: "Village Head Zhou, Waiting Upstairs", char: "zhou", i: 5, j: 5, dir: 12, anim: "laugh" }],
    interacts: [
      { key: "wi-altar", kind: "sign", i: 1, j: 4, anim: "pray", text: "A little altar the village set up on the top floor, with a tablet on it, carved and gilded and left blank. Under it, in Granny Hua's hand: “For whoever comes up first. We always knew who it would be.”" },
      { key: "wi-view", kind: "sign", i: 5, j: 0, text: "From the top floor of the Willow Inn you can see over the willows to the creek, the market road, the highway, and, on a clear day, the sect floating in the clouds where you started. The whole of Willow Creek looks very small, and very much yours." },
    ],
  });
}

const BUILDERS: Record<InteriorId, () => InteriorDef> = { hall: buildHall, cottage: buildCottage, teahouse: buildTeahouse, mill: buildMill, pagoda: buildPagoda, dorm: buildDorm, fragrance: buildFragrance, fragranceup: buildFragranceUp, willowinn: buildWillowInn, willowinnup: buildWillowInnUp };
const cache = new Map<InteriorId, InteriorDef>();

/** Build (once) and return an interior. */
export function getInterior(id: InteriorId): InteriorDef {
  let d = cache.get(id);
  if (!d) cache.set(id, (d = BUILDERS[id]()));
  return d;
}

export const isInteriorId = (s: string | undefined): s is InteriorId => !!s && (INTERIOR_IDS as readonly string[]).includes(s);

/** The open-world doors, as interactables to stand before each building. */
export function interiorDoors(): Interactable[] {
  return INTERIOR_IDS.filter((id) => !getInterior(id).below).map((id) => {
    const d = getInterior(id);
    return { key: `door-${id}`, kind: "door", i: d.door[0], j: d.door[1], to: id };
  });
}
