import { MoneyText } from "@/components/ui/money-text";

export interface SplitSummaryKpisProps {
  totalCents: number;
  totalSettledFromFriendsCents: number;
  remainingReceivableCents?: number;
  settledSubtitle: string;
  hostNetCostCents: number;
  netReportWeight: number;
}

/** Grade de KPIs contábeis do racha (total, recebido, a receber e cota líquida). */
export function SplitSummaryKpis({
  totalCents,
  totalSettledFromFriendsCents,
  remainingReceivableCents,
  settledSubtitle,
  hostNetCostCents,
  netReportWeight,
}: SplitSummaryKpisProps) {
  const showRemaining = remainingReceivableCents !== undefined;

  return (
    <div
      className={
        showRemaining
          ? "grid grid-cols-2 lg:grid-cols-4 gap-2.5"
          : "grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      }
    >
      <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1 shadow-xs">
        <span className="text-[11px] font-medium text-muted-foreground">Total da Despesa</span>
        <div>
          <MoneyText cents={totalCents} tone="default" variant="value" className="text-base sm:text-lg font-semibold" />
        </div>
        <p className="text-[10px] text-muted-foreground">Valor bruto do racha</p>
      </div>

      <div className="rounded-xl border border-portfolio/30 bg-portfolio/5 p-3 space-y-1 shadow-xs">
        <span className="text-[11px] font-medium text-portfolio">Já Recebido</span>
        <div>
          <MoneyText cents={totalSettledFromFriendsCents} tone="portfolio" className="text-base sm:text-lg font-semibold" />
        </div>
        <p className="text-[10px] text-muted-foreground">{settledSubtitle}</p>
      </div>

      {showRemaining ? (
        <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1 shadow-xs">
          <span className="text-[11px] font-medium text-muted-foreground">Falta Receber</span>
          <div>
            <MoneyText
              cents={remainingReceivableCents}
              tone={remainingReceivableCents > 0 ? "default" : "positive"}
              className="text-base sm:text-lg font-semibold"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {remainingReceivableCents > 0 ? "Saldo pendente dos amigos" : "Tudo recebido dos amigos"}
          </p>
        </div>
      ) : null}

      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-1 shadow-xs">
        <span className="text-[11px] font-medium text-primary-strong">Sua Parte Líquida</span>
        <div>
          <MoneyText cents={hostNetCostCents} tone="default" className="text-base sm:text-lg font-semibold" />
        </div>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          Peso no relatório: {Math.round(netReportWeight * 100)}%
        </p>
      </div>
    </div>
  );
}
