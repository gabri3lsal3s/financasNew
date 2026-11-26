/**
 * Construtores de Memória de Cálculo para Investimentos:
 * Custódia, Patrimônio Total, Preço Médio e Lucro/Prejuízo Aberto.
 *
 * Módulo puro (Regra 3 do AGENTS.md e ESPECIFICAÇÃO §1.6 e §3.11):
 * - Patrimônio Total da Carteira (BRL + USD PTAX + Caixa Corretora);
 * - Preço Médio (PM) e Custo de Aquisição (invariante de venda e desdobramento);
 * - Ganho de Capital em Aberto (Cotação vs Retorno Total com Proventos);
 * - Caixa da Corretora e Liquidez Operacional.
 */

import { numberToCents } from "@/domain/money/parse";
import type { CustodyReconciliationSummary } from "@/domain/portfolio/custody-reconciliation";
import type { ProvisionedDividendsSummary } from "@/domain/portfolio/provisioned-dividends";
import type {
  MarketReferenceSummary,
  StaleQuoteGuardResult,
} from "@/domain/portfolio/stale-quote-guard";
import { formatCentsAsCurrency, formatFxRate } from "@/services/masks/money";
import { formatPercent } from "@/services/masks/percent";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

// ---------------------------------------------------------------------------
// 1. Patrimônio Total da Carteira
// ---------------------------------------------------------------------------

export interface PortfolioTotalBreakdownParams {
  totalBRL: number;
  brlAssetsTotal: number;
  usdAssetsTotalBRL?: number;
  usdRate?: number;
  cashBRL: number;
}

export function buildPortfolioTotalBreakdown(
  params: PortfolioTotalBreakdownParams,
): CalculationBreakdown {
  const { totalBRL, brlAssetsTotal, usdAssetsTotalBRL = 0, usdRate = 5.25, cashBRL } = params;

  const totalCents = numberToCents(totalBRL);
  const brlCents = numberToCents(brlAssetsTotal);
  const usdCents = numberToCents(usdAssetsTotalBRL);
  const cashCents = numberToCents(cashBRL);

  const steps: BreakdownStep[] = [
    {
      label: "Ativos Locais em Reais (BRL)",
      operator: "+",
      rawValue: brlCents,
      hint: "Ações brasileiras, FIIs, Fundos, Tesouro Direto e Renda Fixa",
      tone: "portfolio",
    },
  ];

  if (usdCents > 0) {
    steps.push({
      label: `Ativos Internacionais em Dólar (Convertidos PTAX R$ ${(usdRate).toFixed(2).replace(".", ",")})`,
      operator: "+",
      rawValue: usdCents,
      hint: "Stocks, REITs e ETFs cotados em USD e convertidos pelo câmbio comercial oficial",
      tone: "portfolio",
    });
  }

  if (cashCents > 0) {
    steps.push({
      label: "Saldo em Caixa da Corretora / Liquidez",
      operator: "+",
      rawValue: cashCents,
      hint: "Recursos líquidos parados na corretora disponíveis para novas compras ou aportes",
      tone: "default",
    });
  }

  const breakdown: CalculationBreakdown = {
    id: "portfolio-total-patrimonio",
    title: "Patrimônio Total da Carteira",
    description:
      "Soma consolidada de todos os ativos investíveis a valor de mercado atual, convertidos para Reais, somados ao caixa.",
    formulaExpression: "Ativos em BRL + Ativos em USD (PTAX) + Saldo em Caixa",
    unit: "currency",
    steps,
    result: {
      label: "Patrimônio Líquido de Investimentos",
      rawValue: totalCents,
      unit: "currency",
      tone: "portfolio",
      hint: "Valor total líquido que seria obtido se todas as posições fossem precificadas a mercado hoje.",
    },
    inclusions: [
      "Ações, FIIs, Fiagros e ETFs negociados na B3 (cotação de mercado mais recente)",
      "Títulos de Renda Fixa e Tesouro Direto (marcação na curva ou a mercado)",
      "Ativos globais em moeda estrangeira (convertidos via cotação oficial PTAX do BACEN)",
      "Saldo livre em caixa da conta de investimentos",
    ],
    exclusions: [
      "Contas correntes de bancos do dia a dia (estas compõem o Saldo em Conta)",
      "Reserva de emergência mantida fora da corretora",
      "Proventos anunciados com data COM que ainda não foram creditados (provisionados)",
    ],
    notes: [
      "Resiliência de Cotações (§1.6): Ativos sem cotação em tempo real utilizam o último fechamento válido ou valoração manual cadastrada.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 2. Preço Médio (PM) e Custo de Aquisição
// ---------------------------------------------------------------------------

export interface AssetCostBreakdownParams {
  ticker: string;
  quantity: number;
  averagePrice: number;
  currency?: "BRL" | "USD";
  totalCostBRL: number;
  usdRate?: number;
  isTotalValue?: boolean;
}

export function buildAssetCostBreakdown(params: AssetCostBreakdownParams): CalculationBreakdown {
  const {
    ticker,
    quantity,
    averagePrice,
    currency = "BRL",
    totalCostBRL,
    usdRate,
    isTotalValue = false,
  } = params;

  const totalCostCents = numberToCents(totalCostBRL);
  const averagePriceCents = numberToCents(averagePrice);

  const steps: BreakdownStep[] = [];

  if (isTotalValue) {
    steps.push({
      label: "Aporte Principal Aplicado (Custo Original)",
      operator: undefined,
      rawValue: totalCostCents,
      hint: "Capital financeiro originalmente investido no título de renda fixa",
      tone: "default",
    });
  } else {
    steps.push({
      label: "Quantidade em Custódia",
      operator: undefined,
      rawValue: quantity,
      unit: "count",
      hint: "Número total de cotas ou ações atualmente em carteira",
      tone: "default",
    });

    steps.push({
      label: `Preço Médio Ponderado Unitário (${currency})`,
      operator: "x",
      rawValue: averagePriceCents,
      unit: "currency",
      hint: "Média ponderada do custo de aquisição (inclui taxas de corretagem e emolumentos B3)",
      tone: "default",
    });

    if (currency === "USD" && usdRate) {
      steps.push({
        label: `Câmbio PTAX de Aquisição (USD/BRL R$ ${usdRate.toFixed(2).replace(".", ",")})`,
        operator: "x",
        rawValue: Math.round(usdRate * 100),
        unit: "ratio",
        hint: "Taxa cambial média ponderada apurada nos aportes em moeda estrangeira",
        tone: "default",
      });
    }
  }

  const breakdown: CalculationBreakdown = {
    id: `asset-cost-${ticker.toLowerCase().replace(/[^a-z0-9]/g, "-")}`,
    title: `Custo de Aquisição (${ticker})`,
    description: isTotalValue
      ? `Histórico de capital aplicado no título ${ticker}.`
      : `Metodologia contábil de apuração do Preço Médio (PM) de ${ticker}.`,
    formulaExpression: isTotalValue
      ? "Soma dos Aportes Principais Realizados"
      : currency === "USD"
        ? "Quantidade × Preço Médio (USD) × Câmbio Médio (PTAX)"
        : "Quantidade × Preço Médio Unitário",
    unit: "currency",
    steps,
    result: {
      label: "Custo Total de Aquisição",
      rawValue: totalCostCents,
      unit: "currency",
      tone: "default",
      hint: `Capital próprio desembolsado para a montagem da posição de ${ticker}.`,
    },
    inclusions: [
      "Todas as ordens de compra executadas, ponderadas pelo volume e preço de execução",
      "Custos operacionais obrigatórios (taxa de liquidação, emolumentos B3 e corretagem)",
      "Ajustes por desdobramentos (splits) e grupamentos (invariante do custo total)",
    ],
    exclusions: [
      "Vendas parciais NÃO alteram o Preço Médio das cotas remanescentes",
      "Venda total zera estritamente o Preço Médio da posição para a próxima recompra",
    ],
    notes: [
      "Regra da Receita Federal (IN RFB 1.585/2015): O Preço Médio só é recalculado na compra de novas cotas. Vendas reduzem a quantidade sem impactar o PM unitário restante.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 3. Lucro/Prejuízo em Aberto (Unrealized P&L e Retorno da Custódia)
// ---------------------------------------------------------------------------

export interface UnrealizedPnlBreakdownParams {
  ticker?: string;
  currentValueBRL: number;
  totalCostBRL: number;
  unrealizedPnlBRL: number;
  unrealizedPnlPct?: number | null;
  totalDividendsBRL?: number;
  totalReturnPnlBRL?: number;
  totalReturnPct?: number | null;
}

export function buildUnrealizedPnlBreakdown(
  params: UnrealizedPnlBreakdownParams,
): CalculationBreakdown {
  const {
    ticker,
    currentValueBRL,
    totalCostBRL,
    unrealizedPnlBRL,
    unrealizedPnlPct,
    totalDividendsBRL = 0,
    totalReturnPnlBRL = unrealizedPnlBRL + totalDividendsBRL,
    totalReturnPct,
  } = params;

  const currentCents = numberToCents(currentValueBRL);
  const costCents = numberToCents(totalCostBRL);
  const pnlCents = numberToCents(unrealizedPnlBRL);
  const dividendsCents = numberToCents(totalDividendsBRL);
  const totalReturnCents = numberToCents(totalReturnPnlBRL);

  const steps: BreakdownStep[] = [
    {
      label: "Valor de Mercado Atual",
      operator: "+",
      rawValue: currentCents,
      hint: "Posição precificada pela última cotação de mercado ou curva de juros",
      tone: "portfolio",
    },
    {
      label: "Custo Total de Aquisição",
      operator: "-",
      rawValue: costCents,
      hint: "Capital total efetivamente desembolsado para compra das cotas",
      tone: "default",
    },
    {
      label: `Variação de Mercado / Cotação (${unrealizedPnlPct != null ? `${unrealizedPnlPct >= 0 ? "+" : ""}${unrealizedPnlPct.toFixed(1).replace(".", ",")}%` : "—"})`,
      operator: "=",
      rawValue: pnlCents,
      hint: "Ganho ou perda de capital não realizado (flutuação de preço)",
      tone: pnlCents >= 0 ? "positive" : "negative",
    },
  ];

  if (dividendsCents > 0) {
    steps.push({
      label: "Proventos Recebidos da Posição (Dividendos/JCP)",
      operator: "+",
      rawValue: dividendsCents,
      hint: "Rendimentos em dinheiro gerados pelo ativo ao longo da custódia",
      tone: "positive",
    });
  }

  const breakdown: CalculationBreakdown = {
    id: ticker
      ? `asset-pnl-${ticker.toLowerCase().replace(/[^a-z0-9]/g, "-")}`
      : "portfolio-custody-pnl",
    title: ticker ? `Resultado da Custódia (${ticker})` : "Resultado da Custódia Aberta",
    description:
      "Decomposição analítica entre a valorização das cotas no mercado e os proventos acumulados.",
    formulaExpression:
      "Valor de Mercado − Custo de Aquisição + Proventos Acumulados",
    unit: "currency",
    steps,
    result: {
      label: "Retorno Contábil Total",
      rawValue: totalReturnCents,
      unit: "currency",
      tone: totalReturnCents >= 0 ? "positive" : "negative",
      hint: `Resultado integral gerado pela posição (${totalReturnPct != null ? `${totalReturnPct >= 0 ? "+" : ""}${totalReturnPct.toFixed(1).replace(".", ",")}%` : "0,0%"} sobre o custo).`,
    },
    inclusions: [
      "Flutuação das cotações em tempo real ou no fechamento do pregão",
      "Dividendos, JCP, rendimentos de FIIs e amortizações de capital creditadas",
    ],
    exclusions: [
      "Ganho realizado em vendas passadas que já foram liquidadas (compõem o P&L Histórico)",
      "Proventos futuros que ainda não atingiram a data de corte/pagamento",
    ],
    notes: [
      "Marcação a Mercado: O ganho de capital aberto é volátil e não realizado, servindo para tomada de decisão e rebalanceamento sem incidência imediata de IR.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 4. Conciliação Contábil por Custódia Geográfica (Brasil BRL vs. Exterior USD)
// ---------------------------------------------------------------------------

export interface CustodyReconciliationBreakdownParams {
  summary: CustodyReconciliationSummary;
  provisionedSummary?: ProvisionedDividendsSummary | null;
}

export function buildCustodyReconciliationBreakdown(
  params: CustodyReconciliationBreakdownParams,
): CalculationBreakdown {
  const { summary, provisionedSummary } = params;
  const fxFormatted = `R$ ${formatFxRate(summary.fxRateUsed)}`;

  const steps: BreakdownStep[] = [
    {
      label: `Custódia Brasil (BRL — ${formatPercent(summary.custodyBrazilPct)}%)`,
      operator: "+",
      rawValue: summary.custodyBrazilCents,
      hint: `${summary.custodyBrazilAssetsCount} ${
        summary.custodyBrazilAssetsCount === 1 ? "item em BRL" : "itens em BRL"
      } (Ações B3, FIIs, Renda Fixa, BDRs, ETFs B3 e Reserva de Caixa)`,
      tone: "default",
    },
  ];

  if (summary.hasForeignCustody) {
    const usdNativeFormatted = formatCentsAsCurrency(summary.custodyForeignUSDCents, "USD");
    steps.push({
      label: `Custódia Exterior (USD convertido — ${formatPercent(summary.custodyForeignPct)}%)`,
      operator: "+",
      rawValue: summary.custodyForeignBRLCents,
      hint: `${summary.custodyForeignAssetsCount} ${
        summary.custodyForeignAssetsCount === 1 ? "posição custodiada" : "posições custodiadas"
      } diretamente em USD (${usdNativeFormatted} × ${fxFormatted} — ${summary.fxSourceLabel})`,
      tone: "portfolio",
    });
  }

  if (summary.roundingAdjustmentCents !== 0) {
    steps.push({
      label: "Ajuste de Arredondamento de Centavos",
      operator: summary.roundingAdjustmentCents >= 0 ? "+" : "-",
      rawValue: Math.abs(summary.roundingAdjustmentCents),
      hint: "Conciliação exata em centavos inteiros para paridade com o Patrimônio Total",
      tone: "muted",
    });
  }

  const notes: string[] = [
    summary.hasForeignCustody
      ? `ETFs/BDRs listados na B3 permanecem em BRL. Câmbio de referência: ${fxFormatted} (${summary.fxSourceLabel}).`
      : "100% da custódia alocada em ativos locais denominados em Real (BRL).",
  ];

  if (provisionedSummary && provisionedSummary.totalCount > 0) {
    notes.push(
      `Proventos Provisionados: ${provisionedSummary.totalCount} ${
        provisionedSummary.totalCount === 1 ? "evento" : "eventos"
      } a receber (${formatCentsAsCurrency(
        provisionedSummary.totalReceivableBRLCents,
        "BRL",
      )}) permanecem isolados fora do Patrimônio no Fechamento até a liquidação em caixa.`,
    );
  }

  const breakdown: CalculationBreakdown = {
    id: "portfolio-custody-reconciliation",
    title: "Conciliação por Custódia (Brasil vs. Exterior)",
    description:
      "Auditoria contábil por jurisdição de liquidação e moeda de custódia, garantindo paridade exata em centavos inteiros com o Patrimônio no Fechamento.",
    formulaExpression: summary.hasForeignCustody
      ? "Custódia Brasil (BRL) + [Custódia Exterior (USD) × Câmbio PTAX]"
      : "Soma das Posições Custodiadas no Brasil (BRL) + Reserva de Caixa",
    unit: "currency",
    steps,
    result: {
      label: "Patrimônio no Fechamento Conciliado",
      rawValue: summary.closingPatrimonyCents,
      unit: "currency",
      tone: "portfolio",
      hint: `${
        summary.custodyBrazilAssetsCount + summary.custodyForeignAssetsCount
      } ${
        summary.custodyBrazilAssetsCount + summary.custodyForeignAssetsCount === 1
          ? "posição conciliada"
          : "posições conciliadas"
      } com soma exata (100,0% do patrimônio fechado).`,
    },
    inclusions: [
      "Custódia Brasil (BRL): Ações B3, FIIs, Renda Fixa, Tesouro Direto, Reserva de Caixa e ETFs/BDRs listados na B3 (ex: IVVB11, WRLD11) liquidados em Reais",
      ...(summary.hasForeignCustody
        ? [
            `Custódia Exterior (USD): Stocks, REITs e ETFs custodiados diretamente no exterior em dólar, convertidos pelo câmbio de referência ${fxFormatted} (${summary.fxSourceLabel})`,
          ]
        : []),
    ],
    exclusions: [
      "Proventos provisionados ou a confirmar (mantidos fora do Patrimônio no Fechamento e do Caixa por isolamento contábil)",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 5. Posição Consolidada — Referências de Cotações, Câmbio e Diagnóstico de Frescor
// ---------------------------------------------------------------------------

export interface ConsolidatedPositionQuotesBreakdownParams {
  activeAssetsCount: number;
  marketSummary?: MarketReferenceSummary | null;
  staleGuard?: StaleQuoteGuardResult | null;
  degradedTickers?: readonly string[];
}

export function buildConsolidatedPositionQuotesBreakdown(
  params: ConsolidatedPositionQuotesBreakdownParams,
): CalculationBreakdown {
  const { activeAssetsCount, marketSummary, staleGuard, degradedTickers = [] } = params;

  const issues = staleGuard?.issues ?? [];
  const staleSet = new Set<string>([
    ...issues.map((i) => i.ticker.toUpperCase()),
    ...degradedTickers.map((t) => t.toUpperCase()),
  ]);

  const staleCount = Math.min(activeAssetsCount, staleSet.size);
  const upToDateCount = Math.max(0, activeAssetsCount - staleCount);

  const steps: BreakdownStep[] = [
    {
      label: "Ativos com Cotação Sincronizada / Em Dia",
      operator: "+",
      rawValue: upToDateCount,
      unit: "count",
      hint:
        upToDateCount === activeAssetsCount && activeAssetsCount > 0
          ? "100% dos ativos operacionais marcados com cotação recente ou curva válida"
          : "Posições precificadas dentro da janela regular do último pregão encerrado",
      tone: "positive",
    },
  ];

  if (staleGuard?.postTradeStaleTickers && staleGuard.postTradeStaleTickers.length > 0) {
    steps.push({
      label: `Operações de Hoje Pendentes de Pregão D+0 (${staleGuard.postTradeStaleTickers.join(", ")})`,
      operator: "+",
      rawValue: staleGuard.postTradeStaleTickers.length,
      unit: "count",
      hint: "Ordens registradas hoje aguardando atualização da cotação do pregão atual",
      tone: "negative",
    });
  }

  if (staleGuard?.staleMarketTickers && staleGuard.staleMarketTickers.length > 0) {
    steps.push({
      label: `Ativos com Cotação Defasada (${staleGuard.staleMarketTickers.join(", ")})`,
      operator: "+",
      rawValue: staleGuard.staleMarketTickers.length,
      unit: "count",
      hint: "Cotação de mercado com defasagem superior a 1 dia útil do respectivo pregão",
      tone: "negative",
    });
  }

  if (staleGuard?.fallbackTickers && staleGuard.fallbackTickers.length > 0) {
    steps.push({
      label: `Ativos em Estimativa / Fallback (${staleGuard.fallbackTickers.join(", ")})`,
      operator: "+",
      rawValue: staleGuard.fallbackTickers.length,
      unit: "count",
      hint: "Cotação oficial indisponível no momento; utilizando último fechamento ou preço médio",
      tone: "negative",
    });
  }

  const extraDegraded = degradedTickers.filter(
    (t) => !issues.some((i) => i.ticker.toUpperCase() === t.toUpperCase()),
  );
  if (extraDegraded.length > 0) {
    steps.push({
      label: `Ativos com Falha Temporária de Sincronização (${extraDegraded.join(", ")})`,
      operator: "+",
      rawValue: extraDegraded.length,
      unit: "count",
      hint: "Provedor externo indisponível na última tentativa; mantendo última cotação salva",
      tone: "negative",
    });
  }

  if (staleCount === 0) {
    steps.push({
      label: "Ativos com Cotação Desatualizada ou Pendente",
      operator: "+",
      rawValue: 0,
      unit: "count",
      hint: "Nenhum ativo com cotação defasada, pendente em D+0 ou em fallback",
      tone: "muted",
    });
  }

  const notes: string[] = [];

  if (marketSummary?.hasB3Custody) {
    notes.push(
      `Referência B3 (Brasil): ${marketSummary.b3RefLabel ?? "aguardando sincronização"}.`,
    );
  }
  if (marketSummary?.hasForeignCustody) {
    notes.push(
      `Referência Exterior (NYSE/NASDAQ USD): ${marketSummary.usdRefLabel ?? "aguardando sincronização"}.`,
    );
    const fxFormatted = `R$ ${formatFxRate(marketSummary.fxRate)}`;
    notes.push(
      `Câmbio USD/BRL: ${fxFormatted} (${marketSummary.fxSourceLabel}${
        marketSummary.fxRefLabel ? `, ${marketSummary.fxRefLabel}` : ""
      }).`,
    );
  }

  if (issues.length > 0) {
    for (const issue of issues) {
      notes.push(issue.message);
    }
  } else if (extraDegraded.length > 0) {
    notes.push(
      `Ativos aguardando revalidação de cotação: ${extraDegraded.join(", ")}.`,
    );
  } else {
    notes.push(
      "Status de Frescor: Todas as cotações de mercado e taxas de câmbio estão atualizadas e dentro da janela oficial de referência.",
    );
  }

  if (staleGuard?.fxWarning) {
    notes.push(`Alerta Cambial: ${staleGuard.fxWarning}`);
  }

  const breakdown: CalculationBreakdown = {
    id: "portfolio-consolidated-position-quotes",
    title: "Posição Consolidada & Status das Cotações",
    description:
      "Auditoria de frescor das cotações de mercado (B3, Exterior USD e Câmbio PTAX) e identificação nominal de ativos com cotação desatualizada ou em estimativa.",
    formulaExpression: "Ativos Sincronizados + Ativos com Cotação Desatualizada / Fallback",
    unit: "count",
    steps,
    result: {
      label: "Total de Posições Auditadas na Custódia",
      rawValue: activeAssetsCount,
      unit: "count",
      tone: staleCount > 0 ? "negative" : "portfolio",
      hint:
        staleCount > 0
          ? `${staleCount} ${
              staleCount === 1 ? "ativo apresenta" : "ativos apresentam"
            } cotação desatualizada ou em fallback (${Array.from(staleSet).join(", ")}).`
          : "Nenhum ativo com cotação desatualizada.",
    },
    inclusions: [
      "Ações, FIIs, ETFs, BDRs e Criptoativos monitorados via provedores automáticos de mercado",
      "Ativos internacionais em USD convertidos pela cotação de referência PTAX Oficial BCB",
      "Títulos de Renda Fixa e Tesouro Direto precificados por marcação na curva contratada ou valor atualizado",
    ],
    exclusions: [
      "Saldo livre em Reserva de Caixa (liquidez imediata sem variação de cotação)",
      "Posições históricas já encerradas (quantidade igual a zero)",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}
