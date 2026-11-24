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
  {
    assetId: "rf1",
    ticker: "CDB-BMG-JAN27",
    assetClass: "Renda Fixa",
    currency: "BRL",
    quantity: 1,
    averageCost: 1000,
    totalCostBRL: 1000,
    priceBRL: 1278.58,
    source: "manual",
    valueBRL: 1278.58,
    pct: 40,
    unrealizedPnl: 278.58,
    unrealizedPct: 27.86,
    isCash: false,
    pricingMode: "total_value",
    fixedIncomeMetadata: {
      rate_type: "pre",
      rate_value: 16.22,
      base_date: "2024-01-01",
      maturity_date: "2027-01-15",
    },
  },
];

describe("PositionTable (F17 — ordenação por coluna e agrupamento por classe)", () => {
  it("renderiza cabeçalhos das classes de investimento agrupadas e não exibe Caixa na tabela", () => {
    render(<PositionTable rows={rows} />);
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    expect(acoesGroups.length).toBeGreaterThanOrEqual(1);
    expect(acoesGroups[0]).toHaveAttribute("aria-expanded", "false");

    const fiisGroups = screen.getAllByRole("button", { name: /Classe FIIs/i });
    expect(fiisGroups.length).toBeGreaterThanOrEqual(1);

    const rfGroups = screen.getAllByRole("button", { name: /Classe Renda Fixa/i });
    expect(rfGroups.length).toBeGreaterThanOrEqual(1);

    // Caixa vive exclusivamente no card de caixa (não deve existir na tabela)
    expect(screen.queryByRole("button", { name: /Classe Caixa/i })).not.toBeInTheDocument();
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
  }, 20000);

  it("renderiza colunas contextuais semânticas para Renda Fixa (Valor Aplicado, Saldo Atual, Vencimento)", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    // Expandir grupo Renda Fixa no desktop
    const rfGroups = screen.getAllByRole("button", { name: /Classe Renda Fixa/i });
    await user.click(rfGroups[1] ?? rfGroups[0]!);

    // Deve conter os cabeçalhos semânticos de Renda Fixa
    expect(screen.getByRole("columnheader", { name: /Valor Aplicado/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Saldo Atual/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Rendimento/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Vencimento/i })).toBeInTheDocument();

    // Data de vencimento formatada
    expect(screen.getByText("15/01/2027")).toBeInTheDocument();
  });

  it("renderiza colunas de custódia por cotas para Renda Variável (Quantidade, Preço, Custo médio)", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    // Expandir grupo Ações no desktop
    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    await user.click(acoesGroups[1] ?? acoesGroups[0]!);

    // Deve conter os cabeçalhos de Renda Variável
    expect(screen.getByRole("columnheader", { name: /Quantidade/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Preço/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /Custo médio/i })).toBeInTheDocument();
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

  it("oculta posições zeradas por padrão e exibe ao alternar o toggle ou expandir a seção", async () => {
    const user = userEvent.setup();
    const mixedRows: PositionRow[] = [
      rows[0]!,
      {
        ...rows[0]!,
        assetId: "zero1",
        ticker: "VALE3",
        quantity: 0,
        valueBRL: 0,
        unrealizedPnl: 0,
        totalCostBRL: 0,
        totalCost: 0,
        averageCost: 0,
      },
    ];

    render(<PositionTable rows={mixedRows} />);

    // Por padrão, a seção colapsável de Posições Encerradas existe
    expect(screen.getByText(/Posições Encerradas/i)).toBeInTheDocument();

    // Ao clicar em "Ver encerradas", ela é exibida na tabela principal
    const toggleBtn = screen.getByRole("button", { name: /Ver encerradas/i });
    await user.click(toggleBtn);

    const acoesGroups = screen.getAllByRole("button", { name: /Classe Ações/i });
    await user.click(acoesGroups[0]!);

    expect(screen.getAllByText("Zerada").length).toBeGreaterThanOrEqual(1);
  });

  it("exibe YoC calculado na moeda nativa USD sem distorção cambial", async () => {
    const user = userEvent.setup();
    const usdRow: PositionRow = {
      assetId: "usd1",
      ticker: "AAPL",
      assetClass: "Internacional",
      currency: "USD",
      quantity: 10,
      averageCost: 100, // $100 USD
      totalCost: 1000, // $1.000 USD de custo nativo
      totalCostBRL: 5000, // R$ 5.000 BRL
      priceQuote: 150,
      priceBRL: 750,
      usdRate: 5.0,
      source: "api",
      valueBRL: 7500,
      pct: 100,
      unrealizedPnl: 2500,
      unrealizedPct: 50,
      totalReturnPnl: 3000,
      totalReturnPct: 60,
      dividends: 500, // R$ 500 BRL
      dividendsNative: 100, // $100 USD -> YoC nativo = (100 / 1000) * 100 = 10.0%
      isCash: false,
    };

    render(<PositionTable rows={[usdRow]} />);

    const intGroups = screen.getAllByRole("button", { name: /Classe Internacional/i });
    await user.click(intGroups[0]!);

    // YoC 10.0% deve ser exibido tanto na versão desktop quanto mobile
    const yocBadges = screen.getAllByText(/YoC 10[,.]0%/i);
    expect(yocBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("permite alternar entre agrupamento Por Classe e Por Setor", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    // Por padrão está agrupado por classe
    expect(screen.getAllByRole("button", { name: /Classe Ações/i }).length).toBeGreaterThanOrEqual(1);

    // Clica no alternador 'Por Setor'
    const sectorToggleBtn = screen.getByRole("button", { name: /Por Setor/i });
    await user.click(sectorToggleBtn);

    // Agora deve exibir cabeçalhos de setores agrupados
    const petroSector = screen.getAllByRole("button", { name: /Setor Petróleo/i });
    expect(petroSector.length).toBeGreaterThanOrEqual(1);

    // Expande o setor de petróleo
    await user.click(petroSector[0]!);
    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
  });

  it("exibe metadados de setor sob o ticker quando expandido", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);
    const acoesGroup = screen.getAllByRole("button", { name: /Classe Ações/i })[0]!;
    await user.click(acoesGroup);

    // PETR4 tem setor inferido como 'Petróleo, Gás e Combustíveis'
    const sectorLabels = screen.getAllByText("Petróleo, Gás e Combustíveis");
    expect(sectorLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("não renderiza o pontinho de saldo manual quando a renda fixa possui cálculo automático ativo", async () => {
    const user = userEvent.setup();
    const autoRfRow: PositionRow = {
      assetId: "rf-auto",
      ticker: "CDB-AUTOMATICO",
      assetClass: "Renda Fixa",
      currency: "BRL",
      quantity: 1,
      averageCost: 5000,
      totalCostBRL: 5000,
      priceBRL: 5200,
      source: "api",
      valueBRL: 5200,
      pct: 100,
      unrealizedPnl: 200,
      unrealizedPct: 4,
      isCash: false,
      pricingMode: "total_value",
      fixedIncomeMetadata: {
        rate_type: "cdi",
        rate_value: 110,
        base_date: "2026-01-01",
      },
    };

    render(<PositionTable rows={[autoRfRow]} onCalibrateAsset={vi.fn()} />);
    const rfGroup = screen.getAllByRole("button", { name: /Classe Renda Fixa/i })[0]!;
    await user.click(rfGroup);

    // O pontinho de saldo manual NÃO deve existir (nem no desktop nem no mobile)
    expect(screen.queryAllByTitle(/Saldo cadastrado manual/i)).toHaveLength(0);
  });

  it("renderiza o pontinho de saldo manual quando a renda fixa não possui taxa cadastrada ativa", async () => {
    const user = userEvent.setup();
    const manualRfRow: PositionRow = {
      assetId: "rf-manual",
      ticker: "CDB-SEM-TAXA",
      assetClass: "Renda Fixa",
      currency: "BRL",
      quantity: 1,
      averageCost: 5000,
      totalCostBRL: 5000,
      priceBRL: 5000,
      source: "manual",
      valueBRL: 5000,
      pct: 100,
      unrealizedPnl: 0,
      unrealizedPct: 0,
      isCash: false,
      pricingMode: "total_value",
      fixedIncomeMetadata: null, // sem taxa ou metadados
    };

    render(<PositionTable rows={[manualRfRow]} onCalibrateAsset={vi.fn()} />);
    const rfGroup = screen.getAllByRole("button", { name: /Classe Renda Fixa/i })[0]!;
    await user.click(rfGroup);

    // O pontinho de saldo manual DEVE existir (tanto no desktop quanto no mobile)
    const manualDots = screen.getAllByTitle(/Saldo cadastrado manual — informe a taxa para cálculo automático/i);
    expect(manualDots.length).toBeGreaterThanOrEqual(1);
  });

  it("mantém agrupamento por setor mesmo quando uma classe está filtrada", async () => {
    const user = userEvent.setup();
    render(<PositionTable rows={rows} />);

    // Filtra pela classe Ações via botão de desktop
    const acoesBtn = screen.getByRole("button", { name: "Ações" });
    await user.click(acoesBtn);

    // Alterna para 'Por Setor'
    const sectorToggleBtn = screen.getByRole("button", { name: /Por Setor/i });
    await user.click(sectorToggleBtn);

    // Deve agrupar por setor (Setor Petróleo...), e NÃO exibir ativos soltos diretamente
    const petroSector = screen.getAllByRole("button", { name: /Setor Petróleo/i });
    expect(petroSector.length).toBeGreaterThanOrEqual(1);

    // O ativo PETR4 deve estar contido no grupo recolhido inicialmente
    // Ao expandir o setor, PETR4 aparece
    await user.click(petroSector[0]!);
    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
  });

  it("isola ativos em quarentena e em saída em seções dedicadas sem misturar na carteira de aportes", async () => {
    const user = userEvent.setup();
    const rowsWithQuarantine: PositionRow[] = [
      ...rows,
      {
        assetId: "quarantine-asset",
        ticker: "TEST3",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 100,
        averageCost: 10,
        totalCostBRL: 1000,
        priceBRL: 8,
        source: "api",
        valueBRL: 800,
        pct: 10,
        unrealizedPnl: -200,
        unrealizedPct: -20,
        isCash: false,
        allocationStatus: "quarantine",
      },
      {
        assetId: "exit-asset",
        ticker: "EXIT3",
        assetClass: "Ações",
        currency: "BRL",
        quantity: 50,
        averageCost: 20,
        totalCostBRL: 1000,
        priceBRL: 15,
        source: "api",
        valueBRL: 750,
        pct: 5,
        unrealizedPnl: -250,
        unrealizedPct: -25,
        isCash: false,
        allocationStatus: "exit",
      },
    ];

    render(<PositionTable rows={rowsWithQuarantine} />);

    // Seções de governança dedicadas surgem no rodapé
    expect(screen.getByText("Ativos em Quarentena")).toBeInTheDocument();
    expect(screen.getByText("Ativos em Saída / Desinvestimento")).toBeInTheDocument();

    // Ao expandir a quarentena, o ativo TEST3 é visível
    const quarantineToggle = screen.getByRole("button", { name: /Ativos em Quarentena/i });
    await user.click(quarantineToggle);
    expect(screen.getByText("TEST3")).toBeInTheDocument();

    // Ao expandir a saída, o ativo EXIT3 é visível
    const exitToggle = screen.getByRole("button", { name: /Ativos em Saída/i });
    await user.click(exitToggle);
    expect(screen.getByText("EXIT3")).toBeInTheDocument();
  });
});
