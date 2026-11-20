import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatDateBR, nextConsecutiveMonthDate, todayISO } from "@/lib/date";
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

  it("renderiza o diálogo com as 2 abas canônicas e estado inicial vazio", () => {
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
    expect(screen.getByRole("tab", { name: /Modo Rápido/i })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /Assistente de Extrato/i })).not.toBeInTheDocument();
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
          date: todayISO(),
          amount: 3000,
          notes: expect.stringContaining("[Resgate]"),
        }),
      );
    });
    expect(screen.queryByText("26/02/2024")).not.toBeInTheDocument();
    // Avanço temporal sequencial: o campo de data avança automaticamente para o próximo mês
    expect(screen.getByText(formatDateBR(nextConsecutiveMonthDate(todayISO())))).toBeInTheDocument();
  });

  it("permite acionar o diálogo de fechamentos a partir do rodapé", () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [],
      isLoading: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    const mockOpenSnapshots = vi.fn();
    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog
          open={true}
          onOpenChange={vi.fn()}
          onOpenSnapshotsDialog={mockOpenSnapshots}
        />
      </QueryClientProvider>,
    );

    const btn = screen.getByRole("button", { name: /Auditar Fechamentos/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(mockOpenSnapshots).toHaveBeenCalledTimes(1);
  });

  it("oferece atalho de 'Sem aporte (R$ 0)' para registrar fechamento puro", () => {
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

    const zeroBtn = screen.getByRole("button", { name: /Sem aporte \(R\$ 0\)/i });
    expect(zeroBtn).toBeInTheDocument();
    fireEvent.click(zeroBtn);
  });
});
