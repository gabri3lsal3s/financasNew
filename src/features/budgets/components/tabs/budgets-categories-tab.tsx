import { Boxes, Plus } from "lucide-react";
import { Alert, Button, EmptyState } from "@/components/ui";
import { CategoryIcon } from "@/components/modules";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface BudgetsCategoriesTabProps {
  allCategories: Category[];
  onSeedCategories?: () => void;
  isSeeding?: boolean;
  isSeedError?: boolean;
  seedFeedback?: string | null;
  onOpenCreateCategory: () => void;
  onEditCategory: (category: Category) => void;
  onOpenKitsModal?: () => void;
}

export function BudgetsCategoriesTab({
  allCategories,
  onSeedCategories,
  isSeeding = false,
  isSeedError = false,
  seedFeedback,
  onOpenCreateCategory,
  onEditCategory,
  onOpenKitsModal,
}: BudgetsCategoriesTabProps) {
  const userCategories = allCategories.filter((c) => !c.is_reserved);

  const handleKitsClick = () => {
    if (onOpenKitsModal) {
      onOpenKitsModal();
    } else if (onSeedCategories) {
      onSeedCategories();
    }
  };

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs sm:text-sm text-muted-foreground">
          Catálogo com todas as categorias do sistema e personalizadas.
        </p>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleKitsClick}
            disabled={isSeeding}
            className="gap-1.5"
            title="Explorar e instalar kits temáticos de categorias (Essencial, Negócio PJ, Família, Veículos)"
          >
            <Boxes className="size-4" aria-hidden="true" />
            <span>Kits de categorias</span>
          </Button>
          <Button size="sm" onClick={onOpenCreateCategory} className="gap-1.5">
            <Plus className="size-4" aria-hidden="true" />
            <span>Nova categoria</span>
          </Button>
        </div>
      </div>

      {seedFeedback && (
        <Alert variant={isSeedError ? "error" : "info"}>
          {seedFeedback}
        </Alert>
      )}

      {userCategories.length === 0 ? (
        <EmptyState
          icon={<Boxes className="size-6" aria-hidden="true" />}
          title="Nenhuma categoria encontrada"
          description="Sua conta ainda não possui categorias ativas de receitas e despesas. Explore os kits temáticos prontos (Essencial, Negócio PJ, Família) para começar imediatamente."
          action={
            <Button
              size="sm"
              onClick={handleKitsClick}
              disabled={isSeeding}
              className="gap-1.5"
            >
              <Boxes className="size-4" aria-hidden="true" />
              <span>Explorar Kits de Categorias</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {allCategories.map((category) => {
            const inner = (
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <CategoryIcon icon={category.icon} color={category.color} />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 break-words text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {category.name}
                  </p>
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wider">
                    {category.type === "income" ? "Receita" : "Despesa"}
                    {category.is_reserved ? " · Sistema" : ""}
                  </span>
                </div>
              </div>
            );

            if (category.is_reserved) {
              return (
                <div
                  key={category.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs min-h-12 min-w-0"
                >
                  {inner}
                </div>
              );
            }

            return (
              <button
                key={category.id}
                type="button"
                aria-label={`Editar cadastro de ${category.name}`}
                onClick={() => {
                  triggerSensory("selection");
                  onEditCategory(category);
                }}
                className="group flex w-full text-left items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs min-h-12 min-w-0 cursor-pointer transition-colors duration-150 hover:border-primary/40 hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {inner}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
