import { describe, expect, it } from "vitest";
import {
  analyzeCashGap,
  projectCardInvoiceObligations,
  projectInstallmentCashFlows,
  projectInstallmentsToObligations,
} from "./cash-gap";

describe("analyzeCashGap — Radar Preditivo de Descasamento de Fluxo (§F51)", () => {
  it("detecta descasamento quando saídas superam o saldo antes da data de entrada do salário", () => {
    const result = analyzeCashGap({
      currentBalanceCents: 50000, // R$ 500,00 em conta
      today: "2026-09-01",
      daysAhead: 20,
      obligations: [
        {
          id: "inv-nubank",
          name: "Fatura Nubank",
          dueDate: "2026-09-05",
          amountCents: 120000, // R$ 1.200,00 (saldo fica -700,00)
          kind: "invoice",
        },
        {
          id: "debt-aluguel",
          name: "Aluguel",
          dueDate: "2026-09-10",
          amountCents: 150000, // R$ 1.500,00 (saldo fica -2.200,00)
          kind: "debt",
        },
      ],
      inflows: [
        {
          id: "salario",
          name: "Salário Mensal",
          expectedDate: "2026-09-15",
          amountCents: 600000, // R$ 6.000,00 (cobre tudo no dia 15)
        },
      ],
    });

    expect(result.isCashGapDetected).toBe(true);
    expect(result.gapDate).toBe("2026-09-05");
    expect(result.daysUntilGap).toBe(4);
    expect(result.severity).toBe("warning");
    expect(result.maxDeficitCents).toBe(220000); // R$ 2.200,00 de déficit máximo
    expect(result.nextInflowDate).toBe("2026-09-15");
    expect(result.causingObligations).toHaveLength(2);
    expect(result.recommendationMessage).toContain("05/09");
    expect(result.recommendationMessage).toContain("15/09");
    expect(result.runway.length).toBe(20);
  });

  it("classifica como critical quando o gap ocorre em menos de 3 dias", () => {
    const result = analyzeCashGap({
      currentBalanceCents: 10000, // R$ 100,00
      today: "2026-09-01",
      obligations: [
        {
          id: "boleto",
          name: "Boleto Condomínio",
          dueDate: "2026-09-02",
          amountCents: 60000,
          kind: "debt",
        },
      ],
      inflows: [],
    });

    expect(result.isCashGapDetected).toBe(true);
    expect(result.daysUntilGap).toBe(1);
    expect(result.severity).toBe("critical");
    expect(result.gapDate).toBe("2026-09-02");
    expect(result.maxDeficitCents).toBe(50000);
  });

  it("retorna isCashGapDetected = false quando o saldo é suficiente em todos os dias", () => {
    const result = analyzeCashGap({
      currentBalanceCents: 500000, // R$ 5.000,00
      today: "2026-09-01",
      obligations: [
        {
          id: "inv-1",
          name: "Fatura",
          dueDate: "2026-09-10",
          amountCents: 100000,
          kind: "invoice",
        },
      ],
      inflows: [],
    });

    expect(result.isCashGapDetected).toBe(false);
    expect(result.severity).toBe("none");
    expect(result.gapDate).toBeNull();
    expect(result.maxDeficitCents).toBe(0);
    expect(result.recommendationMessage).toBeNull();
  });
});

describe("projectCardInvoiceObligations — Alinhamento de Faturas com invoiceDueDate (§4.3)", () => {
  const mockCards = [
    { id: "c1", name: "Nubank Ultravioleta", due_day: 10, closing_day: 3 },
    { id: "c2", name: "XP Visa Infinite", due_day: 25, closing_day: 18 },
  ];

  it("projeta o desembolso da fatura estritamente na data de vencimento (invoiceDueDate) e não na data da compra", () => {
    // Compra realizada em 15/08 no Nubank (fechamento dia 3, vencimento dia 10)
    // Competência da fatura: 2026-09. Data de vencimento: 2026-09-10.
    const obligations = projectCardInvoiceObligations({
      cards: mockCards,
      expenses: [
        {
          id: "e1",
          card_id: "c1",
          date: "2026-08-15", // Compra física efetuada no meio de agosto
          value: 350, // R$ 350,00
          bill_competence: "2026-09",
        },
      ],
      payments: [],
      today: "2026-08-20",
    });

    expect(obligations).toHaveLength(1);
    expect(obligations[0]?.id).toBe("invoice-c1-2026-09");
    // Invariante essencial: o desembolso financeiro NÃO pode ocorrer em 2026-08-15!
    expect(obligations[0]?.dueDate).not.toBe("2026-08-15");
    expect(obligations[0]?.dueDate).toBe("2026-09-10");
    expect(obligations[0]?.amountCents).toBe(35000);
    expect(obligations[0]?.kind).toBe("invoice");
  });

  it("utiliza valor bruto nominal (100%) mesmo quando report_weight for menor que 1", () => {
    const obligations = projectCardInvoiceObligations({
      cards: mockCards,
      expenses: [
        {
          id: "e2",
          card_id: "c2",
          date: "2026-08-05",
          value: 400,
          report_weight: 0.5, // 50% rateio
          bill_competence: "2026-08",
        },
      ],
      payments: [],
      today: "2026-08-10",
      currentMonth: "2026-08",
    });

    expect(obligations).toHaveLength(1);
    // Deve exigir os R$ 400,00 integrais (40.000 centavos) do banco, e não R$ 200,00
    expect(obligations[0]?.amountCents).toBe(40000);
    expect(obligations[0]?.dueDate).toBe("2026-08-25"); // due_day 25
    expect(obligations[0]?.name).toBe("Fatura XP Visa Infinite");
  });

  it("atribui vencimento imediato (today) para faturas em aberto cujo vencimento já prescreveu no mês", () => {
    // Fatura com vencimento em 10/08, mas hoje é 18/08 e ela continua aberta
    const obligations = projectCardInvoiceObligations({
      cards: mockCards,
      expenses: [
        {
          id: "e3",
          card_id: "c1",
          date: "2026-07-28",
          value: 150,
          bill_competence: "2026-08",
        },
      ],
      payments: [],
      today: "2026-08-18",
    });

    expect(obligations).toHaveLength(1);
    // Vencimento nominal era 2026-08-10, mas como já passou e está aberta, tem exigibilidade imediata
    expect(obligations[0]?.dueDate).toBe("2026-08-18");
    expect(obligations[0]?.amountCents).toBe(15000);
  });

  it("abate pagamentos parciais e elimina obrigações quitadas", () => {
    const obligations = projectCardInvoiceObligations({
      cards: mockCards,
      expenses: [
        {
          id: "e4",
          card_id: "c1",
          date: "2026-08-20",
          value: 500,
          bill_competence: "2026-09",
        },
      ],
      payments: [
        {
          id: "p1",
          card_id: "c1",
          competence_month: "2026-09",
          amount: 200,
        },
      ],
      today: "2026-08-25",
    });

    expect(obligations).toHaveLength(1);
    expect(obligations[0]?.amountCents).toBe(30000); // 500 - 200 = 300
    expect(obligations[0]?.dueDate).toBe("2026-09-10");
  });

  it("transborda créditos de excesso de pagamento para abater a competência seguinte", () => {
    const obligations = projectCardInvoiceObligations({
      cards: [mockCards[0]!],
      expenses: [
        // Fatura 2026-08: R$ 100
        { id: "e1", card_id: "c1", date: "2026-07-25", value: 100, bill_competence: "2026-08" },
        // Fatura 2026-09: R$ 150
        { id: "e2", card_id: "c1", date: "2026-08-15", value: 150, bill_competence: "2026-09" },
      ],
      payments: [
        // Pagou R$ 180 em 2026-08 (excesso de R$ 80 de crédito)
        { id: "p1", card_id: "c1", competence_month: "2026-08", amount: 180 },
      ],
      today: "2026-08-10",
    });

    // Fatura 2026-08 ficou zerada (saldo 0).
    // Fatura 2026-09 recebe o crédito de R$ 80: saldo 150 - 80 = R$ 70 (7.000 centavos).
    expect(obligations).toHaveLength(1);
    expect(obligations[0]?.id).toBe("invoice-c1-2026-09");
    expect(obligations[0]?.amountCents).toBe(7000);
    expect(obligations[0]?.dueDate).toBe("2026-09-10");
  });
});

describe("projectInstallmentCashFlows — Mapeamento Cronológico de Parcelamentos (§4.3)", () => {
  const card = { id: "c1", name: "Nubank", due_day: 12 };

  it("alinha o desembolso de cada parcela à data de vencimento da respectiva competência", () => {
    // Compra parcelada em 3x realizada em 2026-08-01
    const installments = [
      { installmentNumber: 1, totalInstallments: 3, amountCents: 10000, billCompetence: "2026-08", purchaseDate: "2026-08-01" },
      { installmentNumber: 2, totalInstallments: 3, amountCents: 10000, billCompetence: "2026-09", purchaseDate: "2026-08-01" },
      { installmentNumber: 3, totalInstallments: 3, amountCents: 10000, billCompetence: "2026-10", purchaseDate: "2026-08-01" },
    ];

    const flows = projectInstallmentCashFlows({ card, installments });

    expect(flows).toHaveLength(3);
    // Nenhuma parcela discursa em 01/08 (data da compra):
    expect(flows[0]?.disbursementDate).toBe("2026-08-12");
    expect(flows[1]?.disbursementDate).toBe("2026-09-12");
    expect(flows[2]?.disbursementDate).toBe("2026-10-12");
  });

  it("converte parcelamentos em CashGapObligations puras", () => {
    const installments = [
      { installmentNumber: 1, totalInstallments: 2, amountCents: 25000, billCompetence: "2026-11" },
      { installmentNumber: 2, totalInstallments: 2, amountCents: 25000, billCompetence: "2026-12" },
    ];

    const obs = projectInstallmentsToObligations({ card, installments });

    expect(obs).toHaveLength(2);
    expect(obs[0]?.dueDate).toBe("2026-11-12");
    expect(obs[0]?.amountCents).toBe(25000);
    expect(obs[0]?.kind).toBe("invoice");
    expect(obs[1]?.dueDate).toBe("2026-12-12");
  });
});

describe("analyzeCashGap com cardProjection integrado (§4.3)", () => {
  it("não dispara alerta de descasamento no dia da compra física no cartão de crédito", () => {
    // Usuário tem R$ 200 em conta em 02/08
    // Faz uma compra de R$ 500 no cartão no dia 02/08
    // O vencimento da fatura é dia 15/08
    // Em 10/08, ele recebe R$ 2.000 de salário
    const result = analyzeCashGap({
      currentBalanceCents: 20000, // R$ 200,00
      today: "2026-08-01",
      daysAhead: 20,
      inflows: [
        { id: "salario", name: "Salário", expectedDate: "2026-08-10", amountCents: 200000 },
      ],
      cardProjection: {
        cards: [{ id: "c1", name: "Mastercard", due_day: 15, closing_day: 8 }],
        expenses: [
          { id: "compra", card_id: "c1", date: "2026-08-02", value: 500, bill_competence: "2026-08" },
        ],
        payments: [],
        today: "2026-08-01",
      },
    });

    // Como o salário entra no dia 10 e a fatura só vence no dia 15, o saldo bancário NUNCA fica negativo!
    // Se a projeção usasse a data da compra (02/08), o saldo ficaria -300 no dia 02 e acusaria gap falso.
    expect(result.isCashGapDetected).toBe(false);
    expect(result.maxDeficitCents).toBe(0);

    // O ponto do dia 02 no runway não deve registrar outflow:
    const day2 = result.runway.find((p) => p.date === "2026-08-02");
    expect(day2?.outflowCents).toBe(0);
    expect(day2?.projectedBalanceCents).toBe(20000);

    // O outflow de R$ 500 ocorre exatamente no dia 15 (vencimento):
    const day15 = result.runway.find((p) => p.date === "2026-08-15");
    expect(day15?.outflowCents).toBe(50000);
    expect(day15?.projectedBalanceCents).toBe(170000); // 200 + 2000 - 500 = 1700
  });
});
