import type { PixelBuffer } from "../pixel/PixelBuffer";
import { facingBasis, Raster, type Mat, type Ramp, type V3 } from "../iso/raster";
import { OUTLINE, PAL, ramp, tones } from "./palette";

/**
 * Ships and cloud-ships as sprites: painted from ray-cast solids like the
 * people are, in all sixteen facings, so a junk under sail turns as it
 * changes tack. The bow points along the facing (model +y).
 */

export type VesselId = "junk" | "skiff" | "skyjunk";

/** Sprite canvas for each vessel (w, h, and the waterline/keel point ox, oy). */
export const VESSEL_BOX: Record<VesselId, { w: number; h: number; ox: number; oy: number; k: number }> = {
  junk: { w: 250, h: 236, ox: 125, oy: 182, k: 2.6 },
  skiff: { w: 120, h: 108, ox: 60, oy: 78, k: 1.8 },
  skyjunk: { w: 344, h: 298, ox: 172, oy: 234, k: 3.2 },
};

const TAU = Math.PI * 2;
const m = (r: Ramp, group: number, extra: Partial<Mat> = {}): Mat => ({ ramp: r, group, outline: OUTLINE, ...extra });
const HULL = ramp("#8a4a2a", { lo: "#2a0a10" });
const SAIL = ramp("#c06a3a", { lo: "#3a1420" });
const SAIL_WHITE = ramp("#f4ead8", { lo: "#7a6a7a" });
const CLOUD = tones("#ffffff", "#eef6ff", "#c4d8f0", "#8aa4cc");

/** A battened junk sail: a panel of matting between its battens, billowing with the wind. */
function sail(r: Raster, x: number, y: number, z0: number, z1: number, half: number, billow: number, ramp0: Ramp, group: number): void {
  r.convex(
    [
      { n: [1, 0, 0] as V3, d: x + 0.7 + billow },
      { n: [-1, 0, 0] as V3, d: -(x - 0.7 + billow) },
      { n: [0, 1, 0] as V3, d: y + half },
      { n: [0, -1, 0] as V3, d: -(y - half) },
      { n: [0, 0, 1] as V3, d: z1 },
      { n: [0, 0, -1] as V3, d: -z0 },
    ],
    [x - 1 + billow, y - half, z0],
    [x + 1 + billow, y + half, z1],
    m(ramp0, group, { shader: (s, tone) => (Math.sin((s.p[2] - z0) * 1.1) > 0.86 ? tone(PAL.woodDark) : tone(ramp0)) }),
  );
}

/** One frame of a vessel: f of n (the swell, the sails' billow, the oars or the cloud's churn), facing angle a. */
export function paintVessel(id: VesselId, f: number, n: number, a: number): PixelBuffer {
  const box = VESSEL_BOX[id];
  const r = new Raster(box.w, box.h, box.ox, box.oy, facingBasis(a), box.k);
  const ph = (f / n) * TAU;
  const bob = Math.sin(ph) * 0.7;
  const pitch = Math.cos(ph) * 0.05;
  if (id === "junk") {
    // a three-masted junk: a high carved stern, a deckhouse, red-brown battened sails and a lantern at the stern
    r.ellipsoid([0, 0, 2 + bob], [8, 22, 5.2], m(HULL, 1, { shader: (s, tone) => (s.n[2] > 0.75 ? tone(PAL.wood) : Math.abs(s.p[2] - 3 - bob) < 0.6 ? tone(PAL.red) : s.p[1] > 15 && Math.abs(s.p[2] - 5 - bob) < 0.5 ? tone(PAL.gold) : tone(HULL)) }));
    r.box([-6, -21, 3 + bob], [6, -14, 8 + bob - 3 * pitch * 10], m(PAL.woodDark, 2));
    r.box([-6, 10, 3 + bob], [6, 20, 11 + bob], m(PAL.woodDark, 2, { shader: (s, tone) => (Math.abs(s.p[2] - 8 - bob) < 0.5 ? tone(PAL.red) : tone(PAL.woodDark)) }));
    r.hipRoof(0, 15, 7, 6, 11 + bob, 4, 3, 15 + bob, m(ramp("#a83a3a", { lo: "#3a0a20" }), 3));
    for (const [y, h, w] of [
      [-12, 34, 5],
      [-2, 50, 9],
      [8, 40, 7],
    ] as [number, number, number][]) {
      const lean = pitch * h;
      r.sweep([[0, y, 3 + bob], [0, y + lean, h + bob]], 0.8, m(PAL.woodDark, 4));
      sail(r, 0, y + lean * 0.6, h * 0.38 + bob, h - 1 + bob, w, Math.sin(ph + y) * 1.4, SAIL, 5);
      // a pennant streaming from the masthead
      r.sweep([[0, y + lean, h + bob], [Math.sin(ph * 2 + y) * 1.2, y + lean - 6, h + bob + 0.5]], [0.7, 0.2], m(PAL.red, 6));
    }
    r.sweep([[0, -22, 4 + bob], [0, -30, 8 + bob]], 0.6, m(PAL.woodDark, 4));
    r.ellipsoid([0, 21, 15 + bob], [1.4, 1.4, 1.8], m(tones("#fffbe0", "#ffd070", "#f08a3a", "#a83a20"), 7));
    // the bow wave
    for (const s of [-1, 1]) r.ellipsoid([s * 6, -18, 0.4], [2.4, 4.6, 0.5], m(tones("#ffffff", "#e8f6ff", "#b8dcf0", "#7aa8c8"), 8, { outline: undefined }));
  } else if (id === "skiff") {
    // a fishing skiff: a long low hull, one lug sail, a woven awning, and the fisher's net hung over the side
    r.ellipsoid([0, 0, 1.4 + bob], [4.4, 13, 3], m(HULL, 1, { shader: (s, tone) => (s.n[2] > 0.7 ? tone(PAL.wood) : tone(HULL)) }));
    r.sweep([[-4, 4, 4 + bob], [0, 2, 9 + bob], [4, 4, 4 + bob]], 1.6, m(PAL.straw, 2));
    r.sweep([[-4, 9, 4 + bob], [0, 7, 9 + bob], [4, 9, 4 + bob]], 1.6, m(PAL.straw, 2));
    r.sweep([[0, -4, 3 + bob], [0, -4 + pitch * 26, 26 + bob]], 0.6, m(PAL.woodDark, 3));
    sail(r, 0, -4 + pitch * 14, 9 + bob, 25 + bob, 5, Math.sin(ph) * 1.6, SAIL_WHITE, 4);
    r.sweep([[3.8, -8, 3 + bob], [6, -10, 0.6]], 0.3, m(PAL.straw, 5));
    // the fisher at the steering oar
    r.ellipsoid([0, 10, 7 + bob], [1.8, 1.6, 3], m(PAL.navy, 6));
    r.sphere([0, 10, 11 + bob], 1.4, m(PAL.skinTan, 6));
    r.cone(0, 10, 3.4, 11.8 + bob, 0.2, 14 + bob, 10, m(PAL.straw, 7));
    r.sweep([[1, 10.5, 8 + bob], [0, 15 + Math.sin(ph) * 1.4, 2], [0, 17, -0.4]], 0.5, m(PAL.wood, 8));
  } else {
    // the sects' cloud-ship: a lacquered hull riding a churning bank of cloud, a pavilion amidships, white sails and long streamers
    const lift = 10 + Math.sin(ph) * 1.2;
    for (let k = 0; k < 7; k++) {
      const ang = ph + k * 0.9;
      r.ellipsoid([Math.cos(ang) * 6, -16 + k * 5.4, 2 + Math.sin(ang * 1.3) * 1.2], [6 + (k % 2) * 1.6, 5.4, 3.6], m(CLOUD, 1, { outline: undefined }));
    }
    r.ellipsoid([0, 0, lift + 2], [8, 22, 4.4], m(ramp("#2c6a8a", { lo: "#0a1a3a" }), 2, { shader: (s, tone) => (s.n[2] > 0.75 ? tone(PAL.wood) : Math.abs(s.p[2] - lift - 2) < 0.6 ? tone(PAL.gold) : tone(ramp("#2c6a8a", { lo: "#0a1a3a" }))) }));
    r.sweep([[0, -22, lift + 3], [0, -28, lift + 8]], 0.7, m(PAL.gold, 3));
    r.sphere([0, -28.5, lift + 8.6], 1.4, m(PAL.jade, 3));
    for (const [x, y] of [
      [-4, -4],
      [4, -4],
      [-4, 4],
      [4, 4],
    ] as [number, number][])
      r.sweep([[x, y, lift + 5], [x, y, lift + 12]], 0.6, m(PAL.red, 4));
    r.hipRoof(0, 0, 6, 6, lift + 12, 4, 3, lift + 17, m(ramp("#3a8a8a", { lo: "#10304a" }), 5));
    for (const [y, h, w] of [
      [-12, 30, 6],
      [12, 36, 7],
    ] as [number, number, number][]) {
      r.sweep([[0, y, lift + 4], [0, y, lift + h]], 0.7, m(PAL.woodDark, 6));
      sail(r, 0, y, lift + h * 0.42, lift + h - 1, w, Math.sin(ph + y) * 1.2, SAIL_WHITE, 7);
      r.sweep([[0, y, lift + h], [Math.sin(ph * 2 + y) * 1.5, y + 9, lift + h - 1.5], [Math.sin(ph * 2 + y + 1) * 2, y + 16, lift + h - 4]], [0.8, 0.5, 0.2], m(PAL.jade, 8));
    }
    r.ellipsoid([0, 22, lift + 7], [1.3, 1.3, 1.6], m(tones("#fffbe0", "#ffd070", "#f08a3a", "#a83a20"), 9));
  }
  return r.finish();
}
