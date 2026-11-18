import {
  amortizeSettlementAcrossInstallments,
  isParticipantFullySettled,
} from "@/domain/finance/split-math";
import type { SplitParticipantInstallment, SplitParticipantItem } from "@/types";

export interface SplitTransitionResult {
  participants: SplitParticipantItem[];
  installments: SplitParticipantInstallment[];
}

/** Aplica baixa integral de um participante e suas parcelas. */
export function applyParticipantFullSettle(
  participants: SplitParticipantItem[],
  installments: SplitParticipantInstallment[],
  participantId: string,
): SplitTransitionResult {
  const now = new Date().toISOString();
  return {
    participants: participants.map((p) =>
      p.id === participantId ? { ...p, is_settled: true, settled_cents: p.share_cents, settled_at: now } : p,
    ),
    installments: installments.map((inst) =>
      inst.participant_id === participantId ? { ...inst, is_settled: true, settled_at: now, signal_status: "none" as const } : inst,
    ),
  };
}

/** Aplica baixa personalizada/parcial com amortização pelas parcelas do participante. */
export function applyParticipantCustomSettle(
  participants: SplitParticipantItem[],
  installments: SplitParticipantInstallment[],
  participantId: string,
  settledCents: number,
): SplitTransitionResult {
  const target = participants.find((p) => p.id === participantId);
  const fullySettled = settledCents >= (target?.share_cents ?? 0);
  const now = new Date().toISOString();

  const updatedParticipants = participants.map((p) =>
    p.id === participantId ? { ...p, is_settled: fullySettled, settled_cents: settledCents, settled_at: now } : p,
  );

  const myInsts = installments.filter((i) => i.participant_id === participantId);
  if (myInsts.length > 0) {
    const map = new Map(amortizeSettlementAcrossInstallments(myInsts, settledCents).updatedInstallments.map((i) => [i.id, i]));
    return {
      participants: updatedParticipants,
      installments: installments.map((i) => map.get(i.id) ?? i),
    };
  }

  return {
    participants: updatedParticipants,
    installments: installments.map((i) =>
      i.participant_id === participantId ? { ...i, is_settled: fullySettled, settled_at: fullySettled ? now : null, signal_status: "none" as const } : i,
    ),
  };
}

/** Reverte a baixa de um participante e suas parcelas para pendente. */
export function applyParticipantUnsettle(
  participants: SplitParticipantItem[],
  installments: SplitParticipantInstallment[],
  participantId: string,
): SplitTransitionResult {
  return {
    participants: participants.map((p) =>
      p.id === participantId ? { ...p, is_settled: false, settled_cents: 0, settled_at: null } : p,
    ),
    installments: installments.map((i) =>
      i.participant_id === participantId ? { ...i, is_settled: false, settled_at: null, signal_status: "none" as const } : i,
    ),
  };
}

/** Alterna o estado pago/pendente de uma parcela individual e recalcula o participante. */
export function applyInstallmentToggle(
  participants: SplitParticipantItem[],
  installments: SplitParticipantInstallment[],
  installmentId: string,
  markSettled: boolean,
): (SplitTransitionResult & { target: SplitParticipantInstallment }) | null {
  const target = installments.find((i) => i.id === installmentId);
  if (!target) return null;

  const now = new Date().toISOString();
  const updatedInstallments = installments.map((i) =>
    i.id === installmentId ? { ...i, is_settled: markSettled, settled_at: markSettled ? now : null, signal_status: "none" as const } : i,
  );
  const pInsts = updatedInstallments.filter((i) => i.participant_id === target.participant_id);
  const settledCents = pInsts.filter((i) => i.is_settled).reduce((acc, i) => acc + i.amount_cents, 0);
  const targetP = participants.find((p) => p.id === target.participant_id);
  const allSettled = targetP
    ? isParticipantFullySettled({ ...targetP, settled_cents: settledCents }, pInsts)
    : pInsts.length > 0 && pInsts.every((i) => i.is_settled);

  return {
    target,
    installments: updatedInstallments,
    participants: participants.map((p) =>
      p.id === target.participant_id
        ? { ...p, is_settled: allSettled, settled_cents: settledCents, settled_at: allSettled ? (p.settled_at || now) : null }
        : p,
    ),
  };
}
