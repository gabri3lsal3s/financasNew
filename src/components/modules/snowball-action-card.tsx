import { Coins, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { ReinvestmentOpportunity } from "@/domain/portfolio";
import { cn } from "@/lib/utils";

export interface SnowballActionCardProps {
  opportunities: readonly ReinvestmentOpportunity[];
  onReinvest: (opportunity: ReinvestmentOpportunity) => void;
  className?: string;
}

/**
 * Card de ação proativa do Efeito Bola de Neve (§F50).
 *
 * Exibe ativos cujos rendimentos acumulados no mês já compram 1 ou mais cotas
 * completas sem necessidade de aporte externo, oferecendo atalho de reinvestimento.
 */
export function SnowballActionCard({
  opportunities,
  onReinvest,
  className,
}: SnowballActionCardProps) {
  if (opportunities.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3.5 rounded-2xl border border-portfolio/25 bg-surface/90 p-4 sm:p-5 shadow-xs transition-all hover:border-portfolio/40",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-portfolio/10 border border-portfolio/20 text-portfolio"
            aria-hidden="true"
          >
            <Coins className="size-4" />
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-foreground truncate">
            Efeito Bola de Neve em Ação
          </h3>
        </div>
        <Badge variant="portfolio" className="text-[10px] py-0 px-2 font-medium">
          {opportunities.length} {opportunities.length === 1 ? "ativo" : "ativos"}
        </Badge>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        Os proventos recebidos no mês já são suficientes para adquirir novas cotas inteiras destes ativos:
      </p>

      <div className="flex flex-col gap-2 pt-1">
        {opportunities.map((opp) => (
          <div
            key={opp.assetId}
            className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-surface-hover/40 border border-border/50 p-3"
          >
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold text-foreground">
                  {opp.ticker}
                </span>
                <Badge variant="muted" className="text-[10px] py-0 px-1.5 font-normal">
                  +{opp.purchasableShares} {opp.purchasableShares === 1 ? "cota" : "cotas"}
                </Badge>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-0.5">
                <span>Rendimento do mês:</span>
                <MoneyText
                  cents={numberToCents(opp.monthDividends)}
                  tone="positive"
                  className="font-medium"
                />
                <span className="text-muted-foreground/60">• Cotação:</span>
                <MoneyText
                  cents={numberToCents(opp.currentPrice)}
                  tone="default"
                  className="font-medium"
                />
              </div>
            </div>

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={() => onReinvest(opp)}
              className="gap-1.5 text-xs h-8 shrink-0 font-medium self-end sm:self-center"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Reinvestir Provento</span>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
