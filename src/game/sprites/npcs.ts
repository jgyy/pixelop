import { paintFigure, FIG_H, FIG_W, type FigurePose, type FigureStyle } from "./figure";
import { animate, TAU, type SpriteSheet } from "./types";

const f = (n: number, i: number) => (i / n) * TAU;

export const ELDER_STYLE: FigureStyle = {
  outline: "#161325",
  skin: "#f0cdb4",
  skinShade: "#cf9f88",
  hair: "#e8e8ef",
  hairHi: "#ffffff",
  robe: "#5d6f98",
  robeShade: "#44527a",
  trim: "#f2c55c",
  trimDark: "#a8792c",
  inner: "#eef0f6",
  eye: "#2a2440",
  hairStyle: "topknot",
  beard: "#f4f4f8",
  crown: "#3fb59a",
  accessory: "whisk",
};

export const SISTER_STYLE: FigureStyle = {
  outline: "#1b1430",
  skin: "#f9dcc8",
  skinShade: "#e2ab96",
  hair: "#3a2318",
  hairHi: "#7a4a30",
  robe: "#b9a3e3",
  robeShade: "#8f78c4",
  trim: "#f6f0ff",
  trimDark: "#c9bce8",
  inner: "#fff6fb",
  eye: "#2a1c3f",
  hairStyle: "long",
  crown: "#f2c55c",
  accessory: "fan",
  accessoryColor: "#fde3ef",
};

export const PATRIARCH_STYLE: FigureStyle = {
  outline: "#0d0710",
  skin: "#e8d0d0",
  skinShade: "#b89898",
  hair: "#e9e4f0",
  hairHi: "#ffffff",
  robe: "#2a1420",
  robeShade: "#1a0a14",
  trim: "#c8203a",
  trimDark: "#7a0f22",
  inner: "#5a1020",
  eye: "#ff3355",
  hairStyle: "wild",
  cape: "#8a1028",
  crown: "#c8203a",
  accessory: "saber",
};

function figureSheet(
  id: string,
  name: string,
  title: string,
  description: string,
  style: FigureStyle,
  anims: Record<string, { poses: FigurePose[]; fps: number; loop?: boolean }>,
): SpriteSheet {
  const animations = Object.fromEntries(
    Object.entries(anims).map(([k, v]) => [k, animate((p: FigurePose) => paintFigure(style, p), v.poses, v.fps, v.loop ?? true)]),
  );
  return { id, name, title, description, width: FIG_W, height: FIG_H, animations };
}

export function buildElder(): SpriteSheet {
  return figureSheet("elder", "Elder Mo", "Azure Cloud Sect Master", "Guardian of the Azure Cloud Sect. His whisk has swept away a thousand demons.", ELDER_STYLE, {
    idle: { fps: 5, poses: Array.from({ length: 8 }, (_, i) => ({ t: f(8, i), bob: i >= 4 ? 1 : 0, eyes: i === 7 ? "closed" : "open" })) },
    talk: {
      fps: 6,
      poses: Array.from({ length: 6 }, (_, i) => ({ t: f(6, i), arm: i < 3 ? "point" : "chest", mouth: i % 2 ? "open" : "closed" })),
    },
    bless: {
      fps: 6,
      poses: Array.from({ length: 6 }, (_, i) => ({ t: f(6, i), arm: "raise", eyes: "closed", aura: "#9ff5de", auraSize: 12 + i })),
    },
  });
}

export function buildSister(): SpriteSheet {
  return figureSheet("sister", "Senior Sister Qing", "Alchemy Hall Disciple", "Brews pills by moonlight and trades them for spirit stones.", SISTER_STYLE, {
    idle: { fps: 5, poses: Array.from({ length: 8 }, (_, i) => ({ t: f(8, i), bob: i >= 4 ? 1 : 0, arm: "chest", eyes: i === 5 ? "closed" : "open" })) },
    talk: { fps: 6, poses: Array.from({ length: 6 }, (_, i) => ({ t: f(6, i), arm: i % 3 === 0 ? "raise" : "chest", mouth: i % 2 ? "open" : "closed" })) },
  });
}

export function buildPatriarch(): SpriteSheet {
  return figureSheet("patriarch", "Patriarch Xue", "Blood Moon Sect Master", "A demonic cultivator who stole the Jade Lotus Heart to forge a blood moon.", PATRIARCH_STYLE, {
    idle: {
      fps: 8,
      poses: Array.from({ length: 8 }, (_, i) => ({ t: f(8, i), bob: i % 4 < 2 ? 0 : 1, eyes: "glow", aura: "#ff2040", auraSize: 15 + (i % 2), wind: 0.8 })),
    },
    attack: {
      fps: 10,
      loop: false,
      poses: [
        { t: 0, arm: "raise", eyes: "glow", aura: "#ff2040", auraSize: 18, lean: -1 },
        { t: 0.5, arm: "raise", eyes: "glow", aura: "#ff2040", auraSize: 20, lean: -1, mouth: "open" },
        { t: 1, arm: "slash", eyes: "glow", aura: "#ff2040", auraSize: 16, lean: 2, mouth: "open", wind: 1.2 },
        { t: 1.5, arm: "slash", eyes: "glow", aura: "#ff2040", auraSize: 14, lean: 2, wind: 1 },
        { t: 2, arm: "rest", eyes: "glow", aura: "#ff2040", auraSize: 15 },
      ],
    },
    hurt: {
      fps: 8,
      loop: false,
      poses: [
        { t: 0, flash: 0.8, lean: -2, eyes: "closed", mouth: "open" },
        { t: 0.5, lean: -2, eyes: "closed", aura: "#ff2040", auraSize: 12 },
        { t: 1, lean: -1, eyes: "glow", aura: "#ff2040", auraSize: 14 },
      ],
    },
  });
}
