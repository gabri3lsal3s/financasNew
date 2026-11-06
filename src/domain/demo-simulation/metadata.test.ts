import { describe, expect, it } from "vitest";
import type { AnyTourTrackId, SharedTourTrackId, TourTrackCategory, TourTrackId } from "./types";
import {
  TOUR_CATEGORY_DESCRIPTIONS,
  TOUR_CATEGORY_LABELS,
  TOUR_TRACK_CATEGORY_LABELS,
  TOUR_TRACK_CONTEXTUAL_LABELS,
  TOUR_TRACK_DESCRIPTIONS,
  TOUR_TRACK_SHORT_TITLES,
  TOUR_TRACK_TITLES,
  getTourCategoryDescription,
  getTourTrackCategory,
  getTourTrackCategoryLabel,
  getTourTrackContextualLabel,
  getTourTrackDescription,
  getTourTrackShortTitle,
  getTourTrackTitle,
} from "./metadata";

describe("Metadata de Demonstração e Taxonomia de Trilhas (metadata.ts)", () => {
  describe("Constantes de Rótulos Semânticos", () => {
    it("possui rótulos de macro-categoria coerentes", () => {
      expect(TOUR_CATEGORY_LABELS.finances).toBe("Finanças Diárias");
      expect(TOUR_CATEGORY_LABELS.investments).toBe("Investimentos");
      expect(TOUR_CATEGORY_LABELS.settings).toBe("Configurações");
      expect(TOUR_CATEGORY_LABELS.native).toBe("App Nativo");
      expect(TOUR_CATEGORY_LABELS.shared).toBe("Compartilhadas");
    });

    it("mapeia todas as trilhas conhecidas para uma categoria válida", () => {
      const allTracks: (TourTrackId | SharedTourTrackId)[] = [
        "finances",
        "finances_overview",
        "finances_wizard",
        "finances_cards",
        "finances_budgets",
        "finances_insights",
        "investments",
        "investments_overview",
        "investments_assets",
        "investments_targets",
        "investments_aporte",
        "settings_support",
        "app_native_apk",
        "shared_finances",
        "finances_split",
        "finances_family",
        "finances_goals",
      ];

      allTracks.forEach((trackId) => {
        expect(TOUR_TRACK_CATEGORY_LABELS[trackId]).toBeDefined();
        expect(typeof TOUR_TRACK_CATEGORY_LABELS[trackId]).toBe("string");
        expect(TOUR_TRACK_CONTEXTUAL_LABELS[trackId]).toBeDefined();
        expect(typeof TOUR_TRACK_CONTEXTUAL_LABELS[trackId]).toBe("string");
      });
    });

    it("possui descrições ricas em pt-BR para todas as macro-categorias", () => {
      const categories: TourTrackCategory[] = [
        "finances",
        "investments",
        "settings",
        "native",
        "shared",
      ];

      categories.forEach((cat) => {
        expect(TOUR_CATEGORY_DESCRIPTIONS[cat]).toBeDefined();
        expect(TOUR_CATEGORY_DESCRIPTIONS[cat].length).toBeGreaterThan(15);
      });
      expect(TOUR_CATEGORY_DESCRIPTIONS.shared).toContain("Racha de despesas");
    });

    it("possui títulos, títulos curtos e descrições para todas as trilhas canônicas e compartilhadas", () => {
      const allTracks: AnyTourTrackId[] = [
        "finances",
        "finances_overview",
        "finances_wizard",
        "finances_cards",
        "finances_budgets",
        "finances_insights",
        "investments",
        "investments_overview",
        "investments_assets",
        "investments_targets",
        "investments_aporte",
        "settings_support",
        "app_native_apk",
        "shared_finances",
        "finances_split",
        "finances_family",
        "finances_goals",
      ];

      allTracks.forEach((trackId) => {
        expect(TOUR_TRACK_TITLES[trackId]).toBeDefined();
        expect(TOUR_TRACK_SHORT_TITLES[trackId]).toBeDefined();
        expect(TOUR_TRACK_DESCRIPTIONS[trackId]).toBeDefined();
        expect(TOUR_TRACK_DESCRIPTIONS[trackId].length).toBeGreaterThan(20);
      });

      expect(TOUR_TRACK_TITLES.shared_finances).toBe("Finanças Compartilhadas & Modo Família");
      expect(TOUR_TRACK_SHORT_TITLES.shared_finances).toBe("Compartilhadas Completo");
      expect(TOUR_TRACK_TITLES.finances_split).toBe("Racha de Despesas com Pix");
      expect(TOUR_TRACK_SHORT_TITLES.finances_split).toBe("Racha com Pix");
      expect(TOUR_TRACK_TITLES.finances_family).toBe("Modo Família Multi-Contas");
      expect(TOUR_TRACK_SHORT_TITLES.finances_family).toBe("Modo Família");
      expect(TOUR_TRACK_TITLES.finances_goals).toBe("Metas Coletivas & Vaquinha Pix");
      expect(TOUR_TRACK_SHORT_TITLES.finances_goals).toBe("Metas Coletivas");
    });
  });

  describe("getTourTrackCategoryLabel", () => {
    it("retorna 'Finanças Diárias' para a trilha consolidada de finanças", () => {
      expect(getTourTrackCategoryLabel("finances")).toBe("Finanças Diárias");
    });

    it("retorna 'Finanças Diárias' para TODOS os micro-tours de finanças pessoais (cartões, orçamentos, wizard, overview, insights)", () => {
      expect(getTourTrackCategoryLabel("finances_cards")).toBe("Finanças Diárias");
      expect(getTourTrackCategoryLabel("finances_budgets")).toBe("Finanças Diárias");
      expect(getTourTrackCategoryLabel("finances_wizard")).toBe("Finanças Diárias");
      expect(getTourTrackCategoryLabel("finances_overview")).toBe("Finanças Diárias");
      expect(getTourTrackCategoryLabel("finances_insights")).toBe("Finanças Diárias");
    });

    it("retorna 'Investimentos' para a trilha consolidada e micro-tours de investimentos", () => {
      expect(getTourTrackCategoryLabel("investments")).toBe("Investimentos");
      expect(getTourTrackCategoryLabel("investments_overview")).toBe("Investimentos");
      expect(getTourTrackCategoryLabel("investments_assets")).toBe("Investimentos");
      expect(getTourTrackCategoryLabel("investments_targets")).toBe("Investimentos");
      expect(getTourTrackCategoryLabel("investments_aporte")).toBe("Investimentos");
    });

    it("retorna 'Configurações' para a trilha de ajustes e suporte", () => {
      expect(getTourTrackCategoryLabel("settings_support")).toBe("Configurações");
    });

    it("retorna 'App Nativo' para o tour de recursos do APK Android", () => {
      expect(getTourTrackCategoryLabel("app_native_apk")).toBe("App Nativo");
    });

    it("aplica fallback seguro para valores nulos, vazios ou indefinidos", () => {
      expect(getTourTrackCategoryLabel(null)).toBe("Finanças Diárias");
      expect(getTourTrackCategoryLabel(undefined)).toBe("Finanças Diárias");
      expect(getTourTrackCategoryLabel("")).toBe("Finanças Diárias");
    });

    it("aplica inferência por prefixo para identificadores dinâmicos desconhecidos", () => {
      expect(getTourTrackCategoryLabel("investments_future_crypto" as TourTrackId)).toBe("Investimentos");
      expect(getTourTrackCategoryLabel("settings_advanced" as TourTrackId)).toBe("Configurações");
      expect(getTourTrackCategoryLabel("app_native_biometry" as TourTrackId)).toBe("App Nativo");
      expect(getTourTrackCategoryLabel("unknown_arbitrary_track" as TourTrackId)).toBe("Finanças Diárias");
    });

    it("retorna subtítulo contextual quando options.contextual é true", () => {
      expect(getTourTrackCategoryLabel("finances_cards", { contextual: true })).toBe("Finanças · Cartões");
      expect(getTourTrackCategoryLabel("finances_budgets", { contextual: true })).toBe("Finanças · Orçamentos");
      expect(getTourTrackCategoryLabel("finances_wizard", { contextual: true })).toBe("Finanças · Lançamentos");
      expect(getTourTrackCategoryLabel("finances_insights", { contextual: true })).toBe("Finanças · Insights");
      expect(getTourTrackCategoryLabel("investments_aporte", { contextual: true })).toBe("Investimentos · Aporte");
      expect(getTourTrackCategoryLabel("investments_assets", { contextual: true })).toBe("Investimentos · Ativos");
      expect(getTourTrackCategoryLabel("investments_targets", { contextual: true })).toBe("Investimentos · Metas");
      expect(getTourTrackCategoryLabel("settings_support", { contextual: true })).toBe("Configurações");
      expect(getTourTrackCategoryLabel("app_native_apk", { contextual: true })).toBe("App Nativo");
      expect(getTourTrackCategoryLabel("finances_split", { contextual: true })).toBe("Compartilhadas · Racha com Pix");
      expect(getTourTrackCategoryLabel("finances_family", { contextual: true })).toBe("Compartilhadas · Modo Família");
      expect(getTourTrackCategoryLabel("finances_goals", { contextual: true })).toBe("Compartilhadas · Metas Coletivas");
      expect(getTourTrackCategoryLabel("shared_finances", { contextual: true })).toBe("Compartilhadas");
    });
  });

  describe("getTourTrackContextualLabel", () => {
    it("retorna rótulo contextual específico via helper dedicado", () => {
      expect(getTourTrackContextualLabel("finances_cards")).toBe("Finanças · Cartões");
      expect(getTourTrackContextualLabel("investments_assets")).toBe("Investimentos · Ativos");
      expect(getTourTrackContextualLabel("settings_support")).toBe("Configurações");
      expect(getTourTrackContextualLabel("finances_split")).toBe("Compartilhadas · Racha com Pix");
      expect(getTourTrackContextualLabel("finances_family")).toBe("Compartilhadas · Modo Família");
      expect(getTourTrackContextualLabel("finances_goals")).toBe("Compartilhadas · Metas Coletivas");
    });
  });

  describe("getTourCategoryDescription", () => {
    it("retorna descrição amigável de cada macro-categoria", () => {
      expect(getTourCategoryDescription("finances")).toContain("Gestão de despesas");
      expect(getTourCategoryDescription("investments")).toContain("Distribuição patrimonial");
      expect(getTourCategoryDescription("shared")).toContain("Racha de despesas com Pix");
      expect(getTourCategoryDescription("native")).toContain("smartphones");
      expect(getTourCategoryDescription("settings")).toContain("privacidade");
    });

    it("retorna fallback para valores nulos ou desconhecidos", () => {
      expect(getTourCategoryDescription(null)).toBe(TOUR_CATEGORY_DESCRIPTIONS.finances);
      expect(getTourCategoryDescription("desconhecido")).toBe(TOUR_CATEGORY_DESCRIPTIONS.finances);
    });
  });

  describe("getTourTrackDescription", () => {
    it("retorna descrições amigáveis em pt-BR de cada trilha e micro-tour", () => {
      expect(getTourTrackDescription("finances")).toContain("Jornada sequencial completa");
      expect(getTourTrackDescription("finances_split")).toContain("Divisão inteligente de contas e eventos");
      expect(getTourTrackDescription("finances_family")).toContain("Gestão orçamentária para casais");
      expect(getTourTrackDescription("finances_goals")).toContain("Vaquinha colaborativa");
      expect(getTourTrackDescription("shared_finances")).toContain("Jornada completa de finanças colaborativas");
    });

    it("retorna fallback seguro para valores nulos ou desconhecidos", () => {
      expect(getTourTrackDescription(null)).toBe(TOUR_TRACK_DESCRIPTIONS.finances);
      expect(getTourTrackDescription("desconhecido")).toBe(TOUR_TRACK_DESCRIPTIONS.finances);
    });
  });

  describe("getTourTrackTitle e getTourTrackShortTitle", () => {
    it("retorna títulos canônicos corretos", () => {
      expect(getTourTrackTitle("finances_split")).toBe("Racha de Despesas com Pix");
      expect(getTourTrackTitle("finances_family")).toBe("Modo Família Multi-Contas");
      expect(getTourTrackTitle("finances_goals")).toBe("Metas Coletivas & Vaquinha Pix");
      expect(getTourTrackTitle("shared_finances")).toBe("Finanças Compartilhadas & Modo Família");
      expect(getTourTrackTitle(null)).toBe(TOUR_TRACK_TITLES.finances);
    });

    it("retorna títulos curtos corretos para cards e badges", () => {
      expect(getTourTrackShortTitle("finances_split")).toBe("Racha com Pix");
      expect(getTourTrackShortTitle("finances_family")).toBe("Modo Família");
      expect(getTourTrackShortTitle("finances_goals")).toBe("Metas Coletivas");
      expect(getTourTrackShortTitle("shared_finances")).toBe("Compartilhadas Completo");
      expect(getTourTrackShortTitle(null)).toBe(TOUR_TRACK_SHORT_TITLES.finances);
    });
  });

  describe("getTourTrackCategory", () => {
    it("identifica corretamente a categoria do enum TourTrackCategory", () => {
      expect(getTourTrackCategory("finances")).toBe("finances");
      expect(getTourTrackCategory("finances_cards")).toBe("finances");
      expect(getTourTrackCategory("investments_aporte")).toBe("investments");
      expect(getTourTrackCategory("settings_support")).toBe("settings");
      expect(getTourTrackCategory("app_native_apk")).toBe("native");
      expect(getTourTrackCategory("shared_finances")).toBe("shared");
      expect(getTourTrackCategory("finances_split")).toBe("shared");
      expect(getTourTrackCategory("finances_family")).toBe("shared");
      expect(getTourTrackCategory("finances_goals")).toBe("shared");
      expect(getTourTrackCategory(null)).toBe("finances");
    });
  });

  describe("Validação de Precisão de Badges em 100% dos Micro-Tours (Fase 8 — Tarefa 8.11)", () => {
    it("assegura que micro-tours e trilhas de finanças compartilhadas exibem 'Compartilhadas'", () => {
      const sharedTracks: SharedTourTrackId[] = [
        "shared_finances",
        "finances_split",
        "finances_family",
        "finances_goals",
      ];

      for (const trackId of sharedTracks) {
        expect(getTourTrackCategory(trackId)).toBe("shared");
        expect(getTourTrackCategoryLabel(trackId)).toBe("Compartilhadas");
      }
    });

    it("assegura que 100% dos micro-tours de finanças exibem 'Finanças Diárias' e nunca 'Investimentos'", () => {
      const financeTracks: TourTrackId[] = [
        "finances",
        "finances_overview",
        "finances_wizard",
        "finances_cards",
        "finances_budgets",
        "finances_insights",
      ];

      for (const trackId of financeTracks) {
        const label = getTourTrackCategoryLabel(trackId);
        expect(label).toBe("Finanças Diárias");
        expect(label).not.toContain("Investimentos");
      }
    });

    it("assegura que 100% dos micro-tours de investimentos exibem 'Investimentos'", () => {
      const investmentTracks: TourTrackId[] = [
        "investments",
        "investments_overview",
        "investments_assets",
        "investments_targets",
        "investments_aporte",
      ];

      for (const trackId of investmentTracks) {
        const label = getTourTrackCategoryLabel(trackId);
        expect(label).toBe("Investimentos");
      }
    });

    it("assegura precisão exata nos badges de configurações e app nativo", () => {
      expect(getTourTrackCategoryLabel("settings_support")).toBe("Configurações");
      expect(getTourTrackCategoryLabel("app_native_apk")).toBe("App Nativo");
    });
  });
});
