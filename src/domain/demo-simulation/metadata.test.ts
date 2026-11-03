import { describe, expect, it } from "vitest";
import type { TourTrackId } from "./types";
import {
  TOUR_CATEGORY_LABELS,
  TOUR_TRACK_CATEGORY_LABELS,
  TOUR_TRACK_CONTEXTUAL_LABELS,
  getTourTrackCategory,
  getTourTrackCategoryLabel,
  getTourTrackContextualLabel,
} from "./metadata";

describe("Metadata de Demonstração e Taxonomia de Trilhas (metadata.ts)", () => {
  describe("Constantes de Rótulos Semânticos", () => {
    it("possui rótulos de macro-categoria coerentes", () => {
      expect(TOUR_CATEGORY_LABELS.finances).toBe("Finanças Diárias");
      expect(TOUR_CATEGORY_LABELS.investments).toBe("Investimentos");
      expect(TOUR_CATEGORY_LABELS.settings).toBe("Configurações");
      expect(TOUR_CATEGORY_LABELS.native).toBe("App Nativo");
    });

    it("mapeia todas as trilhas conhecidas para uma categoria válida", () => {
      const allTracks: TourTrackId[] = [
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
      ];

      allTracks.forEach((trackId) => {
        expect(TOUR_TRACK_CATEGORY_LABELS[trackId]).toBeDefined();
        expect(typeof TOUR_TRACK_CATEGORY_LABELS[trackId]).toBe("string");
        expect(TOUR_TRACK_CONTEXTUAL_LABELS[trackId]).toBeDefined();
        expect(typeof TOUR_TRACK_CONTEXTUAL_LABELS[trackId]).toBe("string");
      });
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
    });
  });

  describe("getTourTrackContextualLabel", () => {
    it("retorna rótulo contextual específico via helper dedicado", () => {
      expect(getTourTrackContextualLabel("finances_cards")).toBe("Finanças · Cartões");
      expect(getTourTrackContextualLabel("investments_assets")).toBe("Investimentos · Ativos");
      expect(getTourTrackContextualLabel("settings_support")).toBe("Configurações");
    });
  });

  describe("getTourTrackCategory", () => {
    it("identifica corretamente a categoria do enum TourTrackCategory", () => {
      expect(getTourTrackCategory("finances")).toBe("finances");
      expect(getTourTrackCategory("finances_cards")).toBe("finances");
      expect(getTourTrackCategory("investments_aporte")).toBe("investments");
      expect(getTourTrackCategory("settings_support")).toBe("settings");
      expect(getTourTrackCategory("app_native_apk")).toBe("native");
      expect(getTourTrackCategory(null)).toBe("finances");
    });
  });

  describe("Validação de Precisão de Badges em 100% dos Micro-Tours (Fase 8 — Tarefa 8.11)", () => {
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
