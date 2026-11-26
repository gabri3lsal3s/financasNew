import { describe, expect, it } from "vitest";
import {
  classifyDividendInstrumentFromCatalogEntry,
  computeOperationalDiscoveryFloor,
  DIVIDEND_TRACKING_MIN_DATE,
  effectiveStartDate,
  evaluateGroupCutoffEligibility,
  evaluateLotCutoffAtComDate,
  findCompatibleCorporateCandidate,
  getDividendTrustTierPriority,
  isAssetEligibleForDividendCalibration,
  isAssetPendingDividendCalibration,
  isValidCivilDate,
  isValidDividendSettlementDate,
  isValidDividendTrackingDate,
  matchesOperationalCatalogWindow,
  normalizeCanonicalDividendTicker,
  resolveExternalDistributionTerms,
  resolveFirstProvenCustodyDay,
  resolveOpenDividendEventStatus,
  selectPrimaryLotForGroup,
  summarizeCalibrationPlan,
  type DividendCustodyTxInput,
  type DividendLotInput,
} from "./dividend-engine";
import { countMarketBusinessDays } from "./market-calendar";
import { getCuratedDividendInstrument } from "./tickers-catalog";

describe("dividend-engine: Marco Zero, corte, janela operacional e custódia pura (S1)", () => {
  describe("validações de data civil e janela operacional", () => {
    it("valida datas civis estritas e rejeita dias inexistentes (ex.: 31/02)", () => {
      expect(isValidCivilDate("2026-01-01")).toBe(true);
      expect(isValidCivilDate("2024-02-29")).toBe(true);
      expect(isValidCivilDate("2025-02-29")).toBe(false);
      expect(isValidCivilDate("2026-02-31")).toBe(false);
      expect(isValidCivilDate("2026-13-01")).toBe(false);
      expect(isValidCivilDate("01/01/2026")).toBe(false);
    });

    it("aceita cortes de acompanhamento entre 2000-01-01 e amanhã em São Paulo", () => {
      const today = "2026-11-26";
      expect(isValidDividendTrackingDate(DIVIDEND_TRACKING_MIN_DATE, today)).toBe(true);
      expect(isValidDividendTrackingDate("2026-11-26", today)).toBe(true);
      expect(isValidDividendTrackingDate("2026-11-27", today)).toBe(true);
      expect(isValidDividendTrackingDate("1999-12-31", today)).toBe(false);
      expect(isValidDividendTrackingDate("2026-11-28", today)).toBe(false);
    });

    it("valida data real de pagamento apenas entre COM e hoje (inclusive)", () => {
      const today = "2026-11-26";
      expect(isValidDividendSettlementDate("2026-11-26", "2026-11-10", today)).toBe(true);
      expect(isValidDividendSettlementDate("2026-11-10", "2026-11-10", today)).toBe(true);
      expect(isValidDividendSettlementDate(null, "2026-11-10", today)).toBe(false);
      expect(isValidDividendSettlementDate("", "2026-11-10", today)).toBe(false);
      expect(isValidDividendSettlementDate("2026-11-27", "2026-11-10", today)).toBe(false);
      expect(isValidDividendSettlementDate("2026-11-09", "2026-11-10", today)).toBe(false);
    });

    it("aplica janela operacional de 120 dias e preserva pagamento tardio", () => {
      const today = "2026-11-26";
      expect(computeOperationalDiscoveryFloor(today)).toBe("2026-07-29");

      expect(
        matchesOperationalCatalogWindow(
          { com_date: "2026-10-01", payment_date: null },
          today,
        ),
      ).toBe(true);

      // Data COM antiga (>120d), mas pagamento dentro dos últimos 120 dias -> incluído
      expect(
        matchesOperationalCatalogWindow(
          { com_date: "2025-12-01", payment_date: "2026-09-15" },
          today,
        ),
      ).toBe(true);

      // COM e pagamento antigos -> fora da janela operacional padrão
      expect(
        matchesOperationalCatalogWindow(
          { com_date: "2026-01-10", payment_date: "2026-02-01" },
          today,
        ),
      ).toBe(false);

      // Data COM futura -> fora
      expect(
        matchesOperationalCatalogWindow(
          { com_date: "2026-11-27", payment_date: null },
          today,
        ),
      ).toBe(false);
    });
  });

  describe("normalizeCanonicalDividendTicker", () => {
    it("remove sufixo fracionário F na B3 sem alterar tickers USD", () => {
      expect(normalizeCanonicalDividendTicker("petr4f.sa", "BRL")).toBe("PETR4");
      expect(normalizeCanonicalDividendTicker("MXRF11F", "BRL")).toBe("MXRF11");
      expect(normalizeCanonicalDividendTicker("ABC1F", "USD")).toBe("ABC1F");
      expect(normalizeCanonicalDividendTicker("AAPL", "USD")).toBe("AAPL");
    });
  });

  describe("effectiveStartDate e prova de custódia por lote", () => {
    it("retorna null quando acumulado > 0 e lote não possui dividendsStartDate", () => {
      expect(
        effectiveStartDate({
          trackingStartDate: "2026-01-01",
          dividendsStartDate: null,
          accumulatedDividends: 500,
          firstProvenCustodyDay: "2024-01-15",
        }),
      ).toBeNull();
    });

    it("aplica max(trackingStartDate, dividendsStartDate) quando corte explícito existe", () => {
      expect(
        effectiveStartDate({
          trackingStartDate: "2026-06-01",
          dividendsStartDate: "2026-03-01",
          accumulatedDividends: 200,
          firstProvenCustodyDay: "2025-01-01",
        }),
      ).toBe("2026-06-01");

      expect(
        effectiveStartDate({
          trackingStartDate: "2026-01-01",
          dividendsStartDate: "2026-08-10",
          accumulatedDividends: 200,
          firstProvenCustodyDay: "2025-01-01",
        }),
      ).toBe("2026-08-10");
    });

    it("sem acumulado nem corte usa max(trackingStartDate, firstProvenCustodyDay) e recua ao antecipar piso global", () => {
      expect(
        effectiveStartDate({
          trackingStartDate: "2026-08-01",
          dividendsStartDate: null,
          accumulatedDividends: 0,
          firstProvenCustodyDay: "2025-05-01",
        }),
      ).toBe("2026-08-01");

      expect(
        effectiveStartDate({
          trackingStartDate: "2025-02-01",
          dividendsStartDate: null,
          accumulatedDividends: 0,
          firstProvenCustodyDay: "2025-05-01",
        }),
      ).toBe("2025-05-01");
    });

    it("não projeta baseline residual para compras anteriores e separa prova do ledger", () => {
      const lot: DividendLotInput = {
        id: "lot-1",
        ticker: "PETR4",
        currency: "BRL",
        asset_class: "Ações",
        quantity: 50, // 10 via buy em 2026-09-01 + 40 baseline cadastrado em 2026-10-01
        accumulated_dividends: 0,
        dividends_start_date: null,
        created_at: "2026-10-01T12:00:00Z",
      };
      const txs: DividendCustodyTxInput[] = [
        { id: "tx-1", asset_id: "lot-1", type: "buy", date: "2026-09-01", quantity: 10 },
      ];

      expect(resolveFirstProvenCustodyDay(lot, txs)).toBe("2026-09-01");
      // Em 2026-09-15 (antes da criação do baseline): apenas as 10 cotas documentadas no ledger
      expect(evaluateLotCutoffAtComDate(lot, txs, "2026-09-15", "2026-01-01").qtyAtCom).toBe(10);
      // Em 2026-10-05 (após a criação do baseline): 40 baseline + 10 ledger = 50
      expect(evaluateLotCutoffAtComDate(lot, txs, "2026-10-05", "2026-01-01").qtyAtCom).toBe(50);
    });

    it("bloqueia legado sem timestamp nem ledger até declaração explícita", () => {
      const legacyLot: DividendLotInput = {
        id: "lot-legacy",
        ticker: "ITUB4",
        currency: "BRL",
        asset_class: "Ações",
        quantity: 100,
        accumulated_dividends: 0,
        dividends_start_date: null,
        created_at: null,
      };
      expect(evaluateLotCutoffAtComDate(legacyLot, [], "2026-10-15", "2026-01-01")).toMatchObject({
        eligible: false,
        qtyAtCom: 0,
      });

      const calibratedLegacy: DividendLotInput = {
        ...legacyLot,
        dividends_start_date: "2026-10-15",
      };
      expect(evaluateLotCutoffAtComDate(calibratedLegacy, [], "2026-10-15", "2026-01-01")).toMatchObject({
        eligible: true,
        qtyAtCom: 100,
      });
    });

    it("venda total antes da Data COM exclui; após a Data COM preserva o direito mesmo com saldo 0", () => {
      const soldLot: DividendLotInput = {
        id: "lot-sold",
        ticker: "BBAS3",
        currency: "BRL",
        asset_class: "Ações",
        quantity: 0,
        accumulated_dividends: 0,
        created_at: "2026-01-10T10:00:00Z",
      };
      const txs: DividendCustodyTxInput[] = [
        { id: "tx-1", asset_id: "lot-sold", type: "buy", date: "2026-02-01", quantity: 30 },
        { id: "tx-2", asset_id: "lot-sold", type: "sell", date: "2026-05-10", quantity: 30 },
      ];

      expect(evaluateLotCutoffAtComDate(soldLot, txs, "2026-05-05", "2026-01-01").qtyAtCom).toBe(30);
      expect(evaluateLotCutoffAtComDate(soldLot, txs, "2026-05-11", "2026-01-01").qtyAtCom).toBe(0);
    });
  });

  describe("evaluateGroupCutoffEligibility, calibração e plano", () => {
    it("avalia grupo misto PETR4 + PETR4F considerando todos os lotes sem decidir só pelo principal", () => {
      const lotFull: DividendLotInput = {
        id: "lot-full",
        ticker: "PETR4",
        currency: "BRL",
        asset_class: "Ações",
        quantity: 100,
        accumulated_dividends: 400,
        dividends_start_date: "2026-11-01",
      };
      const lotFrac: DividendLotInput = {
        id: "lot-frac",
        ticker: "PETR4F",
        currency: "BRL",
        asset_class: "Ações",
        quantity: 10,
        accumulated_dividends: 0,
        dividends_start_date: "2026-01-01",
      };
      const txs: DividendCustodyTxInput[] = [
        { id: "t1", asset_id: "lot-full", type: "buy", date: "2026-01-10", quantity: 100 },
        { id: "t2", asset_id: "lot-frac", type: "buy", date: "2026-01-10", quantity: 10 },
      ];

      const res = evaluateGroupCutoffEligibility({
        canonicalTicker: "PETR4",
        currency: "BRL",
        comDate: "2026-10-15",
        trackingStartDate: "2026-01-01",
        lots: [lotFull, lotFrac],
        transactions: txs,
      });

      expect(res.eligible).toBe(true);
      expect(res.hasMixedEligibility).toBe(true);
      expect(res.eligibleLotCount).toBe(1);
      expect(res.ineligibleLotCount).toBe(1);
      expect(res.totalEligibleQty).toBe(10);
    });

    it("identifica ativos elegíveis e pendentes de calibração ignorando Caixa e Renda Fixa", () => {
      expect(isAssetEligibleForDividendCalibration({ ticker: "CAIXA", asset_class: "Caixa" })).toBe(false);
      expect(isAssetEligibleForDividendCalibration({ ticker: "Tesouro Selic", asset_class: "Renda Fixa" })).toBe(false);
      expect(isAssetEligibleForDividendCalibration({ ticker: "BTC", asset_class: "Cripto" })).toBe(false);
      expect(
        isAssetPendingDividendCalibration({
          ticker: "MXRF11",
          asset_class: "FIIs",
          accumulated_dividends: 150,
          dividends_start_date: null,
        }),
      ).toBe(true);
      expect(
        isAssetPendingDividendCalibration({
          ticker: "MXRF11",
          asset_class: "FIIs",
          accumulated_dividends: 150,
          dividends_start_date: "2026-05-01",
        }),
      ).toBe(false);
    });

    it("resume contagens por data e primeiro dia coberto respeitando trackingStartDate", () => {
      const summary = summarizeCalibrationPlan(
        [
          { assetId: "a1", selected: true, targetDate: "2026-08-01" },
          { assetId: "a2", selected: true, targetDate: "2026-08-01" },
          { assetId: "a3", selected: true, targetDate: "2026-10-15" },
          { assetId: "a4", selected: false, targetDate: "2026-01-01" },
        ],
        "2026-09-01",
      );

      expect(summary.selectedCount).toBe(3);
      expect(summary.dateCounts).toEqual([
        { date: "2026-08-01", count: 2 },
        { date: "2026-10-15", count: 1 },
      ]);
      expect(summary.firstCoveredDay).toBe("2026-09-01");
    });
  });

  describe("Fatia S2: Lote principal, Instrumentos curados, Prazos (15/22/35) e Fontes", () => {
    it("selectPrimaryLotForGroup prefere lote padrão sobre fracionário maior e preserva F em USD", () => {
      const lots = [
        { id: "a-frac", ticker: "PETR4F", currency: "BRL" },
        { id: "z-std", ticker: "PETR4", currency: "BRL" },
      ];
      expect(selectPrimaryLotForGroup(lots)?.id).toBe("z-std");

      const onlyFrac = [
        { id: "b-frac", ticker: "PETR4F", currency: "BRL" },
        { id: "a-frac", ticker: "PETR4F", currency: "BRL" },
      ];
      expect(selectPrimaryLotForGroup(onlyFrac)?.id).toBe("a-frac");

      const usLots = [
        { id: "b-us", ticker: "MSFTF", currency: "USD" },
        { id: "a-us", ticker: "MSFTF", currency: "USD" },
      ];
      expect(selectPrimaryLotForGroup(usLots)?.id).toBe("a-us");
    });

    it("distingue instrumentos pelo catálogo curado sem inferir isenção por sufixo 11", () => {
      expect(getCuratedDividendInstrument("MXRF11").kind).toBe("fii_fiagro");
      expect(getCuratedDividendInstrument("VGIA11").kind).toBe("fii_fiagro");
      expect(getCuratedDividendInstrument("BOVA11").kind).toBe("etf");
      expect(getCuratedDividendInstrument("ENGI11").kind).toBe("unit");
      expect(getCuratedDividendInstrument("XXXX11").kind).toBe("unknown");
      expect(
        classifyDividendInstrumentFromCatalogEntry({
          assetClass: "FIIs",
          sector: "Infraestrutura / FI-Infra",
        }),
      ).toBe("fi_infra");
    });

    it("aplica prazos 15 pregões BR (fundos), 22 pregões US (exterior) e 35 dias civis (ações BR) sem liquidar", () => {
      // 15/16 pregões BR (2026-09-30 -> 2026-10-22 = 15; 2026-10-23 = 16)
      const fii15 = resolveOpenDividendEventStatus({
        comDate: "2026-09-30",
        paymentDate: null,
        referenceDate: "2026-10-22",
        market: "BR",
        instrumentKind: "fii_fiagro",
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(fii15.status).toBe("PROVISIONED");
      expect(fii15.elapsedCount).toBe(15);
      expect(fii15.promotedByDeadline).toBe(false);

      const fii16 = resolveOpenDividendEventStatus({
        comDate: "2026-09-30",
        paymentDate: null,
        referenceDate: "2026-10-23",
        market: "BR",
        instrumentKind: "fii_fiagro",
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(fii16.status).toBe("PENDING_CONFIRMATION");
      expect(fii16.elapsedCount).toBe(16);
      expect(fii16.promotedByDeadline).toBe(true);

      // 22/23 pregões US (2026-09-01 -> 2026-10-02 = 22 pregões NYSE c/ Labor Day 07/09; 2026-10-05 = 23)
      const us22 = resolveOpenDividendEventStatus({
        comDate: "2026-09-01",
        paymentDate: null,
        referenceDate: "2026-10-02",
        market: "US",
        instrumentKind: "exterior",
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(us22.status).toBe("PROVISIONED");
      expect(us22.elapsedCount).toBe(22);

      const us23 = resolveOpenDividendEventStatus({
        comDate: "2026-09-01",
        paymentDate: null,
        referenceDate: "2026-10-05",
        market: "US",
        instrumentKind: "exterior",
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(us23.status).toBe("PENDING_CONFIRMATION");
      expect(us23.elapsedCount).toBe(23);

      // 35/36 dias civis para ação BR
      const acao35 = resolveOpenDividendEventStatus({
        comDate: "2026-09-01",
        paymentDate: null,
        referenceDate: "2026-10-06",
        market: "BR",
        instrumentKind: "acao_br",
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(acao35.status).toBe("PROVISIONED");
      expect(acao35.elapsedCount).toBe(35);

      const acao36 = resolveOpenDividendEventStatus({
        comDate: "2026-09-01",
        paymentDate: null,
        referenceDate: "2026-10-07",
        market: "BR",
        instrumentKind: "acao_br",
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(acao36.status).toBe("PENDING_CONFIRMATION");
      expect(acao36.elapsedCount).toBe(36);

      // Regressão PENDING_CONFIRMATION -> PROVISIONED quando fonte corrige data futura em aberto automático
      const regressed = resolveOpenDividendEventStatus({
        comDate: "2026-09-01",
        paymentDate: "2026-12-10",
        referenceDate: "2026-11-26",
        market: "BR",
        instrumentKind: "fii_fiagro",
        currentStatus: "PENDING_CONFIRMATION",
        isManual: false,
        manualReviewRequired: false,
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(regressed.status).toBe("PROVISIONED");
      expect(regressed.regressedToProvisioned).toBe(true);

      // > 120 dias sem pagamento: sinaliza isOver120DaysWithoutPayment sem criar estado EXPIRED
      const over120 = resolveOpenDividendEventStatus({
        comDate: "2026-06-01",
        paymentDate: null,
        referenceDate: "2026-11-26",
        market: "BR",
        instrumentKind: "acao_br",
        countBusinessDays: (a, b, m) => countMarketBusinessDays(a, b, m),
      });
      expect(over120.status).toBe("PENDING_CONFIRMATION");
      expect(over120.isOver120DaysWithoutPayment).toBe(true);
    });

    it("mantém MXRF11/VGIA11 do Yahoo isolado em raw_fallback incerto e só enriquece com observação pública", () => {
      const mxrfYahooOnly = resolveExternalDistributionTerms({
        provider: "yahoo",
        currency: "BRL",
        instrumentKind: "fii_fiagro",
        hasOfficialComDate: false,
        rate: 0.1,
        comDate: "2026-10-30",
        paymentDate: "2026-11-15",
      });
      expect(mxrfYahooOnly.trustTier).toBe("raw_fallback");
      expect(mxrfYahooOnly.isTypeUncertain).toBe(true);

      const mxrfEnriched = resolveExternalDistributionTerms({
        provider: "yahoo",
        currency: "BRL",
        instrumentKind: "fii_fiagro",
        hasOfficialComDate: false,
        rate: 0.1,
        comDate: "2026-10-30",
        paymentDate: "2026-11-15",
        publicOrdinaryYieldObservation: { type: "RENDIMENTO", taxRatePct: 0 },
      });
      expect(mxrfEnriched.trustTier).toBe("enriched_fallback");
      expect(mxrfEnriched.type).toBe("RENDIMENTO");
      expect(mxrfEnriched.isTypeUncertain).toBe(false);

      // ETF/Unit não recebem isenção mesmo com observação
      const etfBlocked = resolveExternalDistributionTerms({
        provider: "yahoo",
        currency: "BRL",
        instrumentKind: "etf",
        hasOfficialComDate: false,
        rate: 1.2,
        comDate: "2026-10-30",
        paymentDate: "2026-11-15",
        publicOrdinaryYieldObservation: { type: "RENDIMENTO", taxRatePct: 0 },
      });
      expect(etfBlocked.trustTier).toBe("raw_fallback");
      expect(etfBlocked.isTypeUncertain).toBe(true);

      // Amortização explícita preserva natureza
      const amort = resolveExternalDistributionTerms({
        provider: "brapi",
        currency: "BRL",
        instrumentKind: "fii_fiagro",
        rawLabel: "AMORTIZACAO",
        hasOfficialComDate: true,
        rate: 2.5,
        comDate: "2026-10-30",
        paymentDate: "2026-11-15",
      });
      expect(amort.type).toBe("AMORTIZACAO");
      expect(amort.trustTier).toBe("official");
      expect(amort.taxRatePct).toBe(0);
    });

    it("resolve similaridade ±1/±2 pregões apenas com candidato único e preserva prioridade de trust_tier", () => {
      expect(getDividendTrustTierPriority("official")).toBeGreaterThan(
        getDividendTrustTierPriority("community_verified"),
      );
      expect(getDividendTrustTierPriority("community_verified")).toBeGreaterThan(
        getDividendTrustTierPriority("enriched_fallback"),
      );
      expect(getDividendTrustTierPriority("enriched_fallback")).toBeGreaterThan(
        getDividendTrustTierPriority("raw_fallback"),
      );

      const cand1 = {
        id: "corp-1",
        ticker: "PETR4",
        currency: "BRL" as const,
        com_date: "2026-10-15",
        payment_date: null,
        type: "DIVIDENDO" as const,
        rate: 1.0,
        is_type_uncertain: true,
        ex_date: "2026-10-16",
      };

      const matched1Day = findCompatibleCorporateCandidate(
        {
          ticker: "PETR4",
          currency: "BRL",
          com_date: "2026-10-16",
          payment_date: "2026-11-20",
          type: "JCP",
          rate: 1.005,
          is_type_uncertain: false,
        },
        [cand1],
        (a, b, m) => countMarketBusinessDays(a, b, m),
      );
      expect(matched1Day?.id).toBe("corp-1");

      // 2 pregões sem mesma ex_date não casa; com mesma ex_date casa
      const noExMatch = findCompatibleCorporateCandidate(
        {
          ticker: "PETR4",
          currency: "BRL",
          com_date: "2026-10-19",
          payment_date: null,
          type: "JCP",
          rate: 1.0,
          is_type_uncertain: false,
        },
        [cand1],
        (a, b, m) => countMarketBusinessDays(a, b, m),
      );
      expect(noExMatch).toBeNull();

      const withExMatch = findCompatibleCorporateCandidate(
        {
          ticker: "PETR4",
          currency: "BRL",
          com_date: "2026-10-19",
          payment_date: null,
          type: "JCP",
          rate: 1.0,
          is_type_uncertain: false,
          ex_date: "2026-10-16",
        },
        [cand1],
        (a, b, m) => countMarketBusinessDays(a, b, m),
      );
      expect(withExMatch?.id).toBe("corp-1");
    });
  });
});
