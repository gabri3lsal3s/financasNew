/**
 * Motor puro de projeção patrimonial (juros compostos + aportes mensais) e de
 * renda passiva estimada.
 *
 * Fonte única para a projeção da landing page e para qualquer tela que precise
 * evoluir patrimônio no tempo — substitui os cálculos ad hoc que existiam
 * dentro de componentes de apresentação (AGENTS.md §3).
 *
 * Regras de negócio herdadas (não reinventadas):
 *   • Capital crítico de independência = `calculateCriticalCapital` (regra dos
 *     4% / Trinity) — domínio `./fire`;
 *   • Conversão de taxa anual para mensal equivalente = `annualRateToMonthlyRate`
 *     — domínio `./compound-interest`;
 *   • Renda passiva estimada = saldo × yield anual da carteira ÷ 12.
 *
 * Valores em centavos inteiros. Determinístico, sem efeitos colaterais.
 */

import { calculateCriticalCapital, DEFAULT_SAFE_WITHDRAWAL_RATE_PCT } from "./fire";
import { annualRateToMonthlyRate } from "./compound-interest";

/** Base monetária da série projetada. */
export type ProjectionBasis = "nominal" | "real";

export interface PatrimonyProjectionInput {
  /** Patrimônio inicial em centavos. */
  initialCents: number;
  /** Aporte mensal em centavos. */
  monthlyContributionCents: number;
  /** Rentabilidade anual esperada (% a.a., ex.: 8 para 8%). */
  annualRatePercent: number;
  /** Horizonte em anos (1–60). */
  years: number;
  /**
   * Yield anual estimado da carteira (% a.a.) usado na renda passiva.
   * Padrão: a própria rentabilidade anual.
   */
  annualPassiveYieldPercent?: number;
  /** Custo de vida mensal desejado em centavos (base do capital crítico). */
  monthlyLivingCostCents?: number;
  /** Taxa de retirada segura (% a.a.) do capital crítico. Padrão: 4%. */
  safeWithdrawalRatePct?: number;
  /** Série em valores nominais (padrão) ou corrigidos pela inflação. */
  basis?: ProjectionBasis;
  /** Inflação anual (% a.a.) usada apenas quando `basis === "real"`. Padrão: 4%. */
  inflationPercent?: number;
}

export interface PatrimonyProjectionYear {
  year: number;
  /** Saldo na base escolhida (nominal ou real). */
  balanceCents: number;
  /** Total aportado até o ano (inclui o patrimônio inicial). */
  contributedCents: number;
  /** Juros acumulados (nominais) até o ano. */
  totalInterestCents: number;
  /** Renda passiva mensal estimada sobre o saldo exibido. */
  monthlyPassiveIncomeCents: number;
  /** Progresso até o capital crítico de independência (pode passar de 100). */
  targetProgressPct: number;
}

export interface PatrimonyProjectionResult {
  years: PatrimonyProjectionYear[];
  finalBalanceCents: number;
  finalMonthlyPassiveIncomeCents: number;
  /** Capital crítico necessário para a independência (regra dos 4%). */
  independenceTargetCents: number | null;
  /** Primeiro ano em que o saldo alcança o capital crítico (null = não alcança). */
  independenceYear: number | null;
  /** Primeiro mês em que os juros superam o aporte mensal (ponto de inflexão). */
  interestExceedsContributionAt: { year: number; month: number } | null;
  /** Rentabilidade aplicada (% a.a.). */
  annualRatePercent: number;
  /** Yield aplicado à renda passiva (% a.a.). */
  annualPassiveYieldPercent: number;
  basis: ProjectionBasis;
}

const DEFAULT_INFLATION_PERCENT = 4;

function toNonNegativeCents(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

function toPercent(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 0;
  return Math.max(0, value);
}

/**
 * Projeta patrimônio mês a mês e devolve um snapshot por ano.
 *
 * Juros incidem sobre o saldo e o aporte entra ao fim de cada mês — mesma
 * convenção do motor de juros compostos (`compound-interest.ts`).
 */
export function projectPatrimony(input: PatrimonyProjectionInput): PatrimonyProjectionResult {
  const initialCents = toNonNegativeCents(input.initialCents);
  const contributionCents = toNonNegativeCents(input.monthlyContributionCents);
  const annualRatePercent = toPercent(input.annualRatePercent);
  const safeYears = Math.max(1, Math.min(60, Math.round(Number.isFinite(input.years) ? input.years : 1)));

  const annualPassiveYieldPercent =
    input.annualPassiveYieldPercent !== undefined && Number.isFinite(input.annualPassiveYieldPercent)
      ? toPercent(input.annualPassiveYieldPercent)
      : annualRatePercent;

  const basis: ProjectionBasis = input.basis === "real" ? "real" : "nominal";
  const inflationPercent = basis === "real" ? toPercent(input.inflationPercent ?? DEFAULT_INFLATION_PERCENT) : 0;

  const monthlyRate = annualRateToMonthlyRate(annualRatePercent);
  const passiveMonthlyRate = annualRateToMonthlyRate(annualPassiveYieldPercent);
  const livingCostCents = toNonNegativeCents(input.monthlyLivingCostCents);

  const independenceTargetCents =
    livingCostCents > 0
      ? calculateCriticalCapital({
          monthlyLivingCostCents: livingCostCents,
          safeWithdrawalRatePct: input.safeWithdrawalRatePct ?? DEFAULT_SAFE_WITHDRAWAL_RATE_PCT,
        })
      : null;

  const toBasis = (nominalCents: number, year: number): number => {
    if (basis !== "real" || inflationPercent <= 0) return nominalCents;
    return Math.round(nominalCents / Math.pow(1 + inflationPercent / 100, year));
  };

  const buildSnapshot = (
    year: number,
    nominalBalanceCents: number,
    contributedCents: number,
    totalInterestCents: number,
  ): PatrimonyProjectionYear => {
    const balanceCents = toBasis(nominalBalanceCents, year);
    return {
      year,
      balanceCents,
      contributedCents,
      totalInterestCents,
      monthlyPassiveIncomeCents: Math.round(balanceCents * passiveMonthlyRate),
      targetProgressPct:
        independenceTargetCents && independenceTargetCents > 0
          ? Math.round((balanceCents / independenceTargetCents) * 1000) / 10
          : 0,
    };
  };

  const years: PatrimonyProjectionYear[] = [buildSnapshot(0, initialCents, initialCents, 0)];

  let nominalBalance = initialCents;
  let contributed = initialCents;
  let totalInterest = 0;
  let interestExceedsContributionAt: { year: number; month: number } | null = null;

  for (let y = 1; y <= safeYears; y++) {
    for (let m = 1; m <= 12; m++) {
      const monthInterest = Math.round(nominalBalance * monthlyRate);
      nominalBalance += monthInterest;
      totalInterest += monthInterest;

      if (!interestExceedsContributionAt && contributionCents > 0 && monthInterest >= contributionCents) {
        interestExceedsContributionAt = { year: y, month: m };
      }

      nominalBalance += contributionCents;
      contributed += contributionCents;
    }

    years.push(buildSnapshot(y, nominalBalance, contributed, totalInterest));
  }

  const last = years[years.length - 1]!;
  const independenceYearCents = independenceTargetCents;
  const independenceSnapshot =
    independenceYearCents !== null
      ? years.find((snapshot) => snapshot.balanceCents >= independenceYearCents)
      : undefined;

  return {
    years,
    finalBalanceCents: last.balanceCents,
    finalMonthlyPassiveIncomeCents: last.monthlyPassiveIncomeCents,
    independenceTargetCents,
    independenceYear: independenceSnapshot ? independenceSnapshot.year : null,
    interestExceedsContributionAt,
    annualRatePercent,
    annualPassiveYieldPercent,
    basis,
  };
}
