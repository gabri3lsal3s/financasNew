import {
  computeStatementFingerprint,
  detectFileKindFromBytes,
  evaluateChecksumGate,
  extractPrintedStatementTotalCents,
  extractTransactionsFromSpatialLines,
  findBestStatementBlueprint,
  isSpreadsheetOrHtmlFileName,
  toSpatialBlueprintHints,
  type ChecksumGateResult,
  type RawEntrySignHint,
  type RawExtractedEntry,
  type SpatialPdfLine,
  type StatementLayoutBlueprint,
  type StatementTransaction,
} from "@/domain/reconciliation";
import { computeTextSha256, sanitizeBatchDescriptionForAi } from "@/services/ai-assistant";
import {
  isPdfPasswordProtectedError,
  PdfPasswordProtectedError,
} from "@/services/native/receipt-extractor";
import { openPdfDocumentSession, type PdfDocumentSession } from "@/services/pdf-session";
import { computeFileSha256 } from "@/services/receipt-resolution";
import type { LoadedStatementSource } from "./statement-import-types";

const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/i;

const RASTER_STATEMENT_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".heif",
] as const;

/**
 * Sanitiza descrições para a Micro-IA com blindagem estrita de privacidade e anti-injeção:
 * remove quebras de linha, mascara PII, remove valores/datas, delimitadores JSX/JSON e limita a 80 chars.
 */
export function sanitizeDescriptionForStatementMicroAi(rawDescription: string): string {
  if (!rawDescription) return "";
  const singleLine = rawDescription.replace(/[\r\n\t\0]+/g, " ");
  const cleaned = sanitizeBatchDescriptionForAi(singleLine);
  const injectionFree = cleaned.replace(/[<>{}\\]+/g, " ");
  return injectionFree.replace(/\s+/g, " ").trim().slice(0, 80);
}

/** Gera SHA-256 hex determinístico de 64 chars para cache LGPD e anti-loop de reupload (D6). */
export async function computeDeterministicSha256Hex(
  baseKey: string,
  scope?: string | null,
): Promise<string | null> {
  const trimmedBase = baseKey.trim();
  if (!trimmedBase) return null;
  if (!scope && SHA256_HEX_REGEX.test(trimmedBase)) {
    return trimmedBase.toLowerCase();
  }
  const payload = scope ? `${trimmedBase}:${scope}` : trimmedBase;
  const hashed = await computeTextSha256(payload);
  return hashed && SHA256_HEX_REGEX.test(hashed) ? hashed.toLowerCase() : null;
}

export function isRasterStatementImage(file: File): boolean {
  const mime = file.type.trim().toLowerCase();
  if (mime.startsWith("image/") && mime !== "image/svg+xml") {
    return true;
  }
  const lower = file.name.trim().toLowerCase();
  return RASTER_STATEMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export async function isRasterStatementImageByContent(file: File): Promise<boolean> {
  if (isRasterStatementImage(file)) return true;
  try {
    const headBuffer = await file.slice(0, 32).arrayBuffer();
    return (
      detectFileKindFromBytes(new Uint8Array(headBuffer), file.name || file.type) === "image"
    );
  } catch {
    return false;
  }
}

export function isStructuredTabularFileName(
  fileNameOrType: string,
  content: string | ArrayBuffer,
): boolean {
  const lower = fileNameOrType.trim().toLowerCase();
  if (
    lower.endsWith(".csv") ||
    lower.endsWith(".tsv") ||
    lower.endsWith(".ofx") ||
    lower.endsWith(".qfx") ||
    isSpreadsheetOrHtmlFileName(lower)
  ) {
    return true;
  }
  if (typeof content === "string") {
    return /<OFX[\s>]|<STMTTRN[\s>]|^OFXHEADER\s*:/i.test(content.slice(0, 4096));
  }
  const detected = detectFileKindFromBytes(new Uint8Array(content), lower);
  return detected === "ofx" || detected === "xlsx" || detected === "html_or_xml_sheet";
}

export interface ReadStatementFileOptions {
  password?: string;
  cardId?: string;
  competenceMonth?: string;
  closingDay?: number | null;
  learnedBlueprints?: readonly StatementLayoutBlueprint[];
}

export async function readStatementFileContent(
  file: File,
  options?: ReadStatementFileOptions,
): Promise<LoadedStatementSource> {
  const buffer = await file.arrayBuffer();
  const detectedKind = detectFileKindFromBytes(
    new Uint8Array(buffer),
    file.name || file.type,
  );

  if (detectedKind === "unsupported_archive") {
    throw new Error(
      "Formato compactado não suportado. Envie uma fatura em PDF, imagem, CSV, OFX ou Excel (.xlsx/.xls).",
    );
  }

  if (detectedKind === "image") {
    return {
      kind: "image",
      file,
      sha256: await computeFileSha256(file),
      fileName: file.name,
    };
  }

  if (detectedKind === "pdf") {
    const sha256 = await computeFileSha256(file);
    let pdfSession: PdfDocumentSession | undefined;
    let pdfPageTexts: string[] = [];
    let fullText = "";
    let pdfTotalPages = 1;

    try {
      pdfSession = await openPdfDocumentSession({
        buffer,
        fileName: file.name,
        sha256,
        password: options?.password,
      });
      pdfPageTexts = await pdfSession.extractPageTexts();
      fullText = pdfPageTexts.join("\n");
      pdfTotalPages = pdfSession.getTotalPages();
    } catch (err: unknown) {
      await pdfSession?.dispose();
      if (err instanceof PdfPasswordProtectedError || isPdfPasswordProtectedError(err)) {
        throw new PdfPasswordProtectedError();
      }
      pdfSession = undefined;
    }

    const trimmedFullText = fullText.trim();
    const hasMonetaryToken = /(?:\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/.test(trimmedFullText);
    if (trimmedFullText.length < 100 || !hasMonetaryToken) {
      return {
        kind: "pdf_scanned",
        pdfSession,
        buffer,
        fileName: file.name,
        sha256,
        pdfPageTexts,
        pdfTotalPages,
        ...(trimmedFullText ? { fallbackRawText: trimmedFullText } : {}),
      };
    }

    const rawFullText = fullText;
    const pdfFingerprint = computeStatementFingerprint({
      rawText: rawFullText,
      fileKind: "pdf_text",
      fileName: file.name,
    });
    const matchedBlueprint = findBestStatementBlueprint({
      fingerprint: pdfFingerprint,
      learnedBlueprints: options?.learnedBlueprints ?? [],
      fileKind: "pdf_text",
    });

    const detectedOfficialTotalCents = extractPrintedStatementTotalCents(
      rawFullText,
      matchedBlueprint?.blueprint.pdfRules
        ? {
            totalLabels: matchedBlueprint.blueprint.pdfRules.totalLabels,
            ignoredTotalLabels: matchedBlueprint.blueprint.pdfRules.ignoredTotalLabels,
          }
        : undefined,
    );

    let spatialTransactions: StatementTransaction[] | undefined;
    let spatialRawEntries: RawExtractedEntry[] | undefined;
    let defaultSignHint: RawEntrySignHint | undefined;
    let checksumGate: ChecksumGateResult | undefined;
    let spatialLinesCount: number | undefined;
    let discardedMoneyLines: number | undefined;
    let spatialRawLines: string[] | undefined;
    let spatialLines: SpatialPdfLine[] | undefined;
    let effectiveText = rawFullText;

    if (options?.cardId && options?.competenceMonth && pdfSession) {
      try {
        const hints = matchedBlueprint
          ? toSpatialBlueprintHints(matchedBlueprint.blueprint)
          : undefined;
        const spatial = await pdfSession.extractSpatialPages({
          columnMode: hints?.columnMode,
        });
        spatialLines = spatial.lines;
        spatialLinesCount = spatial.lines.length;
        spatialRawLines = spatial.lines.map((l) => l.text);

        if (spatial.lines.length > 0) {
          const extracted = extractTransactionsFromSpatialLines(spatial.lines, {
            cardId: options.cardId,
            competenceMonth: options.competenceMonth,
            closingDay: options.closingDay,
            blueprintHints: hints,
          });
          discardedMoneyLines = extracted.discardedMoneyLines ?? 0;
          if (extracted.transactions.length > 0) {
            spatialTransactions = extracted.transactions;
            spatialRawEntries = extracted.entries;
            defaultSignHint = hints?.polarity ?? "auto";
            checksumGate = evaluateChecksumGate(
              extracted.transactions,
              detectedOfficialTotalCents,
            );
            if (extracted.reconstructedText) {
              effectiveText = extracted.reconstructedText;
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof PdfPasswordProtectedError || isPdfPasswordProtectedError(err)) {
          await pdfSession.dispose();
          throw new PdfPasswordProtectedError();
        }
      }
    }

    return {
      kind: "pdf_text",
      text: effectiveText,
      rawFullText,
      pdfSession,
      pdfPageTexts,
      pdfTotalPages,
      buffer,
      fileName: file.name,
      sha256,
      spatialTransactions,
      spatialRawEntries,
      defaultSignHint,
      checksumGate,
      spatialLinesCount,
      discardedMoneyLines,
      spatialRawLines,
      spatialLines,
      appliedBlueprintId: matchedBlueprint?.blueprint.cloudId,
      appliedBlueprintFingerprint: matchedBlueprint?.blueprint.fingerprint,
      appliedBlueprintOrigin: matchedBlueprint?.blueprint.origin,
    };
  }

  if (
    detectedKind === "xlsx" ||
    detectedKind === "xls_biff8" ||
    detectedKind === "html_or_xml_sheet"
  ) {
    return { kind: "spreadsheet", buffer, fileName: file.name };
  }

  return { kind: "binary_or_text", content: buffer, fileName: file.name };
}
