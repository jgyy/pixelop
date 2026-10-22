"use client";

import { useEffect, useRef, type RefObject } from "react";
import { CanvasSurface } from "@/game/runtime/CanvasSurface";

/**
 * Drive a requestAnimationFrame loop that paints into a canvas via a Surface.
 * The draw callback is kept in a ref so re-renders don't restart the loop.
 */
export function useCanvasLoop(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  draw: (surface: CanvasSurface, t: number, dt: number) => void,
  opts: { fps?: number } = {},
): void {
  const drawRef = useRef(draw);
  useEffect(() => {
    drawRef.current = draw;
  });
  const fps = opts.fps ?? 60;
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
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < step * 0.95) return;
      drawRef.current(surface, (now - start) / 1000, acc);
      acc = 0;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, fps]);
}
