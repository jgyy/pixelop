import { buildChunk, windowMap, type MapWindow } from "./terrain";

/** Paints terrain chunks off the main thread: a window of the map in, geometry and a texture out. */
interface Job {
  id: number;
  ci: number;
  cj: number;
  win: MapWindow;
  base: number;
  floating: boolean;
  rocky: boolean;
  smooth: boolean;
}

self.onmessage = (e: MessageEvent<Job>) => {
  const { id, ci, cj, win, base, floating, rocky, smooth } = e.data;
  const map = windowMap(win);
  const chunk = buildChunk(map, ci, cj, { base, floating, rocky, smooth, season: map.season });
  (self as unknown as Worker).postMessage({ id, chunk }, [chunk.tex.buffer]);
};
