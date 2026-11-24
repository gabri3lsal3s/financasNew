import { describe, expect, it } from "vitest";
import { filterCardsByViewScope } from "@/domain/business";
import { buildCompetenceSummaries, resolveOpenCardInvoices } from "@/domain/cards";
import { breakdownCycleObligations } from "@/domain/cash";
import { buildOverviewWeeklyRadarSummary } from "@/domain/overview";
import { projectCardInvoiceObligations } from "@/domain/projection";
import { buildUsedLimitMap } from "@/features/cards/hooks/cards-page-selectors";
import type { CardBillRollover, CardPayment, CreditCard, Expense } from "@/types";

describe("Congruência SSOT entre Cartões, Safe-to-Spend, Cash-Gap, Radar Semanal e Lembretes", () => {
  const TODAY = "2026-11-24";
  const CURRENT_MONTH = "2026-11";

  const cards: CreditCard[] = [
    {
      id: "c-mixed",
      user_id: "u1",
      name: "Cartão Misto",
      brand: "Visa",
      credit_limit: 5000,
      closing_day: 3,
      due_day: 26,
      color: "#111111",
      is_active: true,
      scope: "mixed",
    },
    {
      id: "c-inactive",
      user_id: "u1",
      name: "Cartão Inativo",
      brand: "Mastercard",
      credit_limit: 2000,
      closing_day: 5,
      due_day: 20, // vencida em 20/11/2026
      color: "#222222",
      is_active: false,
      scope: "personal",
    },
  ];

  const expenses: Expense[] = [
    // Cartão misto em 2026-10 (R$ 300 PF + R$ 200 PJ = R$ 500), rolado R$ 200 após pagamento parcial de R$ 300
    {
      id: "e1",
      user_id: "u1",
      value: 300,
      date: "2026-09-20",
      category_id: "cat1",
      payment_method: "credit_card",
      card_id: "c-mixed",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: "2026-10",
      report_weight: 1,
      base_amount: 300,
      description: "Compra PF",
      scope: "personal",
      created_at: "2026-09-20T10:00:00Z",
    },
    {
      id: "e2",
      user_id: "u1",
      value: 200,
      date: "2026-09-21",
      category_id: "cat1",
      payment_method: "credit_card",
      card_id: "c-mixed",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: "2026-10",
      report_weight: 1,
      base_amount: 200,
      description: "Compra PJ",
      scope: "business",
      created_at: "2026-09-21T10:00:00Z",
    },
    // Cartão misto em 2026-11: nova compra de R$ 150 + juros de rotativo R$ 20
    {
      id: "e3",
      user_id: "u1",
      value: 150,
      date: "2026-10-25",
      category_id: "cat1",
      payment_method: "credit_card",
      card_id: "c-mixed",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 150,
      description: "Compra Nov",
      scope: "personal",
      created_at: "2026-10-25T10:00:00Z",
    },
    {
      id: "e4",
      user_id: "u1",
      value: 20,
      date: "2026-11-01",
      category_id: "cat1",
      payment_method: "credit_card",
      card_id: "c-mixed",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 20,
      description: "Juros Rotativo",
      charge_kind: "interest",
      scope: "personal",
      created_at: "2026-11-01T10:00:00Z",
    },
    // Cartão inativo com fatura vencida em 2026-11 (R$ 400)
    {
      id: "e5",
      user_id: "u1",
      value: 400,
      date: "2026-10-15",
      category_id: "cat1",
      payment_method: "credit_card",
      card_id: "c-inactive",
      installments_total: 1,
      installment_number: 1,
      installment_group_id: null,
      bill_competence: "2026-11",
      report_weight: 1,
      base_amount: 400,
      description: "Saldo antigo",
      scope: "personal",
      created_at: "2026-10-15T10:00:00Z",
    },
  ];

  const payments: CardPayment[] = [
    {
      id: "p1",
      user_id: "u1",
      card_id: "c-mixed",
      competence_month: "2026-10",
      amount: 300,
      date: "2026-10-26",
      note: "Pagamento parcial",
      is_refund: false,
    },
  ];

  const rollovers: CardBillRollover[] = [
    {
      id: "r1",
      user_id: "u1",
      card_id: "c-mixed",
      from_competence_month: "2026-10",
      to_competence_month: "2026-11",
      principal_amount: 200,
      kind: "rollover",
      group_id: "g1",
      note: null,
      created_at: "2026-10-28T10:00:00Z",
    },
  ];

  it("produz soma 100% idêntica entre todos os consumidores (visão personal com cartão misto e cartão inativo)", () => {
    const personalCards = filterCardsByViewScope(cards, "personal");

    // 1. SSOT direto (Lembretes usa resolveOpenCardInvoices)
    const ssotOpen = resolveOpenCardInvoices({
      cards: personalCards,
      expenses,
      payments,
      rollovers,
      today: TODAY,
    });
    const expectedTotalCents = ssotOpen.reduce((acc, i) => acc + i.saldoBrutoCents, 0);

    // Cartão misto 2026-11 = 150 + 20 + 200 (rolado) = 370 (37000c); 2026-10 = 0 (rolled_over)
    // Cartão inativo 2026-11 = 400 (40000c)
    // Total esperado = 77.000 centavos (R$ 770,00)
    expect(expectedTotalCents).toBe(77000);

    // 2. Tela de Cartões (buildCompetenceSummaries + buildUsedLimitMap)
    const cardsPageTotalCents = personalCards.reduce((acc, card) => {
      const sum = buildCompetenceSummaries(
        expenses.filter((e) => e.card_id === card.id),
        payments.filter((p) => p.card_id === card.id),
        rollovers.filter((r) => r.card_id === card.id),
      ).reduce((sAcc, s) => sAcc + s.saldoBrutoCents, 0);
      return acc + sum;
    }, 0);
    const usedLimitMap = buildUsedLimitMap(personalCards, expenses, payments, CURRENT_MONTH, rollovers);
    const usedLimitTotalCents = Object.values(usedLimitMap).reduce((a, b) => a + b.brutoCents, 0);

    expect(cardsPageTotalCents).toBe(expectedTotalCents);
    expect(usedLimitTotalCents).toBe(expectedTotalCents);

    // 3. Safe-to-Spend (breakdownCycleObligations)
    const cycleBreakdown = breakdownCycleObligations({
      cards: personalCards,
      cardExpenses: expenses,
      cardPayments: payments,
      cardRollovers: rollovers,
      debts: [],
      referenceDate: TODAY,
    });
    expect(cycleBreakdown.openInvoicesCents).toBe(expectedTotalCents);

    // 4. Cash-Gap Alert (projectCardInvoiceObligations)
    const cashGapObligations = projectCardInvoiceObligations({
      cards: personalCards,
      expenses,
      payments,
      rollovers,
      today: TODAY,
      currentMonth: CURRENT_MONTH,
    });
    const cashGapTotalCents = cashGapObligations.reduce((acc, ob) => acc + ob.amountCents, 0);
    expect(cashGapTotalCents).toBe(expectedTotalCents);

    // 5. Radar Semanal (ambas vencem dentro da janela [-7d, +7d] de 24/11: 20/11 e 26/11)
    const weeklyRadar = buildOverviewWeeklyRadarSummary({
      isLoading: false,
      today: TODAY,
      month: CURRENT_MONTH,
      currentBalanceCents: 100000,
      cards: personalCards,
      cardExpenses: expenses,
      cardPayments: payments,
      cardRollovers: rollovers,
      debts: [],
    });
    expect(weeklyRadar.totalDueCents).toBe(expectedTotalCents);
  });
});
