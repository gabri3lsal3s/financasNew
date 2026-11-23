/**
 * Edge Function de Micro-IA Hibrida FinOps (`gemini-3.5-flash-lite`) — Fases D e E.
 *
 * Modos suportados:
 *  - `single_receipt` (Balde 1: `receipt_calls`): fallback unitario para comprovante dificil
 *  - `categorize_batch` (Balde 2: `batch_calls`): auto-categorizacao silenciosa (ate 40 descricoes, whitelist estrita Trava 5)
 *  - `statement_pdf_rows` (Balde 2: `batch_calls`): fallback estrutural de fatura PDF multi-coluna (zero soma/calculo IA)
 *
 * Blindagens implementadas:
 *  - Kill-switch por env var (`AI_EXTRACTION_ENABLED !== "true"`) + feature flag `ai_extraction`
 *  - JWT obrigatorio + Fail-Closed em assinatura ativa (nao read_only)
 *  - Validacao estrita com Zod + Hard Caps de payload (Trava 3)
 *  - Cache LGPD por `(user_id, sha256, mode)` ANTES de checar/debitar cota (0 creditos em hit)
 *  - Mascaramento PII adicional em texto antes do envio ao Gemini (Trava 5)
 *  - Timeout estrito de 4.500 ms + zero debito em falhas 429/500/timeout/JSON invalido/whitelist violada
 *  - Incremento atomico via RPC `increment_user_ai_quota_atomic` apenas pos `zod.safeParse()` OK
 *
 * Deploy: supabase functions deploy ai-financial-assistant --no-verify-jwt --use-api
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";
import {
  AI_ALLOWED_CONFIDENCE_LEVELS,
  AI_ALLOWED_PAYMENT_METHODS,
  AI_ALLOWED_RECEIPT_KINDS,
  AiAssistantRequestSchema,
  AiSingleReceiptOutputSchema,
  AiStatementPdfRowsOutputSchema,
  evaluateAiQuotaAllowance,
  getBrtQuotaPeriods,
  isAiCacheEntryFresh,
  maskSensitivePiiForAi,
  MAX_AI_SINGLE_RECEIPT_TEXT_CHARS,
  MAX_AI_STATEMENT_PDF_TEXT_CHARS,
  normalizeSingleReceiptAiPayload,
  sanitizeBatchDescriptionForAi,
  stripBase64DataPrefix,
  stripJsonMarkdownFences,
  validateCategorizeBatchOutput,
  type AiFallbackReason,
  type AiPlanGroup,
  type AiQuotaBucket,
  type UserAiQuotaRowSnapshot,
} from "../_shared/ai-schemas.ts";

declare const Deno:
  | {
      env?: {
        get(key: string): string | undefined;
      };
      serve?: (handler: (req: Request) => Promise<Response> | Response) => void;
    }
  | undefined;

const GEMINI_PRIMARY_TIMEOUT_MS = 9_000;
const GEMINI_FALLBACK_TIMEOUT_MS = 10_000;
const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_FALLBACK_MODELS = ["gemini-3.5-flash", "gemini-flash-lite-latest"] as const;
const MIN_USEFUL_TEXT_CHARS = 20;

function buildGeminiModelCandidates(primaryModel: string, rawFallbackCsv?: string): string[] {
  const envFallbacks = (rawFallbackCsv ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const fallbacks = envFallbacks.length > 0 ? envFallbacks : [...DEFAULT_FALLBACK_MODELS];
  const unique: string[] = [];
  for (const candidate of [primaryModel.trim() || DEFAULT_GEMINI_MODEL, ...fallbacks]) {
    if (candidate && !unique.includes(candidate)) {
      unique.push(candidate);
    }
    if (unique.length >= 3) break;
  }
  return unique;
}

const GEMINI_SINGLE_RECEIPT_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    amountCents: { type: "INTEGER" },
    date: { type: "STRING", nullable: true },
    nature: { type: "STRING", enum: ["expense", "income"] },
    paymentMethod: { type: "STRING", enum: [...AI_ALLOWED_PAYMENT_METHODS] },
    receiptKind: { type: "STRING", enum: [...AI_ALLOWED_RECEIPT_KINDS] },
    description: { type: "STRING" },
    merchantOrBeneficiary: { type: "STRING", nullable: true },
    payerOrSource: { type: "STRING", nullable: true },
    bankName: { type: "STRING", nullable: true },
    cardLastDigits: { type: "STRING", nullable: true },
    cardBrand: { type: "STRING", nullable: true },
    installmentsCount: { type: "INTEGER", nullable: true },
    isSameTitularity: { type: "BOOLEAN", nullable: true },
    confidence: { type: "STRING", enum: [...AI_ALLOWED_CONFIDENCE_LEVELS] },
    fieldConfidence: {
      type: "OBJECT",
      nullable: true,
      properties: {
        amount: { type: "STRING", enum: [...AI_ALLOWED_CONFIDENCE_LEVELS] },
        counterparty: { type: "STRING", enum: [...AI_ALLOWED_CONFIDENCE_LEVELS] },
        nature: { type: "STRING", enum: [...AI_ALLOWED_CONFIDENCE_LEVELS] },
        date: { type: "STRING", enum: [...AI_ALLOWED_CONFIDENCE_LEVELS] },
      },
      required: ["amount", "counterparty", "nature", "date"],
    },
  },
  required: [
    "amountCents",
    "nature",
    "paymentMethod",
    "receiptKind",
    "description",
    "confidence",
  ],
};

const GEMINI_CATEGORIZE_BATCH_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          index: { type: "INTEGER" },
          friendlyName: { type: "STRING" },
          categoryId: { type: "STRING", nullable: true },
        },
        required: ["index", "friendlyName", "categoryId"],
      },
    },
  },
  required: ["items"],
};

const GEMINI_STATEMENT_PDF_ROWS_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    rows: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          date: { type: "STRING" },
          description: { type: "STRING" },
          amountCents: { type: "INTEGER" },
          installmentCurrent: { type: "INTEGER", nullable: true },
          installmentTotal: { type: "INTEGER", nullable: true },
        },
        required: ["date", "description", "amountCents"],
      },
    },
  },
  required: ["rows"],
};

function buildSingleReceiptPrompt(userFullName?: string): string {
  const titularLine = userFullName
    ? `Titular autenticado da conta no app: "${userFullName}". Compare pagador/origem e recebedor/destino para definir nature ("income" se o titular recebeu o valor, "expense" se o titular pagou/enviou) e isSameTitularity (true somente se o mesmo titular aparece claramente nos dois polos).`
    : 'Defina nature ("expense" ou "income") e isSameTitularity (boolean) apenas com base explicita no documento.';

  return [
    "Voce e um extrator financeiro estruturado brasileiro. Extraia somente os campos do comprovante financeiro fornecido.",
    "Regras obrigatorias:",
    "1) amountCents DEVE ser inteiro positivo em centavos (ex.: R$ 45,00 => 4500; R$ 1.250,90 => 125090). Se houver saldo em conta, valor original e valor pago com desconto/juros, selecione o VALOR EFETIVAMENTE PAGO/RECEBIDO.",
    "2) date em formato ISO YYYY-MM-DD ou null se ausente.",
    `3) ${titularLine}`,
    "4) description curta e limpa com o nome comercial da contraparte (sem banco, sem frases como 'comprovante de').",
    "5) Nunca invente campos ausentes: retorne null nos opcionais incertos e sinalize fieldConfidence realista ('high' apenas quando nitido e inequivoco).",
  ].join("\n");
}

function buildCategorizeBatchPrompt(
  descriptions: readonly string[],
  categories: readonly { id: string; name: string }[],
): string {
  return [
    "Voce e um classificador financeiro de faturas de cartao no Brasil.",
    "Para cada item indexado em `descriptions`, gere:",
    "1) `friendlyName`: nome comercial limpo e legivel (ex.: 'PAG*PadariaEstrela SP' -> 'Padaria Estrela', 'IFD*RESTAURANTE XYZ' -> 'Restaurante Xyz').",
    "2) `categoryId`: selecione EXCLUSIVAMENTE um `id` exato da lista `categories` abaixo ou `null` caso nao tenha certeza.",
    "PROIBIDO inventar ou alterar qualquer `categoryId`. Responda em JSON estrito.",
    "",
    "Categorias disponiveis (whitelist):",
    JSON.stringify(categories),
    "",
    "Descricoes indexadas:",
    JSON.stringify(descriptions.map((desc, index) => ({ index, description: desc }))),
  ].join("\n");
}

function buildStatementPdfRowsPrompt(text: string, referenceYear?: number): string {
  const yearHint = referenceYear
    ? `Ano de referencia da fatura caso a linha tenha apenas DD/MM: ${referenceYear}.`
    : "Use o ano explicito do cabecalho ou dos lancamentos quando a data estiver em DD/MM.";

  return [
    "Voce e um extrator estruturado de linhas de fatura de cartao de credito em PDF.",
    yearHint,
    "Regras obrigatorias:",
    "1) Extraia APENAS as linhas individuais de lancamentos/compras/estornos.",
    "2) IGNORE totais de fatura, saldo anterior, pagamento minimo, encargos resumidos, cabeçalhos e rodapes.",
    "3) `date` sempre no formato ISO `YYYY-MM-DD`; `description` concisa com o nome do estabelecimento.",
    "4) `amountCents` em centavos inteiros: POSITIVO para compras/despesas e NEGATIVO apenas para estornos/creditos na fatura.",
    "5) Se houver indicacao de parcela (ex.: 02/10), preencha `installmentCurrent` e `installmentTotal`; senao use null.",
    "6) NUNCA some valores nem calcule totais.",
    "",
    "Texto da fatura:",
    text,
  ].join("\n");
}

function fallbackResponse(
  req: Request,
  reason: AiFallbackReason,
  status = 200,
  extra?: { quotaResetAt?: string; error?: string },
): Response {
  return jsonResponse(
    req,
    {
      ok: false,
      reason,
      fallbackToLocal: true,
      ...(extra?.quotaResetAt ? { quotaResetAt: extra.quotaResetAt } : {}),
      ...(extra?.error ? { error: extra.error } : {}),
    },
    status,
  );
}

async function callGeminiJson(params: {
  apiKey: string;
  models: readonly string[];
  parts: Array<Record<string, unknown>>;
  responseSchema: Record<string, unknown>;
  maxOutputTokens: number;
}): Promise<
  | { ok: true; payload: unknown }
  | { ok: false; reason: "timeout" | "upstream_unavailable" | "invalid_ai_output" }
> {
  let lastFailureReason: "timeout" | "upstream_unavailable" | "invalid_ai_output" =
    "upstream_unavailable";

  for (let idx = 0; idx < params.models.length; idx++) {
    const model = params.models[idx]!;
    const hasNext = idx < params.models.length - 1;
    const timeoutMs = idx === 0 ? GEMINI_PRIMARY_TIMEOUT_MS : GEMINI_FALLBACK_TIMEOUT_MS;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent`;

      // Nota: nao enviar `thinkingConfig` no `generationConfig`, pois `gemini-3.5-flash-lite` rejeita com HTTP 400.
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": params.apiKey,
        },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: "user", parts: params.parts }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: params.maxOutputTokens,
            responseMimeType: "application/json",
            responseSchema: params.responseSchema,
          },
        }),
      });

      if (!response.ok) {
        console.warn("[ai-financial-assistant] gemini http error", {
          model,
          status: response.status,
          attempt: idx + 1,
        });
        lastFailureReason = "upstream_unavailable";
        const retryable =
          response.status === 429 || response.status >= 500 || response.status === 404;
        if (retryable && hasNext) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        return { ok: false, reason: "upstream_unavailable" };
      }

      const json = (await response.json()) as {
        candidates?: Array<{
          finishReason?: string;
          content?: {
            parts?: Array<{ text?: string; thought?: boolean }>;
          };
        }>;
      };

      const candidate = json.candidates?.[0];
      const parts = candidate?.content?.parts;
      const rawOutputText =
        parts?.find((p) => !p.thought && typeof p.text === "string")?.text ?? parts?.[0]?.text;

      if (!rawOutputText) {
        console.warn("[ai-financial-assistant] gemini invalid json", {
          model,
          finishReason: candidate?.finishReason,
          attempt: idx + 1,
        });
        lastFailureReason = "invalid_ai_output";
        if (hasNext) continue;
        return { ok: false, reason: "invalid_ai_output" };
      }

      try {
        return { ok: true, payload: JSON.parse(stripJsonMarkdownFences(rawOutputText)) };
      } catch {
        console.warn("[ai-financial-assistant] gemini invalid json", {
          model,
          finishReason: candidate?.finishReason,
          attempt: idx + 1,
        });
        lastFailureReason = "invalid_ai_output";
        if (hasNext) continue;
        return { ok: false, reason: "invalid_ai_output" };
      }
    } catch (err) {
      const isTimeout =
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError") ||
        (typeof DOMException !== "undefined" &&
          err instanceof DOMException &&
          err.name === "AbortError");
      console.warn("[ai-financial-assistant] gemini request failed", {
        model,
        isTimeout,
        attempt: idx + 1,
      });
      lastFailureReason = isTimeout ? "timeout" : "upstream_unavailable";
      if (hasNext) continue;
      return { ok: false, reason: lastFailureReason };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, reason: lastFailureReason };
}

Deno?.serve?.(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Metodo nao permitido" }, 405);
  }

  try {
    // 1. Kill-switch imediato via variavel de ambiente
    const aiEnabledEnv = (Deno?.env?.get("AI_EXTRACTION_ENABLED") ?? "").trim().toLowerCase();
    if (aiEnabledEnv !== "true") {
      return fallbackResponse(req, "disabled", 200);
    }

    const supabaseUrl = Deno?.env?.get("SUPABASE_URL");
    const supabaseServiceKey = Deno?.env?.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno?.env?.get("SUPABASE_ANON_KEY");
    const geminiApiKey = (Deno?.env?.get("GEMINI_API_KEY") ?? "").trim();
    const geminiModel = (Deno?.env?.get("GEMINI_MODEL") ?? "").trim() || DEFAULT_GEMINI_MODEL;
    const modelCandidates = buildGeminiModelCandidates(
      geminiModel,
      Deno?.env?.get("GEMINI_FALLBACK_MODELS"),
    );

    if (!supabaseUrl || !supabaseServiceKey || !anonKey) {
      return safeErrorResponse(req, 500, "Servico de assistente indisponivel.");
    }

    if (!geminiApiKey) {
      return fallbackResponse(req, "disabled", 200);
    }

    // 2. Autenticacao obrigatoria com JWT do usuario
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return fallbackResponse(req, "unauthenticated", 401, {
        error: "Sessao nao informada.",
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user: authUser },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !authUser) {
      return fallbackResponse(req, "unauthenticated", 401, {
        error: "Sessao invalida ou expirada.",
      });
    }

    // 3. Parse + Validacao de Hard Caps (Trava 3)
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return fallbackResponse(req, "invalid_payload", 400);
    }

    const parsedRequest = AiAssistantRequestSchema.safeParse(rawBody);
    if (!parsedRequest.success) {
      return fallbackResponse(req, "invalid_payload", 400);
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // 4. Checagem Fail-Closed de perfil ativo, assinatura e feature flag `ai_extraction`
    const [profileRes, subRes, featureRes, overrideRes] = await Promise.all([
      serviceClient
        .from("profiles")
        .select("status, role")
        .eq("id", authUser.id)
        .maybeSingle(),
      serviceClient
        .from("user_subscriptions")
        .select("tier, status, trial_ends_at, current_period_end")
        .eq("user_id", authUser.id)
        .maybeSingle(),
      serviceClient
        .from("system_features")
        .select("is_globally_enabled, default_enabled_for_new_users")
        .eq("key", "ai_extraction")
        .maybeSingle(),
      serviceClient
        .from("user_feature_overrides")
        .select("is_enabled")
        .eq("user_id", authUser.id)
        .eq("feature_key", "ai_extraction")
        .maybeSingle(),
    ]);

    const profile = profileRes.data as { status?: string; role?: string } | null;
    if (!profile || profile.status !== "active") {
      return fallbackResponse(req, "read_only", 403, {
        error: "Conta sem permissao ativa para leitura assistida.",
      });
    }

    const feature = featureRes.data as {
      is_globally_enabled?: boolean;
      default_enabled_for_new_users?: boolean;
    } | null;
    const override = overrideRes.data as { is_enabled?: boolean } | null;

    if (feature?.is_globally_enabled === false) {
      return fallbackResponse(req, "disabled", 200);
    }
    if (override && override.is_enabled === false) {
      return fallbackResponse(req, "disabled", 200);
    }
    if (!override && feature && feature.default_enabled_for_new_users === false) {
      return fallbackResponse(req, "disabled", 200);
    }

    const sub = subRes.data as {
      tier?: string;
      status?: string;
      trial_ends_at?: string | null;
    } | null;

    const isAdmin = profile.role === "admin" || profile.role === "superadmin";
    const isLifetime = sub?.tier === "lifetime";
    const isActivePro =
      (sub?.tier === "pro_monthly" || sub?.tier === "pro_annual") && sub?.status === "active";
    const isActiveTrial =
      sub?.tier === "trial" &&
      sub?.status === "trialing" &&
      (!sub.trial_ends_at || Date.parse(sub.trial_ends_at) > Date.now());

    if (!(isAdmin || isLifetime || isActivePro || isActiveTrial)) {
      return fallbackResponse(req, "read_only", 403, {
        error: "Assinatura em modo somente leitura.",
      });
    }

    const planGroup: AiPlanGroup = isAdmin || isLifetime || isActivePro ? "pro" : "trial";
    const requestData = parsedRequest.data;
    const bucket: AiQuotaBucket =
      requestData.mode === "single_receipt" ? "receipt_calls" : "batch_calls";

    const allowedCategoryIds =
      requestData.mode === "categorize_batch"
        ? new Set(requestData.categories.map((c) => c.id))
        : null;

    // 5. Consulta Cache LGPD por (user_id, sha256, mode) ANTES de checar ou debitar cota
    const { data: cacheRow } = await serviceClient
      .from("receipt_extractions_cache")
      .select("extracted_json, created_at")
      .eq("user_id", authUser.id)
      .eq("sha256", requestData.sha256)
      .eq("mode", requestData.mode)
      .maybeSingle();

    if (
      cacheRow?.extracted_json &&
      isAiCacheEntryFresh((cacheRow as { created_at?: string }).created_at, requestData.mode)
    ) {
      if (requestData.mode === "single_receipt") {
        const validatedCached = AiSingleReceiptOutputSchema.safeParse(
          normalizeSingleReceiptAiPayload(cacheRow.extracted_json),
        );
        if (validatedCached.success) {
          return jsonResponse(req, {
            ok: true,
            mode: "single_receipt",
            cached: true,
            source: "cache_remote",
            data: validatedCached.data,
          });
        }
      } else if (requestData.mode === "statement_pdf_rows") {
        const validatedCached = AiStatementPdfRowsOutputSchema.safeParse(cacheRow.extracted_json);
        if (validatedCached.success && validatedCached.data.rows.length > 0) {
          return jsonResponse(req, {
            ok: true,
            mode: "statement_pdf_rows",
            cached: true,
            source: "cache_remote",
            data: validatedCached.data,
          });
        }
      } else if (requestData.mode === "categorize_batch" && allowedCategoryIds) {
        const validatedCached = validateCategorizeBatchOutput(
          cacheRow.extracted_json,
          allowedCategoryIds,
          requestData.descriptions.length - 1,
        );
        if (validatedCached.success) {
          return jsonResponse(req, {
            ok: true,
            mode: "categorize_batch",
            cached: true,
            source: "cache_remote",
            data: validatedCached.data,
          });
        }
      }
    }

    // 6. Pre-checagem de cota considerando 0 para uso diario quando period_day !== todayBrt (Ajuste #3)
    const { periodMonth, periodDay, nextDayResetAtIso, nextMonthResetAtIso } = getBrtQuotaPeriods();
    const { data: quotaRow } = await serviceClient
      .from("user_ai_quotas")
      .select(
        "period_day, receipt_calls_month, receipt_calls_day, batch_calls_month, batch_calls_day",
      )
      .eq("user_id", authUser.id)
      .eq("period_month", periodMonth)
      .maybeSingle();

    const allowance = evaluateAiQuotaAllowance({
      planGroup,
      bucket,
      row: (quotaRow as UserAiQuotaRowSnapshot | null) ?? null,
      todayBrt: periodDay,
      nextDayResetAtIso,
      nextMonthResetAtIso,
    });

    if (!allowance.allowed) {
      return fallbackResponse(req, "quota_exceeded", 200, {
        quotaResetAt: allowance.resetAt,
      });
    }

    // 7. Monta prompt/schema por modo e executa Gemini 3.5 Flash-Lite
    let validatedOutput: unknown = null;
    let responseSource: "ai_text" | "ai_vision" = "ai_text";

    if (requestData.mode === "single_receipt") {
      const cleanedText = requestData.text
        ? maskSensitivePiiForAi(requestData.text).trim().slice(0, MAX_AI_SINGLE_RECEIPT_TEXT_CHARS)
        : "";
      const cleanImage = requestData.imageBase64
        ? stripBase64DataPrefix(requestData.imageBase64)
        : "";
      const hasImage = cleanImage.length > 0;
      responseSource = hasImage ? "ai_vision" : "ai_text";

      const parts: Array<Record<string, unknown>> = [
        { text: buildSingleReceiptPrompt(requestData.userFullName) },
      ];
      if (hasImage) {
        parts.push({
          inlineData: {
            mimeType: requestData.imageMimeType ?? "image/jpeg",
            data: cleanImage,
          },
        });
      }
      if (cleanedText.length >= MIN_USEFUL_TEXT_CHARS) {
        parts.push({
          text: hasImage
            ? `Texto OCR auxiliar (pode conter ruidos ou estar incompleto):\n${cleanedText}`
            : `Texto extraido do comprovante:\n${cleanedText}`,
        });
      }

      const gemini = await callGeminiJson({
        apiKey: geminiApiKey,
        models: modelCandidates,
        parts,
        responseSchema: GEMINI_SINGLE_RECEIPT_RESPONSE_SCHEMA,
        maxOutputTokens: 2_048,
      });
      if (!gemini.ok) return fallbackResponse(req, gemini.reason, 200);

      const parsed = AiSingleReceiptOutputSchema.safeParse(
        normalizeSingleReceiptAiPayload(gemini.payload),
      );
      if (!parsed.success) {
        console.warn("[ai-financial-assistant] single_receipt zod failed", {
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code })),
        });
        return fallbackResponse(req, "invalid_ai_output", 200);
      }
      validatedOutput = parsed.data;
    } else if (requestData.mode === "categorize_batch" && allowedCategoryIds) {
      const sanitizedDescriptions = requestData.descriptions.map((d) =>
        sanitizeBatchDescriptionForAi(d) || d.slice(0, 120),
      );

      const gemini = await callGeminiJson({
        apiKey: geminiApiKey,
        models: modelCandidates,
        parts: [
          { text: buildCategorizeBatchPrompt(sanitizedDescriptions, requestData.categories) },
        ],
        responseSchema: GEMINI_CATEGORIZE_BATCH_RESPONSE_SCHEMA,
        maxOutputTokens: 4_096,
      });
      if (!gemini.ok) return fallbackResponse(req, gemini.reason, 200);

      const parsed = validateCategorizeBatchOutput(
        gemini.payload,
        allowedCategoryIds,
        sanitizedDescriptions.length - 1,
      );
      if (!parsed.success) return fallbackResponse(req, "invalid_ai_output", 200);
      validatedOutput = parsed.data;
    } else if (requestData.mode === "statement_pdf_rows") {
      const sanitizedText = maskSensitivePiiForAi(requestData.text)
        .trim()
        .slice(0, MAX_AI_STATEMENT_PDF_TEXT_CHARS);
      if (!sanitizedText) return fallbackResponse(req, "invalid_payload", 400);

      const gemini = await callGeminiJson({
        apiKey: geminiApiKey,
        models: modelCandidates,
        parts: [{ text: buildStatementPdfRowsPrompt(sanitizedText, requestData.referenceYear) }],
        responseSchema: GEMINI_STATEMENT_PDF_ROWS_RESPONSE_SCHEMA,
        maxOutputTokens: 8_192,
      });
      if (!gemini.ok) return fallbackResponse(req, gemini.reason, 200);

      const parsed = AiStatementPdfRowsOutputSchema.safeParse(gemini.payload);
      if (!parsed.success || parsed.data.rows.length === 0) {
        return fallbackResponse(req, "invalid_ai_output", 200);
      }
      validatedOutput = parsed.data;
    }

    // 8. Somente apos validacao Zod + Whitelist OK: persiste cache LGPD e debita 1 credito atomico no balde certo
    const [{ error: cacheError }, { error: quotaError }] = await Promise.all([
      serviceClient.from("receipt_extractions_cache").upsert(
        {
          user_id: authUser.id,
          sha256: requestData.sha256,
          mode: requestData.mode,
          extracted_json: validatedOutput,
        },
        { onConflict: "user_id,sha256,mode" },
      ),
      serviceClient.rpc("increment_user_ai_quota_atomic", {
        p_user_id: authUser.id,
        p_bucket: bucket,
        p_period_month: periodMonth,
        p_period_day: periodDay,
      }),
    ]);

    if (cacheError) {
      console.error("[ai-financial-assistant] falha ao gravar cache LGPD:", cacheError.message);
    }
    if (quotaError) {
      console.error("[ai-financial-assistant] falha ao debitar cota atomica:", quotaError.message);
    }

    return jsonResponse(req, {
      ok: true,
      mode: requestData.mode,
      cached: false,
      source: responseSource,
      data: validatedOutput,
    });
  } catch (err) {
    console.error(
      "[ai-financial-assistant] falha inesperada:",
      err instanceof Error ? err.message : String(err),
    );
    return fallbackResponse(req, "upstream_unavailable", 200);
  }
});
