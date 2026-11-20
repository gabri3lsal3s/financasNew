/**
 * Construtores de Memória de Cálculo para Dívidas, Encargos de Mora e Empréstimos.
 *
 * Módulo puro (Regra 3 do AGENTS.md e ESPECIFICAÇÃO §3.4 e Módulo 5):
 * - Resumo de Pendências (A pagar vs A receber e Saldo Líquido);
 * - Encargos Moratórios de Quitação (Multa 2% CDC, Juros 1% a.m. pro-rata e descontos);
 * - Parcelas de Financiamento/Empréstimo (Amortização vs Juros no sistema Price ou SAC).
 */

import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";
import type { AmortizationSystem } from "@/types";

// ---------------------------------------------------------------------------
// 1. Resumo Geral de Contas & Dívidas
// ---------------------------------------------------------------------------

export interface DebtsSummaryBreakdownParams {
  payablePendingCents: number;
  receivablePendingCents: number;
  netPendingCents: number;
  pendingCount: number;
  paidCount?: number;
}

export function buildDebtsSummaryBreakdown(
  params: DebtsSummaryBreakdownParams,
): CalculationBreakdown {
  const { payablePendingCents, receivablePendingCents, netPendingCents, pendingCount, paidCount = 0 } = params;
  const isSurplus = netPendingCents >= 0;

  const steps: BreakdownStep[] = [
    {
      label: "Valores a Receber Pendentes",
      operator: "+",
      rawValue: receivablePendingCents,
      hint: "Haveres, promissórias e créditos a receber de terceiros",
      tone: "positive",
      actionLink: {
        to: "/dividas?tab=receivable",
        label: "Ver a receber",
      },
    },
    {
      label: "Contas e Dívidas a Pagar Pendentes",
      operator: "-",
      rawValue: payablePendingCents,
      hint: "Boletos, compromissos fixos e dívidas pendentes de liquidação",
      tone: "negative",
      actionLink: {
        to: "/dividas?tab=payable",
        label: "Ver a pagar",
      },
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: "debts-summary-net",
    title: "Saldo Líquido de Pendências",
    description:
      "Diferença consolidada entre os valores que você tem a receber e os compromissos que tem a pagar.",
    formulaExpression: "Valores a Receber − Contas a Pagar",
    unit: "currency",
    steps,
    result: {
      label: isSurplus ? "Superávit Líquido a Receber" : "Déficit Líquido a Pagar",
      rawValue: netPendingCents,
      unit: "currency",
      tone: isSurplus ? "positive" : "negative",
      hint: isSurplus
        ? "Seus créditos a receber superam os compromissos a pagar pendentes."
        : "Você tem mais obrigações a pagar do que recebíveis previstos.",
    },
    inclusions: [
      "Todas as contas a pagar com status pendente, vence em breve ou vencida",
      "Todos os recebíveis em aberto com terceiros",
    ],
    exclusions: [
      "Contas e títulos já quitados e marcados como pagos",
      "Faturas de cartão de crédito (gerenciadas na seção de Cartões)",
    ],
    notes: [
      `Volume de Itens: ${pendingCount} obrigações pendentes no momento e ${paidCount} já liquidadas no histórico.`,
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 2. Encargos Moratórios de Quitação de Dívida (CDC & Código Civil)
// ---------------------------------------------------------------------------

export interface OverdueDebtChargesBreakdownParams {
  debtName: string;
  originalAmountCents: number;
  daysOverdue: number;
  fineCents: number;
  finePercent?: number;
  interestCents: number;
  monthlyInterestPercent?: number;
  discountCents?: number;
  totalPaidCents: number;
}

export function buildOverdueDebtChargesBreakdown(
  params: OverdueDebtChargesBreakdownParams,
): CalculationBreakdown {
  const {
    debtName,
    originalAmountCents,
    daysOverdue,
    fineCents,
    finePercent = 2,
    interestCents,
    monthlyInterestPercent = 1,
    discountCents = 0,
    totalPaidCents,
  } = params;

  const steps: BreakdownStep[] = [
    {
      label: "Valor Principal Original",
      operator: undefined,
      rawValue: originalAmountCents,
      hint: "Valor nominal original da dívida no vencimento",
      tone: "default",
    },
  ];

  if (fineCents > 0) {
    steps.push({
      label: `Multa Moratória (${finePercent}% - Limite CDC)`,
      operator: "+",
      rawValue: fineCents,
      hint: `Penalidade de mora conforme Art. 52 § 1º do Código de Defesa do Consumidor`,
      tone: "negative",
    });
  }

  if (interestCents > 0) {
    steps.push({
      label: `Juros Moratórios Pro-Rata (${daysOverdue} dias a ${monthlyInterestPercent}% a.m.)`,
      operator: "+",
      rawValue: interestCents,
      hint: `Juros legais de mora conforme Art. 406 do Código Civil (~${(monthlyInterestPercent / 30).toFixed(3)}% ao dia)`,
      tone: "negative",
    });
  }

  if (discountCents > 0) {
    steps.push({
      label: "Desconto / Abatimento Concedido",
      operator: "-",
      rawValue: discountCents,
      hint: "Abatimento negociado para liquidação do título",
      tone: "positive",
    });
  }

  const breakdown: CalculationBreakdown = {
    id: `debt-charges-${debtName.toLowerCase().replace(/\s+/g, "-")}`,
    title: `Quitação de ${debtName}`,
    description: `Demonstrativo de encargos contratuais e moratórios calculados para quitação com ${daysOverdue} dias de atraso.`,
    formulaExpression:
      "Valor Original + Multa Moratória + Juros Pro-Rata − Descontos",
    unit: "currency",
    steps,
    result: {
      label: "Valor Atualizado para Quitação",
      rawValue: totalPaidCents,
      unit: "currency",
      tone: "negative",
      hint: `Valor total necessário para a liquidação imediata da dívida em atraso.`,
    },
    inclusions: [
      "Valor de face original do boleto ou contrato",
      "Multa moratória contratual respeitando o teto de 2% do CDC",
      "Juros legais pro-rata die correspondentes aos dias de atraso",
    ],
    exclusions: [
      "Honorários advocatícios judiciais (salvo se expressamente acordados)",
    ],
    notes: [
      "Governança Legal: A fórmula adota estritamente os parâmetros do CDC (Art. 52 § 1º) e Código Civil (Art. 406).",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 3. Decomposição de Parcela de Empréstimo (Tabela Price vs SAC)
// ---------------------------------------------------------------------------

export interface LoanInstallmentBreakdownParams {
  loanName: string;
  installmentNumber: number;
  totalInstallments: number;
  system: AmortizationSystem;
  principalAmortizationCents: number;
  interestCents: number;
  totalInstallmentCents: number;
  remainingBalanceCents: number;
  monthlyRatePercent: number;
}

export function buildLoanInstallmentBreakdown(
  params: LoanInstallmentBreakdownParams,
): CalculationBreakdown {
  const {
    loanName,
    installmentNumber,
    totalInstallments,
    system,
    principalAmortizationCents,
    interestCents,
    totalInstallmentCents,
    remainingBalanceCents,
    monthlyRatePercent,
  } = params;

  const isPrice = system === "price";
  const systemName = isPrice ? "Tabela Price" : system === "sac" ? "Tabela SAC" : "Valor Fixo";

  const steps: BreakdownStep[] = [
    {
      label: "Amortização do Saldo Devedor (Principal)",
      operator: "+",
      rawValue: principalAmortizationCents,
      hint: isPrice
        ? "Parcela que efetivamente reduz a dívida (crescente a cada mês na Tabela Price)"
        : "Amortização constante do principal (fixa em todo o contrato no SAC)",
      tone: "portfolio",
    },
    {
      label: `Juros do Período (${monthlyRatePercent}% a.m. sobre Saldo Devedor)`,
      operator: "+",
      rawValue: interestCents,
      hint: "Custo do capital emprestado calculado sobre o saldo restante anterior",
      tone: "negative",
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: `loan-inst-${loanName.toLowerCase().replace(/\s+/g, "-")}-${installmentNumber}`,
    title: `Parcela ${installmentNumber}/${totalInstallments} de ${loanName}`,
    description: `Decomposição da parcela no sistema ${systemName} entre amortização de capital e remuneração de juros.`,
    periodLabel: `Parcela ${installmentNumber} de ${totalInstallments}`,
    formulaExpression: "Amortização do Principal + Juros sobre o Saldo Devedor",
    unit: "currency",
    steps,
    result: {
      label: "Valor Total da Parcela",
      rawValue: totalInstallmentCents,
      unit: "currency",
      tone: "negative",
      hint: `Após o pagamento desta parcela, o saldo devedor restante será atualizado.`,
    },
    inclusions: [
      "Amortização líquida do saldo devedor",
      `Encargos financeiros e juros remuneratórios à taxa de ${monthlyRatePercent}% a.m.`,
    ],
    exclusions: [
      "Taxas de abertura de crédito (TAC/IOF) se não financiadas na parcela",
      "Seguros adicionais (prestamista/MIP) se discriminados à parte",
    ],
    notes: [
      isPrice
        ? "Tabela Price: As parcelas são fixas, com a cota de juros diminuindo e a cota de amortização aumentando a cada mês."
        : "Tabela SAC: A amortização é constante, fazendo com que as parcelas sejam decrescentes ao longo do contrato.",
      `Saldo Devedor Residual: O pagamento desta parcela deixa R$ ${(remainingBalanceCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} de saldo principal pendente.`,
    ],
  };

  return enrichBreakdown(breakdown);
}
