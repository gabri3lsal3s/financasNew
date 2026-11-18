import { Download, FilterX } from "lucide-react";
import { Button, FilterChips, SearchInput, Select } from "@/components/ui";
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
  availableClasses: readonly string[];
  selectedClass: string;
  onSelectedClassChange: (val: string) => void;
  availableSectors: readonly string[];
  selectedSector: string;
  onSelectedSectorChange: (val: string) => void;
  onClearAuxFilters: () => void;
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
  availableClasses,
  selectedClass,
  onSelectedClassChange,
  availableSectors,
  selectedSector,
  onSelectedSectorChange,
  onClearAuxFilters,
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

      {(availableClasses.length > 0 || availableSectors.length > 0) ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-row lg:items-center gap-2.5 pt-0.5">
          {availableClasses.length > 0 ? (
            <div className="flex items-center gap-2 min-w-0 lg:w-64">
              <span className="text-xs font-medium text-muted-foreground shrink-0">Classe:</span>
              <Select
                value={selectedClass}
                onValueChange={onSelectedClassChange}
                options={[
                  { value: "all", label: "Todas as classes" },
                  ...availableClasses.map((cls) => ({ value: cls, label: cls })),
                ]}
                ariaLabel="Filtrar por classe de ativo"
                className="flex-1 min-w-0"
              />
            </div>
          ) : null}

          {availableSectors.length > 0 ? (
            <div className="flex items-center gap-2 min-w-0 lg:w-64">
              <span className="text-xs font-medium text-muted-foreground shrink-0">Setor:</span>
              <Select
                value={selectedSector}
                onValueChange={onSelectedSectorChange}
                options={[
                  { value: "all", label: "Todos os setores" },
                  ...availableSectors.map((sec) => ({ value: sec, label: sec })),
                ]}
                ariaLabel="Filtrar por setor de investimento"
                className="flex-1 min-w-0"
              />
            </div>
          ) : null}

          {(selectedClass !== "all" || selectedSector !== "all") ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={onClearAuxFilters}
              className="px-2.5 text-xs text-muted-foreground hover:text-foreground gap-1 self-start lg:self-auto"
            >
              <FilterX className="size-3.5" aria-hidden="true" />
              <span>Limpar filtros</span>
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
