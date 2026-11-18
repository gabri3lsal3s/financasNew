import { useContext, useMemo, useState } from "react";
import { QueryClientContext } from "@tanstack/react-query";
import { isParticipantFullySettled, isSplitFullyCompleted } from "@/domain/finance/split-math";
import { triggerSensory } from "@/services/sensory";
import { syncSplitExpenseReportWeights } from "@/services/split-sync";
import { pushToast } from "@/services/toast";
import {
  useDebts,
  useDismissSplitPaymentSignal,
  useMyPublicShares,
  useSettleIntegratedReceivable,
  useUpdateDebt,
  useUpdatePublicShare,
} from "@/state";
import type {
  PublicShare,
  SplitParticipantInstallment,
  SplitParticipantItem,
  SplitPaymentSignal,
  SplitSharePayload,
} from "@/types";

export interface SignalItemWithContext {
  share: PublicShare;
  payload: SplitSharePayload;
  signal: SplitPaymentSignal;
  participant?: SplitParticipantItem;
}

/**
 * Gerencia leitura, liquidação (com recálculo de pesos e revogação ao concluir)
 * e dispensa de sinalizações de pagamento de rachas.
 */
export function usePendingSplitSignals() {
  const queryClient = useContext(QueryClientContext) ?? null;
  const { data: shares } = useMyPublicShares("split");
  const { data: debts } = useDebts();
  const updateShareMutation = useUpdatePublicShare();
  const updateDebtMutation = useUpdateDebt();
  const settleDebtMutation = useSettleIntegratedReceivable();
  const dismissSignalMutation = useDismissSplitPaymentSignal();
  const [processingSignalId, setProcessingSignalId] = useState<string | null>(null);

  const pendingSignals = useMemo(() => {
    if (!shares || shares.length === 0) return [];
    const items: SignalItemWithContext[] = [];

    for (const share of shares) {
      const payload = (share.payload ?? null) as SplitSharePayload | null;
      if (!payload || payload.is_completed) continue;
      for (const sig of payload.payment_signals ?? []) {
        if (sig.status !== "pending") continue;
        const participant = (payload.participants ?? []).find(
          (p) =>
            (sig.participant_id && p.id === sig.participant_id) ||
            p.name.trim().toLowerCase() === sig.participant_name.trim().toLowerCase(),
        );
        items.push({ share, payload, signal: sig, participant });
      }
    }
    return items;
  }, [shares]);

  const handleConfirmSettle = async (item: SignalItemWithContext) => {
    setProcessingSignalId(item.signal.id);
    const { share, payload, signal, participant } = item;

    try {
      const participantsList: SplitParticipantItem[] = (payload.participants ?? []).map((p, idx) => ({
        ...p,
        id: p.id || `p_${idx + 1}`,
      }));
      const currentInsts: SplitParticipantInstallment[] = payload.participant_installments ?? [];
      let targetParticipantId = participant?.id;
      if (!targetParticipantId) {
        targetParticipantId = participantsList.find(
          (p) => p.name.trim().toLowerCase() === signal.participant_name.trim().toLowerCase(),
        )?.id;
      }
      if (!targetParticipantId) {
        const guestOnly = participantsList.filter((p) => !p.is_host);
        if (guestOnly.length === 1) targetParticipantId = guestOnly[0]?.id;
      }

      let installmentUpdated = false;
      const updatedInstallments = currentInsts.map((inst) => {
        const isTarget =
          (signal.installment_id && inst.id === signal.installment_id) ||
          (!signal.installment_id &&
            targetParticipantId &&
            inst.participant_id === targetParticipantId &&
            !inst.is_settled &&
            !installmentUpdated);
        if (!isTarget) return inst;
        installmentUpdated = true;
        return {
          ...inst,
          is_settled: true,
          settled_at: new Date().toISOString(),
          signal_status: "none" as const,
        };
      });

      const updatedParticipants = participantsList.map((p) => {
        const isTarget =
          (targetParticipantId && p.id === targetParticipantId) ||
          p.name.trim().toLowerCase() === signal.participant_name.trim().toLowerCase();
        if (!isTarget) return p;

        let friendInsts = updatedInstallments.filter((i) => i.participant_id === p.id);
        if (friendInsts.length === 0 && participantsList.filter((x) => !x.is_host).length === 1) {
          const hostId = participantsList.find((x) => x.is_host)?.id;
          friendInsts = updatedInstallments.filter((i) => i.participant_id !== hostId);
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
          settled_at: fullySettled ? p.settled_at || new Date().toISOString() : null,
          has_payment_signal: false,
        };
      });

      const updatedSignals = (payload.payment_signals ?? []).map((s) =>
        s.id === signal.id ? { ...s, status: "confirmed" as const, confirmed_at: new Date().toISOString() } : s,
      );
      const totalSettledFromFriends = updatedParticipants
        .filter((p) => !p.is_host)
        .reduce((acc, f) => acc + (f.is_settled ? Number(f.settled_cents ?? f.share_cents) : Number(f.settled_cents ?? 0)), 0);
      const friends = updatedParticipants.filter((p) => !p.is_host);
      const allCompleted = isSplitFullyCompleted(updatedParticipants, updatedInstallments);

      const newPayload: SplitSharePayload = {
        ...payload,
        participants: updatedParticipants,
        participant_installments: updatedInstallments.length > 0 ? updatedInstallments : undefined,
        payment_signals: updatedSignals,
        total_settled_cents: totalSettledFromFriends,
        is_completed: allCompleted,
      };

      await updateShareMutation.mutateAsync({
        id: share.id,
        payload: newPayload as unknown as Record<string, unknown>,
        isRevoked: allCompleted,
      });

      if (payload.expense_id) {
        try {
          const hostId = updatedParticipants.find((p) => p.is_host)?.id;
          await syncSplitExpenseReportWeights({
            expenseId: payload.expense_id,
            installments: updatedInstallments,
            hostId,
            totalCents: payload.total_cents,
            installmentsCount: payload.installments_count,
            groupId: payload.installment_group_id,
          });
          if (queryClient) {
            void queryClient.invalidateQueries({ queryKey: ["expenses"] });
            void queryClient.invalidateQueries({ queryKey: ["card-expenses"] });
          }
        } catch (err) {
          console.warn("Não foi possível sincronizar pesos contábeis das parcelas:", err);
        }
      }

      const linkedDebt = debts?.find((d) => d.expense_id === payload.expense_id || d.id === payload.debt_id);
      if (linkedDebt && !linkedDebt.paid_at) {
        try {
          const totalFriendsExpectedCents = friends.reduce((acc, f) => acc + f.share_cents, 0);
          const remainingCents = Math.max(0, totalFriendsExpectedCents - totalSettledFromFriends);
          if (allCompleted || remainingCents === 0) {
            await settleDebtMutation.mutateAsync({ debtId: linkedDebt.id, result: linkedDebt.amount });
          } else {
            await updateDebtMutation.mutateAsync({ id: linkedDebt.id, input: { amount: remainingCents / 100 } });
          }
        } catch (err) {
          console.warn("Não foi possível sincronizar dívida vinculada ao abater racha:", err);
        }
      }

      triggerSensory("success");
      pushToast({
        title: "Pagamento abatido com sucesso!",
        description: `A cota de ${signal.participant_name} foi confirmada e o custo contábil foi recalculado.`,
        variant: "success",
      });
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao confirmar abatimento",
        description: "Não foi possível abater o pagamento do racha. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setProcessingSignalId(null);
    }
  };

  const handleDismiss = async (item: SignalItemWithContext) => {
    setProcessingSignalId(item.signal.id);
    try {
      await dismissSignalMutation.mutateAsync({ shareId: item.share.id, signalId: item.signal.id });
      triggerSensory("action");
      pushToast({
        title: "Aviso desconsiderado",
        description: `${item.signal.participant_name} continuará com a cota pendente de pagamento.`,
        variant: "default",
      });
    } catch {
      triggerSensory("destructive");
      pushToast({
        title: "Erro ao desconsiderar aviso",
        description: "Não foi possível atualizar a sinalização. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setProcessingSignalId(null);
    }
  };

  return { pendingSignals, processingSignalId, handleConfirmSettle, handleDismiss };
}
