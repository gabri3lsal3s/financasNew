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
    "finances_split",
    "finances_family",
    "finances_goals",
    "shared_finances",
    "investments_overview",
    "investments_assets",
    "investments_targets",
    "investments_aporte",
    "settings_support",
    "app_native_apk",
  ];

  it("contém todas as 17 trilhas e micro-tours mapeados em TOUR_STEPS", () => {
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

      // Passo 2: Radar de Assinaturas e Recorrências na tela de Insights
      expect(steps[1]?.targetSelector).toBe('[data-tour="insights-recurrences-content"]');
      expect(steps[1]?.targetRoute).toBe("/insights?aba=recurrences");

      // Passo 3: Fechamento mensal em Relatórios
      expect(steps[2]?.targetSelector).toBe('[data-tour="reports-content"]');
      expect(steps[2]?.targetRoute).toBe("/relatorios");
    });
  });

  describe("Micro-Tour Racha de Despesas com Pix (finances_split)", () => {
    const steps = getTourSteps("finances_split");

    it("possui 2 passos mapeando o Wizard Toggle e Cobrança Pix", () => {
      expect(steps).toHaveLength(2);

      // Passo 1: Toggle de Racha no Wizard
      expect(steps[0]?.targetSelector).toBe('[data-tour="wizard-split-toggle"]');
      expect(steps[0]?.targetRoute).toBe("/transacoes?novo=despesa");
      expect(steps[0]?.preferredPlacement).toBe("top");

      // Passo 2: Extrato com Card de Sinalizações Pendentes Pix
      expect(steps[1]?.targetSelector).toBe('[data-tour="split-pending-card"]');
      expect(steps[1]?.targetRoute).toBe("/");
      expect(steps[1]?.preferredPlacement).toBe("bottom");
    });
  });

  describe("Micro-Tour Modo Família Multi-Contas (finances_family)", () => {
    const steps = getTourSteps("finances_family");

    it("possui 2 passos mapeando Teto Compartilhado e Equilíbrio de Contas", () => {
      expect(steps).toHaveLength(2);

      // Passo 1: Card de Teto Orçamentário da Casa
      expect(steps[0]?.targetSelector).toBe('[data-tour="family-ceiling-card"]');
      expect(steps[0]?.targetRoute).toBe("/familia");
      expect(steps[0]?.preferredPlacement).toBe("bottom");

      // Passo 2: Card de Equilíbrio das Contas do Mês
      expect(steps[1]?.targetSelector).toBe('[data-tour="family-balance-card"]');
      expect(steps[1]?.targetRoute).toBe("/familia");
      expect(steps[1]?.preferredPlacement).toBe("bottom");
    });
  });

  describe("Micro-Tour Metas Coletivas & Vaquinha Pix (finances_goals)", () => {
    const steps = getTourSteps("finances_goals");

    it("possui 2 passos mapeando Banner de Metas Coletivas e Termômetro", () => {
      expect(steps).toHaveLength(2);

      // Passo 1: Banner de Nova Meta Coletiva
      expect(steps[0]?.targetSelector).toBe('[data-tour="shared-goals-banner"]');
      expect(steps[0]?.targetRoute).toBe("/orcamentos?tab=goals");
      expect(steps[0]?.preferredPlacement).toBe("bottom");

      // Passo 2: Card de Termômetro de Arrecadação
      expect(steps[1]?.targetSelector).toBe('[data-tour="shared-goals-card"]');
      expect(steps[1]?.targetRoute).toBe("/orcamentos?tab=goals");
      expect(steps[1]?.preferredPlacement).toBe("top");
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

    it("possui 4 passos mapeando Tripé de Plataformas, Atualizador, Notificações Bancárias e Escudo Biométrico", () => {
      expect(steps).toHaveLength(4);

      // Passo 1: O Tripé de Plataformas
      expect(steps[0]?.targetSelector).toBe('[data-tour="settings-platforms-triptych"]');
      expect(steps[0]?.targetRoute).toBe("/configuracoes?tab=devices");

      // Passo 2: Atualizador Integrado do APK
      expect(steps[1]?.targetSelector).toBe('[data-tour="settings-platform-status"]');
      expect(steps[1]?.targetRoute).toBe("/configuracoes?tab=devices");

      // Passo 3: Leitor de Notificações Bancárias em tempo real
      expect(steps[2]?.targetSelector).toBe('[data-tour="settings-banking-assistant"]');
      expect(steps[2]?.targetRoute).toBe("/configuracoes?tab=notifications");

      // Passo 4: Bloqueio por Biometria e Escudo de Privacidade
      expect(steps[3]?.targetSelector).toBe('[data-tour="settings-app-lock"]');
      expect(steps[3]?.targetRoute).toBe("/configuracoes?tab=security");
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

  describe("Adaptação Responsiva Desktop vs Mobile (Fase 8 — Tarefa 8.8)", () => {
    it("configura propriedades adaptativas em finances_wizard (passo 1) para ausência de FAB no desktop", () => {
      const steps = getTourSteps("finances_wizard");
      const step1 = steps[0];

      expect(step1).toBeDefined();
      expect(step1?.targetSelector).toBe('[data-tour="bottom-nav-wizard"]');
      expect(step1?.targetSelectorDesktop).toBe('[data-tour="desktop-new-transaction"]');
      expect(step1?.titleDesktop).toBe("Comandos Rápidos & Atalho (Ctrl+K)");
      expect(step1?.contentDesktop).toContain("Ctrl+K");
    });

    it("configura propriedades adaptativas na trilha finances (passo 2) para ausência de FAB no desktop", () => {
      const steps = getTourSteps("finances");
      const step2 = steps[1];

      expect(step2).toBeDefined();
      expect(step2?.id).toBe("finances-wizard-btn");
      expect(step2?.targetSelector).toBe('[data-tour="bottom-nav-wizard"]');
      expect(step2?.targetSelectorDesktop).toBe('[data-tour="desktop-new-transaction"]');
      expect(step2?.titleDesktop).toBe("Comandos Rápidos & Atalho (Ctrl+K)");
      expect(step2?.contentDesktop).toContain("Ctrl+K");
    });
  });

  describe("Testar Encadeamento dos Passos dos Novos Tours Gerais (Fase 8 — Tarefa 8.11)", () => {
    it("encadeia com precisão a sequência lógica do Tour Geral de Finanças Diárias (8 passos)", () => {
      const steps = getTourSteps("finances");
      expect(steps).toHaveLength(8);

      const expectedSequence = [
        { order: 1, id: "finances-overview", route: "/", selector: '[data-tour="overview-kpis"]', badge: "Passo 1 de 8" },
        { order: 2, id: "finances-wizard-btn", route: "/", selector: '[data-tour="bottom-nav-wizard"]', badge: "Passo 2 de 8" },
        { order: 3, id: "finances-wizard-dialog", route: "/transacoes?novo=despesa", selector: '[data-tour="launch-wizard-dialog"]', badge: "Passo 3 de 8" },
        { order: 4, id: "finances-transactions", route: "/transacoes", selector: '[data-tour="transactions-feed-card"]', badge: "Passo 4 de 8" },
        { order: 5, id: "finances-cards", route: "/cartoes", selector: '[data-tour="cards-invoice-summary"]', badge: "Passo 5 de 8" },
        { order: 6, id: "finances-installments", route: "/cartoes", selector: '[data-tour="cards-installments-section"]', badge: "Passo 6 de 8" },
        { order: 7, id: "finances-budgets", route: "/orcamentos", selector: '[data-tour="budgets-content"]', badge: "Passo 7 de 8" },
        { order: 8, id: "finances-insights", route: "/relatorios", selector: '[data-tour="reports-content"]', badge: "Passo 8 de 8" },
      ];

      expectedSequence.forEach((expected, idx) => {
        const step = steps[idx];
        expect(step?.order).toBe(expected.order);
        expect(step?.id).toBe(expected.id);
        expect(step?.targetRoute).toBe(expected.route);
        expect(step?.targetSelector).toBe(expected.selector);
        expect(step?.badgeLabel).toBe(expected.badge);
        expect(step?.title.length).toBeGreaterThan(0);
        expect(step?.description.length).toBeGreaterThan(0);
      });

      // Valida unicidade de IDs na trilha
      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(8);
    });

    it("encadeia com precisão a sequência lógica do Tour Geral de Investimentos (5 passos)", () => {
      const steps = getTourSteps("investments");
      expect(steps).toHaveLength(5);

      const expectedSequence = [
        { order: 1, id: "investments-overview", route: "/investments", selector: '[data-tour="investments-summary"]', badge: "Passo 1 de 5" },
        { order: 2, id: "investments-new-op", route: "/investments", selector: '[data-tour="investments-new-op"]', badge: "Passo 2 de 5" },
        { order: 3, id: "investments-targets", route: "/investments?tab=metas", selector: '[data-tour="investments-targets"]', badge: "Passo 3 de 5" },
        { order: 4, id: "investments-rebalance", route: "/investments?tab=aporte", selector: '[data-tour="investments-rebalance"]', badge: "Passo 4 de 5" },
        { order: 5, id: "investments-dividends", route: "/investments?tab=proventos", selector: '[data-tour="investments-dividends"]', badge: "Passo 5 de 5" },
      ];

      expectedSequence.forEach((expected, idx) => {
        const step = steps[idx];
        expect(step?.order).toBe(expected.order);
        expect(step?.id).toBe(expected.id);
        expect(step?.targetRoute).toBe(expected.route);
        expect(step?.targetSelector).toBe(expected.selector);
        expect(step?.badgeLabel).toBe(expected.badge);
      });

      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(5);
    });

    it("encadeia com precisão a sequência lógica do Tour Geral de Configurações, Visual e Suporte (5 passos)", () => {
      const steps = getTourSteps("settings_support");
      expect(steps).toHaveLength(5);

      const expectedSequence = [
        { order: 1, id: "settings-privacy-theme", route: "/", selector: '[data-tour="header-privacy-theme"]', badge: "Passo 1 de 5" },
        { order: 2, id: "settings-experience-presets", route: "/configuracoes?tab=appearance", selector: '[data-tour="settings-experience-presets"]', badge: "Passo 2 de 5" },
        { order: 3, id: "settings-visual-identity", route: "/configuracoes?tab=appearance", selector: '[data-tour="settings-visual-identity"]', badge: "Passo 3 de 5" },
        { order: 4, id: "settings-notifications", route: "/configuracoes?tab=notifications", selector: '[data-tour="settings-notifications-card"]', badge: "Passo 4 de 5" },
        { order: 5, id: "settings-support-channel", route: "/configuracoes", selector: '[data-tour="settings-support-card"]', badge: "Passo 5 de 5" },
      ];

      expectedSequence.forEach((expected, idx) => {
        const step = steps[idx];
        expect(step?.order).toBe(expected.order);
        expect(step?.id).toBe(expected.id);
        expect(step?.targetRoute).toBe(expected.route);
        expect(step?.targetSelector).toBe(expected.selector);
        expect(step?.badgeLabel).toBe(expected.badge);
      });

      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(5);
    });

    it("encadeia com precisão a sequência lógica do Tour Geral de Finanças Compartilhadas (4 passos)", () => {
      const steps = getTourSteps("shared_finances");
      expect(steps).toHaveLength(4);

      const expectedSequence = [
        {
          order: 1,
          id: "shared-wizard-split-toggle",
          route: "/transacoes?novo=despesa",
          selector: '[data-tour="wizard-split-toggle"]',
          badge: "Passo 1 de 4",
        },
        {
          order: 2,
          id: "shared-split-pending-card",
          route: "/",
          selector: '[data-tour="split-pending-card"]',
          badge: "Passo 2 de 4",
        },
        {
          order: 3,
          id: "shared-family-hub",
          route: "/familia",
          selector: '[data-tour="family-ceiling-card"]',
          badge: "Passo 3 de 4",
        },
        {
          order: 4,
          id: "shared-goals-thermometer",
          route: "/orcamentos?tab=goals",
          selector: '[data-tour="shared-goals-card"]',
          badge: "Passo 4 de 4",
        },
      ];

      expectedSequence.forEach((expected, idx) => {
        const step = steps[idx];
        expect(step?.order).toBe(expected.order);
        expect(step?.id).toBe(expected.id);
        expect(step?.targetRoute).toBe(expected.route);
        expect(step?.targetSelector).toBe(expected.selector);
        expect(step?.badgeLabel).toBe(expected.badge);
        expect(step?.title.length).toBeGreaterThan(0);
        expect(step?.description.length).toBeGreaterThan(0);
      });

      const ids = steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(4);
    });

    it("assegura que todos os passos possuem rotas válidas e seletores data-tour formatados", () => {
      const generalTracks: TourTrackId[] = [
        "finances",
        "investments",
        "settings_support",
        "shared_finances",
      ];

      for (const trackId of generalTracks) {
        const steps = getTourSteps(trackId);
        for (const step of steps) {
          expect(step.targetRoute.startsWith("/")).toBe(true);
          expect(step.targetSelector).toBeDefined();
          expect(step.targetSelector?.startsWith('[data-tour="')).toBe(true);
          expect(step.targetSelector?.endsWith('"]')).toBe(true);
        }
      }
    });
  });
});
