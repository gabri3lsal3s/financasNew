import { describe, expect, it } from "vitest";
import {
  normalizeTickerForApi,
  normalizeTickerForBrapi,
  parseAwesomeApiResponse,
  parseBrapiResponse,
  parseYahooChartResponse,
} from "./quotes";

describe("normalizeTickerForApi", () => {
  it("B3 com número ganha sufixo .SA", () => {
    expect(normalizeTickerForApi("PETR4")).toBe("PETR4.SA");
    expect(normalizeTickerForApi("BOVA11")).toBe("BOVA11.SA");
  });

  it("já com sufixo ou câmbio é mantido", () => {
    expect(normalizeTickerForApi("PETR4.SA")).toBe("PETR4.SA");
    expect(normalizeTickerForApi("USDBRL=X")).toBe("USDBRL=X");
  });

  it("internacional puro é mantido", () => {
    expect(normalizeTickerForApi("AAPL")).toBe("AAPL");
    expect(normalizeTickerForApi("MSFT")).toBe("MSFT");
  });

  it("retorna vazio para entrada vazia", () => {
    expect(normalizeTickerForApi("")).toBe("");
    expect(normalizeTickerForApi("   ")).toBe("");
  });
});

describe("normalizeTickerForBrapi", () => {
  it("remove .SA se presente", () => {
    expect(normalizeTickerForBrapi("PETR4.SA")).toBe("PETR4");
    expect(normalizeTickerForBrapi("VALE3.sa")).toBe("VALE3");
  });

  it("mantém ticker limpo", () => {
    expect(normalizeTickerForBrapi("PETR4")).toBe("PETR4");
  });
});

describe("parseBrapiResponse", () => {
  it("extrai cotação de payload válido", () => {
    const payload = {
      results: [{ symbol: "PETR4", currency: "BRL", regularMarketPrice: 38.5 }],
    };
    expect(parseBrapiResponse("PETR4", payload)).toEqual({
      ticker: "PETR4",
      price: 38.5,
      currency: "BRL",
    });
  });

  it("aceita chave de preço alternativa price", () => {
    const payload = {
      results: [{ symbol: "VALE3", currency: "BRL", price: 62.0 }],
    };
    expect(parseBrapiResponse("VALE3", payload)).toEqual({
      ticker: "VALE3",
      price: 62.0,
      currency: "BRL",
    });
  });

  it("retorna null para payload inválido ou preço não positivo", () => {
    expect(parseBrapiResponse("PETR4", null)).toBeNull();
    expect(parseBrapiResponse("PETR4", {})).toBeNull();
    expect(parseBrapiResponse("PETR4", { results: [] })).toBeNull();
    expect(parseBrapiResponse("PETR4", { results: [{ regularMarketPrice: 0 }] })).toBeNull();
  });
});

describe("parseAwesomeApiResponse", () => {
  it("extrai cotação de câmbio", () => {
    const payload = {
      USDBRL: { bid: "5.45" },
    };
    expect(parseAwesomeApiResponse("USDBRL=X", payload)).toEqual({
      ticker: "USDBRL=X",
      price: 5.45,
      currency: "BRL",
    });
  });

  it("retorna null para payload inválido", () => {
    expect(parseAwesomeApiResponse("USDBRL=X", null)).toBeNull();
    expect(parseAwesomeApiResponse("USDBRL=X", { USDBRL: { bid: "0" } })).toBeNull();
  });
});

describe("parseYahooChartResponse", () => {
  it("extrai cotação da Yahoo Chart API", () => {
    const payload = {
      chart: {
        result: [{ meta: { regularMarketPrice: 42.5, currency: "BRL" } }],
      },
    };
    expect(parseYahooChartResponse("PETR4", payload)).toEqual({
      ticker: "PETR4",
      price: 42.5,
      currency: "BRL",
    });
  });
});
