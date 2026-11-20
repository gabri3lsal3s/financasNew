import { Badge, Popover, PopoverContent, PopoverTrigger, Tabs } from "@/components/ui";
import { AllocationDonut, type AllocationSlice } from "@/components/modules/allocation-donut";
import { annualRateToMonthlyRate } from "@/domain/portfolio";
import { formatPercent } from "@/services/masks";
import { FireProjectionCurve } from "../fire-projection-curve";

export interface SimulatorChartPanelProps {
  activeTab: "alocacao" | "fire";
  onTabChange: (tab: "alocacao" | "fire") => void;
  donutSlices: AllocationSlice[];
  totalPatrimonyLabel: string;
  selectedClass: string | null;
  onSelectClass: (key: string | null) => void;
  patrimonyBase: number;
  aporteAmount: number;
  annualYieldPct: number;
  annualRate: number;
  monthlyLivingCost: number;
  horizonYears: number;
}

export function SimulatorChartPanel({
  activeTab,
  onTabChange,
  donutSlices,
  totalPatrimonyLabel,
  selectedClass,
  onSelectClass,
  patrimonyBase,
  aporteAmount,
  annualYieldPct,
  annualRate,
  monthlyLivingCost,
  horizonYears,
}: SimulatorChartPanelProps) {
  return (
    <div className="lg:col-span-6 flex flex-col items-center justify-center p-4 sm:p-6 rounded-xl sm:rounded-2xl bg-surface-raised/50 border border-border/80 min-w-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full mb-3 sm:mb-4 gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          {activeTab === "alocacao" ? "Composição da Carteira" : "Projeção Patrimonial"}
        </span>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <Tabs
            value={activeTab}
            onValueChange={(value) => onTabChange(value as "alocacao" | "fire")}
            variant="pills"
            ariaLabel="Modo de visualização gráfica"
            className="shrink-0"
            items={[
              { value: "alocacao", label: "Aporte" },
              { value: "fire", label: "Curva Patrimonial", shortLabel: "Curva" },
            ]}
          />
          {activeTab === "alocacao" ? (
            <Badge variant="muted" size="xs">
              Pós-aporte
            </Badge>
          ) : (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="relative cursor-pointer max-sm:after:absolute max-sm:after:-inset-2 rounded-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  aria-label="Como calculamos a rentabilidade da projeção"
                >
                  <Badge variant="default" size="xs" className="font-mono">
                    Retorno {formatPercent(annualRate)}% a.a.
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))]">
                <p className="text-xs font-bold text-foreground">Rentabilidade da projeção</p>
                <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                  {formatPercent(annualRate)}% ao ano equivalem a{" "}
                  {formatPercent(annualRateToMonthlyRate(annualRate) * 100)}% ao mês, compostos com
                  o aporte lançado ao fim de cada mês.
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground leading-relaxed">
                  A renda passiva usa o yield da carteira pós-aporte (
                  {formatPercent(annualYieldPct)}% a.a.), não a rentabilidade da projeção.
                </p>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {activeTab === "alocacao" ? (
        <AllocationDonut
          slices={donutSlices}
          centerValue={totalPatrimonyLabel}
          centerCaption="Pós-aporte"
          selectedKey={selectedClass}
          onSelectKey={onSelectClass}
          layout="side-by-side"
          donutSize="sm"
          className="w-full"
        />
      ) : (
        <div className="w-full">
          <FireProjectionCurve
            initialPatrimony={patrimonyBase}
            monthlyAporte={aporteAmount}
            monthlyExpenses={monthlyLivingCost}
            annualRate={annualRate / 100}
            annualPassiveYield={annualYieldPct / 100}
            years={horizonYears}
          />
        </div>
      )}
    </div>
  );
}
