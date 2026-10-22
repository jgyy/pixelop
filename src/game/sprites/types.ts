import type { PixelBuffer } from "../pixel/PixelBuffer";

export interface Animation {
  fps: number;
  loop: boolean;
  frames: PixelBuffer[];
}

export interface SpriteSheet {
  id: string;
  name: string;
  /** Short epithet shown in the gallery. */
  title: string;
  description: string;
  width: number;
  height: number;
  animations: Record<string, Animation>;
}

/** Frame for a given elapsed time (seconds). Non-looping animations hold their last frame. */
export function frameAt(anim: Animation, seconds: number): PixelBuffer {
  const i = Math.floor(seconds * anim.fps);
  const idx = anim.loop ? ((i % anim.frames.length) + anim.frames.length) % anim.frames.length : Math.min(anim.frames.length - 1, Math.max(0, i));
  return anim.frames[idx];
}

export function animDuration(anim: Animation): number {
  return anim.frames.length / anim.fps;
}

/** Build animation frames from a list of poses using a painter. */
export function animate<P>(paint: (pose: P) => PixelBuffer, poses: P[], fps: number, loop = true): Animation {
  return { fps, loop, frames: poses.map(paint) };
}

export const TAU = Math.PI * 2;
