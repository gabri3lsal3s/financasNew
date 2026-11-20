import { CheckCircle2, Info, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { Badge, MoneyText, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { resolveAllocationStatus, type StrategyClassAllocationResult } from "@/domain/portfolio";
import { numberToCents } from "@/domain/money";
import { formatCentsAsBRL, formatPercent } from "@/services/masks";
import { cn } from "@/lib/utils";

export interface SimulatorAllocationResultsProps {
  aporteAmount: number;
  allocations: readonly StrategyClassAllocationResult[];
  selectedClass: string | null;
  onSelectClass: (key: string | null) => void;
  annualYieldPct: number;
  monthlyPassive: number;
  animatedMonthlyPassive: number;
}

export function SimulatorAllocationResults({
  aporteAmount,
  allocations,
  selectedClass,
  onSelectClass,
  annualYieldPct,
  monthlyPassive,
  animatedMonthlyPassive,
}: SimulatorAllocationResultsProps) {
  const dimWhenUnselected = (key: string) =>
    selectedClass !== null && selectedClass !== key ? "opacity-50" : "";

  const formattedAporte = formatCentsAsBRL(numberToCents(aporteAmount), { hideCents: true });

  return (
    <div className="lg:col-span-6 space-y-4 sm:space-y-5 min-w-0">
      <h3 className="flex items-center gap-2 text-base sm:text-xl font-bold text-foreground">
        <Sparkles className="size-4 text-primary shrink-0" aria-hidden="true" />
        <span className="tabular-nums">Seu próximo aporte de {formattedAporte}</span>
      </h3>

      <div className="space-y-2 sm:space-y-2.5">
        {allocations.map((cls) => {
          if (cls.isReceivingAporte) {
            const shareOfAporte =
              aporteAmount > 0 ? Math.round((cls.allocatedAmount / aporteAmount) * 100) : 0;
            return (
              <button
                key={cls.key}
                type="button"
                onClick={() => onSelectClass(selectedClass === cls.key ? null : cls.key)}
                aria-pressed={selectedClass === cls.key}
                className={cn(
                  "min-h-11 w-full text-left p-3 sm:p-3.5 rounded-xl border border-positive/40 bg-positive/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2 transition-colors cursor-pointer hover:border-positive/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  dimWhenUnselected(cls.key),
                )}
              >
                <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                  <CheckCircle2
                    className="size-4 text-positive-strong dark:text-positive shrink-0"
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-bold text-foreground">{cls.name}</div>
                    <div className="text-[11px] text-positive-strong dark:text-positive font-medium">
                      Hoje {formatPercent(cls.currentPct)}% · meta {formatPercent(cls.targetPercent)}% — abaixo da meta
                    </div>
                  </div>
                </div>
                <Badge
                  variant="positive"
                  size="xs"
                  className="font-mono font-bold shrink-0 self-start sm:self-center"
                >
                  +<MoneyText cents={numberToCents(cls.allocatedAmount)} hideCents tone="positive" className="text-[10px]" />{" "}
                  ({shareOfAporte}%)
                </Badge>
              </button>
            );
          }

          const status = resolveAllocationStatus(cls.finalPct, cls.targetPercent);

          return (
            <button
              key={cls.key}
              type="button"
              onClick={() => onSelectClass(selectedClass === cls.key ? null : cls.key)}
              aria-pressed={selectedClass === cls.key}
              className={cn(
                "min-h-11 w-full text-left p-3 sm:p-3.5 rounded-xl border border-border/80 bg-surface-raised/50 flex items-center justify-between gap-2 cursor-pointer transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                dimWhenUnselected(cls.key),
              )}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <ShieldCheck className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-xs sm:text-sm font-semibold text-foreground">{cls.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {status === "above_target" ? "Acima da meta" : "Na meta"}: {formatPercent(cls.finalPct)}% · meta{" "}
                    {formatPercent(cls.targetPercent)}%
                  </div>
                </div>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">Sem aporte</span>
            </button>
          );
        })}
      </div>

      <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-primary/10 border border-primary/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <TrendingUp
            className="size-4 text-primary-strong dark:text-primary shrink-0"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <span className="text-xs font-bold text-primary-strong dark:text-primary block">
              Renda Passiva Mensal Estimada:
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative inline-flex items-center gap-1 text-[11px] text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors cursor-pointer max-sm:after:absolute max-sm:after:-inset-2 rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <Info className="size-3 shrink-0" aria-hidden="true" />
                  <span>Yield ponderado de {formatPercent(annualYieldPct)}% a.a.</span>
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[min(21rem,calc(100vw-2rem))]">
                <p className="text-xs font-bold text-foreground">Como calculamos a renda passiva</p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  Rendimento anual de cada classe dividido por 12 meses, somado sobre o patrimônio
                  pós-aporte.
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {allocations.map((cls) => (
                    <li
                      key={cls.key}
                      className="flex items-center justify-between gap-2 text-[11px]"
                    >
                      <span className="text-muted-foreground">
                        {cls.name} · {formatPercent(cls.yieldRate * 100)}% a.a.
                      </span>
                      <MoneyText
                        cents={numberToCents((cls.finalValue * cls.yieldRate) / 12)}
                        hideCents
                        tone="default"
                        className="text-[11px] font-medium"
                      />
                    </li>
                  ))}
                </ul>
                <div className="mt-2.5 pt-2 border-t border-border/70 flex items-center justify-between text-[11px] font-semibold text-foreground">
                  <span>Total mensal</span>
                  <MoneyText
                    cents={numberToCents(monthlyPassive)}
                    hideCents
                    tone="default"
                    className="text-[11px] font-semibold"
                  />
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <span className="font-mono text-lg sm:text-2xl font-extrabold text-foreground whitespace-nowrap self-end sm:self-center">
          <MoneyText cents={numberToCents(animatedMonthlyPassive)} hideCents tone="default" className="text-lg sm:text-2xl font-extrabold" />{" "}
          <span className="text-xs font-normal text-muted-foreground">/ mês</span>
        </span>
      </div>
    </div>
  );
}
