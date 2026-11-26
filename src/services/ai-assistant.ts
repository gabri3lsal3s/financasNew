/**
 * Cliente HTTP fino de Micro-IA Híbrida (`ai-financial-assistant`) — Fases D e E.
 *
 * Regras de engenharia e FinOps:
 * - Zero SDK pesado no frontend: utiliza `fetch` nativo + `AbortController` (timeout 22s para retry/fallback).
 * - Deduplicação de chamadas concorrentes por `(userId, mode, sha256)` via `inFlightBySha256` (Trava 4 / Ajuste #4).
 * - Checagem síncrona de offline (`navigator.onLine === false`), `isReadOnlyMode` e kill-switch antes de rede.
 * - Mascaramento PII / higienização (Trava 5) e compressão Vision (1024px @ 0.72, <= 500 KB) no cliente.
 * - Pós-validação estrita via Zod e Whitelist de categorias no retorno antes de aceitar qualquer sugestão.
 */

import { toISODate } from "@/domain/money/parcelar";
import type { UniversalReceiptData } from "@/domain/notifications";
import { getSupabase } from "@/data/client";
import { getSupabaseEnv } from "@/lib/env";
import { computeSha256Hex } from "@/services/sha256-fallback";
import {
  AI_FALLBACK_REASONS,
  AiSingleReceiptOutputSchema,
  AiStatementPdfRowsOutputSchema,
  isWithinImageByteCap,
  maskSensitivePiiForAi,
  MAX_AI_CATEGORIZE_BATCH_ITEMS,
  MAX_AI_CATEGORIZE_CATEGORIES,
  MAX_AI_CATEGORIZE_DESCRIPTION_CHARS,
  MAX_AI_IMAGE_BYTES,
  MAX_AI_SINGLE_RECEIPT_TEXT_CHARS,
  MAX_AI_STATEMENT_PDF_TEXT_CHARS,
  normalizeSingleReceiptAiPayload,
  normalizeStatementPdfRowsAiPayload,
  sanitizeBatchDescriptionForAi,
  Sha256HexSchema,
  validateCategorizeBatchOutput,
  type AiCategorizeBatchOutput,
  type AiFallbackReason,
  type AiSingleReceiptOutput,
  type AiStatementPdfRowsOutput,
} from "../../supabase/functions/_shared/ai-schemas";

export const CLIENT_AI_TIMEOUT_MS = 22_000;
export const CLIENT_AI_BATCH_TIMEOUT_MS = 4_000;
const AI_VISION_MAX_DIMENSION = 960;
const AI_VISION_DEFAULT_QUALITY = 0.70;
const AI_VISION_FALLBACK_QUALITY = 0.55;
const AI_VISION_RETRY_MAX_DIMENSION = 768;
const AI_VISION_RETRY_QUALITY = 0.6;
const MIN_AI_TEXT_LENGTH = 20;

export type AiSingleReceiptSource = "cache_remote" | "ai_text" | "ai_vision";

export interface AiCategoryOptionInput {
  id: string;
  name: string;
  type?: "expense" | "income";
}

export interface AiClientBaseGuards {
  userId?: string | null;
  isReadOnlyMode?: boolean;
  featureEnabled?: boolean;
  signal?: AbortSignal;
}

export interface ExtractSingleReceiptAiParams extends AiClientBaseGuards {
  sha256: string;
  text?: string;
  imageBlob?: Blob;
  pdfFile?: File;
  preferVision?: boolean;
  userFullName?: string | null;
  categories?: readonly AiCategoryOptionInput[];
}

export type AiFallbackResult = {
  ok: false;
  reason: AiFallbackReason;
  fallbackToLocal: true;
  quotaResetAt?: string;
};

export type AiSingleReceiptClientResult =
  | {
      ok: true;
      cached: boolean;
      source: AiSingleReceiptSource;
      data: AiSingleReceiptOutput;
    }
  | AiFallbackResult;

export interface CategorizeBatchAiParams extends AiClientBaseGuards {
  sha256?: string;
  priority?: "active" | "passive";
  descriptions: readonly string[];
  categories: readonly { id: string; name: string }[];
}

export type CategorizeBatchClientResult =
  | {
      ok: true;
      cached: boolean;
      source: "cache_remote" | "ai_text";
      data: AiCategorizeBatchOutput;
    }
  | AiFallbackResult;

export interface ExtractStatementPdfRowsAiParams extends AiClientBaseGuards {
  sha256?: string | null;
  text?: string;
  imageBlob?: Blob;
  referenceYear?: number;
  competenceMonth?: string;
}

export type StatementPdfRowsClientResult =
  | {
      ok: true;
      cached: boolean;
      source: "cache_remote" | "ai_text" | "ai_vision";
      data: AiStatementPdfRowsOutput;
    }
  | AiFallbackResult;

const inFlightBySha256 = new Map<string, Promise<unknown>>();

export function resetAiAssistantInFlightForTests(): void {
  inFlightBySha256.clear();
}

export function isClientAiExtractionEnabled(): boolean {
  const raw = (import.meta.env.VITE_AI_EXTRACTION_ENABLED ?? "").trim().toLowerCase();
  if (raw === "false" || raw === "0" || raw === "off") {
    return false;
  }
  return true;
}

/**
 * Calcula SHA-256 hex minúsculo de um texto UTF-8 via Web Crypto API com fallback FIPS 180-4.
 */
export async function computeTextSha256(text: string): Promise<string | null> {
  try {
    const encoded = new TextEncoder().encode(text);
    return await computeSha256Hex(encoded);
  } catch {
    return null;
  }
}

function checkAiPreconditions(guards: AiClientBaseGuards): AiFallbackResult | null {
  if (!isClientAiExtractionEnabled() || guards.featureEnabled === false) {
    return { ok: false, reason: "disabled", fallbackToLocal: true };
  }
  if (guards.isReadOnlyMode === true) {
    return { ok: false, reason: "read_only", fallbackToLocal: true };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline", fallbackToLocal: true };
  }
  return null;
}

function withInFlightDedup<T>(flightKey: string, factory: () => Promise<T>): Promise<T> {
  const existing = inFlightBySha256.get(flightKey) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }
  const promise = factory().finally(() => {
    if (inFlightBySha256.get(flightKey) === promise) {
      inFlightBySha256.delete(flightKey);
    }
  });
  inFlightBySha256.set(flightKey, promise);
  return promise;
}

async function blobToBase64(blob: Blob): Promise<string> {
  if (typeof FileReader !== "undefined") {
    try {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = typeof reader.result === "string" ? reader.result : "";
          const commaIdx = res.indexOf(",");
          resolve(commaIdx !== -1 ? res.slice(commaIdx + 1) : res);
        };
        reader.onerror = () => reject(reader.error ?? new Error("Falha ao converter Blob."));
        reader.readAsDataURL(blob);
      });
    } catch {
      // Continua para fallback via arrayBuffer abaixo
    }
  }

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

type VisionImageMimeType = "image/jpeg" | "image/webp" | "image/png";

function detectDirectVisionMime(blob: Blob): VisionImageMimeType | null {
  const normalized = blob.type.trim().toLowerCase();
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "image/jpeg";
  if (normalized === "image/webp") return "image/webp";
  if (normalized === "image/png") return "image/png";
  return null;
}

async function encodeCanvasWithinCap(
  source: CanvasImageSource,
  targetW: number,
  targetH: number,
  outputMime: "image/jpeg" | "image/webp",
  qualities: readonly number[],
): Promise<{ base64: string; mimeType: VisionImageMimeType } | null> {
  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(source, 0, 0, targetW, targetH);

  for (const quality of qualities) {
    const exported = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((res) => resolve(res), outputMime, quality),
    );
    if (!exported) continue;
    const candidateBase64 = await blobToBase64(exported);
    if (isWithinImageByteCap(candidateBase64, MAX_AI_IMAGE_BYTES)) {
      return { base64: candidateBase64, mimeType: outputMime };
    }
  }
  return null;
}

/**
 * Redimensiona/comprime uma imagem (ou página PDF renderizada) para o teto Vision (1024px @ 0.72, <= 500 KB).
 * Converte formatos modernos como AVIF para JPEG no navegador; jamais rotula bytes brutos incompatíveis como JPEG.
 */
export async function compressBlobForAiVision(blob: Blob): Promise<{
  base64: string;
  mimeType: VisionImageMimeType;
} | null> {
  const directMime = detectDirectVisionMime(blob);

  const probeCanvas =
    typeof document !== "undefined" ? document.createElement("canvas") : null;
  const hasCanvas2d = Boolean(
    probeCanvas &&
      typeof probeCanvas.toBlob === "function" &&
      probeCanvas.getContext("2d"),
  );

  if (!hasCanvas2d) {
    if (!directMime) return null;
    const rawBase64 = await blobToBase64(blob);
    if (!isWithinImageByteCap(rawBase64, MAX_AI_IMAGE_BYTES)) {
      return null;
    }
    return { base64: rawBase64, mimeType: directMime };
  }

  let bitmap: ImageBitmap | null = null;
  let createdUrl: string | null = null;

  try {
    let sourceDrawable: CanvasImageSource | null = null;
    let sourceWidth = 0;
    let sourceHeight = 0;

    if (typeof createImageBitmap === "function") {
      try {
        bitmap = await createImageBitmap(blob);
        sourceDrawable = bitmap;
        sourceWidth = bitmap.width;
        sourceHeight = bitmap.height;
      } catch {
        bitmap = null;
      }
    }

    if (!sourceDrawable && typeof Image !== "undefined" && typeof URL?.createObjectURL === "function") {
      createdUrl = URL.createObjectURL(blob);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
          img.onload = null;
          img.onerror = null;
          reject(new Error("Tempo limite ao decodificar imagem para Vision."));
        }, 3_000);
        img.onload = () => {
          clearTimeout(timer);
          img.onload = null;
          img.onerror = null;
          resolve();
        };
        img.onerror = () => {
          clearTimeout(timer);
          img.onload = null;
          img.onerror = null;
          reject(new Error("Falha ao decodificar imagem para Vision."));
        };
        img.src = createdUrl!;
      });
      sourceWidth = img.naturalWidth || img.width;
      sourceHeight = img.naturalHeight || img.height;
      if (sourceWidth > 0 && sourceHeight > 0) {
        sourceDrawable = img;
      }
    }

    if (!sourceDrawable || sourceWidth <= 0 || sourceHeight <= 0) {
      if (!directMime) return null;
      const rawBase64 = await blobToBase64(blob);
      return isWithinImageByteCap(rawBase64, MAX_AI_IMAGE_BYTES)
        ? { base64: rawBase64, mimeType: directMime }
        : null;
    }

    const largest = Math.max(sourceWidth, sourceHeight, 1);
    const scale = largest > AI_VISION_MAX_DIMENSION ? AI_VISION_MAX_DIMENSION / largest : 1;
    const targetW = Math.max(1, Math.round(sourceWidth * scale));
    const targetH = Math.max(1, Math.round(sourceHeight * scale));
    const outputMime: "image/jpeg" | "image/webp" =
      directMime === "image/webp" ? "image/webp" : "image/jpeg";

    const primaryEncoded = await encodeCanvasWithinCap(
      sourceDrawable,
      targetW,
      targetH,
      outputMime,
      [AI_VISION_DEFAULT_QUALITY, AI_VISION_FALLBACK_QUALITY],
    );
    if (primaryEncoded) {
      return primaryEncoded;
    }

    if (largest > AI_VISION_RETRY_MAX_DIMENSION) {
      const retryScale = AI_VISION_RETRY_MAX_DIMENSION / largest;
      const retryEncoded = await encodeCanvasWithinCap(
        sourceDrawable,
        Math.max(1, Math.round(sourceWidth * retryScale)),
        Math.max(1, Math.round(sourceHeight * retryScale)),
        outputMime,
        [AI_VISION_RETRY_QUALITY],
      );
      if (retryEncoded) {
        return retryEncoded;
      }
    }

    return null;
  } catch {
    if (!directMime) return null;
    const rawBase64 = await blobToBase64(blob);
    return isWithinImageByteCap(rawBase64, MAX_AI_IMAGE_BYTES)
      ? { base64: rawBase64, mimeType: directMime }
      : null;
  } finally {
    bitmap?.close();
    if (createdUrl) {
      try {
        URL.revokeObjectURL(createdUrl);
      } catch {
        // no-op
      }
    }
  }
}

function normalizeFallbackReason(rawReason: unknown): AiFallbackReason {
  if (
    typeof rawReason === "string" &&
    (AI_FALLBACK_REASONS as readonly string[]).includes(rawReason)
  ) {
    return rawReason as AiFallbackReason;
  }
  return "upstream_unavailable";
}

function isAbortError(err: unknown, abortedSignal: boolean): boolean {
  if (abortedSignal) return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  if (typeof DOMException !== "undefined" && err instanceof DOMException && err.name === "AbortError") {
    return true;
  }
  return false;
}

type RawHttpAiResult =
  | {
      ok: true;
      cached: boolean;
      source?: unknown;
      data: unknown;
    }
  | AiFallbackResult;

async function invokeAiAssistantHttp(
  requestPayload: Record<string, unknown>,
  timeoutMs = CLIENT_AI_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<RawHttpAiResult> {
  if (externalSignal?.aborted) {
    return { ok: false, reason: "upstream_unavailable", fallbackToLocal: true };
  }

  let envUrl: string;
  let anonKey: string;
  let accessToken: string | undefined;
  try {
    const env = getSupabaseEnv();
    envUrl = env.url.replace(/\/+$/, "");
    anonKey = env.anonKey;
    const { data } = await getSupabase().auth.getSession();
    accessToken = data?.session?.access_token;
  } catch {
    return { ok: false, reason: "unauthenticated", fallbackToLocal: true };
  }

  if (!accessToken) {
    return { ok: false, reason: "unauthenticated", fallbackToLocal: true };
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${envUrl}/functions/v1/ai-financial-assistant`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      signal: controller.signal,
      body: JSON.stringify(requestPayload),
    });

    if (response.status === 401) {
      return { ok: false, reason: "unauthenticated", fallbackToLocal: true };
    }
    if (response.status === 403) {
      return { ok: false, reason: "read_only", fallbackToLocal: true };
    }
    if (response.status === 400) {
      return { ok: false, reason: "invalid_payload", fallbackToLocal: true };
    }
    if (!response.ok) {
      return { ok: false, reason: "upstream_unavailable", fallbackToLocal: true };
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch {
      return { ok: false, reason: "invalid_ai_output", fallbackToLocal: true };
    }

    if (!rawJson || typeof rawJson !== "object") {
      return { ok: false, reason: "invalid_ai_output", fallbackToLocal: true };
    }

    const body = rawJson as {
      ok?: unknown;
      cached?: unknown;
      source?: unknown;
      data?: unknown;
      reason?: unknown;
      quotaResetAt?: unknown;
    };

    if (body.ok !== true) {
      return {
        ok: false,
        reason: normalizeFallbackReason(body.reason),
        fallbackToLocal: true,
        ...(typeof body.quotaResetAt === "string" ? { quotaResetAt: body.quotaResetAt } : {}),
      };
    }

    return {
      ok: true,
      cached: Boolean(body.cached),
      source: body.source,
      data: body.data,
    };
  } catch (err) {
    if (externalSignal?.aborted) {
      return { ok: false, reason: "upstream_unavailable", fallbackToLocal: true };
    }
    if (isAbortError(err, controller.signal.aborted)) {
      return { ok: false, reason: "timeout", fallbackToLocal: true };
    }
    return { ok: false, reason: "upstream_unavailable", fallbackToLocal: true };
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
}

function sanitizeAiCategoriesInput(
  categories?: readonly AiCategoryOptionInput[],
): Array<{ id: string; name: string; type?: "expense" | "income" }> {
  if (!categories?.length) return [];
  return categories
    .map((c) => ({
      id: c.id.trim().slice(0, 80),
      name: c.name.trim().slice(0, 80),
      ...(c.type ? { type: c.type } : {}),
    }))
    .filter((c) => c.id.length > 0 && c.name.length > 0)
    .slice(0, MAX_AI_CATEGORIZE_CATEGORIES);
}

async function performSingleReceiptAiCall(
  params: ExtractSingleReceiptAiParams,
): Promise<AiSingleReceiptClientResult> {
  if (params.signal?.aborted) {
    return { ok: false, reason: "upstream_unavailable", fallbackToLocal: true };
  }

  const maskedText = params.text
    ? maskSensitivePiiForAi(params.text).trim().slice(0, MAX_AI_SINGLE_RECEIPT_TEXT_CHARS)
    : "";

  let imagePayload: {
    base64: string;
    mimeType: "image/jpeg" | "image/webp" | "image/png";
  } | null = null;

  if (params.preferVision || maskedText.length < MIN_AI_TEXT_LENGTH) {
    let sourceBlob: Blob | null = params.imageBlob ?? null;
    if (!sourceBlob && params.pdfFile) {
      try {
        const buffer = await params.pdfFile.arrayBuffer();
        if (params.signal?.aborted) {
          return { ok: false, reason: "upstream_unavailable", fallbackToLocal: true };
        }
        const { renderScannedPdfPageToBlob } = await import("@/services/native/receipt-extractor");
        sourceBlob = await renderScannedPdfPageToBlob(buffer);
      } catch {
        sourceBlob = null;
      }
    }

    if (sourceBlob && !params.signal?.aborted) {
      imagePayload = await compressBlobForAiVision(sourceBlob);
    }
  }

  if (params.signal?.aborted) {
    return { ok: false, reason: "upstream_unavailable", fallbackToLocal: true };
  }

  if (maskedText.length < MIN_AI_TEXT_LENGTH && !imagePayload) {
    return { ok: false, reason: "invalid_payload", fallbackToLocal: true };
  }

  const cleanCategories = sanitizeAiCategoriesInput(params.categories);
  const allowedCategoryIds =
    cleanCategories.length > 0 ? new Set(cleanCategories.map((c) => c.id)) : undefined;

  const httpRes = await invokeAiAssistantHttp(
    {
      mode: "single_receipt",
      sha256: params.sha256,
      ...(maskedText.length > 0 ? { text: maskedText } : {}),
      ...(imagePayload
        ? {
            imageBase64: imagePayload.base64,
            imageMimeType: imagePayload.mimeType,
          }
        : {}),
      ...(params.userFullName?.trim()
        ? { userFullName: params.userFullName.trim().slice(0, 120) }
        : {}),
      ...(cleanCategories.length > 0 ? { categories: cleanCategories } : {}),
    },
    CLIENT_AI_TIMEOUT_MS,
    params.signal,
  );

  if (!httpRes.ok) {
    return httpRes;
  }

  const validatedData = AiSingleReceiptOutputSchema.safeParse(
    normalizeSingleReceiptAiPayload(httpRes.data, allowedCategoryIds),
  );
  if (!validatedData.success) {
    return { ok: false, reason: "invalid_ai_output", fallbackToLocal: true };
  }

  const source: AiSingleReceiptSource =
    httpRes.source === "cache_remote" || httpRes.source === "ai_vision" || httpRes.source === "ai_text"
      ? httpRes.source
      : imagePayload
        ? "ai_vision"
        : "ai_text";

  return {
    ok: true,
    cached: httpRes.cached,
    source,
    data: validatedData.data,
  };
}

/**
 * Solicita extração assistida de um único comprovante à Edge Function (Balde 1: `receipt_calls`).
 */
export async function extractSingleReceiptWithAi(
  params: ExtractSingleReceiptAiParams,
): Promise<AiSingleReceiptClientResult> {
  const blocked = checkAiPreconditions(params);
  if (blocked) return blocked;

  if (!Sha256HexSchema.safeParse(params.sha256).success) {
    return { ok: false, reason: "invalid_payload", fallbackToLocal: true };
  }

  const flightKey = `${params.userId ?? "anon"}:single_receipt:${params.sha256}`;
  return withInFlightDedup(flightKey, () => performSingleReceiptAiCall(params));
}

/**
 * Classifica descrições desconhecidas de fatura em lote (máx. 40) com proteção
 * LGPD estrita (zero valores monetários, datas ou dados de cartão — Trava 5)
 * e validação contra whitelist de IDs de categorias do usuário (Balde 2: `batch_calls`).
 */
export async function categorizeDescriptionsBatchWithAi(
  params: CategorizeBatchAiParams,
): Promise<CategorizeBatchClientResult> {
  const blocked = checkAiPreconditions(params);
  if (blocked) return blocked;

  const cleanCategories = sanitizeAiCategoriesInput(params.categories).map(({ id, name }) => ({
    id,
    name,
  }));

  const sanitizedDescriptions = params.descriptions
    .slice(0, MAX_AI_CATEGORIZE_BATCH_ITEMS)
    .map((d) => sanitizeBatchDescriptionForAi(d) || d.trim().slice(0, MAX_AI_CATEGORIZE_DESCRIPTION_CHARS))
    .filter((d) => d.length > 0);

  if (sanitizedDescriptions.length === 0 || cleanCategories.length === 0) {
    return { ok: false, reason: "invalid_payload", fallbackToLocal: true };
  }

  const resolvedSha =
    params.sha256 && Sha256HexSchema.safeParse(params.sha256).success
      ? params.sha256
      : await computeTextSha256(
          JSON.stringify({
            descriptions: sanitizedDescriptions,
            categories: cleanCategories,
          }),
        );

  if (!resolvedSha) {
    return { ok: false, reason: "invalid_payload", fallbackToLocal: true };
  }

  const allowedCategoryIds = new Set(cleanCategories.map((c) => c.id));
  const flightKey = `${params.userId ?? "anon"}:categorize_batch:${resolvedSha}`;

  return withInFlightDedup(flightKey, async () => {
    const httpRes = await invokeAiAssistantHttp(
      {
        mode: "categorize_batch",
        sha256: resolvedSha,
        priority: params.priority ?? "passive",
        descriptions: sanitizedDescriptions,
        categories: cleanCategories,
      },
      CLIENT_AI_BATCH_TIMEOUT_MS,
      params.signal,
    );

    if (!httpRes.ok) {
      return httpRes;
    }

    const validated = validateCategorizeBatchOutput(
      httpRes.data,
      allowedCategoryIds,
      sanitizedDescriptions.length - 1,
    );
    if (!validated.success) {
      return { ok: false, reason: "invalid_ai_output", fallbackToLocal: true };
    }

    return {
      ok: true,
      cached: httpRes.cached,
      source: httpRes.source === "cache_remote" ? "cache_remote" : "ai_text",
      data: validated.data,
    };
  });
}

/**
 * Extrai linhas individuais de uma fatura em PDF multi-coluna onde o parser tabular
 * determinístico não encontrou colunas alinhadas (Balde 2: `batch_calls`).
 * A soma, hash ordinal e conciliação seguem 100% determinísticos no cliente.
 */
export async function extractStatementPdfRowsWithAi(
  params: ExtractStatementPdfRowsAiParams,
): Promise<StatementPdfRowsClientResult> {
  const blocked = checkAiPreconditions(params);
  if (blocked) return blocked;

  const maskedText = params.text
    ? maskSensitivePiiForAi(params.text).trim().slice(0, MAX_AI_STATEMENT_PDF_TEXT_CHARS)
    : "";

  let imagePayload: {
    base64: string;
    mimeType: VisionImageMimeType;
  } | null = null;

  if (params.imageBlob) {
    imagePayload = await compressBlobForAiVision(params.imageBlob);
  }

  if (!maskedText && !imagePayload) {
    return { ok: false, reason: "invalid_payload", fallbackToLocal: true };
  }

  const resolvedSha =
    params.sha256 && Sha256HexSchema.safeParse(params.sha256).success
      ? params.sha256
      : await computeTextSha256(maskedText || imagePayload?.base64 || "");

  if (!resolvedSha) {
    return { ok: false, reason: "invalid_payload", fallbackToLocal: true };
  }

  const flightKey = `${params.userId ?? "anon"}:statement_pdf_rows:${resolvedSha}`;

  return withInFlightDedup(flightKey, async () => {
    const httpRes = await invokeAiAssistantHttp(
      {
        mode: "statement_pdf_rows",
        sha256: resolvedSha,
        ...(maskedText ? { text: maskedText } : {}),
        ...(imagePayload
          ? {
              imageBase64: imagePayload.base64,
              imageMimeType: imagePayload.mimeType,
            }
          : {}),
        ...(typeof params.referenceYear === "number"
          ? { referenceYear: params.referenceYear }
          : {}),
        ...(params.competenceMonth && /^\d{4}-\d{2}$/.test(params.competenceMonth)
          ? { competenceMonth: params.competenceMonth }
          : {}),
      },
      CLIENT_AI_TIMEOUT_MS,
      params.signal,
    );

    if (!httpRes.ok) {
      return httpRes;
    }

    const validated = AiStatementPdfRowsOutputSchema.safeParse(
      normalizeStatementPdfRowsAiPayload(httpRes.data),
    );
    if (!validated.success || validated.data.rows.length === 0) {
      return { ok: false, reason: "invalid_ai_output", fallbackToLocal: true };
    }

    const source: "cache_remote" | "ai_text" | "ai_vision" =
      httpRes.source === "cache_remote"
        ? "cache_remote"
        : httpRes.source === "ai_vision"
          ? "ai_vision"
          : "ai_text";

    return {
      ok: true,
      cached: httpRes.cached,
      source,
      data: validated.data,
    };
  });
}

/**
 * Converte a saída estruturada validada da Micro-IA em `UniversalReceiptData` para
 * seguir no mesmo pipeline de resolução determinística (`resolveReceiptTransaction`).
 */
export function convertAiReceiptToUniversalData(
  aiData: AiSingleReceiptOutput,
  source: AiSingleReceiptSource,
  fallbackDateIso?: string,
): UniversalReceiptData {
  const installmentsCount = aiData.installmentsCount ?? undefined;
  const hasInstallments = Boolean(installmentsCount && installmentsCount > 1);
  const confidenceScore =
    aiData.confidence === "high" ? 0.9 : aiData.confidence === "medium" ? 0.7 : 0.45;

  return {
    id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    kind: aiData.receiptKind,
    nature: aiData.nature,
    amountCents: aiData.amountCents,
    date: aiData.date || fallbackDateIso || toISODate(new Date()),
    description: aiData.description,
    paymentMethod: aiData.paymentMethod,
    merchantOrBeneficiary:
      aiData.merchantOrBeneficiary ||
      (aiData.nature === "expense" ? aiData.description : undefined),
    payerOrSource: aiData.payerOrSource || undefined,
    taxId: aiData.merchantCnpj || undefined,
    bankName: aiData.bankName || undefined,
    cardLastDigits: aiData.cardLastDigits || undefined,
    cardBrand: aiData.cardBrand || undefined,
    installments:
      hasInstallments && installmentsCount
        ? {
            count: installmentsCount,
            installmentAmountCents: Math.round(aiData.amountCents / installmentsCount),
            totalAmountCents: aiData.amountCents,
            isNewFinancedPurchase: true,
          }
        : undefined,
    rawCleanText: "",
    confidence: aiData.confidence,
    confidenceScore,
    fieldConfidence: aiData.fieldConfidence ?? {
      amount: aiData.confidence,
      counterparty: aiData.confidence,
      nature: aiData.confidence,
      date: aiData.date ? aiData.confidence : fallbackDateIso ? "medium" : "low",
    },
    isSameTitularity: aiData.isSameTitularity ?? undefined,
    extractionSource: source,
    aiCategoryId: aiData.categoryId || undefined,
    originalCurrency: aiData.originalCurrency || undefined,
    originalAmountCents: aiData.originalAmountCents ?? undefined,
    semanticTags: aiData.semanticTags?.length ? aiData.semanticTags : undefined,
    inferredScope: aiData.inferredScope ?? undefined,
    isTaxDeductible: typeof aiData.isTaxDeductible === "boolean" ? aiData.isTaxDeductible : undefined,
  };
}

/**
 * Formata de forma calma a data de renovação da cota de IA em BRT sem emojis.
 */
export function formatAiQuotaResetHint(quotaResetAt?: string): string {
  if (!quotaResetAt) {
    return "no próximo ciclo";
  }
  const parsed = new Date(quotaResetAt);
  if (Number.isNaN(parsed.getTime())) {
    return "no próximo ciclo";
  }
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  } catch {
    return quotaResetAt.slice(0, 10);
  }
}

export { maskSensitivePiiForAi, sanitizeBatchDescriptionForAi };

