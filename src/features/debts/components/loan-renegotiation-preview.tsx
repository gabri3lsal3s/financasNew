import { ArrowRight, Sparkles } from "lucide-react";
import { MoneyText } from "@/components/ui";
import type { LoanRenegotiationResult } from "@/domain/loans";
import type { AmortizationSystem } from "@/types";

export interface LoanRenegotiationPreviewProps {
  preview: LoanRenegotiationResult;
  previousTotalInstallments: number;
  system: AmortizationSystem;
}

export function LoanRenegotiationPreview({
  preview,
  previousTotalInstallments,
  system,
}: LoanRenegotiationPreviewProps) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex flex-col gap-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-primary-strong">
        <Sparkles className="size-4" aria-hidden="true" />
        <span>Simulação do Novo Cronograma em Tempo Real</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
        <div className="flex flex-col p-2.5 rounded-xl bg-surface border border-border/80">
          <span className="text-[11px] text-muted-foreground">Nova Parcela Estimada</span>
          <MoneyText
            cents={preview.firstInstallmentAmountCents}
            tone="default"
            className="text-sm font-bold"
          />
          {system === "sac" ? (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 flex-wrap">
              <span>decrescendo até</span>
              <MoneyText
                cents={preview.lastInstallmentAmountCents}
                tone="default"
                className="text-[10px] font-medium"
              />
            </span>
          ) : null}
        </div>

        <div className="flex flex-col p-2.5 rounded-xl bg-surface border border-border/80">
          <span className="text-[11px] text-muted-foreground">Prazo Total Resultante</span>
          <div className="flex items-center gap-1.5 text-sm font-bold text-foreground font-mono tabular-nums">
            <span className="text-muted-foreground font-normal line-through">
              {previousTotalInstallments}x
            </span>
            <ArrowRight className="size-3 text-primary-strong" aria-hidden="true" />
            <span>{preview.newTotalInstallments}x</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {preview.remainingCount} parcelas a gerar
          </span>
        </div>

        <div className="flex flex-col p-2.5 rounded-xl bg-surface border border-border/80">
          <span className="text-[11px] text-muted-foreground">Total de Juros Estimados</span>
          <MoneyText
            cents={preview.totalEstimatedInterestCents}
            tone="default"
            className="text-sm font-bold text-warning-strong"
          />
          <span className="text-[10px] text-muted-foreground">sobre o saldo a pagar</span>
        </div>
      </div>
    </div>
  );
}
