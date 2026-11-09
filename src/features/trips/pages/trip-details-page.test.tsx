import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TripDetailsPage } from "./trip-details-page";
import type { User, Session } from "@supabase/supabase-js";
import * as tripsQuery from "@/state/queries/use-trips";
import * as authHook from "@/hooks/use-auth";
import * as tripModeState from "@/state";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/state", async (importOriginal) => {
  const actual = await importOriginal<typeof tripModeState>();
  return {
    ...actual,
    useTripMode: vi.fn(() => ({
      isTripModeEnabled: true,
      toggleTripMode: vi.fn(),
      isPending: false,
    })),
  };
});

vi.mock("@/state/queries/use-trips", async (importOriginal) => {
  const actual = await importOriginal<typeof tripsQuery>();
  return {
    ...actual,
    useTripDetails: vi.fn(),
    useRemoveTripMemberMutation: vi.fn(() => ({
      mutate: vi.fn(),
      isPending: false,
    })),
    useDeleteTripMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
    useUpdateTripMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
    useUnlinkTripMemberMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

const mockCompletedTripData = {
  trip: {
    id: "trip-ubatuba",
    title: "Viagem Ubatuba 2026",
    destination: "Ubatuba, SP",
    start_date: "2026-03-01",
    end_date: "2026-03-05",
    status: "completed" as const,
    currency: "BRL",
    public_token: "token-ubatuba",
    host_user_id: "user-host-1",
    created_at: "2026-03-01T00:00:00Z",
    updated_at: "2026-03-05T00:00:00Z",
  },
  members: [
    {
      id: "m-host",
      trip_id: "trip-ubatuba",
      user_id: "user-host-1",
      name: "Gabriel Organizador",
      is_host: true,
      pix_key: "gabriel@pix.com",
      pix_key_type: "email" as const,
      created_at: "2026-03-01T00:00:00Z",
    },
    {
      id: "m-guest",
      trip_id: "trip-ubatuba",
      user_id: "user-guest-2",
      name: "Mariana Convidada",
      is_host: false,
      pix_key: "mariana@pix.com",
      pix_key_type: "email" as const,
      created_at: "2026-03-01T00:00:00Z",
    },
  ],
  expenses: [],
  settlements: [],
  balances: [
    {
      memberId: "m-host",
      memberName: "Gabriel Organizador",
      totalPaidCents: 10000,
      totalOwedCents: 5000,
      netBalanceCents: 5000,
    },
    {
      memberId: "m-guest",
      memberName: "Mariana Convidada",
      totalPaidCents: 0,
      totalOwedCents: 5000,
      netBalanceCents: -5000,
    },
  ],
  suggestedSettlements: [],
  totalExpensesCents: 10000,
};

function renderTripDetailsPage(initialPath = "/viagens/trip-ubatuba") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/viagens/:id" element={<TripDetailsPage />} />
          <Route path="/viagens" element={<div>Lista de Viagens</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("TripDetailsPage - Reabertura, Exclusão e Saída de Viagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTripReturn = {
    data: mockCompletedTripData as unknown as NonNullable<ReturnType<typeof tripsQuery.useTripDetails>["data"]>,
    isLoading: false,
  } as unknown as ReturnType<typeof tripsQuery.useTripDetails>;

  it("organizador visualiza botões de Reabrir Viagem e Excluir Viagem quando a viagem está finalizada", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: { id: "user-host-1", email: "gabriel@teste.com" } as unknown as User,
      session: {} as unknown as Session,
      loading: false,
      configError: null,
    } as unknown as ReturnType<typeof authHook.useAuth>);

    vi.mocked(tripsQuery.useTripDetails).mockReturnValue(mockTripReturn);

    renderTripDetailsPage();

    expect(screen.getByRole("button", { name: /Reabrir Viagem/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Excluir Viagem/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sair da Viagem/i })).not.toBeInTheDocument();
  });

  it("organizador pode abrir o diálogo de Reabrir Viagem", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: { id: "user-host-1", email: "gabriel@teste.com" } as unknown as User,
      session: {} as unknown as Session,
      loading: false,
      configError: null,
    } as unknown as ReturnType<typeof authHook.useAuth>);

    vi.mocked(tripsQuery.useTripDetails).mockReturnValue(mockTripReturn);

    renderTripDetailsPage();

    const reopenButton = screen.getByRole("button", { name: /Reabrir Viagem/i });
    fireEvent.click(reopenButton);

    expect(screen.getByRole("heading", { name: /Reabrir viagem\?/i })).toBeInTheDocument();
  });

  it("organizador pode abrir o diálogo de Excluir Viagem", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: { id: "user-host-1", email: "gabriel@teste.com" } as unknown as User,
      session: {} as unknown as Session,
      loading: false,
      configError: null,
    } as unknown as ReturnType<typeof authHook.useAuth>);

    vi.mocked(tripsQuery.useTripDetails).mockReturnValue(mockTripReturn);

    renderTripDetailsPage();

    const deleteButton = screen.getByRole("button", { name: /Excluir Viagem/i });
    fireEvent.click(deleteButton);

    expect(screen.getByRole("heading", { name: /Excluir viagem\?/i })).toBeInTheDocument();
  });

  it("participante convidado não-organizador visualiza o botão de Sair da Viagem e abre o diálogo de confirmação", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: { id: "user-guest-2", email: "mariana@teste.com" } as unknown as User,
      session: {} as unknown as Session,
      loading: false,
      configError: null,
    } as unknown as ReturnType<typeof authHook.useAuth>);

    vi.mocked(tripsQuery.useTripDetails).mockReturnValue(mockTripReturn);

    renderTripDetailsPage();

    // Não deve exibir opções de host
    expect(screen.queryByRole("button", { name: /Excluir Viagem/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reabrir Viagem/i })).not.toBeInTheDocument();

    // Deve exibir botão Sair da Viagem
    const leaveButtons = screen.getAllByRole("button", { name: /Sair da Viagem/i });
    expect(leaveButtons.length).toBeGreaterThan(0);

    // Clica para abrir o diálogo
    fireEvent.click(leaveButtons[0]!);

    expect(screen.getByRole("heading", { name: /Sair da viagem\?/i })).toBeInTheDocument();
    expect(screen.getByText(/Tem certeza de que deseja sair de "Viagem Ubatuba 2026"\?/i)).toBeInTheDocument();
  });
});
