"use client";

import { useRef } from "react";
import { CHAR_IDS, charDef, DIRS, frameAt, getAnim, type AnimId, type CharId } from "@/game/art/characters";
import { getProp, PROP_IDS, type PropId } from "@/game/art/props";
import { World } from "@/game/runtime/world";
import { WorldMap } from "@/game/runtime/worldmap";
import { AREA_IDS, getArea, type AreaId } from "@/game/world/areas";
import { useCanvasLoop } from "./useCanvasLoop";

const SCALE = 3;

const GROUPS: { label: string; ids: CharId[] }[] = [
  { label: "Heroine", ids: ["heroine"] },
  { label: "Azure Cloud Sect", ids: ["elder", "qing", "abao", "discipleM", "discipleF"] },
  { label: "Willow Creek & the Wilds", ids: ["zhou", "hua", "farmer", "child", "huli", "wen"] },
  { label: "Blood Moon Sect & Demonic Beasts", ids: ["patriarch", "cultist", "jiangshi", "fox", "wolf", "serpent", "serpentKing", "crane", "bat"] },
];

function AnimCanvas({ id, anim, dir }: { id: CharId; anim: AnimId; dir: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const def = charDef(id);
  useCanvasLoop(
    ref,
    (s, t) => {
      const a = getAnim(id, anim, dir);
      const dur = a.frames.length / a.fps;
      s.ctx.clearRect(0, 0, def.w, def.h);
      s.sprite(frameAt(a, a.loop ? t : t % (dur + 0.6)), 0, 0);
    },
    { fps: 30 },
  );
  return (
    <div className="anim" data-testid="anim">
      <canvas ref={ref} width={def.w} height={def.h} style={{ width: def.w * SCALE, height: def.h * SCALE }} />
      <span>{anim}</span>
    </div>
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
    { fps: 30 },
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
    { fps: 20 },
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
    if (!world.current) world.current = new World(id, { x: area.arrive[0], y: area.arrive[1] - 7, dir: 8 }, { metElder: true, foxesCleared: true, metWen: true }, [], new Set());
    const w = world.current;
    w.update(1 / 60, t, true);
    const k = Math.sin(t * 0.15);
    w.updateCamera(s.width, s.height, 0, [area.map.w / 2 + k * 5, area.map.h / 2 - k * 4, 2]);
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
    </>
  );
}

export const GALLERY_CHARACTERS = CHAR_IDS.length;
