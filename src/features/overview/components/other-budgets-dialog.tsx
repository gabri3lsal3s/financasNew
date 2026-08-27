import { useNavigate } from "react-router";
import { ChevronRight, Layers, Target } from "lucide-react";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MoneyText } from "@/components/ui/money-text";
import { Progress } from "@/components/ui/progress";
import { CategoryIcon } from "@/components/modules/category-icon";
import { monthLabel } from "@/lib/date";
import { progressTone } from "@/domain/budgets";
import type { Category } from "@/types";

export interface OtherBudgetRow {
  category: Category;
  spentCents: number;
  limitCents: number;
  percent: number;
}

export interface OtherBudgetsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  month: string;
  rows: OtherBudgetRow[];
  onSelectCategory: (categoryId: string) => void;
}

export function OtherBudgetsDialog({
  open,
  onOpenChange,
  month,
  rows,
  onSelectCategory,
}: OtherBudgetsDialogProps) {
  const navigate = useNavigate();

  const totalSpentCents = rows.reduce((acc, r) => acc + r.spentCents, 0);
  const totalLimitCents = rows.reduce((acc, r) => acc + r.limitCents, 0);

  const handleNavigateToBudgets = () => {
    onOpenChange(false);
    navigate("/orcamentos");
  };

  const handleSelect = (categoryId: string) => {
    onOpenChange(false);
    onSelectCategory(categoryId);
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Outros Orçamentos"
      size="md"
      description={`Categorias adicionais com limites em ${monthLabel(month)}`}
      headerActions={
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-hover border border-border/60 text-muted-foreground">
          <Layers className="size-4" aria-hidden="true" />
        </span>
      }
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleNavigateToBudgets}
            className="w-full sm:w-auto gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Target className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Ver todos os orçamentos</span>
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {/* Resumo do Grupo Outros */}
        <div className="flex items-center justify-between gap-2 rounded-xl bg-surface-hover/40 border border-border/60 p-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-medium text-muted-foreground">Total em outras categorias</span>
            <div className="flex items-baseline gap-1.5">
              <MoneyText
                cents={totalSpentCents}
                tone="default"
                className="text-xl font-bold tracking-tight text-foreground"
              />
              <span className="text-xs text-muted-foreground">
                de <MoneyText cents={totalLimitCents} tone="default" className="text-muted-foreground" />
              </span>
            </div>
          </div>
          <Badge variant="muted" size="xs">
            {rows.length} {rows.length === 1 ? "categoria" : "categorias"}
          </Badge>
        </div>

        {/* Lista de Categorias Agrupadas */}
        <div className="flex flex-col divide-y divide-border/40 rounded-xl border border-border/60 bg-surface overflow-hidden">
          {rows.map((row) => {
            const isExceeded = row.spentCents > row.limitCents;
            return (
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
                    <Badge
                      variant={row.percent > 100 ? "critical" : row.percent >= 85 ? "warning" : "positive"}
                      size="xs"
                    >
                      {Math.round(row.percent)}%
                    </Badge>
                    <ChevronRight className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" aria-hidden="true" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="tabular-nums">
                    <MoneyText
                      cents={row.spentCents}
                      tone="default"
                      className={row.percent > 100 ? "text-critical-strong font-semibold" : "text-foreground font-medium"}
                    />{" "}
                    de <MoneyText cents={row.limitCents} tone="default" className="text-muted-foreground" />
                  </span>
                  {isExceeded ? (
                    <span className="text-[11px] text-critical-strong font-medium">Estourado</span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">
                      Resta <MoneyText cents={row.limitCents - row.spentCents} tone="default" />
                    </span>
                  )}
                </div>

                <Progress
                  value={Math.min(row.percent, 100)}
                  tone={progressTone(row.percent)}
                  className="h-1"
                  aria-label={`Uso do orçamento de ${row.category.name}: ${Math.round(row.percent)}%`}
                />
              </button>
            );
          })}
        </div>
      </div>
    </ResponsiveDialog>
  );
}
