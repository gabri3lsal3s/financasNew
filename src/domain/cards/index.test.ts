import { describe, expect, it } from "vitest";
import {
  autoSelectBillMonth,
  bestPurchaseDay,
  buildCompetenceSummaries,
  cardLimitUsage,
  daysUntilDue,
  divideIntoInstallments,
  invoiceBalance,
  invoiceStatus,
  partitionInvoiceExpenses,
  sortCardsByPreference,
} from "./index";
import { APP_START_DATE } from "@/types";

const TODAY = "2026-08-13";

describe("invoiceBalance (§3.3.3)", () => {
  it("nunca fica negativo (pagamento a maior ou estorno maior que o previsto)", () => {
    expect(invoiceBalance(100000, 120000)).toBe(0);
    expect(invoiceBalance(100000, 100000)).toBe(0);
    expect(invoiceBalance(100000, 0, 120000)).toBe(0);
    expect(invoiceBalance(100000, 60000, 50000)).toBe(0);
  });

  it("calcula saldo aberto quando pago < previsto", () => {
    expect(invoiceBalance(100000, 30000)).toBe(70000);
    expect(invoiceBalance(0, 0)).toBe(0);
  });

  it("abate estornos do saldo aberto da fatura", () => {
    expect(invoiceBalance(100000, 30000, 20000)).toBe(50000);
    expect(invoiceBalance(100000, 0, 40000)).toBe(60000);
  });

  it("abate creditoAnteriorCents herdado de competências anteriores", () => {
    expect(invoiceBalance(100000, 30000, 20000, 10000)).toBe(40000);
    expect(invoiceBalance(100000, 0, 0, 120000)).toBe(0);
    expect(invoiceBalance(50000, 20000, 0, 40000)).toBe(0);
  });
});

describe("invoiceStatus", () => {
  it("fechada quando sem pendências", () => {
    expect(invoiceStatus("2026-08", 10, 0, TODAY)).toBe("closed");
  });

  it("vencida quando o vencimento passou", () => {
    // Vencimento 10/08 < 13/08
    expect(invoiceStatus("2026-08", 10, 5000, TODAY)).toBe("overdue");
  });

  it("vence em breve dentro da janela", () => {
    // Vencimento 15/08 — 2 dias após hoje (janela 3)
    expect(invoiceStatus("2026-08", 15, 5000, TODAY)).toBe("near_due");
  });

  it("em aberto fora da janela", () => {
    // Vencimento 20/08 — 7 dias após hoje
    expect(invoiceStatus("2026-08", 20, 5000, TODAY)).toBe("open");
  });

  it("clampa o vencimento ao mês (31/02 → 28/02)", () => {
    expect(invoiceStatus("2026-02", 31, 5000, "2026-02-27")).toBe("near_due");
  });
});

describe("buildCompetenceSummaries (§3.3.3)", () => {
  it("calcula previsto bruto (100%) e previsto ponderado com peso de relatório", () => {
    const summaries = buildCompetenceSummaries(
      [
        { bill_competence: "2026-08", value: 100, report_weight: 1 }, // R$ 100
        { bill_competence: "2026-08", value: 200, report_weight: 0.5 }, // R$ 200 bruto / R$ 100 ponderado
      ],
      [],
    );
    const august = summaries.find((s) => s.month === "2026-08");
    expect(august?.previstoBrutoCents).toBe(30000); // 100 + 200 = 300 reais
    expect(august?.previstoPonderadoCents).toBe(20000); // 100 + 100 = 200 reais
    expect(august?.previstoCents).toBe(30000);
    expect(august?.saldoBrutoCents).toBe(30000);
    expect(august?.saldoPonderadoCents).toBe(20000);
    expect(august?.saldoCents).toBe(30000);
    expect(august?.pagoCents).toBe(0);
  });

  it("soma pagamentos positivos e estornos separadamente e abate ambos do saldo aberto", () => {
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 100, report_weight: 1 }],
      [
        { competence_month: "2026-08", amount: 60 }, // pagamento
        { competence_month: "2026-08", amount: -10 }, // estorno
      ],
    );
    const august = summaries.find((s) => s.month === "2026-08");
    expect(august?.pagoCents).toBe(6000);
    expect(august?.estornoCents).toBe(1000);
    expect(august?.saldoBrutoCents).toBe(3000); // 100 − 60 (pago) − 10 (estorno) = 30
    expect(august?.saldoPonderadoCents).toBe(3000);
    expect(august?.saldoCents).toBe(3000);
  });

  it("estorno integral quita a fatura deixando saldo zero", () => {
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 100, report_weight: 1 }],
      [{ competence_month: "2026-08", amount: -100 }], // estorno de 100%
    );
    const august = summaries.find((s) => s.month === "2026-08");
    expect(august?.pagoCents).toBe(0);
    expect(august?.estornoCents).toBe(10000);
    expect(august?.saldoBrutoCents).toBe(0);
    expect(august?.saldoPonderadoCents).toBe(0);
    expect(august?.saldoCents).toBe(0);
  });

  it("saldo nunca negativo (pagamento a maior ou estorno maior)", () => {
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 100, report_weight: 1 }],
      [{ competence_month: "2026-08", amount: 150 }],
    );
    expect(summaries.find((s) => s.month === "2026-08")?.saldoCents).toBe(0);

    const summariesOverRefund = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 50, report_weight: 1 }],
      [{ competence_month: "2026-08", amount: -80 }],
    );
    expect(summariesOverRefund.find((s) => s.month === "2026-08")?.saldoCents).toBe(0);
  });

  it("transborda crédito de pagamento a maior para abater a fatura da competência posterior", () => {
    const summaries = buildCompetenceSummaries(
      [
        { bill_competence: "2026-08", value: 100, report_weight: 1 }, // R$ 100
        { bill_competence: "2026-09", value: 80, report_weight: 1 }, // R$ 80
      ],
      [{ competence_month: "2026-08", amount: 150 }], // Pagou R$ 150 em 2026-08 (excesso de R$ 50)
    );

    const august = summaries.find((s) => s.month === "2026-08");
    const september = summaries.find((s) => s.month === "2026-09");

    expect(august?.creditoAnteriorCents).toBe(0);
    expect(august?.creditoRestanteCents).toBe(5000); // R$ 50 que transborda
    expect(august?.saldoBrutoCents).toBe(0);

    expect(september?.creditoAnteriorCents).toBe(5000); // R$ 50 herdado
    expect(september?.creditoRestanteCents).toBe(0);
    expect(september?.saldoBrutoCents).toBe(3000); // R$ 80 - R$ 50 = R$ 30
    expect(september?.saldoPonderadoCents).toBe(3000);
    expect(september?.saldoCents).toBe(3000);
  });

  it("transborda crédito em cascata por múltiplos meses até exaustão", () => {
    const summaries = buildCompetenceSummaries(
      [
        { bill_competence: "2026-01", value: 100, report_weight: 1 }, // R$ 100
        { bill_competence: "2026-02", value: 60, report_weight: 1 }, // R$ 60
        { bill_competence: "2026-03", value: 50, report_weight: 1 }, // R$ 50
        { bill_competence: "2026-04", value: 100, report_weight: 1 }, // R$ 100
      ],
      [{ competence_month: "2026-01", amount: 250 }], // Excesso de R$ 150
    );

    const jan = summaries.find((s) => s.month === "2026-01");
    const feb = summaries.find((s) => s.month === "2026-02");
    const mar = summaries.find((s) => s.month === "2026-03");
    const apr = summaries.find((s) => s.month === "2026-04");

    expect(jan?.saldoBrutoCents).toBe(0);
    expect(jan?.creditoRestanteCents).toBe(15000); // R$ 150

    expect(feb?.creditoAnteriorCents).toBe(15000);
    expect(feb?.saldoBrutoCents).toBe(0);
    expect(feb?.creditoRestanteCents).toBe(9000); // 150 - 60 = 90

    expect(mar?.creditoAnteriorCents).toBe(9000);
    expect(mar?.saldoBrutoCents).toBe(0);
    expect(mar?.creditoRestanteCents).toBe(4000); // 90 - 50 = 40

    expect(apr?.creditoAnteriorCents).toBe(4000);
    expect(apr?.saldoBrutoCents).toBe(6000); // 100 - 40 = 60
    expect(apr?.creditoRestanteCents).toBe(0);
  });

  it("transborda crédito de estorno superior às despesas para o mês seguinte", () => {
    const summaries = buildCompetenceSummaries(
      [
        { bill_competence: "2026-08", value: 50, report_weight: 1 },
        { bill_competence: "2026-09", value: 70, report_weight: 1 },
      ],
      [{ competence_month: "2026-08", amount: -80 }], // Estorno de R$ 80 sobre fatura de R$ 50
    );

    const august = summaries.find((s) => s.month === "2026-08");
    const september = summaries.find((s) => s.month === "2026-09");

    expect(august?.saldoBrutoCents).toBe(0);
    expect(august?.creditoRestanteCents).toBe(3000); // R$ 30

    expect(september?.creditoAnteriorCents).toBe(3000);
    expect(september?.saldoBrutoCents).toBe(4000); // 70 - 30 = 40
    expect(september?.creditoRestanteCents).toBe(0);
  });

  it("abate saldo ponderado proporcionalmente ao crédito bancário acumulado", () => {
    const summaries = buildCompetenceSummaries(
      [
        { bill_competence: "2026-08", value: 100, report_weight: 0.5 }, // R$ 100 bruto, R$ 50 ponderado
        { bill_competence: "2026-09", value: 80, report_weight: 0.5 }, // R$ 80 bruto, R$ 40 ponderado
      ],
      [{ competence_month: "2026-08", amount: 120 }], // Pagou R$ 120 (excesso bancário R$ 20)
    );

    const august = summaries.find((s) => s.month === "2026-08");
    const september = summaries.find((s) => s.month === "2026-09");

    expect(august?.saldoBrutoCents).toBe(0);
    expect(august?.saldoPonderadoCents).toBe(0);
    expect(august?.creditoRestanteCents).toBe(2000); // R$ 20

    expect(september?.creditoAnteriorCents).toBe(2000);
    expect(september?.saldoBrutoCents).toBe(6000); // 80 - 20 = 60
    expect(september?.saldoPonderadoCents).toBe(2000); // 40 - 20 = 20
  });

  it("sintetiza a competência seguinte quando há sobra de crédito após a última fatura", () => {
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 100, report_weight: 1 }],
      [{ competence_month: "2026-08", amount: 150 }],
    );

    expect(summaries.map((s) => s.month)).toEqual(["2026-09", "2026-08"]);
    const september = summaries.find((s) => s.month === "2026-09");
    expect(september).toMatchObject({
      previstoBrutoCents: 0,
      pagoCents: 0,
      creditoAnteriorCents: 5000,
      creditoRestanteCents: 5000,
      saldoBrutoCents: 0,
    });
  });

  it("despesas sem competência não entram em nenhuma fatura", () => {
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: null, value: 100, report_weight: 1 }],
      [],
    );
    expect(summaries).toHaveLength(0);
  });

  it("ordena competências da mais recente para a mais antiga", () => {
    const summaries = buildCompetenceSummaries(
      [
        { bill_competence: "2026-07", value: 10, report_weight: 1 },
        { bill_competence: "2026-08", value: 10, report_weight: 1 },
      ],
      [],
    );
    expect(summaries.map((s) => s.month)).toEqual(["2026-08", "2026-07"]);
  });
});

describe("autoSelectBillMonth (§3.3.3)", () => {
  it("mês atual quando tem pendências", () => {
    expect(autoSelectBillMonth([{ month: "2026-08", saldoCents: 5000 }], TODAY)).toBe("2026-08");
  });

  it("varre para trás pelo mês mais recente com pendências", () => {
    const summaries = [
      { month: "2026-06", saldoCents: 3000 },
      { month: "2026-07", saldoCents: 8000 },
      { month: "2026-05", saldoCents: 1000 },
    ];
    expect(autoSelectBillMonth(summaries, TODAY)).toBe("2026-07");
  });

  it("ignora meses anteriores ao APP_START_DATE", () => {
    const summaries = [
      { month: "2025-12", saldoCents: 9999 },
      { month: "2026-01", saldoCents: 1000 },
    ];
    expect(autoSelectBillMonth(summaries, TODAY)).toBe("2026-01");
  });

  it("sem pendências no passado, tenta o mês seguinte", () => {
    const summaries = [{ month: "2026-09", saldoCents: 4000 }];
    expect(autoSelectBillMonth(summaries, TODAY)).toBe("2026-09");
  });

  it("sem pendências em lugar nenhum, retorna o mês atual", () => {
    expect(autoSelectBillMonth([{ month: "2026-03", saldoCents: 0 }], TODAY)).toBe("2026-08");
  });

  it("APP_START_DATE é exportado para a UI", () => {
    expect(APP_START_DATE).toBe("2026-01-01");
  });
});

describe("cardLimitUsage", () => {
  it("calcula limite total, utilizado e disponível corretamente", () => {
    const result = cardLimitUsage(5000, 150000); // R$ 5.000 de limite, R$ 1.500 utilizados
    expect(result.totalLimitCents).toBe(500000);
    expect(result.usedLimitCents).toBe(150000);
    expect(result.availableLimitCents).toBe(350000);
    expect(result.usagePercentage).toBe(30);
  });

  it("retorna null para limite disponível se não houver limite configurado", () => {
    const result = cardLimitUsage(null, 25000);
    expect(result.totalLimitCents).toBeNull();
    expect(result.usedLimitCents).toBe(25000);
    expect(result.availableLimitCents).toBeNull();
    expect(result.usagePercentage).toBe(0);
  });

  it("disponível nunca fica negativo quando o uso excede o limite", () => {
    const result = cardLimitUsage(1000, 120000); // R$ 1.000 de limite, R$ 1.200 utilizados
    expect(result.totalLimitCents).toBe(100000);
    expect(result.availableLimitCents).toBe(0);
    expect(result.usagePercentage).toBe(100);
  });
});

describe("bestPurchaseDay", () => {
  it("retorna o dia seguinte ao fechamento", () => {
    expect(bestPurchaseDay(10)).toBe(11);
    expect(bestPurchaseDay(15)).toBe(16);
    expect(bestPurchaseDay(1)).toBe(2);
  });

  it("retorna dia 1 se fechamento for 31", () => {
    expect(bestPurchaseDay(31)).toBe(1);
  });
});

describe("partitionInvoiceExpenses (fatura separada — parceladas × à vista)", () => {
  it("separa parceladas (installments_total > 1) das à vista (1 parcela)", () => {
    const { installments, regular } = partitionInvoiceExpenses([
      { date: "2026-08-10", installments_total: 1 },
      { date: "2026-08-05", installments_total: 3 },
      { date: "2026-08-20", installments_total: 12 },
      { date: "2026-08-01", installments_total: 1 },
    ]);
    expect(installments.map((e) => e.date)).toEqual(["2026-08-20", "2026-08-05"]);
    expect(regular.map((e) => e.date)).toEqual(["2026-08-10", "2026-08-01"]);
  });

  it("ordena cada grupo por data decrescente (mais recentes primeiro)", () => {
    const { installments, regular } = partitionInvoiceExpenses([
      { date: "2026-07-01", installments_total: 2 },
      { date: "2026-08-15", installments_total: 2 },
      { date: "2026-07-20", installments_total: 2 },
      { date: "2026-08-02", installments_total: 1 },
      { date: "2026-08-20", installments_total: 1 },
    ]);
    expect(installments.map((e) => e.date)).toEqual(["2026-08-15", "2026-07-20", "2026-07-01"]);
    expect(regular.map((e) => e.date)).toEqual(["2026-08-20", "2026-08-02"]);
  });

  it("não muta a lista de entrada", () => {
    const input = [
      { date: "2026-08-10", installments_total: 1 },
      { date: "2026-08-05", installments_total: 3 },
    ];
    partitionInvoiceExpenses(input);
    expect(input[0]?.date).toBe("2026-08-10");
    expect(input[1]?.date).toBe("2026-08-05");
  });

  it("lista vazia → grupos vazios", () => {
    const { installments, regular } = partitionInvoiceExpenses([]);
    expect(installments).toEqual([]);
    expect(regular).toEqual([]);
  });
});

describe("daysUntilDue", () => {
  it("retorna dias restantes até o vencimento", () => {
    // Fatura 2026-08, vencimento dia 20, hoje 2026-08-13 -> 7 dias
    expect(daysUntilDue("2026-08", 20, "2026-08-13")).toBe(7);
  });

  it("retorna 0 quando vence hoje", () => {
    expect(daysUntilDue("2026-08", 13, "2026-08-13")).toBe(0);
  });

  it("retorna negativo quando a fatura está vencida", () => {
    // Vencimento dia 10, hoje dia 13 -> -3 dias
    expect(daysUntilDue("2026-08", 10, "2026-08-13")).toBe(-3);
  });
});

describe("divideIntoInstallments — conservação estrita de centavos (§3.2.2 / D12)", () => {
  it("divide R$ 100 em 3 parcelas distribuindo o resto nas primeiras com soma exata", () => {
    const items = divideIntoInstallments({
      totalCents: 10000,
      count: 3,
      startDate: "2026-08-15",
      closingDay: 10,
    });

    expect(items).toHaveLength(3);
    expect(items[0]).toEqual({
      installmentNumber: 1,
      installmentsTotal: 3,
      valueCents: 3334,
      date: "2026-08-15",
      billCompetence: "2026-09", // Compra 15 >= 10 -> fatura setembro
    });
    expect(items[1]).toEqual({
      installmentNumber: 2,
      installmentsTotal: 3,
      valueCents: 3333,
      date: "2026-09-15",
      billCompetence: "2026-10",
    });
    expect(items[2]).toEqual({
      installmentNumber: 3,
      installmentsTotal: 3,
      valueCents: 3333,
      date: "2026-10-15",
      billCompetence: "2026-11",
    });

    const sum = items.reduce((acc, curr) => acc + curr.valueCents, 0);
    expect(sum).toBe(10000);
  });

  it("conserva a soma de centavos estritamente idêntica para qualquer quantidade de parcelas de 1 a 60", () => {
    const testAmountCents = 123457; // R$ 1.234,57

    for (let count = 1; count <= 60; count++) {
      const items = divideIntoInstallments({
        totalCents: testAmountCents,
        count,
        startDate: "2026-05-10",
      });

      expect(items).toHaveLength(count);

      const sum = items.reduce((acc, curr) => acc + curr.valueCents, 0);
      expect(sum).toBe(testAmountCents);

      // Invariante de distribuição homogênea: a maior e a menor parcela diferem em no máximo 1 centavo
      const maxVal = Math.max(...items.map((i) => i.valueCents));
      const minVal = Math.min(...items.map((i) => i.valueCents));
      expect(maxVal - minVal).toBeLessThanOrEqual(1);

      // Numeração sequencial 1-based
      items.forEach((item, idx) => {
        expect(item.installmentNumber).toBe(idx + 1);
        expect(item.installmentsTotal).toBe(count);
      });
    }
  });

  it("distribui centavos residuais em compras de baixo valor (5 centavos em 12x)", () => {
    const items = divideIntoInstallments({
      totalCents: 5,
      count: 12,
      startDate: "2026-01-01",
    });

    expect(items).toHaveLength(12);
    const sum = items.reduce((acc, curr) => acc + curr.valueCents, 0);
    expect(sum).toBe(5);

    // 5 primeiras recebem 1 centavo, 7 últimas recebem 0
    expect(items.slice(0, 5).every((i) => i.valueCents === 1)).toBe(true);
    expect(items.slice(5).every((i) => i.valueCents === 0)).toBe(true);
  });

  it("conserva centavos com precisão para compras de valor elevado em 60x", () => {
    const items = divideIntoInstallments({
      totalCents: 99999999, // R$ 999.999,99
      count: 60,
      startDate: "2026-01-01",
    });

    expect(items).toHaveLength(60);
    const sum = items.reduce((acc, curr) => acc + curr.valueCents, 0);
    expect(sum).toBe(99999999);
  });

  it("calcula snapshot de competência antes e depois do closing day", () => {
    // Compra antes do closing day (05 < 10) -> fatura do mesmo mês
    const beforeClosing = divideIntoInstallments({
      totalCents: 6000,
      count: 2,
      startDate: "2026-08-05",
      closingDay: 10,
    });
    expect(beforeClosing[0]?.billCompetence).toBe("2026-08");
    expect(beforeClosing[1]?.billCompetence).toBe("2026-09");

    // Compra a partir do closing day (10 >= 10) -> fatura do mês seguinte
    const onClosing = divideIntoInstallments({
      totalCents: 6000,
      count: 2,
      startDate: "2026-08-10",
      closingDay: 10,
    });
    expect(onClosing[0]?.billCompetence).toBe("2026-09");
    expect(onClosing[1]?.billCompetence).toBe("2026-10");

    // Sem closingDay informado -> billCompetence é null
    const noClosing = divideIntoInstallments({
      totalCents: 6000,
      count: 2,
      startDate: "2026-08-10",
      closingDay: null,
    });
    expect(noClosing.every((i) => i.billCompetence === null)).toBe(true);
  });

  it("aplica clamping em finais de mês (31 de janeiro em 4 meses)", () => {
    const items = divideIntoInstallments({
      totalCents: 4000,
      count: 4,
      startDate: "2026-01-31",
    });

    expect(items.map((i) => i.date)).toEqual([
      "2026-01-31",
      "2026-02-28", // clamped para o último dia de fevereiro (ano comum)
      "2026-03-31",
      "2026-04-30", // clamped para 30 em abril
    ]);
  });

  it("lança erro em entradas inválidas ou fora das invariantes", () => {
    // Menos de 1 parcela
    expect(() =>
      divideIntoInstallments({
        totalCents: 1000,
        count: 0,
        startDate: "2026-01-01",
      }),
    ).toThrow();

    // Mais de 60 parcelas
    expect(() =>
      divideIntoInstallments({
        totalCents: 1000,
        count: 61,
        startDate: "2026-01-01",
      }),
    ).toThrow();

    // Total negativo
    expect(() =>
      divideIntoInstallments({
        totalCents: -50,
        count: 2,
        startDate: "2026-01-01",
      }),
    ).toThrow();

    // Total não inteiro
    expect(() =>
      divideIntoInstallments({
        totalCents: 100.5,
        count: 2,
        startDate: "2026-01-01",
      }),
    ).toThrow();
  });
});

describe("sortCardsByPreference", () => {
  const cards = [
    { id: "c1", name: "Nubank" },
    { id: "c2", name: "Itaú" },
    { id: "c3", name: "XP" },
    { id: "c4", name: "Inter" },
  ];

  it("retorna cópia idêntica se não houver preferências", () => {
    const result = sortCardsByPreference(cards);
    expect(result).toEqual(cards);
    expect(result).not.toBe(cards);
  });

  it("coloca o cartão principal no início (índice 0)", () => {
    const result = sortCardsByPreference(cards, { primaryCardId: "c3" });
    expect(result.map((c) => c.id)).toEqual(["c3", "c1", "c2", "c4"]);
  });

  it("ordena conforme cardOrder quando fornecido", () => {
    const result = sortCardsByPreference(cards, {
      cardOrder: ["c4", "c3", "c2", "c1"],
    });
    expect(result.map((c) => c.id)).toEqual(["c4", "c3", "c2", "c1"]);
  });

  it("prioriza primaryCardId mesmo se cardOrder indicar outra posição", () => {
    const result = sortCardsByPreference(cards, {
      primaryCardId: "c2",
      cardOrder: ["c4", "c3", "c2", "c1"],
    });
    expect(result.map((c) => c.id)).toEqual(["c2", "c4", "c3", "c1"]);
  });

  it("anexa cartões não incluídos em cardOrder ao final de forma estável", () => {
    const result = sortCardsByPreference(cards, {
      cardOrder: ["c3", "c1"],
    });
    expect(result.map((c) => c.id)).toEqual(["c3", "c1", "c2", "c4"]);
  });

  it("ignora primaryCardId inexistente sem estourar erro", () => {
    const result = sortCardsByPreference(cards, { primaryCardId: "inexistente" });
    expect(result.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c4"]);
  });

  it("lida graciosamente com listas vazias ou com 1 único item", () => {
    expect(sortCardsByPreference([])).toEqual([]);
    expect(sortCardsByPreference([cards[0]!])).toEqual([cards[0]!]);
  });
});

