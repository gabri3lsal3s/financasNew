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

      // Passo 2: Modal LaunchWizard com foco no diálogo de lançamento
      expect(steps[1]?.targetSelector).toBe('[data-tour="launch-wizard-dialog"]');
      expect(steps[1]?.targetRoute).toBe("/transacoes?novo=despesa");

      // Passo 3: Parcelamento inteligente de despesas
      expect(steps[2]?.targetSelector).toBe('[data-tour="cards-installments-section"]');
      expect(steps[2]?.targetRoute).toBe("/cartoes");
    });
  });

  describe("Micro-Tour Cartões, Faturas e Limites (finances_cards)", () => {
    const steps = getTourSteps("finances_cards");

    it("possui 3 passos mapeando Fatura Aberta/Limite, Melhor Dia e Comprometimento Futuro", () => {
      expect(steps).toHaveLength(3);

      // Passo 1: Fatura Aberta & Limite Disponível
      expect(steps[0]?.targetSelector).toBe('[data-tour="cards-content"]');
      expect(steps[0]?.targetRoute).toBe("/cartoes");

      // Passo 2: Melhor Dia de Compra
      expect(steps[1]?.targetSelector).toBe('[data-tour="cards-content"]');
      expect(steps[1]?.targetRoute).toBe("/cartoes");

      // Passo 3: Comprometimento com Parcelas Futuras
      expect(steps[2]?.targetSelector).toBe('[data-tour="cards-installments-section"]');
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

      // Passo 2: Radar de Assinaturas ou Resumo da Fatura na tela de Cartões
      expect(steps[1]?.targetSelector).toBe('[data-tour="cards-invoice-summary"]');
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

  describe("Tour Personalização, Visual & Suporte (settings_support)", () => {
    const steps = getTourSteps("settings_support");

    it("possui 5 passos mapeando Atalhos de Cabeçalho, Presets de Experiência, Identidade Visual, Notificações e Canal de Suporte", () => {
      expect(steps).toHaveLength(5);

      // Passo 1: Atalhos Rápidos de Cabeçalho (Modo Privacidade e Tema)
      expect(steps[0]?.id).toBe("settings-privacy-theme");
      expect(steps[0]?.targetSelector).toBe('[data-tour="header-privacy-theme"]');
      expect(steps[0]?.targetRoute).toBe("/");
      expect(steps[0]?.badgeLabel).toBe("Passo 1 de 5");

      // Passo 2: Modos de Experiência & Sensorial
      expect(steps[1]?.id).toBe("settings-experience-presets");
      expect(steps[1]?.targetSelector).toBe('[data-tour="settings-experience-presets"]');
      expect(steps[1]?.targetRoute).toBe("/configuracoes?tab=appearance");
      expect(steps[1]?.badgeLabel).toBe("Passo 2 de 5");

      // Passo 3: Identidade Visual & Cores de Destaque
      expect(steps[2]?.id).toBe("settings-visual-identity");
      expect(steps[2]?.targetSelector).toBe('[data-tour="settings-visual-identity"]');
      expect(steps[2]?.targetRoute).toBe("/configuracoes?tab=appearance");
      expect(steps[2]?.badgeLabel).toBe("Passo 3 de 5");

      // Passo 4: Notificações, Lembretes & Assistente Bancário
      expect(steps[3]?.id).toBe("settings-notifications");
      expect(steps[3]?.targetSelector).toBe('[data-tour="settings-notifications-card"]');
      expect(steps[3]?.targetRoute).toBe("/configuracoes?tab=notifications");
      expect(steps[3]?.badgeLabel).toBe("Passo 4 de 5");

      // Passo 5: Central de Ajuda & Suporte Direto
      expect(steps[4]?.id).toBe("settings-support-channel");
      expect(steps[4]?.targetSelector).toBe('[data-tour="settings-support-card"]');
      expect(steps[4]?.targetRoute).toBe("/configuracoes");
      expect(steps[4]?.badgeLabel).toBe("Passo 5 de 5");
      expect(steps[4]?.actionLabel).toBe("Concluir");
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

  describe("Tours gerais consolidados e didáticos (finances e investments) — Fase 8.5", () => {
    it("estrutura a trilha finances com 8 passos integrados em sequência lógica e didática", () => {
      const steps = getTourSteps("finances");
      expect(steps).toHaveLength(8);

      // Passo 1: Dashboard & Saldo Livre Real
      expect(steps[0]?.id).toBe("finances-overview");
      expect(steps[0]?.targetSelector).toBe('[data-tour="overview-kpis"]');
      expect(steps[0]?.targetRoute).toBe("/");
      expect(steps[0]?.badgeLabel).toBe("Passo 1 de 8");

      // Passo 2: O Botão Wizard (+) e Atalhos
      expect(steps[1]?.id).toBe("finances-wizard-btn");
      expect(steps[1]?.targetSelector).toBe('[data-tour="bottom-nav-wizard"]');
      expect(steps[1]?.targetRoute).toBe("/");
      expect(steps[1]?.badgeLabel).toBe("Passo 2 de 8");

      // Passo 3: Modal de Lançamento Inteligente
      expect(steps[2]?.id).toBe("finances-wizard-dialog");
      expect(steps[2]?.targetSelector).toBe('[data-tour="launch-wizard-dialog"]');
      expect(steps[2]?.targetRoute).toBe("/transacoes?novo=despesa");
      expect(steps[2]?.badgeLabel).toBe("Passo 3 de 8");

      // Passo 4: Extrato Unificado & Filtros
      expect(steps[3]?.id).toBe("finances-transactions");
      expect(steps[3]?.targetSelector).toBe('[data-tour="transactions-feed-card"]');
      expect(steps[3]?.targetRoute).toBe("/transacoes");
      expect(steps[3]?.badgeLabel).toBe("Passo 4 de 8");

      // Passo 5: Cartões & Faturas Abertas
      expect(steps[4]?.id).toBe("finances-cards");
      expect(steps[4]?.targetSelector).toBe('[data-tour="cards-invoice-summary"]');
      expect(steps[4]?.targetRoute).toBe("/cartoes");
      expect(steps[4]?.badgeLabel).toBe("Passo 5 de 8");

      // Passo 6: Parcelamentos Fixos e Futuros
      expect(steps[5]?.id).toBe("finances-installments");
      expect(steps[5]?.targetSelector).toBe('[data-tour="cards-installments-section"]');
      expect(steps[5]?.targetRoute).toBe("/cartoes");
      expect(steps[5]?.badgeLabel).toBe("Passo 6 de 8");

      // Passo 7: Categorias & Tetos Mensais
      expect(steps[6]?.id).toBe("finances-budgets");
      expect(steps[6]?.targetSelector).toBe('[data-tour="budgets-content"]');
      expect(steps[6]?.targetRoute).toBe("/orcamentos");
      expect(steps[6]?.badgeLabel).toBe("Passo 7 de 8");

      // Passo 8: Smart Advisor & Relatórios
      expect(steps[7]?.id).toBe("finances-insights");
      expect(steps[7]?.targetSelector).toBe('[data-tour="reports-content"]');
      expect(steps[7]?.targetRoute).toBe("/relatorios");
      expect(steps[7]?.badgeLabel).toBe("Passo 8 de 8");
    });

    it("estrutura a trilha investments com 5 passos integrados de aprendizado patrimonial", () => {
      const steps = getTourSteps("investments");
      expect(steps).toHaveLength(5);

      // Passo 1: Visão Patrimonial Global
      expect(steps[0]?.id).toBe("investments-overview");
      expect(steps[0]?.targetSelector).toBe('[data-tour="investments-summary"]');
      expect(steps[0]?.targetRoute).toBe("/investments");
      expect(steps[0]?.badgeLabel).toBe("Passo 1 de 5");

      // Passo 2: Cadastro de Ativo (Nova Operação)
      expect(steps[1]?.id).toBe("investments-new-op");
      expect(steps[1]?.targetSelector).toBe('[data-tour="investments-new-op"]');
      expect(steps[1]?.targetRoute).toBe("/investments");
      expect(steps[1]?.badgeLabel).toBe("Passo 2 de 5");

      // Passo 3: Metas Estratégicas de Alocação
      expect(steps[2]?.id).toBe("investments-targets");
      expect(steps[2]?.targetSelector).toBe('[data-tour="investments-targets"]');
      expect(steps[2]?.targetRoute).toBe("/investments?tab=metas");
      expect(steps[2]?.badgeLabel).toBe("Passo 3 de 5");

      // Passo 4: Calculadora de Aporte Inteligente
      expect(steps[3]?.id).toBe("investments-rebalance");
      expect(steps[3]?.targetSelector).toBe('[data-tour="investments-rebalance"]');
      expect(steps[3]?.targetRoute).toBe("/investments?tab=aporte");
      expect(steps[3]?.badgeLabel).toBe("Passo 4 de 5");

      // Passo 5: Proventos & Renda Passiva
      expect(steps[4]?.id).toBe("investments-dividends");
      expect(steps[4]?.targetSelector).toBe('[data-tour="investments-dividends"]');
      expect(steps[4]?.targetRoute).toBe("/investments?tab=proventos");
      expect(steps[4]?.badgeLabel).toBe("Passo 5 de 5");
    });
  });
});
