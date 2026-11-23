import { describe, expect, it } from "vitest";
import {
  computeProjectedPatrimonyWithProvisioned,
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
});
