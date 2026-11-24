import type { StatementTransaction, StatementTransactionNature } from "../types";
import { inferChargeKindFromDescription } from "@/domain/cards/charges";
import {
  classifyTransactionNature,
  cleanDescription,
  isFxDetail,
  isInvoicePayment,
  isStatementNoiseOrSummary,
  isSubcardHeader,
} from "../clean";
import { extractInstallmentInfo } from "../installments";
import { generateStatementHash } from "../hash";
import { normalizeDateToISO, parseAmountToCents } from "./type-sniffer";

export interface SpatialPdfToken {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
}

export interface SpatialPdfLine {
  y: number;
  xStart: number;
  xEnd: number;
  fontSize: number;
  column: 1 | 2;
  text: string;
  tokens: SpatialPdfToken[];
  pageNumber?: number;
}

export type SectionZoneState = "outside" | "start_zone" | "pause_zone" | "paused_boleto";

export interface ChecksumGateResult {
  passed: boolean;
  extractedTotalCents: number;
  officialTotalCents: number | null;
  diffCents: number;
  candidateLines: StatementTransaction[];
}

export interface SpatialPdfResult {
  transactions: StatementTransaction[];
  reconstructedText: string;
  lines: SpatialPdfLine[];
  checksumGate: ChecksumGateResult;
  totalPages: number;
  usedTwoColumnMode: boolean;
  discardedMoneyLines?: number;
  detectedCardLast4s?: string[];
}

// -----------------------------------------------------------------------------
// Regex de Barreiras Anti-Ruído
// -----------------------------------------------------------------------------

const SECTION_START_REGEX =
  /\b(?:lan[çc]amentos|detalhamento\s+(?:da\s+fatura|das\s+despesas|dos\s+gastos)|compras\s+(?:nacionais|internacionais)|movimenta[çc][oõ]es|transa[çc][oõ]es|extrato\s+de\s+compras|hist[oó]rico\s+de\s+lan[çc]amentos)\b/i;

const SECTION_PAUSE_REGEX =
  /\b(?:op[çc][oõ]es\s+de\s+parcelamento|simula[çc][aã]o|demonstrativo\s+de\s+encargos|canais\s+de\s+atendimento|fale\s+conosco|ouvidoria|central\s+de\s+atendimento|sac\b|informa[çc][oõ]es\s+importantes)\b/i;

const HARD_STOP_BARCODE_REGEX =
  /(?:\b\d{5}[.\s]?\d{5}\s+\d{5}[.\s]?\d{6}\s+\d{5}[.\s]?\d{6}\s+\d\s+\d{14}\b|\b\d{47,48}\b|\bautentica[çc][aã]o\s+mec[aâ]nica\b|\brecibo\s+do\s+sacado\b|\bcanhoto\s+do\s+boleto\b)/i;

const SIMULATION_OR_RATE_REGEX =
  /(?:\b\d+[.,]\d+\s*%\s*a\.[ma]\b|\bcet\b|\bparcelamento\s+em\s+at[eé]\b|\b\d+\s*x\s+de\s+r?\$|\bpagamento\s+m[ií]nimo\b|\btaxa\s+de\s+juros\b|\bjuros\s+do\s+rotativo\b)/i;

const DATE_REGEX =
  /\b(?:(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?|(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*)\b/i;

const AMOUNT_REGEX =
  /(?:r\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})(?:\s*([cd-]))?(?!\d)/i;

const BOLETO_FIELD_NOISE_REGEX =
  /\b(?:vencimento|data\s+do\s+documento|valor\s+do\s+documento|sacado|pagador|cedente|benefici[aá]rio|nosso\s+n[uú]mero|ag[eê]ncia\s*\/\s*c[oó]digo|ficha\s+de\s+compensa[çc][aã]o|autentica[çc][aã]o\s+mec[aâ]nica|recibo\s+do\s+sacado)\b/i;

const FOREIGN_CURRENCY_PREFIX_REGEX =
  /(?:usd|eur|gbp|us\$|€|£|cad|aud|chf)\s*$/i;

export function isBoletoFieldNoise(text: string): boolean {
  return BOLETO_FIELD_NOISE_REGEX.test(text);
}

/**
 * Em linhas com moeda estrangeira e BRL (ex.: "10/11 OPENAI USD 20,00 116,40"),
 * ancora a extração no último valor em BRL à direita, ignorando o valor em moeda estrangeira.
 */
export function extractBrlAmountFromLine(text: string): {
  fullMatch: string;
  valueStr: string;
  suffix?: string;
} | null {
  const globalRegex = new RegExp(AMOUNT_REGEX.source, "gi");
  const matches: Array<{ fullMatch: string; valueStr: string; suffix?: string; index: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = globalRegex.exec(text)) !== null) {
    matches.push({
      fullMatch: match[0],
      valueStr: match[1] ?? match[0],
      suffix: match[2],
      index: match.index,
    });
  }

  if (matches.length === 0) return null;
  if (matches.length === 1) {
    return {
      fullMatch: matches[0]!.fullMatch,
      valueStr: matches[0]!.valueStr,
      suffix: matches[0]!.suffix,
    };
  }

  // Filtra fora os matches imediatamente precedidos por moeda estrangeira
  const brlMatches = matches.filter((m) => {
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    return !FOREIGN_CURRENCY_PREFIX_REGEX.test(before);
  });

  const chosen = brlMatches.length > 0 ? brlMatches[brlMatches.length - 1]! : matches[matches.length - 1]!;
  return {
    fullMatch: chosen.fullMatch,
    valueStr: chosen.valueStr,
    suffix: chosen.suffix,
  };
}

// -----------------------------------------------------------------------------
// Funções Puras de Análise e Agrupamento Espacial
// -----------------------------------------------------------------------------

/**
 * Avalia a Pré-Condição Bimodal:
 * Verifica se a metade esquerda E a metade direita da página contêm, de forma independente,
 * ao menos 2 pares válidos de Data + Valor.
 * Isso garante que faturas de 1 coluna com descrições longas ou vazios centrais nunca sejam cortadas.
 */
export function evaluateBimodalPrecondition(
  tokens: SpatialPdfToken[],
  pageWidth: number,
): boolean {
  if (tokens.length === 0 || pageWidth <= 0) return false;

  const midX = pageWidth * 0.5;

  // Agrupa tokens por metade
  const leftTokens = tokens.filter((t) => t.x < midX);
  const rightTokens = tokens.filter((t) => t.x >= midX);

  const hasDateAndAmount = (tokList: SpatialPdfToken[]): number => {
    // Clusteriza em linhas aproximadas (+- 3px)
    const sorted = [...tokList].sort((a, b) => b.y - a.y);
    const lineBuckets: string[] = [];
    let currentY: number | null = null;
    let currentTokens: SpatialPdfToken[] = [];

    for (const tok of sorted) {
      if (currentY === null || Math.abs(currentY - tok.y) <= 3) {
        currentY = tok.y;
        currentTokens.push(tok);
      } else {
        currentTokens.sort((a, b) => a.x - b.x);
        lineBuckets.push(currentTokens.map((t) => t.str).join(" "));
        currentY = tok.y;
        currentTokens = [tok];
      }
    }
    if (currentTokens.length > 0) {
      currentTokens.sort((a, b) => a.x - b.x);
      lineBuckets.push(currentTokens.map((t) => t.str).join(" "));
    }

    let count = 0;
    for (const lineText of lineBuckets) {
      if (DATE_REGEX.test(lineText) && AMOUNT_REGEX.test(lineText)) {
        count++;
      }
    }
    return count;
  };

  const leftPairs = hasDateAndAmount(leftTokens);
  const rightPairs = hasDateAndAmount(rightTokens);

  return leftPairs >= 2 && rightPairs >= 2;
}

/**
 * Agrupa tokens em linhas horizontais unificadas (|ΔY| <= 2.5px),
 * ordenando da esquerda para a direita (X crescente).
 * Quando bimodal, processa Coluna 1 (esquerda) de cima para baixo, depois Coluna 2 (direita).
 */
export function groupTokensIntoLines(
  tokens: SpatialPdfToken[],
  pageWidth: number,
  isBimodal: boolean,
): SpatialPdfLine[] {
  if (tokens.length === 0) return [];

  const midX = pageWidth * 0.5;

  const clusterSubset = (subTokens: SpatialPdfToken[], col: 1 | 2): SpatialPdfLine[] => {
    // PDF coordinates: Y = 0 na base, Y maior no topo -> ordenar descrescente
    const sorted = [...subTokens].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: SpatialPdfLine[] = [];

    let currentY: number | null = null;
    let currentBucket: SpatialPdfToken[] = [];

    const flushBucket = () => {
      if (currentBucket.length === 0) return;
      currentBucket.sort((a, b) => a.x - b.x);

      const text = currentBucket.map((t) => t.str).join(" ").replace(/\s{2,}/g, " ").trim();
      const avgFontSize =
        currentBucket.reduce((acc, t) => acc + (t.fontSize || 0), 0) / currentBucket.length;
      const xStart = currentBucket[0]?.x ?? 0;
      const lastTok = currentBucket[currentBucket.length - 1];
      const xEnd = (lastTok?.x ?? 0) + (lastTok?.width ?? 0);

      lines.push({
        y: currentY ?? 0,
        xStart,
        xEnd,
        fontSize: avgFontSize,
        column: col,
        text,
        tokens: currentBucket,
      });

      currentBucket = [];
    };

    for (const tok of sorted) {
      if (currentY === null || Math.abs(currentY - tok.y) <= 2.5) {
        if (currentY === null) currentY = tok.y;
        currentBucket.push(tok);
      } else {
        flushBucket();
        currentY = tok.y;
        currentBucket = [tok];
      }
    }
    flushBucket();

    return lines;
  };

  if (isBimodal) {
    const leftTokens = tokens.filter((t) => t.x < midX);
    const rightTokens = tokens.filter((t) => t.x >= midX);

    const leftLines = clusterSubset(leftTokens, 1);
    const rightLines = clusterSubset(rightTokens, 2);

    return [...leftLines, ...rightLines];
  }

  return clusterSubset(tokens, 1);
}

// -----------------------------------------------------------------------------
// Filtros das 4 Barreiras Anti-Ruído
// -----------------------------------------------------------------------------

/**
 * Barreira 1: Máquina de Estados de Seção
 */
export class SectionStateMachine {
  private state: SectionZoneState = "outside";
  private boletoPage = 1;

  public processLine(
    lineText: string,
    pageNumber = 1,
  ): { state: SectionZoneState; shouldDrop: boolean } {
    if (this.state === "paused_boleto") {
      if (pageNumber > this.boletoPage) {
        // Virou a página: sai da pausa do boleto e reavalia a nova página
        this.state = "outside";
      } else if (SECTION_START_REGEX.test(lineText)) {
        this.state = "start_zone";
        const hasDateAndAmount = DATE_REGEX.test(lineText) && AMOUNT_REGEX.test(lineText);
        return { state: "start_zone", shouldDrop: !hasDateAndAmount };
      } else {
        return { state: "paused_boleto", shouldDrop: true };
      }
    }

    if (HARD_STOP_BARCODE_REGEX.test(lineText)) {
      this.state = "paused_boleto";
      this.boletoPage = pageNumber;
      return { state: "paused_boleto", shouldDrop: true };
    }

    if (isBoletoFieldNoise(lineText)) {
      return { state: this.state, shouldDrop: true };
    }

    if (SECTION_START_REGEX.test(lineText)) {
      this.state = "start_zone";
      // Se a linha contiver data e valor válidos, é uma transação legítima (ex.: "IOF TRANSACOES EXTERIOR"), não cabeçalho
      const hasDateAndAmount = DATE_REGEX.test(lineText) && AMOUNT_REGEX.test(lineText);
      return { state: "start_zone", shouldDrop: !hasDateAndAmount };
    }

    if (SECTION_PAUSE_REGEX.test(lineText)) {
      this.state = "pause_zone";
      return { state: "pause_zone", shouldDrop: true };
    }

    // Se estiver fora da zona mas encontrar uma linha com Data + Valor claros, ativa a zona
    if (this.state === "outside") {
      if (DATE_REGEX.test(lineText) && AMOUNT_REGEX.test(lineText)) {
        this.state = "start_zone";
        return { state: "start_zone", shouldDrop: false };
      }
      return { state: "outside", shouldDrop: true };
    }

    if (this.state === "pause_zone") {
      return { state: "pause_zone", shouldDrop: true };
    }

    return { state: "start_zone", shouldDrop: false };
  }

  public getState(): SectionZoneState {
    return this.state;
  }
}

/**
 * Barreira 2: Geometria Dominante
 * Descarta letras miúdas (< 6.8pt) e linhas vazias.
 */
export function isDominantGeometry(line: SpatialPdfLine): boolean {
  if (!line.text.trim()) return false;
  // Letras miúdas de notas de rodapé / termos legais
  if (line.fontSize > 0 && line.fontSize < 6.8) {
    return false;
  }
  return true;
}

/**
 * Barreira 3: Encargos Informativos vs Cobrados
 * Descarta linhas de simulação com %, a.m., CET, Nx de R$ ou pagamento mínimo.
 */
export function isSimulationOrContractualNoise(text: string): boolean {
  return SIMULATION_OR_RATE_REGEX.test(text);
}

// -----------------------------------------------------------------------------
// Extração e Checksum Gate
// -----------------------------------------------------------------------------

/**
 * Extrai transações estruturadas a partir das linhas espaciais agrupadas,
 * aplicando as 4 Barreiras Anti-Ruído e anexando continuações fx_detail.
 */
export function extractTransactionsFromSpatialLines(
  lines: SpatialPdfLine[],
  params: { cardId: string; competenceMonth: string },
): {
  transactions: StatementTransaction[];
  reconstructedText: string;
  discardedMoneyLines: number;
  detectedCardLast4s: string[];
} {
  const stateMachine = new SectionStateMachine();
  const transactions: StatementTransaction[] = [];
  const acceptedLines: string[] = [];
  const occurrenceCounter = new Map<string, number>();
  const detectedCardLast4s = new Set<string>();
  let discardedMoneyLines = 0;
  let index = 0;

  const compYear =
    Number.parseInt(params.competenceMonth.slice(0, 4), 10) || new Date().getFullYear();
  const compMonth = Number.parseInt(params.competenceMonth.slice(5, 7), 10) || undefined;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const text = line.text.trim();

    // Captura finais de cartão em cabeçalhos de seção / subcartão
    const cardLast4Match = /(?:[•*xX.-]{3,4}\s*){1,4}(\d{4})\b|\bfinal\s+(\d{4})\b/i.exec(text);
    const matchedDigits = cardLast4Match?.[1] ?? cardLast4Match?.[2];
    if (matchedDigits && isSubcardHeader(text)) {
      detectedCardLast4s.add(matchedDigits);
    }

    // Barreira 1: Máquina de Estados (nunca executa break global em boleto)
    const { shouldDrop } = stateMachine.processLine(text, line.pageNumber ?? 1);
    if (shouldDrop) {
      if (AMOUNT_REGEX.test(text)) {
        discardedMoneyLines++;
      }
      continue;
    }

    // Barreira 2: Geometria Dominante
    if (!isDominantGeometry(line)) {
      continue;
    }

    // Barreira 3: Encargos Informativos vs Cobrados
    if (isSimulationOrContractualNoise(text)) {
      if (AMOUNT_REGEX.test(text)) {
        discardedMoneyLines++;
      }
      continue;
    }

    // Validação de par Data + Valor (ancorado no último BRL à direita)
    const dateMatch = DATE_REGEX.exec(text);
    const amountExtracted = extractBrlAmountFromLine(text);

    if (!dateMatch || !amountExtracted) {
      // Verificação de continuação internacional (fx_detail) anexada à transação anterior
      if (isFxDetail(text) && transactions.length > 0) {
        const lastTx = transactions[transactions.length - 1]!;
        lastTx.rawDescription = `${lastTx.rawDescription} | ${text}`;
        acceptedLines.push(`  -> [fx_detail] ${text}`);
      }
      continue;
    }

    // Normalização da data (com virada de ano DD/MM e meses abreviados)
    const rawDateStr = dateMatch[0];
    const dateIso = normalizeDateToISO(rawDateStr, compYear, compMonth);
    if (!dateIso) continue;

    // Normalização do valor
    const rawAmtFullMatch = amountExtracted.fullMatch;
    const rawAmtValueStr = amountExtracted.valueStr;
    const parsedAmt = parseAmountToCents(rawAmtValueStr);
    if (!parsedAmt || parsedAmt.amountCents === 0) continue;

    const amountCents = parsedAmt.amountCents;
    const suffixLower = amountExtracted.suffix?.toLowerCase();
    const isCreditSuffix = suffixLower === "c" || parsedAmt.isCreditSuffix;
    const isDebitSuffix = suffixLower === "d" || suffixLower === "-" || parsedAmt.isDebitSuffix;
    const isCredit = isCreditSuffix || (parsedAmt.isNegative && !isDebitSuffix);

    // Extrai descrição isolando data e valor (removendo a correspondência inteira de valor para não sobrar "R$")
    const rawDesc = text
      .replace(rawDateStr, "")
      .replace(rawAmtFullMatch, "")
      .replace(/\b[cd]\b/i, "")
      .trim();

    if (!rawDesc) continue;

    // Descarte estrito de cabeçalhos de subcartões, subtotais e ruídos de resumo
    if (
      isSubcardHeader(rawDesc) ||
      isSubcardHeader(text) ||
      isStatementNoiseOrSummary(rawDesc) ||
      isStatementNoiseOrSummary(text)
    ) {
      discardedMoneyLines++;
      continue;
    }

    const isPayment = isInvoicePayment(rawDesc, isCredit);
    const isRefund = isCredit && !isPayment;
    const cleanDesc = cleanDescription(rawDesc) || rawDesc;
    const installment = extractInstallmentInfo(rawDesc, dateIso);

    // Clamping de datas anteriores a 2026-01-01 preservando a data original no hash
    const APP_START_DATE = "2026-01-01";
    let effectiveDate = dateIso;
    let originalDate: string | undefined;
    if (dateIso < APP_START_DATE) {
      originalDate = dateIso;
      effectiveDate = APP_START_DATE;
    }

    const hashDate = originalDate || effectiveDate;
    const occKey = `${hashDate}|${amountCents}|${cleanDesc.toLowerCase()}`;
    const occIndex = occurrenceCounter.get(occKey) ?? 0;
    occurrenceCounter.set(occKey, occIndex + 1);

    const statementHash = generateStatementHash({
      cardId: params.cardId,
      competenceMonth: params.competenceMonth,
      date: hashDate,
      amountCents,
      cleanDescription: cleanDesc,
      occurrenceIndex: occIndex,
    });

    const inferredChargeKind = inferChargeKindFromDescription(text);
    const nature: StatementTransactionNature = classifyTransactionNature({
      rawDescription: text,
      isCredit,
      isPayment,
      isRefund,
      hasChargeKind: inferredChargeKind != null && inferredChargeKind !== "regular",
    });

    transactions.push({
      id: `stmt-${index}`,
      index: index++,
      occurrenceIndex: occIndex,
      date: effectiveDate,
      originalDate,
      nature,
      rawDescription: text,
      cleanDescription: cleanDesc,
      amountCents,
      isRefund,
      isPayment,
      installment,
      statementHash,
      inferredChargeKind,
    });

    acceptedLines.push(text);
  }

  return {
    transactions,
    reconstructedText: acceptedLines.join("\n"),
    discardedMoneyLines,
    detectedCardLast4s: Array.from(detectedCardLast4s),
  };
}

/**
 * Barreira 4: Checksum Gate
 * Compara a soma líquida extraída contra o total oficial detectado na fatura (tolerância +- R$ 0,05).
 */
export function evaluateChecksumGate(
  candidateLines: StatementTransaction[],
  officialTotalCents: number | null,
): ChecksumGateResult {
  let extractedTotalCents = 0;

  for (const tx of candidateLines) {
    if (tx.nature === "invoice_payment" || tx.isPayment) {
      continue; // Pagamento de fatura anterior não compõe o total da fatura atual
    }
    if (tx.isRefund || tx.nature === "refund") {
      extractedTotalCents -= tx.amountCents;
    } else {
      extractedTotalCents += tx.amountCents;
    }
  }

  if (officialTotalCents === null || officialTotalCents === undefined) {
    return {
      passed: candidateLines.length > 0,
      extractedTotalCents,
      officialTotalCents: null,
      diffCents: 0,
      candidateLines,
    };
  }

  const diffCents = Math.abs(extractedTotalCents - officialTotalCents);
  const passed = diffCents <= 5; // Tolerância estrita de +- 5 centavos

  return {
    passed,
    extractedTotalCents,
    officialTotalCents,
    diffCents,
    candidateLines,
  };
}

/**
 * Parser Espacial Unificado para Documentos PDF de Faturas Bancárias.
 * Extrai tokens espaciais via unpdf, detecta bimodalidade, agrupa linhas e aplica as 4 barreiras.
 */
export async function parseSpatialPdfDocument(
  buffer: ArrayBuffer,
  params: {
    cardId: string;
    competenceMonth: string;
    password?: string;
    officialTotalCents?: number | null;
  },
): Promise<SpatialPdfResult> {
  const unpdf = await import("unpdf");
  if (typeof unpdf.getDocumentProxy !== "function") {
    return {
      transactions: [],
      reconstructedText: "",
      lines: [],
      checksumGate: {
        passed: false,
        extractedTotalCents: 0,
        officialTotalCents: null,
        diffCents: 0,
        candidateLines: [],
      },
      totalPages: 0,
      usedTwoColumnMode: false,
    };
  }

  const options: Record<string, unknown> = {};
  if (params.password) {
    options.password = params.password;
  }

  const pdf = await unpdf.getDocumentProxy(new Uint8Array(buffer.slice(0)), options);
  const totalPages = pdf.numPages;
  const allLines: SpatialPdfLine[] = [];
  let usedTwoColumnMode = false;

  try {
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      type RawPdfTextItem = {
        str?: string;
        transform?: number[];
        width?: number;
        height?: number;
      };

      const rawItems = (content.items || []) as unknown as RawPdfTextItem[];
      const tokens: SpatialPdfToken[] = rawItems
        .filter((item): item is RawPdfTextItem & { str: string } => typeof item.str === "string" && item.str.trim() !== "")
        .map((item) => {
          const transform = item.transform || [1, 0, 0, 1, 0, 0];
          const fontSize = Math.hypot(transform[0] || 1, transform[1] || 0);
          return {
            str: item.str,
            x: transform[4] || 0,
            y: transform[5] || 0,
            width: item.width || 0,
            height: item.height || fontSize,
            fontSize,
          };
        });

      const isBimodal = evaluateBimodalPrecondition(tokens, viewport.width);
      if (isBimodal) {
        usedTwoColumnMode = true;
      }

      const pageLines = groupTokensIntoLines(tokens, viewport.width, isBimodal).map((l) => ({
        ...l,
        pageNumber: pageNum,
      }));
      allLines.push(...pageLines);

      page.cleanup();
    }
  } finally {
    try {
      await pdf.cleanup();
      await pdf.loadingTask?.destroy();
    } catch {
      // Ignora erro ao liberar recursos do documento
    }
  }

  const {
    transactions,
    reconstructedText,
    discardedMoneyLines,
    detectedCardLast4s,
  } = extractTransactionsFromSpatialLines(allLines, params);

  const checksumGate = evaluateChecksumGate(transactions, params.officialTotalCents ?? null);

  return {
    transactions,
    reconstructedText,
    lines: allLines,
    checksumGate,
    totalPages,
    usedTwoColumnMode,
    discardedMoneyLines,
    detectedCardLast4s,
  };
}
