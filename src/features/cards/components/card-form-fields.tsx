import { Checkbox, ColorPicker, FormField, Input, MoneyInput, NumberStepper } from "@/components/ui";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

const QUICK_BRANDS = ["Visa", "Mastercard", "Elo", "Amex"] as const;

const CARD_COLOR_PRESETS = [
  { name: "Petróleo", hex: "#162432" },
  { name: "Grafite", hex: "#242424" },
  { name: "Bronze Nomad", hex: "#2B1410" },
  { name: "Roxo Nubank", hex: "#820AD9" },
  { name: "Laranja Inter", hex: "#FF7A00" },
  { name: "Azul Itaú", hex: "#003399" },
  { name: "Vermelho Santander", hex: "#CC092F" },
  { name: "Verde Esmeralda", hex: "#0F766E" },
] as const;

export interface CardFormFieldsProps {
  isEditing: boolean;
  name: string;
  onNameChange: (value: string) => void;
  brand: string;
  onBrandChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  limitCents: number;
  onLimitCentsChange: (cents: number) => void;
  lastFourDigits: string;
  onLastFourDigitsChange: (value: string) => void;
  closingDay: number;
  onClosingDayChange: (day: number) => void;
  dueDay: number;
  onDueDayChange: (day: number) => void;
  isPrimary: boolean;
  onIsPrimaryChange: (checked: boolean) => void;
  isActive: boolean;
  onIsActiveChange: (checked: boolean) => void;
}

export function CardFormFields({
  isEditing,
  name,
  onNameChange,
  brand,
  onBrandChange,
  color,
  onColorChange,
  limitCents,
  onLimitCentsChange,
  lastFourDigits,
  onLastFourDigitsChange,
  closingDay,
  onClosingDayChange,
  dueDay,
  onDueDayChange,
  isPrimary,
  onIsPrimaryChange,
  isActive,
  onIsActiveChange,
}: CardFormFieldsProps) {
  return (
    <div className="md:col-span-7 flex flex-col gap-3.5">
      <FormField label="Nome" htmlFor="card-name">
        <Input
          id="card-name"
          value={name}
          onChange={(event) => onNameChange(event.target.value)}
          placeholder="Ex.: Nomad, Nubank Ultravioleta..."
        />
      </FormField>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Bandeira" htmlFor="card-brand">
          <Input
            id="card-brand"
            value={brand}
            onChange={(event) => onBrandChange(event.target.value)}
            placeholder="Visa, Mastercard, Elo..."
          />
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {QUICK_BRANDS.map((item) => {
              const isSelected = brand.trim().toLowerCase() === item.toLowerCase();
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onBrandChange(item);
                  }}
                  className={cn(
                    "relative cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-1.5",
                    isSelected
                      ? "bg-primary/10 border-primary text-primary-strong font-semibold"
                      : "bg-surface border-border/80 text-muted-foreground hover:text-foreground hover:bg-surface-hover",
                  )}
                >
                  {item}
                </button>
              );
            })}
          </div>
        </FormField>

        <FormField label="Cor">
          <ColorPicker value={color} onValueChange={onColorChange} ariaLabel="Cor do cartão" />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {CARD_COLOR_PRESETS.map((preset) => {
              const isSelected = color.trim().toUpperCase() === preset.hex.toUpperCase();
              return (
                <button
                  key={preset.hex}
                  type="button"
                  title={preset.name}
                  aria-label={`Cor ${preset.name}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    triggerSensory("selection");
                    onColorChange(preset.hex);
                  }}
                  className={cn(
                    "relative size-9 cursor-pointer rounded-full border transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring shadow-xs max-sm:after:absolute max-sm:after:-inset-1",
                    isSelected
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-surface scale-105 border-surface"
                      : "border-border/80",
                  )}
                  style={{ backgroundColor: preset.hex }}
                />
              );
            })}
          </div>
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Limite total" htmlFor="card-limit" optional>
          <MoneyInput
            id="card-limit"
            cents={limitCents}
            onCentsChange={onLimitCentsChange}
            aria-label="Limite total do cartão"
          />
        </FormField>

        <FormField
          label="Últimos 4 dígitos"
          htmlFor="card-last-four-digits"
          optional
          helperText="Facilita o reconhecimento automático em notificações e carteiras digitais."
        >
          <Input
            id="card-last-four-digits"
            value={lastFourDigits}
            maxLength={4}
            onChange={(event) => {
              const val = event.target.value.replace(/\D/g, "").slice(0, 4);
              onLastFourDigitsChange(val);
            }}
            placeholder="Ex.: 7756"
          />
        </FormField>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <FormField label="Dia de fechamento">
          <NumberStepper
            value={closingDay}
            onValueChange={onClosingDayChange}
            min={1}
            max={31}
            decreaseLabel="Diminuir dia de fechamento"
            increaseLabel="Aumentar dia de fechamento"
          />
        </FormField>
        <FormField label="Dia de vencimento">
          <NumberStepper
            value={dueDay}
            onValueChange={onDueDayChange}
            min={1}
            max={31}
            decreaseLabel="Diminuir dia de vencimento"
            increaseLabel="Aumentar dia de vencimento"
          />
        </FormField>
      </div>

      <div className="rounded-xl border border-border/80 bg-surface-raised p-3 flex flex-col gap-1.5">
        <Checkbox
          checked={isPrimary}
          onCheckedChange={(checked) => onIsPrimaryChange(Boolean(checked))}
          label="Definir como cartão principal"
          id="card-is-primary"
        />
        <p className="text-[11px] text-muted-foreground pl-6">
          O cartão principal é exibido em primeiro lugar na carteira e abre selecionado por padrão.
        </p>
      </div>

      {isEditing ? (
        <div className="rounded-xl border border-border/80 bg-surface-raised p-3 flex flex-col gap-1.5">
          <Checkbox
            checked={isActive}
            onCheckedChange={onIsActiveChange}
            label="Cartão ativo para novas compras"
            id="card-active"
          />
          {!isActive ? (
            <p className="text-[11px] text-muted-foreground pl-6">
              Cartão desativado: permanece no histórico de faturas e relatórios passados, mas fica oculto para novas despesas.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
