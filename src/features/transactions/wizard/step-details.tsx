import { HandCoins, Plane, Sparkles, User, Users } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge, Chip, NumberStepper, RadioGroup, Select } from "@/components/ui";
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
  onInstallmentsChange?: (count: number) => void;
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
  /** Viagens ativas para vinculação */
  activeTrips?: { id: string; title: string; destination?: string | null }[];
  onTripChange?: (tripId: string | null) => void;
  /** Nome do membro pagador identificado na viagem para a conta autenticada */
  activeTripMemberName?: string;
  onSplitDebtModeChange?: (mode: "single_total" | "per_installment") => void;
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

type ContextMode = "personal" | "family" | "trip" | "split";

/** Passo 3 — detalhes do lançamento com arquitetura de 3 seções semânticas. */
export function StepDetails({
  state,
  onDateChange,
  onPaymentMethodChange,
  onCardChange,
  onInstallmentsChange,
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
  activeTrips,
  onTripChange,
  activeTripMemberName,
  onSplitDebtModeChange,
  onNext,
}: StepDetailsProps) {
  const isExpense = state.type === "expense";

  // Determina o contexto ativo
  const activeContext: ContextMode = state.splitEnabled
    ? "split"
    : state.tripId
      ? "trip"
      : state.isFamily
        ? "family"
        : "personal";

  const handleSelectContext = (context: ContextMode) => {
    triggerSensory("selection");

    if (context === "personal") {
      onFamilyChange(false);
      onTripChange?.(null);
      onSplitToggle?.(false);
    } else if (context === "family") {
      onFamilyChange(true);
      onTripChange?.(null);
      onSplitToggle?.(false);
    } else if (context === "trip") {
      onFamilyChange(false);
      onSplitToggle?.(false);
      if (!state.tripId && activeTrips && activeTrips.length > 0) {
        onTripChange?.(activeTrips[0]?.id ?? null);
      }
    } else if (context === "split") {
      onFamilyChange(false);
      onTripChange?.(null);
      onSplitToggle?.(true);
    }
  };

  // Condição de pagamento unificada
  const paymentCondition: "single" | "installments" | "recurring" = state.recurring
    ? "recurring"
    : state.installments > 1
      ? "installments"
      : "single";

  const handlePaymentConditionChange = (condition: "single" | "installments" | "recurring") => {
    triggerSensory("selection");
    if (condition === "single") {
      onRecurringToggle(false);
      onInstallmentsChange?.(1);
    } else if (condition === "installments") {
      onRecurringToggle(false);
      onInstallmentsChange?.(state.installments > 1 ? state.installments : 2);
    } else if (condition === "recurring") {
      onRecurringToggle(true);
      onInstallmentsChange?.(1);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* SEÇÃO 1: DADOS DO LANÇAMENTO (Grid 2 colunas) */}
      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Data</span>
            <DatePicker value={state.date} onValueChange={onDateChange} />
          </div>

          {isExpense ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Forma de pagamento</span>
              <Select
                value={state.paymentMethod}
                onValueChange={(value) => onPaymentMethodChange(value as PaymentMethod)}
                options={PAYMENT_METHOD_OPTIONS}
                ariaLabel="Forma de pagamento"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">Como recebeu</span>
              <Select
                value={state.receiveType}
                onValueChange={(value) => onReceiveTypeChange(value as ReceiveType)}
                options={RECEIVE_TYPE_OPTIONS}
                ariaLabel="Tipo de recebimento"
              />
            </div>
          )}
        </div>

        {/* Cartão de Crédito se selecionado */}
        {isExpense && state.paymentMethod === "credit_card" ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-foreground">Cartão</span>
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

        {/* Descrição */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Descrição (opcional)</span>
          <Input
            value={state.description}
            onChange={(event) => onDescriptionChange(event.target.value)}
            placeholder={isExpense ? "Ex.: Supermercado do mês, Uber, Farmácia..." : "Ex.: Salário, Rendimentos, Pix..."}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onNext?.();
              }
            }}
          />
          {state.description.trim().length >= 2 && descriptionSuggestions.length > 0 ? (
            <div className="flex flex-col gap-1.5 pt-0.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                <Sparkles className="size-3 text-muted-foreground" aria-hidden="true" />
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
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/80 bg-surface-raised px-3 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
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
      </div>

      {/* SEÇÃO 2: CONDIÇÃO DE PAGAMENTO (À vista / Parcelado / Recorrente) */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Condição de Pagamento</span>
          {paymentCondition === "installments" && state.installments > 1 && state.valueCents > 0 ? (
            <span className="text-xs font-medium text-foreground">
              {state.installments}× de <MoneyText cents={Math.ceil(state.valueCents / state.installments)} tone="default" />
            </span>
          ) : null}
        </div>

        {/* Segmented Control Unificado */}
        <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-surface-raised p-1 border border-border/80">
          <button
            type="button"
            onClick={() => handlePaymentConditionChange("single")}
            className={cn(
              "rounded-md py-1.5 px-2 text-xs font-medium transition-colors cursor-pointer text-center",
              paymentCondition === "single"
                ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
            )}
          >
            À vista
          </button>
          <button
            type="button"
            onClick={() => handlePaymentConditionChange("installments")}
            className={cn(
              "rounded-md py-1.5 px-2 text-xs font-medium transition-colors cursor-pointer text-center",
              paymentCondition === "installments"
                ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
            )}
          >
            Parcelado
          </button>
          <button
            type="button"
            onClick={() => handlePaymentConditionChange("recurring")}
            className={cn(
              "rounded-md py-1.5 px-2 text-xs font-medium transition-colors cursor-pointer text-center",
              paymentCondition === "recurring"
                ? "bg-surface text-foreground font-semibold shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground hover:bg-surface/50",
            )}
          >
            Recorrente
          </button>
        </div>

        {/* Conteúdo dinâmico da condição */}
        {paymentCondition === "single" ? (
          <p className="text-[11px] text-muted-foreground">
            Lançamento pontual com valor integral liquidado na data informada.
          </p>
        ) : null}

        {paymentCondition === "installments" ? (
          <div className="flex flex-col gap-2 pt-1 border-t border-border/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">Número de Parcelas</span>
              <span className="num text-xs font-semibold text-foreground">{state.installments}×</span>
            </div>
            <NumberStepper
              value={state.installments}
              onValueChange={(val) => onInstallmentsChange?.(val)}
              min={1}
              max={60}
              decreaseLabel="Diminuir parcelas"
              increaseLabel="Aumentar parcelas"
              format={(value) => `${value}×`}
            />
          </div>
        ) : null}

        {paymentCondition === "recurring" ? (
          <div className="flex flex-col gap-3 pt-1 border-t border-border/60">
            <Checkbox
              checked={state.recurring}
              onCheckedChange={onRecurringToggle}
              label="Lançamento recorrente"
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Frequência</span>
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
              <span className="text-xs font-medium text-foreground">Quando termina</span>
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
                <span className="text-xs font-medium text-foreground">Data de fim</span>
                <DatePicker value={state.recurrenceEndDate} onValueChange={onRecurrenceEndDateChange} />
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-foreground">Número de ocorrências</span>
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
            <p className="text-[11px] text-muted-foreground">
              A primeira ocorrência será lançada na data informada acima; as demais seguirão a frequência escolhida.
            </p>
          </div>
        ) : null}
      </div>

      {/* SEÇÃO 3: CONTEXTO DO LANÇAMENTO */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Contexto do Lançamento</span>
          {activeContext === "personal" && (
            <span className="text-[11px] text-muted-foreground">Individual</span>
          )}
        </div>

        {/* Seletor de Contexto */}
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Contexto do lançamento">
          <Chip
            role="radio"
            aria-checked={activeContext === "personal"}
            selected={activeContext === "personal"}
            onClick={() => handleSelectContext("personal")}
            icon={<User className="size-3.5" />}
          >
            <span>Pessoal</span>
          </Chip>

          {isFamilyModeEnabled && (
            <Chip
              role="radio"
              aria-label={isExpense ? "Despesa da Casa / Familiar" : "Receita da Casa / Familiar"}
              aria-checked={activeContext === "family"}
              selected={activeContext === "family"}
              onClick={() => handleSelectContext("family")}
              icon={<Users className="size-3.5" />}
            >
              <span>{isExpense ? "Despesa da Casa" : "Receita da Casa"}</span>
            </Chip>
          )}

          {isExpense && activeTrips && activeTrips.length > 0 && (
            <Chip
              role="radio"
              aria-checked={activeContext === "trip"}
              selected={activeContext === "trip"}
              onClick={() => handleSelectContext("trip")}
              icon={<Plane className="size-3.5" />}
              className={activeContext === "trip" ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold" : undefined}
            >
              <span>Viagem</span>
            </Chip>
          )}

          {isExpense && !state.recurring && (
            <Chip
              role="radio"
              aria-checked={activeContext === "split"}
              selected={activeContext === "split"}
              data-tour="wizard-split-toggle"
              onClick={() => handleSelectContext("split")}
              icon={<HandCoins className="size-3.5" />}
            >
              <span>Rachar c/ Amigos</span>
            </Chip>
          )}
        </div>

        {/* Conteúdo Contextual Conforme Seleção */}
        {activeContext === "family" ? (
          <div className="flex items-center gap-2.5 rounded-lg border border-primary/25 bg-primary/5 p-2.5">
            <Users className="size-4 text-primary shrink-0" aria-hidden="true" />
            <div className="flex flex-col">
              <span className="text-xs font-medium text-foreground">
                {isExpense ? "Despesa da Casa / Familiar" : "Receita da Casa / Familiar"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Lançamento visível no Painel Familiar compartilhado com os membros do lar.
              </span>
            </div>
          </div>
        ) : null}

        {isExpense && activeContext === "trip" && activeTrips && activeTrips.length > 0 ? (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            <span className="text-xs font-medium text-foreground">Viagem Vinculada</span>
            <Select
              value={state.tripId ?? activeTrips[0]?.id ?? ""}
              onValueChange={(val) => onTripChange?.(val || null)}
              options={activeTrips.map((t) => ({
                value: t.id,
                label: t.destination ? `${t.title} (${t.destination})` : t.title,
              }))}
              ariaLabel="Vincular a uma viagem"
            />
            {activeTripMemberName ? (
              <p className="text-[11px] text-muted-foreground">
                Pagador identificado: <strong className="text-foreground font-semibold">{activeTripMemberName}</strong> (Você)
              </p>
            ) : null}
            <p className="text-[11px] text-muted-foreground">
              A despesa será sincronizada com a viagem em grupo e rateada entre os membros cadastrados.
            </p>
          </div>
        ) : null}

        {isExpense && !state.recurring && activeContext === "split" ? (
          <div className="flex flex-col gap-3 pt-2 border-t border-border/60">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-foreground">
                Rachar despesa com amigos
              </span>
              <span className="text-[11px] text-muted-foreground">
                Gera código Pix Copia e Cola e registra cobrança a receber automaticamente.
              </span>
            </div>

            <div className="flex flex-col gap-2.5 pt-1">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Participantes</span>
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
                            "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
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
                    const totalGuestShareFormatted = (
                      (splitMath.guestShareCents * splitMath.guestCount) / 100
                    ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
                    const installmentGuestShareFormatted = state.installments > 1
                      ? (
                          Math.round((splitMath.guestShareCents * splitMath.guestCount) / state.installments) / 100
                        ).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                      : "";

                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border/80 bg-surface-raised p-2.5">
                          <div>
                            <span className="text-[11px] text-muted-foreground block">Sua Parte (Anfitrião)</span>
                            <MoneyText cents={splitMath.hostShareCents} variant="value" className="font-semibold text-xs" />
                          </div>
                          <div>
                            <span className="text-[11px] text-muted-foreground block">
                              Cada Convidado ({splitMath.guestCount})
                            </span>
                            <MoneyText
                              cents={splitMath.guestShareCents}
                              tone="portfolio"
                              variant="value"
                              className="font-semibold text-xs"
                            />
                          </div>
                        </div>

                        {state.installments > 1 ? (
                          <div className="flex flex-col gap-1.5 pt-2 border-t border-border/60">
                            <span className="text-xs font-semibold text-foreground">Como receber dos amigos?</span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => onSplitDebtModeChange?.("single_total")}
                                className={cn(
                                  "rounded-lg border p-2 text-left transition-colors cursor-pointer",
                                  state.splitDebtMode === "single_total"
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                                )}
                              >
                                <span className="text-xs font-semibold block">À vista (Total Único)</span>
                                <span className="text-[11px] text-muted-foreground block">
                                  Cobrança única de {totalGuestShareFormatted}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onSplitDebtModeChange?.("per_installment")}
                                className={cn(
                                  "rounded-lg border p-2 text-left transition-colors cursor-pointer",
                                  state.splitDebtMode === "per_installment"
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/80 bg-surface-raised hover:bg-surface-hover text-foreground",
                                )}
                              >
                                <span className="text-xs font-semibold block">Mês a mês (Parcelado)</span>
                                <span className="text-[11px] text-muted-foreground block">
                                  {state.installments}x de {installmentGuestShareFormatted} nas faturas
                                </span>
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    );
                  })()
                ) : null}
              </div>
            </div>
        ) : null}

        {/* Rateio e Cota no Relatório (Disponível quando não for racha automático) */}
        {!state.splitEnabled ? (
          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            <span className="text-xs font-medium text-foreground">Sua Participação / Rateio</span>
            <Select
              disabled={state.splitEnabled}
              value={state.splitEnabled ? "1" : (isPresetWeight(state.reportWeight) ? String(state.reportWeight) : "custom")}
              onValueChange={(value) =>
                onReportWeightChange(value === "custom" ? CUSTOM_WEIGHT_VALUE : Number(value))
              }
              options={REPORT_WEIGHT_OPTIONS}
              ariaLabel="Sua Participação / Rateio"
            />
            {effectiveReportWeight(state) < 1 ? (
              <div className="rounded-md border border-border/80 bg-surface-raised px-2.5 py-1.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Aviso de Rateio:</span> O valor cobrado permanece 100% ({formatCentsAsBRL(state.valueCents)}). Nos relatórios entrará apenas a sua cota.
              </div>
            ) : null}
            {!isPresetWeight(state.reportWeight) ? (
              <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-surface-raised p-2.5">
                <span className="text-xs font-medium text-foreground">Sua cota considerada no relatório</span>
                <MoneyInput
                  cents={state.reportCustomAmountCents}
                  onCentsChange={onReportCustomAmountChange}
                  aria-label="Sua cota considerada no relatório"
                />
                {state.valueCents > 0 ? (
                  <span className="text-[11px] text-muted-foreground">
                    Equivale a {Math.round(effectiveReportWeight(state) * 100)}% do valor total ({formatCentsAsBRL(state.valueCents)}).
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Cobrança Vinculada (Disponível quando não for racha automático e não for recorrente) */}
        {isExpense && !state.recurring && !state.splitEnabled ? (
          <div className="flex flex-col gap-2.5 pt-2 border-t border-border/60">
            <Checkbox
              checked={state.debtEnabled}
              onCheckedChange={onDebtToggle}
              label="Criar cobrança vinculada"
            />
            {state.debtEnabled ? (
              <div className="flex flex-col gap-2.5 pl-6 pt-1">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Tipo de cobrança</span>
                  <RadioGroup
                    value={state.debtType}
                    onValueChange={(val) => onDebtTypeChange(val as DebtType)}
                    name="debt-type"
                    options={DEBT_TYPE_OPTIONS}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-foreground">Valor da cobrança</span>
                    <MoneyInput
                      cents={state.debtAmountCents}
                      onCentsChange={onDebtAmountChange}
                      aria-label="Valor da cobrança vinculada"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-foreground">Vencimento</span>
                    <DatePicker value={state.debtDueDate} onValueChange={onDebtDueDateChange} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

