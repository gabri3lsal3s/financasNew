import { useState } from "react";
import { useSearchParams } from "react-router";
import { Plus, Tags } from "lucide-react";
import { Badge, Button, EmptyState, ErrorState, Skeleton, Tabs } from "@/components/ui";
import { CategoryIcon, HighlightRow } from "@/components/modules";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/services/haptics";
import { getErrorMessage } from "@/services/errors";
import { useCreateDeepLink } from "@/hooks/use-create-deep-link";
import { useHighlightTarget } from "@/hooks/use-highlight-target";
import { useAllCategories, useCategoryUsage } from "@/state";
import { CategoryFormDialog } from "@/features/categories/components/category-form-dialog";
import type { Category, CategoryType } from "@/types";

/** Gestão de categorias (CRUD §3.5.1) — sugestão inteligente e migração na exclusão. */
export function CategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { highlightId } = useHighlightTarget("q");

  // Aba derivada: deep-link ?type= (busca §3.9) prevalece; sem param, usa a
  // escolha manual. O pick manual limpa o param (sem setState em effect).
  const paramType = searchParams.get("type");
  const [pickedTab, setPickedTab] = useState<CategoryType>("expense");
  const tab: CategoryType = paramType === "income" ? "income" : paramType === "expense" ? "expense" : pickedTab;

  const handleTabChange = (next: CategoryType) => {
    setPickedTab(next);
    setSearchParams(
      (prev) => {
        const updated = new URLSearchParams(prev);
        updated.delete("type");
        return updated;
      },
      { replace: true },
    );
  };

  // FAB contextual (F12): ?novo=categoria abre o formulário de criação.
  const { open: formOpen, setOpen: setFormOpen } = useCreateDeepLink("categoria");
  const [editing, setEditing] = useState<Category | null>(null);

  const categoriesQuery = useAllCategories();
  const usageQuery = useCategoryUsage(editing ? editing.id : null);

  const categories = categoriesQuery.data ?? [];
  const siblings = categories.filter((c) => c.type === tab && c.id !== editing?.id);
  const error = categoriesQuery.error;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const renderCategoryList = (type: CategoryType) => {
    const list = categories.filter((category) => category.type === type);

    if (categoriesQuery.isLoading) {
      return (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      );
    }

    if (list.length === 0) {
      return (
        <EmptyState
          icon={<Tags className="size-6" aria-hidden="true" />}
          title={type === "expense" ? "Nenhuma categoria de despesa" : "Nenhuma categoria de renda"}
          description="Crie categorias para classificar seus lançamentos."
          action={<Button onClick={openCreate}>Criar categoria</Button>}
        />
      );
    }

    return (
      <div className="flex flex-col gap-2">
        {list.map((category) => {
          const isClickable = !category.is_reserved;
          return (
            <HighlightRow key={category.id} highlightId={highlightId} id={category.id} className="border border-border bg-surface overflow-hidden">
              <div
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                aria-label={isClickable ? `Editar ${category.name}` : undefined}
                onClick={
                  isClickable
                    ? () => {
                        triggerHaptic("light");
                        setEditing(category);
                        setFormOpen(true);
                      }
                    : undefined
                }
                onKeyDown={
                  isClickable
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          triggerHaptic("light");
                          setEditing(category);
                          setFormOpen(true);
                        }
                      }
                    : undefined
                }
                className={cn(
                  "flex items-center justify-between gap-3 p-4 transition-colors",
                  isClickable
                    ? "cursor-pointer hover:bg-surface-hover active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    : "opacity-80",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <CategoryIcon icon={category.icon} color={category.color} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.is_reserved ? "Reservada" : category.is_active ? "Ativa" : "Inativa"}
                    </p>
                  </div>
                </div>
                {category.is_reserved ? (
                  <Badge variant="muted" className="text-[11px]">
                    Reservada
                  </Badge>
                ) : null}
              </div>
            </HighlightRow>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">Categorias</h1>
          <p className="text-xs text-muted-foreground sm:text-sm">Organização de despesas e receitas</p>
        </div>
        <Button size="sm" aria-label="Nova categoria" onClick={openCreate} className="shrink-0">
          <Plus aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Nova categoria</span>
          <span className="sm:hidden">Nova</span>
        </Button>
      </header>

      {error ? (
        <ErrorState message={getErrorMessage(error)} />
      ) : (
        <Tabs
          value={tab}
          onValueChange={(value) => handleTabChange(value as CategoryType)}
          swipeable
          items={[
            {
              value: "expense",
              label: "Despesas",
              content: renderCategoryList("expense"),
            },
            {
              value: "income",
              label: "Rendas",
              content: renderCategoryList("income"),
            },
          ]}
        />
      )}

      <CategoryFormDialog
        category={editing}
        defaultType={tab}
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) setEditing(null);
        }}
        siblings={editing ? siblings : undefined}
        usage={editing ? (usageQuery.data ?? null) : undefined}
      />
    </div>
  );
}
