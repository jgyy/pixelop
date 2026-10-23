import { mix } from "../pixel/color";
import type { Ramp } from "../iso/raster";

/**
 * Hue-shifted four-tone ramp from a base colour: highlights drift warm,
 * shadows drift toward violet, which is what makes pixel art read as painted.
 */
export function ramp(base: string, opts: { hi?: string; lo?: string; spread?: number } = {}): Ramp {
  const s = opts.spread ?? 1;
  return [mix(base, opts.hi ?? "#fff6d8", 0.4 * s), base, mix(base, opts.lo ?? "#3a2458", 0.34 * s), mix(base, "#140c26", 0.58 * s)];
}

/** Ramp given explicitly (lightest → darkest). */
export const tones = (hi: string, base: string, shade: string, deep: string): Ramp => [hi, base, shade, deep];

export const OUTLINE = "#1a1226";

export const PAL = {
  skin: ramp("#f6d3bd", { lo: "#b0607a", spread: 0.8 }),
  skinTan: ramp("#e0ad88", { lo: "#8a4a5a", spread: 0.85 }),
  skinPale: ramp("#d9e6d2", { lo: "#5a7a6a", spread: 0.8 }),
  hairBlack: tones("#5d4f8f", "#2c2148", "#1e1634", "#120c22"),
  hairWhite: tones("#ffffff", "#e8e6f0", "#b4b0c8", "#7d7898"),
  hairGrey: ramp("#9a96a8"),
  hairBrown: ramp("#5a3a2a"),
  hairAuburn: ramp("#c25a2a"),
  hairSilver: ramp("#d8dcf0", { lo: "#6a6aa0" }),
  white: tones("#ffffff", "#f1eee6", "#c9cadc", "#9c9fbe"),
  jade: ramp("#3fb59a", { lo: "#1a4a5a" }),
  jadeDeep: ramp("#22806e", { lo: "#0f3040" }),
  rose: ramp("#f39bc0", { lo: "#8a3a7a" }),
  lavender: ramp("#c8b5ea"),
  gold: tones("#fff0a0", "#f2c55c", "#c08a30", "#7a4a20"),
  steel: tones("#ffffff", "#dfe8f4", "#9aaccc", "#5a6a8e"),
  red: ramp("#d8433f", { lo: "#5a1030" }),
  crimson: ramp("#a8182e", { lo: "#3a0520" }),
  black: tones("#4a4060", "#2a2238", "#1a1428", "#0c0814"),
  blue: ramp("#4a78c8"),
  azure: ramp("#6ab0e8"),
  navy: ramp("#2c3a6a"),
  green: ramp("#5aa040"),
  moss: ramp("#4a7a3a"),
  brown: ramp("#8a5a3a"),
  wood: ramp("#9a6a40"),
  woodDark: ramp("#5a3a28"),
  straw: ramp("#d8b860", { lo: "#7a5a30" }),
  orange: ramp("#f08a3a"),
  teal: ramp("#2a8a8a"),
  purple: ramp("#7a4ab0"),
  grey: ramp("#8a8aa0"),
  stone: ramp("#a8a4b4", { lo: "#4a4060" }),
  paper: ramp("#f4e2a0", { lo: "#8a6a30" }),
  qi: tones("#ffffff", "#9ff5de", "#4ac8b0", "#1a7a7a"),
} as const;
