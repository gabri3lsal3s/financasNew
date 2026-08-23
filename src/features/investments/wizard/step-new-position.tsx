import { Input, MoneyInput, Select } from "@/components/ui";
import { isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { cn } from "@/lib/utils";
import type { AssetCurrency } from "@/types";
import type { InvestmentWizardState } from "./wizard-state";

export interface StepNewPositionProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
}

const ASSET_CLASS_OPTIONS = [
  { value: "Ações", label: "Ações" },
  { value: "FIIs", label: "FIIs / Imobiliário" },
  { value: "ETFs", label: "ETFs / Fundos de Índice" },
  { value: "BDRs", label: "BDRs" },
  { value: "Renda Fixa", label: "Renda Fixa" },
  { value: "Cripto", label: "Criptomoedas" },
  { value: "Caixa", label: "Caixa / Reserva" },
  { value: "Internacional", label: "Internacional (EUA)" },
];

const CURRENCY_OPTIONS: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (Reais)" },
  { value: "USD", label: "USD (Dólares)" },
];

export function StepNewPosition({ state, onChange }: StepNewPositionProps) {
  const isCash = isCashAssetClass(state.assetClass) || state.ticker.toUpperCase() === "CAIXA";
  const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
  const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
  const tesouroMode = state.pricingMode ?? "total_value";
  const isTotalValueMode = !isCash && isFixedIncome && (!isTesouro || tesouroMode === "total_value");

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Código do Ativo */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-new-ticker" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Código do Ativo (Ticker)
          </label>
          <Input
            id="wizard-new-ticker"
            value={state.ticker}
            onChange={(e) => onChange({ ticker: e.target.value.toUpperCase().trim() })}
            placeholder={isCash ? "CAIXA" : "Ex: CDB BANCO INTER, PETR4, TESOURO SELIC…"}
            className="font-mono uppercase font-bold"
          />
        </div>

        {/* Classe do Ativo */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Classe do Ativo
          </span>
          <Select
            value={state.assetClass}
            onValueChange={(assetClass) => onChange({ assetClass, isCash: isCashAssetClass(assetClass) })}
            options={ASSET_CLASS_OPTIONS}
          />
        </div>

        {/* Moeda */}
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Moeda de Negociação
          </span>
          <Select
            value={state.currency}
            onValueChange={(currency) => onChange({ currency: currency as AssetCurrency })}
            options={CURRENCY_OPTIONS}
          />
        </div>
      </div>

      {/* Seletor de Modo de Precificação para Tesouro Direto */}
      {isTesouro && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Modo de Precificação do Tesouro</span>
            <span className="text-[11px] text-muted-foreground">Padrão: Valor Completo</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChange({ pricingMode: "total_value" })}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left flex flex-col gap-0.5 cursor-pointer",
                tesouroMode === "total_value"
                  ? "border-primary bg-surface shadow-xs text-foreground font-semibold"
                  : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-xs font-semibold">Valor Completo (Padrão RF)</span>
              <span className="text-[10px] text-muted-foreground">Preço inicial e saldo atual (sem cotas)</span>
            </button>
            <button
              type="button"
              onClick={() => onChange({ pricingMode: "unit_price" })}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs font-medium transition-all text-left flex flex-col gap-0.5 cursor-pointer",
                tesouroMode === "unit_price"
                  ? "border-primary bg-surface shadow-xs text-foreground font-semibold"
                  : "border-border/60 bg-surface/50 text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="text-xs font-semibold">Preço Médio / Cotas</span>
              <span className="text-[10px] text-muted-foreground">Frações de títulos e preço unitário</span>
            </button>
          </div>
        </div>
      )}

      {/* Bloco de Posição Inicial */}
      {isCash ? (
        <div className="rounded-xl border border-border/80 bg-surface/60 p-4 flex flex-col gap-4">
          <span className="text-xs font-semibold text-foreground">Saldo Inicial em Caixa</span>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wizard-new-cash" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Saldo Inicial em Caixa (R$)
            </label>
            <MoneyInput
              id="wizard-new-cash"
              cents={state.totalCents}
              onCentsChange={(totalCents) => onChange({ totalCents })}
              placeholder="R$ 0,00"
            />
          </div>
        </div>
      ) : isTotalValueMode ? (
        <div className="rounded-xl border border-border/80 bg-surface/60 p-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              {isTesouro ? "Posição Inicial (Tesouro Direto)" : "Posição Inicial (Renda Fixa)"}
            </span>
            <span className="text-[11px] text-muted-foreground">Valor Completo</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-new-initial-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Inicial / Valor Aplicado ({state.currency})
              </label>
              <MoneyInput
                id="wizard-new-initial-price"
                cents={state.priceCents}
                currency={state.currency}
                onCentsChange={(priceCents) => {
                  onChange({
                    priceCents,
                    totalCents: state.totalCents === 0 || state.totalCents === state.priceCents ? priceCents : state.totalCents,
                  });
                }}
                placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Preço inicial investido"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-new-current-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Atual / Saldo Final ({state.currency})
              </label>
              <MoneyInput
                id="wizard-new-current-price"
                cents={state.totalCents}
                currency={state.currency}
                onCentsChange={(totalCents) => onChange({ totalCents })}
                placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Preço atual ou saldo"
              />
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Ativo de Renda Fixa precificado por valor investido e saldo atual (sem quantidade de cotas).
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface/60 p-4 flex flex-col gap-4">
          <span className="text-xs font-semibold text-foreground">Posição Inicial em Carteira</span>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-new-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantidade Inicial de Cotas
              </label>
              <Input
                id="wizard-new-qty"
                type="text"
                inputMode="decimal"
                value={state.quantityStr}
                onChange={(e) => onChange({ quantityStr: e.target.value })}
                placeholder="Ex: 100"
                className="font-mono text-base"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-new-avgprice" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Médio de Aquisição ({state.currency})
              </label>
              <MoneyInput
                id="wizard-new-avgprice"
                cents={state.priceCents}
                currency={state.currency}
                onCentsChange={(priceCents) => onChange({ priceCents })}
                placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
              />
            </div>
          </div>
        </div>
      )}

      {/* Notas / Observações */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="wizard-new-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Notas ou Descrição (Opcional)
        </label>
        <Input
          id="wizard-new-notes"
          value={state.notes}
          onChange={(e) => onChange({ notes: e.target.value })}
          placeholder="Ex: Tese de investimento, corretora..."
        />
      </div>

      {/* Proventos Anteriores ao Cadastro — oculto para ativos de caixa */}
      {!isCash && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/50 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-foreground">
              Proventos Anteriores ao Cadastro (Opcional)
            </span>
            <span className="text-[11px] text-muted-foreground">
              Informe proventos recebidos antes deste cadastro. Eles alimentam o Yield on Cost e a Bola de Neve, mas nao aparecem no extrato mensal nem no calendario.
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="wizard-accumulated-dividends"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Total Acumulado Recebido ({state.currency})
              </label>
              <MoneyInput
                id="wizard-accumulated-dividends"
                cents={state.accumulatedDividendsCents}
                currency={state.currency}
                onCentsChange={(accumulatedDividendsCents) => onChange({ accumulatedDividendsCents })}
                placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Total de proventos acumulados anteriores ao cadastro"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="wizard-estimated-div-per-share"
                className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                Dividendo Estimado / Cota / Mes ({state.currency})
              </label>
              <MoneyInput
                id="wizard-estimated-div-per-share"
                cents={state.estimatedDividendPerShareCents}
                currency={state.currency}
                onCentsChange={(estimatedDividendPerShareCents) => onChange({ estimatedDividendPerShareCents })}
                placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Dividendo mensal estimado por cota para calculo da Bola de Neve"
              />
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground">
            O dividendo estimado por cota e usado apenas quando nao ha lancamentos periodicos registrados para este ativo.
          </p>
        </div>
      )}
    </div>
  );
}
