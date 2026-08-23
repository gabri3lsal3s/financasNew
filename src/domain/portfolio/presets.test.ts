import { describe, expect, it } from "vitest";
import {
  applyPresetToPosition,
  createPresetSnapshot,
  SYSTEM_PRESET_TEMPLATES,
  validatePresetInput,
} from "./presets";

describe("domain/portfolio/presets (§F39)", () => {
  const mockPosition = [
    { assetId: "a1", ticker: "PETR4", assetClass: "Ações", pct: 20 },
    { assetId: "a2", ticker: "VALE3", assetClass: "Ações", pct: 15 },
    { assetId: "a3", ticker: "HGLG11", assetClass: "FIIs", pct: 30 },
    { assetId: "a4", ticker: "KNRI11", assetClass: "FIIs", pct: 10 },
    { assetId: "a5", ticker: "TESOURO-SELIC", assetClass: "Renda Fixa", pct: 25 },
  ];

  describe("SYSTEM_PRESET_TEMPLATES", () => {
    it("todos os templates de sistema somam <= 100%", () => {
      for (const t of SYSTEM_PRESET_TEMPLATES) {
        const sum = t.class_targets.reduce((acc, c) => acc + c.target_percentage, 0);
        expect(sum).toBeLessThanOrEqual(100);
      }
    });
  });

  describe("applyPresetToPosition", () => {
    it("aplica template de sistema distribuindo igualmente entre ativos de cada classe", () => {
      const template = SYSTEM_PRESET_TEMPLATES.find((t) => t.id === "sys_dividends")!;
      const result = applyPresetToPosition(template, mockPosition);

      // Ações tem 40% no template -> PETR4 (20%) e VALE3 (20%)
      expect(result.assetDraft["a1"]).toBe(20);
      expect(result.assetDraft["a2"]).toBe(20);

      // FIIs tem 40% no template -> HGLG11 (20%) e KNRI11 (20%)
      expect(result.assetDraft["a3"]).toBe(20);
      expect(result.assetDraft["a4"]).toBe(20);

      // Renda Fixa tem 15% no template -> TESOURO-SELIC (15%)
      expect(result.assetDraft["a5"]).toBe(15);

      expect(result.totalAssetSum).toBe(95); // 40 + 40 + 15 = 95 (Caixa não tem ativo)
      expect(result.classDraft["Ações"]).toBe(40);
      expect(result.classDraft["FIIs"]).toBe(40);
      expect(result.classDraft["Renda Fixa"]).toBe(15);
      expect(result.classDraft["Caixa"]).toBe(5);
    });

    it("aplica preset customizado por ID e Ticker preservando correspondências", () => {
      const customPreset = {
        asset_targets: [
          { asset_id: "a1", ticker: "PETR4", target_percentage: 25 },
          { ticker: "VALE3", target_percentage: 25 },
          { ticker: "HGLG11", target_percentage: 50 },
        ],
        class_targets: [{ name: "Ações", target_percentage: 50 }, { name: "FIIs", target_percentage: 50 }],
      };

      const result = applyPresetToPosition(customPreset, mockPosition);
      expect(result.assetDraft["a1"]).toBe(25);
      expect(result.assetDraft["a2"]).toBe(25);
      expect(result.assetDraft["a3"]).toBe(50);
      expect(result.assetDraft["a4"]).toBe(0); // Ativo existente não no preset recebe 0
      expect(result.assetDraft["a5"]).toBe(0);
      expect(result.totalAssetSum).toBe(100);
    });
  });

  describe("createPresetSnapshot & validatePresetInput", () => {
    it("cria snapshot higienizado removendo itens com 0%", () => {
      const snapshot = createPresetSnapshot({
        name: "Cenário Teste",
        description: "Descrição de teste",
        assetRows: [
          { assetId: "a1", ticker: "PETR4", target: 40 },
          { assetId: "a2", ticker: "VALE3", target: 0 },
          { assetId: "a3", ticker: "HGLG11", target: 60 },
        ],
        classRows: [
          { name: "Ações", target: 40 },
          { name: "FIIs", target: 60 },
          { name: "Caixa", target: 0 },
        ],
      });

      expect(snapshot.name).toBe("Cenário Teste");
      expect(snapshot.description).toBe("Descrição de teste");
      expect(snapshot.asset_targets).toHaveLength(2);
      expect(snapshot.class_targets).toHaveLength(2);

      const validation = validatePresetInput(snapshot);
      expect(validation.ok).toBe(true);
    });

    it("validação rejeita nomes vazios ou soma > 100%", () => {
      expect(
        validatePresetInput({
          name: "",
          asset_targets: [],
          class_targets: [],
        }).ok,
      ).toBe(false);

      expect(
        validatePresetInput({
          name: "Válido",
          asset_targets: [{ ticker: "A", target_percentage: 120 }],
          class_targets: [],
        }).ok,
      ).toBe(false);
    });
  });
});
