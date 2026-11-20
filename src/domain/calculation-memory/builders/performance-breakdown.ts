/**
 * Construtores de Memória de Cálculo para Performance e Proventos de Investimentos:
 * TWR (Cotas CVM/ANBIMA), TIR (Fluxo do Bolso / XIRR), P&L Histórico Total e YoC vs DY.
 *
 * Módulo puro (Regra 3 do AGENTS.md e FINANCIAL_MATH_SPEC §4):
 * - TWR: Encadeamento geométrico de cotas imune a fluxos externos (Cura do Bug AUD-02);
 * - TIR / XIRR: Ponderação no tempo com fluxos reais de caixa (Tríplice Ótica);
 * - P&L Histórico Total: Consolidação contábil da riqueza líquida da vida (Realizado + Aberto + Proventos);
 * - Yield on Cost (YoC) vs Dividend Yield (DY): Retorno sobre o capital desembolsado vs rendimento corrente.
 */

import { numberToCents } from "@/domain/money";
import { formatPercent, formatSignedPct } from "@/services/masks/percent";
import { enrichBreakdown } from "../formatters";
import type { BreakdownStep, CalculationBreakdown } from "../types";

// ---------------------------------------------------------------------------
// 1. Rentabilidade Ponderada pelo Tempo / TWR (Cotas — Padrão CVM / ANBIMA)
// ---------------------------------------------------------------------------

export interface TwrBreakdownParams {
  /** Taxa acumulada no período (% ex: 18.4 para +18,4%). */
  accumulatedRatePct: number | null;
  /** Taxa anualizada (% a.a. ex: 14.2 para +14,2% a.a.) apenas se meses >= 12. */
  annualizedRatePct?: number | null;
  /** Quantidade total de meses avaliados. */
  monthsElapsed?: number;
  /** Valor atual da cota da carteira (base inicial 100,00). */
  currentSharePrice?: number;
  /** Diagnóstico de integridade da série. */
  status?: "ok" | "empty" | "insufficient_history" | string;
  /** Cota base inicial (padrão 100,00). */
  baseSharePrice?: number;
}

export function buildTwrBreakdown(params: TwrBreakdownParams): CalculationBreakdown {
  const {
    accumulatedRatePct,
    annualizedRatePct = null,
    monthsElapsed = 0,
    currentSharePrice,
    status = "ok",
    baseSharePrice = 100.0,
  } = params;

  const isOk = status === "ok" && accumulatedRatePct !== null;
  const safeRate = isOk ? (accumulatedRatePct ?? 0) : 0;
  const safeCurrentShare =
    currentSharePrice ?? Math.round(baseSharePrice * (1 + safeRate / 100) * 100) / 100;

  const steps: BreakdownStep[] = [
    {
      label: "Cota Base Inicial (Marco Zero)",
      rawValue: baseSharePrice,
      unit: "ratio",
      hint: "Cota teórica de referência fixada em 100,00 na inauguração da carteira",
      tone: "default",
    },
    {
      label: "Valor Atual da Cota da Carteira",
      operator: "=",
      rawValue: safeCurrentShare,
      unit: "ratio",
      hint:
        monthsElapsed > 0
          ? `Patrimônio atual ponderado por cotas após ${monthsElapsed} ${monthsElapsed === 1 ? "mês" : "meses"} de histórico`
          : "Patrimônio atual ponderado por cotas",
      tone: "portfolio",
    },
    {
      label: "Rentabilidade Acumulada no Período (TWR)",
      operator: "=",
      rawValue: safeRate,
      unit: "percent",
      hint: "Encadeamento geométrico: R_twr = ∏(1 + r_t) − 1 (imune a aportes e resgates externos)",
      tone: safeRate >= 0 ? "positive" : "negative",
      emphasis: "total",
    },
  ];

  if (annualizedRatePct !== null && annualizedRatePct !== undefined && monthsElapsed >= 12) {
    steps.push({
      label: "Taxa Anualizada CVM (Padrão ANBIMA)",
      operator: "=",
      rawValue: annualizedRatePct,
      unit: "percent",
      hint: `(1 + R_acum)^(12/${monthsElapsed}) − 1. Taxa média anual composta para ${monthsElapsed} meses fechados`,
      tone: annualizedRatePct >= 0 ? "positive" : "negative",
      emphasis: "subtotal",
    });
  }

  const notes: string[] = [
    "Metodologia Oficial ANBIMA/CVM: O método de cotas garante que um aporte volumoso em um mês de queda não mascare a performance real da estratégia.",
  ];

  if (monthsElapsed < 12) {
    notes.push(
      "Salvaguarda CVM 19/2021: Séries históricas com menos de 12 meses fechados não são anualizadas para prevenir projeções artificiais de curto prazo.",
    );
  }

  if (!isOk) {
    notes.push(
      "Histórico em formação: cadastre seus ativos e fechamentos mensais para iniciar a apuração da série de cotas.",
    );
  }

  const breakdown: CalculationBreakdown = {
    id: "portfolio-twr-breakdown",
    title: "Rentabilidade Ponderada pelo Tempo (TWR · Cotas)",
    description:
      "Métrica oficial que apura o mérito das decisões de investimento isolando o impacto do tamanho e momento de aportes e resgates.",
    periodLabel: monthsElapsed > 0 ? `${monthsElapsed} ${monthsElapsed === 1 ? "mês" : "meses"} avaliados` : "Em formação",
    formulaExpression:
      annualizedRatePct !== null && monthsElapsed >= 12
        ? "R_acum = ∏(1 + r_t) − 1 | R_anual = (1 + R_acum)^(12/N) − 1"
        : "R_acum = ∏(1 + r_t) − 1 = (Cota_Atual ÷ Cota_Inicial) − 1",
    unit: "percent",
    steps,
    result: {
      label: "Rentabilidade Acumulada da Carteira",
      rawValue: safeRate,
      unit: "percent",
      tone: isOk ? (safeRate >= 0 ? "positive" : "negative") : "muted",
      hint: isOk
        ? `Retorno real ponderado por cotas. Cota atual: ${safeCurrentShare.toFixed(2).replace(".", ",")}.`
        : "Histórico de cotas em formação.",
    },
    inclusions: [
      "Variação de cotação a mercado de todos os ativos da carteira (ações, FIIs, títulos, ETFs)",
      "Proventos e rendimentos recebidos e reinvestidos no portfólio",
      "Ponderação temporal exata de aportes e retiradas no mês (Modified Dietz ANBIMA)",
      "Encadeamento geométrico contínuo de subperíodos mensais sem quebra cronológica",
    ],
    exclusions: [
      "Volume absoluto de aportes novos (o TWR mede a qualidade das escolhas de investimento, não a renda do investidor)",
      "Variações cambiais conjunturais não decorrentes dos ativos estrangeiros em carteira",
      "Imposto de renda sobre resgates ainda não realizados",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 2. Retorno do Bolso / TIR (Taxa Interna de Retorno / XIRR)
// ---------------------------------------------------------------------------

export interface IrrBreakdownParams {
  /** Taxa anualizada (% a.a. ex: 14.5 para +14,5% a.a.) calculada apenas se dias >= 365. */
  annualizedRatePct: number | null;
  /** Taxa acumulada simples no período (% total sobre o capital aportado). */
  periodRatePct?: number | null;
  /** Dias corridos decorridos desde o primeiro aporte. */
  daysElapsed?: number;
  /** Elegibilidade temporal (mínimo 30 dias de histórico). */
  isEligible?: boolean;
  /** Status da convergência do solver Newton-Raphson. */
  status?: string;
  /** Total de aportes externos injetados do bolso em BRL (opcional). */
  totalInflowsBRL?: number;
  /** Total de resgates sacados para o bolso em BRL (opcional). */
  totalOutflowsBRL?: number;
  /** Patrimônio atual a mercado na data de avaliação em BRL (opcional). */
  currentValueBRL?: number;
  /** Percentual do patrimônio coberto pelo capital aportado registrado (ex: 100 para 100%). */
  capitalCoveragePct?: number;
}

export function buildIrrBreakdown(params: IrrBreakdownParams): CalculationBreakdown {
  const {
    annualizedRatePct,
    periodRatePct = null,
    daysElapsed = 0,
    isEligible = false,
    status = "ok",
    totalInflowsBRL,
    totalOutflowsBRL,
    currentValueBRL,
    capitalCoveragePct,
  } = params;

  const hasAnnualized = isEligible && annualizedRatePct !== null;
  const hasPeriod = isEligible && periodRatePct !== null;
  const effectiveRate = hasAnnualized ? (annualizedRatePct ?? 0) : hasPeriod ? (periodRatePct ?? 0) : 0;

  const steps: BreakdownStep[] = [];

  if (totalInflowsBRL !== undefined && totalInflowsBRL > 0) {
    steps.push({
      label: "Aportes Externos Realizados (Saídas do Bolso)",
      operator: "+",
      rawValue: numberToCents(totalInflowsBRL),
      unit: "currency",
      hint: "Dinheiro novo transferido da sua conta bancária corrente para a corretora",
      tone: "default",
    });
  }

  if (totalOutflowsBRL !== undefined && totalOutflowsBRL > 0) {
    steps.push({
      label: "Resgates e Retiradas (Entradas no Bolso)",
      operator: "-",
      rawValue: numberToCents(totalOutflowsBRL),
      unit: "currency",
      hint: "Recursos sacados da corretora de volta para o seu dia a dia",
      tone: "positive",
    });
  }

  if (currentValueBRL !== undefined && currentValueBRL > 0) {
    steps.push({
      label: "Patrimônio Atual a Mercado (Liquidação Hipotética)",
      operator: "=",
      rawValue: numberToCents(currentValueBRL),
      unit: "currency",
      hint: "Saldo final da carteira precificado a mercado na data de encerramento",
      tone: "portfolio",
    });
  }

  if (hasPeriod) {
    steps.push({
      label: "Retorno do Bolso no Período",
      operator: "=",
      rawValue: periodRatePct ?? 0,
      unit: "percent",
      hint:
        daysElapsed > 0
          ? `Retorno financeiro acumulado ponderado pelo tempo em ${daysElapsed} dias corridos`
          : "Retorno financeiro acumulado do capital aportado",
      tone: (periodRatePct ?? 0) >= 0 ? "positive" : "negative",
      emphasis: hasAnnualized ? "subtotal" : "total",
    });
  }

  if (hasAnnualized) {
    steps.push({
      label: "Taxa Interna de Retorno Anualizada (TIR / XIRR)",
      operator: "=",
      rawValue: annualizedRatePct ?? 0,
      unit: "percent",
      hint: `Taxa composta equivalente ao ano (% a.a.) que iguala o VPL a zero em ${daysElapsed} dias corridos`,
      tone: (annualizedRatePct ?? 0) >= 0 ? "positive" : "negative",
      emphasis: "total",
    });
  }

  // Se nenhum fluxo monetário tiver sido passado como parâmetro, garantir passos explicativos da equação
  if (steps.length === 0) {
    steps.push({
      label: "Taxa Efetiva Ponderada no Tempo",
      operator: "=",
      rawValue: effectiveRate,
      unit: "percent",
      hint:
        daysElapsed > 0
          ? `Apuração do fluxo pessoal considerando ${daysElapsed} dias de histórico`
          : "Aguardando histórico de movimentações",
      tone: effectiveRate >= 0 ? "positive" : "negative",
      emphasis: "total",
    });
  }

  const notes: string[] = [
    "Diferença entre TWR e TIR: O TWR avalia o desempenho dos investimentos isolando o fluxo de caixa; a TIR avalia o timing pessoal do investidor (se você aportou mais nos momentos de baixa e menos no topo).",
  ];

  if (daysElapsed < 30) {
    notes.push(
      "Histórico em formação (< 30 dias): O cálculo da TIR exige no mínimo 30 dias de histórico para evitar distorções prematuras.",
    );
  } else if (daysElapsed < 365) {
    notes.push(
      "Salvaguarda CVM/ANBIMA: Séries entre 30 e 364 dias exibem o retorno simples do período. A taxa anualizada exige 365 dias corridos para evitar distorções de exponenciação.",
    );
  }

  if (capitalCoveragePct !== undefined && capitalCoveragePct < 80) {
    notes.push(
      `Cobertura de capital (${capitalCoveragePct.toFixed(0)}%): Cadastre seu histórico de aportes ou custo inicial para calibrar a precisão da TIR.`,
    );
  }

  const resultLabel = hasAnnualized
    ? "TIR Anualizada (% a.a.)"
    : hasPeriod
      ? "Retorno do Bolso no Período"
      : "Retorno do Bolso (TIR)";

  const breakdown: CalculationBreakdown = {
    id: "portfolio-irr-breakdown",
    title: "Retorno do Bolso (TIR / XIRR · Fluxo Pessoal)",
    description:
      "Taxa interna de retorno ponderada pelas datas e volumes exatos de dinheiro que saíram e entraram no seu bolso.",
    periodLabel: daysElapsed > 0 ? `${daysElapsed} dias decorridos` : "Em formação",
    formulaExpression: "VPL(r) = ∑ [ C_k ÷ (1 + r)^((d_k − d_0) ÷ 365) ] = 0",
    unit: "percent",
    steps,
    result: {
      label: resultLabel,
      rawValue: effectiveRate,
      unit: "percent",
      tone: isEligible ? (effectiveRate >= 0 ? "positive" : "negative") : "muted",
      hint: hasAnnualized
        ? `Taxa efetiva ponderada no tempo: ${formatSignedPct(effectiveRate)} a.a.`
        : hasPeriod
          ? `Retorno simples do capital no período: ${formatSignedPct(effectiveRate)}.`
          : status === "insufficient_capital_coverage"
            ? "Aguardando cadastro de aportes para calibrar a taxa."
            : "Histórico insuficiente para cálculo da TIR (mínimo 30 dias).",
    },
    inclusions: [
      "Todas as saídas de capital da conta bancária para a corretora (aportes do bolso)",
      "Todas as retiradas da corretora para a conta bancária (resgates para o bolso)",
      "Proventos sacados da corretora para uso no dia a dia",
      "Valor de mercado atual de todas as posições da carteira como liquidação final hipotética",
      "Datas exatas de cada movimentação registradas no calendário civil (base 365 dias)",
    ],
    exclusions: [
      "Giro interno de carteira (vendas seguidas de novas compras na mesma corretora)",
      "Proventos reinvestidos dentro da própria corretora (neutros para o bolso)",
      "Transferências entre contas bancárias do mesmo titular",
    ],
    notes,
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 3. Resultado Histórico Total (P&L Total da Vida em Reais)
// ---------------------------------------------------------------------------

export interface AllTimePnlBreakdownParams {
  /** Riqueza total gerada na vida em BRL (Realizado + Aberto + Proventos). */
  allTimePnlBRL: number;
  /** Resultado líquido realizado em vendas passadas em BRL. */
  realizedPnlBRL?: number;
  /** Ganho de capital aberto não realizado na custódia de hoje em BRL. */
  unrealizedPnlBRL?: number;
  /** Proventos totais acumulados na vida em BRL. */
  totalDividendsBRL?: number;
  /** Custo total aplicado atualmente em BRL (opcional). */
  appliedCostBRL?: number;
  /** Valor de mercado atual da carteira em BRL (opcional). */
  currentValueBRL?: number;
}

export function buildAllTimePnlBreakdown(
  params: AllTimePnlBreakdownParams,
): CalculationBreakdown {
  const {
    allTimePnlBRL,
    realizedPnlBRL = 0,
    unrealizedPnlBRL = 0,
    totalDividendsBRL = 0,
  } = params;

  const realizedCents = numberToCents(realizedPnlBRL);
  const unrealizedCents = numberToCents(unrealizedPnlBRL);
  const dividendsCents = numberToCents(totalDividendsBRL);
  const allTimeCents = numberToCents(allTimePnlBRL);

  const steps: BreakdownStep[] = [
    {
      label: "Resultado Líquido Realizado em Vendas Passadas",
      operator: "+",
      rawValue: realizedCents,
      unit: "currency",
      hint: "Ganhos e perdas já encerrados em alienações passadas (Preço de Venda − Custo Médio)",
      tone: realizedPnlBRL >= 0 ? "positive" : "negative",
    },
    {
      label: "Resultado Aberto da Custódia Atual (Ganho de Capital)",
      operator: "+",
      rawValue: unrealizedCents,
      unit: "currency",
      hint: "Valorização das posições ativas hoje em relação ao Preço Médio desembolsado",
      tone: unrealizedPnlBRL >= 0 ? "positive" : "negative",
    },
    {
      label: "Total de Proventos e Rendimentos Recebidos",
      operator: "+",
      rawValue: dividendsCents,
      unit: "currency",
      hint: "Dividendos, JCP, rendimentos de FIIs e juros creditados desde o início da carteira",
      tone: "positive",
    },
  ];

  const breakdown: CalculationBreakdown = {
    id: "portfolio-all-time-pnl-breakdown",
    title: "Resultado Histórico Total (P&L da Vida em R$)",
    description:
      "Consolida em reais toda a riqueza líquida gerada pelos seus investimentos desde o primeiro dia de aplicação.",
    formulaExpression:
      "Lucro Realizado Passado + Ganho de Capital Aberto + Proventos Acumulados = P&L Total Histórico",
    unit: "currency",
    steps,
    result: {
      label: "P&L Total Acumulado na Vida",
      rawValue: allTimeCents,
      unit: "currency",
      tone: allTimePnlBRL >= 0 ? "positive" : "negative",
      hint: "Dimensão financeira consolidada da sua jornada como investidor.",
    },
    inclusions: [
      "Lucros e prejuízos de todas as operações encerradas no passado (vendas e resgates)",
      "Valorização patrimonial a mercado das posições ainda mantidas em custódia",
      "Total de proventos em dinheiro já creditados em conta",
      "Rendimentos e juros de títulos públicos e de renda fixa",
    ],
    exclusions: [
      "Capital novo aportado (aporte é poupança própria, não resultado de investimento)",
      "Saldo não remunerado mantido em conta corrente",
      "Proventos futuros provisionados (com data de corte 'com' mas ainda não creditados)",
    ],
    notes: [
      "Tríplice Dimensão Financeira: O P&L Histórico soma o que você já realizou no passado com o ganho potencial das ações e fundos que continuam com você e os dividendos que pingaram na conta.",
    ],
  };

  return enrichBreakdown(breakdown);
}

// ---------------------------------------------------------------------------
// 4. Yield on Cost (YoC) vs Dividend Yield de Mercado (DY)
// ---------------------------------------------------------------------------

export interface YieldBreakdownParams {
  /** Código ou nome do ativo analisado (ex: "ITSA4", "HGLG11"). */
  ticker?: string;
  /** Moeda de custódia do ativo ("BRL" ou "USD"). */
  currency?: string;
  /** Proventos recebidos no período analisado (últimos 12M ou vida) na moeda nativa. */
  dividendsAmount: number;
  /** Custo de aquisição total (base do YoC) na moeda nativa. */
  totalCost: number;
  /** Valor atual de mercado (base do DY) na moeda nativa (opcional). */
  currentValue?: number;
  /** Yield on Cost explícito em % (se já apurado). */
  yieldOnCostPct?: number;
  /** Dividend Yield corrente em % (se disponível). */
  dividendYieldPct?: number;
  /** Proventos periódicos do extrato recente (opcional). */
  periodicDividends?: number;
  /** Proventos históricos acumulados anteriores (opcional). */
  accumulatedDividends?: number;
}

export function buildYieldBreakdown(params: YieldBreakdownParams): CalculationBreakdown {
  const {
    ticker,
    dividendsAmount,
    totalCost,
    currentValue,
    yieldOnCostPct,
    dividendYieldPct,
    periodicDividends,
    accumulatedDividends,
  } = params;

  const yocCalc =
    yieldOnCostPct !== undefined
      ? yieldOnCostPct
      : totalCost > 0
        ? Math.round((dividendsAmount / totalCost) * 10000) / 100
        : 0;

  const dyCalc =
    dividendYieldPct !== undefined
      ? dividendYieldPct
      : currentValue !== undefined && currentValue > 0
        ? Math.round((dividendsAmount / currentValue) * 10000) / 100
        : 0;

  const steps: BreakdownStep[] = [
    {
      label: ticker ? `Proventos Recebidos (${ticker})` : "Total de Proventos e Dividendos",
      rawValue: numberToCents(dividendsAmount),
      unit: "currency",
      hint:
        accumulatedDividends !== undefined && accumulatedDividends > 0
          ? `Extrato recente: ${formatPercent(periodicDividends ?? 0)} + Acumulado histórico: ${formatPercent(accumulatedDividends)}`
          : "Total de dividendos, JCP e rendimentos recebidos no período",
      tone: "positive",
    },
    {
      label: "Custo Total de Aquisição (Capital Desembolsado)",
      operator: "/",
      rawValue: numberToCents(totalCost),
      unit: "currency",
      hint: "Quantidade de cotas × Preço Médio pago na compra (capital que saiu do seu bolso)",
      tone: "default",
    },
    {
      label: "Yield on Cost (Retorno Real sobre Capital Aplicado)",
      operator: "=",
      rawValue: yocCalc,
      unit: "percent",
      hint: `(Proventos Totais ÷ Custo de Aquisição) × 100% = ${formatPercent(yocCalc)}%`,
      tone: "positive",
      emphasis: "total",
    },
  ];

  if (currentValue !== undefined && currentValue > 0) {
    steps.push({
      label: "Dividend Yield Corrente (DY a Valor de Mercado)",
      operator: "=",
      rawValue: dyCalc,
      unit: "percent",
      hint: `(Proventos Totais ÷ Valor Atual de Mercado) × 100% = ${formatPercent(dyCalc)}% (Rendimento para novos investidores)`,
      tone: "portfolio",
      emphasis: "subtotal",
    });
  }

  const breakdown: CalculationBreakdown = {
    id: ticker ? `yield-breakdown-${ticker.toLowerCase()}` : "portfolio-yield-breakdown",
    title: ticker ? `Eficiência de Dividendos · YoC (${ticker})` : "Eficiência de Dividendos (Yield on Cost)",
    description:
      "Mede a rentabilidade real dos dividendos frente ao valor que você efetivamente pagou pelas cotas no passado.",
    formulaExpression:
      currentValue !== undefined && currentValue > 0
        ? "YoC = (Proventos ÷ Custo de Aquisição) × 100% | DY = (Proventos ÷ Cotação Atual) × 100%"
        : "YoC = (Proventos Totais ÷ Custo de Aquisição) × 100%",
    unit: "percent",
    steps,
    result: {
      label: "Yield on Cost (YoC)",
      rawValue: yocCalc,
      unit: "percent",
      tone: "positive",
      hint: ticker
        ? `Retorno real em proventos pago por ${ticker} sobre o dinheiro que você desembolsou.`
        : "Retorno real em proventos auferido sobre o capital que você realmente desembolsou.",
    },
    inclusions: [
      "Todos os dividendos, Juros sobre Capital Próprio (JCP) e rendimentos creditados",
      "Cálculo estritamente na moeda nativa do ativo (USD para ações/ETFs americanos) antes de qualquer conversão cambial (FINANCIAL_MATH_SPEC §3.5)",
      "Proventos acumulados históricos cadastrados somados às movimentações do extrato",
    ],
    exclusions: [
      "Variações cambiais conjunturais na apuração do percentual em moeda estrangeira",
      "Proventos anunciados com data COM que ainda não foram creditados na conta",
    ],
    notes: [
      "Diferença entre YoC e DY: O Dividend Yield de mercado indica o rendimento para quem compra uma ação pelo preço de tela hoje. O Yield on Cost mede o rendimento sobre o preço médio que você realmente pagou no passado.",
      "Efeito Bola de Neve: Com o crescimento dos lucros e proventos da empresa ao longo do tempo, o YoC pessoal tende a crescer e pode ultrapassar dezenas de pontos percentuais sobre o capital inicial.",
    ],
  };

  return enrichBreakdown(breakdown);
}
