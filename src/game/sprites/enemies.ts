import { PixelBuffer, layer, type Point } from "../pixel/PixelBuffer";
import { alpha } from "../pixel/color";
import { animate, TAU, type SpriteSheet } from "./types";

/** All enemies are painted facing LEFT (towards the heroine in battle). */

const f = (n: number, i: number) => (i / n) * TAU;

interface BeastPose {
  t: number;
  bob?: number;
  lunge?: number;
  /** leg phase for gait, undefined = standing */
  gait?: number;
  mouth?: boolean;
  fire?: number;
  flash?: number;
}

// ---------------------------------------------------------------------------
// Three-tailed fox spirit
// ---------------------------------------------------------------------------
const FOX = {
  outline: "#2a1420",
  fur: "#fbf3ea",
  furShade: "#e6d3c3",
  tip: "#f08a3c",
  tipHot: "#ffcf6a",
  mark: "#e0405a",
  eye: "#c8203a",
  nose: "#2a1420",
  fire: "#7fd8ff",
};

export function paintFox(p: BeastPose): PixelBuffer {
  const W = 52;
  const H = 38;
  const x0 = -(p.lunge ?? 0);
  const by = p.bob ?? 0;
  const out = new PixelBuffer(W, H);
  // tails fan out behind
  for (let k = 0; k < 3; k++) {
    const tail = layer(W, H, (b) => {
      const pts: Point[] = [];
      for (let i = 0; i <= 10; i++) {
        const spread = (k - 1) * 0.55;
        const a = -Math.PI / 2 + spread + 0.6 + Math.sin(p.t + k * 1.7 + i * 0.35) * 0.25;
        const r = i * 1.6;
        pts.push([34 + x0 + Math.cos(a) * r * 0.9 + i * 0.4, 24 + by + Math.sin(a) * r]);
      }
      for (let i = 1; i < pts.length; i++) {
        const w = i < 7 ? 4 : 3;
        b.thickLine(...pts[i - 1], ...pts[i], w, i > 7 ? FOX.tip : FOX.fur);
      }
      b.px(...pts[pts.length - 1], FOX.tipHot);
    }, FOX.outline);
    out.blit(tail, 0, 0);
  }
  // body & legs
  out.blit(
    layer(W, H, (b) => {
      const g = p.gait;
      const leg = (x: number, phase: number, back: boolean) => {
        const sw = g === undefined ? 0 : Math.sin(g + phase) * 2;
        b.thickLine(x + x0, 26 + by, x + x0 + sw, 35, 2, back ? FOX.furShade : FOX.fur);
        b.px(x + x0 + sw, 35, FOX.tip);
      };
      leg(30, Math.PI, true);
      leg(17, 0, true);
      b.ellipse(25 + x0, 24 + by, 10, 5, FOX.fur);
      b.ellipse(26 + x0, 27 + by, 8, 2, FOX.furShade);
      leg(32, 0, false);
      leg(19, Math.PI, false);
      // neck ruff
      b.ellipse(16 + x0, 21 + by, 4, 5, FOX.fur);
    }, FOX.outline),
    0,
    0,
  );
  // head
  out.blit(
    layer(W, H, (b) => {
      const hx = 11 + x0;
      const hy = 16 + by;
      b.ellipse(hx, hy, 5, 4, FOX.fur);
      b.polygon([[hx - 3, hy - 1], [hx - 10, hy + 2], [hx - 3, hy + 3]], FOX.fur);
      b.px(hx - 10, hy + 2, FOX.nose);
      // ears
      b.polygon([[hx - 3, hy - 3], [hx - 2, hy - 10], [hx + 1, hy - 3]], FOX.fur);
      b.polygon([[hx + 1, hy - 3], [hx + 4, hy - 9], [hx + 5, hy - 2]], FOX.fur);
      b.px(hx - 2, hy - 7, FOX.tip);
      b.px(hx + 3, hy - 6, FOX.tip);
      // eye + markings
      b.rect(hx - 3, hy - 1, 2, 1, FOX.eye);
      b.line(hx - 1, hy - 2, hx + 2, hy - 3, FOX.mark);
      b.px(hx, hy - 5, FOX.mark);
      if (p.mouth) {
        b.line(hx - 9, hy + 3, hx - 4, hy + 4, FOX.mark);
        b.px(hx - 7, hy + 4, "#ffffff");
      }
    }, FOX.outline),
    0,
    0,
  );
  if (p.fire) {
    const fb = new PixelBuffer(W, H);
    const cx = 3 + x0 * 0.2;
    const cy = 12 + by;
    fb.circle(cx, cy, p.fire + 1, alpha(FOX.fire, 0.35));
    fb.circle(cx, cy, p.fire, alpha(FOX.fire, 0.8));
    fb.circle(cx, cy + 1, Math.max(0, p.fire - 2), "#ffffff");
    for (let i = 0; i < 3; i++) fb.px(cx + Math.sin(p.t + i) * 2, cy - p.fire - 1 - i, alpha(FOX.fire, 0.7 - i * 0.2));
    out.blit(fb, 0, 0);
  }
  return p.flash ? out.tinted("#ffffff", p.flash) : out;
}

export function buildFox(): SpriteSheet {
  return {
    id: "fox",
    name: "Fox Spirit",
    title: "Three-Tailed Huli Jing",
    description: "A mischievous fox who has cultivated for three hundred years. Breathes azure foxfire.",
    width: 52,
    height: 38,
    animations: {
      idle: animate(paintFox, Array.from({ length: 8 }, (_, i) => ({ t: f(8, i), bob: i >= 4 ? 1 : 0 })), 8),
      run: animate(paintFox, Array.from({ length: 6 }, (_, i) => ({ t: f(6, i) * 2, gait: f(6, i), bob: i % 3 === 1 ? -1 : 0 })), 12),
      attack: animate(
        paintFox,
        [
          { t: 0, mouth: true, fire: 1 },
          { t: 0.6, mouth: true, fire: 3, lunge: 1 },
          { t: 1.2, mouth: true, fire: 5, lunge: 3 },
          { t: 1.8, mouth: true, fire: 6, lunge: 4 },
          { t: 2.4, lunge: 1 },
        ],
        10,
        false,
      ),
      hurt: animate(paintFox, [{ t: 0, flash: 0.8, lunge: -3 }, { t: 0.5, lunge: -2 }, { t: 1, lunge: -1 }], 8, false),
    },
  };
}

// ---------------------------------------------------------------------------
// Shadow demon wolf
// ---------------------------------------------------------------------------
const WOLF = {
  outline: "#0b0714",
  fur: "#2e2346",
  furHi: "#4c3a72",
  belly: "#1e1630",
  flame: "#a46cff",
  flameHot: "#e2c6ff",
  eye: "#ff3d5e",
  fang: "#f4f0ff",
};

export function paintWolf(p: BeastPose): PixelBuffer {
  const W = 56;
  const H = 40;
  const x0 = -(p.lunge ?? 0);
  const by = p.bob ?? 0;
  const out = new PixelBuffer(W, H);
  // spectral flames along back and tail
  const flames = new PixelBuffer(W, H);
  for (let i = 0; i < 12; i++) {
    const x = 14 + i * 2.6 + x0;
    const hgt = 3 + ((i * 7) % 4) + Math.sin(p.t * 2 + i) * 1.5;
    flames.line(x, 19 + by, x + 1 + Math.sin(p.t + i) * 1.5, 19 + by - hgt, i % 3 === 0 ? WOLF.flameHot : alpha(WOLF.flame, 0.85));
  }
  out.blit(flames, 0, 0);
  out.blit(
    layer(W, H, (b) => {
      // tail
      const tail: Point[] = [];
      for (let i = 0; i <= 7; i++) tail.push([42 + x0 + i * 1.5, 22 + by - i * 0.9 + Math.sin(p.t + i * 0.5) * 1.2]);
      for (let i = 1; i < tail.length; i++) b.thickLine(...tail[i - 1], ...tail[i], i < 5 ? 4 : 3, WOLF.fur);
      const g = p.gait;
      const leg = (x: number, phase: number, back: boolean) => {
        const sw = g === undefined ? 0 : Math.sin(g + phase) * 3;
        b.thickLine(x + x0, 25 + by, x + x0 + sw * 0.5, 31, 3, back ? WOLF.belly : WOLF.fur);
        b.thickLine(x + x0 + sw * 0.5, 31, x + x0 + sw, 37, 2, back ? WOLF.belly : WOLF.fur);
        b.rect(x + x0 + sw - 1, 37, 3, 1, back ? WOLF.belly : WOLF.furHi);
      };
      leg(38, Math.PI, true);
      leg(20, 0, true);
      b.ellipse(29 + x0, 23 + by, 13, 6, WOLF.fur);
      b.ellipse(30 + x0, 27 + by, 10, 2, WOLF.belly);
      b.hline(20 + x0, 38 + x0, 19 + by, WOLF.furHi);
      leg(40, 0, false);
      leg(22, Math.PI, false);
    }, WOLF.outline),
    0,
    0,
  );
  out.blit(
    layer(W, H, (b) => {
      const hx = 14 + x0;
      const hy = 18 + by;
      b.ellipse(hx + 2, hy + 2, 6, 5, WOLF.fur);
      b.polygon([[hx - 2, hy], [hx - 11, hy + 3], [hx - 11, hy + 5], [hx - 2, hy + 6]], WOLF.fur);
      b.px(hx - 11, hy + 3, "#000000");
      b.polygon([[hx, hy - 2], [hx + 1, hy - 10], [hx + 4, hy - 2]], WOLF.fur);
      b.polygon([[hx + 4, hy - 2], [hx + 7, hy - 9], [hx + 8, hy - 1]], WOLF.furHi);
      b.rect(hx - 2, hy, 3, 1, WOLF.eye);
      b.px(hx - 3, hy, "#ffffff");
      if (p.mouth) {
        b.polygon([[hx - 11, hy + 5], [hx - 2, hy + 6], [hx - 9, hy + 9]], "#5a0f24");
        b.px(hx - 9, hy + 6, WOLF.fang);
        b.px(hx - 6, hy + 6, WOLF.fang);
        b.px(hx - 8, hy + 8, WOLF.fang);
      }
    }, WOLF.outline),
    0,
    0,
  );
  // eye glow trail
  out.px(10 + x0 + 3, 17 + by, alpha(WOLF.eye, 0.6));
  out.px(10 + x0 + 5, 17 + by, alpha(WOLF.eye, 0.3));
  return p.flash ? out.tinted("#ffffff", p.flash) : out;
}

export function buildWolf(): SpriteSheet {
  return {
    id: "wolf",
    name: "Demon Wolf",
    title: "Shadowflame Hound",
    description: "A wolf twisted by demonic qi; violet spirit-fire burns along its spine.",
    width: 56,
    height: 40,
    animations: {
      idle: animate(paintWolf, Array.from({ length: 8 }, (_, i) => ({ t: f(8, i), bob: i % 4 < 2 ? 0 : 1, mouth: i >= 6 })), 8),
      run: animate(paintWolf, Array.from({ length: 6 }, (_, i) => ({ t: f(6, i) * 2, gait: f(6, i), bob: i % 3 === 0 ? -1 : 0 })), 12),
      attack: animate(
        paintWolf,
        [
          { t: 0, lunge: -2, bob: 1 },
          { t: 0.5, lunge: -3, bob: 2, mouth: true },
          { t: 1, lunge: 6, mouth: true, gait: 1 },
          { t: 1.5, lunge: 9, mouth: true, gait: 2 },
          { t: 2, lunge: 3 },
        ],
        10,
        false,
      ),
      hurt: animate(paintWolf, [{ t: 0, flash: 0.8, lunge: -3 }, { t: 0.5, lunge: -2, mouth: true }, { t: 1, lunge: -1 }], 8, false),
    },
  };
}

// ---------------------------------------------------------------------------
// Jiangshi (hopping corpse)
// ---------------------------------------------------------------------------
const JS = {
  outline: "#0e1118",
  skin: "#b9d6b2",
  skinShade: "#8fb08c",
  robe: "#2c3d5c",
  robeShade: "#1d2a42",
  trim: "#c23a3a",
  gold: "#e8c25a",
  hat: "#15161c",
  talisman: "#f4d54c",
  ink: "#c0262e",
};

interface HopPose {
  t: number;
  hop: number;
  squash?: number;
  reach?: number;
  flash?: number;
}

export function paintJiangshi(p: HopPose): PixelBuffer {
  const W = 34;
  const H = 50;
  const PAD = 10;
  const y0 = -Math.round(p.hop);
  const sq = p.squash ?? 0;
  const reach = p.reach ?? 0;
  const out = new PixelBuffer(W + PAD, H);
  out.blit(
    layer(W, H, (b) => {
      // robe
      b.polygon([[12, 20 + y0 + sq], [23, 20 + y0 + sq], [25, 46 + y0], [10, 46 + y0]], JS.robe);
      b.line(13, 22 + y0 + sq, 12, 45 + y0, JS.robeShade);
      b.rect(10, 44 + y0, 16, 2, JS.trim);
      // mandarin square
      b.rect(14, 28 + y0 + sq, 7, 6, JS.gold);
      b.rect(15, 29 + y0 + sq, 5, 4, JS.trim);
      b.px(17, 30 + y0 + sq, JS.gold);
      // feet
      b.rect(11, 47 + y0, 5, 2, JS.hat);
      b.rect(19, 47 + y0, 5, 2, JS.hat);
    }, JS.outline),
    PAD,
    0,
  );
  // head + hat + talisman
  out.blit(
    layer(W, H, (b) => {
      const hy = 13 + y0 + sq;
      b.ellipse(17, hy, 4, 5, JS.skin);
      b.px(14, hy + 3, JS.skinShade);
      b.hline(15, 16, hy, "#3a1a2a");
      b.hline(19, 20, hy, "#3a1a2a");
      b.px(17, hy + 3, "#5a2030");
      // hat: brim + crown + red finial
      b.rect(10, hy - 5, 15, 2, JS.hat);
      b.ellipse(17, hy - 7, 5, 2.5, JS.hat);
      b.rect(16, hy - 11, 3, 2, JS.trim);
      b.hline(12, 22, hy - 5, "#33354a");
      // talisman flutters
      const fl = Math.sin(p.t * 2) * 1.2 + p.hop * 0.25;
      b.polygon([[14, hy - 3], [20, hy - 3], [20 + fl, hy + 7], [14 + fl, hy + 7]], JS.talisman);
      b.line(17, hy - 2, 17 + fl * 0.5, hy + 5, JS.ink);
      b.px(16 + fl * 0.3, hy, JS.ink);
      b.px(18 + fl * 0.5, hy + 3, JS.ink);
    }, JS.outline),
    PAD,
    0,
  );
  // outstretched arms (towards the left)
  out.blit(
    layer(W + PAD, H, (b) => {
      const ay = 23 + y0 + sq;
      b.thickLine(16 + PAD, ay, 4 + PAD - reach, ay + 1, 4, JS.robe);
      b.hline(4 + PAD - reach, 15 + PAD, ay + 3, JS.robeShade);
      b.rect(3 + PAD - reach, ay - 1, 2, 4, JS.trim);
      b.rect(PAD - reach, ay, 3, 2, JS.skin);
      b.px(PAD - 1 - reach, ay, JS.skinShade);
      b.px(PAD - 1 - reach, ay + 2, JS.skinShade);
    }, JS.outline),
    0,
    0,
  );
  return p.flash ? out.tinted("#ffffff", p.flash) : out;
}

export function buildJiangshi(): SpriteSheet {
  const hop = [0, 2, 5, 7, 7, 5, 2, 0];
  return {
    id: "jiangshi",
    name: "Jiangshi",
    title: "Hopping Corpse",
    description: "A Qing-dynasty official sealed by a yellow talisman — until the wind tears it loose.",
    width: 44,
    height: 50,
    animations: {
      idle: animate(
        paintJiangshi,
        hop.map((h, i) => ({ t: f(8, i), hop: h, squash: i === 0 || i === 7 ? 1 : 0 })),
        10,
      ),
      attack: animate(
        paintJiangshi,
        [
          { t: 0, hop: 0, squash: 2 },
          { t: 0.5, hop: 5, reach: 2 },
          { t: 1, hop: 3, reach: 6 },
          { t: 1.5, hop: 0, reach: 8, squash: 1 },
          { t: 2, hop: 0, reach: 2 },
        ],
        10,
        false,
      ),
      hurt: animate(paintJiangshi, [{ t: 0, hop: 0, flash: 0.8 }, { t: 1, hop: 1, squash: 1 }, { t: 2, hop: 0 }], 8, false),
    },
  };
}

// ---------------------------------------------------------------------------
// Lotus lake serpent
// ---------------------------------------------------------------------------
const SNAKE = {
  outline: "#071a1c",
  scale: "#2f8f8a",
  scaleDark: "#1d605e",
  belly: "#a5e6c9",
  fin: "#e05a8a",
  horn: "#f2e2b0",
  eye: "#ffd23a",
  tongue: "#ff4a6a",
};

interface CoilPose {
  t: number;
  strike?: number;
  tongue?: boolean;
  flash?: number;
}

export function paintSerpent(p: CoilPose): PixelBuffer {
  const W = 56;
  const H = 46;
  const s = p.strike ?? 0;
  const out = new PixelBuffer(W, H);
  const spine: Point[] = [];
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const k = i / N; // 0 = tail, 1 = head
    const x = 50 - k * 34 - s * k * k * 10;
    const y = 42 - k * 26 + Math.sin(p.t + k * 7) * (4 * (1 - k) + 1.2) - s * k * k * 2;
    spine.push([x, y]);
  }
  out.blit(
    layer(W, H, (b) => {
      for (let i = 1; i < spine.length; i++) {
        const w = 2 + Math.round(Math.sin((i / N) * Math.PI) * 4);
        b.thickLine(...spine[i - 1], ...spine[i], w, SNAKE.scale);
      }
      for (let i = 2; i < spine.length - 1; i++) {
        const [x, y] = spine[i];
        b.px(x + 1, y + 1, SNAKE.belly);
        if (i % 2 === 0) b.px(x, y - 1, SNAKE.scaleDark);
      }
      // dorsal fins
      for (let i = 6; i < N - 2; i += 3) {
        const [x, y] = spine[i];
        b.line(x, y - 2, x + 1, y - 5 + Math.round(Math.sin(p.t + i)), SNAKE.fin);
      }
    }, SNAKE.outline),
    0,
    0,
  );
  const [hx, hy] = spine[N];
  out.blit(
    layer(W, H, (b) => {
      b.ellipse(hx - 2, hy, 5, 3.5, SNAKE.scale);
      b.polygon([[hx - 4, hy - 1], [hx - 11, hy + 1], [hx - 4, hy + 3]], SNAKE.scale);
      b.hline(hx - 10, hx - 3, hy + 2, SNAKE.belly);
      b.line(hx, hy - 3, hx + 4, hy - 7, SNAKE.horn);
      b.line(hx - 2, hy - 3, hx + 1, hy - 8, SNAKE.horn);
      b.rect(hx - 4, hy - 1, 2, 1, SNAKE.eye);
      b.px(hx - 4, hy - 1, "#000000");
      // whiskers
      b.line(hx - 10, hy + 1, hx - 14, hy - 2 + Math.round(Math.sin(p.t)), SNAKE.horn);
      if (p.tongue) {
        b.line(hx - 11, hy + 2, hx - 15, hy + 2, SNAKE.tongue);
        b.px(hx - 16, hy + 1, SNAKE.tongue);
        b.px(hx - 16, hy + 3, SNAKE.tongue);
      }
    }, SNAKE.outline),
    0,
    0,
  );
  return p.flash ? out.tinted("#ffffff", p.flash) : out;
}

export function buildSerpent(): SpriteSheet {
  return {
    id: "serpent",
    name: "Lake Serpent",
    title: "Jade Scale Jiao",
    description: "A water serpent one tribulation away from becoming a dragon. Very territorial.",
    width: 56,
    height: 46,
    animations: {
      idle: animate(paintSerpent, Array.from({ length: 10 }, (_, i) => ({ t: f(10, i), tongue: i === 3 || i === 4 })), 8),
      attack: animate(
        paintSerpent,
        [
          { t: 0, strike: -0.3 },
          { t: 0.4, strike: -0.5, tongue: true },
          { t: 0.8, strike: 0.6, tongue: true },
          { t: 1.2, strike: 1 },
          { t: 1.6, strike: 0.4 },
        ],
        10,
        false,
      ),
      hurt: animate(paintSerpent, [{ t: 0, flash: 0.8, strike: -0.4 }, { t: 1, strike: -0.3 }, { t: 2, strike: 0 }], 8, false),
    },
  };
}
