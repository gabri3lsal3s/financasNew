import { HandCoins, Plane, User, Users } from "lucide-react";
import { Chip, Select } from "@/components/ui";
import { SplitContextDetails } from "./split-context-details";
import type { LaunchState, WizardContextMode } from "./wizard-types";

export interface LaunchContextSelectorProps {
  state: LaunchState;
  isFamilyModeEnabled?: boolean;
  activeTrips?: { id: string; title: string; destination?: string | null }[];
  activeTripMemberName?: string;
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
  activeTrips,
  activeTripMemberName,
  onFamilyChange,
  onTripChange,
  onSplitToggle,
  onSplitPeopleCountChange,
  onSplitDebtModeChange,
  allowCustomPeopleStepper = false,
  title = "Contexto do Lançamento",
}: LaunchContextSelectorProps) {
  const isExpense = state.type === "expense";
  const hasTrips = Boolean(isExpense && activeTrips && activeTrips.length > 0);
  const canSplit = Boolean(isExpense && !state.recurring && onSplitToggle);

  const activeContext: WizardContextMode = state.splitEnabled
    ? "split"
    : state.tripId
      ? "trip"
      : state.isFamily
        ? "family"
        : "personal";

  const handleSelectContext = (context: WizardContextMode) => {
    if (context === "personal") {
      onFamilyChange?.(false);
      onTripChange?.(null);
      onSplitToggle?.(false);
    } else if (context === "family") {
      onFamilyChange?.(true);
      onTripChange?.(null);
      onSplitToggle?.(false);
    } else if (context === "trip") {
      onFamilyChange?.(false);
      onSplitToggle?.(false);
      if (!state.tripId && activeTrips && activeTrips.length > 0) {
        onTripChange?.(activeTrips[0]?.id ?? null);
      }
    } else if (context === "split") {
      onFamilyChange?.(false);
      onTripChange?.(null);
      onSplitToggle?.(true);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-surface p-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        {activeContext === "personal" ? (
          <span className="text-[11px] text-muted-foreground">Individual</span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Contexto do lançamento">
        <Chip
          role="radio"
          aria-checked={activeContext === "personal"}
          selected={activeContext === "personal"}
          sensoryIntent="selection"
          onClick={() => handleSelectContext("personal")}
          icon={<User className="size-3.5" />}
        >
          <span>Pessoal</span>
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
