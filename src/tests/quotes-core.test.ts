/**
 * F1.7 — Testes do motor puro de cotações (`supabase/functions/_shared/quotes-core.ts`).
 *
 * A edge function roda em Deno (fora do bundle do Vite), mas o motor é TS
 * puro sem I/O — testável com Vitest a partir de `src/`.
 */
import { describe, expect, it } from "vitest";
import {
  applySpikeGuardrail,
  buildQuoteUpsertRow,
  isCashClass,
  normalizeTickerForApi,
  parseYahooChartResponse,
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

  it("internacional puro (2–5 letras) é mantido", () => {
    expect(normalizeTickerForApi("AAPL")).toBe("AAPL");
    expect(normalizeTickerForApi("msft")).toBe("MSFT");
  });

  it("entrada vazia retorna vazio (inválido para a API)", () => {
    expect(normalizeTickerForApi("  ")).toBe("");
    expect(normalizeTickerForApi("")).toBe("");
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
