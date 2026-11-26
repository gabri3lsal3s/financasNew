import { useEffect, useRef } from "react";
import { Check, Clock, CreditCard } from "lucide-react";
import { Badge, Button, MoneyText, Progress } from "@/components/ui";
import type { InstallmentsProgressSummary } from "@/domain/finance/split-math";
import { formatDateBR } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { SplitParticipantInstallment } from "@/types";

export interface SplitChargeInstallmentsProps {
  installments: SplitParticipantInstallment[];
  progress: InstallmentsProgressSummary;
  selectedInstallment: SplitParticipantInstallment | null;
  isPayAllRemaining: boolean;
  onSelectInstallmentId?: (id: string | null) => void;
  onTogglePayAllRemaining?: () => void;
}

/**
 * Seletor interativo de parcelas no `SplitChargeCard`, com rolagem inteligente
 * para listas maiores e opção de quitação conjunta das parcelas pendentes.
 */
export function SplitChargeInstallments({
  installments,
  progress,
  selectedInstallment,
  isPayAllRemaining,
  onSelectInstallmentId,
  onTogglePayAllRemaining,
}: SplitChargeInstallmentsProps) {
  const selectedButtonRef = useRef<HTMLButtonElement | null>(null);
  const isManyInstallments = installments.length >= 5;

  useEffect(() => {
    if (selectedButtonRef.current) {
      selectedButtonRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedInstallment?.id]);

  return (
    <div className="space-y-2 pt-2 border-t border-border/80">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <CreditCard className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground truncate">
            Parcelas ({progress.settledCount}/{progress.totalCount} pagas)
          </span>
        </div>
        {progress.pendingCount > 1 && onTogglePayAllRemaining && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            onClick={onTogglePayAllRemaining}
            className={cn(
              "ml-auto text-[11px] font-medium h-7 px-2",
              isPayAllRemaining ? "text-primary-strong font-semibold" : "text-muted-foreground",
            )}
          >
            {isPayAllRemaining ? "Pagar uma a uma" : "Quitar todas pendentes"}
          </Button>
        )}
      </div>

      {progress.totalCount > 1 && (
        <Progress
          value={(progress.settledCount / progress.totalCount) * 100}
          size="sm"
          tone="positive"
          aria-label={`Progresso das parcelas: ${progress.settledCount} de ${progress.totalCount}`}
        />
      )}

      <div
        className={cn(
          "grid grid-cols-1 sm:grid-cols-2 gap-2",
          isManyInstallments &&
            "rounded-xl bg-surface-raised p-2",
        )}
      >
        {installments.map((inst) => {
          const isSelected = !isPayAllRemaining && selectedInstallment?.id === inst.id;
          const isSettled = inst.is_settled;
          const isSignaled = inst.signal_status === "pending_confirmation";

          return (
            <button
              key={inst.id}
              ref={isSelected ? selectedButtonRef : undefined}
              type="button"
              disabled={isSettled}
              onClick={() => {
                if (!isSettled && onSelectInstallmentId) {
                  onSelectInstallmentId(inst.id);
                }
              }}
              className={cn(
                "flex items-center justify-between min-h-11 p-2.5 rounded-xl border text-left transition-all",
                isSettled
                  ? "bg-muted/50 border-border/80 opacity-70 cursor-default"
                  : isSelected
                    ? "bg-primary/10 border-primary/40 ring-1 ring-primary/30 cursor-pointer shadow-xs"
                    : "bg-surface border-border/80 hover:border-border hover:bg-surface-hover cursor-pointer",
              )}
            >
              <div className="flex flex-col gap-0.5 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">
                    Parcela {inst.installment_number}/{inst.total_installments}
                  </span>
                  {isSettled ? (
                    <Badge variant="positive" size="xs" className="gap-1">
                      <Check className="size-2.5" aria-hidden="true" />
                      <span>Paga</span>
                    </Badge>
                  ) : isSignaled ? (
                    <Badge variant="warning" size="xs" className="gap-1">
                      <Clock className="size-2.5" aria-hidden="true" />
                      <span>Em conferência</span>
                    </Badge>
                  ) : isSelected ? (
                    <Badge variant="default" size="xs">
                      Selecionada
                    </Badge>
                  ) : (
                    <Badge variant="muted" size="xs">
                      Pendente
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground">
                  Vencimento: {formatDateBR(inst.due_date)}
                </span>
              </div>

              <div className="text-right shrink-0 ml-2">
                <MoneyText
                  cents={inst.amount_cents}
                  variant="caption"
                  tone="default"
                  className="text-xs font-bold"
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
