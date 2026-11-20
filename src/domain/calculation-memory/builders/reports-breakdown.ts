/**
 * Builders de Memória de Cálculo para Relatórios Executivos e Balanço 360° (§F42 / AUD-06 / AUD-03).
 *
 * Módulo puro responsável por gerar a memória de cálculo do:
 *   1. Balanço Patrimonial 360° (Ativos Totais, Passivos Totais e Patrimônio Líquido Real);
 *   2. Grau de Liberdade Financeira (FIRE %) e Autonomia da Reserva de Emergência (Runway em meses).
 */

import { enrichBreakdown } from "../formatters";
import type { CalculationBreakdown, BreakdownStep } from "../types";
import type { ConsolidatedBalanceSheetResult } from "@/domain/reports/consolidated-balance";
import type { FreedomAnalysisResult } from "@/domain/reports/freedom-index";

export interface ReportsBreakdownOptions {
  periodLabel?: string;
}

/**
 * Converte valor em reais (float) para centavos inteiros protegidos contra imprecisão IEEE 754.
 */
function toCents(reais: number): number {
  return Math.round((Number.isFinite(reais) ? reais : 0) * 100);
}

/**
 * Monta o breakdown de cálculo para o Balanço Patrimonial Pessoal 360°.
 * Resolve AUD-06 integrando carteira de investimentos, saldos bancários, faturas de cartão e dívidas.
 */
export function buildBalanceSheet360Breakdown(
  balance: ConsolidatedBalanceSheetResult,
  options: ReportsBreakdownOptions = {},
): CalculationBreakdown {
  const investmentsCents = toCents(balance.totalInvestmentsBRL);
  const cashCents = toCents(balance.cashBalanceBRL);
  const receivablesCents = toCents(balance.receivablesBRL);
  const totalAssetsCents = toCents(balance.totalAssetsBRL);

  const debtsCents = toCents(balance.debtsPayableBRL);
  const invoicesCents = toCents(balance.creditCardInvoicesBRL);
  const totalLiabilitiesCents = toCents(balance.totalLiabilitiesBRL);
  const netWorthCents = toCents(balance.netWorthBRL);

  const steps: BreakdownStep[] = [
    {
      label: "Carteira de Investimentos sob Custódia",
      operator: "=",
      rawValue: investmentsCents,
      unit: "currency",
      hint: "Valor de mercado de ações, FIIs, renda fixa e ativos internacionais",
      tone: "portfolio",
    },
    {
      label: "Saldo em Caixa e Contas Bancárias",
      operator: "+",
      rawValue: cashCents,
      unit: "currency",
      hint: "Soma de saldo em conta corrente, reservas líquidas e caixa da corretora",
      tone: "positive",
    },
    ...(receivablesCents > 0
      ? [
          {
            label: "Contas e Valores a Receber Pendentes",
            operator: "+" as const,
            rawValue: receivablesCents,
            unit: "currency" as const,
            hint: "Créditos e empréstimos concedidos a terceiros a receber",
            tone: "positive" as const,
          },
        ]
      : []),
    {
      label: "Subtotal de Ativos Totais",
      operator: "=",
      rawValue: totalAssetsCents,
      unit: "currency",
      hint: "Patrimônio bruto total sob sua titularidade",
      tone: "default",
      emphasis: "subtotal",
    },
    {
      label: "Dívidas, Financiamentos e Empréstimos",
      operator: "-",
      rawValue: debtsCents,
      unit: "currency",
      hint: "Saldo devedor contratual de empréstimos e parcelamentos bancários",
      tone: "negative",
    },
    {
      label: "Faturas de Cartão de Crédito em Aberto",
      operator: "-",
      rawValue: invoicesCents,
      unit: "currency",
      hint: "Passivo circulante das faturas fechadas e compras em ciclo do cartão",
      tone: "negative",
    },
    {
      label: "Subtotal de Passivos Totais",
      operator: "=",
      rawValue: totalLiabilitiesCents,
      unit: "currency",
      hint: "Total de obrigações e pendências financeiras a liquidar",
      tone: "negative",
      emphasis: "subtotal",
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: "rep-balance-sheet-360",
    title: "Balanço Patrimonial 360°",
    description:
      "Demonstração contábil pessoal completa que consolida todos os ativos financeiros e bancários contra as obrigações e faturas abertas.",
    periodLabel: options.periodLabel ?? "Posição Atual",
    formulaExpression: "Patrimônio Líquido Real = (Investimentos + Caixa Bancário + Recebíveis) - (Dívidas + Faturas)",
    unit: "currency",
    steps,
    result: {
      label: "Patrimônio Líquido Real",
      rawValue: netWorthCents,
      unit: "currency",
      tone: netWorthCents >= 0 ? "positive" : "negative",
    },
    inclusions: [
      "Investimentos cotados a mercado sob custódia",
      "Saldos bancários em contas correntes e caixa da corretora",
      "Valores a receber e empréstimos concedidos",
    ],
    exclusions: [
      "Bens ilíquidos não precificados (veículos/imóveis sem avaliação contábil)",
      "Proventos previstos ainda não creditados",
    ],
    notes: [
      `Índice de Endividamento / Alavancagem: ${balance.debtToAssetRatioPct.toFixed(1)}% do total de ativos comprometido.`,
      "As faturas de cartão entram como passivo circulante para evitar patrimônio inflado.",
    ],
  };

  return enrichBreakdown(breakdown);
}

/**
 * Monta o breakdown de cálculo para o Grau de Liberdade Financeira (FIRE %) e Runway.
 * Resolve AUD-03 assegurando unidades e operadores corretos.
 */
export function buildFreedomIndexBreakdown(
  analysis: FreedomAnalysisResult,
  options: ReportsBreakdownOptions = {},
): CalculationBreakdown {
  const dividendsCents = toCents(analysis.monthlyDividendsBRL);
  const expensesCents = toCents(analysis.monthlyExpensesBRL);
  const reservesCents = toCents(analysis.liquidReservesBRL);
  const freedomPct = Math.round(analysis.freedomPct * 10) / 10;
  const runwayMonths = Math.round(analysis.runwayMonths * 10) / 10;

  const steps: BreakdownStep[] = [
    {
      label: "Renda Passiva Mensal (Proventos Médios)",
      operator: "=",
      rawValue: dividendsCents,
      unit: "currency",
      hint: "Média mensal de dividendos e rendimentos gerados pela carteira",
      tone: "positive",
    },
    {
      label: "Custo de Vida Mensal (Despesas)",
      operator: "/",
      rawValue: expensesCents,
      unit: "currency",
      hint: "Média ou total de despesas recorrentes do estilo de vida",
      tone: "default",
    },
    {
      label: "Grau de Independência Financeira (FIRE)",
      operator: "=",
      rawValue: freedomPct,
      unit: "percent",
      hint: "Fração do seu custo de vida integralmente paga por proventos passivos",
      tone: freedomPct >= 100 ? "positive" : "default",
    },
    {
      label: "Reservas Líquidas Totais",
      operator: "=",
      rawValue: reservesCents,
      unit: "currency",
      hint: "Reserva de emergência e ativos de liquidez imediata",
      tone: "positive",
    },
    {
      label: "Autonomia Financeira (Runway)",
      operator: "=",
      rawValue: runwayMonths,
      unit: "months",
      hint: "Tempo em meses que suas reservas sustentam seu custo de vida sem novas receitas",
      tone: runwayMonths >= 6 ? "positive" : "default",
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: "rep-freedom-index",
    title: "Liberdade Financeira & Runway",
    description:
      "Avalia a robustez da sua renda passiva frente às despesas mensais e a autonomia de sobrevivência das reservas financeiras.",
    periodLabel: options.periodLabel ?? "Período Analisado",
    formulaExpression: "Grau FIRE (%) = (Proventos Mensais / Despesas Mensais) * 100 | Runway = Reservas / Despesas",
    unit: "percent",
    steps,
    result: {
      label: "Grau de Liberdade Financeira",
      rawValue: freedomPct,
      unit: "percent",
      tone: freedomPct >= 100 ? "positive" : "default",
    },
    notes: [
      "100% de Grau FIRE significa que seus proventos passivos pagam integralmente seu custo de vida.",
      "O Runway considera exclusivamente ativos de alta liquidez e reserva de emergência.",
      `Estágio Atual: ${analysis.stageLabel}.`,
    ],
  };

  return enrichBreakdown(breakdown);
}
