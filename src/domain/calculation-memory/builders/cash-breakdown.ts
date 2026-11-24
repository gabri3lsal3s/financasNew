/**
 * Construtores de Memória de Cálculo para Saldo em Caixa e Saldo Livre (Safe-to-Spend).
 *
 * Módulo puro testável isoladamente.
 * Corrige a incongruência AUD-01 e implementa a Regra 33 do AGENTS.md.
 */

import { formatDateBR } from "@/lib/date";
import type { CashCheckpointData } from "@/domain/cash";
import type { CashGapAnalysisResult } from "@/domain/projection";
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
  safeToSpendCents: number;
  safeToSpendWithReceivablesCents?: number;
  /** Se true, calcula a variante otimista que incorpora recebíveis no total final. */
  includeReceivablesInTotal?: boolean;
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
    safeToSpendCents,
    safeToSpendWithReceivablesCents,
    includeReceivablesInTotal = false,
  } = params;

  const hasReceivables = receivablePendingCents > 0;
  const isOptimistic = includeReceivablesInTotal && hasReceivables;

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
    rawValue: committedObligationsCents,
    hint: `Faturas de cartão (${openInvoicesCents > 0 ? "abertas" : "zeradas"}) + boletos e compromissos (${payablePendingCents > 0 ? "pendentes" : "zerados"})`,
    tone: "negative",
    actionLink: {
      to: "/cartoes",
      label: "Ver faturas",
    },
  });

  const finalValue = isOptimistic
    ? (safeToSpendWithReceivablesCents ?? safeToSpendCents + receivablePendingCents)
    : safeToSpendCents;

  const breakdown: CalculationBreakdown = {
    id: "dash-safe-to-spend",
    title: isOptimistic
      ? "Saldo Livre Real (com Recebíveis)"
      : "Saldo Livre Real (Safe-to-Spend)",
    description:
      "Quantia verdadeiramente disponível para gastar ou investir sem comprometer as contas e faturas contratadas do ciclo.",
    periodLabel: "Ciclo Mensal Corrente",
    formulaExpression: isOptimistic
      ? "Saldo em Conta + Recebíveis Previstos − Obrigações do Ciclo"
      : "Saldo em Conta − Obrigações do Ciclo",
    unit: "currency",
    steps,
    result: {
      label: isOptimistic ? "Saldo Livre Potencial" : "Saldo Livre Real",
      rawValue: finalValue,
      unit: "currency",
      tone: finalValue >= 0 ? "positive" : "negative",
      hint:
        !isOptimistic && hasReceivables
          ? `Você possui valores a receber previstos que não foram antecipados nesta conta conservadora.`
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
      "Parcelamentos futuros de cartão que vencem em meses posteriores",
      ...(!isOptimistic ? ["Valores a receber previstos (visão conservadora prudencial)"] : []),
    ],
    notes:
      !isOptimistic && hasReceivables
        ? [
            `Visão Prudencial: valores a receber são omitidos do total disponível imediato para prevenir risco de inadimplência.`,
          ]
        : undefined,
  };

  return enrichBreakdown(breakdown);
}

export interface CashGapBreakdownParams {
  result: CashGapAnalysisResult;
  currentBalanceCents: number;
  predictedInflowsTotalCents?: number;
}

/**
 * Constrói a memória de cálculo do Radar Preditivo de Descasamento de Fluxo (Lente Caixa estrita).
 */
export function buildCashGapBreakdown(params: CashGapBreakdownParams): CalculationBreakdown {
  const { result, currentBalanceCents, predictedInflowsTotalCents = 0 } = params;

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
      hint: `Vencimento em ${formatDateBR(obligation.dueDate)} (valor bruto nominal)`,
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

  if (predictedInflowsTotalCents > 0) {
    steps.push({
      label: "Entradas Previstas no Horizonte",
      operator: "+",
      rawValue: predictedInflowsTotalCents,
      hint: "Rendas recorrentes e recebíveis esperados na janela projetada",
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
