/**
 * viewport.ts — Motor Matemático de Viewport Útil e Geometria do Spotlight
 *
 * Provê funções puras para cálculo da zona livre desobstruída (Dead Center)
 * no mobile, prevenindo sobreposição por Header fixo, BottomNav ou Popover Card,
 * além da geometria de recortes circulares e retangulares do Spotlight.
 */

export const DEFAULT_HEADER_HEIGHT = 64;
export const DEFAULT_BOTTOM_NAV_HEIGHT = 72;
export const DEFAULT_CARD_HEIGHT = 180;
export const DEFAULT_SAFETY_MARGIN = 16;
export const MOBILE_BREAKPOINT = 768;

export interface CalculateFreeViewportOptions {
  /** Altura total da janela da viewport (window.innerHeight) */
  windowHeight: number;
  /** Altura do cabeçalho fixo superior em pixels (padrão: 64px) */
  headerHeight?: number;
  /** Altura efetiva da barra de ferramentas inferior + safe area em pixels (padrão: 72px) */
  bottomNavHeight?: number;
  /** Altura real ou estimada do card popover explicativo em pixels (padrão: 180px) */
  cardHeight?: number;
  /** Margem mínima de segurança contra colisões em pixels (padrão: 16px) */
  safetyMargin?: number;
  /** Posição em que o card popover está ancorado no mobile */
  anchorPosition: "top" | "bottom";
  /** Se o viewport atual é mobile (< 768px) */
  isMobile: boolean;
}

export interface FreeViewportWindow {
  /** Coordenada Y superior da zona livre útil */
  top: number;
  /** Coordenada Y inferior da zona livre útil */
  bottom: number;
  /** Altura líquida da zona livre útil */
  height: number;
  /** Ponto médio vertical (Dead Center) da zona livre útil */
  centerY: number;
}

/**
 * Calcula a janela visual livre de obstrução na viewport mobile.
 *
 * Quando o card ancora no topo:
 *   - Limite superior: headerHeight + cardHeight + safetyMargin
 *   - Limite inferior: windowHeight - bottomNavHeight - safetyMargin
 *
 * Quando o card ancora na base:
 *   - Limite superior: headerHeight + safetyMargin
 *   - Limite inferior: windowHeight - cardHeight - bottomNavHeight - safetyMargin
 */
export function calculateFreeViewportWindow(
  options: CalculateFreeViewportOptions,
): FreeViewportWindow {
  const {
    windowHeight,
    headerHeight = DEFAULT_HEADER_HEIGHT,
    bottomNavHeight = DEFAULT_BOTTOM_NAV_HEIGHT,
    cardHeight = DEFAULT_CARD_HEIGHT,
    safetyMargin = DEFAULT_SAFETY_MARGIN,
    anchorPosition,
    isMobile,
  } = options;

  if (!isMobile) {
    const top = headerHeight + safetyMargin;
    const bottom = Math.max(top, windowHeight - safetyMargin);
    const height = Math.max(0, bottom - top);
    return {
      top,
      bottom,
      height,
      centerY: top + height / 2,
    };
  }

  let top: number;
  let bottom: number;

  if (anchorPosition === "top") {
    top = headerHeight + cardHeight + safetyMargin;
    bottom = windowHeight - bottomNavHeight - safetyMargin;
  } else {
    top = headerHeight + safetyMargin;
    bottom = windowHeight - cardHeight - bottomNavHeight - safetyMargin;
  }

  // Previne colapso em viewports extremamente reduzidas
  if (bottom < top) {
    bottom = top;
  }

  const height = Math.max(0, bottom - top);
  const centerY = top + height / 2;

  return {
    top,
    bottom,
    height,
    centerY,
  };
}

export interface CalculateDeadCenterScrollOptions {
  /** Valor atual de scrollTop do container de rolagem */
  containerScrollTop: number;
  /** Posição central vertical do elemento em coordenadas da viewport */
  elementCenterY: number;
  /** Posição central vertical da janela livre útil calculada */
  viewportFreeCenterY: number;
  /** Limite máximo de scrollTop permitido no container (scrollHeight - clientHeight) */
  maxScrollTop?: number;
}

/**
 * Calcula o valor ideal de scrollTop para centralizar o elemento no "Dead Center"
 * da janela visual desobstruída.
 *
 * Fórmula: targetScrollTop = containerScrollTop + (elementCenterY - viewportFreeCenterY)
 */
export function calculateDeadCenterScrollTop(
  options: CalculateDeadCenterScrollOptions,
): number {
  const {
    containerScrollTop,
    elementCenterY,
    viewportFreeCenterY,
    maxScrollTop,
  } = options;

  const targetScrollTop = containerScrollTop + (elementCenterY - viewportFreeCenterY);
  const clampedMin = Math.max(0, targetScrollTop);

  if (maxScrollTop !== undefined && maxScrollTop >= 0) {
    return Math.min(clampedMin, maxScrollTop);
  }

  return clampedMin;
}

export interface SpotlightGeometryOptions {
  /** Se o elemento deve receber recorte 100% circular (ex: Botão FAB) */
  isCircular?: boolean;
  /** Espaçamento interno ao redor do elemento em pixels (padrão: 10px) */
  padding?: number;
  /** Raio de borda personalizado (default 16px para retangular ou 9999 para circular) */
  customBorderRadius?: number;
  /** Largura máxima da viewport (window.innerWidth) */
  windowWidth?: number;
  /** Altura máxima da viewport (window.innerHeight) */
  windowHeight?: number;
}

export interface SpotlightGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  borderRadius: number;
}

/**
 * Calcula a geometria (x, y, width, height, borderRadius) do recorte do Spotlight.
 *
 * Para botões circulares (ex: FAB +), calcula um quadrado simétrico perfeitamente
 * centrado no centroide do elemento com borderRadius de 9999.
 */
export function calculateSpotlightGeometry(
  elementRect: { left: number; top: number; width: number; height: number },
  options: SpotlightGeometryOptions = {},
): SpotlightGeometry {
  const {
    isCircular = false,
    padding = 10,
    customBorderRadius,
    windowWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
    windowHeight = typeof window !== "undefined" ? window.innerHeight : 768,
  } = options;

  if (isCircular || customBorderRadius === 9999) {
    const rawMaxSide = Math.max(elementRect.width, elementRect.height);
    const size = rawMaxSide + padding * 2;
    const centerX = elementRect.left + elementRect.width / 2;
    const centerY = elementRect.top + elementRect.height / 2;

    return {
      x: centerX - size / 2,
      y: centerY - size / 2,
      width: size,
      height: size,
      borderRadius: 9999,
    };
  }

  const width = Math.min(windowWidth, elementRect.width + padding * 2);
  const height = Math.min(windowHeight, elementRect.height + padding * 2);
  const x = Math.max(0, elementRect.left - padding);
  const y = Math.max(0, elementRect.top - padding);
  const borderRadius = customBorderRadius ?? 16;

  return {
    x,
    y,
    width,
    height,
    borderRadius,
  };
}

/**
 * Verifica se um elemento cabe e está contido dentro da janela livre útil calculada.
 */
export function isElementInsideFreeViewport(
  elementRect: { top: number; bottom: number },
  freeWindow: FreeViewportWindow,
  safetyMargin = DEFAULT_SAFETY_MARGIN,
): boolean {
  return (
    elementRect.top >= freeWindow.top - safetyMargin &&
    elementRect.bottom <= freeWindow.bottom + safetyMargin
  );
}
