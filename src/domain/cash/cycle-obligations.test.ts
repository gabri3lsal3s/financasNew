import { describe, it, expect } from "vitest";
import { breakdownCycleObligations } from "./cycle-obligations";

describe("breakdownCycleObligations — Motor Puro de Discriminação de Obrigações do Ciclo", () => {
  const TODAY = "2026-11-08";

  it("retorna listas vazias e totais zerados quando não há cartões nem dívidas", () => {
    const result = breakdownCycleObligations({
      cards: [],
      cardExpenses: [],
      cardPayments: [],
      debts: [],
      referenceDate: TODAY,
    });

    expect(result.invoices).toEqual([]);
    expect(result.openInvoicesCents).toBe(0);
    expect(result.payableDebts).toEqual([]);
    expect(result.payableDebtsCents).toBe(0);
    expect(result.committedObligationsCents).toBe(0);
    expect(result.receivableDebts).toEqual([]);
    expect(result.receivablePendingCents).toBe(0);
    expect(result.futureDebts).toEqual({ count: 0, totalCents: 0 });
  });

  it("apura faturas de cartão abertas no ciclo com saldo devedor", () => {
    const cards = [
      { id: "c1", name: "Nubank", due_day: 15, color: "#8A05BE", is_active: true },
      { id: "c2", name: "XP Visa Infinite", due_day: 20, color: "#000000", is_active: true },
      { id: "c3", name: "Cartão Inativo", due_day: 10, is_active: false },
    ];

    const cardExpenses = [
      // Nubank: R$ 1.200,00 na competência 2026-11
      { card_id: "c1", bill_competence: "2026-11", value: 1200, report_weight: 1 },
      // XP: R$ 800,00 na competência 2026-11
      { card_id: "c2", bill_competence: "2026-11", value: 800, report_weight: 1 },
      // Cartão inativo: não deve ser processado
      { card_id: "c3", bill_competence: "2026-11", value: 500, report_weight: 1 },
    ];

    const cardPayments = [
      // Nubank com pagamento parcial de R$ 200,00 -> saldo = R$ 1.000,00
      { card_id: "c1", competence_month: "2026-11", amount: 200 },
    ];

    const result = breakdownCycleObligations({
      cards,
      cardExpenses,
      cardPayments,
      debts: [],
      referenceDate: TODAY,
    });

    expect(result.invoices).toHaveLength(2);
    expect(result.invoices[0]).toEqual({
      cardId: "c1",
      cardName: "Nubank",
      cardColor: "#8A05BE",
      competenceMonth: "2026-11",
      dueDate: "2026-11-15",
      saldoCents: 100000, // R$ 1.000,00
    });
    expect(result.invoices[1]).toEqual({
      cardId: "c2",
      cardName: "XP Visa Infinite",
      cardColor: "#000000",
      competenceMonth: "2026-11",
      dueDate: "2026-11-20",
      saldoCents: 80000, // R$ 800,00
    });
    expect(result.openInvoicesCents).toBe(180000);
    expect(result.committedObligationsCents).toBe(180000);
  });

  it("separa dívidas a pagar entre ciclo corrente, atrasadas e parcelas futuras", () => {
    const debts = [
      // 1. Dívida vencida no passado recente (outubro) -> entra no ciclo como atrasada
      {
        id: "d1",
        name: "Internet Outubro",
        amount: 150.0,
        due_date: "2026-10-25",
        type: "payable" as const,
        paid_at: null,
      },
      // 2. Dívida do mês atual -> entra no ciclo no prazo
      {
        id: "d2",
        name: "Aluguel Novembro",
        amount: 1200.0,
        due_date: "2026-11-10",
        type: "payable" as const,
        paid_at: null,
      },
      // 3. Dívida já quitada do mês -> IGNORADA
      {
        id: "d3",
        name: "Conta de Luz",
        amount: 250.0,
        due_date: "2026-11-05",
        type: "payable" as const,
        paid_at: "2026-11-05T10:00:00Z",
      },
      // 4. Parcela futura 1 (Dezembro/2026) -> Dívida Futura
      {
        id: "d4",
        name: "Empréstimo Parcela 2/12",
        amount: 500.0,
        due_date: "2026-12-15",
        type: "payable" as const,
        paid_at: null,
      },
      // 5. Parcela futura 2 (Janeiro/2027) -> Dívida Futura
      {
        id: "d5",
        name: "Empréstimo Parcela 3/12",
        amount: 500.0,
        due_date: "2027-01-15",
        type: "payable" as const,
        paid_at: null,
      },
    ];

    const result = breakdownCycleObligations({
      cards: [],
      cardExpenses: [],
      cardPayments: [],
      debts,
      referenceDate: TODAY, // 2026-11-08
    });

    // Apenas d1 (atrasada) e d2 (a vencer em 10/11) devem entrar em payableDebts
    expect(result.payableDebts).toHaveLength(2);
    expect(result.payableDebts[0]).toEqual({
      id: "d1",
      name: "Internet Outubro",
      dueDate: "2026-10-25",
      amountCents: 15000,
      isOverdue: true,
      type: "payable",
    });
    expect(result.payableDebts[1]).toEqual({
      id: "d2",
      name: "Aluguel Novembro",
      dueDate: "2026-11-10",
      amountCents: 120000,
      isOverdue: false,
      type: "payable",
    });

    expect(result.payableDebtsCents).toBe(135000); // 150 + 1200
    expect(result.committedObligationsCents).toBe(135000);

    // Dívidas futuras: d4 (R$ 500) e d5 (R$ 500)
    expect(result.futureDebts).toEqual({
      count: 2,
      totalCents: 100000, // R$ 1.000,00
    });
  });

  it("processa valores a receber previstos do ciclo", () => {
    const debts = [
      {
        id: "r1",
        name: "Reembolso Médico",
        amount: 350.0,
        due_date: "2026-11-20",
        type: "receivable" as const,
        paid_at: null,
      },
      {
        id: "r2",
        name: "Empréstimo Amigo",
        amount: 200.0,
        due_date: "2026-12-10", // futuro
        type: "receivable" as const,
        paid_at: null,
      },
    ];

    const result = breakdownCycleObligations({
      cards: [],
      cardExpenses: [],
      cardPayments: [],
      debts,
      referenceDate: TODAY,
    });

    expect(result.receivableDebts).toHaveLength(1);
    expect(result.receivableDebts[0]).toEqual({
      id: "r1",
      name: "Reembolso Médico",
      dueDate: "2026-11-20",
      amountCents: 35000,
      isOverdue: false,
      type: "receivable",
    });
    expect(result.receivablePendingCents).toBe(35000);
  });
});
