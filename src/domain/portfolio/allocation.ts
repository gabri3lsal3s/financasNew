/**
 * Metas de alocação — ESPECIFICAÇÃO §3.11.1.
 *
 * Regras:
 *   • Meta por ativo: 0–100; SOMA ≤ 100% (domínio + banco — D1);
 *   • Meta por classe/setor: 0–100 (opcional);
 *   • Alvo = % do patrimônio total (incluindo caixa/reserva);
 *   • Travas setoriais: `max_sector_acoes` / `max_sector_fiis`
 *     impedem alocação acima do teto (§3.11.3.5).
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

export interface SectorExposure {
  /** Valor atual do setor em R$. */
  value: number;
  /** Exposição atual em % do patrimônio. */
  pct: number;
  /** Teto configurado (max_sector_*), null = sem trava. */
  cap: number | null;
  /** true quando pct > cap. */
  exceeded: boolean;
}

// ---------------------------------------------------------------------------
// Soma e validação
// ---------------------------------------------------------------------------

/** Soma dos percentuais de um conjunto de metas. */
export function targetsSum(targets: readonly Pick<TargetDraft, "target">[]): number {
  return targets.reduce((acc, t) => acc + t.target, 0);
}

/**
 * Valida a soma das metas (≤ 100%). Usada na UI (barra de soma) e
 * espelhada no servidor (RPC `set_allocation_targets` valida após o lote).
 */
export function validateTargetsSum(targets: readonly Pick<TargetDraft, "target">[]): TargetValidation {
  const sum = targetsSum(targets);
  if (sum > 100) {
    return {
      ok: false,
      sum,
      remaining: 0,
      error: "A soma das metas excede 100%. Reduza algum percentual.",
    };
  }
  return { ok: true, sum, remaining: Math.round((100 - sum) * 100) / 100, error: null };
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

// ---------------------------------------------------------------------------
// Travas setoriais
// ---------------------------------------------------------------------------

/**
 * Exposição setorial vs trava configurada (max_sector_acoes / max_sector_fiis).
 * `cap` null = sem trava configurada → nunca excede.
 */
export function sectorExposure(value: number, totalPortfolio: number, cap: number | null): SectorExposure {
  const pct = totalPortfolio > 0 ? (value / totalPortfolio) * 100 : 0;
  return {
    value,
    pct: Math.round(pct * 100) / 100,
    cap,
    exceeded: cap !== null && cap !== undefined && pct > cap,
  };
}

/**
 * Valida um aporte/alocação contra as travas setoriais: nenhum setor pode
 * ultrapassar o teto configurado após a alocação (§3.11.3.5).
 */
export function validateSectorCaps(
  exposures: readonly Pick<SectorExposure, "pct" | "cap">[],
): { ok: boolean; violated: string[] } {
  const violated = exposures.filter((e) => e.cap !== null && e.cap !== undefined && e.pct > e.cap);
  return {
    ok: violated.length === 0,
    violated: violated.map((e) => `Setor com exposição acima do teto (${e.pct}%)`),
  };
}
