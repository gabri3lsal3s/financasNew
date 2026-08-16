/**
 * Motor puro de gestos de navegação horizontal (F20 — Swipe Navigation).
 *
 * Funções puras e determinísticas (sem DOM/UI) para a detecção de swipe:
 *   • axis-lock ±30° (Thumb Drift): o gesto só vira navegação se o vetor
 *     inicial for dominantemente horizontal — movimento natural em arco do
 *     polegar durante a rolagem vertical NUNCA troca de mês/aba;
 *   • thresholds de distância e velocidade (flick): toques curtos, ajustes
 *     finos ou gestos lentos não alternam de página;
 *   • resistência de borda (rubber-banding): overscroll elástico ao chegar
 *     no início/fim dos dados (sem navegação).
 */

/** Direção de navegação do gesto. */
export type SwipeDirection = "previous" | "next";

/** Resultado da avaliação de um gesto. */
export type SwipeIntent = SwipeDirection | null;

/** Tangente de 30° — limite do axis-lock (±30° em torno do eixo X). */
export const AXIS_LOCK_TANGENT = Math.tan((30 * Math.PI) / 180);

/** Velocidade mínima de arremesso (flick) em px/ms. */
export const FLICK_VELOCITY_PX_PER_MS = 0.3;

/** Distância mínima (px) para um arremesso ser considerado flick. */
export const FLICK_MIN_DISTANCE_PX = 30;

/** Distância mínima de ativação absoluta (px) quando o viewport é pequeno. */
export const ACTIVATION_MIN_PX = 60;

/** Fração do viewport para a distância de ativação relativa (15%). */
export const ACTIVATION_VIEWPORT_RATIO = 0.15;

/** Fator de resistência da borda (elastic drag). */
export const BOUNDARY_RESISTANCE_FACTOR = 0.35;

/** Distância (px) após o lock em que o ponteiro vira dono do gesto. */
export const LOCK_DISTANCE_PX = 8;

/**
 * Zona de segurança das bordas físicas (px) — gestos iniciados aqui ficam
 * reservados ao sistema operacional (edge swipe de voltar do Android/iOS).
 * O app só opera na área central segura (F20 evolução).
 */
export const EDGE_INSET_PX = 24;

/**
 * Razão de dominância do eixo X para ARMAR o gesto: o swipe lateral só
 * inicia quando `|dx| > |dy| · 1.5` logo no início do toque — rolagem
 * vertical com leve desvio horizontal é descartada imediatamente, sem
 * travar o scroll nativo.
 */
export const AXIS_DOMINANCE_RATIO = 1.5;

/**
 * O toque começou na zona de exclusão de borda (edge inset)?
 *
 * `true` quando `clientX` está dentro de `insetPx` px de qualquer borda
 * horizontal — o gesto nativo de voltar do sistema tem prioridade ali.
 * Viewport não medido (≤ 0) nunca é borda (defensivo).
 */
export function isEdgeZoneTouch(clientX: number, viewportWidthPx: number, insetPx = EDGE_INSET_PX): boolean {
  if (viewportWidthPx <= 0 || insetPx <= 0) return false;
  return clientX <= insetPx || clientX >= viewportWidthPx - insetPx;
}

/**
 * Dominância horizontal clara para armar o gesto: `|dx| > |dy| · ratio`.
 * Complementa o cone ±30° (decisão final em `resolveSwipeIntent`): enquanto
 * o cone exige rigor ao soltar, a dominância protege o início do toque —
 * scroll vertical com leve drift lateral nunca vira navegação.
 */
export function isHorizontalDominant(dx: number, dy: number, ratio = AXIS_DOMINANCE_RATIO): boolean {
  if (dx === 0) return false;
  return Math.abs(dx) > Math.abs(dy) * ratio;
}

/**
 * Axis-lock: o gesto é horizontal quando o deslocamento Y fica dentro de
 * ±30° do eixo X (`|dy| ≤ |dx|·tan(30°)`). O parâmetro `degrees` permite
 * calibrar sem alterar o contrato (default 30).
 *
 * Retorna `true` quando o vetor está dentro do cone do eixo X. Um gesto com
 * `|dy| > |dx|` (dominância vertical clara) sai imediatamente — rolagem.
 */
export function isHorizontalLock(dx: number, dy: number, degrees = 30): boolean {
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  // Sem deslocamento horizontal ou dominância vertical inequívoca → rolagem.
  if (absDx === 0 || absDy > absDx) return false;
  const tangent = Math.tan((degrees * Math.PI) / 180);
  return absDy <= absDx * tangent;
}

/**
 * Flick (arremesso): velocidade acima de 0.3 px/ms com deslocamento mínimo
 * de 30px. Gestos rápidos e curtos ainda navegam (não exige a distância
 * total de ativação).
 */
export function isFlick(distancePx: number, elapsedMs: number): boolean {
  if (Math.abs(distancePx) < FLICK_MIN_DISTANCE_PX) return false;
  if (elapsedMs <= 0) return false;
  const velocity = Math.abs(distancePx) / elapsedMs;
  return velocity > FLICK_VELOCITY_PX_PER_MS;
}

/**
 * Distância de ativação do gesto: `max(60px, 15% do viewport)`.
 * Calibra o threshold proporcionalmente à largura do dispositivo.
 */
export function activationDistance(viewportWidthPx: number): number {
  const relative = Math.round(viewportWidthPx * ACTIVATION_VIEWPORT_RATIO);
  return Math.max(ACTIVATION_MIN_PX, relative);
}

/**
 * Resistência de borda (rubber-banding): aplica resistência crescente
 * quando o arrasto ultrapassa o limite permitido (`maxOffsetPx`). Usada no
 * overscroll elástico do início/fim dos dados — o conteúdo "cede" mas não
 * navega.
 */
export function boundaryResistance(offsetPx: number, maxOffsetPx: number): number {
  const absOffset = Math.abs(offsetPx);
  if (absOffset <= maxOffsetPx) return offsetPx;
  const overflow = absOffset - maxOffsetPx;
  const resisted = overflow * BOUNDARY_RESISTANCE_FACTOR;
  return (offsetPx < 0 ? -1 : 1) * (maxOffsetPx + resisted);
}

/**
 * Avalia um gesto completo e resolve a intenção de navegação.
 *
 * Regras (rigor técnico — zero falsos positivos):
 *   1. Lock: se o vetor final não passar no axis-lock (±30°) → `null`
 *      (gesto vertical/scroll);
 *   2. Flick: arremesso rápido (`> 0.3 px/ms` e `≥ 30px`) navega mesmo sem
 *      a distância total de ativação;
 *   3. Distância: senão, exige `|dx| ≥ activationDistance(vw)`;
 *   4. Direção: `dx < 0` (arrastou para a esquerda) → `next`;
 *      `dx > 0` (arrastou para a direita) → `previous`.
 */
export function resolveSwipeIntent(options: {
  /** Deslocamento horizontal final (px; negativo = esquerda). */
  dx: number;
  /** Deslocamento vertical final (px). */
  dy: number;
  /** Tempo decorrido do gesto (ms). */
  elapsedMs: number;
  /** Largura do viewport (px) para o threshold relativo. */
  viewportWidthPx: number;
}): SwipeIntent {
  const { dx, dy, elapsedMs, viewportWidthPx } = options;
  if (dx === 0) return null;
  if (!isHorizontalLock(dx, dy)) return null;

  const absDx = Math.abs(dx);
  const flick = isFlick(dx, elapsedMs);
  if (!flick && absDx < activationDistance(viewportWidthPx)) return null;

  return dx < 0 ? "next" : "previous";
}

/** Direção associada a um deslocamento de arrasto (durante o tracking). */
export function directionOf(dx: number): SwipeDirection | null {
  if (dx === 0) return null;
  return dx < 0 ? "next" : "previous";
}
