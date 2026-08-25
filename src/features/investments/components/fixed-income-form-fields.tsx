import { DatePicker, Input, Select, Checkbox } from "@/components/ui";
import type { FixedIncomeRateType } from "@/types";

export interface FixedIncomeFormFieldsValues {
  rateType: FixedIncomeRateType;
  rateValue: string;
  baseDate: string;
  initialInvestmentDate?: string | null;
  maturityDate?: string | null;
  isTaxExempt: boolean;
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

/**
 * Subcomponente canônico para parâmetros de Renda Fixa e Tesouro Direto (Fase 63/72).
 * Reutilizado no Wizard de Ativos, AssetEditDialog e AssetFormDialog (Regra DRY §4).
 */
export function FixedIncomeFormFields({
  values,
  onChange,
  idPrefix = "fi",
  isTesouro = false,
}: FixedIncomeFormFieldsProps) {
  const getRatePlaceholder = () => {
    switch (values.rateType) {
      case "cdi":
        return "Ex: 110 (para 110% do CDI)";
      case "selic":
        return "Ex: 100 (para 100% da Selic)";
      case "pre":
        return "Ex: 12.5 (para 12,5% a.a.)";
      case "ipca":
        return "Ex: 6.2 (para IPCA + 6,2% a.a.)";
      default:
        return "Ex: 100";
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

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border/80 bg-surface/60 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">
          {isTesouro ? "Parâmetros do Tesouro Direto" : "Parâmetros de Renda Fixa"}
        </span>
        <span className="text-[11px] text-muted-foreground">Cálculo & Tributação</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Indexador */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Indexador / Regime</span>
          <Select
            value={values.rateType}
            onValueChange={(rateType) => onChange({ rateType: rateType as FixedIncomeRateType })}
            options={RATE_TYPE_OPTIONS}
          />
          <span className="text-[11px] text-muted-foreground">Referência da taxa de rendimento</span>
        </div>

        {/* Taxa Acordada */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${idPrefix}-rate-value`} className="text-xs font-semibold text-foreground">
            {getRateLabel()}
          </label>
          <Input
            id={`${idPrefix}-rate-value`}
            type="text"
            inputMode="decimal"
            value={values.rateValue}
            onChange={(e) => onChange({ rateValue: e.target.value })}
            placeholder={getRatePlaceholder()}
            className="font-mono"
          />
          <span className="text-[11px] text-muted-foreground">Taxa pactuada na contratação</span>
        </div>

        {/* Data-Base / Marco Zero */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">Data-Base / Marco Zero (D₀)</span>
          <DatePicker
            value={values.baseDate}
            onValueChange={(baseDate) => onChange({ baseDate })}
            placeholder="Selecione a data-base"
            ariaLabel="Data-base para início do cálculo de rendimento"
          />
          <span className="text-[11px] text-muted-foreground">Início da contagem dos juros do saldo atual</span>
        </div>

        {/* Data de Vencimento */}
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

        {/* Data de Aplicação Original */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-foreground">
            Aplicação Original <span className="text-muted-foreground/80 font-normal">(opcional)</span>
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

        {/* Isenção de IR */}
        <div className="flex flex-col justify-center gap-1 sm:pt-4">
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
      </div>
    </div>
  );
}
