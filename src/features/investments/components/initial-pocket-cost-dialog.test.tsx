import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InitialPocketCostDialog } from "./initial-pocket-cost-dialog";
import * as stateModule from "@/state";

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof stateModule>();
  return {
    ...actual,
    usePortfolioContributions: vi.fn(),
    useCreateHistoricalContribution: vi.fn(),
    useUpdatePortfolioContribution: vi.fn(),
    useDeletePortfolioContribution: vi.fn(),
    useBatchCreateHistoricalContributions: vi.fn(),
    useUpsertMarcoZero: vi.fn(),
  };
});

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("InitialPocketCostDialog (Linha do Tempo de Aportes Históricos)", () => {
  let queryClient: QueryClient;
  const mockCreateMutateAsync = vi.fn();
  const mockUpdateMutateAsync = vi.fn();
  const mockDeleteMutateAsync = vi.fn();
  const mockBatchMutateAsync = vi.fn();
  const mockUpsertMarcoZeroMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(stateModule.useCreateHistoricalContribution).mockReturnValue({
      mutateAsync: mockCreateMutateAsync.mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useCreateHistoricalContribution>);

    vi.mocked(stateModule.useUpdatePortfolioContribution).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync.mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpdatePortfolioContribution>);

    vi.mocked(stateModule.useDeletePortfolioContribution).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync.mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useDeletePortfolioContribution>);

    vi.mocked(stateModule.useBatchCreateHistoricalContributions).mockReturnValue({
      mutateAsync: mockBatchMutateAsync.mockResolvedValue([{ id: "new-1" }]),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useBatchCreateHistoricalContributions>);

    vi.mocked(stateModule.useUpsertMarcoZero).mockReturnValue({
      mutateAsync: mockUpsertMarcoZeroMutateAsync.mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpsertMarcoZero>);
  });

  it("renderiza o diálogo com as 3 abas e estado inicial vazio", () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog open={true} onOpenChange={vi.fn()} defaultCostBRL={1000} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Linha do Tempo de Aportes Históricos")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Lançamento Individual/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Assistente de Extrato/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Modo Rápido/i })).toBeInTheDocument();
    expect(screen.getByText("Nenhum marco cadastrado")).toBeInTheDocument();
  });

  it("exibe marcos existentes com separação de Aporte e Resgate", async () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [
        {
          id: "marco-1",
          asset_id: null,
          date: "2024-02-26",
          amount: 20000,
          notes: "Aporte Inicial",
          user_id: "user-1",
          created_at: "2024-02-26T00:00:00Z",
        },
        {
          id: "marco-2",
          asset_id: null,
          date: "2024-10-15",
          amount: 5000,
          notes: "[Resgate] Retirada do Bolso",
          user_id: "user-1",
          created_at: "2024-10-15T00:00:00Z",
        },
      ],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Total Aportado (+)")).toBeInTheDocument();
    expect(screen.getByText("Total Resgatado (-)")).toBeInTheDocument();
    expect(screen.getByText("Capital Líquido do Bolso")).toBeInTheDocument();
    expect(screen.getByText("2 marcos")).toBeInTheDocument();

    // Deve exibir badges de Aporte e Resgate
    expect(screen.getByText("Aporte")).toBeInTheDocument();
    expect(screen.getByText("Resgate")).toBeInTheDocument();

    // Excluir um marco
    const deleteButtons = screen.getAllByRole("button", { name: /Excluir marco/i });
    expect(deleteButtons.length).toBe(2);
    fireEvent.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith("marco-2");
    });
  });

  it("permite alternar para Resgate no lançamento individual", async () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog open={true} onOpenChange={vi.fn()} defaultCostBRL={3000} />
      </QueryClientProvider>,
    );

    // Clica no botão de Resgate (-)
    const resgateBtn = screen.getByRole("button", { name: /Resgate \(-\)/i });
    fireEvent.click(resgateBtn);

    const submitBtn = screen.getByRole("button", { name: /Adicionar Marco/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 3000,
          notes: expect.stringContaining("[Resgate]"),
        }),
      );
    });
  });

  it("processa extrato e permite importação em lote na aba Assistente de Extrato", async () => {
    const user = userEvent.setup();

    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog open={true} onOpenChange={vi.fn()} />
      </QueryClientProvider>,
    );

    // Alterna para aba Assistente de Extrato via userEvent
    const tabExtrato = screen.getByRole("tab", { name: /Assistente de Extrato/i });
    await user.click(tabExtrato);

    expect(screen.getByText("Cálculo Automático de Aportes e Resgates")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/Cole o extrato aqui/i);
    const sample = `
      Out. 2023 6.187,37 6.147,97
      Nov. 2023 8.678,16 8.745,74
      Dez. 2023 13.527,62 14.221,47
    `;
    fireEvent.change(textarea, { target: { value: sample } });

    const processBtn = screen.getByRole("button", { name: /Processar Extrato/i });
    await user.click(processBtn);

    // Deve exibir preview
    await waitFor(() => {
      expect(screen.getByText("Pré-visualização dos Marcos Detectados")).toBeInTheDocument();
      expect(screen.getByText("3 movimentações")).toBeInTheDocument();
    });

    // Clica em gravar marcos
    const saveAllBtn = screen.getByRole("button", { name: /Gravar 3 Marcos/i });
    await user.click(saveAllBtn);

    await waitFor(() => {
      expect(mockBatchMutateAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ date: "2023-10-31", amount: 6187.37 }),
          expect.objectContaining({ date: "2023-11-30", amount: 2490.79 }),
          expect.objectContaining({ date: "2023-12-31", amount: 4849.46 }),
        ]),
      );
    });
  });
});
