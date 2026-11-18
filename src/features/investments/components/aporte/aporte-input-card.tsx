import { Sparkles, Wallet } from "lucide-react";
import { Button, FormField, MoneyInput, MoneyText, Switch } from "@/components/ui";
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
}: AporteInputCardProps) {
  return (
    <section
      aria-label="Parâmetros da simulação"
      data-tour="investments-rebalance"
      className="flex flex-col gap-4 rounded-2xl border border-border/80 bg-surface p-4 sm:p-5 shadow-xs min-w-0 overflow-hidden"
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

      {availableCashCents > 0 ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl p-3.5 transition-colors duration-200",
            cashHighlight
              ? "border border-primary/40 bg-primary/5 ring-2 ring-primary/20"
              : "bg-surface-raised",
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

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onUseOnlyCash}
              className="self-start sm:self-center shrink-0"
            >
              Usar apenas o Caixa
            </Button>
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

      <div className="flex items-start sm:items-center gap-2 rounded-xl bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
        <Sparkles className="size-4 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold text-foreground">Motor Hierárquico:</strong> Estabiliza primeiro a classe e o setor mais defasados e distribui pelos pesos das Notas (0 a 10) dos ativos elegíveis.
        </span>
      </div>
    </section>
  );
}
