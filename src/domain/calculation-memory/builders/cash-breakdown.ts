/**
 * Construtores de Memória de Cálculo para Saldo em Caixa e Saldo Livre (Safe-to-Spend).
 *
 * Módulo puro testável isoladamente.
 * Corrige a incongruência AUD-01 e implementa a Regra 33 do AGENTS.md.
 */

import { formatDateBR } from "@/lib/date";
import type { CashCheckpointData, SafeDailySpendingResult } from "@/domain/cash";
import type { SurplusAllocationIntent } from "@/domain/overview";
import type { CashGapAnalysisResult } from "@/domain/projection";
import { formatCentsAsBRL } from "@/services/masks/money";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

export interface RealCashBreakdownParams {
  currentBalanceCents: number;
  latestCheckpoint: CashCheckpointData | null;
  checkpointBalanceCents: number;
  inflowSinceCheckpointCents: number;
  outflowSinceCheckpointCents: number;
  referenceDate?: string;
}

/**
 * Constrói a memória de cálculo do Saldo Disponível em Conta Reconciliado.
 */
export function buildRealCashBreakdown(params: RealCashBreakdownParams): CalculationBreakdown {
  const {
    currentBalanceCents,
    latestCheckpoint,
    checkpointBalanceCents,
    inflowSinceCheckpointCents,
    outflowSinceCheckpointCents,
    referenceDate,
  } = params;

  const hasCheckpoint = latestCheckpoint !== null;
  const checkpointDateStr = hasCheckpoint ? formatDateBR(latestCheckpoint.date) : null;

  const steps: BreakdownStep[] = hasCheckpoint
    ? [
        {
          label: `Saldo Aferido no Checkpoint (${checkpointDateStr})`,
          operator: "=",
          rawValue: checkpointBalanceCents,
          hint: "Saldo base confirmado com o extrato bancário",
          tone: checkpointBalanceCents >= 0 ? "default" : "negative",
          actionLink: {
            to: "/transacoes",
            label: "Ver lançamentos",
          },
        },
        {
          label: "Entradas de Caixa Posteriores",
          operator: "+",
          rawValue: inflowSinceCheckpointCents,
          hint: "Receitas, PIX recebidos e resgates creditados",
          tone: "positive",
        },
        {
          label: "Saídas de Caixa Posteriores",
          operator: "-",
          rawValue: outflowSinceCheckpointCents,
          hint: "Despesas à vista, faturas pagas, dívidas quitadas e aportes",
          tone: "negative",
        },
      ]
    : [
        {
          label: "Total de Entradas de Caixa",
          operator: "+",
          rawValue: inflowSinceCheckpointCents,
          hint: "Receitas e créditos acumulados de caixa",
          tone: "positive",
        },
        {
          label: "Total de Saídas de Caixa",
          operator: "-",
          rawValue: outflowSinceCheckpointCents,
          hint: "Despesas à vista, faturas pagas e retiradas",
          tone: "negative",
        },
      ];

  const breakdown: CalculationBreakdown = {
    id: "dash-real-cash",
    title: "Saldo Disponível em Conta",
    description:
      "Saldo bancário consolidado em contas correntes e carteiras de liquidez imediata em regime de caixa estrito.",
    periodLabel: referenceDate ? `Posição em ${formatDateBR(referenceDate)}` : "Posição Atual",
    formulaExpression: hasCheckpoint
      ? "Saldo do Checkpoint + Entradas Posteriores − Saídas Posteriores"
      : "Entradas Acumuladas − Saídas Acumuladas",
    unit: "currency",
    steps,
    result: {
      label: "Saldo Disponível em Conta",
      rawValue: currentBalanceCents,
      unit: "currency",
      tone: currentBalanceCents >= 0 ? "positive" : "negative",
    },
    inclusions: [
      "Contas correntes bancárias e carteiras de liquidez imediata",
      "Transações financeiras efetivamente liquidadas (PIX, débito, transferências)",
      "Pagamentos de fatura de cartão e aportes realizados",
    ],
    exclusions: [
      "Compras no cartão de crédito (lançadas na fatura sob competência; impactam o caixa apenas quando a fatura for paga)",
      "Transferências entre contas próprias (são operações neutras para o caixa global)",
      "Lançamentos pendentes com data futura",
    ],
    notes: hasCheckpoint
      ? undefined
      : [
          "Dica: utilize a ferramenta 'Calibrar' para registrar um Checkpoint e ancorar seu saldo com a data do extrato bancário.",
        ],
  };

  return enrichBreakdown(breakdown);
}

export interface SafeToSpendBreakdownParams {
  realCashBalanceCents: number;
  committedObligationsCents: number;
  openInvoicesCents: number;
  payablePendingCents: number;
  receivablePendingCents?: number;
  /** Caixa operacional da empresa retido na conta compartilhada (proteção anti-vazamento). */
  derivedBusinessCashCents?: number;
  safeToSpendCents: number;
  safeToSpendWithReceivablesCents?: number;
  /** Se true, calcula a variante otimista que incorpora recebíveis no total final. */
  includeReceivablesInTotal?: boolean;
  /** Faturas de cartão do próximo ciclo em acumulação (em centavos). */
  nextCycleInvoicesCents?: number;
  /** Quantidade de faturas em acumulação no próximo ciclo. */
  nextCycleInvoicesCount?: number;
  /** Faturas futuras / parcelamentos posteriores de cartão (em centavos). */
  futureInvoicesCents?: number;
  /** Quantidade de competências futuras de cartão além do próximo ciclo. */
  futureInvoicesCount?: number;
}

/**
 * Constrói a memória de cálculo do Saldo Livre Real (Safe-to-Spend).
 * Sanando o bug AUD-01 com total congruência entre os passos e o resultado final.
 */
export function buildSafeToSpendBreakdown(params: SafeToSpendBreakdownParams): CalculationBreakdown {
  const {
    realCashBalanceCents,
    committedObligationsCents,
    openInvoicesCents,
    payablePendingCents,
    receivablePendingCents = 0,
    derivedBusinessCashCents = 0,
    safeToSpendCents,
    safeToSpendWithReceivablesCents,
    includeReceivablesInTotal = false,
    nextCycleInvoicesCents = 0,
    nextCycleInvoicesCount = 0,
    futureInvoicesCents = 0,
    futureInvoicesCount = 0,
  } = params;

  const hasReceivables = receivablePendingCents > 0;
  const isOptimistic = includeReceivablesInTotal && hasReceivables;
  const businessCashReservation = Math.max(0, derivedBusinessCashCents);
  const cycleObligationsCents = committedObligationsCents - businessCashReservation;

  const steps: BreakdownStep[] = [
    {
      label: "Saldo Atual em Contas",
      operator: isOptimistic ? "+" : undefined,
      rawValue: realCashBalanceCents,
      hint: "Liquidez disponível hoje nas contas bancárias",
      tone: realCashBalanceCents >= 0 ? "positive" : "negative",
      actionLink: {
        to: "/transacoes",
        label: "Ver extrato",
      },
    },
  ];

  if (isOptimistic) {
    steps.push({
      label: "A Receber Previsto do Ciclo",
      operator: "+",
      rawValue: receivablePendingCents,
      hint: "Contas e haveres a receber antes do vencimento das contas",
      tone: "positive",
      actionLink: {
        to: "/dividas?tab=receivables",
        label: "Ver a receber",
      },
    });
  }

  steps.push({
    label: "Faturas e Contas a Pagar (Ciclo)",
    operator: "-",
    rawValue: cycleObligationsCents,
    hint: `Faturas de cartão (${openInvoicesCents > 0 ? "abertas" : "zeradas"}) + boletos e compromissos (${payablePendingCents > 0 ? "pendentes" : "zerados"})`,
    tone: "negative",
    actionLink: {
      to: "/cartoes",
      label: "Ver faturas",
    },
  });

  if (businessCashReservation > 0) {
    steps.push({
      label: "Reserva Caixa Meu Negócio (PJ)",
      operator: "-",
      rawValue: businessCashReservation,
      hint: "Saldo operacional da empresa retido na conta compartilhada para custear a operação (blindado contra gastos pessoais)",
      tone: "negative",
      actionLink: {
        to: "/negocio",
        label: "Ver caixa PJ",
      },
    });
  }

  const finalValue = isOptimistic
    ? (safeToSpendWithReceivablesCents ?? safeToSpendCents + receivablePendingCents)
    : safeToSpendCents;

  const upcomingCardsTotalCents = Math.max(0, nextCycleInvoicesCents) + Math.max(0, futureInvoicesCents);
  const safeToSpendNotes: string[] = [];
  if (!isOptimistic && hasReceivables) {
    safeToSpendNotes.push(
      "Visão Prudencial: valores a receber são omitidos do total disponível imediato para prevenir risco de inadimplência.",
    );
  }
  if (upcomingCardsTotalCents > 0) {
    const parts: string[] = [];
    if (nextCycleInvoicesCents > 0) {
      parts.push(
        `${formatCentsAsBRL(nextCycleInvoicesCents)} na próxima fatura (${nextCycleInvoicesCount || 1} fatura(s))`,
      );
    }
    if (futureInvoicesCents > 0) {
      parts.push(
        `${formatCentsAsBRL(futureInvoicesCents)} em faturas posteriores (${futureInvoicesCount || 1} competência(s))`,
      );
    }
    safeToSpendNotes.push(
      `Compromissos de cartão em ciclos futuros: ${parts.join(" e ")} - total de ${formatCentsAsBRL(upcomingCardsTotalCents)}. Este Saldo Livre refere-se apenas ao ciclo atual e não representa folga livre para consumo discricionário.`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: "dash-safe-to-spend",
    title: isOptimistic
      ? "Sobra do Ciclo (com Recebíveis)"
      : "Sobra do Ciclo (Safe-to-Spend)",
    description:
      "Quanto sobra do saldo bancário atual após quitar apenas faturas e boletos que vencem neste mês civil.",
    periodLabel: "Ciclo Mensal Corrente",
    formulaExpression: isOptimistic
      ? businessCashReservation > 0
        ? "Saldo em Conta + Recebíveis Previstos − Obrigações do Ciclo − Reserva Caixa PJ"
        : "Saldo em Conta + Recebíveis Previstos − Obrigações do Ciclo"
      : businessCashReservation > 0
        ? "Saldo em Conta − Obrigações do Ciclo − Reserva Caixa PJ"
        : "Saldo em Conta − Obrigações do Ciclo",
    unit: "currency",
    steps,
    result: {
      label: isOptimistic ? "Sobra Potencial do Ciclo" : "Sobra do Ciclo",
      rawValue: finalValue,
      unit: "currency",
      tone: finalValue >= 0 ? "positive" : "negative",
      hint:
        !isOptimistic && hasReceivables
          ? "Você possui valores a receber previstos que não foram antecipados nesta conta conservadora."
          : undefined,
    },
    inclusions: [
      "Saldo consolidado de todas as contas bancárias ativas",
      "Faturas de cartão de crédito que vencem no ciclo",
      "Dívidas, boletos e compromissos fixos pendentes do ciclo",
      ...(isOptimistic ? ["Contas e valores a receber previstos"] : []),
    ],
    exclusions: [
      "Despesas já pagas no ciclo (estas já reduziram o saldo em conta)",
      upcomingCardsTotalCents > 0
        ? `Faturas de cartão fora do ciclo atual (${formatCentsAsBRL(upcomingCardsTotalCents)}, sendo ${formatCentsAsBRL(nextCycleInvoicesCents)} no próximo mês e ${formatCentsAsBRL(futureInvoicesCents)} em parcelas futuras)`
        : "Parcelamentos futuros de cartão que vencem em meses posteriores",
      ...(!isOptimistic ? ["Valores a receber previstos (visão conservadora prudencial)"] : []),
    ],
    notes: safeToSpendNotes.length > 0 ? safeToSpendNotes : undefined,
  };

  return enrichBreakdown(breakdown);
}

export interface CashGapBreakdownParams {
  result: CashGapAnalysisResult;
  currentBalanceCents: number;
  predictedInflowsTotalCents?: number;
  predictedInflows?: readonly { expectedDate: string; amountCents: number }[];
}

/**
 * Constrói a memória de cálculo do Radar Preditivo de Descasamento de Fluxo (Lente Caixa estrita).
 */
export function buildCashGapBreakdown(params: CashGapBreakdownParams): CalculationBreakdown {
  const {
    result,
    currentBalanceCents,
    predictedInflowsTotalCents = 0,
    predictedInflows,
  } = params;

  const steps: BreakdownStep[] = [
    {
      label: "Saldo Atual em Contas",
      operator: "+",
      rawValue: currentBalanceCents,
      hint: "Liquidez disponível hoje no regime de caixa bancário",
      tone: currentBalanceCents >= 0 ? "positive" : "negative",
      actionLink: {
        to: "/transacoes",
        label: "Ver extrato",
      },
    },
  ];

  const topObligations = result.causingObligations.slice(0, 4);
  for (const obligation of topObligations) {
    steps.push({
      label: obligation.name,
      operator: "-",
      rawValue: obligation.amountCents,
      hint:
        obligation.isOverdue && obligation.nominalDueDate
          ? `Vencida em ${formatDateBR(obligation.nominalDueDate)} — exigível hoje`
          : `Vencimento em ${formatDateBR(obligation.nominalDueDate ?? obligation.dueDate)} (valor bruto nominal)`,
      tone: "negative",
    });
  }

  if (result.causingObligations.length > 4) {
    const remainingCents = result.causingObligations
      .slice(4)
      .reduce((acc, item) => acc + item.amountCents, 0);
    if (remainingCents > 0) {
      steps.push({
        label: `Demais obrigações (${result.causingObligations.length - 4})`,
        operator: "-",
        rawValue: remainingCents,
        hint: "Outras faturas ou compromissos previstos no horizonte",
        tone: "negative",
      });
    }
  }

  const inflowsUntilGapCents = predictedInflows
    ? predictedInflows
        .filter((inf) => !result.gapDate || inf.expectedDate <= result.gapDate)
        .reduce((acc, inf) => acc + inf.amountCents, 0)
    : predictedInflowsTotalCents;

  if (inflowsUntilGapCents > 0) {
    steps.push({
      label: result.gapDate ? "Entradas Previstas até o Déficit" : "Entradas Previstas no Horizonte",
      operator: "+",
      rawValue: inflowsUntilGapCents,
      hint: "Rendas recorrentes e recebíveis esperados até a data do descasamento",
      tone: "positive",
    });
  }

  const breakdown: CalculationBreakdown = {
    id: "dash-cash-gap",
    title: "Memória do Descasamento de Caixa",
    description:
      "Simula dia a dia o cruzamento entre saldo bancário atual, vencimentos nominais de faturas/contas e entradas previstas.",
    periodLabel: result.gapDate
      ? `Descasamento em ${formatDateBR(result.gapDate)}`
      : "Horizonte Atual",
    formulaExpression:
      "Fluxo Diário = Saldo Inicial + Entradas Previstas - Faturas e Contas por Data de Vencimento",
    unit: "currency",
    steps,
    result: {
      label: "Maior Déficit Projetado",
      rawValue: -Math.abs(result.maxDeficitCents),
      unit: "currency",
      tone: "negative",
      hint: result.nextInflowDate
        ? `Próxima entrada esperada após o aperto em ${formatDateBR(result.nextInflowDate)}.`
        : "Considere antecipar recebimentos, ajustar datas ou reforçar a conta antes do vencimento.",
    },
    inclusions: [
      "Saldo em conta corrente reconciliado hoje",
      "Faturas de cartão em aberto pelo valor bruto nominal integral",
      "Contas a pagar e recebimentos recorrentes previstos no período",
    ],
    exclusions: [
      "Compras futuras sem fatura lançada ou parcelas de meses seguintes",
    ],
    notes: [
      "Lente Caixa estrita: avalia exatamente o dinheiro em conta na data de vencimento, distinta da Lente Consumo (competência).",
    ],
  };

  return enrichBreakdown(breakdown);
}

export interface FreeToSpendBreakdownParams {
  safeToSpendCents: number;
  nextCycleInvoicesCents: number;
  nextCycleInvoicesCount?: number;
  futureInvoicesCents?: number;
  futureInvoicesCount?: number;
  freeToSpendCents: number;
}

/**
 * Constrói a memória de cálculo do valor efetivamente Livre para Gastar após
 * considerar as próximas faturas de cartão em acumulação.
 */
export function buildFreeToSpendBreakdown(
  params: FreeToSpendBreakdownParams,
): CalculationBreakdown {
  const {
    safeToSpendCents,
    nextCycleInvoicesCents,
    nextCycleInvoicesCount = 0,
    futureInvoicesCents = 0,
    futureInvoicesCount = 0,
    freeToSpendCents,
  } = params;

  const safeNextInvoices = Math.max(0, nextCycleInvoicesCents);
  const safeFutureInvoices = Math.max(0, futureInvoicesCents);
  const signedGapCents = safeToSpendCents - safeNextInvoices;

  const steps: BreakdownStep[] = [
    {
      label: "Saldo Livre Real (Ciclo Atual)",
      operator: "+",
      rawValue: safeToSpendCents,
      hint: "Liquidez em conta após descontar apenas faturas e boletos que vencem neste mês",
      tone: safeToSpendCents >= 0 ? "positive" : "negative",
    },
    {
      label:
        nextCycleInvoicesCount > 0
          ? `Próximas Faturas em Acumulação (${nextCycleInvoicesCount})`
          : "Próximas Faturas em Acumulação",
      operator: "-",
      rawValue: safeNextInvoices,
      hint: "Gastos já realizados no cartão que vencerão na próxima competência",
      tone: "negative",
      actionLink: {
        to: "/cartoes",
        label: "Ver faturas",
      },
    },
  ];

  const notes: string[] = [];
  if (signedGapCents < 0) {
    notes.push(
      `Déficit de ${formatCentsAsBRL(Math.abs(signedGapCents))} frente às próximas faturas, que dependerá da próxima renda. A sobra atual em conta pode ser usada para reforçar sua reserva até o próximo recebimento.`,
    );
  }
  if (safeFutureInvoices > 0) {
    notes.push(
      `Além das próximas faturas, há ${formatCentsAsBRL(safeFutureInvoices)} em faturas futuras (${futureInvoicesCount || 1} competência(s) posterior(es)).`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: "dash-free-to-spend",
    title: "Livre para Gastar (Após Próximas Faturas)",
    description:
      "Mostra quanto do seu saldo livre atual sobra para consumo discricionário sem depender da renda do próximo mês para cobrir as próximas faturas.",
    periodLabel: "Ciclo Atual + Próxima Fatura de Cartão",
    formulaExpression: "max(0, Saldo Livre do Ciclo - Próximas Faturas em Acumulação)",
    unit: "currency",
    steps,
    result: {
      label: "Livre para Gastar",
      rawValue: freeToSpendCents,
      unit: "currency",
      tone: freeToSpendCents > 0 ? "positive" : "default",
      hint:
        freeToSpendCents === 0 && safeToSpendCents > 0
          ? "Zero livre para gasto extra; o saldo do ciclo atual segue apto para liquidez ou reserva."
          : undefined,
    },
    inclusions: [
      "Saldo Livre Real do ciclo atual",
      "Faturas de cartão já lançadas para a competência seguinte",
    ],
    exclusions: [
      safeFutureInvoices > 0
        ? `Parcelamentos posteriores além da próxima fatura (${formatCentsAsBRL(safeFutureInvoices)})`
        : "Parcelamentos posteriores além da próxima fatura",
    ],
    notes: notes.length > 0 ? notes : undefined,
  };

  return enrichBreakdown(breakdown);
}

export interface SurplusCapacityBreakdownParams {
  incomeCents: number;
  expenseCents: number;
  committedObligationsCents: number;
  pendingRecurringObligationsCents: number;
  contributionsAlreadyMadeCents: number;
  safeToSpendCents?: number;
  suggestedAporteCents: number;
  allocationIntent: SurplusAllocationIntent;
  emergencyMonthsCovered?: number | null;
  emergencyTargetMonths?: 3 | 6 | 12;
  nextCycleInvoicesCents?: number;
  futureInvoicesCents?: number;
}

/**
 * Constrói a memória de cálculo da Sobra do Ciclo (Reforço da Reserva / Aporte).
 * Explica passo a passo deduções de obrigações do ciclo, recorrências pendentes e teto em conta.
 */
export function buildSurplusCapacityBreakdown(
  params: SurplusCapacityBreakdownParams,
): CalculationBreakdown {
  const {
    incomeCents,
    expenseCents,
    committedObligationsCents,
    pendingRecurringObligationsCents,
    contributionsAlreadyMadeCents,
    safeToSpendCents,
    suggestedAporteCents,
    allocationIntent,
    emergencyMonthsCovered = null,
    emergencyTargetMonths = 6,
    nextCycleInvoicesCents = 0,
    futureInvoicesCents = 0,
  } = params;

  const safeCommitted = Math.max(0, committedObligationsCents);
  const safePendingRecurring = Math.max(0, pendingRecurringObligationsCents);
  const safeContributions = Math.max(0, contributionsAlreadyMadeCents);
  const accountingSurplusCents =
    incomeCents - expenseCents - safeCommitted - safePendingRecurring - safeContributions;

  const isEmergency = allocationIntent === "emergency_fund";

  const steps: BreakdownStep[] = [
    {
      label: "Receitas Operacionais do Mês",
      operator: "+",
      rawValue: incomeCents,
      hint: "Entradas operacionais consideradas na competência atual",
      tone: "positive",
    },
    {
      label: "Despesas Líquidas do Mês",
      operator: "-",
      rawValue: expenseCents,
      hint: "Gastos ponderados registrados no ciclo",
      tone: "negative",
    },
  ];

  if (safeCommitted > 0) {
    steps.push({
      label: "Obrigações do Ciclo Atual",
      operator: "-",
      rawValue: safeCommitted,
      hint: "Faturas abertas e contas a pagar com vencimento neste mês",
      tone: "negative",
    });
  }

  if (safePendingRecurring > 0) {
    steps.push({
      label: "Recorrências Fixas Pendentes no Mês",
      operator: "-",
      rawValue: safePendingRecurring,
      hint: "Contas recorrentes habituais ainda previstas até o fechamento do mês",
      tone: "negative",
    });
  }

  if (safeContributions > 0) {
    steps.push({
      label: "Aportes Já Realizados no Mês",
      operator: "-",
      rawValue: safeContributions,
      hint: "Investimentos já efetuados no ciclo corrente",
      tone: "portfolio",
    });
  }

  if (safeToSpendCents !== undefined) {
    const adjustedSafeToSpendCents = Math.max(0, safeToSpendCents - safePendingRecurring);
    const wasCappedByLiquidity = accountingSurplusCents > adjustedSafeToSpendCents;
    steps.push({
      label: "Teto de Liquidez em Conta (Saldo Livre Real - Fixos Pendentes)",
      operator: "=",
      rawValue: adjustedSafeToSpendCents,
      hint: wasCappedByLiquidity
        ? `A sobra contábil (${formatCentsAsBRL(Math.max(0, accountingSurplusCents))}) foi limitada ao caixa livre real disponível em conta hoje.`
        : "Saldo livre real descontando contas recorrentes ainda previstas no mês",
      tone: adjustedSafeToSpendCents > 0 ? "positive" : "negative",
      emphasis: "subtotal",
    });
  }

  const notes: string[] = [];
  if (isEmergency) {
    const monthsNote =
      emergencyMonthsCovered !== null && Number.isFinite(emergencyMonthsCovered)
        ? `Reserva atual cobre ${emergencyMonthsCovered.toFixed(1).replace(".", ",")} de ${emergencyTargetMonths} meses recomendados.`
        : `Reserva abaixo da meta de ${emergencyTargetMonths} meses.`;
    notes.push(`${monthsNote} Por isso a sobra do ciclo prioriza liquidez imediata.`);
  }
  const safeNextInvoices = Math.max(0, nextCycleInvoicesCents);
  const safeFutureInvoices = Math.max(0, futureInvoicesCents);
  if (safeNextInvoices > 0 || safeFutureInvoices > 0) {
    const upcomingTotal = safeNextInvoices + safeFutureInvoices;
    notes.push(
      `Atenção: este saldo é livre apenas no ciclo atual. Você possui ${formatCentsAsBRL(safeNextInvoices)} na próxima fatura em acumulação e ${formatCentsAsBRL(safeFutureInvoices)} em faturas futuras (${formatCentsAsBRL(upcomingTotal)} no total) — fortaleça sua liquidez sem tratar o valor como consumo livre.`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: "dash-surplus-capacity",
    title: isEmergency
      ? "Memória do Reforço de Reserva de Emergência"
      : "Memória da Capacidade de Aporte",
    description: isEmergency
      ? "Apura a sobra líquida do ciclo atual limitada ao dinheiro livre em conta (após obrigações e fixos pendentes) para fortalecer sua reserva."
      : "Apura a capacidade real de aporte do ciclo respeitando obrigações contratadas e liquidez em conta.",
    periodLabel: "Ciclo Mensal Corrente",
    formulaExpression:
      "min(Sobra Contábil do Mês, max(0, Saldo Livre Real - Recorrências Fixas Pendentes))",
    unit: "currency",
    steps,
    result: {
      label: isEmergency ? "Valor Sugerido para Reserva" : "Capacidade de Aporte Estimada",
      rawValue: suggestedAporteCents,
      unit: "currency",
      tone: isEmergency ? "positive" : "portfolio",
    },
    notes: notes.length > 0 ? notes : undefined,
  };

  return enrichBreakdown(breakdown);
}

export interface WeeklyRadarBreakdownParams {
  currentBalanceCents: number;
  totalDueCents: number;
  freeBalanceCents: number;
  itemsCount: number;
  overdueCount: number;
}

/**
 * Constrói a memória de cálculo do Radar de Contas dos Próximos 7 Dias.
 */
export function buildWeeklyRadarBreakdown(
  params: WeeklyRadarBreakdownParams,
): CalculationBreakdown {
  const { currentBalanceCents, totalDueCents, freeBalanceCents, itemsCount, overdueCount } = params;

  const breakdown: CalculationBreakdown = {
    id: "dash-weekly-radar",
    title: "Memória do Saldo Livre da Semana",
    description:
      "Cruza o saldo atual em contas bancárias com todas as faturas de cartão e contas a pagar vencidas ou com vencimento nos próximos 7 dias.",
    periodLabel: "Horizonte de 7 dias",
    formulaExpression: "Saldo Livre da Semana = Saldo Atual em Conta - Contas dos Próximos 7 Dias",
    unit: "currency",
    steps: [
      {
        label: "Saldo Atual em Conta",
        operator: "+",
        rawValue: currentBalanceCents,
        hint: "Liquidez disponível hoje no regime de caixa bancário",
        tone: currentBalanceCents >= 0 ? "positive" : "negative",
      },
      {
        label: `Compromissos na Janela (${itemsCount})`,
        operator: "-",
        rawValue: totalDueCents,
        hint:
          overdueCount > 0
            ? `Inclui ${overdueCount} compromisso(s) vencido(s) exigível(is) imediatamente`
            : "Soma de faturas e dívidas a vencer nos próximos 7 dias",
        tone: "negative",
      },
    ],
    result: {
      label: "Saldo Livre da Semana",
      rawValue: freeBalanceCents,
      unit: "currency",
      tone: freeBalanceCents < 0 ? "negative" : "positive",
    },
  };

  return enrichBreakdown(breakdown);
}

/**
 * Constrói a memória de cálculo do Gasto Diário Seguro considerando a média
 * de receitas operacionais do ano, a sobra do ciclo atual e as próximas faturas.
 */
export function buildSafeDailySpendingBreakdown(
  result: SafeDailySpendingResult,
): CalculationBreakdown {
  const {
    hasIncomeBase,
    incomeSource,
    incomeMonthsCount,
    horizonDays,
    safeToSpendCents,
    averageMonthlyIncomeCents,
    nextCycleInvoicesCents,
    futureInvoicesCents,
    nextMonthPayableDebtsCents,
    savingsMarginRate,
    savingsMarginCents,
    netAfterMarginCents,
    safeDailyCents,
    breakEvenDailyCents,
  } = result;

  const incomeHint =
    incomeSource === "year_average"
      ? `Média de ${incomeMonthsCount} ${incomeMonthsCount === 1 ? "mês anterior" : "meses anteriores"} com receita neste ano (exclui estornos)`
      : incomeSource === "current_month"
        ? "Baseada nas receitas já recebidas neste mês (sem histórico anterior no ano)"
        : "Cadastre suas receitas para projetar o limite diário";

  const steps: BreakdownStep[] = [
    {
      label: "Sobra do Ciclo Atual",
      operator: "+",
      rawValue: safeToSpendCents,
      hint: "Saldo disponível hoje descontadas as obrigações vencendo ainda neste mês",
      tone: safeToSpendCents >= 0 ? "positive" : "negative",
    },
    {
      label:
        incomeSource === "year_average"
          ? `Renda Média Mensal (${incomeMonthsCount} meses)`
          : "Renda Mensal Estimada",
      operator: "+",
      rawValue: averageMonthlyIncomeCents,
      hint: incomeHint,
      tone: "positive",
    },
  ];

  if (nextCycleInvoicesCents > 0) {
    steps.push({
      label: "Próximas Faturas em Acumulação",
      operator: "-",
      rawValue: nextCycleInvoicesCents,
      hint: "Faturas já acumuladas para vencer no próximo ciclo",
      tone: "negative",
      actionLink: {
        to: "/cartoes",
        label: "Ver faturas",
      },
    });
  }

  if (nextMonthPayableDebtsCents > 0) {
    steps.push({
      label: "Contas a Pagar do Próximo Mês",
      operator: "-",
      rawValue: nextMonthPayableDebtsCents,
      hint: "Boletos e dívidas já agendados para o mês seguinte",
      tone: "negative",
    });
  }

  if (savingsMarginCents > 0) {
    const pctLabel = Math.round(savingsMarginRate * 100);
    steps.push({
      label: `Margem de Sobra / Reserva (${pctLabel}%)`,
      operator: "-",
      rawValue: savingsMarginCents,
      hint: "Reserva automática sobre a renda média para fechar o próximo ciclo no lucro",
      tone: "portfolio",
    });
  }

  steps.push({
    label: "Saldo Líquido para Consumo no Horizonte",
    operator: "=",
    rawValue: Math.max(0, netAfterMarginCents),
    hint: `Distribuído ao longo de ${horizonDays} dias (restante deste mês + próximo mês)`,
    tone: netAfterMarginCents > 0 ? "positive" : "negative",
    emphasis: "subtotal",
  });

  steps.push({
    label: "Dias no Horizonte (Hoje até Fim do Próximo Mês)",
    operator: "/",
    rawValue: horizonDays,
    unit: "count",
    tone: "default",
  });

  const notes: string[] = [];
  if (hasIncomeBase && breakEvenDailyCents !== null && savingsMarginCents > 0) {
    notes.push(
      `No zero a zero (sem reservar os ${Math.round(savingsMarginRate * 100)}% de margem), seu limite seria de ${formatCentsAsBRL(breakEvenDailyCents)}/dia.`,
    );
  }
  if (futureInvoicesCents > 0) {
    notes.push(
      `Faturas posteriores além do próximo ciclo somam ${formatCentsAsBRL(futureInvoicesCents)} e serão cobertas pelas rendas dos meses seguintes.`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: "dash-safe-daily-spending",
    title: "Gasto Diário Seguro",
    description:
      "Mostra quanto você pode gastar por dia daqui até o fim do próximo mês considerando sua renda média, a sobra deste ciclo, as próximas faturas e uma margem de reserva.",
    periodLabel: `Horizonte de ${horizonDays} dias`,
    formulaExpression:
      "(Sobra do Ciclo + Renda Média - Próximas Faturas - Contas Próx. Mês - Margem 10%) / Dias",
    unit: "currency",
    steps,
    result: {
      label: "Limite Diário Seguro",
      rawValue: safeDailyCents ?? 0,
      unit: "currency",
      tone: !hasIncomeBase ? "muted" : (safeDailyCents ?? 0) > 0 ? "positive" : "negative",
      hint: hasIncomeBase
        ? `Equivale a ${formatCentsAsBRL(safeDailyCents ?? 0)} por dia durante ${horizonDays} dias.`
        : "Aguardando histórico de receitas para estimar o gasto diário.",
    },
    inclusions: [
      "Sobra do Ciclo Atual em conta",
      "Média mensal de receitas operacionais do ano",
      "Próximas faturas de cartão em acumulação e contas do próximo mês",
      "Margem prudencial de 10% para reserva/lucro",
    ],
    exclusions: [
      futureInvoicesCents > 0
        ? `Parcelamentos posteriores além do próximo mês (${formatCentsAsBRL(futureInvoicesCents)})`
        : "Parcelamentos posteriores além do próximo mês",
    ],
    notes: notes.length > 0 ? notes : undefined,
  };

  return enrichBreakdown(breakdown);
}
