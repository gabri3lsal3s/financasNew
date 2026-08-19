import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  listAssetPrices,
  removeManualPrice,
  setAssetPricesBatchFromApi,
  setManualPrice,
} from "./asset-prices";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastInsertInput: unknown = null;
let lastDeleteCalls: string[] = [];
let lastInCalls: Array<{ col: string; vals: unknown[] }> = [];

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    or: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.eq.mockImplementation((col: string, val: string) => {
    lastDeleteCalls.push(`${col}=${val}`);
    return builder;
  });
  builder.in.mockImplementation((col: string, vals: unknown[]) => {
    lastInCalls.push({ col, vals });
    return builder;
  });
  builder.insert.mockImplementation((input: unknown) => {
    lastInsertInput = input;
    return { then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb) };
  });
  builder.delete.mockReturnValue(builder);
  return builder;
}

let builder: Builder;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({ from: () => builder }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: async () => "u1",
}));

describe("asset-prices repository (Fase 4 — valoração §1.6)", () => {
  beforeEach(() => {
    lastInsertInput = null;
    lastDeleteCalls = [];
    lastInCalls = [];
  });

  it("listAssetPrices busca cache global + overrides do usuário", async () => {
    builder = makeBuilder({
      data: [
        { ticker: "AAPL", price: "200", currency: "USD", source: "api", manual_price: null },
        { ticker: "PETR4", price: "42.5", currency: "BRL", source: "manual", manual_price: "42.5" },
      ],
    });
    const rows = await listAssetPrices();
    expect(builder.or).toHaveBeenCalledWith("user_id.is.null,user_id.eq.u1");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ ticker: "AAPL", price: 200, currency: "USD" });
    expect(rows[1]).toMatchObject({ ticker: "PETR4", price: 42.5, manual_price: 42.5 });
  });

  it("listAssetPrices consolida por ticker: override manual prevalece sobre cache global da API", async () => {
    builder = makeBuilder({
      data: [
        // A API retornou preço 0 ou antigo primeiro
        { ticker: "PETR4", price: "0", currency: "BRL", source: "api", manual_price: null },
        // E o usuário tem override manual
        { ticker: "PETR4", price: "42.5", currency: "BRL", source: "manual", manual_price: "42.5" },
        // Outro ativo onde a ordem veio inversa
        { ticker: "VALE3", price: "60.0", currency: "BRL", source: "manual", manual_price: "60.0" },
        { ticker: "VALE3", price: "55.0", currency: "BRL", source: "api", manual_price: null },
      ],
    });
    const rows = await listAssetPrices();
    expect(rows).toHaveLength(2);
    const petr4 = rows.find((r) => r.ticker === "PETR4");
    const vale3 = rows.find((r) => r.ticker === "VALE3");
    expect(petr4).toMatchObject({ ticker: "PETR4", price: 42.5, source: "manual", manual_price: 42.5 });
    expect(vale3).toMatchObject({ ticker: "VALE3", price: 60.0, source: "manual", manual_price: 60.0 });
  });

  it("setManualPrice grava override com moeda inferida pelo ticker (USD)", async () => {
    builder = makeBuilder({ data: null });
    await setManualPrice({ ticker: "AAPL", price: 210.5 });
    expect(lastInsertInput).toMatchObject({
      user_id: "u1",
      ticker: "AAPL",
      price: 210.5,
      currency: "USD",
      source: "manual",
      manual_price: 210.5,
    });
    expect(lastDeleteCalls).toEqual(["user_id=u1", "ticker=AAPL"]);
  });

  it("setManualPrice infere BRL para ticker B3", async () => {
    builder = makeBuilder({ data: null });
    await setManualPrice({ ticker: "PETR4", price: 43 });
    expect(lastInsertInput).toMatchObject({ currency: "BRL" });
  });

  it("removeManualPrice apaga apenas o override do usuário", async () => {
    builder = makeBuilder({ data: null });
    await removeManualPrice("AAPL");
    expect(lastDeleteCalls).toEqual(["user_id=u1", "ticker=AAPL", "source=manual"]);
  });

  it("setAssetPricesBatchFromApi grava lote ignorando tickers com override manual", async () => {
    // Simula que PETR4 possui override manual já registrado
    builder = makeBuilder({
      data: [{ ticker: "PETR4", price: 45, currency: "BRL", source: "manual", manual_price: 45 }],
    });

    await setAssetPricesBatchFromApi([
      { ticker: "PETR4", price: 38.0, currency: "BRL" },
      { ticker: "VALE3", price: 62.5, currency: "BRL" },
    ]);

    // Apenas VALE3 deve ser inserido (PETR4 foi ignorado devido ao override manual)
    const inserted = lastInsertInput as Array<{ ticker: string; price: number; source: string }>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      ticker: "VALE3",
      price: 62.5,
      currency: "BRL",
      source: "api",
    });
  });

  it("propaga erro classificado quando a leitura falha", async () => {
    builder = makeBuilder({ data: null, error: { message: "network down", code: "NETWORK_ERROR" } });
    await expect(listAssetPrices()).rejects.toThrow();
  });
});

