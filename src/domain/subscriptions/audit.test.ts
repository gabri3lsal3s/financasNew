import { describe, expect, it } from "vitest";
import {
  auditSubscriptions,
  cleanSubscriptionDescription,
  type ExpenseForAudit,
} from "./audit";

describe("cleanSubscriptionDescription", () => {
  it("limpa prefixos de gateways e adquirentes comuns", () => {
    expect(cleanSubscriptionDescription("PAG*Netflix.com")).toBe("netflix.com");
    expect(cleanSubscriptionDescription("MP*Spotify")).toBe("spotify");
    expect(cleanSubscriptionDescription("AMZN*Prime Video")).toBe("prime video");
  });

  it("remove números de autorização e cartões", () => {
    expect(cleanSubscriptionDescription("Netflix *1234 ref 08/26")).toBe("netflix");
    expect(cleanSubscriptionDescription("Amazon Prime #01")).toBe("amazon prime");
  });
});

describe("auditSubscriptions", () => {
  it("retorna resultado vazio quando não há despesas", () => {
    const res = auditSubscriptions([]);
    expect(res.subscriptions).toEqual([]);
    expect(res.totalMonthlyCents).toBe(0);
    expect(res.increasedSubscriptionsCount).toBe(0);
  });

  it("ignora categoricamente compras parceladas (QG3 / Anti-Falso-Positivo)", () => {
    const expenses: ExpenseForAudit[] = [
      {
        id: "exp-1",
        description: "Smartphone Samsung",
        amountCents: 20000,
        date: "2026-08-10",
        installments_total: 10,
      },
      {
        id: "exp-2",
        description: "Smartphone Samsung",
        amountCents: 20000,
        date: "2026-09-10",
        installments_total: 10,
      },
    ];

    const res = auditSubscriptions(expenses);
    expect(res.subscriptions).toHaveLength(0);
  });

  it("detecta aumento de preço acima do limiar e calcula impacto anualizado", () => {
    const expenses: ExpenseForAudit[] = [
      {
        id: "exp-1",
        description: "Netflix Premium",
        amountCents: 5590, // R$ 55,90
        date: "2026-07-05",
      },
      {
        id: "exp-2",
        description: "Netflix Premium",
        amountCents: 5590,
        date: "2026-08-05",
      },
      {
        id: "exp-3",
        description: "Netflix Premium",
        amountCents: 6290, // R$ 62,90 (+R$ 7,00 = +12.5%)
        date: "2026-09-05",
      },
    ];

    const res = auditSubscriptions(expenses);
    expect(res.subscriptions).toHaveLength(1);

    const sub = res.subscriptions[0]!;
    expect(sub.serviceKey).toBe("netflixpremium");
    expect(sub.previousCents).toBe(5590);
    expect(sub.currentCents).toBe(6290);
    expect(sub.deltaCents).toBe(700);
    expect(sub.deltaPercent).toBe(12.5);
    expect(sub.hasPriceIncrease).toBe(true);
    expect(sub.isExchangeFluctuation).toBe(false);
    expect(sub.annualizedImpactCents).toBe(8400); // 12 x 700 = R$ 84,00

    expect(res.increasedSubscriptionsCount).toBe(1);
    expect(res.totalAnnualizedIncreaseCents).toBe(8400);
  });

  it("neutraliza oscilações cambiais/IOF pequenas (< 3% e < R$ 3,00) sem emitir alerta crítico", () => {
    const expenses: ExpenseForAudit[] = [
      {
        id: "exp-1",
        description: "Github Copilot Pro",
        amountCents: 5500, // R$ 55,00
        date: "2026-08-01",
      },
      {
        id: "exp-2",
        description: "Github Copilot Pro",
        amountCents: 5550, // R$ 55,50 (+R$ 0,50 = +0.9%)
        date: "2026-09-01",
      },
    ];

    const res = auditSubscriptions(expenses);
    expect(res.subscriptions).toHaveLength(1);

    const sub = res.subscriptions[0]!;
    expect(sub.deltaCents).toBe(50);
    expect(sub.hasPriceIncrease).toBe(false); // Não é reajuste contratual!
    expect(sub.isExchangeFluctuation).toBe(true);
    expect(sub.annualizedImpactCents).toBe(0);
    expect(res.increasedSubscriptionsCount).toBe(0);
  });
});
