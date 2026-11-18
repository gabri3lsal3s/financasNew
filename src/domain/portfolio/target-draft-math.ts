/**
 * Motor puro de manipulação de rascunho de metas hierárquicas (Classes, Setores e Ativos).
 * Sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import type { AssetAllocationStatus, GroupTarget, PortfolioAsset } from "@/types";
import {
  calculateEffectiveAssetTargets,
  distributeEquallyTargets,
  sanitizeGroupTargetsForSave,
  type EffectiveAssetTargetResult,
} from "./allocation";
import { normalizeAllocationTargets } from "./snowball";
import { inferSectorFromTicker } from "./tickers-catalog";

export interface StoredSectorMaps {
  byClass: Map<string, Map<string, number>>;
  legacyFallback: Map<string, number>;
}

export interface TargetDraftPositionRow {
  assetId: string;
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  valueBRL: number;
  pct: number;
}

export interface ComputedTargetAssetScoreRow {
  assetId: string;
  ticker: string;
  assetClass: string;
  sector: string | null;
  valueBRL: number;
  currentPct: number;
  rawScore: number | null;
  effectiveScore: number;
  effectiveTargetPct: number;
  status: AssetAllocationStatus;
  formulaLabel: string;
}

export function sectorDraftKey(className: string, sectorName: string): string {
  return `${className}::${sectorName}`;
}

export function buildStoredSectorMaps(
  sectorTargets: readonly GroupTarget[],
): StoredSectorMaps {
  const byClass = new Map<string, Map<string, number>>();
  const legacyFallback = new Map<string, number>();

  for (const item of sectorTargets) {
    const cls = item.class_name?.trim();
    if (cls) {
      const inner = byClass.get(cls) ?? new Map<string, number>();
      inner.set(item.name, item.target_percentage);
      byClass.set(cls, inner);
    } else {
      legacyFallback.set(item.name, item.target_percentage);
    }
  }

  return { byClass, legacyFallback };
}

export function resolveDraftClassTarget(
  className: string,
  classDraft: Readonly<Record<string, number>>,
  storedClassTargets: ReadonlyMap<string, number>,
): number {
  return classDraft[className] ?? storedClassTargets.get(className) ?? 0;
}

export function resolveDraftSectorTarget(
  sectorName: string,
  className: string,
  sectorDraft: Readonly<Record<string, number>>,
  storedSectorMaps: StoredSectorMaps,
): number {
  const key = sectorDraftKey(className, sectorName);
  if (key in sectorDraft) return sectorDraft[key] ?? 0;
  const scoped = storedSectorMaps.byClass.get(className);
  if (scoped?.has(sectorName)) return scoped.get(sectorName) ?? 0;
  return storedSectorMaps.legacyFallback.get(sectorName) ?? 0;
}

export function buildNormalizedDraftPatch(
  keys: readonly string[],
  getCurrentValue: (key: string) => number,
  keyBuilder: (key: string) => string = (k) => k,
): Record<string, number> {
  const normalized = normalizeAllocationTargets(
    keys.map((id) => ({ id, targetPercentage: getCurrentValue(id) })),
    100,
  );
  const patch: Record<string, number> = {};
  for (const item of normalized) {
    patch[keyBuilder(item.id)] = item.targetPercentage;
  }
  return patch;
}

export function buildEqualDraftPatch(
  keys: readonly string[],
  keyBuilder: (key: string) => string = (k) => k,
): Record<string, number> {
  const distributed = distributeEquallyTargets(
    keys.map((id) => ({ id })),
    100,
  );
  const patch: Record<string, number> = {};
  for (const item of distributed) {
    patch[keyBuilder(item.id)] = item.targetPercentage;
  }
  return patch;
}

export function buildRemainingDraftPatch(
  keys: readonly string[],
  getCurrentValue: (key: string) => number,
): Record<string, number> {
  const sum = keys.reduce((acc, k) => acc + getCurrentValue(k), 0);
  const remaining = Math.max(0, Math.round((100 - sum) * 100) / 100);
  if (!(remaining > 0)) return {};

  const zeroKeys = keys.filter((k) => getCurrentValue(k) === 0);
  const targetKeys = zeroKeys.length > 0 ? zeroKeys : keys;
  if (targetKeys.length === 0) return {};

  const perItem = Math.round((remaining / targetKeys.length) * 100) / 100;
  const draft: Record<string, number> = {};
  let assigned = 0;

  targetKeys.forEach((k, idx) => {
    const isLast = idx === targetKeys.length - 1;
    const add = isLast ? Math.max(0, Math.round((remaining - assigned) * 100) / 100) : perItem;
    assigned += add;
    draft[k] = Math.round((getCurrentValue(k) + add) * 100) / 100;
  });

  const sanitized = sanitizeGroupTargetsForSave(
    keys.map((name) => ({
      name,
      target: draft[name] ?? getCurrentValue(name),
    })),
  );

  const finalPatch: Record<string, number> = {};
  for (const item of sanitized) {
    finalPatch[item.name] = item.target;
  }
  return finalPatch;
}

export function buildZeroDraftPatch(
  keys: readonly string[],
  keyBuilder: (key: string) => string = (k) => k,
): Record<string, number> {
  const patch: Record<string, number> = {};
  for (const key of keys) {
    patch[keyBuilder(key)] = 0;
  }
  return patch;
}

export function buildStoredSectorsPayload(
  sectorTargets: readonly GroupTarget[],
  overrideClass?: string,
  overrideSectors?: readonly { name: string; target: number }[],
): Array<{ class_name: string; name: string; target_percentage: number }> {
  const byClass = new Map<string, Array<{ name: string; target: number }>>();

  for (const item of sectorTargets) {
    const cls = item.class_name?.trim();
    if (!cls) continue;
    if (overrideClass && cls === overrideClass) continue;
    if (item.target_percentage > 0) {
      const list = byClass.get(cls) ?? [];
      list.push({ name: item.name, target: item.target_percentage });
      byClass.set(cls, list);
    }
  }

  if (overrideClass && overrideSectors) {
    const activeList = overrideSectors
      .filter((item) => item.target > 0)
      .map((item) => ({ name: item.name, target: item.target }));
    if (activeList.length > 0) {
      byClass.set(overrideClass, activeList);
    } else {
      byClass.delete(overrideClass);
    }
  }

  const payload: Array<{ class_name: string; name: string; target_percentage: number }> = [];
  for (const [cls, list] of byClass.entries()) {
    const sanitizedList = sanitizeGroupTargetsForSave(list);
    for (const item of sanitizedList) {
      if (item.target > 0) {
        payload.push({
          class_name: cls,
          name: item.name,
          target_percentage: item.target,
        });
      }
    }
  }

  return payload;
}

export function buildEffectiveTargetsAndScoreRows(params: {
  classes: readonly string[];
  investableRows: readonly TargetDraftPositionRow[];
  investableTotalBRL: number;
  assetMap: ReadonlyMap<string, PortfolioAsset>;
  classDraft: Readonly<Record<string, number>>;
  sectorDraft: Readonly<Record<string, number>>;
  storedClassTargets: ReadonlyMap<string, number>;
  storedSectorMaps: StoredSectorMaps;
}): {
  effectiveMap: Map<string, EffectiveAssetTargetResult>;
  assetScoreRows: ComputedTargetAssetScoreRow[];
} {
  const {
    classes,
    investableRows,
    investableTotalBRL,
    assetMap,
    classDraft,
    sectorDraft,
    storedClassTargets,
    storedSectorMaps,
  } = params;

  const effectiveClassTargets = classes.map((cls) => ({
    className: cls,
    targetPercentage: resolveDraftClassTarget(cls, classDraft, storedClassTargets),
  }));

  const effectiveSectorTargets: Array<{
    className?: string | null;
    sectorName: string;
    targetPercentage: number;
  }> = [];

  for (const cls of classes) {
    const sectorsInClass = new Set<string>();
    for (const row of investableRows) {
      if (row.assetClass === cls) {
        const sec = row.sector?.trim() || inferSectorFromTicker(row.ticker, cls);
        if (sec) sectorsInClass.add(sec);
      }
    }
    const storedForClass = storedSectorMaps.byClass.get(cls);
    if (storedForClass) {
      for (const sec of storedForClass.keys()) sectorsInClass.add(sec);
    }

    for (const sec of sectorsInClass) {
      const pct = resolveDraftSectorTarget(sec, cls, sectorDraft, storedSectorMaps);
      if (pct > 0) {
        effectiveSectorTargets.push({
          className: cls,
          sectorName: sec,
          targetPercentage: pct,
        });
      }
    }
  }

  const inputs = investableRows.map((row) => {
    const asset = assetMap.get(row.assetId);
    const sec =
      row.sector?.trim() ||
      asset?.sector?.trim() ||
      inferSectorFromTicker(row.ticker, row.assetClass);
    return {
      id: row.assetId,
      ticker: row.ticker,
      assetClass: row.assetClass ?? "Sem classe",
      sector: sec || null,
      score: asset?.score ?? null,
      allocation_status: asset?.allocation_status ?? "active",
    };
  });

  const results = calculateEffectiveAssetTargets({
    assets: inputs,
    classTargets: effectiveClassTargets,
    sectorTargets: effectiveSectorTargets,
  });

  const effectiveMap = new Map(results.map((r) => [r.assetId, r]));
  const assetScoreRows: ComputedTargetAssetScoreRow[] = investableRows.map((row) => {
    const asset = assetMap.get(row.assetId);
    const effective = effectiveMap.get(row.assetId);
    const rawScore = asset?.score ?? null;
    const status = asset?.allocation_status ?? "active";
    const sector =
      row.sector?.trim() ||
      asset?.sector?.trim() ||
      inferSectorFromTicker(row.ticker, row.assetClass);

    return {
      assetId: row.assetId,
      ticker: row.ticker,
      assetClass: row.assetClass ?? "Sem classe",
      sector: sector || null,
      valueBRL: row.valueBRL,
      currentPct: investableTotalBRL > 0 ? (row.valueBRL / investableTotalBRL) * 100 : row.pct,
      rawScore: effective?.rawScore ?? rawScore,
      effectiveScore: effective?.effectiveScore ?? rawScore ?? 5,
      effectiveTargetPct: effective?.effectiveTargetPct ?? 0,
      status,
      formulaLabel: effective?.formulaLabel ?? "Defina a meta da classe para calcular",
    };
  });

  return { effectiveMap, assetScoreRows };
}
