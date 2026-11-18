/**
 * Metas de alocação hierárquicas — ESPECIFICAÇÃO §3.11.1 (Plano 42 / v3.10.0).
 *
 * Regras canônicas (3 níveis):
 *   • Nível 1 — Classes %: soma ≤ 100% dos ativos investíveis (exclui Caixa).
 *   • Nível 2 — Setores % por Classe (opcional por classe): quando configurados, somam ≤ 100% da classe.
 *   • Nível 3 — Notas de Convicção (0–10) + Status Operacional por ativo: derivam o peso no grupo.
 *
 * Motor 100% puro — testável isoladamente, sem UI ou Supabase.
 */

import type { AssetAllocationStatus } from "@/types";
import { isCashAssetClass, normalizeClassName } from "./valuation";

function formatPctPtBr(value: number, decimals = 1): string {
  return value.toFixed(decimals).replace(".", ",");
}

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface TargetDraft {
  /** asset_id (metas por ativo) ou nome do grupo (classe/setor). */
  key: string;
  /** 0–100. */
  target: number;
}

export interface TargetValidation {
  ok: boolean;
  sum: number;
  /** Quanto falta para 100 (0 quando excedeu). */
  remaining: number;
  /** Mensagem pt-BR quando inválida. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Soma e validação
// ---------------------------------------------------------------------------

/** Soma dos percentuais de um conjunto de metas (arredondada para 2 casas decimais). */
export function targetsSum(targets: readonly Pick<TargetDraft, "target">[]): number {
  const rawSum = targets.reduce((acc, t) => acc + (Number.isFinite(t.target) ? t.target : 0), 0);
  return Math.round(rawSum * 100) / 100;
}

/**
 * Valida a soma das metas (≤ 100%). Usada na UI (barra de soma) e
 * espelhada no servidor (RPC `save_portfolio_hierarchy_targets` valida após o lote).
 */
export function validateTargetsSum(targets: readonly Pick<TargetDraft, "target">[]): TargetValidation {
  const sum = targetsSum(targets);
  if (sum > 100.001) {
    return {
      ok: false,
      sum,
      remaining: 0,
      error: "A soma das metas excede 100%. Reduza algum percentual.",
    };
  }
  const safeSum = Math.min(100, Math.max(0, sum));
  return {
    ok: true,
    sum: safeSum,
    remaining: Math.max(0, Math.round((100 - safeSum) * 100) / 100),
    error: null,
  };
}

/** Clampa um percentual para 0–100 (2 casas). */
export function clampTargetPercentage(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.min(100, Math.max(0, value));
  return Math.round(clamped * 100) / 100;
}

/** Normaliza um valor digitado (aceita vírgula pt-BR e vazio → 0). */
export function parseTargetInput(raw: string): number {
  const normalized = raw.replace(",", ".").replace(/\s/g, "");
  if (normalized === "" || normalized === ".") return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? clampTargetPercentage(parsed) : 0;
}

/**
 * Higieniza metas de grupo (classes ou setores) antes de enviar ao servidor:
 * 1. Arredonda todos os valores para 2 casas decimais.
 * 2. Garante que a soma total não ultrapasse 100.00% por dízimas ou ponto flutuante (§Blindagem B11).
 */
export function sanitizeGroupTargetsForSave<T extends { name: string; target: number }>(
  targets: readonly T[],
): T[] {
  const result = targets.map((t) => ({
    ...t,
    target: Math.max(0, Math.round((Number.isFinite(t.target) ? t.target : 0) * 100) / 100),
  }));

  const sum = Math.round(result.reduce((acc, t) => acc + t.target, 0) * 100) / 100;
  if (sum > 100) {
    const diff = Math.round((sum - 100) * 100) / 100;
    for (let i = result.length - 1; i >= 0; i--) {
      const item = result[i];
      if (item && item.target >= diff) {
        result[i] = {
          ...item,
          target: Math.round((item.target - diff) * 100) / 100,
        };
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Ações Rápidas de Alocação (1/N, Espelhamento e Comparativo de Gap)
// ---------------------------------------------------------------------------

/**
 * Normaliza proporcionalmente um conjunto de metas para somar rigorosamente o teto total (padrão 100%).
 * Preserva as escolhas relativas dos percentuais e notas sem exigir ajustes manuais.
 */
export function normalizeGroupTargets<T extends { name: string; target: number }>(
  items: readonly T[],
  totalCeiling = 100,
): Array<T & { normalizedTarget: number }> {
  const sum = items.reduce((acc, it) => acc + Math.max(0, Number.isFinite(it.target) ? it.target : 0), 0);
  if (sum <= 0) {
    return items.map((it) => ({ ...it, normalizedTarget: 0 }));
  }
  let accumulated = 0;
  return items.map((it, idx) => {
    if (idx === items.length - 1) {
      const remainder = Math.max(0, Math.round((totalCeiling - accumulated) * 100) / 100);
      return { ...it, normalizedTarget: remainder };
    }
    const ratio = Math.max(0, it.target) / sum;
    const share = Math.round((ratio * totalCeiling) * 100) / 100;
    accumulated = Math.round((accumulated + share) * 100) / 100;
    return { ...it, normalizedTarget: share };
  });
}

/**
 * Distribui o teto (`targetTotal`, padrão 100%) igualmente entre os itens (1/N).
 * Trata resíduos de arredondamento no último item para que a soma seja rigorosamente exata.
 */
export function distributeEquallyTargets<T extends { id: string }>(
  items: readonly T[],
  targetTotal = 100,
): Array<T & { targetPercentage: number }> {
  if (items.length === 0) return [];
  const clampedTotal = clampTargetPercentage(targetTotal);
  if (clampedTotal === 0) {
    return items.map((item) => ({ ...item, targetPercentage: 0 }));
  }

  const count = items.length;
  const equalShare = Math.floor((clampedTotal / count) * 100) / 100;
  let accumulated = 0;

  return items.map((item, index) => {
    if (index === count - 1) {
      const remainder = Math.max(0, Math.round((clampedTotal - accumulated) * 100) / 100);
      return { ...item, targetPercentage: remainder };
    }
    accumulated = Math.round((accumulated + equalShare) * 100) / 100;
    return { ...item, targetPercentage: equalShare };
  });
}

/**
 * Espelha a alocação atual de mercado da carteira (`currentPct`) nas metas,
 * normalizando proporcionalmente para somar `targetTotal` (padrão 100%).
 */
export function mirrorCurrentPositionTargets<T extends { id: string; currentPct: number }>(
  items: readonly T[],
  targetTotal = 100,
): Array<T & { targetPercentage: number }> {
  if (items.length === 0) return [];
  const totalCurrent = items.reduce((acc, item) => acc + Math.max(0, item.currentPct), 0);
  if (totalCurrent <= 0) {
    return distributeEquallyTargets(items, targetTotal);
  }

  const clampedTotal = clampTargetPercentage(targetTotal);
  let accumulated = 0;
  return items.map((item, index) => {
    if (index === items.length - 1) {
      const finalVal = Math.max(0, Math.round((clampedTotal - accumulated) * 100) / 100);
      return { ...item, targetPercentage: finalVal };
    }
    const ratio = Math.max(0, item.currentPct) / totalCurrent;
    const val = Math.round(ratio * clampedTotal * 100) / 100;
    accumulated = Math.round((accumulated + val) * 100) / 100;
    return { ...item, targetPercentage: val };
  });
}

export interface AssetAllocationDelta {
  currentPct: number;
  targetPct: number;
  deltaPct: number;
  /** True quando a meta é maior que a posição atual (receberá aporte). */
  isUnderallocated: boolean;
  formattedDelta: string;
}

/**
 * Calcula o delta (gap) entre a meta configurada e a posição atual da carteira.
 * Δ = Alvo% − Atual%.
 */
export function calculateAssetAllocationDelta(currentPct: number, targetPct: number): AssetAllocationDelta {
  const cur = Number.isFinite(currentPct) ? currentPct : 0;
  const tgt = Number.isFinite(targetPct) ? targetPct : 0;
  const delta = Math.round((tgt - cur) * 100) / 100;
  const sign = delta > 0 ? "+" : "";
  return {
    currentPct: cur,
    targetPct: tgt,
    deltaPct: delta,
    isUnderallocated: delta > 0.05,
    formattedDelta: `${sign}${formatPctPtBr(delta, 1)}%`,
  };
}

// ---------------------------------------------------------------------------
// Agrupamento e Validações Hierárquicas por Setor
// ---------------------------------------------------------------------------

export interface SectorItem {
  id: string;
  name: string;
  className: string;
  targetPercentage: number;
}

/**
 * Agrupa ativos da carteira por Classe e, dentro de cada classe, por Setor/Segmento.
 * Ativos sem setor ou classe recebem fallbacks amigáveis ("Geral" / "Outros").
 */
export function groupAssetsByClassAndSector<
  T extends { id: string; assetClass?: string | null; sector?: string | null },
>(items: readonly T[]): Map<string, Map<string, T[]>> {
  const result = new Map<string, Map<string, T[]>>();

  for (const item of items) {
    const className = item.assetClass?.trim() || "Outros";
    const sectorName = item.sector?.trim() || "Geral";

    let sectorMap = result.get(className);
    if (!sectorMap) {
      sectorMap = new Map<string, T[]>();
      result.set(className, sectorMap);
    }

    const list = sectorMap.get(sectorName) || [];
    list.push(item);
    sectorMap.set(sectorName, list);
  }

  return result;
}

/**
 * Calcula a meta absoluta do setor no patrimônio total (em % da carteira)
 * a partir da meta da classe (%) e da meta relativa do setor (%) dentro dela.
 * Exemplo: Classe Ações com meta 40%, Setor Bancos com meta 25% da classe -> 10% da carteira.
 */
export function calculateSectorEffectiveTargetPct(classTargetPct: number, sectorTargetInClassPct: number): number {
  const c = Math.max(0, Number.isFinite(classTargetPct) ? classTargetPct : 0);
  const s = Math.max(0, Number.isFinite(sectorTargetInClassPct) ? sectorTargetInClassPct : 0);
  return Math.round(((c * s) / 100) * 100) / 100;
}

/**
 * Valida a soma das metas relativas dos setores de uma classe (deve somar ≤ 100% da classe).
 */
export function validateClassSectorTargetsSum(
  sectorTargets: readonly Pick<TargetDraft, "target">[],
  className = "Classe",
): TargetValidation {
  const sum = targetsSum(sectorTargets);
  if (sum > 100.001) {
    return {
      ok: false,
      sum,
      remaining: 0,
      error: `A soma dos setores de ${className} excede 100%. Reduza algum percentual.`,
    };
  }
  const safeSum = Math.min(100, Math.max(0, sum));
  return {
    ok: true,
    sum: safeSum,
    remaining: Math.max(0, Math.round((100 - safeSum) * 100) / 100),
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Governança por Notas, Quarentenas & PQS (Fase 41 — Roadmap v3.9.0)
// ---------------------------------------------------------------------------

export interface AssetScoreInput {
  id: string;
  ticker?: string;
  assetClass?: string | null;
  sector?: string | null;
  score?: number | null;
  allocation_status?: AssetAllocationStatus;
}

export interface DerivedAssetWeight {
  rawScore: number | null;
  effectiveScore: number;
  weightInSector: number; // 0 a 1
  isEligible: boolean;
  status: AssetAllocationStatus;
}

/**
 * Deriva os pesos relativos dos ativos dentro de um grupo (setor ou classe)
 * a partir das notas (0–10) e do status de alocação (§4.1 PLANO_41).
 *
 * Invariantes Canônicas:
 * - Ativos em 'quarantine' ou 'exit' recebem peso 0 e isEligible = false (Salvaguarda S3).
 * - Ativos em 'neutral' mantêm posição mas não recebem novos aportes (peso 0, isEligible = false).
 * - Ativo 'active' sem nota (null/undefined) recebe Nota 5 (Neutro) por padrão (Salvaguarda S1).
 * - Se a soma das notas elegíveis for > 0, os pesos somam estritamente 1.0 (100%).
 * - Se todos os ativos estiverem inelegíveis (soma = 0), todos recebem peso 0 (Salvaguarda S2).
 */
export function deriveAssetWeightsFromScores<T extends AssetScoreInput>(
  assets: readonly T[],
): Array<T & DerivedAssetWeight> {
  if (assets.length === 0) return [];

  const mapped = assets.map((asset) => {
    const status: AssetAllocationStatus = asset.allocation_status ?? "active";
    const rawScore: number | null = asset.score ?? null;
    let effectiveScore: number;
    let isEligible: boolean;

    if (status === "active") {
      if (rawScore == null) {
        effectiveScore = 5; // Fallback neutro (Salvaguarda S1)
        isEligible = true;
      } else {
        const clamped = Math.max(0, Math.min(10, Math.round(rawScore)));
        effectiveScore = clamped;
        isEligible = clamped > 0;
      }
    } else {
      // quarantine, exit, neutral -> peso 0 (Salvaguarda S3)
      effectiveScore = 0;
      isEligible = false;
    }

    return {
      ...asset,
      rawScore,
      status,
      effectiveScore,
      isEligible,
      weightInSector: 0,
    };
  });

  const totalEligibleScore = mapped.reduce((acc, a) => acc + (a.isEligible ? a.effectiveScore : 0), 0);

  if (totalEligibleScore <= 0) {
    return mapped.map((m) => ({ ...m, weightInSector: 0 }));
  }

  // Distribuição proporcional com conservação rigorosa de 1.0
  let accumulatedWeight = 0;
  const eligibleItems = mapped.filter((m) => m.isEligible);
  const lastEligibleId = eligibleItems[eligibleItems.length - 1]?.id;

  return mapped.map((item) => {
    if (!item.isEligible) {
      return { ...item, weightInSector: 0 };
    }
    if (item.id === lastEligibleId) {
      const remainingWeight = Math.max(0, Math.round((1 - accumulatedWeight) * 10000) / 10000);
      return { ...item, weightInSector: remainingWeight };
    }
    const rawWeight = item.effectiveScore / totalEligibleScore;
    const roundedWeight = Math.round(rawWeight * 10000) / 10000;
    accumulatedWeight += roundedWeight;
    return { ...item, weightInSector: roundedWeight };
  });
}

export interface ScopedSectorTargetInput {
  className?: string | null;
  sectorName: string;
  targetPercentage: number;
}

export type ClassTargetsInput =
  | Record<string, number>
  | readonly { className: string; targetPercentage: number }[];

export type SectorTargetsInput =
  | Record<string, number>
  | readonly ScopedSectorTargetInput[];

export interface EffectiveAssetTargetResult {
  assetId: string;
  rawScore: number | null;
  effectiveScore: number;
  effectiveTargetPct: number; // % do patrimônio investível da carteira (0 a 100)
  classTargetPct: number;
  sectorTargetPctInClass: number | null; // null quando setores não estão configurados para a classe
  weightInSector: number;
  isEligible: boolean;
  status: AssetAllocationStatus;
  formulaLabel: string;
}

function buildStatusBlockedFormula(status: AssetAllocationStatus, rawScore: number | null): string {
  if (status === "quarantine") return "Em quarentena (aportes bloqueados)";
  if (status === "exit") return "Encerramento / Saída (meta zerada)";
  if (status === "neutral") return "Status Neutro (sem novos aportes)";
  if (rawScore != null && rawScore <= 0) return "Nota 0 (sem participação em aportes)";
  return "Inelegível nesta rodada";
}

function buildScoreDescriptor(rawScore: number | null, effectiveScore: number): string {
  return rawScore == null ? "Sem nota, peso 5" : `Nota ${effectiveScore}`;
}

/**
 * Calcula a meta efetiva global nos 3 níveis hierárquicos (§3.11.1 · Plano 42):
 * T_i = Target_Classe × Target_Setor_na_Classe × w_{i ∈ Setor}
 *
 * Invariantes:
 * - Ativos de Caixa são excluídos das metas (effectiveTargetPct = 0).
 * - Setores são escopados por classe (`class_name::sector_name`) e opcionais:
 *   se a classe não tiver metas setoriais (> 0%), distribui diretamente por Nota (Salvaguarda S5).
 * - Se um setor configurado (> 0%) tiver 100% dos seus ativos inelegíveis (quarentena/saída/neutro),
 *   sua fatia transborda proporcionalmente para os setores elegíveis da mesma classe (Salvaguarda S2).
 */
export function calculateEffectiveAssetTargets<
  T extends AssetScoreInput & { assetClass?: string | null; sector?: string | null },
>(params: {
  assets: readonly T[];
  classTargets: ClassTargetsInput;
  sectorTargets?: SectorTargetsInput;
  autoNormalize?: boolean;
}): EffectiveAssetTargetResult[] {
  const { assets, classTargets, sectorTargets, autoNormalize = false } = params;
  if (assets.length === 0) return [];

  // 1. Normalizar metas por classe (com auto-normalização proporcional para 100%)
  const classTargetByNorm = new Map<string, number>();
  if (Array.isArray(classTargets)) {
    for (const ct of classTargets) {
      const norm = normalizeClassName(ct.className);
      if (norm && norm !== "caixa") {
        classTargetByNorm.set(norm, Math.max(0, ct.targetPercentage));
      }
    }
  } else {
    for (const [cls, pct] of Object.entries(classTargets)) {
      const norm = normalizeClassName(cls);
      if (norm && norm !== "caixa") {
        classTargetByNorm.set(norm, Math.max(0, pct));
      }
    }
  }

  // Auto-normalização proporcional das classes para 100% do patrimônio investível
  const totalClassWeight = Array.from(classTargetByNorm.values()).reduce((acc, v) => acc + v, 0);
  const normalizedClassTargetByNorm = new Map<string, number>();
  const shouldNormalizeClasses = (autoNormalize || totalClassWeight > 100.001) && totalClassWeight > 0;

  if (shouldNormalizeClasses) {
    if (Math.abs(totalClassWeight - 100) < 0.01) {
      for (const [cls, v] of classTargetByNorm.entries()) {
        normalizedClassTargetByNorm.set(cls, v);
      }
    } else {
      let accumulated = 0;
      const entries = Array.from(classTargetByNorm.entries());
      entries.forEach(([cls, v], idx) => {
        if (idx === entries.length - 1) {
          normalizedClassTargetByNorm.set(cls, Math.max(0, Math.round((100 - accumulated) * 100) / 100));
        } else {
          const share = Math.round(((v / totalClassWeight) * 100) * 100) / 100;
          accumulated += share;
          normalizedClassTargetByNorm.set(cls, share);
        }
      });
    }
  } else {
    for (const [cls, v] of classTargetByNorm.entries()) {
      normalizedClassTargetByNorm.set(cls, v);
    }
  }

  // 2. Normalizar metas setoriais escopadas por classe (ou legado plano)
  const scopedSectors = new Map<string, Map<string, number>>();
  const flatSectors = new Map<string, number>();

  if (Array.isArray(sectorTargets)) {
    for (const st of sectorTargets) {
      const secKey = st.sectorName.trim().toLowerCase();
      if (!secKey) continue;
      if (st.className && st.className.trim().length > 0) {
        const normCls = normalizeClassName(st.className);
        const clsMap = scopedSectors.get(normCls) ?? new Map<string, number>();
        clsMap.set(secKey, Math.max(0, st.targetPercentage));
        scopedSectors.set(normCls, clsMap);
      } else {
        flatSectors.set(secKey, Math.max(0, st.targetPercentage));
      }
    }
  } else if (sectorTargets) {
    for (const [rawKey, pct] of Object.entries(sectorTargets)) {
      const sepIndex = rawKey.indexOf("::");
      if (sepIndex > 0) {
        const normCls = normalizeClassName(rawKey.slice(0, sepIndex));
        const secKey = rawKey.slice(sepIndex + 2).trim().toLowerCase();
        if (normCls && secKey) {
          const clsMap = scopedSectors.get(normCls) ?? new Map<string, number>();
          clsMap.set(secKey, Math.max(0, pct));
          scopedSectors.set(normCls, clsMap);
        }
      } else {
        const secKey = rawKey.trim().toLowerCase();
        if (secKey) {
          flatSectors.set(secKey, Math.max(0, pct));
        }
      }
    }
  }

  const results: EffectiveAssetTargetResult[] = [];
  const assetsByClass = new Map<string, T[]>();

  for (const asset of assets) {
    const isCash =
      isCashAssetClass(asset.assetClass) ||
      (asset.ticker ?? "").trim().toUpperCase() === "CAIXA";

    if (isCash) {
      results.push({
        assetId: asset.id,
        rawScore: asset.score ?? null,
        effectiveScore: 0,
        effectiveTargetPct: 0,
        classTargetPct: 0,
        sectorTargetPctInClass: null,
        weightInSector: 0,
        isEligible: false,
        status: asset.allocation_status ?? "active",
        formulaLabel: "Liquidez em Caixa (fora das metas)",
      });
      continue;
    }

    const cls = asset.assetClass?.trim() || "Outros";
    const list = assetsByClass.get(cls) || [];
    list.push(asset);
    assetsByClass.set(cls, list);
  }

  for (const [className, classAssets] of assetsByClass.entries()) {
    const normClass = normalizeClassName(className);
    const classTargetPct = Math.max(0, normalizedClassTargetByNorm.get(normClass) ?? 0);

    // Identificar mapa setorial efetivo desta classe
    const classScopedMap = scopedSectors.get(normClass);
    const effectiveSectorMap = new Map<string, number>();
    if (classScopedMap) {
      for (const [secKey, pct] of classScopedMap.entries()) {
        effectiveSectorMap.set(secKey, pct);
      }
    } else if (flatSectors.size > 0) {
      for (const asset of classAssets) {
        const sec = (asset.sector?.trim() || "Geral").toLowerCase();
        if (flatSectors.has(sec)) {
          effectiveSectorMap.set(sec, flatSectors.get(sec)!);
        }
      }
    }

    const hasConfiguredSectorTargets = Array.from(effectiveSectorMap.values()).some((v) => v > 0);

    // Auto-normalização proporcional dos setores dentro da classe (somando 100% da classe)
    const normalizedSectorMap = new Map<string, number>();
    if (hasConfiguredSectorTargets) {
      const totalSectorWeight = Array.from(effectiveSectorMap.values()).reduce((acc, v) => acc + v, 0);
      const shouldNormalizeSectors = (autoNormalize || totalSectorWeight > 100.001) && totalSectorWeight > 0;
      if (shouldNormalizeSectors) {
        if (Math.abs(totalSectorWeight - 100) < 0.01) {
          for (const [secKey, v] of effectiveSectorMap.entries()) {
            normalizedSectorMap.set(secKey, v);
          }
        } else {
          let accumulated = 0;
          const positiveEntries = Array.from(effectiveSectorMap.entries()).filter(([, v]) => v > 0);
          positiveEntries.forEach(([secKey, v], idx) => {
            if (idx === positiveEntries.length - 1) {
              normalizedSectorMap.set(secKey, Math.max(0, Math.round((100 - accumulated) * 100) / 100));
            } else {
              const share = Math.round(((v / totalSectorWeight) * 100) * 100) / 100;
              accumulated += share;
              normalizedSectorMap.set(secKey, share);
            }
          });
        }
      } else {
        for (const [secKey, v] of effectiveSectorMap.entries()) {
          normalizedSectorMap.set(secKey, v);
        }
      }
    }

    if (!hasConfiguredSectorTargets) {
      // Salvaguarda S5: Setores não configurados nesta classe -> ponderação direta por Notas na classe
      const weightedAssets = deriveAssetWeightsFromScores(classAssets);
      for (const item of weightedAssets) {
        const effectivePct =
          classTargetPct > 0 && item.isEligible
            ? Math.round(classTargetPct * item.weightInSector * 100) / 100
            : 0;
        const formulaLabel = !item.isEligible
          ? buildStatusBlockedFormula(item.status, item.rawScore)
          : classTargetPct <= 0
            ? "Classe sem meta configurada"
            : `${formatPctPtBr(classTargetPct)}% Classe · ${formatPctPtBr(item.weightInSector * 100)}% Peso (${buildScoreDescriptor(item.rawScore, item.effectiveScore)})`;

        results.push({
          assetId: item.id,
          rawScore: item.rawScore,
          effectiveScore: item.effectiveScore,
          effectiveTargetPct: effectivePct,
          classTargetPct,
          sectorTargetPctInClass: null,
          weightInSector: item.weightInSector,
          isEligible: item.isEligible,
          status: item.status,
          formulaLabel,
        });
      }
      continue;
    }

    // Hierarquia completa: Classe -> Setores escopados -> Notas dos ativos
    const assetsBySector = new Map<string, T[]>();
    for (const asset of classAssets) {
      const sec = asset.sector?.trim() || "Geral";
      const list = assetsBySector.get(sec) || [];
      list.push(asset);
      assetsBySector.set(sec, list);
    }

    interface SectorComputedBlock {
      sectorName: string;
      secKey: string;
      configuredPct: number;
      weightedAssets: Array<T & DerivedAssetWeight>;
      hasEligible: boolean;
    }

    const sectorBlocks: SectorComputedBlock[] = [];
    for (const [sectorName, sectorAssets] of assetsBySector.entries()) {
      const secKey = sectorName.trim().toLowerCase();
      const configuredPct = Math.max(0, normalizedSectorMap.get(secKey) ?? 0);
      const weightedAssets = deriveAssetWeightsFromScores(sectorAssets);
      const hasEligible = weightedAssets.some((w) => w.isEligible);
      sectorBlocks.push({
        sectorName,
        secKey,
        configuredPct,
        weightedAssets,
        hasEligible,
      });
    }

    // Salvaguarda S2: detectar setores configurados (> 0%) que ficaram 100% inelegíveis
    let blockedSectorPctOverflow = 0;
    let activeConfiguredSectorsSum = 0;
    for (const block of sectorBlocks) {
      if (block.configuredPct > 0) {
        if (block.hasEligible) {
          activeConfiguredSectorsSum += block.configuredPct;
        } else {
          blockedSectorPctOverflow += block.configuredPct;
        }
      }
    }

    // Se algum setor > 0% ficou 100% inelegível e nenhum outro setor configurado é elegível,
    // verifica se existem ativos elegíveis em setores não zerados da classe para absorverem a verba.
    if (blockedSectorPctOverflow > 0 && activeConfiguredSectorsSum === 0) {
      const fallbackClassAssets = sectorBlocks
        .filter((b) => !(effectiveSectorMap.has(b.secKey) && b.configuredPct === 0))
        .flatMap((b) => b.weightedAssets)
        .filter((w) => w.isEligible);

      if (fallbackClassAssets.length > 0) {
        const reweightedFallback = deriveAssetWeightsFromScores(fallbackClassAssets);
        const fallbackWeightById = new Map(reweightedFallback.map((w) => [w.id, w.weightInSector]));

        for (const block of sectorBlocks) {
          for (const item of block.weightedAssets) {
            const w = fallbackWeightById.get(item.id) ?? 0;
            const effectivePct =
              classTargetPct > 0 && w > 0 ? Math.round(classTargetPct * w * 100) / 100 : 0;
            const formulaLabel = !item.isEligible
              ? buildStatusBlockedFormula(item.status, item.rawScore)
              : w > 0 && classTargetPct > 0
                ? `${formatPctPtBr(classTargetPct)}% Classe · ${formatPctPtBr(w * 100)}% Peso (${buildScoreDescriptor(item.rawScore, item.effectiveScore)})`
                : effectiveSectorMap.has(block.secKey) && block.configuredPct === 0
                  ? "Setor com meta 0% nesta classe"
                  : "Sem meta ativa nesta classe";

            results.push({
              assetId: item.id,
              rawScore: item.rawScore,
              effectiveScore: item.effectiveScore,
              effectiveTargetPct: effectivePct,
              classTargetPct,
              sectorTargetPctInClass: effectiveSectorMap.has(block.secKey) ? block.configuredPct : null,
              weightInSector: w,
              isEligible: item.isEligible,
              status: item.status,
              formulaLabel,
            });
          }
        }
        continue;
      }
    }

    for (const block of sectorBlocks) {
      let effectiveSectorInClass = block.configuredPct;
      if (
        block.configuredPct > 0 &&
        block.hasEligible &&
        blockedSectorPctOverflow > 0 &&
        activeConfiguredSectorsSum > 0
      ) {
        effectiveSectorInClass =
          block.configuredPct + (block.configuredPct / activeConfiguredSectorsSum) * blockedSectorPctOverflow;
      } else if (block.configuredPct > 0 && !block.hasEligible && activeConfiguredSectorsSum > 0) {
        effectiveSectorInClass = 0;
      }

      const roundedSectorShare = Math.round(effectiveSectorInClass * 100) / 100;
      const sectorEffectivePctOfPortfolio = (classTargetPct * effectiveSectorInClass) / 100;

      for (const item of block.weightedAssets) {
        const effectivePct =
          classTargetPct > 0 && effectiveSectorInClass > 0 && item.isEligible
            ? Math.round(sectorEffectivePctOfPortfolio * item.weightInSector * 100) / 100
            : 0;

        let formulaLabel: string;
        if (!item.isEligible) {
          formulaLabel = buildStatusBlockedFormula(item.status, item.rawScore);
        } else if (classTargetPct <= 0) {
          formulaLabel = "Classe sem meta configurada";
        } else if (block.configuredPct <= 0) {
          formulaLabel = effectiveSectorMap.has(block.secKey)
            ? "Setor com meta 0% nesta classe"
            : "Setor sem meta nesta classe";
        } else {
          formulaLabel = `${formatPctPtBr(classTargetPct)}% Classe · ${formatPctPtBr(roundedSectorShare)}% Setor · ${formatPctPtBr(item.weightInSector * 100)}% Peso (${buildScoreDescriptor(item.rawScore, item.effectiveScore)})`;
        }

        results.push({
          assetId: item.id,
          rawScore: item.rawScore,
          effectiveScore: item.effectiveScore,
          effectiveTargetPct: effectivePct,
          classTargetPct,
          sectorTargetPctInClass: effectiveSectorMap.has(block.secKey) ? roundedSectorShare : 0,
          weightInSector: item.weightInSector,
          isEligible: item.isEligible,
          status: item.status,
          formulaLabel,
        });
      }
    }
  }

  return results;
}

export interface PQSAssetInput {
  score?: number | null;
  allocation_status?: AssetAllocationStatus;
  currentValueBRL?: number;
  valueBRL?: number;
}

/**
 * Portfolio Quality Score (PQS) — Índice de Qualidade da Carteira (§4.3 PLANO_41).
 * Escala 0 a 10, ponderada pelo patrimônio real de cada ativo.
 *
 * PQS = ∑(score_i × V_atual,i) / V_total
 *
 * Invariantes:
 * - Ativos sem nota assumem Nota 5 (Neutro - Salvaguarda S1).
 * - Ativos em 'quarantine' ou 'exit' utilizam sua nota real atribuída ou 0 se nula.
 * - Se patrimônio total <= 0, calcula a média simples das notas.
 * - Resultado arredondado para 1 casa decimal (ex.: 8.4).
 */
export function calculatePortfolioQualityScore(assets: readonly PQSAssetInput[]): number {
  if (assets.length === 0) return 5.0;

  let totalValue = 0;
  let weightedScoreSum = 0;
  let simpleScoreSum = 0;
  let count = 0;

  for (const asset of assets) {
    const rawScore = asset.score;
    const isQuarantineOrExit = asset.allocation_status === "quarantine" || asset.allocation_status === "exit";
    const score = rawScore != null
      ? Math.max(0, Math.min(10, rawScore))
      : isQuarantineOrExit
        ? 0
        : 5; // Fallback neutro 5 para ativos ativos sem nota

    const rawVal = asset.currentValueBRL ?? asset.valueBRL ?? 0;
    const val = Math.max(0, Number.isFinite(rawVal) ? rawVal : 0);
    totalValue += val;
    weightedScoreSum += score * val;
    simpleScoreSum += score;
    count++;
  }

  if (totalValue > 0) {
    const pqs = weightedScoreSum / totalValue;
    return Math.round(pqs * 10) / 10;
  }

  if (count > 0) {
    return Math.round((simpleScoreSum / count) * 10) / 10;
  }

  return 5.0;
}
