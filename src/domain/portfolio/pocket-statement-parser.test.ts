import { describe, expect, it } from "vitest";
import type { PortfolioContribution } from "@/types";
import {
  buildPocketContributionNotes,
  buildPocketImportPayloads,
  computePocketCostSummary,
  filterHistoricalContributions,
  parsePocketStatementText,
} from "./pocket-statement-parser";

describe("pocket-statement-parser", () => {
  it("normaliza BOM/espaços não-quebráveis e interpreta extrato mensal", () => {
    const raw = `\uFEFFOut.\u00a02023\t6.187,37\t6.147,97
Nov. 2023\t8.678,16\t8.745,74
Dez. 2023\t13.527,62\t14.221,47`;

    const result = parsePocketStatementText(raw);

    expect(result.actionableRows).toHaveLength(3);
    expect(result.actionableRows[0]).toMatchObject({ date: "2023-10-31", delta: 6187.37, type: "aporte" });
    expect(result.actionableRows[1]).toMatchObject({ date: "2023-11-30", delta: 2490.79, type: "aporte" });
    expect(result.actionableRows[2]).toMatchObject({ date: "2023-12-31", delta: 4849.46, type: "aporte" });
  });

  it("filtra e ordena marcos históricos ignorando aportes específicos não-marco", () => {
    const list: PortfolioContribution[] = [
      { id: "1", user_id: "u1", asset_id: null, date: "2024-01-10", amount: 1000, notes: "Aporte" },
      { id: "2", user_id: "u1", asset_id: "a1", date: "2024-03-10", amount: 500, notes: "Compra PETR4" },
      { id: "3", user_id: "u1", asset_id: "a2", date: "2024-02-10", amount: 800, notes: "Marco histórico inicial" },
    ];

    const filtered = filterHistoricalContributions(list);
    expect(filtered.map((item) => item.id)).toEqual(["3", "1"]);
  });

  it("calcula aportes, resgates e capital líquido do bolso", () => {
    const summary = computePocketCostSummary([
      { amount: 10000, notes: "Aporte Inicial" },
      { amount: 2500.5, notes: "[Resgate] Retirada parcial" },
      { amount: 1500, notes: "Aporte mensal" },
    ]);

    expect(summary).toEqual({
      totalAportesBRL: 11500,
      totalResgatesBRL: 2500.5,
      netPocketCapitalBRL: 8999.5,
    });
  });

  it("monta notas com tag de resgate e rentabilidade explícita", () => {
    const note = buildPocketContributionNotes({
      entryType: "resgate",
      notes: "Saque parcial",
      ratePctText: "1,24",
      isFirstMarco: false,
    });
    expect(note).toBe("[Resgate] Saque parcial [Rent: +1,24%]");

    const preserved = buildPocketContributionNotes({
      entryType: "aporte",
      notes: "",
      ratePctText: "",
      existingNotes: "Anterior [Rent: -0,5%]",
      isFirstMarco: true,
    });
    expect(preserved).toBe("Marco Histórico · Início da Carteira [Rent: -0,5%]");
  });

  it("constrói payloads de contribuições e snapshots TWR a partir das linhas parseadas", () => {
    const parsed = parsePocketStatementText("Out. 2023 5.000,00 5.100,00\nNov. 2023 5.000,00 5.300,00");
    const { contributionPayloads, snapshotPayloads } = buildPocketImportPayloads(
      parsed.actionableRows,
      parsed.rows,
    );

    expect(contributionPayloads).toHaveLength(1);
    expect(contributionPayloads[0]).toMatchObject({
      asset_id: null,
      date: "2023-10-31",
      amount: 5000,
    });

    expect(snapshotPayloads).toHaveLength(2);
    expect(snapshotPayloads[1]).toMatchObject({
      month: "2023-11",
      total_value: 5300,
      total_cost: 5000,
      status: "closed",
      closing_date: "2023-11-30",
    });
  });
});
