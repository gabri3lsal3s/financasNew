import { describe, expect, it, vi, beforeEach } from "vitest";
import { createCreditCard, listCreditCards, updateCreditCard, deleteCreditCard } from "./credit-cards";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    insert: vi.fn(),
    order: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.insert.mockReturnValue(builder);
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

const updateCardRpcMock = vi.fn();
const deleteCardRpcMock = vi.fn();
vi.mock("@/data/rpc", () => ({
  updateCreditCardRpc: (...args: unknown[]) => updateCardRpcMock(...args),
  deleteCreditCardRpc: (...args: unknown[]) => deleteCardRpcMock(...args),
}));

describe("credit-cards repository (entrega 5)", () => {
  beforeEach(() => {
    builder = makeBuilder({
      data: [
        {
          id: "c1",
          user_id: "u1",
          name: "Nubank",
          brand: "Mastercard",
          credit_limit: "10000.00", // numeric chega como string
          closing_day: 10,
          due_day: 15,
          color: null,
          is_active: true,
        },
      ],
      error: null,
    });
  });

  it("converte credit_limit (numeric string) para number", async () => {
    const cards = await listCreditCards();
    expect(cards[0]?.credit_limit).toBe(10000);
    expect(cards[0]?.name).toBe("Nubank");
  });

  it("cria cartão com user_id (escrita simples, sem RPC)", async () => {
    await createCreditCard({ name: "Itaú", brand: null, credit_limit: 5000, closing_day: 5, due_day: 10, color: null, is_active: true });
    expect(builder.insert).toHaveBeenCalledWith({
      name: "Itaú",
      brand: null,
      credit_limit: 5000,
      closing_day: 5,
      due_day: 10,
      color: null,
      is_active: true,
      user_id: "u1",
    });
  });

  it("altera regras via RPC auditado (não passa pelo CRUD direto)", async () => {
    await updateCreditCard("c1", {
      name: "Nubank",
      brand: null,
      credit_limit: 2000,
      closing_day: 12,
      due_day: 18,
      color: null,
      is_active: true,
    });
    expect(updateCardRpcMock).toHaveBeenCalledWith({
      cardId: "c1",
      name: "Nubank",
      brand: null,
      creditLimit: 2000,
      closingDay: 12,
      dueDay: 18,
      color: null,
      isActive: true,
    });
  });

  it("exclui via RPC auditado", async () => {
    await deleteCreditCard("c1");
    expect(deleteCardRpcMock).toHaveBeenCalledWith("c1");
  });

  it("propaga erro do banco via AppError", async () => {
    builder = makeBuilder({ data: null, error: { message: "erro", status: 500 } });
    await expect(listCreditCards()).rejects.toThrow();
  });
});
