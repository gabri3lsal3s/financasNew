import { ArrowRight, Target } from "lucide-react";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export interface CampaignsSummaryBannerProps {
  title: string;
  currentCents: number;
  targetCents: number;
  percentage: number;
  activeCount: number;
  className?: string;
}

export function CampaignsSummaryBanner({
  title,
  currentCents,
  targetCents,
  percentage,
  activeCount,
  className,
}: CampaignsSummaryBannerProps) {
  const navigate = useNavigate();

  const handleNavigate = () => {
    triggerSensory("action");
    navigate("/orcamentos?tab=goals");
  };

  return (
    <div
      role="region"
      aria-label="Resumo de Arrecadação de Metas"
      className={cn(
        "w-full h-full min-h-[104px] sm:min-h-[72px] flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-primary/25 bg-primary/5 p-3.5 sm:p-4 shadow-xs transition-all text-foreground",
        className,
      )}
    >
      <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary"
          aria-hidden="true"
        >
          <Target className="size-4.5" />
        </span>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground truncate">
              Arrecadação: {title}
            </h2>
            <Badge variant="default" size="xs">
              {percentage}% alcançado
            </Badge>
            {activeCount > 1 ? (
              <span className="text-[10px] text-muted-foreground">
                (+{activeCount - 1} {activeCount - 1 === 1 ? "campanha" : "campanhas"})
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed truncate">
            Arrecadado <MoneyText cents={currentCents} tone="positive" className="font-semibold" /> de{" "}
            <MoneyText cents={targetCents} className="font-semibold" /> no termômetro.
          </p>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={handleNavigate}
        className="gap-1.5 shrink-0 self-stretch sm:self-center mt-auto sm:mt-0 border-primary/30 hover:bg-primary/10 text-xs font-medium cursor-pointer"
      >
        <span>Ver Termômetro</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
