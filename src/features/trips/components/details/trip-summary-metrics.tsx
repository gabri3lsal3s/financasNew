import { MoneyText } from "@/components/ui";

export interface TripSummaryMetricsProps {
  totalExpensesCents: number;
  expensesCount: number;
  membersCount: number;
  pendingSettlementsCount: number;
}

export function TripSummaryMetrics({
  totalExpensesCents,
  expensesCount,
  membersCount,
  pendingSettlementsCount,
}: TripSummaryMetricsProps) {
  return (
    <div
      data-tour="trip-balances"
      className="grid grid-cols-1 md:grid-cols-3 gap-3"
    >
      <div className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-border/80 shadow-xs space-y-1 min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium">Total do Grupo</p>
        <div>
          <MoneyText
            cents={totalExpensesCents}
            tone="default"
            className="text-base sm:text-lg lg:text-xl font-bold"
          />
        </div>
      </div>

      <div className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-border/80 shadow-xs space-y-1 min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium">Despesas Lançadas</p>
        <p className="text-base sm:text-lg lg:text-xl font-bold tabular-nums text-foreground">
          {expensesCount} {expensesCount === 1 ? "lançamento" : "lançamentos"}
        </p>
      </div>

      <div className="p-3.5 sm:p-4 rounded-2xl bg-surface border border-border/80 shadow-xs space-y-1 min-w-0">
        <p className="text-[11px] text-muted-foreground font-medium">Participantes e Acerto</p>
        <p className="text-base sm:text-lg lg:text-xl font-bold tabular-nums text-foreground">
          {membersCount} {membersCount === 1 ? "amigo" : "amigos"}
          <span className="text-xs font-medium text-muted-foreground ml-1.5">
            {pendingSettlementsCount === 0
              ? "(Contas em dia)"
              : `(${pendingSettlementsCount} ${pendingSettlementsCount === 1 ? "acerto" : "acertos"})`}
          </span>
        </p>
      </div>
    </div>
  );
}
