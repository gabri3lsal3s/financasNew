import { describe, expect, it } from "vitest";
import {
  TOUR_TRACK_GROUPS,
  TOUR_TRACK_METAS,
  getTourTrackGroups,
  getTourTrackMeta,
  getTourTracksByCategory,
} from "./tour-catalog";
import type { AnyTourTrackId } from "./types";

describe("tour-catalog — Catálogo Canônico de Micro-Tours e Grupos", () => {
  const allTrackIds: AnyTourTrackId[] = [
    "app_native_apk",
    "finances_overview",
    "finances_wizard",
    "finances_cards",
    "finances_debts",
    "finances_budgets",
    "finances_insights",
    "finances_split",
    "finances_family",
    "finances_goals",
    "investments_overview",
    "investments_assets",
    "investments_targets",
    "investments_aporte",
    "settings_support",
    "finances",
    "shared_finances",
    "investments",
  ];

  describe("TOUR_TRACK_METAS", () => {
    it("contém metadados válidos para todos os 19 identificadores de trilha", () => {
      expect(Object.keys(TOUR_TRACK_METAS)).toHaveLength(19);

      for (const trackId of allTrackIds) {
        const meta = TOUR_TRACK_METAS[trackId];
        expect(meta).toBeDefined();
        expect(meta.id).toBe(trackId);
        expect(meta.title.trim().length).toBeGreaterThan(0);
        expect(meta.shortTitle.trim().length).toBeGreaterThan(0);
        expect(meta.description.trim().length).toBeGreaterThan(0);
        expect(meta.startRoute.startsWith("/")).toBe(true);
        expect(meta.stepsCount).toBeGreaterThan(0);
        expect(meta.badgeLabel.trim().length).toBeGreaterThan(0);
        expect(meta.iconName.trim().length).toBeGreaterThan(0);
      }
    });

    it("respeita rigorosamente a contagem de passos definida na especificação", () => {
      expect(TOUR_TRACK_METAS.app_native_apk.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.finances_overview.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.finances_wizard.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.finances_cards.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.finances_debts.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.finances_budgets.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.finances_insights.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.finances_split.stepsCount).toBe(6);
      expect(TOUR_TRACK_METAS.finances_family.stepsCount).toBe(2);
      expect(TOUR_TRACK_METAS.finances_goals.stepsCount).toBe(2);
      expect(TOUR_TRACK_METAS.investments_overview.stepsCount).toBe(3);
      expect(TOUR_TRACK_METAS.investments_assets.stepsCount).toBe(2);
      expect(TOUR_TRACK_METAS.investments_targets.stepsCount).toBe(2);
      expect(TOUR_TRACK_METAS.investments_aporte.stepsCount).toBe(2);
      expect(TOUR_TRACK_METAS.settings_support.stepsCount).toBe(5);
      expect(TOUR_TRACK_METAS.finances.stepsCount).toBe(5);
      expect(TOUR_TRACK_METAS.shared_finances.stepsCount).toBe(4);
      expect(TOUR_TRACK_METAS.investments.stepsCount).toBe(5);
    });

    it("configura rotas iniciais válidas para as trilhas de finanças compartilhadas", () => {
      expect(TOUR_TRACK_METAS.shared_finances.startRoute).toBe("/");
      expect(TOUR_TRACK_METAS.finances_split.startRoute).toBe(
        "/transacoes?novo=despesa&passo=3&racha=1&valor=48000&descricao=Churrasco+de+Confraternizacao",
      );
      expect(TOUR_TRACK_METAS.finances_family.startRoute).toBe("/familia");
      expect(TOUR_TRACK_METAS.finances_goals.startRoute).toBe("/orcamentos?tab=goals");
    });

    it("marca a trilha do aplicativo Android exclusivamente com isNativeOnly", () => {
      expect(TOUR_TRACK_METAS.app_native_apk.isNativeOnly).toBe(true);
      expect(TOUR_TRACK_METAS.finances_overview.isNativeOnly).toBeUndefined();
      expect(TOUR_TRACK_METAS.shared_finances.isNativeOnly).toBeUndefined();
      expect(TOUR_TRACK_METAS.finances_split.isNativeOnly).toBeUndefined();
      expect(TOUR_TRACK_METAS.investments_overview.isNativeOnly).toBeUndefined();
      expect(TOUR_TRACK_METAS.settings_support.isNativeOnly).toBeUndefined();
    });

    it("garante ausência total de emojis e caracteres decorativos em todos os textos", () => {
      const emojiRegex = /\p{Extended_Pictographic}/u;

      for (const trackId of allTrackIds) {
        const meta = TOUR_TRACK_METAS[trackId];
        expect(emojiRegex.test(meta.title)).toBe(false);
        expect(emojiRegex.test(meta.shortTitle)).toBe(false);
        expect(emojiRegex.test(meta.description)).toBe(false);
        expect(emojiRegex.test(meta.badgeLabel)).toBe(false);
      }
    });
  });

  describe("TOUR_TRACK_GROUPS", () => {
    it("contém 5 macro-grupos estruturados", () => {
      expect(TOUR_TRACK_GROUPS).toHaveLength(5);
      const categories = TOUR_TRACK_GROUPS.map((g) => g.category);
      expect(categories).toEqual([
        "native",
        "finances",
        "shared",
        "investments",
        "settings",
      ]);
    });

    it("distribui os micro-tours corretamente por categoria incluindo finanças compartilhadas", () => {
      const [
        nativeGroup,
        financesGroup,
        sharedGroup,
        investmentsGroup,
        settingsGroup,
      ] = TOUR_TRACK_GROUPS;

      expect(nativeGroup?.tracks.map((t) => t.id)).toEqual(["app_native_apk"]);
      expect(financesGroup?.tracks.map((t) => t.id)).toEqual([
        "finances_overview",
        "finances_wizard",
        "finances_cards",
        "finances_debts",
        "finances_budgets",
        "finances_insights",
      ]);
      expect(sharedGroup?.tracks.map((t) => t.id)).toEqual([
        "finances_split",
        "finances_family",
        "finances_goals",
        "finances_trips",
      ]);
      expect(investmentsGroup?.tracks.map((t) => t.id)).toEqual([
        "investments_overview",
        "investments_assets",
        "investments_targets",
        "investments_aporte",
      ]);
      expect(settingsGroup?.tracks.map((t) => t.id)).toEqual(["settings_support"]);
    });

    it("garante ausência de emojis nos textos dos grupos", () => {
      const emojiRegex = /\p{Extended_Pictographic}/u;

      for (const group of TOUR_TRACK_GROUPS) {
        expect(emojiRegex.test(group.title)).toBe(false);
        expect(emojiRegex.test(group.description)).toBe(false);
        if (group.badgeLabel) {
          expect(emojiRegex.test(group.badgeLabel)).toBe(false);
        }
      }
    });
  });

  describe("getTourTrackMeta", () => {
    it("retorna os metadados da trilha solicitada", () => {
      const metaWizard = getTourTrackMeta("finances_wizard");
      expect(metaWizard).toBeDefined();
      expect(metaWizard?.title).toBe("Botão Wizard (+) e Lançamento Rápido");
      expect(metaWizard?.category).toBe("finances");

      const metaShared = getTourTrackMeta("shared_finances");
      expect(metaShared).toBeDefined();
      expect(metaShared?.title).toBe("Finanças Compartilhadas & Modo Família");
      expect(metaShared?.category).toBe("shared");
      expect(metaShared?.stepsCount).toBe(4);

      const metaSplit = getTourTrackMeta("finances_split");
      expect(metaSplit).toBeDefined();
      expect(metaSplit?.title).toBe("Racha de Despesas com Pix");
      expect(metaSplit?.category).toBe("shared");
      expect(metaSplit?.stepsCount).toBe(6);
    });

    it("retorna undefined para identificador inexistente", () => {
      // @ts-expect-error teste com identificador inválido
      expect(getTourTrackMeta("nao_existe")).toBeUndefined();
    });
  });

  describe("getTourTrackGroups", () => {
    it("omite grupos e trilhas nativas quando isNativeApp for false (web standard)", () => {
      const groups = getTourTrackGroups(false);
      expect(groups.some((g) => g.category === "native")).toBe(false);
      for (const group of groups) {
        expect(group.isNativeOnly).toBeFalsy();
        expect(group.tracks.some((t) => t.isNativeOnly)).toBe(false);
      }
      expect(groups).toHaveLength(4);
      expect(groups.map((g) => g.category)).toEqual([
        "finances",
        "shared",
        "investments",
        "settings",
      ]);
    });

    it("inclui o grupo nativo quando isNativeApp for true", () => {
      const groups = getTourTrackGroups(true);
      expect(groups.some((g) => g.category === "native")).toBe(true);
      expect(groups).toHaveLength(5);
    });
  });

  describe("getTourTracksByCategory", () => {
    it("retorna a lista de trilhas correspondente a cada categoria", () => {
      expect(getTourTracksByCategory("finances")).toHaveLength(6);
      expect(getTourTracksByCategory("shared")).toHaveLength(4);
      expect(getTourTracksByCategory("investments")).toHaveLength(4);
      expect(getTourTracksByCategory("settings")).toHaveLength(1);
      expect(getTourTracksByCategory("native")).toHaveLength(1);
    });

    it("retorna array vazio quando categoria não existir", () => {
      // @ts-expect-error teste com categoria inválida
      expect(getTourTracksByCategory("desconhecida")).toEqual([]);
    });
  });
});
