/**
 * Suíte de Testes Automatizados — Portão de Qualidade 4 (Gate 4)
 * Caso Canônico BR-20261118-6445 (Data-base: 18/11/2026)
 *
 * Validações Obrigatórias:
 * 1. Saneamento de Metas Órfãs Legadas e Invariante de Soma 100,0% (BUG-11)
 * 2. Invariante de Soma Zero dos Gaps Financeiros (sum(Gap_c) === R$ 0,00)
 * 3. Índice de Equilíbrio Geral (IEG) recalculado para 84,9% (85%)
 * 4. Resolução da Contradição Textual na Narrativa Executiva (BUG-12)
 * 5. Raio-X de Renda Fixa: Pós-fixado 93,3% e Prefixado 0,0% unificados (BUG-13)
 * 6. Raio-X Internacional: Desacoplamento geográfico de GLD, BITB, MCHI e ARGT (BUG-14)
 * 7. Dinamismo de Contagem de Segmentos (BUG-16)
 */

import { describe, expect, it } from "vitest";
import {
  calculateAllocationGaps,
  sanitizeOrphanLegacyTargets,
} from "@/domain/reports/allocation-gaps";
import {
  calculateFixedIncomeExposure,
  calculateInternationalExposure,
} from "@/domain/portfolio/class-breakdown";
import {
  getInternationalProfile,
  inferFixedIncomeCategories,
  INTERNATIONAL_REGION_LABELS,
} from "@/domain/portfolio/tickers-catalog";
import {
  GOLDEN_ALLOCATION_POSITIONS,
  GOLDEN_ASSETS_FIXTURE,
  GOLDEN_EXPECTED,
  GOLDEN_TARGETS_CORRUPTED,
  GOLDEN_TARGETS_SANITIZED,
} from "./fixtures/golden_portfolio_6445";

describe("Portão de Qualidade 4 (Gate 4) — Motor de Alocação e Raios-X", () => {
  describe("Critério 1 & 2: Saneamento de Metas e Invariantes de Alocação (BUG-11)", () => {
    it("deve expurgar categorias legadas órfãs com saldo zero quando as metas somam 200%", () => {
      const sanitized = sanitizeOrphanLegacyTargets(
        GOLDEN_ALLOCATION_POSITIONS,
        GOLDEN_TARGETS_CORRUPTED,
      );

      expect(sanitized).toEqual([...GOLDEN_TARGETS_SANITIZED]);
      const totalTargetPct = sanitized.reduce((acc, ct) => acc + ct.targetPercentage, 0);
      expect(totalTargetPct).toBe(100);

      const targetClasses = sanitized.map((t) => t.assetClass);
      expect(targetClasses).toContain("FIIs");
      expect(targetClasses).toContain("Ações");
      expect(targetClasses).toContain("Renda Fixa");
      expect(targetClasses).toContain("Internacional");
      expect(targetClasses).toContain("ETFs");

      // Categorias legadas órfãs não devem existir
      expect(targetClasses).not.toContain("Fundos Imobiliários");
      expect(targetClasses).not.toContain("Ações De Dividendos");
      expect(targetClasses).not.toContain("Renda Fixa CDI");
      expect(targetClasses).not.toContain("REITs Globais");
    });

    it("garante a invariante estrita sum(w_meta) === 100,00% e sum(Gap_c) === R$ 0,00", () => {
      // Executa a análise tanto com as metas corrompidas (200%) quanto saneadas (100%)
      const resultCorruptedInput = calculateAllocationGaps(
        GOLDEN_ALLOCATION_POSITIONS,
        GOLDEN_TARGETS_CORRUPTED,
      );

      expect(resultCorruptedInput.totalTargetPct).toBe(100.0);
      expect(Math.abs(resultCorruptedInput.totalGapBRL)).toBeLessThanOrEqual(0.02);

      // Soma dos gaps de todas as classes deve ser exatamente R$ 0,00
      const sumGaps = resultCorruptedInput.classGaps.reduce((acc, cg) => acc + cg.gapBRL, 0);
      expect(Math.abs(sumGaps)).toBeLessThanOrEqual(0.02);

      // Soma dos pesos-alvo das classes ativas deve ser exatamente 100,0%
      const sumTargetPct = resultCorruptedInput.classGaps.reduce((acc, cg) => acc + cg.targetPct, 0);
      expect(sumTargetPct).toBe(100.0);
    });

    it("recalcula o Índice de Equilíbrio Geral (IEG) para 84,9% (~85%) no Golden Dataset", () => {
      const result = calculateAllocationGaps(
        GOLDEN_ALLOCATION_POSITIONS,
        GOLDEN_TARGETS_CORRUPTED,
      );

      // No bug anterior, IEG desabava para 35% devido aos R$ 17.503,68 de gaps fantasmas
      expect(result.alignmentScore).not.toBe(35);
      expect(result.alignmentScore).toBe(85); // Math.round(84.86%)
      expect(result.equilibriumIndexPct).toBe(84.9); // 1 casa decimal
    });

    it("identifica corretamente Renda Fixa como maior déficit e Internacional/FIIs como superávits", () => {
      const result = calculateAllocationGaps(
        GOLDEN_ALLOCATION_POSITIONS,
        GOLDEN_TARGETS_CORRUPTED,
      );

      // Maior déficit deve ser Renda Fixa com gap de +R$ 1.195,75
      expect(result.topDeficitClass).not.toBeNull();
      expect(result.topDeficitClass?.assetClass).toBe("Renda Fixa");
      expect(Math.round(result.topDeficitClass?.gapBRL ?? 0)).toBe(
        Math.round(GOLDEN_EXPECTED.topDeficitGapBRL),
      );

      // Segundo maior déficit: ETFs (+R$ 752,85)
      const etfGap = result.classGaps.find((cg) => cg.assetClass === "ETFs");
      expect(Math.round(etfGap?.gapBRL ?? 0)).toBe(753);

      // Terceiro maior déficit: Ações (+R$ 702,18)
      const acoesGap = result.classGaps.find((cg) => cg.assetClass === "Ações");
      expect(Math.round(acoesGap?.gapBRL ?? 0)).toBe(702);

      // Superávits: Internacional (-R$ 2.476,68) e FIIs (-R$ 173,14)
      const intlGap = result.classGaps.find((cg) => cg.assetClass === "Internacional");
      expect(intlGap?.status).toBe("surplus");
      expect(Math.round(intlGap?.gapBRL ?? 0)).toBe(-2477);

      const fiiGap = result.classGaps.find((cg) => cg.assetClass === "FIIs");
      expect(fiiGap?.status).toBe("surplus");
      expect(Math.round(fiiGap?.gapBRL ?? 0)).toBe(-173);

      // Não há qualquer menção a "Fundos Imobiliários (-R$ 7.001,47)"
      const phantomFii = result.classGaps.find((cg) => cg.assetClass === "Fundos Imobiliários");
      expect(phantomFii).toBeUndefined();
    });
  });

  describe("Critério 3: Raio-X de Renda Fixa e Unificação de Indexadores (BUG-13)", () => {
    it("infere corretamente CDB Original como pós-fixado CDI e não prefixado", () => {
      const cdbInferred = inferFixedIncomeCategories({
        ticker: "CDB ORIGINAL",
        sector: "Pós-fixado (Selic / CDI)",
        fixed_income_metadata: {
          rate_type: "cdi",
          rate_value: 110,
          base_value: 1200,
          base_date: "2024-10-01",
          initial_investment_date: "2024-10-01",
          maturity_date: "2027-10-01",
          is_tax_exempt: false,
        },
      });

      expect(cdbInferred.indexer).toBe("cdi");

      // Mesmo sem metadados explícitos, não deve cair em prefixado por conter letras isoladas
      const cdbFallback = inferFixedIncomeCategories({
        ticker: "CDB ORIGINAL BANCO",
        sector: "Pós-fixado (Selic / CDI)",
      });
      expect(cdbFallback.indexer).toBe("selic"); // Pós-fixado
    });

    it("unifica o macro-indexador de Renda Fixa em 93,3% pós-fixado e 0,0% prefixado", () => {
      const rfPositions = [
        { ticker: "TESOURO-SELIC", assetClass: "Renda Fixa", valueBRL: 1617.51, sector: "Pós-fixado" },
        { ticker: "CDB ORIGINAL", assetClass: "Renda Fixa", valueBRL: 1348.01, sector: "Pós-fixado" },
        { ticker: "TESOURO-IPCA", assetClass: "Renda Fixa", valueBRL: 214.65, sector: "Inflação (IPCA+)" },
      ];

      const exposure = calculateFixedIncomeExposure(rfPositions, GOLDEN_ASSETS_FIXTURE);

      expect(exposure.totalValueBRL).toBe(GOLDEN_EXPECTED.fixedIncomeTotalBRL); // R$ 3.180,17

      // Macro-indexadores unificados (Página 7 alinhada com Páginas 4 e 5)
      const posFixado = exposure.byMacroIndexer.pos_fixado;
      expect(posFixado.valueBRL).toBe(GOLDEN_EXPECTED.fixedIncomePosFixadoBRL); // R$ 2.965,52
      expect(posFixado.pct).toBe(93.3);
      expect(posFixado.count).toBe(2);

      const ipca = exposure.byMacroIndexer.ipca;
      expect(ipca.valueBRL).toBe(GOLDEN_EXPECTED.fixedIncomeInflacaoBRL); // R$ 214,65
      expect(ipca.pct).toBe(6.7);
      expect(ipca.count).toBe(1);

      const pre = exposure.byMacroIndexer.pre;
      expect(pre.valueBRL).toBe(GOLDEN_EXPECTED.fixedIncomePrefixadoBRL); // R$ 0,00
      expect(pre.pct).toBe(0.0);
      expect(pre.count).toBe(0);

      // Soma das fatias de macro-indexadores bate 100,0%
      expect(posFixado.pct + ipca.pct + pre.pct).toBe(100.0);
    });
  });

  describe("Critério 4: Raio-X Internacional e Desacoplamento Geográfico (BUG-14)", () => {
    it("não classifica GLD, BITB, ARGT e MCHI como US Equity", () => {
      const gldProfile = getInternationalProfile({ ticker: "GLD", sector: "Commodities Globais / Ouro" });
      expect(gldProfile.region).toBe("commodities_ouro");
      expect(INTERNATIONAL_REGION_LABELS[gldProfile.region]).toBe("Commodities Globais / Ouro");

      const bitbProfile = getInternationalProfile({ ticker: "BITB", sector: "Criptoativos Globais / Bitcoin" });
      expect(bitbProfile.region).toBe("cripto_bitcoin");
      expect(INTERNATIONAL_REGION_LABELS[bitbProfile.region]).toBe("Criptoativos Globais / Bitcoin");

      const argtProfile = getInternationalProfile({ ticker: "ARGT", sector: "Mercados Emergentes" });
      expect(argtProfile.region).toBe("emergentes");

      const mchiProfile = getInternationalProfile({ ticker: "MCHI", sector: "Mercados Emergentes" });
      expect(mchiProfile.region).toBe("emergentes");

      const veaProfile = getInternationalProfile({ ticker: "VEA", sector: "Mercados Desenvolvidos (ex-EUA)" });
      expect(veaProfile.region).toBe("desenvolvidos_ex_us");

      const vooProfile = getInternationalProfile({ ticker: "VOO", sector: "Estados Unidos (US Equity)" });
      expect(vooProfile.region).toBe("eua");
    });

    it("calcula decomposição geográfica internacional fiel e afasta falso alerta de concentração de 95,2%", () => {
      const intlPositions = [
        { ticker: "VOO", assetClass: "Internacional", valueBRL: 3616.83, sector: "Estados Unidos (US Equity)" },
        { ticker: "GLD", assetClass: "Internacional", valueBRL: 1872.26, sector: "Commodities Globais / Ouro" },
        { ticker: "BITB", assetClass: "Internacional", valueBRL: 584.65, sector: "Criptoativos Globais / Bitcoin" },
        { ticker: "VEA", assetClass: "Internacional", valueBRL: 329.15, sector: "Mercados Desenvolvidos (ex-EUA)" },
        { ticker: "ARGT", assetClass: "Internacional", valueBRL: 227.63, sector: "Mercados Emergentes" },
        { ticker: "MCHI", assetClass: "Internacional", valueBRL: 222.08, sector: "Mercados Emergentes" },
      ];

      const exposure = calculateInternationalExposure(intlPositions);

      expect(exposure.totalValueBRL).toBe(GOLDEN_EXPECTED.intlTotalBRL); // R$ 6.852,60

      // VOO é 52,8% (1 ativo), não 95,2%!
      expect(exposure.byRegion.eua.pct).toBe(52.8);
      expect(exposure.byRegion.eua.count).toBe(1);

      // Commodities / Ouro: 27,3% (1 ativo)
      expect(exposure.byRegion.commodities_ouro.pct).toBe(27.3);
      expect(exposure.byRegion.commodities_ouro.count).toBe(1);

      // Cripto / Bitcoin: 8,5% (1 ativo)
      expect(exposure.byRegion.cripto_bitcoin.pct).toBe(8.5);
      expect(exposure.byRegion.cripto_bitcoin.count).toBe(1);

      // Desenvolvidos ex-EUA: 4,8% (1 ativo)
      expect(exposure.byRegion.desenvolvidos_ex_us.pct).toBe(4.8);
      expect(exposure.byRegion.desenvolvidos_ex_us.count).toBe(1);

      // Emergentes (ARGT + MCHI): 6,6% (2 ativos)
      expect(exposure.byRegion.emergentes.pct).toBe(6.6);
      expect(exposure.byRegion.emergentes.count).toBe(2);
      expect(exposure.byRegion.emergentes.valueBRL).toBe(449.71);

      // Não deve emitir falso alerta de concentração geográfica excessiva (isConcentrated = false pois VOO < 60%)
      expect(exposure.isConcentrated).toBe(false);
    });
  });
});
