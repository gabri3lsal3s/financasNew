import { describe, expect, it } from "vitest";
import { projectPatrimony } from "@/domain/portfolio";
import { buildFireChartGeometry, toSmoothPath } from "./fire-curve";

describe("domain/simulators/fire-curve", () => {
  it("gera path vazio para lista vazia e M único para 1 ponto", () => {
    expect(toSmoothPath([])).toBe("");
    expect(toSmoothPath([{ x: 10, y: 20 }])).toBe("M 10.0 20.0");
  });

  it("gera curvas Bézier cúbicas suaves para série de múltiplos pontos", () => {
    const path = toSmoothPath([
      { x: 0, y: 100 },
      { x: 50, y: 60 },
      { x: 100, y: 20 },
    ]);
    expect(path.startsWith("M 0.0 100.0 C ")).toBe(true);
    expect(path.endsWith("100.0 20.0")).toBe(true);
  });

  it("calcula geometria completa, cruzamento FIRE e linha comparativa sem aportes", () => {
    const projection = projectPatrimony({
      initialCents: 2_500_000,
      monthlyContributionCents: 300_000,
      annualRatePercent: 8,
      years: 25,
      monthlyLivingCostCents: 250_000,
    });
    const comparison = projectPatrimony({
      initialCents: 2_500_000,
      monthlyContributionCents: 0,
      annualRatePercent: 8,
      years: 25,
      monthlyLivingCostCents: 250_000,
    });

    const geometry = buildFireChartGeometry(projection, comparison);

    expect(geometry.linePoints).toHaveLength(26);
    expect(geometry.smoothCurvePath).toContain("C ");
    expect(geometry.comparisonPath).toContain("C ");
    expect(geometry.areaPath.endsWith("Z")).toBe(true);
    expect(geometry.fireCrossoverIndex).toBe(12);
    expect(geometry.fireCrossover?.year).toBe(12);
    expect(geometry.fireTargetY).not.toBeNull();
  });

  it("retorna fireCrossover nulo quando a meta não é alcançada no horizonte", () => {
    const projection = projectPatrimony({
      initialCents: 100_000,
      monthlyContributionCents: 0,
      annualRatePercent: 6,
      years: 5,
      monthlyLivingCostCents: 500_000,
    });

    const geometry = buildFireChartGeometry(projection, null);

    expect(geometry.fireCrossoverIndex).toBe(-1);
    expect(geometry.fireCrossover).toBeNull();
    expect(geometry.comparisonPath).toBe("");
  });
});
