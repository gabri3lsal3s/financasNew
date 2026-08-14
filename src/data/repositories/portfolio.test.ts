import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPortfolioAsset,
  createPortfolioTransaction,
  listAllPortfolioTransactions,
  listPortfolioAssets,
  listPortfolioTransactions,
} from "./portfolio";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastInsertInput: unknown = null;

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockImplementation((input: unknown) => {
    lastInsertInput = input;
    return { ...builder, select: () => ({ ...builder, single: () => ({ then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb) }) }) };
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

describe("portfolio repository (Fase 4 — ledger §3.11.2)", () => {
  beforeEach(() => {
    lastInsertInput = null;
  });

  it("listPortfolioAssets devolve os ativos", async () => {
    builder = makeBuilder({ data: [{ id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "acao", currency: "BRL" }] });
    const assets = await listPortfolioAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0]?.ticker).toBe("PETR4");
  });

  it("listPortfolioTransactions converte numeric → number na borda", async () => {
    builder = makeBuilder({
      data: [
        { id: "t1", asset_id: "a1", type: "buy", date: "2026-01-10", quantity: "10", price: "100", total: "1000" },
      ],
    });
    const rows = await listPortfolioTransactions("a1");
    expect(rows[0]).toMatchObject({ quantity: 10, price: 100, total: 1000 });
  });

  it("listAllPortfolioTransactions busca todas as transações do usuário", async () => {
    builder = makeBuilder({
      data: [
        { id: "t1", asset_id: "a1", type: "buy", date: "2026-01-10", quantity: "10", price: "100", total: "1000" },
        { id: "t2", asset_id: "a2", type: "dividend", date: "2026-02-01", quantity: "0", price: "0", total: "150" },
      ],
    });
    const rows = await listAllPortfolioTransactions();
    expect(builder.order).toHaveBeenCalledWith("date");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ asset_id: "a2", quantity: 0, total: 150 });
  });

  it("createPortfolioAsset insere com user_id", async () => {
    builder = makeBuilder({ data: { id: "a1", user_id: "u1", ticker: "BOVA11", asset_class: "fii", currency: "BRL" } });
    const asset = await createPortfolioAsset({ ticker: "BOVA11", asset_class: "fii", currency: "BRL" });
    expect(lastInsertInput).toMatchObject({ user_id: "u1", ticker: "BOVA11" });
    expect(asset.ticker).toBe("BOVA11");
  });

  it("createPortfolioTransaction insere com user_id", async () => {
    builder = makeBuilder(
      { data: { id: "t1", user_id: "u1", asset_id: "a1", type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 } },
    );
    const row = await createPortfolioTransaction({ asset_id: "a1", type: "buy", date: "2026-01-10", quantity: 10, price: 100, total: 1000 });
    expect(lastInsertInput).toMatchObject({ user_id: "u1", asset_id: "a1", type: "buy" });
    expect(row.total).toBe(1000);
  });

  it("propaga erro classificado quando a leitura falha", async () => {
    builder = makeBuilder({ data: null, error: { message: "network down", code: "NETWORK_ERROR" } });
    await expect(listPortfolioAssets()).rejects.toThrow();
  });
});
