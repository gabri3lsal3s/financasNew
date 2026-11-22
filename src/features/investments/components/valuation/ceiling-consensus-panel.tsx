import { ShieldCheck, Scale, SlidersHorizontal } from "lucide-react";
import type {
  AssetCeilingMetadata,
  AssetCeilingMethod,
  ConsensusRule,
} from "@/domain/portfolio/ceiling-types";
import { formatCeilingCurrency } from "@/domain/portfolio/ceiling-valuation";
import { cn } from "@/lib/utils";

export interface CeilingConsensusPanelProps {
  computedModels: NonNullable<AssetCeilingMetadata["models"]>;
  consensusRule: ConsensusRule;
  onConsensusRuleChange: (rule: ConsensusRule) => void;
  selectedSpecificMethod: AssetCeilingMethod;
  onSelectedSpecificMethodChange: (method: AssetCeilingMethod) => void;
  effectivePrice: number | null;
  currency?: "BRL" | "USD";
}

const MODEL_LABELS: Record<string, string> = {
  bazin: "Décio Bazin (Dividendos)",
  graham: "Benjamin Graham (Valor)",
  gordon: "Gordon (Crescimento)",
  multiple: "Múltiplo Alvo (P/L ou P/VP)",
  fii_bazin: "Rendimento FII (Yield)",
  fii_pvp: "Patrimonial FII (P/VP)",
  fii_hybrid: "Híbrido FII (Yield + P/VP)",
  manual: "Manual / Preço-Alvo",
};

export function CeilingConsensusPanel({
  computedModels,
  consensusRule,
  onConsensusRuleChange,
  selectedSpecificMethod,
  onSelectedSpecificMethodChange,
  effectivePrice,
  currency = "BRL",
}: CeilingConsensusPanelProps) {
  const modelEntries = Object.entries(computedModels).filter(
    ([, data]) => Boolean(data && "price" in data && (data as { price: number }).price > 0),
  );

  if (modelEntries.length <= 1) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3.5 text-xs">
      <div className="flex items-center justify-between gap-2 border-b border-primary/20 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-foreground">
          <Scale className="size-4 text-primary shrink-0" aria-hidden="true" />
          <span>Mesa de Consenso Multimodelo ({modelEntries.length} modelos calculados)</span>
        </div>
        {effectivePrice !== null && (
          <span className="font-mono text-xs font-bold text-primary-strong">
            Teto Vigente: {formatCeilingCurrency(effectivePrice, currency)}
          </span>
        )}
      </div>

      {/* Lista de Modelos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {modelEntries.map(([key, data]) => {
          const price = (data as { price: number }).price;
          return (
            <div key={key} className="flex flex-col rounded-lg border border-border/80 bg-surface p-2">
              <span className="text-[10px] text-muted-foreground truncate">{MODEL_LABELS[key] ?? key}</span>
              <span className="font-mono text-xs font-bold text-foreground">{formatCeilingCurrency(price, currency)}</span>
            </div>
          );
        })}
      </div>

      {/* Regra de Escolha do Preço Teto Vigente */}
      <div className="flex flex-col gap-1.5 pt-1">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Critério de Definição do Preço Teto Vigente:
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onConsensusRuleChange("conservative")}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              consensusRule === "conservative"
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/80 bg-surface hover:bg-surface-hover",
            )}
          >
            <ShieldCheck className="size-4 text-positive-strong shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-foreground">Mais Conservador</span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Menor preço teto (máxima prudência de margem)
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onConsensusRuleChange("average")}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              consensusRule === "average"
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/80 bg-surface hover:bg-surface-hover",
            )}
          >
            <Scale className="size-4 text-primary-strong shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-foreground">Média dos Modelos</span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Consenso equilibrado entre os métodos
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onConsensusRuleChange("specific")}
            className={cn(
              "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              consensusRule === "specific"
                ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                : "border-border/80 bg-surface hover:bg-surface-hover",
            )}
          >
            <SlidersHorizontal className="size-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-foreground">Modelo Específico</span>
              <span className="text-[10px] text-muted-foreground leading-tight">
                Eleger um método favorito como guia
              </span>
            </div>
          </button>
        </div>

        {consensusRule === "specific" && (
          <div className="flex items-center gap-2 pt-1.5 flex-wrap">
            <span className="text-xs text-muted-foreground">Elegível:</span>
            {modelEntries.map(([key]) => {
              const methodKey = (key === "fii_bazin" ? "bazin" : key === "fii_pvp" ? "pvp" : key === "fii_hybrid" ? "hybrid_fii" : key) as AssetCeilingMethod;
              const isSelected = selectedSpecificMethod === methodKey;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => onSelectedSpecificMethodChange(methodKey)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border/80 bg-surface text-muted-foreground hover:text-foreground",
                  )}
                >
                  {MODEL_LABELS[key] ?? key}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
