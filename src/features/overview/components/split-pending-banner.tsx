import { ArrowRight, Users } from "lucide-react";
import { useNavigate } from "react-router";
import { CarouselDismissPopover } from "@/components/modules/carousel-dismiss-popover";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";

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
  onDismiss?: (days: 7 | 30) => void;
  className?: string;
}

export function SplitPendingBanner({
  pendingCents,
  activeCount,
  items,
  onDismiss,
  className,
}: SplitPendingBannerProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    const firstId = items?.[0]?.id;
    if (firstId) {
      navigate(`/transacoes?gerenciar_racha=${firstId}`);
    } else {
      navigate("/transacoes?tab=splits");
    }
  };

  return (
    <div
      role="region"
      aria-label="Despesas a Rachar e Receber"
      className={cn(
        "relative w-full h-full min-h-[104px] sm:min-h-[84px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-portfolio/25 bg-portfolio/5 p-3.5 sm:p-4 shadow-xs transition-all text-foreground",
        className,
      )}
    >
      <div className={cn("flex items-start sm:items-center gap-3 min-w-0 flex-1", onDismiss && "pr-6 sm:pr-0")}>
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
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 break-words">
            Total de <MoneyText cents={pendingCents} tone="portfolio" className="font-semibold" /> a receber em reembolsos.
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 w-full sm:w-auto self-stretch sm:self-center mt-auto sm:mt-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleNavigate}
          className="gap-1.5 shrink-0 flex-1 sm:flex-initial justify-center border-portfolio/30 hover:bg-portfolio/10 text-xs font-medium cursor-pointer"
        >
          <span>Ver e Cobrar</span>
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </Button>

        {onDismiss ? (
          <div className="absolute top-3 right-3 sm:static">
            <CarouselDismissPopover
              onDismiss={onDismiss}
              label="Dispensar aviso de despesas a rachar"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
