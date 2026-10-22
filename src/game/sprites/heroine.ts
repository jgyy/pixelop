import { PixelBuffer, layer, type Point } from "../pixel/PixelBuffer";
import { alpha } from "../pixel/color";
import { animate, TAU, type SpriteSheet } from "./types";

/**
 * Lin Yue — the female cultivator heroine of the Azure Cloud Sect.
 * Painted procedurally from layered, outlined body parts so every pose shares
 * the same design: jade hairpin & bun, long flowing hair, white hanfu with jade
 * trim, a floating pink pibo shawl and a slender jian.
 */

export const HEROINE_W = 48;
export const HEROINE_H = 44;

const C = {
  outline: "#1a1226",
  skin: "#f9dcc8",
  skinShade: "#e4ad98",
  blush: "#f2949e",
  lip: "#d4576b",
  hair: "#24193d",
  hairMid: "#3b2b60",
  hairHi: "#6a58a0",
  robe: "#f6f3ec",
  robeShade: "#d3d6e4",
  robeDeep: "#aab1cb",
  jade: "#3fb59a",
  jadeDark: "#22806e",
  jadeLight: "#93e8d1",
  gold: "#f2c55c",
  goldDark: "#b8822d",
  inner: "#c8b5ea",
  ribbon: "#f6a6c9",
  ribbonShade: "#d57aa7",
  eye: "#2a1c3f",
  iris: "#2f8f7f",
  white: "#ffffff",
  tassel: "#d8433f",
  blade: "#e3ecf7",
  bladeEdge: "#93a8c6",
  hilt: "#3b2d55",
  qi: "#9ff5de",
};

export type Legs = "stand" | "walkA" | "walkB" | "passA" | "passB" | "crouch" | "air" | "sit" | "kneel";
export type Arm = "rest" | "swingBack" | "swingMid" | "swingFwd" | "extend" | "raise" | "lap" | "guard" | "forward" | "back";
export type Eyes = "open" | "blink" | "closed" | "hurt" | "fierce";

export interface HeroinePose {
  bob?: number;
  lean?: number;
  /** Phase for hair / ribbon / ornament sway. */
  t: number;
  /** 0 = still air, 1+ = streaming back. */
  wind?: number;
  legs?: Legs;
  front?: Arm;
  back?: Arm;
  sword?: "none" | "held" | "under";
  eyes?: Eyes;
  mouth?: "smile" | "neutral" | "open";
  /** Palm glow radius for casting. */
  glow?: number;
  /** Slash arc: [startAngle, endAngle, strength]. */
  arc?: [number, number, number];
  flash?: number;
  sparkle?: number;
}

// Design space is 32x40; we translate it into the 48x44 frame so swords and ribbons have room.
const OX = 8;
const OY = 4;

const ARM_TARGET: Record<Arm, Point> = {
  rest: [20, 26],
  swingBack: [13, 12],
  swingMid: [25, 14],
  swingFwd: [26, 22],
  extend: [27, 19],
  raise: [21, 7],
  lap: [17, 28],
  guard: [21, 13],
  forward: [24, 20],
  back: [11, 25],
};

const SWORD_ANGLE: Partial<Record<Arm, number>> = {
  rest: Math.PI * 0.6,
  swingBack: -Math.PI * 0.85,
  swingMid: -Math.PI * 0.25,
  swingFwd: Math.PI * 0.12,
  extend: 0,
  raise: -Math.PI * 0.5,
  guard: -Math.PI * 0.35,
  forward: 0,
};

export function paintHeroine(p: HeroinePose): PixelBuffer {
  const W = HEROINE_W;
  const H = HEROINE_H;
  const legs = p.legs ?? "stand";
  const sitting = legs === "sit";
  const kneeling = legs === "kneel";
  const crouch = legs === "crouch";
  const wind = p.wind ?? 0.3;
  const t = p.t;
  const bx = p.lean ?? 0;
  const by = (p.bob ?? 0) + (sitting ? 8 : 0) + (kneeling ? 5 : 0) + (crouch ? 2 : 0);
  // Upper-body transform: design space -> frame space.
  const U = (x: number, y: number): Point => [x + OX + bx, y + OY + by];
  // Grounded transform (feet / hem).
  const G = (x: number, y: number): Point => [x + OX, y + OY];

  const out = new PixelBuffer(W, H);

  // ---- 1. Back half of the pibo shawl (behind everything) -------------------
  const ribbonBack: Point[] = [];
  for (let i = 0; i <= 14; i++) {
    const k = i / 14;
    const [x, y] = U(12 - i * (0.9 + wind * 0.55), 18 + i * (1.25 - wind * 0.55) + Math.sin(t + i * 0.55) * (0.6 + 2.2 * k));
    ribbonBack.push([x, Math.min(y, H - 3)]);
  }
  out.blit(
    layer(W, H, (b) => {
      b.path(ribbonBack.slice(0, 8), C.ribbon, 2);
      b.path(ribbonBack.slice(7), C.ribbonShade, 2);
      b.path(ribbonBack.slice(0, 6), alpha(C.white, 0.5));
    }, C.outline),
    0,
    0,
  );

  // ---- 2. Long back hair -----------------------------------------------------
  const hairSpine: Point[] = [];
  const hairLen = sitting ? 9 : 10;
  for (let i = 0; i <= hairLen; i++) {
    const k = i / hairLen;
    hairSpine.push(
      U(
        12.5 - i * 0.25 - wind * i * 0.75 + Math.sin(t * 1 + i * 0.75) * (0.3 + k * 1.3),
        9 + i * (2.1 - wind * 0.45),
      ),
    );
  }
  out.blit(
    layer(W, H, (b) => {
      for (let i = 1; i < hairSpine.length; i++) {
        const w = Math.max(2, Math.round(6 - i * 0.42));
        const [ax, ay] = hairSpine[i - 1];
        const [cx, cy] = hairSpine[i];
        b.thickLine(ax, ay, cx, cy, w, i > hairLen - 3 ? C.hairMid : C.hair);
      }
      b.path(hairSpine.slice(1, -2).map(([x, y]) => [x + 1, y] as Point), C.hairHi);
    }, C.outline),
    0,
    0,
  );

  // ---- 3. Back arm / sleeve ---------------------------------------------------
  const backArm = p.back ?? (p.front === "lap" ? "lap" : "rest");
  out.blit(paintSleeve(U, [13, 18], backArm === "lap" ? [15, 28] : ARM_TARGET[backArm], t, true), 0, 0);

  // ---- 4. Skirt, legs & shoes -------------------------------------------------
  out.blit(paintSkirt(U, G, legs, t, wind), 0, 0);

  // ---- 5. Torso, collar, sash, jade pendant ------------------------------------
  out.blit(
    layer(W, H, (b) => {
      b.polygon([U(11.5, 16.5), U(20.5, 16.5), U(19.5, 24.5), U(12.5, 24.5)], C.robe);
      b.vline(U(12, 0)[0], U(0, 17)[1], U(0, 24)[1], C.robeShade);
      b.vline(U(13, 0)[0], U(0, 19)[1], U(0, 22)[1], C.robeShade);
      // crossed collar (jiaoling), right over left
      b.polygon([U(15, 16), U(19, 16), U(17, 20)], C.inner);
      b.line(...U(14, 16), ...U(17.5, 21), C.jade);
      b.line(...U(15, 16), ...U(18, 21), C.jadeDark);
      b.line(...U(19.5, 16), ...U(17.5, 19), C.jade);
      // sash
      b.rect(...U(12, 21), 9, 3, C.jade);
      b.hline(U(12, 0)[0], U(20, 0)[0], U(0, 21)[1], C.jadeLight);
      b.hline(U(12, 0)[0], U(20, 0)[0], U(0, 23)[1], C.jadeDark);
      b.px(...U(18, 22), C.gold);
      b.px(...U(19, 22), C.goldDark);
    }, C.outline),
    0,
    0,
  );
  // Swinging jade pendant & tassel from the sash.
  if (!sitting) {
    const sway = Math.sin(t * 1.2) * 1.1 - wind * 1.4;
    const [px0, py0] = U(18.5, 24);
    const pend = layer(W, H, (b) => {
      b.line(px0, py0, px0 + sway * 0.5, py0 + 2, C.gold);
      b.rect(Math.round(px0 + sway * 0.6) - 1, py0 + 3, 2, 2, C.jade);
      b.px(Math.round(px0 + sway * 0.6) - 1, py0 + 3, C.jadeLight);
      b.line(px0 + sway * 0.6, py0 + 5, px0 + sway, py0 + 8, C.tassel);
    });
    out.blit(pend, 0, 0);
  }
  // Sash tails flutter behind.
  out.blit(
    layer(W, H, (b) => {
      const [sx, sy] = U(12, 22);
      const tail: Point[] = [];
      for (let i = 0; i <= 5; i++) tail.push([sx - i * (0.5 + wind * 0.5), sy + i * (1.1 - wind * 0.3) + Math.sin(t * 1.4 + i) * 0.7]);
      b.path(tail, C.jadeDark);
      b.path(tail.map(([x, y]) => [x + 1, y] as Point), C.jade);
    }),
    0,
    0,
  );

  // ---- 6. Head ------------------------------------------------------------------
  out.blit(paintHead(U, p, t, wind), 0, 0);

  // ---- 7. Front arm, sword, palm glow --------------------------------------------
  const frontArm = p.front ?? "rest";
  const hand = U(...ARM_TARGET[frontArm]);
  const sword = p.sword ?? "none";
  if (p.arc && p.arc[2] > 0) out.blit(paintArc(U(19, 18), p.arc), 0, 0);
  if (sword === "held") {
    const ang = SWORD_ANGLE[frontArm] ?? 0;
    out.blit(paintSword(hand, ang, 14, t), 0, 0);
  }
  out.blit(paintSleeve(U, [19, 18], ARM_TARGET[frontArm], t, false), 0, 0);
  if (p.glow && p.glow > 0) {
    const g = new PixelBuffer(W, H);
    const [hx, hy] = hand;
    g.circle(hx + 1, hy, p.glow + 1, alpha(C.qi, 0.35));
    g.circle(hx + 1, hy, p.glow, alpha(C.qi, 0.7));
    g.circle(hx + 1, hy, Math.max(0, p.glow - 2), alpha(C.white, 0.9));
    for (let i = 0; i < 4; i++) {
      const a = t + (i * TAU) / 4;
      g.px(hx + 1 + Math.cos(a) * (p.glow + 3), hy + Math.sin(a) * (p.glow + 3), C.jadeLight);
    }
    out.blit(g, 0, 0);
  }

  // ---- 8. Flying sword under the feet ------------------------------------------
  if (sword === "under") {
    const s = layer(W, H, (b) => {
      const y = H - 3;
      b.hline(8, 38, y, C.blade);
      b.hline(10, 36, y + 1, C.bladeEdge);
      b.px(39, y, C.white);
      b.vline(12, y - 1, y + 2, C.gold);
      b.hline(6, 11, y, C.hilt);
      b.line(5, y, 2 - wind, y + 1 + Math.round(Math.sin(t * 2)), C.tassel);
    }, C.outline);
    out.blit(s, 0, 0);
    for (let i = 0; i < 6; i++) out.px(6 - i * 1.5, H - 3 + Math.round(Math.sin(t * 3 + i)), alpha(C.qi, 0.8 - i * 0.12));
  }

  // ---- 9. Front shawl drape ---------------------------------------------------------
  if (!sitting) {
    const drape: Point[] = [];
    const [ex, ey] = U(20, 21);
    for (let i = 0; i <= 8; i++) {
      drape.push([ex + 1 + Math.sin(t + i * 0.7) * (0.4 + i * 0.12) - wind * i * 0.9, ey + i * 1.4 - wind * i * 0.2]);
    }
    out.blit(layer(W, H, (b) => b.path(drape, C.ribbon, 1), undefined), 0, 0);
  } else {
    // In meditation the shawl floats in a halo above the shoulders.
    const halo: Point[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI * (1.05 + (i / 16) * 0.9);
      halo.push(U(16 + Math.cos(a) * 11, 17 + Math.sin(a) * 7 + Math.sin(t + i * 0.6) * 0.8));
    }
    out.blit(layer(W, H, (b) => b.path(halo, C.ribbon, 1), undefined), 0, 0);
  }

  // ---- 10. Sparkles & flash -------------------------------------------------------
  if (p.sparkle) {
    const pts: Point[] = [
      [10, 6],
      [38, 10],
      [33, 2],
      [6, 18],
      [40, 22],
    ];
    pts.forEach(([x, y], i) => {
      if ((i + Math.round(p.sparkle!)) % 2) return;
      out.px(x, y, C.white);
      out.px(x - 1, y, alpha(C.gold, 0.8));
      out.px(x + 1, y, alpha(C.gold, 0.8));
      out.px(x, y - 1, alpha(C.gold, 0.8));
      out.px(x, y + 1, alpha(C.gold, 0.8));
    });
  }
  return p.flash ? out.tinted("#ffffff", p.flash) : out;
}

function paintSleeve(U: (x: number, y: number) => Point, shoulder: Point, target: Point, t: number, isBack: boolean): PixelBuffer {
  const [sx, sy] = U(...shoulder);
  const [hx, hy] = U(...target);
  const fill = isBack ? C.robeShade : C.robe;
  return layer(HEROINE_W, HEROINE_H, (b) => {
    // upper arm to elbow, then forearm; wide hanfu sleeve drapes beneath.
    const ex = sx + (hx - sx) * 0.5;
    const ey = sy + (hy - sy) * 0.5 + 1;
    b.thickLine(sx, sy, ex, ey, 3, fill);
    b.thickLine(ex, ey, hx, hy, 3, fill);
    // drooping bell sleeve
    const droop = 3 + Math.sin(t) * 0.6;
    const dx = hx - sx;
    const dy = hy - sy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (dx >= 0 ? 1 : -1);
    const ny = Math.abs((dx / len) * (dx >= 0 ? 1 : -1));
    const cuff: Point[] = [
      [ex, ey],
      [hx - (dx / len) * 1, hy - (dy / len) * 1],
      [hx + nx * 0.5 - (dx / len) * 1, hy + Math.max(ny, 0.6) * droop + 1],
      [ex + nx * 0.5, ey + Math.max(ny, 0.6) * (droop - 1)],
    ];
    b.polygon(cuff, isBack ? C.robeDeep : C.robeShade);
    b.thickLine(hx - (dx / len) * 1.5, hy - (dy / len) * 1.5, hx - (dx / len) * 1.5, hy - (dy / len) * 1.5 + 1, 2, C.jade);
    // hand
    b.rect(Math.round(hx), Math.round(hy), 2, 2, isBack ? C.skinShade : C.skin);
  }, C.outline);
}

function paintSkirt(
  U: (x: number, y: number) => Point,
  G: (x: number, y: number) => Point,
  legs: Legs,
  t: number,
  wind: number,
): PixelBuffer {
  return layer(HEROINE_W, HEROINE_H, (b) => {
    const top = U(0, 24)[1];
    if (legs === "sit") {
      // lotus position: crossed legs under a wide skirt
      const [cx] = U(16, 0);
      const base = G(0, 38)[1];
      b.ellipse(cx, base - 3, 10, 3.5, C.robe);
      b.polygon([[cx - 5, top], [cx + 5, top], [cx + 9, base - 4], [cx - 9, base - 4]], C.robe);
      b.hline(cx - 9, cx + 9, base - 1, C.jade);
      b.hline(cx - 7, cx + 7, base, C.jadeDark);
      b.ellipse(cx + 5, base - 4, 3, 1.5, C.robeShade);
      b.ellipse(cx - 5, base - 4, 3, 1.5, C.robeShade);
      b.rect(cx + 7, base - 4, 2, 1, C.jadeDark); // a peeking shoe
      return;
    }
    let l = 10;
    let r = 22;
    let bottom = 37;
    let feet: [number, number, number][] = [
      [12, 38, 0],
      [17, 38, 0],
    ];
    switch (legs) {
      case "walkA":
        l = 9;
        r = 23;
        feet = [
          [10, 38, 0],
          [20, 38, 0],
        ];
        break;
      case "walkB":
        l = 9;
        r = 23;
        feet = [
          [12, 38, 0],
          [18, 38, 0],
        ];
        break;
      case "passA":
      case "passB":
        l = 11;
        r = 21;
        feet = [
          [14, 38, 0],
          [16, 37, -1],
        ];
        break;
      case "crouch":
        l = 8;
        r = 24;
        feet = [
          [11, 38, 0],
          [19, 38, 0],
        ];
        break;
      case "air":
        l = 7 - wind;
        r = 25;
        bottom = 35;
        feet = [
          [12, 36, 0],
          [17, 37, 0],
        ];
        break;
      case "kneel":
        l = 7;
        r = 23;
        feet = [
          [8, 38, 0],
          [19, 38, 0],
        ];
        break;
    }
    const [lx, by] = G(l, bottom);
    const [rx] = G(r, bottom);
    const [tl] = U(12, 0);
    const [tr] = U(20, 0);
    // hem ripples in the breeze
    const hem: Point[] = [];
    for (let x = rx; x >= lx; x--) hem.push([x, by + Math.round(Math.sin(t * 1.5 + x * 0.9) * 0.6)]);
    b.polygon([[tl, top], [tr, top], ...hem], C.robe);
    // folds
    b.line(tl + 2, top + 2, lx + 3, by - 1, C.robeShade);
    b.line(tl + 5, top + 3, (lx + rx) / 2, by - 1, C.robeShade);
    b.line(tl + 1, top + 1, lx + 1, by - 1, C.robeShade);
    // inner layer peeking from the front slit
    b.polygon([[tr - 1, top + 6], [rx - 1, by - 1], [rx - 4, by - 1]], C.inner);
    // hem trim
    hem.forEach(([x, y]) => {
      b.px(x, y, C.jade);
      b.px(x, y - 1, C.jadeDark);
    });
    // shoes (cloud-toe slippers)
    feet.forEach(([fx, fy, lift]) => {
      const [x, y] = G(fx, fy + lift);
      b.rect(x, y, 3, 1, C.jadeDark);
      b.px(x + 3, y, C.jade);
      b.px(x, y - 1, C.robeShade);
    });
  }, C.outline);
}

function paintHead(U: (x: number, y: number) => Point, p: HeroinePose, t: number, wind: number): PixelBuffer {
  return layer(HEROINE_W, HEROINE_H, (b) => {
    const [cx, cy] = U(16.5, 11.5);
    // neck
    b.rect(...U(15, 15), 3, 2, C.skinShade);
    // face
    b.ellipse(cx, cy, 4, 4.5, C.skin);
    b.px(...U(13, 14), C.skinShade);
    b.px(...U(14, 15), C.skinShade);
    // hair cap and back of head
    b.ellipse(cx - 0.5, cy - 3.5, 5, 2.5, C.hair);
    b.ellipse(cx - 4.5, cy - 0.5, 2, 4, C.hair);
    // bangs: jagged fringe
    const fringe = [10, 9, 10, 8, 9, 8, 9, 8];
    fringe.forEach((len, i) => {
      const [x] = U(12 + i, 0);
      b.vline(x, U(0, 7)[1], U(0, len)[1], C.hair);
    });
    b.hline(U(14, 0)[0], U(17, 0)[0], U(0, 6)[1], C.hairHi);
    // front side lock framing the face
    const sway = Math.sin(t * 1.1) * 0.6 - wind * 0.6;
    b.line(...U(20.5, 9), ...U(21 + sway, 16), C.hair);
    b.line(...U(21, 9), ...U(21.5 + sway, 15), C.hairMid);
    // bun + gold band + jade hairpin
    b.ellipse(...U(15, 3.5), 3, 2.5, C.hair);
    b.ellipse(...U(14.5, 2.5), 1.5, 1, C.hairHi);
    b.hline(U(14, 0)[0], U(16, 0)[0], U(0, 6)[1], C.gold);
    b.line(...U(12, 3), ...U(19, 1), C.jade);
    b.px(...U(19, 1), C.jadeLight);
    b.px(...U(12, 3), C.gold);
    // dangling buyao ornament
    const ds = Math.sin(t * 1.3) * 1.2 - wind * 0.8;
    b.line(...U(18, 2), ...U(18.5 + ds * 0.5, 5), C.gold);
    b.px(...U(18.5 + ds * 0.6, 6), C.tassel);
    b.px(...U(18.5 + ds * 0.7, 7), C.jadeLight);
    // forehead lotus mark (huadian)
    b.px(...U(17, 10), C.tassel);
    // eyes
    const eyes = p.eyes ?? "open";
    if (eyes === "open" || eyes === "fierce") {
      b.hline(U(18, 0)[0], U(20, 0)[0], U(0, 11)[1], C.eye);
      b.rect(...U(18, 12), 2, 2, C.iris);
      b.px(...U(18, 12), C.white);
      b.px(...U(19, 13), C.eye);
      b.hline(U(14, 0)[0], U(15, 0)[0], U(0, 11)[1], C.eye);
      b.vline(U(15, 0)[0], U(0, 12)[1], U(0, 13)[1], C.iris);
      b.px(...U(15, 12), C.white);
      if (eyes === "fierce") {
        b.px(...U(20, 10), C.eye);
        b.px(...U(14, 10), C.eye);
      }
    } else if (eyes === "hurt") {
      b.line(...U(18, 11), ...U(19, 12), C.eye);
      b.line(...U(19, 12), ...U(18, 13), C.eye);
      b.line(...U(15, 11), ...U(14, 12), C.eye);
      b.line(...U(14, 12), ...U(15, 13), C.eye);
    } else {
      // blink / closed (serene crescent)
      b.hline(U(18, 0)[0], U(20, 0)[0], U(0, eyes === "blink" ? 12 : 13)[1], C.eye);
      b.hline(U(14, 0)[0], U(15, 0)[0], U(0, eyes === "blink" ? 12 : 13)[1], C.eye);
    }
    // blush & mouth
    b.px(...U(20, 14), alpha(C.blush, 0.8));
    b.px(...U(15, 14), alpha(C.blush, 0.6));
    const mouth = p.mouth ?? "neutral";
    if (mouth === "open") {
      b.rect(...U(18, 15), 2, 1, C.lip);
    } else if (mouth === "smile") {
      b.px(...U(18, 15), C.lip);
      b.px(...U(19, 14.6), C.lip);
    } else {
      b.px(...U(18, 15), C.lip);
    }
  }, C.outline);
}

function paintSword(hand: Point, angle: number, len: number, t: number): PixelBuffer {
  const [hx, hy] = hand;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  return layer(HEROINE_W, HEROINE_H, (b) => {
    const gx = hx + 1 + dx * 1.5;
    const gy = hy + dy * 1.5;
    // blade
    b.line(gx, gy, gx + dx * len, gy + dy * len, C.blade);
    b.line(gx + dx, gy + dy + 1, gx + dx * (len - 1), gy + dy * (len - 1) + 1, C.bladeEdge);
    b.px(gx + dx * len, gy + dy * len, C.white);
    // guard
    b.line(gx - dy * 1.5, gy + dx * 1.5, gx + dy * 1.5, gy - dx * 1.5, C.gold);
    // hilt + tassel
    b.line(gx - dx * 1, gy - dy * 1, gx - dx * 3, gy - dy * 3, C.hilt);
    const tx = gx - dx * 3;
    const ty = gy - dy * 3;
    b.line(tx, ty, tx - 1 + Math.sin(t) * 1, ty + 3, C.tassel);
  }, C.outline);
}

function paintArc(center: Point, [a0, a1, strength]: [number, number, number]): PixelBuffer {
  const b = new PixelBuffer(HEROINE_W, HEROINE_H);
  const [cx, cy] = center;
  const steps = 24;
  for (let s = 0; s <= steps; s++) {
    const k = s / steps;
    const a = a0 + (a1 - a0) * k;
    for (let r = 13; r <= 17; r++) {
      const edge = r === 17 || r === 13;
      const op = strength * k * (edge ? 0.35 : 0.85);
      b.px(cx + Math.cos(a) * r, cy + Math.sin(a) * r, alpha(edge ? C.qi : C.white, op));
    }
  }
  return b;
}

const f = (n: number, i: number) => (i / n) * TAU;

export function buildHeroine(): SpriteSheet {
  const P = paintHeroine;
  return {
    id: "heroine",
    name: "Lin Yue",
    title: "Jade Lotus Disciple",
    description: "Inner disciple of the Azure Cloud Sect. Wields the Moonlit Jian and the Jade Lotus Sutra.",
    width: HEROINE_W,
    height: HEROINE_H,
    animations: {
      idle: animate(
        P,
        Array.from({ length: 8 }, (_, i) => ({
          t: f(8, i),
          bob: i >= 3 && i <= 5 ? 1 : 0,
          eyes: i === 6 ? "blink" : "open",
          mouth: "smile",
          wind: 0.25,
        })),
        6,
      ),
      walk: animate(
        P,
        (["walkA", "walkA", "passA", "passA", "walkB", "walkB", "passB", "passB"] as Legs[]).map((legs, i) => ({
          t: f(8, i) * 2,
          legs,
          bob: i % 4 === 1 ? 1 : i % 4 === 3 ? -1 : 0,
          back: (i < 4 ? "rest" : "back") as Arm,
          wind: 0.7,
          mouth: "smile",
        })),
        10,
      ),
      jump: animate(
        P,
        [
          { t: 0, legs: "crouch", wind: 0.3 },
          { t: 1, legs: "air", wind: -0.2, front: "raise", mouth: "open" },
          { t: 2, legs: "air", wind: 0.2, front: "forward" },
          { t: 3, legs: "air", wind: 0.6, front: "rest" },
        ] as HeroinePose[],
        8,
        false,
      ),
      attack: animate(
        P,
        [
          { t: 0, front: "guard", sword: "held", eyes: "fierce", lean: -1 },
          { t: 0.5, front: "swingBack", sword: "held", eyes: "fierce", lean: -1, legs: "crouch" },
          { t: 1, front: "swingMid", sword: "held", eyes: "fierce", lean: 1, legs: "walkA", arc: [-Math.PI * 0.85, -Math.PI * 0.25, 0.8], wind: 0.8 },
          { t: 1.5, front: "swingFwd", sword: "held", eyes: "fierce", lean: 2, legs: "walkA", arc: [-Math.PI * 0.6, Math.PI * 0.12, 1], wind: 1 },
          { t: 2, front: "swingFwd", sword: "held", eyes: "fierce", lean: 2, legs: "walkA", arc: [-Math.PI * 0.2, Math.PI * 0.15, 0.45], wind: 0.8 },
          { t: 2.5, front: "rest", sword: "held", lean: 1, mouth: "smile" },
        ] as HeroinePose[],
        12,
        false,
      ),
      cast: animate(
        P,
        [1, 2, 3, 4, 5, 4].map((g, i) => ({
          t: f(6, i),
          front: "extend" as Arm,
          back: "forward" as Arm,
          glow: g,
          eyes: "fierce" as Eyes,
          lean: 1,
          wind: 0.9,
          legs: "walkA" as Legs,
        })),
        10,
        false,
      ),
      meditate: animate(
        P,
        Array.from({ length: 8 }, (_, i) => ({
          t: f(8, i),
          legs: "sit",
          front: "lap",
          back: "lap",
          eyes: "closed",
          mouth: "smile",
          bob: i >= 4 ? -1 : 0,
          wind: -0.15,
        })) as HeroinePose[],
        4,
      ),
      hurt: animate(
        P,
        [
          { t: 0, front: "guard", eyes: "hurt", lean: -2, flash: 0.75, mouth: "open" },
          { t: 0.6, front: "guard", eyes: "hurt", lean: -2, mouth: "open", legs: "crouch" },
          { t: 1.2, front: "guard", eyes: "hurt", lean: -1, legs: "crouch" },
        ] as HeroinePose[],
        8,
        false,
      ),
      victory: animate(
        P,
        Array.from({ length: 6 }, (_, i) => ({
          t: f(6, i),
          front: "raise",
          sword: "held",
          mouth: "smile",
          eyes: i === 4 ? "blink" : "open",
          wind: 0.5,
          sparkle: i,
          bob: i % 3 === 0 ? -1 : 0,
        })) as HeroinePose[],
        6,
      ),
      fly: animate(
        P,
        Array.from({ length: 6 }, (_, i) => ({
          t: f(6, i) * 2,
          sword: "under",
          front: "forward",
          back: "back",
          legs: "passA",
          wind: 1.4,
          lean: 1,
          bob: i < 3 ? 0 : -1,
          mouth: "smile",
        })) as HeroinePose[],
        8,
      ),
      defeat: animate(
        P,
        [
          { t: 0, legs: "crouch", eyes: "hurt", front: "guard", flash: 0.5 },
          { t: 0.5, legs: "kneel", eyes: "closed", front: "rest", lean: -1 },
          { t: 1, legs: "kneel", eyes: "closed", front: "rest", lean: 0, bob: 1 },
        ] as HeroinePose[],
        5,
        false,
      ),
    },
  };
}
