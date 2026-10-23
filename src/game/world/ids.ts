/** Area ids live in their own tiny module so the save schema (used server-side) stays light. */
export const AREA_IDS = ["sect", "village", "bamboo", "lake", "valley", "peak"] as const;
export type AreaId = (typeof AREA_IDS)[number];
