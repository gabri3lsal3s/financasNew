/**
 * Motor puro de parsing e importação de investimentos — FASE 35 & 36.
 *
 * Interpreta lançamentos de carteira a partir de:
 * 1. Linguagem natural livre (Quick-Paste): frases como "15/08 comprei 100 PETR4 a 38,50", "recebi 45 de dividendo de MXRF11 hoje";
 * 2. Planilhas e relatórios CSV de corretoras e B3 (Área do Investidor / CEI, Kinvo, Gorila, XP, NuInvest, Inter, BTG, Clear, Toro, Rico).
 */

import { addDaysISO, todayISO } from "@/domain/debts";
import { inferCurrencyFromTicker } from "./valuation";
import type { AssetCurrency, PortfolioTransactionType } from "@/types";

export interface ParsedPortfolioImportRow {
  date: string; // YYYY-MM-DD
  ticker: string;
  type: PortfolioTransactionType;
  quantity: number;
  price: number;
  total: number;
  assetClass: string | null;
  currency: AssetCurrency;
  rawText: string;
}

export type PortfolioSpreadsheetMode = "movements" | "positions";

export interface PortfolioColumnMapping {
  mode: PortfolioSpreadsheetMode;
  dateColIndex: number;
  tickerColIndex: number;
  typeColIndex: number;
  qtyColIndex: number;
  priceColIndex: number;
  totalColIndex: number;
  hasHeader: boolean;
  delimiter: string;
}

export interface RawPortfolioRow {
  rowIndex: number;
  cells: string[];
  rawText: string;
}

const MONTH_NAME_TO_NUMBER: Record<string, string> = {
  janeiro: "01",
  jan: "01",
  fevereiro: "02",
  fev: "02",
  marco: "03",
  março: "03",
  mar: "03",
  abril: "04",
  abr: "04",
  maio: "05",
  mai: "05",
  junho: "06",
  jun: "06",
  julho: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  setembro: "09",
  set: "09",
  outubro: "10",
  out: "10",
  novembro: "11",
  nov: "11",
  dezembro: "12",
  dez: "12",
};

/**
 * Infere a classe do ativo com base no padrão do ticker.
 */
export function inferAssetClassFromTicker(ticker: string): string | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;

  if (["BTC", "ETH", "SOL", "USDT", "USDC", "BITCOIN", "ETHEREUM"].includes(t)) {
    return "Cripto";
  }
  if (t.startsWith("TESOURO") || t.startsWith("CDB") || t.startsWith("LCI") || t.startsWith("LCA") || t === "SELIC" || t === "CDI") {
    return "Renda Fixa";
  }
  if (t === "CAIXA" || t === "RESERVA") {
    return "Caixa";
  }
  // BDRs B3 (terminações 32, 33, 34, 35, 39)
  if (/^[A-Z]{4}(?:32|33|34|35|39)$/.test(t)) {
    return "BDRs";
  }
  // FIIs e FIAGROs B3 (terminação 11)
  if (/^[A-Z]{4}11$/.test(t)) {
    return "FIIs";
  }
  // Ações B3 ordinárias/preferenciais/units (terminações 3, 4, 5, 6, 7, 8)
  if (/^[A-Z]{4}(?:3|4|5|6|7|8)$/.test(t)) {
    return "Ações";
  }
  // Internacional puro (1 a 5 letras sem dígitos)
  if (/^[A-Za-z]{1,5}$/.test(t)) {
    return "Internacional";
  }

  return "Outros";
}

/**
 * Extrai data ISO de uma linha de texto.
 */
export function extractDateFromText(text: string, defaultYear = new Date().getFullYear()): { dateStr: string; textWithoutDate: string } {
  const lower = text.toLowerCase();

  // Relativos
  if (/\bhoje\b/i.test(text)) {
    return { dateStr: todayISO(), textWithoutDate: text.replace(/\bhoje\b/gi, " ").trim() };
  }
  if (/\bontem\b/i.test(text)) {
    return { dateStr: addDaysISO(todayISO(), -1), textWithoutDate: text.replace(/\bontem\b/gi, " ").trim() };
  }
  if (/\banteontem\b/i.test(text)) {
    return { dateStr: addDaysISO(todayISO(), -2), textWithoutDate: text.replace(/\banteontem\b/gi, " ").trim() };
  }

  // DD/MM/YYYY
  const dmyMatch = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(text);
  if (dmyMatch && dmyMatch[1] && dmyMatch[2] && dmyMatch[3]) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    return { dateStr: `${dmyMatch[3]}-${month}-${day}`, textWithoutDate: text.replace(dmyMatch[0], " ").trim() };
  }

  // YYYY-MM-DD
  const isoMatch = /\b(\d{4})[/-](\d{2})[/-](\d{2})\b/.exec(text);
  if (isoMatch && isoMatch[1] && isoMatch[2] && isoMatch[3]) {
    return { dateStr: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, textWithoutDate: text.replace(isoMatch[0], " ").trim() };
  }

  // DD de [Mês] (de [Ano])?
  const namedMatch = /\b(\d{1,2})(?:º|o)?\s*(?:de\s+)?(janeiro|jan|fevereiro|fev|março|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)(?:\s*(?:de\s+)?(\d{4}))?\b/i.exec(lower);
  if (namedMatch && namedMatch[1] && namedMatch[2]) {
    const day = namedMatch[1].padStart(2, "0");
    const month = MONTH_NAME_TO_NUMBER[namedMatch[2].toLowerCase()] ?? "01";
    const year = namedMatch[3] ?? defaultYear.toString();
    return { dateStr: `${year}-${month}-${day}`, textWithoutDate: text.replace(new RegExp(namedMatch[0], "i"), " ").trim() };
  }

  // DD/MM (sem ano)
  const dmMatch = /\b(\d{1,2})[/.-](\d{1,2})\b/.exec(text);
  if (dmMatch && dmMatch[1] && dmMatch[2]) {
    const day = dmMatch[1].padStart(2, "0");
    const month = dmMatch[2].padStart(2, "0");
    return { dateStr: `${defaultYear}-${month}-${day}`, textWithoutDate: text.replace(dmMatch[0], " ").trim() };
  }

  return { dateStr: todayISO(), textWithoutDate: text };
}

/**
 * Identifica o tipo de transação a partir do texto (inclui terminologia oficial B3 e corretoras).
 */
export function identifyTransactionType(text: string): PortfolioTransactionType {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (/\b(?:jcp|juros\s+(?:sobre|s\/)\s+capital)\b/i.test(lower)) return "jcp";
  if (/\b(?:fii\s+yield|rendimento|rendimentos)\b/i.test(lower)) return "fii_yield";
  if (/\b(?:dividendo|dividendos|dividend)\b/i.test(lower)) return "dividend";
  if (/\b(?:provento|proventos|bonificacao)\b/i.test(lower)) return "fii_yield";
  if (/\b(?:subscricao|subscription|direitos)\b/i.test(lower)) return "subscription";
  if (/\b(?:desdobramento|desdobro|split)\b/i.test(lower)) return "split";
  if (/\b(?:grupamento|inplit|reverse\s*split)\b/i.test(lower)) return "reverse_split";
  if (/\b(?:vendi|venda|resgatei|resgate|sell|alienacao|debito|saida|v\b)\b/i.test(lower)) return "sell";
  if (/\b(?:comprei|compra|aplicacao|aporte|buy|aquisicao|credito|entrada|liquidacao|c\b)\b/i.test(lower)) return "buy";

  return "buy";
}

/**
 * Extrai e normaliza o Ticker a partir de strings da B3 e texto livre:
 * - Trata fracionário B3: PETR4F -> PETR4, VALE3F -> VALE3
 * - Extrai ticker de descrições longas da B3: "PETR4 - PETROLEO BRASILEIRO" -> "PETR4"
 */
export function extractTickerFromText(text: string): { ticker: string; textWithoutTicker: string } | null {
  const clean = text.trim();
  if (!clean) return null;

  // 1. Tickers B3 Fracionários (ex: PETR4F, VALE3F, BBDC4F, TAEE11F, BOVA11F)
  const b3FracMatch = /\b([A-Z]{4}(?:3|4|5|6|7|8|11|32|33|34|35|39))F\b/i.exec(clean);
  if (b3FracMatch && b3FracMatch[1]) {
    const ticker = b3FracMatch[1].toUpperCase();
    return { ticker, textWithoutTicker: clean.replace(b3FracMatch[0], " ").trim() };
  }

  // 2. Tickers B3 comuns com números: PETR4, VALE3, MXRF11, BOVA11, AAPL34, etc.
  const b3Match = /\b([A-Z]{4}(?:3|4|5|6|7|8|11|32|33|34|35|39|12))\b/i.exec(clean);
  if (b3Match && b3Match[1]) {
    const ticker = b3Match[1].toUpperCase();
    return { ticker, textWithoutTicker: clean.replace(b3Match[0], " ").trim() };
  }

  // 3. Criptoativos conhecidos
  const cryptoMatch = /\b(BTC|ETH|SOL|USDT|USDC)\b/i.exec(clean);
  if (cryptoMatch && cryptoMatch[1]) {
    const ticker = cryptoMatch[1].toUpperCase();
    return { ticker, textWithoutTicker: clean.replace(cryptoMatch[0], " ").trim() };
  }

  // 4. Tickers Internacionais (2 a 5 letras isoladas em maiúsculo, ex.: AAPL, MSFT, NVDA, TSLA, IVV, QQQ)
  const usMatch = /\b([A-Z]{2,5})\b/.exec(clean);
  if (usMatch && usMatch[1]) {
    const ignoredWords = new Set([
      "POR", "COM", "SEM", "HOJE", "ONTEM", "DE", "EM", "NA", "NO", "A", "O",
      "BRL", "USD", "R", "CADA", "VALOR", "LOTE", "TIPO", "DATA", "QTD", "TOTAL",
      "PRECO", "PREÇO", "COMPRA", "VENDA", "SAIDA", "ENTRADA", "ATIVO", "PAPEL",
      "FII", "FIIS", "ON", "PN", "NM", "ED", "ER", "CI", "DRN", "BDR", "BR"
    ]);
    const candidate = usMatch[1].toUpperCase();
    if (!ignoredWords.has(candidate)) {
      return { ticker: candidate, textWithoutTicker: clean.replace(usMatch[0], " ").trim() };
    }
  }

  return null;
}

/**
 * Converte string de número (brasileiro ou internacional) para float.
 */
export function parseNumberClean(raw: string): number {
  const clean = raw.trim().replace(/^R\$\s*/i, "").replace(/^\$\s*/, "").replace(/\s+/g, "").replace(/^[-+]/, "");
  if (!clean || clean === "-") return 0;

  if (clean.includes(",") && clean.includes(".")) {
    // 1.250,50 -> 1250.50
    return parseFloat(clean.replace(/\./g, "").replace(",", "."));
  }
  if (clean.includes(",")) {
    // 45,90 -> 45.90
    return parseFloat(clean.replace(",", "."));
  }
  return parseFloat(clean);
}

/**
 * Tenta analisar uma linha de texto em linguagem natural para investimento.
 */
export function parseNaturalInvestmentLine(
  line: string,
  defaultYear = new Date().getFullYear(),
): ParsedPortfolioImportRow | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const { dateStr, textWithoutDate } = extractDateFromText(trimmed, defaultYear);
  const type = identifyTransactionType(textWithoutDate);
  const tickerData = extractTickerFromText(textWithoutDate);
  if (!tickerData) return null;

  const { ticker, textWithoutTicker } = tickerData;
  const currency = inferCurrencyFromTicker(ticker);
  const assetClass = inferAssetClassFromTicker(ticker);

  // Proventos / Dividendos / Rendimentos
  if (type === "dividend" || type === "jcp" || type === "fii_yield") {
    const amountMatch = /(?:R\$|\$|BRL)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,2})?)/i.exec(textWithoutTicker);
    const total = amountMatch && amountMatch[1] ? parseNumberClean(amountMatch[1]) : 0;
    if (total <= 0) return null;

    return {
      date: dateStr,
      ticker,
      type,
      quantity: 0,
      price: 0,
      total: Math.round(total * 100) / 100,
      assetClass,
      currency,
      rawText: trimmed,
    };
  }

  // Splits / Desdobramentos
  if (type === "split" || type === "reverse_split") {
    const factorMatch = /\b(\d+(?:[.,]\d+)?)\b/.exec(textWithoutTicker);
    const factor = factorMatch && factorMatch[1] ? parseNumberClean(factorMatch[1]) : 2;
    return {
      date: dateStr,
      ticker,
      type,
      quantity: factor > 0 ? factor : 2,
      price: 0,
      total: 0,
      assetClass,
      currency,
      rawText: trimmed,
    };
  }

  // Compras, Vendas e Subscrições: quantidade e preço
  const numbersFound: number[] = [];
  const numRegex = /(?:R\$|\$)?\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+(?:[.,]\d{1,4})?)/g;
  let match: RegExpExecArray | null;
  while ((match = numRegex.exec(textWithoutTicker)) !== null) {
    if (match[1]) {
      const val = parseNumberClean(match[1]);
      if (!isNaN(val) && val > 0) {
        numbersFound.push(val);
      }
    }
  }

  if (numbersFound.length >= 2) {
    const quantity = numbersFound[0] ?? 0;
    const price = numbersFound[1] ?? 0;
    const total = Math.round(quantity * price * 100) / 100;
    return {
      date: dateStr,
      ticker,
      type,
      quantity,
      price,
      total,
      assetClass,
      currency,
      rawText: trimmed,
    };
  }

  if (numbersFound.length === 1) {
    const singleVal = numbersFound[0] ?? 0;
    return {
      date: dateStr,
      ticker,
      type,
      quantity: 1,
      price: singleVal,
      total: singleVal,
      assetClass,
      currency,
      rawText: trimmed,
    };
  }

  // Se nenhum número foi informado, trata como cadastro de ativo puro
  return {
    date: dateStr,
    ticker,
    type: "buy",
    quantity: 0,
    price: 0,
    total: 0,
    assetClass,
    currency,
    rawText: trimmed,
  };
}

/**
 * Detecta delimitadores e localiza as colunas ideais da planilha (B3, XP, BTG, NuInvest, etc).
 */
export function detectPortfolioColumns(rawContent: string): { rows: RawPortfolioRow[]; mapping: PortfolioColumnMapping } {
  const lines = rawContent.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return {
      rows: [],
      mapping: {
        mode: "movements",
        dateColIndex: 0,
        tickerColIndex: 1,
        typeColIndex: 2,
        qtyColIndex: 3,
        priceColIndex: 4,
        totalColIndex: 5,
        hasHeader: true,
        delimiter: ";",
      },
    };
  }

  const firstLine = lines[0] ?? "";
  const delimiter = firstLine.includes("\t")
    ? "\t"
    : firstLine.includes(";")
      ? ";"
      : firstLine.includes("|")
        ? "|"
        : ",";

  const rows: RawPortfolioRow[] = lines.map((line, index) => ({
    rowIndex: index,
    cells: line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, "")),
    rawText: line,
  }));

  let mode: PortfolioSpreadsheetMode = "movements";
  let dateColIndex = -1;
  let tickerColIndex = -1;
  let typeColIndex = -1;
  let qtyColIndex = -1;
  let priceColIndex = -1;
  let totalColIndex = -1;
  let hasHeader = false;

  if (rows.length > 1) {
    const headerCells = rows[0]?.cells.map((c) => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ?? [];
    const headerRowStr = headerCells.join(" ");

    const hasMovementKeywords = /data\s+do\s+negocio|tipo\s+de\s+movimentacao|liquidacao|compra\/venda|c\/v|tipo\s+de\s+operacao/i.test(headerRowStr);
    const hasPositionKeywords = /preco\s+medio|custo\s+medio|quantidade\s+disponivel|posicao\s+atualizada|valor\s+aplicado|custodia|posicao\s+em|saldo\s+em\s+custodia/i.test(headerRowStr);

    if (hasPositionKeywords && !hasMovementKeywords) {
      mode = "positions";
    }

    for (let i = 0; i < headerCells.length; i++) {
      const h = headerCells[i] ?? "";
      if (/data|date|pregao|negocio|liquidacao/i.test(h) && !/tipo|c\/v|entrada|movimenta/i.test(h)) {
        if (dateColIndex === -1) dateColIndex = i;
      } else if (/codigo|ticker|produto|papel|ativo|especificacao/i.test(h)) {
        if (tickerColIndex === -1) tickerColIndex = i;
      } else if (/movimentacao|tipo|c\/v|entrada|saida|evento/i.test(h) || (/operacao/i.test(h) && !/valor|total|montante/i.test(h))) {
        if (mode === "movements") typeColIndex = i;
      } else if (/quantidade|quant|qtd|cotas|custodia/i.test(h)) {
        if (qtyColIndex === -1) qtyColIndex = i;
      } else if (/preco\s+medio|custo\s+medio|preco|unitario|cotacao|fechamento/i.test(h) && !/total|operacao|aplicado/i.test(h)) {
        if (priceColIndex === -1) priceColIndex = i;
      } else if (/total|operacao|atualizado|aplicado|liquido|montante|valor/i.test(h)) {
        if (totalColIndex === -1) totalColIndex = i;
      }
    }

    if (tickerColIndex !== -1 || dateColIndex !== -1 || qtyColIndex !== -1) {
      hasHeader = true;
    }
  }

  // Fallbacks razoáveis se não encontrados
  const maxCols = Math.max(...rows.slice(0, 5).map((r) => r.cells.length), 4);
  if (dateColIndex === -1) dateColIndex = 0;
  if (tickerColIndex === -1) tickerColIndex = Math.min(1, maxCols - 1);
  if (typeColIndex === -1) typeColIndex = mode === "movements" ? Math.min(2, maxCols - 1) : -1;
  if (qtyColIndex === -1) qtyColIndex = Math.min(mode === "positions" ? 1 : 3, maxCols - 1);
  if (priceColIndex === -1) priceColIndex = Math.min(mode === "positions" ? 2 : 4, maxCols - 1);
  if (totalColIndex === -1) totalColIndex = Math.min(mode === "positions" ? 3 : 5, maxCols - 1);

  return {
    rows,
    mapping: {
      mode,
      dateColIndex,
      tickerColIndex,
      typeColIndex,
      qtyColIndex,
      priceColIndex,
      totalColIndex,
      hasHeader,
      delimiter,
    },
  };
}

/**
 * Converte linhas tabulares em lançamentos estruturados com base no mapeamento escolhido pelo usuário.
 */
export function parsePortfolioFromMapping(
  rows: RawPortfolioRow[],
  mapping: PortfolioColumnMapping,
  defaultYear = new Date().getFullYear(),
): ParsedPortfolioImportRow[] {
  const result: ParsedPortfolioImportRow[] = [];
  const startIndex = mapping.hasHeader ? 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const { cells, rawText } = row;

    if (cells.length < 2) {
      const parsed = parseNaturalInvestmentLine(rawText, defaultYear);
      if (parsed) result.push(parsed);
      continue;
    }

    // 1. Data
    let dateStr = todayISO();
    if (mapping.dateColIndex >= 0) {
      const dateCell = cells[mapping.dateColIndex];
      if (dateCell) {
        dateStr = extractDateFromText(dateCell, defaultYear).dateStr;
      }
    }

    // 2. Ticker
    let ticker = "";
    if (mapping.tickerColIndex >= 0) {
      const tickerCell = cells[mapping.tickerColIndex];
      if (tickerCell) {
        const extracted = extractTickerFromText(tickerCell);
        if (extracted) ticker = extracted.ticker;
      }
    }

    // Se o ticker não foi encontrado na coluna mapeada, tenta encontrar em qualquer célula da linha
    if (!ticker) {
      for (const cell of cells) {
        const found = extractTickerFromText(cell);
        if (found) {
          ticker = found.ticker;
          break;
        }
      }
    }

    if (!ticker) {
      // No modo posições, ignora linhas de cabeçalho ou rodapé que não contêm ticker (ex.: "Total Geral")
      if (mapping.mode === "positions") continue;

      const parsed = parseNaturalInvestmentLine(rawText, defaultYear);
      if (parsed) result.push(parsed);
      continue;
    }

    // 3. Tipo de Operação
    let type: PortfolioTransactionType = "buy";
    if (mapping.mode === "movements") {
      if (mapping.typeColIndex >= 0) {
        const typeCell = cells[mapping.typeColIndex];
        if (typeCell) {
          type = identifyTransactionType(typeCell);
        }
      }

      // Se o tipo deu buy genérico (ex: Entrada ou Crédito), verifica se outra célula da linha especifica o evento
      if (type === "buy") {
        for (const cell of cells) {
          const candidateType = identifyTransactionType(cell);
          if (candidateType === "dividend" || candidateType === "jcp" || candidateType === "fii_yield" || candidateType === "subscription") {
            type = candidateType;
            break;
          }
        }
      }
    }

    // 4. Quantidade, Preço e Total
    const qtyCell = mapping.qtyColIndex >= 0 ? cells[mapping.qtyColIndex] : undefined;
    const priceCell = mapping.priceColIndex >= 0 ? cells[mapping.priceColIndex] : undefined;
    const totalCell = mapping.totalColIndex >= 0 ? cells[mapping.totalColIndex] : undefined;

    const quantity = qtyCell !== undefined ? Math.abs(parseNumberClean(qtyCell)) : 0;
    let price = priceCell !== undefined ? Math.abs(parseNumberClean(priceCell)) : 0;
    let total = totalCell !== undefined ? Math.abs(parseNumberClean(totalCell)) : 0;

    if (quantity > 0 && price > 0 && total <= 0) {
      total = Math.round(quantity * price * 100) / 100;
    } else if (quantity > 0 && total > 0 && price <= 0) {
      price = Math.round((total / quantity) * 10000) / 10000;
    } else if (total > 0 && quantity <= 0 && price <= 0) {
      if (type === "buy" && mapping.mode === "movements") type = "dividend";
    }

    const currency = inferCurrencyFromTicker(ticker);
    const assetClass = inferAssetClassFromTicker(ticker);

    result.push({
      date: dateStr,
      ticker,
      type,
      quantity,
      price,
      total,
      assetClass,
      currency,
      rawText,
    });
  }

  return result;
}

/**
 * Parser de planilhas CSV e texto tabular de extratos de investimentos.
 */
export function parseInvestmentCsv(rawContent: string, defaultYear = new Date().getFullYear()): ParsedPortfolioImportRow[] {
  const { rows, mapping } = detectPortfolioColumns(rawContent);
  return parsePortfolioFromMapping(rows, mapping, defaultYear);
}

/**
 * Parser unificado: aceita tanto texto livre (Quick-Paste) quanto conteúdo CSV tabular.
 */
export function parsePortfolioInput(input: string, defaultYear = new Date().getFullYear()): ParsedPortfolioImportRow[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  // Se contém delimitadores estruturais óbvios (; ou \t ou |), processa como CSV
  if (trimmed.includes(";") || trimmed.includes("\t") || trimmed.includes("|")) {
    const csvResult = parseInvestmentCsv(trimmed, defaultYear);
    if (csvResult.length > 0) return csvResult;
  }

  // Analisa linha a linha como linguagem natural
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  const rows: ParsedPortfolioImportRow[] = [];

  for (const line of lines) {
    const parsed = parseNaturalInvestmentLine(line, defaultYear);
    if (parsed) {
      rows.push(parsed);
    }
  }

  // Se a abordagem natural encontrou linhas, retorna elas
  if (rows.length > 0) return rows;

  // Fallback para CSV separado por vírgula se houver
  if (trimmed.includes(",")) {
    return parseInvestmentCsv(trimmed, defaultYear);
  }

  return [];
}
