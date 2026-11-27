/**
 * Motor Puro de Governanca de Atencao (Attention Budget) e Smart Decay — PLANO MESTRE FASE 3.
 *
 * Responsavel por:
 *   - Limitar a densidade de banners/cards simultaneos na Home (carrossel + banners operacionais);
 *   - Ativar foco unico (1 slide) quando houver alerta critico P0 (`priority <= 1`);
 *   - Garantir silencio intencional quando a conta esta saudavel e sem acoes urgentes;
 *   - Aplicar decaimento inteligente progressivo (`7d -> 30d -> 90d`) e oferta de pausa por familia de insight.
 *
 * 100% puro — zero dependencias de React, UI ou Supabase.
 */

import type { InsightThemeFamily, SmartDecayRecord } from "./learning-graph";
export type { InsightThemeFamily, SmartDecayRecord };

/**
 * Mapeia uma `themeKey` para sua familia semantica de Smart Decay.
 */
export function resolveInsightThemeFamily(themeKey: string): InsightThemeFamily {
  return resolveThemeFamily(themeKey);
}

export type InsightSurfaceLayer = "attention_now" | "to_organize" | "on_track_celebration";

export type InsightTone = "critical" | "warning" | "consultative" | "positive" | "neutral";

export interface GovernedInsightItem {
  id: string;
  themeKey: string;
  family: InsightThemeFamily;
  layer: InsightSurfaceLayer;
  tone: InsightTone;
  priorityScore: number; // 0..100 (deterministico)
  title: string;
  description: string;
  /** Rotulo transparente de base de calculo (ex.: "Base: renda habitual prevista"). */
  contextTag?: string;
  /** Payload para Memoria de Calculo (?) sempre sincronizado. */
  calculationBasis?: Record<string, number | string | boolean | null>;
}

export interface AttentionBudgetPolicy {
  /** Maximo de itens no carrossel da Home (padrao: 3 na Onda 2; 1 se houver alerta critico P0). */
  homeMaxCards: number;
  /** Maximo de banners operacionais fora do carrossel expandidos acima da dobra na Home (padrao: 1). */
  homeMaxOperationalBanners: number;
  /** Maximo de itens abertos inicialmente na camada "Atencao agora" em Insights. */
  insightsAttentionMaxVisible: number;
  /** Maximo de perguntas de micro-calibracao simultaneas. */
  maxCalibrationsVisible: number;
  /** Permite silencio intencional na Home quando tudo esta saudavel e sem acoes urgentes. */
  allowIntentionalSilence: boolean;
}

export const DEFAULT_ATTENTION_BUDGET_POLICY: AttentionBudgetPolicy = {
  homeMaxCards: 3,
  homeMaxOperationalBanners: 1,
  insightsAttentionMaxVisible: 2,
  maxCalibrationsVisible: 1,
  allowIntentionalSilence: true,
};

export interface HomeCarouselBudgetResult<T extends { id: string; priority: number }> {
  visibleItems: T[];
  hiddenCount: number;
  focusedCriticalMode: boolean;
  isSilent: boolean;
}

/**
 * Aplica a politica de Attention Budget ao carrossel de alertas da Home:
 *   - Ordenacao estavel por `priority` crescente;
 *   - Se vazio e `allowIntentionalSilence === true`, retorna `isSilent: true`;
 *   - Se existir alerta critico P0 (`priority <= 1`), ativa modo focado (`limit = min(1, homeMaxCards)`);
 *   - Caso contrario, limita a `homeMaxCards` (padrao 3 na Onda 2).
 */
export function applyHomeCarouselAttentionBudget<T extends { id: string; priority: number }>(
  items: readonly T[],
  policy?: Partial<AttentionBudgetPolicy>,
): HomeCarouselBudgetResult<T> {
  const effectivePolicy: AttentionBudgetPolicy = {
    ...DEFAULT_ATTENTION_BUDGET_POLICY,
    ...policy,
  };

  if (items.length === 0) {
    return {
      visibleItems: [],
      hiddenCount: 0,
      focusedCriticalMode: false,
      isSilent: effectivePolicy.allowIntentionalSilence,
    };
  }

  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.priority - b.item.priority || a.index - b.index)
    .map(({ item }) => item);

  const highestPriority = sorted[0]?.priority ?? Infinity;
  const focusedCriticalMode = highestPriority <= 1;
  const maxAllowed = focusedCriticalMode
    ? Math.min(1, Math.max(0, effectivePolicy.homeMaxCards))
    : Math.max(0, effectivePolicy.homeMaxCards);

  const visibleItems = sorted.slice(0, maxAllowed);
  const hiddenCount = Math.max(0, sorted.length - visibleItems.length);

  return {
    visibleItems,
    hiddenCount,
    focusedCriticalMode,
    isSilent: visibleItems.length === 0 && effectivePolicy.allowIntentionalSilence,
  };
}

export type OperationalHomeBannerKind =
  | "auto_registered"
  | "pending_split_signals"
  | "pending_suggestions"
  | "pix_clipboard";

export interface OperationalHomeBannerCandidate {
  kind: OperationalHomeBannerKind;
  active: boolean;
}

export interface OperationalHomeBannerPlan {
  visibleKinds: OperationalHomeBannerKind[];
  deferredKinds: OperationalHomeBannerKind[];
  deferredCount: number;
}

const OPERATIONAL_BANNER_PRIORITY: Record<OperationalHomeBannerKind, number> = {
  auto_registered: 0, // Feedback efemero de transacao recem-criada (possui Desfazer 5s)
  pending_split_signals: 1,
  pending_suggestions: 2,
  pix_clipboard: 3,
};

/**
 * Coordena os banners operacionais exibidos fora do carrossel da Home
 * para evitar empilhamento acima da dobra (`homeMaxOperationalBanners = 1`).
 */
export function selectOperationalHomeBanner(
  candidates: readonly OperationalHomeBannerCandidate[],
  policy?: Partial<AttentionBudgetPolicy>,
): OperationalHomeBannerPlan {
  const effectivePolicy: AttentionBudgetPolicy = {
    ...DEFAULT_ATTENTION_BUDGET_POLICY,
    ...policy,
  };

  const activeSet = new Set<OperationalHomeBannerKind>();
  for (const candidate of candidates) {
    if (candidate.active) {
      activeSet.add(candidate.kind);
    }
  }

  const orderedActive = Array.from(activeSet).sort(
    (a, b) => OPERATIONAL_BANNER_PRIORITY[a] - OPERATIONAL_BANNER_PRIORITY[b],
  );

  const limit = Math.max(0, effectivePolicy.homeMaxOperationalBanners);
  const visibleKinds = orderedActive.slice(0, limit);
  const deferredKinds = orderedActive.slice(limit);

  return {
    visibleKinds,
    deferredKinds,
    deferredCount: deferredKinds.length,
  };
}

// ---------------------------------------------------------------------------
// Smart Decay (Cooldown progressivo 7d -> 30d -> 90d + pausa por familia)
// ---------------------------------------------------------------------------

export const SMART_DECAY_STEPS_DAYS = [7, 30, 90] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface SmartDecayEvaluation {
  record: SmartDecayRecord;
  nextCooldownDays: 7 | 30 | 90;
  shouldOfferMute: boolean;
}

/**
 * Mapeia de forma determinística uma chave estável de tema (ou família) para uma InsightThemeFamily canônica.
 */
export function resolveThemeFamily(themeOrFamily: string): InsightThemeFamily {
  const normalized = themeOrFamily.trim();
  if (
    normalized === "pace" ||
    normalized === "cash_gap" ||
    normalized === "surplus" ||
    normalized === "habit" ||
    normalized === "savings_cut" ||
    normalized === "price_adjustment" ||
    normalized === "calibration" ||
    normalized === "income_confirm" ||
    normalized === "missing_expense" ||
    normalized === "annual_commitment" ||
    normalized === "celebration" ||
    normalized === "monthly_closing"
  ) {
    return normalized;
  }
  if (normalized.startsWith("pace")) return "pace";
  if (normalized.startsWith("cash_gap")) return "cash_gap";
  if (normalized.startsWith("surplus") || normalized.startsWith("aporte")) return "surplus";
  if (normalized.startsWith("habit") || normalized.startsWith("weekly")) return "habit";
  if (
    normalized.startsWith("savings") ||
    normalized.startsWith("dup") ||
    normalized.startsWith("charges") ||
    normalized.startsWith("cut")
  ) {
    return "savings_cut";
  }
  if (normalized.startsWith("price_adj")) return "price_adjustment";
  if (normalized.startsWith("calib")) return "calibration";
  if (normalized.startsWith("income")) return "income_confirm";
  if (normalized.startsWith("missing_expense") || normalized.startsWith("due_today")) {
    return "missing_expense";
  }
  if (normalized.startsWith("annual:") || normalized.startsWith("annual_commit")) {
    return "annual_commitment";
  }
  if (normalized.startsWith("celebration")) return "celebration";
  if (normalized.startsWith("monthly_closing")) return "monthly_closing";
  return "habit";
}

/**
 * Evolui progressivamente o cooldown de uma familia de insight apos descarte:
 * Suporta assinatura sobre record único (SmartDecayEvaluation) ou sobre mapa indexado por família.
 */
export function advanceSmartDecay(
  previous: SmartDecayRecord | null | undefined,
  nowMs?: number,
): SmartDecayEvaluation;
export function advanceSmartDecay(
  decayMap: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined,
  themeOrFamily: string,
  todayISOOrNowMs?: string | number,
  nowMs?: number,
): Partial<Record<InsightThemeFamily, SmartDecayRecord>>;
export function advanceSmartDecay(
  previousOrMap: SmartDecayRecord | Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined,
  arg2?: string | number,
  arg3?: string | number,
  arg4?: number,
): SmartDecayEvaluation | Partial<Record<InsightThemeFamily, SmartDecayRecord>> {
  if (typeof arg2 === "string") {
    const decayMap = (previousOrMap ?? {}) as Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
    const family = resolveThemeFamily(arg2);
    const prevRecord = decayMap[family];
    const effectiveNowMs =
      typeof arg4 === "number"
        ? arg4
        : typeof arg3 === "number"
          ? arg3
          : Date.now();
    const evalResult = advanceSmartDecay(prevRecord, effectiveNowMs);
    return {
      ...decayMap,
      [family]: evalResult.record,
    };
  }

  const previous = previousOrMap as SmartDecayRecord | null | undefined;
  const nowMs = typeof arg2 === "number" ? arg2 : Date.now();
  const safePrevCount =
    previous && Number.isFinite(previous.dismissCount) ? Math.max(0, Math.floor(previous.dismissCount)) : 0;
  const nextCount = safePrevCount + 1;
  const nextCooldownDays: 7 | 30 | 90 = nextCount === 1 ? 7 : nextCount === 2 ? 30 : 90;

  const record: SmartDecayRecord = {
    dismissCount: nextCount,
    lastDismissedAt: new Date(nowMs).toISOString(),
    dismissedUntil: nowMs + nextCooldownDays * DAY_MS,
    ...(previous?.muted ? { muted: true } : {}),
  };

  return {
    record,
    nextCooldownDays,
    shouldOfferMute: nextCount >= 3,
  };
}

/**
 * Indica se uma familia de insight esta silenciada por pausa definitiva (`muted`)
 * ou dentro da janela ativa de cooldown (`nowMs < dismissedUntil`).
 * Suporta checagem de record direto ou de tema/família via mapa.
 */
export function isFamilyUnderDecay(
  record: SmartDecayRecord | null | undefined,
  nowMs?: number,
): boolean;
export function isFamilyUnderDecay(
  themeOrFamily: string,
  decayByFamily: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined,
  nowMs?: number,
): boolean;
export function isFamilyUnderDecay(
  recordOrTheme: string | SmartDecayRecord | null | undefined,
  arg2?: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | number | null,
  arg3?: number,
): boolean {
  if (typeof recordOrTheme === "string") {
    const family = resolveThemeFamily(recordOrTheme);
    const decayMap = arg2 as Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined;
    const record = decayMap?.[family];
    const nowMs = typeof arg3 === "number" ? arg3 : Date.now();
    return isFamilyUnderDecay(record, nowMs);
  }

  const record = recordOrTheme as SmartDecayRecord | null | undefined;
  const nowMs = typeof arg2 === "number" ? arg2 : Date.now();
  if (!record) return false;
  if (record.muted === true) return true;
  if (!Number.isFinite(record.dismissedUntil)) return false;
  return nowMs < record.dismissedUntil;
}

/**
 * Silencia uma familia de insight de forma reversivel (visivel na Memoria do Copiloto).
 */
export function muteInsightFamily(
  previous: SmartDecayRecord | null | undefined,
  nowMs?: number,
): SmartDecayRecord;
export function muteInsightFamily(
  decayMap: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined,
  themeOrFamily: string,
  nowMs?: number,
): Partial<Record<InsightThemeFamily, SmartDecayRecord>>;
export function muteInsightFamily(
  previousOrMap: SmartDecayRecord | Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined,
  arg2?: string | number,
  arg3?: number,
): SmartDecayRecord | Partial<Record<InsightThemeFamily, SmartDecayRecord>> {
  if (typeof arg2 === "string") {
    const decayMap = (previousOrMap ?? {}) as Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
    const family = resolveThemeFamily(arg2);
    const prevRecord = decayMap[family];
    const nowMs = typeof arg3 === "number" ? arg3 : Date.now();
    const mutedRecord = muteInsightFamily(prevRecord, nowMs);
    return {
      ...decayMap,
      [family]: mutedRecord,
    };
  }

  const previous = previousOrMap as SmartDecayRecord | null | undefined;
  const nowMs = typeof arg2 === "number" ? arg2 : Date.now();
  const prevCount =
    previous && Number.isFinite(previous.dismissCount) ? Math.max(1, Math.floor(previous.dismissCount)) : 1;
  return {
    dismissCount: prevCount,
    lastDismissedAt: new Date(nowMs).toISOString(),
    dismissedUntil: Math.max(previous?.dismissedUntil ?? 0, nowMs + 90 * DAY_MS),
    muted: true,
  };
}

/**
 * Reativa uma familia de insight anteriormente silenciada ou em cooldown.
 */
export function unmuteInsightFamily(
  previous: SmartDecayRecord | null | undefined,
  nowMs?: number,
): SmartDecayRecord;
export function unmuteInsightFamily(
  decayMap: Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined,
  themeOrFamily: string,
  nowMs?: number,
): Partial<Record<InsightThemeFamily, SmartDecayRecord>>;
export function unmuteInsightFamily(
  previousOrMap: SmartDecayRecord | Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>> | null | undefined,
  arg2?: string | number,
  arg3?: number,
): SmartDecayRecord | Partial<Record<InsightThemeFamily, SmartDecayRecord>> {
  if (typeof arg2 === "string") {
    const decayMap = (previousOrMap ?? {}) as Readonly<Partial<Record<InsightThemeFamily, SmartDecayRecord>>>;
    const family = resolveThemeFamily(arg2);
    const prevRecord = decayMap[family];
    const nowMs = typeof arg3 === "number" ? arg3 : Date.now();
    const unmutedRecord = unmuteInsightFamily(prevRecord, nowMs);
    return {
      ...decayMap,
      [family]: unmutedRecord,
    };
  }

  const previous = previousOrMap as SmartDecayRecord | null | undefined;
  const nowMs = typeof arg2 === "number" ? arg2 : Date.now();
  return {
    dismissCount: 0,
    lastDismissedAt: previous?.lastDismissedAt ?? new Date(nowMs).toISOString(),
    dismissedUntil: 0,
    muted: false,
  };
}
