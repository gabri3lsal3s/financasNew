import { Button, MoneyText } from "@/components/ui";
import { monthLabel } from "@/lib/date";
import type { Category } from "@/types";
import { OtherGroupDialogBase, type OtherGroupDialogRow } from "./other-group-dialog-base";

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

  const mappedRows: OtherGroupDialogRow[] = rows.map((row) => ({
    category: row.category,
    percent: row.percent,
    badgeVariant: "muted",
    primaryContent: <MoneyText cents={row.spentGrossCents} tone="default" variant="caption" className="font-medium" />,
    secondaryContent: <span className="text-[11px] text-muted-foreground">Toque para ver raio-X</span>,
  }));

  return (
    <OtherGroupDialogBase
      open={open}
      onOpenChange={onOpenChange}
      title="Demais Categorias"
      description={`Categorias adicionais com despesas em ${monthLabel(month)}`}
      summaryTotalCents={totalOtherCents}
      summaryRightMeta={
        totalExpensesCents > 0 ? (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            ({Math.round(totalOtherPercent)}% do total)
          </span>
        ) : undefined
      }
      rows={mappedRows}
      onSelectCategory={onSelectCategory}
      progressAriaPrefix="Participação"
      footer={
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
          Fechar
        </Button>
      }
    />
  );
}
