import type { Surface } from "./surface";

/** 3x5 bitmap font for in-world floating text (damage numbers, labels). */
const GLYPHS: Record<string, string> = {
  "0": "111101101101111",
  "1": "010110010010111",
  "2": "111001111100111",
  "3": "111001111001111",
  "4": "101101111001001",
  "5": "111100111001111",
  "6": "111100111101111",
  "7": "111001010010010",
  "8": "111101111101111",
  "9": "111101111001111",
  A: "010101111101101",
  B: "110101110101110",
  C: "011100100100011",
  D: "110101101101110",
  E: "111100110100111",
  F: "111100110100100",
  G: "011100101101011",
  H: "101101111101101",
  I: "111010010010111",
  J: "001001001101010",
  K: "101101110101101",
  L: "100100100100111",
  M: "101111111101101",
  N: "110101101101101",
  O: "010101101101010",
  P: "110101110100100",
  Q: "010101101110011",
  R: "110101110101101",
  S: "011100010001110",
  T: "111010010010010",
  U: "101101101101111",
  V: "101101101101010",
  W: "101101111111101",
  X: "101101010101101",
  Y: "101101010010010",
  Z: "111001010100111",
  "+": "000010111010000",
  "-": "000000111000000",
  "!": "010010010000010",
  ".": "000000000000010",
  "/": "001001010100100",
  ":": "000010000010000",
  " ": "000000000000000",
};

export const GLYPH_W = 3;
export const GLYPH_H = 5;

export function textWidth(text: string, scale = 1): number {
  return text.length === 0 ? 0 : (text.length * (GLYPH_W + 1) - 1) * scale;
}

/** Draw text with an optional 1px drop outline for legibility on busy backgrounds. */
export function drawText(
  s: Surface,
  text: string,
  x: number,
  y: number,
  color: string,
  opts: { outline?: string; scale?: number } = {},
): void {
  const scale = opts.scale ?? 1;
  const up = text.toUpperCase();
  const paint = (ox: number, oy: number, c: string) => {
    let cx = Math.round(x) + ox;
    for (const ch of up) {
      const g = GLYPHS[ch] ?? GLYPHS[" "];
      for (let i = 0; i < 15; i++) {
        if (g[i] !== "1") continue;
        s.rect(cx + (i % 3) * scale, Math.round(y) + oy + Math.floor(i / 3) * scale, scale, scale, c);
      }
      cx += (GLYPH_W + 1) * scale;
    }
  };
  if (opts.outline) {
    for (const [ox, oy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
    ])
      paint(ox, oy, opts.outline);
  }
  paint(0, 0, color);
}

export const hasGlyph = (ch: string) => ch.toUpperCase() in GLYPHS;
