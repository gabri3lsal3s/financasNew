import { Sparkles } from "lucide-react";
import { KpiCard } from "@/components/modules";
import { Badge, MoneyText } from "@/components/ui";
import { numberToCents } from "@/domain/money";
import type { SnowballAssetDashboardItem } from "@/domain/portfolio/dividends-analytics";
import { cn } from "@/lib/utils";
import { formatAssetQuantity } from "@/services/formatting";
import { formatPercent } from "@/services/masks/percent";

export interface DividendsSnowballPanelProps {
  totalMonthlyEstimatedIncome: number;
  activeCount: number;
  items: readonly SnowballAssetDashboardItem[];
}

export function DividendsSnowballPanel({
  totalMonthlyEstimatedIncome,
  activeCount,
  items,
}: DividendsSnowballPanelProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard
          label="Renda Mensal Estimada Total"
          cents={numberToCents(totalMonthlyEstimatedIncome)}
          tone="positive"
          hint="Renda passiva média gerada mensalmente"
        />

        <KpiCard
          label="Ativos Autossuficientes"
          value={`${activeCount} de ${items.length}`}
          hint="Já compram 1 ou mais cotas sozinhos por mês"
        />
      </div>

      <section
        aria-label="Efeito Bola de Neve"
        className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
      >
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Efeito Bola de Neve (Renda Passiva)
            </h2>
            <p className="text-xs text-muted-foreground">
              Progresso para que os proventos mensais comprem 1 nova cota inteira sozinhos.
            </p>
          </div>
        </div>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum ativo com proventos ou estimativa mensal cadastrada.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ asset, currentPrice, progress, dividendSource }) => (
              <div
                key={asset.id}
                className={cn(
                  "flex flex-col gap-2.5 rounded-xl border p-3.5 transition-colors",
                  progress.isSnowballActive
                    ? "border-positive/30 bg-positive/5"
                    : "border-border/80 bg-surface-raised/40",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <strong className="text-sm font-bold text-foreground font-mono truncate">
                      {asset.ticker}
                    </strong>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                      ({formatAssetQuantity(asset.quantity, asset.asset_class ?? undefined)} cotas)
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {dividendSource === "manual_estimate" ? (
                      <Badge variant="muted" size="xs">
                        Estimado
                      </Badge>
                    ) : null}
                    {progress.isSnowballActive ? (
                      <Badge variant="positive" size="xs">
                        Bola de Neve Ativa
                      </Badge>
                    ) : (
                      <span className="text-[11px] font-semibold text-portfolio tabular-nums">
                        {`${formatPercent(progress.progressPct)}%`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50">
                  <span className="text-muted-foreground">Renda mensal estimada</span>
                  <MoneyText
                    cents={numberToCents(progress.currentMonthlyIncome)}
                    currency={asset.currency}
                    tone="positive"
                    className="font-semibold"
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Custo de 1 cota</span>
                  <MoneyText
                    cents={numberToCents(currentPrice)}
                    currency={asset.currency}
                    tone="default"
                    className="font-semibold"
                  />
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/50" aria-hidden="true">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-300 ease-out",
                      progress.isSnowballActive ? "bg-positive-strong" : "bg-portfolio",
                    )}
                    style={{ width: `${Math.max(4, Math.min(100, progress.progressPct))}%` }}
                  />
                </div>

                <div className="text-[11px] text-muted-foreground">
                  {progress.isSnowballActive ? (
                    <span className="text-positive-strong font-medium">
                      Este ativo já compra 1+ nova cota por mês sozinho.
                    </span>
                  ) : (
                    <span>
                      Faltam <strong className="tabular-nums">{progress.remainingShares}</strong> cotas
                      para se pagar sozinho.
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
