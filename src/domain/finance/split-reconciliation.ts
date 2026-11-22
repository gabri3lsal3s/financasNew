/**
 * Motor Puro de Reconciliação, Edição e Sincronização Contábil de Rachas (split-reconciliation.ts).
 *
 * Fonte única da verdade para:
 * - Cálculo de `report_weight` das despesas vinculadas (à vista, parcelado mês a mês e parcelado à vista)
 * - Transições de baixa, parcial, calote, estorno, sinalização e finalização
 * - Recálculo completo em edição (participantes, cotas iguais/customizadas, valores, parcelas e Pix BR Code)
 * - Cálculo de expiração segura para links à vista e parcelados
 *
 * Motor 100% puro: sem dependências de UI, React ou Supabase (AGENTS.md §3).
 */

import { buildPixTransferCode, type PixKeyType } from "@/domain/pix";
import type {
  SplitParticipantInstallment,
  SplitParticipantItem,
  SplitPaymentSignal,
  SplitSharePayload,
} from "@/types";
import {
  amortizeSettlementAcrossInstallments,
  buildSplitParticipantInstallments,
  calculateInstallmentReportWeight,
  isParticipantFullySettled,
  isSplitFullyCompleted,
  splitAmountEqually,
  splitCustomWithRemainder,
  type SplitRemainderPolicy,
} from "./split-math";

export interface SplitExpenseWeightTarget {
  expenseId: string;
  targetWeight: number;
  changed: boolean;
}

export interface ComputeSplitExpenseWeightsInput {
  expenses: readonly {
    id: string;
    value: number;
    installment_number?: number | null;
    installments_total?: number | null;
    report_weight?: number | null;
  }[];
  participants: readonly SplitParticipantItem[];
  installments?: readonly SplitParticipantInstallment[] | null;
  installmentsMode?: "single_total" | "per_installment";
  totalCents: number;
}

/**
 * Normaliza lista de participantes garantindo IDs estáveis e consistência do anfitrião.
 */
export function normalizeSplitParticipants(payload: SplitSharePayload): SplitParticipantItem[] {
  const list = payload.participants ?? [];
  if (list.length > 0) {
    return list.map((p, idx) => {
      const isHost = Boolean(p.is_host);
      const settledCents = isHost
        ? Number(p.settled_cents ?? p.share_cents)
        : Math.max(0, Number(p.settled_cents ?? (p.is_settled ? p.share_cents : 0)));
      return {
        ...p,
        id: p.id || `p_${idx + 1}`,
        is_host: isHost,
        is_settled: isHost ? true : Boolean(p.is_settled),
        settled_cents: settledCents,
      };
    });
  }

  const count = Math.max(2, Number(payload.people_count ?? 2));
  const totalCents = Math.max(0, Number(payload.total_cents ?? 0));
  const guestCents = Number(payload.guest_share_cents ?? Math.round(totalCents / count));
  const hostCents = Number(payload.host_share_cents ?? Math.max(0, totalCents - guestCents * (count - 1)));
  const result: SplitParticipantItem[] = [
    {
      id: "p_1",
      name: payload.host_name?.trim() || "Anfitrião",
      share_cents: hostCents,
      is_host: true,
      is_settled: true,
      settled_cents: hostCents,
    },
  ];
  for (let i = 1; i < count; i++) {
    result.push({
      id: `p_${i + 1}`,
      name: `Participante ${i + 1}`,
      share_cents: guestCents,
      is_host: false,
      is_settled: false,
      settled_cents: 0,
    });
  }
  return result;
}

/**
 * Soma total já recebido exclusivamente dos convidados (nunca inclui a cota do anfitrião).
 */
export function sumSettledFromFriendsCents(participants: readonly SplitParticipantItem[]): number {
  return participants
    .filter((p) => !p.is_host)
    .reduce((acc, p) => {
      const settled = Number(p.settled_cents ?? (p.is_settled ? p.share_cents : 0));
      return acc + Math.max(0, Math.round(settled));
    }, 0);
}

/**
 * Soma total esperado exclusivamente dos convidados.
 */
export function sumExpectedFromFriendsCents(participants: readonly SplitParticipantItem[]): number {
  return participants
    .filter((p) => !p.is_host)
    .reduce((acc, p) => acc + Math.max(0, Math.round(Number(p.share_cents ?? 0))), 0);
}

/**
 * Calcula o peso contábil (`report_weight`) exato para cada linha de despesa vinculada ao racha.
 * Cobre uniformemente:
 * 1. Despesa à vista (1x) usando `participants` diretamente (corrige o bug onde `installments` vazio zerava o desconto).
 * 2. Despesa parcelada com cobrança mês a mês (`per_installment`) descontando por parcela e amortizando extras.
 * 3. Despesa parcelada com recebimento à vista (`single_total`) distribuindo o abatimento proporcionalmente nas parcelas.
 */
export function computeSplitExpenseWeights(
  input: ComputeSplitExpenseWeightsInput,
): SplitExpenseWeightTarget[] {
  const { expenses, participants, installments, installmentsMode, totalCents } = input;
  if (expenses.length === 0) return [];

  const hostIds = new Set(participants.filter((p) => p.is_host && p.id).map((p) => p.id!));
  const friendInstallments = (installments ?? []).filter((i) => !hostIds.has(i.participant_id));
  const totalSettledFriends = sumSettledFromFriendsCents(participants);

  const isMultiInstallment =
    expenses.length > 1 || expenses.some((e) => Number(e.installments_total ?? 1) > 1);

  // Caso 1: Despesa à vista (1x)
  if (!isMultiInstallment) {
    const exp = expenses[0]!;
    const expBaseCents = Math.round(Number(exp.value) * 100) || totalCents;
    const targetWeight = calculateInstallmentReportWeight(expBaseCents, totalSettledFriends);
    const currentWeight = Number((exp.report_weight ?? 1).toFixed(4));
    return [
      {
        expenseId: exp.id,
        targetWeight,
        changed: currentWeight !== targetWeight,
      },
    ];
  }

  // Caso 2: Parcelada mês a mês (per_installment) com cronograma de parcelas
  if (installmentsMode !== "single_total" && friendInstallments.length > 0) {
    // Calcula eventual saldo parcial além das parcelas integralmente marcadas por amigo
    const extraPartialByInstNumber = new Map<number, number>();
    const friends = participants.filter((p) => !p.is_host);
    for (const friend of friends) {
      const fInsts = friendInstallments
        .filter(
          (i) =>
            i.participant_id === friend.id ||
            (friends.length === 1 && !hostIds.has(i.participant_id)),
        )
        .sort((a, b) => a.installment_number - b.installment_number);

      const settledByInstSum = fInsts
        .filter((i) => i.is_settled)
        .reduce((acc, i) => acc + i.amount_cents, 0);
      const friendSettledTotal = Number(
        friend.settled_cents ?? (friend.is_settled ? friend.share_cents : 0),
      );
      let extraCents = Math.max(0, friendSettledTotal - settledByInstSum);
      if (extraCents > 0) {
        for (const inst of fInsts) {
          if (inst.is_settled || extraCents <= 0) continue;
          const absorb = Math.min(inst.amount_cents, extraCents);
          extraPartialByInstNumber.set(
            inst.installment_number,
            (extraPartialByInstNumber.get(inst.installment_number) ?? 0) + absorb,
          );
          extraCents -= absorb;
        }
      }
    }

    return expenses.map((exp) => {
      const num = exp.installment_number ?? 1;
      const settledForInst =
        friendInstallments
          .filter((i) => i.installment_number === num && i.is_settled)
          .reduce((acc, i) => acc + i.amount_cents, 0) +
        (extraPartialByInstNumber.get(num) ?? 0);

      const expBaseCents = Math.round(Number(exp.value) * 100);
      const targetWeight = calculateInstallmentReportWeight(expBaseCents, settledForInst);
      const currentWeight = Number((exp.report_weight ?? 1).toFixed(4));
      return {
        expenseId: exp.id,
        targetWeight,
        changed: currentWeight !== targetWeight,
      };
    });
  }

  // Caso 3: Parcelada com recebimento à vista (`single_total`) ou sem cronograma de parcelas
  const sumGroupValueCents = expenses.reduce((acc, e) => acc + Math.round(Number(e.value) * 100), 0);
  const effectiveTotalCents =
    expenses.length > 1 ? sumGroupValueCents : Math.max(totalCents, sumGroupValueCents);
  const groupWeight = calculateInstallmentReportWeight(effectiveTotalCents, totalSettledFriends);

  return expenses.map((exp) => {
    const currentWeight = Number((exp.report_weight ?? 1).toFixed(4));
    return {
      expenseId: exp.id,
      targetWeight: groupWeight,
      changed: currentWeight !== groupWeight,
    };
  });
}

export type SplitSettlementAction =
  | { type: "settle_full_participant"; participantId: string }
  | { type: "settle_custom_participant"; participantId: string; settledCents: number }
  | { type: "unsettle_participant"; participantId: string }
  | { type: "toggle_installment"; installmentId: string; markSettled: boolean }
  | { type: "confirm_signal"; signalId: string }
  | { type: "settle_all" }
  | { type: "finalize_as_is" }
  | { type: "reopen" };

export interface SplitSettlementTransitionResult {
  nextPayload: SplitSharePayload;
  totalSettledFromFriendsCents: number;
  totalFriendsExpectedCents: number;
  remainingReceivableCents: number;
  hostNetCostCents: number;
  isCompleted: boolean;
}

/**
 * Aplica uma transição de quitação/estorno sobre o racha e retorna o novo payload
 * juntamente com todos os totais derivados (sem risco de estado obsoleto/closure stale).
 */
export function applySplitSettlementTransition(
  payload: SplitSharePayload,
  action: SplitSettlementAction,
  nowIso: string = new Date().toISOString(),
): SplitSettlementTransitionResult {
  let participants = normalizeSplitParticipants(payload);
  let installments: SplitParticipantInstallment[] = [...(payload.participant_installments ?? [])];
  let signals: SplitPaymentSignal[] = [...(payload.payment_signals ?? [])];
  let explicitCompleted: boolean | undefined;

  const totalCents = Math.max(0, Number(payload.total_cents ?? 0));

  switch (action.type) {
    case "settle_full_participant": {
      const targetId = action.participantId;
      participants = participants.map((p) =>
        p.id === targetId && !p.is_host
          ? {
              ...p,
              is_settled: true,
              settled_cents: p.share_cents,
              settled_at: nowIso,
              has_payment_signal: false,
            }
          : p,
      );
      installments = installments.map((inst) =>
        inst.participant_id === targetId
          ? { ...inst, is_settled: true, settled_at: nowIso, signal_status: "none" as const }
          : inst,
      );
      signals = signals.map((s) =>
        s.status === "pending" && s.participant_id === targetId
          ? { ...s, status: "confirmed" as const, confirmed_at: nowIso }
          : s,
      );
      break;
    }

    case "settle_custom_participant": {
      const targetId = action.participantId;
      const safeSettled = Math.max(0, Math.round(action.settledCents));
      const target = participants.find((p) => p.id === targetId);
      const cappedSettled = totalCents > 0 ? Math.min(safeSettled, totalCents) : safeSettled;

      const myInsts = installments.filter((i) => i.participant_id === targetId);
      if (myInsts.length > 0) {
        const amortized = amortizeSettlementAcrossInstallments(myInsts, cappedSettled);
        const byId = new Map(amortized.updatedInstallments.map((i) => [i.id, i]));
        installments = installments.map((i) => {
          const updated = byId.get(i.id);
          return updated ? { ...updated, signal_status: "none" as const } : i;
        });
      }

      const updatedTargetInsts = installments.filter((i) => i.participant_id === targetId);
      const fullySettled = target
        ? isParticipantFullySettled({ ...target, settled_cents: cappedSettled }, updatedTargetInsts)
        : false;

      participants = participants.map((p) =>
        p.id === targetId && !p.is_host
          ? {
              ...p,
              is_settled: fullySettled,
              settled_cents: cappedSettled,
              settled_at: cappedSettled > 0 ? nowIso : null,
              has_payment_signal: false,
            }
          : p,
      );

      if (fullySettled) {
        signals = signals.map((s) =>
          s.status === "pending" && s.participant_id === targetId
            ? { ...s, status: "confirmed" as const, confirmed_at: nowIso }
            : s,
        );
      }
      break;
    }

    case "unsettle_participant": {
      const targetId = action.participantId;
      participants = participants.map((p) =>
        p.id === targetId && !p.is_host
          ? {
              ...p,
              is_settled: false,
              settled_cents: 0,
              settled_at: null,
              has_payment_signal: false,
            }
          : p,
      );
      installments = installments.map((inst) =>
        inst.participant_id === targetId
          ? { ...inst, is_settled: false, settled_at: null, signal_status: "none" as const }
          : inst,
      );
      explicitCompleted = false;
      break;
    }

    case "toggle_installment": {
      const target = installments.find((i) => i.id === action.installmentId);
      if (target) {
        installments = installments.map((i) =>
          i.id === action.installmentId
            ? {
                ...i,
                is_settled: action.markSettled,
                settled_at: action.markSettled ? nowIso : null,
                signal_status: "none" as const,
              }
            : i,
        );
        const pInsts = installments.filter((i) => i.participant_id === target.participant_id);
        const settledCents = pInsts
          .filter((i) => i.is_settled)
          .reduce((acc, i) => acc + i.amount_cents, 0);
        const targetP = participants.find((p) => p.id === target.participant_id);
        const allSettled = targetP
          ? isParticipantFullySettled({ ...targetP, settled_cents: settledCents }, pInsts)
          : pInsts.length > 0 && pInsts.every((i) => i.is_settled);

        participants = participants.map((p) =>
          p.id === target.participant_id && !p.is_host
            ? {
                ...p,
                is_settled: allSettled,
                settled_cents: settledCents,
                settled_at: allSettled ? (p.settled_at || nowIso) : null,
                has_payment_signal: pInsts.some((i) => i.signal_status === "pending_confirmation"),
              }
            : p,
        );

        if (action.markSettled) {
          signals = signals.map((s) =>
            s.status === "pending" &&
            (s.installment_id === action.installmentId ||
              s.installment_ids?.includes(action.installmentId))
              ? { ...s, status: "confirmed" as const, confirmed_at: nowIso }
              : s,
          );
        } else {
          explicitCompleted = false;
        }
      }
      break;
    }

    case "confirm_signal": {
      const signal = signals.find((s) => s.id === action.signalId);
      if (signal) {
        let targetParticipantId =
          signal.participant_id ||
          participants.find(
            (p) =>
              !p.is_host &&
              p.name.trim().toLowerCase() === signal.participant_name.trim().toLowerCase(),
          )?.id;

        if (!targetParticipantId) {
          const guests = participants.filter((p) => !p.is_host);
          if (guests.length === 1) {
            targetParticipantId = guests[0]?.id;
          }
        }

        const explicitInstIds = new Set<string>([
          ...(signal.installment_id ? [signal.installment_id] : []),
          ...(signal.installment_ids ?? []),
        ]);

        let singleMatched = false;
        installments = installments.map((inst) => {
          const isTarget =
            explicitInstIds.size > 0
              ? explicitInstIds.has(inst.id)
              : Boolean(
                  targetParticipantId &&
                    inst.participant_id === targetParticipantId &&
                    !inst.is_settled &&
                    !singleMatched,
                );
          if (!isTarget) return inst;
          singleMatched = true;
          return {
            ...inst,
            is_settled: true,
            settled_at: nowIso,
            signal_status: "none" as const,
          };
        });

        signals = signals.map((s) =>
          s.id === signal.id
            ? { ...s, status: "confirmed" as const, confirmed_at: nowIso }
            : s,
        );

        const hasOtherPendingForParticipant = (participantId?: string, participantName?: string) =>
          signals.some(
            (s) =>
              s.status === "pending" &&
              ((participantId && s.participant_id === participantId) ||
                (participantName &&
                  s.participant_name.trim().toLowerCase() === participantName.trim().toLowerCase())),
          );

        participants = participants.map((p) => {
          if (p.is_host) return p;
          const isTarget =
            (targetParticipantId && p.id === targetParticipantId) ||
            p.name.trim().toLowerCase() === signal.participant_name.trim().toLowerCase();
          if (!isTarget) return p;

          const guests = participants.filter((x) => !x.is_host);
          let friendInsts = installments.filter((i) => i.participant_id === p.id);
          if (friendInsts.length === 0 && guests.length === 1) {
            const hostId = participants.find((x) => x.is_host)?.id;
            friendInsts = installments.filter((i) => i.participant_id !== hostId);
          }

          const settledCents =
            friendInsts.length > 0
              ? friendInsts.filter((i) => i.is_settled).reduce((acc, i) => acc + i.amount_cents, 0)
              : Math.min(p.share_cents, Number(p.settled_cents ?? 0) + signal.amount_cents);

          const fullySettled = isParticipantFullySettled({ ...p, settled_cents: settledCents }, friendInsts);

          return {
            ...p,
            is_settled: fullySettled,
            settled_cents: settledCents,
            settled_at: fullySettled ? (p.settled_at || nowIso) : null,
            has_payment_signal: hasOtherPendingForParticipant(p.id, p.name),
          };
        });
      }
      break;
    }

    case "settle_all": {
      participants = participants.map((p) =>
        p.is_host
          ? p
          : {
              ...p,
              is_settled: true,
              settled_cents: p.share_cents,
              settled_at: p.settled_at || nowIso,
              has_payment_signal: false,
            },
      );
      installments = installments.map((inst) => ({
        ...inst,
        is_settled: true,
        settled_at: inst.settled_at || nowIso,
        signal_status: "none" as const,
      }));
      signals = signals.map((s) =>
        s.status === "pending"
          ? { ...s, status: "confirmed" as const, confirmed_at: nowIso }
          : s,
      );
      explicitCompleted = true;
      break;
    }

    case "finalize_as_is": {
      explicitCompleted = true;
      break;
    }

    case "reopen": {
      explicitCompleted = false;
      // Se todos os amigos estavam marcados como quitados e o anfitrião reabriu explicitamente,
      // reverte o status concluído se houver necessidade ou mantém para edição sem arquivamento.
      if (isSplitFullyCompleted(participants, installments)) {
        participants = participants.map((p) =>
          p.is_host
            ? p
            : { ...p, is_settled: false, settled_cents: 0, settled_at: null },
        );
        installments = installments.map((inst) =>
          participants.find((p) => p.id === inst.participant_id)?.is_host
            ? inst
            : { ...inst, is_settled: false, settled_at: null },
        );
      }
      break;
    }
  }

  const totalSettledFromFriendsCents = sumSettledFromFriendsCents(participants);
  const totalFriendsExpectedCents = sumExpectedFromFriendsCents(participants);
  const remainingReceivableCents = Math.max(0, totalFriendsExpectedCents - totalSettledFromFriendsCents);
  const hostNetCostCents = Math.max(0, totalCents - totalSettledFromFriendsCents);
  const isCompleted =
    explicitCompleted !== undefined
      ? explicitCompleted
      : isSplitFullyCompleted(participants, installments);

  const nextPayload: SplitSharePayload = {
    ...payload,
    participants,
    participant_installments: installments.length > 0 ? installments : undefined,
    payment_signals: signals.length > 0 ? signals : undefined,
    total_settled_cents: totalSettledFromFriendsCents,
    is_completed: isCompleted,
    public_page_paused: action.type === "reopen" ? false : payload.public_page_paused,
  };

  return {
    nextPayload,
    totalSettledFromFriendsCents,
    totalFriendsExpectedCents,
    remainingReceivableCents,
    hostNetCostCents,
    isCompleted,
  };
}

export interface SplitEditParticipantInput {
  id?: string;
  name: string;
  isHost: boolean;
  fixedCents?: number | null;
}

export interface SplitEditInput {
  title: string;
  totalCents: number;
  date: string;
  splitMode: "equal" | "custom";
  remainderPolicy: SplitRemainderPolicy;
  participants: readonly SplitEditParticipantInput[];
  scaleCustomProportionally?: boolean;
  installmentsCount?: number;
  installmentsMode?: "single_total" | "per_installment";
  closingDay?: number | null;
  pixKey: string;
  pixKeyType: PixKeyType;
  hostName: string;
  hostCity: string;
  customNote?: string | null;
  showParticipantsList?: boolean;
  publicPagePaused?: boolean;
  dueDate?: string | null;
  categoryId?: string;
  categoryName?: string;
  categoryIcon?: string;
}

export interface OverpaidParticipantNotice {
  participantId: string;
  name: string;
  previousSettledCents: number;
  newShareCents: number;
  excessCents: number;
}

export interface RecalculateSplitOnEditResult {
  nextPayload: SplitSharePayload;
  totalSettledFromFriendsCents: number;
  totalFriendsExpectedCents: number;
  remainingReceivableCents: number;
  hostNetCostCents: number;
  isCompleted: boolean;
  overpaidParticipants: OverpaidParticipantNotice[];
}

/**
 * Recalcula integralmente um racha após edição pelo anfitrião ou sincronização da despesa:
 * - Recalcula cotas (iguais ou customizadas) garantindo soma exata == totalCents
 * - Preserva pagamentos já recebidos (`settled_cents`, `has_payment_signal`) por `id`
 * - Detecta participantes que já pagaram acima da nova cota
 * - Reconstrói parcelas mensais re-amortizando o saldo já pago
 * - Regenera `pix_br_code` EMV com os novos parâmetros
 */
export function recalculateSplitPayloadOnEdit(
  currentPayload: SplitSharePayload,
  edit: SplitEditInput,
  nowIso: string = new Date().toISOString(),
): RecalculateSplitOnEditResult {
  const safeTotalCents = Math.max(0, Math.round(edit.totalCents));
  const cleanTitle = edit.title.trim() || "Racha de Despesa";
  const cleanHostName = edit.hostName.trim() || "Anfitrião";
  const cleanHostCity = edit.hostCity.trim() || "SAO PAULO";
  const cleanPixKey = edit.pixKey.trim();

  // Garante anfitrião no índice 0 e pelo menos 2 pessoas quando possível
  const sortedInputs = [...edit.participants].sort((a, b) => Number(b.isHost) - Number(a.isHost));
  const normalizedInputs = sortedInputs.map((p, idx) => ({
    id: p.id || `p_${idx + 1}`,
    name: p.name.trim() || (p.isHost || idx === 0 ? cleanHostName : `Participante ${idx + 1}`),
    isHost: p.isHost || idx === 0,
    fixedCents: p.fixedCents ?? null,
  }));

  const prevParticipantsById = new Map(
    normalizeSplitParticipants(currentPayload).map((p) => [p.id!, p]),
  );
  const prevInstallmentByKey = new Map(
    (currentPayload.participant_installments ?? []).map((inst) => [
      `${inst.participant_id}::${inst.installment_number}`,
      inst,
    ]),
  );

  let computedShares: number[];
  if (edit.splitMode === "custom") {
    const fixedSum = normalizedInputs.reduce(
      (acc, p) =>
        p.fixedCents !== null && p.fixedCents !== undefined
          ? acc + Math.max(0, Math.round(p.fixedCents))
          : acc,
      0,
    );
    const refShares = normalizedInputs.map((p) =>
      p.fixedCents !== null && p.fixedCents !== undefined
        ? Math.max(0, Math.round(p.fixedCents))
        : Math.max(0, prevParticipantsById.get(p.id)?.share_cents ?? 0),
    );
    const refSum = refShares.reduce((acc, s) => acc + s, 0);

    if (edit.scaleCustomProportionally || fixedSum > safeTotalCents) {
      if (refSum > 0) {
        computedShares = refShares.map((s) => Math.floor((s * safeTotalCents) / refSum));
        const allocated = computedShares.reduce((acc, s) => acc + s, 0);
        const hostIdx = Math.max(0, normalizedInputs.findIndex((p) => p.isHost));
        computedShares[hostIdx] = (computedShares[hostIdx] ?? 0) + (safeTotalCents - allocated);
      } else {
        computedShares = splitAmountEqually(safeTotalCents, normalizedInputs.length, {
          remainderPolicy: edit.remainderPolicy,
        });
      }
    } else {
      const customResults = splitCustomWithRemainder(
        safeTotalCents,
        normalizedInputs.map((p) => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost,
          fixedCents:
            p.fixedCents !== null && p.fixedCents !== undefined
              ? Math.max(0, Math.round(p.fixedCents))
              : undefined,
          weight: 1,
        })),
      );
      computedShares = customResults.map((r) => r.shareCents);
    }
  } else {
    computedShares = splitAmountEqually(safeTotalCents, normalizedInputs.length, {
      remainderPolicy: edit.remainderPolicy,
    });
  }

  const instCount = Math.max(1, Math.min(60, Math.floor(edit.installmentsCount ?? currentPayload.installments_count ?? 1)));
  const instMode: "single_total" | "per_installment" =
    instCount > 1
      ? (edit.installmentsMode ?? currentPayload.installments_mode ?? "per_installment")
      : "single_total";

  const overpaidParticipants: OverpaidParticipantNotice[] = [];
  const nextInstallments: SplitParticipantInstallment[] = [];

  const nextParticipants: SplitParticipantItem[] = normalizedInputs.map((input, idx) => {
    const shareCents = computedShares[idx] ?? 0;
    const prev = prevParticipantsById.get(input.id);

    if (input.isHost) {
      return {
        id: input.id,
        name: input.name,
        share_cents: shareCents,
        is_host: true,
        is_settled: true,
        settled_cents: shareCents,
        settled_at: prev?.settled_at || nowIso,
      };
    }

    const prevSettled = Math.max(0, Number(prev?.settled_cents ?? (prev?.is_settled ? prev.share_cents : 0)));
    let effectiveSettled = prevSettled;
    if (prevSettled > shareCents) {
      overpaidParticipants.push({
        participantId: input.id,
        name: input.name,
        previousSettledCents: prevSettled,
        newShareCents: shareCents,
        excessCents: prevSettled - shareCents,
      });
      effectiveSettled = shareCents;
    }

    let pInsts: SplitParticipantInstallment[] = [];
    if (instCount > 1 && instMode === "per_installment") {
      const built = buildSplitParticipantInstallments({
        participantId: input.id,
        totalShareCents: shareCents,
        installmentsCount: instCount,
        startDate: edit.date,
        closingDay: edit.closingDay ?? null,
        isSettledInitial: false,
      });
      const amortized = amortizeSettlementAcrossInstallments(built, effectiveSettled);
      pInsts = amortized.updatedInstallments.map((inst) => {
        const prevInst = prevInstallmentByKey.get(`${input.id}::${inst.installment_number}`);
        if (!inst.is_settled && prevInst?.signal_status === "pending_confirmation") {
          return {
            ...inst,
            signal_status: "pending_confirmation" as const,
            signaled_at: prevInst.signaled_at ?? null,
          };
        }
        if (inst.is_settled && prevInst?.is_settled && prevInst.settled_at) {
          return {
            ...inst,
            settled_at: prevInst.settled_at,
          };
        }
        return inst;
      });
      nextInstallments.push(...pInsts);
    }

    const fullySettled = isParticipantFullySettled(
      { id: input.id, share_cents: shareCents, settled_cents: effectiveSettled, is_host: false },
      pInsts,
    );

    return {
      id: input.id,
      name: input.name,
      share_cents: shareCents,
      is_host: false,
      is_settled: fullySettled,
      settled_cents: effectiveSettled,
      settled_at: effectiveSettled > 0 ? (prev?.settled_at || nowIso) : null,
      has_payment_signal: fullySettled ? false : prev?.has_payment_signal,
      payment_signaled_at: fullySettled ? null : prev?.payment_signaled_at,
    };
  });

  const nextParticipantsById = new Map(nextParticipants.map((p) => [p.id!, p]));
  const nextSignals: SplitPaymentSignal[] = [];
  for (const sig of currentPayload.payment_signals ?? []) {
    const matchedParticipant = sig.participant_id ? nextParticipantsById.get(sig.participant_id) : undefined;
    if (sig.status === "pending") {
      if (sig.participant_id && (!matchedParticipant || matchedParticipant.is_host)) {
        continue;
      }
      if (matchedParticipant?.is_settled) {
        nextSignals.push({
          ...sig,
          participant_name: matchedParticipant.name,
          status: "confirmed",
          confirmed_at: nowIso,
        });
        continue;
      }
    }
    nextSignals.push(
      matchedParticipant ? { ...sig, participant_name: matchedParticipant.name } : sig,
    );
  }

  const hostShareCents = nextParticipants.find((p) => p.is_host)?.share_cents ?? (computedShares[0] ?? 0);
  const firstGuest = nextParticipants.find((p) => !p.is_host);
  const firstGuestShareCents = firstGuest?.share_cents ?? 0;
  const firstGuestChargeCents =
    instCount > 1 && instMode === "per_installment"
      ? (nextInstallments.find((i) => i.participant_id === firstGuest?.id && !i.is_settled)?.amount_cents ??
          nextInstallments.find((i) => i.participant_id === firstGuest?.id)?.amount_cents ??
          firstGuestShareCents)
      : firstGuestShareCents;

  const regeneratedBrCode =
    buildPixTransferCode({
      pixKey: cleanPixKey,
      keyType: edit.pixKeyType,
      merchantName: cleanHostName,
      merchantCity: cleanHostCity,
      amountCents: firstGuestChargeCents,
      txId: `RACHA${Date.now().toString(36).toUpperCase()}`.slice(0, 25),
      infoAdicional: cleanTitle,
      defaultMerchantName: "Anfitriao",
      defaultMerchantCity: "BRASIL",
    }) ?? "";

  const totalSettledFromFriendsCents = sumSettledFromFriendsCents(nextParticipants);
  const totalFriendsExpectedCents = sumExpectedFromFriendsCents(nextParticipants);
  const remainingReceivableCents = Math.max(0, totalFriendsExpectedCents - totalSettledFromFriendsCents);
  const hostNetCostCents = Math.max(0, safeTotalCents - totalSettledFromFriendsCents);
  const isCompleted =
    nextParticipants.some((p) => !p.is_host) &&
    isSplitFullyCompleted(nextParticipants, nextInstallments);

  const nextPayload: SplitSharePayload = {
    ...currentPayload,
    title: cleanTitle,
    total_cents: safeTotalCents,
    date: edit.date,
    people_count: nextParticipants.length,
    guest_share_cents: firstGuestShareCents,
    host_share_cents: hostShareCents,
    participants: nextParticipants,
    remainder_policy: edit.remainderPolicy,
    split_mode: edit.splitMode,
    host_name: cleanHostName,
    host_city: cleanHostCity,
    pix_key: cleanPixKey,
    pix_key_type: edit.pixKeyType,
    pix_br_code: regeneratedBrCode,
    category_id: edit.categoryId ?? currentPayload.category_id,
    category_name: edit.categoryName ?? currentPayload.category_name,
    category_icon: edit.categoryIcon ?? currentPayload.category_icon,
    is_completed: isCompleted,
    total_settled_cents: totalSettledFromFriendsCents,
    installments_count: instCount > 1 ? instCount : undefined,
    installments_mode: instCount > 1 ? instMode : undefined,
    participant_installments: nextInstallments.length > 0 ? nextInstallments : undefined,
    payment_signals: nextSignals.length > 0 ? nextSignals : undefined,
    custom_note: edit.customNote !== undefined ? (edit.customNote?.trim() || null) : currentPayload.custom_note,
    show_participants_list:
      edit.showParticipantsList !== undefined
        ? edit.showParticipantsList
        : (currentPayload.show_participants_list ?? true),
    public_page_paused:
      edit.publicPagePaused !== undefined
        ? edit.publicPagePaused
        : Boolean(currentPayload.public_page_paused),
    due_date: edit.dueDate !== undefined ? edit.dueDate : currentPayload.due_date,
  };

  return {
    nextPayload,
    totalSettledFromFriendsCents,
    totalFriendsExpectedCents,
    remainingReceivableCents,
    hostNetCostCents,
    isCompleted,
    overpaidParticipants,
  };
}

/**
 * Calcula data de expiração segura para links de racha:
 * mínimo de `minDaysFromNow` dias (padrão 60) e cobrindo ao menos última parcela + 60 dias.
 */
export function resolveSplitExpirationIso(
  startDate: string,
  installmentsCount?: number | null,
  minDaysFromNow = 60,
  nowMs: number = Date.now(),
): string {
  const minFromNowMs = nowMs + minDaysFromNow * 24 * 60 * 60 * 1000;
  const count = Math.max(1, Math.floor(installmentsCount ?? 1));
  const parsed = new Date(`${startDate}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(minFromNowMs).toISOString();
  }
  const lastInstallmentDate = new Date(parsed);
  lastInstallmentDate.setUTCMonth(lastInstallmentDate.getUTCMonth() + (count - 1));
  const afterLastMs = lastInstallmentDate.getTime() + 60 * 24 * 60 * 60 * 1000;
  return new Date(Math.max(minFromNowMs, afterLastMs)).toISOString();
}
