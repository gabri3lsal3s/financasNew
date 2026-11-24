import { isStatementNoiseOrSummary } from "./clean";
import type { StatementTransaction } from "./types";

export const DEFAULT_STATEMENT_AI_CHUNK_MAX_CHARS = 22_000;
export const MAX_STATEMENT_AI_CHUNKS = 3;

export interface PreprocessedStatementResult {
  /** Texto enxuto pronto para envio à IA (no primeiro lote ou texto único). */
  compactedText: string;
  /** Fatias seguras respeitando quebras de linha caso a fatura seja muito extensa. */
  chunks: string[];
  /** Quantidade estimada de linhas candidatas de lançamento monetário (excluindo resumos e simulações). */
  candidateAmountLineCount: number;
  /** Tamanho original em caracteres antes da poda local. */
  originalChars: number;
  /** Tamanho total compactado em caracteres após a poda local. */
  compactedChars: number;
  /** Valor total impresso na fatura detectado via regex determinística (em centavos), se encontrado. */
  printedTotalCents: number | null;
}

export interface EvaluateStatementQualityParams {
  rawText: string;
  transactions: readonly StatementTransaction[];
  candidateAmountLineCount: number;
  printedTotalCents: number | null;
  isStructuredTabularFile: boolean;
}

export interface StatementQualityAssessment {
  isSufficient: boolean;
  reason?:
    | "zero_transactions"
    | "low_line_coverage"
    | "scrambled_columns"
    | "total_mismatch";
}

const DATE_TOKEN_REGEX =
  /\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?|\d{1,2}\s+(?:de\s+)?(?:jan|fev|feb|mar|abr|apr|mai|may|jun|jul|ago|aug|set|sep|out|oct|nov|dez|dec)[a-zç]*)\b/i;

const MONEY_TOKEN_REGEX =
  /(?:(?:R\$|US\$|USD|EUR|BRL)\s*)?[+-]?\b\d{1,3}(?:\.\d{3})*,\d{2}\b|(?:R\$|BRL)\s*[+-]?\d+\.\d{2}\b/i;

const INSTALLMENT_OR_SECTION_REGEX =
  /\b(?:\d{1,2}\s*\/\s*\d{1,2}|parc(?:ela)?\s*\d{1,2}|cart[aã]o\s+final|compras?\s+(?:nacionais|internacionais)|lan[çc]amentos|estorno|reembolso|anuidade|iof|encargos)\b/i;

const BARCODE_LINE_REGEX = /^(?:[\d.\s-]{44,65})$/;

const PAGE_BOILERPLATE_REGEX =
  /^(?:p[aá]gina\s+\d+(?:\s*(?:de|\/)\s*\d+)?|sac\b|ouvidoria\b|central\s+de\s+atendimento|atendimento\s+\d+h|0800[\s-]?\d{3}[\s-]?\d{4}|https?:\/\/|www\.|autentica[çc][aã]o\s+mec[aâ]nica)/i;

const FINANCING_SIMULATION_LINE_REGEX =
  /(?:\b\d{1,2}\s*x\s*(?:de\s+)?(?:R\$\s*)?\d|\bcet\b|\b\d+[.,]\d+\s*%\s*a\.[ma]\b|op[çc][oõ]es\s+de\s+parcelamento|parcelamento\s+(?:da\s+fatura|autom[aá]tico|f[aá]cil)|cr[eé]dito\s+rotativo|juros\s+do\s+rotativo|entrada\s*\+\s*\d)/i;

const LEGAL_BLOCK_START_REGEX =
  /^(?:custo\s+efetivo\s+total|taxas?\s+e\s+encargos|op[çc][oõ]es\s+para\s+parcelar|importante\s*:|fique\s+atento|regras\s+do\s+rotativo|condi[çc][oõ]es\s+gerais)/i;

const TRANSACTION_SECTION_RESUME_REGEX =
  /\b(?:lan[çc]amentos|compras?\s+(?:nacionais|internacionais|do\s+m[eê]s)|transa[çc][oõ]es|detalhamento\s+da\s+fatura|despesas\s+do\s+per[ií]odo|cart[aã]o\s+final|extrato\s+referente|data\s+(?:\|\s*)?(?:descri[çc][aã]o|hist[oó]rico|estabelecimento)\s+(?:\|\s*)?valor)\b/i;

export interface StatementSummaryAmounts {
  /** Total oficial impresso da fatura (ex.: "Valor da fatura", "Total da fatura"). */
  invoiceTotalCents: number | null;
  /** Total líquido das despesas/créditos do ciclo (ex.: "Despesas e créditos do mês"). */
  cycleNetTargetCents: number | null;
  /** Saldo da fatura anterior, quando informado no quadro de resumo. */
  previousBalanceCents: number | null;
  /** Pagamentos efetuados sobre a fatura anterior, quando informado no quadro de resumo. */
  paymentsCents: number | null;
}

function parseBrlTokenToCents(rawAmount: string, allowZero = false): number | null {
  const cleaned = rawAmount.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  const normalized =
    cleaned.includes(",") && cleaned.includes(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(",", ".");
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  if (allowZero) return cents >= 0 ? cents : null;
  return cents > 0 ? cents : null;
}

function extractAmountNearLabel(
  lines: readonly string[],
  index: number,
  ignoredContext: RegExp,
  allowZero = false,
): number | null {
  const amountExtractRegex = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+,\d{2})/;
  const line = lines[index]!;
  const inlineMatch = amountExtractRegex.exec(line);
  if (inlineMatch?.[1]) {
    const cents = parseBrlTokenToCents(inlineMatch[1], allowZero);
    if (cents !== null) return cents;
  }

  for (let offset = 1; offset <= 2 && index + offset < lines.length; offset++) {
    const nextLine = lines[index + offset]!;
    if (ignoredContext.test(nextLine)) break;
    const nextMatch = amountExtractRegex.exec(nextLine);
    if (nextMatch?.[1]) {
      const cents = parseBrlTokenToCents(nextMatch[1], allowZero);
      if (cents !== null) return cents;
    }
  }

  return null;
}

/**
 * Extrai localmente o "Total da Fatura" impresso no cabeçalho/resumo do PDF ou texto
 * usando hierarquia de 2 níveis:
 * - Nível 1 (Prioritário): "Valor da fatura", "Total da fatura", "Valor total desta fatura", "Despesas e créditos do mês".
 * - Nível 2 (Fallback): "Total a pagar", bloqueado se próximo a simulações ("1x R$", "CET", "parcelamento", "entrada").
 */
export function extractPrintedStatementTotalCents(rawText: string): number | null {
  if (!rawText) return null;
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const scanLimit = Math.min(lines.length, 350);

  const ignoredTotalContext =
    /\b(?:m[ií]nimo|anterior|parcelamento|limite|pr[oó]xima|futur[ao]|rotativo|desconto|economia)\b/i;
  const installmentSimulationContext =
    /(?:\b\d{1,2}\s*x\s*(?:de\s+)?r?\$|\bentrada\b|\bparcelamento\b|\bcet\b|\bsimula[çc][aã]o\b|\btaxa\s+ao\s+m[eê]s\b)/i;

  const primaryInvoiceTotalRegex =
    /\b(?:valor\s+total\s+(?:desta\s+|da\s+)?fatura|total\s+(?:desta\s+|da\s+|de\s+sua\s+)?fatura(?:\s+atual)?|valor\s+da\s+fatura(?:\s+atual)?)\b/i;
  const cycleNetTotalRegex = /\b(?:despesas\s+e\s+cr[eé]ditos\s+do\s+m[eê]s)\b/i;
  const fallbackTotalToPayRegex = /\btotal\s+a\s+pagar\b/i;

  let primaryInvoiceCandidate: number | null = null;
  let cycleNetCandidate: number | null = null;
  let fallbackCandidate: number | null = null;

  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i]!;
    if (ignoredTotalContext.test(line)) continue;

    if (primaryInvoiceCandidate === null && primaryInvoiceTotalRegex.test(line)) {
      const cents = extractAmountNearLabel(lines, i, ignoredTotalContext);
      if (cents !== null) primaryInvoiceCandidate = cents;
      continue;
    }

    if (cycleNetCandidate === null && cycleNetTotalRegex.test(line)) {
      const cents = extractAmountNearLabel(lines, i, ignoredTotalContext);
      if (cents !== null) cycleNetCandidate = cents;
      continue;
    }

    if (fallbackCandidate === null && fallbackTotalToPayRegex.test(line)) {
      // Bloqueia "Total a pagar" dentro ou imediatamente após cards de simulação de parcelamento
      const contextWindow = lines.slice(Math.max(0, i - 3), i + 2).join(" ");
      if (!installmentSimulationContext.test(contextWindow)) {
        const cents = extractAmountNearLabel(lines, i, ignoredTotalContext);
        if (cents !== null) fallbackCandidate = cents;
      }
    }
  }

  return primaryInvoiceCandidate ?? cycleNetCandidate ?? fallbackCandidate;
}

/**
 * Extrai os componentes estruturais do quadro de resumo da fatura para a Equação Contábil Dupla.
 */
export function extractStatementSummaryAmounts(rawText: string): StatementSummaryAmounts {
  const invoiceTotalCents = extractPrintedStatementTotalCents(rawText);
  if (!rawText) {
    return {
      invoiceTotalCents: null,
      cycleNetTargetCents: null,
      previousBalanceCents: null,
      paymentsCents: null,
    };
  }

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const scanLimit = Math.min(lines.length, 350);
  const noStop = /$^/; // não interrompe

  const cycleNetRegex =
    /\b(?:despesas\s+e\s+cr[eé]ditos\s+do\s+m[eê]s|total\s+(?:de\s+)?compras\s+do\s+per[ií]odo|total\s+de\s+lan[çc]amentos(?:\s+do\s+m[eê]s)?)\b/i;
  const prevBalanceRegex = /\bsaldo\s+(?:da\s+fatura\s+)?anterior\b/i;
  const paymentsRegex = /\b(?:pagamentos\s+efetuados|pagamentos\s*\/\s*cr[eé]ditos)\b/i;

  let cycleNetTargetCents: number | null = null;
  let previousBalanceCents: number | null = null;
  let paymentsCents: number | null = null;

  for (let i = 0; i < scanLimit; i++) {
    const line = lines[i]!;
    if (cycleNetTargetCents === null && cycleNetRegex.test(line)) {
      cycleNetTargetCents = extractAmountNearLabel(lines, i, noStop, false);
    }
    if (previousBalanceCents === null && prevBalanceRegex.test(line)) {
      previousBalanceCents = extractAmountNearLabel(lines, i, noStop, true);
    }
    if (paymentsCents === null && paymentsRegex.test(line)) {
      paymentsCents = extractAmountNearLabel(lines, i, noStop, true);
    }
  }

  return {
    invoiceTotalCents,
    cycleNetTargetCents,
    previousBalanceCents,
    paymentsCents,
  };
}

function normalizeLineWhitespace(line: string): string {
  return line
    .replace(/\t+/g, " | ")
    .replace(/\s{3,}/g, " | ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/**
 * Pré-processa localmente textos longos de faturas (PDF ou colagem) antes de enviar à IA:
 * - Remove códigos de barras, rodapés, textos jurídicos, CET e tabelas de simulação de parcelamento.
 * - Mantém apenas linhas com datas/valores/parcelas + janela curta de vizinhança para preservar itens multilinhas.
 * - Divide em blocos seguros por linha se ainda exceder `maxChunkChars`, evitando truncamento silencioso.
 */
export function preprocessStatementTextForAi(
  rawText: string,
  maxChunkChars = DEFAULT_STATEMENT_AI_CHUNK_MAX_CHARS,
): PreprocessedStatementResult {
  const originalChars = rawText.length;
  const printedTotalCents = extractPrintedStatementTotalCents(rawText);
  const rawLines = rawText.split(/\r?\n/);

  const cleanedLines: string[] = [];
  let inLegalBlock = false;

  for (const rawLine of rawLines) {
    const line = normalizeLineWhitespace(rawLine);
    if (!line) continue;

    if (TRANSACTION_SECTION_RESUME_REGEX.test(line)) {
      inLegalBlock = false;
    } else if (LEGAL_BLOCK_START_REGEX.test(line) && !DATE_TOKEN_REGEX.test(line)) {
      inLegalBlock = true;
      continue;
    }

    if (inLegalBlock) {
      // Sai automaticamente do bloco jurídico caso encontre linha clara com data + valor
      if (DATE_TOKEN_REGEX.test(line) && MONEY_TOKEN_REGEX.test(line) && !FINANCING_SIMULATION_LINE_REGEX.test(line)) {
        inLegalBlock = false;
      } else {
        continue;
      }
    }

    if (BARCODE_LINE_REGEX.test(line)) continue;
    if (PAGE_BOILERPLATE_REGEX.test(line)) continue;
    if (FINANCING_SIMULATION_LINE_REGEX.test(line)) continue;

    // Descarta parágrafos institucionais longos sem números
    if (line.length > 95 && !/\d/.test(line)) continue;

    // Evita repetição consecutiva de cabeçalhos de página idênticos (preservando valores monetários repetidos)
    if (
      cleanedLines.length > 0 &&
      cleanedLines[cleanedLines.length - 1] === line &&
      !MONEY_TOKEN_REGEX.test(line)
    ) {
      continue;
    }

    cleanedLines.push(line);
  }

  const keepFlags = new Array<boolean>(cleanedLines.length).fill(false);
  let candidateAmountLineCount = 0;

  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i]!;
    const hasDate = DATE_TOKEN_REGEX.test(line);
    const hasMoney = MONEY_TOKEN_REGEX.test(line);
    const hasSectionOrInst = INSTALLMENT_OR_SECTION_REGEX.test(line);
    const isNoiseSummary = isStatementNoiseOrSummary(line);

    if (hasMoney && !isNoiseSummary) {
      candidateAmountLineCount += 1;
    }

    if ((hasDate || hasMoney || hasSectionOrInst) && !isNoiseSummary) {
      keepFlags[i] = true;

      // Janela de contexto +/- 1 linha curta para preservar lançamentos multilinhas (Data / Loja / Valor)
      if (i > 0) {
        const prev = cleanedLines[i - 1]!;
        if (prev.length <= 80 && !isStatementNoiseOrSummary(prev)) {
          keepFlags[i - 1] = true;
        }
      }
      if (i + 1 < cleanedLines.length) {
        const next = cleanedLines[i + 1]!;
        if (next.length <= 80 && !isStatementNoiseOrSummary(next)) {
          keepFlags[i + 1] = true;
        }
      }
    }
  }

  const selectedLines = cleanedLines.filter((_, idx) => keepFlags[idx]);
  const effectiveLines = selectedLines.length > 0 ? selectedLines : cleanedLines;

  const chunks: string[] = [];
  let currentChunkLines: string[] = [];
  let currentLen = 0;

  for (const line of effectiveLines) {
    const addition = line.length + 1;
    if (currentChunkLines.length > 0 && currentLen + addition > maxChunkChars) {
      chunks.push(currentChunkLines.join("\n"));
      currentChunkLines = [line];
      currentLen = line.length;
    } else {
      currentChunkLines.push(line);
      currentLen += addition;
    }
  }

  if (currentChunkLines.length > 0) {
    chunks.push(currentChunkLines.join("\n"));
  }

  const compactedText = chunks[0] ?? "";
  const compactedChars = chunks.reduce((acc, c) => acc + c.length, 0);

  return {
    compactedText,
    chunks,
    candidateAmountLineCount,
    originalChars,
    compactedChars,
    printedTotalCents,
  };
}

/**
 * Avalia se o parser determinístico local extraiu a fatura com integridade suficiente
 * ou se houve perda parcial/colunas embaralhadas típica de PDFs multi-coluna e colagens complexas.
 */
export function evaluateDeterministicStatementQuality(
  params: EvaluateStatementQualityParams,
): StatementQualityAssessment {
  const {
    transactions,
    candidateAmountLineCount,
    printedTotalCents,
    isStructuredTabularFile,
  } = params;

  if (transactions.length === 0) {
    return { isSufficient: false, reason: "zero_transactions" };
  }

  // Arquivos explicitamente estruturados (OFX, CSV, TSV, XLSX, XLS, HTML) com linhas válidas não gastam IA
  if (isStructuredTabularFile) {
    return { isSufficient: true };
  }

  // Detecta colunas embaralhadas onde descrições viram fallback genérico "Transação" ou apenas números/datas
  const degradedDescCount = transactions.filter((tx) => {
    const desc = tx.cleanDescription.trim();
    return (
      !desc ||
      desc === "Transação" ||
      /^[\d\s/.,+-]+$/.test(desc)
    );
  }).length;

  if (
    (transactions.length >= 2 && degradedDescCount / transactions.length >= 0.3) ||
    (degradedDescCount >= 1 && candidateAmountLineCount >= 3)
  ) {
    return { isSufficient: false, reason: "scrambled_columns" };
  }

  // Detecta falso positivo parcial: documento possui várias linhas com valores R$, mas o parser local aproveitou poucas
  if (
    candidateAmountLineCount >= 4 &&
    transactions.length < Math.max(2, Math.ceil(candidateAmountLineCount * 0.45))
  ) {
    return { isSufficient: false, reason: "low_line_coverage" };
  }

  // Se o total impresso da fatura foi identificado, checa divergência severa indicando colunas/seções perdidas
  if (printedTotalCents !== null && printedTotalCents >= 5_000) {
    const netExtractedCents = transactions.reduce((acc, tx) => {
      if (tx.isPayment) return acc;
      return tx.isRefund ? acc - tx.amountCents : acc + tx.amountCents;
    }, 0);

    if (netExtractedCents < printedTotalCents * 0.55) {
      return { isSufficient: false, reason: "total_mismatch" };
    }
  }

  return { isSufficient: true };
}
