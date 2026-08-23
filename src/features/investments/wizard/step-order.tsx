import { useMemo } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Calculator, GitFork, Info, Receipt } from "lucide-react";
import { Badge, Checkbox, DatePicker, Input, MoneyInput } from "@/components/ui";
import { MoneyText } from "@/components/ui/money-text";
import { numberToCents } from "@/domain/money";
import { cn } from "@/lib/utils";
import {
  calculateInvestmentPreview,
  parseNumber,
  type InvestmentWizardState,
  type WizardMode,
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
  const mode = state.mode;

  const operations = [
    {
      id: "buy",
      label: "Compra / Aporte",
      icon: ArrowUpRight,
      activeClass: "border-primary bg-primary/10 text-primary-strong shadow-xs font-bold",
    },
    {
      id: "sell",
      label: "Venda / Resgate",
      icon: ArrowDownLeft,
      activeClass: "border-negative/60 bg-negative/10 text-negative-strong shadow-xs font-bold",
    },
    {
      id: "dividend",
      label: "Provento",
      icon: Receipt,
      activeClass: "border-positive/60 bg-positive/10 text-positive-strong shadow-xs font-bold",
    },
    {
      id: "split",
      label: "Split / Desdobro",
      icon: GitFork,
      activeClass: "border-warning/60 bg-warning/10 text-warning-strong shadow-xs font-bold",
    },
  ];

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

      {/* Seletor de Tipo de Operação quando o ativo já existe na carteira */}
      {!isCash && state.selectedAsset && (
        <div className="grid grid-cols-2 gap-2" role="tablist" aria-label="Tipo de Operação">
          {operations.map((op) => {
            const Icon = op.icon;
            const isSelected = mode === op.id || (op.id === "buy" && mode === "existing_aporte");
            return (
              <button
                key={op.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => onChange({ mode: op.id as WizardMode })}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-2.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
                  isSelected
                    ? op.activeClass
                    : "border-border/80 bg-surface/60 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{op.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 1. MODO COMPRA / APORTE */}
      {(mode === "buy" || mode === "existing_aporte") && (
        <div className="flex flex-col gap-4">
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

          {/* Sincronização com Caixa & Aporte do Mês */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface/40 p-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs">
              <Checkbox
                checked={state.syncCash}
                onCheckedChange={(checked) => onChange({ syncCash: !!checked })}
              />
              <span className="text-foreground">Debitar do saldo de Caixa da carteira</span>
            </label>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs">
              <Checkbox
                checked={state.recordContribution}
                onCheckedChange={(checked) => onChange({ recordContribution: !!checked })}
              />
              <span className="text-foreground">Contabilizar como Aporte Financeiro no mês</span>
            </label>
          </div>
        </div>
      )}

      {/* 2. MODO VENDA / DESINVESTIMENTO */}
      {mode === "sell" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-sell-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantidade a Vender
              </label>
              <Input
                id="wizard-sell-qty"
                type="text"
                inputMode="decimal"
                value={state.quantityStr}
                onChange={(e) => onChange({ quantityStr: e.target.value })}
                placeholder={`Máx: ${state.selectedAsset?.quantity ?? 0}`}
                className="font-mono text-base"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-sell-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço de Venda ({state.currency})
              </label>
              <MoneyInput
                id="wizard-sell-price"
                cents={state.priceCents}
                onCentsChange={(priceCents) => onChange({ priceCents })}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data da Venda
              </label>
              <DatePicker
                value={state.date}
                onValueChange={(date) => onChange({ date })}
              />
            </div>
          </div>

          {/* Prévia de Ganho/Perda de Capital */}
          {parsedQty > 0 && state.priceCents > 0 && preview.realizedPnl !== undefined && (
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Resultado Realizado:</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    preview.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong"
                  }`}
                >
                  {preview.realizedPnl >= 0 ? "+" : ""}
                  <MoneyText cents={numberToCents(preview.realizedPnl)} /> ({preview.realizedPnlPct?.toFixed(1)}%)
                </span>
              </div>

              {state.assetClass === "Ações" && (
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                  <Info className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span>Isenção de IRPF se o total de vendas de ações no mês for até R$ 20.000,00.</span>
                </div>
              )}
            </div>
          )}

          <label className="flex items-center gap-2.5 cursor-pointer text-xs rounded-xl border border-border/60 bg-surface/40 p-3.5">
            <Checkbox
              checked={state.syncCash}
              onCheckedChange={(checked) => onChange({ syncCash: !!checked })}
            />
            <span className="text-foreground">Creditar o valor da venda diretamente no Caixa da carteira</span>
          </label>
        </div>
      )}

      {/* 3. MODO PROVENTO */}
      {mode === "dividend" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label htmlFor="wizard-div-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Valor Total Recebido (Líquido)
              </label>
              <MoneyInput
                id="wizard-div-amount"
                cents={state.totalCents}
                onCentsChange={(totalCents) => onChange({ totalCents })}
                placeholder="R$ 0,00"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data do Pagamento
              </label>
              <DatePicker
                value={state.date}
                onValueChange={(date) => onChange({ date })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs rounded-xl border border-border/60 bg-surface/40 p-3.5">
            <Checkbox
              checked={state.syncCash}
              onCheckedChange={(checked) => onChange({ syncCash: !!checked })}
            />
            <span className="text-foreground">Creditar o rendimento diretamente no Caixa da carteira</span>
          </label>
        </div>
      )}

      {/* 4. MODO SPLIT */}
      {mode === "split" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-split-factor" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Fator de Desdobro (1 para N)
              </label>
              <Input
                id="wizard-split-factor"
                type="number"
                min="2"
                step="1"
                value={state.splitFactor}
                onChange={(e) => onChange({ splitFactor: Number(e.target.value) || 2 })}
                className="font-mono text-base"
                autoFocus
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data do Evento
              </label>
              <DatePicker
                value={state.date}
                onValueChange={(date) => onChange({ date })}
              />
            </div>
          </div>

          {state.selectedAsset && (
            <div className="flex flex-col gap-1 rounded-xl bg-surface-hover/60 p-3.5 text-xs">
              <span className="text-muted-foreground">Posição Resultante:</span>
              <span className="font-mono font-bold text-foreground">
                {state.selectedAsset.quantity * state.splitFactor} cotas a{" "}
                <MoneyText
                  cents={numberToCents(state.selectedAsset.average_price / state.splitFactor)}
                />
              </span>
              <span className="text-[10px] text-muted-foreground">
                O custo total da posição é rigorosamente preservado.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
