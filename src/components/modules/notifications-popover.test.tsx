import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationsPopover } from "./notifications-popover";

const mockUseReminders = vi.fn();
const mockUseOnboardingCounts = vi.fn();
const mockSetReminderStateMutate = vi.fn();
const mockMarkAllMutate = vi.fn();

vi.mock("@/state", () => ({
  useReminders: () => mockUseReminders(),
  useOnboardingCounts: () => mockUseOnboardingCounts(),
  useSetReminderState: () => ({ mutate: mockSetReminderStateMutate, isPending: false }),
  useMarkAllRemindersAsRead: () => ({ mutate: mockMarkAllMutate, isPending: false }),
}));

describe("NotificationsPopover", () => {
  beforeEach(() => {
    localStorage.clear();
    mockUseOnboardingCounts.mockReturnValue({
      data: { expenseCategories: 5, incomeCategories: 5, cards: 1, transactions: 1 },
    });
  });
  it("renderiza lista com lembretes e permite marcar lido", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [
        {
          key: "debt:d1",
          title: "Empréstimo Banco",
          subtitle: "A pagar",
          dueDate: "2026-08-10",
          amountCents: 15000,
          status: "overdue",
          kind: "debt",
          link: { path: "/dividas", params: { q: "d1" } },
        },
      ],
      totalCount: 1,
      urgentCount: 1,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Lembretes & Avisos")).toBeInTheDocument();
    expect(screen.getByText("Empréstimo Banco")).toBeInTheDocument();
    expect(screen.getByText("Vencido")).toBeInTheDocument();

    const markReadBtn = screen.getByRole("button", { name: /Marcar Empréstimo Banco como lido/i });
    await user.click(markReadBtn);
    expect(mockSetReminderStateMutate).toHaveBeenCalledWith({
      occurrenceKey: "debt:d1",
      state: { kind: "read" },
    });
  });

  it("renderiza empty state quando não há itens", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Tudo em dia")).toBeInTheDocument();
  });

  it("renderiza item de configuração inicial quando há passos incompletos e permite dispensar", async () => {
    const user = userEvent.setup();
    mockUseReminders.mockReturnValue({
      items: [],
      totalCount: 0,
      urgentCount: 0,
      isLoading: false,
    });
    mockUseOnboardingCounts.mockReturnValue({
      data: { expenseCategories: 1, incomeCategories: 0, cards: 0, transactions: 0 },
    });

    render(
      <MemoryRouter>
        <NotificationsPopover>
          <button type="button">Sininho</button>
        </NotificationsPopover>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Sininho" }));
    expect(screen.getByText("Configuração inicial")).toBeInTheDocument();
    expect(screen.getByText("1/4 passos")).toBeInTheDocument();

    const dismissBtn = screen.getByRole("button", { name: /Ignorar configuração inicial/i });
    await user.click(dismissBtn);

    expect(screen.queryByText("1/4 passos")).not.toBeInTheDocument();
  });
});
