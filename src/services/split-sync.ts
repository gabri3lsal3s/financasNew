import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { getExpense, listExpensesByInstallmentGroup, updateExpense } from "@/data/repositories/expenses";
import { deleteExpenseInstallments } from "@/data/rpc";
import { calculateInstallmentReportWeight } from "@/domain/finance/split-math";
import type { Expense, SplitParticipantInstallment } from "@/types";

export interface SyncSplitWeightsParams {
  expenseId: string;
  installments?: readonly SplitParticipantInstallment[] | null;
  hostId?: string | null;
  totalCents: number;
  installmentsCount?: number | null;
  groupId?: string | null;
}

/**
 * Sincroniza o peso contábil (report_weight) de todas as parcelas da despesa vinculada
 * a um racha, garantindo que o rateio reflita proporcionalmente nas faturas do cartão de crédito.
 */
export async function syncSplitExpenseReportWeights({
  expenseId,
  installments,
  hostId,
  totalCents,
  installmentsCount,
  groupId,
}: SyncSplitWeightsParams): Promise<{ updatedCount: number; groupId: string | null }> {
  if (!expenseId) {
    return { updatedCount: 0, groupId: null };
  }

  const linkedExpense = await getExpense(expenseId);
  if (!linkedExpense) {
    return { updatedCount: 0, groupId: null };
  }

  const effectiveGroupId = groupId || linkedExpense.installment_group_id || null;
  let groupExpenses: Expense[] = [];

  if (effectiveGroupId) {
    groupExpenses = await listExpensesByInstallmentGroup(effectiveGroupId);
  }

  // Fallback para despesas legadas sem installment_group_id preenchido
  if (
    groupExpenses.length === 0 &&
    linkedExpense.installments_total > 1 &&
    linkedExpense.card_id &&
    linkedExpense.description
  ) {
    const { data: siblings } = await resolveQuery<Expense[]>(
      getSupabase()
        .from("expenses")
        .select("*")
        .eq("card_id", linkedExpense.card_id)
        .eq("description", linkedExpense.description)
        .eq("installments_total", linkedExpense.installments_total)
        .order("installment_number", { ascending: true }),
    );
    if (siblings && siblings.length > 0) {
      groupExpenses = siblings;
    }
  }

  const validInstallments = installments ?? [];
  let updatedCount = 0;

  if (groupExpenses.length > 0) {
    // Sincroniza cada parcela individualmente pelo seu installment_number
    for (const exp of groupExpenses) {
      const num = exp.installment_number ?? 1;
      const settledForInst = validInstallments
        .filter((i) => i.installment_number === num && i.is_settled && i.participant_id !== hostId)
        .reduce((acc, i) => acc + i.amount_cents, 0);

      const expBaseCents = Math.round(Number(exp.value) * 100);
      const targetWeight = calculateInstallmentReportWeight(expBaseCents, settledForInst);

      if (Number(exp.report_weight.toFixed(4)) !== targetWeight) {
        await updateExpense(exp.id, { report_weight: targetWeight });
        updatedCount++;
      }
    }
  } else if (validInstallments.length > 0) {
    // Despesa parcelada sem grupo de parcelas localizado no banco: ajusta a parcela informada
    const targetNum = linkedExpense.installment_number ?? 1;
    const settledForInst = validInstallments
      .filter((i) => i.installment_number === targetNum && i.is_settled && i.participant_id !== hostId)
      .reduce((acc, i) => acc + i.amount_cents, 0);

    const instCount = installmentsCount && installmentsCount > 0 ? installmentsCount : (linkedExpense.installments_total || 1);
    const instBase = instCount > 0 ? Math.round(totalCents / instCount) : totalCents;
    const targetWeight = calculateInstallmentReportWeight(instBase, settledForInst);

    if (Number(linkedExpense.report_weight.toFixed(4)) !== targetWeight) {
      await updateExpense(linkedExpense.id, { report_weight: targetWeight });
      updatedCount++;
    }
  } else {
    // Despesa à vista (single total)
    const totalSettledFromFriends = validInstallments
      .filter((i) => i.is_settled && i.participant_id !== hostId)
      .reduce((acc, i) => acc + i.amount_cents, 0);

    const netCents = Math.max(0, totalCents - totalSettledFromFriends);
    const targetWeight = totalCents > 0 ? Number((netCents / totalCents).toFixed(4)) : 1;

    if (Number(linkedExpense.report_weight.toFixed(4)) !== targetWeight) {
      await updateExpense(linkedExpense.id, { report_weight: targetWeight });
      updatedCount++;
    }
  }

  return { updatedCount, groupId: effectiveGroupId };
}

/**
 * Exclui de forma resiliente todas as parcelas de uma despesa vinculada a um racha,
 * garantindo que todas as parcelas do cartão sejam removidas mesmo em despesas legadas sem grupo.
 */
export async function deleteAllSplitExpenses({
  expenseId,
  groupId,
}: {
  expenseId: string;
  groupId?: string | null;
}): Promise<{ deletedCount: number }> {
  if (!expenseId) {
    return { deletedCount: 0 };
  }

  const linkedExpense = await getExpense(expenseId);
  const effectiveGroupId = groupId || linkedExpense?.installment_group_id || null;

  let groupExpenses: Expense[] = [];
  if (effectiveGroupId) {
    groupExpenses = await listExpensesByInstallmentGroup(effectiveGroupId);
  }

  if (
    groupExpenses.length === 0 &&
    linkedExpense &&
    linkedExpense.installments_total > 1 &&
    linkedExpense.card_id &&
    linkedExpense.description
  ) {
    const { data: siblings } = await resolveQuery<Expense[]>(
      getSupabase()
        .from("expenses")
        .select("*")
        .eq("card_id", linkedExpense.card_id)
        .eq("description", linkedExpense.description)
        .eq("installments_total", linkedExpense.installments_total),
    );
    if (siblings && siblings.length > 0) {
      groupExpenses = siblings;
    }
  }

  let deletedCount = 0;

  if (groupExpenses.length > 0) {
    for (const exp of groupExpenses) {
      try {
        await deleteExpenseInstallments(exp.id, "single");
        deletedCount++;
      } catch (err) {
        console.warn(`Erro ao excluir parcela ${exp.id}:`, err);
      }
    }
  } else {
    try {
      deletedCount = await deleteExpenseInstallments(expenseId, "all");
    } catch {
      await deleteExpenseInstallments(expenseId, "single");
      deletedCount = 1;
    }
  }

  return { deletedCount };
}
