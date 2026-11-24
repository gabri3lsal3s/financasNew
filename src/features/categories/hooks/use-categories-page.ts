import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type { CategoryKitId } from "@/domain/categories";
import { normalizeCategoryKeyword } from "@/domain/categories";
import { useAllCategories, useCategoryUsage, usePermission } from "@/state";
import type { Category, CategoryType } from "@/types";

export type CategoryFilterScope = "all" | "personal" | "business" | "family";

export function useCategoriesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const permission = usePermission("budgets");

  const queryType = searchParams.get("type") ?? searchParams.get("tipo");
  const initialType: CategoryType = queryType === "income" || queryType === "receita" ? "income" : "expense";

  const [activeType, setActiveType] = useState<CategoryType>(initialType);
  const [searchQuery, setSearchQuery] = useState("");
  const [scopeFilter, setScopeFilter] = useState<CategoryFilterScope>("all");

  // Modais
  const [createOpen, setCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [kitsModalOpen, setKitsModalOpen] = useState(false);
  const [initialKitId, setInitialKitId] = useState<CategoryKitId | undefined>(undefined);

  const allCategoriesQuery = useAllCategories();
  const allCategories = useMemo(() => allCategoriesQuery.data ?? [], [allCategoriesQuery.data]);

  // Deep-links de ação inicial
  useEffect(() => {
    const action = searchParams.get("acao") ?? searchParams.get("action");
    const isNew = searchParams.get("novo") === "1" || action === "nova-categoria";
    const paramKit = searchParams.get("kit");

    if (isNew && !permission.isReadOnlyMode) {
      const timer = setTimeout(() => {
        setCreateOpen(true);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("novo");
            next.delete("acao");
            return next;
          },
          { replace: true },
        );
      }, 0);
      return () => clearTimeout(timer);
    }

    if (paramKit && !permission.isReadOnlyMode) {
      const validKits: CategoryKitId[] = ["essential", "business", "family", "vehicle"];
      const targetKit = validKits.includes(paramKit as CategoryKitId)
        ? (paramKit as CategoryKitId)
        : undefined;
      const timer = setTimeout(() => {
        setInitialKitId(targetKit);
        setKitsModalOpen(true);
        setSearchParams(
          (prev) => {
            const next = new URLSearchParams(prev);
            next.delete("kit");
            return next;
          },
          { replace: true },
        );
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [searchParams, permission.isReadOnlyMode, setSearchParams]);

  // Contagens por tipo
  const expenseCount = useMemo(
    () => allCategories.filter((c) => c.type === "expense").length,
    [allCategories],
  );
  const incomeCount = useMemo(
    () => allCategories.filter((c) => c.type === "income").length,
    [allCategories],
  );

  // Filtragem
  const filteredCategories = useMemo(() => {
    const normalizedQuery = normalizeCategoryKeyword(searchQuery);

    return allCategories.filter((category) => {
      // 1. Filtro por tipo (despesa ou receita)
      if (category.type !== activeType) return false;

      // 2. Filtro por escopo
      if (scopeFilter === "personal") {
        if (category.scope === "business" || category.is_family) return false;
      } else if (scopeFilter === "business") {
        if (category.scope !== "business") return false;
      } else if (scopeFilter === "family") {
        if (!category.is_family && category.scope !== "both") return false;
      }

      // 3. Filtro por busca textual
      if (normalizedQuery) {
        const normName = normalizeCategoryKeyword(category.name);
        if (!normName.includes(normalizedQuery)) return false;
      }

      return true;
    });
  }, [allCategories, activeType, scopeFilter, searchQuery]);

  // Irmãs para o diálogo de migração de exclusão
  const currentTargetCategory = deletingCategory ?? editingCategory;
  const siblings = useMemo(() => {
    if (!currentTargetCategory) return [];
    return allCategories.filter(
      (c) => c.type === currentTargetCategory.type && c.id !== currentTargetCategory.id,
    );
  }, [allCategories, currentTargetCategory]);

  // Consulta de uso da categoria a ser excluída
  const usageQuery = useCategoryUsage(deletingCategory ? deletingCategory.id : null);

  const handleTypeChange = (type: CategoryType) => {
    setActiveType(type);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("type", type);
        return next;
      },
      { replace: true },
    );
  };

  const handleOpenCreate = () => {
    setCreateOpen(true);
  };

  const handleOpenEdit = (category: Category) => {
    setEditingCategory(category);
  };

  const handleOpenDelete = (category: Category) => {
    setDeletingCategory(category);
  };

  const handleOpenKits = (kitId?: CategoryKitId) => {
    setInitialKitId(kitId);
    setKitsModalOpen(true);
  };

  return {
    permission,
    activeType,
    handleTypeChange,
    searchQuery,
    setSearchQuery,
    scopeFilter,
    setScopeFilter,
    expenseCount,
    incomeCount,
    filteredCategories,
    allCategories,
    isLoading: allCategoriesQuery.isLoading,
    isError: allCategoriesQuery.isError,
    error: allCategoriesQuery.error,
    refetch: allCategoriesQuery.refetch,
    // Diálogos
    createOpen,
    setCreateOpen,
    editingCategory,
    setEditingCategory,
    deletingCategory,
    setDeletingCategory,
    kitsModalOpen,
    setKitsModalOpen,
    initialKitId,
    siblings,
    categoryUsage: usageQuery.data ?? null,
    // Ações
    handleOpenCreate,
    handleOpenEdit,
    handleOpenDelete,
    handleOpenKits,
  };
}
