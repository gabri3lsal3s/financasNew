/**
 * Construtores de Memória de Cálculo para Orçamentos, Tetos, Modos de Visualização e Reserva de Emergência.
 *
 * Módulo puro (Regra 3 do AGENTS.md e FINANCIAL_MATH_SPEC):
 * - Decomposição do Total Gasto: Nominal Bruto vs Minha Parte Ponderada;
 * - Explicação canônica dos critérios de rateio familiar e individual;
 * - Reserva de Emergência e Autonomia (Runway em meses e dias);
 * - Consumo de Limite por Categoria e ritmo diário (burn rate);
 * - Zero caracteres decorativos Unicode (local/no-decorative-unicode).
 */

import { formatCentsAsBRL } from "@/services/masks/money";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

// ---------------------------------------------------------------------------
// 1. Memória de Ponderação de Gastos (Minha Parte vs Total Bruto)
// ---------------------------------------------------------------------------

export interface BudgetSpendWeightBreakdownParams {
  spendMetric: "personal" | "household";
  totalGrossCents: number;
  totalWeightedCents: number;
  monthLabel?: string;
}

export function buildBudgetSpendWeightBreakdown(
  params: BudgetSpendWeightBreakdownParams,
): CalculationBreakdown {
  const { spendMetric, totalGrossCents, totalWeightedCents, monthLabel } = params;
  const isPersonal = spendMetric === "personal";
  const sharedDeductionCents = Math.max(0, totalGrossCents - totalWeightedCents);

  const steps: BreakdownStep[] = [
    {
      label: "Total Nominal Bruto das Despesas (100% das notas)",
      operator: "+",
      rawValue: totalGrossCents,
      unit: "currency",
      hint: "Soma de todas as despesas lançadas pelo valor integral de cada compra",
      tone: "default",
    },
    {
      label: "Cota de Terceiros / Rateios / Reembolsos Descontados",
      operator: "-",
      rawValue: sharedDeductionCents,
      unit: "currency",
      hint: "Parcela das despesas que foi dividida com familiares ou sujeita a reembolso",
      tone: "muted",
    },
  ];

  const resultValue = isPersonal ? totalWeightedCents : totalGrossCents;
  const resultLabel = isPersonal
    ? "Total Efetivo Ponderado (Minha Parte)"
    : "Total Nominal Integral (Visão Bruta)";

  const breakdown: CalculationBreakdown = {
    id: "budget-spend-weight-breakdown",
    title: isPersonal
      ? "Consumo do Orçamento - Minha Parte (Ponderado)"
      : "Consumo do Orçamento - Total Bruto (Nominal)",
    description: isPersonal
      ? "Considera exclusivamente a sua cota ou responsabilidade pessoal nos gastos compartilhados."
      : "Considera o valor bruto total de cada compra, mesmo quando rateada com terceiros.",
    periodLabel: monthLabel ?? "Mês em Exibição",
    formulaExpression: isPersonal
      ? "Minha Parte = Total Nominal Bruto - Rateios e Reembolsos de Terceiros"
      : "Total Bruto = Soma Integral de Todas as Compras Lancadas",
    unit: "currency",
    steps,
    result: {
      label: resultLabel,
      rawValue: resultValue,
      unit: "currency",
      tone: "negative",
      hint: isPersonal
        ? `Exibindo ${formatCentsAsBRL(totalWeightedCents)} (economizou ${formatCentsAsBRL(sharedDeductionCents)} em rateios frente ao bruto de ${formatCentsAsBRL(totalGrossCents)}).`
        : `Exibindo o valor total bruto de ${formatCentsAsBRL(totalGrossCents)} sem descontos de rateio.`,
    },
    inclusions: isPersonal
      ? [
          "Despesas individuais pagas integralmente por voce (100% computado)",
          "Sua cota percentual exata em despesas compartilhadas no Modo Familia",
          "Deducoes automaticas de reembolsos recebidos ou a receber",
        ]
      : [
          "100% do valor de face de todas as despesas registradas",
          "Compras compartilhadas sem abater a parte de outros membros",
          "Visao global de saida de caixa de todas as categorias",
        ],
    exclusions: isPersonal
      ? [
          "A parcela das compras que cabe a terceiros ou outros participantes da familia",
          "Valores de despesas totalmente reembolsadas",
        ]
      : [
          "Nenhum abatimento de cota familiar (visao puramente nominal de fluxo)",
        ],
    notes: [
      isPersonal
        ? "Dica: Voce pode alternar para o modo 'Total Bruto' no topo da pagina para auditar o valor de face integral das notas fiscais."
        : "Dica: Alterne para 'Minha Parte' no topo da tela para visualizar apenas o que realmente saiu do seu bolso.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 2. Memória Metodológica dos Modos de Visualização
// ---------------------------------------------------------------------------

export interface BudgetSpendModeBreakdownParams {
  currentMetric: "personal" | "household";
}

export function buildBudgetSpendModeExplanationBreakdown(
  params: BudgetSpendModeBreakdownParams,
): CalculationBreakdown {
  const { currentMetric } = params;
  const isPersonal = currentMetric === "personal";

  const steps: BreakdownStep[] = [
    {
      label: "Modo Ativo: Minha Parte (Ponderado)",
      operator: "=",
      rawValue: isPersonal ? 1 : 0,
      unit: "count",
      hint: "Foco no seu bolso: considera apenas a sua cota individual apos rateios familiares e reembolsos",
      tone: isPersonal ? "positive" : "muted",
    },
    {
      label: "Modo Alternativo: Total Bruto (Nominal)",
      operator: "=",
      rawValue: !isPersonal ? 1 : 0,
      unit: "count",
      hint: "Foco no consumo global: considera 100% do valor de face de todas as notas fiscais e compras",
      tone: !isPersonal ? "positive" : "muted",
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: "budget-spend-mode-explanation",
    title: "Modos de Visualizacao do Orcamento",
    description:
      "Entenda como o Axi calcula e pondera seus gastos entre consumo individual e fluxo global.",
    periodLabel: isPersonal ? "Modo Ativo: Minha Parte" : "Modo Ativo: Total Bruto",
    formulaExpression:
      "Minha Parte (Ponderado) <= Total Bruto (Nominal) conforme rateios aplicados",
    unit: "count",
    steps,
    result: {
      label: "Modo Selecionado",
      rawValue: isPersonal ? 1 : 2,
      formattedValue: isPersonal ? "Minha Parte (Individual)" : "Total Bruto (Global)",
      unit: "count",
      tone: "portfolio",
      hint: isPersonal
        ? "Recomendado para gestao de metas de poupanca pessoal e limites do seu orcamento individual."
        : "Recomendado para prestacao de contas do lar e controle de fluxo conjunto.",
    },
    inclusions: [
      "Minha Parte: Aplica o fator de rateio pessoal (ex: 50% numa compra de casal) a cada transacao",
      "Total Bruto: Soma integral dos valores nominais sem aplicar fatores de divisao",
    ],
    notes: [
      "O modo escolhido ajusta em tempo real todos os graficos, barras de progresso e limites de categorias.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 3. Memória da Reserva de Emergência e Autonomia (Runway)
// ---------------------------------------------------------------------------

export interface EmergencyFundBreakdownParams {
  /** Saldo total líquido disponível e elegível para a reserva em centavos. */
  liquidReserveCents: number;
  /** Custo de vida mensal de referência em centavos. */
  monthlyExpensesCents: number;
  /** Meta de cobertura em meses (default 6). */
  targetMonths?: number;
  /** Meta financeira alvo em centavos (opcional, derivada de targetMonths * monthlyExpenses). */
  targetCents?: number;
  /** Velocidade média de poupança mensal em centavos (opcional). */
  monthlySavingsVelocityCents?: number;
}

export function buildEmergencyFundBreakdown(
  params: EmergencyFundBreakdownParams,
): CalculationBreakdown {
  const {
    liquidReserveCents,
    monthlyExpensesCents,
    targetMonths = 6,
    targetCents: providedTargetCents,
    monthlySavingsVelocityCents = 0,
  } = params;

  const hasExpenseBase = monthlyExpensesCents > 0;
  const safeMonthlyExpenses = hasExpenseBase ? monthlyExpensesCents : 0;
  const coverageMonths = hasExpenseBase
    ? Math.round((liquidReserveCents / safeMonthlyExpenses) * 10) / 10
    : 0;
  const coverageDays = Math.round(coverageMonths * 30);
  const targetCents = providedTargetCents ?? safeMonthlyExpenses * targetMonths;
  const gapCents = targetCents - liquidReserveCents;
  const isSurplus = hasExpenseBase && gapCents <= 0;

  const steps: BreakdownStep[] = [
    {
      label: "Reservas Líquidas Totais Elegíveis (Caixa + Renda Fixa D+0/D+1)",
      operator: "+",
      rawValue: liquidReserveCents,
      unit: "currency",
      hint: "Saldo em contas correntes, contas de pagamento e ativos com liquidez imediata",
      tone: "portfolio",
    },
    {
      label: "Custo de Vida Mensal Médio (Despesas Recorrentes)",
      operator: "/",
      rawValue: safeMonthlyExpenses,
      unit: "currency",
      hint: hasExpenseBase
        ? "Média das despesas essenciais mensais para manter seu padrão de vida"
        : "Aguardando registro de despesas mensais para definir a base de cálculo",
      tone: hasExpenseBase ? "default" : "muted",
    },
  ];

  const notes: string[] = hasExpenseBase
    ? [`Meta configurada: ${targetMonths} meses de custo de vida (${formatCentsAsBRL(targetCents)}).`]
    : ["Ainda não há custo de vida mensal de referência para calcular os meses de autonomia."];

  if (hasExpenseBase) {
    if (!isSurplus) {
      const monthsToTarget =
        monthlySavingsVelocityCents > 0
          ? Math.ceil(gapCents / monthlySavingsVelocityCents)
          : null;

      notes.push(
        `Deficit de reserva: Faltam ${formatCentsAsBRL(gapCents)} para atingir a meta plena.${
          monthsToTarget
            ? ` No ritmo atual de poupanca (${formatCentsAsBRL(monthlySavingsVelocityCents)}/mes), a meta sera alcancada em ~${monthsToTarget} meses.`
            : ""
        }`,
      );
    } else {
      notes.push(
        `Meta superada: Suas reservas cobrem 100% da meta de ${targetMonths} meses com excedente seguro de ${formatCentsAsBRL(Math.abs(gapCents))}.`,
      );
    }
  }

  const breakdown: CalculationBreakdown = {
    id: "emergency-fund-runway-breakdown",
    title: "Reserva de Emergência e Autonomia (Runway)",
    description:
      "Quantos meses e dias você consegue manter seu custo de vida sem nenhuma nova receita.",
    periodLabel: hasExpenseBase
      ? `${coverageMonths.toFixed(1).replace(".", ",")} Meses de Autonomia`
      : "Aguardando base de custo mensal",
    formulaExpression:
      "Meses de Autonomia = Reservas Liquidas / Custo de Vida Mensal",
    unit: "months",
    steps,
    result: {
      label: "Autonomia Financeira Estimada",
      rawValue: coverageMonths,
      formattedValue: hasExpenseBase
        ? `${coverageMonths.toFixed(1).replace(".", ",")} meses (~${coverageDays} dias)`
        : "Aguardando base",
      unit: "months",
      tone: !hasExpenseBase
        ? "muted"
        : coverageMonths >= targetMonths
          ? "positive"
          : coverageMonths >= 3
            ? "default"
            : "negative",
      hint: hasExpenseBase
        ? `Você possui cobertura para viver ~${coverageDays} dias com as reservas líquidas atuais.`
        : "Registre despesas no ciclo ou informe um custo de vida mensal para calcular sua autonomia em meses.",
    },
    inclusions: [
      "Saldo disponível em contas bancárias de movimento",
      "Saldo em caixa de corretoras de investimentos",
      "Ativos de Renda Fixa pós-fixados com liquidez diária (Tesouro Selic, CDBs com resgate imediato)",
    ],
    exclusions: [
      "Ações, FIIs, ETFs e BDRs (risco de mercado e volatilidade de cotação)",
      "Fundos de investimento com prazo de resgate longo (D+30 ou superior)",
      "Ativos de previdência fechada ou títulos com carência de resgate",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 4. Memória de Consumo de Orçamento por Categoria
// ---------------------------------------------------------------------------

export interface BudgetCategoryConsumptionBreakdownParams {
  categoryName: string;
  limitCents: number;
  spentCents: number;
  monthLabel?: string;
  daysInMonth?: number;
  currentDay?: number;
}

export function buildBudgetCategoryConsumptionBreakdown(
  params: BudgetCategoryConsumptionBreakdownParams,
): CalculationBreakdown {
  const {
    categoryName,
    limitCents,
    spentCents,
    monthLabel,
    daysInMonth = 30,
    currentDay = 15,
  } = params;

  const safeLimit = Math.max(0, limitCents);
  const remainingCents = safeLimit - spentCents;
  const isOverBudget = remainingCents < 0;
  const consumptionPct = safeLimit > 0 ? (spentCents / safeLimit) * 100 : 0;

  const safeCurrentDay = Math.max(1, currentDay);
  const remainingDays = Math.max(1, daysInMonth - safeCurrentDay);
  const currentDailyPaceCents = Math.round(spentCents / safeCurrentDay);
  const allowedDailyPaceCents = Math.round(Math.max(0, remainingCents) / remainingDays);

  const steps: BreakdownStep[] = [
    {
      label: `Limite Mensal Planejado (${categoryName})`,
      operator: "+",
      rawValue: safeLimit,
      unit: "currency",
      hint: "Teto maximo de gastos definido para o periodo",
      tone: "default",
    },
    {
      label: "Total Gasto Realizado no Mês",
      operator: "-",
      rawValue: spentCents,
      unit: "currency",
      hint: `Soma das despesas computadas na categoria ate o dia ${safeCurrentDay}`,
      tone: "negative",
    },
    {
      label: isOverBudget ? "Excesso / Estouro de Limite" : "Saldo Livre Restante",
      operator: "=",
      rawValue: Math.abs(remainingCents),
      unit: "currency",
      hint: isOverBudget
        ? `Voce estourou o limite em ${formatCentsAsBRL(Math.abs(remainingCents))}`
        : `Voce ainda pode gastar ${formatCentsAsBRL(remainingCents)} neste mes`,
      tone: isOverBudget ? "negative" : "positive",
      emphasis: "subtotal",
    },
    {
      label: "Ritmo Atual de Gasto Diário",
      rawValue: currentDailyPaceCents,
      unit: "currency",
      hint: `Media de ${formatCentsAsBRL(currentDailyPaceCents)} por dia nos primeiros ${safeCurrentDay} dias`,
      tone: "default",
    },
    {
      label: "Teto Diário Sugerido para Não Estourar",
      rawValue: allowedDailyPaceCents,
      unit: "currency",
      hint: isOverBudget
        ? "Limite esgotado para os dias restantes do mes"
        : `Gaste ate ${formatCentsAsBRL(allowedDailyPaceCents)}/dia nos proximos ${remainingDays} dias`,
      tone: isOverBudget ? "negative" : "positive",
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: `budget-consumption-${categoryName.toLowerCase().replace(/\s+/g, "-")}`,
    title: `Consumo de Limite · ${categoryName}`,
    description: `Acompanhamento do ritmo de gastos e saldo disponivel para a categoria ${categoryName}.`,
    periodLabel: monthLabel ?? "Mês Vigente",
    formulaExpression:
      "Saldo Restante = Limite Planejado - Total Gasto no Mês",
    unit: "currency",
    steps,
    result: {
      label: isOverBudget ? "Limite Excedido" : "Saldo Disponível",
      rawValue: remainingCents,
      unit: "currency",
      tone: isOverBudget ? "negative" : "positive",
      hint: `${consumptionPct.toFixed(1).replace(".", ",")}% do limite planejado consumido ate o dia ${safeCurrentDay}.`,
    },
    inclusions: [
      "Todas as despesas confirmadas lancadas na categoria no periodo",
      "Ponderacao de rateio pessoal caso a despesa seja compartilhada",
    ],
    exclusions: [
      "Despesas planejadas futuras ainda nao efetivadas",
      "Lancamentos de outras categorias de orcamento",
    ],
    notes: [
      isOverBudget
        ? `Atencao: Esta categoria ultrapassou o orcamento em ${formatCentsAsBRL(Math.abs(remainingCents))}. Avalie realocar sobras de outras categorias com folga.`
        : `Planejamento sob controle: Restam ${formatCentsAsBRL(remainingCents)} para os proximos ${remainingDays} dias do mes.`,
    ],
  };

  return enrichBreakdown(breakdown);
}
