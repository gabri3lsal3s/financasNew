import { describe, expect, it } from "vitest";
import {
  evaluateBalancoReadiness,
  evaluateCarteiraMensalReadiness,
  evaluateDossiePosicaoReadiness,
  evaluateDreReadiness,
  evaluateExtratoSnapshotsReadiness,
  evaluateFaturaReadiness,
  evaluateFireReadiness,
  evaluateIrpfReadiness,
  evaluateReportReadiness,
  InsufficientReportDataError,
} from "./report-readiness";

describe("SSOT de Elegibilidade e Renderização Condicional (report-readiness)", () => {
  // Cenário 1: Conta 100% zerada -> todos os 8 relatórios devem retornar status: 'blocked' com CTA
  it("Cenário 1: Bloqueia todos os 8 relatórios para conta 100% zerada com CTAs claros", () => {
    const dre = evaluateDreReadiness({
      grossIncomeCents: 0,
      totalExpensesCents: 0,
      expenseCount: 0,
      incomeCount: 0,
    });
    expect(dre.status).toBe("blocked");
    expect(dre.canGenerate).toBe(false);
    expect(dre.blockingReasons[0]?.ctaRoute).toBe("/transacoes");

    const balanco = evaluateBalancoReadiness({
      totalAssetsBRL: 0,
      totalLiabilitiesBRL: 0,
      hasDreActivity: false,
    });
    expect(balanco.status).toBe("blocked");
    expect(balanco.canGenerate).toBe(false);
    expect(balanco.blockingReasons[0]?.ctaRoute).toBe("/investments");

    const irpf = evaluateIrpfReadiness({
      yearEndAssetCount: 0,
      taxIncomeCount: 0,
      taxIncomeTotalBRL: 0,
    });
    expect(irpf.status).toBe("blocked");
    expect(irpf.canGenerate).toBe(false);
    expect(irpf.blockingReasons[0]?.ctaRoute).toBe("/investments");

    const fire = evaluateFireReadiness({
      dividends12mCount: 0,
      totalDividends12mBRL: 0,
      passiveIncomeAssetCount: 0,
      hasCostOfLiving: false,
    });
    expect(fire.status).toBe("blocked");
    expect(fire.canGenerate).toBe(false);
    expect(fire.blockingReasons[0]?.ctaRoute).toBe("/investments?tab=proventos");

    const fatura = evaluateFaturaReadiness({
      hasCard: false,
      expenseCount: 0,
      totalBrutoCents: 0,
      paymentCount: 0,
      totalPaidCents: 0,
    });
    expect(fatura.status).toBe("blocked");
    expect(fatura.canGenerate).toBe(false);
    expect(fatura.blockingReasons[0]?.code).toBe("NO_CREDIT_CARD");

    const dossie = evaluateDossiePosicaoReadiness({
      activeAssetCount: 0,
      totalBRL: 0,
      cashBRL: 0,
      hasAllocationTargets: false,
      activeClassCount: 0,
      validSectorCount: 0,
      eligibleClasses: { acoes: false, fiis: false, rendaFixa: false, internacional: false },
      monthlyHistoryCount: 0,
    });
    expect(dossie.status).toBe("blocked");
    expect(dossie.canGenerate).toBe(false);
    expect(dossie.blockingReasons[0]?.ctaRoute).toBe("/investments");

    const carteira = evaluateCarteiraMensalReadiness({
      activeAssetCount: 0,
      monthlyMovementsCount: 0,
      totalBRL: 0,
      cashBRL: 0,
    });
    expect(carteira.status).toBe("blocked");
    expect(carteira.canGenerate).toBe(false);
    expect(carteira.blockingReasons[0]?.ctaRoute).toBe("/investments");

    const extrato = evaluateExtratoSnapshotsReadiness({
      snapshotCount: 0,
    });
    expect(extrato.status).toBe("blocked");
    expect(extrato.canGenerate).toBe(false);
    expect(extrato.blockingReasons[0]?.code).toBe("INSUFFICIENT_SNAPSHOTS");
  });

  // Cenário 2: Sem cartão cadastrado -> Fatura retorna blocked
  it("Cenário 2: Fatura de cartão bloqueada quando não há cartão cadastrado", () => {
    const res = evaluateFaturaReadiness({
      hasCard: false,
      expenseCount: 0,
      totalBrutoCents: 0,
      paymentCount: 0,
      totalPaidCents: 0,
    });
    expect(res.status).toBe("blocked");
    expect(res.blockingReasons[0]?.code).toBe("NO_CREDIT_CARD");
    expect(res.blockingReasons[0]?.ctaLabel).toBe("Cadastrar cartão");
    expect(res.blockingReasons[0]?.ctaRoute).toBe("/cartoes");
  });

  // Cenário 3: Cartão cadastrado, mas fatura com 0 gastos e 0 pagamentos -> blocked
  it("Cenário 3: Fatura de cartão bloqueada quando o cartão não tem gastos nem pagamentos no mês", () => {
    const res = evaluateFaturaReadiness({
      hasCard: true,
      expenseCount: 0,
      totalBrutoCents: 0,
      paymentCount: 0,
      totalPaidCents: 0,
    });
    expect(res.status).toBe("blocked");
    expect(res.blockingReasons[0]?.code).toBe("EMPTY_INVOICE");
  });

  // Cenário 4: Fatura em aberto (sem rateio e sem parcelas) -> partial, omitindo pagamentos e ponderado
  it("Cenário 4: Fatura em aberto omite pagamentos e coluna ponderada de forma limpa", () => {
    const res = evaluateFaturaReadiness({
      hasCard: true,
      expenseCount: 5,
      totalBrutoCents: 150000,
      paymentCount: 0,
      totalPaidCents: 0,
      isWeightedIdentical: true,
      hasInstallments: false,
    });
    expect(res.status).toBe("partial");
    expect(res.canGenerate).toBe(true);
    expect(res.sections.paymentsSection).toBe(false);
    expect(res.sections.weightedColumn).toBe(false);
    expect(res.omittedSections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sectionKey: "paymentsSection" }),
        expect.objectContaining({ sectionKey: "weightedColumn" }),
      ]),
    );
  });

  // Cenário 5: Extrato com 1 único snapshot -> blocked
  it("Cenário 5: Extrato de Snapshots bloqueado quando possui menos de 2 snapshots", () => {
    const res = evaluateExtratoSnapshotsReadiness({
      snapshotCount: 1,
      totalDividendsInPeriodBRL: 100,
    });
    expect(res.status).toBe("blocked");
    expect(res.canGenerate).toBe(false);
    expect(res.blockingReasons[0]?.code).toBe("INSUFFICIENT_SNAPSHOTS");
  });

  // Cenário 6: Carteira jovem (1 mês, 2 ações B3, sem FIIs, sem RF, sem Intl, sem segmentos, sem metas) -> Dossiê 6
  it("Cenário 6: Carteira jovem com 1 classe omite Donut de classes, segmentos, metas e histórico", () => {
    const res = evaluateDossiePosicaoReadiness({
      activeAssetCount: 2,
      totalBRL: 10000,
      cashBRL: 0,
      hasAllocationTargets: false,
      activeClassCount: 1, // apenas Ações
      validSectorCount: 0,
      eligibleClasses: { acoes: true, fiis: false, rendaFixa: false, internacional: false },
      monthlyHistoryCount: 1,
      hasSharpeAndRisk: false,
    });
    expect(res.status).toBe("partial");
    expect(res.canGenerate).toBe(true);
    expect(res.sections.targetVsActual).toBe(false);
    expect(res.sections.donutClasses).toBe(false);
    expect(res.sections.sectorDiversification).toBe(false);
    expect(res.sections.pageAllocationAndSectors).toBe(false);
    expect(res.sections.xrayAcoes).toBe(true);
    expect(res.sections.xrayFiis).toBe(false);
    expect(res.sections.xrayRendaFixa).toBe(false);
    expect(res.sections.xrayInternacional).toBe(false);
    expect(res.sections.historyAndBenchmarks).toBe(false);
  });

  // Cenário 7: Carteira com 2 classes e 2 meses fechados -> exibe Benchmarks e omite Risco (< 3 meses)
  it("Cenário 7: Carteira com 2 meses exibe comparativo histórico e omite métricas de risco (< 3m)", () => {
    const res = evaluateDossiePosicaoReadiness({
      activeAssetCount: 4,
      totalBRL: 50000,
      cashBRL: 5000,
      hasAllocationTargets: true,
      activeClassCount: 2,
      validSectorCount: 3,
      eligibleClasses: { acoes: true, fiis: false, rendaFixa: true, internacional: false },
      monthlyHistoryCount: 2,
      hasSharpeAndRisk: false,
    });
    expect(res.status).toBe("partial");
    expect(res.canGenerate).toBe(true);
    expect(res.sections.targetVsActual).toBe(true);
    expect(res.sections.donutClasses).toBe(true);
    expect(res.sections.historyAndBenchmarks).toBe(true);
    expect(res.sections.riskMetrics).toBe(false); // < 3 meses
    expect(res.sections.xrayAcoes).toBe(true);
    expect(res.sections.xrayRendaFixa).toBe(true);
    expect(res.sections.xrayFiis).toBe(false);
  });

  // Cenário 8: DRE apenas com receitas (despesas === 0) -> hasPage2 === false
  it("Cenário 8: DRE apenas com receitas fecha em página única (hasPage2 === false)", () => {
    const res = evaluateDreReadiness({
      grossIncomeCents: 500000,
      totalExpensesCents: 0,
      incomeCount: 2,
      expenseCount: 0,
      paidInvoicesCount: 0,
      hasHousehold: false,
    });
    expect(res.status).toBe("partial");
    expect(res.canGenerate).toBe(true);
    expect(res.sections.waterfall).toBe(true);
    expect(res.sections.compositionTables).toBe(false);
    expect(res.sections.paidInvoices).toBe(false);
    expect(res.sections.hasPage2).toBe(false);
  });

  // Cenário 9: Balanço 360° sem dívidas e apenas Reserva de Caixa -> omite Donut e mantém Passivos
  it("Cenário 9: Balanço 360° com componente único omite Donut mas mantém bloco de passivos zerado", () => {
    const res = evaluateBalancoReadiness({
      totalAssetsBRL: 20000,
      totalLiabilitiesBRL: 0,
      assetComponentCount: 1, // apenas Caixa
      hasDreActivity: true,
    });
    expect(res.status).toBe("partial");
    expect(res.canGenerate).toBe(true);
    expect(res.sections.donutChart).toBe(false);
    expect(res.sections.liabilitiesBlock).toBe(true);
    expect(res.sections.dreBottomBlock).toBe(true);
  });

  // Cenário 10: IRPF com bens em 31/12 mas 0 proventos -> exibe Bens detalhados e omite tabela de rendimentos
  it("Cenário 10: IRPF com bens e sem rendimentos gera relatório limpo em 1 página", () => {
    const res = evaluateIrpfReadiness({
      yearEndAssetCount: 5,
      taxIncomeCount: 0,
      taxIncomeTotalBRL: 0,
    });
    expect(res.status).toBe("partial");
    expect(res.canGenerate).toBe(true);
    expect(res.sections.bensDireitosDetailed).toBe(true);
    expect(res.sections.rendimentosDetailed).toBe(false);
  });

  // Teste de Defesa em Profundidade: InsufficientReportDataError
  it("Lança InsufficientReportDataError com código e detalhes claros quando instanciado", () => {
    const err = new InsufficientReportDataError("fatura_cartao", [
      {
        code: "NO_CREDIT_CARD",
        title: "Nenhum cartão",
        description: "Cadastre um cartão.",
      },
    ]);
    expect(err.name).toBe("InsufficientReportDataError");
    expect(err.reportId).toBe("fatura_cartao");
    expect(err.blockingReasons[0]?.code).toBe("NO_CREDIT_CARD");
  });

  // Despachante Universal
  it("evaluateReportReadiness despacha corretamente para cada relatório", () => {
    const res = evaluateReportReadiness("extrato_snapshots", {
      snapshotCount: 12,
      totalDividendsInPeriodBRL: 500,
    });
    expect(res.reportId).toBe("extrato_snapshots");
    expect(res.status).toBe("ready");
    expect(res.canGenerate).toBe(true);
  });
});
