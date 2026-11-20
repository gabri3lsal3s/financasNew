import { useState } from "react";
import { categoryFormSchema, suggestCategory } from "@/domain/budgets";
import { useMutationGuard } from "@/hooks/use-mutation-guard";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useCreateCategory, useFamilyMode, useMyFamily, useUpdateCategory } from "@/state";
import type { Category, CategoryType } from "@/types";

export interface UseCategoryFormParams {
  category: Category | null;
  defaultType: CategoryType;
  onClose: () => void;
  onSuccess?: (category: Category) => void;
}

export function useCategoryForm({ category, defaultType, onClose, onSuccess }: UseCategoryFormParams) {
  const { guardAction, upgradeModal, isReadOnlyMode } = useMutationGuard({ moduleKey: "budgets" });
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<CategoryType>(category?.type ?? defaultType);
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [color, setColor] = useState(category?.color ?? "");
  const [isFamily, setIsFamily] = useState(Boolean(category?.is_family));
  const [error, setError] = useState<string | null>(null);

  const { isFamilyModeEnabled } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const pending = createCategory.isPending || updateCategory.isPending;

  const handleNameChange = (value: string) => {
    setName(value);
    if (!category) {
      const rule = suggestCategory(value);
      if (rule) {
        setIcon(rule.icon);
        if (!color) setColor(rule.color);
      }
    }
  };

  const handleSubmit = async () => {
    if (isReadOnlyMode) {
      guardAction(() => {}, category ? "Editar Categoria" : "Cadastrar Nova Categoria");
      return;
    }
    setError(null);
    const parsed = categoryFormSchema.safeParse({
      name,
      type,
      icon: icon || null,
      color: color || null,
      is_family: isFamilyActive ? isFamily : Boolean(category?.is_family),
    });
    if (!parsed.success) {
      triggerSensory("error");
      setError(parsed.error.issues[0]?.message ?? "Dados da categoria inválidos.");
      return;
    }

    try {
      const familyId = parsed.data.is_family
        ? (category?.family_id ?? myFamilyData?.family.id ?? null)
        : null;
      if (category) {
        const updated = await updateCategory.mutateAsync({
          id: category.id,
          input: {
            name: parsed.data.name,
            icon: parsed.data.icon ?? null,
            color: parsed.data.color ?? null,
            is_family: parsed.data.is_family,
            family_id: familyId,
          },
        });
        triggerSensory("success");
        if (updated) onSuccess?.(updated);
      } else {
        const created = await createCategory.mutateAsync({
          type: parsed.data.type,
          name: parsed.data.name,
          icon: parsed.data.icon ?? null,
          color: parsed.data.color ?? null,
          is_family: parsed.data.is_family,
          family_id: familyId,
        });
        triggerSensory("success");
        if (created) onSuccess?.(created);
      }
      onClose();
    } catch (err) {
      triggerSensory("error");
      setError(getErrorMessage(err));
    }
  };

  const isDirty = category
    ? name !== category.name ||
      type !== category.type ||
      icon !== (category.icon ?? "") ||
      color !== (category.color ?? "") ||
      isFamily !== Boolean(category.is_family)
    : name.trim() !== "" || icon !== "" || color !== "";

  return {
    isDirty,
    name,
    type,
    setType,
    icon,
    setIcon,
    color,
    setColor,
    isFamily,
    setIsFamily,
    error,
    isFamilyActive,
    pending,
    guardAction,
    upgradeModal,
    handleNameChange,
    handleSubmit,
  };
}
