import { describe, expect, it } from "vitest";
import { computeWeeklyDueRadar } from "./weekly-radar";

describe("computeWeeklyDueRadar — Motor Puro de Projeção Semanal", () => {
  const baseDate = "2026-08-10";

  it("retorna hasObligations: false quando não há faturas nem dívidas nos próximos 7 dias", () => {
    const res = computeWeeklyDueRadar({
      debts: [],
      invoices: [],
      realCashCents: 150000,
      today: baseDate,
    });

    expect(res.hasObligations).toBe(false);
    expect(res.items).toHaveLength(0);
    expect(res.totalDueCents).toBe(0);
    expect(res.freeBalanceCents).toBe(150000);
    expect(res.isDeficitRisk).toBe(false);
  });

  it("ignora dívidas a receber ou já quitadas", () => {
    const res = computeWeeklyDueRadar({
      debts: [
        { id: "d1", name: "Recebível", type: "receivable", amount: 200, due_date: "2026-08-12", paid_at: null },
        { id: "d2", name: "Já paga", type: "payable", amount: 150, due_date: "2026-08-12", paid_at: "2026-08-09" },
      ],
      invoices: [],
      realCashCents: 100000,
      today: baseDate,
    });

    expect(res.hasObligations).toBe(false);
    expect(res.items).toHaveLength(0);
  });

  it("filtra obrigações entre hoje e D+7 e calcula a margem de saldo livre", () => {
    const res = computeWeeklyDueRadar({
      debts: [
        { id: "d1", name: "Internet Fibra", type: "payable", amount: 120, due_date: "2026-08-12", paid_at: null },
        { id: "d2", name: "Aluguel Distante", type: "payable", amount: 1500, due_date: "2026-08-28", paid_at: null }, // fora do horizonte
      ],
      invoices: [
        { id: "inv-c1", name: "Fatura Nubank", dueDate: "2026-08-15", amountCents: 45000 },
      ],
      realCashCents: 100000, // R$ 1.000,00
      today: baseDate,
    });

    expect(res.hasObligations).toBe(true);
    expect(res.items).toHaveLength(2);

    // Internet: R$ 120,00 + Fatura: R$ 450,00 = R$ 570,00 (57000 cents)
    expect(res.totalDueCents).toBe(57000);
    // Saldo livre: R$ 1.000 - R$ 570 = R$ 430,00
    expect(res.freeBalanceCents).toBe(43000);
    expect(res.isDeficitRisk).toBe(false);

    // Ordenação: 2026-08-12 vem antes de 2026-08-15
    expect(res.items[0]!.name).toBe("Internet Fibra");
    expect(res.items[0]!.daysUntilDue).toBe(2);
    expect(res.items[0]!.status).toBe("due_soon");

    expect(res.items[1]!.name).toBe("Fatura Nubank");
    expect(res.items[1]!.daysUntilDue).toBe(5);
    expect(res.items[1]!.status).toBe("due_soon");
  });

  it("sinaliza isDeficitRisk: true quando as contas da semana superam o saldo em conta", () => {
    const res = computeWeeklyDueRadar({
      debts: [
        { id: "d1", name: "Parcela Carro", type: "payable", amount: 900, due_date: "2026-08-10", paid_at: null }, // vence hoje
      ],
      invoices: [],
      realCashCents: 50000, // R$ 500,00
      today: baseDate,
    });

    expect(res.hasObligations).toBe(true);
    expect(res.totalDueCents).toBe(90000);
    expect(res.freeBalanceCents).toBe(-40000);
    expect(res.isDeficitRisk).toBe(true);
    expect(res.items[0]!.status).toBe("due_today");
    expect(res.items[0]!.daysUntilDue).toBe(0);
  });

  it("ignora faturas com saldo zerado ou negativo (faturas já quitadas)", () => {
    const res = computeWeeklyDueRadar({
      debts: [],
      invoices: [
        { id: "inv-paid-1", name: "Fatura Rico (2026-07)", dueDate: baseDate, amountCents: 0 },
        { id: "inv-paid-2", name: "Fatura Rico (2026-05)", dueDate: baseDate, amountCents: -500 },
      ],
      realCashCents: 200000,
      today: baseDate,
    });

    expect(res.hasObligations).toBe(false);
    expect(res.items).toHaveLength(0);
    expect(res.totalDueCents).toBe(0);
  });

  it("ignora faturas antigas com vencimento fora do horizonte semanal (mesmo que com saldo)", () => {
    const res = computeWeeklyDueRadar({
      debts: [],
      invoices: [
        { id: "inv-old-1", name: "Fatura Rico (2026-05)", dueDate: "2026-05-15", amountCents: 3144 },
        { id: "inv-old-2", name: "Fatura Rico (2026-06)", dueDate: "2026-06-15", amountCents: 580 },
      ],
      realCashCents: 200000,
      today: baseDate, // 2026-08-10
    });

    expect(res.hasObligations).toBe(false);
    expect(res.items).toHaveLength(0);
  });

  it("classifica corretamente fatura recentemente vencida como overdue com dias negativos", () => {
    const res = computeWeeklyDueRadar({
      debts: [],
      invoices: [
        { id: "inv-recent-1", name: "Fatura Rico (2026-08)", dueDate: "2026-08-07", amountCents: 15000 },
      ],
      realCashCents: 200000,
      today: baseDate, // 2026-08-10 (venceu há 3 dias)
    });

    expect(res.hasObligations).toBe(true);
    expect(res.items).toHaveLength(1);
    expect(res.items[0]!.status).toBe("overdue");
    expect(res.items[0]!.daysUntilDue).toBe(-3);
  });
});

