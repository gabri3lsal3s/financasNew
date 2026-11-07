import { useState, useMemo } from "react";
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
  useUpdateExpense,
  useUpdatePublicShare,
} from "@/state";
import { triggerSensory } from "@/services/sensory";
import { pushToast } from "@/services/toast";
import { formatCentsAsCurrency } from "@/services/masks";
import { formatDateBR } from "@/lib/date";
import type { PublicShare, SplitParticipantItem, SplitPaymentSignal, SplitSharePayload } from "@/types";

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
  const { data: shares } = useMyPublicShares("split");
  const { data: debts } = useDebts();
  const updateShareMutation = useUpdatePublicShare();
  const updateExpenseMutation = useUpdateExpense();
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
      // 1. Atualiza lista de participantes marcando o participante como quitado
      const updatedParticipants = (payload.participants ?? []).map((p) => {
        const isTarget =
          (participant && p.id === participant.id) ||
          p.name.trim().toLowerCase() === signal.participant_name.trim().toLowerCase();

        if (isTarget) {
          return {
            ...p,
            is_settled: true,
            settled_cents: signal.amount_cents,
            settled_at: new Date().toISOString(),
            has_payment_signal: false,
          };
        }
        return p;
      });

      // 2. Atualiza status do sinal para 'confirmed'
      const updatedSignals = (payload.payment_signals ?? []).map((s) => {
        if (s.id === signal.id) {
          return {
            ...s,
            status: "confirmed" as const,
          };
        }
        return s;
      });

      const totalSettledFromFriends = updatedParticipants
        .filter((p) => !p.is_host)
        .reduce((acc, f) => acc + (f.is_settled ? Number(f.settled_cents ?? f.share_cents) : 0), 0);

      const friends = updatedParticipants.filter((p) => !p.is_host);
      const allSettled = friends.length > 0 && friends.every((p) => p.is_settled);

      const newPayload: SplitSharePayload = {
        ...payload,
        participants: updatedParticipants,
        payment_signals: updatedSignals,
        total_settled_cents: totalSettledFromFriends,
        is_completed: allSettled || Boolean(payload.is_completed),
      };

      await updateShareMutation.mutateAsync({
        id: share.id,
        payload: newPayload as unknown as Record<string, unknown>,
      });

      // 3. Recalcula o peso contábil da despesa no extrato se houver despesa vinculada
      if (payload.expense_id) {
        try {
          const totalCents = Number(payload.total_cents ?? 0);
          const netCost = Math.max(0, totalCents - totalSettledFromFriends);
          const weight = totalCents > 0 ? netCost / totalCents : 1;

          await updateExpenseMutation.mutateAsync({
            id: payload.expense_id,
            input: {
              report_weight: weight,
            },
          });
        } catch (err) {
          console.warn("Não foi possível atualizar peso contábil da despesa vinculada:", err);
        }
      }

      // 4. Sincroniza a dívida a receber vinculada
      const linkedDebt = debts?.find(
        (d) => d.expense_id === payload.expense_id || d.id === payload.debt_id,
      );
      if (linkedDebt && !linkedDebt.paid_at) {
        try {
          const totalFriendsExpectedCents = friends.reduce((acc, f) => acc + f.share_cents, 0);
          const remainingReceivableCents = Math.max(0, totalFriendsExpectedCents - totalSettledFromFriends);

          if (allSettled || remainingReceivableCents === 0) {
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
    <Card className={`border-border/80 bg-surface shadow-xs p-4 sm:p-5 space-y-4 ${className ?? ""}`}>
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
