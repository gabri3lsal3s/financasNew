import { Sparkles, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, NumberStepper, RadioGroup, Select, Switch } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { MoneyText } from "@/components/ui/money-text";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { formatCentsAsBRL } from "@/services/masks";
import { RECURRENCE_FREQUENCY_LABELS } from "@/lib/labels";
import { MAX_RECURRENCE_OCCURRENCES, RECURRENCE_FREQUENCIES } from "@/domain/recurrences";
import { calculateSplitSummary } from "@/domain/finance/split-math";
import { cn } from "@/lib/utils";
import type { RecurrenceFrequency } from "@/domain/recurrences";
import type { DescriptionSuggestion } from "@/domain/predictions";
import type { DebtType, PaymentMethod, ReceiveType } from "@/types";
import { REPORT_WEIGHT_OPTIONS } from "../components/report-weight-constants";
import { CUSTOM_WEIGHT_VALUE, effectiveReportWeight, isPresetWeight } from "./wizard-state";
import type { LaunchState } from "./wizard-state";

export interface StepDetailsProps {
  state: LaunchState;
  onDateChange: (date: string) => void;
  onPaymentMethodChange: (method: PaymentMethod) => void;
  onCardChange: (cardId: string) => void;
  onReceiveTypeChange: (type: ReceiveType) => void;
  onDescriptionChange: (description: string) => void;
  onFamilyChange: (isFamily: boolean) => void;
  isFamilyModeEnabled?: boolean;
  onReportWeightChange: (weight: number) => void;
  onReportCustomAmountChange: (cents: number) => void;
  onSplitToggle?: (enabled: boolean) => void;
  onSplitPeopleCountChange?: (count: number) => void;
  onDebtToggle: (enabled: boolean) => void;
  onDebtTypeChange: (type: DebtType) => void;
  onDebtAmountChange: (cents: number) => void;
  onDebtDueDateChange: (date: string) => void;
  onRecurringToggle: (enabled: boolean) => void;
  onRecurrenceFrequencyChange: (frequency: RecurrenceFrequency) => void;
  onRecurrenceEndModeChange: (mode: "date" | "count") => void;
  onRecurrenceEndDateChange: (date: string) => void;
  onRecurrenceCountChange: (count: number) => void;
  /** Sugestões de descrição do histórico (hotfix) — clique preenche SÓ a descrição. */
  descriptionSuggestions: DescriptionSuggestion[];
  cards: { id: string; name: string }[] | undefined;
  cardsLoading: boolean;
  cardsError: unknown;
  /** Callback para avançar no Enter */
  onNext?: () => void;
}

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "debit", label: "Débito" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "pix", label: "Pix" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

const RECEIVE_TYPE_OPTIONS: { value: ReceiveType; label: string }[] = [
  { value: "cash", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "transfer", label: "Transferência" },
  { value: "other", label: "Outro" },
];

const DEBT_TYPE_OPTIONS: { value: DebtType; label: string }[] = [
  { value: "payable", label: "A pagar (minha dívida pendente)" },
  { value: "receivable", label: "A receber (reembolso / alguém me deve)" },
];

/** Passo 3 — detalhes do lançamento. */
export function StepDetails({
  state,
  onDateChange,
  onPaymentMethodChange,
  onCardChange,
  onReceiveTypeChange,
  onDescriptionChange,
  onFamilyChange,
  isFamilyModeEnabled = false,
  onReportWeightChange,
  onReportCustomAmountChange,
  onSplitToggle,
  onSplitPeopleCountChange,
  onDebtToggle,
  onDebtTypeChange,
  onDebtAmountChange,
  onDebtDueDateChange,
  onRecurringToggle,
  onRecurrenceFrequencyChange,
  onRecurrenceEndModeChange,
  onRecurrenceEndDateChange,
  onRecurrenceCountChange,
  descriptionSuggestions,
  cards,
  cardsLoading,
  cardsError,
  onNext,
}: StepDetailsProps) {
  const isExpense = state.type === "expense";

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Data</span>
          <DatePicker value={state.date} onValueChange={onDateChange} />
        </div>

        {isExpense ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Forma de pagamento</span>
            <Select
              value={state.paymentMethod}
              onValueChange={(value) => onPaymentMethodChange(value as PaymentMethod)}
              options={PAYMENT_METHOD_OPTIONS}
              ariaLabel="Forma de pagamento"
            />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Como recebeu</span>
            <Select
              value={state.receiveType}
              onValueChange={(value) => onReceiveTypeChange(value as ReceiveType)}
              options={RECEIVE_TYPE_OPTIONS}
              ariaLabel="Tipo de recebimento"
            />
          </div>
        )}
      </div>

      {isExpense && state.paymentMethod === "credit_card" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Cartão</span>
          {cardsLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : cardsError ? (
            <Alert variant="error">{getErrorMessage(cardsError)}</Alert>
          ) : (
            <Select
              value={state.cardId ?? ""}
              onValueChange={onCardChange}
              options={(cards ?? []).map((card) => ({ value: card.id, label: card.name }))}
              placeholder="Selecione o cartão"
              ariaLabel="Cartão de crédito"
            />
          )}
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Descrição (opcional)</span>
        <Input
          value={state.description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          placeholder={isExpense ? "Ex.: Supermercado do mês" : "Ex.: Salário"}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onNext?.();
            }
          }}
        />
        {/* Sugestões de descrição pura (hotfix): o clique preenche APENAS o campo
            de descrição — valor, data e forma já preenchidos nas etapas
            anteriores são preservados integralmente (nunca sobrescritos). */}
        {state.description.trim().length >= 2 && descriptionSuggestions.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Sparkles className="size-3" aria-hidden="true" />
              Sugestões de descrição
            </p>
            <div role="listbox" aria-label="Sugestões de descrição" className="flex flex-wrap gap-1.5">
              {descriptionSuggestions.map((suggestion) => (
                <button
                  key={suggestion.description}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => {
                    triggerSensory("action");
                    onDescriptionChange(suggestion.description);
                  }}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
                >
                  <span className="truncate">{suggestion.description}</span>
                  {suggestion.frequency > 1 ? (
                    <Badge variant="muted" size="xs">
                      {suggestion.frequency}×
                    </Badge>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Switch Discreto: Despesa Familiar (Fase 3 — Tarefa 3.2) */}
      {isFamilyModeEnabled && (
        <div className="rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
          <Switch
            id="details-family-switch"
            checked={state.isFamily}
            onCheckedChange={onFamilyChange}
            label={isExpense ? "Despesa da Casa / Familiar" : "Receita da Casa / Familiar"}
            description="Visível no Painel Familiar compartilhado"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">Sua Participação / Rateio</span>
        <Select
          disabled={state.splitEnabled}
          value={state.splitEnabled ? "1" : (isPresetWeight(state.reportWeight) ? String(state.reportWeight) : "custom")}
          onValueChange={(value) =>
            onReportWeightChange(value === "custom" ? CUSTOM_WEIGHT_VALUE : Number(value))
          }
          options={REPORT_WEIGHT_OPTIONS}
          ariaLabel="Sua Participação / Rateio"
        />
        {state.splitEnabled ? (
          <div className="rounded-md border border-portfolio/20 bg-portfolio/5 px-2.5 py-2 text-[11px] text-muted-foreground space-y-0.5">
            <span className="font-semibold text-portfolio block">Racha de despesa ativado:</span>
            <span>A despesa inicia em 100% no seu extrato ({formatCentsAsBRL(state.valueCents)}). O rateio será abatido dinamicamente conforme os amigos forem pagando.</span>
          </div>
        ) : effectiveReportWeight(state) < 1 ? (
          <div className="rounded-md border border-border/80 bg-surface px-2.5 py-2 text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Aviso de Rateio:</span> O valor bancário cobrado permanece 100% ({formatCentsAsBRL(state.valueCents)}). Nos relatórios entrará apenas a sua cota.
          </div>
        ) : null}
        {!state.splitEnabled && !isPresetWeight(state.reportWeight) ? (
          <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-3">
            <span className="text-xs font-medium text-foreground">Sua cota considerada no relatório</span>
            <MoneyInput
              cents={state.reportCustomAmountCents}
              onCentsChange={onReportCustomAmountChange}
              aria-label="Sua cota considerada no relatório"
            />
            {state.valueCents > 0 ? (
              <span className="text-xs text-muted-foreground">
                Equivale a {Math.round(effectiveReportWeight(state) * 100)}% do valor total ({formatCentsAsBRL(state.valueCents)}).
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <Checkbox
          checked={state.recurring}
          onCheckedChange={onRecurringToggle}
          label="Lançamento recorrente"
        />
        {state.recurring ? (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Frequência</span>
              <Select
                value={state.recurrenceFrequency}
                onValueChange={(value) => onRecurrenceFrequencyChange(value as RecurrenceFrequency)}
                options={RECURRENCE_FREQUENCIES.map((frequency) => ({
                  value: frequency,
                  label: RECURRENCE_FREQUENCY_LABELS[frequency],
                }))}
                ariaLabel="Frequência da recorrência"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">Quando termina</span>
              <RadioGroup
                value={state.recurrenceEndMode}
                onValueChange={(val) => onRecurrenceEndModeChange(val as "date" | "count")}
                name="recurrence-end"
                options={[
                  { value: "date", label: "Data de fim" },
                  { value: "count", label: "Número de ocorrências" },
                ]}
              />
            </div>
            {state.recurrenceEndMode === "date" ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Data de fim</span>
                <DatePicker value={state.recurrenceEndDate} onValueChange={onRecurrenceEndDateChange} />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Número de ocorrências</span>
                <NumberStepper
                  value={state.recurrenceCount}
                  onValueChange={onRecurrenceCountChange}
                  min={1}
                  max={MAX_RECURRENCE_OCCURRENCES}
                  decreaseLabel="Diminuir ocorrências"
                  increaseLabel="Aumentar ocorrências"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              A primeira ocorrência será lançada na data informada acima; as demais seguem a frequência escolhida.
            </p>
          </>
        ) : null}
      </div>

      {isExpense && !state.recurring ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" aria-hidden="true" />
              <div>
                <span className="text-sm font-semibold text-foreground block">
                  Rachar despesa com amigos
                </span>
                <span className="text-xs text-muted-foreground block">
                  Gera código Pix Copia e Cola e registra cobrança a receber
                </span>
              </div>
            </div>
            <Switch
              id="split-switch"
              checked={state.splitEnabled}
              onCheckedChange={(checked) => onSplitToggle?.(checked)}
              aria-label="Rachar despesa com amigos"
            />
          </div>

          {state.splitEnabled ? (
            <div className="flex flex-col gap-3 pt-2 border-t border-border/60">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">Número de participantes</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[2, 3, 4, 5].map((count) => {
                    const isSelected = state.splitPeopleCount === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        onClick={() => {
                          triggerSensory("selection");
                          onSplitPeopleCountChange?.(count);
                        }}
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold"
                            : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                        )}
                      >
                        {count} pessoas
                      </button>
                    );
                  })}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-muted-foreground">Outro:</span>
                    <Input
                      type="number"
                      min={2}
                      max={50}
                      value={state.splitPeopleCount}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val >= 2 && val <= 50) {
                          onSplitPeopleCountChange?.(val);
                        }
                      }}
                      className="w-16 h-8 text-center text-xs"
                      aria-label="Outra quantidade de pessoas"
                    />
                  </div>
                </div>
              </div>

              {state.valueCents > 0 ? (
                (() => {
                  const splitMath = calculateSplitSummary(state.valueCents, state.splitPeopleCount, {
                    remainderPolicy: "host",
                  });
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/80 bg-surface-raised p-3">
                      <div>
                        <span className="text-[11px] text-muted-foreground block">Sua Parte (Anfitrião)</span>
                        <MoneyText cents={splitMath.hostShareCents} variant="value" className="font-semibold text-sm" />
                      </div>
                      <div>
                        <span className="text-[11px] text-muted-foreground block">
                          Cada Convidado ({splitMath.guestCount})
                        </span>
                        <MoneyText
                          cents={splitMath.guestShareCents}
                          tone="portfolio"
                          variant="value"
                          className="font-semibold text-sm"
                        />
                      </div>
                    </div>
                  );
                })()
              ) : null}

              <p className="text-[11px] text-muted-foreground">
                Ao salvar, a despesa será criada e o Pix Copia e Cola / QR Code será gerado automaticamente para você enviar aos seus amigos.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {isExpense && !state.recurring ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <Checkbox
            checked={state.debtEnabled}
            onCheckedChange={onDebtToggle}
            label="Criar cobrança vinculada"
          />
          {state.debtEnabled ? (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Tipo de cobrança</span>
                <RadioGroup
                  value={state.debtType}
                  onValueChange={(val) => onDebtTypeChange(val as DebtType)}
                  name="debt-type"
                  options={DEBT_TYPE_OPTIONS}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Valor da cobrança</span>
                <MoneyInput
                  cents={state.debtAmountCents}
                  onCentsChange={onDebtAmountChange}
                  aria-label="Valor da cobrança vinculada"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">Vencimento</span>
                <DatePicker value={state.debtDueDate} onValueChange={onDebtDueDateChange} />
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
