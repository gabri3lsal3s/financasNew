/**
 * Scorer soberano e puro para seleção do valor financeiro efetivo em comprovantes e recibos.
 *
 * Resolve conflitos de múltiplos números no mesmo documento:
 * - Desqualifica explicitamente saldos, limites, troco, tributos/impostos, descontos, tarifas e juros/multas.
 * - Pontua "Valor Pago / Líquido / Total a Pagar / Valor do Pix" acima de "Valor do Documento / Subtotal / Parcela".
 * - Reutiliza `parseBrazilianCurrencyToCents` para garantir conversão em centavos inteiros sem float.
 */

import { parseBrazilianCurrencyToCents } from "@/domain/money/parse";
import type { ConfidenceLevel } from "./receipt-types";

export interface SovereignReceiptAmountResult {
  amountCents: number;
  confidence: ConfidenceLevel;
  score: number;
  matchedLine: string;
}

interface AmountCandidate {
  amountCents: number;
  score: number;
  confidence: ConfidenceLevel;
  hasCurrencyPrefix: boolean;
  lineIndex: number;
  charIndex: number;
  matchedLine: string;
}

const DISQUALIFYING_CONTEXT_REGEX =
  /\b(?:saldo(?:\s+(?:atual|anterior|final|dispon[íi]vel|em\s+conta|restante|ap[óo]s))?|limite(?:\s+(?:dispon[íi]vel|total|di[áa]rio|restante|utilizado|do\s+cart[ãa]o|pix))?|cheque\s+especial|troco|tributos?(?:\s+(?:aprox|aproximados|totais|incidentes))?|impostos?|lei\s+(?:fed(?:eral)?\.?\s*)?12\.?741|al[íi]quota|descontos?|abatimentos?|cashback|economia|b[ôo]nus|tarifas?|taxas?(?:\s+(?:adquirente|de\s+servi[çc]o|banc[áa]ria))?|iof|juros(?:\s+e\s+multa)?|multa(?:\s+e\s+juros)?|encargos?|acr[ée]scimos?|mora|corre[çc][ãa]o\s+monet[áa]ria|pagamento\s+m[íi]nimo|valor\s+m[íi]nimo)\b/i;

const TIER_1_PAID_OR_LIQUID_REGEX =
  /\b(?:valor\s+(?:pago|efetivamente\s+pago|efetivado|debitado|creditado|transferido|enviado|recebido|cobrado|l[íi]quido|a\s+pagar|do\s+pix|da\s+transfer[êe]ncia|da\s+opera[çc][ãa]o|do\s+pagamento|da\s+transa[çc][ãa]o)|total\s+(?:pago|a\s+pagar|l[íi]quido|geral)|valor\s+total\s+a\s+pagar|l[íi]quido)\b/i;

const INSTALLMENT_UNIT_CONTEXT_REGEX =
  /\b(?:valor\s+da\s+parcela|parcela(?:\s+\d+)?|presta[çc][ãa]o|\d{1,2}\s*x\s*(?:de)?)\b/i;

const TIER_3_NOMINAL_REGEX =
  /\b(?:valor\s+(?:do\s+documento|nominal|original|principal|do\s+principal|bruto|da\s+compra|da\s+venda|do\s+t[íi]tulo)|subtotal)\b/i;

const TIER_2_GENERIC_TOTAL_REGEX =
  /\b(?:valor\s+total(?:\s+do\s+documento)?|total|valor(?:\s+data)?|pix\s+(?:enviado|recebido|agendado)|voc[êe]\s+(?:recebeu|pagou|transferiu|enviou)|a\s+quantia\s+de|import[âa]ncia\s+de)\b/i;

const ITEM_LINE_NOISE_REGEX = /\b(?:item\s*\d+|qtd|un\b|\dx\b)\b/i;

const FINANCIAL_LABEL_HINT_REGEX =
  /\b(?:valor|total|pago|recebido|l[íi]quido|transferido|cobrado|debitado|creditado)\b/i;

function isInsideBarCodeOrDate(line: string, start: number, end: number): boolean {
  const before = start > 0 ? line.charAt(start - 1) : "";
  const after = end < line.length ? line.charAt(end) : "";

  if (/\d/.test(before) || /\d/.test(after)) {
    return true;
  }

  // Ignora porcentagens, multiplicadores e unidades físicas de item ("1,000 x", "2,50%", "500,00 ml")
  const trailingSlice = line.slice(end, end + 12);
  if (/^\s*(?:%|\s*x\b|(?:un|kg|mg|ml|gr|g|l)\b)/i.test(trailingSlice)) {
    return true;
  }

  // Ignora sequências longas típicas de linha digitável / chave NF-e
  const surrounding = line.slice(Math.max(0, start - 14), Math.min(line.length, end + 14));
  if (/\d{5}[.-]\d{5}/.test(surrounding) || /\d{10,}/.test(surrounding)) {
    return true;
  }

  // Ignora trechos imediatamente contíguos a barra de data ("15/10,00" ou similar anômalo)
  if (before === "/" || after === "/") {
    return true;
  }

  return false;
}

function classifyCandidateScore(
  contextLabel: string,
  fullLine: string,
  hasCurrencyPrefix: boolean,
): { score: number; confidence: ConfidenceLevel } | null {
  if (DISQUALIFYING_CONTEXT_REGEX.test(contextLabel)) {
    return null;
  }

  if (TIER_1_PAID_OR_LIQUID_REGEX.test(contextLabel)) {
    return { score: 100, confidence: "high" };
  }

  if (INSTALLMENT_UNIT_CONTEXT_REGEX.test(contextLabel)) {
    return { score: 35, confidence: "low" };
  }

  // "VALOR TOTAL DO DOCUMENTO" contém "VALOR TOTAL" e tem semântica de totalizador consolidado (Tier 2).
  // "VALOR DO DOCUMENTO" (sem "TOTAL") fica abaixo em Tier 3 para perder de "VALOR PAGO".
  if (/\bvalor\s+total\s+do\s+documento\b/i.test(contextLabel)) {
    return { score: 85, confidence: "high" };
  }

  if (TIER_3_NOMINAL_REGEX.test(contextLabel)) {
    return { score: 70, confidence: "medium" };
  }

  if (TIER_2_GENERIC_TOTAL_REGEX.test(contextLabel)) {
    return { score: 85, confidence: "high" };
  }

  if (ITEM_LINE_NOISE_REGEX.test(fullLine)) {
    return { score: 20, confidence: "low" };
  }

  if (hasCurrencyPrefix) {
    return { score: 50, confidence: "medium" };
  }

  return { score: 35, confidence: "low" };
}

interface RawAmountSpan {
  start: number;
  end: number;
  numericRaw: string;
  hasCurrencyPrefix: boolean;
}

function extractLineAmountSpans(line: string, prevLineHasHint: boolean): RawAmountSpan[] {
  const spans: RawAmountSpan[] = [];
  const occupied = new Array<boolean>(line.length).fill(false);

  const markOccupied = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      occupied[i] = true;
    }
  };

  const hasOverlap = (start: number, end: number) => {
    for (let i = start; i < end; i++) {
      if (occupied[i]) return true;
    }
    return false;
  };

  // 1. Valores com prefixo explícito de moeda ("R$ 45,00", "R$ 45 , 00", "R$ 45.00", "$3.990,00", "R$ > 43,00")
  const currencyRegex =
    /(?:R\$|BRL|\$)\s*(?:[.:=>-]+\s*)?(\d+(?:\s*[.,]\s*\d+)*)/gi;
  let match: RegExpExecArray | null;
  while ((match = currencyRegex.exec(line)) !== null) {
    const rawNum = match[1]?.trim() ?? "";
    if (!rawNum) continue;
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    if (isInsideBarCodeOrDate(line, matchStart, matchEnd)) continue;

    // Inteiro puro com prefixo R$ não deve ter mais de 7 dígitos (evita códigos quebrados)
    const compactCheck = rawNum.replace(/\s+/g, "");
    if (/^\d{8,}$/.test(compactCheck)) continue;

    spans.push({
      start: matchStart,
      end: matchEnd,
      numericRaw: rawNum,
      hasCurrencyPrefix: true,
    });
    markOccupied(matchStart, matchEnd);
  }

  // 2. Valores decimais no padrão brasileiro sem prefixo ("1.250,50", "45,90", "45 , 00", "45,000")
  const brDecimalRegex = /\b(\d{1,3}(?:\s*\.\s*\d{3})*\s*,\s*\d{2}0?|\d+\s*,\s*\d{2}0?)\b/g;
  while ((match = brDecimalRegex.exec(line)) !== null) {
    const rawNum = match[1]?.trim() ?? "";
    if (!rawNum) continue;
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;
    if (hasOverlap(matchStart, matchEnd)) continue;
    if (isInsideBarCodeOrDate(line, matchStart, matchEnd)) continue;

    spans.push({
      start: matchStart,
      end: matchEnd,
      numericRaw: rawNum,
      hasCurrencyPrefix: false,
    });
    markOccupied(matchStart, matchEnd);
  }

  // 3. Decimais com ponto en-US sem prefixo ("45.00", "1,450.00") somente com pista financeira próxima
  const lineHasHint = prevLineHasHint || FINANCIAL_LABEL_HINT_REGEX.test(line);
  if (lineHasHint) {
    const enDecimalRegex = /\b(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})\b/g;
    while ((match = enDecimalRegex.exec(line)) !== null) {
      const rawNum = match[1]?.trim() ?? "";
      if (!rawNum) continue;
      const matchStart = match.index;
      const matchEnd = match.index + match[0].length;
      if (hasOverlap(matchStart, matchEnd)) continue;
      if (isInsideBarCodeOrDate(line, matchStart, matchEnd)) continue;

      spans.push({
        start: matchStart,
        end: matchEnd,
        numericRaw: rawNum,
        hasCurrencyPrefix: false,
      });
      markOccupied(matchStart, matchEnd);
    }
  }

  spans.sort((a, b) => a.start - b.start);
  return spans;
}

/**
 * Avalia todas as ocorrências monetárias de um comprovante e elege a mais confiável
 * segundo hierarquia determinística (Valor Pago > Total/Valor > Valor Nominal > Avulso),
 * descartando saldos, limites, troco, tributos, descontos e tarifas.
 */
export function scoreSovereignReceiptAmount(rawText: string): SovereignReceiptAmountResult | null {
  if (!rawText || typeof rawText !== "string") {
    return null;
  }

  const lines = rawText
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates: AmountCandidate[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx]!;
    const prevLine = lineIdx > 0 ? lines[lineIdx - 1]! : "";
    const prevLineCanSupplyLabel =
      prevLine.length > 0 &&
      prevLine.length < 60 &&
      !/\d+,\d{2}|\bR\$\s*\d+/i.test(prevLine);

    const spans = extractLineAmountSpans(
      line,
      prevLineCanSupplyLabel && FINANCIAL_LABEL_HINT_REGEX.test(prevLine),
    );

    let prevTokenEnd = 0;
    for (let sIdx = 0; sIdx < spans.length; sIdx++) {
      const span = spans[sIdx]!;
      const cents = parseBrazilianCurrencyToCents(span.numericRaw, { allowNegative: false });
      if (cents === null || cents <= 0) {
        prevTokenEnd = span.end;
        continue;
      }

      const sameLineContext = line.slice(prevTokenEnd, span.start).trim();
      const sameLineHasWords = /[A-Za-zÀ-ÿ]{2,}/.test(
        sameLineContext.replace(/\b(?:R\$|BRL)\b/gi, ""),
      );

      let contextLabel = sameLineContext;
      if (!sameLineHasWords && sIdx === 0 && prevLineCanSupplyLabel) {
        contextLabel = `${prevLine} ${sameLineContext}`.trim();
      }

      const scored = classifyCandidateScore(contextLabel, line, span.hasCurrencyPrefix);
      prevTokenEnd = span.end;

      if (!scored) {
        continue;
      }

      candidates.push({
        amountCents: cents,
        score: scored.score,
        confidence: scored.confidence,
        hasCurrencyPrefix: span.hasCurrencyPrefix,
        lineIndex: lineIdx,
        charIndex: span.start,
        matchedLine: line,
      });
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.hasCurrencyPrefix !== a.hasCurrencyPrefix) {
      return b.hasCurrencyPrefix ? 1 : -1;
    }
    // Para totais/pagamentos explícitos (score >= 85), totais finais ficam mais abaixo no comprovante
    if (a.score >= 85) {
      if (b.lineIndex !== a.lineIndex) return b.lineIndex - a.lineIndex;
      return b.charIndex - a.charIndex;
    }
    if (a.lineIndex !== b.lineIndex) return a.lineIndex - b.lineIndex;
    return a.charIndex - b.charIndex;
  });

  const best = candidates[0]!;
  return {
    amountCents: best.amountCents,
    confidence: best.confidence,
    score: best.score,
    matchedLine: best.matchedLine,
  };
}

/**
 * Atalho determinístico que retorna apenas o valor soberano em centavos inteiros.
 */
export function extractSovereignReceiptAmountCents(rawText: string): number | null {
  return scoreSovereignReceiptAmount(rawText)?.amountCents ?? null;
}
