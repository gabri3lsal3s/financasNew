import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { HandCoins, Check, X, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import {
  useDebts,
  useDismissSplitPaymentSignal,
  useMyPublicShares,
  useSettleIntegratedReceivable,
  useUpdateDebt,
  useUpdatePublicShare,
} from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatCentsAsCurrency } from "@/services/masks";
import { formatDateBR } from "@/lib/date";
import { isParticipantFullySettled, isSplitFullyCompleted } from "@/domain/finance/split-math";
import { syncSplitExpenseReportWeights } from "@/services/split-sync";
import type { PublicShare, SplitParticipantInstallment, SplitParticipantItem, SplitPaymentSignal, SplitSharePayload } from "@/types";

export interface PendingSplitSignalsCardProps {
  className?: string;
}

interface SignalItemWithContext {
  share: PublicShare;
  payload: SplitSharePayload;
  signal: SplitPaymentSignal;
  participant?: SplitParticipantItem;
}

export function PendingSplitSignalsCard({ className }: PendingSplitSignalsCardProps) {
  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    queryClient = useQueryClient();
  } catch {
    // Ambiente de teste unitário sem QueryClientProvider
  }
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

      const signals = payload.payment_signals ?? [];
      const pendingList = signals.filter((s) => s.status === "pending");

      for (const sig of pendingList) {
        const participant = (payload.participants ?? []).find(
          (p) =>
            (sig.participant_id && p.id === sig.participant_id) ||
            p.name.trim().toLowerCase() === sig.participant_name.trim().toLowerCase(),
        );

        items.push({
          share,
          payload,
          signal: sig,
          participant,
        });
      }
    }

    return items;
  }, [shares]);

  if (pendingSignals.length === 0) {
    return null;
  }

  const handleConfirmSettle = async (item: SignalItemWithContext) => {
    setProcessingSignalId(item.signal.id);
    const { share, payload, signal, participant } = item;

    try {
      // 1. Normaliza participantes com fallback de id para evitar falhas em dados legados
      const rawParticipants = payload.participants ?? [];
      const participantsList: SplitParticipantItem[] = rawParticipants.map((p, idx) => ({
        ...p,
        id: p.id || `p_${idx + 1}`,
      }));

      const currentInsts: SplitParticipantInstallment[] = payload.participant_installments ?? [];
      let targetParticipantId = participant?.id;

      if (!targetParticipantId) {
        const found = participantsList.find(
          (p) => p.name.trim().toLowerCase() === signal.participant_name.trim().toLowerCase(),
        );
        targetParticipantId = found?.id;
      }

      // Se só houver 1 amigo e o ID ainda for indeterminado, direciona para esse único amigo
      if (!targetParticipantId) {
        const guestOnly = participantsList.filter((p) => !p.is_host);
        if (guestOnly.length === 1) {
          targetParticipantId = guestOnly[0]?.id;
        }
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

        if (isTarget) {
          installmentUpdated = true;
          return {
            ...inst,
            is_settled: true,
            settled_at: new Date().toISOString(),
            signal_status: "none" as const,
          };
        }
        return inst;
      });

      // 2. Atualiza lista de participantes calculando quitação precisa
      const updatedParticipants = participantsList.map((p) => {
        const isTarget =
          (targetParticipantId && p.id === targetParticipantId) ||
          p.name.trim().toLowerCase() === signal.participant_name.trim().toLowerCase();

        if (isTarget) {
          let friendInsts = updatedInstallments.filter((i) => i.participant_id === p.id);
          if (friendInsts.length === 0 && participantsList.filter((x) => !x.is_host).length === 1) {
            const hostId = participantsList.find((x) => x.is_host)?.id;
            friendInsts = updatedInstallments.filter((i) => i.participant_id !== hostId);
          }

          const settledCents =
            friendInsts.length > 0
              ? friendInsts.filter((i) => i.is_settled).reduce((acc, i) => acc + i.amount_cents, 0)
              : Math.min(p.share_cents, Number(p.settled_cents ?? 0) + signal.amount_cents);

          const fullySettled = isParticipantFullySettled(
            { ...p, settled_cents: settledCents },
            friendInsts,
          );

          return {
            ...p,
            is_settled: fullySettled,
            settled_cents: settledCents,
            settled_at: fullySettled ? (p.settled_at || new Date().toISOString()) : null,
            has_payment_signal: false,
          };
        }
        return p;
      });

      // 3. Atualiza status do sinal para 'confirmed'
      const updatedSignals = (payload.payment_signals ?? []).map((s) => {
        if (s.id === signal.id) {
          return {
            ...s,
            status: "confirmed" as const,
            confirmed_at: new Date().toISOString(),
          };
        }
        return s;
      });

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
      });

      // 4. Sincroniza o peso contábil de TODAS as parcelas da despesa nas faturas do cartão
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

      // 5. Sincroniza a dívida a receber vinculada (apenas liquida se o racha for 100% completado)
      const linkedDebt = debts?.find(
        (d) => d.expense_id === payload.expense_id || d.id === payload.debt_id,
      );
      if (linkedDebt && !linkedDebt.paid_at) {
        try {
          const totalFriendsExpectedCents = friends.reduce((acc, f) => acc + f.share_cents, 0);
          const remainingReceivableCents = Math.max(0, totalFriendsExpectedCents - totalSettledFromFriends);

          if (allCompleted || remainingReceivableCents === 0) {
            await settleDebtMutation.mutateAsync({
              debtId: linkedDebt.id,
              result: linkedDebt.amount,
            });
          } else {
            await updateDebtMutation.mutateAsync({
              id: linkedDebt.id,
              input: {
                amount: remainingReceivableCents / 100,
              },
            });
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
      await dismissSignalMutation.mutateAsync({
        shareId: item.share.id,
        signalId: item.signal.id,
      });

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

  return (
    <Card
      data-tour="split-pending-card"
      className={`border-border/80 bg-surface shadow-xs p-4 sm:p-5 space-y-4 ${className ?? ""}`}
    >
      {/* Cabeçalho de Destaque */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-warning/15 border-warning/20 text-warning-strong">
            <HandCoins className="size-4.5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Pagamento de Racha Sinalizado
              </h3>
              <Badge variant="warning" size="xs">
                {pendingSignals.length} {pendingSignals.length === 1 ? "aviso" : "avisos"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Participantes salvaram a despesa através do link. Confirme o recebimento do Pix para abater a conta.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de Sinalizações Pendentes */}
      <div className="space-y-3 pt-1">
        {pendingSignals.map((item) => {
          const isProcessing = processingSignalId === item.signal.id;
          const signaledDate = item.signal.created_at
            ? formatDateBR(item.signal.created_at.slice(0, 10))
            : formatDateBR(item.payload.date);

          return (
            <div
              key={item.signal.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-surface/80"
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground truncate">
                    {item.signal.participant_name}
                  </span>
                  <Badge variant="muted" size="xs">
                    {item.payload.title}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Cota informada:</span>
                  <MoneyText
                    cents={item.signal.amount_cents}
                    tone="positive"
                    className="font-semibold text-xs tabular-nums"
                  />
                  <span>·</span>
                  <div className="flex items-center gap-1 text-[11px]">
                    <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span>{signaledDate}</span>
                  </div>
                </div>
              </div>

              {/* Botões de Decisão com 1-toque */}
              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => void handleDismiss(item)}
                  className="gap-1.5 h-8 text-xs cursor-pointer"
                  aria-label={`Ainda não recebi de ${item.signal.participant_name}`}
                >
                  <X className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  <span>Ainda não recebi</span>
                </Button>

                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => void handleConfirmSettle(item)}
                  className="gap-1.5 h-8 text-xs font-semibold cursor-pointer"
                  sensoryIntent="success"
                  aria-label={`Confirmar e abater ${formatCentsAsCurrency(item.signal.amount_cents)} de ${item.signal.participant_name}`}
                >
                  <Check className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                  <span>Abater {formatCentsAsCurrency(item.signal.amount_cents)}</span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
