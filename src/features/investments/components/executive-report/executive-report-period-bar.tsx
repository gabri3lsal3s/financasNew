import { FileText, SlidersHorizontal, Trash2 } from "lucide-react";
import { Badge, Button, Select, Tabs } from "@/components/ui";
import type { ReportMonthOption } from "@/domain/portfolio/executive-report-builder";
import type { PointInTimeFidelity } from "@/domain/portfolio/point-in-time";

export interface ExecutiveReportPeriodBarProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  monthOptions: ReportMonthOption[];
  isCurrentSelected: boolean;
  fidelity?: PointInTimeFidelity;
  canDeleteSnapshot: boolean;
  onRequestDeleteSnapshot: () => void;
  activeTab: "report" | "closing";
  onTabChange: (tab: "report" | "closing") => void;
}

export function ExecutiveReportPeriodBar({
  selectedMonth,
  onSelectMonth,
  monthOptions,
  isCurrentSelected,
  fidelity,
  canDeleteSnapshot,
  onRequestDeleteSnapshot,
  activeTab,
  onTabChange,
}: ExecutiveReportPeriodBarProps) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/80 bg-surface shadow-xs print:hidden min-w-0">
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 min-w-0">
        <span className="text-xs font-semibold text-foreground whitespace-nowrap">
          Competência:
        </span>
        <div className="w-full sm:w-48 min-w-[140px]">
          <Select
            value={selectedMonth}
            onValueChange={onSelectMonth}
            options={monthOptions}
            ariaLabel="Selecionar competência do relatório"
          />
        </div>

        <Badge variant={isCurrentSelected ? "portfolio" : "muted"} size="xs" className="shrink-0 font-medium">
          {isCurrentSelected ? "Mês Aberto" : "Fechamento Histórico"}
        </Badge>

        {!isCurrentSelected && fidelity ? (
          Math.abs(fidelity.discrepancyPct ?? 0) <= 3 ? (
            <Badge variant="positive" size="xs" className="shrink-0 font-medium">
              Fidelidade Alta (100% Conciliado)
            </Badge>
          ) : (
            <Badge variant="warning" size="xs" className="shrink-0 font-medium">
              Conciliação Sugerida
            </Badge>
          )
        ) : null}

        {canDeleteSnapshot ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRequestDeleteSnapshot}
            className="text-muted-foreground hover:text-negative-strong hover:bg-negative/10 gap-1.5 px-2.5 text-xs shrink-0"
            title="Excluir snapshot gravado deste mês"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            <span>Excluir Fechamento</span>
          </Button>
        ) : null}
      </div>

      <div className="w-full xl:w-auto shrink-0 overflow-x-auto no-scrollbar">
        <Tabs
          value={activeTab}
          onValueChange={(val) => onTabChange(val as "report" | "closing")}
          variant="pills"
          fullWidth
          items={[
            {
              value: "report",
              label: "Relatório Executivo (A4)",
              shortLabel: "Relatório (A4)",
              icon: <FileText className="size-3.5" aria-hidden="true" />,
            },
            {
              value: "closing",
              label: "Conferir & Ajustar",
              shortLabel: "Conferir & Ajustar",
              icon: <SlidersHorizontal className="size-3.5" aria-hidden="true" />,
            },
          ]}
        />
      </div>
    </div>
  );
}
