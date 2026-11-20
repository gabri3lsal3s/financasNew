/**
 * Builders de Memória de Cálculo para o Modo Viagem (§F36 / AUD-07 / Melhoria 8).
 *
 * Módulo puro responsável por gerar a memória de cálculo do:
 *   1. Balanço Líquido e Acerto de Contas da Viagem (Total Pago - Cota Devida - Acertos = Saldo Final);
 *   2. Rateio Individual de Despesas Compartilhadas.
 */

import { enrichBreakdown } from "../formatters";
import type { CalculationBreakdown, BreakdownStep } from "../types";
import type { TripMemberBalance } from "@/types/trips";

export interface TripSettlementBreakdownOptions {
  tripTitle?: string;
  totalTripExpensesCents?: number;
}

/**
 * Monta o breakdown de cálculo para o acerto individual de um participante da viagem.
 * Resolve AUD-07 fornecendo transparência total sobre cotas, pagamentos e transferências pendentes via Pix.
 */
export function buildTripSettlementBreakdown(
  member: TripMemberBalance,
  options: TripSettlementBreakdownOptions = {},
): CalculationBreakdown {
  const { tripTitle = "Viagem", totalTripExpensesCents } = options;

  const grossBalanceCents = member.totalPaidCents - member.totalOwedCents;
  const isCreditor = member.netBalanceCents > 0;
  const isDebtor = member.netBalanceCents < 0;
  const absNetBalance = Math.abs(member.netBalanceCents);

  const steps: BreakdownStep[] = [];

  if (totalTripExpensesCents != null && totalTripExpensesCents > 0) {
    steps.push({
      label: `Total Consolidado Gasto na Viagem (${tripTitle})`,
      operator: "=",
      rawValue: totalTripExpensesCents,
      unit: "currency",
      hint: "Soma de todas as despesas compartilhadas registradas pelo grupo",
      tone: "default",
    });
  }

  steps.push({
    label: `Total Desembolsado por ${member.name}`,
    operator: "+",
    rawValue: member.totalPaidCents,
    unit: "currency",
    hint: "Despesas que este viajante pagou do próprio bolso durante a viagem",
    tone: "positive",
  });

  steps.push({
    label: "Cota de Participação Devida",
    operator: "-",
    rawValue: member.totalOwedCents,
    unit: "currency",
    hint: "Soma das frações devidas nas despesas em que este membro participou",
    tone: "negative",
  });

  steps.push({
    label: "Balanço Bruto Inicial",
    operator: "=",
    rawValue: Math.abs(grossBalanceCents),
    unit: "currency",
    hint: grossBalanceCents >= 0
      ? "Crédito inicial antes de acertos parciais"
      : "Débito inicial antes de acertos parciais",
    tone: grossBalanceCents >= 0 ? "positive" : "negative",
    emphasis: "subtotal",
  });

  if ((member.settlementsPaidCents ?? 0) > 0) {
    steps.push({
      label: "Acertos / Pix já Transferidos",
      operator: "+",
      rawValue: member.settlementsPaidCents ?? 0,
      unit: "currency",
      hint: "Pagamentos de acerto já efetuados e confirmados",
      tone: "positive",
    });
  }

  if ((member.settlementsReceivedCents ?? 0) > 0) {
    steps.push({
      label: "Acertos / Pix já Recebidos",
      operator: "-",
      rawValue: member.settlementsReceivedCents ?? 0,
      unit: "currency",
      hint: "Reembolsos parciais já recebidos de outros viajantes",
      tone: "negative",
    });
  }

  const totalLabel = isCreditor
    ? "A Receber via Pix"
    : isDebtor
      ? "A Transferir via Pix"
      : "Contas Equilibradas";

  const breakdown: CalculationBreakdown = {
    id: `trip-settlement-${member.memberId}`,
    title: `Acerto da Viagem: ${member.name}`,
    description:
      "Calcula a diferença exata entre o montante que o viajante pagou do próprio bolso e a soma de suas cotas em cada despesa da viagem.",
    periodLabel: tripTitle,
    formulaExpression: "Saldo Final = Total Pago - Cota Devida + Acertos Pagos - Acertos Recebidos",
    unit: "currency",
    steps,
    result: {
      label: totalLabel,
      rawValue: absNetBalance,
      unit: "currency",
      tone: isCreditor ? "positive" : isDebtor ? "negative" : "default",
    },
    notes: [
      "Cada despesa pode ser dividida igualmente ou ter participantes e cotas personalizadas.",
      "O algoritmo de simplificação (Min-Cash-Flow) consolida as transferências no menor número possível de Pix.",
      "Invariante matemática estrita: a soma de todos os saldos líquidos da viagem é exatamente zero.",
    ],
  };

  return enrichBreakdown(breakdown);
}
