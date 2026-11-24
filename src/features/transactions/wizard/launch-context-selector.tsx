import { Briefcase, HandCoins, Plane, Scale, User, Users } from "lucide-react";
import { Chip, MoneyInput, Select, Switch } from "@/components/ui";
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
          <span className="text-[11px] font-medium text-warning-strong">Uso Misto (PF/PJ)</span>
        ) : activeContext === "personal" ? (
          <span className="text-[11px] text-muted-foreground">Individual</span>
        ) : activeContext === "business" ? (
          <span className="text-[11px] font-medium text-portfolio">Esfera PJ</span>
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
            <span>Pessoal (PF)</span>
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
            <span>Meu Negócio (PJ)</span>
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
              <span>Dividir PF / PJ</span>
            </Chip>
          ) : null}
        </div>
      ) : null}

      {isSplitPFPJSelected && splitPFPJResult ? (
        <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-surface-raised p-3">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">Divisão de Uso Misto (Split PF/PJ)</span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Gera dois lançamentos com peso 100% nominal em cada esfera contábil, sem distorcer o DRE da empresa nem o orçamento da família.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-foreground">Distribuição da despesa</span>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "50% / 50%", val: 50 },
                { label: "70% PJ / 30% PF", val: 70 },
                { label: "30% PJ / 70% PF", val: 30 },
                { label: "80% PJ / 20% PF", val: 80 },
              ].map((preset) => (
                <Chip
                  key={preset.val}
                  selected={businessPercent === preset.val}
                  onClick={() => onSplitPFPJBusinessPercentChange?.(preset.val)}
                  className="text-[11px] h-7 px-2.5"
                >
                  {preset.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-surface p-2.5">
              <span className="text-[11px] font-medium text-muted-foreground">Parcela Pessoal (PF)</span>
              <div className="flex items-baseline justify-between gap-1">
                <MoneyText cents={splitPFPJResult.personalCents} tone="default" className="text-sm font-semibold" />
                <span className="text-[11px] text-muted-foreground">{100 - businessPercent}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Livro Pessoal · Peso 100%</span>
            </div>

            <div className="flex flex-col gap-1 rounded-md border border-portfolio/30 bg-portfolio/5 p-2.5">
              <span className="text-[11px] font-medium text-portfolio">Parcela Negócio (PJ)</span>
              <div className="flex items-baseline justify-between gap-1">
                <MoneyText cents={splitPFPJResult.businessCents} tone="default" className="text-sm font-semibold" />
                <span className="text-[11px] text-portfolio font-medium">{businessPercent}%</span>
              </div>
              <span className="text-[10px] text-muted-foreground">Livro PJ · Peso 100%</span>
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
