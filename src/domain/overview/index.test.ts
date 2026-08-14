import { describe, expect, it } from "vitest";
import {
  accountsNet,
  buildDailyFlow,
  computeOverview,
  cumulativeBalance,
  monthlySeries,
  openInvoicesTotal,
  percentChange,
  runwayMonths,
} from "./index";

const TODAY = "2026-08-13";

describe("computeOverview (§3.6 — KPIs fundamentais)", () => {
  it("calcula saldo = rendas − despesas − investimentos", () => {
    const totals = computeOverview(500000, 300000, 50000);
    expect(totals.balanceCents).toBe(150000);
    expect(totals.savingsRatePercent).toBe(30); // 150.000 / 500.000
  });

  it("savings rate pode ser negativo", () => {
    const totals = computeOverview(100000, 150000, 0);
    expect(totals.balanceCents).toBe(-50000);
    expect(totals.savingsRatePercent).toBe(-50);
  });

  it("savings rate 0 sem rendas (evita divisão por zero)", () => {
    expect(computeOverview(0, 10000, 0).savingsRatePercent).toBe(0);
  });
});

describe("percentChange (§3.6 — comparativo)", () => {
  it("variação percentual relativa ao período anterior", () => {
    expect(percentChange(120000, 100000)).toBe(20);
    expect(percentChange(80000, 100000)).toBe(-20);
  });

  it("null quando não há base anterior", () => {
    expect(percentChange(5000, 0)).toBeNull();
  });
});

describe("accountsNet (§3.6 — saldo líquido de contas)", () => {
  it("receber − pagar − faturas em aberto", () => {
    expect(accountsNet(100000, 40000, 30000)).toBe(30000);
  });

  it("pode ser negativo", () => {
    expect(accountsNet(10000, 50000, 20000)).toBe(-60000);
  });
});

describe("openInvoicesTotal (§3.3.3/§3.6 — faturas em aberto)", () => {
  it("soma o saldo da competência selecionada de cada cartão", () => {
    const expenses = [
      { card_id: "c1", bill_competence: "2026-08", value: 100, report_weight: 1 },
      { card_id: "c2", bill_competence: "2026-08", value: 200, report_weight: 0.5 }, // 100 no relatório
    ];
    const payments = [
      { card_id: "c1", competence_month: "2026-08", amount: 40 },
    ];
    // c1: 100 − 40 = 60 · c2: 100 − 0 = 100 → total 160
    expect(openInvoicesTotal(expenses, payments, TODAY)).toBe(16000);
  });

  it("ignora despesas sem cartão", () => {
    const expenses = [{ card_id: null, bill_competence: "2026-08", value: 999, report_weight: 1 }];
    expect(openInvoicesTotal(expenses, [], TODAY)).toBe(0);
  });

  it("sem movimentos, total zero", () => {
    expect(openInvoicesTotal([], [], TODAY)).toBe(0);
  });
});

describe("buildDailyFlow (§3.6 — fluxo diário)", () => {
  it("agrega por dia do mês e zera dias sem movimento", () => {
    const flows = buildDailyFlow("2026-08", [
      { date: "2026-08-05", kind: "income", amountCents: 100000 },
      { date: "2026-08-05", kind: "expense", amountCents: 30000 },
      { date: "2026-08-10", kind: "expense", amountCents: 20000 },
    ]);
    expect(flows).toHaveLength(31);
    const day5 = flows[4];
    const day10 = flows[9];
    expect(day5?.incomeCents).toBe(100000);
    expect(day5?.expenseCents).toBe(30000);
    expect(day10?.expenseCents).toBe(20000);
    expect(day10?.incomeCents).toBe(0);
    expect(day5?.maxCents).toBe(130000);
  });

  it("ignora lançamentos fora do mês", () => {
    const flows = buildDailyFlow("2026-08", [
      { date: "2026-07-31", kind: "expense", amountCents: 999999 },
      { date: "2026-09-01", kind: "expense", amountCents: 999999 },
    ]);
    const total = flows.reduce((acc, f) => acc + f.expenseCents, 0);
    expect(total).toBe(0);
  });
});

describe("monthlySeries (F8 — sparklines dos KPIs)", () => {
  it("agrega totais mensais no período (antiga → recente)", () => {
    const series = monthlySeries(
      [
        { date: "2026-03-05", kind: "income", amountCents: 100000 },
        { date: "2026-03-20", kind: "expense", amountCents: 40000 },
        { date: "2026-05-02", kind: "income", amountCents: 200000 },
        { date: "2026-05-10", kind: "expense", amountCents: 50000 },
      ],
      "2026-03",
      3,
    );
    expect(series).toEqual([
      { month: "2026-03", incomeCents: 100000, expenseCents: 40000, balanceCents: 60000 },
      { month: "2026-04", incomeCents: 0, expenseCents: 0, balanceCents: 0 },
      { month: "2026-05", incomeCents: 200000, expenseCents: 50000, balanceCents: 150000 },
    ]);
  });

  it("investimento reduz o saldo do mês", () => {
    const series = monthlySeries(
      [{ date: "2026-08-01", kind: "investment", amountCents: 30000 }],
      "2026-08",
      1,
    );
    expect(series[0]?.balanceCents).toBe(-30000);
  });

  it("ignora lançamentos fora do período", () => {
    const series = monthlySeries(
      [{ date: "2026-01-01", kind: "expense", amountCents: 999999 }],
      "2026-02",
      1,
    );
    expect(series[0]?.expenseCents).toBe(0);
  });
});

describe("cumulativeBalance (F8 — curva de saldo acumulado)", () => {
  it("acumula o saldo dia a dia", () => {
    const flow = buildDailyFlow("2026-08", [
      { date: "2026-08-05", kind: "income", amountCents: 100000 },
      { date: "2026-08-06", kind: "expense", amountCents: 30000 },
      { date: "2026-08-10", kind: "expense", amountCents: 20000 },
    ]);
    const curve = cumulativeBalance(flow);
    expect(curve).toHaveLength(31);
    expect(curve[4]?.balanceCents).toBe(100000); // dia 5
    expect(curve[5]?.balanceCents).toBe(70000); // dia 6
    expect(curve[9]?.balanceCents).toBe(50000); // dia 10
    expect(curve[30]?.balanceCents).toBe(50000); // fim do mês
  });

  it("pode ficar negativo em picos de despesa", () => {
    const flow = buildDailyFlow("2026-08", [
      { date: "2026-08-01", kind: "expense", amountCents: 90000 },
    ]);
    expect(cumulativeBalance(flow)[0]?.balanceCents).toBe(-90000);
  });
});

describe("runwayMonths (F8 — saúde da poupança)", () => {
  it("meses de reserva = renda ÷ despesas", () => {
    expect(runwayMonths(600000, 200000)).toBe(3);
    expect(runwayMonths(500000, 400000)).toBeCloseTo(1.25, 5);
  });

  it("null sem despesas (sem divisão por zero)", () => {
    expect(runwayMonths(600000, 0)).toBeNull();
  });
});
