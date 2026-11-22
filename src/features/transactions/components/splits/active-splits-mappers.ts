import { todayISO } from "@/domain/debts";
import { sumExpectedFromFriendsCents, sumSettledFromFriendsCents } from "@/domain/finance";
import { isParticipantFullySettled, isSplitFullyCompleted } from "@/domain/finance/split-math";
import type { Debt, PublicShare, SplitSharePayload } from "@/types";
import type { ActiveSplitItem } from "./active-splits-types";

/** Mapeia e ordena rachas de despesa (shares + dívidas órfãs pendentes) para exibição. */
export function buildAndSortActiveSplits(params: {
  shares: PublicShare[] | undefined;
  debts: Debt[] | undefined;
  month?: string;
}): ActiveSplitItem[] {
  const { shares, debts, month } = params;
  if (!(shares && shares.length > 0) && !(debts && debts.length > 0)) return [];

  const receivableDebtsByExpense = new Map<string, Debt>();
  const receivableDebtsByGroup = new Map<string, Debt>();
  const debtById = new Map<string, Debt>();
  for (const debt of debts ?? []) {
    debtById.set(debt.id, debt);
    if (debt.type === "receivable" && debt.expense_id) {
      receivableDebtsByExpense.set(debt.expense_id, debt);
    }
    if (debt.type === "receivable" && debt.installment_group_id) {
      receivableDebtsByGroup.set(debt.installment_group_id, debt);
    }
  }

  const mappedDebtIds = new Set<string>();
  const mappedExpenseIds = new Set<string>();
  const mappedInstallmentGroupIds = new Set<string>();

  const itemsFromShares: ActiveSplitItem[] = (shares ?? []).map((share) => {
    const payload = (share.payload ?? {}) as unknown as SplitSharePayload;
    const refDebtId = share.debt_id || payload.debt_id || null;
    const refExpenseId = share.expense_id || payload.expense_id || null;
    const refGroupId = share.installment_group_id || payload.installment_group_id || null;

    if (refDebtId) mappedDebtIds.add(refDebtId);
    if (refExpenseId) mappedExpenseIds.add(refExpenseId);
    if (refGroupId) mappedInstallmentGroupIds.add(refGroupId);

    const linkedDebt =
      (refDebtId ? debtById.get(refDebtId) : null) ||
      (refExpenseId ? receivableDebtsByExpense.get(refExpenseId) : null) ||
      (refGroupId ? receivableDebtsByGroup.get(refGroupId) : null) ||
      null;
    if (linkedDebt) {
      mappedDebtIds.add(linkedDebt.id);
      if (linkedDebt.installment_group_id) mappedInstallmentGroupIds.add(linkedDebt.installment_group_id);
    }

    const participants = payload.participants ?? [];
    const participantInstallments = payload.participant_installments ?? [];
    const friends = participants.filter((p) => !p.is_host);
    const hasStructuredData = participants.length > 0 || participantInstallments.length > 0;
    const isSettled = hasStructuredData
      ? isSplitFullyCompleted(participants, participantInstallments)
      : Boolean(payload.is_completed) || (linkedDebt ? Boolean(linkedDebt.paid_at) : false);

    const peopleCount = Number(payload.people_count ?? 2);
    const guestCount = Math.max(1, peopleCount - 1);
    const guestShareCents = Number(payload.guest_share_cents ?? 0);
    const receivableExpectedCents =
      friends.length > 0 ? sumExpectedFromFriendsCents(participants) : guestShareCents * guestCount;
    const settledFromFriendsCents =
      friends.length > 0 ? sumSettledFromFriendsCents(participants) : Number(payload.total_settled_cents ?? 0);

    const settledFriendsCount = friends.filter((f) => {
      const friendInsts = participantInstallments.filter(
        (inst) =>
          inst.participant_id === f.id ||
          (friends.length === 1 && !participants.find((p) => p.id === inst.participant_id)?.is_host),
      );
      return isParticipantFullySettled(f, friendInsts);
    }).length;

    return {
      id: share.id,
      share,
      payload,
      linkedDebt,
      dueDate:
        linkedDebt?.due_date ||
        payload.due_date ||
        null,
      createdAt: share.created_at || payload.date || "",
      isSettled,
      isCompleted: Boolean(payload.is_completed),
      totalCents: Number(payload.total_cents ?? 0),
      guestShareCents,
      hostShareCents: Number(payload.host_share_cents ?? 0),
      peopleCount,
      guestCount,
      receivableExpectedCents,
      settledFriendsCount,
      signaledFriends: friends.filter((p) => p.has_payment_signal && !p.is_settled),
      totalSettledFromFriendsCents: settledFromFriendsCents,
      date: payload.date || share.created_at.slice(0, 10),
      needsLinkGeneration: false,
    };
  });

  const seenOrphanGroupIds = new Set<string>();
  const orphanRachaDebts: ActiveSplitItem[] = (debts ?? [])
    .filter((d) => {
      if (d.type !== "receivable" || d.paid_at) return false;
      if (mappedDebtIds.has(d.id)) return false;
      if (d.expense_id && mappedExpenseIds.has(d.expense_id)) return false;
      if (d.installment_group_id && mappedInstallmentGroupIds.has(d.installment_group_id)) return false;
      if (!d.name.toLowerCase().includes("racha")) return false;
      if (d.installment_group_id) {
        if (seenOrphanGroupIds.has(d.installment_group_id)) return false;
        seenOrphanGroupIds.add(d.installment_group_id);
      }
      const installmentMatch = d.name.match(/\((\d+)\/\d+\)/);
      return !(installmentMatch && Number(installmentMatch[1]) > 1);
    })
    .map((d) => {
      const cleanTitle = d.name.replace(/^racha:\s*/i, "").trim() || "Racha de Despesa";
      const debtCents = Math.round(d.amount * 100);
      const date = d.due_date || d.created_at?.slice(0, 10) || todayISO();
      return {
        id: `orphan_debt_${d.id}`,
        share: null,
        payload: {
          title: cleanTitle,
          date,
          total_cents: debtCents,
          guest_share_cents: debtCents,
          host_share_cents: 0,
          people_count: 2,
          participants: [],
          expense_id: d.expense_id ?? undefined,
          debt_id: d.id,
        } as unknown as SplitSharePayload,
        linkedDebt: d,
        dueDate: d.due_date || null,
        createdAt: d.created_at || "",
        isSettled: false,
        isCompleted: false,
        totalCents: debtCents,
        guestShareCents: debtCents,
        hostShareCents: 0,
        peopleCount: 2,
        guestCount: 1,
        receivableExpectedCents: debtCents,
        settledFriendsCount: 0,
        signaledFriends: [],
        totalSettledFromFriendsCents: 0,
        date,
        needsLinkGeneration: true,
      };
    });

  return [...itemsFromShares, ...orphanRachaDebts]
    .filter((item) => !(month && item.date && !item.date.startsWith(month) && item.isSettled))
    .sort((a, b) => {
      if (!a.isSettled && b.isSettled) return -1;
      if (a.isSettled && !b.isSettled) return 1;
      if (a.isSettled && b.isSettled) {
        return (b.linkedDebt?.paid_at ?? b.createdAt).localeCompare(a.linkedDebt?.paid_at ?? a.createdAt);
      }
      if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate.localeCompare(b.dueDate);
      if (a.dueDate && !b.dueDate) return -1;
      if (!a.dueDate && b.dueDate) return 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
}

/** Monta o payload de share quitado e arquivado para revogação do link público. */
export function buildSettledSplitSharePayload(item: ActiveSplitItem, nowIso: string): SplitSharePayload {
  const updatedParticipants = (item.payload.participants ?? []).map((p) =>
    p.is_host
      ? p
      : { ...p, is_settled: true, settled_cents: p.share_cents, settled_at: p.settled_at || nowIso },
  );
  const totalFriendsSettled = updatedParticipants
    .filter((p) => !p.is_host)
    .reduce((acc, p) => acc + Number(p.settled_cents ?? p.share_cents), 0);

  return {
    ...item.payload,
    ...(updatedParticipants.length > 0 ? { participants: updatedParticipants } : {}),
    total_settled_cents:
      updatedParticipants.length > 0 ? totalFriendsSettled : item.receivableExpectedCents,
    is_completed: true,
  };
}
