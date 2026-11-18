import { todayISO } from "@/domain/debts";
import { buildSplitParticipantInstallments, type SplitExpenseSummary, type SplitRemainderPolicy } from "@/domain/finance/split-math";
import { generatePixBrCode, type PixKeyType } from "@/domain/pix/pix-br-code";
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
    resolvedHostName, participants, summary, remainderPolicy, expense, fullExpense,
    initialDate, initialInstallmentsCount, categoryName, categoryIcon,
  } = input;

  const pixBrCode = generatePixBrCode({
    pixKey: pixKey.trim(),
    keyType: detectedType,
    merchantName: cleanMerchant,
    merchantCity: cleanCity,
    amountCents: summary.guestShareCents,
    txId: `RACHA${Date.now().toString(36).toUpperCase()}`.slice(0, 25),
    infoAdicional: description.trim().slice(0, 25) || "Racha de conta",
  });

  const splitDate = expense?.date || initialDate || todayISO();
  const instCount = Math.max(1, expense?.installments_total ?? fullExpense?.installments_total ?? initialInstallmentsCount ?? 1);
  const instGroupId = expense?.installment_group_id ?? fullExpense?.installment_group_id ?? null;

  const participantInstallments: SplitParticipantInstallment[] = [];
  if (instCount > 1) {
    participants.forEach((_name, i) => {
      participantInstallments.push(
        ...buildSplitParticipantInstallments({
          participantId: `p_${i + 1}`,
          totalShareCents: summary.shares[i] ?? summary.guestShareCents,
          installmentsCount: instCount,
          startDate: splitDate,
          isSettledInitial: i === 0,
        }),
      );
    });
  }

  return {
    title: description.trim() || "Racha de Despesa",
    total_cents: totalCents,
    date: splitDate,
    people_count: peopleCount,
    guest_share_cents: summary.guestShareCents,
    host_share_cents: summary.hostShareCents,
    participants: participants.map((name, i) => {
      const isHost = i === 0;
      const trimmed = name.trim();
      return {
        id: `p_${i + 1}`,
        name: isHost ? (trimmed && !trimmed.toLowerCase().includes("você") ? trimmed : resolvedHostName) : (trimmed || `Participante ${i + 1}`),
        share_cents: summary.shares[i] ?? summary.guestShareCents,
        is_host: isHost,
        is_settled: isHost,
        settled_cents: isHost ? (summary.shares[i] ?? summary.hostShareCents) : 0,
        settled_at: isHost ? new Date().toISOString() : null,
      };
    }),
    remainder_policy: remainderPolicy,
    host_name: resolvedHostName,
    host_city: cleanCity,
    pix_key: pixKey.trim(),
    pix_key_type: detectedType,
    pix_br_code: pixBrCode,
    expense_id: expense?.id,
    installment_group_id: instGroupId,
    category_id: expense?.category_id,
    category_name: categoryName,
    category_icon: categoryIcon,
    is_completed: false,
    total_settled_cents: summary.hostShareCents,
    installments_count: instCount > 1 ? instCount : undefined,
    installments_mode: instCount > 1 ? "per_installment" : undefined,
    participant_installments: participantInstallments.length > 0 ? participantInstallments : undefined,
  };
}
