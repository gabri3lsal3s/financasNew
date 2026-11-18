import { describe, expect, it } from "vitest";
import type { PortfolioAsset } from "@/types";
import {
  buildDefaultFixedIncomeMetadata,
  buildPortfolioImportPlan,
  isB3SpreadsheetContent,
  parseB3ImportSource,
  recalculateImportRowValues,
} from "./b3-csv-parser";
import type { ParsedPortfolioImportRow } from "./import-parser";

describe("b3-csv-parser", () => {
  it("detecta conteúdo de planilha B3 com cabeçalhos e separadores", () => {
    const csv = `\uFEFFData do Negócio;Tipo de Movimentação;Código de Negociação;Quantidade;Preço;Valor Total
15/08/2026;Compra;PETR4;100;38,50;3850,00`;

    expect(isB3SpreadsheetContent(csv)).toBe(true);
    const result = parseB3ImportSource(csv);
    expect(result.kind).toBe("mapping");
    if (result.kind === "mapping") {
      expect(result.rows).toHaveLength(2);
      expect(result.mapping.mode).toBe("movements");
    }
  });

  it("interpreta linhas em linguagem natural diretamente como rows sem passar por mapeamento", () => {
    const natural = "15/08 comprei 100 PETR4 a 38,50\n16/08 comprei 50 MXRF11 a 10,20";
    expect(isB3SpreadsheetContent(natural)).toBe(false);

    const result = parseB3ImportSource(natural, 2026);
    expect(result.kind).toBe("rows");
    if (result.kind === "rows") {
      expect(result.rows).toHaveLength(2);
      expect(result.rows[0]?.ticker).toBe("PETR4");
      expect(result.rows[1]?.ticker).toBe("MXRF11");
    }
  });

  it("recalcula total e preço unitário ao editar campos da linha", () => {
    const base: ParsedPortfolioImportRow = {
      date: "2026-08-15",
      ticker: "PETR4",
      type: "buy",
      quantity: 100,
      price: 38.5,
      total: 3850,
      assetClass: "Ações",
      currency: "BRL",
      rawText: "",
    };

    const afterQty = recalculateImportRowValues(base, { quantity: 200 });
    expect(afterQty.total).toBe(7700);

    const afterTotal = recalculateImportRowValues(afterQty, { total: 8000 });
    expect(afterTotal.price).toBe(40);
  });

  it("gera metadados de renda fixa inferindo indexador e isenção", () => {
    const lciMeta = buildDefaultFixedIncomeMetadata("LCI BANCO INTER", 10000, "2026-08-01");
    expect(lciMeta).toMatchObject({
      rate_type: "cdi",
      rate_value: 100,
      is_tax_exempt: true,
      base_value: 10000,
    });

    const ipcaMeta = buildDefaultFixedIncomeMetadata("TESOURO IPCA 2035", 3200, "2026-08-01");
    expect(ipcaMeta).toMatchObject({
      rate_type: "ipca",
      rate_value: 6,
      is_tax_exempt: false,
    });
  });

  it("consolida múltiplas compras de novo ativo e atualiza ativo existente no plano de importação", () => {
    const existingAssets: PortfolioAsset[] = [
      {
        id: "existing-vale",
        user_id: "u1",
        ticker: "VALE3",
        asset_class: "Ações",
        currency: "BRL",
        quantity: 10,
        average_price: 50,
      },
    ];

    const selectedRows: ParsedPortfolioImportRow[] = [
      {
        date: "2026-08-10",
        ticker: "BBAS3",
        type: "buy",
        quantity: 100,
        price: 20,
        total: 2000,
        assetClass: "Ações",
        currency: "BRL",
        rawText: "",
      },
      {
        date: "2026-08-15",
        ticker: "BBAS3",
        type: "buy",
        quantity: 100,
        price: 30,
        total: 3000,
        assetClass: "Ações",
        currency: "BRL",
        rawText: "",
      },
      {
        date: "2026-08-16",
        ticker: "VALE3",
        type: "buy",
        quantity: 20,
        price: 60,
        total: 1200,
        assetClass: "Ações",
        currency: "BRL",
        rawText: "",
      },
    ];

    const plan = buildPortfolioImportPlan({
      existingAssets,
      selectedRows,
      fallbackDate: "2026-08-20",
    });

    expect(plan.assetsToCreate).toHaveLength(1);
    expect(plan.assetsToCreate[0]).toMatchObject({
      ticker: "BBAS3",
      quantity: 200,
      average_price: 25,
    });

    expect(plan.assetsToUpdate).toHaveLength(1);
    expect(plan.assetsToUpdate[0]).toMatchObject({
      id: "existing-vale",
      patch: { quantity: 20, average_price: 60, asset_class: "Ações" },
    });

    expect(plan.transactions).toHaveLength(3);
  });
});
