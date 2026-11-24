/**
 * Contratos compartilhados de borda, Hard Caps (Trava 3), Whitelist (Trava 5)
 * e utilitários LGPD/FinOps da camada de Micro-IA Híbrida.
 *
 * Compartilhado entre Edge Functions Deno (`supabase/functions/`) e cliente Vite/Vitest (`src/`).
 * Regra de blindagem: zero dependências externas além de `zod` e zero lógica matemática contábil.
 */

import { z } from "zod";

export const MAX_AI_IMAGE_BYTES = 500 * 1024; // 500 KB (Trava 3)
export const MAX_AI_SINGLE_RECEIPT_TEXT_CHARS = 8_000;
export const MAX_AI_STATEMENT_PDF_TEXT_CHARS = 25_000;
export const MAX_AI_CATEGORIZE_BATCH_ITEMS = 40;
export const MAX_AI_CATEGORIZE_DESCRIPTION_CHARS = 120;
export const MAX_AI_CATEGORIZE_CATEGORIES = 100;

export const AI_CACHE_TTL_DAYS: Record<AiMode, number> = {
  single_receipt: 30,
  statement_pdf_rows: 30,
  categorize_batch: 14,
  line_curator: 7,
};

/**
 * Remove eventuais cercas Markdown (```json ... ```) caso o modelo retorne JSON envelopado.
 */
export function stripJsonMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced && typeof fenced[1] === "string" ? fenced[1].trim() : trimmed;
}

/**
 * Verifica se uma entrada em `receipt_extractions_cache` ainda está dentro do TTL por modo.
 */
export function isAiCacheEntryFresh(
  createdAtIso: string | null | undefined,
  mode: AiMode,
  nowMs = Date.now(),
): boolean {
  if (!createdAtIso) return false;
  const createdMs = Date.parse(createdAtIso);
  if (!Number.isFinite(createdMs)) return false;
  const ttlMs = AI_CACHE_TTL_DAYS[mode] * 24 * 60 * 60 * 1000;
  return nowMs - createdMs <= ttlMs;
}

export type AiMode = "single_receipt" | "statement_pdf_rows" | "categorize_batch" | "line_curator";
export type AiQuotaBucket = "receipt_calls" | "batch_calls";
export type AiPlanGroup = "trial" | "pro";

export interface AiBucketLimit {
  month: number;
  day: number;
}

export const AI_QUOTA_LIMITS: Record<AiPlanGroup, Record<AiQuotaBucket, AiBucketLimit>> = {
  trial: {
    receipt_calls: { month: 15, day: 5 },
    batch_calls: { month: 5, day: 2 },
  },
  pro: {
    receipt_calls: { month: 100, day: 15 },
    batch_calls: { month: 20, day: 5 },
  },
};

export const AI_FALLBACK_REASONS = [
  "disabled",
  "quota_exceeded",
  "read_only",
  "offline",
  "timeout",
  "upstream_unavailable",
  "invalid_ai_output",
  "invalid_payload",
  "unauthenticated",
  "mode_not_enabled",
] as const;

export type AiFallbackReason = (typeof AI_FALLBACK_REASONS)[number];

export const AI_ALLOWED_PAYMENT_METHODS = [
  "cash",
  "debit",
  "credit_card",
  "pix",
  "transfer",
  "other",
] as const;

export const AI_ALLOWED_RECEIPT_KINDS = [
  "pix",
  "card_slip",
  "bank_slip_payment",
  "invoice_danfe",
  "wire_transfer",
  "generic",
] as const;

export const AI_ALLOWED_CONFIDENCE_LEVELS = ["high", "medium", "low"] as const;

export const AI_STATEMENT_ENTRY_TYPES = ["purchase", "refund", "payment", "charge"] as const;
export type AiStatementEntryType = (typeof AI_STATEMENT_ENTRY_TYPES)[number];

export const AI_SERVICE_SEGMENTS = [
  "streaming",
  "fitness",
  "cloud_ai",
  "telecom",
  "mobility",
  "delivery",
  "utilities",
  "health",
  "education",
  "other",
] as const;
export type AiServiceSegment = (typeof AI_SERVICE_SEGMENTS)[number];

export const AI_CUT_TIERS = ["essential", "discretionary", "can_cut"] as const;
export type AiCutTier = (typeof AI_CUT_TIERS)[number];

export type AiCallPriority = "active" | "passive";
export const PASSIVE_AI_DAILY_RESERVE = 2;

export function stripBase64DataPrefix(raw: string): string {
  const trimmed = raw.trim();
  const commaIdx = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && commaIdx !== -1) {
    return trimmed.slice(commaIdx + 1).trim();
  }
  return trimmed;
}

/**
 * Estima com exatidão o tamanho binário decodificado de uma string base64.
 */
export function estimateBase64ByteLength(rawBase64: string): number {
  const clean = stripBase64DataPrefix(rawBase64).replace(/\s+/g, "");
  if (!clean) return 0;
  let padding = 0;
  if (clean.endsWith("==")) padding = 2;
  else if (clean.endsWith("=")) padding = 1;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

export function isWithinImageByteCap(
  rawBase64: string,
  maxBytes = MAX_AI_IMAGE_BYTES,
): boolean {
  const byteLength = estimateBase64ByteLength(rawBase64);
  return byteLength > 0 && byteLength <= maxBytes;
}

function isValidCpfDigits(digits: string): boolean {
  if (!/^\d{11}$/.test(digits)) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i++) {
    sum1 += Number(digits[i]) * (10 - i);
  }
  const rem1 = (sum1 * 10) % 11;
  const dv1 = rem1 === 10 ? 0 : rem1;
  if (dv1 !== Number(digits[9])) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i++) {
    sum2 += Number(digits[i]) * (11 - i);
  }
  const rem2 = (sum2 * 10) % 11;
  const dv2 = rem2 === 10 ? 0 : rem2;
  return dv2 === Number(digits[10]);
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum > 0 && sum % 10 === 0;
}

/**
 * Mascara PII sensível (CPFs completos, agência/conta e PANs longos de cartão)
 * antes de enviar texto ao modelo de IA, preservando CNPJs de estabelecimentos e os
 * 4 últimos dígitos de cartão para conciliação.
 */
export function maskSensitivePiiForAi(rawText: string): string {
  if (!rawText) return "";

  let masked = rawText;

  // 1. CPFs formatados (000.000.000-00)
  masked = masked.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "[CPF_OCULTO]");

  // 2. CPFs sem pontuação (exige DV Módulo 11 válido; preserva CNPJs de 14 dígitos e códigos de barras)
  masked = masked.replace(/(?<!\d)(\d{11})(?!\d)/g, (match) =>
    isValidCpfDigits(match) ? "[CPF_OCULTO]" : match,
  );

  // 3. Agência e Conta combinadas na mesma expressão
  masked = masked.replace(
    /\b(?:ag[êe]ncia|ag\.?)\s*[:#-]?\s*\d{3,5}(?:\s*-\s*[\dxX])?\s*(?:[,;/|-]|\s+)?\s*(?:conta(?:\s+(?:corrente|poupan[çc]a|pagamento|sal[áa]rio))?|c\/?c|cp|cta)\s*[:#-]?\s*\d{4,12}(?:\s*-\s*[\dxX])?/gi,
    "[CONTA_OCULTA]",
  );

  // 4. Rótulos isolados de Agência ou Conta com número
  masked = masked.replace(
    /\b(ag[êe]ncia|ag\.?)\s*[:#-]\s*\d{3,5}(?:\s*-\s*[\dxX])?\b/gi,
    "$1: [CONTA_OCULTA]",
  );
  masked = masked.replace(
    /\b(conta(?:\s+(?:corrente|poupan[çc]a|pagamento|sal[áa]rio))?|c\/?c)\s*[:#-]\s*\d{4,12}(?:\s*-\s*[\dxX])?\b/gi,
    "$1: [CONTA_OCULTA]",
  );

  // 5. PANs completos de cartão agrupados (4x4) mantendo apenas os últimos 4 dígitos
  masked = masked.replace(
    /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-](\d{4})\b/g,
    "**** $1",
  );

  // 6. PANs corridos de 15–19 dígitos aprovados em Luhn (jamais corrompe CNPJ 14 dígitos nem código de barras 44+)
  masked = masked.replace(/(?<!\d)(\d{15,19})(?!\d)/g, (match) =>
    passesLuhn(match) ? `**** ${match.slice(-4)}` : match,
  );

  return masked;
}

/**
 * Higieniza uma descrição de transação de fatura para envio ao modo `categorize_batch` (Trava 5):
 * remove PII sensível, cifras monetárias, datas e normaliza para no máximo 120 caracteres.
 */
export function sanitizeBatchDescriptionForAi(rawDescription: string): string {
  if (!rawDescription) return "";
  let cleaned = maskSensitivePiiForAi(rawDescription);
  // Remove valores monetários isolados (R$ 123,45 / BRL 45.00)
  cleaned = cleaned.replace(/(?:R\$|BRL)\s*-?\d[\d.,]*/gi, " ");
  // Remove datas DD/MM, DD/MM/YYYY, YYYY-MM-DD
  cleaned = cleaned.replace(/\b\d{4}[/-]\d{2}[/-]\d{2}\b/g, " ");
  cleaned = cleaned.replace(/\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/g, " ");
  cleaned = cleaned.replace(/\s+/g, " ").trim();
  return cleaned.slice(0, MAX_AI_CATEGORIZE_DESCRIPTION_CHARS).trim();
}

export interface BrtQuotaPeriods {
  periodMonth: string; // YYYY-MM
  periodDay: string; // YYYY-MM-DD
  nextDayResetAtIso: string; // YYYY-MM-DDT00:00:00-03:00
  nextMonthResetAtIso: string; // YYYY-MM-01T00:00:00-03:00
}

/**
 * Calcula `period_month`, `period_day` e os próximos marcos de reset às 00:00 BRT (`America/Sao_Paulo`).
 */
export function getBrtQuotaPeriods(now = new Date()): BrtQuotaPeriods {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const periodDay = formatter.format(now); // en-CA sempre formata YYYY-MM-DD
  const parts = periodDay.split("-");
  const year = Number(parts[0] ?? 2026);
  const month = Number(parts[1] ?? 1);
  const day = Number(parts[2] ?? 1);

  const periodMonth = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;

  const nextDayDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayStr = `${nextDayDate.getUTCFullYear()}-${String(
    nextDayDate.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(nextDayDate.getUTCDate()).padStart(2, "0")}`;

  const nextMonthDate = new Date(Date.UTC(year, month, 1));
  const nextMonthStr = `${nextMonthDate.getUTCFullYear()}-${String(
    nextMonthDate.getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;

  return {
    periodMonth,
    periodDay,
    nextDayResetAtIso: `${nextDayStr}T00:00:00-03:00`,
    nextMonthResetAtIso: `${nextMonthStr}T00:00:00-03:00`,
  };
}

export interface UserAiQuotaRowSnapshot {
  period_day: string;
  receipt_calls_month: number;
  receipt_calls_day: number;
  batch_calls_month: number;
  batch_calls_day: number;
}

export type AiQuotaEvaluation =
  | {
      allowed: true;
      usedDay: number;
      usedMonth: number;
      remainingDay: number;
      remainingMonth: number;
    }
  | {
      allowed: false;
      limitScope: "day" | "month";
      usedDay: number;
      usedMonth: number;
      resetAt: string;
    };

/**
 * Pré-checagem de cota considerando `0` para contadores diários quando `period_day !== todayBrt`
 * (Ajuste #3 do Plano Mestre).
 */
export function evaluateAiQuotaAllowance(params: {
  planGroup: AiPlanGroup;
  bucket: AiQuotaBucket;
  row: UserAiQuotaRowSnapshot | null;
  todayBrt: string;
  nextDayResetAtIso: string;
  nextMonthResetAtIso: string;
  priority?: AiCallPriority;
}): AiQuotaEvaluation {
  const limits = AI_QUOTA_LIMITS[params.planGroup][params.bucket];
  const row = params.row;
  const isSameDay = Boolean(row && row.period_day === params.todayBrt);
  const priority: AiCallPriority = params.priority ?? "active";
  const reserve =
    priority === "passive" ? (limits.day <= 2 ? 1 : PASSIVE_AI_DAILY_RESERVE) : 0;
  const effectiveDailyLimit = Math.max(1, limits.day - reserve);

  const usedMonth = row
    ? params.bucket === "receipt_calls"
      ? row.receipt_calls_month
      : row.batch_calls_month
    : 0;

  const usedDay =
    row && isSameDay
      ? params.bucket === "receipt_calls"
        ? row.receipt_calls_day
        : row.batch_calls_day
      : 0;

  if (usedMonth >= limits.month) {
    return {
      allowed: false,
      limitScope: "month",
      usedDay,
      usedMonth,
      resetAt: params.nextMonthResetAtIso,
    };
  }

  if (usedDay >= effectiveDailyLimit) {
    return {
      allowed: false,
      limitScope: "day",
      usedDay,
      usedMonth,
      resetAt: params.nextDayResetAtIso,
    };
  }

  return {
    allowed: true,
    usedDay,
    usedMonth,
    remainingDay: effectiveDailyLimit - usedDay,
    remainingMonth: limits.month - usedMonth,
  };
}

export const Sha256HexSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{64}$/, "sha256 deve conter 64 caracteres hexadecimais minúsculos.");

export const AiSingleReceiptRequestSchema = z
  .object({
    mode: z.literal("single_receipt"),
    sha256: Sha256HexSchema,
    text: z
      .string()
      .max(MAX_AI_SINGLE_RECEIPT_TEXT_CHARS, "Texto do comprovante excede 8.000 caracteres.")
      .optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.enum(["image/jpeg", "image/webp", "image/png"]).optional(),
    userFullName: z.string().trim().max(120).optional(),
    categories: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          name: z.string().trim().min(1).max(80),
          type: z.enum(["expense", "income"]).optional(),
        }),
      )
      .max(MAX_AI_CATEGORIZE_CATEGORIES)
      .optional(),
  })
  .superRefine((val, ctx) => {
    const hasText = Boolean(val.text && val.text.trim().length > 0);
    const hasImage = Boolean(val.imageBase64 && val.imageBase64.trim().length > 0);
    if (!hasText && !hasImage) {
      ctx.addIssue({
        code: "custom",
        message: "Informe texto extraído ou imageBase64 para análise.",
      });
    }
    if (hasImage && val.imageBase64) {
      if (!isWithinImageByteCap(val.imageBase64, MAX_AI_IMAGE_BYTES)) {
        ctx.addIssue({
          code: "custom",
          path: ["imageBase64"],
          message: "Imagem comprimida excede o teto estrito de 500 KB.",
        });
      }
    }
  });

export const AiStatementPdfRowsRequestSchema = z
  .object({
    mode: z.literal("statement_pdf_rows"),
    sha256: Sha256HexSchema,
    text: z
      .string()
      .max(MAX_AI_STATEMENT_PDF_TEXT_CHARS, "Texto da fatura excede 25.000 caracteres.")
      .optional(),
    imageBase64: z.string().optional(),
    imageMimeType: z.enum(["image/jpeg", "image/webp", "image/png"]).optional(),
    referenceYear: z.number().int().min(2020).max(2100).optional(),
    competenceMonth: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  })
  .superRefine((val, ctx) => {
    const hasText = Boolean(val.text && val.text.trim().length > 0);
    const hasImage = Boolean(val.imageBase64 && val.imageBase64.trim().length > 0);
    if (!hasText && !hasImage) {
      ctx.addIssue({
        code: "custom",
        message: "Informe texto da fatura ou imageBase64 para análise.",
      });
    }
    if (hasImage && val.imageBase64) {
      if (!isWithinImageByteCap(val.imageBase64, MAX_AI_IMAGE_BYTES)) {
        ctx.addIssue({
          code: "custom",
          path: ["imageBase64"],
          message: "Imagem comprimida da fatura excede o teto estrito de 500 KB.",
        });
      }
    }
  });

export const AiCategorizeBatchRequestSchema = z.object({
  mode: z.literal("categorize_batch"),
  sha256: Sha256HexSchema,
  priority: z.enum(["active", "passive"]).optional(),
  descriptions: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(
          MAX_AI_CATEGORIZE_DESCRIPTION_CHARS,
          "Cada descrição deve ter no máximo 120 caracteres.",
        ),
    )
    .min(1)
    .max(MAX_AI_CATEGORIZE_BATCH_ITEMS, "Lote limitado a 40 descrições por chamada."),
  categories: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        name: z.string().trim().min(1).max(80),
      }),
    )
    .min(1)
    .max(MAX_AI_CATEGORIZE_CATEGORIES),
});

export const MAX_AI_LINE_CURATOR_LINES = 500;
export const MAX_AI_LINE_CURATOR_TEXT_CHARS = 300;

export const AiLineCuratorLineSchema = z.object({
  id: z.number().int(),
  text: z.string().trim().min(1).max(MAX_AI_LINE_CURATOR_TEXT_CHARS),
});

export const AiLineCuratorRequestSchema = z.object({
  mode: z.literal("line_curator"),
  sha256: Sha256HexSchema,
  lines: z.array(AiLineCuratorLineSchema).min(1).max(MAX_AI_LINE_CURATOR_LINES),
  targetTotalCents: z.number().int().min(1).optional(),
});

export const AiAssistantRequestSchema = z.discriminatedUnion("mode", [
  AiSingleReceiptRequestSchema,
  AiStatementPdfRowsRequestSchema,
  AiCategorizeBatchRequestSchema,
  AiLineCuratorRequestSchema,
]);

export type AiAssistantRequest = z.infer<typeof AiAssistantRequestSchema>;

const ConfidenceLevelSchema = z.enum(AI_ALLOWED_CONFIDENCE_LEVELS);

export const AiSingleReceiptOutputSchema = z.object({
  amountCents: z.number().int().min(1).max(999_999_999),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  nature: z.enum(["expense", "income"]),
  paymentMethod: z.enum(AI_ALLOWED_PAYMENT_METHODS),
  receiptKind: z.enum(AI_ALLOWED_RECEIPT_KINDS),
  description: z.string().trim().min(1).max(160),
  merchantOrBeneficiary: z.string().trim().max(120).nullable().optional(),
  merchantCnpj: z
    .string()
    .regex(/^\d{14}$/)
    .nullable()
    .optional(),
  payerOrSource: z.string().trim().max(120).nullable().optional(),
  bankName: z.string().trim().max(80).nullable().optional(),
  cardLastDigits: z
    .string()
    .regex(/^\d{4}$/)
    .nullable()
    .optional(),
  cardBrand: z.string().trim().max(40).nullable().optional(),
  installmentsCount: z.number().int().min(1).max(60).nullable().optional(),
  isSameTitularity: z.boolean().nullable().optional(),
  categoryId: z.string().trim().min(1).max(80).nullable().optional(),
  originalCurrency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .nullable()
    .optional(),
  originalAmountCents: z.number().int().min(1).max(999_999_999).nullable().optional(),
  semanticTags: z.array(z.string().trim().min(1).max(30)).max(5).nullable().optional(),
  inferredScope: z.enum(["personal", "business"]).nullable().optional(),
  isTaxDeductible: z.boolean().nullable().optional(),
  confidence: ConfidenceLevelSchema,
  fieldConfidence: z
    .object({
      amount: ConfidenceLevelSchema,
      counterparty: ConfidenceLevelSchema,
      nature: ConfidenceLevelSchema,
      date: ConfidenceLevelSchema,
    })
    .nullable()
    .optional(),
});

export type AiSingleReceiptOutput = z.infer<typeof AiSingleReceiptOutputSchema>;

/**
 * Normaliza campos opcionais/formatáveis retornados pelo LLM antes da validação Zod estrita,
 * preservando integralmente a exigência de `amountCents` inteiro válido (nunca arredonda float).
 */
export function normalizeSingleReceiptAiPayload(
  raw: unknown,
  allowedCategoryIds?: ReadonlySet<string>,
): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const clone: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  if (typeof clone.date === "string") {
    const trimmed = clone.date.trim();
    if (!trimmed) {
      clone.date = null;
    } else if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      clone.date = trimmed.slice(0, 10);
    } else {
      clone.date = null;
    }
  }

  if (typeof clone.cardLastDigits === "string") {
    const digits = clone.cardLastDigits.replace(/\D/g, "");
    clone.cardLastDigits = digits.length >= 4 ? digits.slice(-4) : null;
  }

  if (typeof clone.merchantCnpj === "string") {
    const cnpjDigits = clone.merchantCnpj.replace(/\D/g, "");
    clone.merchantCnpj = cnpjDigits.length === 14 ? cnpjDigits : null;
  }

  if (typeof clone.originalCurrency === "string") {
    const iso = clone.originalCurrency.trim().toUpperCase();
    clone.originalCurrency = /^[A-Z]{3}$/.test(iso) && iso !== "BRL" ? iso : null;
  }

  if (typeof clone.originalAmountCents === "number") {
    if (
      !Number.isInteger(clone.originalAmountCents) ||
      clone.originalAmountCents < 1 ||
      clone.originalAmountCents > 999_999_999
    ) {
      clone.originalAmountCents = null;
    }
  }

  if (Array.isArray(clone.semanticTags)) {
    const cleanTags = clone.semanticTags
      .filter((t): t is string => typeof t === "string")
      .map((t) => t.trim().toLowerCase().slice(0, 30))
      .filter(Boolean)
      .slice(0, 5);
    clone.semanticTags = cleanTags.length > 0 ? Array.from(new Set(cleanTags)) : null;
  }

  if (typeof clone.categoryId === "string") {
    clone.categoryId = clone.categoryId.trim() || null;
  }
  if (
    allowedCategoryIds &&
    allowedCategoryIds.size > 0 &&
    typeof clone.categoryId === "string" &&
    !allowedCategoryIds.has(clone.categoryId)
  ) {
    clone.categoryId = null;
  }

  if (typeof clone.installmentsCount === "number") {
    if (
      !Number.isFinite(clone.installmentsCount) ||
      clone.installmentsCount < 1 ||
      clone.installmentsCount > 60
    ) {
      clone.installmentsCount = null;
    }
  }

  if (typeof clone.description === "string") {
    clone.description = clone.description.trim().slice(0, 160);
  }

  if (typeof clone.inferredScope === "string") {
    const norm = clone.inferredScope.trim().toLowerCase();
    clone.inferredScope = norm === "business" || norm === "personal" ? norm : null;
  } else if (clone.inferredScope !== null && clone.inferredScope !== undefined) {
    clone.inferredScope = null;
  }

  if (typeof clone.isTaxDeductible !== "boolean") {
    if (clone.isTaxDeductible === "true") clone.isTaxDeductible = true;
    else if (clone.isTaxDeductible === "false") clone.isTaxDeductible = false;
    else if (clone.isTaxDeductible !== null && clone.isTaxDeductible !== undefined) {
      clone.isTaxDeductible = null;
    }
  }

  const optionalTextCaps = [
    ["merchantOrBeneficiary", 120],
    ["payerOrSource", 120],
    ["bankName", 80],
    ["cardBrand", 40],
  ] as const;

  for (const [field, maxLen] of optionalTextCaps) {
    if (typeof clone[field] === "string") {
      clone[field] = (clone[field] as string).trim().slice(0, maxLen) || null;
    }
  }

  return clone;
}

export const AiStatementPdfRowSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().trim().min(1).max(160),
  amountCents: z.number().int().refine((n) => n !== 0, "amountCents não pode ser zero."),
  installmentCurrent: z.number().int().min(1).max(60).nullable().optional(),
  installmentTotal: z.number().int().min(1).max(60).nullable().optional(),
  entryType: z.enum(AI_STATEMENT_ENTRY_TYPES).nullable().optional(),
});

export const AiStatementPdfRowsOutputSchema = z.object({
  rows: z.array(AiStatementPdfRowSchema).max(400),
  detectedCompetenceMonth: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  detectedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  detectedCardLast4: z.string().regex(/^\d{4}$/).nullable().optional(),
  detectedCardBrandOrBank: z.string().trim().max(80).nullable().optional(),
  detectedTotalInvoiceCents: z.number().int().min(1).nullable().optional(),
});

export type AiStatementPdfRow = z.infer<typeof AiStatementPdfRowSchema>;
export type AiStatementPdfRowsOutput = z.infer<typeof AiStatementPdfRowsOutputSchema>;

/**
 * Normaliza linhas retornadas pelo LLM para faturas (`statement_pdf_rows`):
 * - Descarta linhas zeradas (`amountCents === 0`, ex.: isenção de anuidade R$ 0,00) sem invalidar o lote;
 * - Preserva float sem arredondar (para rejeição estrita pelo Zod);
 * - Higieniza datas ISO, parcelas (1/1 ou 0 -> null) e sinal coerente com `entryType`.
 */
export function normalizeStatementPdfRowsAiPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.rows)) {
    return raw;
  }

  const allowedTypes = new Set<string>(AI_STATEMENT_ENTRY_TYPES);
  const normalizedRows: unknown[] = [];

  for (const item of record.rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      normalizedRows.push(item);
      continue;
    }

    const row: Record<string, unknown> = { ...(item as Record<string, unknown>) };
    if (row.amountCents === 0) {
      continue;
    }

    if (typeof row.date === "string") {
      const trimmedDate = row.date.trim();
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmedDate)) {
        row.date = trimmedDate.slice(0, 10);
      }
    }

    if (typeof row.description === "string") {
      row.description = row.description.trim().slice(0, 160);
    }

    const cur = row.installmentCurrent;
    const tot = row.installmentTotal;
    const validInstallment =
      typeof cur === "number" &&
      typeof tot === "number" &&
      Number.isInteger(cur) &&
      Number.isInteger(tot) &&
      cur >= 1 &&
      tot >= 2 &&
      cur <= tot &&
      tot <= 60;

    if (!validInstallment) {
      row.installmentCurrent = null;
      row.installmentTotal = null;
    }

    const rawEntryType = typeof row.entryType === "string" ? row.entryType.trim() : "";
    const entryType = allowedTypes.has(rawEntryType) ? rawEntryType : null;
    row.entryType = entryType;

    if (
      (entryType === "refund" || entryType === "payment") &&
      typeof row.amountCents === "number" &&
      Number.isInteger(row.amountCents) &&
      row.amountCents > 0
    ) {
      row.amountCents = -row.amountCents;
    }

    normalizedRows.push(row);
  }

  let detectedCompetenceMonth: string | null = null;
  if (typeof record.detectedCompetenceMonth === "string") {
    const trimmedComp = record.detectedCompetenceMonth.trim();
    if (/^\d{4}-\d{2}$/.test(trimmedComp)) {
      detectedCompetenceMonth = trimmedComp;
    } else if (/^(0[1-9]|1[0-2])[/-](\d{4})$/.test(trimmedComp)) {
      const match = /^(0[1-9]|1[0-2])[/-](\d{4})$/.exec(trimmedComp);
      if (match && match[1] && match[2]) {
        detectedCompetenceMonth = `${match[2]}-${match[1]}`;
      }
    }
  }

  let detectedDueDate: string | null = null;
  if (typeof record.detectedDueDate === "string") {
    const trimmedDue = record.detectedDueDate.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDue)) {
      detectedDueDate = trimmedDue;
    } else if (/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.test(trimmedDue)) {
      const dMatch = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(trimmedDue);
      if (dMatch && dMatch[1] && dMatch[2] && dMatch[3]) {
        detectedDueDate = `${dMatch[3]}-${dMatch[2].padStart(2, "0")}-${dMatch[1].padStart(2, "0")}`;
      }
    }
  }

  let detectedCardLast4: string | null = null;
  if (typeof record.detectedCardLast4 === "string") {
    const digits = record.detectedCardLast4.replace(/\D/g, "");
    if (digits.length === 4) {
      detectedCardLast4 = digits;
    }
  }

  let detectedCardBrandOrBank: string | null = null;
  if (typeof record.detectedCardBrandOrBank === "string") {
    const brand = record.detectedCardBrandOrBank.trim().slice(0, 80);
    detectedCardBrandOrBank = brand.length > 0 ? brand : null;
  }

  let detectedTotalInvoiceCents: number | null = null;
  if (
    typeof record.detectedTotalInvoiceCents === "number" &&
    Number.isInteger(record.detectedTotalInvoiceCents) &&
    record.detectedTotalInvoiceCents > 0
  ) {
    detectedTotalInvoiceCents = record.detectedTotalInvoiceCents;
  }

  return {
    ...record,
    rows: normalizedRows,
    detectedCompetenceMonth,
    detectedDueDate,
    detectedCardLast4,
    detectedCardBrandOrBank,
    detectedTotalInvoiceCents,
  };
}

export const AiCategorizeBatchItemOutputSchema = z.object({
  index: z.number().int().min(0).max(MAX_AI_CATEGORIZE_BATCH_ITEMS - 1),
  friendlyName: z.string().trim().min(1).max(120),
  categoryId: z.string().trim().min(1).max(80).nullable(),
  canonicalMerchant: z.string().trim().min(1).max(80).nullable().optional(),
  serviceSegment: z.enum(AI_SERVICE_SEGMENTS).nullable().optional(),
  cutTier: z.enum(AI_CUT_TIERS).nullable().optional(),
  isSubscription: z.boolean().nullable().optional(),
  semanticTags: z.array(z.string().trim().min(1).max(30)).max(5).nullable().optional(),
});

export const AiCategorizeBatchOutputSchema = z.object({
  items: z.array(AiCategorizeBatchItemOutputSchema).max(MAX_AI_CATEGORIZE_BATCH_ITEMS),
});

export type AiCategorizeBatchOutput = z.infer<typeof AiCategorizeBatchOutputSchema>;

/**
 * Higieniza campos semânticos opcionais do lote sem invalidar classificações válidas.
 */
export function normalizeCategorizeBatchAiPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return raw;
  }

  const record = raw as Record<string, unknown>;
  if (!Array.isArray(record.items)) {
    return raw;
  }

  const allowedSegments = new Set<string>(AI_SERVICE_SEGMENTS);
  const allowedCutTiers = new Set<string>(AI_CUT_TIERS);

  const normalizedItems = record.items.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return item;
    }

    const row: Record<string, unknown> = { ...(item as Record<string, unknown>) };

    if ("canonicalMerchant" in row) {
      row.canonicalMerchant =
        typeof row.canonicalMerchant === "string"
          ? row.canonicalMerchant.trim().slice(0, 80) || null
          : null;
    }

    if ("serviceSegment" in row) {
      const seg = typeof row.serviceSegment === "string" ? row.serviceSegment.trim() : "";
      row.serviceSegment = allowedSegments.has(seg) ? seg : null;
    }

    if ("cutTier" in row) {
      const tier = typeof row.cutTier === "string" ? row.cutTier.trim() : "";
      row.cutTier = allowedCutTiers.has(tier) ? tier : null;
    }

    if ("isSubscription" in row) {
      row.isSubscription = typeof row.isSubscription === "boolean" ? row.isSubscription : null;
    }

    if ("semanticTags" in row) {
      if (Array.isArray(row.semanticTags)) {
        const cleanTags = row.semanticTags
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim().toLowerCase().slice(0, 30))
          .filter(Boolean)
          .slice(0, 5);
        row.semanticTags = cleanTags.length > 0 ? Array.from(new Set(cleanTags)) : null;
      } else {
        row.semanticTags = null;
      }
    }

    return row;
  });

  return { ...record, items: normalizedItems };
}

/**
 * Valida o output do lote garantindo pela Trava 5 que nenhum `categoryId` inventado
 * pelo LLM passe para a UI/aprendizado (somente `null` ou ID estritamente presente na whitelist),
 * nem índices fora do intervalo `[0, maxIndex]` ou duplicados.
 */
export function validateCategorizeBatchOutput(
  raw: unknown,
  allowedCategoryIds: ReadonlySet<string>,
  maxIndex?: number,
): { success: true; data: AiCategorizeBatchOutput } | { success: false } {
  const seenIndices = new Set<number>();
  const checkedSchema = AiCategorizeBatchOutputSchema.superRefine((val, ctx) => {
    for (let i = 0; i < val.items.length; i++) {
      const item = val.items[i];
      if (!item) continue;
      if (maxIndex !== undefined && item.index > maxIndex) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "index"],
          message: "Índice retornado excede o tamanho do lote enviado.",
        });
      }
      if (seenIndices.has(item.index)) {
        ctx.addIssue({
          code: "custom",
          path: ["items", i, "index"],
          message: "Índice duplicado retornado pelo lote.",
        });
      } else {
        seenIndices.add(item.index);
      }
      if (item.categoryId !== null && item.categoryId !== undefined) {
        if (!allowedCategoryIds.has(item.categoryId)) {
          ctx.addIssue({
            code: "custom",
            path: ["items", i, "categoryId"],
            message: "categoryId fora da whitelist enviada pelo cliente.",
          });
        }
      }
    }
  });

  const parsed = checkedSchema.safeParse(normalizeCategorizeBatchAiPayload(raw));
  if (!parsed.success) {
    return { success: false };
  }
  return { success: true, data: parsed.data };
}

export const AiLineCuratorOutputSchema = z.object({
  keep: z.array(z.number().int()),
  ignore: z.array(z.number().int()),
  reasons: z.record(z.string(), z.string()).optional(),
});

export type AiLineCuratorOutput = z.infer<typeof AiLineCuratorOutputSchema>;

/**
 * Valida rigorosamente a resposta do curador por ID contra os IDs de entrada:
 * - Descarta IDs inexistentes no payload original (zero alucinação);
 * - Deduplica IDs mantidos e ignorados;
 * - Preserva IDs não classificados em keep (fail-safe defensivo).
 */
export function validateLineCuratorOutput(
  raw: unknown,
  validIds: ReadonlySet<number>,
): { success: true; data: AiLineCuratorOutput } | { success: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { success: false, error: "invalid_line_curator_output_not_object" };
  }
  const parsed = AiLineCuratorOutputSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: "invalid_line_curator_schema" };
  }

  const keep = Array.from(new Set(parsed.data.keep.filter((id) => validIds.has(id))));
  const ignore = Array.from(new Set(parsed.data.ignore.filter((id) => validIds.has(id))));

  // Se algum ID válido foi omitido pela IA, mantém no keep por segurança contábil
  for (const id of validIds) {
    if (!keep.includes(id) && !ignore.includes(id)) {
      keep.push(id);
    }
  }

  return {
    success: true,
    data: {
      keep,
      ignore,
      reasons: parsed.data.reasons,
    },
  };
}

export type AiAssistantResponseBody =
  | {
      ok: true;
      mode: "single_receipt";
      cached: boolean;
      source: "cache_remote" | "ai_text" | "ai_vision";
      data: AiSingleReceiptOutput;
    }
  | {
      ok: true;
      mode: "statement_pdf_rows";
      cached: boolean;
      source: "cache_remote" | "ai_text" | "ai_vision";
      data: AiStatementPdfRowsOutput;
    }
  | {
      ok: true;
      mode: "categorize_batch";
      cached: boolean;
      source: "cache_remote" | "ai_text";
      data: AiCategorizeBatchOutput;
    }
  | {
      ok: true;
      mode: "line_curator";
      cached: boolean;
      source: "cache_remote" | "ai_text";
      data: AiLineCuratorOutput;
    }
  | {
      ok: false;
      reason: AiFallbackReason;
      fallbackToLocal: true;
      quotaResetAt?: string;
    };
