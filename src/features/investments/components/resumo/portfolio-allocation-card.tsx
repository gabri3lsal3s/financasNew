import { PieChart } from "lucide-react";
import { CategoryDonut, type DonutSlice } from "@/components/modules";
import { Button } from "@/components/ui";
import { numberToCents } from "@/domain/money";

export type AllocationDisplayMode = "class" | "sector" | "asset";

export interface PortfolioAllocationCardProps {
  allocationMode: AllocationDisplayMode;
  onChangeMode: (mode: AllocationDisplayMode) => void;
  slices: DonutSlice[];
  totalBRL: number;
}

const MODE_OPTIONS: ReadonlyArray<{ value: AllocationDisplayMode; label: string }> = [
  { value: "class", label: "Por Classe" },
  { value: "sector", label: "Por Setor" },
  { value: "asset", label: "Por Ativo" },
];

export function PortfolioAllocationCard({
  allocationMode,
  onChangeMode,
  slices,
  totalBRL,
}: PortfolioAllocationCardProps) {
  return (
    <section
      aria-label="Alocação da Carteira"
      className="rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <PieChart className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-foreground">Distribuição Patrimonial</h2>
        </div>

        <div
          role="group"
          aria-label="Modo de distribuição"
          className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/50 p-0.5 self-start sm:self-auto"
        >
          {MODE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={allocationMode === opt.value ? "solid" : "ghost"}
              size="sm"
              sensoryIntent="selection"
              aria-pressed={allocationMode === opt.value}
              onClick={() => onChangeMode(opt.value)}
              className="h-7 px-2.5 text-xs"
            >
              {opt.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <CategoryDonut
          slices={slices}
          totalCents={numberToCents(totalBRL)}
          emptyText="Sem ativos na distribuição"
          className="w-full max-w-full"
        />
      </div>
    </section>
  );
}
