import { describe, expect, it } from "vitest";
import {
  calculateDerivedBusinessCashDirect,
  calculateDerivedBusinessCashFromTransactions,
} from "./derived-cash";
import type { Expense, Income } from "@/types";

describe("derived-cash (Caixa Operacional Derivado do Negócio)", () => {
  it("calcula caixa com saldo de abertura, receitas líquidas e saídas diretas", () => {
    const result = calculateDerivedBusinessCashDirect({
      openingBalanceCents: 1_000_00, // R$ 1.000 saldo inicial virtual
      capitalInjectionsCents: 2_000_00, // R$ 2.000 aporte PF -> PJ
      grossRevenueCents: 5_000_00, // R$ 5.000 faturamento bruto
      taxWithheldCents: 300_00, // R$ 300 retido na fonte
      cashExpensesCents: 1_500_00, // R$ 1.500 despesas pagas em conta
      proLaboreWithdrawnCents: 2_000_00, // R$ 2.000 pró-labore
      cardReimbursementsPaidCents: 400_00, // R$ 400 reembolso de fatura
    });

    // 1.000 + 2.000 + (5.000 - 300) - 1.500 - 2.000 - 400 = 7.700 - 3.900 = 3.800
    expect(result.netRevenueReceivedCents).toBe(4_700_00);
    expect(result.derivedCashBalanceCents).toBe(3_800_00);
  });

  it("isola compras de cartão de crédito até que ocorra o reembolso (card_reimbursement)", () => {
    const incomes: Income[] = [
      {
        id: "inc-1",
        user_id: "u-1",
        value: 10000, // R$ 10.000 receita
        date: "2026-05-10",
        category_id: "cat-1",
        receive_type: "pix",
        description: "Contrato cliente",
        report_weight: 1,
        source_ref: null,
        scope: "business",
        created_at: "2026-05-10T10:00:00Z",
      },
    ];

    const expenses: Expense[] = [
      {
        id: "exp-card",
        user_id: "u-1",
        value: 600, // R$ 600 compra PJ no cartão de crédito PF
        date: "2026-05-12",
        category_id: "cat-2",
        payment_method: "credit_card",
        card_id: "card-pf",
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: "2026-05",
        report_weight: 1,
        base_amount: 600,
        description: "Insumo de trabalho no cartão PF",
        scope: "business",
        created_at: "2026-05-12T10:00:00Z",
      },
    ];

    // Sem reembolso ainda: o gasto no cartão NÃO deve debitar o caixa PJ imediatamente
    const cashBeforeReimbursement = calculateDerivedBusinessCashFromTransactions({
      openingBalanceCents: 0,
      incomes,
      expenses,
    });

    expect(cashBeforeReimbursement.grossRevenueCents).toBe(10_000_00);
    expect(cashBeforeReimbursement.cashExpensesCents).toBe(0);
    expect(cashBeforeReimbursement.derivedCashBalanceCents).toBe(10_000_00);

    // Quando o reembolso de R$ 600 é efetuado da PJ para a PF:
    const expensesWithReimbursement: Expense[] = [
      ...expenses,
      {
        id: "exp-reimb",
        user_id: "u-1",
        value: 600,
        date: "2026-05-20",
        category_id: "cat-reimb",
        payment_method: "pix",
        card_id: null,
        installments_total: 1,
        installment_number: 1,
        installment_group_id: null,
        bill_competence: null,
        report_weight: 1,
        base_amount: 600,
        description: "Reembolso fatura de cartão",
        scope: "business",
        is_internal_transfer: true,
        transfer_kind: "card_reimbursement",
        created_at: "2026-05-20T10:00:00Z",
      },
    ];

    const cashAfterReimbursement = calculateDerivedBusinessCashFromTransactions({
      openingBalanceCents: 0,
      incomes,
      expenses: expensesWithReimbursement,
    });

    expect(cashAfterReimbursement.cardReimbursementsPaidCents).toBe(600_00);
    expect(cashAfterReimbursement.derivedCashBalanceCents).toBe(9_400_00);
  });
});
