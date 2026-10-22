import { PixelBuffer, layer, type Point } from "../pixel/PixelBuffer";
import { alpha } from "../pixel/color";

/**
 * Generic robed cultivator painter (faces right), used for NPCs and the boss.
 * Smaller parameter surface than the heroine, but the same layered approach.
 */
export interface FigureStyle {
  outline: string;
  skin: string;
  skinShade: string;
  hair: string;
  hairHi: string;
  robe: string;
  robeShade: string;
  trim: string;
  trimDark: string;
  inner: string;
  eye: string;
  hairStyle: "topknot" | "long" | "wild";
  beard?: string;
  cape?: string;
  crown?: string;
  accessory?: "whisk" | "saber" | "fan" | "none";
  accessoryColor?: string;
}

export interface FigurePose {
  t: number;
  bob?: number;
  lean?: number;
  arm?: "rest" | "raise" | "point" | "chest" | "slash";
  eyes?: "open" | "closed" | "glow";
  mouth?: "closed" | "open";
  aura?: string;
  auraSize?: number;
  flash?: number;
  wind?: number;
}

export const FIG_W = 48;
export const FIG_H = 48;

const HAND: Record<NonNullable<FigurePose["arm"]>, Point> = {
  rest: [26, 31],
  raise: [27, 10],
  point: [33, 22],
  chest: [24, 24],
  slash: [34, 28],
};

export function paintFigure(s: FigureStyle, p: FigurePose): PixelBuffer {
  const W = FIG_W;
  const H = FIG_H;
  const bx = p.lean ?? 0;
  const by = p.bob ?? 0;
  const wind = p.wind ?? 0.3;
  const t = p.t;
  const U = (x: number, y: number): Point => [x + bx, y + by];
  const out = new PixelBuffer(W, H);

  if (p.aura) {
    const a = new PixelBuffer(W, H);
    const r = p.auraSize ?? 14;
    a.ellipse(24 + bx, 28, r * 0.75, r, alpha(p.aura, 0.18));
    a.ellipse(24 + bx, 28, r * 0.6, r * 0.82, alpha(p.aura, 0.18));
    for (let i = 0; i < 10; i++) {
      const ang = t * 0.7 + (i / 10) * Math.PI * 2;
      const rr = r * (0.75 + 0.25 * Math.sin(t * 2 + i));
      a.px(24 + bx + Math.cos(ang) * rr * 0.75, 28 + Math.sin(ang) * rr, alpha(p.aura, 0.9));
    }
    out.blit(a, 0, 0);
  }

  // cape
  if (s.cape) {
    out.blit(
      layer(W, H, (b) => {
        const pts: Point[] = [U(19, 18), U(26, 18)];
        for (let i = 0; i <= 6; i++) {
          const k = i / 6;
          pts.push([U(26, 0)[0] - k * 18 - wind * 4, 44 + Math.sin(t * 1.5 + i) * 1.2 - wind * k * 3]);
        }
        b.polygon(pts, s.cape!);
        b.line(...U(20, 19), 8 - wind * 4, 42, alpha("#000000", 0.25));
      }, s.outline),
      0,
      0,
    );
  }

  // long hair behind
  if (s.hairStyle !== "topknot") {
    out.blit(
      layer(W, H, (b) => {
        const spine: Point[] = [];
        const n = s.hairStyle === "wild" ? 9 : 8;
        for (let i = 0; i <= n; i++) spine.push(U(20 - i * 0.4 - wind * i * 0.7 + Math.sin(t + i * 0.7) * (i / n) * 1.5, 12 + i * 2.2));
        for (let i = 1; i < spine.length; i++) b.thickLine(...spine[i - 1], ...spine[i], Math.max(2, 6 - i * 0.45), s.hair);
        b.path(spine.slice(1, -2).map(([x, y]) => [x + 1, y] as Point), s.hairHi);
      }, s.outline),
      0,
      0,
    );
  }

  // robe body
  out.blit(
    layer(W, H, (b) => {
      const hem: Point[] = [];
      for (let x = 32; x >= 15; x--) hem.push([x, 46 + Math.round(Math.sin(t * 1.3 + x) * 0.5)]);
      b.polygon([U(19, 19), U(29, 19), U(28.5, 30), ...hem, U(19.5, 30)], s.robe);
      b.line(...U(20, 20), 17, 45, s.robeShade);
      b.line(...U(22, 30), 21, 45, s.robeShade);
      b.polygon([U(22, 19), U(27, 19), U(24.5, 24)], s.inner);
      b.line(...U(21, 19), ...U(25, 25), s.trim);
      b.line(...U(27.5, 19), ...U(25, 23), s.trim);
      b.rect(...U(19, 28), 11, 2, s.trim);
      b.hline(U(19, 0)[0], U(29, 0)[0], U(0, 29)[1], s.trimDark);
      hem.forEach(([x, y]) => b.px(x, y, s.trim));
      b.rect(19, 47, 4, 1, s.trimDark);
      b.rect(26, 47, 4, 1, s.trimDark);
    }, s.outline),
    0,
    0,
  );

  // head
  out.blit(
    layer(W, H, (b) => {
      const [cx, cy] = U(24.5, 13);
      b.rect(...U(23, 17), 3, 2, s.skinShade);
      b.ellipse(cx, cy, 4, 4.5, s.skin);
      b.px(...U(21, 15), s.skinShade);
      b.ellipse(cx - 0.5, cy - 3.5, 4.5, 2, s.hair);
      b.ellipse(cx - 4, cy - 0.5, 1.5, 3.5, s.hair);
      if (s.hairStyle === "wild") {
        for (let i = 0; i < 6; i++) b.line(...U(20 + i * 1.6, 9), ...U(19 + i * 1.8 + Math.sin(t + i) * 0.6, 6 - (i % 2)), s.hair);
      }
      if (s.hairStyle === "topknot") {
        b.ellipse(...U(24, 7), 2, 2, s.hair);
        b.px(...U(23, 6), s.hairHi);
      }
      if (s.crown) {
        b.rect(...U(22, 6), 5, 2, s.crown);
        b.px(...U(24, 5), s.crown);
        b.hline(U(20, 0)[0], U(29, 0)[0], U(0, 7)[1], s.crown);
      }
      // brows & eyes
      const brow = s.beard ?? s.hair;
      b.hline(U(25, 0)[0], U(28, 0)[0], U(0, 11)[1], brow);
      b.px(...U(29, 12), brow);
      const eyes = p.eyes ?? "open";
      if (eyes === "closed") b.hline(U(25, 0)[0], U(27, 0)[0], U(0, 13)[1], s.eye);
      else {
        b.rect(...U(26, 12), 2, 2, eyes === "glow" ? "#ff3355" : s.eye);
        b.px(...U(26, 12), eyes === "glow" ? "#ffd0d8" : "#ffffff");
        b.px(...U(22, 12), s.eye);
      }
      if (s.beard) {
        const sway = Math.sin(t * 1.2) * 0.8 - wind * 0.6;
        b.polygon([U(24, 15), U(29, 15), U(27 + sway, 26), U(25 + sway, 25)], s.beard);
        b.line(...U(26, 16), ...U(26 + sway, 24), alpha("#000000", 0.08));
        b.hline(U(25, 0)[0], U(28, 0)[0], U(0, 15)[1], s.beard);
      }
      if ((p.mouth ?? "closed") === "open") b.rect(...U(26, 16), 2, 1, "#7a2a36");
      else if (!s.beard) b.px(...U(26, 16), "#b04a5a");
    }, s.outline),
    0,
    0,
  );

  // arm + accessory
  const [hx, hy] = U(...HAND[p.arm ?? "rest"]);
  const [sx, sy] = U(27, 20);
  const acc = s.accessory ?? "none";
  if (acc === "saber") {
    out.blit(
      layer(W, H, (b) => {
        const ang = p.arm === "raise" ? -Math.PI / 2 : p.arm === "slash" ? Math.PI * 0.15 : Math.PI * 0.55;
        const dx = Math.cos(ang);
        const dy = Math.sin(ang);
        for (let i = 2; i < 17; i++) {
          b.px(hx + 1 + dx * i, hy + dy * i, s.accessoryColor ?? "#c8203a");
          b.px(hx + 1 + dx * i - dy, hy + dy * i + dx, i > 12 ? "#ff6070" : "#7a0f22");
        }
        b.line(hx + 1 - dy * 2, hy + dx * 2, hx + 1 + dy * 2, hy - dx * 2, "#3b2a2a");
      }, s.outline),
      0,
      0,
    );
  }
  out.blit(
    layer(W, H, (b) => {
      const ex = (sx + hx) / 2;
      const ey = (sy + hy) / 2 + 1;
      b.thickLine(sx, sy, ex, ey, 3, s.robe);
      b.thickLine(ex, ey, hx, hy, 3, s.robe);
      b.polygon([[ex, ey], [hx, hy], [hx, hy + 4], [ex, ey + 3]], s.robeShade);
      b.px(hx, hy + 1, s.trim);
      b.rect(Math.round(hx), Math.round(hy), 2, 2, s.skin);
    }, s.outline),
    0,
    0,
  );
  if (acc === "whisk") {
    out.blit(
      layer(W, H, (b) => {
        b.line(hx + 1, hy + 1, hx + 4, hy - 5, "#8a5a2c");
        const sway = Math.sin(t * 1.4) * 1.5 - wind;
        for (let i = 0; i < 4; i++) b.line(hx + 4, hy - 5, hx + 6 + sway + i * 0.5, hy + 4 + i, i % 2 ? "#ffffff" : "#e4e8f0");
      }, s.outline),
      0,
      0,
    );
  }
  if (acc === "fan") {
    out.blit(
      layer(W, H, (b) => {
        b.polygon([[hx + 1, hy + 1], [hx + 6, hy - 5], [hx + 8, hy + 1]], s.accessoryColor ?? "#f2e6c8");
        b.line(hx + 1, hy + 1, hx + 6, hy - 4, "#c09040");
      }, s.outline),
      0,
      0,
    );
  }
  return p.flash ? out.tinted("#ffffff", p.flash) : out;
}
