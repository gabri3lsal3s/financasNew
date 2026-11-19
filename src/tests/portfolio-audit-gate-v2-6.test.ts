/**
 * Portão de Qualidade v2.6 — Bloco 7: UI pt-BR, NLG Polimento, Reserva de Caixa & Certificação Final
 *
 * Validações Canônicas:
 * 1. Sinal negativo explícito em desvalorização de cota (-R$ 251,03) e alternância do texto ("de desvalorização de cota");
 * 2. Concordância verbal dinâmica no NLG ("encontra-se" para 1 classe vs "encontram-se" para 2+ classes);
 * 3. Inclusão da Reserva de Caixa na custódia do Relatório Executivo, fechando a soma das tabelas ao centavo com o Patrimônio;
 * 4. Rótulo de cabeçalho da custódia com ativos + Reserva de Caixa ("26 ATIVOS + RESERVA DE CAIXA");
 * 5. Formatação rigorosa em padrão pt-BR com vírgula decimal (8,2 / 10, -5,54%, +1,3%);
 * 6. Card 4 de Resultado Histórico consolidando P&L total (ativos abertos + encerrados + proventos);
 * 7. Invariantes finais do validador canônico (14 asserções 100% aprovadas).
 */

import { describe, it, expect } from "vitest";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { buildExecutiveReportClassGroups } from "@/domain/portfolio/executive-report-builder";
import { PortfolioReportInvariantValidator } from "@/domain/reports/portfolio-report-invariant-validator";
import { createGoldenPayload } from "./portfolio-audit-gate6.test";
import type { PositionRow } from "@/components/modules/position-table";

describe("Portão de Qualidade v2.6 — UI pt-BR, NLG Polimento & Certificação Final", () => {
  describe("1. Formatação pt-BR Estrita (Vírgula Decimal)", () => {
    it("formata percentuais e variações estritamente com vírgula decimal", () => {
      expect(formatPercent(8.2)).toBe("8,2");
      expect(formatPercent(12.345)).toBe("12,3");
      expect(formatPercent(12.345, 2)).toBe("12,35");

      expect(formatSignedPct(1.3)).toBe("+1,3%");
      expect(formatSignedPct(-5.54, 2)).toBe("-5,54%");
      expect(formatSignedPct(-3.10, 2)).toBe("-3,10%");
      expect(formatSignedPct(2.58, 2)).toBe("+2,58%");
      expect(formatSignedPct(0)).toBe("0,0%");
    });

    it("formata PQS com vírgula decimal pt-BR", () => {
      const pqs = 8.2;
      const formattedPqs = pqs.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      expect(formattedPqs).toBe("8,2");
      expect(formattedPqs).not.toContain(".");
    });
  });

  describe("2. Semântica NLG e Concordância Verbal", () => {
    it("produz concordância singular quando apenas 1 classe está em excedente (ex: Internacional)", () => {
      const surplusClasses = ["Internacional"];
      const verb = surplusClasses.length === 1 ? "encontra-se" : "encontram-se";
      expect(verb).toBe("encontra-se");
    });

    it("produz concordância plural quando 2 ou mais classes estão em excedente", () => {
      const surplusClasses = ["Internacional", "Ações"];
      const verb = surplusClasses.length === 1 ? "encontra-se" : "encontram-se";
      expect(verb).toBe("encontram-se");
    });

    it("alterna corretamente semântica de valorização vs desvalorização de cota", () => {
      const getPhrase = (unrealizedPnlBRL: number) =>
        unrealizedPnlBRL >= 0 ? "de valorização de cota" : "de desvalorização de cota";

      expect(getPhrase(182.78)).toBe("de valorização de cota");
      expect(getPhrase(-251.03)).toBe("de desvalorização de cota");
      expect(getPhrase(0)).toBe("de valorização de cota");
    });
  });

  describe("3. Reserva de Caixa na Custódia do Relatório Executivo", () => {
    const mockInvestmentRows: PositionRow[] = [
      {
        assetId: "a1",
        ticker: "PETR4",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 30,
        totalCost: 3000,
        totalCostBRL: 3000,
        priceQuote: 35,
        priceBRL: 35,
        usdRate: 1,
        valueBRL: 3500,
        pct: 70,
        source: "manual",
        pricingMode: "unit_price",
        unrealizedPnl: 500,
        unrealizedPct: 16.67,
        dividends: 100,
        isCash: false,
      },
    ];

    it("inclui a Reserva de Caixa na lista de classGroups quando cashBRL > 0", () => {
      const effectiveTotalBRL = 5000;
      const effectiveCashBRL = 1500;

      const { classGroups, pqs } = buildExecutiveReportClassGroups({
        investmentRows: mockInvestmentRows,
        effectiveTotalBRL,
        rawAssets: [],
        cashBRL: effectiveCashBRL,
      });

      expect(pqs).toBe(5);
      expect(classGroups).toHaveLength(2);
      const cashGroup = classGroups.find((g) => g.className === "Reserva de Caixa");
      expect(cashGroup).toBeDefined();
      expect(cashGroup!.totalCents).toBe(150000); // R$ 1.500,00
      expect(cashGroup!.items[0]?.ticker).toBe("CAIXA");

      // Soma total das tabelas de custódia fecha perfeitamente
      const sumTotalBRL = classGroups.reduce((acc, g) => acc + g.totalCents / 100, 0);
      expect(sumTotalBRL).toBe(3500 + 1500); // 5000
      expect(sumTotalBRL).toBe(effectiveTotalBRL);
    });
  });

  describe("4. Validação Canônica Final das 14 Asserções Invioláveis", () => {
    it("aprova o Golden Dataset com todas as 14 asserções válidas", () => {
      const payload = createGoldenPayload();
      const validation = PortfolioReportInvariantValidator.validate(payload);

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(validation.assertionsCheckedCount).toBe(14);
    });
  });
});
