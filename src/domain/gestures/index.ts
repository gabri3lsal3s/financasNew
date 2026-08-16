/**
 * Barrel de domínio de gestos — swipe de abas/navegação (AGENTS.md §7).
 * Importe via `@/domain/gestures` (nunca caminhos profundos).
 */
export {
  AXIS_DOMINANCE_RATIO,
  EDGE_INSET_PX,
  LOCK_DISTANCE_PX,
  boundaryResistance,
  directionOf,
  isEdgeZoneTouch,
  isHorizontalDominant,
  resolveSwipeIntent,
} from "./swipe";
export type { SwipeDirection, SwipeIntent } from "./swipe";
