import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsButton } from "./notifications-button";

const mockUseReminders = vi.fn();
const mockUseOnboardingCounts = vi.fn();

vi.mock("@/state", () => ({
  useReminders: () => mockUseReminders(),
  useOnboardingCounts: () => mockUseOnboardingCounts(),
  useSetReminderState: () => ({ mutate: vi.fn(), isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe("NotificationsButton", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOnboardingCounts.mockReturnValue({
      data: { expenseCategories: 5, incomeCategories: 5, cards: 1, transactions: 1 },
    });
  });
  it("renderiza o sininho com badge de contagem quando há pendências", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 3,
      overdueCount: 1,
      dueTodayCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações: 3 pendências" })).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("não renderiza o botão quando não há itens (totalCount === 0)", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });

    const { container } = render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("abre o popover ao clicar no sininho quando há notificações", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 2,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Notificações/i }));
    expect(screen.getByText("Lembretes & Avisos")).toBeInTheDocument();
  });

  it("renderiza o sininho com 1 pendência quando não há lembretes mas há onboarding pendente", () => {
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      overdueCount: 0,
      dueTodayCount: 0,
      isLoading: false,
    });
    mockUseOnboardingCounts.mockReturnValue({
      data: { expenseCategories: 0, incomeCategories: 0, cards: 0, transactions: 0 },
    });

    render(
      <MemoryRouter>
        <NotificationsButton />
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Notificações: 1 pendências" })).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });
});
