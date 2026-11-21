import { CheckCircle2, DollarSign, RotateCcw } from "lucide-react";
import { Badge, Button, MoneyInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { SplitParticipantInstallment, SplitParticipantItem } from "@/types";

export interface SplitParticipantRowProps {
  friend: SplitParticipantItem;
  isSettled: boolean;
  installments: SplitParticipantInstallment[];
  isCustomInputOpen: boolean;
  customInputCents: number;
  onCustomInputCentsChange: (cents: number) => void;
  onSettleFull: (participantId: string) => void;
  onToggleCustomSettle: () => void;
  onCloseCustomSettle: () => void;
  onConfirmCustomSettle: () => void;
  onUnsettle: (participantId: string) => void;
  onToggleInstallment: (installmentId: string, markSettled: boolean) => void;
}

/** Linha de participante do racha com baixa total, parcial ou por parcela. */
export function SplitParticipantRow({
  friend, isSettled, installments, isCustomInputOpen, customInputCents,
  onCustomInputCentsChange, onSettleFull, onToggleCustomSettle, onCloseCustomSettle,
  onConfirmCustomSettle, onUnsettle, onToggleInstallment,
}: SplitParticipantRowProps) {
  const settledCents = friend.settled_cents ?? friend.share_cents;

  return (
    <div className="p-3 hover:bg-surface-hover/50 transition-colors space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground truncate">{friend.name}</span>
              <Badge size="xs" variant={isSettled ? "positive" : "warning"}>
                {isSettled ? "Quitado" : "Pendente"}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              <span>Cota esperada:</span>
              <MoneyText cents={friend.share_cents} variant="value" />
              {isSettled ? (
                <>
                  <span>· Recebido:</span>
                  <MoneyText cents={settledCents} tone={settledCents < friend.share_cents ? "negative" : "positive"} className="font-semibold" />
                </>
              ) : (friend.settled_cents ?? 0) > 0 ? (
                <>
                  <span>· Parcial recebido:</span>
                  <MoneyText cents={friend.settled_cents ?? 0} tone="positive" className="font-semibold" />
                </>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
          {!isSettled ? (
            <>
              <Button type="button" size="xs" variant="default" onClick={() => onSettleFull(friend.id!)} className="gap-1 h-7 text-xs">
                <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
                <span>Recebi Tudo</span>
              </Button>
              <Button
                type="button" size="xs"
                variant={isCustomInputOpen ? "default" : "outline"}
                onClick={onToggleCustomSettle}
                className="gap-1 h-7 text-xs"
              >
                <DollarSign className="size-3 text-muted-foreground" aria-hidden="true" />
                <span>{isCustomInputOpen ? "Cancelar" : "Outro Valor"}</span>
              </Button>
            </>
          ) : (
            <Button type="button" size="xs" variant="ghost" onClick={() => onUnsettle(friend.id!)} className="gap-1 h-7 text-xs text-muted-foreground hover:text-foreground">
              <RotateCcw className="size-3" aria-hidden="true" />
              <span>Desfazer</span>
            </Button>
          )}
        </div>
      </div>

      {isCustomInputOpen ? (
        <div className="w-full pt-3 mt-1 border-t border-border/80 rounded-lg bg-surface p-3 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <label className="text-xs font-semibold text-foreground block">
                Valor efetivamente recebido de {friend.name}
              </label>
              <span className="text-[11px] text-muted-foreground block">
                Informe quanto a pessoa pagou (digite R$ 0,00 em caso de calote)
              </span>
            </div>
            <div className="w-full sm:w-48 shrink-0">
              <MoneyInput cents={customInputCents} onCentsChange={onCustomInputCentsChange} aria-label={`Valor recebido de ${friend.name}`} />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/80">
            <Button type="button" size="xs" variant="ghost" onClick={onCloseCustomSettle}>Cancelar</Button>
            <Button type="button" size="xs" variant="default" onClick={onConfirmCustomSettle}>Confirmar Baixa</Button>
          </div>
        </div>
      ) : null}

      {installments.length > 1 ? (
        <div className="pt-2 border-t border-border/80 space-y-1.5">
          <span className="text-[11px] font-semibold text-muted-foreground block">Parcelas mensais:</span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {installments.map((inst) => (
              <div
                key={inst.id}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg border text-xs transition-colors",
                  inst.is_settled ? "bg-surface-hover/30 border-border/80 text-muted-foreground" : "bg-surface border-border/80",
                )}
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground tabular-nums">
                      {inst.installment_number}/{inst.total_installments}
                    </span>
                    <Badge
                      size="xs"
                      variant={inst.is_settled ? "positive" : inst.signal_status === "pending_confirmation" ? "warning" : "muted"}
                    >
                      {inst.is_settled ? "Paga" : inst.signal_status === "pending_confirmation" ? "Avisou" : "Pendente"}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Venc: {formatDateBR(inst.due_date)}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <MoneyText cents={inst.amount_cents} tone="default" variant="caption" className="font-semibold text-foreground" />
                  <Button
                    type="button" size="xs"
                    variant={inst.is_settled ? "ghost" : "outline"}
                    onClick={() => onToggleInstallment(inst.id, !inst.is_settled)}
                    className="h-6 px-1.5 text-[11px] gap-1"
                    title={inst.is_settled ? "Reabrir parcela" : "Confirmar recebimento da parcela"}
                    aria-label={
                      inst.is_settled
                        ? `Reabrir parcela ${inst.installment_number} de ${friend.name}`
                        : `Confirmar recebimento da parcela ${inst.installment_number} de ${friend.name}`
                    }
                  >
                    {inst.is_settled ? (
                      <RotateCcw className="size-3 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-3 text-positive-strong" aria-hidden="true" />
                    )}
                    <span className="text-[10px] hidden sm:inline">{inst.is_settled ? "Reabrir" : "Baixar"}</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
