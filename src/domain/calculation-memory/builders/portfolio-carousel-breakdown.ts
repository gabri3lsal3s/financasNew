/**
 * Builders puros de Memória de Cálculo para Alocação, Governança e Proventos (Fase 2B).
 * Consome exatamente os operandos emitidos pelos motores da Fase 2A.
 */

import { formatDateBR, formatMonthYear } from "@/lib/date";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

export type PortfolioEvidence =
  | {
      kind: "drift";
      investableCents: number;
      classes: ReadonlyArray<{
        name: string;
        valueCents: number;
        targetPct: number;
        diffPp: number;
      }>;
      unallocatedClassesBRL: number;
      unallocatedClassNames?: readonly string[];
      tolerancePp: number;
      selectedClass?: string;
    }
  | {
      kind: "idle";
      cashCents: number;
      components: ReadonlyArray<{ label: string; valueCents: number }>;
      ticketCents: number;
      eligibleClass?: string;
    }
  | {
      kind: "discount";
      ticker: string;
      currency: "BRL" | "USD";
      quote: number;
      ceiling: number;
      quoteSource: string;
      score: number;
      discountPct: number;
    }
  | {
      kind: "lowScore";
      ticker: string;
      score: number;
      scoreLimit: number;
      valueCents: number;
      totalCents: number;
      weightPct: number;
      weightLimitPct: number;
    };

function formatNativePrice(value: number, currency: "BRL" | "USD"): string {
  const prefix = currency === "USD" ? "US$ " : "R$ ";
  return `${prefix}${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
}

export function buildPortfolioCarouselBreakdown(e: PortfolioEvidence): CalculationBreakdown {
  if (e.kind === "drift") {
    const steps: BreakdownStep[] = [
      {
        label: "Base Investida (sem Caixa)",
        operator: "=",
        rawValue: e.investableCents,
        unit: "currency",
        emphasis: "subtotal",
      },
      ...e.classes.map((cls) => ({
        label: `${cls.name} (Meta ${cls.targetPct.toLocaleString("pt-BR")}%)`,
        operator: "=" as const,
        rawValue: cls.diffPp,
        unit: "percent" as const,
        hint: `Valor atual: R$ ${(cls.valueCents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        tone: (Math.abs(cls.diffPp) > e.tolerancePp ? "negative" : "default") as "negative" | "default",
      })),
    ];

    if (e.unallocatedClassesBRL > 0) {
      steps.push({
        label: `Classes sem meta cadastrada (${(e.unallocatedClassNames ?? []).join(", ") || "Outras"})`,
        operator: "=",
        rawValue: Math.round(e.unallocatedClassesBRL * 100),
        unit: "currency",
        tone: "muted",
      });
    }

    const focusClass =
      (e.selectedClass
        ? e.classes.find((c) => c.name === e.selectedClass)
        : undefined) ??
      [...e.classes].sort((a, b) => Math.abs(b.diffPp) - Math.abs(a.diffPp))[0];

    return enrichBreakdown({
      id: "portfolio-drift",
      title: "Desvio de Alocação por Classe",
      description: `Compara a alocação atual sobre o patrimônio investido contra as metas efetivas (tolerância de ±${e.tolerancePp} p.p.).`,
      formulaExpression: "Desvio (p.p.) = Atual (%) - Meta (%)",
      unit: "percent",
      steps,
      result: {
        label: focusClass ? `Maior Desvio (${focusClass.name})` : "Maior Desvio",
        rawValue: focusClass?.diffPp ?? 0,
        unit: "percent",
        tone: focusClass && Math.abs(focusClass.diffPp) > e.tolerancePp ? "negative" : "positive",
      },
    });
  }

  if (e.kind === "idle") {
    const steps: BreakdownStep[] = e.components.map((comp) => ({
      label: comp.label,
      operator: "+",
      rawValue: comp.valueCents,
      unit: "currency",
      tone: "positive",
    }));
    steps.push({
      label: "Ticket Mínimo da Política",
      operator: "=",
      rawValue: e.ticketCents,
      unit: "currency",
      tone: "muted",
    });

    return enrichBreakdown({
      id: "portfolio-idle-cash",
      title: "Caixa Disponível na Corretora",
      description: "Consolida o saldo líquido pronto para alocação no simulador de aportes.",
      formulaExpression: "Caixa Utilizável = Soma dos Saldos em Caixa >= Ticket Mínimo",
      unit: "currency",
      steps,
      result: {
        label: e.eligibleClass ? `Caixa Pronto (Destino: ${e.eligibleClass})` : "Caixa Pronto para Aporte",
        rawValue: e.cashCents,
        unit: "currency",
        tone: "portfolio",
      },
    });
  }

  if (e.kind === "discount") {
    const steps: BreakdownStep[] = [
      {
        label: `Preço Teto (${e.currency})`,
        operator: "=",
        rawValue: Math.round(e.ceiling * 100),
        unit: "currency",
        formattedValue: formatNativePrice(e.ceiling, e.currency),
      },
      {
        label: `Cotação Atual (${e.quoteSource})`,
        operator: "-",
        rawValue: Math.round(e.quote * 100),
        unit: "currency",
        formattedValue: formatNativePrice(e.quote, e.currency),
      },
      {
        label: "Nota de Convicção",
        operator: "=",
        rawValue: e.score,
        unit: "count",
        formattedValue: `${e.score}/10`,
      },
    ];

    return enrichBreakdown({
      id: `portfolio-discount-${e.ticker}`,
      title: `Margem de Segurança: ${e.ticker}`,
      description: "Calcula o desconto percentual entre a cotação observável e o Preço Teto na mesma moeda.",
      formulaExpression: "Margem (%) = ((Preço Teto - Cotação) / Preço Teto) × 100",
      unit: "percent",
      steps,
      result: {
        label: `Margem em ${e.ticker}`,
        rawValue: e.discountPct,
        unit: "percent",
        tone: e.discountPct >= 15 ? "positive" : "default",
      },
    });
  }

  // lowScore
  const steps: BreakdownStep[] = [
    {
      label: `Valor em ${e.ticker} (Nota ${e.score}/${e.scoreLimit} máx.)`,
      operator: "=",
      rawValue: e.valueCents,
      unit: "currency",
      tone: "negative",
    },
    {
      label: "Patrimônio Total da Carteira",
      operator: "/",
      rawValue: e.totalCents,
      unit: "currency",
    },
    {
      label: "Limite Prudencial para Baixa Convicção",
      operator: "=",
      rawValue: e.weightLimitPct,
      unit: "percent",
      tone: "muted",
    },
  ];

  return enrichBreakdown({
    id: `portfolio-lowscore-${e.ticker}`,
    title: `Sobrepeso em Baixa Convicção: ${e.ticker}`,
    description: `Ativo com nota <= ${e.scoreLimit} excedendo o limite de ${e.weightLimitPct}% do patrimônio total.`,
    formulaExpression: "Exposição (%) = (Valor do Ativo / Patrimônio Total) × 100",
    unit: "percent",
    steps,
    result: {
      label: `Exposição de ${e.ticker}`,
      rawValue: e.weightPct,
      unit: "percent",
      tone: e.weightPct > e.weightLimitPct ? "negative" : "default",
    },
  });
}

export interface DividendEvidenceItem {
  key: string;
  ticker: string;
  currency: "BRL" | "USD";
  quantityOnComDate: number;
  grossRate: number;
  netRate: number;
  taxPct: number;
  taxSource: string;
  paymentDate?: string | null;
  nativeNetCents: number;
  netBRLCents: number;
  included: boolean;
  reason?: string;
}

export interface DividendEvidence {
  kind: "available" | "monthly";
  asOf: string;
  month?: string;
  fxRate: number;
  items: readonly DividendEvidenceItem[];
  count: number;
  totalBRLCents: number;
}

export function buildDividendCarouselBreakdown(e: DividendEvidence): CalculationBreakdown {
  const includedItems = e.items.filter((i) => i.included);
  const excludedItems = e.items.filter((i) => !i.included);
  const hasUsd = includedItems.some((i) => i.currency === "USD");
  const hasUndated = includedItems.some((i) => !i.paymentDate);

  const steps: BreakdownStep[] = includedItems.map((item) => ({
    label: `${item.ticker} (${item.quantityOnComDate.toLocaleString("pt-BR")} × ${formatNativePrice(item.netRate, item.currency)} · IR ${item.taxPct.toLocaleString("pt-BR")}%)`,
    operator: "+",
    rawValue: item.netBRLCents,
    unit: "currency",
    hint:
      item.currency === "USD"
        ? `Líquido nativo ${formatNativePrice(item.nativeNetCents / 100, "USD")} · FX ${e.fxRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} · ${item.taxSource}${item.paymentDate ? ` · Pgto ${formatDateBR(item.paymentDate)}` : " · Sem data de pagamento"}`
        : `${item.taxSource}${item.paymentDate ? ` · Pgto ${formatDateBR(item.paymentDate)}` : " · Sem data de pagamento"}`,
    tone: "positive",
  }));

  const breakdown: CalculationBreakdown = {
    id: e.kind === "available" ? "portfolio-dividends-available" : "portfolio-dividends-monthly",
    title:
      e.kind === "available"
        ? "Proventos Pendentes de Conferência"
        : "Proventos Previstos no Mês",
    description:
      e.kind === "available"
        ? "Soma o valor líquido estimado dos proventos já elegíveis para conferência e crédito."
        : "Soma os proventos anunciados com pagamento previsto dentro da competência selecionada.",
    periodLabel: e.month ? formatMonthYear(e.month) : `Posição em ${formatDateBR(e.asOf)}`,
    formulaExpression: "Líquido (BRL) = Soma(Qtd Data-COM × Taxa Líquida × FX)",
    unit: "currency",
    steps,
    result: {
      label:
        e.kind === "available"
          ? `Total a Conferir (${e.count} eventos)`
          : `Total Previsto (${e.count} eventos)`,
      rawValue: e.totalBRLCents,
      unit: "currency",
      tone: "positive",
    },
    exclusions:
      excludedItems.length > 0
        ? excludedItems.map((ex) => `${ex.ticker}: ${ex.reason ?? "fora da competência/janela"}`)
        : undefined,
    notes: [
      ...(hasUsd ? [`Conversão USD/BRL aplicada pelo câmbio de referência (${e.fxRate.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).`] : []),
      ...(hasUndated ? ["Eventos sem data de pagamento confirmada não representam crédito já realizado em caixa."] : []),
    ],
  };

  return enrichBreakdown(breakdown);
}
