import { Input, MoneyInput, Select } from "@/components/ui";
import { isCashAssetClass } from "@/domain/portfolio/valuation";
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
  const isCash = isCashAssetClass(state.assetClass);

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
            placeholder="Ex: WEGE3"
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

      <div className="rounded-xl border border-border/80 bg-surface/60 p-4 flex flex-col gap-4">
        <span className="text-xs font-semibold text-foreground">Posição Inicial em Carteira</span>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {!isCash ? (
            <>
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
                  onCentsChange={(priceCents) => onChange({ priceCents })}
                  placeholder="R$ 0,00"
                />
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-1.5 sm:col-span-2">
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
          )}
        </div>
      </div>

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
    </div>
  );
}
