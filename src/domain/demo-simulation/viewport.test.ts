import { describe, expect, it } from "vitest";
import {
  DEFAULT_BOTTOM_NAV_HEIGHT,
  DEFAULT_CARD_HEIGHT,
  DEFAULT_HEADER_HEIGHT,
  DEFAULT_SAFETY_MARGIN,
  calculateDeadCenterScrollTop,
  calculateFreeViewportWindow,
  calculateSpotlightGeometry,
  isElementInsideFreeViewport,
} from "./viewport";

describe("viewport domain math (Fase 8 — Tarefa 8.6)", () => {
  it("exporta constantes padronizadas do viewport", () => {
    expect(DEFAULT_HEADER_HEIGHT).toBe(64);
    expect(DEFAULT_BOTTOM_NAV_HEIGHT).toBe(72);
    expect(DEFAULT_CARD_HEIGHT).toBe(180);
    expect(DEFAULT_SAFETY_MARGIN).toBe(16);
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
  });
});
