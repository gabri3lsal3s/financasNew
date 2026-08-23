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

  const mode = state.mode;
  const parsedQty = parseNumber(state.quantityStr);

  const getModeBadge = () => {
    switch (mode) {
      case "buy":
      case "existing_aporte":
        return { label: "Compra / Aporte", variant: "default" as const };
      case "sell":
        return { label: "Venda / Resgate", variant: "negative" as const };
      case "dividend":
        return { label: "Provento", variant: "positive" as const };
      case "split":
        return { label: "Split / Desdobro", variant: "warning" as const };
      case "new_asset":
        return { label: "Novo Ativo", variant: "default" as const };
      default:
        return { label: "Operação", variant: "muted" as const };
    }
  };

  const badgeInfo = getModeBadge();

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
          <Badge variant={badgeInfo.variant} className="text-xs">
            {badgeInfo.label}
          </Badge>
        </div>

        {/* 1. Revisão de Compra / Novo Ativo */}
        {(mode === "buy" || mode === "existing_aporte" || mode === "new_asset") && (
          <>
            <div className="grid grid-cols-2 gap-3 py-3 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">
                  {mode === "new_asset" ? "Cotas Iniciais" : "Cotas Adicionadas"}
                </span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {state.isCash ? "—" : `${parsedQty} cotas`}
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">
                  {mode === "new_asset" ? "Preço Médio Inicial" : "Preço do Aporte"}
                </span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  <MoneyText cents={state.priceCents} />
                </span>
              </div>
            </div>

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
          </>
        )}

        {/* 2. Revisão de Venda */}
        {mode === "sell" && (
          <>
            <div className="grid grid-cols-2 gap-3 py-3 text-xs">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Cotas Vendidas</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  {parsedQty} cotas
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">Preço de Venda</span>
                <span className="font-mono text-sm font-semibold text-foreground">
                  <MoneyText cents={state.priceCents} />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-3 text-xs bg-surface-hover/30 -mx-4 px-4">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Custódia Restante</span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {preview.newQuantity} cotas
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">Resultado Realizado</span>
                <span
                  className={`font-mono text-sm font-bold ${
                    (preview.realizedPnl ?? 0) >= 0 ? "text-positive-strong" : "text-negative-strong"
                  }`}
                >
                  {(preview.realizedPnl ?? 0) >= 0 ? "+" : ""}
                  <MoneyText cents={numberToCents(preview.realizedPnl ?? 0)} />
                </span>
              </div>
            </div>

            <div className="pt-3 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Valor Total Bruto:</span>
                <span className="font-mono text-base font-bold text-foreground">
                  <MoneyText cents={numberToCents(preview.totalOrderValueBRL)} />
                </span>
              </div>

              {state.syncCash && (
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Crédito em Caixa:</span>
                  <span className="font-mono text-positive-strong">
                    + <MoneyText cents={numberToCents(preview.totalOrderValueBRL)} />
                  </span>
                </div>
              )}
            </div>
          </>
        )}

        {/* 3. Revisão de Provento */}
        {mode === "dividend" && (
          <div className="pt-3 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Valor Total Recebido:</span>
              <span className="font-mono text-base font-bold text-positive-strong">
                <MoneyText cents={state.totalCents} />
              </span>
            </div>

            <div className="flex items-center justify-between text-muted-foreground text-[11px]">
              <span>Data do Pagamento:</span>
              <span className="font-mono font-medium text-foreground">{state.date}</span>
            </div>

            {state.syncCash && (
              <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                <span>Crédito em Caixa:</span>
                <span className="font-mono text-positive-strong">
                  + <MoneyText cents={state.totalCents} />
                </span>
              </div>
            )}
          </div>
        )}

        {/* 4. Revisão de Split */}
        {mode === "split" && (
          <div className="pt-3 flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Fator do Desdobramento:</span>
              <span className="font-mono font-bold text-foreground">1 para {state.splitFactor}</span>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2 text-xs bg-surface-hover/30 -mx-4 px-4 rounded-lg">
              <div className="flex flex-col">
                <span className="text-muted-foreground">Nova Quantidade</span>
                <span className="font-mono font-bold text-primary">
                  {preview.newQuantity} cotas
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-muted-foreground">Novo Preço Médio</span>
                <span className="font-mono font-bold text-primary">
                  <MoneyText cents={numberToCents(preview.newAveragePrice)} />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
