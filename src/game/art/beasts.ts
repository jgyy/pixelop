import { PixelBuffer } from "../pixel/PixelBuffer";
import { add, facingBasis, norm, Raster, scale3, spline, type Mat, type Ramp, type Shader, type V3 } from "../iso/raster";
import { OUTLINE, PAL, ramp } from "./palette";

/** Demonic beasts and ambient animals, built from the same ray-cast solids as the cultivators. */

export interface BeastPose {
  t: number;
  /** Walk cycle phase (radians); legs swing with sin(stride). */
  stride?: number;
  /** 0..1 lunge forward (attacks). */
  lunge?: number;
  /** Lean back when hit. */
  recoil?: number;
  mouth?: boolean;
  lift?: number;
  /** Wing angle for birds (radians, 0 = level). */
  wing?: number;
  flash?: number;
  /** Head pitch: +1 raised (howling), -1 lowered (sniffing, pecking, sleeping). */
  head?: number;
  /** 0..1 body lowered to the ground (sitting, curled up asleep). */
  crouch?: number;
  closed?: boolean;
  /** Sleeping breath (0/1). */
  breath?: number;
}

export const BEAST_W = 72;
export const BEAST_H = 64;
export const BEAST_OX = 36;
export const BEAST_OY = 50;

const m = (ramp: Ramp, group: number, extra: Partial<Mat> = {}): Mat => ({ ramp, group, outline: OUTLINE, ...extra });

function eyes(r: Raster, head: V3, rad: number, color: string, spread = 0.48, up = 0.18): void {
  for (const side of [-1, 1]) {
    const n = norm([side * spread, 0.8, up]);
    const fp = r.facePoint(add(head, scale3(n, rad)), n, 0.05);
    if (!fp.visible) continue;
    r.plot(fp.x, fp.y, color);
    r.plot(fp.x, fp.y - 1, "#ffffff");
  }
}

export interface QuadStyle {
  fur: Ramp;
  belly: Ramp;
  paws: Ramp;
  eye: string;
  tails: number;
  tailTip?: Ramp;
  scale: number;
  mane?: Ramp;
  earInner?: Ramp;
}

export const FOX_STYLE: QuadStyle = { fur: ramp("#f08a3a", { lo: "#8a2a40" }), belly: PAL.white, paws: PAL.black, eye: "#ff4060", tails: 3, tailTip: PAL.white, scale: 1, earInner: PAL.rose };
/** A hound of living stone from the Dragon Vein's caverns, jade light glowing in its cracks. */
export const STONEHOUND_STYLE: QuadStyle = { fur: ramp("#7a7688", { lo: "#1a1626" }), belly: ramp("#5a566a"), paws: PAL.black, eye: "#9ff5de", tails: 1, scale: 1.25, mane: ramp("#4ac8b0", { hi: "#c8fff0", lo: "#1a4a4a" }) };
/** A white wolf of the ice under Frostveil, frost glittering in a mane the blue of glacier water. */
export const FROSTFANG_STYLE: QuadStyle = { fur: ramp("#e8eef8", { lo: "#4a5a7a" }), belly: ramp("#c8d8ec"), paws: ramp("#6a7a9a"), eye: "#7ad8ff", tails: 1, scale: 1.3, mane: ramp("#8ad0ff", { hi: "#ffffff", lo: "#2a4a7a" }) };
/** The last fox the Blood Moon's crimson qi still holds: black as soot, five tails, eyes like coals. */
export const SHADOW_VIXEN_STYLE: QuadStyle = { fur: ramp("#2a1a2e", { lo: "#08040a" }), belly: ramp("#4a2a3a"), paws: PAL.black, eye: "#ff2a40", tails: 5, tailTip: ramp("#c02a3a", { hi: "#ff8a8a", lo: "#4a0a14" }), scale: 1.25, earInner: ramp("#8a1a2a") };
export const WOLF_STYLE: QuadStyle = { fur: ramp("#4a3a6a", { lo: "#120a24" }), belly: ramp("#6a5a8a"), paws: PAL.black, eye: "#c070ff", tails: 1, scale: 1.35, mane: ramp("#b070ff", { hi: "#f0d0ff", lo: "#4a1a8a" }) };

export function paintQuad(st: QuadStyle, p: BeastPose, facing: number): PixelBuffer {
  const r = new Raster(BEAST_W, BEAST_H, BEAST_OX, BEAST_OY, facingBasis(facing));
  const S = st.scale;
  const t = p.t;
  const lunge = (p.lunge ?? 0) * 4;
  const recoil = p.recoil ?? 0;
  const lift = (p.lift ?? 0) + (p.lunge ?? 0) * 3;
  const P = (v: V3): V3 => [v[0] * S, (v[1] + lunge - recoil * 2) * S, (v[2] + lift) * S];
  const breathe = p.breath !== undefined ? p.breath * 0.5 : Math.sin(t) * 0.25;
  const crouch = (p.crouch ?? 0) * 3.6;
  const pitch = p.head ?? 0;
  /** Body parts sink as the beast sits or curls up; the hindquarters sink furthest. */
  const B = (v: V3): V3 => P([v[0], v[1], v[2] - crouch * (v[1] < 0 ? 1.15 : 0.75)]);
  const fur = m(st.fur, 1, { shader: (s, tone) => (s.n[2] < -0.35 ? tone(st.belly) : tone(st.fur)) });

  r.ellipsoid(B([0, 0, 7.5 + breathe]), [3 * S, 6.2 * S, 3.2 * S], fur);
  r.sphere(B([0, 4.2, 8.6 + breathe]), 3.3 * S, m(st.belly, 2));
  // legs
  const s = p.stride ?? 0;
  const legs: [number, number, number][] = [
    [-1.7, 4.2, Math.sin(s)],
    [1.7, 4.2, Math.sin(s + Math.PI)],
    [-1.9, -4, Math.sin(s + Math.PI)],
    [1.9, -4, Math.sin(s)],
  ];
  for (const [x, y, ph] of legs) {
    const tuck = crouch > 2 ? (y > 0 ? 2.2 : -1.4) : 0;
    const foot: V3 = [x, y + ph * 2.2 + (p.lunge ?? 0) * (y > 0 ? 3 : -1) + tuck, Math.max(0.9, 0.9 + Math.max(0, Math.cos(s + (ph > 0 ? 0 : Math.PI))) * 1.2 - lift)];
    r.sweep([B([x, y, 6.5]), P([x, y + ph * (1 - crouch / 4), Math.max(1.2, 3.4 - crouch * 0.5)]), P(foot)], [1.2 * S, 1.0 * S, 0.9 * S], m(st.fur, 3));
    r.sphere(P(foot), 0.95 * S, m(st.paws, 3));
  }
  // head
  const hy = 7.8 + (p.lunge ?? 0) * 1.5 - recoil + (pitch < 0 ? -pitch * 1.6 : -pitch * 1.4);
  const hz = 12 + breathe - (p.lunge ?? 0) * 1.5 + recoil + (pitch < 0 ? pitch * 5.5 : pitch * 4) - crouch * 0.6;
  const head = P([0, hy, hz]);
  // the neck follows the head
  if (pitch || crouch) r.sweep([B([0, 4.6, 9.4]), head], [2.2 * S, 2.4 * S], m(st.fur, 4));
  r.sphere(head, 3.6 * S, m(st.fur, 4, { shader: (sf, tone) => (sf.n[1] > 0.55 && sf.n[2] < 0.1 ? tone(st.belly) : tone(st.fur)) }));
  // the snout tips up to howl and down to sniff
  const sz = pitch * 1.6;
  r.ellipsoid(P([0, hy + 2.8 - Math.abs(pitch) * 0.5, hz - 1 - (p.mouth ? 0.4 : 0) + sz]), [1.4 * S, 2.1 * S, 1.3 * S], m(st.belly, 4));
  if (p.mouth) r.ellipsoid(P([0, hy + 2.7 - Math.abs(pitch) * 0.5, hz - 2.4 + sz]), [1.1 * S, 1.8 * S, 0.6 * S], m(PAL.crimson, 4));
  r.sphere(P([0, hy + 4.7 - Math.abs(pitch) * 0.8, hz - 0.7 + sz * 1.6]), 0.6 * S, m(PAL.black, 4));
  for (const side of [-1, 1]) {
    r.sweep([P([side * 1.8, hy - 0.4, hz + 2.6]), P([side * 2.5, hy - 0.9 + Math.sin(t * 2 + side) * 0.2, hz + 6.4])], [1.5 * S, 0.25 * S], m(st.fur, 4, { shader: (sf, tone) => (sf.n[1] > 0.3 && sf.u < 0.7 && st.earInner ? tone(st.earInner) : tone(st.fur)) }));
  }
  if (!p.closed) eyes(r, head, 3.6 * S, st.eye);
  // tails
  for (let i = 0; i < st.tails; i++) {
    const side = st.tails === 1 ? 0 : i - (st.tails - 1) / 2;
    const ph = t + i * 0.9;
    // asleep, the tails curl round the body like a scarf
    const pts = crouch > 2
      ? spline([B([0, -5.6, 8.6]), B([side * 2 + 4, -7.5, 5]), B([side * 2 + 6.5, -2, 3.6]), B([side * 1.5 + 5, 4, 3.4])], 3)
      : spline([B([0, -5.6, 8.6]), B([side * 3 + Math.sin(ph) * 1.4, -9.2, 9 + recoil]), B([side * 4.6 + Math.sin(ph + 0.8) * 2, -11.4, 13]), B([side * 5 + Math.sin(ph + 1.6) * 2.6, -11, 17.5])], 3);
    r.sweep(pts, [1.3 * S, 2.5 * S, 2.7 * S, 1.2 * S], m(st.fur, 5, { shader: (sf, tone) => (st.tailTip && sf.u > 0.78 ? tone(st.tailTip) : tone(st.fur)) }));
  }
  // flame mane (demon wolf)
  if (st.mane) {
    const mane = st.mane;
    for (let i = 0; i < 7; i++) {
      const y = 6 - i * 1.8;
      const flick = Math.sin(t * 3 + i * 1.7) * 1.2;
      r.sweep([B([0, y, 10.3 - i * 0.2]), B([flick * 0.5, y - 1.5, 14.5 - i * 0.4 + flick])], [1.6 * S, 0.3 * S], m(mane, 6, { shader: (sf, tone) => (sf.u > 0.6 ? mane[0] : tone(mane)) }));
    }
  }
  let out = r.finish();
  if (p.flash) out = out.tinted("#ffffff", p.flash);
  return out;
}

const JADE_SCALES = ramp("#3fbf8a", { lo: "#0a3a4a" });
const JADE_BELLY = ramp("#e8e0a0");

export interface SerpentStyle {
  scales: Ramp;
  belly: Ramp;
  fin: Ramp;
  eye: string;
  /** A serpent that burns: flames run along its back. */
  fire?: boolean;
}

/** The Ember Wyrm of the mine: magma-red scales, a belly of hot gold, and fire along its spine. */
export const EMBER_WYRM: SerpentStyle = { scales: ramp("#d8502a", { hi: "#ffd070", lo: "#3a0a1a" }), belly: ramp("#ffc860", { lo: "#8a3a10" }), fin: ramp("#3a2a2a", { lo: "#0a0608" }), eye: "#fff060", fire: true };

/** The Rime Wyrm of the Icesoul Hollow: scales of old blue ice, a belly white as snow. */
export const RIME_WYRM: SerpentStyle = { scales: ramp("#7ab8e8", { hi: "#f0faff", lo: "#1a2a5a" }), belly: ramp("#f4f8ff", { lo: "#7a8ab0" }), fin: ramp("#c8e8ff", { lo: "#3a5a8a" }), eye: "#ffffff" };
/** The Dune Wyrm under the Yellow Sands: sand-gold scales banded with tomb bronze. */
export const DUNE_WYRM: SerpentStyle = { scales: ramp("#d8b060", { hi: "#fff0b0", lo: "#5a3a1a" }), belly: ramp("#f0dca0", { lo: "#8a6a3a" }), fin: ramp("#8a5a2a", { lo: "#2a1408" }), eye: "#3af0a0" };
/** The Pearl Serpent of the sea cave: deep sea-green, a nacre belly that shimmers. */
export const PEARL_WYRM: SerpentStyle = { scales: ramp("#2a8a8a", { hi: "#9af0e0", lo: "#0a2a3a" }), belly: ramp("#f8eef4", { lo: "#a88aa8" }), fin: ramp("#e8a8c8", { lo: "#5a2a4a" }), eye: "#ffe060" };

export function paintSerpent(p: BeastPose, facing: number, king = false, style?: SerpentStyle): PixelBuffer {
  const SERPENT_SCALES = style?.scales ?? JADE_SCALES;
  const SERPENT_BELLY = style?.belly ?? JADE_BELLY;
  const r = new Raster(BEAST_W, BEAST_H, BEAST_OX, BEAST_OY, facingBasis(facing));
  const S = king ? 1.35 : 1;
  const t = p.t;
  const lunge = p.lunge ?? 0;
  const recoil = p.recoil ?? 0;
  const P = (v: V3): V3 => [v[0] * S, v[1] * S, v[2] * S];
  const pts: V3[] = [];
  for (let i = 0; i <= 10; i++) {
    if (i <= 5) {
      // coiled body resting on the ground
      const a = i * 1.15 + Math.sin(t) * 0.15 + Math.PI * 0.6;
      const rad = 5 - i * 0.35;
      pts.push(P([Math.cos(a) * rad, Math.sin(a) * rad - 2 - recoil, 2.2]));
    } else {
      const k = i - 5;
      pts.push(P([Math.sin(t + i * 0.8) * 0.9, -1 + k * (1.6 + lunge * 1.2) - recoil * k * 0.6, 2.2 + Math.pow(k, 1.25) * (2 - lunge * 0.6 + recoil * 0.3)]));
    }
  }
  const scales: Shader = (s, tone) => {
    if (s.n[2] < -0.2 || (s.n[1] > 0.5 && s.u > 0.65)) return tone(SERPENT_BELLY);
    if (Math.sin(s.u * 46) > 0.55) return tone(SERPENT_SCALES, 1);
    return tone(SERPENT_SCALES);
  };
  const path = spline(pts, 3);
  r.sweep(path, (u) => S * (u < 0.12 ? 1 + u * 14 : 2.8 - (u - 0.12) * 0.7), m(SERPENT_SCALES, 1, { shader: scales }));
  // dorsal fins
  for (let i = 2; i < 10; i += 2) {
    const a = pts[i];
    r.sweep([add(a, [0, 0, 1.8 * S]), add(a, [0, -1.6 * S, 3.6 * S])], [0.9 * S, 0.2 * S], m(style?.fin ?? PAL.gold, 2));
    if (style?.fire) {
      const fire = ramp("#ffb040", { hi: "#fff6c0", lo: "#a81a10" });
      r.sweep([add(a, [0, -0.4 * S, 3 * S]), add(a, [Math.sin(t * 3 + i) * 0.8 * S, -1.2 * S, (5.6 + Math.sin(t * 2 + i)) * S])], [1.1 * S, 0.1 * S], m(fire, 2, { outline: undefined }));
    }
  }
  const neck = pts[10];
  const head = add(neck, [0, 2.2 * S, 0.6 * S]);
  r.ellipsoid(head, [2.3 * S, 3.4 * S, 1.9 * S], m(SERPENT_SCALES, 3, { shader: scales }));
  if (p.mouth) r.ellipsoid(add(head, [0, 2 * S, -1.6 * S]), [1.7 * S, 2.6 * S, 0.7 * S], m(PAL.crimson, 3));
  for (const side of [-1, 1]) {
    r.sweep([add(head, [side * 1.3 * S, -1 * S, 1.3 * S]), add(head, [side * 2.4 * S, -4.6 * S, 3.4 * S])], [0.7 * S, 0.15 * S], m(king ? PAL.gold : PAL.white, 4));
  }
  if (king) r.sphere(add(head, [0, 0.5 * S, 2 * S]), 0.9 * S, m(PAL.qi, 4));
  eyes(r, head, 2.4 * S, style?.eye ?? (king ? "#ffe040" : "#ff3050"), 0.62, 0.3);
  let out = r.finish();
  if (p.flash) out = out.tinted("#ffffff", p.flash);
  return out;
}

export function paintCrane(p: BeastPose, facing: number): PixelBuffer {
  const r = new Raster(BEAST_W, BEAST_H, BEAST_OX, BEAST_OY, facingBasis(facing));
  const lift = p.lift ?? 0;
  const flying = p.wing !== undefined;
  const P = (v: V3): V3 => [v[0], v[1], v[2] + lift];
  const white = m(PAL.white, 1);
  r.ellipsoid(P([0, 0, 12]), [2.6, 4.8, 2.5], white);
  r.sweep([P([0, -4, 12.4]), P([0, -6.8, 12.8])], [1.7, 0.6], m(PAL.black, 1));
  const dip = Math.max(0, -(p.head ?? 0));
  const neck = flying
    ? [P([0, 3.8, 12.6]), P([0, 7, 13.2]), P([0, 9.6, 13.6])]
    : [P([0, 3.6, 13]), P([0, 5.4 + dip * 2.4, 16.5 - dip * 3.5]), P([0, 6.2 + dip * 4.2, 20 - dip * 13])];
  r.sweep(neck, 0.85, m(PAL.white, 2));
  const head = neck[2];
  r.sphere(head, 1.5, m(PAL.white, 2, { shader: (s, tone) => (s.n[2] > 0.55 ? tone(PAL.red) : s.n[1] < -0.2 ? tone(PAL.black) : tone(PAL.white)) }));
  r.sweep([add(head, [0, 1, -0.2]), add(head, [0, 4, -0.8])], [0.55, 0.15], m(PAL.straw, 2));
  eyes(r, head, 1.5, "#1a1226", 0.7, 0.2);
  if (!flying) {
    for (const side of [-1, 1]) r.sweep([P([side * 1.2, 0.2, 10]), P([side * 1.3, 0.8, 0.4])], 0.35, m(PAL.black, 3));
  } else {
    r.sweep([P([0, -2, 11]), P([0, -8, 10.5])], 0.35, m(PAL.black, 3));
  }
  const w = p.wing ?? -1.2;
  for (const side of [-1, 1]) {
    const tip = P([side * Math.cos(w) * 10, -1.5, 12.5 + Math.sin(w) * 9]);
    const elbow = P([side * Math.cos(w * 0.6) * 5, 0, 12.8 + Math.sin(w * 0.6) * 4]);
    r.sweep([P([side * 1.8, 0.6, 13]), elbow, tip], [1.6, 1.9, 0.6], m(PAL.white, 4, { shader: (s, tone) => (s.u > 0.72 ? tone(PAL.black) : tone(PAL.white)) }));
  }
  return r.finish();
}

export function paintBat(p: BeastPose, facing: number): PixelBuffer {
  const r = new Raster(40, 32, 20, 26, facingBasis(facing));
  const w = p.wing ?? 0;
  const fur = ramp("#5a2a4a", { lo: "#10040e" });
  r.ellipsoid([0, 0, 10], [1.8, 2.2, 2.2], m(fur, 1));
  r.sphere([0, 1.6, 12.4], 1.5, m(fur, 1));
  for (const side of [-1, 1]) {
    r.sweep([[side * 1, 1.4, 13.4], [side * 1.6, 1.2, 15.4]], [0.7, 0.1], m(fur, 1));
    r.sweep([[side * 1.4, 0, 11], [side * Math.cos(w) * 5, 0.4, 11 + Math.sin(w) * 5], [side * Math.cos(w) * 8.5, -0.6, 10 + Math.sin(w) * 7]], [0.9, 1.4, 0.4], m(ramp("#7a2a5a"), 2));
  }
  eyes(r, [0, 1.6, 12.4], 1.5, "#ff3040", 0.5, 0.1);
  return r.finish();
}
