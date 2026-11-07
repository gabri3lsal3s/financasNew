import { describe, expect, it } from "vitest";
import { calculateOtsuThreshold } from "./web-ocr";

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
