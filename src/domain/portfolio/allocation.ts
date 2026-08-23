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
