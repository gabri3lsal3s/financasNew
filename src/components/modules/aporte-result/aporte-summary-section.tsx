import { useMemo, useState, type ReactNode } from "react";
import { ArrowDownToLine, ChevronDown, ChevronUp, Layers, PieChart, PiggyBank, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/ui/money-text";
import { KpiCard } from "@/components/modules/kpi-card";
import { numberToCents } from "@/domain/money";
import type { ClassAporteSummary, SectorAporteSummary } from "@/domain/portfolio";

interface DistributionTileItem {
  key: string;
  title: string;
  subtitle: string;
  allocatedBRL: number;
  gapBRL: number;
}

function AporteDistributionSection({
  icon,
  title,
  countUnitLabel,
  items,
}: {
  icon: ReactNode;
  title: string;
  countUnitLabel: string;
  items: DistributionTileItem[];
}) {
  const [showAll, setShowAll] = useState(false);

  const allocatedCount = useMemo(
    () => items.filter((item) => item.allocatedBRL > 0).length,
    [items],
  );

  const displayedItems = useMemo(() => {
    if (showAll) return items;
    const withAlloc = items.filter((item) => item.allocatedBRL > 0);
    return withAlloc.length > 0 ? withAlloc : items.slice(0, 3);
  }, [showAll, items]);

  if (items.length === 0) return null;

  const canToggle = items.length > displayedItems.length || showAll;

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border/80 bg-surface p-3.5 sm:p-4 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-foreground uppercase tracking-wider min-w-0">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        {canToggle ? (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
              {allocatedCount > 0
                ? `${allocatedCount} com aporte de ${items.length}`
                : `${items.length} ${countUnitLabel}`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              sensoryIntent="selection"
              onClick={() => setShowAll((prev) => !prev)}
              className="px-2 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1"
            >
              <span>{showAll ? "Recolher" : `Ver todas (${items.length})`}</span>
              {showAll ? (
                <ChevronUp className="size-3.5" aria-hidden="true" />
              ) : (
                <ChevronDown className="size-3.5" aria-hidden="true" />
              )}
            </Button>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-0.5">
        {displayedItems.map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-2 rounded-lg bg-surface-raised px-3 py-2.5 text-xs"
          >
            <div className="flex flex-col min-w-0">
              <span className="font-medium text-foreground truncate">{item.title}</span>
              <span className="text-[11px] text-muted-foreground truncate">{item.subtitle}</span>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <MoneyText
                cents={numberToCents(item.allocatedBRL)}
                tone={item.allocatedBRL > 0 ? "portfolio" : "default"}
                variant="caption"
                className="font-semibold"
              />
              <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1 whitespace-nowrap">
                <span>Gap:</span>
                <MoneyText
                  cents={numberToCents(item.gapBRL)}
                  variant="caption"
                  tone="default"
                  className="text-[10px] text-muted-foreground font-normal"
                />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface AporteSummarySectionProps {
  aporte: number;
  effectiveTotalAllocated: number;
  effectiveLeftover: number;
  completedCount: number;
  totalRoutesCount: number;
  classSummaries: ClassAporteSummary[];
  sectorSummaries: SectorAporteSummary[];
}

export function AporteSummarySection({
  aporte,
  effectiveTotalAllocated,
  effectiveLeftover,
  completedCount,
  totalRoutesCount,
  classSummaries,
  sectorSummaries,
}: AporteSummarySectionProps) {
  const sortedClasses = useMemo(
    () =>
      classSummaries
        .filter((c) => c.actualAllocatedBRL > 0 || c.gapBRL > 0)
        .sort((a, b) =>
          b.actualAllocatedBRL !== a.actualAllocatedBRL
            ? b.actualAllocatedBRL - a.actualAllocatedBRL
            : b.gapBRL - a.gapBRL,
        )
        .map<DistributionTileItem>((cls) => ({
          key: cls.className,
          title: cls.className || "Sem classe",
          subtitle: `Meta: ${cls.targetPct}%`,
          allocatedBRL: cls.actualAllocatedBRL,
          gapBRL: cls.gapBRL,
        })),
    [classSummaries],
  );

  const sortedSectors = useMemo(
    () =>
      sectorSummaries
        .filter((s) => s.actualAllocatedBRL > 0 || s.gapBRL > 0)
        .sort((a, b) =>
          b.actualAllocatedBRL !== a.actualAllocatedBRL
            ? b.actualAllocatedBRL - a.actualAllocatedBRL
            : b.gapBRL - a.gapBRL,
        )
        .map<DistributionTileItem>((sec) => ({
          key: `${sec.className}::${sec.sectorName}`,
          title: sec.sectorName,
          subtitle: sec.targetPctInClass > 0 ? `${sec.className} · Meta: ${sec.targetPctInClass}%` : sec.className,
          allocatedBRL: sec.actualAllocatedBRL,
          gapBRL: sec.gapBRL,
        })),
    [sectorSummaries],
  );

  return (
    <div className="flex flex-col gap-3 min-w-0">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <KpiCard
          icon={<PiggyBank className="size-4" aria-hidden="true" />}
          label="Aporte informado"
          cents={numberToCents(aporte)}
        />
        <KpiCard
          icon={<ArrowDownToLine className="size-4" aria-hidden="true" />}
          label={completedCount > 0 ? `Alocado (${completedCount}/${totalRoutesCount} feitos)` : "Alocado em ativos"}
          cents={numberToCents(effectiveTotalAllocated)}
          tone="portfolio"
        />
        <KpiCard
          icon={<Wallet className="size-4" aria-hidden="true" />}
          label="Sobra para caixa"
          cents={numberToCents(effectiveLeftover)}
          hint={effectiveLeftover > 0 ? "Residual mantido em liquidez" : undefined}
        />
      </div>

      <AporteDistributionSection
        icon={<Layers className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />}
        title="Distribuição Macro por Classe"
        countUnitLabel="classes"
        items={sortedClasses}
      />

      <AporteDistributionSection
        icon={<PieChart className="size-3.5 text-muted-foreground shrink-0" aria-hidden="true" />}
        title="Distribuição Meso por Setor"
        countUnitLabel="setores"
        items={sortedSectors}
      />
    </div>
  );
}
