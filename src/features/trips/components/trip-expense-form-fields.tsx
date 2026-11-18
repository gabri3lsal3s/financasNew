import { Plus } from "lucide-react";
import {
  Button,
  DatePicker,
  FormField,
  Input,
  MoneyInput,
  Select,
  type SelectOption,
} from "@/components/ui";
import { todayISO } from "@/lib/date";

export interface TripExpenseFormFieldsProps {
  formId: string;
  amountCents: number;
  onAmountCentsChange: (cents: number) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  descriptionPlaceholder?: string;
  descriptionMaxLength?: number;
  categoryName: string;
  onCategoryNameChange: (name: string) => void;
  categoryOptions: SelectOption[];
  canCreateCategory?: boolean;
  onCreateCategoryClick?: () => void;
  payerId: string;
  onPayerIdChange: (payerId: string) => void;
  payerOptions: SelectOption[];
  payerPlaceholder?: string;
  expenseDate: string;
  onExpenseDateChange: (date: string) => void;
}

export function TripExpenseFormFields({
  formId,
  amountCents,
  onAmountCentsChange,
  description,
  onDescriptionChange,
  descriptionPlaceholder = "Ex.: Almoço no centro, Uber, Combustível",
  descriptionMaxLength = 140,
  categoryName,
  onCategoryNameChange,
  categoryOptions,
  canCreateCategory = false,
  onCreateCategoryClick,
  payerId,
  onPayerIdChange,
  payerOptions,
  payerPlaceholder,
  expenseDate,
  onExpenseDateChange,
}: TripExpenseFormFieldsProps) {
  return (
    <>
      <FormField label="Valor Pago" required htmlFor={`${formId}-amount`}>
        <MoneyInput
          id={`${formId}-amount`}
          aria-label="Valor Pago"
          cents={amountCents}
          onCentsChange={onAmountCentsChange}
          placeholder="R$ 0,00"
          className="font-semibold"
          required
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Descrição do Gasto" required htmlFor={`${formId}-description`}>
          <Input
            id={`${formId}-description`}
            aria-label="Descrição do Gasto"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder={descriptionPlaceholder}
            maxLength={descriptionMaxLength}
            className="text-base sm:text-sm"
            required
          />
        </FormField>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2 min-h-5">
            <label htmlFor={`${formId}-category`} className="text-xs font-semibold text-foreground select-none">
              Categoria
            </label>
            {canCreateCategory && onCreateCategoryClick ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCreateCategoryClick}
                className="min-h-11 sm:min-h-8 px-2 text-primary-strong hover:text-primary-strong gap-1 font-medium -my-2"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                <span>Nova Categoria</span>
              </Button>
            ) : null}
          </div>
          <Select
            id={`${formId}-category`}
            ariaLabel="Categoria da despesa"
            value={categoryName}
            onValueChange={onCategoryNameChange}
            options={categoryOptions}
            placeholder="Selecione a categoria"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Quem pagou?" required htmlFor={`${formId}-payer`}>
          <Select
            id={`${formId}-payer`}
            ariaLabel="Quem pagou"
            value={payerId}
            onValueChange={onPayerIdChange}
            options={payerOptions}
            placeholder={payerPlaceholder}
          />
        </FormField>

        <FormField label="Data do Gasto" htmlFor={`${formId}-date`}>
          <DatePicker
            id={`${formId}-date`}
            value={expenseDate || ""}
            onChange={(val) => onExpenseDateChange(val || todayISO())}
          />
        </FormField>
      </div>
    </>
  );
}
