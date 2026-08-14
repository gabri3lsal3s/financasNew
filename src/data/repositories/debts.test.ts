import { describe, expect, it, vi, beforeEach } from "vitest";
import { createDebt, deleteDebt, listDebts } from "./debts";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.single.mockReturnValue(builder);
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({ from: () => builder }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: () => Promise.resolve("u1"),
}));

describe("debts repository (entrega 6)", () => {
  beforeEach(() => {
    builder = makeBuilder({
      data: [
        {
          id: "d1",
          user_id: "u1",
          name: "Conta de luz",
          type: "payable",
          amount: "200.00", // numeric chega como string
          due_date: "2026-08-20",
          paid_at: null,
          expense_id: null,
          installment_group_id: null,
          created_at: "2026-08-01T00:00:00Z",
        },
      ],
      error: null,
    });
  });

  it("converte amount (numeric string) para number", async () => {
    const debts = await listDebts();
    expect(debts[0]?.amount).toBe(200);
  });

  it("ordena por vencimento ascendente (§3.4)", async () => {
    await listDebts();
    expect(builder.order).toHaveBeenCalledWith("due_date", { ascending: true });
  });

  it("cria dívida com campos de quitação/vínculo nulos (defaults do banco)", async () => {
    await createDebt({ name: "Internet", type: "payable", amount: 120, due_date: "2026-09-01" });
    expect(builder.insert).toHaveBeenCalledWith({
      name: "Internet",
      type: "payable",
      amount: 120,
      due_date: "2026-09-01",
      user_id: "u1",
      paid_at: null,
      expense_id: null,
      installment_group_id: null,
    });
  });

  it("exclui dívida (escrita simples)", async () => {
    await deleteDebt("d1");
    expect(builder.delete).toHaveBeenCalled();
    expect(builder.eq).toHaveBeenCalledWith("id", "d1");
  });
});
