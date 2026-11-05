import { ArrowRight, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface SplitPendingItemSummary {
  id: string;
  title: string;
  pendingCents: number;
  pendingFriendsCount: number;
  totalFriendsCount: number;
}

export interface SplitPendingBannerProps {
  pendingCents: number;
  activeCount: number;
  totalExpensesCents?: number;
  items?: SplitPendingItemSummary[];
  className?: string;
}

export function SplitPendingBanner({
  pendingCents,
  activeCount,
  className,
}: SplitPendingBannerProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    triggerSensory("action");
    navigate("/transacoes");
  };

  return (
    <div
      role="region"
      aria-label="Despesas a Rachar e Receber"
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-portfolio/25 bg-portfolio/5 p-3.5 sm:p-4 shadow-xs transition-all text-foreground",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-portfolio/10 border border-portfolio/20 text-portfolio"
          aria-hidden="true"
        >
          <Users className="size-4.5" />
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground">
              Despesas a Rachar e Receber
            </h2>
            <Badge variant="portfolio" size="xs">
              {activeCount} {activeCount === 1 ? "racha a receber" : "rachas a receber"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed truncate">
            Total de <MoneyText cents={pendingCents} tone="portfolio" className="font-semibold" /> a receber em reembolsos.
          </p>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleNavigate}
        className="gap-1.5 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0 border-portfolio/30 hover:bg-portfolio/10 text-xs font-medium cursor-pointer"
      >
        <span>Ver e Cobrar</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
