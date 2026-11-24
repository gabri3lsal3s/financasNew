import { Boxes, PiggyBank, Plus, Search, Tag, TrendingDown, TrendingUp, X } from "lucide-react";
import { Link } from "react-router";
import { Button, EmptyState, ErrorState, Input, Skeleton, Tabs } from "@/components/ui";
import { PageHeader } from "@/components/layout";
import { ReadOnlyBanner } from "@/components/modules";
import { getErrorMessage } from "@/services/errors";
import {
  CategoryCard,
  CategoryFormDialog,
  CategoryKitsModal,
  DeleteCategoryDialog,
} from "../components";
import { useCategoriesPage, type CategoryFilterScope } from "../hooks/use-categories-page";

export function CategoriesPage() {
  const c = useCategoriesPage();

  const SCOPE_OPTIONS: { id: CategoryFilterScope; label: string }[] = [
    { id: "all", label: "Todas" },
    { id: "personal", label: "Pessoal" },
    { id: "business", label: "Negócio PJ" },
    { id: "family", label: "Família" },
  ];

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <PageHeader
        title="Categorias"
        description="Organize categorias de receitas e despesas"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => c.handleOpenKits()}
              title="Explorar e instalar kits temáticos de categorias"
            >
              <Boxes aria-hidden="true" />
              <span>Kits de categorias</span>
            </Button>
            <Button
              size="sm"
              onClick={c.handleOpenCreate}
              title="Criar nova categoria"
            >
              <Plus aria-hidden="true" />
              <span>Nova categoria</span>
            </Button>
          </>
        }
      />

      {c.permission.isReadOnlyMode && <ReadOnlyBanner />}

      {c.isError ? (
        <ErrorState message={getErrorMessage(c.error)} onRetry={() => void c.refetch()} />
      ) : (
        <div className="flex flex-col gap-4 sm:gap-5">
          {/* Barra superior de contextualização e atalho para Orçamentos */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-surface/50 p-3 sm:px-4 sm:py-3 shadow-xs">
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              <Tag className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>
                As categorias organizam suas transações e alimentam o controle de tetos e metas.
              </span>
            </div>
            <Link
              to="/orcamentos"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline shrink-0"
            >
              <PiggyBank className="size-3.5" aria-hidden="true" />
              <span>Ver tetos e orçamentos</span>
            </Link>
          </div>

          {/* Abas Despesas e Receitas */}
          <Tabs
            value={c.activeType}
            onValueChange={(val) => c.handleTypeChange(val as "expense" | "income")}
            variant="underline"
            fullWidth={false}
            items={[
              {
                value: "expense",
                label: `Despesas (${c.expenseCount})`,
                icon: <TrendingDown className="size-4 text-negative-strong" aria-hidden="true" />,
              },
              {
                value: "income",
                label: `Receitas (${c.incomeCount})`,
                icon: <TrendingUp className="size-4 text-positive-strong" aria-hidden="true" />,
              },
            ]}
          />

          {/* Barra de Busca e Filtros de Escopo */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative w-full flex-1 min-w-0">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <Input
                value={c.searchQuery}
                onChange={(e) => c.setSearchQuery(e.target.value)}
                placeholder="Buscar categoria por nome…"
                className="pl-9 pr-8 h-9 text-base sm:text-sm"
              />
              {c.searchQuery.trim() !== "" && (
                <button
                  type="button"
                  aria-label="Limpar busca"
                  onClick={() => c.setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Chips de filtro por escopo */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
              {SCOPE_OPTIONS.map((opt) => {
                const isSelected = c.scopeFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => c.setScopeFilter(opt.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-surface border border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface-hover/50"
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conteúdo: Listagem ou Empty States */}
          {c.isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : c.filteredCategories.length === 0 ? (
            c.searchQuery.trim() !== "" || c.scopeFilter !== "all" ? (
              <EmptyState
                icon={<Search className="size-6" aria-hidden="true" />}
                title="Nenhuma categoria encontrada"
                description={`Não foram encontradas categorias para o filtro selecionado. Tente alterar a busca ou o escopo.`}
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      c.setSearchQuery("");
                      c.setScopeFilter("all");
                    }}
                  >
                    Limpar filtros
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<Boxes className="size-6" aria-hidden="true" />}
                title="Nenhuma categoria cadastrada"
                description="Sua conta ainda não possui categorias para este tipo. Explore os kits temáticos prontos (Essencial, Negócio PJ, Família, Veículos) para começar em segundos."
                action={
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => c.handleOpenKits()}
                      className="gap-1.5"
                    >
                      <Boxes className="size-4" aria-hidden="true" />
                      <span>Explorar kits de categorias</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={c.handleOpenCreate}
                      className="gap-1.5"
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      <span>Criar manualmente</span>
                    </Button>
                  </div>
                }
              />
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {c.filteredCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  onEdit={c.handleOpenEdit}
                  onDelete={category.is_reserved ? undefined : c.handleOpenDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Diálogos */}
      <CategoryFormDialog
        category={c.editingCategory}
        defaultType={c.activeType}
        open={c.createOpen || c.editingCategory !== null}
        onOpenChange={(open) => {
          if (!open) {
            c.setCreateOpen(false);
            c.setEditingCategory(null);
          }
        }}
        siblings={c.editingCategory ? c.siblings : undefined}
        usage={c.editingCategory ? c.categoryUsage : undefined}
      />

      <CategoryKitsModal
        open={c.kitsModalOpen}
        onOpenChange={c.setKitsModalOpen}
        existingCategories={c.allCategories}
        initialKitId={c.initialKitId}
      />

      {c.deletingCategory && (
        <DeleteCategoryDialog
          category={c.deletingCategory}
          siblings={c.siblings}
          usage={c.categoryUsage}
          open={c.deletingCategory !== null}
          onOpenChange={(open) => {
            if (!open) c.setDeletingCategory(null);
          }}
          onDeleted={() => {
            c.setDeletingCategory(null);
          }}
        />
      )}
    </div>
  );
}
