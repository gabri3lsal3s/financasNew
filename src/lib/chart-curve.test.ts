import { describe, expect, it } from "vitest";
import { toMonotoneCubicPath, toAreaPath } from "./chart-curve";

describe("chart-curve — Spline Cúbica Monótona (Fritsch-Carlson)", () => {
  it("retorna string vazia para lista de pontos vazia", () => {
    expect(toMonotoneCubicPath([])).toBe("");
    expect(toAreaPath([], "", 100)).toBe("");
  });

  it("retorna comando M para ponto único", () => {
    expect(toMonotoneCubicPath([{ x: 10, y: 20 }])).toBe("M 10.0 20.0");
  });

  it("retorna linha reta M ... L para dois pontos", () => {
    expect(toMonotoneCubicPath([{ x: 0, y: 10 }, { x: 50, y: 30 }])).toBe("M 0.0 10.0 L 50.0 30.0");
  });

  it("garante monotonicidade estrita e não ultrapassa baseline zero (sem overshoot)", () => {
    // Sequência com platô em 100, pico isolado em 20, e retorno ao platô em 100
    const points = [
      { x: 0, y: 100 },
      { x: 10, y: 100 },
      { x: 20, y: 100 },
      { x: 30, y: 20 }, // pico alto (Y menor = valor monetário maior)
      { x: 40, y: 100 },
      { x: 50, y: 100 },
    ];

    const path = toMonotoneCubicPath(points, 100);
    expect(path).toContain("C");

    // Extrai todas as coordenadas Y do path
    const numbers = path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 1; i < numbers.length; i += 2) {
      const y = numbers[i]!;
      // Nenhuma coordenada pode ser maior que 100 (afundar abaixo do chão)
      expect(y).toBeLessThanOrEqual(100.01);
      // Nenhuma coordenada pode ser menor que 20 (ultrapassar o topo do pico)
      expect(y).toBeGreaterThanOrEqual(19.99);
    }
  });

  it("gera área fechada ancorada na linha base", () => {
    const points = [
      { x: 0, y: 10 },
      { x: 100, y: 20 },
    ];
    const linePath = "M 0.0 10.0 L 100.0 20.0";
    const area = toAreaPath(points, linePath, 40);
    expect(area).toBe("M 0.0 10.0 L 100.0 20.0 L 100.0 40.0 L 0.0 40.0 Z");
  });
});
