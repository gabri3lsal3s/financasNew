/**
 * Construtores de Memória de Cálculo para Rebalanceamento Inteligente e Aportes:
 * Hierarquia Tripla (Classe -> Setor -> Ativo), Resíduo em Caixa e Diagnóstico de Cortes (AUD-08).
 *
 * Módulo puro (Regra 3 do AGENTS.md e FINANCIAL_MATH_SPEC §5):
 * - Estágio 1: Macro-alocação por déficit relativo da classe;
 * - Estágio 2: Meso-alocação por déficit setorial na classe;
 * - Estágio 3: Micro-alocação por ativo com lotes inteiros (B3) ou fracionários (USD/Cripto);
 * - Invariante de Orçamento: Total Alocado + Sobra == Aporte Informado;
 * - Resolução do Bug AUD-08: Diagnóstico transparente do motivo de corte de ativos preteridos.
 */

import { numberToCents } from "@/domain/money";
import type {
  AporteOverflowEvent,
  ClassAporteSummary,
  PausedAssetDiagnostic,
  SectorAporteSummary,
  SkippedAssetDiagnostic,
} from "@/domain/portfolio";
import { formatCentsAsBRL } from "@/services/masks/money";
import { formatPercent } from "@/services/masks/percent";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

// ---------------------------------------------------------------------------
// 1. Memória Consolidada do Aporte (Cockpit e Síntese de Alocação)
// ---------------------------------------------------------------------------

export interface AporteBreakdownParams {
  /** Valor total de poder de compra considerado pelo motor em BRL. */
  aporteTotalBRL: number;
  /** Dinheiro novo aportado do bolso em BRL (opcional se decomposto). */
  pocketAmountBRL?: number;
  /** Saldo em caixa da corretora aproveitado em BRL (opcional se decomposto). */
  cashUsedBRL?: number;
  /** Total efetivamente alocado nas ordens de compra em BRL. */
  totalAllocatedBRL: number;
  /** Resíduo/sobra não alocada que permanece em caixa em BRL. */
  leftoverBRL: number;
  /** Resumos de distribuição por classe. */
  classSummaries?: readonly ClassAporteSummary[];
  /** Resumos de distribuição por setor. */
  sectorSummaries?: readonly SectorAporteSummary[];
  /** Ativos que foram ignorados e o motivo do corte (AUD-08). */
  skippedAssets?: readonly SkippedAssetDiagnostic[];
  /** Ativos pausados por travas prudenciais e limites de risco (AUD-08). */
  pausedAssets?: readonly PausedAssetDiagnostic[];
  /** Eventos de transbordamento de verba entre classes e setores. */
  overflowEvents?: readonly AporteOverflowEvent[];
  /** Estratégia de rebalanceamento adotada. */
  strategy?: "optimized" | "proportional";
  /** Modo de rebalanceamento operacional. */
  mode?: "sector_oriented" | "asset_prescriptive" | "both" | "asset" | "class";
}

export function buildAporteBreakdown(params: AporteBreakdownParams): CalculationBreakdown {
  const {
    aporteTotalBRL,
    pocketAmountBRL,
    cashUsedBRL,
    totalAllocatedBRL,
    leftoverBRL,
    classSummaries = [],
    skippedAssets = [],
    pausedAssets = [],
    strategy = "optimized",
  } = params;

  const totalPurchasingCents = numberToCents(aporteTotalBRL);
  const totalAllocatedCents = numberToCents(totalAllocatedBRL);
  const leftoverCents = numberToCents(leftoverBRL);

  const effectiveCashUsed = cashUsedBRL ?? 0;
  const effectivePocket = pocketAmountBRL ?? Math.max(0, aporteTotalBRL - effectiveCashUsed);
  const pocketCents = numberToCents(effectivePocket);
  const cashUsedCents = numberToCents(effectiveCashUsed);

  const steps: BreakdownStep[] = [
    {
      label: "Dinheiro Novo do Bolso (Aporte Externo)",
      operator: "+",
      rawValue: pocketCents,
      unit: "currency",
      hint: "Capital novo transferido da sua conta bancária para investimento",
      tone: "default",
    },
  ];

  if (cashUsedCents > 0) {
    steps.push({
      label: "Saldo em Caixa da Corretora Aproveitado",
      operator: "+",
      rawValue: cashUsedCents,
      unit: "currency",
      hint: "Recursos líquidos que já estavam parados na conta de investimentos",
      tone: "portfolio",
    });
    steps.push({
      label: "Poder de Compra Total (Bolso + Caixa)",
      operator: "=",
      rawValue: totalPurchasingCents,
      unit: "currency",
      hint: "Orçamento total disponível para a simulação de compras",
      tone: "default",
      emphasis: "subtotal",
    });
  }

  // Decomposição por classe atendida
  const activeClasses = classSummaries.filter((cs) => cs.actualAllocatedBRL > 0);
  for (const cs of activeClasses) {
    const allocatedCents = numberToCents(cs.actualAllocatedBRL);
    steps.push({
      label: `Alocação na Classe: ${cs.className}`,
      operator: "-",
      rawValue: allocatedCents,
      unit: "currency",
      hint: `Déficit inicial: ${formatCentsAsBRL(numberToCents(cs.gapBRL))}. Meta: ${formatPercent(cs.targetPct)}% da carteira.`,
      tone: "portfolio",
    });
  }

  // Se houver resíduo não alocado
  if (leftoverCents > 0) {
    steps.push({
      label: "Sobra Não Alocada (Permanece em Caixa)",
      operator: "=",
      rawValue: leftoverCents,
      unit: "currency",
      hint: "Resíduo que não comprou 1 cota inteira adicional de ativos elegíveis na B3",
      tone: "muted",
      emphasis: "subtotal",
    });
  }

  // Diagnósticos de auditoria AUD-08
  const diagnosticNotes: string[] = [
    strategy === "proportional"
      ? "Estratégia Proporcional: A verba foi rateada entre todos os ativos abaixo da meta."
      : "Estratégia Menos Movimentações (Otimizado): A verba foi concentrada nos maiores déficits para evitar micro-ordens e reduzir fricção.",
  ];

  if (leftoverCents > 0) {
    diagnosticNotes.push(
      `Invariante de Lote Inteiro B3: Sobra de ${formatCentsAsBRL(leftoverCents)} preservada em caixa porque nenhuma cota inteira de ativo deficitário custava menos que este saldo residual.`,
    );
  }

  // Diagnóstico AUD-08: Justificativas transparentes de ativos preteridos
  if (skippedAssets.length > 0) {
    const priceExceeds = skippedAssets.filter((a) => a.reason === "price_exceeds_budget");
    const aboveTarget = skippedAssets.filter((a) => a.reason === "above_target");
    const noTarget = skippedAssets.filter((a) => a.reason === "no_target");
    const quarantineOrNeutral = skippedAssets.filter(
      (a) => a.reason === "quarantine" || a.reason === "neutral" || a.reason === "exit",
    );

    if (priceExceeds.length > 0) {
      const tickers = priceExceeds.slice(0, 3).map((a) => a.ticker).join(", ");
      const more = priceExceeds.length > 3 ? ` e mais ${priceExceeds.length - 3}` : "";
      diagnosticNotes.push(
        `Preço supera a verba restante: ${tickers}${more} não foram comprados porque o preço de 1 cota inteira ultrapassa o orçamento da classe.`,
      );
    }

    if (aboveTarget.length > 0) {
      diagnosticNotes.push(
        `${aboveTarget.length} ativo(s) já atingiram ou superaram a meta ideal e não receberam novos aportes para evitar sobrealocação.`,
      );
    }

    if (noTarget.length > 0) {
      diagnosticNotes.push(
        `${noTarget.length} ativo(s) não possuem meta percentual configurada e foram ignorados pelo algoritmo de rebalanceamento.`,
      );
    }

    if (quarantineOrNeutral.length > 0) {
      const tickers = quarantineOrNeutral.map((a) => a.ticker).join(", ");
      diagnosticNotes.push(
        `Status de alocação restrito: ${tickers} estão em quarentena, neutros ou em desinvestimento e não recebem novos recursos.`,
      );
    }
  }

  // Diagnóstico AUD-08: Travas prudenciais ativas
  if (pausedAssets.length > 0) {
    const qualityLocks = pausedAssets.filter((a) => a.reason === "quality_lock");
    const ceilings = pausedAssets.filter(
      (a) =>
        a.reason === "asset_ceiling" ||
        a.reason === "sector_ceiling" ||
        a.reason === "macro_sector_ceiling" ||
        a.reason === "issuer_ceiling",
    );

    if (qualityLocks.length > 0) {
      const tickers = qualityLocks.slice(0, 3).map((a) => a.ticker).join(", ");
      diagnosticNotes.push(
        `Trava de qualidade fundamentalista: ${tickers} possuem nota fundamentalista <= 5 e foram pausados preventivamente.`,
      );
    }

    if (ceilings.length > 0) {
      diagnosticNotes.push(
        `${ceilings.length} ativo(s) atingiram tetos prudenciais de concentração máxima (individual 15%, setor 35% ou emissor de RF).`,
      );
    }
  }

  const breakdown: CalculationBreakdown = {
    id: "portfolio-aporte-cockpit-breakdown",
    title: "Distribuição e Engenharia do Aporte",
    description:
      "Alocação hierárquica em 3 estágios (Classe -> Setor -> Ativo) com arredondamento para lotes inteiros da B3 e preservação de sobras.",
    periodLabel: "Simulação de Aporte Ativa",
    formulaExpression:
      "Poder de Compra (Bolso + Caixa) = Total Alocado em Ativos + Sobra que Permanece em Caixa",
    unit: "currency",
    steps,
    result: {
      label: "Total Efetivamente Alocado em Ativos",
      rawValue: totalAllocatedCents,
      unit: "currency",
      tone: "portfolio",
      hint: `Total de ${formatCentsAsBRL(totalAllocatedCents)} alocado em compras sugeridas (${formatCentsAsBRL(leftoverCents)} seguro em caixa).`,
    },
    inclusions: [
      "Estágio 1 (Macro): Orçamentação proporcional ao déficit relativo de cada classe (Meta - Atual) / Meta",
      "Estágio 2 (Meso): Priorização dos setores internos mais defasados dentro de cada classe",
      "Estágio 3 (Micro): Dimensionamento de cotas inteiras para ativos B3 (>= 1) e frações para ativos globais (USD)",
      "Invariante de Orçamento: A soma dos aportes sugeridos NUNCA excede o valor total informado",
    ],
    exclusions: [
      "Venda forçada de ativos (o rebalanceamento é 100% passivo via aportes, sem gerar giro de carteira ou DARF)",
      "Ativos que já atingiram ou ultrapassaram a meta (não compramos no topo da alocação)",
      "Frações fraturadas em ações e FIIs da B3 (arredondamento prudencial para baixo)",
    ],
    notes: diagnosticNotes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 2. Memória de Cálculo da Sugestão Individual de um Ativo
// ---------------------------------------------------------------------------

export interface AporteAssetRouteBreakdownParams {
  ticker: string;
  assetClass: string | null;
  sector?: string | null;
  currentValueBRL: number;
  targetValueBRL: number;
  gapBRL: number;
  priceBRL: number;
  quantity: number;
  allocatedBRL: number;
  currency?: string;
  effectiveTargetPct?: number;
  reasonLabel?: string;
  ceilingReason?: string;
}

export function buildAporteAssetRouteBreakdown(
  params: AporteAssetRouteBreakdownParams,
): CalculationBreakdown {
  const {
    ticker,
    assetClass,
    sector,
    currentValueBRL,
    targetValueBRL,
    gapBRL,
    priceBRL,
    quantity,
    allocatedBRL,
    currency = "BRL",
    effectiveTargetPct,
    reasonLabel,
    ceilingReason,
  } = params;

  const currentCents = numberToCents(currentValueBRL);
  const targetCents = numberToCents(targetValueBRL);
  const gapCents = numberToCents(gapBRL);
  const allocatedCents = numberToCents(allocatedBRL);

  const steps: BreakdownStep[] = [
    {
      label: `Meta Financeira Alvo em Carteira (${effectiveTargetPct ? `${formatPercent(effectiveTargetPct)}%` : "Meta"})`,
      operator: "+",
      rawValue: targetCents,
      unit: "currency",
      hint: "Patrimônio ideal que este ativo deveria representar de acordo com suas metas",
      tone: "default",
    },
    {
      label: "Posição Atual em Custódia",
      operator: "-",
      rawValue: currentCents,
      unit: "currency",
      hint: "Valor total investido atualmente a preço de mercado",
      tone: "muted",
    },
    {
      label: "Déficit Teórico de Alocação (Gap)",
      operator: "=",
      rawValue: gapCents,
      unit: "currency",
      hint: `Valor necessário para atingir a meta plena: ${formatCentsAsBRL(gapCents)}`,
      tone: gapCents > 0 ? "positive" : "default",
      emphasis: "subtotal",
    },
    {
      label: `Cotação de Mercado (${currency === "USD" ? "USD" : "BRL"})`,
      rawValue: numberToCents(priceBRL),
      unit: "currency",
      hint: `Preço unitário de execução: ${formatCentsAsBRL(numberToCents(priceBRL))}`,
      tone: "default",
    },
    {
      label: `Quantidade Sugerida (${currency === "USD" ? "Frações permitidas" : "Cotas inteiras B3"})`,
      operator: "x",
      rawValue: quantity,
      unit: currency === "USD" ? "ratio" : "count",
      hint: `${quantity} ${quantity === 1 ? "cota sugerida" : "cotas sugeridas"} pelo algoritmo`,
      tone: "portfolio",
    },
  ];

  const notes: string[] = [
    `Roteamento Inteligente: ${reasonLabel ?? "Ativo selecionado pela maior defasagem frente à meta da classe."}`,
  ];

  if (ceilingReason) {
    notes.push(
      `Restrição de Teto: A quantidade foi limitada pelo limite de concentração prudencial (${ceilingReason}).`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: `aporte-route-${ticker.toLowerCase()}`,
    title: `Ordem Sugerida - ${ticker}`,
    description: `Cálculo da quantidade e valor alocado para ${ticker} (${assetClass ?? "Ativo"}${sector ? ` - ${sector}` : ""}).`,
    formulaExpression: "Quantidade Sugerida * Preco Unitario = Valor Alocado no Ativo",
    unit: "currency",
    steps,
    result: {
      label: `Valor Alocado em ${ticker}`,
      rawValue: allocatedCents,
      unit: "currency",
      tone: "portfolio",
      hint: `${quantity} cotas * ${formatCentsAsBRL(numberToCents(priceBRL))} = ${formatCentsAsBRL(allocatedCents)}.`,
    },
    inclusions: [
      "Meta percentual proporcional dentro da classe e setor correspondentes",
      "Arredondamento para baixo garantindo cumprimento do limite do aporte",
      "Preço de mercado da cotação mais recente cadastrada ou obtida via cotação",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}
