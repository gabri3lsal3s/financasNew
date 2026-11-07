import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

interface QuickExpensePayload {
  amount_cents?: number;
  amount?: number | string;
  description?: string;
  date?: string;
  payment_method?: string;
  category_id?: string;
  text?: string;
  raw_text?: string;
}

/**
 * Calcula o hash SHA-256 em formato hexadecimal de uma string.
 */
async function computeSha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Extrai valor monetário em centavos a partir de texto ou número livre.
 */
function extractAmountCents(payload: QuickExpensePayload): number | null {
  if (typeof payload.amount_cents === "number" && payload.amount_cents > 0) {
    return Math.round(payload.amount_cents);
  }

  if (typeof payload.amount === "number" && payload.amount > 0) {
    return Math.round(payload.amount * 100);
  }

  if (typeof payload.amount === "string") {
    const cleaned = payload.amount
      .replace(/[^\d,.-]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
    const parsed = parseFloat(cleaned);
    if (!isNaN(parsed) && parsed > 0) {
      return Math.round(parsed * 100);
    }
  }

  const textToScan = payload.text || payload.raw_text;
  if (textToScan) {
    const match = /(?:r\$\s*|valor\s*[:=]?\s*r?\$\s*)([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:[.,][0-9]{2})?)/i.exec(
      textToScan,
    );
    if (match && match[1]) {
      const normalized = match[1].replace(/\./g, "").replace(",", ".");
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed) && parsed > 0) {
        return Math.round(parsed * 100);
      }
    }
  }

  return null;
}

/**
 * Resolve descrição da despesa.
 */
function resolveDescription(payload: QuickExpensePayload): string {
  if (payload.description && payload.description.trim()) {
    return payload.description.trim().slice(0, 150);
  }

  const textToScan = payload.text || payload.raw_text;
  if (textToScan) {
    const lines = textToScan.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean);
    if (lines[0]) {
      return lines[0].slice(0, 150);
    }
  }

  return "Lançamento Rápido iOS";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: buildCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return jsonResponse(req, { error: "Método não permitido" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return safeErrorResponse(req, 500, "Configuração do servidor incompleta.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Extração do Token
    const authHeader = req.headers.get("Authorization");
    const customHeader = req.headers.get("x-quick-token");
    const url = new URL(req.url);
    const queryToken = url.searchParams.get("token");

    let rawToken: string | null = null;
    if (authHeader?.startsWith("Bearer ")) {
      rawToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    } else if (customHeader) {
      rawToken = customHeader.trim();
    } else if (queryToken) {
      rawToken = queryToken.trim();
    }

    if (!rawToken || !rawToken.startsWith("axq_")) {
      return safeErrorResponse(
        req,
        401,
        "Token de autorização rápido ausente ou inválido. Use um token com prefixo axq_.",
      );
    }

    // 2. Validação criptográfica do Hash do Token
    const tokenHash = await computeSha256Hex(rawToken);

    const { data: quickToken, error: tokenErr } = await supabaseAdmin
      .from("user_quick_tokens")
      .select("id, user_id, scopes, revoked_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (tokenErr || !quickToken) {
      return safeErrorResponse(req, 401, "Token não encontrado ou revogado.");
    }

    const scopes = (quickToken.scopes as string[]) || [];
    if (!scopes.includes("expense:write")) {
      return safeErrorResponse(req, 403, "Token não possui permissão para criação de despesas.");
    }

    // 3. Processamento do Payload
    const payload: QuickExpensePayload = await req.json().catch(() => ({}));
    const amountCents = extractAmountCents(payload);

    if (!amountCents || amountCents <= 0) {
      return safeErrorResponse(
        req,
        400,
        "Valor da despesa inválido. Envie amount_cents como inteiro positivo ou amount numérico.",
      );
    }

    const description = resolveDescription(payload);
    const date = payload.date && /^\d{4}-\d{2}-\d{2}$/.test(payload.date)
      ? payload.date
      : new Date().toISOString().split("T")[0];

    const paymentMethod = payload.payment_method || "pix";

    // 4. Resolução da categoria de despesa (usa a informada ou primeira categoria ativa do usuário)
    let categoryId = payload.category_id;
    if (!categoryId) {
      const { data: defaultCat } = await supabaseAdmin
        .from("categories")
        .select("id")
        .eq("user_id", quickToken.user_id)
        .eq("type", "expense")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      categoryId = defaultCat?.id;
    }

    if (!categoryId) {
      return safeErrorResponse(
        req,
        400,
        "Nenhuma categoria de despesa encontrada para vincular o lançamento.",
      );
    }

    // 5. Inserção server-authoritative da despesa
    const { data: expense, error: insertErr } = await supabaseAdmin
      .from("expenses")
      .insert({
        user_id: quickToken.user_id,
        amount_cents: amountCents,
        description,
        date,
        payment_method: paymentMethod,
        category_id: categoryId,
        report_weight: 1.0,
      })
      .select("id, amount_cents, description, date, payment_method, category_id")
      .single();

    if (insertErr || !expense) {
      return safeErrorResponse(req, 500, "Falha ao registrar a despesa no banco de dados.", insertErr);
    }

    // 6. Atualização atômica do timestamp de último uso do token
    await supabaseAdmin
      .from("user_quick_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", quickToken.id);

    return jsonResponse(
      req,
      {
        success: true,
        data: expense,
        message: `Despesa '${description}' no valor de R$ ${(amountCents / 100).toFixed(2).replace(".", ",")} lançada com sucesso.`,
      },
      201,
    );
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro interno ao processar requisição rápida.", err);
  }
});
