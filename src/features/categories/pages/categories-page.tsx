import { useState } from "react";
import { Pencil, Plus, Tags, Trash2 } from "lucide-react";
import { Alert, Button, EmptyState, Skeleton, Tabs } from "@/components/ui";
import { CategoryIcon } from "@/components/modules";
import { getErrorMessage } from "@/services/errors";
import { useAllCategories, useCategoryUsage } from "@/state";
import { CategoryFormDialog } from "@/features/categories/components/category-form-dialog";
import { DeleteCategoryDialog } from "@/features/categories/components/delete-category-dialog";
import type { Category, CategoryType } from "@/types";

/** Gestão de categorias (CRUD §3.5.1) — sugestão inteligente e migração na exclusão. */
export function CategoriesPage() {
  const [tab, setTab] = useState<CategoryType>("expense");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const categoriesQuery = useAllCategories();
  const usageQuery = useCategoryUsage(deleting ? deleting.id : null);

  const categories = categoriesQuery.data ?? [];
  const filtered = categories.filter((category) => category.type === tab);
  const siblings = filtered.filter((category) => category.id !== deleting?.id);

  const error = categoriesQuery.error;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">Categorias</h1>
        <Button onClick={openCreate}>
          <Plus aria-hidden="true" />
          Nova categoria
        </Button>
      </header>

      {error ? (
        <Alert variant="error">{getErrorMessage(error)}</Alert>
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as CategoryType)}
          items={[
            { value: "expense", label: "Despesas", content: null },
            { value: "income", label: "Rendas", content: null },
          ]}
        />
      )}

      {categoriesQuery.isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Tags className="size-6" aria-hidden="true" />}
          title={tab === "expense" ? "Nenhuma categoria de despesa" : "Nenhuma categoria de renda"}
          description="Crie categorias para classificar seus lançamentos."
          action={<Button onClick={openCreate}>Criar categoria</Button>}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((category) => (
            <div key={category.id} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
              <div className="flex min-w-0 items-center gap-3">
                <CategoryIcon icon={category.icon} color={category.color} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.is_reserved ? "Reservada" : category.is_active ? "Ativa" : "Inativa"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {!category.is_reserved ? (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Editar ${category.name}`}
                      onClick={() => {
                        setEditing(category);
                        setFormOpen(true);
                      }}
                    >
                      <Pencil className="size-4" aria-hidden="true" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Excluir ${category.name}`}
                      onClick={() => setDeleting(category)}
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <CategoryFormDialog
        category={editing}
        defaultType={tab}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
      />

      {deleting ? (
        <DeleteCategoryDialog
          category={deleting}
          siblings={siblings}
          usage={usageQuery.data ?? null}
          open={deleting !== null}
          onOpenChange={(next) => {
            if (!next) setDeleting(null);
          }}
        />
      ) : null}
    </div>
  );
}
