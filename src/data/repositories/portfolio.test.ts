import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  createPortfolioAsset,
  createPortfolioContribution,
  createPortfolioDividend,
  deletePortfolioAsset,
  deletePortfolioContribution,
  deletePortfolioDividend,
  listAllPortfolioTransactions,
  listPortfolioAssets,
  listPortfolioTransactions,
  upsertPortfolioSnapshot,
} from "./portfolio";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastInsertInput: unknown = null;
let lastUpsertInput: unknown = null;
let lastDeletedId: string | null = null;

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    insert: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.insert.mockImplementation((input: unknown) => {
    lastInsertInput = input;
    return { ...builder, select: () => ({ ...builder, single: () => ({ then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb) }) }) };
  });
  builder.upsert.mockImplementation((input: unknown) => {
    lastUpsertInput = input;
    return { ...builder, select: () => ({ ...builder, single: () => ({ then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb) }) }) };
  });
  builder.delete.mockImplementation(() => {
    const deleteChain = {
      ...builder,
      eq: vi.fn((_col: string, value: string) => {
        lastDeletedId = value;
        return deleteChain;
      }),
    };
    return deleteChain;
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

describe("portfolio repository (Fase 36 — Posição Consolidada)", () => {
  beforeEach(() => {
    lastInsertInput = null;
    lastUpsertInput = null;
    lastDeletedId = null;
  });

  it("listPortfolioAssets devolve os ativos com quantity e average_price numéricos", async () => {
    builder = makeBuilder({ data: [{ id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "acao", currency: "BRL", quantity: "100", average_price: "35.5" }] });
    const assets = await listPortfolioAssets();
    expect(assets).toHaveLength(1);
    expect(assets[0]?.ticker).toBe("PETR4");
    expect(assets[0]?.quantity).toBe(100);
    expect(assets[0]?.average_price).toBe(35.5);
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
    builder = makeBuilder({ data: { id: "a1", user_id: "u1", ticker: "BOVA11", asset_class: "fii", currency: "BRL", quantity: 0, average_price: 0 } });
    const asset = await createPortfolioAsset({ ticker: "BOVA11", asset_class: "fii", currency: "BRL", quantity: 0, average_price: 0 });
    expect(lastInsertInput).toMatchObject({ user_id: "u1", ticker: "BOVA11" });
    expect(asset.ticker).toBe("BOVA11");
  });

  it("upsertPortfolioSnapshot grava snapshot mensal", async () => {
    builder = makeBuilder({ data: { id: "s1", user_id: "u1", month: "2026-08", total_value: 50000, total_cost: 42000 } });
    const snap = await upsertPortfolioSnapshot({ month: "2026-08", total_value: 50000, total_cost: 42000 });
    expect(lastUpsertInput).toMatchObject({ user_id: "u1", month: "2026-08", total_value: 50000, total_cost: 42000 });
    expect(snap.total_value).toBe(50000);
  });

  it("createPortfolioContribution insere contribuição com user_id", async () => {
    builder = makeBuilder({ data: { id: "c1", user_id: "u1", date: "2026-08-15", amount: 1500, notes: "Aporte" } });
    const c = await createPortfolioContribution({ asset_id: null, date: "2026-08-15", amount: 1500, notes: "Aporte" });
    expect(lastInsertInput).toMatchObject({ user_id: "u1", amount: 1500 });
    expect(c.amount).toBe(1500);
  });

  it("createPortfolioDividend insere provento com user_id", async () => {
    builder = makeBuilder({ data: { id: "d1", user_id: "u1", asset_id: "a1", date: "2026-08-10", amount: 85.5 } });
    const d = await createPortfolioDividend({ asset_id: "a1", date: "2026-08-10", amount: 85.5 });
    expect(lastInsertInput).toMatchObject({ user_id: "u1", amount: 85.5 });
    expect(d.amount).toBe(85.5);
  });

  it("deletePortfolioAsset remove o ativo pelo id", async () => {
    builder = makeBuilder({ data: null, error: null });
    await deletePortfolioAsset("a1");
    expect(lastDeletedId).toBe("a1");
  });

  it("deletePortfolioContribution remove contribuição pelo id", async () => {
    builder = makeBuilder({ data: null, error: null });
    await deletePortfolioContribution("c1");
    expect(lastDeletedId).toBe("c1");
  });

  it("deletePortfolioDividend remove provento pelo id", async () => {
    builder = makeBuilder({ data: null, error: null });
    await deletePortfolioDividend("d1");
    expect(lastDeletedId).toBe("d1");
  });

  it("delete propaga erro classificado quando a exclusão falha", async () => {
    builder = makeBuilder({ data: null, error: { message: "network down", code: "NETWORK_ERROR" } });
    await expect(deletePortfolioAsset("a1")).rejects.toThrow();
  });
});
