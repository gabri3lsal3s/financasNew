import { describe, expect, it } from "vitest";
import type {
  PortfolioAsset,
  PortfolioContribution,
  PortfolioDividend,
  PortfolioMonthlyPrice,
  PortfolioTransaction,
} from "@/types";
import {
  cleanContributionNotes,
  extractExplicitRateFromNotes,
} from "./statement-parser";
import {
  CANONICAL_FALLBACK_USD_RATE,
  CANONICAL_MARCO_ZERO_TERMS,
  CANONICAL_PTAX_TICKER,
  CANONICAL_REVERSE_SPLIT_ALIASES,
  CANONICAL_SPLIT_ALIASES,
  CANONICAL_TIMEZONE_BR,
  CANONICAL_WITHDRAWAL_MARKERS,
  PTAX_TICKER_ALIASES,
  applyCanonicalSplitToPosition,
  cleanLegacyNotes,
  computeCanonicalAssetLedger,
  extractLinkedTxIdFromNotes,
  extractSplitRatioFromNotes,
  extractTickerFromNotes,
  findPtaxMonthlyPrice,
  getCanonicalCivilCutoff,
  getMonthEndCutoffDate,
  getTransactionIntradayWeight,
  isCorporateActionType,
  isDateOnOrBefore,
  isHistoricalWithdrawalNote,
  isMarcoZeroNote,
  isPtaxExchangeTicker,
  isReverseSplitType,
  isSplitType,
  isWithinTemporalCutoff,
  normalizeCorporateActionType,
  normalizeCutoffDate,
  normalizeCutoffTimestamp,
  normalizeDateToCivil,
  normalizeLegacyText,
  parseLegacyTextAnnotation,
  reconcilePortfolioEvents,
  resolveCanonicalCorporateActionFactor,
  resolveCanonicalPtaxResolution,
  resolveDynamicPtaxRate,
} from "./canonical-normalizer";

describe("canonical-normalizer — Normalizador Determinístico de Eventos (§Fase 40)", () => {
  const assetPetr4: PortfolioAsset = {
    id: "asset_petr4",
    user_id: "user_1",
    ticker: "PETR4",
    asset_class: "Ações",
    currency: "BRL",
    quantity: 100,
    average_price: 30,
    accumulated_dividends: 150,
  };

  const assetVale3: PortfolioAsset = {
    id: "asset_vale3",
    user_id: "user_1",
    ticker: "VALE3",
    asset_class: "Ações",
    currency: "BRL",
    quantity: 50,
    average_price: 60,
    accumulated_dividends: 0,
  };

  const assetAapl: PortfolioAsset = {
    id: "asset_aapl",
    user_id: "user_1",
    ticker: "AAPL",
    asset_class: "Ações Internacionais",
    currency: "USD",
    quantity: 10,
    average_price: 150,
    accumulated_dividends: 20,
  };

  const assetCaixa: PortfolioAsset = {
    id: "asset_caixa",
    user_id: "user_1",
    ticker: "CAIXA",
    asset_class: "Caixa",
    currency: "BRL",
    quantity: 10000,
    average_price: 1,
    accumulated_dividends: 0,
  };

  const defaultAssets = [assetPetr4, assetVale3, assetAapl, assetCaixa];

  describe("Normalização Temporal e Helpers de Data (§Salvaguarda S13)", () => {
    it("deve definir America/Sao_Paulo como fuso horário canônico de mercado", () => {
      expect(CANONICAL_TIMEZONE_BR).toBe("America/Sao_Paulo");
    });

    it("deve normalizar timestamps ISO completos e datas simples para YYYY-MM-DD", () => {
      expect(normalizeDateToCivil("2026-10-15T14:30:00.000Z")).toBe("2026-10-15");
      expect(normalizeDateToCivil("2026-10-15")).toBe("2026-10-15");
      expect(normalizeDateToCivil("2026-02-28T23:59:59-03:00")).toBe("2026-02-28");
      expect(normalizeDateToCivil("2026-10-31 23:59:59")).toBe("2026-10-31");
      expect(normalizeDateToCivil("")).toBe("");
      expect(normalizeDateToCivil(null)).toBe("");
    });

    it("deve prevenir vazamento de transações noturnas para o mês seguinte devido a UTC (§Salvaguarda S13)", () => {
      // 22:30 em Brasília no dia 31/10/2026 é registrado em UTC como 01:30 de 01/11/2026
      expect(normalizeDateToCivil("2026-11-01T01:30:00.000Z")).toBe("2026-10-31");
      // 23:59:59.999 em Brasília no dia 31/10/2026 é registrado em UTC como 02:59:59.999 de 01/11/2026
      expect(normalizeDateToCivil("2026-11-01T02:59:59.999Z")).toBe("2026-10-31");
      // 00:00:00.000 em Brasília no dia 01/11/2026 é registrado em UTC como 03:00:00.000 de 01/11/2026
      expect(normalizeDateToCivil("2026-11-01T03:00:00.000Z")).toBe("2026-11-01");
    });

    it("deve preservar datas civis sem hora sem deslocamento retrógrado", () => {
      expect(normalizeDateToCivil("2026-10-31")).toBe("2026-10-31");
      expect(normalizeDateToCivil("2026-02-28")).toBe("2026-02-28");
      expect(normalizeDateToCivil("2024-02-29")).toBe("2024-02-29");
    });

    it("deve normalizar formato de competência YYYY-MM para a data civil final daquele mês", () => {
      expect(normalizeDateToCivil("2026-10")).toBe("2026-10-31");
      expect(normalizeDateToCivil("2026-02")).toBe("2026-02-28");
      expect(normalizeDateToCivil("2024-02")).toBe("2024-02-29");
    });

    it("deve normalizar instâncias de Date nativas respeitando o fuso civil", () => {
      const utcDate = new Date("2026-11-01T01:30:00.000Z");
      expect(normalizeDateToCivil(utcDate)).toBe("2026-10-31");
    });

    it("deve calcular o último dia civil do mês considerando anos bissextos", () => {
      expect(getMonthEndCutoffDate("2026-02")).toBe("2026-02-28");
      expect(getMonthEndCutoffDate("2024-02")).toBe("2024-02-29");
      expect(getMonthEndCutoffDate("2026-10")).toBe("2026-10-31");
      expect(getMonthEndCutoffDate("2026-04")).toBe("2026-04-30");
      expect(getMonthEndCutoffDate("2026-10-15")).toBe("2026-10-31");
    });

    it("deve normalizar a data de corte temporal com normalizeCutoffDate", () => {
      expect(normalizeCutoffDate("2026-10")).toBe("2026-10-31");
      expect(normalizeCutoffDate("2026-10-31")).toBe("2026-10-31");
      expect(normalizeCutoffDate("2026-11-01T01:30:00.000Z")).toBe("2026-10-31");
      expect(normalizeCutoffDate("")).toBe("");
      expect(normalizeCutoffDate(null)).toBe("");
    });

    it("deve gerar timestamp de término exato às 23:59:59 com normalizeCutoffTimestamp", () => {
      expect(normalizeCutoffTimestamp("2026-10")).toBe("2026-10-31T23:59:59.999");
      expect(normalizeCutoffTimestamp("2026-10-31")).toBe("2026-10-31T23:59:59.999");
      expect(normalizeCutoffTimestamp("2024-02")).toBe("2024-02-29T23:59:59.999");
    });

    it("deve construir descritor canônico completo com getCanonicalCivilCutoff", () => {
      const cutoff = getCanonicalCivilCutoff("2026-10");
      expect(cutoff.date).toBe("2026-10-31");
      expect(cutoff.timestamp).toBe("2026-10-31T23:59:59.999");
      expect(cutoff.endOfDaySeconds).toBe("2026-10-31T23:59:59");
      expect(cutoff.month).toBe("2026-10");
      expect(cutoff.timeZone).toBe("America/Sao_Paulo");
    });

    it("deve verificar precedência cronológica civil com isDateOnOrBefore", () => {
      expect(isDateOnOrBefore("2026-10-15", "2026-10-31")).toBe(true);
      expect(isDateOnOrBefore("2026-10-31", "2026-10-31")).toBe(true);
      expect(isDateOnOrBefore("2026-11-01", "2026-10-31")).toBe(false);

      // Com corte fornecido como mês YYYY-MM
      expect(isDateOnOrBefore("2026-10-15", "2026-10")).toBe(true);
      expect(isDateOnOrBefore("2026-10-31", "2026-10")).toBe(true);
      expect(isDateOnOrBefore("2026-11-01", "2026-10")).toBe(false);

      // Evento noturno UTC no fim do mês
      expect(isDateOnOrBefore("2026-11-01T01:30:00.000Z", "2026-10-31")).toBe(true);
      expect(isDateOnOrBefore("2026-11-01T01:30:00.000Z", "2026-10")).toBe(true);
      expect(isDateOnOrBefore("2026-11-01T03:00:01.000Z", "2026-10-31")).toBe(false);
      expect(isDateOnOrBefore("2026-11-01T03:00:01.000Z", "2026-10")).toBe(false);
    });

    it("deve verificar inclusão temporal no corte de fim de dia com isWithinTemporalCutoff", () => {
      expect(isWithinTemporalCutoff("2026-10-31T23:59:59.999", "2026-10")).toBe(true);
      expect(isWithinTemporalCutoff("2026-10-31T23:59:59.999", "2026-10-31")).toBe(true);
      expect(isWithinTemporalCutoff("2026-11-01T00:00:00.000", "2026-10")).toBe(false);
      expect(isWithinTemporalCutoff("2026-11-01T00:00:01", "2026-10-31")).toBe(false);
    });
  });

  describe("Normalização de Anotações e Dados Legados (§Salvaguarda S4)", () => {
    it("deve normalizar strings com normalizeLegacyText removendo acentos e caixa alta", () => {
      expect(CANONICAL_MARCO_ZERO_TERMS.length).toBeGreaterThan(10);
      expect(CANONICAL_WITHDRAWAL_MARKERS).toContain("[resgate]");
      expect(normalizeLegacyText("Histórico Inicial")).toBe("historico inicial");
      expect(normalizeLegacyText("MARCO ZERO")).toBe("marco zero");
      expect(normalizeLegacyText("Implantação")).toBe("implantacao");
      expect(normalizeLegacyText(null)).toBe("");
    });

    it("deve identificar anotações de resgate e retirada em múltiplos formatos", () => {
      expect(isHistoricalWithdrawalNote("[Resgate] Retirada para despesa")).toBe(true);
      expect(isHistoricalWithdrawalNote("[retirada] TED")).toBe(true);
      expect(isHistoricalWithdrawalNote("[Saque] Caixa eletrônico")).toBe(true);
      expect(isHistoricalWithdrawalNote("(Resgate) NuBank")).toBe(true);
      expect(isHistoricalWithdrawalNote("(retirada)")).toBe(true);
      expect(isHistoricalWithdrawalNote("(saque)")).toBe(true);
      expect(isHistoricalWithdrawalNote("Retirada do Bolso (Out/2026)")).toBe(true);
      expect(isHistoricalWithdrawalNote("Resgate do Bolso")).toBe(true);
      expect(isHistoricalWithdrawalNote("Saque do Bolso")).toBe(true);
      expect(isHistoricalWithdrawalNote("Resgate Histórico")).toBe(true);
      expect(isHistoricalWithdrawalNote("Resgate: TED para poupança")).toBe(true);
      expect(isHistoricalWithdrawalNote("Retirada: Despesas pessoais")).toBe(true);
      expect(isHistoricalWithdrawalNote("Saque - Caixa")).toBe(true);
      expect(isHistoricalWithdrawalNote("Aporte mensal normal")).toBe(false);
      expect(isHistoricalWithdrawalNote("Compra PETR4")).toBe(false);
      expect(isHistoricalWithdrawalNote(null)).toBe(false);
      expect(isHistoricalWithdrawalNote("")).toBe(false);
    });

    it("deve identificar marcadores de Marco Zero e aporte inaugural com resiliência", () => {
      expect(isMarcoZeroNote("Marco Zero da carteira")).toBe(true);
      expect(isMarcoZeroNote("Marco Histórico · Início da Carteira")).toBe(true);
      expect(isMarcoZeroNote("Marco Histórico")).toBe(true);
      expect(isMarcoZeroNote("Custo inicial histórico")).toBe(true);
      expect(isMarcoZeroNote("Histórico inicial do bolso")).toBe(true);
      expect(isMarcoZeroNote("Aporte historico 2024")).toBe(true);
      expect(isMarcoZeroNote("Aporte Histórico")).toBe(true);
      expect(isMarcoZeroNote("Saldo inicial consolidado")).toBe(true);
      expect(isMarcoZeroNote("Saldo Histórico Inicial")).toBe(true);
      expect(isMarcoZeroNote("Patrimônio Inicial")).toBe(true);
      expect(isMarcoZeroNote("Posição Inicial")).toBe(true);
      expect(isMarcoZeroNote("Inaugural da Carteira")).toBe(true);
      expect(isMarcoZeroNote("Implantação de saldo")).toBe(true);
      expect(isMarcoZeroNote("Ground Zero")).toBe(true);
      expect(isMarcoZeroNote("[Marco Zero]")).toBe(true);
      expect(isMarcoZeroNote("[Custo Inicial]")).toBe(true);
      expect(isMarcoZeroNote("MARCO ZERO CONSOLIDADO")).toBe(true);
      expect(isMarcoZeroNote("HISTÓRICO INICIAL")).toBe(true);
      expect(isMarcoZeroNote("Aporte normal")).toBe(false);
      expect(isMarcoZeroNote("Compra ordinária")).toBe(false);
      expect(isMarcoZeroNote(null)).toBe(false);
      expect(isMarcoZeroNote("")).toBe(false);
    });

    it("deve extrair referências a transações vinculadas via tx: e [tx: ...]", () => {
      expect(extractLinkedTxIdFromNotes("[tx: tx_12345]")).toBe("tx_12345");
      expect(extractLinkedTxIdFromNotes("[tx: buy_petr4]")).toBe("buy_petr4");
      expect(extractLinkedTxIdFromNotes("[tx_id: abc-def-99]")).toBe("abc-def-99");
      expect(extractLinkedTxIdFromNotes("[transacao: 8888]")).toBe("8888");
      expect(extractLinkedTxIdFromNotes("[transação: 7777]")).toBe("7777");
      expect(extractLinkedTxIdFromNotes("[origem: tx_sell_caixa]")).toBe("tx_sell_caixa");
      expect(extractLinkedTxIdFromNotes("Aporte vinculado tx: tx_cash_sell")).toBe("tx_cash_sell");
      expect(extractLinkedTxIdFromNotes("Retirada tx_id: tx_custom_55")).toBe("tx_custom_55");
      expect(extractLinkedTxIdFromNotes("Sem vínculo de transação")).toBeNull();
      expect(extractLinkedTxIdFromNotes("[Rent: +2.5%]")).toBeNull();
      expect(extractLinkedTxIdFromNotes(null)).toBeNull();
      expect(extractLinkedTxIdFromNotes("")).toBeNull();
    });

    it("deve extrair tickers de ativos mencionados explicitamente em colchetes", () => {
      expect(extractTickerFromNotes("Aporte direcionado [PETR4]")).toBe("PETR4");
      expect(extractTickerFromNotes("[VALE3] compra inicial")).toBe("VALE3");
      expect(extractTickerFromNotes("Câmbio [USDBRL=X]")).toBe("USDBRL=X");
      expect(extractTickerFromNotes("Reserva [BTC]")).toBe("BTC");
      expect(extractTickerFromNotes("Aporte [BOVA11]")).toBe("BOVA11");
      // Ignora tags de sistema reservadas
      expect(extractTickerFromNotes("[Resgate]")).toBeNull();
      expect(extractTickerFromNotes("[Retirada]")).toBeNull();
      expect(extractTickerFromNotes("[Rent: +2%]")).toBeNull();
      expect(extractTickerFromNotes("[tx: 123]")).toBeNull();
      expect(extractTickerFromNotes("Sem ativo")).toBeNull();
      expect(extractTickerFromNotes(null)).toBeNull();
    });

    it("deve extrair rentabilidade explícita de notas", () => {
      expect(extractExplicitRateFromNotes("Aporte Histórico [Rent: +2.16%]")).toBe(2.16);
      expect(extractExplicitRateFromNotes("[Rent: -0.80%]")).toBe(-0.8);
      expect(extractExplicitRateFromNotes("[Taxa: 1.5%]")).toBe(1.5);
      expect(extractExplicitRateFromNotes("[Retorno: +3.4%]")).toBe(3.4);
      expect(extractExplicitRateFromNotes("Sem rentabilidade")).toBeNull();
      expect(extractExplicitRateFromNotes(null)).toBeNull();
    });

    it("deve limpar marcadores de sistema para exibição ao usuário com cleanContributionNotes e cleanLegacyNotes", () => {
      expect(cleanContributionNotes("[Resgate] TED para conta corrente [Rent: +1.2%]")).toBe(
        "TED para conta corrente",
      );
      expect(cleanLegacyNotes("[Resgate] TED para conta corrente [Rent: +1.2%]")).toBe(
        "TED para conta corrente",
      );
      expect(
        cleanLegacyNotes("[Saque] Retirada do Bolso [tx: tx_sell_123] [Rent: -0.50%]"),
      ).toBe("Retirada do Bolso");
      expect(cleanLegacyNotes("Aporte simples")).toBe("Aporte simples");
      expect(cleanLegacyNotes("[Resgate] - Transferência bancária")).toBe("Transferência bancária");
      expect(cleanLegacyNotes("[tx: 999]")).toBe("");
      expect(cleanLegacyNotes(null)).toBe("");
    });

    it("deve realizar parsing integral de anotações legadas estruturadas com parseLegacyTextAnnotation", () => {
      const complexWithdrawal = parseLegacyTextAnnotation(
        "[Resgate] Retirada para reforma [PETR4] [tx: tx_sell_caixa] [Rent: +2.5%] (Dividendo)",
      );

      expect(complexWithdrawal.isWithdrawal).toBe(true);
      expect(complexWithdrawal.isMarcoZero).toBe(false);
      expect(complexWithdrawal.explicitRatePct).toBe(2.5);
      expect(complexWithdrawal.linkedTxId).toBe("tx_sell_caixa");
      expect(complexWithdrawal.detectedTicker).toBe("PETR4");
      expect(complexWithdrawal.isDividendSignal).toBe(true);
      expect(complexWithdrawal.cleanNotes).toBe("Retirada para reforma [PETR4] (Dividendo)");
      expect(complexWithdrawal.extractedTags).toContain("withdrawal");
      expect(complexWithdrawal.extractedTags).toContain("rate:2.5%");
      expect(complexWithdrawal.extractedTags).toContain("tx:tx_sell_caixa");
      expect(complexWithdrawal.extractedTags).toContain("ticker:PETR4");
      expect(complexWithdrawal.extractedTags).toContain("dividend");

      const marcoZeroNote = parseLegacyTextAnnotation(
        "Marco Zero da Carteira [Rent: +1.45%] [tx: tx_inaugural]",
      );
      expect(marcoZeroNote.isMarcoZero).toBe(true);
      expect(marcoZeroNote.isWithdrawal).toBe(false);
      expect(marcoZeroNote.explicitRatePct).toBe(1.45);
      expect(marcoZeroNote.linkedTxId).toBe("tx_inaugural");
      expect(marcoZeroNote.cleanNotes).toBe("Marco Zero da Carteira");
      expect(marcoZeroNote.extractedTags).toContain("marco_zero");
    });
  });

  describe("Reconciliação de Proventos (portfolio_dividends vs portfolio_transactions)", () => {
    it("deve evitar duplicidade quando o mesmo provento existe na tabela de dividendos e no ledger", () => {
      const dividends: PortfolioDividend[] = [
        {
          id: "div_1",
          user_id: "user_1",
          asset_id: "asset_petr4",
          ticker: "PETR4",
          date: "2026-10-15",
          amount: 250.0,
          notes: "Dividendo trimestral",
        },
      ];

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_div_1",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "dividend",
          date: "2026-10-15T10:00:00Z",
          quantity: 100,
          price: 2.5,
          total: 250.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        dividends,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      // Deve resultar em exatamente 1 provento unificado
      expect(result.dividends).toHaveLength(1);
      const unified = result.dividends[0]!;
      expect(unified.id).toBe("div_1");
      expect(unified.source).toBe("reconciled");
      expect(unified.originIds).toEqual(["div_1", "tx_div_1"]);
      expect(unified.amountBRL).toBe(250.0);

      // Verificação estatística
      expect(result.summary.duplicateDividendsAvoided).toBe(1);
      expect(result.dividendsByAssetId.get("asset_petr4")).toBe(250.0);
      expect(result.dividendsByMonth.get("2026-10")).toBe(250.0);
      expect(result.auditLog).toHaveLength(1);
      expect(result.auditLog[0]!.category).toBe("dividend");
    });

    it("deve preservar proventos distintos no mesmo dia com valores diferentes", () => {
      const dividends: PortfolioDividend[] = [
        {
          id: "div_jcp",
          user_id: "user_1",
          asset_id: "asset_petr4",
          ticker: "PETR4",
          date: "2026-10-15",
          amount: 100.0,
        },
      ];

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_div_ordinario",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "dividend",
          date: "2026-10-15",
          quantity: 100,
          price: 2.0,
          total: 200.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        dividends,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      // Valores diferentes (100 != 200) não são deduplicados arbitrariamente
      expect(result.dividends).toHaveLength(2);
      expect(result.summary.duplicateDividendsAvoided).toBe(0);
      expect(result.dividendsByAssetId.get("asset_petr4")).toBe(300.0);
    });

    it("deve converter proventos de ativos em USD utilizando taxa de câmbio", () => {
      const dividends: PortfolioDividend[] = [
        {
          id: "div_aapl",
          user_id: "user_1",
          asset_id: "asset_aapl",
          ticker: "AAPL",
          date: "2026-10-20",
          amount: 50.0, // 50 USD
        },
      ];

      const result = reconcilePortfolioEvents({
        dividends,
        assets: defaultAssets,
        usdRate: 5.8,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.dividends).toHaveLength(1);
      const div = result.dividends[0]!;
      expect(div.currency).toBe("USD");
      expect(div.amountNative).toBe(50.0);
      expect(div.amountBRL).toBe(290.0); // 50 * 5.8
      expect(result.dividendsByAssetId.get("asset_aapl")).toBe(290.0);
      expect(result.dividendsNativeByAssetId.get("asset_aapl")).toBe(50.0);
    });

    it("deve incluir proventos acumulados históricos dos ativos como lastro sem distorcer o extrato mensal", () => {
      const result = reconcilePortfolioEvents({
        assets: defaultAssets,
        options: { includeAccumulatedDividends: true },
      });

      // PETR4 tem 150 BRL e AAPL tem 20 USD (com usdRate default 1.0 = 20 BRL)
      expect(result.dividendsByAssetId.get("asset_petr4")).toBe(150.0);
      expect(result.dividendsByAssetId.get("asset_aapl")).toBe(20.0);

      const accPetr4 = result.dividends.find((d) => d.id === "acc_asset_petr4");
      expect(accPetr4?.isAccumulatedBallast).toBe(true);
      expect(accPetr4?.source).toBe("accumulated");
    });

    it("deve parear provento em portfolio_dividends com lançamento no ledger por vínculo explícito tx: (§Salvaguarda S4)", () => {
      const dividends: PortfolioDividend[] = [
        {
          id: "div_explicit_1",
          user_id: "user_1",
          asset_id: "asset_petr4",
          ticker: "PETR4",
          date: "2026-10-15",
          amount: 320.0,
          notes: "Provento [tx: tx_div_explicit_ledger]",
        },
      ];

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_div_explicit_ledger",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "dividend",
          date: "2026-10-15T14:30:00Z",
          quantity: 100,
          price: 3.2,
          total: 320.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        dividends,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.dividends).toHaveLength(1);
      const unified = result.dividends[0]!;
      expect(unified.source).toBe("reconciled");
      expect(unified.originIds).toEqual(["div_explicit_1", "tx_div_explicit_ledger"]);
      expect(unified.linkedTxId).toBe("tx_div_explicit_ledger");
      expect(unified.cleanNotes).toBe("Provento");
      expect(result.summary.duplicateDividendsAvoided).toBe(1);
    });
  });

  describe("Reconciliação de Fluxos Externos e Retiradas (contributions vs cash sell)", () => {
    it("deve unificar resgate em portfolio_contributions e venda de CAIXA no ledger", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "contrib_resgate",
          user_id: "user_1",
          asset_id: null,
          date: "2026-10-18",
          amount: -5000.0,
          notes: "[Resgate] Retirada para reforma",
        },
      ];

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_sell_caixa",
          user_id: "user_1",
          asset_id: "asset_caixa",
          type: "sell",
          date: "2026-10-18T11:00:00Z",
          quantity: 5000,
          price: 1,
          total: 5000.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      // Deve unificar em exatamente 1 fluxo de resgate de R$ 5.000,00 (não R$ 10.000,00)
      expect(result.externalFlows).toHaveLength(1);
      const flow = result.externalFlows[0]!;
      expect(flow.id).toBe("contrib_resgate");
      expect(flow.source).toBe("reconciled");
      expect(flow.originIds).toEqual(["contrib_resgate", "tx_sell_caixa"]);
      expect(flow.isWithdrawal).toBe(true);
      expect(flow.amount).toBe(-5000.0);
      expect(flow.grossOutflow).toBe(5000.0);
      expect(flow.grossInflow).toBe(0);

      expect(result.summary.duplicateWithdrawalsAvoided).toBe(1);
      expect(result.summary.totalGrossWithdrawalsBRL).toBe(5000.0);
      expect(result.summary.netExternalCashFlowBRL).toBe(-5000.0);
    });

    it("deve capturar retiradas avulsas originadas exclusivamente via venda de caixa no ledger", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_saque_avulso",
          user_id: "user_1",
          asset_id: "asset_caixa",
          type: "sell",
          date: "2026-10-22",
          quantity: 1200,
          price: 1,
          total: 1200.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.externalFlows).toHaveLength(1);
      const flow = result.externalFlows[0]!;
      expect(flow.source).toBe("cash_sell");
      expect(flow.isWithdrawal).toBe(true);
      expect(flow.amount).toBe(-1200.0);
      expect(flow.grossOutflow).toBe(1200.0);
    });

    it("deve identificar aporte com Marco Zero e taxa explícita", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "contrib_mz",
          user_id: "user_1",
          asset_id: null,
          date: "2026-01-01",
          amount: 50000.0,
          notes: "Marco Zero da Carteira [Rent: +1.45%]",
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.hasMarcoZero).toBe(true);
      expect(result.externalFlows[0]!.isMarcoZero).toBe(true);
      expect(result.externalFlows[0]!.explicitRatePct).toBe(1.45);
    });

    it("deve parear resgate com venda de caixa no ledger utilizando vínculo explícito [tx: ...] (§Salvaguarda S4)", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "contrib_resgate_tx",
          user_id: "user_1",
          asset_id: null,
          date: "2026-10-18",
          amount: -3000.0,
          notes: "[Resgate] Retirada do Bolso [tx: tx_sell_caixa_linked]",
        },
      ];

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_sell_caixa_linked",
          user_id: "user_1",
          asset_id: "asset_caixa",
          type: "sell",
          date: "2026-10-18T10:00:00Z",
          quantity: 3000,
          price: 1,
          total: 3000.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.externalFlows).toHaveLength(1);
      const flow = result.externalFlows[0]!;
      expect(flow.source).toBe("reconciled");
      expect(flow.originIds).toEqual(["contrib_resgate_tx", "tx_sell_caixa_linked"]);
      expect(flow.linkedTxId).toBe("tx_sell_caixa_linked");
      expect(flow.cleanNotes).toBe("Retirada do Bolso");
      expect(result.summary.duplicateWithdrawalsAvoided).toBe(1);
    });

    it("deve preencher cleanNotes e linkedTxId nos fluxos reconciliados preservando retrocompatibilidade", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "c1",
          user_id: "user_1",
          asset_id: null,
          date: "2026-05-10",
          amount: 1500.0,
          notes: "Aporte mensal [Rent: +2.10%] [tx: tx_aporte_1500]",
        },
        {
          id: "c2",
          user_id: "user_1",
          asset_id: null,
          date: "2026-06-15",
          amount: -750.0,
          notes: "[Saque] Retirada emergencial [Rent: -0.40%]",
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.externalFlows).toHaveLength(2);
      const f1 = result.externalFlows[0]!;
      expect(f1.cleanNotes).toBe("Aporte mensal");
      expect(f1.linkedTxId).toBe("tx_aporte_1500");
      expect(f1.explicitRatePct).toBe(2.1);

      const f2 = result.externalFlows[1]!;
      expect(f2.isWithdrawal).toBe(true);
      expect(f2.cleanNotes).toBe("Retirada emergencial");
      expect(f2.explicitRatePct).toBe(-0.4);
    });

    it("deve reconhecer Marco Zero com termos legados variados (Saldo Inicial, Patrimônio Inicial, Implantação)", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "c_saldo_inicial",
          user_id: "user_1",
          asset_id: null,
          date: "2024-01-01",
          amount: 25000.0,
          notes: "Saldo Inicial Consolidado da Carteira",
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.hasMarcoZero).toBe(true);
      expect(result.externalFlows[0]!.isMarcoZero).toBe(true);
    });
  });

  describe("Reconciliação de Custódia & Compras Diretas via Aporte (§Salvaguarda S2)", () => {
    it("deve evitar duplicidade de compra quando o aporte direcionado já possui ordem no ledger", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "contrib_compra_vale",
          user_id: "user_1",
          asset_id: "asset_vale3",
          date: "2026-10-10",
          amount: 3000.0,
          notes: "Aporte em VALE3",
        },
      ];

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_buy_vale",
          user_id: "user_1",
          asset_id: "asset_vale3",
          type: "buy",
          date: "2026-10-10T14:00:00Z",
          quantity: 50,
          price: 60,
          total: 3000.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      // Custódia deve ter exatamente 1 ordem de compra de R$ 3.000,00 (não R$ 6.000,00)
      expect(result.custodyTransactions).toHaveLength(1);
      expect(result.custodyTransactions[0]!.id).toBe("tx_buy_vale");
      expect(result.boughtByAssetId.get("asset_vale3")).toBe(3000.0);
      expect(result.summary.duplicateContributionsAvoided).toBe(1);

      // Fluxo externo registra 1 aporte de R$ 3.000,00
      expect(result.externalFlows).toHaveLength(1);
      expect(result.summary.totalGrossContributionsBRL).toBe(3000.0);
    });

    it("deve derivar ordem de compra quando houver aporte direcionado sem ordem correspondente no ledger (Salvaguarda S2)", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "contrib_direta_petr",
          user_id: "user_1",
          asset_id: "asset_petr4",
          date: "2026-10-12",
          amount: 4500.0,
          notes: "Aporte financeiro direto",
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      // Salvaguarda S2: o aporte direto gera uma compra derivada para que o custo do ativo não fique nulo
      expect(result.custodyTransactions).toHaveLength(1);
      const derived = result.custodyTransactions[0]!;
      expect(derived.id).toBe("derived_contrib_direta_petr");
      expect(derived.source).toBe("contribution_derived");
      expect(derived.total).toBe(4500.0);
      expect(result.boughtByAssetId.get("asset_petr4")).toBe(4500.0);
    });

    it("deve evitar duplicidade quando o aporte direcionado possui vínculo explícito tx: com ordem do ledger (§Salvaguardas S2 e S4)", () => {
      const contributions: PortfolioContribution[] = [
        {
          id: "contrib_compra_petr_tx",
          user_id: "user_1",
          asset_id: "asset_petr4",
          date: "2026-10-10",
          amount: 2500.0,
          notes: "Aporte para compra PETR4 [tx: tx_buy_petr_explicit]",
        },
      ];

      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_buy_petr_explicit",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "buy",
          date: "2026-10-10T09:00:00Z",
          quantity: 100,
          price: 25,
          total: 2500.0,
        },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      // Não deve gerar compra derivada pois já foi vinculada via tx:
      expect(result.custodyTransactions).toHaveLength(1);
      expect(result.custodyTransactions[0]!.id).toBe("tx_buy_petr_explicit");
      expect(result.summary.duplicateContributionsAvoided).toBe(1);
    });
  });

  describe("Corte Temporal Civil (asOfDate / Cutoff)", () => {
    it("deve filtrar estritamente eventos posteriores à data de corte", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_outubro",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "buy",
          date: "2026-10-25",
          quantity: 10,
          price: 30,
          total: 300,
        },
        {
          id: "tx_novembro",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "buy",
          date: "2026-11-02",
          quantity: 20,
          price: 30,
          total: 600,
        },
      ];

      const dividends: PortfolioDividend[] = [
        {
          id: "div_out",
          user_id: "user_1",
          asset_id: "asset_petr4",
          date: "2026-10-31",
          amount: 50,
        },
        {
          id: "div_nov",
          user_id: "user_1",
          asset_id: "asset_petr4",
          date: "2026-11-05",
          amount: 80,
        },
      ];

      const result = reconcilePortfolioEvents({
        transactions,
        dividends,
        assets: defaultAssets,
        asOfDate: "2026-10-31",
        options: { includeAccumulatedDividends: false },
      });

      // Apenas eventos até 31/10/2026
      expect(result.custodyTransactions).toHaveLength(1);
      expect(result.custodyTransactions[0]!.id).toBe("tx_outubro");
      expect(result.dividends).toHaveLength(1);
      expect(result.dividends[0]!.id).toBe("div_out");
      expect(result.cutoffDate).toBe("2026-10-31");
      expect(result.cutoffTimestamp).toBe("2026-10-31T23:59:59.999");
    });

    it("deve aceitar mês como asOfDate e impedir vazamento de eventos noturnos em UTC (§Salvaguarda S13)", () => {
      const transactions: PortfolioTransaction[] = [
        {
          id: "tx_fim_mes_utc",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "buy",
          // 22:30 em Brasília no dia 31/10/2026 salvo em UTC
          date: "2026-11-01T01:30:00.000Z",
          quantity: 10,
          price: 30,
          total: 300,
        },
        {
          id: "tx_mes_seguinte_utc",
          user_id: "user_1",
          asset_id: "asset_petr4",
          type: "buy",
          // 00:01 em Brasília no dia 01/11/2026 salvo em UTC
          date: "2026-11-01T03:01:00.000Z",
          quantity: 10,
          price: 30,
          total: 300,
        },
      ];

      // Passando apenas a competência YYYY-MM
      const result = reconcilePortfolioEvents({
        transactions,
        assets: defaultAssets,
        asOfDate: "2026-10",
        options: { includeAccumulatedDividends: false },
      });

      expect(result.cutoffDate).toBe("2026-10-31");
      expect(result.cutoffTimestamp).toBe("2026-10-31T23:59:59.999");

      // tx_fim_mes_utc (22:30 BRT do dia 31) deve estar categoricamente dentro de outubro
      expect(result.custodyTransactions).toHaveLength(1);
      expect(result.custodyTransactions[0]!.id).toBe("tx_fim_mes_utc");
    });
  });

  describe("Invariantes e Resumo Estatístico (§Salvaguarda S14)", () => {
    it("deve satisfazer a equação fundamental: netExternalCashFlow = grossContributions - grossWithdrawals", () => {
      const contributions: PortfolioContribution[] = [
        { id: "c1", user_id: "u1", asset_id: null, date: "2026-10-01", amount: 10000 },
        { id: "c2", user_id: "u1", asset_id: null, date: "2026-10-05", amount: 5000 },
        { id: "c3", user_id: "u1", asset_id: null, date: "2026-10-20", amount: -2500, notes: "[Resgate]" },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.summary.totalGrossContributionsBRL).toBe(15000.0);
      expect(result.summary.totalGrossWithdrawalsBRL).toBe(2500.0);
      expect(result.summary.netExternalCashFlowBRL).toBe(12500.0);
    });

    it("deve identificar a primeira data de operação da carteira", () => {
      const contributions: PortfolioContribution[] = [
        { id: "c1", user_id: "u1", asset_id: null, date: "2026-03-15", amount: 1000 },
      ];
      const transactions: PortfolioTransaction[] = [
        { id: "t1", user_id: "u1", asset_id: "asset_petr4", type: "buy", date: "2026-02-10", quantity: 10, price: 20, total: 200 },
      ];

      const result = reconcilePortfolioEvents({
        contributions,
        transactions,
        assets: defaultAssets,
        options: { includeAccumulatedDividends: false },
      });

      expect(result.firstOperationDate).toBe("2026-02-10");
    });

    it("deve lidar com coleções vazias de forma segura sem lançar exceções", () => {
      const result = reconcilePortfolioEvents({});

      expect(result.dividends).toHaveLength(0);
      expect(result.externalFlows).toHaveLength(0);
      expect(result.custodyTransactions).toHaveLength(0);
      expect(result.summary.totalDividendsBRL).toBe(0);
      expect(result.summary.netExternalCashFlowBRL).toBe(0);
      expect(result.firstOperationDate).toBeNull();
      expect(result.hasMarcoZero).toBe(false);
      expect(result.effectiveUsdRate).toBe(1.0);
    });
  });

  describe("Resolução Dinâmica da Taxa de Câmbio PTAX (§Salvaguarda S12)", () => {
    const monthlyPricesOct2026: PortfolioMonthlyPrice[] = [
      {
        id: "pmp_petr4",
        user_id: "user_1",
        ticker: "PETR4",
        month: "2026-10",
        price: 36.5,
        currency: "BRL",
        source: "api",
      },
      {
        id: "pmp_usdbrl",
        user_id: "user_1",
        ticker: "USDBRL=X",
        month: "2026-10",
        price: 5.7812,
        currency: "BRL",
        source: "api",
      },
      {
        id: "pmp_usdbrl_sep",
        user_id: "user_1",
        ticker: "USDBRL=X",
        month: "2026-09",
        price: 5.45,
        currency: "BRL",
        source: "api",
      },
    ];

    it("deve reconhecer o ticker canônico USDBRL=X e seus aliases", () => {
      expect(CANONICAL_PTAX_TICKER).toBe("USDBRL=X");
      expect(PTAX_TICKER_ALIASES).toContain("USDBRL=X");
      expect(PTAX_TICKER_ALIASES).toContain("USD-BRL");
      expect(PTAX_TICKER_ALIASES).toContain("USDBRL");
      expect(PTAX_TICKER_ALIASES).toContain("PTAX");

      expect(isPtaxExchangeTicker("USDBRL=X")).toBe(true);
      expect(isPtaxExchangeTicker("usdbrl=x")).toBe(true);
      expect(isPtaxExchangeTicker("USD-BRL")).toBe(true);
      expect(isPtaxExchangeTicker("USDBRL")).toBe(true);
      expect(isPtaxExchangeTicker("PTAX")).toBe(true);
      expect(isPtaxExchangeTicker("USD_BRL")).toBe(true);

      expect(isPtaxExchangeTicker("PETR4")).toBe(false);
      expect(isPtaxExchangeTicker("AAPL")).toBe(false);
      expect(isPtaxExchangeTicker("")).toBe(false);
      expect(isPtaxExchangeTicker(null)).toBe(false);
      expect(isPtaxExchangeTicker(undefined)).toBe(false);
    });

    it("deve localizar o registro de cotação PTAX na lista mensal com findPtaxMonthlyPrice", () => {
      const found = findPtaxMonthlyPrice(monthlyPricesOct2026, "2026-10");
      expect(found).toBeDefined();
      expect(found?.ticker).toBe("USDBRL=X");
      expect(found?.price).toBe(5.7812);

      const notFound = findPtaxMonthlyPrice(monthlyPricesOct2026, "2026-08");
      expect(notFound).toBeUndefined();
    });

    it("deve resolver dinamicamente a taxa PTAX oficial gravada para a competência exata (§Salvaguarda S12)", () => {
      const resolution = resolveCanonicalPtaxResolution(monthlyPricesOct2026, "2026-10");
      expect(resolution.rate).toBe(5.7812);
      expect(resolution.source).toBe("saved_monthly_price");
      expect(resolution.ticker).toBe("USDBRL=X");
      expect(resolution.month).toBe("2026-10");
      expect(resolution.isFallback).toBe(false);
      expect(resolution.rawPrice).toBe(5.7812);

      // Função simplificada de número direto
      const directRate = resolveDynamicPtaxRate(monthlyPricesOct2026, "2026-10");
      expect(directRate).toBe(5.7812);
    });

    it("deve resolver a taxa PTAX informando data civil ou timestamp completo da competência", () => {
      expect(resolveDynamicPtaxRate(monthlyPricesOct2026, "2026-10-31")).toBe(5.7812);
      expect(resolveDynamicPtaxRate(monthlyPricesOct2026, "2026-10-15T22:30:00Z")).toBe(5.7812);
      expect(resolveDynamicPtaxRate(monthlyPricesOct2026, new Date("2026-10-31T12:00:00Z"))).toBe(5.7812);
    });

    it("deve aceitar tickers alternativos e case-insensitive em portfolio_monthly_prices", () => {
      const pricesWithAlias: PortfolioMonthlyPrice[] = [
        {
          id: "pmp_alias",
          user_id: "user_1",
          ticker: "usd-brl",
          month: "2026-10",
          price: 5.6789,
          currency: "BRL",
          source: "manual",
        },
      ];

      const resolution = resolveCanonicalPtaxResolution(pricesWithAlias, "2026-10");
      expect(resolution.rate).toBe(5.6789);
      expect(resolution.source).toBe("saved_monthly_price");
      expect(resolution.ticker).toBe("USD-BRL");
    });

    it("deve ignorar registros de cotação PTAX com preço <= 0 ou corrompido", () => {
      const pricesWithZero: PortfolioMonthlyPrice[] = [
        {
          id: "pmp_zero",
          user_id: "user_1",
          ticker: "USDBRL=X",
          month: "2026-10",
          price: 0,
          currency: "BRL",
          source: "api",
        },
        {
          id: "pmp_valid_prev",
          user_id: "user_1",
          ticker: "USDBRL=X",
          month: "2026-09",
          price: 5.5,
          currency: "BRL",
          source: "api",
        },
      ];

      // O mês 2026-10 com price 0 é ignorado, caindo no fallback do mês anterior mais recente (2026-09)
      const res = resolveCanonicalPtaxResolution(pricesWithZero, "2026-10");
      expect(res.rate).toBe(5.5);
      expect(res.source).toBe("previous_monthly_price");
      expect(res.isFallback).toBe(true);
    });

    it("deve recorrer à competência anterior mais recente quando o mês corrente não tiver cotação salva", () => {
      const prices: PortfolioMonthlyPrice[] = [
        {
          id: "pmp_jul",
          user_id: "u1",
          ticker: "USDBRL=X",
          month: "2026-07",
          price: 5.4,
          currency: "BRL",
          source: "api",
        },
        {
          id: "pmp_aug",
          user_id: "u1",
          ticker: "USDBRL=X",
          month: "2026-08",
          price: 5.55,
          currency: "BRL",
          source: "api",
        },
      ];

      // Para a competência 2026-10, não há PTAX, mas 2026-08 é a mais recente anterior
      const res = resolveCanonicalPtaxResolution(prices, "2026-10");
      expect(res.rate).toBe(5.55);
      expect(res.source).toBe("previous_monthly_price");
      expect(res.month).toBe("2026-08");
      expect(res.isFallback).toBe(true);
    });

    it("deve recorrer à cotação live recente quando não houver registro histórico salvo", () => {
      const res = resolveCanonicalPtaxResolution([], "2026-10", { liveRate: 5.72 });
      expect(res.rate).toBe(5.72);
      expect(res.source).toBe("live");
      expect(res.isFallback).toBe(true);
    });

    it("deve recorrer ao fallback soberano do sistema (5,25) quando não houver nenhuma referência", () => {
      const res = resolveCanonicalPtaxResolution([], "2026-10");
      expect(res.rate).toBe(CANONICAL_FALLBACK_USD_RATE);
      expect(CANONICAL_FALLBACK_USD_RATE).toBe(5.25);
      expect(res.source).toBe("fallback");
      expect(res.isFallback).toBe(true);
    });

    it("deve permitir taxa explícita prioritária com preferExplicitOverSaved", () => {
      const res = resolveCanonicalPtaxResolution(monthlyPricesOct2026, "2026-10", {
        explicitRate: 6.0,
        preferExplicitOverSaved: true,
      });
      expect(res.rate).toBe(6.0);
      expect(res.source).toBe("explicit");
      expect(res.isFallback).toBe(false);
    });

    it("deve priorizar cotação salva quando preferExplicitOverSaved for false e explicitRate estiver presente", () => {
      const res = resolveCanonicalPtaxResolution(monthlyPricesOct2026, "2026-10", {
        explicitRate: 5.25,
        preferExplicitOverSaved: false,
      });
      // 5.7812 salvo prevalece sobre 5.25
      expect(res.rate).toBe(5.7812);
      expect(res.source).toBe("saved_monthly_price");
    });

    it("deve integrar a resolução dinâmica de PTAX com reconcilePortfolioEvents sem exigir usdRate manual", () => {
      const dividendsUSD: PortfolioDividend[] = [
        {
          id: "div_aapl_oct",
          user_id: "user_1",
          asset_id: "asset_aapl",
          ticker: "AAPL",
          date: "2026-10-25",
          amount: 100.0, // 100 USD
        },
      ];

      const result = reconcilePortfolioEvents({
        dividends: dividendsUSD,
        assets: defaultAssets,
        asOfDate: "2026-10-31",
        monthlyPrices: monthlyPricesOct2026,
        options: { includeAccumulatedDividends: false },
      });

      // Taxa dinâmica PTAX de 5.7812 foi aplicada automaticamente
      expect(result.effectiveUsdRate).toBe(5.7812);
      expect(result.ptaxResolution.source).toBe("saved_monthly_price");
      expect(result.dividends).toHaveLength(1);
      const div = result.dividends[0]!;
      expect(div.currency).toBe("USD");
      expect(div.amountNative).toBe(100.0);
      // 100 * 5.7812 = 578.12
      expect(div.amountBRL).toBe(578.12);
      expect(result.dividendsByAssetId.get("asset_aapl")).toBe(578.12);
    });
  });

  describe("Normalização de Eventos Societários & Desdobramentos (§Salvaguarda S17)", () => {
    describe("Identificação e Classificação Semântica", () => {
      it("deve reconhecer aliases canônicos e variações de split", () => {
        expect(CANONICAL_SPLIT_ALIASES).toContain("split");
        expect(CANONICAL_SPLIT_ALIASES).toContain("desdobramento");
        expect(CANONICAL_SPLIT_ALIASES).toContain("desdobro");

        expect(isSplitType("split")).toBe(true);
        expect(isSplitType("SPLIT")).toBe(true);
        expect(isSplitType("desdobramento")).toBe(true);
        expect(isSplitType("Desdobramento")).toBe(true);
        expect(isSplitType("desdobro")).toBe(true);

        expect(isSplitType("reverse_split")).toBe(false);
        expect(isSplitType("grupamento")).toBe(false);
        expect(isSplitType("buy")).toBe(false);
        expect(isSplitType("sell")).toBe(false);
        expect(isSplitType("")).toBe(false);
        expect(isSplitType(null)).toBe(false);
      });

      it("deve reconhecer aliases canônicos e variações de grupamento (reverse split)", () => {
        expect(CANONICAL_REVERSE_SPLIT_ALIASES).toContain("reverse_split");
        expect(CANONICAL_REVERSE_SPLIT_ALIASES).toContain("grupamento");
        expect(CANONICAL_REVERSE_SPLIT_ALIASES).toContain("inplit");

        expect(isReverseSplitType("reverse_split")).toBe(true);
        expect(isReverseSplitType("REVERSE_SPLIT")).toBe(true);
        expect(isReverseSplitType("grupamento")).toBe(true);
        expect(isReverseSplitType("Grupamento")).toBe(true);
        expect(isReverseSplitType("inplit")).toBe(true);
        expect(isReverseSplitType("reversesplit")).toBe(true);
        expect(isReverseSplitType("reverse-split")).toBe(true);

        expect(isReverseSplitType("split")).toBe(false);
        expect(isReverseSplitType("desdobramento")).toBe(false);
        expect(isReverseSplitType("buy")).toBe(false);
        expect(isReverseSplitType("")).toBe(false);
        expect(isReverseSplitType(null)).toBe(false);
      });

      it("deve detectar se um tipo é evento societário com isCorporateActionType", () => {
        expect(isCorporateActionType("split")).toBe(true);
        expect(isCorporateActionType("reverse_split")).toBe(true);
        expect(isCorporateActionType("desdobramento")).toBe(true);
        expect(isCorporateActionType("grupamento")).toBe(true);
        expect(isCorporateActionType("buy")).toBe(false);
        expect(isCorporateActionType("sell")).toBe(false);
        expect(isCorporateActionType("dividend")).toBe(false);
        expect(isCorporateActionType(null)).toBe(false);
      });

      it("deve normalizar o tipo de evento societário para literais canônicos estritos", () => {
        expect(normalizeCorporateActionType("desdobramento")).toBe("split");
        expect(normalizeCorporateActionType("desdobro")).toBe("split");
        expect(normalizeCorporateActionType("split")).toBe("split");
        expect(normalizeCorporateActionType("grupamento")).toBe("reverse_split");
        expect(normalizeCorporateActionType("inplit")).toBe("reverse_split");
        expect(normalizeCorporateActionType("reverse_split")).toBe("reverse_split");
        expect(normalizeCorporateActionType("buy")).toBeNull();
      });

      it("deve atribuir peso intradiário determinístico 0 para eventos societários na abertura de pregão", () => {
        // Peso 0 para corporate actions (abertura do pregão antes de negociações regulares)
        expect(getTransactionIntradayWeight("split")).toBe(0);
        expect(getTransactionIntradayWeight("reverse_split")).toBe(0);
        expect(getTransactionIntradayWeight("desdobramento")).toBe(0);
        expect(getTransactionIntradayWeight("grupamento")).toBe(0);

        // Peso 1 para compras/subscrições (provisionam custódia disponível)
        expect(getTransactionIntradayWeight("buy")).toBe(1);
        expect(getTransactionIntradayWeight("subscription")).toBe(1);
        expect(getTransactionIntradayWeight("compra")).toBe(1);

        // Peso 2 para vendas/resgates (liquidam da custódia disponível)
        expect(getTransactionIntradayWeight("sell")).toBe(2);
        expect(getTransactionIntradayWeight("venda")).toBe(2);

        // Peso 3 para proventos e outros
        expect(getTransactionIntradayWeight("dividend")).toBe(3);
        expect(getTransactionIntradayWeight("jcp")).toBe(3);
      });
    });

    describe("Extração e Resolução de Razão / Fator (§Salvaguardas S4 e S17)", () => {
      it("deve extrair proporções do tipo X:Y ou X para Y de notas", () => {
        const splitRatio = extractSplitRatioFromNotes("Desdobramento de 1:2 aprovado em AGE");
        expect(splitRatio).toBeDefined();
        expect(splitRatio?.ratioFrom).toBe(1);
        expect(splitRatio?.ratioTo).toBe(2);
        expect(splitRatio?.factor).toBe(2);
        expect(splitRatio?.isReverseSplit).toBe(false);

        const reverseRatio = extractSplitRatioFromNotes("Grupamento de 10:1 aprovado");
        expect(reverseRatio).toBeDefined();
        expect(reverseRatio?.ratioFrom).toBe(10);
        expect(reverseRatio?.ratioTo).toBe(1);
        expect(reverseRatio?.factor).toBe(10);
        expect(reverseRatio?.isReverseSplit).toBe(true);

        const paraRatio = extractSplitRatioFromNotes("Desdobro 1 para 5");
        expect(paraRatio?.factor).toBe(5);
        expect(paraRatio?.isReverseSplit).toBe(false);

        const slashRatio = extractSplitRatioFromNotes("ratio 1/4");
        expect(slashRatio?.factor).toBe(4);
      });

      it("deve extrair fatores explícitos de notas", () => {
        const factorRes = extractSplitRatioFromNotes("Fator: 3.5");
        expect(factorRes).toBeDefined();
        expect(factorRes?.factor).toBe(3.5);
      });

      it("deve retornar null para notas sem proporções societárias", () => {
        expect(extractSplitRatioFromNotes("")).toBeNull();
        expect(extractSplitRatioFromNotes(null)).toBeNull();
        expect(extractSplitRatioFromNotes("Ordem normal de mercado")).toBeNull();
      });

      it("deve resolver o fator canônico priorizando quantity válido", () => {
        const res = resolveCanonicalCorporateActionFactor({
          type: "split",
          quantity: 2,
          notes: "Anotação qualquer",
        });
        expect(res.type).toBe("split");
        expect(res.factor).toBe(2);
        expect(res.isFallback).toBe(false);
      });

      it("deve recorrer a notas quando quantity for <= 0 ou unitário", () => {
        const res = resolveCanonicalCorporateActionFactor({
          type: "reverse_split",
          quantity: 0,
          notes: "Grupamento 10:1",
        });
        expect(res.type).toBe("reverse_split");
        expect(res.factor).toBe(10);
        expect(res.isFallback).toBe(false);
      });

      it("deve utilizar fallback neutro 1 quando não houver fator nem nota válida", () => {
        const res = resolveCanonicalCorporateActionFactor({
          type: "split",
          quantity: 0,
          notes: "Sem dados",
        });
        expect(res.type).toBe("split");
        expect(res.factor).toBe(1);
        expect(res.isFallback).toBe(true);
      });
    });

    describe("Invariante Fundamental da Salvaguarda S17 (Conservação do Custo Total)", () => {
      it("deve ajustar quantidade e PM mantendo o Custo Total rigorosamente constante em Splits", () => {
        // Posição inicial: 100 cotas a PM R$ 30,00 -> Custo Total = R$ 3.000,00
        const result = applyCanonicalSplitToPosition({
          currentQuantity: 100,
          currentTotalCost: 3000.0,
          currentAveragePrice: 30.0,
          factor: 2, // Desdobramento 1:2
          type: "split",
        });

        // Quantidade dobra (100 * 2 = 200)
        expect(result.newQuantity).toBe(200);
        // Preço Médio cai pela metade (R$ 3.000,00 / 200 = R$ 15,00)
        expect(result.newAveragePrice).toBe(15.0);
        // Custo Total permanece rigorosamente constante ao centavo (Salvaguarda S17)
        expect(result.totalCost).toBe(3000.0);
        expect(result.isPreserved).toBe(true);
        expect(result.deltaQuantity).toBe(100);
        expect(result.deltaAveragePrice).toBe(-15.0);
      });

      it("deve ajustar quantidade e PM mantendo o Custo Total rigorosamente constante em Reverse Splits (Grupamentos)", () => {
        // Posição inicial: 100 cotas a PM R$ 10,00 -> Custo Total = R$ 1.000,00
        const result = applyCanonicalSplitToPosition({
          currentQuantity: 100,
          currentTotalCost: 1000.0,
          currentAveragePrice: 10.0,
          factor: 10, // Grupamento 10:1
          type: "reverse_split",
        });

        // Quantidade divide por 10 (100 / 10 = 10)
        expect(result.newQuantity).toBe(10);
        // Preço Médio multiplica por 10 (R$ 1.000,00 / 10 = R$ 100,00)
        expect(result.newAveragePrice).toBe(100.0);
        // Custo Total permanece rigorosamente inalterado em R$ 1.000,00
        expect(result.totalCost).toBe(1000.0);
        expect(result.isPreserved).toBe(true);
        expect(result.deltaQuantity).toBe(-90);
        expect(result.deltaAveragePrice).toBe(90.0);
      });

      it("deve tratar quantidades fracionárias preservando precisão e custo constante", () => {
        // Posição inicial: 15 cotas com Custo Total R$ 499,95 (PM R$ 33,33)
        const result = applyCanonicalSplitToPosition({
          currentQuantity: 15,
          currentTotalCost: 499.95,
          factor: 2, // Grupamento 2:1
          type: "reverse_split",
        });

        expect(result.newQuantity).toBe(7.5);
        // PM recalculado = 499.95 / 7.5 = 66.66
        expect(result.newAveragePrice).toBe(66.66);
        expect(result.totalCost).toBe(499.95);
        expect(result.isPreserved).toBe(true);
      });

      it("deve lidar defensivamente com posição zerada sem gerar NaN", () => {
        const result = applyCanonicalSplitToPosition({
          currentQuantity: 0,
          currentTotalCost: 0,
          factor: 2,
          type: "split",
        });

        expect(result.newQuantity).toBe(0);
        expect(result.newAveragePrice).toBe(0);
        expect(result.totalCost).toBe(0);
        expect(result.isPreserved).toBe(true);
      });
    });

    describe("Reconciliação no Ledger com Eventos Societários (reconcilePortfolioEvents)", () => {
      it("deve forçar total = 0 e price = 0 em transações de split, prevenindo distorção de caixa", () => {
        const transactions: PortfolioTransaction[] = [
          {
            id: "tx_buy_1",
            user_id: "user_1",
            asset_id: "asset_petr4",
            type: "buy",
            date: "2026-10-01",
            quantity: 100,
            price: 30,
            total: 3000,
          },
          {
            id: "tx_split_1",
            user_id: "user_1",
            asset_id: "asset_petr4",
            type: "split",
            date: "2026-10-15",
            quantity: 2, // Fator 2
            // Mesmo se por erro de importação vierem com price ou total > 0
            price: 15,
            total: 1500,
          },
        ];

        const result = reconcilePortfolioEvents({
          transactions,
          assets: defaultAssets,
          options: { includeAccumulatedDividends: false },
        });

        expect(result.custodyTransactions).toHaveLength(2);
        const splitTx = result.custodyTransactions.find((t) => t.id === "tx_split_1")!;
        expect(splitTx.type).toBe("split");
        expect(splitTx.quantity).toBe(2);
        // Salvaguarda S17: price e total são categoricamente zerados
        expect(splitTx.price).toBe(0);
        expect(splitTx.total).toBe(0);

        // Compras totais no resumo registram apenas a compra legítima de R$ 3.000,00 (não R$ 4.500,00)
        expect(result.summary.totalBuysBRL).toBe(3000.0);
        expect(result.summary.totalCorporateActionsCount).toBe(1);
      });

      it("deve aplicar precedência intradiária determinística ordenando split antes de venda no mesmo dia civil", () => {
        // No dia 2026-10-15 o usuário tinha 50 ações. Houve split de 1:2 (passando para 100) e uma venda de 60 ações.
        // Se a venda fosse processada antes do split, geraria falso saldo negativo de -10 ações!
        const transactions: PortfolioTransaction[] = [
          {
            id: "tx_sell_same_day",
            user_id: "user_1",
            asset_id: "asset_petr4",
            type: "sell",
            date: "2026-10-15",
            quantity: 60,
            price: 20,
            total: 1200,
          },
          {
            id: "tx_split_same_day",
            user_id: "user_1",
            asset_id: "asset_petr4",
            type: "split",
            date: "2026-10-15",
            quantity: 2,
            price: 0,
            total: 0,
          },
        ];

        const result = reconcilePortfolioEvents({
          transactions,
          assets: defaultAssets,
          options: { includeAccumulatedDividends: false },
        });

        expect(result.custodyTransactions).toHaveLength(2);
        // O split (peso 0) DEVE vir categoricamente antes da venda (peso 2)
        expect(result.custodyTransactions[0]!.id).toBe("tx_split_same_day");
        expect(result.custodyTransactions[0]!.type).toBe("split");
        expect(result.custodyTransactions[1]!.id).toBe("tx_sell_same_day");
        expect(result.custodyTransactions[1]!.type).toBe("sell");
      });
    });

    describe("Reconstituição Cronológica de Custódia com Salvaguarda S17 (computeCanonicalAssetLedger)", () => {
      it("deve reconstituir o ciclo completo de compras, splits, vendas e reverse splits com Custo Total constante", () => {
        const txs = [
          // 1. Compra 100 ações a R$ 20,00 -> Qtd: 100, Custo: R$ 2.000,00, PM: R$ 20,00
          { date: "2026-01-10", type: "buy", quantity: 100, price: 20, total: 2000 },
          // 2. Compra 50 ações a R$ 30,00 -> Qtd: 150, Custo: R$ 3.500,00, PM: R$ 23,3333
          { date: "2026-02-15", type: "buy", quantity: 50, price: 30, total: 1500 },
          // 3. Desdobramento 1:2 -> Qtd: 300, Custo: R$ 3.500,00 (RIGOROSAMENTE CONSTANTE), PM: R$ 11,6667
          { date: "2026-03-20", type: "split", quantity: 2, price: 0, total: 0 },
          // 4. Venda de 100 ações -> Vende 100 a PM 11,6667 (baixa R$ 1.166,67 de custo), restando Qtd: 200, Custo: R$ 2.333,33, PM: R$ 11,6667
          { date: "2026-04-10", type: "sell", quantity: 100, price: 18, total: 1800 },
          // 5. Grupamento 2:1 -> Qtd: 100, Custo: R$ 2.333,33 (RIGOROSAMENTE CONSTANTE), PM: R$ 23,3333
          { date: "2026-05-15", type: "reverse_split", quantity: 2, price: 0, total: 0 },
        ];

        const ledger = computeCanonicalAssetLedger(txs);

        expect(ledger.quantity).toBe(100);
        expect(ledger.totalCost).toBe(2333.33);
        expect(ledger.averagePrice).toBe(23.3333);
        expect(ledger.corporateActionsCount).toBe(2);
        expect(ledger.transactionsProcessed).toBe(5);
      });

      it("deve lidar com proventos sem corromper o preço médio ou o custo total", () => {
        const txs = [
          { date: "2026-01-10", type: "buy", quantity: 100, price: 10, total: 1000 },
          { date: "2026-02-01", type: "dividend", quantity: 0, price: 0, total: 150 },
          { date: "2026-03-01", type: "split", quantity: 2, price: 0, total: 0 },
        ];

        const ledger = computeCanonicalAssetLedger(txs);

        expect(ledger.quantity).toBe(200);
        expect(ledger.totalCost).toBe(1000.0); // Preservado
        expect(ledger.averagePrice).toBe(5.0); // 1000 / 200
        expect(ledger.dividendsTotal).toBe(150.0);
      });
    });
  });
});
