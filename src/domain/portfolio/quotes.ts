/**
 * Motor puro de cotações de mercado — ESPECIFICAÇÃO §1.6 (D5) e §3.11.2.
 *
 * Funções puras sem I/O para normalização e parsing de respostas de APIs
 * de cotações (Brapi, AwesomeAPI, Yahoo Finance).
 */

import type { AssetCurrency } from "@/types";

export type QuoteCurrency = "BRL" | "USD";

export interface ParsedQuote {
  ticker: string;
  price: number;
  currency: AssetCurrency;
}

/**
 * Normaliza o ticker armazenado para o formato da API Yahoo Finance:
 *   • B3 com número (PETR4, BOVA11, IVVB11) → sufixo `.SA`;
 *   • já com sufixo/`=`/`-` (PETR4.SA, USDBRL=X, BTC-BRL) → mantém;
 *   • internacional puro 1–5 letras (AAPL, MSFT, O, T) → mantém.
 * Retorna "" para entrada vazia.
 */
export function normalizeTickerForApi(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return "";
  if (ticker.endsWith(".SA")) return ticker;
  if (ticker.includes("=") || ticker.includes("-") || ticker.includes(".")) return ticker;
  if (/^[A-Za-z]{1,5}$/.test(ticker)) return ticker;
  return `${ticker}.SA`;
}

/**
 * Normaliza o ticker para a API Brapi (remove sufixo `.SA` se presente).
 */
export function normalizeTickerForBrapi(raw: string): string {
  const ticker = raw.trim().toUpperCase();
  if (ticker.endsWith(".SA")) return ticker.slice(0, -3);
  return ticker;
}

/**
 * Extrai { price, currency } do payload da API Brapi (`/api/quote/{ticker}`).
 * Payload típico: { results: [{ symbol: "PETR4", regularMarketPrice: 38.5, currency: "BRL" }] }
 */
export function parseBrapiResponse(ticker: string, payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const results = (payload as Record<string, unknown>).results;
  if (!Array.isArray(results) || results.length === 0) return null;
  const item = results[0];
  if (!item || typeof item !== "object") return null;
  const itemRecord = item as Record<string, unknown>;
  const rawPrice = itemRecord.regularMarketPrice ?? itemRecord.price;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  const rawCurrency = itemRecord.currency;
  return {
    ticker,
    price: priceNum,
    currency: rawCurrency === "USD" ? "USD" : "BRL",
  };
}

/**
 * Extrai a cotação cambial da AwesomeAPI (`/last/USD-BRL`).
 * Payload típico: { USDBRL: { bid: "5.45" } }
 */
export function parseAwesomeApiResponse(ticker: string, payload: unknown): ParsedQuote | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const pairKey = Object.keys(record).find((key) => !key.startsWith("_"));
  if (!pairKey) return null;
  const data = record[pairKey];
  if (!data || typeof data !== "object") return null;
  const dataRecord = data as Record<string, unknown>;
  const rawPrice = dataRecord.bid ?? dataRecord.ask;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  return {
    ticker,
    price: priceNum,
    currency: "BRL",
  };
}

/**
 * Extrai { price, currency } do payload da Yahoo Chart API v8
 * (`/v8/finance/chart/{ticker}` → `chart.result[0].meta`).
 * Retorna null para payloads inválidos/incompletos ou preço não-positivo.
 */
export function parseYahooChartResponse(ticker: string, payload: unknown): ParsedQuote | null {
  if (!payload) return null;
  let rawObj: unknown = payload;
  if (typeof rawObj === "string") {
    try {
      rawObj = JSON.parse(rawObj);
    } catch {
      return null;
    }
  }
  if (!rawObj || typeof rawObj !== "object") return null;

  // Se veio encapsulado em proxy (ex.: Jina Reader data.content)
  const dataObj = (rawObj as Record<string, unknown>).data;
  if (dataObj && typeof dataObj === "object") {
    const content = (dataObj as Record<string, unknown>).content;
    if (typeof content === "string") {
      try {
        rawObj = JSON.parse(content);
      } catch {
        // segue com rawObj
      }
    }
  } else if (typeof (rawObj as Record<string, unknown>).contents === "string") {
    try {
      rawObj = JSON.parse((rawObj as Record<string, unknown>).contents as string);
    } catch {
      // segue com rawObj
    }
  }

  const chart = (rawObj as Record<string, unknown>).chart;
  if (!chart || typeof chart !== "object") return null;
  const result = (chart as Record<string, unknown>).result;
  if (!Array.isArray(result) || result.length === 0) return null;
  const meta = (result[0] as Record<string, unknown> | undefined)?.meta;
  if (!meta || typeof meta !== "object") return null;
  const rawPrice = (meta as Record<string, unknown>).regularMarketPrice;
  const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
  if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
  const rawCurrency = (meta as Record<string, unknown>).currency;
  return {
    ticker,
    price: priceNum,
    currency: rawCurrency === "USD" ? "USD" : "BRL",
  };
}

/**
 * Normaliza digitações livres ou aliases de Títulos Públicos para o padrão canônico oficial da B3 / Tesouro Nacional.
 *
 * Exemplos:
 *   • "selic 29", "tesouro selic 2029", "lft 2029" -> "TESOURO SELIC 2029"
 *   • "ipca 2035", "tesouro ipca+ 2035", "ntn-b 2035" -> "TESOURO IPCA+ 2035"
 *   • "ntn-b 2045 juros", "ipca com juros 2045" -> "TESOURO IPCA+ COM JUROS SEMESTRAIS 2045"
 *   • "ltn 2026", "prefixado 2026" -> "TESOURO PREFIXADO 2026"
 *   • "ntn-f 2033", "prefixado com juros 2033" -> "TESOURO PREFIXADO COM JUROS SEMESTRAIS 2033"
 *   • "renda mais 2060", "renda+ 2060" -> "TESOURO RENDA+ 2060"
 *   • "educa mais 2030", "educa+ 2030" -> "TESOURO EDUCA+ 2030"
 *
 * Retorna null se a string não corresponder a um padrão de Tesouro Direto.
 */
export function normalizeTesouroTicker(raw: string): string | null {
  if (!raw) return null;

  const normalized = raw
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  // Se for ticker puro de ações/FIIs (ex: PETR4, MXRF11, AAPL, BTC-BRL), ignora
  if (/^[A-Z]{4}[0-9]{1,2}$/.test(normalized) && !normalized.startsWith("NTN") && !normalized.startsWith("LFT") && !normalized.startsWith("LTN")) {
    return null;
  }

  // Extrai o ano de vencimento (2 ou 4 dígitos)
  const yearMatch = normalized.match(/\b(20[2-6][0-9]|[2-6][0-9])\b/);
  if (!yearMatch) {
    // Se não tiver ano explícito mas contiver palavras-chave fortes, tenta validar
    if (normalized === "TESOURO SELIC" || normalized === "SELIC") return "TESOURO SELIC";
    return null;
  }

  let yearStr = yearMatch[1] ?? "";
  if (yearStr.length === 2) {
    yearStr = `20${yearStr}`;
  }

  const hasJuros = normalized.includes("JUROS") || normalized.includes("CUPOM") || normalized.includes("SEMESTRAL") || normalized.includes("NTNF") || normalized.includes("NTN-F");

  // 1. Família SELIC / LFT
  if (normalized.includes("SELIC") || normalized.includes("LFT")) {
    return `TESOURO SELIC ${yearStr}`;
  }

  // 2. Família IPCA+ / NTN-B
  if (normalized.includes("IPCA") || normalized.includes("NTNB") || normalized.includes("NTN-B") || normalized.includes("INFLACAO")) {
    return hasJuros
      ? `TESOURO IPCA+ COM JUROS SEMESTRAIS ${yearStr}`
      : `TESOURO IPCA+ ${yearStr}`;
  }

  // 3. Família PREFIXADO / LTN / NTN-F
  if (normalized.includes("PRE") || normalized.includes("PREFIXADO") || normalized.includes("LTN") || normalized.includes("NTNF") || normalized.includes("NTN-F")) {
    return hasJuros
      ? `TESOURO PREFIXADO COM JUROS SEMESTRAIS ${yearStr}`
      : `TESOURO PREFIXADO ${yearStr}`;
  }

  // 4. Família RENDA+ (Aposentadoria)
  if (normalized.includes("RENDA+") || normalized.includes("RENDA MAIS") || normalized.includes("RENDA+")) {
    return `TESOURO RENDA+ ${yearStr}`;
  }

  // 5. Família EDUCA+ (Educação)
  if (normalized.includes("EDUCA+") || normalized.includes("EDUCA MAIS") || normalized.includes("EDUCA+")) {
    return `TESOURO EDUCA+ ${yearStr}`;
  }

  return null;
}

/**
 * Extrai a cotação do Tesouro Direto a partir da estrutura oficial de Preços/Taxas da B3/Tesouro Nacional.
 */
export function parseTesouroDiretoResponse(
  ticker: string,
  payload: unknown,
): { ticker: string; price: number; maturityDate?: string; annualRate?: number } | null {
  if (!payload || typeof payload !== "object") return null;

  const canon = normalizeTesouroTicker(ticker) ?? ticker.trim().toUpperCase();

  // Suporta payloads em formato de array de títulos [{ nome, puCompra, puResgate, vencimento, taxa }]
  const record = payload as Record<string, unknown>;
  const rawResponse = record.response as Record<string, unknown> | undefined;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray(rawResponse?.TrsrBdTradgList)
      ? (rawResponse.TrsrBdTradgList as unknown[])
      : Array.isArray(record.bonds)
        ? (record.bonds as unknown[])
        : null;

  if (!list) return null;

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const bond = item as Record<string, unknown>;
    const trsrBd = bond.TrsrBd as Record<string, unknown> | undefined;
    const rawName = String(bond.nome ?? bond.nm ?? trsrBd?.nm ?? "");
    const normalizedBondName = normalizeTesouroTicker(rawName);

    if (normalizedBondName && (normalizedBondName === canon || canon.includes(normalizedBondName) || normalizedBondName.includes(canon))) {
      const rawPrice = bond.puCompra ?? bond.puResgate ?? bond.untrPrc ?? trsrBd?.untrPrc ?? bond.price;
      const priceNum = typeof rawPrice === "number" ? rawPrice : Number(rawPrice);
      if (Number.isFinite(priceNum) && priceNum > 0) {
        const rawMaturity = String(bond.vencimento ?? bond.mtrtyDt ?? trsrBd?.mtrtyDt ?? "");
        const rawRate = bond.taxa ?? bond.anlRcrRate ?? trsrBd?.anlRcrRate;
        const rateNum = typeof rawRate === "number" ? rawRate : Number(rawRate);

        return {
          ticker: canon,
          price: priceNum,
          maturityDate: rawMaturity ? rawMaturity.slice(0, 10) : undefined,
          annualRate: Number.isFinite(rateNum) ? rateNum : undefined,
        };
      }
    }
  }

  return null;
}

/**
 * Extrai a taxa do Banco Central SGS (Série 12 para CDI diário ou Série 432 para Selic Meta).
 */
export function parseBcbSgsResponse(
  payload: unknown,
): { rateDaily?: number; rateAnnual?: number; date?: string } | null {
  if (!payload) return null;

  const list = Array.isArray(payload) ? payload : null;
  if (!list || list.length === 0) return null;

  // Pega o registro mais recente (último elemento)
  const lastItem = list[list.length - 1] as Record<string, unknown> | undefined;
  if (!lastItem || typeof lastItem !== "object") return null;

  const rawValue = lastItem.valor ?? lastItem.val;
  const valNum = typeof rawValue === "number" ? rawValue : Number(rawValue);

  if (!Number.isFinite(valNum)) return null;

  const dateStr = String(lastItem.data ?? "");

  // Se o valor for < 0.1 (ex.: 0.0416%), é taxa diária em %
  if (valNum < 0.2) {
    const dailyRate = valNum / 100;
    const annualRate = (Math.pow(1 + dailyRate, 252) - 1) * 100;
    return {
      rateDaily: dailyRate,
      rateAnnual: Math.round(annualRate * 100) / 100,
      date: dateStr,
    };
  }

  // Se o valor for >= 0.2 (ex.: 10.5%), é taxa anual em % a.a.
  const annualRate = valNum;
  const dailyRate = Math.pow(1 + annualRate / 100, 1 / 252) - 1;
  return {
    rateDaily: dailyRate,
    rateAnnual: annualRate,
    date: dateStr,
  };
}

