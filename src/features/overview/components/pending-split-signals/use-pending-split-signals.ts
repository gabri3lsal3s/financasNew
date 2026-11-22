import { useMemo, useState } from "react";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import {
  useApplySplitSettlement,
  useDebts,
  useDismissSplitPaymentSignal,
  useMyPublicShares,
} from "@/state";
import type {
  PublicShare,
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
 * Gerencia leitura, liquidação (via motor unificado de sincronização)
 * e dispensa de sinalizações de pagamento de rachas.
 */
export function usePendingSplitSignals() {
  const { data: shares } = useMyPublicShares("split");
  const { data: debts } = useDebts();
  const applySplitSettlement = useApplySplitSettlement();
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
        if (participant?.is_host) continue;
        items.push({ share, payload, signal: sig, participant });
      }
    }
    return items;
  }, [shares]);

  const handleConfirmSettle = async (item: SignalItemWithContext) => {
    setProcessingSignalId(item.signal.id);
    const { share, payload, signal } = item;

    try {
      const debtId = share.debt_id || payload.debt_id || null;
      const expenseId = share.expense_id || payload.expense_id || null;
      const groupId = share.installment_group_id || payload.installment_group_id || null;
      const linkedDebt =
        debts?.find(
          (d) =>
            (debtId && d.id === debtId) ||
            (d.type === "receivable" &&
              ((expenseId && d.expense_id === expenseId) ||
                (groupId && d.installment_group_id === groupId))),
        ) ?? null;

      await applySplitSettlement.mutateAsync({
        share,
        action: { type: "confirm_signal", signalId: signal.id },
        linkedDebt,
      });

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
