import { useMemo, useState } from "react";
import { Briefcase, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { Badge, Button, Skeleton } from "@/components/ui";
import { CategoryIcon } from "@/components/modules/category-icon";
import { rankCategoriesByFrequency, type PredictionEntry } from "@/domain/predictions";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export interface QuickCategoryGridProps {
  categories: Category[] | undefined;
  categoriesLoading?: boolean;
  predictionEntries?: readonly PredictionEntry[] | null;
  selectedCategoryId: string;
  isCategoryUnconfirmed?: boolean;
  isFamilyModeEnabled?: boolean;
  isBusinessModeEnabled?: boolean;
  showAllCategories?: boolean;
  onToggleShowAllCategories?: () => void;
  onSelectCategory: (categoryId: string) => void;
}

const PAGE_SIZE = 8;

export function QuickCategoryGrid({
  categories,
  categoriesLoading = false,
  predictionEntries,
  selectedCategoryId,
  isCategoryUnconfirmed = false,
  isFamilyModeEnabled = false,
  isBusinessModeEnabled = false,
  showAllCategories = false,
  onToggleShowAllCategories,
  onSelectCategory,
}: QuickCategoryGridProps) {
  const rankedCategories = useMemo(
    () => rankCategoriesByFrequency(categories ?? [], predictionEntries),
    [categories, predictionEntries],
  );

  const [categoryPage, setCategoryPage] = useState(() => {
    if (!selectedCategoryId || rankedCategories.length === 0) return 1;
    const idx = rankedCategories.findIndex((c) => c.id === selectedCategoryId);
    return idx !== -1 ? Math.floor(idx / PAGE_SIZE) + 1 : 1;
  });
  const [prevCategoryId, setPrevCategoryId] = useState(selectedCategoryId);

  if (selectedCategoryId !== prevCategoryId) {
    setPrevCategoryId(selectedCategoryId);
    if (selectedCategoryId && rankedCategories.length > 0) {
      const idx = rankedCategories.findIndex((c) => c.id === selectedCategoryId);
      if (idx !== -1) {
        setCategoryPage(Math.floor(idx / PAGE_SIZE) + 1);
      }
    }
  }

  const totalPages = Math.max(1, Math.ceil(rankedCategories.length / PAGE_SIZE));
  const currentPage = Math.min(categoryPage, totalPages);
  const displayedCategories = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return rankedCategories.slice(startIndex, startIndex + PAGE_SIZE);
  }, [rankedCategories, currentPage]);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Categoria</span>
          {isCategoryUnconfirmed ? (
            <Badge variant="warning" size="xs">
              Confirmar categoria
            </Badge>
          ) : null}
        </div>
        {isBusinessModeEnabled && onToggleShowAllCategories ? (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            onClick={onToggleShowAllCategories}
            aria-pressed={showAllCategories}
            className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground"
          >
            {showAllCategories ? "Filtrar esfera" : "Mostrar todas"}
          </Button>
        ) : (
          <span className="text-[11px] text-muted-foreground">Toque para selecionar</span>
        )}
      </div>

      {categoriesLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: PAGE_SIZE }).map((_, idx) => (
            <Skeleton key={idx} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {displayedCategories.map((cat) => {
            const isSelected = selectedCategoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onSelectCategory(cat.id);
                }}
                aria-pressed={isSelected}
                className={cn(
                  "relative flex cursor-pointer select-none flex-col items-center justify-center gap-1.5 rounded-xl border p-2.5 transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary-strong shadow-xs"
                    : "border-border/80 bg-surface text-foreground hover:bg-surface-hover",
                )}
              >
                {isBusinessModeEnabled && cat.scope === "business" ? (
                  <span
                    className="absolute right-1.5 top-1.5 flex items-center justify-center text-portfolio"
                    title="Categoria Profissional"
                    aria-label="Categoria Profissional"
                  >
                    <Briefcase className="size-2.5" aria-hidden="true" />
                  </span>
                ) : isFamilyModeEnabled && cat.is_family ? (
                  <span
                    className="absolute right-1.5 top-1.5 flex items-center justify-center text-muted-foreground"
                    title="Categoria Familiar Compartilhada"
                    aria-label="Categoria Familiar Compartilhada"
                  >
                    <Users className="size-2.5" aria-hidden="true" />
                  </span>
                ) : null}
                <span className="flex size-7 shrink-0 items-center justify-center">
                  <CategoryIcon icon={cat.icon} color={cat.color} className="size-4" />
                </span>
                <span className="max-w-full truncate text-center text-[11px] font-medium leading-tight">
                  {cat.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between px-1 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            disabled={currentPage <= 1}
            onClick={() => setCategoryPage((p) => Math.max(1, p - 1))}
            aria-label="Página anterior de categorias"
          >
            <ChevronLeft className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Anterior</span>
          </Button>
          <div className="flex items-center gap-1.5" aria-current="page">
            {Array.from({ length: totalPages }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "size-1.5 rounded-full transition-colors",
                  currentPage === i + 1 ? "bg-primary" : "bg-muted-foreground/30",
                )}
              />
            ))}
            <span className="ml-1 text-[10px] text-muted-foreground">
              {currentPage} de {totalPages}
            </span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            sensoryIntent="selection"
            disabled={currentPage >= totalPages}
            onClick={() => setCategoryPage((p) => Math.min(totalPages, p + 1))}
            aria-label="Próxima página de categorias"
          >
            <ChevronRight className="size-3.5" aria-hidden="true" />
            <span className="sr-only">Próxima</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
