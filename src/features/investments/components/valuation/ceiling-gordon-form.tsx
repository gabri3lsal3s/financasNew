import { HelpCircle } from "lucide-react";
import { FormField, Input, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { formatCeilingCurrency } from "@/domain/portfolio/ceiling-valuation";

export interface CeilingGordonFormProps {
  dpaStr: string;
  onDpaStrChange: (val: string) => void;
  growthPct: number;
  onGrowthPctChange: (val: number) => void;
  requiredPct: number;
  onRequiredPctChange: (val: number) => void;
  calculatedPrice: number | null;
  currentPrice: number;
  currency?: "BRL" | "USD";
}

export function CeilingGordonForm({
  dpaStr,
  onDpaStrChange,
  growthPct,
  onGrowthPctChange,
  requiredPct,
  onRequiredPctChange,
  calculatedPrice,
  currentPrice,
  currency = "BRL",
}: CeilingGordonFormProps) {
  const dpaNum = Number(dpaStr.replace(",", "."));
  const validDpa = Number.isFinite(dpaNum) && dpaNum > 0 ? dpaNum : 0;
  const isInvalidRate = requiredPct <= growthPct;

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start justify-between gap-2 rounded-xl border border-border/80 bg-surface/60 p-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">Modelo de Gordon (Proventos com Crescimento)</span>
          <span className="text-muted-foreground text-[11px] leading-relaxed">
            Indicado para empresas maduras com dividendos previsíveis e crescimento constante de longo prazo.
          </span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover shrink-0 cursor-pointer"
              aria-label="Como calcular o Modelo Gordon"
            >
              <HelpCircle className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3.5 text-xs flex flex-col gap-2">
            <span className="font-bold text-foreground">Como funciona o Modelo de Gordon:</span>
            <p className="text-muted-foreground leading-relaxed">
              Fórmula: <code>P = DPA × (1 + g) ÷ (k - g)</code>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              • <strong>DPA:</strong> Provento atual por ação.<br />
              • <strong>g (Crescimento):</strong> Taxa anual esperada de expansão dos dividendos.<br />
              • <strong>k (Retorno Exigido):</strong> Taxa mínima de atratividade (deve ser estritamente maior que o crescimento g).
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FormField label="Provento Atual (DPA)" htmlFor="gordon-dpa-input" helperText="Últimos 12 meses">
          <Input
            id="gordon-dpa-input"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 3,00"
            value={dpaStr}
            onChange={(e) => onDpaStrChange(e.target.value)}
          />
        </FormField>

        <FormField label="Crescimento Anual (g)" htmlFor="gordon-growth-input" helperText="Ex: 2% a 4%">
          <Input
            id="gordon-growth-input"
            type="number"
            step="0.5"
            min="0"
            max="15"
            value={growthPct || ""}
            onChange={(e) => onGrowthPctChange(Number(e.target.value))}
          />
        </FormField>

        <FormField label="Retorno Exigido (k)" htmlFor="gordon-required-input" helperText="Ex: 8% a 12%">
          <Input
            id="gordon-required-input"
            type="number"
            step="0.5"
            min="1"
            max="25"
            value={requiredPct || ""}
            onChange={(e) => onRequiredPctChange(Number(e.target.value))}
          />
        </FormField>
      </div>

      {isInvalidRate && (
        <span className="text-[11px] text-critical-strong">
          O retorno exigido (k) deve ser maior que a taxa de crescimento (g).
        </span>
      )}

      {calculatedPrice !== null && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary-strong uppercase tracking-wider text-[11px]">
              Memória de Cálculo Gordon
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              Teto: {formatCeilingCurrency(calculatedPrice, currency)}
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Próximo DPA projetado: {formatCeilingCurrency(validDpa * (1 + growthPct / 100), currency)} ÷ {((requiredPct - growthPct) / 100).toFixed(4)} = {formatCeilingCurrency(calculatedPrice, currency)}
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
