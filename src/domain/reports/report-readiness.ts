/**
 * SSOT de Elegibilidade e Renderização Condicional de Relatórios Executivos (Axir).
 *
 * Implementa a governança em 3 níveis (Bloqueio, Omissão Limpa e Zero Informativo),
 * com limiares estatísticos canônicos e contratos compartilhados entre a interface
 * (Modal de Pré-Validação com CTA) e o motor de geração de PDF.
 *
 * Módulo 100% puro: sem dependências de React, DOM ou Supabase.
 */

export type ReportId =
  | "dre_pessoal"
  | "balanco_360"
  | "facilitador_irpf"
  | "dossie_fire"
  | "fatura_cartao"
  | "dossie_posicao_vigente"
  | "carteira_mensal"
  | "extrato_snapshots";

export type ReadinessStatus = "ready" | "partial" | "blocked";

export interface MissingRequirement {
  code: string;
  title: string;
  description: string;
  ctaLabel?: string;
  ctaRoute?: string;
}

export interface OmittedSectionInfo {
  sectionKey: string;
  label: string;
  reason: string;
}

export interface ReportReadinessResult<TSections extends Record<string, boolean> = Record<string, boolean>> {
  reportId: ReportId;
  status: ReadinessStatus;
  canGenerate: boolean;
  blockingReasons: MissingRequirement[];
  omittedSections: OmittedSectionInfo[];
  sections: TSections;
  summaryText?: string;
}

export class InsufficientReportDataError extends Error {
  public readonly reportId: ReportId;
  public readonly blockingReasons: MissingRequirement[];

  constructor(reportId: ReportId, blockingReasons: MissingRequirement[]) {
    const mainReason = blockingReasons[0]?.description ?? "Dados insuficientes para compilar o relatório.";
    super(`[Axir Report Engine] Geração bloqueada para '${reportId}': ${mainReason}`);
    this.name = "InsufficientReportDataError";
    this.reportId = reportId;
    this.blockingReasons = blockingReasons;
  }
}

// ==============================================================================
// 1. DRE PESSOAL
// ==============================================================================

export interface DreReadinessInput {
  grossIncomeCents: number;
  totalExpensesCents: number;
  operationalSavingsCents?: number;
  expenseCount: number;
  incomeCount: number;
  paidInvoicesCount?: number;
  hasWeightedDiscrepancy?: boolean;
  hasHousehold?: boolean;
}

export interface DreSections extends Record<string, boolean> {
  waterfall: boolean;
  compositionTables: boolean;
  paidInvoices: boolean;
  weightedColumn: boolean;
  householdSummary: boolean;
  hasPage2: boolean;
}

export function evaluateDreReadiness(input: DreReadinessInput): ReportReadinessResult<DreSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  const hasEntries = input.incomeCount > 0 || input.expenseCount > 0;
  const hasAmounts = input.grossIncomeCents > 0 || input.totalExpensesCents > 0;

  if (!hasEntries && !hasAmounts) {
    blockingReasons.push({
      code: "NO_FINANCIAL_ENTRIES",
      title: "Nenhum lançamento no período",
      description: "Registre ao menos uma receita, despesa ou movimentação na competência para gerar a DRE Pessoal.",
      ctaLabel: "Registrar lançamentos",
      ctaRoute: "/transacoes",
    });
  }

  const waterfall = input.grossIncomeCents > 0;
  if (!waterfall && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "waterfall",
      label: "Cascata DRE de Destinação da Renda",
      reason: "Sem receitas realizadas no período para calcular percentuais de destinação.",
    });
  }

  const compositionTables = input.totalExpensesCents > 0 && input.expenseCount > 0;
  if (!compositionTables && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "compositionTables",
      label: "Composição de Gastos por Categoria e Pagamento",
      reason: "Nenhuma despesa operacional apurada no período.",
    });
  }

  const paidInvoices = (input.paidInvoicesCount ?? 0) > 0;
  if (!paidInvoices && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "paidInvoices",
      label: "Faturas de Cartão Quitadas no Período",
      reason: "Nenhuma fatura de cartão de crédito liquidada nesta competência.",
    });
  }

  const weightedColumn = Boolean(input.hasWeightedDiscrepancy);
  if (!weightedColumn && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "weightedColumn",
      label: "Detalhamento Ponderado",
      reason: "Valores ponderados são idênticos aos brutos na competência.",
    });
  }

  const householdSummary = Boolean(input.hasHousehold);

  const hasPage2 = compositionTables || paidInvoices || householdSummary;

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "dre_pessoal",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      waterfall,
      compositionTables,
      paidInvoices,
      weightedColumn,
      householdSummary,
      hasPage2,
    },
  };
}

// ==============================================================================
// 2. BALANÇO PATRIMONIAL 360°
// ==============================================================================

export interface BalancoReadinessInput {
  totalAssetsBRL: number;
  totalLiabilitiesBRL: number;
  hasDreActivity?: boolean;
  assetComponentCount?: number;
}

export interface BalancoSections extends Record<string, boolean> {
  donutChart: boolean;
  dreBottomBlock: boolean;
  liabilitiesBlock: boolean;
}

export function evaluateBalancoReadiness(input: BalancoReadinessInput): ReportReadinessResult<BalancoSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  const totalAssets = input.totalAssetsBRL;
  const totalLiabilities = input.totalLiabilitiesBRL;
  const hasDre = Boolean(input.hasDreActivity);

  if (totalAssets === 0 && totalLiabilities === 0 && !hasDre) {
    blockingReasons.push({
      code: "NO_WEALTH_DATA",
      title: "Patrimônio completamente zerado",
      description: "Cadastre contas, investimentos ou obrigações para consolidar o Balanço Patrimonial 360°.",
      ctaLabel: "Cadastrar patrimônio",
      ctaRoute: "/investments",
    });
  }

  const componentCount = input.assetComponentCount ?? (totalAssets > 0 ? 2 : 0);
  const donutChart = totalAssets > 0 && componentCount >= 2;
  if (!donutChart && totalAssets > 0 && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "donutChart",
      label: "Gráfico de Alocação de Ativos",
      reason: "Patrimônio composto por um único item ativo (anel de 100% omitido em prol da lista direta).",
    });
  }

  const dreBottomBlock = hasDre;
  if (!dreBottomBlock && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "dreBottomBlock",
      label: "DRE Pessoal (Base Ponderada)",
      reason: "Sem movimentações de receitas e despesas registradas no período.",
    });
  }

  const liabilitiesBlock = true;

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "balanco_360",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      donutChart,
      dreBottomBlock,
      liabilitiesBlock,
    },
  };
}

// ==============================================================================
// 3. FACILITADOR DE IRPF
// ==============================================================================

export interface IrpfReadinessInput {
  yearEndAssetCount: number;
  taxIncomeCount?: number;
  taxIncomeTotalBRL?: number;
  activeGroups?: string[];
}

export interface IrpfSections extends Record<string, boolean> {
  bensDireitosDetailed: boolean;
  rendimentosDetailed: boolean;
}

export function evaluateIrpfReadiness(input: IrpfReadinessInput): ReportReadinessResult<IrpfSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  const hasAssets = input.yearEndAssetCount > 0;
  const hasTaxIncome = (input.taxIncomeCount ?? 0) > 0 || (input.taxIncomeTotalBRL ?? 0) > 0;

  if (!hasAssets && !hasTaxIncome) {
    blockingReasons.push({
      code: "NO_TAX_DATA",
      title: "Sem ativos ou rendimentos no ano-base",
      description: "Cadastre seus ativos em custódia ou proventos recebidos no ano-base para gerar o Facilitador de IRPF.",
      ctaLabel: "Cadastrar ativos",
      ctaRoute: "/investments",
    });
  }

  const bensDireitosDetailed = hasAssets;
  if (!bensDireitosDetailed && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "bensDireitosDetailed",
      label: "Detalhamento de Bens e Direitos",
      reason: "Sem posições ativas em custódia em 31/12 do ano-base (exibido como linha informativa).",
    });
  }

  const rendimentosDetailed = hasTaxIncome;
  if (!rendimentosDetailed && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "rendimentosDetailed",
      label: "Detalhamento de Rendimentos Isentos e Exclusivos",
      reason: "Nenhum provento tributável ou isento apurado no ano-base (exibido como linha informativa).",
    });
  }

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "facilitador_irpf",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      bensDireitosDetailed,
      rendimentosDetailed,
    },
  };
}

// ==============================================================================
// 4. DOSSIÊ FIRE & LIBERDADE FINANCEIRA
// ==============================================================================

export interface FireReadinessInput {
  dividends12mCount: number;
  totalDividends12mBRL: number;
  passiveIncomeAssetCount: number;
  hasCostOfLiving: boolean;
  monthlyHistoryCount?: number;
  eligibleSnowballAssetCount?: number;
}

export interface FireSections extends Record<string, boolean> {
  fireGauge: boolean;
  evolutionChart12m: boolean;
  snowballTable: boolean;
  emergencyRunway: boolean;
}

export function evaluateFireReadiness(input: FireReadinessInput): ReportReadinessResult<FireSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  const hasDividends = input.dividends12mCount > 0 || input.totalDividends12mBRL > 0;
  const hasIncomeAssets = input.passiveIncomeAssetCount > 0;

  if (!hasDividends && !hasIncomeAssets) {
    blockingReasons.push({
      code: "NO_DIVIDENDS_DATA",
      title: "Nenhum provento cadastrado",
      description: "Cadastre proventos recebidos nos últimos 12 meses ou ativos com renda passiva para gerar o Dossiê FIRE.",
      ctaLabel: "Registrar proventos",
      ctaRoute: "/investments?tab=proventos",
    });
  }

  const fireGauge = input.hasCostOfLiving;
  if (!fireGauge && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "fireGauge",
      label: "Régua de Cobertura FIRE",
      reason: "Custo de vida médio não parametrizado nas configurações financeiras.",
    });
  }

  const historyMonths = input.monthlyHistoryCount ?? (input.dividends12mCount > 0 ? 12 : 0);
  const evolutionChart12m = historyMonths >= 2;
  if (!evolutionChart12m && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "evolutionChart12m",
      label: "Gráfico de Evolução dos Proventos (12 meses)",
      reason: "Histórico inferior a 2 meses com proventos (mantidos apenas os KPIs executivos).",
    });
  }

  const snowballTable = (input.eligibleSnowballAssetCount ?? 0) > 0;
  if (!snowballTable && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "snowballTable",
      label: "Tabela de Ativos no Efeito Bola de Neve",
      reason: "Nenhum ativo atingiu o patamar de reaplicação autônoma de cotas/ações no período.",
    });
  }

  const emergencyRunway = input.hasCostOfLiving;

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "dossie_fire",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      fireGauge,
      evolutionChart12m,
      snowballTable,
      emergencyRunway,
    },
  };
}

// ==============================================================================
// 5. FATURA DE CARTÃO DE CRÉDITO
// ==============================================================================

export interface FaturaReadinessInput {
  hasCard: boolean;
  expenseCount: number;
  totalBrutoCents: number;
  paymentCount: number;
  totalPaidCents: number;
  isWeightedIdentical?: boolean;
  hasInstallments?: boolean;
}

export interface FaturaSections extends Record<string, boolean> {
  paymentsSection: boolean;
  weightedColumn: boolean;
  installmentsColumn: boolean;
}

export function evaluateFaturaReadiness(input: FaturaReadinessInput): ReportReadinessResult<FaturaSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  if (!input.hasCard) {
    blockingReasons.push({
      code: "NO_CREDIT_CARD",
      title: "Nenhum cartão de crédito cadastrado",
      description: "Cadastre um cartão de crédito para acompanhar e exportar faturas detalhadas.",
      ctaLabel: "Cadastrar cartão",
      ctaRoute: "/cartoes",
    });
  } else if (
    input.expenseCount === 0 &&
    input.paymentCount === 0 &&
    input.totalBrutoCents === 0 &&
    input.totalPaidCents === 0
  ) {
    blockingReasons.push({
      code: "EMPTY_INVOICE",
      title: "Fatura sem movimentações",
      description: "Esta fatura ainda não possui compras, pagamentos ou estornos lançados na competência.",
      ctaLabel: "Lançar despesa",
      ctaRoute: "/cartoes",
    });
  }

  const paymentsSection = input.paymentCount > 0 || input.totalPaidCents > 0;
  if (!paymentsSection && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "paymentsSection",
      label: "Pagamentos e Estornos da Fatura",
      reason: "Fatura ainda em aberto sem liquidações parciais ou integrais registradas.",
    });
  }

  const weightedColumn = !input.isWeightedIdentical;
  if (!weightedColumn && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "weightedColumn",
      label: "Coluna e Sublinha de Valor Ponderado",
      reason: "Todos os lançamentos possuem valor ponderado idêntico ao bruto.",
    });
  }

  const installmentsColumn = input.hasInstallments ?? true;

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "fatura_cartao",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      paymentsSection,
      weightedColumn,
      installmentsColumn,
    },
  };
}

// ==============================================================================
// 6. DOSSIÊ EXECUTIVO DA POSIÇÃO VIGENTE (WEALTH TEAR SHEET)
// ==============================================================================

export interface DossiePosicaoReadinessInput {
  activeAssetCount: number;
  totalBRL: number;
  cashBRL: number;
  hasAllocationTargets: boolean;
  activeClassCount: number;
  validSectorCount: number;
  eligibleClasses: {
    acoes: boolean;
    fiis: boolean;
    rendaFixa: boolean;
    internacional: boolean;
  };
  monthlyHistoryCount: number;
  hasSharpeAndRisk?: boolean;
}

export interface DossiePosicaoSections extends Record<string, boolean> {
  targetVsActual: boolean;
  concentrationThermometer: boolean;
  donutClasses: boolean;
  sectorDiversification: boolean;
  pageAllocationAndSectors: boolean;
  xrayAcoes: boolean;
  xrayFiis: boolean;
  xrayRendaFixa: boolean;
  xrayInternacional: boolean;
  hasAnyXray: boolean;
  historyAndBenchmarks: boolean;
  riskMetrics: boolean;
}

export function evaluateDossiePosicaoReadiness(
  input: DossiePosicaoReadinessInput,
): ReportReadinessResult<DossiePosicaoSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  const hasAssets = input.activeAssetCount > 0;
  const hasCash = input.cashBRL > 0;
  const hasWealth = input.totalBRL > 0 || hasCash;

  if (!hasAssets && !hasWealth) {
    blockingReasons.push({
      code: "NO_PORTFOLIO_ASSETS",
      title: "Nenhum ativo na carteira",
      description: "Cadastre seus ativos ou lance aportes para compor a posição vigente consolidada.",
      ctaLabel: "Cadastrar primeiro ativo",
      ctaRoute: "/investments",
    });
  }

  const targetVsActual = input.hasAllocationTargets;
  if (!targetVsActual && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "targetVsActual",
      label: "Diagnóstico de Alocação (Target vs. Actual)",
      reason: "Metas de alocação não parametrizadas pelo investidor (exibida apenas distribuição real).",
    });
  }

  const concentrationThermometer = input.activeAssetCount >= 2;
  if (!concentrationThermometer && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "concentrationThermometer",
      label: "Termômetro de Concentração e Risco",
      reason: "Carteira composta por ativo único (concentração trivial de 100%).",
    });
  }

  const donutClasses = input.activeClassCount >= 2;
  if (!donutClasses && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "donutClasses",
      label: "Composição por Classe de Ativos (Donut)",
      reason: "Carteira alocada em classe única (gráfico de rosca omitido).",
    });
  }

  const sectorDiversification = input.validSectorCount >= 2;
  if (!sectorDiversification && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "sectorDiversification",
      label: "Diversificação por Segmento & Indexador",
      reason: "Ativos sem categorização setorial diversa cadastrada.",
    });
  }

  const pageAllocationAndSectors = donutClasses || sectorDiversification;

  const xrayAcoes = input.eligibleClasses.acoes;
  const xrayFiis = input.eligibleClasses.fiis;
  const xrayRendaFixa = input.eligibleClasses.rendaFixa;
  const xrayInternacional = input.eligibleClasses.internacional;
  const hasAnyXray = xrayAcoes || xrayFiis || xrayRendaFixa || xrayInternacional;

  if (!xrayAcoes && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "xrayAcoes",
      label: "Raio-X de Ações Brasil",
      reason: "Sem ações da B3 em custódia na carteira.",
    });
  }
  if (!xrayFiis && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "xrayFiis",
      label: "Raio-X de Fundos Imobiliários",
      reason: "Sem fundos imobiliários em custódia na carteira.",
    });
  }
  if (!xrayRendaFixa && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "xrayRendaFixa",
      label: "Raio-X de Renda Fixa",
      reason: "Sem títulos públicos ou privados de renda fixa em custódia.",
    });
  }
  if (!xrayInternacional && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "xrayInternacional",
      label: "Raio-X de Ativos Internacionais",
      reason: "Sem ativos ou ETFs globais em custódia.",
    });
  }

  const historyAndBenchmarks = input.monthlyHistoryCount >= 2;
  if (!historyAndBenchmarks && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "historyAndBenchmarks",
      label: "Comparativo Histórico de Rentabilidade & Benchmarks",
      reason: "Histórico inferior a 2 competências fechadas (página suprimida para evitar caixas vazias).",
    });
  }

  const riskMetrics = input.monthlyHistoryCount >= 3 && Boolean(input.hasSharpeAndRisk);
  if (!riskMetrics && historyAndBenchmarks && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "riskMetrics",
      label: "Métricas Estatísticas de Risco (Sharpe e Volatilidade)",
      reason: "Exige ao menos 3 competências fechadas para desvio padrão amostral estatisticamente significativo.",
    });
  }

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "dossie_posicao_vigente",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      targetVsActual,
      concentrationThermometer,
      donutClasses,
      sectorDiversification,
      pageAllocationAndSectors,
      xrayAcoes,
      xrayFiis,
      xrayRendaFixa,
      xrayInternacional,
      hasAnyXray,
      historyAndBenchmarks,
      riskMetrics,
    },
  };
}

// ==============================================================================
// 7. CARTEIRA MENSAL
// ==============================================================================

export interface CarteiraMensalReadinessInput {
  activeAssetCount: number;
  monthlyMovementsCount?: number;
  totalBRL: number;
  cashBRL: number;
  hasScoresPQS?: boolean;
  activeClassCount?: number;
}

export interface CarteiraMensalSections extends Record<string, boolean> {
  allocationSummary: boolean;
  custodyDetail: boolean;
  cashReserveRow: boolean;
  pqsScore: boolean;
  hasPage2: boolean;
}

export function evaluateCarteiraMensalReadiness(
  input: CarteiraMensalReadinessInput,
): ReportReadinessResult<CarteiraMensalSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  const hasAssets = input.activeAssetCount > 0;
  const hasMovements = (input.monthlyMovementsCount ?? 0) > 0;
  const hasWealth = input.totalBRL > 0 || input.cashBRL > 0;

  if (!hasAssets && !hasMovements && !hasWealth) {
    blockingReasons.push({
      code: "NO_MONTHLY_PORTFOLIO",
      title: "Sem ativos ou movimentações no mês",
      description: "Cadastre seus ativos ou registre movimentações para acompanhar a carteira mensal.",
      ctaLabel: "Cadastrar ativos",
      ctaRoute: "/investments",
    });
  }

  const allocationSummary = true;
  const custodyDetail = (input.activeClassCount ?? (hasAssets ? 1 : 0)) > 0;
  if (!custodyDetail && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "custodyDetail",
      label: "Custódia Detalhada de Ativos",
      reason: "Sem ativos custodiados na competência (relatório sintetizado em 1 página).",
    });
  }

  const cashReserveRow = input.cashBRL > 0;
  if (!cashReserveRow && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "cashReserveRow",
      label: "Linha de Reserva de Caixa",
      reason: "Saldo de caixa vinculado zerado no fechamento.",
    });
  }

  const pqsScore = Boolean(input.hasScoresPQS);
  if (!pqsScore && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "pqsScore",
      label: "Notas de Qualidade (Score PQS)",
      reason: "Nenhum ativo da carteira possui nota de qualidade atribuída.",
    });
  }

  const hasPage2 = custodyDetail;

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "carteira_mensal",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      allocationSummary,
      custodyDetail,
      cashReserveRow,
      pqsScore,
      hasPage2,
    },
  };
}

// ==============================================================================
// 8. EXTRATO ANALÍTICO DE SNAPSHOTS
// ==============================================================================

export interface ExtratoSnapshotsReadinessInput {
  snapshotCount: number;
  totalDividendsInPeriodBRL?: number;
}

export interface ExtratoSnapshotsSections extends Record<string, boolean> {
  evolutionChart: boolean;
  ledgerTable: boolean;
  dividendsFormatted: boolean;
}

export function evaluateExtratoSnapshotsReadiness(
  input: ExtratoSnapshotsReadinessInput,
): ReportReadinessResult<ExtratoSnapshotsSections> {
  const blockingReasons: MissingRequirement[] = [];
  const omittedSections: OmittedSectionInfo[] = [];

  if (input.snapshotCount < 2) {
    blockingReasons.push({
      code: "INSUFFICIENT_SNAPSHOTS",
      title: "Histórico mensal em formação",
      description: "São necessários ao menos 2 meses fechados para traçar o gráfico de evolução e calcular o TWR acumulado.",
      ctaLabel: "Acompanhar carteira",
      ctaRoute: "/investments",
    });
  }

  const evolutionChart = input.snapshotCount >= 2;
  const ledgerTable = true;
  const dividendsFormatted = (input.totalDividendsInPeriodBRL ?? 0) > 0;

  if (!dividendsFormatted && !blockingReasons.length) {
    omittedSections.push({
      sectionKey: "dividendsFormatted",
      label: "Proventos Acumulados no Extrato",
      reason: "Período sem proventos registrados (zeros substituídos por travessão contábil).",
    });
  }

  const isBlocked = blockingReasons.length > 0;
  const isPartial = !isBlocked && omittedSections.length > 0;

  return {
    reportId: "extrato_snapshots",
    status: isBlocked ? "blocked" : isPartial ? "partial" : "ready",
    canGenerate: !isBlocked,
    blockingReasons,
    omittedSections,
    sections: {
      evolutionChart,
      ledgerTable,
      dividendsFormatted,
    },
  };
}

// ==============================================================================
// DESPACHANTE UNIVERSAL
// ==============================================================================

export type ReportReadinessInputMap = {
  dre_pessoal: DreReadinessInput;
  balanco_360: BalancoReadinessInput;
  facilitador_irpf: IrpfReadinessInput;
  dossie_fire: FireReadinessInput;
  fatura_cartao: FaturaReadinessInput;
  dossie_posicao_vigente: DossiePosicaoReadinessInput;
  carteira_mensal: CarteiraMensalReadinessInput;
  extrato_snapshots: ExtratoSnapshotsReadinessInput;
};

export type ReportSectionsMap = {
  dre_pessoal: DreSections;
  balanco_360: BalancoSections;
  facilitador_irpf: IrpfSections;
  dossie_fire: FireSections;
  fatura_cartao: FaturaSections;
  dossie_posicao_vigente: DossiePosicaoSections;
  carteira_mensal: CarteiraMensalSections;
  extrato_snapshots: ExtratoSnapshotsSections;
};

export function evaluateReportReadiness<TId extends ReportId>(
  reportId: TId,
  input: ReportReadinessInputMap[TId],
): ReportReadinessResult<ReportSectionsMap[TId]> {
  switch (reportId) {
    case "dre_pessoal":
      return evaluateDreReadiness(input as DreReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    case "balanco_360":
      return evaluateBalancoReadiness(input as BalancoReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    case "facilitador_irpf":
      return evaluateIrpfReadiness(input as IrpfReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    case "dossie_fire":
      return evaluateFireReadiness(input as FireReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    case "fatura_cartao":
      return evaluateFaturaReadiness(input as FaturaReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    case "dossie_posicao_vigente":
      return evaluateDossiePosicaoReadiness(input as DossiePosicaoReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    case "carteira_mensal":
      return evaluateCarteiraMensalReadiness(input as CarteiraMensalReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    case "extrato_snapshots":
      return evaluateExtratoSnapshotsReadiness(input as ExtratoSnapshotsReadinessInput) as ReportReadinessResult<ReportSectionsMap[TId]>;
    default: {
      const _exhaustive: never = reportId;
      throw new Error(`Tipo de relatório não suportado: ${_exhaustive}`);
    }
  }
}
