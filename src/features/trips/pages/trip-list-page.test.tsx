import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { TripListPage } from "./trip-list-page";
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
    useUserTrips: vi.fn(),
    useCreateTripMutation: vi.fn(() => ({
      mutateAsync: vi.fn(),
      isPending: false,
    })),
  };
});

function renderTripListPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TripListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("TripListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authHook.useAuth).mockReturnValue({
      user: { id: "user-1", email: "user@test.com" },
    } as unknown as ReturnType<typeof authHook.useAuth>);
  });

  it("renderiza datas formatadas em pt-BR e link acessível sem aninhamento", () => {
    vi.mocked(tripsQuery.useUserTrips).mockReturnValue({
      data: [
        {
          id: "trip-1",
          host_user_id: "user-1",
          title: "Carnaval em Salvador",
          destination: "Salvador, BA",
          start_date: "2026-02-14",
          end_date: "2026-02-18",
          status: "active",
          currency: "BRL",
          public_token: "tok-ssa",
          passcode_hash: null,
          cover_photo_url: null,
          created_at: "",
          updated_at: "",
        },
      ],
      isLoading: false,
    } as unknown as ReturnType<typeof tripsQuery.useUserTrips>);

    renderTripListPage();

    expect(screen.getByText("Carnaval em Salvador")).toBeInTheDocument();
    expect(screen.getByText("14/02/2026 até 18/02/2026")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Acessar Detalhes/i });
    expect(link).toHaveAttribute("href", "/viagens/trip-1");
    expect(link.querySelector("button")).toBeNull();
  });

  it("renderiza empty state calmo quando não há viagens ativas", () => {
    vi.mocked(tripsQuery.useUserTrips).mockReturnValue({
      data: [],
      isLoading: false,
    } as unknown as ReturnType<typeof tripsQuery.useUserTrips>);

    renderTripListPage();

    expect(screen.getByText("Nenhuma viagem em andamento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar Primeira Viagem/i })).toBeInTheDocument();
  });
});
