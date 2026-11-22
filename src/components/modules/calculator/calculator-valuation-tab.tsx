import { useState, useMemo } from "react";
import { Copy, Check, TrendingUp, HelpCircle } from "lucide-react";
import { Button, FormField, Input, Tabs, type TabItem } from "@/components/ui";
import {
  calculateBazinCeiling,
  calculateGrahamCeiling,
  calculateGordonCeiling,
  calculateFiiBazinCeiling,
  calculateFiiPvpCeiling,
  formatCeilingCurrency,
} from "@/domain/portfolio/ceiling-valuation";
import { parseDecimalNumber } from "@/domain/money";
import { pushToast } from "@/services/toast";
import { triggerSensory } from "@/services/sensory";

export interface CalculatorValuationTabProps {
  onInjectValue?: (valueStr: string) => void;
}

export function CalculatorValuationTab({ onInjectValue }: CalculatorValuationTabProps) {
  const [modelType, setModelType] = useState<"bazin" | "graham" | "gordon" | "fii_yield" | "fii_pvp">("bazin");

  // Bazin states
  const [bazinDpa, setBazinDpa] = useState("3.00");
  const [bazinYield, setBazinYield] = useState(6);

  // Graham states
  const [grahamLpa, setGrahamLpa] = useState("5.00");
  const [grahamVpa, setGrahamVpa] = useState("30.00");
  const [grahamMargin, setGrahamMargin] = useState(20);

  // Gordon states
  const [gordonDpa, setGordonDpa] = useState("3.00");
  const [gordonGrowth, setGordonGrowth] = useState(3);
  const [gordonRequired, setGordonRequired] = useState(10);

  // FII Yield states
  const [fiiMonthlyDividend, setFiiMonthlyDividend] = useState("0.85");
  const [fiiTargetYield, setFiiTargetYield] = useState(9);

  // FII P/VP states
  const [fiiVpa, setFiiVpa] = useState("100.00");
  const [fiiTargetPvp, setFiiTargetPvp] = useState(1.0);

  const [copied, setCopied] = useState(false);

  // Calculations
  const calculatedResult = useMemo(() => {
    switch (modelType) {
      case "bazin": {
        const dpa = parseDecimalNumber(bazinDpa);
        if (dpa <= 0 || bazinYield <= 0) return null;
        const price = calculateBazinCeiling(dpa, bazinYield / 100);
        return {
          price,
          formula: `P = DPA (${formatCeilingCurrency(dpa)}) ÷ Yield (${bazinYield}%)`,
          label: "Preço Teto Décio Bazin",
        };
      }
      case "graham": {
        const lpa = parseDecimalNumber(grahamLpa);
        const vpa = parseDecimalNumber(grahamVpa);
        if (lpa <= 0 || vpa <= 0) return null;
        const res = calculateGrahamCeiling(lpa, vpa, grahamMargin / 100);
        if (!res) return null;
        return {
          price: res.price,
          formula: `√(22,5 × LPA × VPA) × (1 - ${grahamMargin}%) = ${formatCeilingCurrency(res.price)}`,
          label: "Preço Teto Benjamin Graham",
        };
      }
      case "gordon": {
        const dpa = parseDecimalNumber(gordonDpa);
        if (dpa <= 0 || gordonRequired <= gordonGrowth) return null;
        const price = calculateGordonCeiling(dpa, gordonGrowth / 100, gordonRequired / 100);
        return {
          price,
          formula: `DPA × (1 + g) ÷ (k - g) = ${formatCeilingCurrency(price ?? 0)}`,
          label: "Preço Teto Modelo de Gordon",
        };
      }
      case "fii_yield": {
        const monthly = parseDecimalNumber(fiiMonthlyDividend);
        if (monthly <= 0 || fiiTargetYield <= 0) return null;
        const price = calculateFiiBazinCeiling(monthly, fiiTargetYield / 100);
        return {
          price,
          formula: `(Mensal × 12) ÷ Yield (${fiiTargetYield}%) = ${formatCeilingCurrency(price ?? 0)}`,
          label: "Preço Teto FII por Rendimento",
        };
      }
      case "fii_pvp": {
        const vpa = parseDecimalNumber(fiiVpa);
        if (vpa <= 0 || fiiTargetPvp <= 0) return null;
        const price = calculateFiiPvpCeiling(vpa, fiiTargetPvp);
        return {
          price,
          formula: `VP (${formatCeilingCurrency(vpa)}) × P/VP Alvo (${fiiTargetPvp.toFixed(2)})`,
          label: "Preço Teto FII por P/VP Alvo",
        };
      }
      default:
        return null;
    }
  }, [
    modelType,
    bazinDpa,
    bazinYield,
    grahamLpa,
    grahamVpa,
    grahamMargin,
    gordonDpa,
    gordonGrowth,
    gordonRequired,
    fiiMonthlyDividend,
    fiiTargetYield,
    fiiVpa,
    fiiTargetPvp,
  ]);

  const handleCopyOrInject = async () => {
    if (!calculatedResult || calculatedResult.price === null) return;
    const valueStr = calculatedResult.price.toFixed(2);
    triggerSensory("action");

    if (onInjectValue) {
      onInjectValue(valueStr);
      return;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(valueStr);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        pushToast({
          title: "Preço Teto copiado",
          description: `${formatCeilingCurrency(calculatedResult.price)} copiado para a área de transferência.`,
          variant: "default",
        });
      }
    } catch {
      pushToast({
        title: "Erro ao copiar",
        description: "Não foi possível acessar a área de transferência.",
        variant: "destructive",
      });
    }
  };

  const modelTabs: TabItem[] = [
    { value: "bazin", label: "Bazin" },
    { value: "graham", label: "Graham" },
    { value: "gordon", label: "Gordon" },
    { value: "fii_yield", label: "FII Yield" },
    { value: "fii_pvp", label: "FII P/VP" },
  ];

  return (
    <div className="flex flex-col gap-3.5 pt-1 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-border/80 pb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <TrendingUp className="size-3.5 text-primary-strong shrink-0" aria-hidden="true" />
          <span className="font-semibold text-foreground text-xs">
            Calculadora de Valuation &amp; Preço Teto
          </span>
        </div>
      </div>

      <Tabs
        items={modelTabs}
        value={modelType}
        onValueChange={(v) => setModelType(v as typeof modelType)}
        fullWidth={false}
      />

      {/* Model-specific forms */}
      {modelType === "bazin" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Provento por Ação (DPA)" htmlFor="calc-bazin-dpa" helperText="Total pago nos últimos 12m">
            <Input
              id="calc-bazin-dpa"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 3,00"
              value={bazinDpa}
              onChange={(e) => setBazinDpa(e.target.value)}
            />
          </FormField>
          <FormField label="Yield Mínimo Desejado (%)" htmlFor="calc-bazin-yield" helperText="Padrão clássico: 6%">
            <Input
              id="calc-bazin-yield"
              type="number"
              step="0.5"
              min="1"
              max="20"
              value={bazinYield || ""}
              onChange={(e) => setBazinYield(Number(e.target.value))}
            />
          </FormField>
        </div>
      )}

      {modelType === "graham" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <FormField label="LPA (Lucro/Ação)" htmlFor="calc-graham-lpa" helperText="Últimos 12 meses">
            <Input
              id="calc-graham-lpa"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 5,40"
              value={grahamLpa}
              onChange={(e) => setGrahamLpa(e.target.value)}
            />
          </FormField>
          <FormField label="VPA (Patrimonial)" htmlFor="calc-graham-vpa" helperText="Valor por ação">
            <Input
              id="calc-graham-vpa"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 32,50"
              value={grahamVpa}
              onChange={(e) => setGrahamVpa(e.target.value)}
            />
          </FormField>
          <FormField label="Margem Seg. (%)" htmlFor="calc-graham-margin" helperText="Padrão: 20%">
            <Input
              id="calc-graham-margin"
              type="number"
              step="5"
              min="0"
              max="50"
              value={grahamMargin || ""}
              onChange={(e) => setGrahamMargin(Number(e.target.value))}
            />
          </FormField>
        </div>
      )}

      {modelType === "gordon" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <FormField label="DPA Atual" htmlFor="calc-gordon-dpa" helperText="Últimos 12 meses">
            <Input
              id="calc-gordon-dpa"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 3,00"
              value={gordonDpa}
              onChange={(e) => setGordonDpa(e.target.value)}
            />
          </FormField>
          <FormField label="Crescimento (g %)" htmlFor="calc-gordon-growth" helperText="Ex: 2% a 4%">
            <Input
              id="calc-gordon-growth"
              type="number"
              step="0.5"
              min="0"
              max="15"
              value={gordonGrowth || ""}
              onChange={(e) => setGordonGrowth(Number(e.target.value))}
            />
          </FormField>
          <FormField label="Retorno Exigido (k %)" htmlFor="calc-gordon-req" helperText="Ex: 8% a 12%">
            <Input
              id="calc-gordon-req"
              type="number"
              step="0.5"
              min="1"
              max="25"
              value={gordonRequired || ""}
              onChange={(e) => setGordonRequired(Number(e.target.value))}
            />
          </FormField>
        </div>
      )}

      {modelType === "fii_yield" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Provento Mensal por Cota" htmlFor="calc-fii-monthly" helperText="Último provento ou média mensal">
            <Input
              id="calc-fii-monthly"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 0,85"
              value={fiiMonthlyDividend}
              onChange={(e) => setFiiMonthlyDividend(e.target.value)}
            />
          </FormField>
          <FormField label="Yield Anual Desejado (%)" htmlFor="calc-fii-yield" helperText="Ex: 8,5% a 10%">
            <Input
              id="calc-fii-yield"
              type="number"
              step="0.5"
              min="3"
              max="20"
              value={fiiTargetYield || ""}
              onChange={(e) => setFiiTargetYield(Number(e.target.value))}
            />
          </FormField>
        </div>
      )}

      {modelType === "fii_pvp" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Valor Patrimonial por Cota (VP)" htmlFor="calc-fii-vpa" helperText="Do último relatório gerencial">
            <Input
              id="calc-fii-vpa"
              type="text"
              inputMode="decimal"
              placeholder="Ex: 100,00"
              value={fiiVpa}
              onChange={(e) => setFiiVpa(e.target.value)}
            />
          </FormField>
          <FormField label="P/VP Alvo" htmlFor="calc-fii-pvp" helperText="Ex: 1,00 (preço justo) ou 0,95">
            <Input
              id="calc-fii-pvp"
              type="number"
              step="0.05"
              min="0.5"
              max="2.0"
              value={fiiTargetPvp || ""}
              onChange={(e) => setFiiTargetPvp(Number(e.target.value))}
            />
          </FormField>
        </div>
      )}

      {/* Memory Card */}
      {calculatedResult && calculatedResult.price !== null ? (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3.5 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-primary-strong">
              {calculatedResult.label}
            </span>
            <span className="font-mono text-base font-bold text-foreground">
              {formatCeilingCurrency(calculatedResult.price)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground border-t border-primary/10 pt-1.5">
            <HelpCircle className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
            <span className="truncate">{calculatedResult.formula}</span>
          </div>

          <div className="pt-1 flex justify-end">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void handleCopyOrInject()}
              className="gap-1.5 text-xs text-primary-strong"
            >
              {copied ? <Check className="size-3.5 text-positive-strong" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
              <span>{onInjectValue ? "Usar valor no campo" : copied ? "Copiado!" : "Copiar Preço Teto"}</span>
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/80 bg-muted/20 p-3 text-center text-xs text-muted-foreground">
          Preencha os campos com valores válidos para calcular o Preço Teto.
        </div>
      )}
    </div>
  );
}
