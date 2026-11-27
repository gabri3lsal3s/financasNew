/**
 * Seletor unificado de slots para os carrosséis da Home e de Investimentos (Onda 2 · Fase 5).
 *
 * Responsável por:
 *   1. Filtrar por canal de destino (`home_carousel` | `investments_carousel`);
 *   2. Avaliar visibilidade via catálogo unificado de dispensas (`evaluateCarouselCardVisibility`);
 *   3. Aplicar supressões explícitas (`suppressCanonicalIds`) dos candidatos sobreviventes;
 *   4. Ordenar deterministicamente por prioridade, severidade, relevância no ciclo e ID;
 *   5. Deduplicar por `canonicalId` (e aliases irmãos) e por `entityRefs`;
 *   6. Aplicar orçamento de atenção por canal (Home: até 3 ou 1 com P0; Investimentos: até 5 e máx. 2 riscos estruturais).
 *
 * 100% puro — zero dependências de React, DOM ou Supabase.
 */

import { DEFAULT_ATTENTION_BUDGET_POLICY } from "@/domain/insights/attention-budget";
import { SEVERITY_RANK } from "./build-notification-center";
import {
  resolveCanonicalDismissalAliases,
  resolveCarouselCardPolicy,
  type CarouselDismissalsMap,
  type CarouselPolicyContext,
} from "./carousel-dismissal-policy";
import {
  evaluateCarouselCardVisibility,
  type LegacyDismissalSources,
} from "./carousel-dismissals";
import type { NotificationChannel, NotificationSeverity } from "./types";

export interface CarouselSlotCandidate {
  id: string;
  canonicalId: string;
  priority: number;
  severity?: NotificationSeverity;
  cycleRelevance?: number;
  channels?: readonly NotificationChannel[];
  entityRefs?: readonly string[];
  suppressCanonicalIds?: readonly string[];
  policyContext?: CarouselPolicyContext;
  currentGoalStage?: "completed" | "final_stretch" | "has_surplus" | "regular";
  isStructuralRisk?: boolean;
  isMandatoryBlocking?: boolean;
}

export interface SelectCarouselSlotsParams<T extends CarouselSlotCandidate> {
  channel: Extract<NotificationChannel, "home_carousel" | "investments_carousel">;
  items: readonly T[];
  carouselDismissals?: CarouselDismissalsMap | null;
  invalidIds?: ReadonlySet<string>;
  legacySources?: LegacyDismissalSources;
  nowMs?: number;
  maxSlots?: number;
  maxStructuralRisks?: number;
}

export interface SelectCarouselSlotsResult<T extends CarouselSlotCandidate> {
  visibleItems: T[];
  hiddenItems: T[];
  hiddenCount: number;
  suppressedIds: string[];
  focusedCriticalMode: boolean;
  isSilent: boolean;
}

function inferSeverityFromPriority(priority: number): NotificationSeverity {
  if (priority <= 1) return "P0_CRITICAL";
  if (priority <= 2.5) return "P1_ACTION_NEEDED";
  if (priority <= 3.9) return "P2_ADVISORY";
  return "P3_OPPORTUNITY";
}

function expandCanonicalKeys(canonicalId: string): string[] {
  return [canonicalId, ...resolveCanonicalDismissalAliases(canonicalId)];
}

export function selectCarouselSlots<T extends CarouselSlotCandidate>(
  params: SelectCarouselSlotsParams<T>,
): SelectCarouselSlotsResult<T> {
  const {
    channel,
    items,
    carouselDismissals,
    invalidIds,
    legacySources,
    nowMs,
  } = params;

  const baseMaxSlots =
    params.maxSlots ??
    (channel === "home_carousel" ? DEFAULT_ATTENTION_BUDGET_POLICY.homeMaxCards : 5);
  const maxStructuralRisks =
    params.maxStructuralRisks ?? (channel === "investments_carousel" ? 2 : baseMaxSlots);

  // 1. Filtra pelo canal solicitado
  const channelMatched = items.filter((item) =>
    item.channels ? item.channels.includes(channel) : true,
  );

  // 2. Avalia dispensa por ID canônico e aliases antes de suprir/paginar
  const visibleByDismissal = channelMatched.filter((item) => {
    const policy = resolveCarouselCardPolicy(item.canonicalId, item.policyContext);
    if (policy.category === "p0_mandatory") return true;
    return evaluateCarouselCardVisibility({
      canonicalId: item.canonicalId,
      carouselDismissals,
      invalidIds,
      nowMs,
      policyContext: item.policyContext,
      legacySources,
      currentGoalStage: item.currentGoalStage,
    }).visible;
  });

  // 3. Coleta supressões explícitas declaradas pelos sobreviventes ativos
  const suppressedKeySet = new Set<string>();
  for (const survivor of visibleByDismissal) {
    for (const targetId of survivor.suppressCanonicalIds ?? []) {
      for (const expanded of expandCanonicalKeys(targetId)) {
        suppressedKeySet.add(expanded);
      }
    }
  }

  const suppressedIds: string[] = [];
  const afterSuppression: T[] = [];
  for (const item of visibleByDismissal) {
    const policy = resolveCarouselCardPolicy(item.canonicalId, item.policyContext);
    const isMandatory = Boolean(item.isMandatoryBlocking) || policy.category === "p0_mandatory";
    const keys = expandCanonicalKeys(item.canonicalId);
    if (!isMandatory && keys.some((k) => suppressedKeySet.has(k))) {
      suppressedIds.push(item.canonicalId);
      continue;
    }
    afterSuppression.push(item);
  }

  // 4. Ordenação determinística: priority asc -> severity asc -> cycleRelevance desc -> canonicalId -> id
  const sorted = afterSuppression
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((a, b) => {
      if (a.item.priority !== b.item.priority) {
        return a.item.priority - b.item.priority;
      }
      const sevA = SEVERITY_RANK[a.item.severity ?? inferSeverityFromPriority(a.item.priority)];
      const sevB = SEVERITY_RANK[b.item.severity ?? inferSeverityFromPriority(b.item.priority)];
      if (sevA !== sevB) {
        return sevA - sevB;
      }
      const relA = a.item.cycleRelevance ?? 0;
      const relB = b.item.cycleRelevance ?? 0;
      if (relA !== relB) {
        return relB - relA;
      }
      const canonCmp = a.item.canonicalId.localeCompare(b.item.canonicalId);
      if (canonCmp !== 0) return canonCmp;
      const idCmp = a.item.id.localeCompare(b.item.id);
      if (idCmp !== 0) return idCmp;
      return a.originalIndex - b.originalIndex;
    })
    .map(({ item }) => item);

  // 5. Deduplica por canonicalId (e sibling aliases) + interseção de entityRefs
  const seenCanonicalKeys = new Set<string>();
  const seenEntityRefs = new Set<string>();
  const deduped: T[] = [];

  for (const item of sorted) {
    const canonicalKeys = expandCanonicalKeys(item.canonicalId);
    if (canonicalKeys.some((k) => seenCanonicalKeys.has(k))) continue;

    const refs = (item.entityRefs ?? []).filter(Boolean);
    if (refs.length > 0 && refs.some((ref) => seenEntityRefs.has(ref))) continue;

    for (const k of canonicalKeys) {
      seenCanonicalKeys.add(k);
    }
    for (const ref of refs) {
      seenEntityRefs.add(ref);
    }
    deduped.push(item);
  }

  if (deduped.length === 0) {
    return {
      visibleItems: [],
      hiddenItems: [],
      hiddenCount: 0,
      suppressedIds,
      focusedCriticalMode: false,
      isSilent: true,
    };
  }

  // 6. Aplica orçamento por canal
  const topItem = deduped[0]!;
  const focusedCriticalMode =
    channel === "home_carousel" &&
    (Boolean(topItem.isMandatoryBlocking) || topItem.priority <= 1);

  const effectiveLimit = focusedCriticalMode
    ? Math.min(1, Math.max(0, baseMaxSlots))
    : Math.max(0, baseMaxSlots);

  const visibleItems: T[] = [];
  const hiddenItems: T[] = [];
  let structuralRiskCount = 0;

  for (const item of deduped) {
    if (visibleItems.length >= effectiveLimit) {
      hiddenItems.push(item);
      continue;
    }
    if (
      channel === "investments_carousel" &&
      item.isStructuralRisk &&
      structuralRiskCount >= Math.max(0, maxStructuralRisks)
    ) {
      hiddenItems.push(item);
      continue;
    }
    if (item.isStructuralRisk) {
      structuralRiskCount += 1;
    }
    visibleItems.push(item);
  }

  return {
    visibleItems,
    hiddenItems,
    hiddenCount: hiddenItems.length,
    suppressedIds,
    focusedCriticalMode,
    isSilent: visibleItems.length === 0,
  };
}
