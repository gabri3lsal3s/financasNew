import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PositionTable } from "./position-table";
import type { PositionRow } from "./position-table";

const rows: PositionRow[] = [
  {
    assetId: "a1",
    ticker: "PETR4",
    assetClass: "Ações",
    currency: "BRL",
    quantity: 10,
    averageCost: 40,
    priceBRL: 42.5,
    source: "manual",
    valueBRL: 425,
    pct: 25,
    unrealizedPnl: 25,
    unrealizedPct: 6.25,
    isCash: false,
  },
  {
    assetId: "c1",
    ticker: "CAIXA",
    assetClass: null,
    currency: "BRL",
    quantity: 1000,
    averageCost: 0,
    priceBRL: 1,
    source: "fallback",
    valueBRL: 1000,
    pct: 60,
    unrealizedPnl: 0,
    unrealizedPct: null,
    isCash: true,
  },
  {
    assetId: "a2",
    ticker: "BOVA11",
    assetClass: "FIIs",
    currency: "BRL",
    quantity: 5,
    averageCost: 100,
    priceBRL: 110,
    source: "api",
    valueBRL: 550,
    pct: 33,
    unrealizedPnl: 50,
    unrealizedPct: 10,
    isCash: false,
  },
];

describe("PositionTable (F17 — ordenação por coluna)", () => {
  it("sem sortable mantém a ordem recebida", () => {
    render(<PositionTable rows={rows} />);
    const tickers = screen.getAllByText(/PETR4|CAIXA|BOVA11/);
    expect(tickers[0]).toHaveTextContent("PETR4");
  });

  it("sortable ordena por valor de mercado ascendente e alterna direção", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} sortable />);
    const valorHeader = screen.getByRole("button", { name: /Valor/i });
    await user.click(valorHeader); // asc: PETR4 (425) → BOVA11 (550) → CAIXA (1.000)
    let tickers = screen.getAllByText(/PETR4|CAIXA|BOVA11/);
    expect(tickers[0]).toHaveTextContent("PETR4");
    expect(tickers[2]).toHaveTextContent("CAIXA");
    await user.click(valorHeader); // desc: CAIXA → BOVA11 → PETR4
    tickers = screen.getAllByText(/PETR4|CAIXA|BOVA11/);
    expect(tickers[0]).toHaveTextContent("CAIXA");
    expect(tickers[2]).toHaveTextContent("PETR4");
  });

  it("sortable expõe aria-sort no cabeçalho ativo", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} sortable />);
    const pctHeader = screen.getByRole("button", { name: /Rentab/i });
    await user.click(pctHeader);
    expect(pctHeader).toHaveAttribute("aria-sort", "ascending");
  });
});
