import type { Interactable } from "./areas";
import { CAVE_IDS, getCave, isCaveId, type CaveId } from "./caves";
import { getInterior, INTERIOR_IDS, isInteriorId, type InteriorDef, type InteriorId } from "./interiors";

/**
 * Everywhere she can step out of the open world into a map of its own: the
 * buildings with rooms inside them, and the caves beneath the mountains.
 */
export type RoomId = InteriorId | CaveId;
export const ROOM_IDS: readonly RoomId[] = [...INTERIOR_IDS, ...CAVE_IDS];

export const isRoomId = (s: string | undefined): s is RoomId => isInteriorId(s) || isCaveId(s);

export function getRoom(id: RoomId): InteriorDef & { opens?: (f: Record<string, boolean>) => boolean } {
  return isCaveId(id) ? getCave(id) : getInterior(id);
}

/** Whether a room's door is open yet (a cave mouth buried until the story bares it). */
export const roomOpen = (id: RoomId, f: Record<string, boolean>) => getRoom(id).opens?.(f) ?? true;

/** The open-world doors and cave mouths, as interactables to stand before each one. */
export function roomDoors(): Interactable[] {
  return ROOM_IDS.map((id) => {
    const d = getRoom(id);
    return { key: `door-${id}`, kind: "door", i: d.door[0], j: d.door[1], to: id, ...(d.opens && { when: d.opens }) };
  });
}
