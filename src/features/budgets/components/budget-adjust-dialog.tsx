import { useMemo, useState } from "react";
import { Alert, Button, Input, Modal, ModalFooter, MoneyInput, Tabs } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { CategoryIcon } from "@/components/modules";
import {
  redistributeProportionalBudget,
  redistributeProportionalBudgetByPercent,
  type ProportionalCategoryInput,
} from "@/domain/budgets";
import { monthLabel } from "@/lib/date";
import { getErrorMessage } from "@/services/errors";
import { triggerSensory } from "@/services/sensory";
import { useSetBatchBudgetLimits } from "@/state";
import type { Category } from "@/types";

export interface BudgetAdjustCategoryItem {
  category: Category;
  currentLimitCents: number;
}

export interface BudgetAdjustDialogProps {
  month: string;
  categories: BudgetAdjustCategoryItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface BudgetAdjustDialogContentProps {
  month: string;
  categories: BudgetAdjustCategoryItem[];
  onClose: () => void;
}

const PRESET_PERCENTAGES = [-15, -10, -5, 5, 10, 15, 20] as const;

function BudgetAdjustDialogContent({
  month,
  categories,
  onClose,
}: BudgetAdjustDialogContentProps) {
  const [mode, setMode] = useState<"percent" | "target">("percent");
  const [percent, setPercent] = useState<number>(10);
  const [percentInputText, setPercentInputText] = useState<string>("10");

  const totalCurrentCents = useMemo(
    () => categories.reduce((acc, c) => acc + Math.max(0, c.currentLimitCents), 0),
    [categories],
  );

  const [targetTotalCents, setTargetTotalCents] = useState<number>(() =>
    Math.max(0, Math.round(totalCurrentCents * 1.1)),
  );
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBatchLimits = useSetBatchBudgetLimits();

  const domainCategories: ProportionalCategoryInput[] = useMemo(
    () =>
      categories.map((c) => ({
        categoryId: c.category.id,
        name: c.category.name,
        currentLimitCents: c.currentLimitCents,
      })),
    [categories],
  );

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.category.id, c.category])),
    [categories],
  );

  const result = useMemo(() => {
    if (mode === "percent") {
      return redistributeProportionalBudgetByPercent(domainCategories, percent);
    }
    return redistributeProportionalBudget(domainCategories, targetTotalCents);
  }, [domainCategories, mode, percent, targetTotalCents]);

  const handleModeChange = (newModeStr: string) => {
    const newMode = newModeStr as "percent" | "target";
    if (newMode === "target" && mode === "percent") {
      setTargetTotalCents(result.totalNewCents);
    } else if (newMode === "percent" && mode === "target") {
      const delta =
        totalCurrentCents > 0
          ? ((targetTotalCents - totalCurrentCents) / totalCurrentCents) * 100
          : 0;
      const roundedDelta = Math.round(delta);
      setPercent(roundedDelta);
      setPercentInputText(String(roundedDelta));
    }
    setMode(newMode);
  };

  const handlePercentInputChange = (val: string) => {
    setPercentInputText(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed)) {
      setPercent(parsed);
    }
  };

  const handleSelectPreset = (p: number) => {
    triggerSensory("selection");
    setPercent(p);
    setPercentInputText(String(p));
  };

  const handleApply = async () => {
    if (categories.length === 0 || isPending) return;
    setIsPending(true);
    setError(null);
    try {
      await setBatchLimits.mutateAsync({
        month,
        items: result.items.map((item) => ({
          categoryId: item.categoryId,
          limit: item.newLimitCents / 100,
        })),
      });
      triggerSensory("success");
      onClose();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-4">
      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-surface border border-border/80">
        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">Total Atual</span>
          <MoneyText cents={result.totalCurrentCents} tone="default" className="text-sm font-semibold tabular-nums" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">Novo Total</span>
          <MoneyText cents={result.totalNewCents} tone="default" className="text-sm font-semibold tabular-nums" />
        </div>
        <div>
          <span className="text-[11px] font-medium text-muted-foreground block">Variação</span>
          <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
            <span className={result.diffCents >= 0 ? "text-positive-strong" : "text-negative-strong"}>
              {result.diffCents >= 0 ? "+" : "−"}
              <MoneyText cents={Math.abs(result.diffCents)} tone={result.diffCents >= 0 ? "positive" : "negative"} />
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({result.deltaPercent >= 0 ? "+" : ""}{result.deltaPercent.toFixed(1)}%)
            </span>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-foreground">Método de Ajuste</label>
        <Tabs
          value={mode}
          onValueChange={handleModeChange}
          fullWidth={true}
          variant="pills"
          items={[
            { value: "percent", label: "Por Percentual (+/- %)" },
            { value: "target", label: "Por Valor Total (R$)" },
          ]}
        />
      </div>

      {mode === "percent" ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 flex flex-col gap-1">
              <label htmlFor="adjust-percent-input" className="text-xs font-semibold text-foreground">
                Variação percentual (%)
              </label>
              <div className="relative">
                <Input
                  id="adjust-percent-input"
                  type="number"
                  step="0.5"
                  value={percentInputText}
                  onChange={(e) => handlePercentInputChange(e.target.value)}
                  placeholder="Ex.: 10 ou -5"
                  className="pr-8 tabular-nums font-medium"
                  aria-label="Variação percentual do orçamento"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                  %
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-medium text-muted-foreground mr-1">Atalhos:</span>
            {PRESET_PERCENTAGES.map((p) => {
              const isSelected = percent === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => handleSelectPreset(p)}
                  className={`px-2 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer select-none ${
                    isSelected
                      ? "border-primary bg-primary/10 text-primary-strong"
                      : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  }`}
                >
                  {p > 0 ? `+${p}%` : `${p}%`}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="adjust-target-amount" className="text-xs font-semibold text-foreground">
            Novo valor total pretendido para o mês
          </label>
          <MoneyInput
            id="adjust-target-amount"
            cents={targetTotalCents}
            onCentsChange={setTargetTotalCents}
            aria-label="Novo valor total pretendido para o mês"
          />
        </div>
      )}

      <div className="flex flex-col gap-1.5 pt-1">
        <div className="flex items-center justify-between text-xs font-semibold text-foreground px-1">
          <span>Pré-visualização por Categoria ({result.items.length})</span>
          <span className="text-[11px] font-normal text-muted-foreground">Atual → Novo (Variação)</span>
        </div>

        {result.items.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground rounded-xl border border-border/80 bg-surface">
            Nenhuma categoria de despesa disponível para ajuste.
          </div>
        ) : (
          <div className="max-h-56 overflow-y-auto no-scrollbar rounded-xl border border-border/80 bg-surface divide-y divide-border/60">
            {result.items.map((item) => {
              const cat = categoryMap.get(item.categoryId);
              return (
                <div key={item.categoryId} className="flex items-center justify-between gap-3 p-2.5 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CategoryIcon icon={cat?.icon} color={cat?.color} />
                    <span className="font-medium text-foreground truncate">
                      {item.name || cat?.name || "Categoria"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 tabular-nums shrink-0">
                    <span className="text-muted-foreground">
                      <MoneyText cents={item.currentLimitCents} tone="default" />
                    </span>
                    <span className="text-muted-foreground/60">→</span>
                    <span className="font-semibold text-foreground">
                      <MoneyText cents={item.newLimitCents} tone="default" />
                    </span>
                    <span
                      className={`text-[11px] font-medium ${
                        item.diffCents > 0
                          ? "text-positive-strong"
                          : item.diffCents < 0
                            ? "text-negative-strong"
                            : "text-muted-foreground"
                      }`}
                    >
                      ({item.diffCents > 0 ? "+" : item.diffCents < 0 ? "−" : ""}
                      <MoneyText cents={Math.abs(item.diffCents)} tone="default" />)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={() => void handleApply()}
          disabled={isPending || result.items.length === 0}
        >
          {isPending ? "Aplicando…" : "Aplicar ajuste"}
        </Button>
      </ModalFooter>
    </div>
  );
}

/**
 * Modal de Ajuste Proporcional do Orçamento Global (§Tarefa 09).
 */
export function BudgetAdjustDialog({
  month,
  categories,
  open,
  onOpenChange,
}: BudgetAdjustDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Ajustar Orçamento"
      description={`Redistribuição proporcional dos limites para ${monthLabel(month)}`}
      size="lg"
    >
      {open ? (
        <BudgetAdjustDialogContent
          month={month}
          categories={categories}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Modal>
  );
}
