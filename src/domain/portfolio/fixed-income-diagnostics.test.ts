import { describe, expect, it } from "vitest";
import {
  calculateFixedIncomeDiagnostics,
  classifyMaturityBucket,
  inferFixedIncomeRateType,
  type FixedIncomePositionInput,
} from "./fixed-income-diagnostics";

describe("Fixed Income Diagnostics (Fase 6)", () => {
  const refDate = "2026-06-01";

  describe("inferFixedIncomeRateType", () => {
    it("utiliza rate_type de metadata quando presente", () => {
      expect(
        inferFixedIncomeRateType("TICKER-GENERICO", null, {
          rate_type: "ipca",
          rate_value: 6,
          base_date: "2026-01-01",
        }),
      ).toBe("ipca");
    });

    it("infere corretamente do ticker e nome por palavras-chave", () => {
      expect(inferFixedIncomeRateType("TESOURO IPCA 2035", null)).toBe("ipca");
      expect(inferFixedIncomeRateType("TESOURO SELIC 2029", null)).toBe("selic");
      expect(inferFixedIncomeRateType("LTN 2027", "Tesouro Prefixado")).toBe("pre");
      expect(inferFixedIncomeRateType("CDB BANCO INTER", null)).toBe("cdi");
      expect(inferFixedIncomeRateType("LCI CAIXA", null)).toBe("cdi");
      expect(inferFixedIncomeRateType("CRI ALIANSCE", "IGPM + 8%")).toBe("igpm");
      expect(inferFixedIncomeRateType("DEBENTURE DESCONHECIDA", null)).toBe("outros");
    });
  });

  describe("classifyMaturityBucket", () => {
    it("classifica como liquidez/sem vencimento quando a data for nula ou vazia", () => {
      expect(classifyMaturityBucket(null, refDate)).toEqual({
        key: "liquid_or_none",
        label: "Liquidez / Sem vencimento",
        isOverdue: false,
      });
      expect(classifyMaturityBucket("", refDate)).toEqual({
        key: "liquid_or_none",
        label: "Liquidez / Sem vencimento",
        isOverdue: false,
      });
    });

    it("classifica datas passadas como vencido", () => {
      const res = classifyMaturityBucket("2026-01-01", refDate);
      expect(res.key).toBe("up_to_1y");
      expect(res.isOverdue).toBe(true);
      expect(res.label).toBe("Vencido / Imediato");
    });

    it("classifica prazos futuros nas faixas corretas", () => {
      // 6 meses à frente
      expect(classifyMaturityBucket("2026-12-01", refDate).key).toBe("up_to_1y");
      // 18 meses à frente (~548 dias)
      expect(classifyMaturityBucket("2027-12-01", refDate).key).toBe("1y_to_2y");
      // 3 anos à frente (~1095 dias)
      expect(classifyMaturityBucket("2029-06-01", refDate).key).toBe("2y_to_5y");
      // 7 anos à frente
      expect(classifyMaturityBucket("2033-06-01", refDate).key).toBe("above_5y");
    });
  });

  describe("calculateFixedIncomeDiagnostics", () => {
    it("lida serenamente com carteira vazia ou sem títulos de renda fixa", () => {
      const rows: FixedIncomePositionInput[] = [
        { assetId: "a1", ticker: "PETR4", assetClass: "Ações", valueBRL: 10000 },
        { assetId: "a2", ticker: "VALE3", assetClass: "Ações", valueBRL: 15000 },
      ];

      const res = calculateFixedIncomeDiagnostics(rows, 25000, refDate);
      expect(res.totalFixedIncomeBRL).toBe(0);
      expect(res.shareInPortfolioPct).toBe(0);
      expect(res.indexers).toHaveLength(0);
      expect(res.maturities).toHaveLength(0);
      expect(res.issuers).toHaveLength(0);
      expect(res.fgcExceededCount).toBe(0);
    });

    it("consolida emissores privados, detecta estouro do FGC e isenção fiscal", () => {
      const rows: FixedIncomePositionInput[] = [
        // Emissor BMG: soma R$ 300.000 (> R$ 250.000 FGC)
        {
          assetId: "rf1",
          ticker: "CDB-BMG-2027",
          name: "CDB Banco BMG",
          assetClass: "Renda Fixa",
          valueBRL: 200000,
          maturityDate: "2027-12-01",
          fixedIncomeMetadata: {
            rate_type: "cdi",
            rate_value: 120,
            base_date: "2026-01-01",
            issuer_type: "bancario_fgc",
          },
        },
        {
          assetId: "rf2",
          ticker: "LCI-BMG-2028",
          name: "LCI Banco BMG",
          assetClass: "Renda Fixa",
          valueBRL: 100000,
          maturityDate: "2028-06-01",
          fixedIncomeMetadata: {
            rate_type: "cdi",
            rate_value: 95,
            base_date: "2026-01-01",
            is_tax_exempt: true,
            issuer_type: "bancario_fgc",
          },
        },
        // Tesouro Direto: R$ 400.000 (soberano, sem risco FGC)
        {
          assetId: "rf3",
          ticker: "TESOURO-IPCA-2035",
          name: "Tesouro IPCA+ 2035",
          assetClass: "Renda Fixa",
          valueBRL: 400000,
          maturityDate: "2035-05-15",
          fixedIncomeMetadata: {
            rate_type: "ipca",
            rate_value: 6.2,
            base_date: "2026-01-01",
            issuer_type: "tesouro",
          },
        },
      ];

      const res = calculateFixedIncomeDiagnostics(rows, 700000, refDate);

      // Totais gerais
      expect(res.totalFixedIncomeBRL).toBe(700000);
      expect(res.shareInPortfolioPct).toBe(100);

      // Isenção fiscal: LCI BMG (R$ 100.000)
      expect(res.taxExemptValueBRL).toBe(100000);
      expect(res.taxExemptSharePct).toBeCloseTo((100000 / 700000) * 100, 1);

      // Indexadores: IPCA (400k) e CDI (300k)
      expect(res.indexers).toHaveLength(2);
      expect(res.indexers[0]?.rateType).toBe("ipca");
      expect(res.indexers[0]?.totalBRL).toBe(400000);
      expect(res.indexers[1]?.rateType).toBe("cdi");
      expect(res.indexers[1]?.totalBRL).toBe(300000);

      // Maturidades: 1y_to_2y (2027), 2y_to_5y (2028), above_5y (2035)
      expect(res.maturities.some((m) => m.bucketKey === "1y_to_2y")).toBe(true);
      expect(res.maturities.some((m) => m.bucketKey === "2y_to_5y")).toBe(true);
      expect(res.maturities.some((m) => m.bucketKey === "above_5y")).toBe(true);

      // Emissores
      expect(res.issuers).toHaveLength(2);
      const bmgIssuer = res.issuers.find((i) => i.issuerKey === "banco_bmg");
      expect(bmgIssuer).toBeDefined();
      expect(bmgIssuer?.issuerLabel).toBe("Banco BMG");
      expect(bmgIssuer?.totalBRL).toBe(300000);
      expect(bmgIssuer?.isFgcExceeded).toBe(true); // 300k > 250k
      expect(bmgIssuer?.isConcentratedInRF).toBe(true); // 300k / 700k = 42.8% > 30%

      const tesouroIssuer = res.issuers.find((i) => i.issuerKey === "tesouro_nacional");
      expect(tesouroIssuer).toBeDefined();
      expect(tesouroIssuer?.issuerLabel).toBe("Tesouro Nacional");
      expect(tesouroIssuer?.isFgcExceeded).toBe(false); // Soberano

      expect(res.fgcExceededCount).toBe(1);
    });
  });
});
