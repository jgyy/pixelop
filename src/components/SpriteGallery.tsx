"use client";

import { useRef } from "react";
import { CHAR_IDS, charDef, DIRS, frameAt, getAnim, OUTFITS, type AnimId, type CharId, type HumanId } from "@/game/art/characters";
import { getProp, PROP_IDS, type PropId } from "@/game/art/props";
import { World } from "@/game/runtime/world";
import { WorldMap } from "@/game/runtime/worldmap";
import { AREA_IDS, getArea, type AreaId } from "@/game/world/areas";
import { getWorld } from "@/game/world/continent";
import { INTERIOR_IDS } from "@/game/world/interiors";
import { CAVE_IDS } from "@/game/world/caves";
import { getRoom, type RoomId } from "@/game/world/rooms";
import { toWorld } from "@/game/world/layout";
import { useCanvasLoop } from "./useCanvasLoop";

const SCALE = 3;

const GROUPS: { label: string; ids: CharId[] }[] = [
  { label: "Heroine", ids: ["heroine"] },
  { label: "Azure Cloud Sect", ids: ["elder", "qing", "abao", "discipleM", "discipleF"] },
  { label: "Willow Creek & the Wilds", ids: ["zhou", "hua", "farmer", "child", "peddler", "huli", "wen"] },
  { label: "Wayside Folk", ids: ["teawoman", "miller", "monk", "hermit", "swordsman"] },
  { label: "Folk Indoors", ids: ["archivist", "weaver", "storyteller", "scholar", "millhand", "lampkeeper"] },
  { label: "The Sword Tomb, the Pavilion & the Orchard", ids: ["smith", "ghost", "orchardist"] },
  { label: "Cloudmane & the Wild Herds", ids: ["rider", "horse"] },
  { label: "The Three Sects & the Dragon Vein", ids: ["yanhuo", "phoenix", "miner", "baizhi", "herbalist", "poisoner", "lingfeng", "swordsea", "dragon"] },
  { label: "Beasts of the Deep", ids: ["emberwyrm", "stonehound", "frostfang", "rimewyrm", "dunewyrm", "pearlwyrm", "shadowvixen"] },
  { label: "Blood Moon Sect, Bandits & Demonic Beasts", ids: ["patriarch", "cultist", "jiangshi", "bandit", "fox", "wolf", "serpent", "serpentKing", "crane", "bat"] },
];
// everyone else who walks the jianghu (the gallery shows every character, even ones added without a group)
GROUPS.splice(GROUPS.length - 1, 0, { label: "Folk of the Wider Jianghu", ids: CHAR_IDS.filter((id) => !GROUPS.some((g) => g.ids.includes(id))) });

function AnimCanvas({ id, anim, dir, outfit, label }: { id: CharId; anim: AnimId; dir: number; outfit?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const def = charDef(id);
  useCanvasLoop(
    ref,
    (s, t) => {
      const a = getAnim(id, anim, dir, outfit);
      const dur = a.frames.length / a.fps;
      s.ctx.clearRect(0, 0, def.w, def.h);
      s.sprite(frameAt(a, a.loop ? t : t % (dur + 0.6)), 0, 0);
    },
    { fps: 30, lazy: true },
  );
  return (
    <div className="anim" data-testid="anim">
      <canvas ref={ref} width={def.w} height={def.h} style={{ width: def.w * SCALE, height: def.h * SCALE }} />
      <span>{label ?? anim}</span>
    </div>
  );
}

/** Every outfit in the jianghu: Lin Yue's wardrobe and Willow Creek's festival best. */
function Wardrobe() {
  const rows = Object.entries(OUTFITS) as [HumanId, Record<string, unknown>][];
  return (
    <article className="sheet panel" data-testid="sheet-attire">
      <header>
        <strong>Attire</strong>
        <em>Lin Yue&apos;s wardrobe (press C in game) and Willow Creek&apos;s festival best</em>
      </header>
      <div className="anims">
        <AnimCanvas id="heroine" anim="twirl" dir={2} label="jade" />
        {rows.flatMap(([id, outfits]) =>
          Object.keys(outfits).map((o) => <AnimCanvas key={`${id}/${o}`} id={id} anim={id === "heroine" ? "twirl" : charDef(id).anims.includes("lantern") ? "lantern" : "idle"} dir={2} outfit={o} label={id === "heroine" ? o : `${charDef(id).name.split(" ").pop()} · ${o}`} />),
        )}
        <AnimCanvas id="rider" anim="run" dir={2} outfit="mail" label="riding · mail" />
      </div>
    </article>
  );
}

/** The character turning through all 16 facings while walking. */
function Turntable({ id }: { id: CharId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const def = charDef(id);
  const anim: AnimId = def.anims.includes("walk") ? "walk" : def.anims.includes("hop") ? "hop" : def.anims.includes("fly") ? "fly" : "idle";
  useCanvasLoop(
    ref,
    (s, t) => {
      const dir = Math.floor(t * 2) % DIRS;
      s.ctx.clearRect(0, 0, def.w, def.h);
      s.sprite(frameAt(getAnim(id, anim, dir), t), 0, 0);
    },
    { fps: 30, lazy: true },
  );
  return (
    <div className="anim" data-testid="anim">
      <canvas ref={ref} width={def.w} height={def.h} style={{ width: def.w * SCALE, height: def.h * SCALE }} />
      <span>16 directions</span>
    </div>
  );
}

function PropCanvas({ id }: { id: PropId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sheet = getProp(id);
  const w = sheet.frames[0].width;
  const h = sheet.frames[0].height;
  useCanvasLoop(
    ref,
    (s, t) => {
      s.ctx.clearRect(0, 0, w, h);
      s.sprite(sheet.frames[Math.floor(t * sheet.fps) % sheet.frames.length], 0, 0);
    },
    { fps: 20, lazy: true },
  );
  const k = w > 100 ? 2 : 3;
  return (
    <div className="anim" data-testid="prop">
      <canvas ref={ref} width={w} height={h} style={{ width: w * k, height: h * k }} />
      <span>
        {id} · {sheet.frames.length}f
      </span>
    </div>
  );
}

function AreaCanvas({ id }: { id: AreaId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const area = getArea(id);
  useCanvasLoop(ref, (s, t) => {
    if (!world.current) {
      const [x, y] = toWorld(id, area.arrive[0], area.arrive[1] - 7);
      world.current = new World(getWorld(), { x, y, dir: 8 }, { metElder: true, foxesCleared: true, metWen: true }, []);
    }
    const w = world.current;
    w.update(1 / 60, t, true);
    const k = Math.sin(t * 0.15);
    const [fx, fy] = toWorld(id, area.map.w / 2 + k * 5, area.map.h / 2 - k * 4);
    w.updateCamera(s.width, s.height, 0, [fx, fy, 2]);
    w.render(s, t);
  });
  return (
    <figure className="scene-card panel" style={{ margin: 0 }} data-testid="scene">
      <canvas ref={ref} width={480} height={270} />
      <figcaption>
        <strong>
          {area.hanzi} · {area.name}
        </strong>
        <small>{area.subtitle}</small>
      </figcaption>
    </figure>
  );
}

function InteriorCanvas({ id }: { id: RoomId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const def = getRoom(id);
  useCanvasLoop(ref, (s, t) => {
    if (!world.current) world.current = new World(def, { x: def.arrive[0], y: def.arrive[1], dir: 10 }, { metElder: true }, []);
    const w = world.current;
    w.update(1 / 60, t, true);
    // a cave is far bigger than a room: look in from just inside its mouth
    const focus: [number, number, number] = w.cave ? [def.arrive[0] - 8 + Math.sin(t * 0.2) * 2, def.arrive[1] - 4, 2] : [def.map.w / 2 + Math.sin(t * 0.2), def.map.h / 2, 1];
    w.updateCamera(s.width, s.height, 0, focus);
    w.render(s, t + 30);
  });
  return (
    <figure className="scene-card panel" style={{ margin: 0 }} data-testid="scene">
      <canvas ref={ref} width={480} height={270} />
      <figcaption>
        <strong>
          {def.hanzi} · {def.name}
        </strong>
        <small>{def.subtitle}</small>
      </figcaption>
    </figure>
  );
}

function WorldMapCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);
  const wm = useRef<WorldMap | null>(null);
  useCanvasLoop(ref, (s, t) => {
    if (!wm.current) wm.current = new WorldMap("village");
    if (!wm.current.travelling) wm.current.travelTo(wm.current.at === "village" ? "sect" : "village", () => true);
    wm.current.update(1 / 60);
    wm.current.render(s, t, () => true, 1 / 60);
  });
  return (
    <figure className="scene-card panel" style={{ margin: 0 }} data-testid="scene">
      <canvas ref={ref} width={480} height={270} />
      <figcaption>
        <strong>江湖 · The World Map</strong>
        <small>Fly between regions along the roads; sealed lands open as the story unfolds.</small>
      </figcaption>
    </figure>
  );
}

export function SpriteGallery() {
  return (
    <>
      {GROUPS.map((g) => (
        <section key={g.label}>
          <h2>{g.label}</h2>
          {g.ids.map((id) => {
            const def = charDef(id);
            return (
              <article key={id} className="sheet panel" data-testid={`sheet-${id}`}>
                <header>
                  <strong>{def.name}</strong>
                  <em>{def.title}</em>
                </header>
                <div className="anims">
                  <Turntable id={id} />
                  {def.anims.map((a) => (
                    <AnimCanvas key={a} id={id} anim={a} dir={id === "heroine" || def.w > 60 ? 2 : 1} />
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ))}
      <h2>Attire</h2>
      <Wardrobe />
      <h2>World Props</h2>
      <div className="anims">
        {PROP_IDS.map((id) => (
          <PropCanvas key={id} id={id} />
        ))}
      </div>
      <h2>Regions &amp; the World Map</h2>
      <div className="scenes">
        {AREA_IDS.map((id) => (
          <AreaCanvas key={id} id={id} />
        ))}
        <WorldMapCanvas />
      </div>
      <h2>Indoors</h2>
      <div className="scenes">
        {INTERIOR_IDS.map((id) => (
          <InteriorCanvas key={id} id={id} />
        ))}
      </div>
      <h2>Underground</h2>
      <div className="scenes">
        {CAVE_IDS.map((id) => (
          <InteriorCanvas key={id} id={id} />
        ))}
      </div>
    </>
  );
}

export const GALLERY_CHARACTERS = CHAR_IDS.length;
