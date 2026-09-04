import { useMemo } from "react";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Calculator, GitFork, Info, Receipt } from "lucide-react";
import { Badge, Checkbox, DatePicker, Input, MoneyInput, NumericInput } from "@/components/ui";
import { MonthPicker } from "@/components/modules";
import { MoneyText } from "@/components/ui/money-text";

import { numberToCents } from "@/domain/money";
import { getAssetPricingMode, isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { cn } from "@/lib/utils";
import {
  calculateInvestmentPreview,
  getFixedIncomeRedemptionInfo,
  parseNumber,
  type InvestmentWizardState,
  type WizardMode,
} from "./wizard-state";
import type { PortfolioAsset } from "@/types";

export interface StepOrderProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
  cashAsset?: PortfolioAsset | null;
  usdRate?: number;
}

export function StepOrder({ state, onChange, cashAsset, usdRate }: StepOrderProps) {
  const cashAvailableBRL = cashAsset?.quantity ?? 0;

  const preview = useMemo(
    () => calculateInvestmentPreview(state, cashAvailableBRL, usdRate),
    [state, cashAvailableBRL, usdRate],
  );

  const parsedQty = parseNumber(state.quantityStr);
  const isCash = state.isCash || isCashAssetClass(state.assetClass);
  const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
  const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
  const pricingMode = getAssetPricingMode(
    state.selectedAsset ?? { ticker: state.ticker, asset_class: state.assetClass, notes: state.notes },
  );
  const isTotalValue = !isCash && (pricingMode === "total_value" || isFixedIncome);

  const fiInfo = useMemo(() => {
    if (!isTotalValue) return null;
    return getFixedIncomeRedemptionInfo(state.selectedAsset, state.date);
  }, [isTotalValue, state.selectedAsset, state.date]);

  const mode = state.mode;

  const operations = [
    {
      id: "buy",
      label: isTotalValue ? "Aporte / Aplicação" : "Compra / Aporte",
      icon: ArrowUpRight,
      activeClass: "border-primary bg-primary/10 text-primary-strong shadow-xs font-bold",
    },
    {
      id: "sell",
      label: isTotalValue ? "Resgate" : "Venda / Resgate",
      icon: ArrowDownLeft,
      activeClass: "border-negative/60 bg-negative/10 text-negative-strong shadow-xs font-bold",
    },
    {
      id: "dividend",
      label: isTotalValue ? "Rendimento / Cupom" : "Provento",
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

  const availableOperations = isTotalValue ? operations.filter((op) => op.id !== "split") : operations;

  return (
    <div className="flex flex-col gap-5">
      {/* Resumo do Ativo Selecionado */}
      <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/80 p-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-foreground">{state.ticker}</span>
            <Badge variant="muted" className="text-[10px]">
              {state.assetClass}
            </Badge>
            {isTotalValue && (
              <Badge variant="muted" className="text-[10px]">
                Valor Completo
              </Badge>
            )}
            {fiInfo?.isMatured && (
              <Badge variant="critical" className="text-[10px]">
                Vencido
              </Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {isTotalValue ? (
            <>
              <span>
                Saldo Aplicado:{" "}
                <strong className="font-mono font-medium text-foreground">
                  <MoneyText cents={numberToCents(fiInfo?.appliedCost ?? state.selectedAsset?.average_price ?? 0)} currency={state.currency} />
                </strong>
              </span>
              {fiInfo && fiInfo.grossValue > fiInfo.appliedCost && (
                <>
                  <span>
                    Saldo Bruto:{" "}
                    <strong className="font-mono font-medium text-positive-strong">
                      <MoneyText cents={numberToCents(fiInfo.grossValue)} currency={state.currency} />
                    </strong>
                  </span>
                  <span>
                    Líquido Estimado:{" "}
                    <strong className="font-mono font-medium text-foreground">
                      <MoneyText cents={numberToCents(fiInfo.netValue)} currency={state.currency} />
                    </strong>
                  </span>
                </>
              )}
            </>
          ) : (
            <span>
              Posição Atual: {state.selectedAsset?.quantity ?? 0} cotas · PM:{" "}
              <MoneyText cents={numberToCents(state.selectedAsset?.average_price ?? 0)} currency={state.currency} />
            </span>
          )}
        </div>
      </div>

      {/* Seletor de Tipo de Operação quando o ativo já existe na carteira */}
      {!isCash && state.selectedAsset && (
        <div className={cn("grid gap-2", availableOperations.length === 3 ? "grid-cols-3" : "grid-cols-2")} role="tablist" aria-label="Tipo de Operação">
          {availableOperations.map((op) => {
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
                  "flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-medium transition-all duration-150 cursor-pointer select-none active:scale-[0.98]",
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
            {isTotalValue ? (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="wizard-order-rf-aporte" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor do Aporte / Aplicação ({state.currency})
                </label>
                <MoneyInput
                  id="wizard-order-rf-aporte"
                  cents={state.totalCents || state.priceCents}
                  currency={state.currency}
                  onCentsChange={(cents) => onChange({ totalCents: cents, priceCents: cents })}
                  placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                  aria-label="Valor do aporte em renda fixa"
                />
              </div>
            ) : !isCash ? (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wizard-order-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quantidade de Cotas
                  </label>
                  <NumericInput
                    id="wizard-order-qty"
                    value={state.quantityStr}
                    onValueChange={(v) => onChange({ quantityStr: v, totalCents: 0 })}
                    placeholder="Ex: 10"
                    aria-label="Quantidade de cotas"
                    showCalculatorAction
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wizard-order-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preço por Cota ({state.currency})
                  </label>
                  <MoneyInput
                    id="wizard-order-price"
                    cents={state.priceCents}
                    currency={state.currency}
                    onCentsChange={(priceCents) => onChange({ priceCents, totalCents: 0 })}
                    placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
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
                  currency="BRL"
                  onCentsChange={(totalCents) => onChange({ totalCents })}
                  placeholder="R$ 0,00"
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
          {isTotalValue && (state.totalCents > 0 || state.priceCents > 0) ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Saldo aplicado após o aporte:</span>
                <span className="font-mono font-bold text-sm text-primary">
                  <MoneyText cents={numberToCents((state.selectedAsset?.average_price ?? 0) + (state.totalCents || state.priceCents) / 100)} currency={state.currency} />
                </span>
              </div>
            </div>
          ) : !isCash && parsedQty > 0 && state.priceCents > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Calculator className="size-3.5 text-primary" aria-hidden="true" />
                <span>Impacto no Preço Médio e Posição</span>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                <div className="flex flex-col gap-1 rounded-lg bg-surface-hover/50 p-2.5">
                  <span className="text-[11px] text-muted-foreground">Preço Médio</span>
                  <div className="flex items-center gap-1.5 font-mono font-semibold text-foreground">
                    <MoneyText cents={numberToCents(preview.currentAveragePrice)} currency={state.currency} />
                    <ArrowRight className="size-3 text-muted-foreground" aria-hidden="true" />
                    <span className="text-primary font-bold">
                      <MoneyText cents={numberToCents(preview.newAveragePrice)} currency={state.currency} />
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1 rounded-lg bg-surface-hover/50 p-2.5">
                  <span className="text-[11px] text-muted-foreground">Total Investido na Ordem</span>
                  <div className="flex flex-col">
                    {state.currency === "USD" && preview.totalOrderValueNative !== undefined ? (
                      <>
                        <span className="font-mono text-sm font-bold text-foreground">
                          <MoneyText cents={numberToCents(preview.totalOrderValueNative)} currency="USD" />
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          (≈ <MoneyText cents={numberToCents(preview.totalOrderValueBRL)} currency="BRL" />)
                        </span>
                      </>
                    ) : (
                      <span className="font-mono text-sm font-bold text-foreground">
                        <MoneyText cents={numberToCents(preview.totalOrderValueBRL)} currency="BRL" />
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {/* Sincronização com Caixa & Aporte do Mês */}
          <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-surface/40 p-3.5">
            <label className="flex items-center gap-2.5 cursor-pointer text-xs">
              <Checkbox
                checked={state.syncCash}
                onCheckedChange={(checked) => onChange({ syncCash: !!checked })}
              />
              <span className="text-foreground">Debitar valor do Caixa (saldo: R$ {cashAvailableBRL.toFixed(2)})</span>
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
            {isTotalValue ? (
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label htmlFor="wizard-sell-rf-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Valor a Resgatar ({state.currency})
                </label>
                <MoneyInput
                  id="wizard-sell-rf-amount"
                  cents={state.totalCents || state.priceCents}
                  currency={state.currency}
                  onCentsChange={(cents) => onChange({ totalCents: cents, priceCents: cents })}
                  placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                  aria-label="Valor a resgatar em renda fixa"
                />

                {/* Atalhos rápidos de percentual do saldo total */}
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-[11px] text-muted-foreground">Resgatar:</span>
                  {[
                    { label: "25%", pct: 0.25 },
                    { label: "50%", pct: 0.5 },
                    { label: "75%", pct: 0.75 },
                    { label: "100% (Total)", pct: 1 },
                  ].map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => {
                        const targetBalance = fiInfo?.grossValue || state.selectedAsset?.average_price || 0;
                        const cents = Math.round(targetBalance * s.pct * 100);
                        onChange({ totalCents: cents, priceCents: cents });
                      }}
                      className="rounded-md border border-border/70 bg-surface px-2 py-0.5 text-[11px] font-medium text-foreground hover:bg-surface-hover transition-colors cursor-pointer"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-1.5 pt-2 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <label htmlFor="wizard-sell-rf-cost" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Custo Original da Aplicação ({state.currency})
                    </label>
                    <span className="text-[10px] text-muted-foreground">Base contábil</span>
                  </div>
                  <MoneyInput
                    id="wizard-sell-rf-cost"
                    cents={state.appliedCostCents}
                    currency={state.currency}
                    onCentsChange={(cents) => onChange({ appliedCostCents: cents })}
                    placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                    aria-label="Custo original da aplicação do lote"
                  />
                  <span className="text-[10px] text-muted-foreground">
                    Valor original investido neste lote (utilizado para apurar o lucro contábil e a rentabilidade final).
                  </span>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wizard-sell-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Quantidade a Vender
                  </label>
                  <NumericInput
                    id="wizard-sell-qty"
                    value={state.quantityStr}
                    onValueChange={(v) => onChange({ quantityStr: v })}
                    placeholder={`Máx: ${state.selectedAsset?.quantity ?? 0}`}
                    aria-label="Quantidade a vender"
                    showCalculatorAction
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="wizard-sell-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Preço de Venda ({state.currency})
                  </label>
                  <MoneyInput
                    id="wizard-sell-price"
                    cents={state.priceCents}
                    currency={state.currency}
                    onCentsChange={(priceCents) => onChange({ priceCents })}
                    placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Data {isTotalValue ? "do Resgate" : "da Venda"}
              </label>
              <DatePicker
                value={state.date}
                onValueChange={(date) => onChange({ date })}
              />
            </div>
          </div>

          {/* Prévia de Resgate e Liquidação */}
          {isTotalValue && (state.totalCents > 0 || state.priceCents > 0) ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Valor Bruto do Resgate:</span>
                <span className="font-mono font-bold text-sm text-foreground">
                  <MoneyText cents={state.totalCents || state.priceCents} currency={state.currency} />
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Custo Original Aplicado:</span>
                <span className="font-mono font-medium text-foreground">
                  <MoneyText
                    cents={state.appliedCostCents > 0 ? state.appliedCostCents : numberToCents(fiInfo?.appliedCost ?? 0)}
                    currency={state.currency}
                  />
                </span>
              </div>
              {preview.cashCreditBRL !== undefined && state.syncCash && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Crédito Líquido no Caixa:</span>
                  <span className="font-mono font-bold text-sm text-positive-strong">
                    <MoneyText cents={numberToCents(preview.cashCreditBRL)} currency="BRL" />
                  </span>
                </div>
              )}
              {preview.realizedPnl !== undefined && preview.realizedPnl > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Rendimento Realizado:</span>
                  <span className="font-mono font-bold text-xs text-positive-strong">
                    +<MoneyText cents={numberToCents(preview.realizedPnl)} currency={state.currency} /> ({preview.realizedPnlPct?.toFixed(1)}%)
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs border-t border-border/60 pt-2">
                <span className="text-muted-foreground">Saldo aplicado residual:</span>
                <span className="font-mono font-bold text-xs text-foreground">
                  {preview.newQuantity === 0 ? (
                    <Badge variant="muted" className="text-[10px]">Posição Encerrada</Badge>
                  ) : (
                    <MoneyText cents={numberToCents(preview.newAveragePrice)} currency={state.currency} />
                  )}
                </span>
              </div>
            </div>
          ) : parsedQty > 0 && state.priceCents > 0 && preview.realizedPnl !== undefined ? (
            <div className="flex flex-col gap-2 rounded-xl border border-border/80 bg-surface/90 p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Resultado Realizado:</span>
                <span
                  className={`font-mono font-bold text-sm ${
                    preview.realizedPnl >= 0 ? "text-positive-strong" : "text-negative-strong"
                  }`}
                >
                  {preview.realizedPnl >= 0 ? "+" : ""}
                  <MoneyText cents={numberToCents(preview.realizedPnl)} currency={state.currency} /> ({preview.realizedPnlPct?.toFixed(1)}%)
                </span>
              </div>

              {state.assetClass === "Ações" && state.currency === "BRL" && (
                <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground">
                  <Info className="size-3.5 text-primary shrink-0" aria-hidden="true" />
                  <span>Isenção de IRPF se o total de vendas de ações no mês for até R$ 20.000,00.</span>
                </div>
              )}
            </div>
          ) : null}

          <label className="flex items-center gap-2.5 cursor-pointer text-xs rounded-xl border border-border/60 bg-surface/40 p-3.5">
            <Checkbox
              checked={state.syncCash}
              onCheckedChange={(checked) => onChange({ syncCash: !!checked })}
            />
            <span className="text-foreground">Creditar o valor da venda diretamente no Caixa da carteira (R$)</span>
          </label>
        </div>
      )}

      {/* 3. MODO PROVENTO */}
      {mode === "dividend" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wizard-div-amount" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Valor Total Recebido ({state.currency})
            </label>
            <MoneyInput
              id="wizard-div-amount"
              cents={state.totalCents}
              currency={state.currency}
              onCentsChange={(totalCents) => onChange({ totalCents })}
              placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
            />
          </div>

          {/* Alternador de Modo de Data: Diário vs Extrato do Mês */}
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Modo de Registro
            </span>
            <div className="flex items-center gap-1 rounded-xl bg-surface-hover/60 p-1 border border-border/60">
              <button
                type="button"
                onClick={() => onChange({ dividendEntryMode: "daily" })}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  state.dividendEntryMode === "daily"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Diario (Data Exata)
              </button>
              <button
                type="button"
                onClick={() => onChange({ dividendEntryMode: "monthly" })}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  state.dividendEntryMode === "monthly"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Extrato do Mes
              </button>
            </div>

            {state.dividendEntryMode === "daily" ? (
              <DatePicker
                value={state.date}
                onValueChange={(date) => onChange({ date })}
              />
            ) : (
              <div className="flex flex-col gap-1">
                <MonthPicker
                  value={state.month}
                  onValueChange={(month) => onChange({ month })}
                />
                <p className="text-[10px] text-muted-foreground">
                  Gravado como {state.month}-01 com tag [MENSAL]. Aparece no extrato e calendario do mes selecionado.
                </p>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer text-xs rounded-xl border border-border/60 bg-surface/40 p-3.5">
            <Checkbox
              checked={state.syncCash}
              onCheckedChange={(checked) => onChange({ syncCash: !!checked })}
            />
            <span className="text-foreground">Creditar o rendimento diretamente no Caixa da carteira (R$)</span>
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
                  currency={state.currency}
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
