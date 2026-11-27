import { Download } from "lucide-react";
import { Button, FilterChips, SearchInput } from "@/components/ui";
import type { ActivityFilterType, ActivityTypeCounts } from "@/domain/portfolio/unified-activity-feed";

export interface ActivityFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  filterType: ActivityFilterType;
  onFilterTypeChange: (val: ActivityFilterType) => void;
  totalCount: number;
  typeCounts: ActivityTypeCounts;
  filteredCount: number;
  onExportCsv: () => void;
}

export function ActivityFilterBar({
  search,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  totalCount,
  typeCounts,
  filteredCount,
  onExportCsv,
}: ActivityFilterBarProps) {
  return (
    <div className="flex flex-col gap-2.5 min-w-0">
      <SearchInput
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onClear={() => onSearchChange("")}
        placeholder="Buscar por ativo, setor ou observação…"
        aria-label="Buscar movimentações"
        className="w-full"
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
        <div className="overflow-x-auto no-scrollbar scroll-smooth py-0.5 min-w-0">
          <FilterChips
            items={[
              { key: "all", label: "Todas", count: totalCount },
              { key: "buy", label: "Compras", count: typeCounts.buys },
              { key: "contribution", label: "Aportes", count: typeCounts.contributions },
              { key: "sell", label: "Vendas", count: typeCounts.sells },
              { key: "dividend", label: "Proventos", count: typeCounts.dividends },
            ]}
            activeKey={filterType}
            onChange={(key) => onFilterTypeChange(key as ActivityFilterType)}
            ariaLabel="Filtrar por tipo de movimentação"
          />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onExportCsv}
          disabled={filteredCount === 0}
          className="gap-1.5 shrink-0 self-start sm:self-auto"
          aria-label="Exportar CSV"
          title={
            filteredCount === 0
              ? "Nenhuma movimentação para exportar"
              : "Exportar movimentações filtradas em CSV"
          }
        >
          <Download className="size-3.5" aria-hidden="true" />
          <span>Exportar CSV</span>
        </Button>
      </div>
    </div>
  );
}
