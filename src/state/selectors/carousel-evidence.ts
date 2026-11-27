/**
 * Seletor e barramento puramente passivo em memória para projeção bidirecional Home <-> Carteira (Onda 2 · Fase 5).
 *
 * Contratos estritos (§5 do Plano Mestre):
 *   - Chave canônica: `["carousel-evidence", userId, mode, scope, month, asOf]`.
 *   - NUNCA declara `queryFn`, NUNCA chama `fetchQuery`, `ensureQueryData` ou `useQuery`.
 *   - NUNCA persiste evidência financeira em `localStorage` ou `sessionStorage`.
 *   - Igualdade semântica antes de `setQueryData` previne loops de renderização.
 *   - Invalidada imediatamente ao invalidar/alterar fontes, logout, troca de UID/escopo/modo/data ou expiração do menor staleTime.
 */

import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { QueryClientContext, type QueryClient } from "@tanstack/react-query";
import type { WarmTripDetailSnapshot } from "@/domain/notifications/hub/bridge-evaluators";
import type { SurplusCapacityResult } from "@/domain/overview/surplus";
import type { CashGapAnalysisResult } from "@/domain/projection/cash-gap";
import { getActiveUserId, subscribeActiveUserId } from "@/services/user-storage";
import { STALE_TIMES } from "@/state/cache-policy";
import { PORTFOLIO_QUERY_KEYS } from "@/state/mutations/portfolio/portfolio-keys";
import { debtsKey } from "@/state/queries/use-debts";
import { LOANS_QUERY_KEY } from "@/state/queries/use-loans";
import { TRIP_QUERY_KEYS } from "@/state/queries/use-trips";
import type {
  Debt,
  GroupTarget,
  Loan,
  PortfolioAsset,
  PortfolioContribution,
  ViewScope,
} from "@/types";

export const CAROUSEL_EVIDENCE_PREFIX = ["carousel-evidence"] as const;

/** Menor staleTime das fontes operacionais que compõem a projeção (30s). */
export const CAROUSEL_EVIDENCE_TTL_MS = STALE_TIMES.transactional;

export const CAROUSEL_EVIDENCE_SOURCE_PREFIXES = [
  "expenses",
  "incomes",
  "debts",
  "credit_cards",
  "card_payments",
  "card_expenses",
  "card_bill_rollovers",
  "cash_checkpoints",
  "budgets",
  "portfolio_contributions",
] as const;

export const WARM_CACHE_SOURCE_PREFIXES = [
  "debts",
  "loans",
  "group_targets",
  "portfolio_assets",
  "portfolio_contributions",
  "trips",
] as const;

export type CarouselEvidenceMode = "auth" | "demo";

export interface CarouselEvidenceIdentity {
  userId: string | null;
  mode: CarouselEvidenceMode;
  scope: ViewScope;
  month: string;
  asOf: string;
}

export interface CarouselEvidencePayload {
  surplusCapacity: SurplusCapacityResult;
  cashGapResult: CashGapAnalysisResult;
  isCurrentMonth: boolean;
  dayOfMonth: number;
  daysInMonth: number;
  safeToSpendCents: number;
  hasLiquidityContext: boolean;
  investmentCents: number;
  debtsCount: number;
}

export interface CarouselEvidenceRecord {
  identity: CarouselEvidenceIdentity;
  payload: CarouselEvidencePayload;
  publishedAtMs: number;
  expiresAtMs: number;
}

export function carouselEvidenceKey(identity: CarouselEvidenceIdentity) {
  return [
    ...CAROUSEL_EVIDENCE_PREFIX,
    identity.userId ?? "anonymous",
    identity.mode,
    identity.scope,
    identity.month,
    identity.asOf,
  ] as const;
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableSerialize(obj[k])}`)
    .join(",")}}`;
}

function isSameIdentity(a: CarouselEvidenceIdentity, b: CarouselEvidenceIdentity): boolean {
  return (
    a.userId === b.userId &&
    a.mode === b.mode &&
    a.scope === b.scope &&
    a.month === b.month &&
    a.asOf === b.asOf
  );
}

export function clearAllCarouselEvidence(queryClient: QueryClient | null): void {
  if (!queryClient) return;
  const existing = queryClient.getQueryCache().findAll({ queryKey: CAROUSEL_EVIDENCE_PREFIX });
  if (existing.length === 0) return;
  queryClient.removeQueries({ queryKey: CAROUSEL_EVIDENCE_PREFIX });
}

/**
 * Publica a projeção pronta em memória somente quando autenticado/identificado
 * e quando a evidência realmente mudou ou expirou. Remove chaves de identidades antigas.
 */
export function publishCarouselEvidence(
  queryClient: QueryClient | null,
  identity: CarouselEvidenceIdentity,
  payload: CarouselEvidencePayload,
  options?: { nowMs?: number; ttlMs?: number },
): boolean {
  if (!queryClient || !identity.userId) {
    if (queryClient && !identity.userId) {
      clearAllCarouselEvidence(queryClient);
    }
    return false;
  }

  const nowMs = options?.nowMs ?? Date.now();
  const ttlMs = options?.ttlMs ?? CAROUSEL_EVIDENCE_TTL_MS;
  const targetKey = carouselEvidenceKey(identity);

  const existingEntries = queryClient.getQueryCache().findAll({
    queryKey: CAROUSEL_EVIDENCE_PREFIX,
  });

  for (const entry of existingEntries) {
    const entryKey = entry.queryKey;
    const matchesTarget =
      entryKey.length === targetKey.length &&
      entryKey.every((segment, idx) => segment === targetKey[idx]);
    if (!matchesTarget) {
      queryClient.removeQueries({ queryKey: entryKey, exact: true });
    }
  }

  const existing = queryClient.getQueryData<CarouselEvidenceRecord>(targetKey);
  if (
    existing &&
    isSameIdentity(existing.identity, identity) &&
    nowMs < existing.expiresAtMs &&
    stableSerialize(existing.payload) === stableSerialize(payload)
  ) {
    return false;
  }

  const record: CarouselEvidenceRecord = {
    identity,
    payload,
    publishedAtMs: nowMs,
    expiresAtMs: nowMs + ttlMs,
  };
  queryClient.setQueryData<CarouselEvidenceRecord>(targetKey, record);
  return true;
}

/**
 * Lê passivamente a evidência em memória. Retorna `null` para identidade divergente,
 * usuário anônimo ou registro expirado pelo menor staleTime das fontes.
 */
export function readCarouselEvidence(
  queryClient: QueryClient | null,
  identity: CarouselEvidenceIdentity,
  nowMs: number = Date.now(),
): CarouselEvidencePayload | null {
  if (!queryClient || !identity.userId) return null;

  const key = carouselEvidenceKey(identity);
  const entry = queryClient.getQueryCache().find({ queryKey: key, exact: true });
  if (!entry || entry.state.isInvalidated) return null;

  const record = entry.state.data as CarouselEvidenceRecord | undefined;
  if (!record || !isSameIdentity(record.identity, identity)) return null;
  if (!Number.isFinite(record.expiresAtMs) || nowMs >= record.expiresAtMs) {
    return null;
  }
  return record.payload;
}

/**
 * Lê um item do QueryCache SOMENTE se já estiver quente (`status === "success"` e não invalidado).
 * Zero disparo de rede ou criação de query.
 */
export function readWarmQueryData<T>(
  queryClient: QueryClient | null,
  queryKey: readonly unknown[],
): T | undefined {
  if (!queryClient) return undefined;
  const entry = queryClient.getQueryCache().find({ queryKey, exact: true });
  if (!entry) return undefined;
  if (entry.state.status !== "success" || entry.state.isInvalidated) return undefined;
  return entry.state.data as T | undefined;
}

export function readWarmLoans(queryClient: QueryClient | null): readonly Loan[] | undefined {
  return readWarmQueryData<readonly Loan[]>(queryClient, LOANS_QUERY_KEY);
}

export function readWarmDebts(queryClient: QueryClient | null): readonly Debt[] | undefined {
  return readWarmQueryData<readonly Debt[]>(queryClient, debtsKey);
}

export function readWarmClassTargets(
  queryClient: QueryClient | null,
): readonly GroupTarget[] | undefined {
  return readWarmQueryData<readonly GroupTarget[]>(queryClient, [
    ...PORTFOLIO_QUERY_KEYS.groupTargets,
    "class",
  ]);
}

export function readWarmPortfolioAssets(
  queryClient: QueryClient | null,
): readonly PortfolioAsset[] | undefined {
  return readWarmQueryData<readonly PortfolioAsset[]>(queryClient, PORTFOLIO_QUERY_KEYS.assets);
}

export function readWarmPortfolioContributions(
  queryClient: QueryClient | null,
): readonly PortfolioContribution[] | undefined {
  return readWarmQueryData<readonly PortfolioContribution[]>(
    queryClient,
    PORTFOLIO_QUERY_KEYS.contributions,
  );
}

export function readWarmTripDetailsMap(
  queryClient: QueryClient | null,
  tripIds: readonly string[],
): Map<string, WarmTripDetailSnapshot> {
  const result = new Map<string, WarmTripDetailSnapshot>();
  if (!queryClient) return result;
  for (const id of tripIds) {
    if (!id) continue;
    const warm = readWarmQueryData<WarmTripDetailSnapshot | null>(
      queryClient,
      TRIP_QUERY_KEYS.detail(id),
    );
    if (warm && warm.trip) {
      result.set(id, warm);
    }
  }
  return result;
}

/**
 * Hook puramente passivo para assinar atualizações de evidência e fontes quentes no QueryCache
 * (sem `useQuery`, sem `queryFn` e removendo projeção quando alguma fonte é invalidada/sai de sessão).
 */
export function usePassiveCarouselCache(
  identity: CarouselEvidenceIdentity | null,
  options?: { subscribeToEvidence?: boolean },
) {
  const subscribeToEvidence = options?.subscribeToEvidence !== false;
  const queryClient = useContext(QueryClientContext) ?? null;
  const [cacheVersion, setCacheVersion] = useState(0);
  const [activeUserId, setActiveUserId] = useState<string | null>(() => getActiveUserId());

  useEffect(() => {
    return subscribeActiveUserId((nextUid) => {
      setActiveUserId(nextUid);
      clearAllCarouselEvidence(queryClient);
      setCacheVersion((v) => v + 1);
    });
  }, [queryClient]);

  useEffect(() => {
    if (!queryClient) return;
    const sourceSet = new Set<string>(CAROUSEL_EVIDENCE_SOURCE_PREFIXES);
    const warmSet = new Set<string>(WARM_CACHE_SOURCE_PREFIXES);

    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "added" && event.type !== "removed" && event.type !== "updated") {
        return;
      }

      if (event.type === "added" && event.query.state.status !== "success") {
        return;
      }

      if (event.type === "updated") {
        const actionType = event.action.type;
        if (
          actionType === "fetch" ||
          actionType === "pause" ||
          actionType === "continue"
        ) {
          return;
        }
      }

      const rootKey = String(event.query.queryKey[0] ?? "");
      if (rootKey === CAROUSEL_EVIDENCE_PREFIX[0]) {
        if (subscribeToEvidence) {
          setCacheVersion((v) => v + 1);
        }
        return;
      }

      if (sourceSet.has(rootKey)) {
        const shouldInvalidateEvidence =
          event.type === "removed" ||
          event.query.state.isInvalidated ||
          event.query.state.status === "error";
        if (shouldInvalidateEvidence) {
          clearAllCarouselEvidence(queryClient);
        }
        if (warmSet.has(rootKey)) {
          setCacheVersion((v) => v + 1);
        }
        return;
      }

      if (warmSet.has(rootKey)) {
        setCacheVersion((v) => v + 1);
      }
    });
  }, [queryClient, subscribeToEvidence]);

  const effectiveIdentity = useMemo<CarouselEvidenceIdentity | null>(() => {
    if (!identity) return null;
    if (!activeUserId && identity.mode === "auth") return null;
    return {
      ...identity,
      userId: identity.mode === "auth" ? activeUserId : (identity.userId ?? activeUserId),
    };
  }, [identity, activeUserId]);

  const evidence = useMemo(() => {
    void cacheVersion;
    if (!effectiveIdentity) return null;
    return readCarouselEvidence(queryClient, effectiveIdentity);
  }, [cacheVersion, effectiveIdentity, queryClient]);

  const publish = useCallback(
    (payload: CarouselEvidencePayload) => {
      if (!effectiveIdentity) return false;
      return publishCarouselEvidence(queryClient, effectiveIdentity, payload);
    },
    [effectiveIdentity, queryClient],
  );

  return {
    queryClient,
    cacheVersion,
    activeUserId,
    evidence,
    publish,
  };
}
