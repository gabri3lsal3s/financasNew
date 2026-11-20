import { describe, expect, it } from "vitest";
import {
  buildCardLimitBreakdown,
  buildInvoiceBreakdown,
} from "./invoice-breakdown";

describe("buildInvoiceBreakdown", () => {
  it("constrói a memória de cálculo para fatura simples com saldo aberto", () => {
    const breakdown = buildInvoiceBreakdown({
      cardName: "Nubank Ultravioleta",
      month: "2026-08",
      previstoBrutoCents: 150000,
      pagoCents: 50000,
      saldoBrutoCents: 100000,
    });

    expect(breakdown.id).toBe("card-invoice-nubank-ultravioleta-2026-08");
    expect(breakdown.title).toBe("Fatura de Nubank Ultravioleta");
    expect(breakdown.result.rawValue).toBe(100000);
    expect(breakdown.result.tone).toBe("negative");
    expect(breakdown.steps).toHaveLength(2); // Compras e Pagamentos
  });

  it("detalha compras à vista e parceladas quando discriminadas", () => {
    const breakdown = buildInvoiceBreakdown({
      cardName: "Itaú Personnalité",
      month: "2026-08",
      previstoBrutoCents: 200000,
      regularExpensesCents: 120000,
      installmentExpensesCents: 80000,
      pagoCents: 0,
      saldoBrutoCents: 200000,
    });

    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.steps[0]?.label).toBe("Compras do Mês à Vista (1x)");
    expect(breakdown.steps[0]?.rawValue).toBe(120000);
    expect(breakdown.steps[1]?.label).toBe("Parcelas de Compras Anteriores");
    expect(breakdown.steps[1]?.rawValue).toBe(80000);
  });

  it("inclui crédito anterior e estornos abatendo o saldo da fatura", () => {
    const breakdown = buildInvoiceBreakdown({
      cardName: "XP Visa Infinite",
      month: "2026-08",
      previstoBrutoCents: 100000,
      creditoAnteriorCents: 20000,
      estornoCents: 15000,
      pagoCents: 30000,
      saldoBrutoCents: 35000,
    });

    expect(breakdown.steps).toHaveLength(4);
    expect(breakdown.result.rawValue).toBe(35000);
    expect(breakdown.inclusions).toContain(
      "Compras à vista (1x) efetuadas dentro do período de faturamento",
    );
  });

  it("trata crédito restante que transborda para a próxima fatura", () => {
    const breakdown = buildInvoiceBreakdown({
      cardName: "Nubank",
      month: "2026-08",
      previstoBrutoCents: 50000,
      pagoCents: 80000,
      creditoRestanteCents: 30000,
      saldoBrutoCents: 0,
    });

    expect(breakdown.result.rawValue).toBe(0);
    expect(breakdown.result.label).toBe("Fatura Paga / Zerada");
    expect(breakdown.notes?.[0]).toContain("Crédito Transbordado");
  });
});

describe("buildCardLimitBreakdown", () => {
  it("calcula o limite disponível e percentual de uso", () => {
    const breakdown = buildCardLimitBreakdown({
      cardName: "C6 Carbon",
      totalLimitCents: 1000000,
      usedLimitCents: 350000,
      availableLimitCents: 650000,
      usagePercentage: 35,
    });

    expect(breakdown.id).toBe("card-limit-c6-carbon");
    expect(breakdown.title).toBe("Limite do Cartão (C6 Carbon)");
    expect(breakdown.steps).toHaveLength(2);
    expect(breakdown.result.rawValue).toBe(650000);
    expect(breakdown.result.hint).toContain("35% do limite total");
  });
});
