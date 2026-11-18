import {
  ColorPicker,
  FormField,
  IconPicker,
  Input,
  RadioGroup,
  Switch,
} from "@/components/ui";
import { suggestCategory } from "@/domain/budgets";
import type { CategoryType } from "@/types";
import { CATEGORY_ICON_OPTIONS } from "./category-icon-labels";

export interface CategoryFormFieldsProps {
  isEditing: boolean;
  name: string;
  onNameChange: (value: string) => void;
  type: CategoryType;
  onTypeChange: (value: CategoryType) => void;
  icon: string;
  onIconChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  isFamilyActive: boolean;
  isFamily: boolean;
  onIsFamilyChange: (checked: boolean) => void;
}

export function CategoryFormFields({
  isEditing,
  name,
  onNameChange,
  type,
  onTypeChange,
  icon,
  onIconChange,
  color,
  onColorChange,
  isFamilyActive,
  isFamily,
  onIsFamilyChange,
}: CategoryFormFieldsProps) {
  const suggestionHelper =
    !isEditing && name.trim()
      ? suggestCategory(name)
        ? "Ícone e cor sugeridos automaticamente (e limite de orçamento por % da renda)."
        : "Sem regra conhecida para este nome — escolha ícone e cor manualmente."
      : undefined;

  return (
    <>
      {!isEditing ? (
        <RadioGroup
          value={type}
          onValueChange={(value) => onTypeChange(value as CategoryType)}
          name="category-type"
          options={[
            { value: "expense", label: "Despesa" },
            { value: "income", label: "Renda" },
          ]}
        />
      ) : null}

      <FormField label="Nome" htmlFor="category-name" helperText={suggestionHelper}>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Ex.: Alimentação"
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Ícone">
          <IconPicker
            value={icon}
            onValueChange={onIconChange}
            options={CATEGORY_ICON_OPTIONS}
            placeholder="Selecione"
            ariaLabel="Ícone da categoria"
          />
        </FormField>

        <FormField label="Cor">
          <ColorPicker
            value={color}
            onValueChange={onColorChange}
            ariaLabel="Cor da categoria"
          />
        </FormField>
      </div>

      {isFamilyActive ? (
        <div className="rounded-xl border border-border/80 bg-surface-raised p-3">
          <Switch
            id="category-is-family"
            checked={isFamily}
            onCheckedChange={onIsFamilyChange}
            label="Sugerir como familiar por padrão"
            description="Lançamentos desta categoria serão marcados como despesas familiares automaticamente."
          />
        </div>
      ) : null}
    </>
  );
}
