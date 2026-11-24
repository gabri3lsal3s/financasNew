import { describe, expect, it } from "vitest";
import {
  computeEndingInstallmentsRelief,
  computeOptimalSurplusAllocation,
  detectCrossMethodDuplicateSubscriptions,
} from "./holistic-opportunities";
import type { ExpenseLike } from "./recurrences";

describe("holistic-opportunities", () => {
  it("detecta assinatura duplicada em cartões ou meios distintos no mesmo mês (inclusive no 1º mês)", () => {
    const expenses: ExpenseLike[] = [
      {
        id: "e1",
        description: "Spotify Familia",
        month: "2026-11",
        date: "2026-11-05",
        valueCents: 3490,
        categoryId: "cat-sub",
        paymentMethod: "credit_card",
        cardId: "card-nubank",
        cardName: "Nubank",
      },
      {
        id: "e2",
        description: "SPOTIFY*ASSINAT",
        month: "2026-11",
        date: "2026-11-12",
        valueCents: 3490,
        categoryId: "cat-sub",
        paymentMethod: "pix",
        cardId: null,
      },
      // Enel (utilities) cobrada 2x em meios distintos não deve disparar falso positivo de assinatura
      {
        id: "e3",
        description: "Enel Energia",
        month: "2026-11",
        date: "2026-11-08",
        valueCents: 18000,
        categoryId: "cat-casa",
        paymentMethod: "pix",
      },
      {
        id: "e4",
        description: "Enel Energia",
        month: "2026-11",
        date: "2026-11-18",
        valueCents: 19500,
        categoryId: "cat-casa",
        paymentMethod: "debit",
      },
    ];

    const merchantAliasMap = new Map<string, string>([
      ["spotify*assinat", "spotify"],
      ["spotify familia", "spotify"],
    ]);

    const dups = detectCrossMethodDuplicateSubscriptions(expenses, {
      referenceMonth: "2026-11",
      merchantAliasMap,
    });

    expect(dups).toHaveLength(1);
    expect(dups[0]).toMatchObject({
      key: "spotify",
      count: 2,
      totalChargedCents: 6980,
      estimatedExtraCents: 3490,
      sourcesLabel: "Nubank e Pix",
    });
  });

  it("reconhece duplicidade cruzada para assinatura regional ensinada pela IA (`learnedServices`)", () => {
    const learnedServices = new Map([
      [
        "clube petlove",
        {
          canonicalKey: "clube petlove",
          segment: "other" as const,
          tier: "can_cut" as const,
          isSubscription: true,
        },
      ],
    ]);

    const expenses: ExpenseLike[] = [
      {
        id: "p1",
        description: "Clube Petlove",
        month: "2026-11",
        date: "2026-11-03",
        valueCents: 8900,
        categoryId: "cat-pet",
        paymentMethod: "credit_card",
        cardId: "card-1",
        cardName: "Itaú",
      },
      {
        id: "p2",
        description: "Clube Petlove",
        month: "2026-11",
        date: "2026-11-14",
        valueCents: 8900,
        categoryId: "cat-pet",
        paymentMethod: "credit_card",
        cardId: "card-2",
        cardName: "XP",
      },
    ];

    const dups = detectCrossMethodDuplicateSubscriptions(expenses, {
      referenceMonth: "2026-11",
      learnedServices,
    });

    expect(dups).toHaveLength(1);
    expect(dups[0]?.sourcesLabel).toBe("Itaú e XP");
  });

  it("calcula alívio mensal de parcelas que encerram no mês de referência (`N/N`)", () => {
    const relief = computeEndingInstallmentsRelief(
      [
        {
          id: "inst-end-1",
          description: "Notebook Dell 10/10",
          date: "2026-11-10",
          value: 450,
          report_weight: 1,
          installment_group_id: "grp-1",
          installment_number: 10,
          installments_total: 10,
        },
        {
          id: "inst-mid",
          description: "Celular 04/12",
          date: "2026-11-12",
          value: 300,
          report_weight: 1,
          installment_group_id: "grp-2",
          installment_number: 4,
          installments_total: 12,
        },
        {
          id: "inst-end-2",
          description: "Curso Inglês 06/06",
          date: "2026-11-18",
          value: 200,
          report_weight: 0.5,
          installment_group_id: "grp-3",
          installment_number: 6,
          installments_total: 6,
        },
      ],
      "2026-11",
    );

    expect(relief.count).toBe(2);
    expect(relief.totalFreedMonthlyCents).toBe(55_000);
    expect(relief.items[0]?.description).toBe("Notebook Dell");
    expect(relief.items[1]?.freedCents).toBe(10_000);
  });

  it("roteia excedente priorizando juros/dívidas -> reserva de emergência -> aporte em carteira", () => {
    const highInterestPlan = computeOptimalSurplusAllocation({
      surplusCents: 150_000,
      safeToSpendCents: 120_000,
      highInterestCardChargesCents: 25_000,
      isEmergencyFundComplete: false,
    });
    expect(highInterestPlan).toEqual({
      destination: "settle_high_interest",
      allocatableCents: 120_000,
      suggestedAmountCents: 25_000,
      learnedBrokerName: null,
    });

    const reservePlan = computeOptimalSurplusAllocation({
      surplusCents: 150_000,
      committedObligationsCents: 30_000,
      isEmergencyFundComplete: false,
      emergencyGapCents: 80_000,
    });
    expect(reservePlan).toEqual({
      destination: "emergency_reserve",
      allocatableCents: 120_000,
      suggestedAmountCents: 80_000,
      learnedBrokerName: null,
    });

    const aportePlan = computeOptimalSurplusAllocation({
      surplusCents: 200_000,
      isEmergencyFundComplete: true,
      plannedAporteCents: 100_000,
      learnedBrokerName: "BTG Pactual",
    });
    expect(aportePlan).toEqual({
      destination: "portfolio_rebalance",
      allocatableCents: 200_000,
      suggestedAmountCents: 100_000,
      learnedBrokerName: "BTG Pactual",
    });
  });
});
