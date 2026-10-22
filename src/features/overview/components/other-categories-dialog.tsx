import { ChevronRight, Layers } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/modules/category-icon";
import { monthLabel } from "@/lib/date";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface OtherCategoryRow {
  category: Category;
  spentGrossCents: number;
  percent: number;
}

export interface OtherCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  rows: OtherCategoryRow[];
  totalExpensesCents: number;
  onSelectCategory: (categoryId: string) => void;
}

export function OtherCategoriesDialog({
  open,
  onOpenChange,
  month,
  rows,
  totalExpensesCents,
  onSelectCategory,
}: OtherCategoriesDialogProps) {
  const totalOtherCents = rows.reduce((acc, r) => acc + r.spentGrossCents, 0);
  const totalOtherPercent = totalExpensesCents > 0 ? (totalOtherCents / totalExpensesCents) * 100 : 0;

  const handleSelect = (categoryId: string) => {
    triggerSensory("selection");
    onOpenChange(false);
    onSelectCategory(categoryId);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Demais Categorias"
      size="md"
      description={`Categorias adicionais com despesas em ${monthLabel(month)}`}
      headerActions={
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover border border-border/80 text-muted-foreground">
          <Layers className="size-4" aria-hidden="true" />
        </span>
      }
      footer={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          className="w-full sm:w-auto text-xs font-medium cursor-pointer"
        >
          Fechar
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Resumo do Grupo Demais Categorias */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-hover/40 border border-border/80 p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">Total em outras categorias</span>
            <div className="flex items-baseline gap-1.5 flex-wrap">
              <MoneyText
                cents={totalOtherCents}
                tone="default"
                className="text-xl font-bold tracking-tight text-foreground tabular-nums whitespace-nowrap"
              />
              {totalExpensesCents > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  ({Math.round(totalOtherPercent)}% do total)
                </span>
              )}
            </div>
          </div>
          <Badge variant="muted" size="xs">
            {rows.length} {rows.length === 1 ? "categoria" : "categorias"}
          </Badge>
        </div>

        {/* Lista de Categorias Agrupadas */}
        <div className="flex flex-col divide-y divide-border/40 rounded-xl border border-border/80 bg-surface overflow-hidden max-h-[50vh] overflow-y-auto">
          {rows.map((row) => (
            <button
              type="button"
              key={row.category.id}
              onClick={() => handleSelect(row.category.id)}
              className="flex flex-col gap-2 p-3 text-left hover:bg-surface-hover/60 transition-colors cursor-pointer w-full group focus-visible:outline-none focus-visible:bg-surface-hover"
            >
              <div className="flex items-center justify-between gap-2 w-full">
                <div className="flex items-center gap-2 min-w-0">
                  <CategoryIcon
                    icon={row.category.icon}
                    color={row.category.color}
                    className="size-4 shrink-0"
                  />
                  <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                    {row.category.name}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="muted" size="xs">
                    {Math.round(row.percent)}%
                  </Badge>
                  <ChevronRight
                    className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors"
                    aria-hidden="true"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="tabular-nums">
                  <MoneyText
                    cents={row.spentGrossCents}
                    tone="default"
                    className="text-foreground font-medium"
                  />
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Toque para ver raio-X
                </span>
              </div>

              <Progress
                value={Math.min(row.percent, 100)}
                className="h-1"
                aria-label={`Participação de ${row.category.name}: ${Math.round(row.percent)}%`}
              />
            </button>
          ))}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
