import type { AnimId, HumanId } from "../art/characters";
import type { PropId } from "../art/props";

/**
 * The town and the city, twice the size they were.
 *
 * Jinhe has grown past its old walls: a new wall stands a ring further out,
 * the old wall's line is a lane, and the new quarters between are built up
 * in storeys (shophouses with balconies over the street, a three-storey
 * restaurant, a drum tower, a salt commissioner's mansion). Willow Creek has
 * spilled east across its market road into an East Ward below the creek, with
 * its own two-storey street, an inn, the Liu clan's hall and a drum tower.
 *
 * Kept free of the story's words: the folk's lines are in story/standing.ts.
 */

export interface Quarter {
  props: [PropId, number, number][];
  folk: { key: string; name: string; char: HumanId; at: [number, number]; dir: number; anim?: AnimId; wander?: number; route?: [number, number][] }[];
}

/** Jinhe's new quarters, between the old wall's line (now a lane) and the new walls (authoring grid). */
export const JINHE_QUARTERS: Quarter = {
  props: [
    // the north quarter: shophouses two storeys high along the new wall, and the drum tower
    ["townhouse", 204, 484],
    ["drumtower", 211, 484],
    ["townhouse", 215, 484],
    ["townhouse", 227, 484],
    ["townhouse", 231, 484],
    ["townhouse", 235, 484],
    ["townhouse", 239, 484],
    // the west quarter: the Pavilion of Nine Fragrances, three storeys over the lane, and more shophouses
    ["townhouse", 203, 489],
    ["towerinn", 204, 495],
    ["townhouse", 203, 504],
    ["townhouse", 203, 509],
    // the east quarter: a long two-storey mansion and the guild row
    ["townhouse", 239, 489],
    ["townhouse", 239, 494],
    ["townhouse", 239, 504],
    ["townhouse", 239, 509],
    // the south quarter: the salt commissioner's mansion and the dyers' row
    ["townhouse", 204, 515],
    ["townhouse", 208, 515],
    ["townhouse", 212, 515],
    ["mansion", 226, 515],
    ["townhouse", 233, 515],
    ["townhouse", 238, 515],
    // the lanes between: lanterns, a well, stalls, a sedan chair waiting, a dyer's lines
    ["redlantern", 207, 488],
    ["redlantern", 237, 488],
    ["redlantern", 207, 512],
    ["redlantern", 237, 512],
    ["well", 218, 486],
    ["stall", 225, 486],
    ["stall", 206, 497],
    ["sedan", 207, 502],
    ["laundry", 216, 517],
    ["barrels", 237, 498],
    ["shopflag", 237, 502],
    ["bench", 219, 516],
  ],
  folk: [
    { key: "jx-teahost", name: "Host Qian of the Nine Fragrances", char: "cook", at: [207, 493], dir: 4, anim: "hawk" },
    { key: "jx-poet", name: "Poet Shu Ye", char: "scholar", at: [207, 498], dir: 4, anim: "toast" },
    { key: "jx-saltlord", name: "Salt Commissioner Gong", char: "nobleM", at: [228, 513], dir: 0, anim: "fan" },
    { key: "jx-saltlady", name: "Lady Gong", char: "nobleF", at: [230, 513], dir: 0, anim: "lean" },
    { key: "jx-bearer1", name: "Bearer Da Niu", char: "bearer", at: [207, 504], dir: 4, anim: "yawn" },
    { key: "jx-bearer2", name: "Bearer Er Niu", char: "bearer", at: [206, 505], dir: 4, anim: "bear" },
    { key: "jx-drummer", name: "Drum-Keeper Lao Bai", char: "drummer", at: [213, 486], dir: 2, anim: "drum" },
    { key: "jx-dyer", name: "Dyer Ruan", char: "villagerF", at: [216, 514], dir: 0, anim: "gather" },
    { key: "jx-guild", name: "Guildmaster Pu of the Grain Guild", char: "merchant", at: [237, 494], dir: 12, anim: "abacus" },
    { key: "jx-clerk2", name: "Guild Clerk Tan", char: "scholar", at: [237, 491], dir: 12, anim: "stamp" },
    { key: "jx-haggler", name: "Auntie Fu the Haggler", char: "villagerF", at: [226, 487], dir: 2, anim: "haggle" },
    { key: "jx-stallman", name: "Stallholder Yuan", char: "peddler", at: [224, 487], dir: 2, anim: "haggle" },
    { key: "jx-gossipA", name: "Old Mother Lin", char: "villagerF", at: [209, 491], dir: 6, anim: "whisper" },
    { key: "jx-gossipB", name: "Old Mother Kang", char: "teawoman", at: [210, 492], dir: 10, anim: "whisper" },
    { key: "jx-beggar2", name: "Blind Feng", char: "refugeeM", at: [222, 516], dir: 8, anim: "beg" },
    { key: "jx-watch", name: "Night-Watchman Ou", char: "guard", at: [236, 507], dir: 12, route: [[236.5, 490.5], [236.5, 510.5]] },
    { key: "jx-lantern", name: "Lantern-Lighter Xiaoyu", char: "boy", at: [208, 510], dir: 8, anim: "lantern", route: [[208.5, 489.5], [208.5, 511.5]] },
    { key: "jx-scribe", name: "Letter-Writer Hu", char: "storyteller", at: [218, 513], dir: 0, anim: "write" },
    { key: "jx-cultivator", name: "Wandering Cultivator Mo Lan", char: "swordsman", at: [233, 487], dir: 2, anim: "practice" },
    { key: "jx-sectgirl", name: "Disciple Yun Xi of the Golden Pavilion", char: "discipleF", at: [234, 513], dir: 0, anim: "salute" },
    { key: "jx-porter2", name: "Porter Sang", char: "porter", at: [220, 486], dir: 4, anim: "carry", route: [[203.5, 487.5], [240.5, 487.5]] },
    { key: "jx-mother", name: "Widow Xu and her Baby", char: "refugeeF", at: [211, 513], dir: 0, anim: "kneel" },
    { key: "jx-kid", name: "Little Bao of the South Lane", char: "child", at: [214, 513], dir: 2, anim: "kite" },
    { key: "jx-balcony", name: "Miss Lan on the Balcony", char: "lady", at: [206, 489], dir: 4, anim: "lean" },
    { key: "jx-matchmaker", name: "Matchmaker Zhu", char: "matchmaker", at: [232, 499], dir: 4, anim: "whisper" },
    { key: "jx-herbboy", name: "Herb-Runner Gao", char: "villagerM", at: [238, 487], dir: 6, anim: "carry" },
  ],
};

/** Willow Creek's East Ward, below the creek and east of the market road (authoring grid). */
export const EAST_WARD = { x0: 210, y0: 128, x1: 248, y1: 160, street: 144 };

export const WILLOW_WARD: Quarter = {
  props: [
    // the ward's two-storey street, both sides
    ["townhouse", 213, 139],
    ["townhouse", 217, 139],
    ["townhouse", 221, 139],
    ["towerinn", 230, 139],
    ["townhouse", 237, 139],
    ["townhouse", 241, 139],
    ["townhouse", 213, 147],
    ["mansion", 218, 147],
    ["townhouse", 227, 147],
    ["drumtower", 234, 149],
    ["townhouse", 240, 147],
    // the back lanes: cottages, a pond, and the paddies
    ["house", 213, 131],
    ["house", 219, 131],
    ["house", 225, 131],
    ["house", 241, 131],
    ["house", 214, 154],
    ["house", 220, 154],
    ["house", 241, 154],
    ["well", 224, 143],
    ["stall", 228, 143],
    ["stall", 215, 143],
    ["noodlecart", 238, 143],
    ["redlantern", 211, 143],
    ["redlantern", 245, 143],
    ["lanterns", 224, 145],
    ["willow", 233, 131],
    ["willow", 246, 152],
    ["cherry", 227, 155],
    ["laundry", 236, 134],
    ["haystack", 232, 157],
    ["sedan", 233, 143],
    ["bench", 220, 143],
  ],
  folk: [
    { key: "ew-innkeep", name: "Innkeeper Ma of the Willow Inn", char: "cook", at: [232, 143], dir: 8, anim: "hawk" },
    { key: "ew-liu", name: "Elder Liu of the Liu Clan", char: "nobleM", at: [220, 151], dir: 8, anim: "fan" },
    { key: "ew-liuwife", name: "Madam Liu", char: "nobleF", at: [222, 151], dir: 8, anim: "lean" },
    { key: "ew-drum", name: "Drum-Keeper Old Gou", char: "drummer", at: [236, 145], dir: 6, anim: "drum" },
    { key: "ew-tailor", name: "Tailor Pan", char: "weaver", at: [214, 143], dir: 8, anim: "weave" },
    { key: "ew-baker", name: "Sesame-Cake Seller Hong", char: "villagerF", at: [216, 145], dir: 2, anim: "hawk" },
    { key: "ew-scholar", name: "Tutor Wei", char: "scholar", at: [226, 145], dir: 2, anim: "read" },
    { key: "ew-pupil1", name: "Pupil Ah Fu", char: "boy", at: [227, 144], dir: 10, anim: "nod" },
    { key: "ew-pupil2", name: "Pupil Lingling", char: "child", at: [225, 144], dir: 10, anim: "clap" },
    { key: "ew-gossip1", name: "Auntie Song", char: "villagerF", at: [222, 135], dir: 2, anim: "whisper" },
    { key: "ew-gossip2", name: "Auntie Ren", char: "teawoman", at: [223, 136], dir: 10, anim: "whisper" },
    { key: "ew-farmer", name: "Farmer Qiao", char: "farmer", at: [229, 156], dir: 2, anim: "hoe" },
    { key: "ew-carter", name: "Carter Lu", char: "porter", at: [218, 144], dir: 4, anim: "carry", route: [[211.5, 144.5], [246.5, 144.5]] },
    { key: "ew-bearer", name: "Bearer Shuang", char: "bearer", at: [234, 142], dir: 4, anim: "yawn" },
    { key: "ew-lady", name: "Young Mistress Liu Qin", char: "lady", at: [218, 143], dir: 2, anim: "umbrella", wander: 1.2 },
    { key: "ew-toaster", name: "Merchant Gu at the Inn", char: "merchant", at: [229, 142], dir: 8, anim: "toast" },
    { key: "ew-traveller", name: "A Traveller from Jinhe", char: "swordsman", at: [231, 145], dir: 6, anim: "toast" },
    { key: "ew-watch", name: "Ward-Watchman Dong", char: "guard", at: [244, 145], dir: 12, route: [[211.5, 145.5], [246.5, 145.5]] },
    { key: "ew-kid", name: "Little Shou", char: "boy", at: [238, 136], dir: 4, anim: "kite" },
    { key: "ew-weigher", name: "Rice-Weigher Old Jia", char: "merchant", at: [240, 143], dir: 8, anim: "weigh" },
    { key: "ew-widow", name: "Grandmother Tian", char: "refugeeF", at: [242, 136], dir: 4, anim: "sit" },
    { key: "ew-courier", name: "Courier Fei", char: "scout", at: [212, 135], dir: 4, anim: "stretch" },
  ],
};
