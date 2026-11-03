import { describe, expect, it } from "vitest";
import type { TourStep } from "./types";
import {
  DEFAULT_BOTTOM_NAV_HEIGHT,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_POLLING_INTERVAL_MS,
  DEFAULT_SAFETY_MARGIN,
  DEFAULT_SEARCH_TIMEOUT_MS,
  MOBILE_BREAKPOINT,
  calculateDeadCenterScrollTop,
  calculateDesktopCardPosition,
  calculateFreeViewportWindow,
  calculateSkeletonSpotlightGeometry,
  calculateSpotlightGeometry,
  getDesktopSidebarWidth,
  isDesktopViewport,
  isElementInsideFreeViewport,
  resolveTourStepContent,
  resolveTourStepTargetSelector,
  resolveTourStepTitle,
} from "./viewport";

describe("viewport domain math (Fase 8 — Tarefa 8.6)", () => {
  it("exporta constantes padronizadas do viewport", () => {
    expect(DEFAULT_HEADER_HEIGHT).toBe(64);
    expect(DEFAULT_BOTTOM_NAV_HEIGHT).toBe(72);
    expect(DEFAULT_CARD_HEIGHT).toBe(180);
    expect(DEFAULT_SAFETY_MARGIN).toBe(16);
    expect(DEFAULT_SEARCH_TIMEOUT_MS).toBe(2500);
    expect(DEFAULT_POLLING_INTERVAL_MS).toBe(100);
  });

  describe("calculateFreeViewportWindow", () => {
    it("calcula a janela livre útil quando o card ancora no TOPO no mobile", () => {
      const windowHeight = 800;
      const cardHeight = 180;

      const freeWindow = calculateFreeViewportWindow({
        windowHeight,
        cardHeight,
        anchorPosition: "top",
        isMobile: true,
      });

      // top = headerHeight (64) + cardHeight (180) + safetyMargin (16) = 260
      expect(freeWindow.top).toBe(64 + 180 + 16);
      expect(freeWindow.top).toBe(260);

      // bottom = windowHeight (800) - bottomNavHeight (72) - safetyMargin (16) = 712
      expect(freeWindow.bottom).toBe(800 - 72 - 16);
      expect(freeWindow.bottom).toBe(712);

      // height = 712 - 260 = 452
      expect(freeWindow.height).toBe(452);

      // centerY = 260 + 452 / 2 = 486
      expect(freeWindow.centerY).toBe(486);
    });

    it("calcula a janela livre útil quando o card ancora na BASE no mobile", () => {
      const windowHeight = 800;
      const cardHeight = 180;

      const freeWindow = calculateFreeViewportWindow({
        windowHeight,
        cardHeight,
        anchorPosition: "bottom",
        isMobile: true,
      });

      // top = headerHeight (64) + safetyMargin (16) = 80
      expect(freeWindow.top).toBe(64 + 16);
      expect(freeWindow.top).toBe(80);

      // bottom = windowHeight (800) - cardHeight (180) - bottomNavHeight (72) - safetyMargin (16) = 532
      expect(freeWindow.bottom).toBe(800 - 180 - 72 - 16);
      expect(freeWindow.bottom).toBe(532);

      // height = 532 - 80 = 452
      expect(freeWindow.height).toBe(452);

      // centerY = 80 + 452 / 2 = 306
      expect(freeWindow.centerY).toBe(306);
    });

    it("calcula a janela livre útil no desktop sem obstrução da BottomNav", () => {
      const windowHeight = 900;

      const freeWindow = calculateFreeViewportWindow({
        windowHeight,
        anchorPosition: "top",
        isMobile: false,
      });

      expect(freeWindow.top).toBe(DEFAULT_HEADER_HEIGHT + DEFAULT_SAFETY_MARGIN);
      expect(freeWindow.bottom).toBe(windowHeight - DEFAULT_SAFETY_MARGIN);
      expect(freeWindow.height).toBe(freeWindow.bottom - freeWindow.top);
      expect(freeWindow.centerY).toBe((freeWindow.top + freeWindow.bottom) / 2);
    });

    it("respeita parâmetros customizados de cabeçalho, bottom nav e margem de segurança", () => {
      const freeWindow = calculateFreeViewportWindow({
        windowHeight: 700,
        headerHeight: 56,
        bottomNavHeight: 64,
        cardHeight: 150,
        safetyMargin: 20,
        anchorPosition: "top",
        isMobile: true,
      });

      expect(freeWindow.top).toBe(56 + 150 + 20); // 226
      expect(freeWindow.bottom).toBe(700 - 64 - 20); // 616
      expect(freeWindow.height).toBe(390);
      expect(freeWindow.centerY).toBe(226 + 195); // 421
    });

    it("não colapsa para valores negativos em telas com altura muito reduzida", () => {
      const freeWindow = calculateFreeViewportWindow({
        windowHeight: 200,
        cardHeight: 180,
        anchorPosition: "top",
        isMobile: true,
      });

      expect(freeWindow.bottom).toBeGreaterThanOrEqual(freeWindow.top);
      expect(freeWindow.height).toBe(0);
      expect(freeWindow.centerY).toBe(freeWindow.top);
    });
  });

  describe("calculateDeadCenterScrollTop", () => {
    it("rola para baixo quando o elemento está posicionado abaixo do Dead Center", () => {
      const containerScrollTop = 100;
      const elementCenterY = 650;
      const viewportFreeCenterY = 486;

      const target = calculateDeadCenterScrollTop({
        containerScrollTop,
        elementCenterY,
        viewportFreeCenterY,
      });

      // 100 + (650 - 486) = 100 + 164 = 264
      expect(target).toBe(264);
    });

    it("rola para cima quando o elemento está posicionado acima do Dead Center", () => {
      const containerScrollTop = 300;
      const elementCenterY = 200;
      const viewportFreeCenterY = 486;

      const target = calculateDeadCenterScrollTop({
        containerScrollTop,
        elementCenterY,
        viewportFreeCenterY,
      });

      // 300 + (200 - 486) = 300 - 286 = 14
      expect(target).toBe(14);
    });

    it("faz clamp em 0 quando o targetScrollTop seria negativo", () => {
      const containerScrollTop = 50;
      const elementCenterY = 100;
      const viewportFreeCenterY = 486;

      const target = calculateDeadCenterScrollTop({
        containerScrollTop,
        elementCenterY,
        viewportFreeCenterY,
      });

      // 50 + (100 - 486) = -336 -> clamped em 0
      expect(target).toBe(0);
    });

    it("respeita maxScrollTop quando informado", () => {
      const containerScrollTop = 500;
      const elementCenterY = 900;
      const viewportFreeCenterY = 486;
      const maxScrollTop = 600;

      const target = calculateDeadCenterScrollTop({
        containerScrollTop,
        elementCenterY,
        viewportFreeCenterY,
        maxScrollTop,
      });

      // 500 + 414 = 914 -> clamped em 600
      expect(target).toBe(600);
    });
  });

  describe("calculateSpotlightGeometry", () => {
    it("calcula recorte retangular padrão para elementos comuns", () => {
      const elementRect = { left: 50, top: 120, width: 200, height: 80 };

      const geometry = calculateSpotlightGeometry(elementRect, {
        padding: 10,
        customBorderRadius: 16,
      });

      expect(geometry.x).toBe(40);
      expect(geometry.y).toBe(110);
      expect(geometry.width).toBe(220);
      expect(geometry.height).toBe(100);
      expect(geometry.borderRadius).toBe(16);
    });

    it("calcula recorte circular milimétrico (borderRadius 9999) para botões circulares", () => {
      // Botão FAB com dimensões 56x56 posicionado em left: 160, top: 730
      const elementRect = { left: 160, top: 730, width: 56, height: 56 };

      const geometry = calculateSpotlightGeometry(elementRect, {
        isCircular: true,
        padding: 10,
      });

      // Size = 56 + 20 = 76
      // CenterX = 160 + 28 = 188 -> x = 188 - 38 = 150
      // CenterY = 730 + 28 = 758 -> y = 758 - 38 = 720
      expect(geometry.width).toBe(76);
      expect(geometry.height).toBe(76);
      expect(geometry.x).toBe(150);
      expect(geometry.y).toBe(720);
      expect(geometry.borderRadius).toBe(9999);
    });

    it("centraliza perfeitamente mesmo com pequenas assimetrias de subpixel", () => {
      const elementRect = { left: 100, top: 200, width: 55, height: 57 };

      const geometry = calculateSpotlightGeometry(elementRect, {
        isCircular: true,
        padding: 8,
      });

      // maxSide = 57 -> size = 57 + 16 = 73
      expect(geometry.width).toBe(73);
      expect(geometry.height).toBe(73);
      expect(geometry.borderRadius).toBe(9999);

      // Centroid:
      // CenterX = 100 + 27.5 = 127.5 -> x = 127.5 - 36.5 = 91
      // CenterY = 200 + 28.5 = 228.5 -> y = 228.5 - 36.5 = 192
      expect(geometry.x).toBe(91);
      expect(geometry.y).toBe(192);
    });

    it("adota borderRadius 9999 se customBorderRadius for 9999", () => {
      const elementRect = { left: 160, top: 730, width: 56, height: 56 };

      const geometry = calculateSpotlightGeometry(elementRect, {
        customBorderRadius: 9999,
        padding: 10,
      });

      expect(geometry.borderRadius).toBe(9999);
      expect(geometry.width).toBe(76);
      expect(geometry.height).toBe(76);
    });
  });

  describe("isElementInsideFreeViewport", () => {
    it("retorna true quando o elemento está inteiramente dentro da zona útil livre", () => {
      const freeWindow = calculateFreeViewportWindow({
        windowHeight: 800,
        cardHeight: 180,
        anchorPosition: "top",
        isMobile: true,
      });

      // freeWindow: top 260, bottom 712
      const elementRect = { top: 300, bottom: 450 };

      expect(isElementInsideFreeViewport(elementRect, freeWindow)).toBe(true);
    });

    it("retorna false quando o elemento invade a zona da BottomNav", () => {
      const freeWindow = calculateFreeViewportWindow({
        windowHeight: 800,
        cardHeight: 180,
        anchorPosition: "top",
        isMobile: true,
      });

      // freeWindow: top 260, bottom 712. Elemento vai até 750 (invade a BottomNav em 728..800)
      const elementRect = { top: 600, bottom: 750 };

      expect(isElementInsideFreeViewport(elementRect, freeWindow)).toBe(false);
    });

    it("retorna false quando o elemento invade a zona do cabeçalho superior", () => {
      const freeWindow = calculateFreeViewportWindow({
        windowHeight: 800,
        cardHeight: 180,
        anchorPosition: "top",
        isMobile: true,
      });

      // freeWindow: top 260. Elemento em top 200 invade o card/header
      const elementRect = { top: 200, bottom: 300 };

      expect(isElementInsideFreeViewport(elementRect, freeWindow)).toBe(false);
    });
  });

  describe("Cálculo da Janela Livre Útil Mobile e Ausência de Sobreposição por BottomNav (Fase 8 — Tarefa 8.11)", () => {
    const mobileScreenHeights = [
      { device: "iPhone SE", height: 667 },
      { device: "Android Compacto", height: 720 },
      { device: "iPhone 13/14/15", height: 844 },
      { device: "Pixel 7 Pro", height: 915 },
    ];

    it.each(mobileScreenHeights)(
      "garante margem mínima de 16px acima da BottomNav em $device (altura: $height px)",
      ({ height }) => {
        const freeWindow = calculateFreeViewportWindow({
          windowHeight: height,
          cardHeight: 180,
          anchorPosition: "top",
          isMobile: true,
        });

        // Limite inferior nunca pode ultrapassar (height - bottomNavHeight - safetyMargin)
        const expectedMaxBottom = height - DEFAULT_BOTTOM_NAV_HEIGHT - DEFAULT_SAFETY_MARGIN;
        expect(freeWindow.bottom).toBe(expectedMaxBottom);

        // A distância entre o fim da janela útil e o chão da tela deve ser de pelo menos 88px (72px + 16px)
        const bottomNavClearance = height - freeWindow.bottom;
        expect(bottomNavClearance).toBeGreaterThanOrEqual(DEFAULT_BOTTOM_NAV_HEIGHT + DEFAULT_SAFETY_MARGIN);
      },
    );

    it("assegura que elemento inicialmente posicionado atrás da BottomNav é rolado com precisão para o Dead Center livre", () => {
      const windowHeight = 844;
      const cardHeight = 180;
      const elementHeight = 80;

      // Card ancorado no topo (pois o elemento está no fundo da tela)
      const freeWindow = calculateFreeViewportWindow({
        windowHeight,
        cardHeight,
        anchorPosition: "top",
        isMobile: true,
      });

      // freeWindow: top = 64 + 180 + 16 = 260, bottom = 844 - 72 - 16 = 756
      // centerY = 260 + (756 - 260) / 2 = 508
      expect(freeWindow.top).toBe(260);
      expect(freeWindow.bottom).toBe(756);
      expect(freeWindow.centerY).toBe(508);

      // Elemento em lista longa posicionado originalmente em y = 780 (dentro da BottomNav em 772..844)
      const initialElementTop = 780;
      const initialElementCenterY = initialElementTop + elementHeight / 2; // 820
      const currentScrollTop = 150;

      const targetScrollTop = calculateDeadCenterScrollTop({
        containerScrollTop: currentScrollTop,
        elementCenterY: initialElementCenterY,
        viewportFreeCenterY: freeWindow.centerY,
      });

      // targetScrollTop = 150 + (820 - 508) = 462
      expect(targetScrollTop).toBe(462);

      // Nova posição na viewport após a rolagem:
      const newElementCenterY = initialElementCenterY - (targetScrollTop - currentScrollTop);
      expect(newElementCenterY).toBe(freeWindow.centerY);

      const newElementTop = newElementCenterY - elementHeight / 2; // 508 - 40 = 468
      const newElementBottom = newElementCenterY + elementHeight / 2; // 508 + 40 = 548

      // Valida que o elemento está inteiramente contido na zona útil livre
      expect(isElementInsideFreeViewport({ top: newElementTop, bottom: newElementBottom }, freeWindow)).toBe(true);

      // Valida com folga estrita a ausência de colisão com a BottomNav
      const distanceToBottomNav = windowHeight - DEFAULT_BOTTOM_NAV_HEIGHT - newElementBottom;
      expect(distanceToBottomNav).toBeGreaterThanOrEqual(DEFAULT_SAFETY_MARGIN);
      expect(distanceToBottomNav).toBe(844 - 72 - 548); // 224px de folga segura
    });

    it("quando o card ancora na BASE, a zona útil livre fica entre o Header e o topo do Card Popover", () => {
      const windowHeight = 844;
      const cardHeight = 180;

      const freeWindow = calculateFreeViewportWindow({
        windowHeight,
        cardHeight,
        anchorPosition: "bottom",
        isMobile: true,
      });

      // top = 64 + 16 = 80
      // bottom = 844 - 180 - 72 - 16 = 576
      expect(freeWindow.top).toBe(80);
      expect(freeWindow.bottom).toBe(576);
      expect(freeWindow.height).toBe(496);
      expect(freeWindow.centerY).toBe(80 + 496 / 2); // 328

      // Elemento com altura de 120px centralizado em 328
      const elementRect = { top: 328 - 60, bottom: 328 + 60 }; // 268 a 388
      expect(isElementInsideFreeViewport(elementRect, freeWindow)).toBe(true);

      // Distância até o topo do card (que está em bottom = 576 + 16 = 592)
      expect(576 - elementRect.bottom).toBeGreaterThanOrEqual(0);
    });
  });

  describe("calculateSkeletonSpotlightGeometry (Fase 8 — Tarefa 8.7)", () => {
    it("calcula geometria do esqueleto no mobile quando card ancora no TOPO", () => {
      const geometry = calculateSkeletonSpotlightGeometry({
        windowWidth: 375,
        windowHeight: 800,
        cardHeight: 180,
        anchorPosition: "top",
        isMobile: true,
      });

      expect(geometry.borderRadius).toBe(16);
      expect(geometry.width).toBeGreaterThanOrEqual(260);
      expect(geometry.width).toBeLessThanOrEqual(343);
      expect(geometry.height).toBe(96);
      expect(geometry.x).toBeGreaterThanOrEqual(16);
      // Top da zona livre com card no topo é 260, bottom é 712
      expect(geometry.y).toBeGreaterThanOrEqual(268);
      expect(geometry.y + geometry.height).toBeLessThanOrEqual(712);
    });

    it("calcula geometria do esqueleto no mobile quando card ancora na BASE", () => {
      const geometry = calculateSkeletonSpotlightGeometry({
        windowWidth: 375,
        windowHeight: 800,
        cardHeight: 180,
        anchorPosition: "bottom",
        isMobile: true,
      });

      expect(geometry.borderRadius).toBe(16);
      expect(geometry.width).toBe(340);
      expect(geometry.height).toBe(96);
      expect(geometry.x).toBe(Math.round((375 - 340) / 2));
      // Top da zona livre com card na base é 80, bottom é 532, centerY é 306
      expect(geometry.y).toBe(306 - 96 / 2); // 258
      expect(geometry.y).toBeGreaterThanOrEqual(88);
      expect(geometry.y + geometry.height).toBeLessThanOrEqual(532);
    });

    it("calcula geometria do esqueleto no desktop com dimensões ampliadas", () => {
      const geometry = calculateSkeletonSpotlightGeometry({
        windowWidth: 1200,
        windowHeight: 800,
        isMobile: false,
      });

      expect(geometry.borderRadius).toBe(16);
      expect(geometry.width).toBe(480);
      expect(geometry.height).toBe(120);
      expect(geometry.x).toBe((1200 - 480) / 2);
      expect(geometry.y).toBeGreaterThan(64);
    });
  describe("Adaptação Responsiva Desktop vs Mobile (Fase 8 — Tarefa 8.8)", () => {
    const mockStep: TourStep = {
      id: "step-test",
      track: "finances",
      order: 1,
      title: "Título Mobile",
      titleDesktop: "Título Desktop (Ctrl+K)",
      description: "Descrição Mobile",
      contentDesktop: "Descrição Desktop com atalhos",
      targetRoute: "/",
      targetSelector: '[data-tour="bottom-nav-wizard"]',
      targetSelectorDesktop: '[data-tour="desktop-new-transaction"]',
    };

    const mockStepSemDesktop: TourStep = {
      id: "step-standard",
      track: "finances",
      order: 2,
      title: "Título Padrão",
      description: "Descrição Padrão",
      targetRoute: "/",
      targetSelector: '[data-tour="overview-kpis"]',
    };

    describe("isDesktopViewport", () => {
      it("retorna true para larguras maiores ou iguais ao MOBILE_BREAKPOINT (768px)", () => {
        expect(isDesktopViewport(MOBILE_BREAKPOINT)).toBe(true);
        expect(isDesktopViewport(768)).toBe(true);
        expect(isDesktopViewport(1024)).toBe(true);
        expect(isDesktopViewport(1440)).toBe(true);
      });

      it("retorna false para larguras estritamente menores que 768px", () => {
        expect(isDesktopViewport(767)).toBe(false);
        expect(isDesktopViewport(375)).toBe(false);
        expect(isDesktopViewport(414)).toBe(false);
      });
    });

    describe("resolveTourStepTargetSelector", () => {
      it("retorna undefined quando o passo for indefinido ou nulo", () => {
        expect(resolveTourStepTargetSelector(undefined, true)).toBeUndefined();
        expect(resolveTourStepTargetSelector(null, false)).toBeUndefined();
      });

      it("prioriza targetSelectorDesktop quando isDesktop for true e o seletor existir", () => {
        const selector = resolveTourStepTargetSelector(mockStep, true);
        expect(selector).toBe('[data-tour="desktop-new-transaction"]');
      });

      it("adota fallback para targetSelector quando isDesktop for true mas não houver seletor desktop", () => {
        const selector = resolveTourStepTargetSelector(mockStepSemDesktop, true);
        expect(selector).toBe('[data-tour="overview-kpis"]');
      });

      it("retorna targetSelector padrão quando isDesktop for false (mobile)", () => {
        const selector = resolveTourStepTargetSelector(mockStep, false);
        expect(selector).toBe('[data-tour="bottom-nav-wizard"]');
      });
    });

    describe("resolveTourStepTitle", () => {
      it("prioriza titleDesktop quando isDesktop for true e existir título desktop", () => {
        const title = resolveTourStepTitle(mockStep, true);
        expect(title).toBe("Título Desktop (Ctrl+K)");
      });

      it("adota fallback para title quando isDesktop for true mas não houver título desktop", () => {
        const title = resolveTourStepTitle(mockStepSemDesktop, true);
        expect(title).toBe("Título Padrão");
      });

      it("retorna title padrão quando isDesktop for false (mobile)", () => {
        const title = resolveTourStepTitle(mockStep, false);
        expect(title).toBe("Título Mobile");
      });
    });

    describe("resolveTourStepContent", () => {
      it("prioriza contentDesktop quando isDesktop for true e existir conteúdo desktop", () => {
        const content = resolveTourStepContent(mockStep, true);
        expect(content).toBe("Descrição Desktop com atalhos");
      });

      it("adota fallback para description quando isDesktop for true mas não houver conteúdo desktop", () => {
        const content = resolveTourStepContent(mockStepSemDesktop, true);
        expect(content).toBe("Descrição Padrão");
      });

      it("retorna description padrão quando isDesktop for false (mobile)", () => {
        const content = resolveTourStepContent(mockStep, false);
        expect(content).toBe("Descrição Mobile");
      });
    });
  });

  describe("calculateDesktopCardPosition (Fase 8 — Tarefa 8.10)", () => {
    it("adota largura preferida de 420px em telas amplas e posiciona abaixo do alvo", () => {
      const position = calculateDesktopCardPosition({
        rect: { x: 300, y: 100, width: 200, height: 50 },
        cardHeight: 200,
        windowWidth: 1280,
        windowHeight: 800,
        placement: "bottom",
      });

      expect(position.width).toBe(420);
      expect(position.height).toBe(200);
      expect(position.x).toBe(300);
      // y = rect.y + rect.height + gap = 100 + 50 + 12 = 162
      expect(position.y).toBe(162);
    });

    it("posiciona acima do alvo quando placement for 'top'", () => {
      const position = calculateDesktopCardPosition({
        rect: { x: 300, y: 400, width: 200, height: 50 },
        cardHeight: 180,
        windowWidth: 1280,
        windowHeight: 800,
        placement: "top",
      });

      expect(position.width).toBe(420);
      // y = rect.y - cardHeight - gap = 400 - 180 - 12 = 208
      expect(position.y).toBe(208);
    });

    it("aplica clamp horizontal estrito contra a margem direita da viewport", () => {
      const position = calculateDesktopCardPosition({
        rect: { x: 1100, y: 100, width: 100, height: 40 },
        cardHeight: 180,
        windowWidth: 1280,
        windowHeight: 800,
      });

      // maxLeft = windowWidth - width - safetyMargin = 1280 - 420 - 16 = 844
      expect(position.x).toBe(844);
    });

    it("aplica clamp horizontal estrito contra a margem esquerda quando não há sidebar", () => {
      const position = calculateDesktopCardPosition({
        rect: { x: -20, y: 100, width: 100, height: 40 },
        cardHeight: 180,
        windowWidth: 1280,
        windowHeight: 800,
        sidebarWidth: 0,
      });

      // minLeft = sidebarWidth + safetyMargin = 0 + 16 = 16
      expect(position.x).toBe(16);
    });

    it("respeita a Sidebar desktop expandida impedindo sobreposição (left >= sidebarWidth + 16px)", () => {
      const sidebarWidth = 256;
      const position = calculateDesktopCardPosition({
        rect: { x: 100, y: 100, width: 80, height: 40 },
        cardHeight: 180,
        windowWidth: 1280,
        windowHeight: 800,
        sidebarWidth,
      });

      // minLeft = sidebarWidth + 16 = 256 + 16 = 272
      expect(position.x).toBe(272);
    });

    it("respeita a Sidebar desktop compacta (80px)", () => {
      const sidebarWidth = 80;
      const position = calculateDesktopCardPosition({
        rect: { x: 50, y: 100, width: 80, height: 40 },
        cardHeight: 180,
        windowWidth: 1280,
        windowHeight: 800,
        sidebarWidth,
      });

      // minLeft = 80 + 16 = 96
      expect(position.x).toBe(96);
    });

    it("ajusta a largura adaptativamente para janelas estreitas (< 452px)", () => {
      const position = calculateDesktopCardPosition({
        rect: { x: 20, y: 50, width: 100, height: 30 },
        cardHeight: 160,
        windowWidth: 380,
        windowHeight: 700,
      });

      // width = min(420, max(280, 380 - 32)) = 348
      expect(position.width).toBe(348);
      // maxLeft = 380 - 348 - 16 = 16
      expect(position.x).toBe(16);
    });

    it("centraliza perfeitamente no espaço útil quando rect for nulo", () => {
      const positionSemSidebar = calculateDesktopCardPosition({
        rect: null,
        cardHeight: 180,
        windowWidth: 1024,
        windowHeight: 768,
      });

      // width = 420; centerLeft = (1024 - 420) / 2 = 302; centerTop = (768 - 180) / 2 = 294
      expect(positionSemSidebar.width).toBe(420);
      expect(positionSemSidebar.x).toBe(302);
      expect(positionSemSidebar.y).toBe(294);

      const positionComSidebar = calculateDesktopCardPosition({
        rect: null,
        cardHeight: 180,
        windowWidth: 1280,
        windowHeight: 800,
        sidebarWidth: 256,
      });

      // availableWidth = 1280 - 256 = 1024; centerLeft = 256 + (1024 - 420) / 2 = 256 + 302 = 558
      expect(positionComSidebar.width).toBe(420);
      expect(positionComSidebar.x).toBe(558);
      expect(positionComSidebar.y).toBe(310);
    });
  });

  describe("getDesktopSidebarWidth (Fase 8 — Tarefa 8.10)", () => {
    it("retorna 0 quando innerWidth for menor que 1024 (sidebar oculta)", () => {
      const doc = document.implementation.createHTMLDocument();
      const sidebar = doc.createElement("aside");
      sidebar.className = "z-sidebar";
      doc.body.appendChild(sidebar);

      const originalInnerWidth = window.innerWidth;
      try {
        window.innerWidth = 768;
        expect(getDesktopSidebarWidth(doc)).toBe(0);
      } finally {
        window.innerWidth = originalInnerWidth;
      }
    });

    it("retorna a largura da sidebar quando innerWidth for >= 1024", () => {
      const doc = document.implementation.createHTMLDocument();
      const sidebar = doc.createElement("aside");
      sidebar.className = "fixed inset-y-0 left-0 z-sidebar lg:flex";
      sidebar.getBoundingClientRect = () => ({
        x: 0,
        y: 0,
        left: 0,
        top: 0,
        right: 256,
        bottom: 800,
        width: 256,
        height: 800,
        toJSON: () => ({}),
      });
      doc.body.appendChild(sidebar);

      const originalInnerWidth = window.innerWidth;
      try {
        window.innerWidth = 1280;
        expect(getDesktopSidebarWidth(doc)).toBe(256);
      } finally {
        window.innerWidth = originalInnerWidth;
      }
    });

    it("retorna 0 quando não houver aside.z-sidebar no documento", () => {
      const doc = document.implementation.createHTMLDocument();
      const originalInnerWidth = window.innerWidth;
      try {
        window.innerWidth = 1280;
        expect(getDesktopSidebarWidth(doc)).toBe(0);
      } finally {
        window.innerWidth = originalInnerWidth;
      }
    });
  });
});
});
