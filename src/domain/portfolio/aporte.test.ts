import { describe, expect, it } from "vitest";
import {
  simulateRebalanceAporte,
  simulateSmartAporte,
  type AporteAssetInput,
} from "./aporte";

const asset = (overrides: Partial<AporteAssetInput> & Pick<AporteAssetInput, "id" | "ticker">): AporteAssetInput => ({
  assetClass: null,
  currency: "BRL",
  currentValueBRL: 0,
  priceBRL: 0,
  targetPercentage: null,
  ...overrides,
});

describe("simulateSmartAporte — por meta de ativo (§3.11.3)", () => {
  it("aloca por gap financeiro desc e nunca excede o aporte informado", () => {
    const result = simulateSmartAporte({
      aporte: 10_000,
      assets: [
        asset({ id: "a", ticker: "A", currentValueBRL: 1000, priceBRL: 100, targetPercentage: 50 }),
        asset({ id: "b", ticker: "B", currentValueBRL: 4000, priceBRL: 200, targetPercentage: 40 }),
      ],
    });
    // Patrimônio alvo = 5000 + 10000 = 15000.
    // A: alvo 50% = 7500 → gap 6500; B: alvo 40% = 6000 → gap 2000.
    expect(result.routes).toHaveLength(2);
    const a = result.routes.find((r) => r.ticker === "A");
    const b = result.routes.find((r) => r.ticker === "B");
    expect(a).toMatchObject({ targetValueBRL: 7500, gapBRL: 6500, quantity: 65, allocatedBRL: 6500 });
    expect(b).toMatchObject({ targetValueBRL: 6000, gapBRL: 2000, quantity: 10, allocatedBRL: 2000 });
    expect(result.totalAllocated).toBe(8500);
    expect(result.leftover).toBe(1500); // sobra → caixa/reserva
    expect(result.totalAllocated).toBeLessThanOrEqual(result.aporte);
  });

  it("ativo sem meta não recebe aporte", () => {
    const result = simulateSmartAporte({
      aporte: 5000,
      assets: [
        asset({ id: "c", ticker: "C", currentValueBRL: 500, priceBRL: 50, targetPercentage: null }),
        asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 100, targetPercentage: 10 }),
      ],
    });
    expect(result.routes.map((r) => r.ticker)).toEqual(["A"]);
    expect(result.routes[0]?.allocatedBRL).toBe(500);
  });

  it("ativo acima da meta (gap ≤ 0) não recebe aporte", () => {
    const result = simulateSmartAporte({
      aporte: 3000,
      assets: [
        // Atual 9000 ≥ alvo (50% de 12000 = 6000) → sem gap.
        asset({ id: "a", ticker: "A", currentValueBRL: 9000, priceBRL: 100, targetPercentage: 50 }),
        asset({ id: "b", ticker: "B", currentValueBRL: 0, priceBRL: 50, targetPercentage: 20 }),
      ],
    });
    expect(result.routes.map((r) => r.ticker)).toEqual(["B"]);
  });

  it("sem preço disponível o ativo não é elegível (não comprável)", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 0, targetPercentage: 30 })],
    });
    expect(result.routes).toHaveLength(0);
    expect(result.leftover).toBe(1000);
  });

  it("quantidades inteiras: excedente por arredondamento volta à sobra", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 300, targetPercentage: 100 })],
    });
    // 1000 ÷ 300 → 3 cotas = 900; sobra 100.
    expect(result.routes[0]).toMatchObject({ quantity: 3, allocatedBRL: 900 });
    expect(result.leftover).toBe(100);
  });

  it("quando o gap é menor que o preço, nada é alocado (sem fração)", () => {
    const result = simulateSmartAporte({
      aporte: 5000,
      assets: [asset({ id: "a", ticker: "A", currentValueBRL: 4900, priceBRL: 250, targetPercentage: 100 })],
    });
    // Alvo = 9900; gap = 5000; 5000 ÷ 250 = 20 → aloca 5000.
    expect(result.routes[0]?.allocatedBRL).toBe(5000);
    expect(result.leftover).toBe(0);
  });

  it("aporte zero ou negativo → resultado vazio com sobra total", () => {
    for (const aporte of [0, -100]) {
      const result = simulateSmartAporte({
        aporte,
        assets: [asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 100, targetPercentage: 10 })],
      });
      expect(result.routes).toHaveLength(0);
      expect(result.totalAllocated).toBe(0);
      expect(result.leftover).toBe(0);
    }
  });

  it("prioriza a classe com maior déficit relativo (defasagem macro)", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [
        // Classe X: déficit relativo menor (alvo 226, atual 100 → 56%), gap absoluto maior (126).
        asset({ id: "x", ticker: "X1", assetClass: "X", currentValueBRL: 100, priceBRL: 10, targetPercentage: 20 }),
        // Classe Y: déficit relativo maior (alvo 113, atual 30 → 73%), gap absoluto menor (83).
        asset({ id: "y", ticker: "Y1", assetClass: "Y", currentValueBRL: 30, priceBRL: 10, targetPercentage: 10 }),
      ],
    });
    // Patrimônio alvo = 130 + 1000 = 1130. Y vem primeiro (73% > 56%) apesar do gap menor.
    expect(result.routes.map((r) => r.ticker)).toEqual(["Y1", "X1"]);
    expect(result.routes[0]).toMatchObject({ ticker: "Y1", quantity: 8, allocatedBRL: 80 });
    expect(result.routes[1]).toMatchObject({ ticker: "X1", quantity: 12, allocatedBRL: 120 });
  });
});

describe("simulateRebalanceAporte — por meta de classe (§3.11.3)", () => {
  it("distribui a meta da classe de forma equiponderada (1/N) estabilizando os ativos defasados", () => {
    const result = simulateRebalanceAporte({
      aporte: 6000,
      assets: [
        asset({ id: "a", ticker: "A", assetClass: "Ações", currentValueBRL: 1000, priceBRL: 100 }),
        asset({ id: "b", ticker: "B", assetClass: "Ações", currentValueBRL: 3000, priceBRL: 200 }),
      ],
      classTargets: [{ className: "Ações", targetPercentage: 60 }],
    });
    // Patrimônio alvo = 4000 + 6000 = 10000. Classe alvo 60% = 6000.
    // Equiponderado: cada ativo tem meta de 30% = 3000.
    // A: atual 1000, alvo 3000 → gap 2000 (20 cotas).
    // B: atual 3000, alvo 3000 → gap 0 (já estabilizado, não recebe aporte indevido).
    expect(result.mode).toBe("class");
    expect(result.routes.map((r) => r.ticker)).toEqual(["A"]);
    const a = result.routes.find((r) => r.ticker === "A");
    expect(a).toMatchObject({ targetValueBRL: 3000, quantity: 20, allocatedBRL: 2000 });
    expect(result.totalAllocated).toBe(2000);
    expect(result.leftover).toBe(4000);
  });

  it("classe sem meta não gera aporte; metas individuais são ignoradas", () => {
    const result = simulateRebalanceAporte({
      aporte: 2000,
      assets: [
        // Meta individual alta, mas a classe não tem meta → nada.
        asset({ id: "a", ticker: "A", assetClass: "Ações", currentValueBRL: 0, priceBRL: 100, targetPercentage: 80 }),
        asset({ id: "b", ticker: "B", assetClass: "RF", currentValueBRL: 0, priceBRL: 50 }),
      ],
      classTargets: [{ className: "RF", targetPercentage: 20 }],
    });
    expect(result.routes.map((r) => r.ticker)).toEqual(["B"]);
  });

  it("classe sem valor atual distribui em partes iguais (share = 1/n)", () => {
    const result = simulateRebalanceAporte({
      aporte: 1000,
      assets: [
        asset({ id: "a", ticker: "A", assetClass: "Cripto", currentValueBRL: 0, priceBRL: 10 }),
        asset({ id: "b", ticker: "B", assetClass: "Cripto", currentValueBRL: 0, priceBRL: 20 }),
      ],
      classTargets: [{ className: "Cripto", targetPercentage: 10 }],
    });
    // Patrimônio alvo = 1000. Classe alvo 10% = 100 → share 50% cada.
    expect(result.routes[0]).toMatchObject({ ticker: "A", targetValueBRL: 50 });
    expect(result.routes[1]).toMatchObject({ ticker: "B", targetValueBRL: 50 });
  });
});

describe("Hierarquia Classe -> Ativo e Recursos Avançados", () => {
  it("estabiliza a classe mais defasada antes de alocar na próxima classe", () => {
    const result = simulateSmartAporte({
      aporte: 2000,
      assets: [
        // Classe Ações: alvo 50% de 5000 = 2500; atual 500 → déficit 80% (gap 2000)
        asset({ id: "a1", ticker: "PETR4", assetClass: "Ações", currentValueBRL: 500, priceBRL: 50, targetPercentage: 50 }),
        // Classe FIIs: alvo 50% de 5000 = 2500; atual 2500 → déficit 0% (gap 0)
        asset({ id: "f1", ticker: "HGLG11", assetClass: "FIIs", currentValueBRL: 2500, priceBRL: 100, targetPercentage: 50 }),
      ],
    });
    // Todo o aporte de 2000 vai para Ações
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]).toMatchObject({ ticker: "PETR4", quantity: 40, allocatedBRL: 2000 });
    expect(result.totalAllocated).toBe(2000);
    expect(result.leftover).toBe(0);
  });

  it("suporta compras fracionárias para criptoativos com precisão decimal", () => {
    const result = simulateSmartAporte({
      aporte: 500,
      assets: [
        asset({
          id: "btc",
          ticker: "BTC",
          assetClass: "Cripto",
          currentValueBRL: 0,
          priceBRL: 300_000,
          targetPercentage: 10,
          isFractional: true,
        }),
      ],
    });
    // Patrimônio alvo = 500. Alvo BTC 10% = 50.
    // 50 / 300000 = 0.00016666 BTC
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.ticker).toBe("BTC");
    expect(result.routes[0]?.quantity).toBeCloseTo(0.00016666, 6);
    expect(result.routes[0]?.allocatedBRL).toBe(50);
  });

  it("reporta diagnóstico de ativos ignorados (sem preço, sem meta, acima da meta)", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [
        asset({ id: "1", ticker: "SEM_PRECO", assetClass: "Ações", currentValueBRL: 0, priceBRL: 0, targetPercentage: 10 }),
        asset({ id: "2", ticker: "SEM_META", assetClass: "Ações", currentValueBRL: 100, priceBRL: 50, targetPercentage: null }),
        asset({ id: "3", ticker: "ACIMA_META", assetClass: "Ações", currentValueBRL: 2000, priceBRL: 50, targetPercentage: 10 }),
      ],
    });
    expect(result.skippedAssets).toContainEqual(expect.objectContaining({ ticker: "SEM_PRECO", reason: "no_price" }));
    expect(result.skippedAssets).toContainEqual(expect.objectContaining({ ticker: "SEM_META", reason: "no_target" }));
    expect(result.skippedAssets).toContainEqual(expect.objectContaining({ ticker: "ACIMA_META", reason: "above_target" }));
  });
});
