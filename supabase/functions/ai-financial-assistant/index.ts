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
  AI_CUT_TIERS,
  AI_SERVICE_SEGMENTS,
  AI_STATEMENT_ENTRY_TYPES,
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
  normalizeStatementPdfRowsAiPayload,
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

const GEMINI_PRIMARY_TIMEOUT_MS = 7_000;
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
    merchantCnpj: { type: "STRING", nullable: true },
    payerOrSource: { type: "STRING", nullable: true },
    bankName: { type: "STRING", nullable: true },
    cardLastDigits: { type: "STRING", nullable: true },
    cardBrand: { type: "STRING", nullable: true },
    installmentsCount: { type: "INTEGER", nullable: true },
    isSameTitularity: { type: "BOOLEAN", nullable: true },
    categoryId: { type: "STRING", nullable: true },
    originalCurrency: { type: "STRING", nullable: true },
    originalAmountCents: { type: "INTEGER", nullable: true },
    semanticTags: {
      type: "ARRAY",
      nullable: true,
      items: { type: "STRING" },
    },
    inferredScope: { type: "STRING", enum: ["personal", "business"], nullable: true },
    isTaxDeductible: { type: "BOOLEAN", nullable: true },
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
          canonicalMerchant: { type: "STRING", nullable: true },
          serviceSegment: { type: "STRING", enum: [...AI_SERVICE_SEGMENTS], nullable: true },
          cutTier: { type: "STRING", enum: [...AI_CUT_TIERS], nullable: true },
          isSubscription: { type: "BOOLEAN", nullable: true },
          semanticTags: {
            type: "ARRAY",
            nullable: true,
            items: { type: "STRING" },
          },
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
          entryType: { type: "STRING", enum: [...AI_STATEMENT_ENTRY_TYPES], nullable: true },
        },
        required: ["date", "description", "amountCents"],
      },
    },
  },
  required: ["rows"],
};

function buildSingleReceiptPrompt(
  userFullName?: string,
  categories?: readonly { id: string; name: string; type?: "expense" | "income" }[],
): string {
  const titularLine = userFullName
    ? `Titular do app: "${userFullName}". Compare pagador e recebedor para definir nature ("income" se recebeu, "expense" se pagou) e isSameTitularity (true somente se mesmo titular nos dois polos, senao false/null).`
    : 'Defina nature ("expense" ou "income") e isSameTitularity apenas com base explicita no documento.';

  const lines = [
    "Extrator financeiro estruturado BR. Retorne JSON estrito.",
    "1) amountCents: inteiro positivo em centavos do valor efetivamente pago/recebido (desconsidere saldo/descontos nao pagos).",
    "2) date: YYYY-MM-DD ou null se ausente.",
    `3) ${titularLine}`,
    "4) description: nome comercial limpo da contraparte (sem banco, sem 'comprovante de'); merchantCnpj: apenas os 14 digitos do CNPJ do estabelecimento/recebedor (NUNCA CPF) ou null.",
    "5) originalCurrency e originalAmountCents: preencha com codigo ISO-4217 de 3 letras (ex.: USD, EUR, ARS) e valor em centavos somente se o recibo estiver em moeda estrangeira != BRL; caso contrario null.",
    "6) semanticTags: ate 4 tags curtas em portugues (sem acento/minusculas) dos produtos/servicos do recibo para busca futura (ex.: ['pet','racao'], ['reforma','eletrica']); ou null.",
    "7) inferredScope e isTaxDeductible: se for despesa empresarial ou nota fiscal com CNPJ para fins profissionais/negocio (ex.: insumos, softwares B2B, material de escritorio, consultoria, DAS MEI), defina inferredScope='business'; se for domestica/familiar, 'personal'. Se a despesa for dedutivel no Livro-Caixa / Carne-Leao (insumos diretos, material de escritorio, softwares de trabalho, cursos da profissao, coworking), defina isTaxDeductible=true; senao false/null.",
    "8) Nunca invente campos opcionais ausentes (use null) e sinalize fieldConfidence realista ('high' somente quando inequivoco).",
  ];

  if (categories && categories.length > 0) {
    lines.push(
      "9) categoryId: analise o estabelecimento E os produtos/itens listados no comprovante (priorize os itens de maior valor se houver varios) e escolha o id EXATO mais adequado ao tipo (expense/income) da lista abaixo, ou null se nenhuma encaixar. PROIBIDO inventar id.",
      `Categorias do usuario: ${JSON.stringify(categories)}`,
    );
  }

  return lines.join("\n");
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
    "3) `canonicalMerchant`: nome canonico curto da marca sem prefixos de maquininha/assinatura (ex.: 'DL*GOOGLE YOUTUB' -> 'YouTube', 'MP *MELI+' -> 'Meli+') ou null.",
    "4) `isSubscription`: true somente se for assinatura/mensalidade recorrente tipica (streaming, academia, nuvem/IA, clube), senao false/null.",
    "5) `serviceSegment`: streaming|fitness|cloud_ai|telecom|mobility|delivery|utilities|health|education|other (ou null).",
    "6) `cutTier`: essential|discretionary|can_cut (ou null).",
    "7) `semanticTags`: ate 4 palavras-chave curtas de busca em pt-BR (ex.: ['pet','veterinario'] ou ['streaming','musica']), ou null.",
    "PROIBIDO inventar ou alterar qualquer `categoryId`. Responda em JSON estrito.",
    "",
    "Categorias disponiveis (whitelist):",
    JSON.stringify(categories),
    "",
    "Descricoes indexadas:",
    JSON.stringify(descriptions.map((desc, index) => ({ index, description: desc }))),
  ].join("\n");
}

function buildStatementPdfRowsPrompt(params: {
  competenceMonth?: string;
  referenceYear?: number;
  hasImage: boolean;
}): string {
  const competenceHint = params.competenceMonth
    ? `Competencia da fatura: ${params.competenceMonth} (se a linha tiver apenas DD/MM e o mes for posterior ao mes da competencia, ex.: DEZ numa fatura JAN, use o ano anterior).`
    : params.referenceYear
      ? `Ano de referencia para datas DD/MM: ${params.referenceYear}.`
      : "Use o ano explicito do documento para datas DD/MM.";

  return [
    params.hasImage
      ? "Extrator estruturado de fatura de cartao (imagem/print). Retorne JSON estrito."
      : "Extrator estruturado de linhas de fatura de cartao. Retorne JSON estrito.",
    competenceHint,
    "1) Extraia APENAS lancamentos individuais (compras, encargos/IOF/anuidade, estornos e pagamentos de fatura anterior).",
    "2) IGNORE totais, resumos, limites, pagamento minimo, cabecalhos e simulacoes de parcelamento da fatura (ex.: '12x de R$').",
    "3) date: YYYY-MM-DD; description: nome limpo do estabelecimento/lancamento.",
    "4) Compras internacionais: use SEMPRE o valor final convertido em BRL (R$), nunca USD/EUR puro.",
    "5) entryType e amountCents (centavos inteiros, nunca 0): 'purchase' ou 'charge' (IOF/juros/multa/anuidade) -> POSITIVO; 'refund' (estorno/credito) ou 'payment' (pagamento da fatura anterior) -> NEGATIVO.",
    "6) Parcelas (ex.: 02/10): preencha installmentCurrent e installmentTotal (total >= 2); senao null. NUNCA some valores.",
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
    const requestData = parsedRequest.data;
    const bucket: AiQuotaBucket =
      requestData.mode === "single_receipt" ? "receipt_calls" : "batch_calls";
    const { periodMonth, periodDay, nextDayResetAtIso, nextMonthResetAtIso } = getBrtQuotaPeriods();

    // 4. Buscas paralelas de acesso, Cache LGPD (0 debitos em hit) e snapshot de cota (1 unico round-trip ao DB)
    const [profileRes, subRes, featureRes, overrideRes, cacheRes, quotaRes] = await Promise.all([
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
      serviceClient
        .from("receipt_extractions_cache")
        .select("extracted_json, created_at")
        .eq("user_id", authUser.id)
        .eq("sha256", requestData.sha256)
        .eq("mode", requestData.mode)
        .maybeSingle(),
      serviceClient
        .from("user_ai_quotas")
        .select(
          "period_day, receipt_calls_month, receipt_calls_day, batch_calls_month, batch_calls_day",
        )
        .eq("user_id", authUser.id)
        .eq("period_month", periodMonth)
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

    const allowedBatchCategoryIds =
      requestData.mode === "categorize_batch"
        ? new Set(requestData.categories.map((c) => c.id))
        : null;

    const allowedSingleReceiptCategoryIds =
      requestData.mode === "single_receipt" && requestData.categories?.length
        ? new Set(requestData.categories.map((c) => c.id))
        : undefined;

    // 5. Verifica Cache LGPD por (user_id, sha256, mode) ANTES de debitar cota
    const cacheRow = cacheRes.data as { extracted_json?: unknown; created_at?: string } | null;
    if (
      cacheRow?.extracted_json &&
      isAiCacheEntryFresh(cacheRow.created_at, requestData.mode)
    ) {
      if (requestData.mode === "single_receipt") {
        const cachedRecord =
          cacheRow.extracted_json && typeof cacheRow.extracted_json === "object"
            ? (cacheRow.extracted_json as Record<string, unknown>)
            : null;
        const isLegacyCacheMissingCategory =
          Boolean(requestData.categories?.length) &&
          Boolean(cachedRecord) &&
          !("categoryId" in cachedRecord);
        if (!isLegacyCacheMissingCategory) {
          const validatedCached = AiSingleReceiptOutputSchema.safeParse(
            normalizeSingleReceiptAiPayload(
              cacheRow.extracted_json,
              allowedSingleReceiptCategoryIds,
            ),
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
        }
      } else if (requestData.mode === "statement_pdf_rows") {
        const validatedCached = AiStatementPdfRowsOutputSchema.safeParse(
          normalizeStatementPdfRowsAiPayload(cacheRow.extracted_json),
        );
        if (validatedCached.success && validatedCached.data.rows.length > 0) {
          return jsonResponse(req, {
            ok: true,
            mode: "statement_pdf_rows",
            cached: true,
            source: "cache_remote",
            data: validatedCached.data,
          });
        }
      } else if (requestData.mode === "categorize_batch" && allowedBatchCategoryIds) {
        const validatedCached = validateCategorizeBatchOutput(
          cacheRow.extracted_json,
          allowedBatchCategoryIds,
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
    const callPriority =
      requestData.mode === "categorize_batch"
        ? (requestData.priority ?? "passive")
        : "active";

    const allowance = evaluateAiQuotaAllowance({
      planGroup,
      bucket,
      row: (quotaRes.data as UserAiQuotaRowSnapshot | null) ?? null,
      todayBrt: periodDay,
      nextDayResetAtIso,
      nextMonthResetAtIso,
      priority: callPriority,
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
        { text: buildSingleReceiptPrompt(requestData.userFullName, requestData.categories) },
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
        normalizeSingleReceiptAiPayload(gemini.payload, allowedSingleReceiptCategoryIds),
      );
      if (!parsed.success) {
        console.warn("[ai-financial-assistant] single_receipt zod failed", {
          issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), code: i.code })),
        });
        return fallbackResponse(req, "invalid_ai_output", 200);
      }
      validatedOutput = {
        ...parsed.data,
        merchantCnpj: parsed.data.merchantCnpj ?? null,
        categoryId: parsed.data.categoryId ?? null,
        inferredScope: parsed.data.inferredScope ?? null,
        isTaxDeductible: typeof parsed.data.isTaxDeductible === "boolean" ? parsed.data.isTaxDeductible : null,
      };
    } else if (requestData.mode === "categorize_batch" && allowedBatchCategoryIds) {
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
        allowedBatchCategoryIds,
        sanitizedDescriptions.length - 1,
      );
      if (!parsed.success) return fallbackResponse(req, "invalid_ai_output", 200);
      validatedOutput = parsed.data;
    } else if (requestData.mode === "statement_pdf_rows") {
      const sanitizedText = requestData.text
        ? maskSensitivePiiForAi(requestData.text).trim().slice(0, MAX_AI_STATEMENT_PDF_TEXT_CHARS)
        : "";
      const cleanImage = requestData.imageBase64
        ? stripBase64DataPrefix(requestData.imageBase64)
        : "";
      const hasImage = cleanImage.length > 0;
      if (!sanitizedText && !hasImage) {
        return fallbackResponse(req, "invalid_payload", 400);
      }
      responseSource = hasImage ? "ai_vision" : "ai_text";

      const parts: Array<Record<string, unknown>> = [
        {
          text: buildStatementPdfRowsPrompt({
            competenceMonth: requestData.competenceMonth,
            referenceYear: requestData.referenceYear,
            hasImage,
          }),
        },
      ];
      if (hasImage) {
        parts.push({
          inlineData: {
            mimeType: requestData.imageMimeType ?? "image/jpeg",
            data: cleanImage,
          },
        });
      }
      if (sanitizedText) {
        parts.push({ text: `Fatura:\n${sanitizedText}` });
      }

      const gemini = await callGeminiJson({
        apiKey: geminiApiKey,
        models: modelCandidates,
        parts,
        responseSchema: GEMINI_STATEMENT_PDF_ROWS_RESPONSE_SCHEMA,
        maxOutputTokens: 8_192,
      });
      if (!gemini.ok) return fallbackResponse(req, gemini.reason, 200);

      const parsed = AiStatementPdfRowsOutputSchema.safeParse(
        normalizeStatementPdfRowsAiPayload(gemini.payload),
      );
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
