import { describe, expect, it } from "vitest";
import {
  applyOcrPixelPreprocess,
  calculateOtsuThreshold,
  classifyOcrImageProfile,
} from "./web-ocr";

describe("calculateOtsuThreshold", () => {
  it("retorna fallback 128 para entradas invalidas ou vazias", () => {
    expect(calculateOtsuThreshold([], 0)).toBe(128);
    expect(calculateOtsuThreshold(new Array(100).fill(0), 100)).toBe(128);
  });

  it("calcula o limiar otimo para distribuicao bimodal equilibrada", () => {
    const histogram = new Array<number>(256).fill(0);
    // 500 pixels escuros em torno de 40 (texto impresso)
    for (let i = 35; i <= 45; i++) {
      histogram[i] = 50;
    }
    // 500 pixels claros em torno de 220 (papel termico)
    for (let i = 215; i <= 225; i++) {
      histogram[i] = 50;
    }

    const totalPixels = 550 + 550;
    const threshold = calculateOtsuThreshold(histogram, totalPixels);

    // O limiar otimo deve separar os dois picos (entre 45 e 215)
    expect(threshold).toBeGreaterThanOrEqual(45);
    expect(threshold).toBeLessThanOrEqual(215);
  });

  it("calcula limiar para comprovante real com predominancia de papel branco", () => {
    const histogram = new Array<number>(256).fill(0);
    // 10% de texto escuro (intensidade 20 a 50)
    for (let i = 20; i <= 50; i++) {
      histogram[i] = 10;
    }
    // 90% de papel claro (intensidade 200 a 250)
    for (let i = 200; i <= 250; i++) {
      histogram[i] = 100;
    }

    const totalPixels = 310 + 5100;
    const threshold = calculateOtsuThreshold(histogram, totalPixels);

    expect(threshold).toBeGreaterThanOrEqual(50);
    expect(threshold).toBeLessThanOrEqual(200);
  });
});

describe("applyOcrPixelPreprocess & classifyOcrImageProfile (Dark Mode / Prints / Térmico)", () => {
  function makeRgbaBuffer(grayValues: number[]): Uint8ClampedArray {
    const buf = new Uint8ClampedArray(grayValues.length * 4);
    for (let i = 0; i < grayValues.length; i++) {
      const g = grayValues[i]!;
      buf[i * 4] = g;
      buf[i * 4 + 1] = g;
      buf[i * 4 + 2] = g;
      buf[i * 4 + 3] = 255;
    }
    return buf;
  }

  it("detecta print em Dark Mode (meanGray < 110), inverte suavemente e preserva anti-aliasing sem Otsu duro", () => {
    // 80 pixels de fundo escuro (gray=18), 10 pixels de texto branco (gray=240), 10 pixels de borda anti-aliased (gray=120)
    const grays = [
      ...new Array<number>(80).fill(18),
      ...new Array<number>(10).fill(120),
      ...new Array<number>(10).fill(240),
    ];
    const data = makeRgbaBuffer(grays);

    const profile = applyOcrPixelPreprocess(data, 10, 10);

    expect(profile.isDarkMode).toBe(true);
    expect(profile.meanGray).toBeLessThan(110);
    expect(profile.strategy).toBe("dark_mode_invert_grayscale");

    // Fundo escuro (idx 0) foi invertido para fundo claro (> 220)
    expect(data[0]).toBeGreaterThan(220);
    // Texto claro original (idx 95) virou escuro (< 30)
    expect(data[95 * 4]).toBeLessThan(30);
    // Borda anti-aliased (idx 85) permaneceu em cinza intermediário (não colapsada para 0/255 por Otsu)
    const aaPixel = data[85 * 4]!;
    expect(aaPixel).toBeGreaterThan(20);
    expect(aaPixel).toBeLessThan(235);
  });

  it("detecta print digital claro e preserva escala de cinza suave sem binarização binária", () => {
    // 75 pixels de fundo branco uniforme (252), 15 pixels de texto (25), 10 pixels anti-aliased (140)
    const grays = [
      ...new Array<number>(75).fill(252),
      ...new Array<number>(10).fill(140),
      ...new Array<number>(15).fill(25),
    ];
    const data = makeRgbaBuffer(grays);

    const profile = applyOcrPixelPreprocess(data, 10, 10);

    expect(profile.isDarkMode).toBe(false);
    expect(profile.isDigitalScreenshot).toBe(true);
    expect(profile.strategy).toBe("digital_screenshot_grayscale");

    // Borda anti-aliased permanece suave entre 50 e 210
    const aaPixel = data[78 * 4]!;
    expect(aaPixel).toBeGreaterThan(50);
    expect(aaPixel).toBeLessThan(210);
  });

  it("aplica Otsu clássico exclusivamente para fotos físicas / cupons térmicos com iluminação variada", () => {
    // Distribuição espalhada sem pico estreito de print digital (simula iluminação irregular de câmera)
    const grays: number[] = [];
    for (let i = 0; i < 60; i++) grays.push(180 + (i % 50)); // papel térmico variando 180..229
    for (let i = 0; i < 40; i++) grays.push(70 + (i % 45)); // tinta e sombra 70..114
    const data = makeRgbaBuffer(grays);

    const profile = applyOcrPixelPreprocess(data, 10, 10);

    expect(profile.isDarkMode).toBe(false);
    expect(profile.isDigitalScreenshot).toBe(false);
    expect(profile.strategy).toBe("thermal_otsu_binarize");

    for (let p = 0; p < 100; p++) {
      expect([0, 255]).toContain(data[p * 4]);
    }
  });

  it("classifyOcrImageProfile trata entrada vazia sem dividir por zero", () => {
    const empty = classifyOcrImageProfile([], 0);
    expect(empty.strategy).toBe("thermal_otsu_binarize");
  });
});
