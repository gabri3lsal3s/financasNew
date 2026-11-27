import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  computeCarouselDismissalUntil,
  createCarouselDismissalRecord,
  evaluateCarouselCardVisibility,
  formatCarouselReturnDate,
  mergeCarouselDismissals,
  parseCarouselDismissalsMap,
  resolveCanonicalDismissalAliases,
  resolveCarouselCardPolicy,
  revokeCarouselDismissalRecord,
  type CarouselDismissalRecord,
  type CarouselDismissalsMap,
  type CarouselDismissalStage,
  type CarouselDismissPreset,
  type CarouselPolicyContext,
  type CarouselVisibilityEvaluation,
  type LegacyDismissalSources,
} from "@/domain/notifications/hub";
import { pushToast } from "@/services/toast";
import {
  getActiveUserId,
  getUserStorageKey,
  subscribeActiveUserId,
} from "@/services/user-storage";
import { useUpdateCustomSettings } from "@/state/mutations/use-preference-mutations";
import { useUserPreferences } from "@/state/queries/use-user-preferences";
import { isQueryPending } from "@/state/query-readiness";

const CAROUSEL_DISMISSALS_STORAGE_KEY = "axir_carousel_dismissals";
const EMPTY_DISMISSALS: CarouselDismissalsMap = {};

interface ScopedStoreState {
  localRecords: CarouselDismissalsMap;
  overlayRecords: CarouselDismissalsMap;
  invalidIds: ReadonlySet<string>;
  opVersionById: Record<string, number>;
  snapshot: CarouselDismissalsMap;
}

const storesByScope = new Map<string, ScopedStoreState>();
const listeners = new Set<() => void>();
let opCounter = 0;

function resolveScopeKey(uid: string | null): string {
  return uid ? getUserStorageKey(CAROUSEL_DISMISSALS_STORAGE_KEY, uid) : "__guest__";
}

function readLocalRecords(scopeKey: string): {
  records: CarouselDismissalsMap;
  invalidIds: ReadonlySet<string>;
} {
  if (scopeKey === "__guest__" || typeof window === "undefined" || !window.localStorage) {
    return { records: EMPTY_DISMISSALS, invalidIds: new Set() };
  }
  try {
    const raw = window.localStorage.getItem(scopeKey);
    if (!raw) return { records: EMPTY_DISMISSALS, invalidIds: new Set() };
    return parseCarouselDismissalsMap(JSON.parse(raw));
  } catch {
    return { records: EMPTY_DISMISSALS, invalidIds: new Set() };
  }
}

function writeLocalRecords(scopeKey: string, records: CarouselDismissalsMap): void {
  if (scopeKey === "__guest__" || typeof window === "undefined" || !window.localStorage) {
    return;
  }
  try {
    window.localStorage.setItem(scopeKey, JSON.stringify(records));
  } catch {
    // Ignora falha de cota ou modo privado
  }
}

function getOrCreateScopeState(scopeKey: string): ScopedStoreState {
  const existing = storesByScope.get(scopeKey);
  if (existing) return existing;

  const parsed = readLocalRecords(scopeKey);
  const state: ScopedStoreState = {
    localRecords: parsed.records,
    overlayRecords: EMPTY_DISMISSALS,
    invalidIds: parsed.invalidIds,
    opVersionById: {},
    snapshot: parsed.records,
  };
  storesByScope.set(scopeKey, state);
  return state;
}

function updateSnapshot(state: ScopedStoreState): void {
  state.snapshot = mergeCarouselDismissals(state.localRecords, state.overlayRecords);
}

function notifyAll(): void {
  for (const fn of listeners) {
    fn();
  }
}

function subscribeStore(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

/**
 * Reseta o cache em memória do store (uso em testes unitários).
 */
export function resetCarouselDismissalsStore(): void {
  storesByScope.clear();
  opCounter = 0;
  notifyAll();
}

export interface DismissCarouselCardOptions {
  stage?: CarouselDismissalStage;
  policyContext?: CarouselPolicyContext;
  silentToast?: boolean;
}

export interface UseCarouselDismissalsResult {
  dismissalsMap: CarouselDismissalsMap;
  invalidIds: ReadonlySet<string>;
  nowMs: number;
  isLoading: boolean;
  dismissCard: (
    canonicalId: string,
    preset: CarouselDismissPreset,
    options?: DismissCarouselCardOptions,
  ) => void;
  revokeCard: (canonicalId: string, expectedVersion?: number) => void;
  evaluateCard: (
    canonicalId: string,
    options?: {
      policyContext?: CarouselPolicyContext;
      legacySources?: LegacyDismissalSources;
      currentGoalStage?: "completed" | "final_stretch" | "has_surplus" | "regular";
    },
  ) => CarouselVisibilityEvaluation;
  isCardVisible: (
    canonicalId: string,
    options?: {
      policyContext?: CarouselPolicyContext;
      legacySources?: LegacyDismissalSources;
      currentGoalStage?: "completed" | "final_stretch" | "has_surplus" | "regular";
    },
  ) => boolean;
}

/**
 * Hook único de leitura e escrita de dispensas dos carrosséis (7d / 1m / 6m),
 * com store isolado por usuário, validação zod, Undo de 5s e rollback seguro.
 */
export function useCarouselDismissals(): UseCarouselDismissalsResult {
  const [activeUid, setActiveUid] = useState<string | null>(() => getActiveUserId());
  useEffect(() => subscribeActiveUserId(setActiveUid), []);

  const scopeKey = resolveScopeKey(activeUid);
  const storeSnapshot = useSyncExternalStore(
    subscribeStore,
    () => getOrCreateScopeState(scopeKey).snapshot,
    () => EMPTY_DISMISSALS,
  );

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Recalcula nowMs na virada do dia, foco da aba e visibilidade/resume
  useEffect(() => {
    const refreshNow = () => setNowMs(Date.now());

    const now = new Date();
    const nextMidnight = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + 1,
      0,
      0,
      1,
      0,
    ).getTime();
    const msUntilMidnight = Math.max(1000, nextMidnight - now.getTime());
    const midnightTimer = window.setTimeout(refreshNow, msUntilMidnight);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshNow();
    };
    window.addEventListener("focus", refreshNow);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearTimeout(midnightTimer);
      window.removeEventListener("focus", refreshNow);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [nowMs]);

  const userPreferencesQuery = useUserPreferences();
  const updateCustomSettingsMutation = useUpdateCustomSettings();

  const parsedCloud = useMemo(() => {
    const rawCloud = userPreferencesQuery.data?.custom_settings?.carouselDismissals;
    return parseCarouselDismissalsMap(rawCloud);
  }, [userPreferencesQuery.data?.custom_settings?.carouselDismissals]);

  // Sincroniza nuvem -> local escopado do mesmo usuário
  useEffect(() => {
    if (!activeUid || scopeKey === "__guest__") return;
    if (Object.keys(parsedCloud.records).length === 0) return;

    const state = getOrCreateScopeState(scopeKey);
    const merged = mergeCarouselDismissals(parsedCloud.records, state.localRecords);
    state.localRecords = merged;
    updateSnapshot(state);
    writeLocalRecords(scopeKey, merged);
    notifyAll();
  }, [activeUid, scopeKey, parsedCloud.records]);

  const dismissalsMap = useMemo(
    () => mergeCarouselDismissals(parsedCloud.records, storeSnapshot),
    [parsedCloud.records, storeSnapshot],
  );

  const invalidIds = useMemo(() => {
    const state = getOrCreateScopeState(scopeKey);
    if (parsedCloud.invalidIds.size === 0 && state.invalidIds.size === 0) {
      return state.invalidIds;
    }
    return new Set([...state.invalidIds, ...parsedCloud.invalidIds]);
  }, [scopeKey, parsedCloud.invalidIds]);

  const revokeCard = useCallback(
    (canonicalId: string, expectedVersion?: number) => {
      const uid = getActiveUserId();
      if (!uid) return;
      const targetScope = resolveScopeKey(uid);
      const state = getOrCreateScopeState(targetScope);

      if (
        expectedVersion !== undefined &&
        state.opVersionById[canonicalId] !== expectedVersion
      ) {
        return;
      }

      const mergedRecords = mergeCarouselDismissals(parsedCloud.records, state.snapshot);
      const actionNowMs = Date.now();
      const aliasKeys = resolveCanonicalDismissalAliases(canonicalId);
      const targetKeys = [canonicalId, ...aliasKeys.filter((alias) => Boolean(mergedRecords[alias] ?? state.localRecords[alias]))];

      const existingPrimary = mergedRecords[canonicalId] ?? state.localRecords[canonicalId];
      if (!existingPrimary && expectedVersion !== undefined) {
        return;
      }

      opCounter += 1;
      const opVersion = opCounter;
      const patch: CarouselDismissalsMap = {};
      const prevLocalByKey: Record<string, CarouselDismissalRecord | undefined> = {};
      const prevOverlayByKey: Record<string, CarouselDismissalRecord | undefined> = {};

      for (const key of targetKeys) {
        const prevRecord =
          mergedRecords[key] ??
          state.localRecords[key] ??
          createCarouselDismissalRecord("7d", actionNowMs);
        patch[key] = revokeCarouselDismissalRecord(prevRecord, actionNowMs);
        prevLocalByKey[key] = state.localRecords[key];
        prevOverlayByKey[key] = state.overlayRecords[key];
        state.opVersionById[key] = opVersion;
      }

      state.overlayRecords = { ...state.overlayRecords, ...patch };
      state.localRecords = { ...state.localRecords, ...patch };
      updateSnapshot(state);
      writeLocalRecords(targetScope, state.localRecords);
      notifyAll();

      updateCustomSettingsMutation.mutate(
        { carouselDismissals: patch },
        {
          onError: () => {
            if (getActiveUserId() !== uid) return;
            const curState = getOrCreateScopeState(targetScope);
            const nextOverlay = { ...curState.overlayRecords };
            const nextLocal = { ...curState.localRecords };
            let changed = false;
            for (const key of targetKeys) {
              if (curState.opVersionById[key] !== opVersion) continue;
              changed = true;
              if (prevOverlayByKey[key]) nextOverlay[key] = prevOverlayByKey[key]!;
              else delete nextOverlay[key];
              if (prevLocalByKey[key]) nextLocal[key] = prevLocalByKey[key]!;
              else delete nextLocal[key];
            }
            if (!changed) return;
            curState.overlayRecords = nextOverlay;
            curState.localRecords = nextLocal;
            updateSnapshot(curState);
            writeLocalRecords(targetScope, curState.localRecords);
            notifyAll();
            if (expectedVersion === undefined) {
              pushToast({
                title: "Não foi possível reativar o aviso",
                description: "Verifique sua conexão e tente novamente.",
                variant: "destructive",
              });
            }
          },
          onSuccess: () => {
            if (getActiveUserId() !== uid) return;
            const curState = getOrCreateScopeState(targetScope);
            const nextOverlay = { ...curState.overlayRecords };
            let changed = false;
            for (const key of targetKeys) {
              if (curState.opVersionById[key] !== opVersion) continue;
              changed = true;
              delete nextOverlay[key];
            }
            if (!changed) return;
            curState.overlayRecords = nextOverlay;
            updateSnapshot(curState);
            notifyAll();
          },
        },
      );
    },
    [parsedCloud.records, updateCustomSettingsMutation],
  );

  const dismissCard = useCallback(
    (
      canonicalId: string,
      preset: CarouselDismissPreset,
      options?: DismissCarouselCardOptions,
    ) => {
      const uid = getActiveUserId();
      if (!uid) return;

      const policy = resolveCarouselCardPolicy(canonicalId, options?.policyContext);
      if (policy.category === "p0_mandatory") return;
      if (!policy.allowedPresets.includes(preset)) return;

      const targetScope = resolveScopeKey(uid);
      const state = getOrCreateScopeState(targetScope);
      const prevRecord = mergeCarouselDismissals(parsedCloud.records, state.snapshot)[canonicalId];

      const actionNowMs = Date.now();
      const nextRecord: CarouselDismissalRecord = createCarouselDismissalRecord(
        preset,
        actionNowMs,
        { prevRecord, stage: options?.stage },
      );

      opCounter += 1;
      const opVersion = opCounter;
      const prevLocalRecord = state.localRecords[canonicalId];
      const prevOverlayRecord = state.overlayRecords[canonicalId];

      state.opVersionById[canonicalId] = opVersion;
      state.overlayRecords = { ...state.overlayRecords, [canonicalId]: nextRecord };
      state.localRecords = { ...state.localRecords, [canonicalId]: nextRecord };
      updateSnapshot(state);
      writeLocalRecords(targetScope, state.localRecords);
      notifyAll();

      if (!options?.silentToast) {
        const untilMs = computeCarouselDismissalUntil(actionNowMs, preset);
        const returnDate = formatCarouselReturnDate(untilMs, actionNowMs);
        const periodLabel =
          preset === "7d" ? "por 7 dias" : preset === "1m" ? "por 1 mês" : "por 6 meses";
        pushToast({
          title: `Aviso oculto ${periodLabel} (até ${returnDate})`,
          description: policy.displayName,
          duration: 5000,
          action: {
            label: "Desfazer",
            onClick: () => revokeCard(canonicalId, opVersion),
          },
        });
      }

      updateCustomSettingsMutation.mutate(
        { carouselDismissals: { [canonicalId]: nextRecord } },
        {
          onError: () => {
            if (getActiveUserId() !== uid) return;
            const curState = getOrCreateScopeState(targetScope);
            if (curState.opVersionById[canonicalId] !== opVersion) return;

            const nextOverlay = { ...curState.overlayRecords };
            if (prevOverlayRecord) nextOverlay[canonicalId] = prevOverlayRecord;
            else delete nextOverlay[canonicalId];
            curState.overlayRecords = nextOverlay;

            const nextLocal = { ...curState.localRecords };
            if (prevLocalRecord) nextLocal[canonicalId] = prevLocalRecord;
            else delete nextLocal[canonicalId];
            curState.localRecords = nextLocal;

            updateSnapshot(curState);
            writeLocalRecords(targetScope, curState.localRecords);
            notifyAll();
          },
          onSuccess: () => {
            if (getActiveUserId() !== uid) return;
            const curState = getOrCreateScopeState(targetScope);
            if (curState.opVersionById[canonicalId] !== opVersion) return;
            const nextOverlay = { ...curState.overlayRecords };
            delete nextOverlay[canonicalId];
            curState.overlayRecords = nextOverlay;
            updateSnapshot(curState);
            notifyAll();
          },
        },
      );
    },
    [parsedCloud.records, revokeCard, updateCustomSettingsMutation],
  );

  const evaluateCard = useCallback(
    (
      canonicalId: string,
      options?: {
        policyContext?: CarouselPolicyContext;
        legacySources?: LegacyDismissalSources;
        currentGoalStage?: "completed" | "final_stretch" | "has_surplus" | "regular";
      },
    ): CarouselVisibilityEvaluation => {
      return evaluateCarouselCardVisibility({
        canonicalId,
        carouselDismissals: dismissalsMap,
        invalidIds,
        nowMs,
        policyContext: options?.policyContext,
        legacySources: options?.legacySources,
        currentGoalStage: options?.currentGoalStage,
      });
    },
    [dismissalsMap, invalidIds, nowMs],
  );

  const isCardVisible = useCallback(
    (
      canonicalId: string,
      options?: {
        policyContext?: CarouselPolicyContext;
        legacySources?: LegacyDismissalSources;
        currentGoalStage?: "completed" | "final_stretch" | "has_surplus" | "regular";
      },
    ): boolean => evaluateCard(canonicalId, options).visible,
    [evaluateCard],
  );

  return {
    dismissalsMap,
    invalidIds,
    nowMs,
    isLoading: isQueryPending(userPreferencesQuery),
    dismissCard,
    revokeCard,
    evaluateCard,
    isCardVisible,
  };
}
