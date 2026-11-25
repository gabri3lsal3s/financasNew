import { useState } from "react";
import { Briefcase, HandCoins, Plane, Scale, SlidersHorizontal, User, Users } from "lucide-react";
import { Badge, Button, Chip, MoneyInput, NumberStepper, Select, Switch } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { splitMixedExpenseByPercent } from "@/domain/business";
import { formatCentsAsBRL } from "@/services/masks";
import type { TransactionScope } from "@/types";
import { SplitContextDetails } from "./split-context-details";
import type { LaunchState, WizardContextMode } from "./wizard-types";

export interface LaunchContextSelectorProps {
  state: LaunchState;
  isFamilyModeEnabled?: boolean;
  isBusinessModeEnabled?: boolean;
  activeTrips?: { id: string; title: string; destination?: string | null }[];
  activeTripMemberName?: string;
  onScopeChange?: (scope: TransactionScope) => void;
  onTaxDeductibleChange?: (deductible: boolean) => void;
  onTaxWithheldChange?: (cents: number) => void;
  onSplitPFPJToggle?: (enabled: boolean) => void;
  onSplitPFPJBusinessPercentChange?: (percent: number) => void;
  onFamilyChange?: (isFamily: boolean) => void;
  onTripChange?: (tripId: string | null) => void;
  onSplitToggle?: (enabled: boolean) => void;
  onSplitPeopleCountChange?: (count: number) => void;
  onSplitDebtModeChange?: (mode: "single_total" | "per_installment") => void;
  allowCustomPeopleStepper?: boolean;
  title?: string;
}

export function LaunchContextSelector({
  state,
  isFamilyModeEnabled = false,
  isBusinessModeEnabled = false,
  activeTrips,
  activeTripMemberName,
  onScopeChange,
  onTaxDeductibleChange,
  onTaxWithheldChange,
  onSplitPFPJToggle,
  onSplitPFPJBusinessPercentChange,
  onFamilyChange,
  onTripChange,
  onSplitToggle,
  onSplitPeopleCountChange,
  onSplitDebtModeChange,
  allowCustomPeopleStepper = false,
  title = "Contexto do Lançamento",
}: LaunchContextSelectorProps) {
  const isExpense = state.type === "expense";
  const currentScope: TransactionScope = state.scope ?? "personal";
  const isSplitPFPJSelected = Boolean(isBusinessModeEnabled && isExpense && state.splitPFPJEnabled);
  const isBusinessSelected = isBusinessModeEnabled && currentScope === "business" && !isSplitPFPJSelected;
  const hasTrips = Boolean(isExpense && activeTrips && activeTrips.length > 0);
  const canSplit = Boolean(isExpense && !state.recurring && onSplitToggle);
  const hasPersonalSubcontexts = isFamilyModeEnabled || hasTrips || canSplit;

  const activeContext: WizardContextMode = isBusinessSelected
    ? "business"
    : state.splitEnabled
      ? "split"
      : state.tripId
        ? "trip"
        : state.isFamily
          ? "family"
          : "personal";

  const handleSelectContext = (context: WizardContextMode) => {
    if (context === "business") {
      onScopeChange?.("business");
      onFamilyChange?.(false);
      onTripChange?.(null);
      onSplitToggle?.(false);
      onSplitPFPJToggle?.(false);
    } else if (context === "personal") {
      onScopeChange?.("personal");
      onFamilyChange?.(false);
      onTripChange?.(null);
      onSplitToggle?.(false);
      onSplitPFPJToggle?.(false);
    } else if (context === "family") {
      onScopeChange?.("personal");
      onFamilyChange?.(true);
      onTripChange?.(null);
      onSplitToggle?.(false);
      onSplitPFPJToggle?.(false);
    } else if (context === "trip") {
      onScopeChange?.("personal");
      onFamilyChange?.(false);
      onSplitToggle?.(false);
      onSplitPFPJToggle?.(false);
      if (!state.tripId && activeTrips && activeTrips.length > 0) {
        onTripChange?.(activeTrips[0]?.id ?? null);
      }
    } else if (context === "split") {
      onScopeChange?.("personal");
      onFamilyChange?.(false);
      onTripChange?.(null);
      onSplitToggle?.(true);
      onSplitPFPJToggle?.(false);
    }
  };

  const businessPercent = state.splitPFPJBusinessPercent ?? 50;
  const isStandardPreset = [50, 70, 30, 80].includes(businessPercent);
  const [isCustomMode, setIsCustomMode] = useState<boolean>(!isStandardPreset);
  const showCustomControls = isCustomMode || !isStandardPreset;

  const splitPFPJResult = isSplitPFPJSelected
    ? splitMixedExpenseByPercent({
        totalCents: state.valueCents,
        businessPercent,
      })
    : null;

  return (
    <div data-tour="launch-context-selector" className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {isSplitPFPJSelected ? (
          <span className="text-[11px] font-medium text-warning-strong">Uso Misto (Pessoal/Profissional)</span>
        ) : activeContext === "personal" ? (
          <span className="text-[11px] text-muted-foreground">Individual</span>
        ) : activeContext === "business" ? (
          <span className="text-[11px] font-medium text-portfolio">Esfera Profissional</span>
        ) : null}
      </div>

      {isBusinessModeEnabled ? (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Esfera do lançamento">
          <Chip
            role="radio"
            aria-checked={!isSplitPFPJSelected && currentScope === "personal"}
            selected={!isSplitPFPJSelected && currentScope === "personal"}
            sensoryIntent="selection"
            onClick={() => handleSelectContext("personal")}
            icon={<User className="size-3.5" />}
          >
            <span>Pessoal</span>
          </Chip>

          <Chip
            role="radio"
            aria-checked={!isSplitPFPJSelected && currentScope === "business"}
            selected={!isSplitPFPJSelected && currentScope === "business"}
            sensoryIntent="selection"
            onClick={() => handleSelectContext("business")}
            icon={<Briefcase className="size-3.5" />}
            className={!isSplitPFPJSelected && currentScope === "business" ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold" : undefined}
          >
            <span>Profissional</span>
          </Chip>

          {isExpense ? (
            <Chip
              role="radio"
              aria-checked={isSplitPFPJSelected}
              selected={isSplitPFPJSelected}
              sensoryIntent="selection"
              onClick={() => {
                onSplitPFPJToggle?.(true);
                onScopeChange?.("personal");
                onFamilyChange?.(false);
                onTripChange?.(null);
                onSplitToggle?.(false);
              }}
              icon={<Scale className="size-3.5" />}
              className={isSplitPFPJSelected ? "border-warning/50 bg-warning/15 text-warning-strong font-semibold" : undefined}
            >
              <span>Dividir Pessoal / Profissional</span>
            </Chip>
          ) : null}
        </div>
      ) : null}

      {isSplitPFPJSelected && splitPFPJResult ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface-raised p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">Divisão de Uso Misto (Pessoal / Profissional)</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Gera dois lançamentos com peso 100% nominal em cada esfera contábil, sem distorcer o DRE profissional nem o orçamento pessoal.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-foreground">Distribuição da despesa</span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {100 - businessPercent}% Pessoal / {businessPercent}% Profissional
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Distribuição da despesa">
              {[
                { label: "50% / 50%", val: 50 },
                { label: "70% Prof. / 30% Pess.", val: 70 },
                { label: "30% Prof. / 70% Pess.", val: 30 },
                { label: "80% Prof. / 20% Pess.", val: 80 },
              ].map((preset) => {
                const isSelected = !showCustomControls && businessPercent === preset.val;
                return (
                  <Chip
                    key={preset.val}
                    role="radio"
                    aria-checked={isSelected}
                    selected={isSelected}
                    sensoryIntent="selection"
                    onClick={() => {
                      setIsCustomMode(false);
                      onSplitPFPJBusinessPercentChange?.(preset.val);
                    }}
                    className="text-[11px] h-7 px-2.5"
                  >
                    {preset.label}
                  </Chip>
                );
              })}

              <Chip
                role="radio"
                aria-checked={showCustomControls}
                selected={showCustomControls}
                sensoryIntent="selection"
                onClick={() => setIsCustomMode(true)}
                icon={<SlidersHorizontal className="size-3" aria-hidden="true" />}
                className={showCustomControls ? "border-portfolio/50 bg-portfolio/10 text-portfolio font-semibold text-[11px] h-7 px-2.5" : "text-[11px] h-7 px-2.5"}
              >
                Personalizado
              </Chip>
            </div>

            {showCustomControls ? (
              <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface p-3 transition-all shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal className="size-3.5 text-portfolio" aria-hidden="true" />
                    <span className="text-xs font-semibold text-foreground">
                      Proporção Personalizada
                    </span>
                  </div>
                  <Badge size="xs" variant="portfolio" className="font-mono">
                    {businessPercent}% Prof. · {100 - businessPercent}% Pess.
                  </Badge>
                </div>

                {/* Barra visual proporcional */}
                <div className="flex flex-col gap-1">
                  <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-subtle border border-border/60">
                    <div
                      className="bg-muted-foreground/35 transition-all duration-200"
                      style={{ width: `${100 - businessPercent}%` }}
                      title={`Pessoal: ${100 - businessPercent}%`}
                    />
                    <div
                      className="bg-portfolio transition-all duration-200"
                      style={{ width: `${businessPercent}%` }}
                      title={`Profissional: ${businessPercent}%`}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                    <span>Pessoal: {100 - businessPercent}%</span>
                    <span className="text-portfolio font-medium">Profissional: {businessPercent}%</span>
                  </div>
                </div>

                {/* Ajuste fino por Stepper e atalhos delta */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-0.5">
                  <div className="flex items-center justify-between sm:justify-start gap-2.5">
                    <span className="text-xs font-medium text-foreground shrink-0">Fatia profissional:</span>
                    <NumberStepper
                      editable
                      value={businessPercent}
                      min={1}
                      max={99}
                      step={5}
                      onValueChange={(val) => {
                        const clamped = Math.max(1, Math.min(99, Math.round(val)));
                        onSplitPFPJBusinessPercentChange?.(clamped);
                      }}
                      ariaLabel="Fatia percentual profissional"
                      decreaseLabel="Diminuir parcela profissional em 5%"
                      increaseLabel="Aumentar parcela profissional em 5%"
                      className="w-36 sm:w-40"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    {[-10, -5, +5, +10].map((delta) => (
                      <Button
                        key={delta}
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() => {
                          const next = Math.max(1, Math.min(99, businessPercent + delta));
                          onSplitPFPJBusinessPercentChange?.(next);
                        }}
                        className="h-7 px-2 font-mono shrink-0"
                      >
                        {delta > 0 ? `+${delta}%` : `${delta}%`}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Ajuste opcional por valor em reais se total > 0 */}
                {state.valueCents > 0 ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                    <div className="flex flex-col">
                      <span className="text-[11px] font-medium text-foreground">Definir cota em reais (Profissional)</span>
                      <span className="text-[10px] text-muted-foreground">
                        Calcula a porcentagem automaticamente com base no total ({formatCentsAsBRL(state.valueCents)})
                      </span>
                    </div>
                    <div className="w-full sm:w-36">
                      <MoneyInput
                        id="wizard-split-custom-business-cents"
                        cents={splitPFPJResult.businessCents}
                        onCentsChange={(cents) => {
                          if (state.valueCents <= 0) return;
                          const clamped = Math.max(0, Math.min(state.valueCents, cents));
                          const computedPct = Math.max(1, Math.min(99, Math.round((clamped / state.valueCents) * 100)));
                          onSplitPFPJBusinessPercentChange?.(computedPct);
                        }}
                        size="sm"
                        className="h-8 text-xs font-mono"
                        placeholder="R$ 0,00"
                        aria-label="Cota profissional em reais"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">Parcela Pessoal</span>
              <div className="flex items-baseline justify-between gap-1">
                <MoneyText cents={splitPFPJResult.personalCents} tone="default" className="text-sm font-semibold" />
                <span className="text-[11px] text-muted-foreground">{100 - businessPercent}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Livro Pessoal · Peso 100%</span>
            </div>

            <div className="flex flex-col gap-1 rounded-md border border-portfolio/30 bg-portfolio/5 p-2.5">
              <span className="text-[11px] font-medium text-portfolio">Parcela Profissional</span>
              <div className="flex items-baseline justify-between gap-1">
                <MoneyText cents={splitPFPJResult.businessCents} tone="default" className="text-sm font-semibold" />
                <span className="text-[11px] text-portfolio font-medium">{businessPercent}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Livro Profissional · Peso 100%</span>
            </div>
          </div>

          <div className="border-t border-border/80 pt-2">
            <Switch
              id="wizard-split-tax-deductible"
              checked={Boolean(state.isTaxDeductible)}
              onCheckedChange={(checked) => onTaxDeductibleChange?.(checked)}
              label="Parcela do negócio é dedutível"
              description="Apenas a fatia PJ entra no cálculo de escudo fiscal e Livro-Caixa."
            />
          </div>
        </div>
      ) : isBusinessSelected ? (
        isExpense ? (
          <div className="rounded-lg border border-border/80 bg-surface-raised p-2.5">
            <Switch
              id="wizard-tax-deductible"
              checked={Boolean(state.isTaxDeductible)}
              onCheckedChange={(checked) => onTaxDeductibleChange?.(checked)}
              label="Despesa dedutível para impostos"
              description="Considerada no Livro-Caixa e no cálculo de escudo fiscal do negócio."
            />
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-lg bg-surface-raised p-2.5 border border-border/80">
            <div className="flex items-center gap-2.5">
              <Briefcase className="size-4 shrink-0 text-portfolio" aria-hidden="true" />
              <div className="flex flex-col">
                <span className="text-xs font-medium text-foreground">Receita do Meu Negócio</span>
                <span className="text-[11px] text-muted-foreground">
                  Entra no faturamento bruto, limite anual MEI e DRE operacional do negócio.
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 border-t border-border/80 pt-2">
              <label htmlFor="tax-withheld-input" className="text-xs font-semibold text-foreground">
                Retenção na Fonte (IRRF / ISS) <span className="text-[11px] font-normal text-muted-foreground">(opcional)</span>
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Informe impostos retidos na nota pelo tomador (Autônomo/PJ). Abate do dinheiro líquido recebido no caixa sem reduzir seu faturamento fiscal no DRE.
              </p>
              <div className="max-w-[200px]">
                <MoneyInput
                  id="tax-withheld-input"
                  aria-label="Retenção na Fonte"
                  cents={state.taxWithheldCents ?? 0}
                  onCentsChange={(cents) => onTaxWithheldChange?.(cents)}
                  size="sm"
                />
              </div>
              {state.taxWithheldCents && state.taxWithheldCents > 0 ? (
                <div className="flex items-center gap-2 pt-0.5 text-[11px]">
                  <span className="text-muted-foreground">Caixa líquido a receber:</span>
                  <strong className="font-semibold text-positive-strong">
                    {formatCentsAsBRL(Math.max(0, state.valueCents - state.taxWithheldCents))}
                  </strong>
                </div>
              ) : null}
            </div>
          </div>
        )
      ) : !isBusinessModeEnabled || hasPersonalSubcontexts ? (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Contexto do lançamento">
          <Chip
            role="radio"
            aria-checked={activeContext === "personal"}
            selected={activeContext === "personal"}
            sensoryIntent="selection"
            onClick={() => handleSelectContext("personal")}
            icon={<User className="size-3.5" />}
          >
            <span>{isBusinessModeEnabled ? "Individual" : "Pessoal"}</span>
          </Chip>

          {isFamilyModeEnabled ? (
            <Chip
              role="radio"
              aria-label={isExpense ? "Despesa da Casa / Familiar" : "Receita da Casa / Familiar"}
              aria-checked={activeContext === "family"}
              selected={activeContext === "family"}
              sensoryIntent="selection"
              onClick={() => handleSelectContext("family")}
              icon={<Users className="size-3.5" />}
            >
              <span>{isExpense ? "Despesa da Casa" : "Receita da Casa"}</span>
            </Chip>
          ) : null}

          {hasTrips ? (
            <Chip
              role="radio"
              aria-checked={activeContext === "trip"}
              selected={activeContext === "trip"}
              sensoryIntent="selection"
              onClick={() => handleSelectContext("trip")}
              icon={<Plane className="size-3.5" />}
              className={activeContext === "trip" ? "border-portfolio bg-portfolio/10 text-portfolio font-semibold" : undefined}
            >
              <span>Viagem</span>
            </Chip>
          ) : null}

          {canSplit ? (
            <Chip
              role="radio"
              aria-checked={activeContext === "split"}
              selected={activeContext === "split"}
              aria-label="Rachar com amigos"
              data-tour="wizard-split-toggle"
              sensoryIntent="selection"
              onClick={() => handleSelectContext("split")}
              icon={<HandCoins className="size-3.5" />}
            >
              <span>Rachar c/ Amigos</span>
            </Chip>
          ) : null}
        </div>
      ) : null}

      {activeContext === "family" ? (
        <div className="flex items-center gap-2.5 rounded-lg bg-surface-raised p-2.5">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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

      {hasTrips && activeContext === "trip" && activeTrips ? (
        <div className="flex flex-col gap-2 border-t border-border/80 pt-2.5">
          <span className="text-xs font-medium text-foreground">Viagem Vinculada</span>
          <Select
            value={state.tripId ?? activeTrips[0]?.id ?? ""}
            onValueChange={(val) => onTripChange?.(val || null)}
            options={activeTrips.map((t) => ({
              value: t.id,
              label: t.destination ? `${t.title} (${t.destination})` : t.title,
            }))}
            ariaLabel="Vincular à viagem"
          />
          {activeTripMemberName ? (
            <p className="text-[11px] text-muted-foreground">
              Pagador identificado: <strong className="font-semibold text-foreground">{activeTripMemberName}</strong> (Você)
            </p>
          ) : null}
        </div>
      ) : null}

      {canSplit && activeContext === "split" ? (
        <SplitContextDetails
          valueCents={state.valueCents}
          installments={state.installments}
          splitPeopleCount={state.splitPeopleCount}
          splitDebtMode={state.splitDebtMode}
          allowCustomPeopleStepper={allowCustomPeopleStepper}
          onSplitPeopleCountChange={onSplitPeopleCountChange}
          onSplitDebtModeChange={onSplitDebtModeChange}
        />
      ) : null}
    </div>
  );
}
