import { propDef, type PropId } from "../art/props";
import { seasonVertex } from "../art/seasons";
import type { Season } from "../world/calendar";
import { MeshRaster, type Geometry } from "./meshRaster";

/** Props that bend in the wind: their vertices sway more the higher they stand. */
const SWAYS = new Set<PropId>(["pine", "cherry", "maple", "bamboo", "willow", "spirittree", "reeds", "tallgrass", "peachtree", "palm", "snowpine", "teabush", "banner", "prayerflags", "laundry", "phoenixbanner", "wolfbanner", "warbanner", "shopflag", "lotus", "herbbed"]);

/** Whether a prop's leaves or cloth move with the wind (the 3D view sways them rather than flipping frames). */
export const sways = (id: PropId) => SWAYS.has(id);

const cache = new Map<string, Geometry>();

/**
 * A prop's 3D model: the same solids its sprite is painted from, recorded as
 * triangles (one model per animation frame that is asked for), coloured for
 * the season, with sway weights for the wind.
 */
export function propModel(id: PropId, frame = 0, season: Season | null = null): Geometry {
  const key = `${id}/${frame}/${season ?? ""}`;
  let g = cache.get(key);
  if (g) return g;
  if (season) {
    const base = propModel(id, frame, null);
    const colors = base.colors.slice();
    for (let v = 0; v < colors.length / 4; v++) {
      const [r, gg, b] = seasonVertex([colors[v * 4] * 255, colors[v * 4 + 1] * 255, colors[v * 4 + 2] * 255], id, season, base.normals[v * 3 + 1], base.positions[v * 3] * 16, base.positions[v * 3 + 2] * 16);
      colors[v * 4] = r / 255;
      colors[v * 4 + 1] = gg / 255;
      colors[v * 4 + 2] = b / 255;
    }
    g = { ...base, colors };
  } else {
    const def = propDef(id);
    const r = new MeshRaster();
    def.paint(r, Math.min(frame, def.frames - 1), def.frames);
    g = r.geo;
    if (SWAYS.has(id)) {
      let top = 0;
      for (let v = 1; v < g.positions.length; v += 3) top = Math.max(top, g.positions[v]);
      for (let v = 0; v < g.colors.length / 4; v++) g.colors[v * 4 + 3] = Math.pow(Math.max(0, g.positions[v * 3 + 1]) / Math.max(0.1, top), 1.5);
    }
  }
  cache.set(key, g);
  return g;
}

/** Height of a prop's model above its footing, in tiles. */
export function propHeight(id: PropId): number {
  const p = propModel(id).positions;
  let top = 0;
  for (let v = 1; v < p.length; v += 3) top = Math.max(top, p[v]);
  return top;
}
