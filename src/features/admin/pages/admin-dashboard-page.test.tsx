import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminDashboardPage } from "./admin-dashboard-page";

const mockMutate = vi.fn();

vi.mock("@/state", () => ({
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
