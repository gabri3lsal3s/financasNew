/**
 * Builders de Memória de Cálculo para o SmartAdvisor (§F30 / AUD-05 / Melhoria 6).
 *
 * Módulo puro responsável por gerar a memória de cálculo e rastreabilidade detalhada
 * das recomendações, anomalias, reajustes, hábitos e alertas do assistente inteligente.
 */

import { enrichBreakdown } from "../formatters";
import type { CalculationBreakdown, BreakdownStep } from "../types";
import type { SmartAdvisorInsight } from "@/domain/insights/advisor";
import type { ReferenceBudgetSource } from "@/domain/insights/financial-context";
import type { MonthlyClosingSummary } from "@/domain/insights/monthly-closing";
import { formatMonthYear } from "@/lib/date";
import { formatCentsAsBRL } from "@/services/masks/money";

export interface SmartAdvisorBreakdownOptions {
  dayOfMonth?: number;
  daysInMonth?: number;
  previousPeriodCents?: number;
  currentPeriodCents?: number;
  dailyBurnRateCents?: number;
  referenceMonthLabel?: string;
}

/**
 * Monta o breakdown de cálculo para qualquer insight do SmartAdvisor.
 */
export function buildSmartAdvisorBreakdown(
  insight: SmartAdvisorInsight,
  options: SmartAdvisorBreakdownOptions = {},
): CalculationBreakdown {
  const {
    dayOfMonth = 15,
    daysInMonth = 30,
    previousPeriodCents,
    currentPeriodCents,
    dailyBurnRateCents,
    referenceMonthLabel,
  } = options;

  const valueCents = insight.metadata?.valueCents ?? 0;
  const isProvenRecurring = insight.metadata?.isProvenRecurring !== false;
  const annualSavingsCents =
    insight.metadata?.annualSavingsCents ?? (isProvenRecurring ? valueCents * 12 : valueCents);
  const percentIncrease = insight.metadata?.percentIncrease;
  const duplicateCount = insight.metadata?.duplicateCount;

  // 1. REAJUSTE DE PREÇO (PRICE ADJUSTMENT)
  if (insight.themeKey.startsWith("price_adj:") || percentIncrease != null) {
    const pct = percentIncrease ?? 0;
    const hasExactOldCents = insight.metadata?.previousValueCents != null;
    const oldCents = hasExactOldCents
      ? insight.metadata!.previousValueCents!
      : pct > -100 && pct !== 0
        ? Math.round(valueCents / (1 + pct / 100))
        : valueCents;
    const diffMonthCents = Math.max(0, valueCents - oldCents);
    const diffYearCents = diffMonthCents * 12;

    const steps: BreakdownStep[] = [
      {
        label: "Mensalidade Anterior Identificada",
        operator: "=",
        rawValue: oldCents,
        unit: "currency",
        hint: "Valor cobrado nas faturas ou meses anteriores",
        tone: "default",
      },
      {
        label: "Nova Mensalidade Cobrada",
        operator: "+",
        rawValue: valueCents,
        unit: "currency",
        hint: "Valor identificado no ciclo atual",
        tone: "negative",
      },
      {
        label: "Acréscimo Mensal Nominal",
        operator: "=",
        rawValue: diffMonthCents,
        unit: "currency",
        hint: "Impacto adicional a cada mês",
        tone: "negative",
      },
      {
        label: "Impacto Anualizado Acumulado (x12)",
        operator: "=",
        rawValue: diffYearCents,
        unit: "currency",
        hint: "Projeção do aumento em 1 ano caso a assinatura seja mantida",
        tone: "negative",
      },
    ];

    const breakdown: CalculationBreakdown = {
      id: `advisor-${insight.id}`,
      title: "Memória do Reajuste de Assinatura",
      description:
        "Compara o valor anterior da assinatura com o novo valor cobrado para quantificar a taxa de aumento e o custo anual adicional.",
      periodLabel: referenceMonthLabel ?? "Ciclo Atual",
      formulaExpression: "Variação (%) = ((Novo Valor - Valor Anterior) / Valor Anterior) * 100",
      unit: "percent",
      steps,
      result: {
        label: "Percentual de Reajuste",
        rawValue: pct,
        unit: "percent",
        tone: "negative",
      },
      notes: [
        "Detectado automaticamente quando a mesma assinatura apresenta aumento superior a 10% entre faturas.",
        "A projeção anual multiplica a diferença mensal pelo horizonte de 12 meses.",
      ],
    };

    return enrichBreakdown(breakdown);
  }

  // 2. COBRANÇAS DUPLICADAS (DUPLICATES)
  if (insight.themeKey.startsWith("dup:") || (duplicateCount != null && duplicateCount >= 2)) {
    const count = duplicateCount ?? 2;
    const totalChargedCents = valueCents * count;
    const extraChargesCount = count - 1;
    const potentialRefundCents = valueCents * extraChargesCount;

    const steps: BreakdownStep[] = [
      {
        label: "Valor Unitário da Cobrança",
        operator: "=",
        rawValue: valueCents,
        unit: "currency",
        hint: "Valor médio cobrado por transação",
        tone: "default",
      },
      {
        label: "Quantidade de Cobranças no Mês",
        operator: "x",
        rawValue: count,
        unit: "count",
        hint: "Transações identificadas no mesmo ciclo",
        tone: "negative",
      },
      {
        label: "Total Cobrado no Período",
        operator: "=",
        rawValue: totalChargedCents,
        unit: "currency",
        hint: "Soma de todos os lançamentos repetidos",
        tone: "negative",
      },
      {
        label: "Potencial Estorno / Duplicidade",
        operator: "=",
        rawValue: potentialRefundCents,
        unit: "currency",
        hint: `${extraChargesCount} cobrança(s) além da única devida no mês`,
        tone: "positive",
      },
    ];

    const breakdown: CalculationBreakdown = {
      id: `advisor-${insight.id}`,
      title: "Memória de Cobrança Duplicada",
      description:
        "Mapeia múltiplos débitos idênticos do mesmo estabelecimento para identificar cobranças em duplicidade com potencial de estorno.",
      periodLabel: referenceMonthLabel ?? "Mês Atual",
      formulaExpression: "Excesso Cobrado = Valor Unitário * (Quantidade - 1)",
      unit: "currency",
      steps,
      result: {
        label: "Potencial Estorno",
        rawValue: potentialRefundCents,
        unit: "currency",
        tone: "positive",
      },
      notes: [
        "Identifica transações com descrição e valores correspondentes ocorridas dentro do mesmo mês.",
        "Não considera cobranças em meses distintos nem parcelamentos formais.",
      ],
    };

    return enrichBreakdown(breakdown);
  }

  // 3. ANOMALIA COM COMPARAÇÃO PRO-RATA (PRO-RATA TREND / AUD-05)
  if (previousPeriodCents != null && currentPeriodCents != null) {
    const diffCents = currentPeriodCents - previousPeriodCents;
    const pctChange = previousPeriodCents > 0 ? Math.round((diffCents / previousPeriodCents) * 100) : 100;
    const dailyCurrent = dayOfMonth > 0 ? Math.round(currentPeriodCents / dayOfMonth) : 0;
    const dailyPrevious = dayOfMonth > 0 ? Math.round(previousPeriodCents / dayOfMonth) : 0;

    const steps: BreakdownStep[] = [
      {
        label: `Mês Anterior (dias 1 a ${dayOfMonth})`,
        operator: "=",
        rawValue: previousPeriodCents,
        unit: "currency",
        hint: `Gastos acumulados na janela equivalente de ${dayOfMonth} dias`,
        tone: "default",
      },
      {
        label: `Mês Atual (dias 1 a ${dayOfMonth})`,
        operator: "-",
        rawValue: currentPeriodCents,
        unit: "currency",
        hint: `Gastos acumulados na janela de ${dayOfMonth} dias deste mês`,
        tone: "negative",
      },
      {
        label: "Diferença Pro-Rata",
        operator: "=",
        rawValue: diffCents,
        unit: "currency",
        hint: "Variação nominal nos dias equivalentes",
        tone: diffCents > 0 ? "negative" : "positive",
      },
      {
        label: "Ritmo Diário Atual vs Anterior",
        operator: "=",
        rawValue: dailyCurrent,
        unit: "currency",
        hint: `R$ ${(dailyCurrent / 100).toFixed(2)}/dia atual vs R$ ${(dailyPrevious / 100).toFixed(2)}/dia anterior`,
        tone: "default",
      },
    ];

    const breakdown: CalculationBreakdown = {
      id: `advisor-${insight.id}`,
      title: "Memória da Comparação Pro-Rata",
      description:
        "Compara o mesmo número de dias decorridos do mês atual contra o mesmo período no mês anterior, garantindo que feriados e dias restantes não distorçam a análise.",
      periodLabel: `Primeiros ${dayOfMonth} dias`,
      formulaExpression: "Variação Pro-Rata (%) = ((Atual_1..D - Anterior_1..D) / Anterior_1..D) * 100",
      unit: "percent",
      steps,
      result: {
        label: "Variação Pro-Rata",
        rawValue: pctChange,
        unit: "percent",
        tone: pctChange > 0 ? "negative" : "positive",
      },
      notes: [
        "Compara estritamente dias equivalentes (1 a D) para evitar falsos alarmes.",
        "O ritmo diário (burn rate) reflete a velocidade média de gasto por dia útil.",
      ],
    };

    return enrichBreakdown(breakdown);
  }

  // 3B. REFORÇO DE RESERVA / APORTE SUGERIDO (APORTE)
  if (insight.themeKey.startsWith("aporte:")) {
    const isEmergencySuggestion = insight.title.toLowerCase().includes("reserva");
    const steps: BreakdownStep[] = [
      {
        label: isEmergencySuggestion ? "Liquidez Sugerida para Reserva" : "Valor Sugerido para Aporte",
        operator: "=",
        rawValue: valueCents,
        unit: "currency",
        hint: "Respeita o teto do Saldo Livre Real após obrigações do ciclo e fixos pendentes",
        tone: isEmergencySuggestion ? "positive" : "portfolio",
      },
    ];
    if (annualSavingsCents > 0 && annualSavingsCents !== valueCents) {
      steps.push({
        label: "Sobra Líquida Disponível no Ciclo",
        operator: "=",
        rawValue: annualSavingsCents,
        unit: "currency",
        hint: "Excedente livre apurado no ciclo atual em conta bancária",
        tone: "positive",
      });
    }

    const breakdown: CalculationBreakdown = {
      id: `advisor-${insight.id}`,
      title: isEmergencySuggestion
        ? "Memória do Reforço da Reserva de Emergência"
        : "Memória da Sugestão de Aporte",
      description:
        "Limita o valor sugerido ao Saldo Livre Real do ciclo atual após contas vencendo no mês e recorrências pendentes.",
      periodLabel: referenceMonthLabel ?? "Ciclo Atual",
      formulaExpression: "Sugestão = min(Alvo de Aporte, Saldo Livre Real - Fixos Pendentes)",
      unit: "currency",
      steps,
      result: {
        label: isEmergencySuggestion ? "Reforço Sugerido" : "Aporte Sugerido",
        rawValue: valueCents,
        unit: "currency",
        tone: isEmergencySuggestion ? "positive" : "portfolio",
      },
      notes: [
        "Antes de destinar recursos a consumo discricionário, verifique faturas de cartão em acumulação nos próximos ciclos.",
      ],
    };

    return enrichBreakdown(breakdown);
  }

  // 4. HÁBITOS DE CONSUMO E MICROVAZAMENTOS (HABITS / MICRO-LEAKAGE)
  if (insight.themeKey.startsWith("habit:") || insight.category === "savings") {
    const burnRate = dailyBurnRateCents ?? (dayOfMonth > 0 ? Math.round(valueCents / dayOfMonth) : 0);
    const projectedMonthEndCents = burnRate * daysInMonth;

    const steps: BreakdownStep[] = [
      {
        label: "Gasto Acumulado no Período",
        operator: "=",
        rawValue: valueCents,
        unit: "currency",
        hint: `Total gasto nos primeiros ${dayOfMonth} dias do mês`,
        tone: "default",
      },
      {
        label: "Ritmo Diário Médio (Burn Rate)",
        operator: "=",
        rawValue: burnRate,
        unit: "currency",
        hint: `Gasto acumulado dividido por ${dayOfMonth} dias decorridos`,
        tone: "default",
      },
      {
        label: "Projeção de Fechamento do Mês",
        operator: "=",
        rawValue: projectedMonthEndCents,
        unit: "currency",
        hint: `Ritmo diário projetado para os ${daysInMonth} dias do mês`,
        tone: "negative",
      },
      {
        label: "Impacto Anual Estimado (x12)",
        operator: "=",
        rawValue: annualSavingsCents,
        unit: "currency",
        hint: "Impacto no orçamento anual caso o hábito permaneça inalterado",
        tone: "negative",
      },
    ];

    const breakdown: CalculationBreakdown = {
      id: `advisor-${insight.id}`,
      title: "Memória do Hábito de Consumo",
      description:
        "Calcula a intensidade diária dos gastos da categoria e projeta o impacto acumulado ao ano para orientar a definição de um teto de gastos.",
      periodLabel: referenceMonthLabel ?? `Dias 1 a ${dayOfMonth}`,
      formulaExpression: "Ritmo Diário = Gasto Acumulado / Dias Decorridos | Projeção Anual = Mensal * 12",
      unit: "currency",
      steps,
      result: {
        label: "Projeção Anual",
        rawValue: annualSavingsCents,
        unit: "currency",
        tone: "negative",
      },
      notes: [
        "A taxa diária (burn rate) utiliza estritamente os dias já decorridos do mês atual.",
        "Pequenos gastos frequentes somados revelam microvazamentos invisíveis na rotina diária.",
      ],
    };

    return enrichBreakdown(breakdown);
  }

  // 5. TETO FAMILIAR ESTOURADO (HOUSEHOLD CEILING)
  if (insight.themeKey.startsWith("household:ceiling_exceeded")) {
    const excessCents = Math.max(0, valueCents - (currentPeriodCents ?? 0));

    const steps: BreakdownStep[] = [
      {
        label: "Gasto Consolidado da Casa",
        operator: "=",
        rawValue: valueCents,
        unit: "currency",
        hint: "Soma de todas as despesas dos membros da família",
        tone: "negative",
      },
      {
        label: "Teto Mensal Planejado",
        operator: "-",
        rawValue: currentPeriodCents ?? valueCents - excessCents,
        unit: "currency",
        hint: "Limite máximo acordado entre os membros",
        tone: "default",
      },
      {
        label: "Excesso Orçamentário",
        operator: "=",
        rawValue: excessCents,
        unit: "currency",
        hint: "Valor que ultrapassou o orçamento estipulado",
        tone: "negative",
      },
    ];

    const breakdown: CalculationBreakdown = {
      id: `advisor-${insight.id}`,
      title: "Memória do Teto Familiar",
      description:
        "Verifica a soma dos gastos de todos os membros do grupo familiar frente ao teto orçamentário compartilhado definido para o mês.",
      periodLabel: referenceMonthLabel ?? "Mês Atual",
      formulaExpression: "Excesso = Total Consolidado da Casa - Teto Mensal",
      unit: "currency",
      steps,
      result: {
        label: "Excesso Acumulado",
        rawValue: excessCents,
        unit: "currency",
        tone: "negative",
      },
      notes: [
        "Consolida as despesas com peso familiar de todos os membros ativos da família.",
        "Não inclui despesas particulares categorizadas como individuais fora do orçamento da casa.",
      ],
    };

    return enrichBreakdown(breakdown);
  }

  // 6. CONTA PENDENTE NO MÊS (MISSING EXPENSE)
  if (insight.themeKey.startsWith("missing_expense:")) {
    const expectedDay = insight.metadata?.expectedDate ? Number(insight.metadata.expectedDate.slice(8, 10)) : 10;

    const steps: BreakdownStep[] = [
      {
        label: "Valor Médio Esperado",
        operator: "=",
        rawValue: valueCents,
        unit: "currency",
        hint: "Média das faturas pagas nos meses anteriores",
        tone: "default",
      },
      {
        label: "Dia Estimado de Vencimento",
        operator: "=",
        rawValue: expectedDay,
        unit: "count",
        hint: "Dia habitual de cobrança com base no histórico",
        tone: "default",
      },
    ];

    const breakdown: CalculationBreakdown = {
      id: `advisor-${insight.id}`,
      title: "Memória de Conta Pendente",
      description:
        "Identifica despesas fixas recorrentes que costumam ser debitadas neste período do mês e ainda não foram detectadas no extrato.",
      periodLabel: referenceMonthLabel ?? "Mês Atual",
      formulaExpression: "Alerta = Data de Vencimento Habitual vs Status no Extrato do Mês",
      unit: "currency",
      steps,
      result: {
        label: "Valor Previsto",
        rawValue: valueCents,
        unit: "currency",
        tone: "default",
      },
      notes: [
        "Previne cobrança de juros e encargos por atraso de contas essenciais.",
        "Pode ser confirmada em 1 toque ou dispensada caso o pagamento já tenha ocorrido fora do app.",
      ],
    };

    return enrichBreakdown(breakdown);
  }

  // FALLBACK PADRONIZADO
  const fallbackBreakdown: CalculationBreakdown = {
    id: `advisor-${insight.id}`,
    title: "Memória do Insight",
    description:
      "Apresenta os parâmetros e regras do assistente proativo que fundamentaram esta recomendação financeira.",
    periodLabel: referenceMonthLabel ?? "Período Atual",
    formulaExpression: "Recomendação = Análise Comportamental e Orçamentária",
    unit: "currency",
    steps: [
      {
        label: "Valor de Referência",
        operator: "=",
        rawValue: valueCents,
        unit: "currency",
        hint: "Montante financeiro identificado",
        tone: "default",
      },
      {
        label: "Impacto Anual Projetado",
        operator: "=",
        rawValue: annualSavingsCents,
        unit: "currency",
        hint: "Projeção acumulada em 12 meses",
        tone: "negative",
      },
    ],
    result: {
      label: "Impacto Anual",
      rawValue: annualSavingsCents,
      unit: "currency",
      tone: "negative",
    },
    notes: [
      "Critérios baseados em histórico de transações, limites de cartão e faturas.",
      "Você pode calibrar, confirmar ou silenciar a recomendação a qualquer momento.",
    ],
  };

  return enrichBreakdown(fallbackBreakdown);
}

export interface PaceProjectionBreakdownParams {
  month: string;
  referenceBudgetCents: number;
  referenceBudgetSource: ReferenceBudgetSource;
  isProvisionalReference?: boolean;
  fixedPaidCents: number;
  pendingFixedCents: number;
  oneOffAndTripCents: number;
  projectedVariableCents: number;
  historicalVariableMedianCents?: number;
  blendedWeight?: number | null;
  refundsNeutralizedCents?: number;
  priorCycleRefundCreditCents?: number;
  investmentCents?: number;
  projectedSurplusCents: number | null;
  dailyCents: number | null;
  dayOfMonth: number;
  daysInMonth: number;
  variablePct?: number;
  elapsedTimePct?: number;
  triggerReason?: string;
}

const REFERENCE_SOURCE_LABELS: Record<ReferenceBudgetSource, { title: string; hint: string }> = {
  current_income: {
    title: "Renda Efetiva do Mês",
    hint: "Soma das receitas operacionais já registradas na competência",
  },
  current_plus_expected_income: {
    title: "Renda Parcial + Parcelas Previstas",
    hint: "Receitas já lançadas somadas às parcelas habituais ainda esperadas no ciclo",
  },
  expected_income: {
    title: "Renda Habitual Prevista (Base Provisória)",
    hint: "Estimativa baseada no seu histórico de recebimentos enquanto o mês ainda recebe entradas",
  },
  category_budgets: {
    title: "Soma dos Orçamentos Definidos (Base Provisória)",
    hint: "Referência formada pelos tetos de gastos configurados nas categorias",
  },
  none: {
    title: "Base de Referência Ainda Não Definida",
    hint: "Cadastre sua renda ou defina orçamentos para ativar a projeção",
  },
};

/**
 * Monta a Memória de Cálculo da Projeção Híbrida de Ritmo e Fechamento (Lente Consumo).
 */
export function buildPaceProjectionBreakdown(
  params: PaceProjectionBreakdownParams,
): CalculationBreakdown {
  const {
    month,
    referenceBudgetCents,
    referenceBudgetSource,
    fixedPaidCents,
    pendingFixedCents,
    oneOffAndTripCents,
    projectedVariableCents,
    historicalVariableMedianCents = 0,
    blendedWeight = null,
    refundsNeutralizedCents = 0,
    priorCycleRefundCreditCents = 0,
    investmentCents = 0,
    projectedSurplusCents,
    dailyCents,
    dayOfMonth,
    daysInMonth,
  } = params;

  const sourceMeta = REFERENCE_SOURCE_LABELS[referenceBudgetSource];
  const monthLabel = formatMonthYear(month);
  const steps: BreakdownStep[] = [];

  if (referenceBudgetCents > 0) {
    steps.push({
      label: sourceMeta.title,
      operator: "=",
      rawValue: referenceBudgetCents,
      unit: "currency",
      hint: sourceMeta.hint,
      tone: "positive",
    });
  }

  if (fixedPaidCents > 0) {
    steps.push({
      label: "Despesas Fixas e Estruturais Pagas (1x)",
      operator: "-",
      rawValue: fixedPaidCents,
      unit: "currency",
      hint: "Recorrências, essenciais e custos fixos considerados 1 vez no mês",
      tone: "default",
    });
  }

  if (pendingFixedCents > 0) {
    steps.push({
      label: "Contas Fixas Previstas Pendentes (1x)",
      operator: "-",
      rawValue: pendingFixedCents,
      unit: "currency",
      hint: "Vencimentos recorrentes já esperados no ciclo que ainda não caíram",
      tone: "default",
    });
  }

  if (oneOffAndTripCents > 0) {
    steps.push({
      label: "Compras Pontuais e Viagens (1x)",
      operator: "-",
      rawValue: oneOffAndTripCents,
      unit: "currency",
      hint: "Isoladas do ritmo diário para não multiplicar pelos dias restantes",
      tone: "default",
    });
  }

  if (projectedVariableCents > 0 || referenceBudgetCents > 0) {
    const usesSmoothing =
      blendedWeight !== null &&
      blendedWeight < 1 &&
      historicalVariableMedianCents > 0;

    steps.push({
      label: "Gastos Variáveis Projetados",
      operator: "-",
      rawValue: projectedVariableCents,
      unit: "currency",
      hint: usesSmoothing
        ? "Suavização quadrática com sua mediana recente para evitar distorções nos primeiros dias"
        : `Projeção do consumo variável cotidiano ao longo dos ${daysInMonth} dias do mês`,
      tone: "negative",
    });
  }

  if (priorCycleRefundCreditCents > 0) {
    steps.push({
      label: "Crédito de Estorno de Ciclo Anterior",
      operator: "+",
      rawValue: priorCycleRefundCreditCents,
      unit: "currency",
      hint: "Abate o resultado líquido sem distorcer o ritmo variável atual",
      tone: "positive",
    });
  }

  if (investmentCents > 0) {
    steps.push({
      label: "Aportes Realizados no Mês",
      operator: "-",
      rawValue: investmentCents,
      unit: "currency",
      hint: "Recursos direcionados à carteira descontados do saldo livre de consumo",
      tone: "portfolio",
    });
  }

  const finalSurplus = projectedSurplusCents ?? 0;
  const isPositive = finalSurplus >= 0;

  const notes: string[] = [];
  if (refundsNeutralizedCents > 0) {
    notes.push(
      `Inclui neutralização de ${formatCentsAsBRL(refundsNeutralizedCents)} em estornos diretamente nos gastos deste mês.`,
    );
  }
  if (dailyCents !== null && dailyCents >= 0) {
    notes.push(
      `Ritmo sugerido para fechar no azul até o dia ${daysInMonth}: até ${formatCentsAsBRL(dailyCents)}/dia nos gastos variáveis.`,
    );
  }
  notes.push(
    "Lente Consumo (competência): considera despesas ponderadas do mês. Para vencimentos bancários de faturas e boletos em conta, consulte a Lente Caixa (Saldo Livre Real).",
  );

  const breakdown: CalculationBreakdown = {
    id: `pace-projection-${month}`,
    title: "Memória do Ritmo e Projeção do Mês",
    description:
      "Separa custos fixos (1x) e gastos variáveis suavizados para projetar o fechamento sem alarmes falsos.",
    periodLabel: `${monthLabel} (dia ${dayOfMonth} de ${daysInMonth})`,
    formulaExpression:
      "Resultado Projetado = Base Mensal - Fixos (1x) - Pontuais (1x) - Variáveis Projetados - Aportes",
    unit: "currency",
    steps,
    result: {
      label: isPositive ? "Superávit Projetado" : "Ajuste Projetado no Fechamento",
      rawValue: finalSurplus,
      unit: "currency",
      tone: isPositive ? "positive" : "negative",
      hint: isPositive
        ? "Margem estimada ao fim do ciclo mantendo o ritmo atual."
        : "Valor estimado acima da referência caso o ritmo variável permaneça constante.",
    },
    notes,
  };

  return enrichBreakdown(breakdown);
}

export interface DiagnosticBreakdowns {
  savingsHealth: CalculationBreakdown;
  overspentBudgets: CalculationBreakdown;
  incomeConcentration: CalculationBreakdown;
  weekendSpending: CalculationBreakdown;
  essentialSpending: CalculationBreakdown;
  spendingTrend: CalculationBreakdown;
}

export interface DiagnosticBreakdownsParams {
  month: string;
  incomeCents: number;
  expenseCents: number;
  investmentCents: number;
  committedObligationsCents: number;
  savingsRate: number;
  hasIncome: boolean;
  overspentBudgets: number;
  activeBudgetsCount: number;
  topIncomeSourceCents: number;
  concentrationPercent: number;
  weekdayDailyCents: number;
  weekendDailyCents: number;
  weekendRatio: number;
  weekendComparable: boolean;
  weekendLimitRatio?: number;
  essentialCents: number;
  essentialDenominatorCents: number;
  essentialPercent: number;
  trendHasPreviousBase: boolean;
  previousComparableCents: number;
  trendPercent: number;
  nextCycleInvoicesCents?: number;
  futureInvoicesCents?: number;
}

/**
 * Monta os 6 breakdowns de Memória de Cálculo para os cards de Diagnóstico em /insights.
 */
export function buildDiagnosticBreakdowns(
  params: DiagnosticBreakdownsParams,
): DiagnosticBreakdowns {
  const {
    month,
    incomeCents,
    expenseCents,
    investmentCents,
    committedObligationsCents,
    savingsRate,
    hasIncome,
    overspentBudgets,
    activeBudgetsCount,
    topIncomeSourceCents,
    concentrationPercent,
    weekdayDailyCents,
    weekendDailyCents,
    weekendRatio,
    weekendComparable,
    weekendLimitRatio = 1.5,
    essentialCents,
    essentialDenominatorCents,
    essentialPercent,
    trendHasPreviousBase,
    previousComparableCents,
    trendPercent,
    nextCycleInvoicesCents = 0,
    futureInvoicesCents = 0,
  } = params;

  const periodLabel = formatMonthYear(month);
  const netCycleBalanceCents =
    incomeCents - expenseCents - investmentCents - Math.max(0, committedObligationsCents);

  const upcomingCardsCents = Math.max(0, nextCycleInvoicesCents) + Math.max(0, futureInvoicesCents);
  const savingsNotes: string[] = [
    "Faixas: Forte (>= 30%), Saudável (20%-29,9%), Moderado (10%-19,9%), Baixo (0%-9,9%), Crítico (< 0%).",
  ];
  if (upcomingCardsCents > 0) {
    savingsNotes.push(
      `Atenção: há ${formatCentsAsBRL(nextCycleInvoicesCents)} em próximas faturas em acumulação e ${formatCentsAsBRL(futureInvoicesCents)} em faturas futuras fora das obrigações deste ciclo.`,
    );
  }

  const savingsHealth = enrichBreakdown({
    id: `diag-savings-health-${month}`,
    title: "Memória da Saúde da Poupança",
    description:
      "Mede quanto da receita do mês sobra livre após despesas, aportes e compromissos contratados do ciclo atual.",
    periodLabel,
    formulaExpression:
      "Taxa (%) = ((Receitas - Despesas - Aportes - Obrigações do Ciclo) / Receitas) * 100",
    unit: "percent",
    steps: [
      {
        label: "Receitas do Mês",
        operator: "+",
        rawValue: incomeCents,
        unit: "currency",
        tone: "positive",
      },
      {
        label: "Despesas do Mês",
        operator: "-",
        rawValue: expenseCents,
        unit: "currency",
        tone: "negative",
      },
      ...(investmentCents > 0
        ? [
            {
              label: "Aportes Realizados",
              operator: "-" as const,
              rawValue: investmentCents,
              unit: "currency" as const,
              tone: "portfolio" as const,
            },
          ]
        : []),
      ...(committedObligationsCents > 0
        ? [
            {
              label: "Obrigações Contratadas do Ciclo",
              operator: "-",
              rawValue: committedObligationsCents,
              unit: "currency",
              hint: "Faturas abertas e contas a pagar que vencem neste mês",
              tone: "negative",
            } satisfies BreakdownStep,
          ]
        : []),
      {
        label: "Capacidade Residual do Ciclo",
        operator: "=",
        rawValue: netCycleBalanceCents,
        unit: "currency",
        tone: netCycleBalanceCents >= 0 ? "positive" : "negative",
        emphasis: "subtotal",
      },
    ],
    result: {
      label: "Taxa de Poupança Efetiva",
      rawValue: hasIncome ? savingsRate : 0,
      unit: "percent",
      tone: !hasIncome ? "muted" : savingsRate >= 10 ? "positive" : "negative",
    },
    notes: savingsNotes,
  });

  const inCeilingCount = Math.max(0, activeBudgetsCount - overspentBudgets);
  const overspentBreakdown = enrichBreakdown({
    id: `diag-overspent-budgets-${month}`,
    title: "Memória de Orçamentos Estourados",
    description:
      "Compara os gastos realizados em cada categoria de despesa contra o teto definido ou herdado para o mês.",
    periodLabel,
    formulaExpression: "Estourados = Quantidade de categorias com Gasto > Teto (> 100%)",
    unit: "count",
    steps: [
      {
        label: "Categorias com Teto Ativo",
        operator: "=",
        rawValue: activeBudgetsCount,
        unit: "count",
        tone: "default",
      },
      {
        label: "Dentro do Teto Planejado",
        operator: "-",
        rawValue: inCeilingCount,
        unit: "count",
        tone: "positive",
      },
    ],
    result: {
      label: "Orçamentos Excedidos",
      rawValue: overspentBudgets,
      unit: "count",
      tone: overspentBudgets === 0 ? "positive" : "negative",
    },
  });

  const incomeConcentration = enrichBreakdown({
    id: `diag-income-concentration-${month}`,
    title: "Memória de Concentração de Renda",
    description:
      "Calcula a dependência da maior fonte de receita sobre o total de entradas do mês.",
    periodLabel,
    formulaExpression: "Concentração (%) = (Maior Fonte de Renda / Receita Total) * 100",
    unit: "percent",
    steps: [
      {
        label: "Maior Fonte de Renda",
        operator: "=",
        rawValue: topIncomeSourceCents,
        unit: "currency",
        tone: "default",
      },
      {
        label: "Receita Total do Mês",
        operator: "/",
        rawValue: incomeCents,
        unit: "currency",
        tone: "positive",
      },
    ],
    result: {
      label: "Participação da Fonte Principal",
      rawValue: hasIncome ? concentrationPercent : 0,
      unit: "percent",
      tone: concentrationPercent > 60 ? "negative" : "default",
    },
    notes: [
      "Concentração superior a 60% gera alerta apenas quando há múltiplas fontes de receita.",
    ],
  });

  const weekendSpending = enrichBreakdown({
    id: `diag-weekend-spending-${month}`,
    title: "Memória de Gastos em Fins de Semana",
    description:
      "Compara a média diária de consumo aos sábados e domingos contra a média diária em dias úteis decorridos no mês.",
    periodLabel,
    formulaExpression: "Razão = Média Diária Fim de Semana / Média Diária Dia Útil",
    unit: "ratio",
    steps: [
      {
        label: "Média Diária (Fins de Semana)",
        operator: "=",
        rawValue: Math.round(weekendDailyCents),
        unit: "currency",
        tone: "default",
      },
      {
        label: "Média Diária (Dias Úteis)",
        operator: "/",
        rawValue: Math.round(weekdayDailyCents),
        unit: "currency",
        tone: "default",
      },
    ],
    result: {
      label: "Multiplicador Fim de Semana",
      rawValue: weekendComparable && Number.isFinite(weekendRatio) ? weekendRatio : 0,
      unit: "ratio",
      tone:
        !weekendComparable
          ? "muted"
          : weekendRatio > weekendLimitRatio
            ? "negative"
            : "positive",
    },
    notes: [
      `Alerta ativado quando a razão ultrapassa ${weekendLimitRatio.toFixed(1).replace(".", ",")}x após massa crítica mínima (4+ lançamentos).`,
    ],
  });

  const essentialSpending = enrichBreakdown({
    id: `diag-essential-spending-${month}`,
    title: "Memória de Gastos Essenciais",
    description:
      "Verifica qual fatia da renda de referência (ou do total gasto) é absorvida por categorias essenciais como moradia, contas básicas e saúde.",
    periodLabel,
    formulaExpression: "Comprometimento Essencial (%) = (Gastos Essenciais / Base de Referência) * 100",
    unit: "percent",
    steps: [
      {
        label: "Gastos Essenciais no Mês",
        operator: "=",
        rawValue: essentialCents,
        unit: "currency",
        tone: "default",
      },
      {
        label: "Base de Referência (Renda ou Gasto Total)",
        operator: "/",
        rawValue: essentialDenominatorCents,
        unit: "currency",
        tone: "default",
      },
    ],
    result: {
      label: "Fatia Essencial",
      rawValue: essentialPercent,
      unit: "percent",
      tone: essentialPercent <= 50 ? "positive" : essentialPercent <= 70 ? "default" : "negative",
    },
    notes: ["Regra 50/30/20: patamar ideal de até 50% para despesas essenciais."],
  });

  const diffCents = expenseCents - previousComparableCents;
  const spendingTrend = enrichBreakdown({
    id: `diag-spending-trend-${month}`,
    title: "Memória da Tendência de Gastos",
    description:
      "Compara o gasto acumulado até hoje no mês atual contra a mesma janela de dias do mês anterior (comparação pro-rata).",
    periodLabel,
    formulaExpression: "Tendência (%) = ((Atual - Anterior Pro-Rata) / Anterior Pro-Rata) * 100",
    unit: "percent",
    steps: [
      {
        label: "Gastos Acumulados (Mês Atual)",
        operator: "+",
        rawValue: expenseCents,
        unit: "currency",
        tone: "negative",
      },
      {
        label: "Base Comparável (Mês Anterior)",
        operator: "-",
        rawValue: previousComparableCents,
        unit: "currency",
        tone: "default",
      },
      {
        label: "Diferença Nominal",
        operator: "=",
        rawValue: diffCents,
        unit: "currency",
        tone: diffCents > 0 ? "negative" : "positive",
      },
    ],
    result: {
      label: "Variação Percentual",
      rawValue: trendHasPreviousBase ? trendPercent : 0,
      unit: "percent",
      tone: !trendHasPreviousBase ? "muted" : trendPercent > 0 ? "negative" : "positive",
    },
    notes: ["Oscilações acima de +-15% são destacadas como estatisticamente relevantes."],
  });

  return {
    savingsHealth,
    overspentBudgets: overspentBreakdown,
    incomeConcentration,
    weekendSpending,
    essentialSpending,
    spendingTrend,
  };
}

export interface RecurrencesSummaryBreakdownParams {
  totalRecurringCents: number;
  totalAnnualRecurringCents: number;
  canCutRecurringCents: number;
  monthlyIncomeCents: number;
  fixedCommitmentRate: number | null;
}

/**
 * Monta a Memória de Cálculo do Resumo de Recorrências e Assinaturas.
 */
export function buildRecurrencesSummaryBreakdown(
  params: RecurrencesSummaryBreakdownParams,
): CalculationBreakdown {
  const {
    totalRecurringCents,
    totalAnnualRecurringCents,
    canCutRecurringCents,
    monthlyIncomeCents,
    fixedCommitmentRate,
  } = params;

  const steps: BreakdownStep[] = [
    {
      label: "Total Mensal de Assinaturas e Contas Fixas",
      operator: "=",
      rawValue: totalRecurringCents,
      unit: "currency",
      tone: "default",
    },
    {
      label: "Projeção Anual (x12 meses)",
      operator: "=",
      rawValue: totalAnnualRecurringCents,
      unit: "currency",
      tone: "default",
    },
  ];

  if (monthlyIncomeCents > 0) {
    steps.push({
      label: "Renda Mensal de Referência",
      operator: "/",
      rawValue: monthlyIncomeCents,
      unit: "currency",
      hint:
        fixedCommitmentRate !== null
          ? `Comprometimento fixo atual de ${fixedCommitmentRate.toFixed(1).replace(".", ",")}%`
          : undefined,
      tone: "positive",
    });
  }

  if (canCutRecurringCents > 0) {
    steps.push({
      label: "Economia Potencial (Cortáveis / Assinaturas)",
      operator: "-",
      rawValue: canCutRecurringCents,
      unit: "currency",
      hint: "Assinaturas e serviços passíveis de cancelamento ou redução sem afetar essenciais",
      tone: "positive",
    });
  }

  return enrichBreakdown({
    id: "insights-recurrences-summary",
    title: "Memória das Recorrências e Assinaturas",
    description:
      "Consolida cobranças recorrentes ativas e calcula quanto comprometem da renda antes de novos gastos.",
    periodLabel: "Ciclo Mensal & Projeção 12 Meses",
    formulaExpression:
      "Comprometimento (%) = (Total Recorrente Mensal / Renda Mensal) * 100 | Anual = Mensal * 12",
    unit: "currency",
    steps,
    result: {
      label: "Total Mensal Recorrente",
      rawValue: totalRecurringCents,
      unit: "currency",
      tone: "default",
    },
  });
}

export interface PendingSummaryBreakdownParams {
  month: string;
  receivablesCents: number;
  payablesCents: number;
  balanceCents: number;
  openInvoicesCents: number;
  nextCycleInvoicesCents?: number;
  nextCycleInvoicesCount?: number;
  futureInvoicesCents?: number;
  futureInvoicesCount?: number;
}

/**
 * Monta a Memória de Cálculo das Pendências do Período na aba Projeção de /insights.
 */
export function buildPendingSummaryBreakdown(
  params: PendingSummaryBreakdownParams,
): CalculationBreakdown {
  const {
    month,
    receivablesCents,
    payablesCents,
    balanceCents,
    openInvoicesCents,
    nextCycleInvoicesCents = 0,
    nextCycleInvoicesCount = 0,
    futureInvoicesCents = 0,
    futureInvoicesCount = 0,
  } = params;

  const otherPayablesCents = Math.max(0, payablesCents - Math.max(0, openInvoicesCents));
  const steps: BreakdownStep[] = [
    {
      label: "Valores a Receber no Período",
      operator: "+",
      rawValue: receivablesCents,
      unit: "currency",
      tone: "positive",
    },
    {
      label: "Contas e Dívidas a Pagar no Período",
      operator: "-",
      rawValue: otherPayablesCents,
      unit: "currency",
      tone: "negative",
    },
  ];

  if (openInvoicesCents > 0) {
    steps.push({
      label: "Faturas de Cartão do Ciclo Atual",
      operator: "-",
      rawValue: openInvoicesCents,
      unit: "currency",
      tone: "negative",
    });
  }

  const notes: string[] = [];
  if (nextCycleInvoicesCents > 0 || futureInvoicesCents > 0) {
    notes.push(
      `Faturas fora do ciclo atual (para planejamento): ${formatCentsAsBRL(nextCycleInvoicesCents)} em acumulação no próximo ciclo (${nextCycleInvoicesCount || 1} fatura(s)) e ${formatCentsAsBRL(futureInvoicesCents)} em faturas futuras (${futureInvoicesCount || 1} competência(s)).`,
    );
  }

  return enrichBreakdown({
    id: `insights-pending-summary-${month}`,
    title: "Memória das Pendências do Período",
    description:
      "Consolida contas a receber, dívidas a pagar a partir do mês corrente e saldo em aberto das faturas do ciclo.",
    periodLabel: formatMonthYear(month),
    formulaExpression: "Saldo Projetado = A Receber - (Dívidas a Pagar + Faturas do Ciclo)",
    unit: "currency",
    steps,
    result: {
      label: "Saldo Projetado das Pendências",
      rawValue: balanceCents,
      unit: "currency",
      tone: balanceCents >= 0 ? "positive" : "negative",
    },
    notes: notes.length > 0 ? notes : undefined,
  });
}

export interface SavingsChallengesBreakdownParams {
  challenges: readonly { name: string; savingsCents: number; percent: number }[];
  discretionarySavingsCents?: number | null;
}

/**
 * Monta a Memória de Cálculo dos Desafios de Economia Inteligentes.
 */
export function buildSavingsChallengesBreakdown(
  params: SavingsChallengesBreakdownParams,
): CalculationBreakdown {
  const { challenges, discretionarySavingsCents = null } = params;

  const steps: BreakdownStep[] = challenges.map((c, idx) => ({
    label: `${c.name} (-${c.percent}%)`,
    operator: idx === 0 ? undefined : "+",
    rawValue: c.savingsCents,
    unit: "currency",
    hint: "Economia mensal estimada ao aplicar o teto sugerido",
    tone: "positive",
  }));

  if (discretionarySavingsCents && discretionarySavingsCents > 0) {
    steps.push({
      label: "Corte Combinado (30% em Não Essenciais)",
      operator: "=",
      rawValue: discretionarySavingsCents,
      unit: "currency",
      hint: "Cenário alternativo global aplicado sobre categorias discricionárias",
      tone: "positive",
    });
  }

  const topTotalCents = challenges.reduce((acc, c) => acc + c.savingsCents, 0);

  return enrichBreakdown({
    id: "insights-savings-challenges",
    title: "Memória dos Desafios de Economia",
    description:
      "Seleciona as maiores categorias discricionárias não marcadas como essenciais para sugerir cortes proporcionais de orçamento.",
    periodLabel: "Média Típica Recente",
    formulaExpression: "Economia Mensal = Soma dos Desafios Aplicáveis",
    unit: "currency",
    steps:
      steps.length > 0
        ? steps
        : [
            {
              label: "Categorias Discricionárias Acima do Limite",
              operator: "=",
              rawValue: 0,
              unit: "currency",
              tone: "muted",
            },
          ],
    result: {
      label: "Economia Mensal dos Desafios",
      rawValue: topTotalCents > 0 ? topTotalCents : (discretionarySavingsCents ?? 0),
      unit: "currency",
      tone: "positive",
    },
  });
}

/**
 * Monta a Memória de Cálculo do Ritual de Fechamento Mensal em /insights.
 */
export function buildMonthlyClosingBreakdown(
  summary: MonthlyClosingSummary,
): CalculationBreakdown {
  const { closedMonth, incomeCents, expenseCents, balanceCents, limitSuggestions } = summary;
  return enrichBreakdown({
    id: `insights-monthly-closing-${closedMonth}`,
    title: `Fechamento Mensal (${formatMonthYear(closedMonth)})`,
    description:
      "Resume receitas, despesas e resultado líquido do mês recém-encerrado que baseiam os novos tetos sugeridos.",
    periodLabel: formatMonthYear(closedMonth),
    formulaExpression: "Resultado Líquido = Receitas do Mês - Despesas do Mês",
    unit: "currency",
    steps: [
      {
        label: "Receitas do Mês Encerrado",
        operator: "+",
        rawValue: incomeCents,
        unit: "currency",
        tone: "positive",
      },
      {
        label: "Despesas do Mês Encerrado",
        operator: "-",
        rawValue: expenseCents,
        unit: "currency",
        tone: "negative",
      },
    ],
    result: {
      label: "Resultado Líquido do Mês",
      rawValue: balanceCents,
      unit: "currency",
      tone: balanceCents >= 0 ? "positive" : "negative",
    },
    notes:
      limitSuggestions.length > 0
        ? [
            `Foram identificadas ${limitSuggestions.length} categoria(s) com sugestão de recalibração de orçamento para o novo ciclo.`,
          ]
        : undefined,
  });
}
