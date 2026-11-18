import { useMemo } from "react";
import { Check, Clock, CreditCard, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Chip, MoneyInput, MoneyText, Select, Tabs } from "@/components/ui";
import type { HabitualEntry, PredictionEntry } from "@/domain/predictions";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsCurrency } from "@/services/masks";
import { cn } from "@/lib/utils";
import type { Category, PaymentMethod, ReceiveType } from "@/types";
import { LaunchContextSelector } from "./launch-context-selector";
import { QuickCategoryGrid } from "./quick-category-grid";
import { QuickDescriptionField } from "./quick-description-field";
import type { EntryType, LaunchState } from "./wizard-types";

export interface StepQuickProps {
  state: LaunchState;
  onTypeChange: (type: EntryType) => void;
  onValueChange: (cents: number) => void;
  onCategoryChange: (categoryId: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardChange: (cardId: string) => void;
  onInstallmentsChange?: (installments: number) => void;
  isCategoryUnconfirmed?: boolean;
  onReceiveTypeChange: (type: ReceiveType) => void;
  onDescriptionChange: (description: string) => void;
  onFamilyChange?: (isFamily: boolean) => void;
  isFamilyModeEnabled?: boolean;
  onSplitToggle?: (enabled: boolean) => void;
  onSplitPeopleCountChange?: (count: number) => void;
  onSplitDebtModeChange?: (mode: "single_total" | "per_installment") => void;
  activeTrips?: { id: string; title: string; destination?: string | null }[];
  onTripChange?: (tripId: string | null) => void;
  activeTripMemberName?: string;
  onSwitchToGuided: () => void;
  categories: Category[] | undefined;
  categoriesLoading?: boolean;
  predictionEntries?: readonly PredictionEntry[] | null;
  habits?: HabitualEntry[];
  onApplyHabitual?: (habit: HabitualEntry) => void;
  cards: { id: string; name: string }[] | undefined;
  cardsLoading?: boolean;
  onSubmit?: () => void;
}

const EXPENSE_PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "credit_card", label: "Cartão de Crédito" },
  { value: "debit", label: "Débito" },
  { value: "cash", label: "Dinheiro" },
];

const INCOME_RECEIVE_TYPES: { value: ReceiveType; label: string }[] = [
  { value: "pix", label: "Pix" },
  { value: "transfer", label: "Transferência" },
  { value: "cash", label: "Dinheiro" },
  { value: "other", label: "Outro" },
];

export function StepQuick(props: StepQuickProps) {
  const {
    state, onTypeChange, onValueChange, onCategoryChange, onPaymentMethodChange,
    onCardChange, onInstallmentsChange, isCategoryUnconfirmed = false, onReceiveTypeChange,
    onDescriptionChange, onFamilyChange, isFamilyModeEnabled = false, onSplitToggle,
    onSplitPeopleCountChange, onSplitDebtModeChange, activeTrips, onTripChange,
    activeTripMemberName, onSwitchToGuided, categories, categoriesLoading = false,
    predictionEntries, habits, onApplyHabitual, cards, cardsLoading = false, onSubmit,
  } = props;

  const isExpense = state.type === "expense";
  const installmentOptions = useMemo(
    () => Array.from({ length: 12 }, (_, idx) => {
      const i = idx + 1;
      const suffix = state.valueCents > 0 ? (i === 1 ? ` · ${formatCentsAsCurrency(state.valueCents)}` : ` de ${formatCentsAsCurrency(Math.round(state.valueCents / i))}`) : "";
      return { value: String(i), label: i === 1 ? `1x (à vista)${suffix}` : `${i}x${suffix}` };
    }),
    [state.valueCents],
  );

  const showContextSelector = isFamilyModeEnabled || (isExpense && ((activeTrips && activeTrips.length > 0) || onSplitToggle));

  return (
    <div className="flex flex-col gap-4">
      <Tabs
        value={state.type}
        fullWidth
        onValueChange={(val) => onTypeChange(val as EntryType)}
        items={[{ value: "expense", label: "Despesa", content: null }, { value: "income", label: "Renda", content: null }]}
      />

      {habits && habits.length > 0 ? (
        <div className="flex flex-col gap-1.5" data-testid="quick-habitual-entries">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Clock className="size-3 text-muted-foreground" aria-hidden="true" />
            <span>Habituais sugeridos:</span>
          </div>
          <div className="no-scrollbar flex items-center gap-2 overflow-x-auto scroll-smooth py-0.5">
            {habits.map((habit) => (
              <Chip
                key={`${habit.description}-${habit.categoryName}`}
                size="md"
                sensoryIntent="action"
                aria-label={`Usar habitual ${habit.description}: ${formatCentsAsCurrency(Math.round(habit.value * 100))}`}
                onClick={() => onApplyHabitual?.(habit)}
              >
                <span className="max-w-[120px] truncate font-medium">{habit.description}</span>
                <span className="text-muted-foreground">·</span>
                <MoneyText cents={Math.round(habit.value * 100)} tone="default" className="text-xs font-semibold tabular-nums" />
                <Badge variant="muted" size="xs">{habit.categoryName}</Badge>
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="quick-value-input" className="text-xs font-semibold text-foreground">Valor</label>
        <MoneyInput
          id="quick-value-input"
          cents={state.valueCents}
          onCentsChange={onValueChange}
          aria-label="Valor do lançamento"
          onKeyDown={(event) => {
            if (event.key === "Enter" && state.valueCents > 0) { event.preventDefault(); onSubmit?.(); }
          }}
        />
      </div>

      <QuickDescriptionField
        value={state.description}
        isExpense={isExpense}
        categories={categories}
        onDescriptionChange={onDescriptionChange}
        onCategoryChange={onCategoryChange}
      />

      <QuickCategoryGrid
        categories={categories}
        categoriesLoading={categoriesLoading}
        predictionEntries={predictionEntries}
        selectedCategoryId={state.categoryId}
        isCategoryUnconfirmed={isCategoryUnconfirmed}
        isFamilyModeEnabled={isFamilyModeEnabled}
        onSelectCategory={onCategoryChange}
      />

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">{isExpense ? "Forma de Pagamento" : "Forma de Recebimento"}</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {(isExpense ? EXPENSE_PAYMENT_METHODS : INCOME_RECEIVE_TYPES).map((item) => {
            const isSelected = isExpense ? state.paymentMethod === item.value : state.receiveType === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  if (isExpense) onPaymentMethodChange(item.value as PaymentMethod);
                  else onReceiveTypeChange(item.value as ReceiveType);
                }}
                aria-pressed={isSelected}
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                  isSelected ? "border-primary bg-primary/10 text-primary-strong font-semibold" : "border-border/80 bg-surface text-foreground hover:bg-surface-hover",
                )}
              >
                {isSelected ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {isExpense && (state.paymentMethod === "credit_card" || (state.installments ?? 1) > 1) ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            {state.paymentMethod === "credit_card" ? (
              <div className="flex flex-col gap-1">
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <CreditCard className="size-3.5 text-muted-foreground" aria-hidden="true" />Cartão de Crédito
                </span>
                <Select
                  ariaLabel="Selecione o cartão de crédito"
                  value={state.cardId ?? ""}
                  onValueChange={onCardChange}
                  disabled={cardsLoading}
                  options={(cards ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  placeholder={cardsLoading ? "Carregando cartões..." : "Selecione o cartão"}
                />
              </div>
            ) : null}
            {onInstallmentsChange ? (
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-medium text-muted-foreground">Parcelas</span>
                <Select
                  ariaLabel="Número de parcelas"
                  value={String(state.installments || 1)}
                  onValueChange={(val) => onInstallmentsChange(Number(val) || 1)}
                  options={installmentOptions}
                  placeholder="Selecione as parcelas"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {showContextSelector ? (
        <LaunchContextSelector
          state={state}
          title="Contexto"
          isFamilyModeEnabled={isFamilyModeEnabled}
          activeTrips={activeTrips}
          activeTripMemberName={activeTripMemberName}
          onFamilyChange={onFamilyChange}
          onTripChange={onTripChange}
          onSplitToggle={onSplitToggle}
          onSplitPeopleCountChange={onSplitPeopleCountChange}
          onSplitDebtModeChange={onSplitDebtModeChange}
        />
      ) : null}

      <div className="flex items-center justify-between border-t border-border/80 pt-2">
        <Button type="button" variant="ghost" size="sm" sensoryIntent="selection" onClick={onSwitchToGuided} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
          <span>Mais opções (parcelas, fixo, data retroativa)</span>
        </Button>
      </div>
    </div>
  );
}
