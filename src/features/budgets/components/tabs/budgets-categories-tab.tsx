import { Plus, Sparkles } from "lucide-react";
import { Alert, Button, EmptyState } from "@/components/ui";
import { CategoryIcon } from "@/components/modules";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";

export interface BudgetsCategoriesTabProps {
  allCategories: Category[];
  onSeedCategories: () => void;
  isSeeding: boolean;
  isSeedError: boolean;
  seedFeedback: string | null;
  onOpenCreateCategory: () => void;
  onEditCategory: (category: Category) => void;
}

export function BudgetsCategoriesTab({
  allCategories,
  onSeedCategories,
  isSeeding,
  isSeedError,
  seedFeedback,
  onOpenCreateCategory,
  onEditCategory,
}: BudgetsCategoriesTabProps) {
  const userCategories = allCategories.filter((c) => !c.is_reserved);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Catálogo com todas as categorias do sistema e personalizadas.
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onSeedCategories}
            disabled={isSeeding}
            className="gap-1.5"
            title="Carrega ou completa as 11 categorias padrão brasileiras sem duplicar as existentes"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            <span>{isSeeding ? "Carregando..." : "Restaurar padrões"}</span>
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
          icon={<Sparkles className="size-6 text-muted-foreground" aria-hidden="true" />}
          title="Nenhuma categoria pronta encontrada"
          description="Sua conta ainda não possui categorias de receitas e despesas. Carregue o catálogo pré-pronto oficial com as 11 categorias brasileiras para começar imediatamente."
          action={
            <Button
              size="sm"
              onClick={onSeedCategories}
              disabled={isSeeding}
              className="gap-1.5"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              <span>{isSeeding ? "Carregando..." : "Carregar categorias pré-prontas"}</span>
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {allCategories.map((category) => (
            <div
              key={category.id}
              role={category.is_reserved ? undefined : "button"}
              tabIndex={category.is_reserved ? undefined : 0}
              aria-label={category.is_reserved ? undefined : `Editar cadastro de ${category.name}`}
              onClick={() => {
                if (!category.is_reserved) {
                  triggerSensory("action");
                  onEditCategory(category);
                }
              }}
              onKeyDown={(e) => {
                if (!category.is_reserved && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  triggerSensory("action");
                  onEditCategory(category);
                }
              }}
              className={cn(
                "group flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface/70 p-3 sm:p-3.5 shadow-2xs transition-all hover:border-border hover:bg-surface min-w-0",
                !category.is_reserved && "cursor-pointer hover:border-primary/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <CategoryIcon icon={category.icon} color={category.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                    {category.name}
                  </p>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {category.type === "income" ? "Receita" : "Despesa"}
                    {category.is_reserved ? " · Sistema" : ""}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
