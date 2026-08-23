import { useMemo } from "react";
import { ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import {
  calculateInvestmentPreview,
  parseNumber,
  type InvestmentWizardState,
} from "./wizard-state";

export interface StepReviewProps {
  state: InvestmentWizardState;
  cashAvailableBRL?: number;
}

export function StepReview({ state, cashAvailableBRL = 0 }: StepReviewProps) {
  const preview = useMemo(
    () => calculateInvestmentPreview(state, cashAvailableBRL),
    [state, cashAvailableBRL],
  );

  const isExisting = state.mode === "existing_aporte";
  const parsedQty = parseNumber(state.quantityStr);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary">
        <ShieldCheck className="size-4" aria-hidden="true" />
        <span>Resumo da Operação</span>
      </div>

      <div className="flex flex-col divide-y divide-border/80 rounded-2xl border border-border/90 bg-surface/95 p-4 shadow-sm">
        {/* Ativo e Tipo */}
        <div className="flex items-center justify-between pb-3">
          <div className="flex flex-col">
            <span className="font-mono text-lg font-bold text-foreground">{state.ticker}</span>
            <span className="text-xs text-muted-foreground">{state.name || state.assetClass}</span>
          </div>
          <Badge variant={isExisting ? "default" : "muted"} className="text-xs">
            {isExisting ? "Novo Aporte" : "Novo Ativo"}
          </Badge>
        </div>

        {/* Quantidade & Preço */}
        <div className="grid grid-cols-2 gap-3 py-3 text-xs">
          <div className="flex flex-col">
            <span className="text-muted-foreground">
              {isExisting ? "Cotas Adicionadas" : "Cotas Iniciais"}
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {state.isCash ? "—" : `${parsedQty} cotas`}
            </span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-muted-foreground">
              {isExisting ? "Preço do Aporte" : "Preço Médio Inicial"}
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              <MoneyText cents={state.priceCents} />
            </span>
          </div>
        </div>

        {/* Posição Final Pós-Operação */}
        <div className="grid grid-cols-2 gap-3 py-3 text-xs bg-surface-hover/30 -mx-4 px-4">
          <div className="flex flex-col">
            <span className="text-muted-foreground">Nova Quantidade Total</span>
            <span className="font-mono text-sm font-bold text-primary">
              {state.isCash ? "—" : `${preview.newQuantity} cotas`}
            </span>
          </div>

          <div className="flex flex-col text-right">
            <span className="text-muted-foreground">Novo Preço Médio</span>
            <span className="font-mono text-sm font-bold text-primary">
              <MoneyText cents={numberToCents(preview.newAveragePrice)} />
            </span>
          </div>
        </div>

        {/* Total Financeiro e Fluxo */}
        <div className="pt-3 flex flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Valor Total da Operação:</span>
            <span className="font-mono text-base font-bold text-foreground">
              <MoneyText cents={numberToCents(preview.totalOrderValueBRL)} />
            </span>
          </div>

          {preview.cashDebitBRL > 0 && (
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Débito do Caixa:</span>
              <span className="font-mono text-negative-strong">
                - <MoneyText cents={numberToCents(preview.cashDebitBRL)} />
              </span>
            </div>
          )}

          {preview.contributionBRL > 0 && (
            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Registrado como Aporte do Mês:</span>
              <span className="font-mono text-positive-strong">
                + <MoneyText cents={numberToCents(preview.contributionBRL)} />
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
