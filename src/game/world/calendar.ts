import type { GameState } from "../engine/state";
import type { AreaId } from "./ids";

/**
 * The jianghu's calendar. Time of day and the season both follow the save's
 * play time (plus whatever time she has let pass at an almanac), so a night
 * she left the game in is still night when she comes back, and the year
 * turns while she plays: spring blossom, summer rain, autumn leaves and the
 * winter snow, two days to a season.
 *
 * World time 0 is noon on the first day of spring; the light follows a
 * cosine, darkest at midnight (half a day on).
 */

/** Length of a full day/night cycle in seconds of world time. */
export const DAY_LENGTH = 360;
export const DAYS_PER_SEASON = 2;
export const SEASON_LENGTH = DAY_LENGTH * DAYS_PER_SEASON;
export const YEAR_LENGTH = SEASON_LENGTH * 4;

export const SEASONS = ["spring", "summer", "autumn", "winter"] as const;
export type Season = (typeof SEASONS)[number];

export const SEASON_INFO: Record<Season, { name: string; hanzi: string; colour: string }> = {
  spring: { name: "Spring", hanzi: "春", colour: "#f8a8c8" },
  summer: { name: "Summer", hanzi: "夏", colour: "#7ad068" },
  autumn: { name: "Autumn", hanzi: "秋", colour: "#f08a3a" },
  winter: { name: "Winter", hanzi: "冬", colour: "#c8e0ff" },
};

/** The counter holding the seconds she has let pass (waiting at an almanac). */
export const TIME_SKIP = "clock:skip";

export type DayPhase = "dawn" | "day" | "dusk" | "night";

/** 0 at noon (world time 0), 1 at midnight. */
export const duskAt = (t: number) => (1 - Math.cos((t / DAY_LENGTH) * Math.PI * 2)) / 2;

/** World time of a save, in seconds. */
export const worldTime = (g: Pick<GameState, "playTime" | "counters">) => g.playTime + (g.counters[TIME_SKIP] ?? 0);

/** Hour of the day, 0–24 (world time 0 is noon). */
export const hourAt = (t: number) => ((((t / DAY_LENGTH) * 24 + 12) % 24) + 24) % 24;

export function phaseAt(t: number): DayPhase {
  const h = hourAt(t);
  if (h >= 5 && h < 7) return "dawn";
  if (h >= 7 && h < 17) return "day";
  if (h >= 17 && h < 19.5) return "dusk";
  return "night";
}

export const seasonAt = (t: number): Season => SEASONS[Math.floor((((t % YEAR_LENGTH) + YEAR_LENGTH) % YEAR_LENGTH) / SEASON_LENGTH)];

export interface CalendarDay {
  /** Day of the year she is in, from 1. */
  day: number;
  /** Day of the season, from 1. */
  dayOfSeason: number;
  year: number;
  season: Season;
  hour: number;
  phase: DayPhase;
  /** 0 = noon light, 1 = deepest night. */
  dusk: number;
  /** How far through the season (0..1). */
  progress: number;
}

export function calendarAt(t: number): CalendarDay {
  const T = Math.max(0, t);
  const inYear = T % YEAR_LENGTH;
  const inSeason = inYear % SEASON_LENGTH;
  return {
    day: Math.floor(inYear / DAY_LENGTH) + 1,
    dayOfSeason: Math.floor(inSeason / DAY_LENGTH) + 1,
    year: Math.floor(T / YEAR_LENGTH) + 1,
    season: seasonAt(T),
    hour: hourAt(T),
    phase: phaseAt(T),
    dusk: duskAt(T),
    progress: inSeason / SEASON_LENGTH,
  };
}

/** "Spring, day 2 · Dusk" */
export function calendarLabel(c: CalendarDay): string {
  const hh = Math.floor(c.hour);
  const watch = ["Rat", "Ox", "Tiger", "Rabbit", "Dragon", "Snake", "Horse", "Goat", "Monkey", "Rooster", "Dog", "Pig"][Math.floor(((c.hour + 1) % 24) / 2)];
  return `${SEASON_INFO[c.season].name}, day ${c.dayOfSeason} · Hour of the ${watch} (${String(hh).padStart(2, "0")}:00)`;
}

/** Seconds from world time t until the next moment the predicate on the hour holds (searched in 1/48 day steps). */
function untilHour(t: number, ok: (h: number) => boolean): number {
  const step = DAY_LENGTH / 48;
  for (let k = 1; k <= 48; k++) if (ok(hourAt(t + k * step))) return k * step;
  return 0;
}

/** Let time pass to the next dawn, nightfall or season: returns the save with its time skip moved on. */
export function passTime(g: GameState, to: "dawn" | "night" | "season"): GameState {
  const t = worldTime(g);
  let by: number;
  if (to === "season") by = SEASON_LENGTH - (((t % SEASON_LENGTH) + SEASON_LENGTH) % SEASON_LENGTH) + DAY_LENGTH * 0.02;
  else by = untilHour(t, to === "dawn" ? (h) => h >= 6 && h < 6.6 : (h) => h >= 21 && h < 21.6);
  return { ...g, counters: { ...g.counters, [TIME_SKIP]: (g.counters[TIME_SKIP] ?? 0) + Math.ceil(by) } };
}

/** Set the clock to a fraction of the day (0 noon, 0.5 midnight), keeping the season. Tests and screenshots. */
export function atTimeOfDay(g: GameState, k: number, season?: Season): GameState {
  const t = worldTime(g);
  const seasonStart = Math.floor(t / SEASON_LENGTH) * SEASON_LENGTH;
  const yearStart = Math.floor(t / YEAR_LENGTH) * YEAR_LENGTH;
  const base = season ? yearStart + SEASONS.indexOf(season) * SEASON_LENGTH : seasonStart;
  const target = base + k * DAY_LENGTH;
  return { ...g, counters: { ...g.counters, [TIME_SKIP]: Math.ceil(target - g.playTime) } };
}

/**
 * How the year shows in each region: the temperate lands take every season,
 * the desert only its dry heat and cold nights, while Frostveil is always
 * under snow and the demon valley and the peak answer to no season at all.
 */
export type Climate = "temperate" | "arid" | "frozen" | "none";
export const CLIMATE: Record<AreaId, Climate> = {
  sect: "temperate",
  village: "temperate",
  bamboo: "temperate",
  lake: "temperate",
  valley: "none",
  peak: "none",
  marsh: "temperate",
  terraces: "temperate",
  desert: "arid",
  harbor: "temperate",
  frost: "frozen",
};

/**
 * Whether a summer shower is falling at world time t: a few hours of rain on
 * some summer afternoons (and the odd spring drizzle).
 */
export function rainingAt(t: number): number {
  const s = seasonAt(t);
  if (s !== "summer" && s !== "spring") return 0;
  const day = Math.floor(t / DAY_LENGTH);
  const h = hourAt(t);
  const roll = ((day * 2654435761) >>> 0) / 4294967296;
  if (roll > (s === "summer" ? 0.75 : 0.35)) return 0;
  const start = 13 + roll * 6;
  const len = s === "summer" ? 3 : 2;
  const into = (h - start + 24) % 24;
  if (into > len) return 0;
  // the shower builds and dies away
  return Math.min(1, into / 0.5, (len - into) / 0.5);
}
