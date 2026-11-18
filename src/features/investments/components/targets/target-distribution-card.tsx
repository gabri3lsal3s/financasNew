import { useState, type ReactNode } from "react";
import { InteractiveTargetDonut, type TargetDonutItem } from "@/components/modules";
import { Button, SegmentedControl, Select } from "@/components/ui";
import { TargetDistributionActions } from "./target-distribution-actions";
import { TargetDistributionProgress } from "./target-distribution-progress";
import { TargetDistributionRow } from "./target-distribution-row";

export interface TargetDistributionItem {
  name: string;
  target: number;
  savedTarget: number;
  currentPct: number;
  currentSuffix?: string;
  secondaryPctText?: string;
  membersCount: number;
  stepperAriaLabel: string;
  detailAriaLabel: string;
  detailIcon?: ReactNode;
  onOpenDetail?: () => void;
}

export interface TargetDistributionCardProps {
  ariaLabel: string;
  dataTour?: string;
  title: string;
  description: string;
  headerRight?: ReactNode;
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
  savingItemKey: string | null;
  normalizeLabel: string;
  resetLabel: string;
  saveAllLabel: string;
  savingAllLabel?: string;
  onDistributeRemaining?: () => void;
  onNormalize: () => void;
  onDistributeEqually: () => void;
  onResetZero: () => void;
  onTargetChange: (name: string, nextValue: number) => void;
  onSaveItem: (name: string) => void;
  onRemoveItem: (name: string) => void;
  onSaveAll: () => void;
}

export function TargetDistributionCard({
  ariaLabel,
  dataTour,
  title,
  description,
  headerRight,
  classSelector,
  emptyMessage,
  donutTitle,
  donutUnitLabel = "%",
  items,
  sumState,
  showProgressBar = false,
  progressLabel = "Total alocado:",
  savingItemKey,
  normalizeLabel,
  resetLabel,
  saveAllLabel,
  savingAllLabel = "Salvando todos…",
  onDistributeRemaining,
  onNormalize,
  onDistributeEqually,
  onResetZero,
  onTargetChange,
  onSaveItem,
  onRemoveItem,
  onSaveAll,
}: TargetDistributionCardProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const isSavingAny = savingItemKey !== null;

  const donutItems: TargetDonutItem[] = items.map((item) => ({
    key: item.name,
    label: item.name,
    targetPercent: item.target,
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
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
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
            disabled={isSavingAny}
          />

          {sumState.error ? (
            <div className="rounded-xl border border-critical/40 bg-critical/10 p-3 text-xs text-critical-strong font-medium">
              {sumState.error}
            </div>
          ) : null}

          {showProgressBar ? (
            <TargetDistributionProgress label={progressLabel} sum={sumState.sum} />
          ) : null}

          <TargetDistributionActions
            sum={sumState.sum}
            disabled={isSavingAny}
            normalizeLabel={normalizeLabel}
            resetLabel={resetLabel}
            onDistributeRemaining={onDistributeRemaining}
            onNormalize={onNormalize}
            onDistributeEqually={onDistributeEqually}
            onResetZero={onResetZero}
          />

          <div className="flex flex-col gap-2 min-w-0">
            {items.map((item) => (
              <TargetDistributionRow
                key={item.name}
                name={item.name}
                target={item.target}
                savedTarget={item.savedTarget}
                currentPct={item.currentPct}
                currentSuffix={item.currentSuffix}
                secondaryPctText={item.secondaryPctText}
                membersCount={item.membersCount}
                isSelected={selectedKey === item.name}
                isSavingRow={savingItemKey === item.name}
                isSavingAny={savingItemKey === "all"}
                stepperAriaLabel={item.stepperAriaLabel}
                detailAriaLabel={item.detailAriaLabel}
                detailIcon={item.detailIcon}
                onSelectToggle={() => setSelectedKey(selectedKey === item.name ? null : item.name)}
                onFocusSelect={() => setSelectedKey(item.name)}
                onTargetChange={(next) => onTargetChange(item.name, next)}
                onSave={() => onSaveItem(item.name)}
                onRemove={() => onRemoveItem(item.name)}
                onOpenDetail={item.onOpenDetail}
              />
            ))}
          </div>

          <div className="flex items-center justify-end pt-2">
            <Button
              type="button"
              variant="default"
              onClick={onSaveAll}
              disabled={isSavingAny || sumState.error !== null}
              className="shadow-xs"
            >
              {savingItemKey === "all" ? savingAllLabel : saveAllLabel}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
