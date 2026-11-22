import { AlertCircle, HelpCircle } from "lucide-react";
import { FormField, Input, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { formatCeilingCurrency } from "@/domain/portfolio/ceiling-valuation";

export interface CeilingGrahamFormProps {
  lpaStr: string;
  onLpaStrChange: (val: string) => void;
  vpaStr: string;
  onVpaStrChange: (val: string) => void;
  marginPct: number;
  onMarginPctChange: (val: number) => void;
  calculatedData?: { intrinsicValue: number; price: number } | null;
  currentPrice: number;
  currency?: "BRL" | "USD";
}

export function CeilingGrahamForm({
  lpaStr,
  onLpaStrChange,
  vpaStr,
  onVpaStrChange,
  marginPct,
  onMarginPctChange,
  calculatedData,
  currentPrice,
  currency = "BRL",
}: CeilingGrahamFormProps) {
  const lpaNum = Number(lpaStr.replace(",", "."));
  const vpaNum = Number(vpaStr.replace(",", "."));
  const hasNegativeValues = (lpaStr && lpaNum <= 0) || (vpaStr && vpaNum <= 0);

  return (
    <div className="flex flex-col gap-3.5">
      {/* Card Didático */}
      <div className="flex items-start justify-between gap-2 rounded-xl border border-border/80 bg-surface/60 p-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">Fórmula de Benjamin Graham (Valor Intrínseco)</span>
          <span className="text-muted-foreground text-[11px] leading-relaxed">
            Calcula o preço justo combinando o lucro contábil da empresa (LPA) com seu patrimônio tangível (VPA).
          </span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover shrink-0 cursor-pointer"
              aria-label="Como calcular a Fórmula de Graham"
            >
              <HelpCircle className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3.5 text-xs flex flex-col gap-2">
            <span className="font-bold text-foreground">Como funciona a Fórmula de Graham:</span>
            <p className="text-muted-foreground leading-relaxed">
              Fórmula canônica: <code>V = √(22,5 × LPA × VPA)</code>.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              1. <strong>LPA (Lucro por Ação):</strong> Lucro líquido dividido pelo total de ações.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              2. <strong>VPA (Valor Patrimonial por Ação):</strong> Patrimônio líquido dividido pelo total de ações.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              3. <strong>Margem de Segurança:</strong> Recomendado descontar 20% do valor intrínseco para proteger seu capital.
            </p>
            <div className="rounded border border-border/60 bg-surface-hover p-2 text-[11px]">
              <strong>Atenção:</strong> Indicada para empresas consolidadas, lucrativas e industriais. Não se aplica a FIIs nem a empresas com prejuízo recente.
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasNegativeValues && (
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning-strong">
          <AlertCircle className="size-4 shrink-0" aria-hidden="true" />
          <span>A fórmula de Graham exige LPA e VPA positivos (empresas lucrativas com patrimônio líquido positivo).</span>
        </div>
      )}

      {/* Grid de Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Lucro por Ação (LPA)" htmlFor="graham-lpa-input" helperText="Últimos 12 meses">
          <Input
            id="graham-lpa-input"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 5,40"
            value={lpaStr}
            onChange={(e) => onLpaStrChange(e.target.value)}
          />
        </FormField>

        <FormField label="Valor Patrimonial (VPA)" htmlFor="graham-vpa-input" helperText="Por ação">
          <Input
            id="graham-vpa-input"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 32,50"
            value={vpaStr}
            onChange={(e) => onVpaStrChange(e.target.value)}
          />
        </FormField>

        <FormField label="Margem de Segurança (%)" htmlFor="graham-margin-input" helperText="Padrão: 20%">
          <Input
            id="graham-margin-input"
            type="number"
            min="0"
            max="50"
            step="5"
            value={marginPct || ""}
            onChange={(e) => onMarginPctChange(Number(e.target.value))}
          />
        </FormField>
      </div>

      {/* Memória de Cálculo */}
      {calculatedData && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary-strong uppercase tracking-wider text-[11px]">
              Memória de Cálculo Graham
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              Teto: {formatCeilingCurrency(calculatedData.price, currency)}
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Valor Intrínseco (sem margem): {formatCeilingCurrency(calculatedData.intrinsicValue, currency)}
          </span>
          <span className="text-[11px] font-mono text-muted-foreground">
            Com {marginPct}% de Margem de Segurança: {formatCeilingCurrency(calculatedData.intrinsicValue, currency)} × {(1 - marginPct / 100).toFixed(2)} = {formatCeilingCurrency(calculatedData.price, currency)}
          </span>
          {currentPrice > 0 && (
            <span className="text-[11px] text-muted-foreground">
              Cotação Atual de Mercado: {formatCeilingCurrency(currentPrice, currency)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
