import { describe, expect, it } from "vitest";
import {
  isFractionalAsset,
  resolveAssetPrecision,
  simulateCombinedAporte,
  simulateRebalanceAporte,
  simulateSmartAporte,
  type AporteAssetInput,
  type ClassTargetInput,
  type SectorTargetInput,
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

  it("não sugere aporte para classe sobre-alocada (ex: Mercado Internacional a 40% de exposição com meta de 25%)", () => {
    const assets: AporteAssetInput[] = [
      // Mercado Internacional: Atual = R$ 400 (40% de 1000), Meta = 25% (R$ 375 de 1500) -> Excesso de R$ 25!
      asset({
        id: "aapl",
        ticker: "AAPL",
        assetClass: "Internacional",
        currency: "USD",
        currentValueBRL: 400,
        priceBRL: 100,
        targetPercentage: null,
      }),
      // Ações Brasil: Atual = R$ 600 (60% de 1000), Meta = 75% (R$ 1125 de 1500) -> Déficit de R$ 525!
      asset({
        id: "petr",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        currentValueBRL: 600,
        priceBRL: 25,
        targetPercentage: null,
      }),
    ];

    const result = simulateCombinedAporte({
      aporte: 500,
      assets,
      classTargets: [
        { className: "Internacional", targetPercentage: 25 },
        { className: "Ações", targetPercentage: 75 },
      ],
    });

    // Nenhum centavo deve ir para AAPL / Internacional
    expect(result.routes.map((r) => r.ticker)).toEqual(["PETR4"]);
    expect(result.routes.find((r) => r.ticker === "AAPL")).toBeUndefined();
    expect(result.totalAllocated).toBe(500);

    const intSummary = result.classSummaries.find((c) => c.className === "Internacional");
    expect(intSummary?.gapBRL).toBe(0);
    expect(intSummary?.actualAllocatedBRL).toBe(0);

    const skippedAAPL = result.skippedAssets.find((s) => s.ticker === "AAPL");
    expect(skippedAAPL).toBeDefined();
    expect(skippedAAPL?.reason).toBe("above_target");
  });

  it("ignora ativos internamente defasados quando a classe inteira já ultrapassou a meta", () => {
    const assets: AporteAssetInput[] = [
      // Internacional tem 2 ativos: total 400 (40% da carteira de 1000). Meta da classe = 25%.
      // IVV está superalocado (350), AAPL está defasado (50).
      asset({ id: "ivv", ticker: "IVV", assetClass: "Internacional", currentValueBRL: 350, priceBRL: 50, targetPercentage: null }),
      asset({ id: "aapl", ticker: "AAPL", assetClass: "Internacional", currentValueBRL: 50, priceBRL: 50, targetPercentage: null }),
      // Renda Fixa: 600 (60%), meta = 75%.
      asset({ id: "cdb", ticker: "CDB", assetClass: "Renda Fixa", currentValueBRL: 600, priceBRL: 1, targetPercentage: null }),
    ];

    const result = simulateCombinedAporte({
      aporte: 500,
      assets,
      classTargets: [
        { className: "Internacional", targetPercentage: 25 },
        { className: "Renda Fixa", targetPercentage: 75 },
      ],
    });

    // Apenas Renda Fixa deve receber aporte; AAPL não deve receber mesmo estando defasado internamente
    expect(result.routes.map((r) => r.ticker)).toEqual(["CDB"]);
    expect(result.routes.find((r) => r.ticker === "AAPL")).toBeUndefined();
    expect(result.routes.find((r) => r.ticker === "IVV")).toBeUndefined();
  });

  it("reconhece metas de classe com correspondência normalizada de strings (casing e acentos)", () => {
    const assets: AporteAssetInput[] = [
      asset({ id: "a", ticker: "PETR4", assetClass: "Ações", currentValueBRL: 0, priceBRL: 30, targetPercentage: null }),
    ];

    const result = simulateCombinedAporte({
      aporte: 300,
      assets,
      classTargets: [{ className: "acoes", targetPercentage: 100 }], // minúsculo e sem acento
    });

    expect(result.routes.map((r) => r.ticker)).toEqual(["PETR4"]);
    expect(result.totalAllocated).toBe(300);
  });

  it("impede divisão por zero e retorna alocação zerada quando o aporte informado é 0 ou negativo", () => {
    for (const aporte of [0, -500]) {
      const result = simulateCombinedAporte({
        aporte,
        assets: [
          asset({ id: "a", ticker: "PETR4", assetClass: "Ações", currentValueBRL: 1000, priceBRL: 30, targetPercentage: 100 }),
        ],
        classTargets: [{ className: "Ações", targetPercentage: 100 }],
      });

      expect(result.routes).toHaveLength(0);
      expect(result.totalAllocated).toBe(0);
      expect(result.leftover).toBe(0);
    }
  });

  it("não divide por zero e lida com ativos de preço zerado marcando no diagnóstico de inelegibilidade", () => {
    const result = simulateCombinedAporte({
      aporte: 1000,
      assets: [
        asset({ id: "a", ticker: "SEMPRECO", assetClass: "Ações", currentValueBRL: 0, priceBRL: 0, targetPercentage: 50 }),
        asset({ id: "b", ticker: "COM_PRECO", assetClass: "Ações", currentValueBRL: 0, priceBRL: 50, targetPercentage: 50 }),
      ],
      classTargets: [{ className: "Ações", targetPercentage: 100 }],
    });

    expect(result.routes.map((r) => r.ticker)).toEqual(["COM_PRECO"]);
    expect(result.skippedAssets).toContainEqual(
      expect.objectContaining({ ticker: "SEMPRECO", reason: "no_price" }),
    );
    expect(Number.isNaN(result.totalAllocated)).toBe(false);
    expect(Number.isNaN(result.leftover)).toBe(false);
  });

  it("retorna sobra integral sem alocações negativas quando todos os ativos já superaram as metas", () => {
    const result = simulateCombinedAporte({
      aporte: 500,
      assets: [
        asset({ id: "a", ticker: "PETR4", assetClass: "Ações", currentValueBRL: 10000, priceBRL: 30, targetPercentage: 50 }),
      ],
      classTargets: [{ className: "Ações", targetPercentage: 50 }],
    });

    // Patrimônio alvo = 10000 + 500 = 10500. Meta 50% = 5250. Atual = 10000 -> sem gap.
    expect(result.routes).toHaveLength(0);
    expect(result.totalAllocated).toBe(0);
    expect(result.leftover).toBe(500);
    expect(result.skippedAssets).toContainEqual(
      expect.objectContaining({ ticker: "PETR4", reason: "above_target" }),
    );
  });
});

describe("Auditoria de Invariantes & Teste de Estresse Multi-Nível (Classe -> Setor -> Ativo)", () => {
  describe("Precisão fracionária adaptativa (resolveAssetPrecision & isFractionalAsset)", () => {
    it("garante cotas estritamente inteiras (0 casas) para qualquer ativo B3 cotado em BRL", () => {
      // Ações com classe "Ações", "Acoes" ou "Stocks" cotadas em BRL
      expect(resolveAssetPrecision({ ticker: "PETR4", assetClass: "Ações", currency: "BRL" })).toBe(0);
      expect(resolveAssetPrecision({ ticker: "VALE3", assetClass: "Stocks", currency: "BRL" })).toBe(0);
      expect(resolveAssetPrecision({ ticker: "ITUB4", assetClass: "Ações Nacionais", currency: "BRL" })).toBe(0);

      // FIIs na B3
      expect(resolveAssetPrecision({ ticker: "HGLG11", assetClass: "FIIs", currency: "BRL" })).toBe(0);
      expect(resolveAssetPrecision({ ticker: "MXRF11", assetClass: "Fundos Imobiliários", currency: "BRL" })).toBe(0);

      // ETFs B3 em BRL
      expect(resolveAssetPrecision({ ticker: "BOVA11", assetClass: "ETFs", currency: "BRL" })).toBe(0);
      expect(resolveAssetPrecision({ ticker: "IVVB11", assetClass: "ETFs", currency: "BRL" })).toBe(0);

      // BDRs na B3 em BRL
      expect(resolveAssetPrecision({ ticker: "AAPL34", assetClass: "BDRs", currency: "BRL" })).toBe(0);

      expect(isFractionalAsset("Ações", "PETR4", undefined, "BRL")).toBe(false);
      expect(isFractionalAsset("ETFs", "BOVA11", undefined, "BRL")).toBe(false);
      expect(isFractionalAsset("BDRs", "AAPL34", undefined, "BRL")).toBe(false);
    });

    it("garante compras fracionárias de até 4 casas decimais para ativos internacionais cotados em USD", () => {
      expect(resolveAssetPrecision({ ticker: "VOO", assetClass: "Internacional", currency: "USD" })).toBe(4);
      expect(resolveAssetPrecision({ ticker: "AAPL", assetClass: "Stocks", currency: "USD" })).toBe(4);
      expect(resolveAssetPrecision({ ticker: "MSFT", assetClass: "Global Equities", currency: "USD" })).toBe(4);
      expect(resolveAssetPrecision({ ticker: "O", assetClass: "REITs", currency: "USD" })).toBe(4);

      expect(isFractionalAsset("Internacional", "VOO", undefined, "USD")).toBe(true);
      expect(isFractionalAsset("Stocks", "AAPL", undefined, "USD")).toBe(true);
    });

    it("garante alta precisão (8 casas decimais) para criptoativos em qualquer moeda", () => {
      expect(resolveAssetPrecision({ ticker: "BTC", assetClass: "Cripto", currency: "BRL" })).toBe(8);
      expect(resolveAssetPrecision({ ticker: "ETH", assetClass: "Criptoativos", currency: "USD" })).toBe(8);
      expect(resolveAssetPrecision({ ticker: "SOL", assetClass: "Cryptos", currency: "BRL" })).toBe(8);
      expect(resolveAssetPrecision({ ticker: "USDT", assetClass: "Stablecoins", currency: "USD" })).toBe(8);

      expect(isFractionalAsset("Cripto", "BTC", undefined, "BRL")).toBe(true);
    });

    it("respeita overrides manuais de fracionamento (isFractional explicit)", () => {
      // Forçar fracionamento em ativo B3 via override
      expect(resolveAssetPrecision({ ticker: "PETR4", assetClass: "Ações", currency: "BRL", isFractional: true })).toBe(4);
      // Forçar cotas inteiras em ativo USD via override
      expect(resolveAssetPrecision({ ticker: "VOO", assetClass: "Internacional", currency: "USD", isFractional: false })).toBe(0);
      // Forçar cotas inteiras em cripto via override
      expect(resolveAssetPrecision({ ticker: "BTC", assetClass: "Cripto", currency: "BRL", isFractional: false })).toBe(0);
    });
  });

  describe("Estresse com carteira massiva multi-setorial (50 ativos nos 3 modos)", () => {
    // Montagem de carteira sintética com 50 ativos distribuídos em 4 classes e 9 setores
    const createMassivePortfolio = () => {
      const assets: AporteAssetInput[] = [];

      // 1. Ações B3 (20 ativos em 4 setores, cotas inteiras)
      const acoesSectors = [
        { sector: "Financeiro / Bancos", tickers: ["ITUB4", "BBDC4", "BBAS3", "SANB11", "BPAC11"] },
        { sector: "Energia Elétrica", tickers: ["TAEE11", "EGIE3", "CPLE6", "ALUP11", "EQTL3"] },
        { sector: "Commodities / Materiais", tickers: ["VALE3", "PETR4", "CSNA3", "GGBR4", "SUZB3"] },
        { sector: "Consumo e Varejo", tickers: ["LREN3", "MGLU3", "ABEV3", "RADL3", "RENT3"] },
      ];
      for (const group of acoesSectors) {
        for (let i = 0; i < group.tickers.length; i++) {
          const ticker = group.tickers[i]!;
          assets.push(
            asset({
              id: `acao_${ticker}`,
              ticker,
              assetClass: "Ações",
              sector: group.sector,
              currency: "BRL",
              currentValueBRL: 500 + i * 200,
              priceBRL: 20 + i * 15,
              targetPercentage: 2, // 20 ativos x 2% = 40% de meta individual
            }),
          );
        }
      }

      // 2. FIIs B3 (15 ativos em 3 setores, cotas inteiras)
      const fiiSectors = [
        { sector: "Imobiliário / Logística", tickers: ["HGLG11", "BTLG11", "XPLG11", "VILG11", "LVBI11"] },
        { sector: "Imobiliário / Papel e CRI", tickers: ["KNCR11", "KNIP11", "MXRF11", "CPTS11", "RBRR11"] },
        { sector: "Imobiliário / Shoppings", tickers: ["XPML11", "VISC11", "HSML11", "MALL11", "HGBS11"] },
      ];
      for (const group of fiiSectors) {
        for (let i = 0; i < group.tickers.length; i++) {
          const ticker = group.tickers[i]!;
          assets.push(
            asset({
              id: `fii_${ticker}`,
              ticker,
              assetClass: "FIIs",
              sector: group.sector,
              currency: "BRL",
              currentValueBRL: 400 + i * 150,
              priceBRL: 80 + i * 10,
              targetPercentage: 1.66,
            }),
          );
        }
      }

      // 3. Internacional USD (10 ativos em 2 setores, 4 casas decimais)
      const intSectors = [
        { sector: "Tecnologia & Software", tickers: ["AAPL", "MSFT", "GOOGL", "NVDA", "AMZN"] },
        { sector: "Mercado Amplo US", tickers: ["VOO", "VTI", "QQQ", "SCHD", "VT"] },
      ];
      for (const group of intSectors) {
        for (let i = 0; i < group.tickers.length; i++) {
          const ticker = group.tickers[i]!;
          assets.push(
            asset({
              id: `int_${ticker}`,
              ticker,
              assetClass: "Internacional",
              sector: group.sector,
              currency: "USD",
              currentValueBRL: 300 + i * 100,
              priceBRL: 150 + i * 50,
              targetPercentage: 2.5,
            }),
          );
        }
      }

      // 4. Criptoativos (5 ativos, 8 casas decimais)
      const cryptos = [
        { ticker: "BTC", price: 350_000, current: 2000 },
        { ticker: "ETH", price: 18_000, current: 1000 },
        { ticker: "SOL", price: 900, current: 300 },
        { ticker: "ADA", price: 3.5, current: 100 },
        { ticker: "DOT", price: 35, current: 100 },
      ];
      for (const c of cryptos) {
        assets.push(
          asset({
            id: `crypto_${c.ticker}`,
            ticker: c.ticker,
            assetClass: "Cripto",
            sector: "Criptoativos",
            currency: "BRL",
            currentValueBRL: c.current,
            priceBRL: c.price,
            targetPercentage: 2,
          }),
        );
      }

      return assets;
    };

    const classTargets: ClassTargetInput[] = [
      { className: "Ações", targetPercentage: 40 },
      { className: "FIIs", targetPercentage: 25 },
      { className: "Internacional", targetPercentage: 25 },
      { className: "Cripto", targetPercentage: 10 },
    ];

    const sectorTargets: SectorTargetInput[] = [
      // Setores de Ações (soma 100% de Ações)
      { className: "Ações", sectorName: "Financeiro / Bancos", targetPercentage: 35 },
      { className: "Ações", sectorName: "Energia Elétrica", targetPercentage: 30 },
      { className: "Ações", sectorName: "Commodities / Materiais", targetPercentage: 20 },
      { className: "Ações", sectorName: "Consumo e Varejo", targetPercentage: 15 },
      // Setores de FIIs (soma 100% de FIIs)
      { className: "FIIs", sectorName: "Imobiliário / Logística", targetPercentage: 40 },
      { className: "FIIs", sectorName: "Imobiliário / Papel e CRI", targetPercentage: 35 },
      { className: "FIIs", sectorName: "Imobiliário / Shoppings", targetPercentage: 25 },
      // Setores de Internacional (soma 100% de Internacional)
      { className: "Internacional", sectorName: "Tecnologia & Software", targetPercentage: 50 },
      { className: "Internacional", sectorName: "Mercado Amplo US", targetPercentage: 50 },
    ];

    it("respeita rigorosamente todas as invariantes no modo combinado (both)", () => {
      const assets = createMassivePortfolio();
      const aporte = 25_000;

      const result = simulateCombinedAporte({
        aporte,
        assets,
        classTargets,
        sectorTargets,
      });

      // 1. Invariante da Conservação de Capital
      expect(result.totalAllocated).toBeLessThanOrEqual(aporte);
      expect(result.leftover).toBeGreaterThanOrEqual(0);
      expect(Math.round((result.totalAllocated + result.leftover) * 100) / 100).toBe(aporte);

      // 2. Integridade de Cotas por Tipo de Ativo
      for (const route of result.routes) {
        expect(route.allocatedBRL).toBeGreaterThan(0);
        expect(route.quantity).toBeGreaterThan(0);
        expect(Number.isNaN(route.allocatedBRL)).toBe(false);
        expect(Number.isNaN(route.quantity)).toBe(false);

        if (route.assetClass === "Ações" || route.assetClass === "FIIs") {
          // B3: cotas estritamente inteiras
          expect(Number.isInteger(route.quantity)).toBe(true);
          expect(route.quantity).toBeGreaterThanOrEqual(1);
        } else if (route.assetClass === "Internacional") {
          // USD: até 4 casas decimais
          const decimals = (route.quantity.toString().split(".")[1] ?? "").length;
          expect(decimals).toBeLessThanOrEqual(4);
        } else if (route.assetClass === "Cripto") {
          // Cripto: até 8 casas decimais
          const decimals = (route.quantity.toString().split(".")[1] ?? "").length;
          expect(decimals).toBeLessThanOrEqual(8);
        }

        // Alocação não excede o gap com tolerância de arredondamento de 1 cota/centavo
        expect(route.allocatedBRL).toBeLessThanOrEqual(route.gapBRL + 0.05);
      }

      // 3. Coerência do somatório das rotas com o totalAllocated
      const sumRoutesAllocated = Math.round(result.routes.reduce((acc, r) => acc + r.allocatedBRL, 0) * 100) / 100;
      expect(result.totalAllocated).toBe(sumRoutesAllocated);

      // 4. Coerência dos sumários de classe
      const sumClassAllocated = Math.round(result.classSummaries.reduce((acc, c) => acc + c.actualAllocatedBRL, 0) * 100) / 100;
      expect(sumClassAllocated).toBe(result.totalAllocated);
    });

    it("respeita rigorosamente todas as invariantes no modo por ativo (asset / smart)", () => {
      const assets = createMassivePortfolio();
      const aporte = 15_000;

      const result = simulateSmartAporte({
        aporte,
        assets,
      });

      expect(result.mode).toBe("asset");
      expect(result.totalAllocated).toBeLessThanOrEqual(aporte);
      expect(result.leftover).toBeGreaterThanOrEqual(0);
      expect(Math.round((result.totalAllocated + result.leftover) * 100) / 100).toBe(aporte);

      for (const route of result.routes) {
        if (route.assetClass === "Ações" || route.assetClass === "FIIs") {
          expect(Number.isInteger(route.quantity)).toBe(true);
        }
      }
    });

    it("respeita rigorosamente todas as invariantes no modo por classe (class / rebalance)", () => {
      const assets = createMassivePortfolio();
      const aporte = 20_000;

      const result = simulateRebalanceAporte({
        aporte,
        assets,
        classTargets,
        sectorTargets,
      });

      expect(result.mode).toBe("class");
      expect(result.totalAllocated).toBeLessThanOrEqual(aporte);
      expect(result.leftover).toBeGreaterThanOrEqual(0);
      expect(Math.round((result.totalAllocated + result.leftover) * 100) / 100).toBe(aporte);

      for (const route of result.routes) {
        if (route.assetClass === "Ações" || route.assetClass === "FIIs") {
          expect(Number.isInteger(route.quantity)).toBe(true);
        }
      }
    });

    it("resiste a estresse com aporte massivo (R$ 10.000.000,00) preenchendo todos os gaps sem alocação negativa", () => {
      const assets = createMassivePortfolio();
      const aporteGigante = 10_000_000;

      const result = simulateCombinedAporte({
        aporte: aporteGigante,
        assets,
        classTargets,
        sectorTargets,
      });

      expect(result.totalAllocated).toBeLessThanOrEqual(aporteGigante);
      expect(result.leftover).toBeGreaterThan(0);
      expect(Math.round((result.totalAllocated + result.leftover) * 100) / 100).toBe(aporteGigante);
      expect(Number.isNaN(result.totalAllocated)).toBe(false);
      expect(Number.isNaN(result.leftover)).toBe(false);
    });

    it("resiste a estresse com aporte minúsculo (R$ 1,00) que não compra 1 cota B3", () => {
      const assets = createMassivePortfolio();
      const aporteMicro = 1.0;

      const result = simulateCombinedAporte({
        aporte: aporteMicro,
        assets,
        classTargets,
        sectorTargets,
      });

      expect(result.totalAllocated).toBeLessThanOrEqual(aporteMicro);
      expect(result.leftover).toBeGreaterThanOrEqual(0);
      expect(Math.round((result.totalAllocated + result.leftover) * 100) / 100).toBe(aporteMicro);

      // Nenhuma cota B3 pode ser sugerida (todas custam > R$ 20)
      for (const route of result.routes) {
        if (route.assetClass === "Ações" || route.assetClass === "FIIs") {
          expect(route.quantity).toBe(0);
        }
      }
    });

    it("suporta carteira com patrimônio inicial zero (todos os ativos com saldo zero)", () => {
      const assets = [
        asset({ id: "1", ticker: "PETR4", assetClass: "Ações", currentValueBRL: 0, priceBRL: 30, targetPercentage: 40 }),
        asset({ id: "2", ticker: "HGLG11", assetClass: "FIIs", currentValueBRL: 0, priceBRL: 100, targetPercentage: 30 }),
        asset({ id: "3", ticker: "VOO", assetClass: "Internacional", currency: "USD", currentValueBRL: 0, priceBRL: 2500, targetPercentage: 30 }),
      ];

      const result = simulateCombinedAporte({
        aporte: 10_000,
        assets,
        classTargets: [
          { className: "Ações", targetPercentage: 40 },
          { className: "FIIs", targetPercentage: 30 },
          { className: "Internacional", targetPercentage: 30 },
        ],
      });

      expect(result.totalAllocated).toBeLessThanOrEqual(10_000);
      expect(result.routes.length).toBeGreaterThanOrEqual(2);
      expect(result.leftover).toBeGreaterThanOrEqual(0);

      // PETR4 e HGLG11 devem ter cotas inteiras
      const petr = result.routes.find((r) => r.ticker === "PETR4");
      const hglg = result.routes.find((r) => r.ticker === "HGLG11");
      const voo = result.routes.find((r) => r.ticker === "VOO");

      if (petr) expect(Number.isInteger(petr.quantity)).toBe(true);
      if (hglg) expect(Number.isInteger(hglg.quantity)).toBe(true);
      if (voo) expect(voo.quantity).toBeGreaterThan(0);
    });

    it("executa transbordamento de sobra de setor caro para outro setor mais acessível da mesma classe", () => {
      const assets = [
        // Setor 1: Ativo caro (preço R$ 800) em setor com meta 30% da classe (orçado em R$ 300)
        asset({ id: "caro", ticker: "CARO3", assetClass: "Ações", sector: "Setor Caro", currentValueBRL: 0, priceBRL: 800 }),
        // Setor 2: Ativos com gap suficiente para absorver a verba do setor e o transbordamento
        asset({ id: "barato1", ticker: "BARATO1", assetClass: "Ações", sector: "Setor Barato", currentValueBRL: 0, priceBRL: 25, targetPercentage: 50 }),
        asset({ id: "barato2", ticker: "BARATO2", assetClass: "Ações", sector: "Setor Barato", currentValueBRL: 0, priceBRL: 20, targetPercentage: 50 }),
      ];

      // Aporte de R$ 1.000:
      // Setor Caro orçado em R$ 300 -> não compra 1 cota de R$ 800 (sobra R$ 300)
      // A sobra de R$ 300 transborda no Pass 2 para o Setor Barato, que tem R$ 800 de gap (400 + 400)
      // Setor Barato absorve seu orçamento inicial (R$ 700) + a sobra transbordada (R$ 300) = R$ 1.000
      const result = simulateCombinedAporte({
        aporte: 1000,
        assets,
        classTargets: [{ className: "Ações", targetPercentage: 100 }],
        sectorTargets: [
          { className: "Ações", sectorName: "Setor Caro", targetPercentage: 30 },
          { className: "Ações", sectorName: "Setor Barato", targetPercentage: 70 },
        ],
      });

      const b1 = result.routes.find((r) => r.ticker === "BARATO1");
      const b2 = result.routes.find((r) => r.ticker === "BARATO2");
      const caro = result.routes.find((r) => r.ticker === "CARO3");

      // Caro não comprou nada por preço exceder o orçamento
      expect(caro).toBeUndefined();
      expect(result.skippedAssets).toContainEqual(
        expect.objectContaining({ ticker: "CARO3", reason: "price_exceeds_budget" }),
      );

      // Baratos absorveram o orçamento inicial do setor (700) + a sobra transbordada do setor caro (300) = 1000
      expect(b1).toBeDefined();
      expect(b2).toBeDefined();
      expect(result.totalAllocated).toBe(1000);
      expect(result.leftover).toBe(0);
    });
  });
});

