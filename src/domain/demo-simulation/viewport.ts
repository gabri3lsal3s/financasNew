/**
 * viewport.ts — Motor Matemático de Viewport Útil e Geometria do Spotlight
 *
 * Provê funções puras para cálculo da zona livre desobstruída (Dead Center)
 * no mobile, prevenindo sobreposição por Header fixo, BottomNav ou Popover Card,
 * além da geometria de recortes circulares e retangulares do Spotlight.
 */

import type { TourStep } from "./types";

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

export const DEFAULT_SEARCH_TIMEOUT_MS = 2500;
export const DEFAULT_POLLING_INTERVAL_MS = 100;

export interface SkeletonSpotlightOptions {
  /** Largura da viewport (window.innerWidth) */
  windowWidth?: number;
  /** Altura da viewport (window.innerHeight) */
  windowHeight?: number;
  /** Se o viewport atual é mobile (< 768px) */
  isMobile: boolean;
  /** Altura do cabeçalho fixo superior em pixels (padrão: 64px) */
  headerHeight?: number;
  /** Altura da barra inferior em pixels (padrão: 72px) */
  bottomNavHeight?: number;
  /** Altura estimada do card popover em pixels (padrão: 180px) */
  cardHeight?: number;
  /** Posição em que o card popover está ancorado no mobile */
  anchorPosition?: "top" | "bottom";
  /** Largura personalizada do esqueleto (opcional) */
  skeletonWidth?: number;
  /** Altura personalizada do esqueleto (opcional) */
  skeletonHeight?: number;
}

/**
 * Calcula a geometria segura do esqueleto discreto de foco para elementos com montagem tardia.
 * Posiciona o recorte de loading no centroide da janela livre útil desobstruída.
 */
export function calculateSkeletonSpotlightGeometry(
  options: SkeletonSpotlightOptions,
): SpotlightGeometry {
  const {
    windowWidth = typeof window !== "undefined" ? window.innerWidth : 1024,
    windowHeight = typeof window !== "undefined" ? window.innerHeight : 768,
    isMobile,
    headerHeight = DEFAULT_HEADER_HEIGHT,
    bottomNavHeight = DEFAULT_BOTTOM_NAV_HEIGHT,
    cardHeight = DEFAULT_CARD_HEIGHT,
    anchorPosition = "bottom",
    skeletonWidth,
    skeletonHeight,
  } = options;

  const freeWindow = calculateFreeViewportWindow({
    windowHeight,
    headerHeight,
    bottomNavHeight,
    cardHeight,
    anchorPosition,
    isMobile,
  });

  const width =
    skeletonWidth ??
    (isMobile
      ? Math.min(340, Math.max(260, windowWidth - 32))
      : Math.min(480, Math.max(320, windowWidth - 80)));
  const height = skeletonHeight ?? (isMobile ? 96 : 120);
  const x = Math.round(Math.max(16, (windowWidth - width) / 2));
  const y = Math.round(
    Math.max(
      freeWindow.top + 8,
      Math.min(freeWindow.bottom - height - 8, freeWindow.centerY - height / 2),
    ),
  );

  return {
    x,
    y,
    width,
    height,
    borderRadius: 16,
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

/**
 * Determina se a largura da janela corresponde a um ambiente desktop (>= 768px).
 */
export function isDesktopViewport(windowWidth: number): boolean {
  return windowWidth >= MOBILE_BREAKPOINT;
}

/**
 * Resolve dinamicamente o seletor CSS do elemento alvo para o passo atual,
 * priorizando `targetSelectorDesktop` em telas desktop (>= 768px).
 */
export function resolveTourStepTargetSelector(
  step?: TourStep | null,
  isDesktop = false,
): string | undefined {
  if (!step) return undefined;
  if (isDesktop && step.targetSelectorDesktop) {
    return step.targetSelectorDesktop;
  }
  return step.targetSelector;
}

/**
 * Resolve dinamicamente o título a ser exibido no card popover,
 * priorizando `titleDesktop` em telas desktop (>= 768px).
 */
export function resolveTourStepTitle(
  step: TourStep,
  isDesktop = false,
): string {
  if (isDesktop && step.titleDesktop) {
    return step.titleDesktop;
  }
  return step.title;
}

/**
 * Resolve dinamicamente o conteúdo/descrição a ser exibido no card popover,
 * priorizando `contentDesktop` em telas desktop (>= 768px).
 */
export function resolveTourStepContent(
  step: TourStep,
  isDesktop = false,
): string {
  if (isDesktop && step.contentDesktop) {
    return step.contentDesktop;
  }
  return step.description;
}

export interface DesktopCardPositionOptions {
  /** Retângulo do elemento alvo (x, y, width, height) ou null se não houver alvo */
  rect: { x: number; y: number; width: number; height: number } | null;
  /** Altura medida do card popover */
  cardHeight: number;
  /** Largura da viewport (window.innerWidth) */
  windowWidth: number;
  /** Altura da viewport (window.innerHeight) */
  windowHeight: number;
  /** Largura da sidebar esquerda desktop em pixels (padrão: 0) */
  sidebarWidth?: number;
  /** Posicionamento vertical preferido ou calculado ("top" | "bottom") */
  placement?: "top" | "bottom";
  /** Largura máxima preferida do card em pixels (padrão: 420px) */
  preferredWidth?: number;
  /** Espaçamento entre o elemento e o card em pixels (padrão: 12px) */
  gap?: number;
  /** Margem mínima de segurança contra colisões em pixels (padrão: 16px) */
  safetyMargin?: number;
}

export interface DesktopCardPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calcula a posição e dimensões adaptativas do card popover em telas desktop (Fase 8 — Tarefa 8.10).
 *
 * Garante:
 * 1. Largura adaptativa: min(preferredWidth, windowWidth - safetyMargin * 2), com folga para 8 passos.
 * 2. Clamp horizontal estrito contra a sidebar esquerda (left >= sidebarWidth + safetyMargin).
 * 3. Clamp horizontal direito impedindo vazamento fora da viewport (left <= windowWidth - width - safetyMargin).
 * 4. Centralização perfeita no espaço útil quando rect é nulo.
 */
export function calculateDesktopCardPosition(
  options: DesktopCardPositionOptions,
): DesktopCardPosition {
  const {
    rect,
    cardHeight,
    windowWidth,
    windowHeight,
    sidebarWidth = 0,
    placement = "bottom",
    preferredWidth = 420,
    gap = 12,
    safetyMargin = 16,
  } = options;

  // Largura adaptativa: min(420px, windowWidth - 32px) com piso de 280px
  const width = Math.min(preferredWidth, Math.max(280, windowWidth - safetyMargin * 2));
  const minLeft = sidebarWidth + safetyMargin;
  const maxLeft = Math.max(minLeft, windowWidth - width - safetyMargin);

  if (!rect) {
    const availableWidth = Math.max(0, windowWidth - sidebarWidth);
    const centerLeft = Math.max(minLeft, Math.min(maxLeft, sidebarWidth + (availableWidth - width) / 2));
    const centerTop = Math.max(safetyMargin, (windowHeight - cardHeight) / 2);
    return {
      x: Math.round(centerLeft),
      y: Math.round(centerTop),
      width,
      height: cardHeight,
    };
  }

  const top =
    placement === "top"
      ? Math.max(safetyMargin, Math.min(windowHeight - cardHeight - safetyMargin, rect.y - cardHeight - gap))
      : Math.min(windowHeight - cardHeight - safetyMargin, Math.max(safetyMargin, rect.y + rect.height + gap));

  // Clamp horizontal estrito: respeita sidebar à esquerda (minLeft) e borda da tela à direita (maxLeft)
  const left = Math.max(minLeft, Math.min(rect.x, maxLeft));

  return {
    x: Math.round(left),
    y: Math.round(top),
    width,
    height: cardHeight,
  };
}

/**
 * Obtém a largura da Sidebar desktop (`aside.z-sidebar`) no DOM se visível (>= 1024px).
 */
export function getDesktopSidebarWidth(
  doc: Document | null = typeof document !== "undefined" ? document : null,
): number {
  if (!doc || typeof window === "undefined") {
    return 0;
  }
  // A sidebar desktop só está visível em telas >= 1024px (breakpoint lg)
  if (window.innerWidth < 1024) {
    return 0;
  }
  const sidebar = doc.querySelector("aside.z-sidebar, aside[class*='z-sidebar']");
  if (sidebar instanceof HTMLElement) {
    const rect = sidebar.getBoundingClientRect();
    if (rect.width > 0) return rect.width;
    if (sidebar.offsetWidth > 0) return sidebar.offsetWidth;
  }
  return 0;
}

