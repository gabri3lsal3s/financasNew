import { describe, expect, it, vi, beforeEach } from "vitest";
import { listIncomesByMonth, listIncomesByRange } from "./incomes";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  abortSignal: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lt: vi.fn(),
    order: vi.fn(),
    abortSignal: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.abortSignal.mockReturnValue(builder);
  return builder;
}

let builder: Builder;
let recurrenceBuilder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: (table: string) => (table === "recurrences" ? recurrenceBuilder : builder),
  }),
}));

describe("incomes repository", () => {
  beforeEach(() => {
    recurrenceBuilder = makeBuilder({ data: [], error: null });
    builder = makeBuilder({
      data: [
        {
          id: "inc-1",
          user_id: "u1",
          value: "5000.00",
          date: "2026-08-05",
          category_id: "c-inc",
          receive_type: "pix",
          description: "Salário",
          report_weight: "1.0",
          source_ref: null,
          statement_hash: null,
          created_at: "2026-08-05T08:00:00Z",
        },
      ],
      error: null,
    });
  });

  it("converte os campos numeric (string) para number em listIncomesByMonth", async () => {
    const incomes = await listIncomesByMonth("2026-08");
    expect(incomes).toHaveLength(1);
    expect(incomes[0]?.value).toBe(5000);
    expect(incomes[0]?.report_weight).toBe(1);
  });

  describe("listIncomesByRange (AbortController & Cancelamento)", () => {
    it("passa o signal para o builder via abortSignal", async () => {
      const ac = new AbortController();
      await listIncomesByRange("2026-01-01", "2026-02-01", { signal: ac.signal });
      expect(builder.abortSignal).toHaveBeenCalledWith(ac.signal);
      expect(builder.gte).toHaveBeenCalledWith("date", "2026-01-01");
      expect(builder.lt).toHaveBeenCalledWith("date", "2026-02-01");
    });

    it("rejeita com AbortError imediatamente se o signal já estiver abortado", async () => {
      const ac = new AbortController();
      ac.abort();
      await expect(
        listIncomesByRange("2026-01-01", "2026-02-01", { signal: ac.signal }),
      ).rejects.toThrow("aborted");
      expect(builder.select).not.toHaveBeenCalled();
    });

    it("propaga AbortError se a requisição do Supabase retornar erro de abort", async () => {
      const ac = new AbortController();
      builder = makeBuilder({
        data: null,
        error: { message: "AbortError: This operation was aborted", code: "" },
      });
      const promise = listIncomesByRange("2026-01-01", "2026-02-01", { signal: ac.signal });
      await expect(promise).rejects.toThrow("aborted");
    });
  });
});
