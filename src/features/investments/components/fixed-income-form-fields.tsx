import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { DatePicker, PercentInput, Select, Checkbox } from "@/components/ui";
import { parseDecimalNumber } from "@/domain/money";
import { todayISO } from "@/domain/debts";
import type { FixedIncomeRateType } from "@/types";

export interface FixedIncomeFormFieldsValues {
  rateType: FixedIncomeRateType;
  rateValue: number | string;
  baseDate: string;
  initialInvestmentDate?: string | null;
  maturityDate?: string | null;
  isTaxExempt: boolean;
  manualTaxRatePct?: number | null;
}

export interface FixedIncomeFormFieldsProps {
  values: FixedIncomeFormFieldsValues;
  onChange: (patch: Partial<FixedIncomeFormFieldsValues>) => void;
  /** Prefixo opcional de ID para acessibilidade única no DOM. */
  idPrefix?: string;
  isTesouro?: boolean;
}

const RATE_TYPE_OPTIONS: { value: FixedIncomeRateType; label: string }[] = [
  { value: "cdi", label: "Pós-fixado (% do CDI)" },
  { value: "selic", label: "Pós-fixado (% da Selic)" },
  { value: "pre", label: "Prefixado (% ao ano)" },
  { value: "ipca", label: "Inflação (IPCA + % ao ano)" },
];

const TAX_RATE_OPTIONS = [
  { value: "auto", label: "Automático (pela data de aplicação)" },
  { value: "15", label: "15,0% (acima de 2 anos / 720 dias)" },
  { value: "17.5", label: "17,5% (entre 1 e 2 anos / 361 a 720 dias)" },
  { value: "20", label: "20,0% (entre 6 meses e 1 ano / 181 a 360 dias)" },
  { value: "22.5", label: "22,5% (até 6 meses / 180 dias)" },
];

/**
 * Subcomponente canônico para parâmetros de Renda Fixa e Tesouro Direto (Fase 63/72).
 * Reutilizado no Wizard de Ativos, AssetEditDialog e AssetFormDialog (Regra DRY §4).
 *
 * Campos sempre visíveis:
 *   - Indexador / Regime
 *   - Taxa Contratada
 *   - Data de Vencimento (opcional)
 *
 * Campos no acordeão "Configurações avançadas" (colapsado por padrão):
 *   - Data-Base / Marco Zero (D₀)
 *   - Aplicação Original (IR)
 *   - Alíquota Fixa de IR (opcional)
 *
 * Isenção de IR: ocultada para Tesouro Direto (nunca isento).
 */
export function FixedIncomeFormFields({
  values,
  onChange,
  idPrefix = "fi",
  isTesouro = false,
}: FixedIncomeFormFieldsProps) {
  // Accordion: expande automaticamente se já houver dados preenchidos
  const hasAdvancedData =
    Boolean(values.initialInvestmentDate) ||
    (Boolean(values.baseDate) && values.baseDate !== todayISO()) ||
    (values.manualTaxRatePct !== undefined && values.manualTaxRatePct !== null);

  const [showAdvanced, setShowAdvanced] = useState(hasAdvancedData);

  const getRateSuffix = () => {
    switch (values.rateType) {
      case "cdi":
        return "% do CDI";
      case "selic":
        return "% da Selic";
      case "pre":
        return "% a.a.";
      case "ipca":
        return "% a.a. + IPCA";
      default:
        return "%";
    }
  };

  const getRateLabel = () => {
    switch (values.rateType) {
      case "cdi":
        return "Percentual do CDI (%)";
      case "selic":
        return "Percentual da Selic (%)";
      case "pre":
        return "Taxa Anual Prefixada (% a.a.)";
      case "ipca":
        return "Taxa Real Adicional (% a.a. + IPCA)";
      default:
        return "Taxa Contratada";
    }
  };

  const numericRateValue =
    typeof values.rateValue === "number"
      ? values.rateValue
      : parseDecimalNumber(values.rateValue);

  const selectedTaxRateValue =
    values.manualTaxRatePct !== undefined && values.manualTaxRatePct !== null
      ? String(values.manualTaxRatePct)
      : "auto";

  const handleRateTypeChange = (newRateType: FixedIncomeRateType) => {
    const patch: Partial<FixedIncomeFormFieldsValues> = { rateType: newRateType };
    // Se a taxa estiver zerada ou vazia, pré-preenche sugestão inteligente
    if (!numericRateValue || numericRateValue === 0) {
      if (newRateType === "cdi" || newRateType === "selic") {
        patch.rateValue = 100;
      } else if (newRateType === "pre") {
        patch.rateValue = 12.0;
      } else if (newRateType === "ipca") {
        patch.rateValue = 6.0;
      }
    }
    onChange(patch);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          {isTesouro ? "Parâmetros do Tesouro Direto" : "Parâmetros de Renda Fixa"}
        </span>
        <span className="text-[11px] text-muted-foreground">Cálculo &amp; Tributação</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Indexador */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Indexador / Regime</span>
          <Select
            value={values.rateType}
            onValueChange={(rateType) => handleRateTypeChange(rateType as FixedIncomeRateType)}
            options={RATE_TYPE_OPTIONS}
          />
          <span className="text-[11px] text-muted-foreground">Referência da taxa de rendimento</span>
        </div>

        {/* Taxa Acordada */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-rate-value`} className="text-xs font-semibold text-foreground">
            {getRateLabel()}
          </label>
          <PercentInput
            id={`${idPrefix}-rate-value`}
            value={numericRateValue}
            onValueChange={(rateValue) => onChange({ rateValue })}
            suffix={getRateSuffix()}
            aria-label={getRateLabel()}
          />
          <span className="text-[11px] text-muted-foreground">Taxa pactuada na contratação</span>
        </div>

        {/* Data-Base / Início do Rendimento (D₀) — SEMPRE VISÍVEL */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Data da Aplicação / Início dos Juros (D&#8320;)</span>
          <DatePicker
            value={values.baseDate}
            onValueChange={(baseDate) => {
              const patch: Partial<FixedIncomeFormFieldsValues> = { baseDate };
              if (!values.initialInvestmentDate) {
                patch.initialInvestmentDate = baseDate;
              }
              onChange(patch);
            }}
            placeholder="Selecione a data de início"
            ariaLabel="Data de início para contagem dos juros"
          />
          <span className="text-[11px] text-muted-foreground">Data em que os juros começam a render</span>
        </div>

        {/* Data de Vencimento — sempre visível */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            Data de Vencimento <span className="text-muted-foreground/80 font-normal">(opcional)</span>
          </span>
          <DatePicker
            value={values.maturityDate ?? ""}
            onValueChange={(maturityDate) => onChange({ maturityDate: maturityDate || null })}
            placeholder="dd/mm/aaaa"
            ariaLabel="Data de vencimento do título"
          />
          <span className="text-[11px] text-muted-foreground">Congela o rendimento e aciona o Radar de Vencimentos</span>
        </div>

        {/* Isenção de IR — oculto para Tesouro Direto (nunca isento) */}
        {!isTesouro && (
          <div className="flex flex-col justify-center gap-1 sm:col-span-2 sm:pt-1">
            <Checkbox
              id={`${idPrefix}-is-tax-exempt`}
              checked={values.isTaxExempt}
              onCheckedChange={(isTaxExempt) => onChange({ isTaxExempt })}
              label="Isento de IR (LCI, LCA, CRI, CRA)"
            />
            <span className="pl-6 text-[11px] text-muted-foreground">
              Aplica alíquota zero de IR no resgate e relatórios
            </span>
          </div>
        )}
      </div>

      {/* Configurações avançadas — acordeão colapsado por padrão */}
      <div className="border-t border-border/40 pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced((prev) => !prev)}
          className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-expanded={showAdvanced}
        >
          <span>Configurações avançadas de tributação</span>
          {showAdvanced ? (
            <ChevronUp className="size-3.5" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5" aria-hidden="true" />
          )}
        </button>

        {showAdvanced && (
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Data de Aplicação Original (IR) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                Aplicação Original para IR <span className="text-muted-foreground/80 font-normal">(opcional)</span>
              </span>
              <DatePicker
                value={values.initialInvestmentDate ?? ""}
                onValueChange={(initialInvestmentDate) =>
                  onChange({ initialInvestmentDate: initialInvestmentDate || null })
                }
                placeholder="dd/mm/aaaa"
                ariaLabel="Data da primeira aplicação para contagem de IR"
              />
              <span className="text-[11px] text-muted-foreground">Base para a tabela regressiva de IR (22,5% a 15%)</span>
            </div>

            {/* Alíquota de IR Manual */}
            {!values.isTaxExempt && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  Alíquota Vigente de IR <span className="text-muted-foreground/80 font-normal">(opcional)</span>
                </span>
                <Select
                  value={selectedTaxRateValue}
                  onValueChange={(val) => {
                    onChange({
                      manualTaxRatePct: val === "auto" ? null : Number(val),
                    });
                  }}
                  options={TAX_RATE_OPTIONS}
                />
                <span className="text-[11px] text-muted-foreground">
                  Fixe a alíquota caso não saiba a data exata de aplicação
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
