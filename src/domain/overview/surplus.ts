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

export type SurplusAllocationIntent = "emergency_fund" | "portfolio_aporte" | "none";

export interface SurplusCapacityParams {
  /** Total de receitas realizadas no mês (em centavos). */
  incomeCents: number;
  /** Total de despesas do mês (em centavos). */
  expenseCents: number;
  /** Faturas de cartão de crédito em aberto/vencendo no ciclo (em centavos). */
  openInvoicesCents?: number;
  /** Dívidas/boletos a pagar pendentes no ciclo (em centavos). */
  pendingPayableDebtsCents?: number;
  /** Custos fixos recorrentes previstos no mês ainda não lançados (proteção contra falso otimismo). */
  pendingRecurringObligationsCents?: number;
  /** Aportes já realizados no mês corrente (em centavos). */
  contributionsAlreadyMadeCents?: number;
  /** Saldo Livre Real da conta bancária hoje (Safe-to-Spend em centavos). */
  safeToSpendCents?: number;
  /** Déficit restante para completar a meta configurada da Reserva de Emergência (em centavos). */
  emergencyGapCents?: number;
  /** Override limpo quando o usuário declarou manter a reserva de emergência fora do app. */
  hasExternalEmergencyFund?: boolean;
}

export interface SurplusCapacityResult {
  /** Resultado operacional bruto da competência (Receitas − Despesas). */
  operatingBalanceCents: number;
  /** Total de compromissos pendentes no ciclo (Faturas + Dívidas a pagar + Recorrências fixas pendentes). */
  committedObligationsCents: number;
  /** Custos fixos recorrentes previstos ainda pendentes deduzidos da sobra. */
  pendingRecurringObligationsCents: number;
  /**
   * Sobra Líquida Real do ciclo:
   *   Receitas − Despesas − Compromissos Pendentes − Aportes já realizados.
   */
  surplusCents: number;
  /**
   * Valor sugerido para alocação (reserva ou aporte na carteira):
   *   Limitado pela sobra líquida e pelo Saldo Livre Real disponível na conta.
   */
  suggestedAporteCents: number;
  /** Indica se há sobra de caixa positiva e saldo livre real aptos a alocação. */
  hasSurplus: boolean;
  /**
   * Destino recomendado do excedente:
   *   • `"emergency_fund"`: reserva de emergência abaixo da meta e sem override externo;
   *   • `"portfolio_aporte"`: reserva completa (ou override externo ativo / sem meta pendente);
   *   • `"none"`: sem sobra livre elegível.
   */
  allocationIntent: SurplusAllocationIntent;
  /** Parcela sugerida prioritariamente para reforço da reserva de emergência (centavos). */
  suggestedEmergencyAllocationCents: number;
}

/**
 * Calcula a sobra líquida real de caixa e a capacidade sugerida de aporte/reserva mensal,
 * respeitando:
 *   1. Faturas, dívidas pagáveis e custos fixos recorrentes previstos ainda pendentes no mês;
 *   2. Saldo Livre Real da conta bancária como teto inegociável de liquidez;
 *   3. Trava inteligente de Reserva de Emergência (com suporte a override `hasExternalEmergencyFund`).
 */
export function calculateSurplusCapacity(params: SurplusCapacityParams): SurplusCapacityResult {
  const {
    incomeCents,
    expenseCents,
    openInvoicesCents = 0,
    pendingPayableDebtsCents = 0,
    pendingRecurringObligationsCents = 0,
    contributionsAlreadyMadeCents = 0,
    safeToSpendCents,
    emergencyGapCents = 0,
    hasExternalEmergencyFund = false,
  } = params;

  const operatingBalanceCents = incomeCents - expenseCents;
  const safePendingRecurring = Math.max(0, pendingRecurringObligationsCents);
  const committedObligationsCents =
    Math.max(0, openInvoicesCents) +
    Math.max(0, pendingPayableDebtsCents) +
    safePendingRecurring;
  const surplusCents =
    operatingBalanceCents - committedObligationsCents - Math.max(0, contributionsAlreadyMadeCents);

  let suggestedAporteCents = Math.max(0, surplusCents);

  // Teto inegociável: se o Saldo Livre Real for fornecido, a capacidade de alocação
  // não pode ultrapassar a liquidez livre real da conta corrente (também descontando fixos pendentes).
  if (safeToSpendCents !== undefined) {
    const adjustedSafeToSpend = safeToSpendCents - safePendingRecurring;
    if (adjustedSafeToSpend <= 0) {
      suggestedAporteCents = 0;
    } else {
      suggestedAporteCents = Math.min(suggestedAporteCents, adjustedSafeToSpend);
    }
  }

  const hasSurplus = suggestedAporteCents > 0;
  const effectiveEmergencyGap = hasExternalEmergencyFund ? 0 : Math.max(0, emergencyGapCents);

  let allocationIntent: SurplusAllocationIntent = "none";
  let suggestedEmergencyAllocationCents = 0;

  if (hasSurplus) {
    if (effectiveEmergencyGap > 0) {
      allocationIntent = "emergency_fund";
      suggestedEmergencyAllocationCents = Math.min(suggestedAporteCents, effectiveEmergencyGap);
    } else {
      allocationIntent = "portfolio_aporte";
    }
  }

  return {
    operatingBalanceCents,
    committedObligationsCents,
    pendingRecurringObligationsCents: safePendingRecurring,
    surplusCents,
    suggestedAporteCents,
    hasSurplus,
    allocationIntent,
    suggestedEmergencyAllocationCents,
  };
}
