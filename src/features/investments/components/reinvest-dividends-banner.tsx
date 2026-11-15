import { Coins, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";

export interface ReinvestDividendsBannerProps {
  cashBalance: number;
  onReinvest: () => void;
  className?: string;
}

/**
 * Banner de incentivo ao reinvestimento ativo de proventos acumulados em Caixa (§3.11.3 & D3).
 * Conecta o fluxo de proventos recebidos diretamente ao motor de rebalanceamento da carteira.
 */
export function ReinvestDividendsBanner({
  cashBalance,
  onReinvest,
  className,
}: ReinvestDividendsBannerProps) {
  if (cashBalance <= 0) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-portfolio/25 bg-surface/90 p-3.5 sm:p-4 shadow-xs transition-all hover:border-portfolio/40",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl border bg-portfolio/10 border-portfolio/20 text-portfolio"
          aria-hidden="true"
        >
          <Coins className="size-4.5" />
        </span>
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-foreground tracking-tight">
              Proventos em Caixa Disponíveis
            </span>
            <Badge variant="portfolio" size="xs">
              Caixa Ativo
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Você possui{" "}
            <strong className="text-foreground font-semibold">
              <MoneyText cents={numberToCents(cashBalance)} tone="positive" />
            </strong>{" "}
            aguardando alocação. Reinvista nos setores e ativos defasados para acelerar a bola de neve.
          </p>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={onReinvest}
        className="gap-1.5 h-8 text-xs font-semibold shrink-0 self-stretch sm:self-center"
      >
        <Sparkles className="size-3.5" aria-hidden="true" />
        <span>Reinvestir no Rebalanceador</span>
      </Button>
    </div>
  );
}
