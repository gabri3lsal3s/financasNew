import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Checkbox,
  DatePicker,
  FormField,
  PercentInput,
  Select,
} from "@/components/ui";
import { parseDecimalNumber } from "@/domain/money";
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

const RATE_SUFFIX_MAP: Record<FixedIncomeRateType, string> = {
  cdi: "% do CDI",
  selic: "% da Selic",
  pre: "% a.a.",
  ipca: "% a.a. + IPCA",
};

const RATE_LABEL_MAP: Record<FixedIncomeRateType, string> = {
  cdi: "Percentual do CDI (%)",
  selic: "Percentual da Selic (%)",
  pre: "Taxa Anual Prefixada (% a.a.)",
  ipca: "Taxa Real Adicional (% a.a. + IPCA)",
};

/**
 * Subcomponente canônico para parâmetros de Renda Fixa e Tesouro Direto (Fase 63/72).
 */
export function FixedIncomeFormFields({
  values,
  onChange,
  idPrefix = "fi",
  isTesouro = false,
}: FixedIncomeFormFieldsProps) {
  const hasManualTaxRate =
    values.manualTaxRatePct !== undefined && values.manualTaxRatePct !== null;

  const rateSuffix = RATE_SUFFIX_MAP[values.rateType] ?? "%";
  const rateLabel = RATE_LABEL_MAP[values.rateType] ?? "Taxa Contratada";
  const numericRateValue =
    typeof values.rateValue === "number" ? values.rateValue : parseDecimalNumber(values.rateValue);
  const selectedTaxRateValue =
    values.manualTaxRatePct !== undefined && values.manualTaxRatePct !== null
      ? String(values.manualTaxRatePct)
      : "auto";

  const handleRateTypeChange = (newRateType: FixedIncomeRateType) => {
    const patch: Partial<FixedIncomeFormFieldsValues> = { rateType: newRateType };
    if (!numericRateValue || numericRateValue === 0) {
      patch.rateValue = newRateType === "pre" ? 12.0 : newRateType === "ipca" ? 6.0 : 100;
    }
    onChange(patch);
  };

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface-raised p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          {isTesouro ? "Parâmetros do Tesouro Direto" : "Parâmetros de Renda Fixa"}
        </span>
        <span className="text-[11px] text-muted-foreground">Cálculo &amp; Tributação</span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <FormField
          label="Indexador / Regime"
          htmlFor={`${idPrefix}-rate-type`}
          helperText="Referência da taxa de rendimento"
        >
          <Select
            id={`${idPrefix}-rate-type`}
            value={values.rateType}
            onValueChange={(rateType) => handleRateTypeChange(rateType as FixedIncomeRateType)}
            options={RATE_TYPE_OPTIONS}
            ariaLabel="Indexador ou regime de rendimento"
          />
        </FormField>

        <FormField
          label={rateLabel}
          htmlFor={`${idPrefix}-rate-value`}
          helperText="Taxa pactuada na contratação"
        >
          <PercentInput
            id={`${idPrefix}-rate-value`}
            value={numericRateValue}
            onValueChange={(rateValue) => onChange({ rateValue })}
            suffix={rateSuffix}
            aria-label={rateLabel}
          />
        </FormField>

        <FormField
          label="Data da Aplicação / Início dos Juros (D₀)"
          htmlFor={`${idPrefix}-base-date`}
          helperText="Data em que os juros começam a render"
        >
          <DatePicker
            id={`${idPrefix}-base-date`}
            value={values.baseDate}
            onValueChange={(baseDate) => {
              const patch: Partial<FixedIncomeFormFieldsValues> = { baseDate };
              if (!values.initialInvestmentDate) patch.initialInvestmentDate = baseDate;
              onChange(patch);
            }}
            placeholder="Selecione a data de início"
            ariaLabel="Data de início para contagem dos juros"
          />
        </FormField>

        <FormField
          label="Data de Vencimento"
          htmlFor={`${idPrefix}-maturity-date`}
          optional
          helperText="Congela o rendimento e aciona o Radar de Vencimentos"
        >
          <DatePicker
            id={`${idPrefix}-maturity-date`}
            value={values.maturityDate ?? ""}
            onValueChange={(maturityDate) => onChange({ maturityDate: maturityDate || null })}
            placeholder="dd/mm/aaaa"
            ariaLabel="Data de vencimento do título"
          />
        </FormField>

        {!values.isTaxExempt ? (
          <FormField
            label="Data de Aplicação Original"
            htmlFor={`${idPrefix}-initial-investment-date`}
            optional
            helperText="Define a faixa da tabela regressiva de IR (22,5% a 15,0%) nos resgates"
          >
            <DatePicker
              id={`${idPrefix}-initial-investment-date`}
              value={values.initialInvestmentDate ?? ""}
              onValueChange={(initialInvestmentDate) =>
                onChange({ initialInvestmentDate: initialInvestmentDate || null })
              }
              placeholder="dd/mm/aaaa"
              ariaLabel="Data da aplicação original para contagem regressiva de IR"
            />
          </FormField>
        ) : null}

        {!isTesouro ? (
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
        ) : null}
      </div>

      {!values.isTaxExempt ? (
        <Accordion type="single" collapsible defaultValue={hasManualTaxRate ? "advanced" : undefined}>
          <AccordionItem value="advanced" className="border-border/80 bg-surface">
            <AccordionTrigger className="px-3.5 py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
              Ajuste manual da alíquota de IR (exceção à tabela regressiva)
            </AccordionTrigger>
            <AccordionContent className="px-3.5 pb-3.5 pt-1">
              <FormField
                label="Alíquota Vigente de IR"
                htmlFor={`${idPrefix}-manual-tax-rate`}
                optional
                helperText="Fixe a alíquota caso deseje sobrepor a contagem regressiva automática"
              >
                <Select
                  id={`${idPrefix}-manual-tax-rate`}
                  value={selectedTaxRateValue}
                  onValueChange={(val) =>
                    onChange({ manualTaxRatePct: val === "auto" ? null : Number(val) })
                  }
                  options={TAX_RATE_OPTIONS}
                  ariaLabel="Alíquota vigente de IR"
                />
              </FormField>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
    </div>
  );
}
