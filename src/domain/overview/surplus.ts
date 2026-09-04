/**
 * Motor Puro de Apuração de Sobra de Caixa & Capacidade de Aporte — FASE 50.
 *
 * Responsável por:
 *   • Calcular deterministamente a Sobra Líquida Real do ciclo mensal;
 *   • Deduzir obrigações contratadas e compromissos do mês;
 *   • Sugerir o valor ideal de aporte para a Calculadora de Rebalanceamento.
 *
 * 100% puro — sem dependências de UI ou Supabase.
 */

export interface SurplusCapacityParams {
  /** Total de receitas realizadas no mês (em centavos). */
  incomeCents: number;
  /** Total de despesas do mês (em centavos). */
  expenseCents: number;
  /** Faturas de cartão de crédito em aberto/vencendo no ciclo (em centavos). */
  openInvoicesCents?: number;
  /** Dívidas/boletos a pagar pendentes no ciclo (em centavos). */
  pendingPayableDebtsCents?: number;
  /** Aportes já realizados no mês corrente (em centavos). */
  contributionsAlreadyMadeCents?: number;
  /** Saldo Livre Real da conta bancária hoje (Safe-to-Spend em centavos). */
  safeToSpendCents?: number;
}

export interface SurplusCapacityResult {
  /** Resultado operacional bruto da competência (Receitas − Despesas). */
  operatingBalanceCents: number;
  /** Total de compromissos pendentes no ciclo (Faturas + Dívidas a pagar). */
  committedObligationsCents: number;
  /**
   * Sobra Líquida Real do ciclo:
   *   Receitas − Despesas − Compromissos Pendentes − Aportes já realizados.
   */
  surplusCents: number;
  /**
   * Valor sugerido para novo aporte na carteira:
   *   Limitado pela sobra líquida e pelo Saldo Livre Real disponível na conta.
   */
  suggestedAporteCents: number;
  /** Indica se há sobra de caixa positiva e saldo livre real aptos a investimento. */
  hasSurplus: boolean;
}

/**
 * Calcula a sobra líquida real de caixa e a capacidade sugerida de aporte mensal,
 * respeitando o Saldo Livre Real da conta bancária como teto inegociável de liquidez.
 */
export function calculateSurplusCapacity(params: SurplusCapacityParams): SurplusCapacityResult {
  const {
    incomeCents,
    expenseCents,
    openInvoicesCents = 0,
    pendingPayableDebtsCents = 0,
    contributionsAlreadyMadeCents = 0,
    safeToSpendCents,
  } = params;

  const operatingBalanceCents = incomeCents - expenseCents;
  const committedObligationsCents = Math.max(0, openInvoicesCents) + Math.max(0, pendingPayableDebtsCents);
  const surplusCents = operatingBalanceCents - committedObligationsCents - Math.max(0, contributionsAlreadyMadeCents);

  let suggestedAporteCents = Math.max(0, surplusCents);

  // Teto inegociável: se o Saldo Livre Real for fornecido, a capacidade de aporte
  // não pode ultrapassar a liquidez livre real da conta corrente.
  // Se o Saldo Livre Real for <= 0, não é seguro sugerir aportes na carteira.
  if (safeToSpendCents !== undefined) {
    if (safeToSpendCents <= 0) {
      suggestedAporteCents = 0;
    } else {
      suggestedAporteCents = Math.min(suggestedAporteCents, safeToSpendCents);
    }
  }

  const hasSurplus = suggestedAporteCents > 0;

  return {
    operatingBalanceCents,
    committedObligationsCents,
    surplusCents,
    suggestedAporteCents,
    hasSurplus,
  };
}
