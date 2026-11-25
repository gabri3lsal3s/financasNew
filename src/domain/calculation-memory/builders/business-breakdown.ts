/**
 * Builders de Memória de Cálculo para o Modo Negócio (Regra 33 — Fase 2B).
 *
 * Módulo 100% puro: zero dependências de React/DOM/Supabase.
 */

import { formatPercent } from "@/services/masks/percent";
import type { BusinessDreResult } from "@/domain/business/dre-calculator";
import type { TaxShieldResult } from "@/domain/business/tax-shield";
import type { MeiAnnualLimitResult } from "@/domain/business/mei-limit";
import type { BusinessBreakEvenResult } from "@/domain/business/break-even";
import type { DerivedBusinessCashComponents } from "@/domain/business/derived-cash";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

export function buildBusinessDreBreakdown(
  dre: BusinessDreResult,
  periodLabel = "Mês Atual",
): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: "Receita Bruta do Negócio",
      operator: "+",
      rawValue: dre.grossRevenueCents,
      unit: "currency",
      hint: "Entradas com escopo Profissional (excluindo transferências internas Pessoal/Profissional)",
      tone: "positive",
    },
    {
      label: "Custos Operacionais Ponderados",
      operator: "-",
      rawValue: dre.operationalCostsCents,
      unit: "currency",
      hint: "Inclui despesas operacionais e IOF/encargos de cartão profissional, respeitando report_weight",
      tone: "negative",
    },
    {
      label: "Lucro Operacional",
      operator: "=",
      rawValue: dre.operationalProfitCents,
      unit: "currency",
      tone: dre.operationalProfitCents >= 0 ? "positive" : "negative",
      emphasis: "subtotal",
    },
    {
      label: "Impostos Fiscais Pagos (DAS / Carnê-Leão / ISS)",
      operator: "-",
      rawValue: dre.fiscalTaxesPaidCents,
      unit: "currency",
      hint: "Despesas fiscais fora do cartão de crédito (IOF de cartão não entra aqui)",
      tone: "negative",
    },
    {
      label: "Retiradas de Pró-Labore (Profissional para Pessoal)",
      operator: "-",
      rawValue: dre.proLaboreWithdrawnCents,
      unit: "currency",
      hint: "Transferências internas pareadas de remuneração do titular",
      tone: "muted",
    },
  ];

  return enrichBreakdown({
    id: "business-dre-retained",
    title: "DRE Simplificado e Lucro Retido Profissional",
    description:
      "Demonstra o resultado real da operação do negócio separado das retiradas pessoais do titular.",
    periodLabel,
    formulaExpression:
      "Lucro Retido = Receita Bruta - Custos Operacionais - Impostos Fiscais - Pró-Labore",
    unit: "currency",
    steps,
    result: {
      label: "Lucro Retido no Caixa Profissional",
      rawValue: dre.retainedEarningsCents,
      unit: "currency",
      tone: dre.retainedEarningsCents >= 0 ? "positive" : "negative",
      hint: `Margem líquida após impostos: ${formatPercent(dre.marginPct, 1)}`,
    },
    notes: [
      "Valores a receber pendentes não integram a receita realizada até o efetivo recebimento.",
      "Reembolsos de cartão misto e aportes pessoais não inflam nem reduzem o resultado do DRE.",
    ],
  });
}

export function buildTaxShieldBreakdown(
  shield: TaxShieldResult,
  options: {
    profileLabel: string;
    grossRevenueCents: number;
    periodLabel?: string;
  },
): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: `Provisão Tributária Estimada (${options.profileLabel})`,
      operator: "=",
      rawValue: shield.estimatedTaxCents,
      unit: "currency",
      hint: "Estimativa calculada sobre a guia DAS fixa (MEI) ou alíquota parametrizada",
      tone: "default",
    },
    {
      label: "Impostos Fiscais Já Quitados no Mês",
      operator: "-",
      rawValue: shield.paidFiscalTaxesCents,
      unit: "currency",
      hint: "Apenas guias fiscais sem vínculo com cartão de crédito",
      tone: "positive",
    },
  ];

  return enrichBreakdown({
    id: "business-tax-shield",
    title: "Escudo Tributário Líquido",
    description:
      "Valor recomendado para manter reservado no negócio até a quitação integral dos impostos do mês.",
    periodLabel: options.periodLabel ?? "Mês Atual",
    formulaExpression: "Reserva Restante = max(0, Imposto Estimado - Impostos Fiscais Pagos)",
    unit: "currency",
    steps,
    result: {
      label: "Provisão Líquida a Reservar",
      rawValue: shield.netProvisionRemainingCents,
      unit: "currency",
      tone: shield.netProvisionRemainingCents === 0 ? "positive" : "default",
      hint: `Cobertura fiscal atual: ${formatPercent(shield.coveragePct, 1)}`,
    },
    notes: [
      "Encargos financeiros de cartão (IOF) jamais abatem a provisão devida ao Fisco.",
    ],
  });
}

export function buildMeiCeilingBreakdown(
  mei: MeiAnnualLimitResult,
  yearLabel: string,
): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: "Faturamento Bruto Recebido no Ano",
      operator: "+",
      rawValue: mei.annualGrossRevenueCents,
      unit: "currency",
      hint: "Soma de todas as receitas de negócio (excluindo aportes e transferências internas)",
      tone: "positive",
    },
    {
      label: "Teto Anual MEI Configurado",
      operator: "=",
      rawValue: mei.annualCeilingCents,
      unit: "currency",
      hint: "Limite padrão vigente ou parametrizado nas configurações do perfil",
      tone: "default",
    },
    {
      label: "Folga Anual Restante",
      operator: "=",
      rawValue: mei.remainingCents,
      unit: "currency",
      hint: `Ritmo médio seguro para os próximos ${mei.remainingMonths} mês(es)`,
      tone: mei.remainingCents > 0 ? "positive" : "negative",
    },
  ];

  return enrichBreakdown({
    id: "business-mei-ceiling",
    title: "Termômetro do Teto Anual MEI",
    description:
      "Acompanha a utilização acumulada do limite anual de faturamento bruto para evitar desenquadramento inesperado.",
    periodLabel: `Exercício ${yearLabel}`,
    formulaExpression: "Uso (%) = (Faturamento Bruto Anual / Teto Anual MEI) x 100",
    unit: "percent",
    steps,
    result: {
      label: "Utilização do Teto Anual",
      rawValue: mei.usagePct,
      unit: "percent",
      tone: mei.usagePct >= 100 ? "negative" : "default",
      hint: `Limite de tolerância (120%) equivale ao desenquadramento retroativo.`,
    },
  });
}

export function buildBreakEvenBreakdown(
  be: BusinessBreakEvenResult,
  options: {
    operationalCostsCents: number;
    estimatedTaxCents: number;
    targetProLaboreCents: number;
    periodLabel?: string;
  },
): CalculationBreakdown {
  const isMargin = be.calculationMethod === "contribution_margin";

  const steps: BreakdownStep[] = isMargin
    ? [
        {
          label: "Custos Operacionais Necessários",
          operator: "+",
          rawValue: options.operationalCostsCents,
          unit: "currency",
          tone: "default",
        },
        {
          label: "Meta Mensal de Pró-Labore",
          operator: "+",
          rawValue: options.targetProLaboreCents,
          unit: "currency",
          tone: "default",
        },
        {
          label: "Margem de Contribuição Efetiva",
          operator: "/",
          rawValue: Number((be.contributionMarginRatio * 100).toFixed(1)),
          unit: "percent",
          hint: "Margem líquida após deduzir impostos proporcionais da receita",
          tone: "positive",
        },
      ]
    : [
        {
          label: "Custos Operacionais do Mês",
          operator: "+",
          rawValue: options.operationalCostsCents,
          unit: "currency",
          tone: "default",
        },
        {
          label: "Provisão Fiscal Estimada",
          operator: "+",
          rawValue: options.estimatedTaxCents,
          unit: "currency",
          tone: "default",
        },
        {
          label: "Meta Mensal de Pró-Labore",
          operator: "+",
          rawValue: options.targetProLaboreCents,
          unit: "currency",
          tone: "default",
        },
      ];

  return enrichBreakdown({
    id: "business-break-even",
    title: "Ponto de Equilíbrio Mensal",
    description:
      "Faturamento mínimo necessário no mês para cobrir a operação, tributos e sua retirada pessoal planejada.",
    periodLabel: options.periodLabel ?? "Mês Atual",
    formulaExpression: isMargin
      ? "Ponto de Equilíbrio = (Custos + Pró-Labore) / Margem de Contribuição"
      : "Ponto de Equilíbrio = Custos Operacionais + Provisão Fiscal + Meta Pró-Labore",
    unit: "currency",
    steps,
    result: {
      label: "Meta Mínima de Faturamento",
      rawValue: be.breakEvenTargetCents,
      unit: "currency",
      tone: be.isReached ? "positive" : "default",
      hint: be.isReached
        ? `Ponto de equilíbrio atingido (${formatPercent(be.progressPct, 1)}).`
        : `Faltam ${formatPercent(Math.max(0, 100 - be.progressPct), 1)} da meta.`,
    },
    notes: [be.explanation],
  });
}

export function buildDerivedCashBreakdown(
  components: DerivedBusinessCashComponents,
  periodLabel = "Posição Atual",
): CalculationBreakdown {
  const steps: BreakdownStep[] = [
    {
      label: "Saldo Inicial do Negócio",
      operator: "+",
      rawValue: components.openingBalanceCents,
      unit: "currency",
      hint: "Saldo inicial informado na configuração do perfil do negócio",
      tone: "default",
    },
    {
      label: "Aportes de Capital (Pessoal para Profissional)",
      operator: "+",
      rawValue: components.capitalInjectionsCents,
      unit: "currency",
      hint: "Dinheiro pessoal injetado para capital de giro (não infla receita de vendas)",
      tone: "positive",
    },
    {
      label: "Receita Líquida Recebida",
      operator: "+",
      rawValue: components.netRevenueReceivedCents,
      unit: "currency",
      hint: components.taxWithheldCents > 0
        ? `Receita bruta de vendas menos impostos retidos na fonte (IRRF/ISS)`
        : "Entradas operacionais do negócio recebidas no período",
      tone: "positive",
    },
    {
      label: "Despesas Operacionais Pagas em Conta/Pix/Débito",
      operator: "-",
      rawValue: components.cashExpensesCents,
      unit: "currency",
      hint: "Compras no cartão de crédito não saem aqui (saem no reembolso da fatura)",
      tone: "negative",
    },
    {
      label: "Retiradas de Pró-Labore (Profissional para Pessoal)",
      operator: "-",
      rawValue: components.proLaboreWithdrawnCents,
      unit: "currency",
      hint: "Transferências internas de remuneração do titular",
      tone: "muted",
    },
    {
      label: "Reembolsos de Cartão Pessoal Efetivados",
      operator: "-",
      rawValue: components.cardReimbursementsPaidCents,
      unit: "currency",
      hint: "Pagamento do negócio para ressarcir despesas operacionais pagas no cartão pessoal",
      tone: "negative",
    },
  ];

  return enrichBreakdown({
    id: "business-derived-cash",
    title: "Caixa Operacional Derivado do Negócio",
    description:
      "Apurado automaticamente pelo fluxo financeiro profissional sem exigir conta bancária separada.",
    periodLabel,
    formulaExpression:
      "Caixa = Saldo Inicial + Aportes + Receitas Líquidas - Despesas Conta/Pix - Pró-Labore - Reembolsos",
    unit: "currency",
    steps,
    result: {
      label: "Caixa Operacional Disponível",
      rawValue: components.derivedCashBalanceCents,
      unit: "currency",
      tone: components.derivedCashBalanceCents >= 0 ? "portfolio" : "negative",
      hint: "Saldo financeiro real pertencente à operação do negócio",
    },
    notes: [
      "Compras operacionais feitas em cartão de crédito pessoal só saem do caixa no momento do Reembolso.",
      "Em contas bancárias compartilhadas, este valor é protegido e abatido do seu Safe-to-Spend pessoal.",
    ],
  });
}
