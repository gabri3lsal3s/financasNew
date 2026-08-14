import { describe, expect, it, vi, beforeEach } from "vitest";
import { listAllExpenses, listExpensesByMonth } from "./expenses";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  // Encadeamento: cada método retorna o próprio builder.
  builder.select.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({ from: () => builder }),
}));

describe("listExpensesByMonth (repository — conversão de borda)", () => {
  beforeEach(() => {
    builder = makeBuilder({
      data: [
        {
          id: "a",
          user_id: "u1",
          value: "1500.00", // numeric chega como string do PostgREST
          date: "2026-08-13",
          category_id: "c1",
          payment_method: "pix",
          card_id: null,
          installments_total: 1,
          installment_number: 1,
          installment_group_id: null,
          bill_competence: null,
          report_weight: "1",
          base_amount: "1500.00",
          description: "Aluguel",
          created_at: "2026-08-13T10:00:00Z",
        },
      ],
      error: null,
    });
  });

  it("converte os campos numeric (string) para number", async () => {
    const expenses = await listExpensesByMonth("2026-08");
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.value).toBe(1500);
    expect(expenses[0]?.report_weight).toBe(1);
    expect(expenses[0]?.base_amount).toBe(1500);
  });

  it("filtra pelo range do mês (gte start, lt end)", async () => {
    await listExpensesByMonth("2026-08");
    expect(builder.gte).toHaveBeenCalledWith("date", "2026-08-01");
    expect(builder.lt).toHaveBeenCalledWith("date", "2026-09-01");
  });

  it("ordena por data desc e created_at desc", async () => {
    await listExpensesByMonth("2026-08");
    expect(builder.order).toHaveBeenCalledWith("date", { ascending: false });
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("propaga erro do banco via AppError", async () => {
    builder = makeBuilder({ data: null, error: { message: "network error", status: 500 } });
    await expect(listExpensesByMonth("2026-08")).rejects.toThrow();
  });

  it("listAllExpenses busca todas as despesas (sem filtro de mês — busca global)", async () => {
    builder = makeBuilder({
      data: [
        {
          id: "a",
          user_id: "u1",
          value: "100",
          date: "2026-01-10",
          category_id: "c1",
          payment_method: "pix",
          card_id: null,
          installments_total: 1,
          installment_number: 1,
          installment_group_id: null,
          bill_competence: null,
          report_weight: "1",
          base_amount: "100",
          description: "Antiga",
          created_at: "2026-01-10T10:00:00Z",
        },
      ],
      error: null,
    });
    const expenses = await listAllExpenses();
    expect(builder.gte).not.toHaveBeenCalled();
    expect(expenses[0]).toMatchObject({ value: 100, date: "2026-01-10" });
  });
});
