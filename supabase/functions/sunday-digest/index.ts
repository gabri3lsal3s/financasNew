import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildCorsHeaders, jsonResponse, safeErrorResponse } from "../_shared/http.ts";

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
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!supabaseUrl || !supabaseServiceKey) {
      return safeErrorResponse(req, 500, "Configuração do servidor incompleta.");
    }

    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const isAuthorized =
      (token.length > 0 && token === supabaseServiceKey) ||
      (Boolean(cronSecret) && token === cronSecret);

    if (!isAuthorized) {
      return jsonResponse(req, { error: "unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Identifica usuários ativos para consolidação semanal
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, full_name")
      .limit(100);

    if (profErr) {
      return safeErrorResponse(req, 500, "Erro ao buscar perfis para o resumo dominical.", profErr);
    }

    const summaryResults = [];
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    for (const profile of profiles || []) {
      const { data: weeklyExpenses } = await supabaseAdmin
        .from("expenses")
        .select("amount_cents")
        .eq("user_id", profile.id)
        .gte("date", sevenDaysAgo);

      const totalWeeklySpentCents = (weeklyExpenses || []).reduce(
        (acc: number, cur: { amount_cents: number }) => acc + (cur.amount_cents || 0),
        0,
      );

      summaryResults.push({
        userId: profile.id,
        email: profile.email,
        totalWeeklySpentCents,
      });
    }

    return jsonResponse(req, {
      success: true,
      processedUsersCount: summaryResults.length,
      digests: summaryResults,
    });
  } catch (err) {
    return safeErrorResponse(req, 500, "Erro ao processar o fechamento dominical.", err);
  }
});
