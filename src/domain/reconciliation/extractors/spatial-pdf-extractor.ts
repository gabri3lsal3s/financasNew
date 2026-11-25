import type { RawExtractedEntry, StatementTransaction } from "../contracts";
import {
  isFxDetail,
  isStatementNoiseOrSummary,
  isSubcardHeader,
} from "../clean";
import { normalizeRawEntries } from "../normalize-entries";
import {
  filterTransactionalTokensForBimodal,
  isIsolatedPictographToken,
  splitMergedSpatialLineByTokens,
} from "./spatial-line-splitter";
import { parseAmountToCents } from "./type-sniffer";

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
  rawEntries?: RawExtractedEntry[];
  reconstructedText: string;
  lines: SpatialPdfLine[];
  checksumGate: ChecksumGateResult;
  totalPages: number;
  usedTwoColumnMode: boolean;
  discardedMoneyLines?: number;
  detectedCardLast4s?: string[];
}

export interface SpatialBlueprintHints {
  startMarkers?: readonly string[];
  pauseMarkers?: readonly string[];
  boletoMarkers?: readonly string[];
  totalLabels?: readonly string[];
  ignoredTotalLabels?: readonly string[];
  columnMode?: "auto" | "single" | "bimodal";
  strictStartZone?: boolean;
  polarity?: "auto" | "positive_purchase" | "negative_purchase";
  dateFormatHint?: "dmy" | "d_mmm" | "ymd" | "auto";
}

function normalizeMarkerMatchText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function matchesAnyMarker(lineText: string, markers?: readonly string[]): boolean {
  if (!markers || markers.length === 0) return false;
  const normalized = normalizeMarkerMatchText(lineText);
  return markers.some((m) => {
    const clean = normalizeMarkerMatchText(m);
    return clean.length >= 3 && normalized.includes(clean);
  });
}

const SECTION_START_REGEX =
  /\b(?:lan[çc]amentos|detalhamento\s+(?:da\s+fatura|das\s+despesas|dos\s+gastos)|compras\s+(?:nacionais|internacionais)|movimenta[çc][oõ]es|transa[çc][oõ]es|extrato\s+de\s+compras|extrato\s+referente|hist[oó]rico\s+de\s+lan[çc]amentos|data\s+(?:\|\s*)?(?:descri[çc][aã]o|hist[oó]rico|estabelecimento|lan[çc]amento)\s+(?:\|\s*)?valor)\b/i;

const SECTION_PAUSE_REGEX =
  /\b(?:op[çc][oõ]es\s+de\s+parcelamento|parcelamentos\s+para\s+aliviar|outras\s+formas\s+de\s+pagar|simula[çc][aã]o|demonstrativo\s+de\s+encargos|taxas\s+taxa\s+ao\s+m[eê]s|canais\s+de\s+atendimento|canais\s+de\s+contato|fale\s+conosco|ouvidoria|central\s+de\s+atendimento|sac\b|informa[çc][oõ]es\s+importantes)\b/i;

const HARD_STOP_BARCODE_REGEX =
  /(?:\b\d{5}[.\s]?\d{5}\s+\d{5}[.\s]?\d{6}\s+\d{5}[.\s]?\d{6}\s+\d\s+\d{14}\b|\b\d{47,48}\b|\bautentica[çc][aã]o\s+mec[aâ]nica\b|\brecibo\s+do\s+sacado\b|\bcanhoto\s+do\s+boleto\b)/i;

const SIMULATION_OR_RATE_REGEX =
  /(?:\b\d+[.,]\d+\s*%\s*a\.[ma]\b|\bcet\b|\bparcelamento\s+em\s+at[eé]\b|\b\d+\s*x\s+de\s+r?\$|\bpagamento\s+m[ií]nimo\b|\btaxa\s+de\s+juros\b|\bjuros\s+do\s+rotativo\b)/i;

const DATE_REGEX =
  /\b(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?|(\d{1,2})\s+(?:de\s+)?(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*)\b/i;

const AMOUNT_REGEX =
  /(?:(?:-\s*)?r\$\s*)?(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})(?:\s*([cd-]))?(?!\d)/i;

const BOLETO_FIELD_NOISE_REGEX =
  /\b(?:vencimento|data\s+do\s+documento|valor\s+do\s+documento|sacado|pagador|cedente|benefici[aá]rio|nosso\s+n[uú]mero|ag[eê]ncia\s*\/\s*c[oó]digo|ficha\s+de\s+compensa[çc][aã]o|autentica[çc][aã]o\s+mec[aâ]nica|recibo\s+do\s+sacado)\b/i;

const FOREIGN_CURRENCY_PREFIX_REGEX =
  /(?:usd|eur|gbp|us\$|€|£|cad|aud|chf)\s*$/i;

export function isBoletoFieldNoise(text: string): boolean {
  return BOLETO_FIELD_NOISE_REGEX.test(text);
}

/**
 * Em linhas com moeda estrangeira e BRL, ancora a extração no último valor em BRL à direita.
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
    const rawNum = match[1] ?? match[0];
    const hasSpacedMinusBeforeCurrency = /^-\s*r\$/i.test(match[0].trim());
    const valueStr =
      hasSpacedMinusBeforeCurrency && !rawNum.startsWith("-") ? `-${rawNum}` : rawNum;
    matches.push({
      fullMatch: match[0],
      valueStr,
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

  const brlMatches = matches.filter((m) => {
    const before = text.slice(Math.max(0, m.index - 12), m.index);
    return !FOREIGN_CURRENCY_PREFIX_REGEX.test(before);
  });

  const chosen =
    brlMatches.length > 0 ? brlMatches[brlMatches.length - 1]! : matches[matches.length - 1]!;
  return {
    fullMatch: chosen.fullMatch,
    valueStr: chosen.valueStr,
    suffix: chosen.suffix,
  };
}

function estimateTokenWidth(tok: SpatialPdfToken): number {
  if (tok.width > 0) return tok.width;
  return Math.min(24, Math.max(4, (tok.str?.length || 1) * 4));
}

function countDateAndAmountPairs(tokList: readonly SpatialPdfToken[]): number {
  if (tokList.length === 0) return 0;
  const sorted = [...tokList].sort((a, b) => b.y - a.y);
  const lineBuckets: string[] = [];
  let currentY: number | null = null;
  let currentFontSize = 8;
  let currentTokens: SpatialPdfToken[] = [];

  for (const tok of sorted) {
    const yTol = Math.max(2.5, Math.min(6, (tok.fontSize || currentFontSize) * 0.35));
    if (currentY === null || Math.abs(currentY - tok.y) <= yTol) {
      if (currentY === null) {
        currentY = tok.y;
        currentFontSize = tok.fontSize || 8;
      }
      currentTokens.push(tok);
    } else {
      currentTokens.sort((a, b) => a.x - b.x);
      lineBuckets.push(currentTokens.map((t) => t.str).join(" "));
      currentY = tok.y;
      currentFontSize = tok.fontSize || 8;
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
}

/**
 * Detector de vale real de densidade X entre 30% e 70% de `pageWidth` (buckets de 10pt),
 * localizando corredores vazios `>= 14pt` com `>= 2` pares `Data + Valor` independentes
 * de cada lado (suporta PDFs bimodais assimétricos como 55/45).
 */
export function findBimodalGutterX(
  tokens: readonly SpatialPdfToken[],
  pageWidth: number,
): number | null {
  if (tokens.length === 0 || pageWidth <= 0) return null;

  const transactionalTokens = filterTransactionalTokensForBimodal(tokens);
  const targetTokens = transactionalTokens.length >= 4 ? transactionalTokens : tokens;

  const searchStart = pageWidth * 0.3;
  const searchEnd = pageWidth * 0.7;
  const bucketSize = 10;
  const bucketCount = Math.floor((searchEnd - searchStart) / bucketSize);
  if (bucketCount < 2) return null;

  const occupied = new Array<boolean>(bucketCount).fill(false);
  for (const tok of targetTokens) {
    const tokStart = tok.x;
    const tokEnd = tokStart + estimateTokenWidth(tok);
    if (tokEnd <= searchStart || tokStart >= searchEnd) continue;

    const firstBucket = Math.max(0, Math.floor((tokStart - searchStart) / bucketSize));
    const lastBucket = Math.min(bucketCount - 1, Math.floor((tokEnd - searchStart) / bucketSize));
    for (let b = firstBucket; b <= lastBucket; b++) {
      occupied[b] = true;
    }
  }

  const candidates: Array<{ gutterX: number; width: number }> = [];

  let curStart = -1;
  let curLen = 0;
  for (let b = 0; b <= bucketCount; b++) {
    if (b < bucketCount && !occupied[b]) {
      if (curStart === -1) curStart = b;
      curLen += 1;
    } else {
      const width = curLen * bucketSize;
      if (width >= 14 && curStart !== -1) {
        candidates.push({
          gutterX: searchStart + (curStart + curLen / 2) * bucketSize,
          width,
        });
      }
      curStart = -1;
      curLen = 0;
    }
  }

  const intervals = targetTokens
    .map((t) => ({
      start: t.x,
      end: t.x + estimateTokenWidth(t),
    }))
    .sort((a, b) => a.start - b.start);

  let maxEnd = 0;
  for (const iv of intervals) {
    if (iv.start > maxEnd) {
      const gap = iv.start - maxEnd;
      const mid = (maxEnd + iv.start) / 2;
      if (gap >= 14 && mid >= searchStart && mid <= searchEnd) {
        candidates.push({ gutterX: mid, width: gap });
      }
    }
    if (iv.end > maxEnd) maxEnd = iv.end;
  }

  const pageCenter = pageWidth * 0.5;
  candidates.sort((a, b) => {
    if (b.width !== a.width) return b.width - a.width;
    return Math.abs(a.gutterX - pageCenter) - Math.abs(b.gutterX - pageCenter);
  });

  for (const cand of candidates) {
    const leftTokens = targetTokens.filter((t) => t.x < cand.gutterX);
    const rightTokens = targetTokens.filter((t) => t.x >= cand.gutterX);
    if (
      countDateAndAmountPairs(leftTokens) >= 2 &&
      countDateAndAmountPairs(rightTokens) >= 2
    ) {
      return cand.gutterX;
    }
  }

  return null;
}

/**
 * Avalia a Pré-Condição Bimodal via vale de densidade X real.
 */
export function evaluateBimodalPrecondition(
  tokens: SpatialPdfToken[],
  pageWidth: number,
): boolean {
  return findBimodalGutterX(tokens, pageWidth) !== null;
}

/**
 * Agrupa tokens em linhas horizontais com tolerância Y adaptativa proporcional ao `fontSize`
 * (`Math.max(2.5, Math.min(6, fontSize * 0.35))`) e corte opcional pelo `gutterX` do vale real.
 */
export function groupTokensIntoLines(
  tokens: SpatialPdfToken[],
  pageWidth: number,
  isBimodal: boolean,
  gutterX?: number,
): SpatialPdfLine[] {
  if (tokens.length === 0) return [];

  const splitX = isBimodal
    ? gutterX ?? findBimodalGutterX(tokens, pageWidth) ?? pageWidth * 0.5
    : pageWidth * 0.5;

  const clusterSubset = (subTokens: SpatialPdfToken[], col: 1 | 2): SpatialPdfLine[] => {
    const sorted = [...subTokens].sort((a, b) => b.y - a.y || a.x - b.x);
    const lines: SpatialPdfLine[] = [];

    let currentY: number | null = null;
    let currentRefFontSize = 8;
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
      if (isIsolatedPictographToken(tok.str)) continue;
      const refSize = tok.fontSize > 0 ? tok.fontSize : currentRefFontSize;
      const yTolerance = Math.max(2.5, Math.min(6, refSize * 0.35));

      if (currentY === null || Math.abs(currentY - tok.y) <= yTolerance) {
        if (currentY === null) {
          currentY = tok.y;
          currentRefFontSize = tok.fontSize > 0 ? tok.fontSize : 8;
        }
        currentBucket.push(tok);
      } else {
        flushBucket();
        currentY = tok.y;
        currentRefFontSize = tok.fontSize > 0 ? tok.fontSize : 8;
        currentBucket = [tok];
      }
    }
    flushBucket();

    return lines;
  };

  if (isBimodal) {
    const leftTokens = tokens.filter((t) => t.x < splitX);
    const rightTokens = tokens.filter((t) => t.x >= splitX);
    return [...clusterSubset(leftTokens, 1), ...clusterSubset(rightTokens, 2)];
  }

  return clusterSubset(tokens, 1);
}

/**
 * Barreira 1: Máquina de Estados de Seção (honrando 100% dos markers do blueprint).
 */
export class SectionStateMachine {
  private state: SectionZoneState = "outside";
  private boletoPage = 1;
  private pausePage = 1;
  private readonly hints?: SpatialBlueprintHints;

  constructor(hints?: SpatialBlueprintHints) {
    this.hints = hints;
  }

  private isStartMarker(lineText: string): boolean {
    return SECTION_START_REGEX.test(lineText) || matchesAnyMarker(lineText, this.hints?.startMarkers);
  }

  private isPauseMarker(lineText: string): boolean {
    return SECTION_PAUSE_REGEX.test(lineText) || matchesAnyMarker(lineText, this.hints?.pauseMarkers);
  }

  private isBoletoMarker(lineText: string): boolean {
    return (
      HARD_STOP_BARCODE_REGEX.test(lineText) ||
      matchesAnyMarker(lineText, this.hints?.boletoMarkers)
    );
  }

  public processLine(
    lineText: string,
    pageNumber = 1,
  ): { state: SectionZoneState; shouldDrop: boolean } {
    if (this.state === "paused_boleto") {
      if (pageNumber > this.boletoPage) {
        this.state = "outside";
      } else if (this.isStartMarker(lineText)) {
        this.state = "start_zone";
        const hasDateAndAmount = DATE_REGEX.test(lineText) && AMOUNT_REGEX.test(lineText);
        return { state: "start_zone", shouldDrop: !hasDateAndAmount };
      } else {
        return { state: "paused_boleto", shouldDrop: true };
      }
    }

    if (this.state === "pause_zone" && pageNumber > this.pausePage) {
      this.state = "outside";
    }

    if (this.isBoletoMarker(lineText)) {
      this.state = "paused_boleto";
      this.boletoPage = pageNumber;
      return { state: "paused_boleto", shouldDrop: true };
    }

    if (isBoletoFieldNoise(lineText)) {
      return { state: this.state, shouldDrop: true };
    }

    if (this.isStartMarker(lineText)) {
      this.state = "start_zone";
      const hasDateAndAmount = DATE_REGEX.test(lineText) && AMOUNT_REGEX.test(lineText);
      return { state: "start_zone", shouldDrop: !hasDateAndAmount };
    }

    if (this.isPauseMarker(lineText)) {
      this.state = "pause_zone";
      this.pausePage = pageNumber;
      return { state: "pause_zone", shouldDrop: true };
    }

    if (this.state === "outside") {
      const requireExplicitStart =
        this.hints?.strictStartZone === true &&
        Boolean(this.hints?.startMarkers && this.hints.startMarkers.length > 0);
      if (!requireExplicitStart && DATE_REGEX.test(lineText) && AMOUNT_REGEX.test(lineText)) {
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

export function isDominantGeometry(line: SpatialPdfLine): boolean {
  if (!line.text.trim()) return false;
  if (line.fontSize > 0 && line.fontSize < 6.8) {
    return false;
  }
  return true;
}

export function isSimulationOrContractualNoise(text: string): boolean {
  return SIMULATION_OR_RATE_REGEX.test(text);
}

/**
 * Extrator "burro" de linhas espaciais de PDF:
 * aplica as barreiras de seção/ruído, isola Data + Descrição (limpeza G5 não-destrutiva via `lastIndexOf`)
 * e último Valor BRL à direita, emitindo `RawExtractedEntry[]`.
 */
export function extractRawEntriesFromSpatialLines(
  lines: readonly SpatialPdfLine[],
  params?: { blueprintHints?: SpatialBlueprintHints },
): {
  entries: RawExtractedEntry[];
  reconstructedText: string;
  discardedMoneyLines: number;
  detectedCardLast4s: string[];
} {
  const hints = params?.blueprintHints;
  const stateMachine = new SectionStateMachine(hints);
  const entries: RawExtractedEntry[] = [];
  const acceptedLines: string[] = [];
  const detectedCardLast4s = new Set<string>();
  let discardedMoneyLines = 0;
  let sourceIndex = 0;

  const expandedLines = lines.flatMap((l) => splitMergedSpatialLineByTokens(l));

  for (let i = 0; i < expandedLines.length; i++) {
    const line = expandedLines[i]!;
    const text = line.text.trim();

    const cardLast4Match = /(?:[•*xX.-]{3,4}\s*){1,4}(\d{4})\b|\bfinal\s+(\d{4})\b/i.exec(text);
    const matchedDigits = cardLast4Match?.[1] ?? cardLast4Match?.[2];
    if (matchedDigits && isSubcardHeader(text)) {
      detectedCardLast4s.add(matchedDigits);
    }

    const { shouldDrop } = stateMachine.processLine(text, line.pageNumber ?? 1);
    if (shouldDrop) {
      if (AMOUNT_REGEX.test(text)) {
        discardedMoneyLines++;
      }
      continue;
    }

    if (!isDominantGeometry(line)) {
      continue;
    }

    if (isSimulationOrContractualNoise(text)) {
      if (AMOUNT_REGEX.test(text)) {
        discardedMoneyLines++;
      }
      continue;
    }

    const dateMatch = DATE_REGEX.exec(text);
    const amountExtracted = extractBrlAmountFromLine(text);

    if (!dateMatch || !amountExtracted) {
      if (isFxDetail(text) && entries.length > 0) {
        const lastEntry = entries[entries.length - 1]!;
        lastEntry.fxDetails = [...(lastEntry.fxDetails ?? []), text];
        acceptedLines.push(`  -> [fx_detail] ${text}`);
      }
      continue;
    }

    const rawDateStr = dateMatch[0];
    const parsedAmt = parseAmountToCents(amountExtracted.valueStr);
    if (!parsedAmt || parsedAmt.amountCents === 0) continue;

    const suffixLower = amountExtracted.suffix?.toLowerCase();
    const isCreditSuffix = Boolean(suffixLower === "c" || parsedAmt.isCreditSuffix);
    const isTrailingMinus = suffixLower === "-";
    const isDebitSuffix = Boolean(
      suffixLower === "d" || (parsedAmt.isDebitSuffix && !isTrailingMinus),
    );

    // G5: Remove apenas a data capturada e a ÚLTIMA ocorrência do valor (nunca executa regex global C/D sobre nomes como "C&A" ou "D PEDRO")
    const dateStart = dateMatch.index;
    const withoutDate =
      text.slice(0, dateStart) + text.slice(dateStart + rawDateStr.length);
    const lastAmtIdx = withoutDate.lastIndexOf(amountExtracted.fullMatch);
    const rawDesc = (
      lastAmtIdx >= 0
        ? withoutDate.slice(0, lastAmtIdx) +
          withoutDate.slice(lastAmtIdx + amountExtracted.fullMatch.length)
        : withoutDate
    )
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!rawDesc) continue;

    if (
      isSubcardHeader(rawDesc) ||
      isSubcardHeader(text) ||
      isStatementNoiseOrSummary(rawDesc) ||
      isStatementNoiseOrSummary(text)
    ) {
      discardedMoneyLines++;
      continue;
    }

    entries.push({
      sourceIndex: sourceIndex++,
      rawDate: rawDateStr,
      merchantRaw: rawDesc,
      rawLine: text,
      amountCents: parsedAmt.amountCents,
      isNegative: parsedAmt.isNegative || isTrailingMinus,
      isCreditSuffix,
      isDebitSuffix,
      signHint: hints?.polarity ?? "auto",
      dateFormatHint: hints?.dateFormatHint ?? "auto",
      sourceKind: "spatial_pdf",
    });

    acceptedLines.push(text);
  }

  return {
    entries,
    reconstructedText: acceptedLines.join("\n"),
    discardedMoneyLines,
    detectedCardLast4s: Array.from(detectedCardLast4s),
  };
}

/**
 * Extrai e normaliza transações a partir de linhas espaciais delegando para `normalizeRawEntries`.
 */
export function extractTransactionsFromSpatialLines(
  lines: SpatialPdfLine[],
  params: {
    cardId: string;
    competenceMonth: string;
    closingDay?: number | null;
    blueprintHints?: SpatialBlueprintHints;
  },
): {
  transactions: StatementTransaction[];
  entries: RawExtractedEntry[];
  reconstructedText: string;
  discardedMoneyLines: number;
  detectedCardLast4s: string[];
} {
  const { entries, reconstructedText, discardedMoneyLines, detectedCardLast4s } =
    extractRawEntriesFromSpatialLines(lines, { blueprintHints: params.blueprintHints });

  const transactions = normalizeRawEntries(entries, {
    cardId: params.cardId,
    competenceMonth: params.competenceMonth,
    closingDay: params.closingDay,
    defaultSignHint: params.blueprintHints?.polarity ?? "auto",
  });

  return {
    transactions,
    entries,
    reconstructedText,
    discardedMoneyLines,
    detectedCardLast4s,
  };
}

export function buildSpatialLinesFromRawLines(
  rawLines: readonly string[],
): SpatialPdfLine[] {
  const result: SpatialPdfLine[] = [];
  let currentPage = 1;

  for (let i = 0; i < rawLines.length; i++) {
    const text = (rawLines[i] ?? "").trim();
    if (!text) continue;
    if (/^---\s*page\s+\d+\s*---$/i.test(text) || text === "\f") {
      currentPage += 1;
      continue;
    }
    result.push({
      y: Math.max(0, 1000 - i * 12),
      xStart: 0,
      xEnd: text.length * 6,
      fontSize: 10,
      column: 1,
      text,
      tokens: [],
      pageNumber: currentPage,
    });
  }

  return result;
}

export function evaluateChecksumGate(
  candidateLines: StatementTransaction[],
  officialTotalCents: number | null,
): ChecksumGateResult {
  let extractedTotalCents = 0;

  for (const tx of candidateLines) {
    if (tx.nature === "invoice_payment" || tx.isPayment) {
      continue;
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
  const passed = diffCents <= 5;

  return {
    passed,
    extractedTotalCents,
    officialTotalCents,
    diffCents,
    candidateLines,
  };
}

export async function parseSpatialPdfDocument(
  buffer: ArrayBuffer,
  params: {
    cardId: string;
    competenceMonth: string;
    closingDay?: number | null;
    password?: string;
    officialTotalCents?: number | null;
    blueprintHints?: SpatialBlueprintHints;
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
        .filter(
          (item): item is RawPdfTextItem & { str: string } =>
            typeof item.str === "string" && item.str.trim() !== "",
        )
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

      const colMode = params.blueprintHints?.columnMode ?? "auto";
      let gutterX: number | undefined;
      let isBimodal = false;
      if (colMode === "bimodal") {
        isBimodal = true;
        gutterX = findBimodalGutterX(tokens, viewport.width) ?? viewport.width * 0.5;
      } else if (colMode === "auto") {
        const detectedGutter = findBimodalGutterX(tokens, viewport.width);
        if (detectedGutter !== null) {
          isBimodal = true;
          gutterX = detectedGutter;
        }
      }

      if (isBimodal) {
        usedTwoColumnMode = true;
      }

      const pageLines = groupTokensIntoLines(tokens, viewport.width, isBimodal, gutterX).map(
        (l) => ({
          ...l,
          pageNumber: pageNum,
        }),
      );
      allLines.push(...pageLines);

      page.cleanup();
    }
  } finally {
    try {
      await pdf.cleanup();
      await pdf.loadingTask?.destroy();
    } catch {
      // Ignora erro ao liberar recursos
    }
  }

  const {
    transactions,
    entries,
    reconstructedText,
    discardedMoneyLines,
    detectedCardLast4s,
  } = extractTransactionsFromSpatialLines(allLines, params);

  const checksumGate = evaluateChecksumGate(transactions, params.officialTotalCents ?? null);

  return {
    transactions,
    rawEntries: entries,
    reconstructedText,
    lines: allLines,
    checksumGate,
    totalPages,
    usedTwoColumnMode,
    discardedMoneyLines,
    detectedCardLast4s,
  };
}
