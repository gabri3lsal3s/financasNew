/**
 * Motor Matemático Puro de Divisão e Compensação de Viagens (trip-math.ts).
 *
 * Responsável por:
 * 1. Divisão exata de cotas em centavos inteiros com alocação determinística de resíduos.
 * 2. Cálculo dos balanços líquidos por participante (Total Pago - Total Devido).
 * 3. Algoritmo de simplificação de dívidas (Greedy Min-Cash-Flow) para liquidação em número mínimo de Pix.
 * 4. Ponderação contábil para vinculação ao extrato pessoal (report_weight).
 *
 * Função 100% pura: sem dependências de UI, React ou Supabase (AGENTS.md Regra 3).
 */

import type {
  TripMemberBalance,
  SuggestedSettlement,
  TripPixKeyType,
} from "@/types/trips";

export interface CalculateSplitsInput {
  totalAmountCents: number;
  memberIds: readonly string[];
  payerMemberId?: string;
}

export interface SplitResult {
  memberId: string;
  shareCents: number;
}

/**
 * Divide o valor total igualmente entre os membros selecionados,
 * alocando determinísticamente qualquer resto de centavo ao pagador da despesa.
 * Invariante inegociável: soma(shareCents) === totalAmountCents.
 */
export function calculateEqualSplits(
  input: CalculateSplitsInput
): readonly SplitResult[] {
  const { totalAmountCents, memberIds, payerMemberId } = input;

  if (memberIds.length === 0 || totalAmountCents <= 0) {
    return [];
  }

  const count = memberIds.length;
  const baseShare = Math.floor(totalAmountCents / count);
  const remainder = totalAmountCents % count;

  // Se o pagador estiver entre os membros participantes, ele absorve a sobra preferencialmente.
  // Caso contrário, distribui 1 centavo para os primeiros N participantes.
  const payerIndex = payerMemberId ? memberIds.indexOf(payerMemberId) : -1;

  return memberIds.map((memberId, index) => {
    let extra = 0;
    if (payerIndex >= 0) {
      if (index === payerIndex) {
        extra = remainder;
      }
    } else {
      if (index < remainder) {
        extra = 1;
      }
    }

    return {
      memberId,
      shareCents: baseShare + extra,
    };
  });
}

export interface ExpenseItemForBalance {
  paid_by_member_id: string;
  amount_cents: number;
  splits: readonly {
    member_id: string;
    share_cents: number;
  }[];
}

export interface MemberItemForBalance {
  id: string;
  name: string;
  pix_key?: string | null;
  pix_key_type?: TripPixKeyType | null;
}

/**
 * Computa o saldo líquido de cada membro em centavos inteiros:
 * Saldo = Total Pago - Total Devido
 */
export function calculateMemberBalances(
  members: readonly MemberItemForBalance[],
  expenses: readonly ExpenseItemForBalance[]
): readonly TripMemberBalance[] {
  const paidMap = new Map<string, number>();
  const owedMap = new Map<string, number>();

  for (const member of members) {
    paidMap.set(member.id, 0);
    owedMap.set(member.id, 0);
  }

  for (const expense of expenses) {
    const currentPaid = paidMap.get(expense.paid_by_member_id) ?? 0;
    paidMap.set(expense.paid_by_member_id, currentPaid + expense.amount_cents);

    for (const split of expense.splits) {
      const currentOwed = owedMap.get(split.member_id) ?? 0;
      owedMap.set(split.member_id, currentOwed + split.share_cents);
    }
  }

  return members.map((member) => {
    const totalPaid = paidMap.get(member.id) ?? 0;
    const totalOwed = owedMap.get(member.id) ?? 0;
    return {
      memberId: member.id,
      name: member.name,
      totalPaidCents: totalPaid,
      totalOwedCents: totalOwed,
      netBalanceCents: totalPaid - totalOwed,
    };
  });
}

/**
 * Algoritmo ganancioso de simplificação de dívidas (Greedy Min-Cash-Flow).
 * Transforma uma teia complexa de saldos em uma lista mínima e otimizada de transferências Pix.
 */
export function calculateSimplifiedSettlements(
  balances: readonly TripMemberBalance[],
  membersMetadata?: readonly MemberItemForBalance[]
): readonly SuggestedSettlement[] {
  const metaMap = new Map<string, MemberItemForBalance>();
  if (membersMetadata) {
    for (const m of membersMetadata) {
      metaMap.set(m.id, m);
    }
  }

  type BalanceNode = {
    memberId: string;
    name: string;
    amount: number;
  };

  const debtors: BalanceNode[] = [];
  const creditors: BalanceNode[] = [];

  for (const b of balances) {
    if (b.netBalanceCents < 0) {
      debtors.push({
        memberId: b.memberId,
        name: b.name,
        amount: Math.abs(b.netBalanceCents),
      });
    } else if (b.netBalanceCents > 0) {
      creditors.push({
        memberId: b.memberId,
        name: b.name,
        amount: b.netBalanceCents,
      });
    }
  }

  // Ordena decrescente pelo montante
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements: SuggestedSettlement[] = [];

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (!debtor || !creditor) break;

    const transferAmount = Math.min(debtor.amount, creditor.amount);

    if (transferAmount > 0) {
      const credMeta = metaMap.get(creditor.memberId);
      settlements.push({
        fromMemberId: debtor.memberId,
        fromMemberName: debtor.name,
        toMemberId: creditor.memberId,
        toMemberName: creditor.name,
        toPixKey: credMeta?.pix_key ?? null,
        toPixKeyType: credMeta?.pix_key_type ?? null,
        amountCents: transferAmount,
      });
    }

    debtor.amount -= transferAmount;
    creditor.amount -= transferAmount;

    if (debtor.amount === 0) {
      dIdx++;
    }
    if (creditor.amount === 0) {
      cIdx++;
    }
  }

  return settlements;
}

/**
 * Calcula o peso contábil (report_weight) proporcional para uma despesa vinculada.
 * Ex: Despesa total R$ 600, cota do usuário R$ 200 -> report_weight = 0.333333
 */
export function calculateLinkedExpenseWeight(
  totalExpenseCents: number,
  userShareCents: number
): number {
  if (totalExpenseCents <= 0) return 1;
  const ratio = userShareCents / totalExpenseCents;
  return Number(Math.min(1, Math.max(0, ratio)).toFixed(6));
}
