/** Area ids live in their own tiny module so the save schema (used server-side) stays light. */
export const AREA_IDS = ["sect", "village", "bamboo", "lake", "valley", "peak", "marsh", "terraces", "desert", "harbor", "frost"] as const;
export type AreaId = (typeof AREA_IDS)[number];
/** The six regions of the world before it doubled again (older saves only know these). */
export const OLD_AREA_IDS = ["sect", "village", "bamboo", "lake", "valley", "peak"] as const satisfies readonly AreaId[];
export type OldAreaId = (typeof OLD_AREA_IDS)[number];
