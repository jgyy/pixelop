import { PixelBuffer } from "../pixel/PixelBuffer";
import { alpha } from "../pixel/color";
import { add, facingBasis, norm, Raster, scale3, spline, sub, type Mat, type Ramp, type Shader, type V3 } from "../iso/raster";
import { OUTLINE, PAL, tones as ramp4 } from "./palette";

/**
 * Procedural chibi cultivators. A humanoid is a rig of ~20 solids (bell
 * skirt, torso, big head, sleeves, hair strands, shawl, weapon) posed per
 * frame and ray cast at any facing angle. Styles change palettes and add
 * hats, beards, capes, fox ears and tails, and the marks of the jianghu's
 * other peoples (dragon or ram horns, feathered wings, fins, crystal shards);
 * poses drive limbs and cloth.
 */

export type HairStyle = "bun" | "long" | "topknot" | "bald" | "twin" | "short" | "wild";
export type Hat = "none" | "straw" | "scholar" | "crown" | "jiangshi" | "hood" | "veil" | "helmet";
export type Weapon = "jian" | "saber" | "staff" | "fan" | "whisk" | "rod" | "spear" | "none";

export interface HumanStyle {
  skin: Ramp;
  hair: Ramp;
  robe: Ramp;
  inner: Ramp;
  trim: Ramp;
  sash: Ramp;
  shoes: Ramp;
  eye: string;
  hairStyle: HairStyle;
  female?: boolean;
  hat?: Hat;
  hatRamp?: Ramp;
  beard?: Ramp;
  cape?: Ramp;
  shawl?: Ramp;
  weapon?: Weapon;
  weaponRamp?: Ramp;
  /** Overall size: 1 adult, ~0.8 child, 1.3 boss. */
  scale?: number;
  /** Forward stoop for the elderly. */
  hunch?: number;
  /** Hem radius of the robe. */
  flare?: number;
  sleeve?: number;
  foxEars?: Ramp;
  tails?: Ramp;
  talisman?: boolean;
  mask?: Ramp;
  glowEyes?: string;
  /** Long robes hide the feet; short robes show trousers. */
  hem?: number;
  /** Horns: the dragon-kin's swept-back antlers, or the snow-folk's curled ram's horns. */
  horns?: Ramp;
  hornStyle?: "dragon" | "ram";
  /** The feathered folk's wings, folded at the back and beating with her breath. */
  wings?: Ramp;
  /** The merfolk's fins: a fan at each ear and a crest down the back. */
  fins?: Ramp;
  /** The stone-born's crystal shards, grown from shoulders and crown. */
  shards?: Ramp;
}

export type Eyes = "open" | "blink" | "closed" | "hurt" | "fierce" | "glow";
export type Mouth = "smile" | "neutral" | "open" | "grin";

export interface HumanPose {
  /** Phase for secondary motion (radians). */
  t: number;
  bob?: number;
  /** Whole-body z offset (hops, levitation). */
  lift?: number;
  lean?: number;
  footL?: V3;
  footR?: V3;
  handL?: V3;
  handR?: V3;
  stance?: "stand" | "sit" | "kneel" | "ride";
  eyes?: Eyes;
  mouth?: Mouth;
  sword?: "sheath" | "hand" | "under" | "none";
  swordDir?: V3;
  /** Cloth/hair drift in model space (e.g. [0,-1,0] when moving forward). */
  wind?: V3;
  /** Extra light-blue tint (qi casting) or white (hit flash) applied after. */
  flash?: number;
  /** Something held in the hands: a bamboo dizi flute, a rice bowl and chopsticks, juggling balls, a smith's hammer, a writing brush, a paper lantern, a hoe, a woodsman's axe, a carrying pole with two baskets, a shuttlecock or an oiled-paper umbrella. */
  held?: "flute" | "bowl" | "balls" | "hammer" | "brush" | "lantern" | "hoe" | "axe" | "pole" | "shuttlecock" | "umbrella" | "pickaxe" | "torch" | "ladle" | "fireball" | "rake" | "seedling" | "snowball" | "kite" | "warbanner" | "drum" | "bandage" | "horn" | "lionhead" | "puppet" | "abacus" | "firecracker" | "xiangqi" | "oar" | "pillow" | "bucket" | "token" | "pointer" | "rag" | "seal" | "steelyard" | "cup" | "decree" | "ledger";
  /** Where a tossed thing (the shuttlecock) is, in pose space. */
  toss?: V3;
}

export const HUMAN_W = 56;
export const HUMAN_H = 60;
export const HUMAN_OX = 28;
export const HUMAN_OY = 50;

const WAIST = 12.5;
const HEAD_Z = 24.3;
const HEAD_R = 6.2;
const SHOULDER_Z = 16.6;

const DEFAULT_FOOT_L: V3 = [-1.7, 0, 0];
const DEFAULT_FOOT_R: V3 = [1.7, 0, 0];
export const REST_HAND_L: V3 = [-4.4, 0.6, 11.2];
export const REST_HAND_R: V3 = [4.4, 0.6, 11.2];

const mat = (ramp: Ramp, group: number, extra: Partial<Mat> = {}): Mat => ({ ramp, group, outline: OUTLINE, ...extra });

export interface RenderOpts {
  w?: number;
  h?: number;
  ox?: number;
  oy?: number;
  k?: number;
  /** Only head and shoulders (dialogue portraits). */
  bust?: boolean;
  /** Paint into this raster (sharing its depth buffer, e.g. a rider on her horse) instead of a fresh one; nothing is returned. */
  into?: Raster;
  /** Model-space offset of the figure's feet (where a rider sits). */
  at?: V3;
}

export function paintHuman(st: HumanStyle, p: HumanPose, facing: number, o: RenderOpts = {}): PixelBuffer {
  const k = o.k ?? 1;
  const r = o.into ?? new Raster(o.w ?? HUMAN_W, o.h ?? HUMAN_H, o.ox ?? HUMAN_OX, o.oy ?? HUMAN_OY, facingBasis(facing), k);
  const S = st.scale ?? 1;
  const t = p.t;
  const wind = p.wind ?? [0, -0.25, 0];
  const stance = p.stance ?? "stand";
  const drop = stance === "sit" ? 7.5 : stance === "kneel" ? 4 : 0;
  const lean = (p.lean ?? 0) + (st.hunch ?? 0);
  const lift = p.lift ?? 0;
  const bob = (p.bob ?? 0) - drop;

  const at = o.at ?? [0, 0, 0];
  /** Scale + lift for points that stay grounded (feet, hem). */
  const G = (v: V3): V3 => [v[0] * S + at[0], v[1] * S + at[1], v[2] * S + lift + at[2]];
  /** Upper body: bob and lean around the waist. */
  const U = (v: V3): V3 => {
    const z = v[2] + bob;
    return G([v[0], v[1] + Math.max(0, v[2] - WAIST) * lean, z]);
  };
  const Rr = (x: number) => x * S;

  const skin = mat(st.skin, 6);
  const hairM = mat(st.hair, 7);

  // ------------------------------------------------------------------ legs & robe
  if (!o.bust) {
    const fl = p.footL ?? DEFAULT_FOOT_L;
    const fr = p.footR ?? DEFAULT_FOOT_R;
    const hem = st.hem ?? 2.4;
    if (stance === "ride") {
      // astride a saddle: knees out and forward over the flanks, feet in the stirrups, the robe draped to either side
      for (const [f, side] of [
        [fl, -1],
        [fr, 1],
      ] as const) {
        const hip: V3 = [side * 1.6, 0.4, 9];
        const knee: V3 = [side * 3.9, 2.8, 6.4];
        const ankle: V3 = [f[0], f[1], f[2] + 1.4];
        r.sweep([G(hip), G(knee), G(ankle)], Rr(1.25), mat(st.inner, 1));
        r.ellipsoid(G([f[0], f[1] + 0.6, f[2] + 0.9]), [Rr(1.1), Rr(1.8), Rr(1.0)], mat(st.shoes, 1));
        r.sweep([U([side * 1.2, 0.2, WAIST]), G([side * 3.8 + wind[0] * 0.6, 1.4 + wind[1] * 0.8, 7]), G([side * 4.6 + wind[0], 0.6 + wind[1] * 1.6, 3.4])], [Rr(2.6), Rr(2.4), Rr(2.2)], mat(st.robe, 2, { shader: hemShader(st, 0.86) }));
      }
      // the robe's back panel spills over the horse's rump
      r.sweep([U([0, -1.6, WAIST]), G([wind[0], -3.4 + wind[1] * 0.6, 9]), G([wind[0] * 1.5, -5 + wind[1] * 1.2, 7.4])], [Rr(2.6), Rr(2.8), Rr(2.2)], mat(st.robe, 2, { shader: hemShader(st, 0.84) }));
    } else if (stance === "sit") {
      // lotus position: crossed knees and a wide pooled skirt
      r.ellipsoid(G([0, 0.5, 2.4]), [Rr(7.4), Rr(5.2), Rr(2.6)], mat(st.robe, 2, { shader: hemShader(st, 0.55) }));
      r.ellipsoid(G([-4.4, 2.2, 2.4]), [Rr(2.4), Rr(2.6), Rr(1.8)], mat(st.robe, 2));
      r.ellipsoid(G([4.4, 2.2, 2.4]), [Rr(2.4), Rr(2.6), Rr(1.8)], mat(st.robe, 2));
      r.ellipsoid(G([3.2, 3.8, 1.6]), [Rr(1.1), Rr(1.6), Rr(0.9)], mat(st.shoes, 1));
    } else {
      for (const [f, side] of [
        [fl, -1],
        [fr, 1],
      ] as const) {
        const hip: V3 = [side * 1.5, 0, 9 - drop * 0.6];
        const ankle: V3 = [f[0], f[1], f[2] + 1.4];
        const knee: V3 = stance === "kneel" ? [side * 1.8, 3.4, 1.4] : [(hip[0] + ankle[0]) / 2, (hip[1] + ankle[1]) / 2 + 0.6, (hip[2] + ankle[2]) / 2];
        r.sweep([G(hip), G(knee), G(ankle)], Rr(1.25), mat(st.inner, 1));
        r.ellipsoid(G([f[0], f[1] + 0.6, f[2] + 0.9]), [Rr(1.2), Rr(1.8), Rr(1.0)], mat(st.shoes, 1, { shader: (s, tone) => (s.p[2] - lift < 0.4 * S + f[2] ? tone(st.shoes, 1) : tone(st.shoes)) }));
      }
      const shift = ((fl[1] + fr[1]) / 2) * 0.4;
      const flare = st.flare ?? 5.3;
      const hemZ = stance === "kneel" ? 1.6 : hem + 1.2;
      const hemC: V3 = [wind[0] * 1.2, shift + wind[1] * 1.2, hemZ];
      const skirtMat = mat(st.robe, 2, { shader: hemShader(st, 0.93), dither: k > 1 });
      r.sweep([U([0, 0, WAIST]), G([hemC[0] * 0.5, hemC[1] * 0.5, (WAIST - drop + hemZ) / 2 + 1]), G(hemC)], (u) => Rr(3.3 + (flare - 3.5) * Math.pow(u, 1.5)), skirtMat);
      const hemShaderZ: Shader = (s, tone) => (s.n[2] < -0.05 ? tone(st.trim) : hemShader(st, 2)(s, tone));
      r.ellipsoid(G(hemC), [Rr(flare + 0.1), Rr(flare + 0.1), Rr(1.1)], mat(st.robe, 2, { shader: hemShaderZ, dither: k > 1 }), 0.8);
    }
  }

  // ------------------------------------------------------------------ torso
  const torsoShader: Shader = (s, tone) => {
    const z = (s.p[2] - lift) / S - bob;
    if (Math.abs(z - WAIST) < 0.95) return tone(st.sash);
    // crossed collar (jiaoling), right over left
    const ly = s.n[1];
    const lx = s.n[0];
    if (ly > 0.2 && z > 13.5) {
      const edge = (z - 13.5) * 0.42;
      if (lx > -edge - 0.05 && lx < edge * 0.55) return tone(st.inner);
      if (Math.abs(lx + edge) < 0.16 || Math.abs(lx - edge * 0.55) < 0.12) return tone(st.trim);
    }
    return tone(st.robe);
  };
  r.sweep([U([0, 0, WAIST - 0.6]), U([0, 0.1, 15]), U([0, 0, 17.2])], [Rr(3.1), Rr(3.4), Rr(3.6)], mat(st.robe, 3, { shader: torsoShader }));
  r.sphere(U([0, 0.2, 18.6]), Rr(1.5), skin);

  // ------------------------------------------------------------------ head
  const head = U([0, 0.5, HEAD_Z]);
  const HR = Rr(HEAD_R);
  const style = st.hairStyle;
  const headShader: Shader = (s, tone) => {
    const [x, y, z] = s.n;
    if (style !== "bald") {
      const female = !!st.female;
      const fringe = female ? 0.3 + 0.11 * Math.abs(Math.sin(x * 10)) : 0.42 + 0.08 * Math.abs(Math.sin(x * 8));
      const back = y < (female ? 0.12 : -0.05);
      const sides = female && Math.abs(x) > 0.74 && z > -0.45 && y < 0.62;
      const capped = z > fringe || back || sides || (style === "wild" && z > 0.15 && y < 0.5);
      if (capped) {
        // glossy "angel ring" highlight band
        if (z > 0.48 && z < 0.62 && s.lum > 0.55) return st.hair[0];
        return tone(st.hair);
      }
    }
    return tone(st.skin);
  };
  r.sphere(head, HR, mat(st.skin, 6, { shader: headShader }));

  // hair volumes
  const sway = Math.sin(t) * 0.7;
  if (style === "long" || (style === "bun" && st.female)) {
    const len = style === "long" ? 1 : 0.82;
    const pts = spline(
      [U([0, -4.6, 26]), U([sway * 0.3, -5.6, 21.5]), U([wind[0] * 2 + sway * 0.6, -6.2 + wind[1] * 2, 21 - 7 * len]), U([wind[0] * 3.2 + sway, -6.3 + wind[1] * 3.4, 21 - 12 * len])],
      4,
    );
    r.sweep(pts, [Rr(4.4), Rr(4.0), Rr(3.0), Rr(1.4)], mat(st.hair, 7, { shader: strandShader(st.hair) }));
  }
  if (st.female && style !== "bald") {
    for (const side of [-1, 1]) {
      r.sweep(
        [U([side * 5.3, 2.3, 25.5]), U([side * 5.7 + wind[0], 2.6 + wind[1] * 0.4, 21.5]), U([side * 5.4 + wind[0] * 1.5, 2.4 + wind[1] * 0.6, 18.8])],
        [Rr(1.3), Rr(1.0), Rr(0.6)],
        hairM,
      );
    }
  }
  if (style === "bun") {
    r.sphere(U([0, -2.6, 30.3]), Rr(2.8), mat(st.hair, 7, { shader: strandShader(st.hair) }));
    r.sweep([U([-4, -1.6, 30.6]), U([3.8, -3, 32])], Rr(0.45), mat(PAL.jade, 8));
    r.sphere(U([3.9, -3.05, 32.1]), Rr(0.75), mat(PAL.gold, 8));
    // dangling buyao ornament
    const ds = Math.sin(t * 1.3) * 0.8 + wind[1] * 0.6;
    r.sweep([U([3.6, -2.8, 31.4]), U([3.8, -2.6 + ds, 28.8])], Rr(0.25), mat(PAL.gold, 8));
    r.sphere(U([3.8, -2.6 + ds, 28.4]), Rr(0.55), mat(PAL.red, 8));
  } else if (style === "twin") {
    for (const side of [-1, 1]) {
      r.sphere(U([side * 4.3, -1.2, 29.2]), Rr(2.3), mat(st.hair, 7, { shader: strandShader(st.hair) }));
      r.sweep([U([side * 5.6, -1.6, 28.6]), U([side * 6.4 + wind[0], -3 + wind[1] * 1.5, 25 + sway * 0.4])], Rr(0.5), mat(st.trim, 8));
    }
  } else if (style === "topknot") {
    r.sphere(U([0, -0.8, 31]), Rr(2), mat(st.hair, 7, { shader: strandShader(st.hair) }));
    r.sweep([U([-2.2, -0.8, 31.4]), U([2.2, -0.8, 31.4])], Rr(0.45), mat(PAL.gold, 8));
  } else if (style === "wild") {
    for (let i = 0; i < 7; i++) {
      const a = -1.2 + (i / 6) * 2.4;
      r.sweep([U([Math.sin(a) * 4.5, -1.5 - Math.cos(a) * 2, 28.5]), U([Math.sin(a) * 7.2 + wind[0], -4.5 - Math.cos(a) * 2.5 + wind[1], 31 + Math.cos(a * 2) * 1.5])], [Rr(2), Rr(0.4)], hairM);
    }
  } else if (style === "short") {
    r.sphere(U([0, -1.6, 27.5]), Rr(4.6), mat(st.hair, 7));
  }

  // fox ears (Hu Li)
  if (st.foxEars) {
    for (const side of [-1, 1]) {
      const base = U([side * 3.3, -0.6, 29]);
      const tip = U([side * 5.2, -1.4 + Math.sin(t * 2 + side) * 0.3, 34.2]);
      r.sweep([base, tip], [Rr(1.8), Rr(0.3)], mat(st.foxEars, 7, { shader: (s, tone) => (s.n[1] > 0.4 && s.u < 0.75 ? tone(PAL.rose) : tone(st.foxEars!)) }));
    }
  }

  // horns: a dragon's antlers sweep back and branch; a ram's curl round beside the ears
  if (st.horns) {
    const hm = mat(st.horns, 7, { shader: (s, tone) => tone(st.horns!, s.u > 0.7 ? -1 : 0) });
    for (const side of [-1, 1]) {
      if (st.hornStyle === "ram") {
        const pts: V3[] = [];
        for (let k = 0; k <= 6; k++) {
          const a = (k / 6) * Math.PI * 1.5;
          pts.push(U([side * (5 + Math.sin(a) * 3 + k * 0.2), 0.4 - Math.cos(a) * 2.4, 30.4 - (1 - Math.cos(a)) * 2]));
        }
        r.sweep(spline(pts, 3), (u) => Rr(1.9 - u * 1.3), hm);
      } else {
        const base = U([side * 2.4, -0.8, 29.4]);
        const mid = U([side * 3.8, -3.2, 33]);
        const tip = U([side * 4.6, -6.2, 35.4]);
        r.sweep([base, mid, tip], [Rr(0.9), Rr(0.6), Rr(0.25)], hm);
        r.sweep([mid, U([side * 5.6, -2.6, 35])], [Rr(0.45), Rr(0.2)], hm);
      }
    }
  }
  // fins: a translucent fan behind each ear, ribbed, rippling
  if (st.fins) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const z = 25.6 + k * 1.4;
        r.sweep([U([side * 5.6, -0.4, z]), U([side * (8.2 - k * 0.6), -2.2 + Math.sin(t * 2 + k + side) * 0.4, z + 1.6])], [Rr(0.7), Rr(0.2)], mat(st.fins, 7, { shader: (s, tone) => tone(st.fins!, s.u > 0.6 ? -1 : 0) }));
      }
    }
  }
  // shards: crystal grown out of the crown and the shoulders, catching the light
  if (st.shards) {
    const cm = mat(st.shards, 7, { shader: (s, tone) => (s.n[2] > 0.6 ? "#ffffff" : tone(st.shards!, s.n[0] > 0.3 ? -1 : 0)) });
    for (const [x, y, z, h, lean] of [
      [0, -1.4, 30.6, 4.2, 0],
      [-2, -0.8, 30, 3, -0.6],
      [2, -0.8, 30, 3, 0.6],
      [-5.2, -1.2, 16.6, 3.4, -1],
      [5.2, -1.2, 16.6, 3.4, 1],
    ] as [number, number, number, number, number][])
      r.sweep([U([x, y, z]), U([x + lean, y - 0.4, z + h])], [Rr(1.1), Rr(0.15)], cm);
  }

  // ------------------------------------------------------------------ hats
  const hat = st.hat ?? "none";
  const hatR = st.hatRamp ?? PAL.straw;
  const hc = U([0, 0.5, 29]);
  const zAt = (z: number) => U([0, 0.5, z])[2];
  if (hat === "straw") {
    r.cone(hc[0], hc[1], Rr(10.5), zAt(28.6), Rr(0.6), zAt(34.5), 14, mat(hatR, 9, { shader: strawShader(hatR) }));
  } else if (hat === "scholar") {
    r.box(U([-3.2, -2.2, 29.5]), U([3.2, 2.4, 32.2]), mat(hatR, 9));
    r.sweep([U([-6.5, -1.6, 30.8]), U([6.5, -1.6, 30.8])], Rr(0.55), mat(hatR, 9));
  } else if (hat === "crown") {
    r.prism(hc[0], hc[1] - 0.8 * S, Rr(2.3), zAt(29.6), zAt(32.4), 6, mat(hatR, 9));
    r.sweep([U([0, -3.5, 31.4]), U([0, 3, 31.4])], Rr(0.4), mat(PAL.jade, 9));
  } else if (hat === "jiangshi") {
    r.prism(hc[0], hc[1], Rr(5.2), zAt(28.6), zAt(33), 10, mat(hatR, 9));
    r.box(U([-6.6, -2.8, 28.2]), U([6.6, 3.2, 29.2]), mat(hatR, 9));
    r.sphere(U([0, -0.5, 33.6]), Rr(1.2), mat(PAL.red, 9));
  } else if (hat === "hood") {
    const hood: Shader = (s, tone) => (s.n[1] > 0.35 && s.n[2] < 0.5 ? null : tone(hatR));
    r.sphere(add(head, [0, -0.6 * S, 0.6 * S]), HR + Rr(1.1), mat(hatR, 9, { shader: hood }));
  } else if (hat === "veil") {
    r.cone(hc[0], hc[1], Rr(9), zAt(29), Rr(1), zAt(33.5), 12, mat(hatR, 9));
  } else if (hat === "helmet") {
    // a soldier's iron helmet: a domed bowl with a spike and plume on top, and lamellar flaps over the neck
    const helm: Shader = (s, tone) => (s.n[2] > 0.18 || (s.n[1] < -0.25 && s.n[2] > -0.55) ? tone(hatR, Math.sin(s.n[2] * 14) > 0.8 ? 1 : 0) : null);
    r.sphere(add(head, [0, -0.4 * S, 0.5 * S]), HR + Rr(0.9), mat(hatR, 9, { shader: helm }));
    r.cone(hc[0], hc[1] - 0.2 * S, Rr(1.2), zAt(31.6), Rr(0.2), zAt(35.4), 6, mat(hatR, 9));
    r.sweep([U([0, -0.4, 35]), U([wind[0] * 1.6, -2.4 + wind[1] * 1.6, 33.4 + Math.sin(t * 2) * 0.4])], [Rr(0.9), Rr(0.3)], mat(PAL.red, 9));
  }

  // ------------------------------------------------------------------ arms
  const handL = p.handL ?? REST_HAND_L;
  const handR = p.handR ?? REST_HAND_R;
  const cuff = st.sleeve ?? 2.4;
  for (const [hand, side, group] of [
    [handL, -1, 4],
    [handR, 1, 5],
  ] as const) {
    const sh = U([side * 3.9, 0, SHOULDER_Z]);
    const hw = U(hand);
    const mid: V3 = [(sh[0] + hw[0]) / 2 + side * 1.2 * S, (sh[1] + hw[1]) / 2 - 0.5 * S, (sh[2] + hw[2]) / 2 - 0.6 * S];
    const dir = norm(sub(hw, mid));
    const wrist = sub(hw, scale3(dir, 0.9 * S));
    const sleeve = mat(st.robe, group, { shader: (s, tone) => (s.u > 0.84 ? tone(st.trim) : tone(st.robe)) });
    r.sweep([sh, mid, wrist], [Rr(1.5), Rr(1.8), Rr(cuff)], sleeve);
    // hanging bell sleeve
    r.sweep([add(mid, [0, 0, -0.8 * S]), add(wrist, [wind[0] * 0.8 * S, wind[1] * 0.8 * S, -1.9 * S])], [Rr(1.1), Rr(cuff - 0.4)], mat(st.robe, group));
    r.sphere(hw, Rr(1.15), mat(st.skin, group));
  }

  // ------------------------------------------------------------------ weapons
  const sword = p.sword ?? (st.weapon === "jian" ? "sheath" : "none");
  const wr = st.weaponRamp ?? PAL.steel;
  const hR = U(handR);
  const swordDir = norm(p.swordDir ?? [0.2, 0.5, -0.8]);
  if (sword === "hand" && (st.weapon === "jian" || st.weapon === "saber")) {
    const guard = add(hR, scale3(swordDir, 1.2 * S));
    const len = st.weapon === "saber" ? 13 : 12.5;
    const pts: V3[] = [];
    for (let i = 0; i <= 6; i++) {
      const f = i / 6;
      const curve = st.weapon === "saber" ? Math.sin(f * Math.PI * 0.6) * 1.6 : 0;
      pts.push(add(add(guard, scale3(swordDir, len * f * S)), [0, 0, curve * S]));
    }
    r.sweep(pts, (u) => Rr(u > 0.88 ? 0.2 + (1 - u) * 3 : st.weapon === "saber" ? 0.75 : 0.55), mat(wr, 9, { shader: (s, tone) => (s.lum > 0.6 ? "#ffffff" : tone(wr)) }));
    r.ellipsoid(guard, [Rr(1.1), Rr(1.1), Rr(0.7)], mat(PAL.gold, 9));
    r.sweep([sub(hR, scale3(swordDir, 0.4 * S)), sub(hR, scale3(swordDir, 2.8 * S))], Rr(0.5), mat(PAL.black, 9));
    const pom = sub(hR, scale3(swordDir, 3 * S));
    r.sweep([pom, add(pom, [wind[0] * 1.5 * S, wind[1] * 1.5 * S, -2.5 * S + Math.sin(t * 2) * 0.4])], Rr(0.4), mat(PAL.red, 9));
  } else if (sword === "sheath" && st.weapon === "jian") {
    r.sweep([U([-3.6, 1.8, 13.4]), U([-3.6, -0.4, 12.6]), U([-4.3, -6.6, 8.6])], [Rr(0.55), Rr(0.7), Rr(0.6)], mat(PAL.navy, 9, { shader: (s, tone) => (s.u < 0.12 || s.u > 0.9 ? tone(PAL.gold) : tone(PAL.navy)) }));
  } else if (sword === "under") {
    r.sweep(
      [G([0, 10, -1.2]), G([0, 7, -1.2]), G([0, -6.5, -1.2])],
      (u) => Rr(u < 0.15 ? 0.25 + u * 4 : 0.85),
      mat(PAL.steel, 9, { shader: (s, tone) => (s.lum > 0.55 ? "#ffffff" : tone(PAL.steel)) }),
    );
    r.ellipsoid(G([0, -6.8, -1.2]), [Rr(1.8), Rr(0.8), Rr(0.7)], mat(PAL.gold, 9));
    r.sweep([G([0, -7.2, -1.2]), G([0, -9.6, -1.2])], Rr(0.55), mat(PAL.black, 9));
    r.sweep([G([0, -9.8, -1.2]), G([Math.sin(t * 2) * 0.8, -12.5, -0.6])], Rr(0.45), mat(PAL.red, 9));
  }
  if (st.weapon === "staff") {
    r.sweep([add(hR, [0, 0.4 * S, 6 * S]), add(hR, [0, 0.8 * S, -11 * S])], Rr(0.6), mat(st.weaponRamp ?? PAL.wood, 9));
    r.sphere(add(hR, [0, 0.4 * S, 6.6 * S]), Rr(1.3), mat(PAL.jade, 9));
  } else if (st.weapon === "whisk") {
    r.sweep([hR, add(hR, [0, 1.2 * S, 3.6 * S])], Rr(0.4), mat(PAL.wood, 9));
    const top = add(hR, [0, 1.2 * S, 3.6 * S]);
    r.sweep([top, add(top, [wind[0] * 2 * S + Math.sin(t) * 0.6, 2.2 * S + wind[1] * 2 * S, -5 * S])], [Rr(0.9), Rr(1.1), Rr(0.5)], mat(PAL.white, 9));
  } else if (st.weapon === "fan") {
    for (let i = 0; i < 7; i++) {
      const a = -0.9 + (i / 6) * 1.8;
      r.sweep([hR, add(hR, [Math.sin(a) * 4 * S, 1.5 * S, Math.cos(a) * 4 * S])], [Rr(0.3), Rr(0.9)], mat(st.weaponRamp ?? PAL.paper, 9));
    }
  } else if (st.weapon === "rod") {
    const tip = add(hR, [1 * S, 14 * S, 9 * S]);
    r.sweep([sub(hR, [0, 1.5 * S, 1 * S]), tip], [Rr(0.55), Rr(0.25)], mat(PAL.woodDark, 9));
    r.sweep([tip, add(tip, [0, 1.5 * S, -12 * S + Math.sin(t) * 0.5])], Rr(0.15), mat(PAL.white, 9));
  }
  if (st.weapon === "spear") {
    // a long spear: levelled along the thrust in a drill or a charge, otherwise held upright at the soldier's side
    const head = sword === "hand" ? add(hR, scale3(swordDir, 14 * S)) : add(hR, [0, 0.6 * S, 17 * S]);
    const butt = sword === "hand" ? sub(hR, scale3(swordDir, 7 * S)) : add(hR, [0, 0.6 * S, -11 * S]);
    r.sweep([butt, head], Rr(0.5), mat(st.weaponRamp ?? PAL.wood, 9));
    const d = norm(sub(head, butt));
    r.sweep([head, add(head, scale3(d, 3.4 * S))], [Rr(0.95), Rr(0.1)], mat(PAL.steel, 9, { shader: (s2, tone) => (s2.lum > 0.6 ? "#ffffff" : tone(PAL.steel)) }));
    r.sweep([sub(head, scale3(d, 0.4 * S)), add(sub(head, scale3(d, 2.4 * S)), [wind[0] * 1.4 * S, wind[1] * 1.4 * S, -0.6 * S])], [Rr(1), Rr(0.4)], mat(PAL.red, 9));
  }
  if (sword !== "hand" && st.weapon === "saber") {
    r.sweep([U([-3.8, 2, 12.6]), U([-4.3, -6, 8.2])], [Rr(0.7), Rr(0.9)], mat(st.weaponRamp ?? PAL.crimson, 9));
  }

  // ------------------------------------------------------------------ things held in the hands
  if (p.held === "flute") {
    // a bamboo dizi held out to the right of the lips, with a red tassel
    const lips = U([0.6, 5.8, 21.6]);
    const end = add(U(handR), [1.6 * S, -0.6 * S, -0.2 * S]);
    r.sweep([lips, end], Rr(0.45), mat(ramp4("#e8c878", "#c8a050", "#8a6a30", "#4a3418"), 9, { shader: (s, tone) => (Math.sin(s.u * 40) > 0.85 ? "#3a2410" : tone(ramp4("#e8c878", "#c8a050", "#8a6a30", "#4a3418"))) }));
    r.sweep([end, add(end, [wind[0] * S, wind[1] * S, -2.4 * S])], Rr(0.3), mat(PAL.red, 9));
  } else if (p.held === "bowl") {
    const bowl = add(U(handL), [0.6 * S, 0.6 * S, 0.8 * S]);
    r.ellipsoid(bowl, [Rr(1.7), Rr(1.7), Rr(1)], mat(ramp4("#ffffff", "#e8eef8", "#9aa8c8", "#4a5a7a"), 9, { shader: (s, tone) => (s.n[2] > 0.55 ? tone(PAL.paper) : Math.abs(s.n[2]) < 0.2 ? tone(PAL.azure) : tone(ramp4("#ffffff", "#e8eef8", "#9aa8c8", "#4a5a7a"))) }));
    const tip = U(handR);
    for (const dx of [-0.3, 0.3]) r.sweep([add(tip, [dx * S, -0.6 * S, -0.4 * S]), add(tip, [dx * S - 0.6 * S, 3 * S, 0.6 * S])], Rr(0.18), mat(PAL.woodDark, 9));
  } else if (p.held === "balls") {
    const cols = [PAL.red, PAL.gold, PAL.jade];
    for (let b = 0; b < 3; b++) {
      const a = t + (b * Math.PI * 2) / 3;
      // tossed in an arc that peaks above the juggler's head
      r.sphere(U([Math.cos(a) * 4.6, 4, 34 + Math.sin(a) * 5]), Math.max(1.1, Rr(1.2)), mat(cols[b], 9));
    }
  } else if (p.held === "hammer") {
    // a smith's hammer: an ash haft and a dark iron head, swung from the right hand
    const grip = U(handR);
    const head = add(grip, [0.4 * S, 2.2 * S, 4.6 * S]);
    r.sweep([sub(grip, [0, 0.4 * S, 1.2 * S]), head], Rr(0.4), mat(PAL.wood, 9));
    r.sweep([add(head, [-1.4 * S, 0, 0]), add(head, [1.4 * S, 0, 0])], Rr(1.1), mat(ramp4("#a8a8b8", "#5a5a6a", "#3a3a4a", "#1a1a26"), 9));
  } else if (p.held === "brush") {
    // a writing brush, its tip dark with ink
    const grip = U(handR);
    const tip = add(grip, [0.2 * S, 1.2 * S, -2.6 * S]);
    r.sweep([add(grip, [0, -0.4 * S, 2.4 * S]), tip], [Rr(0.3), Rr(0.22)], mat(PAL.woodDark, 9));
    r.sweep([tip, add(tip, [0, 0.2 * S, -1 * S])], [Rr(0.35), Rr(0.08)], mat(PAL.black, 9));
  } else if (p.held === "lantern") {
    // a round paper lantern on a short pole, swinging a little
    const grip = U(handR);
    const top = add(grip, [0.6 * S, 1.6 * S, 4 * S]);
    r.sweep([sub(grip, [0, 0, 0.8 * S]), top], Rr(0.3), mat(PAL.woodDark, 9));
    const c = add(top, [Math.sin(t) * 0.6 * S, 0.4 * S, -2.6 * S]);
    r.sweep([top, c], Rr(0.15), mat(PAL.black, 9));
    r.ellipsoid(c, [Rr(1.8), Rr(1.8), Rr(2.1)], mat(ramp4("#fff0b0", "#ff6a3a", "#c02a2a", "#6a0a1a"), 9, { shader: (s, tone) => (Math.abs(s.n[2]) > 0.8 ? tone(PAL.gold) : tone(ramp4("#fff0b0", "#ff6a3a", "#c02a2a", "#6a0a1a"), s.n[0] > 0.3 ? -1 : 0)) }));
  }

  else if (p.held === "hoe") {
    // a farmer's hoe gripped in both hands, its iron blade biting down at the far end
    const a = U(handR);
    const b = U(p.handL ?? REST_HAND_L);
    const d = sub(b, a);
    const end = add(b, scale3(d, 1.4));
    r.sweep([sub(a, scale3(d, 0.3)), end], Rr(0.4), mat(PAL.wood, 9));
    r.sweep([end, add(end, [0, 1.4 * S, -2.8 * S])], [Rr(1.4), Rr(1.1)], mat(ramp4("#c8c8d8", "#7a7a8a", "#4a4a5a", "#22222e"), 9));
  } else if (p.held === "axe") {
    // a woodsman's axe: a long haft and a broad wedge of a head
    const grip = U(handR);
    const head = add(grip, [0.2 * S, 2.6 * S, 6.4 * S]);
    r.sweep([sub(grip, [0, 0.6 * S, 1.6 * S]), head], Rr(0.45), mat(PAL.wood, 9));
    r.sweep([head, add(head, [0, 2.6 * S, -0.4 * S])], [Rr(1.5), Rr(0.3)], mat(ramp4("#e8eef8", "#9aa8bc", "#5a6a7e", "#2a3242"), 9));
  } else if (p.held === "pole") {
    // a carrying pole across the shoulders, a basket swinging from each end
    const sw = Math.sin(t) * 0.8;
    const l = U([-9, -0.4, 18.4]);
    const rr = U([9, -0.4, 18.4]);
    r.sweep([l, U([0, -0.8, 19]), rr], Rr(0.45), mat(PAL.straw, 9));
    for (const [e, k] of [
      [l, -1],
      [rr, 1],
    ] as const) {
      const bk = add(e, [0, sw * k * S, -8 * S]);
      for (const o of [-1.2, 1.2]) r.sweep([e, add(bk, [o * S, 0, 2.6 * S])], Rr(0.12), mat(PAL.black, 9));
      r.cone(bk[0], bk[1], Rr(2.6), bk[2] - Rr(2), Rr(3), bk[2] + Rr(2.6), 8, mat(PAL.straw, 9, { shader: strawShader(PAL.straw) }));
      r.sphere(add(bk, [0, 0, 2.6 * S]), Rr(1.8), mat(k < 0 ? PAL.green : PAL.orange, 9));
    }
  } else if (p.held === "shuttlecock") {
    // a feathered jianzi kicked high into the air
    const c = U(p.toss ?? [2, 4, 30]);
    r.sphere(c, Math.max(1.1, Rr(1.2)), mat(PAL.gold, 9));
    for (let f = 0; f < 3; f++) r.sweep([c, add(c, [(f - 1) * 1.2, 0, 3.6])], [0.9, 0.4], mat([PAL.red, PAL.white, PAL.jade][f], 9));
  } else if (p.held === "umbrella") {
    // an oiled-paper umbrella held overhead, its painted ribs turning slowly
    const grip = U(handR);
    const top = add(grip, [-0.6 * S, -0.4 * S, 18 * S]);
    r.sweep([grip, top], Rr(0.3), mat(PAL.woodDark, 9));
    const paper = ramp4("#ffe0e8", "#e86a7a", "#a83a5a", "#5a1a3a");
    r.cone(top[0], top[1], Rr(11), top[2] - Rr(4.4), Rr(0.6), top[2] + Rr(0.6), 16, mat(paper, 10, { shader: (s, tone) => (Math.sin(Math.atan2(s.p[1] - top[1], s.p[0] - top[0]) * 8 + t * 2) > 0.85 ? tone(PAL.woodDark) : tone(paper, s.n[2] > 0.6 ? -1 : 0)) }));
  }

  if (p.held === "pickaxe") {
    // a miner's pick: a long haft and a curved iron head pointed at both ends
    const grip = U(handR);
    const head = add(grip, [0.2 * S, 4 * S, 7.4 * S]);
    r.sweep([sub(grip, [0, 0.6 * S, 1.6 * S]), head], Rr(0.6), mat(PAL.wood, 9));
    r.sweep([add(head, [0, -4 * S, -1.4 * S]), head, add(head, [0, 4 * S, -2 * S])], [Rr(0.4), Rr(1.3), Rr(0.4)], mat(ramp4("#d8dce8", "#8a90a8", "#4a5068", "#22263a"), 9));
  } else if (p.held === "torch") {
    // a pitch torch held high, its flame leaning with the wind
    const grip = U(handR);
    const top = add(grip, [0.6 * S, 1.2 * S, 8 * S]);
    r.sweep([sub(grip, [0, 0, 2 * S]), top], [Rr(0.55), Rr(0.8)], mat(PAL.woodDark, 9));
    const fire = ramp4("#fff6c0", "#ffb040", "#f0601e", "#a81a10");
    for (let k = 0; k < 3; k++) r.sweep([add(top, [Math.cos(k * 2.1) * 0.4 * S, 0, 0]), add(top, [wind[0] * 0.8 * S + Math.sin(t * 3 + k) * 0.6 * S, wind[1] * 0.6 * S, (4.4 + k * 0.8 + Math.sin(t * 2 + k)) * S])], [Rr(1.7), Rr(0.2)], mat(fire, 9, { outline: undefined, shader: (s, tone) => tone(fire, s.u > 0.6 ? 1 : s.u < 0.3 ? -1 : 0) }));
  } else if (p.held === "ladle") {
    // a long wooden ladle dipped into the brew
    const a = U(handL);
    const b = U(handR);
    const d = sub(b, a);
    const bowl = add(b, scale3(d, 1.6));
    r.sweep([a, bowl], Rr(0.55), mat(PAL.wood, 9));
    r.sphere(add(bowl, [0, 0, -0.6 * S]), Rr(1.6), mat(PAL.woodDark, 9));
  } else if (p.held === "fireball") {
    // a ball of qi-fire cupped between the palms, flaring as it is thrust out
    const c = scale3(add(U(handL), U(handR)), 0.5);
    const ball = add(c, [0, 1.6 * S, 0.4 * S]);
    const fire = ramp4("#ffffff", "#fff0a0", "#ffb040", "#f0601e");
    r.sphere(ball, Math.max(1.4, Rr(2 + Math.sin(t * 3) * 0.3)), mat(fire, 9, { outline: undefined }));
    for (let k = 0; k < 4; k++) r.sweep([ball, add(ball, [Math.cos(t * 2 + k * 1.6) * 2.4 * S, Math.sin(t * 2 + k * 1.6) * 1.4 * S, (2.6 + Math.sin(t * 3 + k)) * S])], [Rr(0.9), Rr(0.1)], mat(ramp4("#fff6c0", "#ffb040", "#f0601e", "#a81a10"), 9, { outline: undefined }));
  }

  if (p.held === "rake") {
    // a bamboo leaf rake drawn across the ground in both hands, its fan of tines scraping
    const a = U(handR);
    const b = U(p.handL ?? REST_HAND_L);
    const d = sub(a, b);
    const foot = add(a, scale3(d, 1.6));
    const end: V3 = [foot[0], foot[1], Math.max(G([0, 0, 0.6])[2], foot[2] - 8 * S)];
    r.sweep([sub(b, scale3(d, 0.2)), end], Rr(0.35), mat(PAL.straw, 9));
    for (let k = -3; k <= 3; k++) r.sweep([end, add(end, [k * 0.9 * S, 1.6 * S, -0.6 * S])], Rr(0.18), mat(PAL.straw, 9));
  } else if (p.held === "seedling") {
    // a bundle of green rice seedlings, one pressed into the mud at a time
    const c = U(handL);
    for (let k = 0; k < 4; k++) r.sweep([c, add(c, [(k - 1.5) * 0.5 * S, 0.4 * S, 3 * S])], Rr(0.22), mat(PAL.green, 9));
    const tip = U(handR);
    r.sweep([tip, add(tip, [0, 0.3 * S, 2.4 * S])], Rr(0.2), mat(PAL.green, 9));
  } else if (p.held === "snowball") {
    const c = add(U(p.toss ? p.toss : handR), [0, 0.4 * S, 0.6 * S]);
    r.sphere(c, Math.max(1.1, Rr(1.4)), mat(ramp4("#ffffff", "#f0f6ff", "#c8d8f0", "#8a9ab8"), 9));
  } else if (p.held === "kite") {
    // a paper carp kite flying high on a long string, tugging on the wind
    const grip = U(handR);
    const kite = add(grip, [3 * S + Math.sin(t) * 1.2 * S, 10 * S, 22 * S + Math.cos(t * 2) * 1.4 * S]);
    r.sweep(spline([grip, add(grip, [1.6 * S, 5 * S, 8 * S]), kite], 4), Rr(0.1), mat(PAL.white, 9));
    r.ellipsoid(kite, [Rr(2.4), Rr(0.5), Rr(1.6)], mat(ramp4("#fff0b0", "#ff6a3a", "#c02a2a", "#6a0a1a"), 9));
    r.sweep([kite, add(kite, [wind[0] * S - 1 * S, -2 * S, -3.6 * S + Math.sin(t * 3) * 0.6 * S])], [Rr(0.8), Rr(0.1)], mat(PAL.gold, 9));
  }

  if (p.held === "warbanner") {
    // a war banner on a tall pole, both hands on it, the silk streaming out and rippling
    const grip = U(handR);
    const low = U(p.handL ?? REST_HAND_L);
    const d = norm(sub(grip, low));
    const top = add(grip, scale3(d, 20 * S));
    r.sweep([sub(low, scale3(d, 3 * S)), top], Rr(0.45), mat(PAL.woodDark, 9));
    r.sphere(top, Rr(0.9), mat(PAL.gold, 9));
    for (let k = 0; k < 4; k++) {
      const z = -1.4 - k * 2.6;
      const pts: V3[] = [];
      for (let q = 0; q <= 5; q++) {
        const w = Math.sin(t * 2 - q * 0.9 + k * 0.3) * (q / 5) * 1.6;
        pts.push(add(top, [(q * 1.7 + w * 0.4) * S, (wind[1] * q * 0.4 + w * 0.5) * S, (z - q * 0.3 + w * 0.3) * S]));
      }
      const silk = st.trim;
      r.sweep(pts, Rr(1.5), mat(k === 0 ? PAL.gold : silk, 10, { shader: (s2, tone) => (k === 1 && s2.u > 0.3 && s2.u < 0.6 ? tone(PAL.gold) : tone(k === 0 ? PAL.gold : silk)) }));
    }
  } else if (p.held === "drum") {
    // a war drum slung at the hip, beaten with a stick in each hand
    const c = U([0, 5.6, 9.4]);
    r.ellipsoid(c, [Rr(3.4), Rr(2.4), Rr(2.6)], mat(PAL.crimson, 9, { shader: (s2, tone) => (s2.n[1] > 0.7 ? tone(ramp4("#f4e2c0", "#d8c09a", "#a8885a", "#5a4020")) : Math.abs(s2.n[2]) > 0.75 ? tone(PAL.gold) : tone(PAL.crimson)) }));
    for (const hand of [handL, handR]) {
      const g = U(hand);
      r.sweep([g, add(g, [0, 3.4 * S, -1.6 * S])], Rr(0.3), mat(PAL.wood, 9));
      r.sphere(add(g, [0, 3.6 * S, -1.7 * S]), Rr(0.6), mat(PAL.red, 9));
    }
  } else if (p.held === "bandage") {
    // a roll of clean linen unwound between the hands
    const a = U(handL);
    const b = U(handR);
    r.sphere(b, Rr(1.1), mat(PAL.white, 9));
    r.sweep([a, scale3(add(a, b), 0.5), b], Rr(0.4), mat(ramp4("#ffffff", "#f0f0f6", "#c8c8d8", "#8a8aa0"), 9));
  } else if (p.held === "horn") {
    // a curved ox-horn trumpet raised to the lips
    const lips = U([0.4, 6, 21.4]);
    const bell = add(U(handR), [1.6 * S, 2.2 * S, 3.2 * S]);
    const horn = ramp4("#fff0d0", "#e8c890", "#a8804a", "#5a3a1a");
    r.sweep(spline([lips, add(scale3(add(lips, bell), 0.5), [0, 0, -1.4 * S]), bell], 4), [Rr(0.4), Rr(0.8), Rr(1.6)], mat(horn, 9, { shader: (s2, tone) => (Math.sin(s2.u * 18) > 0.85 ? tone(PAL.gold) : tone(horn)) }));
  }


  if (p.held === "lionhead") {
    // the lion dance's painted head: a great red-and-gold mask held overhead, eyes rolling, jaw snapping, a fringe of mane
    const c = add(scale3(add(U(handL), U(handR)), 0.5), [0, 1.8 * S, 3 * S]);
    const lion = ramp4("#fff0a0", "#e83a2a", "#a81a1a", "#4a0a0a");
    r.ellipsoid(c, [Rr(8), Rr(6.4), Rr(6.6)], mat(lion, 10, { shader: (s2, tone) => (s2.n[1] > 0.6 && Math.abs(s2.n[0]) > 0.25 && Math.abs(s2.n[0]) < 0.6 && s2.n[2] > 0.1 ? "#ffffff" : s2.n[2] > 0.75 ? tone(PAL.gold) : Math.sin(s2.p[0] * 1.4) > 0.8 ? tone(PAL.gold, 1) : tone(lion)) }));
    // the horn and the snapping jaw
    r.sphere(add(c, [0, 1 * S, 5.4 * S]), Rr(1.2), mat(PAL.jade, 10));
    const jaw = Math.sin(t * 2) > 0 ? 1.2 : 0;
    r.ellipsoid(add(c, [0, 4.6 * S, -3.4 * S - jaw * S]), [Rr(4.2), Rr(2), Rr(1.2)], mat(lion, 10));
    for (let k = -3; k <= 3; k++) r.sweep([add(c, [k * 1.6 * S, -2 * S, -4 * S]), add(c, [k * 1.8 * S + wind[0] * S, -4.4 * S + wind[1] * S, -9 * S + Math.sin(t * 3 + k) * 0.8 * S])], [Rr(0.9), Rr(0.3)], mat(k % 2 ? PAL.white : PAL.gold, 10));
  } else if (p.held === "puppet") {
    // a wooden control cross, and a little painted general dangling and dancing on its strings below
    const bar = add(U(handR), [0, 1.6 * S, 0.6 * S]);
    r.sweep([add(bar, [-2.4 * S, 0, 0]), add(bar, [2.4 * S, 0, 0])], Rr(0.35), mat(PAL.woodDark, 9));
    const fig = add(bar, [Math.sin(t) * 1 * S, 1.4 * S, -9 * S + Math.abs(Math.sin(t * 2)) * 1.4 * S]);
    for (const dx of [-2, 2]) r.sweep([add(bar, [dx * S, 0, 0]), add(fig, [dx * 0.6 * S, 0, 2.4 * S])], Rr(0.08), mat(PAL.white, 9));
    r.cone(fig[0], fig[1], Rr(1.6), fig[2] - Rr(3.2), Rr(0.6), fig[2], 8, mat(PAL.crimson, 9));
    r.sphere(add(fig, [0, 0, 1.2 * S]), Rr(1.1), mat(ramp4("#ffffff", "#f4d8c0", "#c89878", "#6a4030"), 9));
    r.sphere(add(fig, [0, 0, 2.4 * S]), Rr(0.7), mat(PAL.black, 9));
  } else if (p.held === "abacus") {
    // a merchant's abacus held flat before the belly, rows of beads clicking along their rods
    const c = add(scale3(add(U(handL), U(handR)), 0.5), [0, 1.4 * S, 0]);
    r.box(add(c, [-3.4 * S, -1.4 * S, -0.4 * S]), add(c, [3.4 * S, 1.4 * S, 0.2 * S]), mat(PAL.woodDark, 9));
    for (let row = 0; row < 3; row++)
      for (let b = 0; b < 5; b++) {
        const slide = (Math.floor(t * 3 + row * 2 + b) % 4 === 0 ? 0.6 : 0) * S;
        r.sphere(add(c, [(-2.6 + b * 1.3) * S + slide, (-0.9 + row * 0.9) * S, 0.6 * S]), Rr(0.45), mat(row === 1 ? PAL.gold : PAL.red, 9));
      }
  } else if (p.held === "firecracker") {
    // a string of red crackers dangling from the hand, the fuse spitting sparks
    const grip = U(handR);
    for (let k = 0; k < 6; k++) {
      const c = add(grip, [Math.sin(t + k) * 0.3 * S, 0.4 * S, -(1.4 + k * 1.3) * S]);
      r.sweep([add(c, [-0.9 * S, 0, 0]), add(c, [0.9 * S, 0, 0])], Rr(0.45), mat(PAL.red, 9, { shader: (s2, tone) => (Math.abs(s2.u - 0.5) > 0.4 ? tone(PAL.gold) : tone(PAL.red)) }));
    }
    const fuse = add(grip, [0, 0.4 * S, -9.4 * S]);
    for (let k = 0; k < 3; k++) r.sphere(add(fuse, [Math.cos(t * 5 + k * 2) * 1.2 * S, Math.sin(t * 5 + k * 2) * 0.8 * S, -0.6 * S]), Math.max(0.8, Rr(0.6)), mat(ramp4("#ffffff", "#fff0a0", "#ffb040", "#f0601e"), 9, { outline: undefined }));
  } else if (p.held === "xiangqi") {
    // a little xiangqi board on the knees: red and black discs, the river across the middle
    const c = G([0, 6.2, 5.6 - 7.5]);
    r.box(add(c, [-3.6 * S, -2.6 * S, -0.4 * S]), add(c, [3.6 * S, 2.6 * S, 0.2 * S]), mat(PAL.wood, 9, { shader: (s2, tone) => (Math.abs(s2.p[1] - c[1]) < 0.3 * S ? tone(PAL.azure) : tone(PAL.wood)) }));
    for (let k = 0; k < 6; k++) r.sphere(add(c, [(-2.8 + (k % 3) * 2.8) * S, (k < 3 ? -1.6 : 1.6) * S, 0.5 * S]), Rr(0.6), mat(k < 3 ? PAL.red : PAL.black, 9));
    r.sphere(add(U(handR), [0, 0.4 * S, -0.6 * S]), Rr(0.6), mat(PAL.red, 9));
  } else if (p.held === "oar") {
    // a long sculling oar, gripped in both hands and dipping back behind her into the water
    const a = U(handR);
    const b = U(p.handL ?? REST_HAND_L);
    const blade: V3 = [b[0] - 2 * S, b[1] - 12 * S, G([0, 0, -1])[2]];
    r.sweep([add(a, [0, 2 * S, 1 * S]), blade], Rr(0.4), mat(PAL.wood, 9));
    r.sweep([blade, add(blade, [0, -3 * S, -0.8 * S])], [Rr(1.3), Rr(1)], mat(PAL.woodDark, 9));
  }

  if (p.held === "pillow") {
    // a fat cotton pillow held overhead between both hands, squashed a little in the middle
    const c = add(scale3(add(U(p.handL ?? REST_HAND_L), U(handR)), 0.5), [0, 0.8 * S, 1.2 * S]);
    r.ellipsoid(c, [Rr(4.6), Rr(2.2), Rr(2.8)], mat(ramp4("#ffffff", "#f4e8f0", "#d8b8d0", "#8a6a8a"), 10, { shader: (s2, tone) => (Math.abs(s2.p[0] - c[0]) < 0.4 * S ? tone(PAL.rose) : tone(ramp4("#ffffff", "#f4e8f0", "#d8b8d0", "#8a6a8a"))) }));
  } else if (p.held === "bucket") {
    // a wooden water bucket hanging from the hand by its rope handle, the water inside catching the light
    const grip = U(handR);
    const c = add(grip, [0, 0.4 * S, -4.2 * S]);
    r.cone(c[0], c[1], Rr(1.9), c[2] - Rr(3.6), Rr(2.5), c[2], 10, mat(PAL.wood, 9, { shader: (s2, tone) => (Math.abs(s2.p[2] - (c[2] - Rr(1.8))) < 0.4 * S ? tone(PAL.black) : tone(PAL.wood)) }));
    r.ellipsoid([c[0], c[1], c[2] - 0.3 * S], [Rr(2.2), Rr(2.2), Rr(0.3)], mat(ramp4("#ffffff", "#9ad8ff", "#4a8ac8", "#1a3a6a"), 9));
    for (const dx of [-2.3, 2.3]) r.sweep([grip, add(c, [dx * S, 0, 0])], Rr(0.2), mat(PAL.straw, 9));
  } else if (p.held === "token") {
    // a jade token on a red cord, held up for the gatekeeper to see
    const g = U(handR);
    r.box(add(g, [-1 * S, 0.2 * S, 0.2 * S]), add(g, [1 * S, 0.7 * S, 3 * S]), mat(PAL.jade, 9, { shader: (s2, tone) => (Math.abs(s2.p[2] - g[2] - 1.6 * S) < 0.25 * S ? tone(PAL.gold) : tone(PAL.jade)) }));
    r.sweep([add(g, [0, 0.4 * S, 0]), add(g, [0.4 * S, 0.6 * S, -2.6 * S])], Rr(0.2), mat(PAL.red, 9));
  } else if (p.held === "pointer") {
    // a hall master's bamboo pointer, raised to make a point
    const g = U(handR);
    r.sweep([add(g, [0, -0.6 * S, -1.6 * S]), add(g, [0.6 * S, 2.4 * S, 6.4 * S])], Rr(0.3), mat(ramp4("#f0f0a0", "#b8c860", "#6a8a3a", "#2a4a1a"), 9, { shader: (s2, tone) => (Math.sin(s2.u * 24) > 0.85 ? tone(PAL.straw) : tone(ramp4("#f0f0a0", "#b8c860", "#6a8a3a", "#2a4a1a"))) }));
  } else if (p.held === "rag") {
    // a wet grey rag under the palm
    r.ellipsoid(add(U(handR), [0, 0.2 * S, -0.8 * S]), [Rr(1.8), Rr(1.3), Rr(0.5)], mat(ramp4("#ffffff", "#c8ccd8", "#8a90a8", "#4a4a5a"), 9));
  }

  if (p.held === "seal") {
    // a registrar's square seal of red jade, its knob carved as a crouching lion, the face wet with cinnabar
    const g = U(handR);
    r.box(add(g, [-1.1 * S, -1.1 * S, -2.6 * S]), add(g, [1.1 * S, 1.1 * S, -0.6 * S]), mat(ramp4("#ffb0a0", "#d8503a", "#9a2a20", "#4a0a10"), 9, { shader: (s2, tone) => (s2.n[2] < -0.5 ? tone(PAL.red) : tone(ramp4("#ffb0a0", "#d8503a", "#9a2a20", "#4a0a10"))) }));
    r.sphere(add(g, [0, 0, 0.1 * S]), Rr(0.9), mat(PAL.gold, 9));
  } else if (p.held === "steelyard") {
    // a steelyard balance: a long beam hung from the left hand, a pan at the short end and the brass weight slid out along the long one
    const g = U(p.handL ?? REST_HAND_L);
    const tilt = Math.sin(t) * 0.8;
    const a = add(g, [-2.4 * S, 1.2 * S, -1 * S + tilt * S]);
    const b = add(g, [7 * S, 1.2 * S, -1 * S - tilt * S]);
    r.sweep([a, b], Rr(0.3), mat(PAL.woodDark, 9, { shader: (s2, tone) => (Math.sin(s2.u * 50) > 0.8 ? tone(PAL.gold) : tone(PAL.woodDark)) }));
    const pan = add(a, [0, 0, -4 * S]);
    for (const o of [-1, 1]) r.sweep([a, add(pan, [o * 1.4 * S, 0, 0.4 * S])], Rr(0.12), mat(PAL.black, 9));
    r.ellipsoid(pan, [Rr(2), Rr(2), Rr(0.5)], mat(PAL.gold, 9));
    const wt = add(a, [(6.2 + Math.cos(t) * 1.4) * S, 1.2 * S - 1.2 * S, -1.6 * S]);
    r.sphere(wt, Rr(0.9), mat(PAL.gold, 9));
  } else if (p.held === "cup") {
    // a little wine cup of white porcelain, raised in the right hand
    const g = add(U(handR), [0, 0.3 * S, 0.6 * S]);
    r.cone(g[0], g[1], Rr(0.7), g[2] - Rr(0.6), Rr(1.3), g[2] + Rr(1), 8, mat(ramp4("#ffffff", "#eef2fa", "#a8b4cc", "#56627a"), 9, { shader: (s2, tone) => (s2.n[2] > 0.6 ? "#b8402a" : tone(ramp4("#ffffff", "#eef2fa", "#a8b4cc", "#56627a"))) }));
  } else if (p.held === "decree") {
    // an imperial decree of yellow silk unrolled between both hands, its rollers capped in jade
    const a = U(p.handL ?? REST_HAND_L);
    const b = U(handR);
    const silk = ramp4("#fff8c8", "#f2d050", "#c09020", "#6a4a10");
    const mid = scale3(add(a, b), 0.5);
    r.box([Math.min(a[0], b[0]), mid[1] - 0.2 * S, mid[2] - 4.6 * S], [Math.max(a[0], b[0]), mid[1] + 0.25 * S, mid[2] + 0.6 * S], mat(silk, 9, { shader: (s2, tone) => (Math.abs(((s2.p[0] - mid[0]) / S + 30) % 1.6 - 0.8) < 0.18 && s2.p[2] < mid[2] - 0.4 * S && s2.p[2] > mid[2] - 4 * S ? "#3a2410" : tone(silk)) }));
    for (const e of [a, b]) r.sweep([add(e, [0, 0, 1 * S]), add(e, [0, 0, -5.4 * S])], Rr(0.45), mat(PAL.jade, 9));
  } else if (p.held === "ledger") {
    // a thread-bound ledger open across the forearm, its columns of names in black and red
    const g = add(U(p.handL ?? REST_HAND_L), [1.6 * S, 1.2 * S, 1 * S]);
    r.box(add(g, [-2.4 * S, -1.6 * S, 0]), add(g, [2.4 * S, 1.6 * S, 0.5 * S]), mat(PAL.paper, 9, { shader: (s2, tone) => (s2.n[2] > 0.5 && Math.abs(((s2.p[0] - g[0]) / S + 30) % 0.9 - 0.45) < 0.1 ? (Math.abs(s2.p[0] - g[0]) < 0.25 * S ? tone(PAL.navy) : "#3a3040") : tone(PAL.paper)) }));
  }

  // ------------------------------------------------------------------ shawl, cape, tails, beard
  if (st.shawl) {
    const pts = spline(
      [
        add(U(handL), [wind[0] * 0.5 * S, -0.6 * S + wind[1] * 0.6 * S, -2.2 * S]),
        U([-4.6, -2.4, 15.5]),
        U([0, -4.6, 18 + sway * 0.3]),
        U([4.6, -2.4, 15.5]),
        add(U(handR), [wind[0] * 0.5 * S, -0.6 * S + wind[1] * 0.6 * S, -2.2 * S]),
        G([5.5 + wind[0] * 3 + sway, -4 + wind[1] * 4, 6 + Math.cos(t) * 0.8]),
      ],
      5,
    );
    r.sweep(pts, Rr(0.62), mat(st.shawl, 10));
  }
  if (st.cape) {
    for (const xo of [-2.6, 0, 2.6]) {
      r.sweep(
        [U([xo, -3.2, 16.8]), G([xo * 1.6 + wind[0] * 2 + Math.sin(t + xo) * 0.4, -5 + wind[1] * 3, 9]), G([xo * 2 + wind[0] * 3, -6.5 + wind[1] * 4, 1.2])],
        [Rr(1.8), Rr(2.4), Rr(2.2)],
        mat(st.cape, 10),
      );
    }
  }
  if (st.wings) {
    // folded half open at rest, the beat carried by the pose's phase (a glide holds them wide)
    const open = 0.55 + Math.sin(t * 1.5) * 0.15 + (p.lift ?? 0) * 0.05;
    for (const side of [-1, 1]) {
      const root = U([side * 2, -4, 18]);
      const elbow = U([side * (6 + open * 6), -6.4, 25 + open * 3]);
      const tip = U([side * (9 + open * 10), -7.2 + wind[1], 21 + open * 4]);
      for (let k = 0; k < 6; k++) {
        const f = k / 5;
        const end: V3 = [tip[0] + (root[0] - tip[0]) * f * 0.6, tip[1] + 0.3 * k, tip[2] - 9 * f - 3];
        r.sweep([[elbow[0] + (tip[0] - elbow[0]) * (1 - f) * 0.6, elbow[1], elbow[2]], end], [Rr(1.5), Rr(0.5)], mat(st.wings, 10, { shader: (s, tone) => (s.u > 0.75 ? tone(PAL.white) : tone(st.wings!, k % 2 ? 1 : 0)) }));
      }
      r.sweep([root, elbow, tip], [Rr(1.4), Rr(1.1), Rr(0.5)], mat(st.wings, 10));
    }
  }
  if (st.fins) r.sweep([U([0, -3.6, 21]), U([0, -5.4 + Math.sin(t) * 0.3, 17]), U([0, -4.4, 12.5])], [Rr(0.5), Rr(1.4), Rr(0.3)], mat(st.fins, 10));
  if (st.tails) {
    for (const side of [-1, 0, 1]) {
      const ph = t + side * 0.9;
      const pts = spline([G([0, -3.6, 8.5 - drop * 0.8]), G([side * 3 + Math.sin(ph) * 1.2, -7.5, 9 - drop * 0.6]), G([side * 5 + Math.sin(ph + 0.8) * 2, -9.5, 14 - drop * 0.4]), G([side * 5.5 + Math.sin(ph + 1.6) * 2.4, -9, 19 - drop * 0.4])], 3);
      r.sweep(pts, [Rr(1.2), Rr(2.4), Rr(2.6), Rr(1.4)], mat(st.tails, 10, { shader: (s, tone) => (s.u > 0.8 ? tone(PAL.white) : tone(st.tails!)) }));
    }
  }
  if (st.beard) {
    const bs = Math.sin(t * 1.2) * 0.5 + wind[0] * 0.8;
    r.sweep([U([0, 5.6, 21.2]), U([bs * 0.5, 5.4 + wind[1] * 0.5, 17.5]), U([bs, 4.8 + wind[1], 13.6])], [Rr(2.1), Rr(1.5), Rr(0.5)], mat(st.beard, 8));
  }
  if (st.mask) {
    r.ellipsoid(U([0, 5, HEAD_Z - 0.6]), [Rr(4.4), Rr(1.8), Rr(3.6)], mat(st.mask, 8, { shader: (s, tone) => (Math.abs(s.n[0]) > 0.3 && Math.abs(s.n[0]) < 0.6 && s.n[2] > -0.1 && s.n[2] < 0.35 ? "#1a0a10" : tone(st.mask!)) }));
  }
  if (st.talisman) {
    r.box(U([-1.6, 6, 20.5]), U([1.6, 6.6, 28.6]), mat(PAL.paper, 8, { shader: (s, tone) => (Math.abs(s.p[0] - U([0, 0, 0])[0]) < 0.35 * S ? tone(PAL.red) : tone(PAL.paper)) }));
  }

  // ------------------------------------------------------------------ face decals
  drawFace(r, st, p, head, HR, k, S);

  if (o.into) return r.buf;
  let out = r.finish({ inner: true });
  if (p.flash) out = out.tinted("#ffffff", p.flash);
  return out;
}

function hemShader(st: HumanStyle, at: number): Shader {
  return (s, tone) => {
    if (s.u >= at) return tone(st.trim);
    const ang = Math.atan2(s.n[0], s.n[1]);
    if (st.female && s.n[1] > 0.88 && Math.abs(s.n[0]) < 0.2 && s.u > 0.3) return tone(st.inner);
    if (Math.sin(ang * 6 + 0.6) > 0.86 && s.u > 0.2) return tone(st.robe, 1);
    return tone(st.robe);
  };
}

const strandShader =
  (hair: Ramp): Shader =>
  (s, tone) =>
    Math.sin(Math.atan2(s.n[0], s.n[1]) * 9) > 0.7 && s.lum < 0.7 ? tone(hair, 1) : tone(hair);

const strawShader =
  (hat: Ramp): Shader =>
  (s, tone) =>
    Math.sin(Math.hypot(s.p[0], s.p[1]) * 2.2) > 0.55 ? tone(hat, 1) : tone(hat);

/** Eyes, mouth, blush — 1px decals at sprite scale, proper eyes on portraits. */
function drawFace(r: Raster, st: HumanStyle, p: HumanPose, head: V3, HR: number, k: number, S: number): void {
  if (st.mask) {
    if (st.glowEyes) {
      for (const side of [-1, 1]) {
        const n = norm([side * 0.42, 0.86, -0.02]);
        const fp = r.facePoint(add(head, scale3(n, HR + 1.6 * S)), n, 0.05);
        if (fp.visible || fp.facing > 0.05) r.plot(fp.x, fp.y, st.glowEyes, true);
      }
    }
    return;
  }
  const eyes = st.glowEyes && p.eyes !== "closed" && p.eyes !== "hurt" ? "glow" : (p.eyes ?? "open");
  const lash = "#1a1226";
  const big = k * S >= 2;
  for (const side of [-1, 1]) {
    const n = norm([side * 0.4, 0.86, -0.12]);
    const fp = r.facePoint(add(head, scale3(n, HR)), n, 0.12);
    if (!fp.visible) continue;
    const { x, y } = fp;
    const outer = side * (r.basis.xh >= 0 ? 1 : -1);
    if (big) {
      const e = k * S;
      // half the size they once were: big enough to read the mood, small enough not to swallow the face
      const ew = Math.max(1, Math.round(0.65 * e));
      const eh = Math.max(2, Math.round(1 * e));
      if (eyes === "closed" || eyes === "blink") {
        for (let i = -ew; i <= ew; i++) r.plot(x + i, y + Math.round(Math.abs(i) * 0.25) - (eyes === "blink" ? 1 : 0), lash);
      } else if (eyes === "hurt") {
        for (let i = 0; i <= ew; i++) {
          r.plot(x - ew / 2 + i, y - eh / 2 + i * 0.6, lash);
          r.plot(x - ew / 2 + i, y + eh / 2 - i * 0.6, lash);
        }
      } else {
        for (let yy = -eh; yy <= eh; yy++)
          for (let xx = -ew; xx <= ew; xx++) {
            const d = (xx * xx) / (ew * ew) + (yy * yy) / (eh * eh);
            if (d > 1) continue;
            const iris = (xx * xx) / (ew * ew * 0.5) + ((yy + 0.5) * (yy + 0.5)) / (eh * eh * 0.7) < 1;
            const c = eyes === "glow" ? (iris ? st.glowEyes ?? "#ff3050" : "#ffd0d8") : iris ? (yy > eh * 0.25 ? alpha(st.eye, 1) : st.eye) : "#ffffff";
            r.plot(x + xx, y + yy, c);
          }
        r.plot(x - Math.round(ew * 0.3), y - Math.round(eh * 0.35), "#ffffff");
        r.plot(x - Math.round(ew * 0.3) + 1, y - Math.round(eh * 0.35), "#ffffff");
        for (let xx = -ew - 1; xx <= ew; xx++) r.plot(x + xx, y - eh - (Math.abs(xx) < ew * 0.6 ? 0 : -1), lash);
        if (eyes === "fierce") for (let xx = -ew; xx <= ew; xx++) r.plot(x + xx, y - eh - 2 - Math.round((xx * outer) / 2.5), lash);
      }
    } else if (eyes === "closed" || eyes === "blink") {
      r.plot(x, y, lash);
      r.plot(x + outer, y - (eyes === "blink" ? 0 : 1) * 0, lash);
    } else if (eyes === "hurt") {
      r.plot(x, y - 1, lash);
      r.plot(x + outer, y, lash);
      r.plot(x, y + 1, lash);
    } else if (eyes === "glow") {
      r.plot(x, y - 1, "#ffd0d8");
      r.plot(x, y, st.glowEyes ?? "#ff3050");
    } else {
      r.plot(x, y - 1, lash);
      r.plot(x, y, st.eye);
      if (fp.facing > 0.75) r.plot(x + outer, y - 1, lash);
      if (eyes === "fierce") r.plot(x - outer, y - 2, lash);
    }
  }
  // mouth
  const mn = norm([0, 0.93, -0.38]);
  const m = r.facePoint(add(head, scale3(mn, HR)), mn, 0.2);
  if (m.visible) {
    const lip = st.female ? "#c0405a" : "#8a4a4a";
    const mouth = p.mouth ?? "neutral";
    if (big) {
      const e = k * S;
      const mw = Math.round(e * 0.9);
      if (mouth === "open") {
        for (let yy = 0; yy <= Math.round(e * 0.8); yy++) for (let xx = -mw + 1; xx < mw; xx++) r.plot(m.x + xx, m.y + yy, yy === 0 ? "#5a1a2a" : "#a0304a");
      } else for (let xx = -mw; xx <= mw; xx++) r.plot(m.x + xx, m.y - (mouth === "smile" || mouth === "grin" ? (Math.abs(xx) >= mw - 1 ? 1 : 0) : 0), lip);
      // nose
      const nn = norm([0, 0.98, -0.05]);
      const nose = r.facePoint(add(head, scale3(nn, HR)), nn, 0.2);
      if (nose.visible) r.plot(nose.x + 1, nose.y, alpha("#b0607a", 0.6));
    } else if (mouth === "open") {
      r.plot(m.x, m.y, "#7a2a3a");
      r.plot(m.x, m.y + 1, "#a0304a");
    } else if (mouth === "grin") {
      r.plot(m.x, m.y, lip);
      r.plot(m.x + 1, m.y, lip);
    } else {
      r.plot(m.x, m.y, lip);
    }
  }
  // blush
  if (st.female) {
    for (const side of [-1, 1]) {
      const n = norm([side * 0.62, 0.72, -0.32]);
      const b = r.facePoint(add(head, scale3(n, HR)), n, 0.3);
      if (!b.visible) continue;
      const e = big ? Math.round(k * S * 0.8) : 0;
      for (let xx = -e; xx <= e; xx++) r.plot(b.x + xx, b.y, alpha("#f27a9a", 0.55));
    }
  }
}
