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
    useUpsertMarcoZero: vi.fn(),
  };
});

vi.mock("@/services/toast", () => ({
  pushToast: vi.fn(),
}));

vi.mock("@/services/sensory", () => ({
  triggerSensory: vi.fn(),
}));

describe("InitialPocketCostDialog", () => {
  let queryClient: QueryClient;
  const mockUpsertMutateAsync = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    vi.mocked(stateModule.useUpsertMarcoZero).mockReturnValue({
      mutateAsync: mockUpsertMutateAsync.mockResolvedValue({}),
      isPending: false,
    } as unknown as ReturnType<typeof stateModule.useUpsertMarcoZero>);
  });

  it("renderiza no modo de definição quando não há marco zero prévio", () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog open={true} onOpenChange={vi.fn()} defaultCostBRL={1000} />
      </QueryClientProvider>,
    );

    expect(screen.getByText("Definir Marco Zero do Bolso")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar Marco Zero/i })).toBeInTheDocument();
  });

  it("carrega valor e data reais salvos e salva via RPC atômico sem duplicar registros", async () => {
    vi.mocked(stateModule.usePortfolioContributions).mockReturnValue({
      data: [
        {
          id: "contribution-marco-zero-123",
          asset_id: null,
          date: "2023-10-17",
          amount: 15418.78,
          notes: "Marco Zero do Bolso · Custo Histórico Inicial",
          user_id: "user-1",
          created_at: "2023-10-17T00:00:00Z",
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof stateModule.usePortfolioContributions>);

    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();

    render(
      <QueryClientProvider client={queryClient}>
        <InitialPocketCostDialog
          open={true}
          onOpenChange={onOpenChange}
          defaultCostBRL={17176.03}
          onSuccess={onSuccess}
        />
      </QueryClientProvider>,
    );

    // O título deve indicar recalibração e pré-carregar o valor salvo (não o defaultCostBRL)
    expect(screen.getByText("Recalibrar Marco Zero do Bolso")).toBeInTheDocument();
    const saveButton = screen.getByRole("button", { name: /Salvar Recalibração/i });
    expect(saveButton).toBeInTheDocument();

    fireEvent.click(saveButton);

    await waitFor(() => {
      // Deve usar o RPC atômico (upsertMarcoZero) com os valores salvos
      expect(mockUpsertMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15418.78,
          date: "2023-10-17",
        }),
      );
      expect(onSuccess).toHaveBeenCalled();
    });
  });
});
