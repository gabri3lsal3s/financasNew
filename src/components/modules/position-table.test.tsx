import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
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

  it("F28 — mobile: renderiza cards empilhados com valor, lucro e rentabilidade", () => {
    render(<PositionTable rows={rows} />);
    const mobileList = screen.getByRole("list", { name: "Posições (visão móvel)" });
    // Cards: ticker presente e o par valor/lucro-prejuízo em cada posição.
    expect(within(mobileList).getByText("PETR4")).toBeInTheDocument();
    expect(within(mobileList).getAllByText("Lucro/Prejuízo")).toHaveLength(3);
    // Caixa: sem rentabilidade → travessão.
    expect(within(mobileList).getByText("CAIXA")).toBeInTheDocument();
    // O mesmo conjunto de linhas aparece na tabela (sm+) — sem perda de dados.
    expect(screen.getAllByText("PETR4")).toHaveLength(2);
  });

  it("aciona onListTransactions ao clicar no card mobile", async () => {
    const onListTransactions = vi.fn();
    const user = userEvent.setup();
    render(
      <PositionTable
        rows={rows}
        onListTransactions={onListTransactions}
      />,
    );
    const mobileList = screen.getByRole("list", { name: "Posições (visão móvel)" });
    const petr4Card = within(mobileList).getByRole("button", { name: /Ver detalhes de PETR4/i });
    await user.click(petr4Card);
    expect(onListTransactions).toHaveBeenCalledWith("a1", "PETR4");
  });

  it("aciona onListTransactions ao clicar na linha da tabela ou no botão do ativo no desktop", async () => {
    const onListTransactions = vi.fn();
    const user = userEvent.setup();
    render(
      <PositionTable
        rows={rows}
        onListTransactions={onListTransactions}
      />,
    );

    // Clicar no botão do ativo
    const assetButtons = screen.getAllByRole("button", { name: "Ver detalhes de PETR4" });
    // assetButtons[0] ou [1] (mobile / desktop)
    await user.click(assetButtons[0]!);
    expect(onListTransactions).toHaveBeenCalledWith("a1", "PETR4");

    // Clicar na linha da tabela desktop
    const rowsElements = screen.getAllByRole("row");
    // Primeira linha de dados (índice 1, pois índice 0 é o header)
    await user.click(rowsElements[1]!);
    expect(onListTransactions).toHaveBeenCalledWith("a1", "PETR4");
  });

  it("F28 — mobile: mensagem vazia também no layout de cards", () => {
    render(<PositionTable rows={[]} emptyMessage="Carteira sem posições." />);
    const mobileList = screen.getByRole("list", { name: "Posições (visão móvel)" });
    expect(within(mobileList).getByText("Carteira sem posições.")).toBeInTheDocument();
  });

  it("filtra posições por busca de ticker ou classe", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    const searchInput = screen.getByPlaceholderText("Buscar por ticker ou classe…");
    await user.type(searchInput, "PETR");

    expect(screen.getAllByText("PETR4")).toHaveLength(2); // desktop + mobile
    expect(screen.queryByText("BOVA11")).not.toBeInTheDocument();
    expect(screen.queryByText("CAIXA")).not.toBeInTheDocument();
  });

  it("filtra posições ao clicar no botão da classe", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    const fiisFilter = screen.getByRole("button", { name: "FIIs" });
    await user.click(fiisFilter);

    expect(screen.getAllByText("BOVA11")).toHaveLength(2);
    expect(screen.queryByText("PETR4")).not.toBeInTheDocument();
  });

  it("aciona onSetManualPrice ao clicar no botão de cotação sem disparar onListTransactions", async () => {
    const onSetManualPrice = vi.fn();
    const onListTransactions = vi.fn();
    const user = userEvent.setup();
    render(
      <PositionTable
        rows={rows}
        onSetManualPrice={onSetManualPrice}
        onListTransactions={onListTransactions}
      />,
    );

    const priceButtons = screen.getAllByRole("button", { name: /Cotação de PETR4/ });
    expect(priceButtons[0]).toBeDefined();
    await user.click(priceButtons[0]!);

    expect(onSetManualPrice).toHaveBeenCalledWith("a1", "PETR4", "BRL", 42.5, "manual");
    expect(onListTransactions).not.toHaveBeenCalled();
  });

  it("renderiza badge Zerada para ativos com quantidade igual a 0", () => {
    const zeroedRows: PositionRow[] = [
      {
        ...rows[0]!,
        assetId: "zero1",
        ticker: "VALE3",
        quantity: 0,
        valueBRL: 0,
        unrealizedPnl: 0,
      },
    ];

    render(<PositionTable rows={zeroedRows} />);
    expect(screen.getAllByText("Zerada").length).toBeGreaterThanOrEqual(1);
  });
});
