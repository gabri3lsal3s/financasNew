import { CheckCircle2, History } from "lucide-react";
import { Badge, MoneyText, RadioGroup } from "@/components/ui";
import type { LoanRenegotiationStrategy } from "@/domain/loans";

export interface LoanRenegotiationHistoryCardProps {
  paidCount: number;
  totalInstallments: number;
  totalPaidAmountCents: number;
  remainingBalanceCents: number;
  strategy: LoanRenegotiationStrategy;
  onStrategyChange: (strategy: LoanRenegotiationStrategy) => void;
}

export function LoanRenegotiationHistoryCard({
  paidCount,
  totalInstallments,
  totalPaidAmountCents,
  remainingBalanceCents,
  strategy,
  onStrategyChange,
}: LoanRenegotiationHistoryCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-xs font-semibold text-foreground">Histórico do Contrato</span>
        </div>
        <Badge variant="positive" size="sm">
          <CheckCircle2 className="size-3 mr-1" aria-hidden="true" />
          {paidCount} de {totalInstallments} parcelas quitadas
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border/80">
          <span className="text-muted-foreground">Total já quitado:</span>
          <MoneyText
            cents={totalPaidAmountCents}
            tone="positive"
            className="text-xs font-semibold"
          />
        </div>
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border/80">
          <span className="text-muted-foreground">Saldo restante amortizado:</span>
          <MoneyText
            cents={remainingBalanceCents}
            tone="default"
            className="text-xs font-semibold"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5 pt-2 border-t border-border/80">
        <span className="text-xs font-semibold text-foreground">
          Como deseja aplicar as alterações?
        </span>
        <RadioGroup
          value={strategy}
          onValueChange={(val) => onStrategyChange(val as LoanRenegotiationStrategy)}
          name="renegotiation-strategy"
          options={[
            {
              value: "amortize_remaining",
              label: "Repactuar saldo restante (Recomendado — mantém as parcelas quitadas)",
            },
            {
              value: "reset",
              label: "Recalcular contrato inteiro do zero (descarta histórico de quitação)",
            },
          ]}
        />
      </div>
    </div>
  );
}
