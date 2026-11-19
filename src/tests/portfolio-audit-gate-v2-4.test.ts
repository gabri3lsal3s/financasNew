/**
 * Portão de Qualidade v2.4 (Gate v2.4)
 * Certificação da Fonte Única de Classificação de Renda Fixa (§Bloco 4).
 *
 * Módulo puro e desacoplado de banco, React e UI.
 */

import { describe, expect, it } from "vitest";
import { resolveFixedIncomeIndexer } from "@/domain/portfolio/tickers-catalog";
import { calculateFixedIncomeExposure } from "@/domain/portfolio/class-breakdown";
import { evaluatePortfolioCanonicalState } from "@/domain/portfolio/canonical-engine";
import {
  GOLDEN_ASSETS_FIXTURE,
  GOLDEN_AS_OF_DATE,
  GOLDEN_PTAX_RATE,
  GOLDEN_TRANSACTIONS_FIXTURE,
} from "./fixtures/golden_portfolio_6445";

describe("Portão de Qualidade v2.4 (Gate v2.4) — Fonte Única de Indexador de Renda Fixa", () => {
  describe("Critério 1: Helper Canônico resolveFixedIncomeIndexer", () => {
    it("classifica CDB ORIGINAL como Prefixado com taxa de 13,58% a.a.", () => {
      const res = resolveFixedIncomeIndexer({
        ticker: "CDB ORIGINAL",
        notes: "CDB Banco Original 13,58% a.a. Venc Jul/2027",
      });

      expect(res.macroKey).toBe("pre");
      expect(res.macroLabel).toBe("Prefixado");
      expect(res.detailKey).toBe("pre");
      expect(res.detailLabel).toContain("Prefixado");
    });

    it("classifica TESOURO-SELIC como Pós-fixado com detalhe Selic", () => {
      const res = resolveFixedIncomeIndexer({
        ticker: "TESOURO-SELIC",
        notes: "Tesouro Selic 2029",
      });

      expect(res.macroKey).toBe("pos_fixado");
      expect(res.macroLabel).toBe("Pós-fixado (Selic / CDI)");
      expect(res.detailKey).toBe("selic");
      expect(res.detailLabel).toBe("Selic");
    });

    it("classifica TESOURO-IPCA como Inflação (IPCA+)", () => {
      const res = resolveFixedIncomeIndexer({
        ticker: "TESOURO-IPCA",
        notes: "Tesouro IPCA+ 2035",
      });

      expect(res.macroKey).toBe("ipca");
      expect(res.macroLabel).toBe("Inflação (IPCA+)");
      expect(res.detailKey).toBe("ipca");
      expect(res.detailLabel).toBe("IPCA+");
    });
  });

  describe("Critério 2: Invariante Inviolável de Distribuição da Renda Fixa", () => {
    it("garante a distribuição canônica (42,4% Prefixado, 50,9% Pós-fixado, 6,7% Inflação) na decomposição", () => {
      const rfPositions = [
        { ticker: "TESOURO-SELIC", assetClass: "Renda Fixa", valueBRL: 1617.51, sector: "Pós-fixado (Selic / CDI)" },
        { ticker: "CDB ORIGINAL", assetClass: "Renda Fixa", valueBRL: 1348.01, sector: "Prefixado" },
        { ticker: "TESOURO-IPCA", assetClass: "Renda Fixa", valueBRL: 214.65, sector: "Inflação (IPCA+)" },
      ];

      const exposure = calculateFixedIncomeExposure(rfPositions, GOLDEN_ASSETS_FIXTURE);

      expect(exposure.totalValueBRL).toBe(3180.17);

      // 1. Prefixado (CDB Original)
      const pre = exposure.byMacroIndexer.pre;
      expect(pre.valueBRL).toBe(1348.01);
      expect(pre.pct).toBe(42.4);
      expect(pre.count).toBe(1);

      // 2. Pós-fixado (Tesouro Selic)
      const pos = exposure.byMacroIndexer.pos_fixado;
      expect(pos.valueBRL).toBe(1617.51);
      expect(pos.pct).toBe(50.9);
      expect(pos.count).toBe(1);

      // 3. Inflação (Tesouro IPCA+)
      const ipca = exposure.byMacroIndexer.ipca;
      expect(ipca.valueBRL).toBe(214.65);
      expect(ipca.pct).toBe(6.7);
      expect(ipca.count).toBe(1);
    });

    it("assegura que o motor canônico deriva os setores corretos na custódia de renda fixa", () => {
      const state = evaluatePortfolioCanonicalState({
        asOfDate: GOLDEN_AS_OF_DATE,
        mode: "instant",
        assets: GOLDEN_ASSETS_FIXTURE,
        transactions: GOLDEN_TRANSACTIONS_FIXTURE,
        cashBalance: 0.96,
        usdRate: GOLDEN_PTAX_RATE,
      });

      const cdb = state.holdings.find((h) => h.ticker === "CDB ORIGINAL");
      expect(cdb).toBeDefined();
      expect(cdb?.sector).toBe("Prefixado");

      const selic = state.holdings.find((h) => h.ticker === "TESOURO-SELIC");
      expect(selic).toBeDefined();
      expect(selic?.sector).toBe("Pós-fixado (Selic / CDI)");

      const tesouroIpca = state.holdings.find((h) => h.ticker === "TESOURO-IPCA");
      expect(tesouroIpca).toBeDefined();
      expect(tesouroIpca?.sector).toBe("Inflação (IPCA+)");
    });
  });
});
