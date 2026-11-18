import { Edit3 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules";
import { BudgetProgressBar } from "@/components/modules/budget-progress-bar";
import { HighlightRow } from "@/components/modules/highlight-row";
import { usePrivacyMask } from "@/hooks/use-privacy-mask";
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
  const masked = usePrivacyMask();

  const handleOpenLimitWithSensory = () => {
    triggerSensory("selection");
    onOpenLimit(row.category);
  };

  const splitBadgeTitle = masked
    ? undefined
    : spendMetric === "personal"
      ? `Total bruto das despesas: ${formatCentsAsBRL(row.spentGrossCents)}`
      : `Sua parte proporcional: ${formatCentsAsBRL(row.spentWeightedCents)}`;

  return (
    <HighlightRow
      highlightId={highlightId ?? null}
      id={row.category.id}
      className="rounded-xl"
    >
      <div className="group flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs transition-colors duration-150 min-w-0">
        <div className="flex items-start justify-between gap-2 min-w-0">
          <button
            type="button"
            aria-label={`Editar limite de ${row.category.name}`}
            onClick={handleOpenLimitWithSensory}
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left cursor-pointer rounded-lg p-1 -m-1 min-h-11 sm:min-h-0 transition-colors duration-150 hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <CategoryIcon icon={row.category.icon} color={row.category.color} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <p className="line-clamp-2 break-words text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                  {row.category.name}
                </p>
                {row.inherited ? (
                  <Badge variant="muted" size="xs" className="max-w-full truncate">
                    herdado
                  </Badge>
                ) : null}
                {row.hasSplitDifference ? (
                  <Badge
                    variant="muted"
                    size="xs"
                    className="max-w-full truncate text-muted-foreground font-normal"
                    title={splitBadgeTitle}
                  >
                    {spendMetric === "personal" ? (
                      <span>
                        Total bruto: <MoneyText cents={row.spentGrossCents} tone="default" variant="caption" className="text-[10px]" />
                      </span>
                    ) : (
                      <span>
                        Sua parte: <MoneyText cents={row.spentWeightedCents} tone="default" variant="caption" className="text-[10px]" />
                      </span>
                    )}
                  </Badge>
                ) : null}
              </div>
            </div>
          </button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            sensoryIntent="selection"
            className="w-8 px-0 text-muted-foreground hover:text-foreground shrink-0"
            aria-label={`Editar cadastro de ${row.category.name}`}
            title={`Editar cadastro de ${row.category.name}`}
            onClick={() => onEditCategory(row.category)}
          >
            <Edit3 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>

        <button
          type="button"
          aria-label={`Editar limite de ${row.category.name}`}
          onClick={handleOpenLimitWithSensory}
          className="w-full text-left cursor-pointer rounded-lg p-1 -m-1 transition-colors duration-150 hover:bg-surface-hover/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <BudgetProgressBar spentCents={row.spentCents} limitCents={row.limitCents} />
        </button>
      </div>
    </HighlightRow>
  );
}
