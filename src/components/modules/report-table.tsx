import type { ReactNode } from "react";
import { DataList, type DataListColumn } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";

export interface ReportRow {
  /** Chave única da linha. */
  key: string;
  label: ReactNode;
  /** Valor em centavos. */
  valueCents: number;
  /** Percentual do total (0–100). */
  percent: number;
}

export interface ReportTableProps {
  title: string;
  rows: readonly ReportRow[];
  /** Total do grupo (para a linha de total). */
  totalCents: number;
  emptyLabel?: string;
}

/** Tabela de agregações de relatório (§3.6) — DRY para categoria/forma/dia. */
export function ReportTable({ title, rows, totalCents, emptyLabel = "Sem dados no período." }: ReportTableProps) {
  const columns: DataListColumn<ReportRow>[] = [
    {
      key: "label",
      header: title,
      className: "flex-1",
      cell: (row) => <span className="text-sm font-medium text-foreground">{row.label}</span>,
    },
    {
      key: "percent",
      header: "Part.",
      align: "right",
      cell: (row) => (
        <span className="num text-xs text-muted-foreground">{row.percent.toFixed(0)}%</span>
      ),
    },
    {
      key: "value",
      header: "Total",
      align: "right",
      cell: (row) => <MoneyText cents={row.valueCents} tone="default" />,
    },
  ];

  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <DataList
        columns={columns}
        rows={[...rows]}
        rowKey={(row) => row.key}
        emptyMessage={emptyLabel}
      />
      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-xs font-medium text-muted-foreground">Total</span>
        <MoneyText cents={totalCents} tone="default" />
      </div>
    </section>
  );
}
