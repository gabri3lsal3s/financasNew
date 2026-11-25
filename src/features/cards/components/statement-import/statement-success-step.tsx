import { CheckCircle2 } from "lucide-react";
import { MoneyText } from "@/components/ui";
import { monthLabel } from "@/lib/date";
import type { StatementCommitSummary } from "./statement-import-types";

export interface StatementSuccessStepProps {
  cardName: string;
  competenceMonth: string;
  summary: StatementCommitSummary;
}

/**
 * Tela breve de conclusão após commit atômico da fatura (D11).
 */
export function StatementSuccessStep({
  cardName,
  competenceMonth,
  summary,
}: StatementSuccessStepProps) {
  const metrics = [
    { label: "Compras e encargos lançados", count: summary.insertedCount },
    { label: "Parcelas futuras projetadas", count: summary.projectedCount },
    { label: "Estornos registrados", count: summary.refundsCount },
    { label: "Ajustes de valor aplicados", count: summary.adjustedCount },
    { label: "Compras movidas de mês", count: summary.movedCount },
    { label: "Itens excluídos do app", count: summary.deletedCount },
    { label: "Duplicatas ignoradas com segurança", count: summary.skippedCount },
  ].filter((m) => m.count > 0);

  return (
    <div className="py-4 sm:py-6 space-y-5 text-center">
      <div className="space-y-2">
        <CheckCircle2 className="size-10 text-positive-strong mx-auto" aria-hidden="true" />
        <h3 className="font-display text-lg font-bold text-foreground">
          Fatura conciliada com sucesso
        </h3>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
          {cardName} — competência de {monthLabel(competenceMonth)}
        </p>
      </div>

      <div className="max-w-md mx-auto rounded-2xl border border-border/80 bg-surface p-4 shadow-xs text-left space-y-2.5">
        {metrics.length > 0 ? (
          metrics.map((metric) => (
            <div key={metric.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">{metric.label}</span>
              <strong className="text-foreground font-semibold tabular-nums">{metric.count}</strong>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground text-center">
            Todos os lançamentos já estavam conciliados no aplicativo.
          </p>
        )}

        {summary.openBalanceAfterCents > 0 ? (
          <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-border/80 text-xs">
            <span className="font-medium text-foreground">Saldo estimado da fatura</span>
            <MoneyText cents={summary.openBalanceAfterCents} tone="default" variant="value" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
