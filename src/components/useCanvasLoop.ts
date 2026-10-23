"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CanvasSurface } from "@/game/runtime/CanvasSurface";

/** Pick an integer pixel scale so the low-res canvas covers the whole viewport (~480 game px across on desktop). */
export function pixelScale(w: number, h: number): number {
  return Math.max(2, Math.min(8, Math.round(Math.min(w / 480, h / 290))));
}

export interface LoopOptions {
  fps?: number;
  /** Resize the canvas every frame so it fills its parent at an integer pixel scale. */
  fit?: boolean;
}

/**
 * Drive a requestAnimationFrame loop that paints into a canvas via a Surface.
 * The draw callback is kept in a ref so re-renders don't restart the loop.
 * Returns a ref holding the current pixel scale (for pointer → canvas mapping).
 */
export function useCanvasLoop(canvasRef: RefObject<HTMLCanvasElement | null>, draw: (surface: CanvasSurface, t: number, dt: number) => void, opts: LoopOptions = {}): RefObject<number> {
  const drawRef = useRef(draw);
  const scaleRef = useRef(1);
  useEffect(() => {
    drawRef.current = draw;
  });
  const fps = opts.fps ?? 60;
  const fit = !!opts.fit;
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const surface = new CanvasSurface(ctx);
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const start = last;
    const step = 1 / fps;
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const w = parent.clientWidth || window.innerWidth;
      const h = parent.clientHeight || window.innerHeight;
      const scale = pixelScale(w, h);
      const cw = Math.ceil(w / scale);
      const ch = Math.ceil(h / scale);
      if (canvas.width !== cw || canvas.height !== ch || scaleRef.current !== scale) {
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.width = `${cw * scale}px`;
        canvas.style.height = `${ch * scale}px`;
        ctx.imageSmoothingEnabled = false;
        scaleRef.current = scale;
      }
    };
    if (fit) resize();
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < step * 0.95) return;
      if (fit) resize();
      drawRef.current(surface, (now - start) / 1000, acc);
      acc = 0;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, fps, fit]);
  return scaleRef;
}
