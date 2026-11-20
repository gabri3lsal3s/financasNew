/**
 * Construtores de Memória de Cálculo para Visão Geral e KPIs Fundamentais.
 *
 * Módulo puro (Regra 3 do AGENTS.md e ESPECIFICAÇÃO §3.6):
 * - Receitas do Mês (brutas, ponderadas e regime de competência);
 * - Despesas do Mês (à vista, faturas e neutralizações);
 * - Resultado Operacional do Mês (Superávit/Déficit);
 * - Taxa de Poupança (Savings Rate — tratamento de AUD-09 e AUD-04);
 * - Investimentos e Aportes do Mês.
 */

import { formatMonthYear } from "@/lib/date";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

// ---------------------------------------------------------------------------
// 1. Receitas do Mês
// ---------------------------------------------------------------------------

export interface MonthlyIncomeBreakdownParams {
  month: string;
  grossIncomeCents: number;
  weightedIncomeCents: number;
  previousIncomeCents?: number;
}

export function buildMonthlyIncomeBreakdown(
  params: MonthlyIncomeBreakdownParams,
): CalculationBreakdown {
  const { month, grossIncomeCents, weightedIncomeCents } = params;
  const isWeighted = grossIncomeCents !== weightedIncomeCents;
  const monthLabel = formatMonthYear(month);

  const steps: BreakdownStep[] = [
    {
      label: "Receitas Registradas no Período",
      operator: isWeighted ? "+" : undefined,
      rawValue: grossIncomeCents,
      hint: "Soma de todas as entradas e rendimentos lançados na competência",
      tone: "positive",
      actionLink: {
        to: `/transacoes?tipo=receitas&month=${month}`,
        label: "Ver receitas",
      },
    },
  ];

  if (isWeighted) {
    const weightingDiff = weightedIncomeCents - grossIncomeCents;
    steps.push({
      label: "Ajuste de Ponderação / Rateio",
      operator: weightingDiff >= 0 ? "+" : "-",
      rawValue: Math.abs(weightingDiff),
      hint: "Fatia atribuída ao seu perfil conforme regras de rateio e divisões",
      tone: weightingDiff >= 0 ? "positive" : "negative",
    });
  }

  const breakdown: CalculationBreakdown = {
    id: `overview-income-${month}`,
    title: "Receitas do Mês",
    description:
      "Volume financeiro total de rendimentos, salários e entradas auferidas na competência.",
    periodLabel: monthLabel,
    formulaExpression: isWeighted
      ? "Receitas Brutas ± Ajustes de Ponderação Familiar"
      : "Soma de todas as entradas da competência",
    unit: "currency",
    steps,
    result: {
      label: isWeighted ? "Receita Ponderada Efetiva" : "Total de Receitas",
      rawValue: isWeighted ? weightedIncomeCents : grossIncomeCents,
      unit: "currency",
      tone: "positive",
      hint: `Entradas totais consideradas no cálculo dos resultados de ${monthLabel}.`,
    },
    inclusions: [
      "Salários, pró-labores, honorários e benefícios recebidos",
      "Rendimentos e receitas operacionais do mês",
      "Receitas avulsas e pontuais registradas no período",
    ],
    exclusions: [
      "Transferências entre contas bancárias do mesmo titular (neutras)",
      "Resgates de investimentos (movimentações de liquidez patrimonial)",
      "Estornos de despesas (creditados diretamente na redução do gasto)",
    ],
    notes: [
      "Regime de Competência: lançamentos pertencem ao mês selecionado, independentemente da data de crédito.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 2. Despesas do Mês
// ---------------------------------------------------------------------------

export interface MonthlyExpensesBreakdownParams {
  month: string;
  grossExpenseCents: number;
  weightedExpenseCents: number;
  previousExpenseCents?: number;
}

export function buildMonthlyExpensesBreakdown(
  params: MonthlyExpensesBreakdownParams,
): CalculationBreakdown {
  const { month, grossExpenseCents, weightedExpenseCents } = params;
  const isWeighted = grossExpenseCents !== weightedExpenseCents;
  const monthLabel = formatMonthYear(month);

  const steps: BreakdownStep[] = [
    {
      label: "Despesas Totais do Período",
      operator: isWeighted ? "+" : undefined,
      rawValue: grossExpenseCents,
      hint: "Gastos à vista (débito/PIX) e compras em faturas do mês",
      tone: "negative",
      actionLink: {
        to: `/transacoes?tipo=despesas&month=${month}`,
        label: "Ver despesas",
      },
    },
  ];

  if (isWeighted) {
    const weightingDiff = weightedExpenseCents - grossExpenseCents;
    steps.push({
      label: "Ajuste de Ponderação / Rateio",
      operator: weightingDiff >= 0 ? "+" : "-",
      rawValue: Math.abs(weightingDiff),
      hint: "Ajuste de participação proporcional em despesas compartilhadas",
      tone: weightingDiff >= 0 ? "negative" : "positive",
    });
  }

  const breakdown: CalculationBreakdown = {
    id: `overview-expense-${month}`,
    title: "Despesas do Mês",
    description:
      "Somatório de todos os consumos, compras em cartão, pagamentos de contas e saídas do mês.",
    periodLabel: monthLabel,
    formulaExpression: isWeighted
      ? "Despesas Brutas ± Ajustes de Participação Familiar"
      : "Gastos em Conta + Compras em Cartões no Mês",
    unit: "currency",
    steps,
    result: {
      label: isWeighted ? "Despesa Ponderada Efetiva" : "Total de Despesas",
      rawValue: isWeighted ? weightedExpenseCents : grossExpenseCents,
      unit: "currency",
      tone: "negative",
      hint: `Total de desembolsos computados para o resultado de ${monthLabel}.`,
    },
    inclusions: [
      "Compras à vista, PIX e débitos em conta corrente",
      "Parcelas de cartão de crédito que vencem na fatura da competência",
      "Contas de consumo fixas e variáveis quitadas ou a pagar do ciclo",
    ],
    exclusions: [
      "Transferências entre contas próprias (não configuram despesa)",
      "Pagamentos de fatura em duplicidade (o gasto já foi computado no item)",
      "Aportes e compras de investimentos (alocações de capital na carteira)",
    ],
    notes: [
      "Controle Antiduplicidade: pagar a fatura do cartão transfere saldo sem duplicar as despesas individuais.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 3. Resultado Operacional do Mês
// ---------------------------------------------------------------------------

export interface OperatingBalanceBreakdownParams {
  month: string;
  incomeCents: number;
  expenseCents: number;
  investmentCents?: number;
  operatingBalanceCents: number;
}

export function buildOperatingBalanceBreakdown(
  params: OperatingBalanceBreakdownParams,
): CalculationBreakdown {
  const { month, incomeCents, expenseCents, investmentCents = 0, operatingBalanceCents } = params;
  const monthLabel = formatMonthYear(month);
  const isSurplus = operatingBalanceCents >= 0;

  const steps: BreakdownStep[] = [
    {
      label: "Receitas Efetivas",
      operator: "+",
      rawValue: incomeCents,
      hint: "Total de entradas computadas para o período",
      tone: "positive",
      actionLink: {
        to: `/transacoes?tipo=receitas&month=${month}`,
        label: "Ver receitas",
      },
    },
    {
      label: "Despesas Efetivas",
      operator: "-",
      rawValue: expenseCents,
      hint: "Total de desembolsos operacionais do mês",
      tone: "negative",
      actionLink: {
        to: `/transacoes?tipo=despesas&month=${month}`,
        label: "Ver despesas",
      },
    },
  ];

  const notes: string[] = [
    isSurplus
      ? "Superávit Operacional: capacidade de poupança gerada no mês antes da aplicação em investimentos."
      : "Déficit Operacional: as despesas superaram as receitas no período, consumindo saldo anterior.",
  ];

  if (investmentCents > 0) {
    notes.push(
      `Aportes Realizados: você direcionou recursos para investimentos no período, transformando parte do superávit em patrimônio de longo prazo.`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: `overview-balance-${month}`,
    title: "Resultado do Mês (Saldo Operacional)",
    description:
      "Diferença entre todas as receitas realizadas e despesas do período. Representa o superávit ou déficit gerado.",
    periodLabel: monthLabel,
    formulaExpression: "Receitas do Mês − Despesas do Mês",
    unit: "currency",
    steps,
    result: {
      label: isSurplus ? "Superávit do Mês" : "Déficit do Mês",
      rawValue: operatingBalanceCents,
      unit: "currency",
      tone: isSurplus ? "positive" : "negative",
      hint: isSurplus
        ? "Saldo líquido positivo gerado pelas operações do mês."
        : "Saldo negativo: gastos maiores que os rendimentos.",
    },
    inclusions: [
      "Todas as receitas auferidas no mês",
      "Todas as despesas operacionais e de consumo do mês",
    ],
    exclusions: [
      "Aportes em investimentos (são conversões de liquidez em patrimônio)",
      "Transferências neutras entre contas bancárias",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 4. Taxa de Poupança (Savings Rate — Tratamento de AUD-09 e AUD-04)
// ---------------------------------------------------------------------------

export interface SavingsRateBreakdownParams {
  month: string;
  incomeCents: number;
  expenseCents: number;
  savingsRatePercent: number;
}

export function buildSavingsRateBreakdown(
  params: SavingsRateBreakdownParams,
): CalculationBreakdown {
  const { month, incomeCents, expenseCents, savingsRatePercent } = params;
  const monthLabel = formatMonthYear(month);
  const operatingBalance = incomeCents - expenseCents;
  const hasZeroIncome = incomeCents <= 0;

  const steps: BreakdownStep[] = [
    {
      label: "Receitas Efetivas (Base 100%)",
      rawValue: incomeCents,
      hint: "Base sobre a qual o esforço de poupança é mensurado",
      tone: "positive",
    },
    {
      label: "Despesas do Mês (Consumo)",
      operator: "-",
      rawValue: expenseCents,
      hint: "Parcela da renda consumida em despesas correntes",
      tone: "negative",
    },
    {
      label: "Capital Preservado",
      operator: "=",
      rawValue: operatingBalance,
      hint: "Saldo operacional disponível para reserva e investimentos",
      tone: operatingBalance >= 0 ? "positive" : "negative",
    },
  ];

  let diagnosticHint = "Excelente índice de retenção financeira (acima de 20%).";
  if (hasZeroIncome) {
    diagnosticHint = "Receitas nulas no mês: cálculo de taxa percentual não aplicável.";
  } else if (savingsRatePercent < 0) {
    diagnosticHint = "Déficit: você gastou mais do que recebeu na competência.";
  } else if (savingsRatePercent < 10) {
    diagnosticHint = "Taxa baixa (abaixo de 10%): margem prudencial reduzida.";
  } else if (savingsRatePercent < 20) {
    diagnosticHint = "Taxa moderada (10% a 20%): ritmo saudável e sustentável.";
  }

  const notes: string[] = [];
  if (hasZeroIncome) {
    notes.push(
      "Auditoria AUD-09: A taxa de poupança é definida como zero quando a receita é nula para prevenir distorções e divisões por zero.",
    );
  } else {
    notes.push(
      "Metodologia Canônica (Fórmula 3.6): Razão entre o saldo operacional líquido e as receitas brutas auferidas no período.",
    );
  }

  const breakdown: CalculationBreakdown = {
    id: `overview-savings-rate-${month}`,
    title: "Taxa de Poupança (Savings Rate)",
    description:
      "Percentual da renda auferida no mês que foi preservada após a cobertura de todas as despesas.",
    periodLabel: monthLabel,
    formulaExpression: hasZeroIncome
      ? "Não aplicável sem receitas (0%)"
      : "((Receitas − Despesas) ÷ Receitas) × 100%",
    unit: "percent",
    steps,
    result: {
      label: "Taxa de Poupança Efetiva",
      rawValue: hasZeroIncome ? 0 : savingsRatePercent,
      unit: "percent",
      tone: hasZeroIncome ? "muted" : savingsRatePercent >= 20 ? "positive" : savingsRatePercent >= 0 ? "default" : "negative",
      hint: diagnosticHint,
    },
    inclusions: [
      "Total de rendas ativas e passivas do mês",
      "Total de despesas operacionais do mês",
    ],
    exclusions: [
      "Aportes não reduzem a poupança: aplicar dinheiro é uma forma de poupar",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 5. Investimentos e Aportes do Mês
// ---------------------------------------------------------------------------

export interface InvestmentsOverviewBreakdownParams {
  month: string;
  investmentCents: number;
  previousInvestmentCents?: number;
}

export function buildInvestmentsOverviewBreakdown(
  params: InvestmentsOverviewBreakdownParams,
): CalculationBreakdown {
  const { month, investmentCents } = params;
  const monthLabel = formatMonthYear(month);

  const steps: BreakdownStep[] = [
    {
      label: "Aportes em Ativos e Corretoras",
      operator: undefined,
      rawValue: investmentCents,
      hint: "Compras de ativos (ações, FIIs, renda fixa) e depósitos em contas de investimento",
      tone: "portfolio",
      actionLink: {
        to: "/investments",
        label: "Ver investimentos",
      },
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: `overview-investments-${month}`,
    title: "Investimentos do Mês",
    description:
      "Capital líquido alocado na formação e ampliação da carteira de investimentos no período.",
    periodLabel: monthLabel,
    formulaExpression: "Total de Aportes Realizados no Mês",
    unit: "currency",
    steps,
    result: {
      label: "Total Investido no Mês",
      rawValue: investmentCents,
      unit: "currency",
      tone: "portfolio",
      hint: `Volume financeiro canalizado para o patrimônio em ${monthLabel}.`,
    },
    inclusions: [
      "Compras de ações, FIIs, ETFs, fundos e títulos de renda fixa",
      "Aportes e depósitos em contas de corretoras",
      "Subscrições e reinvestimentos de proventos",
    ],
    exclusions: [
      "Flutuação de mercado das cotas (rentabilidade não é aporte)",
      "Proventos creditados em conta que ainda não foram reaportados",
      "Resgates de investimento",
    ],
    notes: [
      "Os investimentos aumentam seu patrimônio líquido e não são considerados despesas de consumo.",
    ],
  };

  return enrichBreakdown(breakdown);
}
