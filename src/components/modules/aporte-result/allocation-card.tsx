import { useState } from "react";
import { PieChart } from "lucide-react";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { DiversificationImpactSummary } from "@/domain/portfolio";
import { cn } from "@/lib/utils";
import { ConcentricAllocationDonut, type ConcentricDonutClassItem } from "./concentric-allocation-donut";
import { HorizontalAllocationDriftBars, type DriftBarItem } from "./allocation-drift-bars";

export interface AllocationCardProps {
  classItems: ConcentricDonutClassItem[];
  sectorItems?: DriftBarItem[];
  macroItems?: DriftBarItem[];
  totalCurrentBRL: number;
  totalAllocatedBRL: number;
  diversificationImpact?: DiversificationImpactSummary | null;
  className?: string;
}

type AllocationTabMode = "classes" | "sectors" | "macro";

/**
 * AllocationCard (§Fase 4.5):
 * Coluna Direita do Cockpit Superior Simétrico.
 * Card único presente desde a abertura da tela:
 * - Cabeçalho com título adaptativo (Atual vs. Meta <-> Antes vs. Pós-Aporte);
 * - Alternador de visão segmentado [ Classes | Setores ];
 * - Aba Classes com o ConcentricAllocationDonut interativo;
 * - Aba Setores com as Drift Bars de zoom inteligente e altura controlada.
 */
export function AllocationCard({
  classItems,
  sectorItems = [],
  macroItems = [],
  totalCurrentBRL,
  totalAllocatedBRL,
  diversificationImpact,
  className,
}: AllocationCardProps) {
  const [activeTab, setActiveTab] = useState<AllocationTabMode>("classes");

  const hasAporte = totalAllocatedBRL > 0;

  // Opções do alternador
  const tabOptions = [
    {
      value: "classes",
      label: "Classes",
      title: "Distribuição por classe de ativos",
    },
    ...(macroItems.length > 0
      ? [
          {
            value: "macro",
            label: "Macro-Setores",
            title: "Distribuição por macro-setores",
          },
        ]
      : []),
    ...(sectorItems.length > 0
      ? [
          {
            value: "sectors",
            label: "Setores",
            title: "Distribuição por setores da carteira",
          },
        ]
      : []),
  ];

  return (
    <section
      aria-label="Alocação e diversificação"
      className={cn(
        "flex flex-col h-full rounded-2xl border border-border/80 bg-surface p-4 sm:p-4.5 shadow-xs min-w-0",
        className,
      )}
    >
      {/* Cabeçalho com Título Adaptativo & Alternador de Abas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-border/40 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <PieChart className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground truncate transition-all duration-200">
            {hasAporte ? "Alocação: Antes vs. Pós-Aporte" : "Alocação Atual vs. Meta"}
          </h3>
        </div>

        <div className="shrink-0 self-start sm:self-center">
          <SegmentedControl
            value={activeTab}
            onChange={(val) => setActiveTab(val as AllocationTabMode)}
            options={tabOptions}
            ariaLabel="Visualização da alocação de ativos"
          />
        </div>
      </div>

      {/* Corpo do Card: Classes (Donut Concêntrico) ou Setores (Drift Bars) */}
      <div className="min-w-0 w-full flex-1 flex flex-col justify-center pt-2 sm:pt-3">
        {activeTab === "classes" ? (
          <ConcentricAllocationDonut
            items={classItems}
            totalCurrentBRL={totalCurrentBRL}
            totalAllocatedBRL={totalAllocatedBRL}
            diversificationImpact={diversificationImpact}
            className="h-full"
          />
        ) : (
          <HorizontalAllocationDriftBars
            classItems={classItems.map((c) => ({
              id: c.id,
              name: c.name,
              currentValueBRL: c.currentValueBRL,
              allocatedBRL: c.allocatedBRL,
              targetPct: c.targetPct,
              ceilingPct: c.targetPct > 0 ? Math.min(100, c.targetPct * 1.5) : undefined,
            }))}
            sectorItems={sectorItems}
            macroItems={macroItems}
            totalCurrentBRL={totalCurrentBRL}
            totalAllocatedBRL={totalAllocatedBRL}
            hideHeader={true}
            scrollable={true}
            activeViewMode={activeTab === "macro" ? "macro" : "sectors"}
          />
        )}
      </div>
    </section>
  );
}
