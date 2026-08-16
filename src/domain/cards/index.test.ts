import { describe, expect, it } from "vitest";
import {
  autoSelectBillMonth,
  bestPurchaseDay,
  buildCompetenceSummaries,
  cardLimitUsage,
  daysUntilDue,
  invoiceBalance,
  invoiceStatus,
  partitionInvoiceExpenses,
} from "./index";
import { APP_START_DATE } from "@/types";

const TODAY = "2026-08-13";

describe("invoiceBalance (§3.3.3)", () => {
  it("nunca fica negativo (pagamento a maior)", () => {
    expect(invoiceBalance(100000, 120000)).toBe(0);
    expect(invoiceBalance(100000, 100000)).toBe(0);
  });

  it("calcula saldo aberto quando pago < previsto", () => {
    expect(invoiceBalance(100000, 30000)).toBe(70000);
    expect(invoiceBalance(0, 0)).toBe(0);
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
    expect(august?.previstoCents).toBe(20000);
    expect(august?.saldoBrutoCents).toBe(30000);
    expect(august?.saldoPonderadoCents).toBe(20000);
    expect(august?.saldoCents).toBe(20000);
    expect(august?.pagoCents).toBe(0);
  });

  it("soma pagamentos positivos e estornos (negativos) à parte", () => {
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
    expect(august?.saldoCents).toBe(4000); // 100 − 60, estorno não abate pago
  });

  it("saldo nunca negativo (pagamento a maior)", () => {
    const summaries = buildCompetenceSummaries(
      [{ bill_competence: "2026-08", value: 100, report_weight: 1 }],
      [{ competence_month: "2026-08", amount: 150 }],
    );
    expect(summaries[0]?.saldoCents).toBe(0);
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

