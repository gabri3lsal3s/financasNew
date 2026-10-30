import { describe, expect, it } from "vitest";
import { TOUR_TRACK_METAS } from "./tour-catalog";
import { getTourSteps, TOUR_STEPS } from "./tour-steps";
import type { TourTrackId } from "./types";

describe("tour-steps — Definição das Trilhas e Seletores Semânticos de Foco", () => {
  const allTrackIds: TourTrackId[] = [
    "finances",
    "investments",
    "finances_overview",
    "finances_wizard",
    "finances_cards",
    "finances_budgets",
    "finances_insights",
    "investments_overview",
    "investments_assets",
    "investments_targets",
    "investments_aporte",
    "settings_support",
    "app_native_apk",
  ];

  it("contém todas as 13 trilhas e micro-tours mapeados em TOUR_STEPS", () => {
    for (const trackId of allTrackIds) {
      expect(TOUR_STEPS[trackId]).toBeDefined();
      expect(Array.isArray(TOUR_STEPS[trackId])).toBe(true);
      expect(TOUR_STEPS[trackId].length).toBeGreaterThan(0);
    }
  });

  it("retorna array vazio quando passada uma trilha desconhecida", () => {
    // @ts-expect-error teste com valor inválido
    expect(getTourSteps("unknown")).toEqual([]);
  });

  it("sincroniza a quantidade de passos de cada trilha exatamente com TOUR_TRACK_METAS", () => {
    for (const trackId of allTrackIds) {
      const steps = getTourSteps(trackId);
      const meta = TOUR_TRACK_METAS[trackId];
      expect(steps).toHaveLength(meta.stepsCount);
    }
  });

  it("garante ordem sequencial estrita (1..N) e coerência do identificador de trilha para todas as trilhas", () => {
    for (const trackId of allTrackIds) {
      const steps = getTourSteps(trackId);
      steps.forEach((step, idx) => {
        expect(step.order).toBe(idx + 1);
        expect(step.track).toBe(trackId);
        expect(step.id.trim().length).toBeGreaterThan(0);
        expect(step.targetRoute).toMatch(/^\//);
        expect(step.targetSelector).toBeDefined();
        expect(step.targetSelector).toMatch(/^\[data-tour="[\w-]+"]$/);
        expect(step.title.trim().length).toBeGreaterThan(0);
        expect(step.description.trim().length).toBeGreaterThan(0);
      });
    }
  });

  it("garante ausência total de emojis e caracteres decorativos em todos os passos", () => {
    const emojiRegex = /\p{Extended_Pictographic}/u;

    for (const trackId of allTrackIds) {
      const steps = getTourSteps(trackId);
      for (const step of steps) {
        expect(emojiRegex.test(step.title)).toBe(false);
        expect(emojiRegex.test(step.description)).toBe(false);
        if (step.badgeLabel) {
          expect(emojiRegex.test(step.badgeLabel)).toBe(false);
        }
        if (step.actionLabel) {
          expect(emojiRegex.test(step.actionLabel)).toBe(false);
        }
      }
    }
  });

  describe("Micro-Tour Wizard (+) (finances_wizard)", () => {
    const steps = getTourSteps("finances_wizard");

    it("possui 3 passos mapeando o botão +, o fluxo de lançamentos e o parcelamento", () => {
      expect(steps).toHaveLength(3);

      // Passo 1: Botão + na barra inferior
      expect(steps[0]?.targetSelector).toBe('[data-tour="bottom-nav-wizard"]');
      expect(steps[0]?.targetRoute).toBe("/");
      expect(steps[0]?.preferredPlacement).toBe("top");

      // Passo 2: Modal / Feed de lançamentos
      expect(steps[1]?.targetSelector).toBe('[data-tour="transactions-feed-card"]');
      expect(steps[1]?.targetRoute).toBe("/transacoes");

      // Passo 3: Parcelamento inteligente de despesas
      expect(steps[2]?.targetSelector).toBe('[data-tour="cards-content"]');
      expect(steps[2]?.targetRoute).toBe("/cartoes");
    });
  });

  describe("Micro-Tour Insights & Relatórios (finances_insights)", () => {
    const steps = getTourSteps("finances_insights");

    it("possui 3 passos mapeando Smart Advisor, Radar de Recorrências e Fechamento Mensal", () => {
      expect(steps).toHaveLength(3);

      // Passo 1: Smart Advisor / Alertas de Ritmo na Home
      expect(steps[0]?.targetSelector).toBe('[data-tour="overview-kpis"]');
      expect(steps[0]?.targetRoute).toBe("/");

      // Passo 2: Radar de Assinaturas na tela de Cartões
      expect(steps[1]?.targetSelector).toBe('[data-tour="cards-content"]');
      expect(steps[1]?.targetRoute).toBe("/cartoes");

      // Passo 3: Fechamento mensal em Relatórios
      expect(steps[2]?.targetSelector).toBe('[data-tour="reports-content"]');
      expect(steps[2]?.targetRoute).toBe("/relatorios");
    });
  });

  describe("Micro-Tour Ativos de Investimento (investments_assets)", () => {
    const steps = getTourSteps("investments_assets");

    it("possui 2 passos mapeando Nova Operação e Saldo em Caixa", () => {
      expect(steps).toHaveLength(2);

      // Passo 1: Botão + Nova Operação em Investimentos
      expect(steps[0]?.targetSelector).toBe('[data-tour="investments-new-op"]');
      expect(steps[0]?.targetRoute).toBe("/investments");

      // Passo 2: Saldo em Caixa de corretora
      expect(steps[1]?.targetSelector).toBe('[data-tour="investments-summary"]');
      expect(steps[1]?.targetRoute).toBe("/investments");
    });
  });

  describe("Micro-Tour Personalização & Suporte (settings_support)", () => {
    const steps = getTourSteps("settings_support");

    it("possui 2 passos mapeando Modo Privacidade/Tema e Canal de Suporte", () => {
      expect(steps).toHaveLength(2);

      // Passo 1: Botões de Privacidade e Tema no Header
      expect(steps[0]?.targetSelector).toBe('[data-tour="header-privacy-theme"]');
      expect(steps[0]?.targetRoute).toBe("/");

      // Passo 2: Canal direto de suporte no menu /configuracoes
      expect(steps[1]?.targetSelector).toBe('[data-tour="overview-kpis"]');
      expect(steps[1]?.targetRoute).toBe("/configuracoes");
    });
  });

  describe("Tour Exclusivo do APK Nativo Android (app_native_apk)", () => {
    const steps = getTourSteps("app_native_apk");

    it("possui 3 passos mapeando Desempenho Nativo, Notificações Bancárias e Escudo Biométrico", () => {
      expect(steps).toHaveLength(3);

      // Passo 1: Interface nativa e desempenho acelerado
      expect(steps[0]?.targetSelector).toBe('[data-tour="overview-kpis"]');
      expect(steps[0]?.targetRoute).toBe("/");

      // Passo 2: Leitor de Notificações Bancárias em tempo real
      expect(steps[1]?.targetSelector).toBe('[data-tour="transactions-feed-card"]');
      expect(steps[1]?.targetRoute).toBe("/transacoes");

      // Passo 3: Bloqueio por Biometria e Escudo de Privacidade
      expect(steps[2]?.targetSelector).toBe('[data-tour="header-privacy-theme"]');
      expect(steps[2]?.targetRoute).toBe("/");
    });
  });

  describe("Trilhas consolidadas originais (finances e investments)", () => {
    it("preserva a trilha finances com 4 passos", () => {
      const steps = getTourSteps("finances");
      expect(steps).toHaveLength(4);
      expect(steps[0]?.targetSelector).toBe('[data-tour="overview-kpis"]');
      expect(steps[1]?.targetSelector).toBe('[data-tour="transactions-feed-card"]');
      expect(steps[2]?.targetSelector).toBe('[data-tour="cards-content"]');
      expect(steps[3]?.targetSelector).toBe('[data-tour="budgets-content"]');
    });

    it("preserva a trilha investments com 3 passos", () => {
      const steps = getTourSteps("investments");
      expect(steps).toHaveLength(3);
      expect(steps[0]?.targetSelector).toBe('[data-tour="investments-summary"]');
      expect(steps[1]?.targetSelector).toBe('[data-tour="investments-targets"]');
      expect(steps[2]?.targetSelector).toBe('[data-tour="investments-rebalance"]');
      expect(steps[0]?.targetRoute).toBe("/investments");
      expect(steps[1]?.targetRoute).toBe("/investments?tab=metas");
      expect(steps[2]?.targetRoute).toBe("/investments?tab=aporte");
    });
  });
});
