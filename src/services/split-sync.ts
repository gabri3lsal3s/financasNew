import { getSupabase } from "@/data/client";
import { resolveQuery } from "@/data/query";
import { createLinkedReceivableDebt, listDebts, updateDebt } from "@/data/repositories/debts";
import { getExpense, listExpensesByInstallmentGroup, updateExpense } from "@/data/repositories/expenses";
import { deleteExpenseInstallments, settleIntegratedReceivable, updateExpenseInstallmentsGroup } from "@/data/rpc";
import { divideIntoInstallments } from "@/domain/cards";
import { todayISO } from "@/domain/debts";
import { computeSplitExpenseWeights } from "@/domain/finance";
import type { Debt, Expense, SplitParticipantInstallment, SplitParticipantItem } from "@/types";

export interface SyncSplitWeightsParams {
  expenseId: string;
  participants?: readonly SplitParticipantItem[] | null;
  installments?: readonly SplitParticipantInstallment[] | null;
  installmentsMode?: "single_total" | "per_installment";
  hostId?: string | null;
  totalCents: number;
  installmentsCount?: number | null;
  groupId?: string | null;
}

/**
 * Resolve todas as parcelas da despesa vinculada a um racha (ou a própria despesa à vista).
 */
export async function resolveSplitTargetExpenses(
  expenseId: string,
  groupId?: string | null,
): Promise<{
  linkedExpense: Expense | null;
  effectiveGroupId: string | null;
  targetExpenses: Expense[];
}> {
  if (!expenseId) {
    return { linkedExpense: null, effectiveGroupId: groupId ?? null, targetExpenses: [] };
  }

  const linkedExpense = await getExpense(expenseId);
  if (!linkedExpense) {
    return { linkedExpense: null, effectiveGroupId: groupId ?? null, targetExpenses: [] };
  }

  const effectiveGroupId = groupId || linkedExpense.installment_group_id || null;
  let groupExpenses: Expense[] = [];

  if (effectiveGroupId) {
    groupExpenses = await listExpensesByInstallmentGroup(effectiveGroupId);
  }

  // Fallback exclusivo para despesas legadas sem installment_group_id preenchido
  if (
    groupExpenses.length === 0 &&
    !effectiveGroupId &&
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

  const targetExpenses = groupExpenses.length > 0 ? groupExpenses : [linkedExpense];
  return { linkedExpense, effectiveGroupId, targetExpenses };
}

function buildFallbackParticipantsFromInstallments(
  installments: readonly SplitParticipantInstallment[],
  hostId?: string | null,
): SplitParticipantItem[] {
  const byParticipant = new Map<string, { shareCents: number; settledCents: number; allSettled: boolean }>();
  for (const inst of installments) {
    if (hostId && inst.participant_id === hostId) continue;
    const prev = byParticipant.get(inst.participant_id) ?? {
      shareCents: 0,
      settledCents: 0,
      allSettled: true,
    };
    prev.shareCents += inst.amount_cents;
    if (inst.is_settled) {
      prev.settledCents += inst.amount_cents;
    } else {
      prev.allSettled = false;
    }
    byParticipant.set(inst.participant_id, prev);
  }

  const list: SplitParticipantItem[] = [];
  if (hostId) {
    list.push({ id: hostId, name: "Anfitrião", share_cents: 0, is_host: true, is_settled: true, settled_cents: 0 });
  }
  for (const [id, data] of byParticipant.entries()) {
    list.push({
      id,
      name: id,
      share_cents: data.shareCents,
      is_host: false,
      is_settled: data.allSettled,
      settled_cents: data.settledCents,
    });
  }
  return list;
}

/**
 * Sincroniza o peso contábil (`report_weight`) de todas as linhas da despesa vinculada
 * a um racha (à vista, parcelado mês a mês ou parcelado em cota única),
 * garantindo que o reembolso confirmado seja sempre abatido corretamente.
 */
export async function syncSplitExpenseReportWeights({
  expenseId,
  participants,
  installments,
  installmentsMode,
  hostId,
  totalCents,
  groupId,
}: SyncSplitWeightsParams): Promise<{ updatedCount: number; groupId: string | null }> {
  if (!expenseId) {
    return { updatedCount: 0, groupId: null };
  }

  const { linkedExpense, effectiveGroupId, targetExpenses } = await resolveSplitTargetExpenses(expenseId, groupId);
  if (!linkedExpense || targetExpenses.length === 0) {
    return { updatedCount: 0, groupId: null };
  }

  const validInstallments = installments ?? [];
  const effectiveParticipants =
    participants && participants.length > 0
      ? participants
      : buildFallbackParticipantsFromInstallments(validInstallments, hostId);

  const weightTargets = computeSplitExpenseWeights({
    expenses: targetExpenses,
    participants: effectiveParticipants,
    installments: validInstallments,
    installmentsMode,
    totalCents,
  });

  let updatedCount = 0;
  for (const target of weightTargets) {
    if (!target.changed) continue;
    await updateExpense(target.expenseId, { report_weight: target.targetWeight });
    updatedCount++;
  }

  return { updatedCount, groupId: effectiveGroupId };
}

export interface SyncExpenseFieldsFromSplitParams {
  expenseId: string;
  groupId?: string | null;
  description?: string;
  totalCents?: number;
  date?: string;
}

/**
 * Sincroniza alterações feitas no editor do racha (título, valor total e data)
 * de volta para a despesa (ou grupo de parcelas) vinculada no extrato.
 */
export async function syncExpenseFieldsFromSplit({
  expenseId,
  groupId,
  description,
  totalCents,
  date,
}: SyncExpenseFieldsFromSplitParams): Promise<{ updatedCount: number }> {
  if (!expenseId) return { updatedCount: 0 };

  const { linkedExpense, targetExpenses } = await resolveSplitTargetExpenses(expenseId, groupId);
  if (!linkedExpense || targetExpenses.length === 0) return { updatedCount: 0 };

  let updatedCount = 0;

  if (targetExpenses.length === 1 && (linkedExpense.installments_total ?? 1) <= 1) {
    const patch: Record<string, unknown> = {};
    if (description !== undefined && description.trim() !== (linkedExpense.description ?? "").trim()) {
      patch.description = description.trim() || null;
    }
    if (date !== undefined && date !== linkedExpense.date) {
      patch.date = date;
    }
    if (totalCents !== undefined && totalCents > 0) {
      const nextVal = Number((totalCents / 100).toFixed(2));
      if (Math.round(linkedExpense.value * 100) !== totalCents) {
        patch.value = nextVal;
        patch.base_amount = nextVal;
      }
    }
    if (Object.keys(patch).length > 0) {
      await updateExpense(linkedExpense.id, patch);
      updatedCount = 1;
    }
    return { updatedCount };
  }

  // Grupo parcelado: sincroniza descrição em lote e redistribui novo total entre parcelas se alterado
  const firstExp = targetExpenses[0]!;
  if (
    description !== undefined &&
    targetExpenses.some((e) => (e.description ?? "").trim() !== description.trim())
  ) {
    try {
      await updateExpenseInstallmentsGroup(firstExp.id, "all", {
        description: description.trim() || null,
      });
      updatedCount += targetExpenses.length;
    } catch {
      for (const exp of targetExpenses) {
        await updateExpense(exp.id, { description: description.trim() || null });
        updatedCount++;
      }
    }
  }

  if (totalCents !== undefined && totalCents > 0) {
    const currentGroupCents = targetExpenses.reduce(
      (acc, e) => acc + Math.round(Number(e.value) * 100),
      0,
    );
    if (currentGroupCents !== totalCents) {
      const redistributed = divideIntoInstallments({
        totalCents,
        count: targetExpenses.length,
        startDate: firstExp.date,
        closingDay: null,
      });
      for (let i = 0; i < targetExpenses.length; i++) {
        const exp = targetExpenses[i]!;
        const nextCents = redistributed[i]?.valueCents;
        if (nextCents !== undefined && nextCents > 0 && Math.round(Number(exp.value) * 100) !== nextCents) {
          const nextVal = Number((nextCents / 100).toFixed(2));
          await updateExpense(exp.id, { value: nextVal, base_amount: nextVal });
          updatedCount++;
        }
      }
    }
  }

  return { updatedCount };
}

export interface SyncSplitDebtStatusParams {
  linkedDebt?: Debt | null;
  debtId?: string | null;
  expenseId?: string | null;
  groupId?: string | null;
  title: string;
  dueDate?: string | null;
  remainingReceivableCents: number;
  hostNetCostCents: number;
  isCompleted: boolean;
  isMultiInstallment: boolean;
  shouldCreateIfMissing?: boolean;
}

/**
 * Sincroniza a conta a receber (`debts`) vinculada a um racha:
 * cria quando ausente (opcional), atualiza valor/título/vencimento,
 * quita ao concluir ou reabre (`paid_at: null`) se voltar a ter pendências.
 */
export async function syncSplitDebtStatus({
  linkedDebt,
  debtId,
  expenseId,
  groupId,
  title,
  dueDate,
  remainingReceivableCents,
  hostNetCostCents,
  isCompleted,
  isMultiInstallment,
  shouldCreateIfMissing = false,
}: SyncSplitDebtStatusParams): Promise<Debt | null> {
  let targetDebt = linkedDebt ?? null;

  if (!targetDebt && (debtId || expenseId || groupId)) {
    const allDebts = await listDebts().catch(() => []);
    targetDebt =
      allDebts.find(
        (d) =>
          (debtId && d.id === debtId) ||
          (d.type === "receivable" &&
            ((expenseId && d.expense_id === expenseId) ||
              (groupId && d.installment_group_id === groupId))),
      ) ?? null;
  }

  const normalizedName = `Racha: ${title.trim() || "Despesa"}`;

  if (!targetDebt) {
    if (!shouldCreateIfMissing || isCompleted || remainingReceivableCents <= 0) {
      return null;
    }
    try {
      return await createLinkedReceivableDebt({
        name: normalizedName,
        amount: Number((remainingReceivableCents / 100).toFixed(2)),
        due_date: dueDate || todayISO(),
        expense_id: expenseId ?? null,
        installment_group_id: groupId ?? null,
      });
    } catch (err) {
      console.warn("Não foi possível criar cobrança vinculada para o racha:", err);
      return null;
    }
  }

  try {
    if (isCompleted || remainingReceivableCents === 0) {
      if (!targetDebt.paid_at) {
        if (!isMultiInstallment && targetDebt.expense_id) {
          await settleIntegratedReceivable(targetDebt.id, Number((hostNetCostCents / 100).toFixed(2)));
          if (targetDebt.name !== normalizedName) {
            await updateDebt(targetDebt.id, { name: normalizedName });
          }
          return { ...targetDebt, name: normalizedName, paid_at: new Date().toISOString() };
        }
        return await updateDebt(targetDebt.id, {
          name: normalizedName,
          paid_at: new Date().toISOString(),
        });
      }
      if (targetDebt.name !== normalizedName) {
        return await updateDebt(targetDebt.id, { name: normalizedName });
      }
      return targetDebt;
    }

    const nextAmount = Number((remainingReceivableCents / 100).toFixed(2));
    return await updateDebt(targetDebt.id, {
      name: normalizedName,
      amount: nextAmount,
      ...(dueDate ? { due_date: dueDate } : {}),
      ...(targetDebt.paid_at ? { paid_at: null } : {}),
    });
  } catch (err) {
    console.warn("Não foi possível sincronizar a cobrança vinculada ao racha:", err);
    return targetDebt;
  }
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

  const { linkedExpense, targetExpenses } = await resolveSplitTargetExpenses(expenseId, groupId);
  let deletedCount = 0;

  if (linkedExpense && targetExpenses.length > 1) {
    for (const exp of targetExpenses) {
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
