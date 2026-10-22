"use client";

import { useRef } from "react";
import { drawBackground, drawForeground, getScene, SCENE_IDS, SCREEN_H, SCREEN_W, type SceneId } from "@/game/scenes";
import { frameAt, getSprite, SPRITE_GROUPS, type SpriteId } from "@/game/sprites";
import { useCanvasLoop } from "./useCanvasLoop";

const SCALE = 3;

function AnimCanvas({ id, anim }: { id: SpriteId; anim: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sheet = getSprite(id);
  useCanvasLoop(
    ref,
    (s, t) => {
      const a = sheet.animations[anim];
      // non-looping animations replay with a short pause
      const dur = a.frames.length / a.fps;
      const time = a.loop ? t : t % (dur + 0.6);
      s.ctx.clearRect(0, 0, sheet.width, sheet.height);
      s.sprite(frameAt(a, time), 0, 0);
    },
    { fps: 30 },
  );
  return (
    <div className="anim" data-testid="anim">
      <canvas ref={ref} width={sheet.width} height={sheet.height} style={{ width: sheet.width * SCALE, height: sheet.height * SCALE }} />
      <span>
        {anim} · {sheet.animations[anim].frames.length}f
      </span>
    </div>
  );
}

function SceneCanvas({ id }: { id: SceneId }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const scene = getScene(id);
  useCanvasLoop(ref, (s, t) => {
    const cam = t * 30;
    drawBackground(scene, s, t, cam);
    drawForeground(scene, s, t, cam);
  });
  return (
    <figure className="scene-card panel" style={{ margin: 0 }} data-testid="scene">
      <canvas ref={ref} width={SCREEN_W} height={SCREEN_H} />
      <figcaption>
        <strong>{scene.name}</strong>
        <small>{scene.subtitle}</small>
      </figcaption>
    </figure>
  );
}

export function SpriteGallery() {
  return (
    <>
      {SPRITE_GROUPS.map((g) => (
        <section key={g.label}>
          <h2>{g.label}</h2>
          {g.ids.map((id) => {
            const sheet = getSprite(id);
            return (
              <article key={id} className="sheet panel" data-testid={`sheet-${id}`}>
                <header>
                  <strong>{sheet.name}</strong>
                  <em>{sheet.title}</em>
                  <p>{sheet.description}</p>
                </header>
                <div className="anims">
                  {Object.keys(sheet.animations).map((a) => (
                    <AnimCanvas key={a} id={id} anim={a} />
                  ))}
                </div>
              </article>
            );
          })}
        </section>
      ))}
      <h2>Realms &amp; Backdrops</h2>
      <div className="scenes">
        {SCENE_IDS.map((id) => (
          <SceneCanvas key={id} id={id} />
        ))}
      </div>
    </>
  );
}
