/**
 * Parser puro para importação de proventos recebidos a partir de extratos
 * da B3 (Área do Investidor), planilhas Excel (TSV) ou CSV de corretoras.
 *
 * Módulo puro — sem I/O ou dependências de UI.
 */

import type { PortfolioAsset, PortfolioDividend } from "@/types";
import { normalizeDividendTickerKey } from "./dividend-deduplication";
import { normalizeCanonicalDividendTicker } from "./dividend-engine";
import { countMarketBusinessDays, classifyTickerMarket } from "./market-calendar";

export type ImportedDividendTxType = "dividend" | "jcp" | "yield" | "other";

export interface ParsedImportedDividendRow {
  rowIndex: number;
  rawTicker: string;
  ticker: string;
  matchedAssetId: string | null;
  currency: "BRL" | "USD";
  date: string;
  txType: ImportedDividendTxType;
  amount: number;
  alreadyImported: boolean;
  notes: string;
}

export interface DividendImportParseResult {
  items: ParsedImportedDividendRow[];
  skippedInvalid: number;
  duplicateCount: number;
  newCount: number;
}

function parseFlexibleDate(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.slice(0, 10);
  const br = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(clean);
  if (br) {
    const day = Number(br[1]);
    const month = Number(br[2]);
    const year = Number(br[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000) {
      return `${br[3]}-${br[2]}-${br[1]}`;
    }
  }
  return null;
}

function parseFlexibleMoney(raw: string): number {
  const clean = raw
    .replace(/R\$|US\$|\$/gi, "")
    .replace(/\s+/g, "")
    .trim();
  if (!clean) return NaN;

  // Formato PT-BR com vírgula decimal: 1.234,56 ou 120,50
  if (clean.includes(",")) {
    const normalized = clean.replace(/\./g, "").replace(",", ".");
    return Number(normalized);
  }
  return Number(clean);
}

function extractTickerToken(raw: string): string {
  const clean = raw.trim().toUpperCase();
  if (!clean) return "";
  // Ex.: "HGRU11 - CSHG RENDA URBANA FII" ou "PETR4 - PETROBRAS"
  const head = clean.split(/\s+-\s+|\s+/)[0] ?? clean;
  return normalizeDividendTickerKey(head);
}

function mapEventType(raw: string): ImportedDividendTxType {
  const norm = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (norm.includes("JCP") || norm.includes("JURO")) return "jcp";
  if (norm.includes("RENDIMENTO")) return "yield";
  if (norm.includes("DIVIDEND")) return "dividend";
  return "other";
}

function splitDelimitedLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function detectDelimiter(headerLine: string): string {
  if (headerLine.includes("\t")) return "\t";
  if (headerLine.includes(";")) return ";";
  return ",";
}

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function parseDividendImportText(
  rawText: string,
  assets: readonly PortfolioAsset[],
  existingDividends: readonly PortfolioDividend[],
): DividendImportParseResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    return { items: [], skippedInvalid: 0, duplicateCount: 0, newCount: 0 };
  }

  const delimiter = detectDelimiter(lines[0] ?? "");
  const firstCols = splitDelimitedLine(lines[0] ?? "", delimiter).map(normalizeHeader);

  const findCol = (patterns: string[]): number =>
    firstCols.findIndex((c) => patterns.some((p) => c.includes(p)));

  const hasHeader =
    findCol(["produto", "ativo", "ticker", "papel"]) >= 0 ||
    findCol(["pagamento", "data", "date"]) >= 0;

  const tickerIdx = hasHeader ? findCol(["produto", "ativo", "ticker", "papel"]) : 0;
  const dateIdx = hasHeader ? findCol(["pagamento", "data", "date"]) : 1;
  const typeIdx = hasHeader ? findCol(["tipo", "evento", "type"]) : 2;
  const amountIdx = hasHeader
    ? findCol(["valor liquido", "liquido", "valor", "amount", "total"])
    : 3;

  const startIdx = hasHeader ? 1 : 0;
  const assetByCanonical = new Map<string, PortfolioAsset>();
  for (const a of assets) {
    const canon = normalizeCanonicalDividendTicker(a.ticker, a.currency);
    if (!assetByCanonical.has(canon)) assetByCanonical.set(canon, a);
  }

  const existingByAssetId = new Map(assets.map((a) => [a.id, a]));
  const items: ParsedImportedDividendRow[] = [];
  let skippedInvalid = 0;

  for (let i = startIdx; i < lines.length; i += 1) {
    const cols = splitDelimitedLine(lines[i] ?? "", delimiter);
    const rawTicker = cols[tickerIdx >= 0 ? tickerIdx : 0] ?? "";
    const rawDate = cols[dateIdx >= 0 ? dateIdx : 1] ?? "";
    const rawType = typeIdx >= 0 ? (cols[typeIdx] ?? "") : "";
    const rawAmount = cols[amountIdx >= 0 ? amountIdx : cols.length - 1] ?? "";

    const ticker = extractTickerToken(rawTicker);
    const date = parseFlexibleDate(rawDate);
    const amount = parseFlexibleMoney(rawAmount);

    if (!ticker || !date || !Number.isFinite(amount) || amount <= 0) {
      skippedInvalid += 1;
      continue;
    }

    const matchedAsset =
      assetByCanonical.get(normalizeCanonicalDividendTicker(ticker, "BRL")) ??
      assetByCanonical.get(normalizeCanonicalDividendTicker(ticker, "USD")) ??
      null;
    const currency: "BRL" | "USD" = matchedAsset?.currency === "USD" ? "USD" : "BRL";
    const canonical = normalizeCanonicalDividendTicker(ticker, currency);
    const market = currency === "USD" ? "US" : classifyTickerMarket(canonical);

    const alreadyImported = existingDividends.some((ex) => {
      const exAsset = ex.asset_id ? existingByAssetId.get(ex.asset_id) : null;
      const exTicker = ex.ticker ?? exAsset?.ticker ?? "";
      if (!exTicker) return false;
      const exCanon = normalizeCanonicalDividendTicker(exTicker, exAsset?.currency ?? currency);
      if (exCanon !== canonical) return false;
      const diffAmt = Math.abs(Number(ex.amount) - amount);
      if (diffAmt > 0.05) return false;
      const diffDays = Math.abs(countMarketBusinessDays(ex.date.slice(0, 10), date, market));
      return diffDays <= 3;
    });

    items.push({
      rowIndex: i + 1,
      rawTicker,
      ticker: matchedAsset?.ticker ?? ticker,
      matchedAssetId: matchedAsset?.id ?? null,
      currency,
      date,
      txType: mapEventType(rawType),
      amount: Math.round(amount * 100) / 100,
      alreadyImported,
      notes: "Importado via extrato B3/CSV",
    });
  }

  const duplicateCount = items.filter((it) => it.alreadyImported).length;
  return {
    items,
    skippedInvalid,
    duplicateCount,
    newCount: items.length - duplicateCount,
  };
}
