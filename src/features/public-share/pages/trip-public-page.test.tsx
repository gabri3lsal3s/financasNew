import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TripPublicPage } from "./trip-public-page";
import * as tripsQuery from "@/state/queries/use-trips";
import * as authHook from "@/hooks/use-auth";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/state/queries/use-trips", async (importOriginal) => {
  const actual = await importOriginal<typeof tripsQuery>();
  return {
    ...actual,
    usePublicTrip: vi.fn(),
    useUserTrips: vi.fn(() => ({ data: [], isLoading: false })),
    useSubmitPublicTripExpenseMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
    useClaimTripMemberMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

const mockTripData = {
  trip: {
    id: "trip-1",
    title: "Mochilão Chapada",
    destination: "Chapada Diamantina",
    start_date: "2027-01-10",
    end_date: "2027-01-15",
    status: "active" as const,
    currency: "BRL",
    public_token: "token123",
    cover_photo_url: null,
    has_passcode: false,
  },
  members: [
    {
      id: "m1",
      name: "Gabriel",
      is_host: true,
      has_axis_account: true,
      pix_key: "gabriel@axis.app",
      pix_key_type: "email" as const,
    },
    {
      id: "m2",
      name: "Pedro",
      is_host: false,
      has_axis_account: false,
      pix_key: null,
      pix_key_type: null,
    },
  ],
  expenses: [
    {
      id: "e1",
      paid_by_member_id: "m1",
      amount_cents: 20000,
      description: "Hospedagem",
      category_name: "Hospedagem",
      expense_date: "2027-01-10",
      split_type: "equal" as const,
      receipt_url: null,
      created_at: "",
      splits: [
        { member_id: "m1", share_cents: 10000 },
        { member_id: "m2", share_cents: 10000 },
      ],
    },
  ],
  settlements: [],
  balances: [
    {
      memberId: "m1",
      name: "Gabriel",
      totalPaidCents: 20000,
      totalOwedCents: 10000,
      netBalanceCents: 10000,
    },
    {
      memberId: "m2",
      name: "Pedro",
      totalPaidCents: 0,
      totalOwedCents: 10000,
      netBalanceCents: -10000,
    },
  ],
  suggestedSettlements: [
    {
      fromMemberId: "m2",
      fromMemberName: "Pedro",
      toMemberId: "m1",
      toMemberName: "Gabriel",
      toPixKey: "gabriel@axis.app",
      toPixKeyType: "email" as const,
      amountCents: 10000,
    },
  ],
  totalExpensesCents: 20000,
};

function renderPage(token = "token123") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/viagem/${token}`]}>
        <Routes>
          <Route path="/viagem/:token" element={<TripPublicPage />} />
          <Route path="/viagens/:id" element={<div>Viagem Logada no App</div>} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TripPublicPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    vi.mocked(authHook.useAuth).mockReturnValue({
      session: null,
    } as unknown as ReturnType<typeof authHook.useAuth>);
    vi.mocked(tripsQuery.useUserTrips).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof tripsQuery.useUserTrips>);
  });

  it("renderiza loading quando os dados estiverem carregando", () => {
    vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as never);

    renderPage();
    expect(screen.queryByText("Mochilão Chapada")).not.toBeInTheDocument();
  });

  it("renderiza empty state quando a viagem não for encontrada", () => {
    vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error("Not found"),
    } as never);

    renderPage();
    expect(screen.getByText("Viagem não encontrada")).toBeInTheDocument();
  });

  it("renderiza detalhes da viagem e lista de despesas", () => {
    vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
      data: mockTripData,
      isLoading: false,
      error: null,
    } as never);

    renderPage();
    expect(screen.getByText("Mochilão Chapada")).toBeInTheDocument();
    expect(screen.getByText("Chapada Diamantina")).toBeInTheDocument();
    expect(screen.getAllByText("R$ 200,00").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Hospedagem").length).toBeGreaterThanOrEqual(1);
  });

  it("permite selecionar um participante para ver o resumo pessoal e alterar a seleção", async () => {
    const user = userEvent.setup();
    vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
      data: mockTripData,
      isLoading: false,
      error: null,
    } as never);

    renderPage();

    // Inicialmente exibe o título de identificação
    expect(screen.getByText("Quem é você nesta viagem?")).toBeInTheDocument();

    // Clica no botão do participante "Pedro"
    const pedroButton = screen.getByRole("button", { name: "Pedro" });
    await user.click(pedroButton);

    // Exibe a badge ativa, saldo devedor e botão Alterar
    expect(screen.getByText("Você é Pedro")).toBeInTheDocument();
    expect(screen.getByText("Você deve R$ 100,00")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /alterar/i })).toBeInTheDocument();
    expect(window.localStorage.getItem("axis_guest_member_token123")).toBe("m2");

    // Clica em Alterar para limpar a seleção
    await user.click(screen.getByRole("button", { name: /alterar/i }));
    expect(screen.getByText("Quem é você nesta viagem?")).toBeInTheDocument();
  });

  it("dispara compartilhamento via WhatsApp com URL canônica da aplicação", async () => {
    const user = userEvent.setup();
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
      data: mockTripData,
      isLoading: false,
      error: null,
    } as never);

    renderPage();

    const shareButton = screen.getByRole("button", { name: /Compartilhar/i });
    await user.click(shareButton);

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent("/viagem/token123")),
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
  });

  describe("Tarefa 2.4: Fluxo de Reivindicação de Conta com 1 Clique", () => {
    it("exibe botão de destaque 'Vincular esta viagem ao meu aplicativo Axir' quando usuário estiver autenticado e não vinculado", () => {
      vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
        data: mockTripData,
        isLoading: false,
        error: null,
      } as never);

      vi.mocked(authHook.useAuth).mockReturnValue({
        session: { user: { id: "user_pedro" } },
      } as unknown as ReturnType<typeof authHook.useAuth>);

      vi.mocked(tripsQuery.useUserTrips).mockReturnValue({
        data: [],
        isLoading: false,
      } as unknown as ReturnType<typeof tripsQuery.useUserTrips>);

      renderPage();

      const claimButtons = screen.getAllByRole("button", {
        name: /Vincular esta viagem ao meu aplicativo Axir/i,
      });
      expect(claimButtons.length).toBeGreaterThanOrEqual(1);
    });

    it("não exibe botão de destaque quando o visitante for anônimo (não autenticado)", () => {
      vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
        data: mockTripData,
        isLoading: false,
        error: null,
      } as never);

      vi.mocked(authHook.useAuth).mockReturnValue({
        session: null,
      } as unknown as ReturnType<typeof authHook.useAuth>);

      renderPage();

      expect(
        screen.queryByRole("button", {
          name: /Vincular esta viagem ao meu aplicativo Axir/i,
        })
      ).not.toBeInTheDocument();
    });

    it("exibe aviso de viagem já vinculada quando usuário já possuir esta viagem vinculada", () => {
      vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
        data: mockTripData,
        isLoading: false,
        error: null,
      } as never);

      vi.mocked(authHook.useAuth).mockReturnValue({
        session: { user: { id: "user_host" } },
      } as unknown as ReturnType<typeof authHook.useAuth>);

      vi.mocked(tripsQuery.useUserTrips).mockReturnValue({
        data: [
          {
            id: "trip-1",
            title: "Mochilão Chapada",
            destination: "Chapada Diamantina",
            start_date: "2027-01-10",
            end_date: "2027-01-15",
            status: "active",
            currency: "BRL",
            public_token: "token123",
            cover_photo_url: null,
            created_at: "",
            updated_at: "",
          },
        ],
        isLoading: false,
      } as unknown as ReturnType<typeof tripsQuery.useUserTrips>);

      renderPage();

      expect(
        screen.getByText("Esta viagem está sincronizada com a sua conta Axir")
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Abrir no Aplicativo/i })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("button", {
          name: /Vincular esta viagem ao meu aplicativo Axir/i,
        })
      ).not.toBeInTheDocument();
    });

    it("abre modal rápido de confirmação, confirma e redireciona para a rota logada da viagem (/viagens/:id)", async () => {
      const user = userEvent.setup();
      const mockMutateAsync = vi.fn().mockResolvedValue({
        success: true,
        trip_id: "trip-1",
        member_id: "m2",
        user_id: "user_pedro",
      });

      vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
        data: mockTripData,
        isLoading: false,
        error: null,
      } as never);

      vi.mocked(authHook.useAuth).mockReturnValue({
        session: { user: { id: "user_pedro" } },
      } as unknown as ReturnType<typeof authHook.useAuth>);

      vi.mocked(tripsQuery.useUserTrips).mockReturnValue({
        data: [],
        isLoading: false,
      } as unknown as ReturnType<typeof tripsQuery.useUserTrips>);

      vi.mocked(tripsQuery.useClaimTripMemberMutation).mockReturnValue({
        mutateAsync: mockMutateAsync,
        isPending: false,
      } as unknown as ReturnType<typeof tripsQuery.useClaimTripMemberMutation>);

      renderPage();

      // Clica no botão de destaque
      const claimButtons = screen.getAllByRole("button", {
        name: /Vincular esta viagem ao meu aplicativo Axir/i,
      });
      const claimButton = claimButtons[0];
      expect(claimButton).toBeDefined();
      await user.click(claimButton!);

      // Modal abre
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Vincular Viagem à sua Conta")).toBeInTheDocument();
      expect(within(dialog).getByText("Participantes disponíveis (1)")).toBeInTheDocument();
      expect(within(dialog).getByText("Pedro")).toBeInTheDocument();

      // Confirma o vínculo
      const confirmButton = within(dialog).getByRole("button", { name: "Confirmar e Vincular" });
      await user.click(confirmButton);

      expect(mockMutateAsync).toHaveBeenCalledWith({
        token: "token123",
        memberId: "m2",
        passcode: undefined,
      });

      // Redireciona para rota interna /viagens/trip-1
      expect(screen.getByText("Viagem Logada no App")).toBeInTheDocument();
    });
  });
});
