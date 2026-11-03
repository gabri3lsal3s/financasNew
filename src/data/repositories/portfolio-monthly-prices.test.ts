import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listPortfolioMonthlyPrices,
  upsertPortfolioMonthlyPricesBatch,
  deletePortfolioMonthlyPrice,
} from "./portfolio-monthly-prices";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastDeleteFilters: Record<string, string> = {};

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;

  builder.select.mockReturnValue(builder);
  builder.eq.mockImplementation((col: string, val: string) => {
    lastDeleteFilters[col] = val;
    return builder;
  });
  builder.order.mockReturnValue(builder);

  builder.upsert.mockImplementation(() => {
    return {
      ...builder,
      then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb),
    };
  });

  builder.delete.mockImplementation(() => {
    return {
      ...builder,
      eq: vi.fn((col: string, val: string) => {
        lastDeleteFilters[col] = val;
        return builder;
      }),
      then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb),
    };
  });

  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({ from: () => builder }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: async () => "u1",
}));

describe("portfolio-monthly-prices repository (Fase 2)", () => {
  beforeEach(() => {
    lastDeleteFilters = {};
  });

  it("retorna lista vazia quando não há cotações salvas para a competência", async () => {
    builder = makeBuilder({ data: [], error: null });
    const prices = await listPortfolioMonthlyPrices("2026-10");
    expect(prices).toEqual([]);
    expect(builder.eq).toHaveBeenCalledWith("month", "2026-10");
  });

  it("retorna cotações mapeadas convertendo price para número", async () => {
    builder = makeBuilder({
      data: [
        {
          id: "p1",
          user_id: "u1",
          ticker: "PETR4",
          month: "2026-10",
          price: "36.50",
          currency: "BRL",
          source: "api",
        },
      ],
      error: null,
    });

    const prices = await listPortfolioMonthlyPrices("2026-10");
    expect(prices).toEqual([
      {
        id: "p1",
        user_id: "u1",
        ticker: "PETR4",
        month: "2026-10",
        price: 36.5,
        currency: "BRL",
        source: "api",
      },
    ]);
  });

  it("executa upsert em lote com user_id e tickers normalizados em maiúsculas", async () => {
    builder = makeBuilder({ data: null, error: null });

    await upsertPortfolioMonthlyPricesBatch([
      {
        ticker: "vale3",
        month: "2026-10",
        price: 62.4,
        currency: "BRL",
        source: "manual",
      },
      {
        ticker: "aapl",
        month: "2026-10",
        price: 220.15,
        currency: "USD",
        source: "api",
      },
    ]);

    expect(builder.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: "u1",
          ticker: "VALE3",
          month: "2026-10",
          price: 62.4,
          currency: "BRL",
          source: "manual",
        }),
        expect.objectContaining({
          user_id: "u1",
          ticker: "AAPL",
          month: "2026-10",
          price: 220.15,
          currency: "USD",
          source: "api",
        }),
      ]),
      { onConflict: "user_id,ticker,month" },
    );
  });

  it("não executa requisição quando o lote de upsert for vazio", async () => {
    builder = makeBuilder({ data: null, error: null });
    await upsertPortfolioMonthlyPricesBatch([]);
    expect(builder.upsert).not.toHaveBeenCalled();
  });

  it("exclui cotação de ticker e mês específicos com ticker normalizado", async () => {
    builder = makeBuilder({ data: null, error: null });
    await deletePortfolioMonthlyPrice("petr4", "2026-10");

    expect(builder.delete).toHaveBeenCalled();
    expect(lastDeleteFilters.ticker).toBe("PETR4");
    expect(lastDeleteFilters.month).toBe("2026-10");
  });
});
