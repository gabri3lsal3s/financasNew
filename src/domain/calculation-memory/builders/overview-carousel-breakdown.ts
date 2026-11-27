/**
 * Builders puros de Memória de Cálculo para Metas e Rachas do Carrossel da Home (Fase 2B).
 */

import { formatDateBR } from "@/lib/date";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

export interface GoalEvidence {
  shareId: string;
  goalTitle?: string;
  asOf: string;
  deadline: string | null;
  targetCents: number;
  currentCents: number;
  source: string;
  remainingCents: number;
  remainingDays: number | null;
  requiredDailyCents: number | null;
  stage: "completed" | "final_stretch" | "has_surplus" | "regular";
}

export function buildGoalProgressBreakdown(e: GoalEvidence): CalculationBreakdown {
  const isCompleted = e.remainingCents <= 0 && e.targetCents > 0;
  const steps: BreakdownStep[] = [
    {
      label: "Valor Alvo da Meta",
      operator: "=",
      rawValue: e.targetCents,
      unit: "currency",
    },
    {
      label: `Acumulado Atual (${e.source})`,
      operator: "-",
      rawValue: e.currentCents,
      unit: "currency",
      tone: "positive",
    },
    {
      label: isCompleted ? "Meta Concluída" : "Valor Faltante",
      operator: "=",
      rawValue: e.remainingCents,
      unit: "currency",
      tone: isCompleted ? "positive" : "default",
      emphasis: "subtotal",
    },
  ];

  if (e.remainingDays !== null && e.remainingDays > 0 && e.requiredDailyCents !== null) {
    steps.push({
      label: `Ritmo Diário Necessário (${e.remainingDays} dias restantes)`,
      operator: "=",
      rawValue: e.requiredDailyCents,
      unit: "currency",
      tone: "portfolio",
    });
  }

  return enrichBreakdown({
    id: `goal-progress-${e.shareId}`,
    title: e.goalTitle ? `Meta: ${e.goalTitle}` : "Progresso da Meta",
    description: "Calcula o saldo faltante em centavos e, quando há prazo definido, o ritmo diário necessário.",
    periodLabel: e.deadline ? `Prazo até ${formatDateBR(e.deadline)}` : `Posição em ${formatDateBR(e.asOf)}`,
    formulaExpression: "Faltante = max(0, Alvo - Atual) · Ritmo = ceil(Faltante / Dias Restantes)",
    unit: "currency",
    steps,
    result: {
      label: isCompleted ? "Meta Alcançada" : "Saldo Faltante",
      rawValue: isCompleted ? e.currentCents : e.remainingCents,
      unit: "currency",
      tone: isCompleted ? "positive" : "default",
    },
  });
}

export interface SplitEvidencePart {
  participantId: string;
  participantName?: string;
  amountCents: number;
  settledCents: number;
}

export interface SplitEvidenceItem {
  id: string;
  title?: string;
  source: "share" | "legacy_debt";
  expenseCents: number;
  pendingCents: number;
  parts: readonly SplitEvidencePart[];
}

export interface SplitEvidence {
  items: readonly SplitEvidenceItem[];
  pendingCents: number;
  count: number;
}

export function buildSplitPendingBreakdown(e: SplitEvidence): CalculationBreakdown {
  const hasLegacyWithoutParts = e.items.some((i) => i.parts.length === 0);
  const steps: BreakdownStep[] = e.items.map((item) => {
    const settled = item.parts.reduce((acc, p) => acc + p.settledCents, 0);
    const hint =
      item.parts.length > 0
        ? `Despesa ${((item.expenseCents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · Já quitado ${(settled / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Cota estimada (registro legado sem detalhamento de parcelas)";
    return {
      label: item.title ?? `Racha ${item.id}`,
      operator: "+",
      rawValue: item.pendingCents,
      unit: "currency",
      hint,
      tone: "positive",
    };
  });

  return enrichBreakdown({
    id: "overview-split-pending",
    title: "Rachas a Receber Pendentes",
    description: "Soma as parcelas em aberto dos convidados nos rachas ativos e recebíveis vinculados.",
    formulaExpression: "Pendente = Soma(Cota do Convidado - Valor Já Liquidado)",
    unit: "currency",
    steps,
    result: {
      label: `Total a Receber (${e.count} ${e.count === 1 ? "racha" : "rachas"})`,
      rawValue: e.pendingCents,
      unit: "currency",
      tone: "positive",
    },
    notes: hasLegacyWithoutParts
      ? ["Itens legados sem parcelas detalhadas exibem a cota estimada sem inferir participantes."]
      : undefined,
  });
}

function formatBRLFromCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatPtBrNumber(value: number, decimals = 1): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export interface CombinedContributionEvidence {
  asOf: string;
  month: string;
  surplusCents: number;
  brokerageCashCents: number;
  combinedCents: number;
  minTicketCents: number;
  pendingDividendsCount?: number;
  pendingDividendsBRLCents?: number;
  eligibleClass?: string;
}

export function buildCombinedContributionBreakdown(
  e: CombinedContributionEvidence,
): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: "Sobra investível do ciclo atual",
      operator: "+",
      rawValue: e.surplusCents,
      unit: "currency",
      tone: "positive",
      hint: e.eligibleClass ? `Destino sugerido: ${e.eligibleClass}` : undefined,
    },
    {
      label: "Caixa liquidado na corretora",
      operator: "+",
      rawValue: e.brokerageCashCents,
      unit: "currency",
      tone: "portfolio",
      hint: `Mínimo configurável de alocação: ${formatBRLFromCents(e.minTicketCents)}`,
    },
  ];

  const notes: string[] = [
    "Proventos previstos ou pendentes de conferência não são somados ao caixa nem alteram o saldo livre.",
  ];
  if ((e.pendingDividendsCount ?? 0) > 0) {
    notes.push(
      `Há ${e.pendingDividendsCount} provento(s) a conferir (${formatBRLFromCents(e.pendingDividendsBRLCents ?? 0)}) em fluxo separado.`,
    );
  }

  return enrichBreakdown({
    id: "bridge-combined-contribution",
    title: "Potencial Combinado de Aporte",
    description: "Reúne a sobra investível do mês com o saldo em caixa já liquidado na corretora.",
    periodLabel: `Referência ${formatDateBR(e.asOf)}`,
    formulaExpression: "Total Combinado = Sobra Investível + Caixa da Corretora",
    unit: "currency",
    steps,
    result: {
      label: "Poder de Compra Total",
      rawValue: e.combinedCents,
      unit: "currency",
      tone: "portfolio",
    },
    exclusions: ["Proventos futuros ou ainda não liquidados no caixa."],
    notes,
  });
}

export interface DebtVsInvestEvidence {
  loanId: string;
  loanName: string;
  interestRateMonthlyPct: number;
  thresholdRateMonthlyPct: number;
  pendingInstallmentsCount: number;
  remainingDebtCents: number;
  availableSurplusCents: number;
  availableBrokerageCashCents: number;
  asOf: string;
}

export function buildDebtVsInvestBreakdown(
  e: DebtVsInvestEvidence,
): CalculationBreakdown {
  const liquidityPoolCents =
    Math.max(0, e.availableSurplusCents) + Math.max(0, e.availableBrokerageCashCents);

  const steps: BreakdownStep[] = [
    {
      label: `Taxa mensal do contrato (${e.loanName})`,
      operator: "=",
      rawValue: e.interestRateMonthlyPct,
      unit: "percent",
      formattedValue: `${formatPtBrNumber(e.interestRateMonthlyPct, 2)}% a.m.`,
      tone: "negative",
      hint: `Limite prudencial de revisão: ${formatPtBrNumber(e.thresholdRateMonthlyPct, 2)}% a.m.`,
    },
    {
      label: `Parcelas em aberto (${e.pendingInstallmentsCount})`,
      operator: "=",
      rawValue: e.remainingDebtCents,
      unit: "currency",
      tone: "negative",
    },
  ];

  if (e.availableSurplusCents > 0) {
    steps.push({
      label: "Sobra investível disponível no ciclo",
      operator: "+",
      rawValue: e.availableSurplusCents,
      unit: "currency",
      tone: "positive",
    });
  }

  if (e.availableBrokerageCashCents > 0) {
    steps.push({
      label: "Caixa parado disponível na corretora",
      operator: "+",
      rawValue: e.availableBrokerageCashCents,
      unit: "currency",
      tone: "portfolio",
    });
  }

  steps.push({
    label: "Recursos disponíveis para comparar",
    operator: "=",
    rawValue: liquidityPoolCents,
    unit: "currency",
    emphasis: "subtotal",
  });

  return enrichBreakdown({
    id: `bridge-debt-vs-invest-${e.loanId}`,
    title: `Contrato vs. Aporte: ${e.loanName}`,
    description: "Compara a taxa de juros mensal conhecida do contrato com recursos disponíveis para decidir entre amortizar ou aportar.",
    periodLabel: `Posição em ${formatDateBR(e.asOf)}`,
    formulaExpression: "Custo Contratado (% a.m.) vs. Recursos Disponíveis (Sobra + Caixa Corretora)",
    unit: "percent",
    steps,
    result: {
      label: "Taxa Mensal do Contrato",
      rawValue: e.interestRateMonthlyPct,
      unit: "percent",
      formattedValue: `${formatPtBrNumber(e.interestRateMonthlyPct, 2)}% a.m.`,
      tone: "negative",
    },
    notes: [
      "Comparação informativa baseada exclusivamente na taxa mensal cadastrada do contrato, sem estimativa de retorno garantido nem economia prévia de quitação.",
    ],
  });
}

export interface BillImpactEvidence {
  cardId: string;
  cardName: string;
  competenceMonth: string;
  dueDate: string;
  billBalanceCents: number;
  safeToSpendCents: number;
  alreadyDeductedCents: number;
  baseLiquidityCents: number;
  impactPct: number;
  thresholdPct: number;
}

export function buildBillImpactBreakdown(e: BillImpactEvidence): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: `Fatura fechada (${e.cardName} · ${e.competenceMonth})`,
      operator: "=",
      rawValue: e.billBalanceCents,
      unit: "currency",
      tone: "negative",
      hint: `Vencimento em ${formatDateBR(e.dueDate)}`,
    },
    {
      label: "Saldo Livre após reservas do ciclo",
      operator: "+",
      rawValue: e.safeToSpendCents,
      unit: "currency",
    },
    {
      label: "Parcela já deduzida desta fatura",
      operator: "+",
      rawValue: e.alreadyDeductedCents,
      unit: "currency",
      tone: "muted",
    },
    {
      label: "Liquidez antes da reserva da fatura",
      operator: "=",
      rawValue: e.baseLiquidityCents,
      unit: "currency",
      emphasis: "subtotal",
    },
    {
      label: "Limite prudencial de peso da fatura",
      operator: "=",
      rawValue: e.thresholdPct,
      unit: "percent",
      formattedValue: `${formatPtBrNumber(e.thresholdPct, 0)}%`,
      tone: "muted",
    },
  ];

  return enrichBreakdown({
    id: `cashflow-bill-impact-${e.cardId}-${e.competenceMonth}`,
    title: `Impacto da Fatura: ${e.cardName}`,
    description: "Mede a proporção desta fatura fechada sobre a liquidez disponível antes da reserva dela própria.",
    periodLabel: `Competência ${e.competenceMonth}`,
    formulaExpression: "Impacto (%) = (Fatura Líquida Pendente / Liquidez Pré-Reserva) × 100",
    unit: "percent",
    steps,
    result: {
      label: "Peso sobre a Liquidez",
      rawValue: e.impactPct,
      unit: "percent",
      formattedValue: `${formatPtBrNumber(e.impactPct, 1)}%`,
      tone: e.impactPct >= e.thresholdPct ? "negative" : "default",
    },
  });
}

export interface BudgetCategoryPaceEvidence {
  categoryId: string;
  categoryName: string;
  month: string;
  spentCents: number;
  limitCents: number;
  usedPct: number;
  dayOfMonth: number;
  daysInMonth: number;
  elapsedPct: number;
  remainingCents: number;
}

export function buildBudgetCategoryPaceBreakdown(
  e: BudgetCategoryPaceEvidence,
): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: `Gasto ponderado em ${e.categoryName}`,
      operator: "=",
      rawValue: e.spentCents,
      unit: "currency",
      tone: "negative",
    },
    {
      label: "Teto mensal efetivo da categoria",
      operator: "/",
      rawValue: e.limitCents,
      unit: "currency",
    },
    {
      label: `Ritmo do calendário (${e.dayOfMonth}/${e.daysInMonth} dias)`,
      operator: "=",
      rawValue: e.elapsedPct,
      unit: "percent",
      formattedValue: `${formatPtBrNumber(e.elapsedPct, 1)}%`,
      tone: "muted",
    },
    {
      label: "Margem restante no limite",
      operator: "=",
      rawValue: e.remainingCents,
      unit: "currency",
      emphasis: "subtotal",
      tone: e.remainingCents > 0 ? "default" : "negative",
    },
  ];

  return enrichBreakdown({
    id: `budget-category-pace-${e.categoryId}-${e.month}`,
    title: `Ritmo de Orçamento: ${e.categoryName}`,
    description: "Compara o consumo acumulado da categoria com o limite do mês antes da reta final do calendário.",
    periodLabel: `Competência ${e.month}`,
    formulaExpression: "Uso (%) = (Gasto Ponderado / Limite Efetivo) × 100",
    unit: "percent",
    steps,
    result: {
      label: "Consumido no Mês",
      rawValue: e.usedPct,
      unit: "percent",
      formattedValue: `${formatPtBrNumber(e.usedPct, 1)}%`,
      tone: e.usedPct >= 80 ? "negative" : "default",
    },
  });
}

export interface MonthlyContributionConsistencyEvidence {
  month: string;
  dayOfMonth: number;
  daysInMonth: number;
  suggestedAporteCents: number;
  realizedContributionsCents: number;
  minDayThreshold: number;
  minSurplusCents: number;
}

export function buildMonthlyContributionConsistencyBreakdown(
  e: MonthlyContributionConsistencyEvidence,
): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: "Sobra investível disponível no ciclo",
      operator: "=",
      rawValue: e.suggestedAporteCents,
      unit: "currency",
      tone: "positive",
      hint: `Piso de sinalização: ${formatBRLFromCents(e.minSurplusCents)}`,
    },
    {
      label: "Aportes realizados na competência",
      operator: "=",
      rawValue: e.realizedContributionsCents,
      unit: "currency",
      tone: e.realizedContributionsCents > 0 ? "positive" : "negative",
    },
    {
      label: `Dia do mês (dispara a partir do dia ${e.minDayThreshold})`,
      operator: "=",
      rawValue: e.dayOfMonth,
      unit: "count",
      formattedValue: `${e.dayOfMonth} de ${e.daysInMonth}`,
      tone: "muted",
    },
  ];

  return enrichBreakdown({
    id: `bridge-monthly-consistency-${e.month}`,
    title: "Consistência de Aporte Mensal",
    description: "Verifica se houve algum aporte efetivado no mês diante de capacidade investível disponível na reta final.",
    periodLabel: `Competência ${e.month}`,
    formulaExpression: "Elegível quando Aportes no Mês = 0, Dia >= 22 e Sobra Investível >= Mínimo",
    unit: "currency",
    steps,
    result: {
      label: "Capacidade Pronta para Aporte",
      rawValue: e.suggestedAporteCents,
      unit: "currency",
      tone: "portfolio",
    },
    exclusions: ["Registros marcados como Marco Zero ou movimentação interna."],
  });
}
