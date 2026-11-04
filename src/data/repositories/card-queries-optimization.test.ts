import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_CARD_WINDOW_MONTHS,
  listAllCardExpenses,
  listExpensesByCard,
} from "./expenses";
import {
  DEFAULT_CARD_PAYMENT_WINDOW_MONTHS,
  listAllCardPayments,
  listCardPayments,
} from "./card-payments";
import { currentMonth, shiftMonth } from "@/lib/date";

interface MockBuilder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function createMockBuilder(result: unknown = { data: [], error: null }): MockBuilder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    not: vi.fn(),
    gte: vi.fn(),
    or: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as MockBuilder;

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.not.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);

  return builder;
}

let builder: MockBuilder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: () => builder,
  }),
}));

describe("Otimização de Consultas de Cartões (Janela Temporal de 24 meses)", () => {
  beforeEach(() => {
    builder = createMockBuilder();
  });

  describe("listAllCardExpenses", () => {
    it("aplica a janela de 24 meses por padrão quando options não é informado", async () => {
      const expectedSinceMonth = shiftMonth(currentMonth(), -DEFAULT_CARD_WINDOW_MONTHS);
      const expectedSinceDate = `${expectedSinceMonth}-01`;

      await listAllCardExpenses();

      expect(builder.not).toHaveBeenCalledWith("card_id", "is", null);
      expect(builder.or).toHaveBeenCalledWith(
        `bill_competence.gte.${expectedSinceMonth},date.gte.${expectedSinceDate}`,
      );
      expect(builder.order).toHaveBeenCalledWith("date", { ascending: false });
    });

    it("aplica sinceMonth customizado quando fornecido", async () => {
      await listAllCardExpenses({ sinceMonth: "2025-06" });

      expect(builder.or).toHaveBeenCalledWith(
        "bill_competence.gte.2025-06,date.gte.2025-06-01",
      );
    });

    it("não aplica filtro de data quando sinceMonth for explicitamente null (busca irrestrita)", async () => {
      await listAllCardExpenses({ sinceMonth: null });

      expect(builder.not).toHaveBeenCalledWith("card_id", "is", null);
      expect(builder.or).not.toHaveBeenCalled();
      expect(builder.order).toHaveBeenCalledWith("date", { ascending: false });
    });
  });

  describe("listExpensesByCard", () => {
    it("aplica filtro do card_id e janela de 24 meses por padrão", async () => {
      const expectedSinceMonth = shiftMonth(currentMonth(), -DEFAULT_CARD_WINDOW_MONTHS);
      const expectedSinceDate = `${expectedSinceMonth}-01`;

      await listExpensesByCard("card-123");

      expect(builder.eq).toHaveBeenCalledWith("card_id", "card-123");
      expect(builder.or).toHaveBeenCalledWith(
        `bill_competence.gte.${expectedSinceMonth},date.gte.${expectedSinceDate}`,
      );
    });

    it("permite consulta irrestrita de um cartão com sinceMonth: null", async () => {
      await listExpensesByCard("card-123", { sinceMonth: null });

      expect(builder.eq).toHaveBeenCalledWith("card_id", "card-123");
      expect(builder.or).not.toHaveBeenCalled();
    });
  });

  describe("listAllCardPayments", () => {
    it("aplica a janela de 24 meses por padrão no campo competence_month", async () => {
      const expectedSinceMonth = shiftMonth(currentMonth(), -DEFAULT_CARD_PAYMENT_WINDOW_MONTHS);

      await listAllCardPayments();

      expect(builder.gte).toHaveBeenCalledWith("competence_month", expectedSinceMonth);
      expect(builder.order).toHaveBeenCalledWith("date", { ascending: false });
    });

    it("não aplica filtro de competência quando sinceMonth for null", async () => {
      await listAllCardPayments({ sinceMonth: null });

      expect(builder.gte).not.toHaveBeenCalled();
      expect(builder.order).toHaveBeenCalledWith("date", { ascending: false });
    });
  });

  describe("listCardPayments", () => {
    it("aplica filtro do card_id e janela de 24 meses por padrão", async () => {
      const expectedSinceMonth = shiftMonth(currentMonth(), -DEFAULT_CARD_PAYMENT_WINDOW_MONTHS);

      await listCardPayments("card-456");

      expect(builder.eq).toHaveBeenCalledWith("card_id", "card-456");
      expect(builder.gte).toHaveBeenCalledWith("competence_month", expectedSinceMonth);
    });

    it("permite consulta irrestrita de pagamentos de um cartão com sinceMonth: null", async () => {
      await listCardPayments("card-456", { sinceMonth: null });

      expect(builder.eq).toHaveBeenCalledWith("card_id", "card-456");
      expect(builder.gte).not.toHaveBeenCalled();
    });
  });
});
