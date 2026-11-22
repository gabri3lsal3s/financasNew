import { HelpCircle } from "lucide-react";
import { FormField, Input, Popover, PopoverContent, PopoverTrigger } from "@/components/ui";
import { formatCeilingCurrency } from "@/domain/portfolio/ceiling-valuation";
import { cn } from "@/lib/utils";

export interface CeilingFiiFormProps {
  mode: "bazin" | "pvp" | "hybrid";
  onModeChange: (mode: "bazin" | "pvp" | "hybrid") => void;
  monthlyDividendStr: string;
  onMonthlyDividendStrChange: (val: string) => void;
  yieldPct: number;
  onYieldPctChange: (val: number) => void;
  vpaStr: string;
  onVpaStrChange: (val: string) => void;
  maxPvp: number;
  onMaxPvpChange: (val: number) => void;
  calculatedPrice: number | null;
  currentPrice: number;
  currency?: "BRL" | "USD";
}

export function CeilingFiiForm({
  mode,
  onModeChange,
  monthlyDividendStr,
  onMonthlyDividendStrChange,
  yieldPct,
  onYieldPctChange,
  vpaStr,
  onVpaStrChange,
  maxPvp,
  onMaxPvpChange,
  calculatedPrice,
  currentPrice,
  currency = "BRL",
}: CeilingFiiFormProps) {
  return (
    <div className="flex flex-col gap-3.5">
      {/* Seletor de Modo FII */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl border border-border/80 bg-surface/70">
        <button
          type="button"
          onClick={() => onModeChange("hybrid")}
          className={cn(
            "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            mode === "hybrid"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Híbrido (Recomendado)
        </button>
        <button
          type="button"
          onClick={() => onModeChange("bazin")}
          className={cn(
            "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            mode === "bazin"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Por Yield (Bazin FII)
        </button>
        <button
          type="button"
          onClick={() => onModeChange("pvp")}
          className={cn(
            "flex-1 py-1.5 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer",
            mode === "pvp"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Por Valor Patrimonial (P/VP)
        </button>
      </div>

      {/* Card Didático */}
      <div className="flex items-start justify-between gap-2 rounded-xl border border-border/80 bg-surface/60 p-3 text-xs">
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-foreground">
            {mode === "hybrid"
              ? "Modelo Híbrido: Yield + Trava de Patrimônio"
              : mode === "bazin"
                ? "Preço Teto por Rendimento Mensal"
                : "Preço Teto por Laudo Patrimonial (P/VP)"}
          </span>
          <span className="text-muted-foreground text-[11px] leading-relaxed">
            {mode === "hybrid"
              ? "Combina o retorno em aluguéis com a garantia de não pagar ágio excessivo sobre os imóveis."
              : mode === "bazin"
                ? "Calcula o preço máximo da cota para manter o dividend yield anual desejado."
                : "Garante que você compre até o valor justo avaliado dos imóveis do fundo."}
          </span>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-hover shrink-0 cursor-pointer"
              aria-label="Ajuda sobre precificação de FIIs"
            >
              <HelpCircle className="size-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3.5 text-xs flex flex-col gap-2">
            <span className="font-bold text-foreground">Como precificar Fundos Imobiliários:</span>
            <p className="text-muted-foreground leading-relaxed">
              • <strong>Por que não usar Graham em FIIs?</strong> Graham foi desenhado para indústrias e bancos. FIIs
              distribuem quase todo o caixa em aluguéis e são lastreados em laudos de imóveis (VPA).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              • <strong>O Modelo Híbrido:</strong> Evita a armadilha de comprar um FII que parece render muito hoje, mas
              está com cotação 15% acima do valor real dos tijolos.
            </p>
          </PopoverContent>
        </Popover>
      </div>

      {/* Inputs condicionados ao modo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(mode === "bazin" || mode === "hybrid") && (
          <>
            <FormField label="Rendimento Médio Mensal" htmlFor="fii-dividend-input" helperText="Por cota (ex: R$ 0,85)">
              <Input
                id="fii-dividend-input"
                type="text"
                inputMode="decimal"
                placeholder="Ex: 0,85"
                value={monthlyDividendStr}
                onChange={(e) => onMonthlyDividendStrChange(e.target.value)}
              />
            </FormField>

            <FormField label="Yield Alvo Anual (% a.a.)" htmlFor="fii-yield-input" helperText="Recomendado: 8,0% a 9,5%">
              <Input
                id="fii-yield-input"
                type="number"
                step="0.5"
                min="4"
                max="20"
                value={yieldPct || ""}
                onChange={(e) => onYieldPctChange(Number(e.target.value))}
              />
            </FormField>
          </>
        )}

        {(mode === "pvp" || mode === "hybrid") && (
          <>
            <FormField label="Valor Patrimonial da Cota (VPA)" htmlFor="fii-vpa-input" helperText="Laudo contábil dos imóveis">
              <Input
                id="fii-vpa-input"
                type="text"
                inputMode="decimal"
                placeholder="Ex: 102,40"
                value={vpaStr}
                onChange={(e) => onVpaStrChange(e.target.value)}
              />
            </FormField>

            <FormField label="P/VP Máximo Aceitável" htmlFor="fii-maxpvp-input" helperText="Padrão: 1,00 a 1,02">
              <Input
                id="fii-maxpvp-input"
                type="number"
                step="0.01"
                min="0.8"
                max="1.5"
                value={maxPvp || ""}
                onChange={(e) => onMaxPvpChange(Number(e.target.value))}
              />
            </FormField>
          </>
        )}
      </div>

      {/* Memória de Cálculo FII */}
      {calculatedPrice !== null && (
        <div className="flex flex-col gap-1.5 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-primary-strong uppercase tracking-wider text-[11px]">
              Memória de Cálculo FII
            </span>
            <span className="font-mono text-sm font-bold text-foreground">
              Teto: {formatCeilingCurrency(calculatedPrice, currency)}
            </span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {mode === "hybrid"
              ? "Menor valor entre o teto de aluguéis e a trava patrimonial de P/VP."
              : mode === "bazin"
                ? `Rendimento anualizado ÷ ${(yieldPct / 100).toFixed(4)}`
                : `VPA × ${maxPvp.toFixed(2)}`}
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
