import type { PropId } from "../art/props";
import { propDef } from "../art/props";
import type { AreaDef, Interactable, NpcPlacement, PropPlacement } from "./areas";
import { toWorld } from "./layout";
import { TileMap, type TileKind } from "./tilemap";

/**
 * The buildings the heroine can step inside. Each interior is a small
 * cutaway room: plastered walls along the two back edges (some with lattice
 * windows), a raised floor and an open front, furnished with ray-cast props
 * and lived in by its own folk. Rooms are tiny AreaDefs, so the same World
 * runtime that runs the open jianghu runs them too.
 */

export const INTERIOR_IDS = ["hall", "cottage", "teahouse", "mill", "pagoda"] as const;
export type InteriorId = (typeof INTERIOR_IDS)[number];

export interface InteriorDef extends AreaDef {
  key: InteriorId;
  /** The open-world tile in front of the building's door. */
  door: [number, number];
  /** Unit vector pointing from the door into the building (walking that way enters it). */
  inward: [number, number];
  /** Where she stands outside after leaving, in world tiles. */
  outside: [number, number];
  /** The tile inside the room that leads back out. */
  exit: [number, number];
}

/** A floor at height 1, plastered walls (7 high) along i = 0 and j = 0, and lattice windows where asked. */
function room(w: number, h: number, floor: TileKind, windows: [number, number][]): TileMap {
  const m = new TileMap(w + 1, h + 1, floor, 1);
  for (let i = 0; i <= w; i++) m.set(i, 0, "wall", 7);
  for (let j = 0; j <= h; j++) m.set(0, j, "wall", 7);
  for (const [i, j] of windows) m.set(i, j, "window", 7);
  return m;
}

const P = (id: PropId, i: number, j: number): PropPlacement => ({ id, i, j });

interface Spec {
  key: InteriorId;
  name: string;
  hanzi: string;
  subtitle: string;
  map: TileMap;
  props: PropPlacement[];
  npcs: NpcPlacement[];
  interacts: Interactable[];
  door: [number, number];
  inward: [number, number];
  exit: [number, number];
  night?: number;
}

function interior(sp: Spec): InteriorDef {
  const m = sp.map;
  for (const p of sp.props) {
    const d = propDef(p.id);
    if (!d.blocks) continue;
    for (let j = p.j + d.foot[1]; j <= p.j + d.foot[3]; j++) for (let i = p.i + d.foot[0]; i <= p.i + d.foot[2]; i++) m.block(i, j);
  }
  const [ei, ej] = sp.exit;
  const [di, dj] = sp.inward;
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
    interacts: [...sp.interacts, { key: `${sp.key}-exit`, kind: "door", i: ei, j: ej, to: "out" }],
    door: sp.door,
    inward: sp.inward,
    outside: [sp.door[0] + 0.5 - di * 0.7, sp.door[1] + 0.5 - dj * 0.7],
    exit: sp.exit,
  };
}

// ----------------------------------------------------------------------------- the Hall of Clouds
function buildHall(): InteriorDef {
  const m = room(10, 9, "marble", [[4, 0], [6, 0], [0, 4]]);
  m.rect(3, 3, 9, 6, "rug");
  return interior({
    key: "hall",
    name: "Hall of Clouds",
    hanzi: "云殿",
    subtitle: "Ancestral hall and archive of the Azure Cloud Sect",
    map: m,
    door: toWorld("sect", 17, 6),
    inward: [-1, 0],
    exit: [10, 5],
    props: [
      P("altar", 5, 1),
      P("candle", 3, 1),
      P("candle", 7, 1),
      P("statue", 1, 1),
      P("shelf", 2, 1),
      P("shelf", 8, 1),
      P("shelf", 9, 1),
      P("shelfX", 1, 2),
      P("shelfX", 1, 3),
      P("shelfX", 1, 6),
      P("shelfX", 1, 7),
      P("scrollX", 1, 5),
      P("scroll", 4, 1),
      P("vase", 9, 8),
      P("vase", 1, 9),
      P("screen", 8, 8),
      P("cushion", 5, 4),
      P("chest", 2, 9),
    ],
    npcs: [{ key: "shen", char: "archivist", i: 7, j: 3, dir: 1, anim: "read" }],
    interacts: [
      { key: "hall-altar", kind: "sign", i: 5, j: 1, anim: "pray", text: "Three ancestor tablets in black lacquer. The tallest reads: “Lian Qingxue, Founder. She asked heaven for nothing, and heaven gave way.” Incense smoke curls up past the gold characters. You bow three times." },
      { key: "hall-annals", kind: "sign", i: 2, j: 1, text: "The Annals of the Azure Cloud, volume one: “In the founder's ninetieth year a lotus bloomed in her dantian and would not wilt. When she ascended, the flower stayed behind on the shrine. The disciples named it the Jade Lotus Heart, and swore that the sect would guard it for as long as the clouds held it up.”" },
      { key: "hall-war", kind: "sign", i: 1, j: 3, text: "A war record, its corners burned: “Year 812. The Blood Moon Sect descended on the stone forest and fed the Temple of Still Water to the flames. Our elders drove them into the western valley and sealed it with their own lives. Nine went down the mountain. Two came home.”" },
      { key: "hall-register", kind: "sign", i: 1, j: 7, text: "A register of outer disciples. One line has been struck through in red: “Xue Ming. Age nine. Willow Creek. A gifted boy, hungry for the sky. Expelled at seventeen for stealing the Heart's light in a jar from the shrine. He wept and did not deny it.”" },
      { key: "hall-bridge", kind: "sign", i: 9, j: 1, text: "A builder's ledger for the sky bridges: “Each plank is laid with a talisman beneath it. Should the sect ever fall, the bridges will fall with it, so that no thief can climb to an empty shrine.”" },
      { key: "hall-chest", kind: "chest", i: 2, j: 9 },
    ],
  });
}

// ----------------------------------------------------------------------------- Granny Hua's cottage
function buildCottage(): InteriorDef {
  const m = room(8, 7, "wood", [[4, 0], [0, 4]]);
  m.rect(5, 4, 7, 6, "rug");
  return interior({
    key: "cottage",
    name: "Granny Hua's Cottage",
    hanzi: "华婆小屋",
    subtitle: "Herbs drying in the rafters, a loom by the hearth",
    map: m,
    door: toWorld("village", 13, 3),
    inward: [-1, 0],
    exit: [8, 3],
    props: [
      P("hearth", 1, 1),
      P("herbrack", 3, 1),
      P("swordrack", 5, 1),
      P("bed", 6, 1),
      P("shelfX", 1, 3),
      P("scrollX", 1, 5),
      P("loom", 3, 5),
      P("table", 6, 5),
      P("cushion", 6, 6),
      P("vase", 1, 7),
      P("sacks", 8, 7),
    ],
    npcs: [{ key: "lu", char: "weaver", i: 3, j: 4, dir: 0, anim: "weave" }],
    interacts: [
      { key: "cottage-sword", kind: "sign", i: 5, j: 1, text: "A sheathed sword wrapped in faded azure silk, the sect's cloud crest still stitched on the hilt. Beneath it a cup of tea has been poured and left to go cold — fresh, by the smell of it, this very morning." },
      { key: "cottage-shelf", kind: "sign", i: 1, j: 3, text: "Jars of dried herbs, each labelled in a careful hand: snow lotus, ginseng, fox-ear moss, “for Mei's cough”, and one marked only “for when he comes home”." },
      { key: "cottage-herbs", kind: "herb", i: 7, j: 2 },
    ],
  });
}

// ----------------------------------------------------------------------------- the crossroads teahouse
function buildTeahouse(): InteriorDef {
  const m = room(10, 8, "wood", [[3, 0], [7, 0], [0, 4]]);
  return interior({
    key: "teahouse",
    name: "Crossroads Teahouse",
    hanzi: "茶馆",
    subtitle: "Every road in the jianghu passes Fang's door",
    map: m,
    door: [145, 172],
    inward: [0, -1],
    exit: [5, 8],
    props: [
      P("hearth", 1, 1),
      P("shelf", 4, 1),
      P("shelf", 5, 1),
      P("scroll", 6, 1),
      P("screen", 9, 1),
      P("candle", 2, 1),
      P("shelfX", 1, 3),
      P("table", 3, 4),
      P("cushion", 2, 4),
      P("table", 7, 4),
      P("cushion", 7, 3),
      P("table", 3, 7),
      P("cushion", 8, 6),
      P("vase", 1, 8),
      P("candle", 10, 5),
    ],
    npcs: [
      { key: "qiao", char: "storyteller", i: 8, j: 6, dir: 14, anim: "tell" },
      { key: "gu", char: "scholar", i: 2, j: 4, dir: 4, anim: "read" },
    ],
    interacts: [
      { key: "tea-menu", kind: "sign", i: 5, j: 1, text: "Painted on a board above the tea jars: Cloud-mist green — 2 coppers. Fox-ear oolong — 3 coppers. Snow lotus white — “ask Fang”. Below, in fresher ink: “Cultivators pay in stories.”" },
      { key: "tea-wall", kind: "sign", i: 1, j: 3, text: "Travellers have carved their names into the post: a Blood Moon crescent scratched out with a knife, “Xiao Han was here (undefeated)”, and, very small, “Bai owes Fang 21 coppers”." },
    ],
  });
}

// ----------------------------------------------------------------------------- the watermill
function buildMill(): InteriorDef {
  const m = room(9, 8, "wood", [[5, 0], [0, 3]]);
  return interior({
    key: "mill",
    name: "Watermill",
    hanzi: "水磨坊",
    subtitle: "Stones turning to the creek's own rhythm",
    map: m,
    door: [236, 108],
    inward: [-1, 0],
    exit: [9, 4],
    props: [
      P("millstone", 4, 3),
      P("sacks", 1, 1),
      P("sacks", 2, 1),
      P("sacks", 1, 2),
      P("herbrack", 7, 1),
      P("sacks", 8, 2),
      P("haystack", 1, 7),
      P("vase", 4, 8),
      P("candle", 9, 1),
      P("table", 7, 6),
      P("shelfX", 1, 5),
    ],
    npcs: [{ key: "dou", char: "millhand", i: 6, j: 5, dir: 2, anim: "sweep" }],
    interacts: [
      { key: "mill-stone", kind: "sign", i: 5, j: 4, text: "The great stones grind with a sound like distant thunder. Scratched into the shaft, a row of tally marks — one for every year the wheel has turned. The fortieth mark is circled twice." },
      { key: "mill-chest", kind: "chest", i: 8, j: 8 },
    ],
  });
}

// ----------------------------------------------------------------------------- the Pagoda of Seven Lamps
function buildPagoda(): InteriorDef {
  const m = room(8, 8, "plaza", [[4, 0], [0, 4]]);
  m.rect(3, 3, 6, 6, "rug");
  return interior({
    key: "pagoda",
    name: "Pagoda of Seven Lamps",
    hanzi: "七灯塔",
    subtitle: "Seven flames for seven farmers who never came home",
    map: m,
    door: [192, 203],
    inward: [-1, 0],
    exit: [8, 4],
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

const BUILDERS: Record<InteriorId, () => InteriorDef> = { hall: buildHall, cottage: buildCottage, teahouse: buildTeahouse, mill: buildMill, pagoda: buildPagoda };
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
  return INTERIOR_IDS.map((id) => {
    const d = getInterior(id);
    return { key: `door-${id}`, kind: "door", i: d.door[0], j: d.door[1], to: id };
  });
}
