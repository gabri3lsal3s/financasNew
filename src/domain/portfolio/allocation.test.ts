import { describe, expect, it } from "vitest";
import {
  calculateAssetAllocationDelta,
  calculateEffectiveAssetTargets,
  calculatePortfolioQualityScore,
  calculateSectorEffectiveTargetPct,
  clampTargetPercentage,
  deriveAssetWeightsFromScores,
  distributeEquallyTargets,
  groupAssetsByClassAndSector,
  mirrorCurrentPositionTargets,
  parseTargetInput,
  targetsSum,
  validateClassSectorTargetsSum,
  validateTargetsSum,
} from "./allocation";

describe("domain/portfolio/allocation (§3.11.1)", () => {
  describe("targetsSum / validateTargetsSum — soma ≤ 100", () => {
    it("soma correta das metas", () => {
      expect(targetsSum([{ target: 30 }, { target: 40 }, { target: 10.5 }])).toBe(80.5);
    });

    it("soma vazia = 0", () => {
      expect(targetsSum([])).toBe(0);
    });

    it("soma ≤ 100 é válida e reporta o restante", () => {
      const result = validateTargetsSum([{ target: 30 }, { target: 40 }]);
      expect(result.ok).toBe(true);
      expect(result.sum).toBe(70);
      expect(result.remaining).toBe(30);
      expect(result.error).toBeNull();
    });

    it("soma exatamente 100 com dízimas flutuantes (IEEE 754) é válida sem erro", () => {
      // 11.11 * 8 + 11.12 em JS puro resulta em 100.00000000000001
      const targets = [
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.11 },
        { target: 11.12 },
      ];
      const result = validateTargetsSum(targets);
      expect(result.ok).toBe(true);
      expect(result.sum).toBe(100);
      expect(result.remaining).toBe(0);
      expect(result.error).toBeNull();
    });

    it("soma > 100 é bloqueada com mensagem pt-BR", () => {
      const result = validateTargetsSum([{ target: 40 }, { target: 40 }, { target: 40 }]);
      expect(result.ok).toBe(false);
      expect(result.sum).toBe(120);
      expect(result.remaining).toBe(0);
      expect(result.error).toContain("excede 100%");
    });
  });

  describe("clampTargetPercentage / parseTargetInput", () => {
    it("clampa acima de 100 e abaixo de 0", () => {
      expect(clampTargetPercentage(150)).toBe(100);
      expect(clampTargetPercentage(-10)).toBe(0);
      expect(clampTargetPercentage(42.567)).toBe(42.57);
    });

    it("parse aceita vírgula pt-BR e vazio → 0", () => {
      expect(parseTargetInput("12,5")).toBe(12.5);
      expect(parseTargetInput("")).toBe(0);
      expect(parseTargetInput("120")).toBe(100);
      expect(parseTargetInput("abc")).toBe(0);
    });
  });

  describe("distributeEquallyTargets (1/N)", () => {
    it("distribui 100% perfeitamente em 4 itens (25% cada)", () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
      const res = distributeEquallyTargets(items, 100);
      expect(res.map((r) => r.targetPercentage)).toEqual([25, 25, 25, 25]);
    });

    it("compensa dízima periódica no último item para fechar exatamente 100%", () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const res = distributeEquallyTargets(items, 100);
      expect(res.map((r) => r.targetPercentage)).toEqual([33.33, 33.33, 33.34]);
      const sum = res.reduce((acc, r) => acc + r.targetPercentage, 0);
      expect(sum).toBe(100);
    });

    it("distribui para um teto parcial customizado (ex: 40%)", () => {
      const items = [{ id: "1" }, { id: "2" }, { id: "3" }];
      const res = distributeEquallyTargets(items, 40);
      expect(res.map((r) => r.targetPercentage)).toEqual([13.33, 13.33, 13.34]);
      const sum = res.reduce((acc, r) => acc + r.targetPercentage, 0);
      expect(sum).toBe(40);
    });

    it("retorna vazio se array vazio", () => {
      expect(distributeEquallyTargets([])).toEqual([]);
    });
  });

  describe("mirrorCurrentPositionTargets", () => {
    it("espelha a proporção atual normalizando para 100%", () => {
      const items = [
        { id: "1", currentPct: 10 },
        { id: "2", currentPct: 30 },
      ];
      const res = mirrorCurrentPositionTargets(items, 100);
      expect(res[0]?.targetPercentage).toBe(25);
      expect(res[1]?.targetPercentage).toBe(75);
    });

    it("faz fallback para 1/N se todos currentPct forem 0", () => {
      const items = [
        { id: "1", currentPct: 0 },
        { id: "2", currentPct: 0 },
      ];
      const res = mirrorCurrentPositionTargets(items, 100);
      expect(res.map((r) => r.targetPercentage)).toEqual([50, 50]);
    });
  });

  describe("calculateAssetAllocationDelta", () => {
    it("calcula delta positivo quando alvo > atual (precisa de aporte) em pt-BR", () => {
      const delta = calculateAssetAllocationDelta(5.2, 10.0);
      expect(delta.deltaPct).toBe(4.8);
      expect(delta.isUnderallocated).toBe(true);
      expect(delta.formattedDelta).toBe("+4,8%");
    });

    it("calcula delta negativo ou zero quando alvo <= atual em pt-BR", () => {
      const delta = calculateAssetAllocationDelta(12.5, 10.0);
      expect(delta.deltaPct).toBe(-2.5);
      expect(delta.isUnderallocated).toBe(false);
      expect(delta.formattedDelta).toBe("-2,5%");
    });
  });

  describe("groupAssetsByClassAndSector", () => {
    it("agrupa ativos por classe e por setor com fallbacks limpos", () => {
      const assets = [
        { id: "1", assetClass: "Ações", sector: "Financeiro / Bancos" },
        { id: "2", assetClass: "Ações", sector: "Energia Elétrica" },
        { id: "3", assetClass: "Ações", sector: "Financeiro / Bancos" },
        { id: "4", assetClass: "FIIs", sector: "Imobiliário / Logística" },
        { id: "5", assetClass: null, sector: null },
      ];

      const grouped = groupAssetsByClassAndSector(assets);
      expect(grouped.has("Ações")).toBe(true);
      expect(grouped.has("FIIs")).toBe(true);
      expect(grouped.has("Outros")).toBe(true);

      const acoesSectors = grouped.get("Ações")!;
      expect(acoesSectors.get("Financeiro / Bancos")?.length).toBe(2);
      expect(acoesSectors.get("Energia Elétrica")?.length).toBe(1);

      const outrosSectors = grouped.get("Outros")!;
      expect(outrosSectors.get("Geral")?.length).toBe(1);
    });
  });

  describe("calculateSectorEffectiveTargetPct", () => {
    it("converte percentual relativo da classe para percentual absoluto da carteira", () => {
      // 40% da carteira em Ações, 25% de Ações em Bancos -> 10% da carteira
      expect(calculateSectorEffectiveTargetPct(40, 25)).toBe(10);
      // 30% da carteira em FIIs, 33.33% de FIIs em Logística -> 10% da carteira
      expect(calculateSectorEffectiveTargetPct(30, 33.33)).toBe(10);
      // Casos com zero ou inválido
      expect(calculateSectorEffectiveTargetPct(0, 50)).toBe(0);
      expect(calculateSectorEffectiveTargetPct(40, 0)).toBe(0);
    });
  });

  describe("validateClassSectorTargetsSum", () => {
    it("valida soma de setores até 100% da classe", () => {
      const res = validateClassSectorTargetsSum([{ target: 40 }, { target: 30 }, { target: 30 }], "Ações");
      expect(res.ok).toBe(true);
      expect(res.sum).toBe(100);
      expect(res.remaining).toBe(0);
      expect(res.error).toBeNull();
    });

    it("bloqueia soma de setores > 100% da classe com mensagem contextual", () => {
      const res = validateClassSectorTargetsSum([{ target: 50 }, { target: 60 }], "Ações");
      expect(res.ok).toBe(false);
      expect(res.sum).toBe(110);
      expect(res.error).toContain("Ações");
      expect(res.error).toContain("excede 100%");
    });
  });

  describe("deriveAssetWeightsFromScores — Fase 41 Governança por Notas & Quarentenas", () => {
    it("calcula pesos proporcionais para notas 10, 8 e 6 somando rigorosamente 1.0", () => {
      const assets = [
        { id: "a1", ticker: "ITUB4", score: 10, allocation_status: "active" as const },
        { id: "a2", ticker: "BBAS3", score: 8, allocation_status: "active" as const },
        { id: "a3", ticker: "SANB11", score: 6, allocation_status: "active" as const },
      ];

      const result = deriveAssetWeightsFromScores(assets);
      expect(result).toHaveLength(3);

      // Soma total das notas = 24. Pesos esperados: 10/24 (~0.4167), 8/24 (~0.3333), 6/24 (~0.25)
      expect(result[0]?.weightInSector).toBeCloseTo(10 / 24, 3);
      expect(result[1]?.weightInSector).toBeCloseTo(8 / 24, 3);
      expect(result[2]?.weightInSector).toBeCloseTo(6 / 24, 3);

      const totalWeight = result.reduce((acc, r) => acc + r.weightInSector, 0);
      expect(totalWeight).toBe(1.0);
    });

    it("isola rigorosamente ativos em quarentena ou saída com peso 0 e sem aportes (Salvaguarda S3)", () => {
      const assets = [
        { id: "a1", ticker: "WEGE3", score: 10, allocation_status: "active" as const },
        { id: "a2", ticker: "OIBR3", score: 0, allocation_status: "quarantine" as const },
        { id: "a3", ticker: "AMER3", score: 0, allocation_status: "exit" as const },
      ];

      const result = deriveAssetWeightsFromScores(assets);
      expect(result[0]?.weightInSector).toBe(1.0);
      expect(result[0]?.isEligible).toBe(true);

      // Quarentena e Saída são 0 estritos
      expect(result[1]?.weightInSector).toBe(0);
      expect(result[1]?.isEligible).toBe(false);
      expect(result[2]?.weightInSector).toBe(0);
      expect(result[2]?.isEligible).toBe(false);
    });

    it("aplica fallback neutro (Nota 5) para ativos ativos sem nota preenchida (Salvaguarda S1)", () => {
      const assets = [
        { id: "a1", ticker: "TAEE11", score: 10, allocation_status: "active" as const },
        { id: "a2", ticker: "ALUP11", score: null, allocation_status: "active" as const }, // assume 5
      ];

      const result = deriveAssetWeightsFromScores(assets);
      expect(result[1]?.effectiveScore).toBe(5);
      expect(result[1]?.isEligible).toBe(true);
      // 10 / 15 = ~0.6667, 5 / 15 = ~0.3333
      expect(result[0]?.weightInSector).toBeCloseTo(2 / 3, 3);
      expect(result[1]?.weightInSector).toBeCloseTo(1 / 3, 3);
    });

    it("evita divisão por zero se todos os ativos do setor estiverem em quarentena (Salvaguarda S2)", () => {
      const assets = [
        { id: "a1", ticker: "OIBR3", score: 2, allocation_status: "quarantine" as const },
        { id: "a2", ticker: "IRBR3", score: 1, allocation_status: "quarantine" as const },
      ];

      const result = deriveAssetWeightsFromScores(assets);
      expect(result[0]?.weightInSector).toBe(0);
      expect(result[1]?.weightInSector).toBe(0);
      expect(result.every((r) => !r.isEligible)).toBe(true);
    });
  });

  describe("calculateEffectiveAssetTargets — 3 Níveis & Classes sem Setores", () => {
    it("deriva meta efetiva encadeando Classe × Setor × Nota", () => {
      const assets = [
        { id: "a1", ticker: "ITUB4", assetClass: "Ações", sector: "Bancos", score: 10, allocation_status: "active" as const },
        { id: "a2", ticker: "BBDC4", assetClass: "Ações", sector: "Bancos", score: 10, allocation_status: "active" as const },
      ];

      // Ações 40% da carteira, Bancos 50% de Ações -> 20% no setor. Cada ativo recebe 10%
      const res = calculateEffectiveAssetTargets({
        assets,
        classTargets: { Ações: 40 },
        sectorTargets: { Bancos: 50 },
      });

      expect(res).toHaveLength(2);
      expect(res[0]?.effectiveTargetPct).toBe(10);
      expect(res[1]?.effectiveTargetPct).toBe(10);
    });

    it("colapsa ponderação diretamente na classe quando não há setores cadastrados (Salvaguarda S5)", () => {
      const assets = [
        { id: "rf1", ticker: "Tesouro Selic", assetClass: "Renda Fixa", score: 10, allocation_status: "active" as const },
        { id: "rf2", ticker: "CDB Banco Inter", assetClass: "Renda Fixa", score: 10, allocation_status: "active" as const },
      ];

      // Renda Fixa com meta de 30% sem divisão setorial -> 15% para cada
      const res = calculateEffectiveAssetTargets({
        assets,
        classTargets: { "Renda Fixa": 30 },
        sectorTargets: {},
      });

      expect(res).toHaveLength(2);
      expect(res[0]?.effectiveTargetPct).toBe(15);
      expect(res[0]?.sectorTargetPctInClass).toBeNull();
      expect(res[1]?.effectiveTargetPct).toBe(15);
      expect(res[1]?.formulaLabel).toContain("30,0% Classe");
    });

    it("exclui Caixa das metas efetivas e isola setores homônimos entre classes", () => {
      const assets = [
        { id: "cash", ticker: "CAIXA", assetClass: "Caixa", score: 10, allocation_status: "active" as const },
        { id: "a1", ticker: "LOGN3", assetClass: "Ações", sector: "Logística", score: 10, allocation_status: "active" as const },
        { id: "f1", ticker: "HGLG11", assetClass: "FIIs", sector: "Logística", score: null, allocation_status: "active" as const },
      ];

      const res = calculateEffectiveAssetTargets({
        assets,
        classTargets: [
          { className: "Ações", targetPercentage: 50 },
          { className: "FIIs", targetPercentage: 50 },
        ],
        sectorTargets: [
          { className: "Ações", sectorName: "Logística", targetPercentage: 20 },
          { className: "FIIs", sectorName: "Logística", targetPercentage: 80 },
        ],
      });

      const cashRes = res.find((r) => r.assetId === "cash")!;
      const stockRes = res.find((r) => r.assetId === "a1")!;
      const fiiRes = res.find((r) => r.assetId === "f1")!;

      expect(cashRes.effectiveTargetPct).toBe(0);
      expect(cashRes.isEligible).toBe(false);
      // Ações 50% * Setor 20% = 10%
      expect(stockRes.effectiveTargetPct).toBe(10);
      // FIIs 50% * Setor 80% = 40% (preservando rawScore === null)
      expect(fiiRes.effectiveTargetPct).toBe(40);
      expect(fiiRes.rawScore).toBeNull();
      expect(fiiRes.effectiveScore).toBe(5);
      expect(fiiRes.formulaLabel).toContain("Sem nota, peso 5");
    });

    it("transborda fatia de setor 100% em quarentena para outro setor ativo na mesma classe (Salvaguarda S2)", () => {
      const assets = [
        { id: "b1", ticker: "ITUB4", assetClass: "Ações", sector: "Bancos", score: 10, allocation_status: "active" as const },
        { id: "t1", ticker: "OIBR3", assetClass: "Ações", sector: "Telecom", score: 1, allocation_status: "quarantine" as const },
      ];

      const res = calculateEffectiveAssetTargets({
        assets,
        classTargets: [{ className: "Ações", targetPercentage: 40 }],
        sectorTargets: [
          { className: "Ações", sectorName: "Bancos", targetPercentage: 60 },
          { className: "Ações", sectorName: "Telecom", targetPercentage: 40 },
        ],
      });

      const itub = res.find((r) => r.assetId === "b1")!;
      const oibr = res.find((r) => r.assetId === "t1")!;
      expect(oibr.effectiveTargetPct).toBe(0);
      // Os 40% de Telecom transbordam para Bancos -> 100% da classe Ações (40%)
      expect(itub.effectiveTargetPct).toBe(40);
    });

    it("auto-normaliza proporcionalmente classes quando a soma excede 100% ou autoNormalize: true", () => {
      const assets = [
        { id: "a1", ticker: "PETR4", assetClass: "Ações", score: 10, allocation_status: "active" as const },
        { id: "f1", ticker: "KNRI11", assetClass: "FIIs", score: 10, allocation_status: "active" as const },
        { id: "rf1", ticker: "Tesouro IPCA", assetClass: "Renda Fixa", score: 10, allocation_status: "active" as const },
      ];

      // Usuário escolheu 50%, 50% e 100% (soma = 200%). Normalização 1:1:2 -> 25%, 25%, 50%
      const res = calculateEffectiveAssetTargets({
        assets,
        classTargets: { Ações: 50, FIIs: 50, "Renda Fixa": 100 },
      });

      expect(res.find((r) => r.assetId === "a1")?.effectiveTargetPct).toBe(25);
      expect(res.find((r) => r.assetId === "f1")?.effectiveTargetPct).toBe(25);
      expect(res.find((r) => r.assetId === "rf1")?.effectiveTargetPct).toBe(50);
    });

    it("auto-normaliza setores de uma classe quando a soma dos setores excede 100%", () => {
      const assets = [
        { id: "b1", ticker: "ITUB4", assetClass: "Ações", sector: "Bancos", score: 10, allocation_status: "active" as const },
        { id: "e1", ticker: "EGIE3", assetClass: "Ações", sector: "Energia", score: 10, allocation_status: "active" as const },
      ];

      // Ações 100%. Setores: Bancos 60% e Energia 60% (soma 120%). Proporção 1:1 -> 50% e 50%
      const res = calculateEffectiveAssetTargets({
        assets,
        classTargets: { Ações: 100 },
        sectorTargets: { Bancos: 60, Energia: 60 },
      });

      expect(res.find((r) => r.assetId === "b1")?.effectiveTargetPct).toBe(50);
      expect(res.find((r) => r.assetId === "e1")?.effectiveTargetPct).toBe(50);
    });
  });

  describe("calculatePortfolioQualityScore (PQS) — Índice Consolidado", () => {
    it("calcula média ponderada das notas pelo patrimônio real", () => {
      const assets = [
        { score: 10, currentValueBRL: 80000, allocation_status: "active" as const },
        { score: 5, currentValueBRL: 20000, allocation_status: "active" as const },
      ];
      // (10 * 80000 + 5 * 20000) / 100000 = (800000 + 100000) / 100000 = 9.0
      expect(calculatePortfolioQualityScore(assets)).toBe(9.0);
    });

    it("atribui nota 0 para ativos em quarentena sem nota explícita no PQS", () => {
      const assets = [
        { score: 10, currentValueBRL: 50000, allocation_status: "active" as const },
        { score: null, currentValueBRL: 50000, allocation_status: "quarantine" as const }, // score 0
      ];
      // (10 * 50000 + 0 * 50000) / 100000 = 5.0
      expect(calculatePortfolioQualityScore(assets)).toBe(5.0);
    });

    it("retorna fallback 5.0 para carteira vazia", () => {
      expect(calculatePortfolioQualityScore([])).toBe(5.0);
    });
  });
});
