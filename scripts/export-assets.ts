/**
 * Export the procedural art as PNG stills and animated GIF showcases into
 * docs/art (used by the README and PR). Run: `npm run assets [outDir]`
 * (add `--overview` for the picture of the whole world, `--quick` for short loops).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { PixelBuffer } from "../src/game/pixel/PixelBuffer";
import { drawText, textWidth } from "../src/game/pixel/font";
import { BufferSurface } from "../src/game/pixel/surface";
import { BEAST_IDS, charDef, DIRS, frameAt, getAnim, getPortrait, HUMAN_IDS, OUTFITS, PORTRAIT, type AnimId, type CharId, type HumanId } from "../src/game/art/characters";
import { getProp, PROP_IDS, type PropId } from "../src/game/art/props";
import { World } from "../src/game/runtime/world";
import { WorldMap } from "../src/game/runtime/worldmap";
import { renderTitle } from "../src/game/runtime/title";
import { AREA_IDS, getArea } from "../src/game/world/areas";
import { getWorld } from "../src/game/world/continent";
import { getInterior, INTERIOR_IDS } from "../src/game/world/interiors";
import { CAVE_IDS, getCave } from "../src/game/world/caves";
import { toWorld, WORLD_H, WORLD_SCALE, WORLD_W } from "../src/game/world/layout";
import { isoX, isoY } from "../src/game/iso/projection";
import { writePng } from "./lib";
import { Game } from "../src/game/runtime/Game";
import { newGame } from "../src/game/engine/state";
import { SEASONS } from "../src/game/world/calendar";

const OUT = path.resolve(process.argv[2] ?? "docs/art");
const QUICK = process.argv.includes("--quick");
/** The picture of the whole world paints every one of its million tiles, so it is only made when asked for. */
const OVERVIEW = process.argv.includes("--overview");
mkdirSync(OUT, { recursive: true });
const BG = "#2a2048";
const CELL_BG = "#241a40";

function writeGif(file: string, frames: PixelBuffer[], fps: number): void {
  const gif = GIFEncoder();
  for (const f of frames) {
    const palette = quantize(f.data, 256);
    gif.writeFrame(applyPalette(f.data, palette), f.width, f.height, { palette, delay: Math.round(1000 / fps) });
  }
  gif.finish();
  writeFileSync(path.join(OUT, file), gif.bytes());
}

interface Cell {
  id: CharId;
  anim: AnimId;
  dir: number | "spin";
  label: string;
  outfit?: string;
}

/** Grid of labelled animation cells, all playing in sync. */
function showcase(cells: Cell[], cols: number, scale: number, seconds: number, fps = 12): PixelBuffer[] {
  const cw = Math.max(...cells.map((c) => charDef(c.id).w)) + 4;
  const ch = Math.max(...cells.map((c) => charDef(c.id).h)) + 10;
  const rows = Math.ceil(cells.length / cols);
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < seconds * fps; i++) {
    const t = i / fps;
    const buf = new PixelBuffer(cols * cw, rows * ch);
    buf.fill(BG);
    const s = new BufferSurface(buf);
    cells.forEach((c, k) => {
      const def = charDef(c.id);
      const dir = c.dir === "spin" ? Math.floor(t * 4) % DIRS : c.dir;
      const a = getAnim(c.id, c.anim, dir, c.outfit);
      const dur = a.frames.length / a.fps;
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * ch;
      buf.rect(x + 1, y + 1, cw - 2, ch - 2, CELL_BG);
      buf.blit(frameAt(a, a.loop ? t : t % (dur + 0.5)), x + (cw - def.w) / 2, y + 2 + (ch - 10 - def.h));
      const label = c.label.toUpperCase();
      drawText(s, label, x + (cw - textWidth(label)) / 2, y + ch - 7, "#f2c55c");
    });
    frames.push(buf.scaled(scale));
  }
  return frames;
}

const seconds = QUICK ? 1 : 4;

// 1. Characters
const heroAnims = charDef("heroine").anims.map((anim): Cell => ({ id: "heroine", anim, dir: 2, label: anim }));
writeGif("heroine-moves.gif", showcase(heroAnims, 6, 2, seconds), 12);
const turntable = Array.from({ length: DIRS }, (_, d): Cell => ({ id: "heroine", anim: "walk", dir: d, label: `dir ${d}` }));
writeGif("heroine-16dir.gif", showcase(turntable, 8, 2, QUICK ? 1 : 2), 12);
const cast = HUMAN_IDS.filter((id) => id !== "heroine").map((id): Cell => ({ id, anim: charDef(id).anims.includes("walk") ? "walk" : charDef(id).anims.includes("hop") ? "hop" : "idle", dir: "spin", label: charDef(id).name.split(" ").pop()! }));
writeGif("cast.gif", showcase(cast, 7, 2, seconds), 12);
const bestiary = BEAST_IDS.flatMap((id) => charDef(id).anims.filter((a) => a !== "walk").map((anim): Cell => ({ id, anim, dir: 2, label: `${id} ${anim}` })));
writeGif("bestiary.gif", showcase(bestiary, 6, 2, seconds), 12);
// the folk at home and at work: the newer everyday animations
const chores: [CharId, AnimId][] = [
  ["weaver", "weave"],
  ["storyteller", "tell"],
  ["archivist", "read"],
  ["lampkeeper", "pray"],
  ["millhand", "sweep"],
  ["scholar", "sit"],
  ["teawoman", "pour"],
  ["hua", "pour"],
  ["child", "clap"],
  ["zhou", "laugh"],
  ["peddler", "clap"],
  ["monk", "pray"],
];
writeGif("folk-at-work.gif", showcase(chores.map(([id, anim]): Cell => ({ id, anim, dir: 1, label: anim })), 6, 2, seconds), 12);
// the branching tale's gestures: offering the Heart, weighing a choice, a shrug, tears, rising to heaven, a roar of stolen power and a vow on a planted sword
const turning: [CharId, AnimId, string?][] = [
  ["heroine", "offer"],
  ["heroine", "think"],
  ["heroine", "shrug"],
  ["heroine", "cry"],
  ["heroine", "levitate"],
  ["heroine", "roar", "bloodmoon"],
  ["heroine", "plantsword"],
  ["elder", "think"],
  ["elder", "cry"],
  ["patriarch", "kowtow"],
  ["patriarch", "offer"],
  ["patriarch", "sweep", "redeemed"],
  ["hua", "cry"],
  ["zhou", "shrug"],
  ["huli", "offer"],
  ["smith", "plantsword"],
  ["villagerF", "think"],
  ["abao", "shrug"],
];
writeGif("turning-gestures.gif", showcase(turning.map(([id, anim, outfit]): Cell => ({ id, anim, dir: 1, label: anim, outfit })), 6, 2, seconds), 12);
// where she began, and what the tale made of her: two beginnings' clothes, five the main quest's choices weave, a teacher's robe and two shapes
const forms = ["homespun", "acolyte", "xuerobe", "lotusqueen", "bloodmoon", "guardian", "teacher", "foxform", "dragonform"];
writeGif("forms.gif", showcase(forms.map((outfit): Cell => ({ id: "heroine", anim: "walk", dir: "spin", label: outfit, outfit })), 5, 2, seconds), 12);
// the newest idles: a tune on the dizi, a bowl of noodles, juggling and a folding fan
const pastimes: [CharId, AnimId][] = [
  ["heroine", "flute"],
  ["hermit", "flute"],
  ["swordsman", "flute"],
  ["farmer", "eat"],
  ["millhand", "eat"],
  ["bandit", "eat"],
  ["child", "juggle"],
  ["peddler", "juggle"],
  ["abao", "juggle"],
  ["zhou", "fan"],
  ["scholar", "fan"],
  ["storyteller", "fan"],
];
writeGif("pastimes.gif", showcase(pastimes.map(([id, anim]): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()} ${anim}` })), 6, 2, seconds), 12);
// Cloudmane, the spirit horse, and the wild herds
const steeds: Cell[] = [
  ...charDef("rider").anims.map((anim): Cell => ({ id: "rider", anim, dir: 2, label: `ride ${anim}` })),
  { id: "rider", anim: "run", dir: "spin", label: "16 directions" },
  ...charDef("horse").anims.map((anim): Cell => ({ id: "horse", anim, dir: 14, label: `wild ${anim}` })),
];
writeGif("cloudmane.gif", showcase(steeds, 5, 2, seconds), 12);
// Lin Yue's wardrobe, twirling, and Willow Creek in its festival best
const wardrobe: Cell[] = [
  { id: "heroine", anim: "twirl", dir: 2, label: "jade" },
  ...Object.keys(OUTFITS.heroine!).map((o): Cell => ({ id: "heroine", anim: "twirl", dir: 2, label: o, outfit: o })),
  { id: "rider", anim: "run", dir: 2, label: "ride mail", outfit: "mail" },
  ...(Object.keys(OUTFITS) as HumanId[]).filter((id) => id !== "heroine").map((id): Cell => ({ id, anim: charDef(id).anims.includes("lantern") ? "lantern" : "idle", dir: 1, label: `${charDef(id).name.split(" ").pop()!.normalize("NFD").replace(/[\u0300-\u036f]/g, "")} fest`, outfit: "festival" })),
];
writeGif("attire.gif", showcase(wardrobe, 7, 2, seconds), 12);
// the newest animations: a salute, a twirl, the smith's hammer, the brush, a drifting shade, a festival lantern
const newest: [CharId, AnimId][] = [
  ["heroine", "salute"],
  ["discipleM", "salute"],
  ["swordsman", "salute"],
  ["huli", "twirl"],
  ["child", "twirl"],
  ["smith", "hammer"],
  ["heroine", "write"],
  ["scholar", "write"],
  ["ghost", "float"],
  ["ghost", "write"],
  ["zhou", "lantern"],
  ["orchardist", "gather"],
];
writeGif("new-moves.gif", showcase(newest.map(([id, anim]): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()} ${anim}`, outfit: anim === "lantern" ? "festival" : undefined })), 6, 2, seconds), 12);
// the doubled world's work and play: hoeing, chopping, the carrying pole, shuttlecock, the paper umbrella and taiji
const jianghu: [CharId, AnimId][] = [
  ["farmer", "hoe"],
  ["villagerM", "hoe"],
  ["woodcutter", "chop"],
  ["porter", "carry"],
  ["teapicker", "carry"],
  ["boy", "kick"],
  ["heroine", "kick"],
  ["lady", "umbrella"],
  ["heroine", "umbrella"],
  ["taiji", "taichi"],
  ["abbot", "taichi"],
  ["heroine", "taichi"],
];
writeGif("jianghu-moves.gif", showcase(jianghu.map(([id, anim]): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()} ${anim}` })), 6, 2, seconds), 12);

// the deep and the three sects: the pick, the torch, the brew, a fire palm, a kowtow, a sword dance and cowering
const deep: [CharId, AnimId][] = [
  ["miner", "mine"],
  ["villagerM", "mine"],
  ["heroine", "torch"],
  ["phoenix", "torch"],
  ["baizhi", "brew"],
  ["poisoner", "brew"],
  ["yanhuo", "flame"],
  ["heroine", "flame"],
  ["heroine", "kowtow"],
  ["herbalist", "kowtow"],
  ["lingfeng", "sworddance"],
  ["heroine", "sworddance"],
  ["miner", "cower"],
  ["dragon", "float"],
  ["emberwyrm", "attack"],
  ["stonehound", "run"],
  ["swordsea", "practice"],
  ["heroine", "idle"],
];
writeGif("deep-moves.gif", showcase(deep.map(([id, anim], k): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()!.replace("'", "")} ${anim}`, outfit: k === 17 ? "phoenix" : undefined })), 6, 2, seconds), 12);

// the turning year: work and play through the seasons, and what the folk do after dark
const yearly: [CharId, AnimId, string?][] = [
  ["heroine", "plant"],
  ["farmer", "plant"],
  ["child", "kite"],
  ["heroine", "kite"],
  ["villagerF", "rake"],
  ["heroine", "rake"],
  ["heroine", "sweep"],
  ["boy", "snowball"],
  ["heroine", "snowball"],
  ["novice", "shiver", "winter"],
  ["heroine", "warmhands", "wintersnow"],
  ["guard", "warmhands", "winter"],
  ["porter", "yawn"],
  ["heroine", "yawn"],
  ["discipleF", "stargaze"],
  ["heroine", "stargaze"],
  ["farmer", "umbrella", "winter"],
  ["guard", "lantern"],
];
writeGif("year-moves.gif", showcase(yearly.map(([id, anim, outfit]): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()} ${anim}`, outfit })), 6, 2, seconds), 12);
// the almanac master and the four wardens of the year, and the folk in their winter wool
const wardens: Cell[] = [
  { id: "almanac", anim: "read", dir: 1, label: "Almanac Shi" },
  { id: "springWarden", anim: "float", dir: 1, label: "Qingming" },
  { id: "summerWarden", anim: "float", dir: 1, label: "Xiazhi" },
  { id: "autumnWarden", anim: "float", dir: 1, label: "Shuangjiang" },
  { id: "winterWarden", anim: "float", dir: 1, label: "Dongzhi" },
  ...(["springblossom", "summerlotus", "autumnmaple", "wintersnow", "fourseasons", "ranger", "nightheron", "scholar", "moonrabbit", "empress"] as const).map((o): Cell => ({ id: "heroine", anim: "twirl", dir: 2, label: o, outfit: o })),
  ...(["zhou", "hua", "villagerM", "villagerF", "monk", "child"] as HumanId[]).map((id): Cell => ({ id, anim: "idle", dir: 1, label: `${charDef(id).name.split(" ").pop()} wool`, outfit: "winter" })),
];
writeGif("wardens.gif", showcase(wardens, 7, 2, seconds), 12);
// the War of the Iron Banner: the Northern Army at work, the horde in arms, and what the war makes of her
const war: [CharId, AnimId, string?][] = [
  ["general", "banner"],
  ["general", "horn"],
  ["soldier", "march"],
  ["soldier", "spear"],
  ["soldier", "shieldwall"],
  ["drummer", "drum"],
  ["medic", "bandage"],
  ["quartermaster", "write"],
  ["scout", "look"],
  ["deserter", "plantsword"],
  ["envoy", "fan"],
  ["widow", "grieve"],
  ["refugeeF", "cower"],
  ["refugeeM", "grieve"],
  ["raider", "march"],
  ["ironguard", "attack"],
  ["bannerman", "roar"],
  ["warcaptain", "roar"],
  ["ironmarshal", "spear"],
  ["shaman", "cast"],
  ["tuoba", "roar"],
  ["heroine", "rally", "lamellar"],
  ["heroine", "banner", "bannergeneral"],
  ["heroine", "bandage", "bodhisattva"],
  ["heroine", "grieve", "taijisage"],
  ["heroine", "horn", "swordsaint"],
  ["heroine", "roar", "asura"],
];
writeGif("war-moves.gif", showcase(war.map(([id, anim, outfit]): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()} ${anim}`, outfit })), 7, 2, seconds), 12);
// the Founder's Road and the Tidewater Reach: the street folk at play, the Road's people, and what comprehension makes of her
const road: [CharId, AnimId, string?][] = [
  ["liondancer", "liondance"],
  ["liondancer", "drum"],
  ["acrobat", "acrobat"],
  ["acrobat", "juggle"],
  ["storyteller", "puppet"],
  ["merchant", "abacus"],
  ["merchant", "hawk"],
  ["villagerM", "firecracker"],
  ["scholar", "xiangqi"],
  ["boatwoman", "row"],
  ["cook", "hawk"],
  ["child", "firecracker"],
  ["keeper", "read"],
  ["keeper", "comprehend"],
  ["kongming", "levitate"],
  ["kongming", "domain"],
  ["hollow", "attack"],
  ["hollowsage", "cast"],
  ["echoWater", "levitate"],
  ["echoFire", "attack"],
  ["echoThunder", "cast"],
  ["echoIce", "levitate"],
  ["echoLife", "cast"],
  ["heroine", "comprehend"],
  ["heroine", "domain"],
  ["heroine", "comprehend", "pilgrim"],
  ["heroine", "domain", "clearsnow"],
  ["heroine", "liondance", "daomantle"],
];
writeGif("road-moves.gif", showcase(road.map(([id, anim, outfit]): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()} ${anim}`, outfit })), 7, 2, seconds), 12);
// the Ten Halls: the hopefuls at the gate, an outer disciple's days, Room Seven after curfew, the hall masters and the halls' troubles
const halls: [CharId, AnimId, string?][] = [
  ["heroine", "tiptoe"],
  ["heroine", "climb"],
  ["heroine", "pant"],
  ["heroine", "token", "outerrobe"],
  ["heroine", "spar", "outerrobe"],
  ["heroine", "scrub", "outerrobe"],
  ["heroine", "bucket", "outerrobe"],
  ["heroine", "pillow", "innerrobe"],
  ["heroine", "comprehend", "tenhalls"],
  ["shenbai", "pant"],
  ["yaozhi", "fan"],
  ["tieniu", "carry"],
  ["meilan", "write"],
  ["qiu", "pillow"],
  ["murong", "spar"],
  ["steward", "sweep"],
  ["yanshu", "write"],
  ["hmwater", "lecture"],
  ["hmwind", "acrobat"],
  ["hmfire", "brew"],
  ["hmearth", "carry"],
  ["hmmetal", "hammer"],
  ["hmthunder", "lecture"],
  ["hmice", "read"],
  ["hmlife", "bandage"],
  ["ning", "levitate"],
  ["outerM", "scrub"],
  ["outerF", "bucket"],
  ["blight", "attack"],
  ["furnacespirit", "flame"],
  ["golem", "roar"],
  ["enforcer", "attack"],
  ["frostwarden", "levitate"],
  ["murongelder", "cast"],
  ["yanshu", "cast"],
];
writeGif("halls-moves.gif", showcase(halls.map(([id, anim, outfit]): Cell => ({ id, anim, dir: 1, label: `${charDef(id).name.split(" ").pop()} ${anim}`, outfit })), 7, 2, seconds), 12);


// 2. Portraits
const portraitIds = HUMAN_IDS.filter((id) => charDef(id).portrait);
const pb = new PixelBuffer(portraitIds.length * (PORTRAIT + 4), PORTRAIT + 4);
pb.fill(BG);
portraitIds.forEach((id, i) => {
  pb.rect(i * (PORTRAIT + 4) + 2, 2, PORTRAIT, PORTRAIT, CELL_BG);
  pb.blit(getPortrait(id)[0], i * (PORTRAIT + 4) + 2, 2);
});
writePng(pb.scaled(2), path.join(OUT, "portraits.png"));

// 3. Props
{
  const sheets = PROP_IDS.map((id) => ({ id, sheet: getProp(id) }));
  const cols = 8;
  const cw = 132;
  const ch = 140;
  const rows = Math.ceil(sheets.length / cols);
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    const t = i / 10;
    const buf = new PixelBuffer(cols * cw, rows * ch);
    buf.fill(BG);
    const s = new BufferSurface(buf);
    sheets.forEach(({ id, sheet }, k) => {
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * ch;
      buf.rect(x + 1, y + 1, cw - 2, ch - 2, CELL_BG);
      const fr = sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length];
      const k2 = fr.width > cw - 4 || fr.height > ch - 14 ? 0.5 : 1;
      const img = k2 < 1 ? half(fr) : fr;
      buf.blit(img, x + cw / 2 - sheet.ox * k2, y + ch - 14 - Math.max(0, img.height - sheet.oy * k2) - sheet.oy * k2 + Math.min(0, 0));
      const label = id.toUpperCase();
      drawText(s, label, x + (cw - textWidth(label)) / 2, y + ch - 9, "#f2c55c");
    });
    frames.push(buf);
  }
  writeGif("props.gif", frames, 10);
}
// the Road's steles and the Tidewater Reach's street life, on their own
{
  const ids: PropId[] = ["daostele", "eatenstele", "qiwhirl", "sampan", "steamer", "xiangqitable", "puppetbooth", "pinwheels", "firecrackers", "skylanterns", "prayerwheel", "saltpan"];
  const cols = 6;
  const cw = 132;
  const ch = 140;
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    const t = i / 10;
    const buf = new PixelBuffer(cols * cw, Math.ceil(ids.length / cols) * ch);
    buf.fill(BG);
    const s = new BufferSurface(buf);
    ids.forEach((id, k) => {
      const sheet = getProp(id);
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * ch;
      buf.rect(x + 1, y + 1, cw - 2, ch - 2, CELL_BG);
      const fr = sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length];
      buf.blit(fr, x + cw / 2 - sheet.ox, y + ch - 14 - Math.max(0, fr.height - sheet.oy) - sheet.oy);
      drawText(s, id.toUpperCase(), x + (cw - textWidth(id.toUpperCase())) / 2, y + ch - 9, "#f2c55c");
    });
    frames.push(buf);
  }
  writeGif("road-props.gif", frames, 10);
}
// the Ten Halls' court and Room Seven
{
  const ids: PropId[] = ["affinitystone", "tenlamps", "voiddoor", "gong", "missionboard", "bunkbed"];
  const cols = 6;
  const cw = 132;
  const ch = 140;
  const frames: PixelBuffer[] = [];
  for (let i = 0; i < seconds * 10; i++) {
    const t = i / 10;
    const buf = new PixelBuffer(cols * cw, Math.ceil(ids.length / cols) * ch);
    buf.fill(BG);
    const s = new BufferSurface(buf);
    ids.forEach((id, k) => {
      const sheet = getProp(id);
      const x = (k % cols) * cw;
      const y = Math.floor(k / cols) * ch;
      buf.rect(x + 1, y + 1, cw - 2, ch - 2, CELL_BG);
      const fr = sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length];
      buf.blit(fr, x + cw / 2 - sheet.ox, y + ch - 14 - Math.max(0, fr.height - sheet.oy) - sheet.oy);
      drawText(s, id.toUpperCase(), x + (cw - textWidth(id.toUpperCase())) / 2, y + ch - 9, "#f2c55c");
    });
    frames.push(buf);
  }
  writeGif("halls-props.gif", frames, 10);
}

function half(b: PixelBuffer): PixelBuffer {
  const out = new PixelBuffer(Math.ceil(b.width / 2), Math.ceil(b.height / 2));
  for (let y = 0; y < out.height; y++)
    for (let x = 0; x < out.width; x++) {
      const i = (y * 2 * b.width + x * 2) * 4;
      out.data.set(b.data.subarray(i, i + 4), (y * out.width + x) * 4);
    }
  return out;
}

// 4. Regions of the one continuous world (stills + panning loops)
const W = 480;
const H = 270;
const FLAGS = { metElder: true, foxesCleared: true, metWen: true };
for (const id of AREA_IDS) {
  const area = getArea(id);
  const world = new World(getWorld(), { x: toWorld(id, ...area.arrive)[0], y: toWorld(id, ...area.arrive)[1] - 6, dir: 8 }, FLAGS, []);
  const frame = (t: number) => {
    const b = new PixelBuffer(W, H);
    world.update(1 / 12, t, true);
    const k = Math.sin(t * 0.25);
    const [fx, fy] = toWorld(id, area.map.w / 2 + k * 3, area.map.h / 2 - k * 2);
    world.updateCamera(W, H, 0, [fx, fy, 2]);
    world.render(new BufferSurface(b), t);
    return b;
  };
  writePng(frame(1.2).scaled(2), path.join(OUT, `area-${id}.png`));
  if (!QUICK) writeGif(`area-${id}.gif`, Array.from({ length: 36 }, (_, i) => frame(1 + i / 12)), 12);
}

// 4b. The whole jianghu in one picture, and a walk along the highway
if (!QUICK) {
  const world = new World(getWorld(), { x: 150.5 * WORLD_SCALE, y: 166.5 * WORLD_SCALE, dir: 4 }, FLAGS, []);
  world.dayNight = false;
  const left = isoX(0, WORLD_H) - 40;
  const right = isoX(WORLD_W, 0) + 40;
  const top = isoY(0, 0, 12) - 40;
  const bottom = isoY(WORLD_W, WORLD_H) + 120;
  // the whole world is far too big for one buffer: paint it a patch at a time and keep every 16th pixel
  if (OVERVIEW) {
    const K = 16;
    const CHUNK = 2048;
    const overview = new PixelBuffer(Math.ceil((right - left) / K), Math.ceil((bottom - top) / K));
    const patch = new PixelBuffer(CHUNK, CHUNK);
    // one sky for every patch: the village's
    world.envPoint = toWorld("village", 16, 16);
    world.backdrop = "#8ab4e8";
    for (let y0 = 0; y0 < bottom - top; y0 += CHUNK)
      for (let x0 = 0; x0 < right - left; x0 += CHUNK) {
        patch.fill("#000000");
        world.camX = -left - x0;
        world.camY = -top - y0;
        world.render(new BufferSurface(patch), 2);
        for (let y = 0; y < CHUNK / K; y++)
          for (let x = 0; x < CHUNK / K; x++) {
            const ox = x0 / K + x;
            const oy = y0 / K + y;
            if (ox >= overview.width || oy >= overview.height) continue;
            const i = (y * K * CHUNK + x * K) * 4;
            overview.data.set(patch.data.subarray(i, i + 4), (oy * overview.width + ox) * 4);
          }
      }
    writePng(overview, path.join(OUT, "world-overview.png"));
    world.envPoint = null;
    world.backdrop = null;
  }

  const walk: PixelBuffer[] = [];
  for (let i = 0; i < 72; i++) {
    const t = 3 + i / 12;
    world.hero.x = 136 * WORLD_SCALE + i * 0.4;
    world.hero.y = 166.6 * WORLD_SCALE;
    world.hero.dir = 4;
    world.setAnim(world.hero, "run", 3);
    world.update(1 / 12, t, true);
    world.updateCamera(W, H, 0);
    const b = new PixelBuffer(W, H);
    world.render(new BufferSurface(b), t);
    walk.push(b);
  }
  writeGif("highway.gif", walk, 12);

  // and Cloudmane at a gallop down the same road, outrunning everything on it
  const ride: PixelBuffer[] = [];
  world.hero.char = "rider";
  for (let i = 0; i < 72; i++) {
    const t = 9 + i / 12;
    world.hero.x = 176 * WORLD_SCALE + i * (11 / 12);
    world.hero.y = 165.6 * WORLD_SCALE;
    world.hero.dir = 4;
    world.setAnim(world.hero, "run", 9);
    world.update(1 / 12, t, true);
    world.updateCamera(W, H, 0);
    const b = new PixelBuffer(W, H);
    world.render(new BufferSurface(b), t);
    ride.push(b);
  }
  writeGif("gallop.gif", ride, 12);
  world.hero.char = "heroine";
}

// 4c. The landmarks of the wilds, each a short loop (day, with the bandit camp after dark)
{
  const world = new World(getWorld(), { x: 150.5 * WORLD_SCALE, y: 174.5 * WORLD_SCALE, dir: 2 }, { ...FLAGS, metElder: true, metHuli: true }, []);
  for (const l of getWorld().landmarks) {
    world.placeHero(l.x + 2.5 * WORLD_SCALE, l.y + 3.5 * WORLD_SCALE, 10);
    const night = l.key === "bandits" || l.key === "pagoda" || l.key === "pavilion";
    const frames = Array.from({ length: QUICK ? 2 : 36 }, (_, i) => {
      const t = (night ? 170 : 30) + i / 12;
      world.update(1 / 12, t, true);
      world.updateCamera(W, H, 0, [l.x, l.y, 2]);
      const b = new PixelBuffer(W, H);
      world.render(new BufferSurface(b), t);
      return b;
    });
    writePng(frames[0].scaled(2), path.join(OUT, `site-${l.key}.png`));
    if (!QUICK) writeGif(`site-${l.key}.gif`, frames, 12);
  }
}

// 4d. The buildings she can walk into, each a short loop
for (const id of INTERIOR_IDS) {
  const def = { ...getInterior(id), id: "sect" as const };
  const world = new World(def, { x: def.arrive[0], y: def.arrive[1], dir: 10 }, FLAGS, []);
  const frames = Array.from({ length: QUICK ? 2 : 36 }, (_, i) => {
    const t = 30 + i / 12;
    world.update(1 / 12, t, true);
    world.updateCamera(W, H, 0, [def.map.w / 2, def.map.h / 2, 1]);
    const b = new PixelBuffer(W, H);
    world.render(new BufferSurface(b), t);
    return b;
  });
  writePng(frames[0].scaled(2), path.join(OUT, `room-${id}.png`));
  if (!QUICK) writeGif(`room-${id}.gif`, frames, 12);
}

// 4e. Underground: each cave, looking in from just inside its mouth (and the vein's heart)
for (const id of CAVE_IDS) {
  const def = { ...getCave(id), id: "sect" as const };
  const world = new World(def, { x: def.arrive[0], y: def.arrive[1], dir: 10 }, { ...FLAGS, phxMine: true, herbAsk: true, veinOpened: true }, []);
  world.hero.idleAnim = "torch";
  const focus: [number, number, number] = id === "vein" ? [17, 26, 7] : [def.arrive[0] - 10, def.arrive[1] - 3, 2];
  if (id === "vein") world.placeHero(18.5, 28.5, 12);
  const frames = Array.from({ length: QUICK ? 2 : 36 }, (_, i) => {
    const t = 30 + i / 12;
    world.update(1 / 12, t, true);
    world.updateCamera(W, H, 0, focus);
    const b = new PixelBuffer(W, H);
    world.render(new BufferSurface(b), t);
    return b;
  });
  writePng(frames[0].scaled(2), path.join(OUT, `cave-${id}.png`));
  if (!QUICK) writeGif(`cave-${id}.gif`, frames, 12);
}

// 4f. The year in Willow Creek's square: each season from noon through dusk to midnight and dawn
{
  const g = new Game({ ...newGame(), flags: { metElder: true } }, { seed: 7 });
  g.debugTeleport("village", 15, 13);
  const frames: PixelBuffer[] = [];
  const stills: PixelBuffer[] = [];
  for (const season of SEASONS)
    for (const k of [0.02, 0.27, 0.5, 0.76]) {
      g.debugSetTime(k, season);
      g.debugSkipTime(2.5, 1 / 6);
      for (let i = 0; i < (QUICK ? 1 : 6); i++) {
        g.debugSkipTime(1 / 12, 1 / 12);
        const b = new PixelBuffer(W, H);
        g.render(new BufferSurface(b));
        frames.push(b);
      }
      if (k === 0.02) stills.push(frames[frames.length - 1]);
    }
  const grid = new PixelBuffer(W * 2, H * 2);
  stills.forEach((b, i) => grid.blit(b, (i % 2) * W, Math.floor(i / 2) * H));
  writePng(grid, path.join(OUT, "seasons.png"));
  writeGif("seasons.gif", frames, 6);
}

// 5. World map
{
  const wm = new WorldMap("village");
  const frames: PixelBuffer[] = [];
  wm.travelTo("sect", () => true);
  for (let i = 0; i < (QUICK ? 6 : 60); i++) {
    const b = new PixelBuffer(W, H);
    wm.update(1 / 12);
    wm.render(new BufferSurface(b), i / 12, () => true, 1 / 12);
    frames.push(b);
  }
  writePng(frames[frames.length - 1].scaled(2), path.join(OUT, "worldmap.png"));
  writeGif("worldmap.gif", frames, 12);
}

// 6. Title attract mode
writeGif(
  "title.gif",
  Array.from({ length: QUICK ? 4 : 36 }, (_, i) => {
    const b = new PixelBuffer(W, H);
    renderTitle(new BufferSurface(b), 2 + i / 12);
    return b;
  }),
  12,
);

console.log(`Exported art to ${path.relative(process.cwd(), OUT) || "."}`);
