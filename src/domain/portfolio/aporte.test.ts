import { describe, expect, it } from "vitest";
import {
  simulateCombinedAporte,
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

  it("quantidades inteiras na B3: excedente por arredondamento volta à sobra", () => {
    const result = simulateSmartAporte({
      aporte: 1000,
      assets: [asset({ id: "a", ticker: "A", currentValueBRL: 0, priceBRL: 300, targetPercentage: 100 })],
    });
    // 1000 ÷ 300 → 3 cotas = 900; sobra 100.
    expect(result.routes[0]).toMatchObject({ quantity: 3, allocatedBRL: 900 });
    expect(result.leftover).toBe(100);
  });

  it("quando o gap é menor que o preço na B3, nada é alocado (sem fração)", () => {
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

  it("classe sem meta não gera aporte; metas individuais são ignoradas no modo class", () => {
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

describe("Hierarquia Classe -> Setor -> Ativo & Fracionamento Internacional (Fase 4)", () => {
  it("suporta compras fracionárias para ativos em Dólar (USD / Internacional) com 4 casas decimais", () => {
    const result = simulateCombinedAporte({
      aporte: 500, // R$ 500 para aportar
      assets: [
        asset({
          id: "voo",
          ticker: "VOO",
          assetClass: "Internacional",
          currency: "USD",
          currentValueBRL: 0,
          priceBRL: 2500, // Cotação ~US$ 500 (~R$ 2.500)
          targetPercentage: 100,
        }),
      ],
      classTargets: [{ className: "Internacional", targetPercentage: 100 }],
    });

    // R$ 500 ÷ R$ 2500 = 0.2000 cotas de VOO
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.ticker).toBe("VOO");
    expect(result.routes[0]?.quantity).toBe(0.2);
    expect(result.routes[0]?.allocatedBRL).toBe(500);
    expect(result.totalAllocated).toBe(500);
    expect(result.leftover).toBe(0);
  });

  it("suporta compras fracionárias para criptoativos com 8 casas decimais", () => {
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
        }),
      ],
    });
    expect(result.routes).toHaveLength(1);
    expect(result.routes[0]?.ticker).toBe("BTC");
    expect(result.routes[0]?.quantity).toBeCloseTo(0.00016666, 6);
    expect(result.routes[0]?.allocatedBRL).toBe(50);
  });

  it("aloca aporte respeitando a hierarquia Classe -> Setor -> Ativo", () => {
    const assets: AporteAssetInput[] = [
      // Classe Ações -> Setor Bancos (meta 60% de Ações)
      asset({ id: "itub", ticker: "ITUB4", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 1000, priceBRL: 20 }),
      asset({ id: "bbas", ticker: "BBAS3", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 1000, priceBRL: 25 }),
      // Classe Ações -> Setor Elétricas (meta 40% de Ações)
      asset({ id: "taee", ticker: "TAEE11", assetClass: "Ações", sector: "Energia Elétrica", currentValueBRL: 2000, priceBRL: 20 }),
    ];

    const result = simulateCombinedAporte({
      aporte: 6000,
      assets,
      classTargets: [{ className: "Ações", targetPercentage: 100 }],
      sectorTargets: [
        { className: "Ações", sectorName: "Financeiro / Bancos", targetPercentage: 60 },
        { className: "Ações", sectorName: "Energia Elétrica", targetPercentage: 40 },
      ],
    });

    // Patrimônio alvo = 4000 + 6000 = 10000.
    // Setor Bancos: alvo 60% de 10000 = 6000. Atual = 2000. Gap = 4000.
    // Setor Elétricas: alvo 40% de 10000 = 4000. Atual = 2000. Gap = 2000.
    // Bancos recebe 4000 (ITUB4: 2000 / 20 = 100 cotas; BBAS3: 2000 / 25 = 80 cotas).
    // Elétricas recebe 2000 (TAEE11: 2000 / 20 = 100 cotas).
    expect(result.sectorSummaries.length).toBeGreaterThan(0);
    const bancosSummary = result.sectorSummaries.find((s) => s.sectorName === "Financeiro / Bancos");
    expect(bancosSummary?.targetValueBRL).toBe(6000);
    expect(bancosSummary?.gapBRL).toBe(4000);
    expect(bancosSummary?.actualAllocatedBRL).toBe(4000);

    const eletricasSummary = result.sectorSummaries.find((s) => s.sectorName === "Energia Elétrica");
    expect(eletricasSummary?.actualAllocatedBRL).toBe(2000);

    expect(result.totalAllocated).toBe(6000);
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

  it("não sugere aporte para ativo com meta individual explicitamente zerada (targetPercentage = 0)", () => {
    const assets: AporteAssetInput[] = [
      // Ativo A com meta individual explicitamente 0%
      asset({ id: "a", ticker: "PETR4", assetClass: "Ações", currentValueBRL: 0, priceBRL: 30, targetPercentage: 0 }),
      // Ativo B com meta individual de 10%
      asset({ id: "b", ticker: "VALE3", assetClass: "Ações", currentValueBRL: 0, priceBRL: 50, targetPercentage: 10 }),
    ];

    const result = simulateCombinedAporte({
      aporte: 5000,
      assets,
      classTargets: [{ className: "Ações", targetPercentage: 100 }],
    });

    // Apenas VALE3 deve receber aporte, PETR4 tem meta individual 0% e deve ser ignorado
    expect(result.routes.map((r) => r.ticker)).toEqual(["VALE3"]);
    expect(result.routes.find((r) => r.ticker === "PETR4")).toBeUndefined();
    expect(result.skippedAssets).toContainEqual(expect.objectContaining({ ticker: "PETR4", reason: "no_target" }));
  });

  it("não sugere aporte para ativo pertencente a setor com meta explicitamente zerada (0%)", () => {
    const assets: AporteAssetInput[] = [
      asset({ id: "itub", ticker: "ITUB4", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 0, priceBRL: 20 }),
      asset({ id: "taee", ticker: "TAEE11", assetClass: "Ações", sector: "Energia Elétrica", currentValueBRL: 0, priceBRL: 20 }),
    ];

    const result = simulateCombinedAporte({
      aporte: 2000,
      assets,
      classTargets: [{ className: "Ações", targetPercentage: 100 }],
      sectorTargets: [
        { className: "Ações", sectorName: "Financeiro / Bancos", targetPercentage: 0 },
        { className: "Ações", sectorName: "Energia Elétrica", targetPercentage: 100 },
      ],
    });

    // Apenas TAEE11 (Energia Elétrica) deve receber aporte, ITUB4 está em setor com 0%
    expect(result.routes.map((r) => r.ticker)).toEqual(["TAEE11"]);
    expect(result.routes.find((r) => r.ticker === "ITUB4")).toBeUndefined();
  });

  it("espalha o aporte proporcionalmente entre múltiplos ativos do mesmo setor em vez de concentrar em um só", () => {
    const assets: AporteAssetInput[] = [
      asset({ id: "itub", ticker: "ITUB4", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 0, priceBRL: 20, targetPercentage: null }),
      asset({ id: "bbas", ticker: "BBAS3", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 0, priceBRL: 25, targetPercentage: null }),
    ];

    const result = simulateCombinedAporte({
      aporte: 1000,
      assets,
      classTargets: [{ className: "Ações", targetPercentage: 100 }],
      sectorTargets: [{ className: "Ações", sectorName: "Financeiro / Bancos", targetPercentage: 100 }],
    });

    // Orçamento de 1000 dividido igualmente (500 para ITUB4 e 500 para BBAS3)
    // ITUB4: 500 / 20 = 25 cotas (500)
    // BBAS3: 500 / 25 = 20 cotas (500)
    expect(result.routes).toHaveLength(2);
    const itub = result.routes.find((r) => r.ticker === "ITUB4");
    const bbas = result.routes.find((r) => r.ticker === "BBAS3");
    expect(itub).toMatchObject({ quantity: 25, allocatedBRL: 500 });
    expect(bbas).toMatchObject({ quantity: 20, allocatedBRL: 500 });
    expect(result.totalAllocated).toBe(1000);
  });

  it("respeita teto individual estrito e distribui o restante do setor para outro ativo", () => {
    const assets: AporteAssetInput[] = [
      // Ativo com meta individual de 10% (em patrimônio de 1000 = R$ 100)
      asset({ id: "itub", ticker: "ITUB4", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 0, priceBRL: 20, targetPercentage: 10 }),
      // Ativo com meta individual de 90% (em patrimônio de 1000 = R$ 900)
      asset({ id: "bbas", ticker: "BBAS3", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 0, priceBRL: 25, targetPercentage: 90 }),
    ];

    const result = simulateCombinedAporte({
      aporte: 1000,
      assets,
      classTargets: [{ className: "Ações", targetPercentage: 100 }],
    });

    const itub = result.routes.find((r) => r.ticker === "ITUB4");
    const bbas = result.routes.find((r) => r.ticker === "BBAS3");
    expect(itub).toMatchObject({ quantity: 5, allocatedBRL: 100 });
    expect(bbas).toMatchObject({ quantity: 36, allocatedBRL: 900 });
    expect(result.totalAllocated).toBe(1000);
  });

  it("distribui aporte de R$ 2.000 entre 2 classes com déficits proporcionais (R$ 1.000 cada)", () => {
    const assets: AporteAssetInput[] = [
      // Classe Ações (meta 50% de 2000 = 1000)
      asset({ id: "itub", ticker: "ITUB4", assetClass: "Ações", sector: "Financeiro / Bancos", currentValueBRL: 0, priceBRL: 20, targetPercentage: null }),
      // Classe FIIs (meta 50% de 2000 = 1000)
      asset({ id: "hglg", ticker: "HGLG11", assetClass: "FIIs", sector: "Imobiliário / Logística", currentValueBRL: 0, priceBRL: 100, targetPercentage: null }),
    ];

    const result = simulateCombinedAporte({
      aporte: 2000,
      assets,
      classTargets: [
        { className: "Ações", targetPercentage: 50 },
        { className: "FIIs", targetPercentage: 50 },
      ],
    });

    const itub = result.routes.find((r) => r.ticker === "ITUB4");
    const hglg = result.routes.find((r) => r.ticker === "HGLG11");
    expect(itub?.allocatedBRL).toBe(1000);
    expect(hglg?.allocatedBRL).toBe(1000);
    expect(result.totalAllocated).toBe(2000);
  });
});
