import type { ColumnMapping, StatementTransaction } from "../types";
import {
  buildSpatialLinesFromRawLines,
  extractTransactionsFromSpatialLines,
} from "../parsers/spatial-pdf-parser";
import {
  evaluateStatementExtractionQuality,
  type StatementQualityGateResult,
} from "../quality-gate";
import {
  computeStatementFingerprint,
  sanitizeLineForStructuralTokens,
} from "./fingerprint";
import {
  StatementLayoutBlueprintSchema,
  toSpatialBlueprintHints,
  type BlueprintFileKind,
  type StatementLayoutBlueprint,
} from "./types";

const DATE_AND_AMOUNT_LINE_REGEX =
  /(?:\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\s+(?:jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b).*(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/i;
const ANY_AMOUNT_REGEX = /(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/;
const BOLETO_CUE_REGEX =
  /\b(?:autentica[çc][aã]o\s+mec[aâ]nica|recibo\s+do\s+(?:sacado|pagador)|ficha\s+de\s+compensa[çc][aã]o|canhoto\s+do\s+boleto|c[oó]digo\s+de\s+barras)\b/i;
const IGNORED_TOTAL_CUE_REGEX =
  /\b(?:parcelamento|pagamento\s+m[ií]nimo|limite\s+(?:dispon[ií]vel|total)|cet\b|juros|1x\s*r?\$)\b/i;

export const MIN_VISION_ANCHOR_MATCH_RATE = 0.8;

/**
 * Converte uma linha estrutural em marcador limpo de 2 a 6 tokens,
 * removendo estritamente PII, meses, anos, moedas e dígitos.
 */
export function sanitizeMarkerPhrase(line: string): string | null {
  if (!line || DATE_AND_AMOUNT_LINE_REGEX.test(line)) {
    return null;
  }
  const tokens = sanitizeLineForStructuralTokens(line);
  if (tokens.length < 2) {
    return null;
  }
  const phrase = tokens.slice(0, 6).join(" ").trim();
  if (phrase.length < 5 || phrase.length > 80) {
    return null;
  }
  return phrase;
}

function formatCentsSearchVariants(amountCents: number): string[] {
  const abs = Math.abs(amountCents);
  const plainBrl = (abs / 100).toFixed(2).replace(".", ",");
  const plainDot = (abs / 100).toFixed(2);
  const intPart = Math.floor(abs / 100);
  const decPart = String(abs % 100).padStart(2, "0");
  const groupedInt = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const groupedBrl = `${groupedInt},${decPart}`;
  return Array.from(new Set([groupedBrl, plainBrl, plainDot]));
}

function normalizeForAnchorSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function doesLineAnchorTransaction(
  normalizedLine: string,
  tx: StatementTransaction,
): boolean {
  const amountVariants = formatCentsSearchVariants(tx.amountCents);
  const hasAmount = amountVariants.some((variant) => normalizedLine.includes(variant));
  if (!hasAmount) return false;

  const descTokens = normalizeForAnchorSearch(tx.cleanDescription)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  if (descTokens.some((tok) => normalizedLine.includes(tok))) {
    return true;
  }

  // Fallback de âncora: dia/mês da transação + valor exato na mesma linha
  const monthDay = `${tx.date.slice(8, 10)}/${tx.date.slice(5, 7)}`;
  return normalizedLine.includes(monthDay);
}

/**
 * Calcula a taxa de ancoragem (`0..1`) das transações extraídas nas linhas textuais do documento.
 * Usada para bloquear aprendizado frágil em Vision pura (`anchorMatchRate < 0.8`).
 */
export function computeVisionAnchorMatchRate(params: {
  extractedTransactions: readonly StatementTransaction[];
  rawLines: readonly string[];
}): { anchorMatchRate: number; anchoredLineIndices: number[] } {
  const { extractedTransactions, rawLines } = params;
  if (extractedTransactions.length === 0 || rawLines.length === 0) {
    return { anchorMatchRate: 0, anchoredLineIndices: [] };
  }

  const normalizedLines = rawLines.map((l) => normalizeForAnchorSearch(l));
  const usedLineIndices = new Set<number>();
  let matchedCount = 0;

  for (const tx of extractedTransactions) {
    let foundIdx = -1;
    for (let i = 0; i < normalizedLines.length; i++) {
      if (usedLineIndices.has(i)) continue;
      if (doesLineAnchorTransaction(normalizedLines[i]!, tx)) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx === -1) {
      // Permite reutilizar linha em caso de duplicata idêntica no mesmo texto
      for (let i = 0; i < normalizedLines.length; i++) {
        if (doesLineAnchorTransaction(normalizedLines[i]!, tx)) {
          foundIdx = i;
          break;
        }
      }
    }
    if (foundIdx !== -1) {
      usedLineIndices.add(foundIdx);
      matchedCount += 1;
    }
  }

  return {
    anchorMatchRate: matchedCount / extractedTransactions.length,
    anchoredLineIndices: Array.from(usedLineIndices).sort((a, b) => a - b),
  };
}

export interface DistillBlueprintDraftParams {
  rawText: string;
  rawLines: readonly string[];
  extractedTransactions: readonly StatementTransaction[];
  fileKind: BlueprintFileKind;
  fileName?: string;
  extractionSource: "ai_text" | "ai_vision" | "user_manual";
  officialTotalCents?: number | null;
  cycleNetTargetCents?: number | null;
  columnMapping?: ColumnMapping;
  delimiter?: "," | ";" | "\t" | "|";
  headerSignature?: string;
}

export interface DistillBlueprintDraftResult {
  blueprint: StatementLayoutBlueprint | null;
  anchorMatchRate: number;
  skippedReason?:
    | "no_transactions"
    | "fragile_vision_low_anchor_rate"
    | "no_structural_anchors"
    | "schema_invalid";
}

/**
 * Destila um rascunho de `StatementLayoutBlueprint` em memória (0 tokens extras de IA).
 * NÃO persiste automaticamente — a persistência só pode ocorrer no commit após Shadow Replay.
 */
export function distillStatementBlueprintDraft(
  params: DistillBlueprintDraftParams,
): DistillBlueprintDraftResult {
  const {
    rawText,
    rawLines,
    extractedTransactions,
    fileKind,
    fileName,
    extractionSource,
    officialTotalCents = null,
    cycleNetTargetCents = null,
    columnMapping,
    delimiter,
    headerSignature,
  } = params;

  if (extractedTransactions.length === 0) {
    return { blueprint: null, anchorMatchRate: 0, skippedReason: "no_transactions" };
  }

  const fingerprint = computeStatementFingerprint({
    rawText,
    fileKind,
    fileName,
    headerLines: rawLines,
  });

  const { anchorMatchRate, anchoredLineIndices } = computeVisionAnchorMatchRate({
    extractedTransactions,
    rawLines,
  });

  // Bloqueio obrigatório: Vision pura sem ancoragem textual (>= 80%) não pode destilar pdfRules
  if (
    extractionSource === "ai_vision" &&
    (fileKind === "pdf_text" || fileKind === "text") &&
    anchorMatchRate < MIN_VISION_ANCHOR_MATCH_RATE
  ) {
    return {
      blueprint: null,
      anchorMatchRate,
      skippedReason: "fragile_vision_low_anchor_rate",
    };
  }

  const origin = extractionSource === "user_manual" ? "user_learned" : "ai_learned";

  if (fileKind === "csv" || fileKind === "xlsx") {
    if (!columnMapping || columnMapping.descriptionColIndex === columnMapping.dateColIndex) {
      return {
        blueprint: null,
        anchorMatchRate,
        skippedReason: "no_structural_anchors",
      };
    }

    const parsedTabular = StatementLayoutBlueprintSchema.safeParse({
      version: 1,
      fingerprint: fingerprint.exactFingerprint,
      issuerKey: fingerprint.issuerKey,
      issuerName: fingerprint.issuerName,
      fileKind,
      origin,
      tabularRules: {
        delimiter,
        headerSignature,
        columnMapping,
      },
      polarity: "auto",
      dateFormatHint: "auto",
      currencyStrategy: "brl_standard",
      stats: {
        uses: 1,
        exactChecksumHits: 1,
        consecutiveFailures: 0,
        updatedAt: new Date().toISOString(),
      },
    });

    if (!parsedTabular.success) {
      return { blueprint: null, anchorMatchRate, skippedReason: "schema_invalid" };
    }
    return { blueprint: parsedTabular.data, anchorMatchRate };
  }

  if (anchoredLineIndices.length === 0) {
    return {
      blueprint: null,
      anchorMatchRate,
      skippedReason: "no_structural_anchors",
    };
  }

  const firstAnchorIdx = anchoredLineIndices[0]!;
  const lastAnchorIdx = anchoredLineIndices[anchoredLineIndices.length - 1]!;
  const anchoredSet = new Set(anchoredLineIndices);

  const startMarkers = new Set<string>();
  const pauseMarkers = new Set<string>();
  const boletoMarkers = new Set<string>();
  const totalLabels = new Set<string>();
  const ignoredTotalLabels = new Set<string>();

  // 1. Coleta marcadores de início nas linhas estruturais imediatamente anteriores à 1ª transação,
  // interrompendo imediatamente ao encontrar uma linha de ruído com Data+Valor para nunca abrir a zona antes dela.
  const startScanFrom = Math.max(0, firstAnchorIdx - 6);
  for (let i = firstAnchorIdx - 1; i >= startScanFrom; i--) {
    const line = rawLines[i] ?? "";
    if (!line.trim()) continue;
    if (DATE_AND_AMOUNT_LINE_REGEX.test(line)) break;
    if (ANY_AMOUNT_REGEX.test(line)) continue;
    if (BOLETO_CUE_REGEX.test(line) || IGNORED_TOTAL_CUE_REGEX.test(line)) continue;
    const phrase = sanitizeMarkerPhrase(line);
    if (phrase) {
      startMarkers.add(phrase);
      if (startMarkers.size >= 3) break;
    }
  }

  // 2. Coleta marcadores de pausa imediatamente após a última transação (ou antes de blocos de ruído com valor)
  const postScanLimit = Math.min(rawLines.length, lastAnchorIdx + 12);
  for (let i = lastAnchorIdx + 1; i < postScanLimit; i++) {
    const line = rawLines[i] ?? "";
    if (!line.trim()) continue;
    if (BOLETO_CUE_REGEX.test(line)) {
      const phrase = sanitizeMarkerPhrase(line);
      if (phrase) boletoMarkers.add(phrase);
      continue;
    }
    if (!DATE_AND_AMOUNT_LINE_REGEX.test(line)) {
      const nextHasAmount =
        ANY_AMOUNT_REGEX.test(rawLines[i + 1] ?? "") ||
        ANY_AMOUNT_REGEX.test(rawLines[i + 2] ?? "") ||
        IGNORED_TOTAL_CUE_REGEX.test(line);
      if (nextHasAmount || i === lastAnchorIdx + 1) {
        const phrase = sanitizeMarkerPhrase(line);
        if (phrase && !startMarkers.has(phrase)) {
          pauseMarkers.add(phrase);
          if (pauseMarkers.size >= 4) break;
        }
      }
    }
  }

  // 3. Coleta rótulos de total oficial e rótulos ignorados (parcelamento/CET)
  const targetAmountVariants = [
    ...(officialTotalCents ? formatCentsSearchVariants(officialTotalCents) : []),
    ...(cycleNetTargetCents ? formatCentsSearchVariants(cycleNetTargetCents) : []),
  ];

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i] ?? "";
    const norm = normalizeForAnchorSearch(line);

    if (BOLETO_CUE_REGEX.test(line) && boletoMarkers.size < 4) {
      const phrase = sanitizeMarkerPhrase(line);
      if (phrase) boletoMarkers.add(phrase);
    }

    if (IGNORED_TOTAL_CUE_REGEX.test(line) && ignoredTotalLabels.size < 4) {
      const phrase = sanitizeMarkerPhrase(line);
      if (phrase) ignoredTotalLabels.add(phrase);
    }

    if (
      !anchoredSet.has(i) &&
      targetAmountVariants.length > 0 &&
      targetAmountVariants.some((v) => norm.includes(v)) &&
      !IGNORED_TOTAL_CUE_REGEX.test(line) &&
      totalLabels.size < 4
    ) {
      const phrase = sanitizeMarkerPhrase(line);
      if (phrase) totalLabels.add(phrase);
    }
  }

  // 4. Verifica se há linhas falsas com Data + Valor ANTES da 1ª transação ancorada -> exige strictStartZone
  let hasPreTableDateAmountNoise = false;
  for (let i = 0; i < firstAnchorIdx; i++) {
    if (DATE_AND_AMOUNT_LINE_REGEX.test(rawLines[i] ?? "")) {
      hasPreTableDateAmountNoise = true;
      break;
    }
  }

  // 5. Infere polaridade nas linhas ancoradas
  let negativePurchases = 0;
  let positivePurchases = 0;
  for (const idx of anchoredLineIndices) {
    const rawLine = rawLines[idx] ?? "";
    const matchingTx = extractedTransactions.find((tx) =>
      doesLineAnchorTransaction(normalizeForAnchorSearch(rawLine), tx),
    );
    if (!matchingTx || matchingTx.isPayment || matchingTx.isRefund) continue;
    if (/-\s*(?:r\$\s*)?\d{1,3}(?:\.\d{3})*,\d{2}|-\s*\d+\.\d{2}/i.test(rawLine)) {
      negativePurchases += 1;
    } else {
      positivePurchases += 1;
    }
  }
  const polarity =
    negativePurchases > positivePurchases && negativePurchases >= 2
      ? "negative_purchase"
      : "positive_purchase";

  const candidate = {
    version: 1 as const,
    fingerprint: fingerprint.exactFingerprint,
    issuerKey: fingerprint.issuerKey,
    issuerName: fingerprint.issuerName,
    fileKind,
    origin,
    pdfRules: {
      startMarkers: Array.from(startMarkers),
      pauseMarkers: Array.from(pauseMarkers),
      boletoMarkers: Array.from(boletoMarkers),
      totalLabels: Array.from(totalLabels),
      ignoredTotalLabels: Array.from(ignoredTotalLabels),
      columnMode: "auto" as const,
      strictStartZone: hasPreTableDateAmountNoise && startMarkers.size > 0,
      requireExplicitDatePerLine: true,
    },
    polarity,
    dateFormatHint: "auto" as const,
    currencyStrategy: "brl_rightmost" as const,
    stats: {
      uses: 1,
      exactChecksumHits: 1,
      consecutiveFailures: 0,
      updatedAt: new Date().toISOString(),
    },
  };

  const parsed = StatementLayoutBlueprintSchema.safeParse(candidate);
  if (!parsed.success) {
    return { blueprint: null, anchorMatchRate, skippedReason: "schema_invalid" };
  }

  return { blueprint: parsed.data, anchorMatchRate };
}

export interface ShadowReplayParams {
  blueprint: StatementLayoutBlueprint;
  rawLines: readonly string[];
  cardId: string;
  competenceMonth: string;
  officialTotalCents?: number | null;
  cycleNetTargetCents?: number | null;
  previousBalanceCents?: number | null;
  paymentsCents?: number | null;
  referenceTodayIso?: string;
}

export interface ShadowReplayResult {
  passed: boolean;
  qualityGate: StatementQualityGateResult;
  transactions: StatementTransaction[];
}

/**
 * Shadow Replay (Auto-Validação Obrigatória pré-persistência):
 * Executa um dry-run 100% determinístico aplicando o blueprint rascunho sobre `rawLines`.
 * Só aprova para persistência se atingir `score >= 85` e Checksum válido no próprio documento.
 */
export function validateBlueprintWithShadowReplay(
  params: ShadowReplayParams,
): ShadowReplayResult {
  const {
    blueprint,
    rawLines,
    cardId,
    competenceMonth,
    officialTotalCents = null,
    cycleNetTargetCents = null,
    previousBalanceCents = null,
    paymentsCents = null,
    referenceTodayIso,
  } = params;

  const spatialLines = buildSpatialLinesFromRawLines(rawLines);
  const extracted = extractTransactionsFromSpatialLines(spatialLines, {
    cardId,
    competenceMonth,
    blueprintHints: toSpatialBlueprintHints(blueprint),
  });

  const qualityGate = evaluateStatementExtractionQuality({
    transactions: extracted.transactions,
    officialTotalCents,
    cycleNetTargetCents,
    previousBalanceCents,
    paymentsCents,
    allLinesCount: spatialLines.length,
    discardedMoneyLines: extracted.discardedMoneyLines,
    referenceTodayIso,
  });

  const hasKnownTarget =
    (cycleNetTargetCents !== null && cycleNetTargetCents > 0) ||
    (officialTotalCents !== null && officialTotalCents > 0);
  const checksumOk = !hasKnownTarget || qualityGate.diffCents <= 5;
  const passed =
    extracted.transactions.length > 0 &&
    qualityGate.score >= 85 &&
    qualityGate.passed &&
    checksumOk;

  return {
    passed,
    qualityGate,
    transactions: extracted.transactions,
  };
}
