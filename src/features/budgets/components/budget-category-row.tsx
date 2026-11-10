import { Edit3 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import { HighlightRow } from "@/components/modules/highlight-row";
import { formatCentsAsBRL } from "@/services/masks";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface BudgetCategoryRowData {
  category: Category;
  limitCents: number;
  spentCents: number;
  spentWeightedCents: number;
  spentGrossCents: number;
  hasSplitDifference: boolean;
  inherited: boolean;
}

export interface BudgetCategoryRowProps {
  row: BudgetCategoryRowData;
  spendMetric: "personal" | "household";
  highlightId?: string | null;
  onOpenLimit: (category: Category) => void;
  onEditCategory: (category: Category) => void;
}

/**
 * Linha de categoria de orçamento desacoplada com barra de progresso,
 * badges de status e atalhos táteis para edição de limite e cadastro.
 */
export function BudgetCategoryRow({
  row,
  spendMetric,
  highlightId,
  onOpenLimit,
  onEditCategory,
}: BudgetCategoryRowProps) {
  const handleOpenLimitWithSensory = () => {
    triggerSensory("action");
    onOpenLimit(row.category);
  };

  return (
    <HighlightRow
      highlightId={highlightId ?? null}
      id={row.category.id}
      className="rounded-xl"
    >
      <div className="group flex flex-col gap-2.5 rounded-xl border border-border/70 bg-surface/70 p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border hover:bg-surface min-w-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
          <div
            role="button"
            tabIndex={0}
            aria-label={`Editar limite de ${row.category.name}`}
            onClick={handleOpenLimitWithSensory}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleOpenLimitWithSensory();
              }
            }}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-0.5"
          >
            <CategoryIcon icon={row.category.icon} color={row.category.color} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {row.category.name}
                </p>
                {row.inherited ? (
                  <Badge variant="muted" size="xs">
                    herdado
                  </Badge>
                ) : null}
                {row.hasSplitDifference ? (
                  <Badge
                    variant="muted"
                    size="xs"
                    className="text-muted-foreground font-normal"
                    title={
                      spendMetric === "personal"
                        ? `Total bruto das despesas: ${formatCentsAsBRL(row.spentGrossCents)}`
                        : `Sua parte proporcional: ${formatCentsAsBRL(row.spentWeightedCents)}`
                    }
                  >
                    {spendMetric === "personal" ? (
                      <span>Total bruto: <MoneyText cents={row.spentGrossCents} tone="default" /></span>
                    ) : (
                      <span>Sua parte: <MoneyText cents={row.spentWeightedCents} tone="default" /></span>
                    )}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="size-7 text-muted-foreground hover:text-foreground"
              aria-label={`Editar cadastro de ${row.category.name}`}
              title={`Editar cadastro de ${row.category.name}`}
              onClick={() => onEditCategory(row.category)}
            >
              <Edit3 className="size-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label={`Editar limite de ${row.category.name}`}
          onClick={handleOpenLimitWithSensory}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleOpenLimitWithSensory();
            }
          }}
          className="cursor-pointer"
        >
          <BudgetProgressBar spentCents={row.spentCents} limitCents={row.limitCents} />
        </div>
      </div>
    </HighlightRow>
  );
}
