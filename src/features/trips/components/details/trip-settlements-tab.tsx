import { ShieldCheck } from "lucide-react";
import { Button, Card, EmptyState, MoneyText } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { SuggestedSettlement } from "@/types/trips";

export interface TripSettlementsTabProps {
  suggestedSettlements: readonly SuggestedSettlement[];
  highlightMemberId?: string | null;
  onOpenSettlement: () => void;
}

export function TripSettlementsTab({
  suggestedSettlements,
  highlightMemberId = null,
  onOpenSettlement,
}: TripSettlementsTabProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <span className="text-xs font-semibold text-foreground">
          Compensação Líquida Calculada
        </span>
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={onOpenSettlement}
          className="gap-1.5 self-start sm:self-auto"
        >
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          <span>Ver Detalhes do Acerto</span>
        </Button>
      </div>

      {suggestedSettlements.length === 0 ? (
        <EmptyState
          tone="default"
          icon={<ShieldCheck className="size-6" aria-hidden="true" />}
          title="Contas zeradas"
          description="Todos os valores estão equilibrados."
        />
      ) : (
        <div className="space-y-2">
          {suggestedSettlements.map((s, idx) => {
            const isHighlighted = Boolean(
              highlightMemberId &&
                (s.fromMemberId === highlightMemberId || s.toMemberId === highlightMemberId),
            );
            return (
              <Card
                key={`${s.fromMemberId}-${s.toMemberId}-${idx}`}
                data-highlighted={isHighlighted ? "true" : undefined}
                className={cn(
                  "p-3.5 sm:p-4 rounded-xl border bg-surface shadow-xs flex items-center justify-between gap-3 text-xs transition-colors",
                  isHighlighted
                    ? "border-primary/70 bg-primary/5 ring-1 ring-primary/30"
                    : "border-border/80",
                )}
              >
                <div className="min-w-0">
                  <span className="font-semibold text-foreground">{s.fromMemberName}</span>
                  <span className="text-muted-foreground mx-1.5">transfere para</span>
                  <span className="font-semibold text-primary-strong">{s.toMemberName}</span>
                </div>
                <MoneyText
                  cents={s.amountCents}
                  tone="default"
                  className="font-bold shrink-0"
                />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
