import type { PixelBuffer } from "../pixel/PixelBuffer";
import { add, facingBasis, norm, Raster, scale3, spline, type Mat, type Ramp, type V3 } from "../iso/raster";
import { paintHuman, type HumanPose, type HumanStyle } from "./humanoid";
import { OUTLINE, PAL, ramp, tones } from "./palette";

/**
 * Horses: Cloudmane, the spirit horse Lin Yue whistles down out of the
 * clouds to ride, and the wild horses grazing the fields and highlands.
 * Built from the same ray-cast solids as everyone else, so they turn to all
 * 16 directions. The rider is painted into the same raster as her horse, so
 * the two share one depth buffer and occlude each other properly.
 */

export interface HorsePose {
  t: number;
  /** Gait phase in radians (legs swing with it). */
  gait?: number;
  /** "walk" moves the legs one at a time, "gallop" in bounding pairs. */
  kind?: "walk" | "gallop";
  /** Body raised off the ground (the floating moment of a gallop). */
  lift?: number;
  /** Head pitch: +1 tossed high, -1 down to the grass. */
  head?: number;
  /** 0..1 rearing up on the hind legs. */
  rear?: number;
  /** Tail swish (-1..1). */
  tail?: number;
  /** Ears pricked forward (0) or laid back (1). */
  ears?: number;
  flash?: number;
}

export interface HorseStyle {
  coat: Ramp;
  mane: Ramp;
  hooves: Ramp;
  socks?: Ramp;
  blaze?: string;
  eye: string;
  /** Saddle and bridle (Cloudmane); wild horses go bare. */
  tack?: { saddle: Ramp; cloth: Ramp; bridle: Ramp };
  /** A spirit horse's mane and tail stream like cloud and glimmer at the tips. */
  spirit?: boolean;
}

export const CLOUDMANE: HorseStyle = {
  coat: ramp("#f4f6ff", { lo: "#6a74a8" }),
  mane: tones("#e8fff8", "#9ff5de", "#3fb59a", "#1a6a6a"),
  hooves: PAL.gold,
  eye: "#2a4a8a",
  tack: { saddle: ramp("#8a3a3a", { lo: "#2a0a1a" }), cloth: PAL.jade, bridle: PAL.gold },
  spirit: true,
};

export const WILD_HORSE: HorseStyle = {
  coat: ramp("#a8603a", { lo: "#3a1a1a" }),
  mane: ramp("#3a2420", { lo: "#0a0408" }),
  hooves: ramp("#3a3030"),
  socks: ramp("#f0e8dc"),
  blaze: "#f6f0e4",
  eye: "#1a0a0a",
};

export const HORSE_W = 72;
export const HORSE_H = 66;
export const HORSE_OX = 36;
export const HORSE_OY = 54;
export const RIDER_W = 88;
export const RIDER_H = 92;
export const RIDER_OX = 44;
export const RIDER_OY = 74;

/** Height of the saddle's seat above the ground, in the horse's own (unscaled) model units. */
export const SADDLE_Z = 18.4;
/** Horses are modelled at a pony's size and drawn this much bigger, so a chibi rider sits on a proper horse. */
export const HORSE_SCALE = 1.45;

/** The few raster calls a horse makes, through a uniform scale about the model origin. */
interface Painter {
  sphere(c: V3, r: number, mat: Mat): void;
  ellipsoid(c: V3, radii: V3, mat: Mat): void;
  sweep(points: readonly V3[], radius: number | readonly number[], mat: Mat): void;
  eye(p: V3, n: V3, color: string): void;
}

function scaled(r: Raster, k: number): Painter {
  const P = (v: V3): V3 => [v[0] * k, v[1] * k, v[2] * k];
  return {
    sphere: (c, rad, mat) => r.sphere(P(c), rad * k, mat),
    ellipsoid: (c, radii, mat) => r.ellipsoid(P(c), P(radii), mat),
    sweep: (pts, rad, mat) => r.sweep(pts.map(P), typeof rad === "number" ? rad * k : rad.map((x) => x * k), mat),
    eye: (p, n, color) => {
      const fp = r.facePoint(P(p), n, 0.08);
      if (fp.visible) r.plot(fp.x, fp.y, color);
    },
  };
}

const m = (r: Ramp, group: number, extra: Partial<Mat> = {}): Mat => ({ ramp: r, group, outline: OUTLINE, ...extra });
const TAU = Math.PI * 2;

/**
 * Where a point on the horse ends up when it rears: the whole body pivots
 * back about the hind hips. Riders use the same transform for the saddle.
 */
export function rearAt(p: HorsePose): (v: V3) => V3 {
  const a = (p.rear ?? 0) * 0.62;
  const lift = p.lift ?? 0;
  if (!a) return (v) => [v[0], v[1], v[2] + lift];
  const py = -6;
  const pz = 10;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return (v) => [v[0], py + (v[1] - py) * c - (v[2] - pz) * s, pz + (v[1] - py) * s + (v[2] - pz) * c + lift];
}

/** Paint a horse into a raster (model origin on the ground beneath its middle, facing +y). */
export function drawHorse(raster: Raster, st: HorseStyle, p: HorsePose): void {
  const r = scaled(raster, HORSE_SCALE);
  const t = p.t;
  const R = rearAt(p);
  const breathe = Math.sin(t) * 0.2;
  const coat = m(st.coat, 1, { shader: (s, tone) => (s.n[2] < -0.6 ? tone(st.coat, 1) : tone(st.coat)) });

  // barrel, chest and haunches
  r.ellipsoid(R([0, -0.4, 14 + breathe]), [3.5, 8.2, 3.9], coat);
  r.sphere(R([0, 5.6, 14.6 + breathe]), 4, m(st.coat, 2));
  r.sphere(R([0, -6, 14.8]), 4.1, m(st.coat, 3));

  // legs: hip/shoulder → knee/hock → fetlock → hoof
  const g = p.gait ?? 0;
  const gallop = p.kind === "gallop";
  const legs: { x: number; y: number; front: boolean; ph: number }[] = [
    { x: -1.9, y: 5.8, front: true, ph: gallop ? 0 : 0 },
    { x: 1.9, y: 5.8, front: true, ph: gallop ? 0.35 : Math.PI },
    { x: -2, y: -6.2, front: false, ph: gallop ? Math.PI : Math.PI * 1.5 },
    { x: 2, y: -6.2, front: false, ph: gallop ? Math.PI + 0.35 : Math.PI * 0.5 },
  ];
  const stride = gallop ? 4.4 : 2.4;
  const raise = gallop ? 3.4 : 1.8;
  for (const L of legs) {
    const a = g + L.ph;
    const swing = Math.sin(a);
    const up = Math.max(0, Math.cos(a)) * raise;
    const rearing = (p.rear ?? 0) > 0.2 && L.front;
    const top = R([L.x, L.y, 12.4]);
    // a rearing horse tucks its forelegs up and paws the air; otherwise the hooves step (and float a little in a gallop's leap)
    const paw = Math.sin(t * 2 + L.x) * 1.2;
    const hoofW: V3 = rearing ? R([L.x, L.y + 4 + paw, 6.4]) : [L.x, L.y + swing * stride, up + (p.lift ?? 0) * 0.6];
    const bend = (L.front ? 1 : -1) * (0.8 + up * 0.5);
    const knee: V3 = [(top[0] + hoofW[0]) / 2, (top[1] + hoofW[1]) / 2 + bend, (top[2] + hoofW[2]) / 2 + 0.6];
    r.sweep([top, knee, add(hoofW, [0, 0, 1.4])], [1.7, 1.05, 0.85], m(st.coat, 4 + (L.x > 0 ? 1 : 0)));
    if (st.socks) r.sweep([add(hoofW, [0, 0, 1.2]), add(hoofW, [0, 0, 3])], 1, m(st.socks, 4 + (L.x > 0 ? 1 : 0)));
    r.ellipsoid(add(hoofW, [0, 0.2, 0.7]), [1.05, 1.25, 0.75], m(st.hooves, 4 + (L.x > 0 ? 1 : 0)));
  }

  // neck and head (the head drops to graze and tosses up when it rears)
  const pitch = p.head ?? 0;
  const neckBase = R([0, 6.6, 16.6]);
  const head = R([0, 10.4 + Math.max(0, -pitch) * 2.4, 23.6 + pitch * 2.6 - Math.max(0, -pitch) * 12 + breathe]);
  const muzzle = add(head, [0, 3.4 - Math.max(0, -pitch) * 0.6, -1.8 - Math.max(0, -pitch) * 2.2]);
  r.sweep([neckBase, add(lerp(neckBase, head, 0.55), [0, -0.6, 0.8]), head], [3, 2.4, 2.1], m(st.coat, 6));
  r.sphere(head, 2.4, m(st.coat, 7, { shader: (s, tone) => (st.blaze && s.n[1] > 0.6 && Math.abs(s.n[0]) < 0.22 ? st.blaze : tone(st.coat)) }));
  r.sweep([head, muzzle], [2.1, 1.55], m(st.coat, 7, { shader: (s, tone) => (st.blaze && s.n[2] > 0.5 && Math.abs(s.n[0]) < 0.25 ? st.blaze : s.u > 0.8 ? tone(st.coat, 1) : tone(st.coat)) }));
  for (const side of [-1, 1]) {
    const back = (p.ears ?? 0) * 1.6;
    r.sweep([add(head, [side * 1, -0.8, 1.8]), add(head, [side * 1.3, -1.2 - back, 4 - back * 0.6])], [0.8, 0.2], m(st.coat, 7));
    // eyes on the sides of the head
    const n = norm([side * 0.9, 0.35, 0.25]);
    r.eye(add(head, scale3(n, 2.4)), n, st.eye);
  }

  // mane and forelock, streaming in the wind of the gait
  const blow = gallop ? 1 : 0.35;
  const mane = m(st.mane, 8, { shader: (s, tone) => (st.spirit && s.u > 0.7 ? st.mane[0] : tone(st.mane)) });
  for (let k = 0; k < 6; k++) {
    const u = k / 5;
    const root = add(lerp(add(neckBase, [0, -1.2, 2.2]), add(head, [0, -1.6, 1.6]), u), [0, 0, 0]);
    const wave = Math.sin(t * 3 + k * 1.3) * 0.8 * blow;
    r.sweep([root, add(root, [wave * 0.6 + (k % 2 ? 0.8 : -0.8), -2.4 - blow * 2.6, -1.2 + blow * 0.8])], [1.2, 0.3], mane);
  }
  r.sweep([add(head, [0, 0.6, 2.2]), add(head, [Math.sin(t * 2) * 0.4, 2.2, 1.2])], [0.8, 0.2], mane);

  // tail: swishing at rest, streaming out at a gallop
  const sw = (p.tail ?? Math.sin(t)) * 1.6;
  const tailRoot = R([0, -9.4, 16.4]);
  const tailPts = spline([tailRoot, R([sw * 0.6, -11.6 - blow * 1.6, 13.6 + blow]), R([sw, -12.8 - blow * 3.4, 9.6 + blow * 3]), R([sw * 1.4, -13.2 - blow * 4.6, 5.4 + blow * 4.6])], 3);
  r.sweep(tailPts, [1.1, 1.8, 1.9, 0.8], m(st.mane, 9, { shader: (s, tone) => (st.spirit && s.u > 0.75 ? st.mane[0] : tone(st.mane)) }));

  // tack
  if (st.tack) {
    const T = st.tack;
    r.ellipsoid(R([0, -0.6, 18.2]), [3.9, 3.4, 0.9], m(T.cloth, 10, { shader: (s, tone) => (Math.abs(Math.hypot(s.n[0], s.n[1]) - 0.92) < 0.06 ? tone(PAL.gold) : tone(T.cloth)) }));
    r.ellipsoid(R([0, -0.6, 18.9]), [2.6, 2.8, 0.8], m(T.saddle, 10));
    r.sweep([R([0, 1.6, 19]), R([0, 2.4, 20.4])], 0.7, m(T.saddle, 10));
    for (const side of [-1, 1]) {
      // stirrup straps
      r.sweep([R([side * 3.2, -0.4, 18]), R([side * 4.3, 0.8, 11.2])], 0.25, m(T.bridle, 10));
      r.sphere(R([side * 4.4, 0.9, 10.8]), 0.55, m(T.bridle, 10));
    }
    // bridle and reins up to where the rider's hands are
    r.sweep([add(muzzle, [0, -0.6, 0.2]), add(head, [0, -1.4, 0.4])], 0.35, m(T.bridle, 11));
    r.sweep([add(muzzle, [0, -0.8, -0.2]), R([0, 4.2, 20.8])], 0.22, m(T.bridle, 11));
    r.sphere(add(muzzle, [0, -0.6, 0.2]), 0.45, m(PAL.gold, 11));
  }
}

const lerp = (a: V3, b: V3, u: number): V3 => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

/** A horse on its own (wild horses). */
export function paintHorse(st: HorseStyle, p: HorsePose, facing: number): PixelBuffer {
  const r = new Raster(HORSE_W, HORSE_H, HORSE_OX, HORSE_OY, facingBasis(facing));
  drawHorse(r, st, p);
  const out = r.finish();
  return p.flash ? out.tinted("#ffffff", p.flash) : out;
}

/** A rider on her horse: the horse first, then the rider sat on the saddle in the same depth buffer. */
export function paintRider(rider: HumanStyle, horse: HorseStyle, p: HorsePose, human: HumanPose, facing: number): PixelBuffer {
  const r = new Raster(RIDER_W, RIDER_H, RIDER_OX, RIDER_OY, facingBasis(facing));
  drawHorse(r, horse, p);
  const seat = scale3(rearAt(p)([0, -1.4, SADDLE_Z]), HORSE_SCALE);
  // her feet origin sits below the saddle by the height of her hips
  const at: V3 = [seat[0], seat[1], seat[2] - 9];
  paintHuman(rider, { ...human, stance: "ride", lean: (human.lean ?? 0) - (p.rear ?? 0) * 0.35 }, facing, { into: r, at });
  return r.finish({ inner: true });
}

/** Gait phase for frame i of n (one full stride per loop). */
export const gaitAt = (i: number, n: number) => (i / n) * TAU;
