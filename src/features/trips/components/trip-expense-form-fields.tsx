import { ClipboardPaste, Plus } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  DatePicker,
  Dropzone,
  FormField,
  Input,
  MoneyInput,
  NumericInput,
  Select,
  type SelectOption,
} from "@/components/ui";
import {
  formatForeignCurrencyAmount,
  TRIP_CURRENCY_LABELS,
  TRIP_FOREIGN_CURRENCIES,
  type TripForeignCurrencyCode,
} from "@/domain/trips";
import { todayISO } from "@/lib/date";
import { formatCentsAsCurrency } from "@/services/masks";

const FOREIGN_CURRENCY_OPTIONS: SelectOption[] = TRIP_FOREIGN_CURRENCIES.map((code) => ({
  value: code,
  label: TRIP_CURRENCY_LABELS[code],
}));

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
  onReceiptFileSelect?: (file: File) => void;
  onPasteClipboard?: () => void;
  isScanningReceipt?: boolean;
  scanFeedbackMessage?: string | null;
  foreignCurrency?: TripForeignCurrencyCode | null;
  foreignAmountCents?: number;
  exchangeRateInput?: string;
  onForeignCurrencyChange?: (currency: TripForeignCurrencyCode) => void;
  onForeignAmountCentsChange?: (cents: number) => void;
  onExchangeRateChange?: (rate: string) => void;
  onClearForeignCurrency?: () => void;
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
  onReceiptFileSelect,
  onPasteClipboard,
  isScanningReceipt = false,
  scanFeedbackMessage = null,
  foreignCurrency = null,
  foreignAmountCents = 0,
  exchangeRateInput = "",
  onForeignCurrencyChange,
  onForeignAmountCentsChange,
  onExchangeRateChange,
  onClearForeignCurrency,
}: TripExpenseFormFieldsProps) {
  return (
    <>
      {onReceiptFileSelect ? (
        <div className="space-y-2">
          <Dropzone
            onFiles={(files) => {
              const selected = files[0];
              if (selected) onReceiptFileSelect(selected);
            }}
            accept="image/*,.pdf,application/pdf"
            label={isScanningReceipt ? "Lendo comprovante…" : "Anexar recibo, foto ou PDF"}
            hint="Preenche valor, descrição, data e identifica moeda estrangeira (Ctrl+V também funciona)"
            disabled={isScanningReceipt}
            enableCamera
            showActions
            className="px-4 py-3.5"
            extraActions={
              onPasteClipboard ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isScanningReceipt}
                  onClick={onPasteClipboard}
                  className="gap-1.5"
                >
                  <ClipboardPaste className="size-3.5" aria-hidden="true" />
                  <span>Colar texto/Pix</span>
                </Button>
              ) : undefined
            }
          />
          {scanFeedbackMessage ? (
            <Alert variant="warning">{scanFeedbackMessage}</Alert>
          ) : null}
        </div>
      ) : null}

      {foreignCurrency ? (
        <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-2.5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Conversão cambial automática
              </span>
              <Badge variant="portfolio" size="xs">
                {foreignCurrency}
              </Badge>
            </div>
            {onClearForeignCurrency ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={onClearForeignCurrency}
                className="self-start sm:self-auto"
              >
                Usar apenas R$
              </Button>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <FormField label="Moeda" htmlFor={`${formId}-fx-currency`}>
              <Select
                id={`${formId}-fx-currency`}
                ariaLabel="Moeda estrangeira"
                value={foreignCurrency}
                onValueChange={(val) =>
                  onForeignCurrencyChange?.(val as TripForeignCurrencyCode)
                }
                options={FOREIGN_CURRENCY_OPTIONS}
              />
            </FormField>

            <FormField label={`Valor (${foreignCurrency})`} htmlFor={`${formId}-fx-amount`}>
              <NumericInput
                id={`${formId}-fx-amount`}
                aria-label={`Valor original em ${foreignCurrency}`}
                progressive
                decimals={2}
                value={foreignAmountCents > 0 ? foreignAmountCents / 100 : ""}
                onNumberChange={(num) =>
                  onForeignAmountCentsChange?.(num !== null ? Math.round(num * 100) : 0)
                }
                placeholder="0,00"
                size="sm"
              />
            </FormField>

            <FormField label="Cotação (R$)" htmlFor={`${formId}-fx-rate`}>
              <NumericInput
                id={`${formId}-fx-rate`}
                aria-label="Cotação para Real"
                value={exchangeRateInput}
                onValueChange={(val) => onExchangeRateChange?.(val)}
                placeholder="Ex.: 5,80"
                size="sm"
              />
            </FormField>
          </div>

          <p className="text-[11px] text-muted-foreground">
            {foreignAmountCents > 0 && exchangeRateInput.trim()
              ? `${formatForeignCurrencyAmount(foreignAmountCents, foreignCurrency)} convertido para ${formatCentsAsCurrency(amountCents)} no rateio do grupo.`
              : "Informe a cotação de fechamento ou câmbio para converter para R$ antes do rateio."}
          </p>
        </div>
      ) : null}

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
