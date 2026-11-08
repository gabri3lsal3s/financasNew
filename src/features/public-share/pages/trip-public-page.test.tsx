import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TripPublicPage } from "./trip-public-page";
import * as tripsQuery from "@/state/queries/use-trips";

vi.mock("@/state/queries/use-trips", async (importOriginal) => {
  const actual = await importOriginal<typeof tripsQuery>();
  return {
    ...actual,
    usePublicTrip: vi.fn(),
    useSubmitPublicTripExpenseMutation: vi.fn(() => ({
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
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TripPublicPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("permite selecionar um participante para ver o resumo pessoal", async () => {
    const user = userEvent.setup();
    vi.mocked(tripsQuery.usePublicTrip).mockReturnValue({
      data: mockTripData,
      isLoading: false,
      error: null,
    } as never);

    renderPage();

    // Clica no botão do participante "Pedro"
    const pedroButton = screen.getByRole("button", { name: "Pedro" });
    await user.click(pedroButton);

    expect(screen.getByText("Você deve R$ 100,00")).toBeInTheDocument();
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
      expect.stringContaining("financasnew.gabrielisaacsales.workers.dev%2Fviagem%2Ftoken123"),
      "_blank"
    );

    openSpy.mockRestore();
  });
});
