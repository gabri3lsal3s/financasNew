import { Layers, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
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
  closedCount: number;
  hideClosed: boolean;
  onToggleHideClosed: () => void;
  filteredCount: number;
  totalCount: number;
  hasFiltersActive: boolean;
}

export function PositionToolbar({
  search,
  onSearchChange,
  groupBy,
  onGroupByChange,
  availableClasses,
  selectedClass,
  onSelectClass,
  closedCount,
  hideClosed,
  onToggleHideClosed,
  filteredCount,
  totalCount,
  hasFiltersActive,
}: PositionToolbarProps) {
  const classOptions: SelectOption[] = [
    { value: "all", label: "Todas as classes" },
    ...availableClasses.map((cls) => ({ value: cls, label: cls })),
  ];

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
        {hasFiltersActive ? (
          <Badge variant="muted" size="xs" className="shrink-0 tabular-nums">
            {filteredCount}/{totalCount}
          </Badge>
        ) : null}
      </div>

      {/* Linha 2: Seletores de Agrupamento, Filtros de Classe e Encerradas */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 w-full min-w-0">
        <div
          role="group"
          aria-label="Modo de agrupamento"
          className="inline-flex items-center gap-0.5 sm:gap-1 rounded-lg border border-border/80 bg-muted/50 p-0.5 shadow-xs shrink-0 w-full sm:w-auto"
        >
          <Button
            type="button"
            variant={groupBy === "class" ? "default" : "ghost"}
            size="sm"
            sensoryIntent="selection"
            onClick={() => onGroupByChange("class")}
            aria-pressed={groupBy === "class"}
            title="Agrupar posições por Classe de Ativo"
            className={cn(
              "flex-1 sm:flex-initial h-8 sm:h-7 px-2.5 gap-1.5 text-xs justify-center",
              groupBy === "class" && "shadow-xs font-semibold",
            )}
          >
            <Layers className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Por Classe</span>
          </Button>
          <Button
            type="button"
            variant={groupBy === "sector" ? "default" : "ghost"}
            size="sm"
            sensoryIntent="selection"
            onClick={() => onGroupByChange("sector")}
            aria-pressed={groupBy === "sector"}
            title="Agrupar posições por Setor"
            className={cn(
              "flex-1 sm:flex-initial h-8 sm:h-7 px-2.5 gap-1.5 text-xs justify-center",
              groupBy === "sector" && "shadow-xs font-semibold",
            )}
          >
            <PieChart className="size-3.5 shrink-0" aria-hidden="true" />
            <span>Por Setor</span>
          </Button>
        </div>

        {/* Filtros de classe e encerradas */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end min-w-0">
          {availableClasses.length > 1 ? (
            <>
              {/* Mobile (< sm): Select dropdown nativo e limpo — zero rolagem lateral */}
              <div className="sm:hidden flex-1 min-w-0">
                <Select
                  value={selectedClass ?? "all"}
                  onValueChange={(val) => onSelectClass(val === "all" ? null : val)}
                  options={classOptions}
                  ariaLabel="Filtrar por classe de ativo"
                  className="h-8 text-xs w-full min-w-0"
                />
              </div>

              {/* Desktop (sm+): Chips rápidos */}
              <div className="hidden sm:flex items-center gap-1.5 flex-wrap">
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
