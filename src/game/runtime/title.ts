import { alpha } from "../pixel/color";
import { sRing, type Surface } from "../pixel/surface";
import { drawBackground, drawForeground, getScene, SCREEN_W, type SceneId } from "../scenes";
import { frameAt, getSprite } from "../sprites";

/** Attract-mode backdrop for the title screen: the heroine soars past on her sword. */
export function renderTitle(s: Surface, t: number, sceneId: SceneId = "sect"): void {
  const scene = getScene(sceneId);
  const cam = t * 24;
  drawBackground(scene, s, t, cam);
  const fly = getSprite("heroine").animations.fly;
  const loop = 9;
  const k = (t % loop) / loop;
  const x = -60 + k * (SCREEN_W + 120);
  const y = 96 + Math.sin(t * 1.4) * 10 - k * 20;
  for (let i = 1; i < 14; i++) {
    s.px(x + 8 - i * 4, y + 40 + Math.sin(t * 6 + i) * 1.5, alpha(i % 2 ? "#9ff5de" : "#ffffff", 0.8 - i * 0.05));
  }
  s.sprite(frameAt(fly, t), x - 24, y);
  sRing(s, x, y + 22, 3 + ((t * 8) % 10), alpha("#9ff5de", 0.3));
  drawForeground(scene, s, t, cam);
}
