/** Player preferences kept in this browser: how the world is drawn and how the camera behaves. */
export interface Settings {
  /** The 3D world (Babylon.js) or the original isometric pixel view. */
  view: "3d" | "2d";
  /** 3D render pixels per game pixel: 1 is chunky pixel art, 2 crisp, 3 smooth. */
  quality: 1 | 2 | 3;
  /** Turn the camera the other way when dragging. */
  invertDrag: boolean;
  /** Show the little compass and camera hints in the 3D view. */
  compass: boolean;
}

export const DEFAULT_SETTINGS: Settings = { view: "3d", quality: 2, invertDrag: false, compass: true };

const KEY = "jade-lotus:settings";

export function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw) as Partial<Settings>;
    return {
      view: s.view === "2d" ? "2d" : "3d",
      quality: s.quality === 1 || s.quality === 3 ? s.quality : 2,
      invertDrag: !!s.invertDrag,
      compass: s.compass !== false,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // private windows and blocked storage simply forget
  }
}
