import type { SpatialPdfLine, SpatialPdfToken } from "./spatial-pdf-extractor";

const LINE_DATE_GLOBAL_REGEX =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s+(?:de\s+)?(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*)\b/gi;

const LINE_BRL_AMOUNT_GLOBAL_REGEX =
  /(?:(?:-\s*)?r\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})(?:\s*([cd-]))?(?!\d)/gi;

const FOREIGN_CURRENCY_PREFIX_REGEX = /(?:usd|eur|gbp|us\$|€|£|cad|aud|chf)\s*$/i;

const NON_TRANSACTIONAL_BAND_REGEX =
  /\b(?:total\s+(?:do\s+cart[aã]o|a\s+pagar|da\s+fatura|de\s+compras)|hist[oó]rico\s+de\s+fatura|fatura\s+atual|resumo\s+da\s+fatura|lan[çc]amentos\s+do\s+cart[aã]o|taxas\s+e\s+encargos|pagamento\s+m[ií]nimo|cr[eé]dito\s+rotativo)\b/i;

/**
 * Remove glifos/ícones isolados (ex.: globo internacional, setas, símbolos gráficos)
 * preservando caracteres alfanuméricos, pontuação financeira e operadores.
 */
export function isIsolatedPictographToken(str: string): boolean {
  const trimmed = str.trim();
  if (!trimmed || trimmed.length > 2) return false;
  return /^[\u2190-\u2BFF\uE000-\uF8FF\u{1F000}-\u{1FAFF}]+$/u.test(trimmed);
}

/**
 * Filtra apenas os tokens de linhas horizontais candidatas a lançamentos (`Data + Valor`),
 * impedindo que cabeçalhos largos, títulos de sub-cartão ou rodapés bloqueiem o vale bimodal.
 */
export function filterTransactionalTokensForBimodal(
  tokens: readonly SpatialPdfToken[],
): SpatialPdfToken[] {
  if (tokens.length === 0) return [];
  const sorted = [...tokens].sort((a, b) => b.y - a.y || a.x - b.x);
  const buckets: SpatialPdfToken[][] = [];

  let currentY: number | null = null;
  let currentRefSize = 8;
  let bucket: SpatialPdfToken[] = [];

  for (const tok of sorted) {
    if (isIsolatedPictographToken(tok.str)) continue;
    const refSize = tok.fontSize > 0 ? tok.fontSize : currentRefSize;
    const yTol = Math.max(2.5, Math.min(6, refSize * 0.35));

    if (currentY === null || Math.abs(currentY - tok.y) <= yTol) {
      if (currentY === null) {
        currentY = tok.y;
        currentRefSize = tok.fontSize > 0 ? tok.fontSize : 8;
      }
      bucket.push(tok);
    } else {
      buckets.push(bucket);
      currentY = tok.y;
      currentRefSize = tok.fontSize > 0 ? tok.fontSize : 8;
      bucket = [tok];
    }
  }
  if (bucket.length > 0) buckets.push(bucket);

  const kept: SpatialPdfToken[] = [];
  for (const row of buckets) {
    const ordered = [...row].sort((a, b) => a.x - b.x);
    const text = ordered.map((t) => t.str).join(" ").replace(/\s{2,}/g, " ").trim();
    if (!text || NON_TRANSACTIONAL_BAND_REGEX.test(text)) continue;
    const hasDate = new RegExp(LINE_DATE_GLOBAL_REGEX.source, "i").test(text);
    const hasMoney = new RegExp(LINE_BRL_AMOUNT_GLOBAL_REGEX.source, "i").test(text);
    if (hasDate && hasMoney) {
      kept.push(...ordered);
    }
  }

  return kept;
}

function findBrlMatchesExcludingForeign(
  text: string,
): Array<{ fullMatch: string; index: number; end: number }> {
  const regex = new RegExp(LINE_BRL_AMOUNT_GLOBAL_REGEX.source, "gi");
  const matches: Array<{ fullMatch: string; index: number; end: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    if (FOREIGN_CURRENCY_PREFIX_REGEX.test(before)) continue;
    matches.push({
      fullMatch: m[0],
      index: m.index,
      end: m.index + m[0].length,
    });
  }
  return matches;
}

function findDateMatches(text: string): Array<{ fullMatch: string; index: number }> {
  const regex = new RegExp(LINE_DATE_GLOBAL_REGEX.source, "gi");
  const matches: Array<{ fullMatch: string; index: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    matches.push({ fullMatch: m[0], index: m.index });
  }
  return matches;
}

/**
 * Segunda barreira determinística: se uma única linha espacial contiver `>= 2` datas
 * e `>= 2` valores BRL (indicando fusão de 2 colunas lado a lado), divide-a em 2 linhas.
 */
export function splitMergedSpatialLineByTokens(line: SpatialPdfLine): SpatialPdfLine[] {
  const text = line.text.trim();
  if (!text) return [line];

  const dates = findDateMatches(text);
  const brlAmounts = findBrlMatchesExcludingForeign(text);
  if (dates.length < 2 || brlAmounts.length < 2) {
    return [line];
  }

  const firstAmount = brlAmounts[0]!;
  const secondDate = dates.find((d) => d.index >= firstAmount.end);
  if (!secondDate) return [line];

  // Verifica se há realmente conteúdo de estabelecimento antes do 1º valor e depois da 2ª data
  const leftText = text.slice(0, firstAmount.end).trim();
  const rightText = text.slice(secondDate.index).trim();
  if (!leftText || !rightText) return [line];

  if (line.tokens.length >= 4) {
    const sorted = [...line.tokens].sort((a, b) => a.x - b.x);
    let charPos = 0;
    let splitTokenIdx = -1;
    for (let i = 0; i < sorted.length; i++) {
      const tokStr = sorted[i]!.str.trim();
      const foundAt = text.indexOf(tokStr, charPos);
      if (foundAt >= secondDate.index) {
        splitTokenIdx = i;
        break;
      }
      if (foundAt >= 0) {
        charPos = foundAt + tokStr.length;
      }
    }

    if (splitTokenIdx > 0 && splitTokenIdx < sorted.length) {
      const leftTokens = sorted.slice(0, splitTokenIdx);
      const rightTokens = sorted.slice(splitTokenIdx);
      const leftLast = leftTokens[leftTokens.length - 1]!;
      const rightFirst = rightTokens[0]!;
      return [
        {
          ...line,
          column: 1,
          xStart: leftTokens[0]!.x,
          xEnd: leftLast.x + leftLast.width,
          text: leftTokens.map((t) => t.str).join(" ").replace(/\s{2,}/g, " ").trim(),
          tokens: leftTokens,
        },
        {
          ...line,
          column: 2,
          xStart: rightFirst.x,
          xEnd: rightTokens[rightTokens.length - 1]!.x + rightTokens[rightTokens.length - 1]!.width,
          text: rightTokens.map((t) => t.str).join(" ").replace(/\s{2,}/g, " ").trim(),
          tokens: rightTokens,
        },
      ];
    }
  }

  return [
    { ...line, column: 1, text: leftText },
    { ...line, column: 2, text: rightText },
  ];
}
