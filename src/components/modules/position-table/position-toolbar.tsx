import { Layers, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Select, type SelectOption } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface PositionToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  groupBy: "class" | "sector";
  onGroupByChange: (mode: "class" | "sector") => void;
  availableClasses: readonly string[];
  selectedClass: string | null;
  onSelectClass: (cls: string | null) => void;
  availableSectors?: readonly string[];
  selectedSector?: string | null;
  onSelectSector?: (sec: string | null) => void;
  closedCount: number;
  hideClosed: boolean;
  onToggleHideClosed: () => void;
  filteredCount: number;
  totalCount: number;
  hasFiltersActive: boolean;
  onClearFilters?: () => void;
  isGroupedMode?: boolean;
  areAllExpanded?: boolean;
  onToggleExpandAll?: () => void;
  quarantineCount?: number;
  exitCount?: number;
  governanceFilter?: "all" | "core" | "quarantine" | "exit";
  onSelectGovernanceFilter?: (status: "all" | "core" | "quarantine" | "exit") => void;
}

export function PositionToolbar({
  search,
  onSearchChange,
  groupBy,
  onGroupByChange,
  availableClasses,
  selectedClass,
  onSelectClass,
  availableSectors = [],
  selectedSector = null,
  onSelectSector,
  closedCount,
  hideClosed,
  onToggleHideClosed,
  isGroupedMode = false,
  areAllExpanded = false,
  onToggleExpandAll,
  quarantineCount = 0,
  exitCount = 0,
  governanceFilter = "core",
  onSelectGovernanceFilter,
}: PositionToolbarProps) {
  const classOptions: SelectOption[] = [
    { value: "all", label: "Todas as classes" },
    ...availableClasses.map((cls) => ({ value: cls, label: cls })),
  ];

  const sectorOptions: SelectOption[] = [
    { value: "all", label: "Todos os setores" },
    ...availableSectors.map((sec) => ({ value: sec, label: sec })),
  ];

  const hasGovernanceAssets = quarantineCount > 0 || exitCount > 0;

  return (
    <div className="flex flex-col gap-2.5 w-full min-w-0">
      {/* Linha 1: Campo de Busca Full Width */}
      <div className="flex items-center gap-2 w-full min-w-0">
        <SearchInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange("")}
          placeholder="Buscar por ticker ou classe…"
          aria-label="Buscar ativo"
        />
      </div>

      {/* Linha de Governança (divulgação progressiva: só aparece se houver quarentena ou saída) */}
      {hasGovernanceAssets ? (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[11px] font-semibold text-muted-foreground mr-1">Foco:</span>
          <Button
            type="button"
            variant={governanceFilter === "core" ? "default" : "outline"}
            size="xs"
            sensoryIntent="selection"
            onClick={() => onSelectGovernanceFilter?.("core")}
            className={cn("h-6 px-2 text-[11px] shrink-0", governanceFilter === "core" && "shadow-xs font-semibold")}
          >
            Carteira em Aporte
          </Button>
          {quarantineCount > 0 ? (
            <Button
              type="button"
              variant={governanceFilter === "quarantine" ? "default" : "outline"}
              size="xs"
              sensoryIntent="selection"
              onClick={() => onSelectGovernanceFilter?.("quarantine")}
              className={cn(
                "h-6 px-2 gap-1.5 text-[11px] shrink-0",
                governanceFilter === "quarantine"
                  ? "shadow-xs font-semibold"
                  : "text-warning-strong border-warning/40",
              )}
            >
              <span>Quarentena</span>
              <Badge variant="warning" size="xs">
                {quarantineCount}
              </Badge>
            </Button>
          ) : null}
          {exitCount > 0 ? (
            <Button
              type="button"
              variant={governanceFilter === "exit" ? "default" : "outline"}
              size="xs"
              sensoryIntent="selection"
              onClick={() => onSelectGovernanceFilter?.("exit")}
              className={cn(
                "h-6 px-2 gap-1.5 text-[11px] shrink-0",
                governanceFilter === "exit"
                  ? "shadow-xs font-semibold"
                  : "text-negative-strong border-negative/40",
              )}
            >
              <span>Em Saída</span>
              <Badge variant="negative" size="xs">
                {exitCount}
              </Badge>
            </Button>
          ) : null}
          <Button
            type="button"
            variant={governanceFilter === "all" ? "default" : "outline"}
            size="xs"
            sensoryIntent="selection"
            onClick={() => onSelectGovernanceFilter?.("all")}
            className={cn("h-6 px-2 text-[11px] shrink-0", governanceFilter === "all" && "shadow-xs font-semibold")}
          >
            Todos
          </Button>
        </div>
      ) : null}

      {/* Linha 2: Seletores de Agrupamento, Filtros e Encerradas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full min-w-0">
        {/* Controle Segmentado Canônico de Agrupamento */}
        <SegmentedControl
          value={groupBy}
          onChange={onGroupByChange}
          options={[
            {
              value: "class",
              label: "Por Classe",
              icon: <Layers aria-hidden="true" />,
              title: "Agrupar posições por Classe de Ativo",
            },
            {
              value: "sector",
              label: "Por Setor",
              icon: <PieChart aria-hidden="true" />,
              title: "Agrupar posições por Setor",
            },
          ]}
          ariaLabel="Modo de agrupamento"
          fullWidth
          className="sm:w-auto"
        />

        {/* Filtros e Ações Secundárias */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end min-w-0 flex-wrap sm:flex-nowrap">
          {groupBy === "class" ? (
            availableClasses.length > 1 ? (
              <>
                {/* Mobile & Tablet (< lg): Select dropdown compacto */}
                <div className="lg:hidden flex-1 sm:flex-initial sm:w-44 md:w-48 min-w-0">
                  <Select
                    value={selectedClass ?? "all"}
                    onValueChange={(val) => onSelectClass(val === "all" ? null : val)}
                    options={classOptions}
                    ariaLabel="Filtrar por classe de ativo"
                    className="h-8 sm:h-7 text-xs w-full min-w-0"
                  />
                </div>

                {/* Desktop (lg+): Chips rápidos completos com espaço garantido */}
                <div className="hidden lg:flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant={selectedClass === null ? "default" : "outline"}
                    size="sm"
                    sensoryIntent="selection"
                    onClick={() => onSelectClass(null)}
                    className={cn(
                      "h-7 px-2.5 text-xs shrink-0",
                      selectedClass === null && "shadow-xs font-semibold",
                    )}
                  >
                    Todas
                  </Button>
                  {availableClasses.map((cls) => {
                    const isSelected = selectedClass === cls;
                    return (
                      <Button
                        key={cls}
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        sensoryIntent="selection"
                        onClick={() => onSelectClass(isSelected ? null : cls)}
                        className={cn(
                          "h-7 px-2.5 text-xs shrink-0",
                          isSelected && "shadow-xs font-semibold",
                        )}
                      >
                        {cls}
                      </Button>
                    );
                  })}
                </div>
              </>
            ) : null
          ) : (
            /* Modo "Por Setor" — Filtros limpos e confortáveis com Select sem quebras de linha */
            <div className="flex items-center gap-2 flex-1 sm:flex-initial min-w-0">
              {availableClasses.length > 1 ? (
                <div className="flex-1 sm:flex-initial sm:w-44 md:w-48 min-w-0">
                  <Select
                    value={selectedClass ?? "all"}
                    onValueChange={(val) => onSelectClass(val === "all" ? null : val)}
                    options={classOptions}
                    ariaLabel="Filtrar por classe de ativo"
                    className="h-8 sm:h-7 text-xs w-full min-w-0"
                  />
                </div>
              ) : null}

              {availableSectors.length > 0 ? (
                <div className="flex-1 sm:flex-initial sm:w-52 md:w-56 min-w-0">
                  <Select
                    value={selectedSector ?? "all"}
                    onValueChange={(val) => onSelectSector?.(val === "all" ? null : val)}
                    options={sectorOptions}
                    ariaLabel="Filtrar por setor"
                    className="h-8 sm:h-7 text-xs w-full min-w-0"
                  />
                </div>
              ) : null}
            </div>
          )}

          {isGroupedMode && onToggleExpandAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={onToggleExpandAll}
              className="hidden sm:inline-flex h-8 sm:h-7 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
              title={areAllExpanded ? "Recolher todos os grupos" : "Expandir todos os grupos"}
            >
              <span>{areAllExpanded ? "Recolher todos" : "Expandir todos"}</span>
            </Button>
          ) : null}

          {closedCount > 0 ? (
            <Button
              type="button"
              variant={!hideClosed ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              onClick={onToggleHideClosed}
              className="h-8 sm:h-7 px-2.5 gap-1.5 text-xs shrink-0"
              title={hideClosed ? "Exibir posições zeradas/encerradas" : "Ocultar posições zeradas/encerradas"}
            >
              <span>{hideClosed ? "Ver encerradas" : "Ocultar encerradas"}</span>
              <Badge variant="muted" size="xs">
                {closedCount}
              </Badge>
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
