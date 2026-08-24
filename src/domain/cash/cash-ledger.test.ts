import { describe, expect, it } from "vitest";
import {
  calculateRealCashBalance,
  calculateSafeToSpend,
  type CashCheckpointData,
} from "./cash-ledger";

describe("Cash Ledger Domain — calculateRealCashBalance & resolveCashFlowEvents", () => {
  it("calcula o saldo de caixa a partir do zero quando não há checkpoint cadastrado", () => {
    const res = calculateRealCashBalance({
      incomes: [
        { id: "inc-1", date: "2026-08-05", value: 5000, description: "Salário" },
        { id: "inc-2", date: "2026-08-10", value: 500, description: "Dividendos" },
      ],
      expenses: [
        { id: "exp-1", date: "2026-08-06", value: 1200, payment_method: "pix", description: "Aluguel" },
        { id: "exp-2", date: "2026-08-08", value: 200, payment_method: "debit", description: "Mercado" },
      ],
      referenceDate: "2026-08-24",
    });

    // 5000 + 500 = 5500 em entradas
    // 1200 + 200 = 1400 em saídas
    // Saldo = 4100 em reais = 410000 centavos
    expect(res.currentBalanceCents).toBe(410000);
    expect(res.inflowSinceCheckpointCents).toBe(550000);
    expect(res.outflowSinceCheckpointCents).toBe(140000);
    expect(res.checkpointBalanceCents).toBe(0);
    expect(res.latestCheckpoint).toBeNull();
    expect(res.eventsSinceCheckpoint).toHaveLength(4);
  });

  it("NÃO desconta compras no cartão de crédito do caixa diário", () => {
    const res = calculateRealCashBalance({
      incomes: [{ id: "inc-1", date: "2026-08-01", value: 3000 }],
      expenses: [
        { id: "exp-1", date: "2026-08-02", value: 500, payment_method: "credit", description: "Compra Crédito" },
        { id: "exp-2", date: "2026-08-03", value: 150, payment_method: "pix", description: "Farmácia PIX" },
      ],
      referenceDate: "2026-08-24",
    });

    // Apenas a despesa em PIX desconta do caixa (150). A compra de crédito (500) NÃO afeta o caixa.
    // Saldo = 3000 - 150 = 2850
    expect(res.currentBalanceCents).toBe(285000);
    expect(res.eventsSinceCheckpoint.map((e) => e.kind)).toEqual(["income", "cash_expense"]);
  });

  it("desconta o pagamento de faturas de cartão do caixa na data do pagamento", () => {
    const res = calculateRealCashBalance({
      incomes: [{ id: "inc-1", date: "2026-08-01", value: 5000 }],
      expenses: [
        { id: "exp-credit", date: "2026-08-05", value: 1800, payment_method: "credit" },
      ],
      cardPayments: [
        { id: "pay-1", date: "2026-08-10", amount: 1800, note: "Pagamento Fatura Nubank" },
      ],
      referenceDate: "2026-08-24",
    });

    // 5000 - 1800 (pagamento fatura) = 3200
    expect(res.currentBalanceCents).toBe(320000);
    expect(res.outflowSinceCheckpointCents).toBe(180000);
  });

  it("soma estornos de fatura como entrada de caixa em conta", () => {
    const res = calculateRealCashBalance({
      incomes: [{ id: "inc-1", date: "2026-08-01", value: 2000 }],
      cardPayments: [
        { id: "refund-1", date: "2026-08-12", amount: -250, is_refund: true, note: "Estorno compra cancelada" },
      ],
      referenceDate: "2026-08-24",
    });

    // 2000 + 250 = 2250
    expect(res.currentBalanceCents).toBe(225000);
    expect(res.inflowSinceCheckpointCents).toBe(225000);
  });

  it("processa dívidas pagas e recebidas considerando paid_at", () => {
    const res = calculateRealCashBalance({
      incomes: [{ id: "inc-1", date: "2026-08-01", value: 3000 }],
      debts: [
        // Dívida a pagar já quitada -> saída de caixa
        { id: "debt-1", name: "IPVA", type: "payable", amount: 600, paid_at: "2026-08-15T10:00:00Z" },
        // Dívida a pagar ainda PENDENTE -> NÃO afeta o saldo de hoje
        { id: "debt-2", name: "Empréstimo Amigo", type: "payable", amount: 400, paid_at: null },
        // Dívida a receber já recebida -> entrada de caixa
        { id: "debt-3", name: "Venda Celular", type: "receivable", amount: 800, paid_at: "2026-08-18T14:00:00Z" },
      ],
      referenceDate: "2026-08-24",
    });

    // 3000 + 800 (recebido) - 600 (pago) = 3200
    expect(res.currentBalanceCents).toBe(320000);
    expect(res.inflowSinceCheckpointCents).toBe(380000);
    expect(res.outflowSinceCheckpointCents).toBe(60000);
  });

  it("desconta aportes de investimentos como saída de caixa para corretora", () => {
    const res = calculateRealCashBalance({
      incomes: [{ id: "inc-1", date: "2026-08-01", value: 4000 }],
      contributions: [
        { id: "contrib-1", date: "2026-08-14", amount: 1500, notes: "Aporte Tesouro + FIIs" },
      ],
      referenceDate: "2026-08-24",
    });

    // 4000 - 1500 = 2500
    expect(res.currentBalanceCents).toBe(250000);
    expect(res.outflowSinceCheckpointCents).toBe(150000);
  });

  it("desconsidera transações futuras (> referenceDate) no saldo atual de hoje", () => {
    const res = calculateRealCashBalance({
      incomes: [
        { id: "inc-1", date: "2026-08-01", value: 3000 },
        { id: "inc-future", date: "2026-08-30", value: 5000, description: "Salário fim do mês" },
      ],
      expenses: [
        { id: "exp-1", date: "2026-08-10", value: 500, payment_method: "pix" },
        { id: "exp-future", date: "2026-08-28", value: 800, payment_method: "pix", description: "Boleto futuro" },
      ],
      referenceDate: "2026-08-24",
    });

    // Apenas transações <= 2026-08-24 entram no saldo de hoje (3000 - 500 = 2500)
    expect(res.currentBalanceCents).toBe(250000);
    expect(res.eventsSinceCheckpoint).toHaveLength(2);
  });

  it("aplica checkpoint de saldo âncora ('Bater com o banco') e calcula deltas estritamente a partir dele", () => {
    const checkpoint: CashCheckpointData = {
      id: "chk-1",
      date: "2026-08-20",
      balanceCents: 450000, // R$ 4.500,00 aferido no banco no dia 20
      createdAt: "2026-08-20T12:00:00Z",
    };

    const res = calculateRealCashBalance({
      checkpoint,
      incomes: [
        // Evento ANTERIOR ao checkpoint -> Ignorado pelo cálculo (já embutido nos R$ 4.500)
        { id: "inc-old", date: "2026-08-05", value: 10000, created_at: "2026-08-05T08:00:00Z" },
        // Evento POSTERIOR ao checkpoint -> Computado
        { id: "inc-new", date: "2026-08-22", value: 800, created_at: "2026-08-22T10:00:00Z" },
      ],
      expenses: [
        // Evento ANTERIOR ao checkpoint -> Ignorado
        { id: "exp-old", date: "2026-08-10", value: 3000, payment_method: "pix", created_at: "2026-08-10T12:00:00Z" },
        // Evento POSTERIOR ao checkpoint -> Computado
        { id: "exp-new", date: "2026-08-23", value: 300, payment_method: "pix", created_at: "2026-08-23T15:00:00Z" },
      ],
      referenceDate: "2026-08-24",
    });

    // Saldo = 4500 (âncora) + 800 (entrada nova) - 300 (saída nova) = 5000 = 500000 centavos
    expect(res.currentBalanceCents).toBe(500000);
    expect(res.checkpointBalanceCents).toBe(450000);
    expect(res.inflowSinceCheckpointCents).toBe(80000);
    expect(res.outflowSinceCheckpointCents).toBe(30000);
    expect(res.eventsSinceCheckpoint).toHaveLength(2);
    expect(res.latestCheckpoint).toEqual(checkpoint);
  });

  it("respeita timestamps de criação para desempate no mesmo dia do checkpoint", () => {
    const checkpoint: CashCheckpointData = {
      date: "2026-08-24",
      balanceCents: 100000, // R$ 1.000,00 às 12:00
      createdAt: "2026-08-24T12:00:00Z",
    };

    const res = calculateRealCashBalance({
      checkpoint,
      incomes: [
        // Criado ANTES do checkpoint no mesmo dia -> já embutido no saldo aferido
        { id: "inc-before", date: "2026-08-24", value: 200, created_at: "2026-08-24T09:00:00Z" },
        // Criado DEPOIS do checkpoint no mesmo dia -> deve somar
        { id: "inc-after", date: "2026-08-24", value: 300, created_at: "2026-08-24T15:00:00Z" },
      ],
      referenceDate: "2026-08-24",
    });

    // 1000 + 300 = 1300
    expect(res.currentBalanceCents).toBe(130000);
    expect(res.inflowSinceCheckpointCents).toBe(30000);
    expect(res.eventsSinceCheckpoint).toHaveLength(1);
    expect(res.eventsSinceCheckpoint[0]?.id).toBe("inc-after");
  });
});

describe("Safe-to-Spend Forecast — calculateSafeToSpend", () => {
  it("calcula o saldo livre real conservador e otimista", () => {
    const res = calculateSafeToSpend({
      realCashBalanceCents: 500000, // R$ 5.000,00 em conta
      openInvoicesCents: 180000, // R$ 1.800,00 de faturas a vencer
      payablePendingCents: 40000, // R$ 400,00 de boletos/dívidas a pagar
      receivablePendingCents: 60000, // R$ 600,00 a receber
      essentialBudgetsRemainingCents: 80000, // R$ 800,00 de orçamento essencial restante
    });

    // Obrigações = 1800 + 400 = 2200
    expect(res.committedObligationsCents).toBe(220000);

    // Saldo Livre Real = 5000 - 2200 = 2800
    expect(res.safeToSpendCents).toBe(280000);

    // Saldo Livre com Orçamentos Essenciais = 2800 - 800 = 2000
    expect(res.safeToSpendWithBudgetsCents).toBe(200000);

    // Saldo Livre com Recebíveis = 2800 + 600 = 3400
    expect(res.safeToSpendWithReceivablesCents).toBe(340000);
  });

  it("trata valores nulos ou negativos com segurança sem gerar exceção", () => {
    const res = calculateSafeToSpend({
      realCashBalanceCents: 100000,
      openInvoicesCents: 0,
      payablePendingCents: 0,
    });

    expect(res.committedObligationsCents).toBe(0);
    expect(res.safeToSpendCents).toBe(100000);
    expect(res.safeToSpendWithBudgetsCents).toBe(100000);
    expect(res.safeToSpendWithReceivablesCents).toBe(100000);
  });
});
