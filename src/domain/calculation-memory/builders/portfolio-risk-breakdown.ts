/**
 * Builders puros de Memória de Cálculo para Riscos Estruturais da Carteira (Fase 2B).
 * Consome exatamente os operandos emitidos pelos motores da Fase 2A (sem relógio/hooks/FX).
 */

import type { PortfolioRiskPolicy } from "@/domain/portfolio/portfolio-risk-policy";
import { formatDateBR } from "@/lib/date";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

export interface RiskConstituent {
  assetId: string;
  ticker: string;
  valueCents: number;
  source: "position" | "cost_fallback";
}

interface RiskEvidenceBase {
  asOf: string;
  totalCents: number;
  constituents: readonly RiskConstituent[];
  fallbackTickers?: readonly string[];
  policy: PortfolioRiskPolicy;
}

export type RiskEvidence =
  | (RiskEvidenceBase & {
      kind: "asset";
      itemId: string;
      ticker: string;
      weightPct: number;
      limitPct: number;
    })
  | (RiskEvidenceBase & {
      kind: "issuer";
      issuerKey: string;
      issuerLabel: string;
      exposureCents: number;
      rfCents: number;
      classPct: number;
      globalPct: number;
      breachedLimit: "fgc_absolute" | "rf_class" | "global";
    })
  | (RiskEvidenceBase & {
      kind: "macro";
      macroKey: string;
      macroLabel: string;
      classCents: number;
      exposureCents: number;
      classPct: number;
      globalPct: number;
      breachedLimit: "in_class" | "global";
    })
  | (RiskEvidenceBase & {
      kind: "nef";
      classCents: number;
      weights: ReadonlyArray<{ ticker: string; weight: number; weightSq: number }>;
      hhi: number;
      nef: number;
    })
  | (RiskEvidenceBase & {
      kind: "benchmark";
      benchmarkKey: string;
      benchmarkLabel: string;
      exposureCents: number;
      weightPct: number;
      limitPct: number;
    });

function buildFallbackNotes(fallbackTickers?: readonly string[]): string[] {
  if (!fallbackTickers || fallbackTickers.length === 0) return [];
  return [
    `Ativos avaliados por custo médio (sem cotação de mercado): ${fallbackTickers.join(", ")}.`,
  ];
}

export function buildPortfolioRiskBreakdown(e: RiskEvidence): CalculationBreakdown {
  const periodLabel = `Posição em ${formatDateBR(e.asOf)}`;
  const fallbackNotes = buildFallbackNotes(e.fallbackTickers);

  if (e.kind === "asset") {
    const assetItem = e.constituents.find((c) => c.assetId === e.itemId) ?? e.constituents[0];
    const assetCents = assetItem?.valueCents ?? 0;
    const steps: BreakdownStep[] = [
      {
        label: `Posição em ${e.ticker}`,
        operator: "=",
        rawValue: assetCents,
        unit: "currency",
        tone: "default",
      },
      {
        label: "Patrimônio Total Considerado",
        operator: "/",
        rawValue: e.totalCents,
        unit: "currency",
        tone: "default",
      },
      {
        label: "Limite Prudencial da Política",
        operator: "=",
        rawValue: e.limitPct,
        unit: "percent",
        tone: "muted",
      },
    ];

    return enrichBreakdown({
      id: `risk-asset-${e.itemId}`,
      title: `Concentração em ${e.ticker}`,
      description: "Mede a participação individual do ativo no patrimônio total frente ao limite da política de risco.",
      periodLabel,
      formulaExpression: "Peso (%) = (Valor do Ativo / Patrimônio Total) × 100",
      unit: "percent",
      steps,
      result: {
        label: `Peso Atual de ${e.ticker}`,
        rawValue: e.weightPct,
        unit: "percent",
        tone: e.weightPct >= e.limitPct ? "negative" : "positive",
      },
      inclusions: ["Ativos econômicos da carteira", "Caixa positivo disponível na corretora (1x)"],
      notes: fallbackNotes.length > 0 ? fallbackNotes : undefined,
    });
  }

  if (e.kind === "issuer") {
    const steps: BreakdownStep[] = e.constituents.map((c) => ({
      label: `${c.ticker}${c.source === "cost_fallback" ? " (custo)" : ""}`,
      operator: "+",
      rawValue: c.valueCents,
      unit: "currency",
      tone: "default",
    }));

    steps.push(
      {
        label: "Exposição Estimada no Emissor",
        operator: "=",
        rawValue: e.exposureCents,
        unit: "currency",
        tone: "negative",
        emphasis: "subtotal",
      },
      {
        label: "Limite Prudencial FGC (Absoluto)",
        operator: "=",
        rawValue: Math.round(e.policy.maxPrivateIssuerFgcBRL * 100),
        unit: "currency",
        tone: "muted",
      },
      {
        label: `Participação na Renda Fixa (Teto ${e.policy.maxPrivateIssuerInFixedIncomePct}%)`,
        operator: "=",
        rawValue: e.classPct,
        unit: "percent",
        tone: e.classPct > e.policy.maxPrivateIssuerInFixedIncomePct ? "negative" : "default",
      },
      {
        label: `Participação Global (Teto ${e.policy.maxPrivateIssuerPct}%)`,
        operator: "=",
        rawValue: e.globalPct,
        unit: "percent",
        tone: e.globalPct > e.policy.maxPrivateIssuerPct ? "negative" : "default",
      },
    );

    const isAbsolute = e.breachedLimit === "fgc_absolute";
    return enrichBreakdown({
      id: `risk-issuer-${e.issuerKey}`,
      title: `Exposição em ${e.issuerLabel}`,
      description:
        "Consolida títulos privados atribuídos ao mesmo emissor e testa os limites absolutos do FGC, na Renda Fixa e global.",
      periodLabel,
      formulaExpression: "Exposição = Soma dos Títulos Privados do Emissor",
      unit: isAbsolute ? "currency" : "percent",
      steps,
      result: {
        label: isAbsolute
          ? "Exposição Estimada no Emissor"
          : e.breachedLimit === "rf_class"
            ? "% da Renda Fixa"
            : "% do Patrimônio Total",
        rawValue: isAbsolute
          ? e.exposureCents
          : e.breachedLimit === "rf_class"
            ? e.classPct
            : e.globalPct,
        unit: isAbsolute ? "currency" : "percent",
        tone: "negative",
      },
      notes: [
        "Classificação por ticker/observações é estimada e não comprova vínculo societário ou elegibilidade ao FGC.",
        ...fallbackNotes,
      ],
    });
  }

  if (e.kind === "macro") {
    const steps: BreakdownStep[] = e.constituents.map((c) => ({
      label: c.ticker,
      operator: "+",
      rawValue: c.valueCents,
      unit: "currency",
      tone: "default",
    }));

    steps.push(
      {
        label: "Total do Bloco Macro",
        operator: "=",
        rawValue: e.exposureCents,
        unit: "currency",
        emphasis: "subtotal",
      },
      {
        label: "Total da Classe Ações (sem caixa)",
        operator: "/",
        rawValue: e.classCents,
        unit: "currency",
      },
      {
        label: "Patrimônio Total (com caixa)",
        operator: "/",
        rawValue: e.totalCents,
        unit: "currency",
      },
    );

    const useClass = e.breachedLimit === "in_class";
    return enrichBreakdown({
      id: `risk-macro-${e.macroKey}`,
      title: `Macrosetor: ${e.macroLabel}`,
      description: "Avalia a concentração do bloco macrosetorial dentro da classe Ações e sobre o patrimônio total.",
      periodLabel,
      formulaExpression: "% na Classe = Bloco / Ações · % Global = Bloco / Patrimônio",
      unit: "percent",
      steps,
      result: {
        label: useClass
          ? `% em Ações (Teto ${e.policy.macroSectorInClassCeilingPct}%)`
          : `% Global (Teto ${e.policy.macroSectorGlobalCeilingPct}%)`,
        rawValue: useClass ? e.classPct : e.globalPct,
        unit: "percent",
        tone: "negative",
      },
      notes: fallbackNotes.length > 0 ? fallbackNotes : undefined,
    });
  }

  if (e.kind === "nef") {
    const steps: BreakdownStep[] = [
      {
        label: "Total na Classe Ações",
        operator: "=",
        rawValue: e.classCents,
        unit: "currency",
      },
      ...e.weights.slice(0, 5).map((w) => ({
        label: `${w.ticker} (peso ${(w.weight * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`,
        operator: "+" as const,
        rawValue: w.weightSq,
        unit: "ratio" as const,
        hint: "Contribuição w_i² para o índice HHI",
      })),
      {
        label: "Índice Herfindahl-Hirschman (HHI = Soma w_i²)",
        operator: "=",
        rawValue: e.hhi,
        unit: "ratio",
        emphasis: "subtotal",
      },
    ];

    return enrichBreakdown({
      id: "risk-nef-stocks",
      title: "Diversificação Efetiva (Nef)",
      description: "Mede a quantas posições igualmente distribuídas a concentração atual da classe Ações equivale.",
      periodLabel,
      formulaExpression: "HHI = Soma(w_i²) · Nef = 1 / HHI",
      unit: "count",
      steps,
      result: {
        label: "Ativos Equivalentes (Nef)",
        rawValue: e.nef,
        unit: "count",
        formattedValue: `${e.nef.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} ativos`,
        tone: e.nef < 3 ? "negative" : "positive",
      },
      notes: fallbackNotes.length > 0 ? fallbackNotes : undefined,
    });
  }

  // benchmark
  const steps: BreakdownStep[] = [
    ...e.constituents.map((c) => ({
      label: c.ticker,
      operator: "+" as const,
      rawValue: c.valueCents,
      unit: "currency" as const,
    })),
    {
      label: "Exposição Somada ao Mesmo Índice",
      operator: "=",
      rawValue: e.exposureCents,
      unit: "currency",
      emphasis: "subtotal",
    },
    {
      label: "Patrimônio Total",
      operator: "/",
      rawValue: e.totalCents,
      unit: "currency",
    },
    {
      label: "Limite Prudencial de Sobreposição",
      operator: "=",
      rawValue: e.limitPct,
      unit: "percent",
      tone: "muted",
    },
  ];

  return enrichBreakdown({
    id: `risk-benchmark-${e.benchmarkKey}`,
    title: `Sobreposição: ${e.benchmarkLabel}`,
    description: "Soma veículos que replicam o mesmo índice de referência frente ao patrimônio total.",
    periodLabel,
    formulaExpression: "Exposição (%) = (Soma dos ETFs do Índice / Patrimônio Total) × 100",
    unit: "percent",
    steps,
    result: {
      label: `Exposição em ${e.benchmarkLabel}`,
      rawValue: e.weightPct,
      unit: "percent",
      tone: e.weightPct > e.limitPct ? "negative" : "positive",
    },
    notes: [
      "Mede exposição compartilhada ao mesmo índice de referência (não mede correlação estatística).",
      ...fallbackNotes,
    ],
  });
}
