import { useState } from "react";
import { Alert, Button, Input, Modal, RadioGroup, Select } from "@/components/ui";
import { CATEGORY_ICON_OPTIONS } from "@/components/modules/category-icons";
import { suggestCategory } from "@/domain/budgets";
import { getErrorMessage } from "@/services/errors";
import { useCreateCategory, useUpdateCategory } from "@/state";
import type { Category, CategoryType } from "@/types";

export interface CategoryFormDialogProps {
  /** Categoria em edição; `null` = criação. */
  category: Category | null;
  /** Tipo pré-selecionado (criação). */
  defaultType: CategoryType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Formulário de categoria (CRUD §3.5.1) com sugestão inteligente por nome. */
export function CategoryFormDialog({ category, defaultType, open, onOpenChange }: CategoryFormDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("expense");
  const [icon, setIcon] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const pending = createCategory.isPending || updateCategory.isPending;

  const reset = () => {
    setError(null);
    if (category) {
      setName(category.name);
      setType(category.type);
      setIcon(category.icon ?? "");
      setColor(category.color ?? "");
    } else {
      setName("");
      setType(defaultType);
      setIcon("");
      setColor("");
    }
  };

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
      onOpenChange(false);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setError(null);
        onOpenChange(next);
      }}
      title={category ? "Editar categoria" : "Nova categoria"}
      description={category ? undefined : "A sugestão inteligente infere ícone, cor e limite por nome."}
    >
      <div className="mt-4 flex flex-col gap-4">
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
            <Select
              value={icon}
              onValueChange={setIcon}
              options={CATEGORY_ICON_OPTIONS.map((option) => ({ value: option, label: option }))}
              placeholder="Selecione"
              ariaLabel="Ícone da categoria"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category-color" className="text-sm font-medium">
              Cor
            </label>
            <Input id="category-color" value={color} onChange={(event) => setColor(event.target.value)} placeholder="#8B5CF6" />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" disabled={name.trim() === "" || pending} onClick={() => void handleSubmit()}>
            {pending ? "Salvando…" : category ? "Salvar alterações" : "Criar categoria"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
