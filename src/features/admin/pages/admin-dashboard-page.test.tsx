import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "./admin-dashboard-page";

const mockMutate = vi.fn();
const mockRetentionRadar = vi.fn((limit: number) => ({
  data: [
    { user_id: "paid", name: "Cliente Pro", risk_kind: "paid_inactive_21d", last_seen_at: null },
    { user_id: "trial", email: "trial@teste.com", risk_kind: "trial_stalled_72h", last_seen_at: null },
    { user_id: "past-due", name: "Cliente com chamado", risk_kind: "past_due_with_ticket", last_seen_at: null },
  ].slice(0, limit),
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
}));

vi.mock("@/state", () => ({
  useAdminRetentionRadar: (limit: number) => mockRetentionRadar(limit),
  useAdminMetrics: () => ({
    data: {
      total_users: 10,
      active_users: 8,
      pending_users: 1,
      suspended_users: 1,
      total_invites: 4,
      used_invites: 2,
    },
    isLoading: false,
  }),
  useAdminUsers: () => ({
    data: [
      {
        id: "u-pending-1",
        name: "João Pendente",
        email: "joao@teste.com",
        role: "user",
        status: "pending_approval",
        created_at: "2026-11-10T10:00:00Z",
      },
    ],
    isLoading: false,
  }),
  useAdminUpdateUserStatus: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  useFeatureUsageMetrics: () => ({
    data: [],
    isLoading: false,
  }),
  useAdminSupportTickets: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useAdminPastDueSubscriptions: () => ({
    data: [],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
}));

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exibe o radar de retenção e encaminha para a gestão de usuários", () => {
    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    const radar = screen.getByRole("region", { name: "Radar de retenção" });
    expect(mockRetentionRadar).toHaveBeenCalledWith(10);
    expect(within(radar).getByText("Cliente Pro")).toBeInTheDocument();
    expect(within(radar).getByText("trial@teste.com")).toBeInTheDocument();
    expect(within(radar).getByText("Cliente com chamado")).toBeInTheDocument();
    expect(within(radar).getByText("Plano pago sem atividade há 21 dias")).toBeInTheDocument();
    expect(within(radar).getByText("Teste sem retorno após 72 h")).toBeInTheDocument();
    expect(within(radar).getByText("Pagamento em atraso com chamado aberto")).toBeInTheDocument();
    expect(within(radar).getByRole("link", { name: "Ver usuários" })).toHaveAttribute(
      "href",
      "/admin/usuarios",
    );
  });

  it("exige ConfirmDialog antes de recusar um usuário pendente", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AdminDashboardPage />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Recusar/i }));
    expect(mockMutate).not.toHaveBeenCalled();

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Recusar cadastro do usuário?")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Recusar cadastro" }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u-pending-1", status: "banned" }),
      expect.any(Object),
    );
  });
});
