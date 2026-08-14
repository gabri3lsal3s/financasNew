/**
 * Virtualização de listas (F5.5) — cálculo puro do "window" visível.
 * Sem UI: recebe a posição de rolagem e as dimensões e devolve o intervalo
 * de índices a renderizar + os offsets dos espaçadores (render-ahead).
 */

export interface VirtualWindowParams {
  /** Quantidade total de itens. */
  total: number;
  /** Posição de rolagem vertical (px). */
  scrollTop: number;
  /** Altura visível do contêiner (px). */
  viewportHeight: number;
  /** Altura fixa de cada item (px) — listas virtuais usam linhas uniformes. */
  itemHeight: number;
  /** Linhas extras renderizadas acima/abaixo do visível (evita flash). */
  overscan?: number;
}

export interface VirtualWindow {
  /** Primeiro índice renderizado (inclusivo). */
  start: number;
  /** Último índice renderizado (exclusivo). */
  end: number;
  /** Altura total do conteúdo (px) — para o espaçador inferior. */
  totalHeight: number;
  /** Deslocamento do bloco visível (px) — para o espaçador superior. */
  offsetY: number;
}

const DEFAULT_OVERSCAN = 4;

/** Lista vazia ou dimensões inválidas → janela nula (renderiza nada). */
export function isEmptyWindow(params: VirtualWindowParams): boolean {
  return params.total === 0 || params.viewportHeight <= 0 || params.itemHeight <= 0;
}

/** Janela virtual: itens visíveis + overscan, com offsets para espaçadores. */
export function computeVirtualWindow(params: VirtualWindowParams): VirtualWindow {
  const overscan = params.overscan ?? DEFAULT_OVERSCAN;

  if (isEmptyWindow(params)) {
    return { start: 0, end: 0, totalHeight: 0, offsetY: 0 };
  }

  const { total, scrollTop, viewportHeight, itemHeight } = params;
  const firstVisible = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(viewportHeight / itemHeight);

  const start = Math.max(0, firstVisible - overscan);
  const end = Math.min(total, firstVisible + visibleCount + overscan);

  return {
    start,
    end,
    totalHeight: total * itemHeight,
    offsetY: start * itemHeight,
  };
}
