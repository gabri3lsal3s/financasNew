import { SlidersHorizontal, Sparkles, Wallet } from "lucide-react";
import { Button, FormField, MoneyInput, MoneyText, SegmentedControl, Switch } from "@/components/ui";
import { cn } from "@/lib/utils";
import { formatCentsAsBRL } from "@/services/masks";

export interface AporteInputCardProps {
  aporteCents: number;
  onAporteCentsChange: (cents: number) => void;
  availableCashCents: number;
  useBrokerageCash: boolean;
  onToggleBrokerageCash: (checked: boolean) => void;
  effectiveCashSelectedCents: number;
  onCashSelectedChange: (cents: number) => void;
  onUseOnlyCash: () => void;
  totalPurchasingCents: number;
  cashHighlight: boolean;
  strategy?: "optimized" | "proportional";
  onStrategyChange?: (strategy: "optimized" | "proportional") => void;
}

export function AporteInputCard({
  aporteCents,
  onAporteCentsChange,
  availableCashCents,
  useBrokerageCash,
  onToggleBrokerageCash,
  effectiveCashSelectedCents,
  onCashSelectedChange,
  onUseOnlyCash,
  totalPurchasingCents,
  cashHighlight,
  strategy = "optimized",
  onStrategyChange,
}: AporteInputCardProps) {
  return (
    <section
      aria-label="Parâmetros da simulação"
      data-tour="investments-rebalance"
      className="flex flex-col gap-3.5 rounded-2xl border border-border/80 bg-surface p-4 sm:p-4.5 shadow-xs min-w-0"
    >
      <FormField label="Valor do aporte (dinheiro novo)" htmlFor="aporte-value-input">
        <MoneyInput
          id="aporte-value-input"
          cents={aporteCents}
          onCentsChange={onAporteCentsChange}
          size="md"
          showCalculatorAction
          aria-label="Valor do aporte"
          placeholder="R$ 0,00"
        />
      </FormField>

      {onStrategyChange ? (
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Estratégia de Alocação</span>
            </span>
            <span className="text-[11px] font-normal text-muted-foreground">
              {strategy === "optimized" ? "Reconcentra nos mais defasados" : "Espalha proporcional aos gaps"}
            </span>
          </label>
          <SegmentedControl
            value={strategy}
            onChange={(val) => onStrategyChange(val as "optimized" | "proportional")}
            options={[
              {
                value: "optimized",
                label: "Menos Movimentações",
                title: "Prioriza ativos mais deficitários e evita ordens de micro-valor",
              },
              {
                value: "proportional",
                label: "Proporcional",
                title: "Distribui verba entre todos os ativos com gap positivo",
              },
            ]}
            ariaLabel="Estratégia de distribuição de aporte"
          />
        </div>
      ) : null}

      {availableCashCents > 0 ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl p-3 sm:p-3.5 transition-colors duration-200",
            cashHighlight
              ? "border border-primary/40 bg-primary/5 ring-2 ring-primary/20"
              : "bg-surface-raised border border-border/40",
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div className="flex items-start gap-2.5 min-w-0">
              <Wallet className="size-4 shrink-0 text-muted-foreground mt-0.5" aria-hidden="true" />
              <div className="min-w-0">
                <Switch
                  checked={useBrokerageCash}
                  onCheckedChange={onToggleBrokerageCash}
                  label="Somar saldo em Caixa da corretora"
                  description={
                    <span className="inline-flex items-center gap-1 flex-wrap">
                      <span>Disponível em Caixa:</span>
                      <MoneyText
                        cents={availableCashCents}
                        variant="caption"
                        tone="default"
                        className="text-muted-foreground font-medium"
                      />
                    </span>
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onUseOnlyCash}
                className="text-xs h-7 px-2.5"
              >
                Usar apenas o Caixa
              </Button>
            </div>
          </div>

          {useBrokerageCash ? (
            <div className="flex flex-col gap-2.5 border-t border-border/50 pt-2.5 animate-fade-in">
              <FormField
                label={`Saldo em Caixa a utilizar (máx. ${formatCentsAsBRL(availableCashCents)})`}
                htmlFor="aporte-cash-used-input"
              >
                <MoneyInput
                  id="aporte-cash-used-input"
                  cents={effectiveCashSelectedCents}
                  onCentsChange={onCashSelectedChange}
                  size="md"
                  showCalculatorAction
                  aria-label="Saldo em caixa utilizado"
                  placeholder="R$ 0,00"
                />
              </FormField>

              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="inline-flex flex-wrap items-center gap-1">
                  <span>Poder de compra composto: Bolso</span>
                  <MoneyText cents={aporteCents} tone="default" className="font-semibold text-foreground" />
                  <span>+ Caixa</span>
                  <MoneyText cents={effectiveCashSelectedCents} tone="default" className="font-semibold text-foreground" />
                </span>
                <MoneyText
                  cents={totalPurchasingCents}
                  tone="portfolio"
                  className="text-sm font-bold"
                />
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground pt-0.5">
        <Sparkles className="size-3.5 text-primary shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">Motor Hierárquico:</strong> Estabiliza primeiro a classe e o setor mais defasados e distribui pelos pesos das Notas (0 a 10) dos ativos elegíveis.
        </span>
      </div>
    </section>
  );
}
