import { useMemo } from "react";
import { ArrowRight, Calculator, Info } from "lucide-react";
import { Badge, Checkbox, DatePicker, Input, MoneyInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  calculateInvestmentPreview,
  parseNumber,
  type InvestmentWizardState,
} from "./wizard-state";
import type { PortfolioAsset } from "@/types";

export interface StepOrderProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
  cashAsset?: PortfolioAsset | null;
}

export function StepOrder({ state, onChange, cashAsset }: StepOrderProps) {
  const cashAvailableBRL = cashAsset?.quantity ?? 0;

  const preview = useMemo(
    () => calculateInvestmentPreview(state, cashAvailableBRL),
    [state, cashAvailableBRL],
  );

  const parsedQty = parseNumber(state.quantityStr);
  const isCash = state.isCash;

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo do Ativo Selecionado */}
      <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/80 p-3.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-foreground">{state.ticker}</span>
            <Badge variant="muted" className="text-[10px]">
              {state.assetClass}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            Posição Atual: {state.selectedAsset?.quantity ?? 0} cotas · PM:{" "}
            <MoneyText cents={numberToCents(state.selectedAsset?.average_price ?? 0)} />
          </span>
        </div>
      </div>

      {/* Formulário de Aporte / Compra */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {!isCash ? (
          <>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-order-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantidade de Cotas
              </label>
              <Input
                id="wizard-order-qty"
                type="text"
                inputMode="decimal"
                value={state.quantityStr}
                onChange={(e) => onChange({ quantityStr: e.target.value })}
                placeholder="Ex: 10"
                className="font-mono text-base"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-order-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço por Cota ({state.currency})
              </label>
              <MoneyInput
                id="wizard-order-price"
                cents={state.priceCents}
                onCentsChange={(priceCents) => onChange({ priceCents })}
                placeholder="R$ 0,00"
              />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="wizard-cash-total" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Valor do Aporte em Caixa (R$)
            </label>
            <MoneyInput
              id="wizard-cash-total"
              cents={state.totalCents}
              onCentsChange={(totalCents) => onChange({ totalCents })}
              placeholder="R$ 0,00"
              autoFocus
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Data do Aporte
          </label>
          <DatePicker
            value={state.date}
            onValueChange={(date) => onChange({ date })}
          />
        </div>
      </div>

      {/* Card de Impacto no Preço Médio em Tempo Real */}
      {!isCash && parsedQty > 0 && state.priceCents > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <Calculator className="size-3.5 text-primary" aria-hidden="true" />
            <span>Impacto no Preço Médio e Posição</span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
            <div className="flex flex-col gap-1 rounded-lg bg-surface-hover/50 p-2.5">
              <span className="text-[11px] text-muted-foreground">Preço Médio</span>
              <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                <MoneyText cents={numberToCents(preview.currentAveragePrice)} />
                <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                <span className="text-primary font-bold">
                  <MoneyText cents={numberToCents(preview.newAveragePrice)} />
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1 rounded-lg bg-surface-hover/50 p-2.5">
              <span className="text-[11px] text-muted-foreground">Total Investido na Ordem</span>
              <span className="font-mono text-sm font-bold text-foreground">
                <MoneyText cents={numberToCents(preview.totalOrderValueBRL)} />
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Opções de Sincronização com Caixa & Aporte do Mês */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface/40 p-3.5">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs">
          <Checkbox
            checked={state.syncCash}
            onCheckedChange={(checked) => onChange({ syncCash: !!checked })}
          />
          <span className="text-foreground">
            Debitar do saldo de Caixa da carteira (disponível:{" "}
            <strong className="font-mono"><MoneyText cents={numberToCents(cashAvailableBRL)} /></strong>)
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer text-xs">
          <Checkbox
            checked={state.recordContribution}
            onCheckedChange={(checked) => onChange({ recordContribution: !!checked })}
          />
          <span className="text-foreground">
            Contabilizar como Aporte Financeiro no mês corrente
          </span>
        </label>

        {state.syncCash && preview.totalOrderValueBRL > cashAvailableBRL && (
          <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-500">
            <Info className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>
              Saldo em caixa parcial: R$ {cashAvailableBRL.toFixed(2)} serão debitados do Caixa e o restante (R${" "}
              {(preview.totalOrderValueBRL - cashAvailableBRL).toFixed(2)}) será considerado capital novo.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
