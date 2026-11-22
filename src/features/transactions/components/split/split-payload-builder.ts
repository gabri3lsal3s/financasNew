import { todayISO } from "@/domain/debts";
import {
  buildSplitParticipantInstallments,
  splitCustomWithRemainder,
  type SplitExpenseSummary,
  type SplitRemainderPolicy,
} from "@/domain/finance/split-math";
import { buildPixTransferCode, type PixKeyType } from "@/domain/pix";
import type { Expense, SplitParticipantInstallment, SplitSharePayload } from "@/types";

export interface BuildSplitPayloadInput {
  totalCents: number;
  peopleCount: number;
  description: string;
  pixKey: string;
  detectedType: PixKeyType;
  cleanMerchant: string;
  cleanCity: string;
  resolvedHostName: string;
  participants: string[];
  summary: SplitExpenseSummary;
  remainderPolicy: SplitRemainderPolicy;
  splitMode?: "equal" | "custom";
  customSharesCents?: number[];
  installmentsMode?: "single_total" | "per_installment";
  customNote?: string | null;
  dueDate?: string | null;
  linkedDebtId?: string | null;
  expense?: Partial<Expense> | null;
  fullExpense?: Expense | null;
  initialDate?: string;
  initialInstallmentsCount?: number;
  categoryName?: string;
  categoryIcon?: string;
}

/** Monta o payload completo de SplitSharePayload com BR Code Pix e parcelas dos participantes. */
export function buildSplitSharePayload(input: BuildSplitPayloadInput): SplitSharePayload {
  const {
    totalCents, peopleCount, description, pixKey, detectedType, cleanMerchant, cleanCity,
    resolvedHostName, participants, summary, remainderPolicy,
    splitMode = "equal", customSharesCents, installmentsMode, customNote, dueDate, linkedDebtId,
    expense, fullExpense, initialDate, initialInstallmentsCount, categoryName, categoryIcon,
  } = input;

  let effectiveShares = summary.shares;
  if (splitMode === "custom" && customSharesCents && customSharesCents.length === participants.length) {
    const customRes = splitCustomWithRemainder(
      totalCents,
      participants.map((name, i) => ({
        id: `p_${i + 1}`,
        name: name.trim() || `Participante ${i + 1}`,
        isHost: i === 0,
        fixedCents: Math.max(0, Math.round(customSharesCents[i] ?? 0)),
        weight: 1,
      })),
    );
    effectiveShares = customRes.map((r) => r.shareCents);
  }

  const hostShareCents = effectiveShares[0] ?? summary.hostShareCents;
  const firstGuestShareCents =
    participants.length > 1 ? (effectiveShares[1] ?? summary.guestShareCents) : summary.guestShareCents;

  const splitDate = expense?.date || initialDate || todayISO();
  const instCount = Math.max(
    1,
    expense?.installments_total ?? fullExpense?.installments_total ?? initialInstallmentsCount ?? 1,
  );
  const instGroupId = expense?.installment_group_id ?? fullExpense?.installment_group_id ?? null;
  const effectiveInstMode: "single_total" | "per_installment" =
    instCount > 1 ? (installmentsMode ?? "per_installment") : "single_total";

  const participantInstallments: SplitParticipantInstallment[] = [];
  if (instCount > 1 && effectiveInstMode === "per_installment") {
    for (let i = 1; i < participants.length; i++) {
      participantInstallments.push(
        ...buildSplitParticipantInstallments({
          participantId: `p_${i + 1}`,
          totalShareCents: effectiveShares[i] ?? firstGuestShareCents,
          installmentsCount: instCount,
          startDate: splitDate,
          isSettledInitial: false,
        }),
      );
    }
  }

  const firstGuestChargeCents =
    instCount > 1 && effectiveInstMode === "per_installment"
      ? (participantInstallments.find((item) => item.participant_id === "p_2")?.amount_cents ?? firstGuestShareCents)
      : firstGuestShareCents;

  const pixBrCode =
    buildPixTransferCode({
      pixKey: pixKey.trim(),
      keyType: detectedType,
      merchantName: cleanMerchant,
      merchantCity: cleanCity,
      amountCents: firstGuestChargeCents,
      txId: `RACHA${Date.now().toString(36).toUpperCase()}`.slice(0, 25),
      infoAdicional: description.trim() || "Racha de conta",
      defaultMerchantName: "Anfitriao",
      defaultMerchantCity: "BRASIL",
    }) ?? "";

  const nowIso = new Date().toISOString();

  return {
    title: description.trim() || "Racha de Despesa",
    total_cents: totalCents,
    date: splitDate,
    people_count: peopleCount,
    guest_share_cents: firstGuestShareCents,
    host_share_cents: hostShareCents,
    participants: participants.map((name, i) => {
      const isHost = i === 0;
      const trimmed = name.trim();
      const shareCents = effectiveShares[i] ?? (isHost ? hostShareCents : firstGuestShareCents);
      return {
        id: `p_${i + 1}`,
        name: isHost
          ? (trimmed && !trimmed.toLowerCase().includes("você") ? trimmed : resolvedHostName)
          : (trimmed || `Participante ${i + 1}`),
        share_cents: shareCents,
        is_host: isHost,
        is_settled: isHost,
        settled_cents: isHost ? shareCents : 0,
        settled_at: isHost ? nowIso : null,
      };
    }),
    remainder_policy: remainderPolicy,
    split_mode: splitMode,
    host_name: resolvedHostName,
    host_city: cleanCity,
    pix_key: pixKey.trim(),
    pix_key_type: detectedType,
    pix_br_code: pixBrCode,
    expense_id: expense?.id,
    installment_group_id: instGroupId,
    debt_id: linkedDebtId ?? undefined,
    category_id: expense?.category_id,
    category_name: categoryName,
    category_icon: categoryIcon,
    is_completed: false,
    total_settled_cents: 0,
    installments_count: instCount > 1 ? instCount : undefined,
    installments_mode: instCount > 1 ? effectiveInstMode : undefined,
    participant_installments: participantInstallments.length > 0 ? participantInstallments : undefined,
    custom_note: customNote?.trim() || null,
    show_participants_list: true,
    public_page_paused: false,
    due_date: dueDate ?? undefined,
  };
}
