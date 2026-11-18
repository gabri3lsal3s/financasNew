import { Layers, PieChart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";

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
          className="inline-flex items-center gap-1 rounded-lg border border-border/80 bg-muted/50 p-0.5 shadow-xs shrink-0 self-start sm:self-auto"
        >
          <Button
            type="button"
            variant={groupBy === "class" ? "solid" : "ghost"}
            size="sm"
            sensoryIntent="selection"
            onClick={() => onGroupByChange("class")}
            aria-pressed={groupBy === "class"}
            title="Agrupar posições por Classe de Ativo"
            className="h-7 px-2.5 gap-1.5 text-xs"
          >
            <Layers className="size-3.5" aria-hidden="true" />
            <span>Por Classe</span>
          </Button>
          <Button
            type="button"
            variant={groupBy === "sector" ? "solid" : "ghost"}
            size="sm"
            sensoryIntent="selection"
            onClick={() => onGroupByChange("sector")}
            aria-pressed={groupBy === "sector"}
            title="Agrupar posições por Setor"
            className="h-7 px-2.5 gap-1.5 text-xs"
          >
            <PieChart className="size-3.5" aria-hidden="true" />
            <span>Por Setor</span>
          </Button>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-nowrap py-0.5 min-w-0 max-w-full">
          {availableClasses.length > 1 ? (
            <>
              <Button
                type="button"
                variant={selectedClass === null ? "solid" : "outline"}
                size="sm"
                sensoryIntent="selection"
                onClick={() => onSelectClass(null)}
                className="h-7 px-2.5 text-xs shrink-0"
              >
                Todas
              </Button>
              {availableClasses.map((cls) => {
                const isSelected = selectedClass === cls;
                return (
                  <Button
                    key={cls}
                    type="button"
                    variant={isSelected ? "solid" : "outline"}
                    size="sm"
                    sensoryIntent="selection"
                    onClick={() => onSelectClass(isSelected ? null : cls)}
                    className="h-7 px-2.5 text-xs shrink-0"
                  >
                    {cls}
                  </Button>
                );
              })}
            </>
          ) : null}

          {closedCount > 0 ? (
            <Button
              type="button"
              variant={!hideClosed ? "default" : "outline"}
              size="sm"
              sensoryIntent="selection"
              onClick={onToggleHideClosed}
              className="h-7 px-2.5 gap-1.5 text-xs shrink-0"
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
