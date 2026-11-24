/**
 * Construtores de Memória de Cálculo para Faturas e Limites de Cartões de Crédito.
 *
 * Módulo puro (Regra 3 do AGENTS.md e ESPECIFICAÇÃO §3.3.3):
 * - Decomposição de Fatura (gastos à vista, parcelas, estornos, crédito herdado e pagamentos);
 * - Limite de Cartão (limite total contratado, comprometido e disponível);
 * - Regras de transbordo e crédito para competência seguinte.
 */

import type { InvoiceChargesSummary } from "@/domain/cards/charges";
import { formatMonthYear } from "@/lib/date";
import { formatCentsAsCurrency } from "@/services/masks/money";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

// ---------------------------------------------------------------------------
// 1. Memória de Cálculo da Fatura do Cartão
// ---------------------------------------------------------------------------

export interface InvoiceBreakdownParams {
  cardName: string;
  month: string;
  previstoBrutoCents: number;
  previstoPonderadoCents?: number;
  principalRoladoRecebidoCents?: number;
  principalRoladoEnviadoCents?: number;
  pagoCents: number;
  estornoCents?: number;
  creditoAnteriorCents?: number;
  creditoRestanteCents?: number;
  saldoBrutoCents: number;
  saldoPonderadoCents?: number;
  regularExpensesCents?: number;
  installmentExpensesCents?: number;
  chargesSummary?: InvoiceChargesSummary;
}

export function buildInvoiceBreakdown(params: InvoiceBreakdownParams): CalculationBreakdown {
  const {
    cardName,
    month,
    previstoBrutoCents,
    principalRoladoRecebidoCents = 0,
    principalRoladoEnviadoCents = 0,
    pagoCents,
    estornoCents = 0,
    creditoAnteriorCents = 0,
    creditoRestanteCents = 0,
    saldoBrutoCents,
    regularExpensesCents,
    installmentExpensesCents,
    chargesSummary,
  } = params;

  const monthLabel = formatMonthYear(month);
  const steps: BreakdownStep[] = [];

  const hasItemizedExpenses =
    regularExpensesCents !== undefined &&
    installmentExpensesCents !== undefined &&
    regularExpensesCents + installmentExpensesCents === previstoBrutoCents;

  if (hasItemizedExpenses) {
    steps.push({
      label: "Compras do Mês à Vista (1x)",
      operator: "+",
      rawValue: regularExpensesCents,
      hint: "Despesas e compras avulsas realizadas no ciclo corrente da fatura",
      tone: "default",
    });

    if (installmentExpensesCents > 0) {
      steps.push({
        label: "Parcelas de Compras Anteriores",
        operator: "+",
        rawValue: installmentExpensesCents,
        hint: "Parcelas vincendas originadas em meses anteriores que caíram nesta fatura",
        tone: "default",
      });
    }
  } else if (chargesSummary && chargesSummary.hasCharges) {
    steps.push({
      label: "Consumo e Compras da Fatura",
      operator: "+",
      rawValue: chargesSummary.consumptionCents,
      hint: "Soma das compras e despesas de consumo realizadas no cartão",
      tone: "default",
    });

    if (chargesSummary.interestCents > 0) {
      steps.push({
        label: "Juros de Fatura",
        operator: "+",
        rawValue: chargesSummary.interestCents,
        hint: "Juros de rotativo, atraso ou refinanciamento",
        tone: "negative",
      });
    }

    if (chargesSummary.fineCents > 0) {
      steps.push({
        label: "Multa por Atraso",
        operator: "+",
        rawValue: chargesSummary.fineCents,
        hint: "Multa contratual decorrente de atraso",
        tone: "negative",
      });
    }

    if (chargesSummary.taxCents > 0) {
      steps.push({
        label: "IOF e Tributos",
        operator: "+",
        rawValue: chargesSummary.taxCents,
        hint: "Imposto sobre Operações Financeiras da fatura",
        tone: "negative",
      });
    }

    if (chargesSummary.bankFeeCents > 0) {
      steps.push({
        label: "Tarifas e Encargos Bancários",
        operator: "+",
        rawValue: chargesSummary.bankFeeCents,
        hint: "Anuidade ou tarifas de serviços bancários",
        tone: "negative",
      });
    }
  } else {
    steps.push({
      label: "Total de Compras e Despesas Lançadas",
      operator: undefined,
      rawValue: previstoBrutoCents,
      hint: "Soma de todas as transações, compras e parcelas lançadas na competência",
      tone: "default",
    });
  }

  if (principalRoladoRecebidoCents > 0) {
    steps.push({
      label: "Saldo anterior (rotativo/parcelamento)",
      operator: "+",
      rawValue: principalRoladoRecebidoCents,
      hint: "Principal transferido de faturas anteriores vencidas ou parceladas",
      tone: "negative",
    });
  }

  if (creditoAnteriorCents > 0) {
    steps.push({
      label: "Crédito Herdado da Fatura Anterior",
      operator: "-",
      rawValue: creditoAnteriorCents,
      hint: "Saldo credor decorrente de pagamentos a maior ou estornos do mês anterior",
      tone: "positive",
    });
  }

  if (estornoCents > 0) {
    steps.push({
      label: "Estornos e Cancelamentos Creditados",
      operator: "-",
      rawValue: estornoCents,
      hint: "Valores ressarcidos e devoluções processadas na fatura",
      tone: "positive",
    });
  }

  if (pagoCents > 0) {
    steps.push({
      label: "Pagamentos Efetuados",
      operator: "-",
      rawValue: pagoCents,
      hint: "Valores pagos pelo titular para liquidação total ou parcial da fatura",
      tone: "positive",
    });
  }

  if (principalRoladoEnviadoCents > 0) {
    steps.push({
      label: "Saldo rolado para próxima fatura",
      operator: "-",
      rawValue: principalRoladoEnviadoCents,
      hint: "Principal transferido para competência posterior via rotativo ou parcelamento",
      tone: "positive",
    });
  }

  const notes: string[] = [];
  if (principalRoladoEnviadoCents > 0 && saldoBrutoCents === 0) {
    notes.push(
      "Fatura Rolada: O saldo residual foi transferido para competência posterior via rotativo ou parcelamento.",
    );
  } else if (creditoRestanteCents > 0) {
    notes.push(
      `Crédito Transbordado: Os pagamentos e estornos superaram as compras desta fatura. O crédito restante será abatido automaticamente na fatura seguinte.`,
    );
  } else if (saldoBrutoCents === 0 && previstoBrutoCents + principalRoladoRecebidoCents > 0) {
    notes.push("Fatura Quitada: Todos os lançamentos desta competência foram totalmente liquidados.");
  }

  notes.push(
    "Regra Antiduplicidade (§3.3.3): O pagamento da fatura transfere liquidez bancária sem duplicar despesas individuais na DRE.",
  );

  if (chargesSummary && chargesSummary.hasCharges) {
    notes.push(
      `Composição de Encargos: A fatura inclui ${chargesSummary.chargesPercentage.toFixed(1)}% em encargos financeiros (${formatCentsAsCurrency(chargesSummary.totalChargesCents)}).`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: `card-invoice-${cardName.toLowerCase().replace(/\s+/g, "-")}-${month}`,
    title: `Fatura de ${cardName}`,
    description: `Detalhamento aritmético de compras, créditos, pagamentos e saldo aberto da fatura de ${monthLabel}.`,
    periodLabel: monthLabel,
    formulaExpression:
      "Compras da Fatura − Crédito Anterior − Estornos − Pagamentos Efetuados",
    unit: "currency",
    steps,
    result: {
      label: saldoBrutoCents > 0 ? "Saldo Aberto da Fatura" : "Fatura Paga / Zerada",
      rawValue: saldoBrutoCents,
      unit: "currency",
      tone: saldoBrutoCents > 0 ? "negative" : "positive",
      hint:
        saldoBrutoCents > 0
          ? `Valor líquido a pagar até o vencimento da fatura.`
          : "Fatura sem pendências financeiras em aberto.",
    },
    inclusions: [
      "Compras à vista (1x) efetuadas dentro do período de faturamento",
      "Parcelas de compras anteriores (2x a 60x) com vencimento nesta competência",
      "Assinaturas e débitos automáticos cadastrados no cartão",
      ...(chargesSummary?.hasCharges ? ["Encargos financeiros e tarifas lançadas na fatura"] : []),
    ],
    exclusions: [
      "Parcelas futuras que vencem em competências posteriores (não compõem o saldo deste mês)",
      "Pagamentos de faturas duplicados",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 2. Memória de Cálculo do Limite do Cartão
// ---------------------------------------------------------------------------

export interface CardLimitBreakdownParams {
  cardName: string;
  totalLimitCents: number;
  usedLimitCents: number;
  availableLimitCents: number;
  usagePercentage: number;
}

export function buildCardLimitBreakdown(params: CardLimitBreakdownParams): CalculationBreakdown {
  const { cardName, totalLimitCents, usedLimitCents, availableLimitCents, usagePercentage } = params;

  const steps: BreakdownStep[] = [
    {
      label: "Limite Total Contratado",
      operator: undefined,
      rawValue: totalLimitCents,
      hint: "Limite de crédito operacional concedido pelo emissor do cartão",
      tone: "default",
    },
    {
      label: "Limite Comprometido (Faturas Abertas + Parcelas Futuras)",
      operator: "-",
      rawValue: usedLimitCents,
      hint: "Total de compras pendentes de pagamento que consom a linha de crédito",
      tone: "negative",
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: `card-limit-${cardName.toLowerCase().replace(/\s+/g, "-")}`,
    title: `Limite do Cartão (${cardName})`,
    description:
      "Capacidade de crédito disponível para novas compras após deduzir os gastos abertos e parcelamentos futuros.",
    formulaExpression: "Limite Total Contratado − Limite Comprometido",
    unit: "currency",
    steps,
    result: {
      label: "Limite Disponível Imediato",
      rawValue: availableLimitCents,
      unit: "currency",
      tone: availableLimitCents > 0 ? "positive" : "negative",
      hint: `Você está utilizando ${usagePercentage}% do limite total deste cartão.`,
    },
    inclusions: [
      "Fatura corrente em aberto",
      "Todas as parcelas futuras já contratadas e ainda não faturadas",
    ],
    exclusions: [
      "Faturas anteriores já totalmente pagas e liquidadas (já liberaram limite)",
    ],
    notes: [
      "Recomposição de Limite: Pagamentos efetuados restabelecem o limite disponível de forma imediata ou após a compensação bancária.",
    ],
  };

  return enrichBreakdown(breakdown);
}
