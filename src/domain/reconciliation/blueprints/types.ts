import { z } from "zod";
import type { SpatialBlueprintHints } from "../parsers/spatial-pdf-parser";

export const BlueprintOriginSchema = z.enum(["user_learned", "ai_learned", "builtin"]);
export type BlueprintOrigin = z.infer<typeof BlueprintOriginSchema>;

export const BlueprintFileKindSchema = z.enum(["pdf_text", "csv", "xlsx", "ofx", "text"]);
export type BlueprintFileKind = z.infer<typeof BlueprintFileKindSchema>;

export const BlueprintPolaritySchema = z.enum([
  "auto",
  "positive_purchase",
  "negative_purchase",
]);
export type BlueprintPolarity = z.infer<typeof BlueprintPolaritySchema>;

export const BlueprintDateFormatHintSchema = z.enum([
  "auto",
  "dd/mm",
  "dd/mm/yyyy",
  "dd_mmm",
  "iso",
]);
export type BlueprintDateFormatHint = z.infer<typeof BlueprintDateFormatHintSchema>;

export const BlueprintCurrencyStrategySchema = z.enum([
  "brl_rightmost",
  "brl_standard",
  "dot_decimal",
]);
export type BlueprintCurrencyStrategy = z.infer<typeof BlueprintCurrencyStrategySchema>;

export const BlueprintPdfRulesSchema = z.object({
  startMarkers: z.array(z.string().min(2).max(80)).max(20).default([]),
  pauseMarkers: z.array(z.string().min(2).max(80)).max(20).default([]),
  boletoMarkers: z.array(z.string().min(2).max(80)).max(15).default([]),
  totalLabels: z.array(z.string().min(2).max(80)).max(15).default([]),
  ignoredTotalLabels: z.array(z.string().min(2).max(80)).max(15).default([]),
  columnMode: z.enum(["auto", "single", "bimodal"]).default("auto"),
  strictStartZone: z.boolean().default(false),
  relativeXRanges: z
    .object({
      dateMaxX: z.number().min(0).max(1),
      amountMinX: z.number().min(0).max(1),
    })
    .optional(),
  requireExplicitDatePerLine: z.boolean().default(true),
});
export type BlueprintPdfRules = z.infer<typeof BlueprintPdfRulesSchema>;

export const BlueprintColumnMappingSchema = z.object({
  dateColIndex: z.number().int().min(0),
  descriptionColIndex: z.number().int().min(0),
  amountColIndex: z.number().int().min(0),
  typeColIndex: z.number().int().min(0).optional(),
  debitColIndex: z.number().int().min(0).optional(),
  creditColIndex: z.number().int().min(0).optional(),
  hasHeader: z.boolean(),
  startRowIndex: z.number().int().min(0),
});

export const BlueprintTabularRulesSchema = z.object({
  delimiter: z.enum([",", ";", "\t", "|"]).optional(),
  headerSignature: z.string().max(200).optional(),
  columnMapping: BlueprintColumnMappingSchema.optional(),
});
export type BlueprintTabularRules = z.infer<typeof BlueprintTabularRulesSchema>;

export const BlueprintStatsSchema = z.object({
  uses: z.number().int().min(0),
  exactChecksumHits: z.number().int().min(0),
  consecutiveFailures: z.number().int().min(0),
  updatedAt: z.string().min(1),
});
export type BlueprintStats = z.infer<typeof BlueprintStatsSchema>;

export const StatementLayoutBlueprintSchema = z.object({
  version: z.literal(1),
  fingerprint: z.string().min(3).max(140),
  issuerKey: z.string().min(2).max(60),
  issuerName: z.string().min(2).max(80),
  fileKind: BlueprintFileKindSchema,
  origin: BlueprintOriginSchema,
  pdfRules: BlueprintPdfRulesSchema.optional(),
  tabularRules: BlueprintTabularRulesSchema.optional(),
  polarity: BlueprintPolaritySchema.default("auto"),
  dateFormatHint: BlueprintDateFormatHintSchema.default("auto"),
  currencyStrategy: BlueprintCurrencyStrategySchema.default("brl_rightmost"),
  stats: BlueprintStatsSchema,
});
export type StatementLayoutBlueprint = z.infer<typeof StatementLayoutBlueprintSchema>;

export interface StatementFingerprintResult {
  /** Chave específica de layout: `<kind>:<issuerKey>:<headerTokensHash>`. */
  exactFingerprint: string;
  /** Chave de fallback por emissor (imune a mudanças promocionais entre meses): `<kind>:<issuerKey>`. */
  fallbackFingerprint: string;
  issuerKey: string;
  issuerName: string;
  headerTokensHash: string;
  structuralTokens: string[];
}

export interface MatchedBlueprintResult {
  blueprint: StatementLayoutBlueprint;
  matchLevel: "exact" | "issuer_fallback";
}

/**
 * Converte um `StatementLayoutBlueprint` em `SpatialBlueprintHints` para a Camada 1 (`spatial-pdf-parser.ts`).
 */
export function toSpatialBlueprintHints(
  blueprint: StatementLayoutBlueprint,
): SpatialBlueprintHints {
  return {
    startMarkers: blueprint.pdfRules?.startMarkers,
    pauseMarkers: blueprint.pdfRules?.pauseMarkers,
    boletoMarkers: blueprint.pdfRules?.boletoMarkers,
    totalLabels: blueprint.pdfRules?.totalLabels,
    ignoredTotalLabels: blueprint.pdfRules?.ignoredTotalLabels,
    columnMode: blueprint.pdfRules?.columnMode ?? "auto",
    strictStartZone: blueprint.pdfRules?.strictStartZone ?? false,
    polarity: blueprint.polarity,
  };
}
