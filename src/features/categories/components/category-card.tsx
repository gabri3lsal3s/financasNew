import { Edit2, Lock, Trash2 } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { CategoryIcon } from "@/components/modules";
import { triggerSensory } from "@/services/sensory";
import type { Category } from "@/types";

export interface CategoryCardProps {
  category: Category;
  onEdit: (category: Category) => void;
  onDelete?: (category: Category) => void;
}

export function CategoryCard({ category, onEdit, onDelete }: CategoryCardProps) {
  const isIncome = category.type === "income";

  const getScopeBadge = () => {
    if (category.is_reserved) {
      return (
        <Badge variant="muted" size="xs" className="gap-1 text-muted-foreground border-border/80">
          <Lock className="size-3" aria-hidden="true" />
          <span>Sistema</span>
        </Badge>
      );
    }

    if (category.scope === "business") {
      return (
        <Badge variant="default" size="xs" className="text-primary border-primary/30 bg-primary/5">
          <span>Profissional</span>
        </Badge>
      );
    }

    if (category.is_family || category.scope === "both") {
      return (
        <Badge variant="positive" size="xs" className="text-positive-strong border-positive/30 bg-positive/5">
          <span>{category.scope === "both" ? "Misto / Família" : "Família"}</span>
        </Badge>
      );
    }

    return (
      <Badge variant="muted" size="xs" className="text-muted-foreground border-border/80">
        <span>Pessoal</span>
      </Badge>
    );
  };

  return (
    <div
      className="group flex flex-col justify-between gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs min-h-[92px] transition-colors duration-150 hover:border-primary/40 hover:bg-surface-hover/30"
      data-testid={`category-card-${category.id}`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <div className="shrink-0 mt-0.5">
            <CategoryIcon icon={category.icon} color={category.color} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 break-words text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
              {category.name}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {isIncome ? "Receita" : "Despesa"}
              </span>
              <span className="text-muted-foreground/40 text-xs" aria-hidden="true">
                •
              </span>
              {getScopeBadge()}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {category.is_reserved ? (
            <span
              className="text-xs text-muted-foreground p-1"
              title="Categoria protegida do sistema para estornos e conciliação de faturas"
            >
              <Lock className="size-4" aria-hidden="true" />
              <span className="sr-only">Protegida</span>
            </span>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Editar ${category.name}`}
                title={`Editar ${category.name}`}
                className="size-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  triggerSensory("selection");
                  onEdit(category);
                }}
              >
                <Edit2 className="size-3.5" aria-hidden="true" />
              </Button>
              {onDelete ? (
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Excluir ${category.name}`}
                  title={`Excluir ${category.name}`}
                  className="size-8 p-0 text-muted-foreground hover:text-critical-strong hover:bg-critical/10"
                  onClick={() => {
                    triggerSensory("destructive");
                    onDelete(category);
                  }}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
