import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  consolidateAssetPrices,
  getMarketPriceHistoryForDate,
  listAssetPrices,
  listMarketPriceHistoryByMonth,
  removeManualPrice,
  setManualPrice,
} from "./asset-prices";

interface Builder {
  select: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lte: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  range: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  then: (onFulfilled: (value: unknown) => unknown) => Promise<unknown>;
}

let lastDeleteCalls: string[] = [];
let lastRpcCall: { fn: string; args: unknown } | null = null;
let rpcResult: unknown = { data: null, error: null };

function makeBuilder(result: unknown): Builder {
  const builder = {
    select: vi.fn(),
    is: vi.fn(),
    or: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    then: (onFulfilled: (value: unknown) => unknown) => Promise.resolve(result).then(onFulfilled),
  } as Builder;
  builder.select.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.range.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.eq.mockImplementation((col: string, val: unknown) => {
    lastDeleteCalls.push(`${col}=${String(val)}`);
    return builder;
  });
  builder.insert.mockImplementation(() => {
    return { then: (cb: (v: unknown) => unknown) => Promise.resolve(result).then(cb) };
  });
  builder.delete.mockReturnValue(builder);
  return builder;
}

let builder: Builder;
let assetBuilder: Builder | null = null;

vi.mock("@/data/client", () => ({
  getSupabase: () => ({
    from: (table: string) => {
      if (table === "portfolio_assets" && assetBuilder) {
        return assetBuilder;
      }
      return builder;
    },
    rpc: vi.fn((fn: string, args: unknown) => {
      lastRpcCall = { fn, args };
      return Promise.resolve(rpcResult);
    }),
  }),
}));

vi.mock("@/data/session", () => ({
  currentUserId: async () => "u1",
}));

describe("asset-prices repository (Fase 4 — valoração §1.6)", () => {
  beforeEach(() => {
    lastDeleteCalls = [];
    lastRpcCall = null;
    rpcResult = { data: null, error: null };
    assetBuilder = null;
  });

  it("listAssetPrices busca cache global + overrides do usuário separadamente", async () => {
    builder = makeBuilder({
      data: [
        { ticker: "AAPL", price: "200", currency: "USD", source: "api", manual_price: null },
        { ticker: "PETR4", price: "42.5", currency: "BRL", source: "manual", manual_price: "42.5" },
      ],
    });
    const rows = await listAssetPrices();
    expect(builder.is).toHaveBeenCalledWith("user_id", null);
    expect(builder.eq).toHaveBeenCalledWith("user_id", "u1");
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

  it("setManualPrice grava override atômico via RPC com moeda inferida pelo ticker (USD)", async () => {
    await setManualPrice({ ticker: "AAPL", price: 210.5 });
    expect(lastRpcCall).toEqual({
      fn: "set_manual_asset_price",
      args: {
        p_ticker: "AAPL",
        p_price: 210.5,
        p_currency: "USD",
      },
    });
  });

  it("setManualPrice infere BRL para ticker B3 e aceita moeda explícita", async () => {
    await setManualPrice({ ticker: "PETR4", price: 43 });
    expect(lastRpcCall).toEqual({
      fn: "set_manual_asset_price",
      args: {
        p_ticker: "PETR4",
        p_price: 43,
        p_currency: "BRL",
      },
    });

    await setManualPrice({ ticker: "TESOURO_CUSTOM", price: 100, currency: "BRL" });
    expect(lastRpcCall).toEqual({
      fn: "set_manual_asset_price",
      args: {
        p_ticker: "TESOURO_CUSTOM",
        p_price: 100,
        p_currency: "BRL",
      },
    });
  });

  it("setManualPrice rejeita preço <= 0", async () => {
    await expect(setManualPrice({ ticker: "PETR4", price: 0 })).rejects.toThrow(/maior que zero/i);
    await expect(setManualPrice({ ticker: "PETR4", price: -5 })).rejects.toThrow(/maior que zero/i);
    expect(lastRpcCall).toBeNull();
  });

  it("removeManualPrice apaga apenas o override do usuário", async () => {
    builder = makeBuilder({ data: null });
    await removeManualPrice("AAPL");
    expect(lastDeleteCalls).toEqual(["user_id=u1", "ticker=AAPL", "source=manual"]);
  });

  it("consolidateAssetPrices ordena deterministicamente por market_price_at, ignora manual <= 0 e impede degradação por zero", () => {
    const consolidated = consolidateAssetPrices([
      {
        ticker: "PETR4",
        price: 0,
        currency: "BRL",
        source: "manual",
        manual_price: 0,
      },
      {
        ticker: "PETR4",
        price: 39.4,
        currency: "BRL",
        source: "api",
        manual_price: null,
        market_price_at: "2026-10-16T20:00:00.000Z",
        provider: "yahoo",
      },
      {
        ticker: "PETR4",
        price: 37.1,
        currency: "BRL",
        source: "api",
        manual_price: null,
        market_price_at: "2026-10-15T20:00:00.000Z",
        provider: "brapi",
      },
      {
        ticker: "PETR4",
        price: 0,
        currency: "BRL",
        source: "api",
        manual_price: null,
        market_price_at: "2026-10-17T20:00:00.000Z",
      },
      {
        ticker: "VALE3",
        price: 55.0,
        currency: "BRL",
        source: "api",
        manual_price: null,
      },
      {
        ticker: "VALE3",
        price: 62.5,
        currency: "BRL",
        source: "manual",
        manual_price: 62.5,
      },
    ]);

    const petr = consolidated.find((r) => r.ticker === "PETR4");
    const vale = consolidated.find((r) => r.ticker === "VALE3");
    expect(petr?.source).toBe("api");
    expect(petr?.price).toBe(39.4);
    expect(petr?.provider).toBe("yahoo");
    expect(vale?.source).toBe("manual");
    expect(vale?.price).toBe(62.5);
  });

  it("listMarketPriceHistoryByMonth filtra is_month_end por padrão e ignora preço <= 0", async () => {
    builder = makeBuilder({
      data: [
        {
          ticker: "USDBRL=X",
          reference_date: "2026-10-30",
          price: "5.7412",
          currency: "BRL",
          provider: "bcb_ptax",
          market_price_at: "2026-10-30T21:00:00.000Z",
          month: "2026-10",
          is_month_end: true,
        },
        {
          ticker: "USDBRL=X",
          reference_date: "2026-10-29",
          price: "5.7000",
          currency: "BRL",
          provider: "yahoo",
          market_price_at: "2026-10-29T21:00:00.000Z",
          month: "2026-10",
          is_month_end: false,
        },
        {
          ticker: "INVALID3",
          reference_date: "2026-10-30",
          price: "0",
          currency: "BRL",
          provider: "yahoo",
          market_price_at: null,
          month: "2026-10",
          is_month_end: true,
        },
      ],
      error: null,
    });

    const rows = await listMarketPriceHistoryByMonth("2026-10");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      ticker: "USDBRL=X",
      price: 5.7412,
      provider: "bcb_ptax",
      is_month_end: true,
    });
    expect(builder.eq).toHaveBeenCalledWith("month", "2026-10");
    expect(builder.eq).toHaveBeenCalledWith("is_month_end", true);
    expect(builder.order).toHaveBeenCalledWith("is_month_end", { ascending: false });
    expect(builder.order).toHaveBeenCalledWith("reference_date", { ascending: false });
  });

  it("getMarketPriceHistoryForDate consulta lookback de 7 dias em market_price_history", async () => {
    builder = makeBuilder({
      data: [
        {
          ticker: "USDBRL=X",
          reference_date: "2026-10-16",
          price: "5.6500",
          currency: "BRL",
          provider: "bcb_ptax",
          market_price_at: "2026-10-16T21:00:00.000Z",
          month: "2026-10",
          is_month_end: false,
        },
      ],
      error: null,
    });

    const row = await getMarketPriceHistoryForDate("USDBRL=X", "2026-10-18");
    expect(row).toMatchObject({ ticker: "USDBRL=X", reference_date: "2026-10-16", price: 5.65 });
    expect(builder.gte).toHaveBeenCalledWith("reference_date", "2026-10-11");
    expect(builder.lte).toHaveBeenCalledWith("reference_date", "2026-10-18");
  });

  it("propaga erro classificado quando a leitura falha", async () => {
    builder = makeBuilder({ data: null, error: { message: "network down", code: "NETWORK_ERROR" } });
    await expect(listAssetPrices()).rejects.toThrow();
  });

  it("utiliza fallback seguro de preço médio para ticker não encontrado na tabela asset_prices", async () => {
    builder = makeBuilder({
      data: [{ ticker: "AAPL", price: "200", currency: "USD", source: "api", manual_price: null }],
    });
    assetBuilder = makeBuilder({
      data: [
        { ticker: "AAPL", currency: "USD", average_price: 150, asset_class: "Internacional" },
        { ticker: "WEGE3", currency: "BRL", average_price: 38.5, asset_class: "Ações" },
      ],
    });

    const rows = await listAssetPrices();
    expect(rows).toHaveLength(2);

    const aapl = rows.find((r) => r.ticker === "AAPL");
    const wege3 = rows.find((r) => r.ticker === "WEGE3");

    expect(aapl).toMatchObject({ ticker: "AAPL", price: 200, currency: "USD", source: "api" });
    expect(wege3).toMatchObject({ ticker: "WEGE3", price: 38.5, currency: "BRL", source: "fallback" });
  });

  it("não lança exceção e ativa fallback offline quando asset_prices estiver vazia", async () => {
    builder = makeBuilder({ data: [] });
    assetBuilder = makeBuilder({
      data: [
        { ticker: "VALE3", currency: "BRL", average_price: 62.0, asset_class: "Ações" },
        { ticker: "CAIXA", currency: "BRL", average_price: 0, asset_class: "Caixa" },
      ],
    });

    const rows = await listAssetPrices();
    expect(rows).toHaveLength(2);

    const vale3 = rows.find((r) => r.ticker === "VALE3");
    const caixa = rows.find((r) => r.ticker === "CAIXA");

    expect(vale3).toMatchObject({ ticker: "VALE3", price: 62.0, source: "fallback" });
    expect(caixa).toMatchObject({ ticker: "CAIXA", price: 1, source: "fallback" });
  });

  it("degrada graciosamente para fallback offline quando asset_prices sofre erro de rede", async () => {
    builder = makeBuilder({ data: null, error: { message: "Failed to fetch", code: "NETWORK_ERROR" } });
    assetBuilder = makeBuilder({
      data: [{ ticker: "PETR4", currency: "BRL", average_price: 41.5, asset_class: "Ações" }],
    });

    const rows = await listAssetPrices();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ticker: "PETR4", price: 41.5, source: "fallback" });
  });

  it("aceita knownAssets em memória evitando consulta redundante ao banco", async () => {
    builder = makeBuilder({ data: [] });

    const rows = await listAssetPrices([
      { ticker: "BBDC4", currency: "BRL", average_price: 14.5, asset_class: "Ações" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ ticker: "BBDC4", price: 14.5, source: "fallback" });
  });
});

