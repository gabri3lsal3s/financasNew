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
  TripSplitType,
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
  split_type?: TripSplitType | string | null;
  splits?: readonly {
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
 *
 * Para despesas com split_type === 'custom' e cotas informadas, respeita a distribuição gravada.
 * Para despesas de divisão igualitária (split_type !== 'custom' ou sem cotas),
 * recalcula as cotas igualmente entre todos os membros ativos da viagem,
 * garantindo justiça mesmo quando novos participantes são integrados ao grupo.
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

  if (members.length === 0) {
    return [];
  }

  const memberIdSet = new Set(members.map((m) => m.id));

  for (const expense of expenses) {
    const currentPaid = paidMap.get(expense.paid_by_member_id) ?? 0;
    paidMap.set(expense.paid_by_member_id, currentPaid + expense.amount_cents);

    const isCustomSplit =
      expense.split_type === "custom" &&
      Boolean(expense.splits && expense.splits.length > 0);

    if (isCustomSplit && expense.splits) {
      for (const split of expense.splits) {
        if (memberIdSet.has(split.member_id)) {
          const currentOwed = owedMap.get(split.member_id) ?? 0;
          owedMap.set(split.member_id, currentOwed + split.share_cents);
        }
      }
    } else {
      const equalSplits = calculateEqualSplits({
        totalAmountCents: expense.amount_cents,
        memberIds: members.map((m) => m.id),
        payerMemberId: expense.paid_by_member_id,
      });

      for (const split of equalSplits) {
        const currentOwed = owedMap.get(split.memberId) ?? 0;
        owedMap.set(split.memberId, currentOwed + split.shareCents);
      }
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
 * Algoritmo ótimo de simplificação de dívidas (Min-Cash-Flow com Zero-Sum Partitioning).
 * Busca o menor número absoluto de transferências Pix entre os participantes da viagem.
 *
 * Para até 15 integrantes com saldo pendente:
 * Utiliza Programação Dinâmica com Bitmask para decompor o grupo no maior número
 * de subconjuntos fechados de soma zero (Zero-Sum Subsets), liquidando cada partição
 * de forma independente e garantindo o mínimo teórico de transações.
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

  const nonZeroBalances = balances.filter((b) => b.netBalanceCents !== 0);
  if (nonZeroBalances.length <= 1) {
    return [];
  }

  function resolveGreedy(
    debtors: { memberId: string; name: string; amount: number }[],
    creditors: { memberId: string; name: string; amount: number }[]
  ): SuggestedSettlement[] {
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const result: SuggestedSettlement[] = [];
    let dIdx = 0;
    let cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const debtor = debtors[dIdx];
      const creditor = creditors[cIdx];
      if (!debtor || !creditor) break;

      const transferAmount = Math.min(debtor.amount, creditor.amount);
      if (transferAmount > 0) {
        const credMeta = metaMap.get(creditor.memberId);
        result.push({
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

      if (debtor.amount === 0) dIdx++;
      if (creditor.amount === 0) cIdx++;
    }

    return result;
  }

  const M = nonZeroBalances.length;
  if (M <= 15) {
    const V = nonZeroBalances.map((b) => b.netBalanceCents);
    const totalStates = 1 << M;
    const sums: number[] = new Array<number>(totalStates).fill(0);

    for (let mask = 1; mask < totalStates; mask++) {
      const lsb = mask & -mask;
      const bit = 31 - Math.clz32(lsb);
      const prevSum = sums[mask ^ lsb] ?? 0;
      const val = V[bit] ?? 0;
      sums[mask] = prevSum + val;
    }

    const dp: number[] = new Array<number>(totalStates).fill(0);
    const choice: number[] = new Array<number>(totalStates).fill(0);

    for (let mask = 1; mask < totalStates; mask++) {
      if ((sums[mask] ?? 1) === 0) {
        dp[mask] = 1;
        choice[mask] = mask;
        let sub = (mask - 1) & mask;
        while (sub > 0) {
          const rest = mask ^ sub;
          const dpSub = dp[sub] ?? 0;
          const dpRest = dp[rest] ?? 0;
          const dpMask = dp[mask] ?? 0;

          if (dpSub > 0 && dpRest > 0) {
            if (dpSub + dpRest > dpMask) {
              dp[mask] = dpSub + dpRest;
              choice[mask] = sub;
            }
          }
          sub = (sub - 1) & mask;
        }
      }
    }

    const subsets: number[] = [];
    const fullMask = totalStates - 1;
    if ((dp[fullMask] ?? 0) > 0) {
      const queue = [fullMask];
      while (queue.length > 0) {
        const m = queue.pop();
        if (typeof m !== "number" || m === 0) continue;
        const ch = choice[m] ?? 0;
        if (ch === m || ch === 0) {
          subsets.push(m);
        } else {
          queue.push(ch);
          queue.push(m ^ ch);
        }
      }
    } else {
      subsets.push(fullMask);
    }

    const settlements: SuggestedSettlement[] = [];
    for (const subMask of subsets) {
      const groupDebtors: { memberId: string; name: string; amount: number }[] = [];
      const groupCreditors: { memberId: string; name: string; amount: number }[] = [];

      for (let i = 0; i < M; i++) {
        if ((subMask & (1 << i)) !== 0) {
          const b = nonZeroBalances[i];
          if (!b) continue;
          if (b.netBalanceCents < 0) {
            groupDebtors.push({
              memberId: b.memberId,
              name: b.name,
              amount: Math.abs(b.netBalanceCents),
            });
          } else if (b.netBalanceCents > 0) {
            groupCreditors.push({
              memberId: b.memberId,
              name: b.name,
              amount: b.netBalanceCents,
            });
          }
        }
      }

      settlements.push(...resolveGreedy(groupDebtors, groupCreditors));
    }

    return settlements;
  }

  const allDebtors = nonZeroBalances
    .filter((b) => b.netBalanceCents < 0)
    .map((b) => ({
      memberId: b.memberId,
      name: b.name,
      amount: Math.abs(b.netBalanceCents),
    }));
  const allCreditors = nonZeroBalances
    .filter((b) => b.netBalanceCents > 0)
    .map((b) => ({
      memberId: b.memberId,
      name: b.name,
      amount: b.netBalanceCents,
    }));

  return resolveGreedy(allDebtors, allCreditors);
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
