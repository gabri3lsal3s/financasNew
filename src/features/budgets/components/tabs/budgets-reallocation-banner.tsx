import { ArrowRight, Sparkles } from "lucide-react";
import { Button, MoneyText } from "@/components/ui";
import type { Category } from "@/types";

export interface BudgetsReallocationBannerProps {
  fromCategory: Category;
  toCategory: Category;
  amountCents: number;
  onOpenReallocate: () => void;
}

/** Banner de sugestão inteligente de realocação de folga entre limites. */
export function BudgetsReallocationBanner({
  fromCategory,
  toCategory,
  amountCents,
  onOpenReallocate,
}: BudgetsReallocationBannerProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 rounded-2xl border border-primary/25 bg-primary/5 p-4 shadow-xs">
      <div className="flex items-start gap-3 min-w-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary-strong">
          <Sparkles className="size-4.5" aria-hidden="true" />
        </span>
        <div className="text-sm min-w-0">
          <p className="font-semibold text-foreground">Sugestão de Realocação de Limite</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            <span className="font-medium text-positive-strong">{fromCategory.name}</span> possui folga.
            Transfira{" "}
            <MoneyText
              cents={amountCents}
              tone="default"
              variant="caption"
              className="font-semibold text-foreground"
            />{" "}
            de limite para cobrir os gastos de{" "}
            <span className="font-medium text-critical-strong">{toCategory.name}</span>.
          </p>
        </div>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={onOpenReallocate}
        className="shrink-0 self-start sm:self-auto gap-1.5 border-primary/30 hover:bg-primary/10"
      >
        <span>Aplicar realocação</span>
        <ArrowRight className="size-3.5" aria-hidden="true" />
      </Button>
    </div>
  );
}
