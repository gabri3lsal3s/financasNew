import { Tags } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/modules/category-icon";
import { cn } from "@/lib/utils";
import { getErrorMessage } from "@/services/errors";
import type { Category } from "@/types";

export interface StepCategoryProps {
  categories: Category[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  selectedId: string;
  onSelect: (categoryId: string) => void;
}

/** Passo 2 — seleção visual de categoria (grid de botões com ícones). */
export function StepCategory({ categories, isLoading, isError, error, selectedId, onSelect }: StepCategoryProps) {
  if (isError) {
    return <Alert variant="error">{getErrorMessage(error)}</Alert>;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
        {Array.from({ length: 10 }).map((_, index) => (
          <Skeleton key={index} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!categories || categories.length === 0) {
    return (
      <EmptyState
        icon={<Tags className="size-6" aria-hidden="true" />}
        title="Nenhuma categoria"
        description="Crie suas categorias na área Categorias antes de lançar."
      />
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5">
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          onClick={() => onSelect(category.id)}
          aria-pressed={selectedId === category.id}
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border p-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring select-none cursor-pointer",
            selectedId === category.id
              ? "border-primary bg-primary/10"
              : "border-border bg-surface hover:bg-surface-hover",
          )}
        >
          <span className="flex size-10 items-center justify-center">
            <CategoryIcon icon={category.icon} color={category.color} className="size-5" />
          </span>
          <span className="text-center text-xs font-medium text-foreground truncate max-w-full">{category.name}</span>
        </button>
      ))}
    </div>
  );
}
