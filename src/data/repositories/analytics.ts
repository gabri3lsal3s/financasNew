import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { callRpc, unwrapRpc } from "@/data/rpc";
import { currentUserId } from "@/data/session";
import { reportError } from "@/services/observability";
import type { FeatureUsageMetric } from "@/types";

export interface LogAnalyticsEventInput {
  event_name: string;
  module: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persiste um lote de eventos analíticos no Supabase.
 * Executado de forma assíncrona e resiliente pelo tracker.
 */
export async function logAnalyticsBatch(
  events: LogAnalyticsEventInput[],
): Promise<void> {
  if (events.length === 0) return;

  let userId: string | null = null;
  try {
    userId = await currentUserId();
  } catch {
    // Permite log de sessões não autenticadas / anônimas
  }

  const records = events.map((ev) => ({
    user_id: userId,
    event_name: ev.event_name,
    module: ev.module,
    metadata: ev.metadata ?? {},
  }));

  const { error } = await resolveQuery(
    getSupabase().from("app_analytics_events").insert(records),
  );

  if (error) {
    // Falha silenciosa para não quebrar a navegação do usuário
    reportError(error, { source: "analytics.logAnalyticsBatch", count: events.length });
  }
}

interface AdminFeatureUsageRankingRow {
  module: string;
  count: number;
  percentage: number;
  last_used_at: string | null;
}

/**
 * Consulta a agregação de uso de funcionalidades nos últimos N dias para a tela de admin via RPC segura.
 */
export async function getFeatureUsageRanking(days = 30): Promise<FeatureUsageMetric[]> {
  const rows = await unwrapRpc(
    callRpc("admin_get_feature_usage_ranking" as never, {
      p_days: days,
    } as never),
  );

  return ((rows ?? []) as AdminFeatureUsageRankingRow[]).map((row) => ({
    module: row.module || "outros",
    count: Number(row.count ?? 0),
    percentage: Number(row.percentage ?? 0),
    lastUsedAt: row.last_used_at ?? null,
  }));
}
