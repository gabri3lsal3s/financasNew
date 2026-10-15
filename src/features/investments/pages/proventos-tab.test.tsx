import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProventosTab } from "./proventos-tab";

const triggerSensoryMock = vi.fn();

vi.mock("@/services/sensory", () => ({
  triggerSensory: (...args: unknown[]) => triggerSensoryMock(...args),
}));

function renderTab(ui = <ProventosTab defaultMonth="2026-08" />, initialEntries = ["/"]) {
  return render(<MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>);
}

const dividendsMock = vi.fn();
const assetsMock = vi.fn();

vi.mock("@/state", () => ({
  usePortfolioDividends: () => ({
    data: dividendsMock(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  usePortfolioAssets: () => ({
    data: assetsMock(),
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  }),
  useDeletePortfolioDividend: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useCreatePortfolioDividend: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
  useRecordOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ success: true }),
    isPending: false,
  }),
  usePortfolioPosition: () => ({
    rows: [
      { assetId: "a1", ticker: "PETR4", priceBRL: 30, valueBRL: 3000, isCash: false },
      { assetId: "a2", ticker: "MXRF11", priceBRL: 10, valueBRL: 500, isCash: false },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

const assets = [
  { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" as const, quantity: 100, average_price: 30 },
  { id: "a2", user_id: "u1", ticker: "MXRF11", asset_class: "FIIs", currency: "BRL" as const, quantity: 50, average_price: 10 },
];

const dividends = [
  { id: "t1", user_id: "u1", asset_id: "a1", date: "2026-08-10", amount: 100, notes: "DIVIDENDO" },
  { id: "t2", user_id: "u1", asset_id: "a2", date: "2026-08-20", amount: 50.25, notes: "RENDIMENTO" },
  { id: "t3", user_id: "u1", asset_id: "a1", date: "2026-07-05", amount: 40, notes: "DIVIDENDO" },
];

describe("ProventosTab — extrato e calendário (F18 e F36)", () => {
  beforeEach(() => {
    dividendsMock.mockReset();
    assetsMock.mockReset();
    assetsMock.mockReturnValue(assets);
  });

  it("mostra o total do mês e a lista de proventos com ticker (reconciliação)", () => {
    dividendsMock.mockReturnValue(dividends);
    renderTab();

    // 100 + 50,25 = 150,25 (07/05 é outro mês).
    expect(screen.getAllByText("R$ 150,25").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PETR4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("MXRF11").length).toBeGreaterThanOrEqual(1);
    // Sub-aba de calendário presente.
    expect(screen.getByRole("tab", { name: "Calendário" })).toBeInTheDocument();
  });

  it("navega o mês pelo MonthPicker e atualiza o extrato", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("button", { name: "Mês anterior" }));
    // Julho: apenas o dividendo de 40,00.
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("estado vazio sem nenhum provento nem estimativa", () => {
    dividendsMock.mockReturnValue([]);
    assetsMock.mockReturnValue([
      { id: "a1", user_id: "u1", ticker: "PETR4", asset_class: "Ações", currency: "BRL" as const, quantity: 100, average_price: 30 },
    ]);
    renderTab();
    expect(screen.getByText("Sem proventos ainda")).toBeInTheDocument();
  });

  it("exibe proventos históricos iniciais mesmo sem lançamentos periódicos ao acessar a aba Por Ativo", async () => {
    dividendsMock.mockReturnValue([]);
    assetsMock.mockReturnValue([
      {
        id: "a1",
        user_id: "u1",
        ticker: "PETR4",
        asset_class: "Ações",
        currency: "BRL" as const,
        quantity: 100,
        average_price: 30,
        accumulated_dividends: 1200,
      },
    ]);
    const user = userEvent.setup();
    renderTab();

    expect(screen.queryByText("Sem proventos ainda")).not.toBeInTheDocument();
    expect(screen.getByText("Nenhum provento recebido neste mês.")).toBeInTheDocument();

    // Navega para Por Ativo
    await user.click(screen.getByRole("tab", { name: "Por Ativo" }));
    expect(screen.getByText("Histórico Anterior")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 1.200,00").length).toBeGreaterThan(0);
    expect(screen.getByText("Proventos por Ativo")).toBeInTheDocument();
  });

  it("exibe a Bola de Neve usando dividendo estimado na sub-aba Bola de Neve", async () => {
    dividendsMock.mockReturnValue([]);
    assetsMock.mockReturnValue([
      {
        id: "a2",
        user_id: "u1",
        ticker: "MXRF11",
        asset_class: "FIIs",
        currency: "BRL" as const,
        quantity: 100,
        average_price: 10,
        estimated_monthly_dividend_per_share: 0.1,
      },
    ]);
    const user = userEvent.setup();
    renderTab();

    expect(screen.queryByText("Sem proventos ainda")).not.toBeInTheDocument();

    // Navega para Bola de Neve
    await user.click(screen.getByRole("tab", { name: "Bola de Neve" }));
    expect(screen.getByText("Efeito Bola de Neve (Renda Passiva)")).toBeInTheDocument();
    expect(screen.getByText("Estimado")).toBeInTheDocument();
  });

  it("clica em um mês do calendário e atualiza o extrato", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    renderTab();

    // Alterna para a sub-aba Calendário
    await user.click(screen.getByRole("tab", { name: "Calendário" }));
    expect(screen.getByText("Calendário de 2026")).toBeInTheDocument();

    // Botão de julho no calendário
    const julyButton = screen.getByRole("button", { name: /jul/i });
    await user.click(julyButton);
    // Ao clicar em julho, o calendário navega de volta para o extrato de julho
    expect(screen.getAllByText("R$ 40,00").length).toBeGreaterThan(0);
  });

  it("exibe o indicador do Efeito Bola de Neve para ativos com proventos", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    renderTab();

    await user.click(screen.getByRole("tab", { name: "Bola de Neve" }));
    expect(screen.getByText("Efeito Bola de Neve (Renda Passiva)")).toBeInTheDocument();
    expect(screen.getByText(/Progresso para que os proventos mensais comprem 1 nova cota inteira sozinhos/i)).toBeInTheDocument();
  });

  it("renderiza a barra de subseletores em pills com role='tablist' e aria-selected correto", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    renderTab();

    const tabList = screen.getByRole("tablist", { name: "Sub-abas de proventos" });
    expect(tabList).toBeInTheDocument();

    const mensalTab = screen.getByRole("tab", { name: "Extrato Mensal" });
    const calendarioTab = screen.getByRole("tab", { name: "Calendário" });
    const ativosTab = screen.getByRole("tab", { name: "Por Ativo" });
    const snowballTab = screen.getByRole("tab", { name: "Bola de Neve" });

    // Mensal selecionado por padrão
    expect(mensalTab).toHaveAttribute("aria-selected", "true");
    expect(calendarioTab).toHaveAttribute("aria-selected", "false");
    expect(ativosTab).toHaveAttribute("aria-selected", "false");
    expect(snowballTab).toHaveAttribute("aria-selected", "false");

    // Alternar para Por Ativo dispara feedback sensorial e atualiza aria-selected
    triggerSensoryMock.mockClear();
    await user.click(ativosTab);
    expect(triggerSensoryMock).toHaveBeenCalledWith("selection");
    expect(ativosTab).toHaveAttribute("aria-selected", "true");
    expect(mensalTab).toHaveAttribute("aria-selected", "false");
  });

  it("posiciona o MonthPicker na subaba Extrato Mensal e o oculta nas demais subabas", async () => {
    dividendsMock.mockReturnValue(dividends);
    const user = userEvent.setup();
    renderTab();

    // MonthPicker visível na subaba mensal
    expect(screen.getByRole("group", { name: "Selecionar mês" })).toBeInTheDocument();

    // Alterna para Calendário: MonthPicker deve ser ocultado
    await user.click(screen.getByRole("tab", { name: "Calendário" }));
    expect(screen.queryByRole("group", { name: "Selecionar mês" })).not.toBeInTheDocument();

    // Alterna para Por Ativo: MonthPicker continua oculto
    await user.click(screen.getByRole("tab", { name: "Por Ativo" }));
    expect(screen.queryByRole("group", { name: "Selecionar mês" })).not.toBeInTheDocument();

    // Alterna para Bola de Neve: MonthPicker continua oculto
    await user.click(screen.getByRole("tab", { name: "Bola de Neve" }));
    expect(screen.queryByRole("group", { name: "Selecionar mês" })).not.toBeInTheDocument();

    // Retorna para Extrato Mensal: MonthPicker reaparece abaixo dos subseletores
    await user.click(screen.getByRole("tab", { name: "Extrato Mensal" }));
    expect(screen.getByRole("group", { name: "Selecionar mês" })).toBeInTheDocument();
  });

  it("sincroniza o estado inicial da subaba a partir do parâmetro subtab na URL", () => {
    dividendsMock.mockReturnValue(dividends);
    renderTab(undefined, ["/investimentos?tab=proventos&subtab=snowball"]);

    const snowballTab = screen.getByRole("tab", { name: "Bola de Neve" });
    expect(snowballTab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Efeito Bola de Neve (Renda Passiva)")).toBeInTheDocument();
  });
});
