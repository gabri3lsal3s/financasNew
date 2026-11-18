import { useNavigate } from "react-router";
import { Target } from "lucide-react";
import { Button, MoneyText } from "@/components/ui";
import { monthLabel } from "@/lib/date";
import { progressTone } from "@/domain/budgets";
import type { Category } from "@/types";
import { OtherGroupDialogBase, type OtherGroupDialogRow } from "./other-group-dialog-base";

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

  const mappedRows: OtherGroupDialogRow[] = rows.map((row) => {
    const isExceeded = row.spentCents > row.limitCents;
    return {
      category: row.category,
      percent: row.percent,
      badgeVariant: row.percent > 100 ? "critical" : row.percent >= 85 ? "warning" : "positive",
      progressTone: progressTone(row.percent),
      primaryContent: (
        <span className="tabular-nums">
          <MoneyText
            cents={row.spentCents}
            tone="default"
            variant="caption"
            className={row.percent > 100 ? "text-critical-strong font-semibold" : "text-foreground font-medium"}
          />{" "}
          de <MoneyText cents={row.limitCents} tone="default" variant="caption" className="text-muted-foreground" />
        </span>
      ),
      secondaryContent: isExceeded ? (
        <span className="text-[11px] text-critical-strong font-medium">Estourado</span>
      ) : (
        <span className="text-[11px] text-muted-foreground">
          Resta <MoneyText cents={row.limitCents - row.spentCents} tone="default" variant="caption" />
        </span>
      ),
    };
  });

  return (
    <OtherGroupDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Outros Orçamentos"
      description={`Categorias adicionais com limites em ${monthLabel(month)}`}
      summaryTotalCents={totalSpentCents}
      summaryRightMeta={
        <span className="text-xs text-muted-foreground">
          de <MoneyText cents={totalLimitCents} tone="default" variant="caption" className="text-muted-foreground" />
        </span>
      }
      rows={mappedRows}
      onSelectCategory={onSelectCategory}
      progressAriaPrefix="Uso do orçamento"
      footer={
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleNavigateToBudgets}
          className="gap-1.5 font-medium"
        >
          <Target className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Ver todos os orçamentos</span>
        </Button>
      }
    />
  );
}
