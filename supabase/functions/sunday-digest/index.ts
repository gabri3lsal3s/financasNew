import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  buildCorsHeaders,
  jsonResponse,
  safeErrorResponse,
  timingSafeEqualString,
} from "../_shared/http.ts";
import { renderSundayDigestEmail } from "../_shared/email-templates.ts";
import { sendTransactionalEmail } from "../_shared/resend.ts";

interface EligiblePreferenceRow {
  user_id: string;
  report_weights_enabled?: boolean | null;
  custom_settings: {
    deviceNotifications?: {
      remotePushEnabled?: boolean;
    };
  } | null;
}

interface ProfileRow {
  id: string;
  email: string | null;
  name: string | null;
  status: string;
}

function formatCentsPtBr(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function getSaoPauloDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((p) => p.type === "year")?.value ?? "2026";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatShortBrDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  if (!month || !day) return isoDate;
  return `${day}/${month}`;
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
    const cronSecret = Deno.env.get("CRON_SECRET");

    if (!supabaseUrl || !supabaseServiceKey) {
      return safeErrorResponse(req, 500, "Configuração do servidor incompleta.");
    }

    const auth = req.headers.get("authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();
    const isServiceKey =
      token.length > 0 && (await timingSafeEqualString(token, supabaseServiceKey));
    const isCronSecret =
      token.length > 0 &&
      Boolean(cronSecret) &&
      (await timingSafeEqualString(token, cronSecret!));

    if (!isServiceKey && !isCronSecret) {
      return jsonResponse(req, { error: "unauthorized" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "https://axir.com.br").replace(/\/+$/, "");

    // Paginação por lotes de 250 para evitar truncamento silencioso em crescimento da base
    const eligiblePrefs: EligiblePreferenceRow[] = [];
    const pageSize = 250;
    for (let offset = 0; ; offset += pageSize) {
      const { data: batchPrefs, error: prefsErr } = await supabaseAdmin
        .from("user_preferences")
        .select("user_id, report_weights_enabled, custom_settings")
        .eq("weekly_digest_enabled", true)
        .order("user_id", { ascending: true })
        .range(offset, offset + pageSize - 1);

      if (prefsErr) {
        return safeErrorResponse(
          req,
          500,
          "Erro ao buscar preferências do resumo dominical.",
          prefsErr,
        );
      }

      const rows = (batchPrefs ?? []) as EligiblePreferenceRow[];
      eligiblePrefs.push(...rows);
      if (rows.length < pageSize) break;
    }

    if (eligiblePrefs.length === 0) {
      return jsonResponse(req, {
        success: true,
        processedUsersCount: 0,
        sentEmailsCount: 0,
        skippedCount: 0,
        failedCount: 0,
        pushDispatchedCount: 0,
      });
    }

    const eligibleUserIds = eligiblePrefs.map((p) => p.user_id);
    const activeProfiles: ProfileRow[] = [];
    for (let i = 0; i < eligibleUserIds.length; i += 250) {
      const chunkIds = eligibleUserIds.slice(i, i + 250);
      const { data: batchProfiles, error: profErr } = await supabaseAdmin
        .from("profiles")
        .select("id, email, name, status")
        .in("id", chunkIds)
        .eq("status", "active");

      if (profErr) {
        return safeErrorResponse(
          req,
          500,
          "Erro ao buscar perfis ativos para o resumo dominical.",
          profErr,
        );
      }
      activeProfiles.push(...((batchProfiles ?? []) as ProfileRow[]));
    }

    // Identifica quais usuários ativos são assinantes PRO/Vitalícios para aplicar a identidade Ouro Âmbar PRO no e-mail
    const proSubscriberIds = new Set<string>();
    const activeProfileIds = activeProfiles.map((p) => p.id);
    for (let i = 0; i < activeProfileIds.length; i += 250) {
      const chunkIds = activeProfileIds.slice(i, i + 250);
      const { data: batchSubs } = await supabaseAdmin
        .from("user_subscriptions")
        .select("user_id, tier, status")
        .in("user_id", chunkIds);

      for (const sub of (batchSubs ?? []) as Array<{ user_id: string; tier?: string; status?: string }>) {
        const isProTier = sub.tier === "pro_monthly" || sub.tier === "pro_annual" || sub.tier === "lifetime";
        const isValidStatus = sub.status === "active" || sub.status === "past_due";
        if (isProTier && isValidStatus) {
          proSubscriberIds.add(sub.user_id);
        }
      }
    }

    const prefMap = new Map(eligiblePrefs.map((p) => [p.user_id, p]));
    const now = new Date();
    const todayIso = getSaoPauloDateString(now);
    // Janela exata de 7 dias corridos (hoje e os 6 dias anteriores)
    const weekStartIso = getSaoPauloDateString(
      new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000),
    );
    const nextSixDaysIso = getSaoPauloDateString(
      new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000),
    );
    const overdueFloorIso = getSaoPauloDateString(
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    );
    const periodLabel = `${formatShortBrDate(weekStartIso)} a ${formatShortBrDate(todayIso)}`;

    let processedUsersCount = 0;
    let sentEmailsCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let pushDispatchedCount = 0;

    for (const profile of activeProfiles) {
      if (!profile.email) continue;
      processedUsersCount++;

      const userPref = prefMap.get(profile.id);
      const weightsEnabled = userPref?.report_weights_enabled !== false;

      const [expensesRes, categoriesRes, debtsRes] = await Promise.all([
        supabaseAdmin
          .from("expenses")
          .select("value, report_weight, category_id")
          .eq("user_id", profile.id)
          .gte("date", weekStartIso)
          .lte("date", todayIso),
        supabaseAdmin
          .from("categories")
          .select("id, name")
          .eq("user_id", profile.id)
          .eq("type", "expense"),
        supabaseAdmin
          .from("debts")
          .select("amount, due_date, name")
          .eq("user_id", profile.id)
          .eq("type", "payable")
          .is("paid_at", null)
          .gte("due_date", overdueFloorIso)
          .lte("due_date", nextSixDaysIso),
      ]);

      if (expensesRes.error || categoriesRes.error || debtsRes.error) {
        console.warn(
          `[sunday-digest] Erro ao consultar dados financeiros de ${profile.id}; pulando envio para evitar resumo incorreto.`,
          {
            expensesErr: expensesRes.error?.message,
            categoriesErr: categoriesRes.error?.message,
            debtsErr: debtsRes.error?.message,
          },
        );
        failedCount++;
        continue;
      }

      const expenseRows = (expensesRes.data ?? []) as Array<{
        value: number | string;
        report_weight?: number | string | null;
        category_id?: string | null;
      }>;
      const categoryRows = (categoriesRes.data ?? []) as Array<{
        id: string;
        name: string;
      }>;
      const debtRows = (debtsRes.data ?? []) as Array<{
        amount: number | string;
        due_date: string;
        name?: string | null;
      }>;

      const categoryNameById = new Map(categoryRows.map((c) => [c.id, c.name]));
      const categoryTotals = new Map<string, number>();

      let totalWeeklySpentCents = 0;
      let effectiveExpenseCount = 0;
      for (const row of expenseRows) {
        const parsedWeight = Number(row.report_weight);
        const rawWeight = Number.isFinite(parsedWeight) ? parsedWeight : 1;
        const effectiveWeight = weightsEnabled ? Math.max(0, rawWeight) : 1;
        if (effectiveWeight <= 0) continue;

        effectiveExpenseCount += 1;
        const baseCents = Math.round(Number(row.value || 0) * 100);
        const cents = Math.round(baseCents * effectiveWeight);
        totalWeeklySpentCents += cents;
        if (row.category_id) {
          categoryTotals.set(
            row.category_id,
            (categoryTotals.get(row.category_id) ?? 0) + cents,
          );
        }
      }

      let topCategoryName: string | null = null;
      let topCategorySpentCents = 0;
      for (const [catId, cents] of categoryTotals.entries()) {
        if (cents > topCategorySpentCents) {
          topCategorySpentCents = cents;
          topCategoryName = categoryNameById.get(catId) ?? null;
        }
      }

      const upcomingTotalCents = debtRows.reduce(
        (acc, row) => acc + Math.round(Number(row.amount || 0) * 100),
        0,
      );

      const isUserPro = proSubscriberIds.has(profile.id);

      const emailData = renderSundayDigestEmail({
        name: profile.name || "Cliente",
        periodLabel,
        totalWeeklySpentBRL: formatCentsPtBr(totalWeeklySpentCents),
        expenseCount: effectiveExpenseCount,
        topCategoryName,
        topCategorySpentBRL:
          topCategoryName && topCategorySpentCents > 0
            ? formatCentsPtBr(topCategorySpentCents)
            : null,
        upcomingCount: debtRows.length,
        upcomingTotalBRL: formatCentsPtBr(upcomingTotalCents),
        appUrl,
        managePrefsUrl: `${appUrl}/configuracoes?tab=notifications`,
        isPro: isUserPro,
      });

      const emailResult = await sendTransactionalEmail(supabaseAdmin, {
        to: profile.email,
        subject: emailData.subject,
        template: "sunday_digest",
        html: emailData.html,
        text: emailData.text,
        userId: profile.id,
        idempotencyKey: `sunday_digest_${profile.id}_${todayIso}`,
        metadata: {
          periodLabel,
          expenseCount: effectiveExpenseCount,
          upcomingCount: debtRows.length,
        },
      });

      if (emailResult.success && emailResult.skipped) {
        skippedCount++;
      } else if (emailResult.success) {
        sentEmailsCount++;
      } else if (emailResult.skipped) {
        skippedCount++;
      } else {
        failedCount++;
      }

      // Push remoto opcional para usuários opt-in (não dispara em semana vazia para evitar ruído)
      if (
        emailResult.success &&
        !emailResult.skipped &&
        userPref?.custom_settings?.deviceNotifications?.remotePushEnabled === true &&
        (effectiveExpenseCount > 0 || debtRows.length > 0)
      ) {
        try {
          const pushBody =
            effectiveExpenseCount > 0
              ? `Gastos da semana: ${formatCentsPtBr(totalWeeklySpentCents)}. Toque para conferir.`
              : `Você tem ${debtRows.length} conta(s) em aberto nos próximos dias. Toque para conferir.`;
          const pushRes = await fetch(`${supabaseUrl}/functions/v1/push-dispatcher`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${supabaseServiceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              eventType: "sunday_digest",
              targetUserIds: [profile.id],
              title: "Resumo Semanal Axir",
              body: pushBody,
              url: "/",
              tag: `sunday_digest_${todayIso}`,
              severity: "P2",
              idempotencyKey: `push_sunday_digest_${profile.id}_${todayIso}`,
              respectQuietHours: true,
            }),
          });
          if (pushRes.ok) {
            const pushJson = (await pushRes.json().catch(() => null)) as { delivered?: number } | null;
            if (Number(pushJson?.delivered ?? 0) > 0) {
              pushDispatchedCount++;
            }
          }
        } catch (pushErr) {
          console.warn(
            `[sunday-digest] Falha não bloqueante ao despachar push para ${profile.id}:`,
            pushErr,
          );
        }
      }
    }

    return jsonResponse(req, {
      success: true,
      periodLabel,
      processedUsersCount,
      sentEmailsCount,
      skippedCount,
      failedCount,
      pushDispatchedCount,
    });
  } catch (err) {
    return safeErrorResponse(
      req,
      500,
      "Erro ao processar o fechamento dominical.",
      err,
    );
  }
});
