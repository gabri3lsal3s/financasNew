import { describe, expect, it } from "vitest";
import { CATEGORY_ICON_MAP } from "@/components/modules/category-icons";
import {
  ALL_CATEGORY_KITS,
  CATEGORY_KIT_BUSINESS,
  CATEGORY_KIT_ESSENTIAL,
  CATEGORY_KIT_FAMILY,
  CATEGORY_KIT_VEHICLE,
  getMissingKitItems,
  isKitItemInstalled,
  normalizeCategoryKey,
} from "./kits";

describe("Kits de Categorias (domain/categories/kits.ts)", () => {
  it("contém exatamente os 4 kits estruturados", () => {
    expect(ALL_CATEGORY_KITS).toHaveLength(4);
    expect(ALL_CATEGORY_KITS.map((k) => k.id)).toEqual([
      "essential",
      "business",
      "family",
      "vehicle",
    ]);
    expect(CATEGORY_KIT_FAMILY.id).toBe("family");
    expect(CATEGORY_KIT_VEHICLE.id).toBe("vehicle");
  });

  it("garante que 100% dos ícones de todos os kits existem no CATEGORY_ICON_MAP", () => {
    for (const kit of ALL_CATEGORY_KITS) {
      for (const item of kit.items) {
        expect(
          CATEGORY_ICON_MAP[item.icon],
          `Ícone '${item.icon}' do item '${item.name}' no kit '${kit.id}' deve existir em CATEGORY_ICON_MAP`,
        ).toBeDefined();
      }
    }
  });

  it("garante conforms com AGENTS.md Regra 8: ZERO emojis em nomes, títulos e descrições", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const kit of ALL_CATEGORY_KITS) {
      expect(emojiRegex.test(kit.title)).toBe(false);
      expect(emojiRegex.test(kit.description)).toBe(false);
      if (kit.badge) expect(emojiRegex.test(kit.badge)).toBe(false);

      for (const item of kit.items) {
        expect(emojiRegex.test(item.name)).toBe(false);
        if (item.description) {
          expect(emojiRegex.test(item.description)).toBe(false);
        }
      }
    }
  });

  it("não possui itens duplicados (mesmo nome e tipo) dentro de um mesmo kit", () => {
    for (const kit of ALL_CATEGORY_KITS) {
      const seen = new Set<string>();
      for (const item of kit.items) {
        const key = `${item.name.toLowerCase()}:${item.type}`;
        expect(seen.has(key), `Item duplicado '${item.name}' no kit '${kit.id}'`).toBe(false);
        seen.add(key);
      }
    }
  });

  describe("Funções puras de checagem e reconciliação", () => {
    it("normalizeCategoryKey padroniza nome e tipo", () => {
      expect(normalizeCategoryKey("  Alimentação  ", "Expense")).toBe("alimentação:expense");
    });

    it("isKitItemInstalled detecta itens já presentes com tolerância a maiúsculas e espaços", () => {
      const existing = [
        { name: "Alimentação", type: "expense" },
        { name: "Salário", type: "income" },
      ];

      expect(
        isKitItemInstalled(
          { name: "  alimentação ", type: "expense", icon: "alimentacao", color: "#000" },
          existing,
        ),
      ).toBe(true);

      expect(
        isKitItemInstalled(
          { name: "Alimentação", type: "income", icon: "alimentacao", color: "#000" },
          existing,
        ),
      ).toBe(false);

      expect(
        isKitItemInstalled(
          { name: "Moradia", type: "expense", icon: "moradia", color: "#000" },
          existing,
        ),
      ).toBe(false);
    });

    it("getMissingKitItems retorna apenas as categorias que faltam na conta", () => {
      const existing = [
        { name: "Prestação de Serviços", type: "income" },
        { name: "Impostos e Guia DAS", type: "expense" },
      ];

      const missing = getMissingKitItems(CATEGORY_KIT_BUSINESS, existing);

      expect(missing).toHaveLength(5);
      expect(missing.map((i) => i.name)).not.toContain("Prestação de Serviços");
      expect(missing.map((i) => i.name)).not.toContain("Impostos e Guia DAS");
      expect(missing.map((i) => i.name)).toContain("Ferramentas e Softwares PJ");
    });

    it("getMissingKitItems funciona perfeitamente para recuperação no Kit Essencial", () => {
      const existing = CATEGORY_KIT_ESSENTIAL.items.filter((i) => i.name !== "Lazer");

      const missing = getMissingKitItems(CATEGORY_KIT_ESSENTIAL, existing);
      expect(missing).toHaveLength(1);
      expect(missing[0]!.name).toBe("Lazer");
    });
  });
});
