import { describe, expect, it } from "vitest";
import {
  assertRefundCongruence,
  buildCompetenceSummaries,
  type CardRefundRecord,
  type RefundIncomeRecord,
} from "./index";
import { calculateRealCashBalance, resolveCashFlowEvents } from "@/domain/cash/cash-ledger";

describe("assertRefundCongruence — Congruência entre estornos de fatura e receitas (ESPECIFICAÇÃO §3.3.3 / D1)", () => {
  it("valida congruência estrita quando estornos e receitas automáticas [REFUND] coincidem perfeitamente", () => {
    const cardPayments: CardRefundRecord[] = [
      { id: "ref-1", card_id: "c1", competence_month: "2026-08", amount: -50, date: "2026-08-10", is_refund: true },
      { id: "ref-2", card_id: "c1", competence_month: "2026-08", amount: -80, date: "2026-08-15", is_refund: true },
      { id: "pay-1", card_id: "c1", competence_month: "2026-08", amount: 150, date: "2026-08-12", is_refund: false }, // Pagamento normal
    ];

    const incomes: RefundIncomeRecord[] = [
      { id: "inc-1", value: 50, date: "2026-08-10", source_ref: "[REFUND]ref-1", category_name: "Estorno" },
      { id: "inc-2", value: 80, date: "2026-08-15", source_ref: "[REFUND]ref-2", category_name: "Estorno" },
      { id: "inc-salary", value: 5000, date: "2026-08-05", source_ref: null, category_name: "Salário" },
    ];

    const result = assertRefundCongruence(cardPayments, incomes);

    expect(result.isCongruent).toBe(true);
    expect(result.totalRefundsCents).toBe(13000); // R$ 130,00
    expect(result.totalIncomesCents).toBe(13000); // R$ 130,00
    expect(result.differenceCents).toBe(0);
    expect(result.orphanedRefunds).toHaveLength(0);
    expect(result.orphanedIncomes).toHaveLength(0);
    expect(result.mismatchedAmounts).toHaveLength(0);

    // Valida que buildCompetenceSummaries calcula exatamente os mesmos R$ 130,00 de estorno
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 200, report_weight: 1 }],
      cardPayments,
    );
    const august = summaries.find((s) => s.month === "2026-08");
    expect(august?.estornoCents).toBe(13000);
    expect(august?.pagoCents).toBe(15000);
    expect(august?.saldoBrutoCents).toBe(0); // 200 - 150 (pago) - 130 (estorno) <= 0
  });

  it("detecta divergência de valores em centavos entre o estorno da fatura e a receita gerada", () => {
    const cardPayments: CardRefundRecord[] = [
      { id: "ref-1", card_id: "c1", competence_month: "2026-08", amount: -50, date: "2026-08-10", is_refund: true },
    ];

    // Receita registrada com valor divergente (R$ 45 em vez de R$ 50)
    const incomes: RefundIncomeRecord[] = [
      { id: "inc-1", value: 45, date: "2026-08-10", source_ref: "[REFUND]ref-1", category_name: "Estorno" },
    ];

    const result = assertRefundCongruence(cardPayments, incomes);

    expect(result.isCongruent).toBe(false);
    expect(result.totalRefundsCents).toBe(5000);
    expect(result.totalIncomesCents).toBe(4500);
    expect(result.differenceCents).toBe(500); // 500 centavos = R$ 5,00
    expect(result.mismatchedAmounts).toEqual([
      {
        paymentId: "ref-1",
        paymentAmountCents: 5000,
        incomeValueCents: 4500,
      },
    ]);
  });

  it("detecta estorno órfão quando lançado no cartão sem receita correspondente", () => {
    const cardPayments: CardRefundRecord[] = [
      { id: "ref-orphan", card_id: "c1", competence_month: "2026-08", amount: -30, date: "2026-08-10", is_refund: true },
    ];
    const incomes: RefundIncomeRecord[] = [];

    const result = assertRefundCongruence(cardPayments, incomes);

    expect(result.isCongruent).toBe(false);
    expect(result.orphanedRefunds).toEqual(["ref-orphan"]);
  });

  it("detecta receita órfã [REFUND] quando o estorno de cartão foi excluído", () => {
    const cardPayments: CardRefundRecord[] = [];
    const incomes: RefundIncomeRecord[] = [
      { id: "inc-orphan", value: 70, date: "2026-08-10", source_ref: "[REFUND]deleted-payment-id" },
    ];

    const result = assertRefundCongruence(cardPayments, incomes);

    expect(result.isCongruent).toBe(false);
    expect(result.orphanedIncomes).toEqual(["inc-orphan"]);
  });

  it("assegura que rendas automáticas [REFUND] não duplicam entrada no caixa (CashLedger)", () => {
    const incomes = [
      { id: "inc-normal", date: "2026-08-01", value: 1000, source_ref: null },
      // Renda automática originada de estorno de cartão
      { id: "inc-refund", date: "2026-08-05", value: 200, source_ref: "[REFUND]pay-refund-1" },
    ];

    // No ledger, apenas o fluxo real de caixa deve entrar (1000, e NÃO 1000 + 200)
    const events = resolveCashFlowEvents({
      incomes,
      expenses: [],
      cardPayments: [],
      referenceDate: "2026-08-31",
    });

    const incomeEvents = events.filter((e) => e.kind === "income");
    expect(incomeEvents).toHaveLength(1);
    expect(incomeEvents[0]?.amountCents).toBe(100000); // Apenas R$ 1.000,00

    const balance = calculateRealCashBalance({
      incomes,
      expenses: [],
      cardPayments: [],
      referenceDate: "2026-08-31",
    });
    expect(balance.currentBalanceCents).toBe(100000);
  });

  it("valida congruência com quitação integral de fatura exclusivamente por estorno", () => {
    const cardPayments: CardRefundRecord[] = [
      { id: "ref-full", card_id: "c1", competence_month: "2026-08", amount: -100, date: "2026-08-10", is_refund: true },
    ];
    const incomes: RefundIncomeRecord[] = [
      { id: "inc-full", value: 100, date: "2026-08-10", source_ref: "[REFUND]ref-full" },
    ];

    const congruence = assertRefundCongruence(cardPayments, incomes);
    expect(congruence.isCongruent).toBe(true);

    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 100, report_weight: 1 }],
      cardPayments,
    );
    expect(summaries[0]?.saldoBrutoCents).toBe(0);
    expect(summaries[0]?.estornoCents).toBe(10000);
    expect(summaries[0]?.pagoCents).toBe(0);
  });

  it("valida congruência quando estorno excede a fatura e transborda crédito para a próxima", () => {
    const cardPayments: CardRefundRecord[] = [
      // Fatura de R$ 40 com estorno de R$ 100 (excesso de R$ 60 de crédito)
      { id: "ref-excess", card_id: "c1", competence_month: "2026-08", amount: -100, date: "2026-08-10", is_refund: true },
    ];
    const incomes: RefundIncomeRecord[] = [
      { id: "inc-excess", value: 100, date: "2026-08-10", source_ref: "[REFUND]ref-excess" },
    ];

    const congruence = assertRefundCongruence(cardPayments, incomes);
    expect(congruence.isCongruent).toBe(true);

    const summaries = buildCompetenceSummaries(
      [
        { bill_competence: "2026-08", value: 40, report_weight: 1 },
        { bill_competence: "2026-09", value: 90, report_weight: 1 },
      ],
      cardPayments,
    );

    const august = summaries.find((s) => s.month === "2026-08");
    const september = summaries.find((s) => s.month === "2026-09");

    expect(august?.saldoBrutoCents).toBe(0);
    expect(august?.estornoCents).toBe(10000);
    expect(august?.creditoRestanteCents).toBe(6000); // R$ 60 de crédito gerado

    expect(september?.creditoAnteriorCents).toBe(6000); // R$ 60 herdado
    expect(september?.saldoBrutoCents).toBe(3000); // R$ 90 - R$ 60 = R$ 30
  });
});
