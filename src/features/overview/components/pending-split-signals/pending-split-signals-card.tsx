import { Check, Clock, HandCoins, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { formatDateBR } from "@/lib/date";
import { formatCentsAsCurrency } from "@/services/masks";
import { usePendingSplitSignals } from "./use-pending-split-signals";

export interface PendingSplitSignalsCardProps {
  className?: string;
}

/**
 * Painel de confirmação de pagamentos sinalizados por participantes de rachas públicos.
 */
export function PendingSplitSignalsCard({ className }: PendingSplitSignalsCardProps) {
  const { pendingSignals, processingSignalId, handleConfirmSettle, handleDismiss } =
    usePendingSplitSignals();

  if (pendingSignals.length === 0) return null;

  return (
    <Card
      data-tour="split-pending-card"
      className={`border-border/80 bg-surface shadow-xs p-4 sm:p-5 space-y-4 ${className ?? ""}`}
    >
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

      <div className="space-y-3 pt-1">
        {pendingSignals.map((item) => {
          const isProcessing = processingSignalId === item.signal.id;
          const signaledDate = item.signal.created_at
            ? formatDateBR(item.signal.created_at.slice(0, 10))
            : formatDateBR(item.payload.date);

          return (
            <div
              key={item.signal.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-surface"
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

              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  sensoryIntent={false}
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
                  sensoryIntent={false}
                  disabled={isProcessing}
                  onClick={() => void handleConfirmSettle(item)}
                  className="gap-1.5 h-8 text-xs font-semibold cursor-pointer"
                  aria-label={`Confirmar e abater ${formatCentsAsCurrency(item.signal.amount_cents)} de ${item.signal.participant_name}`}
                >
                  <Check className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
                  <span>
                    Abater <MoneyText cents={item.signal.amount_cents} tone="default" />
                  </span>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
