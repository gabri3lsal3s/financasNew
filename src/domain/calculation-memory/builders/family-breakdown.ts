/**
 * Builders de Memória de Cálculo para o Modo Família (§F35 / AUD-07 / Melhoria 8).
 *
 * Módulo puro responsável por gerar a memória de cálculo do:
 *   1. Acerto de Contas e Compensação Familiar (Total Pago - Cota Justa = Saldo via Pix);
 *   2. Teto de Gastos Familiar e Consumo Conjunto.
 */

import { enrichBreakdown } from "../formatters";
import type { CalculationBreakdown, BreakdownStep } from "../types";

export interface FamilySettlementMemberData {
  userId: string;
  displayName: string;
  spentCents: number;
  fairShareCents: number;
  netBalanceCents: number;
  mustPayCents?: number;
  mustReceiveCents?: number;
}

export interface FamilySettlementBreakdownOptions {
  householdTotalSpentCents?: number;
  splitRuleDescription?: string;
  periodLabel?: string;
}

/**
 * Monta o breakdown de cálculo para o acerto de contas individual de um membro da família.
 * Resolve AUD-07 explicando exatamente por que o usuário deve ou tem a receber determinado valor.
 */
export function buildFamilySettlementBreakdown(
  member: FamilySettlementMemberData,
  options: FamilySettlementBreakdownOptions = {},
): CalculationBreakdown {
  const {
    householdTotalSpentCents = member.spentCents + (member.fairShareCents > member.spentCents ? member.fairShareCents - member.spentCents : 0),
    splitRuleDescription = "Divisão 50/50 ou proporcional à renda",
    periodLabel = "Mês de Referência",
  } = options;

  const isCreditor = member.netBalanceCents > 0;
  const isDebtor = member.netBalanceCents < 0;
  const absBalance = Math.abs(member.netBalanceCents);

  const steps: BreakdownStep[] = [
    {
      label: "Total de Despesas Conjuntas da Casa",
      operator: "=",
      rawValue: householdTotalSpentCents,
      unit: "currency",
      hint: "Soma de todas as despesas compartilhadas aprovadas da família",
      tone: "default",
    },
    {
      label: `Total Desembolsado por ${member.displayName}`,
      operator: "+",
      rawValue: member.spentCents,
      unit: "currency",
      hint: "Gastos efetivamente pagos do próprio bolso por este membro",
      tone: "positive",
    },
    {
      label: "Cota Justa Devida pelo Membro",
      operator: "-",
      rawValue: member.fairShareCents,
      unit: "currency",
      hint: `Participação calculada sob a regra: ${splitRuleDescription}`,
      tone: "negative",
    },
    {
      label: isCreditor
        ? "Saldo Líquido a Receber da Casa"
        : isDebtor
          ? "Saldo Líquido a Pagar à Casa"
          : "Saldo Perfeitamente Equilibrado",
      operator: "=",
      rawValue: absBalance,
      unit: "currency",
      hint: isCreditor
        ? "Desembolsou mais do que sua cota; deve ser reembolsado via Pix"
        : isDebtor
          ? "Desembolsou menos do que sua cota; deve transferir via Pix"
          : "Contribuição igual à sua cota devida",
      tone: isCreditor ? "positive" : isDebtor ? "negative" : "default",
    },
  ];

  const totalLabel = isCreditor
    ? "A Receber via Pix"
    : isDebtor
      ? "A Pagar via Pix"
      : "Saldo Zerado";

  const breakdown: CalculationBreakdown = {
    id: `family-settlement-${member.userId}`,
    title: `Acerto Familiar: ${member.displayName}`,
    description:
      "Calcula a diferença exata entre o montante pago do próprio bolso e a cota atribuída pelas regras acordadas pela família.",
    periodLabel,
    formulaExpression: "Saldo Líquido = Total Pago do Bolso - Cota Justa Devida",
    unit: "currency",
    steps,
    result: {
      label: totalLabel,
      rawValue: absBalance,
      unit: "currency",
      tone: isCreditor ? "positive" : isDebtor ? "negative" : "default",
    },
    notes: [
      "Invariante de conservação de valor: a soma dos saldos a pagar é exatamente igual à soma dos saldos a receber na casa.",
      "Despesas particulares ou não compartilhadas ficam de fora do cálculo do acerto.",
      `Regra ativa: ${splitRuleDescription}.`,
    ],
  };

  return enrichBreakdown(breakdown);
}

export interface FamilyCeilingBreakdownData {
  monthlyCeilingCents: number;
  totalSpentCents: number;
  spentPercentage: number;
  periodLabel?: string;
  membersSummary?: Array<{ name: string; spentCents: number }>;
}

/**
 * Monta o breakdown de cálculo para o Teto de Gastos Familiar.
 */
export function buildFamilyCeilingBreakdown(
  data: FamilyCeilingBreakdownData,
): CalculationBreakdown {
  const { monthlyCeilingCents, totalSpentCents, spentPercentage, periodLabel = "Mês Atual", membersSummary = [] } = data;
  const isOverCeiling = totalSpentCents > monthlyCeilingCents;
  const remainingMarginCents = Math.max(0, monthlyCeilingCents - totalSpentCents);
  const excessCents = Math.max(0, totalSpentCents - monthlyCeilingCents);

  const steps: BreakdownStep[] = [
    {
      label: "Teto Mensal Planejado para a Casa",
      operator: "=",
      rawValue: monthlyCeilingCents,
      unit: "currency",
      hint: "Limite global de despesas conjuntas acordado entre os membros",
      tone: "default",
    },
    {
      label: "Gasto Total Consolidado da Casa",
      operator: "-",
      rawValue: totalSpentCents,
      unit: "currency",
      hint: "Soma das despesas conjuntas realizadas por todos os membros no mês",
      tone: "negative",
    },
    {
      label: isOverCeiling ? "Excesso Orçamentário" : "Margem Restante Disponível",
      operator: "=",
      rawValue: isOverCeiling ? excessCents : remainingMarginCents,
      unit: "currency",
      hint: isOverCeiling
        ? "Valor que ultrapassou o teto estipulado"
        : "Saldo livre para despesas até o fim do mês",
      tone: isOverCeiling ? "negative" : "positive",
    },
  ];

  membersSummary.forEach((m) => {
    steps.push({
      label: `Contribuição de ${m.name}`,
      operator: "=",
      rawValue: m.spentCents,
      unit: "currency",
      hint: `Despesas registradas por ${m.name} no mês`,
      tone: "default",
    });
  });

  const breakdown: CalculationBreakdown = {
    id: "family-ceiling",
    title: "Teto de Gastos Familiar",
    description: "Audita o consumo consolidado do orçamento familiar frente ao teto estipulado para a casa no mês.",
    periodLabel,
    formulaExpression: "Margem Restante = Teto Mensal - Gasto Total Consolidado",
    unit: "currency",
    steps,
    result: {
      label: isOverCeiling ? "Excesso Orçamentário" : "Margem Restante",
      rawValue: isOverCeiling ? excessCents : remainingMarginCents,
      unit: "currency",
      tone: isOverCeiling ? "negative" : "positive",
    },
    notes: [
      `Consumo Atual: ${spentPercentage}% do teto da casa consumido.`,
      "Consolida apenas despesas com peso compartilhado entre os membros da casa.",
      "Gera alerta preventivo quando o consumo atinge 80% e crítico quando supera 100%.",
    ],
  };

  return enrichBreakdown(breakdown);
}

export interface FamilyTransferBreakdownData {
  payerId: string;
  payerName?: string;
  receiverId: string;
  receiverName?: string;
  amountCents: number;
  payerBalanceCents: number;
  receiverBalanceCents: number;
  periodLabel?: string;
}

/**
 * Monta o breakdown de uma transferência proposta entre dois membros da família
 * quando o valor da perna diverge do saldo líquido individual (3+ membros ou acertos parciais).
 */
export function buildFamilyTransferBreakdown(
  data: FamilyTransferBreakdownData,
): CalculationBreakdown {
  const payerLabel = data.payerName ?? data.payerId;
  const receiverLabel = data.receiverName ?? data.receiverId;
  const residualPayerCents = data.payerBalanceCents + data.amountCents;

  const steps: BreakdownStep[] = [
    {
      label: `Saldo Líquido de ${payerLabel} (Pagador)`,
      operator: "=",
      rawValue: data.payerBalanceCents,
      unit: "currency",
      tone: data.payerBalanceCents < 0 ? "negative" : "default",
    },
    {
      label: `Saldo Líquido de ${receiverLabel} (Recebedor)`,
      operator: "=",
      rawValue: data.receiverBalanceCents,
      unit: "currency",
      tone: data.receiverBalanceCents > 0 ? "positive" : "default",
    },
    {
      label: `Transferência Proposta (${payerLabel} -> ${receiverLabel})`,
      operator: "+",
      rawValue: data.amountCents,
      unit: "currency",
      tone: "portfolio",
    },
    {
      label: `Saldo Residual de ${payerLabel} após Transferência`,
      operator: "=",
      rawValue: residualPayerCents,
      unit: "currency",
      tone: residualPayerCents === 0 ? "positive" : "default",
    },
  ];

  return enrichBreakdown({
    id: `family-transfer-${data.payerId}-${data.receiverId}`,
    title: `Transferência Familiar: ${payerLabel} para ${receiverLabel}`,
    description: "Exibe a perna de compensação proposta entre os membros e o saldo residual após a transferência.",
    periodLabel: data.periodLabel ?? "Mês de Referência",
    formulaExpression: "Saldo Residual = Saldo Líquido do Pagador + Transferência",
    unit: "currency",
    steps,
    result: {
      label: "Valor da Transferência",
      rawValue: data.amountCents,
      unit: "currency",
      tone: "portfolio",
    },
  });
}
