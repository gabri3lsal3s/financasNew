/**
 * Metas de alocação — ESPECIFICAÇÃO §3.11.1.
 *
 * Regras:
 *   • Meta por ativo: 0–100; SOMA ≤ 100% (domínio + banco — D1);
 *   • Meta por classe/setor: 0–100 (opcional);
 *   • Alvo = % do patrimônio total (incluindo caixa/reserva).
 *
 * Motor puro — testável isoladamente.
 */

import type { AssetAllocationStatus } from "@/types";

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
 * espelhada no servidor (RPC `set_allocation_targets` valida após o lote).
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
 * Higieniza a lista de metas antes de enviar ao servidor:
 * 1. Arredonda todos os valores para 2 casas decimais.
 * 2. Garante que a soma total não ultrapasse 100.00% por dízimas ou erros de ponto flutuante.
 */
export function sanitizeTargetsForSave<T extends { assetId: string; target: number }>(
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
    formattedDelta: `${sign}${delta.toFixed(1)}%`,
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
    let effectiveScore: number;
    let isEligible: boolean;

    if (status === "active") {
      const rawScore = asset.score;
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

export interface EffectiveAssetTargetResult {
  assetId: string;
  effectiveTargetPct: number; // % do patrimônio total da carteira (0 a 100)
  classTargetPct: number;
  sectorTargetPctInClass: number;
  weightInSector: number;
  isEligible: boolean;
  status: AssetAllocationStatus;
}

/**
 * Calcula a meta efetiva global nos 3 níveis hierárquicos (§4.2 PLANO_41):
 * T_i = Target_Classe × Target_Setor_na_Classe × w_{i ∈ Setor}
 *
 * Tratamento especial para classes sem divisão setorial (Salvaguarda S5):
 * Se a classe não possuir setores cadastrados ou tiver apenas setor genérico "Geral", colapsa diretamente:
 * T_i = Target_Classe × w_{i ∈ Classe}
 */
export function calculateEffectiveAssetTargets<
  T extends AssetScoreInput & { assetClass?: string | null; sector?: string | null },
>(params: {
  assets: readonly T[];
  classTargets: Record<string, number>;
  sectorTargets: Record<string, number>;
}): EffectiveAssetTargetResult[] {
  const { assets, classTargets, sectorTargets } = params;
  if (assets.length === 0) return [];

  const assetsByClass = new Map<string, T[]>();
  for (const asset of assets) {
    const cls = asset.assetClass?.trim() || "Outros";
    const list = assetsByClass.get(cls) || [];
    list.push(asset);
    assetsByClass.set(cls, list);
  }

  const results: EffectiveAssetTargetResult[] = [];

  for (const [className, classAssets] of assetsByClass.entries()) {
    const classTargetPct = Math.max(0, classTargets[className] ?? 0);

    const sectorsInClass = new Set(classAssets.map((a) => a.sector?.trim() || "Geral"));
    const hasConfiguredSectorTargets = Array.from(sectorsInClass).some(
      (sec) => sec !== "Geral" && (sectorTargets[sec] ?? 0) > 0,
    );

    if (!hasConfiguredSectorTargets) {
      // Salvaguarda S5: Sem divisão setorial rígida -> Ponderação direta na classe
      const weightedAssets = deriveAssetWeightsFromScores(classAssets);
      for (const item of weightedAssets) {
        const effectivePct = Math.round((classTargetPct * item.weightInSector) * 100) / 100;
        results.push({
          assetId: item.id,
          effectiveTargetPct: effectivePct,
          classTargetPct,
          sectorTargetPctInClass: 100,
          weightInSector: item.weightInSector,
          isEligible: item.isEligible,
          status: item.status,
        });
      }
    } else {
      // Hierarquia completa: Classe -> Setores -> Ativos
      const assetsBySector = new Map<string, T[]>();
      for (const asset of classAssets) {
        const sec = asset.sector?.trim() || "Geral";
        const list = assetsBySector.get(sec) || [];
        list.push(asset);
        assetsBySector.set(sec, list);
      }

      for (const [sectorName, sectorAssets] of assetsBySector.entries()) {
        const sectorTargetInClass = Math.max(0, sectorTargets[sectorName] ?? 0);
        const sectorEffectivePctOfPortfolio = (classTargetPct * sectorTargetInClass) / 100;

        const weightedAssets = deriveAssetWeightsFromScores(sectorAssets);
        for (const item of weightedAssets) {
          const effectivePct = Math.round((sectorEffectivePctOfPortfolio * item.weightInSector) * 100) / 100;
          results.push({
            assetId: item.id,
            effectiveTargetPct: effectivePct,
            classTargetPct,
            sectorTargetPctInClass: sectorTargetInClass,
            weightInSector: item.weightInSector,
            isEligible: item.isEligible,
            status: item.status,
          });
        }
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
