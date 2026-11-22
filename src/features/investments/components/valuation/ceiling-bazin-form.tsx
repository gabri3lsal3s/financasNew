import { HelpCircle } from "lucide-react";
import { FormField, Input, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { formatCeilingCurrency } from "@/domain/portfolio/ceiling-valuation";
import { CeilingSensitivityTable } from "./ceiling-sensitivity-table";

export interface CeilingBazinFormProps {
  dpaStr: string;
  onDpaStrChange: (val: string) => void;
  yieldPct: number;
  onYieldPctChange: (val: number) => void;
  calculatedPrice: number | null;
  currentPrice: number;
  currency?: "BRL" | "USD";
}

export function CeilingBazinForm({
  dpaStr,
  onDpaStrChange,
  yieldPct,
  onYieldPctChange,
  calculatedPrice,
  currentPrice,
  currency = "BRL",
}: CeilingBazinFormProps) {
  const dpaNum = Number(dpaStr.replace(",", "."));
  const validDpa = Number.isFinite(dpaNum) && dpaNum > 0 ? dpaNum : 0;

  return (
    <div className="flex flex-col gap-3.5">
      {/* Card Didático Rápido */}
      <div className="flex items-start justify-between gap-2 rounded-xl border border-border/80 bg-surface/60 p-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">Método Décio Bazin (Preço Teto por Dividendos)</span>
          <span className="text-muted-foreground text-[11px] leading-relaxed">
            Calcula o valor máximo a pagar para garantir o retorno anual desejado em proventos.
          </span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover shrink-0 cursor-pointer"
              aria-label="Como calcular o Preço Teto Bazin"
            >
              <HelpCircle className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3.5 text-xs flex flex-col gap-2">
            <span className="font-bold text-foreground">Como calcular o Preço Teto Bazin:</span>
            <p className="text-muted-foreground leading-relaxed">
              1. <strong>Proventos Anuais (DPA):</strong> Some quanto a empresa pagou por cada ação nos últimos 12 meses
              (ou a média dos últimos 3 anos para expurgar anos atípicos). Use proventos líquidos de imposto de renda.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              2. <strong>Yield Mínimo:</strong> O padrão consagrado de Bazin é <strong>6,0% a.a.</strong> Você pode ajustar
              se exigir uma taxa maior (ex: 8% a.a.).
            </p>
            <div className="rounded border border-border/60 bg-surface-hover p-2 text-[11px]">
              <span className="font-semibold">Exemplo:</span> DPA de R$ 3,00 ÷ 0,06 = Preço Teto de R$ 50,00.
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Grid de Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <FormField
          label="Proventos Anuais por Ação (DPA)"
          htmlFor="bazin-dpa-input"
          helperText="Total de proventos líquidos por cota no ano"
        >
          <Input
            id="bazin-dpa-input"
            type="text"
            inputMode="decimal"
            placeholder="Ex: 3,20"
            value={dpaStr}
            onChange={(e) => onDpaStrChange(e.target.value)}
          />
        </FormField>

        <FormField
          label="Dividend Yield Mínimo Alvo (% a.a.)"
          htmlFor="bazin-yield-input"
          helperText="Padrão canônico de Bazin: 6,0%"
        >
          <Input
            id="bazin-yield-input"
            type="number"
            step="0.5"
            min="1"
            max="30"
            value={yieldPct || ""}
            onChange={(e) => onYieldPctChange(Number(e.target.value))}
          />
        </FormField>
      </div>

      {/* Tabela de Sensibilidade */}
      {validDpa > 0 && (
        <CeilingSensitivityTable
          dpa={validDpa}
          selectedYieldPct={yieldPct}
          onSelectYield={onYieldPctChange}
          currency={currency}
        />
      )}

      {/* Memória de Cálculo Auditável */}
      {calculatedPrice !== null && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary-strong uppercase tracking-wider text-[11px]">
              Memória de Cálculo Bazin
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              Teto: {formatCeilingCurrency(calculatedPrice, currency)}
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Fórmula: DPA ({formatCeilingCurrency(validDpa, currency)}) ÷ {(yieldPct / 100).toFixed(4)} = {formatCeilingCurrency(calculatedPrice, currency)}
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
