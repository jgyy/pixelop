import type { AnimId, HumanId } from "../art/characters";
import type { EnemyId } from "../engine/enemies";
import type { GameState } from "../engine/state";
import type { Emote } from "../runtime/world";

/**
 * Cutscenes and conversations are lists of steps run one after another by
 * the game. Actors are addressed by key: "hero", an NPC key, or an enemy
 * spawn key in the current area.
 */
export type Speaker = HumanId | "narrator";

export type Step =
  | { say: Speaker; text: string; name?: string }
  | { narrate: string[] }
  | { emote: string; icon: Emote; wait?: number }
  | { face: string; to: string }
  | { walk: string; to: [number, number]; wait?: boolean }
  | { anim: string; name: AnimId; wait?: boolean }
  | { wait: number }
  | { shake: number }
  | { flash: string }
  | { fade: "out" | "in" }
  | { camera: string | [number, number] | null }
  | { toast: string }
  | { spawn: string; char: HumanId; at: [number, number]; dir?: number }
  | { despawn: string }
  | { battle: EnemyId; key: string; then?: Step[] }
  | { mutate: (g: GameState) => GameState }
  | { shop: true }
  | { meditate: true }
  /** Call heaven's lightning down on her where she sits (after the heart demon trial). */
  | { tribulation: true }
  | { travel: true }
  /** Lay the story's changes to the land down at once (with dust and a tremor if she can see them). */
  | { reshape: true }
  /** Stop here: skip whatever was left of the script (a fight that a choice talked its way out of). */
  | { end: true }
  | { choose: Choice[]; prompt?: string };

/**
 * One answer to a question put to the heroine. Picking it runs its steps in
 * place, before whatever followed the question; the choice itself is
 * remembered through the flags its steps set.
 */
export interface Choice {
  label: string;
  /** A short note on what it will cost or bring (shown under the label). */
  hint?: string;
  then: Step[];
}

export const say = (who: Speaker, text: string): Step => ({ say: who, text });
