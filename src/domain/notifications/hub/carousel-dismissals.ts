/**
 * Motor puro de cálculo de prazo, validação de borda, merge determinístico e
 * avaliação de visibilidade de dispensas dos carrosséis (Onda 1 · Fase 1).
 *
 * 100% puro — zero dependências de UI, DOM ou Supabase.
 */

import { z } from "zod";
import type {
  DashboardAlertDismissals,
  DeviceNotificationsCustomSettings,
  PortfolioAlertDismissalsMap,
} from "@/types/schema";
import {
  resolveCarouselCardPolicy,
  resolveLegacyAliasesForCanonicalId,
  type CarouselDismissalRecord,
  type CarouselDismissalsMap,
  type CarouselDismissalStage,
  type CarouselDismissPreset,
  type CarouselPolicyContext,
} from "./carousel-dismissal-policy";

export const carouselDismissPresetSchema = z.enum(["7d", "1m", "6m"]);
export const carouselDismissalStageSchema = z.enum(["completed", "open"]);

export const carouselDismissalRecordSchema = z
  .object({
    preset: carouselDismissPresetSchema,
    dismissedAt: z.number().finite().nonnegative(),
    dismissedUntil: z.number().finite().nonnegative(),
    revokedAt: z.number().finite().nonnegative().optional(),
    stage: carouselDismissalStageSchema.optional(),
  })
  .strict();

const PRESET_TIE_ORDER: Record<CarouselDismissPreset, number> = {
  "7d": 1,
  "1m": 2,
  "6m": 3,
};

export interface ParsedCarouselDismissalsResult {
  records: CarouselDismissalsMap;
  invalidIds: ReadonlySet<string>;
}

/**
 * Valida na borda um mapa bruto vindo do storage local ou JSON da nuvem.
 * Entradas inválidas são isoladas em `invalidIds` para falhar aberto e bloquear fallback legado.
 */
export function parseCarouselDismissalsMap(
  raw: unknown,
  onInvalidEntry?: (id: string) => void,
): ParsedCarouselDismissalsResult {
  const records: CarouselDismissalsMap = {};
  const invalidIds = new Set<string>();

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { records, invalidIds };
  }

  for (const [id, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!id || id.length > 160) {
      invalidIds.add(id);
      onInvalidEntry?.(id);
      continue;
    }
    const parsed = carouselDismissalRecordSchema.safeParse(entry);
    if (!parsed.success) {
      invalidIds.add(id);
      onInvalidEntry?.(id);
      continue;
    }
    records[id] = parsed.data;
  }

  return { records, invalidIds };
}

/**
 * Calcula `dismissedUntil` em calendário civil local no fuso do gesto:
 * - "7d": soma 7 dias civis e fixa meia-noite local (00:00:00.000).
 * - "1m" / "6m": parte do dia 1 do mês destino, limita ao último dia do mês e fixa meia-noite local.
 * Exemplos: 31/01/2027 +1m -> 28/02/2027 00:00; 31/01/2028 +1m -> 29/02/2028 00:00; 31/08/2027 +6m -> 29/02/2028 00:00.
 */
export function computeCarouselDismissalUntil(
  nowMs: number,
  preset: CarouselDismissPreset,
): number {
  const base = new Date(nowMs);
  if (preset === "7d") {
    return new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate() + 7,
      0,
      0,
      0,
      0,
    ).getTime();
  }

  const monthsToAdd = preset === "1m" ? 1 : 6;
  const targetYear = base.getFullYear();
  const targetMonth = base.getMonth() + monthsToAdd;
  const lastDayOfTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const clampedDay = Math.min(base.getDate(), lastDayOfTargetMonth);

  return new Date(targetYear, targetMonth, clampedDay, 0, 0, 0, 0).getTime();
}

/**
 * Formata a data prevista de retorno (`DD/MM` no mesmo ano ou `DD/MM/AA` em outro ano).
 */
export function formatCarouselReturnDate(
  dismissedUntilMs: number,
  referenceNowMs: number = Date.now(),
): string {
  const d = new Date(dismissedUntilMs);
  const ref = new Date(referenceNowMs);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  if (d.getFullYear() === ref.getFullYear()) {
    return `${dd}/${mm}`;
  }
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/**
 * Gera timestamp local estritamente monotônico por ID para garantir convergência
 * em sequências rápidas como `6m -> Desfazer -> 7d`.
 */
export function nextMonotonicDismissalTimestamp(
  prevRecord: CarouselDismissalRecord | undefined,
  nowMs: number = Date.now(),
): number {
  const prevUpdated = prevRecord
    ? Math.max(prevRecord.dismissedAt, prevRecord.revokedAt ?? 0)
    : 0;
  return Math.max(nowMs, prevUpdated + 1);
}

/**
 * Cria um novo registro canônico de dispensa (sem `revokedAt`).
 */
export function createCarouselDismissalRecord(
  preset: CarouselDismissPreset,
  nowMs: number = Date.now(),
  options?: {
    prevRecord?: CarouselDismissalRecord;
    stage?: CarouselDismissalStage;
  },
): CarouselDismissalRecord {
  const dismissedAt = nextMonotonicDismissalTimestamp(options?.prevRecord, nowMs);
  const dismissedUntil = computeCarouselDismissalUntil(nowMs, preset);
  return {
    preset,
    dismissedAt,
    dismissedUntil,
    ...(options?.stage ? { stage: options.stage } : {}),
  };
}

/**
 * Cria tombstone de revogação (`Desfazer` / `Reativar agora`), preservando histórico de prazo.
 */
export function revokeCarouselDismissalRecord(
  prevRecord: CarouselDismissalRecord,
  nowMs: number = Date.now(),
): CarouselDismissalRecord {
  const revokedAt = nextMonotonicDismissalTimestamp(prevRecord, nowMs);
  return {
    ...prevRecord,
    revokedAt,
  };
}

function recordUpdatedAt(rec: CarouselDismissalRecord): number {
  return Math.max(rec.dismissedAt, rec.revokedAt ?? 0);
}

function pickWinningRecord(
  a: CarouselDismissalRecord,
  b: CarouselDismissalRecord,
): CarouselDismissalRecord {
  const updA = recordUpdatedAt(a);
  const updB = recordUpdatedAt(b);
  if (updA !== updB) {
    return updA > updB ? a : b;
  }

  const aRevoked = a.revokedAt != null;
  const bRevoked = b.revokedAt != null;
  if (aRevoked !== bRevoked) {
    return aRevoked ? a : b;
  }

  if (a.dismissedAt !== b.dismissedAt) {
    return a.dismissedAt > b.dismissedAt ? a : b;
  }

  if (a.dismissedUntil !== b.dismissedUntil) {
    return a.dismissedUntil > b.dismissedUntil ? a : b;
  }

  return PRESET_TIE_ORDER[a.preset] >= PRESET_TIE_ORDER[b.preset] ? a : b;
}

/**
 * Mescla dois mapas de dispensa de forma comutativa e determinística por ID.
 * Tombstones (`revokedAt`) são preservados enquanto houver fallback legado.
 */
export function mergeCarouselDismissals(
  left?: CarouselDismissalsMap | null,
  right?: CarouselDismissalsMap | null,
): CarouselDismissalsMap {
  const merged: CarouselDismissalsMap = {};
  const keys = new Set([...Object.keys(left ?? {}), ...Object.keys(right ?? {})]);
  for (const id of keys) {
    const a = left?.[id];
    const b = right?.[id];
    if (a && b) {
      merged[id] = pickWinningRecord(a, b);
    } else if (a ?? b) {
      merged[id] = (a ?? b)!;
    }
  }
  return merged;
}

export interface LegacyDismissalSources {
  dashboardAlertDismissals?: DashboardAlertDismissals | null;
  portfolioAlertDismissals?: PortfolioAlertDismissalsMap | null;
  advisorDismissals?: Readonly<Record<string, number>> | null;
  deviceNotifications?: DeviceNotificationsCustomSettings | null;
  localPermissionDismissals?: {
    pushDue?: boolean;
    passiveBankListener?: boolean;
  };
}

export interface EvaluateCarouselVisibilityInput {
  canonicalId: string;
  carouselDismissals?: CarouselDismissalsMap | null;
  invalidIds?: ReadonlySet<string>;
  nowMs?: number;
  policyContext?: CarouselPolicyContext;
  legacySources?: LegacyDismissalSources;
  /** Usado em `goals.progress.*` para detectar transição efetiva para `completed`. */
  currentGoalStage?: "completed" | "final_stretch" | "has_surplus" | "regular";
}

export interface CarouselVisibilityEvaluation {
  visible: boolean;
  reason:
    | "mandatory"
    | "invalid_fail_open"
    | "revoked"
    | "goal_completed_transition"
    | "active_canonical"
    | "expired_canonical"
    | "active_legacy"
    | "eligible";
  dismissedUntil?: number;
  source?: "canonical" | "legacy";
}

/**
 * Ordem única de decisão (§3 do Plano Mestre):
 * 1. P0 obrigatório (past_due / trial <= 3d) tem precedência sobre dispensa.
 * 2. Chave canônica própria após merge: revogada/expirada => elegível, nunca cai no legado.
 *    Inválida => falha aberto e bloqueia legado.
 * 3. Ausente => avalia aliases legados do mesmo usuário (maior expiração legada).
 */
export function evaluateCarouselCardVisibility(
  input: EvaluateCarouselVisibilityInput,
): CarouselVisibilityEvaluation {
  const nowMs = input.nowMs ?? Date.now();
  const policy = resolveCarouselCardPolicy(input.canonicalId, input.policyContext);

  if (policy.category === "p0_mandatory") {
    return { visible: true, reason: "mandatory" };
  }

  if (input.invalidIds?.has(input.canonicalId)) {
    return { visible: true, reason: "invalid_fail_open" };
  }

  const canonical = input.carouselDismissals?.[input.canonicalId];
  if (canonical) {
    if (canonical.revokedAt != null && canonical.revokedAt >= canonical.dismissedAt) {
      return { visible: true, reason: "revoked", source: "canonical" };
    }

    if (
      input.canonicalId.startsWith("goals.progress.") &&
      input.currentGoalStage === "completed" &&
      canonical.stage !== "completed"
    ) {
      return { visible: true, reason: "goal_completed_transition", source: "canonical" };
    }

    if (nowMs < canonical.dismissedUntil) {
      return {
        visible: false,
        reason: "active_canonical",
        dismissedUntil: canonical.dismissedUntil,
        source: "canonical",
      };
    }

    return { visible: true, reason: "expired_canonical", source: "canonical" };
  }

  const legacyUntil = resolveActiveLegacyDismissalUntil(
    input.canonicalId,
    input.legacySources,
    nowMs,
  );
  if (legacyUntil !== null) {
    return {
      visible: false,
      reason: "active_legacy",
      dismissedUntil: legacyUntil === Infinity ? undefined : legacyUntil,
      source: "legacy",
    };
  }

  return { visible: true, reason: "eligible" };
}

function resolveActiveLegacyDismissalUntil(
  canonicalId: string,
  sources: LegacyDismissalSources | undefined,
  nowMs: number,
): number | null {
  if (!sources) return null;
  const aliases = resolveLegacyAliasesForCanonicalId(canonicalId);
  let maxActiveUntil: number | null = null;

  const track = (until: number | undefined | null) => {
    if (typeof until === "number" && Number.isFinite(until) && nowMs < until) {
      maxActiveUntil = maxActiveUntil === null ? until : Math.max(maxActiveUntil, until);
    }
  };

  const dash = sources.dashboardAlertDismissals;
  if (dash) {
    for (const cardKey of aliases.dashboardCardKeys) {
      track(dash.cards?.[cardKey]?.dismissedUntil);
    }
    if (aliases.dashboardPace && dash.pace) {
      track(dash.pace.dismissedUntil ?? computeLegacy30dFallback(dash.pace.dismissedAt));
    }
    if (aliases.dashboardSurplus && dash.surplus) {
      track(dash.surplus.dismissedUntil ?? computeLegacy30dFallback(dash.surplus.dismissedAt));
    }
    if (aliases.dashboardGovernance && dash.governance) {
      track(dash.governance.dismissedUntil);
    }
    if (aliases.goalShareId && dash.goals?.[aliases.goalShareId]) {
      const g = dash.goals[aliases.goalShareId]!;
      track(g.dismissedUntil ?? computeLegacy30dFallback(g.dismissedAt));
    }
  }

  const port = sources.portfolioAlertDismissals;
  if (port) {
    for (const pKey of aliases.portfolioKeys) {
      track(port[pKey]?.dismissedUntil);
    }
  }

  const adv = sources.advisorDismissals;
  if (adv) {
    for (const themeKey of aliases.advisorThemeKeys) {
      track(adv[themeKey]);
    }
  }

  if (aliases.permissionCapability) {
    const cloudFlag =
      sources.deviceNotifications?.dismissedPermissionAlerts?.[aliases.permissionCapability];
    const localFlag = sources.localPermissionDismissals?.[aliases.permissionCapability];
    if (cloudFlag === true || localFlag === true) {
      return Infinity;
    }
  }

  return maxActiveUntil;
}

function computeLegacy30dFallback(dismissedAtIso: string): number | undefined {
  const parsed = Date.parse(dismissedAtIso);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed + 30 * 24 * 60 * 60 * 1000;
}
