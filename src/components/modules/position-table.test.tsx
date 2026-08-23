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

describe("PositionTable (F17 — ordenação por coluna e agrupamento por classe)", () => {
  it("renderiza cabeçalhos das classes agrupadas e colapsadas por padrão", () => {
    render(<PositionTable rows={rows} />);
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    expect(acoesGroups.length).toBeGreaterThanOrEqual(1);
    expect(acoesGroups[0]).toHaveAttribute("aria-expanded", "false");

    const fiisGroups = screen.getAllByRole("button", { name: /Classe FIIs/i });
    expect(fiisGroups.length).toBeGreaterThanOrEqual(1);

    const caixaGroups = screen.getAllByRole("button", { name: /Classe Caixa/i });
    expect(caixaGroups.length).toBeGreaterThanOrEqual(1);
  });

  it("permite expandir e colapsar um grupo de classe ao clicar no cabeçalho", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    expect(acoesGroups[0]).toHaveAttribute("aria-expanded", "false");

    // Expandir grupo Ações
    await user.click(acoesGroups[0]!);
    expect(acoesGroups[0]).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);

    // Colapsar novamente
    await user.click(acoesGroups[0]!);
    expect(acoesGroups[0]).toHaveAttribute("aria-expanded", "false");
  });

  it("sortable ordena por valor de mercado e expõe aria-sort no cabeçalho ativo", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} sortable />);

    // Expandir grupo Ações para acessar os cabeçalhos de coluna
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    await user.click(acoesGroups[1] ?? acoesGroups[0]!);

    const valorHeader = screen.getByRole("button", { name: /Valor/i });
    await user.click(valorHeader);
    expect(valorHeader).toHaveAttribute("aria-sort", "ascending");

    const pctHeader = screen.getByRole("button", { name: /Rentab/i });
    await user.click(pctHeader);
    expect(pctHeader).toHaveAttribute("aria-sort", "ascending");
  });

  it("F28 — mobile: renderiza cards empilhados ao expandir grupo", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    // Expandir Ações
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    await user.click(acoesGroups[0]!);

    const mobileList = screen.getByRole("list", { name: "Posições (visão móvel)" });
    expect(within(mobileList).getByText("PETR4")).toBeInTheDocument();
    expect(within(mobileList).getAllByText("Lucro/Prejuízo").length).toBeGreaterThanOrEqual(1);
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

    // Expandir Ações
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    await user.click(acoesGroups[0]!);

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

    // Expandir Ações
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    await user.click(acoesGroups[1] ?? acoesGroups[0]!);

    // Clicar no botão do ativo
    const assetButtons = screen.getAllByRole("button", { name: "Ver detalhes de PETR4" });
    await user.click(assetButtons[0]!);
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

    // Apenas grupo de Ações deve estar presente
    expect(screen.getAllByRole("button", { name: /Classe Ações/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByRole("button", { name: /Classe FIIs/i })).not.toBeInTheDocument();
  });

  it("filtra posições ao clicar no botão da classe e exibe os ativos da classe diretamente", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    const fiisFilter = screen.getByRole("button", { name: "FIIs" });
    await user.click(fiisFilter);

    // Quando filtrado por classe única, exibe diretamente a lista plana dos ativos daquela classe
    expect(screen.getAllByText("BOVA11")).toHaveLength(2); // desktop + mobile
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

    // Filtrar por Ações para ver os ativos diretamente
    const acoesFilter = screen.getByRole("button", { name: "Ações" });
    await user.click(acoesFilter);

    const priceButtons = screen.getAllByRole("button", { name: /Cotação de PETR4/ });
    expect(priceButtons[0]).toBeDefined();
    await user.click(priceButtons[0]!);

    expect(onSetManualPrice).toHaveBeenCalledWith(
      "a1",
      "PETR4",
      "BRL",
      42.5,
      "manual",
      undefined,
      undefined,
      undefined,
    );
    expect(onListTransactions).not.toHaveBeenCalled();
  });

  it("renderiza badge Zerada para ativos com quantidade igual a 0", async () => {
    const user = userEvent.setup();
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
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    await user.click(acoesGroups[0]!);

    expect(screen.getAllByText("Zerada").length).toBeGreaterThanOrEqual(1);
  });
});
