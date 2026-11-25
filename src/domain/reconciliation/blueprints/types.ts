import { z } from "zod";
import type { SpatialBlueprintHints } from "../extractors/spatial-pdf-extractor";

export const BlueprintOriginSchema = z.enum([
  "user_verified",
  "global_active",
  "builtin",
  "user_learned",
  "ai_learned",
]);
export type BlueprintOrigin = z.infer<typeof BlueprintOriginSchema>;

export const BlueprintFileKindSchema = z.enum(["pdf_text", "csv", "xlsx", "ofx", "text"]);
export type BlueprintFileKind = z.infer<typeof BlueprintFileKindSchema>;

export const BlueprintPolaritySchema = z.enum([
  "auto",
  "positive_purchase",
  "negative_purchase",
]);
export type BlueprintPolarity = z.infer<typeof BlueprintPolaritySchema>;

function normalizeDateFormatHintInput(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  const v = raw.trim().toLowerCase();
  if (v === "dd/mm" || v === "dd/mm/yyyy" || v === "dmy") return "dmy";
  if (v === "dd_mmm" || v === "d_mmm") return "d_mmm";
  if (v === "iso" || v === "ymd") return "ymd";
  if (v === "auto") return "auto";
  return raw;
}

export const BlueprintDateFormatHintSchema = z.preprocess(
  normalizeDateFormatHintInput,
  z.enum(["auto", "dmy", "d_mmm", "ymd"]),
);
export type BlueprintDateFormatHint = z.infer<typeof BlueprintDateFormatHintSchema>;

export const BlueprintCurrencyStrategySchema = z.enum([
  "brl_rightmost",
  "brl_standard",
  "dot_decimal",
]);
export type BlueprintCurrencyStrategy = z.infer<typeof BlueprintCurrencyStrategySchema>;

/**
 * Marcador estrutural estritamente livre de PII, dígitos, e-mails ou URLs
 * (espelha `validate_statement_blueprint_rules_json` da migration 0156).
 */
export const StructuralMarkerSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .refine(
    (val) => !/[0-9@]/.test(val) && !/https?:\/\//i.test(val) && !/www\./i.test(val),
    "Marcador estrutural não pode conter dígitos, e-mail ou URL",
  );

export const BlueprintPdfRulesSchema = z.object({
  startMarkers: z.array(StructuralMarkerSchema).max(25).default([]),
  pauseMarkers: z.array(StructuralMarkerSchema).max(25).default([]),
  boletoMarkers: z.array(StructuralMarkerSchema).max(25).default([]),
  totalLabels: z.array(StructuralMarkerSchema).max(25).default([]),
  ignoredTotalLabels: z.array(StructuralMarkerSchema).max(25).default([]),
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
  cloudId: z.string().min(1).optional(),
  cloudScope: z.enum(["user", "global"]).optional(),
  cloudStatus: z.enum(["active", "suspended", "pending_review"]).optional(),
  distinctUsersVerified: z.number().int().min(0).optional(),
  distinctUsersFailed: z.number().int().min(0).optional(),
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
 * Contrato puro compatível com `StatementLayoutBlueprintRules` do Supabase (`migration 0156`).
 */
export interface CloudBlueprintRulesPayload {
  startMarkers: string[];
  pauseMarkers: string[];
  boletoMarkers: string[];
  totalLabels: string[];
  ignoredTotalLabels: string[];
  columnMode: "auto" | "single" | "bimodal";
  strictStartZone: boolean;
  polarity: "auto" | "positive_purchase" | "negative_purchase";
  dateFormatHint: "auto" | "dmy" | "d_mmm" | "ymd";
}

/**
 * Contrato estrutural compatível com `StatementLayoutBlueprintRow` sem importar `@/types`.
 */
export interface CloudBlueprintRowInput {
  id: string;
  fingerprint: string;
  issuer_key: string;
  issuer_name: string;
  file_kind: "pdf_text" | "text";
  scope: "user" | "global";
  status: "active" | "suspended" | "pending_review";
  rules_json: {
    startMarkers?: string[];
    pauseMarkers?: string[];
    boletoMarkers?: string[];
    totalLabels?: string[];
    ignoredTotalLabels?: string[];
    columnMode?: "auto" | "single" | "bimodal";
    strictStartZone?: boolean;
    polarity?: "auto" | "positive_purchase" | "negative_purchase";
    dateFormatHint?: "dmy" | "d_mmm" | "ymd" | "auto";
  };
  exact_checksum_hits: number;
  distinct_users_verified: number;
  distinct_users_failed: number;
  consecutive_failures: number;
  updated_at: string;
}

/**
 * Converte um `StatementLayoutBlueprint` em `SpatialBlueprintHints` para o extrator espacial.
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
    dateFormatHint: blueprint.dateFormatHint,
  };
}

/**
 * Serializa um `StatementLayoutBlueprint` para o formato `rules_json` validado pelo RPC na nuvem.
 */
export function toCloudBlueprintRules(
  blueprint: StatementLayoutBlueprint,
): CloudBlueprintRulesPayload {
  return {
    startMarkers: blueprint.pdfRules?.startMarkers ?? [],
    pauseMarkers: blueprint.pdfRules?.pauseMarkers ?? [],
    boletoMarkers: blueprint.pdfRules?.boletoMarkers ?? [],
    totalLabels: blueprint.pdfRules?.totalLabels ?? [],
    ignoredTotalLabels: blueprint.pdfRules?.ignoredTotalLabels ?? [],
    columnMode: blueprint.pdfRules?.columnMode ?? "auto",
    strictStartZone: blueprint.pdfRules?.strictStartZone ?? false,
    polarity: blueprint.polarity,
    dateFormatHint: blueprint.dateFormatHint,
  };
}

/**
 * Converte uma linha `statement_layout_blueprints` do Supabase em `StatementLayoutBlueprint` validado por Zod.
 */
export function fromCloudBlueprintRow(
  row: CloudBlueprintRowInput,
): StatementLayoutBlueprint | null {
  const parsed = StatementLayoutBlueprintSchema.safeParse({
    version: 1,
    fingerprint: row.fingerprint,
    issuerKey: row.issuer_key,
    issuerName: row.issuer_name,
    fileKind: row.file_kind,
    origin: row.scope === "global" ? "global_active" : "user_verified",
    pdfRules: {
      startMarkers: row.rules_json.startMarkers ?? [],
      pauseMarkers: row.rules_json.pauseMarkers ?? [],
      boletoMarkers: row.rules_json.boletoMarkers ?? [],
      totalLabels: row.rules_json.totalLabels ?? [],
      ignoredTotalLabels: row.rules_json.ignoredTotalLabels ?? [],
      columnMode: row.rules_json.columnMode ?? "auto",
      strictStartZone: row.rules_json.strictStartZone ?? false,
      requireExplicitDatePerLine: true,
    },
    polarity: row.rules_json.polarity ?? "positive_purchase",
    dateFormatHint: row.rules_json.dateFormatHint ?? "auto",
    currencyStrategy: "brl_rightmost",
    stats: {
      uses: Math.max(1, row.exact_checksum_hits),
      exactChecksumHits: row.exact_checksum_hits,
      consecutiveFailures: row.consecutive_failures,
      updatedAt: row.updated_at,
    },
    cloudId: row.id,
    cloudScope: row.scope,
    cloudStatus: row.status,
    distinctUsersVerified: row.distinct_users_verified,
    distinctUsersFailed: row.distinct_users_failed,
  });

  return parsed.success ? parsed.data : null;
}
