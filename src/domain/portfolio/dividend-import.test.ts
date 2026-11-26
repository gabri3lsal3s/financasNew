import { describe, expect, it } from "vitest";
import type { PortfolioAsset, PortfolioDividend } from "@/types";
import { parseDividendImportText } from "./dividend-import";

const assets: PortfolioAsset[] = [
  {
    id: "a-hgru",
    user_id: "u1",
    ticker: "HGRU11",
    asset_class: "FII",
    quantity: 100,
    average_price: 120,
    currency: "BRL",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "a-petr",
    user_id: "u1",
    ticker: "PETR4",
    asset_class: "Ações BR",
    quantity: 200,
    average_price: 35,
    currency: "BRL",
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
];

const existingDividends: PortfolioDividend[] = [
  {
    id: "d-1",
    user_id: "u1",
    asset_id: "a-hgru",
    ticker: "HGRU11",
    amount: 120,
    date: "2026-10-15",
    notes: null,
    created_at: "2026-10-15T00:00:00Z",
    updated_at: "2026-10-15T00:00:00Z",
  },
];

describe("parseDividendImportText (B3 / CSV / TSV)", () => {
  it("extrai proventos da Área do Investidor B3 e detecta duplicatas existentes", () => {
    const csv = [
      "Produto;Pagamento;Tipo de Evento;Valor líquido",
      "HGRU11 - CSHG RENDA URBANA FII;15/10/2026;Rendimento;R$ 120,00",
      "PETR4 - PETROLEO BRASILEIRO S.A.;20/10/2026;Juros sobre Capital Próprio;R$ 195,50",
      "Linha Inválida;sem-data;Dividendo;0",
    ].join("\n");

    const res = parseDividendImportText(csv, assets, existingDividends);
    expect(res.skippedInvalid).toBe(1);
    expect(res.items).toHaveLength(2);
    expect(res.duplicateCount).toBe(1);
    expect(res.newCount).toBe(1);

    expect(res.items[0]).toMatchObject({
      ticker: "HGRU11",
      matchedAssetId: "a-hgru",
      date: "2026-10-15",
      txType: "yield",
      amount: 120,
      alreadyImported: true,
    });
    expect(res.items[1]).toMatchObject({
      ticker: "PETR4",
      matchedAssetId: "a-petr",
      date: "2026-10-20",
      txType: "jcp",
      amount: 195.5,
      alreadyImported: false,
    });
  });
});
