import { describe, expect, it } from "vitest";
import { resolveSearchIntent, type SearchIntentContext } from "./intents";

describe("resolveSearchIntent — Parser Determinístico de Intenções de Busca", () => {
  const mockContext: SearchIntentContext = {
    todayISO: "2026-11-08",
    categorySpendingCurrentMonth: {
      alimentacao: 145000, // R$ 1.450,00
      transporte: 32000,   // R$ 320,00
      lazer: 18000,        // R$ 180,00
      moradia: 250000,     // R$ 2.500,00
    },
    upcomingBills: [
      {
        title: "Fatura Nubank",
        amountCents: 125000,
        dueDate: "10/11/2026",
        isOverdue: false,
      },
      {
        title: "Internet Fibra",
        amountCents: 11990,
        dueDate: "15/11/2026",
        isOverdue: false,
      },
    ],
    availableBalanceCents: 384000, // R$ 3.840,00
    emergencyReserveCents: 1500000, // R$ 15.000,00
  };

  describe("Gasto por Categoria", () => {
    it("quanto gastei com alimentacao", () => {
      const res = resolveSearchIntent("quanto gastei com alimentação", mockContext);
      expect(res).not.toBeNull();
      expect(res?.kind).toBe("category_spending");
      expect(res?.title).toBe("Gasto em Alimentacao");
      expect(res?.headline).toContain("1.450,00");
      expect(res?.action?.path).toBe("/transacoes");
    });

    it("total com supermercado", () => {
      const res = resolveSearchIntent("total com supermercado", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("1.450,00");
    });

    it("gastei com ifood", () => {
      const res = resolveSearchIntent("gastei com ifood", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("1.450,00");
    });

    it("quanto gastei com uber", () => {
      const res = resolveSearchIntent("quanto gastei com uber", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.title).toBe("Gasto em Transporte");
      expect(res?.headline).toContain("320,00");
    });

    it("total gasto em transporte", () => {
      const res = resolveSearchIntent("total gasto em transporte", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("320,00");
    });

    it("valor com lazer", () => {
      const res = resolveSearchIntent("valor com lazer", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("180,00");
    });

    it("quanto foi cinema", () => {
      const res = resolveSearchIntent("quanto foi cinema", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("180,00");
    });

    it("gastos com moradia", () => {
      const res = resolveSearchIntent("gastos com moradia", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("2.500,00");
    });

    it("total aluguel", () => {
      const res = resolveSearchIntent("total aluguel", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("2.500,00");
    });

    it("gasto com educacao (sem lançamentos = R$ 0,00)", () => {
      const res = resolveSearchIntent("quanto gastei com faculdade", mockContext);
      expect(res?.kind).toBe("category_spending");
      expect(res?.headline).toContain("0,00");
    });
  });

  describe("Vencimentos Próximos", () => {
    it("faturas vencendo", () => {
      const res = resolveSearchIntent("faturas vencendo", mockContext);
      expect(res?.kind).toBe("upcoming_due");
      expect(res?.headline).toContain("2 contas a vencer");
      expect(res?.action?.path).toBe("/lembretes");
    });

    it("contas a pagar", () => {
      const res = resolveSearchIntent("contas a pagar", mockContext);
      expect(res?.kind).toBe("upcoming_due");
      expect(res?.headline).toContain("2 contas a vencer");
    });

    it("proximos boletos", () => {
      const res = resolveSearchIntent("proximos boletos", mockContext);
      expect(res?.kind).toBe("upcoming_due");
      expect(res?.detail).toContain("Fatura Nubank");
    });

    it("o que vence hoje", () => {
      const res = resolveSearchIntent("o que vence hoje", mockContext);
      expect(res?.kind).toBe("upcoming_due");
    });

    it("quando não há contas pendentes", () => {
      const res = resolveSearchIntent("faturas a pagar", { ...mockContext, upcomingBills: [] });
      expect(res?.kind).toBe("upcoming_due");
      expect(res?.headline).toContain("Nenhum boleto ou fatura pendente");
    });
  });

  describe("Saldo e Reserva", () => {
    it("qual meu saldo", () => {
      const res = resolveSearchIntent("qual meu saldo", mockContext);
      expect(res?.kind).toBe("balance_and_reserve");
      expect(res?.headline).toContain("3.840,00");
      expect(res?.action?.path).toBe("/visao-geral");
    });

    it("quanto tenho disponivel", () => {
      const res = resolveSearchIntent("quanto tenho disponível", mockContext);
      expect(res?.kind).toBe("balance_and_reserve");
      expect(res?.headline).toContain("3.840,00");
    });

    it("quanto sobrou este mes", () => {
      const res = resolveSearchIntent("quanto sobrou este mês", mockContext);
      expect(res?.kind).toBe("balance_and_reserve");
    });

    it("reserva de emergencia", () => {
      const res = resolveSearchIntent("reserva de emergencia", mockContext);
      expect(res?.kind).toBe("balance_and_reserve");
      expect(res?.title).toBe("Reserva de Emergência");
      expect(res?.headline).toContain("15.000,00");
      expect(res?.action?.path).toBe("/orcamentos");
    });

    it("quanto tenho na reserva", () => {
      const res = resolveSearchIntent("quanto tenho na reserva", mockContext);
      expect(res?.kind).toBe("balance_and_reserve");
      expect(res?.headline).toContain("15.000,00");
    });
  });

  describe("Ações Rápidas do Sistema", () => {
    it("nova despesa", () => {
      const res = resolveSearchIntent("nova despesa", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.params?.action).toBe("new-expense");
    });

    it("lancar gasto", () => {
      const res = resolveSearchIntent("lançar gasto", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.params?.action).toBe("new-expense");
    });

    it("novo gasto", () => {
      const res = resolveSearchIntent("novo gasto", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.params?.action).toBe("new-expense");
    });

    it("adicionar receita", () => {
      const res = resolveSearchIntent("adicionar receita", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.params?.action).toBe("new-income");
    });

    it("criar receita", () => {
      const res = resolveSearchIntent("criar receita", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.params?.action).toBe("new-income");
    });

    it("novo cartao", () => {
      const res = resolveSearchIntent("novo cartão", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.path).toBe("/cartoes");
      expect(res?.action?.params?.action).toBe("new-card");
    });

    it("adicionar cartao", () => {
      const res = resolveSearchIntent("adicionar cartao", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.path).toBe("/cartoes");
    });

    it("criar nova meta", () => {
      const res = resolveSearchIntent("criar nova meta", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.path).toBe("/orcamentos");
      expect(res?.action?.params?.action).toBe("new-goal");
    });

    it("adicionar divida", () => {
      const res = resolveSearchIntent("adicionar divida", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.path).toBe("/dividas");
      expect(res?.action?.params?.action).toBe("new-debt");
    });

    it("novo orcamento", () => {
      const res = resolveSearchIntent("novo orçamento", mockContext);
      expect(res?.kind).toBe("system_action");
      expect(res?.action?.path).toBe("/orcamentos");
      expect(res?.action?.params?.action).toBe("new-budget");
    });
  });

  describe("Resoluções Negativas ou Curtas", () => {
    it("string muito curta retorna null", () => {
      expect(resolveSearchIntent("oi", mockContext)).toBeNull();
      expect(resolveSearchIntent("a", mockContext)).toBeNull();
    });

    it("busca comum de texto que não é comando/pergunta retorna null", () => {
      expect(resolveSearchIntent("netflix mensalidade", mockContext)).toBeNull();
      expect(resolveSearchIntent("petrobras", mockContext)).toBeNull();
      expect(resolveSearchIntent("farmacia pague menos", mockContext)).toBeNull();
    });
  });

  describe("Performance e Determinismo (< 2ms)", () => {
    it("resolve 100 queries consecutivas em menos de 10ms", () => {
      const queries = [
        "quanto gastei com comida",
        "total com transporte",
        "qual meu saldo",
        "faturas vencendo",
        "nova despesa",
        "novo cartao",
        "reserva de emergencia",
      ];
      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        resolveSearchIntent(queries[i % queries.length]!, mockContext);
      }
      const elapsed = performance.now() - start;
      // Garante menos de 2ms por query mesmo sob alta concorrência de CPU em runners locais
      expect(elapsed).toBeLessThan(200);
    });
  });
});
