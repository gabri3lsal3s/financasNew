import type { ReactNode } from "react";
import { DataList, type DataListColumn } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";

export interface ReportRow {
  /** Chave única da linha. */
  key: string;
  label: ReactNode;
  /** Valor nominal bruto (100%) em centavos. */
  brutoCents?: number;
  /** Valor ponderado com pesos em centavos. */
  ponderadoCents?: number;
  /** Valor em centavos (alias compatível). */
  valueCents: number;
  /** Percentual do total (0–100). */
  percent: number;
}

export interface ReportTableProps {
  title: string;
  rows: readonly ReportRow[];
  /** Total nominal bruto do grupo em centavos. */
  totalBrutoCents?: number;
  /** Total ponderado do grupo em centavos. */
  totalPonderadoCents?: number;
  /** Total do grupo (para a linha de total — alias compatível). */
  totalCents: number;
  emptyLabel?: string;
  /** Callback acionado ao clicar em uma linha para ver detalhes. */
  onRowClick?: (row: ReportRow) => void;
}

/** Tabela de agregações de relatório (§3.6) — DRY para categoria/forma/dia com visão dupla (Nominal vs. Ponderado). */
export function ReportTable({
  title,
  rows,
  totalBrutoCents,
  totalPonderadoCents,
  totalCents,
  emptyLabel = "Sem dados no período.",
  onRowClick,
}: ReportTableProps) {
  const hasDualMetrics = rows.some(
    (r) => r.brutoCents !== undefined && r.ponderadoCents !== undefined && r.brutoCents !== r.ponderadoCents,
  );

  const effectiveTotalPonderado = totalPonderadoCents ?? totalCents;
  const effectiveTotalBruto = totalBrutoCents ?? totalCents;

  const columns: DataListColumn<ReportRow>[] = [
    {
      key: "label",
      header: title,
      className: "flex-1 min-w-[120px]",
      cell: (row) => <span className="text-sm font-medium text-foreground">{row.label}</span>,
    },
    {
      key: "bruto",
      header: hasDualMetrics ? "Valor Bruto" : "Total",
      align: "right",
      cell: (row) => <MoneyText cents={row.brutoCents ?? row.valueCents} tone="default" className="font-semibold" />,
    },
    ...(hasDualMetrics
      ? [
          {
            key: "ponderado",
            header: "Ponderado",
            align: "right" as const,
            cell: (row: ReportRow) => (
              <MoneyText cents={row.ponderadoCents ?? row.valueCents} tone="default" className="text-xs text-muted-foreground" />
            ),
          },
        ]
      : []),
    {
      key: "percent",
      header: "Part.",
      align: "right",
      cell: (row) => (
        <span className="num text-xs text-muted-foreground">{row.percent.toFixed(0)}%</span>
      ),
    },
  ];

  return (
    <section aria-label={title} className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4">
      <DataList
        columns={columns}
        rows={[...rows]}
        rowKey={(row) => row.key}
        emptyMessage={emptyLabel}
        onRowClick={onRowClick}
      />
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            {hasDualMetrics ? <span className="text-xs text-muted-foreground font-normal">Bruto:</span> : null}
            <MoneyText cents={effectiveTotalBruto} tone="default" />
          </div>
          {hasDualMetrics && effectiveTotalBruto !== effectiveTotalPonderado ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>Ponderado:</span>
              <MoneyText cents={effectiveTotalPonderado} tone="default" className="text-muted-foreground" />
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

