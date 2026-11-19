/**
 * Validador Pré-Emissão de Invariantes Matemáticas do Portfólio (§Fase 6 — Etapa 6.2).
 * PortfolioReportInvariantValidator — Pre-Flight Mathematical Audit Guard.
 *
 * Bloqueia deterministicamente a emissão de relatórios inconsistentes antes da renderização
 * de telas ou geradores de PDF, verificando as 12 asserções canônicas de auditoria.
 */

import type { UnifiedPortfolioReportPayload } from "./unified-payload";

export interface InvariantValidationResult {
  isValid: boolean;
  errors: string[];
  assertionsCheckedCount: number;
}

export class PortfolioReportInvariantValidator {
  /**
   * Executa a auditoria das 12 asserções fundamentais sobre o payload unificado.
   */
  public static validate(payload: UnifiedPortfolioReportPayload): InvariantValidationResult {
    const errors: string[] = [];
    const TOLERANCE_CURRENCY = 0.02; // R$ 0,02 de tolerância de arredondamento

    // 1. Asserção 1 (Patrimônio Total): V_ativos + V_caixa == P_total
    const expectedEquity = payload.summary.assetsMarketValueBrl + payload.summary.cashReserveBrl;
    if (Math.abs(payload.summary.totalEquityBrl - expectedEquity) > TOLERANCE_CURRENCY) {
      errors.push(
        `Asserção 1 (Patrimônio): Soma de ativos (${payload.summary.assetsMarketValueBrl}) + caixa (${payload.summary.cashReserveBrl}) = ${expectedEquity.toFixed(2)}, diferente de P_total (${payload.summary.totalEquityBrl}).`,
      );
    }

    // 2. Asserção 2 (Custo Total): C_ativos + V_caixa == C_total
    const expectedCost = payload.summary.assetsAcquisitionCostBrl + payload.summary.cashReserveBrl;
    if (Math.abs(payload.summary.totalAppliedCostBrl - expectedCost) > TOLERANCE_CURRENCY) {
      errors.push(
        `Asserção 2 (Custo): Custo de ativos (${payload.summary.assetsAcquisitionCostBrl}) + caixa (${payload.summary.cashReserveBrl}) = ${expectedCost.toFixed(2)}, diferente de C_total (${payload.summary.totalAppliedCostBrl}).`,
      );
    }

    // 3. Asserção 3 (Ganho de Capital Aberto): P_total - C_total == V_ativos - C_ativos == GanhoAberto
    const diffTotal = payload.summary.totalEquityBrl - payload.summary.totalAppliedCostBrl;
    const diffAssets = payload.summary.assetsMarketValueBrl - payload.summary.assetsAcquisitionCostBrl;
    if (Math.abs(diffTotal - payload.summary.openCapitalGainBrl) > TOLERANCE_CURRENCY) {
      errors.push(
        `Asserção 3 (Ganho Aberto Total): P_total - C_total (${diffTotal.toFixed(2)}) diferente de openCapitalGainBrl (${payload.summary.openCapitalGainBrl}).`,
      );
    }
    if (Math.abs(diffAssets - payload.summary.openCapitalGainBrl) > TOLERANCE_CURRENCY) {
      errors.push(
        `Asserção 3 (Ganho Aberto Ativos): V_ativos - C_ativos (${diffAssets.toFixed(2)}) diferente de openCapitalGainBrl (${payload.summary.openCapitalGainBrl}).`,
      );
    }

    // 4. Asserção 4 (Soma de Custódia Individual): sum(V_i) == V_ativos
    const sumCustodyAssets = payload.custodyByClass.reduce((acc, cls) => {
      return acc + cls.assets.reduce((sub, a) => sub + a.currentValueBRL, 0);
    }, 0);
    if (Math.abs(sumCustodyAssets - payload.summary.assetsMarketValueBrl) > TOLERANCE_CURRENCY) {
      errors.push(
        `Asserção 4 (Soma de Custódia): Soma individual dos ativos da custódia (${sumCustodyAssets.toFixed(2)}) diverge de V_ativos (${payload.summary.assetsMarketValueBrl}).`,
      );
    }

    // 5. Asserção 5 (Consistência de Cota e TWR): 100 * (1 + TWR_acum) == Cota_T
    const expectedQuota = Math.round(100.0 * (1 + payload.summary.twrCumulativePct / 100) * 100) / 100;
    if (Math.abs(payload.summary.currentQuotaValueBrl - expectedQuota) > TOLERANCE_CURRENCY) {
      errors.push(
        `Asserção 5 (Consistência Cota x TWR): Cota calculada (${expectedQuota.toFixed(2)}) diverge da cota informada (${payload.summary.currentQuotaValueBrl}).`,
      );
    }

    // 6. Asserção 6 (Continuidade Cronológica — Calendar Spine)
    const series = payload.monthlyEvolutionSeries;
    for (let t = 1; t < series.length; t++) {
      const prev = series[t - 1];
      const curr = series[t];
      if (!prev || !curr) continue;
      const [prevY, prevM] = prev.competence.split("-").map(Number);
      const [currY, currM] = curr.competence.split("-").map(Number);
      if (prevY === undefined || prevM === undefined || currY === undefined || currM === undefined) continue;

      const expectedM = prevM === 12 ? 1 : prevM + 1;
      const expectedY = prevM === 12 ? prevY + 1 : prevY;
      if (currY !== expectedY || currM !== expectedM) {
        errors.push(
          `Asserção 6 (Continuidade Cronológica): Salto de mês detectado entre ${prev.competence} e ${curr.competence}.`,
        );
      }
    }

    // 7. Asserção 7 (Encadeamento de Cotas)
    for (let t = 1; t < series.length; t++) {
      const prev = series[t - 1];
      const curr = series[t];
      if (!prev || !curr) continue;
      const expectedQuotaStep = prev.quotaValueBRL * (1 + curr.monthTwrPct / 100);
      if (Math.abs(curr.quotaValueBRL - expectedQuotaStep) > 0.05) {
        errors.push(
          `Asserção 7 (Encadeamento de Cotas): Cota do mês ${curr.competence} (${curr.quotaValueBRL}) diverge da cota encadeada (${expectedQuotaStep.toFixed(2)}).`,
        );
      }
    }

    // 8. Asserção 8 (Reconciliação de Proventos): sum(Proventos Mês) == Proventos Acumulado
    if (series.length > 0) {
      const sumMonthDividends = series.reduce((acc, row) => acc + row.monthDividendsBRL, 0);
      const lastRow = series[series.length - 1];
      const lastAccumulated = lastRow ? lastRow.accumulatedDividendsBRL : 0;
      if (Math.abs(sumMonthDividends - lastAccumulated) > TOLERANCE_CURRENCY) {
        errors.push(
          `Asserção 8 (Reconciliação Proventos): Soma mensal (${sumMonthDividends.toFixed(2)}) diverge do acumulado final (${lastAccumulated.toFixed(2)}).`,
        );
      }

      // Proventos acumulados devem ser monotonicamente não-decrescentes
      for (let t = 1; t < series.length; t++) {
        const prev = series[t - 1];
        const curr = series[t];
        if (prev && curr && curr.accumulatedDividendsBRL < prev.accumulatedDividendsBRL - 0.01) {
          errors.push(
            `Asserção 8 (Monotonicidade de Proventos): Proventos acumulados decresceram de ${prev.competence} para ${curr.competence}.`,
          );
        }
      }
    }

    // 9. Asserção 9 (Soma de Metas e Gaps): sum(w_meta) == 100,0% e sum(Gap_c) == R$ 0,00
    if (Math.abs(payload.allocationMatrix.totalTargetPct - 100.0) > 0.05) {
      errors.push(
        `Asserção 9 (Soma de Metas): Soma das metas (${payload.allocationMatrix.totalTargetPct}%) diverge de 100,0%.`,
      );
    }
    if (Math.abs(payload.allocationMatrix.totalGapBrl) > TOLERANCE_CURRENCY) {
      errors.push(
        `Asserção 9 (Soma de Gaps): Soma dos gaps financeiros (${payload.allocationMatrix.totalGapBrl}) diverge de R$ 0,00.`,
      );
    }

    // 10. Asserção 10 (Reconciliação de Raios-X)
    const rfCustody = payload.custodyByClass.find((c) => c.className.toLowerCase().includes("renda fixa"));
    if (rfCustody && payload.xRays.fixedIncomeIndexers) {
      if (Math.abs(rfCustody.subtotalMarketValueBRL - payload.xRays.fixedIncomeIndexers.totalValueBRL) > TOLERANCE_CURRENCY) {
        errors.push(
          `Asserção 10 (Raio-X Renda Fixa): Total do Raio-X de indexadores (${payload.xRays.fixedIncomeIndexers.totalValueBRL}) diverge da custódia de Renda Fixa (${rfCustody.subtotalMarketValueBRL}).`,
        );
      }
    }

    const intlCustody = payload.custodyByClass.find((c) => c.className.toLowerCase().includes("internacional"));
    if (intlCustody && payload.xRays.internationalRegions) {
      if (Math.abs(intlCustody.subtotalMarketValueBRL - payload.xRays.internationalRegions.totalValueBRL) > TOLERANCE_CURRENCY) {
        errors.push(
          `Asserção 10 (Raio-X Internacional): Total do Raio-X de regiões (${payload.xRays.internationalRegions.totalValueBRL}) diverge da custódia Internacional (${intlCustody.subtotalMarketValueBRL}).`,
        );
      }
    }

    // 11. Asserção 11 (Contagem de Segmentos e Janela Anual de Risco)
    if (payload.xRays.consolidatedSegments) {
      const declaredCount = payload.xRays.consolidatedSegments.displayedRowsCount;
      const actualCount = payload.xRays.consolidatedSegments.segments.length;
      if (declaredCount !== actualCount) {
        errors.push(
          `Asserção 11 (Contagem de Segmentos): Contador declarado (${declaredCount}) diverge das linhas da tabela (${actualCount}).`,
        );
      }
    }
    if (series.length >= 13) {
      // 12 meses fechados + 1 mês MTD -> janela de risco deve ter exatamente 12 meses
      if (payload.benchmarksAndRisk.riskMetrics.closedMonthsCount !== 12) {
        errors.push(
          `Asserção 11 (Janela Anual de Risco): Esperava 12 meses fechados, recebeu ${payload.benchmarksAndRisk.riskMetrics.closedMonthsCount}.`,
        );
      }
    }

    // 12. Asserção 12 (Sanidade de Escala de Benchmarks)
    for (const b of payload.benchmarksAndRisk.benchmarks) {
      if (b.key === "ibov" && b.accumulatedRatePct < 2.0 && series.length >= 12) {
        errors.push(
          `Asserção 12 (Escala de Benchmark): Taxa do Ibovespa (${b.accumulatedRatePct}%) com erro de escala decimal para período plurianual.`,
        );
      }
    }

    // 13. Asserção 13 (Sanidade de TWR em Carry-Forward / Variação Nula — Gate v2.1)
    // Se DeltaP < 0.01 e DeltaC < 0.01 e Proventos >= 0, TWR não pode ser negativo
    for (let t = 1; t < series.length; t++) {
      const prev = series[t - 1];
      const curr = series[t];
      if (!prev || !curr) continue;
      const deltaP = Math.abs(curr.endEquityBRL - prev.endEquityBRL);
      const deltaC = Math.abs(curr.openCostBRL - prev.openCostBRL);
      if (deltaP < 0.01 && deltaC < 0.01 && curr.monthTwrPct < -0.001) {
        errors.push(
          `Asserção 13 (Sanidade TWR): Mês ${curr.competence} com patrimônio e custo inalterados produziu TWR negativo (${curr.monthTwrPct}%).`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      assertionsCheckedCount: 13,
    };
  }
}
