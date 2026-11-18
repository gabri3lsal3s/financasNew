import { useState, type ReactNode } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { InteractiveTargetDonut, type TargetDonutItem } from "@/components/modules";
import { SegmentedControl, Select } from "@/components/ui";
import { TargetDistributionActions } from "./target-distribution-actions";
import { TargetDistributionProgress } from "./target-distribution-progress";
import { TargetDistributionRow } from "./target-distribution-row";

export interface TargetDistributionItem {
  name: string;
  target: number;
  savedTarget?: number;
  effectiveTargetPct?: number;
  currentPct: number;
  currentSuffix?: string;
  secondaryPctText?: string;
  membersCount: number;
  stepperAriaLabel: string;
  detailAriaLabel: string;
  detailIcon?: ReactNode;
  onOpenDetail?: () => void;
}

export type TargetSyncStatus = "idle" | "saving" | "saved" | "error";

export interface TargetDistributionCardProps {
  ariaLabel: string;
  dataTour?: string;
  title: string;
  description: string;
  headerRight?: ReactNode;
  syncStatus?: TargetSyncStatus;
  classSelector?: {
    classes: readonly string[];
    activeClass: string;
    onSelectClass: (cls: string) => void;
  };
  emptyMessage?: ReactNode;
  donutTitle: string;
  donutUnitLabel?: string;
  items: readonly TargetDistributionItem[];
  sumState: { sum: number; error: string | null };
  showProgressBar?: boolean;
  progressLabel?: string;
  resetLabel: string;
  onDistributeRemaining?: () => void;
  onDistributeEqually: () => void;
  onResetZero: () => void;
  onTargetChange: (name: string, nextValue: number) => void;
}

export function TargetDistributionCard({
  ariaLabel,
  dataTour,
  title,
  description,
  headerRight,
  syncStatus = "idle",
  classSelector,
  emptyMessage,
  donutTitle,
  donutUnitLabel = "%",
  items,
  sumState,
  showProgressBar = false,
  progressLabel = "Total alocado:",
  resetLabel,
  onDistributeRemaining,
  onDistributeEqually,
  onResetZero,
  onTargetChange,
}: TargetDistributionCardProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const donutItems: TargetDonutItem[] = items.map((item) => ({
    key: item.name,
    label: item.name,
    targetPercent: item.effectiveTargetPct ?? item.target,
    currentPercent: item.currentPct,
    countAssets: item.membersCount,
  }));

  return (
    <section
      role="region"
      aria-label={ariaLabel}
      data-tour={dataTour}
      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
            {syncStatus === "saving" ? (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground animate-pulse font-medium">
                <Loader2 className="size-3 animate-spin shrink-0" aria-hidden="true" />
                Salvando…
              </span>
            ) : syncStatus === "saved" ? (
              <span className="flex items-center gap-1 text-[11px] text-positive-strong font-medium">
                <Check className="size-3 shrink-0" aria-hidden="true" />
                Salvo
              </span>
            ) : syncStatus === "error" ? (
              <span className="flex items-center gap-1 text-[11px] text-critical-strong font-medium">
                <AlertCircle className="size-3 shrink-0" aria-hidden="true" />
                Erro ao salvar
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {headerRight ? <div className="shrink-0">{headerRight}</div> : null}
      </div>

      {classSelector ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 border-b border-border/80 pb-3">
          <span className="text-xs font-medium text-muted-foreground shrink-0">Filtrar Classe:</span>
          <div className="sm:hidden w-full">
            <Select
              value={classSelector.activeClass}
              onValueChange={classSelector.onSelectClass}
              options={classSelector.classes.map((c) => ({ value: c, label: c }))}
              ariaLabel="Filtrar classe de ativo"
              className="h-8 text-xs w-full"
            />
          </div>
          <div className="hidden sm:block">
            <SegmentedControl
              value={classSelector.activeClass}
              onChange={classSelector.onSelectClass}
              options={classSelector.classes.map((c) => ({ value: c, label: c }))}
              ariaLabel="Filtrar classe de ativo"
            />
          </div>
        </div>
      ) : null}

      {items.length === 0 ? (
        emptyMessage ? (
          <div className="rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
            {emptyMessage}
          </div>
        ) : null
      ) : (
        <>
          <InteractiveTargetDonut
            title={donutTitle}
            items={donutItems}
            selectedKey={selectedKey}
            onSelectKey={setSelectedKey}
            onChangeTarget={onTargetChange}
            totalCeiling={100}
            unitLabel={donutUnitLabel}
          />

          {showProgressBar ? (
            <TargetDistributionProgress label={progressLabel} sum={sumState.sum} />
          ) : null}

          <TargetDistributionActions
            sum={sumState.sum}
            disabled={syncStatus === "saving"}
            resetLabel={resetLabel}
            onDistributeRemaining={onDistributeRemaining}
            onDistributeEqually={onDistributeEqually}
            onResetZero={onResetZero}
          />

          <div className="flex flex-col gap-2 min-w-0">
            {items.map((item) => (
              <TargetDistributionRow
                key={item.name}
                name={item.name}
                target={item.target}
                effectiveTargetPct={item.effectiveTargetPct}
                savedTarget={item.savedTarget}
                currentPct={item.currentPct}
                currentSuffix={item.currentSuffix}
                secondaryPctText={item.secondaryPctText}
                membersCount={item.membersCount}
                isSelected={selectedKey === item.name}
                stepperAriaLabel={item.stepperAriaLabel}
                detailAriaLabel={item.detailAriaLabel}
                detailIcon={item.detailIcon}
                onSelectToggle={() => setSelectedKey(selectedKey === item.name ? null : item.name)}
                onFocusSelect={() => setSelectedKey(item.name)}
                onTargetChange={(next) => onTargetChange(item.name, next)}
                onOpenDetail={item.onOpenDetail}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
