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

import { numberToCents } from "@/domain/money";
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
