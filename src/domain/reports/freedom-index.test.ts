import { describe, expect, it } from "vitest";
import { calculateFreedomIndex, getFreedomStage } from "./freedom-index";

describe("calculateFreedomIndex", () => {
  it("deve lidar com despesas zeradas sem lançar exceção", () => {
    const result = calculateFreedomIndex(500, 0, 1000);
    expect(result.freedomPct).toBe(0);
    expect(result.runwayMonths).toBe(0);
    expect(result.freedomStage).toBe("initial");
  });

  it("deve calcular percentual de liberdade financeira e runway com exatidão", () => {
    // Proventos mensais = R$ 2.500
    // Despesas mensais = R$ 5.000 (50% de cobertura)
    // Reserva de liquidez = R$ 30.000 (6 meses de runway)
    const result = calculateFreedomIndex(2500, 5000, 30000);

    expect(result.freedomPct).toBe(50);
    expect(result.freedomStage).toBe("half");
    expect(result.runwayMonths).toBe(6);
  });

  it("deve detectar ativos que atingiram o efeito bola de neve", () => {
    const assets = [
      // MXRF11: Preço 10,00, Dividendo 0,10, Qtd 100 -> Renda = R$ 10,00 -> compra 1 cota/mês (Bola de Neve!)
      { ticker: "MXRF11", currentPriceBRL: 10, monthlyDividendPerShareBRL: 0.1, quantity: 100 },
      // HGLG11: Preço 160,00, Dividendo 1,10, Qtd 50 -> Renda = R$ 55,00 -> 0.34 cotas/mês
      { ticker: "HGLG11", currentPriceBRL: 160, monthlyDividendPerShareBRL: 1.1, quantity: 50 },
    ];

    const result = calculateFreedomIndex(65, 3000, 5000, assets);

    expect(result.snowballAssets).toHaveLength(2);
    expect(result.snowballAssets[0]?.ticker).toBe("MXRF11");
    expect(result.snowballAssets[0]?.isSnowballReached).toBe(true);
    expect(result.snowballAssets[0]?.newSharesPerMonth).toBe(1.0);

    expect(result.snowballAssets[1]?.ticker).toBe("HGLG11");
    expect(result.snowballAssets[1]?.isSnowballReached).toBe(false);
    expect(result.totalSnowballAssetsCount).toBe(1);

  });

  it("deve mapear todos os estágios de liberdade financeira corretamente", () => {
    expect(getFreedomStage(5).stage).toBe("initial");
    expect(getFreedomStage(15).stage).toBe("building");
    expect(getFreedomStage(30).stage).toBe("quarter");
    expect(getFreedomStage(60).stage).toBe("half");
    expect(getFreedomStage(85).stage).toBe("security");
    expect(getFreedomStage(120).stage).toBe("freedom");
  });
});
