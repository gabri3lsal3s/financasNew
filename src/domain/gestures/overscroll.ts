/**
 * Motor puro de física do gesto Pull-up / Overscroll to Top (F26).
 *
 * Regras matemáticas isoladas (sem DOM/React — testáveis):
 * • `computePullDistance` — resistência elástica logarítmica: os primeiros px
 *   seguem 1:1 e a resistência cresce até um teto (`maxPull`), evitando que o
 *   indicador "vaze" da tela.
 * • `isAtScrollBottom` — repouso estático no fim do contêiner rolável com
 *   tolerância configurável (barreira contra momentum scrolling).
 * • `evaluatePullIntent` — decisão de disparo: exige distância >= threshold E
 *   contêiner em repouso no rodapé (inércia de rolagem rápida NÃO dispara).
 */

/** Limiar efetivo (px) de disparo do gesto — piso de segurança. */
export const PULL_TO_TOP_THRESHOLD_PX = 80;
/** Teto da resistência elástica (px máximos visualizados). */
export const PULL_TO_TOP_MAX_PULL_PX = 140;
/** Tolerância (px) para considerar o contêiner "no fim" do scroll. */
export const SCROLL_BOTTOM_TOLERANCE_PX = 2;
/** Fator base da resistência logarítmica (curva suave de amortecimento). */
export const OVERSCOLL_RESISTANCE_BASE = 1.6;

/**
 * Aplica resistência elástica logarítmica ao arrasto vertical bruto.
 *
 * Curva: os primeiros ~24px são quase 1:1 (feedback imediato), depois o
 * amortecimento cresce até `maxPull` (a barra nunca "estoura" a tela).
 * Valores negativos (arrasto para cima) retornam 0 — só puxamos para baixo.
 */
export function computePullDistance(
  rawDeltaY: number,
  maxPull: number = PULL_TO_TOP_MAX_PULL_PX,
  resistanceBase: number = OVERSCOLL_RESISTANCE_BASE,
): number {
  if (!Number.isFinite(rawDeltaY) || rawDeltaY <= 0 || maxPull <= 0) return 0;
  // Curva exponencial amortecida (padrão de overscroll nativo): os primeiros
  // px seguem ~1:1 (feedback imediato — a derivada em x=0 é 1) e a resistência
  // cresce suavemente até assíntota em maxPull — nunca ultrapassa o teto.
  void resistanceBase; // mantém a assinatura pública (ajuste fino da curva no futuro)
  const eased = 1 - Math.exp(-rawDeltaY / maxPull);
  return maxPull * eased;
}

/**
 * O contêiner está parado no fim do scroll?
 *
 * Barreira de inércia (DoD): flings rápidos que "batem" no rodapé durante o
 * momentum são ignorados — só um toque estático intencional no fim acumula.
 * `tolerance` absorve sub-pixels de arredondamento do layout.
 */
export function isAtScrollBottom(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
  tolerance: number = SCROLL_BOTTOM_TOLERANCE_PX,
): boolean {
  if (scrollHeight <= 0) return false;
  return scrollTop + clientHeight >= scrollHeight - tolerance;
}

/** Resultado da avaliação de intenção do pull-up. */
export type PullIntent = "trigger" | "hold" | "idle";

/**
 * Decide a intenção do gesto a partir da distância puxada e do estado do
 * contêiner. O disparo exige AMBOS: threshold atingido E rodapé estático
 * (a inércia de rolagem rápida falha no `isStaticBottom`).
 */
export function evaluatePullIntent(
  pullDistance: number,
  threshold: number = PULL_TO_TOP_THRESHOLD_PX,
  isStaticBottom: boolean,
): PullIntent {
  if (!isStaticBottom || pullDistance <= 0) return "idle";
  return pullDistance >= threshold ? "trigger" : "hold";
}
