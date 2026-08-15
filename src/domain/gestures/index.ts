/**
 * Barrels de domínio de gestos — swipe (AGENTS.md §7).
 * Importe via `@/domain/gestures` (nunca caminhos profundos).
 */
export {
  ACTIVATION_MIN_PX,
  ACTIVATION_VIEWPORT_RATIO,
  AXIS_LOCK_TANGENT,
  BOUNDARY_RESISTANCE_FACTOR,
  FLICK_MIN_DISTANCE_PX,
  FLICK_VELOCITY_PX_PER_MS,
  LOCK_DISTANCE_PX,
  activationDistance,
  boundaryResistance,
  directionOf,
  isFlick,
  isHorizontalLock,
  resolveSwipeIntent,
} from "./swipe";
export type { SwipeDirection, SwipeIntent } from "./swipe";
