import { ArrowDownLeft, ArrowUpRight, Coins, Layers, Wallet } from "lucide-react";
import { MoneyText } from "@/components/ui/money-text";
import type { ActivityMonthStats } from "@/domain/portfolio/unified-activity-feed";

export interface ActivitySummaryCardsProps {
  stats: ActivityMonthStats;
}

export function ActivitySummaryCards({ stats }: ActivitySummaryCardsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="line-clamp-2 break-words">Compras de Ativos</span>
            <ArrowDownLeft className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
          </div>
          <MoneyText
            cents={stats.boughtCents}
            tone="default"
            className="text-base sm:text-lg font-semibold text-foreground"
          />
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="line-clamp-2 break-words">Vendas / Resgates</span>
            <ArrowUpRight className="size-3.5 text-negative-strong shrink-0" aria-hidden="true" />
          </div>
          <MoneyText
            cents={stats.soldCents}
            tone="default"
            className="text-base sm:text-lg font-semibold text-foreground"
          />
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="line-clamp-2 break-words">Proventos do Mês</span>
            <Coins className="size-3.5 text-portfolio shrink-0" aria-hidden="true" />
          </div>
          <MoneyText
            cents={stats.dividendsCents}
            tone="positive"
            className="text-base sm:text-lg font-semibold"
          />
        </div>

        <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface p-3 sm:p-3.5 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-1.5 text-xs text-muted-foreground min-w-0">
            <span className="line-clamp-2 break-words">Aportes do Bolso</span>
            <Wallet className="size-3.5 text-portfolio shrink-0" aria-hidden="true" />
          </div>
          <MoneyText
            cents={stats.contributionsCents}
            tone="portfolio"
            className="text-base sm:text-lg font-semibold"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 px-3.5 py-2.5 rounded-xl border border-border/80 bg-surface text-xs text-muted-foreground shadow-xs">
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
          <span>Compras Líquidas (Compras - Vendas):</span>
        </div>
        <MoneyText
          cents={stats.netInvestedCents}
          tone="default"
          sign="auto"
          className="font-semibold text-foreground"
        />
      </div>
    </>
  );
}
