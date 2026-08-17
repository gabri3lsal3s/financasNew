import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button, ColorPicker, IconPicker, Input, Modal, RadioGroup } from "@/components/ui";
import type { IconPickerOption } from "@/components/ui";
import { CATEGORY_ICON_MAP } from "@/components/modules/category-icons";
import { suggestCategory } from "@/domain/budgets";
import { getErrorMessage } from "@/services/errors";
import { useCreateCategory, useUpdateCategory } from "@/state";
import { DeleteCategoryDialog } from "@/features/categories/components/delete-category-dialog";
import type { Category, CategoryType } from "@/types";

/** Opções de ícone (lucide-react, sem emojis) montadas uma única vez. */
const ICON_OPTIONS: IconPickerOption[] = Object.entries(CATEGORY_ICON_MAP).map(([name, icon]) => ({
  value: name,
  label: name,
  icon,
}));

export interface CategoryFormDialogProps {
  /** Categoria em edição; `null` = criação. */
  category: Category | null;
  /** Tipo pré-selecionado (criação). */
  defaultType: CategoryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Irmãs de mesmo tipo (destinos de migração na exclusão). Obrigatório em edição. */
  siblings?: Category[];
  /** Uso atual da categoria (lançamentos vinculados). Obrigatório em edição. */
  usage?: { expenses: number; incomes: number } | null;
}

interface CategoryFormContentProps {
  category: Category | null;
  defaultType: CategoryType;
  onClose: () => void;
  siblings?: Category[];
  onOpenDelete?: () => void;
}

function CategoryFormContent({
  category,
  defaultType,
  onClose,
  siblings,
  onOpenDelete,
}: CategoryFormContentProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [type, setType] = useState<CategoryType>(category?.type ?? defaultType);
  const [icon, setIcon] = useState(category?.icon ?? "");
  const [color, setColor] = useState(category?.color ?? "");
  const [error, setError] = useState<string | null>(null);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const pending = createCategory.isPending || updateCategory.isPending;

  const applySuggestion = (value: string) => {
    const rule = suggestCategory(value);
    if (rule) {
      setIcon(rule.icon);
      if (!color) setColor(rule.color);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          input: {
            name: name.trim(),
            icon: icon || null,
            color: color || null,
          },
        });
      } else {
        await createCategory.mutateAsync({ type, name: name.trim(), icon: icon || null, color: color || null });
      }
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim() !== "" && !pending) {
          void handleSubmit();
        }
      }}
      className="mt-4 flex flex-col gap-4"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      {!category ? (
        <RadioGroup
          value={type}
          onValueChange={(value) => setType(value as CategoryType)}
          name="category-type"
          options={[
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Renda" },
          ]}
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category-name" className="text-sm font-medium">
          Nome
        </label>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            if (!category) applySuggestion(event.target.value);
          }}
          placeholder="Ex.: Alimentação"
        />
        {!category && name.trim() ? (
          <p className="text-xs text-muted-foreground">
            {suggestCategory(name)
              ? "Ícone e cor sugeridos automaticamente (e limite de orçamento por % da renda)."
              : "Sem regra conhecida para este nome — escolha ícone e cor manualmente."}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Ícone</span>
          <IconPicker
            value={icon}
            onValueChange={setIcon}
            options={ICON_OPTIONS}
            placeholder="Selecione"
            ariaLabel="Ícone da categoria"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Cor</span>
          <ColorPicker
            value={color}
            onValueChange={setColor}
            ariaLabel="Cor da categoria"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        {category && siblings !== undefined ? (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-negative hover:bg-negative/10 hover:text-negative"
            onClick={onOpenDelete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Excluir
          </Button>
        ) : null}
        <Button type="button" variant="ghost" onClick={onClose} className="ml-auto">
          Cancelar
        </Button>
        <Button type="submit" disabled={name.trim() === "" || pending}>
          {pending ? "Salvando…" : category ? "Salvar alterações" : "Criar categoria"}
        </Button>
      </div>
    </form>
  );
}

/** Formulário de categoria (CRUD §3.5.1) com sugestão inteligente por nome. */
export function CategoryFormDialog({ category, defaultType, open, onOpenChange, siblings, usage }: CategoryFormDialogProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title={category ? "Editar categoria" : "Nova categoria"}
        description={category ? undefined : "A sugestão inteligente infere ícone, cor e limite por nome."}
      >
        {open ? (
          <CategoryFormContent
            key={category?.id ?? "new-category"}
            category={category}
            defaultType={defaultType}
            onClose={() => onOpenChange(false)}
            siblings={siblings}
            onOpenDelete={() => setDeleteOpen(true)}
          />
        ) : null}
      </Modal>

      {category && siblings !== undefined ? (
        <DeleteCategoryDialog
          category={category}
          siblings={siblings}
          usage={usage ?? null}
          open={deleteOpen}
          onOpenChange={(next) => {
            setDeleteOpen(next);
            // Ao fechar o diálogo de exclusão (cancelou ou confirmou), fecha o form também
            if (!next) onOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}
