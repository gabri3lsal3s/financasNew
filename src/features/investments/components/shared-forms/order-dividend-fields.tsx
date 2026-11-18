import { Checkbox, DatePicker, FormField, MoneyInput, MoneyText, SegmentedControl } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { numberToCents } from "@/domain/money";
import { computeDividendTotalFromMode, type DividendCalculationMode } from "@/domain/portfolio";
import type { DividendEntryMode } from "@/domain/portfolio/dividends";
import type { AssetCurrency } from "@/types";

export interface OrderDividendFieldsProps {
  currency: AssetCurrency;
  isTotalValue: boolean;
  custodyQty: number;
  calcMode: DividendCalculationMode;
  onCalcModeChange: (mode: DividendCalculationMode) => void;
  totalCents: number;
  onTotalCentsChange: (cents: number) => void;
  perShareCents: number;
  onPerShareCentsChange: (cents: number) => void;
  entryMode: DividendEntryMode;
  onEntryModeChange: (mode: DividendEntryMode) => void;
  date: string;
  onDateChange: (date: string) => void;
  month: string;
  onMonthChange: (month: string) => void;
  creditCash: boolean;
  onCreditCashChange: (checked: boolean) => void;
  idPrefix: string;
}

export function OrderDividendFields({
  currency,
  isTotalValue,
  custodyQty,
  calcMode,
  onCalcModeChange,
  totalCents,
  onTotalCentsChange,
  perShareCents,
  onPerShareCentsChange,
  entryMode,
  onEntryModeChange,
  date,
  onDateChange,
  month,
  onMonthChange,
  creditCash,
  onCreditCashChange,
  idPrefix,
}: OrderDividendFieldsProps) {
  const moneyPlaceholder = currency === "USD" ? "$ 0.00" : "R$ 0,00";
  const effectiveTotalBRL = computeDividendTotalFromMode({
    calcMode,
    totalCents,
    perShareCents,
    custodyQty,
    isTotalValue,
  });

  return (
    <div className="flex flex-col gap-4">
      {!isTotalValue && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Formato do Valor</span>
          <SegmentedControl
            value={calcMode}
            onChange={onCalcModeChange}
            options={[
              { value: "total", label: "Valor Total Recebido" },
              { value: "per_share", label: "Valor por Cota" },
            ]}
            ariaLabel="Formato do valor do provento"
            fullWidth
          />
        </div>
      )}

      {calcMode === "per_share" && !isTotalValue ? (
        <div className="flex flex-col gap-2">
          <FormField
            label={`Rendimento por Cota (Líquido) (${currency})`}
            htmlFor={`${idPrefix}-div-per-share`}
          >
            <MoneyInput
              id={`${idPrefix}-div-per-share`}
              cents={perShareCents}
              currency={currency}
              onCentsChange={onPerShareCentsChange}
              placeholder={moneyPlaceholder}
            />
          </FormField>
          <div className="flex items-center justify-between gap-2 rounded-xl border border-border/80 bg-surface-raised/60 p-3 text-xs">
            <span className="text-muted-foreground">Total calculado ({custodyQty} cotas):</span>
            <MoneyText cents={numberToCents(effectiveTotalBRL)} currency={currency} tone="positive" className="text-sm font-bold" />
          </div>
        </div>
      ) : (
        <FormField
          label={`Valor Total Recebido (Líquido) (${currency})`}
          htmlFor={`${idPrefix}-div-amount`}
        >
          <MoneyInput
            id={`${idPrefix}-div-amount`}
            cents={totalCents}
            currency={currency}
            onCentsChange={onTotalCentsChange}
            placeholder={moneyPlaceholder}
          />
        </FormField>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">Modo de Registro</span>
        <SegmentedControl
          value={entryMode}
          onChange={onEntryModeChange}
          options={[
            { value: "daily", label: "Diário (Data Exata)" },
            { value: "monthly", label: "Extrato do Mês" },
          ]}
          ariaLabel="Modo de registro do provento"
          fullWidth
        />

        {entryMode === "daily" ? (
          <DatePicker value={date} onValueChange={onDateChange} />
        ) : (
          <div className="flex flex-col gap-1">
            <MonthPicker value={month} onValueChange={onMonthChange} />
            <p className="text-[11px] text-muted-foreground">
              Gravado como {month}-01 com tag [MENSAL] para o calendário do mês selecionado.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 rounded-xl border border-border/80 bg-surface-raised/60 p-3 text-xs">
        <Checkbox
          id={`${idPrefix}-div-sync-cash`}
          checked={creditCash}
          onCheckedChange={(c) => onCreditCashChange(Boolean(c))}
          label="Creditar o rendimento diretamente no Caixa da carteira"
        />
        <p className="text-[11px] text-muted-foreground pl-6">
          Aumenta a liquidez em caixa para reinvestimentos sem registrar novo aporte do bolso.
        </p>
      </div>
    </div>
  );
}
