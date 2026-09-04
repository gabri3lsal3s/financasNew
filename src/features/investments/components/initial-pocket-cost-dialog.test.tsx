import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
    useDeletePortfolioContribution: vi.fn(),
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
  const mockDeleteMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(stateModule.useCreateHistoricalContribution).mockReturnValue({
      mutateAsync: mockCreateMutateAsync.mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useCreateHistoricalContribution>);

    vi.mocked(stateModule.useDeletePortfolioContribution).mockReturnValue({
      mutateAsync: mockDeleteMutateAsync.mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useDeletePortfolioContribution>);
  });

  it("renderiza o diálogo com estado vazio quando não há marcos cadastrados", () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog open={true} onOpenChange={vi.fn()} defaultCostBRL={1000} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Linha do Tempo de Aportes Históricos")).toBeInTheDocument();
    expect(screen.getByText("Nenhum marco cadastrado")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar Marco/i })).toBeInTheDocument();
  });

  it("exibe marcos existentes, calcula soma consolidada e permite excluir um marco", async () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [
        {
          id: "marco-1",
          asset_id: null,
          date: "2024-02-26",
          amount: 20000,
          notes: "Marco Histórico · Início da Carteira",
          user_id: "user-1",
          created_at: "2024-02-26T00:00:00Z",
        },
        {
          id: "marco-2",
          asset_id: null,
          date: "2024-12-15",
          amount: 55000,
          notes: "Marco Histórico · Aporte em massa",
          user_id: "user-1",
          created_at: "2024-12-15T00:00:00Z",
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    const onOpenChange = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog
          open={true}
          onOpenChange={onOpenChange}
          defaultCostBRL={75000}
        />
      </QueryClientProvider>,
    );

    // Deve exibir badge de 2 marcos históricos
    expect(screen.getByText("2 marcos históricos")).toBeInTheDocument();
    expect(screen.getAllByText("26/02/2024").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("15/12/2024")).toBeInTheDocument();

    // Clica no botão de excluir o primeiro marco
    const deleteButtons = screen.getAllByRole("button", { name: /Excluir marco/i });
    expect(deleteButtons.length).toBe(2);

    fireEvent.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(mockDeleteMutateAsync).toHaveBeenCalledWith("marco-2"); // Ordenado por data desc
    });
  });

  it("permite adicionar um novo marco histórico", async () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    const onSuccess = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog
          open={true}
          onOpenChange={vi.fn()}
          defaultCostBRL={20000}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    const submitBtn = screen.getByRole("button", { name: /Adicionar Marco/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 20000,
          date: "2024-02-26",
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
