import { describe, expect, it } from "vitest";
import {
  computeMonthlyForecastSummary,
  computeProjectedPatrimonyWithProvisioned,
  filterMonthlyForecastDividends,
  suggestedDividendToSummaryItem,
  summarizeProvisionedDividends,
  userDividendEventToSummaryItem,
} from "./provisioned-dividends";

describe("provisioned-dividends — agregação e isolamento contábil estrito", () => {
  it("consolida apenas eventos PROVISIONED e PENDING_CONFIRMATION em centavos com câmbio USD->BRL", () => {
    const summary = summarizeProvisionedDividends(
      [
        { status: "PENDING_CONFIRMATION", netAmount: 150.25, currency: "BRL", isTypeUncertain: true },
        { status: "PROVISIONED", netAmount: 20.0, currency: "USD", isTypeUncertain: false }, // 20 * 5.50 = 110.00 BRL
        { status: "SETTLED", netAmount: 500.0, currency: "BRL" },
        { status: "DISMISSED", netAmount: 200.0, currency: "BRL" },
      ],
      5.5,
    );

    expect(summary.pendingCount).toBe(1);
    expect(summary.provisionedCount).toBe(1);
    expect(summary.totalCount).toBe(2);
    expect(summary.hasUncertainTax).toBe(true);
    expect(summary.totalPendingBRLCents).toBe(15025);
    expect(summary.totalProvisionedBRLCents).toBe(11000);
    expect(summary.totalReceivableBRLCents).toBe(26025);
    expect(summary.totalReceivableUSDCents).toBe(2000);
    expect(summary.totalReceivableNativeBRLCents).toBe(15025);
    expect(summary.fxRateUsed).toBe(5.5);
  });

  it("computeProjectedPatrimonyWithProvisioned preserva closingPatrimonyCents inalterado", () => {
    const summary = summarizeProvisionedDividends(
      [
        suggestedDividendToSummaryItem({
          status: "available",
          totalAmount: 100,
          currency: "BRL",
        }),
        userDividendEventToSummaryItem({
          status: "PROVISIONED",
          net_amount: 50,
          currency: "BRL",
          is_type_uncertain: false,
        }),
      ],
      5.25,
    );

    const projected = computeProjectedPatrimonyWithProvisioned(10_000_00, summary);
    expect(projected.closingPatrimonyCents).toBe(10_000_00);
    expect(projected.receivableBRLCents).toBe(150_00);
    expect(projected.projectedPatrimonyCents).toBe(10_150_00);
  });

  it("S4: exclui antigos >120d sem data das projeções mantendo contagem operacional, e arredonda USD por linha", () => {
    const summary = summarizeProvisionedDividends(
      [
        // Duas linhas USD de $0.01 a 5.4 => Math.round(1 * 5.4) = 5 centavos cada (10c, não 11c)
        { status: "PROVISIONED", netAmount: 0.01, currency: "USD", paymentDate: "2026-10-20" },
        { status: "PROVISIONED", netAmount: 0.01, currency: "USD", paymentDate: null },
        // Antigo >120d sem data entra na contagem operacional (pendingCount), mas não em totalReceivableBRLCents
        {
          status: "PENDING_CONFIRMATION",
          netAmount: 90.0,
          currency: "BRL",
          paymentDate: null,
          isOver120DaysWithoutPayment: true,
        },
        // Vencido anterior a hoje no mesmo mês não entra em monthlyForecast
        { status: "PENDING_CONFIRMATION", netAmount: 20.0, currency: "BRL", paymentDate: "2026-10-05" },
      ],
      5.4,
      { referenceDate: "2026-10-15", forecastMonth: "2026-10" },
    );

    expect(summary.totalProvisionedBRLCents).toBe(10);
    expect(summary.totalPendingBRLCents).toBe(2000);
    expect(summary.totalReceivableBRLCents).toBe(2010);
    expect(summary.pendingCount).toBe(2);
    expect(summary.over120DaysWithoutPaymentCount).toBe(1);
    expect(summary.datelessProvisionedCount).toBe(1);
    expect(summary.monthlyForecastCount).toBe(1);
    expect(summary.monthlyForecastBRLCents).toBe(5);
  });

  it("S4: filterMonthlyForecastDividends e computeMonthlyForecastSummary consideram apenas M de hoje em diante", () => {
    const items = [
      { status: "PENDING_CONFIRMATION" as const, netAmount: 30, currency: "BRL" as const, paymentDate: "2026-10-10" }, // vencido
      { status: "PROVISIONED" as const, netAmount: 40, currency: "BRL" as const, paymentDate: "2026-10-15" }, // hoje
      { status: "PROVISIONED" as const, netAmount: 50, currency: "BRL" as const, paymentDate: "2026-10-28" }, // futuro no mês
      { status: "PROVISIONED" as const, netAmount: 60, currency: "BRL" as const, paymentDate: "2026-11-05" }, // outro mês
      { status: "PROVISIONED" as const, netAmount: 70, currency: "BRL" as const, paymentDate: null }, // sem data
    ];
    expect(filterMonthlyForecastDividends(items, "2026-10", "2026-10-15")).toHaveLength(2);
    const forecast = computeMonthlyForecastSummary(items, "2026-10", "2026-10-15", 5.0);
    expect(forecast.count).toBe(2);
    expect(forecast.totalBRLCents).toBe(9000);
  });
});
