import { PixelBuffer, layer } from "../pixel/PixelBuffer";
import { alpha, mix } from "../pixel/color";
import { animate, TAU, type SpriteSheet } from "./types";

const f = (n: number, i: number) => (i / n) * TAU;
const OUT = "#1a1226";

/** Lin Yue's companion flying sword, hovering point-down with a qi shimmer. */
export function buildSpiritSword(): SpriteSheet {
  const paint = ({ t, glint }: { t: number; glint: number }) =>
    layer(14, 26, (b) => {
      const y = 2 + Math.round(Math.sin(t));
      b.vline(7, y + 7, y + 22, "#e3ecf7");
      b.vline(8, y + 8, y + 21, "#93a8c6");
      b.px(7, y + 23, "#ffffff");
      b.hline(4, 10, y + 6, "#f2c55c");
      b.px(7, y + 6, "#3fb59a");
      b.vline(7, y + 2, y + 5, "#3b2d55");
      b.px(7, y + 1, "#f2c55c");
      b.line(6, y + 1, 5 + Math.sin(t * 2), y - 1 + 4, "#d8433f");
      if (glint >= 0) {
        const gy = y + 8 + glint * 3;
        b.px(7, gy, "#ffffff");
        b.px(6, gy, alpha("#9ff5de", 0.8));
        b.px(8, gy, alpha("#9ff5de", 0.8));
      }
    }, OUT);
  return {
    id: "spiritSword",
    name: "Moonlit Jian",
    title: "Bonded Flying Sword",
    description: "A spirit sword bound to Lin Yue's dantian. It hums when demons are near.",
    width: 14,
    height: 26,
    animations: {
      hover: animate(paint, Array.from({ length: 8 }, (_, i) => ({ t: f(8, i), glint: i < 5 ? i : -1 })), 8),
    },
  };
}

/** Incense shrine where the heroine meditates. Smoke curls upward. */
export function buildShrine(): SpriteSheet {
  const paint = ({ t, lit }: { t: number; lit: number }) => {
    const b = new PixelBuffer(40, 52);
    b.blit(
      layer(40, 52, (s) => {
        // stone plinth
        s.rect(6, 44, 28, 7, "#7a7f96");
        s.hline(6, 33, 44, "#a4a9c0");
        s.rect(9, 40, 22, 4, "#8c91aa");
        // roofed altar
        s.rect(11, 26, 18, 14, "#9b2d35");
        s.rect(13, 28, 14, 10, "#2a1a24");
        s.polygon([[5, 26], [35, 26], [30, 19], [10, 19]], "#2f4a5c");
        s.hline(5, 35, 26, "#f2c55c");
        s.line(5, 26, 3, 23, "#2f4a5c");
        s.line(35, 26, 37, 23, "#2f4a5c");
        s.rect(18, 16, 4, 3, "#f2c55c");
        // jade lotus statue inside
        s.ellipse(20, 35, 4, 1.5, "#3fb59a");
        s.ellipse(20, 32, 2, 2.5, mix("#93e8d1", "#ffffff", lit * 0.15));
        // incense burner
        s.rect(16, 42, 8, 2, "#c9a24a");
        s.vline(18, 38, 41, "#c88");
        s.vline(20, 37, 41, "#c88");
        s.vline(22, 38, 41, "#c88");
      }, OUT),
      0,
      0,
    );
    // embers & smoke
    [18, 20, 22].forEach((x, i) => b.px(x, 37 + (i === 1 ? 0 : 1), lit > 0.5 ? "#ffb347" : "#ff7a3a"));
    for (let k = 0; k < 3; k++)
      for (let i = 0; i < 14; i++) {
        const y = 36 - i * 2.2;
        const x = 18 + k * 2 + Math.sin(t + i * 0.45 + k) * (i * 0.25);
        b.px(x, y, alpha("#e8e4f4", 0.55 - i * 0.035));
      }
    // lanterns
    b.rect(6, 28, 3, 4, lit > 0.5 ? "#ffb347" : "#f08a3c");
    b.rect(31, 28, 3, 4, lit > 0.5 ? "#ffb347" : "#f08a3c");
    b.px(7, 27, OUT);
    b.px(32, 27, OUT);
    return b;
  };
  return {
    id: "shrine",
    name: "Lotus Shrine",
    title: "Meditation Altar",
    description: "Burn incense and sit in lotus position here to refine qi and recover.",
    width: 40,
    height: 52,
    animations: { idle: animate(paint, Array.from({ length: 8 }, (_, i) => ({ t: f(8, i), lit: i % 2 })), 6) },
  };
}

/** Circular moon gate whose surface swirls with spatial qi — leads to the next region. */
export function buildMoonGate(): SpriteSheet {
  const paint = ({ t }: { t: number }) => {
    const b = new PixelBuffer(48, 60);
    b.blit(
      layer(48, 60, (s) => {
        s.rect(2, 8, 44, 51, "#d9d2c2");
        s.hline(2, 45, 8, "#f3eee2");
        s.polygon([[0, 8], [48, 8], [42, 1], [6, 1]], "#2f4a5c");
        s.hline(0, 47, 8, "#f2c55c");
        s.ellipse(24, 34, 15, 20, "#000000");
        s.rect(2, 56, 44, 3, "#9a927e");
      }, OUT),
      0,
      0,
    );
    // swirling portal fill
    for (let y = 14; y <= 54; y++)
      for (let x = 9; x <= 39; x++) {
        const nx = (x - 24) / 15.5;
        const ny = (y - 34) / 20.5;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        const ang = Math.atan2(ny, nx);
        const v = Math.sin(ang * 3 + Math.sqrt(d) * 9 - t * 2);
        const c = v > 0.6 ? "#e6fffa" : v > 0 ? "#7fe0d0" : v > -0.5 ? "#3a9fb8" : "#2a4f8a";
        b.px(x, y, c);
      }
    b.ellipse(24, 34, 3, 4, alpha("#ffffff", 0.8));
    return b;
  };
  return {
    id: "moonGate",
    name: "Moon Gate",
    title: "Spatial Passage",
    description: "An ancient round gate folding the distance between realms.",
    width: 48,
    height: 60,
    animations: { idle: animate(paint, Array.from({ length: 12 }, (_, i) => ({ t: f(12, i) })), 10) },
  };
}

export function buildSpiritHerb(): SpriteSheet {
  const paint = ({ t }: { t: number }) => {
    const b = new PixelBuffer(16, 18);
    const g = 0.5 + Math.sin(t) * 0.5;
    b.circle(8, 6, 5, alpha("#fff3a0", 0.12 + g * 0.18));
    b.blit(
      layer(16, 18, (s) => {
        s.vline(8, 7, 16, "#3a8a3a");
        s.ellipse(5, 12, 2.5, 1, "#4fb84f");
        s.ellipse(11, 10, 2.5, 1, "#4fb84f");
        s.ellipse(8, 5, 2, 2, mix("#ffd23a", "#ffffff", g * 0.6));
        s.px(8, 5, "#ffffff");
      }, "#0e2a12"),
      0,
      0,
    );
    if (g > 0.7) b.px(3 + Math.round(t), 2, "#ffffff");
    return b;
  };
  return {
    id: "herb",
    name: "Spirit Herb",
    title: "Sunlit Ginseng Bloom",
    description: "Restores qi. Glows brighter when ripe.",
    width: 16,
    height: 18,
    animations: { idle: animate(paint, Array.from({ length: 8 }, (_, i) => ({ t: f(8, i) })), 6) },
  };
}

/** Lotus that slowly blooms open then closes. */
export function buildLotus(): SpriteSheet {
  const paint = ({ open }: { open: number }) =>
    layer(24, 16, (s) => {
      s.ellipse(12, 13, 10, 2.5, "#2e8a5a");
      s.ellipse(12, 13, 8, 1.5, "#3fae6e");
      const spread = 1 + open * 4;
      for (let k = -2; k <= 2; k++) {
        const x = 12 + k * spread * 0.8;
        const top = 4 + Math.abs(k) * (1 + open);
        s.polygon([[12 + k * 1.2, 12], [x - 1.5, top + 2], [x, top], [x + 1.5, top + 2]], k === 0 ? "#ffd6e6" : "#f6a6c9");
        s.px(x, top + 1, "#ffffff");
      }
      if (open > 0.5) s.ellipse(12, 9, 1.5, 1, "#f2c55c");
    }, "#3a1430");
  return {
    id: "lotus",
    name: "Jade Lotus",
    title: "Lake Lotus",
    description: "Lotus flowers of the moonlit lake; their petals open with the rising moon.",
    width: 24,
    height: 16,
    animations: {
      bloom: animate(paint, [0, 0.15, 0.35, 0.6, 0.85, 1, 1, 0.85, 0.6, 0.35, 0.15, 0].map((open) => ({ open })), 6),
    },
  };
}

export function buildLantern(): SpriteSheet {
  const paint = ({ t }: { t: number }) => {
    const b = new PixelBuffer(12, 16);
    const fl = 0.5 + 0.5 * Math.sin(t * 3);
    b.circle(6, 7, 5, alpha("#ffb347", 0.15 + fl * 0.15));
    b.blit(
      layer(12, 16, (s) => {
        s.rect(3, 3, 6, 8, "#e0403a");
        s.vline(4, 4, 10, "#ff7a5a");
        s.rect(4, 2, 4, 1, "#3a1a1a");
        s.rect(4, 11, 4, 1, "#3a1a1a");
        s.rect(5, 6, 2, 3, mix("#ffd23a", "#ffffff", fl * 0.7));
        s.vline(6, 12, 13 + Math.round(fl), "#f2c55c");
      }, "#2a0e10"),
      0,
      0,
    );
    return b;
  };
  return {
    id: "lantern",
    name: "Sky Lantern",
    title: "Kongming Lantern",
    description: "Wishes written on red paper, drifting up to the immortals.",
    width: 12,
    height: 16,
    animations: { idle: animate(paint, Array.from({ length: 6 }, (_, i) => ({ t: f(6, i) })), 8) },
  };
}

/** Red-crowned crane in flight (wing flap cycle). */
export function buildCrane(): SpriteSheet {
  const wings = [-5, -3, 0, 3, 4, 1];
  const paint = (w: number) =>
    layer(28, 18, (s) => {
      s.ellipse(14, 9, 5, 2, "#f4f4f8");
      s.line(9, 8, 3, 6, "#f4f4f8");
      s.px(2, 6, "#e0303a");
      s.line(1, 6, 0, 7, "#d8a040");
      s.line(19, 9, 26, 10, "#2a2a32");
      s.polygon([[12, 8], [17, 8], [19 + Math.abs(w) * 0.3, 9 + w], [13, 9 + w * 1.1]], "#f4f4f8");
      s.line(13, 9 + w * 1.1, 19 + Math.abs(w) * 0.3, 9 + w, "#2a2a32");
    }, "#2a2a40");
  return {
    id: "crane",
    name: "Spirit Crane",
    title: "Messenger of the Immortals",
    description: "Cranes circle the sect peaks at dawn.",
    width: 28,
    height: 18,
    animations: { fly: animate(paint, wings, 8) },
  };
}

export function buildQiOrb(): SpriteSheet {
  const paint = ({ t }: { t: number }) => {
    const b = new PixelBuffer(16, 16);
    const r = 3 + Math.sin(t);
    b.circle(8, 8, r + 3, alpha("#9ff5de", 0.15));
    b.circle(8, 8, r + 1.5, alpha("#9ff5de", 0.45));
    b.circle(8, 8, r, "#d6fff4");
    for (let i = 0; i < 3; i++) {
      const a = t * 1.5 + (i * TAU) / 3;
      b.px(8 + Math.cos(a) * (r + 4), 8 + Math.sin(a) * (r + 4), "#ffffff");
    }
    return b;
  };
  return {
    id: "qiOrb",
    name: "Qi Orb",
    title: "Condensed Spiritual Energy",
    description: "Dropped by defeated foes; absorbed to advance cultivation.",
    width: 16,
    height: 16,
    animations: { pulse: animate(paint, Array.from({ length: 8 }, (_, i) => ({ t: f(8, i) })), 10) },
  };
}
