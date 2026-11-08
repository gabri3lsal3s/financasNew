import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Alert, Button, ColorPicker, IconPicker, Input, Modal, ModalFooter, RadioGroup, Switch } from "@/components/ui";
import type { IconPickerOption } from "@/components/ui";
import { CATEGORY_ICON_MAP } from "@/components/modules/category-icons";
import { categoryFormSchema, suggestCategory } from "@/domain/budgets";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useCreateCategory, useFamilyMode, useMyFamily, useUpdateCategory } from "@/state";
import { DeleteCategoryDialog } from "@/features/budgets/components/delete-category-dialog";
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
  const [isFamily, setIsFamily] = useState(Boolean(category?.is_family));
  const [error, setError] = useState<string | null>(null);

  const { isFamilyModeEnabled } = useFamilyMode();
  const { data: myFamilyData } = useMyFamily();
  const isFamilyActive = Boolean(isFamilyModeEnabled);
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
    const rawForm = {
      name,
      type,
      icon: icon || null,
      color: color || null,
      is_family: isFamilyActive ? isFamily : Boolean(category?.is_family),
    };
    const parsed = categoryFormSchema.safeParse(rawForm);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados da categoria inválidos.");
      return;
    }

    try {
      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          input: {
            name: parsed.data.name,
            icon: parsed.data.icon ?? null,
            color: parsed.data.color ?? null,
            is_family: parsed.data.is_family,
            family_id: parsed.data.is_family ? (category.family_id ?? myFamilyData?.family.id ?? null) : null,
          },
        });
      } else {
        await createCategory.mutateAsync({
          type: parsed.data.type,
          name: parsed.data.name,
          icon: parsed.data.icon ?? null,
          color: parsed.data.color ?? null,
          is_family: parsed.data.is_family,
          family_id: parsed.data.is_family ? (myFamilyData?.family.id ?? null) : null,
        });
      }
      triggerSensory("success");
      onClose();
    } catch (err) {
      triggerSensory("destructive");
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
      className="mt-4 flex flex-col gap-3.5"
    >
      {error ? <Alert variant="error">{error}</Alert> : null}

      {!category ? (
        <RadioGroup
          value={type}
          onValueChange={(value) => {
            setType(value as CategoryType);
          }}
          name="category-type"
          options={[
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Renda" },
          ]}
        />
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="category-name" className="text-xs font-semibold text-foreground">
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
          <p className="text-[11px] text-muted-foreground">
            {suggestCategory(name)
              ? "Ícone e cor sugeridos automaticamente (e limite de orçamento por % da renda)."
              : "Sem regra conhecida para este nome — escolha ícone e cor manualmente."}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Ícone</span>
          <IconPicker
            value={icon}
            onValueChange={setIcon}
            options={ICON_OPTIONS}
            placeholder="Selecione"
            ariaLabel="Ícone da categoria"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Cor</span>
          <ColorPicker
            value={color}
            onValueChange={setColor}
            ariaLabel="Cor da categoria"
          />
        </div>
      </div>

      {isFamilyActive && (
        <div className="rounded-xl border border-border/80 bg-surface-raised p-3">
          <Switch
            id="category-is-family"
            checked={isFamily}
            onCheckedChange={setIsFamily}
            label="Sugerir como familiar por padrão"
            description="Lançamentos desta categoria serão marcados como despesas familiares automaticamente."
          />
        </div>
      )}

      <ModalFooter
        destructiveAction={
          category && siblings !== undefined ? (
            <Button
              type="button"
              variant="ghost"
              className="text-critical hover:bg-critical/10"
              onClick={onOpenDelete}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              Excluir
            </Button>
          ) : null
        }
      >
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          Cancelar
        </Button>
        <Button
          type="submit"
          aria-label={category ? "Salvar alterações" : "Criar categoria"}
          disabled={name.trim() === "" || pending}
        >
          {pending ? "Salvando…" : (
            <>
              <span className="hidden sm:inline">{category ? "Salvar alterações" : "Criar categoria"}</span>
              <span className="sm:hidden">Salvar</span>
            </>
          )}
        </Button>
      </ModalFooter>
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
        size="md"
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
