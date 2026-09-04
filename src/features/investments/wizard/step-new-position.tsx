import { useState } from "react";
import { Badge, Checkbox, Input, MoneyInput, NumericInput, Select } from "@/components/ui";
import { isCashAssetClass, isFixedIncomeClass, isTesouroAsset } from "@/domain/portfolio/valuation";
import { DEFAULT_SECTORS_BY_CLASS } from "@/domain/portfolio/tickers-catalog";
import type { AssetCurrency } from "@/types";
import { FixedIncomeFormFields } from "../components/fixed-income-form-fields";
import type { InvestmentWizardState } from "./wizard-state";

export interface StepNewPositionProps {
  state: InvestmentWizardState;
  onChange: (patch: Partial<InvestmentWizardState>) => void;
}

const CLASSES_WITH_CURRENCY = new Set(["BDRs", "Internacional"]);
const CLASSES_WITHOUT_DIVIDENDS = new Set(["Cripto", "Caixa"]);

const CURRENCY_OPTIONS: { value: AssetCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (Reais)" },
  { value: "USD", label: "USD (Dólares)" },
];

export function StepNewPosition({ state, onChange }: StepNewPositionProps) {
  const isCash = isCashAssetClass(state.assetClass) || state.ticker.toUpperCase() === "CAIXA";
  const isTesouro = isTesouroAsset(state.ticker, state.assetClass);
  const isFixedIncome = isFixedIncomeClass(state.assetClass) || isTesouro;
  const isTotalValueMode = !isCash && isFixedIncome;
  const isCrypto = state.assetClass === "Cripto";
  const needsCurrencyField = CLASSES_WITH_CURRENCY.has(state.assetClass);
  const recommendedSectors = DEFAULT_SECTORS_BY_CLASS[state.assetClass] ?? [];

  const hasStoredDividends =
    (state.accumulatedDividendsCents ?? 0) > 0 ||
    (state.estimatedDividendPerShareCents ?? 0) > 0;

  const [distributesInterest, setDistributesInterest] = useState(
    isFixedIncome ? hasStoredDividends : false,
  );
  const [showDividendPanel, setShowDividendPanel] = useState(hasStoredDividends);
  const [showNotes, setShowNotes] = useState(Boolean(state.notes && state.notes.trim().length > 0));

  return (
    <div className="flex flex-col gap-4">
      {/* Resumo Compacto da Identificação (Evita repetição de Ticker e Classe) */}
      <div className="flex items-center justify-between rounded-xl border border-border/80 bg-surface/80 p-3 sm:p-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-base font-bold text-foreground truncate">
            {state.ticker || "NOVO ATIVO"}
          </span>
          <Badge variant="muted" className="text-xs shrink-0 font-medium">
            {state.assetClass}
          </Badge>
          {state.currency !== "BRL" && (
            <Badge variant="muted" className="text-xs shrink-0 font-mono">
              {state.currency}
            </Badge>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0 font-mono">
          Passo 2 de 4
        </span>
      </div>

      {/* Seletor de Moeda (Apenas para BDRs e Internacional) */}
      {needsCurrencyField && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Moeda de Negociação
          </span>
          <Select
            value={state.currency}
            onValueChange={(currency) => onChange({ currency: currency as AssetCurrency })}
            options={CURRENCY_OPTIONS}
          />
        </div>
      )}

      {/* Setor / Segmento para Renda Variável (Opcional) */}
      {!isCash && !isFixedIncome && !isCrypto && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="wizard-new-sector" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Setor / Segmento <span className="text-muted-foreground/70 font-normal">(opcional)</span>
          </label>
          <Input
            id="wizard-new-sector"
            value={state.sector}
            onChange={(e) => onChange({ sector: e.target.value })}
            placeholder="Ex: Financeiro / Bancos, Imobiliário / Logística..."
          />
          {recommendedSectors.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[11px] text-muted-foreground">Sugestões:</span>
              {recommendedSectors.slice(0, 4).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChange({ sector: s })}
                  className={`rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer ${
                    state.sector === s
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "border border-border/70 bg-surface-hover/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bloco de Posição Inicial */}
      {isCash ? (
        <div className="rounded-xl border border-border/80 bg-surface/60 p-4 flex flex-col gap-3">
          <span className="text-xs font-semibold text-foreground">Saldo Inicial em Caixa</span>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wizard-new-cash" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Saldo em Conta (R$)
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
                Valor Aplicado ({state.currency})
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
              <span className="text-[11px] text-muted-foreground">Aporte inicial</span>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-new-current-price" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Saldo Atual ({state.currency})
              </label>
              <MoneyInput
                id="wizard-new-current-price"
                cents={state.totalCents}
                currency={state.currency}
                onCentsChange={(totalCents) => onChange({ totalCents })}
                placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Preço atual ou saldo"
              />
              <span className="text-[11px] text-muted-foreground">Saldo do extrato bancário</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/80 bg-surface/60 p-4 flex flex-col gap-4">
          <span className="text-xs font-semibold text-foreground">Posição Inicial em Carteira</span>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-new-qty" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quantidade Inicial de Cotas
              </label>
              <NumericInput
                id="wizard-new-qty"
                value={state.quantityStr}
                onValueChange={(v) => onChange({ quantityStr: v })}
                placeholder="Ex: 100"
                aria-label="Quantidade inicial de cotas"
                showCalculatorAction
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="wizard-new-avgprice" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Preço Médio por Cota ({state.currency})
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

      {/* Bloco de Parâmetros de Renda Fixa e Tesouro Direto (Fase 63/72) */}
      {isFixedIncome && !isCash && (
        <FixedIncomeFormFields
          values={{
            rateType: state.fixedIncomeRateType,
            rateValue: state.fixedIncomeRateValue,
            baseDate: state.fixedIncomeBaseDate,
            initialInvestmentDate: state.fixedIncomeInitialInvestmentDate || null,
            maturityDate: state.fixedIncomeMaturityDate || null,
            isTaxExempt: state.fixedIncomeIsTaxExempt,
            manualTaxRatePct: state.fixedIncomeManualTaxRatePct,
          }}
          onChange={(patch) => {
            const statePatch: Partial<InvestmentWizardState> = {};
            if (patch.rateType !== undefined) statePatch.fixedIncomeRateType = patch.rateType;
            if (patch.rateValue !== undefined) statePatch.fixedIncomeRateValue = patch.rateValue;
            if (patch.baseDate !== undefined) statePatch.fixedIncomeBaseDate = patch.baseDate;
            if (patch.initialInvestmentDate !== undefined)
              statePatch.fixedIncomeInitialInvestmentDate = patch.initialInvestmentDate ?? "";
            if (patch.maturityDate !== undefined) statePatch.fixedIncomeMaturityDate = patch.maturityDate ?? "";
            if (patch.isTaxExempt !== undefined) statePatch.fixedIncomeIsTaxExempt = patch.isTaxExempt;
            if (patch.manualTaxRatePct !== undefined) statePatch.fixedIncomeManualTaxRatePct = patch.manualTaxRatePct;
            onChange(statePatch);
          }}
          idPrefix="wizard-fi"
          isTesouro={isTesouro}
        />
      )}

      {/* RF / Tesouro: toggle "Distribui juros/cupons" controla o painel de proventos */}
      {isFixedIncome && !isCash && (
        <div className="flex flex-col gap-2">
          <Checkbox
            id="wizard-fi-distributes-interest"
            checked={distributesInterest}
            onCheckedChange={(v) => {
              const checked = Boolean(v);
              setDistributesInterest(checked);
              setShowDividendPanel(checked);
              if (!checked) {
                onChange({
                  accumulatedDividendsCents: 0,
                  estimatedDividendPerShareCents: 0,
                });
              }
            }}
            label="Distribui juros / cupons periodicamente (NTN-B, CRI, CRA, debêntures)"
          />
          {distributesInterest && (
            <p className="pl-6 text-[11px] text-muted-foreground">
              Informe os proventos anteriores ao cadastro para alimentar o Yield on Cost e a Bola de Neve.
            </p>
          )}
        </div>
      )}

      {/* Ações / FIIs / ETFs / BDRs: link colapsável para proventos anteriores */}
      {!isFixedIncome && !isCash && !isCrypto && !showDividendPanel && (
        <button
          type="button"
          onClick={() => setShowDividendPanel(true)}
          className="self-start text-xs text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
        >
          + Adicionar proventos anteriores ao cadastro (opcional)
        </button>
      )}

      {/* Painel de Proventos Anteriores (se ativo) */}
      {showDividendPanel && !CLASSES_WITHOUT_DIVIDENDS.has(state.assetClass) && (
        <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-surface/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Proventos Anteriores ao Cadastro
            </span>
            {!isFixedIncome && (
              <button
                type="button"
                onClick={() => {
                  setShowDividendPanel(false);
                  onChange({
                    accumulatedDividendsCents: 0,
                    estimatedDividendPerShareCents: 0,
                  });
                }}
                className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Ocultar
              </button>
            )}
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
                Dividendo Estimado / Cota / Mês ({state.currency})
              </label>
              <MoneyInput
                id="wizard-estimated-div-per-share"
                cents={state.estimatedDividendPerShareCents}
                currency={state.currency}
                onCentsChange={(estimatedDividendPerShareCents) => onChange({ estimatedDividendPerShareCents })}
                placeholder={state.currency === "USD" ? "$ 0.00" : "R$ 0,00"}
                aria-label="Dividendo mensal estimado por cota para cálculo da Bola de Neve"
              />
            </div>
          </div>
        </div>
      )}

      {/* Notas / Observações (Colapsável) */}
      {!showNotes ? (
        <button
          type="button"
          onClick={() => setShowNotes(true)}
          className="self-start text-xs text-muted-foreground hover:text-foreground underline transition-colors cursor-pointer"
        >
          + Adicionar anotações ou descrição (opcional)
        </button>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="wizard-new-notes" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Anotações / Descrição <span className="text-muted-foreground/70 font-normal">(opcional)</span>
            </label>
            <button
              type="button"
              onClick={() => {
                setShowNotes(false);
                onChange({ notes: "" });
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Ocultar
            </button>
          </div>
          <Input
            id="wizard-new-notes"
            value={state.notes}
            onChange={(e) => onChange({ notes: e.target.value })}
            placeholder="Ex: Tese de investimento, corretora..."
          />
        </div>
      )}
    </div>
  );
}
