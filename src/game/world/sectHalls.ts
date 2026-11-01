import { finishHall, HallBuilder, type Floor, type GrandHall } from "./grandhalls";

/**
 * The two grand halls of the sects, raised in the open world (see
 * world/grandhalls.ts for how a hall shows and hides its storeys):
 *
 *  - the Pavilion of Drifting Scriptures, the Azure Cloud Sect's library, on
 *    an isle of its own moored east of the sect: a lecture hall, the stacks,
 *    and the starwatch gallery under the roof;
 *  - the Hall of Ten Thousand Debates, outside the Ten Halls' south gate: a
 *    refectory, the debating floor, and the furnace loft where answers that
 *    will not fit in words are written as talismans.
 *
 * Each storey is a 26 × 24 or 28 × 24 floor (over 1,700 tiles of floor in
 * each hall, three storeys high), with its own folk at their own work, some
 * of them walking their rounds, and a quest that has to be chased up and down
 * the stairs after people who will not stand still.
 */

/** Facing directions (see runtime/world.ts dirFrom): toward the viewer, and along each axis. */
const D = { S: 14, E: 2, N: 6, W: 10, SE: 0, NE: 4, NW: 8, SW: 12 } as const;

export const PAVILION = { w: 26, h: 24 } as const;
export const DEBATES = { w: 28, h: 24 } as const;

// ----------------------------------------------------------------------------- the Pavilion of Drifting Scriptures
export function buildPavilion(mapW: number, i0: number, j0: number, z0: number): GrandHall {
  const b = new HallBuilder("cangjing", mapW, i0, j0, PAVILION.w, PAVILION.h, z0);
  const g = b.floor("marble");
  const s = b.floor("wood");
  const t = b.floor("wood");
  lectureHall(g);
  stacks(s);
  gallery(t);
  // up from the lecture hall at its east end, and from the stacks at their south-west corner
  g.stairUp(s, 21, 19, 0, -1);
  s.stairUp(t, 2, 19, 1, 0);
  return finishHall(b, {
    name: "Pavilion of Drifting Scriptures",
    hanzi: "藏经阁",
    subtitle: "The Azure Cloud Sect's library: three storeys of every word the founder left",
    storeys: ["Ground Floor · The Lecture Hall", "Second Floor · The Stacks", "Third Floor · The Starwatch Gallery"],
    door: [
      [12, 23],
      [13, 23],
    ],
    inward: [0, -1],
  });
}

function lectureHall(f: Floor): void {
  // a dais at the north end where the master reads, a rug down the middle, rows of cushions
  f.rect(9, 1, 16, 4, "rug", 1);
  f.rect(12, 5, 13, 22, "rug");
  f.props("shelf", [[2, 1], [3, 1], [4, 1], [5, 1], [6, 1], [19, 1], [20, 1], [21, 1], [22, 1], [23, 1]]);
  f.props("shelfX", [[1, 2], [1, 3], [1, 4], [1, 6], [1, 7], [1, 8], [1, 10], [1, 11], [1, 12], [1, 14], [1, 15], [1, 16]]);
  f.prop("scroll", 12, 1).prop("screen", 10, 1).prop("screen", 15, 1).prop("lampstand", 9, 2).prop("lampstand", 16, 2).prop("censer", 13, 1);
  f.prop("table", 12, 4);
  for (const v of [8, 10, 12, 14]) for (const u of [6, 8, 10, 15, 17, 19]) f.prop("cushion", u, v);
  f.props("lampstand", [[4, 9], [4, 15], [22, 9]]);
  f.props("vase", [[1, 21], [24, 21], [7, 1], [18, 1]]);
  // the librarian's desk by the door, and her ledgers
  f.prop("table", 6, 19).prop("table", 7, 19).prop("shelfX", 1, 19).prop("shelfX", 1, 20).prop("candle", 5, 19);
  f.prop("chest", 2, 22);
  f.npc("gh-lu", "Master Lu of the Scriptures", "wdherald", 12, 3, D.S, { anim: "lecture" });
  const seated: [string, string, "outerM" | "outerF" | "scholar" | "novice" | "monk", number, number, "read" | "write" | "chant" | "meditate" | "copy" | "recite"][] = [
    ["gh-cj-a", "A Disciple Taking Notes", "scholar", 6, 8, "write"],
    ["gh-cj-b", "A Disciple Reading Ahead", "outerF", 8, 10, "read"],
    ["gh-cj-c", "A Novice Chanting Along", "novice", 10, 8, "chant"],
    ["gh-cj-d", "A Disciple Dozing (Officially Meditating)", "monk", 17, 10, "meditate"],
    ["gh-cj-e", "A Disciple Copying the Lecture", "scholar", 15, 12, "copy"],
    ["gh-cj-f", "A Disciple Reciting Under Her Breath", "outerF", 19, 14, "recite"],
    ["gh-cj-g", "A Late Arrival, Still Reading", "outerM", 8, 14, "read"],
  ];
  for (const [key, name, char, u, v, anim] of seated) f.npc(key, name, char, u, v, D.N, { anim });
  f.npc("gh-wen", "Librarian Wen Su", "archivist", 7, 18, D.S, { anim: "read" });
  // folk on their rounds: a sweeper, the tea girl along the rows, and the first of the three borrowers
  f.npc("gh-sweep", "A Novice With a Broom", "novice", 3, 21, D.E, { route: [[3, 21], [10, 21], [10, 17], [3, 17]] });
  f.npc("gh-tea", "The Pavilion's Tea Girl", "teawoman", 11, 7, D.S, { route: [[11, 7], [11, 16], [14, 16], [14, 7]] });
  f.npc("gh-borrow1", "Disciple Hao, Who Borrowed a Scroll", "outerM", 23, 3, D.S, { route: [[23, 3], [23, 12], [20, 12], [20, 6], [23, 6]] });
  f.thing({ key: "cj-dais", kind: "sign", u: 12, v: 2, anim: "read", text: "The lectern scroll, left open at today's passage: “Words are a raft. Cross the river on them; do not carry them up the mountain on your back.” In the margin, in a disciple's hand: “Then why are there THREE FLOORS of them?”" });
  f.thing({ key: "cj-rules", kind: "sign", u: 1, v: 19, text: "The rules of the Pavilion, in Librarian Wen's square hand: “1. No fire on the second floor. 2. No sword qi on any floor. 3. Scrolls go back where they came from. 4. Disciple Hao, this means you. 5. The third floor is for meditation. Snoring is not meditation.”" });
  f.thing({ key: "cj-founder", kind: "sign", u: 22, v: 1, anim: "read", text: "A shelf of the founder's own notebooks, bound in grey silk. The first is a shopping list: “Ink, rice, a better teapot.” The last is a single line: “The sect is the people in it. The buildings are only where they keep the rain off.”" });
  f.thing({ key: "cj-chest", kind: "chest", u: 2, v: 22 });
}

function stacks(f: Floor): void {
  // six long stacks of shelves, an aisle down the middle, reading tables along the windows
  for (const v of [3, 6, 9, 12, 15]) {
    for (let u = 4; u <= 10; u++) f.prop("shelf", u, v);
    for (let u = 14; u <= 19; u++) f.prop("shelf", u, v);
  }
  f.props("shelfX", [[1, 3], [1, 4], [1, 5], [1, 7], [1, 8], [1, 9], [1, 11], [1, 12], [1, 13], [1, 15]]);
  f.props("table", [[23, 3], [23, 6], [23, 9], [6, 17], [8, 17]]);
  f.props("cushion", [[22, 3], [22, 6], [22, 9], [6, 18], [8, 18]]);
  f.props("lampstand", [[12, 2], [3, 22], [24, 12]]);
  f.props("vase", [[24, 1], [3, 1], [11, 22], [17, 22]]);
  f.prop("scroll", 7, 1).prop("scroll", 16, 1).prop("chest", 13, 21);
  f.npc("gh-copy1", "A Copyist of the Scriptures", "scholar", 22, 3, D.E, { anim: "copy" });
  f.npc("gh-copy2", "A Copyist Who Has Lost Her Place", "outerF", 22, 6, D.E, { anim: "read" });
  f.npc("gh-ink", "A Disciple Grinding Ink", "outerM", 22, 9, D.E, { anim: "inkgrind" });
  f.npc("gh-shelver", "Keeper of the Stacks", "archivist", 11, 7, D.W, { anim: "shelve" });
  f.npc("gh-reader", "A Senior Brother Reading Standing Up", "scholar", 11, 13, D.N, { anim: "read" });
  f.npc("gh-duster", "A Disciple With a Duster", "outerF", 20, 14, D.N, { anim: "dust" });
  f.npc("gh-study1", "A Disciple Studying for the Grand Selection", "outerM", 6, 18, D.N, { anim: "write" });
  f.npc("gh-study2", "Her Study Partner, Asleep", "outerF", 8, 18, D.N, { anim: "sleep" });
  f.npc("gh-runner", "A Scroll Runner", "outerM", 12, 4, D.S, { route: [[12, 4], [12, 17], [13, 17], [13, 4]] });
  f.npc("gh-borrow2", "Disciple Ruo, Who Borrowed a Scroll", "outerF", 3, 16, D.E, { route: [[3, 16], [11, 16], [11, 2], [3, 2]] });
  f.thing({ key: "cj-stack", kind: "sign", u: 4, v: 4, anim: "shelve", text: "Shelf four, row nine: Commentaries on the Commentaries on the Sutra of Still Water. Someone has slipped a pressed lotus between volumes two and three. Someone else has written “WHO” on a slip of paper and left it beside the lotus." });
  f.thing({ key: "cj-window", kind: "sign", u: 24, v: 6, text: "From the second-floor lattice you can see across the sky to the sect: the Hall of Clouds, the bridges, the disciples crossing them like ants with swords. Below the isle there is nothing at all, a very long way down." });
  f.thing({ key: "cj-chest2", kind: "chest", u: 13, v: 21 });
}

function gallery(f: Floor): void {
  // a rug from end to end, ten lamps for the ten Daos, cushions for anyone who has come up to sit
  f.rect(3, 3, 22, 20, "rug");
  f.props("statue", [[2, 1], [23, 1]]);
  f.prop("altar", 12, 1).prop("censer", 12, 3).prop("tenlamps", 16, 2).prop("prayerwheel", 8, 2).prop("bell", 20, 3);
  f.props("cushion", [[6, 7], [9, 7], [12, 7], [15, 7], [18, 7], [6, 12], [9, 12], [15, 12], [18, 12]]);
  f.props("lampstand", [[3, 15], [22, 15], [3, 4], [22, 8]]);
  f.props("scrollX", [[1, 5], [1, 9], [1, 13]]);
  f.props("vase", [[1, 21], [24, 21], [24, 3]]);
  f.prop("chest", 24, 18);
  f.npc("gh-xi", "Elder Xi of the Starwatch", "monk", 12, 9, D.S, { anim: "meditate" });
  f.npc("gh-sit1", "A Disciple Breathing With the Stars", "outerF", 6, 7, D.N, { anim: "meditate" });
  f.npc("gh-sit2", "A Novice Pretending to Breathe With the Stars", "novice", 9, 7, D.N, { anim: "pray" });
  f.npc("gh-sit3", "A Disciple of the Sword Yard, Very Still", "monk", 18, 12, D.N, { anim: "meditate" });
  f.npc("gh-sit4", "An Old Scholar, Stargazing Indoors", "scholar", 15, 12, D.NE, { anim: "stargaze" });
  f.npc("gh-bell", "The Bell Keeper", "outerM", 19, 4, D.E, { anim: "pray" });
  f.npc("gh-borrow3", "Senior Sister Lianyi, Who Borrowed a Scroll", "discipleF", 21, 18, D.W, { route: [[21, 18], [10, 18], [10, 15], [21, 15]] });
  f.thing({ key: "cj-altar", kind: "sign", u: 12, v: 1, anim: "pray", text: "The altar of the Starwatch Gallery: no tablet, only a bronze armillary sphere with the stars of the founder's birth night picked out in jade. One of them has been polished brighter than the rest by a great many thumbs." });
  f.thing({ key: "cj-sealed", kind: "sign", u: 1, v: 9, text: "A sealed case of sutras under nine talismans. The label says “Not yet”. Beneath it, newer: “Not yet” again, in Elder Mo's hand. Beneath that, in a child's: “When?”" });
  f.thing({ key: "cj-chest3", kind: "chest", u: 24, v: 18 });
}

// ----------------------------------------------------------------------------- the Hall of Ten Thousand Debates
export function buildDebates(mapW: number, i0: number, j0: number, z0: number): GrandHall {
  const b = new HallBuilder("wanlun", mapW, i0, j0, DEBATES.w, DEBATES.h, z0);
  const g = b.floor("wood");
  const s = b.floor("marble");
  const t = b.floor("wood");
  refectory(g);
  debateFloor(s);
  furnaceLoft(t);
  g.stairUp(s, 24, 20, 0, -1);
  s.stairUp(t, 3, 20, 0, -1);
  return finishHall(b, {
    name: "Hall of Ten Thousand Debates",
    hanzi: "万论堂",
    subtitle: "Where the Ten Halls eat, argue, and write down what they could not say",
    storeys: ["Ground Floor · The Refectory", "Second Floor · The Debating Floor", "Third Floor · The Furnace Loft"],
    door: [
      [27, 11],
      [27, 12],
    ],
    inward: [-1, 0],
  });
}

function refectory(f: Floor): void {
  // the kitchen along the north wall, three long tables, and a serving hatch
  f.props("hearth", [[3, 1], [7, 1], [11, 1]]);
  f.props("steamer", [[5, 1], [9, 1]]);
  f.prop("cauldron", 14, 2).prop("barrels", 17, 1).prop("barrels", 18, 1).prop("sacks", 20, 1).prop("sacks", 21, 1).prop("sacks", 1, 3);
  f.wallAlongU(4, 1, 16, [8, 9]);
  for (const v of [8, 12, 16]) {
    for (let u = 5; u <= 19; u++) if (u !== 12) f.prop("table", u, v);
    for (const u of [5, 7, 9, 11, 14, 16, 18]) {
      f.prop("cushion", u, v - 1);
      f.prop("cushion", u, v + 1);
    }
  }
  f.props("lampstand", [[2, 10], [2, 18], [22, 6]]);
  f.props("vase", [[26, 1], [1, 22], [26, 22]]);
  f.prop("banner", 24, 1).prop("missionboard", 23, 2).prop("chest", 1, 21);
  f.npc("gh-pang", "Cook Pang the Younger", "cook", 9, 2, D.S, { anim: "stir" });
  f.npc("gh-cook2", "A Cook at the Steamers", "cook", 5, 2, D.S, { anim: "pour" });
  f.npc("gh-cook3", "A Kitchen Hand Stirring Congee", "cook", 13, 2, D.E, { anim: "stir" });
  const eaters: [string, string, "outerM" | "outerF" | "scholar" | "monk" | "novice", number, number, number, "eat" | "talk" | "read" | "debate" | "laugh" | "drink"][] = [
    ["gh-eat1", "An Outer Disciple at Supper", "outerM", 5, 7, D.S, "eat"],
    ["gh-eat2", "An Outer Disciple, Talking With Her Mouth Full", "outerF", 7, 9, D.N, "eat"],
    ["gh-eat3", "A Disciple Arguing Over Dumplings", "outerM", 9, 7, D.S, "debate"],
    ["gh-eat4", "A Scholar Reading at Table", "scholar", 14, 9, D.N, "read"],
    ["gh-eat5", "A Disciple Laughing at Someone Else's Joke", "outerF", 16, 11, D.S, "laugh"],
    ["gh-eat6", "A Monk Eating Very Slowly", "monk", 18, 13, D.N, "eat"],
    ["gh-eat7", "A Novice With Two Bowls", "novice", 7, 15, D.S, "eat"],
    ["gh-eat8", "A Disciple Losing an Argument", "outerM", 11, 17, D.N, "debate"],
    ["gh-eat9", "A Scholar Drinking Tea Instead", "scholar", 16, 17, D.N, "drink"],
  ];
  for (const [key, name, char, u, v, dir, anim] of eaters) f.npc(key, name, char, u, v, dir, { anim });
  f.npc("gh-pan", "Steward Pan of the Refectory", "steward", 22, 11, D.W, { anim: "think" });
  f.npc("gh-serve1", "A Server With a Tray", "cook", 12, 6, D.S, { route: [[12, 6], [12, 18], [20, 18], [20, 6]] });
  f.npc("gh-serve2", "A Server Collecting Bowls", "outerF", 4, 6, D.S, { route: [[4, 6], [4, 19], [12, 19], [12, 10]] });
  f.npc("gh-mop", "A Disciple Mopping, Again", "outerM", 3, 21, D.E, { route: [[3, 21], [21, 21], [21, 19], [3, 19]] });
  f.thing({ key: "wl-board", kind: "sign", u: 23, v: 2, text: "The refectory board: “Today: congee, pickles, steamed buns. Tomorrow: steamed buns, pickles, congee. Questions about the menu may be taken upstairs and debated. They will lose.”" });
  f.thing({ key: "wl-kitchen", kind: "sign", u: 3, v: 1, text: "Cook Pang the Younger's hearth. Chalked on the bricks: “My father fed the Azure Cloud Sect for forty years. I feed the Ten Halls. Ten thousand Daos and every one of them hungry.”" });
  f.thing({ key: "wl-chest", kind: "chest", u: 1, v: 21 });
}

function debateFloor(f: Floor): void {
  // a ring of cushions round a marble floor, a gong to start and a drum to stop, and benches for those who only listen
  f.rect(9, 6, 18, 15, "rug");
  for (const [u, v] of [[9, 6], [13, 5], [18, 6], [19, 10], [18, 15], [13, 16], [9, 15], [8, 10]] as [number, number][]) f.prop("cushion", u, v);
  f.prop("gong", 13, 2).prop("drum", 16, 2).prop("daostele", 10, 2).prop("banner", 22, 1).prop("banner", 5, 1);
  f.props("table", [[23, 5], [23, 9], [23, 13]]);
  f.props("cushion", [[24, 5], [24, 9], [24, 13]]);
  f.props("shelfX", [[1, 4], [1, 5], [1, 6], [1, 8], [1, 9], [1, 10], [1, 12]]);
  f.props("lampstand", [[7, 3], [20, 3], [7, 18], [20, 18]]);
  f.props("vase", [[26, 1], [1, 1], [26, 21]]);
  f.prop("xiangqitable", 16, 21).prop("chest", 26, 16);
  f.npc("gh-arb", "Arbiter Sun of the Ten Halls", "envoy", 13, 4, D.S, { anim: "nod" });
  f.npc("gh-deb1", "A Debater of the Hall of Water", "outerF", 9, 7, D.SE, { anim: "debate" });
  f.npc("gh-deb2", "A Debater of the Hall of Fire", "outerM", 18, 7, D.SW, { anim: "debate" });
  f.npc("gh-deb3", "A Debater Who Has Changed Sides Twice", "scholar", 18, 14, D.NW, { anim: "think" });
  f.npc("gh-deb4", "A Debater Who Will Not Stop Pointing", "outerM", 9, 14, D.NE, { anim: "point" });
  f.npc("gh-note", "A Clerk Writing Down Every Word", "scholar", 24, 9, D.W, { anim: "write" });
  f.npc("gh-gong", "The Gong Keeper", "novice", 14, 3, D.S, { anim: "bow" });
  f.npc("gh-watch1", "A Spectator, Clapping in the Wrong Places", "outerF", 24, 13, D.W, { anim: "clap" });
  f.npc("gh-xq1", "Two Disciples at Xiangqi (the One Winning)", "scholar", 15, 21, D.E, { anim: "xiangqi" });
  f.npc("gh-ji", "Debater Ji, Who Argues Walking", "wdherald", 6, 8, D.S, { route: [[6, 8], [6, 17], [21, 17], [21, 4], [6, 4]] });
  f.npc("gh-pace", "A Disciple Pacing Out Her Argument", "outerF", 8, 19, D.E, { route: [[8, 19], [14, 19], [14, 20], [8, 20]] });
  f.thing({ key: "wl-stele", kind: "sign", u: 10, v: 2, anim: "read", text: "The debating stele, carved with the one rule of the floor: “Whoever loses must say the winner's argument back, better than it was said.” Underneath, a tally of the Arbiter's own debates: won 312, lost 1. The one is circled." });
  f.thing({ key: "wl-gong", kind: "sign", u: 13, v: 2, text: "The debating gong, struck once to begin and once to end. A crack runs across it. The story is that a debater from the Hall of Thunder once ended an argument with it. The story does not say which side." });
  f.thing({ key: "wl-chest2", kind: "chest", u: 26, v: 16 });
}

function furnaceLoft(f: Floor): void {
  // the furnace in the middle, herb racks round it, and long tables for the talisman writers
  f.prop("furnace", 13, 10).prop("cauldron", 9, 10).prop("cauldron", 17, 10);
  f.props("herbrack", [[3, 1], [5, 1], [7, 1], [19, 1], [21, 1], [23, 1]]);
  f.props("table", [[8, 15], [9, 15], [10, 15], [16, 15], [17, 15], [18, 15]]);
  f.props("cushion", [[8, 16], [10, 16], [16, 16], [18, 16]]);
  f.props("sacks", [[25, 3], [25, 4], [1, 8]]);
  f.props("shelfX", [[1, 10], [1, 11], [1, 12]]);
  f.props("lampstand", [[6, 6], [21, 6], [24, 20]]);
  f.props("vase", [[26, 1], [26, 22]]);
  f.prop("chest", 26, 11);
  f.npc("gh-rong", "Furnace Master Rong", "hmfire", 13, 13, D.N, { route: [[13, 13], [20, 13], [20, 7], [6, 7], [6, 13]] });
  f.npc("gh-fan", "A Disciple Fanning the Furnace", "outerM", 13, 8, D.S, { anim: "fanfire" });
  f.npc("gh-stir", "A Disciple Stirring a Cauldron", "outerF", 9, 9, D.S, { anim: "stir" });
  f.npc("gh-stir2", "A Disciple Stirring the Other Cauldron", "outerM", 17, 9, D.S, { anim: "stir" });
  f.npc("gh-tal1", "A Talisman Writer", "scholar", 8, 16, D.N, { anim: "copy" });
  f.npc("gh-tal2", "A Talisman Writer Blowing on the Ink", "outerF", 10, 16, D.N, { anim: "write" });
  f.npc("gh-tal3", "A Talisman Writer Grinding Ink", "outerM", 16, 16, D.N, { anim: "inkgrind" });
  f.npc("gh-herb", "A Herbalist From the Hall of Life", "herbalist", 4, 3, D.N, { anim: "brew" });
  f.npc("gh-carry", "A Porter of Herbs", "outerM", 24, 6, D.W, { route: [[24, 6], [24, 18], [12, 18], [12, 19], [24, 19]] });
  f.thing({ key: "wl-furnace", kind: "sign", u: 13, v: 10, text: "The furnace of the loft, banked low. A brass plate on its door: “For answers that will not go into words. Write the question on a talisman, burn it, and read the smoke.” Somebody has scratched underneath: “It always says ‘eat something’.”" });
  f.thing({ key: "wl-talisman", kind: "sign", u: 9, v: 15, anim: "read", text: "A talisman drying on the table, the ink still wet: the character for “enough”, written ten thousand times so small that together they make the character for “more”." });
  f.thing({ key: "wl-chest3", kind: "chest", u: 26, v: 11 });
}
