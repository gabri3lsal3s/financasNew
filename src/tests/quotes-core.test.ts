/**
 * F1.7 — Testes do motor puro de cotações (`supabase/functions/_shared/quotes-core.ts`).
 *
 * A edge function roda em Deno (fora do bundle do Vite), mas o motor é TS
 * puro sem I/O — testável com Vitest a partir de `src/`.
 */
import { describe, expect, it } from "vitest";
import {
  applySpikeGuardrail,
  buildGlobalQuoteUpsertRow,
  buildQuoteUpsertRow,
  classifyTickerMarket,
  computeCustodyAtComDatePure,
  evaluateSpikeGuardrail,
  isBusinessDayForMarket,
  isCashClass,
  isFuzzyDuplicateManualDividend,
  isMarketOpenForTicker,
  isMarketQuotedAsset,
  normalizeTickerForApi,
  normalizeTickerForBrapi,
  parseAwesomeApiResponse,
  parseBcbPtaxResponse,
  parseBrapiDetailed,
  parseBrapiResponse,
  parseBrapiDividends,
  parseYahooChartDetailed,
  parseYahooChartResponse,
  parseYahooDividends,
  parseYahooHistoricalClose,
  resolveAntiFloodCutoffDate,
  shouldSkipByEodGuard,
} from "../../supabase/functions/_shared/quotes-core";

describe("normalizeTickerForApi — ticker armazenado → formato Yahoo", () => {
  it("B3 com número ganha sufixo .SA", () => {
    expect(normalizeTickerForApi("PETR4")).toBe("PETR4.SA");
    expect(normalizeTickerForApi("bova11")).toBe("BOVA11.SA");
    expect(normalizeTickerForApi(" IVVB11 ")).toBe("IVVB11.SA");
  });

  it("já com sufixo/câmbio/cripto é mantido", () => {
    expect(normalizeTickerForApi("PETR4.SA")).toBe("PETR4.SA");
    expect(normalizeTickerForApi("USDBRL=X")).toBe("USDBRL=X");
    expect(normalizeTickerForApi("BTC-BRL")).toBe("BTC-BRL");
    expect(normalizeTickerForApi("BTC-USD")).toBe("BTC-USD");
  });

  it("internacional puro (1–5 letras) é mantido sem sufixo .SA", () => {
    expect(normalizeTickerForApi("O")).toBe("O");
    expect(normalizeTickerForApi("T")).toBe("T");
    expect(normalizeTickerForApi("C")).toBe("C");
    expect(normalizeTickerForApi("F")).toBe("F");
    expect(normalizeTickerForApi("V")).toBe("V");
    expect(normalizeTickerForApi("AAPL")).toBe("AAPL");
    expect(normalizeTickerForApi("msft")).toBe("MSFT");
  });

  it("entrada vazia retorna vazio (inválido para a API)", () => {
    expect(normalizeTickerForApi("  ")).toBe("");
    expect(normalizeTickerForApi("")).toBe("");
  });
});

describe("normalizeTickerForBrapi — ticker armazenado → formato Brapi", () => {
  it("remove sufixo .SA quando presente", () => {
    expect(normalizeTickerForBrapi("PETR4.SA")).toBe("PETR4");
    expect(normalizeTickerForBrapi("bova11.sa")).toBe("BOVA11");
  });

  it("mantém ticker limpo", () => {
    expect(normalizeTickerForBrapi("PETR4")).toBe("PETR4");
    expect(normalizeTickerForBrapi("AAPL")).toBe("AAPL");
  });
});

describe("parseBrapiResponse — payload da API Brapi", () => {
  const validPayload = {
    results: [
      {
        symbol: "PETR4",
        currency: "BRL",
        regularMarketPrice: 38.5,
      },
    ],
  };

  it("extrai preço e moeda de um payload válido", () => {
    expect(parseBrapiResponse("PETR4", validPayload)).toEqual({
      ticker: "PETR4",
      price: 38.5,
      currency: "BRL",
    });
  });

  it("aceita chave alternativa price", () => {
    const payload = {
      results: [{ symbol: "VALE3", currency: "BRL", price: 62.1 }],
    };
    expect(parseBrapiResponse("VALE3", payload)).toEqual({
      ticker: "VALE3",
      price: 62.1,
      currency: "BRL",
    });
  });

  it("reconhece moeda USD se fornecida", () => {
    const payload = {
      results: [{ symbol: "AAPL", currency: "USD", regularMarketPrice: 220.0 }],
    };
    expect(parseBrapiResponse("AAPL", payload)?.currency).toBe("USD");
  });

  it("retorna null para payloads inválidos ou vazios", () => {
    expect(parseBrapiResponse("PETR4", null)).toBeNull();
    expect(parseBrapiResponse("PETR4", {})).toBeNull();
    expect(parseBrapiResponse("PETR4", { results: [] })).toBeNull();
    expect(parseBrapiResponse("PETR4", { results: [{ regularMarketPrice: 0 }] })).toBeNull();
    expect(parseBrapiResponse("PETR4", { results: [{ regularMarketPrice: -10 }] })).toBeNull();
    expect(parseBrapiResponse("PETR4", { results: [{ regularMarketPrice: "NaN" }] })).toBeNull();
  });
});

describe("parseAwesomeApiResponse — payload da AwesomeAPI (câmbio)", () => {
  const validPayload = {
    USDBRL: {
      code: "USD",
      codein: "BRL",
      bid: "5.4512",
      ask: "5.4530",
    },
  };

  it("extrai cotação de câmbio USD-BRL a partir do campo bid", () => {
    expect(parseAwesomeApiResponse("USDBRL=X", validPayload)).toEqual({
      ticker: "USDBRL=X",
      price: 5.4512,
      currency: "BRL",
    });
  });

  it("aceita número direto no bid", () => {
    const payload = { USDBRL: { bid: 5.42 } };
    expect(parseAwesomeApiResponse("USDBRL=X", payload)).toEqual({
      ticker: "USDBRL=X",
      price: 5.42,
      currency: "BRL",
    });
  });

  it("retorna null para payload inválido ou sem valores válidos", () => {
    expect(parseAwesomeApiResponse("USDBRL=X", null)).toBeNull();
    expect(parseAwesomeApiResponse("USDBRL=X", {})).toBeNull();
    expect(parseAwesomeApiResponse("USDBRL=X", { USDBRL: null })).toBeNull();
    expect(parseAwesomeApiResponse("USDBRL=X", { USDBRL: { bid: "0" } })).toBeNull();
    expect(parseAwesomeApiResponse("USDBRL=X", { USDBRL: { bid: "-5.0" } })).toBeNull();
  });
});

describe("parseYahooChartResponse — payload da Yahoo Chart API v8", () => {
  const validPayload = {
    chart: {
      result: [{ meta: { regularMarketPrice: 42.5, currency: "BRL" } }],
      error: null,
    },
  };

  it("extrai preço e moeda de um payload válido", () => {
    expect(parseYahooChartResponse("PETR4", validPayload)).toEqual({
      ticker: "PETR4",
      price: 42.5,
      currency: "BRL",
    });
  });

  it("mapeia currency USD", () => {
    const payload = {
      chart: { result: [{ meta: { regularMarketPrice: 210.3, currency: "USD" } }] },
    };
    expect(parseYahooChartResponse("AAPL", payload)?.currency).toBe("USD");
  });

  it("moeda desconhecida cai para BRL (padrão do schema)", () => {
    const payload = {
      chart: { result: [{ meta: { regularMarketPrice: 10, currency: "EUR" } }] },
    };
    expect(parseYahooChartResponse("X", payload)?.currency).toBe("BRL");
  });

  it("retorna null para payloads inválidos", () => {
    expect(parseYahooChartResponse("PETR4", null)).toBeNull();
    expect(parseYahooChartResponse("PETR4", {})).toBeNull();
    expect(parseYahooChartResponse("PETR4", { chart: null })).toBeNull();
    expect(parseYahooChartResponse("PETR4", { chart: { result: [] } })).toBeNull();
    expect(parseYahooChartResponse("PETR4", { chart: { result: [{ meta: null }] } })).toBeNull();
    expect(parseYahooChartResponse("PETR4", "string")).toBeNull();
  });

  it("preço ausente/não-positivo retorna null", () => {
    expect(parseYahooChartResponse("PETR4", { chart: { result: [{ meta: {} }] } })).toBeNull();
    const zero = { chart: { result: [{ meta: { regularMarketPrice: 0 } }] } };
    expect(parseYahooChartResponse("PETR4", zero)).toBeNull();
    const negative = { chart: { result: [{ meta: { regularMarketPrice: -5 } }] } };
    expect(parseYahooChartResponse("PETR4", negative)).toBeNull();
    const nan = { chart: { result: [{ meta: { regularMarketPrice: "NaN" } }] } };
    expect(parseYahooChartResponse("PETR4", nan)).toBeNull();
  });
});

describe("applySpikeGuardrail — variação > 50% mantém o último preço", () => {
  it("mantém o preço anterior quando a variação passa de 50%", () => {
    expect(applySpikeGuardrail(100, 50)).toBe(50); // +100%
    expect(applySpikeGuardrail(10, 100)).toBe(100); // -90%
    expect(applySpikeGuardrail(200, 100)).toBe(100); // +100%
  });

  it("aceita o novo preço dentro da variação tolerada", () => {
    expect(applySpikeGuardrail(60, 100)).toBe(60); // -40%
    expect(applySpikeGuardrail(140, 100)).toBe(140); // +40%
    expect(applySpikeGuardrail(149.9, 100)).toBe(149.9); // +49.9%
    expect(applySpikeGuardrail(51, 100)).toBe(51); // -49% (limiar exato abaixo de 50% → atualiza)
  });

  it("sem preço anterior aceita o atual (primeira observação)", () => {
    expect(applySpikeGuardrail(80, null)).toBe(80);
    expect(applySpikeGuardrail(80, undefined as unknown as null)).toBe(80);
    expect(applySpikeGuardrail(80, 0)).toBe(80);
  });

  it("preço atual inválido mantém o anterior", () => {
    expect(applySpikeGuardrail(0, 100)).toBe(100);
  });
});

describe("buildQuoteUpsertRow — linha do cache global (source api)", () => {
  it("monta a linha com user_id NULL e source api", () => {
    expect(buildQuoteUpsertRow("PETR4", 42.5, "BRL", "2026-08-15T00:00:00.000Z")).toEqual({
      user_id: null,
      ticker: "PETR4",
      price: 42.5,
      currency: "BRL",
      source: "api",
      updated_at: "2026-08-15T00:00:00.000Z",
    });
  });
});

describe("isCashClass — caixa/reserva não vão à API", () => {
  it("reconhece caixa/reserva exatos (com acentos e caixa)", () => {
    expect(isCashClass("caixa")).toBe(true);
    expect(isCashClass("Reserva")).toBe(true);
    expect(isCashClass("RESERVA")).toBe(true);
    expect(isCashClass(null)).toBe(false);
    expect(isCashClass("Ações")).toBe(false);
    // mesmo comportamento do domínio: só aliases exatos (Set) após normalização
    expect(isCashClass("reserva de emergência")).toBe(false);
  });
});

describe("parseBrapiDividends — extração de proventos B3", () => {
  it("extrai dividendos e JCP com retenção de 15% de IR", () => {
    const payload = {
      results: [
        {
          symbol: "PETR4",
          dividendsData: {
            cashDividends: [
              {
                rate: 1.0,
                paymentDate: "2026-11-20T00:00:00.000Z",
                lastDatePrior: "2026-10-30",
                label: "DIVIDENDO",
              },
              {
                rate: 0.5,
                paymentDate: "2026-12-15T00:00:00.000Z",
                lastDatePrior: "2026-11-30",
                label: "JCP",
              },
            ],
          },
        },
      ],
    };

    const divs = parseBrapiDividends("PETR4", payload);
    expect(divs).toHaveLength(2);

    expect(divs[0]).toEqual({
      ticker: "PETR4",
      type: "DIVIDENDO",
      com_date: "2026-10-30",
      payment_date: "2026-11-20",
      rate: 1.0,
      net_rate: 1.0,
      tax_rate_pct: 0,
      currency: "BRL",
      provider: "brapi",
      is_type_uncertain: false,
    });

    expect(divs[1]).toEqual({
      ticker: "PETR4",
      type: "JCP",
      com_date: "2026-11-30",
      payment_date: "2026-12-15",
      rate: 0.5,
      net_rate: 0.425, // 0.5 * 0.85
      tax_rate_pct: 15,
      currency: "BRL",
      provider: "brapi",
      is_type_uncertain: false,
    });
  });

  it("retorna lista vazia para payload inválido ou sem dividendos", () => {
    expect(parseBrapiDividends("PETR4", null)).toEqual([]);
    expect(parseBrapiDividends("PETR4", {})).toEqual([]);
    expect(parseBrapiDividends("PETR4", { results: [] })).toEqual([]);
  });
});

describe("Bloco A — Normalização fracionária/US, parsers detalhados, EOD Guard e Spike inteligente", () => {
  it("normaliza fracionário B3 (PETR4F) e ações EUA com ponto (BRK.B)", () => {
    expect(normalizeTickerForApi("PETR4F")).toBe("PETR4.SA");
    expect(normalizeTickerForApi("petr4f.sa")).toBe("PETR4.SA");
    expect(normalizeTickerForBrapi("PETR4F")).toBe("PETR4");
    expect(normalizeTickerForApi("BRK.B")).toBe("BRK-B");
    expect(classifyTickerMarket("PETR4F")).toBe("BR");
    expect(classifyTickerMarket("BRK.B")).toBe("US");
  });

  it("parseYahooChartDetailed extrai marketPriceAt, chartPreviousClose e events.splits", () => {
    const detailed = parseYahooChartDetailed("PETR4", {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 19.5,
              currency: "BRL",
              regularMarketTime: 1760648100, // 2025-10-16T20:55:00Z
              chartPreviousClose: 39.0,
            },
            events: {
              splits: {
                "1760616000": {
                  date: 1760616000,
                  numerator: 2,
                  denominator: 1,
                },
              },
            },
          },
        ],
      },
    });

    expect(detailed).not.toBeNull();
    expect(detailed?.price).toBe(19.5);
    expect(detailed?.provider).toBe("yahoo");
    expect(detailed?.marketPriceAt).toBe("2025-10-16T20:55:00.000Z");
    expect(detailed?.chartPreviousClose).toBe(39.0);
    expect(detailed?.splits).toHaveLength(1);
    expect(detailed?.splits?.[0]?.ratio).toBe(2);
  });

  it("parseBrapiDetailed e parseBcbPtaxResponse extraem timestamps reais (Olinda e SGS 1)", () => {
    const brapi = parseBrapiDetailed("VALE3", {
      results: [
        {
          regularMarketPrice: 61.2,
          currency: "BRL",
          regularMarketTime: "2026-10-16T18:05:00.000Z",
        },
      ],
    });
    expect(brapi?.marketPriceAt).toBe("2026-10-16T18:05:00.000Z");
    expect(brapi?.provider).toBe("brapi");

    const olinda = parseBcbPtaxResponse("USDBRL=X", {
      value: [
        { cotacaoCompra: 5.71, cotacaoVenda: 5.72, dataHoraCotacao: "2026-10-30 13:09:24.123" },
        { cotacaoCompra: 5.73, cotacaoVenda: 5.7412, dataHoraCotacao: "2026-10-30 13:11:00.000" },
      ],
    });
    expect(olinda?.price).toBe(5.7412);
    expect(olinda?.provider).toBe("bcb_ptax");
    expect(olinda?.referenceDate).toBe("2026-10-30");
    expect(olinda?.marketPriceAt).toBe("2026-10-30T16:11:00.000Z");

    const sgs = parseBcbPtaxResponse("USDBRL=X", [{ data: "30/10/2026", valor: "5.7399" }]);
    expect(sgs?.price).toBe(5.7399);
    expect(sgs?.referenceDate).toBe("2026-10-30");
  });

  it("parseYahooHistoricalClose seleciona o último pregão dentro da competência YYYY-MM", () => {
    const tSep30 = Math.floor(Date.parse("2026-09-30T20:00:00.000Z") / 1000);
    const tOct01 = Math.floor(Date.parse("2026-10-01T20:00:00.000Z") / 1000);
    const hist = parseYahooHistoricalClose(
      "AAPL",
      {
        chart: {
          result: [
            {
              meta: { currency: "USD" },
              timestamp: [tSep30, tOct01],
              indicators: { quote: [{ close: [224.5, 230.0] }] },
            },
          ],
        },
      },
      "2026-09",
    );

    expect(hist?.price).toBe(224.5);
    expect(hist?.currency).toBe("USD");
    expect(hist?.referenceDate).toBe("2026-09-30");
  });

  it("shouldSkipByEodGuard libera cache_miss e bloqueia chamadas repetidas após EOD com mercado fechado", () => {
    const sunday = new Date("2026-06-14T15:00:00.000Z");
    expect(isMarketOpenForTicker("PETR4", sunday)).toBe(false);
    expect(isBusinessDayForMarket("2026-06-15", "BR")).toBe(true);

    expect(
      shouldSkipByEodGuard({
        ticker: "PETR4",
        fetchedAt: "2026-06-12T21:30:00.000Z",
        marketPriceAt: "2026-06-12T20:55:00.000Z",
        existingPrice: 38.0,
        existingSource: "api",
        now: sunday,
      }),
    ).toBe(true);

    expect(
      shouldSkipByEodGuard({
        ticker: "PETR4",
        fetchedAt: "2026-06-12T21:30:00.000Z",
        marketPriceAt: "2026-06-12T20:55:00.000Z",
        existingPrice: 38.0,
        existingSource: "api",
        now: sunday,
        reason: "cache_miss",
      }),
    ).toBe(false);
  });

  it("evaluateSpikeGuardrail destrava splits, consenso, cache > 5 dias úteis e confirmação dupla", () => {
    const now = new Date("2026-06-17T16:00:00.000Z");

    // 1. Split 3:1 e inplit 1:10 nos últimos 5 dias úteis (> 50% variação)
    const splitRes = evaluateSpikeGuardrail({
      ticker: "PETR4",
      newPrice: 20.0,
      previousPrice: 60.0,
      splits: [{ timestamp: 1, dateISO: "2026-06-15", numerator: 3, denominator: 1, ratio: 3 }],
      now,
    });
    expect(splitRes.accepted).toBe(true);
    expect(splitRes.reason).toBe("split_verified");

    const inplitRes = evaluateSpikeGuardrail({
      ticker: "OIBR3",
      newPrice: 20.0,
      previousPrice: 2.0,
      splits: [{ timestamp: 2, dateISO: "2026-06-15", numerator: 1, denominator: 10, ratio: 0.1 }],
      now,
    });
    expect(inplitRes.accepted).toBe(true);
    expect(inplitRes.reason).toBe("split_verified");

    // 2. Consenso secundário (±5%)
    const consensusRes = evaluateSpikeGuardrail({
      ticker: "PETR4",
      newPrice: 90.0,
      previousPrice: 40.0,
      secondaryConfirmPrice: 89.5,
      now,
    });
    expect(consensusRes.accepted).toBe(true);
    expect(consensusRes.reason).toBe("consensus_verified");

    // 3. Cache antigo > 5 dias úteis
    const staleRes = evaluateSpikeGuardrail({
      ticker: "PETR4",
      newPrice: 90.0,
      previousPrice: 40.0,
      previousMarketPriceAt: "2026-06-01T20:00:00.000Z",
      now,
    });
    expect(staleRes.accepted).toBe(true);
    expect(staleRes.reason).toBe("stale_cache_override");

    // 4. Spike isolado trava e registra pending_spike_*; 2ª confirmação >= 10 min destrava
    const firstSpike = evaluateSpikeGuardrail({
      ticker: "PETR4",
      newPrice: 90.0,
      previousPrice: 40.0,
      previousMarketPriceAt: "2026-06-16T20:00:00.000Z",
      now,
    });
    expect(firstSpike.accepted).toBe(false);
    expect(firstSpike.reason).toBe("spike_guarded");
    expect(firstSpike.effectivePrice).toBe(40.0);
    expect(firstSpike.pendingSpikePrice).toBe(90.0);

    const secondSpike = evaluateSpikeGuardrail({
      ticker: "PETR4",
      newPrice: 91.0,
      previousPrice: 40.0,
      previousMarketPriceAt: "2026-06-16T20:00:00.000Z",
      pendingSpikePrice: 90.0,
      pendingSpikeAt: new Date(now.getTime() - 12 * 60_000).toISOString(),
      now,
    });
    expect(secondSpike.accepted).toBe(true);
    expect(secondSpike.reason).toBe("double_confirm_unlocked");
  });

  it("buildGlobalQuoteUpsertRow e isMarketQuotedAsset respeitam esquema global e exclusões de RF/Caixa", () => {
    const row = buildGlobalQuoteUpsertRow({
      ticker: "petr4",
      price: 38.9,
      currency: "BRL",
      marketPriceAt: "2026-06-17T16:00:00.000Z",
      fetchedAt: "2026-06-17T16:01:00.000Z",
      provider: "yahoo",
    });
    expect(row.user_id).toBeNull();
    expect(row.ticker).toBe("PETR4");
    expect(row.source).toBe("api");

    expect(isMarketQuotedAsset({ ticker: "PETR4", asset_class: "Ações" })).toBe(true);
    expect(isMarketQuotedAsset({ ticker: "CAIXA", asset_class: "Reserva" })).toBe(false);
    expect(isMarketQuotedAsset({ ticker: "CDB-BANCO", asset_class: "Renda Fixa" })).toBe(false);
    expect(isMarketQuotedAsset({ ticker: "TESOURO SELIC", asset_class: "Tesouro Direto" })).toBe(false);
    expect(isMarketQuotedAsset({ ticker: "IMOVEL", asset_class: "Outros", notes: "[VALUATION:CUSTOM]" })).toBe(false);
  });
});

describe("Bloco C — Proventos B3/EUA, Custódia na Data COM, Anti-Flood e Deduplicação", () => {
  it("parseBrapiDividends aceita paymentDate nula/indefinida mantendo com_date válida", () => {
    const divs = parseBrapiDividends("ITUB4", {
      results: [
        {
          symbol: "ITUB4",
          dividendsData: {
            cashDividends: [
              {
                rate: 0.35,
                paymentDate: null,
                lastDatePrior: "2026-11-10",
                label: "DIVIDENDO",
              },
            ],
          },
        },
      ],
    });

    expect(divs).toHaveLength(1);
    expect(divs[0]?.payment_date).toBeNull();
    expect(divs[0]?.com_date).toBe("2026-11-10");
  });

  it("parseYahooDividends aplica WHT 30% + dia útil NYSE anterior para EUA e is_type_uncertain para B3", () => {
    const mondayExTs = Math.floor(Date.parse("2026-06-15T14:00:00.000Z") / 1000);
    const usDivs = parseYahooDividends(
      "AAPL",
      {
        chart: {
          result: [
            {
              meta: { currency: "USD" },
              events: {
                dividends: {
                  [String(mondayExTs)]: { amount: 1.0, date: mondayExTs },
                },
              },
            },
          ],
        },
      },
      "US",
    );

    expect(usDivs).toHaveLength(1);
    expect(usDivs[0]?.currency).toBe("USD");
    expect(usDivs[0]?.tax_rate_pct).toBe(30);
    expect(usDivs[0]?.net_rate).toBe(0.7);
    expect(usDivs[0]?.is_type_uncertain).toBe(false);
    expect(usDivs[0]?.com_date).toBe("2026-06-12"); // sexta anterior à segunda-feira 15/06

    const brDivs = parseYahooDividends(
      "BBAS3",
      {
        chart: {
          result: [
            {
              meta: { currency: "BRL" },
              events: {
                dividends: {
                  [String(mondayExTs)]: { amount: 0.8, date: mondayExTs },
                },
              },
            },
          ],
        },
      },
      "BR",
    );

    expect(brDivs).toHaveLength(1);
    expect(brDivs[0]?.currency).toBe("BRL");
    expect(brDivs[0]?.provider).toBe("yahoo");
    expect(brDivs[0]?.is_type_uncertain).toBe(true);
  });

  it("computeCustodyAtComDatePure reconcilia baseline + compras + split 2:1 na Data COM", () => {
    // Usuário tinha 50 cotas iniciais, comprou +50 em 2026-05-05 (total 100) e sofreu split 2:1 em 2026-05-20 (total final 200)
    const txs = [
      { type: "buy", date: "2026-05-05", quantity: 50 },
      { type: "split", date: "2026-05-20", quantity: 2 },
    ];
    expect(computeCustodyAtComDatePure({ quantity: 200, created_at: "2026-01-01" }, txs, "2026-05-01")).toBe(50);
    expect(computeCustodyAtComDatePure({ quantity: 200, created_at: "2026-01-01" }, txs, "2026-05-10")).toBe(100);
    expect(computeCustodyAtComDatePure({ quantity: 200, created_at: "2026-01-01" }, txs, "2026-05-25")).toBe(200);
  });

  it("resolveAntiFloodCutoffDate e isFuzzyDuplicateManualDividend respeitam janela segura e tolerância", () => {
    expect(resolveAntiFloodCutoffDate("2026-11-20", "2026-11-23", 7)).toBe("2026-11-20");
    expect(resolveAntiFloodCutoffDate("2026-01-01", "2026-11-23", 7)).toBe("2026-11-16");

    const dup = isFuzzyDuplicateManualDividend("2026-11-20", 100.0, [
      { id: "man-1", date: "2026-11-23", amount: 100.03 },
    ]);
    expect(dup).toEqual({ matched: true, matchedDividendId: "man-1" });

    const nullDate = isFuzzyDuplicateManualDividend(null, 100.0, [
      { id: "man-1", date: "2026-11-23", amount: 100.0 },
    ]);
    expect(nullDate).toEqual({ matched: false, matchedDividendId: null });
  });
});

