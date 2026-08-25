import { todayISO } from "./index";

/**
 * Motor puro de cálculo de encargos por atraso (mora, multa e desconto) em dívidas.
 *
 * ESPECIFICAÇÃO §3.4 e Módulo de Quitação Inteligente.
 * Cálculos 100% em centavos (inteiros) sem dependências externas.
 */

export interface OverdueDebtCalculationInput {
  amountCents: number;
  dueDate: string; // YYYY-MM-DD
  paymentDate?: string; // YYYY-MM-DD (default: hoje)
  /** Multa percentual (ex.: 2 para 2%). Padrão BACEN/CDC = 2% */
  finePercent?: number;
  /** Taxa de juros mensal percentual (ex.: 1 para 1% a.m. = ~0.033% ao dia) */
  monthlyInterestPercent?: number;
  /** Override de multa manual em centavos (se informado, sobrepõe o cálculo percentual) */
  customFineCents?: number;
  /** Override de juros/mora manual em centavos (se informado, sobrepõe o cálculo) */
  customInterestCents?: number;
  /** Desconto concedido em centavos */
  discountCents?: number;
}

export interface OverdueDebtCalculationResult {
  originalAmountCents: number;
  daysOverdue: number;
  fineCents: number;
  interestCents: number;
  discountCents: number;
  totalPaidCents: number;
}

/** Calcula dias de atraso entre dueDate e paymentDate (YYYY-MM-DD em UTC). */
export function calculateDaysOverdue(dueDate: string, paymentDate: string): number {
  const [dy, dm, dd] = dueDate.split("-").map(Number);
  const [py, pm, pd] = paymentDate.split("-").map(Number);
  const dueUtc = Date.UTC(dy ?? 0, (dm ?? 1) - 1, dd ?? 1);
  const payUtc = Date.UTC(py ?? 0, (pm ?? 1) - 1, pd ?? 1);
  const diffMs = payUtc - dueUtc;
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, days);
}

/**
 * Calcula os encargos e o valor final de quitação de uma dívida.
 */

export function calculateOverdueDebtCharges(
  input: OverdueDebtCalculationInput
): OverdueDebtCalculationResult {
  const originalAmountCents = Math.max(0, Math.round(input.amountCents));
  const paymentDate = input.paymentDate ?? todayISO();

  const daysOverdue = calculateDaysOverdue(input.dueDate, paymentDate);

  let fineCents = 0;
  if (input.customFineCents !== undefined) {
    fineCents = Math.max(0, Math.round(input.customFineCents));
  } else if (daysOverdue > 0 && input.finePercent !== undefined && input.finePercent > 0) {
    fineCents = Math.round((originalAmountCents * input.finePercent) / 100);
  }

  let interestCents = 0;
  if (input.customInterestCents !== undefined) {
    interestCents = Math.max(0, Math.round(input.customInterestCents));
  } else if (
    daysOverdue > 0 &&
    input.monthlyInterestPercent !== undefined &&
    input.monthlyInterestPercent > 0
  ) {
    // Juros pro rata die simples: (taxa mensal / 30) * dias de atraso
    const dailyRate = input.monthlyInterestPercent / 30 / 100;
    interestCents = Math.round(originalAmountCents * dailyRate * daysOverdue);
  }

  const discountCents = Math.max(0, Math.round(input.discountCents ?? 0));

  const totalPaidCents = Math.max(
    0,
    originalAmountCents + fineCents + interestCents - discountCents
  );

  return {
    originalAmountCents,
    daysOverdue,
    fineCents,
    interestCents,
    discountCents,
    totalPaidCents,
  };
}
