/**
 * Motor Puro de Ponto de Equilíbrio do Negócio (Break-Even — Fase 1 / v2.1).
 *
 * Responsável por:
 *   • Calcular o Ponto de Equilíbrio Operacional (empresa não quebra);
 *   • Calcular o Ponto de Equilíbrio Digno/Total (cobre custos + pró-labore da família);
 *   • Apurar Margem de Contribuição Percentual (MC%);
 *   • Aplicar Fallback Aditivo Blindado quando Receita Líquida <= 0 ou MC% <= 5%,
 *     garantindo zero divisões por zero, zero NaN e justificativa clara na UI.
 *
 * 100% puro — testável isoladamente sem Supabase ou dependências de UI.
 */

export type BreakEvenCalculationMethod = "contribution_margin" | "additive_fallback";

export interface BusinessBreakEvenResult {
  /** Meta total de faturamento mensal necessária para cobrir operação + pró-labore (em centavos). */
  breakEvenTargetCents: number;
  /** Meta estrita para cobrir apenas a operação sem pró-labore (em centavos). */
  operationalBreakEvenCents: number;
  /** Faturamento bruto realizado no período (em centavos). */
  grossRevenueCents: number;
  /** Percentual de atingimento da meta de faturamento (0 a 100+). */
  progressPct: number;
  /** Valor que ainda falta faturar para atingir o equilíbrio (em centavos). */
  remainingCents: number;
  /** Superávit financeiro acima do ponto de equilíbrio (em centavos). */
  surplusAboveBreakEvenCents: number;
  /** Indica se a meta total com pró-labore foi alcançada. */
  isReached: boolean;
  /** Margem de contribuição apurada (0 a 1). */
  contributionMarginRatio: number;
  /** Método de cálculo empregado. */
  calculationMethod: BreakEvenCalculationMethod;
  /** Justificativa didática para exibição na Memória de Cálculo. */
  explanation: string;
}

export interface CalculateBusinessBreakEvenParams {
  /** Total de custos operacionais (ou soma de custos se fixos/variáveis não forem destacados). */
  operationalCostsCents: number;
  /** Imposto fiscal estimado ou pago no período (em centavos). */
  estimatedTaxCents: number;
  /** Meta de retirada de pró-labore do empreendedor para sustentar a casa (em centavos). */
  targetProLaboreCents: number;
  /** Faturamento bruto realizado no período (em centavos). */
  grossRevenueCents: number;
  /** Custos fixos operacionais destacados (aluguel, software, contabilidade). Opcional. */
  fixedCostsCents?: number;
  /** Custos variáveis operacionais destacados (mercadorias, insumos, frete). Opcional. */
  variableCostsCents?: number;
}

export const BREAK_EVEN_MIN_MC_THRESHOLD = 0.05; // 5%

export const BREAK_EVEN_FALLBACK_REASON =
  "Como a receita do período é incipiente ou a margem percentual é baixa/negativa (<= 5%), o ponto de equilíbrio foi apurado pelo método aditivo direto dos custos e pró-labore necessários.";

export const BREAK_EVEN_MARGIN_EXPLANATION =
  "Ponto de equilíbrio calculado pela margem de contribuição: divide os custos fixos e pró-labore pela margem percentual gerada por cada real faturado.";

export function calculateBusinessBreakEven(
  params: CalculateBusinessBreakEvenParams,
): BusinessBreakEvenResult {
  const operationalCosts = Math.max(0, Math.round(params.operationalCostsCents));
  const taxes = Math.max(0, Math.round(params.estimatedTaxCents));
  const proLabore = Math.max(0, Math.round(params.targetProLaboreCents));
  const gross = Math.max(0, Math.round(params.grossRevenueCents));

  // Desagrega custos fixos e variáveis se informados; caso contrário, assume custos como fixos
  const fixedCosts = params.fixedCostsCents !== undefined
    ? Math.max(0, Math.round(params.fixedCostsCents))
    : operationalCosts;
  const variableCosts = params.variableCostsCents !== undefined
    ? Math.max(0, Math.round(params.variableCostsCents))
    : 0;

  const netRevenueCents = Math.max(0, gross - taxes);
  const contributionMarginCents = netRevenueCents - variableCosts;
  const contributionMarginRatio =
    netRevenueCents > 0
      ? Number((contributionMarginCents / netRevenueCents).toFixed(4))
      : 0;

  let calculationMethod: BreakEvenCalculationMethod = "contribution_margin";
  let explanation = BREAK_EVEN_MARGIN_EXPLANATION;
  let operationalBreakEvenCents: number;
  let breakEvenTargetCents: number;

  // Fallback aditivo blindado se receita <= 0 ou MC% <= 5% (evita divisão por zero e metas negativas)
  if (netRevenueCents <= 0 || contributionMarginRatio <= BREAK_EVEN_MIN_MC_THRESHOLD) {
    calculationMethod = "additive_fallback";
    explanation = BREAK_EVEN_FALLBACK_REASON;
    operationalBreakEvenCents = fixedCosts + variableCosts + taxes;
    breakEvenTargetCents = operationalBreakEvenCents + proLabore;
  } else {
    // Método clássico ponderado por margem de contribuição
    operationalBreakEvenCents = Math.round(fixedCosts / contributionMarginRatio);
    breakEvenTargetCents = Math.round((fixedCosts + proLabore) / contributionMarginRatio);
  }

  const remainingCents = Math.max(0, breakEvenTargetCents - gross);
  const surplusAboveBreakEvenCents = Math.max(0, gross - breakEvenTargetCents);
  const progressPct =
    breakEvenTargetCents > 0
      ? Number(((gross / breakEvenTargetCents) * 100).toFixed(1))
      : gross > 0
        ? 100
        : 0;

  return {
    breakEvenTargetCents,
    operationalBreakEvenCents,
    grossRevenueCents: gross,
    progressPct,
    remainingCents,
    surplusAboveBreakEvenCents,
    isReached: breakEvenTargetCents > 0 ? gross >= breakEvenTargetCents : gross > 0,
    contributionMarginRatio,
    calculationMethod,
    explanation,
  };
}
