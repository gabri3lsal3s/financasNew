import { describe, expect, it } from "vitest";
import {
  isPrivateFixedIncomeTicker,
  normalizeTesouroTicker,
  normalizeTickerForApi,
  normalizeTickerForBrapi,
  parseAwesomeApiResponse,
  parseBcbSgsResponse,
  parseBrapiResponse,
  parseTesouroDiretoResponse,
  parseYahooChartResponse,
} from "./quotes";

describe("isPrivateFixedIncomeTicker", () => {
  it("identifica corretamente títulos de renda fixa privada", () => {
    expect(isPrivateFixedIncomeTicker("CDB-FACTA")).toBe(true);
    expect(isPrivateFixedIncomeTicker("CDB INTER")).toBe(true);
    expect(isPrivateFixedIncomeTicker("LCI CAIXA")).toBe(true);
    expect(isPrivateFixedIncomeTicker("LCA BANCO DO BRASIL")).toBe(true);
    expect(isPrivateFixedIncomeTicker("CRI KINEA")).toBe(true);
    expect(isPrivateFixedIncomeTicker("CRA VALE")).toBe(true);
    expect(isPrivateFixedIncomeTicker("RDB NUBANK")).toBe(true);
    expect(isPrivateFixedIncomeTicker("DEB-VALE")).toBe(true);
  });

  it("retorna false para ações, FIIs e ativos de bolsa", () => {
    expect(isPrivateFixedIncomeTicker("PETR4")).toBe(false);
    expect(isPrivateFixedIncomeTicker("VALE3")).toBe(false);
    expect(isPrivateFixedIncomeTicker("HGLG11")).toBe(false);
    expect(isPrivateFixedIncomeTicker("AAPL")).toBe(false);
    expect(isPrivateFixedIncomeTicker("O")).toBe(false);
  });
});

describe("normalizeTickerForApi", () => {
  it("B3 com número ganha sufixo .SA", () => {
    expect(normalizeTickerForApi("PETR4")).toBe("PETR4.SA");
    expect(normalizeTickerForApi("BOVA11")).toBe("BOVA11.SA");
  });

  it("renda fixa privada retorna string vazia (sem cotação em bolsa)", () => {
    expect(normalizeTickerForApi("CDB-FACTA")).toBe("");
    expect(normalizeTickerForApi("LCI-ITAU")).toBe("");
  });

  it("já com sufixo ou câmbio é mantido", () => {
    expect(normalizeTickerForApi("PETR4.SA")).toBe("PETR4.SA");
    expect(normalizeTickerForApi("USDBRL=X")).toBe("USDBRL=X");
  });

  it("internacional puro (1 a 5 letras) é mantido", () => {
    expect(normalizeTickerForApi("AAPL")).toBe("AAPL");
    expect(normalizeTickerForApi("MSFT")).toBe("MSFT");
    expect(normalizeTickerForApi("O")).toBe("O");
    expect(normalizeTickerForApi("T")).toBe("T");
    expect(normalizeTickerForApi("V")).toBe("V");
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

  it("renda fixa privada retorna vazio para a Brapi", () => {
    expect(normalizeTickerForBrapi("CDB-FACTA")).toBe("");
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

  it("desempacota payload retornado via proxy Jina (data.content em string JSON)", () => {
    const payload = {
      code: 200,
      data: {
        content: JSON.stringify({
          chart: {
            result: [{ meta: { symbol: "O", regularMarketPrice: 61.5, currency: "USD" } }],
          },
        }),
      },
    };
    expect(parseYahooChartResponse("O", payload)).toEqual({
      ticker: "O",
      price: 61.5,
      currency: "USD",
    });
  });

  it("desempacota payload retornado em string JSON pura", () => {
    const payloadStr = JSON.stringify({
      chart: {
        result: [{ meta: { regularMarketPrice: 25.95, currency: "USD" } }],
      },
    });
    expect(parseYahooChartResponse("T", payloadStr)).toEqual({
      ticker: "T",
      price: 25.95,
      currency: "USD",
    });
  });

  it("retorna null para payload inválido", () => {
    expect(parseYahooChartResponse("PETR4", null)).toBeNull();
    expect(parseYahooChartResponse("PETR4", {})).toBeNull();
  });
});

describe("normalizeTesouroTicker", () => {
  it("normaliza aliases de Tesouro Selic", () => {
    expect(normalizeTesouroTicker("selic 29")).toBe("TESOURO SELIC 2029");
    expect(normalizeTesouroTicker("tesouro selic 2029")).toBe("TESOURO SELIC 2029");
    expect(normalizeTesouroTicker("lft 2027")).toBe("TESOURO SELIC 2027");
  });

  it("normaliza aliases de Tesouro IPCA+", () => {
    expect(normalizeTesouroTicker("ipca 2035")).toBe("TESOURO IPCA+ 2035");
    expect(normalizeTesouroTicker("ntn-b 2045")).toBe("TESOURO IPCA+ 2045");
    expect(normalizeTesouroTicker("ipca com juros 2040")).toBe("TESOURO IPCA+ COM JUROS SEMESTRAIS 2040");
    expect(normalizeTesouroTicker("ntnb 2055 juros")).toBe("TESOURO IPCA+ COM JUROS SEMESTRAIS 2055");
  });

  it("normaliza aliases de Tesouro Prefixado", () => {
    expect(normalizeTesouroTicker("prefixado 2026")).toBe("TESOURO PREFIXADO 2026");
    expect(normalizeTesouroTicker("ltn 2029")).toBe("TESOURO PREFIXADO 2029");
    expect(normalizeTesouroTicker("prefixado com juros 2033")).toBe("TESOURO PREFIXADO COM JUROS SEMESTRAIS 2033");
  });

  it("normaliza Renda+ e Educa+", () => {
    expect(normalizeTesouroTicker("renda mais 2060")).toBe("TESOURO RENDA+ 2060");
    expect(normalizeTesouroTicker("educa mais 2030")).toBe("TESOURO EDUCA+ 2030");
  });

  it("retorna null para ativos que não são títulos públicos", () => {
    expect(normalizeTesouroTicker("PETR4")).toBeNull();
    expect(normalizeTesouroTicker("MXRF11")).toBeNull();
    expect(normalizeTesouroTicker("")).toBeNull();
  });
});

describe("parseTesouroDiretoResponse", () => {
  it("extrai PU e vencimento da estrutura oficial de títulos", () => {
    const payload = {
      response: {
        TrsrBdTradgList: [
          {
            TrsrBd: {
              nm: "Tesouro Selic 2029",
              untrPrc: 14520.35,
              mtrtyDt: "2029-03-01T00:00:00",
              anlRcrRate: 0.15,
            },
          },
        ],
      },
    };

    const quote = parseTesouroDiretoResponse("selic 29", payload);
    expect(quote).toEqual({
      ticker: "TESOURO SELIC 2029",
      price: 14520.35,
      maturityDate: "2029-03-01",
      annualRate: 0.15,
    });
  });

  it("retorna null se não encontrar correspondência", () => {
    expect(parseTesouroDiretoResponse("PETR4", {})).toBeNull();
  });
});

describe("parseBcbSgsResponse", () => {
  it("converte taxa diária SGS 12 em taxa anual equivalente", () => {
    const payload = [{ data: "25/08/2026", valor: "0.0416" }];
    const res = parseBcbSgsResponse(payload);
    expect(res).not.toBeNull();
    expect(res?.rateDaily).toBeCloseTo(0.000416, 6);
    expect(res?.rateAnnual).toBeGreaterThan(10);
  });

  it("interpreta taxa anual diretamente se valor >= 0.2", () => {
    const payload = [{ data: "25/08/2026", valor: "10.50" }];
    const res = parseBcbSgsResponse(payload);
    expect(res).not.toBeNull();
    expect(res?.rateAnnual).toBe(10.5);
  });
});
