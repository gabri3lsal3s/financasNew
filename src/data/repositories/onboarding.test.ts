import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOnboardingCounts } from "./onboarding";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  return builder;
}

let builder: Builder;
let calls: { table: string; filters: string[][] }[] = [];

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: (table: string) => {
      calls.push({ table, filters: [] });
      builder.eq.mockImplementation((column: string, value: unknown) => {
        calls[calls.length - 1]!.filters.push([column, String(value)]);
        return builder;
      });
      return builder;
    },
  }),
}));

describe("getOnboardingCounts — onboarding de primeiro uso (§5.7)", () => {
  beforeEach(() => {
    calls = [];
    builder = makeBuilder({ count: 0, error: null });
  });

  it("conta categorias (não reservadas), cartões e lançamentos em paralelo", async () => {
    builder = makeBuilder({ count: 2, error: null });
    const counts = await getOnboardingCounts();
    expect(counts).toEqual({ expenseCategories: 2, incomeCategories: 2, cards: 2, transactions: 4 });
  });

  it("aplica o filtro de categorias do usuário (is_reserved = false)", async () => {
    builder = makeBuilder({ count: 1, error: null });
    await getOnboardingCounts();

    const categoryCalls = calls.filter((call) => call.table === "categories");
    expect(categoryCalls).toHaveLength(2);
    for (const call of categoryCalls) {
      expect(call.filters).toContainEqual(["is_reserved", "false"]);
    }
    const expenseCall = categoryCalls.find((call) => call.filters.some(([col]) => col === "type"));
    expect(expenseCall?.filters).toContainEqual(["type", "expense"]);
  });

  it("propaga erro como AppError quando a consulta falha", async () => {
    builder = makeBuilder({ count: null, error: { message: "network down" } });
    await expect(getOnboardingCounts()).rejects.toThrow(/network down/);
  });
});
