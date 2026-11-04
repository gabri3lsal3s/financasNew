import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { currentUserId } from "@/data/session";
import { AppError, classifyError } from "@/services/errors";
import type { AppAnalyticsEvent, FeatureUsageMetric } from "@/types";

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
    console.warn("[analytics] Falha ao enviar lote de eventos:", error.message);
  }
}

/**
 * Consulta a agregação de uso de funcionalidades nos últimos N dias para a tela de admin.
 */
export async function getFeatureUsageRanking(days = 30): Promise<FeatureUsageMetric[]> {
  const sinceDate = new Date();
  sinceDate.setDate(sinceDate.getDate() - days);

  const { data, error } = await resolveQuery<AppAnalyticsEvent[]>(
    getSupabase()
      .from("app_analytics_events")
      .select("module, created_at")
      .gte("created_at", sinceDate.toISOString()),
  );

  if (error) {
    const classified = classifyError(error);
    throw new AppError(classified.kind, classified.message, error);
  }

  const events = data ?? [];
  const total = events.length;
  if (total === 0) return [];

  const countsByModule = new Map<string, { count: number; lastUsedAt: string }>();

  for (const ev of events) {
    const mod = ev.module || "outros";
    const existing = countsByModule.get(mod);
    if (!existing) {
      countsByModule.set(mod, { count: 1, lastUsedAt: ev.created_at });
    } else {
      existing.count += 1;
      if (new Date(ev.created_at) > new Date(existing.lastUsedAt)) {
        existing.lastUsedAt = ev.created_at;
      }
    }
  }

  const ranking: FeatureUsageMetric[] = [];
  for (const [moduleName, info] of countsByModule.entries()) {
    ranking.push({
      module: moduleName,
      count: info.count,
      percentage: Math.round((info.count / total) * 100),
      lastUsedAt: info.lastUsedAt,
    });
  }

  ranking.sort((a, b) => b.count - a.count);
  return ranking;
}
