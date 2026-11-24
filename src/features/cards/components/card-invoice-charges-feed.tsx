import type { ReactNode } from "react";
import { Landmark, Plus } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import type { CreditCard, Expense } from "@/types";

export interface CardInvoiceChargesFeedProps {
  charges: Expense[];
  selectedCard: CreditCard | null;
  onOpenCharge?: () => void;
  renderInvoiceRow: (expense: Expense) => ReactNode;
}

export function CardInvoiceChargesFeed({
  charges,
  selectedCard,
  onOpenCharge,
  renderInvoiceRow,
}: CardInvoiceChargesFeedProps) {
  const totalChargesCents = charges.reduce((sum, item) => sum + numberToCents(item.value), 0);

  return (
    <section aria-label="Encargos e tarifas da fatura" className="flex flex-col gap-3.5 sm:gap-4">
      <div className="flex flex-col gap-2.5 pb-0.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Encargos e tarifas
            </h2>
            {totalChargesCents > 0 ? (
              <span className="text-xs font-semibold text-warning-strong">
                (<MoneyText cents={totalChargesCents} tone="default" className="text-xs inline font-semibold text-warning-strong" />)
              </span>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground font-mono sm:hidden">
            {charges.length} {charges.length === 1 ? "item" : "itens"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <span className="hidden sm:inline text-xs text-muted-foreground font-mono">
            {charges.length} {charges.length === 1 ? "item" : "itens"}
          </span>
          {onOpenCharge ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onOpenCharge}
              disabled={!selectedCard}
              className="gap-1.5 flex-1 sm:flex-none justify-center h-8 px-2.5 text-xs"
            >
              <Plus className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Lançar encargo</span>
            </Button>
          ) : null}
        </div>
      </div>

      {charges.length === 0 ? (
        <EmptyState
          icon={<Landmark className="size-6" aria-hidden="true" />}
          title="Nenhum encargo nesta fatura"
          description="Fatura sem juros, multas, IOF ou tarifas adicionais."
          className="py-8 sm:py-10 px-4"
        />
      ) : (
        <div className="flex flex-col gap-2 sm:gap-2.5">
          {charges.map(renderInvoiceRow)}
        </div>
      )}
    </section>
  );
}
