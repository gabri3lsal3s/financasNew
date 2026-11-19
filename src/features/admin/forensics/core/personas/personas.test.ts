/**
 * Bateria de Testes do Portão Dois (Gate 2) — Fábrica de Personas Teóricas
 *
 * Valida que:
 * 1. Todas as 8 personas são geradas de forma estritamente determinística (reprodução idêntica).
 * 2. Tempo de instanciação de todas as personas somadas é inferior a 500ms em memória.
 * 3. Invariantes estruturais e contratos de cada persona são preservados.
 */

import { describe, it, expect } from "vitest";
import {
  ALL_PERSONAS,
  getAllPersonas,
  getPersonaById,
  getPersonaCatalog,
  personaInvestor6445,
  personaTemporalStress,
  personaCardsLoans,
  personaTripsSplit,
  personaFamilyBudget,
  personaBoundaryZero,
  personaInsightsStress,
  personaAdvancedModules,
} from "./index";
import { somaCents } from "@/domain/money/parcelar";

describe("Gate 2 — Fábrica de Personas Teóricas Determinísticas (Golden Seeds)", () => {
  it("deve registrar exatamente 8 personas no catálogo canônico com metadados válidos", () => {
    expect(ALL_PERSONAS).toHaveLength(8);
    expect(getAllPersonas()).toEqual(ALL_PERSONAS);
    const catalog = getPersonaCatalog();
    expect(catalog).toHaveLength(8);

    const ids = new Set(ALL_PERSONAS.map((p) => p.id));
    expect(ids.size).toBe(8);

    for (const item of ALL_PERSONAS) {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.targetModules.length).toBeGreaterThan(0);
      expect(getPersonaById(item.id)).toBe(item);
    }
  });

  it("deve instanciar todas as 8 personas em menos de 500ms em memória (Gate 2 Performance)", () => {
    const startTime = performance.now();

    // Executa 5 rodadas completas de instanciação para garantir estabilidade sob repetição
    for (let round = 0; round < 5; round++) {
      for (const persona of ALL_PERSONAS) {
        const state = persona.instantiate();
        expect(state).toBeDefined();
      }
    }

    const elapsedMs = performance.now() - startTime;
    // 5 rodadas de 8 personas = 40 instanciações devem rodar em bem menos de 500ms
    expect(elapsedMs).toBeLessThan(500);
  });

  it("deve garantir determinismo estrito (duas instanciações consecutivas são idênticas)", () => {
    for (const persona of ALL_PERSONAS) {
      const stateA = persona.instantiate();
      const stateB = persona.instantiate();

      expect(JSON.stringify(stateA)).toBe(JSON.stringify(stateB));
    }
  });

  describe("Persona 1: Investidor BR-20261118-6445", () => {
    it("deve reproduzir a carteira de 26 ativos, 6 ETFs em USD e R$ 1.794,47 em proventos", () => {
      const state = personaInvestor6445.instantiate();

      expect(state.caseId).toBe("BR-20261118-6445");
      expect(state.asOfDate).toBe("2026-11-18");
      expect(state.ptaxRate).toBe(5.25);
      expect(state.expected.totalPatrimonyBRL).toBe(17503.68);
      expect(state.expected.totalConsolidatedCostBRL).toBe(17320.9);
      expect(state.expected.totalDividendsBRL).toBe(1794.47);
      expect(state.expected.allTimeEconomicPnlBRL).toBe(1977.25);
      expect(state.expected.intlTotalBRL).toBe(6852.6);
      expect(state.expected.totalCompetenciesCount).toBe(26);

      // 6 ETFs internacionais em USD
      const usdEtfs = state.assets.filter((a) => a.currency === "USD");
      expect(usdEtfs).toHaveLength(6);
    });
  });

  describe("Persona 2: Estresse Temporal", () => {
    it("deve conter a espinha cronológica com mês em branco em agosto/2026 e resgate de 98%", () => {
      const state = personaTemporalStress.instantiate();

      expect(state.consecutiveMonths).toContain("2026-08");
      expect(state.blankMonth).toBe("2026-08");
      expect(state.intraMonthFlows).toHaveLength(3);

      const { denominatorCollapse } = state;
      expect(denominatorCollapse.initialEquityCents).toBe(10_000_000);
      expect(denominatorCollapse.largeRedemptionCents).toBe(9_800_000);
      expect(denominatorCollapse.largeRedemptionCents / denominatorCollapse.initialEquityCents).toBe(0.98);
    });
  });

  describe("Persona 3: Cartões, Parcelas & Empréstimos", () => {
    it("deve conservar rigorosamente os centavos em divisões com dízima periódica", () => {
      const state = personaCardsLoans.instantiate();

      for (const split of state.periodicSplits) {
        expect(split.expectedParts).toHaveLength(split.installmentsCount);
        expect(somaCents([...split.expectedParts])).toBe(split.totalCents);
      }
    });

    it("deve conter parâmetros válidos de corte de fatura e CDC art. 52", () => {
      const state = personaCardsLoans.instantiate();

      expect(state.closingDayTest.closingDay).toBe(20);
      expect(state.closingDayTest.expectedCompetenceBefore).toBe("2026-10");
      expect(state.closingDayTest.expectedCompetenceAfter).toBe("2026-11");
      expect(state.earlyAmortization.remainingInstallments).toHaveLength(12);
    });
  });

  describe("Persona 4: Modo Viagem & Racha de Despesas", () => {
    it("deve conter 4 participantes, despesas multimoeda e acerto parcial Pix", () => {
      const state = personaTripsSplit.instantiate();

      expect(state.participants).toHaveLength(4);
      expect(state.expenses).toHaveLength(4);
      expect(state.settlements).toHaveLength(1);
      expect(state.settlements[0]?.amountCents).toBe(20_000);

      const currencies = new Map(state.currencies.map((c) => [c.code, c.rateToBRL]));
      expect(currencies.get("BRL")).toBe(1.0);
      expect(currencies.get("EUR")).toBe(6.0);
    });
  });

  describe("Persona 5: Orçamento Familiar & Provisões", () => {
    it("deve validar rateio 60/40, metas 50/30/20 e provisões anuais 1/12", () => {
      const state = personaFamilyBudget.instantiate();

      const pA = state.partners[0];
      const pB = state.partners[1];
      expect(pA).toBeDefined();
      expect(pB).toBeDefined();

      if (pA && pB) {
        expect(pA.expectedShareRatio).toBe(0.6);
        expect(pB.expectedShareRatio).toBe(0.4);
        expect(pA.monthlyIncomeCents + pB.monthlyIncomeCents).toBe(state.rule50_30_20.totalIncomeCents);
      }

      const { targetNeedsCents, targetWantsCents, targetSavingsCents, totalIncomeCents } = state.rule50_30_20;
      expect(targetNeedsCents + targetWantsCents + targetSavingsCents).toBe(totalIncomeCents);

      const ipva = state.provisions.find((p) => p.id === "prov-ipva");
      expect(ipva).toBeDefined();
      if (ipva) {
        expect(ipva.annualTargetCents / 12).toBe(ipva.monthlyAccrualCents);
      }
    });
  });

  describe("Persona 6: Casos Limite & Divisão por Zero", () => {
    it("deve fornecer vetores para teste de NaN/Infinity, data bissexta e precisão cripto", () => {
      const state = personaBoundaryZero.instantiate();

      expect(state.zeroUser.totalEquityCents).toBe(0);
      expect(state.divisionByZeroCases.emptyReturnsSeries).toEqual([]);
      expect(state.divisionByZeroCases.zeroVarianceSeries.every((v) => v === 0.01)).toBe(true);

      expect(state.leapYearTimestamps.expectedYear).toBe(2028);
      expect(state.leapYearTimestamps.expectedDay).toBe(29);
      expect(state.cryptoPrecision.expectedTotalCents).toBe(666);
    });
  });

  describe("Persona 7: Insights & SmartAdvisor", () => {
    it("deve gerar 100 eventos simultâneos, radar de fatura >= 90% e cooldowns ativos", () => {
      const state = personaInsightsStress.instantiate();

      expect(state.totalSimulatedEvents).toBe(100);
      expect(state.events).toHaveLength(100);
      expect(state.cardLimitRadar.usagePercent).toBeGreaterThanOrEqual(90.0);
      expect(state.dismissalCooldowns["topic-advisor-0"]).toBeGreaterThan(state.nowMs);
    });
  });

  describe("Persona 8: Módulos Avançados & Auxiliares", () => {
    it("deve gerar código Pix com CRC-16 de 4 caracteres, runway de 6 meses e dívidas comparáveis", () => {
      const state = personaAdvancedModules.instantiate();

      expect(state.pixBrCode.expectedCrc).toHaveLength(4);
      expect(state.emergencyRunway.expectedMonthsCovered).toBe(6.0);
      expect(state.debtPayoffComparison).toHaveLength(3);
      expect(state.backupIntegrity.expectedSha256Hex).toHaveLength(64);
    });
  });
});
