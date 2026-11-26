import { useState } from "react";
import { Building2, Calculator, CheckCircle2, Scale, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MoneyText } from "@/components/ui/money-text";
import { cn } from "@/lib/utils";
import { triggerSensory } from "@/services/sensory";

export type ValuationModelKey = "bazin" | "graham" | "gordon" | "fiis";

interface SensitivityRow {
  scenario: string;
  parameterLabel: string;
  ceilingCents: number;
  marginPercent: string;
  status: "attractive" | "fair";
}

interface ValuationModelExample {
  key: ValuationModelKey;
  label: string;
  shortLabel: string;
  ticker: string;
  assetClass: string;
  formula: string;
  explanation: string;
  ceilingCents: number;
  currentPriceCents: number;
  marginText: string;
  verdictLabel: string;
  verdictTone: "positive" | "warning";
  sensitivityTitle: string;
  sensitivityParamHeader: string;
  rows: readonly SensitivityRow[];
}

const VALUATION_MODELS: Record<ValuationModelKey, ValuationModelExample> = {
  bazin: {
    key: "bazin",
    label: "Bazin (Dividendo)",
    shortLabel: "Bazin",
    ticker: "BBAS3",
    assetClass: "Ação · Bancos",
    formula: "Teto = DPA Médio / Yield Mínimo (6% a.a.)",
    explanation:
      "Calcula o máximo a pagar pela ação garantindo retorno mínimo em dividendos sobre o histórico recente.",
    ceilingCents: 3167,
    currentPriceCents: 2680,
    marginText: "+18,2%",
    verdictLabel: "Abaixo do teto",
    verdictTone: "positive",
    sensitivityTitle: "Matriz de Sensibilidade · Yield Exigido x DPA",
    sensitivityParamHeader: "Yield mínimo",
    rows: [
      {
        scenario: "Conservador",
        parameterLabel: "7,0% a.a. (DPA R$ 1,90)",
        ceilingCents: 2714,
        marginPercent: "+1,3%",
        status: "fair",
      },
      {
        scenario: "Base Bazin",
        parameterLabel: "6,0% a.a. (DPA R$ 1,90)",
        ceilingCents: 3167,
        marginPercent: "+18,2%",
        status: "attractive",
      },
      {
        scenario: "Otimista",
        parameterLabel: "5,5% a.a. (DPA R$ 1,98)",
        ceilingCents: 3600,
        marginPercent: "+34,3%",
        status: "attractive",
      },
    ],
  },
  graham: {
    key: "graham",
    label: "Graham (Valor)",
    shortLabel: "Graham",
    ticker: "BBAS3",
    assetClass: "Ação · Bancos",
    formula: "VI = Raiz(22,5 x LPA x VPA)",
    explanation:
      "Valor intrínseco clássico que combina lucro por ação e valor patrimonial para exigir margem de segurança.",
    ceilingCents: 3420,
    currentPriceCents: 2680,
    marginText: "+27,6%",
    verdictLabel: "Margem confortável",
    verdictTone: "positive",
    sensitivityTitle: "Matriz de Sensibilidade · Múltiplo x Lucro",
    sensitivityParamHeader: "Múltiplo base",
    rows: [
      {
        scenario: "Margem estrita",
        parameterLabel: "VI com desconto 20%",
        ceilingCents: 2736,
        marginPercent: "+2,1%",
        status: "fair",
      },
      {
        scenario: "Base Graham",
        parameterLabel: "Fator 22,5 (LPA R$ 6,10)",
        ceilingCents: 3420,
        marginPercent: "+27,6%",
        status: "attractive",
      },
      {
        scenario: "Expansão ROE",
        parameterLabel: "Fator 22,5 (LPA R$ 6,45)",
        ceilingCents: 3580,
        marginPercent: "+33,6%",
        status: "attractive",
      },
    ],
  },
  gordon: {
    key: "gordon",
    label: "Gordon (Crescimento)",
    shortLabel: "Gordon",
    ticker: "BBAS3",
    assetClass: "Ação · Bancos",
    formula: "P0 = D1 / (Ke - g)",
    explanation:
      "Desconta dividendos futuros esperados pela taxa mínima exigida (Ke) menos o crescimento perpétuo (g).",
    ceilingCents: 2890,
    currentPriceCents: 2680,
    marginText: "+7,8%",
    verdictLabel: "Zona justa",
    verdictTone: "warning",
    sensitivityTitle: "Matriz de Sensibilidade · Taxa Ke x Crescimento g",
    sensitivityParamHeader: "Parâmetros (Ke / g)",
    rows: [
      {
        scenario: "Ke elevado",
        parameterLabel: "Ke 12,5% / g 4,0%",
        ceilingCents: 2450,
        marginPercent: "-8,6%",
        status: "fair",
      },
      {
        scenario: "Base Gordon",
        parameterLabel: "Ke 11,5% / g 4,5%",
        ceilingCents: 2890,
        marginPercent: "+7,8%",
        status: "fair",
      },
      {
        scenario: "Crescimento estável",
        parameterLabel: "Ke 11,0% / g 5,0%",
        ceilingCents: 3360,
        marginPercent: "+25,4%",
        status: "attractive",
      },
    ],
  },
  fiis: {
    key: "fiis",
    label: "FIIs (Yield / P/VP)",
    shortLabel: "FIIs",
    ticker: "HGLG11",
    assetClass: "FII · Logística",
    formula: "Teto = Rendimento Anualizado / DY Alvo & P/VP",
    explanation:
      "Cruza rendimento mensal anualizado sobre NTN-B / DY exigido com prêmio ou desconto patrimonial (P/VP).",
    ceilingCents: 16250,
    currentPriceCents: 15640,
    marginText: "+3,9%",
    verdictLabel: "P/VP 0,98 · Atrativo",
    verdictTone: "positive",
    sensitivityTitle: "Matriz de Sensibilidade · DY Alvo FII",
    sensitivityParamHeader: "DY exigido",
    rows: [
      {
        scenario: "Exigente",
        parameterLabel: "DY 9,0% a.a. (R$ 1,10/cota)",
        ceilingCents: 14667,
        marginPercent: "-6,2%",
        status: "fair",
      },
      {
        scenario: "Base FII",
        parameterLabel: "DY 8,1% a.a. (R$ 1,10/cota)",
        ceilingCents: 16250,
        marginPercent: "+3,9%",
        status: "attractive",
      },
      {
        scenario: "Tolerante",
        parameterLabel: "DY 7,5% a.a. (R$ 1,10/cota)",
        ceilingCents: 17600,
        marginPercent: "+12,5%",
        status: "attractive",
      },
    ],
  },
};

const MODEL_ORDER: readonly ValuationModelKey[] = ["bazin", "graham", "gordon", "fiis"];

const CONSENSUS_SUMMARY = [
  { label: "Bazin", valueCents: 3167 },
  { label: "Graham", valueCents: 3420 },
  { label: "Gordon", valueCents: 2890 },
  { label: "Consenso Ações", valueCents: 3159, highlight: true },
] as const;

export function ValuationInteractivePreview() {
  const [selectedModel, setSelectedModel] = useState<ValuationModelKey>("bazin");
  const model = VALUATION_MODELS[selectedModel];

  const handleSelectModel = (key: ValuationModelKey) => {
    triggerSensory("selection");
    setSelectedModel(key);
  };

  return (
    <Card
      data-testid="valuation-interactive-preview"
      className="border-border/80 bg-surface shadow-xs p-4 sm:p-6 space-y-5 rounded-2xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <Calculator className="size-4 text-portfolio shrink-0" aria-hidden="true" />
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Valuation & Preço Teto Multi-Modelo
            </h3>
          </div>
          <p className="text-xs text-muted-foreground">
            Compare modelos de cálculo em tempo real com tabela de sensibilidade e painel de consenso.
          </p>
        </div>

        <Badge variant="portfolio" size="sm">
          {model.ticker} · {model.assetClass}
        </Badge>
      </div>

      {/* Model Switcher */}
      <div
        role="group"
        aria-label="Selecionar modelo de valuation"
        className="grid grid-cols-2 sm:grid-cols-4 gap-2"
      >
        {MODEL_ORDER.map((key) => {
          const item = VALUATION_MODELS[key];
          const isSelected = selectedModel === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleSelectModel(key)}
              className={cn(
                "rounded-xl border px-3 py-2.5 text-left transition-all cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isSelected
                  ? "border-portfolio/40 bg-portfolio/10 text-foreground shadow-xs"
                  : "border-border/80 bg-surface-raised/50 text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              <span className="text-xs font-bold block">{item.shortLabel}</span>
              <span className="text-[11px] text-muted-foreground block mt-0.5">
                {item.ticker}
              </span>
            </button>
          );
        })}
      </div>

      {/* Formula + KPI Grid */}
      <div className="rounded-xl border border-border/80 bg-surface-raised/60 p-3.5 sm:p-4 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Fórmula aplicada
            </span>
            <code className="font-mono text-xs sm:text-sm font-semibold text-foreground block">
              {model.formula}
            </code>
          </div>
          <Badge variant={model.verdictTone} size="sm">
            {model.verdictLabel}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">{model.explanation}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Preço Teto ({model.shortLabel})
            </span>
            <MoneyText
              cents={model.ceilingCents}
              tone="portfolio"
              className="text-base sm:text-lg font-bold"
            />
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Cotação Atual ({model.ticker})
            </span>
            <MoneyText
              cents={model.currentPriceCents}
              tone="default"
              className="text-base sm:text-lg font-bold"
            />
          </div>

          <div className="rounded-xl border border-border/80 bg-surface p-3 space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground block">
              Margem de Segurança
            </span>
            <div className="flex items-center gap-1.5">
              <TrendingUp className="size-4 text-positive-strong shrink-0" aria-hidden="true" />
              <span className="font-mono text-base sm:text-lg font-bold tabular-nums tracking-tight whitespace-nowrap text-positive-strong">
                {model.marginText}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Painel de Consenso (Ações vs FIIs) */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            {selectedModel === "fiis" ? (
              <Building2 className="size-4 text-muted-foreground" aria-hidden="true" />
            ) : (
              <Scale className="size-4 text-muted-foreground" aria-hidden="true" />
            )}
            Painel de Consenso · {model.ticker}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {selectedModel === "fiis"
              ? "FIIs combinam Yield Alvo e P/VP patrimonial"
              : "Média ponderada de modelos de Ações sem caixa preta"}
          </span>
        </div>

        {selectedModel === "fiis" ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-border/80 bg-surface-raised/50 p-3 space-y-0.5">
              <span className="text-[11px] text-muted-foreground block">DY Anualizado</span>
              <span className="font-mono text-sm font-bold text-foreground whitespace-nowrap">
                8,44% a.a.
              </span>
            </div>
            <div className="rounded-xl border border-border/80 bg-surface-raised/50 p-3 space-y-0.5">
              <span className="text-[11px] text-muted-foreground block">P/VP Patrimonial</span>
              <span className="font-mono text-sm font-bold text-positive-strong whitespace-nowrap">
                0,98x (desconto)
              </span>
            </div>
            <div className="rounded-xl border border-portfolio/30 bg-portfolio/10 p-3 space-y-0.5">
              <span className="text-[11px] font-semibold text-portfolio block">
                Consenso HGLG11
              </span>
              <MoneyText cents={16250} tone="portfolio" className="text-sm font-bold" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CONSENSUS_SUMMARY.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "rounded-xl border p-3 space-y-0.5",
                  "highlight" in item && item.highlight
                    ? "border-portfolio/30 bg-portfolio/10"
                    : "border-border/80 bg-surface-raised/50",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] block",
                    "highlight" in item && item.highlight
                      ? "font-semibold text-portfolio"
                      : "text-muted-foreground",
                  )}
                >
                  {item.label}
                </span>
                <MoneyText
                  cents={item.valueCents}
                  tone={"highlight" in item && item.highlight ? "portfolio" : "default"}
                  className="text-sm font-bold"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabela de Sensibilidade (Regra 25: overflow-x-auto no-scrollbar scroll-smooth w-full) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {model.sensitivityTitle}
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <CheckCircle2 className="size-3.5 text-positive-strong shrink-0" aria-hidden="true" />
            Auditoria automática
          </span>
        </div>

        <div className="overflow-x-auto no-scrollbar scroll-smooth w-full rounded-xl border border-border/80">
          <table className="w-full min-w-[440px] text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 bg-surface-raised/70 text-[11px] font-semibold text-muted-foreground">
                <th className="py-2.5 px-3">Cenário</th>
                <th className="py-2.5 px-3">{model.sensitivityParamHeader}</th>
                <th className="py-2.5 px-3 text-right">Preço Teto</th>
                <th className="py-2.5 px-3 text-right">Margem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {model.rows.map((row) => (
                <tr key={row.scenario} className="bg-surface">
                  <td className="py-2.5 px-3 font-medium text-foreground">{row.scenario}</td>
                  <td className="py-2.5 px-3 text-muted-foreground">{row.parameterLabel}</td>
                  <td className="py-2.5 px-3 text-right">
                    <MoneyText
                      cents={row.ceilingCents}
                      tone="default"
                      className="text-xs font-semibold"
                    />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={cn(
                        "font-mono font-semibold tabular-nums whitespace-nowrap",
                        row.status === "attractive"
                          ? "text-positive-strong"
                          : "text-muted-foreground",
                      )}
                    >
                      {row.marginPercent}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
