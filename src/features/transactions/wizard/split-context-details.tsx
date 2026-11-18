import { MoneyText, NumberStepper } from "@/components/ui";
import { calculateSplitSummary } from "@/domain/finance/split-math";
import { triggerSensory } from "@/services/sensory";
import { cn } from "@/lib/utils";

export interface SplitContextDetailsProps {
  valueCents: number;
  installments: number;
  splitPeopleCount: number;
  splitDebtMode: "single_total" | "per_installment";
  allowCustomPeopleStepper?: boolean;
  onSplitPeopleCountChange?: (count: number) => void;
  onSplitDebtModeChange?: (mode: "single_total" | "per_installment") => void;
}

export function SplitContextDetails({
  valueCents,
  installments,
  splitPeopleCount,
  splitDebtMode,
  allowCustomPeopleStepper = false,
  onSplitPeopleCountChange,
  onSplitDebtModeChange,
}: SplitContextDetailsProps) {
  const splitMath =
    valueCents > 0
      ? calculateSplitSummary(valueCents, splitPeopleCount, { remainderPolicy: "host" })
      : null;

  return (
    <div className="flex flex-col gap-3 border-t border-border/80 pt-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">Participantes</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {[2, 3, 4, 5].map((count) => {
            const isSelected = splitPeopleCount === count;
            return (
              <button
                key={count}
                type="button"
                onClick={() => {
                  triggerSensory("selection");
                  onSplitPeopleCountChange?.(count);
                }}
                className={cn(
                  "cursor-pointer rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10 text-primary-strong font-semibold"
                    : "border-border/80 bg-surface-raised text-foreground hover:bg-surface-hover",
                )}
              >
                {count}p
              </button>
            );
          })}
        </div>
      </div>

      {allowCustomPeopleStepper ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground">Outra quantidade</span>
          <NumberStepper
            editable
            value={splitPeopleCount}
            onValueChange={(val) => onSplitPeopleCountChange?.(val)}
            min={2}
            max={50}
            ariaLabel="Outra quantidade de pessoas"
            decreaseLabel="Diminuir participantes"
            increaseLabel="Aumentar participantes"
            className="w-40"
          />
        </div>
      ) : null}

      {splitMath ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg bg-surface-raised p-2.5">
            <div>
              <span className="block text-[11px] text-muted-foreground">Sua parte (Anfitrião)</span>
              <MoneyText cents={splitMath.hostShareCents} tone="default" variant="value" className="text-xs font-semibold" />
            </div>
            <div>
              <span className="block text-[11px] text-muted-foreground">
                Convidados ({splitMath.guestCount})
              </span>
              <span className="text-xs font-medium text-portfolio">
                {splitMath.guestCount}x de{" "}
                <MoneyText cents={splitMath.guestShareCents} tone="portfolio" variant="value" className="text-xs font-semibold" />
              </span>
            </div>
          </div>

          {installments > 1 ? (
            <div className="flex flex-col gap-1.5 border-t border-border/80 pt-2">
              <span className="block text-[11px] font-semibold text-foreground">Recebimento do rateio:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onSplitDebtModeChange?.("single_total");
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-2 text-left text-xs transition-colors",
                    splitDebtMode === "single_total"
                      ? "border-primary bg-primary/10 text-primary-strong font-semibold"
                      : "border-border/80 bg-surface-raised text-foreground hover:bg-surface-hover",
                  )}
                >
                  À vista (1x total)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerSensory("selection");
                    onSplitDebtModeChange?.("per_installment");
                  }}
                  className={cn(
                    "cursor-pointer rounded-lg border p-2 text-left text-xs transition-colors",
                    splitDebtMode === "per_installment"
                      ? "border-primary bg-primary/10 text-primary-strong font-semibold"
                      : "border-border/80 bg-surface-raised text-foreground hover:bg-surface-hover",
                  )}
                >
                  Mês a mês ({installments}x)
                </button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
