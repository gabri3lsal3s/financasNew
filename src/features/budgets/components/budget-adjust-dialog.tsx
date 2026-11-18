import {
  Alert,
  Button,
  FormField,
  Modal,
  ModalFooter,
  MoneyInput,
  MoneyText,
  NumberStepper,
  Tabs,
} from "@/components/ui";
import { monthLabel } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { Category } from "@/types";
import { BudgetAdjustPreviewList } from "./budget-adjust-preview-list";
import { BUDGET_ADJUST_PRESETS, useBudgetAdjust } from "./use-budget-adjust";

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
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function BudgetAdjustDialogContent({
  month,
  categories,
  open,
  onOpenChange,
}: BudgetAdjustDialogContentProps) {
  const state = useBudgetAdjust({
    month,
    categories,
    onClose: () => onOpenChange(false),
  });

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Ajustar Orçamento"
      description={`Redistribuição proporcional dos limites para ${monthLabel(month)}`}
      size="lg"
      showCalculator={state.mode === "target"}
      footer={
        <ModalFooter borderless>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={state.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            sensoryIntent={false}
            onClick={() => void state.handleApply()}
            disabled={state.isPending || state.result.items.length === 0}
          >
            {state.isPending ? "Aplicando…" : "Aplicar ajuste"}
          </Button>
        </ModalFooter>
      }
    >
      <div className="mt-2 flex flex-col gap-4">
        {state.error ? <Alert variant="error">{state.error}</Alert> : null}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-surface-raised border border-border/80">
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">
              Total Atual
            </span>
            <MoneyText
              cents={state.result.totalCurrentCents}
              tone="default"
              className="text-sm font-semibold"
            />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">
              Novo Total
            </span>
            <MoneyText
              cents={state.result.totalNewCents}
              tone="default"
              className="text-sm font-semibold"
            />
          </div>
          <div>
            <span className="text-[11px] font-medium text-muted-foreground block">Variação</span>
            <span className="inline-flex items-center gap-1 text-sm font-semibold tabular-nums">
              <span
                className={
                  state.result.diffCents >= 0 ? "text-positive-strong" : "text-negative-strong"
                }
              >
                {state.result.diffCents >= 0 ? "+" : "−"}
                <MoneyText
                  cents={Math.abs(state.result.diffCents)}
                  tone={state.result.diffCents >= 0 ? "positive" : "negative"}
                />
              </span>
              <span className="text-[11px] text-muted-foreground">
                ({state.result.deltaPercent >= 0 ? "+" : ""}
                {state.result.deltaPercent.toFixed(1)}%)
              </span>
            </span>
          </div>
        </div>

        <FormField label="Método de Ajuste">
          <Tabs
            value={state.mode}
            onValueChange={state.handleModeChange}
            fullWidth={true}
            variant="pills"
            items={[
              { value: "percent", label: "Por Percentual (+/- %)" },
              { value: "target", label: "Por Valor Total (R$)" },
            ]}
          />
        </FormField>

        {state.mode === "percent" ? (
          <div className="flex flex-col gap-2.5">
            <FormField label="Variação percentual (%)">
              <NumberStepper
                editable
                value={state.percent}
                onValueChange={state.setPercent}
                min={-99}
                max={500}
                step={0.5}
                placeholder="Ex.: 10 ou -5"
                ariaLabel="Variação percentual do orçamento"
                decreaseLabel="Diminuir variação percentual"
                increaseLabel="Aumentar variação percentual"
              />
            </FormField>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-medium text-muted-foreground mr-1">
                Atalhos:
              </span>
              {BUDGET_ADJUST_PRESETS.map((p) => {
                const isSelected = state.percent === p;
                return (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => state.handleSelectPreset(p)}
                    className={cn(
                      "relative px-2.5 py-1.5 sm:py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer select-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring max-sm:after:absolute max-sm:after:-inset-1",
                      isSelected
                        ? "border-primary bg-primary/10 text-primary-strong font-semibold"
                        : "border-border/80 bg-surface text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                    )}
                  >
                    {p > 0 ? `+${p}%` : `${p}%`}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <FormField
            label="Novo valor total pretendido para o mês"
            htmlFor="adjust-target-amount"
          >
            <MoneyInput
              id="adjust-target-amount"
              cents={state.targetTotalCents}
              onCentsChange={state.setTargetTotalCents}
              aria-label="Novo valor total pretendido para o mês"
            />
          </FormField>
        )}

        <BudgetAdjustPreviewList
          items={state.result.items}
          categoryMap={state.categoryMap}
        />
      </div>
    </Modal>
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
  if (!open) return null;

  return (
    <BudgetAdjustDialogContent
      key={month}
      month={month}
      categories={categories}
      open={open}
      onOpenChange={onOpenChange}
    />
  );
}
