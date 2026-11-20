import { describe, expect, it } from "vitest";
import {
  buildAporteAssetRouteBreakdown,
  buildAporteBreakdown,
} from "./aporte-breakdown";

describe("domain/calculation-memory/builders/aporte-breakdown", () => {
  describe("buildAporteBreakdown", () => {
    it("decompõe a verba de aporte, alocações por classe e resíduo seguro em caixa", () => {
      const breakdown = buildAporteBreakdown({
        aporteTotalBRL: 5000,
        pocketAmountBRL: 4000,
        cashUsedBRL: 1000,
        totalAllocatedBRL: 4850,
        leftoverBRL: 150,
        classSummaries: [
          {
            className: "Ações Brasil",
            targetPct: 40,
            targetValueBRL: 40000,
            currentValueBRL: 30000,
            gapBRL: 10000,
            budgetAllocatedBRL: 3000,
            actualAllocatedBRL: 2950,
          },
          {
            className: "Fundos Imobiliários",
            targetPct: 30,
            targetValueBRL: 30000,
            currentValueBRL: 25000,
            gapBRL: 5000,
            budgetAllocatedBRL: 1900,
            actualAllocatedBRL: 1900,
          },
        ],
        strategy: "optimized",
      });

      expect(breakdown.id).toBe("portfolio-aporte-cockpit-breakdown");
      expect(breakdown.unit).toBe("currency");
      expect(breakdown.result.rawValue).toBe(485000); // R$ 4.850,00
      expect(breakdown.result.formattedValue).toContain("4.850,00");

      // Passos do bolso e caixa
      const pocketStep = breakdown.steps.find((s) => s.label.includes("Dinheiro Novo do Bolso"));
      expect(pocketStep?.rawValue).toBe(400000);

      const cashStep = breakdown.steps.find((s) => s.label.includes("Saldo em Caixa da Corretora"));
      expect(cashStep?.rawValue).toBe(100000);

      // Passos de classes
      const acoesStep = breakdown.steps.find((s) => s.label.includes("Ações Brasil"));
      expect(acoesStep?.rawValue).toBe(295000);

      const fiiStep = breakdown.steps.find((s) => s.label.includes("Fundos Imobiliários"));
      expect(fiiStep?.rawValue).toBe(190000);

      // Sobra não alocada
      const leftoverStep = breakdown.steps.find((s) => s.label.includes("Sobra Não Alocada"));
      expect(leftoverStep?.rawValue).toBe(15000);
      expect(leftoverStep?.formattedValue).toContain("150,00");

      // Invariante aditiva de orçamento
      expect(breakdown.result.rawValue + (leftoverStep?.rawValue ?? 0)).toBe(500000);
    });

    it("resolve AUD-08 exibindo justificativas explícitas para ativos preteridos e travas", () => {
      const breakdown = buildAporteBreakdown({
        aporteTotalBRL: 1000,
        totalAllocatedBRL: 900,
        leftoverBRL: 100,
        skippedAssets: [
          {
            assetId: "1",
            ticker: "VALE3",
            assetClass: "Ações",
            reason: "price_exceeds_budget",
          },
          {
            assetId: "2",
            ticker: "PETR4",
            assetClass: "Ações",
            reason: "above_target",
          },
          {
            assetId: "3",
            ticker: "OIBR3",
            assetClass: "Ações",
            reason: "quarantine",
          },
        ],
        pausedAssets: [
          {
            assetId: "4",
            ticker: "MGLU3",
            assetClass: "Ações",
            reason: "quality_lock",
            currentValueBRL: 1000,
            targetValueBRL: 2000,
            detail: "Nota 4/10",
          },
        ],
      });

      // Deve listar nos notes os diagnósticos de corte
      expect(breakdown.notes?.some((n) => n.includes("VALE3"))).toBe(true);
      expect(breakdown.notes?.some((n) => n.includes("Preço supera a verba restante"))).toBe(true);
      expect(breakdown.notes?.some((n) => n.includes("atingiram ou superaram a meta ideal"))).toBe(true);
      expect(breakdown.notes?.some((n) => n.includes("OIBR3"))).toBe(true);
      expect(breakdown.notes?.some((n) => n.includes("MGLU3"))).toBe(true);
      expect(breakdown.notes?.some((n) => n.includes("Trava de qualidade fundamentalista"))).toBe(true);
    });
  });

  describe("buildAporteAssetRouteBreakdown", () => {
    it("constrói a memória de cálculo de uma ordem de compra sugerida", () => {
      const breakdown = buildAporteAssetRouteBreakdown({
        ticker: "ITSA4",
        assetClass: "Ações",
        sector: "Financeiro",
        currentValueBRL: 5000,
        targetValueBRL: 8000,
        gapBRL: 3000,
        priceBRL: 10.5,
        quantity: 50,
        allocatedBRL: 525,
        effectiveTargetPct: 8.0,
        reasonLabel: "Maior déficit relativo do setor financeiro",
      });

      expect(breakdown.id).toBe("aporte-route-itsa4");
      expect(breakdown.result.rawValue).toBe(52500); // R$ 525,00
      expect(breakdown.result.formattedValue).toContain("525,00");

      const qtyStep = breakdown.steps.find((s) => s.label.includes("Quantidade Sugerida"));
      expect(qtyStep?.rawValue).toBe(50);
      expect(qtyStep?.unit).toBe("count");

      const priceStep = breakdown.steps.find((s) => s.label.includes("Cotação de Mercado"));
      expect(priceStep?.rawValue).toBe(1050); // 1050 centavos

      expect(breakdown.notes?.some((n) => n.includes("Maior déficit relativo"))).toBe(true);
    });
  });
});
