import { useNavigate } from "react-router";
import { ArrowUpRight, Target, TrendingDown, TrendingUp } from "lucide-react";
import { Badge, Button, Modal, ModalFooter, MoneyText, Progress } from "@/components/ui";
import { CategoryIcon } from "@/components/modules/category-icon";
import { monthLabel } from "@/lib/date";
import { progressTone } from "@/domain/budgets";
import type { Category, CreditCard, Expense } from "@/types";
import { CategoryBreakdownList } from "./category-breakdown-list";

export interface CategoryBreakdownDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  month: string;
  limitCents: number;
  spentWeightedCents: number;
  spentGrossCents: number;
  prevSpentWeightedCents: number;
  expenses: Expense[];
  cards?: CreditCard[];
}

export function CategoryBreakdownDialog({
  open,
  onOpenChange,
  category,
  month,
  limitCents,
  spentWeightedCents,
  spentGrossCents,
  prevSpentWeightedCents,
  expenses,
  cards = [],
}: CategoryBreakdownDialogProps) {
  const navigate = useNavigate();

  if (!category) return null;

  const remainingCents = limitCents - spentWeightedCents;
  const isExceeded = remainingCents < 0;
  const percentUsed = limitCents > 0 ? (spentWeightedCents / limitCents) * 100 : 0;

  const diffCents = spentWeightedCents - prevSpentWeightedCents;
  const diffPercent = prevSpentWeightedCents > 0 ? (diffCents / prevSpentWeightedCents) * 100 : null;

  const handleNavigate = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={category.name}
      size="md"
      description={`Raio-X de ${category.name} em ${monthLabel(month)}`}
      headerActions={
        <div className="flex items-center gap-2">
          <CategoryIcon icon={category.icon} color={category.color} className="size-5 shrink-0" />
        </div>
      }
      footer={
        <ModalFooter borderless className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleNavigate(`/transacoes?categoria=${category.id}&mes=${month}`)}
            className="gap-1.5 font-medium"
          >
            <span>Ver no extrato</span>
            <ArrowUpRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => handleNavigate(`/orcamentos?categoria=${category.id}&mes=${month}`)}
            className="gap-1.5 font-medium"
          >
            <Target className="size-3.5" aria-hidden="true" />
            <span>{limitCents > 0 ? "Ajustar limite" : "Definir orçamento"}</span>
          </Button>
        </ModalFooter>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-xl bg-surface-hover/40 border border-border/80 p-3.5 sm:p-4">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-medium text-muted-foreground">Total considerado no mês</span>
              <div className="flex items-baseline gap-2 flex-wrap">
                <MoneyText cents={spentWeightedCents} tone="default" variant="hero" className="font-bold" />
                {spentGrossCents !== spentWeightedCents ? (
                  <span className="text-xs text-muted-foreground font-normal">
                    (total bruto: <MoneyText cents={spentGrossCents} tone="default" variant="caption" className="text-muted-foreground font-medium" />)
                  </span>
                ) : null}
              </div>
            </div>

            {limitCents > 0 ? (
              <Badge variant={percentUsed > 100 ? "critical" : percentUsed >= 85 ? "warning" : "positive"} size="xs">
                {Math.round(percentUsed)}% do teto
              </Badge>
            ) : (
              <Badge variant="muted" size="xs">Sem teto</Badge>
            )}
          </div>

          {limitCents > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs min-w-0">
                <span className="text-muted-foreground">
                  {isExceeded ? (
                    <span className="text-critical-strong font-semibold">
                      Excedido em +<MoneyText cents={Math.abs(remainingCents)} tone="negative" variant="caption" />
                    </span>
                  ) : (
                    <span>
                      Resta <MoneyText cents={remainingCents} tone="default" variant="caption" className="font-semibold text-foreground" />
                    </span>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  de <MoneyText cents={limitCents} tone="default" variant="caption" className="text-muted-foreground" />
                </span>
              </div>
              <Progress
                value={Math.min(percentUsed, 100)}
                tone={progressTone(percentUsed)}
                className="h-1.5"
                aria-label={`Uso do orçamento de ${category.name}: ${Math.round(percentUsed)}%`}
              />
            </div>
          ) : null}

          {prevSpentWeightedCents > 0 && diffPercent !== null ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1 border-t border-border/80">
              {diffCents > 0 ? (
                <TrendingUp className="size-3.5 text-warning-strong shrink-0" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
              )}
              <span>
                {diffCents > 0 ? "+" : ""}
                {Math.round(diffPercent)}% em relação ao mês anterior (
                <MoneyText cents={prevSpentWeightedCents} tone="default" variant="caption" className="text-muted-foreground" />)
              </span>
            </div>
          ) : null}
        </div>

        <CategoryBreakdownList category={category} month={month} expenses={expenses} cards={cards} />
      </div>
    </Modal>
  );
}
